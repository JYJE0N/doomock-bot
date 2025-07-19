// src/modules/BaseModule.js - 완전 표준화된 모듈 시스템

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
      features: [], // 지원하는 기능 목록
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

    // ✅ 표준 액션 매핑
    this.actionMap = new Map();
    this.initializeActionMap();

    Logger.module(this.name, "created", { config: this.config });
  }

  // ✅ 표준 액션 매핑 초기화
  initializeActionMap() {
    // 기본 액션들
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));
    this.actionMap.set("status", this.showStatus.bind(this));

    // 서브클래스에서 추가 액션 등록
    this.registerActions();
  }

  // ✅ 서브클래스에서 액션 등록 (오버라이드)
  registerActions() {
    // 서브클래스에서 구현
    // 예: this.actionMap.set('list', this.showList.bind(this));
  }

  // ✅ 통합 콜백 처리기 (CallbackManager가 이것만 호출하면 됨)
  async handleCallback(bot, callbackQuery, subAction, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      this.updateStats("callback");

      // 액션 맵에서 핸들러 찾기
      const handler = this.actionMap.get(subAction);

      if (handler) {
        Logger.info(`🔧 ${this.name}: ${subAction} 액션 실행`);
        await handler(bot, chatId, messageId, userId, userName, params);
        return true;
      } else {
        // 등록되지 않은 액션 처리
        await this.handleUnregisteredAction(bot, chatId, messageId, subAction);
        return false;
      }
    } catch (error) {
      Logger.error(`${this.name} 콜백 처리 오류 (${subAction}):`, error);
      await this.handleError(bot, chatId, error);
      return false;
    }
  }

  // ✅ 필수 구현: 메뉴 표시
  async showMenu(bot, chatId, messageId, userId, userName) {
    const menuData = this.getMenuData(userName);

    await this.editMessage(bot, chatId, messageId, menuData.text, {
      parse_mode: "Markdown",
      reply_markup: menuData.keyboard,
    });
  }

  // ✅ 메뉴 데이터 제공 (서브클래스에서 오버라이드)
  getMenuData(userName) {
    const displayName = this.getDisplayName();

    return {
      text: `${displayName} **준비 중입니다** 🚧\n\n곧 업데이트될 예정이니 조금만 기다려주세요!`,
      keyboard: {
        inline_keyboard: [
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ✅ 모듈 표시 이름 가져오기
  getDisplayName() {
    const displayNames = {
      todo: "📝 할일 관리",
      fortune: "🔮 운세",
      timer: "⏰ 타이머",
      weather: "🌤️ 날씨",
      insight: "📊 인사이트",
      utils: "🛠️ 유틸리티",
      reminder: "🔔 리마인더",
      worktime: "🕐 근무시간",
      leave: "📅 휴가 관리",
    };

    return displayNames[this.moduleName] || this.name;
  }

  // ✅ 기본 도움말 표시
  async showHelp(bot, chatId, messageId) {
    const helpText = this.getHelpMessage();

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    });
  }

  // ✅ 기본 상태 표시
  async showStatus(bot, chatId, messageId) {
    const statusText =
      `📊 **${this.getDisplayName()} 상태**\n\n` +
      `🔧 모듈명: ${this.name}\n` +
      `⚡ 상태: ${this.isInitialized ? "활성" : "비활성"}\n` +
      `📈 사용 통계: ${this.stats.callbackCount}회`;

    await this.editMessage(bot, chatId, messageId, statusText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` }],
        ],
      },
    });
  }

  // ✅ 등록되지 않은 액션 처리
  async handleUnregisteredAction(bot, chatId, messageId, action) {
    const text =
      `❌ **알 수 없는 액션**: ${action}\n\n` +
      `${this.getDisplayName()}에서 처리할 수 없는 요청입니다.`;

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` }],
        ],
      },
    });
  }

  // ✅ 에러 처리
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ **오류 발생**\n\n처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

    await this.sendMessage(bot, chatId, errorText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    });
  }

  // ✅ 도움말 메시지 (서브클래스에서 오버라이드)
  getHelpMessage() {
    return `❓ **${this.getDisplayName()} 도움말**\n\n이 모듈의 도움말이 준비 중입니다.`;
  }

  // ✅ 기본 메시지 처리
  async handleMessage(bot, msg) {
    // 기본적으로 메시지를 처리하지 않음
    return false;
  }

  // ✅ 유틸리티 메서드들
  updateStats(type) {
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
    this.stats.lastUsed = new Date();
  }

  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error(`메시지 전송 실패 [${this.name}]:`, error);
    }
  }

  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      // 메시지 수정 실패 시 새 메시지 전송
      Logger.warn(
        `메시지 수정 실패, 새 메시지 전송 [${this.name}]:`,
        error.message,
      );
      return await this.sendMessage(bot, chatId, text, options);
    }
  }

  // ✅ 모듈 정보
  getModuleInfo() {
    return {
      name: this.name,
      moduleName: this.moduleName,
      displayName: this.getDisplayName(),
      isInitialized: this.isInitialized,
      isLoaded: this.isLoaded,
      stats: this.stats,
      availableActions: Array.from(this.actionMap.keys()),
    };
  }

  toString() {
    return `[Module: ${this.name}]`;
  }
}

module.exports = BaseModule;
