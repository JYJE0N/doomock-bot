// src/core/ModuleManager.js - 중복 초기화 및 타이밍 문제 해결 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const ServiceBuilder = require("./ServiceBuilder");

/**
 * 📦 ModuleManager v3.0.1 - 초기화 문제 해결
 *
 * 🎯 해결된 문제들:
 * 1. 중복 초기화 방지 (Singleton Pattern)
 * 2. ServiceBuilder 타이밍 동기화
 * 3. DB 연결 대기 로직 추가
 * 4. 서비스 준비 상태 확인
 * 5. 안전한 백오프 재시도
 */
class ModuleManager {
  constructor(options = {}) {
    // 🔒 Singleton 패턴으로 중복 방지
    if (ModuleManager.instance) {
      logger.warn("⚠️ ModuleManager 이미 존재 - 기존 인스턴스 반환");
      return ModuleManager.instance;
    }

    // 🤖 봇 인스턴스 (모듈 생성용)
    this.bot = options.bot;

    // 🏗️ ServiceBuilder 연동 (핵심!)
    this.serviceBuilder = options.serviceBuilder || ServiceBuilder;

    // ⚙️ 설정 (모듈 관련만)
    this.config = {
      enableAutoDiscovery: options.config?.enableAutoDiscovery !== false,
      moduleTimeout: options.config?.moduleTimeout || 30000,
      maxRetries: options.config?.maxRetries || 3,
      enableHealthCheck: options.config?.enableHealthCheck !== false,
      cleanupInterval: options.config?.cleanupInterval || 300000,
      // 🔧 새로운 설정들 - 초기화 문제 해결용
      dbWaitTimeout: options.config?.dbWaitTimeout || 60000, // DB 대기 시간
      serviceWaitTimeout: options.config?.serviceWaitTimeout || 30000, // 서비스 대기
      retryBackoffMs: options.config?.retryBackoffMs || 2000, // 재시도 간격
      maxInitRetries: options.config?.maxInitRetries || 5, // 최대 재시도
      ...options.config,
    };

    // 📋 모듈 레지스트리 및 인스턴스 (순수 모듈만)
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.moduleLoadOrder = [];

    // 🔒 중복 처리 방지 (강화됨)
    this.processingCallbacks = new Set();
    this.initializingModules = new Set();
    this.initializedModules = new Set(); // 초기화 완료 추적

    // 📊 모듈 전용 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      retryAttempts: 0,
      dbWaitTime: 0,
      serviceWaitTime: 0,
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      averageCallbackTime: 0,
      averageInitTime: 0,
      loadSuccessRate: 0,
      lastActivity: null,
      initializationTime: null,
    };

    // 🔄 초기화 상태 (강화됨)
    this.isInitialized = false;
    this.initializationInProgress = false;
    this.initializationRetries = 0;
    this.initializationStartTime = null;

    // 🧹 정리 스케줄러
    this.cleanupTimer = null;

    // 🔒 Singleton 설정
    ModuleManager.instance = this;

