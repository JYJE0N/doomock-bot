// doomock_bot.js - v3.0.1 DatabaseManager import 수정

// ✅ 1. 환경변수 최우선 로드 (무조건 첫 번째!)
require("dotenv").config();

// ✅ 2. Logger 인스턴스로 로드 (변수명 변경!)
const logger = require("./src/utils/Logger");

// ✅ 3. 표준화 시스템 (🎯 핵심!)
const {
  DuplicationPreventer,
  KoreanTimeManager,
  ParameterValidator,
  StandardizedBaseModule,
  STANDARD_PARAMS,
} = require("./src/core/StandardizedSystem");

// ✅ 4. 핵심 의존성
const TelegramBot = require("node-telegram-bot-api");

// ✅ 5. 설정 및 유틸리티 (logger 다음)
const AppConfig = require("./src/config/AppConfig");
const { TimeHelper } = require("./src/utils/TimeHelper");
const ErrorHandler = require("./src/utils/ErrorHandler");

// ✅ 6. 데이터베이스 관련 (수정됨)
const {
  DatabaseManager,
  getInstance,
} = require("./src/database/DatabaseManager");

// ✅ 7. 핵심 매니저들
const ModuleManager = require("./src/managers/ModuleManager");
const BotController = require("./src/controllers/BotController");

// ✅ 8. 서비스들 (mongoose 절대 사용 안함!)
const { TodoService } = require("./src/services/TodoService");
const { WeatherService } = require("./src/services/WeatherService");
const { WorktimeService } = require("./src/services/WorktimeService");

