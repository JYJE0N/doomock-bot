// src/modules/TimerModule.js - 🍅 최종 최적화 버전 v4.2

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
    const focusDuration = parseFloat(process.env.TIMER_FOCUS_DURATION);
    const shortBreak = parseFloat(process.env.TIMER_SHORT_BREAK);
    const longBreak = parseFloat(process.env.TIMER_LONG_BREAK);

    this.config = {
      focusDuration: focusDuration || 25,
      shortBreak: shortBreak || 5,
      longBreak: longBreak || 15,
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120,
      updateInterval: 1000,
      pomodoro1: {
        focus: focusDuration || 25,
        shortBreak: shortBreak || 5,
        cycles: 4,
        longBreak: longBreak || 15
      },
      pomodoro2: {
        focus: focusDuration ? focusDuration * 2 : 50,
        shortBreak: shortBreak ? shortBreak * 2 : 10,
        cycles: 2,
        longBreak: longBreak ? longBreak * 2 : 30
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

  /**
   * 모듈 초기화 시 정리 추가
   */
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
      // 아래 액션들은 현재 입력 처리가 없으므로 주석 처리 또는 구현 필요
      // setCustom: this.setCustomTimer,
      // setFocus: this.setFocusDuration,
      // setBreak: this.setBreakDuration,
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

      // DB에 세션 생성
      const result = await this.timerService.startSession(userId, {
        type,
        duration,
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

      // 메모리에 타이머 생성
      const timer = this.createTimer(result.data._id, type, duration, userId);
      Object.assign(timer, options);

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`🚀 새 타이머 시작: ${userId} - ${type} (${duration}분)`);

      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: `⏱️ ${duration}분 ${this.getTypeDisplay(type)} 타이머를 시작했습니다!`
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

  async startTimer(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const [timerType, customDuration] = params.split(":");

    let duration;
    if (timerType === "custom" && customDuration) {
      duration = parseFloat(customDuration);
      if (
        isNaN(duration) ||
        duration <= 0 ||
        duration > this.config.maxCustomDuration
      ) {
        return {
          type: "error",
          module: "timer",
          data: {
            message: `1 ~ ${this.config.maxCustomDuration}분 사이로 설정해주세요.`
          }
        };
      }
    } else {
      duration = this.getDurationByType(timerType);
    }

    if (!duration) {
      return {
        type: "error",
        module: "timer",
        data: { message: "잘못된 타이머 타입입니다." }
      };
    }

    return this._startNewTimer(
      userId,
      userName,
      timerType,
      duration,
      callbackQuery
    );
  }

  async startPomodoro1(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const preset = this.config.pomodoro1;
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
      preset.focus,
      callbackQuery,
      pomodoroInfo
    );
  }

  async startPomodoro2(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const preset = this.config.pomodoro2;
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
      preset.focus,
      callbackQuery,
      pomodoroInfo
    );
  }

  async pauseTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.status === "paused")
      return {
        type: "no_timer",
        module: "timer",
        data: {
          message: timer
            ? "이미 일시정지 상태입니다."
            : "실행 중인 타이머가 없습니다."
        }
      };

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

  // Settings and Help methods... (기존과 동일하게 유지)

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
      remaining,
      remainingFormatted: this.formatTime(Math.floor(remaining / 1000))
    };
  }

  calculateElapsedTime(timer) {
    if (timer.status === "paused") {
      return timer.pausedAt - timer.startTime - timer.totalPausedTime;
    }
    return Date.now() - timer.startTime - timer.totalPausedTime;
  }

  startTimerInterval(userId) {
    this.clearTimerInterval(userId);
    const interval = setInterval(() => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.status === "paused") return;

      const elapsed = this.calculateElapsedTime(timer);
      if (elapsed >= timer.duration * 60 * 1000) {
        this.completeTimer(userId);
      }
    }, 1000);
    this.timerIntervals.set(userId, interval);
  }

  clearTimerInterval(userId) {
    if (this.timerIntervals.has(userId)) {
      clearInterval(this.timerIntervals.get(userId));
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * 🔔 완료 알림 요청 (렌더러에게 위임)
   */
  async notifyCompletion(completionData) {
    try {
      const { chatId, userId } = completionData.data;

      // NavigationHandler/Renderer를 통한 알림 처리
      if (this.moduleManager?.navigationHandler?.renderers) {
        const renderer =
          this.moduleManager.navigationHandler.renderers.get("timer");

        if (renderer && renderer.renderCompletion) {
          // ctx 객체 생성 (알림용)
          const ctx = {
            chat: { id: chatId },
            from: { id: userId },
            telegram: this.bot.telegram || this.bot,
            reply: async (text, options) => {
              if (this.bot.telegram) {
                return this.bot.telegram.sendMessage(chatId, text, options);
              } else if (this.bot.sendMessage) {
                return this.bot.sendMessage(chatId, text, options);
              }
            }
          };

          // 렌더러에게 완료 렌더링 요청
          await renderer.renderCompletion(completionData, ctx);
          logger.info(`🔔 타이머 완료 렌더링 요청: ${userId}`);
        } else {
          logger.warn("TimerRenderer.renderCompletion을 찾을 수 없습니다.");

          // 폴백: 최소한의 알림만 전송 (UI 없이)
          await this.sendMinimalNotification(chatId, completionData.data);
        }
      } else {
        logger.warn("NavigationHandler/Renderer 시스템을 찾을 수 없습니다.");

        // 폴백: 최소한의 알림만 전송
        await this.sendMinimalNotification(chatId, completionData.data);
      }
    } catch (error) {
      logger.error("완료 알림 요청 실패:", error);
    }
  }

  /**
   * 📢 최소한의 알림 전송 (폴백용 - UI 없음)
   */
  async sendMinimalNotification(chatId, data) {
    try {
      // 단순 텍스트 메시지만 (UI 생성 없음!)
      const message = `⏰ ${data.duration}분 ${data.timerType} 타이머가 완료되었습니다.`;

      if (this.bot.telegram) {
        await this.bot.telegram.sendMessage(chatId, message);
      } else if (this.bot.sendMessage) {
        await this.bot.sendMessage(chatId, message);
      }

      logger.info("📢 최소 알림 전송 완료");
    } catch (error) {
      logger.error("최소 알림 전송 실패:", error);
    }
  }

  /**
   * 뽀모도로 전환 처리
   */
  async handlePomodoroTransition(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer || !timer.pomodoroSet) return;

    const preset = this.config[timer.preset];

    // 다음 타이머 타입 결정
    let nextType, nextDuration;

    if (timer.type === this.constants.TIMER_TYPES.FOCUS) {
      // 집중 후 → 휴식
      if (timer.currentCycle < preset.cycles) {
        nextType = this.constants.TIMER_TYPES.SHORT_BREAK;
        nextDuration = preset.shortBreak;
      } else {
        nextType = this.constants.TIMER_TYPES.LONG_BREAK;
        nextDuration = preset.longBreak;
      }
    } else {
      // 휴식 후 → 다음 사이클 또는 완료
      if (
        timer.type === this.constants.TIMER_TYPES.LONG_BREAK ||
        timer.currentCycle >= preset.cycles
      ) {
        // 뽀모도로 세트 완료
        this.activeTimers.delete(userId);
        logger.info(`🎉 뽀모도로 세트 완료: ${userId}`);
        return;
      }

      // 다음 집중 사이클
      nextType = this.constants.TIMER_TYPES.FOCUS;
      nextDuration = preset.focus;
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

    this.activeTimers.set(userId, newTimer);
    this.startTimerInterval(userId);

    logger.info(`🔄 뽀모도로 전환: ${userId} - ${nextType}`);
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
   * 🔔 완료 알림 전송 (도우미 메서드)
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

  /**
   * 메모리 타이머 정리
   */
  cleanupUserTimer(userId) {
    this.clearTimerInterval(userId);
    this.activeTimers.delete(userId);
    logger.debug(`🧹 사용자 ${userId}의 타이머 메모리 정리 완료`);
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

  /**
   * 시간 포맷팅
   */
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

  /**
   * 타입별 시간 가져오기
   */
  // 타입별 시간 가져오기 메서드도 확인
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

  /**
   * 타입 표시 텍스트
   */
  getTypeDisplay(type) {
    const displays = {
      focus: "집중",
      shortBreak: "짧은 휴식",
      longBreak: "긴 휴식",
      custom: "커스텀"
    };
    return displays[type] || type;
  }

  /**
   * 상태 표시 텍스트
   */
  getStatusDisplay(status) {
    const displays = {
      running: "실행 중",
      paused: "일시정지",
      stopped: "중지됨",
      completed: "완료됨"
    };
    return displays[status] || status;
  }

  /**
   * 뱃지 계산
   */
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

  /**
   * 기본 통계
   */
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
