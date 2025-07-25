// src/core/ModuleLoader.js
const EventBus = require("./EventBus");
const logger = require("../utils/Logger");

class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.moduleConfig = {
      system: { path: "../modules/SystemModule", priority: 0 },
      todo: { path: "../modules/TodoModule", priority: 1 },
      timer: { path: "../modules/TimerModule", priority: 2 },
      worktime: { path: "../modules/WorktimeModule", priority: 3 },
      leave: { path: "../modules/LeaveModule", priority: 4 },
      reminder: { path: "../modules/ReminderModule", priority: 5 },
      fortune: { path: "../modules/FortuneModule", priority: 6 },
      weather: { path: "../modules/WeatherModule", priority: 7 },
      utils: { path: "../modules/UtilsModule", priority: 8 },
    };
  }

  async loadModules() {
    const sortedModules = Object.entries(this.moduleConfig).sort(
      ([, a], [, b]) => a.priority - b.priority
    );

    for (const [name, config] of sortedModules) {
      try {
        const ModuleClass = require(config.path);
        const module = new ModuleClass();

        // 모듈 초기화
        if (module.initialize) {
          await module.initialize();
        }

        // 이벤트 리스너 등록
        this.registerModuleListeners(name, module);

        this.modules.set(name, module);
        logger.success(`✅ ${name} 모듈 로드 완료`);
      } catch (error) {
        logger.error(`❌ ${name} 모듈 로드 실패:`, error);
      }
    }
  }

  registerModuleListeners(name, module) {
    // 메시지 처리
    EventBus.on("message:process", async (msg) => {
      if (module.canHandleMessage && module.canHandleMessage(msg)) {
        return await module.handleMessage(msg);
      }
      return false;
    });

    // 콜백 처리
    EventBus.on("callback:process", async (callbackQuery) => {
      const [prefix] = callbackQuery.data.split(":");
      if (prefix === name) {
        return await module.handleCallback(callbackQuery);
      }
      return false;
    });
  }

  getModule(name) {
    return this.modules.get(name);
  }
}

module.exports = ModuleLoader;
