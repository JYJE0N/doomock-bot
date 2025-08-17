// src/core/ModuleLoader.js - 모듈 지연 로딩 시스템

const logger = require("../utils/core/Logger");
const CacheManager = require("../utils/core/CacheManager");

/**
 * 🚀 ModuleLoader - 모듈 지연 로딩 및 코드 분할 시스템
 *
 * 특징:
 * - 동적 모듈 로딩
 * - 메모리 효율성 최적화
 * - 사용 패턴 기반 예측 로딩
 * - 모듈 캐싱 및 언로딩
 */
class ModuleLoader {
  constructor() {
    this.loadedModules = new Map();
    this.moduleStats = new Map();
    this.preloadQueue = new Set();
    this.cache = CacheManager.getInstance();

    // 지연 로딩 설정 (수정됨)
    this.config = {
      maxLoadedModules: 8, // 동시 로드 모듈 수 제한 (확대)
      preloadThreshold: 2, // n회 사용 후 예측 로딩 (축소)
      unloadTimeout: 1800000, // 30분 후 미사용 모듈 언로드 (5분→30분)
      enablePreloading: true,
      cleanupInterval: 600000 // 10분마다 정리 체크 (기존 5분)
    };

    // 사용 통계 추적
    this.usageStats = new Map();
    this.lastAccess = new Map();

    logger.info("🚀 ModuleLoader 초기화 완료");
  }

  /**
   * 모듈 동적 로딩 - V2 모듈 생성자 옵션 지원
   */
  async loadModule(modulePath, moduleKey, constructorOptions = {}) {
    try {
      const startTime = Date.now();

      // 이미 로드된 모듈 확인
      if (this.loadedModules.has(moduleKey)) {
        this.updateAccessTime(moduleKey);
        logger.debug(`📦 캐시된 모듈 반환: ${moduleKey}`);
        return this.loadedModules.get(moduleKey);
      }

      // 메모리 제한 확인
      if (this.loadedModules.size >= this.config.maxLoadedModules) {
        await this.unloadLeastUsedModule();
      }

      logger.debug(`🔄 모듈 동적 로딩 시작: ${moduleKey}`);

      // 동적 import 사용
      const ModuleClass = require(modulePath);

      // V2 모듈 생성자 옵션 준비
      const moduleOptions = {
        ...constructorOptions,
        // V2 모듈은 첫 번째 인자로 moduleKey를 받음
        moduleKey: moduleKey
      };

      // 모듈 인스턴스 생성
      let moduleInstance;
      try {
        // V2 모듈 방식 (moduleName, options)
        moduleInstance = new ModuleClass(moduleKey, moduleOptions);
        logger.debug(`📦 V2 모듈 생성: ${moduleKey}`);
      } catch (v2Error) {
        try {
          // V1 모듈 방식 (options만)
          moduleInstance = new ModuleClass(moduleOptions);
          logger.debug(`📦 V1 모듈 생성: ${moduleKey}`);
        } catch (v1Error) {
          // 옵션 없는 기본 생성자
          moduleInstance = new ModuleClass();
          logger.debug(`📦 기본 모듈 생성: ${moduleKey}`);
        }
      }

      // 캐시에 저장
      this.loadedModules.set(moduleKey, moduleInstance);

      // 통계 업데이트
      const loadTime = Date.now() - startTime;
      this.updateModuleStats(moduleKey, loadTime);
      this.updateAccessTime(moduleKey);

      logger.success(`✅ 모듈 로딩 완료: ${moduleKey} (${loadTime}ms)`);

      // 사용 패턴 기반 예측 로딩
      if (this.config.enablePreloading) {
        this.schedulePreloading(moduleKey);
      }

      return moduleInstance;
    } catch (error) {
      logger.error(`❌ 모듈 로딩 실패: ${moduleKey}`, error);
      throw new Error(`모듈 로딩 실패: ${moduleKey} - ${error.message}`);
    }
  }

