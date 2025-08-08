const logger = require("./Logger");

/**
 * 🎯 TimerStateManager - 타이머 상태 관리 전담
 *
 * 책임:
 * - 메모리와 DB 상태 동기화
 * - 타이머 생명주기 관리
 * - 뽀모도로 전환 규칙 관리
 */
class TimerStateManager {
  constructor() {
    // 메모리 저장소
    this.activeTimers = new Map();
    this.timerIntervals = new Map();

    // 뽀모도로 프리셋 정의
    this.presets = {
      pomodoro1: {
        focus: 25,
        shortBreak: 5,
        longBreak: 15,
        cycles: 4,
        name: "기본 뽀모도로"
      },
      pomodoro2: {
        focus: 50,
        shortBreak: 10,
        longBreak: 30,
        cycles: 2,
        name: "딥 포커스"
      }
    };

    // 개발 모드 설정
    this.devMode = {
      enabled:
        process.env.NODE_ENV === "development" &&
        process.env.TIMER_DEV_MODE === "true",
      focusDuration: 0.5, // 30초
      shortBreak: 0.25, // 15초
      longBreak: 0.33, // 20초
      updateInterval: 100 // 100ms
    };
  }

  // ===== 🔄 타이머 생명주기 =====

  /**
   * 타이머 생성 및 시작
   */
  createTimer(userId, type, duration, sessionId, metadata = {}) {
    this.cleanupTimer(userId);

    const actualDuration = this.devMode.enabled
      ? this.getDevDuration(type)
      : duration;

    const timer = {
      userId,
      sessionId,
      type,
      duration: actualDuration,
      originalDuration: duration,
      startTime: Date.now(),
      status: "running",
      pausedAt: null,
      totalPausedDuration: 0,

      // 뽀모도로 정보
      isPomodoro: metadata.isPomodoro || false,
      preset: metadata.preset || null,
      currentCycle: metadata.currentCycle || 1,
      totalCycles: metadata.totalCycles || 1,

      // ✅ 사용자 이름 정보 추가
      userName: metadata.userName || null,

      // UI 정보
      chatId: metadata.chatId,
      messageId: metadata.messageId
    };

    this.activeTimers.set(userId, timer);
    this.startInterval(userId);

    logger.info(
      `⏱️ 타이머 생성: ${userId} (${timer.userName || "Unknown"}) - ${type} (${actualDuration}분)`
    );
    return timer;
  }

