// src/services/TodoService.js - 완전 표준화 리팩토링
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 🔧 할일 데이터 서비스 - 완전 표준화
 * - 순수 데이터 처리만 담당
 * - UI/메시지는 TodoModule에서 처리
 * - MongoDB 네이티브 드라이버 사용 (Mongoose 완전 제거)
 * - Railway 환경 최적화
 * - 메모리 캐싱 시스템
 * - 완벽한 에러 처리
 */
class TodoService {
  constructor(options = {}) {
    this.collectionName = "todos";
    this.db = options.db || null;
    this.collection = null;

    // 설정 (Railway 환경변수 기반)
    this.config = {
      enableCache: process.env.TODO_CACHE_ENABLED !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      maxRetries: parseInt(process.env.TODO_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.TODO_RETRY_DELAY) || 1000,
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableBackup: process.env.TODO_ENABLE_BACKUP === "true",
      backupInterval: parseInt(process.env.TODO_BACKUP_INTERVAL) || 86400000, // 24시간
      ...options.config,
    };

    // 메모리 캐시
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 체크
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 통계
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastOperation: null,
    };

    logger.info("🔧 TodoService (v2.0) 생성됨");
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      if (this.db && this.collectionName) {
        this.collection = this.db.collection(this.collectionName);

        // 인덱스 생성
        await this.createOptimizedIndexes();

        // 데이터 유효성 검사
        await this.validateDataIntegrity();

        logger.info("✅ TodoService v2.0 초기화 완료");
      }

      // 백업 스케줄러 시작 (Railway 환경에서만)
      if (this.isRailway && this.config.enableBackup) {
        this.startBackupScheduler();
      }
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 최적화된 인덱스 생성
   */
  async createOptimizedIndexes() {
    if (!this.collection) return;

    try {
      // 기존 인덱스 확인
      const existingIndexes = await this.collection.listIndexes().toArray();
      const indexNames = existingIndexes.map((idx) => idx.name);

      logger.debug("📝 기존 인덱스:", indexNames);

      // 1. 사용자별 조회 최적화 (가장 중요!)
      if (!indexNames.includes("userId_1_createdAt_-1")) {
        await this.collection.createIndex(
          { userId: 1, createdAt: -1 },
          { name: "userId_1_createdAt_-1", background: true }
        );
        logger.debug("✅ userId + createdAt 인덱스 생성");
      }

      // 2. 완료 상태별 조회 최적화
      if (!indexNames.includes("userId_1_completed_1_priority_-1")) {
        await this.collection.createIndex(
          { userId: 1, completed: 1, priority: -1 },
          { name: "userId_1_completed_1_priority_-1", background: true }
        );
        logger.debug("✅ userId + completed + priority 복합 인덱스 생성");
      }

      // 3. 카테고리별 조회 최적화
      if (!indexNames.includes("userId_1_category_1")) {
        await this.collection.createIndex(
          { userId: 1, category: 1 },
          { name: "userId_1_category_1", background: true }
        );
        logger.debug("✅ userId + category 인덱스 생성");
      }

      // 4. 텍스트 검색 최적화
      if (!indexNames.includes("text_search")) {
        await this.collection.createIndex(
          { text: "text", description: "text" },
          {
            name: "text_search",
            background: true,
            default_language: "none", // 한국어 지원
          }
        );
        logger.debug("✅ 텍스트 검색 인덱스 생성");
      }

      // 5. 마감일 조회 최적화
      if (!indexNames.includes("userId_1_dueDate_1")) {
        await this.collection.createIndex(
          { userId: 1, dueDate: 1 },
          {
            name: "userId_1_dueDate_1",
            background: true,
            sparse: true, // null 값 제외
          }
        );
        logger.debug("✅ userId + dueDate 인덱스 생성");
      }

      // 6. 활성 상태 및 업데이트 시간 (정리용)
      if (!indexNames.includes("isActive_1_updatedAt_-1")) {
        await this.collection.createIndex(
          { isActive: 1, updatedAt: -1 },
          { name: "isActive_1_updatedAt_-1", background: true }
        );
        logger.debug("✅ isActive + updatedAt 인덱스 생성");
      }

      logger.info("🔍 TodoService 인덱스 최적화 완료");
    } catch (error) {
      logger.warn("⚠️ 인덱스 생성 실패:", error.message);
    }
  }

  /**
   * ✅ 데이터 무결성 검증
   */
  async validateDataIntegrity() {
    if (!this.collection) return;

    try {
      // 기본 무결성 검사
      const totalDocs = await this.collection.countDocuments();
      const activeDocs = await this.collection.countDocuments({
        isActive: true,
      });
      const invalidDocs = await this.collection.countDocuments({
        $or: [
          { userId: { $exists: false } },
          { text: { $exists: false } },
          { createdAt: { $exists: false } },
        ],
      });

      logger.info(`📊 데이터 무결성 검사 결과:`);
      logger.info(`   - 전체 문서: ${totalDocs}개`);
      logger.info(`   - 활성 문서: ${activeDocs}개`);
      logger.info(`   - 무효 문서: ${invalidDocs}개`);

      // 무효 문서가 있으면 수정
      if (invalidDocs > 0) {
        await this.fixInvalidDocuments();
      }
    } catch (error) {
      logger.warn("⚠️ 데이터 무결성 검증 실패:", error);
    }
  }

