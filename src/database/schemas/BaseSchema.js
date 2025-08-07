// src/core/ServiceBuilder.js - Mongoose 지원 버전
const path = require("path");
const fs = require("fs");
const logger = require("../../utils/Logger");

class ServiceBuilder {
  constructor() {
    this.services = new Map();
    this.serviceInstances = new Map();
    this.dbManager = null; // 기존 MongoDB Native용 (나중에 제거 예정)
    this.mongooseManager = null; // Mongoose Manager
  }

  /**
   * DatabaseManager 설정 (기존 호환성)
   */
  setDatabaseManager(dbManager) {
    this.dbManager = dbManager;
  }

  /**
   * MongooseManager 설정
   */
  setMongooseManager(mongooseManager) {
    this.mongooseManager = mongooseManager;
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
        const ServiceClass = require(path.join(servicesDir, file));

        if (typeof ServiceClass !== "function") {
          throw new TypeError(
            `'${file}' 파일에서 유효한 서비스 클래스를 찾을 수 없습니다.`
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

    let instance;

    // Mongoose를 사용하는 서비스들 (점진적 마이그레이션)
    const mongooseServices = ["todo"]; // 일단 todo만!

    if (mongooseServices.includes(serviceName)) {
      // Mongoose 서비스는 별도 설정 불필요
      instance = new ServiceClass({
        config: {},
      });
    } else {
      // 기존 MongoDB Native 서비스들 (나중에 마이그레이션)
      instance = new ServiceClass({
        db: this.dbManager?.getDb(),
        dbManager: this.dbManager,
        config: {},
      });
    }

    if (typeof instance.initialize === "function") {
      try {
        await instance.initialize();
        logger.success(`✅ ${serviceName} 서비스 초기화 성공`);
      } catch (error) {
        logger.error(`❌ ${serviceName} 서비스 초기화 실패:`, error);
        throw error;
      }
    }

    this.serviceInstances.set(serviceName, instance);
    return instance;
  }

  getServiceInstance(serviceName) {
    return this.serviceInstances.get(serviceName);
  }

  /**
   * 모든 서비스 상태 조회
   */
  getAllServiceStatus() {
    const status = {};

    for (const [name, instance] of this.serviceInstances) {
      if (typeof instance.getStatus === "function") {
        status[name] = instance.getStatus();
      } else {
        status[name] = {
          serviceName: name,
          isReady: true,
          message: "Status method not implemented",
        };
      }
    }

    return status;
  }

  /**
   * 서비스 재시작
   */
  async restartService(serviceName) {
    try {
      // 기존 인스턴스 제거
      if (this.serviceInstances.has(serviceName)) {
        const instance = this.serviceInstances.get(serviceName);

        // cleanup 메서드가 있으면 실행
        if (typeof instance.cleanup === "function") {
          await instance.cleanup();
        }

        this.serviceInstances.delete(serviceName);
      }

      // 새 인스턴스 생성
      const newInstance = await this.create(serviceName);
      logger.info(`✅ ${serviceName} 서비스 재시작 완료`);

      return newInstance;
    } catch (error) {
      logger.error(`❌ ${serviceName} 서비스 재시작 실패:`, error);
      throw error;
    }
  }

  /**
   * 모든 서비스 정리
   */
  async cleanup() {
    logger.info("🧹 모든 서비스 정리 시작...");

    for (const [name, instance] of this.serviceInstances) {
      try {
        if (typeof instance.cleanup === "function") {
          await instance.cleanup();
          logger.debug(`✅ ${name} 서비스 정리 완료`);
        }
      } catch (error) {
        logger.error(`❌ ${name} 서비스 정리 실패:`, error);
      }
    }

    this.serviceInstances.clear();
    logger.info("✅ 모든 서비스 정리 완료");
  }
}

function createServiceBuilder() {
  return new ServiceBuilder();
}

module.exports = { createServiceBuilder, ServiceBuilder };
