// src/services/TodoService.js - 컬렉션 연결 문제 해결 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const ValidationHelper = require("../utils/ValidationHelper");
const DatabaseManager = require("../core/DatabaseManager");

/**
 * 📝 TodoService v3.0.1 - 컬렉션 연결 문제 해결
 *
 * 🎯 해결된 문제들:
 * 1. 컬렉션 연결 타이밍 문제
 * 2. 중복 인스턴스 생성 방지
 * 3. DB 연결 대기 로직 추가
 * 4. 안전한 재시도 메커니즘
 * 5. 컬렉션 상태 모니터링
 */
class TodoService {
  constructor(options = {}) {
    // 🔒 중복 인스턴스 생성 방지
    const instanceId = `TodoService_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.instanceId = instanceId;

    if (TodoService._instances && TodoService._instances.size > 0) {
      const existingInstance = Array.from(TodoService._instances)[0];
      logger.warn(
        `⚠️ TodoService 인스턴스 이미 존재 - 기존 인스턴스 사용: ${existingInstance.instanceId}`
      );
      return existingInstance;
    }

    // 인스턴스 등록
    if (!TodoService._instances) {
      TodoService._instances = new Set();
    }
    TodoService._instances.add(this);

    // 🗄️ 데이터베이스 관련
    this.db = options.db || null;
    this.collection = null;
    this.dbManager = null;

    // ⚙️ 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 100,
      enableCache: process.env.TODO_CACHE_ENABLED !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      enableBackup: process.env.TODO_BACKUP_ENABLED === "true",
      backupInterval: parseInt(process.env.TODO_BACKUP_INTERVAL) || 3600000, // 1시간
      collectionName: process.env.TODO_COLLECTION_NAME || "todos",
      // 🔧 새로운 설정들 - 연결 문제 해결용
      connectionTimeout: parseInt(process.env.TODO_CONNECTION_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.TODO_MAX_RETRIES) || 5,
      retryBackoffMs: parseInt(process.env.TODO_RETRY_BACKOFF) || 1000,
      healthCheckInterval:
        parseInt(process.env.TODO_HEALTH_CHECK_INTERVAL) || 60000,
      ...options,
    };

    // 📊 캐시 시스템
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // 📊 통계
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastActivity: null,
      connectionAttempts: 0,
      reconnections: 0,
    };

    // 🔄 상태 관리 (강화됨)
    this.isInitialized = false;
    this.isInitializing = false;
    this.connectionRetries = 0;
    this.lastConnectionAttempt = null;

    // 🧹 백업 및 정리 스케줄러
    this.backupInterval = null;
    this.healthCheckInterval = null;

    // 🌍 Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    logger.info(
      `📝 TodoService v3.0.1 생성됨 (${instanceId}) - 연결 문제 해결`
    );
  }

  /**
   * 🎯 서비스 초기화 (안전한 연결 확립)
   */
  async initialize() {
    // 중복 초기화 완전 차단
    if (this.isInitialized) {
      logger.debug(`✅ TodoService 이미 초기화 완료됨 (${this.instanceId})`);
      return true;
    }

    if (this.isInitializing) {
      logger.debug(`🔄 TodoService 초기화 진행 중 - 대기 (${this.instanceId})`);
      return await this.waitForInitialization();
    }

    this.isInitializing = true;

    try {
      logger.info(`📝 TodoService 안전 초기화 시작... (${this.instanceId})`);

      // 🛡️ 안전한 초기화 with 재시도
      await this.safeInitializeWithRetry();

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 📊 백업 스케줄러 시작
      if (this.config.enableBackup) {
        this.startBackupScheduler();
      }

      // 🏥 헬스체크 스케줄러 시작
      this.startHealthCheckScheduler();

      logger.success(`✅ TodoService 초기화 완료 (${this.instanceId})`);
      return true;
    } catch (error) {
      logger.error(`❌ TodoService 초기화 실패 (${this.instanceId}):`, error);
      this.stats.failedOperations++;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 🛡️ 안전한 초기화 with 백오프 재시도
   */
  async safeInitializeWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.stats.connectionAttempts++;
        this.lastConnectionAttempt = Date.now();

        logger.info(
          `🔄 TodoService 연결 시도 ${attempt}/${this.config.maxRetries}`
        );

        // 단계별 초기화
        await this.initializeStep1_Database();
        await this.initializeStep2_Collection();
        await this.initializeStep3_Indexes();
        await this.initializeStep4_Validation();

        logger.success(`✅ TodoService 연결 성공 (${attempt}번째 시도)`);
        return; // 성공하면 바로 반환
      } catch (error) {
        lastError = error;
        this.connectionRetries++;

        logger.warn(
          `⚠️ TodoService 연결 실패 (${attempt}/${this.config.maxRetries}): ${error.message}`
        );

        if (attempt < this.config.maxRetries) {
          const backoffTime = this.config.retryBackoffMs * attempt;
          logger.info(`⏳ ${backoffTime}ms 대기 후 재시도...`);
          await this.sleep(backoffTime);
        }
      }
    }

    throw new Error(
      `TodoService 연결 최대 재시도 횟수 초과: ${lastError?.message}`
    );
  }

  /**
   * 🔧 1단계: 데이터베이스 연결 확인
   */
  async initializeStep1_Database() {
    logger.debug("🔧 1단계: 데이터베이스 연결 확인");

    // DB 인스턴스 확보 (여러 방식 시도)
    await this.ensureDatabaseConnection();

    // DB 연결 상태 확인
    if (!this.db) {
      throw new Error("데이터베이스 연결을 찾을 수 없음");
    }

    logger.debug("✅ 1단계 완료: 데이터베이스 연결 확인됨");
  }

  /**
   * 🗄️ 2단계: 컬렉션 연결 확립
   */
  async initializeStep2_Collection() {
    logger.debug("🗄️ 2단계: 컬렉션 연결 확립");

    try {
      // 컬렉션 연결
      this.collection = this.db.collection(this.config.collectionName);

      // 컬렉션 존재 확인 (간단한 쿼리로)
      await this.collection.findOne({}, { _id: 1 });

      logger.debug(`✅ 컬렉션 연결 성공: ${this.config.collectionName}`);
    } catch (error) {
      logger.error(`❌ 컬렉션 연결 실패: ${error.message}`);
      throw new Error(`컬렉션 연결 실패: ${error.message}`);
    }

    logger.debug("✅ 2단계 완료: 컬렉션 연결 확립됨");
  }

  /**
   * 📑 3단계: 인덱스 생성 확인
   */
  async initializeStep3_Indexes() {
    logger.debug("📑 3단계: 인덱스 생성 확인");

    try {
      // 인덱스 생성 (중복 방지)
      if (!TodoService._indexesCreated) {
        await this.createIndexes();
        TodoService._indexesCreated = true;
      }
    } catch (error) {
      logger.warn(`⚠️ 인덱스 생성 실패 (계속 진행): ${error.message}`);
      // 인덱스 실패는 치명적이지 않으므로 계속 진행
    }

    logger.debug("✅ 3단계 완료: 인덱스 확인됨");
  }

  /**
   * ✅ 4단계: 검증 시스템 확인
   */
  async initializeStep4_Validation() {
    logger.debug("✅ 4단계: 검증 시스템 확인");

    try {
      // ValidationHelper 확인
      if (ValidationHelper && typeof ValidationHelper.validate === "function") {
        logger.debug("✅ ValidationHelper 준비됨");
      } else {
        logger.warn("⚠️ ValidationHelper를 찾을 수 없음 - 기본 검증 사용");
      }
    } catch (error) {
      logger.warn(`⚠️ 검증 시스템 확인 실패: ${error.message}`);
    }

    logger.debug("✅ 4단계 완료: 검증 시스템 확인됨");
  }

  /**
   * 🗄️ 데이터베이스 연결 확보 (여러 방식 시도)
   */
  async ensureDatabaseConnection() {
    const timeout = this.config.connectionTimeout;
    const startTime = Date.now();

    logger.debug("🗄️ 데이터베이스 연결 확보 시도...");

    while (Date.now() - startTime < timeout) {
      try {
        // 1. 기존 DB 인스턴스 확인
        if (this.db && (await this.testDbConnection(this.db))) {
          logger.debug("✅ 기존 DB 인스턴스 사용");
          return;
        }

        // 2. DatabaseManager를 통한 연결 시도
        const dbManager = this.getDatabaseManager();
        if (dbManager && dbManager.isConnected && dbManager.isConnected()) {
          this.db = dbManager.getDatabase();
          this.dbManager = dbManager;

          if (await this.testDbConnection(this.db)) {
            logger.debug("✅ DatabaseManager를 통한 연결 성공");
            return;
          }
        }

        // 3. 전역 DB 인스턴스 확인
        if (global.db && (await this.testDbConnection(global.db))) {
          this.db = global.db;
          logger.debug("✅ 전역 DB 인스턴스 사용");
          return;
        }

        // 잠시 대기 후 재시도
        await this.sleep(1000);
      } catch (error) {
        logger.debug(`🔄 DB 연결 시도 중: ${error.message}`);
        await this.sleep(2000);
      }
    }

    throw new Error(`데이터베이스 연결 대기 시간 초과 (${timeout}ms)`);
  }

  /**
   * 🧪 DB 연결 테스트
   */
  async testDbConnection(db) {
    try {
      if (!db) return false;

      // admin 명령으로 연결 테스트
      await db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🔍 DatabaseManager 가져오기
   */
  getDatabaseManager() {
    const candidates = [this.dbManager, global.dbManager, DatabaseManager];

    for (const candidate of candidates) {
      if (candidate && typeof candidate.isConnected === "function") {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 📑 인덱스 생성
   */
  async createIndexes() {
    try {
      logger.debug(`📑 TodoService 인덱스 생성 중... (${this.instanceId})`);

      const indexes = [
        { userId: 1, createdAt: -1 }, // 사용자별 최신순
        { userId: 1, completed: 1 }, // 사용자별 완료 상태
        { userId: 1, priority: -1 }, // 사용자별 우선순위
        { searchIndex: "text" }, // 텍스트 검색
      ];

      for (const index of indexes) {
        try {
          await this.collection.createIndex(index);
        } catch (indexError) {
          logger.debug(`인덱스 생성 중 경고: ${indexError.message}`);
        }
      }

      logger.debug(`✅ TodoService 인덱스 생성 완료 (${this.instanceId})`);
    } catch (error) {
      logger.error(`❌ 인덱스 생성 실패 (${this.instanceId}):`, error);
      throw error;
    }
  }

  /**
   * 🏥 헬스체크 스케줄러 시작
   */
  startHealthCheckScheduler() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.warn(`⚠️ TodoService 헬스체크 실패: ${error.message}`);
      }
    }, this.config.healthCheckInterval);

    logger.debug("🏥 TodoService 헬스체크 스케줄러 시작됨");
  }

  /**
   * 🏥 헬스체크 수행
   */
  async performHealthCheck() {
    try {
      // 컬렉션 연결 확인
      if (!this.collection) {
        throw new Error("컬렉션이 연결되지 않음");
      }

      // 간단한 쿼리로 연결 테스트
      await this.collection.findOne({}, { _id: 1 });

      // DB 연결 상태 확인
      if (this.db) {
        await this.db.admin().ping();
      }

      logger.debug(`💚 TodoService 헬스체크 통과 (${this.instanceId})`);
      return { healthy: true };
    } catch (error) {
      logger.warn(
        `💔 TodoService 헬스체크 실패 (${this.instanceId}): ${error.message}`
      );

      // 재연결 시도
      try {
        await this.attemptReconnection();
      } catch (reconnectError) {
        logger.error(`❌ 재연결 실패: ${reconnectError.message}`);
      }

      return { healthy: false, error: error.message };
    }
  }

  /**
   * 🔄 재연결 시도
   */
  async attemptReconnection() {
    logger.info(`🔄 TodoService 재연결 시도... (${this.instanceId})`);

    this.stats.reconnections++;
    this.isInitialized = false;
    this.collection = null;

    await this.initialize();

    logger.success(`✅ TodoService 재연결 성공 (${this.instanceId})`);
  }

  /**
   * 🛡️ 초기화 완료 대기
   */
  async waitForInitialization(timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isInitialized) {
        return true;
      }

      if (!this.isInitializing) {
        return false;
      }

      await this.sleep(100);
    }

    throw new Error("TodoService 초기화 대기 시간 초과");
  }

  /**
   * 💤 Sleep 헬퍼
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 🏥 헬스체크 (외부 호출용)
   */
  async healthCheck() {
    return {
      healthy: this.isInitialized && !!this.collection,
      initialized: this.isInitialized,
      hasCollection: !!this.collection,
      hasDb: !!this.db,
      stats: this.stats,
      instanceId: this.instanceId,
    };
  }

  // ... 나머지 기존 메서드들 (CRUD 등) 유지 ...

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info(`🧹 TodoService 정리 시작... (${this.instanceId})`);

      // 스케줄러들 정지
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
        this.backupInterval = null;
      }

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // 캐시 정리
      this.cache.clear();
      this.cacheTimestamps.clear();

      // 인스턴스 등록 해제
      if (TodoService._instances) {
        TodoService._instances.delete(this);
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
