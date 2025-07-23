// src/services/TodoService.js - 순수 데이터 서비스

const BaseService = require("./BaseService");
// const logger = require("../utils/Logger");
// const TimeHelper = require("../utils/TimeHelper");
// const ResponseHelper = require("../utils/ResponseHelper");

class TodoService extends BaseService {
  constructor() {
    super("todo_userStates");
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;
    this.userTodos = new Map(); // 메모리 캐시
  }

  // ========== 🚀 초기화 ==========
  async cleanupDuplicateData() {
    if (!this.dbEnabled || !this.collection) return;

    try {
      logger.info("🧹 중복 데이터 정리 시작...");

      // moduleName이 null인 레코드 삭제
      const result = await this.collection.deleteMany({
        moduleName: null,
      });

      logger.info(`🧹 ${result.deletedCount}개의 중복 데이터 정리 완료`);

      // 인덱스 재구성 (선택사항)
      await this.collection.reIndex();
      logger.info("🔧 인덱스 재구성 완료");
    } catch (error) {
      logger.error("❌ 데이터 정리 실패:", error);
    }
  }

  async initialize() {
    // 의존성 가져오기
    this.logger = this.getDependency("logger");
    this.timeHelper = this.getDependency("timeHelper");
    this.db = this.getDependency("dbManager");

    // DB 연결 확인
    if (this.db && this.db.isConnected()) {
      await this.loadFromDatabase();
    }

    this.logger.info("✅ TodoService 초기화 완료");
  }

  /**
   * 초기화 시 DB에서 데이터 로드 (🛡️ 자동 복구 포함)
   */
  async onInitialize() {
    logger.info("📋 TodoService 데이터 로드 중...");

    if (this.dbEnabled) {
      // 1단계: 기본 로드 시도
      await this.cleanupDuplicateData();
      await this.loadFromDatabase();

      // 2단계: 개발 환경에서만 자동 정리
      if (process.env.NODE_ENV === "development") {
        logger.info("🛠️ 개발 환경: 데이터 정리 및 마이그레이션 실행");

        const cleanupResult = await this.cleanupCorruptedData();
        if (cleanupResult.cleaned > 0) {
          logger.info(
            `🧹 ${cleanupResult.cleaned}개의 손상된 데이터를 자동 정리했습니다.`
          );
          // 정리 후 다시 로드
          this.userTodos.clear();
          await this.loadFromDatabase();
        }

        const migrationResult = await this.migrateDataStructure();
        if (migrationResult.migrated > 0) {
          logger.info(
            `🔄 ${migrationResult.migrated}개의 데이터를 마이그레이션했습니다.`
          );
        }
      }

      // 3단계: 최종 통계
      const totalUsers = this.userTodos.size;
      const totalTodos = Array.from(this.userTodos.values()).reduce(
        (sum, todos) => sum + todos.length,
        0
      );
      logger.success(
        `✅ TodoService 로드 완료: 사용자 ${totalUsers}명, 할일 ${totalTodos}개`
      );
    } else {
      await this.loadFromBackup();
    }
  }

  /**
   * DB에서 모든 할일 로드 (🛡️ 데이터 검증 강화)
   */
  async loadFromDatabase() {
    try {
      const todos = await this.collection.find({}).toArray();
      let validCount = 0;
      let invalidCount = 0;

      todos.forEach((todo) => {
        try {
          // 🛡️ 필수 데이터 검증
          if (!todo || !todo.userId || !todo.task) {
            logger.warn("⚠️ 유효하지 않은 할일 데이터 발견:", {
              todoId: todo?._id?.toString() || "unknown",
              hasUserId: !!todo?.userId,
              hasTask: !!todo?.task,
            });
            invalidCount++;
            return; // 이 할일은 건너뛰기
          }

          // 🔄 안전한 userId 변환
          let userId;
          if (typeof todo.userId === "string") {
            userId = todo.userId;
          } else if (typeof todo.userId === "number") {
            userId = todo.userId.toString();
          } else if (
            todo.userId &&
            typeof todo.userId === "object" &&
            todo.userId.toString
          ) {
            userId = todo.userId.toString();
          } else {
            logger.warn("⚠️ userId 변환 불가:", {
              todoId: todo._id?.toString(),
              userId: todo.userId,
              userIdType: typeof todo.userId,
            });
            invalidCount++;
            return;
          }

          // 사용자별 그룹 생성
          if (!this.userTodos.has(userId)) {
            this.userTodos.set(userId, []);
          }

          // 🏗️ 안전한 할일 객체 생성
          const safeTodo = {
            id: todo._id?.toString() || `temp_${Date.now()}_${Math.random()}`,
            task: todo.task || "제목 없음",
            completed: Boolean(todo.completed),
            createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
            updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : null,
            priority: todo.priority || "normal",
          };

          this.userTodos.get(userId).push(safeTodo);
          validCount++;
        } catch (itemError) {
          logger.error("개별 할일 처리 실패:", {
            error: itemError.message,
            todoId: todo?._id?.toString() || "unknown",
          });
          invalidCount++;
        }
      });

      // 📊 로드 결과 리포트
      logger.info(
        `✅ 할일 로드 완료: 성공 ${validCount}개, 실패 ${invalidCount}개`
      );

      if (invalidCount > 0) {
        logger.warn(
          `⚠️ ${invalidCount}개의 유효하지 않은 데이터가 건너뛰어졌습니다.`
        );
      }
    } catch (error) {
      logger.error("할일 로드 실패:", error);
      // 🔧 DB 로드 실패시 백업으로 폴백
      logger.info("🔄 백업 데이터로 폴백 시도...");
      await this.loadFromBackup();
    }
  }

