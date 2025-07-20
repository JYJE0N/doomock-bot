// src/managers/ModuleManager.js - 완전 리팩토링된 모듈 매니저 (v3)

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
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

    // 처리 중복 방지
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // ErrorHandler 인스턴스
    const ErrorHandler = require("../utils/ErrorHandler");
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1500,
    });

    // 데이터베이스 참조
    const { mongoPoolManager } = require("../database/MongoPoolManager");
    this.db = mongoPoolManager;

    // 글로벌 통계
    this.globalStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      successfulMessages: 0,
      successfulCallbacks: 0,
      unhandledMessages: 0,
      unhandledCallbacks: 0,
      errorMessages: 0,
      errorCallbacks: 0,
      duplicateMessages: 0,
      duplicateCallbacks: 0,
      moduleErrors: new Map(),
      uniqueUsers: new Set(),
      averageResponseTime: 0,
      lastReset: new Date(),
    };

    Logger.info("🔧 ModuleManager 생성됨");
  }

  // =============== 초기화 ===============

  async initialize() {
    if (this.isInitialized) {
      Logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    if (this.initializationPromise) {
      Logger.debug("ModuleManager 초기화 진행 중...");
      return await this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return await this.initializationPromise;
  }

  async _doInitialize() {
    try {
      Logger.info("⚙️ ModuleManager 초기화 시작...");

      // 데이터베이스 연결 확인
      await this._ensureDatabaseConnection();

      // 모듈 로드 및 초기화
      await this._loadModules();
      await this._initializeModules();

      this.isInitialized = true;
      Logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );
    } catch (error) {
      Logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  async _ensureDatabaseConnection() {
    try {
      if (!process.env.MONGO_URL && !process.env.MONGODB_URI) {
        Logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 계속");
        return;
      }

      if (this.db && !(await this.db.isHealthy())) {
        try {
          await this.db.connect();
          Logger.success("✅ MongoDB 연결 확인 완료");
        } catch (connectError) {
          Logger.warn(
            `⚠️ MongoDB 연결 실패, 메모리 모드로 계속: ${connectError.message}`
          );
        }
      } else {
        Logger.debug("✅ MongoDB 연결 상태 양호");
      }
    } catch (error) {
      Logger.warn(
        `⚠️ 데이터베이스 연결 확인 실패, 메모리 모드로 계속: ${error.message}`
      );
    }
  }

  async _loadModules() {
    Logger.info("📦 모듈 로드 시작...");

    try {
      const ModuleConfig = require("../config/ModuleConfig");
      const moduleConfigs = ModuleConfig.getModuleConfigs();

      let loadedCount = 0;
      let failedCount = 0;

      for (const [moduleName, config] of Object.entries(moduleConfigs)) {
        try {
          if (!config.enabled) {
            Logger.debug(`⏭️ ${moduleName} 비활성화됨, 건너뛰기`);
            continue;
          }

          const modulePath = path.resolve(__dirname, config.path);

          if (!fs.existsSync(modulePath + ".js")) {
            Logger.warn(
              `⚠️ ${moduleName} 파일이 존재하지 않음: ${modulePath}.js`
            );
            failedCount++;
            continue;
          }

          const ModuleClass = require(modulePath);

          if (typeof ModuleClass !== "function") {
            throw new Error(`${moduleName}은 유효한 클래스가 아닙니다`);
          }

          this.modules.set(moduleName, {
            name: moduleName,
            config: config,
            class: ModuleClass,
            instance: null,
            isLoaded: true,
            isInitialized: false,
            loadTime: new Date(),
          });

          loadedCount++;
          Logger.debug(`✅ ${moduleName} 로드 완료`);
        } catch (error) {
          failedCount++;
          Logger.error(`❌ ${moduleName} 로드 실패:`, error.message);

          if (config.required) {
            throw new Error(
              `필수 모듈 ${moduleName} 로드 실패: ${error.message}`
            );
          }
        }
      }

      Logger.success(
        `📦 모듈 로드 완료: ${loadedCount}개 성공, ${failedCount}개 실패`
      );

      if (loadedCount === 0) {
        Logger.warn("⚠️ 로드된 모듈이 없습니다. 폴백 모듈을 추가합니다.");
        await this._loadFallbackModules();
      }
    } catch (error) {
      Logger.error("❌ 모듈 로드 중 오류:", error);
      throw error;
    }
  }

  async _loadFallbackModules() {
    Logger.info("🆘 폴백 모듈 로드 시도...");

    try {
      const systemModule = {
        name: "SystemModule",
        config: { enabled: true, priority: 1 },
        class: class SystemModule {
          constructor() {
            this.name = "SystemModule";
          }
          async initialize() {
            Logger.info("✅ SystemModule 초기화 완료");
          }
          async handleMessage() {
            return false;
          }
          async handleCallback() {
            return false;
          }
        },
        instance: null,
        isLoaded: true,
        isInitialized: false,
        loadTime: new Date(),
      };

      this.modules.set("SystemModule", systemModule);
      Logger.success("✅ 폴백 SystemModule 로드 완료");
    } catch (error) {
      Logger.error("❌ 폴백 모듈 로드도 실패:", error);
    }
  }

  async _initializeModules() {
    Logger.info("🔧 모듈 초기화 시작...");

    let initializedCount = 0;
    let failedCount = 0;

    const sortedModules = Array.from(this.modules.entries()).sort(
      ([, a], [, b]) => (a.config.priority || 100) - (b.config.priority || 100)
    );

    for (const [moduleName, moduleData] of sortedModules) {
      try {
        if (!moduleData.isLoaded) {
          Logger.debug(`⏭️ ${moduleName} 로드되지 않음, 건너뛰기`);
          continue;
        }

        Logger.debug(`🔧 ${moduleName} 초기화 중...`);

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
        Logger.success(`✅ ${moduleName} 초기화 완료`);
      } catch (error) {
        failedCount++;
        Logger.error(`❌ ${moduleName} 초기화 실패:`, error.message);

        if (moduleData.config.required) {
          throw new Error(
            `필수 모듈 ${moduleName} 초기화 실패: ${error.message}`
          );
        }
      }
    }

    Logger.success(
      `🔧 모듈 초기화 완료: ${initializedCount}개 성공, ${failedCount}개 실패`
    );
  }

  // =============== 메시지/콜백 처리 ===============

  async handleMessage(bot, msg) {
    return await this.routeMessage(bot, msg);
  }

  async handleCallback(bot, callbackQuery) {
    return await this.routeCallback(bot, callbackQuery);
  }

  async routeMessage(bot, msg) {
    const startTime = Date.now();
    const userId = msg.from.id;
    const messageKey = `${userId}_${msg.message_id}`;

    if (this.processingMessages.has(messageKey)) {
      this.globalStats.duplicateMessages++;
      Logger.debug(`중복 메시지 무시: ${messageKey}`);
      return false;
    }

    this.processingMessages.add(messageKey);
    this.globalStats.totalMessages++;
    this.globalStats.uniqueUsers.add(userId);

    try {
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (!moduleData.isInitialized || !moduleData.instance) continue;

        try {
          const handled = await moduleData.instance.handleMessage?.(bot, msg);
          if (handled) {
            this.globalStats.successfulMessages++;
            Logger.debug(`📨 메시지 처리 완료: ${moduleName}`);
            return true;
          }
        } catch (error) {
          Logger.error(`❌ ${moduleName} 메시지 처리 오류:`, error);
          this.globalStats.moduleErrors.set(
            moduleName,
            (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
          );
        }
      }

      this.globalStats.unhandledMessages++;
      Logger.debug("📨 처리되지 않은 메시지");
      return false;
    } catch (error) {
      this.globalStats.errorMessages++;
      Logger.error("❌ 메시지 라우팅 오류:", error);
      await this.errorHandler.handleError(error, {
        type: "message_routing",
        userId: userId,
        module: "ModuleManager",
      });
      return false;
    } finally {
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, 5000);

      this._updateResponseTime(startTime);
    }
  }

  async routeCallback(bot, callbackQuery) {
    const startTime = Date.now();
    const userId = callbackQuery.from.id;
    const callbackData = callbackQuery.data;
    const callbackKey = `${userId}_${callbackData}`;

    if (this.processingCallbacks.has(callbackKey)) {
      this.globalStats.duplicateCallbacks++;
      Logger.debug(`중복 콜백 무시: ${callbackKey}`);
      return false;
    }

    this.processingCallbacks.add(callbackKey);
    this.globalStats.totalCallbacks++;
    this.globalStats.uniqueUsers.add(userId);

    try {
      Logger.debug(`📞 콜백 처리: ${callbackData}`);

      // 콜백 응답
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (answerError) {
        Logger.debug("콜백 응답 실패 (무시됨):", answerError.message);
      }

      // 1. 시스템 콜백 처리
      if (await this._handleSystemCallbacks(bot, callbackQuery, callbackData)) {
        this.globalStats.successfulCallbacks++;
        return true;
      }

      // 2. 모듈 콜백 파싱 및 라우팅
      const routeInfo = this._parseModuleCallback(callbackData);
      if (routeInfo) {
        const success = await this._routeToModule(
          bot,
          callbackQuery,
          routeInfo
        );
        if (success) {
          this.globalStats.successfulCallbacks++;
          return true;
        }
      }

      // 3. 처리되지 않은 콜백
      this.globalStats.unhandledCallbacks++;
      Logger.warn(`처리되지 않은 콜백: ${callbackData}`);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 알 수 없는 명령입니다.",
        show_alert: true,
      });

      return false;
    } catch (error) {
      this.globalStats.errorCallbacks++;
      Logger.error("❌ 콜백 라우팅 오류:", error);
      await this.errorHandler.handleError(error, {
        type: "callback_routing",
        userId: userId,
        module: "ModuleManager",
      });

      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (answerError) {
        Logger.debug("에러 콜백 응답 실패:", answerError);
      }

      return false;
    } finally {
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);

      this._updateResponseTime(startTime);
    }
  }

  // =============== 콜백 라우팅 로직 ===============

  async _handleSystemCallbacks(bot, callbackQuery, callbackData) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;
    const userName = getUserName(callbackQuery.from);

    switch (callbackData) {
      case "main_menu":
        await this._showMainMenu(bot, chatId, messageId, userName);
        return true;

      case "help":
      case "help_menu":
        await this._showHelpMenu(bot, chatId, messageId);
        return true;

      case "cancel":
      case "cancel_action":
        await this._handleCancel(bot, callbackQuery);
        return true;

      default:
        return false;
    }
  }

  _parseModuleCallback(callbackData) {
    // 🔧 콜론(:)과 언더스코어(_) 둘 다 지원
    const moduleMatch = callbackData.match(/^(\w+)[_:](.+)$/);

    if (moduleMatch) {
      const [, moduleName, action] = moduleMatch;

      const moduleNameMapping = {
        // 기존 모듈들
        todo: "TodoModule",
        fortune: "FortuneModule",
        weather: "WeatherModule",
        timer: "TimerModule",
        leave: "LeaveModule",
        worktime: "WorktimeModule",
        insight: "InsightModule",
        utils: "UtilsModule",
        reminder: "ReminderModule",

        // 🎯 시스템 모듈 추가 (핵심!)
        system: "SystemModule",
        main: "SystemModule",
        help: "SystemModule",
        settings: "SystemModule",
        module: "SystemModule",
        admin: "SystemModule",
      };

      const fullModuleName = moduleNameMapping[moduleName];

      if (fullModuleName) {
        Logger.debug(
          `🔧 콜백 파싱 성공: ${callbackData} → ${fullModuleName}.${action}`
        );
        return {
          moduleName: fullModuleName,
          action: action,
          originalData: callbackData,
          separator: callbackData.includes(":") ? ":" : "_",
        };
      } else {
        Logger.debug(
          `⚠️ 알 수 없는 모듈명: ${moduleName} (in ${callbackData})`
        );
      }
    } else {
      Logger.debug(
        `⚠️ 콜백 형식 불일치: ${callbackData} (예상: module:action 또는 module_action)`
      );
    }

    return null;
  }

  async _routeToModule(bot, callbackQuery, routeInfo) {
    const { moduleName, action } = routeInfo;

    if (!this.modules.has(moduleName)) {
      Logger.warn(`모듈을 찾을 수 없음: ${moduleName}`);
      return false;
    }

    const moduleData = this.modules.get(moduleName);

    if (!moduleData.isInitialized || !moduleData.instance) {
      Logger.warn(`모듈이 초기화되지 않음: ${moduleName}`);
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
          Logger.debug(`✅ 콜백 처리 성공: ${moduleName}.${action}`);
          return true;
        } else {
          Logger.debug(`⚠️ 콜백 처리 거부: ${moduleName}.${action}`);
          return false;
        }
      } else {
        Logger.warn(`${moduleName}에 handleCallback 메서드가 없음`);
        return false;
      }
    } catch (error) {
      Logger.error(`❌ ${moduleName} 콜백 처리 오류:`, error);

      this.globalStats.moduleErrors.set(
        moduleName,
        (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
      );

      if (moduleData.instance.errorHandler) {
        await moduleData.instance.errorHandler.handleError(error, {
          type: "callback_processing",
          module: moduleName,
          userId: callbackQuery.from.id,
          data: callbackQuery.data,
        });
      }

      return false;
    }
  }

  // =============== 시스템 메뉴들 ===============

  async _showMainMenu(bot, chatId, messageId, userName) {
    const menuText = `🏠 **${userName}님의 메인 메뉴**\n\n사용하실 기능을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo_menu" },
          { text: "🔮 운세", callback_data: "fortune_menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
          { text: "⏰ 타이머", callback_data: "timer_menu" },
        ],
        [
          { text: "📅 휴가 관리", callback_data: "leave_menu" },
          { text: "🕐 근무시간", callback_data: "worktime_menu" },
        ],
        [
          { text: "📊 인사이트", callback_data: "insight_menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
        ],
        [
          { text: "🔔 리마인더", callback_data: "reminder_menu" },
          { text: "❓ 도움말", callback_data: "help" },
        ],
      ],
    };

    try {
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("메인 메뉴 표시 오류:", error);
    }
  }
  // 🎯 BotFather 명령어 등록 오류도 함께 해결
  async registerBotCommands() {
    Logger.info("🎯 BotFather 명령어 등록 중...");

    try {
      const commands = [
        { command: "start", description: "🚀 봇 시작 및 메인 메뉴" },
        { command: "help", description: "❓ 도움말 및 사용법 안내" },
        { command: "status", description: "📊 현재 봇 상태 및 시스템 정보" },
        { command: "cancel", description: "❌ 현재 진행 중인 작업 취소" },
      ];

      Logger.debug("🔍 등록할 명령어:", JSON.stringify(commands, null, 2));

      // ⏳ 잠시 대기 (봇 초기화 완료 후)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.bot.setMyCommands(commands);
      Logger.success("✅ BotFather 명령어 등록 완료");
    } catch (error) {
      Logger.error("❌ BotFather 명령어 등록 실패:");
      Logger.error("- 오류 메시지:", error.message);
      Logger.error("- 오류 코드:", error.code || "N/A");

      if (error.response) {
        Logger.error(
          "- API 응답:",
          JSON.stringify(error.response.body, null, 2)
        );
        Logger.error("- 상태 코드:", error.response.statusCode);
      }

      // 🚫 치명적 오류로 처리하지 않음 (봇은 계속 실행)
      Logger.warn("⚠️ 명령어 등록에 실패했지만 봇은 정상적으로 작동합니다");
      Logger.info("💡 수동으로 BotFather에서 명령어를 설정할 수 있습니다");
    }
  }
  async _showHelpMenu(bot, chatId, messageId) {
    const helpText =
      `❓ **두목봇 도움말**\n\n` +
      `**사용 가능한 기능:**\n\n` +
      `📝 **할일 관리** - 할일 추가, 완료, 삭제\n` +
      `🔮 **운세** - 오늘의 운세, 타로카드\n` +
      `🌤️ **날씨** - 실시간 날씨 정보\n` +
      `⏰ **타이머** - 뽀모도르, 작업 타이머\n` +
      `📅 **휴가 관리** - 연차 신청, 관리\n` +
      `🕐 **근무시간** - 출퇴근 관리\n` +
      `📊 **인사이트** - 데이터 분석\n` +
      `🛠️ **유틸리티** - TTS, 도구\n` +
      `🔔 **리마인더** - 알림 설정\n\n` +
      `**문의:** @doomock_support`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("도움말 메뉴 표시 오류:", error);
    }
  }

  async _handleCancel(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    // 모든 모듈의 사용자 상태 초기화
    for (const [moduleName, moduleData] of this.modules.entries()) {
      if (moduleData.instance && moduleData.instance.userStates) {
        moduleData.instance.userStates.delete(userId);
      }
    }

    const cancelText =
      "🚫 **작업이 취소되었습니다**\n\n메인 메뉴로 돌아갑니다.";
    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await bot.editMessageText(cancelText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("취소 처리 오류:", error);
    }
  }

  // =============== 유틸리티 메서드 ===============

  _updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    this.globalStats.averageResponseTime =
      (this.globalStats.averageResponseTime + responseTime) / 2;
    Logger.debug(`응답 시간: ${responseTime}ms`);
  }

  getModuleStatus() {
    const status = {
      total: this.modules.size,
      loaded: 0,
      initialized: 0,
      failed: 0,
      modules: {},
    };

    for (const [name, data] of this.modules.entries()) {
      if (data.isLoaded) status.loaded++;
      if (data.isInitialized) status.initialized++;
      if (!data.isLoaded || !data.isInitialized) status.failed++;

      status.modules[name] = {
        loaded: data.isLoaded,
        initialized: data.isInitialized,
        priority: data.config.priority,
        enabled: data.config.enabled,
      };
    }

    return status;
  }

  // =============== 정리 작업 ===============

  async cleanup() {
    Logger.info("🧹 ModuleManager 정리 작업 시작");

    try {
      this.processingMessages.clear();
      this.processingCallbacks.clear();

      for (const [moduleName, moduleData] of this.modules.entries()) {
        try {
          if (
            moduleData.instance &&
            typeof moduleData.instance.cleanup === "function"
          ) {
            await moduleData.instance.cleanup();
          }
        } catch (error) {
          Logger.error(`❌ 모듈 ${moduleName} 정리 오류:`, error);
        }
      }

      if (
        this.errorHandler &&
        typeof this.errorHandler.cleanup === "function"
      ) {
        this.errorHandler.cleanup();
      }

      Logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      Logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
