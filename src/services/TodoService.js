// src/services/TodoService.js - 할일 관리 데이터 서비스 (표준 준수)
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 🔧 TodoService - 할일 관리 데이터 서비스
 * - 순수 데이터 처리만 담당 (UI/메시지 금지)
 * - MongoDB 네이티브 드라이버 사용
 * - 표준 필드 준수: userId, createdAt, updatedAt, version, isActive
 * - Railway 환경 최적화
 * - 메모리 캐싱 시스템
 */
class TodoService {
  constructor(options = {}) {
    this.collectionName = "todos";
    this.db = options.db || null;
    this.collection = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableCache: process.env.ENABLE_TODO_CACHE !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      maxRetries: parseInt(process.env.DB_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000,
      defaultPageSize: parseInt(process.env.TODO_PAGE_SIZE) || 5,
      maxItemsPerUser: parseInt(process.env.MAX_TODO_PER_USER) || 50,
      autoCleanupDays: parseInt(process.env.TODO_CLEANUP_DAYS) || 30,
      ...options.config,
    };

    // 메모리 캐시 시스템
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 체크
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 통계 및 모니터링
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastOperation: null,
    };

    // 할일 상태 상수
    this.STATUS = {
      PENDING: "pending",
      COMPLETED: "completed",
      DELETED: "deleted",
    };

    // 우선순위 상수
    this.PRIORITY = {
      LOW: "low",
      NORMAL: "normal",
      HIGH: "high",
      URGENT: "urgent",
    };

    logger.info("🔧 TodoService 생성됨", { railway: this.isRailway });
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      if (!this.db) {
        throw new Error("데이터베이스 인스턴스가 필요합니다");
      }

      this.collection = this.db.collection(this.collectionName);

      // 인덱스 생성
      await this.createIndexes();

      // 자동 정리 작업 스케줄링 (Railway에서는 비활성화)
      if (!this.isRailway && this.config.autoCleanupDays > 0) {
        this.scheduleCleanup();
      }

      logger.success("✅ TodoService 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 인덱스 생성 (성능 최적화)
   */
  async createIndexes() {
    try {
      // 기본 쿼리 최적화 인덱스
      await this.collection.createIndex(
        { userId: 1, createdAt: -1 },
        { background: true }
      );
      await this.collection.createIndex(
        { userId: 1, status: 1, createdAt: -1 },
        { background: true }
      );
      await this.collection.createIndex(
        { userId: 1, isActive: 1 },
        { background: true }
      );

      // 검색 최적화 인덱스
      await this.collection.createIndex(
        { title: "text" },
        { background: true }
      );

      // 정리 작업 최적화 인덱스
      await this.collection.createIndex(
        { completedAt: 1, status: 1 },
        { background: true }
      );

      // 통계 최적화 인덱스
      await this.collection.createIndex(
        { userId: 1, status: 1, priority: 1 },
        { background: true }
      );

      logger.debug("📊 TodoService 인덱스 생성 완료");
    } catch (error) {
      // Railway에서는 인덱스 생성 실패를 경고로 처리
      if (this.isRailway) {
        logger.warn("⚠️ 인덱스 생성 실패 (Railway 환경):", error.message);
      } else {
        logger.error("❌ 인덱스 생성 실패:", error);
        throw error;
      }
    }
  }

  // ===== 📝 할일 CRUD 메서드들 =====

  /**
   * ✏️ 할일 생성
   */
  async createTodo(userId, todoData) {
    this.stats.operationsCount++;

    try {
      // 사용자 할일 개수 제한 체크
      const userTodoCount = await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });

      if (userTodoCount >= this.config.maxItemsPerUser) {
        throw new Error(
          `할일은 최대 ${this.config.maxItemsPerUser}개까지 등록 가능합니다.`
        );
      }

      // 제목 검증
      if (!todoData.title || todoData.title.trim().length === 0) {
        throw new Error("할일 제목은 필수입니다.");
      }

      if (todoData.title.length > 100) {
        throw new Error("할일 제목은 100자를 초과할 수 없습니다.");
      }

      // 할일 문서 생성 (표준 필드 준수)
      const todo = {
        userId: userId.toString(),
        title: todoData.title.trim(),
        description: todoData.description?.trim() || "",
        status: this.STATUS.PENDING,
        priority: todoData.priority || this.PRIORITY.NORMAL,
        category: todoData.category?.trim() || "일반",
        tags: Array.isArray(todoData.tags) ? todoData.tags : [],

        // 완료 관련
        completed: false,
        completedAt: null,

        // 표준 필드
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: 1,
        isActive: true,

        // 환경 정보
        environment: this.isRailway ? "railway" : "development",
        timezone: "Asia/Seoul",
      };

      const result = await this.collection.insertOne(todo);
      const createdTodo = await this.collection.findOne({
        _id: result.insertedId,
      });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`📝 할일 생성: ${createdTodo.title} (사용자: ${userId})`);

