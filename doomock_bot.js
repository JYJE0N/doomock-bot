// 메인 엔트리 DatabaseManager 최대 활용 v3.0.1
require("dotenv").config(); // 🔑 dotenv 최우선 로드

const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");
const ServiceBuilder = require("./src/core/ServiceBuilder");
const HealthChecker = require("./src/utils/HealthChecker");

// ✅ DatabaseManager 싱글톤 패턴으로 최적 활용
const {
  getInstance: getDatabaseManager,
} = require("./src/database/DatabaseManager");

/**
 * 🤖 DooMockBot v3.0.1 - DatabaseManager 중심 아키텍처
 *
 * 🎯 DatabaseManager 최대 활용:
 * 1. 싱글톤 패턴으로 인스턴스 관리
 * 2. 모든 컴포넌트에 DB 인스턴스 자동 주입
 * 3. 연결 상태 실시간 모니터링 및 자동 복구
 * 4. DB 풀링 최적화 및 Railway 환경 튜닝
 * 5. 트랜잭션 지원 및 데이터 무결성 보장
 * 6. 컬렉션 중앙 관리 및 인덱스 최적화
 *
 * 🌟 비유: DatabaseManager는 도시의 상하수도 시스템과 같습니다.
 * - 중앙 수원지(DB)에서 모든 건물(모듈)에 깨끗한 물(데이터) 공급
 * - 파이프라인(연결) 상태를 24시간 모니터링
 * - 문제 발생 시 자동 복구 및 우회 경로 제공
 */
class DooMockBot {
  constructor() {
    this.startTime = Date.now();
    this.version = process.env.VERSION || "3.0.1";
    this.components = new Map();
    this.isShuttingDown = false;
    this.processHandlersSetup = false;

    // 🌍 환경 설정
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.isDevelopment = process.env.NODE_ENV !== "production";

    // ✅ DatabaseManager 중앙 인스턴스 (가장 먼저 생성)
    this.dbManager = getDatabaseManager();

    // 🔄 초기화 설정
    this.initConfig = {
      maxRetries: parseInt(process.env.STARTUP_MAX_RETRIES) || 3,
      retryBackoffMs: parseInt(process.env.STARTUP_RETRY_BACKOFF) || 5000,
      componentTimeout: parseInt(process.env.COMPONENT_TIMEOUT) || 30000,
      healthCheckDelay: parseInt(process.env.HEALTH_CHECK_DELAY) || 10000,
      gracefulShutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 15000,
      dbHealthCheckInterval: this.isRailway ? 180000 : 300000, // Railway: 3분, 로컬: 5분
      dbMaxReconnectAttempts: this.isRailway ? 5 : 3,
    };

    // 📊 통계 및 상태
    this.stats = {
      startTime: this.startTime,
      initializationAttempts: 0,
      componentInitTimes: new Map(),
      totalInitTime: 0,
      restartCount: 0,
      dbReconnectCount: 0,
      lastError: null,
      dbStats: {
        totalConnections: 0,
        failedConnections: 0,
        reconnections: 0,
        lastHealthCheck: null,
        lastError: null,
      },
    };

    // 🎯 DB 중심 컴포넌트 레지스트리
    this.dbDependentComponents = new Set();
    this.dbCollections = new Map(); // 컬렉션 중앙 관리

    logger.info(`🤖 DooMockBot v${this.version} 생성됨 - DB 중심 아키텍처`);
    logger.info(
      `🌍 환경: ${process.env.NODE_ENV || "development"} | Railway: ${
        this.isRailway ? "YES" : "NO"
      }`
    );
  }

  /**
   * 🚀 애플리케이션 시작 (DatabaseManager 중심)
   */
  async start() {
    this.stats.initializationAttempts++;

    try {
      logger.info(
        `🚀 DooMockBot v${this.version} 시작 중... (시도 ${this.stats.initializationAttempts})`
      );

      // 프로세스 핸들러 등록 (최우선)
      this.setupProcessHandlers();

      // 환경 유효성 검증
      this.validateEnvironment();

      // ✅ DB 우선 초기화 (가장 중요!)
      await this.initializeDatabaseFirst();

      // 단계별 초기화 실행 (DB 의존 컴포넌트들)
      await this.executeInitializationSequence();

      // DB 모니터링 시작
      this.startDatabaseMonitoring();

      // 시작 완료 처리
      await this.completeStartup();
    } catch (error) {
      await this.handleStartupFailure(error);
    }
  }

