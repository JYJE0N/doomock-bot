// src/core/ModuleManager.js - 최종 수정 버전

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

  async initialize(bot, { dbManager }) {
    logger.info("🔄 모듈 매니저 초기화를 시작합니다...");

    // 1. ServiceBuilder에 dbManager를 주입하고 초기화합니다.
    this.serviceBuilder.setDatabaseManager(dbManager);
    await this.serviceBuilder.initialize();

    // 2. 등록된 모든 서비스 인스턴스를 미리 생성합니다.
    logger.info("🔧 모든 서비스 인스턴스를 생성합니다...");
    for (const serviceName of this.serviceBuilder.services.keys()) {
      try {
        await this.serviceBuilder.getOrCreate(serviceName);
      } catch (error) {
        logger.error(`💥 [${serviceName}] 서비스 인스턴스 생성 실패:`, error);
      }
    }
    logger.success("✅ 모든 서비스 인스턴스 생성 완료.");

    // 3. 모든 서비스가 준비되었으므로, 모듈을 로드합니다.
    await this.loadModules(bot);
  }

  async loadModules(bot) {
    const moduleConfigs = getEnabledModules();
    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
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
        if (config.enhanced) throw error;
      }
    }
  }

  // ... handleCallback, handleMessage 등 나머지 함수는 동일 ...
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    const module = this.modules.get(moduleKey);
    if (module && typeof module.handleCallback === "function") {
      return module.handleCallback(bot, callbackQuery, subAction, params, this);
    }
    return {
      type: "error",
      message: `'${moduleKey}' 모듈을 처리할 수 없습니다.`,
    };
  }

  async handleMessage(bot, msg) {
    for (const [key, module] of this.modules.entries()) {
      if (typeof module.onHandleMessage === "function") {
        const handled = await module.onHandleMessage(bot, msg);
        if (handled) return true;
      }
    }
    return false;
  }
}

module.exports = ModuleManager;
