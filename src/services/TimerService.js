// src/services/TimerService.js - 이벤트 시스템 추가 버전

const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");
const EventEmitter = require('events');

/**
 * 타이머 서비스
 * - 포모도로 및 일반 타이머 관리
 * - 자동 백업 및 복원
 * - 이벤트 기반 알림 시스템
 */
class TimerService extends EventEmitter {
  constructor() {
    super();
    
    // 활성 타이머 관리
    this.timers = new Map(); // userId → timer 객체
    this.pomodoroSessions = new Map(); // userId → session 객체
    this.sessionHistory = {}; // userId → 히스토리 배열

    // 백업 관리
    this.lastBackup = null;
    this.backupKey = "TIMER_BACKUP_DATA";
    this.sessionHistoryKey = "TIMER_SESSION_HISTORY";

    // 설정
    this.config = {
      workDuration: 25, // 포모도로 작업 시간 (분)
      shortBreakDuration: 5, // 짧은 휴식 시간 (분)
      longBreakDuration: 15, // 긴 휴식 시간 (분)
      longBreakInterval: 4, // 긴 휴식 주기
      autoSaveInterval: 60000, // 1분마다 자동 백업
      maxHistoryDays: 30, // 히스토리 보관 기간
      notificationInterval: 1000, // 1초마다 타이머 체크
    };

    // 알림 인터벌 관리
    this.notificationTimer = null;
    this.isRunning = false;

    logger.info("⏰ TimerService 생성됨 (이벤트 시스템 포함)");
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      logger.info("⏰ TimerService 초기화 중...");

      // 백업에서 복원
      await this.restoreFromBackup();

      // 주기적 백업 설정
      this.setupPeriodicBackup();

      // 안전한 종료 처리
      this.setupGracefulShutdown();

      // 이벤트 기반 알림 시스템 시작
      this.startNotificationSystem();

      this.isRunning = true;
      logger.success("✅ TimerService 초기화 완료");
      
      return { success: true };
    } catch (error) {
      logger.error("❌ TimerService 초기화 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 이벤트 기반 알림 시스템 시작
   */
  startNotificationSystem() {
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer);
    }

    this.notificationTimer = setInterval(() => {
      this.checkTimerCompletions();
    }, this.config.notificationInterval);

    logger.info("🔔 타이머 알림 시스템 시작됨");
  }

  /**
   * 타이머 완료 체크 및 이벤트 발생
   */
  checkTimerCompletions() {
    const now = TimeHelper.getKoreaTime();

    this.timers.forEach((timer, userId) => {
      const elapsedMinutes = Math.floor((now - timer.startTime) / 60000);
      const isCompleted = elapsedMinutes >= timer.duration;

      if (isCompleted && !timer.completed) {
        // 타이머 완료 처리
        timer.completed = true;
        this.handleTimerCompletion(userId, timer);
      }
    });
  }

  /**
   * 타이머 완료 처리 및 이벤트 발생
   */
  async handleTimerCompletion(userId, timer) {
    try {
      const now = TimeHelper.getKoreaTime();
      const actualDuration = Math.floor((now - timer.startTime) / 60000);

      logger.info(`⏰ 타이머 완료: 사용자 ${userId}, 타입: ${timer.type}`);

      if (timer.type === "pomodoro") {
        // 포모도로 완료 처리
        const completionResult = await this.handlePomodoroCompletion(userId, timer, actualDuration);
        
        // 포모도로 완료 이벤트 발생
        this.emit('pomodoroCompleted', {
          userId,
          timer,
          completionData: completionResult.data,
          timestamp: now
        });
      } else {
        // 일반 타이머 완료 처리
        const completionData = {
          userId,
          taskName: timer.taskName,
          type: timer.type,
          plannedDuration: timer.duration,
          actualDuration,
          startTime: timer.startTime,
          endTime: now,
          message: `⏰ "${timer.taskName}" 타이머가 완료되었습니다! (${actualDuration}분)`
        };

        // 히스토리 기록
        this.addToHistory(userId, {
          type: 'timer_completed',
          task: timer.taskName,
          duration: actualDuration,
          timestamp: now,
          sessionId: timer.sessionId
        });

        // 타이머 제거
        this.timers.delete(userId);

        // 일반 타이머 완료 이벤트 발생
        this.emit('timerCompleted', completionData);
      }

      // 백업 저장
      this.saveToBackup();

    } catch (error) {
      logger.error("타이머 완료 처리 오류:", error);
      
      // 오류 이벤트 발생
      this.emit('timerError', {
        userId,
        error: error.message,
        timer
      });
    }
  }

