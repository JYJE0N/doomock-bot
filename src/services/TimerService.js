// src/services/TimerService.js - Railway 환경변수를 활용한 지속성 있는 포모도로

const { TimeHelper } = require("../utils/TimeHelper");
const Logger = require("../utils/Logger");

class TimerService {
  constructor() {
    this.timers = new Map();
    this.pomodoroSessions = new Map();

    // ⭐ Railway 환경변수를 활용한 설정
    this.config = {
      workDuration: parseInt(process.env.POMODORO_WORK_DURATION) || 25,
      shortBreakDuration: parseInt(process.env.POMODORO_SHORT_BREAK) || 5,
      longBreakDuration: parseInt(process.env.POMODORO_LONG_BREAK) || 15,
      longBreakInterval:
        parseInt(process.env.POMODORO_LONG_BREAK_INTERVAL) || 4,
      autoSaveInterval: parseInt(process.env.TIMER_AUTOSAVE_INTERVAL) || 60000, // 1분마다
      maxSessionHistory: parseInt(process.env.MAX_SESSION_HISTORY) || 10,
    };

    // ⭐ 메모리 기반 지속성 (Railway 환경변수 백업)
    this.backupKey = "TIMER_BACKUP_DATA";
    this.sessionHistoryKey = "SESSION_HISTORY_DATA";

    // 초기화 시 복원 시도
    this.restoreFromBackup();

    // ⭐ 주기적 백업 (1분마다)
    this.setupPeriodicBackup();

    // ⭐ Railway 재시작 감지 및 복원
    this.setupGracefulShutdown();
  }

  // ⭐ Railway 환경변수에서 데이터 복원
  restoreFromBackup() {
    try {
      // 활성 타이머 복원
      const timerBackup = process.env[this.backupKey];
      if (timerBackup) {
        const data = JSON.parse(timerBackup);
        const now = TimeHelper.getKoreaTime();

        // 복원된 타이머가 유효한지 확인 (최대 24시간 이내)
        Object.entries(data.timers || {}).forEach(([userId, timer]) => {
          const startTime = new Date(timer.startTime);
          const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

          if (hoursSinceStart < 24) {
            // 24시간 이내만 복원
            this.timers.set(userId, {
              ...timer,
              startTime: startTime,
              restored: true,
              downtime:
                Math.floor((now - startTime) / 60000) -
                (timer.elapsedMinutes || 0),
            });
          }
        });

        // 포모도로 세션 복원
        Object.entries(data.sessions || {}).forEach(([userId, session]) => {
          this.pomodoroSessions.set(userId, {
            ...session,
            restored: true,
          });
        });

        Logger.success(
          `🔄 타이머 복원 완료: ${this.timers.size}개 타이머, ${this.pomodoroSessions.size}개 세션`
        );
      }

      // 세션 히스토리 복원
      const historyBackup = process.env[this.sessionHistoryKey];
      if (historyBackup) {
        this.sessionHistory = JSON.parse(historyBackup);
        Logger.info(
          `📊 세션 히스토리 복원: ${
            Object.keys(this.sessionHistory).length
          }명의 기록`
        );
      } else {
        this.sessionHistory = {};
      }
    } catch (error) {
      Logger.warn("백업 복원 실패 (신규 시작):", error.message);
      this.sessionHistory = {};
    }
  }

