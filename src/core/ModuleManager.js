// src/core/ModuleManager.js - v3.0.1 ValidationManager 연동 완전 수정판
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎛️ 모듈 매니저 v3.0.1 - ValidationManager 연동 완성판
 *
 * ✅ 핵심 개선사항:
 * - ValidationManager를 모든 모듈에 올바르게 전달
 * - 중앙 검증 시스템 완전 활용
 * - 모듈별 의존성 주입 개선
 * - 중복 초기화 방지 시스템
 * - Railway 환경 최적화
 * - 모듈 라이프사이클 관리 개선
 *
 * 🎯 설계 원칙:
 * - 모든 모듈에 동일한 의존성 주입
 * - 표준화된 초기화 프로세스
 * - 중앙 집중식 에러 처리
 * - 성능 최적화된 콜백 라우팅
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.dbManager = options.db;
    this.validationManager = options.validationManager; // 🛡️ ValidationManager 올바른 수신
    this.config = options.config || {};

    // 🛡️ ValidationManager 상태 검증
    if (!this.validationManager) {
      logger.warn(
        "⚠️ ValidationManager가 제공되지 않았습니다. 기본 검증만 사용됩니다."
      );
    } else {
      logger.debug("🛡️ ValidationManager 정상 연결됨");
    }

    // 🎯 모듈 관리
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.moduleLoadOrder = [];

    // 🚫 중복 처리 방지
    this.processingCallbacks = new Set();
    this.initializationInProgress = false;

    // ⏱️ 설정 (Railway 환경 최적화)
    this.config = {
      moduleTimeout: parseInt(process.env.MODULE_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.MODULE_MAX_RETRIES) || 3,
      autoReload: process.env.NODE_ENV === "development",
      enableModuleStats: process.env.ENABLE_MODULE_STATS !== "false",
      enableDebugLogs: process.env.NODE_ENV === "development",
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
      totalCallbackTime: 0,
      moduleCreationTime: 0,
      lastActivity: null,
    };

    // 🔒 초기화 상태
    this.isInitialized = false;
    this.initStartTime = Date.now();

    logger.info("🎛️ ModuleManager v3.0.1 생성됨 (ValidationManager 연동)");
  }

  /**
   * 🎯 매니저 초기화 (중복 방지)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    if (this.initializationInProgress) {
      logger.warn("ModuleManager 초기화 진행 중");
      return;
    }

    try {
      this.initializationInProgress = true;
      logger.info("🎛️ ModuleManager v3.0.1 초기화 시작...");

      // ValidationManager 상태 재확인
      if (this.validationManager) {
        logger.debug("🛡️ ValidationManager 정상 연결됨");
      } else {
        logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
      }

      // 1단계: 모듈 자동 감지 및 등록
      await this.discoverAndRegisterModules();

      // 2단계: 모듈 인스턴스 생성 (ValidationManager 포함)
      await this.createModuleInstances();

      // 3단계: 모듈 초기화
      await this.initializeModules();

      // 4단계: 초기화 완료 처리
      this.completeInitialization();
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * 🔍 모듈 자동 감지 및 등록
   */
  async discoverAndRegisterModules() {
    logger.info("🔍 모듈 자동 감지 시작...");

    const path = require("path");
    const fs = require("fs").promises;

    try {
      const modulesDir = path.join(__dirname, "../modules");
      const moduleFiles = await fs.readdir(modulesDir);

      const moduleConfigs = [];

      for (const file of moduleFiles) {
        if (file.endsWith(".js") && file !== "BaseModule.js") {
          const moduleName = file.replace(".js", "");
          const modulePath = path.join(modulesDir, file);

          // 모듈 설정 생성
          const moduleConfig = {
            name: moduleName,
            path: modulePath,
            enabled: true,
            required: moduleName === "SystemModule", // SystemModule은 필수
            priority: this.getModulePriority(moduleName),
            loaded: false,
            initialized: false,
            loadedAt: null,
            initializedAt: null,
          };

          moduleConfigs.push(moduleConfig);
        }
      }

      // 우선순위 순으로 정렬
      moduleConfigs.sort((a, b) => a.priority - b.priority);

      // 모듈 등록
      for (const moduleConfig of moduleConfigs) {
        this.moduleRegistry.set(moduleConfig.name, moduleConfig);
        this.moduleLoadOrder.push(moduleConfig.name);
        this.stats.totalModules++;
      }

      logger.info(`📋 ${this.stats.totalModules}개 모듈 등록 완료`);
    } catch (error) {
      logger.error("❌ 모듈 자동 감지 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 모듈 우선순위 결정
   */
  getModulePriority(moduleName) {
    const priorities = {
      SystemModule: 1,
      TodoModule: 2,
      TimerModule: 3,
      WorktimeModule: 4,
      VacationModule: 5,
    };

    return priorities[moduleName] || 10;
  }

  /**
   * 🏗️ 모듈 인스턴스 생성 (ValidationManager 완전 전달)
   */
  async createModuleInstances() {
    logger.info("🏗️ 모듈 인스턴스 생성 시작...");

    const creationStartTime = Date.now();

    // 우선순위 순으로 정렬된 모듈들 처리
    for (const moduleKey of this.moduleLoadOrder) {
      await this.createSingleModuleInstance(moduleKey);
    }

    this.stats.moduleCreationTime = Date.now() - creationStartTime;
    logger.info(
      `🏗️ ${this.moduleInstances.size}개 모듈 인스턴스 생성 완료 (${this.stats.moduleCreationTime}ms)`
    );
  }

  /**
   * 🔨 단일 모듈 인스턴스 생성 (ValidationManager 완전 전달)
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
      const moduleOptions = {
        db: this.dbManager, // DatabaseManager의 db 인스턴스 전달
        moduleManager: this, // 자기 자신 전달
        validationManager: this.validationManager, // 🛡️ ValidationManager 올바른 전달
        config: this.config,
        moduleKey: moduleKey,
        moduleConfig: moduleConfig,
      };

      // ✅ ValidationManager 상태 로깅 (디버그용)
      if (this.config.enableDebugLogs) {
        logger.debug(
          `🛡️ ${moduleConfig.name}에 ValidationManager 전달: ${!!this
            .validationManager}`
        );
      }

      // 모듈 인스턴스 생성
      const moduleInstance = new ModuleClass(this.bot, moduleOptions);

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
      if (
        moduleInstance.initialize &&
        typeof moduleInstance.initialize === "function"
      ) {
        await moduleInstance.initialize();
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
   * ✅ 초기화 완료 처리
   */
  completeInitialization() {
    this.isInitialized = true;
    const totalInitTime = Date.now() - this.initStartTime;

    logger.success(`✅ ModuleManager 초기화 완료 (${totalInitTime}ms)`);
    logger.info(
      `📊 모듈 현황: 총 ${this.stats.totalModules}개, 활성 ${this.stats.activeModules}개, 실패 ${this.stats.failedModules}개`
    );

    // ValidationManager 상태 최종 확인
    if (this.validationManager) {
      logger.info("🛡️ ValidationManager 완전 연동됨");
    } else {
      logger.warn("⚠️ ValidationManager 없이 운영 중");
    }

    // 모듈별 상태 요약 (디버그 모드)
    if (this.config.enableDebugLogs) {
      this.logModuleStatus();
    }
  }

  /**
   * 📊 모듈 상태 로깅
   */
  logModuleStatus() {
    logger.debug("📊 모듈 상태 요약:");

    for (const [moduleKey, moduleConfig] of this.moduleRegistry) {
      const instance = this.moduleInstances.get(moduleKey);
      const status = moduleConfig.initialized
        ? "✅"
        : moduleConfig.loaded
        ? "⏳"
        : "❌";
      const hasValidation = instance?.validationManager ? "🛡️" : "❌";

      logger.debug(`   ${status} ${moduleKey} (검증: ${hasValidation})`);
    }
  }

  /**
   * 🎯 표준 콜백 처리 (중앙 라우팅)
   * 매개변수: (bot, callbackQuery, moduleName, subAction, params)
   */
  async handleCallback(bot, callbackQuery, moduleName, subAction, params = {}) {
    const startTime = Date.now();
    const callbackId = `${moduleName}:${subAction}:${Date.now()}`;

    try {
      // 🚫 중복 처리 방지
      if (this.processingCallbacks.has(callbackId)) {
        logger.warn(`중복 콜백 처리 시도: ${callbackId}`);
        return false;
      }

      this.processingCallbacks.add(callbackId);
      this.stats.callbacksHandled++;

      // 🔍 모듈 존재 확인
      const moduleInstance = this.moduleInstances.get(moduleName);
      if (!moduleInstance) {
        logger.warn(`알 수 없는 모듈: ${moduleName}`);
        await this.sendModuleNotFound(bot, callbackQuery, moduleName);
        return false;
      }

      // 🎯 모듈의 표준 콜백 핸들러 호출
      if (
        moduleInstance.handleCallback &&
        typeof moduleInstance.handleCallback === "function"
      ) {
        // ✅ 표준 매개변수로 모듈 호출: (bot, callbackQuery, subAction, params, moduleManager)
        const result = await moduleInstance.handleCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          this // moduleManager 자기 자신 전달
        );

        // 📊 성능 통계 업데이트
        this.updateCallbackStats(true, Date.now() - startTime);

        logger.debug(`✅ ${moduleName}.${subAction} 처리 완료`);
        return result;
      } else {
        logger.warn(`${moduleName}에 handleCallback 메서드가 없습니다`);
        await this.sendMethodNotFound(
          bot,
          callbackQuery,
          moduleName,
          "handleCallback"
        );
        return false;
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 실패 [${moduleName}.${subAction}]:`, error);
      this.stats.errorsCount++;
      this.updateCallbackStats(false, Date.now() - startTime);

      await this.sendCallbackError(
        bot,
        callbackQuery,
        moduleName,
        subAction,
        error
      );
      return false;
    } finally {
      // 🔓 처리 완료 후 중복 방지 해제
      this.processingCallbacks.delete(callbackId);
    }
  }

  /**
   * 📊 콜백 통계 업데이트
   */
  updateCallbackStats(success, responseTime) {
    this.stats.totalCallbackTime += responseTime;
    this.stats.averageCallbackTime = Math.round(
      this.stats.totalCallbackTime / this.stats.callbacksHandled
    );
    this.stats.lastActivity = TimeHelper.getCurrentTime("log");

    // 성능 경고 (Railway 환경 고려)
    const warningThreshold = this.isRailway ? 3000 : 5000;
    if (responseTime > warningThreshold) {
      logger.warn(`⚠️ 느린 콜백 응답: ${responseTime}ms`);
    }
  }

  // ===== 🚨 에러 처리 메서드들 =====

  /**
   * 모듈 없음 에러
   */
  async sendModuleNotFound(bot, callbackQuery, moduleName) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `❌ "${moduleName}" 모듈을 찾을 수 없습니다.`,
        show_alert: true,
      });
    } catch (error) {
      logger.error("모듈 없음 에러 응답 실패:", error);
    }
  }

  /**
   * 메서드 없음 에러
   */
  async sendMethodNotFound(bot, callbackQuery, moduleName, methodName) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `❌ ${moduleName}에 ${methodName} 메서드가 없습니다.`,
        show_alert: true,
      });
    } catch (error) {
      logger.error("메서드 없음 에러 응답 실패:", error);
    }
  }

  /**
   * 콜백 처리 에러
   */
  async sendCallbackError(bot, callbackQuery, moduleName, subAction, error) {
    try {
      const errorMsg = `❌ ${moduleName}.${subAction} 처리 중 오류 발생`;

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: errorMsg,
        show_alert: true,
      });

      // 개발 환경에서는 상세 에러 로깅
      if (this.config.enableDebugLogs) {
        logger.debug(`상세 에러 정보: ${error.message}`);
      }
    } catch (replyError) {
      logger.error("콜백 에러 응답 실패:", replyError);
    }
  }

  // ===== 📊 상태 및 관리 메서드들 =====

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      stats: this.stats,
      moduleCount: {
        total: this.stats.totalModules,
        active: this.stats.activeModules,
        failed: this.stats.failedModules,
      },
      hasValidationManager: !!this.validationManager,
      config: this.config,
      moduleList: Array.from(this.moduleRegistry.keys()),
      activeModules: Array.from(this.moduleInstances.keys()),
    };
  }

  /**
   * 🔄 모듈 다시 로드 (개발 환경용)
   */
  async reloadModule(moduleName) {
    if (!this.config.autoReload) {
      logger.warn("모듈 자동 리로드가 비활성화됨");
      return false;
    }

    try {
      logger.info(`🔄 ${moduleName} 모듈 리로드 시작...`);

      // 기존 모듈 정리
      const existingInstance = this.moduleInstances.get(moduleName);
      if (existingInstance && existingInstance.cleanup) {
        await existingInstance.cleanup();
      }

      // 모듈 캐시 삭제
      const moduleConfig = this.moduleRegistry.get(moduleName);
      if (moduleConfig) {
        delete require.cache[require.resolve(moduleConfig.path)];
      }

      // 새 인스턴스 생성 및 초기화
      await this.createSingleModuleInstance(moduleName);
      const newInstance = this.moduleInstances.get(moduleName);
      if (newInstance) {
        await this.initializeSingleModule(moduleName, newInstance);
      }

      logger.success(`✅ ${moduleName} 모듈 리로드 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleName} 모듈 리로드 실패:`, error);
      return false;
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager 정리 시작...");

      // 모든 모듈 정리
      for (const [moduleKey, moduleInstance] of this.moduleInstances) {
        try {
          if (
            moduleInstance.cleanup &&
            typeof moduleInstance.cleanup === "function"
          ) {
            await moduleInstance.cleanup();
          }
        } catch (error) {
          logger.error(`❌ ${moduleKey} 모듈 정리 실패:`, error);
        }
      }

      // 상태 초기화
      this.moduleInstances.clear();
      this.processingCallbacks.clear();
      this.isInitialized = false;

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
    }
  }
}

module.exports = ModuleManager;