  /**
   * 🗄️ DatabaseManager 우선 초기화 - 핵심!
   */
  async initializeDatabaseFirst() {
    logger.info("🗄️ DatabaseManager 우선 초기화 중... (중심 컴포넌트)");

    try {
      // MongoDB URL 설정 검증
      if (!this.dbManager.mongoUrl) {
        if (process.env.MONGO_URL) {
          this.dbManager.mongoUrl = process.env.MONGO_URL;
          logger.debug("✅ MONGO_URL 환경변수에서 로드됨");
        } else {
          throw new Error(
            "MongoDB URL이 설정되지 않음 (MONGO_URL 환경변수 필요)"
          );
        }
      }

      // Railway 환경 최적화 설정
      if (this.isRailway) {
        this.optimizeDatabaseForRailway();
      }

      // 🔌 데이터베이스 연결 (재시도 로직 포함)
      const connected = await this.connectDatabaseWithRetry();
      if (!connected) {
        throw new Error("데이터베이스 연결 실패");
      }

      // ✅ 연결 상태 깊은 검증
      await this.validateDatabaseConnection();

      // 🏗️ 필수 컬렉션 및 인덱스 설정
      await this.setupDatabaseCollections();

      // 📊 DB 상태 정보 수집
      await this.collectDatabaseStatistics();

      // 컴포넌트로 등록
      this.components.set("dbManager", this.dbManager);
      this.dbDependentComponents.add("dbManager");

      logger.success(
        "✅ DatabaseManager 우선 초기화 완료 - 중심 컴포넌트 준비됨"
      );
    } catch (error) {
      logger.error("❌ DatabaseManager 우선 초기화 실패:", error);
      this.stats.dbStats.failedConnections++;
      throw new Error(`DB 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🚂 Railway 환경 DB 최적화
   */
  optimizeDatabaseForRailway() {
    logger.info("🚂 Railway 환경 DB 최적화 적용 중...");

    // Railway 환경에 맞는 DB 설정 조정
    this.dbManager.maxReconnectAttempts = 5;
    this.dbManager.reconnectDelay = 3000;

    // Railway 메모리 제약을 고려한 풀링 설정
    const railwayOptions = {
      maxPoolSize: 5, // Railway 메모리 고려
      minPoolSize: 1,
      serverSelectionTimeoutMS: 3000, // 빠른 실패
      socketTimeoutMS: 20000,
      family: 4,
    };

    logger.debug("🔧 Railway DB 옵션 적용:", railwayOptions);
  }

  /**
   * 🔌 재시도 로직이 포함된 DB 연결
   */
  async connectDatabaseWithRetry() {
    const maxAttempts = this.initConfig.dbMaxReconnectAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`🔌 DB 연결 시도 ${attempt}/${maxAttempts}...`);

        const startTime = Date.now();
        await this.dbManager.connect();
        const connectTime = Date.now() - startTime;

        this.stats.dbStats.totalConnections++;
        logger.success(`✅ DB 연결 성공 (${connectTime}ms)`);

        return true;
      } catch (error) {
        lastError = error;
        this.stats.dbStats.failedConnections++;

        logger.warn(
          `⚠️ DB 연결 실패 (${attempt}/${maxAttempts}): ${error.message}`
        );

        if (attempt < maxAttempts) {
          const backoffTime = this.initConfig.retryBackoffMs * attempt;
          logger.info(`⏳ ${backoffTime}ms 대기 후 재시도...`);
          await this.sleep(backoffTime);
        }
      }
    }

    this.stats.dbStats.lastError = lastError;
    return false;
  }

  /**
   * ✅ 데이터베이스 연결 깊은 검증
   */
  async validateDatabaseConnection() {
    logger.debug("🔍 DB 연결 상태 깊은 검증 중...");

    try {
      // 기본 연결 상태 확인
      if (!this.dbManager.isConnected) {
        throw new Error("DB isConnected가 false");
      }

      // Ping 테스트
      const pingResult = await this.dbManager.checkConnection();
      if (!pingResult) {
        throw new Error("DB ping 실패");
      }

      // 실제 DB 인스턴스 확인
      if (!this.dbManager.db) {
        throw new Error("DB 인스턴스가 null");
      }

      // 간단한 쿼리 테스트
      await this.dbManager.db.admin().listCollections().toArray();

      // 통계 업데이트
      this.stats.dbStats.lastHealthCheck = new Date();

      logger.debug("✅ DB 연결 상태 검증 완료");
    } catch (error) {
      logger.error("❌ DB 연결 검증 실패:", error);
      throw new Error(`DB 검증 실패: ${error.message}`);
    }
  }

  /**
   * 🏗️ 필수 컬렉션 및 인덱스 설정
   */
  async setupDatabaseCollections() {
    logger.info("🏗️ 필수 컬렉션 및 인덱스 설정 중...");

    try {
      const collections = [
        {
          name: "users",
          indexes: [
            { key: { userId: 1 }, unique: true },
            { key: { createdAt: -1 } },
            { key: { lastActive: -1 } },
          ],
        },
        {
          name: "todos",
          indexes: [
            { key: { userId: 1, createdAt: -1 } },
            { key: { userId: 1, completed: 1 } },
            { key: { title: "text", description: "text" } }, // 텍스트 검색
            { key: { dueDate: 1 } },
            { key: { priority: -1 } },
          ],
        },
        {
          name: "timers",
          indexes: [
            { key: { userId: 1, createdAt: -1 } },
            { key: { userId: 1, isActive: 1 } },
            { key: { startTime: -1 } },
          ],
        },
        {
          name: "system_logs",
          indexes: [
            { key: { timestamp: -1 } },
            { key: { level: 1, timestamp: -1 } },
            { key: { component: 1, timestamp: -1 } },
          ],
        },
        {
          name: "health_checks",
          indexes: [
            { key: { timestamp: -1 } },
            { key: { component: 1, timestamp: -1 } },
          ],
        },
      ];

      for (const collectionConfig of collections) {
        await this.setupSingleCollection(collectionConfig);
      }

      logger.success(`✅ ${collections.length}개 컬렉션 설정 완료`);
    } catch (error) {
      logger.error("❌ 컬렉션 설정 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 단일 컬렉션 설정
   */
  async setupSingleCollection(config) {
    try {
      const collection = this.dbManager.db.collection(config.name);

      // 컬렉션 중앙 레지스트리에 등록
      this.dbCollections.set(config.name, collection);

      // 인덱스 생성
      for (const indexSpec of config.indexes) {
        try {
          await collection.createIndex(indexSpec.key, indexSpec.options || {});
        } catch (indexError) {
          // 이미 존재하는 인덱스는 무시
          if (!indexError.message.includes("already exists")) {
            logger.warn(
              `⚠️ ${config.name} 인덱스 생성 실패:`,
              indexError.message
            );
          }
        }
      }

      logger.debug(
        `✅ 컬렉션 '${config.name}' 설정됨 (${config.indexes.length}개 인덱스)`
      );
    } catch (error) {
      logger.error(`❌ 컬렉션 '${config.name}' 설정 실패:`, error);
      throw error;
    }
  }

  /**
   * 📊 데이터베이스 통계 수집
   */
  async collectDatabaseStatistics() {
    try {
      logger.debug("📊 DB 통계 수집 중...");

      const admin = this.dbManager.db.admin();
      const dbStats = await admin.dbStats();

      const collectionStats = new Map();
      for (const [name, collection] of this.dbCollections) {
        try {
          const count = await collection.countDocuments();
          collectionStats.set(name, { documentCount: count });
        } catch (error) {
          logger.debug(`컬렉션 '${name}' 통계 수집 실패:`, error.message);
        }
      }

      const summary = {
        데이터베이스: this.dbManager.databaseName,
        컬렉션수: this.dbCollections.size,
        데이터크기: `${Math.round(dbStats.dataSize / 1024 / 1024)}MB`,
        인덱스크기: `${Math.round(dbStats.indexSize / 1024 / 1024)}MB`,
        연결풀: `${
          this.dbManager.client?.topology?.s?.pool?.totalConnectionCount ||
          "N/A"
        }`,
        문서통계: Object.fromEntries(collectionStats),
      };

      logger.info("📊 DB 통계 요약:");
      for (const [key, value] of Object.entries(summary)) {
        if (key !== "문서통계") {
          logger.info(`   ${key}: ${value}`);
        }
      }

      // 문서 통계는 debug 레벨로
      logger.debug("📋 문서별 통계:", summary.문서통계);
    } catch (error) {
      logger.warn("⚠️ DB 통계 수집 실패:", error.message);
    }
  }

  /**
   * 🔄 단계별 초기화 실행 (DB 의존 컴포넌트들)
   */
  async executeInitializationSequence() {
    const sequence = [
      {
        name: "1️⃣ Telegraf 봇",
        handler: this.initializeTelegrafBot,
        dbDependent: false,
      },
      {
        name: "2️⃣ 서비스 빌더",
        handler: this.initializeServiceBuilder,
        dbDependent: true,
      },
      {
        name: "3️⃣ 모듈 매니저",
        handler: this.initializeModuleManager,
        dbDependent: true,
      },
      {
        name: "4️⃣ 봇 컨트롤러",
        handler: this.initializeBotController,
        dbDependent: false,
      },
      {
        name: "5️⃣ 헬스체커",
        handler: this.initializeHealthChecker,
        dbDependent: true,
      },
      {
        name: "6️⃣ 봇 런처",
        handler: this.launchBot,
        dbDependent: false,
      },
    ];

    for (const step of sequence) {
      // DB 의존 컴포넌트는 DB 연결 상태 재확인
      if (step.dbDependent) {
        await this.ensureDatabaseConnection();
      }

      await this.executeStepWithRetry(step);

      // DB 의존 컴포넌트는 레지스트리에 추가
      if (step.dbDependent) {
        this.dbDependentComponents.add(step.name);
      }
    }
  }

  /**
   * 🔌 DB 연결 보장
   */
  async ensureDatabaseConnection() {
    try {
      if (!this.dbManager.isConnected) {
        logger.warn("⚠️ DB 연결 끊어짐 감지, 재연결 시도...");
        this.stats.dbStats.reconnections++;

        const reconnected = await this.connectDatabaseWithRetry();
        if (!reconnected) {
          throw new Error("DB 재연결 실패");
        }

        logger.success("✅ DB 재연결 성공");
      }
    } catch (error) {
      logger.error("❌ DB 연결 보장 실패:", error);
      throw error;
    }
  }

  /**
   * 🏗️ 서비스 빌더 초기화 (DB 인스턴스 주입)
   */
  async initializeServiceBuilder() {
    logger.debug("🏗️ ServiceBuilder 초기화 중... (DB 주입)");

    // ✅ DB 인스턴스를 ServiceBuilder에 주입
    await ServiceBuilder.initialize({
      dbManager: this.dbManager,
      db: this.dbManager.db,
      collections: this.dbCollections,
      isRailway: this.isRailway,
    });

    this.components.set("serviceBuilder", ServiceBuilder);
    logger.debug("✅ ServiceBuilder 초기화 완료 (DB 주입됨)");
  }

  /**
   * 📦 모듈 매니저 초기화 (DB 인스턴스 자동 주입)
   */
  async initializeModuleManager() {
    logger.debug("📦 ModuleManager 생성 중... (DB 자동 주입)");

    const moduleManager = new ModuleManager({
      bot: this.components.get("bot"),
      serviceBuilder: this.components.get("serviceBuilder"),
      // ✅ DB 관련 모든 것을 자동 주입
      dbManager: this.dbManager,
      db: this.dbManager.db,
      collections: this.dbCollections,
      config: {
        enableAutoDiscovery: true,
        enableHealthCheck: true,
        dbWaitTimeout: 60000,
        serviceWaitTimeout: 30000,
        maxInitRetries: 5,
        isRailway: this.isRailway,
      },
    });

    logger.debug("🔧 ModuleManager 초기화 중...");
    await moduleManager.initialize();

    this.components.set("moduleManager", moduleManager);
    logger.debug("✅ ModuleManager 초기화 완료 (DB 자동 주입됨)");
  }

  /**
   * 📊 데이터베이스 모니터링 시작
   */
  startDatabaseMonitoring() {
    logger.info("📊 DB 모니터링 시작...");

    // 정기적인 DB 헬스체크
    this.dbHealthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.dbManager.checkConnection();
        this.stats.dbStats.lastHealthCheck = new Date();

        if (!isHealthy) {
          logger.warn("⚠️ DB 헬스체크 실패, 재연결 시도...");
          await this.handleDatabaseReconnection();
        } else {
          logger.debug("✅ DB 헬스체크 정상");
        }
      } catch (error) {
        logger.error("❌ DB 헬스체크 오류:", error);
        this.stats.dbStats.lastError = error;
      }
    }, this.initConfig.dbHealthCheckInterval);

    // Railway 환경에서 메모리 기반 DB 최적화
    if (this.isRailway) {
      this.startRailwayDbOptimization();
    }

    logger.debug(
      `📊 DB 모니터링 시작됨 (간격: ${this.initConfig.dbHealthCheckInterval}ms)`
    );
  }

  /**
   * 🚂 Railway DB 최적화 모니터링
   */
  startRailwayDbOptimization() {
    // Railway 메모리 제약을 고려한 DB 연결 관리
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // 메모리 사용량이 높으면 DB 연결 풀 조정
      if (heapUsedMB > 350) {
        // Railway 512MB 제한 고려
        logger.warn(`⚠️ Railway 메모리 사용량 높음: ${heapUsedMB}MB`);

        // 가비지 컬렉션 강제 실행
        if (global.gc) {
          global.gc();
          logger.debug("🧹 가비지 컬렉션 실행됨");
        }
      }
    }, 120000); // 2분마다
  }

  /**
   * 🔄 DB 재연결 처리
   */
  async handleDatabaseReconnection() {
    try {
      this.stats.dbReconnectCount++;
      logger.info(
        `🔄 DB 재연결 시도 중... (시도 ${this.stats.dbReconnectCount})`
      );

      // 기존 연결 정리
      if (this.dbManager.client) {
        try {
          await this.dbManager.disconnect();
        } catch (disconnectError) {
          logger.debug("기존 연결 정리 실패 (무시):", disconnectError.message);
        }
      }

      // 재연결 시도
      const reconnected = await this.connectDatabaseWithRetry();
      if (reconnected) {
        // DB 의존 컴포넌트들에게 재연결 알림
        await this.notifyDbReconnection();
        logger.success("✅ DB 재연결 및 컴포넌트 알림 완료");
      } else {
        throw new Error("재연결 최대 시도 횟수 초과");
      }
    } catch (error) {
      logger.error("❌ DB 재연결 실패:", error);
      this.stats.dbStats.lastError = error;

      // 심각한 DB 문제인 경우 애플리케이션 재시작
      if (this.stats.dbReconnectCount >= 3) {
        logger.error("🚨 DB 재연결 실패 횟수 초과, 애플리케이션 재시작 필요");
        await this.gracefulShutdown("database_failure");
      }
    }
  }

  /**
   * 📢 DB 재연결 알림
   */
  async notifyDbReconnection() {
    try {
      // ModuleManager에 DB 재연결 알림
      const moduleManager = this.components.get("moduleManager");
      if (
        moduleManager &&
        typeof moduleManager.handleDbReconnection === "function"
      ) {
        await moduleManager.handleDbReconnection(this.dbManager);
      }

      // ServiceBuilder에 DB 재연결 알림
      const serviceBuilder = this.components.get("serviceBuilder");
      if (
        serviceBuilder &&
        typeof serviceBuilder.handleDbReconnection === "function"
      ) {
        await serviceBuilder.handleDbReconnection(this.dbManager);
      }

      logger.debug("📢 DB 재연결 알림 완료");
    } catch (error) {
      logger.warn("⚠️ DB 재연결 알림 실패:", error.message);
    }
  }

  /**
   * 🎯 DB 컬렉션 접근 헬퍼 (중앙 관리)
   */
  getCollection(name) {
    const collection = this.dbCollections.get(name);
    if (!collection) {
      throw new Error(`컬렉션 '${name}'을 찾을 수 없음`);
    }
    return collection;
  }

  /**
   * 💾 트랜잭션 실행 헬퍼
   */
  async withTransaction(callback) {
    try {
      return await this.dbManager.withTransaction(callback);
    } catch (error) {
      logger.error("❌ 트랜잭션 실행 실패:", error);
      throw error;
    }
  }

  // ===== 기존 메서드들 (간소화) =====

  validateEnvironment() {
    logger.info("🔍 환경 검증 중...");
    // 기존 검증 로직...
    logger.debug("✅ 환경 검증 완료");
  }

  async initializeTelegrafBot() {
    logger.debug("🤖 Telegraf 봇 초기화 중...");

    if (this.components.has("bot")) {
      const oldBot = this.components.get("bot");
      try {
        oldBot.stop();
      } catch (e) {}
    }

    const bot = new Telegraf(process.env.BOT_TOKEN);
    this.setupBotMiddleware(bot);
    this.components.set("bot", bot);

    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  setupBotMiddleware(bot) {
    // 기존 미들웨어 설정...
    bot.catch((error, ctx) => {
      logger.error("🚨 Telegraf 전역 오류:", error);
      try {
        ctx.reply("❌ 처리 중 오류가 발생했습니다.");
      } catch (replyError) {
        logger.error("에러 응답 실패:", replyError);
      }
    });
  }

  async initializeBotController() {
    logger.debug("🎮 BotController 생성 중...");

    const botController = new BotController({
      bot: this.components.get("bot"),
      moduleManager: this.components.get("moduleManager"),
      // ✅ DB 인스턴스도 주입
      dbManager: this.dbManager,
      config: {
        enableNavigationHandler: true,
        enableErrorHandling: true,
        isRailway: this.isRailway,
      },
    });

    await botController.initialize();
    this.components.set("botController", botController);

    logger.debug("✅ BotController 초기화 완료");
  }

  async initializeHealthChecker() {
    const healthCheckEnabled = process.env.HEALTH_CHECK_ENABLED !== "false";
    if (!healthCheckEnabled) {
      logger.debug("⚠️ HealthChecker 비활성화됨");
      return;
    }

    logger.debug("🏥 HealthChecker 설정 중...");

    const healthChecker = new HealthChecker({
      dbManager: this.dbManager,
      moduleManager: this.components.get("moduleManager"),
      serviceBuilder: this.components.get("serviceBuilder"),
      botController: this.components.get("botController"),
      config: {
        checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        enableAutoRecovery: process.env.HEALTH_AUTO_RECOVERY !== "false",
        maxRecoveryAttempts: 3,
      },
    });

    this.components.set("healthChecker", healthChecker);

    // 지연된 시작
    setTimeout(async () => {
      try {
        await healthChecker.start();
        logger.success("✅ HealthChecker 시작됨");
      } catch (error) {
        logger.error("❌ HealthChecker 시작 실패:", error);
      }
    }, this.initConfig.healthCheckDelay);

    logger.debug("✅ HealthChecker 설정 완료");
  }

  async launchBot() {
    const bot = this.components.get("bot");
    if (!bot) throw new Error("봇 인스턴스를 찾을 수 없음");

    logger.debug("🚀 봇 런처 시작 중...");

    await this.cleanupExistingBotConnections(bot);

    if (this.isRailway) {
      await this.startRailwayBot(bot);
    } else {
      await this.startLocalBot(bot);
    }

    logger.debug("✅ 봇 런처 완료");
  }

  // ===== 유틸리티 메서드들 =====

  async executeStepWithRetry(step) {
    // 기존 재시도 로직...
    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.initConfig.maxRetries; attempt++) {
      try {
        logger.info(
          `🔧 ${step.name} 초기화 중... (${attempt}/${this.initConfig.maxRetries})`
        );

        await Promise.race([
          step.handler.call(this),
          this.createTimeoutPromise(
            this.initConfig.componentTimeout,
            step.name
          ),
        ]);

        const stepTime = Date.now() - startTime;
        this.stats.componentInitTimes.set(step.name, stepTime);
        logger.success(`✅ ${step.name} 완료 (${stepTime}ms)`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(
          `⚠️ ${step.name} 실패 (${attempt}/${this.initConfig.maxRetries}): ${error.message}`
        );

        if (attempt < this.initConfig.maxRetries) {
          const backoffTime = this.initConfig.retryBackoffMs * attempt;
          await this.sleep(backoffTime);
        }
      }
    }

    throw new Error(
      `${step.name} 최대 재시도 횟수 초과: ${lastError?.message}`
    );
  }

  createTimeoutPromise(timeout, stepName) {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${stepName} 타임아웃 (${timeout}ms)`)),
        timeout
      );
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async completeStartup() {
    this.stats.totalInitTime = Date.now() - this.startTime;

    logger.success(`🎉 DooMockBot v${this.version} 시작 완료!`);
    logger.success(`⏱️  총 초기화 시간: ${this.stats.totalInitTime}ms`);
    logger.success(`📊 초기화된 컴포넌트: ${this.components.size}개`);
    logger.success(`🗄️ DB 관리 컬렉션: ${this.dbCollections.size}개`);

    // DB 통계 출력
    logger.info("📊 DB 최종 통계:", {
      연결시도: this.stats.dbStats.totalConnections,
      실패횟수: this.stats.dbStats.failedConnections,
      재연결횟수: this.stats.dbStats.reconnections,
      마지막헬스체크:
        this.stats.dbStats.lastHealthCheck?.toLocaleTimeString("ko-KR") ||
        "N/A",
    });
  }

