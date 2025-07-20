// src/managers/ModuleManager.js - 캐시 안전 로딩

const logger = require("../utils/Logger");
const path = require("path");
const fs = require("fs");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.options = options;

    // 상태 관리 (단순화)
    this.modules = new Map();
    this.isInitialized = false;
    this.isInitializing = false; // 새로 추가

    // 중복 방지 강화
    this.loadingLock = new Set();

    logger.info("🔧 ModuleManager 생성됨");
  }

  // ✅ 원자적 초기화 (중복 방지 강화)
  async initialize() {
    // 이미 초기화됨
    if (this.isInitialized) {
      logger.debug("ModuleManager 이미 초기화됨");
      return true;
    }

    // 초기화 진행 중
    if (this.isInitializing) {
      logger.debug("ModuleManager 초기화 진행 중... 대기");
      // 초기화 완료까지 폴링 대기
      while (this.isInitializing && !this.isInitialized) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.isInitialized;
    }

    // 초기화 시작
    this.isInitializing = true;

    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 1단계: 한 번만 캐시 정리
      await this._performOneTimeCacheClean();

      // 2단계: 모듈 로드 (중복 체크 강화)
      await this._loadModulesWithLock();

      // 3단계: 모듈 초기화
      await this._initializeLoadedModules();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );

      return true;
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // ✅ 단 한 번만 실행되는 캐시 정리
  async _performOneTimeCacheClean() {
    if (this._cacheCleanCompleted) {
      logger.debug("캐시 정리 이미 완료됨");
      return;
    }

    try {
      logger.info("🗑️ require 캐시 일괄 정리...");

      const modulePaths = [
        "../modules/SystemModule",
        "../modules/TodoModule",
        "../modules/FortuneModule",
        "../modules/WeatherModule",
        "../modules/UtilsModule",
      ];

      let cleanedCount = 0;

      for (const modulePath of modulePaths) {
        try {
          const fullPath = path.resolve(__dirname, modulePath + ".js");

          if (fs.existsSync(fullPath)) {
            const resolvedPath = require.resolve(fullPath);

            if (require.cache[resolvedPath]) {
              delete require.cache[resolvedPath];
              cleanedCount++;
              logger.debug(`🗑️ ${path.basename(modulePath)} 캐시 정리`);
            }
          }
        } catch (error) {
          logger.warn(`캐시 정리 부분 실패: ${modulePath}`, error.message);
        }
      }

      this._cacheCleanCompleted = true;
      logger.success(`✅ 캐시 정리 완료: ${cleanedCount}개`);
    } catch (error) {
      logger.error("❌ 캐시 정리 실패:", error);
      // 치명적이지 않으므로 계속 진행
    }
  }

  // ✅ 중복 방지 모듈 로딩
  async _loadModulesWithLock() {
    logger.info("📦 모듈 로드 시작 (중복 방지)");

    // 하드코딩된 모듈 목록 (의존성 순서)
    const moduleConfigs = {
      SystemModule: {
        enabled: true,
        required: true,
        path: "../modules/SystemModule",
      },
      TodoModule: {
        enabled: true,
        required: false,
        path: "../modules/TodoModule",
      },
      FortuneModule: {
        enabled: true,
        required: false,
        path: "../modules/FortuneModule",
      },
      WeatherModule: {
        enabled: true,
        required: false,
        path: "../modules/WeatherModule",
      },
      UtilsModule: {
        enabled: true,
        required: false,
        path: "../modules/UtilsModule",
      },
    };

    let loadedCount = 0;
    let skippedCount = 0;

    for (const [moduleName, config] of Object.entries(moduleConfigs)) {
      // 중복 로드 방지
      if (this.modules.has(moduleName)) {
        logger.debug(`⏭️ ${moduleName} 이미 로드됨, 건너뛰기`);
        skippedCount++;
        continue;
      }

      // 로딩 락 체크
      if (this.loadingLock.has(moduleName)) {
        logger.warn(`🔒 ${moduleName} 로딩 중, 건너뛰기`);
        continue;
      }

      if (!config.enabled) {
        logger.debug(`⏭️ ${moduleName} 비활성화됨`);
        continue;
      }

      // 로딩 락 설정
      this.loadingLock.add(moduleName);

      try {
        const success = await this._loadSingleModuleSafe(moduleName, config);
        if (success) {
          loadedCount++;
          logger.debug(`✅ ${moduleName} 로드 성공`);
        }
      } catch (error) {
        logger.error(`❌ ${moduleName} 로드 실패:`, error.message);
        if (config.required) {
          throw new Error(`필수 모듈 ${moduleName} 로드 실패`);
        }
      } finally {
        // 로딩 락 해제
        this.loadingLock.delete(moduleName);
      }
    }

    logger.success(
      `📦 모듈 로드 완료: ${loadedCount}개 성공, ${skippedCount}개 건너뜀`
    );

    // 로드된 모듈이 없으면 폴백
    if (loadedCount === 0) {
      await this._createFallbackSystemModule();
    }
  }

  // ✅ 안전한 단일 모듈 로드 (캐시 정리 없음!)
  async _loadSingleModuleSafe(moduleName, config) {
    try {
      const modulePath = path.resolve(__dirname, config.path);

      // 파일 존재 확인
      if (!fs.existsSync(modulePath + ".js")) {
        logger.warn(`⚠️ ${moduleName} 파일 없음: ${modulePath}.js`);
        return false;
      }

      // ❌ 여기서는 캐시 정리하지 않음! (이미 _performOneTimeCacheClean에서 처리됨)

      // 모듈 클래스 로드
      const ModuleClass = require(modulePath);

      if (typeof ModuleClass !== "function") {
        throw new Error(`${moduleName}은 유효한 클래스가 아님`);
      }

      // 모듈 등록 (중복 체크)
      if (!this.modules.has(moduleName)) {
        this.modules.set(moduleName, {
          name: moduleName,
          config: config,
          class: ModuleClass,
          instance: null,
          isLoaded: true,
          isInitialized: false,
          loadTime: new Date(),
        });
      }

      return true;
    } catch (error) {
      logger.error(`${moduleName} 로드 실패:`, error.message);
      return false;
    }
  }

  // ✅ 로드된 모듈들 초기화
  async _initializeLoadedModules() {
    logger.info("🔄 모듈 초기화 시작");

    let initializedCount = 0;

    for (const [moduleName, moduleData] of this.modules.entries()) {
      if (moduleData.isInitialized) {
        logger.debug(`⏭️ ${moduleName} 이미 초기화됨`);
        continue;
      }

      try {
        // 인스턴스 생성
        if (!moduleData.instance) {
          moduleData.instance = new moduleData.class(this.bot, {
            moduleManager: this,
          });
        }

        // 초기화 실행
        if (typeof moduleData.instance.initialize === "function") {
          await moduleData.instance.initialize();
        }

        moduleData.isInitialized = true;
        initializedCount++;
        logger.debug(`✅ ${moduleName} 초기화 완료`);
      } catch (error) {
        logger.error(`❌ ${moduleName} 초기화 실패:`, error.message);

        // 필수 모듈 실패 시 예외 발생
        if (moduleData.config.required) {
          throw new Error(`필수 모듈 ${moduleName} 초기화 실패`);
        }
      }
    }

    logger.success(`🔄 모듈 초기화 완료: ${initializedCount}개`);
  }

  // ✅ 폴백 시스템 모듈 (최소 기능)
  async _createFallbackSystemModule() {
    logger.info("🆘 폴백 SystemModule 생성");

    const FallbackSystemModule = class {
      constructor(bot, options = {}) {
        this.name = "SystemModule";
        this.bot = bot;
        this.moduleManager = options.moduleManager;
        this.isInitialized = false;
      }

      async initialize() {
        this.isInitialized = true;
        logger.info("✅ 폴백 SystemModule 초기화됨");
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
      config: { enabled: true, required: true },
      class: FallbackSystemModule,
      instance: new FallbackSystemModule(this.bot, { moduleManager: this }),
      isLoaded: true,
      isInitialized: false,
      loadTime: new Date(),
    });

    // 즉시 초기화
    await this.modules.get("SystemModule").instance.initialize();
    this.modules.get("SystemModule").isInitialized = true;
  }

  // ✅ 정리 작업
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작");

    try {
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
          logger.error(`${moduleName} 정리 실패:`, error);
        }
      }

      // 상태 초기화
      this.modules.clear();
      this.loadingLock.clear();
      this.isInitialized = false;
      this.isInitializing = false;
      this._cacheCleanCompleted = false;

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