  /**
   * 모듈 초기화 (지연 초기화) - 옵션 전달 개선
   */
  async initializeModule(
    moduleInstance,
    moduleKey,
    serviceBuilder,
    options = {}
  ) {
    try {
      if (moduleInstance.isInitialized) {
        return moduleInstance;
      }

      const startTime = Date.now();
      logger.debug(`🎯 모듈 초기화 시작: ${moduleKey}`);

      // 중요: 모든 V2 모듈에 필요한 옵션들 설정
      if (moduleInstance.setServiceBuilder && serviceBuilder) {
        moduleInstance.setServiceBuilder(serviceBuilder);
      }

      // serviceBuilder 직접 할당 (V2 모듈용)
      if (serviceBuilder && !moduleInstance.serviceBuilder) {
        moduleInstance.serviceBuilder = serviceBuilder;
      }

      // bot 인스턴스 설정
      if (options.bot && !moduleInstance.bot) {
        moduleInstance.bot = options.bot;
      }

      // moduleManager 설정
      if (options.moduleManager && !moduleInstance.moduleManager) {
        moduleInstance.moduleManager = options.moduleManager;
      }

      // EventBus 설정 (V2 모듈용)
      if (options.eventBus && !moduleInstance.eventBus) {
        moduleInstance.eventBus = options.eventBus;
      }

      // 설정 객체 병합
      if (options.config && moduleInstance.config) {
        moduleInstance.config = { ...moduleInstance.config, ...options.config };
      }

      // 초기화 실행
      if (typeof moduleInstance.initialize === "function") {
        await moduleInstance.initialize();
      }

      // 초기화 상태 확인 및 설정
      if (!moduleInstance.isInitialized) {
        moduleInstance.isInitialized = true;
      }

      const initTime = Date.now() - startTime;
      logger.success(`✅ 모듈 초기화 완료: ${moduleKey} (${initTime}ms)`);

      return moduleInstance;
    } catch (error) {
      logger.error(`❌ 모듈 초기화 실패: ${moduleKey}`, error);
      throw error;
    }
  }

