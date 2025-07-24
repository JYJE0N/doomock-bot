// src/services/LeaveService.js - 연차/월차/반차/반반차 통합 관리 서비스

const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const {
  ensureConnection,
  getCollection,
} = require("../database/DatabaseManager");
const logger = require("../utils/Logger");

class LeaveService extends BaseService {
  constructor() {
    super("leave_management");
    this.collectionName = "leave_management";

    // ⭐ 휴가 타입 정의 (표준화)
    this.leaveTypes = {
      ANNUAL: {
        code: "ANNUAL",
        name: "연차",
        emoji: "🏖️",
        allowedDays: [1, 0.5, 0.25], // 1일, 반일, 반반일
        deductionRate: 1.0, // 1:1 차감
      },
      MONTHLY: {
        code: "MONTHLY",
        name: "월차",
        emoji: "📅",
        allowedDays: [1, 0.5, 0.25],
        deductionRate: 1.0, // 1:1 차감
      },
      HALF_DAY: {
        code: "HALF_DAY",
        name: "반차",
        emoji: "🌅",
        allowedDays: [0.5],
        deductionRate: 0.5, // 0.5일 차감
      },
      QUARTER_DAY: {
        code: "QUARTER_DAY",
        name: "반반차",
        emoji: "⏰",
        allowedDays: [0.25],
        deductionRate: 0.25, // 0.25일 차감
      },
      SICK: {
        code: "SICK",
        name: "병가",
        emoji: "🤒",
        allowedDays: [1, 0.5, 0.25],
        deductionRate: 0, // 차감 없음 (별도 관리)
      },
    };

    // ⭐ 휴가 사용 단위 정의
    this.usageUnits = {
      1: { name: "1일", display: "하루종일", timeRange: "09:00-18:00" },
      0.5: {
        name: "0.5일",
        display: "반나절",
        timeRange: "09:00-13:00 또는 14:00-18:00",
      },
      0.25: {
        name: "0.25일",
        display: "반반나절",
        timeRange: "09:00-11:00 또는 16:00-18:00",
      },
    };
  }

