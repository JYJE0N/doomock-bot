// src/modules/TimerModule.js - 🍅 최종 리팩토링 v5.0

const BaseModule = require("../core/BaseModule");
const { getUserId, getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");
const _TimeHelper = require("../utils/TimeHelper");

class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);
    this.serviceBuilder = options.serviceBuilder || null;

    this.timerService = null;
    this.activeTimers = new Map();
    this.timerIntervals = new Map();
  }

  /**
   * 🚀 모듈 초기화
   */
  async onInitialize() {
    try {
      this.timerService = await this.serviceBuilder.getOrCreate("timer");
      if (!this.timerService) {
        throw new Error("TimerService를 찾을 수 없습니다.");
      }
      this.setupConfig();
      this.setupActions(); // 액션 등록
      logger.success("🍅 TimerModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ⚙️ 설정 초기화
   */
  setupConfig() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const isDevMode = process.env.TIMER_DEV_MODE === "true";

    this.devMode = {
      enabled: isDevelopment && isDevMode,
      showProgress: process.env.TIMER_DEV_PROGRESS === "true"
    };

    if (this.devMode.enabled) logger.warn("⚡ 타이머 개발 모드 활성화!");

    this.config = {
      focusDuration: this.parseDevDuration(
        process.env.TIMER_FOCUS_DURATION,
        25
      ),
      shortBreak: this.parseDevDuration(process.env.TIMER_SHORT_BREAK, 5),
      longBreak: this.parseDevDuration(process.env.TIMER_LONG_BREAK, 15),
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
        return { focus: 50, shortBreak: 10, cycles: 2, longBreak: 30 };
      }
    };

    logger.info("⏱️ 타이머 시간 설정 (분):", {
      focus: this.config.focusDuration,
      short: this.config.shortBreak,
      long: this.config.longBreak
    });
  }

  /**
   * 🕹️ 액션 매핑 설정
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      start: this.start,
      custom: this.showCustomSetup,
      pomodoro1: (bot, ctx) => this.startPomodoro(bot, ctx, "pomodoro1"),
      pomodoro2: (bot, ctx) => this.startPomodoro(bot, ctx, "pomodoro2"),
      pause: this.pauseTimer,
      resume: this.resumeTimer,
      stop: this.stopTimer,
      refresh: this.refresh
    });
  }

  // ===== 🚀 핵심 핸들러 메서드 🚀 =====

  async showMenu(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (timer) return this.refresh(bot, callbackQuery);
    return {
      type: "menu",
      data: { userName: getUserName(callbackQuery.from) }
    };
  }

  /**
   * 🎛️ 모든 타이머 시작의 관문 (리팩토링)
   */
  async start(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    let timerType = params,
      duration;

    if (params?.startsWith("custom:")) {
      [, duration] = params.split(":");
      timerType = "custom";
      duration = parseInt(duration, 10);
      if (isNaN(duration) || duration <= 0)
        return {
          type: "error",
          data: { message: "올바른 시간을 입력해주세요." }
        };
    } else {
      duration = this.getDurationByType(timerType);
    }

    if (!duration)
      return { type: "error", data: { message: "잘못된 타이머 타입입니다." } };
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
  // ===== 🌸 뽀모도로 및 완료 로직 🌸 =====

  async _startNewTimer(
    userId,
    userName,
    type,
    actualDuration,
    callbackQuery,
    pomodoroInfo = {}
  ) {
    if (this.activeTimers.has(userId))
      return {
        type: "error",
        data: { message: "⚠️ 이미 실행 중인 타이머가 있습니다!" }
      };

    const dbDuration =
      this.devMode.enabled && actualDuration < 1 ? 1 : actualDuration;
    const sessionData = {
      type,
      duration: dbDuration,
      userName,
      pomodoro: pomodoroInfo
    };
    const result = await this.timerService.startSession(userId, sessionData);

    if (!result.success)
      return { type: "error", data: { message: result.message } };

    const timer = this.createTimer(
      result.data._id,
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
    if (!result.success)
      return logger.warn(
        `세션 완료 처리 건너뛰기: ${userId}의 DB 세션이 이미 정리됨.`
      );

    logger.info(`✅ 세션 완료: ${userId}`);
    if (timer.isPomodoro) await this.transitionToNextPomodoro(userId, timer);
    else await this.notifyCompletion(timer);
  }

  /**
   * 🔄 뽀모도로 다음 단계로 전환 (리팩토링)
   */
  async transitionToNextPomodoro(userId, completedTimer) {
    const preset = this.config[completedTimer.preset];
    const isLastFocus =
      completedTimer.currentCycle >= completedTimer.totalCycles;
    const nextCycle =
      completedTimer.type === "focus"
        ? completedTimer.currentCycle
        : completedTimer.currentCycle + 1;
    let nextType, nextDuration;

    if (completedTimer.type === "focus") {
      nextType = isLastFocus ? "longBreak" : "shortBreak";
      nextDuration = isLastFocus ? preset.longBreak : preset.shortBreak;
    } else {
      if (isLastFocus)
        return await this.notifyPomodoroSetCompletion(completedTimer);
      nextType = "focus";
      nextDuration = preset.focus;
    }

    const userName = getUserName({ id: userId, first_name: "Pomodoro" });
    const pomodoroInfo = { ...completedTimer, currentCycle: nextCycle };
    delete pomodoroInfo.sessionId; // 이전 세션 ID는 제거

    const mockCallbackQuery = {
      message: {
        chat: { id: completedTimer.chatId },
        message_id: completedTimer.messageId
      }
    };
    await this._startNewTimer(
      userId,
      userName,
      nextType,
      nextDuration,
      mockCallbackQuery,
      pomodoroInfo
    );

    const newTimer = this.activeTimers.get(userId);
    if (newTimer) await this.notifyTransition(newTimer);
  }

  // ===== 개발자모드 메서드 =====

  parseDevDuration(envValue, defaultValue) {
    if (this.devMode.enabled) {
      const value = parseFloat(envValue);
      if (!isNaN(value)) {
        return value;
      }
    }
    return defaultValue;
  }

  // ===== 🔔 알림 메서드 🔔 =====

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

  // ===== 기존 코드 =====

  // 일시 정지
  async pauseTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.status !== "running")
      return {
        type: "error",
        data: { message: "실행 중인 타이머가 없거나 이미 일시정지 상태입니다." }
      };

    this.clearTimerInterval(userId);
    timer.status = "paused";
    timer.pausedAt = Date.now();

    await this.timerService.pauseSession(userId);
    return {
      type: "timer_paused",
      data: { timer: this.generateTimerData(timer) }
    };
  }

  // 재개
  async resumeTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.status !== "paused")
      return {
        type: "error",
        data: { message: "일시정지 상태인 타이머가 없습니다." }
      };

    const result = await this.timerService.resumeSession(userId);
    if (!result.success)
      return { type: "error", data: { message: result.message } };

    timer.totalPausedDuration += Date.now() - timer.pausedAt;
    timer.status = "running";
    timer.pausedAt = null;
    this.startTimerInterval(userId);

    return {
      type: "timer_resumed",
      data: { timer: this.generateTimerData(timer) }
    };
  }

  // 중단
  async stopTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer)
      return {
        type: "no_timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };

    this.cleanupUserTimer(userId);
    const result = await this.timerService.stopSession(userId);
    if (!result.success)
      return { type: "error", data: { message: result.message } };

    logger.info(
      `⏹️ 세션 중지 완료: ${userId} - 완료율: ${result.data.completionRate}%`
    );
    return {
      type: "timer_stopped",
      data: {
        ...result.data,
        elapsedTime: this.formatTime(
          Math.round(result.data.actualDuration * 60)
        )
      }
    };
  }

  // 커스텀 타이머
  async showCustomSetup(bot, callbackQuery) {
    return { type: "custom_setup", data: {} };
  }

  // 새로고침
  async refresh(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer)
      return {
        type: "no_timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };
    return {
      type: "timer_status",
      data: { timer: this.generateTimerData(timer), isRefresh: true }
    };
  }

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

  startTimerInterval(userId) {
    this.clearTimerInterval(userId);
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    const updateInterval = this.devMode.enabled
      ? Math.min(100, this.config.updateInterval)
      : this.config.updateInterval;

    const intervalId = setInterval(async () => {
      const currentTimer = this.activeTimers.get(userId);
      if (!currentTimer || currentTimer.status !== "running") {
        this.clearTimerInterval(userId);
        return;
      }

      const elapsed = this.calculateElapsedTime(currentTimer);
      const totalDuration = currentTimer.duration * 60 * 1000;
      const remaining = Math.max(0, totalDuration - elapsed);

      if (remaining <= 0) {
        logger.info(`✅ 타이머 완료: ${userId}`);
        await this.completeTimer(userId);
        return;
      }
      // (진행률 DB 업데이트 로직은 선택적으로 추가 가능)
    }, updateInterval);

    this.timerIntervals.set(userId, intervalId);
    if (this.devMode.enabled)
      logger.debug(`⚡ 타이머 인터벌 시작 (${updateInterval}ms 간격)`);
  }

  /**
   * 🧹 특정 사용자의 타이머와 인터벌 정리 (추가된 메서드)
   */
  cleanupUserTimer(userId) {
    this.clearTimerInterval(userId);
    this.activeTimers.delete(userId);
    logger.debug(`🧹 사용자 ${userId}의 타이머 메모리 정리 완료`);
  }

  /**
   * 🛑 인터벌 정리 (추가된 메서드)
   */
  clearTimerInterval(userId) {
    if (this.timerIntervals.has(userId)) {
      clearInterval(this.timerIntervals.get(userId));
      this.timerIntervals.delete(userId);
    }
  }

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
      return timer.pausedAt - timer.startTime - timer.totalPausedDuration;
    }
    return Date.now() - timer.startTime - timer.totalPausedDuration;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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

  // ===== 유틸리티 메서드들 =====

  /**
   * 📊 모듈의 현재 상태를 반환합니다.
   */
  getStatus() {
    return {
      activeTimers: this.activeTimers.size
    };
  }

  /**
   * 🧹 봇 종료 시 모듈을 안전하게 정리합니다. (BaseModule 표준)
   */
  async onCleanup() {
    try {
      // 모든 활성 타이머의 인터벌을 정리합니다.
      for (const userId of this.timerIntervals.keys()) {
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
