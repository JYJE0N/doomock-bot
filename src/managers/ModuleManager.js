// src/managers/ModuleManager.js - main_menu 콜백 특별 처리 추가

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

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
      { name: "TimerModule", path: "../modules/TimerModule" },
      { name: "WorktimeModule", path: "../modules/WorktimeModule" },
      { name: "BaseModule", path: "../modules/BaseModule" },
      { name: "LeaveModule", path: "../modules/LeaveModule" },
      { name: "ReminderModule", path: "../modules/ReminderModule" },
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
      logger.debug(`중복 콜백 무시: ${callbackKey}`);
      return;
    }
    this.processingCallbacks.add(callbackKey);

    try {
      logger.info(`📞 콜백 수신: ${callbackQuery.data}`);

      // 1. main_menu 특별 처리
      if (callbackQuery.data === "main_menu") {
        return await this.showMainMenu(bot, callbackQuery);
      }

      // 2. 콜백 데이터 파싱
      let targetModule, action, params;

      if (callbackQuery.data.includes(":")) {
        // "todo:list" 형식
        const parts = callbackQuery.data.split(":");
        targetModule = parts[0];
        action = parts[1];
        params = parts[2] || null;
      } else if (callbackQuery.data.includes("_")) {
        // "todo_list" 형식 (레거시 지원)
        const parts = callbackQuery.data.split("_");
        targetModule = parts[0];
        action = parts.slice(1).join("_");
      } else {
        logger.warn(`알 수 없는 콜백 형식: ${callbackQuery.data}`);
        return false;
      }

      // 3. 모듈 찾기
      const moduleName = this.findModuleName(targetModule);
      const moduleInstance = this.moduleInstances.get(moduleName);

      if (!moduleInstance) {
        logger.warn(`모듈을 찾을 수 없음: ${targetModule}`);
        return false;
      }

      // 4. 모듈에게 위임
      if (moduleInstance.handleCallback) {
        return await moduleInstance.handleCallback(
          bot,
          callbackQuery,
          action,
          params,
          this
        );
      }

      logger.warn(`${moduleName}에 handleCallback이 없음`);
      return false;
    } catch (error) {
      logger.error("콜백 처리 오류:", error);
      return false;
    } finally {
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }
  }

  // ✅ 메인메뉴 표시 메서드 추가
  async showMainMenu(bot, callbackQuery) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const userName = getUserName(from);

      // 동적으로 활성화된 모듈들의 메뉴 생성
      const menuKeyboard = this.createMainMenuKeyboard();

      const mainMenuText = `🏠 **${userName}님, 환영합니다!**\n\n원하는 기능을 선택해주세요:`;

      await bot.editMessageText(mainMenuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: menuKeyboard,
      });

      logger.debug("✅ 메인메뉴 표시 완료");
      return true;
    } catch (error) {
      logger.error("❌ 메인메뉴 표시 실패:", error);

      // 폴백: 기본 메뉴
      try {
        await bot.editMessageText("🏠 **메인 메뉴**\n\n기본 메뉴입니다.", {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: "Markdown",
          reply_markup: this.createMainMenuKeyboard(),
        });
        return true;
      } catch (fallbackError) {
        logger.error("❌ 폴백 메뉴도 실패:", fallbackError);
        return false;
      }
    }
  }

  // 모듈명 매핑 (system → SystemModule)
  findModuleName(targetModule) {
    const moduleMap = {
      system: "SystemModule",
      todo: "TodoModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      utils: "UtilsModule",
      timer: "TimerModule",
      worktime: "WorktimeModule",
    };

    return (
      moduleMap[targetModule.toLowerCase()] ||
      targetModule.charAt(0).toUpperCase() + targetModule.slice(1) + "Module"
    );
  }

  // ✅ 동적 메인 메뉴 키보드 (활성화된 모듈만 표시)
  createMainMenuKeyboard() {
    const menuButtons = [];

    // 모듈별 버튼 정의
    const moduleButtons = [
      {
        text: "📝 할일 관리",
        callback_data: "todo:menu",
        module: "TodoModule",
      },
      {
        text: "🔮 운세 확인",
        callback_data: "fortune:menu",
        module: "FortuneModule",
      },
      {
        text: "🌤️ 날씨 조회",
        callback_data: "weather:menu",
        module: "WeatherModule",
      },
      {
        text: "🛠️ 유틸리티",
        callback_data: "utils:menu",
        module: "UtilsModule",
      },
    ];

    // 활성화된 모듈만 메뉴에 추가
    for (const button of moduleButtons) {
      if (this.moduleInstances.has(button.module)) {
        menuButtons.push({
          text: button.text,
          callback_data: button.callback_data,
        });
      }
    }

    // 2열 배치로 키보드 생성
    const keyboard = [];
    for (let i = 0; i < menuButtons.length; i += 2) {
      const row = menuButtons.slice(i, i + 2);
      keyboard.push(row);
    }

    // 시스템 기능 추가 (항상 표시)
    keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    return { inline_keyboard: keyboard };
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
