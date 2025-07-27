class WorktimeService {
  constructor(options = {}) {
    this.collectionName = "worktimes";
    this.db = options.db || null;
    this.collection = null;
    this.config = {
      workStartTime: "09:00",
      workEndTime: "18:00",
      ...options.config,
    };

    logger.service("WorktimeService", "서비스 생성");
  }

  async initialize() {
    if (!this.db) {
      throw new Error("Database connection required");
    }

    this.collection = this.db.collection(this.collectionName);
    await this.createIndexes();
    logger.success("WorktimeService 초기화 완료");
  }

  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, date: -1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
    } catch (error) {
      logger.warn("근무시간 인덱스 생성 실패", error.message);
    }
  }

  async checkIn(userId) {
    try {
      const today = TimeHelper.format(TimeHelper.now(), "YYYY-MM-DD");

      // 오늘 출근 기록 확인
      const existingRecord = await this.collection.findOne({
        userId,
        date: today,
        isActive: true,
      });

      if (existingRecord && existingRecord.checkInTime) {
        throw new Error("이미 출근 처리되었습니다.");
      }

      const now = TimeHelper.now();
      const checkInData = {
        userId,
        date: today,
        checkInTime: now,
        checkOutTime: null,

        // 표준 필드
        createdAt: now,
        updatedAt: now,
        version: 1,
        isActive: true,
      };

      if (existingRecord) {
        // 기존 레코드 업데이트
        await this.collection.updateOne(
          { _id: existingRecord._id },
          { $set: { checkInTime: now, updatedAt: now, $inc: { version: 1 } } }
        );
      } else {
        // 새 레코드 생성
        await this.collection.insertOne(checkInData);
      }

      logger.data("worktime", "checkin", userId, { date: today });
      return {
        success: true,
        checkInTime: now,
        message: "출근 처리되었습니다.",
      };
    } catch (error) {
      logger.error("출근 처리 실패", error);
      throw error;
    }
  }

  async checkOut(userId) {
    try {
      const today = TimeHelper.format(TimeHelper.now(), "YYYY-MM-DD");

      const record = await this.collection.findOne({
        userId,
        date: today,
        isActive: true,
        checkInTime: { $exists: true },
      });

      if (!record) {
        throw new Error("출근 기록이 없습니다.");
      }

      if (record.checkOutTime) {
        throw new Error("이미 퇴근 처리되었습니다.");
      }

      const now = TimeHelper.now();
      const workDuration = Math.round((now - record.checkInTime) / (1000 * 60)); // 분 단위

      await this.collection.updateOne(
        { _id: record._id },
        {
          $set: {
            checkOutTime: now,
            workDuration,
            updatedAt: now,
            $inc: { version: 1 },
          },
        }
      );

      logger.data("worktime", "checkout", userId, {
        date: today,
        duration: workDuration,
      });

      return {
        success: true,
        checkOutTime: now,
        workDuration,
        message: "퇴근 처리되었습니다.",
      };
    } catch (error) {
      logger.error("퇴근 처리 실패", error);
      throw error;
    }
  }

  async getTodayStatus(userId) {
    try {
      const today = TimeHelper.format(TimeHelper.now(), "YYYY-MM-DD");

      const record = await this.collection.findOne({
        userId,
        date: today,
        isActive: true,
      });

      const status = {
        date: today,
        isCheckedIn: !!(record && record.checkInTime),
        isCheckedOut: !!(record && record.checkOutTime),
        checkInTime: record?.checkInTime || null,
        checkOutTime: record?.checkOutTime || null,
        workDuration: record?.workDuration || 0,
      };

      logger.data("worktime", "status", userId, status);
      return status;
    } catch (error) {
      logger.error("오늘 근무 상태 조회 실패", error);
      throw error;
    }
  }

  async getTodayWorktime(userId) {
    try {
      const status = await this.getTodayStatus(userId);

      // 현재 근무 시간 계산 (진행중인 경우)
      if (status.isCheckedIn && !status.isCheckedOut) {
        const now = TimeHelper.now();
        status.currentWorkDuration = Math.round(
          (now - status.checkInTime) / (1000 * 60)
        );
      }

      return status;
    } catch (error) {
      logger.error("오늘 근무시간 조회 실패", error);
      throw error;
    }
  }

  async cleanup() {
    logger.info("WorktimeService 정리 완료");
  }
}

module.exports = WorktimeService;