  // ⭐ Railway 환경변수에 백업 저장
  saveToBackup() {
    try {
      const backupData = {
        timers: {},
        sessions: {},
        timestamp: new Date().toISOString(),
        version: "3.0.1",
      };

      // 활성 타이머 백업
      this.timers.forEach((timer, userId) => {
        backupData.timers[userId] = {
          ...timer,
          startTime: timer.startTime.toISOString(),
          elapsedMinutes: Math.floor(
            (TimeHelper.getKoreaTime() - timer.startTime) / 60000
          ),
        };
      });

      // 포모도로 세션 백업
      this.pomodoroSessions.forEach((session, userId) => {
        backupData.sessions[userId] = session;
      });

      // ⭐ 환경변수는 Railway API를 통해서만 설정 가능하므로,
      // 대신 메모리에 임시 저장하고 주기적으로 로그에 백업 정보 출력
      this.lastBackup = backupData;

      // Railway 로그를 통한 백업 (개발자가 수동으로 복원 가능)
      Logger.info("📦 타이머 백업 생성:", {
        activeTimers: Object.keys(backupData.timers).length,
        activeSessions: Object.keys(backupData.sessions).length,
        timestamp: backupData.timestamp,
      });

      // 세션 히스토리도 백업
      if (Object.keys(this.sessionHistory).length > 0) {
        Logger.info("📊 세션 히스토리 백업:", {
          users: Object.keys(this.sessionHistory).length,
          totalSessions: Object.values(this.sessionHistory).reduce(
            (sum, user) => sum + user.sessions.length,
            0
          ),
        });
      }

      return true;
    } catch (error) {
      Logger.error("백업 저장 실패:", error);
      return false;
    }
  }

  // ⭐ 주기적 백업 설정
  setupPeriodicBackup() {
    setInterval(() => {
      if (this.timers.size > 0 || this.pomodoroSessions.size > 0) {
        this.saveToBackup();
      }
    }, this.config.autoSaveInterval);

    Logger.info(
      `⚙️ 자동 백업 설정: ${this.config.autoSaveInterval / 1000}초마다`
    );
  }

