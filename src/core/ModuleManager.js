// src/core/ModuleManager.js - 안정화된 최종 버전

const path = require("path");
const logger = require("../utils/Logger");
const { createServiceBuilder } = require("./ServiceBuilder");
const { getEnabledModules } = require("../config/ModuleRegistry");

class ModuleManager {
  constructor() {
    this.modules = new Map();
    this.navigationHandler = null;
    this.serviceBuilder = createServiceBuilder();
  }

  async initialize(bot, { db }) {
    logger.info("🔄 모듈 매니저 초기화를 시작합니다...");
    this.bot = bot;
    this.serviceBuilder.setDefaultDatabase(db);
    await this.serviceBuilder.initialize();
    await this.loadModules();
  }

  setNavigationHandler(handler) {
    this.navigationHandler = handler;
  }

  async loadModules() {
    const moduleConfigs = getEnabledModules();
    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
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

  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    const module = this.modules.get(moduleKey);
    if (module && typeof module.handleCallback === "function") {
      return module.handleCallback(bot, callbackQuery, subAction, params, this);
    }
    logger.warn(`'${moduleKey}' 모듈에 대한 콜백 핸들러를 찾을 수 없습니다.`);
    return {
      type: "error",
      message: `'${moduleKey}' 모듈을 처리할 수 없습니다.`,
    };
  }

  async handleMessage(bot, msg) {
    for (const [key, module] of this.modules.entries()) {
      if (typeof module.onHandleMessage === "function") {
        const handled = await module.onHandleMessage(bot, msg);
        if (handled) {
          logger.info(`💬 메시지가 [${key}] 모듈에 의해 처리되었습니다.`);
          return true;
        }
      }
    }
    return false;
  }
}

module.exports = ModuleManager;
