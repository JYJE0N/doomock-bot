// src/core/ModuleManager.js - ValidationManager 연동 업데이트 // 의존성 주입
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎛️ 모듈 매니저 v3.0.1 - ValidationManager 연동
 *
 * ✅ 업데이트 사항:
 * - ValidationManager를 모든 모듈에 전달
 * - 중앙 검증 시스템 활용
 * - 모듈별 의존성 주입 개선
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.dbManager = options.db;
    this.validationManager = options.validationManager; // 🛡️ ValidationManager 추가
    this.config = options.config || {};

    // 🎯 모듈 관리
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.moduleLoadOrder = [];

    // 🚫 중복 처리 방지
    this.processingCallbacks = new Set();

    // ⏱️ 설정
    this.config = {
      moduleTimeout: 30000,
      maxRetries: 3,
      autoReload: process.env.NODE_ENV === "development",
      ...options.config,
    };

    // 📊 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      callbacksHandled: 0,
      errorsCount: 0,
      averageCallbackTime: 0,
    };

    this.isInitialized = false;
    logger.info("🎛️ ModuleManager v3.0.1 생성됨 (ValidationManager 연동)");
  }

  /**
   * 🎯 매니저 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎛️ ModuleManager v3.0.1 초기화 시작...");

      // ValidationManager 상태 확인
      if (this.validationManager) {
        logger.debug("🛡️ ValidationManager 연결됨");
      } else {
        logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
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

  /**
   * 🔍 모듈 자동 감지 및 등록
   */
  async discoverAndRegisterModules() {
    logger.info("🔍 모듈 자동 감지 시작...");

    // 📋 표준 모듈 정의 (우선순위 순)
    const standardModules = [
      {
        key: "system",
        name: "SystemModule",
        path: "../modules/SystemModule",
        priority: 1,
        required: true,
        description: "시스템 핵심 기능",
        features: ["메인메뉴", "도움말", "상태조회"],
      },
      {
        key: "todo",
        name: "TodoModule",
        path: "../modules/TodoModule",
        priority: 2,
        required: false,
        description: "할일 관리",
        features: ["할일추가", "완료처리", "목록조회", "통계"],
      },
      {
        key: "timer",
        name: "TimerModule",
        path: "../modules/TimerModule",
        priority: 3,
        required: false,
        description: "타이머/뽀모도로",
        features: ["타이머", "뽀모도로", "알림"],
      },
      {
        key: "worktime",
        name: "WorktimeModule",
        path: "../modules/WorktimeModule",
        priority: 4,
        required: false,
        description: "근무시간 관리",
        features: ["출근", "퇴근", "근무시간", "통계"],
      },
    ];

    // 모듈 등록
    for (const moduleConfig of standardModules) {
      try {
        // 모듈 파일 존재 확인
        require.resolve(moduleConfig.path);

        this.moduleRegistry.set(moduleConfig.key, {
          ...moduleConfig,
          loaded: false,
          initialized: false,
          loadedAt: null,
          initializedAt: null,
        });

        this.stats.totalModules++;
        logger.debug(`📋 모듈 등록: ${moduleConfig.name}`);
      } catch (error) {
        if (moduleConfig.required) {
          logger.error(`❌ 필수 모듈 로드 실패: ${moduleConfig.name}`, error);
          throw error;
        } else {
          logger.warn(`⚠️ 선택 모듈 로드 실패 (무시됨): ${moduleConfig.name}`);
        }
      }
    }

    logger.info(`📋 ${this.stats.totalModules}개 모듈 등록 완료`);
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
        db: this.dbManager?.db, // DatabaseManager의 db 인스턴스 전달
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

  /**
   * 🎯 콜백 처리 (핵심 라우팅)
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
        hasValidationManager: !!moduleInstance.validationManager, // 🛡️ 검증 시스템 상태
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
