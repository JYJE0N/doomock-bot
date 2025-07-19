// src/managers/CallbackManager.js - BaseModule 표준 패턴 완전 지원

const Logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.routes = new Map();

    this.initializeRoutes();

    Logger.info(
      `📞 CallbackManager 초기화됨. 모듈 수: ${
        Object.keys(this.modules).length
      }`
    );
    Logger.info(`📋 등록된 라우팅 수: ${this.routes.size}개`);
  }

  initializeRoutes() {
    // 🏠 시스템 라우팅
    this.addSystemRoutes();

    // 📝 할일 관리 라우팅
    this.addTodoRoutes();

    // 🔮 운세 라우팅
    this.addFortuneRoutes();

    // 🌤️ 날씨 라우팅
    this.addWeatherRoutes();

    // ⏰ 타이머 라우팅
    this.addTimerRoutes();

    // 📅 휴가 관리 라우팅
    this.addLeaveRoutes();

    // 📊 인사이트 라우팅
    this.addInsightRoutes();

    // 🛠️ 유틸리티 라우팅
    this.addUtilsRoutes();

    // 🔔 리마인더 라우팅
    this.addReminderRoutes();

    // 🕐 근무시간 라우팅
    this.addWorktimeRoutes();

    Logger.info(`✅ 모든 라우팅 등록 완료: ${this.routes.size}개`);
  }

  // 🏠 시스템 라우팅
  addSystemRoutes() {
    const systemRoutes = [
      ["main_menu", "system", "showMainMenu"],
      ["help_menu", "system", "showHelpMenu"],
      ["cancel_action", "system", "handleCancel"],
    ];

    systemRoutes.forEach(([route, module, method]) => {
      this.routes.set(route, { module, method });
    });

    Logger.debug(`🏠 시스템 라우팅 ${systemRoutes.length}개 등록`);
  }

  // 📝 할일 관리 라우팅
  addTodoRoutes() {
    const todoActions = [
      "menu",
      "list",
      "add",
      "stats",
      "clear",
      "clear_completed",
      "clear_all",
      "help",
    ];

    todoActions.forEach((action) => {
      this.routes.set(`todo_${action}`, { module: "todo", method: action });
    });

    Logger.debug(`📝 할일 라우팅 ${todoActions.length}개 등록`);
  }

  // 🔮 운세 라우팅
  addFortuneRoutes() {
    const fortuneActions = [
      "menu",
      "general",
      "today",
      "work",
      "love",
      "money",
      "health",
      "tarot",
      "tarot3",
      "lucky",
      "meeting",
      "all",
      "help",
    ];

    fortuneActions.forEach((action) => {
      this.routes.set(`fortune_${action}`, {
        module: "fortune",
        method: action,
      });
    });

    Logger.debug(`🔮 운세 라우팅 ${fortuneActions.length}개 등록`);
  }

  // 🌤️ 날씨 라우팅
  addWeatherRoutes() {
    const weatherActions = [
      "menu",
      "current",
      "forecast",
      "seoul",
      "busan",
      "more_cities",
      "quick",
      "help",
    ];

    weatherActions.forEach((action) => {
      this.routes.set(`weather_${action}`, {
        module: "weather",
        method: action,
      });
    });

    Logger.debug(`🌤️ 날씨 라우팅 ${weatherActions.length}개 등록`);
  }

  // ⏰ 타이머 라우팅
  addTimerRoutes() {
    const timerActions = [
      "menu",
      "start",
      "stop",
      "pause",
      "resume",
      "pomodoro_start",
      "custom_start",
      "status",
      "help",
    ];

    timerActions.forEach((action) => {
      this.routes.set(`timer_${action}`, { module: "timer", method: action });
    });

    Logger.debug(`⏰ 타이머 라우팅 ${timerActions.length}개 등록`);
  }

  // 📅 휴가 관리 라우팅
  addLeaveRoutes() {
    const leaveActions = [
      "menu",
      "status",
      "use",
      "history",
      "setting",
      "use_1",
      "use_0.5",
      "use_custom",
      "help",
    ];

    leaveActions.forEach((action) => {
      this.routes.set(`leave_${action}`, { module: "leave", method: action });
    });

    Logger.debug(`📅 휴가 라우팅 ${leaveActions.length}개 등록`);
  }

  // 📊 인사이트 라우팅
  addInsightRoutes() {
    const insightActions = [
      "menu",
      "dashboard",
      "national",
      "refresh",
      "quick",
      "full",
      "help",
    ];

    insightActions.forEach((action) => {
      this.routes.set(`insight_${action}`, {
        module: "insight",
        method: action,
      });
    });

    Logger.debug(`📊 인사이트 라우팅 ${insightActions.length}개 등록`);
  }

  // 🛠️ 유틸리티 라우팅
  addUtilsRoutes() {
    const utilsActions = ["menu", "tts_menu", "tts_help", "help"];

    utilsActions.forEach((action) => {
      this.routes.set(`utils_${action}`, { module: "utils", method: action });
    });

    Logger.debug(`🛠️ 유틸리티 라우팅 ${utilsActions.length}개 등록`);
  }

  // 🔔 리마인더 라우팅
  addReminderRoutes() {
    const reminderActions = ["menu", "minutes", "time", "help"];

    reminderActions.forEach((action) => {
      this.routes.set(`reminder_${action}`, {
        module: "reminder",
        method: action,
      });
    });

    // 별칭 라우팅
    this.routes.set("remind_minutes", {
      module: "reminder",
      method: "minutes",
    });
    this.routes.set("remind_time", { module: "reminder", method: "time" });
    this.routes.set("remind_help", { module: "reminder", method: "help" });

    Logger.debug(`🔔 리마인더 라우팅 ${reminderActions.length + 3}개 등록`);
  }

  // 🕐 근무시간 라우팅
  addWorktimeRoutes() {
    const worktimeActions = [
      "menu",
      "checkin",
      "checkout",
      "status",
      "history",
      "help",
    ];

    worktimeActions.forEach((action) => {
      this.routes.set(`worktime_${action}`, {
        module: "worktime",
        method: action,
      });
    });

    Logger.debug(`🕐 근무시간 라우팅 ${worktimeActions.length}개 등록`);
  }

  // ========== 📞 핵심 콜백 처리 ==========

  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    Logger.info(`📞 콜백 수신: ${data}`);

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      Logger.error("콜백 응답 실패:", error);
    }

    try {
      // 🎯 동적 콜백 먼저 처리 (toggle_1, delete_2 등)
      if (await this.handleDynamicCallback(callbackQuery)) {
        return;
      }

      // 📋 정적 라우팅 처리
      const route = this.routes.get(data);
      if (route) {
        Logger.info(
          `✅ 라우팅 발견: ${data} → ${route.module}.${route.method}`
        );
        await this.executeRoute(route, callbackQuery);
      } else {
        Logger.warn(`❌ 라우팅 없음: ${data}`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      Logger.error("콜백 처리 오류:", error);
      await this.sendErrorMessage(chatId);
    }
  }

  // 🎯 동적 콜백 처리 (toggle_1, delete_2, weather_인천 등)
  async handleDynamicCallback(callbackQuery) {
    const data = callbackQuery.data;

    // todo 동적 콜백 (toggle_1, delete_2 등)
    if (
      data.startsWith("todo_") &&
      (data.includes("toggle_") || data.includes("delete_"))
    ) {
      const module = this.modules.todo;
      if (module && typeof module.handleCallback === "function") {
        const parts = data.split("_");
        const subAction = parts.slice(1).join("_"); // "toggle_1" 또는 "delete_2"
        await module.handleCallback(this.bot, callbackQuery, subAction, []);
        return true;
      }
    }

    // weather 동적 콜백 (weather_인천 등)
    if (data.startsWith("weather_") && !this.routes.has(data)) {
      const module = this.modules.weather;
      if (module && typeof module.handleCallback === "function") {
        const city = data.replace("weather_", "");
        await module.handleCallback(this.bot, callbackQuery, "city", [city]);
        return true;
      }
    }

    // insight 동적 콜백
    if (data.startsWith("insight_") && !this.routes.has(data)) {
      const module = this.modules.insight;
      if (module && typeof module.handleCallback === "function") {
        const subAction = data.replace("insight_", "");
        await module.handleCallback(this.bot, callbackQuery, subAction, []);
        return true;
      }
    }

    return false;
  }

  // ⚙️ 라우트 실행 - BaseModule 표준 패턴 지원
  async executeRoute(route, callbackQuery) {
    const { module: moduleName, method: methodName } = route;

    // 시스템 처리
    if (moduleName === "system") {
      return await this.handleSystemCallback(callbackQuery, methodName);
    }

    // 모듈 처리
    const module = this.modules[moduleName];
    if (!module) {
      Logger.error(`❌ 모듈 없음: ${moduleName}`);
      return await this.handleUnknownCallback(callbackQuery);
    }

    try {
      Logger.info(
        `🔧 모듈 호출: ${moduleName}.handleCallback("${methodName}")`
      );

      // ✅ BaseModule 표준 패턴 호출
      if (typeof module.handleCallback === "function") {
        // BaseModule.handleCallback(bot, callbackQuery, subAction, params)
        await module.handleCallback(this.bot, callbackQuery, methodName, []);
      } else {
        Logger.error(`❌ ${moduleName}에 handleCallback 메서드 없음`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 실행 오류:`, error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
    }
  }

  // ========== 🏠 시스템 콜백 처리 ==========

  async handleSystemCallback(callbackQuery, method) {
    switch (method) {
      case "showMainMenu":
        await this.showMainMenu(callbackQuery);
        break;
      case "showHelpMenu":
        await this.showHelpMenu(callbackQuery);
        break;
      case "handleCancel":
        await this.handleCancel(callbackQuery);
        break;
      default:
        await this.handleUnknownCallback(callbackQuery);
    }
  }

  async showMainMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userName = callbackQuery.from.first_name || "사용자";

    const text = `🤖 **두목봇 메인 메뉴**\n\n안녕하세요 ${userName}님!\n\n원하는 기능을 선택해주세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo_menu" },
          { text: "📅 휴가 관리", callback_data: "leave_menu" },
        ],
        [
          { text: "🔮 운세", callback_data: "fortune_menu" },
          { text: "⏰ 타이머", callback_data: "timer_menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
          { text: "📊 인사이트", callback_data: "insight_menu" },
        ],
        [
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
          { text: "🔔 리마인더", callback_data: "reminder_menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime_menu" },
          { text: "❓ 도움말", callback_data: "help_menu" },
        ],
      ],
    };

    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.warn("메시지 수정 실패, 새 메시지 전송");
      await this.bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showHelpMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    const helpText =
      `❓ **두목봇 도움말**\n\n` +
      `**📱 사용법:**\n` +
      `• 버튼을 클릭해서 원하는 기능 사용\n` +
      `• /start - 메인 메뉴로 돌아가기\n` +
      `• /help - 이 도움말 보기\n\n` +
      `**🔧 주요 기능:**\n` +
      `• 📝 할일 관리 - 할일 추가/완료/삭제\n` +
      `• 📅 휴가 관리 - 연차 사용/관리\n` +
      `• 🔮 운세 - 오늘의 운세 확인\n` +
      `• ⏰ 타이머 - 작업 시간 측정\n` +
      `• 🌤️ 날씨 - 실시간 날씨 정보\n` +
      `• 📊 인사이트 - 데이터 분석\n` +
      `• 🛠️ 유틸리티 - TTS 등 편의 기능\n` +
      `• 🔔 리마인더 - 알림 설정\n` +
      `• 🕐 근무시간 - 출퇴근 관리\n\n` +
      `문제가 있으면 /start로 다시 시작하세요! 🚀`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await this.bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.warn("메시지 수정 실패, 새 메시지 전송");
      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async handleCancel(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userName = callbackQuery.from.first_name || "사용자";

    await this.bot.sendMessage(
      chatId,
      `❌ ${userName}님, 작업이 취소되었습니다.`
    );
    await this.showMainMenu(callbackQuery);
  }

  // ========== ❌ 에러 처리 ==========

  async handleUnknownCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    Logger.warn(`처리할 수 없는 콜백: ${data}`);

    // 기본 응답 제공
    let response = "❓ 알 수 없는 요청입니다.";

    if (data.startsWith("timer")) {
      response = "⏰ **타이머 기능**\n\n타이머 기능은 준비 중입니다! 🚧";
    } else if (data.startsWith("weather")) {
      response = "🌤️ **날씨 기능**\n\n날씨 기능은 준비 중입니다! 🚧";
    } else if (data.startsWith("insight")) {
      response = "📊 **인사이트 기능**\n\n인사이트 기능은 준비 중입니다! 🚧";
    }

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await this.bot.editMessageText(response, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, response, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async sendErrorMessage(chatId) {
    const errorText =
      "❌ 처리 중 오류가 발생했습니다.\n\n/start를 입력해서 다시 시작해주세요.";

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await this.bot.sendMessage(chatId, errorText, { reply_markup: keyboard });
    } catch (error) {
      Logger.error("에러 메시지 전송 실패:", error);
    }
  }
}

module.exports = CallbackManager;
