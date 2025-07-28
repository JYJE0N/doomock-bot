// src/core/ModuleManager.js - 수정된 버전
const path = require("path");
const logger = require("../utils/Logger");
const { createServiceBuilder } = require("./ServiceBuilder");
const { getInstance } = require("../database/DatabaseManager");
const { getEnabledModules } = require("../config/ModuleRegistry");

/**
 * 📦 ModuleManager - 모든 모듈의 중앙 관리자
 */
class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.db;
    this.modules = new Map();
    this.initialized = false;
    this.serviceBuilder = null;

    // 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      callbacksHandled: 0,
      messagesHandled: 0,
    };

    logger.info("📦 ModuleManager 생성됨");
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    try {
      logger.system("ModuleManager 초기화 시작...");

      // 1. DatabaseManager 초기화
      const dbManager = getInstance();
      await dbManager.ensureConnection();

      // 2. ServiceBuilder 초기화
      this.serviceBuilder = createServiceBuilder();
      this.serviceBuilder.setDefaultDatabase(dbManager.getDb());
      await this.serviceBuilder.initialize();

      // 3. 모듈들 로드
      await this.loadModules();

      this.initialized = true;
      logger.success("✅ ModuleManager 초기화 완료");
    } catch (error) {
      logger.error("ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📦 모듈 로드
   */
  async loadModules() {
    const moduleConfigs = getEnabledModules();
    this.stats.totalModules = moduleConfigs.length;

    for (const config of moduleConfigs) {
      try {
        logger.module(`${config.key}`, "로드 중...");

        // 🔧 수정: 절대 경로로 변경
        const modulePath = path.join(__dirname, config.path);

        // 모듈이 존재하는지 먼저 확인
        try {
          require.resolve(modulePath);
        } catch (e) {
          logger.warn(
            `❌ ${config.key} 모듈 파일을 찾을 수 없음: ${modulePath}`
          );

          // SystemModule이 없어도 계속 진행
          if (config.key === "system") {
            logger.info("시스템 모듈 스킵 (선택사항)");
            continue;
          }

          this.stats.failedModules++;
          continue;
        }

        // 모듈 클래스 로드

        const ModuleClass = require(modulePath);

        // 모듈 인스턴스 생성
        const moduleInstance = new ModuleClass(this.bot, {
          db: this.db,
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config,
        });

        // 초기화
        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        // 등록
        this.modules.set(config.key, {
          instance: moduleInstance,
          config: config,
        });

        this.stats.activeModules++;
        logger.module(config.key, "✅ 로드 완료");
      } catch (error) {
        logger.error(`❌ ${config.key} 모듈 로드 실패`, error);
        this.stats.failedModules++;
      }
    }

    logger.info(
      `📦 모듈 로드 완료: ${this.stats.activeModules}/${this.stats.totalModules}`
    );
  }

  /**
   * 🎯 콜백 쿼리 처리 (라우팅)
   */
  async handleCallback(bot, callbackQuery, action, params, moduleManager) {
    try {
      // 모듈 키 추출
      const moduleKey = action.split(":")[0];
      const subAction = action.substring(moduleKey.length + 1) || "menu";

      logger.debug(`📦 모듈 라우팅: ${moduleKey} → ${subAction}`);

      // 모듈 찾기
      const module = this.modules.get(moduleKey);
      if (!module) {
        logger.warn(`모듈을 찾을 수 없음: ${moduleKey}`);
        return;
      }

      // 모듈로 전달
      await module.instance.handleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      // 통계 업데이트
      this.stats.callbacksHandled++;
    } catch (error) {
      logger.error("모듈 콜백 처리 실패", error);
      throw error;
    }
  }

  /**
   * 💬 메시지 처리 (라우팅)
   */
  async handleMessage(bot, msg) {
    try {
      const text = msg.text || "";

      // 모든 활성 모듈에게 메시지 전달
      for (const [key, module] of this.modules) {
        try {
          if (
            module.instance.canHandleMessage &&
            (await module.instance.canHandleMessage(msg))
          ) {
            logger.debug(`💬 메시지 처리: ${key} 모듈`);

            await module.instance.onHandleMessage(bot, msg);
            this.stats.messagesHandled++;
            break; // 첫 번째 처리 가능한 모듈만
          }
        } catch (error) {
          logger.error(`${key} 모듈 메시지 처리 실패`, error);
        }
      }
    } catch (error) {
      logger.error("메시지 라우팅 실패", error);
    }
  }

  /**
   * 📊 모듈 상태 조회
   */
  getModuleStatus(moduleKey) {
    const module = this.modules.get(moduleKey);
    if (!module) return null;

    return {
      key: moduleKey,
      name: module.config.name,
      active: true,
      healthy: module.instance.isHealthy ? module.instance.isHealthy() : true,
      stats: module.instance.stats || {},
    };
  }

  /**
   * 📊 전체 상태 조회
   */
  getStatus() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      stats: this.stats,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    logger.info("📦 ModuleManager 정리 시작...");

    // 모든 모듈 정리
    for (const [key, module] of this.modules) {
      try {
        if (module.instance.cleanup) {
          await module.instance.cleanup();
        }
      } catch (error) {
        logger.error(`${key} 모듈 정리 실패:`, error);
      }
    }

    logger.info("📦 ModuleManager 정리 완료");
  }
}

module.exports = ModuleManager;
