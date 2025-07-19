// src/controllers/BotController.js - 최종 수정 (핸들러 의존성 제거)

const ModuleManager = require("../managers/ModuleManager");
const Logger = require("../utils/Logger");
const UserHelper = require("../utils/UserHelper");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    // 핵심 매니저만
    this.dbManager = null;
    this.moduleManager = null;

    // 사용자 상태 관리
    this.userStates = new Map();

    // 중복 처리 방지
    this.eventListenersRegistered = false;
    this.isInitialized = false;
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    Logger.info("🔧 BotController 생성됨");
  }

  async initialize() {
    if (this.isInitialized) {
      Logger.warn("BotController 이미 초기화됨, 무시");
      return;
    }

    try {
      Logger.info("🚀 BotController 초기화 시작...");

      // 1. 데이터베이스 초기화 (안전하게)
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 3. 이벤트 리스너 등록
      if (!this.eventListenersRegistered) {
        this.registerEventListeners();
        this.eventListenersRegistered = true;
      }

      this.isInitialized = true;
      Logger.success("✅ BotController 초기화 완료!");
    } catch (error) {
      Logger.error("❌ BotController 초기화 실패:", error);
      Logger.error("에러 스택:", error.stack);
      throw error;
    }
  }

  // ⭐ 안전한 데이터베이스 초기화
  async initializeDatabase() {
    Logger.info("💾 데이터베이스 초기화 시도...");

    if (!this.config.MONGO_URL) {
      Logger.warn("⚠️ MONGO_URL이 설정되지 않음, MongoDB 없이 실행");
      return;
    }

    try {
      // DatabaseManager가 있는지 안전하게 확인
      const { DatabaseManager } = require("../database/DatabaseManager");
      this.dbManager = new DatabaseManager(this.config.MONGO_URL);
      await this.dbManager.connect();
      Logger.success("✅ 데이터베이스 연결 성공");
    } catch (requireError) {
      Logger.warn("⚠️ DatabaseManager를 찾을 수 없음:", requireError.message);
      Logger.warn("⚠️ MongoDB 없이 실행합니다");
    }
  }

  // ⭐ 모듈 매니저 초기화
  async initializeModuleManager() {
    Logger.info("📦 모듈 매니저 초기화 중...");

    try {
      this.moduleManager = new ModuleManager(this.bot, {
        dbManager: this.dbManager,
        userStates: this.userStates,
      });

      await this.moduleManager.initialize();
      Logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      Logger.error("❌ 모듈 매니저 초기화 실패:", error);
      throw error;
    }
  }

  // ⭐ 이벤트 리스너 등록
  registerEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 중...");

    // 기존 리스너 제거
    this.bot.removeAllListeners("message");
    this.bot.removeAllListeners("callback_query");
    this.bot.removeAllListeners("polling_error");
    this.bot.removeAllListeners("error");

    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      const messageKey = `${msg.chat.id}_${msg.message_id}`;

      if (this.processingMessages.has(messageKey)) {
        Logger.debug(`중복 메시지 무시: ${messageKey}`);
        return;
      }

      this.processingMessages.add(messageKey);

      try {
        await this.handleMessage(msg);
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      } finally {
        setTimeout(() => {
          this.processingMessages.delete(messageKey);
        }, 5000);
      }
    });

    // 콜백 이벤트
    this.bot.on("callback_query", async (callbackQuery) => {
      const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}`;

      if (this.processingCallbacks.has(callbackKey)) {
        Logger.debug(`중복 콜백 무시: ${callbackKey}`);
        return;
      }

      this.processingCallbacks.add(callbackKey);

      try {
        Logger.info(`📞 콜백 수신: ${callbackQuery.data}`);
        await this.moduleManager.handleCallback(this.bot, callbackQuery);
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);

        try {
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "❌ 처리 중 오류가 발생했습니다.",
            show_alert: true,
          });
        } catch (answerError) {
          Logger.debug("콜백 응답 실패");
        }

        await this.sendErrorMessage(callbackQuery.message.chat.id);
      } finally {
        setTimeout(() => {
          this.processingCallbacks.delete(callbackKey);
        }, 3000);
      }
    });

    // 에러 이벤트
    this.bot.on("polling_error", (error) => {
      if (
        error.code === "ETELEGRAM" &&
        error.response?.body?.error_code === 409
      ) {
        Logger.error("🚨 409 충돌 감지!");
      } else {
        Logger.error("폴링 오류:", error.message);
      }
    });

    this.bot.on("error", (error) => {
      Logger.error("봇 에러:", error.message);
    });

    Logger.success("✅ 이벤트 리스너 등록 완료!");
  }

  // ⭐ 메시지 처리
  async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);

    Logger.debug(`💬 메시지: "${text}" (${userName})`);

    // /start 명령어 처리
    if (text === "/start") {
      const welcomeText =
        "🤖 **두목봇에 오신걸 환영합니다!**\n\n" +
        `안녕하세요 ${userName}님! 무엇을 도와드릴까요?\n\n` +
        "아래 메뉴에서 원하는 기능을 선택해주세요:";

      try {
        await this.bot.sendMessage(chatId, welcomeText, {
          parse_mode: "Markdown",
          reply_markup: this.moduleManager.createMainMenuKeyboard(),
        });
      } catch (error) {
        Logger.error("/start 처리 오류:", error);
        await this.sendErrorMessage(chatId);
      }
      return;
    }

    // 다른 메시지는 ModuleManager로
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

  // ⭐ 에러 메시지 전송
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

  // ⭐ 정리 함수
  async cleanup() {
    Logger.info("🧹 BotController 정리 시작...");

    try {
      // 이벤트 리스너 제거
      if (this.bot) {
        this.bot.removeAllListeners();
      }

      // 상태 초기화
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.eventListenersRegistered = false;
      this.isInitialized = false;

      // 데이터베이스 연결 종료
      if (this.dbManager && typeof this.dbManager.disconnect === "function") {
        await this.dbManager.disconnect();
        Logger.info("✅ 데이터베이스 연결 종료");
      }

      Logger.success("✅ BotController 정리 완료");
    } catch (error) {
      Logger.error("❌ BotController 정리 실패:", error);
    }
  }

  // 호환성을 위한 메서드
  async shutdown() {
    await this.cleanup();
  }
}

module.exports = BotController;
