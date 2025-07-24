// src/services/LeaveService.js - 표준화된 휴가 서비스

const TimeHelper = require("../utils/TimeHelper");
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

class LeaveService extends BaseService {
  constructor() {
    super("leaves");
    this.dbManager = null;
    this.collection = null;
    this.dbEnabled = false;
  }

  // ✅ 표준 초기화 패턴
  async initialize() {
    try {
      // DatabaseManager 가져오기 (표준 패턴)
      const { getInstance } = require("../database/DatabaseManager");
      this.dbManager = getInstance();

      // 연결 보장
      await this.dbManager.ensureConnection();

      // 컬렉션 가져오기
      this.collection = this.dbManager.db.collection(this.collectionName);
      this.dbEnabled = true;

      logger.info("🏖️ LeaveService 초기화 성공");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      logger.warn("⚠️ 메모리 모드로 전환");

      // 데이터베이스 없이도 동작하도록 메모리 저장소 사용
      this.memoryStorage = new Map();
      this.dbEnabled = false;
    }
  }

  // ==================== 사용자 관리 ====================

  /**
   * 사용자 휴가 정보 초기화
   */
  async initializeUser(userId) {
    try {
      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      if (this.dbEnabled) {
        const existingUser = await this.collection.findOne({
          userKey: userKey,
          year: currentYear,
        });

        if (!existingUser) {
          const newUser = {
            userKey: userKey,
            userId: userId.toString(),
            year: currentYear,
            totalLeaves: 15, // 기본 연차 15일
            usedLeaves: 0,
            remainingLeaves: 15,
            leaveHistory: [],
            createdAt: TimeHelper.getKoreaTime(),
            updatedAt: TimeHelper.getKoreaTime(),
          };

          await this.collection.insertOne(newUser);
          logger.info(`✅ 사용자 ${userId} 연차 정보 초기화 완료`);
        }
      } else {
        // 메모리 모드
        if (!this.memoryStorage.has(userKey)) {
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

          this.memoryStorage.set(userKey, newUser);
          logger.info(`✅ 사용자 ${userId} 연차 정보 초기화 완료 (메모리)`);
        }
      }
    } catch (error) {
      logger.error(`❌ 사용자 ${userId} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 사용자 휴가 정보 조회
   */
  async getUserLeaves(userId) {
    try {
      const currentYear = TimeHelper.getCurrentYear();
      const userKey = `${userId}_${currentYear}`;

      let user = null;

      if (this.dbEnabled) {
        user = await this.collection.findOne({
          userKey: userKey,
          year: currentYear,
        });
      } else {
        // 메모리 모드
        user = this.memoryStorage.get(userKey);
      }

      if (!user) {
        await this.initializeUser(userId);

        if (this.dbEnabled) {
          user = await this.collection.findOne({
            userKey: userKey,
            year: currentYear,
          });
        } else {
          user = this.memoryStorage.get(userKey);
        }
      }

      return user;
    } catch (error) {
      logger.error(`❌ 사용자 ${userId} 연차 정보 조회 실패:`, error);
      throw error;
    }
  }

  /**
   * LeaveModule에서 요구하는 형식으로 데이터 반환
   */
  async getUserLeaveData(userId) {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        await this.initializeUser(userId);
        const newUser = await this.getUserLeaves(userId);
        return this.formatUserLeaveData(newUser);
      }

      return this.formatUserLeaveData(user);
    } catch (error) {
      logger.error(`❌ 사용자 ${userId} 휴가 데이터 조회 실패:`, error);
      throw error;
    }
  }

  /**
   * 데이터 포맷팅
   */
  formatUserLeaveData(user) {
    return {
      totalDays: user.totalLeaves,
      usedDays: user.usedLeaves,
      remainingDays: user.remainingLeaves,
      lastUpdate: user.updatedAt
        ? TimeHelper.formatDateTime(user.updatedAt)
        : TimeHelper.formatDateTime(new Date()),
      history: user.leaveHistory || [],
      year: user.year,
    };
  }

  // ==================== 휴가 사용 ====================

  /**
   * 휴가 사용
   */
  async useLeave(userId, days, reason = "휴가") {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        return {
          success: false,
          message: "사용자 정보를 찾을 수 없습니다.",
        };
      }

      if (user.remainingLeaves < days) {
        return {
          success: false,
          message: `잔여 연차가 부족합니다. (잔여: ${user.remainingLeaves}일)`,
        };
      }

      // 휴가 사용 기록 추가
      const leaveRecord = {
        id: this.generateLeaveId(),
        days: days,
        reason: reason,
        date: TimeHelper.getKoreaTime(),
        type: "사용",
      };

      const updatedUser = {
        ...user,
        usedLeaves: user.usedLeaves + days,
        remainingLeaves: user.remainingLeaves - days,
        leaveHistory: [...user.leaveHistory, leaveRecord],
        updatedAt: TimeHelper.getKoreaTime(),
      };

      // 데이터 업데이트
      if (this.dbEnabled) {
        await this.collection.updateOne(
          { userKey: user.userKey, year: user.year },
          { $set: updatedUser }
        );
      } else {
        this.memoryStorage.set(user.userKey, updatedUser);
      }

      logger.info(`✅ 사용자 ${userId} - ${days}일 휴가 사용 처리`);

      return {
        success: true,
        message: `${days}일 휴가가 사용되었습니다.`,
        data: {
          usedDays: days,
          remainingDays: updatedUser.remainingLeaves,
          record: leaveRecord,
        },
      };
    } catch (error) {
      logger.error(`❌ 휴가 사용 처리 실패:`, error);
      return {
        success: false,
        message: "휴가 사용 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 휴가 추가 (관리자용)
   */
  async addLeave(userId, days, reason = "연차 추가") {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        return {
          success: false,
          message: "사용자 정보를 찾을 수 없습니다.",
        };
      }

      const leaveRecord = {
        id: this.generateLeaveId(),
        days: days,
        reason: reason,
        date: TimeHelper.getKoreaTime(),
        type: "추가",
      };

      const updatedUser = {
        ...user,
        totalLeaves: user.totalLeaves + days,
        remainingLeaves: user.remainingLeaves + days,
        leaveHistory: [...user.leaveHistory, leaveRecord],
        updatedAt: TimeHelper.getKoreaTime(),
      };

      // 데이터 업데이트
      if (this.dbEnabled) {
        await this.collection.updateOne(
          { userKey: user.userKey, year: user.year },
          { $set: updatedUser }
        );
      } else {
        this.memoryStorage.set(user.userKey, updatedUser);
      }

      logger.info(`✅ 사용자 ${userId} - ${days}일 연차 추가`);

      return {
        success: true,
        message: `${days}일 연차가 추가되었습니다.`,
        data: {
          addedDays: days,
          totalDays: updatedUser.totalLeaves,
          remainingDays: updatedUser.remainingLeaves,
          record: leaveRecord,
        },
      };
    } catch (error) {
      logger.error(`❌ 연차 추가 처리 실패:`, error);
      return {
        success: false,
        message: "연차 추가 처리 중 오류가 발생했습니다.",
      };
    }
  }

  // ==================== 휴가 이력 관리 ====================

  /**
   * 휴가 사용 이력 조회
   */
  async getLeaveHistory(userId, limit = 10) {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        return {
          success: false,
          message: "사용자 정보를 찾을 수 없습니다.",
        };
      }

      const history = user.leaveHistory || [];
      const sortedHistory = history
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

      return {
        success: true,
        data: {
          history: sortedHistory,
          totalRecords: history.length,
          currentYear: user.year,
        },
      };
    } catch (error) {
      logger.error(`❌ 휴가 이력 조회 실패:`, error);
      return {
        success: false,
        message: "휴가 이력 조회 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 휴가 통계 조회
   */
  async getLeaveStats(userId) {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        return {
          success: false,
          message: "사용자 정보를 찾을 수 없습니다.",
        };
      }

      const history = user.leaveHistory || [];
      const currentMonth = TimeHelper.getCurrentMonth();

      // 이번 달 사용 연차
      const thisMonthUsage = history
        .filter((record) => {
          const recordDate = new Date(record.date);
          return (
            recordDate.getMonth() + 1 === currentMonth && record.type === "사용"
          );
        })
        .reduce((sum, record) => sum + record.days, 0);

      // 사용 패턴 분석
      const usageByMonth = {};
      history.forEach((record) => {
        if (record.type === "사용") {
          const month = new Date(record.date).getMonth() + 1;
          usageByMonth[month] = (usageByMonth[month] || 0) + record.days;
        }
      });

      return {
        success: true,
        data: {
          totalDays: user.totalLeaves,
          usedDays: user.usedLeaves,
          remainingDays: user.remainingLeaves,
          usageRate: Math.round((user.usedLeaves / user.totalLeaves) * 100),
          thisMonthUsage: thisMonthUsage,
          usageByMonth: usageByMonth,
          totalRecords: history.length,
          lastUsed:
            history.length > 0
              ? TimeHelper.formatDateTime(history[history.length - 1].date)
              : null,
        },
      };
    } catch (error) {
      logger.error(`❌ 휴가 통계 조회 실패:`, error);
      return {
        success: false,
        message: "휴가 통계 조회 중 오류가 발생했습니다.",
      };
    }
  }

  // ==================== 유틸리티 ====================

  /**
   * 휴가 ID 생성
   */
  generateLeaveId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `leave_${timestamp}_${random}`;
  }

  /**
   * 연차 설정 업데이트
   */
  async updateLeaveSetting(userId, totalLeaves) {
    try {
      const user = await this.getUserLeaves(userId);

      if (!user) {
        return {
          success: false,
          message: "사용자 정보를 찾을 수 없습니다.",
        };
      }

      const difference = totalLeaves - user.totalLeaves;

      const updatedUser = {
        ...user,
        totalLeaves: totalLeaves,
        remainingLeaves: user.remainingLeaves + difference,
        updatedAt: TimeHelper.getKoreaTime(),
      };

      // 데이터 업데이트
      if (this.dbEnabled) {
        await this.collection.updateOne(
          { userKey: user.userKey, year: user.year },
          { $set: updatedUser }
        );
      } else {
        this.memoryStorage.set(user.userKey, updatedUser);
      }

      logger.info(`✅ 사용자 ${userId} 연차 설정 업데이트: ${totalLeaves}일`);

      return {
        success: true,
        message: `연차가 ${totalLeaves}일로 설정되었습니다.`,
        data: {
          totalLeaves: totalLeaves,
          remainingLeaves: updatedUser.remainingLeaves,
          difference: difference,
        },
      };
    } catch (error) {
      logger.error(`❌ 연차 설정 업데이트 실패:`, error);
      return {
        success: false,
        message: "연차 설정 업데이트 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      dbEnabled: this.dbEnabled,
      memoryStorage: !this.dbEnabled,
      collectionName: this.collectionName,
      memoryRecords: this.dbEnabled ? null : this.memoryStorage?.size || 0,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      if (this.dbEnabled && this.dbManager) {
        // 데이터베이스 연결 정리는 DatabaseManager에서 처리
        logger.info("🏖️ LeaveService 정리 완료");
      }

      if (this.memoryStorage) {
        this.memoryStorage.clear();
        logger.info("🏖️ LeaveService 메모리 정리 완료");
      }
    } catch (error) {
      logger.error("❌ LeaveService 정리 실패:", error);
    }
  }
}

module.exports = LeaveService;
