// src/controllers/BotController.js - 안정화된 최종 버전

const { Telegraf, session } = require("telegraf");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");
const { getInstance } = require("../database/DatabaseManager");

class BotController {
  constructor() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("텔레그램 봇 토큰이 설정되지 않았습니다.");
    }
    this.bot = new Telegraf(token);
    this.moduleManager = new ModuleManager();
    this.navigationHandler = new NavigationHandler();
    this.dbManager = getInstance();

    logger.info("🚀 ═══ 봇 컨트롤러 생성 ═══");
  }

  async initialize() {
    logger.info("🔄 봇 초기화를 시작합니다...");
    try {
      await this.dbManager.connect();
      this.navigationHandler.initialize(this.bot);
      await this.moduleManager.initialize(this.bot, {
        db: this.dbManager.getDb(),
      });

      this.navigationHandler.setModuleManager(this.moduleManager);
      this.moduleManager.setNavigationHandler(this.navigationHandler);

      this.setupMiddlewares();
      logger.success(
        "✅ 모든 모듈과 핸들러가 성공적으로 초기화 및 연결되었습니다."
      );
    } catch (error) {
      logger.error("💥 봇 초기화 중 치명적인 오류 발생:", error);
      throw error;
    }
  }

  setupMiddlewares() {
    this.bot.use(session());

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

    this.bot.use(async (ctx, next) => {
      const startTime = Date.now();
      await next();
      const ms = Date.now() - startTime;
      logger.info(
        `✅ [${ctx.updateType}] 처리 완료 (${ms}ms) | 사용자: ${getUserName(
          ctx.from
        )}`
      );
    });

    this.bot.command("start", (ctx) => this.handleStartCommand(ctx));
    this.bot.on("callback_query", (ctx) => this.handleCallbackQuery(ctx));
    this.bot.on("message", (ctx) => this.handleMessage(ctx));

    logger.info("🔗 모든 미들웨어와 이벤트 핸들러가 설정되었습니다.");
  }

  async start() {
    await this.bot.launch();
    logger.celebration("🎉 텔레그램 봇이 성공적으로 시작되었습니다!");
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  async handleStartCommand(ctx) {
    await this.navigationHandler.showMainMenu(ctx);
  }

  async handleCallbackQuery(ctx) {
    await this.navigationHandler.handleCallback(ctx);
  }

  async handleMessage(ctx) {
    await this.moduleManager.handleMessage(this.bot, ctx.message);
  }
}

module.exports = BotController;
