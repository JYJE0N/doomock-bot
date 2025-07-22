// src/services/TodoService.js - 완전 리팩토링된 버전
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const ResponseHelper = require("../utils/ResponseHelper");

class TodoService extends BaseService {
  constructor() {
    super("todo_userStates");
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;
    this.userTodos = new Map();
  }

  /**
   * 초기화 시 DB에서 데이터 로드
   */
  async onInitialize() {
    logger.info("📋 TodoService 데이터 로드 중...");

    if (this.dbEnabled) {
      await this.loadFromDatabase();
    } else {
      await this.loadFromBackup();
    }
  }

  /**
   * DB에서 모든 할일 로드
   */
  async loadFromDatabase() {
    try {
      const todos = await this.collection.find({}).toArray();

      // 사용자별로 그룹화
      todos.forEach((todo) => {
        const userId = todo.userId.toString();
        if (!this.userTodos.has(userId)) {
          this.userTodos.set(userId, []);
        }

        this.userTodos.get(userId).push({
          id: todo._id.toString(),
          task: todo.task,
          completed: todo.completed || false,
          createdAt: todo.createdAt || new Date(),
          updatedAt: todo.updatedAt,
          priority: todo.priority || "normal",
        });
      });

      // 메모리 스토리지에도 저장
      this.userTodos.forEach((todos, userId) => {
        this.memoryStorage.set(userId, { todos });
      });

      logger.info(`✅ ${todos.length}개 할일 로드 완료`);
    } catch (error) {
      logger.error("할일 로드 실패:", error);
    }
  }

  /**
   * Railway 환경변수에서 백업 로드
   */
  async loadFromBackup() {
    try {
      const backup = process.env.TODO_BACKUP_DATA;
      if (backup) {
        const data = JSON.parse(backup);
        Object.entries(data).forEach(([userId, userData]) => {
          this.userTodos.set(userId, userData.todos || []);
          this.memoryStorage.set(userId, userData);
        });
        logger.info("✅ 백업에서 할일 복원됨");
      }
    } catch (error) {
      logger.error("백업 로드 실패:", error);
    }
  }

  /**
   * ✅ 호환성을 위한 기존 getUserTodos 메서드 (원시 데이터 반환)
   */
  async getUserTodos(userId) {
    userId = userId.toString();

    // 메모리에서 먼저 확인
    if (this.userTodos.has(userId)) {
      return this.userTodos.get(userId);
    }

    // DB에서 조회
    if (this.dbEnabled) {
      try {
        const todos = await this.collection.find({ userId }).toArray();
        const formattedTodos = todos.map((todo) => ({
          id: todo._id.toString(),
          task: todo.task,
          completed: todo.completed || false,
          createdAt: todo.createdAt || new Date(),
          updatedAt: todo.updatedAt,
          priority: todo.priority || "normal",
        }));

        this.userTodos.set(userId, formattedTodos);
        return formattedTodos;
      } catch (error) {
        logger.error(`사용자 ${userId} 할일 조회 실패:`, error);
      }
    }

    return [];
  }