// ✅ 전역 에러 핸들러 (logger 인스턴스 사용)
process.on("unhandledRejection", (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("🚨 처리되지 않은 Promise 거부:", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("🚨 처리되지 않은 예외:", {
    message: error.message,
    stack: error.stack,
  });
  // 안전한 종료
  setTimeout(() => process.exit(1), 1000);
});

// ✅ 메인 봇 클래스 (logger 인스턴스 사용)
class DoomockBot {
  constructor() {
    // 🚫 중복 초기화 방지
    if (DoomockBot._instance) {
      logger.warn("⚠️ DoomockBot 이미 생성됨, 기존 인스턴스 반환");
      return DoomockBot._instance;
    }

    this.bot = null;
    this.botController = null;
    this.moduleManager = null;
    this.databaseManager = null;
    this.errorHandler = null;
    this.config = null;

    // 🎯 표준화 시스템 (중복 방지 + 한국시간)
    this.duplicationPreventer = new DuplicationPreventer();
    this.timeManager = new KoreanTimeManager();

    // 서비스들 (mongoose 없음!)
    this.services = {
      todoService: null,
      weatherService: null,
      worktimeService: null,
    };

    // 상태 추적
    this.isInitialized = false;
    this.healthCheckInterval = null;

    // 싱글톤 인스턴스 설정
    DoomockBot._instance = this;

    logger.info("🤖 DoomockBot v3.0.1 생성됨 (표준화 완료)");
  }

  // =============== 🚀 초기화 메서드들 ===============

  async initialize() {
    if (this.isInitialized) {
      logger.warn("⚠️ DoomockBot 이미 초기화됨");
      return;
    }

    try {
      logger.info("🚀 DoomockBot 전체 초기화 시작...");

      // 초기화 순서 (의존성 고려)
      await this.initializeConfig();
      await this.initializeErrorHandler();
      await this.initializeServices();
      await this.initializeTelegramBot();
      await this.initializeDatabaseManager();
      await this.initializeBotController();
      await this.initializeModuleManager();
      await this.startPolling();
      await this.startHealthMonitoring();
      await this.sendStartupNotification();

      this.isInitialized = true;
      logger.success("🎉 DoomockBot 전체 초기화 완료!");
    } catch (error) {
      logger.error("💥 DoomockBot 초기화 실패:", error);
      await this.handleCriticalError(error);
      throw error;
    }
  }

  // 1. 설정 초기화 (표준 매개변수 준수)
  async initializeConfig() {
    try {
      logger.info("⚙️ 설정 초기화 중...");

      this.config = AppConfig;

      // 필수 환경변수 검증
      const requiredVars = ["BOT_TOKEN"];
      for (const varName of requiredVars) {
        if (!this.config[varName]) {
          throw new Error(`필수 환경변수 누락: ${varName}`);
        }
      }

      logger.success("✅ 설정 초기화 완료");
    } catch (error) {
      logger.error("❌ 설정 초기화 실패:", error);
      throw error;
    }
  }

  // 2. 에러 핸들러 초기화
  async initializeErrorHandler() {
    try {
      logger.info("🛡️ 에러 핸들러 초기화 중...");
      this.errorHandler = new ErrorHandler();
      logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      logger.error("❌ 에러 핸들러 초기화 실패:", error);
      throw error;
    }
  }

  // 3. 서비스들 초기화
  async initializeServices() {
    try {
      logger.info("🔧 서비스들 초기화 중...");

      // MongoDB 네이티브 드라이버만 사용하는 서비스들
      this.services.todoService = new TodoService();
      this.services.weatherService = new WeatherService();
      this.services.worktimeService = new WorktimeService();

      logger.success("✅ 서비스들 초기화 완료");
    } catch (error) {
      logger.error("❌ 서비스 초기화 실패:", error);
      // 서비스 실패는 부분적으로 허용
      logger.warn("⚠️ 일부 서비스 없이 계속 진행");
    }
  }

  // 4. 텔레그램 봇 초기화 (표준 매개변수 준수)
  async initializeTelegramBot() {
    try {
      logger.info("🤖 텔레그램 봇 초기화 중...");

      this.bot = new TelegramBot(this.config.BOT_TOKEN, {
        polling: false, // 수동으로 시작
        filepath: false,
        onlyFirstMatch: true,
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4,
          },
        },
      });

      logger.success("✅ 텔레그램 봇 초기화 완료");
    } catch (error) {
      logger.error("❌ 텔레그램 봇 초기화 실패:", error);
      throw error; // 봇 실패는 치명적
    }
  }

  // 5. 데이터베이스 매니저 초기화 (수정됨)
  async initializeDatabaseManager() {
    try {
      logger.info("🗄️ 데이터베이스 매니저 초기화 중...");

      if (!this.config.MONGO_URL) {
        logger.warn("⚠️ MongoDB URL 없음, 메모리 모드로 실행");
        this.databaseManager = null;
        return;
      }

      // ✅ 방법 1: getInstance() 사용 (권장)
      this.databaseManager = getInstance();

      // ✅ 방법 2: createDatabaseManager() 사용 (대안)
      // const { createDatabaseManager } = require("./src/database/DatabaseManager");
      // this.databaseManager = createDatabaseManager(this.config.MONGO_URL);

      await this.databaseManager.connect();
      logger.success("✅ 데이터베이스 연결 성공");
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 실패:", error);
      // 데이터베이스 실패는 부분적으로 허용
      this.databaseManager = null;
      logger.warn("⚠️ 데이터베이스 없이 실행");
    }
  }

  // 6. 봇 컨트롤러 초기화 (표준 매개변수 준수)
  async initializeBotController() {
    try {
      logger.info("🎮 봇 컨트롤러 초기화 중...");

      if (!this.bot) {
        throw new Error("텔레그램 봇이 생성되지 않았습니다");
      }

      this.botController = new BotController(this.bot, this.config);
      await this.botController.initialize();

      logger.success("✅ 봇 컨트롤러 초기화 완료");
    } catch (error) {
      logger.error("❌ 봇 컨트롤러 초기화 실패:", error);
      throw error; // 컨트롤러 실패는 치명적
    }
  }

  // 7. 모듈 매니저 초기화 (표준 매개변수 준수)
  async initializeModuleManager() {
    try {
      logger.info("🧩 모듈 매니저 초기화 중...");

      if (!this.bot || !this.botController) {
        throw new Error("봇 또는 컨트롤러가 초기화되지 않았습니다");
      }

      this.moduleManager = new ModuleManager(this.bot, {
        dbManager: this.databaseManager,
        userStates: this.botController.userStates,
        config: this.config,
        errorHandler: this.errorHandler,
        services: this.services,
        timeManager: this.timeManager,
        duplicationPreventer: this.duplicationPreventer,
      });

      await this.moduleManager.initialize();

      logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      logger.error("❌ 모듈 매니저 초기화 실패:", error);
      // 모듈 매니저 실패는 부분적으로 허용
      this.moduleManager = null;
      logger.warn("⚠️ 모듈 없이 기본 기능만 실행");
    }
  }

  // 8. 폴링 시작 (표준 매개변수 준수)
  async startPolling() {
    try {
      logger.info("📡 텔레그램 폴링 시작 중...");

      if (!this.bot) {
        throw new Error("텔레그램 봇이 생성되지 않았습니다");
      }

      // 기존 폴링 중지 (중복 방지)
      if (this.bot.isPolling()) {
        logger.warn("⚠️ 기존 폴링 중지 중...");
        await this.bot.stopPolling();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 새 폴링 시작
      await this.bot.startPolling();

      // 폴링 상태 확인
      if (this.bot.isPolling()) {
        logger.success("✅ 텔레그램 폴링 시작됨");
      } else {
        throw new Error("폴링 시작 실패");
      }
    } catch (error) {
      logger.error("❌ 폴링 시작 실패:", error);
      throw error; // 폴링 실패는 치명적
    }
  }

  // 9. 헬스 모니터링 시작 (표준 매개변수 준수)
  async startHealthMonitoring() {
    try {
      logger.info("💚 헬스 모니터링 시작 중...");

      // 기존 인터벌 정리
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Railway 환경에서는 더 자주 체크
      const checkInterval = this.config.isRailway ? 30000 : 60000;

      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          logger.warn("⚠️ 헬스 체크 중 오류:", error.message);
        }
      }, checkInterval);

      logger.success(
        `✅ 헬스 모니터링 시작됨 (${checkInterval / 1000}초 간격)`
      );
    } catch (error) {
      logger.error("❌ 헬스 모니터링 시작 실패:", error);
      // 헬스 모니터링 실패는 부분적으로 허용
    }
  }

  // 10. 시작 알림 전송 (표준 매개변수 준수)
  async sendStartupNotification() {
    if (!this.config.ADMIN_CHAT_ID) {
      logger.debug("⚠️ ADMIN_CHAT_ID 없음, 시작 알림 생략");
      return;
    }

    try {
      const dbStatus = this.databaseManager?.isConnected
        ? "연결됨"
        : "메모리 모드";
      const startupMessage = `🚀 **Doomock Bot v${this.config.VERSION} 시작됨**

📅 시작 시간: ${this.timeManager.getKoreanTimeString()}
🌐 환경: ${this.config.NODE_ENV}
🚂 Railway: ${this.config.isRailway ? "배포됨" : "로컬"}
🗄️ 데이터베이스: ${dbStatus}
🎯 표준화 시스템: ✅ 활성화`;

      await this.bot.sendMessage(this.config.ADMIN_CHAT_ID, startupMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.warn("⚠️ 시작 알림 전송 실패:", error.message);
    }
  }

  // =============== 🚨 에러 및 정리 메서드들 ===============

  // 치명적 에러 처리
  async handleCriticalError(error) {
    logger.error("🚨 치명적 에러 처리:", error);

    try {
      if (this.errorHandler) {
        await this.errorHandler.handleCriticalError(error);
      }
      await this.cleanup();
    } catch (cleanupError) {
      logger.error("❌ 치명적 에러 처리 중 추가 오류:", cleanupError);
    }
  }

  // 헬스 체크
  async performHealthCheck() {
    const status = {
      timestamp: this.timeManager.getKoreanTimeString(),
      bot: this.bot?.isPolling() || false,
      database: this.databaseManager?.isConnected || false,
      modules: this.moduleManager?.isInitialized || false,
    };

    logger.debug("💚 헬스 체크:", status);
    return status;
  }

  // 정리 작업
  async cleanup() {
    try {
      logger.info("🧹 정리 작업 시작...");

      const cleanupTasks = [
        () =>
          this.healthCheckInterval && clearInterval(this.healthCheckInterval),
        () => this.bot && this.bot.stopPolling(),
        () => this.moduleManager && this.moduleManager.cleanup(),
        () => this.botController && this.botController.cleanup(),
        () => this.databaseManager && this.databaseManager.disconnect(),
        () => this.duplicationPreventer && this.duplicationPreventer.cleanup(),
      ];

      for (const task of cleanupTasks) {
        try {
          await task();
        } catch (error) {
          logger.warn("⚠️ 정리 작업 중 오류:", error.message);
        }
      }

      logger.success("✅ 정리 작업 완료");
    } catch (error) {
      logger.error("❌ 정리 작업 실패:", error);
    }
  }
}

