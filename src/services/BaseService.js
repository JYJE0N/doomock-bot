const logger = require('../utils/core/Logger');

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

    // 디버깅 로그 추가
    logger.debug(
      `${this.serviceName} - MongoDB 연결 상태:`,
      mongooseManager.isConnected()
    );
    logger.debug(
      `${this.serviceName} - 등록된 모델:`,
      mongooseManager.models.keys()
    );

    const modelNames = this.getRequiredModels();
    for (const modelName of modelNames) {
      try {
        this.models[modelName] = mongooseManager.getModel(modelName);
        logger.debug(`${this.serviceName} - ${modelName} 모델 로드 성공`);
      } catch (error) {
        logger.error(
          `${this.serviceName} - ${modelName} 모델 로드 실패:`,
          error
        );
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
      modelCount: Object.keys(this.models).length
    };
  }

  async cleanup() {
    this.cache.clear();
  }
}

module.exports = BaseService;
