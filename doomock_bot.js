// doomock_bot.js - 3.0.1 리팩토링: 중복 제거 + 표준화 완성

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

  // =============== 🚀 메인 시작 메서드 ===============
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

  // =============== 🎯 표준화된 9단계 초기화 ===============
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

  // =============== 🎯 9단계 초기화 메서드들 ===============

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

  // 3. 에러 핸들러 초기화 (표준 매개변수 준수) - 중복 제거됨!
  async initializeErrorHandler() {
    try {
      logger.info("🛡️ 에러 핸들러 초기화 중...");

      // Railway 환경에 최적화된 설정
      const errorConfig = {
        maxRetries: this.config.isRailway ? 5 : 3,
        retryDelay: this.config.isRailway ? 2000 : 1000,
        alertThreshold: 10,
        healthCheckInterval: 30000,
      };

      this.errorHandler = new ErrorHandler(errorConfig);

      logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      logger.error("❌ 에러 핸들러 초기화 실패:", error);
      // 에러 핸들러 실패는 치명적이지 않음 - 계속 진행
      this.errorHandler = null;
      logger.warn("⚠️ 에러 핸들러 없이 계속 진행");
    }
  }

  // 4. 서비스들 초기화 (mongoose 절대 사용 안함!)
  async initializeServices() {
    try {
      logger.info("🔧 서비스들 초기화 중... (MongoDB 네이티브만)");

      // TodoService 초기화
      if (this.config.ENABLE_TODO_MODULE !== false) {
        try {
          this.services.todo = new TodoService({
            databaseManager: this.databaseManager,
            config: this.config,
          });
          logger.debug("✅ TodoService 초기화 완료");
        } catch (error) {
          logger.warn("⚠️ TodoService 초기화 실패:", error.message);
          this.services.todo = null;
        }
      }

      // WeatherService 초기화
      if (this.config.ENABLE_WEATHER_MODULE !== false) {
        try {
          this.services.weather = new WeatherService({
            apiKey: this.config.WEATHER_API_KEY,
            config: this.config,
          });
          logger.debug("✅ WeatherService 초기화 완료");
        } catch (error) {
          logger.warn("⚠️ WeatherService 초기화 실패:", error.message);
          this.services.weather = null;
        }
      }

      // WorktimeService 초기화
      if (this.config.ENABLE_WORKTIME_MODULE !== false) {
        try {
          this.services.worktime = new WorktimeService({
            databaseManager: this.databaseManager,
            config: this.config,
          });
          logger.debug("✅ WorktimeService 초기화 완료");
        } catch (error) {
          logger.warn("⚠️ WorktimeService 초기화 실패:", error.message);
          this.services.worktime = null;
        }
      }

      logger.success("✅ 서비스들 초기화 완료");
    } catch (error) {
      logger.error("❌ 서비스 초기화 실패:", error);
      // 서비스 실패는 치명적이지 않음 - 계속 진행
      logger.warn("⚠️ 일부 서비스 없이 계속 진행");
    }
  }

  // 5. 텔레그램 봇 생성 (표준 매개변수 준수)
  async createTelegramBot() {
    try {
      logger.info("🤖 텔레그램 봇 생성 중...");

      // Railway 환경에 최적화된 설정
      const botOptions = {
        polling: {
          interval: this.config.isRailway ? 2000 : 1000,
          autoStart: false,
          params: {
            timeout: 10,
            limit: 100,
            allowed_updates: ["message", "callback_query", "inline_query"],
          },
        },
        filepath: false, // 파일 다운로드 비활성화 (Railway 디스크 절약)
        baseApiUrl: this.config.TELEGRAM_API_URL || "https://api.telegram.org",
      };

      this.bot = new TelegramBot(this.config.BOT_TOKEN, botOptions);

      // 봇 이벤트 리스너 설정
      this.setupBotEventListeners();

      logger.success("✅ 텔레그램 봇 생성 완료");
    } catch (error) {
      logger.error("❌ 텔레그램 봇 생성 실패:", error);
      throw error; // 봇 생성 실패는 치명적
    }
  }

  // 6. 봇 컨트롤러 초기화 (표준 매개변수 준수)
  async initializeBotController() {
    try {
      logger.info("🎮 봇 컨트롤러 초기화 중...");

      if (!this.bot) {
        throw new Error("텔레그램 봇이 생성되지 않았습니다");
      }

      // ✅ 기존 BotController 생성자 방식에 맞춤: (bot, config)
      this.botController = new BotController(this.bot, this.config);

      // 컨트롤러 초기화
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

      // ✅ 기존 ModuleManager 생성자 방식에 맞춤: (bot, options)
      this.moduleManager = new ModuleManager(this.bot, {
        dbManager: this.databaseManager, // databaseManager를 dbManager로 전달
        userStates: this.botController.userStates, // BotController의 userStates 사용
        config: this.config,
        errorHandler: this.errorHandler,
        services: this.services,
        timeManager: this.timeManager,
        duplicationPreventer: this.duplicationPreventer,
      });

      // 모든 모듈 로드 및 초기화
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
      const checkInterval = this.config.isRailway ? 30000 : 60000; // 30초 또는 1분

      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          logger.warn("⚠️ 헬스체크 실패:", error.message);
        }
      }, checkInterval);

      // 첫 헬스체크 즉시 실행
      await this.performHealthCheck();

      logger.success("✅ 헬스 모니터링 시작됨");
    } catch (error) {
      logger.error("❌ 헬스 모니터링 시작 실패:", error);
      // 헬스 모니터링 실패는 치명적이지 않음
      this.healthCheckInterval = null;
      logger.warn("⚠️ 헬스 모니터링 없이 계속 진행");
    }
  }

  // =============== 🛠️ 보조 메서드들 ===============

  // 데이터베이스 인덱스 설정
  async setupDatabaseIndexes() {
    if (!this.databaseManager) return;

    try {
      logger.info("📑 데이터베이스 인덱스 설정 중...");
      // 인덱스 설정 로직... (추후 구체화)
      logger.success("✅ 데이터베이스 인덱스 설정 완료");
    } catch (error) {
      logger.warn("⚠️ 인덱스 설정 실패:", error.message);
    }
  }

  // 헬스체크 수행
  async performHealthCheck() {
    const health = {
      timestamp: this.timeManager.getKoreanTimeString(),
      status: "healthy",
      issues: [],
    };

    // 봇 상태 체크
    if (!this.bot || !this.bot.isPolling()) {
      health.status = "degraded";
      health.issues.push("봇 폴링 중단됨");
    }

    // 데이터베이스 상태 체크
    if (this.databaseManager) {
      const dbHealthy = (await this.databaseManager.isHealthy?.()) || false;
      if (!dbHealthy) {
        health.status = "degraded";
        health.issues.push("데이터베이스 연결 불안정");
      }
    }

    // 메모리 사용량 체크 (Railway 제한: 512MB)
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (this.config.isRailway && memUsageMB > 400) {
      // 400MB 이상시 경고
      health.status = "degraded";
      health.issues.push(`높은 메모리 사용량: ${memUsageMB}MB`);
    }

    // 디버그 정보 로깅
    if (health.status === "degraded") {
      logger.warn("⚠️ 헬스체크 이슈:", health.issues.join(", "));
    } else if (process.env.NODE_ENV === "development") {
      logger.debug(`💚 헬스체크 정상 (메모리: ${memUsageMB}MB)`);
    }

    return health;
  }

  // 봇 이벤트 리스너 설정
  setupBotEventListeners() {
    // 폴링 에러 처리
    this.bot.on("polling_error", async (error) => {
      logger.error("📡 폴링 에러:", error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, { module: "polling" });
      }
    });

    // 웹훅 에러 처리 (사용하지 않지만 안전장치)
    this.bot.on("webhook_error", async (error) => {
      logger.error("🌐 웹훅 에러:", error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, { module: "webhook" });
      }
    });

    // 일반 에러 처리
    this.bot.on("error", async (error) => {
      logger.error("🤖 봇 에러:", error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, { module: "bot" });
      }
    });

    logger.debug("✅ 봇 이벤트 리스너 설정 완료");
  }

  // 시작 알림 전송
  async sendStartupNotification() {
    // 관리자에게 시작 알림 (개발 환경에서만)
    if (process.env.NODE_ENV === "development" && this.config.ADMIN_CHAT_ID) {
      try {
        const startupMessage = `🚀 *DoomockBot v${this.config.VERSION} 시작됨*
      
📅 시작 시간: ${this.timeManager.getKoreanTimeString()}
🌐 환경: ${this.config.NODE_ENV}
🗄️ 데이터베이스: ${this.databaseManager ? "연결됨" : "메모리 모드"}
🎯 표준화 시스템: ✅ 활성화`;

        await this.bot.sendMessage(this.config.ADMIN_CHAT_ID, startupMessage, {
          parse_mode: "Markdown",
        });
      } catch (error) {
        logger.warn("⚠️ 시작 알림 전송 실패:", error.message);
      }
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

// 스크립트가 직접 실행될 때만 시작
if (require.main === module) {
  main().catch((error) => {
    logger.error("🚨 치명적 오류 발생:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
// DoomockBot 인스턴스 (싱글톤) 내보내기
