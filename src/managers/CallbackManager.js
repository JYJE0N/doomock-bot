// src/managers/CallbackManager.js - 완전 수정 버전

const Logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.menuManager = null; // MenuManager 참조

    // 🔧 핵심 수정: routes Map 초기화
    this.routes = new Map();
    this.initializeRoutes();

    // 🚨 디버그: 전달받은 모듈들 확인
    console.log("🔍 CallbackManager 생성");
    console.log("📦 전달받은 모듈들:", Object.keys(this.modules));
    console.log(
      "📊 모듈별 상태:",
      Object.entries(this.modules).map(([key, module]) => ({
        key,
        exists: !!module,
        hasHandleCallback:
          module && typeof module.handleCallback === "function",
        className: module?.constructor?.name,
      }))
    );
    console.log("🗺️ 초기화된 라우트 수:", this.routes.size);

    Logger.info(
      `📞 CallbackManager 초기화됨. 모듈 수: ${Object.keys(this.modules).length}, 라우트 수: ${this.routes.size}`
    );
  }

  // MenuManager 설정 메서드
  setMenuManager(menuManager) {
    this.menuManager = menuManager;
    Logger.info("📞 CallbackManager에 MenuManager 연결됨");
  }

  // 🔧 라우트 초기화 (핵심!)
  initializeRoutes() {
    console.log("🚀 라우트 초기화 시작");

    // 시스템 메뉴
    this.routes.set("main_menu", { module: "system", method: "showMainMenu" });
    this.routes.set("help_menu", { module: "system", method: "showHelpMenu" });
    this.routes.set("cancel_action", {
      module: "system",
      method: "handleCancel",
    });

    // 할일 관리
    this.routes.set("todo_menu", { module: "todo", method: "showMenu" });
    this.routes.set("todo_list", { module: "todo", method: "showList" });
    this.routes.set("todo_add", { module: "todo", method: "startAdd" });
    this.routes.set("todo_stats", { module: "todo", method: "showStats" });

    // 휴가 관리
    this.routes.set("leave_menu", { module: "leave", method: "showMenu" });
    this.routes.set("leave_status", { module: "leave", method: "showStatus" });
    this.routes.set("leave_use", { module: "leave", method: "showUseMenu" });

    // 운세 관리
    this.routes.set("fortune_menu", { module: "fortune", method: "showMenu" });
    this.routes.set("fortune_today", {
      module: "fortune",
      method: "showToday",
    });
    this.routes.set("fortune_work", { module: "fortune", method: "showWork" });
    this.routes.set("fortune_tarot", {
      module: "fortune",
      method: "showTarot",
    });

    // 타이머 관리
    this.routes.set("timer_menu", { module: "timer", method: "showMenu" });
    this.routes.set("timer_start", { module: "timer", method: "startTimer" });
    this.routes.set("timer_stop", { module: "timer", method: "stopTimer" });

    // 🌤️ 날씨 관리 (핵심!)
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

    // 리마인더 관리
    this.routes.set("reminder_menu", {
      module: "reminder",
      method: "showMenu",
    });
    this.routes.set("remind_minutes", {
      module: "reminder",
      method: "showMinutes",
    });

    // 근무시간 관리
    this.routes.set("worktime_menu", {
      module: "worktime",
      method: "showMenu",
    });

    console.log("✅ 라우트 초기화 완료:", this.routes.size);

    // 디버그: 등록된 라우트들 출력
    console.log("📋 등록된 라우트들:");
    for (const [key, route] of this.routes.entries()) {
      console.log(`  ${key} → ${route.module}.${route.method}`);
    }
  }

  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    console.log("📞 콜백 처리 시작:", data);

    try {
      // 콜백 응답
      await this.bot.answerCallbackQuery(callbackQuery.id);
      console.log("✅ 콜백 쿼리 응답 완료");
    } catch (error) {
      console.log("⚠️ 콜백 쿼리 응답 실패 (이미 응답됨):", error.message);
    }

    try {
      // 1️⃣ 시스템 콜백 우선 처리
      if (await this.handleSystemCallback(callbackQuery)) {
        console.log("✅ 시스템 콜백 처리 완료");
        return true;
      }

      // 2️⃣ 동적 콜백 처리 (weather_인천 등)
      if (data.includes("_")) {
        const handled = await this.handleDynamicCallback(callbackQuery);
        if (handled) {
          console.log("✅ 동적 콜백 처리 완료");
          return true;
        }
      }

      // 3️⃣ 라우팅된 콜백 처리
      console.log("🗺️ 라우트 검색:", data);
      const route = this.routes.get(data);

      if (route) {
        console.log("🎯 라우트 발견:", route);
        await this.executeRoute(route, callbackQuery);
        console.log("✅ 라우트 실행 완료");
        return true;
      } else {
        console.warn("❌ 라우트를 찾을 수 없음:", data);
        console.log("📋 사용 가능한 라우트들:", Array.from(this.routes.keys()));
        await this.handleUnknownCallback(callbackQuery);
        return false;
      }
    } catch (error) {
      console.error("❌ 콜백 처리 실패:", error);
      console.error("📊 에러 상세:", {
        message: error.message,
        stack: error.stack?.split("\n")[0], // 첫 번째 스택만
        data,
        userId: callbackQuery.from.id,
      });
      await this.sendErrorMessage(callbackQuery.message.chat.id);
      return false;
    }
  }

  // 🔧 시스템 콜백 처리
  async handleSystemCallback(callbackQuery) {
    const data = callbackQuery.data;

    switch (data) {
      case "main_menu":
        await this.showMainMenu(callbackQuery);
        return true;

      case "help":
      case "help_menu":
        await this.showHelpMenu(callbackQuery);
        return true;

      case "noop":
        return true;

      case "cancel":
      case "cancel_action":
        await this.handleCancel(callbackQuery);
        return true;

      default:
        return false;
    }
  }

  // 🔧 날씨 동적 콜백 처리
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

    // weather_인천, weather_광주 등 동적 도시 처리 (한국어 도시명 포함)
    if (data.startsWith("weather_") && !this.routes.has(data)) {
      if (this.modules.weather) {
        // 'weather_' 접두사 제거하여 도시명 추출
        const city = data.replace("weather_", "");

        // WeatherModule의 showCurrentWeather 직접 호출
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

  // 🔧 라우트 실행
  async executeRoute(route, callbackQuery) {
    const { module: moduleName, method: methodName } = route;
    console.log(`🚀 라우트 실행: ${moduleName}.${methodName}`);

    // 시스템 모듈 처리
    if (moduleName === "system") {
      switch (methodName) {
        case "showMainMenu":
          await this.showMainMenu(callbackQuery);
          break;
        case "showHelpMenu":
          await this.showHelpMenu(callbackQuery);
          break;
        case "handleCancel":
          await this.handleCancel(callbackQuery);
          break;
      }
      return;
    }

    // 일반 모듈 처리
    const module = this.modules[moduleName];

    if (!module) {
      console.error(`❌ 모듈을 찾을 수 없음: ${moduleName}`);
      console.log("📋 사용 가능한 모듈들:", Object.keys(this.modules));
      await this.handleUnknownCallback(callbackQuery);
      return;
    }

    console.log(`✅ 모듈 발견: ${module.constructor.name}`);
    await this.handleModuleCallback(module, callbackQuery, methodName);
  }

  // 🔧 모듈 콜백 처리
  async handleModuleCallback(module, callbackQuery, methodName) {
    try {
      const data = callbackQuery.data;
      const parts = data.split("_");
      const action = parts[0]; // "weather"
      const subAction = parts.slice(1).join("_"); // "menu" 또는 "current"
      const params = parts.slice(2); // 추가 파라미터들

      console.log("🎯 모듈 콜백 처리:", {
        module: module.constructor.name,
        action,
        subAction,
        params,
        hasHandleCallback: typeof module.handleCallback === "function",
      });

      // 새로운 handleCallback 방식 (권장)
      if (typeof module.handleCallback === "function") {
        console.log("🆕 새로운 handleCallback 방식 사용");

        const result = await module.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params
        );

        console.log("✅ handleCallback 실행 완료:", result);
        return result;
      }

      // 구식 메서드 방식 (하위 호환성)
      if (typeof module[methodName] === "function") {
        console.log("🔄 구식 메서드 방식 사용:", methodName);

        const result = await module[methodName](this.bot, callbackQuery);
        console.log("✅ 구식 메서드 실행 완료:", result);
        return result;
      }

      console.warn(
        `❌ 모듈 ${module.constructor.name}에 ${methodName} 메서드가 없음`
      );
      await this.handleUnknownCallback(callbackQuery);
    } catch (error) {
      console.error(`❌ 모듈 콜백 처리 실패:`, error);
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
      console.error("메인 메뉴 표시 실패:", error);
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
      `**🌤️ 날씨**\n` +
      `• /weather - 현재 날씨\n` +
      `• /forecast - 날씨 예보\n\n` +
      `**🔮 운세**\n` +
      `• /fortune - 오늘의 운세\n\n` +
      `**🛠️ 기타 명령어**\n` +
      `• /start - 메인 메뉴\n` +
      `• /help - 도움말`;

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
      console.error("도움말 표시 실패:", error);
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
    const data = callbackQuery.data;
    console.warn("❓ 알 수 없는 콜백:", data);

    await this.bot.editMessageText(
      `❓ 알 수 없는 요청입니다: ${data}\n\n메인 메뉴로 돌아갑니다.`,
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
      console.error("오류 메시지 전송 실패:", error);
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
