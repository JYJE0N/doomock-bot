// src/core/ModuleManager.js - Mongoose 지원 버전
const path = require("path");
const logger = require("../utils/Logger");
const { createServiceBuilder } = require("./ServiceBuilder");
const { getEnabledModules } = require("../config/ModuleRegistry");

class ModuleManager {
  constructor() {
    this.modules = new Map();
    this.serviceBuilder = createServiceBuilder();
    this.navigationHandler = null;
  }

  setNavigationHandler(handler) {
    this.navigationHandler = handler;
  }

  async initialize(bot, { dbManager, mongooseManager }) {
    logger.info("🔄 모듈 매니저 초기화를 시작합니다...");

    // 1. ServiceBuilder에 양쪽 DB 매니저 주입
    this.serviceBuilder.setDatabaseManager(dbManager);
    this.serviceBuilder.setMongooseManager(mongooseManager);
    await this.serviceBuilder.initialize();

    // 2. 모든 서비스 인스턴스를 미리 생성
    logger.info("🔧 모든 서비스 인스턴스를 생성합니다...");

    for (const serviceName of this.serviceBuilder.services.keys()) {
      try {
        logger.info(`🔧 ${serviceName} 서비스 생성 중...`);
        await this.serviceBuilder.getOrCreate(serviceName);
      } catch (error) {
        logger.error(`💥 [${serviceName}] 서비스 인스턴스 생성 실패:`, error);
      }
    }

    logger.success("✅ 모든 서비스 인스턴스 생성 완료.");

    // 3. 모든 서비스가 준비되었으므로, 모듈을 로드
    await this.loadModules(bot);

    // 4. 서비스 상태 로깅
    this.logServiceStatus();
  }

  async loadModules(bot) {
    const moduleConfigs = getEnabledModules();
    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
        logger.debug(`📁 ${config.key} 경로: ${config.path}`);

        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(bot, {
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config,
        });

        await moduleInstance.initialize();
        this.modules.set(config.key, moduleInstance);
        logger.success(`✅ [${config.key}] 모듈 로드 완료.`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);

        // enhanced 모듈이 실패하면 전체 실패
        if (config.enhanced) {
          throw error;
        }
      }
    }

    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);
  }

  /**
   * 서비스 상태 로깅
   */
  logServiceStatus() {
    const serviceStatus = this.serviceBuilder.getAllServiceStatus();

    logger.info("📊 ═══ 서비스 상태 ═══");
    for (const [name, status] of Object.entries(serviceStatus)) {
      const emoji = status.isReady ? "✅" : "❌";
      logger.info(`${emoji} ${name}: ${status.message || "Ready"}`);
    }
    logger.info("📊 ═════════════════");
  }

  /**
   * 콜백 쿼리 처리
   */
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    const module = this.modules.get(moduleKey);

    if (!module) {
      logger.warn(`존재하지 않는 모듈: ${moduleKey}`);
      return {
        type: "error",
        message: `'${moduleKey}' 모듈을 찾을 수 없습니다.`,
      };
    }

    if (typeof module.handleCallback !== "function") {
      logger.warn(`${moduleKey} 모듈에 handleCallback 메서드가 없습니다`);
      return {
        type: "error",
        message: `'${moduleKey}' 모듈에서 콜백을 처리할 수 없습니다.`,
      };
    }

    try {
      return await module.handleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        this
      );
    } catch (error) {
      logger.error(`${moduleKey} 모듈 콜백 처리 오류:`, error);
      return {
        type: "error",
        message: "처리 중 오류가 발생했습니다.",
        error: error.message,
      };
    }
  }

  /**
   * 메시지 처리
   */
  async handleMessage(bot, msg) {
    for (const [key, module] of this.modules.entries()) {
      if (typeof module.onHandleMessage === "function") {
        try {
          const handled = await module.onHandleMessage(bot, msg);
          if (handled) {
            logger.debug(`메시지가 ${key} 모듈에서 처리됨`);
            return true;
          }
        } catch (error) {
          logger.error(`${key} 모듈 메시지 처리 오류:`, error);
        }
      }
    }
    return false;
  }

  /**
   * 특정 모듈 가져오기
   */
  getModule(moduleKey) {
    return this.modules.get(moduleKey);
  }

  /**
   * 모든 모듈 목록
   */
  getModuleList() {
    return Array.from(this.modules.keys());
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    const moduleStatus = {};

    for (const [key, module] of this.modules.entries()) {
      moduleStatus[key] = {
        initialized: module.isInitialized || false,
        stats: module.stats || {},
        hasService: !!module.serviceInstance,
      };
    }

    return {
      loadedModules: this.modules.size,
      activeModules: Array.from(this.modules.values()).filter(
        (m) => m.isInitialized
      ).length,
      modules: moduleStatus,
    };
  }

  /**
   * 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      const config = getEnabledModules().find((m) => m.key === moduleKey);
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없습니다: ${moduleKey}`);
      }

      // 기존 모듈 정리
      const oldModule = this.modules.get(moduleKey);
      if (oldModule && typeof oldModule.cleanup === "function") {
        await oldModule.cleanup();
      }

      // 모듈 재로드
      delete require.cache[require.resolve(config.path)];
      const ModuleClass = require(config.path);

      const moduleInstance = new ModuleClass(this.bot, {
        moduleManager: this,
        serviceBuilder: this.serviceBuilder,
        config: config.config,
      });

      await moduleInstance.initialize();
      this.modules.set(moduleKey, moduleInstance);

      logger.info(`✅ ${moduleKey} 모듈 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 재시작 실패:`, error);
      throw error;
    }
  }

  /**
   * 모든 모듈 정리
   */
  async cleanup() {
    logger.info("🧹 모든 모듈 정리 시작...");

    for (const [key, module] of this.modules.entries()) {
      try {
        if (typeof module.cleanup === "function") {
          await module.cleanup();
          logger.debug(`✅ ${key} 모듈 정리 완료`);
        }
      } catch (error) {
        logger.error(`❌ ${key} 모듈 정리 실패:`, error);
      }
    }

    // 서비스도 정리
    await this.serviceBuilder.cleanup();

    this.modules.clear();
    logger.info("✅ 모든 모듈 정리 완료");
  }
}

module.exports = ModuleManager;
