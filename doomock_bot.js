// doomock_bot.js - 완전 리팩토링 v3.0.1
require("dotenv").config(); // 🔑 dotenv는 최우선으로 로드

const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");
const TimeHelper = require("./src/utils/TimeHelper");

// 🏗️ 핵심 시스템들 (필요한 imports 추가)
const BotController = require("./src/core/BotController");
const ModuleManager = require("./src/core/ModuleManager");
const ServiceBuilder = require("./src/core/ServiceBuilder");
const DatabaseManager = require("./src/core/DatabaseManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

// 📊 설정 관리 (AppConfig 호환)
// const AppConfig = require("./src/config/AppConfig");

/**
 * 🤖 DooMockBot v3.0.1 - 완전 리팩토링
 *
 * 🎯 주요 개선사항:
 * 1. ApplicationBootstrap 패턴 적용
 * 2. 단계별 초기화 시스템
 * 3. 안전한 재시도 메커니즘
 * 4. Railway 환경 최적화
 * 5. 메모리 효율성 개선
 * 6. 우아한 종료 처리
 */
class DooMockBot {
  constructor() {
    this.startTime = Date.now();
    this.version = AppConfig.VERSION || "3.0.1";
    this.components = new Map();
    this.isShuttingDown = false;
    this.processHandlersSetup = false;

    // 🌍 환경 설정 (AppConfig 사용)
    this.config = this.createConfiguration();

    // 🔄 초기화 설정
    this.initConfig = {
      maxRetries: parseInt(process.env.STARTUP_MAX_RETRIES) || 3,
      retryBackoffMs: parseInt(process.env.STARTUP_RETRY_BACKOFF) || 5000,
      componentTimeout: parseInt(process.env.COMPONENT_TIMEOUT) || 30000,
      healthCheckDelay: parseInt(process.env.HEALTH_CHECK_DELAY) || 10000,
      gracefulShutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 15000,
    };

    // 📊 통계
    this.stats = {
      startTime: this.startTime,
      initializationAttempts: 0,
      componentInitTimes: new Map(),
      totalInitTime: 0,
      restartCount: 0,
      lastError: null,
    };

    logger.info(`🤖 DooMockBot v${this.version} 생성됨 - Railway 최적화`);
    logger.info(
      `🌍 환경: ${this.config.nodeEnv} | Railway: ${
        this.config.isRailway ? "YES" : "NO"
      }`
    );
  }

  /**
   * 📊 설정 생성 (AppConfig 기반)
   */
  createConfiguration() {
    return {
      // 기본 환경 정보
      nodeEnv: AppConfig.NODE_ENV,
      isRailway: AppConfig.isRailway,
      version: AppConfig.VERSION,

      // 봇 설정
      bot: {
        token: AppConfig.BOT_TOKEN,
        username: AppConfig.BOT_USERNAME,
        webhook: {
          enabled: !!process.env.WEBHOOK_ENABLED,
          url: process.env.WEBHOOK_URL,
          port: parseInt(process.env.PORT) || 3000,
        },
        rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
        maxRequestsPerMinute:
          parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 30,
      },

      // 데이터베이스 설정
      database: {
        url: AppConfig.MONGO_URL,
        name: this.extractDatabaseName(AppConfig.MONGO_URL),
        connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
        maxRetries: parseInt(process.env.DB_MAX_RETRIES) || 3,
      },

      // 헬스체크 설정
      healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== "false",
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        autoRecovery: process.env.HEALTH_AUTO_RECOVERY !== "false",
      },

      // 성능 설정
      performance: {
        memoryThreshold:
          parseInt(process.env.MEMORY_THRESHOLD) ||
          (AppConfig.isRailway ? 400 : 200),
        messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT) || 5000,
        callbackTimeout: parseInt(process.env.CALLBACK_TIMEOUT) || 2000,
      },

      // Railway 설정
      railway: AppConfig.RAILWAY || {},

      // 기능 설정
      features: AppConfig.FEATURES || {},

      // API 키들
      apis: {
        weather: AppConfig.WEATHER_API_KEY,
        airKorea: AppConfig.AIR_KOREA_API_KEY,
      },
    };
  }

  /**
   * 🗄️ 데이터베이스 이름 추출
   */
  extractDatabaseName(url) {
    try {
      const match = url?.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : "doomock_bot";
    } catch (error) {
      logger.warn("DB 이름 추출 실패, 기본값 사용");
      return "doomock_bot";
    }
  }

  /**
   * 🚀 애플리케이션 시작 (메인 엔트리 포인트)
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

      // 단계별 초기화 실행
      await this.executeBootstrapSequence();

      // 시작 완료 처리
      await this.completeStartup();
    } catch (error) {
      await this.handleStartupFailure(error);
    }
  }

  /**
   * 🔧 부트스트랩 시퀀스 실행
   */
  async executeBootstrapSequence() {
    const sequence = [
      { name: "1️⃣ Telegraf 봇", handler: this.initializeTelegrafBot },
      { name: "2️⃣ 데이터베이스", handler: this.initializeDatabaseManager },
      { name: "3️⃣ 서비스 빌더", handler: this.initializeServiceBuilder },
      { name: "4️⃣ 모듈 매니저", handler: this.initializeModuleManager },
      { name: "5️⃣ 봇 컨트롤러", handler: this.initializeBotController },
      { name: "6️⃣ 헬스체커", handler: this.initializeHealthChecker },
      { name: "7️⃣ 봇 런처", handler: this.launchBot },
    ];

    for (const step of sequence) {
      await this.executeStepWithRetry(step);
    }
  }

  /**
   * 🛡️ 재시도 로직이 포함된 단계 실행
   */
  async executeStepWithRetry(step) {
    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.initConfig.maxRetries; attempt++) {
      try {
        logger.info(
          `🔧 ${step.name} 초기화 중... (${attempt}/${this.initConfig.maxRetries})`
        );

        // 타임아웃 적용
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
        return; // 성공하면 바로 반환
      } catch (error) {
        lastError = error;
        logger.warn(
          `⚠️ ${step.name} 실패 (${attempt}/${this.initConfig.maxRetries}): ${error.message}`
        );

        if (attempt < this.initConfig.maxRetries) {
          const backoffTime = this.initConfig.retryBackoffMs * attempt;
          logger.info(`⏳ ${backoffTime}ms 대기 후 재시도...`);
          await this.sleep(backoffTime);
        }
      }
    }

    throw new Error(
      `${step.name} 최대 재시도 횟수 초과: ${lastError?.message}`
    );
  }

  /**
   * ⏰ 타임아웃 Promise 생성
   */
  createTimeoutPromise(timeout, stepName) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${stepName} 타임아웃 (${timeout}ms)`));
      }, timeout);
    });
  }

  /**
   * 🌍 환경 검증
   */
  validateEnvironment() {
    logger.info("🔍 환경 검증 중...");

    // AppConfig에서 이미 검증되었지만 추가 확인
    const requiredVars = ["BOT_TOKEN"];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수 누락: ${missingVars.join(", ")}`);
    }

    // MongoDB URL 확인
    if (!this.config.database.url) {
      logger.warn(
        "⚠️ MongoDB URI가 설정되지 않음. 일부 기능이 제한될 수 있습니다."
      );
    }

    // 환경 정보 로그
    logger.info(`📊 Node.js: ${process.version}`);
    logger.info(
      `📊 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    );
    logger.info(
      `📊 시간대: ${TimeHelper.format(new Date(), "YYYY-MM-DD HH:mm:ss Z")}`
    );

    if (this.config.isRailway) {
      logger.info(
        `🚂 Railway 서비스: ${process.env.RAILWAY_SERVICE_NAME || "Unknown"}`
      );
      logger.info(
        `🚂 Railway 환경: ${process.env.RAILWAY_ENVIRONMENT || "Unknown"}`
      );
    }

    logger.debug("✅ 환경 검증 완료");
  }

  /**
   * 🤖 Telegraf 봇 초기화
   */
  async initializeTelegrafBot() {
    logger.debug("🤖 Telegraf 봇 인스턴스 생성 중...");

    // 🛡️ 기존 봇 정리 (중복 방지)
    if (this.components.has("bot")) {
      logger.debug("🧹 기존 봇 인스턴스 정리 중...");
      const oldBot = this.components.get("bot");
      try {
        oldBot.stop();
      } catch (stopError) {
        logger.debug("기존 봇 정지 중 오류 (무시):", stopError.message);
      }
    }

    // 새 봇 인스턴스 생성
    const bot = new Telegraf(this.config.bot.token);

    // 🔧 기본 미들웨어 설정
    this.setupBotMiddleware(bot);

    // 컴포넌트로 등록
    this.components.set("bot", bot);

    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  /**
   * 🔧 봇 미들웨어 설정
   */
  setupBotMiddleware(bot) {
    // 요청 제한 (Railway 환경에서 중요)
    if (this.config.bot.rateLimitEnabled) {
      const userLimits = new Map();
      const maxRequests = this.config.bot.maxRequestsPerMinute;

      bot.use((ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const now = Date.now();
        const userLimit = userLimits.get(userId) || {
          count: 0,
          resetTime: now,
        };

        // 1분마다 초기화
        if (now > userLimit.resetTime + 60000) {
          userLimit.count = 0;
          userLimit.resetTime = now;
        }

        // 제한 확인
        if (userLimit.count >= maxRequests) {
          logger.warn(
            `⚠️ 사용자 ${userId} 요청 제한 초과 (${userLimit.count}/${maxRequests})`
          );
          return ctx.reply(
            "⚠️ 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          );
        }

        userLimit.count++;
        userLimits.set(userId, userLimit);
        return next();
      });
    }

    // 전역 에러 핸들러
    bot.catch((error, ctx) => {
      logger.error("🚨 Telegraf 전역 오류:", error);

      try {
        ctx.reply(
          "❌ 처리 중 오류가 발생했습니다. /start 로 다시 시작해주세요."
        );
      } catch (replyError) {
        logger.error("에러 응답 실패:", replyError);
      }
    });

    logger.debug("🔧 봇 미들웨어 설정 완료");
  }

  /**
   * 🗄️ 데이터베이스 매니저 초기화
   */
  async initializeDatabaseManager() {
    logger.debug("🗄️ 데이터베이스 매니저 생성 중...");

    const dbManager = new DatabaseManager({
      mongoUri: this.config.database.url,
      connectTimeout: this.config.database.connectTimeout,
      maxRetries: this.config.database.maxRetries,
    });

    // 연결 시도
    logger.debug("🔗 데이터베이스 연결 중...");
    await dbManager.initialize();

    // 연결 확인 대기
    await this.waitForDatabaseConnection(dbManager);

    // 컴포넌트로 등록
    this.components.set("dbManager", dbManager);

    logger.debug("✅ 데이터베이스 매니저 초기화 완료");
  }

  /**
   * 🗄️ 데이터베이스 연결 대기
   */
  async waitForDatabaseConnection(dbManager, timeout = 30000) {
    const startTime = Date.now();

    logger.debug("🔄 데이터베이스 연결 상태 확인 중...");

    while (Date.now() - startTime < timeout) {
      try {
        if (dbManager.isConnected && dbManager.isConnected()) {
          const waitTime = Date.now() - startTime;
          logger.debug(`✅ 데이터베이스 연결 확인 완료 (${waitTime}ms)`);
          return;
        }

        await this.sleep(1000);
      } catch (error) {
        logger.debug(`🔄 DB 연결 확인 중: ${error.message}`);
        await this.sleep(2000);
      }
    }

    throw new Error(`데이터베이스 연결 확인 타임아웃 (${timeout}ms)`);
  }

  /**
   * 🏗️ 서비스 빌더 초기화
   */
  async initializeServiceBuilder() {
    logger.debug("🏗️ ServiceBuilder 초기화 중...");

    // ServiceBuilder 초기화
    await ServiceBuilder.initialize();

    // DB 연결 주입
    const dbManager = this.components.get("dbManager");
    if (dbManager) {
      ServiceBuilder.dbManager = dbManager;
      ServiceBuilder.db = dbManager.getDatabase();
    }

    // 컴포넌트로 등록
    this.components.set("serviceBuilder", ServiceBuilder);

    logger.debug("✅ ServiceBuilder 초기화 완료");
  }

  /**
   * 📦 모듈 매니저 초기화
   */
  async initializeModuleManager() {
    logger.debug("📦 ModuleManager 생성 중...");

    const moduleManager = new ModuleManager({
      bot: this.components.get("bot"),
      serviceBuilder: this.components.get("serviceBuilder"),
      config: {
        enableAutoDiscovery: true,
        enableHealthCheck: true,
        dbWaitTimeout: 60000,
        serviceWaitTimeout: 30000,
        maxInitRetries: 5,
      },
    });

    // ModuleManager 초기화
    logger.debug("🔧 ModuleManager 초기화 중...");
    await moduleManager.initialize();

    // 컴포넌트로 등록
    this.components.set("moduleManager", moduleManager);

    logger.debug("✅ ModuleManager 초기화 완료");
  }

  /**
   * 🎮 봇 컨트롤러 초기화
   */
  async initializeBotController() {
    logger.debug("🎮 BotController 생성 중...");

    const botController = new BotController({
      bot: this.components.get("bot"),
      moduleManager: this.components.get("moduleManager"),
      config: {
        enableNavigationHandler: true,
        enableErrorHandling: true,
        isRailway: this.config.isRailway,
      },
    });

    // BotController 초기화
    logger.debug("🔧 BotController 초기화 중...");
    await botController.initialize();

    // 컴포넌트로 등록
    this.components.set("botController", botController);

    logger.debug("✅ BotController 초기화 완료");
  }

  /**
   * 🏥 헬스체커 초기화 (지연 시작)
   */
  async initializeHealthChecker() {
    if (!this.config.healthCheck.enabled) {
      logger.debug("⚠️ HealthChecker 비활성화됨");
      return;
    }

    logger.debug("🏥 HealthChecker 설정 중...");

    const healthChecker = new HealthChecker({
      dbManager: this.components.get("dbManager"),
      moduleManager: this.components.get("moduleManager"),
      serviceBuilder: this.components.get("serviceBuilder"),
      botController: this.components.get("botController"),
      config: {
        checkInterval: this.config.healthCheck.interval,
        enableAutoRecovery: this.config.healthCheck.autoRecovery,
        maxRecoveryAttempts: 3,
      },
    });

    // 컴포넌트로 등록
    this.components.set("healthChecker", healthChecker);

    // 지연된 시작 스케줄링
    setTimeout(async () => {
      try {
        logger.info("🏥 HealthChecker 지연 시작...");
        await healthChecker.start();
        logger.success("✅ HealthChecker 시작됨");
      } catch (error) {
        logger.error("❌ HealthChecker 시작 실패:", error);
      }
    }, this.initConfig.healthCheckDelay);

    logger.debug("✅ HealthChecker 설정 완료 (지연 시작 예약됨)");
  }

  /**
   * 🚀 봇 런처 (실제 시작)
   */
  async launchBot() {
    const bot = this.components.get("bot");

    if (!bot) {
      throw new Error("봇 인스턴스를 찾을 수 없음");
    }

    logger.debug("🚀 봇 런처 시작 중...");

    // 🛡️ 기존 연결 정리
    await this.cleanupExistingBotConnections(bot);

    // Railway 환경별 시작 방식
    if (this.config.isRailway) {
      await this.startRailwayBot(bot);
    } else {
      await this.startLocalBot(bot);
    }

    logger.debug("✅ 봇 런처 완료");
  }

  /**
   * 🧹 기존 봇 연결 정리
   */
  async cleanupExistingBotConnections(bot) {
    logger.debug("🧹 기존 봇 연결 정리 중...");

    try {
      // 웹훅 삭제 (대기 업데이트도 함께 삭제)
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.debug("✅ 웹훅 정리됨");
    } catch (webhookError) {
      logger.debug("⚠️ 웹훅 정리 실패 (무시):", webhookError.message);
    }

    // 안전 대기
    logger.debug("⏳ 안전 대기 중... (3초)");
    await this.sleep(3000);
  }

  /**
   * 🚂 Railway 봇 시작
   */
  async startRailwayBot(bot) {
    const port = process.env.PORT || 3000;
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN;

    if (domain && this.config.bot.webhook.enabled) {
      // 웹훅 모드
      logger.info(`🌐 Railway 웹훅 모드: https://${domain}:${port}`);

      const webhookUrl = `https://${domain}/webhook`;

      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });

      await bot.launch({
        webhook: {
          domain: `https://${domain}`,
          port: port,
          hookPath: "/webhook",
        },
      });
    } else {
      // 폴링 모드
      logger.info("🔄 Railway 폴링 모드");
      await this.startPollingMode(bot);
    }
  }

  /**
   * 🏠 로컬 봇 시작
   */
  async startLocalBot(bot) {
    logger.info("🏠 로컬 폴링 모드");
    await this.startPollingMode(bot);
  }

  /**
   * 🔄 폴링 모드 시작
   */
  async startPollingMode(bot) {
    try {
      await bot.launch({
        polling: {
          timeout: 30,
          limit: 100,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        },
      });

      logger.debug("✅ 폴링 모드 시작됨");
    } catch (pollingError) {
      // 409 Conflict 특별 처리
      if (pollingError.response?.error_code === 409) {
        logger.warn("⚠️ 봇 중복 실행 감지! 복구 시도 중...");
        await this.recoverFromConflict(bot);
      } else {
        throw pollingError;
      }
    }
  }

  /**
   * 🛠️ 409 Conflict 복구
   */
  async recoverFromConflict(bot) {
    logger.info("🔧 409 Conflict 복구 시작...");

    try {
      // 강제 웹훅 삭제
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.debug("🧹 강제 웹훅 삭제됨");

      // 더 긴 대기
      logger.debug("⏳ 복구 대기 중... (10초)");
      await this.sleep(10000);

      // 폴링 재시도
      await this.startPollingMode(bot);

      logger.success("✅ 409 Conflict 복구 성공!");
    } catch (recoveryError) {
      throw new Error(`409 Conflict 복구 실패: ${recoveryError.message}`);
    }
  }

  /**
   * 🎉 시작 완료 처리
   */
  async completeStartup() {
    this.stats.totalInitTime = Date.now() - this.startTime;

    // 성공 로그
    logger.success(`🎉 DooMockBot v${this.version} 시작 완료!`);
    logger.success(`⏱️  총 초기화 시간: ${this.stats.totalInitTime}ms`);
    logger.success(`📊 초기화된 컴포넌트: ${this.components.size}개`);

    // 컴포넌트별 초기화 시간 로그
    if (logger.level === "debug") {
      logger.debug("📊 컴포넌트별 초기화 시간:");
      for (const [name, time] of this.stats.componentInitTimes) {
        logger.debug(`  ${name}: ${time}ms`);
      }
    }

    // Railway 환경에서 메모리 모니터링 시작
    if (this.config.isRailway) {
      this.startMemoryMonitoring();
    }

    // Railway 헬스체크 엔드포인트 설정
    if (this.config.isRailway && this.config.healthCheck.enabled) {
      this.setupRailwayHealthEndpoint();
    }
  }

  /**
   * 📊 메모리 모니터링 시작 (Railway 최적화)
   */
  startMemoryMonitoring() {
    const memoryThreshold = this.config.performance.memoryThreshold; // MB
    const checkInterval = 60000; // 1분

    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      if (heapUsedMB > memoryThreshold) {
        logger.warn(
          `⚠️ 메모리 사용량 높음: ${heapUsedMB}MB (임계값: ${memoryThreshold}MB)`
        );

        // 가비지 컬렉션 강제 실행 (global.gc가 활성화된 경우)
        if (global.gc) {
          global.gc();
          logger.debug("🧹 가비지 컬렉션 실행됨");
        }
      }
    }, checkInterval);

    logger.debug(`📊 메모리 모니터링 시작 (임계값: ${memoryThreshold}MB)`);
  }

  /**
   * 🏥 Railway 헬스체크 엔드포인트 설정
   */
  setupRailwayHealthEndpoint() {
    const express = require("express");
    const app = express();

    app.get("/health", (req, res) => {
      const health = {
        status: "healthy",
        version: this.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        components: {
          total: this.components.size,
          bot: this.components.has("bot"),
          database: this.components.has("dbManager"),
          modules: this.components.has("moduleManager"),
          healthChecker: this.components.has("healthChecker"),
        },
        stats: this.stats,
      };

      res.status(200).json(health);
    });

    app.get("/ping", (req, res) => {
      res.status(200).text("pong");
    });

    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
      logger.debug(`🏥 Railway 헬스체크 서버: 포트 ${port}`);
    });

    this.components.set("healthServer", server);
  }

  /**
   * 🚨 시작 실패 처리
   */
  async handleStartupFailure(error) {
    this.stats.lastError = {
      message: error.message,
      timestamp: new Date().toISOString(),
      attempt: this.stats.initializationAttempts,
    };

    logger.error(
      `💥 DooMockBot 시작 실패 (시도 ${this.stats.initializationAttempts}):`,
      error
    );

    // 부분적으로 초기화된 컴포넌트들 정리
    await this.cleanupComponents();

    // Railway 환경에서는 재시작 가능성을 위해 exit(1) 사용
    if (this.config.isRailway) {
      logger.error("🚂 Railway 환경 - 프로세스 종료 (재시작 예상)");
      process.exit(1);
    } else {
      logger.error("🏠 로컬 환경 - 애플리케이션 종료");
      process.exit(1);
    }
  }

  /**
   * 🧹 컴포넌트 정리
   */
  async cleanupComponents() {
    logger.info("🧹 컴포넌트 정리 시작...");

    const cleanupTasks = [];

    // 헬스체커 정리
    if (this.components.has("healthChecker")) {
      cleanupTasks.push(this.cleanupHealthChecker());
    }

    // 봇 정리
    if (this.components.has("bot")) {
      cleanupTasks.push(this.cleanupBot());
    }

    // 모듈 매니저 정리
    if (this.components.has("moduleManager")) {
      cleanupTasks.push(this.cleanupModuleManager());
    }

    // 데이터베이스 정리
    if (this.components.has("dbManager")) {
      cleanupTasks.push(this.cleanupDatabase());
    }

    // 헬스 서버 정리
    if (this.components.has("healthServer")) {
      cleanupTasks.push(this.cleanupHealthServer());
    }

    // 모든 정리 작업 실행
    await Promise.allSettled(cleanupTasks);

    this.components.clear();
    logger.info("✅ 컴포넌트 정리 완료");
  }

  /**
   * 🏥 헬스체커 정리
   */
  async cleanupHealthChecker() {
    try {
      const healthChecker = this.components.get("healthChecker");
      if (healthChecker && typeof healthChecker.stop === "function") {
        await healthChecker.stop();
        logger.debug("✅ HealthChecker 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ HealthChecker 정리 실패:", error.message);
    }
  }

  /**
   * 🤖 봇 정리
   */
  async cleanupBot() {
    try {
      const bot = this.components.get("bot");
      if (bot) {
        bot.stop("cleanup");
        logger.debug("✅ Bot 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ Bot 정리 실패:", error.message);
    }
  }

  /**
   * 📦 모듈 매니저 정리
   */
  async cleanupModuleManager() {
    try {
      const moduleManager = this.components.get("moduleManager");
      if (moduleManager && typeof moduleManager.cleanup === "function") {
        await moduleManager.cleanup();
        logger.debug("✅ ModuleManager 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ ModuleManager 정리 실패:", error.message);
    }
  }

  /**
   * 🗄️ 데이터베이스 정리
   */
  async cleanupDatabase() {
    try {
      const dbManager = this.components.get("dbManager");
      if (dbManager && typeof dbManager.disconnect === "function") {
        await dbManager.disconnect();
        logger.debug("✅ Database 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ Database 정리 실패:", error.message);
    }
  }

  /**
   * 🏥 헬스 서버 정리
   */
  async cleanupHealthServer() {
    try {
      const server = this.components.get("healthServer");
      if (server) {
        server.close();
        logger.debug("✅ Health Server 정리됨");
      }
    } catch (error) {
      logger.warn("⚠️ Health Server 정리 실패:", error.message);
    }
  }

  /**
   * 🔄 프로세스 핸들러 설정
   */
  setupProcessHandlers() {
    if (this.processHandlersSetup) {
      return;
    }
    this.processHandlersSetup = true;

    // 정상 종료 신호
    process.once("SIGINT", () => {
      logger.info("📡 SIGINT 수신 - 정상 종료 시작");
      this.gracefulShutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      logger.info("📡 SIGTERM 수신 - Railway 재배포 감지");
      this.gracefulShutdown("SIGTERM");
    });

    // 예외 처리
    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      this.gracefulShutdown("unhandledRejection");
    });

    logger.debug("🔄 프로세스 핸들러 설정 완료");
  }

  /**
   * 🛑 우아한 종료
   */
  async gracefulShutdown(reason) {
    if (this.isShuttingDown) {
      logger.warn("이미 종료 중...");
      return;
    }

    this.isShuttingDown = true;
    logger.info(`🛑 우아한 종료 시작 (이유: ${reason})`);

    try {
      // 타임아웃 설정
      const shutdownPromise = this.cleanupComponents();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("종료 타임아웃"));
        }, this.initConfig.gracefulShutdownTimeout);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

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

  /**
   * 💤 Sleep 헬퍼
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      version: this.version,
      uptime: Date.now() - this.startTime,
      environment: this.config.nodeEnv,
      isRailway: this.config.isRailway,
      components: Array.from(this.components.keys()),
      stats: this.stats,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }
}

// 🚀 애플리케이션 시작 (직접 실행 시에만)
if (require.main === module) {
  const app = new DooMockBot();

  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
