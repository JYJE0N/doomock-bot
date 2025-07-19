// src/services/TimerService.js - 정확한 한국시간 적용

const { TimeHelper } = require("../utils/TimeHelper");
const { Logger } = require("../utils/Logger");

class TimerService {
  constructor() {
    this.timers = new Map(); // userId -> { taskName, startTime, type }
    this.pomodoroSessions = new Map(); // userId -> { count, isWorking, startTime }
  }

  // 포모도로 시작
  startPomodoro(userId, taskName = "포모도로 작업") {
    try {
      // 기존 타이머 확인
      if (this.timers.has(userId)) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요.",
        };
      }

      // 포모도로 세션 초기화
      if (!this.pomodoroSessions.has(userId)) {
        this.pomodoroSessions.set(userId, {
          count: 0,
          isWorking: true,
          totalWorkTime: 0,
          totalBreakTime: 0,
        });
      }

      const session = this.pomodoroSessions.get(userId);
      session.isWorking = true;
      session.startTime = TimeHelper.getKoreaTime(); // ⭐ 한국시간 사용

      this.timers.set(userId, {
        taskName,
        startTime: TimeHelper.getKoreaTime(), // ⭐ 한국시간 사용
        type: "pomodoro",
        duration: 25, // 25분
        mode: "work",
      });

      Logger.info(
        `🍅 포모도로 시작: 사용자 ${userId}, 작업 "${taskName}" (${TimeHelper.formatDateTime()})`
      );

