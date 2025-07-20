// doomock_bot.js - 완전한 메인 엔트리 포인트 (표준화 시스템 적용)

// ✅ 1. 환경변수 최우선 로드
require("dotenv").config();

// ✅ 2. 핵심 의존성 로드
const TelegramBot = require("node-telegram-bot-api");
const Logger = require("./src/utils/Logger");

// ✅ 3. 표준화 시스템 (🎯 핵심!)
const {
  DuplicationPreventer,
  KoreanTimeManager,
  ParameterValidator,
} = require("./src/core/StandardizedSystem");

// ✅ 4. 설정 및 유틸리티
const AppConfig = require("./src/config/AppConfig");
const { TimeHelper } = require("./src/utils/TimeHelper");

// ✅ 5. 데이터베이스 관련
const { mongoPoolManager } = require("./src/database/MongoPoolManager");
const DatabaseManager = require("./src/database/DatabaseManager");

// ✅ 6. 핵심 매니저들
const ModuleManager = require("./src/managers/ModuleManager");
const BotController = require("./src/controllers/BotController");

// ✅ 7. 서비스들
const { TodoService } = require("./src/services/TodoService");
const { WeatherService } = require("./src/services/WeatherService");
const { WorktimeService } = require("./src/services/WorktimeService");

// ✅ 8. 에러 핸들링
const ErrorHandler = require("./src/utils/ErrorHandler");

