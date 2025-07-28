// src/core/ServiceBuilder.js - 최종 수정 버전

const path = require("path");
const fs = require("fs");
const logger = require("../utils/Logger");

class ServiceBuilder {
  constructor() {
    this.services = new Map();
    this.serviceInstances = new Map();
    this.dbManager = null; // dbManager는 나중에 주입됩니다.
  }

  setDatabaseManager(dbManager) {
    this.dbManager = dbManager;
  }

  async initialize() {
    await this.autoRegisterServices();
  }

  async autoRegisterServices() {
    logger.info("🔍 서비스 자동 등록 시작...");
    const servicesDir = path.join(__dirname, "..", "services");
    const serviceFiles = fs
      .readdirSync(servicesDir)
      .filter(
        (file) => file.endsWith("Service.js") && file !== "BaseService.js"
      );

    for (const file of serviceFiles) {
      try {
        const serviceName = file.replace("Service.js", "").toLowerCase();
        const requiredModule = require(path.join(servicesDir, file));

        // [가장 중요한 수정] 서류 가방(객체)에서 설계도(클래스)를 정확히 꺼냅니다.
        // 대부분의 경우, 파일 이름과 동일한 이름의 클래스를 export합니다.
        const ServiceClass =
          requiredModule[file.replace(".js", "")] || requiredModule;

        if (typeof ServiceClass !== "function") {
          throw new TypeError(
            `'${file}' 파일에서 유효한 서비스 클래스(생성자)를 찾을 수 없습니다.`
          );
        }

        this.register(serviceName, ServiceClass);
      } catch (error) {
        logger.error(`❌ 서비스 자동 등록 실패 (${file}):`, error);
      }
    }
    logger.success(
      `🎉 ${this.services.size}개 서비스가 성공적으로 등록되었습니다.`
    );
  }

  register(serviceName, ServiceClass) {
    if (this.services.has(serviceName)) {
      return;
    }
    this.services.set(serviceName, ServiceClass);
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
      throw new Error(`등록되지 않은 서비스: ${serviceName}`);
    }

    const instance = new ServiceClass({ dbManager: this.dbManager });

    if (typeof instance.initialize === "function") {
      await instance.initialize();
    }

    this.serviceInstances.set(serviceName, instance);
    return instance;
  }

  getServiceInstance(serviceName) {
    return this.serviceInstances.get(serviceName);
  }
}

function createServiceBuilder() {
  return new ServiceBuilder();
}

module.exports = { createServiceBuilder, ServiceBuilder };
