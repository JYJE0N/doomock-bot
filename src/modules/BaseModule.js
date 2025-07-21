// src/modules/BaseModule.js - 표준화된 베이스 모듈

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.commands = options.commands || [];
    this.callbacks = options.callbacks || [];
    this.features = options.features || [];

    // 필수 의존성
    this.bot = null;
    this.db = null;
    this.moduleManager = null;

    // 상태 관리
    this.isInitialized = false;
    this.userStates = new Map();

    // 통계
    this.stats = {
      messageCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastActivity: null,
    };

    // ⭐ 기본 액션 등록
    this.registerDefaultActions();

    // 액션맵 (콜백 처리를 위한 표준 방식)
    this.actionMap = new Map();
    this.registerActions();

    logger.info(`📦 ${moduleName} 모듈 생성됨`);
  }

  // 🎯 표준 초기화
  async initialize(bot, dependencies = {}) {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      // 의존성 주입
      this.bot = bot || dependencies.bot;
      this.db = dependencies.dbManager || dependencies.db;
      this.moduleManager = dependencies.moduleManager;

      // 모듈별 초기화
      await this.onInitialize();

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  // ⭐ 기본 액션을 자동으로 등록
  registerDefaultActions() {
    // 모든 모듈에서 공통으로 사용하는 기본 액션들
    if (this.showMenu) {
      this.actionMap.set("menu", this.showMenu.bind(this));
    }
    if (this.goBack) {
      this.actionMap.set("back", this.goBack.bind(this));
    }
    if (this.showHelp) {
      this.actionMap.set("help", this.showHelp.bind(this));
    }
  }

  // 🎯 표준 메시지 핸들러
  async handleMessage(bot, msg) {
    if (!msg.text) return false;

    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    try {
      // 통계 업데이트
      this.stats.messageCount++;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      // 명령어 체크
      const command = this.extractCommand(text);
      if (command && this.commands.includes(command)) {
        logger.debug(`📬 ${this.moduleName}가 명령어 처리: ${command}`);
        return await this.onHandleMessage(bot, msg);
      }

      // 사용자 상태 체크
      const userState = this.userStates.get(userId);
      if (userState) {
        return await this.onHandleMessage(bot, msg);
      }

      return false;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      await this.sendError(bot, chatId, "처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // 🎯 표준 콜백 핸들러
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 통계 업데이트
      this.stats.callbackCount++;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      // 1. 액션맵에서 먼저 찾기
      const action = this.actionMap.get(subAction);
      if (action) {
        logger.debug(`🎯 ${this.moduleName} 액션 실행: ${subAction}`);
        return await action(bot, callbackQuery, params, moduleManager);
      }

      // 2. 동적 핸들러 확인 (하위 클래스에서 오버라이드 가능)
      if (this.handleDynamicCallback) {
        const handled = await this.handleDynamicCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
        if (handled) return true;
      }

      // 3. 기본 액션 처리 (레거시 호환성)
      switch (subAction) {
        case "menu":
          if (this.showMenu) {
            return await this.showMenu(bot, chatId, messageId, userId);
          }
          break;
        case "back":
          if (this.goBack) {
            return await this.goBack(bot, callbackQuery);
          }
          break;
        case "help":
          if (this.showHelp) {
            return await this.showHelp(bot, chatId, messageId);
          }
          break;
        default:
          logger.warn(
            `⚠️ ${this.moduleName}: 처리되지 않은 액션 - ${subAction}`
          );
          return false;
      }
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      await this.sendError(bot, chatId, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  // ⭐ 동적 콜백을 처리하기 위한 훅 (하위 클래스에서 오버라이드)
  async handleDynamicCallback(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // 하위 클래스에서 구현
    return false;
  }
  // 🔧 하위 클래스에서 구현해야 할 메서드들
  async onInitialize() {
    // 하위 클래스에서 구현
  }

  async onHandleMessage(bot, msg) {
    // 하위 클래스에서 구현
    return false;
  }

  registerActions(actions) {
    for (const [actionName, handler] of Object.entries(actions)) {
      if (typeof handler === "function") {
        this.actionMap.set(actionName, handler.bind(this));
        logger.debug(`📝 ${this.moduleName}: 액션 등록 - ${actionName}`);
      }
    }
  }

  async showMenu(bot, chatId, messageId, userId) {
    // 기본 메뉴 표시 (하위 클래스에서 오버라이드)
    const menuText = `📋 **${this.moduleName} 메뉴**`;
    const keyboard = this.createMenuKeyboard();

    await bot.editMessageText(menuText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    return true;
  }

  // 🏠 메인 메뉴로 돌아가기
  async goBack(bot, callbackQuery) {
    if (!this.moduleManager) {
      logger.error(`❌ ${this.moduleName}: ModuleManager 참조 없음`);
      return false;
    }

    return await this.moduleManager.handleMainMenu(callbackQuery);
  }

  // 🛠️ 유틸리티 메서드
  extractCommand(text) {
    if (!text.startsWith("/")) return null;
    return text.split(" ")[0].substring(1);
  }

  createMenuKeyboard() {
    // 기본 키보드 레이아웃
    return {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main_menu" }]],
    };
  }

  async sendMessage(bot, chatId, text, options = {}) {
    return await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      ...options,
    });
  }

  async editMessage(bot, chatId, messageId, text, options = {}) {
    return await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      ...options,
    });
  }

  async sendError(bot, chatId, message) {
    return await this.sendMessage(bot, chatId, `❌ ${message}`);
  }

  // 🧹 정리
  async cleanup() {
    this.userStates.clear();
    this.actionMap.clear();
    this.isInitialized = false;
    logger.info(`🧹 ${this.moduleName} 정리 완료`);
  }

  // 📊 상태 조회
  getStatus() {
    return {
      name: this.moduleName,
      initialized: this.isInitialized,
      commands: this.commands,
      callbacks: this.callbacks,
      features: this.features,
      stats: this.stats,
      activeUsers: this.userStates.size,
    };
  }
}

module.exports = BaseModule;
