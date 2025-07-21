// src/managers/ModuleManager.js - main_menu 콜백 처리 수정
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.db = options.dbManager || null;
    this.moduleInstances = new Map();
    this.isInitialized = false;

    // 중복 처리 방지
    this.processingCallbacks = new Set();

    // 모듈 레지스트리 (중앙 등록소)
    this.moduleRegistry = {
      system: { class: "SystemModule", path: "../modules/SystemModule" },
      todo: { class: "TodoModule", path: "../modules/TodoModule" },
      timer: { class: "TimerModule", path: "../modules/TimerModule" },
      worktime: { class: "WorktimeModule", path: "../modules/WorktimeModule" },
      leave: { class: "LeaveModule", path: "../modules/LeaveModule" },
      reminder: { class: "ReminderModule", path: "../modules/ReminderModule" },
      fortune: { class: "FortuneModule", path: "../modules/FortuneModule" },
      weather: { class: "WeatherModule", path: "../modules/WeatherModule" },
      utils: { class: "UtilsModule", path: "../modules/UtilsModule" },
    };

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
    for (const [key, config] of Object.entries(this.moduleRegistry)) {
      try {
        const ModuleClass = require(config.path);
        const moduleInstance = new ModuleClass(this.bot, {
          dbManager: this.db,
          moduleManager: this, // 자신의 참조 전달
        });

        // 모듈 초기화
        if (moduleInstance.initialize) {
          await moduleInstance.initialize();
        }

        this.moduleInstances.set(config.class, moduleInstance);
        logger.debug(`✅ ${config.class} 로드 완료`);
      } catch (error) {
        logger.error(`❌ ${config.class} 로드 실패:`, error.message);
      }
    }
  }

  // 🎯 중앙 메시지 라우팅
  async handleMessage(bot, msg) {
    if (!msg.text) return false;

    const operationId = TimeHelper.generateOperationId("message", msg.from.id);

    // 모든 모듈에게 메시지 전달 (우선순위 순서대로)
    const moduleOrder = [
      "system",
      "todo",
      "leave",
      "worktime",
      "timer",
      "reminder",
      "fortune",
      "weather",
      "utils",
    ];

    for (const moduleName of moduleOrder) {
      const moduleClass = this.moduleRegistry[moduleName]?.class;
      const module = this.moduleInstances.get(moduleClass);

      if (module?.handleMessage) {
        try {
          const handled = await module.handleMessage(bot, msg);
          if (handled) {
            logger.debug(`📬 메시지가 ${moduleClass}에서 처리됨`);
            return true;
          }
        } catch (error) {
          logger.error(`❌ ${moduleClass} 메시지 처리 오류:`, error);
        }
      }
    }

    return false;
  }

  // 🎯 중앙 콜백 라우팅
  async handleCallback(callbackQuery) {
    const callbackData = callbackQuery.data;
    const callbackKey = `${callbackQuery.from.id}_${callbackQuery.id}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.warn(`⚠️ 중복 콜백 차단: ${callbackData}`);
      return false;
    }

    this.processingCallbacks.add(callbackKey);

    try {
      // main_menu 특별 처리
      if (callbackData === "main_menu") {
        logger.info(`📞 콜백 수신: ${callbackData}`);
        return await this.handleMainMenu(callbackQuery);
      }

      // 콜백 데이터 파싱
      const [targetModule, subAction, ...params] = callbackData.split(":");

      logger.info(`🔔 콜백 라우팅: ${targetModule} → ${subAction}`);

      // 모듈 찾기
      const moduleClass = this.findModuleClass(targetModule);
      const module = this.moduleInstances.get(moduleClass);

      if (!module) {
        logger.warn(`⚠️ 모듈을 찾을 수 없음: ${targetModule}`);
        await this.sendModuleNotFoundMessage(callbackQuery);
        return false;
      }

      // 표준 매개변수로 모듈 콜백 호출
      if (module.handleCallback) {
        const result = await module.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params,
          this // menuManager 대신 자기 자신 전달
        );

        // 콜백 응답
        await this.bot.answerCallbackQuery(callbackQuery.id);
        return result;
      }
    } catch (error) {
      logger.error("❌ 콜백 처리 오류:", error);
      await this.sendErrorCallback(callbackQuery);
    } finally {
      // 3초 후 중복 방지 해제
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, 3000);
    }

    return false;
  }

  // 🏠 메인 메뉴 처리
  async handleMainMenu(callbackQuery) {
    try {
      const keyboard = this.createMainMenuKeyboard();
      const userName = getUserName(callbackQuery.from);

      const menuText =
        `🏠 **메인 메뉴**\n\n` +
        `안녕하세요 ${userName}님!\n` +
        `무엇을 도와드릴까요?`;

      await this.bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // 콜백 응답
      await this.bot.answerCallbackQuery(callbackQuery.id);

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 처리 오류:", error);
      return false;
    }
  }

  // 🎨 동적 메인 메뉴 생성
  createMainMenuKeyboard() {
    const menuButtons = [];

    const moduleMenus = [
      { key: "todo", text: "📝 할일 관리", callback: "todo:menu" },
      { key: "leave", text: "📅 휴가 관리", callback: "leave:menu" },
      { key: "worktime", text: "🕐 근무시간", callback: "worktime:menu" },
      { key: "timer", text: "⏰ 타이머", callback: "timer:menu" },
      { key: "reminder", text: "🔔 리마인더", callback: "reminder:menu" },
      { key: "fortune", text: "🔮 운세", callback: "fortune:menu" },
      { key: "weather", text: "🌤️ 날씨", callback: "weather:menu" },
      { key: "utils", text: "🛠️ 유틸리티", callback: "utils:menu" },
    ];

    // 활성화된 모듈만 추가
    for (const menu of moduleMenus) {
      const moduleClass = this.moduleRegistry[menu.key]?.class;
      if (this.moduleInstances.has(moduleClass)) {
        menuButtons.push({
          text: menu.text,
          callback_data: menu.callback,
        });
      }
    }

    // 2열 배치
    const keyboard = [];
    for (let i = 0; i < menuButtons.length; i += 2) {
      keyboard.push(menuButtons.slice(i, i + 2));
    }

    // 시스템 메뉴 추가
    keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    return { inline_keyboard: keyboard };
  }

  // 🔍 모듈 클래스 찾기
  findModuleClass(moduleKey) {
    // 직접 매핑
    const directMapping = {
      system: "SystemModule",
      todo: "TodoModule",
      timer: "TimerModule",
      worktime: "WorktimeModule",
      leave: "LeaveModule",
      reminder: "ReminderModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      utils: "UtilsModule",
    };

    return directMapping[moduleKey.toLowerCase()] || null;
  }

  // ❌ 에러 처리
  async sendModuleNotFoundMessage(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: "⚠️ 해당 모듈을 찾을 수 없습니다.",
      show_alert: true,
    });
  }

  async sendErrorCallback(callbackQuery) {
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ 처리 중 오류가 발생했습니다.",
      show_alert: true,
    });
  }

  // 🔍 모듈 조회
  getModule(moduleName) {
    return this.moduleInstances.get(moduleName);
  }

  hasModule(moduleName) {
    return this.moduleInstances.has(moduleName);
  }

  // 📊 상태 조회
  getStatus() {
    const moduleStatuses = {};

    for (const [name, module] of this.moduleInstances) {
      moduleStatuses[name] = module.getStatus
        ? module.getStatus()
        : {
            initialized: module.isInitialized || false,
            name: name,
          };
    }

    return {
      initialized: this.isInitialized,
      moduleCount: this.moduleInstances.size,
      modules: moduleStatuses,
      activeCallbacks: this.processingCallbacks.size,
    };
  }

  // 🧹 정리
  async cleanup() {
    logger.info("🧹 ModuleManager 정리 시작...");

    for (const [name, module] of this.moduleInstances) {
      try {
        if (module.cleanup) {
          await module.cleanup();
        }
        logger.debug(`✅ ${name} 정리 완료`);
      } catch (error) {
        logger.error(`❌ ${name} 정리 실패:`, error);
      }
    }

    this.moduleInstances.clear();
    this.processingCallbacks.clear();
    this.isInitialized = false;

    logger.info("✅ ModuleManager 정리 완료");
  }
}

module.exports = ModuleManager;
