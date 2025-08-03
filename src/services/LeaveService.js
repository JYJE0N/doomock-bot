// src/services/LeaveService.js - 개인용 연차 관리 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveService - 개인용 연차 관리 서비스
 *
 * 🎯 핵심 기능:
 * - 연차 현황 조회 (잔여/사용)
 * - 연차 사용 기록
 * - 월별 사용량 조회
 * - 연차 설정 관리 (추가/삭제)
 * - 입사일 관리 및 보너스 계산
 * - 연말 소멸, 신년 생성
 */
class LeaveService extends BaseService {
  constructor(options = {}) {
    super("LeaveService", options);
  }

  /**
   * 🗄️ 필요한 모델
   */
  getRequiredModels() {
    return ["Leave", "UserLeaveSetting"];
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    logger.info("🏖️ LeaveService 초기화 완료 - 개인용 연차 관리");
  }

  // ===== 📊 연차 현황 관리 =====

  /**
   * 📊 사용자 연차 현황 조회
   */
  /**
   * 📊 사용자 연차 현황 조회
   */
  async getLeaveStatus(userId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();

      // 사용자 설정 조회/생성
      const Leave = this.models.Leave;
      const UserLeaveSetting = this.models.UserLeaveSetting;

      const userSetting = await UserLeaveSetting.getOrCreate(userId, currentYear);

      // ✅ 수정: getUserYearlyUsage → getYearlyUsage
      const yearlyUsage = await Leave.getYearlyUsage(userId, currentYear);

      // 총 연차 계산 (기본 15 + 근속 보너스 + 수동 조정)
      const totalLeave = userSetting.calculateTotalLeave();
      const usedLeave = yearlyUsage.totalUsed || 0;
      const remainingLeave = Math.max(0, totalLeave - usedLeave);

      const statusData = {
        userId,
        currentYear,
        totalLeave,
        usedLeave,
        remainingLeave,
        usageRate: totalLeave > 0 ? (usedLeave / totalLeave) * 100 : 0,
        joinDate: userSetting.joinDate
          ? userSetting.joinDate.toISOString().split("T")[0]
          : null,
        workYears: userSetting.workYears,
        yearlyBonus: userSetting.yearlyBonus,
        customLeave: userSetting.customLeave,
        totalUsageCount: yearlyUsage.totalCount || 0
      };

      logger.debug(`📊 연차 현황 조회 완료: 사용자 ${userId}, ${currentYear}년`);
      return this.createSuccessResponse(statusData, "연차 현황 조회 완료");
    } catch (error) {
      logger.error("📊 연차 현황 조회 실패:", error);
      return this.createErrorResponse(error, "연차 현황 조회 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📈 월별 사용량 조회
   */
  async getMonthlyUsage(userId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      const Leave = this.models.Leave;

      // ✅ 수정: Leave 모델에 getMonthlyUsage가 정적 메서드로 존재함
      const monthlyData = await Leave.getMonthlyUsage(userId, currentYear);
      const currentMonth = new Date().getMonth() + 1;

      // 현재 연차 현황도 함께 반환
      const statusResult = await this.getLeaveStatus(userId, currentYear);

      const result = {
        monthlyUsage: monthlyData,
        currentMonth,
        currentYear,
        totalLeave: statusResult.success ? statusResult.data.totalLeave : 15,
        remainingLeave: statusResult.success ? statusResult.data.remainingLeave : 15
      };

      logger.debug(`📈 월별 사용량 조회 완료: 사용자 ${userId}, ${currentYear}년`);
      return this.createSuccessResponse(result, "월별 사용량 조회 완료");
    } catch (error) {
      logger.error("📈 월별 사용량 조회 실패:", error);
      return this.createErrorResponse(error, "월별 사용량 조회 중 오류가 발생했습니다.");
    }
  }

  // ===== 🏖️ 연차 사용 관리 =====

  /**
   * ➕ 연차 사용 기록
   */
  async useLeave(userId, amount, reason = "", date = null) {
    try {
      const Leave = this.models.Leave;

      // 잔여 연차 확인
      const statusResult = await this.getLeaveStatus(userId);
      if (!statusResult.success) {
        return statusResult;
      }

      const { remainingLeave } = statusResult.data;

      // 잔여 연차 부족 체크
      if (remainingLeave < amount) {
        return this.createErrorResponse(
          new Error("INSUFFICIENT_LEAVE"),
          `잔여 연차가 부족합니다. (잔여: ${remainingLeave}일, 요청: ${amount}일)`
        );
      }

      // ✅ 수정: 유연한 연차 타입 결정
      let leaveType;
      if (amount === 0.25) {
        leaveType = "반반차";
      } else if (amount === 0.5) {
        leaveType = "반차";
      } else if (amount === 1) {
        leaveType = "연차";
      } else if (amount > 0 && amount <= 10) {
        // 직접 입력의 경우 (0초과 10이하)
        leaveType = `연차 ${amount}일`;
      } else {
        return this.createErrorResponse(
          new Error("INVALID_AMOUNT"),
          `잘못된 연차 사용량입니다: ${amount}일`
        );
      }

      // 연차 사용 기록
      const useDate = date ? new Date(date) : new Date();
      const leave = await Leave.addUsage(userId, amount, useDate, reason, leaveType);

      // 업데이트된 현황 조회
      const updatedStatus = await this.getLeaveStatus(userId);

      const result = {
        leaveId: leave._id,
        date: useDate.toISOString().split("T")[0],
        amount,
        type: leave.type || leaveType,
        reason: reason || "",
        remainingLeave: updatedStatus.success ? updatedStatus.data.remainingLeave : 0
      };

      logger.info(`🏖️ 연차 사용 기록 완료: 사용자 ${userId}, ${amount}일`);
      return this.createSuccessResponse(result, "연차 사용이 기록되었습니다.");
    } catch (error) {
      logger.error("🏖️ 연차 사용 기록 실패:", error);
      return this.createErrorResponse(error, "연차 사용 기록 중 오류가 발생했습니다.");
    }
  }

  // ===== ⚙️ 설정 관리 =====

  /**
   * 📊 사용자 연차 설정 조회
   */
  async getUserSettings(userId) {
    try {
      const UserLeaveSetting = this.models.UserLeaveSetting;
      const currentYear = new Date().getFullYear();

      const userSetting = await UserLeaveSetting.getOrCreate(userId, currentYear);

      const settingsData = {
        userId,
        year: currentYear,
        totalLeave: userSetting.calculateTotalLeave(),
        baseLeave: 15,
        yearlyBonus: userSetting.yearlyBonus,
        customLeave: userSetting.customLeave,
        joinDate: userSetting.joinDate
          ? userSetting.joinDate.toISOString().split("T")[0]
          : null,
        workYears: userSetting.workYears,
        changeHistory: userSetting.getChangesSummary(),
        canModify: true // 개인용이므로 항상 수정 가능
      };

      logger.debug(`⚙️ 사용자 설정 조회 완료: 사용자 ${userId}`);
      return this.createSuccessResponse(settingsData, "사용자 설정 조회 완료");
    } catch (error) {
      logger.error("⚙️ 사용자 설정 조회 실패:", error);
      return this.createErrorResponse(error, "사용자 설정 조회 중 오류가 발생했습니다.");
    }
  }

  /**
   * ➕ 연차 추가
   */
  async addLeave(userId, amount, reason = "수동 추가") {
    try {
      const UserLeaveSetting = this.models.UserLeaveSetting;

      const updatedSetting = await UserLeaveSetting.addLeave(userId, amount, reason);
      const newTotal = updatedSetting.calculateTotalLeave();

      const result = {
        action: "add",
        amount,
        newTotal,
        customLeave: updatedSetting.customLeave,
        message: `연차 ${amount}일이 추가되었습니다.`
      };

      logger.info(`➕ 연차 추가 완료: 사용자 ${userId}, +${amount}일`);
      return this.createSuccessResponse(result, "연차가 추가되었습니다.");
    } catch (error) {
      logger.error("➕ 연차 추가 실패:", error);
      return this.createErrorResponse(error, "연차 추가 중 오류가 발생했습니다.");
    }
  }

  /**
   * ➖ 연차 삭제
   */
  async removeLeave(userId, amount, reason = "수동 삭제") {
    try {
      const UserLeaveSetting = this.models.UserLeaveSetting;

      const updatedSetting = await UserLeaveSetting.removeLeave(userId, amount, reason);
      const newTotal = updatedSetting.calculateTotalLeave();

      const result = {
        action: "remove",
        amount,
        newTotal,
        customLeave: updatedSetting.customLeave,
        message: `연차 ${amount}일이 삭제되었습니다.`
      };

      logger.info(`➖ 연차 삭제 완료: 사용자 ${userId}, -${amount}일`);
      return this.createSuccessResponse(result, "연차가 삭제되었습니다.");
    } catch (error) {
      logger.error("➖ 연차 삭제 실패:", error);
      return this.createErrorResponse(error, "연차 삭제 중 오류가 발생했습니다.");
    }
  }

  /**
   * 💼 입사일 설정
   */
  async setJoinDate(userId, joinDate) {
    try {
      const UserLeaveSetting = this.models.UserLeaveSetting;

      const updatedSetting = await UserLeaveSetting.setJoinDate(userId, joinDate);
      const newTotal = updatedSetting.calculateTotalLeave();

      const result = {
        action: "join_date",
        joinDate,
        workYears: updatedSetting.workYears,
        yearlyBonus: updatedSetting.yearlyBonus,
        newTotal,
        message: `입사일이 ${joinDate}로 설정되었습니다. (${updatedSetting.workYears}년차)`
      };

      logger.info(`💼 입사일 설정 완료: 사용자 ${userId}, ${joinDate}`);
      return this.createSuccessResponse(result, "입사일이 설정되었습니다.");
    } catch (error) {
      logger.error("💼 입사일 설정 실패:", error);
      return this.createErrorResponse(error, "입사일 설정 중 오류가 발생했습니다.");
    }
  }

  // ===== 🔄 연말/신년 관리 =====

  /**
   * 🔄 신년 연차 초기화
   */
  async resetForNewYear(userId, newYear = null) {
    try {
      const UserLeaveSetting = this.models.UserLeaveSetting;
      const targetYear = newYear || new Date().getFullYear();

      const newSetting = await UserLeaveSetting.resetForNewYear(userId, targetYear);

      const result = {
        year: targetYear,
        totalLeave: newSetting.calculateTotalLeave(),
        message: `${targetYear}년 새로운 연차가 생성되었습니다.`
      };

      logger.info(`🔄 신년 연차 초기화 완료: 사용자 ${userId}, ${targetYear}년`);
      return this.createSuccessResponse(result, "새로운 연차가 생성되었습니다.");
    } catch (error) {
      logger.error("🔄 신년 연차 초기화 실패:", error);
      return this.createErrorResponse(error, "신년 연차 초기화 중 오류가 발생했습니다.");
    }
  }

  // ===== 📊 통계 및 정리 =====

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      features: [
        "개인 연차 현황 조회",
        "연차 사용 기록",
        "월별 사용량 조회",
        "연차 설정 관리",
        "입사일 기반 보너스",
        "연말 소멸/신년 생성"
      ],
      version: "2.0.0-simple"
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    await super.cleanup();
    logger.info("✅ LeaveService 정리 완료");
  }
}

module.exports = LeaveService;
