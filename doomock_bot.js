// doomock_bot.js - 의존성 주입 적용 버전

// ✅ 1. 환경변수 최우선 로드
require("dotenv").config();

// ✅ 2. 핵심 모듈들
const logger = require("./src/utils/Logger");
const DIContainer = require("./src/core/DIContainer");
const EventBus = require("./src/core/EventBus");

// ✅ 3. 표준화 시스템
const {
  DuplicationPreventer,
  ParameterValidator,
  StandardizedBaseModule,
  STANDARD_PARAMS,
} = require("./src/core/StandardizedSystem");

const TimeHelper = require("./src/utils/TimeHelper");
const TelegramBot = require("node-telegram-bot-api");
const AppConfig = require("./src/config/AppConfig");

// ✅ 메인 봇 클래스 (의존성 주입 적용)
class DoomockBot {
  constructor() {
    if (DoomockBot._instance) {
      logger.warn("⚠️ DoomockBot 이미 생성됨, 기존 인스턴스 반환");
      return DoomockBot._instance;
    }

    this.bot = null;
    this.isInitialized = false;
    this.config = AppConfig;

    // 의존성 컨테이너 설정
    this.setupDependencies();

    DoomockBot._instance = this;
    logger.info("🤖 DoomockBot v3.0.1 생성됨 (DI 패턴 적용)");
  }

  // 의존성 등록
  setupDependencies() {
    // Bot 인스턴스
    DIContainer.register("bot", () => this.bot);

    // Config
    DIContainer.register("config", () => this.config);

    // Database Manager
    DIContainer.register("dbManager", (container) => {
      const {
        DatabaseManager,
        getInstance,
      } = require("./src/database/DatabaseManager");
      return getInstance();
    });

    // Services - Lazy Loading
    DIContainer.register("todoService", () => {
      const TodoService = require("./src/services/TodoService");
      return new TodoService();
    });

    DIContainer.register("weatherService", () => {
      const WeatherService = require("./src/services/WeatherService");
      return new WeatherService();
    });

    DIContainer.register("worktimeService", () => {
      const WorktimeService = require("./src/services/WorktimeService");
      return new WorktimeService();
    });

    DIContainer.register("timerService", () => {
      const TimerService = require("./src/services/TimerService");
      return new TimerService();
    });

    DIContainer.register("reminderService", () => {
      const ReminderService = require("./src/services/ReminderService");
      return new ReminderService();
    });

    // Utilities
    DIContainer.register("timeHelper", () => TimeHelper);
    DIContainer.register("logger", () => logger);
    DIContainer.register("eventBus", () => EventBus);

    logger.info("✅ 의존성 컨테이너 설정 완료");
  }

  async initialize() {
    if (this.isInitialized) {
      logger.warn("⚠️ DoomockBot 이미 초기화됨");
      return;
    }

    try {
      logger.info("🚀 DoomockBot 전체 초기화 시작...");

      // 초기화 순서
      await this.initializeTelegramBot();
      await this.initializeDatabaseManager();
      await this.initializeModuleManager();
      await this.initializeBotController();
      await this.startPolling();
      await this.sendStartupNotification();

      this.isInitialized = true;
      logger.success("🎉 DoomockBot 전체 초기화 완료!");
    } catch (error) {
      logger.error("💥 DoomockBot 초기화 실패:", error);
      throw error;
    }
  }

  async initializeTelegramBot() {
    try {
      logger.info("🤖 텔레그램 봇 초기화 중...");

      this.bot = new TelegramBot(this.config.BOT_TOKEN, {
        polling: false,
        filepath: false,
        onlyFirstMatch: true,
      });

      // Bot 인스턴스 업데이트
      DIContainer.register("bot", () => this.bot);

      logger.success("✅ 텔레그램 봇 초기화 완료");
    } catch (error) {
      logger.error("❌ 텔레그램 봇 초기화 실패:", error);
      throw error;
    }
  }

  async initializeDatabaseManager() {
    try {
      logger.info("🗄️ 데이터베이스 매니저 초기화 중...");

      if (!this.config.MONGO_URL) {
        logger.warn("⚠️ MongoDB URL 없음, 메모리 모드로 실행");
        return;
      }

      const dbManager = DIContainer.get("dbManager");
      await dbManager.connect();

      logger.success("✅ 데이터베이스 연결 성공");
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 실패:", error);
      logger.warn("⚠️ 데이터베이스 없이 실행");
    }
  }

  async initializeModuleManager() {
    try {
      logger.info("🧩 모듈 매니저 초기화 중...");

      const ModuleManager = require("./src/managers/ModuleManager");
      const moduleManager = new ModuleManager(this.bot, {
        container: DIContainer,
      });

      await moduleManager.initialize();

      DIContainer.register("moduleManager", () => moduleManager);

      logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      logger.error("❌ 모듈 매니저 초기화 실패:", error);
      logger.warn("⚠️ 모듈 없이 기본 기능만 실행");
    }
  }

  async initializeBotController() {
    try {
      logger.info("🎮 봇 컨트롤러 초기화 중...");

      const BotController = require("./src/controllers/BotController");
      const botController = new BotController(this.bot, {
        container: DIContainer,
      });

      await botController.initialize();

      DIContainer.register("botController", () => botController);

      logger.success("✅ 봇 컨트롤러 초기화 완료");
    } catch (error) {
      logger.error("❌ 봇 컨트롤러 초기화 실패:", error);
      throw error;
    }
  }

  async cleanup() {
    try {
      logger.info("🧹 정리 작업 시작...");

      // 모든 서비스 정리
      const botController = DIContainer.get("botController");
      if (botController) await botController.cleanup();

      const moduleManager = DIContainer.get("moduleManager");
      if (moduleManager) await moduleManager.cleanup();

      const dbManager = DIContainer.get("dbManager");
      if (dbManager) await dbManager.disconnect();

      if (this.bot) {
        await this.bot.stopPolling();
      }

      // 컨테이너 정리
      DIContainer.clear();

      logger.success("✅ 정리 작업 완료");
    } catch (error) {
      logger.error("❌ 정리 작업 실패:", error);
    }
  }
}

// 메인 실행
async function main() {
  try {
    logger.info("🎬 두목봇 3.0.1 시작 중... (DI 패턴 적용)");

    const doomockBot = new DoomockBot();

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("🛑 종료 신호 받음...");
      await doomockBot.cleanup();
      process.exit(0);
    });

    await doomockBot.initialize();

    logger.success("🎉 두목봇 3.0.1 실행 준비 완료!");
  } catch (error) {
    logger.error("💥 봇 실행 실패:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DoomockBot;
