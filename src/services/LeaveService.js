// src/services/LeaveService.js - 수정된 버전
const TimeHelper = require("../utils/TimeHelper");
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

class LeaveService extends BaseService {
  constructor(db) {
    super(db, "leaves");
  }

  async initializeUser(userId) {
    try {
      await ensureConnection();
      const collection = getCollection(this.collectionName);

      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      const existingUser = await collection.findOne({
        userKey: userKey,
        year: currentYear,
      });

      if (!existingUser) {
        const newUser = {
          userKey: userKey,
          userId: userId.toString(),
          year: currentYear,
          totalLeaves: 15,
          usedLeaves: 0,
          remainingLeaves: 15,
          leaveHistory: [],
          createdAt: TimeHelper.getKoreaTime(),
          updatedAt: TimeHelper.getKoreaTime(),
        };

        await collection.insertOne(newUser);
        logger.info(`사용자 ${userId} 연차 정보 초기화 완료`);
      }
    } catch (error) {
      logger.error(`사용자 ${userId} 초기화 실패:`, error);
      throw error;
    }
  }

  async getUserLeaves(userId) {
    try {
      await ensureConnection();
      const collection = getCollection(this.collectionName);

      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      let user = await collection.findOne({
        userKey: userKey,
        year: currentYear,
      });

      if (!user) {
        await this.initializeUser(userId);
        user = await collection.findOne({
          userKey: userKey,
          year: currentYear,
        });
      }

      return user;
    } catch (error) {
      logger.error(`사용자 ${userId} 연차 정보 조회 실패:`, error);
      throw error;
    }
  }

  async setTotalLeaves(userId, totalLeaves) {
    try {
      await ensureConnection();
      const collection = getCollection(this.collectionName);

      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      await this.initializeUser(userId);

      const user = await this.getUserLeaves(userId);
      const newRemaining = totalLeaves - user.usedLeaves;

      await collection.updateOne(
        { userKey: userKey, year: currentYear },
        {
          $set: {
            totalLeaves: totalLeaves,
            remainingLeaves: newRemaining,
            updatedAt: TimeHelper.getKoreaTime(),
          },
        }
      );

      logger.info(`사용자 ${userId} 총 연차 ${totalLeaves}일로 설정`);
      return { totalLeaves, remainingLeaves: newRemaining };
    } catch (error) {
      logger.error(`사용자 ${userId} 연차 설정 실패:`, error);
      throw error;
    }
  }

  async useLeave(userId, days, reason = "") {
    try {
      await ensureConnection();
      const collection = getCollection(this.collectionName);

      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      const user = await this.getUserLeaves(userId);

      if (user.remainingLeaves < days) {
        throw new Error(
          `잔여 연차가 부족합니다. (잔여: ${user.remainingLeaves}일)`
        );
      }

      const newUsed = user.usedLeaves + days;
      const newRemaining = user.remainingLeaves - days;

      const leaveRecord = {
        date: TimeHelper.getKoreaTime(),
        days: days,
        reason: reason,
        type: days === 0.5 ? "반차" : "연차",
      };

      await collection.updateOne(
        { userKey: userKey, year: currentYear },
        {
          $set: {
            usedLeaves: newUsed,
            remainingLeaves: newRemaining,
            updatedAt: TimeHelper.getKoreaTime(),
          },
          $push: { leaveHistory: leaveRecord },
        }
      );

      logger.info(`사용자 ${userId} 연차 ${days}일 사용 기록`);
      return {
        usedLeaves: newUsed,
        remainingLeaves: newRemaining,
        leaveRecord,
      };
    } catch (error) {
      logger.error(`사용자 ${userId} 연차 사용 실패:`, error);
      throw error;
    }
  }

  async getLeaveHistory(userId) {
    try {
      const user = await this.getUserLeaves(userId);
      return user.leaveHistory || [];
    } catch (error) {
      logger.error(`사용자 ${userId} 연차 내역 조회 실패:`, error);
      throw error;
    }
  }

  formatLeaveStatus(user) {
    if (!user) {
      return "❌ 연차 정보를 불러올 수 없습니다.";
    }

    const percentage =
      user.totalLeaves > 0
        ? ((user.usedLeaves / user.totalLeaves) * 100).toFixed(1)
        : "0.0";

    return (
      `📅 **${user.year}년 연차 현황**\n\n` +
      `🏖️ 총 연차: ${user.totalLeaves}일\n` +
      `✅ 사용한 연차: ${user.usedLeaves}일\n` +
      `⏳ 남은 연차: ${user.remainingLeaves}일\n` +
      `📊 사용률: ${percentage}%\n\n` +
      `${
        user.remainingLeaves <= 3
          ? "⚠️ 연차가 얼마 남지 않았습니다!"
          : "✨ 연차를 효율적으로 관리하세요!"
      }`
    );
  }

  formatLeaveHistory(history) {
    if (!history || history.length === 0) {
      return "📋 연차 사용 내역이 없습니다.";
    }

    let result = "📋 **연차 사용 내역**\n\n";

    const recentHistory = history.slice(-10).reverse();

    recentHistory.forEach((record, index) => {
      const date = TimeHelper.formatDate(new Date(record.date));
      const type = record.type || (record.days === 0.5 ? "반차" : "연차");
      const reason = record.reason ? ` (${record.reason})` : "";

      result += `${index + 1}. ${date} - ${type} ${record.days}일${reason}\n`;
    });

    if (history.length > 10) {
      result += `\n📝 총 ${history.length}개 중 최근 10개 표시`;
    }

    return result;
  }
}

module.exports = LeaveService;
