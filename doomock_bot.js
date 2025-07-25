// app.js - v3.0.1 중앙화 통합 시스템
const TelegramBot = require("node-telegram-bot-api");
const logger = require("./src/utils/Logger");
const TimeHelper = require("./src/utils/TimeHelper");

// 🏗️ 핵심 시스템들
const DatabaseManager = require("./src/database/DatabaseManager");
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/core/ValidationManager");
const HealthChecker = require("./src/utils/HealthChecker");

/**
 * 🚀 메인 애플리케이션 v3.0.1 - 완전 중앙화
 *
 * 🎯 핵심 개선사항:
 * - ValidationManager 중앙 검증 시스템
 * - HealthChecker 통합 모니터링
 * - 모든 중복 코드 제거
 * - 의존성 주입으로 깔끔한 연결
 * - Railway 환경 완벽 최적화
 *
 * 📊 시스템 아키텍처:
 * App → BotController → ModuleManager → Modules → Services
 *  ↓
 * ValidationManager (중앙 검증)
 * HealthChecker (중앙 모니터링)
 * DatabaseManager (데이터 관리)
 */
class DooMockBot {
  constructor() {
    // 🤖 텔레그램 봇
    this.bot = null;

    // 🏗️ 핵심 매니저들
    this.dbManager = null;
    this.botController = null;
    this.moduleManager = null;

    // 🛡️ 중앙 시스템들
    this.validationManager = null;
    this.healthChecker = null;

    // ⚙️ 설정
    this.config = {
      // 봇 설정
      botToken: process.env.BOT_TOKEN,
      environment: process.env.NODE_ENV || "development",

      // 데이터베이스 설정
      mongoUri: process.env.MONGODB_URI,
      dbName: process.env.DB_NAME || "DooMockBot",

      // Railway 최적화
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      port: process.env.PORT || 3000,

      // 헬스체크 설정
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== "false",
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,

      // 검증 설정
      enableValidation: process.env.ENABLE_VALIDATION !== "false",
      validationCacheEnabled: process.env.VALIDATION_CACHE_ENABLED !== "false",

      // 성능 설정
      maxConcurrentRequests:
        parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
    };

    // 📊 앱 상태
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = Date.now();

    // 🔧 Graceful shutdown 핸들러
    this.setupGracefulShutdown();

    logger.info("🚀 DooMockBot v3.0.1 애플리케이션 생성됨");
  }

