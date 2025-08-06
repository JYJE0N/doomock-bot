// src/modules/TimerModule.js - 🍅 완성된 타이머 모듈 (SoC 완벽 준수)

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 (표준 구조 준수)
 *
 * ✅ SoC 원칙:
 * - 모듈: 비즈니스 로직만 (타이머 관리, 상태 변경)
 * - 서비스: 데이터 처리 (DB 조회, 세션 저장)
 * - 렌더러: UI 생성 (키보드, 메시지 포맷)
 *
 * ✅ 중복 방지:
 * - 사용자당 1개 타이머만 허용
 * - 새 타이머 시작시 기존 타이머 자동 정리
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.moduleName = moduleName || "timer";

    // 🔧 서비스 참조
    this.timerService = null;
    this.notificationService = null;

    // 📊 상태 관리 - 사용자당 1개만!
    this.activeTimers = new Map(); // userId -> timer
    this.timerIntervals = new Map(); // userId -> intervalId

    // ⚙️ 설정
    this.config = {
      // 기본 타이머 설정
      focusDuration: parseInt(process.env.TIMER_FOCUS_DURATION) || 25,
      shortBreak: parseInt(process.env.TIMER_SHORT_BREAK) || 5,
      longBreak: parseInt(process.env.TIMER_LONG_BREAK) || 15,
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120,
      updateInterval: 1000, // 1초마다 업데이트

      // 뽀모도로 프리셋
      pomodoro1: {
        focus: 25,
        shortBreak: 5,
        cycles: 4,
        longBreak: 15
      },
      pomodoro2: {
        focus: 50,
        shortBreak: 10,
        cycles: 2,
        longBreak: 30
      },

      // 시스템 설정
      enableNotifications: process.env.TIMER_ENABLE_NOTIFICATIONS !== "false",
      enableBadges: process.env.TIMER_ENABLE_BADGES !== "false",
      maxConcurrentTimers: 1, // 동시 타이머 제한

      ...options.config
    };

    // 📏 상수
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
   * 🎯 모듈 초기화 (BaseModule 표준)
   */
  async initialize() {
    try {
      logger.info("🍅 TimerModule 초기화 시작");

      // 1. 액션 맵 초기화
      if (!this.actionMap) {
        this.actionMap = new Map();
      }

      // 2. 액션 등록
      this.setupActions();

      // 3. 서비스 초기화
      await this.onInitialize();

      // 4. 초기화 완료 플래그 설정 (중요!)
      this.isInitialized = true;

      logger.success(
        `🍅 TimerModule 초기화 완료 - ${this.actionMap.size}개 액션`
      );
      return true;
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    try {
      if (!this.serviceBuilder) {
        logger.warn("ServiceBuilder가 없습니다. 기본 모드로 실행");
        return;
      }

      // TimerService 연결 시도
      try {
        this.timerService = await this.serviceBuilder.getOrCreate("timer");
        logger.info("✅ TimerService 연결됨");
      } catch (err) {
        logger.warn("TimerService 없이 진행:", err.message);
      }

      // NotificationService 연결 시도
      try {
        this.notificationService =
          await this.serviceBuilder.getOrCreate("notification");
        logger.info("✅ NotificationService 연결됨");
      } catch (err) {
        logger.warn("NotificationService 없이 진행:", err.message);
      }
    } catch (error) {
      logger.error("서비스 초기화 중 오류:", error);
      // 서비스 없이도 기본 기능 동작
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions)
   */
  setupActions() {
    // actionMap 직접 설정 (프로젝트 표준 방식)
    this.registerActions({
      menu: this.showMenu.bind(this),
      help: this.showHelp.bind(this),
      start: this.startTimer.bind(this),
      pause: this.pauseTimer.bind(this),
      resume: this.resumeTimer.bind(this),
      stop: this.stopTimer.bind(this),
      status: this.showStatus.bind(this),
      refresh: this.refreshStatus.bind(this),
      pomodoro1: this.startPomodoro1.bind(this),
      pomodoro2: this.startPomodoro2.bind(this),
      custom: this.showCustomSetup.bind(this), // ✅ custom 액션 추가
      setCustom: this.setCustomTimer.bind(this),
      history: this.showHistory.bind(this),
      stats: this.showWeeklyStats.bind(this),
      settings: this.showSettings.bind(this),
      setFocus: this.setFocusDuration.bind(this),
      setBreak: this.setBreakDuration.bind(this),
      toggleNotifications: this.toggleNotifications.bind(this)
    });
  }

  /**
   * 🎯 콜백 처리 (BaseModule 표준)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      logger.debug(`🍅 TimerModule 콜백 처리: ${subAction}`);

      const handler = this.actionMap.get(subAction);
      if (!handler) {
        logger.warn(`❓ 알 수 없는 액션: ${subAction}`);
        return {
          success: false,
          type: "error",
          module: "timer",
          data: { message: `알 수 없는 액션: ${subAction}` }
        };
      }

      const result = await handler(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
      return {
        success: true,
        ...result
      };
    } catch (error) {
      logger.error(`TimerModule 콜백 처리 오류:`, error);
      return {
        success: false,
        type: "error",
        module: "timer",
        data: { message: "처리 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 📨 메시지 처리 (표준 onHandleMessage)
   */
  async onHandleMessage(bot, msg) {
    const text = msg.text;
    if (!text) return false;

    const keywords = ["타이머", "timer", "뽀모도로", "pomodoro", "집중"];
    const hasKeyword = keywords.some((k) => text.toLowerCase().includes(k));

    if (hasKeyword) {
      logger.info(`🍅 타이머 키워드 감지: ${getUserName(msg.from)}`);
      return true;
    }

    return false;
  }

  // ===== 🎯 표준 매개변수 액션 메서드들 =====
  // 모든 메서드: (bot, callbackQuery, subAction, params, moduleManager)

  /**
   * 🍅 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      const activeTimer = this.activeTimers.get(userId);
      let recentSessions = [];

      // 서비스가 있으면 최근 세션 조회
      if (this.timerService && this.timerService.getRecentSessions) {
        try {
          const result = await this.timerService.getRecentSessions(userId, 3);
          if (result && result.success) {
            recentSessions = result.data || [];
          }
        } catch (err) {
          logger.debug("최근 세션 조회 실패:", err.message);
        }
      }

      return {
        type: "menu",
        module: "timer",
        action: "menu",
        data: {
          userName,
          activeTimer: activeTimer ? this.generateTimerData(activeTimer) : null,
          recentSessions,
          presets: {
            pomodoro1: this.config.pomodoro1,
            pomodoro2: this.config.pomodoro2
          }
        }
      };
    } catch (error) {
      logger.error("TimerModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "timer",
        action: "menu",
        data: {
          message: "메뉴를 표시할 수 없습니다.",
          error: error.message
        }
      };
    }
  }

  /**
   * ▶️ 타이머 시작 (중복 방지 로직 포함)
   */
  async startTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 🔒 중복 타이머 방지 - 기존 타이머가 있으면 차단
      if (this.activeTimers.has(userId)) {
        const existingTimer = this.activeTimers.get(userId);
        logger.warn(`⚠️ 이미 실행 중인 타이머 있음: ${userId}`);

        return {
          type: "timer_already_running",
          module: "timer",
          data: {
            message: "⚠️ 이미 타이머가 실행 중입니다!",
            existingTimer: this.generateTimerData(existingTimer),
            suggestion: "현재 타이머를 중지하거나 완료 후 새로 시작하세요."
          }
        };
      }

      const timerType = params || this.constants.TIMER_TYPES.FOCUS;
      const duration = this.getDurationByType(timerType);

      if (!duration) {
        return {
          type: "error",
          module: "timer",
          data: { message: "잘못된 타이머 타입입니다." }
        };
      }

      // 서비스에 세션 생성 (있으면)
      let sessionId = `timer_${userId}_${Date.now()}`;
      if (this.timerService && this.timerService.startSession) {
        try {
          const sessionResult = await this.timerService.startSession(userId, {
            type: timerType,
            duration,
            userName
          });

          if (sessionResult.success && sessionResult.data) {
            sessionId = sessionResult.data._id || sessionId;
          }
        } catch (err) {
          logger.debug("세션 생성 실패, 로컬 모드로 진행:", err.message);
        }
      }

      // 메모리 타이머 생성
      const timer = this.createTimer(sessionId, timerType, duration);
      timer.chatId = callbackQuery.message.chat.id;
      timer.messageId = callbackQuery.message.message_id;

      // 타이머 등록 및 시작
      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`▶️ 타이머 시작: ${userName} - ${timerType} (${duration}분)`);

      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: `🍅 ${duration}분 타이머를 시작합니다!`
        }
      };
    } catch (error) {
      logger.error("TimerModule.startTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 시작에 실패했습니다." }
      };
    }
  }

  /**
   * ⏸️ 타이머 일시정지
   */
  async pauseTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const timer = this.activeTimers.get(userId);

      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새 타이머를 시작해보세요!"
          }
        };
      }

      if (timer.status === this.constants.TIMER_STATUS.PAUSED) {
        return {
          type: "timer_status",
          module: "timer",
          data: {
            timer: this.generateTimerData(timer),
            message: "이미 일시정지 상태입니다."
          }
        };
      }

      // 타이머 일시정지
      timer.status = this.constants.TIMER_STATUS.PAUSED;
      timer.pausedAt = Date.now();

      // 인터벌 정리
      this.clearTimerInterval(userId);

      // 서비스 업데이트
      if (this.timerService && this.timerService.pauseSession) {
        try {
          await this.timerService.pauseSession(timer.sessionId);
        } catch (err) {
          logger.debug("서비스 일시정지 실패:", err.message);
        }
      }

      logger.info(`⏸️ 타이머 일시정지: ${userId}`);

      return {
        type: "timer_paused",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: "⏸️ 타이머를 일시정지했습니다."
        }
      };
    } catch (error) {
      logger.error("TimerModule.pauseTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 일시정지에 실패했습니다." }
      };
    }
  }

  /**
   * ▶️ 타이머 재개
   */
  async resumeTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const timer = this.activeTimers.get(userId);

      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새 타이머를 시작해보세요!"
          }
        };
      }

      if (timer.status !== this.constants.TIMER_STATUS.PAUSED) {
        return {
          type: "timer_status",
          module: "timer",
          data: {
            timer: this.generateTimerData(timer),
            message: "타이머가 이미 실행 중입니다."
          }
        };
      }

      // 일시정지 시간 계산 및 보정
      const pausedDuration = Date.now() - timer.pausedAt;
      timer.totalPausedTime = (timer.totalPausedTime || 0) + pausedDuration;

      // 타이머 재개
      timer.status = this.constants.TIMER_STATUS.RUNNING;
      timer.pausedAt = null;

      // 인터벌 재시작
      this.startTimerInterval(userId);

      // 서비스 업데이트
      if (this.timerService && this.timerService.resumeSession) {
        try {
          await this.timerService.resumeSession(timer.sessionId);
        } catch (err) {
          logger.debug("서비스 재개 실패:", err.message);
        }
      }

      logger.info(`▶️ 타이머 재개: ${userId}`);

      return {
        type: "timer_resumed",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: "▶️ 타이머를 재개했습니다."
        }
      };
    } catch (error) {
      logger.error("TimerModule.resumeTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 재개에 실패했습니다." }
      };
    }
  }

  /**
   * ⏹️ 타이머 중지
   */
  async stopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const timer = this.activeTimers.get(userId);

      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새 타이머를 시작해보세요!"
          }
        };
      }

      // 경과 시간 및 완료율 계산
      const elapsedTime = this.calculateElapsedTime(timer);
      const completionRate = Math.round(
        (elapsedTime / (timer.duration * 60 * 1000)) * 100
      );

      // 타이머 정리
      this.clearTimerInterval(userId);
      this.activeTimers.delete(userId);

      // 서비스에 중지 기록
      if (this.timerService && this.timerService.stopSession) {
        try {
          await this.timerService.stopSession(timer.sessionId, {
            elapsedTime,
            completionRate
          });
        } catch (err) {
          logger.debug("서비스 중지 실패:", err.message);
        }
      }

      logger.info(`⏹️ 타이머 중지: ${userId} - 완료율: ${completionRate}%`);

      return {
        type: "timer_stopped",
        module: "timer",
        data: {
          message: "⏹️ 타이머를 중지했습니다.",
          elapsedTime: this.formatTime(Math.floor(elapsedTime / 1000)),
          completionRate
        }
      };
    } catch (error) {
      logger.error("TimerModule.stopTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 중지에 실패했습니다." }
      };
    }
  }

  /**
   * 📊 타이머 상태 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const timer = this.activeTimers.get(userId);

      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새 타이머를 시작해보세요!"
          }
        };
      }

      return {
        type: "timer_status",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          canRefresh: true,
          isRefresh: false
        }
      };
    } catch (error) {
      logger.error("TimerModule.showStatus 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "상태 조회에 실패했습니다." }
      };
    }
  }

  /**
   * 🔄 타이머 상태 새로고침
   */
  async refreshStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const timer = this.activeTimers.get(userId);

      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새 타이머를 시작해보세요!"
          }
        };
      }

      return {
        type: "timer_status",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          canRefresh: true,
          isRefresh: true,
          refreshedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error("TimerModule.refreshStatus 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "새로고침에 실패했습니다." }
      };
    }
  }

  /**
   * 🍅 뽀모도로1 시작 (25-5 x4)
   */
  async startPomodoro1(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 중복 방지
      if (this.activeTimers.has(userId)) {
        const existingTimer = this.activeTimers.get(userId);
        return {
          type: "timer_already_running",
          module: "timer",
          data: {
            message: "⚠️ 이미 타이머가 실행 중입니다!",
            existingTimer: this.generateTimerData(existingTimer),
            suggestion: "현재 타이머를 중지하거나 완료 후 새로 시작하세요."
          }
        };
      }

      const preset = this.config.pomodoro1;

      // 뽀모도로 세션 생성
      let sessionId = `pomo1_${userId}_${Date.now()}`;
      if (this.timerService && this.timerService.startPomodoroSession) {
        try {
          const result = await this.timerService.startPomodoroSession(userId, {
            preset: "pomodoro1",
            ...preset,
            userName
          });
          if (result.success && result.data) {
            sessionId = result.data._id || sessionId;
          }
        } catch (err) {
          logger.debug("뽀모도로 세션 생성 실패:", err.message);
        }
      }

      // 타이머 생성 (첫 번째 집중 세션으로 시작)
      const timer = this.createTimer(
        sessionId,
        this.constants.TIMER_TYPES.FOCUS,
        preset.focus
      );
      timer.pomodoroSet = true;
      timer.currentCycle = 1;
      timer.totalCycles = preset.cycles;
      timer.preset = "pomodoro1";
      timer.chatId = callbackQuery.message.chat.id;
      timer.messageId = callbackQuery.message.message_id;

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`🍅 뽀모도로1 시작: ${userName}`);

      return {
        type: "pomodoro_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          preset: "pomodoro1",
          message: "🍅 뽀모도로 타이머를 시작합니다!"
        }
      };
    } catch (error) {
      logger.error("TimerModule.startPomodoro1 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "뽀모도로 시작에 실패했습니다." }
      };
    }
  }

  /**
   * 🍅 뽀모도로2 시작 (50-10 x2)
   */
  async startPomodoro2(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 중복 방지
      if (this.activeTimers.has(userId)) {
        const existingTimer = this.activeTimers.get(userId);
        return {
          type: "timer_already_running",
          module: "timer",
          data: {
            message: "⚠️ 이미 타이머가 실행 중입니다!",
            existingTimer: this.generateTimerData(existingTimer),
            suggestion: "현재 타이머를 중지하거나 완료 후 새로 시작하세요."
          }
        };
      }

      const preset = this.config.pomodoro2;

      // 뽀모도로 세션 생성
      let sessionId = `pomo2_${userId}_${Date.now()}`;
      if (this.timerService && this.timerService.startPomodoroSession) {
        try {
          const result = await this.timerService.startPomodoroSession(userId, {
            preset: "pomodoro2",
            ...preset,
            userName
          });
          if (result.success && result.data) {
            sessionId = result.data._id || sessionId;
          }
        } catch (err) {
          logger.debug("뽀모도로 세션 생성 실패:", err.message);
        }
      }

      // 타이머 생성 (첫 번째 집중 세션으로 시작)
      const timer = this.createTimer(
        sessionId,
        this.constants.TIMER_TYPES.FOCUS,
        preset.focus
      );
      timer.pomodoroSet = true;
      timer.currentCycle = 1;
      timer.totalCycles = preset.cycles;
      timer.preset = "pomodoro2";
      timer.chatId = callbackQuery.message.chat.id;
      timer.messageId = callbackQuery.message.message_id;

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`🍅 뽀모도로2 시작: ${userName}`);

      return {
        type: "pomodoro_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          preset: "pomodoro2",
          message: "🍅 뽀모도로 타이머를 시작합니다!"
        }
      };
    } catch (error) {
      logger.error("TimerModule.startPomodoro2 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "뽀모도로 시작에 실패했습니다." }
      };
    }
  }

  // ===== showCustomSetup 메서드 구현 =====

  /**
   * ⚙️ 커스텀 타이머 설정 화면 (표준 매개변수)
   * @param {object} bot - 봇 인스턴스
   * @param {object} callbackQuery - 콜백 쿼리
   * @param {string} subAction - 서브액션
   * @param {string} params - 파라미터
   * @param {object} moduleManager - 모듈 매니저
   */
  async showCustomSetup(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.debug(`⚙️ 커스텀 타이머 설정 - 사용자: ${userId}`);

      // 현재 활성 타이머가 있는지 확인
      const activeTimer = this.activeTimers.get(userId);
      if (activeTimer) {
        return {
          type: "error",
          module: "timer",
          data: {
            message: "이미 실행 중인 타이머가 있습니다.\n먼저 중지해주세요."
          }
        };
      }

      // 순수 데이터만 반환 (SoC 준수)
      return {
        type: "custom_setup",
        module: "timer",
        data: {
          userName,
          maxDuration: this.config.maxCustomDuration,
          suggestedDurations: [10, 15, 20, 30, 45, 60, 90]
        }
      };
    } catch (error) {
      logger.error("TimerModule.showCustomSetup 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "커스텀 타이머 설정에 실패했습니다." }
      };
    }
  }

  /**
   * ⏰ 커스텀 타이머 설정
   */
  async setCustomTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      const duration = parseInt(params);

      if (
        isNaN(duration) ||
        duration <= 0 ||
        duration > this.config.maxCustomDuration
      ) {
        return {
          type: "error",
          module: "timer",
          data: {
            message: `타이머는 1-${this.config.maxCustomDuration}분 사이로 설정해주세요.`
          }
        };
      }

      // 중복 방지
      if (this.activeTimers.has(userId)) {
        const existingTimer = this.activeTimers.get(userId);
        return {
          type: "timer_already_running",
          module: "timer",
          data: {
            message: "⚠️ 이미 타이머가 실행 중입니다!",
            existingTimer: this.generateTimerData(existingTimer),
            suggestion: "현재 타이머를 중지하거나 완료 후 새로 시작하세요."
          }
        };
      }

      // 커스텀 타이머 생성
      let sessionId = `custom_${userId}_${Date.now()}`;
      if (this.timerService && this.timerService.startSession) {
        try {
          const result = await this.timerService.startSession(userId, {
            type: this.constants.TIMER_TYPES.CUSTOM,
            duration,
            userName
          });
          if (result.success && result.data) {
            sessionId = result.data._id || sessionId;
          }
        } catch (err) {
          logger.debug("커스텀 세션 생성 실패:", err.message);
        }
      }

      const timer = this.createTimer(
        sessionId,
        this.constants.TIMER_TYPES.CUSTOM,
        duration
      );
      timer.chatId = callbackQuery.message.chat.id;
      timer.messageId = callbackQuery.message.message_id;

      this.activeTimers.set(userId, timer);
      this.startTimerInterval(userId);

      logger.info(`⏰ 커스텀 타이머 시작: ${userName} - ${duration}분`);

      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerData(timer),
          message: `⏰ ${duration}분 커스텀 타이머를 시작합니다!`
        }
      };
    } catch (error) {
      logger.error("TimerModule.setCustomTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "커스텀 타이머 설정에 실패했습니다." }
      };
    }
  }

  /**
   * 📜 기록 조회
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      if (!this.timerService || !this.timerService.getSessionHistory) {
        return {
          type: "no_history",
          module: "timer",
          data: { message: "기록을 조회할 수 없습니다." }
        };
      }

      const result = await this.timerService.getSessionHistory(userId, 10);

      if (!result.success || !result.data || result.data.length === 0) {
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
          userName
        }
      };
    } catch (error) {
      logger.error("TimerModule.showHistory 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "기록 조회에 실패했습니다." }
      };
    }
  }

  /**
   * 📈 주간 통계
   */
  async showWeeklyStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      if (!this.timerService || !this.timerService.getWeeklyStats) {
        return {
          type: "weekly_stats",
          module: "timer",
          data: {
            stats: this.getDefaultStats(),
            badge: null,
            userName
          }
        };
      }

      const result = await this.timerService.getWeeklyStats(userId);

      if (!result.success || !result.data) {
        return {
          type: "weekly_stats",
          module: "timer",
          data: {
            stats: this.getDefaultStats(),
            badge: null,
            userName
          }
        };
      }

      // 뱃지 계산
      const badge = this.calculateBadge(result.data.totalSessions);

      return {
        type: "weekly_stats",
        module: "timer",
        data: {
          stats: result.data,
          badge,
          userName
        }
      };
    } catch (error) {
      logger.error("TimerModule.showWeeklyStats 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "통계 조회에 실패했습니다." }
      };
    }
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "settings",
      module: "timer",
      data: {
        settings: {
          focusDuration: this.config.focusDuration,
          shortBreak: this.config.shortBreak,
          longBreak: this.config.longBreak
        },
        enableNotifications: this.config.enableNotifications
      }
    };
  }

  /**
   * 🍅 집중 시간 설정
   */
  async setFocusDuration(bot, callbackQuery, subAction, params, moduleManager) {
    // 실제 구현시 입력 처리 필요
    return {
      type: "settings",
      module: "timer",
      data: {
        settings: {
          focusDuration: this.config.focusDuration,
          shortBreak: this.config.shortBreak,
          longBreak: this.config.longBreak
        },
        enableNotifications: this.config.enableNotifications
      }
    };
  }

  /**
   * ☕ 휴식 시간 설정
   */
  async setBreakDuration(bot, callbackQuery, subAction, params, moduleManager) {
    // 실제 구현시 입력 처리 필요
    return {
      type: "settings",
      module: "timer",
      data: {
        settings: {
          focusDuration: this.config.focusDuration,
          shortBreak: this.config.shortBreak,
          longBreak: this.config.longBreak
        },
        enableNotifications: this.config.enableNotifications
      }
    };
  }

  /**
   * 🔔 알림 토글
   */
  async toggleNotifications(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    this.config.enableNotifications = !this.config.enableNotifications;

    return {
      type: "notification_toggled",
      module: "timer",
      data: {
        enabled: this.config.enableNotifications,
        message: this.config.enableNotifications
          ? "🔔 알림이 켜졌습니다."
          : "🔕 알림이 꺼졌습니다."
      }
    };
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
      data: {
        title: "❓ 타이머 도움말",
        sections: {
          basic: {
            title: "기본 사용법",
            items: [
              "• 🍅 뽀모도로: 집중과 휴식을 반복하는 기법",
              "• 🎯 집중 타이머: 25분 집중 세션",
              "• ☕ 휴식 타이머: 5분 짧은 휴식",
              "• ⏰ 커스텀: 원하는 시간 설정"
            ]
          },
          pomodoro: {
            title: "뽀모도로 기법",
            items: [
              "• 뽀모도로1: 25분 집중 → 5분 휴식 (4회)",
              "• 뽀모도로2: 50분 집중 → 10분 휴식 (2회)",
              "• 사이클 완료 후 긴 휴식"
            ]
          },
          badges: {
            title: "뱃지 시스템",
            items: [
              "• 🥉 초보자: 5회 이상",
              "• 🥈 중급자: 10회 이상",
              "• 🥇 전문가: 20회 이상",
              "• 💎 마스터: 40회 이상"
            ]
          }
        }
      }
    };
  }

  // ===== 🛠️ 헬퍼 메서드 (비즈니스 로직) =====

  /**
   * 타이머 생성
   */
  createTimer(sessionId, type, duration) {
    return {
      sessionId,
      type,
      duration,
      startTime: Date.now(),
      endTime: Date.now() + duration * 60 * 1000,
      status: this.constants.TIMER_STATUS.RUNNING,
      pausedAt: null,
      totalPausedTime: 0,
      pomodoroSet: false,
      currentCycle: null,
      totalCycles: null,
      preset: null
    };
  }

  /**
   * 타이머 데이터 생성 (렌더러용)
   */
  generateTimerData(timer) {
    const _now = Date.now();
    const elapsed = this.calculateElapsedTime(timer);
    const remaining = Math.max(0, timer.duration * 60 * 1000 - elapsed);
    const progress = Math.min(
      100,
      Math.round((elapsed / (timer.duration * 60 * 1000)) * 100)
    );

    return {
      type: timer.type,
      typeDisplay: this.getTypeDisplay(timer.type),
      duration: timer.duration,
      durationDisplay: `${timer.duration}분`,
      status: timer.status,
      statusDisplay: this.getStatusDisplay(timer.status),
      isPaused: timer.status === this.constants.TIMER_STATUS.PAUSED,
      progress,
      elapsed,
      elapsedFormatted: this.formatTime(Math.floor(elapsed / 1000)),
      remaining,
      remainingFormatted: this.formatTime(Math.floor(remaining / 1000)),
      pomodoroSet: timer.pomodoroSet,
      currentCycle: timer.currentCycle,
      totalCycles: timer.totalCycles,
      preset: timer.preset
    };
  }

  /**
   * 타이머 인터벌 시작
   */

  /**
   * 타이머 인터벌 시작
   */
  startTimerInterval(userId) {
    this.stopTimerInterval(userId); // 기존 인터벌 정리

    const interval = setInterval(() => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.isPaused) return;

      timer.remainingTime--;

      // 진행률 업데이트 (비즈니스 로직만!)
      timer.elapsedTime = timer.duration * 60 - timer.remainingTime;
      timer.progress = Math.round(
        (timer.elapsedTime / (timer.duration * 60)) * 100
      );

      // 타이머 완료 확인
      if (timer.remainingTime <= 0) {
        this.completeTimer(userId); // 렌더러가 알림 처리
      }
    }, this.config.updateInterval);

    this.timerIntervals.set(userId, interval);
  }

  // ✅ 추가된 부분: stopTimerInterval 함수
  // clearTimerInterval의 별칭(alias) 역할을 합니다.

  stopTimerInterval(userId) {
    this.clearTimerInterval(userId);
  }

  /**
   * 타이머 인터벌 정리
   */
  clearTimerInterval(userId) {
    const intervalId = this.timerIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * 타이머 완료 처리 및 알림 발송
   */
  async completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    try {
      // 1. 완료 데이터 준비 (렌더러에 전달할 정보)
      const completionData = {
        type: "timer_completed", // 렌더러가 인식할 타입
        module: "timer",
        data: {
          userId,
          timerType: timer.type,
          duration: timer.duration,
          elapsedTime: timer.duration * 60 - timer.remainingTime,
          completionRate: 100,
          chatId: timer.chatId,
          completedAt: new Date(),
          sessionId: timer.sessionId
        }
      };

      // 2. 타이머 정리
      await this.cleanupUserTimer(userId);

      // 3. 서비스에 완료 처리
      await this.timerService.completeSession(timer.sessionId);

      logger.info(`✅ 타이머 완료: ${userId} - ${timer.type}`);

      // 4. 🔔 완료 알림 요청 (렌더러가 처리하도록!)
      if (timer.chatId && this.bot) {
        await this.notifyCompletion(completionData);
      }
    } catch (error) {
      logger.error(`타이머 완료 처리 실패 (${userId}):`, error);
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
   * 경과 시간 계산
   */
  calculateElapsedTime(timer) {
    const now = Date.now();
    let elapsed = now - timer.startTime;

    // 일시정지 시간 제외
    if (timer.totalPausedTime) {
      elapsed -= timer.totalPausedTime;
    }

    // 현재 일시정지 중이면 추가 계산
    if (timer.status === this.constants.TIMER_STATUS.PAUSED && timer.pausedAt) {
      elapsed -= now - timer.pausedAt;
    }

    return Math.max(0, elapsed);
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
  getDurationByType(type) {
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