// =============== 🛡️ 전역 설정 및 실행부 ===============

// 안전한 종료 핸들러 설정
function setupShutdownHandlers(doomockBot) {
  const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`🛑 ${signal} 신호 수신, 안전한 종료 시작...`);

      try {
        await doomockBot.cleanup();
        logger.success("✅ 안전한 종료 완료");
        process.exit(0);
      } catch (error) {
        logger.error("❌ 종료 중 오류:", error);
        process.exit(1);
      }
    });
  });
}

// 메인 실행 함수
async function main() {
  try {
    logger.info("🎬 Doomock Bot 3.0.1 시작 중... (DatabaseManager 통합 완료)");
    logger.info("🎯 표준 매개변수:", STANDARD_PARAMS);
    logger.info("🚫 mongoose 사용 안함 - MongoDB 네이티브 드라이버만 사용");

    // DoomockBot 인스턴스 생성
    const doomockBot = new DoomockBot();

    // 추가 전역 에러 핸들러 (DoomockBot 참조)
    process.on("unhandledRejection", async (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      logger.error("🚨 처리되지 않은 Promise 거부 (메인):", error);
      await doomockBot.handleCriticalError(error);
    });

    // 종료 핸들러 설정
    setupShutdownHandlers(doomockBot);

    // 전체 초기화 실행
    await doomockBot.initialize();

    logger.success("🎉 Doomock Bot 3.0.1 실행 준비 완료!");
  } catch (error) {
    logger.error("💥 Doomock Bot 실행 실패:", error);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main().catch((error) => {
    logger.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
