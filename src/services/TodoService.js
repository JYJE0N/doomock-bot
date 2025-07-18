// src/services/TodoService.js - MongoDB + 메모리 하이브리드 저장

const {
  ensureConnection,
  getCollection,
} = require("../database/DatabaseManager");
const Logger = require("../utils/Logger");

class TodoService {
  constructor() {
    // ⭐ 하이브리드 저장: 메모리 + 데이터베이스
    this.todos = new Map(); // 빠른 접근을 위한 메모리 캐시
    this.initialized = false;
    this.dbEnabled = false;

    // Railway 환경변수 설정
    this.config = {
      enableDatabase: process.env.ENABLE_DATABASE !== "false", // 기본값: true
      autoSave: process.env.TODO_AUTO_SAVE !== "false", // 기본값: true
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 30000, // 30초마다 동기화
      maxTodos: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
    };

    this.initialize();
  }

  async initialize() {
    try {
      Logger.info("📋 TodoService 초기화 시작...");

      // ⭐ 데이터베이스 연결 시도
      if (this.config.enableDatabase) {
        try {
          await this.connectDatabase();
          await this.loadFromDatabase();
          this.setupPeriodicSync();
          Logger.success(
            "✅ TodoService: 데이터베이스 연결 및 데이터 로드 완료"
          );
        } catch (error) {
          Logger.warn(
            "⚠️ 데이터베이스 연결 실패, 메모리 모드로 실행:",
            error.message
          );
          this.dbEnabled = false;
        }
      }

      // ⭐ Railway 환경변수에서 백업 데이터 로드 (데이터베이스 없을 때)
      if (!this.dbEnabled) {
        await this.loadFromBackup();
      }

      this.initialized = true;
      Logger.success("✅ TodoService 초기화 완료");
    } catch (error) {
      Logger.error("❌ TodoService 초기화 실패:", error);
      this.initialized = true; // 에러가 있어도 서비스는 동작하도록
    }
  }

  // ⭐ 데이터베이스 연결
  async connectDatabase() {
    await ensureConnection();
    this.collection = getCollection("todos");
    this.dbEnabled = true;
    Logger.info("📊 MongoDB todos 컬렉션 연결됨");
  }

  // ⭐ 데이터베이스에서 모든 할일 로드
  async loadFromDatabase() {
    if (!this.dbEnabled) return;

    try {
      const allTodos = await this.collection.find({}).toArray();

      // 사용자별로 그룹화
      const userGroups = {};
      allTodos.forEach((todo) => {
        const userId = todo.userId.toString();
        if (!userGroups[userId]) {
          userGroups[userId] = [];
        }
        userGroups[userId].push({
          id: todo._id.toString(),
          task: todo.task,
          completed: todo.completed,
          createdAt: new Date(todo.createdAt),
          updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : undefined,
        });
      });

      // 메모리에 로드
      for (const [userId, todos] of Object.entries(userGroups)) {
        this.todos.set(userId, todos);
      }

      const totalUsers = Object.keys(userGroups).length;
      const totalTodos = allTodos.length;
      Logger.success(
        `📥 데이터베이스에서 로드 완료: ${totalUsers}명, ${totalTodos}개 할일`
      );
    } catch (error) {
      Logger.error("데이터베이스 로드 실패:", error);
      throw error;
    }
  }

  // ⭐ Railway 환경변수에서 백업 로드
  async loadFromBackup() {
    try {
      const backupData = process.env.TODO_BACKUP_DATA;
      if (backupData) {
        const parsed = JSON.parse(backupData);

        for (const [userId, todos] of Object.entries(parsed)) {
          this.todos.set(
            userId,
            todos.map((todo) => ({
              ...todo,
              createdAt: new Date(todo.createdAt),
              updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : undefined,
            }))
          );
        }

        Logger.success(
          `📥 백업에서 복원 완료: ${Object.keys(parsed).length}명의 할일`
        );
      }
    } catch (error) {
      Logger.warn("백업 로드 실패 (무시):", error.message);
    }
  }

