// src/managers/CallbackManager.js - 완전한 라우팅 시스템 (참고용)

const logger = require("../utils/Logger");

class CallbackManager {
  constructor(bot, modules) {
    this.bot = bot;
    this.modules = modules || {};
    this.routes = new Map();

    this.initializeRoutes();

    logger.info(
      `📞 CallbackManager 초기화됨. 모듈 수: ${
        Object.keys(this.modules).length
      }`
    );
    logger.info(`📋 등록된 라우팅 수: ${this.routes.size}개`);
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

    logger.info(`✅ 모든 라우팅 등록 완료: ${this.routes.size}개`);
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

    logger.debug(`🏠 시스템 라우팅 ${systemRoutes.length}개 등록`);
  }

  // 📝 할일 관리 라우팅 - 완전한 버전
  addTodoRoutes() {
    const todoActions = [
      "menu", // 할일 메인 메뉴
      "list", // 할일 목록
      "add", // 할일 추가
      "stats", // 할일 통계
      "clear", // 할일 삭제 메뉴
      "clear_completed", // 완료된 할일 삭제
      "clear_all", // 모든 할일 삭제
      "clear_all_confirm", // ⭐ 누락된 확인 콜백 추가!
      "help", // 할일 도움말
    ];

    todoActions.forEach((action) => {
      this.routes.set(`todo_${action}`, { module: "todo", method: action });
    });

    logger.debug(`📝 할일 라우팅 ${todoActions.length}개 등록`);
  }

  // 🔮 운세 라우팅
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

    logger.debug(`🔮 운세 라우팅 ${fortuneActions.length}개 등록`);
  }

  // 🌤️ 날씨 라우팅
  addWeatherRoutes() {
    const weatherActions = [
      "menu", // 날씨 메인 메뉴
      "current", // 현재 날씨
      "forecast", // 날씨 예보
      "seoul", // 서울 날씨
      "busan", // 부산 날씨
      "more_cities", // 더 많은 도시
      "help", // 날씨 도움말
    ];

    weatherActions.forEach((action) => {
      this.routes.set(`weather_${action}`, {
        module: "weather",
        method: action,
      });
    });

    logger.debug(`🌤️ 날씨 라우팅 ${weatherActions.length}개 등록`);
  }

  // ⏰ 타이머 라우팅
  addTimerRoutes() {
    const timerActions = [
      "menu", // 타이머 메인 메뉴
      "start_prompt", // 타이머 시작 입력
      "pomodoro_start", // 포모도로 시작
      "stop", // 타이머 정지
      "status", // 타이머 상태
      "help", // 타이머 도움말
    ];

    timerActions.forEach((action) => {
      this.routes.set(`timer_${action}`, {
        module: "timer",
        method: action,
      });
    });

    logger.debug(`⏰ 타이머 라우팅 ${timerActions.length}개 등록`);
  }

  // 📅 휴가 관리 라우팅
  addLeaveRoutes() {
    const leaveActions = [
      "menu", // 휴가 메인 메뉴
      "request", // 휴가 신청
      "status", // 휴가 상태
      "history", // 휴가 히스토리
      "help", // 휴가 도움말
    ];

    leaveActions.forEach((action) => {
      this.routes.set(`leave_${action}`, {
        module: "leave",
        method: action,
      });
    });

    logger.debug(`📅 휴가 라우팅 ${leaveActions.length}개 등록`);
  }

  // 📊 인사이트 라우팅
  addInsightRoutes() {
    const insightActions = [
      "menu", // 인사이트 메인 메뉴
      "full", // 전체 인사이트
      "quick", // 빠른 인사이트
      "help", // 인사이트 도움말
    ];

    insightActions.forEach((action) => {
      this.routes.set(`insight_${action}`, {
        module: "insight",
        method: action,
      });
    });

    logger.debug(`📊 인사이트 라우팅 ${insightActions.length}개 등록`);
  }

  // 🛠️ 유틸리티 라우팅
  addUtilsRoutes() {
    const utilsActions = [
      "menu", // 유틸리티 메인 메뉴
      "tts", // 텍스트 음성 변환
      "tools", // 도구 메뉴
      "help", // 유틸리티 도움말
    ];

    utilsActions.forEach((action) => {
      this.routes.set(`utils_${action}`, {
        module: "utils",
        method: action,
      });
    });

    logger.debug(`🛠️ 유틸리티 라우팅 ${utilsActions.length}개 등록`);
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

    logger.debug(`🔔 리마인더 라우팅 ${reminderActions.length + 3}개 등록`);
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

    logger.debug(`🕐 근무시간 라우팅 ${worktimeActions.length}개 등록`);
  }

  // 📞 콜백 처리 (현재는 ModuleManager가 직접 처리하므로 참고용)
  async handleCallback(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    logger.info(`📞 콜백 수신: ${data}`);

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("콜백 응답 실패:", error);
    }

    try {
      const route = this.routes.get(data);

      if (route) {
        logger.info(
          `✅ 라우팅 발견: ${data} → ${route.module}.${route.method}`
        );
        await this.executeRoute(route, callbackQuery);
      } else {
        logger.warn(`❌ 라우팅 없음: ${data}`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      logger.error("콜백 처리 오류:", error);
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
      logger.error(`❌ 모듈 없음: ${moduleName}`);
      return await this.handleUnknownCallback(callbackQuery);
    }

    // ⭐ 표준화된 방식으로 모듈의 handleCallback 호출
    const [prefix, ...parts] = callbackQuery.data.split("_");
    const subAction = parts.join("_");
    const params = {};
    const menuManager = this;

    try {
      if (typeof module.handleCallback === "function") {
        await module.handleCallback(
          this.bot,
          callbackQuery,
          subAction,
          params,
          menuManager
        );
      } else {
        logger.error(`❌ 모듈 ${moduleName}에 handleCallback 메서드 없음`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      logger.error(`❌ 모듈 ${moduleName} 실행 오류:`, error);
      await this.sendErrorMessage(callbackQuery.message.chat.id);
    }
  }

  async handleSystemCallback(callbackQuery, methodName) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    switch (methodName) {
      case "showMainMenu":
        // 메인 메뉴 표시 로직
        await this.bot.editMessageText(
          "🏠 **메인 메뉴**\n\n원하는 기능을 선택해주세요:",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📝 할일 관리", callback_data: "todo_menu" },
                  { text: "🔮 운세", callback_data: "fortune_menu" },
                ],
                [
                  { text: "⏰ 타이머", callback_data: "timer_menu" },
                  { text: "🌤️ 날씨", callback_data: "weather_menu" },
                ],
              ],
            },
          }
        );
        return true;

      case "showHelpMenu":
        // 도움말 표시 로직
        await this.bot.editMessageText(
          "❓ **도움말**\n\n각 기능별 사용법을 확인하세요!",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
              ],
            },
          }
        );
        return true;

      case "handleCancel":
        // 취소 처리 로직
        await this.bot.editMessageText(
          "❌ **취소됨**\n\n작업이 취소되었습니다.",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
              ],
            },
          }
        );
        return true;

      default:
        return false;
    }
  }

  async handleUnknownCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    try {
      await this.bot.editMessageText(
        "❌ **알 수 없는 요청**\n\n처리할 수 없는 요청입니다.",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error("알 수 없는 콜백 처리 실패:", error);
    }
  }

  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }
}

module.exports = CallbackManager;