  /**
   * 🎯 애플리케이션 초기화 (완전 중앙화)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("애플리케이션이 이미 초기화됨");
      return;
    }

    try {
      logger.info("🚀 DooMockBot v3.0.1 초기화 시작...");

      // 1️⃣ 환경 검증
      await this.validateEnvironment();

      // 2️⃣ 텔레그램 봇 초기화
      await this.initializeTelegramBot();

      // 3️⃣ 데이터베이스 매니저 초기화
      await this.initializeDatabaseManager();

      // 4️⃣ 중앙 검증 시스템 초기화
      await this.initializeValidationManager();

      // 5️⃣ 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 6️⃣ 봇 컨트롤러 초기화
      await this.initializeBotController();

      // 7️⃣ 중앙 헬스체커 초기화
      await this.initializeHealthChecker();

      // 8️⃣ Railway 환경 최적화
      if (this.config.isRailway) {
        await this.applyRailwayOptimizations();
      }

      this.isInitialized = true;

      logger.success(`✅ DooMockBot v3.0.1 초기화 완료! 🎉`);
      logger.info(`🌍 환경: ${this.config.environment}`);
      logger.info(`🚂 Railway: ${this.config.isRailway ? "활성" : "비활성"}`);
      logger.info(
        `🛡️ 검증 시스템: ${this.config.enableValidation ? "활성" : "비활성"}`
      );
      logger.info(
        `🏥 헬스체커: ${this.config.enableHealthCheck ? "활성" : "비활성"}`
      );
    } catch (error) {
      logger.error("❌ 애플리케이션 초기화 실패:", error);
      await this.handleInitializationFailure(error);
      throw error;
    }
  }

  /**
   * 🔍 환경 검증
   */
  async validateEnvironment() {
    logger.info("🔍 환경 변수 검증 중...");

    const requiredEnvVars = ["BOT_TOKEN", "MONGODB_URI"];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경 변수 누락: ${missingVars.join(", ")}`);
    }

    // 토큰 형식 검증
    if (!this.config.botToken.includes(":")) {
      throw new Error("올바르지 않은 BOT_TOKEN 형식");
    }

    // MongoDB URI 검증
    if (!this.config.mongoUri.startsWith("mongodb")) {
      throw new Error("올바르지 않은 MONGODB_URI 형식");
    }

    logger.debug("✅ 환경 변수 검증 완료");
  }

  /**
   * 🤖 텔레그램 봇 초기화
   */
  async initializeTelegramBot() {
    logger.info("🤖 텔레그램 봇 초기화 중...");

    // 봇 인스턴스 생성
    this.bot = new TelegramBot(this.config.botToken, {
      polling: {
        interval: 1000,
        autoStart: false,
        params: {
          timeout: 10,
        },
      },
    });

    // 봇 정보 확인
    try {
      const botInfo = await this.bot.getMe();
      logger.info(`🤖 봇 연결됨: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      throw new Error(`봇 연결 실패: ${error.message}`);
    }