  /**
   * 🔧 무효 문서 수정
   */
  async fixInvalidDocuments() {
    try {
      // 누락된 필드 보완
      const updateResult = await this.collection.updateMany(
        {
          $or: [
            { isActive: { $exists: false } },
            { version: { $exists: false } },
            { environment: { $exists: false } },
          ],
        },
        {
          $set: {
            isActive: true,
            version: 1,
            environment: this.isRailway ? "railway" : "local",
            timezone: "Asia/Seoul",
            updatedAt: TimeHelper.now(),
          },
        }
      );

      if (updateResult.modifiedCount > 0) {
        logger.info(`✅ ${updateResult.modifiedCount}개 문서 수정 완료`);
      }
    } catch (error) {
      logger.error("❌ 무효 문서 수정 실패:", error);
    }
  }

  /**
   * 🔄 백업 스케줄러 시작
   */
  startBackupScheduler() {
    setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        logger.error("❌ 자동 백업 실패:", error);
      }
    }, this.config.backupInterval);

    logger.info("🔄 백업 스케줄러 시작됨");
  }

  /**
   * 💾 백업 수행
   */
  async performBackup() {
    try {
      const backupData = await this.collection
        .find({
          isActive: true,
          updatedAt: {
            $gte: new Date(Date.now() - this.config.backupInterval),
          },
        })
        .toArray();

      if (backupData.length > 0) {
        // Railway 환경에서는 로그로만 기록
        logger.info(`💾 백업 완료: ${backupData.length}개 할일`);
      }
    } catch (error) {
      logger.error("❌ 백업 수행 실패:", error);
    }
  }

  // ===== 📊 CRUD 기본 메서드들 =====

  /**
   * 할일 추가
   */
  async addTodo(userId, data, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      // 입력 데이터 검증
      const validation = this.validateTodoData(data);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors[0],
          code: "VALIDATION_ERROR",
        };
      }

      // 사용자별 할일 개수 확인
      const userTodoCount = await this.getUserTodoCount(userId);
      if (userTodoCount >= this.config.maxTodosPerUser) {
        return {
          success: false,
          message: `최대 ${this.config.maxTodosPerUser}개까지만 등록 가능합니다.`,
          code: "LIMIT_EXCEEDED",
        };
      }

      // 문서 생성
      const document = {
        userId: userId.toString(),
        text: data.text.trim(),
        description: data.description?.trim() || null,
        completed: false,
        completedAt: null,

        // 분류 정보
        category: data.category || "general",
        priority: data.priority || 3,
        tags: Array.isArray(data.tags) ? data.tags : [],

        // 일정 정보
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,

        // 시간 추적
        estimatedMinutes: data.estimatedMinutes || null,
        actualMinutes: null,

        // 표준 필드들
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: 1,
        isActive: true,
        environment: this.isRailway ? "railway" : "local",
        timezone: "Asia/Seoul",

        // 메타데이터
        source: data.source || "manual", // manual/quick/template/import
        createdBy: "user",
      };

      // 데이터베이스에 삽입
      const result = await this.collection.insertOne(document);

      // 캐시 무효화
      this.invalidateUserCache(userId);

      // 통계 업데이트
      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "addTodo";

      return {
        success: true,
        todo: { _id: result.insertedId, ...document },
        message: "할일이 성공적으로 추가되었습니다.",
        code: "SUCCESS",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 추가 오류:", error);

      return {
        success: false,
        message: "할일 추가 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 할일 목록 조회 (고급 버전)
   */
  async getTodosList(userId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "priority",
        sortOrder = -1, // 높은 우선순위부터
        filter = {},
        includeCompleted = true,
        searchTerm = null,
      } = options;

      // 캐시 확인
      const cacheKey = `list_${userId}_${page}_${limit}_${JSON.stringify(
        filter
      )}_${searchTerm || "all"}`;
      if (this.config.enableCache && this.isCacheValid(cacheKey)) {
        this.stats.cacheHits++;
        this.updateResponseTime(timer.end());
        return this.cache.get(cacheKey);
      }

      // 쿼리 구성
      const query = {
        userId: userId.toString(),
        isActive: true,
        ...filter,
      };

      // 완료 상태 필터
      if (!includeCompleted) {
        query.completed = false;
      }

      // 텍스트 검색
      if (searchTerm) {
        query.$text = { $search: searchTerm };
      }

      // 정렬 옵션
      const sortOptions = {};

      // 복합 정렬: 우선순위 → 생성일 → 완료상태
      if (sortBy === "priority") {
        sortOptions.priority = sortOrder;
        sortOptions.completed = 1; // 미완료가 먼저
        sortOptions.createdAt = -1; // 최신이 먼저
      } else {
        sortOptions[sortBy] = sortOrder;
      }

      // 텍스트 검색 시 관련도 점수 추가
      if (searchTerm) {
        sortOptions.score = { $meta: "textScore" };
      }

      // 총 개수 조회
      const totalCount = await this.collection.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      // 데이터 조회
      const todos = await this.collection
        .find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // 결과 구성
      const result = {
        success: true,
        data: {
          todos,
          totalCount,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          isEmpty: todos.length === 0,
          filter: filter,
          sortBy,
          sortOrder,
        },
        message: `${todos.length}개 할일을 조회했습니다.`,
        code: "SUCCESS",
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.setCache(cacheKey, result);
        this.stats.cacheMisses++;
      }

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "getTodosList";

      return result;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 목록 조회 오류:", error);

      return {
        success: false,
        message: "할일 목록 조회 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      // ObjectId 변환
      const objectId = new ObjectId(todoId);

      // 현재 상태 조회
      const currentTodo = await this.collection.findOne({
        _id: objectId,
        userId: userId.toString(),
        isActive: true,
      });

      if (!currentTodo) {
        return {
          success: false,
          message: "할일을 찾을 수 없습니다.",
          code: "NOT_FOUND",
        };
      }

      // 토글할 상태 결정
      const newCompleted = !currentTodo.completed;
      const now = TimeHelper.now();

      // 업데이트 데이터 구성
      const updateData = {
        completed: newCompleted,
        completedAt: newCompleted ? now : null,
        updatedAt: now,
      };

      // 완료 시 실제 소요 시간 계산
      if (
        newCompleted &&
        currentTodo.estimatedMinutes &&
        !currentTodo.actualMinutes
      ) {
        const timeDiff = now - currentTodo.createdAt;
        updateData.actualMinutes = Math.round(timeDiff / (1000 * 60));
      }

      // 데이터베이스 업데이트
      const result = await this.collection.updateOne(
        { _id: objectId, userId: userId.toString(), isActive: true },
        {
          $set: updateData,
          $inc: { version: 1 },
        }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: "할일을 찾을 수 없습니다.",
          code: "NOT_FOUND",
        };
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      // 업데이트된 할일 조회
      const updatedTodo = await this.collection.findOne({ _id: objectId });

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "toggleTodo";

      return {
        success: true,
        todo: updatedTodo,
        message: `할일이 ${newCompleted ? "완료" : "미완료"}로 변경되었습니다.`,
        code: "SUCCESS",
        action: newCompleted ? "completed" : "uncompleted",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 토글 오류:", error);

      return {
        success: false,
        message: "할일 상태 변경 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 할일 수정
   */
  async updateTodo(userId, todoId, updateData, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const objectId = new ObjectId(todoId);

      // 수정 데이터 검증
      const validation = this.validateTodoData(updateData, { isUpdate: true });
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors[0],
          code: "VALIDATION_ERROR",
        };
      }

      // 업데이트할 필드만 추출
      const allowedFields = [
        "text",
        "description",
        "category",
        "priority",
        "tags",
        "dueDate",
        "reminderAt",
        "estimatedMinutes",
      ];
      const filteredUpdate = {};

      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          filteredUpdate[field] = updateData[field];
        }
      }

      // 표준 업데이트 필드 추가
      filteredUpdate.updatedAt = TimeHelper.now();

      // 데이터베이스 업데이트
      const result = await this.collection.updateOne(
        {
          _id: objectId,
          userId: userId.toString(),
          isActive: true,
        },
        {
          $set: filteredUpdate,
          $inc: { version: 1 },
        }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: "수정할 할일을 찾을 수 없습니다.",
          code: "NOT_FOUND",
        };
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      // 업데이트된 할일 조회
      const updatedTodo = await this.collection.findOne({ _id: objectId });

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "updateTodo";

      return {
        success: true,
        todo: updatedTodo,
        message: "할일이 성공적으로 수정되었습니다.",
        code: "SUCCESS",
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 수정 오류:", error);

      return {
        success: false,
        message: "할일 수정 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const objectId = new ObjectId(todoId);
      const { hardDelete = false } = options;

      if (hardDelete) {
        // 하드 삭제 (완전 제거)
        const result = await this.collection.deleteOne({
          _id: objectId,
          userId: userId.toString(),
        });

        if (result.deletedCount === 0) {
          return {
            success: false,
            message: "삭제할 할일을 찾을 수 없습니다.",
            code: "NOT_FOUND",
          };
        }
      } else {
        // 소프트 삭제 (비활성화)
        const result = await this.collection.updateOne(
          {
            _id: objectId,
            userId: userId.toString(),
            isActive: true,
          },
          {
            $set: {
              isActive: false,
              deletedAt: TimeHelper.now(),
              updatedAt: TimeHelper.now(),
            },
            $inc: { version: 1 },
          }
        );

        if (result.matchedCount === 0) {
          return {
            success: false,
            message: "삭제할 할일을 찾을 수 없습니다.",
            code: "NOT_FOUND",
          };
        }
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "deleteTodo";

      return {
        success: true,
        message: "할일이 성공적으로 삭제되었습니다.",
        code: "SUCCESS",
        deleteType: hardDelete ? "hard" : "soft",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 삭제 오류:", error);

      return {
        success: false,
        message: "할일 삭제 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 할일 검색 (고급 버전)
   */
  async searchTodos(userId, searchTerm, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const { limit = 20, includeCompleted = true } = options;

      if (!searchTerm || searchTerm.trim().length < 2) {
        return {
          success: false,
          message: "검색어는 2글자 이상 입력해주세요.",
          code: "VALIDATION_ERROR",
        };
      }

      // 검색 쿼리 구성
      const query = {
        userId: userId.toString(),
        isActive: true,
      };

      if (!includeCompleted) {
        query.completed = false;
      }

      // 텍스트 검색과 정규식 검색 결합
      const searchResults = await Promise.all([
        // 1. 텍스트 인덱스 검색 (정확도 높음)
        this.collection
          .find({
            ...query,
            $text: { $search: searchTerm },
          })
          .sort({ score: { $meta: "textScore" }, priority: -1 })
          .limit(limit)
          .toArray(),

        // 2. 정규식 검색 (유연성 높음)
        this.collection
          .find({
            ...query,
            text: new RegExp(
              searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i"
            ),
          })
          .sort({ priority: -1, createdAt: -1 })
          .limit(limit)
          .toArray(),
      ]);

      // 결과 병합 및 중복 제거
      const allResults = [...searchResults[0], ...searchResults[1]];
      const uniqueResults = this.removeDuplicateTodos(allResults);

      // 관련도 점수 계산 및 정렬
      const scoredResults = uniqueResults
        .map((todo) => ({
          ...todo,
          searchScore: this.calculateSearchScore(todo.text, searchTerm),
        }))
        .sort((a, b) => {
          if (b.searchScore !== a.searchScore)
            return b.searchScore - a.searchScore;
          if (b.priority !== a.priority) return b.priority - a.priority;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

      // 최종 결과 제한
      const finalResults = scoredResults.slice(0, limit);

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "searchTodos";

      return {
        success: true,
        data: {
          todos: finalResults,
          searchTerm: searchTerm.trim(),
          resultCount: finalResults.length,
          totalFound: uniqueResults.length,
          searchMethods: ["textIndex", "regex"],
        },
        message: `검색 결과: ${finalResults.length}개 할일을 찾았습니다.`,
        code: "SUCCESS",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 검색 오류:", error);

      return {
        success: false,
        message: "할일 검색 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 사용자 통계 조회 (상세 버전)
   */
  async getUserStats(userId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `stats_${userId}`;
      if (this.config.enableCache && this.isCacheValid(cacheKey)) {
        this.stats.cacheHits++;
        this.updateResponseTime(timer.end());
        return this.cache.get(cacheKey);
      }

      // 기본 통계 집계
      const basicStats = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
            },
          },
          {
            $group: {
              _id: null,
              totalTodos: { $sum: 1 },
              completedTodos: {
                $sum: { $cond: ["$completed", 1, 0] },
              },
              pendingTodos: {
                $sum: { $cond: ["$completed", 0, 1] },
              },
              lastActivity: { $max: "$updatedAt" },
              firstTodo: { $min: "$createdAt" },

              // 우선순위별 통계
              highPriorityCount: {
                $sum: { $cond: [{ $gte: ["$priority", 4] }, 1, 0] },
              },

              // 오늘 추가된 할일
              todayAdded: {
                $sum: {
                  $cond: [
                    {
                      $gte: [
                        "$createdAt",
                        {
                          $dateFromString: {
                            dateString: TimeHelper.formatDate(
                              TimeHelper.now(),
                              "YYYY-MM-DD"
                            ),
                          },
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray();

      // 카테고리별 통계
      const categoryStats = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
            },
          },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              completed: { $sum: { $cond: ["$completed", 1, 0] } },
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .toArray();

      // 우선순위별 통계
      const priorityStats = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
            },
          },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
              completed: { $sum: { $cond: ["$completed", 1, 0] } },
            },
          },
          {
            $sort: { _id: -1 },
          },
        ])
        .toArray();

      // 주간/월간 완료 통계
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [weekCompleted, monthCompleted] = await Promise.all([
        this.collection.countDocuments({
          userId: userId.toString(),
          isActive: true,
          completed: true,
          completedAt: { $gte: weekAgo },
        }),
        this.collection.countDocuments({
          userId: userId.toString(),
          isActive: true,
          completed: true,
          completedAt: { $gte: monthAgo },
        }),
      ]);

      // 기본 통계 처리
      const stats = basicStats[0] || {
        totalTodos: 0,
        completedTodos: 0,
        pendingTodos: 0,
        lastActivity: null,
        firstTodo: null,
        highPriorityCount: 0,
        todayAdded: 0,
      };

      // 완료율 계산
      const completionRate =
        stats.totalTodos > 0
          ? Math.round((stats.completedTodos / stats.totalTodos) * 100)
          : 0;

      // 평균 완료 시간 계산
      const averageCompletionTime = await this.calculateAverageCompletionTime(
        userId
      );

      // 최종 결과 구성
      const result = {
        // 기본 통계
        totalTodos: stats.totalTodos,
        completedTodos: stats.completedTodos,
        pendingTodos: stats.pendingTodos,
        completionRate,

        // 시간 정보
        lastActivity: stats.lastActivity
          ? TimeHelper.formatDate(stats.lastActivity, "MM/DD HH:mm")
          : "없음",
        firstTodoDate: stats.firstTodo
          ? TimeHelper.formatDate(stats.firstTodo, "YYYY/MM/DD")
          : "없음",
        lastAdded: await this.getLastAddedInfo(userId),
        lastCompleted: await this.getLastCompletedInfo(userId),

        // 우선순위 정보
        highPriorityCount: stats.highPriorityCount,
        priorityBreakdown: this.formatPriorityBreakdown(priorityStats),

        // 카테고리 정보
        categoryBreakdown: this.formatCategoryBreakdown(categoryStats),

        // 기간별 통계
        todayAdded: stats.todayAdded,
        weekCompleted,
        monthCompleted,

        // 성과 지표
        averageCompletionTime,
        productivity: this.calculateProductivityScore(
          stats,
          weekCompleted,
          monthCompleted
        ),

        // 메타 정보
        dataQuality: await this.checkDataQuality(userId),
        cacheStatus: this.config.enableCache ? "enabled" : "disabled",
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.setCache(cacheKey, result);
        this.stats.cacheMisses++;
      }

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "getUserStats";

      return result;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("사용자 통계 조회 오류:", error);

      return {
        totalTodos: 0,
        completedTodos: 0,
        pendingTodos: 0,
        completionRate: 0,
        lastActivity: "오류",
        error: error.message,
      };
    }
  }

  /**
   * 상세 통계 조회
   */
  async getDetailedStats(userId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      // 기본 통계 가져오기
      const basicStats = await this.getUserStats(userId);

      // 추가 상세 분석
      const detailedAnalysis = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
            },
          },
          {
            $facet: {
              // 완료 시간 분석
              completionTimes: [
                { $match: { completed: true, completedAt: { $exists: true } } },
                {
                  $project: {
                    completionTime: {
                      $subtract: ["$completedAt", "$createdAt"],
                    },
                  },
                },
                {
                  $group: {
                    _id: null,
                    avgTime: { $avg: "$completionTime" },
                    minTime: { $min: "$completionTime" },
                    maxTime: { $max: "$completionTime" },
                  },
                },
              ],

              // 주간 활동 패턴
              weeklyPattern: [
                {
                  $project: {
                    dayOfWeek: { $dayOfWeek: "$createdAt" },
                    completed: 1,
                  },
                },
                {
                  $group: {
                    _id: "$dayOfWeek",
                    totalAdded: { $sum: 1 },
                    totalCompleted: { $sum: { $cond: ["$completed", 1, 0] } },
                  },
                },
                { $sort: { _id: 1 } },
              ],

              // 최근 트렌드 (30일)
              recentTrend: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                  },
                },
                {
                  $group: {
                    _id: {
                      year: { $year: "$createdAt" },
                      month: { $month: "$createdAt" },
                      day: { $dayOfMonth: "$createdAt" },
                    },
                    dailyAdded: { $sum: 1 },
                    dailyCompleted: { $sum: { $cond: ["$completed", 1, 0] } },
                  },
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
              ],
            },
          },
        ])
        .toArray();

      const analysis = detailedAnalysis[0];

      // 결과 구성
      const result = {
        ...basicStats,

        // 상세 분석
        completionAnalysis: this.formatCompletionAnalysis(
          analysis.completionTimes[0]
        ),
        weeklyPattern: this.formatWeeklyPattern(analysis.weeklyPattern),
        recentTrend: this.formatRecentTrend(analysis.recentTrend),

        // 성과 지표
        performanceScore: this.calculatePerformanceScore(basicStats, analysis),
        efficiency: this.calculateEfficiency(basicStats, analysis),
        consistency: this.calculateConsistency(analysis.recentTrend),

        // 추천 사항
        recommendations: this.generateRecommendations(basicStats, analysis),
      };

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "getDetailedStats";

      return {
        success: true,
        data: result,
        message: "상세 통계 조회가 완료되었습니다.",
        code: "SUCCESS",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("상세 통계 조회 오류:", error);

      return {
        success: false,
        message: "상세 통계 조회 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 완료된 할일 정리
   */
  async clearCompleted(userId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const { keepRecent = true, recentDays = 7 } = options;

      let query = {
        userId: userId.toString(),
        completed: true,
        isActive: true,
      };

      // 최근 완료된 것은 유지
      if (keepRecent) {
        const cutoffDate = new Date(
          Date.now() - recentDays * 24 * 60 * 60 * 1000
        );
        query.completedAt = { $lt: cutoffDate };
      }

      // 소프트 삭제 실행
      const result = await this.collection.updateMany(query, {
        $set: {
          isActive: false,
          deletedAt: TimeHelper.now(),
          updatedAt: TimeHelper.now(),
        },
        $inc: { version: 1 },
      });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      this.updateResponseTime(timer.end());
      this.stats.lastOperation = "clearCompleted";

      return {
        success: true,
        deletedCount: result.modifiedCount,
        message: `${result.modifiedCount}개의 완료된 할일이 정리되었습니다.`,
        code: "SUCCESS",
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("완료된 할일 정리 오류:", error);

      return {
        success: false,
        message: "완료된 할일 정리 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  /**
   * 모든 할일 삭제
   */
  async clearAllTodos(userId, options = {}) {
    const timer = this.createTimer();
    this.stats.operationsCount++;

    try {
      const { hardDelete = false } = options;

      if (hardDelete) {
        // 하드 삭제
        const result = await this.collection.deleteMany({
          userId: userId.toString(),
        });

        // 캐시 무효화
        this.invalidateUserCache(userId);

        return {
          success: true,
          deletedCount: result.deletedCount,
          message: `${result.deletedCount}개의 모든 할일이 완전히 삭제되었습니다.`,
          code: "SUCCESS",
        };
      } else {
        // 소프트 삭제
        const result = await this.collection.updateMany(
          {
            userId: userId.toString(),
            isActive: true,
          },
          {
            $set: {
              isActive: false,
              deletedAt: TimeHelper.now(),
              updatedAt: TimeHelper.now(),
            },
            $inc: { version: 1 },
          }
        );

        // 캐시 무효화
        this.invalidateUserCache(userId);

        this.stats.successCount++;
        this.updateResponseTime(timer.end());
        this.stats.lastOperation = "clearAllTodos";

        return {
          success: true,
          deletedCount: result.modifiedCount,
          message: `${result.modifiedCount}개의 모든 할일이 정리되었습니다.`,
          code: "SUCCESS",
        };
      }
    } catch (error) {
      this.stats.errorCount++;
      logger.error("모든 할일 삭제 오류:", error);

      return {
        success: false,
        message: "모든 할일 삭제 중 오류가 발생했습니다.",
        error: error.message,
        code: "DATABASE_ERROR",
      };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 할일 데이터 검증
   */
  validateTodoData(data, options = {}) {
    const { isUpdate = false } = options;
    const errors = [];

    // 필수 필드 검증 (추가 시에만)
    if (!isUpdate) {
      if (
        !data.text ||
        typeof data.text !== "string" ||
        data.text.trim().length === 0
      ) {
        errors.push("할일 내용을 입력해주세요.");
      }
    }

    // 텍스트 길이 검증
    if (data.text && data.text.length > 500) {
      errors.push("할일 내용은 500자 이내로 입력해주세요.");
    }

    // 설명 길이 검증
    if (data.description && data.description.length > 1000) {
      errors.push("설명은 1000자 이내로 입력해주세요.");
    }

    // 우선순위 검증
    if (data.priority !== undefined) {
      const priority = parseInt(data.priority);
      if (isNaN(priority) || priority < 1 || priority > 5) {
        errors.push("우선순위는 1~5 사이의 숫자여야 합니다.");
      }
    }

    // 마감일 검증
    if (data.dueDate) {
      const dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        errors.push("올바른 마감일 형식이 아닙니다.");
      } else if (dueDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        errors.push("마감일은 과거 날짜로 설정할 수 없습니다.");
      }
    }

    // 태그 검증
    if (data.tags && Array.isArray(data.tags)) {
      if (data.tags.length > 10) {
        errors.push("태그는 최대 10개까지 설정 가능합니다.");
      }

      for (const tag of data.tags) {
        if (typeof tag !== "string" || tag.length > 20) {
          errors.push("태그는 20자 이내의 문자열이어야 합니다.");
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 사용자별 할일 개수 조회
   */
  async getUserTodoCount(userId) {
    try {
      return await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });
    } catch (error) {
      logger.error("사용자 할일 개수 조회 오류:", error);
      return 0;
    }
  }

  /**
   * ID로 할일 조회
   */
  async getTodoById(userId, todoId) {
    try {
      const objectId = new ObjectId(todoId);
      return await this.collection.findOne({
        _id: objectId,
        userId: userId.toString(),
        isActive: true,
      });
    } catch (error) {
      logger.error("할일 ID 조회 오류:", error);
      return null;
    }
  }

  /**
   * 중복 할일 제거
   */
  removeDuplicateTodos(todos) {
    const seen = new Set();
    return todos.filter((todo) => {
      const id = todo._id.toString();
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  /**
   * 검색 점수 계산
   */
  calculateSearchScore(text, searchTerm) {
    if (!text || !searchTerm) return 0;

    const textLower = text.toLowerCase();
    const termLower = searchTerm.toLowerCase();

    // 완전 일치
    if (textLower === termLower) return 100;

    // 시작 일치
    if (textLower.startsWith(termLower)) return 80;

    // 포함 여부
    if (textLower.includes(termLower)) return 60;

    // 단어별 일치
    const textWords = textLower.split(/\s+/);
    const termWords = termLower.split(/\s+/);

    let wordMatches = 0;
    for (const termWord of termWords) {
      for (const textWord of textWords) {
        if (textWord.includes(termWord)) {
          wordMatches++;
          break;
        }
      }
    }

    return Math.round((wordMatches / termWords.length) * 40);
  }

  /**
   * 평균 완료 시간 계산
   */
  async calculateAverageCompletionTime(userId) {
    try {
      const result = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
              completed: true,
              completedAt: { $exists: true },
            },
          },
          {
            $project: {
              completionTime: {
                $subtract: ["$completedAt", "$createdAt"],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgTime: { $avg: "$completionTime" },
            },
          },
        ])
        .toArray();

      if (result.length > 0 && result[0].avgTime) {
        const avgMs = result[0].avgTime;
        const avgHours = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;
        return `${avgHours}시간`;
      }

      return "측정 중";
    } catch (error) {
      logger.error("평균 완료 시간 계산 오류:", error);
      return "측정 불가";
    }
  }

  // ===== 🧠 AI/분석 메서드들 =====

  /**
   * 생산성 점수 계산
   */
  calculateProductivityScore(basicStats, weekCompleted, monthCompleted) {
    if (basicStats.totalTodos === 0) return 0;

    const completionRate = basicStats.completionRate || 0;
    const weeklyRate =
      basicStats.totalTodos > 0
        ? (weekCompleted / basicStats.totalTodos) * 100
        : 0;
    const monthlyRate =
      basicStats.totalTodos > 0
        ? (monthCompleted / basicStats.totalTodos) * 100
        : 0;

    // 가중 평균으로 점수 계산
    const score = completionRate * 0.5 + weeklyRate * 0.3 + monthlyRate * 0.2;
    return Math.round(score);
  }

  /**
   * 성과 점수 계산
   */
  calculatePerformanceScore(basicStats, analysis) {
    let score = 0;

    // 완료율 (40점)
    score += (basicStats.completionRate || 0) * 0.4;

    // 일관성 (30점)
    if (analysis.recentTrend && analysis.recentTrend.length > 0) {
      const consistency = this.calculateConsistency(analysis.recentTrend);
      score += consistency * 0.3;
    }

    // 효율성 (30점)
    if (analysis.completionTimes && analysis.completionTimes.length > 0) {
      const efficiency = this.calculateEfficiency(basicStats, analysis);
      score += efficiency * 0.3;
    }

    return Math.round(score);
  }

  /**
   * 추천 사항 생성
   */
  generateRecommendations(basicStats, analysis) {
    const recommendations = [];

    // 완료율 기반 추천
    if (basicStats.completionRate < 50) {
      recommendations.push({
        type: "completion",
        icon: "🎯",
        message: "완료율이 낮습니다. 할일을 더 작은 단위로 나누어보세요.",
        priority: "high",
      });
    }

    // 미완료 할일 수 기반 추천
    if (basicStats.pendingTodos > 20) {
      recommendations.push({
        type: "cleanup",
        icon: "🧹",
        message: "미완료 할일이 많습니다. 정리를 통해 집중력을 높여보세요.",
        priority: "medium",
      });
    }

    // 우선순위 사용 패턴 분석
    if (basicStats.highPriorityCount === 0) {
      recommendations.push({
        type: "priority",
        icon: "⭐",
        message: "우선순위를 설정하여 중요한 일부터 처리해보세요.",
        priority: "low",
      });
    }

    // 활동 패턴 기반 추천
    if (analysis.weeklyPattern) {
      const mostActiveDay = this.findMostActiveDay(analysis.weeklyPattern);
      if (mostActiveDay) {
        recommendations.push({
          type: "timing",
          icon: "📅",
          message: `${mostActiveDay}에 가장 활발하게 활동하시네요! 이 시간을 활용해보세요.`,
          priority: "low",
        });
      }
    }

    return recommendations.slice(0, 3); // 최대 3개까지
  }

  // ===== 🗄️ 캐시 관리 =====

  /**
   * 캐시 유효성 확인
   */
  isCacheValid(key) {
    if (!this.cache.has(key) || !this.cacheTimestamps.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    return Date.now() - timestamp < this.config.cacheTimeout;
  }

  /**
   * 캐시 설정
   */
  setCache(key, value) {
    // 캐시 크기 제한
    if (this.cache.size >= 100) {
      // 가장 오래된 캐시 제거
      const oldestKey = Array.from(this.cacheTimestamps.entries()).sort(
        (a, b) => a[1] - b[1]
      )[0][0];
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 사용자 캐시 무효화
   */
  invalidateUserCache(userId) {
    const userPattern = `_${userId}_`;

    for (const key of this.cache.keys()) {
      if (key.includes(userPattern) || key.includes(`stats_${userId}`)) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  /**
   * 전체 캐시 정리
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.debug("🧹 TodoService 캐시 정리 완료");
  }

  // ===== 📊 성능 및 상태 관리 =====

  /**
   * 성능 타이머 생성
   */
  createTimer() {
    const start = process.hrtime.bigint();
    return {
      end: () => {
        const end = process.hrtime.bigint();
        return Number(end - start) / 1_000_000; // nanoseconds to milliseconds
      },
    };
  }

  /**
   * 응답 시간 통계 업데이트
   */
  updateResponseTime(responseTime) {
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    const cacheHitRate =
      this.stats.cacheHits + this.stats.cacheMisses > 0
        ? Math.round(
            (this.stats.cacheHits /
              (this.stats.cacheHits + this.stats.cacheMisses)) *
              100
          )
        : 0;

    return {
      serviceName: "TodoService",
      version: "2.0",
      collectionName: this.collectionName,
      isConnected: !!this.collection,

      // 성능 지표
      stats: {
        ...this.stats,
        averageResponseTime:
          Math.round(this.stats.averageResponseTime * 100) / 100,
        successRate:
          this.stats.operationsCount > 0
            ? Math.round(
                (this.stats.successCount / this.stats.operationsCount) * 100
              )
            : 100,
      },

      // 캐시 상태
      cache: {
        enabled: this.config.enableCache,
        size: this.cache.size,
        hitRate: cacheHitRate,
        timeout: this.config.cacheTimeout,
      },

      // 설정 정보
      config: {
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableBackup: this.config.enableBackup,
        isRailway: this.isRailway,
      },

      // 환경 정보
      environment: {
        isRailway: this.isRailway,
        nodeEnv: process.env.NODE_ENV,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
      },
    };
  }

  /**
   * 헬스체크
   */
  async healthCheck() {
    try {
      if (!this.collection) {
        return {
          healthy: false,
          message: "컬렉션이 연결되지 않음",
          timestamp: new Date().toISOString(),
        };
      }

      // 간단한 쿼리로 연결 테스트
      const startTime = Date.now();
      await this.collection.findOne({}, { limit: 1 });
      const responseTime = Date.now() - startTime;

      // 인덱스 상태 확인
      const indexes = await this.collection.listIndexes().toArray();

      return {
        healthy: true,
        message: "정상",
        responseTime: `${responseTime}ms`,
        stats: this.stats,
        cache: {
          size: this.cache.size,
          enabled: this.config.enableCache,
        },
        indexes: indexes.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message,
        error: error.name,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 데이터 마이그레이션
   */
  async migrateData() {
    try {
      if (!this.collection) return;

      // v1 → v2 마이그레이션
      const v1Count = await this.collection.countDocuments({
        version: { $exists: false },
      });

      if (v1Count > 0) {
        logger.info(`📝 ${v1Count}개 할일 데이터 마이그레이션 시작...`);

        const result = await this.collection.updateMany(
          { version: { $exists: false } },
          {
            $set: {
              version: 1,
              isActive: true,
              environment: this.isRailway ? "railway" : "local",
              timezone: "Asia/Seoul",
              category: "general",
              priority: 3,
              tags: [],
              updatedAt: TimeHelper.now(),
            },
          }
        );

        logger.info(`✅ ${result.modifiedCount}개 할일 마이그레이션 완료`);
      }

      // completedAt 필드 보완
      const missingCompletedAt = await this.collection.updateMany(
        {
          completed: true,
          completedAt: { $exists: false },
        },
        {
          $set: {
            completedAt: TimeHelper.now(),
          },
        }
      );

      if (missingCompletedAt.modifiedCount > 0) {
        logger.info(
          `✅ ${missingCompletedAt.modifiedCount}개 완료일 보완 완료`
        );
      }
    } catch (error) {
      logger.error("❌ 데이터 마이그레이션 오류:", error);
    }
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 TodoService 정리 시작...");

      // 캐시 정리
      this.clearCache();

      // 통계 초기화
      this.stats = {
        operationsCount: 0,
        successCount: 0,
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        lastOperation: null,
      };

      logger.info("✅ TodoService 정리 완료");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }

  // ===== 🔧 헬퍼 메서드들 =====

  formatCategoryBreakdown(categoryStats) {
    const breakdown = {};
    categoryStats.forEach((stat) => {
      breakdown[stat._id || "general"] = stat.count;
    });
    return breakdown;
  }

  formatPriorityBreakdown(priorityStats) {
    const breakdown = {};
    priorityStats.forEach((stat) => {
      breakdown[stat._id || 3] = stat.count;
    });
    return breakdown;
  }

  async getLastAddedInfo(userId) {
    try {
      const lastTodo = await this.collection.findOne(
        { userId: userId.toString(), isActive: true },
        { sort: { createdAt: -1 } }
      );

      return lastTodo
        ? TimeHelper.formatDate(lastTodo.createdAt, "MM/DD HH:mm")
        : "없음";
    } catch (error) {
      return "오류";
    }
  }

  async getLastCompletedInfo(userId) {
    try {
      const lastCompleted = await this.collection.findOne(
        {
          userId: userId.toString(),
          isActive: true,
          completed: true,
          completedAt: { $exists: true },
        },
        { sort: { completedAt: -1 } }
      );

      return lastCompleted
        ? TimeHelper.formatDate(lastCompleted.completedAt, "MM/DD HH:mm")
        : "없음";
    } catch (error) {
      return "오류";
    }
  }

  async checkDataQuality(userId) {
    try {
      const total = await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });

      const withCategory = await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
        category: { $exists: true, $ne: null },
      });

      const withPriority = await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
        priority: { $exists: true, $ne: null },
      });

      return {
        total,
        categoryRate: total > 0 ? Math.round((withCategory / total) * 100) : 0,
        priorityRate: total > 0 ? Math.round((withPriority / total) * 100) : 0,
      };
    } catch (error) {
      return { total: 0, categoryRate: 0, priorityRate: 0 };
    }
  }

  calculateConsistency(recentTrend) {
    if (!recentTrend || recentTrend.length < 7) return 0;

    // 일일 활동의 표준편차 계산으로 일관성 측정
    const dailyActivities = recentTrend.map((day) => day.dailyAdded || 0);
    const avg =
      dailyActivities.reduce((a, b) => a + b, 0) / dailyActivities.length;
    const variance =
      dailyActivities.reduce(
        (sum, activity) => sum + Math.pow(activity - avg, 2),
        0
      ) / dailyActivities.length;
    const stdDev = Math.sqrt(variance);

    // 표준편차가 낮을수록 일관성이 높음 (100점 만점)
    return Math.max(0, Math.min(100, 100 - stdDev * 10));
  }

  calculateEfficiency(basicStats, analysis) {
    // 완료율과 평균 완료 시간을 종합하여 효율성 계산
    const completionRate = basicStats.completionRate || 0;

    // 기본 점수는 완료율
    let efficiency = completionRate;

    // 완료 시간 분석이 있으면 추가 점수
    if (analysis.completionTimes && analysis.completionTimes.length > 0) {
      const avgTime = analysis.completionTimes[0].avgTime;
      if (avgTime) {
        // 평균 완료 시간이 24시간 이내면 보너스
        const avgHours = avgTime / (1000 * 60 * 60);
        if (avgHours <= 24) {
          efficiency += 10;
        }
      }
    }

    return Math.min(100, efficiency);
  }

  findMostActiveDay(weeklyPattern) {
    if (!weeklyPattern || weeklyPattern.length === 0) return null;

    const dayNames = [
      "",
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ];

    const mostActive = weeklyPattern.reduce((max, current) =>
      current.totalAdded > max.totalAdded ? current : max
    );

    return dayNames[mostActive._id] || null;
  }

  formatCompletionAnalysis(completionTime) {
    if (!completionTime) {
      return {
        averageTime: "측정 중",
        fastestTime: "측정 중",
        slowestTime: "측정 중",
      };
    }

    const formatTime = (ms) => {
      const hours = Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
      return `${hours}시간`;
    };

    return {
      averageTime: formatTime(completionTime.avgTime),
      fastestTime: formatTime(completionTime.minTime),
      slowestTime: formatTime(completionTime.maxTime),
    };
  }

  formatWeeklyPattern(weeklyPattern) {
    const dayNames = ["", "일", "월", "화", "수", "목", "금", "토"];

    return weeklyPattern.map((day) => ({
      day: dayNames[day._id] || "?",
      added: day.totalAdded || 0,
      completed: day.totalCompleted || 0,
      rate:
        day.totalAdded > 0
          ? Math.round((day.totalCompleted / day.totalAdded) * 100)
          : 0,
    }));
  }

  formatRecentTrend(recentTrend) {
    return recentTrend.map((day) => ({
      date: `${day._id.month}/${day._id.day}`,
      added: day.dailyAdded || 0,
      completed: day.dailyCompleted || 0,
      rate:
        day.dailyAdded > 0
          ? Math.round((day.dailyCompleted / day.dailyAdded) * 100)
          : 0,
    }));
  }
}

module.exports = TodoService;
