// src/managers/MenuManager.js - 동적 메뉴 시스템
const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const MenuConfig = require("../config/MenuConfig");
const AppConfig = require("../config/AppConfig");

class MenuManager {
  constructor() {
    this.moduleManager = null; // 나중에 주입받을 예정
    this.menuCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;

    Logger.info("📋 MenuManager 초기화됨 (ModuleManager 대기 중)");
  }

  // 새로 추가: ModuleManager 설정
  setDependencies(dependencies) {
    this.dependencies = dependencies;
    if (dependencies.moduleManager) {
      this.setModuleManager(dependencies.moduleManager);
    }
  }

  // 모듈 매니저 설정
  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
    Logger.info("📋 MenuManager에 ModuleManager 연결됨");
  }

  // 메인 메뉴 키보드 생성
  async getMainMenuKeyboard() {
    try {
      const cacheKey = "main_menu";
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const menuItems = await this.buildMainMenuItems();
      const keyboard = this.createKeyboardLayout(menuItems, {
        columns: 2,
        title: "🤖 두목봇 메인 메뉴",
      });

      this.setCache(cacheKey, keyboard);
      return keyboard;
    } catch (error) {
      Logger.error("메인 메뉴 키보드 생성 실패:", error);
      return this.getDefaultKeyboard();
    }
  }

  // 메인 메뉴 아이템 구성
  async buildMainMenuItems() {
    const menuItems = [];
    const moduleConfig = MenuConfig.getMainMenuConfig();

    // 활성화된 모듈별로 메뉴 아이템 추가
    for (const [moduleKey, config] of Object.entries(moduleConfig)) {
      if (this.isModuleEnabled(moduleKey)) {
        menuItems.push({
          text: config.text,
          callback_data: config.callback_data,
          emoji: config.emoji,
          priority: config.priority || 100,
          module: moduleKey,
        });
      }
    }

    // 우선순위별로 정렬
    menuItems.sort((a, b) => (a.priority || 100) - (b.priority || 100));

    // 화성/동탄 특화 아이템 최우선 배치
    const dongtanItems = menuItems.filter(
      (item) =>
        item.callback_data === "weather_menu" ||
        item.callback_data === "worktime_menu"
    );
    const otherItems = menuItems.filter(
      (item) =>
        item.callback_data !== "weather_menu" &&
        item.callback_data !== "worktime_menu"
    );

    return [...dongtanItems, ...otherItems];
  }

  // 서브 메뉴 키보드 생성
  async getSubMenuKeyboard(menuType, options = {}) {
    try {
      const cacheKey = `sub_menu_${menuType}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let menuItems = [];
      let keyboard = null;

      switch (menuType) {
        case "todo_menu":
          menuItems = MenuConfig.getTodoMenuConfig();
          break;
        case "leave_menu":
          menuItems = MenuConfig.getLeaveMenuConfig();
          break;
        case "weather_menu":
          menuItems = MenuConfig.getWeatherMenuConfig();
          break;
        case "fortune_menu":
          menuItems = MenuConfig.getFortuneMenuConfig();
          break;
        case "timer_menu":
          menuItems = MenuConfig.getTimerMenuConfig();
          break;
        case "insight_menu":
          menuItems = MenuConfig.getInsightMenuConfig();
          break;
        case "utils_menu":
          menuItems = MenuConfig.getUtilsMenuConfig();
          break;
        case "reminder_menu":
          menuItems = MenuConfig.getReminderMenuConfig();
          break;
        default:
          Logger.warn(`알 수 없는 메뉴 타입: ${menuType}`);
          return this.getDefaultKeyboard();
      }

      keyboard = this.createKeyboardLayout(menuItems, {
        ...options,
        backButton: true,
        backCallback: "main_menu",
      });

      this.setCache(cacheKey, keyboard);
      return keyboard;
    } catch (error) {
      Logger.error(`서브 메뉴 키보드 생성 실패 [${menuType}]:`, error);
      return this.getDefaultKeyboard();
    }
  }

  // 키보드 레이아웃 생성
  createKeyboardLayout(items, options = {}) {
    const {
      columns = 2,
      title = null,
      backButton = false,
      backCallback = "main_menu",
      extraButtons = [],
    } = options;

    const keyboard = [];

    // 타이틀이 있으면 무시 (텍스트에서 처리)

    // 메뉴 아이템들을 행으로 그룹화
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns).map((item) => ({
        text: `${item.emoji || ""} ${item.text}`.trim(),
        callback_data: item.callback_data,
      }));
      keyboard.push(row);
    }

    // 추가 버튼들
    if (extraButtons.length > 0) {
      extraButtons.forEach((buttonRow) => {
        if (Array.isArray(buttonRow)) {
          keyboard.push(buttonRow);
        } else {
          keyboard.push([buttonRow]);
        }
      });
    }

    // 뒤로가기 버튼
    if (backButton) {
      keyboard.push([
        {
          text: "🔙 메인 메뉴",
          callback_data: backCallback,
        },
      ]);
    }

    return { inline_keyboard: keyboard };
  }

  // 메인 메뉴 표시
  async showMainMenu(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const userName = getUserName(callbackQuery.from);

      const welcomeText = this.getMainMenuText(userName);
      const keyboard = await this.getMainMenuKeyboard();

      await bot.editMessageText(welcomeText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      Logger.userAction(callbackQuery.from.id, "main_menu_shown");
    } catch (error) {
      Logger.error("메인 메뉴 표시 실패:", error);
      await this.sendErrorMenu(
        bot,
        callbackQuery.message.chat.id,
        "메뉴를 불러올 수 없습니다."
      );
    }
  }

  // 메인 메뉴 텍스트 생성
  getMainMenuText(userName) {
    const now = new Date();
    const koreaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
    );
    const hour = koreaTime.getHours();

    let greeting = "안녕하세요";
    if (hour >= 5 && hour < 12) {
      greeting = "좋은 아침이에요";
    } else if (hour >= 12 && hour < 18) {
      greeting = "좋은 오후에요";
    } else if (hour >= 18 && hour < 22) {
      greeting = "좋은 저녁이에요";
    } else {
      greeting = "늦은 시간이네요";
    }

    let message = `🤖 **두목봇 메인 메뉴**\n\n`;
    message += `${greeting} ${userName}님! 👋\n\n`;

    // 화성/동탄 특화 메시지
    if (AppConfig.DONGTAN.DEFAULT_CITY === "화성") {
      message += `🏡 **동탄/화성 지역 특화 서비스**\n`;
      message += `• 화성 날씨 정보 우선 제공\n`;
      message += `• 동탄 근무시간 기반 기능\n\n`;
    }

    message += `원하는 기능을 선택해주세요:`;

    return message;
  }

  // 서브 메뉴 표시
  async showSubMenu(bot, callbackQuery, menuType) {
    try {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const menuText = this.getSubMenuText(menuType);
      const keyboard = await this.getSubMenuKeyboard(menuType);

      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      Logger.userAction(callbackQuery.from.id, "sub_menu_shown", { menuType });
    } catch (error) {
      Logger.error(`서브 메뉴 표시 실패 [${menuType}]:`, error);
      await this.sendErrorMenu(
        bot,
        callbackQuery.message.chat.id,
        "메뉴를 불러올 수 없습니다."
      );
    }
  }

  // 서브 메뉴 텍스트 생성
  getSubMenuText(menuType) {
    const menuTexts = {
      todo_menu: "📝 **할일 관리**\n\n할일을 효율적으로 관리해보세요:",
      leave_menu: "📅 **휴가 관리**\n\n연차와 휴가를 체계적으로 관리하세요:",
      weather_menu: "🌤️ **날씨 정보**\n\n🏡 화성/동탄 중심의 날씨 서비스:",
      fortune_menu: "🔮 **운세 정보**\n\n오늘의 운세를 확인해보세요:",
      timer_menu: "⏰ **타이머**\n\n작업 시간을 효율적으로 관리하세요:",
      insight_menu: "📊 **마케팅 인사이트**\n\n비즈니스 인사이트를 확인하세요:",
      utils_menu: "🛠️ **유틸리티**\n\n편리한 도구들을 사용해보세요:",
      reminder_menu: "🔔 **리마인더**\n\n중요한 일정을 놓치지 마세요:",
      worktime_menu: "🕐 **근무시간**\n\n🏡 동탄 근무자를 위한 시간 관리:",
    };

    return menuTexts[menuType] || "📋 **메뉴**\n\n기능을 선택해주세요:";
  }

  // 동적 메뉴 아이템 추가
  addDynamicMenuItem(menuType, item) {
    try {
      const cacheKey = `sub_menu_${menuType}`;
      this.clearCache(cacheKey); // 캐시 무효화

      Logger.debug(`동적 메뉴 아이템 추가: ${menuType}`, item);
    } catch (error) {
      Logger.error("동적 메뉴 아이템 추가 실패:", error);
    }
  }

  // 모듈 활성화 상태 확인
  isModuleEnabled(moduleKey) {
    if (!this.moduleManager) {
      Logger.warn(`MenuManager: ModuleManager가 아직 설정되지 않음`);
      return false;
    }

    const moduleMapping = {
      todo: "TodoModule",
      leave: "LeaveModule",
      weather: "WeatherModule",
      fortune: "FortuneModule",
      timer: "TimerModule",
      insight: "InsightModule",
      utils: "UtilsModule",
      reminder: "ReminderModule",
      worktime: "WorktimeModule",
    };

    const moduleName = moduleMapping[moduleKey];
    if (!moduleName) return false;

    const module = this.moduleManager.getModule(moduleName);
    const isEnabled = module !== null;

    Logger.debug(`모듈 ${moduleKey} (${moduleName}) 활성화 상태: ${isEnabled}`);
    return isEnabled;
  }

  // 사용자 맞춤 메뉴 생성
  async getPersonalizedMenu(userId, preferences = {}) {
    try {
      const baseMenu = await this.getMainMenuKeyboard();

      // 사용자 선호도나 사용 패턴에 따라 메뉴 커스터마이징
      // 현재는 기본 메뉴 반환, 향후 확장 가능

      return baseMenu;
    } catch (error) {
      Logger.error("개인화 메뉴 생성 실패:", error);
      return this.getDefaultKeyboard();
    }
  }

  // 컨텍스트 메뉴 생성 (상황별 메뉴)
  getContextMenu(context, options = {}) {
    try {
      let menuItems = [];

      switch (context) {
        case "error":
          menuItems = [
            { text: "🔄 다시 시도", callback_data: "retry_last_action" },
            { text: "❓ 도움말", callback_data: "help" },
            { text: "🔙 메인 메뉴", callback_data: "main_menu" },
          ];
          break;

        case "loading":
          menuItems = [{ text: "❌ 취소", callback_data: "cancel_action" }];
          break;

        case "confirmation":
          menuItems = [
            {
              text: "✅ 확인",
              callback_data: options.confirmCallback || "confirm",
            },
            {
              text: "❌ 취소",
              callback_data: options.cancelCallback || "cancel",
            },
          ];
          break;

        default:
          return this.getDefaultKeyboard();
      }

      return this.createKeyboardLayout(menuItems, {
        columns: menuItems.length <= 2 ? menuItems.length : 2,
      });
    } catch (error) {
      Logger.error(`컨텍스트 메뉴 생성 실패 [${context}]:`, error);
      return this.getDefaultKeyboard();
    }
  }

  // 기본 키보드 (폴백용)
  getDefaultKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo_menu" },
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime_menu" },
          { text: "❓ 도움말", callback_data: "help" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };
  }

  // 에러 메뉴 전송
  async sendErrorMenu(bot, chatId, message) {
    try {
      const errorKeyboard = this.getContextMenu("error");

      await bot.sendMessage(chatId, `❌ ${message}`, {
        reply_markup: errorKeyboard,
      });
    } catch (error) {
      Logger.error("에러 메뉴 전송 실패:", error);
    }
  }

  // 메뉴 업데이트 알림
  async notifyMenuUpdate(bot, chatId, messageId) {
    try {
      const updatedKeyboard = await this.getMainMenuKeyboard();

      await bot.editMessageReplyMarkup(updatedKeyboard, {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      Logger.error("메뉴 업데이트 알림 실패:", error);
    }
  }

  // 캐시 관리
  getFromCache(key) {
    const cached = this.menuCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.menuCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(key = null) {
    if (key) {
      this.menuCache.delete(key);
    } else {
      this.menuCache.clear();
    }
  }

  // 캐시 정리 (주기적으로 호출)
  cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.menuCache.entries()) {
      if (now - cached.timestamp >= this.cacheTimeout) {
        this.menuCache.delete(key);
      }
    }
  }

  // 통계 정보 조회
  getMenuStats() {
    return {
      cacheSize: this.menuCache.size,
      enabledModules: Object.keys(MenuConfig.getMainMenuConfig()).filter(
        (key) => this.isModuleEnabled(key)
      ).length,
      lastCacheCleanup: new Date().toISOString(),
    };
  }

  // 메뉴 설정 업데이트
  updateMenuConfig(newConfig) {
    this.clearCache(); // 전체 캐시 클리어
    Logger.info("메뉴 설정 업데이트됨", newConfig);
  }
}

// 캐시 정리 스케줄러 (30분마다)
setInterval(
  () => {
    // 전역 MenuManager 인스턴스가 있다면 캐시 정리
    if (global.menuManager instanceof MenuManager) {
      global.menuManager.cleanupCache();
    }
  },
  30 * 60 * 1000
);

module.exports = MenuManager;
