// src/controllers/BotController.js - 수정된 import 부분
const { Telegraf, session } = require("telegraf");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");

// 🔥 핵심 수정: DatabaseManager import 방식 변경
const {
  DatabaseManager,
  getInstance: getDbInstance,
} = require("../database/DatabaseManager");
const {
  getInstance: getMongooseInstance,
} = require("../database/MongooseManager");

class BotController {
  constructor() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("텔레그램 봇 토큰이 설정되지 않았습니다.");
    }

    this.bot = new Telegraf(token);
    this.moduleManager = new ModuleManager();
    this.navigationHandler = new NavigationHandler();

    // 🔥 핵심 수정: DatabaseManager 인스턴스 생성 방식 변경
    try {
      this.dbManager = getDbInstance(); // 기존 MongoDB Native
      if (!this.dbManager) {
        logger.warn(
          "⚠️ DatabaseManager getInstance() 반환값이 null, 새 인스턴스 생성"
        );
        this.dbManager = new DatabaseManager();
      }
    } catch (error) {
      logger.error("❌ DatabaseManager 생성 실패:", error);
      logger.info("🔄 새 DatabaseManager 인스턴스 생성 시도...");
      this.dbManager = new DatabaseManager();
    }

    try {
      this.mongooseManager = getMongooseInstance(); // 새로운 Mongoose
      if (!this.mongooseManager) {
        logger.warn("⚠️ MongooseManager getInstance() 반환값이 null");
      }
    } catch (error) {
      logger.error("❌ MongooseManager 생성 실패:", error);
    }

    logger.info("🚀 ═══ 봇 컨트롤러 생성 ═══");
    logger.debug(`📊 dbManager: ${this.dbManager ? "생성됨" : "null"}`);
    logger.debug(
      `📊 mongooseManager: ${this.mongooseManager ? "생성됨" : "null"}`
    );
  }

  async initialize() {
    logger.info("🔄 봇 초기화를 시작합니다...");
    try {
      // 1. DatabaseManager 연결 확인 및 연결
      if (this.dbManager) {
        logger.info("🔌 DatabaseManager 연결 시도...");
        await this.dbManager.connect();
        logger.success("✅ DatabaseManager 연결 완료");
      } else {
        logger.warn("⚠️ DatabaseManager가 null - 연결 건너뜀");
      }

      // 2. MongooseManager 연결 (있는 경우)
      if (this.mongooseManager) {
        logger.info("🔌 MongooseManager 연결 시도...");
        await this.mongooseManager.connect();
        logger.success("✅ MongooseManager 연결 완료");
      } else {
        logger.warn("⚠️ MongooseManager가 null - 연결 건너뜀");
      }

      // 3. NavigationHandler 초기화
      this.navigationHandler.initialize(this.bot);

      // 4. ModuleManager 초기화 (DB 인스턴스 전달)
      await this.moduleManager.initialize(this.bot, {
        dbManager: this.dbManager,
        mongooseManager: this.mongooseManager,
      });

      // 5. 상호 참조 설정
      this.navigationHandler.setModuleManager(this.moduleManager);
      this.moduleManager.setNavigationHandler(this.navigationHandler);

      // 6. 미들웨어 설정
      this.setupMiddlewares();

      logger.success(
        "✅ 모든 모듈과 핸들러가 성공적으로 초기화 및 연결되었습니다."
      );
    } catch (error) {
      logger.error("💥 봇 초기화 중 치명적인 오류 발생:", error);
      throw error;
    }
  }

  // 나머지 메서드들은 동일...
  setupMiddlewares() {
    // 세션 미들웨어
    this.bot.use(session());

    // 에러 핸들러
    this.bot.catch((err, ctx) => {
      logger.error(
        `💥 처리되지 않은 오류 발생 (컨텍스트: ${ctx.updateType})`,
        err
      );
      if (ctx.chat?.id) {
        ctx
          .reply(
            "죄송합니다. 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          )
          .catch((e) =>
            logger.error("최종 오류 메시지 전송조차 실패했습니다:", e)
          );
      }
    });

    // 성능 로깅 미들웨어
    this.bot.use(async (ctx, next) => {
      const startTime = Date.now();
      await next();
      const ms = Date.now() - startTime;
      logger.debug(
        `✅ [${ctx.updateType}] 처리 완료 (${ms}ms) | 사용자: ${getUserName(
          ctx.from
        )}`
      );
    });

    // 명령어 핸들러
    this.bot.command("start", (ctx) => this.handleStartCommand(ctx));
    this.bot.command("help", (ctx) => this.handleHelpCommand(ctx));
    this.bot.command("status", (ctx) => this.handleStatusCommand(ctx));

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", (ctx) => this.handleCallbackQuery(ctx));

    // 메시지 핸들러
    this.bot.on("message", (ctx) => this.handleMessage(ctx));

    logger.info("🔗 모든 미들웨어와 이벤트 핸들러가 설정되었습니다.");
  }

  async start() {
    await this.bot.launch();
    logger.celebration("🎉 텔레그램 봇이 성공적으로 시작되었습니다!");

    // Graceful stop
    process.once("SIGINT", () => this.stop("SIGINT"));
    process.once("SIGTERM", () => this.stop("SIGTERM"));
  }

  async stop(signal) {
    logger.info(`🛑 ${signal} 신호 수신, 봇 종료 중...`);

    try {
      // 봇 정지
      this.bot.stop(signal);

      // 데이터베이스 연결 종료
      if (this.mongooseManager) {
        await this.mongooseManager.disconnect();
      }
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      logger.info("✅ 봇이 정상적으로 종료되었습니다.");
    } catch (error) {
      logger.error("❌ 봇 종료 중 오류:", error);
    }
  }

  async handleStartCommand(ctx) {
    await this.navigationHandler.showMainMenu(ctx);
  }

  async handleHelpCommand(ctx) {
    const helpText = `
🤖 *두목봇 도움말*

*기본 명령어:*
/start - 메인 메뉴 표시
/help - 도움말 표시
/status - 시스템 상태 확인

*주요 기능:*
📝 *할일 관리* - 할일 추가, 완료, 삭제
⏰ *타이머* - 포모도로 타이머
🏢 *근무시간* - 출퇴근 기록
🏖️ *휴가관리* - 연차 사용 기록
⏰ *리마인더* - 알림 설정
🔮 *운세* - 오늘의 운세
🌤️ *날씨* - 날씨 정보
🔊 *TTS* - 텍스트 음성 변환

각 기능은 메인 메뉴에서 선택하실 수 있습니다.
    `;

    await ctx.replyWithMarkdown(helpText);
  }

  async handleStatusCommand(ctx) {
    try {
      // 시스템 상태 수집
      const dbStatus = this.dbManager
        ? this.dbManager.getStatus()
        : { connected: false };
      const mongooseStatus = this.mongooseManager
        ? this.mongooseManager.getStatus()
        : { connected: false };
      const moduleStatus = this.moduleManager.getStatus();

      const statusText = `
🔍 *시스템 상태*

*데이터베이스 (Native):*
▸ 연결: ${dbStatus.connected ? "✅" : "❌"}
▸ DB: ${dbStatus.database || "N/A"}

*데이터베이스 (Mongoose):*
▸ 연결: ${mongooseStatus.connected ? "✅" : "❌"}
▸ 상태: ${mongooseStatus.readyState || "N/A"}
▸ 모델: ${mongooseStatus.models ? mongooseStatus.models.length : 0}개

*모듈:*
▸ 로드됨: ${moduleStatus.loadedModules}개
▸ 활성: ${moduleStatus.activeModules}개

*메모리:*
▸ 사용: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
▸ 총계: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB

*업타임:* ${Math.round(process.uptime() / 60)}분
      `;

      await ctx.replyWithMarkdown(statusText);
    } catch (error) {
      logger.error("상태 명령 처리 오류:", error);
      await ctx.reply("상태 정보를 가져오는 중 오류가 발생했습니다.");
    }
  }

  async handleCallbackQuery(ctx) {
    try {
      await ctx.answerCbQuery(); // 즉시 응답
      await this.navigationHandler.handleCallback(ctx);
    } catch (error) {
      logger.error("콜백 쿼리 처리 오류:", error);
      await ctx.answerCbQuery("처리 중 오류가 발생했습니다.", {
        show_alert: true,
      });
    }
  }

  async handleMessage(ctx) {
    try {
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
}

module.exports = BotController;
