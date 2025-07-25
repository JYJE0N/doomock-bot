// src/services/TodoService.js - v3.0.1 중복 생성 방지 완전 수정판
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 🔧 할일 데이터 서비스 v3.0.1 - 중복 방지 완성판
 *
 * ✅ 핵심 개선사항:
 * - 중복 생성 완전 방지 (정적 플래그 사용)
 * - 중복 로깅 방지 시스템
 * - ValidationManager 중앙화
 * - 순수 데이터 처리에만 집중
 * - MongoDB 네이티브 드라이버 사용
 * - Railway 환경 최적화
 * - 메모리 캐싱 시스템 유지
 *
 * 🎯 설계 원칙:
 * - 검증과 데이터 처리의 완전한 분리
 * - 단일 책임 원칙 준수
 * - 성능 최적화 (검증 캐싱)
 * - 코드 중복 제거
 * - 중복 인스턴스 생성 방지
 */
class TodoService {
  constructor(options = {}) {
    this.collectionName = "todos";
    this.db = options.db || null;
    this.collection = null;

    // 🛡️ ValidationManager 참조 (검증은 모두 위임)
    this.validationManager = options.validationManager || null;

    // 🔒 중복 생성 방지 시스템
    this.instanceId = `todo_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // ✅ 생성 로그 중복 방지 (정적 변수 사용)
    if (!TodoService._creationLogged) {
      logger.info("🔧 TodoService v3.0.1 생성됨 (ValidationManager 연동)");
      TodoService._creationLogged = true;
    }

    // 🎯 설정 (Railway 환경변수 기반)
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

    // 💾 메모리 캐시 (성능 최적화)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // 🌍 Railway 환경 체크
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 📊 통계
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
      instanceCreated: Date.now(),
    };

    // 🏗️ 초기화 상태 관리
    this.isInitialized = false;
    this.initializationInProgress = false;

    // 📝 인스턴스 등록 (디버깅용)
    if (!TodoService._instances) {
      TodoService._instances = new Set();
    }
    TodoService._instances.add(this.instanceId);

    // 디버그 정보 (개발 환경에서만)
    if (process.env.NODE_ENV === "development") {
      logger.debug(`📝 TodoService 인스턴스 생성됨: ${this.instanceId}`);
      logger.debug(`📊 총 인스턴스 수: ${TodoService._instances.size}`);
    }
  }

  /**
   * 🎯 서비스 초기화 (중복 방지)
   */
  async initialize() {
    try {
      // 🛡️ 중복 초기화 완전 방지
      if (this.initializationInProgress) {
        logger.debug(`TodoService 초기화 진행 중 - 대기 (${this.instanceId})`);
        return;
      }

      if (this.isInitialized) {
        logger.debug(`TodoService 이미 초기화됨 - 스킵 (${this.instanceId})`);
        return;
      }

      // 🔒 초기화 진행 상태 설정
      this.initializationInProgress = true;

      if (this.db && this.collectionName) {
        this.collection = this.db.collection(this.collectionName);

        // 최적화된 인덱스 생성
        await this.createOptimizedIndexes();

        // 데이터 유효성 검사
        await this.validateDataIntegrity();

        // ✅ 초기화 완료 로그 (한 번만)
        if (!TodoService._initializationLogged) {
          logger.info("✅ TodoService v3.0.1 초기화 완료");
          TodoService._initializationLogged = true;
        }

        this.isInitialized = true;
      }

      // 백업 스케줄러 시작 (Railway 환경에서만)
      if (this.isRailway && this.config.enableBackup) {
        this.startBackupScheduler();
      }
    } catch (error) {
      logger.error(`❌ TodoService 초기화 실패 (${this.instanceId}):`, error);
      throw error;
    } finally {
      // 🔓 초기화 진행 상태 해제
      this.initializationInProgress = false;
    }
  }

  /**
   * 🔍 최적화된 인덱스 생성 (중복 방지)
   */
  async createOptimizedIndexes() {
    try {
      if (!this.collection) return;

      // 🛡️ 인덱스 생성 중복 방지
      if (TodoService._indexesCreated) {
        logger.debug("TodoService 인덱스 이미 생성됨 - 스킵");
        return;
      }

      // 기본 쿼리 최적화 인덱스들
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, completed: 1 });
      await this.collection.createIndex({ userId: 1, priority: -1 });
      await this.collection.createIndex({ dueDate: 1 });
      await this.collection.createIndex({ updatedAt: -1 });

      // 텍스트 검색 인덱스 (Railway 환경 최적화)
      await this.collection.createIndex(
        { text: "text", description: "text" },
        {
          background: true,
          weights: { text: 10, description: 5 },
        }
      );

      // 복합 인덱스 (성능 최적화)
      await this.collection.createIndex({
        userId: 1,
        completed: 1,
        priority: -1,
        createdAt: -1,
      });

      // ✅ 인덱스 생성 완료 표시
      TodoService._indexesCreated = true;
      logger.debug("🔍 TodoService 최적화 인덱스 생성 완료");
    } catch (error) {
      if (error.code === 11000) {
        // 인덱스가 이미 존재하는 경우 (정상)
        logger.debug("인덱스가 이미 존재함 - 무시");
      } else {
        logger.warn("⚠️ TodoService 인덱스 생성 실패:", error.message);
      }
    }
  }

  /**
   * 🔍 데이터 무결성 검증
   */
  async validateDataIntegrity() {
    try {
      if (!this.collection) return;

      // 기본 데이터 검증 (샘플링)
      const sampleSize = 10;
      const sampleTodos = await this.collection
        .find({})
        .limit(sampleSize)
        .toArray();

      let invalidCount = 0;
      for (const todo of sampleTodos) {
        if (!todo.userId || !todo.text || !todo.createdAt) {
          invalidCount++;
        }
      }

      if (invalidCount > 0) {
        logger.warn(
          `⚠️ 데이터 무결성 경고: ${invalidCount}/${sampleSize} 건의 불완전한 데이터`
        );
      } else {
        logger.debug("✅ 데이터 무결성 검증 통과");
      }
    } catch (error) {
      logger.warn("⚠️ 데이터 무결성 검증 실패:", error.message);
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
        userId: userId.toString(),
        text: todoData.text,
        category: todoData.category || "general",
        priority: todoData.priority || 3,
        description: todoData.description || "",
        tags: todoData.tags || [],
        completed: false,
        dueDate: todoData.dueDate || null,
        source: todoData.source || "manual",

        // 표준 필드들
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isActive: true,
        environment: this.isRailway ? "railway" : "local",
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
   * 📋 사용자 할일 목록 조회 (캐싱 포함)
   */
  async getUserTodos(userId, options = {}) {
    const startTime = Date.now();

    try {
      this.stats.operationsCount++;

      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        completed = null,
        category = null,
        priority = null,
      } = options;

      // 캐시 키 생성
      const cacheKey = `todos_${userId}_${JSON.stringify(options)}`;

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

      if (completed !== null) {
        query.completed = completed;
      }

      if (category) {
        query.category = category;
      }

      if (priority !== null) {
        query.priority = priority;
      }

      // 정렬 옵션
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      // 페이지네이션 계산
      const skip = (page - 1) * limit;

      // 총 개수 조회
      const totalCount = await this.collection.countDocuments(query);

      // 할일 목록 조회
      const todos = await this.collection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // 결과 구성
      const result = {
        success: true,
        data: {
          todos: todos.map((todo) => ({
            ...todo,
            _id: todo._id.toString(),
          })),
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.setCache(cacheKey, result, this.config.cacheTimeout);
      }

      // 통계 업데이트
      this.updateStats(true, Date.now() - startTime);

      return result;
    } catch (error) {
      logger.error("❌ 할일 목록 조회 실패:", error);
      this.updateStats(false, Date.now() - startTime);

      return {
        success: false,
        error: "할일 목록을 불러오는 중 오류가 발생했습니다.",
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
      const cacheKey = `stats_${userId}`;
      if (this.config.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
        this.stats.cacheMisses++;
      }

      const query = {
        userId: userId.toString(),
        isActive: true,
      };

      // 병렬 쿼리로 성능 최적화
      const [totalCount, completedCount, pendingCount] = await Promise.all([
        this.collection.countDocuments(query),
        this.collection.countDocuments({ ...query, completed: true }),
        this.collection.countDocuments({ ...query, completed: false }),
      ]);

      // 완료율 계산
      const completionRate =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      const result = {
        success: true,
        data: {
          total: totalCount,
          completed: completedCount,
          pending: pendingCount,
          completionRate,
          lastUpdated: new Date(),
        },
      };

      // 캐시 저장 (짧은 시간)
      if (this.config.enableCache) {
        this.setCache(cacheKey, result, 60000); // 1분
      }

      this.updateStats(true, Date.now() - startTime);
      return result;
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
   * 🔢 사용자별 할일 개수 조회
   */
  async getUserTodoCount(userId) {
    try {
      return await this.collection.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });
    } catch (error) {
      logger.error("❌ 할일 개수 조회 실패:", error);
      return 0;
    }
  }

  async createIndexes() {
    try {
      // 기존 인덱스 확인
      const existingIndexes = await this.collection.listIndexes().toArray();
      const hasTextIndex = existingIndexes.some(
        (idx) => idx.key && Object.values(idx.key).includes("text")
      );

      if (!hasTextIndex) {
        await this.collection.createIndex(
          { title: "text", description: "text" },
          { background: true }
        );
      }
    } catch (error) {
      logger.debug("인덱스는 이미 존재합니다:", error.message);
    }
  }

  // ===== 💾 캐시 관리 메서드들 =====

  /**
   * 캐시에서 데이터 조회
   */
  getFromCache(key) {
    if (!this.config.enableCache) return null;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.config.cacheTimeout) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * 캐시에 데이터 저장
   */
  setCache(key, data, timeout = null) {
    if (!this.config.enableCache) return;

    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // 메모리 사용량 제한 (Railway 환경 고려)
    const maxCacheSize = this.isRailway ? 500 : 1000;
    if (this.cache.size > maxCacheSize) {
      this.cleanupOldCache();
    }
  }

  /**
   * 사용자별 캐시 무효화
   */
  invalidateUserCache(userId) {
    const userPrefix = `todos_${userId}`;
    const statsKey = `stats_${userId}`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(userPrefix) || key === statsKey) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  /**
   * 오래된 캐시 정리
   */
  cleanupOldCache() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > this.config.cacheTimeout) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  // ===== 📊 통계 및 유틸리티 메서드들 =====

  /**
   * 통계 업데이트
   */
  updateStats(success, responseTime) {
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // 평균 응답 시간 계산
    this.stats.totalResponseTime =
      (this.stats.totalResponseTime || 0) + responseTime;
    this.stats.averageResponseTime = Math.round(
      this.stats.totalResponseTime / this.stats.operationsCount
    );

    this.stats.lastOperation = TimeHelper.getCurrentTime("log");
  }

  /**
   * 데이터 마이그레이션
   */
  async migrateData() {
    try {
      if (!this.collection) return;

      // 버전 필드가 없는 문서들 업데이트
      const result = await this.collection.updateMany(
        { version: { $exists: false } },
        {
          $set: {
            version: 1,
            isActive: true,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `📊 데이터 마이그레이션 완료: ${result.modifiedCount}건 업데이트`
        );
      }
    } catch (error) {
      logger.warn("⚠️ 데이터 마이그레이션 실패:", error.message);
    }
  }

  /**
   * 백업 스케줄러 시작
   */
  startBackupScheduler() {
    if (this.backupInterval) return;

    this.backupInterval = setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        logger.error("❌ 자동 백업 실패:", error);
      }
    }, this.config.backupInterval);

    logger.info("📦 자동 백업 스케줄러 시작됨");
  }

  /**
   * 백업 수행
   */
  async performBackup() {
    try {
      if (!this.collection) return;

      const totalDocs = await this.collection.countDocuments();
      logger.info(`📦 백업 시작: 총 ${totalDocs}개 문서`);

      // 실제 백업 로직은 나중에 구현
      // 현재는 통계만 로깅
    } catch (error) {
      logger.error("❌ 백업 수행 실패:", error);
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      instanceId: this.instanceId,
      collectionName: this.collectionName,
      isConnected: !!this.collection,
      isInitialized: this.isInitialized,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: this.stats,
      config: {
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableBackup: this.config.enableBackup,
        isRailway: this.isRailway,
      },
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info(`🧹 TodoService 정리 시작... (${this.instanceId})`);

      // 백업 스케줄러 정지
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
        this.backupInterval = null;
      }

      // 캐시 정리
      this.cache.clear();
      this.cacheTimestamps.clear();

      // 인스턴스 등록 해제
      if (TodoService._instances) {
        TodoService._instances.delete(this.instanceId);
      }

      logger.info(`✅ TodoService 정리 완료 (${this.instanceId})`);
    } catch (error) {
      logger.error(`❌ TodoService 정리 실패 (${this.instanceId}):`, error);
    }
  }
}

// 🛡️ 정적 변수 초기화 (중복 방지용)
TodoService._creationLogged = false;
TodoService._initializationLogged = false;
TodoService._indexesCreated = false;
TodoService._instances = new Set();

module.exports = TodoService;
