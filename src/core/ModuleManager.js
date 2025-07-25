// src/core/ModuleManager.js - ServiceBuilder 연동 리팩토링 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const ServiceBuilder = require("./ServiceBuilder");

/**
 * 📦 모듈 매니저 v3.0.1 - ServiceBuilder 연동 리팩토링
 *
 * 🎯 단일 책임 원칙 적용:
 * - 순수 모듈 라이프사이클 관리만 담당
 * - 서비스 관련 책임은 ServiceBuilder로 완전 분리
 * - NavigationHandler 연동 지원
 * - 느슨한 결합 (Loose Coupling) 구현
 *
 * 🔧 주요 변경사항:
 * - ServiceBuilder 의존성 주입
 * - 서비스 관련 메서드 제거
 * - 모듈 생성 시 ServiceBuilder만 전달
 * - 순수 모듈 관리에만 집중
 */
class ModuleManager {
  constructor(options = {}) {
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
      ...options.config,
    };

    // 📋 모듈 레지스트리 및 인스턴스 (순수 모듈만)
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.moduleLoadOrder = [];

    // 🔒 중복 처리 방지
    this.processingCallbacks = new Set();
    this.initializingModules = new Set();

    // 📊 모듈 전용 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      averageCallbackTime: 0,
      averageInitTime: 0,
      loadSuccessRate: 0,
      lastActivity: null,
      initializationTime: null,
    };

    // 🔄 초기화 상태
    this.isInitialized = false;
    this.initializationInProgress = false;

    // 🧹 정리 스케줄러
    this.cleanupTimer = null;

    logger.info("📦 ModuleManager v3.0.1 생성됨 (ServiceBuilder 연동)");
  }

  /**
   * 🎯 모듈 매니저 초기화
   */
  async initialize() {
    if (this.initializationInProgress || this.isInitialized) {
      logger.debug("ModuleManager 이미 초기화됨");
      return;
    }

    this.initializationInProgress = true;

    try {
      logger.info("📦 ModuleManager v3.0.1 초기화 시작...");

      // 🏗️ ServiceBuilder 초기화 확인
      await this.ensureServiceBuilderReady();

      // 의존성 검증 (모듈 관련만)
      this.validateModuleDependencies();

      // 🔍 모듈 자동 감지 및 등록
      await this.discoverAndRegisterModules();

      // 🏗️ 모듈 인스턴스 생성 (ServiceBuilder 주입)
      await this.createModuleInstances();

      // 🎯 모듈 초기화
      await this.initializeModules();

      // 📊 통계 업데이트
      this.updateInitializationStats();

      // 🧹 정리 스케줄러 시작
      if (this.config.enableHealthCheck) {
        this.startCleanupScheduler();
      }

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.success(
        `✅ ModuleManager v3.0.1 초기화 완료 (${this.stats.activeModules}/${this.stats.totalModules}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * 🏗️ ServiceBuilder 준비 확인
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

      logger.debug("✅ ServiceBuilder 준비 완료");
    } catch (error) {
      logger.error("❌ ServiceBuilder 준비 실패:", error);
      throw error;
    }
  }

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

  // ===== 🔍 모듈 등록 및 생성 =====

  /**
   * 🔍 모듈 자동 감지 및 등록
   */
  async discoverAndRegisterModules() {
    logger.info("🔍 모듈 자동 감지 시작...");

    // 안전한 모듈 등록 (파일 존재 확인)
    const moduleList = [
      {
        key: "SystemModule",
        name: "시스템 모듈",
        path: "../modules/SystemModule",
        priority: 1,
        required: true,
        features: ["system", "navigation", "help"],
      },
      {
        key: "TodoModule",
        name: "할일 관리 모듈",
        path: "../modules/TodoModule",
        priority: 2,
        required: true,
        features: ["crud", "pagination", "search"],
      },
      {
        key: "TimerModule",
        name: "타이머 모듈",
        path: "../modules/TimerModule",
        priority: 3,
        required: false,
        features: ["timer", "pomodoro", "notifications"],
      },
      {
        key: "WorktimeModule",
        name: "근무시간 관리 모듈",
        path: "../modules/WorktimeModule",
        priority: 4,
        required: false,
        features: ["worktime", "statistics", "reports"],
      },
      {
        key: "LeaveModule",
        name: "휴가 관리 모듈",
        path: "../modules/LeaveModule",
        priority: 5,
        required: false,
        features: ["leave", "calendar", "approval"],
      },
      {
        key: "ReminderModule",
        name: "리마인더 모듈",
        path: "../modules/ReminderModule",
        priority: 6,
        required: false,
        features: ["reminder", "scheduling", "notifications"],
      },
      {
        key: "FortuneModule",
        name: "운세 모듈",
        path: "../modules/FortuneModule",
        priority: 7,
        required: false,
        features: ["fortune", "entertainment"],
      },
      {
        key: "WeatherModule",
        name: "날씨 모듈",
        path: "../modules/WeatherModule",
        priority: 8,
        required: false,
        features: ["weather", "api", "location"],
      },
      {
        key: "TTSModule",
        name: "TTS 모듈",
        path: "../modules/TTSModule",
        priority: 9,
        required: false,
        features: ["tts", "audio", "voice"],
      },
    ];

    const moduleConfigs = [];

    // 파일 존재 확인하고 등록
    for (const module of moduleList) {
      try {
        require.resolve(module.path);
        moduleConfigs.push(module);
        logger.debug(`✅ 모듈 발견: ${module.name}`);
      } catch (error) {
        logger.warn(`⚠️ 모듈 파일 없음: ${module.name} (${module.path})`);
        if (module.required) {
          throw new Error(`필수 모듈 파일을 찾을 수 없음: ${module.name}`);
        }
      }
    }

    // 모듈 등록
    for (const config of moduleConfigs) {
      try {
        await this.registerModule(config);
        this.stats.totalModules++;
      } catch (error) {
        logger.error(`❌ 모듈 등록 실패: ${config.key}`, error);
        if (config.required) {
          throw error;
        }
      }
    }

    const registeredKeys = Array.from(this.moduleRegistry.keys());
    logger.info(
      `📋 ${registeredKeys.length}개 모듈 등록 완료: ${registeredKeys.join(
        ", "
      )}`
    );
  }

  /**
   * 📝 단일 모듈 등록
   */
  async registerModule(config) {
    try {
      // 중복 체크
      if (this.moduleRegistry.has(config.key)) {
        logger.warn(`⚠️ 모듈 재등록: ${config.key}`);
      }

      // 모듈 파일 존재 확인
      try {
        require.resolve(config.path);
      } catch (error) {
        throw new Error(`모듈 파일을 찾을 수 없음: ${config.path}`);
      }

      // 모듈 메타데이터 생성
      const moduleMetadata = {
        ...config,
        loaded: false,
        initialized: false,
        loadedAt: null,
        initializedAt: null,
        loadError: null,
        initError: null,
        registeredAt: TimeHelper.getTimestamp(),
      };

      // 레지스트리에 등록
      this.moduleRegistry.set(config.key, moduleMetadata);
      this.moduleLoadOrder.push(config.key);

      logger.debug(
        `📝 모듈 등록 완료: ${config.name} (우선순위: ${config.priority})`
      );
    } catch (error) {
      logger.error(`❌ 모듈 등록 실패 (${config.key}):`, error);
      throw error;
    }
  }

  /**
   * 🏗️ 모듈 인스턴스 생성 (ServiceBuilder 주입)
   */
  async createModuleInstances() {
    logger.info("🏗️ 모듈 인스턴스 생성 시작...");

    // 우선순위 순으로 정렬
    const sortedModules = Array.from(this.moduleRegistry.entries()).sort(
      ([, a], [, b]) => a.priority - b.priority
    );

    for (const [moduleKey, moduleConfig] of sortedModules) {
      await this.createSingleModuleInstance(moduleKey);
    }

    logger.info(`🏗️ ${this.moduleInstances.size}개 모듈 인스턴스 생성 완료`);
  }

  /**
   * 🔨 단일 모듈 인스턴스 생성 (ServiceBuilder 연동)
   */
  async createSingleModuleInstance(moduleKey) {
    const moduleConfig = this.moduleRegistry.get(moduleKey);

    if (!moduleConfig) {
      logger.error(`❌ 모듈 설정을 찾을 수 없음: ${moduleKey}`);
      return;
    }

    try {
      logger.debug(`🔨 ${moduleConfig.name} 인스턴스 생성 중...`);

      // 모듈 클래스 로드
      const ModuleClass = require(moduleConfig.path);

      // 🎯 ServiceBuilder만 주입하는 깔끔한 의존성 주입
      const moduleInstance = new ModuleClass(this.bot, {
        serviceBuilder: this.serviceBuilder, // 🏗️ 핵심! ServiceBuilder 주입
        moduleManager: this, // 자기 자신 (콜백 라우팅용)
        moduleKey: moduleKey,
        moduleConfig: moduleConfig,
        config: this.config.modules?.[moduleKey] || {},
      });

      // 인스턴스 저장
      this.moduleInstances.set(moduleKey, moduleInstance);

      // 설정 업데이트
      moduleConfig.loaded = true;
      moduleConfig.loadedAt = TimeHelper.getTimestamp();

      logger.debug(
        `✅ ${moduleConfig.name} 인스턴스 생성 완료 (ServiceBuilder 주입)`
      );
    } catch (error) {
      logger.error(`❌ ${moduleConfig.name} 인스턴스 생성 실패:`, error);

      // 실패 통계 업데이트
      this.stats.failedModules++;
      moduleConfig.loadError = error.message;

      if (moduleConfig.required) {
        throw new Error(
          `필수 모듈 ${moduleConfig.name} 생성 실패: ${error.message}`
        );
      }
    }
  }

  /**
   * 🎯 모듈 초기화
   */
  async initializeModules() {
    logger.info("🎯 모듈 초기화 시작...");

    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      await this.initializeSingleModule(moduleKey, moduleInstance);
    }

    logger.info(`🎯 ${this.stats.activeModules}개 모듈 초기화 완료`);
  }

  /**
   * 🔧 단일 모듈 초기화
   */
  async initializeSingleModule(moduleKey, moduleInstance) {
    const moduleConfig = this.moduleRegistry.get(moduleKey);

    // 중복 초기화 방지
    if (this.initializingModules.has(moduleKey)) {
      logger.debug(`🔄 ${moduleConfig.name} 초기화 진행 중 - 대기`);
      return;
    }

    this.initializingModules.add(moduleKey);
    const startTime = Date.now();

    try {
      logger.debug(`🔧 ${moduleConfig.name} 초기화 중...`);

      // 표준 초기화 메서드 호출
      if (
        moduleInstance.initialize &&
        typeof moduleInstance.initialize === "function"
      ) {
        await moduleInstance.initialize();
      }

      // 표준 onInitialize 메서드 호출
      if (
        moduleInstance.onInitialize &&
        typeof moduleInstance.onInitialize === "function"
      ) {
        await moduleInstance.onInitialize();
      }

      // 액션 설정
      if (
        moduleInstance.setupActions &&
        typeof moduleInstance.setupActions === "function"
      ) {
        moduleInstance.setupActions();
      }

      // 초기화 완료 표시
      moduleConfig.initialized = true;
      moduleConfig.initializedAt = TimeHelper.getTimestamp();

      this.stats.activeModules++;
      this.updateInitTimeStats(Date.now() - startTime);

      logger.debug(
        `✅ ${moduleConfig.name} 초기화 완료 (${Date.now() - startTime}ms)`
      );
    } catch (error) {
      logger.error(`❌ ${moduleConfig.name} 초기화 실패:`, error);

      // 실패한 모듈은 인스턴스에서 제거
      this.moduleInstances.delete(moduleKey);
      moduleConfig.initError = error.message;
      this.stats.failedModules++;

      if (moduleConfig.required) {
        throw new Error(
          `필수 모듈 ${moduleConfig.name} 초기화 실패: ${error.message}`
        );
      }
    } finally {
      this.initializingModules.delete(moduleKey);
    }
  }

  // ===== 🎯 콜백 및 메시지 처리 (NavigationHandler 연동) =====

  /**
   * 🎯 콜백 처리 (NavigationHandler에서 호출)
   */
  async handleCallback(bot, callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}-${callbackQuery.id}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시 (ModuleManager):", callbackKey);
      return false;
    }

    this.processingCallbacks.add(callbackKey);
    const startTime = Date.now();

    try {
      // 콜백 데이터 파싱
      const { moduleKey, subAction, params } = this.parseCallbackData(
        callbackQuery.data
      );

      logger.debug(
        `🎯 ModuleManager 콜백 라우팅: ${moduleKey}.${subAction}(${params.join(
          ", "
        )})`
      );

      // 모듈 인스턴스 찾기
      const moduleInstance = this.moduleInstances.get(moduleKey);

      if (!moduleInstance) {
        logger.warn(`❓ 모듈을 찾을 수 없음: ${moduleKey}`);
        return false;
      }

      // 🔥 표준 매개변수로 모듈의 handleCallback 호출
      const handled = await moduleInstance.handleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        this // moduleManager 자신을 전달
      );

      if (handled) {
        this.stats.callbacksHandled++;
        this.updateCallbackTimeStats(Date.now() - startTime);
        logger.debug(
          `✅ ${moduleKey} 콜백 처리 완료 (${Date.now() - startTime}ms)`
        );
      }

      return handled;
    } catch (error) {
      logger.error("❌ ModuleManager 콜백 처리 오류:", error);
      this.stats.errorsCount++;
      return false;
    } finally {
      // 처리 완료 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 1000);
    }
  }

  /**
   * 📬 메시지 처리
   */
  async handleMessage(bot, msg) {
    logger.debug("📬 ModuleManager 메시지 처리 시작");

    // 우선순위 순으로 모듈에 메시지 전달
    const sortedKeys = Array.from(this.moduleInstances.keys()).sort((a, b) => {
      const configA = this.moduleRegistry.get(a);
      const configB = this.moduleRegistry.get(b);
      return configA.priority - configB.priority;
    });

    for (const moduleKey of sortedKeys) {
      const moduleInstance = this.moduleInstances.get(moduleKey);

      if (!moduleInstance) continue;

      try {
        // onHandleMessage 메서드가 있는 경우 호출 (표준 패턴)
        if (typeof moduleInstance.onHandleMessage === "function") {
          const handled = await moduleInstance.onHandleMessage(bot, msg);

          if (handled) {
            this.stats.messagesHandled++;
            logger.debug(`📬 메시지가 ${moduleKey}에서 처리됨`);
            return true;
          }
        }
        // 호환성을 위해 handleMessage도 확인
        else if (typeof moduleInstance.handleMessage === "function") {
          const handled = await moduleInstance.handleMessage(bot, msg);

          if (handled) {
            this.stats.messagesHandled++;
            logger.debug(`📬 메시지가 ${moduleKey}에서 처리됨 (호환성)`);
            return true;
          }
        }
      } catch (error) {
        logger.error(`❌ ${moduleKey} 메시지 처리 오류:`, error);
        this.stats.errorsCount++;
      }
    }

    logger.debug("📬 처리되지 않은 메시지");
    return false;
  }

  // ===== 🔍 NavigationHandler용 메서드들 =====

  /**
   * 🔍 모듈 존재 확인 (NavigationHandler용)
   */
  hasModule(moduleKey) {
    if (!moduleKey || typeof moduleKey !== "string") {
      logger.debug(`❓ 잘못된 moduleKey: ${moduleKey}`);
      return false;
    }

    const exists = this.moduleInstances.has(moduleKey);
    logger.debug(`🔍 hasModule(${moduleKey}): ${exists}`);
    return exists;
  }

  /**
   * 🔍 모듈 인스턴스 반환 (NavigationHandler용)
   */
  getModule(moduleKey) {
    if (!moduleKey || typeof moduleKey !== "string") {
      logger.debug(`❓ 잘못된 moduleKey: ${moduleKey}`);
      return null;
    }

    const moduleInstance = this.moduleInstances.get(moduleKey);
    logger.debug(
      `🔍 getModule(${moduleKey}): ${moduleInstance ? "존재" : "없음"}`
    );
    return moduleInstance || null;
  }

  /**
   * 📋 모듈 목록 반환 (CommandHandler용)
   */
  getModuleList() {
    const modules = [];

    for (const [moduleKey, moduleConfig] of this.moduleRegistry) {
      const moduleInstance = this.moduleInstances.get(moduleKey);

      modules.push({
        key: moduleKey,
        name: moduleConfig.name,
        priority: moduleConfig.priority,
        required: moduleConfig.required,
        features: moduleConfig.features || [],
        loaded: moduleConfig.loaded,
        initialized: moduleConfig.initialized,
        active: !!moduleInstance,
        hasActions:
          moduleInstance && moduleInstance.actionMap
            ? moduleInstance.actionMap.size > 0
            : false,
      });
    }

    return modules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 📊 활성 모듈 상태 (동적 메뉴용)
   */
  getActiveModulesStatus() {
    const status = [];

    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      try {
        // 모듈 상태 조회
        const moduleStatus = moduleInstance.getStatus
          ? moduleInstance.getStatus()
          : { status: "unknown" };

        status.push({
          key: moduleKey,
          name: moduleConfig.name,
          status: moduleStatus,
          healthy: this.isModuleHealthy(moduleInstance),
          features: moduleConfig.features || [],
          priority: moduleConfig.priority,
        });
      } catch (error) {
        logger.debug(`⚠️ ${moduleKey} 상태 조회 실패:`, error.message);
        status.push({
          key: moduleKey,
          name: moduleConfig.name,
          status: { error: error.message },
          healthy: false,
          features: [],
          priority: moduleConfig.priority,
        });
      }
    }

    return status.sort((a, b) => a.priority - b.priority);
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🔍 콜백 데이터 파싱
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      return {
        moduleKey: "system",
        subAction: "menu",
        params: [],
      };
    }

    const parts = data.split(":");

    return {
      moduleKey: parts[0] || "system",
      subAction: parts[1] || "menu",
      params: parts.slice(2) || [],
    };
  }

  /**
   * 🏥 모듈 헬스체크
   */
  isModuleHealthy(moduleInstance) {
    if (!moduleInstance) return false;

    try {
      // 기본 헬스체크
      if (
        moduleInstance.getStatus &&
        typeof moduleInstance.getStatus === "function"
      ) {
        const status = moduleInstance.getStatus();
        return status && !status.error;
      }

      // 최소한의 체크
      return moduleInstance.moduleName && moduleInstance.actionMap;
    } catch (error) {
      logger.debug(`🏥 모듈 헬스체크 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 📊 콜백 응답 시간 통계 업데이트
   */
  updateCallbackTimeStats(responseTime) {
    if (this.stats.averageCallbackTime === 0) {
      this.stats.averageCallbackTime = responseTime;
    } else {
      // 지수 평활법으로 평균 계산
      this.stats.averageCallbackTime =
        this.stats.averageCallbackTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * 📊 초기화 시간 통계 업데이트
   */
  updateInitTimeStats(initTime) {
    if (this.stats.averageInitTime === 0) {
      this.stats.averageInitTime = initTime;
    } else {
      this.stats.averageInitTime =
        this.stats.averageInitTime * 0.9 + initTime * 0.1;
    }
  }

  /**
   * 📊 초기화 통계 업데이트
   */
  updateInitializationStats() {
    this.stats.loadSuccessRate =
      this.stats.totalModules > 0
        ? ((this.stats.totalModules - this.stats.failedModules) /
            this.stats.totalModules) *
          100
        : 0;

    this.stats.initializationTime = TimeHelper.getTimestamp();
    this.stats.lastActivity = TimeHelper.getLogTimeString();
  }

  /**
   * 🧹 정리 스케줄러 시작
   */
  startCleanupScheduler() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performModuleHealthCheck();
    }, this.config.cleanupInterval);

    logger.debug("🧹 ModuleManager 정리 스케줄러 시작됨");
  }

  /**
   * 🏥 모듈 헬스체크 수행
   */
  performModuleHealthCheck() {
    try {
      let healthyCount = 0;
      let unhealthyCount = 0;

      for (const [moduleKey, moduleInstance] of this.moduleInstances) {
        if (this.isModuleHealthy(moduleInstance)) {
          healthyCount++;
        } else {
          unhealthyCount++;
          logger.warn(`🏥 비정상 모듈 감지: ${moduleKey}`);
        }
      }

      if (unhealthyCount > 0) {
        logger.info(
          `🏥 모듈 헬스체크 완료: 정상 ${healthyCount}개, 비정상 ${unhealthyCount}개`
        );
      }
    } catch (error) {
      logger.error("❌ 모듈 헬스체크 수행 실패:", error);
    }
  }

  /**
   * 📊 상태 조회 (모듈 전용)
   */
  getStatus() {
    const moduleStatuses = {};

    // 각 모듈의 상태 수집
    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      moduleStatuses[moduleKey] = {
        name: moduleConfig.name,
        priority: moduleConfig.priority,
        required: moduleConfig.required,
        loaded: moduleConfig.loaded,
        initialized: moduleConfig.initialized,
        features: moduleConfig.features,
        loadedAt: moduleConfig.loadedAt,
        initializedAt: moduleConfig.initializedAt,
        healthy: this.isModuleHealthy(moduleInstance),
        hasActions: moduleInstance.actionMap
          ? moduleInstance.actionMap.size > 0
          : false,
        actionCount: moduleInstance.actionMap
          ? moduleInstance.actionMap.size
          : 0,
      };
    }

    return {
      initialized: this.isInitialized,
      config: this.config,
      stats: this.stats,
      modules: moduleStatuses,
      serviceBuilder: {
        connected: !!this.serviceBuilder,
        initialized: this.serviceBuilder?.isInitialized || false,
        status: this.serviceBuilder?.getStatus?.() || "unknown",
      },
      lastActivity: this.stats.lastActivity,
    };
  }

  /**
   * 🔍 모듈 상세 정보
   */
  getModuleDetails(moduleKey) {
    const moduleConfig = this.moduleRegistry.get(moduleKey);
    const moduleInstance = this.moduleInstances.get(moduleKey);

    if (!moduleConfig) {
      return { error: `모듈을 찾을 수 없음: ${moduleKey}` };
    }

    return {
      config: moduleConfig,
      hasInstance: !!moduleInstance,
      healthy: this.isModuleHealthy(moduleInstance),
      actions: moduleInstance?.actionMap
        ? Array.from(moduleInstance.actionMap.keys())
        : [],
      stats: moduleInstance?.stats || null,
      status: moduleInstance?.getStatus?.() || null,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager v3.0.1 정리 시작...");

      // 스케줄러 정리
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // 모든 모듈 정리 (역순으로)
      const moduleKeys = Array.from(this.moduleInstances.keys()).reverse();

      for (const moduleKey of moduleKeys) {
        const moduleInstance = this.moduleInstances.get(moduleKey);
        const moduleConfig = this.moduleRegistry.get(moduleKey);

        try {
          if (moduleInstance && typeof moduleInstance.cleanup === "function") {
            await moduleInstance.cleanup();
          }
          logger.debug(`✅ ${moduleConfig?.name || moduleKey} 모듈 정리 완료`);
        } catch (error) {
          logger.error(
            `❌ ${moduleConfig?.name || moduleKey} 모듈 정리 실패:`,
            error
          );
        }
      }

      // 내부 상태 정리
      this.moduleInstances.clear();
      this.moduleRegistry.clear();
      this.moduleLoadOrder = [];
      this.processingCallbacks.clear();
      this.initializingModules.clear();

      // 통계 초기화
      this.stats = {
        totalModules: 0,
        activeModules: 0,
        failedModules: 0,
        callbacksHandled: 0,
        messagesHandled: 0,
        errorsCount: 0,
        averageCallbackTime: 0,
        averageInitTime: 0,
        loadSuccessRate: 0,
        lastActivity: null,
        initializationTime: null,
      };

      this.isInitialized = false;

      logger.info("✅ ModuleManager v3.0.1 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
    }
  }
}

module.exports = ModuleManager;
