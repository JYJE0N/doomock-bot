// src/services/TodoService.js - 순수 데이터 서비스

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const ResponseHelper = require("../utils/ResponseHelper");

class TodoService extends BaseService {
  constructor() {
    super("todo_userStates");
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;
    this.userTodos = new Map(); // 메모리 캐시
  }

  // ========== 🚀 초기화 ==========

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
        });
        logger.info("✅ 백업에서 할일 복원됨");
      }
    } catch (error) {
      logger.error("백업 로드 실패:", error);
    }
  }

  // ========== 📊 순수 데이터 메서드들 ==========

  /**
   * 👤 사용자 할일 목록 조회 (원시 데이터)
   */
  async getUserTodos(userId) {
    userId = userId.toString();

    if (!this.userTodos.has(userId)) {
      this.userTodos.set(userId, []);
    }

    return this.userTodos.get(userId);
  }

  /**
   * ➕ 할일 추가 (데이터 처리만)
   */
  async addTodo(userId, task) {
    userId = userId.toString();

    try {
      // 입력 검증
      if (!task || task.trim().length === 0) {
        return ResponseHelper.validationError("할일 내용을 입력해주세요.");
      }

      if (task.length > 200) {
        return ResponseHelper.validationError(
          "할일 내용이 너무 깁니다. (최대 200자)"
        );
      }

      // 사용자 할일 목록 가져오기
      const userTodos = await this.getUserTodos(userId);

      // 개수 제한 확인
      if (userTodos.length >= this.maxTodosPerUser) {
        return ResponseHelper.validationError(
          `할일은 최대 ${this.maxTodosPerUser}개까지 등록할 수 있습니다.`
        );
      }

      // 중복 검사
      const existingTodo = userTodos.find(
        (todo) => todo.task.toLowerCase() === task.trim().toLowerCase()
      );

      if (existingTodo) {
        return ResponseHelper.validationError("이미 동일한 할일이 있습니다.");
      }

      // 새로운 할일 생성
      const newTodo = {
        id: TimeHelper.generateOperationId("todo", userId),
        task: task.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: "normal",
      };

      // 메모리에 추가
      userTodos.push(newTodo);

      // DB에 저장 (비동기)
      if (this.dbEnabled) {
        this.saveTodoToDatabase(userId, newTodo).catch((error) => {
          logger.error("할일 DB 저장 실패:", error);
        });
      }

      // 백업에 저장 (비동기)
      this.saveToBackup();

      return ResponseHelper.successWithData(
        { todo: newTodo },
        { message: "할일이 추가되었습니다!" }
      );
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      return ResponseHelper.serverError("할일 추가 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🔄 할일 완료/미완료 토글 (데이터 처리만)
   */
  async toggleTodo(userId, todoId) {
    userId = userId.toString();

    try {
      const userTodos = await this.getUserTodos(userId);
      const todoIndex = userTodos.findIndex((todo) => todo.id === todoId);

      if (todoIndex === -1) {
        return ResponseHelper.notFoundError("할일을 찾을 수 없습니다.");
      }

      const todo = userTodos[todoIndex];
      const wasCompleted = todo.completed;

      // 상태 토글
      todo.completed = !todo.completed;
      todo.updatedAt = new Date();

      // DB 업데이트 (비동기)
      if (this.dbEnabled) {
        this.updateTodoInDatabase(userId, todo).catch((error) => {
          logger.error("할일 DB 업데이트 실패:", error);
        });
      }

      // 백업 저장 (비동기)
      this.saveToBackup();

      const message = todo.completed
        ? "✅ 할일을 완료했습니다!"
        : "⏳ 할일을 미완료로 변경했습니다.";

      return ResponseHelper.successWithData(
        { todo: todo, previousState: wasCompleted },
        { message: message }
      );
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return ResponseHelper.serverError("상태 변경 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🗑️ 할일 삭제 (데이터 처리만)
   */
  async deleteTodo(userId, todoId) {
    userId = userId.toString();

    try {
      const userTodos = await this.getUserTodos(userId);
      const todoIndex = userTodos.findIndex((todo) => todo.id === todoId);

      if (todoIndex === -1) {
        return ResponseHelper.notFoundError("할일을 찾을 수 없습니다.");
      }

      const deletedTodo = userTodos[todoIndex];

      // 메모리에서 삭제
      userTodos.splice(todoIndex, 1);

      // DB에서 삭제 (비동기)
      if (this.dbEnabled) {
        this.deleteTodoFromDatabase(todoId).catch((error) => {
          logger.error("할일 DB 삭제 실패:", error);
        });
      }

      // 백업 저장 (비동기)
      this.saveToBackup();

      return ResponseHelper.successWithData(
        { deletedTodo: deletedTodo },
        { message: "할일이 삭제되었습니다." }
      );
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return ResponseHelper.serverError("삭제 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🔍 할일 검색 (데이터 처리만)
   */
  async searchTodos(userId, keyword) {
    userId = userId.toString();

    try {
      if (!keyword || keyword.trim().length === 0) {
        return ResponseHelper.validationError("검색어를 입력해주세요.");
      }

      const userTodos = await this.getUserTodos(userId);
      const searchTerm = keyword.trim().toLowerCase();

      const matchedTodos = userTodos.filter((todo) =>
        todo.task.toLowerCase().includes(searchTerm)
      );

      return ResponseHelper.successWithData(
        {
          todos: matchedTodos,
          keyword: keyword.trim(),
          totalFound: matchedTodos.length,
        },
        {
          message: `"${keyword.trim()}"로 ${
            matchedTodos.length
          }개의 할일을 찾았습니다.`,
        }
      );
    } catch (error) {
      logger.error("할일 검색 실패:", error);
      return ResponseHelper.serverError("검색 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📊 할일 통계 조회 (데이터 분석만)
   */
  async getTodoStats(userId) {
    userId = userId.toString();

    try {
      const userTodos = await this.getUserTodos(userId);

      const stats = {
        total: userTodos.length,
        completed: userTodos.filter((todo) => todo.completed).length,
        incomplete: userTodos.filter((todo) => !todo.completed).length,
        completionRate: 0,
        recentlyAdded: 0,
        oldestTodo: null,
        newestTodo: null,
      };

      // 완료율 계산
      stats.completionRate =
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

      // 최근 7일 내 추가된 할일
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      stats.recentlyAdded = userTodos.filter(
        (todo) => new Date(todo.createdAt) >= weekAgo
      ).length;

      // 가장 오래된/최신 할일
      if (userTodos.length > 0) {
        const sortedByDate = [...userTodos].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        stats.oldestTodo = sortedByDate[0];
        stats.newestTodo = sortedByDate[sortedByDate.length - 1];
      }

      return stats;
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        total: 0,
        completed: 0,
        incomplete: 0,
        completionRate: 0,
        recentlyAdded: 0,
        oldestTodo: null,
        newestTodo: null,
      };
    }
  }

  /**
   * 📤 할일 내보내기 (데이터 포맷팅만)
   */
  async exportTodos(userId) {
    userId = userId.toString();

    try {
      const userTodos = await this.getUserTodos(userId);
      const stats = await this.getTodoStats(userId);

      if (userTodos.length === 0) {
        return ResponseHelper.validationError("내보낼 할일이 없습니다.");
      }

      // 텍스트 형태로 포맷팅
      let exportText = `📝 할일 목록 내보내기\n\n`;
      exportText += `📊 통계:\n`;
      exportText += `• 전체: ${stats.total}개\n`;
      exportText += `• 완료: ${stats.completed}개\n`;
      exportText += `• 미완료: ${stats.incomplete}개\n`;
      exportText += `• 완료율: ${stats.completionRate}%\n\n`;

      exportText += `📋 할일 목록:\n`;

      userTodos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⏳";
        const date = TimeHelper.formatDate(todo.createdAt);
        exportText += `${index + 1}. ${status} ${todo.task} (${date})\n`;
      });

      exportText += `\n📅 내보내기 날짜: ${TimeHelper.getKoreaTimeString()}`;

      return ResponseHelper.successWithData(
        {
          exportText: exportText,
          todos: userTodos,
          stats: stats,
        },
        {
          exportDate: TimeHelper.getKoreaTimeString(),
          totalExported: userTodos.length,
          message: `${userTodos.length}개의 할일을 내보냈습니다.`,
        }
      );
    } catch (error) {
      logger.error("할일 내보내기 실패:", error);
      return ResponseHelper.serverError("내보내기 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🧹 완료된 할일 정리 (데이터 처리만)
   */
  async clearCompletedTodos(userId) {
    userId = userId.toString();

    try {
      const userTodos = await this.getUserTodos(userId);
      const completedTodos = userTodos.filter((todo) => todo.completed);

      if (completedTodos.length === 0) {
        return ResponseHelper.validationError("완료된 할일이 없습니다.");
      }

      // 미완료 할일만 남기기
      const incompleteTodos = userTodos.filter((todo) => !todo.completed);
      this.userTodos.set(userId, incompleteTodos);

      // DB에서 완료된 할일들 삭제 (비동기)
      if (this.dbEnabled) {
        const completedIds = completedTodos.map((todo) => todo.id);
        this.bulkDeleteTodosFromDatabase(completedIds).catch((error) => {
          logger.error("완료된 할일 DB 삭제 실패:", error);
        });
      }

      // 백업 저장 (비동기)
      this.saveToBackup();

      return ResponseHelper.successWithData(
        {
          clearedCount: completedTodos.length,
          remainingCount: incompleteTodos.length,
          clearedTodos: completedTodos,
        },
        {
          message: `완료된 할일 ${completedTodos.length}개를 정리했습니다.`,
        }
      );
    } catch (error) {
      logger.error("완료된 할일 정리 실패:", error);
      return ResponseHelper.serverError("정리 중 오류가 발생했습니다.");
    }
  }

  // ========== 💾 데이터베이스 작업들 ==========

  /**
   * DB에 할일 저장 (비동기)
   */
  async saveTodoToDatabase(userId, todo) {
    if (!this.dbEnabled || !this.collection) return;

    try {
      await this.collection.replaceOne(
        { _id: todo.id },
        {
          _id: todo.id,
          userId: userId,
          ...todo,
          syncedAt: new Date(),
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error("DB 저장 실패:", error);
    }
  }

  /**
   * DB에서 할일 업데이트 (비동기)
   */
  async updateTodoInDatabase(userId, todo) {
    if (!this.dbEnabled || !this.collection) return;

    try {
      await this.collection.updateOne(
        { _id: todo.id },
        {
          $set: {
            ...todo,
            userId: userId,
            syncedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error("DB 업데이트 실패:", error);
    }
  }

  /**
   * DB에서 할일 삭제 (비동기)
   */
  async deleteTodoFromDatabase(todoId) {
    if (!this.dbEnabled || !this.collection) return;

    try {
      await this.collection.deleteOne({ _id: todoId });
    } catch (error) {
      logger.error("DB 삭제 실패:", error);
    }
  }

  /**
   * DB에서 여러 할일 일괄 삭제 (비동기)
   */
  async bulkDeleteTodosFromDatabase(todoIds) {
    if (!this.dbEnabled || !this.collection) return;

    try {
      await this.collection.deleteMany({
        _id: { $in: todoIds },
      });
    } catch (error) {
      logger.error("DB 일괄 삭제 실패:", error);
    }
  }

  /**
   * 메모리 데이터를 DB로 전체 동기화
   */
  async syncToDatabase() {
    if (!this.dbEnabled || !this.collection) return;

    logger.debug("🔄 TodoService 동기화 시작...");

    try {
      const operations = [];

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

  // ========== 🔄 백업 관련 ==========

  /**
   * Railway 환경변수에 백업 저장 (비동기)
   */
  async saveToBackup() {
    // Railway 환경에서는 실시간 백업 저장이 어려우므로
    // 주기적 백업이나 종료 시점 백업으로 대체
    logger.debug("백업 저장 요청됨 (실제 저장은 주기적으로 수행)");
  }
}

module.exports = TodoService;
