// src/controllers/BotController.js
const EventBus = require("../core/EventBus");
const DIContainer = require("../core/DIContainer");
const logger = require("../utils/Logger");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.isInitialized = false;

    // 중복 처리 방지
    this.messageQueue = new Map();
    this.callbackQueue = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // 서비스 등록
      this.registerServices();

      // 이벤트 리스너 설정
      this.setupEventListeners();

      // 봇 이벤트 핸들러 설정
      this.setupBotHandlers();

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  registerServices() {
    // 데이터베이스 매니저 등록
    DIContainer.register(
      "dbManager",
      (container) => {
        const DatabaseManager = require("../database/DatabaseManager");
        return new DatabaseManager(this.config.MONGO_URL);
      },
      { singleton: true }
    );

    // 모듈 로더 등록
    DIContainer.register(
      "moduleLoader",
      (container) => {
        const ModuleLoader = require("../core/ModuleLoader");
        return new ModuleLoader();
      },
      { singleton: true }
    );
  }

  setupEventListeners() {
    // 메시지 이벤트
    EventBus.on("message:received", async (msg) => {
      await this.processMessage(msg);
    });

    // 콜백 이벤트
    EventBus.on("callback:received", async (callbackQuery) => {
      await this.processCallback(callbackQuery);
    });
  }

  setupBotHandlers() {
    // 텔레그램 봇 이벤트
    this.bot.on("message", (msg) => {
      const messageKey = `${msg.chat.id}_${msg.message_id}`;

      if (this.messageQueue.has(messageKey)) {
        return;
      }

      this.messageQueue.set(messageKey, true);
      EventBus.emit("message:received", msg);

      // 5초 후 큐에서 제거
      setTimeout(() => {
        this.messageQueue.delete(messageKey);
      }, 5000);
    });

    this.bot.on("callback_query", async (callbackQuery) => {
      const callbackKey = `${callbackQuery.id}`;

      if (this.callbackQueue.has(callbackKey)) {
        return;
      }

      this.callbackQueue.set(callbackKey, true);

      // 즉시 응답
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        logger.error("콜백 응답 실패:", error);
      }

      EventBus.emit("callback:received", callbackQuery);

      // 1초 후 큐에서 제거
      setTimeout(() => {
        this.callbackQueue.delete(callbackKey);
      }, 1000);
    });
  }

  async processMessage(msg) {
    try {
      const results = await EventBus.emitAsync("message:process", msg);
      const handled = results.some((result) => result === true);

      if (!handled && msg.text?.startsWith("/")) {
        await this.handleUnknownCommand(msg);
      }
    } catch (error) {
      logger.error("메시지 처리 오류:", error);
      await this.sendErrorMessage(msg.chat.id);
    }
  }

  async processCallback(callbackQuery) {
    try {
      const results = await EventBus.emitAsync(
        "callback:process",
        callbackQuery
      );
      const handled = results.some((result) => result === true);

      if (!handled) {
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      logger.error("콜백 처리 오류:", error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
    }
  }
}

module.exports = BotController;
