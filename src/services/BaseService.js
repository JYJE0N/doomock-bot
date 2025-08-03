const logger = require("../utils/Logger");

/**
 * 🏗️ BaseService - 모든 서비스의 부모 (심플 버전)
 */
class BaseService {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.models = {};
    this.cache = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    await this.initializeModels();
    await this.onInitialize();

    this.isInitialized = true;
    logger.success(`✅ ${this.serviceName} 초기화 완료`);
  }

  async initializeModels() {
    const { getInstance } = require("../database/MongooseManager");
    const mongooseManager = getInstance();

    const modelNames = this.getRequiredModels();
    for (const modelName of modelNames) {
      this.models[modelName] = mongooseManager.getModel(modelName);
    }
  }

  getRequiredModels() {
    return []; // 자식 클래스에서 구현
  }

  async onInitialize() {
    // 자식 클래스에서 구현
  }

  createSuccessResponse(data, message = "완료") {
    return { success: true, data, message };
  }

  createErrorResponse(error, message = "오류 발생") {
    logger.error(`${this.serviceName} 오류:`, error);
    return { success: false, error: error.message, message };
  }

  getStatus() {
    return {
      serviceName: this.serviceName,
      isInitialized: this.isInitialized,
      modelCount: Object.keys(this.models).length
    };
  }

  async cleanup() {
    this.cache.clear();
  }
}

module.exports = BaseService;
