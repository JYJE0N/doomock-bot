// src/managers/ModuleManager.js - 응급 무한루프 차단

const logger = require("../utils/Logger");

// 🚨 전역 초기화 상태 추적 (무한루프 완전 차단)
let globalInitializationInProgress = false;
let moduleManagerInstance = null;

class ModuleManager {
  constructor(bot, options = {}) {
    // 🚨 무한루프 차단 1: 이미 생성된 인스턴스 반환
    if (moduleManagerInstance) {
      logger.warn("⚠️ ModuleManager 이미 존재, 기존 인스턴스 반환");
      return moduleManagerInstance;
    }

    // 🚨 무한루프 차단 2: 초기화 진행 중이면 차단
    if (globalInitializationInProgress) {
      logger.error("🚨 ModuleManager 초기화 중 재귀 호출 차단!");
      throw new Error("ModuleManager 초기화 중 재귀 호출 감지됨");
    }

    this.bot = bot;
    this.options = options;

    // 핵심 상태
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.isInitialized = false;

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

    // 싱글톤 저장
    moduleManagerInstance = this;

    logger.info("🔧 ModuleManager 생성됨 (무한루프 차단)");
  }

  // =============== 초기화 ===============

  async initialize() {
    // 🚨 중복 초기화 차단
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    // 🚨 전역 초기화 상태 차단
    if (globalInitializationInProgress) {
      logger.error("🚨 ModuleManager 초기화 중 재귀 호출 차단!");
      return;
    }

    try {
      globalInitializationInProgress = true;
      logger.info("⚙️ ModuleManager 초기화 시작...");

      // 🚫 캐시 정리 완전 제거 (무한루프 원인)

      // 모듈 로드 및 초기화
      await this._loadModulesSafely();
      await this._initializeModules();

      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.modules.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    } finally {
      globalInitializationInProgress = false;
    }
  }

  // ✅ 안전한 모듈 로드 (캐시 정리 없음)
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
        // 🚫 캐시 정리 제거
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

  // ✅ 안전한 모듈 초기화 (재귀 방지)
  async _initializeModules() {
    logger.info("🔧 모듈 초기화 시작...");

    const initResults = [];

    for (const [name, ModuleClass] of this.modules) {
      try {
        logger.debug(`🔧 ${name} 초기화 중...`);

        // 🚨 ModuleManager 참조 전달 금지 (무한루프 방지)
        const moduleInstance = new ModuleClass();

        // 기본 옵션만 설정 (ModuleManager 참조 제외)
        if (moduleInstance.setOptions) {
          moduleInstance.setOptions({
            dbManager: this.db,
            bot: this.bot,
            // moduleManager: this, // 🚫 이것이 무한루프 원인!
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

        // 📝 TodoModule 실패해도 계속 진행
        if (name !== "SystemModule") {
          continue;
        } else {
          throw error; // SystemModule만 필수
        }
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
      return;
    }

    this.processingMessages.add(msgKey);

    try {
      this.globalStats.totalMessages++;
      this.globalStats.uniqueUsers.add(msg.from.id);

      for (const [name, instance] of this.moduleInstances) {
        try {
          if (instance.handleMessage) {
            const handled = await instance.handleMessage(bot, msg);
            if (handled) {
              this.globalStats.successfulMessages++;
              break;
            }
          }
        } catch (error) {
          logger.error(`❌ 모듈 메시지 처리 오류 (${name}):`, error.message);
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
      return;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      this.globalStats.totalCallbacks++;

      const [module, action, ...params] = callbackQuery.data.split("_");

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
              break;
            }
          }
        } catch (error) {
          logger.error(`❌ 모듈 콜백 처리 오류 (${name}):`, error.message);
        }
      }
    } finally {
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }
  }

  // =============== 모듈 관리 ===============
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:main" },
          { text: "🔮 운세 확인", callback_data: "fortune:today" },
        ],
        [
          { text: "🌤️ 날씨 조회", callback_data: "weather:current" },
          { text: "🛠️ 유틸리티", callback_data: "utils:main" },
        ],
        [
          { text: "📊 시스템 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };
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

      for (const [name, instance] of this.moduleInstances) {
        try {
          if (instance.cleanup) {
            await instance.cleanup();
          }
        } catch (error) {
          logger.warn(`⚠️ 모듈 정리 실패 (${name}):`, error.message);
        }
      }

      // 상태 초기화
      this.modules.clear();
      this.moduleInstances.clear();
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.isInitialized = false;

      // 전역 상태 리셋
      moduleManagerInstance = null;
      globalInitializationInProgress = false;

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
