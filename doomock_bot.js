// bot.js - 두목봇 메인 통합 파일 (v3 리팩토링 완료)

const TelegramBot = require("node-telegram-bot-api");
const Logger = require("./src/utils/Logger");
const { mongoPoolManager } = require("./src/database/MongoPoolManager");
const ModuleManager = require("./src/managers/ModuleManager");
const { errorHandler } = require("./src/utils/ErrorHandler"); // ✅ 수정: 중괄호 추가
const { getUserName } = require("./src/utils/UserHelper");
const config = require("./src/config/config");

class DoomockBot {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.isInitialized = false;
    this.startTime = new Date();
    this.isDatabaseEnabled = false; // ✅ 추가: DB 상태 추적

    // 📊 봇 전체 통계
    this.botStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      totalUsers: new Set(),
      errors: 0,
      uptime: 0,
    };

    Logger.info(`🚀 ${config.bot.name} v${config.bot.version} 시작 중...`);
  }

  // 🚀 봇 초기화
  async initialize() {
    try {
      Logger.info("⚙️ 봇 시스템 초기화 시작...");

      // 1. 환경변수 확인 (수정됨)
      await this.validateEnvironment();

      // 2. 데이터베이스 연결 (선택적)
      await this.initializeDatabase();

      // 3. 텔레그램 봇 생성
      await this.initializeTelegramBot();

      // 4. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 5. 에러 핸들러 시작
      await this.initializeErrorHandler();

      // 6. 이벤트 리스너 등록
      await this.setupEventListeners();

      // 7. 건강 상태 모니터링 시작
      await this.startHealthMonitoring();

      this.isInitialized = true;
      Logger.success(`✅ ${config.bot.name} 초기화 완료!`);

      await this.sendStartupNotification();
    } catch (error) {
      Logger.error("❌ 봇 초기화 실패:", error);
      await this.handleCriticalError(error);
      throw error;
    }
  }

  // 🔍 환경변수 검증 (수정됨)
  async validateEnvironment() {
    Logger.info("🔍 환경변수 검증 중...");

    // ✅ 수정: MONGO_URL을 필수에서 제외
    const requiredEnvVars = ["BOT_TOKEN"];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수가 누락됨: ${missingVars.join(", ")}`);
    }

    // 민감한 정보 마스킹하여 로깅
    Logger.success("✅ 환경변수 검증 완료");
    Logger.info(`🌐 환경: ${process.env.NODE_ENV || "development"}`);
    Logger.info(`🔑 BOT_TOKEN: ${process.env.BOT_TOKEN ? "설정됨" : "누락"}`);
    Logger.info(
      `🗄️ MONGO_URL: ${process.env.MONGO_URL ? "설정됨" : "없음 (메모리 모드)"}`
    );
  }

  // 🗄️ 데이터베이스 초기화 (수정됨)
  async initializeDatabase() {
    Logger.info("🗄️ 데이터베이스 연결 중...");

    // ✅ MONGO_URL이 없으면 메모리 모드로 실행
    if (!process.env.MONGO_URL) {
      Logger.warn("⚠️ MONGO_URL이 설정되지 않음, 메모리 모드로 실행");
      this.isDatabaseEnabled = false;
      return;
    }

    try {
      await mongoPoolManager.connect();
      this.isDatabaseEnabled = true;

      // 기본 인덱스 설정
      await this.setupDatabaseIndexes();

      Logger.success("✅ 데이터베이스 연결 완료");
    } catch (error) {
      // ✅ 수정: DB 연결 실패해도 계속 진행
      Logger.warn(
        `⚠️ 데이터베이스 연결 실패, 메모리 모드로 실행: ${error.message}`
      );
      this.isDatabaseEnabled = false;
      // throw 제거하여 봇이 계속 실행되도록 함
    }
  }

  // 📑 데이터베이스 인덱스 설정
  async setupDatabaseIndexes() {
    if (!this.isDatabaseEnabled) return;

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

  // 🤖 텔레그램 봇 초기화
  async initializeTelegramBot() {
    Logger.info("🤖 텔레그램 봇 생성 중...");

    try {
      this.bot = new TelegramBot(process.env.BOT_TOKEN, {
        polling: true,
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4, // IPv4 강제 사용 (Railway 호환성)
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

  // 🔧 모듈 매니저 초기화
  async initializeModuleManager() {
    Logger.info("🔧 모듈 매니저 초기화 중...");

    try {
      this.moduleManager = new ModuleManager(this.bot, {
        database: this.isDatabaseEnabled ? mongoPoolManager : null, // ✅ 수정
      });

      await this.moduleManager.initialize();
      Logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      throw new Error(`모듈 매니저 초기화 실패: ${error.message}`);
    }
  }

  // 🛡️ 에러 핸들러 초기화
  async initializeErrorHandler() {
    Logger.info("🛡️ 에러 핸들러 초기화 중...");

    try {
      // errorHandler는 이미 인스턴스화됨
      Logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      Logger.warn("⚠️ 에러 핸들러 초기화 실패:", error.message);
    }
  }

  // 🎧 이벤트 리스너 설정
  async setupEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 중...");

    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      try {
        this.botStats.totalMessages++;
        this.botStats.totalUsers.add(msg.from.id);

        await this.moduleManager.handleMessage(this.bot, msg);
      } catch (error) {
        this.botStats.errors++;
        Logger.error("메시지 처리 오류:", error);
        await errorHandler.handleError(error, {
          type: "message",
          userId: msg.from.id,
        });
      }
    });

    // 콜백 쿼리 이벤트
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        this.botStats.totalCallbacks++;

        await this.moduleManager.handleCallback(this.bot, callbackQuery);
      } catch (error) {
        this.botStats.errors++;
        Logger.error("콜백 처리 오류:", error);
        await errorHandler.handleError(error, {
          type: "callback",
          userId: callbackQuery.from.id,
        });
      }
    });

    // 에러 이벤트
    this.bot.on("polling_error", async (error) => {
      Logger.error("🚨 폴링 에러:", error);
      await errorHandler.handleError(error, { type: "polling" });
    });

    Logger.success("✅ 이벤트 리스너 등록 완료");
  }

  // 💓 헬스 모니터링 시작
  async startHealthMonitoring() {
    Logger.info("💓 헬스 모니터링 시작...");

    this.healthCheckInterval = setInterval(async () => {
      try {
        // 봇 상태 체크
        if (!this.bot.isPolling()) {
          Logger.warn("⚠️ 봇이 폴링 중이 아님");
        }

        // 메모리 사용량 체크
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        if (memUsedMB > 512) {
          // 512MB 초과 시 경고
          Logger.warn(`⚠️ 높은 메모리 사용량: ${memUsedMB}MB`);
        }

        // 업타임 업데이트
        this.botStats.uptime = Math.round((Date.now() - this.startTime) / 1000);
      } catch (error) {
        Logger.error("💓 헬스체크 오류:", error);
      }
    }, 30000); // 30초마다

    Logger.success("✅ 헬스 모니터링 시작됨");
  }

  // 🚨 크리티컬 에러 처리
  async handleCriticalError(error) {
    Logger.error("🚨 크리티컬 에러:", error);

    try {
      await errorHandler.triggerAlert("critical_error", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    } catch (alertError) {
      Logger.error("알림 전송 실패:", alertError);
    }
  }

  // 📢 시작 알림
  async sendStartupNotification() {
    if (!process.env.ADMIN_CHAT_ID) return;

    try {
      const dbStatus = this.isDatabaseEnabled ? "✅ 연결됨" : "⚠️ 메모리 모드";

      const startupMessage = `
🚀 **${config.bot.name} v${config.bot.version} 시작됨**

• 🕐 시작 시간: ${this.startTime.toLocaleString()}
• 🌐 환경: ${process.env.NODE_ENV || "development"}
• 🗄️ 데이터베이스: ${dbStatus}
• 🔧 모듈: ${this.moduleManager.modules.size}개 로드됨
• 💾 메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

모든 시스템이 정상 작동 중입니다! ✅
      `.trim();

      await this.bot.sendMessage(process.env.ADMIN_CHAT_ID, startupMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      Logger.debug("시작 알림 전송 실패 (무시됨):", error.message);
    }
  }

  // 🔄 정리 작업 및 종료
  async gracefulShutdown(signal) {
    Logger.info(`🔄 정리 작업 시작... (신호: ${signal})`);

    try {
      // 1. 새로운 요청 차단
      if (this.bot) {
        this.bot.stopPolling();
      }

      // 2. 진행 중인 작업 완료 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 3. 각 시스템 정리
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // 4. 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 5. 에러 핸들러 정리
      if (errorHandler) {
        errorHandler.cleanup();
      }

      // 6. 데이터베이스 연결 종료 (있는 경우에만)
      if (this.isDatabaseEnabled) {
        await mongoPoolManager.disconnect();
      }

      Logger.success("✅ 정리 작업 완료");
    } catch (error) {
      Logger.error("❌ 정리 작업 중 오류:", error);
    } finally {
      process.exit(0);
    }
  }

  // 🚀 봇 시작
  async start() {
    try {
      await this.initialize();

      // 종료 신호 처리
      process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));
      process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));

      Logger.success(`
🎉 ${config.bot.name} v${config.bot.version} 가동 중!
🕐 시작 시간: ${this.startTime.toLocaleString()}
🗄️ 데이터베이스: ${this.isDatabaseEnabled ? "연결됨" : "메모리 모드"}
🤖 모든 시스템 정상 작동 중...
      `);
    } catch (error) {
      Logger.error("🚨 봇 시작 실패:", error);
      process.exit(1);
    }
  }
}

// 🚀 봇 실행
if (require.main === module) {
  const doomockBot = new DoomockBot();
  doomockBot.start().catch((error) => {
    Logger.error("🚨 봇 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
