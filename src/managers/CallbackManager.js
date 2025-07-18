// src/managers/CallbackManager.js - handleSystemCallback 메서드 추가

const Logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.menuManager = null; // MenuManager 참조 추가

    // 콜백 라우팅 맵
    this.routes = new Map();
    this.initializeRoutes();

    Logger.info(`📞 CallbackManager 초기화됨 (모듈 연결 대기 중)`);
  }

  // MenuManager 설정 메서드 추가
  setMenuManager(menuManager) {
    this.menuManager = menuManager;
    Logger.info("📞 CallbackManager에 MenuManager 연결됨");
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

    // 타이머 관리
    this.routes.set("timer_menu", { module: "timer", method: "showMenu" });
    this.routes.set("timer_pomodoro", {
      module: "timer",
      method: "startPomodoro",
    });
    this.routes.set("timer_custom", { module: "timer", method: "startCustom" });
    this.routes.set("timer_list", { module: "timer", method: "showList" });

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

    // 인사이트 관리
    this.routes.set("insight_menu", { module: "insight", method: "showMenu" });
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

    Logger.info(`📞 콜백 처리 시작: ${data}`);

    try {
      // 콜백 응답
      await this.bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      Logger.debug("콜백 응답 실패 (이미 응답됨):", error);
    }

    try {
      // 시스템 콜백 우선 처리
      if (await this.handleSystemCallback(callbackQuery)) {
        return true;
      }

      // 동적 콜백 처리 (todo_toggle_1, todo_delete_1 등)
      if (data.includes("_")) {
        const handled = await this.handleDynamicCallback(callbackQuery);
        if (handled) return true;
      }

      // 라우팅된 콜백 처리
      const route = this.routes.get(data);
      if (route) {
        await this.executeRoute(route, callbackQuery);
        return true;
      } else {
        Logger.warn(`알 수 없는 콜백: ${data}`);
        await this.handleUnknownCallback(callbackQuery);
        return false;
      }
    } catch (error) {
      Logger.error("📞 콜백 처리 오류:", error);
      Logger.error("❌ Stack trace:", error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
      return false;
    }
  }

  // ========== 시스템 콜백 처리 추가 ==========
  async handleSystemCallback(callbackQuery) {
    const data = callbackQuery.data;

    switch (data) {
      case "main_menu":
        try {
          const { getUserName } = require("../utils/UserHelper");
          const userName = getUserName(callbackQuery.from);

          const welcomeMessage =
            `🤖 **두목봇 메인 메뉴**\n\n` +
            `안녕하세요 ${userName}님! 👋\n\n` +
            `원하는 기능을 선택해주세요:`;

          await this.bot.editMessageText(welcomeMessage, {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          });
        } catch (error) {
          Logger.error("메인 메뉴 표시 실패:", error);
          await this.bot.sendMessage(
            callbackQuery.message.chat.id,
            "메인 메뉴로 돌아갑니다.",
            {
              reply_markup: this.createMainMenuKeyboard(),
            }
          );
        }
        return true;

      case "help":
      case "help_menu":
        await this.showHelpMenu(callbackQuery);
        return true;

      case "noop":
        // 아무것도 하지 않음 (페이지네이션 등에서 사용)
        return true;

      case "cancel":
      case "cancel_action":
        await this.bot.editMessageText("❌ 작업이 취소되었습니다.", {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        });
        return true;

      default:
        return false;
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

    // leave_confirm_ 형식 처리
    if (data.startsWith("leave_confirm_") || data.startsWith("leave_cancel_")) {
      if (this.modules.leave) {
        await this.modules.leave.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    // fortune_detail_ 형식 처리
    if (data.startsWith("fortune_detail_")) {
      if (this.modules.fortune) {
        await this.modules.fortune.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    // timer_start_, timer_stop_ 형식 처리
    if (
      data.startsWith("timer_start_") ||
      data.startsWith("timer_stop_") ||
      data.startsWith("timer_pause_")
    ) {
      if (this.modules.timer) {
        await this.modules.timer.handleDynamicCallback(callbackQuery);
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

    // worktime 관련 동적 콜백
    if (data.startsWith("worktime_") && !this.routes.has(data)) {
      if (this.modules.worktime) {
        await this.modules.worktime.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    // reminder 관련 동적 콜백
    if (data.startsWith("remind_") && !this.routes.has(data)) {
      if (this.modules.reminder) {
        await this.modules.reminder.handleDynamicCallback(callbackQuery);
        return true;
      }
    }

    return false;
  }

  async executeRoute(route, callbackQuery) {
    const { module: moduleName, method: methodName } = route;

    // 특별 처리: menu와 common은 별도 처리
    if (moduleName === "menu") {
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

    // 일반 모듈 처리
    const module = this.modules[moduleName];
    if (module) {
      await this.handleModuleCallback(module, callbackQuery, methodName);
    } else {
      Logger.error(`모듈을 찾을 수 없음: ${moduleName}`);
      await this.handleUnknownCallback(callbackQuery);
    }
  }

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

      // 모듈의 handleCallback 메서드 호출
      if (module.handleCallback) {
        const result = await module.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params
        );
        return result;
      }

      // 구식 메서드 지원 (하위 호환성)
      if (module[methodName]) {
        const result = await module[methodName](this.bot, callbackQuery);
        return result;
      }

      Logger.warn(
        `모듈 ${module.constructor.name}에 ${methodName} 메서드가 없음`
      );
      await this.handleUnknownCallback(callbackQuery);
    } catch (error) {
      Logger.error(`모듈 콜백 처리 실패:`, error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
    }
  }

  // ========== UI 헬퍼 메서드들 ==========

  async showMainMenu(callbackQuery) {
    try {
      const { getUserName } = require("../utils/UserHelper");
      const userName = getUserName(callbackQuery.from);

      const welcomeMessage =
        `🤖 **두목봇 메인 메뉴**\n\n` +
        `안녕하세요 ${userName}님! 👋\n\n` +
        `원하는 기능을 선택해주세요:`;

      await this.bot.editMessageText(welcomeMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: this.createMainMenuKeyboard(),
      });
    } catch (error) {
      Logger.error("메인 메뉴 표시 실패:", error);
      await this.bot.sendMessage(
        callbackQuery.message.chat.id,
        "메인 메뉴로 돌아갑니다.",
        {
          reply_markup: this.createMainMenuKeyboard(),
        }
      );
    }
  }

  async showHelpMenu(callbackQuery) {
    const helpMessage =
      `❓ **두목봇 도움말**\n\n` +
      `**📝 할일 관리**\n` +
      `• /todo - 할일 목록 보기\n` +
      `• /todo_add [내용] - 할일 추가\n\n` +
      `**📅 휴가 관리**\n` +
      `• /leave - 휴가 현황 보기\n` +
      `• /use_leave [일수] - 휴가 사용\n\n` +
      `**🔮 운세**\n` +
      `• /fortune - 오늘의 운세\n\n` +
      `**⏰ 타이머**\n` +
      `• /timer [분] - 타이머 설정\n` +
      `• /pomodoro - 포모도로 타이머\n\n` +
      `**🌤️ 날씨**\n` +
      `• /weather - 현재 날씨\n` +
      `• /forecast - 날씨 예보\n\n` +
      `**🛠️ 기타 명령어**\n` +
      `• /start - 메인 메뉴\n` +
      `• /help - 도움말\n` +
      `• /status - 봇 상태`;

    try {
      await this.bot.editMessageText(helpMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      Logger.error("도움말 표시 실패:", error);
      await this.bot.sendMessage(callbackQuery.message.chat.id, helpMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    }
  }

  async handleCancel(callbackQuery) {
    await this.bot.editMessageText("❌ 작업이 취소되었습니다.", {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    });
  }

  async handleUnknownCallback(callbackQuery) {
    await this.bot.editMessageText(
      `❓ 알 수 없는 요청입니다: ${callbackQuery.data}`,
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
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
      await this.bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
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
      secondRow.push({ text: "🔮 운세", callback_data: "fortune_menu" });
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
