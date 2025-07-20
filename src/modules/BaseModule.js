// ===== 1. BaseModule.js - 완전히 새로운 아키텍처 =====

// src/modules/BaseModule.js
const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { mongoPoolManager } = require("../database/MongoPoolManager");
const ErrorHandler = require("../utils/ErrorHandler");

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

    // ✅ 핵심: actionMap 즉시 초기화
    this.actionMap = new Map();

    // 기본 상태
    this.isInitialized = false;
    this.startTime = new Date();

    // 통계 및 상태 관리
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
      uniqueUsers: new Set(),
    };

    this.userStates = new Map();

    // 데이터베이스 및 에러 핸들러
    this.db = mongoPoolManager;
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1000,
    });

    Logger.debug(`📦 ${this.name} 생성됨 (actionMap 초기화됨)`);
  }

  // 🔧 표준 초기화 프로세스
  async initialize() {
    if (this.isInitialized) {
      Logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      Logger.info(`🔧 ${this.name} 초기화 중...`);

      // 1. 데이터베이스 연결 (선택적)
      await this.ensureDatabaseConnection();

      // 2. 모듈별 초기화 (하위 클래스에서 구현)
      if (typeof this.onInitialize === "function") {
        await this.onInitialize();
      }

      // 3. 액션 등록
      this.registerActions();

      this.isInitialized = true;
      Logger.success(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      this.stats.errorCount++;
      Logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🎯 기본 액션 등록 (하위 클래스에서 확장)
  registerActions() {
    // 모든 모듈의 공통 액션들
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));

    Logger.debug(`🎯 ${this.name} 기본 액션 등록 완료`);
  }

  // 🗄️ 데이터베이스 연결 확인
  async ensureDatabaseConnection() {
    try {
      if (
        this.db &&
        typeof this.db.isConnected === "function" &&
        !this.db.isConnected()
      ) {
        await this.db.connect();
        Logger.debug(`🗄️ ${this.name} DB 연결 완료`);
      }
    } catch (error) {
      Logger.warn(`⚠️ ${this.name} DB 연결 실패:`, error.message);
      // DB 연결 실패는 치명적이지 않음
    }
  }

  // ✅ 표준 메시지 처리
  async handleMessage(bot, msg) {
    this.updateStats("message", msg.from.id);

    try {
      // 하위 클래스에서 오버라이드
      return await this.onHandleMessage(bot, msg);
    } catch (error) {
      await this.handleError(error, "message_processing", msg.from.id);
      return false;
    }
  }

  // ✅ 표준 콜백 처리
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    this.updateStats("callback", callbackQuery.from.id);

    try {
      // 1. actionMap에서 액션 찾기
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

      // 2. 하위 클래스의 추가 처리
      return await this.onHandleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );
    } catch (error) {
      await this.handleError(
        error,
        "callback_processing",
        callbackQuery.from.id
      );
      return false;
    }
  }

  // 📊 통계 업데이트
  updateStats(type, userId) {
    if (type === "message") this.stats.commandCount++;
    if (type === "callback") this.stats.callbackCount++;

    this.stats.lastUsed = new Date();
    this.stats.uniqueUsers.add(userId);
  }

  // 🛡️ 에러 처리
  async handleError(error, type, userId) {
    this.stats.errorCount++;
    Logger.error(`❌ ${this.name} ${type} 오류:`, error);

    if (this.errorHandler) {
      await this.errorHandler.handleError(error, {
        type,
        module: this.name,
        userId,
      });
    }
  }

  // =============== 하위 클래스에서 구현할 메서드들 ===============

  // 모듈별 초기화 로직
  async onInitialize() {
    // 하위 클래스에서 구현
  }

  // 메시지 처리 로직
  async onHandleMessage(bot, msg) {
    // 하위 클래스에서 구현
    return false;
  }

  // 콜백 처리 로직 (actionMap으로 처리되지 않은 것들)
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 하위 클래스에서 구현
    return false;
  }

  // =============== 기본 UI 메서드들 ===============

  // 기본 메뉴 표시
  async showMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const menuData = this.getMenuData(userName);
    await this.editOrSendMessage(bot, chatId, messageId, menuData.text, {
      parse_mode: "Markdown",
      reply_markup: menuData.keyboard,
    });
  }

  // 기본 도움말 표시
  async showHelp(bot, chatId, messageId, userId, userName) {
    const helpText = `❓ **${this.name} 도움말**\n\n기본 도움말 내용입니다.`;
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

  // 메뉴 데이터 제공 (하위 클래스에서 오버라이드)
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

  // 메시지 전송/편집 유틸리티
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
      Logger.error(`${this.name} 메시지 전송 실패:`, error);
      // 폴백: 새 메시지 전송
      if (messageId) {
        await bot.sendMessage(chatId, text, options);
      }
    }
  }

  // =============== 생명주기 관리 ===============

  // 통계 반환
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime.getTime(),
      isInitialized: this.isInitialized,
      actionCount: this.actionMap.size,
    };
  }

  // 정리 작업
  async cleanup() {
    try {
      Logger.info(`🧹 ${this.name} 정리 작업 시작`);

      this.userStates.clear();
      this.actionMap.clear();
      this.isInitialized = false;

      Logger.success(`✅ ${this.name} 정리 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name} 정리 실패:`, error);
    }
  }
}

