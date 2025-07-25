// doomock_bot.js - v3.0.1 Telegraf 마이그레이션 버전 (수정됨)
const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

/**
 * 🚀 메인 애플리케이션 v3.0.1 - Telegraf 버전 (HealthChecker 수정)
 *
 * 🎯 핵심 변경사항:
 * - node-telegram-bot-api → Telegraf 마이그레이션
 * - Context 기반 처리
 * - Middleware 지원
 * - 더 나은 에러 처리
 * - HealthChecker 컴포넌트 등록 시스템 개선
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
      await this.initializeHealthChecker(); // 생성만 함, start()는 나중에
      await this.initializeModuleManager();
      await this.initializeBotController();

      // 🏥 모든 컴포넌트가 초기화된 후 헬스체커에 등록 및 시작
      if (this.healthChecker && this.config.enableHealthCheck) {
        await this.registerHealthCheckerComponents();
        await this.healthChecker.start();
        logger.info("🏥 헬스체커 시작됨");
      }

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
      logger.error("🚨 두목봇 시작 실패:", error);
      await this.handleInitializationFailure(error);
      process.exit(1);
    }
  }

  /**
   * 🔍 환경 검증
   */
  async validateEnvironment() {
    logger.info("🔍 환경 검증 중...");

    const requiredEnvVars = ["BOT_TOKEN"];
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수 누락: ${missingVars.join(", ")}`);
    }

    // MongoDB URI 확인
    if (!this.config.mongoUri) {
      logger.warn(
        "⚠️ MongoDB URI가 설정되지 않음. 일부 기능이 제한될 수 있습니다."
      );
    }

    logger.debug("✅ 환경 검증 완료");
  }

  /**
   * 🤖 Telegraf 봇 초기화
   */
  async initializeTelegrafBot() {
    logger.info("🤖 Telegraf 봇 초기화 중...");

    this.bot = new Telegraf(this.config.botToken);

    // 기본 미들웨어 설정
    this.setupTelegrafMiddleware();

    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  /**
   * 🔧 Telegraf 미들웨어 설정
   */
  setupTelegrafMiddleware() {
    // 요청 제한 미들웨어 (옵션)
    if (this.config.rateLimitEnabled) {
      const userLimits = new Map();

      this.bot.use((ctx, next) => {
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
        if (userLimit.count >= this.config.maxRequestsPerMinute) {
          return ctx.reply(
            "⚠️ 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\n" +
              "너무 많은 요청을 보내고 있습니다."
          );
        }

        userLimit.count++;
        userLimits.set(userId, userLimit);
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

    // DatabaseManager를 올바르게 import
    const { DatabaseManager } = require("./src/database/DatabaseManager");

    // 직접 인스턴스 생성 (mongoUrl만 전달)
    this.dbManager = new DatabaseManager(this.config.mongoUri);

    await this.dbManager.connect();
    logger.debug("✅ 데이터베이스 매니저 초기화 완료");

    console.log("🔍 MONGO_URL:", process.env.MONGO_URL ? "있음" : "없음");
    console.log("🔍 config.mongoUri:", this.config.mongoUri);
    console.log("🔍 dbManager 생성 후:", !!this.dbManager);
    console.log("🔍 연결 시도 후:", this.dbManager.isConnected);
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
   * 🏥 헬스체커 초기화 (start()는 나중에)
   */
  async initializeHealthChecker() {
    if (!this.config.enableHealthCheck) {
      logger.info("🏥 헬스체커 비활성화됨");
      return;
    }

    logger.info("🏥 헬스체커 초기화 중...");

    this.healthChecker = new HealthChecker({
      checkInterval: this.config.isRailway ? 120000 : 60000,
      // 빈 컴포넌트로 시작 - 나중에 등록할 예정
    });

    logger.debug("✅ 헬스체커 초기화 완료");
  }

  /**
   * 🏥 헬스체커에 컴포넌트 등록 (모든 컴포넌트 초기화 후)
   */
  async registerHealthCheckerComponents() {
    logger.info("🏥 헬스체커 컴포넌트 등록 중...");

    // 실제 인스턴스들을 직접 등록
    if (this.dbManager) {
      this.healthChecker.registerComponent("database", this.dbManager);
      logger.debug("🔧 DatabaseManager 등록됨");
    }

    if (this.moduleManager) {
      this.healthChecker.registerComponent("moduleManager", this.moduleManager);
      logger.debug("🔧 ModuleManager 등록됨");
    }

    if (this.botController) {
      this.healthChecker.registerComponent("botController", this.botController);
      logger.debug("🔧 BotController 등록됨");
    }

    if (this.validationManager) {
      this.healthChecker.registerComponent(
        "validationManager",
        this.validationManager
      );
      logger.debug("🔧 ValidationManager 등록됨");
    }

    // ✅ 수정: ModuleManager의 실제 등록 키 사용
    if (this.moduleManager && this.moduleManager.moduleInstances) {
      logger.debug(
        `🔍 등록된 모듈 수: ${this.moduleManager.moduleInstances.size}`
      );

      // 모든 등록된 모듈 키 출력 (디버깅용)
      const moduleKeys = Array.from(this.moduleManager.moduleInstances.keys());
      logger.debug(`🔍 등록된 모듈 키들: ${moduleKeys.join(", ")}`);

      // ✅ TodoModule/TodoService 찾기 - "todo" 키로 수정
      const possibleTodoKeys = ["todo", "TodoModule", "todoModule", "Todo"];
      let todoModule = null;
      let foundKey = null;

      for (const key of possibleTodoKeys) {
        const module = this.moduleManager.moduleInstances.get(key);
        if (module) {
          todoModule = module;
          foundKey = key;
          break;
        }
      }

      if (todoModule && todoModule.todoService) {
        this.healthChecker.registerComponent(
          "todoService",
          todoModule.todoService
        );
        logger.debug(`🔧 TodoService 등록됨 (키: ${foundKey})`);
      } else if (todoModule) {
        logger.warn(`⚠️ ${foundKey} 모듈은 있지만 todoService가 없음`);
        logger.debug(
          `📋 ${foundKey} 모듈 속성: ${Object.keys(todoModule).join(", ")}`
        );
      } else {
        logger.warn(
          `⚠️ TodoModule을 찾을 수 없음. 시도한 키: ${possibleTodoKeys.join(
            ", "
          )}`
        );

        // 실제로 있는 모듈들의 정보 출력 (디버깅)
        for (const [key, module] of this.moduleManager.moduleInstances) {
          const services = [];
          if (module.todoService) services.push("todoService");
          if (module.timerService) services.push("timerService");
          if (module.worktimeService) services.push("worktimeService");

          logger.debug(`📋 모듈 ${key}: 서비스 [${services.join(", ")}]`);
        }
      }

      // ✅ TimerModule/TimerService 찾기 - "timer" 키로 수정
      const possibleTimerKeys = [
        "timer",
        "TimerModule",
        "timerModule",
        "Timer",
      ];
      let timerModule = null;

      for (const key of possibleTimerKeys) {
        const module = this.moduleManager.moduleInstances.get(key);
        if (module && module.timerService) {
          this.healthChecker.registerComponent(
            "timerService",
            module.timerService
          );
          logger.debug(`🔧 TimerService 등록됨 (키: ${key})`);
          timerModule = module;
          break;
        }
      }

      // ✅ WorktimeModule/WorktimeService 찾기 - "worktime" 키로 수정
      const possibleWorktimeKeys = [
        "worktime",
        "WorktimeModule",
        "worktimeModule",
        "Worktime",
      ];
      let worktimeModule = null;

      for (const key of possibleWorktimeKeys) {
        const module = this.moduleManager.moduleInstances.get(key);
        if (module && module.worktimeService) {
          this.healthChecker.registerComponent(
            "worktimeService",
            module.worktimeService
          );
          logger.debug(`🔧 WorktimeService 등록됨 (키: ${key})`);
          worktimeModule = module;
          break;
        }
      }

      // ✅ LeaveModule/LeaveService 찾기 - "leave" 키로 수정
      const possibleLeaveKeys = [
        "leave",
        "LeaveModule",
        "leaveModule",
        "Leave",
      ];
      let leaveModule = null;

      for (const key of possibleLeaveKeys) {
        const module = this.moduleManager.moduleInstances.get(key);
        if (module && module.leaveService) {
          this.healthChecker.registerComponent(
            "leaveService",
            module.leaveService
          );
          logger.debug(`🔧 LeaveService 등록됨 (키: ${key})`);
          leaveModule = module;
          break;
        }
      }

      // ✅ ReminderModule/ReminderService 찾기 - "reminder" 키로 수정
      const possibleReminderKeys = [
        "reminder",
        "ReminderModule",
        "reminderModule",
        "Reminder",
      ];
      let reminderModule = null;

      for (const key of possibleReminderKeys) {
        const module = this.moduleManager.moduleInstances.get(key);
        if (module && module.reminderService) {
          this.healthChecker.registerComponent(
            "reminderService",
            module.reminderService
          );
          logger.debug(`🔧 ReminderService 등록됨 (키: ${key})`);
          reminderModule = module;
          break;
        }
      }

      // ✅ 등록 못 찾은 모듈들 요약 로깅
      const searchedModules = [
        { name: "TodoModule", found: !!todoModule },
        { name: "TimerModule", found: !!timerModule },
        { name: "WorktimeModule", found: !!worktimeModule },
        { name: "LeaveModule", found: !!leaveModule },
        { name: "ReminderModule", found: !!reminderModule },
      ];

      const foundCount = searchedModules.filter((m) => m.found).length;
      const totalCount = searchedModules.length;

      logger.info(
        `🔧 HealthChecker 서비스 등록 완료: ${foundCount}/${totalCount}개 모듈 서비스 발견`
      );

      // 못 찾은 모듈들 요약
      const notFound = searchedModules
        .filter((m) => !m.found)
        .map((m) => m.name);
      if (notFound.length > 0) {
        logger.debug(`⚠️ 서비스를 찾지 못한 모듈: ${notFound.join(", ")}`);
      }
    } else {
      logger.warn("⚠️ ModuleManager 또는 moduleInstances가 없음");
    }

    logger.debug("✅ 헬스체커 컴포넌트 등록 완료");
  }

  /**
   * 📦 모듈 매니저 초기화
   */
  async initializeModuleManager() {
    logger.info("📦 모듈 매니저 초기화 중...");

    // dbManager.db 직접 접근
    const db = this.dbManager.db;

    this.moduleManager = new ModuleManager({
      bot: this.bot,
      db: db,
      config: this.config,
      validationManager: this.validationManager, // ✅ 반드시 있어야 함
    });

    await this.moduleManager.initialize();
    logger.debug("✅ 모듈 매니저 초기화 완료");
  }

  /**
   * 🎮 봇 컨트롤러 초기화
   */
  async initializeBotController() {
    logger.info("🎮 봇 컨트롤러 초기화 중...");

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
      if (this.bot) {
        this.bot.stop("SIGINT");
      }

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

      if (this.healthChecker) {
        await this.healthChecker.stop();
      }

      logger.error("💥 두목봇 비정상 종료됨");
    } catch (cleanupError) {
      logger.error("❌ 정리 작업 실패:", cleanupError);
    }
  }

  /**
   * 🔧 프로세스 이벤트 핸들러 설정
   */
  setupProcessHandlers() {
    // 정상 종료 시그널 처리
    process.once("SIGINT", () => {
      logger.info("📡 SIGINT 수신 - 정상 종료 시작");
      this.stop().then(() => process.exit(0));
    });

    process.once("SIGTERM", () => {
      logger.info("📡 SIGTERM 수신 - 정상 종료 시작");
      this.stop().then(() => process.exit(0));
    });

    // 예외 처리
    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.handleInitializationFailure(error).then(() => process.exit(1));
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      logger.error("Promise:", promise);
    });

    // Railway 환경에서의 메모리 모니터링
    if (this.config.isRailway) {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        if (memUsedMB > 450) {
          // Railway 메모리 제한 근처
          logger.warn(`⚠️ 높은 메모리 사용량: ${memUsedMB}MB`);
        }
      }, 60000); // 1분마다 체크
    }
  }
}

// 애플리케이션 인스턴스 생성 및 시작
const app = new DooMockBot();

// 즉시 시작 (Railway 환경 고려)
if (require.main === module) {
  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
