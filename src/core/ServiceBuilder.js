const path = require("path");
const fs = require("fs");
const logger = require("../utils/Logger");

/**
 * 🏭 ServiceBuilder - 서비스 팩토리 (심플 버전)
 *
 * 🎯 핵심 기능만:
 * - 서비스 자동 등록
 * - 인스턴스 생성 및 캐싱
 * - Mongoose/Native 이중 지원
 */
class ServiceBuilder {
  constructor() {
    this.services = new Map();
    this.serviceInstances = new Map();
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
    const mongooseServices = ["todo", "timer", "leave"];

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

function createServiceBuilder() {
  return new ServiceBuilder();
}

module.exports = { ServiceBuilder, createServiceBuilder };
