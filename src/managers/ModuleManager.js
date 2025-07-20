// src/managers/ModuleManager.js - 싱글톤 패턴으로 무한 루프 방지

const logger = require("../utils/Logger");
const path = require("path");
const fs = require("fs");

// 🔒 싱글톤 인스턴스 저장소
let moduleManagerInstance = null;

class ModuleManager {
  constructor(bot, options = {}) {
    // 🚨 싱글톤 패턴 - 중복 생성 방지
    if (moduleManagerInstance) {
      logger.warn("⚠️ ModuleManager 이미 존재함, 기존 인스턴스 반환");
      return moduleManagerInstance;
    }

    this.bot = bot;
    this.options = options;

    // 핵심 상태
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;

    // 캐시 정리 추적
    this.cleanedCaches = new Set();

    // 처리 중복 방지
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // 데이터베이스 참조
    this.db = options.dbManager || null;

    // 글로벌 통계
    this.globalStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      successfulMessages: 0,
      successfulCallbacks: 0,
      moduleErrors: new Map(),
      uniqueUsers: new Set(),
    };

    // 싱글톤 인스턴스 저장
    moduleManagerInstance = this;

    logger.info("🔧 ModuleManager 생성됨 (싱글톤)");
  }

  // =============== 초기화 ===============

  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    if (this.initializationPromise) {
      logger.debug("ModuleManager 초기화 진행 중...");
      return await this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return await this.initializationPromise;
  }

  async _doInitialize() {
    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 1. 데이터베이스 연결 확인
      await this._ensureDatabaseConnection();

      // 2. 모듈 로드 및 초기화
      await this._loadModulesSafely();
      await this._initializeModules();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // ✅ 데이터베이스 연결 확인
  async _ensureDatabaseConnection() {
    try {
      if (!process.env.MONGO_URL && !process.env.MONGODB_URI) {
        logger.warn("⚠️ MongoDB URL이 없음, 메모리 모드로 계속");
        return;
      }

      if (this.db && this.db.isConnected) {
        logger.debug("📋 데이터베이스 이미 연결됨");
        return;
      }

      // 옵션에서 전달받은 dbManager가 있으면 사용
      if (this.options.dbManager) {
        this.db = this.options.dbManager;
        logger.debug("✅ 전달받은 DatabaseManager 사용");
        return;
      }

      // DatabaseManager 없으면 메모리 모드
      logger.warn("⚠️ DatabaseManager 없음, 메모리 모드로 실행");
      this.db = null;
    } catch (error) {
      logger.warn("⚠️ 데이터베이스 연결 확인 실패:", error.message);
      this.db = null;
    }
  }

  // ✅ 안전한 모듈 로드
  async _loadModulesSafely() {
    const moduleConfigs = [
      { name: "SystemModule", path: "../modules/SystemModule", required: true },
      { name: "TodoModule", path: "../modules/TodoModule", required: false },
      {
        name: "FortuneModule",
        path: "../modules/FortuneModule",
        required: false,
      },
      {
        name: "WeatherModule",
        path: "../modules/WeatherModule",
        required: false,
      },
      { name: "UtilsModule", path: "../modules/UtilsModule", required: false },
    ];

    let loadedCount = 0;
    let failedCount = 0;

    for (const config of moduleConfigs) {
      try {
        const ModuleClass = require(config.path);

        if (typeof ModuleClass === "function") {
          this.modules.set(config.name, ModuleClass);
          loadedCount++;
          logger.debug(`✅ ${config.name} 로드 완료`);
        } else {
          throw new Error(`${config.name}이 올바른 클래스가 아닙니다`);
        }
      } catch (error) {
        failedCount++;
        logger.warn(`⚠️ 모듈 로드 실패 (${config.name}):`, error.message);

        if (config.required) {
          throw new Error(`필수 모듈 로드 실패: ${config.name}`);
        }
      }
    }

    logger.success(
      `📦 모듈 로드 완료: ${loadedCount}개 성공, ${failedCount}개 실패`
    );
  }

  // ✅ 모듈 초기화
  async _initializeModules() {
    logger.info("🔧 모듈 초기화 시작...");

    const initResults = [];

    for (const [name, ModuleClass] of this.modules) {
      try {
        logger.debug(`🔧 ${name} 초기화 중...`);

        const moduleInstance = new ModuleClass();

        // 모듈 옵션 설정
        if (moduleInstance.setOptions) {
          moduleInstance.setOptions({
            dbManager: this.db,
            bot: this.bot,
            ...this.options,
          });
        }

        // 모듈 초기화
        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        this.moduleInstances.set(name, moduleInstance);
        initResults.push({ name, status: "success" });

        logger.debug(`✅ ${name} 초기화 완료`);
      } catch (error) {
        logger.error(`❌ ${name} 초기화 실패:`, error.message);
        initResults.push({ name, status: "failed", error: error.message });
      }
    }

    const successCount = initResults.filter(
      (r) => r.status === "success"
    ).length;
    logger.success(
      `🎯 모듈 초기화 완료: ${successCount}/${initResults.length}개 성공`
    );
  }

  // =============== 메시지 및 콜백 처리 ===============

  async handleMessage(bot, msg) {
    const msgKey = `${msg.chat.id}_${msg.message_id}`;

    if (this.processingMessages.has(msgKey)) {
      logger.debug(`🚫 중복 메시지 무시: ${msgKey}`);
      return;
    }

    this.processingMessages.add(msgKey);

    try {
      this.globalStats.totalMessages++;
      this.globalStats.uniqueUsers.add(msg.from.id);

      // 모든 모듈에 메시지 전달
      for (const [name, instance] of this.moduleInstances) {
        try {
          if (instance.handleMessage) {
            const handled = await instance.handleMessage(bot, msg);
            if (handled) {
              this.globalStats.successfulMessages++;
              logger.debug(`📨 메시지 처리됨 by ${name}`);
              break;
            }
          }
        } catch (error) {
          logger.error(`❌ 모듈 메시지 처리 오류 (${name}):`, error.message);

          if (!this.globalStats.moduleErrors.has(name)) {
            this.globalStats.moduleErrors.set(name, 0);
          }
          this.globalStats.moduleErrors.set(
            name,
            this.globalStats.moduleErrors.get(name) + 1
          );
        }
      }
    } finally {
      setTimeout(() => {
        this.processingMessages.delete(msgKey);
      }, 5000);
    }
  }

  async handleCallback(bot, callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}`;

    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug(`🚫 중복 콜백 무시: ${callbackKey}`);
      return;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      this.globalStats.totalCallbacks++;

      // 콜백 데이터 파싱
      const [module, action, ...params] = callbackQuery.data.split("_");

      // 해당 모듈 찾기
      for (const [name, instance] of this.moduleInstances) {
        try {
          if (
            instance.handleCallback &&
            (name.toLowerCase().includes(module.toLowerCase()) ||
              instance.commands?.includes(module))
          ) {
            const handled = await instance.handleCallback(
              bot,
              callbackQuery,
              action,
              params,
              this
            );

            if (handled) {
              this.globalStats.successfulCallbacks++;
              logger.debug(`📞 콜백 처리됨 by ${name}: ${action}`);
              break;
            }
          }
        } catch (error) {
          logger.error(`❌ 모듈 콜백 처리 오류 (${name}):`, error.message);

          if (!this.globalStats.moduleErrors.has(name)) {
            this.globalStats.moduleErrors.set(name, 0);
          }
          this.globalStats.moduleErrors.set(
            name,
            this.globalStats.moduleErrors.get(name) + 1
          );
        }
      }
    } finally {
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }
  }

  // =============== 상태 및 정리 ===============

  getStatus() {
    return {
      initialized: this.isInitialized,
      moduleCount: this.modules.size,
      activeModuleCount: this.moduleInstances.size,
      databaseConnected: this.db?.isConnected || false,
      globalStats: {
        ...this.globalStats,
        uniqueUserCount: this.globalStats.uniqueUsers.size,
      },
      modules: Array.from(this.moduleInstances.keys()),
    };
  }

  async cleanup() {
    try {
      logger.info("🧹 ModuleManager 정리 시작...");

      // 모든 모듈 정리
      for (const [name, instance] of this.moduleInstances) {
        try {
          if (instance.cleanup) {
            await instance.cleanup();
          }
          logger.debug(`🧹 모듈 정리: ${name}`);
        } catch (error) {
          logger.warn(`⚠️ 모듈 정리 실패 (${name}):`, error.message);
        }
      }

      // 상태 초기화
      this.modules.clear();
      this.moduleInstances.clear();
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.cleanedCaches.clear();
      this.isInitialized = false;

      // 싱글톤 인스턴스 해제
      moduleManagerInstance = null;

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
