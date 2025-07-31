// src/services/TodoService.js - 완성도 높은 할일 데이터 서비스

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 TodoService - Mongoose 기반 할일 관리 서비스
 *
 * 🎯 핵심 기능:
 * - 할일 CRUD (생성/조회/업데이트/삭제)
 * - 검색 및 필터링
 * - 완료/미완료 토글
 * - 리마인더 연동
 * - 통계 및 분석
 *
 * ✅ 표준 준수:
 * - Mongoose 라이브러리 사용
 * - 모델 기반 스키마 검증
 * - 메모리 캐싱 시스템
 * - Railway 환경 최적화
 */
class TodoService {
  constructor(options = {}) {
    // Mongoose 모델 (나중에 주입받음)
    this.Todo = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableCache: process.env.ENABLE_TODO_CACHE !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableValidation: process.env.TODO_VALIDATION_ENABLED !== "false",
      enableSearch: true,
      ...options.config,
    };

    // 메모리 캐시 (간단한 Map 기반)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 서비스 통계
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
      searchCount: 0,
    };

    logger.info("📋 TodoService 생성됨 - Mongoose 버전! 🎉");
  }

  /**
   * 🎯 서비스 초기화 (Mongoose 모델 연결)
   */
  async initialize() {
    try {
      logger.info("🔧 TodoService 초기화 시작 (Mongoose)...");

      // MongooseManager에서 Todo 모델 가져오기
      const { getInstance } = require("../database/MongooseManager");
      const mongooseManager = getInstance();

      this.Todo = mongooseManager.getModel("Todo");

      if (!this.Todo) {
        throw new Error("Todo 모델을 찾을 수 없습니다");
      }

      logger.success("✅ TodoService 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📋 Mongoose 기반 CRUD 메서드들 =====

  /**
   * 📋 할일 목록 조회
   */
  async getTodos(userId, options = {}) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `todos:${userId}:${JSON.stringify(options)}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // Mongoose 쿼리 구성
      const query = {
        userId: userId.toString(),
        isActive: true,
      };

      // 완료 상태 필터
      if (options.completed !== undefined) {
        query.completed = options.completed;
      }

      // 카테고리 필터
      if (options.category) {
        query.category = options.category;
      }

      // 우선순위 필터
      if (options.priority) {
        query.priority = options.priority;
      }

      // 태그 필터
      if (options.tags && options.tags.length > 0) {
        query.tags = { $in: options.tags };
      }

      let mongoQuery = this.Todo.find(query);

      // 정렬 (미완료 → 완료 순, 최신순)
      mongoQuery = mongoQuery.sort({
        completed: 1, // 미완료가 먼저
        createdAt: -1, // 최신순
      });

      // 페이징
      if (options.limit) {
        mongoQuery = mongoQuery.limit(options.limit);
      }
      if (options.skip) {
        mongoQuery = mongoQuery.skip(options.skip);
      }

      const todos = await mongoQuery.lean();

      // 캐시에 저장
      if (this.config.enableCache) {
        this.cache.set(cacheKey, todos);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(
        `📋 할일 ${todos.length}개 조회됨 (사용자: ${userId}) - Mongoose`
      );

      return todos;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 목록 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * ➕ 새 할일 추가
   */
  async addTodo(userId, todoData) {
    this.stats.operationsCount++;

    try {
      // 사용자별 할일 개수 확인
      const existingCount = await this.Todo.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });

      if (existingCount >= this.config.maxTodosPerUser) {
        throw new Error(
          `최대 ${this.config.maxTodosPerUser}개까지만 할일을 추가할 수 있습니다`
        );
      }

      // 할일 데이터 구성
      const todoDoc = new this.Todo({
        userId: userId.toString(),
        text: todoData.text.trim(),
        category: todoData.category || "일반",
        priority: todoData.priority || 3,
        tags: todoData.tags || [],
        dueDate: todoData.dueDate || null,
        reminderId: todoData.reminderId || null,
        description: todoData.description || "",
      });

      const savedTodo = await todoDoc.save();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `➕ 할일 추가됨: "${todoData.text}" (사용자: ${userId}) - Mongoose`
      );

      return savedTodo;
    } catch (error) {
      this.stats.errorCount++;

      // Mongoose 검증 에러 처리
      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const firstError = Object.values(error.errors)[0];
        throw new Error(firstError.message);
      }

      logger.error("할일 추가 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * ✅ 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 완료 상태 토글
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? new Date() : null;

      const updatedTodo = await todo.save();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      const action = todo.completed ? "완료" : "미완료";
      logger.info(
        `✅ 할일 ${action}: "${todo.text}" (사용자: ${userId}) - Mongoose`
      );

      return updatedTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 토글 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📝 할일 업데이트
   */
  async updateTodo(userId, todoId, updateData) {
    this.stats.operationsCount++;

    try {
      const updatedTodoData = {
        ...updateData,
        updatedAt: new Date(),
      };

      const updatedTodo = await this.Todo.findOneAndUpdate(
        {
          _id: todoId,
          userId: userId.toString(),
          isActive: true,
        },
        updatedTodoData,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedTodo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(
        `📝 할일 업데이트됨: ${todoId} (사용자: ${userId}) - Mongoose`
      );

      return updatedTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 업데이트 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🗑️ 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const deletedTodo = await this.Todo.findOneAndUpdate(
        {
          _id: todoId,
          userId: userId.toString(),
          isActive: true,
        },
        {
          isActive: false,
          deletedAt: new Date(),
        },
        { new: true }
      );

      if (!deletedTodo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `🗑️ 할일 삭제됨: "${deletedTodo.text}" (사용자: ${userId}) - Mongoose`
      );

      return deletedTodo;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 삭제 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🔍 할일 검색
   */
  async searchTodos(userId, keyword, options = {}) {
    this.stats.operationsCount++;
    this.stats.searchCount++;

    try {
      if (!keyword || keyword.trim().length === 0) {
        return [];
      }

      const searchKeyword = keyword.trim();

      // 캐시 확인
      const cacheKey = `search:${userId}:${searchKeyword}:${JSON.stringify(
        options
      )}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // MongoDB 텍스트 검색 쿼리
      const query = {
        userId: userId.toString(),
        isActive: true,
        $or: [
          { text: { $regex: searchKeyword, $options: "i" } },
          { description: { $regex: searchKeyword, $options: "i" } },
          { category: { $regex: searchKeyword, $options: "i" } },
          { tags: { $in: [new RegExp(searchKeyword, "i")] } },
        ],
      };

      // 완료 상태 필터
      if (options.completed !== undefined) {
        query.completed = options.completed;
      }

      const searchResults = await this.Todo.find(query)
        .sort({
          completed: 1, // 미완료 먼저
          createdAt: -1, // 최신순
        })
        .limit(options.limit || 20)
        .lean();

      // 캐시에 저장
      if (this.config.enableCache) {
        this.cache.set(cacheKey, searchResults);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(
        `🔍 검색 완료: "${searchKeyword}" → ${searchResults.length}개 (사용자: ${userId}) - Mongoose`
      );

      return searchResults;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 검색 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📊 카테고리별 통계
   */
  async getCategoryStats(userId) {
    this.stats.operationsCount++;

    try {
      const stats = await this.Todo.aggregate([
        {
          $match: {
            userId: userId.toString(),
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            category: "$_id",
            total: 1,
            completed: 1,
            pending: { $subtract: ["$total", "$completed"] },
            completionRate: {
              $round: [
                { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
                1,
              ],
            },
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);

      this.stats.successCount++;
      return stats;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("카테고리별 통계 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📈 월별 통계
   */
  async getMonthlyStats(userId, year = null) {
    this.stats.operationsCount++;

    try {
      const targetYear = year || new Date().getFullYear();

      const stats = await this.Todo.aggregate([
        {
          $match: {
            userId: userId.toString(),
            isActive: true,
            createdAt: {
              $gte: new Date(`${targetYear}-01-01`),
              $lt: new Date(`${targetYear + 1}-01-01`),
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            added: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            month: "$_id",
            added: 1,
            completed: 1,
            pending: { $subtract: ["$added", "$completed"] },
          },
        },
        {
          $sort: { month: 1 },
        },
      ]);

      this.stats.successCount++;
      return stats;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("월별 통계 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📅 오늘 마감인 할일 조회
   */
  async getTodayDueTodos(userId) {
    this.stats.operationsCount++;

    try {
      const today = TimeHelper.now();
      const startOfDay = TimeHelper.setTime(today, 0, 0, 0);
      const endOfDay = TimeHelper.setTime(today, 23, 59, 59);

      const dueTodos = await this.Todo.find({
        userId: userId.toString(),
        isActive: true,
        completed: false,
        dueDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
        .sort({ dueDate: 1 })
        .lean();

      this.stats.successCount++;
      return dueTodos;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("오늘 마감 할일 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * ⚠️ 연체된 할일 조회
   */
  async getOverdueTodos(userId) {
    this.stats.operationsCount++;

    try {
      const now = TimeHelper.now();

      const overdueTodos = await this.Todo.find({
        userId: userId.toString(),
        isActive: true,
        completed: false,
        dueDate: {
          $lt: now,
        },
      })
        .sort({ dueDate: 1 })
        .lean();

      this.stats.successCount++;
      return overdueTodos;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연체 할일 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏆 완료율 높은 카테고리 조회
   */
  async getTopCategories(userId, limit = 5) {
    this.stats.operationsCount++;

    try {
      const topCategories = await this.Todo.aggregate([
        {
          $match: {
            userId: userId.toString(),
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
            },
          },
        },
        {
          $match: {
            total: { $gte: 2 }, // 최소 2개 이상인 카테고리만
          },
        },
        {
          $project: {
            category: "$_id",
            total: 1,
            completed: 1,
            completionRate: {
              $round: [
                { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
                1,
              ],
            },
          },
        },
        {
          $sort: { completionRate: -1, total: -1 },
        },
        {
          $limit: limit,
        },
      ]);

      this.stats.successCount++;
      return topCategories;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("상위 카테고리 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 캐시 유효성 검사
   */
  isValidCache(key) {
    if (!this.cache.has(key) || !this.cacheTimestamps.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    const now = Date.now();
    const isValid = now - timestamp < this.config.cacheTimeout;

    if (!isValid) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }

    return isValid;
  }

  /**
   * 사용자별 캐시 무효화
   */
  invalidateUserCache(userId) {
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (key.includes(`:${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.debug(
      `🗑️ 사용자 캐시 무효화됨: ${userId} (${keysToDelete.length}개)`
    );
  }

  /**
   * 전체 캐시 정리
   */
  clearCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.cacheTimestamps.clear();

    logger.debug(`🗑️ TodoService 캐시 정리됨 (${cacheSize}개)`);
  }

  // ===== 📊 서비스 상태 및 정리 =====

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      isConnected: !!this.Todo,
      modelName: this.Todo?.modelName || null,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: { ...this.stats },
      config: {
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableValidation: this.config.enableValidation,
        enableSearch: this.config.enableSearch,
      },
      isRailway: this.isRailway,
    };
  }

  /**
   * 헬스체크
   */
  async healthCheck() {
    try {
      // 간단한 쿼리로 DB 연결 확인
      await this.Todo.findOne().limit(1);

      return {
        healthy: true,
        message: "TodoService 정상 작동",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        message: `TodoService 헬스체크 실패: ${error.message}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      this.clearCache();

      // 통계 초기화
      this.stats = {
        operationsCount: 0,
        successCount: 0,
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        validationErrors: 0,
        searchCount: 0,
      };

      logger.info("✅ TodoService 정리 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }
}

module.exports = TodoService;
