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
      session.startTime = TimeHelper.getKoreaTime();

      this.timers.set(userId, {
        taskName,
        startTime: TimeHelper.getKoreaTime(),
        type: "pomodoro",
        duration: 25, // 25분
        mode: "work",
      });

      Logger.info(`🍅 포모도로 시작: 사용자 ${userId}, 작업 "${taskName}"`);

      return {
        success: true,
        data: {
          taskName,
          duration: 25,
          mode: "work",
          sessionCount: session.count + 1,
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

      const now = TimeHelper.getKoreaTime();
      const elapsed = Math.floor((now - timer.startTime) / 60000);
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

      const now = TimeHelper.getKoreaTime();
      const duration = Math.floor((now - timer.startTime) / 60000);

      let nextMode, nextDuration, message;

      if (timer.mode === "work") {
        // 작업 완료 -> 휴식 시작
        session.count++;
        session.totalWorkTime += duration;
        nextMode = "break";
        nextDuration = 5;
        message = `🎉 포모도로 완료! ${session.count}번째 세션을 마쳤습니다.\n5분간 휴식하세요!`;
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

      return {
        success: true,
        data: {
          completedMode: timer.mode === "work" ? "break" : "work",
          nextMode,
          nextDuration,
          sessionCount: session.count,
          message,
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

  // 포모도로 중지
  stopPomodoro(userId) {
    try {
      const timer = this.timers.get(userId);
      const session = this.pomodoroSessions.get(userId);

      if (!timer || timer.type !== "pomodoro") {
        return {
          success: false,
          error: "실행 중인 포모도로가 없습니다.",
        };
      }

      const duration = Math.floor(
        (TimeHelper.getKoreaTime() - timer.startTime) / 60000,
      );
      this.timers.delete(userId);

      Logger.info(
        `🛑 포모도로 중지: 사용자 ${userId}, 세션 ${session.count}개 완료`,
      );

      return {
        success: true,
        data: {
          taskName: timer.taskName,
          totalSessions: session.count,
          totalWorkTime: session.totalWorkTime,
          totalBreakTime: session.totalBreakTime,
          lastDuration: duration,
        },
      };
    } catch (error) {
      Logger.error("⛔ 포모도로 중지 오류:", error);
      return {
        success: false,
        error: "포모도로 중지 중 오류가 발생했습니다.",
      };
    }
  }

  // 기존 메서드들...
}

module.exports = { TimerService };