  /**
   * 포모도로 완료 처리
   */
  async handlePomodoroCompletion(userId, timer, actualDuration) {
    const session = this.pomodoroSessions.get(userId) || {
      count: 0,
      totalWorkTime: 0,
      totalBreakTime: 0,
      startDate: TimeHelper.getKoreaTime(),
    };

    const now = TimeHelper.getKoreaTime();
    let nextMode, nextDuration, message;
    const autoTransition = false; // 수동 전환으로 설정

    if (timer.mode === "work") {
      // 작업 완료 → 휴식
      session.count += 1;
      session.totalWorkTime += actualDuration;
      this.pomodoroSessions.set(userId, session);

      // 휴식 종류 결정
      const isLongBreak = session.count % this.config.longBreakInterval === 0;
      nextMode = "break";
      nextDuration = isLongBreak 
        ? this.config.longBreakDuration 
        : this.config.shortBreakDuration;

      const breakType = isLongBreak ? "긴 휴식" : "짧은 휴식";
      message = `🎉 ${session.count}번째 포모도로 완료!\n${breakType} 시간입니다 (${nextDuration}분)`;
      
    } else {
      // 휴식 완료 → 다음 작업 준비
      session.totalBreakTime += actualDuration;
      nextMode = "work";
      nextDuration = this.config.workDuration;
      message = "💪 휴식 완료! 다음 포모도로를 시작할 준비가 되셨나요?";
    }

    // 히스토리 기록
    this.addToHistory(userId, {
      type: `pomodoro_${timer.mode}_completed`,
      task: timer.taskName,
      duration: actualDuration,
      timestamp: now,
      sessionId: timer.sessionId,
      sessionCount: session.count
    });

    // 현재 타이머 제거 (수동 전환)
    this.timers.delete(userId);

    const completionData = {
      completedMode: timer.mode,
      completedTask: timer.taskName,
      actualDuration,
      plannedDuration: timer.duration,
      nextMode,
      nextDuration,
      sessionCount: session.count,
      totalWorkTime: session.totalWorkTime,
      totalBreakTime: session.totalBreakTime,
      message,
      completedAt: TimeHelper.formatDateTime(now),
      autoTransition
    };

    return {
      success: true,
      data: completionData
    };
  }

  /**
   * 일반 타이머 시작 (시간 지정)
   */
  async startTimer(userId, duration, taskName = "일반 타이머") {
    try {
      // 기존 타이머 확인
      if (this.timers.has(userId)) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요."
        };
      }

      if (duration < 1 || duration > 180) {
        return {
          success: false,
          error: "타이머는 1분에서 180분(3시간) 사이로 설정할 수 있습니다."
        };
      }

      const timer = {
        taskName,
        startTime: TimeHelper.getKoreaTime(),
        duration: duration, // 분 단위
        type: "general",
        sessionId: this.generateSessionId(),
        completed: false
      };

      this.timers.set(userId, timer);

      // 히스토리 기록
      this.addToHistory(userId, {
        type: "timer_start",
        task: taskName,
        duration: duration,
        timestamp: timer.startTime,
        sessionId: timer.sessionId
      });

      logger.info(`⏰ 타이머 시작: 사용자 ${userId}, ${duration}분, 작업 "${taskName}"`);

