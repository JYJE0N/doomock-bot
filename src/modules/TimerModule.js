// src/modules/TimerModule.js - 뽀모도로 타이머 모듈

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 모듈
 *
 * 🎯 핵심 기능:
 * - 25분 집중 / 5분 휴식 사이클
 * - 타이머 시작/일시정지/종료
 * - 실시간 진행 상황 표시
 * - 세션 통계 및 기록
 * - 알림 기능
 *
 * ✅ SoC 준수:
 * - 모듈: 비즈니스 로직과 액션 처리
 * - 서비스: 데이터 관리 및 타이머 상태 관리
 * - 렌더러: UI 렌더링
 * - 데이터베이스: 세션 기록 저장
 */
class TimerModule extends BaseModule {
  /**
   * 🏗️ 생성자 - 표준 매개변수 구조 준수
   */
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ServiceBuilder에서 서비스 주입
    this.serviceBuilder = options.serviceBuilder || null;
    this.timerService = null;

    // 모듈 설정
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

      ...options.config,
    };

    // 실시간 타이머 상태 (메모리)
    this.activeTimers = new Map();

    logger.info("🍅 TimerModule 생성됨", {
      hasServiceBuilder: !!this.serviceBuilder,
      config: this.config,
    });
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🍅 TimerModule 초기화 시작...");

      // ServiceBuilder를 통한 서비스 생성
      if (this.serviceBuilder) {
        this.timerService = await this.serviceBuilder.getOrCreate("timer", {
          config: this.config,
        });
      }

      // 액션 설정 - 중요!
      this.setupActions();

      // 타이머 복구 (서버 재시작 시)
      await this.recoverActiveTimers();

      logger.success("✅ TimerModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 메인 액션
      menu: this.showMenu.bind(this),
      start: this.startTimer.bind(this),
      pause: this.pauseTimer.bind(this),
      resume: this.resumeTimer.bind(this),
      stop: this.stopTimer.bind(this),

      // 상태 및 통계
      status: this.showStatus.bind(this),
      stats: this.showStats.bind(this),
      history: this.showHistory.bind(this),

      // 설정
      settings: this.showSettings.bind(this),
      "settings:focus": this.updateFocusDuration.bind(this),
      "settings:break": this.updateBreakDuration.bind(this),
      "settings:notifications": this.toggleNotifications.bind(this),

      // 세션 관리
      skip: this.skipCurrent.bind(this),
      next: this.nextSession.bind(this),

      // 도움말
      help: this.showHelp.bind(this),
    });
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const keywords = ["뽀모도로", "타이머", "집중", "포모도로", "pomodoro"];
    if (this.isModuleMessage(text, keywords)) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "timer"
      );
      return true;
    }

    return false;
  }

  // ===== 📋 메인 액션들 =====

  /**
   * 📋 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 현재 타이머 상태 확인
      const activeTimer = this.activeTimers.get(userId);
      const stats = await this.timerService.getTodayStats(userId);

      return {
        type: "menu",
        module: "timer",
        data: {
          activeTimer,
          stats,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("타이머 메뉴 오류:", error);
      return { type: "error", message: "메뉴를 불러올 수 없습니다." };
    }
  }

  /**
   * ▶️ 타이머 시작
   */
  async startTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      // 이미 실행 중인 타이머 확인
      if (this.activeTimers.has(userId)) {
        return {
          type: "info",
          message: "이미 타이머가 실행 중입니다!",
        };
      }

      // 새 세션 시작
      const session = await this.timerService.startSession(userId, {
        userName,
        type: "focus",
        duration: this.config.focusDuration,
      });

      // 타이머 시작
      const timer = this.createTimer(userId, session);
      this.activeTimers.set(userId, timer);

      return {
        type: "timer_started",
        module: "timer",
        data: {
          session,
          remainingTime: timer.remainingTime,
          type: "focus",
        },
      };
    } catch (error) {
      logger.error("타이머 시작 오류:", error);
      return { type: "error", message: "타이머를 시작할 수 없습니다." };
    }
  }

  /**
   * ⏸️ 타이머 일시정지
   */
  async pauseTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        return {
          type: "info",
          message: "실행 중인 타이머가 없습니다.",
        };
      }

      // 타이머 일시정지
      clearInterval(timer.interval);
      timer.isPaused = true;
      timer.pausedAt = Date.now();

      // 서비스에 상태 업데이트
      await this.timerService.updateSession(timer.sessionId, {
        status: "paused",
        pausedAt: timer.pausedAt,
      });

      return {
        type: "timer_paused",
        module: "timer",
        data: {
          sessionId: timer.sessionId,
          remainingTime: timer.remainingTime,
        },
      };
    } catch (error) {
      logger.error("타이머 일시정지 오류:", error);
      return { type: "error", message: "타이머를 일시정지할 수 없습니다." };
    }
  }

  /**
   * ▶️ 타이머 재개
   */
  async resumeTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer || !timer.isPaused) {
        return {
          type: "info",
          message: "일시정지된 타이머가 없습니다.",
        };
      }

      // 타이머 재개
      timer.isPaused = false;
      timer.resumedAt = Date.now();

      // 새 interval 시작
      timer.interval = setInterval(() => {
        this.tickTimer(bot, userId);
      }, 1000);

      // 서비스에 상태 업데이트
      await this.timerService.updateSession(timer.sessionId, {
        status: "active",
        resumedAt: timer.resumedAt,
      });

      return {
        type: "timer_resumed",
        module: "timer",
        data: {
          sessionId: timer.sessionId,
          remainingTime: timer.remainingTime,
        },
      };
    } catch (error) {
      logger.error("타이머 재개 오류:", error);
      return { type: "error", message: "타이머를 재개할 수 없습니다." };
    }
  }

  /**
   * ⏹️ 타이머 중지
   */
  async stopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        return {
          type: "info",
          message: "실행 중인 타이머가 없습니다.",
        };
      }

      // 타이머 정리
      clearInterval(timer.interval);
      this.activeTimers.delete(userId);

      // 세션 종료
      const summary = await this.timerService.endSession(timer.sessionId, {
        completedDuration: timer.duration - timer.remainingTime,
        wasCompleted: false,
      });

      return {
        type: "timer_stopped",
        module: "timer",
        data: {
          summary,
        },
      };
    } catch (error) {
      logger.error("타이머 중지 오류:", error);
      return { type: "error", message: "타이머를 중지할 수 없습니다." };
    }
  }

  // ===== 📊 상태 및 통계 =====

  /**
   * 📊 현재 상태 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const timer = this.activeTimers.get(userId);
      const currentSession = timer
        ? await this.timerService.getSession(timer.sessionId)
        : null;
      const todayStats = await this.timerService.getTodayStats(userId);

      return {
        type: "status",
        module: "timer",
        data: {
          activeTimer: timer,
          currentSession,
          todayStats,
        },
      };
    } catch (error) {
      logger.error("상태 조회 오류:", error);
      return { type: "error", message: "상태를 조회할 수 없습니다." };
    }
  }

  /**
   * 📈 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const period = params.period || "week"; // today, week, month
      const stats = await this.timerService.getStats(userId, period);

      return {
        type: "stats",
        module: "timer",
        data: {
          period,
          stats,
        },
      };
    } catch (error) {
      logger.error("통계 조회 오류:", error);
      return { type: "error", message: "통계를 조회할 수 없습니다." };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
    };
  }

  /**
   * 📜 히스토리 표시
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const page = params.page || 0;
      const limit = 20;
      const history = await this.timerService.getHistory(userId, {
        skip: page * limit,
        limit,
      });

      return {
        type: "history",
        module: "timer",
        data: history,
      };
    } catch (error) {
      logger.error("히스토리 조회 오류:", error);
      return { type: "error", message: "히스토리를 조회할 수 없습니다." };
    }
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const settings = await this.timerService.getUserSettings(userId);

      return {
        type: "settings",
        module: "timer",
        data: { settings },
      };
    } catch (error) {
      logger.error("설정 조회 오류:", error);
      return { type: "error", message: "설정을 조회할 수 없습니다." };
    }
  }

  /**
   * ⏭️ 현재 세션 건너뛰기
   */
  async skipCurrent(bot, callbackQuery, subAction, params, moduleManager) {
    // TODO: 구현
    return {
      type: "info",
      message: "이 기능은 아직 준비 중입니다.",
    };
  }

  /**
   * ▶️ 다음 세션 시작
   */
  async nextSession(bot, callbackQuery, subAction, params, moduleManager) {
    // TODO: 구현
    return {
      type: "info",
      message: "이 기능은 아직 준비 중입니다.",
    };
  }

  /**
   * ⏱️ 집중 시간 설정
   */
  async updateFocusDuration(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // TODO: 구현
    return {
      type: "info",
      message: "이 기능은 아직 준비 중입니다.",
    };
  }

  /**
   * ☕ 휴식 시간 설정
   */
  async updateBreakDuration(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // TODO: 구현
    return {
      type: "info",
      message: "이 기능은 아직 준비 중입니다.",
    };
  }

  /**
   * 🔔 알림 설정 토글
   */
  async toggleNotifications(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // TODO: 구현
    return {
      type: "info",
      message: "이 기능은 아직 준비 중입니다.",
    };
  }

  /**
   * 🌴 휴식 타이머 시작
   */
  async startBreakTimer(bot, userId, summary) {
    // TODO: 구현
    logger.info("휴식 타이머 시작 기능은 아직 구현되지 않았습니다.");
  }

  // ===== ⏱️ 타이머 관리 =====

  /**
   * 타이머 생성
   */
  createTimer(userId, session) {
    const timer = {
      userId,
      sessionId: session._id,
      type: session.type,
      duration: session.duration * 60, // 분 -> 초
      remainingTime: session.duration * 60,
      startTime: Date.now(),
      isPaused: false,
      interval: null,
    };

    // 1초마다 tick
    timer.interval = setInterval(() => {
      this.tickTimer(this.bot, userId);
    }, 1000);

    return timer;
  }

  /**
   * 타이머 tick 처리
   */
  async tickTimer(bot, userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.isPaused) return;

    timer.remainingTime--;

    // 5분마다 진행 상황 저장
    if (timer.remainingTime % 300 === 0) {
      await this.timerService.updateProgress(timer.sessionId, {
        remainingTime: timer.remainingTime,
      });
    }

    // 타이머 완료
    if (timer.remainingTime <= 0) {
      await this.completeTimer(bot, userId);
    }
  }

  /**
   * 타이머 완료 처리
   */
  async completeTimer(bot, userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    try {
      // 타이머 정리
      clearInterval(timer.interval);
      this.activeTimers.delete(userId);

      // 세션 완료 처리
      const summary = await this.timerService.completeSession(timer.sessionId);

      // 알림 전송
      if (this.config.enableNotifications) {
        await this.sendCompletionNotification(bot, userId, timer.type, summary);
      }

      // 자동으로 휴식 시작 (설정된 경우)
      if (this.config.autoStartBreak && timer.type === "focus") {
        await this.startBreakTimer(bot, userId, summary);
      }
    } catch (error) {
      logger.error("타이머 완료 처리 오류:", error);
    }
  }

  /**
   * 완료 알림 전송
   */
  async sendCompletionNotification(bot, userId, type, summary) {
    const message =
      type === "focus"
        ? `🍅 집중 시간이 끝났습니다!\n\n오늘 완료한 세션: ${summary.todayCount}개`
        : `☕ 휴식 시간이 끝났습니다!\n\n다시 집중할 시간입니다!`;

    await bot.sendMessage(userId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⏸️ 다음 시작", callback_data: "timer:next" },
            { text: "📊 통계 보기", callback_data: "timer:stats" },
          ],
        ],
      },
    });
  }

  /**
   * 활성 타이머 복구
   */
  async recoverActiveTimers() {
    try {
      // TimerService가 메모리 기반일 때는 복구할 필요 없음
      if (!this.timerService) {
        logger.warn("TimerService가 초기화되지 않았습니다.");
        return;
      }

      const activeSessions = await this.timerService.getActiveSessions();

      for (const session of activeSessions) {
        // 남은 시간 계산
        const elapsedTime = Math.floor(
          (Date.now() - new Date(session.startedAt).getTime()) / 1000
        );
        const remainingTime = session.duration * 60 - elapsedTime;

        if (remainingTime > 0) {
          const timer = {
            userId: session.userId,
            sessionId: session._id,
            type: session.type,
            duration: session.duration * 60,
            remainingTime,
            startTime: session.startedAt,
            isPaused: session.status === "paused",
            interval: null,
          };

          if (!timer.isPaused) {
            timer.interval = setInterval(() => {
              this.tickTimer(this.bot, session.userId);
            }, 1000);
          }

          this.activeTimers.set(session.userId, timer);
        }
      }

      logger.info(`🔄 ${activeSessions.length}개의 활성 타이머 복구 완료`);
    } catch (error) {
      logger.error("타이머 복구 실패:", error);
      // 복구 실패해도 모듈은 계속 작동하도록 함
    }
  }

  /**
   * 모듈 종료 시 정리
   */
  async cleanup() {
    // 모든 활성 타이머 정리
    for (const [userId, timer] of this.activeTimers) {
      clearInterval(timer.interval);
      await this.timerService.pauseSession(timer.sessionId);
    }
    this.activeTimers.clear();

    logger.info("🍅 TimerModule 정리 완료");
  }
  /**
   * 📊 모듈 상태 정보 (추가)
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceStatus: this.timerService ? "Ready" : "Not Connected",
      activeTimers: this.activeTimers.size,
      stats: this.stats,
    };
  }
}

module.exports = TimerModule;
