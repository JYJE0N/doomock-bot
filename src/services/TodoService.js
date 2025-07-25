// src/services/TodoService.js - v3.0.1 ValidationManager 연동 정리판
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 🔧 할일 데이터 서비스 v3.0.1 - ValidationManager 중앙화
 *
 * ✅ 변경 사항:
 * - 개별 검증 로직 완전 제거
 * - ValidationManager에 의존하여 검증 작업 위임
 * - 순수 데이터 처리에만 집중
 * - MongoDB 네이티브 드라이버 사용
 * - Railway 환경 최적화
 * - 메모리 캐싱 시스템 유지
 *
 * 🎯 핵심 개선:
 * - 검증과 데이터 처리의 완전한 분리
 * - 단일 책임 원칙 준수
 * - 성능 최적화 (검증 캐싱)
 * - 코드 중복 제거
 */
class TodoService {
  constructor(options = {}) {
    this.collectionName = "todos";
    this.db = options.db || null;
    this.collection = null;

    // ValidationManager 참조 (검증은 모두 위임)
    this.validationManager = options.validationManager || null;

    // 설정 (Railway 환경변수 기반)
    this.config = {
      enableCache: process.env.TODO_CACHE_ENABLED !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      maxRetries: parseInt(process.env.TODO_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.TODO_RETRY_DELAY) || 1000,
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableBackup: process.env.TODO_ENABLE_BACKUP === "true",
      backupInterval: parseInt(process.env.TODO_BACKUP_INTERVAL) || 86400000, // 24시간
      enableOptimizations: process.env.TODO_ENABLE_OPTIMIZATIONS !== "false",
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
      validationTime: 0,
      queryTime: 0,
    };

    logger.info("🔧 TodoService v3.0.1 생성됨 (ValidationManager 연동)");
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      if (this.db && this.collectionName) {
        this.collection = this.db.collection(this.collectionName);

        // 최적화된 인덱스 생성
        await this.createOptimizedIndexes();

        // 데이터 유효성 검사
        await this.validateDataIntegrity();

        logger.info("✅ TodoService v3.0.1 초기화 완료");
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

  // ===== 🎯 핵심 CRUD 메서드들 (검증 로직 제거) =====

  /**
   * ➕ 할일 추가 (검증 로직 제거, 순수 데이터 처리)
   */
  async addTodo(userId, todoData) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // ValidationManager에서 이미 검증된 데이터라고 가정
      // 검증은 TodoModule에서 처리됨

      // 사용자별 할일 개수 제한 확인
      const userTodoCount = await this.getUserTodoCount(userId);
      if (userTodoCount >= this.config.maxTodosPerUser) {
        return {
          success: false,
          error: `할일은 최대 ${this.config.maxTodosPerUser}개까지 등록할 수 있습니다.`,
        };
      }

      // 할일 문서 생성
      const todoDoc = {
        userId,
        text: todoData.text,
        category: todoData.category || "general",
        priority: todoData.priority || 3,
        description: todoData.description || "",
        tags: todoData.tags || [],
        completed: false,
        dueDate: todoData.dueDate || null,
        source: todoData.source || "manual",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 데이터베이스에 삽입
      const result = await this.collection.insertOne(todoDoc);

      // 캐시 무효화
      this.invalidateUserCache(userId);

      // 통계 업데이트
      this.updateStats(true, Date.now() - startTime);

      logger.debug(`➕ 할일 추가됨: ${todoData.text} (사용자: ${userId})`);

      return {
        success: true,
        data: {
          _id: result.insertedId,
          ...todoDoc,
        },
      };
    } catch (error) {
      logger.error("❌ 할일 추가 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "할일 추가 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📋 할일 목록 조회 (캐시 최적화)
   */
  async getTodoList(userId, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      const {
        page = 1,
        pageSize = 10,
        filter = "all",
        category = null,
        priority = null,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      // 캐시 키 생성
      const cacheKey = `list:${userId}:${JSON.stringify(options)}`;

      // 캐시 확인
      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return { success: true, data: cached };
        }
        this.stats.cacheMisses++;
      }

      // 쿼리 구성
      const query = { userId };

      // 필터 적용
      if (filter === "completed") {
        query.completed = true;
      } else if (filter === "pending") {
        query.completed = false;
      }

      if (category) {
        query.category = category;
      }

      if (priority) {
        query.priority = priority;
      }

      // 정렬 옵션
      const sort = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      // 페이지네이션
      const skip = (page - 1) * pageSize;

      // 데이터 조회 (병렬 처리)
      const [todos, total] = await Promise.all([
        this.collection
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .toArray(),
        this.collection.countDocuments(query),
      ]);

      const result = {
        todos,
        pagination: {
          currentPage: page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1,
        },
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.setToCache(cacheKey, result);
      }

      this.updateStats(true, Date.now() - startTime);

      return { success: true, data: result };
    } catch (error) {
      logger.error("❌ 할일 목록 조회 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "목록을 불러오는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ⚡ 할일 상태 토글 (완료/미완료)
   */
  async toggleTodo(userId, todoId) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // ObjectId 검증
      if (!ObjectId.isValid(todoId)) {
        return {
          success: false,
          error: "올바르지 않은 할일 ID입니다.",
        };
      }

      // 현재 상태 조회
      const currentTodo = await this.collection.findOne({
        _id: new ObjectId(todoId),
        userId,
      });

      if (!currentTodo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

      // 상태 토글
      const newCompleted = !currentTodo.completed;
      const updateData = {
        completed: newCompleted,
        updatedAt: new Date(),
      };

      // 완료 시간 기록
      if (newCompleted) {
        updateData.completedAt = new Date();
      } else {
        updateData.$unset = { completedAt: "" };
      }

      const result = await this.collection.updateOne(
        { _id: new ObjectId(todoId), userId },
        newCompleted
          ? { $set: updateData }
          : { $set: updateData, $unset: updateData.$unset }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.updateStats(true, Date.now() - startTime);

      logger.debug(
        `⚡ 할일 토글됨: ${todoId} -> ${newCompleted ? "완료" : "미완료"}`
      );

      return {
        success: true,
        data: {
          _id: todoId,
          completed: newCompleted,
        },
      };
    } catch (error) {
      logger.error("❌ 할일 토글 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "상태 변경 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ✏️ 할일 수정
   */
  async updateTodo(userId, todoId, updateData) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // ObjectId 검증
      if (!ObjectId.isValid(todoId)) {
        return {
          success: false,
          error: "올바르지 않은 할일 ID입니다.",
        };
      }

      // ValidationManager에서 이미 검증된 데이터라고 가정

      // 수정할 데이터 구성
      const setData = {
        ...updateData,
        updatedAt: new Date(),
      };

      const result = await this.collection.updateOne(
        { _id: new ObjectId(todoId), userId },
        { $set: setData }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.updateStats(true, Date.now() - startTime);

      logger.debug(`✏️ 할일 수정됨: ${todoId}`);

      return {
        success: true,
        data: {
          _id: todoId,
          ...setData,
        },
      };
    } catch (error) {
      logger.error("❌ 할일 수정 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "수정 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(userId, todoId) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // ObjectId 검증
      if (!ObjectId.isValid(todoId)) {
        return {
          success: false,
          error: "올바르지 않은 할일 ID입니다.",
        };
      }

      const result = await this.collection.deleteOne({
        _id: new ObjectId(todoId),
        userId,
      });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.updateStats(true, Date.now() - startTime);

      logger.debug(`🗑️ 할일 삭제됨: ${todoId}`);

      return {
        success: true,
        data: { deletedId: todoId },
      };
    } catch (error) {
      logger.error("❌ 할일 삭제 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "삭제 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🔍 할일 검색
   */
  async searchTodos(userId, searchQuery, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // ValidationManager에서 이미 검증된 검색어라고 가정

      const {
        limit = 50,
        includeCompleted = true,
        category = null,
        priority = null,
      } = options;

      // 검색 쿼리 구성
      const query = {
        userId,
        $text: { $search: searchQuery },
      };

      if (!includeCompleted) {
        query.completed = false;
      }

      if (category) {
        query.category = category;
      }

      if (priority) {
        query.priority = priority;
      }

      // 검색 수행 (텍스트 스코어로 정렬)
      const todos = await this.collection
        .find(query, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .toArray();

      this.updateStats(true, Date.now() - startTime);

      logger.debug(`🔍 할일 검색됨: "${searchQuery}" (${todos.length}개 결과)`);

      return {
        success: true,
        data: {
          todos,
          total: todos.length,
          query: searchQuery,
        },
      };
    } catch (error) {
      logger.error("❌ 할일 검색 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "검색 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      // 캐시 확인
      const cacheKey = `stats:${userId}`;
      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return { success: true, data: cached };
        }
        this.stats.cacheMisses++;
      }

      // 집계 파이프라인 사용 (최적화)
      const pipeline = [
        { $match: { userId } },
        {
          $facet: {
            // 전체 통계
            overall: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  completed: { $sum: { $cond: ["$completed", 1, 0] } },
                  pending: { $sum: { $cond: ["$completed", 0, 1] } },
                },
              },
            ],
            // 카테고리별 통계
            byCategory: [
              { $group: { _id: "$category", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            // 우선순위별 통계
            byPriority: [
              { $group: { _id: "$priority", count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],
            // 오늘 추가된 할일
            todayAdded: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  },
                },
              },
              { $count: "count" },
            ],
            // 이번 주 완료된 할일
            weeklyCompleted: [
              {
                $match: {
                  completed: true,
                  completedAt: {
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ];

      const [result] = await this.collection.aggregate(pipeline).toArray();

      // 결과 정리
      const overall = result.overall[0] || {
        total: 0,
        completed: 0,
        pending: 0,
      };
      const byCategory = {};
      const byPriority = {};

      result.byCategory.forEach((item) => {
        byCategory[item._id] = item.count;
      });

      result.byPriority.forEach((item) => {
        byPriority[item._id] = item.count;
      });

      const todayAdded = result.todayAdded[0]?.count || 0;
      const weeklyCompleted = result.weeklyCompleted[0]?.count || 0;
      const weeklyCompletionRate =
        overall.total > 0
          ? Math.round((weeklyCompleted / overall.total) * 100)
          : 0;

      const stats = {
        ...overall,
        byCategory,
        byPriority,
        todayAdded,
        weeklyCompleted,
        weeklyCompletionRate,
      };

      // 캐시 저장 (짧은 시간)
      if (this.config.enableCache) {
        this.setToCache(cacheKey, stats, 60000); // 1분
      }

      this.updateStats(true, Date.now() - startTime);

      return { success: true, data: stats };
    } catch (error) {
      logger.error("❌ 사용자 통계 조회 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "통계를 불러오는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🔍 단일 할일 조회
   */
  async getTodoById(userId, todoId) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      if (!ObjectId.isValid(todoId)) {
        return {
          success: false,
          error: "올바르지 않은 할일 ID입니다.",
        };
      }

      const todo = await this.collection.findOne({
        _id: new ObjectId(todoId),
        userId,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다.",
        };
      }

      this.updateStats(true, Date.now() - startTime);

      return { success: true, data: todo };
    } catch (error) {
      logger.error("❌ 단일 할일 조회 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "할일을 불러오는 중 오류가 발생했습니다.",
      };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 👤 사용자 할일 개수 조회
   */
  async getUserTodoCount(userId) {
    try {
      return await this.collection.countDocuments({ userId });
    } catch (error) {
      logger.error("❌ 사용자 할일 개수 조회 실패:", error);
      return 0;
    }
  }

  /**
   * 🧹 완료된 할일 정리
   */
  async clearCompletedTodos(userId) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      const result = await this.collection.deleteMany({
        userId,
        completed: true,
      });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.updateStats(true, Date.now() - startTime);

      logger.debug(
        `🧹 완료된 할일 정리됨: ${result.deletedCount}개 (사용자: ${userId})`
      );

      return {
        success: true,
        data: { deletedCount: result.deletedCount },
      };
    } catch (error) {
      logger.error("❌ 완료된 할일 정리 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "정리 중 오류가 발생했습니다.",
      };
    }
  }

  // ===== 💾 캐시 관리 메서드들 =====

  /**
   * 💾 캐시에서 데이터 조회
   */
  getFromCache(key) {
    if (!this.config.enableCache) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.config.cacheTimeout) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * 💾 캐시에 데이터 저장
   */
  setToCache(key, data, customTimeout = null) {
    if (!this.config.enableCache) return;

    // 캐시 크기 제한
    if (this.cache.size >= 1000) {
      this.clearOldestCacheEntries();
    }

    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // 커스텀 타임아웃 처리
    if (customTimeout) {
      setTimeout(() => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }, customTimeout);
    }
  }

  /**
   * 💾 사용자별 캐시 무효화
   */
  invalidateUserCache(userId) {
    if (!this.config.enableCache) return;

    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.debug(
      `💾 사용자 캐시 무효화: ${userId} (${keysToDelete.length}개 키)`
    );
  }

  /**
   * 💾 오래된 캐시 엔트리 정리
   */
  clearOldestCacheEntries() {
    const entries = Array.from(this.cacheTimestamps.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, 200); // 가장 오래된 200개 제거

    entries.forEach(([key]) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  // ===== 🔧 데이터베이스 관리 메서드들 =====

  /**
   * 🔍 최적화된 인덱스 생성
   */
  async createOptimizedIndexes() {
    if (!this.collection) return;

    try {
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

      // 2. 사용자별 + 완료상태 조회 최적화
      if (!indexNames.includes("userId_1_completed_1_createdAt_-1")) {
        await this.collection.createIndex(
          { userId: 1, completed: 1, createdAt: -1 },
          { name: "userId_1_completed_1_createdAt_-1", background: true }
        );
        logger.debug("✅ userId + completed + createdAt 인덱스 생성");
      }

      // 3. 카테고리 필터링 최적화
      if (!indexNames.includes("userId_1_category_1_createdAt_-1")) {
        await this.collection.createIndex(
          { userId: 1, category: 1, createdAt: -1 },
          { name: "userId_1_category_1_createdAt_-1", background: true }
        );
        logger.debug("✅ userId + category + createdAt 인덱스 생성");
      }

      // 4. 텍스트 검색 최적화
      if (!indexNames.includes("text_search")) {
        await this.collection.createIndex(
          { text: "text", description: "text" },
          {
            name: "text_search",
            background: true,
            weights: { text: 10, description: 1 }, // text 필드에 더 높은 가중치
          }
        );
        logger.debug("✅ 텍스트 검색 인덱스 생성");
      }

      // 5. 우선순위 필터링 최적화
      if (!indexNames.includes("userId_1_priority_1")) {
        await this.collection.createIndex(
          { userId: 1, priority: 1 },
          { name: "userId_1_priority_1", background: true }
        );
        logger.debug("✅ userId + priority 인덱스 생성");
      }

      logger.info("✅ 모든 인덱스 생성/확인 완료");
    } catch (error) {
      logger.error("❌ 인덱스 생성 실패:", error);
    }
  }

  /**
   * 🔍 데이터 유효성 검사
   */
  async validateDataIntegrity() {
    if (!this.collection) return;

    try {
      // 1. 총 문서 수 확인
      const totalDocs = await this.collection.countDocuments();
      logger.debug(`📊 총 할일 문서 수: ${totalDocs}`);

      // 2. 필수 필드 누락 문서 확인
      const missingFields = await this.collection.countDocuments({
        $or: [
          { userId: { $exists: false } },
          { text: { $exists: false } },
          { createdAt: { $exists: false } },
        ],
      });

      if (missingFields > 0) {
        logger.warn(`⚠️ 필수 필드 누락 문서: ${missingFields}개`);
      }

      // 3. 고아 문서 확인 (사용자 ID가 없는 문서)
      const orphanDocs = await this.collection.countDocuments({
        $or: [{ userId: null }, { userId: "" }, { userId: { $type: "null" } }],
      });

      if (orphanDocs > 0) {
        logger.warn(`⚠️ 고아 문서: ${orphanDocs}개`);
      }

      logger.debug("✅ 데이터 유효성 검사 완료");
    } catch (error) {
      logger.error("❌ 데이터 유효성 검사 실패:", error);
    }
  }

  /**
   * 🚚 데이터 마이그레이션
   */
  async migrateData() {
    if (!this.collection) return;

    try {
      logger.debug("🚚 데이터 마이그레이션 확인 중...");

      // 1. updatedAt 필드 추가 (없는 문서들)
      const missingUpdatedAt = await this.collection.countDocuments({
        updatedAt: { $exists: false },
      });

      if (missingUpdatedAt > 0) {
        logger.info(`🚚 updatedAt 필드 추가: ${missingUpdatedAt}개 문서`);

        await this.collection.updateMany(
          { updatedAt: { $exists: false } },
          { $set: { updatedAt: new Date() } }
        );
      }

      // 2. category 기본값 설정
      const missingCategory = await this.collection.countDocuments({
        category: { $exists: false },
      });

      if (missingCategory > 0) {
        logger.info(`🚚 category 기본값 설정: ${missingCategory}개 문서`);

        await this.collection.updateMany(
          { category: { $exists: false } },
          { $set: { category: "general" } }
        );
      }

      // 3. priority 기본값 설정
      const missingPriority = await this.collection.countDocuments({
        priority: { $exists: false },
      });

      if (missingPriority > 0) {
        logger.info(`🚚 priority 기본값 설정: ${missingPriority}개 문서`);

        await this.collection.updateMany(
          { priority: { $exists: false } },
          { $set: { priority: 3 } }
        );
      }

      logger.debug("✅ 데이터 마이그레이션 완료");
    } catch (error) {
      logger.error("❌ 데이터 마이그레이션 실패:", error);
    }
  }

  // ===== 📊 통계 및 상태 관리 =====

  /**
   * 📊 통계 업데이트
   */
  updateStats(success, responseTime) {
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // 평균 응답 시간 계산
    const totalTime =
      this.stats.averageResponseTime * (this.stats.operationsCount - 1) +
      responseTime;
    this.stats.averageResponseTime = Math.round(
      totalTime / this.stats.operationsCount
    );

    this.stats.lastOperation = TimeHelper.getLogTimeString();
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      initialized: !!this.collection,
      stats: this.stats,
      config: this.config,
      cache: {
        size: this.cache.size,
        enabled: this.config.enableCache,
        hitRate:
          this.stats.operationsCount > 0
            ? Math.round(
                (this.stats.cacheHits / this.stats.operationsCount) * 100
              )
            : 0,
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 TodoService 정리 시작...");

      // 캐시 정리
      this.cache.clear();
      this.cacheTimestamps.clear();

      // 통계 초기화
      this.stats.operationsCount = 0;
      this.stats.successCount = 0;
      this.stats.errorCount = 0;
      this.stats.cacheHits = 0;
      this.stats.cacheMisses = 0;

      logger.info("✅ TodoService 정리 완료");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }

  /**
   * 📦 백업 스케줄러 시작 (Railway 환경용)
   */
  startBackupScheduler() {
    if (!this.isRailway || !this.config.enableBackup) return;

    setInterval(async () => {
      try {
        logger.debug("📦 자동 백업 작업 시작...");

        // 간단한 백업 로직 (필요시 확장)
        const stats = await this.getUserStats("backup");
        logger.debug(`📦 백업 통계: ${JSON.stringify(stats)}`);
      } catch (error) {
        logger.error("❌ 자동 백업 실패:", error);
      }
    }, this.config.backupInterval);

    logger.debug("📦 백업 스케줄러 시작됨");
  }
}

module.exports = TodoService;