      return createdTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("❌ 할일 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📋 사용자 할일 목록 조회 (페이지네이션 지원)
   */
  async getUserTodos(userId, options = {}) {
    this.stats.operationsCount++;

    try {
      const {
        page = 1,
        limit = this.config.defaultPageSize,
        status = null, // 'pending', 'completed', 'all'
        sortBy = "createdAt",
        sortOrder = -1,
        search = null,
      } = options;

      // 캐시 키 생성
      const cacheKey = `user_todos_${userId}_${JSON.stringify(options)}`;

      // 캐시 확인
      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // 쿼리 조건 구성
      const query = {
        userId: userId.toString(),
        isActive: true,
      };

      // 상태 필터
      if (status && status !== "all") {
        query.status = status;
      }

      // 검색 조건
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: "i" } },
          { description: { $regex: search.trim(), $options: "i" } },
        ];
      }

      // 정렬 조건
      const sort = {};
      sort[sortBy] = sortOrder;

      // 페이지네이션 계산
      const skip = (page - 1) * limit;

      // 쿼리 실행
      const [todos, total] = await Promise.all([
        this.collection
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.collection.countDocuments(query),
      ]);

      // 결과 구성
      const result = {
        todos,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.setCache(cacheKey, result);
      }

      this.stats.successCount++;
      this.stats.lastOperation = "getUserTodos";

      return result;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("❌ 할일 목록 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 🔄 할일 상태 토글 (완료/미완료)
   */
  async toggleTodoStatus(userId, todoId) {
    this.stats.operationsCount++;

    try {
      // ObjectId 변환
      const objectId = new ObjectId(todoId);

      // 현재 할일 조회
      const currentTodo = await this.collection.findOne({
        _id: objectId,
        userId: userId.toString(),
        isActive: true,
      });

      if (!currentTodo) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      // 상태 토글
      const newStatus =
        currentTodo.status === this.STATUS.PENDING
          ? this.STATUS.COMPLETED
          : this.STATUS.PENDING;

      const newCompleted = newStatus === this.STATUS.COMPLETED;
      const now = TimeHelper.now();

      // 업데이트 데이터
      const updateData = {
        status: newStatus,
        completed: newCompleted,
        completedAt: newCompleted ? now : null,
        updatedAt: now,
        version: currentTodo.version + 1,
      };

      const result = await this.collection.updateOne(
        { _id: objectId, userId: userId.toString(), isActive: true },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        throw new Error("할일 업데이트에 실패했습니다.");
      }

      // 업데이트된 할일 조회
      const updatedTodo = await this.collection.findOne({ _id: objectId });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `🔄 할일 상태 변경: ${currentTodo.title} -> ${newStatus} (사용자: ${userId})`
      );

      return updatedTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("❌ 할일 상태 토글 실패:", error);
      throw error;
    }
  }

  /**
   * 🗑️ 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const objectId = new ObjectId(todoId);
      const now = TimeHelper.now();

      const result = await this.collection.updateOne(
        {
          _id: objectId,
          userId: userId.toString(),
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            status: this.STATUS.DELETED,
            deletedAt: now,
            updatedAt: now,
            version: { $inc: 1 },
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`🗑️ 할일 삭제: ${todoId} (사용자: ${userId})`);

      return { success: true, deletedId: todoId };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("❌ 할일 삭제 실패:", error);
      throw error;
    }
  }

  /**
   * ✏️ 할일 수정
   */
  async updateTodo(userId, todoId, updateData) {
    this.stats.operationsCount++;

    try {
      const objectId = new ObjectId(todoId);

      // 현재 할일 조회
      const currentTodo = await this.collection.findOne({
        _id: objectId,
        userId: userId.toString(),
        isActive: true,
      });

      if (!currentTodo) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      // 업데이트할 필드 준비
      const allowedFields = [
        "title",
        "description",
        "priority",
        "category",
        "tags",
      ];
      const updateFields = {};

      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          updateFields[field] = updateData[field];
        }
      }

      // 제목 검증
      if (updateFields.title) {
        if (updateFields.title.trim().length === 0) {
          throw new Error("할일 제목은 필수입니다.");
        }
        if (updateFields.title.length > 100) {
          throw new Error("할일 제목은 100자를 초과할 수 없습니다.");
        }
        updateFields.title = updateFields.title.trim();
      }

      // 메타데이터 업데이트
      updateFields.updatedAt = TimeHelper.now();
      updateFields.version = currentTodo.version + 1;

      const result = await this.collection.updateOne(
        { _id: objectId, userId: userId.toString(), isActive: true },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        throw new Error("할일 업데이트에 실패했습니다.");
      }

      // 업데이트된 할일 조회
      const updatedTodo = await this.collection.findOne({ _id: objectId });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`✏️ 할일 수정: ${updatedTodo.title} (사용자: ${userId})`);

      return updatedTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("❌ 할일 수정 실패:", error);
      throw error;
    }
  }

  // ===== 📊 통계 및 분석 메서드들 =====

  /**
   * 📊 사용자 기본 통계
   */
  async getUserStats(userId) {
    try {
      const cacheKey = `user_stats_${userId}`;

      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
      }

      const pipeline = [
        { $match: { userId: userId.toString(), isActive: true } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();

      const stats = {
        total: 0,
        pending: 0,
        completed: 0,
        todayAdded: 0,
      };

      // 결과 파싱
      results.forEach((result) => {
        stats.total += result.count;
        stats[result._id] = result.count;
      });

      // 오늘 추가된 할일 개수
      const today = TimeHelper.startOfDay();
      const todayCount = await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
        createdAt: { $gte: today },
      });
      stats.todayAdded = todayCount;

      if (this.config.enableCache) {
        this.setCache(cacheKey, stats, 60000); // 1분 캐시
      }

      return stats;
    } catch (error) {
      logger.error("❌ 사용자 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📈 상세 통계 (주간, 월간)
   */
  async getDetailedStats(userId) {
    try {
      const now = TimeHelper.now();
      const weekAgo = TimeHelper.subtract(now, 7, "days");
      const monthAgo = TimeHelper.subtract(now, 30, "days");

      const [weeklyStats, monthlyStats, categoryStats] = await Promise.all([
        this.getStatsForPeriod(userId, weekAgo, now),
        this.getStatsForPeriod(userId, monthAgo, now),
        this.getCategoryStats(userId),
      ]);

      return {
        weekly: weeklyStats,
        monthly: monthlyStats,
        categories: categoryStats,
        completionRate: this.calculateCompletionRate(weeklyStats),
      };
    } catch (error) {
      logger.error("❌ 상세 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 기간별 통계
   */
  async getStatsForPeriod(userId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          userId: userId.toString(),
          isActive: true,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ];

    const results = await this.collection.aggregate(pipeline).toArray();

    // 일별 데이터 구성
    const daily = {};
    results.forEach((result) => {
      const date = result._id.date;
      if (!daily[date]) {
        daily[date] = { pending: 0, completed: 0, total: 0 };
      }
      daily[date][result._id.status] = result.count;
      daily[date].total += result.count;
    });

    return { daily };
  }

  /**
   * 🏷️ 카테고리별 통계
   */
  async getCategoryStats(userId) {
    const pipeline = [
      { $match: { userId: userId.toString(), isActive: true } },
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", this.STATUS.COMPLETED] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ];

    return await this.collection.aggregate(pipeline).toArray();
  }

  // ===== 🔧 유틸리티 및 헬퍼 메서드들 =====

  /**
   * 💾 캐시 관리
   */
  setCache(key, value, customTtl = null) {
    if (!this.config.enableCache) return;

    this.cache.set(key, value);
    this.cacheTimestamps.set(
      key,
      Date.now() + (customTtl || this.config.cacheTimeout)
    );
  }

  getFromCache(key) {
    if (!this.config.enableCache) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  invalidateUserCache(userId) {
    if (!this.config.enableCache) return;

    const userPrefix = `user_${userId}`;
    for (const key of this.cache.keys()) {
      if (key.includes(userPrefix)) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  /**
   * 📊 완료율 계산
   */
  calculateCompletionRate(stats) {
    if (!stats.daily) return 0;

    let totalTodos = 0;
    let completedTodos = 0;

    Object.values(stats.daily).forEach((day) => {
      totalTodos += day.total;
      completedTodos += day.completed;
    });

    return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  }

  /**
   * 🧹 자동 정리 작업 스케줄링
   */
  scheduleCleanup() {
    // 매일 자정에 오래된 완료된 할일 정리
    setInterval(async () => {
      try {
        await this.cleanupOldTodos();
      } catch (error) {
        logger.error("❌ 자동 정리 작업 실패:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24시간
  }

  /**
   * 🧹 오래된 할일 정리
   */
  async cleanupOldTodos() {
    const cutoffDate = TimeHelper.subtract(
      TimeHelper.now(),
      this.config.autoCleanupDays,
      "days"
    );

    const result = await this.collection.deleteMany({
      status: this.STATUS.COMPLETED,
      completedAt: { $lt: cutoffDate },
    });

    if (result.deletedCount > 0) {
      logger.info(`🧹 자동 정리: ${result.deletedCount}개의 오래된 할일 삭제`);
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      collectionName: this.collectionName,
      isConnected: !!this.collection,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: this.stats,
      config: {
        maxItemsPerUser: this.config.maxItemsPerUser,
        defaultPageSize: this.config.defaultPageSize,
        autoCleanupDays: this.config.autoCleanupDays,
      },
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    try {
      this.cache.clear();
      this.cacheTimestamps.clear();
      logger.info("✅ TodoService 정리 완료");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }
}

module.exports = TodoService;
