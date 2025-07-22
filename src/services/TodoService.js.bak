// src/services/TodoService.js
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
   * 사용자 할일 조회
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
   * 할일 추가
   */
  async addTodo(userId, task, priority = "normal") {
    userId = userId.toString();

    // 할일 수 제한 확인
    const todos = await this.getUserTodos(userId);
    if (todos.length >= this.maxTodosPerUser) {
      throw new Error(
        `최대 ${this.maxTodosPerUser}개까지만 추가할 수 있습니다.`
      );
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

    return newTodo;
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    userId = userId.toString();
    const todos = await this.getUserTodos(userId);

    const todo = todos.find((t) => t.id === todoId);
    if (!todo) {
      throw new Error("할일을 찾을 수 없습니다.");
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

    return todo;
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(userId, todoId) {
    userId = userId.toString();
    const todos = await this.getUserTodos(userId);

    const index = todos.findIndex((t) => t.id === todoId);
    if (index === -1) {
      throw new Error("할일을 찾을 수 없습니다.");
    }

    todos.splice(index, 1);

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

    return true;
  }

  /**
   * 완료된 할일 삭제
   */
  async clearCompleted(userId) {
    userId = userId.toString();
    const todos = await this.getUserTodos(userId);

    const completedIds = todos.filter((t) => t.completed).map((t) => t.id);

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

    return completedIds.length;
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
   * 할일 검색
   */
  async searchTodos(userId, keyword) {
    const todos = await this.getUserTodos(userId);
    const lowerKeyword = keyword.toLowerCase();

    return todos.filter((todo) =>
      todo.task.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 할일 내보내기
   */
  async exportTodos(userId) {
    const todos = await this.getUserTodos(userId);
    const stats = await this.getTodoStats(userId);

    return {
      exportDate: TimeHelper.getKoreaTimeString(),
      userId,
      stats,
      todos: todos.map((t) => ({
        task: t.task,
        completed: t.completed,
        priority: t.priority,
        createdAt: TimeHelper.formatDate(t.createdAt),
        updatedAt: t.updatedAt ? TimeHelper.formatDate(t.updatedAt) : null,
      })),
    };
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