  /**
   * Railway 환경변수에서 백업 로드 (🛡️ 안전한 파싱)
   */
  async loadFromBackup() {
    try {
      const backup = process.env.TODO_BACKUP_DATA;
      if (!backup) {
        logger.info("환경변수에 백업 데이터가 없습니다.");
        return;
      }

      let data;
      try {
        data = JSON.parse(backup);
      } catch (parseError) {
        logger.error("백업 데이터 JSON 파싱 실패:", parseError.message);
        return;
      }

      if (!data || typeof data !== "object") {
        logger.warn("백업 데이터 형식이 잘못되었습니다.");
        return;
      }

      let restoredUsers = 0;
      let restoredTodos = 0;

      Object.entries(data).forEach(([userId, userData]) => {
        try {
          if (userData && Array.isArray(userData.todos)) {
            // 🛡️ 각 할일 데이터 검증
            const validTodos = userData.todos.filter((todo) => {
              return (
                todo &&
                typeof todo === "object" &&
                todo.task &&
                typeof todo.task === "string"
              );
            });

            if (validTodos.length > 0) {
              this.userTodos.set(userId, validTodos);
              restoredUsers++;
              restoredTodos += validTodos.length;
            }
          }
        } catch (userError) {
          logger.warn(`사용자 ${userId} 백업 복원 실패:`, userError.message);
        }
      });

      logger.success(
        `✅ 백업에서 복원: 사용자 ${restoredUsers}명, 할일 ${restoredTodos}개`
      );
    } catch (error) {
      logger.error("백업 로드 실패:", error);
    }
  }

  // ========== 📊 순수 데이터 메서드들 ==========

