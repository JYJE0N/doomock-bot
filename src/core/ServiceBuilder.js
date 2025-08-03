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
    this.isInitialized = false; // 추가: 초기화 상태 플래그
  }

  setMongooseManager(mongooseManager) {
    this.mongooseManager = mongooseManager;
  }

  async initialize() {
    if (this.isInitialized) {
      logger.debug("ServiceBuilder 이미 초기화됨 - 스킵");
      return;
    }

    try {
      logger.info("🏭 ServiceBuilder 초기화 시작...");

      // ✅ 핵심: 서비스 자동 등록 호출!
      await this.autoRegisterServices();

      this.isInitialized = true;
      logger.success("✅ ServiceBuilder 초기화 완료");
    } catch (error) {
      logger.error("❌ ServiceBuilder 초기화 실패:", error);
      throw error;
    }
  }

  async autoRegisterServices() {
    const servicesDir = path.join(__dirname, "..", "services");

    // 디렉토리 존재 확인
    if (!fs.existsSync(servicesDir)) {
      logger.error(`❌ 서비스 디렉토리가 없습니다: ${servicesDir}`);
      return;
    }

    logger.debug(`📂 서비스 디렉토리 스캔 중: ${servicesDir}`);

    const serviceFiles = fs.readdirSync(servicesDir).filter((file) => file.endsWith("Service.js") && file !== "BaseService.js");

    logger.info(`📄 발견된 서비스 파일: ${serviceFiles.length}개`, serviceFiles);

    for (const file of serviceFiles) {
      try {
        // 서비스 이름 추출 (TodoService.js -> todo)
        const serviceName = file.replace("Service.js", "").toLowerCase();
        const ServiceClass = require(path.join(servicesDir, file));

        // 클래스인지 확인
        if (typeof ServiceClass !== "function") {
          logger.warn(`⚠️ ${file}이 올바른 클래스가 아닙니다`);
          continue;
        }

        this.services.set(serviceName, ServiceClass);
        logger.success(`✅ ${serviceName} 서비스 클래스 등록됨 (${file})`);
      } catch (error) {
        logger.error(`❌ ${file} 등록 실패:`, error);
      }
    }

    // 등록된 서비스 목록 출력
    logger.info(`📦 등록된 서비스 목록:`, Array.from(this.services.keys()));
  }

  async getOrCreate(serviceName) {
    if (this.serviceInstances.has(serviceName)) {
      return this.serviceInstances.get(serviceName);
    }
    return await this.create(serviceName);
  }

  async create(serviceName) {
    logger.debug(`🔍 서비스 생성 시도: ${serviceName}`);
    logger.debug(`📦 사용 가능한 서비스:`, Array.from(this.services.keys()));

    const ServiceClass = this.services.get(serviceName);
    if (!ServiceClass) {
      logger.error(`❌ 등록된 서비스 목록:`, Array.from(this.services.keys()));
      throw new Error(`서비스를 찾을 수 없음: ${serviceName}`);
    }

    try {
      logger.debug(`🏗️ ${serviceName} 인스턴스 생성 중...`);

      // 모든 서비스가 Mongoose 사용
      const instance = new ServiceClass({
        mongooseManager: this.mongooseManager
      });

      // 서비스 초기화
      if (instance.initialize) {
        logger.debug(`🔧 ${serviceName} 초기화 중...`);
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
      mongooseConnected: this.mongooseManager?.isConnected() || false
    };
  }
}

function createServiceBuilder(bot) {
  return new ServiceBuilder(bot);
}

module.exports = { ServiceBuilder, createServiceBuilder };
