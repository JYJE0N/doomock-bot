// src/modules/TimerModule.js - 🍅 최종 완성 버전 v4.3

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.moduleName = moduleName || "timer";
    this.timerService = null;
    this.notificationService = null;
    this.activeTimers = new Map(); // userId -> timer
    this.timerIntervals = new Map(); // userId -> intervalId

    // 환경변수에서 설정값 읽기
    const focusDuration = parseFloat(process.env.TIMER_FOCUS_DURATION) || 25;
    const shortBreak = parseFloat(process.env.TIMER_SHORT_BREAK) || 5;
    const longBreak = parseFloat(process.env.TIMER_LONG_BREAK) || 15;

    this.config = {
      focusDuration,
      shortBreak,
      longBreak,
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120,
      updateInterval: 1000,
      pomodoro1: {
        focus: focusDuration,
        shortBreak: shortBreak,
        cycles: 4,
        longBreak: longBreak
      },
      pomodoro2: {
        focus: (focusDuration || 25) * 2,
        shortBreak: (shortBreak || 5) * 2,
        cycles: 2,
        longBreak: (longBreak || 15) * 2
      },
      enableNotifications: process.env.TIMER_ENABLE_NOTIFICATIONS !== "false",
      enableBadges: process.env.TIMER_ENABLE_BADGES !== "false",
      maxConcurrentTimers: 1,
      ...options.config
    };

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

    // 개발 환경에서 설정값 로깅
    if (process.env.NODE_ENV === "development") {
      logger.info("🔧 타이머 설정값:");
      logger.info(
        `  - 집중: ${this.config.focusDuration}분 (${this.config.focusDuration * 60}초)`
      );
      logger.info(
        `  - 짧은 휴식: ${this.config.shortBreak}분 (${this.config.shortBreak * 60}초)`
      );
      logger.info(
        `  - 긴 휴식: ${this.config.longBreak}분 (${this.config.longBreak * 60}초)`
      );
      logger.info(`  - 환경변수 원본값:`);
      logger.info(
        `    TIMER_FOCUS_DURATION: ${process.env.TIMER_FOCUS_DURATION}`
      );
      logger.info(`    TIMER_SHORT_BREAK: ${process.env.TIMER_SHORT_BREAK}`);
      logger.info(`    TIMER_LONG_BREAK: ${process.env.TIMER_LONG_BREAK}`);
    }

    logger.info(`🍅 TimerModule 생성됨: ${this.moduleName}`);
  }

  async onInitialize() {
    if (this.serviceBuilder) {
      this.timerService = await this.serviceBuilder.getOrCreate("timer");

      // 봇 시작 시 모든 활성 세션 정리
      if (this.timerService.cleanupAllActiveSessions) {
        await this.timerService.cleanupAllActiveSessions();
      }

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

  /**
   * 헬퍼: 새로운 타이머 시작 로직 통합
   */
  async _startNewTimer(userId, userName, type, duration, options = {}) {
    try {
      // 이미 실행 중인 타이머가 있는지 확인
      if (this.activeTimers.has(userId)) {
        logger.warn(`사용자 ${userId}에게 이미 메모리에 타이머가 있습니다.`);
        return {
          type: "error",
          module: "timer",
          data: { message: "이미 실행 중인 타이머가 있습니다." }
        };
      }

      // 개발 환경: 실제 시간은 메모리에서만 사용
      let dbDuration = duration;
      let actualDuration = duration;

      if (process.env.NODE_ENV === "development" && duration < 1) {
        logger.info(
          `🔧 개발 모드: ${duration}분 타이머 -> DB에는 1분으로 저장`
        );
        dbDuration = 1; // DB 저장용
        actualDuration = duration; // 실제 사용할 시간
      }

      // DB에 세션 생성 (1분으로 저장)
      const result = await this.timerService.startSession(userId, {
        type,
        duration: dbDuration,
        userName
      });

      if (!result.success) {
        logger.error(`TimerService 오류: ${result.error}`);
        return {
          type: "error",
          module: "timer",
          data: {
            message: result.message || "타이머 시작에 실패했습니다.",
            error: result.error
          }
        };
      }

      // 메모리에 타이머 생성 (실제 시간 사용)
      const timer = this.createTimer(
        result.data._id,
        type,
        actualDuration,
        userId
      );
      Object.assign(timer, options);

      // bot 인스턴스 저장
      timer.bot = options.bot || null;

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(
        `🚀 새 타이머 시작: ${userId} - ${type} (${actualDuration}분)`
      );

      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: `⏱️ ${actualDuration}분 ${this.getTypeDisplay(type)} 타이머를 시작했습니다!`
        }
      };
    } catch (error) {
      logger.error("타이머 시작 중 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: {
          message: "타이머 시작 중 오류가 발생했습니다.",
          error: error.message
        }
      };
    }
  }

  async startTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const type = callbackQuery.data.split(":")[2] || "focus";

    const duration = this.getDurationByType(type);
    if (!duration) {
      return {
        type: "error",
        module: "timer",
        data: { message: "알 수 없는 타이머 타입입니다." }
      };
    }

    return this._startNewTimer(userId, userName, type, duration, { bot });
  }

  async startPomodoro1(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const config = this.config.pomodoro1;

    return this._startNewTimer(userId, userName, "focus", config.focus, {
      bot,
      pomodoroSet: true,
      preset: "pomodoro1",
      currentCycle: 1,
      totalCycles: config.cycles,
      focusDuration: config.focus,
      shortBreak: config.shortBreak,
      longBreak: config.longBreak
    });
  }

  async startPomodoro2(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const config = this.config.pomodoro2;

    return this._startNewTimer(userId, userName, "focus", config.focus, {
      bot,
      pomodoroSet: true,
      preset: "pomodoro2",
      currentCycle: 1,
      totalCycles: config.cycles,
      focusDuration: config.focus,
      shortBreak: config.shortBreak,
      longBreak: config.longBreak
    });
  }

  async pauseTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    // 메모리에 타이머가 없으면 에러
    if (!timer) {
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };
    }

    // 이미 일시정지 상태인지 확인
    if (timer.status === "paused") {
      return {
        type: "already_paused",
        module: "timer",
        data: { message: "이미 일시정지 상태입니다." }
      };
    }

    // 메모리의 타이머 상태 업데이트
    this.clearTimerInterval(userId);
    timer.status = "paused";
    timer.pausedAt = Date.now();

    // DB 업데이트는 try-catch로 처리 (실패해도 메모리 타이머는 유지)
    try {
      await this.timerService.pauseSession(userId);
    } catch (error) {
      logger.warn(
        "DB 세션 일시정지 실패 (타이머는 이미 완료되었을 수 있음):",
        error.message
      );
    }

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
    if (!timer || timer.status !== "paused")
      return {
        type: "no_timer",
        module: "timer",
        data: {
          message: timer
            ? "일시정지 상태가 아닙니다."
            : "실행 중인 타이머가 없습니다."
        }
      };

    timer.totalPausedTime += Date.now() - timer.pausedAt;
    timer.status = "running";
    timer.pausedAt = null;
    this.startTimerInterval(userId);

    await this.timerService.resumeSession(userId);

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
    const timer = this.activeTimers.get(userId);
    if (!timer)
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };

    const result = await this.timerService.stopSession(userId);
    if (!result.success) {
      return {
        type: "error",
        module: "timer",
        data: { message: result.message }
      };
    }

    this.cleanupUserTimer(userId);

    const elapsedTime = this.calculateElapsedTime(timer);
    return {
      type: "timer_stopped",
      module: "timer",
      data: {
        message: "⏹️ 타이머를 중지했습니다.",
        elapsedTime: this.formatTime(Math.floor(elapsedTime / 1000)),
        completionRate: result.data.completionRate
      }
    };
  }

  async showStatus(bot, callbackQuery) {
    return this.refreshStatus(bot, callbackQuery, false);
  }

  async refreshStatus(bot, callbackQuery, isRefresh = true) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer)
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." }
      };

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
      data: { sessions: result.data, userName: getUserName(callbackQuery.from) }
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

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 사용자 설정 조회
      const result = await this.timerService.getUserSettings(userId);

      const settings =
        result.success && result.data
          ? result.data
          : {
              focusDuration: this.config.focusDuration,
              shortBreak: this.config.shortBreak,
              longBreak: this.config.longBreak,
              enableNotifications: this.config.enableNotifications,
              enableBadges: this.config.enableBadges
            };

      return {
        type: "settings",
        module: "timer",
        data: {
          settings,
          userName,
          enableNotifications: settings.enableNotifications
        }
      };
    } catch (error) {
      logger.error("설정 조회 중 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "설정을 불러올 수 없습니다." }
      };
    }
  }

  /**
   * 🔔 알림 설정 토글
   */
  async toggleNotifications(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.timerService.toggleNotifications(userId);

      if (!result.success) {
        return {
          type: "error",
          module: "timer",
          data: { message: result.message || "알림 설정 변경에 실패했습니다." }
        };
      }

      const enabled = result.data.enabled;

      return {
        type: "notification_toggled",
        module: "timer",
        data: {
          enabled,
          message: enabled
            ? "🔔 타이머 완료 알림이 켜졌습니다."
            : "🔕 타이머 완료 알림이 꺼졌습니다."
        }
      };
    } catch (error) {
      logger.error("알림 설정 토글 중 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "알림 설정 변경 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery) {
    const userName = getUserName(callbackQuery.from);

    return {
      type: "help",
      module: "timer",
      data: {
        userName,
        features: [
          {
            icon: "🍅",
            title: "뽀모도로 기법",
            description: "25분 집중 + 5분 휴식의 과학적인 시간 관리법"
          },
          {
            icon: "⏱️",
            title: "커스텀 타이머",
            description: "원하는 시간으로 자유롭게 설정 가능"
          },
          {
            icon: "📊",
            title: "통계 및 기록",
            description: "주간 활동 통계와 최근 타이머 기록 확인"
          },
          {
            icon: "🏆",
            title: "뱃지 시스템",
            description: "목표 달성에 따른 뱃지 획득"
          },
          {
            icon: "🔔",
            title: "완료 알림",
            description: "타이머 완료 시 텔레그램 알림 발송"
          }
        ],
        tips: [
          "💡 집중력이 떨어질 때는 짧은 휴식을 자주 가져보세요",
          "💡 뽀모도로 4회 완료 후에는 긴 휴식을 추천합니다",
          "💡 개인에 맞는 시간을 찾아 커스텀 설정을 활용하세요"
        ]
      }
    };
  }

  // ===== 타이머 인터벌 관리 =====

  startTimerInterval(userId) {
    const intervalId = setInterval(async () => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.status !== "running") {
        this.clearTimerInterval(userId);
        return;
      }

      const elapsed = this.calculateElapsedTime(timer);
      const remaining = timer.duration * 60 * 1000 - elapsed;

      if (remaining <= 0) {
        this.clearTimerInterval(userId);

        // bot 인스턴스를 저장해두었다가 사용
        const bot = timer.bot || null;
        await this.completeTimer(userId, bot);
      } else {
        await this.updateTimerProgress(userId, timer);
      }
    }, this.config.updateInterval);

    this.timerIntervals.set(userId, intervalId);
  }

  clearTimerInterval(userId) {
    const intervalId = this.timerIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.timerIntervals.delete(userId);
    }
  }

  async updateTimerProgress(userId, timer) {
    const elapsed = this.calculateElapsedTime(timer);
    const remainingSeconds = Math.max(
      0,
      timer.duration * 60 - Math.floor(elapsed / 1000)
    );

    try {
      await this.timerService.updateProgress(userId, remainingSeconds);
    } catch (error) {
      logger.debug("진행 상황 업데이트 실패:", error.message);
    }
  }

  calculateElapsedTime(timer) {
    if (timer.status === "paused") {
      return timer.pausedAt - timer.startTime - timer.totalPausedTime;
    }
    return Date.now() - timer.startTime - timer.totalPausedTime;
  }

  /**
   * 타이머 완료 처리 수정
   */
  async completeTimer(userId, bot = null) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    // DB 세션 완료 처리
    const result = await this.timerService.completeSession(userId);
    if (!result.success) {
      logger.error("세션 완료 처리 실패:", result.error);
    }

    // 알림 전송 (bot 인스턴스가 있을 때만)
    if (this.config.enableNotifications && bot) {
      await this.sendCompletionNotification(userId, timer, bot);
    }

    // 뽀모도로 세트 처리
    if (timer.pomodoroSet) {
      await this.handlePomodoroTransition(userId, timer);
    } else {
      // 일반 타이머는 메모리에서 제거
      this.cleanupUserTimer(userId);
      logger.info(`✅ 타이머 완료 및 정리: ${userId}`);
    }
  }

  /**
   * 🔔 완료 알림 전송 (수정된 버전)
   */
  async sendCompletionNotification(userId, timer, bot) {
    try {
      const typeDisplay = this.getTypeDisplay(timer.type);
      const duration =
        timer.duration < 1
          ? `${Math.round(timer.duration * 60)}초`
          : `${timer.duration}분`;
      const message = `🎉 ${duration} ${typeDisplay} 타이머가 완료되었습니다!`;

      await bot.telegram.sendMessage(userId, message);
      logger.info(`알림 전송 완료: ${userId}`);
    } catch (error) {
      logger.error("알림 전송 실패:", error);
    }
  }

  async handlePomodoroTransition(userId, timer) {
    const _preset = this.config[timer.preset];
    let nextType, nextDuration;

    if (timer.type === "focus") {
      if (timer.currentCycle < timer.totalCycles) {
        nextType = "shortBreak";
        nextDuration = timer.shortBreak;
      } else {
        nextType = "longBreak";
        nextDuration = timer.longBreak;
      }
    } else {
      if (
        timer.type === "longBreak" ||
        timer.currentCycle >= timer.totalCycles
      ) {
        this.cleanupUserTimer(userId);
        logger.info(`🎉 뽀모도로 세트 완료: ${userId}`);
        return;
      }
      nextType = "focus";
      nextDuration = timer.focusDuration;
      timer.currentCycle++;
    }

    // 새 타이머로 교체
    const newTimer = this.createTimer(timer.sessionId, nextType, nextDuration);
    newTimer.pomodoroSet = true;
    newTimer.currentCycle = timer.currentCycle;
    newTimer.totalCycles = timer.totalCycles;
    newTimer.preset = timer.preset;
    newTimer.chatId = timer.chatId;
    newTimer.messageId = timer.messageId;
    newTimer.bot = timer.bot; // bot 인스턴스 전달

    this.activeTimers.set(userId, newTimer);
    this.startTimerInterval(userId);

    logger.info(`🔄 뽀모도로 전환: ${userId} - ${nextType}`);
  }

  // ===== 헬퍼 메서드 =====

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
      totalPausedTime: 0
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
      remainingFormatted: this.formatTime(Math.floor(remaining / 1000)),
      remainingSeconds: Math.floor(remaining / 1000)
    };
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  getDurationByType(type) {
    const duration = (() => {
      switch (type) {
        case this.constants.TIMER_TYPES.FOCUS:
          return this.config.focusDuration;
        case this.constants.TIMER_TYPES.SHORT_BREAK:
          return this.config.shortBreak;
        case this.constants.TIMER_TYPES.LONG_BREAK:
          return this.config.longBreak;
        default:
          return null;
      }
    })();

    // 개발 환경에서 디버깅
    if (process.env.NODE_ENV === "development") {
      logger.debug(`타이머 타입 ${type}의 시간: ${duration}분`);
    }

    return duration;
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

  /**
   * 메모리 타이머 정리
   */
  cleanupUserTimer(userId) {
    this.clearTimerInterval(userId);
    this.activeTimers.delete(userId);
    logger.debug(`🧹 사용자 ${userId}의 타이머 메모리 정리 완료`);
  }

  /**
   * 🧹 모듈 정리 (메모리 누수 방지)
   */
  async cleanup() {
    try {
      // 모든 타이머 정리
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
