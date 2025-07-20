// src/managers/ModuleManager.js - 완전 리팩토링된 모듈 매니저

const Logger = require("../utils/Logger");
const ModuleConfig = require("../config/ModuleConfig");
const { mongoPoolManager } = require("../database/MongoPoolManager");
const { ValidationHelper } = require("../utils/ValidationHelper");
const ErrorHandler = require("../utils/ErrorHandler");

class ModuleManager {
  constructor(bot = null, options = {}) {
    this.bot = bot;
    this.modules = new Map();
    this.moduleInstances = new Map();

    // 🗄️ 데이터베이스 연결
    this.db = mongoPoolManager;

    // 👥 전역 사용자 상태 (모든 모듈 공유)
    this.globalUserStates = new Map();

    // 🛡️ 중복 처리 방지 시스템 (강화)
    this.processingCallbacks = new Set();
    this.processingMessages = new Set();
    this.callbackTimeout = 5000;
    this.messageTimeout = 3000;

    // 📊 전역 통계
    this.globalStats = {
      totalRequests: 0,
      totalCallbacks: 0,
      totalMessages: 0,
      duplicateCallbacks: 0,
      duplicateMessages: 0,
      errors: 0,
      moduleErrors: new Map(),
      averageResponseTime: 0,
      startTime: new Date(),
    };

    // ✅ ErrorHandler 인스턴스 생성
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1500,
    });

    // ⚙️ 초기화 상태
    this.isInitialized = false;
    this.initializationPromise = null;

    // 🔄 라우팅 규칙 (표준화)
    this.routingRules = new Map();
    this.setupRoutingRules();

    Logger.info("🔧 ModuleManager 생성됨 (강화된 중복 방지 시스템)");
  }

  // 🗺️ 라우팅 규칙 설정
  setupRoutingRules() {
    // 콜백 데이터 형식: "module_action" 또는 "module_action_param"
    this.routingRules.set(/^(\w+)_(.+)$/, (match, callbackData) => {
      const [, moduleName, actionPart] = match;

      // 액션과 파라미터 분리
      const actionParts = actionPart.split("_");
      const subAction = actionParts[0];
      const params = actionParts.slice(1);

      return { moduleName, subAction, params };
    });

    // 메인 메뉴 라우팅
    this.routingRules.set(/^main_menu$/, () => ({
      moduleName: "main",
      subAction: "menu",
      params: [],
    }));

    // 직접 모듈 호출
    this.routingRules.set(/^module_(\w+)$/, (match) => {
      const [, moduleName] = match;
      return { moduleName, subAction: "menu", params: [] };
    });
  }

  // 🚀 모듈 매니저 초기화
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
      await this._setupGlobalIndexes();

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

  // 🗄️ 데이터베이스 연결 확인
  async _ensureDatabaseConnection() {
    try {
      if (!(await this.db.isHealthy())) {
        await this.db.connect();
      }
      Logger.success("✅ MongoDB 연결 확인 완료");
    } catch (error) {
      throw new Error(`데이터베이스 연결 실패: ${error.message}`);
    }
  }

  // 📦 모듈 로드
  async _loadModules() {
    const moduleConfigs = this._getModuleConfigs();
    const loadPromises = [];

    for (const [moduleName, config] of Object.entries(moduleConfigs)) {
      if (!config.enabled) {
        Logger.info(`⏸️ 모듈 ${moduleName} 비활성화됨`);
        continue;
      }

      loadPromises.push(this._loadSingleModule(moduleName, config));
    }

    const results = await Promise.allSettled(loadPromises);
    this._processLoadResults(results);
  }

  // 📦 개별 모듈 로드
  async _loadSingleModule(moduleName, config) {
    try {
      Logger.info(`📦 모듈 ${moduleName} 로드 중...`);

      let ModuleClass;
      try {
        ModuleClass = require(config.path);
      } catch (requireError) {
        if (config.required) {
          throw new Error(`필수 모듈 파일을 찾을 수 없음: ${config.path}`);
        }
        Logger.warn(`⚠️ 선택적 모듈 파일을 찾을 수 없음: ${config.path}`);
        return;
      }

      // 모듈 인스턴스 생성
      const moduleInstance = new ModuleClass();

      // 봇 인스턴스 주입 (에러 처리용)
      if (this.bot) {
        moduleInstance.bot = this.bot;
      }

      // 모듈 정보 저장
      this.modules.set(moduleName, {
        instance: moduleInstance,
        config: config,
        status: "loaded",
        loadTime: new Date(),
        errorCount: 0,
        lastError: null,
      });

      this.moduleInstances.set(moduleName.toLowerCase(), moduleInstance);

      Logger.success(`✅ 모듈 ${moduleName} 로드 완료`);
      return { moduleName, success: true };
    } catch (error) {
      const errorInfo = { moduleName, success: false, error };

      if (config.required) {
        throw error;
      } else {
        Logger.error(`❌ 선택적 모듈 ${moduleName} 로드 실패:`, error.message);
        return errorInfo;
      }
    }
  }

  // 📊 로드 결과 처리
  _processLoadResults(results) {
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value?.success
    ).length;
    const failed = results.filter(
      (r) => r.status === "rejected" || !r.value?.success
    ).length;

    Logger.info(`📊 모듈 로드 완료: 성공 ${successful}개, 실패 ${failed}개`);

    if (failed > 0) {
      const failedModules = results
        .filter((r) => r.status === "rejected" || !r.value?.success)
        .map(
          (r) =>
            r.reason?.message || r.value?.error?.message || "알 수 없는 오류"
        );

      Logger.warn(`⚠️ 실패한 모듈들: ${failedModules.join(", ")}`);
    }
  }

  // 🔧 모듈 초기화
  async _initializeModules() {
    const initPromises = [];

    for (const [moduleName, moduleData] of this.modules.entries()) {
      initPromises.push(this._initializeSingleModule(moduleName, moduleData));
    }

    const results = await Promise.allSettled(initPromises);
    this._processInitResults(results);
  }

  // 🔧 개별 모듈 초기화
  async _initializeSingleModule(moduleName, moduleData) {
    try {
      Logger.info(`🔧 모듈 ${moduleName} 초기화 중...`);

      const instance = moduleData.instance;

      if (instance.initialize) {
        await instance.initialize();
      }

      moduleData.status = "initialized";
      Logger.success(`✅ 모듈 ${moduleName} 초기화 완료`);

      return { moduleName, success: true };
    } catch (error) {
      moduleData.status = "error";
      moduleData.lastError = error;
      moduleData.errorCount++;

      this.globalStats.moduleErrors.set(
        moduleName,
        (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
      );

      // ✅ ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "module_initialization",
        module: moduleName,
      });

      if (moduleData.config.required) {
        throw new Error(
          `필수 모듈 ${moduleName} 초기화 실패: ${error.message}`
        );
      } else {
        Logger.error(
          `❌ 선택적 모듈 ${moduleName} 초기화 실패:`,
          error.message
        );
        return { moduleName, success: false, error };
      }
    }
  }

  // 📊 초기화 결과 처리
  _processInitResults(results) {
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value?.success
    ).length;
    const failed = results.filter(
      (r) => r.status === "rejected" || !r.value?.success
    ).length;

    Logger.info(`📊 모듈 초기화 완료: 성공 ${successful}개, 실패 ${failed}개`);
  }

  // 📑 전역 인덱스 설정
  async _setupGlobalIndexes() {
    try {
      // 전역 사용자 상태 인덱스
      const globalStateIndexes = [
        { key: { userId: 1 }, options: {} },
        { key: { moduleName: 1 }, options: {} },
        { key: { createdAt: 1 }, options: { expireAfterSeconds: 3600 } }, // 1시간 후 자동 삭제
      ];

      await this.db.ensureIndexes("global_userStates", globalStateIndexes);

      // 전역 통계 인덱스
      const statsIndexes = [
        { key: { date: 1, moduleName: 1 }, options: { unique: true } },
        { key: { createdAt: 1 }, options: { expireAfterSeconds: 2592000 } }, // 30일 후 삭제
      ];

      await this.db.ensureIndexes("global_stats", statsIndexes);

      Logger.debug("📑 전역 인덱스 설정 완료");
    } catch (error) {
      Logger.warn("⚠️ 전역 인덱스 설정 실패:", error.message);
    }
  }

  // 📨 메시지 라우팅 (표준화된 매개변수)
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
          const handled = await moduleData.instance.handleMessage(bot, msg);
          if (handled) {
            this.globalStats.successfulMessages++;
            this._updateResponseTime(startTime);
            return true;
          }
        } catch (moduleError) {
          Logger.error(`❌ 모듈 ${moduleName} 메시지 처리 오류:`, moduleError);

          // ✅ 각 모듈의 ErrorHandler를 통한 에러 처리
          if (moduleData.instance.errorHandler) {
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

      // ✅ ModuleManager의 ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "message_routing",
        module: "ModuleManager",
        userId: userId,
      });

      this.globalStats.errorMessages++;
      return false;
    } finally {
      this.processingMessages.delete(`${userId}_${Date.now()}`);
    }
  }

  // 📞 콜백 라우팅 (🎯 완전 표준화된 매개변수)
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
      const {
        module: targetModule,
        action,
        subAction,
        params,
      } = this._parseCallbackData(data);

      if (targetModule && this.modules.has(targetModule)) {
        const moduleData = this.modules.get(targetModule);

        if (moduleData.status === "initialized") {
          try {
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
          } catch (moduleError) {
            Logger.error(
              `❌ 모듈 ${targetModule} 콜백 처리 오류:`,
              moduleError
            );

            // ✅ 각 모듈의 ErrorHandler를 통한 에러 처리
            if (moduleData.instance.errorHandler) {
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

      // ✅ ModuleManager의 ErrorHandler를 통한 에러 처리
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
    return null;
  }

  // 🏠 메인 메뉴 처리
  async _handleMainMenu(bot, callbackQuery, menuManager) {
    try {
      if (menuManager && menuManager.showMainMenu) {
        await menuManager.showMainMenu(bot, callbackQuery);
        return true;
      } else {
        // 기본 메인 메뉴
        const mainMenuText =
          "🏠 **메인 메뉴**\n\n사용하실 기능을 선택해주세요.";
        const modules = this._getAvailableModules();

        const keyboard = {
          inline_keyboard: modules.map((module) => [
            {
              text: `${module.emoji || "🔧"} ${module.displayName}`,
              callback_data: `module_${module.name}`,
            },
          ]),
        };

        await bot.editMessageText(mainMenuText, {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });

        return true;
      }
    } catch (error) {
      Logger.error("❌ 메인 메뉴 처리 오류:", error);
      return false;
    }
  }

  // 🔍 모듈 찾기 (대소문자 무관)
  _findModule(moduleName) {
    // 정확한 이름으로 찾기
    const moduleData = this.modules.get(moduleName);
    if (moduleData?.status === "initialized") {
      return moduleData.instance;
    }

    // 소문자로 찾기
    const instance = this.moduleInstances.get(moduleName.toLowerCase());
    if (instance && instance.isInitialized) {
      return instance;
    }

    // 부분 매칭
    for (const [name, data] of this.modules.entries()) {
      if (
        name.toLowerCase().includes(moduleName.toLowerCase()) &&
        data.status === "initialized"
      ) {
        return data.instance;
      }
    }

    return null;
  }

  // 📊 모듈 우선순위 정렬
  _getSortedModules() {
    return Array.from(this.modules.entries()).sort(
      ([, a], [, b]) => (a.config.priority || 100) - (b.config.priority || 100)
    );
  }

  // 📋 사용 가능한 모듈 목록
  _getAvailableModules() {
    return Array.from(this.modules.entries())
      .filter(([, data]) => data.status === "initialized")
      .map(([name, data]) => ({
        name: name.replace("Module", "").toLowerCase(),
        displayName: data.config.description || name,
        description: data.config.description,
        emoji: data.config.emoji,
        features: data.config.features,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
    const totalRequests = this.globalStats.totalRequests;

    this.globalStats.averageResponseTime =
      (this.globalStats.averageResponseTime * (totalRequests - 1) +
        responseTime) /
      totalRequests;
  }

  // 🛡️ 모듈 에러 처리
  async _handleModuleError(moduleName, error, type, context) {
    const moduleData = this.modules.get(moduleName);
    if (moduleData) {
      moduleData.errorCount++;
      moduleData.lastError = error;
    }

    this.globalStats.moduleErrors.set(
      moduleName,
      (this.globalStats.moduleErrors.get(moduleName) || 0) + 1
    );

    Logger.error(`❌ 모듈 ${moduleName} ${type} 처리 오류:`, error);

    // 심각한 오류인 경우 모듈 비활성화 고려
    if (moduleData && moduleData.errorCount > 10) {
      Logger.warn(
        `⚠️ 모듈 ${moduleName} 오류 횟수 초과 (${moduleData.errorCount}회)`
      );
    }
  }

  // 👥 전역 사용자 상태 관리
  async setGlobalUserState(userId, state) {
    try {
      const stateData = {
        userId,
        ...state,
        updatedAt: new Date(),
      };

      await this.db.updateOne("global_userStates", { userId }, stateData, {
        upsert: true,
      });

      this.globalUserStates.set(userId, stateData);
    } catch (error) {
      Logger.error("❌ 전역 사용자 상태 저장 실패:", error);
    }
  }

  async getGlobalUserState(userId) {
    try {
      // 메모리에서 먼저 확인
      const memoryState = this.globalUserStates.get(userId);
      if (memoryState) return memoryState;

      // 데이터베이스에서 조회
      const dbState = await this.db.findOne("global_userStates", { userId });
      if (dbState) {
        this.globalUserStates.set(userId, dbState);
        return dbState;
      }

      return null;
    } catch (error) {
      Logger.error("❌ 전역 사용자 상태 조회 실패:", error);
      return null;
    }
  }

  async clearGlobalUserState(userId) {
    try {
      await this.db.deleteOne("global_userStates", { userId });
      this.globalUserStates.delete(userId);
    } catch (error) {
      Logger.error("❌ 전역 사용자 상태 삭제 실패:", error);
    }
  }

  // 📊 전역 통계 조회
  getGlobalStats() {
    const uptime = Date.now() - this.globalStats.startTime.getTime();

    return {
      ...this.globalStats,
      moduleErrors: Object.fromEntries(this.globalStats.moduleErrors),
      uptime: uptime,
      uptimeFormatted: this._formatUptime(uptime),
      modules: {
        total: this.modules.size,
        initialized: Array.from(this.modules.values()).filter(
          (m) => m.status === "initialized"
        ).length,
        failed: Array.from(this.modules.values()).filter(
          (m) => m.status === "error"
        ).length,
      },
      performance: {
        averageResponseTime: Math.round(this.globalStats.averageResponseTime),
        requestsPerSecond: this.globalStats.totalRequests / (uptime / 1000),
        errorRate:
          this.globalStats.totalRequests > 0
            ? (
                (this.globalStats.errors / this.globalStats.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "0%",
      },
    };
  }

  // 🕐 업타임 포맷팅
  _formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  // 📦 모듈 설정 (ModuleConfig 없이 내장)
  _getModuleConfigs() {
    return {
      TodoModule: {
        enabled: true,
        priority: 1,
        required: false,
        path: "../modules/TodoModule",
        description: "📝 할일 관리",
        emoji: "📝",
        features: ["할일 추가", "완료 처리", "통계", "삭제", "검색"],
      },
      FortuneModule: {
        enabled: true,
        priority: 2,
        required: false,
        path: "../modules/FortuneModule",
        description: "🔮 운세",
        emoji: "🔮",
        features: ["일반운", "업무운", "연애운", "재물운", "타로카드"],
      },
      WeatherModule: {
        enabled: true,
        priority: 3,
        required: false,
        path: "../modules/WeatherModule",
        description: "🌤️ 날씨",
        emoji: "🌤️",
        features: ["현재 날씨", "예보", "지역별 날씨"],
      },
      TimerModule: {
        enabled: true,
        priority: 4,
        required: false,
        path: "../modules/TimerModule",
        description: "⏰ 타이머",
        emoji: "⏰",
        features: ["뽀모도로", "타이머", "스톱워치"],
      },
      LeaveModule: {
        enabled: true,
        priority: 5,
        required: false,
        path: "../modules/LeaveModule",
        description: "📅 휴가 관리",
        emoji: "📅",
        features: ["휴가 신청", "잔여 일수", "히스토리"],
      },
      WorktimeModule: {
        enabled: true,
        priority: 6,
        required: false,
        path: "../modules/WorktimeModule",
        description: "🕐 근무시간",
        emoji: "🕐",
        features: ["출퇴근", "근무 시간", "통계"],
      },
      UtilsModule: {
        enabled: true,
        priority: 7,
        required: false,
        path: "../modules/UtilsModule",
        description: "🛠️ 유틸리티",
        emoji: "🛠️",
        features: ["TTS", "도구", "변환기"],
      },
      ReminderModule: {
        enabled: true,
        priority: 8,
        required: false,
        path: "../modules/ReminderModule",
        description: "🔔 리마인더",
        emoji: "🔔",
        features: ["알림 설정", "반복 알림", "스케줄링"],
      },
      InsightModule: {
        enabled: true,
        priority: 9,
        required: false,
        path: "../modules/InsightModule",
        description: "📊 인사이트",
        emoji: "📊",
        features: ["데이터 분석", "리포트", "통계"],
      },
    };
  }

  // 🔍 모듈 상태 조회
  getModuleStatus(moduleName) {
    const moduleData = this.modules.get(moduleName);
    if (!moduleData) return null;

    return {
      name: moduleName,
      status: moduleData.status,
      config: moduleData.config,
      loadTime: moduleData.loadTime,
      errorCount: moduleData.errorCount,
      lastError: moduleData.lastError?.message,
      instance: moduleData.instance?.getStatus?.() || null,
    };
  }

  // 📋 모든 모듈 상태 조회
  getAllModuleStatus() {
    const statuses = [];

    for (const [moduleName] of this.modules.entries()) {
      statuses.push(this.getModuleStatus(moduleName));
    }

    return statuses.sort(
      (a, b) => (a.config?.priority || 100) - (b.config?.priority || 100)
    );
  }

  // 🔄 모듈 재시작
  async restartModule(moduleName) {
    try {
      Logger.info(`🔄 모듈 ${moduleName} 재시작 중...`);

      const moduleData = this.modules.get(moduleName);
      if (!moduleData) {
        throw new Error(`모듈 ${moduleName}을 찾을 수 없습니다`);
      }

      // 기존 인스턴스 정리
      if (moduleData.instance?.cleanup) {
        await moduleData.instance.cleanup();
      }

      // 새 인스턴스 생성 및 초기화
      const ModuleClass = require(moduleData.config.path);
      const newInstance = new ModuleClass();

      if (this.bot) {
        newInstance.bot = this.bot;
      }

      await newInstance.initialize();

      // 데이터 업데이트
      moduleData.instance = newInstance;
      moduleData.status = "initialized";
      moduleData.errorCount = 0;
      moduleData.lastError = null;
      moduleData.loadTime = new Date();

      this.moduleInstances.set(moduleName.toLowerCase(), newInstance);

      Logger.success(`✅ 모듈 ${moduleName} 재시작 완료`);
      return true;
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 재시작 실패:`, error);
      return false;
    }
  }

  // 🔧 모듈 핫 리로드 (개발용)
  async hotReloadModule(moduleName) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("프로덕션 환경에서는 핫 리로드를 사용할 수 없습니다");
    }

    try {
      Logger.info(`🔥 모듈 ${moduleName} 핫 리로드 중...`);

      const moduleData = this.modules.get(moduleName);
      if (!moduleData) {
        throw new Error(`모듈 ${moduleName}을 찾을 수 없습니다`);
      }

      // require 캐시 삭제
      const modulePath = require.resolve(moduleData.config.path);
      delete require.cache[modulePath];

      // 모듈 재시작
      return await this.restartModule(moduleName);
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 핫 리로드 실패:`, error);
      return false;
    }
  }

  // 🧪 헬스 체크
  async healthCheck() {
    const health = {
      status: "healthy",
      timestamp: new Date(),
      checks: {
        database: false,
        modules: {},
        memory: process.memoryUsage(),
        uptime: Date.now() - this.globalStats.startTime.getTime(),
      },
    };

    try {
      // 데이터베이스 상태 확인
      health.checks.database = await this.db.isHealthy();

      // 모듈 상태 확인
      for (const [moduleName, moduleData] of this.modules.entries()) {
        health.checks.modules[moduleName] = {
          status: moduleData.status,
          healthy:
            moduleData.status === "initialized" && moduleData.errorCount < 5,
          errorCount: moduleData.errorCount,
        };

        if (!health.checks.modules[moduleName].healthy) {
          health.status = "degraded";
        }
      }

      // 메모리 사용량 확인
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 512 * 1024 * 1024) {
        // 512MB 초과
        health.status = "warning";
        health.warnings = health.warnings || [];
        health.warnings.push("높은 메모리 사용량");
      }

      // 에러율 확인
      const errorRate =
        this.globalStats.totalRequests > 0
          ? (this.globalStats.errors / this.globalStats.totalRequests) * 100
          : 0;

      if (errorRate > 5) {
        // 5% 초과
        health.status = "warning";
        health.warnings = health.warnings || [];
        health.warnings.push(`높은 에러율: ${errorRate.toFixed(2)}%`);
      }

      return health;
    } catch (error) {
      Logger.error("❌ 헬스 체크 실패:", error);
      return {
        status: "unhealthy",
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  // 📊 성능 메트릭 수집
  async collectMetrics() {
    const metrics = {
      timestamp: new Date(),
      global: this.getGlobalStats(),
      modules: {},
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
      },
      database: this.db.getStats(),
    };

    // 각 모듈 메트릭 수집
    for (const [moduleName, moduleData] of this.modules.entries()) {
      if (moduleData.instance?.getStatus) {
        metrics.modules[moduleName] = moduleData.instance.getStatus();
      }
    }

    // 데이터베이스에 저장 (선택적)
    try {
      await this.db.insertOne("performance_metrics", metrics);
    } catch (error) {
      Logger.debug("📊 메트릭 저장 실패 (무시됨):", error.message);
    }

    return metrics;
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
          if (moduleData.instance?.cleanup) {
            await moduleData.instance.cleanup();
          }
        } catch (error) {
          Logger.error(`❌ 모듈 ${moduleName} 정리 오류:`, error);
        }
      }

      // ErrorHandler 정리
      if (this.errorHandler) {
        this.errorHandler.cleanup();
      }

      Logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      Logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }

  // 🔍 디버그 정보
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      moduleCount: this.modules.size,
      processingCallbacks: this.processingCallbacks.size,
      processingMessages: this.processingMessages.size,
      globalUserStates: this.globalUserStates.size,
      stats: this.getGlobalStats(),
      modules: this.getAllModuleStatus(),
      database: this.db.getStats(),
    };
  }

  // 🔍 모듈 확인 메서드들 (MenuManager 호환)
  hasModule(moduleName) {
    const moduleData = this.modules.get(moduleName);
    return moduleData && moduleData.status === "initialized";
  }

  getModule(moduleName) {
    const moduleData = this.modules.get(moduleName);
    return moduleData?.status === "initialized" ? moduleData.instance : null;
  }

  isModuleEnabled(moduleName) {
    return this.hasModule(moduleName);
  }

  // 🚨 알림 시스템 (필요시 확장)
  async sendAlert(level, message, details = {}) {
    const alert = {
      level, // 'info', 'warning', 'error', 'critical'
      message,
      details,
      timestamp: new Date(),
      module: "ModuleManager",
    };

    Logger[level === "critical" ? "error" : level](
      `🚨 알림 [${level.toUpperCase()}]: ${message}`,
      details
    );

    // 필요시 외부 알림 서비스 연동 (Discord, Slack 등)
    // await this.notificationService.send(alert);
  }
}

module.exports = ModuleManager;
