// src/core/ModuleManager.js - 완전 리팩토링 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎛️ 모듈 매니저 - 완전 리팩토링
 * - 자동 모듈 감지 및 로딩
 * - 표준 콜백 라우팅 시스템
 * - 완벽한 의존성 주입
 * - Railway 환경 최적화
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.dbManager = options.db;
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
    logger.info("🎛️ ModuleManager v2.0 생성됨");
  }

  /**
   * 🎯 매니저 초기화 (완전판)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎛️ ModuleManager v2.0 초기화 시작...");

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
        `✅ ModuleManager v2.0 초기화 완료 (${this.stats.activeModules}/${this.stats.totalModules}개 모듈 활성)`
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
        features: ["작업타이머", "휴식타이머", "뽀모도로", "통계"],
      },
      {
        key: "worktime",
        name: "WorktimeModule",
        path: "../modules/WorktimeModule",
        priority: 4,
        required: false,
        description: "근무시간 관리",
        features: ["출퇴근", "근무시간", "초과근무", "통계"],
      },
      {
        key: "leave",
        name: "LeaveModule",
        path: "../modules/LeaveModule",
        priority: 5,
        required: false,
        description: "휴가 관리",
        features: ["연차신청", "휴가조회", "잔여연차", "승인관리"],
      },
      {
        key: "reminder",
        name: "ReminderModule",
        path: "../modules/ReminderModule",
        priority: 6,
        required: false,
        description: "리마인더",
        features: ["시간알림", "분단위알림", "반복알림", "음성알림"],
      },
      {
        key: "fortune",
        name: "FortuneModule",
        path: "../modules/FortuneModule",
        priority: 7,
        required: false,
        description: "운세",
        features: ["일반운세", "업무운세", "타로카드", "로또번호"],
      },
      {
        key: "weather",
        name: "WeatherModule",
        path: "../modules/WeatherModule",
        priority: 8,
        required: false,
        description: "날씨",
        features: ["현재날씨", "시간별예보", "의상추천", "미세먼지"],
      },
      {
        key: "tts", // 🎤 유틸에서 모듈로 승격!
        name: "TTSModule",
        path: "../modules/TTSModule",
        priority: 9,
        required: false,
        description: "음성 변환",
        features: ["6개국어", "자동감지", "음성파일", "설정관리"],
      },
    ];

    // 모듈 등록
    for (const moduleConfig of standardModules) {
      await this.registerModule(moduleConfig);
    }

    logger.info(`🔍 ${this.moduleRegistry.size}개 모듈 감지 및 등록 완료`);
  }

  /**
   * 📦 모듈 등록 (향상된)
   */
  async registerModule(config) {
    try {
      // 모듈 파일 존재 확인
      const moduleExists = await this.checkModuleExists(config.path);

      if (!moduleExists && config.required) {
        throw new Error(`필수 모듈 파일을 찾을 수 없음: ${config.path}`);
      }

      if (!moduleExists) {
        logger.warn(`⚠️ 모듈 파일 없음 (건너뜀): ${config.name}`);
        return;
      }

      // 레지스트리에 등록
      this.moduleRegistry.set(config.key, {
        ...config,
        registered: true,
        loaded: false,
        initialized: false,
        registeredAt: TimeHelper.getTimestamp(),
      });

      // 로드 순서에 추가
      this.moduleLoadOrder.push(config.key);
      this.stats.totalModules++;

      logger.debug(`📦 모듈 등록: ${config.key} -> ${config.name}`);
    } catch (error) {
      logger.error(`❌ 모듈 등록 실패 (${config.name}):`, error);

      if (config.required) {
        throw error;
      }
    }
  }

  /**
   * 🔍 모듈 파일 존재 확인
   */
  async checkModuleExists(modulePath) {
    try {
      require.resolve(modulePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🏗️ 모듈 인스턴스 생성 (완전판)
   */
  async createModuleInstances() {
    logger.info("🏗️ 모듈 인스턴스 생성 시작...");

    // 우선순위 순으로 정렬된 로드 순서대로 처리
    const sortedKeys = this.moduleLoadOrder
      .filter((key) => this.moduleRegistry.has(key))
      .sort((a, b) => {
        const configA = this.moduleRegistry.get(a);
        const configB = this.moduleRegistry.get(b);
        return configA.priority - configB.priority;
      });

    for (const moduleKey of sortedKeys) {
      await this.createSingleModuleInstance(moduleKey);
    }

    logger.info(`🏗️ ${this.moduleInstances.size}개 모듈 인스턴스 생성 완료`);
  }

  /**
   * 🔨 단일 모듈 인스턴스 생성
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

      // 표준 의존성 주입으로 인스턴스 생성
      const moduleInstance = new ModuleClass(this.bot, {
        db: this.dbManager?.db, // DatabaseManager의 db 인스턴스 전달
        moduleManager: this, // 자기 자신 전달
        config: this.config,
        moduleKey: moduleKey,
        moduleConfig: moduleConfig,
      });

      // 인스턴스 저장
      this.moduleInstances.set(moduleKey, moduleInstance);

      // 설정 업데이트
      moduleConfig.loaded = true;
      moduleConfig.loadedAt = TimeHelper.getTimestamp();

      logger.debug(`✅ ${moduleConfig.name} 인스턴스 생성 완료`);
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
   * 🎯 모듈 초기화 (완전판)
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
   * 🎯 콜백 처리 (핵심 라우팅 - 완전판)
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
   * 📬 메시지 처리 (완전판)
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
        // handleMessage 메서드가 있는 경우만 호출
        if (typeof moduleInstance.handleMessage === "function") {
          const handled = await moduleInstance.handleMessage(bot, msg);

          if (handled) {
            logger.debug(`📬 메시지가 ${moduleKey}에서 처리됨`);
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
   * 🔍 콜백 데이터 파싱 (표준화)
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
   * 📊 상태 조회 (완전판)
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
        hasError: !!(moduleConfig.loadError || moduleConfig.initError),
        errorMessage: moduleConfig.loadError || moduleConfig.initError,
      };
    }

    // 실패한 모듈들도 포함
    for (const [moduleKey, moduleConfig] of this.moduleRegistry) {
      if (!this.moduleInstances.has(moduleKey)) {
        moduleStatuses[moduleKey] = {
          name: moduleConfig.name,
          priority: moduleConfig.priority,
          required: moduleConfig.required,
          loaded: false,
          initialized: false,
          status: "failed",
          hasError: true,
          errorMessage:
            moduleConfig.loadError || moduleConfig.initError || "Unknown error",
        };
      }
    }

    return {
      initialized: this.isInitialized,
      version: "2.0",
      stats: {
        ...this.stats,
        loadSuccessRate: Math.round(this.stats.loadSuccessRate * 100) / 100,
        averageCallbackTime: Math.round(this.stats.averageCallbackTime),
      },
      processing: {
        callbacks: this.processingCallbacks.size,
      },
      modules: moduleStatuses,
      environment: {
        isRailway: !!process.env.RAILWAY_ENVIRONMENT,
        nodeEnv: process.env.NODE_ENV,
        autoReload: this.config.autoReload,
      },
    };
  }

  /**
   * 🔍 모듈 조회 (안전한 버전)
   */
  getModule(moduleKey) {
    const moduleInstance = this.moduleInstances.get(moduleKey);

    if (!moduleInstance) {
      logger.debug(`❓ 모듈을 찾을 수 없음: ${moduleKey}`);
      return null;
    }

    return moduleInstance;
  }

  /**
   * ✅ 모듈 존재 확인
   */
  hasModule(moduleKey) {
    return this.moduleInstances.has(moduleKey);
  }

  /**
   * 📋 모듈 목록 조회
   */
  getModuleList() {
    return Array.from(this.moduleInstances.keys());
  }

  /**
   * 📊 모듈 통계 조회
   */
  getModuleStats() {
    const stats = {
      total: this.stats.totalModules,
      active: this.stats.activeModules,
      failed: this.stats.failedModules,
      successRate: this.stats.loadSuccessRate,
      byPriority: {},
    };

    // 우선순위별 통계
    for (const [moduleKey, config] of this.moduleRegistry) {
      const priority = config.priority;
      if (!stats.byPriority[priority]) {
        stats.byPriority[priority] = {
          total: 0,
          active: 0,
          failed: 0,
        };
      }

      stats.byPriority[priority].total++;

      if (this.moduleInstances.has(moduleKey)) {
        stats.byPriority[priority].active++;
      } else {
        stats.byPriority[priority].failed++;
      }
    }

    return stats;
  }

  /**
   * 🔄 모듈 재로드 (개발용)
   */
  async reloadModule(moduleKey) {
    if (!this.config.autoReload) {
      logger.warn("⚠️ 모듈 재로드가 비활성화됨");
      return false;
    }

    try {
      logger.info(`🔄 모듈 재로드 시작: ${moduleKey}`);

      // 기존 모듈 정리
      const existingModule = this.moduleInstances.get(moduleKey);
      if (existingModule && existingModule.cleanup) {
        await existingModule.cleanup();
      }

      // 모듈 캐시 삭제
      const moduleConfig = this.moduleRegistry.get(moduleKey);
      if (moduleConfig) {
        delete require.cache[require.resolve(moduleConfig.path)];
      }

      // 모듈 재생성 및 초기화
      await this.createSingleModuleInstance(moduleKey);
      const newModule = this.moduleInstances.get(moduleKey);

      if (newModule) {
        await this.initializeSingleModule(moduleKey, newModule);
        logger.success(`✅ 모듈 재로드 완료: ${moduleKey}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`❌ 모듈 재로드 실패: ${moduleKey}`, error);
      return false;
    }
  }

  /**
   * 🧹 정리 (완전판)
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager v2.0 정리 시작...");

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

      logger.info("✅ ModuleManager v2.0 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
    }
  }
}

module.exports = ModuleManager;