    logger.debug("✅ 텔레그램 봇 초기화 완료");
  }

  /**
   * 🗄️ 데이터베이스 매니저 초기화
   */
  async initializeDatabaseManager() {
    logger.info("🗄️ 데이터베이스 매니저 초기화 중...");

    this.dbManager = new DatabaseManager({
      uri: this.config.mongoUri,
      dbName: this.config.dbName,
      options: {
        maxPoolSize: this.config.isRailway ? 5 : 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // IPv4 강제 사용
      },
    });

    await this.dbManager.connect();
    logger.debug("✅ 데이터베이스 매니저 초기화 완료");
  }

  /**
   * 🛡️ 중앙 검증 시스템 초기화
   */
  async initializeValidationManager() {
    if (!this.config.enableValidation) {
      logger.info("🛡️ 검증 시스템 비활성화됨");
      return;
    }

    logger.info("🛡️ 중앙 검증 시스템 초기화 중...");

    this.validationManager = new ValidationManager({
      enableCache: this.config.validationCacheEnabled,
      cacheTimeout: 300000, // 5분
      maxCacheSize: this.config.isRailway ? 500 : 1000,
      enableLogging: this.config.environment === "development",
      strictMode: this.config.environment === "production",
    });

    // 커스텀 스키마 추가 (필요시)
    await this.addCustomValidationSchemas();

    logger.debug("✅ 중앙 검증 시스템 초기화 완료");
  }

  /**
   * 🎛️ 모듈 매니저 초기화
   */
  async initializeModuleManager() {
    logger.info("🎛️ 모듈 매니저 초기화 중...");

    this.moduleManager = new ModuleManager(this.bot, {
      db: this.dbManager,
      validationManager: this.validationManager, // ValidationManager 전달
      config: {
        moduleTimeout: 30000,
        maxRetries: 3,
        autoReload: this.config.environment === "development",
      },
    });

    await this.moduleManager.initialize();
    logger.debug("✅ 모듈 매니저 초기화 완료");
  }

  /**
   * 🎮 봇 컨트롤러 초기화
   */
  async initializeBotController() {
    logger.info("🎮 봇 컨트롤러 초기화 중...");

    this.botController = new BotController(this.bot, {
      moduleManager: this.moduleManager,
      dbManager: this.dbManager,
      validationManager: this.validationManager,
      healthChecker: this.healthChecker, // HealthChecker 전달
      config: {
        messageTimeout: this.config.requestTimeout,
        callbackTimeout: 5000,
        maxRetries: 3,
        rateLimitEnabled: true,
        maxRequestsPerMinute: this.config.isRailway ? 20 : 30,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
      },
    });

    await this.botController.initialize();
    logger.debug("✅ 봇 컨트롤러 초기화 완료");
  }

  /**
   * 🏥 중앙 헬스체커 초기화
   */
  async initializeHealthChecker() {
    if (!this.config.enableHealthCheck) {
      logger.info("🏥 헬스체커 비활성화됨");
      return;
    }

    logger.info("🏥 중앙 헬스체커 초기화 중...");

    this.healthChecker = new HealthChecker({
      botController: this.botController,
      moduleManager: this.moduleManager,
      dbManager: this.dbManager,
      validationManager: this.validationManager,
      config: {
        normalCheckInterval: this.config.healthCheckInterval,
        criticalCheckInterval: 5000,
        memoryThreshold: this.config.isRailway ? 300 : 500, // Railway는 더 보수적
        responseTimeThreshold: 3000,
        errorRateThreshold: 0.1,
        autoRecovery: true,
        maxRecoveryAttempts: 3,
        enableAlerts: this.config.environment === "production",
      },
    });

    // 모든 컴포넌트를 헬스체커에 등록
    this.healthChecker.registerComponent("bot", this.bot);
    this.healthChecker.registerComponent("database", this.dbManager);
    this.healthChecker.registerComponent("modules", this.moduleManager);
    this.healthChecker.registerComponent("validation", this.validationManager);

    await this.healthChecker.start();
    logger.debug("✅ 중앙 헬스체커 초기화 완료");
  }

  /**
   * 🚂 Railway 환경 최적화
   */
  async applyRailwayOptimizations() {
    logger.info("🚂 Railway 환경 최적화 적용 중...");

    // 1. 메모리 사용량 모니터링 강화
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (usedMB > 400) {
        // 400MB 임계값
        logger.warn(`⚠️ 높은 메모리 사용량: ${usedMB}MB`);

        // 강제 가비지 컬렉션
        if (global.gc) {
          global.gc();
          logger.debug("🧹 가비지 컬렉션 실행됨");
        }
      }
    }, 60000); // 1분마다

    // 2. 연결 상태 주기적 체크
    setInterval(async () => {
      try {
        if (this.dbManager && !this.dbManager.isConnected()) {
          logger.warn("🔄 데이터베이스 재연결 시도...");
          await this.dbManager.reconnect();
        }
      } catch (error) {
        logger.error("❌ 데이터베이스 재연결 실패:", error);
      }
    }, 300000); // 5분마다

    // 3. 캐시 정리 작업 스케줄링
    setInterval(() => {
      if (this.validationManager) {
        this.validationManager.cleanup();
      }
    }, 600000); // 10분마다

    logger.debug("✅ Railway 환경 최적화 완료");
  }

  /**
   * 📋 커스텀 검증 스키마 추가
   */
  async addCustomValidationSchemas() {
    if (!this.validationManager) return;

    // 애플리케이션별 커스텀 스키마들을 여기에 추가
    // 기본 스키마는 ValidationManager에서 자동 등록됨

    logger.debug("📋 커스텀 검증 스키마 추가 완료");
  }

  /**
   * 🚀 애플리케이션 시작
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error("애플리케이션이 초기화되지 않았습니다.");
    }

    if (this.isRunning) {
      logger.warn("애플리케이션이 이미 실행 중입니다.");
      return;
    }

    try {
      logger.info("🚀 DooMockBot v3.0.1 시작 중...");

      // 봇 폴링 시작
      await this.bot.startPolling();

      // Railway 웹 서버 시작 (필요한 경우)
      if (this.config.isRailway) {
        await this.startWebServer();
      }

      this.isRunning = true;

      const uptime = TimeHelper.formatDuration(Date.now() - this.startTime);
      logger.success(`🎉 DooMockBot v3.0.1 실행됨! (시작 시간: ${uptime})`);

      // 상태 요약 출력
      await this.printSystemStatus();
    } catch (error) {
      logger.error("❌ 애플리케이션 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🌐 웹 서버 시작 (Railway용)
   */
  async startWebServer() {
    const express = require("express");
    const app = express();

    // 헬스 체크 엔드포인트
    app.get("/health", async (req, res) => {
      try {
        const status = this.healthChecker
          ? this.healthChecker.getStatus()
          : { overall: { health: "unknown" } };

        res.status(status.overall.health === "healthy" ? 200 : 503).json({
          status: status.overall.health,
          timestamp: TimeHelper.getLogTimeString(),
          uptime: Date.now() - this.startTime,
          version: "3.0.1",
          environment: this.config.environment,
          components: status.components || {},
        });
      } catch (error) {
        res.status(500).json({
          status: "error",
          error: error.message,
          timestamp: TimeHelper.getLogTimeString(),
        });
      }
    });

    // 상태 엔드포인트
    app.get("/status", async (req, res) => {
      try {
        const systemStatus = await this.getSystemStatus();
        res.json(systemStatus);
      } catch (error) {
        res.status(500).json({
          error: error.message,
          timestamp: TimeHelper.getLogTimeString(),
        });
      }
    });

    // 기본 엔드포인트
    app.get("/", (req, res) => {
      res.json({
        name: "DooMockBot",
        version: "3.0.1",
        status: "running",
        timestamp: TimeHelper.getLogTimeString(),
      });
    });

    app.listen(this.config.port, () => {
      logger.info(`🌐 웹 서버 시작됨: 포트 ${this.config.port}`);
    });
  }

  /**
   * 📊 시스템 상태 조회
   */
  async getSystemStatus() {
    const uptime = Date.now() - this.startTime;
    const memUsage = process.memoryUsage();

    return {
      app: {
        name: "DooMockBot",
        version: "3.0.1",
        environment: this.config.environment,
        isRailway: this.config.isRailway,
        uptime,
        uptimeFormatted: TimeHelper.formatDuration(uptime),
      },
      system: {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        process: {
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
      components: {
        bot: this.botController ? this.botController.getStatus() : null,
        database: this.dbManager ? this.dbManager.getStatus() : null,
        modules: this.moduleManager ? this.moduleManager.getStatus() : null,
        validation: this.validationManager
          ? this.validationManager.getStatus()
          : null,
        health: this.healthChecker ? this.healthChecker.getStatus() : null,
      },
      timestamp: TimeHelper.getLogTimeString(),
    };
  }

  /**
   * 📊 시스템 상태 출력
   */
  async printSystemStatus() {
    try {
      const status = await this.getSystemStatus();

      logger.info("📊 === 시스템 상태 요약 ===");
      logger.info(`🚀 앱: ${status.app.name} v${status.app.version}`);
      logger.info(`🌍 환경: ${status.app.environment}`);
      logger.info(`⏱️ 업타임: ${status.app.uptimeFormatted}`);
      logger.info(
        `💾 메모리: ${status.system.memory.used}MB / ${status.system.memory.total}MB`
      );

      if (status.components.bot) {
        logger.info(
          `🤖 봇: ${status.components.bot.initialized ? "활성" : "비활성"}`
        );
      }

      if (status.components.database) {
        logger.info(
          `🗄️ DB: ${
            status.components.database.connected ? "연결됨" : "연결 안됨"
          }`
        );
      }

      if (status.components.modules) {
        logger.info(
          `🎛️ 모듈: ${
            status.components.modules.stats?.activeModules || 0
          }개 활성`
        );
      }

      if (status.components.validation) {
        logger.info(
          `🛡️ 검증: ${
            status.components.validation.stats?.totalValidations || 0
          }회 수행`
        );
      }

      if (status.components.health) {
        logger.info(
          `🏥 헬스: ${status.components.health.overall?.health || "unknown"}`
        );
      }

      logger.info("📊 ========================");
    } catch (error) {
      logger.error("❌ 시스템 상태 출력 실패:", error);
    }
  }

  /**
   * 🚫 Graceful shutdown 설정
   */
  setupGracefulShutdown() {
    const shutdownSignals = ["SIGTERM", "SIGINT", "SIGUSR2"];

    shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`🚫 ${signal} 신호 수신됨. Graceful shutdown 시작...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    // 처리되지 않은 예외 처리
    process.on("uncaughtException", async (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      await this.shutdown();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * 🚫 애플리케이션 종료
   */
  async shutdown() {
    if (!this.isRunning) {
      logger.info("애플리케이션이 이미 종료됨");
      return;
    }

    try {
      logger.info("🚫 DooMockBot v3.0.1 종료 중...");

      // 1. 헬스체커 정지
      if (this.healthChecker) {
        await this.healthChecker.cleanup();
        logger.debug("✅ 헬스체커 정지됨");
      }

      // 2. 봇 폴링 정지
      if (this.bot) {
        await this.bot.stopPolling();
        logger.debug("✅ 봇 폴링 정지됨");
      }

      // 3. 봇 컨트롤러 정리
      if (this.botController) {
        await this.botController.cleanup();
        logger.debug("✅ 봇 컨트롤러 정리됨");
      }

      // 4. 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
        logger.debug("✅ 모듈 매니저 정리됨");
      }

      // 5. 검증 매니저 정리
      if (this.validationManager) {
        this.validationManager.cleanup();
        logger.debug("✅ 검증 매니저 정리됨");
      }

      // 6. 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
        logger.debug("✅ 데이터베이스 연결 종료됨");
      }

      this.isRunning = false;
      this.isInitialized = false;

      const totalUptime = TimeHelper.formatDuration(
        Date.now() - this.startTime
      );
      logger.success(
        `✅ DooMockBot v3.0.1 정상 종료됨 (총 실행 시간: ${totalUptime})`
      );
    } catch (error) {
      logger.error("❌ 애플리케이션 종료 중 오류:", error);
    }
  }

  /**
   * ❌ 초기화 실패 처리
   */
  async handleInitializationFailure(error) {
    logger.error("💥 초기화 실패로 인한 정리 작업 시작...");

    try {
      // 부분적으로 초기화된 컴포넌트들 정리
      if (this.healthChecker) {
        await this.healthChecker.cleanup();
      }

      if (this.botController) {
        await this.botController.cleanup();
      }

      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      if (this.bot) {
        await this.bot.stopPolling();
      }

      logger.info("✅ 초기화 실패 정리 작업 완료");
    } catch (cleanupError) {
      logger.error("❌ 초기화 실패 정리 중 추가 오류:", cleanupError);
    }
  }
}

// ===== 🚀 애플리케이션 시작점 =====

/**
 * 메인 실행 함수
 */
async function main() {
  // 시작 시간 기록
  const startTime = Date.now();

  logger.info("🌟 ====================================");
  logger.info("🚀 DooMockBot v3.0.1 시작");
  logger.info(`🕐 시작 시간: ${TimeHelper.getLogTimeString()}`);
  logger.info("🌟 ====================================");

  try {
    // 애플리케이션 인스턴스 생성
    const app = new DooMockBot();

    // 초기화 및 시작
    await app.initialize();
    await app.start();

    const initTime = Date.now() - startTime;
    logger.success(`🎉 완전 시작 완료! (${initTime}ms)`);
  } catch (error) {
    logger.error("💥 애플리케이션 시작 실패:", error);
    process.exit(1);
  }
}

// 🚀 실행!
if (require.main === module) {
  main().catch((error) => {
    logger.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
