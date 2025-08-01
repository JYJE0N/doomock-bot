// src/core/ServiceBuilder.js - Mongoose 전용 서비스 빌더

const path = require("path");
const fs = require("fs");
const logger = require("../utils/Logger");

/**
 * 🏭 ServiceBuilder - 서비스 팩토리 (Mongoose 전용)
 *
 * ✅ 주요 변경사항:
 * - MongoDB Native Driver 지원 제거
 * - 모든 서비스가 Mongoose 사용
 * - 코드 단순화
 */
class ServiceBuilder {
  constructor(bot) {
    this.bot = bot;
    this.services = new Map();
    this.serviceInstances = new Map();
    this.mongooseManager = null;
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
        logger.debug(`📦 ${serviceName} 서비스 클래스 등록됨`);
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
      throw new Error(`서비스를 찾을 수 없음: ${serviceName}`);
    }

    try {
      // 모든 서비스가 Mongoose 사용
      const instance = new ServiceClass({
        mongooseManager: this.mongooseManager,
      });

      // 서비스 초기화
      if (instance.initialize) {
        await instance.initialize();
      }

      this.serviceInstances.set(serviceName, instance);
      logger.success(`✅ ${serviceName} 서비스 인스턴스 생성됨`);

      return instance;
    } catch (error) {
      logger.error(`❌ ${serviceName} 서비스 생성 실패:`, error);
      throw error;
    }
  }

  getServiceInstance(serviceName) {
    return this.serviceInstances.get(serviceName);
  }

  async cleanup() {
    logger.info("🧹 ServiceBuilder 정리 시작...");

    for (const [name, instance] of this.serviceInstances) {
      if (instance.cleanup) {
        try {
          await instance.cleanup();
          logger.debug(`✅ ${name} 서비스 정리 완료`);
        } catch (error) {
          logger.warn(`⚠️ ${name} 서비스 정리 실패:`, error.message);
        }
      }
    }

    this.serviceInstances.clear();
    this.services.clear();

    logger.success("✅ ServiceBuilder 정리 완료");
  }

  getStatus() {
    return {
      registeredServices: Array.from(this.services.keys()),
      activeInstances: Array.from(this.serviceInstances.keys()),
      mongooseConnected: this.mongooseManager?.isConnected() || false,
    };
  }
}

function createServiceBuilder(bot) {
  return new ServiceBuilder(bot);
}

module.exports = { ServiceBuilder, createServiceBuilder };
