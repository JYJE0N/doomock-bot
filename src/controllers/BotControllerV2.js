// src/controllers/BotControllerV2.js
class BotControllerV2 {
  constructor() {
    this.eventBus = new EventBus();
    this.bot = null;
    this.modules = new Map();
  }

  async initialize() {
    // 1. 이벤트버스 미들웨어 설정
    this.setupEventMiddleware();

    // 2. 텔레그램 봇 초기화
    this.bot = new Telegraf(process.env.BOT_TOKEN);

    // 3. 이벤트 리스너 설정
    this.setupEventListeners();

    // 4. 텔레그램 핸들러 설정 (이벤트 발행만!)
    this.setupTelegramHandlers();

    // 5. 모듈 로드 (이벤트 기반)
    await this.loadModules();

    // 6. 시스템 준비 완료 이벤트
    this.eventBus.publish("system:ready");
  }

  setupEventMiddleware() {
    // 로깅 미들웨어
    this.eventBus.use(async (event, next) => {
      logger.debug(`🚇 이벤트: ${event.name}`);
      await next();
    });

    // 성능 측정 미들웨어
    this.eventBus.use(async (event, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      if (duration > 100) {
        logger.warn(`⚠️ 느린 이벤트: ${event.name} (${duration}ms)`);
      }
    });
  }

  setupEventListeners() {
    // 렌더링 이벤트 처리
    this.eventBus.subscribe("render:message", async (event) => {
      const { chatId, text, ...options } = event.payload;
      await this.bot.telegram.sendMessage(chatId, text, options);
    });

    // 메뉴 렌더링 이벤트
    this.eventBus.subscribe("render:menu", async (event) => {
      const { type, chatId } = event.payload;

      // NavigationHandler의 역할을 이벤트로 처리
      const keyboard = this.buildMenuKeyboard(type);
      const text = this.getMenuText(type);

      await this.bot.telegram.sendMessage(chatId, text, {
        reply_markup: keyboard,
        parse_mode: "Markdown"
      });
    });
  }

  setupTelegramHandlers() {
    // 텍스트 메시지 → 이벤트
    this.bot.on("text", (ctx) => {
      const text = ctx.message.text;

      // 명령어인지 확인
      if (text.startsWith("/")) {
        this.eventBus.publish("user:command", {
          command: text.slice(1),
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id
        });
      } else {
        // 자연어 처리
        this.eventBus.publish("user:message", {
          text,
          userId: ctx.from.id,
          chatId: ctx.chat.id
        });
      }
    });

    // 콜백 쿼리 → 이벤트
    this.bot.on("callback_query", async (ctx) => {
      await ctx.answerCbQuery("⏳ 처리 중...");

      this.eventBus.publish("user:callback", {
        data: ctx.callbackQuery.data,
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        messageId: ctx.callbackQuery.message.message_id
      });
    });
  }

  async loadModules() {
    // 이벤트 기반 모듈 로드
    const SystemModule = require("../modules/SystemModuleV2");
    const systemModule = new SystemModule(this.eventBus);
    this.modules.set("system", systemModule);

    // 점진적으로 다른 모듈도 추가...
  }
}
