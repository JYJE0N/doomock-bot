// doomock_bot.js - v3.0.1 Telegraf 마이그레이션 버전
const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");
const TimeHelper = require("./src/utils/TimeHelper");

// 🏗️ 핵심 시스템들
const DatabaseManager = require("./src/database/DatabaseManager");
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

/**
 * 🚀 메인 애플리케이션 v3.0.1 - Telegraf 버전
 *
 * 🎯 핵심 변경사항:
 * - node-telegram-bot-api → Telegraf 마이그레이션
 * - Context 기반 처리
 * - Middleware 지원
 * - 더 나은 에러 처리
 * - TypeScript 지원 가능
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
    // 🤖 텔레그래프 봇
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
      mongoUri: process.env.MONGODB_URI || process.env.MONGO_URL,
      dbName: process.env.DB_NAME || "DooMockBot",

      // Railway 최적화
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,

      // 시스템 설정
      enableValidation: process.env.ENABLE_VALIDATION !== "false",
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== "false",
      validationCacheEnabled: process.env.VALIDATION_CACHE_ENABLED !== "false",
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 30,
    };

    // 프로세스 이벤트 핸들러
    this.setupProcessHandlers();
  }

  /**
   * 🚀 애플리케이션 시작
   */
  async start() {
    try {
      logger.moduleStart("두목봇 v3.0.1 - Telegraf");

      // 환경 검증
      await this.validateEnvironment();

      // 초기화 순서 (의존성 순)
      await this.initializeTelegrafBot();
      await this.initializeDatabaseManager();
      await this.initializeValidationManager();
      await this.initializeHealthChecker();
      await this.initializeModuleManager();
      await this.initializeBotController();

      // 봇 시작
      await this.startBot();

      logger.success(`🎊 두목봇 시작 완료 🎊`);
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

    const requiredEnvVars = ["BOT_TOKEN"];
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경 변수 누락: ${missingVars.join(", ")}`);
    }

    // MongoDB URI 확인 (MONGO_URL 또는 MONGODB_URI)
    if (!this.config.mongoUri) {
      throw new Error("MongoDB URI 누락 (MONGO_URL 또는 MONGODB_URI)");
    }

    // 토큰 형식 검증
    if (!this.config.botToken.includes(":")) {
      throw new Error("올바르지 않은 BOT_TOKEN 형식");
    }

    // MongoDB URI 검증
    if (!this.config.mongoUri.startsWith("mongodb")) {
      throw new Error("올바르지 않은 MongoDB URI 형식");
    }

    logger.debug("✅ 환경 변수 검증 완료");
  }

  /**
   * 🤖 Telegraf 봇 초기화
   */
  async initializeTelegrafBot() {
    logger.info("🤖 Telegraf 봇 초기화 중...");

    // Telegraf 인스턴스 생성
    this.bot = new Telegraf(this.config.botToken);

    // 기본 미들웨어 설정
    this.setupMiddleware();

    // 봇 정보 확인
    try {
      const botInfo = await this.bot.telegram.getMe();
      logger.info(`🤖 봇 연결됨: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      throw new Error(`봇 연결 실패: ${error.message}`);
    }

    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  /**
   * 🛠️ 미들웨어 설정
   */
  setupMiddleware() {
    // 로깅 미들웨어
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      try {
        await next();
        const duration = Date.now() - start;
        logger.debug(`처리 시간: ${duration}ms`);
      } catch (error) {
        logger.error("미들웨어 오류:", error);
        throw error;
      }
    });

    // 속도 제한 미들웨어
    if (this.config.rateLimitEnabled) {
      const rateLimitMap = new Map();

      this.bot.use(async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const now = Date.now();
        const userLimit = rateLimitMap.get(userId);

        if (!userLimit) {
          rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
          return next();
        }

        if (now > userLimit.resetTime) {
          rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
          return next();
        }

        if (userLimit.count >= this.config.maxRequestsPerMinute) {
          return ctx.reply(
            "⏱️ 잠시 기다려주세요. 너무 많은 요청을 보내고 있습니다."
          );
        }

        userLimit.count++;
        return next();
      });
    }

    // 에러 핸들링 미들웨어
    this.bot.catch((err, ctx) => {
      logger.error("Telegraf 오류:", err);
      try {
        ctx.reply("❌ 처리 중 오류가 발생했습니다.");
      } catch (replyError) {
        logger.error("오류 응답 실패:", replyError);
      }
    });
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
        family: 4,
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
      cacheTimeout: 300000,
      maxCacheSize: this.config.isRailway ? 500 : 1000,
    });

    logger.debug("✅ 중앙 검증 시스템 초기화 완료");
  }

  /**
   * 🏥 헬스체커 초기화
   */
  async initializeHealthChecker() {
    if (!this.config.enableHealthCheck) {
      logger.info("🏥 헬스체커 비활성화됨");
      return;
    }

    logger.info("🏥 헬스체커 초기화 중...");

    this.healthChecker = new HealthChecker({
      checkInterval: this.config.isRailway ? 120000 : 60000,
      components: {
        database: this.dbManager,
        moduleManager: () => this.moduleManager,
        botController: () => this.botController,
        validationManager: this.validationManager,
      },
    });

    await this.healthChecker.start();
    logger.debug("✅ 헬스체커 초기화 완료");
  }

  /**
   * 📦 모듈 매니저 초기화
   */
  async initializeModuleManager() {
    logger.info("📦 모듈 매니저 초기화 중...");

    const db = await this.dbManager.getDb();

    this.moduleManager = new ModuleManager({
      bot: this.bot,
      db: db,
      config: this.config,
    });

    await this.moduleManager.initialize();
    logger.debug("✅ 모듈 매니저 초기화 완료");
  }

  /**
   * 🎮 봇 컨트롤러 초기화
   */
  async initializeBotController() {
    logger.info("🎮 봇 컨트롤러 초기화 중...");

    const db = await this.dbManager.getDb();

    this.botController = new BotController({
      bot: this.bot,
      moduleManager: this.moduleManager,
      dbManager: this.dbManager,
      validationManager: this.validationManager,
      healthChecker: this.healthChecker,
      config: this.config,
    });

    await this.botController.initialize();
    logger.debug("✅ 봇 컨트롤러 초기화 완료");
  }

  /**
   * 🚀 봇 시작
   */
  async startBot() {
    logger.info("🚀 봇 시작 중...");

    if (this.config.isRailway && process.env.PORT) {
      // Railway 환경에서는 웹훅 사용
      const port = process.env.PORT;
      const domain =
        process.env.RAILWAY_PUBLIC_DOMAIN || process.env.WEBHOOK_DOMAIN;

      if (domain) {
        await this.bot.launch({
          webhook: {
            domain: `https://${domain}`,
            port: port,
          },
        });
        logger.info(`🌐 웹훅 모드로 시작됨 (포트: ${port})`);
      } else {
        // 도메인이 없으면 폴링 모드
        await this.bot.launch();
        logger.info("🔄 폴링 모드로 시작됨");
      }
    } else {
      // 로컬 환경에서는 폴링 사용
      await this.bot.launch();
      logger.info("🔄 폴링 모드로 시작됨");
    }

    logger.success("✅ 봇 시작 완료");
  }

  /**
   * 🛑 정상 종료
   */
  async stop() {
    logger.info("🛑 두목봇 종료 중...");

    try {
      // 봇 정지
      this.bot.stop("SIGINT");

      // 헬스체커 정지
      if (this.healthChecker) {
        await this.healthChecker.stop();
      }

      // 모듈 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 데이터베이스 연결 해제
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      logger.success("✅ 두목봇 정상 종료됨");
    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
    }
  }

  /**
   * 🚨 초기화 실패 처리
   */
  async handleInitializationFailure(error) {
    logger.error("🚨 초기화 실패 처리 중...");

    try {
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }
    } catch (cleanupError) {
      logger.error("정리 중 오류:", cleanupError);
    }

    if (this.config.isRailway) {
      logger.error("🚂 Railway 환경에서 초기화 실패 - 프로세스 종료");
      process.exit(1);
    }
  }

  /**
   * 🛡️ 프로세스 이벤트 핸들러
   */
  setupProcessHandlers() {
    // 정상 종료 신호
    process.once("SIGINT", () => this.handleShutdown("SIGINT"));
    process.once("SIGTERM", () => this.handleShutdown("SIGTERM"));

    // 비정상 종료
    process.on("uncaughtException", (error) => {
      logger.error("🚨 처리되지 않은 예외:", error);
      this.handleShutdown("EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("🚨 처리되지 않은 Promise 거부:", reason);
    });
  }

  /**
   * 🛑 종료 처리
   */
  async handleShutdown(signal) {
    logger.info(`🛑 종료 신호 수신: ${signal}`);

    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      logger.error("종료 중 오류:", error);
      process.exit(1);
    }
  }
}

// 🚀 애플리케이션 실행
if (require.main === module) {
  require("dotenv").config();

  const app = new DooMockBot();

  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
