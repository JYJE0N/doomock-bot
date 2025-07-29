// src/controllers/BotController.js - Mongoose 통합 버전
const { Telegraf, session } = require("telegraf");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");
const { getInstance: getDbInstance } = require("../database/DatabaseManager");
const {
  getInstance: getMongooseInstance,
} = require("../database/MongooseManager");

class BotController {
  constructor() {
    this.bot = null;
    this.commandHandler = null;
    this.moduleManager = null;

    // 🎯 중앙 집중식 CommandParser
    this.commandParser = require("../utils/CommandParser");
  }

  /**
   * 🎯 메시지 이벤트 처리 (중앙 집중식 명령어 추출)
   */
  /**
   * 🎯 메시지 처리 - 완전한 중앙 집중식
   */
  async handleMessage(ctx) {
    const msg = ctx.message;

    if (!msg || !msg.text) return;

    try {
      // ✅ 유일한 파싱 지점 (중앙 집중화)
      const parseResult = this.commandParser.parseMessage(msg.text);

      if (parseResult.isCommand) {
        // ✅ 명령어인 경우 → CommandHandler.handleCommand로 직접!
        return await this.commandHandler.handleCommand(
          this.bot,
          msg,
          parseResult.command,
          parseResult.args,
          parseResult // 추가 메타 정보
        );
      } else {
        // ✅ 일반 메시지인 경우 → ModuleManager로
        return await this.moduleManager.handleMessage(this.bot, msg);
      }
    } catch (error) {
      logger.error("메시지 처리 오류:", error);
      await ctx.reply(
        "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    }
  }

  extractCommandInfo(text) {
    if (!text || typeof text !== "string") {
      return { isCommand: false };
    }

    const trimmedText = text.trim();

    // 명령어 형식 확인 (/ 로 시작)
    if (!trimmedText.startsWith("/")) {
      return { isCommand: false };
    }

    // 공백으로 분리
    const parts = trimmedText.split(/\s+/);
    const commandPart = parts[0];

    // 명령어 추출 (/ 제거 및 소문자 변환)
    const command = commandPart.substring(1).toLowerCase();

    // 인수 추출
    const args = parts.slice(1);

    // 봇 멘션 제거 (@botname 형태)
    const cleanCommand = command.split("@")[0];

    return {
      isCommand: true,
      command: cleanCommand,
      args: args,
      original: text,
      raw: commandPart,
    };
  }

  async initialize() {
    logger.info("🔄 봇 초기화를 시작합니다...");
    try {
      // 1. Mongoose 연결 (우선)
      await this.mongooseManager.connect();

      // 2. 기존 DB 연결 (아직 사용하는 서비스들을 위해)
      await this.dbManager.connect();

      // 3. NavigationHandler 초기화
      this.navigationHandler.initialize(this.bot);

      // 4. ModuleManager 초기화 (양쪽 DB 전달)
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
      await this.mongooseManager.disconnect();
      await this.dbManager.disconnect();

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
      const dbStatus = this.dbManager.getStatus();
      const mongooseStatus = this.mongooseManager.getStatus();
      const moduleStatus = this.moduleManager.getStatus();

      const statusText = `
🔍 *시스템 상태*

*데이터베이스 (Native):*
• 연결: ${dbStatus.connected ? "✅" : "❌"}
• DB: ${dbStatus.database || "N/A"}

*데이터베이스 (Mongoose):*
• 연결: ${mongooseStatus.connected ? "✅" : "❌"}
• 상태: ${mongooseStatus.readyState}
• 모델: ${mongooseStatus.models.length}개

*모듈:*
• 로드됨: ${moduleStatus.loadedModules}개
• 활성: ${moduleStatus.activeModules}개

*메모리:*
• 사용: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• 총계: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB

*업타임:* ${Math.round(process.uptime() / 60)}분
      `;

      await ctx.replyWithMarkdown(statusText);
    } catch (error) {
      logger.error("상태 명령 처리 오류:", error);
      await ctx.reply("상태 정보를 가져오는 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🔍 콜백 처리
   */
  async handleCallback(ctx) {
    try {
      // NavigationHandler로 바로 전달
      await this.navigationHandler.handleCallback(ctx);
    } catch (error) {
      logger.error("콜백 처리 오류:", error);
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