  // 🎯 서비스 초기화
  async initialize() {
    try {
      await ensureConnection();
      this.collection = getCollection(this.collectionName);
      await this.createIndexes();
      logger.info("🏖️ LeaveService 초기화 완료");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  // 📊 인덱스 생성 (성능 최적화)
  async createIndexes() {
    try {
      await this.collection.createIndex({ userKey: 1 }, { unique: true });
      await this.collection.createIndex({ userId: 1, year: 1 });
      await this.collection.createIndex({ "leaveHistory.date": -1 });
      logger.info("🔍 LeaveService 인덱스 생성 완료");
    } catch (error) {
      logger.warn("⚠️ 인덱스 생성 중 일부 실패:", error.message);
    }
  }

  // 👤 사용자 연차 데이터 초기화
  async initializeUser(userId) {
    try {
      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      const existingUser = await this.collection.findOne({ userKey });
      if (existingUser) {
        return existingUser;
      }

      // ⭐ 기본 연차 15일 (신입 기준)
      const defaultLeaves = {
        userKey,
        userId,
        year: currentYear,
        totalLeaves: 15, // 총 연차
        usedLeaves: 0, // 사용 연차
        remainingLeaves: 15, // 잔여 연차

        // ⭐ 휴가 타입별 사용 현황
        leavesByType: {
          ANNUAL: { used: 0, remaining: 15 },
          MONTHLY: { used: 0, remaining: 12 }, // 월차 12일
          SICK: { used: 0, remaining: 10 }, // 병가 10일
        },

        leaveHistory: [],
        createdAt: TimeHelper.getKoreaTime(),
        updatedAt: TimeHelper.getKoreaTime(),
      };

      await this.collection.insertOne(defaultLeaves);
      logger.info(`👤 사용자 ${userId} 연차 데이터 초기화 완료`);
      return defaultLeaves;
    } catch (error) {
      logger.error(`❌ 사용자 ${userId} 초기화 실패:`, error);
      throw error;
    }
  }

  // 📊 사용자 연차 현황 조회
  async getUserLeaves(userId) {
    try {
      await this.initializeUser(userId);
      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      const user = await this.collection.findOne({ userKey });
      return this.formatUserData(user);
    } catch (error) {
      logger.error(`❌ 사용자 ${userId} 연차 조회 실패:`, error);
      throw error;
    }
  }

  // 🏖️ 휴가 사용 처리 (타입별 분기)
  async useLeave(userId, days, leaveType = "ANNUAL", reason = "") {
    try {
      // ⭐ 휴가 타입 검증
      const typeConfig = this.leaveTypes[leaveType];
      if (!typeConfig) {
        throw new Error(`지원하지 않는 휴가 타입입니다: ${leaveType}`);
      }

      // ⭐ 사용 일수 검증
      if (!typeConfig.allowedDays.includes(days)) {
        throw new Error(
          `${typeConfig.name}은 ${typeConfig.allowedDays.join(
            ", "
          )}일만 사용 가능합니다.`
        );
      }

      const user = await this.getUserLeaves(userId);
      const deductionDays = days * typeConfig.deductionRate;

      // ⭐ 잔여 연차 확인
      if (user.remainingLeaves < deductionDays) {
        throw new Error(
          `잔여 연차가 부족합니다. (잔여: ${user.remainingLeaves}일, 필요: ${deductionDays}일)`
        );
      }

      // ⭐ 휴가 기록 생성
      const leaveRecord = {
        id: this.generateLeaveId(),
        date: TimeHelper.getKoreaTime(),
        leaveType: leaveType,
        typeName: typeConfig.name,
        emoji: typeConfig.emoji,
        requestedDays: days,
        deductedDays: deductionDays,
        reason: reason.trim(),
        timeRange: this.usageUnits[days]?.timeRange || "시간 미지정",
        status: "APPROVED", // 자동 승인
        createdAt: TimeHelper.getKoreaTime(),
      };

      // ⭐ 데이터베이스 업데이트
      const result = await this.updateUserLeaves(
        userId,
        deductionDays,
        leaveRecord,
        leaveType
      );

      logger.info(
        `🏖️ ${user.userId} ${typeConfig.name} ${days}일 사용 처리 완료`
      );
      return {
        success: true,
        leaveRecord,
        ...result,
      };
    } catch (error) {
      logger.error(`❌ 휴가 사용 처리 실패:`, error);
      throw error;
    }
  }

  // 🔄 사용자 연차 데이터 업데이트
  async updateUserLeaves(userId, deductionDays, leaveRecord, leaveType) {
    const currentYear = TimeHelper.getCurrentYear();
    const userKey = `${userId}_${currentYear}`;

    const user = await this.collection.findOne({ userKey });
    const newUsed = user.usedLeaves + deductionDays;
    const newRemaining = user.remainingLeaves - deductionDays;

    // ⭐ 타입별 사용량 업데이트
    const updatedTypeStats = { ...user.leavesByType };
    if (updatedTypeStats[leaveType]) {
      updatedTypeStats[leaveType].used += deductionDays;
      updatedTypeStats[leaveType].remaining -= deductionDays;
    }

    await this.collection.updateOne(
      { userKey },
      {
        $set: {
          usedLeaves: newUsed,
          remainingLeaves: newRemaining,
          leavesByType: updatedTypeStats,
          updatedAt: TimeHelper.getKoreaTime(),
        },
        $push: {
          leaveHistory: {
            $each: [leaveRecord],
            $slice: -50, // 최근 50개만 유지
          },
        },
      }
    );

    return {
      usedLeaves: newUsed,
      remainingLeaves: newRemaining,
      leavesByType: updatedTypeStats,
    };
  }

  // 📋 휴가 사용 내역 조회
  async getLeaveHistory(userId, limit = 10) {
    try {
      const user = await this.getUserLeaves(userId);
      const history = user.leaveHistory || [];

      // ⭐ 최신순 정렬 및 제한
      return history
        .slice(-limit)
        .reverse()
        .map((record) => ({
          ...record,
          formattedDate: TimeHelper.formatDate(new Date(record.date)),
          displayText: this.formatHistoryItem(record),
        }));
    } catch (error) {
      logger.error(`❌ 휴가 내역 조회 실패:`, error);
      throw error;
    }
  }

  // 📊 휴가 현황 통계
  async getLeaveStatistics(userId) {
    try {
      const user = await this.getUserLeaves(userId);
      const history = user.leaveHistory || [];

      // ⭐ 월별 사용 통계
      const monthlyStats = this.calculateMonthlyStats(history);

      // ⭐ 타입별 사용 통계
      const typeStats = this.calculateTypeStats(history);

      // ⭐ 사용률 계산
      const usageRate =
        user.totalLeaves > 0
          ? ((user.usedLeaves / user.totalLeaves) * 100).toFixed(1)
          : 0;

      return {
        summary: {
          total: user.totalLeaves,
          used: user.usedLeaves,
          remaining: user.remainingLeaves,
          usageRate: `${usageRate}%`,
        },
        byType: user.leavesByType,
        monthly: monthlyStats,
        typeDistribution: typeStats,
        recentHistory: history.slice(-5),
      };
    } catch (error) {
      logger.error(`❌ 휴가 통계 조회 실패:`, error);
      throw error;
    }
  }

  // 🔧 휴가 타입별 사용 가능 일수 조회
  getAvailableDaysForType(leaveType) {
    const typeConfig = this.leaveTypes[leaveType];
    if (!typeConfig) {
      return [];
    }

    return typeConfig.allowedDays.map((days) => ({
      days,
      display: this.usageUnits[days]?.display || `${days}일`,
      timeRange: this.usageUnits[days]?.timeRange || "시간 미지정",
    }));
  }

  // 📝 휴가 기록 ID 생성
  generateLeaveId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `leave_${timestamp}_${random}`;
  }

  // 📊 월별 사용 통계 계산
  calculateMonthlyStats(history) {
    const monthlyData = {};

    history.forEach((record) => {
      const month = TimeHelper.formatDate(new Date(record.date), "YYYY-MM");
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, days: 0, types: {} };
      }

      monthlyData[month].count++;
      monthlyData[month].days += record.deductedDays;

      const type = record.leaveType;
      monthlyData[month].types[type] =
        (monthlyData[month].types[type] || 0) + record.deductedDays;
    });