      return {
        success: true,
        data: {
          taskName,
          duration: 25,
          mode: "work",
          sessionCount: session.count + 1,
          startTime: TimeHelper.formatDateTime(), // 시작 시간도 포함
        },
      };
    } catch (error) {
      Logger.error("⛔ 포모도로 시작 오류:", error);
      return {
        success: false,
        error: "포모도로 시작 중 오류가 발생했습니다.",
      };
    }
  }

  // 일반 타이머 시작
  start(userId, taskName = "일반 작업") {
    try {
      // 기존 타이머 확인
      if (this.timers.has(userId)) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다. 먼저 정지해주세요.",
        };
      }

      this.timers.set(userId, {
        taskName,
        startTime: TimeHelper.getKoreaTime(), // ⭐ 한국시간 사용
        type: "general",
      });

      Logger.info(
        `⏰ 일반 타이머 시작: 사용자 ${userId}, 작업 "${taskName}" (${TimeHelper.formatDateTime()})`
      );

      return {
        success: true,
        data: {
          taskName,
          startTime: TimeHelper.formatDateTime(), // 시작 시간도 포함
        },
      };
    } catch (error) {
      Logger.error("⛔ 타이머 시작 오류:", error);
      return {
        success: false,
        error: "타이머 시작 중 오류가 발생했습니다.",
      };
    }
  }

  // 포모도로 상태 확인
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

      const now = TimeHelper.getKoreaTime(); // ⭐ 한국시간 사용
      const elapsed = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      ); // 분 단위
      const remaining = timer.duration - elapsed;

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          mode: timer.mode,
          elapsed,
          remaining: Math.max(0, remaining),
          duration: timer.duration,
          sessionCount: session ? session.count : 0,
          isComplete: remaining <= 0,
          currentTime: TimeHelper.formatDateTime(now), // 현재 시간 추가
          elapsedTime: this.formatElapsedTime(elapsed), // 포맷된 경과 시간
        },
      };
    } catch (error) {
      Logger.error("⛔ 포모도로 상태 확인 오류:", error);
      return {
        success: false,
        error: "포모도로 상태 확인 중 오류가 발생했습니다.",
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

      const now = TimeHelper.getKoreaTime(); // ⭐ 한국시간 사용
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
        },
      };
    } catch (error) {
      Logger.error("⛔ 타이머 상태 확인 오류:", error);
      return {
        success: false,
        error: "타이머 상태 확인 중 오류가 발생했습니다.",
      };
    }
  }

  // 포모도로 완료/전환
  completePomodoro(userId) {
    try {
      const timer = this.timers.get(userId);
      const session = this.pomodoroSessions.get(userId);

      if (!timer || timer.type !== "pomodoro") {
        return {
          success: false,
          error: "실행 중인 포모도로가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime(); // ⭐ 한국시간 사용
      const duration = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      );

      let nextMode, nextDuration, message;

      if (timer.mode === "work") {
        // 작업 완료 -> 휴식 시작
        session.count++;
        session.totalWorkTime += duration;
        nextMode = "break";
        nextDuration = session.count % 4 === 0 ? 15 : 5; // 4번째마다 긴 휴식
        message = `🎉 포모도로 완료! ${session.count}번째 세션을 마쳤습니다.\n${nextDuration}분간 휴식하세요!`;
      } else {
        // 휴식 완료 -> 다음 작업 시작
        session.totalBreakTime += duration;
        nextMode = "work";
        nextDuration = 25;
        message = "💪 휴식 완료! 다음 포모도로를 시작할 준비가 되셨나요?";
      }

      // 타이머 업데이트
      timer.mode = nextMode;
      timer.duration = nextDuration;
      timer.startTime = now;

      Logger.info(
        `🔄 포모도로 전환: 사용자 ${userId}, ${
          timer.mode
        } 모드 시작 (${TimeHelper.formatDateTime()})`
      );

      return {
        success: true,
        data: {
          completedMode: timer.mode === "work" ? "break" : "work",
          nextMode,
          nextDuration,
          sessionCount: session.count,
          message,
          completedAt: TimeHelper.formatDateTime(now),
        },
      };
    } catch (error) {
      Logger.error("⛔ 포모도로 완료 처리 오류:", error);
      return {
        success: false,
        error: "포모도로 완료 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // 타이머 중지
  stop(userId) {
    try {
      const timer = this.timers.get(userId);

      if (!timer) {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다.",
        };
      }

      const now = TimeHelper.getKoreaTime(); // ⭐ 한국시간 사용
      const duration = Math.floor(
        (now.getTime() - timer.startTime.getTime()) / 60000
      );

      this.timers.delete(userId);

      // 포모도로인 경우 세션 정보도 가져오기
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

      Logger.info(
        `🛑 타이머 중지: 사용자 ${userId}, ${duration}분 경과 (${TimeHelper.formatDateTime()})`
      );

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
      Logger.error("⛔ 타이머 중지 오류:", error);
      return {
        success: false,
        error: "타이머 중지 중 오류가 발생했습니다.",
      };
    }
  }

  // 포모도로 세션 리셋
  resetPomodoroSession(userId) {
    try {
      this.pomodoroSessions.delete(userId);
      Logger.info(`🔄 포모도로 세션 리셋: 사용자 ${userId}`);

      return {
        success: true,
        message: "포모도로 세션이 초기화되었습니다.",
      };
    } catch (error) {
      Logger.error("⛔ 포모도로 세션 리셋 오류:", error);
      return {
        success: false,
        error: "세션 리셋 중 오류가 발생했습니다.",
      };
    }
  }

  // 경과 시간 포맷팅 헬퍼
  formatElapsedTime(minutes) {
    if (minutes < 1) {
      return "1분 미만";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}시간 ${remainingMinutes}분`;
    } else {
      return `${remainingMinutes}분`;
    }
  }

  // 모든 활성 타이머 조회 (관리자용)
  getAllActiveTimers() {
    try {
      const activeTimers = [];
      const now = TimeHelper.getKoreaTime();

      for (const [userId, timer] of this.timers.entries()) {
        const elapsed = Math.floor(
          (now.getTime() - timer.startTime.getTime()) / 60000
        );

        activeTimers.push({
          userId,
          taskName: timer.taskName,
          type: timer.type,
          elapsed,
          elapsedTime: this.formatElapsedTime(elapsed),
          startTime: TimeHelper.formatDateTime(timer.startTime),
        });
      }

      return {
        success: true,
        data: {
          count: activeTimers.length,
          timers: activeTimers,
          checkTime: TimeHelper.formatDateTime(now),
        },
      };
    } catch (error) {
      Logger.error("⛔ 활성 타이머 조회 오류:", error);
      return {
        success: false,
        error: "활성 타이머 조회 중 오류가 발생했습니다.",
      };
    }
  }

  // 서비스 상태 확인
  getServiceStatus() {
    const now = TimeHelper.getKoreaTime();

    return {
      activeTimers: this.timers.size,
      activePomodoroSessions: this.pomodoroSessions.size,
      serverTime: TimeHelper.formatDateTime(now),
      timezone: "Asia/Seoul (UTC+9)",
      uptime: process.uptime(),
    };
  }
}

module.exports = { TimerService };
