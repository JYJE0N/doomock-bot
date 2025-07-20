// src/managers/ModuleManager.js - 완전 리팩토링 (깔끔하고 단순하게)

const logger = require("../utils/Logger");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.dbManager || null;
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 중복 처리 방지
    this.processingCallbacks = new Set();

    logger.info("🔧 ModuleManager 생성됨");
  }

  async initialize() {
    if (this.isInitialized) {
      logger.warn("ModuleManager 이미 초기화됨");
      return;
    }

    try {
      logger.info("⚙️ ModuleManager 초기화 시작...");
      await this.loadModules();
      this.isInitialized = true;
      logger.success(
        `✅ ModuleManager 초기화 완료 (${this.moduleInstances.size}개 모듈)`
      );
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  async loadModules() {
    const moduleConfigs = [
      { name: "SystemModule", path: "../modules/SystemModule" },
      { name: "TodoModule", path: "../modules/TodoModule" },
      { name: "FortuneModule", path: "../modules/FortuneModule" },
      { name: "WeatherModule", path: "../modules/WeatherModule" },
      { name: "UtilsModule", path: "../modules/UtilsModule" },
    ];

    for (const config of moduleConfigs) {
      try {
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
          dbManager: this.db,
        });

        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        this.moduleInstances.set(config.name, moduleInstance);
        logger.debug(`✅ ${config.name} 로드 완료`);
      } catch (error) {
        logger.warn(`⚠️ 모듈 로드 실패 (${config.name}):`, error.message);
      }
    }
  }

  async handleMessage(bot, msg) {
    for (const [name, instance] of this.moduleInstances) {
      try {
        if (instance.handleMessage) {
          const handled = await instance.handleMessage(bot, msg);
          if (handled) break;
        }
      } catch (error) {
        logger.error(`❌ 모듈 메시지 처리 오류 (${name}):`, error.message);
      }
    }
  }

  async handleCallback(bot, callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      return;
    }
    this.processingCallbacks.add(callbackKey);

    try {
      // 콜백 데이터 파싱 (system:status → system, status)
      const [targetModule, action] = callbackQuery.data.split(":");

      if (!targetModule || !action) {
        logger.warn(`잘못된 콜백 형식: ${callbackQuery.data}`);
        return;
      }

      // 대상 모듈 찾기
      const moduleName = this.findModuleName(targetModule);
      const moduleInstance = this.moduleInstances.get(moduleName);

      if (moduleInstance && moduleInstance.handleCallback) {
        const handled = await moduleInstance.handleCallback(
          bot,
          callbackQuery,
          action,
          {},
          this
        );

        if (handled) {
          logger.debug(`✅ 콜백 처리 성공: ${callbackQuery.data}`);
        } else {
          logger.debug(`⚠️ 콜백 처리 거부: ${callbackQuery.data}`);
        }
      } else {
        logger.warn(`모듈을 찾을 수 없음: ${targetModule} → ${moduleName}`);
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 오류:`, error.message);
    } finally {
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }
  }

  // 모듈명 매핑 (system → SystemModule)
  findModuleName(target) {
    const mapping = {
      system: "SystemModule",
      todo: "TodoModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      utils: "UtilsModule",
    };

    return (
      mapping[target] ||
      `${target.charAt(0).toUpperCase() + target.slice(1)}Module`
    );
  }

  // 메인 메뉴 키보드
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

  // 상태 조회
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeModuleCount: this.moduleInstances.size,
      modules: Array.from(this.moduleInstances.keys()),
    };
  }

  // 정리 작업
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

      this.moduleInstances.clear();
      this.processingCallbacks.clear();
      this.isInitialized = false;

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 중 오류:", error);
    }
  }
}

module.exports = ModuleManager;