  // ⭐ 주기적 데이터베이스 동기화
  setupPeriodicSync() {
    if (!this.dbEnabled || !this.config.autoSave) return;

    setInterval(async () => {
      try {
        await this.syncToDatabase();
      } catch (error) {
        Logger.debug("주기적 동기화 실패 (무시):", error.message);
      }
    }, this.config.syncInterval);

    Logger.info(
      `⚙️ 주기적 동기화 설정: ${this.config.syncInterval / 1000}초마다`
    );
  }

  // ⭐ 데이터베이스 동기화
  async syncToDatabase() {
    if (!this.dbEnabled) return;

    try {
      const operations = [];

      for (const [userId, todos] of this.todos.entries()) {
        for (const todo of todos) {
          const dbTodo = {
            userId: userId,
            task: todo.task,
            completed: todo.completed,
            createdAt: todo.createdAt,
            updatedAt: new Date(),
          };

          if (todo.id && todo.id.length === 24) {
            // 기존 문서 업데이트
            operations.push({
              updateOne: {
                filter: { _id: require("mongodb").ObjectId(todo.id) },
                update: { $set: dbTodo },
                upsert: true,
              },
            });
          } else {
            // 새 문서 삽입
            operations.push({
              insertOne: {
                document: dbTodo,
              },
            });
          }
        }
      }

      if (operations.length > 0) {
        await this.collection.bulkWrite(operations);
        Logger.debug(
          `💾 데이터베이스 동기화 완료: ${operations.length}개 작업`
        );
      }
    } catch (error) {
      Logger.error("데이터베이스 동기화 실패:", error);
    }
  }

