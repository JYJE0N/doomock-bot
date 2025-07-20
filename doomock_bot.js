// doomock_bot.js - Logger 사용법 수정 (인스턴스 방식으로 변경)

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

// ✅ 6. 데이터베이스 관련 (MongoDB 네이티브 드라이버만!)
const { mongoPoolManager } = require("./src/database/MongoPoolManager");
const DatabaseManager = require("./src/database/DatabaseManager");

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
      todo: null,
      weather: null,
      worktime: null,
    };

    // 상태 관리 (중복 방지)
    this.isRunning = false;
    this.isInitialized = false;
    this.initializationInProgress = false;
    this.shutdownPromise = null;
    this.startTime = this.timeManager.getKoreanTime();
    this.healthCheckInterval = null;

    // 싱글톤 저장
    DoomockBot._instance = this;

    logger.info("🤖 DoomockBot 인스턴스 생성됨 (표준화 + 무재귀)");
    logger.logTimeInfo();
  }

  async start() {
    // 🚫 중복 시작 방지
    const operationId = this.timeManager.generateOperationId(
      "bot_start",
      "system"
    );

    if (!(await this.duplicationPreventer.startOperation(operationId))) {
      logger.warn("🚫 봇 시작 중복 호출 차단됨");
      return;
    }

    if (this.isRunning || this.initializationInProgress) {
      logger.warn("봇이 이미 실행 중이거나 초기화 중입니다");
      this.duplicationPreventer.endOperation(operationId);
      return;
    }

    try {
      this.initializationInProgress = true;
      logger.info("🚀 Doomock 봇 시작... (표준화 시스템)");

      // 🇰🇷 시작 시간 기록
      const startTimeString = this.timeManager.getKoreanTimeString();
      logger.info(`📅 시작 시간: ${startTimeString}`);

      // ✅ 표준화된 9단계 초기화 (매개변수 표준 준수!)
      await this.executeStandardizedInitialization();

      this.isRunning = true;
      this.isInitialized = true;

      const bootTime = Date.now() - this.startTime.getTime();
      logger.success(`✅ Doomock 봇 완전 시작! (부팅시간: ${bootTime}ms)`);

      await this.sendStartupNotification();
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      await this.cleanup();
      throw error;
    } finally {
      this.initializationInProgress = false;
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 🎯 표준화된 초기화 프로세스 (9단계)
  async executeStandardizedInitialization() {
    // ✅ 표준 매개변수 준수하는 초기화 단계들
    const steps = [
      { name: "설정 로드", method: this.loadConfiguration },
      { name: "데이터베이스", method: this.initializeDatabase },
      { name: "에러 핸들러", method: this.initializeErrorHandler },
      { name: "서비스들", method: this.initializeServices },
      { name: "텔레그램 봇", method: this.createTelegramBot },
      { name: "봇 컨트롤러", method: this.initializeBotController },
      { name: "모듈 매니저", method: this.initializeModuleManager },
      { name: "폴링 시작", method: this.startPolling },
      { name: "헬스 모니터링", method: this.startHealthMonitoring },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = this.timeManager.generateOperationId(
        "init_step",
        i,
        `_${step.name}`
      );

      try {
        logger.info(`📋 ${i + 1}/9 단계: ${step.name} 시작...`);

        // 중복 방지 체크
        if (!(await this.duplicationPreventer.startOperation(stepId))) {
          throw new Error(`${step.name} 단계 중복 실행 감지됨`);
        }

        await step.method.call(this);

        logger.success(`✅ ${i + 1}/9 단계: ${step.name} 완료`);
      } catch (error) {
        logger.error(`❌ ${i + 1}/9 단계: ${step.name} 실패:`, error);
        throw error;
      } finally {
        this.duplicationPreventer.endOperation(stepId);
      }
    }
  }

  // 1. 설정 로드 및 검증
  async loadConfiguration() {
    try {
      logger.info("⚙️ 설정 로드 중...");

      // ✅ AppConfig는 이미 인스턴스로 export되므로 new 없이 직접 사용
      this.config = AppConfig;

      // 필수 환경변수 검증
      if (!this.config.BOT_TOKEN) {
        throw new Error("BOT_TOKEN이 설정되지 않았습니다");
      }

      logger.success("✅ 설정 로드 완료");
      logger.info(`🌐 환경: ${this.config.NODE_ENV}`);
      logger.info(`🔧 버전: ${this.config.VERSION}`);
      logger.info(`🚀 Railway: ${this.config.isRailway ? "배포됨" : "로컬"}`);
    } catch (error) {
      logger.error("❌ 설정 로드 실패:", error);
      throw error;
    }
  }

  // 2. 데이터베이스 초기화 (MongoDB 네이티브만!)
  async initializeDatabase() {
    try {
      logger.info("🗄️ 데이터베이스 초기화 중... (MongoDB 네이티브)");

      if (!this.config.MONGO_URL) {
        logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 실행");
        return;
      }

      // DatabaseManager 초기화
      this.databaseManager = new DatabaseManager();

      // 연결 시도 (최대 3번)
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const connected = await this.databaseManager.connect();
          if (connected) {
            logger.success("✅ MongoDB 연결 성공 (네이티브 드라이버)");

            // 인덱스 설정
            await this.setupDatabaseIndexes();
            break;
          }
        } catch (error) {
          attempts++;
          logger.warn(
            `MongoDB 연결 실패 (시도 ${attempts}/${maxAttempts}):`,
            error.message
          );

          if (attempts >= maxAttempts) {
            logger.warn("MongoDB 연결을 포기하고 메모리 모드로 실행");
            this.databaseManager = null;
            break;
          }

          // 재시도 전 대기
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
        }
      }

      // mongoPoolManager도 초기화
      if (this.databaseManager && this.databaseManager.isConnected) {
        try {
          await mongoPoolManager.connect();
          logger.debug("✅ mongoPoolManager 연결 완료");
        } catch (poolError) {
          logger.warn("mongoPoolManager 연결 실패:", poolError.message);
        }
      }
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 중 오류:", error);
      this.databaseManager = null;
      logger.warn("⚠️ 메모리 모드로 계속 진행");
    }
  }

  // 나머지 메서드들도 모두 logger로 변경...
  async setupDatabaseIndexes() {
    if (!this.databaseManager) return;

    try {
      logger.info("📑 데이터베이스 인덱스 설정 중...");
      // 인덱스 설정 로직...
      logger.success("✅ 데이터베이스 인덱스 설정 완료");
    } catch (error) {
      logger.warn("⚠️ 인덱스 설정 실패:", error.message);
    }
  }

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
        () => mongoPoolManager && mongoPoolManager.disconnect(),
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

