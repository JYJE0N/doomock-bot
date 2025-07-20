// src/managers/ModuleManager.js - 캐시 안전 로딩

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
    this.initializationPromise = null;

    // 캐시 정리 추적
    this.cleanedCaches = new Set();

    // 처리 중복 방지
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // 데이터베이스 참조
    const { mongoPoolManager } = require("../database/MongoPoolManager");
    this.db = mongoPoolManager;

    // 글로벌 통계
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

    if (this.initializationPromise) {
      logger.debug("ModuleManager 초기화 진행 중...");
      return await this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return await this.initializationPromise;
  }

  async _doInitialize() {
    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 1. 데이터베이스 연결 확인
      await this._ensureDatabaseConnection();

      // 2. require 캐시 전체 정리 (안전하게)
      await this._safeCleanCache();

      // 3. 모듈 로드 및 초기화
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

  // ✅ 안전한 캐시 정리
  async _safeCleanCache() {
    try {
      logger.info("🗑️ require 캐시 안전 정리 시작...");

      const modulePaths = [
        "../modules/SystemModule",
        "../modules/TodoModule",
        "../modules/FortuneModule",
        "../modules/WeatherModule",
        "../modules/UtilsModule",
        "../utils/Logger",
      ];

      let cleanedCount = 0;

      for (const modulePath of modulePaths) {
        try {
          const fullPath = path.resolve(__dirname, modulePath + ".js");

          // 파일이 존재하는지 확인
          if (fs.existsSync(fullPath)) {
            const resolvedPath = require.resolve(fullPath);

            // 캐시에 있고 아직 정리하지 않았다면 정리
            if (
              require.cache[resolvedPath] &&
              !this.cleanedCaches.has(resolvedPath)
            ) {
              delete require.cache[resolvedPath];
              this.cleanedCaches.add(resolvedPath);
              cleanedCount++;
              logger.debug(`🗑️ 캐시 정리: ${path.basename(modulePath)}`);
            }
          }
        } catch (error) {
          logger.warn(`⚠️ 캐시 정리 실패 (${modulePath}):`, error.message);
        }
      }

      logger.success(`✅ 캐시 정리 완료: ${cleanedCount}개 모듈`);
    } catch (error) {
      logger.error("❌ 캐시 정리 중 오류:", error);
      // 캐시 정리 실패는 치명적이지 않으므로 계속 진행
    }
  }

  async _ensureDatabaseConnection() {
    try {
      if (!process.env.MONGO_URL && !process.env.MONGODB_URI) {
        logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 계속");
        return;
      }

      if (this.db && !(await this.db.isHealthy())) {
        try {
          await this.db.connect();
          logger.success("✅ MongoDB 연결 확인 완료");
        } catch (connectError) {
          logger.warn(
            `⚠️ MongoDB 연결 실패, 메모리 모드로 계속: ${connectError.message}`
          );
        }
      } else {
        logger.debug("✅ MongoDB 연결 상태 양호");
      }
    } catch (error) {
      logger.warn(
        `⚠️ 데이터베이스 연결 확인 실패, 메모리 모드로 계속: ${error.message}`
      );
    }
  }

  // ✅ 안전한 모듈 로딩
  async _loadModulesSafely() {
    logger.info("📦 안전한 모듈 로드 시작...");

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

        const success = await this._loadSingleModuleSafely(moduleName, config);
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
  async _loadSingleModuleSafely(moduleName, config) {
    try {
      const modulePath = path.resolve(__dirname, config.path);

      // 파일 존재 확인
      if (!fs.existsSync(modulePath + ".js")) {
        logger.warn(`⚠️ ${moduleName} 파일이 존재하지 않음: ${modulePath}.js`);
        return false;
      }

      // 모듈 로드 (캐시는 이미 정리됨)
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

        const moduleInstance = new moduleData.class(this.bot, {
          db: this.db,
          moduleManager: this,
        });

        if (typeof moduleInstance.initialize === "function") {
          await moduleInstance.initialize();
        }

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
  // =============== 🎯 메시지 및 콜백 처리 ===============

  // ✅ 메시지 처리
  async handleMessage(bot, msg) {
    const messageKey = `${msg.chat.id}_${msg.message_id}`;

    if (this.processingMessages.has(messageKey)) {
      logger.debug(`중복 메시지 무시: ${messageKey}`);
      return false;
    }

    this.processingMessages.add(messageKey);

    try {
      this.globalStats.totalMessages++;
      this.globalStats.uniqueUsers.add(msg.from.id);

      // SystemModule이 있으면 먼저 시도
      if (this.modules.has("SystemModule")) {
        const systemModule = this.modules.get("SystemModule");
        if (systemModule.instance && systemModule.isInitialized) {
          try {
            const handled = await systemModule.instance.handleMessage(bot, msg);
            if (handled) {
              this.globalStats.successfulMessages++;
              return true;
            }
          } catch (error) {
            logger.error("SystemModule 메시지 처리 오류:", error);
          }
        }
      }

      // 다른 모듈들 시도
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleName === "SystemModule") continue; // 이미 시도함

        if (moduleData.isInitialized && moduleData.instance) {
          try {
            if (typeof moduleData.instance.handleMessage === "function") {
              const handled = await moduleData.instance.handleMessage(bot, msg);
              if (handled) {
                this.globalStats.successfulMessages++;
                logger.debug(`✅ 메시지 처리 성공: ${moduleName}`);
                return true;
              }
            }
          } catch (error) {
            logger.error(`❌ ${moduleName} 메시지 처리 오류:`, error);
            this.globalStats.moduleErrors.set(
              moduleName,
              (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
            );
          }
        }
      }

      logger.debug("⚠️ 처리되지 않은 메시지");
      return false;
    } finally {
      // 5초 후 중복 처리 키 정리
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, 5000);
    }
  }

  // ✅ 콜백 처리 (누락된 핵심 메서드!)
  async handleCallback(bot, callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}`;

    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug(`중복 콜백 무시: ${callbackKey}`);
      return false;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      this.globalStats.totalCallbacks++;
      this.globalStats.uniqueUsers.add(callbackQuery.from.id);

      // 콜백 쿼리 응답 (중복 방지)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (answerError) {
        logger.debug("콜백 응답 실패 (무시됨):", answerError.message);
      }

      const callbackData = callbackQuery.data;
      logger.debug(`🔍 콜백 데이터 분석: ${callbackData}`);

      // 기본 시스템 콜백 처리
      if (await this._handleSystemCallbacks(bot, callbackQuery, callbackData)) {
        this.globalStats.successfulCallbacks++;
        return true;
      }

      // 모듈별 콜백 라우팅
      const routeInfo = this._parseCallbackData(callbackData);
      if (routeInfo) {
        const handled = await this._routeToModule(
          bot,
          callbackQuery,
          routeInfo
        );
        if (handled) {
          this.globalStats.successfulCallbacks++;
          return true;
        }
      }

      // 처리되지 않은 콜백
      logger.warn(`⚠️ 처리되지 않은 콜백: ${callbackData}`);
      await this._handleUnknownCallback(bot, callbackQuery);
      return false;
    } catch (error) {
      logger.error("콜백 처리 중 오류:", error);
      await this._sendCallbackErrorMessage(bot, callbackQuery);
      return false;
    } finally {
      // 3초 후 중복 처리 키 정리
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }
  }

  // 🏠 시스템 콜백 처리
  async _handleSystemCallbacks(bot, callbackQuery, callbackData) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    switch (callbackData) {
      case "main_menu":
        await this._showMainMenu(bot, chatId, messageId);
        return true;

      case "help":
        await this._showHelp(bot, chatId, messageId);
        return true;

      case "cancel":
        await this._handleCancel(bot, chatId, messageId);
        return true;

      default:
        return false;
    }
  }

  // 📋 메인 메뉴 표시
  async _showMainMenu(bot, chatId, messageId = null) {
    const menuText = `🏠 **메인 메뉴**

안녕하세요! 원하는 기능을 선택해주세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils:menu" },
        ],
        [{ text: "❓ 도움말", callback_data: "help" }],
      ],
    };

    try {
      if (messageId) {
        await bot.editMessageText(menuText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(chatId, menuText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
      logger.debug("✅ 메인 메뉴 표시 완료");
    } catch (error) {
      logger.error("메인 메뉴 표시 오류:", error);
      // 폴백: 간단한 메시지
      await bot.sendMessage(
        chatId,
        "🏠 메인 메뉴\n\n/start 명령어를 사용해주세요."
      );
    }
  }

  // ❓ 도움말 표시
  async _showHelp(bot, chatId, messageId = null) {
    const moduleList = Array.from(this.modules.keys())
      .filter((name) => this.modules.get(name).isInitialized)
      .map((name) => `• ${name}`)
      .join("\n");

    const helpText = `❓ **도움말**

**기본 명령어:**
• /start - 메인 메뉴 표시
• /help - 이 도움말 표시

**사용 가능한 모듈:**
${moduleList || "• 로드된 모듈이 없습니다"}

**문의사항:**
문제가 있으시면 관리자에게 문의해주세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      if (messageId) {
        await bot.editMessageText(helpText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(chatId, helpText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
      logger.debug("✅ 도움말 표시 완료");
    } catch (error) {
      logger.error("도움말 표시 오류:", error);
    }
  }

  // ❌ 취소 처리
  async _handleCancel(bot, chatId, messageId) {
    const cancelText = "❌ **작업 취소됨**\n\n현재 작업이 취소되었습니다.";

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await bot.editMessageText(cancelText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      logger.debug("✅ 취소 메시지 표시 완료");
    } catch (error) {
      logger.error("취소 메시지 표시 오류:", error);
    }
  }

  // 🔍 콜백 데이터 파싱
  _parseCallbackData(callbackData) {
    // 형식: "module:action" 또는 "module_action"
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

  // 🎯 모듈로 라우팅
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
        // 표준 매개변수로 호출: (bot, callbackQuery, subAction, params, menuManager)
        const handled = await moduleData.instance.handleCallback(
          bot,
          callbackQuery,
          action,
          {},
          this
        );

        if (handled) {
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

  // ❓ 알 수 없는 콜백 처리
  async _handleUnknownCallback(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const errorText = "❓ **알 수 없는 요청**\n\n처리할 수 없는 요청입니다.";

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("알 수 없는 콜백 처리 오류:", error);
    }
  }

  // 🚨 콜백 에러 메시지
  async _sendCallbackErrorMessage(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
      },
    } = callbackQuery;

    try {
      await bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다.\n\n/start 명령어로 다시 시작해주세요."
      );
    } catch (error) {
      logger.error("콜백 에러 메시지 전송 실패:", error);
    }
  }

  // =============== 🛠️ 유틸리티 메서드들 ===============

  // 메인 메뉴 키보드 생성 (BotController에서 사용)
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils:menu" },
        ],
        [{ text: "❓ 도움말", callback_data: "help" }],
      ],
    };
  }

  // 📊 통계 정보 조회
  getStats() {
    return {
      modules: {
        total: this.modules.size,
        loaded: Array.from(this.modules.values()).filter((m) => m.isLoaded)
          .length,
        initialized: Array.from(this.modules.values()).filter(
          (m) => m.isInitialized
        ).length,
      },
      ...this.globalStats,
      uniqueUsers: this.globalStats.uniqueUsers.size,
    };
  }

  // 🔍 모듈 상태 조회
  getModuleStatus(moduleName = null) {
    if (moduleName) {
      const moduleData = this.modules.get(moduleName);
      return moduleData
        ? {
            name: moduleData.name,
            isLoaded: moduleData.isLoaded,
            isInitialized: moduleData.isInitialized,
            loadTime: moduleData.loadTime,
            config: moduleData.config,
          }
        : null;
    }

    const statuses = {};
    for (const [name, data] of this.modules.entries()) {
      statuses[name] = {
        isLoaded: data.isLoaded,
        isInitialized: data.isInitialized,
        loadTime: data.loadTime,
      };
    }
    return statuses;
  }
  // 정리 작업
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

      // 캐시 정리 추적 초기화
      this.cleanedCaches.clear();

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
