// src/managers/ModuleManager.js - 누락된 메서드 추가

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.options = options;

    // 기존 코드들...
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;

    // 처리 중복 방지
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // ✅ ErrorHandler 인스턴스 생성
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

    // 라우팅 규칙
    this.routingRules = new Map();
    this.setupRoutingRules();

    Logger.info("🔧 ModuleManager 생성됨 (강화된 중복 방지 시스템)");
  }

  // 🗺️ 라우팅 규칙 설정
  setupRoutingRules() {
    // 모듈별 콜백 라우팅
    this.routingRules.set(/^(\w+)_(.+)$/, (match, data) => ({
      module: match[1],
      action: match[2],
      subAction: match[2],
      params: {},
    }));

    // 시스템 콜백 라우팅
    this.routingRules.set(/^(main_menu|help|cancel)$/, (match, data) => ({
      module: "system",
      action: match[1],
      subAction: match[1],
      params: {},
    }));
  }

  // ✅ 누락된 메서드 1: handleMessage
  async handleMessage(bot, msg) {
    return await this.routeMessage(bot, msg);
  }

  // ✅ 누락된 메서드 2: handleCallback
  async handleCallback(bot, callbackQuery) {
    return await this.routeCallback(bot, callbackQuery);
  }

  // 📨 메시지 라우팅 (수정됨)
  async routeMessage(bot, msg) {
    const startTime = Date.now();
    const {
      from: { id: userId },
      text,
    } = msg;

    try {
      // 중복 처리 방지
      const messageKey = `${userId}_${Date.now()}`;
      if (this.processingMessages.has(messageKey)) {
        this.globalStats.duplicateMessages++;
        Logger.debug(`⏭️ 중복 메시지 무시: ${messageKey}`);
        return false;
      }

      this.processingMessages.add(messageKey);
      this._setProcessingTimeout(this.processingMessages, messageKey, 10000);

      this.globalStats.totalMessages++;
      this.globalStats.uniqueUsers.add(userId);

      // 모듈별 처리 시도
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") continue;

        try {
          if (
            moduleData.instance &&
            typeof moduleData.instance.handleMessage === "function"
          ) {
            const handled = await moduleData.instance.handleMessage(bot, msg);
            if (handled) {
              this.globalStats.successfulMessages++;
              this._updateResponseTime(startTime);
              return true;
            }
          }
        } catch (moduleError) {
          Logger.error(`❌ 모듈 ${moduleName} 메시지 처리 오류:`, moduleError);

          // ErrorHandler를 통한 에러 처리
          if (moduleData.instance && moduleData.instance.errorHandler) {
            await moduleData.instance.errorHandler.handleError(moduleError, {
              type: "message_processing",
              module: moduleName,
              userId: userId,
            });
          }

          moduleData.errorCount++;
          this.globalStats.moduleErrors.set(
            moduleName,
            (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
          );
        }
      }

      this.globalStats.unhandledMessages++;
      return false;
    } catch (error) {
      Logger.error("❌ 메시지 라우팅 오류:", error);

      // ModuleManager의 ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "message_routing",
        module: "ModuleManager",
        userId: userId,
      });

      this.globalStats.errorMessages++;
      return false;
    } finally {
      this.processingMessages.delete(messageKey);
    }
  }

  // 📞 콜백 라우팅 (수정됨)
  async routeCallback(bot, callbackQuery) {
    const startTime = Date.now();
    const {
      from: { id: userId },
      data,
    } = callbackQuery;

    try {
      // 중복 처리 방지
      const callbackKey = `${userId}_${data}_${Date.now()}`;
      if (this.processingCallbacks.has(callbackKey)) {
        this.globalStats.duplicateCallbacks++;
        Logger.debug(`⏭️ 중복 콜백 무시: ${callbackKey}`);
        return false;
      }

      this.processingCallbacks.add(callbackKey);
      this._setProcessingTimeout(this.processingCallbacks, callbackKey, 10000);

      this.globalStats.totalCallbacks++;
      this.globalStats.uniqueUsers.add(userId);

      // 콜백 데이터 파싱
      const parsedData = this._parseCallbackData(data);

      if (!parsedData) {
        Logger.warn(`파싱할 수 없는 콜백 데이터: ${data}`);
        return false;
      }

      const { module: targetModule, action, subAction, params } = parsedData;

      // 시스템 콜백 처리
      if (targetModule === "system") {
        return await this._handleSystemCallback(bot, callbackQuery, action);
      }

      // 모듈 콜백 처리
      if (targetModule && this.modules.has(targetModule)) {
        const moduleData = this.modules.get(targetModule);

        if (moduleData.status === "initialized") {
          try {
            if (
              moduleData.instance &&
              typeof moduleData.instance.handleCallback === "function"
            ) {
              const handled = await moduleData.instance.handleCallback(
                bot,
                callbackQuery,
                subAction,
                params,
                this
              );

              if (handled) {
                this.globalStats.successfulCallbacks++;
                this._updateResponseTime(startTime);
                return true;
              }
            }
          } catch (moduleError) {
            Logger.error(
              `❌ 모듈 ${targetModule} 콜백 처리 오류:`,
              moduleError
            );

            // ErrorHandler를 통한 에러 처리
            if (moduleData.instance && moduleData.instance.errorHandler) {
              await moduleData.instance.errorHandler.handleError(moduleError, {
                type: "callback_processing",
                module: targetModule,
                userId: userId,
                data: data,
              });
            }

            moduleData.errorCount++;
            this.globalStats.moduleErrors.set(
              targetModule,
              (this.globalStats.moduleErrors.get(targetModule) || 0) + 1
            );
          }
        }
      }

      this.globalStats.unhandledCallbacks++;
      return false;
    } catch (error) {
      Logger.error("❌ 콜백 라우팅 오류:", error);

      // ModuleManager의 ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "callback_routing",
        module: "ModuleManager",
        userId: userId,
        data: data,
      });

      this.globalStats.errorCallbacks++;
      return false;
    } finally {
      this.processingCallbacks.delete(callbackKey);
    }
  }

  // 🗺️ 콜백 데이터 파싱
  _parseCallbackData(callbackData) {
    for (const [regex, parser] of this.routingRules.entries()) {
      const match = callbackData.match(regex);
      if (match) {
        return parser(match, callbackData);
      }
    }

    Logger.warn(`알 수 없는 콜백 데이터 형식: ${callbackData}`);
    return null;
  }

  // 🏠 시스템 콜백 처리
  async _handleSystemCallback(bot, callbackQuery, action) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    try {
      switch (action) {
        case "main_menu":
          await this._showMainMenu(bot, chatId, messageId);
          return true;

        case "help":
          await this._showHelpMenu(bot, chatId, messageId);
          return true;

        case "cancel":
          await this._handleCancel(bot, callbackQuery);
          return true;

        default:
          return false;
      }
    } catch (error) {
      Logger.error(`시스템 콜백 처리 오류 (${action}):`, error);
      return false;
    }
  }

  // 🏠 메인 메뉴 표시
  async _showMainMenu(bot, chatId, messageId) {
    const menuText = "🏠 **메인 메뉴**\n\n사용하실 기능을 선택해주세요.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo_menu" },
          { text: "🔮 운세", callback_data: "fortune_menu" },
        ],
        [
          { text: "⏰ 타이머", callback_data: "timer_menu" },
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
        ],
        [
          { text: "🎯 인사이트", callback_data: "insight_menu" },
          { text: "🔧 유틸리티", callback_data: "utils_menu" },
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

  // ❓ 도움말 메뉴 표시
  async _showHelpMenu(bot, chatId, messageId) {
    const helpText = `❓ **도움말**

**🤖 기본 사용법:**
• /start - 메인 메뉴 표시
• /help - 도움말 보기
• /cancel - 현재 작업 취소

**📋 주요 기능:**
• 📝 할일 관리
• 🔮 운세 보기  
• ⏰ 포모도로 타이머
• 🌤️ 날씨 정보

각 기능별 자세한 사용법은 해당 메뉴에서 확인하세요!`;

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

  // ❌ 취소 처리
  async _handleCancel(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    // 사용자 상태 초기화
    // TODO: 각 모듈의 사용자 상태도 정리해야 함

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
    } catch (error) {
      Logger.error("취소 처리 오류:", error);
    }
  }

  // ⏰ 처리 타임아웃 설정
  _setProcessingTimeout(processingSet, key, timeout) {
    setTimeout(() => {
      processingSet.delete(key);
    }, timeout);
  }

  // 📊 응답 시간 업데이트
  _updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    // 통계 업데이트 로직
    Logger.debug(`응답 시간: ${responseTime}ms`);
  }

  // 나머지 기존 메서드들은 그대로 유지...

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
      this.globalStats.errors++;
      Logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // 🗄️ 안전한 데이터베이스 연결 확인
  async _ensureDatabaseConnection() {
    try {
      // MONGO_URL이 없으면 건너뛰기
      if (!process.env.MONGO_URL && !process.env.MONGODB_URI) {
        Logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 계속");
        return;
      }

      // 연결 상태 확인
      if (!(await this.db.isHealthy())) {
        try {
          await this.db.connect();
          Logger.success("✅ MongoDB 연결 확인 완료");
        } catch (connectError) {
          Logger.warn(
            `⚠️ MongoDB 연결 실패, 메모리 모드로 계속: ${connectError.message}`
          );
          return;
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
    // 모듈 로드 로직...
    Logger.info("📦 모듈 로드 시작...");
    // 구현 필요
  }

  async _initializeModules() {
    // 모듈 초기화 로직...
    Logger.info("🔧 모듈 초기화 시작...");
    // 구현 필요
  }

  // 🧹 정리 작업
  async cleanup() {
    Logger.info("🧹 ModuleManager 정리 작업 시작");

    try {
      // 진행 중인 처리 중단
      this.processingMessages.clear();
      this.processingCallbacks.clear();

      // 모든 모듈 정리
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

      // ErrorHandler 정리
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
