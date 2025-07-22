// src/services/TodoService.js - 완전 리팩토링된 버전
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class TodoService extends BaseService {
  constructor() {
    super("todo_userStates"); // 컬렉션 이름만 전달

    // Todo 전용 설정
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;

    // 사용자별 할일 관리 (메모리)
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
   * 사용자 할일 조회 (원본 메서드)
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
   * ✅ TodoModule 호환용 별칭 메서드
   */
  async getTodos(userId) {
    return await this.getUserTodos(userId);
  }

  /**
   * ✅ 할일 추가 (성공/실패 응답 형태 통일)
   */
  async addTodo(userId, task, priority = "normal") {
    try {
      userId = userId.toString();

      // 할일 수 제한 확인
      const todos = await this.getUserTodos(userId);
      if (todos.length >= this.maxTodosPerUser) {
        return {
          success: false,
          error: `최대 ${this.maxTodosPerUser}개까지만 추가할 수 있습니다.`,
        };
      }

      const newTodo = {
        id: Date.now().toString(),
        task,
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

      // ✅ TodoModule이 기대하는 응답 형태
      return {
        success: true,
        todo: newTodo,
        stats: await this.getTodoStats(userId),
      };
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      return {
        success: false,
        error: "할일 추가 중 오류가 발생했습니다.",
      };
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
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

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

      // ✅ TodoModule이 기대하는 응답 형태
      return {
        success: true,
        todo: todo,
        completed: todo.completed,
      };
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return {
        success: false,
        error: "할일 상태 변경 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ✅ 할일 삭제 (응답 형태 통일)
   */
  async deleteTodo(userId, todoId) {
    try {
      userId = userId.toString();
      const todos = await this.getUserTodos(userId);

      const index = todos.findIndex((t) => t.id === todoId);
      if (index === -1) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
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

      return {
        success: true,
        todo: deletedTodo,
      };
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return {
        success: false,
        error: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ✅ 완료된 할일 삭제 (응답 형태 통일)
   */
  async clearCompleted(userId) {
    try {
      userId = userId.toString();
      const todos = await this.getUserTodos(userId);

      const completedIds = todos.filter((t) => t.completed).map((t) => t.id);
      const clearedCount = completedIds.length;

      if (clearedCount === 0) {
        return {
          success: true,
          cleared: 0,
          remaining: todos.length,
          message: "정리할 완료된 할일이 없습니다.",
        };
      }

      // 메모리에서 제거
      const remainingTodos = todos.filter((t) => !t.completed);
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

      return {
        success: true,
        cleared: clearedCount,
        remaining: remainingTodos.length,
      };
    } catch (error) {
      logger.error("완료된 할일 정리 실패:", error);
      return {
        success: false,
        error: "할일 정리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 통계 조회
   */
  async getTodoStats(userId) {
    const todos = await this.getUserTodos(userId);

    return {
      total: todos.length,
      completed: todos.filter((t) => t.completed).length,
      pending: todos.filter((t) => !t.completed).length,
      highPriority: todos.filter((t) => t.priority === "high").length,
      normalPriority: todos.filter((t) => t.priority === "normal").length,
      lowPriority: todos.filter((t) => t.priority === "low").length,
    };
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
   * ✅ 할일 내보내기 (응답 형태 통일)
   */
  async exportTodos(userId) {
    try {
      const todos = await this.getUserTodos(userId);
      const stats = await this.getTodoStats(userId);

      if (todos.length === 0) {
        return {
          success: false,
          error: "내보낼 할일이 없습니다.",
        };
      }

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

      return {
        success: true,
        data: exportText,
        stats: stats,
        exportDate: TimeHelper.getKoreaTimeString(),
      };
    } catch (error) {
      logger.error("할일 내보내기 실패:", error);
      return {
        success: false,
        error: "내보내기 중 오류가 발생했습니다.",
      };
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
