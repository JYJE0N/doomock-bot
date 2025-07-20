// doomock_bot.js - BotFather 명령어 자동 등록이 포함된 메인 초기화
// Railway 환경 v3.0.1 완전 리팩토링

const TelegramBot = require("node-telegram-bot-api");
const Logger = require("./src/utils/Logger");
const CommandHandler = require("./src/handlers/CommandHandler");
const ModuleManager = require("./src/managers/ModuleManager");
const ErrorHandler = require("./src/utils/ErrorHandler");
const { mongoPoolManager } = require("./src/database/MongoPoolManager");
const botCommandsRegistry = require("./src/config/BotCommandsRegistry");
const config = require("./src/config/config");

class DoomockBot {
  constructor() {
    this.bot = null;
    this.commandHandler = null;
    this.moduleManager = null;
    this.errorHandler = null;
    this.isInitialized = false;
    this.startTime = new Date();

    // 🔗 의존성 매니저
    this.dependencies = {
      userStates: new Map(),
      menuManager: null, // ModuleManager에서 생성될 예정
    };

    Logger.info(`🚀 ${config.bot.name} v${config.bot.version} 시작 중...`);
  }

  // 🚀 봇 전체 초기화 프로세스
  async initialize() {
    try {
      Logger.info("⚙️ 봇 시스템 초기화 시작...");

      // 1️⃣ 환경변수 검증
      await this.validateEnvironment();

      // 2️⃣ 텔레그램 봇 생성
      await this.initializeTelegramBot();

      // 3️⃣ 에러 핸들러 초기화
      await this.initializeErrorHandler();

      // 4️⃣ 데이터베이스 연결 (선택적)
      await this.initializeDatabase();

      // 5️⃣ 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 6️⃣ 명령어 핸들러 초기화
      await this.initializeCommandHandler();

      // 🎯 7️⃣ BotFather 명령어 자동 등록 (핵심!)
      await this.registerBotFatherCommands();

      // 8️⃣ 이벤트 리스너 등록
      await this.setupEventListeners();

      // 9️⃣ 헬스 모니터링 시작
      await this.startHealthMonitoring();

      this.isInitialized = true;
      Logger.success(`✅ ${config.bot.name} 초기화 완료!`);

      // 🎉 시작 알림
      await this.sendStartupNotification();
    } catch (error) {
      Logger.error("❌ 봇 초기화 실패:", error);
      await this.handleCriticalError(error);
      throw error;
    }
  }

