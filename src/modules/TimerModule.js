// src/modules/TimerModule.js - 🍅 최종 리팩토링 v5.0

const BaseModule = require("../core/BaseModule");
const { getUserId, getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");
const _TimeHelper = require("../utils/TimeHelper");

class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    const isDevelopment = process.env.NODE_ENV === "development";
    const isDevMode = process.env.TIMER_DEV_MODE === "true";

    this.devMode = {
      enabled: isDevelopment && isDevMode,
      showProgress: process.env.TIMER_DEV_PROGRESS === "true"
    };

    if (this.devMode.enabled) {
      logger.warn("⚡ 타이머 개발 모드 활성화!");
    }

    this.config = {
      focusDuration: this.parseDevDuration(
        process.env.TIMER_FOCUS_DURATION,
        25
      ),
      shortBreak: this.parseDevDuration(process.env.TIMER_SHORT_BREAK, 5),
      longBreak: this.parseDevDuration(process.env.TIMER_LONG_BREAK, 15),
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120,
      updateInterval: parseInt(process.env.TIMER_UPDATE_INTERVAL) || 1000,
      get pomodoro1() {
        return {
          focus: this.focusDuration,
          shortBreak: this.shortBreak,
          cycles: 4,
          longBreak: this.longBreak
        };
      },
      get pomodoro2() {
        return {
          focus: 50,
          shortBreak: 10,
          cycles: 2,
          longBreak: 30
        };
      },
      ...options.config
    };

    logger.info("⏱️ 실제 시간 설정:");
    logger.info(`   - 집중: ${this.config.focusDuration}분`);
    logger.info(`   - 짧은 휴식: ${this.config.shortBreak}분`);
    logger.info(`   - 긴 휴식: ${this.config.longBreak}분`);

    this.activeTimers = new Map();
    this.timerIntervals = new Map();
    this.timerService = null;
    this.reminderService = null;
  }

  async initialize(bot, moduleManager) {
    super.initialize(bot, moduleManager);
    this.timerService = await this.services.get("timer");
    this.reminderService = await this.services.get("reminder");
    if (this.reminderService) {
      logger.info("✅ ReminderService (알림) 연결됨");
    }
    return true;
  }

  // ===== 🚀 핵심 로직 (리팩토링) =====

  /**
   * 🎛️ 모든 타이머 시작의 관문 (리팩토링)
   */
  async start(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    let timerType = params;
    let duration;

    // 1. 커스텀 타이머 파라미터 파싱
    if (params && params.startsWith("custom:")) {
      const parts = params.split(":");
      timerType = parts[0]; // "custom"
      duration = parseInt(parts[1], 10);

      if (
        isNaN(duration) ||
        duration <= 0 ||
        duration > this.config.maxCustomDuration
      ) {
        return {
          type: "error",
          data: {
            message: `1분에서 ${this.config.maxCustomDuration}분 사이의 시간을 입력해주세요.`
          }
        };
      }
    } else {
      duration = this.getDurationByType(timerType);
    }

    if (!duration) {
      return { type: "error", data: { message: "잘못된 타이머 타입입니다." } };
    }

    // 2. _startNewTimer 호출
    return this._startNewTimer(
      userId,
      userName,
      timerType,
      duration,
      callbackQuery
    );
  }

  /**
   * 🍅 뽀모도로 프리셋 시작 (리팩토링)
   */
  async startPomodoro(bot, callbackQuery, presetKey) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const preset = this.config[presetKey];

    const pomodoroInfo = {
      isPomodoro: true,
      currentCycle: 1,
      totalCycles: preset.cycles,
      preset: presetKey
    };

    return this._startNewTimer(
      userId,
      userName,
      "focus",
      preset.focus,
      callbackQuery,
      pomodoroInfo
    );
  }

  /**
   * 🌟 모든 타이머를 생성하는 단일 메서드 (리팩토링)
   */
  async _startNewTimer(
    userId,
    userName,
    type,
    actualDuration,
    callbackQuery,
    pomodoroInfo = {}
  ) {
    if (this.activeTimers.has(userId)) {
      return {
        type: "error",
        data: { message: "⚠️ 이미 실행 중인 타이머가 있습니다!" }
      };
    }

    const dbDuration =
      this.devMode.enabled && actualDuration < 1 ? 1 : actualDuration;
    if (this.devMode.enabled && actualDuration < 1) {
      logger.info(
        `🔧 개발 모드: ${actualDuration}분 타이머 -> DB에는 ${dbDuration}분으로 저장`
      );
    }

    const sessionData = {
      type,
      duration: dbDuration,
      userName,
      pomodoro: pomodoroInfo
    };
    const result = await this.timerService.startSession(userId, sessionData);

    if (!result.success) {
      return { type: "error", data: { message: result.message } };
    }

    const session = result.data;
    const timer = this.createTimer(
      session._id,
      type,
      actualDuration,
      userId,
      callbackQuery,
      pomodoroInfo
    );

    this.activeTimers.set(userId, timer);
    this.startTimerInterval(userId);

    logger.info(`▶️ 세션 시작: ${userId} - ${type} (${actualDuration}분)`);

    return {
      type: pomodoroInfo.isPomodoro ? "pomodoro_started" : "timer_started",
      data: { timer: this.generateTimerData(timer) }
    };
  }

  /**
   * ✅ 타이머 완료 처리 (리팩토링)
   */
  async completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    this.cleanupUserTimer(userId);
    const result = await this.timerService.completeSession(userId);
    if (!result.success) {
      logger.warn(
        `세션 완료 처리 건너뛰기: ${userId}의 DB 세션이 이미 완료/정리됨.`
      );
      return;
    }
    logger.info(`✅ 세션 완료: ${userId}`);

    if (timer.isPomodoro) {
      await this.transitionToNextPomodoro(userId, timer);
    } else {
      await this.notifyCompletion(timer);
    }
  }

  /**
   * 🔄 뽀모도로 다음 단계로 전환 (리팩토링)
   */
  async transitionToNextPomodoro(userId, completedTimer) {
    const preset = this.config[completedTimer.preset];
    const isLastFocus =
      completedTimer.currentCycle >= completedTimer.totalCycles;

    let nextType, nextDuration;
    const nextCycle =
      completedTimer.type === "focus"
        ? completedTimer.currentCycle
        : completedTimer.currentCycle + 1;

    if (completedTimer.type === "focus") {
      nextType = isLastFocus ? "longBreak" : "shortBreak";
      nextDuration = isLastFocus ? preset.longBreak : preset.shortBreak;
    } else {
      if (isLastFocus) {
        // 긴 휴식 또는 마지막 짧은 휴식 후 종료
        await this.notifyPomodoroSetCompletion(completedTimer);
        return;
      }
      nextType = "focus";
      nextDuration = preset.focus;
    }

    const userName = getUserName({ id: userId, first_name: "Pomodoro" });
    const pomodoroInfo = { ...completedTimer, currentCycle: nextCycle };

    // 새 타이머 시작
    await this._startNewTimer(
      userId,
      userName,
      nextType,
      nextDuration,
      {
        message: {
          chat: { id: completedTimer.chatId },
          message_id: completedTimer.messageId
        }
      },
      pomodoroInfo
    );

    // 알림은 새 타이머 정보를 가져와서 전송
    const newTimer = this.activeTimers.get(userId);
    if (newTimer) {
      await this.notifyTransition(newTimer);
    }
  }

  // ===== 헬퍼 및 알림 메서드 (리팩토링) =====

  /**
   * 🔔 일반 타이머 완료 알림 (리팩토링)
   */
  async notifyCompletion(timer) {
    try {
      const text = `🎉 *타이머 완료!*\n\n*${this.getTypeDisplay(timer.type)}*(${timer.duration}분) 타이머가 종료되었습니다. 수고하셨습니다!`;
      const keyboard = this.createInlineKeyboard([
        [{ text: "🍅 뽀모도로 시작", action: "pomodoro1" }],
        [{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]
      ]);
      await this.bot.telegram.editMessageText(
        timer.chatId,
        timer.messageId,
        null,
        text,
        { reply_markup: keyboard, parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error("완료 알림 실패:", error.message);
    }
  }

  /**
   * 🔔 뽀모도로 전환 알림 (리팩토링)
   */
  async notifyTransition(timer) {
    try {
      const result = {
        type: "timer_status",
        data: { timer: this.generateTimerData(timer), isRefresh: true }
      };
      const renderer =
        this.moduleManager.navigationHandler.renderers.get("timer");
      const ctx = {
        from: { id: timer.userId },
        chat: { id: timer.chatId },
        callbackQuery: { message: { message_id: timer.messageId } }
      };
      await renderer.render(result, ctx);
    } catch (error) {
      logger.error("뽀모도로 전환 알림 실패:", error.message);
    }
  }

  /**
   * 🎉 뽀모도로 세트 완료 알림 (리팩토링)
   */
  async notifyPomodoroSetCompletion(timer) {
    try {
      const result = {
        type: "pomodoro_set_completed",
        data: {
          userName: getUserName({ id: timer.userId }),
          totalCycles: timer.totalCycles,
          preset: timer.preset
        }
      };
      const renderer =
        this.moduleManager.navigationHandler.renderers.get("timer");
      const ctx = {
        from: { id: timer.userId },
        chat: { id: timer.chatId },
        callbackQuery: { message: { message_id: timer.messageId } }
      };
      await renderer.render(result, ctx);
    } catch (error) {
      logger.error("뽀모도로 세트 완료 알림 실패:", error.message);
    }
  }

  // ===== 기존 코드 (일부 수정) =====

  // (menu, pauseTimer, resumeTimer, stopTimer, refresh, showCustomSetup 등 기존 핸들러 메서드들은 그대로 유지)
  // ...
  // pomodoro1, pomodoro2 핸들러 수정
  async pomodoro1(bot, callbackQuery) {
    return this.startPomodoro(bot, callbackQuery, "pomodoro1");
  }

  async pomodoro2(bot, callbackQuery) {
    return this.startPomodoro(bot, callbackQuery, "pomodoro2");
  }

  // getDurationByType 수정
  getDurationByType(type) {
    if (!type) return null;
    switch (type) {
      case "focus":
        return this.config.focusDuration;
      case "shortBreak":
        return this.config.shortBreak;
      case "longBreak":
        return this.config.longBreak;
      default:
        return null;
    }
  }

  // ===== 헬퍼 메서드들 =====

  createTimer(sessionId, type, duration, userId, callbackQuery, pomodoroInfo) {
    return {
      sessionId,
      type,
      duration,
      userId,
      startTime: Date.now(),
      status: "running",
      pausedAt: null,
      totalPausedDuration: 0,
      chatId: callbackQuery.message.chat.id,
      messageId: callbackQuery.message.message_id,
      ...pomodoroInfo
    };
  }

  generateTimerData(timer) {
    const elapsed = this.calculateElapsedTime(timer);
    const remaining = Math.max(0, timer.duration * 60 * 1000 - elapsed);
    const progress = Math.min(
      100,
      Math.round((elapsed / (timer.duration * 60 * 1000)) * 100)
    );

    return {
      ...timer,
      typeDisplay: this.getTypeDisplay(timer.type),
      statusDisplay: this.getStatusDisplay(timer.status),
      isPaused: timer.status === "paused",
      progress,
      elapsed,
      elapsedFormatted: this.formatTime(Math.floor(elapsed / 1000)),
      remaining,
      remainingFormatted: this.formatTime(Math.floor(remaining / 1000))
    };
  }

  calculateElapsedTime(timer) {
    if (timer.status === "paused") {
      return timer.pausedAt - timer.startTime - timer.totalPausedDuration; // 🚀 totalPausedTime -> totalPausedDuration
    }
    return Date.now() - timer.startTime - timer.totalPausedDuration; // 🚀 totalPausedTime -> totalPausedDuration
  }

  formatTime(seconds) {
    if (this.devMode.enabled && seconds < 60) {
      return `${seconds}초`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  getTypeDisplay(type) {
    const displays = {
      focus: "집중",
      shortBreak: "짧은 휴식",
      longBreak: "긴 휴식",
      custom: "커스텀"
    };
    return displays[type] || type;
  }

  getStatusDisplay(status) {
    const displays = {
      running: "실행 중",
      paused: "일시정지",
      stopped: "중지됨",
      completed: "완료됨"
    };
    return displays[status] || status;
  }

  calculateBadge(totalSessions) {
    for (const [_key, badge] of Object.entries(
      this.constants.BADGES
    ).reverse()) {
      if (totalSessions >= badge.threshold) {
        return badge;
      }
    }
    return null;
  }

  getDefaultStats() {
    return {
      totalSessions: 0,
      totalFocusTime: 0,
      totalBreakTime: 0,
      completionRate: 0,
      dailyActivity: [
        { name: "월", sessions: 0 },
        { name: "화", sessions: 0 },
        { name: "수", sessions: 0 },
        { name: "목", sessions: 0 },
        { name: "금", sessions: 0 },
        { name: "토", sessions: 0 },
        { name: "일", sessions: 0 }
      ]
    };
  }

  async cleanup() {
    try {
      for (const userId of this.activeTimers.keys()) {
        this.clearTimerInterval(userId);
      }
      this.activeTimers.clear();
      this.timerIntervals.clear();
      logger.info("🧹 TimerModule 정리 완료");
    } catch (error) {
      logger.error("TimerModule 정리 중 오류:", error);
    }
  }
}

module.exports = TimerModule;
