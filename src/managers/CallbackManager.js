// src/managers/CallbackManager.js - 수정된 버전

const Logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.menuManager = null; // MenuManager 참조 추가

    // 콜백 라우팅 맵
    this.routes = new Map();
    this.initializeRoutes();

    Logger.info(
      `📞 CallbackManager 초기화됨. 모듈 수: ${Object.keys(this.modules).length}`
    );
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  // MenuManager 설정 메서드 추가
  setMenuManager(menuManager) {
    this.menuManager = menuManager;
  }

  initializeRoutes() {
    // 메인 메뉴
    this.routes.set("main_menu", { module: "menu", method: "showMainMenu" });
    this.routes.set("help_menu", { module: "menu", method: "showHelpMenu" });
    this.routes.set("cancel_action", {
      module: "common",
      method: "handleCancel",
    });

    // 할일 관리
    this.routes.set("todo_menu", { module: "todo", method: "showMenu" });
    this.routes.set("todo_list", { module: "todo", method: "showList" });
    this.routes.set("todo_add", { module: "todo", method: "startAdd" });
    this.routes.set("todo_stats", { module: "todo", method: "showStats" });
    this.routes.set("todo_clear_completed", {
      module: "todo",
      method: "clearCompleted",
    });
    this.routes.set("todo_clear_all", { module: "todo", method: "clearAll" });

    // 휴가 관리
    this.routes.set("leave_menu", { module: "leave", method: "showMenu" });
    this.routes.set("leave_status", { module: "leave", method: "showStatus" });
    this.routes.set("leave_use", { module: "leave", method: "showUseMenu" });
    this.routes.set("leave_history", {
      module: "leave",
      method: "showHistory",
    });
    this.routes.set("leave_setting", {
      module: "leave",
      method: "startSetting",
    });
    this.routes.set("use_leave_1", { module: "leave", method: "useOne" });
    this.routes.set("use_leave_0.5", { module: "leave", method: "useHalf" });
    this.routes.set("use_leave_custom", {
      module: "leave",
      method: "useCustom",
    });

    // 운세 관리
    this.routes.set("fortune_menu", { module: "fortune", method: "showMenu" });
    this.routes.set("fortune_general", {
      module: "fortune",
      method: "showGeneral",
    });
    this.routes.set("fortune_work", { module: "fortune", method: "showWork" });
    this.routes.set("fortune_love", { module: "fortune", method: "showLove" });
    this.routes.set("fortune_money", {
      module: "fortune",
      method: "showMoney",
    });
    this.routes.set("fortune_health", {
      module: "fortune",
      method: "showHealth",
    });
    this.routes.set("fortune_meeting", {
      module: "fortune",
      method: "showMeeting",
    });
    this.routes.set("fortune_tarot", {
      module: "fortune",
      method: "showTarot",
    });
    this.routes.set("fortune_tarot3", {
      module: "fortune",
      method: "showTarotThreeSpread",
    });
    this.routes.set("fortune_lucky", {
      module: "fortune",
      method: "showLucky",
    });
    this.routes.set("fortune_all", { module: "fortune", method: "showAll" });

    // 타이머 관리
    this.routes.set("timer_menu", { module: "timer", method: "showMenu" });
    this.routes.set("timer_start_prompt", {
      module: "timer",
      method: "startPrompt",
    });
    this.routes.set("timer_stop", { module: "timer", method: "stop" });
    this.routes.set("timer_status", { module: "timer", method: "showStatus" });

    // 날씨 관리
    this.routes.set("weather_menu", { module: "weather", method: "showMenu" });
    this.routes.set("weather_current", {
      module: "weather",
      method: "showCurrent",
    });
    this.routes.set("weather_forecast", {
      module: "weather",
      method: "showForecast",
    });
    this.routes.set("weather_seoul", {
      module: "weather",
      method: "showSeoul",
    });
    this.routes.set("weather_busan", {
      module: "weather",
      method: "showBusan",
    });
    this.routes.set("weather_more_cities", {
      module: "weather",
      method: "showMoreCities",
    });

    // 인사이트 관리
    this.routes.set("insight_menu", { module: "insight", method: "showMenu" });
    this.routes.set("insight_full", { module: "insight", method: "showFull" });
    this.routes.set("insight_quick", {
      module: "insight",
      method: "showQuick",
    });
    this.routes.set("insight_dashboard", {
      module: "insight",
      method: "showDashboard",
    });
    this.routes.set("insight_national", {
      module: "insight",
      method: "showNational",
    });
    this.routes.set("insight_refresh", {
      module: "insight",
      method: "refresh",
    });

    // 유틸리티 관리
    this.routes.set("utils_menu", { module: "utils", method: "showMenu" });
    this.routes.set("utils_tts_menu", {
      module: "utils",
      method: "showTTSMenu",
    });
    this.routes.set("utils_tts_help", {
      module: "utils",
      method: "showTTSHelp",
    });
    this.routes.set("utils_help", { module: "utils", method: "showHelp" });

    // 리마인더 관리
    this.routes.set("reminder_menu", {
      module: "reminder",
      method: "showMenu",
    });
    this.routes.set("remind_minutes", {
      module: "reminder",
      method: "showMinutes",
    });
    this.routes.set("remind_time", { module: "reminder", method: "showTime" });
    this.routes.set("remind_help", { module: "reminder", method: "showHelp" });

    // 근무시간 관리
    this.routes.set("worktime_menu", {
      module: "worktime",
      method: "showMenu",
    });
  }

  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    Logger.info(`📞 콜백 처리: ${data}`);

    try {
      // 콜백 응답
      await this.bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      Logger.error("콜백 응답 실패:", error);
    }

    try {
      // 동적 콜백 처리 (todo_toggle_1, todo_delete_1 등)
      if (data.includes("_")) {
        const handled = await this.handleDynamicCallback(callbackQuery);
        if (handled) return;
      }

      // 라우팅된 콜백 처리
      const route = this.routes.get(data);
      if (route) {
        await this.executeRoute(route, callbackQuery);
      } else {
        Logger.warn(`알 수 없는 콜백: ${data}`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      Logger.error("콜백 처리 오류:", error);
      await this.sendErrorMessage(chatId);
    }
  }

  async handleDynamicCallback(callbackQuery) {
    const data = callbackQuery.data;

    // todo_toggle_1, todo_delete_1 형식 처리
    if (data.startsWith("todo_toggle_") || data.startsWith("todo_delete_")) {
      if (this.modules.todo) {
        await this.modules.todo.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    // tts_lang_ko 형식 처리
    if (data.startsWith("tts_")) {
      if (this.modules.utils) {
        await this.modules.utils.handleTTSCallback(callbackQuery);
        return true;
      }
    }

    // weather_incheon 등 동적 도시 처리
    if (data.startsWith("weather_") && !this.routes.has(data)) {
      if (this.modules.weather) {
        await this.modules.weather.handleCityCallback(callbackQuery);
        return true;
      }
    }

    // insight 관련 동적 콜백
    if (data.startsWith("insight_") && !this.routes.has(data)) {
      if (this.modules.insight) {
        await this.modules.insight.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    return false;
  }

  async executeRoute(route, callbackQuery) {
    const { module: moduleName, method: methodName } = route;

    // 특별 처리: menu와 common은 별도 처리
    if (moduleName === "menu") {
      // MenuManager를 통해 처리
      if (methodName === "showMainMenu") {
        await this.showMainMenu(callbackQuery);
      } else if (methodName === "showHelpMenu") {
        await this.showHelpMenu(callbackQuery);
      }
      return;
    }

    if (moduleName === "common") {
      if (methodName === "handleCancel") {
        await this.handleCancel(callbackQuery);
      }
      return;
    }

    // 일반 모듈 처리 - menuManager 전달
    const module = this.modules[moduleName];
    if (module) {
      await this.handleModuleCallback(module, callbackQuery, methodName);
    } else {
      Logger.error(`모듈을 찾을 수 없음: ${moduleName}`);
      await this.handleUnknownCallback(callbackQuery);
    }
  }

  // 모듈 콜백 처리 - menuManager 전달 추가
  async handleModuleCallback(module, callbackQuery, methodName) {
    try {
      const data = callbackQuery.data;
      const parts = data.split("_");
      const action = parts[0];
      const subAction = parts.slice(1).join("_");
      const params = parts.slice(2);

      // 디버그 로그
      Logger.debug("handleModuleCallback 호출", {
        module: module.constructor.name,
        data: data,
        hasMenuManager: !!this.menuManager,
      });

      // handleCallback 메서드에 menuManager 전달
      if (module.handleCallback) {
        await module.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params,
          this.menuManager // menuManager 전달
        );
      } else {
        Logger.warn(
          `모듈 ${module.constructor.name}에 handleCallback 메서드가 없습니다`
        );
      }
    } catch (error) {
      Logger.error(`모듈 ${module.constructor.name} 콜백 처리 실패:`, error);
      throw error;
    }
  }

  async showMainMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userName = callbackQuery.from.first_name || "사용자";

    await this.bot.sendMessage(
      chatId,
      `🤖 안녕하세요 ${userName}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
      { reply_markup: this.createMainMenuKeyboard() }
    );
  }

  async showHelpMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;

    const helpText = `
❓ **두목봇 도움말**

🤖 **주요 기능:**
- 📝 할일 관리 - 할일 추가/완료/삭제
- 📅 휴가 관리 - 연차 사용/관리
- 🔮 운세 - 다양한 운세 정보
- ⏰ 타이머 - 작업 시간 관리
- 🔔 리마인더 - 알림 설정
- 🌤️ 날씨 - 날씨 정보
- 📊 인사이트 - 마케팅 인사이트
- 🛠️ 유틸리티 - TTS 등

🎯 **빠른 명령어:**
- /start - 메인 메뉴
- /add [할일] - 할일 빠른 추가
- /help - 도움말

🚀 **Railway 클라우드에서 24/7 운영 중!**
        `;

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    });
  }

  async handleCancel(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const userName = callbackQuery.from.first_name || "사용자";

    // 사용자 상태 초기화는 BotController에서 처리

    await this.bot.sendMessage(
      chatId,
      `❌ ${userName}님, 작업이 취소되었습니다.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      }
    );
  }

  async handleUnknownCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;

    await this.bot.sendMessage(
      chatId,
      `❌ 알 수 없는 명령입니다. 메인 메뉴로 돌아갑니다.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      }
    );
  }

  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
    } catch (error) {
      Logger.error("오류 메시지 전송 실패:", error);
    }
  }

  createMainMenuKeyboard() {
    const keyboard = [];

    // 동적으로 활성화된 모듈에 따라 메뉴 구성
    const firstRow = [];
    if (this.modules.todo)
      firstRow.push({ text: "📝 할일 관리", callback_data: "todo_menu" });
    if (this.modules.leave)
      firstRow.push({ text: "📅 휴가 관리", callback_data: "leave_menu" });
    if (firstRow.length > 0) keyboard.push(firstRow);

    const secondRow = [];
    if (this.modules.timer)
      secondRow.push({ text: "⏰ 타이머", callback_data: "timer_menu" });
    if (this.modules.fortune)
      secondRow.push({ text: "🎯 운세", callback_data: "fortune_menu" });
    if (secondRow.length > 0) keyboard.push(secondRow);

    const thirdRow = [];
    if (this.modules.worktime)
      thirdRow.push({ text: "🕐 근무시간", callback_data: "worktime_menu" });
    if (this.modules.weather)
      thirdRow.push({ text: "🌤️ 날씨", callback_data: "weather_menu" });
    if (thirdRow.length > 0) keyboard.push(thirdRow);

    const fourthRow = [];
    if (this.modules.insight)
      fourthRow.push({ text: "📊 인사이트", callback_data: "insight_menu" });
    if (this.modules.reminder)
      fourthRow.push({ text: "🔔 리마인더", callback_data: "reminder_menu" });
    if (fourthRow.length > 0) keyboard.push(fourthRow);

    const lastRow = [];
    if (this.modules.utils)
      lastRow.push({ text: "🛠️ 유틸리티", callback_data: "utils_menu" });
    lastRow.push({ text: "❓ 도움말", callback_data: "help_menu" });
    keyboard.push(lastRow);

    return { inline_keyboard: keyboard };
  }
}

module.exports = CallbackManager;
