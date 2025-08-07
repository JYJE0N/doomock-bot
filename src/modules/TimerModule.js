// src/modules/TimerModule.js - 🍅 완전판 v4.3 (개발 모드 + 모든 필수 메서드)

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.moduleName = moduleName || "timer";
    this.timerService = null;
    this.notificationService = null;
    this.activeTimers = new Map();
    this.timerIntervals = new Map();

    // 🚀 개발 모드 감지
    const isDevelopment = process.env.NODE_ENV === "development";
    const isDevMode = process.env.TIMER_DEV_MODE === "true";

    // 개발 모드 설정
    this.devMode = {
      enabled: isDevelopment && isDevMode,
      showProgress: process.env.LOG_TIMER_PROGRESS === "true"
    };

    // 개발 모드에서 시간 조정
    this.config = {
      focusDuration: this.parseDevDuration(
        process.env.TIMER_FOCUS_DURATION,
        25
      ),
      shortBreak: this.parseDevDuration(process.env.TIMER_SHORT_BREAK, 5),
      longBreak: this.parseDevDuration(process.env.TIMER_LONG_BREAK, 15),
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120,
      updateInterval: parseInt(process.env.TIMER_UPDATE_INTERVAL) || 1000,
      // pomodoro1과 pomodoro2가 this.config의 다른 값을 참조하도록 변경
      get pomodoro1() {
        return {
          focus: this.focusDuration,
          shortBreak: this.shortBreak,
          cycles: 4,
          longBreak: this.longBreak
        };
      },
      get pomodoro2() {
        // 🚀 pomodoro2도 개발 모드 시간을 참조하도록 수정
        return {
          focus: this.focusDuration * 2,
          shortBreak: this.shortBreak * 2,
          cycles: 2,
          longBreak: this.longBreak * 2
        };
      },
      enableNotifications: process.env.TIMER_ENABLE_NOTIFICATIONS !== "false",
      enableBadges: process.env.TIMER_ENABLE_BADGES !== "false",
      maxConcurrentTimers: 1,
      ...options.config
    };

    // 개발 모드 로깅
    if (this.devMode.enabled) {
      logger.warn("⚡ 타이머 개발 모드 활성화!");
      logger.info("⏱️ 실제 시간 설정:");
      logger.info(`  - 집중: ${this.config.focusDuration}분`);
      logger.info(`  - 짧은 휴식: ${this.config.shortBreak}분`);
      logger.info(`  - 긴 휴식: ${this.config.longBreak}분`);
    } else {
      logger.info("🔧 타이머 설정값:");
      logger.info(`  - 집중: ${this.config.focusDuration}분`);
      logger.info(`  - 짧은 휴식: ${this.config.shortBreak}분`);
      logger.info(`  - 긴 휴식: ${this.config.longBreak}분`);
    }

    this.constants = {
      TIMER_TYPES: {
        FOCUS: "focus",
        SHORT_BREAK: "shortBreak",
        LONG_BREAK: "longBreak",
        CUSTOM: "custom"
      },
      TIMER_STATUS: {
        RUNNING: "running",
        PAUSED: "paused",
        STOPPED: "stopped",
        COMPLETED: "completed"
      },
      BADGES: {
        BEGINNER: { threshold: 5, name: "🥉 초보자", emoji: "🥉" },
        INTERMEDIATE: { threshold: 10, name: "🥈 중급자", emoji: "🥈" },
        EXPERT: { threshold: 20, name: "🥇 전문가", emoji: "🥇" },
        MASTER: { threshold: 40, name: "💎 마스터", emoji: "💎" }
      }
    };

    logger.info(`🍅 TimerModule 생성됨: ${this.moduleName}`);
  }

  /**
   * 🚀 개발 모드용 시간 파싱
   */
  parseDevDuration(envValue, defaultValue) {
    const value = parseFloat(envValue) || defaultValue;

    // 개발 모드에서 0.05 같은 값을 그대로 사용
    if (this.devMode?.enabled && value < 1) {
      logger.debug(`개발 모드 시간: ${value}분 (${value * 60}초)`);
    }

    return value;
  }

  async onInitialize() {
    if (this.serviceBuilder) {
      this.timerService = await this.serviceBuilder.getOrCreate("timer");
      try {
        this.notificationService =
          await this.serviceBuilder.getOrCreate("reminder");
        logger.info("✅ ReminderService (알림) 연결됨");
      } catch (err) {
        logger.warn("ReminderService (알림) 없이 진행:", err.message);
      }
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      start: this.startTimer,
      pause: this.pauseTimer,
      resume: this.resumeTimer,
      stop: this.stopTimer,
      status: this.showStatus,
      refresh: this.refreshStatus,
      pomodoro1: this.startPomodoro1,
      pomodoro2: this.startPomodoro2,
      custom: this.showCustomSetup,
      history: this.showHistory,
      stats: this.showWeeklyStats,
      settings: this.showSettings,
      toggleNotifications: this.toggleNotifications,
      help: this.showHelp
    });
  }

  // ===== 핵심 타이머 메서드 =====

  /**
   * ⏰ 타이머 인터벌 시작
   */
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

      // 🚀🚀🚀 핵심 수정 1: 완료 체크를 먼저 수행 🚀🚀🚀
      if (remaining <= 0) {
        logger.info(`✅ 타이머 완료: ${userId}`);
        await this.completeTimer(userId);
        // completeTimer가 인터벌을 정리하므로, 여기서 즉시 리턴
        return;
      }

      const remainingSeconds = Math.floor(remaining / 1000);

      if (this.devMode.enabled && this.devMode.showProgress) {
        const progress = Math.round((elapsed / totalDuration) * 100);
        logger.debug(
          `⏱️ [${userId}] 진행: ${progress}% | 남은 시간: ${remainingSeconds}초`
        );
      }

      if (this.timerService && this.timerService.updateProgress) {
        try {
          await this.timerService.updateProgress(userId, remainingSeconds);
        } catch (error) {
          if (error.message.includes("SESSION_NOT_FOUND")) {
            logger.warn(
              `진행률 업데이트 건너뛰기: ${userId}의 세션이 이미 완료됨`
            );
          } else if (this.devMode.enabled) {
            logger.debug("진행 상황 업데이트 실패:", error.message);
          }
        }
      }
    }, updateInterval);

    this.timerIntervals.set(userId, intervalId);

    if (this.devMode.enabled) {
      logger.debug(`⚡ 타이머 인터벌 시작 (${updateInterval}ms 간격)`);
    }
  }

  /**
   * 🛑 타이머 인터벌 정리
   */
  clearTimerInterval(userId) {
    if (this.timerIntervals.has(userId)) {
      clearInterval(this.timerIntervals.get(userId));
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * 🧹 사용자 타이머 정리
   */
  cleanupUserTimer(userId) {
    this.clearTimerInterval(userId);
    this.activeTimers.delete(userId);
    logger.debug(`🧹 사용자 ${userId}의 타이머 메모리 정리 완료`);
  }

  /**
   * ✅ 타이머 완료 처리
   */
  async completeTimer(userId) {
    // 🚀🚀🚀 핵심 수정 2: 먼저 메모리에서 타이머를 가져오고 즉시 제거하여 중복 실행 방지
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      logger.debug(
        `[경쟁 상태 방지] 사용자 ${userId}의 타이머는 이미 처리 중입니다.`
      );
      return;
    }

    // 인터벌과 메모리를 즉시 정리하여 후속 호출을 막음
    this.cleanupUserTimer(userId);

    try {
      // DB 세션 완료 처리
      const result = await this.timerService.completeSession(userId);

      if (!result.success) {
        // 이미 다른 호출이 DB를 업데이트한 경우, 경고만 기록하고 정상 종료
        if (result.error === "SESSION_NOT_FOUND") {
          logger.warn(
            `세션 완료 처리 건너뛰기: ${userId}의 DB 세션이 이미 완료되었습니다.`
          );
        } else {
          logger.error("세션 완료 처리 DB 오류:", result.message);
        }
        return;
      }

      // 뽀모도로 전환 또는 완료 알림
      if (timer.pomodoroSet) {
        await this.transitionToNextPomodoro(userId, timer);
      } else {
        if (timer.chatId) {
          await this.notifyCompletion({
            type: "timer_completed",
            data: {
              userId,
              chatId: timer.chatId,
              type: timer.type,
              duration: timer.duration,
              completedAt: new Date()
            }
          });
        }
      }
    } catch (error) {
      logger.error("타이머 완료 처리 중 최종 오류:", error);
    }
  }

  /**
   * 🔄 뽀모도로 다음 단계로 전환
   */
  /**
   * 🔄 뽀모도로 다음 단계로 전환 (수정된 최종 버전)
   */
  async transitionToNextPomodoro(userId, completedTimer) {
    const preset = this.config[completedTimer.preset];
    if (!preset) return;

    let nextType;
    let nextActualDuration;
    const nextCycle =
      completedTimer.type === "focus"
        ? completedTimer.currentCycle
        : completedTimer.currentCycle + 1;

    if (completedTimer.type === "focus") {
      // 집중 -> 휴식
      if (completedTimer.currentCycle >= completedTimer.totalCycles) {
        nextType = "longBreak";
        nextActualDuration = preset.longBreak;
      } else {
        nextType = "shortBreak";
        nextActualDuration = preset.shortBreak;
      }
    } else {
      // 휴식 -> 집중
      nextType = "focus";
      nextActualDuration = preset.focus;
    }

    // 🚀 뽀모도로 세트 전체가 완료되었는지 확인
    if (
      completedTimer.type !== "focus" &&
      completedTimer.currentCycle >= completedTimer.totalCycles
    ) {
      await this.notifyPomodoroSetCompletion(completedTimer);
      return; // 세트가 끝났으므로 여기서 종료
    }

    // 개발 모드 시간 처리
    const dbDuration =
      this.devMode.enabled && nextActualDuration < 1 ? 1 : nextActualDuration;

    // 다음 세션을 시작하기 위한 정보 구성
    const userName = getUserName({
      from: { id: userId, first_name: "Pomodoro" }
    });
    const mockCallbackQuery = {
      message: {
        chat: { id: completedTimer.chatId },
        message_id: completedTimer.messageId
      }
    };
    const pomodoroInfo = {
      pomodoroSet: true,
      currentCycle: nextCycle,
      totalCycles: completedTimer.totalCycles,
      preset: completedTimer.preset
    };

    logger.info(`🔄 뽀모도로 전환: ${userId} - ${nextType} 타이머 시작`);

    // 🚀 _startNewTimer를 호출하여 DB에 새 세션 생성 및 새 타이머 시작
    const result = await this._startNewTimer(
      userId,
      userName,
      nextType,
      dbDuration,
      mockCallbackQuery,
      pomodoroInfo,
      nextActualDuration
    );

    // 🚀 전환 결과를 사용자에게 새 메시지로 알림
    if (result && result.type !== "error") {
      await this.notifyTransition(
        completedTimer.chatId,
        nextType,
        nextActualDuration
      );
    } else if (result) {
      await this.bot.telegram.sendMessage(
        completedTimer.chatId,
        `다음 뽀모도로 세션(${nextType})을 시작하는데 실패했습니다: ${result.data.message}`
      );
    }
  }

  /**
   * 🔔 뽀모도로 전환 알림 (새로운 메서드)
   */
  async notifyTransition(chatId, nextType, duration) {
    try {
      const typeDisplay = this.getTypeDisplay(nextType);
      const durationDisplay =
        this.devMode.enabled && duration < 1
          ? `${Math.round(duration * 60)}초`
          : `${duration}분`;

      const message = `✅ 이전 세션 완료!\n\n다음 세션인 *${typeDisplay}*(${durationDisplay}) 타이머를 시작합니다.`;

      if (this.bot && this.bot.telegram) {
        await this.bot.telegram.sendMessage(chatId, message, {
          parse_mode: "Markdown"
        });
      }
    } catch (error) {
      logger.error("뽀모도로 전환 알림 전송 실패:", error);
    }
  }

  /**
   * 🎉 뽀모도로 세트 완료 알림 (새로운 메서드)
   */
  async notifyPomodoroSetCompletion(completedTimer) {
    try {
      const message = `🎉 *뽀모도로 세트 완료!*\n\n총 ${completedTimer.totalCycles} 사이클을 모두 마치셨습니다! 정말 대단해요! 푹 쉬세요. 😊`;

      if (this.bot && this.bot.telegram) {
        await this.bot.telegram.sendMessage(completedTimer.chatId, message, {
          parse_mode: "Markdown"
        });
      }
    } catch (error) {
      logger.error("뽀모도로 세트 완료 알림 실패:", error);
    }
  }

  /**
   * 🔔 완료 알림 전송
   */
  async notifyCompletion(completionData) {
    try {
      const { chatId, type, duration } = completionData.data;

      const message = `✅ ${this.getTypeDisplay(type)} ${duration}분 타이머가 완료되었습니다!`;

      // bot 인스턴스 찾기
      if (this.bot && this.bot.telegram) {
        await this.bot.telegram.sendMessage(chatId, message);
      }
    } catch (error) {
      logger.error("완료 알림 전송 실패:", error);
    }
  }

  // ===== 액션 메서드들 =====

  async showMenu(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const activeTimer = this.activeTimers.get(userId);
    let recentSessions = [];

    if (this.timerService) {
      const result = await this.timerService.getRecentSessions(userId, 3);
      if (result.success) recentSessions = result.data || [];
    }

    return {
      type: "menu",
      module: "timer",
      data: {
        userName,
        activeTimer: activeTimer ? this.generateTimerData(activeTimer) : null,
        recentSessions
      }
    };
  }

  async startTimer(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const timerType = params;

    const duration = this.getDurationByType(timerType);

    // 🚀 핵심 수정: params가 없는 경우(예: /start) 커스텀 설정으로 유도
    if (!duration) {
      if (timerType) {
        // 잘못된 타입이 명시된 경우
        return {
          type: "error",
          module: "timer",
          data: { message: "잘못된 타이머 타입입니다." }
        };
      } else {
        // 타입 없이 호출된 경우
        return this.showCustomSetup(bot, callbackQuery);
      }
    }

    logger.debug(`타이머 타입 ${timerType}의 시간: ${duration}분`);

    // 🚀 핵심 수정: DB 저장용 시간과 실제 동작 시간 분리
    let dbDuration = duration;
    // 개발 모드이고 설정된 시간이 1분 미만일 경우
    if (this.devMode.enabled && duration < 1) {
      dbDuration = 1; // DB에는 최소 1분으로 저장
      logger.info(
        `🔧 개발 모드: ${duration}분 타이머 -> DB에는 ${dbDuration}분으로 저장`
      );
    }

    return this._startNewTimer(
      userId,
      userName,
      timerType,
      dbDuration, // DB 저장용 시간
      callbackQuery,
      null,
      duration // 실제 타이머 동작 시간
    );
  }

  async _startNewTimer(
    userId,
    userName,
    type,
    duration, // 이 값은 DB 저장용 (dbDuration)
    callbackQuery,
    pomodoroInfo = null,
    actualDuration = null // 이 값은 실제 타이머 동작용
  ) {
    try {
      if (this.activeTimers.has(userId)) {
        return {
          type: "timer_already_running",
          module: "timer",
          data: { message: "⚠️ 이미 실행 중인 타이머가 있습니다!" }
        };
      }

      // DB에는 'duration' 변수(dbDuration)를 사용해 세션 생성
      const sessionData = { type, duration, userName, ...pomodoroInfo };
      const result = await this.timerService.startSession(userId, sessionData);

      if (!result.success) {
        return {
          type: "error",
          module: "timer",
          data: { message: result.message }
        };
      }

      const session = result.data;

      // 🚀 핵심 수정: 실제 타이머 동작 시간 결정
      // actualDuration이 있으면 그 값을 사용, 없으면 dbDuration 사용
      const timerDuration = actualDuration !== null ? actualDuration : duration;

      const timer = this.createTimer(session._id, type, timerDuration, userId);
      timer.chatId = callbackQuery.message.chat.id;
      timer.messageId = callbackQuery.message.message_id;

      if (pomodoroInfo) {
        Object.assign(timer, pomodoroInfo);
      }

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      // 사용자에게는 실제 동작 시간을 기준으로 안내
      logger.info(`▶️ 세션 시작: ${userId} - ${type} (${timerDuration}분)`);

      return {
        type: pomodoroInfo ? "pomodoro_started" : "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: `🍅 ${duration}분 타이머를 시작합니다!`,
          preset: pomodoroInfo?.preset
        }
      };
    } catch (error) {
      logger.error("타이머 시작 중 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 시작 중 오류가 발생했습니다." }
      };
    }
  }

  async startPomodoro1(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const preset = this.config.pomodoro1;

    // 🚀 핵심 수정: DB 저장용 시간과 실제 동작 시간 분리
    const actualDuration = preset.focus; // 개발 모드 시간이 적용된 실제 동작 시간
    const dbDuration = this.devMode.enabled ? 1 : actualDuration; // DB에는 최소 1분 저장

    const pomodoroInfo = {
      pomodoroSet: true,
      currentCycle: 1,
      totalCycles: preset.cycles,
      preset: "pomodoro1"
    };
    return this._startNewTimer(
      userId,
      userName,
      "focus",
      dbDuration, // DB 저장용 시간
      callbackQuery,
      pomodoroInfo,
      actualDuration // 실제 타이머 동작 시간
    );
  }

  async startPomodoro2(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const preset = this.config.pomodoro2;

    // 🚀 핵심 수정: DB 저장용 시간과 실제 동작 시간 분리
    const actualDuration = preset.focus; // 개발 모드 시간이 적용된 실제 동작 시간
    const dbDuration = this.devMode.enabled ? 1 : actualDuration; // DB에는 최소 1분 저장

    const pomodoroInfo = {
      pomodoroSet: true,
      currentCycle: 1,
      totalCycles: preset.cycles,
      preset: "pomodoro2"
    };
    return this._startNewTimer(
      userId,
      userName,
      "focus",
      dbDuration, // DB 저장용 시간
      callbackQuery,
      pomodoroInfo,
      actualDuration // 실제 타이머 동작 시간
    );
  }

  async pauseTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer || timer.status === "paused") {
      return {
        type: "no_timer",
        module: "timer",
        data: {
          message: timer
            ? "이미 일시정지 상태입니다."
            : "실행 중인 타이머가 없습니다."
        }
      };
    }

    this.clearTimerInterval(userId);
    timer.status = "paused";
    timer.pausedAt = Date.now();

    await this.timerService.pauseSession(userId);

    return {
      type: "timer_paused",
      module: "timer",
      data: {
        timer: this.generateTimerData(timer),
        message: "⏸️ 타이머를 일시정지했습니다."
      }
    };
  }

  async resumeTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer || timer.status !== "paused") {
      return {
        /* ... */
      };
    }

    // 🚀 1. DB를 먼저 업데이트하고 결과를 기다립니다.
    const result = await this.timerService.resumeSession(userId);

    if (!result.success) {
      return {
        type: "error",
        module: "timer",
        data: { message: result.message || "타이머 재개에 실패했습니다." }
      };
    }

    // 🚀 2. DB 업데이트 성공 후, 인메모리 상태를 변경합니다.
    timer.totalPausedDuration += Date.now() - timer.pausedAt;
    timer.status = "running";
    timer.pausedAt = null;

    // 🚀 3. 마지막으로 인터벌을 시작합니다.
    this.startTimerInterval(userId);

    return {
      type: "timer_resumed",
      module: "timer",
      data: {
        timer: this.generateTimerData(timer),
        message: "▶️ 타이머를 재개했습니다."
      }
    };
  }

  async stopTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    // 1. 메모리에서 타이머를 먼저 가져옵니다.
    const timer = this.activeTimers.get(userId);

    if (!timer) {
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };
    }

    // 2. 경쟁 상태를 막기 위해 인터벌과 메모리를 즉시 정리합니다.
    this.cleanupUserTimer(userId);

    // 3. DB 업데이트를 요청합니다.
    const result = await this.timerService.stopSession(userId);

    if (!result.success) {
      return {
        type: "error",
        module: "timer",
        data: { message: result.message || "타이머 중지에 실패했습니다." }
      };
    }

    logger.info(
      `⏹️ 세션 중지 완료: ${userId} - 완료율: ${result.data.completionRate}%`
    );

    // 4. DB 결과를 바탕으로 사용자에게 성공 메시지를 보냅니다.
    return {
      type: "timer_stopped",
      module: "timer",
      data: {
        message: "⏹️ 타이머를 중지했습니다.",
        elapsedTime: this.formatTime(
          Math.round(result.data.actualDuration * 60)
        ),
        completionRate: result.data.completionRate
      }
    };
  }

  async refreshStatus(bot, callbackQuery, isRefresh = true) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer) {
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };
    }

    return {
      type: "timer_status",
      module: "timer",
      data: {
        timer: this.generateTimerData(timer),
        canRefresh: true,
        isRefresh
      }
    };
  }

  async showStatus(bot, callbackQuery) {
    return this.refreshStatus(bot, callbackQuery, false);
  }

  async showHistory(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const result = await this.timerService.getRecentSessions(userId, 10);

    if (!result.success || result.data.length === 0) {
      return {
        type: "no_history",
        module: "timer",
        data: { message: "아직 기록이 없습니다." }
      };
    }

    return {
      type: "history",
      module: "timer",
      data: {
        sessions: result.data,
        userName: getUserName(callbackQuery.from)
      }
    };
  }

  async showWeeklyStats(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const result = await this.timerService.getWeeklyStats(userId);
    const stats = result.success ? result.data : this.getDefaultStats();
    const badge = this.calculateBadge(stats.totalSessions);

    return {
      type: "weekly_stats",
      module: "timer",
      data: { stats, badge, userName }
    };
  }

  async showCustomSetup(bot, callbackQuery) {
    if (this.activeTimers.has(getUserId(callbackQuery.from))) {
      return {
        type: "error",
        module: "timer",
        data: { message: "이미 실행 중인 타이머가 있습니다." }
      };
    }

    return {
      type: "custom_setup",
      module: "timer",
      data: {
        userName: getUserName(callbackQuery.from),
        maxDuration: this.config.maxCustomDuration,
        suggestedDurations: [10, 15, 20, 30, 45, 60, 90]
      }
    };
  }

  async showSettings(bot, callbackQuery) {
    return {
      type: "settings",
      module: "timer",
      data: {
        config: this.config,
        userName: getUserName(callbackQuery.from)
      }
    };
  }

  async toggleNotifications(bot, callbackQuery) {
    this.config.enableNotifications = !this.config.enableNotifications;
    return {
      type: "settings_updated",
      module: "timer",
      data: {
        message: this.config.enableNotifications
          ? "🔔 알림을 켰습니다."
          : "🔕 알림을 껐습니다.",
        config: this.config
      }
    };
  }

  async showHelp(bot, callbackQuery) {
    return {
      type: "help",
      module: "timer",
      data: {
        userName: getUserName(callbackQuery.from)
      }
    };
  }

  // ===== 헬퍼 메서드들 =====

  createTimer(sessionId, type, duration, userId) {
    return {
      sessionId,
      type,
      duration,
      userId,
      startTime: Date.now(),
      remainingTime: duration * 60,
      status: "running",
      pausedAt: null,
      totalPausedDuration: 0, // 🚀 totalPausedTime -> totalPausedDuration
      devMode: this.devMode.enabled
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

  getDurationByType(type) {
    switch (type) {
      case this.constants.TIMER_TYPES.FOCUS:
      case "focus":
        return this.config.focusDuration;
      case this.constants.TIMER_TYPES.SHORT_BREAK:
      case "shortBreak":
        return this.config.shortBreak;
      case this.constants.TIMER_TYPES.LONG_BREAK:
      case "longBreak":
        return this.config.longBreak;
      default:
        return null;
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
