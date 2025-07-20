const logger = require("../utils/Logger");
const MenuConfig = require("../config/MenuConfig");
const AppConfig = require("../config/AppConfig");
const { getUserName } = require("../utils/UserHelper");

class MenuManager {
  constructor() {
    this.moduleManager = null;
    this.menuCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    logger.info("📋 MenuManager 초기화됨");

    // 🔧 static 대신 인스턴스 프로퍼티로 변경
    this.moduleMapping = {
      todo: "TodoModule",
      fortune: "FortuneModule",
      weather: "WeatherModule",
      timer: "TimerModule",
      insight: "InsightModule",
      utils: "UtilsModule",
      reminder: "ReminderModule",
      leave: "LeaveModule",
      worktime: "WorktimeModule",
    };
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
    logger.info("📋 MenuManager에 ModuleManager 연결됨");
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
    if (dependencies.moduleManager) {
      this.setModuleManager(dependencies.moduleManager);
    }
  }

  async getMainMenuKeyboard() {
    try {
      if (!this.moduleManager) {
        logger.warn(
          "MenuManager: ModuleManager가 설정되지 않음. 기본 메뉴 반환"
        );
        return this.getDefaultKeyboard();
      }
      const menuItems = this.buildMainMenuItemsSync();
      return this.createKeyboardLayout(menuItems, { columns: 2 });
    } catch (error) {
      logger.error("메인 메뉴 키보드 생성 실패:", error);
      return this.getDefaultKeyboard();
    }
  }

  buildMainMenuItemsSync() {
    const menuItems = [];
    const moduleButtons = [
      { text: "📝 할일 관리", callback_data: "todo_menu", module: "todo" },
      { text: "🔮 운세", callback_data: "fortune_menu", module: "fortune" },
      { text: "🌤️ 날씨", callback_data: "weather_menu", module: "weather" },
      { text: "⏰ 타이머", callback_data: "timer_menu", module: "timer" },
      { text: "📊 인사이트", callback_data: "insight_menu", module: "insight" },
      { text: "🛠️ 유틸리티", callback_data: "utils_menu", module: "utils" },
      {
        text: "🔔 리마인더",
        callback_data: "reminder_menu",
        module: "reminder",
      },
      { text: "📅 휴가 관리", callback_data: "leave_menu", module: "leave" },
      {
        text: "🕐 근무시간",
        callback_data: "worktime_menu",
        module: "worktime",
      },
    ];

    console.log("🔍 모듈 버튼 체크 시작...");

    for (const button of moduleButtons) {
      const isEnabled = this.isModuleEnabledQuick(button.module);
      console.log(`📱 ${button.module}: ${isEnabled ? "✅" : "❌"}`);

      if (isEnabled) {
        menuItems.push(button);
      }
    }

    console.log(`📋 최종 메뉴 아이템: ${menuItems.length}개`);
    return menuItems;
  }

  isModuleEnabledQuick(moduleKey) {
    if (!this.moduleManager) {
      console.log(`❌ ${moduleKey}: ModuleManager 없음`);
      return false;
    }

    // 🔧 this.moduleMapping으로 변경 (static 제거)
    const moduleName = this.moduleMapping[moduleKey];
    if (!moduleName) {
      console.log(`❌ ${moduleKey}: 매핑된 모듈명 없음`);
      return false;
    }

    // 여러 방법으로 모듈 존재 확인
    const hasModule =
      this.moduleManager.hasModule && this.moduleManager.hasModule(moduleName);
    const getModule =
      this.moduleManager.getModule && this.moduleManager.getModule(moduleName);

    console.log(`🔍 ${moduleKey} (${moduleName}):`, {
      hasModule: !!hasModule,
      getModule: !!getModule,
      moduleManager: !!this.moduleManager,
    });

    return hasModule || !!getModule;
  }

  getDefaultKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo_menu" },
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime_menu" },
          { text: "❓ 도움말", callback_data: "help_menu" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };
  }

  createKeyboardLayout(items, options = {}) {
    const {
      columns = 2,
      backButton = false,
      backCallback = "main_menu",
      extraButtons = [],
    } = options;

    const keyboard = [];

    // 🔧 item.emoji 제거 (text에 이미 포함됨)
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns).map((item) => ({
        text: item.text,
        callback_data: item.callback_data,
      }));
      keyboard.push(row);
    }

    if (extraButtons.length > 0) {
      extraButtons.forEach((buttonRow) => {
        keyboard.push(Array.isArray(buttonRow) ? buttonRow : [buttonRow]);
      });
    }

    if (backButton) {
      keyboard.push([{ text: "🔙 메인 메뉴", callback_data: backCallback }]);
    }

    return { inline_keyboard: keyboard };
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.menuCache.entries()) {
      if (now - cached.timestamp >= this.cacheTimeout) {
        this.menuCache.delete(key);
      }
    }
  }
}

module.exports = MenuManager;
