// src/modules/BaseModule.js - 완전 표준화된 베이스 모듈

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.replace("Module", "").toLowerCase(); // 'todo', 'fortune' 등
    this.config = {
      enabled: true,
      priority: 100,
      dependencies: [],
      commands: [],
      callbacks: [],
      features: [],
      ...config,
    };

    this.isInitialized = false;
    this.isLoaded = false;
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
    };

    // ⭐ 사용자 상태 관리 (모든 모듈 표준)
    this.userStates = new Map();

    // ⭐ 중복 처리 방지 (모든 모듈 표준)
    this.processingUsers = new Set();

    Logger.debug(`📦 ${this.name} 모듈 생성됨`);
  }

  // ⭐ 표준 초기화 메서드
  async initialize() {
    if (this.isInitialized) {
      Logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      Logger.info(`🔧 ${this.name} 초기화 중...`);

      // 서브클래스별 초기화 로직
      await this.onInitialize();

      this.isInitialized = true;
      Logger.success(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // ⭐ 서브클래스에서 오버라이드할 초기화 메서드
  async onInitialize() {
    // 서브클래스에서 구현
  }

  // ⭐ 표준 메시지 처리 인터페이스
  async handleMessage(bot, msg) {
    // 서브클래스에서 반드시 구현
    return false;
  }

  // ⭐ 표준화된 콜백 처리 인터페이스 (매개변수 통일)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    // 통계 업데이트
    this.updateStats("callback");

    // 중복 처리 방지
    const userKey = `${userId}_${subAction}`;
    if (this.processingUsers.has(userKey)) {
      Logger.warn(`${this.name}: 중복 처리 무시 ${userKey}`);
      return false;
    }

    this.processingUsers.add(userKey);

    try {
      Logger.debug(`${this.name}: 콜백 처리 ${subAction}`, { userId });

      // 동적 콜백 처리 (toggle_0, delete_1 등)
      if (
        await this.handleDynamicCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          menuManager
        )
      ) {
        return true;
      }

      // 표준 액션 처리
      const result = await this.processStandardAction(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );

      if (result !== null) {
        return result;
      }

      // 서브클래스별 추가 처리
      return await this.onHandleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );
    } catch (error) {
      this.updateStats("error");
      Logger.error(`${this.name}: 콜백 처리 오류 (${subAction}):`, error);

      await this.sendErrorMessage(
        bot,
        chatId,
        `${this.name} 처리 중 오류가 발생했습니다.`
      );
      return false;
    } finally {
      // 처리 완료 후 플래그 해제
      setTimeout(() => {
        this.processingUsers.delete(userKey);
      }, 2000);
    }
  }

  // ⭐ 서브클래스에서 구현할 콜백 처리
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    Logger.warn(`${this.name}: 처리되지 않은 액션 ${subAction}`);
    return false;
  }

  // ⭐ 표준 액션 처리
  async processStandardAction(
    bot,
    callbackQuery,
    subAction,
    params,
    menuManager
  ) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    switch (subAction) {
      case "menu":
        await this.showMenu(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      case "help":
        await this.showHelp(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      case "back":
      case "cancel":
        await this.handleBack(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      default:
        return null; // 처리하지 않음
    }
  }

  // ⭐ 동적 콜백 처리 (toggle_0, delete_1 등)
  async handleDynamicCallback(
    bot,
    callbackQuery,
    subAction,
    params,
    menuManager
  ) {
    // 서브클래스에서 필요시 오버라이드
    return false;
  }

  // ⭐ 표준 메뉴 표시 (서브클래스에서 구현)
  async showMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const menuText = `${this.getDisplayName()}\n\n🔧 준비 중입니다...`;

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    });
  }

  // ⭐ 표준 도움말 표시
  async showHelp(bot, chatId, messageId, userId, userName, menuManager) {
    const helpText =
      `❓ **${this.getDisplayName()} 도움말**\n\n` +
      `${this.config.description || "도움말을 준비 중입니다."}\n\n` +
      `**지원 명령어:**\n${
        this.config.commands.map((cmd) => `/${cmd}`).join(", ") || "없음"
      }`;

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` },
            { text: "🏠 메인", callback_data: "main_menu" },
          ],
        ],
      },
    });
  }

  // ⭐ 표준 뒤로가기 처리
  async handleBack(bot, chatId, messageId, userId, userName, menuManager) {
    await menuManager.editMessage(
      bot,
      chatId,
      messageId,
      `🔙 **메인 메뉴**\n\n원하는 기능을 선택해주세요:`,
      {
        parse_mode: "Markdown",
        reply_markup: menuManager.createMainMenuKeyboard(),
      }
    );
  }

  // ⭐ 표준 헬퍼 메서드들
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      Logger.error(`${this.name}: 메시지 수정 실패:`, error.message);
      try {
        await bot.sendMessage(chatId, text, options);
      } catch (sendError) {
        Logger.error(`${this.name}: 메시지 전송도 실패:`, sendError.message);
      }
    }
  }

  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error(`${this.name}: 메시지 전송 실패:`, error.message);
      throw error;
    }
  }

  async sendErrorMessage(bot, chatId, message = null) {
    const errorText = message || `❌ ${this.name} 처리 중 오류가 발생했습니다.`;

    try {
      await bot.sendMessage(chatId, errorText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔄 다시 시도",
                callback_data: `${this.moduleName}_menu`,
              },
              { text: "🏠 메인 메뉴", callback_data: "main_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      Logger.error(`${this.name}: 에러 메시지 전송 실패:`, error.message);
    }
  }

  // ⭐ 표준 유틸리티 메서드들
  getDisplayName() {
    const displayNames = {
      todo: "📝 할일 관리",
      fortune: "🔮 운세",
      weather: "🌤️ 날씨",
      timer: "⏰ 타이머",
      leave: "🏖️ 휴가 관리",
      worktime: "🕐 근무시간",
      insight: "📊 인사이트",
      utils: "🛠️ 유틸리티",
      reminder: "🔔 리마인더",
    };
    return displayNames[this.moduleName] || this.name;
  }

  updateStats(type) {
    this.stats.lastUsed = new Date();
    switch (type) {
      case "command":
        this.stats.commandCount++;
        break;
      case "callback":
        this.stats.callbackCount++;
        break;
      case "error":
        this.stats.errorCount++;
        break;
    }
  }

  getStats() {
    return {
      name: this.name,
      displayName: this.getDisplayName(),
      ...this.stats,
      isInitialized: this.isInitialized,
      activeUsers: this.processingUsers.size,
    };
  }

  // ⭐ 표준 정리 메서드
  cleanup() {
    this.userStates.clear();
    this.processingUsers.clear();
    this.isInitialized = false;
    Logger.info(`🧹 ${this.name} 정리 완료`);
  }

  // ⭐ 명령어 처리 가능 여부 확인
  canHandleCommand(command) {
    return this.config.commands.includes(command);
  }

  // ⭐ 콜백 처리 가능 여부 확인
  canHandleCallback(callbackData) {
    const prefix = callbackData.split("_")[0];
    return this.config.callbacks.includes(prefix);
  }
}

module.exports = BaseModule;
