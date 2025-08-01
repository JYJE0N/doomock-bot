// src/services/BaseService.js
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

    // ✅ 중요: options에서 mongooseManager 받기!
    this.mongooseManager = options.mongooseManager;
  }

  async initialize() {
    if (this.isInitialized) return;

    await this.initializeModels();
    await this.onInitialize();

    this.isInitialized = true;
    logger.success(`✅ ${this.serviceName} 초기화 완료`);
  }

  async initializeModels() {
    // ✅ 수정: getInstance() 대신 전달받은 mongooseManager 사용!
    if (!this.mongooseManager) {
      // 만약 mongooseManager가 없으면 getInstance() 사용 (폴백)
      const { getInstance } = require("../database/MongooseManager");
      this.mongooseManager = getInstance();
      logger.warn(
        `⚠️ ${this.serviceName}: mongooseManager가 전달되지 않아 getInstance() 사용`
      );
    }

    const modelNames = this.getRequiredModels();
    for (const modelName of modelNames) {
      try {
        this.models[modelName] = this.mongooseManager.getModel(modelName);
        logger.debug(`✅ ${this.serviceName}: ${modelName} 모델 로드됨`);
      } catch (error) {
        logger.error(
          `❌ ${this.serviceName}: ${modelName} 모델 로드 실패:`,
          error
        );
        throw error;
      }
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
      modelCount: Object.keys(this.models).length,
      mongooseConnected: this.mongooseManager?.isConnected() || false,
    };
  }

  async cleanup() {
    this.cache.clear();
  }
}

module.exports = BaseService;
