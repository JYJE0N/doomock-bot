require("dotenv").config();

const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

/**
 * 🚀 메인 애플리케이션 v3.0.1
 *
 * 🎯 핵심 변경사항:
 * - ConfigManager.isRailwayEnvironment() 에러만 수정
 * - DatabaseManager는 그대로 유지
 * - 나머지 모든 기능 보존
 * - 안정적인 초기화 프로세스
 */
class DooMockBot {
  constructor() {
    // 🤖 텔레그래프 봇
    this.bot = null;

    // 🏗️ 핵심 매니저들
    this.dbManager = null; // ✅ DatabaseManager 유지!
    this.botController = null;
    this.moduleManager = null;

    // 🛡️ 중앙 시스템들
    this.validationManager = null;
    this.healthChecker = null;

    // ⚙️ 설정 (ConfigManager 메서드 호출만 제거)
    this.config = {
      // 봇 설정
      botToken: process.env.BOT_TOKEN,
      environment: process.env.NODE_ENV || "development",

      // 데이터베이스 설정 (그대로 유지)
      mongoUri: process.env.MONGODB_URI || process.env.MONGO_URL,
      dbName: process.env.DB_NAME || "DooMockBot",

      // Railway 최적화 (직접 체크로 변경 - 이것만 수정!)
      isRailway: !!process.env.RAILWAY_ENVIRONMENT, // ✅ 이 부분만 수정

      // 시스템 설정 (그대로 유지)
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
      logger.moduleStart("두목봇 v3.0.1 - Telegraf (ConfigManager 수정)");

      // 환경 검증
      await this.validateEnvironment();

      // 초기화 순서 (의존성 순) - 모든 컴포넌트 유지!
      await this.initializeTelegrafBot();
      await this.initializeDatabaseManager(); // ✅ DatabaseManager 초기화 유지!
      await this.initializeValidationManager();
      await this.initializeHealthChecker();
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
        `🗄️ 데이터베이스: ${
          this.dbManager?.isConnected ? "연결됨" : "연결 안됨"
        }`
      );
      logger.info(
        `🛡️ 검증 시스템: ${this.config.enableValidation ? "활성" : "비활성"}`
      );
      logger.info(
        `🏥 헬스체커: ${this.config.enableHealthCheck ? "활성" : "비활성"}`
      );
    } catch (error) {
      logger.error("🚨 애플리케이션 시작 실패:", error);
      await this.emergencyShutdown(error);
    }
  }

  /**
   * 🧪 환경 검증
   */
  async validateEnvironment() {
    logger.info("🧪 환경 검증 시작...");

    const required = ["BOT_TOKEN"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`필수 환경변수 누락: ${missing.join(", ")}`);
    }

    // MongoDB URI 검증
    if (!this.config.mongoUri) {
      throw new Error("MONGODB_URI 또는 MONGO_URL이 설정되지 않음");
    }

    // 환경 정보 출력
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

    if (!this.config.botToken) {
      throw new Error("BOT_TOKEN이 설정되지 않음");
    }

    this.bot = new Telegraf(this.config.botToken);

    // 기본 에러 처리
    this.bot.catch((err, ctx) => {
      logger.error("🤖 봇 에러:", err);
      logger.error("🔍 컨텍스트:", ctx?.update);
    });

    // 봇 정보 확인
    try {
      const botInfo = await this.bot.telegram.getMe();
      logger.info(`🤖 봇 연결됨: @${botInfo.username}`);
    } catch (error) {
      logger.warn("⚠️ 봇 정보 확인 실패:", error.message);
    }

    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  /**
   * 🗄️ 데이터베이스 매니저 초기화 (보안 처리)
   */
  async initializeDatabaseManager() {
    logger.info("🗄️ 데이터베이스 매니저 초기화 중...");

    try {
      // ✅ 핵심 수정! createInstance()로 URL 직접 전달
      const { createInstance } = require("./src/database/DatabaseManager");
      this.dbManager = createInstance(this.config.mongoUri);

      await this.dbManager.connect();
      logger.info("🗄️ 데이터베이스 연결 성공");
    } catch (error) {
      logger.error("❌ 데이터베이스 매니저 초기화 실패:", error);
      throw error;
    }

    // 🔒 보안 처리된 디버깅 정보
    const maskUrl = (url) => {
      if (!url) return "NULL";
      // mongodb://user:password@host:port/db 형태에서 password 마스킹
      return url.replace(/:([^:@]+)@/, ":***@");
    };

    console.log("🔍 config.mongoUri:", maskUrl(this.config.mongoUri));
    console.log("🔍 dbManager.mongoUrl:", maskUrl(this.dbManager.mongoUrl));
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
    if (!this.healthChecker) return;

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

    // TodoModule/TodoService 찾기 및 등록
    if (this.moduleManager && this.moduleManager.moduleInstances) {
      logger.debug(
        `🔍 등록된 모듈 수: ${this.moduleManager.moduleInstances.size}`
      );

      const moduleKeys = Array.from(this.moduleManager.moduleInstances.keys());
      logger.debug(`🔍 등록된 모듈 키들: ${moduleKeys.join(", ")}`);

      // TodoModule/TodoService 찾기
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
          "⚠️ TodoModule을 찾을 수 없음. 사용 가능한 키들을 확인하세요."
        );
      }
    }

    logger.debug("✅ 헬스체커 컴포넌트 등록 완료");
  }

  /**
   * 📦 모듈 매니저 초기화 (순환 참조 방지)
   */
  async initializeModuleManager() {
    logger.info("📦 모듈 매니저 초기화 중...");

    // ✅ DatabaseManager 존재 확인
    if (!this.dbManager || !this.dbManager.db) {
      throw new Error("DatabaseManager가 없거나 DB 연결이 없습니다.");
    }

    // ✅ 순환 참조 방지: ModuleManager 먼저 생성 (빈 상태)
    this.moduleManager = new ModuleManager({
      bot: this.bot,
      db: this.dbManager.db,
      config: {
        isRailway: this.config.isRailway,
        enableValidation: this.config.enableValidation,
        maxModules: 20,
        timeout: 30000,
      },
      validationManager: this.validationManager,
    });

    // ✅ ModuleManager 초기화 (모듈들 로드)
    await this.moduleManager.initialize();

    logger.info("📦 모듈 매니저 초기화 완료");
  }

  /**
   * 🎮 봇 컨트롤러 초기화 (순환 참조 방지)
   */
  async initializeBotController() {
    logger.info("🎮 봇 컨트롤러 초기화 중...");

    // ✅ ModuleManager 존재 확인
    if (!this.moduleManager) {
      throw new Error(
        "ModuleManager가 없습니다. ModuleManager를 먼저 초기화해주세요."
      );
    }

    // ✅ 순환 참조 방지: BotController는 ModuleManager만 참조 (역참조 없음)
    this.botController = new BotController({
      bot: this.bot,
      moduleManager: this.moduleManager, // ✅ 단방향 참조만!
      dbManager: this.dbManager,
      validationManager: this.validationManager,
      healthChecker: this.healthChecker,
      config: {
        rateLimitEnabled: this.config.rateLimitEnabled,
        maxRequestsPerMinute: this.config.maxRequestsPerMinute,
        messageTimeout: 5000,
        callbackTimeout: 2000,
        isRailway: this.config.isRailway,
      },
    });

    await this.botController.initialize();
    logger.info("🎮 봇 컨트롤러 초기화 완료");
  }

  /**
   * 🚀 봇 시작
   */
  async startBot() {
    logger.info("🚀 봇 시작 중...");

    try {
      // Railway 환경에서는 웹훅, 로컬에서는 폴링
      if (this.config.isRailway) {
        // Railway 웹훅 모드
        const port = process.env.PORT || 3000;

        // 기존 웹훅 삭제
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });

        // 웹훅 시작
        await this.bot.launch({
          webhook: {
            domain:
              process.env.RAILWAY_STATIC_URL ||
              `https://${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`,
            port: port,
            hookPath: "/webhook",
          },
        });

        logger.info(`🚂 Railway 웹훅 모드로 시작됨 (포트: ${port})`);
      } else {
        // 로컬 폴링 모드
        await this.bot.launch();
        logger.info("🏠 로컬 폴링 모드로 시작됨");
      }

      logger.success("✅ 봇 시작 완료");
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 프로세스 핸들러 설정
   */
  setupProcessHandlers() {
    // 정상 종료 신호들
    const signals = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`📡 ${signal} 신호 수신됨`);
        this.gracefulShutdown(signal);
      });
    });

    // Railway 헬스체크 신호
    if (this.config.isRailway) {
      process.on("SIGUSR2", () => {
        logger.debug("💓 Railway 헬스체크 수신");
      });
    }

    // 예외 처리 (Railway 안전)
    process.on("uncaughtException", async (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      await this.emergencyShutdown(error);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      // Railway에서는 즉시 종료하지 않고 로깅만
      if (this.config.isRailway) {
        logger.warn("⚠️ Railway 환경: Promise 거부 무시하고 계속 실행");
      }
    });

    // Railway 메모리 모니터링 (최적화)
    if (this.config.isRailway) {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        // Railway 메모리 제한: 512MB
        if (memUsedMB > 400) {
          logger.warn(`⚠️ 높은 메모리 사용량: ${memUsedMB}MB`);

          // 캐시 정리 시도
          if (global.gc) {
            global.gc();
            logger.debug("🧹 가비지 컬렉션 실행됨");
          }
        }
      }, 60000); // 1분마다 체크
    }
  }

  /**
   * 🛑 정상 종료 (Railway 최적화)
   */
  async gracefulShutdown(signal) {
    logger.info(`🛑 정상 종료 시작 (${signal})...`);

    try {
      // 🛡️ 1단계: 봇 연결 정리 (가장 중요!)
      if (this.bot) {
        logger.debug("🤖 봇 연결 종료 중...");

        try {
          // 웹훅 정리
          await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
          logger.debug("🧹 웹훅 정리됨");
        } catch (webhookError) {
          logger.debug("⚠️ 웹훅 정리 실패 (무시)");
        }

        // 봇 정지
        this.bot.stop(signal);
        logger.debug("✅ 봇 정지됨");
      }

      // 2단계: 헬스체커 정지
      if (this.healthChecker) {
        await this.healthChecker.stop();
        logger.debug("🏥 헬스체커 정지됨");
      }

      // 3단계: 모듈 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
        logger.debug("📦 모듈 정리됨");
      }

      // 4단계: 데이터베이스 연결 해제 (중요!)
      if (this.dbManager) {
        await this.dbManager.disconnect();
        logger.debug("🗄️ DB 연결 해제됨");
      }

      // Railway: 정상 종료 신호
      logger.success("✅ 정상 종료 완료");

      // Railway 종료 대기 (중복 방지)
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (error) {
      logger.error("❌ 정상 종료 실패:", error);
      await this.emergencyShutdown(error);
    }
  }

  /**
   * 🚨 비상 종료
   */
  async emergencyShutdown(error) {
    logger.error("🚨 비상 종료 실행...");

    try {
      // 최소한의 정리만
      if (this.bot) {
        this.bot.stop("SIGKILL");
      }

      if (this.dbManager) {
        await this.dbManager.disconnect();
      }
    } catch (cleanupError) {
      logger.error("❌ 비상 정리 실패:", cleanupError);
    } finally {
      logger.error("💥 비상 종료됨");
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
