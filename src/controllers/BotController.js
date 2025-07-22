// src/controllers/BotController.js - 콜백 응답 통합 (리팩토링)

const ModuleManager = require("../managers/ModuleManager");
const logger = require("../utils/Logger");
const UserHelper = require("../utils/UserHelper");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    // 핵심 매니저
    this.dbManager = null;
    this.moduleManager = null;

    // 사용자 상태 관리
    this.userStates = new Map();

    // 중복 처리 방지
    this.eventListenersRegistered = false;
    this.isInitialized = false;
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    logger.info("🔧 BotController 생성됨");
  }

  // 🚀 초기화
  async initialize() {
    if (this.isInitialized) {
      logger.warn("BotController 이미 초기화됨");
      return;
    }

    try {
      logger.info("🚀 BotController 초기화 시작...");

      // 1. 데이터베이스 초기화 (선택적)
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 3. 이벤트 리스너 등록
      if (!this.eventListenersRegistered) {
        this.registerEventListeners();
        this.eventListenersRegistered = true;
      }

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료!");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  // 💾 데이터베이스 초기화
  async initializeDatabase() {
    if (!this.config.MONGO_URL) {
      logger.warn("⚠️ MONGO_URL이 설정되지 않음, MongoDB 없이 실행");
      return;
    }

    try {
      const { DatabaseManager } = require("../database/DatabaseManager");
      this.dbManager = new DatabaseManager(this.config.MONGO_URL);
      await this.dbManager.connect();
      logger.success("✅ 데이터베이스 연결 성공");
    } catch (error) {
      logger.warn("⚠️ 데이터베이스 연결 실패:", error.message);
      logger.warn("⚠️ MongoDB 없이 실행합니다");
    }
  }

  // 📦 모듈 매니저 초기화
  async initializeModuleManager() {
    logger.info("📦 모듈 매니저 초기화 중...");

    try {
      this.moduleManager = new ModuleManager(this.bot, {
        dbManager: this.dbManager,
        userStates: this.userStates,
      });

      await this.moduleManager.initialize();
      logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      logger.error("❌ 모듈 매니저 초기화 실패:", error);
      throw error;
    }
  }

  // 🎧 이벤트 리스너 등록
  registerEventListeners() {
    logger.info("🎧 이벤트 리스너 등록 중...");

    // 기존 리스너 제거
    this.bot.removeAllListeners();

    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      const messageKey = `${msg.chat.id}_${msg.message_id}`;

      if (this.processingMessages.has(messageKey)) {
        logger.debug(`중복 메시지 무시: ${messageKey}`);
        return;
      }

      this.processingMessages.add(messageKey);

      try {
        await this.handleMessage(msg);
      } catch (error) {
        logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      } finally {
        setTimeout(() => {
          this.processingMessages.delete(messageKey);
        }, 5000);
      }
    });

    // 콜백 이벤트 - 한 곳에서만 응답 처리
    this.bot.on("callback_query", async (callbackQuery) => {
      const callbackKey = `${callbackQuery.from.id}_${
        callbackQuery.data
      }_${Date.now()}`;

      if (this.processingCallbacks.has(callbackKey)) {
        logger.debug(`중복 콜백 무시: ${callbackKey}`);
        return;
      }

      this.processingCallbacks.add(callbackKey);

      try {
        logger.info(`📞 콜백 수신: ${callbackQuery.data}`);

        // 🎯 시스템 콜백 우선 처리 (새로 추가!)
        const systemHandled = await this.handleSystemCallback(callbackQuery);

        if (systemHandled) {
          // 시스템에서 처리했으면 완료
          await this.answerCallback(callbackQuery.id);
          return;
        }
        // ModuleManager에 위임 (응답은 여기서 처리)
        if (this.moduleManager) {
          await this.moduleManager.handleCallback(callbackQuery);
          await this.answerCallback(callbackQuery.id);
        } else {
          throw new Error("ModuleManager not initialized");
        }
      } catch (error) {
        logger.error("콜백 처리 오류:", error);

        // 에러 시 에러 메시지와 함께 응답
        await this.answerCallback(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });

        // 에러 메시지 전송
        if (callbackQuery.message?.chat) {
          await this.sendErrorMessage(callbackQuery.message.chat.id);
        }
      } finally {
        setTimeout(() => {
          this.processingCallbacks.delete(callbackKey);
        }, 1000);
      }
    });

    // 에러 이벤트
    this.bot.on("polling_error", (error) => {
      if (
        error.code === "ETELEGRAM" &&
        error.response?.body?.error_code === 409
      ) {
        logger.error("🚨 409 충돌 감지!");
      } else {
        logger.error("폴링 오류:", error.message);
      }
    });

    this.bot.on("error", (error) => {
      logger.error("봇 에러:", error.message);
    });

    logger.success("✅ 이벤트 리스너 등록 완료!");
  }
  // 시스템 콜백 처리 메서드 (새로 추가!)
  async handleSystemCallback(callbackQuery) {
    const [targetModule, ...actionParts] = callbackQuery.data.split(":");
    const subAction = actionParts.join(":") || "menu";

    // 시스템 콜백이 아니면 false 반환
    if (!["main", "system", "help"].includes(targetModule)) {
      return false;
    }

    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      logger.info(`🏠 시스템 콜백 처리: ${targetModule}:${subAction}`);

      if (
        targetModule === "main" &&
        (subAction === "menu" || subAction === "main")
      ) {
        // 🏠 메인 메뉴
        await this.showMainMenu(chatId, messageId);
        return true;
      }

      if (targetModule === "system" && subAction === "status") {
        // 📊 시스템 상태
        await this.showSystemStatus(chatId, messageId);
        return true;
      }

      if (
        targetModule === "help" ||
        (targetModule === "system" && subAction === "help")
      ) {
        // ❓ 도움말
        await this.showHelp(chatId, messageId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        `시스템 콜백 처리 오류 (${targetModule}:${subAction}):`,
        error
      );
      throw error;
    }
  }
  // 🏠 메인 메뉴 표시 (새로 추가!)
  async showMainMenu(chatId, messageId) {
    const menuText =
      `🏠 **메인 메뉴**\n\n` +
      `안녕하세요! 무엇을 도와드릴까요?\n\n` +
      `아래 메뉴에서 원하는 기능을 선택해주세요:`;

    const keyboard = this.moduleManager?.createMainMenuKeyboard() || {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
          { text: "📊 시스템 상태", callback_data: "system:status" },
        ],
        [{ text: "❓ 도움말", callback_data: "help:main" }],
      ],
    };

    await this.bot.editMessageText(menuText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("✅ 메인 메뉴 표시 완료");
  }

  // 📊 시스템 상태 표시 (새로 추가!)
  async showSystemStatus(chatId, messageId) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const statusText =
      `📊 **시스템 상태**\n\n` +
      `⏰ **가동시간:** ${hours}시간 ${minutes}분\n` +
      `💾 **메모리 사용:** ${memUsage}MB\n` +
      `📦 **로드된 모듈:** ${
        this.moduleManager?.moduleInstances?.size || 0
      }개\n` +
      `🌐 **환경:** ${process.env.NODE_ENV || "development"}\n` +
      `☁️ **플랫폼:** ${
        process.env.RAILWAY_ENVIRONMENT ? "Railway" : "로컬"
      }\n\n` +
      `✅ 모든 시스템이 정상 작동 중입니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "🔙 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    await this.bot.editMessageText(statusText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("✅ 시스템 상태 표시 완료");
  }

  // ❓ 도움말 표시 (새로 추가!)
  async showHelp(chatId, messageId) {
    const helpText =
      `❓ **두목봇 도움말**\n\n` +
      `**기본 명령어:**\n` +
      `• \`/start\` - 봇 시작 및 메인 메뉴\n` +
      `• \`/help\` - 도움말 보기\n` +
      `• \`/cancel\` - 현재 작업 취소\n\n` +
      `**주요 기능:**\n` +
      `📝 **할일 관리** - 작업 추가/완료/삭제\n` +
      `🔮 **운세** - 오늘의 운세 확인\n` +
      `🌤️ **날씨** - 실시간 날씨 정보\n` +
      `⏰ **타이머** - 시간 관리 도구\n` +
      `📅 **휴가 관리** - 연차 사용 관리\n` +
      `🛠️ **유틸리티** - 편의 기능들\n\n` +
      `💡 **팁:** 메뉴 버튼을 사용하면 쉽게 기능에 접근할 수 있습니다!`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main:menu" }]],
    };

    await this.bot.editMessageText(helpText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("✅ 도움말 표시 완료");
  }
  // 🔔 콜백 응답 (안전하게 처리)
  async answerCallback(callbackId, options = {}) {
    try {
      await this.bot.answerCallbackQuery(callbackId, options);
    } catch (error) {
      // 이미 응답된 경우 무시
      if (
        error.message?.includes("query is too old") ||
        error.message?.includes("QUERY_ID_INVALID")
      ) {
        logger.debug("콜백 이미 응답됨");
      } else {
        logger.error("콜백 응답 실패:", error.message);
      }
    }
  }

  // 💬 메시지 처리
  async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;

    const chatId = msg.chat.id;
    const userName = UserHelper.getUserName(msg.from);

    logger.debug(`💬 메시지: "${text}" (${userName})`);

    // /start 명령어 특별 처리
    if (text === "/start") {
      const welcomeText =
        "🤖 **두목봇에 오신걸 환영합니다!**\n\n" +
        `안녕하세요 ${userName}님! 무엇을 도와드릴까요?\n\n` +
        "아래 메뉴에서 원하는 기능을 선택해주세요:";

      try {
        await this.bot.sendMessage(chatId, welcomeText, {
          parse_mode: "Markdown",
          reply_markup: this.moduleManager?.createMainMenuKeyboard() || {
            inline_keyboard: [
              [{ text: "🔄 재시작", callback_data: "restart" }],
            ],
          },
        });
      } catch (error) {
        logger.error("/start 처리 오류:", error);
        await this.sendErrorMessage(chatId);
      }
      return;
    }

    // 다른 메시지는 ModuleManager로
    try {
      const handled = await this.moduleManager.handleMessage(this.bot, msg);
      if (!handled) {
        logger.debug(`처리되지 않은 메시지: ${text}`);
      }
    } catch (error) {
      logger.error("ModuleManager 메시지 처리 오류:", error);
      await this.sendErrorMessage(chatId);
    }
  }

  // ❌ 에러 메시지 전송
  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // 📊 상태 조회
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasDatabase: !!this.dbManager,
      hasModuleManager: !!this.moduleManager,
      activeMessages: this.processingMessages.size,
      activeCallbacks: this.processingCallbacks.size,
      moduleStatus: this.moduleManager?.getStatus() || null,
    };
  }

  // 🧹 정리
  async cleanup() {
    logger.info("🧹 BotController 정리 시작...");

    try {
      // 이벤트 리스너 제거
      this.bot.removeAllListeners();

      // 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 데이터베이스 연결 해제
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      // 상태 초기화
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.userStates.clear();
      this.isInitialized = false;

      logger.success("✅ BotController 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 중 오류:", error);
    }
  }
}

module.exports = BotController;
