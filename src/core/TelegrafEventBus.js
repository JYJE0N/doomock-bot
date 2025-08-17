const { Telegraf, Scenes, session } = require("telegraf");
const EventEmitter = require("events");
const { LogUtils, IdUtils } = require("../utils");

/**
 * 🤖 Telegraf와 EventBus를 통합한 클래스
 *
 * Telegraf의 미들웨어 시스템과 EventBus를 연결
 */
class TelegrafEventBus extends EventEmitter {
  constructor(token, options = {}) {
    super();

    // Telegraf 봇 인스턴스
    this.bot = new Telegraf(token);

    // 설정
    this.config = {
      enableLogging: options.enableLogging !== false,
      enableStats: options.enableStats !== false,
      ...options
    };

    // 통계
    this.stats = {
      messages: 0,
      commands: 0,
      callbacks: 0,
      errors: 0
    };

    // 이벤트 스키마
    this.eventSchemas = new Map();

    // Telegraf 미들웨어 설정
    this.setupMiddleware();

    LogUtils.success("🤖 TelegrafEventBus 초기화 완료");
  }

  /**
   * Telegraf 미들웨어 설정
   */
  setupMiddleware() {
    // 세션 미들웨어
    this.bot.use(
      session({
        defaultSession: () => ({
          messageCount: 0
        })
      })
    );

    // 로깅 미들웨어
    this.bot.use(async (ctx, next) => {
      const start = Date.now();

      if (this.config.enableLogging) {
        LogUtils.info(`📨 수신: ${ctx.updateType}`, {
          from: ctx.from?.id,
          chat: ctx.chat?.id
        });
      }

      await next();

      const duration = Date.now() - start;
      if (this.config.enableLogging) {
        LogUtils.debug(`⏱️ 처리 시간: ${duration}ms`);
      }
    });

    // 에러 핸들링
    this.bot.catch((err, ctx) => {
      LogUtils.error("❌ Bot Error:", err);
      this.stats.errors++;

      this.emit("bot:error", {
        error: err.message,
        stack: err.stack,
        context: {
          updateType: ctx.updateType,
          userId: ctx.from?.id
        }
      });
    });
  }

  /**
   * 이벤트 기반 명령어 등록
   */
  onCommand(command, eventName) {
    this.bot.command(command, async (ctx) => {
      this.stats.commands++;

      const event = {
        id: IdUtils.generateId("cmd"),
        name: eventName || `command:${command}`,
        payload: {
          command,
          args: ctx.message.text.split(" ").slice(1),
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id,
          userName: ctx.from.username,
          firstName: ctx.from.first_name,
          text: ctx.message.text
        },
        context: ctx // Telegraf context 포함
      };

      this.emit(event.name, event);

      if (this.config.enableLogging) {
        LogUtils.info(`🎯 명령어 이벤트: ${event.name}`);
      }
    });
  }

  /**
   * 이벤트 기반 액션(콜백) 등록
   */
  onAction(action, eventName) {
    this.bot.action(action, async (ctx) => {
      this.stats.callbacks++;

      // 콜백 쿼리 응답
      await ctx.answerCbQuery();

      const event = {
        id: IdUtils.generateId("action"),
        name: eventName || `action:${action}`,
        payload: {
          action,
          data: ctx.callbackQuery.data,
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.callbackQuery.message?.message_id,
          userName: ctx.from.username
        },
        context: ctx
      };

      this.emit(event.name, event);

      if (this.config.enableLogging) {
        LogUtils.info(`🔘 액션 이벤트: ${event.name}`);
      }
    });
  }

  /**
   * 동적 액션 핸들러 (정규식 또는 함수)
   */
  onDynamicAction(pattern, eventName) {
    this.bot.action(pattern, async (ctx) => {
      this.stats.callbacks++;

      await ctx.answerCbQuery();

      const data = ctx.callbackQuery.data;
      const parts = data.split(":");

      const event = {
        id: IdUtils.generateId("dynaction"),
        name: eventName || "action:dynamic",
        payload: {
          action: parts[0],
          subAction: parts[1],
          params: parts.slice(2),
          fullData: data,
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.callbackQuery.message?.message_id
        },
        context: ctx
      };

      this.emit(event.name, event);

      if (this.config.enableLogging) {
        LogUtils.info(`🎲 동적 액션 이벤트: ${event.name}`);
      }
    });
  }

  /**
   * 텍스트 메시지 핸들러
   */
  onText(pattern, eventName) {
    this.bot.hears(pattern, async (ctx) => {
      this.stats.messages++;

      const event = {
        id: IdUtils.generateId("text"),
        name: eventName || "message:text",
        payload: {
          text: ctx.message.text,
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id,
          userName: ctx.from.username,
          match: ctx.match
        },
        context: ctx
      };

      this.emit(event.name, event);

      if (this.config.enableLogging) {
        LogUtils.info(`💬 텍스트 이벤트: ${event.name}`);
      }
    });
  }

  /**
   * 일반 메시지 핸들러
   */
  onMessage(eventName = "message:received") {
    this.bot.on("message", async (ctx) => {
      this.stats.messages++;

      const event = {
        id: IdUtils.generateId("msg"),
        name: eventName,
        payload: {
          text: ctx.message.text,
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id,
          userName: ctx.from.username,
          messageType: ctx.message.text
            ? "text"
            : ctx.message.photo
              ? "photo"
              : ctx.message.document
                ? "document"
                : "other"
        },
        context: ctx
      };

      this.emit(event.name, event);
    });
  }

  /**
   * Scene (대화형 흐름) 등록
   */
  registerScene(scene) {
    const stage = new Scenes.Stage([scene]);
    this.bot.use(stage.middleware());

    LogUtils.info(`🎬 Scene 등록: ${scene.id}`);
  }

  /**
   * 봇 시작
   */
  async start() {
    // 시작 이벤트 발행
    this.emit("bot:starting");

    // 봇 시작
    await this.bot.launch();

    LogUtils.success("🚀 Telegraf 봇 시작됨");
    this.emit("bot:started");

    // Graceful shutdown
    process.once("SIGINT", () => this.stop("SIGINT"));
    process.once("SIGTERM", () => this.stop("SIGTERM"));
  }

  /**
   * 봇 중지
   */
  async stop(signal) {
    LogUtils.info(`🛑 봇 중지 중... (${signal})`);

    this.emit("bot:stopping", { signal });

    await this.bot.stop(signal);

    this.emit("bot:stopped");
    LogUtils.info("👋 봇이 정상적으로 종료되었습니다");
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

module.exports = TelegrafEventBus;
