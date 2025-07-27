// src/services/TodoService.js - 할일 관리 서비스 (표준 준수)
const logger = require("../utils/Logger"); // LoggerEnhancer 적용
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 🔧 TodoService - 할일 관리 데이터 서비스
 * - MongoDB 네이티브 드라이버 사용 (mongoose 금지)
 * - 순수 데이터 처리만 담당 (UI 금지)
 * - LoggerEnhancer 활용
 * - Railway 환경 최적화
 */
class TodoService {
  constructor(options = {}) {
    this.collectionName = "todos";
    this.db = options.db || null;
    this.collection = null;

    // 설정 (환경변수 기반)
    this.config = {
      enableCache: true,
      cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000,
      maxRetries: 3,
      defaultPageSize: 5,
      maxItemsPerUser: parseInt(process.env.MAX_TODO_PER_USER) || 50,
      ...options.config,
    };

    // 메모리 캐시
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 체크
    this.isRailway = !process.env.NODE_ENV || process.env.RAILWAY_ENVIRONMENT;

    logger.service("TodoService", "서비스 생성", {
      railway: this.isRailway,
      config: this.config,
    });
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      if (!this.db) {
        throw new Error("Database connection required");
      }

      // 컬렉션 초기화
      this.collection = this.db.collection(this.collectionName);

      // 인덱스 생성 (Railway 환경 고려)
      await this.createIndexes();

      logger.success("TodoService 초기화 완료");
    } catch (error) {
      logger.error("TodoService 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 📊 인덱스 생성 (Railway 최적화)
   */
  async createIndexes() {
    try {
      const indexes = [
        // 핵심 인덱스만 (담백하게)
        { userId: 1, createdAt: -1 },
        { userId: 1, completed: 1 },
        { isActive: 1, userId: 1 },
      ];

      for (const index of indexes) {
        await this.collection.createIndex(index);
      }

      logger.debug("TodoService 인덱스 생성 완료");
    } catch (error) {
      // Railway에서는 인덱스 생성 실패를 warning으로 처리
      if (this.isRailway) {
        logger.warn("인덱스 생성 실패 (Railway 환경)", error.message);
      } else {
        throw error;
      }
    }
  }

  // ===== 📝 할일 CRUD 메서드들 (담백한 기능만) =====

  /**
   * ✏️ 할일 생성
   */
  async createTodo(userId, todoData) {
    try {
      // 사용자 할일 개수 체크
      const userTodoCount = await this.collection.countDocuments({
        userId,
        isActive: true,
      });

      if (userTodoCount >= this.config.maxItemsPerUser) {
        throw new Error(
          `할일은 최대 ${this.config.maxItemsPerUser}개까지 등록 가능합니다.`
        );
      }

      // 할일 문서 생성 (표준 필드)
      const todo = {
        userId,
        title: todoData.title.trim(),
        priority: todoData.priority || "medium",
        completed: false,
        completedAt: null,

        // 표준 필드
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: 1,
        isActive: true,
      };

      const result = await this.collection.insertOne(todo);
      const createdTodo = await this.collection.findOne({
        _id: result.insertedId,
      });

      // 캐시 무효화
      this.invalidateUserCache(userId);

      logger.data("todo", "create", userId, { title: todo.title });
      return createdTodo;
    } catch (error) {
      logger.error("할일 생성 실패", error);
      throw error;
    }
  }

  /**
   * 📋 사용자 할일 목록 조회
   */
  async getUserTodos(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = this.config.defaultPageSize,
        status = null, // 'pending', 'completed', 'all'
        sortBy = "createdAt",
        sortOrder = -1,
      } = options;

      // 캐시 키 생성
      const cacheKey = `user_todos_${userId}_${JSON.stringify(options)}`;

      // 캐시 확인
      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          logger.debug("할일 목록 캐시 히트");
          return cached;
        }
      }

      // 쿼리 조건 구성
      const query = {
        userId,
        isActive: true,
      };

      // 상태 필터
      if (status === "pending") {
        query.completed = false;
      } else if (status === "completed") {
        query.completed = true;
      }

      // 정렬 옵션
      const sort = {};
      sort[sortBy] = sortOrder;

