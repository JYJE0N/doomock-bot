// ===== 1. BaseModule.js - 단순하고 안전한 기본 구조 =====

// src/modules/BaseModule.js
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

// ===== 2. ModuleManager.js - 안전한 모듈 로딩 =====

// src/managers/ModuleManager.js
const logger = require("../utils/Logger");
const path = require("path");
const fs = require("fs");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.options = options;

    // 핵심 상태
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 통계
    this.globalStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      successfulMessages: 0,
      successfulCallbacks: 0,
      moduleErrors: new Map(),
      uniqueUsers: new Set(),
    };

    logger.info("🔧 ModuleManager 생성됨");
  }

  // =============== 초기화 ===============

  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 모듈 로드 및 초기화
      await this._loadModulesSafely();
      await this._initializeModules();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // ✅ 안전한 모듈 로딩
  async _loadModulesSafely() {
    logger.info("📦 안전한 모듈 로드 시작...");

    // ✅ 하드코딩된 모듈 설정 (ModuleConfig 의존성 제거)
    const moduleConfigs = {
      SystemModule: {
        enabled: true,
        priority: 0,
        required: true,
        path: "../modules/SystemModule",
      },
      TodoModule: {
        enabled: true,
        priority: 1,
        required: false,
        path: "../modules/TodoModule",
      },
      FortuneModule: {
        enabled: true,
        priority: 2,
        required: false,
        path: "../modules/FortuneModule",
      },
      WeatherModule: {
        enabled: true,
        priority: 3,
        required: false,
        path: "../modules/WeatherModule",
      },
      UtilsModule: {
        enabled: true,
        priority: 8,
        required: false,
        path: "../modules/UtilsModule",
      },
    };

    let loadedCount = 0;
    let failedCount = 0;

    for (const [moduleName, config] of Object.entries(moduleConfigs)) {
      try {
        if (!config.enabled) {
          logger.debug(`⏭️ ${moduleName} 비활성화됨, 건너뛰기`);
          continue;
        }

        // ✅ 안전한 모듈 로딩
        const success = await this._loadSingleModule(moduleName, config);
        if (success) {
          loadedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        logger.error(`❌ ${moduleName} 로드 중 예외:`, error.message);
      }
    }

    logger.success(
      `📦 모듈 로드 완료: ${loadedCount}개 성공, ${failedCount}개 실패`
    );

    // 로드된 모듈이 없으면 폴백 모듈 생성
    if (loadedCount === 0) {
      await this._createFallbackModule();
    }
  }

  // ✅ 개별 모듈 안전 로딩
  async _loadSingleModule(moduleName, config) {
    try {
      const modulePath = path.resolve(__dirname, config.path);

      // 파일 존재 확인
      if (!fs.existsSync(modulePath + ".js")) {
        logger.warn(`⚠️ ${moduleName} 파일이 존재하지 않음: ${modulePath}.js`);
        return false;
      }

      // ✅ require 캐시 정리 (중복 선언 방지)
      const fullPath = require.resolve(modulePath);
      if (require.cache[fullPath]) {
        delete require.cache[fullPath];
        logger.debug(`🗑️ ${moduleName} 캐시 정리됨`);
      }

      // 모듈 로드
      const ModuleClass = require(modulePath);

      if (typeof ModuleClass !== "function") {
        throw new Error(`${moduleName}은 유효한 클래스가 아닙니다`);
      }

      // 모듈 등록
      this.modules.set(moduleName, {
        name: moduleName,
        config: config,
        class: ModuleClass,
        instance: null,
        isLoaded: true,
        isInitialized: false,
        loadTime: new Date(),
      });

      logger.debug(`✅ ${moduleName} 로드 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleName} 로드 실패:`, error.message);

      if (config.required) {
        throw new Error(`필수 모듈 ${moduleName} 로드 실패: ${error.message}`);
      }

      return false;
    }
  }

  // ✅ 폴백 모듈 생성
  async _createFallbackModule() {
    logger.info("🆘 폴백 SystemModule 생성...");

    try {
      const FallbackSystemModule = class SystemModule {
        constructor(bot, options = {}) {
          this.name = "SystemModule";
          this.bot = bot;
          this.moduleManager = options.moduleManager;
          this.actionMap = new Map();
          this.isInitialized = false;
        }

        async initialize() {
          this.isInitialized = true;
          logger.info("✅ 폴백 SystemModule 초기화 완료");
        }

        async handleMessage() {
          return false;
        }

        async handleCallback() {
          return false;
        }
      };

      this.modules.set("SystemModule", {
        name: "SystemModule",
        config: { enabled: true, priority: 0, required: true },
        class: FallbackSystemModule,
        instance: null,
        isLoaded: true,
        isInitialized: false,
        loadTime: new Date(),
      });

      logger.success("✅ 폴백 SystemModule 생성 완료");
    } catch (error) {
      logger.error("❌ 폴백 모듈 생성도 실패:", error);
    }
  }

  // ✅ 모듈 초기화
  async _initializeModules() {
    logger.info("🔧 모듈 초기화 시작...");

    let initializedCount = 0;
    let failedCount = 0;

    // 우선순위별 정렬
    const sortedModules = Array.from(this.modules.entries()).sort(
      ([, a], [, b]) => (a.config.priority || 100) - (b.config.priority || 100)
    );

    for (const [moduleName, moduleData] of sortedModules) {
      try {
        if (!moduleData.isLoaded) {
          logger.debug(`⏭️ ${moduleName} 로드되지 않음, 건너뛰기`);
          continue;
        }

        logger.debug(`🔧 ${moduleName} 초기화 중...`);

        // ✅ 안전한 모듈 인스턴스 생성
        const moduleInstance = new moduleData.class(this.bot, {
          moduleManager: this,
        });

        // 초기화 호출
        if (typeof moduleInstance.initialize === "function") {
          await moduleInstance.initialize();
        }

        // 등록
        moduleData.instance = moduleInstance;
        moduleData.isInitialized = true;
        this.moduleInstances.set(moduleName, moduleInstance);

        initializedCount++;
        logger.success(`✅ ${moduleName} 초기화 완료`);
      } catch (error) {
        failedCount++;
        logger.error(`❌ ${moduleName} 초기화 실패:`, error.message);

        if (moduleData.config.required) {
          throw new Error(
            `필수 모듈 ${moduleName} 초기화 실패: ${error.message}`
          );
        }
      }
    }

    logger.success(
      `🔧 모듈 초기화 완료: ${initializedCount}개 성공, ${failedCount}개 실패`
    );
  }

  // =============== 메시지/콜백 처리 ===============

  async handleMessage(bot, msg) {
    this.globalStats.totalMessages++;
    this.globalStats.uniqueUsers.add(msg.from.id);

    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (!moduleData.isInitialized || !moduleData.instance) continue;

        try {
          const handled = await moduleData.instance.handleMessage?.(bot, msg);
          if (handled) {
            this.globalStats.successfulMessages++;
            logger.debug(`📨 메시지 처리 완료: ${moduleName}`);
            return true;
          }
        } catch (error) {
          logger.error(`❌ ${moduleName} 메시지 처리 오류:`, error);
          this.globalStats.moduleErrors.set(
            moduleName,
            (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
          );
        }
      }

      logger.debug("📨 처리되지 않은 메시지");
      return false;
    } catch (error) {
      logger.error("❌ 메시지 라우팅 오류:", error);
      return false;
    }
  }

  async handleCallback(bot, callbackQuery) {
    this.globalStats.totalCallbacks++;
    this.globalStats.uniqueUsers.add(callbackQuery.from.id);

    try {
      // 콜백 응답
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (answerError) {
        logger.debug("콜백 응답 실패 (무시됨):", answerError.message);
      }

      // 콜백 데이터 파싱
      const routeInfo = this._parseCallbackData(callbackQuery.data);
      if (!routeInfo) {
        logger.debug("콜백 파싱 실패:", callbackQuery.data);
        return false;
      }

      // 모듈로 라우팅
      return await this._routeToModule(bot, callbackQuery, routeInfo);
    } catch (error) {
      logger.error("❌ 콜백 라우팅 오류:", error);
      return false;
    }
  }

  // ✅ 콜백 데이터 파싱
  _parseCallbackData(callbackData) {
    if (!callbackData || typeof callbackData !== "string") {
      return null;
    }

    const separator = callbackData.includes(":") ? ":" : "_";
    const [moduleName, action] = callbackData.split(separator, 2);

    if (!moduleName || !action) {
      return null;
    }

    // 모듈명 매핑
    const moduleNameMapping = {
      system: "SystemModule",
      main: "SystemModule",
      todo: "TodoModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      utils: "UtilsModule",
    };

    const fullModuleName =
      moduleNameMapping[moduleName] ||
      `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module`;

    return {
      moduleName: fullModuleName,
      action: action,
      originalData: callbackData,
    };
  }

  // ✅ 모듈로 라우팅
  async _routeToModule(bot, callbackQuery, routeInfo) {
    const { moduleName, action } = routeInfo;

    if (!this.modules.has(moduleName)) {
      logger.warn(`모듈을 찾을 수 없음: ${moduleName}`);
      return false;
    }

    const moduleData = this.modules.get(moduleName);

    if (!moduleData.isInitialized || !moduleData.instance) {
      logger.warn(`모듈이 초기화되지 않음: ${moduleName}`);
      return false;
    }

    try {
      if (typeof moduleData.instance.handleCallback === "function") {
        const handled = await moduleData.instance.handleCallback(
          bot,
          callbackQuery,
          action,
          {},
          this
        );

        if (handled) {
          this.globalStats.successfulCallbacks++;
          logger.debug(`✅ 콜백 처리 성공: ${moduleName}.${action}`);
          return true;
        }
      }

      logger.debug(`⚠️ 콜백 처리 거부: ${moduleName}.${action}`);
      return false;
    } catch (error) {
      logger.error(`❌ ${moduleName} 콜백 처리 오류:`, error);
      this.globalStats.moduleErrors.set(
        moduleName,
        (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
      );
      return false;
    }
  }

  // =============== 정리 작업 ===============

  async cleanup() {
    logger.info("🧹 ModuleManager 정리 작업 시작");

    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        try {
          if (
            moduleData.instance &&
            typeof moduleData.instance.cleanup === "function"
          ) {
            await moduleData.instance.cleanup();
          }
        } catch (error) {
          logger.error(`❌ 모듈 ${moduleName} 정리 오류:`, error);
        }
      }

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