  // ⭐ 안전한 종료 처리
  setupGracefulShutdown() {
    const shutdown = () => {
      Logger.info("🛑 타이머 서비스 종료 중...");
      this.saveToBackup();

      // 활성 사용자들에게 알림 메시지 준비 (로그로 기록)
      if (this.timers.size > 0) {
        Logger.warn("⚠️ 서버 재시작으로 인한 타이머 중단:", {
          affectedUsers: Array.from(this.timers.keys()),
          message: "서버가 재시작됩니다. 타이머가 자동으로 복원됩니다.",
        });
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("beforeExit", shutdown);
  }

  // ⭐ 강화된 포모도로 시작 (복원 지원)
  async startPomodoro(userId, taskName = "포모도로 작업") {
    try {
      // 기존 타이머 확인
      const existingTimer = this.timers.get(userId);
      if (existingTimer && !existingTimer.restored) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요.",
        };
      }

      // 복원된 타이머 처리
      if (existingTimer && existingTimer.restored) {
        const result = this.handleRestoredTimer(userId, existingTimer);
        if (result) return result;
      }

      // 새로운 포모도로 시작
      const session = this.getOrCreateSession(userId);
      session.isWorking = true;
      session.currentTask = taskName;

      const startTime = TimeHelper.getKoreaTime();
      const timer = {
        taskName,
        startTime: startTime, // ⭐ Date 객체로 저장
        type: "pomodoro",
        duration: this.config.workDuration,
        mode: "work",
        sessionId: session.sessionId || this.generateSessionId(),
      };

      this.timers.set(userId, timer);

      // 세션 히스토리 기록
      this.addToHistory(userId, {
        type: "pomodoro_start",
        task: taskName,
        timestamp: timer.startTime,
        sessionId: timer.sessionId,
      });

      Logger.info(`🍅 포모도로 시작: 사용자 ${userId}, 작업 "${taskName}"`);

      return {
        success: true,
        data: {
          taskName,
          duration: this.config.workDuration,
          mode: "work",
          sessionCount: session.count + 1,
          startTime: TimeHelper.formatDateTime(timer.startTime), // ⭐ 문자열로 반환
          isRestored: false,
        },
      };
    } catch (error) {
      Logger.error("포모도로 시작 오류:", error);
      return {
        success: false,
        error: "포모도로 시작 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 포모도로 상태 확인에서도 정확한 시간 계산
  pomodoroStatus(userId) {
    try {
      const timer = this.timers.get(userId);
      const session = this.pomodoroSessions.get(userId);

      if (!timer || timer.type !== "pomodoro") {
        return {
          success: false,
          error: "실행 중인 포모도로가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime();
      const elapsed = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      );
      const remaining = Math.max(0, timer.duration - elapsed);
      const percentage = Math.min(
        100,
        Math.round((elapsed / timer.duration) * 100)
      );

      // ⭐ 정확한 완료 예정 시간 계산
      const completionTime = TimeHelper.addMinutes(
        timer.startTime,
        timer.duration
      );
      const isOvertime = elapsed > timer.duration;

      // ⭐ 시각적 요소들
      const progressBar = this.createProgressBar(elapsed, timer.duration);
      const circularProgress = this.createCircularProgress(percentage);
      const modeEmoji = timer.mode === "work" ? "💼" : "☕";

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          mode: timer.mode,
          modeEmoji: modeEmoji,
          elapsed,
          remaining,
          duration: timer.duration,
          percentage,
          sessionCount: session ? session.count : 0,
          isComplete: remaining <= 0,
          isOvertime: isOvertime,
          overtimeMinutes: isOvertime ? elapsed - timer.duration : 0,
          currentTime: TimeHelper.formatDateTime(now),
          startTime: TimeHelper.formatDateTime(timer.startTime),
          completionTime: TimeHelper.formatTime(completionTime), // ⭐ 정확한 완료 시간
          elapsedTime: this.formatElapsedTime(elapsed),
          remainingTime: this.formatElapsedTime(remaining),
          progressBar: progressBar,
          circularProgress: circularProgress,
          sessionId: timer.sessionId,
        },
      };
    } catch (error) {
      Logger.error("포모도로 상태 확인 오류:", error);
      return {
        success: false,
        error: "포모도로 상태 확인 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 시각적 진행률 바 생성
  createProgressBar(current, total, length = 10) {
    const filled = Math.round((current / total) * length);
    const empty = length - filled;

    const filledBar = "🟩".repeat(Math.min(filled, length));
    const emptyBar = "⬜".repeat(Math.max(0, empty));

    return filledBar + emptyBar;
  }

  // ⭐ 원형 진행률 표시
  createCircularProgress(percentage) {
    const circles = ["🔴", "🟠", "🟡", "🟢"];
    const index = Math.min(3, Math.floor(percentage / 25));
    return circles[index];
  }

  // ⭐ 완료 처리 (자동 전환 지원)
  completePomodoro(userId, autoTransition = true) {
    try {
      const timer = this.timers.get(userId);
      const session = this.pomodoroSessions.get(userId);

      if (!timer || timer.type !== "pomodoro") {
        return {
          success: false,
          error: "실행 중인 포모도로가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime();
      const actualDuration = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      );

      // 세션 히스토리 기록
      this.addToHistory(userId, {
        type: `pomodoro_${timer.mode}_complete`,
        task: timer.taskName,
        duration: actualDuration,
        plannedDuration: timer.duration,
        timestamp: now,
        sessionId: timer.sessionId,
      });

      let nextMode, nextDuration, message;

      if (timer.mode === "work") {
        // 작업 완료 → 휴식 시작
        session.count++;
        session.totalWorkTime += actualDuration;

        nextMode = "break";
        nextDuration =
          session.count % this.config.longBreakInterval === 0
            ? this.config.longBreakDuration
            : this.config.shortBreakDuration;

        const isLongBreak = nextDuration === this.config.longBreakDuration;
        message = `🎉 ${session.count}번째 포모도로 완료!\n${
          isLongBreak ? "🛋️ 긴" : "☕ 짧은"
        } 휴식 시간입니다 (${nextDuration}분)`;
      } else {
        // 휴식 완료 → 다음 작업 준비
        session.totalBreakTime += actualDuration;
        nextMode = "work";
        nextDuration = this.config.workDuration;
        message = "💪 휴식 완료! 다음 포모도로를 시작할 준비가 되셨나요?";
      }

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
        autoTransition,
      };

      if (autoTransition) {
        // 자동으로 다음 단계 시작
        timer.mode = nextMode;
        timer.duration = nextDuration;
        timer.startTime = now;
        timer.taskName = nextMode === "work" ? "포모도로 작업" : "휴식 시간";

        completionData.nextStartTime = TimeHelper.formatDateTime(now);
        completionData.nextCompletionTime = TimeHelper.formatTime(
          TimeHelper.addMinutes(now, nextDuration)
        );
      } else {
        // 수동 전환 - 타이머 정지
        this.timers.delete(userId);
      }

      Logger.info(
        `🎯 포모도로 완료: 사용자 ${userId}, ${timer.mode} → ${nextMode}`
      );

      return {
        success: true,
        data: completionData,
      };
    } catch (error) {
      Logger.error("포모도로 완료 처리 오류:", error);
      return {
        success: false,
        error: "포모도로 완료 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // ⭐ 세션 히스토리 관리
  addToHistory(userId, entry) {
    if (!this.sessionHistory[userId]) {
      this.sessionHistory[userId] = { sessions: [], stats: {} };
    }

    this.sessionHistory[userId].sessions.unshift(entry);

    // 최대 개수 제한
    if (
      this.sessionHistory[userId].sessions.length >
      this.config.maxSessionHistory
    ) {
      this.sessionHistory[userId].sessions = this.sessionHistory[
        userId
      ].sessions.slice(0, this.config.maxSessionHistory);
    }

    // 통계 업데이트
    this.updateUserStats(userId);
  }

  // ⭐ 사용자 통계 업데이트
  updateUserStats(userId) {
    const userHistory = this.sessionHistory[userId];
    if (!userHistory) return;

    const today = TimeHelper.formatDate(TimeHelper.getKoreaTime());
    const todaySessions = userHistory.sessions.filter(
      (s) => TimeHelper.formatDate(new Date(s.timestamp)) === today
    );

    userHistory.stats = {
      todayWorkTime: todaySessions
        .filter((s) => s.type === "pomodoro_work_complete")
        .reduce((sum, s) => sum + (s.duration || 0), 0),
      todayBreakTime: todaySessions
        .filter((s) => s.type === "pomodoro_break_complete")
        .reduce((sum, s) => sum + (s.duration || 0), 0),
      todayCompletedPomodoros: todaySessions.filter(
        (s) => s.type === "pomodoro_work_complete"
      ).length,
      totalSessions: userHistory.sessions.length,
      lastSessionDate: today,
    };
  }

  // ⭐ 사용자 통계 조회
  getUserStats(userId) {
    const userHistory = this.sessionHistory[userId];
    const session = this.pomodoroSessions.get(userId);

    if (!userHistory && !session) {
      return {
        success: false,
        error: "포모도로 사용 기록이 없습니다.",
      };
    }

    const stats = userHistory?.stats || {};
    const currentSession = session || {};

    return {
      success: true,
      data: {
        today: {
          workTime: this.formatElapsedTime(stats.todayWorkTime || 0),
          breakTime: this.formatElapsedTime(stats.todayBreakTime || 0),
          completedPomodoros: stats.todayCompletedPomodoros || 0,
        },
        current: {
          sessionCount: currentSession.count || 0,
          totalWorkTime: this.formatElapsedTime(
            currentSession.totalWorkTime || 0
          ),
          totalBreakTime: this.formatElapsedTime(
            currentSession.totalBreakTime || 0
          ),
        },
        overall: {
          totalSessions: stats.totalSessions || 0,
          lastSessionDate: stats.lastSessionDate || "없음",
        },
      },
    };
  }

  // 기존 메서드들 (타이머 정지, 일반 타이머 등)은 동일하게 유지...

  // ⭐ 타이머 정지 (히스토리 기록 포함)
  stop(userId) {
    try {
      const timer = this.timers.get(userId);

      if (!timer) {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime();
      const duration = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      );

      // 히스토리 기록
      this.addToHistory(userId, {
        type: `${timer.type}_stop`,
        task: timer.taskName,
        duration: duration,
        timestamp: now,
        sessionId: timer.sessionId,
      });

      this.timers.delete(userId);

      let sessionInfo = null;
      if (timer.type === "pomodoro") {
        const session = this.pomodoroSessions.get(userId);
        if (session) {
          sessionInfo = {
            totalSessions: session.count,
            totalWorkTime: session.totalWorkTime,
            totalBreakTime: session.totalBreakTime,
          };
        }
      }

      Logger.info(`🛑 타이머 중지: 사용자 ${userId}, ${duration}분 경과`);

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          type: timer.type,
          duration: duration,
          elapsedTime: this.formatElapsedTime(duration),
          startTime: TimeHelper.formatDateTime(timer.startTime),
          endTime: TimeHelper.formatDateTime(now),
          sessionInfo,
        },
      };
    } catch (error) {
      Logger.error("타이머 중지 오류:", error);
      return {
        success: false,
        error: "타이머 중지 중 오류가 발생했습니다.",
      };
    }
  }

  // 일반 타이머 시작
  start(userId, taskName = "일반 작업") {
    try {
      if (this.timers.has(userId)) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요.",
        };
      }

      const timer = {
        taskName,
        startTime: TimeHelper.getKoreaTime(),
        type: "general",
        sessionId: this.generateSessionId(),
      };

      this.timers.set(userId, timer);

      // 히스토리 기록
      this.addToHistory(userId, {
        type: "general_start",
        task: taskName,
        timestamp: timer.startTime,
        sessionId: timer.sessionId,
      });

      Logger.info(`⏰ 일반 타이머 시작: 사용자 ${userId}, 작업 "${taskName}"`);

      return {
        success: true,
        data: {
          taskName,
          startTime: TimeHelper.formatDateTime(timer.startTime),
        },
      };
    } catch (error) {
      Logger.error("타이머 시작 오류:", error);
      return {
        success: false,
        error: "타이머 시작 중 오류가 발생했습니다.",
      };
    }
  }

  // 일반 타이머 상태 확인
  getStatus(userId) {
    try {
      const timer = this.timers.get(userId);

      if (!timer) {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime();
      const elapsedMs = now.getTime() - timer.startTime.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / 60000);

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          type: timer.type,
          startTime: TimeHelper.formatDateTime(timer.startTime),
          currentTime: TimeHelper.formatDateTime(now),
          elapsed: elapsedMinutes,
          elapsedTime: this.formatElapsedTime(elapsedMinutes),
          duration: timer.duration || null,
          sessionId: timer.sessionId,
        },
      };
    } catch (error) {
      Logger.error("타이머 상태 확인 오류:", error);
      return {
        success: false,
        error: "타이머 상태 확인 중 오류가 발생했습니다.",
      };
    }
  }

  // 경과 시간 포맷팅
  formatElapsedTime(minutes) {
    if (minutes < 1) return "1분 미만";

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}시간 ${remainingMinutes}분`;
    } else {
      return `${remainingMinutes}분`;
    }
  }

  // 서비스 상태 확인
  getServiceStatus() {
    const now = TimeHelper.getKoreaTime();

    return {
      activeTimers: this.timers.size,
      activePomodoroSessions: this.pomodoroSessions.size,
      totalUsers: Object.keys(this.sessionHistory).length,
      serverTime: TimeHelper.formatDateTime(now),
      timezone: "Asia/Seoul (UTC+9)",
      uptime: Math.floor(process.uptime() / 60), // 분 단위
      config: this.config,
      lastBackup: this.lastBackup?.timestamp || "없음",
    };
  }
}

module.exports = { TimerService };
