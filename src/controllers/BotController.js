// src/controllers/BotController.js - 🤖 텔레그램 봇 컨트롤러 (무한재귀 해결)
const { Telegraf, session } = require("telegraf");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

// 핵심 매니저들
// ✅ 수정: DatabaseManager를 getInstance로 가져오도록 변경
const { getInstance: getDbManager } = require("../database/DatabaseManager");
const {
  getInstance: getMongooseManager,
} = require("../database/MongooseManager");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");

/**
 * 🤖 BotController - 텔레그램 봇 핵심 컨트롤러
 *
 * 🔧 수정 사항:
 * - 무한재귀 cleanup() 문제 해결
 * - 안전한 종료 로직
 * - 중복 초기화 방지
 * - Promise 거부 처리 개선
 */
class BotController {
  constructor() {
    // 초기화 상태 관리
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.cleanupInProgress = false;

    // 텔레그램 봇 인스턴스
    this.bot = null;

    // 핵심 매니저들
    this.dbManager = null;
    this.mongooseManager = null;
    this.moduleManager = null;
    this.navigationHandler = null;

    // 통계
    this.stats = {
      messagesProcessed: 0,
      callbacksProcessed: 0,
      errorsOccurred: 0,
      startTime: Date.now(),
    };

    logger.info("🤖 BotController 인스턴스 생성됨");
  }