  /**
   * 가장 적게 사용된 모듈 언로드
   */
  async unloadLeastUsedModule() {
    if (this.loadedModules.size === 0) return;

    let leastUsedKey = null;
    let oldestAccess = Date.now();

    // 가장 오래된 접근 시간 찾기
    for (const [key, time] of this.lastAccess) {
      if (time < oldestAccess) {
        oldestAccess = time;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      await this.unloadModule(leastUsedKey);
    }
  }

  /**
   * 모듈 언로드
   */
  async unloadModule(moduleKey) {
    try {
      const moduleInstance = this.loadedModules.get(moduleKey);

      if (moduleInstance) {
        // 정리 작업 실행
        if (typeof moduleInstance.cleanup === "function") {
          await moduleInstance.cleanup();
        }

        this.loadedModules.delete(moduleKey);
        this.lastAccess.delete(moduleKey);

        logger.info(`🗑️ 모듈 언로드 완료: ${moduleKey}`);
      }
    } catch (error) {
      logger.error(`❌ 모듈 언로드 실패: ${moduleKey}`, error);
    }
  }

  /**
   * 사용 패턴 기반 예측 로딩
   */
  schedulePreloading(currentModule) {
    const usage = this.usageStats.get(currentModule) || {
      count: 0,
      related: new Set()
    };

    // 사용 빈도가 임계값을 넘으면 관련 모듈 예측 로딩
    if (usage.count >= this.config.preloadThreshold) {
      const relatedModules = this.getRelatedModules(currentModule);

      relatedModules.forEach((moduleKey) => {
        if (
          !this.loadedModules.has(moduleKey) &&
          !this.preloadQueue.has(moduleKey)
        ) {
          this.preloadQueue.add(moduleKey);

          // 비동기로 예측 로딩
          setImmediate(() => {
            this.preloadModule(moduleKey);
          });
        }
      });
    }
  }

  /**
   * 모듈 예측 로딩
   */
  async preloadModule(moduleKey) {
    try {
      if (this.loadedModules.size >= this.config.maxLoadedModules) {
        return; // 메모리 제한으로 예측 로딩 건너뛰기
      }

      const moduleRegistry = require("../config/ModuleRegistry");
      const moduleConfig = moduleRegistry.getModuleConfig(moduleKey);

      if (moduleConfig && moduleConfig.enabled) {
        logger.debug(`🔮 예측 로딩 시작: ${moduleKey}`);

        // 예측 로딩은 기본 옵션만 전달 (나중에 온디맨드에서 완전히 초기화)
        await this.loadModule(moduleConfig.path, moduleKey, {
          preload: true, // 예측 로딩 표시
          config: moduleConfig.config || {}
        });
      }
    } catch (error) {
      logger.debug(`예측 로딩 실패 (무시): ${moduleKey}`, error.message);
    } finally {
      this.preloadQueue.delete(moduleKey);
    }
  }

  /**
   * 관련 모듈 추론 (간단한 휴리스틱)
   */
  getRelatedModules(moduleKey) {
    const relationMap = {
      timer: ["worktime"],
      worktime: ["timer", "leave"],
      leave: ["worktime"],
      todo: ["timer"],
      weather: ["fortune"],
      fortune: ["weather"]
    };

    return relationMap[moduleKey] || [];
  }

  /**
   * 접근 시간 업데이트
   */
  updateAccessTime(moduleKey) {
    this.lastAccess.set(moduleKey, Date.now());

    // 사용 통계 업데이트
    const usage = this.usageStats.get(moduleKey) || {
      count: 0,
      lastUsed: Date.now()
    };
    usage.count++;
    usage.lastUsed = Date.now();
    this.usageStats.set(moduleKey, usage);
  }

  /**
   * 모듈 통계 업데이트
   */
  updateModuleStats(moduleKey, loadTime) {
    const stats = this.moduleStats.get(moduleKey) || {
      loadCount: 0,
      totalLoadTime: 0,
      avgLoadTime: 0
    };

    stats.loadCount++;
    stats.totalLoadTime += loadTime;
    stats.avgLoadTime = Math.round(stats.totalLoadTime / stats.loadCount);

    this.moduleStats.set(moduleKey, stats);
  }

  /**
   * 미사용 모듈 자동 정리
   */
  startAutoCleanup() {
    // 🔧 수정: 더 안전한 정리 주기와 로직
    setInterval(async () => {
      const now = Date.now();
      const unloadTargets = [];

      for (const [moduleKey, lastAccessTime] of this.lastAccess) {
        // 핵심 모듈들은 언로드하지 않음 (보호 목록)
        const protectedModules = ["system", "navigation", "error", "base"];
        if (protectedModules.includes(moduleKey)) {
          continue;
        }

        if (now - lastAccessTime > this.config.unloadTimeout) {
          unloadTargets.push(moduleKey);
        }
      }

      // 최대 3개까지만 한 번에 정리 (급격한 정리 방지)
      const safeUnloadTargets = unloadTargets.slice(0, 3);

      for (const moduleKey of safeUnloadTargets) {
        try {
          await this.unloadModule(moduleKey);
          logger.debug(
            `🗑️ 모듈 언로드 완료: ${moduleKey} (${Math.round((now - this.lastAccess.get(moduleKey)) / 60000)}분 미사용)`
          );
        } catch (error) {
          logger.warn(`⚠️ 모듈 언로드 실패: ${moduleKey}`, error.message);
        }
      }

      if (safeUnloadTargets.length > 0) {
        logger.info(`🧹 ${safeUnloadTargets.length}개 미사용 모듈 자동 정리`);
      }
    }, this.config.cleanupInterval); // 10분마다 실행
  }

  /**
   * 모든 모듈 강제 언로드
   */
  async unloadAllModules() {
    const moduleKeys = Array.from(this.loadedModules.keys());

    for (const moduleKey of moduleKeys) {
      await this.unloadModule(moduleKey);
    }

    logger.info(`🧹 전체 모듈 언로드 완료 (${moduleKeys.length}개)`);
  }

  /**
   * 통계 조회
   */
  getStats() {
    const loadedModulesList = Array.from(this.loadedModules.keys());
    const totalUsage = Array.from(this.usageStats.values()).reduce(
      (sum, stats) => sum + stats.count,
      0
    );

    return {
      loadedModules: {
        count: this.loadedModules.size,
        maxAllowed: this.config.maxLoadedModules,
        modules: loadedModulesList
      },
      performance: {
        totalUsage,
        avgLoadTime: this.getAverageLoadTime(),
        preloadQueue: this.preloadQueue.size
      },
      memory: {
        usedSlots: this.loadedModules.size,
        maxSlots: this.config.maxLoadedModules,
        usage: `${Math.round((this.loadedModules.size / this.config.maxLoadedModules) * 100)}%`
      },
      moduleStats: Object.fromEntries(this.moduleStats)
    };
  }

  /**
   * 평균 로딩 시간 계산
   */
  getAverageLoadTime() {
    const stats = Array.from(this.moduleStats.values());
    if (stats.length === 0) return 0;

    const totalAvg = stats.reduce((sum, stat) => sum + stat.avgLoadTime, 0);
    return Math.round(totalAvg / stats.length);
  }

  /**
   * 싱글톤 인스턴스
   */
  static getInstance() {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
  }
}

// 싱글톤 인스턴스
ModuleLoader.instance = null;

module.exports = ModuleLoader;