module.exports = BaseModule;

// ===== 2. SystemModule.js - 새로운 구조에 맞춘 구현 =====

// src/modules/SystemModule.js
const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const Logger = require("../utils/Logger");

class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      commands: ["start", "help", "status", "cancel"],
      callbacks: ["system", "main", "help", "settings", "module"],
      features: ["menu", "help", "settings", "status"],
      priority: 0, // 최우선
      required: true, // 필수 모듈
    });

    this.bot = bot;
    this.moduleManager = options.moduleManager;

    Logger.info("🏠 SystemModule 생성됨");
  }

  // ✅ SystemModule 전용 초기화
  async onInitialize() {
    // SystemModule만의 초기화 로직
    Logger.debug("🏠 SystemModule 전용 초기화 완료");
  }

  // ✅ SystemModule 액션 등록
  registerActions() {
    // 부모의 기본 액션들 먼저 등록
    super.registerActions();

    // SystemModule 전용 액션들 추가
    this.actionMap.set("main", this.showMainMenu.bind(this));
    this.actionMap.set("settings", this.showSettingsMenu.bind(this));
    this.actionMap.set("module", this.showModuleList.bind(this));
    this.actionMap.set("status", this.showBotStatus.bind(this));
    this.actionMap.set("cancel", this.handleCancel.bind(this));

    Logger.debug("🎯 SystemModule 액션 등록 완료");
  }

  // ✅ 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    switch (text.toLowerCase()) {
      case "/start":
        await this.showMainMenu(bot, chatId, null, userId, userName);
        return true;
      case "/help":
        await this.showHelp(bot, chatId, null, userId, userName);
        return true;
      case "/status":
        await this.showBotStatus(bot, chatId, null, userId, userName);
        return true;
      case "/cancel":
        await this.handleCancel(bot, chatId, null, userId, userName);
        return true;
      default:
        return false;
    }
  }

  // =============== SystemModule 전용 메서드들 ===============

  async showMainMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const greeting = this.getGreeting();
    const menuText = `🏠 **${userName}님의 메인 메뉴**\n\n${greeting} 👋\n\n원하는 기능을 선택해주세요:`;

    const availableModules = await this.getAvailableModules();
    const keyboard = {
      inline_keyboard: [
        ...this.createModuleButtons(availableModules.slice(0, 6)),
        [
          { text: "⚙️ 설정", callback_data: "system_settings" },
          { text: "❓ 도움말", callback_data: "system_help" },
        ],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showSettingsMenu(bot, chatId, messageId, userId, userName) {
    const settingsText = `⚙️ **시스템 설정**\n\n${userName}님의 설정을 관리하세요.`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 상태 확인", callback_data: "system_status" },
          { text: "📦 모듈 목록", callback_data: "system_module" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system_main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, settingsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showBotStatus(bot, chatId, messageId, userId, userName) {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const statusText = `📊 **봇 상태 정보**\n\n⏱️ 가동시간: ${uptime}초\n📦 로드된 모듈: ${
      this.moduleManager ? this.moduleManager.modules.size : 0
    }개\n👥 활성 사용자: ${this.stats.uniqueUsers.size}명`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system_main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, statusText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showModuleList(bot, chatId, messageId, userId, userName) {
    const moduleText = `📦 **로드된 모듈 목록**\n\n`;
    // 모듈 목록 구현...

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 설정 메뉴", callback_data: "system_settings" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, moduleText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async handleCancel(bot, chatId, messageId, userId, userName) {
    if (this.moduleManager && this.moduleManager.userStates) {
      this.moduleManager.userStates.delete(userId);
    }

    const cancelText = `✅ **작업이 취소되었습니다**\n\n${userName}님, 진행 중이던 작업을 취소했습니다.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system_main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, cancelText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // =============== 헬퍼 메서드들 ===============

  async getAvailableModules() {
    if (!this.moduleManager) return [];

    const modules = [];
    for (const [name, moduleData] of this.moduleManager.modules.entries()) {
      if (moduleData.isInitialized && name !== "SystemModule") {
        modules.push({
          name: name.replace("Module", ""),
          emoji: this.getModuleEmoji(name),
          callback_data: `${name.toLowerCase().replace("module", "")}_menu`,
        });
      }
    }
    return modules;
  }

  createModuleButtons(modules) {
    const buttons = [];
    for (let i = 0; i < modules.length; i += 2) {
      const row = modules.slice(i, i + 2).map((module) => ({
        text: `${module.emoji} ${module.name}`,
        callback_data: module.callback_data,
      }));
      buttons.push(row);
    }
    return buttons;
  }

  getModuleEmoji(moduleName) {
    const emojiMap = {
      TodoModule: "📝",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TimerModule: "⏰",
      LeaveModule: "📅",
      WorktimeModule: "🕐",
      UtilsModule: "🛠️",
      ReminderModule: "🔔",
      InsightModule: "📊",
    };
    return emojiMap[moduleName] || "📦";
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "좋은 아침이에요";
    if (hour >= 12 && hour < 18) return "좋은 오후에요";
    if (hour >= 18 && hour < 22) return "좋은 저녁이에요";
    return "늦은 시간이네요";
  }
}

module.exports = SystemModule;