      // 페이지네이션 계산
      const skip = (page - 1) * limit;

      // 병렬 실행
      const [todos, totalCount] = await Promise.all([
        this.collection
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.collection.countDocuments(query),
      ]);

      const result = {
        todos,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: page * limit < totalCount,
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.saveToCache(cacheKey, result);
      }

      logger.data("todo", "list", userId, { count: todos.length });
      return result;
    } catch (error) {
      logger.error("할일 목록 조회 실패", error);
      throw error;
    }
  }

  /**
   * 🔄 할일 상태 토글
   */
  async toggleTodo(userId, todoId) {
    try {
      const objectId = new ObjectId(todoId);

      // 현재 할일 조회
      const todo = await this.collection.findOne({
        _id: objectId,
        userId,
        isActive: true,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      // 상태 토글
      const newCompleted = !todo.completed;
      const updateData = {
        completed: newCompleted,
        completedAt: newCompleted ? TimeHelper.now() : null,
        updatedAt: TimeHelper.now(),
        $inc: { version: 1 },
      };

      const result = await this.collection.updateOne(
        { _id: objectId, userId },
        { $set: updateData }
      );

      if (result.modifiedCount === 0) {
        throw new Error("할일 상태 변경에 실패했습니다.");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      logger.data("todo", "toggle", userId, {
        todoId,
        status: newCompleted ? "completed" : "pending",
      });

      return await this.collection.findOne({ _id: objectId });
    } catch (error) {
      logger.error("할일 토글 실패", error);
      throw error;
    }
  }

  /**
   * 🗑️ 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    try {
      const objectId = new ObjectId(todoId);

      const result = await this.collection.updateOne(
        { _id: objectId, userId, isActive: true },
        {
          $set: {
            isActive: false,
            deletedAt: TimeHelper.now(),
            updatedAt: TimeHelper.now(),
            $inc: { version: 1 },
          },
        }
      );

      if (result.modifiedCount === 0) {
        throw new Error("할일을 찾을 수 없거나 삭제에 실패했습니다.");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      logger.data("todo", "delete", userId, { todoId });
      return true;
    } catch (error) {
      logger.error("할일 삭제 실패", error);
      throw error;
    }
  }

  // ===== 📊 통계 메서드들 (기본만) =====

  /**
   * 📈 사용자 기본 통계
   */
  async getUserStats(userId) {
    try {
      const cacheKey = `user_stats_${userId}`;

      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const pipeline = [
        { $match: { userId, isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: ["$completed", 1, 0] } },
            pending: { $sum: { $cond: ["$completed", 0, 1] } },
          },
        },
      ];

      const result = await this.collection.aggregate(pipeline).toArray();
      const stats = result[0] || { total: 0, completed: 0, pending: 0 };

      // 완료율 계산
      stats.completionRate =
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

      if (this.config.enableCache) {
        this.saveToCache(cacheKey, stats, 60000); // 1분 캐시
      }

      logger.data("todo", "stats", userId, stats);
      return stats;
    } catch (error) {
      logger.error("사용자 통계 조회 실패", error);
      return { total: 0, completed: 0, pending: 0, completionRate: 0 };
    }
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 캐시에서 조회
   */
  getFromCache(key) {
    if (!this.config.enableCache) return null;

    const data = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);

    if (
      data &&
      timestamp &&
      Date.now() - timestamp < this.config.cacheTimeout
    ) {
      return data;
    }

    // 만료된 캐시 제거
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return null;
  }

  /**
   * 캐시에 저장
   */
  saveToCache(key, data, customTimeout = null) {
    if (!this.config.enableCache) return;

    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // 커스텀 타임아웃 적용
    if (customTimeout) {
      setTimeout(() => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }, customTimeout);
    }
  }

  /**
   * 사용자 캐시 무효화
   */
  invalidateUserCache(userId) {
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
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      collectionName: this.collectionName,
      isConnected: !!this.collection,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      railway: this.isRailway,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      this.cache.clear();
      this.cacheTimestamps.clear();
      logger.info("TodoService 정리 완료");
    } catch (error) {
      logger.error("TodoService 정리 실패", error);
    }
  }
}

module.exports = TodoService;