  // ⭐ 할일 목록 조회
  async getTodos(userId) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];
      Logger.info(`📋 할일 목록 조회: 사용자 ${userId}, ${userTodos.length}개`);
      return userTodos;
    } catch (error) {
      Logger.error("할일 목록 조회 오류:", error);
      return [];
    }
  }

  // ⭐ 할일 추가 (DB 저장 포함)
  async addTodo(userId, todoText) {
    try {
      if (!todoText || todoText.trim().length === 0) {
        return {
          success: false,
          error: "할일 내용을 입력해주세요.",
        };
      }

      if (todoText.length > 100) {
        return {
          success: false,
          error: "할일은 100자 이내로 입력해주세요.",
        };
      }

      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      // 최대 개수 체크
      if (userTodos.length >= this.config.maxTodos) {
        return {
          success: false,
          error: `최대 ${this.config.maxTodos}개까지만 등록할 수 있습니다.`,
        };
      }

      // 중복 체크
      const exists = userTodos.find((todo) => todo.task === todoText.trim());
      if (exists) {
        return {
          success: false,
          error: "이미 동일한 할일이 있습니다.",
        };
      }

      const newTodo = {
        task: todoText.trim(),
        completed: false,
        createdAt: new Date(),
        id: null, // DB 저장 후 ID 할당
      };

      // ⭐ 데이터베이스에 먼저 저장
      if (this.dbEnabled) {
        try {
          const result = await this.collection.insertOne({
            userId: userIdStr,
            task: newTodo.task,
            completed: newTodo.completed,
            createdAt: newTodo.createdAt,
          });
          newTodo.id = result.insertedId.toString();
          Logger.debug(`💾 DB 저장 성공: ${newTodo.task} (ID: ${newTodo.id})`);
        } catch (error) {
          Logger.warn("DB 저장 실패, 메모리만 사용:", error.message);
          newTodo.id = Date.now().toString(); // 임시 ID
        }
      } else {
        newTodo.id = Date.now().toString(); // 임시 ID
      }

      // 메모리에 추가
      userTodos.push(newTodo);
      this.todos.set(userIdStr, userTodos);

      Logger.success(`➕ 할일 추가: 사용자 ${userId}, "${todoText}"`);

      return {
        success: true,
        task: newTodo.task,
        totalCount: userTodos.length,
        saved: this.dbEnabled,
      };
    } catch (error) {
      Logger.error("할일 추가 오류:", error);
      return {
        success: false,
        error: "할일 추가 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 할일 완료 상태 토글 (DB 업데이트 포함)
  async toggleTodo(userId, todoIndex) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      if (todoIndex < 0 || todoIndex >= userTodos.length) {
        return {
          success: false,
          error: "유효하지 않은 할일 번호입니다.",
        };
      }

      const todo = userTodos[todoIndex];
      todo.completed = !todo.completed;
      todo.updatedAt = new Date();

      // ⭐ 데이터베이스 업데이트
      if (this.dbEnabled && todo.id && todo.id.length === 24) {
        try {
          await this.collection.updateOne(
            { _id: require("mongodb").ObjectId(todo.id) },
            {
              $set: {
                completed: todo.completed,
                updatedAt: todo.updatedAt,
              },
            }
          );
          Logger.debug(
            `💾 DB 업데이트: ${todo.task} -> ${
              todo.completed ? "완료" : "미완료"
            }`
          );
        } catch (error) {
          Logger.warn("DB 업데이트 실패 (무시):", error.message);
        }
      }

      this.todos.set(userIdStr, userTodos);

      Logger.success(
        `🔄 할일 토글: 사용자 ${userId}, "${todo.task}" -> ${
          todo.completed ? "완료" : "미완료"
        }`
      );

      return {
        success: true,
        task: todo.task,
        completed: todo.completed,
        index: todoIndex,
      };
    } catch (error) {
      Logger.error("할일 토글 오류:", error);
      return {
        success: false,
        error: "할일 상태 변경 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 할일 삭제 (DB에서도 삭제)
  async deleteTodo(userId, todoIndex) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      if (todoIndex < 0 || todoIndex >= userTodos.length) {
        return {
          success: false,
          error: "유효하지 않은 할일 번호입니다.",
        };
      }

      const deletedTodo = userTodos.splice(todoIndex, 1)[0];

      // ⭐ 데이터베이스에서 삭제
      if (this.dbEnabled && deletedTodo.id && deletedTodo.id.length === 24) {
        try {
          await this.collection.deleteOne({
            _id: require("mongodb").ObjectId(deletedTodo.id),
          });
          Logger.debug(`💾 DB 삭제: ${deletedTodo.task}`);
        } catch (error) {
          Logger.warn("DB 삭제 실패 (무시):", error.message);
        }
      }

      this.todos.set(userIdStr, userTodos);

      Logger.success(`🗑️ 할일 삭제: 사용자 ${userId}, "${deletedTodo.task}"`);

      return {
        success: true,
        task: deletedTodo.task,
        remainingCount: userTodos.length,
      };
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      return {
        success: false,
        error: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 모든 할일 삭제
  async clearAll(userId) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];
      const deletedCount = userTodos.length;

      // ⭐ 데이터베이스에서 삭제
      if (this.dbEnabled) {
        try {
          await this.collection.deleteMany({ userId: userIdStr });
          Logger.debug(`💾 DB 일괄 삭제: 사용자 ${userId}, ${deletedCount}개`);
        } catch (error) {
          Logger.warn("DB 일괄 삭제 실패 (무시):", error.message);
        }
      }

      this.todos.set(userIdStr, []);

      Logger.success(
        `🗑️ 모든 할일 삭제: 사용자 ${userId}, ${deletedCount}개 삭제`
      );

      return {
        success: true,
        count: deletedCount,
      };
    } catch (error) {
      Logger.error("모든 할일 삭제 오류:", error);
      return {
        success: false,
        error: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 완료된 할일 일괄 삭제
  async clearCompleted(userId) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      const completedTodos = userTodos.filter((todo) => todo.completed);
      const filteredTodos = userTodos.filter((todo) => !todo.completed);
      const deletedCount = completedTodos.length;

      // ⭐ 데이터베이스에서 완료된 할일들 삭제
      if (this.dbEnabled && deletedCount > 0) {
        try {
          const completedIds = completedTodos
            .filter((todo) => todo.id && todo.id.length === 24)
            .map((todo) => require("mongodb").ObjectId(todo.id));

          if (completedIds.length > 0) {
            await this.collection.deleteMany({
              _id: { $in: completedIds },
            });
            Logger.debug(`💾 DB 완료된 할일 삭제: ${completedIds.length}개`);
          }
        } catch (error) {
          Logger.warn("DB 완료된 할일 삭제 실패 (무시):", error.message);
        }
      }

      this.todos.set(userIdStr, filteredTodos);

      Logger.success(
        `🗑️ 완료된 할일 삭제: 사용자 ${userId}, ${deletedCount}개 삭제`
      );

      return {
        success: true,
        count: deletedCount,
        remainingCount: filteredTodos.length,
      };
    } catch (error) {
      Logger.error("완료된 할일 삭제 오류:", error);
      return {
        success: false,
        error: "완료된 할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // 할일 통계
  async getTodoStats(userId) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];

      const total = userTodos.length;
      const completed = userTodos.filter((todo) => todo.completed).length;
      const pending = total - completed;

      Logger.info(
        `📊 할일 통계: 사용자 ${userId}, 전체 ${total}, 완료 ${completed}, 진행중 ${pending}`
      );

      return {
        total,
        completed,
        pending,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      Logger.error("할일 통계 조회 오류:", error);
      return null;
    }
  }

  // 사용자 할일 검색
  async searchTodos(userId, keyword) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];
      const results = userTodos.filter((todo) =>
        todo.task.toLowerCase().includes(keyword.toLowerCase())
      );

      Logger.info(
        `🔍 할일 검색: 사용자 ${userId}, 키워드 "${keyword}", ${results.length}개 발견`
      );

      return {
        success: true,
        results,
        keyword,
        count: results.length,
      };
    } catch (error) {
      Logger.error("할일 검색 오류:", error);
      return {
        success: false,
        error: "할일 검색 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 데이터 백업 (Railway 환경변수용)
  async backupData() {
    try {
      const backup = {};
      for (const [userId, todos] of this.todos.entries()) {
        backup[userId] = todos;
      }

      const backupStr = JSON.stringify(backup);
      Logger.info(
        `💾 데이터 백업: ${Object.keys(backup).length}명, ${
          backupStr.length
        } bytes`
      );

      return backupStr;
    } catch (error) {
      Logger.error("데이터 백업 오류:", error);
      return null;
    }
  }

  // ⭐ 데이터 복원
  async restoreData(backupData) {
    try {
      const parsed = JSON.parse(backupData);
      this.todos.clear();

      for (const [userId, todos] of Object.entries(parsed)) {
        this.todos.set(
          userId,
          todos.map((todo) => ({
            ...todo,
            createdAt: new Date(todo.createdAt),
            updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : undefined,
          }))
        );
      }

      // 데이터베이스에도 동기화
      if (this.dbEnabled) {
        await this.syncToDatabase();
      }

      Logger.success(
        `📥 데이터 복원: ${Object.keys(parsed).length}명의 할일 데이터`
      );

      return {
        success: true,
        userCount: Object.keys(parsed).length,
      };
    } catch (error) {
      Logger.error("데이터 복원 오류:", error);
      return {
        success: false,
        error: "데이터 복원 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 서비스 상태 확인
  getServiceStatus() {
    const totalUsers = this.todos.size;
    let totalTodos = 0;
    let completedTodos = 0;

    for (const todos of this.todos.values()) {
      totalTodos += todos.length;
      completedTodos += todos.filter((todo) => todo.completed).length;
    }

    return {
      initialized: this.initialized,
      dbEnabled: this.dbEnabled,
      users: totalUsers,
      totalTodos,
      completedTodos,
      pendingTodos: totalTodos - completedTodos,
      config: this.config,
      memoryUsage: process.memoryUsage(),
    };
  }

  // ⭐ 서비스 종료 시 정리
  async shutdown() {
    try {
      // 마지막 동기화
      if (this.dbEnabled) {
        await this.syncToDatabase();
        Logger.info("💾 종료 전 최종 동기화 완료");
      }

      // 백업 데이터 생성 (환경변수용)
      const backup = await this.backupData();
      if (backup) {
        Logger.info("💾 종료 전 백업 완료");
      }
    } catch (error) {
      Logger.error("TodoService 종료 중 오류:", error);
    }
  }
}

module.exports = { TodoService };
