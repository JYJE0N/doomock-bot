// src/managers/ModuleManager.js - 누락된 메서드 구현 (리팩토링 v3)

const Logger = require("../utils/Logger");
const path = require("path");
const fs = require("fs");

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

  // ✅ 메인 초기화 메서드
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
      if (!this.db || !(await this.db.isHealthy())) {
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

  // ✅ 모듈 로드 구현
  async _loadModules() {
    Logger.info("📦 모듈 로드 시작...");

    try {
      // 모듈 설정 가져오기
      const ModuleConfig = require("../config/ModuleConfig");
      const moduleConfigs = ModuleConfig.getModuleConfigs();

      let loadedCount = 0;
      let failedCount = 0;

      for (const [moduleName, config] of Object.entries(moduleConfigs)) {
        try {
          // 활성화된 모듈만 로드
          if (!config.enabled) {
            Logger.debug(`⏭️ ${moduleName} 비활성화됨, 건너뛰기`);
            continue;
          }

          // 모듈 경로 확인
          const modulePath = path.resolve(__dirname, config.path);

          // 파일 존재 확인
          if (!fs.existsSync(modulePath + ".js")) {
            Logger.warn(
              `⚠️ ${moduleName} 파일이 존재하지 않음: ${modulePath}.js`
            );
            failedCount++;
            continue;
          }

          // 모듈 클래스 로드
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

          loadedCount++;
          Logger.debug(`✅ ${moduleName} 로드 완료`);
        } catch (error) {
          failedCount++;
          Logger.error(`❌ ${moduleName} 로드 실패:`, error.message);

          // 필수 모듈인 경우 에러 발생
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

      // 최소 1개 모듈은 로드되어야 함
      if (loadedCount === 0) {
        Logger.warn(
          "⚠️ 로드된 모듈이 없습니다. 기본 모듈을 추가로 확인합니다."
        );
        await this._loadFallbackModules();
      }
    } catch (error) {
      Logger.error("❌ 모듈 로드 중 오류:", error);
      throw error;
    }
  }

  // ✅ 폴백 모듈 로드 (최소 기능 보장)
  async _loadFallbackModules() {
    Logger.info("🆘 폴백 모듈 로드 시도...");

    // 간단한 메뉴 모듈만이라도 로드
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
          async handleCommand() {
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

  // ✅ 모듈 초기화 구현
  async _initializeModules() {
    Logger.info("🔧 모듈 초기화 시작...");

    let initializedCount = 0;
    let failedCount = 0;

    // 우선순위 순으로 정렬
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

        // 인스턴스 생성
        const moduleInstance = new moduleData.class(this.bot, {
          db: this.db,
          moduleManager: this,
        });

        // 초기화 실행
        if (typeof moduleInstance.initialize === "function") {
          await moduleInstance.initialize();
        }

        // 인스턴스 저장
        moduleData.instance = moduleInstance;
        moduleData.isInitialized = true;
        this.moduleInstances.set(moduleName, moduleInstance);

        initializedCount++;
        Logger.success(`✅ ${moduleName} 초기화 완료`);
      } catch (error) {
        failedCount++;
        Logger.error(`❌ ${moduleName} 초기화 실패:`, error.message);

        // 필수 모듈인 경우 에러 발생
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

  async routeMessage(bot, msg) {
    const startTime = Date.now();
    const userId = msg.from.id;
    const messageKey = `${userId}_${msg.message_id}`;

    // 중복 처리 방지
    if (this.processingMessages.has(messageKey)) {
      this.globalStats.duplicateMessages++;
      Logger.debug(`중복 메시지 무시: ${messageKey}`);
      return false;
    }

    this.processingMessages.add(messageKey);
    this.globalStats.totalMessages++;
    this.globalStats.uniqueUsers.add(userId);

    try {
      // 각 모듈에게 순서대로 처리 기회 제공
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (!moduleData.isInitialized || !moduleData.instance) continue;

        try {
          // ✅ 표준 메서드 handleMessage 호출 (processMessage 대신)
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
      // 처리 완료 후 정리
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, 5000);

      // 응답 시간 업데이트
      this._updateResponseTime(startTime);
    }
  }

  // ✅ 콜백 처리 (표준화된 매개변수)
  async handleCallback(bot, callbackQuery) {
    return await this.routeCallback(bot, callbackQuery);
  }

  // 📨 메시지 라우팅
  async routeMessage(bot, msg) {
    const startTime = Date.now();
    const userId = msg.from.id;
    const messageKey = `${userId}_${msg.message_id}`;

    // 중복 처리 방지
    if (this.processingMessages.has(messageKey)) {
      this.globalStats.duplicateMessages++;
      Logger.debug(`중복 메시지 무시: ${messageKey}`);
      return false;
    }

    this.processingMessages.add(messageKey);
    this.globalStats.totalMessages++;
    this.globalStats.uniqueUsers.add(userId);

    try {
      // 각 모듈에게 순서대로 처리 기회 제공
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
      // 처리 완료 후 정리
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, 5000);

      // 응답 시간 업데이트
      this._updateResponseTime(startTime);
    }
  }

  // 📞 콜백 라우팅
  async routeCallback(bot, callbackQuery) {
    const startTime = Date.now();
    const userId = callbackQuery.from.id;
    const callbackKey = `${userId}_${callbackQuery.data}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      this.globalStats.duplicateCallbacks++;
      Logger.debug(`중복 콜백 무시: ${callbackKey}`);
      return false;
    }

    this.processingCallbacks.add(callbackKey);
    this.globalStats.totalCallbacks++;
    this.globalStats.uniqueUsers.add(userId);

    try {
      // 콜백 데이터 파싱
      const routeInfo = this._parseCallbackData(callbackQuery.data);

      if (routeInfo) {
        // 해당 모듈로 라우팅
        const moduleData = this.modules.get(routeInfo.module + "Module");
        if (moduleData?.isInitialized && moduleData.instance) {
          try {
            // ✅ 표준화된 매개변수로 handleCallback 호출 (processCallback 대신)
            const handled = await moduleData.instance.handleCallback?.(
              bot,
              callbackQuery,
              routeInfo.subAction,
              routeInfo.params,
              this
            );

            if (handled) {
              this.globalStats.successfulCallbacks++;
              Logger.debug(`📞 콜백 처리 완료: ${routeInfo.module}`);
              return true;
            }
          } catch (error) {
            Logger.error(`❌ ${routeInfo.module} 콜백 처리 오류:`, error);
            this.globalStats.moduleErrors.set(
              routeInfo.module,
              (this.globalStats.moduleErrors.get(routeInfo.module) || 0) + 1
            );
          }
        }
      }

      // 모든 모듈에게 처리 기회 제공
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (!moduleData.isInitialized || !moduleData.instance) continue;

        try {
          // ✅ 표준화된 매개변수로 handleCallback 호출
          const handled = await moduleData.instance.handleCallback?.(
            bot,
            callbackQuery,
            null,
            {},
            this
          );
          if (handled) {
            this.globalStats.successfulCallbacks++;
            Logger.debug(`📞 콜백 처리 완료: ${moduleName}`);
            return true;
          }
        } catch (error) {
          Logger.error(`❌ ${moduleName} 콜백 처리 오류:`, error);
        }
      }

      this.globalStats.unhandledCallbacks++;
      Logger.debug("📞 처리되지 않은 콜백");
      return false;
    } catch (error) {
      this.globalStats.errorCallbacks++;
      Logger.error("❌ 콜백 라우팅 오류:", error);
      await this.errorHandler.handleError(error, {
        type: "callback_routing",
        userId: userId,
        module: "ModuleManager",
      });
      return false;
    } finally {
      // 처리 완료 후 정리
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);

      // 응답 시간 업데이트
      this._updateResponseTime(startTime);
    }
  }

  // 🎯 콜백 데이터 파싱
  _parseCallbackData(callbackData) {
    for (const [pattern, parser] of this.routingRules.entries()) {
      const match = callbackData.match(pattern);
      if (match) {
        return parser(match, callbackData);
      }
    }
    return null;
  }

  // 📊 응답 시간 업데이트
  _updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    this.globalStats.averageResponseTime =
      (this.globalStats.averageResponseTime + responseTime) / 2;
    Logger.debug(`응답 시간: ${responseTime}ms`);
  }

  // 🔍 모듈 상태 확인
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
