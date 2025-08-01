const path = require("path");
const fs = require("fs");
const logger = require("../utils/Logger");

/**
 * 🏭 ServiceBuilder - 서비스 팩토리 (수정된 버전)
 *
 * 🎯 핵심 기능:
 * - 서비스 자동 등록
 * - 인스턴스 생성 및 캐싱
 * - Mongoose/Native 이중 지원
 */
class ServiceBuilder {
  constructor(bot, menuManager) {
    this.bot = bot;
    this.menuManager = menuManager;
    this.services = new Map();
    this.serviceInstances = new Map(); // ⭐ 이것이 누락되어 있었음!
    this.dbManager = null;
    this.mongooseManager = null;
  }

  setDatabaseManager(dbManager) {
    this.dbManager = dbManager;
  }

  setMongooseManager(mongooseManager) {
    this.mongooseManager = mongooseManager;
  }

  async initialize() {
    await this.autoRegisterServices();
    logger.success(`✅ ${this.services.size}개 서비스 등록 완료`);
  }

  async autoRegisterServices() {
    const servicesDir = path.join(__dirname, "..", "services");
    const serviceFiles = fs
      .readdirSync(servicesDir)
      .filter(
        (file) => file.endsWith("Service.js") && file !== "BaseService.js"
      );

    for (const file of serviceFiles) {
      try {
        const serviceName = file.replace("Service.js", "").toLowerCase();
        const ServiceClass = require(path.join(servicesDir, file));
        this.services.set(serviceName, ServiceClass);
      } catch (error) {
        logger.error(`❌ ${file} 등록 실패:`, error);
      }
    }
  }

  async getOrCreate(serviceName) {
    // serviceInstances가 이제 제대로 정의되어 있으므로 에러가 발생하지 않음
    if (this.serviceInstances.has(serviceName)) {
      return this.serviceInstances.get(serviceName);
    }
    return await this.create(serviceName);
  }

  async create(serviceName) {
    const ServiceClass = this.services.get(serviceName);
    if (!ServiceClass) {
      throw new Error(`서비스 없음: ${serviceName}`);
    }

    // Mongoose 서비스들
    const mongooseServices = ["todo", "timer", "leave", "tts"];

    let instance;
    if (mongooseServices.includes(serviceName)) {
      instance = new ServiceClass();
    } else {
      instance = new ServiceClass({
        db: this.dbManager?.getDb(),
        dbManager: this.dbManager,
      });
    }

    if (instance.initialize) {
      await instance.initialize();
    }

    this.serviceInstances.set(serviceName, instance);
    return instance;
  }

  getServiceInstance(serviceName) {
    return this.serviceInstances.get(serviceName);
  }

  async cleanup() {
    for (const [name, instance] of this.serviceInstances) {
      if (instance.cleanup) {
        await instance.cleanup();
      }
    }
    this.serviceInstances.clear();
  }
}

function createServiceBuilder(bot, menuManager) {
  return new ServiceBuilder(bot, menuManager);
}

module.exports = { ServiceBuilder, createServiceBuilder };