  /**
   * 🎯 봇 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("⚠️ BotController가 이미 초기화됨");
      return;
    }

    if (this.isShuttingDown) {
      logger.warn("⚠️ BotController가 종료 중입니다");
      return;
    }

    try {
      logger.info("🤖 BotController 초기화 시작...");

      // 1. 환경변수 검증
      this.validateEnvironment();

      // 2. 텔레그램 봇 생성
      this.bot = new Telegraf(process.env.BOT_TOKEN); // ✅ 수정: BOT_TOKEN 사용
      logger.info("✅ 텔레그램 봇 인스턴스 생성됨");

      // 3. 데이터베이스 초기화
      await this.initializeDatabases();

      // 4. 핸들러와 매니저 초기화
      await this.initializeHandlers();

      // 5. 미들웨어 설정
      this.setupMiddlewares();

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 환경변수 검증
   */
  validateEnvironment() {
    const requiredEnvVars = [
      "BOT_TOKEN", // ✅ 수정: TELEGRAM_BOT_TOKEN → BOT_TOKEN
      "MONGO_URL",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수가 누락됨: ${missingVars.join(", ")}`);
    }

    logger.debug("✅ 환경변수 검증 완료");
  }

  /**
   * 🗄️ 데이터베이스 초기화
   */
  async initializeDatabases() {
    try {
      logger.info("🗄️ 데이터베이스 초기화 중...");

      // MongoDB Native Driver 초기화
      // ✅ 수정: new DatabaseManager() 대신 getInstance() 사용
      this.dbManager = getDbManager();
      await this.dbManager.connect();
      logger.success("✅ MongoDB Native 연결 완료");

      // Mongoose 초기화
      this.mongooseManager = getMongooseManager();
      await this.mongooseManager.connect();
      logger.success("✅ Mongoose 연결 완료");
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎮 핸들러와 매니저 초기화
   */
  async initializeHandlers() {
    try {
      logger.info("🎮 핸들러 및 매니저 초기화 중...");

      // ServiceBuilder 생성 및 초기화
      const { createServiceBuilder } = require("../core/ServiceBuilder");
      this.serviceBuilder = createServiceBuilder();
      this.serviceBuilder.setDatabaseManager(this.dbManager);
      this.serviceBuilder.setMongooseManager(this.mongooseManager);
      await this.serviceBuilder.initialize();

      // ModuleManager 초기화
      this.moduleManager = new ModuleManager();
      await this.moduleManager.initialize(this.bot, {
        dbManager: this.dbManager,
        mongooseManager: this.mongooseManager,
      });
      logger.success("✅ ModuleManager 초기화 완료");

      // NavigationHandler 초기화
      this.navigationHandler = new NavigationHandler(this.bot);
      this.navigationHandler.initialize(this.bot);
      logger.success("✅ NavigationHandler 초기화 완료");

      // 상호 참조 설정
      this.navigationHandler.setModuleManager(this.moduleManager);
      this.moduleManager.setNavigationHandler(this.navigationHandler);
      logger.success("✅ 핸들러 간 상호 참조 설정 완료");
    } catch (error) {
      logger.error("❌ 핸들러 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔗 미들웨어 설정
   */
  setupMiddlewares() {
    logger.info("🔗 미들웨어 설정 중...");

    // 세션 미들웨어
    this.bot.use(session());

    // 성능 로깅 미들웨어
    this.bot.use(async (ctx, next) => {
      const startTime = Date.now();
      try {
        await next();
        const duration = Date.now() - startTime;
        logger.debug(
          `✅ [${
            ctx.updateType
          }] 처리 완료 (${duration}ms) | 사용자: ${getUserName(ctx.from)}`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          `❌ [${
            ctx.updateType
          }] 처리 실패 (${duration}ms) | 사용자: ${getUserName(ctx.from)}`,
          error
        );
        throw error;
      }
    });

    // 에러 핸들러 (중요: 무한재귀 방지)
    this.bot.catch((err, ctx) => {
      this.stats.errorsOccurred++;

      logger.error(`💥 처리되지 않은 오류 발생 (컨텍스트: ${ctx.updateType})`, {
        error: err.message,
        stack: err.stack,
        userId: ctx.from?.id,
        userName: getUserName(ctx.from),
      });

      // 🔥 중요: 여기서 cleanup()이나 shutdown()을 호출하지 않음!
      // 무한재귀의 원인이었음

      // 단순히 사용자에게 오류 메시지만 전송
      if (ctx.chat?.id) {
        ctx
          .reply(
            "죄송합니다. 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          )
          .catch((sendError) => {
            logger.error("오류 메시지 전송도 실패:", sendError);
          });
      }
    });

    // 명령어 핸들러
    this.bot.command("start", (ctx) => this.handleStartCommand(ctx));
    this.bot.command("help", (ctx) => this.handleHelpCommand(ctx));
    this.bot.command("status", (ctx) => this.handleStatusCommand(ctx));

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", (ctx) => this.handleCallbackQuery(ctx));

    // 메시지 핸들러
    this.bot.on("message", (ctx) => this.handleMessage(ctx));

    logger.success("✅ 모든 미들웨어 설정 완료");
  }

  /**
   * 🚀 봇 시작
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error("BotController가 초기화되지 않음");
    }

    try {
      await this.bot.launch();
      logger.celebration("🎉 텔레그램 봇이 성공적으로 시작되었습니다!");

      // Graceful stop 설정
      process.once("SIGINT", () => this.stop("SIGINT"));
      process.once("SIGTERM", () => this.stop("SIGTERM"));
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🛑 봇 정지 (안전한 종료)
   */
  async stop(signal) {
    if (this.isShuttingDown) {
      logger.warn("⚠️ 이미 종료 중입니다");
      return;
    }

    this.isShuttingDown = true;

    logger.info(`🛑 ${signal} 신호 수신, 봇 종료 중...`);

    try {
      // 봇 정지
      if (this.bot) {
        this.bot.stop(signal);
        logger.info("✅ 텔레그램 봇 정지됨");
      }

      // 정리 작업
      await this.cleanup();

      logger.success("✅ 봇이 정상적으로 종료되었습니다.");
    } catch (error) {
      logger.error("❌ 봇 종료 중 오류:", error);
      throw error;
    }
  }

  /**
   * 🧹 정리 작업 (무한재귀 방지)
   */
  async cleanup() {
    if (this.cleanupInProgress) {
      logger.warn("⚠️ 정리 작업이 이미 진행 중입니다");
      return;
    }

    this.cleanupInProgress = true;

    try {
      logger.info("🧹 BotController 정리 작업 시작...");

      // ModuleManager 정리
      if (this.moduleManager) {
        try {
          await this.moduleManager.cleanup();
          logger.debug("✅ ModuleManager 정리 완료");
        } catch (error) {
          logger.warn("⚠️ ModuleManager 정리 실패:", error.message);
        }
      }

      // NavigationHandler 정리
      if (this.navigationHandler) {
        try {
          if (typeof this.navigationHandler.cleanup === "function") {
            await this.navigationHandler.cleanup();
          }
          logger.debug("✅ NavigationHandler 정리 완료");
        } catch (error) {
          logger.warn("⚠️ NavigationHandler 정리 실패:", error.message);
        }
      }

      // 데이터베이스 연결 종료
      if (this.mongooseManager) {
        try {
          await this.mongooseManager.disconnect();
          logger.debug("✅ Mongoose 연결 종료됨");
        } catch (error) {
          logger.warn("⚠️ Mongoose 연결 종료 실패:", error.message);
        }
      }

      if (this.dbManager) {
        try {
          await this.dbManager.disconnect();
          logger.debug("✅ MongoDB Native 연결 종료됨");
        } catch (error) {
          logger.warn("⚠️ MongoDB Native 연결 종료 실패:", error.message);
        }
      }

      // 상태 초기화
      this.isInitialized = false;
      this.bot = null;
      this.moduleManager = null;
      this.navigationHandler = null;
      this.dbManager = null;
      this.mongooseManager = null;

      logger.success("✅ BotController 정리 작업 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 작업 실패:", error);
      throw error;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  // ===== 🎯 명령어 핸들러들 =====

  /**
   * /start 명령어 처리
   */
  async handleStartCommand(ctx) {
    try {
      this.stats.messagesProcessed++;
      await this.navigationHandler.showMainMenu(ctx);
    } catch (error) {
      logger.error("start 명령 처리 오류:", error);
      await ctx.reply("시작 중 오류가 발생했습니다.");
    }
  }

  /**
   * /help 명령어 처리
   */
  async handleHelpCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      const helpText =
        `🤖 **두목봇 도움말**\n\n` +
        `**기본 명령어:**\n` +
        `/start - 메인 메뉴 표시\n` +
        `/help - 도움말 표시\n` +
        `/status - 시스템 상태 확인\n\n` +
        `**주요 기능:**\n` +
        `📝 **할일 관리** - 할일 추가, 완료, 삭제\n` +
        `⏰ **타이머** - 포모도로 타이머\n` +
        `🏢 **근무시간** - 출퇴근 기록\n` +
        `🏖️ **휴가관리** - 연차 사용 기록\n` +
        `🔔 **리마인더** - 알림 설정\n` +
        `🔮 **운세** - 오늘의 운세\n` +
        `🌤️ **날씨** - 날씨 정보\n` +
        `🔊 **TTS** - 텍스트 음성 변환\n\n` +
        `각 기능은 메인 메뉴에서 선택하실 수 있습니다.`;

      await ctx.replyWithMarkdown(helpText);
    } catch (error) {
      logger.error("help 명령 처리 오류:", error);
      await ctx.reply("도움말 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * /status 명령어 처리
   */
  async handleStatusCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      // 시스템 상태 수집
      const dbStatus = this.dbManager?.getStatus() || { connected: false };
      const mongooseStatus = this.mongooseManager?.getStatus() || {
        connected: false,
      };
      const moduleStatus = this.moduleManager?.getStatus() || {
        loadedModules: 0,
        activeModules: 0,
      };

      const uptime = Math.round(
        (Date.now() - this.stats.startTime) / 1000 / 60
      );
      const memoryUsage = Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      );
      const totalMemory = Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024
      );

      const statusText =
        `🔍 **시스템 상태**\n\n` +
        `**데이터베이스 (Native):**\n` +
        `▸ 연결: ${dbStatus.connected ? "✅" : "❌"}\n` +
        `▸ DB: ${dbStatus.database || "N/A"}\n\n` +
        `**데이터베이스 (Mongoose):**\n` +
        `▸ 연결: ${mongooseStatus.connected ? "✅" : "❌"}\n` +
        `▸ 상태: ${mongooseStatus.readyState || "N/A"}\n` +
        `▸ 모델: ${mongooseStatus.models?.length || 0}개\n\n` +
        `**모듈:**\n` +
        `▸ 로드됨: ${moduleStatus.loadedModules}개\n` +
        `▸ 활성: ${moduleStatus.activeModules}개\n\n` +
        `**성능:**\n` +
        `▸ 메모리: ${memoryUsage}MB / ${totalMemory}MB\n` +
        `▸ 업타임: ${uptime}분\n` +
        `▸ 처리된 메시지: ${this.stats.messagesProcessed}개\n` +
        `▸ 처리된 콜백: ${this.stats.callbacksProcessed}개\n` +
        `▸ 오류 발생: ${this.stats.errorsOccurred}개`;

      await ctx.replyWithMarkdown(statusText);
    } catch (error) {
      logger.error("status 명령 처리 오류:", error);
      await ctx.reply("상태 정보를 가져오는 중 오류가 발생했습니다.");
    }
  }

  /**
   * 콜백 쿼리 처리 (중복 응답 방지)
   */
  async handleCallbackQuery(ctx) {
    try {
      this.stats.callbacksProcessed++;

      // 즉시 응답 (중복 방지)
      await ctx.answerCbQuery();

      // NavigationHandler로 위임
      await this.navigationHandler.handleCallback(ctx);
    } catch (error) {
      logger.error("콜백 쿼리 처리 오류:", error);

      // 안전한 오류 응답
      try {
        await ctx.answerCbQuery("처리 중 오류가 발생했습니다.", {
          show_alert: true,
        });
      } catch (answerError) {
        logger.error("콜백 쿼리 오류 응답 실패:", answerError);
      }
    }
  }

  /**
   * 메시지 처리
   */
  async handleMessage(ctx) {
    try {
      this.stats.messagesProcessed++;

      // ModuleManager로 위임
      const handled = await this.moduleManager.handleMessage(
        this.bot,
        ctx.message
      );

      // 모듈에서 처리하지 않은 메시지
      if (!handled && ctx.message.text && !ctx.message.text.startsWith("/")) {
        await ctx.reply(
          "명령을 이해하지 못했습니다. /help를 입력하여 도움말을 확인하세요."
        );
      }
    } catch (error) {
      logger.error("메시지 처리 오류:", error);
      await ctx.reply("메시지 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📊 상태 정보 반환
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      shuttingDown: this.isShuttingDown,
      cleanupInProgress: this.cleanupInProgress,
      stats: this.stats,
      uptime: Date.now() - this.stats.startTime,
      components: {
        bot: !!this.bot,
        dbManager: !!this.dbManager,
        mongooseManager: !!this.mongooseManager,
        moduleManager: !!this.moduleManager,
        navigationHandler: !!this.navigationHandler,
      },
    };
  }
}

module.exports = BotController;