    return monthlyData;
  }

  // 📊 타입별 사용 통계 계산
  calculateTypeStats(history) {
    const typeData = {};

    Object.keys(this.leaveTypes).forEach((type) => {
      typeData[type] = { count: 0, days: 0 };
    });

    history.forEach((record) => {
      const type = record.leaveType;
      if (typeData[type]) {
        typeData[type].count++;
        typeData[type].days += record.deductedDays;
      }
    });

    return typeData;
  }

  // 📝 휴가 내역 포맷팅
  formatHistoryItem(record) {
    const date = TimeHelper.formatDate(new Date(record.date));
    const reason = record.reason ? ` (${record.reason})` : "";
    return `${record.emoji} ${date} - ${record.typeName} ${record.requestedDays}일${reason}`;
  }

  // 📊 사용자 데이터 포맷팅
  formatUserData(user) {
    if (!user) return null;

    return {
      ...user,
      formattedCreatedAt: user.createdAt
        ? TimeHelper.formatDateTime(user.createdAt)
        : TimeHelper.getKoreaTimeString(),
      formattedUpdatedAt: user.updatedAt
        ? TimeHelper.formatDateTime(user.updatedAt)
        : TimeHelper.getKoreaTimeString(),
    };
  }

  // 📊 휴가 현황 메시지 포맷팅
  formatLeaveStatus(user) {
    if (!user) {
      return "❌ 연차 정보를 불러올 수 없습니다.";
    }

    const percentage =
      user.totalLeaves > 0
        ? ((user.usedLeaves / user.totalLeaves) * 100).toFixed(1)
        : "0.0";

    let statusMessage = `📅 **${user.year}년 휴가 현황**\n\n`;
    statusMessage += `🏖️ 총 연차: ${user.totalLeaves}일\n`;
    statusMessage += `✅ 사용 연차: ${user.usedLeaves}일\n`;
    statusMessage += `⏳ 잔여 연차: ${user.remainingLeaves}일\n`;
    statusMessage += `📊 사용률: ${percentage}%\n\n`;

    // ⭐ 타입별 현황 추가
    if (user.leavesByType) {
      statusMessage += `**📂 타입별 현황**\n`;
      Object.entries(user.leavesByType).forEach(([type, stats]) => {
        const typeConfig = this.leaveTypes[type];
        if (typeConfig && stats.used > 0) {
          statusMessage += `${typeConfig.emoji} ${typeConfig.name}: ${stats.used}일 사용\n`;
        }
      });
      statusMessage += `\n`;
    }

    // ⭐ 상태별 메시지
    if (user.remainingLeaves <= 3) {
      statusMessage += "⚠️ 연차가 얼마 남지 않았습니다!";
    } else if (user.remainingLeaves > user.totalLeaves * 0.8) {
      statusMessage += "✨ 휴가를 더 적극적으로 활용해보세요!";
    } else {
      statusMessage += "✨ 휴가를 효율적으로 관리하세요!";
    }

    return statusMessage;
  }

  // 📋 휴가 내역 메시지 포맷팅
  formatLeaveHistory(history) {
    if (!history || history.length === 0) {
      return "📋 휴가 사용 내역이 없습니다.";
    }

    let result = "📋 **휴가 사용 내역**\n\n";

    history.forEach((record, index) => {
      result += `${index + 1}. ${record.displayText}\n`;
    });

    if (history.length >= 10) {
      result += `\n📝 최근 10개 내역 표시`;
    }

    return result;
  }
}

module.exports = LeaveService;
