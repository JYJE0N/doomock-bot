// src/controllers/BotController.js

const CallbackManager = require("../managers/CallbackManager");
const ModuleManager = require("../managers/ModuleManager");
const MessageHandler = require("../handlers/MessageHandler");
const CommandHandler = require("../handlers/CommandHandler");
const { DatabaseManager } = require("../database/DatabaseManager");
const Logger = require("../utils/Logger");
const UserHelper = require("../utils/UserHelper");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    // 매니저들
    this.dbManager = null;
    this.moduleManager = null;
    this.menuManager = null;
    this.callbackManager = null;

    // 핸들러들
    this.messageHandler = null;
    this.commandHandler = null;

    // 사용자 상태 관리
    this.userStates = new Map();

    // ⭐ 중복 처리 방지 플래그들
    this.eventListenersRegistered = false;
    this.isInitialized = false;

    // ⭐ 메시지/콜백 처리 중복 방지
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();
  }

  async initialize() {
    // 중복 초기화 방지
    if (this.isInitialized) {
      Logger.warn("BotController 이미 초기화됨, 무시");
      return;
    }

    try {
      Logger.info("🚀 BotController 초기화 시작...");

      // 1. 데이터베이스 연결 (선택사항)
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 3. 핸들러 초기화
      this.initializeHandlers();

      // 4. 이벤트 리스너 등록 (한 번만!)
      if (!this.eventListenersRegistered) {
        this.registerEventListeners();
        this.eventListenersRegistered = true;
      }

      this.isInitialized = true;
      Logger.success("✅ BotController 초기화 완료!");
    } catch (error) {
      Logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  // ⭐ 이벤트 리스너 등록 - 완전한 중복 방지!
  registerEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 시작...");

    // ⭐ 기존 리스너들 완전 제거
    this.bot.removeAllListeners("message");
    this.bot.removeAllListeners("callback_query");
    this.bot.removeAllListeners("polling_error");
    this.bot.removeAllListeners("error");

    // ⭐ 메시지 이벤트 - 중복 처리 방지
    this.bot.on("message", async (msg) => {
      const messageKey = `${msg.chat.id}_${msg.message_id}`;

      // 중복 처리 방지
      if (this.processingMessages.has(messageKey)) {
        Logger.debug(`중복 메시지 무시: ${messageKey}`);
        return;
      }

      this.processingMessages.add(messageKey);

      try {
        Logger.debug(`📨 메시지 수신: ${msg.text || "[미디어]"}`);
        await this.handleMessage(msg);
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      } finally {
        // 처리 완료 후 플래그 해제 (5초 후)
        setTimeout(() => {
          this.processingMessages.delete(messageKey);
        }, 5000);
      }
    });

    // ⭐ 콜백 쿼리 이벤트 - 중복 처리 방지
    this.bot.on("callback_query", async (callbackQuery) => {
      const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}_${callbackQuery.id}`;

      // 중복 처리 방지
      if (this.processingCallbacks.has(callbackKey)) {
        Logger.debug(`중복 콜백 무시: ${callbackKey}`);
        return;
      }

      this.processingCallbacks.add(callbackKey);

      try {
        Logger.info(`📞 콜백 수신: ${callbackQuery.data}`);

        // ⭐ ModuleManager에서 직접 처리!
        await this.moduleManager.handleCallback(this.bot, callbackQuery);
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);

        // 에러 응답
        try {
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "❌ 처리 중 오류가 발생했습니다.",
            show_alert: true,
          });
        } catch (answerError) {
          Logger.debug("콜백 에러 응답 실패");
        }

        await this.sendErrorMessage(callbackQuery.message.chat.id);
      } finally {
        // 처리 완료 후 플래그 해제 (3초 후)
        setTimeout(() => {
          this.processingCallbacks.delete(callbackKey);
        }, 3000);
      }
    });

    // 폴링 에러 이벤트
    this.bot.on("polling_error", (error) => {
      Logger.error(
        "폴링 오류:",
        error.code === "EFATAL" ? error.message : error
      );
    });

    // 일반 에러 이벤트
    this.bot.on("error", (error) => {
      Logger.error("봇 에러:", error);
    });

    Logger.success("✅ 이벤트 리스너 등록 완료!");
  }

  // 데이터베이스 초기화
  async initializeDatabase() {
    Logger.info("💾 데이터베이스 초기화 중...");

    if (this.config.MONGO_URL) {
      try {
        const { DatabaseManager } = require("../database/DatabaseManager");
        this.dbManager = new DatabaseManager(this.config.MONGO_URL);
        await this.dbManager.connect();
        Logger.success("✅ 데이터베이스 연결 성공");
      } catch (error) {
        Logger.error("❌ 데이터베이스 연결 실패:", error);
        Logger.warn("⚠️ MongoDB 없이 실행합니다");
      }
    } else {
      Logger.warn("⚠️ MONGO_URL이 설정되지 않음");
    }
  }

  async initializeModuleManager() {
    this.moduleManager = new ModuleManager(this.bot, {
      dbManager: this.dbManager,
      userStates: this.userStates,
    });

    await this.moduleManager.initialize();
    Logger.success("✅ 모듈 매니저 초기화 완료");
  }

  initializeHandlers() {
    // 메시지 핸들러
    this.messageHandler = new MessageHandler(this.bot, {
      moduleManager: this.moduleManager,
      menuManager: this.menuManager,
      callbackManager: this.callbackManager,
      userStates: this.userStates,
    });

    // 명령어 핸들러
    this.commandHandler = new CommandHandler(this.bot, {
      moduleManager: this.moduleManager,
      menuManager: this.menuManager,
      userStates: this.userStates,
    });

    Logger.success("✅ 핸들러 초기화 완료");
  }

  // ⭐ 메시지 처리 - 중복 방지 개선
  async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);

    Logger.info(`💬 메시지: "${text}" (${userName})`);

    // /start 명령어 직접 처리
    if (text === "/start") {
      const welcomeText =
        "🤖 **두목봇에 오신걸 환영합니다!**\n\n" +
        `안녕하세요 ${userName}님! 무엇을 도와드릴까요?\n\n` +
        "아래 메뉴에서 원하는 기능을 선택해주세요:";

      await this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: this.moduleManager.createMainMenuKeyboard(),
      });
      return;
    }

    // 다른 모든 메시지는 ModuleManager로
    try {
      const handled = await this.moduleManager.handleMessage(this.bot, msg);
      if (!handled) {
        Logger.debug(`처리되지 않은 메시지: ${text}`);
      }
    } catch (error) {
      Logger.error("ModuleManager 메시지 처리 오류:", error);
      await this.sendErrorMessage(chatId);
    }
  }

  // ⭐ 에러 메시지 전송 개선
  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } catch (error) {
      Logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // ⭐ 정리 메서드 추가
  cleanup() {
    if (this.bot) {
      this.bot.removeAllListeners("message");
      this.bot.removeAllListeners("callback_query");
      this.bot.removeAllListeners("polling_error");
      this.bot.removeAllListeners("error");
    }

    this.processingMessages.clear();
    this.processingCallbacks.clear();
    this.eventListenersRegistered = false;
    this.isInitialized = false;

    Logger.info("🧹 BotController 정리 완료");
  }
}

module.exports = BotController;