  // 🔍 환경변수 검증
  async validateEnvironment() {
    Logger.info("🔍 환경변수 검증 중...");

    const requiredVars = ["BOT_TOKEN"];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수가 누락됨: ${missingVars.join(", ")}`);
    }

    Logger.success("✅ 환경변수 검증 완료");
    Logger.info(`🌐 환경: ${process.env.NODE_ENV || "development"}`);
    Logger.info(`🔑 BOT_TOKEN: ${process.env.BOT_TOKEN ? "설정됨" : "누락"}`);
    Logger.info(
      `🗄️ MONGO_URL: ${process.env.MONGO_URL ? "설정됨" : "없음 (메모리 모드)"}`
    );
    Logger.info(
      `🚀 Railway: ${process.env.RAILWAY_ENVIRONMENT ? "배포됨" : "로컬"}`
    );
  }

  // 🤖 텔레그램 봇 초기화
  async initializeTelegramBot() {
    Logger.info("🤖 텔레그램 봇 생성 중...");

    try {
      this.bot = new TelegramBot(process.env.BOT_TOKEN, {
        polling: true,
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
        `✅ 봇 연결 완료: @${botInfo.username} (${botInfo.first_name})`
      );

      // 웹훅 정리 (polling 사용)
      await this.bot.deleteWebHook();
    } catch (error) {
      throw new Error(`텔레그램 봇 초기화 실패: ${error.message}`);
    }
  }

  // 🛡️ 에러 핸들러 초기화
  async initializeErrorHandler() {
    Logger.info("🛡️ 에러 핸들러 초기화 중...");

    try {
      this.errorHandler = new ErrorHandler({
        maxRetries: 5,
        retryDelay: 2000,
        alertThreshold: 10,
      });

      this.dependencies.errorHandler = this.errorHandler;
      Logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      Logger.warn("⚠️ 에러 핸들러 초기화 실패:", error.message);
      // 에러 핸들러 실패는 치명적이지 않음
    }
  }

  // 🗄️ 데이터베이스 초기화 (선택적)
  async initializeDatabase() {
    Logger.info("🗄️ 데이터베이스 연결 중...");

    if (!process.env.MONGO_URL) {
      Logger.warn("⚠️ MONGO_URL이 설정되지 않음, 메모리 모드로 실행");
      return;
    }

    try {
      await mongoPoolManager.connect();
      await this.setupDatabaseIndexes();
      Logger.success("✅ 데이터베이스 연결 완료");
    } catch (error) {
      Logger.warn(
        `⚠️ 데이터베이스 연결 실패, 메모리 모드로 실행: ${error.message}`
      );
      // 데이터베이스 실패는 치명적이지 않음 (메모리 모드로 동작)
    }
  }

  // 📑 데이터베이스 인덱스 설정
  async setupDatabaseIndexes() {
    try {
      // 사용자 정보 인덱스
      const userIndexes = [
        { key: { userId: 1 }, options: { unique: true } },
        { key: { username: 1 }, options: {} },
        { key: { lastActive: 1 }, options: {} },
      ];
      await mongoPoolManager.ensureIndexes("users", userIndexes);

      // 봇 통계 인덱스
      const statsIndexes = [
        { key: { date: 1 }, options: { unique: true } },
        { key: { timestamp: 1 }, options: {} },
      ];
      await mongoPoolManager.ensureIndexes("bot_stats", statsIndexes);

      Logger.debug("📑 데이터베이스 인덱스 설정 완료");
    } catch (error) {
      Logger.warn("⚠️ 인덱스 설정 실패:", error.message);
    }
  }

  // 📦 모듈 매니저 초기화
  async initializeModuleManager() {
    Logger.info("📦 모듈 매니저 초기화 중...");

    try {
      this.moduleManager = new ModuleManager(this.bot, {
        database: process.env.MONGO_URL ? mongoPoolManager : null,
        userStates: this.dependencies.userStates,
        errorHandler: this.errorHandler,
      });

      await this.moduleManager.initialize();

      // 의존성에 추가
      this.dependencies.moduleManager = this.moduleManager;
      this.dependencies.menuManager = this.moduleManager; // ModuleManager가 MenuManager 역할도 수행

      Logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      throw new Error(`모듈 매니저 초기화 실패: ${error.message}`);
    }
  }

  // 🎯 명령어 핸들러 초기화 (표준화된 매개변수)
  async initializeCommandHandler() {
    Logger.info("🎯 명령어 핸들러 초기화 중...");

    try {
      // ✅ 표준화된 의존성 주입
      this.commandHandler = new CommandHandler(this.bot, {
        moduleManager: this.dependencies.moduleManager,
        menuManager: this.dependencies.menuManager,
        userStates: this.dependencies.userStates,
        errorHandler: this.dependencies.errorHandler,
      });

      Logger.success("✅ 명령어 핸들러 초기화 완료");
    } catch (error) {
      throw new Error(`명령어 핸들러 초기화 실패: ${error.message}`);
    }
  }

  // 🎯 BotFather 명령어 자동 등록 (핵심 기능!)
  async registerBotFatherCommands() {
    Logger.info("🎯 BotFather 명령어 등록 중...");

    try {
      if (!this.commandHandler) {
        throw new Error("CommandHandler가 초기화되지 않음");
      }

      // 🚀 자동 등록 실행
      const success = await this.commandHandler.initializeBotCommands();

      if (success) {
        Logger.success("🎉 BotFather 명령어 등록 성공!");

        // 등록된 명령어 통계 로깅
        const stats = botCommandsRegistry.getCommandStats();
        Logger.info(`📊 등록된 명령어 통계:`);
        Logger.info(`   • 총 명령어: ${stats.totalCommands}개`);
        Logger.info(`   • 공개 명령어: ${stats.publicCommands}개`);
        Logger.info(`   • 시스템 명령어: ${stats.systemCommands}개`);
        Logger.info(`   • 모듈 명령어: ${stats.moduleCommands}개`);
        Logger.info(`   • 관리자 명령어: ${stats.adminCommands}개`);
      } else {
        Logger.error("❌ BotFather 명령어 등록 실패");
        // 치명적이지 않으므로 봇은 계속 실행
      }
    } catch (error) {
      Logger.error("❌ BotFather 명령어 등록 중 오류:", error);
      // 치명적이지 않으므로 봇은 계속 실행
    }
  }

  // 🎧 이벤트 리스너 설정 (표준화된 처리)
  async setupEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 중...");

    // 메시지 이벤트 (명령어 우선 처리)
    this.bot.on("message", async (msg) => {
      try {
        // 1️⃣ 명령어 먼저 처리 (최우선)
        if (msg.text && msg.text.startsWith("/")) {
          const handled = await this.commandHandler.handle(msg);
          if (handled) return; // 명령어로 처리됨
        }

        // 2️⃣ 모듈에서 일반 메시지 처리
        if (this.moduleManager) {
          await this.moduleManager.handleMessage(this.bot, msg);
        }
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        if (this.errorHandler) {
          await this.errorHandler.handleError(error, {
            type: "message",
            userId: msg.from?.id,
            module: "EventListener",
          });
        }
      }
    });

    // 콜백 쿼리 이벤트 (표준화된 매개변수)
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        // 콜백 응답 (즉시)
        await this.bot.answerCallbackQuery(callbackQuery.id);

        // ✅ 표준화된 매개변수로 모듈 매니저에 전달
        if (this.moduleManager) {
          await this.moduleManager.handleCallback(
            this.bot, // bot
            callbackQuery, // callbackQuery
            null, // subAction (모듈에서 파싱)
            null, // params (모듈에서 파싱)
            this.moduleManager // menuManager
          );
        }
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);
        if (this.errorHandler) {
          await this.errorHandler.handleError(error, {
            type: "callback",
            userId: callbackQuery.from?.id,
            module: "EventListener",
          });
        }
      }
    });

    // 에러 이벤트
    this.bot.on("polling_error", async (error) => {
      Logger.error("🚨 폴링 에러:", error.message);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, {
          type: "polling",
          module: "TelegramBot",
        });
      }
    });

    this.bot.on("error", async (error) => {
      Logger.error("🚨 봇 에러:", error.message);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, {
          type: "bot_error",
          module: "TelegramBot",
        });
      }
    });

    Logger.success("✅ 이벤트 리스너 등록 완료");
  }

  // 💓 헬스 모니터링 시작
  async startHealthMonitoring() {
    Logger.info("💓 헬스 모니터링 시작...");

    this.healthCheckInterval = setInterval(async () => {
      try {
        // 봇 상태 확인
        const botInfo = await this.bot.getMe();

        // 메모리 사용량 체크
        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        if (memMB > 100) {
          // 100MB 이상 시 경고
          Logger.warn(`⚠️ 메모리 사용량 높음: ${memMB}MB`);
        }

        Logger.debug(`💓 헬스 체크 완료 - 메모리: ${memMB}MB`);
      } catch (error) {
        Logger.error("💓 헬스 체크 실패:", error.message);
      }
    }, 30000); // 30초마다

    Logger.success("✅ 헬스 모니터링 시작됨");
  }

  // 🎉 시작 알림
  async sendStartupNotification() {
    try {
      const adminIds = process.env.ADMIN_IDS?.split(",") || [];

      if (adminIds.length === 0) {
        Logger.debug("관리자 ID가 설정되지 않아 시작 알림 생략");
        return;
      }

      const uptime = Math.round(process.uptime());
      const startupText =
        `🎉 **${config.bot.name} v${config.bot.version}** 시작됨!\n\n` +
        `🌐 환경: ${process.env.NODE_ENV || "development"}\n` +
        `🚀 Railway: ${process.env.RAILWAY_ENVIRONMENT ? "YES" : "NO"}\n` +
        `💾 DB: ${process.env.MONGO_URL ? "MongoDB" : "메모리 모드"}\n` +
        `⏱️ 부팅 시간: ${uptime}초\n` +
        `📅 시작 시간: ${this.startTime.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}`;

      // 모든 관리자에게 알림
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

  // 🚨 치명적 오류 처리
  async handleCriticalError(error) {
    Logger.error("🚨 치명적 오류 발생:", error);

    try {
      // 관리자에게 긴급 알림
      const adminIds = process.env.ADMIN_IDS?.split(",") || [];
      const errorText =
        `🚨 **치명적 오류 발생**\n\n` +
        `⚠️ 오류: ${error.message}\n` +
        `📅 시간: ${new Date().toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}\n` +
        `🌐 환경: ${process.env.NODE_ENV || "development"}`;

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

  // 🧹 정리 작업
  async cleanup() {
    Logger.info("🧹 봇 정리 작업 시작...");

    try {
      // 헬스 모니터링 중단
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        Logger.debug("헬스 모니터링 중단됨");
      }

      // 데이터베이스 연결 정리
      if (mongoPoolManager) {
        await mongoPoolManager.close();
        Logger.debug("데이터베이스 연결 종료됨");
      }

      // 봇 정리
      if (this.bot) {
        this.bot.removeAllListeners();
        Logger.debug("봇 이벤트 리스너 제거됨");
      }

      Logger.success("✅ 정리 작업 완료");
    } catch (error) {
      Logger.error("정리 작업 중 오류:", error);
    }
  }

  // 📊 봇 상태 조회
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      startTime: this.startTime,
      uptime: Math.round(process.uptime()),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      environment: process.env.NODE_ENV || "development",
      railway: !!process.env.RAILWAY_ENVIRONMENT,
      database: !!process.env.MONGO_URL,
      commandStats: this.commandHandler?.getStats() || null,
    };
  }
}

// 🚀 메인 실행부
async function main() {
  let bot = null;

  try {
    // 프로세스 종료 핸들러
    process.on("SIGINT", async () => {
      Logger.info("🛑 SIGINT 수신, 봇 종료 중...");
      if (bot) await bot.cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      Logger.info("🛑 SIGTERM 수신, 봇 종료 중...");
      if (bot) await bot.cleanup();
      process.exit(0);
    });

    process.on("uncaughtException", async (error) => {
      Logger.error("🚨 처리되지 않은 예외:", error);
      if (bot) await bot.handleCriticalError(error);
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      Logger.error("🚨 처리되지 않은 Promise 거부:", reason);
      if (bot && reason instanceof Error) {
        await bot.handleCriticalError(reason);
      }
    });

    // 봇 인스턴스 생성 및 초기화
    bot = new DoomockBot();
    await bot.initialize();

    Logger.success(
      `🎉 ${config.bot.name} v${config.bot.version} 완전히 시작됨!`
    );
    Logger.info("🤖 봇이 메시지를 기다리고 있습니다...");
  } catch (error) {
    Logger.error("🚨 메인 실행 실패:", error);

    if (bot) {
      await bot.handleCriticalError(error);
    }

    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main().catch((error) => {
    console.error("치명적 오류:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
