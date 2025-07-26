require("dotenv").config();

const {
  ServiceBuilder,
  createServiceBuilder,
} = require("./src/core/ServiceBuilder");
const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");

// 🗄️ 데이터베이스 매니저
const {
  DatabaseManager,
  createInstance,
} = require("./src/database/DatabaseManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

/**
 * 🚀 메인 애플리케이션 v3.0.1 - Telegraf 버전 (DatabaseManager import 수정)
 *
 * 🎯 핵심 수정사항:
 * - DatabaseManager import 추가
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

    // 🏗️ ServiceBuilder 추가
    this.serviceBuilder = null;

    // ⚙️ 설정
    this.config = {
      // 봇 설정
      botToken: process.env.BOT_TOKEN,
      environment: process.env.NODE_ENV || "development",

      // 데이터베이스 설정
      mongoUri: process.env.MONGO_URL || process.env.MONGODB_URI,
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
      logger.moduleStart("두목봇 v3.0.1 - ServiceBuilder 추가");

      // 환경 검증
      await this.validateEnvironment();

      // 초기화 순서 (의존성 순) - 수정됨
      await this.initializeDatabaseManager();
      await this.initializeServiceBuilder(); // ⭐ ServiceBuilder 추가
      await this.initializeValidationManager();
      await this.initializeHealthChecker();
      await this.initializeModuleManager(); // ServiceBuilder 이후
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
    } catch (error) {
      logger.error("❌ 애플리케이션 시작 실패:", error);
      await this.shutdown(1);
    }
  }

  /**
   * 🔍 환경 검증
   */
  async validateEnvironment() {
    logger.info("🧪 환경 검증 시작...");

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

    // 🔍 환경 정보 출력
    console.log("🔍 환경 정보:");
    console.log(`   NODE_ENV: ${this.config.environment}`);
    console.log(`   Railway: ${this.config.isRailway ? "활성" : "비활성"}`);
    console.log(`   MongoDB URI: ${this.config.mongoUri ? "있음" : "없음"}`);

    logger.debug("✅ 환경 검증 완료");
  }

  /**
   * 🤖 Telegraf 봇 초기화
   */
  async initializeTelegrafBot() {
    logger.info("🤖 Telegraf 봇 초기화 중...");

    this.bot = new Telegraf(this.config.botToken);

    // 봇 정보 확인
    const botInfo = await this.bot.telegram.getMe();
    logger.info(`🤖 봇 연결됨: @${botInfo.username}`);

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
   * 🗄️ 데이터베이스 매니저 초기화 (수정된 DatabaseManager 사용)
   */
  async initializeDatabaseManager() {
    logger.info("🗄️ 데이터베이스 매니저 초기화 중...");

    try {
      // ✅ 수정: 수정된 createInstance 사용
      this.dbManager = createInstance(this.config.mongoUri);

      console.log(
        "🔍 DatabaseManager 모듈 내용:",
        Object.keys(require("./src/database/DatabaseManager"))
      );
      logger.info("🗄️ DatabaseManager 생성됨");

      // URL 설정 확인
      console.log("🔧 DatabaseManager에 직접 URL 설정 중...");
      console.log(
        "🔍 dbManager.mongoUrl:",
        this.dbManager.mongoUrl ? "설정됨" : "없음"
      );

      // MongoDB 연결 시도
      logger.info("🔌 MongoDB 연결 중...");
      await this.dbManager.connect();

      logger.info("🗄️ 데이터베이스 연결 성공");

      // 🔍 디버깅 정보 출력
      console.log("🔍 config.mongoUri:", this.config.mongoUri);
      console.log("🔍 process.env.MONGO_URL:", process.env.MONGO_URL);
      console.log("🔍 dbManager.mongoUrl:", this.dbManager.mongoUrl);
      console.log("🔍 dbManager 생성:", !!this.dbManager);
      console.log("🔍 연결 상태:", this.dbManager.isConnected);

      logger.debug("✅ 데이터베이스 매니저 초기화 완료");
    } catch (error) {
      // ✅ 추가: 정확한 에러 메시지 출력
      logger.error("❌ 데이터베이스 매니저 초기화 실패:", error.message);
      logger.error("❌ 전체 에러:", error);
      console.error("🔍 전체 에러 스택:", error.stack);
      throw error;
    }
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
   * 🏗️ ServiceBuilder 초기화 (새로 추가)
   */
  async initializeServiceBuilder() {
    logger.info("🏗️ ServiceBuilder 초기화 중...");

    this.serviceBuilder = createServiceBuilder();

    // ServiceBuilder에 DB 연결 전달
    this.serviceBuilder.setDefaultDatabase(this.dbManager.getDb());

    await this.serviceBuilder.initialize();

    logger.debug("✅ ServiceBuilder 초기화 완료");
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
          `⚠️ TodoModule을 찾을 수 없음. 가능한 키들을 시도했음: ${possibleTodoKeys.join(
            ", "
          )}`
        );
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
    logger.info("📦 ModuleManager 초기화 중...");

    const {
      ModuleManager,
      createModuleManager,
    } = require("./src/core/ModuleManager");

    this.moduleManager = createModuleManager({
      bot: this.bot,
      db: this.dbManager ? this.dbManager.getDb() : null,
      serviceBuilder: this.serviceBuilder, // ⭐ ServiceBuilder 전달
      config: this.config,
      enableCache: this.config.moduleCacheEnabled !== false,
      isRailway: this.config.isRailway,
    });

    // ServiceBuilder 설정 (추가 안전장치)
    if (this.moduleManager.setServiceBuilder) {
      this.moduleManager.setServiceBuilder(this.serviceBuilder);
    }

    await this.moduleManager.initialize();

    logger.debug("✅ ModuleManager 초기화 완료");
  }

  /**
   * 📝 레지스트리에서 모듈 로드
   */
  async loadModulesFromRegistry() {
    try {
      const { getEnabledModules } = require("./src/config/ModuleRegistry");
      const enabledModules = getEnabledModules();

      logger.info(`📝 ${enabledModules.length}개 모듈 로드 시작...`);

      let successCount = 0;
      let failCount = 0;

      // 우선순위 순으로 이미 정렬됨
      for (const moduleConfig of enabledModules) {
        try {
          const ModuleClass = require(moduleConfig.path);

          const registered = this.moduleManager.registerModule(
            moduleConfig.key,
            ModuleClass,
            {
              name: moduleConfig.name,
              description: moduleConfig.description,
              priority: moduleConfig.priority,
              required: moduleConfig.required,
              moduleConfig: moduleConfig.config,
            }
          );

          if (registered) {
            logger.success(`✅ ${moduleConfig.name} (${moduleConfig.key})`);
            successCount++;
          }
        } catch (error) {
          logger.error(`❌ ${moduleConfig.name} 로드 실패:`, error.message);
          failCount++;

          // 필수 모듈이 실패하면 종료
          if (moduleConfig.required) {
            throw new Error(`필수 모듈 ${moduleConfig.name} 로드 실패`);
          }
        }
      }

      logger.info(
        `📊 모듈 로드 완료: ${successCount}개 성공, ${failCount}개 실패`
      );

      // 모든 모듈 초기화
      await this.moduleManager.initializeAllModules();
    } catch (error) {
      logger.error("❌ 모듈 레지스트리 로드 실패:", error);
      throw error;
    }
  }

  /**
   * 🚀 봇 시작 (수정된 버전)
   */
  async startBot() {
    logger.info("🚀 봇 시작 중...");

    try {
      // ✅ 수정: BotController의 bot 인스턴스 사용
      if (!this.bot || !this.botController) {
        throw new Error("봇 또는 봇 컨트롤러가 초기화되지 않았습니다");
      }

      // 🌐 Webhook 설정 (Railway)
      if (this.config.isRailway) {
        const port = process.env.PORT || 3000;
        const domain =
          process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;

        if (domain) {
          const webhookUrl = `https://${domain}/${this.config.botToken}`;
          await this.bot.telegram.setWebhook(webhookUrl);

          // Express 앱이 필요한 경우 별도 설정
          logger.info(`🌐 웹훅 설정 완료: ${webhookUrl}`);
        }
      } else {
        // 로컬 환경: polling 모드
        await this.bot.launch({
          dropPendingUpdates: true,
        });
        logger.info("🚀 봇 시작됨 (polling 모드)");
      }

      logger.success("✅ 두목봇이 준비되었습니다!");
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🎮 봇 컨트롤러 초기화 (상세 디버깅)
   */
  /**
   * 🎮 봇 컨트롤러 초기화 (수정된 버전)
   */

  async initializeBotController() {
    logger.info("🎮 봇 컨트롤러 초기화 중...");

    // 🔍 전달되는 매개변수 디버깅
    console.log("🔍 BotController에 전달되는 매개변수들:");
    console.log("   bot:", !!this.bot);
    console.log("   moduleManager:", !!this.moduleManager);
    console.log("   moduleManager 타입:", typeof this.moduleManager);
    console.log(
      "   moduleManager 생성자:",
      this.moduleManager?.constructor?.name
    );
    console.log("   dbManager:", !!this.dbManager);
    console.log("   validationManager:", !!this.validationManager);
    console.log("   healthChecker:", !!this.healthChecker);
    console.log("   config:", !!this.config);

    // 🔍 ModuleManager 상세 확인
    if (this.moduleManager) {
      console.log("🔍 ModuleManager 상세 정보:");
      console.log("   isInitialized:", this.moduleManager.isInitialized);
      console.log("   moduleInstances:", !!this.moduleManager.moduleInstances);
      console.log(
        "   메서드들:",
        Object.getOwnPropertyNames(Object.getPrototypeOf(this.moduleManager))
      );
    }

    // ✅ 수정: BotController 생성자에 맞게 매개변수 전달
    this.botController = new BotController(
      this.config.botToken, // 첫 번째 매개변수: botToken
      {
        // 두 번째 매개변수: config 객체
        ...this.config,
        webhookMode: this.config.isRailway, // Railway 환경에서는 webhook 모드 사용
      }
    );

    // ✅ 수정: initialize 메서드에 moduleManager 전달
    await this.botController.initialize(this.moduleManager);

    // ✅ 추가: 다른 의존성들 직접 설정
    this.botController.dbManager = this.dbManager;
    this.botController.validationManager = this.validationManager;
    this.botController.healthChecker = this.healthChecker;

    // ✅ 중요: DooMockBot의 bot 인스턴스를 BotController의 bot으로 교체
    this.bot = this.botController.bot;

    logger.debug("✅ 봇 컨트롤러 초기화 완료");
  }

  /**
   * 🚀 봇 시작 (Railway 중복 실행 방지)
   */
  async startBot() {
    logger.info("🚀 봇 시작 중...");

    try {
      // 🛡️ 1단계: 기존 연결 정리 (핵심!)
      logger.debug("🧹 기존 봇 연결 정리 중...");

      try {
        await this.bot.telegram.deleteWebhook();
        logger.debug("✅ 웹훅 정리됨");
      } catch (webhookError) {
        logger.debug("⚠️ 웹훅 정리 실패 (무시):", webhookError.message);
      }

      // 🛡️ 2단계: 안전 대기 (충돌 방지)
      logger.debug("⏳ 안전 대기 중... (3초)");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 🛡️ 3단계: Railway 환경별 시작 방식
      if (this.config.isRailway) {
        await this.startRailwayBot();
      } else {
        await this.startLocalBot();
      }

      logger.success("✅ 봇 시작 완료");
    } catch (error) {
      await this.handleBotStartError(error);
    }
  }

  /**
   * 🚂 Railway 환경 봇 시작
   */
  async startRailwayBot() {
    logger.info("🚂 Railway 폴링 모드 시작 (최적화)");
    await this.startPollingMode();
  }

  /**
   * 🏠 로컬 환경 봇 시작
   */
  async startLocalBot() {
    logger.info("🏠 로컬 폴링 모드 시작");
    await this.startPollingMode();
  }

  /**
   * 🔄 폴링 모드 시작 (Railway 최적화)
   */
  async startPollingMode() {
    await this.bot.launch({
      polling: {
        timeout: 30,
        limit: 100,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true, // 🔥 중요: 이전 업데이트 무시
      },
    });
  }

  /**
   * 🚨 봇 시작 에러 처리 (409 Conflict 특별 처리)
   */
  async handleBotStartError(error) {
    logger.error("❌ 봇 시작 실패:", error.message);

    // 409 Conflict 특별 처리
    if (error.response?.error_code === 409) {
      logger.warn("⚠️ 봇 중복 실행 감지! 복구 시도 중...");

      // 강제 정리 및 재시도
      await this.forceBotRecovery();
    } else {
      // 다른 에러는 그대로 던지기
      throw error;
    }
  }

  /**
   * 🛠️ 봇 강제 복구 (409 에러 시)
   */
  async forceBotRecovery() {
    try {
      logger.info("🔧 봇 강제 복구 시작...");

      // 1. 웹훅 완전 삭제
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.debug("🧹 웹훅 및 대기 업데이트 정리됨");

      // 2. 더 긴 대기
      logger.debug("⏳ 복구 대기 중... (10초)");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // 3. 폴링 모드로 재시도
      logger.info("🔄 폴링 모드로 복구 시도");
      await this.startPollingMode();

      logger.success("✅ 봇 복구 성공!");
    } catch (recoveryError) {
      logger.error("❌ 봇 복구 실패:", recoveryError);
      throw recoveryError;
    }
  }

  /**
   * 🚨 초기화 실패 처리
   */
  async handleInitializationFailure(error) {
    logger.error("🚨 애플리케이션 시작 실패:");
    logger.error(error);

    // 응급 정리
    logger.error("🚨 비상 종료 실행...");
    try {
      await this.cleanup();
    } catch (cleanupError) {
      logger.error("❌ 비상 정리 실패:");
      logger.error(cleanupError);
    }

    logger.error("💥 비상 종료됨");
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.info("🧹 정리 작업 시작...");

    try {
      // 봇 중지
      if (this.bot) {
        await this.bot.stop();
        logger.debug("✅ 봇 중지됨");
      }

      // 헬스체커 중지
      if (this.healthChecker) {
        await this.healthChecker.stop();
        logger.debug("✅ 헬스체커 중지됨");
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
        logger.debug("✅ 데이터베이스 연결 종료됨");
      }

      logger.success("✅ 정리 작업 완료");
    } catch (error) {
      logger.error("❌ 정리 작업 실패:", error);
    }
  }

  /**
   * 🔧 프로세스 이벤트 핸들러 설정
   */
  setupProcessHandlers() {
    // 정상 종료 처리
    process.once("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.once("SIGTERM", () => this.gracefulShutdown("SIGTERM"));

    // 예외 처리
    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      logger.debug("Promise:", promise);
      this.gracefulShutdown("unhandledRejection");
    });
  }

  /**
   * 🚪 정상 종료
   */
  async gracefulShutdown(signal) {
    logger.info(`📥 종료 신호 수신: ${signal}`);
    logger.info("🚪 정상 종료 프로세스 시작...");

    try {
      await this.cleanup();
      logger.success("✅ 정상 종료 완료");
      process.exit(0);
    } catch (error) {
      logger.error("❌ 정상 종료 실패:", error);
      process.exit(1);
    }
  }
}

// 🚀 애플리케이션 인스턴스 생성 및 시작
const app = new DooMockBot();

// 즉시 시작 (Railway 환경 고려)
if (require.main === module) {
  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
