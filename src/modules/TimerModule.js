const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 모듈 (심플 버전)
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.timerService = null;
    this.activeTimers = new Map(); // 실시간 타이머 상태
    this.timerIntervals = new Map(); // 타이머 인터벌

    // 간단한 설정
    this.config = {
      focusDuration: 25, // 분
      shortBreak: 5, // 분
      longBreak: 15, // 분
      updateInterval: 1000, // ms
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    this.timerService = this.serviceBuilder.getOrCreate("timer");

    if (!this.timerService) {
      throw new Error("TimerService를 찾을 수 없습니다");
    }

    this.setupActions();
    logger.success("🍅 TimerModule 초기화 완료");
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("start", this.startTimer.bind(this));
    this.actionMap.set("pause", this.pauseTimer.bind(this));
    this.actionMap.set("resume", this.resumeTimer.bind(this));
    this.actionMap.set("stop", this.stopTimer.bind(this));
    this.actionMap.set("status", this.showStatus.bind(this));
  }

  /**
   * 🍅 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const activeTimer = this.activeTimers.get(userId);

    return {
      type: "menu",
      module: "timer",
      data: {
        userId,
        activeTimer: activeTimer ? this.getTimerData(activeTimer) : null,
      },
    };
  }

  /**
   * ▶️ 타이머 시작
   */
  async startTimer(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    // 이미 실행 중인 타이머가 있으면 중지
    if (this.activeTimers.has(userId)) {
      this.stopTimerInterval(userId);
    }

    // 타이머 타입 결정
    const timerType = params || "focus";
    const duration = this.getDuration(timerType);

    // 서비스에 세션 저장
    const result = await this.timerService.startSession(userId, {
      type: timerType,
      duration,
    });

    if (!result.success) {
      return {
        type: "error",
        module: "timer",
        data: { message: result.message },
      };
    }

    // 메모리 타이머 생성
    const timer = {
      sessionId: result.data._id,
      type: timerType,
      duration: duration * 60, // 초로 변환
      remainingTime: duration * 60,
      startTime: Date.now(),
      isPaused: false,
    };

    this.activeTimers.set(userId, timer);
    this.startTimerInterval(userId);

    return {
      type: "timer_started",
      module: "timer",
      data: {
        timer: this.getTimerData(timer),
        message: `🍅 ${duration}분 타이머 시작!`,
      },
    };
  }

  /**
   * ⏸️ 타이머 일시정지
   */
  async pauseTimer(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer) {
      return {
        type: "error",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." },
      };
    }

    if (timer.isPaused) {
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머가 이미 일시정지되어 있습니다." },
      };
    }

    // 타이머 일시정지
    this.stopTimerInterval(userId);
    timer.isPaused = true;
    timer.pausedAt = Date.now();

    // 서비스에 상태 업데이트
    await this.timerService.pauseSession(timer.sessionId);

    return {
      type: "timer_paused",
      module: "timer",
      data: {
        timer: this.getTimerData(timer),
        message: "⏸️ 타이머가 일시정지되었습니다.",
      },
    };
  }

  /**
   * ▶️ 타이머 재개
   */
  async resumeTimer(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer || !timer.isPaused) {
      return {
        type: "error",
        module: "timer",
        data: { message: "일시정지된 타이머가 없습니다." },
      };
    }

    // 타이머 재개
    timer.isPaused = false;
    timer.pausedAt = null;
    this.startTimerInterval(userId);

    // 서비스에 상태 업데이트
    await this.timerService.resumeSession(timer.sessionId);

    return {
      type: "timer_resumed",
      module: "timer",
      data: {
        timer: this.getTimerData(timer),
        message: "▶️ 타이머가 재개되었습니다.",
      },
    };
  }

  /**
   * ⏹️ 타이머 중지
   */
  async stopTimer(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer) {
      return {
        type: "error",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." },
      };
    }

    // 타이머 중지
    this.stopTimerInterval(userId);
    this.activeTimers.delete(userId);

    // 서비스에 세션 중지
    await this.timerService.stopSession(timer.sessionId);

    return {
      type: "timer_stopped",
      module: "timer",
      data: {
        message: "⏹️ 타이머가 중지되었습니다.",
        elapsedTime: this.formatTime(timer.duration - timer.remainingTime),
      },
    };
  }

  /**
   * 📊 타이머 상태 표시
   */
  async showStatus(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    if (!timer) {
      return {
        type: "no_timer",
        module: "timer",
        data: { message: "실행 중인 타이머가 없습니다." },
      };
    }

    return {
      type: "timer_status",
      module: "timer",
      data: {
        timer: this.getTimerData(timer),
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 타이머 타입별 시간 반환
   */
  getDuration(type) {
    switch (type) {
      case "focus":
        return this.config.focusDuration;
      case "short":
        return this.config.shortBreak;
      case "long":
        return this.config.longBreak;
      default:
        const customTime = parseInt(type);
        return !isNaN(customTime) && customTime > 0
          ? customTime
          : this.config.focusDuration;
    }
  }

  /**
   * 타이머 표시용 데이터 생성
   */
  getTimerData(timer) {
    return {
      type: timer.type,
      remainingTime: timer.remainingTime,
      totalTime: timer.duration,
      isPaused: timer.isPaused,
      progress: Math.round(
        ((timer.duration - timer.remainingTime) / timer.duration) * 100
      ),
      displayTime: this.formatTime(timer.remainingTime),
    };
  }

  /**
   * 시간 포맷팅 (초 → MM:SS)
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * 타이머 인터벌 시작
   */
  startTimerInterval(userId) {
    this.stopTimerInterval(userId); // 기존 인터벌 정리

    const interval = setInterval(() => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.isPaused) return;

      timer.remainingTime--;

      // 타이머 완료
      if (timer.remainingTime <= 0) {
        this.completeTimer(userId);
      }
    }, this.config.updateInterval);

    this.timerIntervals.set(userId, interval);
  }

  /**
   * 타이머 인터벌 중지
   */
  stopTimerInterval(userId) {
    const interval = this.timerIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * 타이머 완료 처리
   */
  async completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    // 타이머 정리
    this.stopTimerInterval(userId);
    this.activeTimers.delete(userId);

    // 서비스에 완료 처리
    await this.timerService.completeSession(timer.sessionId);

    // 완료 알림은 별도 시스템에서 처리 (SoC)
    logger.info(`✅ 타이머 완료: ${userId} - ${timer.type}`);
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    // 모든 인터벌 정리
    for (const [userId] of this.activeTimers) {
      this.stopTimerInterval(userId);
    }

    this.activeTimers.clear();
    this.timerIntervals.clear();

    logger.debug("🍅 TimerModule 정리 완료");
  }
}

module.exports = TimerModule;
