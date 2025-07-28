// src/core/ServiceBuilder.js - 수정된 최종 버전
const path = require("path");
const fs = require("fs");
const logger = require("../utils/Logger");

class ServiceBuilder {
  constructor() {
    this.services = new Map();
    this.serviceInstances = new Map();
    this.db = null;
    logger.info("🏗️ ServiceBuilder v3.0.1 생성됨");
  }

  setDefaultDatabase(db) {
    this.db = db;
    logger.info("🔧 ServiceBuilder에 기본 DB 설정됨");
  }

  async initialize() {
    logger.info("🎯 ServiceBuilder 초기화 시작...");
    await this.autoRegisterServices();
    logger.success("✅ ServiceBuilder 초기화 완료");
  }

  async autoRegisterServices() {
    logger.info("🔍 서비스 자동 등록 시작...");
    const servicesDir = path.join(__dirname, "..", "services");
    const serviceFiles = fs
      .readdirSync(servicesDir)
      .filter((file) => file.endsWith("Service.js"));

    for (const file of serviceFiles) {
      try {
        const serviceName = file.replace("Service.js", "").toLowerCase();
        const ServiceClass = require(path.join(servicesDir, file));
        this.register(serviceName, ServiceClass);
      } catch (error) {
        logger.error(`❌ 서비스 자동 등록 실패 (${file}):`, error);
      }
    }
    logger.success(`🎉 ${this.services.size}개 서비스 자동 등록 완료`);
  }

  register(serviceName, ServiceClass) {
    if (this.services.has(serviceName)) {
      logger.warn(`[ServiceBuilder] 이미 등록된 서비스: ${serviceName}`);
      return;
    }
    this.services.set(serviceName, ServiceClass);
  }

  async getOrCreate(serviceName, options = {}) {
    if (this.serviceInstances.has(serviceName)) {
      return this.serviceInstances.get(serviceName);
    }
    const instance = await this.create(serviceName, options);
    return instance;
  }

  async create(serviceName, options) {
    // <--- serviceOptions -> options로 수정
    const ServiceClass = this.services.get(serviceName);
    if (!ServiceClass) {
      throw new Error(`등록되지 않은 서비스: ${serviceName}`);
    }

    // [수정] serviceOptions -> options 로 변수명 수정
    const instance = new ServiceClass({ db: this.db, ...options });

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