  /**
   * ✅ 할일 목록 조회 - 표준 응답 형태 (새로 추가)
   */
  async getTodos(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(todos, {
        totalCount: todos.length,
        completedCount: todos.filter((t) => t.completed).length,
        pendingCount: todos.filter((t) => !t.completed).length,
        message:
          todos.length > 0
            ? `${todos.length}개의 할일을 불러왔습니다.`
            : "등록된 할일이 없습니다.",
      });
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      return ResponseHelper.serverError(
        "할일 목록을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ✅ 할일 추가 (성공/실패 응답 형태 통일)
   */
  async addTodo(userId, task, priority = "normal") {
    try {
      userId = userId.toString();

      // 입력 검증
      if (!task || task.trim().length === 0) {
        return ResponseHelper.validationError(
          "task",
          "할일 내용을 입력해주세요."
        );
      }

      if (task.length > 200) {
        return ResponseHelper.validationError(
          "task",
          "할일은 200자 이내로 입력해주세요."
        );
      }

      // 할일 수 제한 확인
      const todos = await this.getUserTodos(userId);
      if (todos.length >= this.maxTodosPerUser) {
        return ResponseHelper.error(
          `최대 ${this.maxTodosPerUser}개까지만 추가할 수 있습니다.`
        );
      }

      const newTodo = {
        id: Date.now().toString(),
        task: task.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: null,
        priority,
      };

      // 메모리에 추가
      if (!this.userTodos.has(userId)) {
        this.userTodos.set(userId, []);
      }
      this.userTodos.get(userId).push(newTodo);

      // DB에 저장
      if (this.dbEnabled) {
        try {
          await this.collection.insertOne({
            _id: newTodo.id,
            userId,
            ...newTodo,
          });
        } catch (error) {
          logger.error("할일 DB 저장 실패:", error);
        }
      }

      // 메모리 스토리지 업데이트
      await this.save(userId, { todos: this.userTodos.get(userId) });

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(newTodo, {
        stats: await this.getTodoStats(userId),
        message: "할일이 성공적으로 추가되었습니다.",
      });
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      return ResponseHelper.serverError("할일 추가 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 할일 완료/미완료 토글 (응답 형태 통일)
   */
  async toggleTodo(userId, todoId) {
    try {
      userId = userId.toString();

      const todos = await this.getUserTodos(userId);
      const todo = todos.find((t) => t.id === todoId);

      if (!todo) {
        return ResponseHelper.notFound("할일");
      }

      const previousState = todo.completed;
      todo.completed = !todo.completed;
      todo.updatedAt = new Date();

      // DB 업데이트
      if (this.dbEnabled) {
        try {
          await this.collection.updateOne(
            { _id: todoId },
            {
              $set: {
                completed: todo.completed,
                updatedAt: todo.updatedAt,
              },
            }
          );
        } catch (error) {
          logger.error("할일 상태 업데이트 실패:", error);
        }
      }

      // 메모리 스토리지 업데이트
      await this.save(userId, { todos: this.userTodos.get(userId) });

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(todo, {
        message: todo.completed
          ? "할일이 완료되었습니다."
          : "할일이 미완료로 변경되었습니다.",
        previousState,
        currentState: todo.completed,
      });
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return ResponseHelper.serverError(
        "할일 상태 변경 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ✅ 할일 삭제 - 표준 응답 형태
   */
  async deleteTodo(userId, todoId) {
    try {
      userId = userId.toString();

      const todos = await this.getUserTodos(userId);
      const index = todos.findIndex((t) => t.id === todoId);

      if (index === -1) {
        return ResponseHelper.notFound("할일");
      }

      const deletedTodo = todos.splice(index, 1)[0];

      // DB에서 삭제
      if (this.dbEnabled) {
        try {
          await this.collection.deleteOne({ _id: todoId });
        } catch (error) {
          logger.error("할일 삭제 실패:", error);
        }
      }

      // 메모리 스토리지 업데이트
      await this.save(userId, { todos: this.userTodos.get(userId) });

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(deletedTodo, {
        message: "할일이 삭제되었습니다.",
        remainingCount: todos.length,
      });
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return ResponseHelper.serverError("할일 삭제 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 할일 검색 - 표준 응답 형태
   */
  async searchTodos(userId, keyword) {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return ResponseHelper.validationError(
          "keyword",
          "검색 키워드를 입력해주세요."
        );
      }

      const todos = await this.getUserTodos(userId);
      const lowerKeyword = keyword.trim().toLowerCase();

      const filteredTodos = todos.filter((todo) =>
        todo.task.toLowerCase().includes(lowerKeyword)
      );

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(filteredTodos, {
        keyword: keyword.trim(),
        totalFound: filteredTodos.length,
        totalTodos: todos.length,
        message:
          filteredTodos.length > 0
            ? `${filteredTodos.length}개의 할일을 찾았습니다.`
            : "검색 결과가 없습니다.",
      });
    } catch (error) {
      logger.error("할일 검색 실패:", error);
      return ResponseHelper.serverError("검색 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 완료된 할일 정리 - 표준 응답 형태
   */
  async clearCompleted(userId) {
    try {
      userId = userId.toString();

      const todos = await this.getUserTodos(userId);
      const completedTodos = todos.filter((t) => t.completed);

      if (completedTodos.length === 0) {
        return ResponseHelper.success(null, "정리할 완료된 할일이 없습니다.");
      }

      const completedIds = completedTodos.map((t) => t.id);
      const remainingTodos = todos.filter((t) => !t.completed);

      // 메모리에서 제거
      this.userTodos.set(userId, remainingTodos);

      // DB에서 삭제
      if (this.dbEnabled && completedIds.length > 0) {
        try {
          await this.collection.deleteMany({
            _id: { $in: completedIds },
          });
        } catch (error) {
          logger.error("완료된 할일 삭제 실패:", error);
        }
      }

      // 메모리 스토리지 업데이트
      await this.save(userId, { todos: remainingTodos });

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(
        {
          clearedTodos: completedTodos,
          remainingTodos: remainingTodos,
        },
        {
          clearedCount: completedIds.length,
          remainingCount: remainingTodos.length,
          message: `${completedIds.length}개의 완료된 할일을 정리했습니다.`,
        }
      );
    } catch (error) {
      logger.error("완료된 할일 정리 실패:", error);
      return ResponseHelper.serverError("할일 정리 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 통계 조회 - 표준 응답 형태
   */
  async getTodoStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      const stats = {
        total: todos.length,
        completed: todos.filter((t) => t.completed).length,
        pending: todos.filter((t) => !t.completed).length,
        highPriority: todos.filter((t) => t.priority === "high").length,
        normalPriority: todos.filter((t) => t.priority === "normal").length,
        lowPriority: todos.filter((t) => t.priority === "low").length,
        completionRate:
          todos.length > 0
            ? Math.round(
                (todos.filter((t) => t.completed).length / todos.length) * 100
              )
            : 0,
      };

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(stats, {
        message: "통계를 성공적으로 조회했습니다.",
      });
    } catch (error) {
      logger.error("할일 통계 조회 실패:", error);
      return ResponseHelper.serverError("통계 조회 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 할일 검색 (응답 형태 통일)
   */
  async searchTodos(userId, keyword) {
    try {
      const todos = await this.getUserTodos(userId);
      const lowerKeyword = keyword.toLowerCase();

      const filteredTodos = todos.filter((todo) =>
        todo.task.toLowerCase().includes(lowerKeyword)
      );

      return {
        success: true,
        todos: filteredTodos,
        keyword: keyword,
        total: filteredTodos.length,
      };
    } catch (error) {
      logger.error("할일 검색 실패:", error);
      return {
        success: false,
        error: "검색 중 오류가 발생했습니다.",
        todos: [],
      };
    }
  }

  /**
   * ✅ 할일 내보내기 - 표준 응답 형태
   */
  async exportTodos(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      if (todos.length === 0) {
        return ResponseHelper.error("내보낼 할일이 없습니다.");
      }

      const stats = await this.getTodoStats(userId);

      let exportText = `📋 **할일 목록 내보내기**\n\n`;
      exportText += `📊 **통계:**\n`;
      exportText += `• 총 할일: ${stats.total}개\n`;
      exportText += `• 완료: ${stats.completed}개\n`;
      exportText += `• 진행중: ${stats.pending}개\n\n`;

      exportText += `📝 **할일 목록:**\n`;
      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const date = TimeHelper.formatDate(todo.createdAt);
        exportText += `${status} ${index + 1}. ${todo.task} (${date})\n`;
      });

      exportText += `\n📅 내보내기 날짜: ${TimeHelper.getKoreaTimeString()}`;

      // ✅ 표준 성공 응답
      return ResponseHelper.successWithData(
        {
          exportText: exportText,
          todos: todos,
          stats: stats,
        },
        {
          exportDate: TimeHelper.getKoreaTimeString(),
          totalExported: todos.length,
          message: `${todos.length}개의 할일을 내보냈습니다.`,
        }
      );
    } catch (error) {
      logger.error("할일 내보내기 실패:", error);
      return ResponseHelper.serverError("내보내기 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✅ 사용할 일 사용 처리 (TodoModule 호환)
   */
  async useLeave(userId, days) {
    // 이 메서드는 LeaveService용이므로 TodoService에서는 에러 반환
    return {
      success: false,
      message: "할일 서비스에서는 지원하지 않는 기능입니다.",
    };
  }

  /**
   * ✅ 할일 사용 내역 (호환성을 위한 더미 메서드)
   */
  async getLeaveHistory(userId) {
    return [];
  }

  /**
   * 메모리 데이터를 DB로 동기화 (오버라이드)
   */
  async syncToDatabase() {
    if (!this.dbEnabled || !this.collection) return;

    logger.debug("🔄 TodoService 동기화 시작...");

    try {
      const operations = [];

      // 모든 사용자의 할일을 DB에 동기화
      for (const [userId, todos] of this.userTodos.entries()) {
        for (const todo of todos) {
          operations.push({
            replaceOne: {
              filter: { _id: todo.id },
              replacement: {
                _id: todo.id,
                userId,
                ...todo,
                syncedAt: new Date(),
              },
              upsert: true,
            },
          });
        }
      }

      if (operations.length > 0) {
        await this.collection.bulkWrite(operations);
        logger.debug(`✅ ${operations.length}개 할일 동기화 완료`);
      }
    } catch (error) {
      logger.error("TodoService 동기화 실패:", error);
    }
  }
}

module.exports = TodoService;