  /**
   * 👤 사용자 할일 목록 조회 (🛡️ 안전한 데이터 접근)
   */
  async getUserTodos(userId) {
    try {
      // 🔒 userId 검증 및 정규화
      if (!userId) {
        logger.warn("getUserTodos: userId가 없습니다.");
        return [];
      }

      userId = userId.toString();

      // 메모리 캐시 확인
      if (this.userTodos.has(userId)) {
        return this.userTodos.get(userId);
      }

      // DB에서 조회 (캐시 미스)
      if (this.dbEnabled && this.collection) {
        try {
          const todos = await this.collection
            .find({
              userId: userId,
              task: { $exists: true, $ne: null, $ne: "" }, // 유효한 할일만
            })
            .toArray();

          const formattedTodos = todos.map((todo) => ({
            id: todo._id?.toString() || `temp_${Date.now()}_${Math.random()}`,
            task: todo.task || "제목 없음",
            completed: Boolean(todo.completed),
            createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
            updatedAt: todo.updatedAt ? new Date(todo.updatedAt) : null,
            priority: todo.priority || "normal",
          }));

          // 캐시 업데이트
          this.userTodos.set(userId, formattedTodos);

          logger.debug(
            `👤 사용자 ${userId} 할일 ${formattedTodos.length}개 로드됨`
          );
          return formattedTodos;
        } catch (dbError) {
          logger.error(`사용자 ${userId} 할일 DB 조회 실패:`, dbError);
        }
      }

      // 빈 배열로 초기화
      const emptyTodos = [];
      this.userTodos.set(userId, emptyTodos);
      return emptyTodos;
    } catch (error) {
      logger.error("getUserTodos 실패:", error);
      return [];
    }
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
    try {
      const todos = await this.getUserTodos(userId);

      // 🎯 직접 통계 객체 반환 (래핑하지 않음)
      const stats = {
        total: todos.length,
        completed: todos.filter((t) => t.completed).length,
        incomplete: todos.filter((t) => !t.completed).length,
        pending: todos.filter((t) => !t.completed).length, // ← 중요: pending은 incomplete와 동일
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

      logger.debug(`📊 사용자 ${userId} 통계:`, stats);
      return stats; // ← ResponseHelper 없이 직접 반환
    } catch (error) {
      logger.error("할일 통계 조회 실패:", error);
      // 에러 시에도 기본 구조 반환
      return {
        total: 0,
        completed: 0,
        incomplete: 0,
        pending: 0,
        highPriority: 0,
        normalPriority: 0,
        lowPriority: 0,
        completionRate: 0,
      };
    }
  }
  /**
   * 📊 할일 통계 조회 (🌐 API용 래핑된 버전)
   */
  async getTodoStatsForAPI(userId) {
    try {
      const stats = await this.getTodoStats(userId);

      // ✅ 표준 성공 응답 (API나 외부 호출용)
      return ResponseHelper.successWithData(stats, {
        message: "통계를 성공적으로 조회했습니다.",
      });
    } catch (error) {
      logger.error("할일 통계 조회 실패:", error);
      return ResponseHelper.serverError("통계 조회 중 오류가 발생했습니다.");
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

  // ========== 🔧 데이터 정리 및 복구 ==========

  /**
   * 🧹 손상된 데이터 정리 (개발/관리용)
   */
  async cleanupCorruptedData() {
    if (!this.dbEnabled || !this.collection) {
      logger.warn("DB가 비활성화되어 데이터 정리를 건너뜁니다.");
      return { cleaned: 0, message: "DB 비활성화" };
    }

    try {
      logger.info("🧹 손상된 할일 데이터 정리 시작...");

      // 🔍 손상된 데이터 조회
      const corruptedData = await this.collection
        .find({
          $or: [
            { userId: { $exists: false } },
            { userId: null },
            { userId: "" },
            { task: { $exists: false } },
            { task: null },
            { task: "" },
          ],
        })
        .toArray();

      if (corruptedData.length === 0) {
        logger.info("✅ 정리할 손상된 데이터가 없습니다.");
        return { cleaned: 0, message: "정리할 데이터 없음" };
      }

      // 🗑️ 손상된 데이터 삭제
      const deleteResult = await this.collection.deleteMany({
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: "" },
          { task: { $exists: false } },
          { task: null },
          { task: "" },
        ],
      });

      logger.success(
        `🧹 ${deleteResult.deletedCount}개의 손상된 데이터를 정리했습니다.`
      );

      return {
        cleaned: deleteResult.deletedCount,
        message: `${deleteResult.deletedCount}개 정리 완료`,
        corruptedData: corruptedData.map((d) => ({
          id: d._id?.toString(),
          userId: d.userId,
          task: d.task,
        })),
      };
    } catch (error) {
      logger.error("데이터 정리 실패:", error);
      return { cleaned: 0, message: "정리 실패", error: error.message };
    }
  }

  /**
   * 🔄 데이터 구조 마이그레이션 (버전 업그레이드용)
   */
  async migrateDataStructure() {
    if (!this.dbEnabled || !this.collection) {
      return { migrated: 0, message: "DB 비활성화" };
    }

    try {
      logger.info("🔄 데이터 구조 마이그레이션 시작...");

      // 마이그레이션 대상 조회 (예: priority 필드가 없는 데이터)
      const oldFormatData = await this.collection
        .find({
          priority: { $exists: false },
        })
        .toArray();

      if (oldFormatData.length === 0) {
        logger.info("✅ 마이그레이션할 데이터가 없습니다.");
        return { migrated: 0, message: "마이그레이션 불필요" };
      }

      // 일괄 업데이트 작업 준비
      const bulkOps = oldFormatData.map((todo) => ({
        updateOne: {
          filter: { _id: todo._id },
          update: {
            $set: {
              priority: todo.priority || "normal",
              updatedAt: todo.updatedAt || todo.createdAt || new Date(),
              // 기타 필요한 필드 추가
            },
          },
        },
      }));

      // 일괄 업데이트 실행
      if (bulkOps.length > 0) {
        const result = await this.collection.bulkWrite(bulkOps);
        logger.success(`🔄 ${result.modifiedCount}개 데이터 마이그레이션 완료`);

        return {
          migrated: result.modifiedCount,
          message: `${result.modifiedCount}개 마이그레이션 완료`,
        };
      }
    } catch (error) {
      logger.error("데이터 마이그레이션 실패:", error);
      return {
        migrated: 0,
        message: "마이그레이션 실패",
        error: error.message,
      };
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
