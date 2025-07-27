class TimerService {
  constructor(options = {}) {
    this.collectionName = "timers";
    this.db = options.db || null;
    this.collection = null;
    this.config = {
      defaultDuration: 25, // 25분
      ...options.config,
    };

    // 활성 타이머 메모리 관리
    this.activeTimers = new Map();

    logger.service("TimerService", "서비스 생성");
  }

  async initialize() {
    if (!this.db) {
      throw new Error("Database connection required");
    }

    this.collection = this.db.collection(this.collectionName);
    await this.createIndexes();
    logger.success("TimerService 초기화 완료");
  }

  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, isActive: 1 });
    } catch (error) {
      logger.warn("타이머 인덱스 생성 실패", error.message);
    }
  }

  async startTimer(userId, duration = null) {
    try {
      // 기존 활성 타이머 확인
      const existingTimer = this.activeTimers.get(userId);
      if (existingTimer) {
        throw new Error("이미 실행 중인 타이머가 있습니다.");
      }

      const timerDuration = duration || this.config.defaultDuration;
      const startTime = TimeHelper.now();
      const endTime = new Date(startTime.getTime() + timerDuration * 60 * 1000);

      const timer = {
        userId,
        duration: timerDuration,
        startTime,
        endTime,
        isCompleted: false,

        // 표준 필드
        createdAt: startTime,
        updatedAt: startTime,
        version: 1,
        isActive: true,
      };

      const result = await this.collection.insertOne(timer);

      // 메모리에 활성 타이머 저장
      this.activeTimers.set(userId, {
        _id: result.insertedId,
        startTime,
        endTime,
        duration: timerDuration,
      });

      logger.data("timer", "start", userId, { duration: timerDuration });
      return {
        success: true,
        timerId: result.insertedId,
        duration: timerDuration,
        endTime,
      };
    } catch (error) {
      logger.error("타이머 시작 실패", error);
      throw error;
    }
  }

  async stopTimer(userId) {
    try {
      const activeTimer = this.activeTimers.get(userId);
      if (!activeTimer) {
        throw new Error("실행 중인 타이머가 없습니다.");
      }

      const stopTime = TimeHelper.now();
      const actualDuration = Math.round(
        (stopTime - activeTimer.startTime) / (1000 * 60)
      );

      await this.collection.updateOne(
        { _id: activeTimer._id },
        {
          $set: {
            stopTime,
            actualDuration,
            isCompleted: true,
            updatedAt: stopTime,
            $inc: { version: 1 },
          },
        }
      );

      // 메모리에서 제거
      this.activeTimers.delete(userId);

      logger.data("timer", "stop", userId, { actualDuration });
      return {
        success: true,
        actualDuration,
        stopTime,
      };
    } catch (error) {
      logger.error("타이머 정지 실패", error);
      throw error;
    }
  }

  async getTimerStatus(userId) {
    try {
      const activeTimer = this.activeTimers.get(userId);

      if (!activeTimer) {
        return {
          isActive: false,
          message: "실행 중인 타이머가 없습니다.",
        };
      }

      const now = TimeHelper.now();
      const remaining = Math.max(
        0,
        Math.round((activeTimer.endTime - now) / (1000 * 60))
      );
      const elapsed = Math.round((now - activeTimer.startTime) / (1000 * 60));

      return {
        isActive: true,
        duration: activeTimer.duration,
        elapsed,
        remaining,
        endTime: activeTimer.endTime,
      };
    } catch (error) {
      logger.error("타이머 상태 조회 실패", error);
      throw error;
    }
  }

  async getDetailedStatus(userId) {
    try {
      const status = await this.getTimerStatus(userId);

      // 오늘 완료된 타이머 개수
      const today = TimeHelper.format(TimeHelper.now(), "YYYY-MM-DD");
      const todayCount = await this.collection.countDocuments({
        userId,
        isCompleted: true,
        createdAt: {
          $gte: new Date(today),
          $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000),
        },
      });

      return {
        ...status,
        todayCompleted: todayCount,
      };
    } catch (error) {
      logger.error("상세 타이머 상태 조회 실패", error);
      throw error;
    }
  }

  async cleanup() {
    this.activeTimers.clear();
    logger.info("TimerService 정리 완료");
  }
}

module.exports = TimerService;
