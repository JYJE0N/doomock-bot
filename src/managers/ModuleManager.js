// src/managers/ModuleManager.js - MongoPoolManager 참조 제거 패치

const logger = require("../utils/Logger");
const path = require("path");
const fs = require("fs");

class ModuleManager {
  constructor(bot, options = {}) {
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

    // ✅ 데이터베이스 참조 (통합된 DatabaseManager 사용)
    // 🚫 제거: const { mongoPoolManager } = require("../database/MongoPoolManager");
    this.db = options.dbManager || null; // ✅ 옵션에서 전달받은 dbManager 사용

    // 글로벌 통계
    this.globalStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      successfulMessages: 0,
      successfulCallbacks: 0,
      moduleErrors: new Map(),
      uniqueUsers: new Set(),
    };

    logger.info("🔧 ModuleManager 생성됨 (DatabaseManager 통합)");
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

      // 2. require 캐시 전체 정리 (안전하게)
      await this._safeCleanCache();

      // 3. 모듈 로드 및 초기화
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

  // ✅ 안전한 캐시 정리
  async _safeCleanCache() {
    try {
      logger.info("🗑️ require 캐시 안전 정리 시작...");

      const modulePaths = [
        "../modules/SystemModule",
        "../modules/TodoModule",
        "../modules/FortuneModule",
        "../modules/WeatherModule",
        "../modules/UtilsModule",
        "../utils/Logger",
      ];

      let cleanedCount = 0;

      for (const modulePath of modulePaths) {
        try {
          const fullPath = path.resolve(__dirname, modulePath + ".js");

          // 파일이 존재하는지 확인
          if (fs.existsSync(fullPath)) {
            const resolvedPath = require.resolve(fullPath);

            // 캐시에 있고 아직 정리하지 않았다면 정리
            if (
              require.cache[resolvedPath] &&
              !this.cleanedCaches.has(resolvedPath)
            ) {
              delete require.cache[resolvedPath];
              this.cleanedCaches.add(resolvedPath);
              cleanedCount++;
              logger.debug(`🗑️ 캐시 정리: ${path.basename(modulePath)}`);
            }
          }
        } catch (error) {
          logger.warn(`⚠️ 캐시 정리 실패 (${modulePath}):`, error.message);
        }
      }

      logger.success(`✅ 캐시 정리 완료: ${cleanedCount}개 모듈`);
    } catch (error) {
      logger.error("❌ 캐시 정리 중 오류:", error);
      // 캐시 정리 실패는 치명적이지 않으므로 계속 진행
    }
  }

  // ✅ 데이터베이스 연결 확인 (통합된 DatabaseManager 사용)
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

      // ✅ 옵션에서 전달받은 dbManager가 있으면 사용
      if (this.options.dbManager) {
        this.db = this.options.dbManager;
        logger.debug("✅ 전달받은 DatabaseManager 사용");
        return;
      }

      // ✅ DatabaseManager가 없으면 새로 생성
      const DatabaseManager = require("../database/DatabaseManager");
      this.db = new DatabaseManager();

      if (!this.db.isConnected) {
        await this.db.connect();
      }

      logger.success("✅ DatabaseManager 연결 확인 완료");
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
    let requiredCount = 0;

    for (const config of moduleConfigs) {
      try {
        const ModuleClass = require(config.path);

        if (typeof ModuleClass === "function") {
          this.modules.set(config.name, ModuleClass);
          loadedCount++;

          if (config.required) {
            requiredCount++;
          }

          logger.debug(`✅ 모듈 로드: ${config.name}`);
        } else {
          throw new Error(`${config.name}이 올바른 클래스가 아닙니다`);
        }
      } catch (error) {
        logger.warn(`⚠️ 모듈 로드 실패 (${config.name}):`, error.message);

        if (config.required) {
          throw new Error(`필수 모듈 로드 실패: ${config.name}`);
        }
      }
    }

    logger.info(
      `📦 모듈 로드 완료: ${loadedCount}개 (필수: ${requiredCount}개)`
    );
  }

  // ✅ 모듈 초기화
  async _initializeModules() {
    const initResults = [];

    for (const [name, ModuleClass] of this.modules) {
      try {
        const moduleInstance = new ModuleClass();

        // 모듈 옵션 설정
        if (moduleInstance.setOptions) {
          moduleInstance.setOptions({
            dbManager: this.db, // ✅ 통합된 DatabaseManager 전달
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

        logger.debug(`✅ 모듈 초기화: ${name}`);
      } catch (error) {
        logger.error(`❌ 모듈 초기화 실패 (${name}):`, error.message);
        initResults.push({ name, status: "failed", error: error.message });
      }
    }

    const successCount = initResults.filter(
      (r) => r.status === "success"
    ).length;
    logger.info(
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
      // 5초 후 중복 방지 해제
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
              this // MenuManager 역할
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
      // 3초 후 중복 방지 해제
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

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
