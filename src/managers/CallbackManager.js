// src/managers/CallbackManager.js - 구조적 명시적 라우팅

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

  // 📝 할일 관리 라우팅 (심플한 구조)
  addTodoRoutes() {
    const todoActions = [
      "menu", // 할일 메인 메뉴
      "list", // 할일 목록
      "add", // 할일 추가
      "stats", // 할일 통계
      "clear", // 할일 삭제 메뉴
      "clear_completed", // 완료된 할일 삭제
      "clear_all", // 모든 할일 삭제
      "help", // 할일 도움말
    ];

    todoActions.forEach((action) => {
      this.routes.set(`todo_${action}`, { module: "todo", method: action });
    });

    Logger.debug(`📝 할일 라우팅 ${todoActions.length}개 등록`);
  }

  // 🔮 운세 라우팅 (복잡한 구조)
  addFortuneRoutes() {
    const fortuneActions = [
      "menu", // 운세 메인 메뉴
      "general", // 종합 운세
      "today", // 오늘의 운세
      "work", // 업무운
      "love", // 연애운
      "money", // 재물운
      "health", // 건강운
      "tarot", // 타로카드 1장
      "tarot3", // 타로카드 3장 스프레드
      "lucky", // 행운 정보
      "meeting", // 회식운
      "all", // 종합 운세 정보
      "help", // 운세 도움말
    ];

    fortuneActions.forEach((action) => {
      this.routes.set(`fortune_${action}`, {
        module: "fortune",
        method: action,
      });
    });

    Logger.debug(`🔮 운세 라우팅 ${fortuneActions.length}개 등록`);
  }

  // 🌤️ 날씨 라우팅 (중간 복잡도)
  addWeatherRoutes() {
    const weatherActions = [
      "menu", // 날씨 메인 메뉴
      "current", // 현재 날씨
      "forecast", // 날씨 예보
      "seoul", // 서울 날씨
      "busan", // 부산 날씨
      "more_cities", // 더 많은 도시
      "quick", // 빠른 날씨
      "help", // 날씨 도움말
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
      "menu", // 타이머 메인 메뉴
      "start", // 타이머 시작
      "stop", // 타이머 정지
      "pause", // 타이머 일시정지
      "resume", // 타이머 재개
      "pomodoro_start", // 포모도로 시작
      "custom_start", // 커스텀 타이머 시작
      "status", // 타이머 상태
      "help", // 타이머 도움말
    ];

    timerActions.forEach((action) => {
      this.routes.set(`timer_${action}`, { module: "timer", method: action });
    });

    Logger.debug(`⏰ 타이머 라우팅 ${timerActions.length}개 등록`);
  }

  // 📅 휴가 관리 라우팅
  addLeaveRoutes() {
    const leaveActions = [
      "menu", // 휴가 메인 메뉴
      "status", // 휴가 현황
      "use", // 휴가 사용
      "history", // 휴가 히스토리
      "setting", // 휴가 설정
      "use_1", // 1일 휴가 사용
      "use_0.5", // 반차 사용
      "use_custom", // 커스텀 휴가 사용
      "help", // 휴가 도움말
    ];

    leaveActions.forEach((action) => {
      this.routes.set(`leave_${action}`, { module: "leave", method: action });
    });

    Logger.debug(`📅 휴가 라우팅 ${leaveActions.length}개 등록`);
  }

  // 📊 인사이트 라우팅
  addInsightRoutes() {
    const insightActions = [
      "menu", // 인사이트 메인 메뉴
      "dashboard", // 대시보드
      "national", // 전국 인사이트
      "refresh", // 데이터 새로고침
      "quick", // 빠른 인사이트
      "full", // 전체 인사이트
      "help", // 인사이트 도움말
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
    const utilsActions = [
      "menu", // 유틸리티 메인 메뉴
      "tts_menu", // TTS 메뉴
      "tts_help", // TTS 도움말
      "help", // 유틸리티 도움말
    ];

    utilsActions.forEach((action) => {
      this.routes.set(`utils_${action}`, { module: "utils", method: action });
    });

    Logger.debug(`🛠️ 유틸리티 라우팅 ${utilsActions.length}개 등록`);
  }

  // 🔔 리마인더 라우팅
  addReminderRoutes() {
    const reminderActions = [
      "menu", // 리마인더 메인 메뉴
      "minutes", // 분 단위 리마인더
      "time", // 시간 리마인더
      "help", // 리마인더 도움말
    ];

    reminderActions.forEach((action) => {
      this.routes.set(`reminder_${action}`, {
        module: "reminder",
        method: action,
      });
    });

    // 별칭 라우팅 (remind_로 시작하는 것들)
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
      "menu", // 근무시간 메인 메뉴
      "checkin", // 출근
      "checkout", // 퇴근
      "status", // 근무 상태
      "history", // 근무 히스토리
      "help", // 근무시간 도움말
    ];

    worktimeActions.forEach((action) => {
      this.routes.set(`worktime_${action}`, {
        module: "worktime",
        method: action,
      });
    });

    Logger.debug(`🕐 근무시간 라우팅 ${worktimeActions.length}개 등록`);
  }

  // 📞 콜백 처리
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
      Logger.info(`🔧 모듈 호출: ${moduleName}.handleCallback(${methodName})`);

      if (typeof module.handleCallback === "function") {
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
    const userName = callbackQuery.from.first_name || "사용자";

    const text = `🤖 두목봇 메인 메뉴\n\n안녕하세요 ${userName}님!\n\n원하는 기능을 선택해주세요:`;

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
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  async showHelpMenu(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const text =
      "❓ 두목봇 도움말\n\n🤖 주요 기능:\n- 📝 할일 관리\n- 📅 휴가 관리\n- 🔮 운세\n- ⏰ 타이머\n- 🌤️ 날씨\n- 📊 인사이트\n- 🛠️ 유틸리티\n- 🔔 리마인더\n- 🕐 근무시간\n\n🎯 /start로 메인 메뉴 이동";

    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, text, {
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

    const text = `❌ ${userName}님, 작업이 취소되었습니다.`;

    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, text, {
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

    const text = `❓ 알 수 없는 요청: ${data}\n\n메인 메뉴로 돌아가서 다른 기능을 선택해주세요.`;

    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
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
}

module.exports = CallbackManager;
