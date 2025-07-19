// src/managers/ModuleManager.js

class ModuleManager {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.modules = new Map();
    this.dbManager = options.dbManager;
    this.userStates = options.userStates || new Map();

    // ⭐ 중복 처리 방지를 위한 플래그
    this.processingCallbacks = new Set();
    this.callbackTimeout = 5000; // 5초 후 자동 해제
  }

  // ⭐ 콜백 처리 - 중복 방지 로직 추가
  async handleCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const callbackId = `${callbackQuery.from.id}_${data}_${Date.now()}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(data)) {
      Logger.warn(`중복 콜백 무시: ${data}`);
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "⏳ 처리 중입니다...",
          show_alert: false,
        });
      } catch (error) {
        Logger.debug("콜백 응답 실패 (이미 응답됨)");
      }
      return false;
    }

    // 처리 중 플래그 설정
    this.processingCallbacks.add(data);

    // 자동 해제 타이머 설정
    const timeoutId = setTimeout(() => {
      this.processingCallbacks.delete(data);
      Logger.debug(`콜백 처리 타임아웃 해제: ${data}`);
    }, this.callbackTimeout);

    try {
      // 콜백 쿼리 응답 (한 번만!)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
        Logger.debug(`콜백 응답 완료: ${data}`);
      } catch (error) {
        Logger.debug("콜백 쿼리 응답 실패 (이미 응답됨 또는 만료됨)");
      }

      Logger.info(`📞 콜백 처리 시작: ${data}`, {
        userId: callbackQuery.from.id,
      });

      // 시스템 콜백 우선 처리
      if (await this.handleSystemCallback(bot, callbackQuery)) {
        return true;
      }

      // 모듈에서 콜백 처리 시도
      const module = this.findModuleForCallback(data);
      if (module) {
        try {
          Logger.debug(`모듈 발견: ${module.constructor.name}`, {
            hasHandleCallback: typeof module.handleCallback === "function",
            data: data,
          });

          // 모듈에 handleCallback 메서드가 있는지 확인
          if (typeof module.handleCallback === "function") {
            // ⭐ 표준화된 매개변수 구조로 전달
            const [prefix, ...parts] = data.split("_");
            const subAction = parts.join("_");
            const params = {};
            const menuManager = this;

            Logger.debug(
              `콜백 파싱: ${data} → prefix: ${prefix}, subAction: ${subAction}`
            );

            const result = await module.handleCallback(
              bot,
              callbackQuery,
              subAction,
              params,
              menuManager
            );

            Logger.info(`✅ 콜백 ${data} 모듈에서 처리 완료`);
            return result;
          } else {
            Logger.warn(
              `모듈 ${module.constructor.name}에 handleCallback 메서드가 없음`
            );
            return await this.handleBasicModuleCallback(
              bot,
              callbackQuery,
              module,
              data
            );
          }
        } catch (error) {
          Logger.error(`콜백 ${data} 처리 실패:`, error);

          // 에러 발생시 기본 처리로 폴백
          try {
            return await this.handleBasicModuleCallback(
              bot,
              callbackQuery,
              module,
              data
            );
          } catch (fallbackError) {
            Logger.error("기본 처리도 실패:", fallbackError);
            await this.sendErrorMessage(
              bot,
              callbackQuery.message.chat.id,
              fallbackError
            );
            return false;
          }
        }
      }

      // 모듈을 찾을 수 없는 경우
      Logger.warn(`처리할 수 없는 콜백: ${data}`);
      return await this.handleUnknownCallback(bot, callbackQuery, data);
    } finally {
      // 처리 완료 후 플래그 해제
      clearTimeout(timeoutId);
      this.processingCallbacks.delete(data);
      Logger.debug(`콜백 처리 완료, 플래그 해제: ${data}`);
    }
  }

  // ⭐ 시스템 콜백 처리 개선
  async handleSystemCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userName = callbackQuery.from.first_name || "사용자";

    switch (data) {
      case "main_menu":
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `🤖 **두목봇 메인 메뉴**\n\n안녕하세요 ${userName}님!\n원하는 기능을 선택해주세요:`,
          {
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          }
        );
        return true;

      case "back":
      case "cancel":
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ **취소되었습니다**\n\n메인 메뉴로 돌아갑니다.",
          {
            parse_mode: "Markdown",
            reply_markup: this.createMainMenuKeyboard(),
          }
        );
        return true;

      default:
        return false;
    }
  }

  // ⭐ 모듈 찾기 로직 개선
  findModuleForCallback(callbackData) {
    try {
      // 정확한 매핑으로 먼저 확인
      const moduleMapping = {
        todo_menu: "TodoModule",
        fortune_menu: "FortuneModule",
        weather_menu: "WeatherModule",
        timer_menu: "TimerModule",
        leave_menu: "LeaveModule",
        worktime_menu: "WorktimeModule",
        insight_menu: "InsightModule",
        utils_menu: "UtilsModule",
        reminder_menu: "ReminderModule",
        // 추가 콜백들
        fortune_today: "FortuneModule",
        fortune_work: "FortuneModule",
        fortune_love: "FortuneModule",
        fortune_tarot: "FortuneModule",
        fortune_tarot_three: "FortuneModule",
        weather_current: "WeatherModule",
        weather_forecast: "WeatherModule",
        todo_add: "TodoModule",
        todo_list: "TodoModule",
        todo_stats: "TodoModule",
        todo_help: "TodoModule",
        todo_clear_completed: "TodoModule",
        todo_clear_all: "TodoModule",
        todo_clear_all_confirm: "TodoModule",
        timer_start: "TimerModule",
        timer_stop: "TimerModule",
      };

      // 정확한 매핑이 있는 경우
      if (moduleMapping[callbackData]) {
        const moduleName = moduleMapping[callbackData];
        const moduleData = this.modules.get(moduleName);
        if (moduleData && moduleData.status === "initialized") {
          Logger.debug(
            `콜백 ${callbackData}를 ${moduleName}에서 처리 (정확 매핑)`
          );
          return moduleData.instance;
        }
      }

      // 접두사 기반 매핑
      const prefix = callbackData.split("_")[0];
      const prefixMapping = {
        todo: "TodoModule",
        fortune: "FortuneModule",
        weather: "WeatherModule",
        timer: "TimerModule",
        leave: "LeaveModule",
        worktime: "WorktimeModule",
        insight: "InsightModule",
        utils: "UtilsModule",
        reminder: "ReminderModule",
      };

      if (prefixMapping[prefix]) {
        const moduleName = prefixMapping[prefix];
        const moduleData = this.modules.get(moduleName);
        if (moduleData && moduleData.status === "initialized") {
          Logger.debug(
            `콜백 ${callbackData}를 ${moduleName}에서 처리 (접두사 매핑)`
          );
          return moduleData.instance;
        }
      }

      // 기존 방식으로 폴백 (canHandleCallback 사용)
      for (const [moduleName, moduleData] of this.modules.entries()) {
        if (moduleData.status !== "initialized") {
          continue;
        }

        const instance = moduleData.instance;
        if (
          instance.canHandleCallback &&
          instance.canHandleCallback(callbackData)
        ) {
          Logger.debug(
            `콜백 ${callbackData}를 ${moduleName}에서 처리 (canHandleCallback)`
          );
          return instance;
        }
      }
    } catch (error) {
      Logger.error("findModuleForCallback 오류:", error);
    }
    return null;
  }

  // ⭐ 메시지 전송 헬퍼 메서드
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      Logger.error("메시지 수정 실패:", error.message);
      // 수정 실패시 새 메시지 전송
      try {
        await bot.sendMessage(chatId, text, options);
      } catch (sendError) {
        Logger.error("메시지 전송도 실패:", sendError.message);
      }
    }
  }

  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error("메시지 전송 실패:", error.message);
      throw error;
    }
  }

  async sendErrorMessage(bot, chatId, error = null) {
    const errorText =
      "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.";

    try {
      await bot.sendMessage(chatId, errorText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (sendError) {
      Logger.error("에러 메시지 전송 실패:", sendError.message);
    }
  }

  // 메인 메뉴 키보드 생성
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo_menu" },
          { text: "🔮 오늘의 운세", callback_data: "fortune_menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
          { text: "⏰ 타이머", callback_data: "timer_menu" },
        ],
        [
          { text: "🏖️ 휴가", callback_data: "leave_menu" },
          { text: "🕐 근무시간", callback_data: "worktime_menu" },
        ],
        [
          { text: "📊 인사이트", callback_data: "insight_menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
        ],
        [{ text: "🔔 리마인더", callback_data: "reminder_menu" }],
      ],
    };
  }
}

module.exports = ModuleManager;
