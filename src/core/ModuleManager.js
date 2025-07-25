// src/core/ModuleManager.js - NavigationHandler 연동을 위한 완전 수정본
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📦 모듈 매니저 v3.0.1 - NavigationHandler 연동 버전
 *
 * 🔧 핵심 추가사항:
 * - hasModule() 메서드 추가 (NavigationHandler용)
 * - getModule() 메서드 추가 (NavigationHandler용)
 * - getModuleList() 메서드 추가 (CommandHandler용)
 * - getActiveModulesStatus() 메서드 추가 (동적 메뉴용)
 * - 표준 매개변수 체계 준수
 */
class ModuleManager {
  constructor(options = {}) {
    // 🤖 봇 인스턴스
    this.bot = options.bot;

    // 🏗️ 의존성들
    this.dbManager = options.dbManager;
    this.db = options.db; // 직접 db 인스턴스
    this.validationManager = options.validationManager;
    this.config = options.config || {};

    // 📋 모듈 레지스트리 및 인스턴스
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.moduleLoadOrder = [];

    // 🔒 중복 처리 방지
    this.processingCallbacks = new Set();

    // 📊 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      callbacksHandled: 0,
      errorsCount: 0,
      averageCallbackTime: 0,
      loadSuccessRate: 0,
      initializationTime: null,
    };

    // 상태
    this.isInitialized = false;

