// src/core/ModuleManager.js - Mongoose 지원 버전
const path = require("path");
const logger = require("../utils/Logger");
const { createServiceBuilder } = require("./ServiceBuilder");
const { getEnabledModules } = require("../config/ModuleRegistry");

class ModuleManager {
  constructor() {
    this.modules = new Map();
    this.serviceBuilder = createServiceBuilder();
    this.navigationHandler = null;
  }

  setNavigationHandler(handler) {
    this.navigationHandler = handler;
  }

  async initialize(bot, { dbManager, mongooseManager }) {
    logger.info("🔄 모듈 매니저 초기화를 시작합니다...");

    // 1. ServiceBuilder에 양쪽 DB 매니저 주입
    this.serviceBuilder.setDatabaseManager(dbManager);
    this.serviceBuilder.setMongooseManager(mongooseManager);
    await this.serviceBuilder.initialize();

    // 2. 모든 서비스 인스턴스를 미리 생성
    logger.info("🔧 모든 서비스 인스턴스를 생성합니다...");

    for (const serviceName of this.serviceBuilder.services.keys()) {
      try {
        logger.info(`🔧 ${serviceName} 서비스 생성 중...`);
        await this.serviceBuilder.getOrCreate(serviceName);
      } catch (error) {
        logger.error(`💥 [${serviceName}] 서비스 인스턴스 생성 실패:`, error);
      }
    }

    logger.success("✅ 모든 서비스 인스턴스 생성 완료.");

    // 3. 모든 서비스가 준비되었으므로, 모듈을 로드
    await this.loadModules(bot);

    // 4. 서비스 상태 로깅
    this.logServiceStatus();
  }