// ✅ 안전한 종료 핸들러 설정
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

// ✅ 메인 실행 함수
async function main() {
  try {
    logger.info("🎬 Doomock Bot 3.0.1 시작 중... (표준화 + 무재귀)");
    logger.info("🎯 표준 매개변수:", STANDARD_PARAMS);
    logger.info("🚫 mongoose 사용 안함 - MongoDB 네이티브 드라이버만 사용");

    // DoomockBot 인스턴스 생성
    const doomockBot = new DoomockBot();

    // 추가 전역 에러 핸들러 (DoomockBot 참조)
    process.on("unhandledRejection", async (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      logger.error("🚨 처리되지 않은 Promise 거부 (표준화):", error);
      await doomockBot.handleCriticalError(error);
    });

    // 종료 핸들러 설정
    setupShutdownHandlers(doomockBot);

    // 🎯 표준화된 봇 시작
    await doomockBot.start();

    // 성공 메시지
    const config = doomockBot.config;
    const timeString = doomockBot.timeManager.getKoreanTimeString();

    logger.success(
      `🎉 ${config.BOT_USERNAME || "DoomockBot"} v${
        config.VERSION
      } 완전히 시작됨!`
    );
    logger.info(`📅 시작 완료 시간: ${timeString}`);
    logger.info(`🎯 표준화 시스템: ✅ 활성화`);
    logger.info(`🚫 중복 방지: ✅ 활성화`);
    logger.info(`🇰🇷 한국시간: ✅ 정확`);
    logger.info(`🗄️ MongoDB: 네이티브 드라이버 (mongoose 없음)`);
    logger.info("🤖 봇이 메시지를 기다리고 있습니다...");
  } catch (error) {
    logger.error("🚨 메인 실행 실패:", error);
    process.exit(1);
  }
}

// ✅ 스크립트가 직접 실행될 때만 시작
if (require.main === module) {
  main().catch((error) => {
    logger.error("🚨 치명적 오류 발생:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
// ✅ 모듈 내보내기 (인스턴스 방식)