      return {
        success: true,
        data: {
          taskName,
          duration,
          startTime: TimeHelper.formatDateTime(timer.startTime),
          endTime: TimeHelper.formatDateTime(TimeHelper.addMinutes(timer.startTime, duration)),
          sessionId: timer.sessionId
        }
      };
    } catch (error) {
      logger.error("타이머 시작 오류:", error);
      return {
        success: false,
        error: "타이머 시작 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 포모도로 시작
   */
  async startPomodoro(userId, taskName = "포모도로 작업") {
    try {
      // 기존 타이머 확인
      const existingTimer = this.timers.get(userId);
      if (existingTimer && !existingTimer.restored) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요."
        };
      }

      const timer = {
        taskName,
        startTime: TimeHelper.getKoreaTime(),
        duration: this.config.workDuration,
        type: "pomodoro",
        mode: "work", // work 또는 break
        sessionId: this.generateSessionId(),
        completed: false
      };

      this.timers.set(userId, timer);

      // 포모도로 세션 초기화 (필요시)
      if (!this.pomodoroSessions.has(userId)) {
        this.pomodoroSessions.set(userId, {
          count: 0,
          totalWorkTime: 0,
          totalBreakTime: 0,
          startDate: timer.startTime,
        });
      }

      // 히스토리 기록
      this.addToHistory(userId, {
        type: "pomodoro_start",
        task: taskName,
        timestamp: timer.startTime,
        sessionId: timer.sessionId
      });

      logger.info(`🍅 포모도로 시작: 사용자 ${userId}, 작업 "${taskName}"`);

      return {
        success: true,
        data: {
          taskName,
          duration: this.config.workDuration,
          mode: "work",
          startTime: TimeHelper.formatDateTime(timer.startTime),
          endTime: TimeHelper.formatDateTime(
            TimeHelper.addMinutes(timer.startTime, this.config.workDuration)
          ),
          sessionId: timer.sessionId
        }
      };
    } catch (error) {
      logger.error("포모도로 시작 오류:", error);
      return {
        success: false,
        error: "포모도로 시작 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 활성 타이머 상태 조회
   */
  async getActiveTimer(userId) {
    try {
      const timer = this.timers.get(userId);

      if (!timer) {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다."
        };
      }

      const now = TimeHelper.getKoreaTime();
      const elapsedMinutes = Math.floor((now - timer.startTime) / 60000);
      const remainingMinutes = Math.max(0, timer.duration - elapsedMinutes);
      const remainingSeconds = Math.max(0, (timer.duration * 60) - Math.floor((now - timer.startTime) / 1000));

      // 포모도로 세션 정보
      let sessionInfo = null;
      if (timer.type === "pomodoro") {
        const session = this.pomodoroSessions.get(userId);
        if (session) {
          sessionInfo = {
            count: session.count,
            totalWorkTime: session.totalWorkTime,
            totalBreakTime: session.totalBreakTime
          };
        }
      }

      return {
        success: true,
        timer: {
          taskName: timer.taskName,
          type: timer.type,
          mode: timer.mode || null,
          startTime: timer.startTime,
          duration: timer.duration,
          elapsedTime: elapsedMinutes,
          remainingTime: remainingSeconds,
          totalTime: timer.duration * 60, // 초 단위
          isCompleted: timer.completed || false,
          sessionId: timer.sessionId,
          sessionInfo
        }
      };
    } catch (error) {
      logger.error("타이머 상태 조회 오류:", error);
      return {
        success: false,
        error: "타이머 상태 조회 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 타이머 정지
   */
  async stopTimer(userId) {
    try {
      const timer = this.timers.get(userId);

      if (!timer) {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다."
        };
      }

      const now = TimeHelper.getKoreaTime();
      const duration = Math.floor((now.getTime() - timer.startTime.getTime()) / 60000);

      // 히스토리 기록
      this.addToHistory(userId, {
        type: `${timer.type}_stop`,
        task: timer.taskName,
        duration: duration,
        timestamp: now,
        sessionId: timer.sessionId
      });

      this.timers.delete(userId);

      let sessionInfo = null;
      if (timer.type === "pomodoro") {
        const session = this.pomodoroSessions.get(userId);
        if (session) {
          sessionInfo = {
            totalSessions: session.count,
            totalWorkTime: session.totalWorkTime,
            totalBreakTime: session.totalBreakTime
          };
        }
      }

      logger.info(`🛑 타이머 중지: 사용자 ${userId}, ${duration}분 경과`);

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          type: timer.type,
          duration: duration,
          elapsedTime: this.formatElapsedTime(duration),
          startTime: TimeHelper.formatDateTime(timer.startTime),
          endTime: TimeHelper.formatDateTime(now),
          sessionInfo
        }
      };
    } catch (error) {
      logger.error("타이머 중지 오류:", error);
      return {
        success: false,
        error: "타이머 중지 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 서비스 종료
   */
  async shutdown() {
    logger.info("🛑 TimerService 종료 중...");
    
    this.isRunning = false;
    
    // 알림 시스템 정지
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer);
      this.notificationTimer = null;
    }

    // 백업 저장
    this.saveToBackup();

    // 이벤트 리스너 정리
    this.removeAllListeners();

    logger.info("✅ TimerService 종료 완료");
  }

  // =========================== 유틸리티 메서드 ===========================

  /**
   * 세션 ID 생성
   */
  generateSessionId() {
    return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 경과 시간 포맷팅
   */
  formatElapsedTime(minutes) {
    if (minutes < 60) {
      return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  }

  /**
   * 히스토리 추가
   */
  addToHistory(userId, entry) {
    if (!this.sessionHistory[userId]) {
      this.sessionHistory[userId] = {
        sessions: [],
        totalSessions: 0,
        totalWorkTime: 0,
        totalBreakTime: 0
      };
    }

    this.sessionHistory[userId].sessions.push(entry);
    
    // 오래된 히스토리 정리 (30일 이상)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxHistoryDays);
    
    this.sessionHistory[userId].sessions = this.sessionHistory[userId].sessions.filter(
      session => session.timestamp > cutoffDate
    );
  }

  /**
   * 백업에서 복원
   */
  async restoreFromBackup() {
    try {
      // Railway 환경변수에서 복원 (실제로는 로그 기반)
      logger.info("🔄 타이머 백업 복원 시도...");
      
      // 실제 구현에서는 데이터베이스나 Redis 등을 사용
      // 현재는 메모리 초기화
      this.sessionHistory = {};
      
      logger.info("📊 새로운 세션으로 시작");
    } catch (error) {
      logger.warn("백업 복원 실패 (신규 시작):", error.message);
      this.sessionHistory = {};
    }
  }

  /**
   * 백업 저장
   */
  saveToBackup() {
    try {
      const backupData = {
        timers: {},
        sessions: {},
        timestamp: new Date().toISOString(),
        version: "3.0.1"
      };

      // 활성 타이머 백업
      this.timers.forEach((timer, userId) => {
        backupData.timers[userId] = {
          ...timer,
          startTime: timer.startTime.toISOString(),
          elapsedMinutes: Math.floor((TimeHelper.getKoreaTime() - timer.startTime) / 60000)
        };
      });

      // 포모도로 세션 백업
      this.pomodoroSessions.forEach((session, userId) => {
        backupData.sessions[userId] = session;
      });

      // 로그를 통한 백업 (개발자가 수동으로 복원 가능)
      this.lastBackup = backupData;
      
      logger.info("📦 타이머 백업 생성:", {
        activeTimers: Object.keys(backupData.timers).length,
        activeSessions: Object.keys(backupData.sessions).length,
        timestamp: backupData.timestamp
      });

      return true;
    } catch (error) {
      logger.error("백업 저장 실패:", error);
      return false;
    }
  }

  /**
   * 주기적 백업 설정
   */
  setupPeriodicBackup() {
    setInterval(() => {
      if (this.timers.size > 0 || this.pomodoroSessions.size > 0) {
        this.saveToBackup();
      }
    }, this.config.autoSaveInterval);

    logger.info(`⚙️ 자동 백업 설정: ${this.config.autoSaveInterval / 1000}초마다`);
  }

  /**
   * 안전한 종료 처리
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      this.shutdown();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("beforeExit", shutdown);
  }
}

module.exports = TimerService;
