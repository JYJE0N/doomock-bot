// src/managers/CallbackManager.js - 3뎁스 라우팅 완전 지원

const Logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.menuManager = null;

    // 콜백 라우팅 맵
    this.routes = new Map();
    this.initializeRoutes();

    Logger.info(
      `📞 CallbackManager 초기화됨. 모듈 수: ${
        Object.keys(this.modules).length
      }`
    );
  }

  setMenuManager(menuManager) {
    this.menuManager = menuManager;
  }

  initializeRoutes() {
    // 메인 메뉴 (특별 처리)
    this.routes.set("main_menu", { module: "menu", method: "showMainMenu" });
    this.routes.set("help_menu", { module: "menu", method: "showHelpMenu" });
    this.routes.set("cancel_action", {
      module: "common",
      method: "handleCancel",
    });

    // 🚀 모든 모듈의 기본 CRUD 액션들 등록
    const moduleNames = [
      "todo",
      "leave",
      "fortune",
      "timer",
      "weather",
      "insight",
      "utils",
      "reminder",
      "worktime",
    ];
    const basicActions = [
      "menu",
      "list",
      "add",
      "setting",
      "stats",
      "clear",
      "help",
      "status",
    ];

    moduleNames.forEach((moduleName) => {
      basicActions.forEach((action) => {
        this.routes.set(`${moduleName}_${action}`, {
          module: moduleName,
          method: action,
        });
      });
    });

    // 🚀 할일 관리 전용 액션들
    this.routes.set("todo_clear_completed", {
      module: "todo",
      method: "clear_completed",
    });
    this.routes.set("todo_clear_all", { module: "todo", method: "clear_all" });

    // 🚀 운세 전용 액션들
    this.routes.set("fortune_general", {
      module: "fortune",
      method: "general",
    });
    this.routes.set("fortune_today", { module: "fortune", method: "today" });
    this.routes.set("fortune_work", { module: "fortune", method: "work" });
    this.routes.set("fortune_love", { module: "fortune", method: "love" });
    this.routes.set("fortune_money", { module: "fortune", method: "money" });
    this.routes.set("fortune_health", { module: "fortune", method: "health" });
    this.routes.set("fortune_tarot", { module: "fortune", method: "tarot" });
    this.routes.set("fortune_meeting", {
      module: "fortune",
      method: "meeting",
    });

    // 🚀 날씨 전용 액션들
    this.routes.set("weather_current", {
      module: "weather",
      method: "current",
    });
    this.routes.set("weather_forecast", {
      module: "weather",
      method: "forecast",
    });
    this.routes.set("weather_quick", { module: "weather", method: "quick" });

    // 🚀 타이머 전용 액션들
    this.routes.set("timer_start", { module: "timer", method: "start" });
    this.routes.set("timer_stop", { module: "timer", method: "stop" });
    this.routes.set("timer_pause", { module: "timer", method: "pause" });
    this.routes.set("timer_resume", { module: "timer", method: "resume" });

    // 🚀 인사이트 전용 액션들
    this.routes.set("insight_dashboard", {
      module: "insight",
      method: "dashboard",
    });
    this.routes.set("insight_national", {
      module: "insight",
      method: "national",
    });
    this.routes.set("insight_refresh", {
      module: "insight",
      method: "refresh",
    });
    this.routes.set("insight_quick", { module: "insight", method: "quick" });

    // 🚀 유틸리티 전용 액션들
    this.routes.set("utils_tts_menu", { module: "utils", method: "tts_menu" });
    this.routes.set("utils_tts_help", { module: "utils", method: "tts_help" });

    // 🚀 리마인더 전용 액션들
    this.routes.set("reminder_minutes", {
      module: "reminder",
      method: "minutes",
    });
    this.routes.set("remind_minutes", {
      module: "reminder",
      method: "minutes",
    });
    this.routes.set("remind_time", { module: "reminder", method: "time" });
    this.routes.set("remind_help", { module: "reminder", method: "help" });

    // 🚀 휴가 관리 전용 액션들
    this.routes.set("leave_status", { module: "leave", method: "status" });
    this.routes.set("leave_use", { module: "leave", method: "use" });
    this.routes.set("leave_history", { module: "leave", method: "history" });
    this.routes.set("use_leave_1", { module: "leave", method: "useOne" });
    this.routes.set("use_leave_0.5", { module: "leave", method: "useHalf" });
    this.routes.set("use_leave_custom", {
      module: "leave",
      method: "useCustom",
    });

    // 🚀 근무시간 전용 액션들
    this.routes.set("worktime_checkin", {
      module: "worktime",
      method: "checkin",
    });
    this.routes.set("worktime_checkout", {
      module: "worktime",
      method: "checkout",
    });

    Logger.info(`📋 총 ${this.routes.size}개 라우팅 규칙 등록됨`);
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
      // 동적 콜백 처리 (todo_toggle_1, weather_인천 등)
      if (data.includes("_")) {
        const handled = await this.handleDynamicCallback(callbackQuery);
        if (handled) {
          return;
        }
      }

      // 라우팅된 콜백 처리
      const route = this.routes.get(data);
      if (route) {
        Logger.info(
          `✅ 라우팅 규칙 발견: ${data} → ${route.module}.${route.method}`
        );
        await this.executeRoute(route, callbackQuery);
      } else {
        Logger.warn(`⚠️ 알 수 없는 콜백: ${data}`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      Logger.error("콜백 처리 오류:", error);
      await this.sendErrorMessage(chatId);
    }
  }

  // ⭐ 핵심 수정: BaseModule의 handleCallback 사용
  async executeRoute(route, callbackQuery) {
    const { module: moduleName, method: methodName } = route;

    // 특별 처리: menu와 common
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

    // ⭐ 일반 모듈 처리: BaseModule.handleCallback 사용
    const module = this.modules[moduleName];
    if (!module) {
      Logger.error(`❌ 모듈을 찾을 수 없음: ${moduleName}`);
      await this.handleUnknownCallback(callbackQuery);
      return;
    }

    try {
      // ✅ BaseModule의 handleCallback 메서드 호출
      if (module.handleCallback) {
        Logger.info(`🔧 ${moduleName}: handleCallback(${methodName}) 호출`);
        const success = await module.handleCallback(
          this.bot,
          callbackQuery,
          methodName,
          []
        );

        if (!success) {
          Logger.warn(`⚠️ ${moduleName}: ${methodName} 액션 처리 실패`);
        }
      } else {
        // ⭐ 대안: BaseModule의 액션 맵 직접 호출
        Logger.info(`🔧 ${moduleName}: ${methodName} 직접 호출`);

        if (module.actionMap && module.actionMap.has(methodName)) {
          const handler = module.actionMap.get(methodName);
          const {
            message: {
              chat: { id: chatId },
              message_id: messageId,
            },
            from: { id: userId },
          } = callbackQuery;
          const userName = callbackQuery.from.first_name || "사용자";

          await handler(this.bot, chatId, messageId, userId, userName, []);
        } else {
          throw new Error(`모듈 ${moduleName}에 ${methodName} 액션이 없습니다`);
        }
      }
    } catch (error) {
      Logger.error(`❌ 모듈 ${moduleName} 콜백 처리 실패:`, error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
    }
  }

  async handleDynamicCallback(callbackQuery) {
    const data = callbackQuery.data;

    // todo_toggle_1, todo_delete_1 형식 처리
    if (data.startsWith("todo_toggle_") || data.startsWith("todo_delete_")) {
      if (this.modules.todo) {
        const parts = data.split("_");
        const action = parts[1]; // toggle 또는 delete
        const index = parseInt(parts[2]);

        const {
          message: {
            chat: { id: chatId },
            message_id: messageId,
          },
          from: { id: userId },
        } = callbackQuery;

        if (action === "toggle") {
          await this.modules.todo.toggleTodo(
            this.bot,
            chatId,
            messageId,
            userId,
            index
          );
        } else if (action === "delete") {
          await this.modules.todo.deleteTodo(
            this.bot,
            chatId,
            messageId,
            userId,
            index
          );
        }
        return true;
      }
    }

    // TTS 콜백 처리
    if (data.startsWith("tts_")) {
      if (this.modules.utils) {
        await this.modules.utils.handleTTSCallback(this.bot, callbackQuery, []);
        return true;
      }
    }

    // weather_인천, weather_광주 등 동적 도시 처리
    if (data.startsWith("weather_") && !this.routes.has(data)) {
      if (this.modules.weather) {
        const city = data.replace("weather_", "");
        const {
          message: {
            chat: { id: chatId },
            message_id: messageId,
          },
        } = callbackQuery;
        await this.modules.weather.showCurrentWeather(
          this.bot,
          chatId,
          messageId,
          city
        );
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

  async showMainMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userName = callbackQuery.from.first_name || "사용자";

    const welcomeMessage =
      `🤖 두목봇 메인 메뉴\n\n` +
      `안녕하세요 ${userName}님! 👋\n\n` +
      `원하는 기능을 선택해주세요:`;

    const keyboard = await this.createMainMenuKeyboard();

    try {
      await this.bot.editMessageText(welcomeMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.warn("메시지 수정 실패, 새 메시지 전송:", error.message);
      await this.bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: keyboard,
      });
    }
  }

  async showHelpMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;

    const helpText = `❓ 두목봇 도움말\n\n🤖 주요 기능:\n- 📝 할일 관리 - 할일 추가/완료/삭제\n- 📅 휴가 관리 - 연차 사용/관리\n- 🔮 운세 - 다양한 운세 정보\n- ⏰ 타이머 - 작업 시간 관리\n- 🔔 리마인더 - 알림 설정\n- 🌤️ 날씨 - 날씨 정보\n- 📊 인사이트 - 마케팅 인사이트\n- 🛠️ 유틸리티 - TTS 등\n\n🎯 빠른 명령어:\n- /start - 메인 메뉴\n- /add [할일] - 할일 빠른 추가\n- /help - 도움말\n\n🚀 Railway 클라우드에서 24/7 운영 중!`;

    try {
      await this.bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      Logger.warn("도움말 메시지 수정 실패:", error.message);
      await this.bot.sendMessage(chatId, helpText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    }
  }

  async handleCancel(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userName = callbackQuery.from.first_name || "사용자";

    const message = `❌ ${userName}님, 작업이 취소되었습니다.`;

    try {
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    }
  }

  async handleUnknownCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // ⭐ 기본 모듈 메뉴 응답 (마크다운 제거)
    const moduleResponses = {
      todo_menu: {
        text: "📝 할일 관리\n\n할일을 효율적으로 관리해보세요!\n\n🚧 곧 더 많은 기능이 추가될 예정입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      fortune_menu: {
        text: "🔮 운세\n\n오늘의 운세를 확인해보세요!\n\n🚧 다양한 운세 기능을 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      timer_menu: {
        text: "⏰ 타이머\n\n작업 시간을 관리해보세요!\n\n🚧 포모도로 타이머를 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      weather_menu: {
        text: "🌤️ 날씨\n\n날씨 정보를 확인해보세요!\n\n🚧 실시간 날씨 서비스를 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      insight_menu: {
        text: "📊 인사이트\n\n마케팅 인사이트를 확인해보세요!\n\n🚧 데이터 분석 기능을 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      utils_menu: {
        text: "🛠️ 유틸리티\n\n편리한 도구들을 사용해보세요!\n\n🚧 TTS 및 다양한 유틸리티를 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      reminder_menu: {
        text: "🔔 리마인더\n\n알림을 설정해보세요!\n\n🚧 스마트 리마인더 기능을 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      leave_menu: {
        text: "📅 휴가 관리\n\n연차를 관리해보세요!\n\n🚧 휴가 계산 기능을 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
      worktime_menu: {
        text: "🕐 근무시간\n\n근무시간을 관리해보세요!\n\n🚧 출퇴근 기록 기능을 준비 중입니다.",
        buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
      },
    };

    const response = moduleResponses[data] || {
      text: `❓ 알 수 없는 요청\n\n"${data}" 기능을 찾을 수 없어요.\n\n메인 메뉴로 돌아가서 다른 기능을 이용해보세요! 😊`,
      buttons: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    try {
      await this.bot.editMessageText(response.text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: { inline_keyboard: response.buttons },
      });
    } catch (error) {
      Logger.warn("알 수 없는 콜백 응답 실패:", error.message);
      await this.bot.sendMessage(chatId, response.text, {
        reply_markup: { inline_keyboard: response.buttons },
      });
    }
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
      Logger.error("에러 메시지 전송 실패:", error);
    }
  }

  async createMainMenuKeyboard() {
    return {
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
  }
}

module.exports = CallbackManager;
