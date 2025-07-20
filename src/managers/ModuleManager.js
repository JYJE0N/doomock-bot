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

  // 📍 src/managers/ModuleManager.js 파일에서 찾아서 수정할 부분

  // ❌ 현재 코드 (약 95-110줄 근처) - 이 부분을 찾으세요
  async handleCallback(bot, callbackQuery) {
    // ... 기존 코드 ...

    // 콜백 데이터 파싱 (system:status → system, status)
    const [targetModule, action] = callbackQuery.data.split(":");

    if (!targetModule || !action) {
      logger.warn(`잘못된 콜백 형식: ${callbackQuery.data}`);
      return;
    }

    // ... 나머지 코드 ...
  }

  // ✅ 수정 후 코드 - 위 부분을 이렇게 바꾸세요
  async handleCallback(bot, callbackQuery) {
    const callbackKey = `${callbackQuery.from.id}_${callbackQuery.data}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      return;
    }
    this.processingCallbacks.add(callbackKey);

    try {
      // ✅ main_menu 특별 처리
      if (callbackQuery.data === "main_menu") {
        const handled = await this.showMainMenu(bot, callbackQuery);
        if (handled) {
          logger.debug("✅ 메인메뉴 표시 완료");
          return;
        }
      }

      // 🎯 유연한 콜백 파싱 - 두 가지 형식 지원
      let targetModule, action;

      if (callbackQuery.data.includes(":")) {
        // 모듈 간 라우팅: "todo:menu" 형식
        [targetModule, action] = callbackQuery.data.split(":");
      } else if (callbackQuery.data.includes("_")) {
        // 모듈 내 액션: "todo_list" 형식
        const parts = callbackQuery.data.split("_");
        targetModule = parts[0];
        action = parts.slice(1).join("_");
      } else {
        logger.warn(`지원하지 않는 콜백 형식: ${callbackQuery.data}`);
        return;
      }

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