  async loadModules(bot) {
    const moduleConfigs = getEnabledModules();
    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
        logger.debug(`📁 ${config.key} 경로: ${config.path}`);

        const ModuleClass = require(config.path);

        // 🔥 핵심 수정: BaseModule 매개변수 구조에 맞게 수정
        const moduleInstance = new ModuleClass(config.key, {
          bot: bot, // bot을 options 안으로 이동
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config,
        });

        await moduleInstance.initialize();
        this.modules.set(config.key, moduleInstance);
        logger.success(`✅ [${config.key}] 모듈 로드 완료.`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);

        // enhanced 모듈이 실패하면 전체 실패
        if (config.enhanced) {
          throw error;
        }
      }
    }

    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);
  }

  /**
   * 📊 서비스 상태별 이모지 결정
   */
  getServiceStatusEmoji(status, moduleKey) {
    // 상태가 없거나 null인 경우
    if (!status) {
      return "❌";
    }

    // 상태가 객체인 경우 (일부 서비스는 객체로 상태 반환)
    if (typeof status === "object" && status !== null) {
      // isConnected 체크
      if (status.isConnected === true) {
        return "✅";
      } else if (status.isConnected === false) {
        return "❌";
      }

      // status 필드 체크
      if (status.status === "Ready" || status.status === "ready") {
        return "✅";
      } else if (status.status === "error" || status.status === "Error") {
        return "❌";
      }

      // healthy 필드 체크
      if (status.healthy === true) {
        return "✅";
      } else if (status.healthy === false) {
        return "❌";
      }

      // serviceName만 있는 경우 (기본 getStatus)
      if (status.serviceName && !status.status) {
        return "✅"; // 기본 상태 객체는 정상으로 간주
      }

      return "⚠️"; // 기타 객체 상태
    }

    // 상태가 문자열인 경우
    if (typeof status === "string") {
      const statusLower = status.toLowerCase();

      if (
        statusLower === "ready" ||
        statusLower === "정상" ||
        statusLower === "ok"
      ) {
        return "✅";
      } else if (
        statusLower === "error" ||
        statusLower === "오류" ||
        statusLower === "failed"
      ) {
        return "❌";
      } else if (
        statusLower.includes("status method not implemented") ||
        statusLower.includes("not implemented")
      ) {
        return "⚠️"; // 구현되지 않은 메서드는 경고
      } else {
        return "⚠️"; // 기타 문자열 상태
      }
    }

    // boolean인 경우
    if (typeof status === "boolean") {
      return status ? "✅" : "❌";
    }

    // 기타 모든 경우
    return "⚠️";
  }

  /**
   * 📊 서비스 상태 출력 (수정된 버전)
   */
  logServiceStatus() {
    logger.info("📊 ═══ 서비스 상태 ═══");

    this.modules.forEach((module, key) => {
      let status = "Status method not implemented";
      let emoji = "⚠️"; // 기본값을 경고로 변경!

      try {
        if (typeof module.getStatus === "function") {
          status = module.getStatus();
          emoji = this.getServiceStatusEmoji(status, key);
        } else {
          // getStatus 메서드가 없으면 경고 이모지
          emoji = "⚠️";
        }
      } catch (error) {
        status = `Error: ${error.message}`;
        emoji = "❌";
      }

      // 상태 문자열 정리
      const statusString =
        typeof status === "object"
          ? this.formatStatusObject(status)
          : String(status);

      logger.info(`${emoji} ${key}: ${statusString}`);
    });

    logger.info("📊 ═════════════════");
  }
  /**
   * 📊 상태 객체 포맷팅
   */
  formatStatusObject(status) {
    if (!status || typeof status !== "object") {
      return String(status);
    }

    // 주요 정보만 추출해서 표시
    const parts = [];

    if (status.status) {
      parts.push(status.status);
    } else if (status.isConnected !== undefined) {
      parts.push(status.isConnected ? "Connected" : "Disconnected");
    } else if (status.healthy !== undefined) {
      parts.push(status.healthy ? "Healthy" : "Unhealthy");
    } else if (status.serviceName) {
      parts.push("Ready"); // 기본 상태 객체는 Ready로 표시
    }

    // 추가 정보 (선택사항)
    if (status.cacheSize !== undefined) {
      parts.push(`Cache: ${status.cacheSize}`);
    }

    if (status.collectionName) {
      parts.push(`DB: ${status.collectionName}`);
    }

    return parts.length > 0 ? parts.join(", ") : JSON.stringify(status);
  }
  /**
   * 콜백 쿼리 처리
   */
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    const module = this.modules.get(moduleKey);

    if (!module) {
      logger.warn(`존재하지 않는 모듈: ${moduleKey}`);
      return {
        type: "error",
        message: `'${moduleKey}' 모듈을 찾을 수 없습니다.`,
      };
    }

    if (typeof module.handleCallback !== "function") {
      logger.warn(`${moduleKey} 모듈에 handleCallback 메서드가 없습니다`);
      return {
        type: "error",
        message: `'${moduleKey}' 모듈에서 콜백을 처리할 수 없습니다.`,
      };
    }

    try {
      return await module.handleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        this
      );
    } catch (error) {
      logger.error(`${moduleKey} 모듈 콜백 처리 오류:`, error);
      return {
        type: "error",
        message: "처리 중 오류가 발생했습니다.",
        error: error.message,
      };
    }
  }

  /**
   * 메시지 처리
   */
  async handleMessage(bot, msg) {
    for (const [key, module] of this.modules.entries()) {
      if (typeof module.onHandleMessage === "function") {
        try {
          const handled = await module.onHandleMessage(bot, msg);
          if (handled) {
            logger.debug(`메시지가 ${key} 모듈에서 처리됨`);
            return true;
          }
        } catch (error) {
          logger.error(`${key} 모듈 메시지 처리 오류:`, error);
        }
      }
    }
    return false;
  }

  /**
   * 특정 모듈 가져오기
   */
  getModule(moduleKey) {
    return this.modules.get(moduleKey);
  }

  /**
   * 모든 모듈 목록
   */
  getModuleList() {
    return Array.from(this.modules.keys());
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    const moduleStatus = {};

    for (const [key, module] of this.modules.entries()) {
      moduleStatus[key] = {
        initialized: module.isInitialized || false,
        stats: module.stats || {},
        hasService: !!module.serviceInstance,
      };
    }

    return {
      loadedModules: this.modules.size,
      activeModules: Array.from(this.modules.values()).filter(
        (m) => m.isInitialized
      ).length,
      modules: moduleStatus,
    };
  }

  /**
   * 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      const config = getEnabledModules().find((m) => m.key === moduleKey);
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없습니다: ${moduleKey}`);
      }

      // 기존 모듈 정리
      const oldModule = this.modules.get(moduleKey);
      if (oldModule && typeof oldModule.cleanup === "function") {
        await oldModule.cleanup();
      }

      // 모듈 재로드
      delete require.cache[require.resolve(config.path)];
      const ModuleClass = require(config.path);

      // 🔥 수정: 표준 매개변수 구조 적용
      const moduleInstance = new ModuleClass(moduleKey, {
        bot: this.bot, // bot을 options 안에 포함
        moduleManager: this,
        serviceBuilder: this.serviceBuilder,
        config: config.config,
      });

      await moduleInstance.initialize();
      this.modules.set(moduleKey, moduleInstance);

      logger.info(`✅ ${moduleKey} 모듈 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 재시작 실패:`, error);
      throw error;
    }
  }

  async loadModules(bot) {
    const moduleConfigs = getEnabledModules();
    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
        logger.debug(`📁 ${config.key} 경로: ${config.path}`);

        const ModuleClass = require(config.path);

        // 🔥 핵심 수정: BaseModule 표준 매개변수 구조에 맞춤
        const moduleInstance = new ModuleClass(config.key, {
          bot: bot, // BaseModule이 기대하는 구조
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config,
        });

        await moduleInstance.initialize();
        this.modules.set(config.key, moduleInstance);
        logger.success(`✅ [${config.key}] 모듈 로드 완료.`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);

        // enhanced 모듈이 실패하면 전체 실패
        if (config.enhanced) {
          throw error;
        }
      }
    }

    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);
  }

  /**
   * 모든 모듈 정리
   */
  async cleanup() {
    logger.info("🧹 모든 모듈 정리 시작...");

    for (const [key, module] of this.modules.entries()) {
      try {
        if (typeof module.cleanup === "function") {
          await module.cleanup();
          logger.debug(`✅ ${key} 모듈 정리 완료`);
        }
      } catch (error) {
        logger.error(`❌ ${key} 모듈 정리 실패:`, error);
      }
    }

    // 서비스도 정리
    await this.serviceBuilder.cleanup();

    this.modules.clear();
    logger.info("✅ 모든 모듈 정리 완료");
  }
}

module.exports = ModuleManager;
