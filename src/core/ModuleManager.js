// src/core/ModuleManager.js - 매개변수 전달 수정 버전
const logger = require("../utils/Logger");
const { getAllEnabledModules } = require("../config/ModuleRegistry");

class ModuleManager {
  constructor(options = {}) {
    this.bot = options.bot;
    this.serviceBuilder = options.serviceBuilder;
    this.modules = new Map();
    this.navigationHandler = null; // 중복 제거를 위해 하나만

    this.stats = {
      modulesLoaded: 0,
      callbacksProcessed: 0,
      messagesProcessed: 0,
      errorsCount: 0,
      lastActivity: null
    };

    logger.info("🎯 ModuleManager 생성됨 - 표준 매개변수 전달 지원");
  }

  /**
   * 🎯 ModuleManager 초기화 (Mongoose 전용)
   */
  async initialize(bot, options = {}) {
    try {
      logger.info("🎯 ModuleManager 초기화 시작...");

      this.bot = bot;

      // Mongoose Manager만 설정
      if (options.mongooseManager) {
        this.mongooseManager = options.mongooseManager;
      }

      // ✅ 중요: ServiceBuilder가 없으면 에러 발생
      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 설정되지 않았습니다. ModuleManager 생성 시 전달해주세요.");
      }

      // ❌ 삭제: ServiceBuilder 초기화는 BotController에서 이미 완료됨
      // await this.serviceBuilder.initialize();

      // 모듈 로드
      await this.loadModules(bot);

      logger.success("✅ ModuleManager 초기화 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 콜백 처리 (표준 매개변수 전달)
   */
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    try {
      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      logger.debug(`🎯 ModuleManager 콜백 처리:`, {
        moduleKey,
        subAction,
        params,
        userId: callbackQuery.from.id
      });

      // 1. 모듈 찾기
      const moduleInstance = this.modules.get(moduleKey);
      if (!moduleInstance) {
        logger.warn(`❓ 모듈을 찾을 수 없음: ${moduleKey}`);
        return {
          success: false,
          error: "module_not_found",
          message: `${moduleKey} 모듈을 찾을 수 없습니다.`,
          module: moduleKey,
          type: "error"
        };
      }

      // 2. 모듈이 초기화되었는지 확인
      if (!moduleInstance.isInitialized) {
        logger.warn(`❓ 모듈이 초기화되지 않음: ${moduleKey}`);
        return {
          success: false,
          error: "module_not_initialized",
          message: `${moduleKey} 모듈이 아직 초기화되지 않았습니다.`,
          module: moduleKey,
          type: "error"
        };
      }

      // 3. ✅ 표준 매개변수로 모듈 콜백 호출
      logger.debug(`🔄 ${moduleKey} 모듈 호출: ${subAction}(${params})`);

      const result = await moduleInstance.handleCallback(
        bot, // 1번째: bot 인스턴스
        callbackQuery, // 2번째: 텔레그램 콜백쿼리
        subAction, // 3번째: 실행할 액션
        params, // 4번째: 매개변수들
        this // 5번째: ModuleManager 인스턴스
      );

      // 4. 결과 검증 및 표준화
      if (!result) {
        logger.warn(`💫 ${moduleKey}.${subAction} 결과 없음`);
        return {
          success: false,
          error: "no_result",
          message: "모듈에서 결과를 반환하지 않았습니다.",
          module: moduleKey,
          type: "error"
        };
      }

      // 5. 성공 로그
      logger.debug(`✅ ${moduleKey}.${subAction} 처리 완료`, {
        resultType: result.type || "unknown",
        hasData: !!result.data
      });

      // 6. 결과에 모듈 정보 추가
      return {
        ...result,
        module: result.module || moduleKey,
        processedBy: "ModuleManager",
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`💥 ModuleManager 콜백 처리 오류:`, error, {
        moduleKey,
        subAction,
        params
      });

      this.stats.errorsCount++;

      return {
        success: false,
        error: "processing_error",
        message: "콜백 처리 중 오류가 발생했습니다.",
        module: moduleKey,
        type: "error",
        originalError: error.message
      };
    }
  }

  /**
   * 🎯 모듈 로드
   */
  async loadModules(bot) {
    const enabledModules = getAllEnabledModules();

    for (const config of enabledModules) {
      try {
        logger.info(`📦 [${config.key}] 모듈 로드 시작...`);

        const ModuleClass = require(config.path);

        const moduleInstance = new ModuleClass(config.key, {
          bot: bot,
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config || {}
        });

        await moduleInstance.initialize();
        this.modules.set(config.key, moduleInstance);

        logger.success(`✅ [${config.key}] 모듈 로드 완료`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);
        logger.warn(`⚠️ ${config.key} 모듈 로드 실패했지만 계속 진행합니다`);
        continue;
      }
    }

    this.stats.modulesLoaded = this.modules.size;
    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);
  }

  /**
   * 🎯 NavigationHandler 연결 (중복 제거)
   */
  setNavigationHandler(navigationHandler) {
    this.navigationHandler = navigationHandler;
    logger.debug("🔗 NavigationHandler 연결됨");
  }

  /**
   * 특정 모듈 가져오기
   */
  getModule(moduleKey) {
    return this.modules.get(moduleKey);
  }

  /**
   * 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      logger.info(`🔄 ${moduleKey} 모듈 재시작 시작...`);

      const config = getAllEnabledModules().find((m) => m.key === moduleKey);
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없습니다: ${moduleKey}`);
      }

      const oldModule = this.modules.get(moduleKey);
      if (oldModule && typeof oldModule.cleanup === "function") {
        await oldModule.cleanup();
        logger.debug(`🧹 ${moduleKey} 기존 모듈 정리 완료`);
      }

      delete require.cache[require.resolve(config.path)];

      const ModuleClass = require(config.path);
      const moduleInstance = new ModuleClass(moduleKey, {
        bot: this.bot,
        moduleManager: this,
        serviceBuilder: this.serviceBuilder,
        config: config.config || {}
      });

      await moduleInstance.initialize();
      this.modules.set(moduleKey, moduleInstance);

      logger.success(`✅ ${moduleKey} 모듈 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 재시작 실패:`, error);
      throw error;
    }
  }
}

module.exports = ModuleManager;