  /**
   * 타이머 일시정지
   */
  pauseTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.status !== "running") {
      throw new Error("실행 중인 타이머가 없습니다");
    }

    this.clearInterval(userId);
    timer.status = "paused";
    timer.pausedAt = Date.now();

    logger.info(`⏸️ 타이머 일시정지: ${userId}`);
    return timer;
  }

  /**
   * 타이머 재개
   */
  resumeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer || timer.status !== "paused") {
      throw new Error("일시정지된 타이머가 없습니다");
    }

    timer.totalPausedDuration += Date.now() - timer.pausedAt;
    timer.status = "running";
    timer.pausedAt = null;

    this.startInterval(userId);

    logger.info(`▶️ 타이머 재개: ${userId}`);
    return timer;
  }

  /**
   * 타이머 중지
   */
  stopTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      throw new Error("활성 타이머가 없습니다");
    }

    const elapsed = this.calculateElapsed(timer);
    const completionRate = Math.min(
      100,
      Math.round((elapsed / (timer.duration * 60 * 1000)) * 100)
    );

    this.cleanupTimer(userId);

    logger.info(`⏹️ 타이머 중지: ${userId} - 완료율 ${completionRate}%`);

    return {
      ...timer,
      completionRate,
      actualDuration: Math.round((elapsed / 1000 / 60) * 100) / 100
    };
  }

  /**
   * 타이머 완료
   */
  completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return null;

    timer.status = "completed";
    timer.completedAt = Date.now();

    this.cleanupTimer(userId);

    logger.info(`✅ 타이머 완료: ${userId} - ${timer.type}`);

    return timer;
  }

  /**
   * 타이머 정리
   */
  cleanupTimer(userId) {
    this.clearInterval(userId);
    this.activeTimers.delete(userId);
    logger.debug(`🧹 타이머 정리: ${userId}`);
  }

  /**
   * 분 단위 시간을 MM:SS 형식으로 포맷팅
   */
  formatMinutes(minutes) {
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    if (mins > 0) {
      return `${mins}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  // ===== ⏰ 인터벌 관리 =====

  /**
   * 타이머 인터벌 시작
   */
  startInterval(userId) {
    this.clearInterval(userId);

    const checkInterval = this.devMode.enabled ? 100 : 1000;

    const intervalId = setInterval(() => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.status !== "running") {
        this.clearInterval(userId);
        return;
      }

      const remaining = this.calculateRemaining(timer);

      if (remaining <= 0) {
        // 타이머 완료 이벤트 발생
        this.onTimerComplete(userId);
      }
    }, checkInterval);

    this.timerIntervals.set(userId, intervalId);
    logger.debug(`⏰ 인터벌 시작: ${userId} (${checkInterval}ms)`);
  }

  /**
   * 인터벌 정리
   */
  clearInterval(userId) {
    if (this.timerIntervals.has(userId)) {
      clearInterval(this.timerIntervals.get(userId));
      this.timerIntervals.delete(userId);
      logger.debug(`⏰ 인터벌 정리: ${userId}`);
    }
  }

  /**
   * 타이머 완료 콜백
   */
  onTimerComplete(userId) {
    // 이 메서드는 TimerModule에서 오버라이드됨
    logger.info(`⏰ 타이머 완료 이벤트: ${userId}`);
  }

  // ===== 🍅 뽀모도로 로직 =====

  /**
   * 다음 뽀모도로 세션 정보 계산
   */
  getNextPomodoroSession(completedTimer) {
    if (!completedTimer.isPomodoro) return null;

    const preset = this.presets[completedTimer.preset];
    if (!preset) return null;

    // 현재 타입에 따른 다음 세션 결정
    if (completedTimer.type === "focus") {
      // Focus 완료 → 휴식
      const isLastCycle =
        completedTimer.currentCycle >= completedTimer.totalCycles;

      return {
        type: isLastCycle ? "longBreak" : "shortBreak",
        duration: isLastCycle ? preset.longBreak : preset.shortBreak,
        currentCycle: completedTimer.currentCycle,
        isLastBreak: isLastCycle
      };
    } else if (completedTimer.type === "shortBreak") {
      // Short Break 완료 → 다음 Focus
      return {
        type: "focus",
        duration: preset.focus,
        currentCycle: completedTimer.currentCycle + 1,
        isLastBreak: false
      };
    } else if (completedTimer.type === "longBreak") {
      // Long Break 완료 → 세트 완료
      return null; // 완료
    }

    return null;
  }

  /**
   * 뽀모도로 세트 완료 여부 확인
   */
  isPomodoroSetComplete(timer) {
    if (!timer.isPomodoro) return false;

    // Long Break가 끝났거나
    if (timer.type === "longBreak" && timer.status === "completed") {
      return true;
    }

    // 마지막 사이클의 Focus가 끝났고 Long Break를 건너뛰는 경우
    if (
      timer.type === "focus" &&
      timer.currentCycle >= timer.totalCycles &&
      timer.status === "completed"
    ) {
      // 이 경우는 Long Break로 전환되므로 여기서는 false
      return false;
    }

    return false;
  }

  // ===== 📊 상태 조회 =====

  /**
   * 타이머 데이터 생성
   */
  getTimerData(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return null;

    const elapsed = this.calculateElapsed(timer);
    const remaining = this.calculateRemaining(timer);
    const progress = Math.min(
      100,
      Math.round((elapsed / (timer.duration * 60 * 1000)) * 100)
    );

    return {
      ...timer,
      elapsed,
      remaining,
      progress,
      elapsedFormatted: this.formatTime(Math.floor(elapsed / 1000)),
      remainingFormatted: this.formatTime(Math.floor(remaining / 1000)),
      typeDisplay: this.getTypeDisplay(timer.type),
      statusDisplay: this.getStatusDisplay(timer.status),
      isPaused: timer.status === "paused",
      isRunning: timer.status === "running"
    };
  }

  /**
   * 활성 타이머 확인
   */
  hasActiveTimer(userId) {
    return this.activeTimers.has(userId);
  }

  /**
   * 모든 활성 타이머 조회
   */
  getAllActiveTimers() {
    return Array.from(this.activeTimers.values());
  }

  // ===== 🔧 유틸리티 =====

  /**
   * 경과 시간 계산
   */
  calculateElapsed(timer) {
    if (timer.status === "paused") {
      return timer.pausedAt - timer.startTime - timer.totalPausedDuration;
    }
    return Date.now() - timer.startTime - timer.totalPausedDuration;
  }

  /**
   * 남은 시간 계산
   */
  calculateRemaining(timer) {
    const elapsed = this.calculateElapsed(timer);
    const total = timer.duration * 60 * 1000;
    return Math.max(0, total - elapsed);
  }

  /**
   * 시간 포맷팅
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * 타입 표시명
   */
  getTypeDisplay(type) {
    const displays = {
      focus: "🎯 집중",
      shortBreak: "☕ 짧은 휴식",
      longBreak: "🌴 긴 휴식",
      custom: "⏰ 커스텀"
    };
    // undefined 방지
    return displays[type] || type || "알 수 없음";
  }

  /**
   * 상태 표시명
   */
  getStatusDisplay(status) {
    const displays = {
      running: "▶️ 실행 중",
      paused: "⏸️ 일시정지",
      stopped: "⏹️ 중지됨",
      completed: "✅ 완료"
    };
    return displays[status] || status;
  }

  /**
   * 개발 모드 시간 가져오기
   */
  getDevDuration(type) {
    if (!this.devMode.enabled) return null;

    const durations = {
      focus: this.devMode.focusDuration,
      shortBreak: this.devMode.shortBreak,
      longBreak: this.devMode.longBreak
    };

    return durations[type] || 1;
  }

  /**
   * 전체 정리
   */
  cleanup() {
    for (const userId of this.activeTimers.keys()) {
      this.cleanupTimer(userId);
    }
    logger.info("🧹 TimerStateManager 정리 완료");
  }
}

// 싱글톤 인스턴스
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new TimerStateManager();
    }
    return instance;
  },
  TimerStateManager
};
