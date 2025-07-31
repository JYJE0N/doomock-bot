// src/modules/TimerModule.js - 🍅 뽀모도로 타이머 모듈 (올바른 SoC 버전)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 모듈 (SoC 준수 + Mongoose)
 *
 * 🎯 새로운 콜백 체계:
 * - timer:menu → 메인 메뉴 (현재 타이머 상태)
 * - timer:start → 집중 타이머 시작
 * - timer:start:focus → 집중 타이머 시작 (params="focus")
 * - timer:start:break → 휴식 타이머 시작 (params="break")
 * - timer:start:25 → 25분 커스텀 타이머 (params="25")
 * - timer:pause → 타이머 일시정지
 * - timer:resume → 타이머 재개
 * - timer:stop → 타이머 중지
 * - timer:settings → 설정 메뉴
 * - timer:settings:focus → 집중 시간 설정 (params="focus")
 * - timer:stats → 통계 보기
 *
 * ✅ SoC 준수:
 * - 모듈: 순수 데이터만 반환 (UI 코드 없음!)
 * - 서비스: Mongoose 기반 세션 데이터 처리
 * - 렌더러: UI 생성 담당
 * - NavigationHandler: 라우팅 담당
 * - 실시간 타이머: 메모리 기반 관리
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // Mongoose 기반 서비스
    this.timerService = null;

    // 모듈 설정 (환경변수 우선)
    this.config = {
      // 타이머 기본 설정 (분 단위)
      focusDuration: parseInt(process.env.TIMER_FOCUS_DURATION) || 25,
      shortBreakDuration: parseInt(process.env.TIMER_SHORT_BREAK) || 5,
      longBreakDuration: parseInt(process.env.TIMER_LONG_BREAK) || 15,
      sessionsBeforeLongBreak:
        parseInt(process.env.TIMER_SESSIONS_BEFORE_LONG_BREAK) || 4,

      // 기능 설정
      enableNotifications: process.env.TIMER_NOTIFICATIONS !== "false",
      enableStats: process.env.TIMER_STATS !== "false",
      autoStartBreak: process.env.TIMER_AUTO_START_BREAK === "true",
      updateInterval: parseInt(process.env.TIMER_UPDATE_INTERVAL) || 1000, // ms
      saveProgressInterval: parseInt(process.env.TIMER_SAVE_INTERVAL) || 300, // 5분

      ...options.config,
    };

    // 타이머 타입 정의
    this.timerTypes = {
      focus: {
        duration: this.config.focusDuration,
        label: "집중 시간",
        emoji: "🍅",
        color: "#FF6B6B",
      },
      short_break: {
        duration: this.config.shortBreakDuration,
        label: "짧은 휴식",
        emoji: "☕",
        color: "#4ECDC4",
      },
      long_break: {
        duration: this.config.longBreakDuration,
        label: "긴 휴식",
        emoji: "🌴",
        color: "#45B7D1",
      },
      custom: {
        duration: 0, // 동적 설정
        label: "커스텀",
        emoji: "⏱️",
        color: "#96CEB4",
      },
    };

    // 실시간 타이머 상태 (메모리 기반)
    this.activeTimers = new Map();
    this.timerIntervals = new Map();

    logger.info("🍅 TimerModule 생성됨 (SoC + Mongoose)", {
      version: "4.0.0-soc",
      config: this.config,
    });
  }

  /**
   * 🎯 모듈 초기화 (Mongoose 서비스 연결)
   */
  async onInitialize() {
    try {
      logger.info("🍅 TimerModule 초기화 시작 (Mongoose)...");

      // ServiceBuilder에서 TimerService 가져오기
      if (this.serviceBuilder) {
        this.timerService = await this.serviceBuilder.getOrCreate("timer", {
          config: this.config,
        });
      }

      if (!this.timerService) {
        logger.warn("TimerService 없음 - 기본 기능만 제공");
      }

      // 활성 타이머 복구 (서버 재시작 시)
      await this.recoverActiveTimers();

      logger.success("✅ TimerModule 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (단순화된 버전)
   */
  setupActions() {
    this.registerActions({
      // 🏠 메인 메뉴
      menu: this.handleTimerMenu,

      // ▶️ 타이머 제어
      start: this.handleStartTimer,
      pause: this.handlePauseTimer,
      resume: this.handleResumeTimer,
      stop: this.handleStopTimer,

      // 📊 상태 및 통계
      status: this.handleTimerStatus,
      stats: this.handleTimerStats,
      history: this.handleTimerHistory,

      // ⚙️ 설정 (통합된 단일 액션)
      settings: this.handleTimerSettings,

      // 🔄 세션 관리
      skip: this.handleSkipSession,
      next: this.handleNextSession,

      // ❓ 도움말
      help: this.showHelp,
    });

    logger.info(`✅ TimerModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 모듈 키워드 확인
    const keywords = [
      "뽀모도로",
      "타이머",
      "집중",
      "포모도로",
      "pomodoro",
      "timer",
    ];

    if (this.isModuleMessage(text, keywords)) {
      // ✅ NavigationHandler에게 위임 (UI 생성은 하지 않음!)
      if (this.moduleManager?.navigationHandler) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          chatId,
          "timer"
        );
        return true;
      }
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 데이터만 반환!) =====

  /**
   * 🏠 타이머 메뉴 처리 (메인 화면)
   *
   * ✅ SoC: 순수 데이터만 반환, UI는 TimerRenderer가 담당
   */
  async handleTimerMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏠 타이머 메뉴 처리`, {
      userId,
      userName,
    });

    try {
      // 현재 타이머 상태 확인
      const activeTimer = this.activeTimers.get(userId);
      const todayStats = await this.getTodayStats(userId);

      // ✅ 순수 데이터만 반환 (UI 코드 없음!)
      return {
        type: "menu",
        module: "timer",
        data: {
          userName,
          activeTimer: activeTimer
            ? this.getTimerDisplayData(activeTimer)
            : null,
          stats: todayStats,
          timerTypes: this.timerTypes,
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 메뉴 조회 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ▶️ 타이머 시작 처리
   *
   * ✅ SoC: 비즈니스 로직만 처리, UI는 TimerRenderer가 담당
   */
  async handleStartTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`▶️ 타이머 시작 처리`, {
      userId,
      userName,
      params,
    });

    try {
      // 이미 실행 중인 타이머 확인
      if (this.activeTimers.has(userId)) {
        const currentTimer = this.activeTimers.get(userId);
        return {
          type: "timer_already_running",
          module: "timer",
          data: {
            currentTimer: this.getTimerDisplayData(currentTimer),
            message: "이미 타이머가 실행 중입니다!",
          },
        };
      }

      // 타이머 타입 결정
      const timerConfig = this.determineTimerType(params);

      // Mongoose 서비스에 세션 저장
      let session = null;
      if (this.timerService) {
        session = await this.timerService.startSession(userId, {
          userName,
          type: timerConfig.type,
          duration: timerConfig.duration,
          startedAt: TimeHelper.now().toISOString(),
        });
      }

      // 메모리 타이머 생성 및 시작
      const timer = this.createTimer(userId, timerConfig, session?._id);
      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`✅ 타이머 시작 성공`, {
        userId,
        sessionId: session?._id,
        type: timerConfig.type,
        duration: timerConfig.duration,
      });

      // ✅ 순수 데이터만 반환
      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.getTimerDisplayData(timer),
          session: session,
          config: timerConfig,
          message: `${timerConfig.emoji} ${timerConfig.label} 시작!`,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 시작 처리 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머를 시작할 수 없습니다.",
      };
    }
  }

  /**
   * ⏸️ 타이머 일시정지 처리
   *
   * ✅ SoC: 비즈니스 로직만 처리, UI는 TimerRenderer가 담당
   */
  async handlePauseTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`⏸️ 타이머 일시정지 처리`, { userId });

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
          },
        };
      }

      if (timer.isPaused) {
        return {
          type: "already_paused",
          module: "timer",
          data: {
            timer: this.getTimerDisplayData(timer),
            message: "타이머가 이미 일시정지되어 있습니다.",
          },
        };
      }

      // 타이머 일시정지
      this.stopTimerInterval(userId);
      timer.isPaused = true;
      timer.pausedAt = Date.now();

      // Mongoose 서비스에 상태 업데이트
      if (this.timerService && timer.sessionId) {
        await this.timerService.updateSession(timer.sessionId, {
          status: "paused",
          pausedAt: timer.pausedAt,
        });
      }

      logger.info(`✅ 타이머 일시정지 성공`, {
        userId,
        sessionId: timer.sessionId,
      });

      // ✅ 순수 데이터만 반환
      return {
        type: "timer_paused",
        module: "timer",
        data: {
          timer: this.getTimerDisplayData(timer),
          message: "⏸️ 타이머가 일시정지되었습니다.",
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 일시정지 처리 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머를 일시정지할 수 없습니다.",
      };
    }
  }

  /**
   * ▶️ 타이머 재개 처리
   *
   * ✅ SoC: 비즈니스 로직만 처리, UI는 TimerRenderer가 담당
   */
  async handleResumeTimer(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`▶️ 타이머 재개 처리`, { userId });

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer || !timer.isPaused) {
        return {
          type: "no_paused_timer",
          module: "timer",
          data: {
            message: "일시정지된 타이머가 없습니다.",
          },
        };
      }

      // 타이머 재개
      timer.isPaused = false;
      timer.pausedAt = null;
      this.startTimerInterval(userId);

      // Mongoose 서비스에 상태 업데이트
      if (this.timerService && timer.sessionId) {
        await this.timerService.updateSession(timer.sessionId, {
          status: "running",
          resumedAt: Date.now(),
        });
      }

      logger.info(`✅ 타이머 재개 성공`, {
        userId,
        sessionId: timer.sessionId,
      });

      // ✅ 순수 데이터만 반환
      return {
        type: "timer_resumed",
        module: "timer",
        data: {
          timer: this.getTimerDisplayData(timer),
          message: "▶️ 타이머가 재개되었습니다.",
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 재개 처리 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머를 재개할 수 없습니다.",
      };
    }
  }

  /**
   * ⏹️ 타이머 중지 처리
   *
   * ✅ SoC: 비즈니스 로직만 처리, UI는 TimerRenderer가 담당
   */
  async handleStopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`⏹️ 타이머 중지 처리`, { userId });

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
          },
        };
      }

      // 타이머 정리
      this.stopTimerInterval(userId);
      this.activeTimers.delete(userId);

      // Mongoose 서비스에 세션 중지 처리
      let stoppedSession = null;
      if (this.timerService && timer.sessionId) {
        stoppedSession = await this.timerService.stopSession(timer.sessionId, {
          stoppedAt: Date.now(),
          remainingTime: timer.remainingTime,
          reason: "user_stopped",
        });
      }

      const elapsedTime = timer.duration * 60 - timer.remainingTime;

      logger.info(`✅ 타이머 중지 성공`, {
        userId,
        sessionId: timer.sessionId,
        elapsedTime,
      });

      // ✅ 순수 데이터만 반환
      return {
        type: "timer_stopped",
        module: "timer",
        data: {
          stoppedSession,
          elapsedTime,
          totalTime: timer.duration * 60,
          completionRate: Math.round(
            (elapsedTime / (timer.duration * 60)) * 100
          ),
          message: "⏹️ 타이머가 중지되었습니다.",
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 중지 처리 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머를 중지할 수 없습니다.",
      };
    }
  }

  /**
   * 📊 타이머 상태 처리
   *
   * ✅ SoC: 상태 데이터만 반환, UI는 TimerRenderer가 담당
   */
  async handleTimerStatus(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const activeTimer = this.activeTimers.get(userId);
      const recentSessions = await this.getRecentSessions(userId, 5);

      // ✅ 순수 데이터만 반환
      return {
        type: "status",
        module: "timer",
        data: {
          activeTimer: activeTimer
            ? this.getTimerDisplayData(activeTimer)
            : null,
          recentSessions,
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 상태 조회 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머 상태를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📈 타이머 통계 처리
   *
   * ✅ SoC: 통계 데이터만 반환, UI는 TimerRenderer가 담당
   */
  async handleTimerStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const todayStats = await this.getTodayStats(userId);
      const weekStats = await this.getWeekStats(userId);
      const totalStats = await this.getTotalStats(userId);

      // ✅ 순수 데이터만 반환
      return {
        type: "stats",
        module: "timer",
        data: {
          userName,
          today: todayStats,
          week: weekStats,
          total: totalStats,
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("타이머 통계 조회 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "타이머 통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ⚙️ 타이머 설정 처리 (통합된 단일 액션!)
   *
   * ✅ SoC: 설정 데이터만 반환, UI는 TimerRenderer가 담당
   */
  async handleTimerSettings(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`⚙️ 타이머 설정 처리`, {
      userId,
      params,
    });

    try {
      // 파라미터가 없으면 설정 메뉴 표시
      if (!params || params.trim() === "") {
        return {
          type: "settings_menu",
          module: "timer",
          data: {
            config: this.config,
            timerTypes: this.timerTypes,
            userSettings: await this.getUserSettings(userId),
          },
        };
      }

      // 파라미터에 따른 설정 처리
      return await this.handleSpecificSetting(userId, params);
    } catch (error) {
      logger.error("타이머 설정 처리 실패:", error);
      return {
        type: "error",
        module: "timer",
        message: "설정을 처리할 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   *
   * ✅ SoC: 도움말 데이터만 반환, UI는 TimerRenderer가 담당
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
      data: {
        config: this.config,
        timerTypes: this.timerTypes,
        features: {
          start: "뽀모도로 타이머 시작",
          pause: "타이머 일시정지/재개",
          stop: "타이머 중지",
          stats: "통계 및 기록 확인",
          settings: "설정 변경",
        },
        keywords: ["뽀모도로", "타이머", "집중", "포모도로", "pomodoro"],
        tips: [
          "25분 집중 + 5분 휴식이 기본입니다",
          "4번의 집중 후 긴 휴식(15분)을 권장합니다",
          "통계를 통해 생산성을 확인하세요",
        ],
      },
    };
  }

  // ===== 🛠️ 타이머 관리 메서드들 =====

  /**
   * 🎯 타이머 타입 결정
   */
  determineTimerType(params) {
    if (!params || params.trim() === "") {
      // 기본: 집중 타이머
      return {
        type: "focus",
        duration: this.config.focusDuration,
        label: this.timerTypes.focus.label,
        emoji: this.timerTypes.focus.emoji,
      };
    }

    // 정의된 타입 확인
    if (this.timerTypes[params]) {
      return {
        type: params,
        duration: this.timerTypes[params].duration,
        label: this.timerTypes[params].label,
        emoji: this.timerTypes[params].emoji,
      };
    }

    // 커스텀 시간 (숫자인 경우)
    const customMinutes = parseInt(params);
    if (!isNaN(customMinutes) && customMinutes > 0 && customMinutes <= 120) {
      return {
        type: "custom",
        duration: customMinutes,
        label: `${customMinutes}분 타이머`,
        emoji: this.timerTypes.custom.emoji,
      };
    }

    // 기본값으로 fallback
    return {
      type: "focus",
      duration: this.config.focusDuration,
      label: this.timerTypes.focus.label,
      emoji: this.timerTypes.focus.emoji,
    };
  }

  /**
   * ⏱️ 메모리 타이머 생성
   */
  createTimer(userId, timerConfig, sessionId = null) {
    return {
      userId,
      sessionId,
      type: timerConfig.type,
      duration: timerConfig.duration, // 분
      remainingTime: timerConfig.duration * 60, // 초
      startTime: Date.now(),
      isPaused: false,
      pausedAt: null,
      label: timerConfig.label,
      emoji: timerConfig.emoji,
    };
  }

  /**
   * ▶️ 타이머 인터벌 시작
   */
  startTimerInterval(userId) {
    // 기존 인터벌 정리
    this.stopTimerInterval(userId);

    // 새 인터벌 시작
    const interval = setInterval(() => {
      this.tickTimer(userId);
    }, this.config.updateInterval);

    this.timerIntervals.set(userId, interval);
  }

  /**
   * ⏹️ 타이머 인터벌 중지
   */
  stopTimerInterval(userId) {
    const interval = this.timerIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * ⏱️ 타이머 tick 처리
   */
  async tickTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.isPaused) return;

    timer.remainingTime--;

    // 주기적으로 진행 상황 저장 (Mongoose)
    if (
      timer.remainingTime % this.config.saveProgressInterval === 0 &&
      this.timerService &&
      timer.sessionId
    ) {
      await this.timerService.updateProgress(timer.sessionId, {
        remainingTime: timer.remainingTime,
      });
    }

    // 타이머 완료
    if (timer.remainingTime <= 0) {
      await this.completeTimer(userId);
    }
  }

  /**
   * ✅ 타이머 완료 처리
   */
  async completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    try {
      // 타이머 정리
      this.stopTimerInterval(userId);
      this.activeTimers.delete(userId);

      // Mongoose 서비스에 세션 완료 처리
      let completedSession = null;
      if (this.timerService && timer.sessionId) {
        completedSession = await this.timerService.completeSession(
          timer.sessionId
        );
      }

      logger.info(`✅ 타이머 완료`, {
        userId,
        sessionId: timer.sessionId,
        type: timer.type,
        duration: timer.duration,
      });

      // ✅ 알림은 별도 서비스나 외부에서 처리 (SoC)
      // UI는 TimerRenderer에서 완료 알림을 표시
      if (this.config.enableNotifications) {
        // 여기서는 데이터만 저장하고, 실제 알림은 외부에서 처리
        await this.saveCompletionNotification(userId, timer, completedSession);
      }
    } catch (error) {
      logger.error("타이머 완료 처리 오류:", error);
    }
  }

  /**
   * 🔄 활성 타이머 복구 (서버 재시작 시)
   */
  async recoverActiveTimers() {
    try {
      if (!this.timerService) return;

      // 미완료된 세션들 조회
      const activeSessions = await this.timerService.getActiveSessions();

      for (const session of activeSessions) {
        const elapsedTime = Math.floor(
          (Date.now() - new Date(session.startedAt).getTime()) / 1000
        );
        const remainingTime = session.duration * 60 - elapsedTime;

        if (remainingTime > 0) {
          const timerConfig =
            this.timerTypes[session.type] || this.timerTypes.focus;
          const timer = {
            userId: session.userId,
            sessionId: session._id,
            type: session.type,
            duration: session.duration,
            remainingTime,
            startTime: session.startedAt,
            isPaused: session.status === "paused",
            pausedAt: session.pausedAt,
            label: timerConfig.label,
            emoji: timerConfig.emoji,
          };

          this.activeTimers.set(session.userId, timer);

          if (!timer.isPaused) {
            this.startTimerInterval(session.userId);
          }
        }
      }

      logger.info(`🔄 ${activeSessions.length}개의 활성 타이머 복구 완료`);
    } catch (error) {
      logger.error("활성 타이머 복구 실패:", error);
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 📊 타이머 표시용 데이터 변환
   */
  getTimerDisplayData(timer) {
    const minutes = Math.floor(timer.remainingTime / 60);
    const seconds = timer.remainingTime % 60;
    const progress =
      ((timer.duration * 60 - timer.remainingTime) / (timer.duration * 60)) *
      100;

    return {
      ...timer,
      displayTime: `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`,
      progress: Math.round(progress),
      isRunning: !timer.isPaused,
      timeElapsed: timer.duration * 60 - timer.remainingTime,
    };
  }

  /**
   * 📊 오늘 통계 조회
   */
  async getTodayStats(userId) {
    try {
      if (this.timerService) {
        return await this.timerService.getTodayStats(userId);
      }

      // 폴백: 기본 통계
      return {
        sessionsCompleted: 0,
        totalFocusTime: 0,
        totalBreakTime: 0,
        averageSessionLength: 0,
      };
    } catch (error) {
      logger.error("오늘 통계 조회 실패:", error);
      return { sessionsCompleted: 0, totalFocusTime: 0 };
    }
  }

  /**
   * 📊 주간 통계 조회
   */
  async getWeekStats(userId) {
    try {
      if (this.timerService) {
        return await this.timerService.getWeekStats(userId);
      }

      return { weeklyTotal: 0, dailyAverage: 0 };
    } catch (error) {
      logger.error("주간 통계 조회 실패:", error);
      return { weeklyTotal: 0, dailyAverage: 0 };
    }
  }

  /**
   * 📊 전체 통계 조회
   */
  async getTotalStats(userId) {
    try {
      if (this.timerService) {
        return await this.timerService.getTotalStats(userId);
      }

      return { totalSessions: 0, totalHours: 0 };
    } catch (error) {
      logger.error("전체 통계 조회 실패:", error);
      return { totalSessions: 0, totalHours: 0 };
    }
  }

  /**
   * 📋 최근 세션 조회
   */
  async getRecentSessions(userId, limit = 5) {
    try {
      if (this.timerService) {
        return await this.timerService.getRecentSessions(userId, limit);
      }

      return [];
    } catch (error) {
      logger.error("최근 세션 조회 실패:", error);
      return [];
    }
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.timerService,
      activeTimersCount: this.activeTimers.size,
      activeIntervalsCount: this.timerIntervals.size,
      config: {
        focusDuration: this.config.focusDuration,
        shortBreakDuration: this.config.shortBreakDuration,
        longBreakDuration: this.config.longBreakDuration,
        enableNotifications: this.config.enableNotifications,
        enableStats: this.config.enableStats,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 모든 활성 타이머 정리
      for (const [userId, timer] of this.activeTimers.entries()) {
        this.stopTimerInterval(userId);

        // 세션 일시정지 처리
        if (this.timerService && timer.sessionId) {
          try {
            await this.timerService.pauseSession(timer.sessionId, {
              pausedAt: Date.now(),
              remainingTime: timer.remainingTime,
              reason: "system_cleanup",
            });
          } catch (error) {
            logger.error(
              `타이머 정리 중 세션 일시정지 실패: ${timer.sessionId}`,
              error
            );
          }
        }
      }

      this.activeTimers.clear();
      this.timerIntervals.clear();

      await super.cleanup();
      logger.info("✅ TimerModule 정리 완료 (SoC + Mongoose)");
    } catch (error) {
      logger.error("❌ TimerModule 정리 실패:", error);
    }
  }

  // 아직 구현되지 않은 메서드들 (추후 구현)
  async handleTimerHistory(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return {
      type: "info",
      message: "타이머 기록 기능은 곧 추가될 예정입니다.",
    };
  }

  async handleSkipSession(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return {
      type: "info",
      message: "세션 건너뛰기 기능은 곧 추가될 예정입니다.",
    };
  }

  async handleNextSession(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return { type: "info", message: "다음 세션 기능은 곧 추가될 예정입니다." };
  }

  async handleSpecificSetting(userId, settingType) {
    return {
      type: `setting_${settingType}`,
      module: "timer",
      data: {
        settingType,
        message: "이 설정 기능은 곧 추가될 예정입니다.",
      },
    };
  }

  async getUserSettings(userId) {
    return {
      focusDuration: this.config.focusDuration,
      shortBreakDuration: this.config.shortBreakDuration,
      notifications: this.config.enableNotifications,
    };
  }

  async saveCompletionNotification(userId, timer, session) {
    // TODO: 완료 알림 데이터 저장 (외부 알림 시스템에서 사용)
    logger.debug(`완료 알림 데이터 저장: ${timer.type} 타이머 완료`);
  }
}

module.exports = TimerModule;