    logger.info("📦 ModuleManager v3.0.1 생성됨 (NavigationHandler 연동)");
  }

  /**
   * 🎯 모듈 매니저 초기화
   */
  async initialize() {
    try {
      logger.info("📦 ModuleManager v3.0.1 초기화 시작...");

      // 의존성 검증
      if (!this.bot) {
        throw new Error("Bot 인스턴스가 필요합니다");
      }

      if (!this.validationManager) {
        logger.warn("⚠️ ValidationManager가 없어 일부 기능이 제한됩니다");
      }

      // 🔍 모듈 자동 감지 및 등록
      await this.discoverAndRegisterModules();

      // 🏗️ 모듈 인스턴스 생성
      await this.createModuleInstances();

      // 🎯 모듈 초기화
      await this.initializeModules();

      // 📊 통계 업데이트
      this.updateInitializationStats();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager v3.0.1 초기화 완료 (${this.stats.activeModules}/${this.stats.totalModules}개 모듈 활성)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 🔍 NavigationHandler용 핵심 메서드들 =====

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
    logger.debug(`🔍 getModule(${moduleKey}): ${moduleInstance ? "✅" : "❌"}`);
    return moduleInstance || null;
  }

  /**
   * 📋 모듈 목록 반환 (CommandHandler용)
   */
  getModuleList() {
    const moduleList = Array.from(this.moduleInstances.keys());
    logger.debug(`📋 getModuleList(): [${moduleList.join(", ")}]`);
    return moduleList;
  }

  /**
   * 📊 활성 모듈 상태 조회 (NavigationHandler 메뉴 생성용)
   */
  getActiveModulesStatus() {
    const activeModules = [];

    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      if (moduleConfig && moduleConfig.initialized) {
        activeModules.push({
          key: moduleKey,
          name: moduleConfig.name,
          emoji: this.getModuleEmoji(moduleKey),
          description: moduleConfig.description,
          features: moduleConfig.features || [],
          priority: moduleConfig.priority,
          status: moduleInstance.getStatus
            ? moduleInstance.getStatus()
            : "active",
        });
      }
    }

    // 우선순위순 정렬
    return activeModules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 🎨 모듈 이모지 반환
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      system: "⚙️",
      todo: "📝",
      timer: "⏰",
      worktime: "🕐",
      leave: "🏖️",
      reminder: "🔔",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🎤",
    };

    return emojiMap[moduleKey] || "📱";
  }

  // ===== 🔍 모듈 자동 감지 및 등록 =====

  /**
   * 🔍 모듈 자동 감지 및 등록
   */
  async discoverAndRegisterModules() {
    logger.info("🔍 모듈 자동 감지 시작...");

    // 📋 표준 모듈 정의 (우선순위 순)
    const standardModules = [
      {
        key: "SystemModule",
        name: "시스템모듈",
        path: "../modules/SystemModule",
        priority: 1,
        required: true,
        description: "시스템 핵심 기능",
        features: ["메인메뉴", "도움말", "상태조회"],
      },
      {
        key: "TodoModule",
        name: "할일 관리",
        path: "../modules/TodoModule",
        priority: 2,
        required: false,
        description: "할일 관리",
        features: ["할일추가", "완료처리", "목록조회", "통계"],
      },
      {
        key: "TimerModule",
        name: "타이머",
        path: "../modules/TimerModule",
        priority: 3,
        required: false,
        description: "타이머/뽀모도로",
        features: ["타이머", "뽀모도로", "알림"],
      },
      {
        key: "WorktimeModule",
        name: "근퇴관리",
        path: "../modules/WorktimeModule",
        priority: 4,
        required: false,
        description: "퇴근카운터",
        features: ["출근", "퇴근", "근무시간", "통계"],
      },
    ];

    // 모듈 등록
    for (const config of moduleConfigs) {
      try {
        // 모듈 등록
        this.moduleRegistry.set(config.key, config);

        // ✅ 등록된 키 로깅 추가
        logger.debug(`📋 모듈 등록: ${config.key} (${config.name})`);
      } catch (error) {
        logger.error(`❌ 모듈 등록 실패: ${config.key}`, error);
      }
    }

    // ✅ 최종 등록된 모듈 키들 출력
    const registeredKeys = Array.from(this.moduleRegistry.keys());
    logger.info(
      `📋 ${registeredKeys.length}개 모듈 등록 완료: ${registeredKeys.join(
        ", "
      )}`
    );
  }

  /**
   * 🏗️ 모듈 인스턴스 생성 (ValidationManager 전달)
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
   * 🔨 단일 모듈 인스턴스 생성 (ValidationManager 전달)
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

      // 🛡️ ValidationManager를 포함한 완전한 의존성 주입
      const moduleInstance = new ModuleClass(this.bot, {
        db: this.db, // 직접 db 인스턴스 전달
        moduleManager: this, // 자기 자신 전달
        validationManager: this.validationManager, // 🛡️ ValidationManager 전달
        config: this.config,
        moduleKey: moduleKey,
        moduleConfig: moduleConfig,
      });

      // 인스턴스 저장
      this.moduleInstances.set(moduleKey, moduleInstance);

      // 설정 업데이트
      moduleConfig.loaded = true;
      moduleConfig.loadedAt = TimeHelper.getTimestamp();

      logger.debug(
        `✅ ${moduleConfig.name} 인스턴스 생성 완료 (ValidationManager 포함)`
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

    try {
      logger.debug(`🔧 ${moduleConfig.name} 초기화 중...`);

      // 표준 초기화 메서드 호출
      if (moduleInstance.initialize) {
        await moduleInstance.initialize();
      }

      // 표준 onInitialize 메서드 호출
      if (moduleInstance.onInitialize) {
        await moduleInstance.onInitialize();
      }

      // 액션 설정
      if (moduleInstance.setupActions) {
        moduleInstance.setupActions();
      }

      // 초기화 완료 표시
      moduleConfig.initialized = true;
      moduleConfig.initializedAt = TimeHelper.getTimestamp();

      this.stats.activeModules++;
      logger.debug(`✅ ${moduleConfig.name} 초기화 완료`);
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
    }
  }
  // ===== 추가: 짧은 업타임 경고 해결 =====

  // HealthChecker.js의 checkSystemResources 메서드 수정
  async checkSystemResources() {
    try {
      const issues = [];
      let severity = "healthy";

      // 업타임 체크 (짧은 업타임 경고 완화)
      const uptimeSeconds = Math.round(process.uptime());
      if (uptimeSeconds < 30) {
        // 30초 미만일 때만 경고 (기존 60초에서 완화)
        issues.push(`짧은 업타임: ${uptimeSeconds}초`);
        severity = "warning";
      }

      // 메모리 사용량 체크
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (heapUsedMB > 500) {
        // 500MB 이상
        issues.push(`높은 메모리 사용량: ${heapUsedMB}MB`);
        severity = heapUsedMB > 800 ? "critical" : "warning";
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        uptime: uptimeSeconds,
        memory: {
          heapUsed: heapUsedMB,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
        pid: process.pid,
      });
    } catch (error) {
      logger.error("❌ 시스템 리소스 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  // ===== 🎯 콜백 및 메시지 처리 =====

  /**
   * 🎯 콜백 처리 (핵심 라우팅) - NavigationHandler에서 호출
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

        // 응답 시간 통계 업데이트
        const responseTime = Date.now() - startTime;
        this.updateCallbackTimeStats(responseTime);

        logger.debug(`✅ ${moduleKey} 콜백 처리 완료 (${responseTime}ms)`);
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
            logger.debug(`📬 메시지가 ${moduleKey}에서 처리됨`);
            return true;
          }
        }
        // 호환성을 위해 handleMessage도 확인
        else if (typeof moduleInstance.handleMessage === "function") {
          const handled = await moduleInstance.handleMessage(bot, msg);

          if (handled) {
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

  // ===== 📊 통계 및 상태 관리 =====

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
  }

  /**
   * 📊 상태 조회
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
        status: moduleInstance.getStatus
          ? moduleInstance.getStatus()
          : "unknown",
        hasValidationManager: !!moduleInstance.validationManager,
      };
    }

    return {
      initialized: this.isInitialized,
      stats: this.stats,
      config: this.config,
      modules: moduleStatuses,
      centralSystems: {
        validationManager: !!this.validationManager,
        dbManager: !!this.dbManager,
      },
      timestamp: TimeHelper.getLogTimeString(),
    };
  }

  /**
   * 🏥 HealthChecker용 초기화 상태 체크 메서드 (ModuleManager.js에 추가)
   */
  isFullyInitialized() {
    // 단순히 this.isInitialized만 체크하는 것이 아니라
    // 실제 모듈들이 모두 초기화되었는지 확인
    if (!this.isInitialized) {
      return false;
    }

    // 모든 활성 모듈이 초기화되었는지 확인
    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      if (!moduleConfig.initialized || !moduleInstance.isInitialized) {
        logger.debug(`❓ ${moduleKey} 모듈이 완전히 초기화되지 않음`);
        return false;
      }
    }

    return true;
  }

  /**
   * 🔍 특정 서비스 찾기 메서드 (HealthChecker용)
   */
  findService(serviceName) {
    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      // TodoService 찾기
      if (serviceName === "TodoService" && moduleInstance.todoService) {
        return moduleInstance.todoService;
      }

      // 다른 서비스들 찾기
      const serviceProperty =
        serviceName.toLowerCase().replace("service", "") + "Service";
      if (moduleInstance[serviceProperty]) {
        return moduleInstance[serviceProperty];
      }
    }

    return null;
  }

  /**
   * 🏥 HealthChecker용 상태 정보 (기존 getStatus 메서드 개선)
   */
  getHealthStatus() {
    const baseStatus = this.getStatus();

    return {
      ...baseStatus,
      fullyInitialized: this.isFullyInitialized(),
      moduleDetails: this.getModuleInitializationDetails(),
      availableServices: this.getAvailableServices(),
    };
  }

  /**
   * 📊 모듈 초기화 상세 정보
   */
  getModuleInitializationDetails() {
    const details = {};

    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      details[moduleKey] = {
        configInitialized: moduleConfig.initialized,
        instanceInitialized: moduleInstance.isInitialized,
        hasSetupActions: typeof moduleInstance.setupActions === "function",
        actionCount: moduleInstance.actionMap
          ? moduleInstance.actionMap.size
          : 0,
        priority: moduleConfig.priority,
      };
    }

    return details;
  }

  /**
   * 🔍 사용 가능한 서비스 목록
   */
  getAvailableServices() {
    const services = [];

    for (const [moduleKey, moduleInstance] of this.moduleInstances) {
      // 각 모듈에서 서비스 찾기
      const moduleServices = [];

      if (moduleInstance.todoService) moduleServices.push("TodoService");
      if (moduleInstance.timerService) moduleServices.push("TimerService");
      if (moduleInstance.worktimeService)
        moduleServices.push("WorktimeService");
      if (moduleInstance.leaveService) moduleServices.push("LeaveService");
      if (moduleInstance.reminderService)
        moduleServices.push("ReminderService");
      if (moduleInstance.fortuneService) moduleServices.push("FortuneService");

      if (moduleServices.length > 0) {
        services.push({
          module: moduleKey,
          services: moduleServices,
        });
      }
    }

    return services;
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager v3.0.1 정리 시작...");

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

      // 통계 초기화
      this.stats = {
        totalModules: 0,
        activeModules: 0,
        failedModules: 0,
        callbacksHandled: 0,
        errorsCount: 0,
        averageCallbackTime: 0,
      };

      this.isInitialized = false;

      logger.info("✅ ModuleManager v3.0.1 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
    }
  }
}

module.exports = ModuleManager;