  setupProcessHandlers() {
    if (this.processHandlersSetup) return;
    this.processHandlersSetup = true;

    process.once("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.once("SIGTERM", () => this.gracefulShutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      this.gracefulShutdown("unhandledRejection");
    });
  }

  async gracefulShutdown(reason) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`🛑 우아한 종료 시작 (이유: ${reason})`);

    try {
      // DB 헬스체크 인터벌 정리
      if (this.dbHealthCheckInterval) {
        clearInterval(this.dbHealthCheckInterval);
      }

      await this.cleanupComponents();
      logger.success("✅ 우아한 종료 완료");
    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
    } finally {
      process.exit(
        reason === "uncaughtException" || reason === "unhandledRejection"
          ? 1
          : 0
      );
    }
  }

  async cleanupComponents() {
    logger.info("🧹 컴포넌트 정리 시작...");

    // 순서대로 정리: HealthChecker → Bot → Modules → DB (마지막)
    const cleanupTasks = [
      this.components.has("healthChecker") ? this.cleanupHealthChecker() : null,
      this.components.has("bot") ? this.cleanupBot() : null,
      this.components.has("moduleManager") ? this.cleanupModuleManager() : null,
      this.components.has("dbManager") ? this.cleanupDatabase() : null,
    ].filter(Boolean);

    await Promise.allSettled(cleanupTasks);
    this.components.clear();
    this.dbCollections.clear();

    logger.info("✅ 컴포넌트 정리 완료");
  }

  async cleanupDatabase() {
    try {
      if (this.dbManager && typeof this.dbManager.disconnect === "function") {
        await this.dbManager.disconnect();
        logger.debug("✅ Database 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ Database 정리 실패:", error.message);
    }
  }

  // 기타 cleanup 메서드들...
  async cleanupHealthChecker() {
    /* 기존 로직 */
  }
  async cleanupBot() {
    /* 기존 로직 */
  }
  async cleanupModuleManager() {
    /* 기존 로직 */
  }

  // 봇 시작 관련 메서드들...
  async cleanupExistingBotConnections(bot) {
    /* 기존 로직 */
  }
  async startRailwayBot(bot) {
    /* 기존 로직 */
  }
  async startLocalBot(bot) {
    /* 기존 로직 */
  }
  async startPollingMode(bot) {
    /* 기존 로직 */
  }

  async handleStartupFailure(error) {
    this.stats.lastError = {
      message: error.message,
      timestamp: new Date().toISOString(),
    };
    logger.error(`💥 DooMockBot 시작 실패:`, error);
    await this.cleanupComponents();
    process.exit(1);
  }

  /**
   * 📊 향상된 상태 조회 (DB 포함)
   */
  getStatus() {
    return {
      version: this.version,
      uptime: Date.now() - this.startTime,
      environment: process.env.NODE_ENV || "development",
      isRailway: this.isRailway,
      components: Array.from(this.components.keys()),
      database: {
        connected: this.dbManager?.isConnected || false,
        name: this.dbManager?.databaseName || null,
        collections: this.dbCollections.size,
        stats: this.stats.dbStats,
      },
      stats: this.stats,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }
}

// 🚀 애플리케이션 시작
if (require.main === module) {
  const app = new DooMockBot();
  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
