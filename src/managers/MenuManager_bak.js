// src/managers/MenuManager.js - getMenuText 메서드 추가
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

  // ✅ getMenuText 메서드 추가
  getMenuText(menuType, userName) {
    const menuTexts = {
      reminder: `🔔 **${userName}님의 리마인더**\n\n필요한 시간에 알림을 받아보세요!`,
      todo: `📝 **${userName}님의 할일 목록**\n\n효율적인 할일 관리를 시작하세요!`,
      worktime: `🕐 **${userName}님의 근무시간**\n\n근무시간을 관리하세요!`,
      leave: `📅 **${userName}님의 휴가 관리**\n\n휴가를 계획하고 관리하세요!`,
      weather: `🌤️ **날씨 정보**\n\n오늘의 날씨를 확인하세요!`,
      fortune: `🔮 **오늘의 운세**\n\n${userName}님의 운세를 확인하세요!`,
      insight: `📊 **오늘의 지표로**\n\n${userName}님의 액션플랜을 확인하세요!`,
      timer: `⏰ **타이머 관리**\n\n시간을 효율적으로 관리하세요!`,
      utils: `🛠️ **유틸리티**\n\n다양한 편의 기능을 사용하세요!`,
      main: `🏠 **메인 메뉴**\n\n안녕하세요 ${userName}님!\n무엇을 도와드릴까요?`,
    };

    return menuTexts[menuType] || `📋 **${userName}님의 메뉴**`;
  }

  // ✅ createKeyboard 메서드 추가
  createKeyboard(menuType) {
    const keyboards = {
      reminder: {
        inline_keyboard: [
          [
            { text: "⏰ 분 단위 리마인더", callback_data: "reminder:minutes" },
            { text: "🕐 시간 설정", callback_data: "reminder:time" },
          ],
          [
            { text: "❓ 사용법", callback_data: "reminder:help" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      },
      todo: {
        inline_keyboard: [
          [
            { text: "➕ 할일 추가", callback_data: "todo:add" },
            { text: "📋 목록 보기", callback_data: "todo:list" },
          ],
          [
            { text: "✅ 완료 목록", callback_data: "todo:done" },
            { text: "🗑️ 할일 삭제", callback_data: "todo:delete" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
        ],
      },
      worktime: {
        inline_keyboard: [
          [
            { text: "🚀 출근하기", callback_data: "worktime:checkin" },
            { text: "🏡 퇴근하기", callback_data: "worktime:checkout" },
          ],
          [
            { text: "📊 근무 현황", callback_data: "worktime:status" },
            { text: "📈 월간 통계", callback_data: "worktime:monthly" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
        ],
      },
      leave: {
        inline_keyboard: [
          [
            { text: "📊 연차 현황", callback_data: "leave:status" },
            { text: "➕ 휴가 신청", callback_data: "leave:add" },
          ],
          [
            { text: "📋 휴가 내역", callback_data: "leave:history" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      },
      utils: {
        inline_keyboard: [
          [
            { text: "🔊 TTS 메뉴", callback_data: "utils:tts:menu" },
            { text: "📌 공지사항", callback_data: "utils:notice" },
          ],
          [
            { text: "❓ 도움말", callback_data: "utils:help" },
            { text: "🔙 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      },
      // 다른 메뉴들도 필요에 따라 추가
    };

    return keyboards[menuType] || this.getDefaultKeyboard();
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
      { text: "📝 할일 관리", callback_data: "todo:menu", module: "todo" },
      { text: "🔮 운세", callback_data: "fortune:menu", module: "fortune" },
      { text: "🌤️ 날씨", callback_data: "weather:menu", module: "weather" },
      { text: "⏰ 타이머", callback_data: "timer:menu", module: "timer" },
      { text: "📊 인사이트", callback_data: "insight:menu", module: "insight" },
      { text: "🛠️ 유틸리티", callback_data: "utils:menu", module: "utils" },
      {
        text: "🔔 리마인더",
        callback_data: "reminder:menu",
        module: "reminder",
      },
      { text: "📅 휴가 관리", callback_data: "leave:menu", module: "leave" },
      {
        text: "🕐 근무시간",
        callback_data: "worktime:menu",
        module: "worktime",
      },
    ];

    console.log("🔍 모듈 버튼 체크 시작...");

    for (const button of moduleButtons) {
      const isEnabled = this.isModuleEnabledQuick(button.module);
      console.log(`📱 ${button.module}: ${isEnabled ? "활성" : "비활성"}`);
      if (isEnabled) {
        menuItems.push(button);
      }
    }

    return menuItems;
  }

  isModuleEnabledQuick(moduleName) {
    try {
      if (!this.moduleManager) {
        return false;
      }

      const moduleClass = this.moduleMapping[moduleName];
      if (!moduleClass) {
        return false;
      }

      return this.moduleManager.hasModule(moduleClass);
    } catch (error) {
      logger.error(`모듈 활성화 확인 실패 (${moduleName}):`, error);
      return false;
    }
  }

  createKeyboardLayout(items, options = {}) {
    const { columns = 2 } = options;
    const keyboard = [];

    for (let i = 0; i < items.length; i += columns) {
      const row = [];
      for (let j = 0; j < columns && i + j < items.length; j++) {
        row.push({
          text: items[i + j].text,
          callback_data: items[i + j].callback_data,
        });
      }
      keyboard.push(row);
    }

    return { inline_keyboard: keyboard };
  }

  getDefaultKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "⏰ 타이머", callback_data: "timer:menu" },
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
        ],
      ],
    };
  }
}

module.exports = MenuManager;
