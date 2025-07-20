// ===== 1. BaseModule.js - 단순하고 안전한 기본 구조 =====

// src/modules/BaseModule.js
// ✅ 새로운 해결책 (logger를 함수로 가져오기)
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.replace("Module", "").toLowerCase();
    this.config = {
      enabled: true,
      priority: 100,
      required: false,
      ...config,
    };

    // ✅ 핵심: 즉시 초기화
    this.actionMap = new Map();
    this.isInitialized = false;
    this.startTime = new Date();

    // 통계 및 상태
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
      uniqueUsers: new Set(),
    };

    this.userStates = new Map();

    logger.debug(`📦 ${this.name} 생성됨`);
  }

  // 🔧 초기화
  async initialize() {
    if (this.isInitialized) {
      logger.debug(`${this.name} 이미 초기화됨, 스킵`);
      return;
    }

    try {
      logger.info(`🔧 ${this.name} 초기화 중...`);

      // 1. 모듈별 초기화 (하위 클래스)
      if (typeof this.onInitialize === "function") {
        await this.onInitialize();
      }

      // 2. 액션 등록
      this.registerActions();

      this.isInitialized = true;
      logger.success(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🎯 기본 액션 등록
  registerActions() {
    // 기본 액션들
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));

    logger.debug(`🎯 ${this.name} 기본 액션 등록 완료`);
  }

  // ✅ 메시지 처리
  async handleMessage(bot, msg) {
    this.stats.commandCount++;
    this.stats.lastUsed = new Date();
    this.stats.uniqueUsers.add(msg.from.id);

    // 하위 클래스에서 구현
    return await this.onHandleMessage(bot, msg);
  }

  // ✅ 콜백 처리
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    this.stats.callbackCount++;
    this.stats.lastUsed = new Date();
    this.stats.uniqueUsers.add(callbackQuery.from.id);

    try {
      // actionMap에서 찾기
      if (this.actionMap.has(subAction)) {
        const actionHandler = this.actionMap.get(subAction);
        const {
          message: {
            chat: { id: chatId },
            message_id: messageId,
          },
          from: { id: userId },
        } = callbackQuery;
        const userName = getUserName(callbackQuery.from);

        await actionHandler(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      }

      // 하위 클래스 처리
      return await this.onHandleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.name} 콜백 처리 오류:`, error);
      return false;
    }
  }

  // =============== 하위 클래스에서 구현할 메서드들 ===============

  async onInitialize() {
    // 하위 클래스에서 구현
  }

  async onHandleMessage(bot, msg) {
    // 하위 클래스에서 구현
    return false;
  }

  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 하위 클래스에서 구현
    return false;
  }

  // =============== 기본 UI 메서드들 ===============

  async showMenu(bot, chatId, messageId, userId, userName) {
    const menuData = this.getMenuData(userName);
    await this.editOrSendMessage(bot, chatId, messageId, menuData.text, {
      parse_mode: "Markdown",
      reply_markup: menuData.keyboard,
    });
  }

  async showHelp(bot, chatId, messageId, userId, userName) {
    const helpText = `❓ **${this.name} 도움말**\n\n기본 도움말입니다.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` }],
        [{ text: "🏠 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  getMenuData(userName) {
    return {
      text: `📦 **${userName}님의 ${this.name}**\n\n기본 메뉴입니다.`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "❓ 도움말", callback_data: `${this.moduleName}_help` },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    };
  }

  async editOrSendMessage(bot, chatId, messageId, text, options = {}) {
    try {
      if (messageId) {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        await bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      logger.error(`${this.name} 메시지 전송 실패:`, error);
      // 폴백: 새 메시지 전송
      if (messageId) {
        try {
          await bot.sendMessage(chatId, text, options);
        } catch (fallbackError) {
          logger.error(`${this.name} 폴백 메시지도 실패:`, fallbackError);
        }
      }
    }
  }

  // 정리 작업
  async cleanup() {
    try {
      this.userStates.clear();
      this.actionMap.clear();
      this.isInitialized = false;
      logger.success(`✅ ${this.name} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.name} 정리 실패:`, error);
    }
  }
}

module.exports = BaseModule;
