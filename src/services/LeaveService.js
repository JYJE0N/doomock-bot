class LeaveService {
  constructor(options = {}) {
    this.collectionName = "leaves";
    this.db = options.db || null;
    this.collection = null;
    this.config = {
      annualLeaveDays: 15,
      ...options.config,
    };

    logger.service("LeaveService", "서비스 생성");
  }

  async initialize() {
    if (!this.db) {
      throw new Error("Database connection required");
    }

    this.collection = this.db.collection(this.collectionName);
    await this.createIndexes();
    logger.success("LeaveService 초기화 완료");
  }

  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, year: -1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
    } catch (error) {
      logger.warn("연차 인덱스 생성 실패", error.message);
    }
  }

  async useLeave(userId, days, reason = "") {
    try {
      const currentYear = new Date().getFullYear();

      // 현재 연도 연차 상태 확인
      const leaveStatus = await this.getLeaveStatus(userId, currentYear);

      if (leaveStatus.remaining < days) {
        throw new Error("잔여 연차가 부족합니다.");
      }

      const leaveRecord = {
        userId,
        year: currentYear,
        days: parseFloat(days),
        reason: reason.trim(),
        usedDate: TimeHelper.now(),

        // 표준 필드
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: 1,
        isActive: true,
      };

      const result = await this.collection.insertOne(leaveRecord);

      logger.data("leave", "use", userId, { days, year: currentYear });
      return result;
    } catch (error) {
      logger.error("연차 사용 실패", error);
      throw error;
    }
  }

  async getLeaveStatus(userId, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();

      const pipeline = [
        { $match: { userId, year: targetYear, isActive: true } },
        { $group: { _id: null, totalUsed: { $sum: "$days" } } },
      ];

      const result = await this.collection.aggregate(pipeline).toArray();
      const totalUsed = result[0]?.totalUsed || 0;
      const remaining = this.config.annualLeaveDays - totalUsed;

      const status = {
        year: targetYear,
        total: this.config.annualLeaveDays,
        used: totalUsed,
        remaining: Math.max(0, remaining),
        usageRate: Math.round((totalUsed / this.config.annualLeaveDays) * 100),
      };

      logger.data("leave", "status", userId, status);
      return status;
    } catch (error) {
      logger.error("연차 상태 조회 실패", error);
      throw error;
    }
  }

  async getDetailedStatus(userId) {
    try {
      const currentStatus = await this.getLeaveStatus(userId);

      // 이번 달 사용 연차
      const currentMonth = TimeHelper.format(TimeHelper.now(), "YYYY-MM");
      const monthlyUsed = await this.collection
        .aggregate([
          {
            $match: {
              userId,
              isActive: true,
              usedDate: {
                $gte: new Date(currentMonth + "-01"),
                $lt: new Date(
                  new Date(currentMonth + "-01").getFullYear(),
                  new Date(currentMonth + "-01").getMonth() + 1,
                  1
                ),
              },
            },
          },
          { $group: { _id: null, total: { $sum: "$days" } } },
        ])
        .toArray();

      return {
        ...currentStatus,
        thisMonth: monthlyUsed[0]?.total || 0,
      };
    } catch (error) {
      logger.error("상세 연차 상태 조회 실패", error);
      throw error;
    }
  }

  async getLeaveHistory(userId, limit = 20) {
    try {
      const history = await this.collection
        .find({ userId, isActive: true })
        .sort({ usedDate: -1 })
        .limit(limit)
        .toArray();

      logger.data("leave", "history", userId, { count: history.length });
      return history;
    } catch (error) {
      logger.error("연차 기록 조회 실패", error);
      throw error;
    }
  }

  async cleanup() {
    logger.info("LeaveService 정리 완료");
  }
}

module.exports = LeaveService;