    logger.info("📦 ModuleManager v3.0.1 생성됨 (중복 방지, 초기화 문제 해결)");
  }

  /**
   * 🎯 모듈 매니저 초기화 (안전한 재시도 로직)
   */
  async initialize() {
    // 중복 초기화 완전 차단
    if (this.isInitialized) {
      logger.debug("✅ ModuleManager 이미 초기화 완료됨");
      return true;
    }

    if (this.initializationInProgress) {
      logger.debug("🔄 ModuleManager 초기화 진행 중 - 대기");
      return await this.waitForInitialization();
    }

    this.initializationInProgress = true;
    this.initializationStartTime = Date.now();

    try {
      logger.info("📦 ModuleManager v3.0.1 초기화 시작 (재시도 로직 포함)...");

      // 🛡️ 안전한 초기화 with 재시도
      await this.safeInitializeWithRetry();

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString();
      this.stats.initializationTime = Date.now() - this.initializationStartTime;

      logger.success(
        `✅ ModuleManager v3.0.1 초기화 완료 (${this.stats.activeModules}/${this.stats.totalModules}개 모듈, ${this.stats.initializationTime}ms)`
      );

      return true;
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 최종 실패:", error);
      this.stats.errorsCount++;
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * 🛡️ 안전한 초기화 with 백오프 재시도
   */
  async safeInitializeWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxInitRetries; attempt++) {
      try {
        logger.info(`🔄 초기화 시도 ${attempt}/${this.config.maxInitRetries}`);

        // 단계별 초기화
        await this.initializeStep1_Dependencies();
        await this.initializeStep2_Services();
        await this.initializeStep3_Modules();
        await this.initializeStep4_Finalize();

        logger.success(`✅ 초기화 성공 (${attempt}번째 시도)`);
        return; // 성공하면 바로 반환
      } catch (error) {
        lastError = error;
        this.stats.retryAttempts++;

        logger.warn(
          `⚠️ 초기화 실패 (${attempt}/${this.config.maxInitRetries}): ${error.message}`
        );

        if (attempt < this.config.maxInitRetries) {
          const backoffTime = this.config.retryBackoffMs * attempt;
          logger.info(`⏳ ${backoffTime}ms 대기 후 재시도...`);
          await this.sleep(backoffTime);
        }
      }
    }

    throw new Error(`최대 재시도 횟수 초과: ${lastError?.message}`);
  }

  /**
   * 🔧 1단계: 의존성 및 DB 대기
   */
  async initializeStep1_Dependencies() {
    logger.debug("🔧 1단계: 의존성 검증 및 DB 대기");

    // 기본 의존성 검증
    this.validateModuleDependencies();

    // DB 연결 대기 (중요!)
    await this.waitForDatabaseConnection();

    logger.debug("✅ 1단계 완료: 의존성 및 DB 준비됨");
  }

  /**
   * 🏗️ 2단계: ServiceBuilder 및 서비스 준비
   */
  async initializeStep2_Services() {
    logger.debug("🏗️ 2단계: ServiceBuilder 및 서비스 준비");

    // ServiceBuilder 초기화 확인
    await this.ensureServiceBuilderReady();

    // 핵심 서비스들 준비 대기
    await this.waitForCoreServices();

    logger.debug("✅ 2단계 완료: ServiceBuilder 및 서비스 준비됨");
  }

  /**
   * 📦 3단계: 모듈 등록 및 초기화
   */
  async initializeStep3_Modules() {
    logger.debug("📦 3단계: 모듈 등록 및 초기화");

    // 🔍 모듈 자동 감지 및 등록
    await this.discoverAndRegisterModules();

    // 🏗️ 모듈 인스턴스 생성 (ServiceBuilder 주입)
    await this.createModuleInstances();

    // 🎯 모듈 초기화 (안전한 방식)
    await this.initializeModulesSafely();

    logger.debug("✅ 3단계 완료: 모듈 등록 및 초기화 완료");
  }

  /**
   * 📊 4단계: 마무리 및 모니터링 시작
   */
  async initializeStep4_Finalize() {
    logger.debug("📊 4단계: 마무리 및 모니터링 시작");

    // 📊 통계 업데이트
    this.updateInitializationStats();

    // 🧹 정리 스케줄러 시작
    if (this.config.enableHealthCheck) {
      this.startCleanupScheduler();
    }

    logger.debug("✅ 4단계 완료: 마무리 및 모니터링 시작");
  }

  /**
   * 🗄️ DB 연결 대기 (핵심 해결책!)
   */
  async waitForDatabaseConnection() {
    const startTime = Date.now();
    const timeout = this.config.dbWaitTimeout;

    logger.info("🗄️ 데이터베이스 연결 대기 중...");

    while (Date.now() - startTime < timeout) {
      try {
        // DB Manager 확인 (여러 방식으로 체크)
        const dbManager = this.getDbManager();

        if (dbManager && dbManager.isConnected && dbManager.isConnected()) {
          this.stats.dbWaitTime = Date.now() - startTime;
          logger.success(`✅ DB 연결 확인 완료 (${this.stats.dbWaitTime}ms)`);
          return;
        }

        // 대기
        await this.sleep(1000);
      } catch (error) {
        logger.debug(`🔄 DB 연결 체크 중: ${error.message}`);
        await this.sleep(2000);
      }
    }

    throw new Error(`DB 연결 대기 시간 초과 (${timeout}ms)`);
  }

  /**
   * 🔧 핵심 서비스 준비 대기
   */
  async waitForCoreServices() {
    const startTime = Date.now();
    const timeout = this.config.serviceWaitTimeout;
    const coreServices = ["todo"]; // 필수 서비스들

    logger.info("🔧 핵심 서비스 준비 대기 중...");

    while (Date.now() - startTime < timeout) {
      try {
        let allReady = true;

        for (const serviceName of coreServices) {
          const service = await this.serviceBuilder.create(serviceName);
          if (!service || !service.isInitialized) {
            allReady = false;
            break;
          }
        }

        if (allReady) {
          this.stats.serviceWaitTime = Date.now() - startTime;
          logger.success(
            `✅ 핵심 서비스 준비 완료 (${this.stats.serviceWaitTime}ms)`
          );
          return;
        }

        await this.sleep(1000);
      } catch (error) {
        logger.debug(`🔄 서비스 준비 체크 중: ${error.message}`);
        await this.sleep(2000);
      }
    }

    logger.warn(
      `⚠️ 일부 서비스가 준비되지 않았지만 계속 진행 (${timeout}ms 초과)`
    );
  }

  /**
   * 🏗️ ServiceBuilder 준비 확인 (강화됨)
   */
  async ensureServiceBuilderReady() {
    try {
      if (!this.serviceBuilder) {
        logger.warn("⚠️ ServiceBuilder가 없어 기본 인스턴스 사용");
        this.serviceBuilder = ServiceBuilder;
      }

      // ServiceBuilder 초기화 확인
      if (!this.serviceBuilder.isInitialized) {
        logger.info("🏗️ ServiceBuilder 초기화 중...");
        await this.serviceBuilder.initialize();
      }

      // 추가 대기 시간 (안전성 확보)
      await this.sleep(1000);

      logger.debug("✅ ServiceBuilder 준비 완료");
    } catch (error) {
      logger.error("❌ ServiceBuilder 준비 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 모듈 초기화 (안전한 방식)
   */
  async initializeModulesSafely() {
    logger.info("🎯 모듈 안전 초기화 시작...");

    // 우선순위 순으로 정렬
    const moduleEntries = Array.from(this.moduleInstances.entries());
    const sortedModules = moduleEntries.sort(([, a], [, b]) => {
      const configA = this.moduleRegistry.get(a.constructor.name) || {
        priority: 999,
      };
      const configB = this.moduleRegistry.get(b.constructor.name) || {
        priority: 999,
      };
      return configA.priority - configB.priority;
    });

    for (const [moduleKey, moduleInstance] of sortedModules) {
      await this.initializeSingleModuleSafely(moduleKey, moduleInstance);
    }

    logger.info(`🎯 ${this.stats.activeModules}개 모듈 안전 초기화 완료`);
  }

  /**
   * 🔧 단일 모듈 안전 초기화
   */
  async initializeSingleModuleSafely(moduleKey, moduleInstance) {
    // 중복 초기화 완전 차단
    if (this.initializedModules.has(moduleKey)) {
      logger.debug(`✅ ${moduleKey} 이미 초기화 완료됨`);
      return;
    }

    if (this.initializingModules.has(moduleKey)) {
      logger.debug(`🔄 ${moduleKey} 초기화 진행 중 - 대기`);
      return;
    }

    const moduleConfig = this.moduleRegistry.get(moduleKey);
    this.initializingModules.add(moduleKey);
    const startTime = Date.now();

    try {
      logger.debug(`🔧 ${moduleConfig?.name || moduleKey} 안전 초기화 중...`);

      // 표준 초기화 메서드 호출 (재시도 로직 포함)
      if (
        moduleInstance.initialize &&
        typeof moduleInstance.initialize === "function"
      ) {
        await this.retryableModuleInitialize(moduleInstance, "initialize");
      }

      // 표준 onInitialize 메서드 호출 (재시도 로직 포함)
      if (
        moduleInstance.onInitialize &&
        typeof moduleInstance.onInitialize === "function"
      ) {
        await this.retryableModuleInitialize(moduleInstance, "onInitialize");
      }

      // 성공 처리
      this.stats.activeModules++;
      this.initializedModules.add(moduleKey);

      if (moduleConfig) {
        moduleConfig.initialized = true;
        moduleConfig.initializedAt = TimeHelper.getTimestamp();
      }

      const initTime = Date.now() - startTime;
      logger.success(
        `✅ ${moduleConfig?.name || moduleKey} 초기화 완료 (${initTime}ms)`
      );
    } catch (error) {
      this.stats.failedModules++;

      if (moduleConfig) {
        moduleConfig.initError = error.message;
      }

      logger.error(`❌ ${moduleConfig?.name || moduleKey} 초기화 실패:`, error);

      if (moduleConfig?.required) {
        throw new Error(
          `필수 모듈 ${moduleConfig.name} 초기화 실패: ${error.message}`
        );
      }
    } finally {
      this.initializingModules.delete(moduleKey);
    }
  }

  /**
   * 🔄 재시도 가능한 모듈 초기화
   */
  async retryableModuleInitialize(moduleInstance, methodName, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await moduleInstance[methodName]();
        return; // 성공하면 바로 반환
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const backoffTime = 1000 * attempt;
          logger.warn(
            `⚠️ ${methodName} 실패 (${attempt}/${maxRetries}), ${backoffTime}ms 후 재시도: ${error.message}`
          );
          await this.sleep(backoffTime);
        }
      }
    }

    throw lastError;
  }

  /**
   * 🔍 DB Manager 가져오기 (여러 방식 시도)
   */
  getDbManager() {
    // 여러 방식으로 DB Manager 찾기
    const candidates = [
      this.serviceBuilder?.dbManager,
      this.serviceBuilder?.db,
      global.dbManager,
      require("../core/DatabaseManager"),
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate.isConnected === "function") {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 🛡️ 초기화 완료 대기
   */
  async waitForInitialization(timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isInitialized) {
        return true;
      }

      if (!this.initializationInProgress) {
        return false; // 초기화가 실패했거나 중단됨
      }

      await this.sleep(100);
    }

    throw new Error("초기화 대기 시간 초과");
  }

  /**
   * 💤 Sleep 헬퍼
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ... 나머지 기존 메서드들은 그대로 유지 ...

  /**
   * 🔍 의존성 검증 (모듈 관련만)
   */
  validateModuleDependencies() {
    const required = [
      { name: "bot", obj: this.bot },
      { name: "serviceBuilder", obj: this.serviceBuilder },
    ];

    for (const { name, obj } of required) {
      if (!obj) {
        throw new Error(`필수 의존성 누락: ${name}`);
      }
    }

    logger.debug("✅ 모듈 의존성 검증 완료");
  }

  /**
   * 📊 통계 업데이트
   */
  updateInitializationStats() {
    this.stats.totalModules = this.moduleRegistry.size;
    this.stats.loadSuccessRate =
      this.stats.totalModules > 0
        ? Math.round((this.stats.activeModules / this.stats.totalModules) * 100)
        : 0;
  }

  // ... 다른 기존 메서드들 ...
}

// 🔒 Singleton 정적 변수
ModuleManager.instance = null;

module.exports = ModuleManager;