// ✅ 전역 에러 핸들러 (최우선)
process.on("unhandledRejection", (reason, promise) => {
  Logger.error("🚨 처리되지 않은 Promise 거부:", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
});

process.on("uncaughtException", (error) => {
  Logger.error("🚨 처리되지 않은 예외:", {
    message: error.message,
    stack: error.stack,
  });

  // 안전한 종료
  process.exit(1);
});

// ✅ 메인 봇 클래스 (표준화 시스템 적용)
class DoomockBot {
  constructor() {
    this.bot = null;
    this.botController = null;
    this.moduleManager = null;
    this.databaseManager = null;
    this.errorHandler = null;
    this.config = null;

    // 🎯 표준화 시스템 (중복 방지 + 한국시간)
    this.duplicationPreventer = new DuplicationPreventer();
    this.timeManager = new KoreanTimeManager();

    // 서비스들
    this.services = {
      todo: null,
      weather: null,
      worktime: null,
    };

    // 상태 관리 (중복 방지)
    this.isRunning = false;
    this.isInitialized = false;
    this.initializationInProgress = false; // 초기화 중복 방지
    this.shutdownPromise = null;
    this.startTime = this.timeManager.getKoreanTime();
    this.healthCheckInterval = null;

    Logger.info("🤖 DoomockBot 인스턴스 생성됨 (표준화 적용)");
    Logger.logTimeInfo(); // 한국시간 정보 출력
  }

  async start() {
    // 🚫 중복 시작 방지
    const operationId = this.timeManager.generateOperationId(
      "bot_start",
      "system"
    );

    if (!(await this.duplicationPreventer.startOperation(operationId))) {
      Logger.warn("🚫 봇 시작 중복 호출 차단됨");
      return;
    }

    if (this.isRunning || this.initializationInProgress) {
      Logger.warn("봇이 이미 실행 중이거나 초기화 중입니다");
      this.duplicationPreventer.endOperation(operationId);
      return;
    }

    try {
      this.initializationInProgress = true;
      Logger.info("🚀 Doomock 봇 시작... (표준화 시스템)");

      // 🇰🇷 시작 시간 기록
      const startTimeString = this.timeManager.getKoreanTimeString();
      Logger.info(`📅 시작 시간: ${startTimeString}`);

      // 표준화된 9단계 초기화
      await this.executeStandardizedInitialization();

      this.isRunning = true;
      this.isInitialized = true;

      const bootTime = Date.now() - this.startTime.getTime();
      Logger.success(`✅ Doomock 봇 완전 시작! (부팅시간: ${bootTime}ms)`);

      await this.sendStartupNotification();
    } catch (error) {
      Logger.error("❌ 봇 시작 실패:", error);
      await this.cleanup();
      throw error;
    } finally {
      this.initializationInProgress = false;
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 🎯 표준화된 초기화 프로세스 (9단계)
  async executeStandardizedInitialization() {
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
        Logger.info(`📋 ${i + 1}/9 단계: ${step.name} 시작...`);

        // 중복 방지 체크
        if (!(await this.duplicationPreventer.startOperation(stepId))) {
          throw new Error(`${step.name} 단계 중복 실행 감지됨`);
        }

        await step.method.call(this);

        Logger.success(`✅ ${i + 1}/9 단계: ${step.name} 완료`);
      } catch (error) {
        Logger.error(`❌ ${i + 1}/9 단계: ${step.name} 실패:`, error);
        throw error;
      } finally {
        this.duplicationPreventer.endOperation(stepId);
      }
    }
  }

  // 1. 설정 로드 및 검증
  async loadConfiguration() {
    try {
      Logger.info("⚙️ 설정 로드 중...");

      this.config = new AppConfig();

      // 필수 환경변수 검증
      if (!this.config.BOT_TOKEN) {
        throw new Error("BOT_TOKEN이 설정되지 않았습니다");
      }

      Logger.success("✅ 설정 로드 완료");
      Logger.info(`🌐 환경: ${this.config.NODE_ENV}`);
      Logger.info(`🔧 버전: ${this.config.VERSION}`);
      Logger.info(`🚀 Railway: ${this.config.isRailway ? "배포됨" : "로컬"}`);
    } catch (error) {
      Logger.error("❌ 설정 로드 실패:", error);
      throw error;
    }
  }

  // 2. 데이터베이스 초기화
  async initializeDatabase() {
    try {
      Logger.info("🗄️ 데이터베이스 초기화 중...");

      if (!this.config.MONGO_URL) {
        Logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 실행");
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
            Logger.success("✅ MongoDB 연결 성공");

            // 인덱스 설정
            await this.setupDatabaseIndexes();
            break;
          }
        } catch (error) {
          attempts++;
          Logger.warn(
            `MongoDB 연결 실패 (시도 ${attempts}/${maxAttempts}):`,
            error.message
          );

          if (attempts >= maxAttempts) {
            Logger.warn("MongoDB 연결을 포기하고 메모리 모드로 실행");
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
          Logger.debug("✅ mongoPoolManager 연결 완료");
        } catch (poolError) {
          Logger.warn("mongoPoolManager 연결 실패:", poolError.message);
        }
      }
    } catch (error) {
      Logger.error("❌ 데이터베이스 초기화 중 오류:", error);
      this.databaseManager = null;
      Logger.warn("⚠️ 메모리 모드로 계속 진행");
    }
  }

  // 데이터베이스 인덱스 설정
  async setupDatabaseIndexes() {
    if (!this.databaseManager) return;

    try {
      Logger.info("📑 데이터베이스 인덱스 설정 중...");

      // 사용자 인덱스
      const usersCollection = this.databaseManager.getCollection("users");
      await usersCollection.createIndex({ userId: 1 }, { unique: true });
      await usersCollection.createIndex({ username: 1 });
      await usersCollection.createIndex({ lastActive: 1 });

      // Todo 인덱스
      const todosCollection = this.databaseManager.getCollection("todos");
      await todosCollection.createIndex({ userId: 1 });
      await todosCollection.createIndex({ createdAt: 1 });
      await todosCollection.createIndex({ completed: 1 });

      // 통계 인덱스
      const statsCollection = this.databaseManager.getCollection("bot_stats");
      await statsCollection.createIndex({ date: 1 }, { unique: true });
      await statsCollection.createIndex({ timestamp: 1 });

      Logger.success("✅ 데이터베이스 인덱스 설정 완료");
    } catch (error) {
      Logger.warn("⚠️ 인덱스 설정 실패:", error.message);
    }
  }

  // 3. 에러 핸들러 초기화
  async initializeErrorHandler() {
    try {
      Logger.info("🛡️ 에러 핸들러 초기화 중...");

      this.errorHandler = new ErrorHandler({
        maxRetries: 3,
        retryDelay: 1500,
        enableAlert: true,
        alertThreshold: 5,
      });

      Logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      Logger.warn("⚠️ 에러 핸들러 초기화 실패:", error.message);
      // 에러 핸들러 실패는 치명적이지 않음
    }
  }

  // 4. 서비스들 초기화
  async initializeServices() {
    try {
      Logger.info("🔧 서비스들 초기화 중...");

      // Todo 서비스
      this.services.todo = new TodoService();

      // Weather 서비스
      if (this.config.WEATHER_API_KEY) {
        this.services.weather = new WeatherService();
        Logger.debug("✅ Weather 서비스 초기화됨");
      } else {
        Logger.warn("⚠️ WEATHER_API_KEY 없음, 날씨 서비스 비활성화");
      }

      // Worktime 서비스
      this.services.worktime = new WorktimeService();

      Logger.success("✅ 서비스들 초기화 완료");
    } catch (error) {
      Logger.error("❌ 서비스 초기화 실패:", error);
      throw error;
    }
  }

  // 5. 텔레그램 봇 생성
  async createTelegramBot() {
    try {
      Logger.info("🤖 텔레그램 봇 생성 중...");

      this.bot = new TelegramBot(this.config.BOT_TOKEN, {
        polling: {
          interval: 1000,
          autoStart: false,
          params: {
            timeout: 30,
          },
        },
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4, // IPv4 강제 (Railway 호환성)
          },
        },
      });

      // 봇 정보 확인
      const botInfo = await this.bot.getMe();
      Logger.success(
        `✅ 봇 연결 성공: @${botInfo.username} (${botInfo.first_name})`
      );

      // 웹훅 정리 (폴링 사용)
      await this.bot.deleteWebHook();
    } catch (error) {
      Logger.error("❌ 텔레그램 봇 생성 실패:", error);
      throw error;
    }
  }

  // 6. 봇 컨트롤러 초기화
  async initializeBotController() {
    try {
      Logger.info("🎮 봇 컨트롤러 초기화 중...");

      this.botController = new BotController(this.bot, this.config);

      // 최대 3번 재시도
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          await this.botController.initialize();
          Logger.success("✅ 봇 컨트롤러 초기화 완료");
          return;
        } catch (error) {
          attempts++;
          Logger.error(
            `❌ 봇 컨트롤러 초기화 실패 (시도 ${attempts}/${maxAttempts}):`,
            error
          );

          if (attempts >= maxAttempts) {
            throw new Error(`봇 컨트롤러 초기화 최종 실패: ${error.message}`);
          }

          // 재시도 전 대기
          Logger.info(`⏳ ${2 * attempts}초 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
        }
      }
    } catch (error) {
      Logger.error("❌ 봇 컨트롤러 초기화 중 치명적 오류:", error);
      throw error;
    }
  }

  // 7. 모듈 매니저 초기화
  async initializeModuleManager() {
    try {
      Logger.info("📦 모듈 매니저 초기화 중...");

      this.moduleManager = new ModuleManager(this.bot, {
        database: this.databaseManager,
        services: this.services,
        errorHandler: this.errorHandler,
      });

      await this.moduleManager.initialize();

      Logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      Logger.error("❌ 모듈 매니저 초기화 실패:", error);
      throw error;
    }
  }

  // 8. 폴링 시작
  async startPolling() {
    try {
      Logger.info("📡 텔레그램 폴링 시작...");

      // 봇 에러 핸들러 설정
      this.bot.on("error", (error) => {
        Logger.error("🤖 텔레그램 봇 오류:", error);
        if (this.errorHandler) {
          this.errorHandler.handleError(error, { type: "telegram_bot_error" });
        }
      });

      this.bot.on("polling_error", (error) => {
        Logger.error("📡 폴링 오류:", error);
        if (this.errorHandler) {
          this.errorHandler.handleError(error, { type: "polling_error" });
        }
      });

      // 폴링 시작
      await this.bot.startPolling({
        restart: true,
      });

      Logger.success("✅ 텔레그램 폴링 시작됨");
    } catch (error) {
      Logger.error("❌ 폴링 시작 실패:", error);
      throw error;
    }
  }

  // 9. 헬스 모니터링 시작
  async startHealthMonitoring() {
    try {
      Logger.info("💊 헬스 모니터링 시작...");

      this.healthCheckInterval = setInterval(async () => {
        try {
          const status = this.getHealthStatus();

          // 메모리 사용량 체크 (500MB 초과시 경고)
          if (status.memoryUsage > 500) {
            Logger.warn(`⚠️ 높은 메모리 사용량: ${status.memoryUsage}MB`);
          }

          // 데이터베이스 연결 상태 체크
          if (this.databaseManager && !this.databaseManager.isConnected) {
            Logger.warn("⚠️ 데이터베이스 연결이 끊어짐, 재연결 시도...");
            try {
              await this.databaseManager.connect();
            } catch (reconnectError) {
              Logger.error("❌ 데이터베이스 재연결 실패:", reconnectError);
            }
          }
        } catch (healthError) {
          Logger.error("❌ 헬스 체크 오류:", healthError);
        }
      }, 30000); // 30초마다 체크

      Logger.success("✅ 헬스 모니터링 시작됨");
    } catch (error) {
      Logger.warn("⚠️ 헬스 모니터링 시작 실패:", error.message);
    }
  }

  // 시작 알림 전송 (한국시간 적용)
  async sendStartupNotification() {
    try {
      const adminIds = this.config.ADMIN_USER_IDS || [];
      if (adminIds.length === 0) return;

      const uptime = Math.round(process.uptime());
      const koreaTime = this.timeManager.getKoreanTimeString();
      const bootTime = Date.now() - this.startTime.getTime();

      const startupText =
        `🎉 **두목봇 시작됨!** (표준화 v3.0.1)\n\n` +
        `📊 버전: ${this.config.VERSION}\n` +
        `🌐 환경: ${this.config.NODE_ENV}\n` +
        `🚀 Railway: ${this.config.isRailway ? "YES" : "NO"}\n` +
        `💾 DB: ${this.databaseManager ? "MongoDB" : "메모리 모드"}\n` +
        `⏱️ 부팅 시간: ${bootTime}ms\n` +
        `📅 시작 시간: ${koreaTime}\n` +
        `🎯 표준화: ✅ 적용됨\n` +
        `🚫 중복 방지: ✅ 활성화`;

      for (const adminId of adminIds) {
        try {
          await this.bot.sendMessage(parseInt(adminId), startupText, {
            parse_mode: "Markdown",
          });
          Logger.debug(`관리자 ${adminId}에게 시작 알림 전송됨`);
        } catch (error) {
          Logger.warn(`관리자 ${adminId}에게 알림 전송 실패:`, error.message);
        }
      }
    } catch (error) {
      Logger.warn("시작 알림 전송 중 오류:", error.message);
    }
  }

  // 헬스 상태 조회 (표준화)
  getHealthStatus() {
    const memoryUsage = process.memoryUsage();

    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: Math.round(process.uptime()),
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      environment: this.config?.NODE_ENV || "development",
      railway: this.config?.isRailway || false,
      database: this.databaseManager?.isConnected || false,
      services: {
        todo: !!this.services.todo,
        weather: !!this.services.weather,
        worktime: !!this.services.worktime,
      },
      bot: {
        connected: !!this.bot,
        polling: this.bot?._polling || false,
      },
      standardization: {
        duplicationPreventer: this.duplicationPreventer.getStatus(),
        koreanTime: this.timeManager.getKoreanTimeString(),
        parametersValidated: true,
      },
    };
  }

  // 정리 작업 (표준화)
  async stop() {
    const operationId = this.timeManager.generateOperationId(
      "bot_stop",
      "system"
    );

    if (this.shutdownPromise) {
      Logger.info("종료 작업이 이미 진행 중입니다...");
      return this.shutdownPromise;
    }

    if (!(await this.duplicationPreventer.startOperation(operationId))) {
      Logger.warn("🚫 봇 종료 중복 호출 차단됨");
      return;
    }

    this.shutdownPromise = this._doStop();
    return this.shutdownPromise;
  }

  async _doStop() {
    try {
      Logger.info("🛑 봇 종료 시작... (표준화)");
      const stopStartTime = Date.now();

      this.isRunning = false;

      // 표준화된 종료 순서
      const shutdownSteps = [
        { name: "헬스 모니터링", method: this.stopHealthMonitoring },
        { name: "폴링", method: this.stopPolling },
        { name: "모듈 매니저", method: this.stopModuleManager },
        { name: "봇 컨트롤러", method: this.stopBotController },
        { name: "서비스들", method: this.stopServices },
        { name: "데이터베이스", method: this.stopDatabase },
        { name: "표준화 시스템", method: this.stopStandardizationSystem },
      ];

      for (let i = 0; i < shutdownSteps.length; i++) {
        const step = shutdownSteps[i];
        try {
          Logger.info(
            `🛑 ${i + 1}/${shutdownSteps.length}: ${step.name} 종료 중...`
          );
          await step.method.call(this);
          Logger.debug(`✅ ${step.name} 종료 완료`);
        } catch (error) {
          Logger.error(`❌ ${step.name} 종료 오류:`, error);
        }
      }

      const stopDuration = Date.now() - stopStartTime;
      Logger.success(`✅ 봇 종료 완료 (${stopDuration}ms)`);
    } catch (error) {
      Logger.error("❌ 봇 종료 중 오류:", error);
    } finally {
      this.shutdownPromise = null;
    }
  }

  // 개별 종료 메서드들
  async stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async stopPolling() {
    if (this.bot) {
      await this.bot.stopPolling();
    }
  }

  async stopModuleManager() {
    if (this.moduleManager) {
      await this.moduleManager.cleanup();
    }
  }

  async stopBotController() {
    if (this.botController) {
      await this.botController.cleanup();
    }
  }

  async stopServices() {
    for (const [name, service] of Object.entries(this.services)) {
      if (service && typeof service.cleanup === "function") {
        await service.cleanup();
      }
    }
  }

  async stopDatabase() {
    if (this.databaseManager) {
      await this.databaseManager.disconnect();
    }
    if (mongoPoolManager) {
      await mongoPoolManager.close();
    }
  }

  async stopStandardizationSystem() {
    this.duplicationPreventer.cleanup();
  }

  async cleanup() {
    await this.stop();
  }

  // 치명적 오류 처리 (표준화)
  async handleCriticalError(error) {
    Logger.error("🚨 치명적 오류 발생:", error);

    try {
      // 관리자에게 긴급 알림
      const adminIds = this.config?.ADMIN_USER_IDS || [];
      const koreaTime = this.timeManager.getKoreanTimeString();

      const errorText =
        `🚨 **치명적 오류 발생**\n\n` +
        `⚠️ 오류: ${error.message}\n` +
        `📅 시간: ${koreaTime}\n` +
        `🌐 환경: ${this.config?.NODE_ENV || "unknown"}\n` +
        `🎯 표준화: 활성화됨`;

      for (const adminId of adminIds) {
        try {
          await this.bot?.sendMessage(parseInt(adminId), errorText, {
            parse_mode: "Markdown",
          });
        } catch (notifyError) {
          Logger.error(`관리자 알림 실패: ${notifyError.message}`);
        }
      }
    } catch (criticalError) {
      Logger.error("치명적 오류 처리 중 추가 오류:", criticalError);
    }

    // 정리 작업
    await this.cleanup();
  }
}

// ✅ 종료 시그널 핸들러 (표준화)
function setupShutdownHandlers(bot) {
  const shutdown = async (signal) => {
    Logger.info(`📨 ${signal} 시그널 수신됨, 표준화된 안전 종료 중...`);

    const shutdownId = bot.timeManager.generateOperationId("shutdown", signal);

    try {
      if (!(await bot.duplicationPreventer.startOperation(shutdownId))) {
        Logger.warn("🚫 종료 프로세스 중복 호출 차단됨");
        return;
      }

      await bot.stop();
      process.exit(0);
    } catch (error) {
      Logger.error("종료 중 오류:", error);
      process.exit(1);
    } finally {
      bot.duplicationPreventer.endOperation(shutdownId);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ✅ 메인 실행 함수 (표준화)
async function main() {
  const doomockBot = new DoomockBot();

  try {
    // 🎯 표준화된 전역 에러 핸들러 설정
    process.on("uncaughtException", async (error) => {
      Logger.error("🚨 처리되지 않은 예외 (표준화):", error);
      await doomockBot.handleCriticalError(error);
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      Logger.error("🚨 처리되지 않은 Promise 거부 (표준화):", error);
      await doomockBot.handleCriticalError(error);
    });

    // 종료 핸들러 설정
    setupShutdownHandlers(doomockBot);

    // 🎯 표준화된 봇 시작
    await doomockBot.start();

    // 성공 메시지
    const config = doomockBot.config;
    const timeString = doomockBot.timeManager.getKoreanTimeString();

    Logger.success(
      `🎉 ${config.BOT_USERNAME || "DoomockBot"} v${
        config.VERSION
      } 완전히 시작됨!`
    );
    Logger.info(`📅 시작 완료 시간: ${timeString}`);
    Logger.info(`🎯 표준화 시스템: ✅ 활성화`);
    Logger.info(`🚫 중복 방지: ✅ 활성화`);
    Logger.info(`🇰🇷 한국시간: ✅ 정확`);
    Logger.info("🤖 봇이 메시지를 기다리고 있습니다...");

    // 무한 대기 (폴링이 계속됨)
    process.on("exit", async () => {
      await doomockBot.cleanup();
    });
  } catch (error) {
    Logger.error("🚨 메인 실행 실패:", error);
    await doomockBot.cleanup();
    process.exit(1);
  }
}

// ✅ 스크립트가 직접 실행될 때만 시작
if (require.main === module) {
  main().catch((error) => {
    Logger.error("🚨 치명적 오류 발생:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
