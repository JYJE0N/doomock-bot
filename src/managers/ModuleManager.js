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
