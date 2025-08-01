// src/services/LeaveService.js - 연차 관리 서비스

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveService - 연차 관리 서비스
 */
class LeaveService extends BaseService {
  constructor(options = {}) {
    super("LeaveService", options);

    this.config = {
      defaultAnnualLeave: 15, // 기본 연차
      maxCarryOver: 40, // 최대 이월 가능 일수
      ...options.config,
    };

    logger.info("🏖️ LeaveService 생성됨");
  }

  getRequiredModels() {
    return ["Leave"]; // 나중에 ["TimerSession"] 추가
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    // logger.success("✅ LeaveService 초기화 완료");
  }

  /**
   * 📊 연차 현황 조회
   */
  async getLeaveStatus(userId) {
    try {
      // Mock 데이터 (실제로는 DB 조회)
      const mockStatus = {
        totalLeave: this.config.defaultAnnualLeave,
        usedLeave: Math.floor(Math.random() * 10),
        remainingLeave: 0,
        scheduledLeave: Math.floor(Math.random() * 3),
        year: new Date().getFullYear(),
      };

      mockStatus.remainingLeave =
        mockStatus.totalLeave -
        mockStatus.usedLeave -
        mockStatus.scheduledLeave;

      return this.createSuccessResponse(mockStatus, "연차 현황 조회 완료");
    } catch (error) {
      logger.error("연차 현황 조회 실패:", error);
      return this.createErrorResponse(error, "연차 현황 조회 중 오류 발생");
    }
  }

  /**
   * 🏖️ 연차 사용 신청
   */
  async useLeave(userId, leaveData) {
    try {
      const { date, type, reason } = leaveData;

      // 현재 연차 현황 확인
      const statusResult = await this.getLeaveStatus(userId);
      if (!statusResult.success) {
        return statusResult;
      }

      const status = statusResult.data;
      const leaveAmount = type === "full" ? 1 : type === "half" ? 0.5 : 0.25;

      // 잔여 연차 확인
      if (status.remainingLeave < leaveAmount) {
        return this.createErrorResponse(
          new Error("INSUFFICIENT_LEAVE"),
          "잔여 연차가 부족합니다."
        );
      }

      // Mock 저장 (실제로는 DB 저장)
      const leaveRequest = {
        _id: `leave_${Date.now()}`,
        userId,
        date,
        type,
        amount: leaveAmount,
        reason,
        status: "approved", // Mock이므로 자동 승인
        createdAt: new Date(),
      };

      return this.createSuccessResponse(leaveRequest, "연차 신청 완료");
    } catch (error) {
      logger.error("연차 신청 실패:", error);
      return this.createErrorResponse(error, "연차 신청 중 오류 발생");
    }
  }

  /**
   * 📋 연차 사용 이력 조회
   */
  async getLeaveHistory(userId, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();

      // Mock 이력 (실제로는 DB 조회)
      const mockHistory = [
        {
          _id: "leave_1",
          date: new Date(targetYear, 0, 15),
          type: "full",
          amount: 1,
          reason: "개인 사유",
          status: "approved",
        },
        {
          _id: "leave_2",
          date: new Date(targetYear, 2, 20),
          type: "half",
          amount: 0.5,
          reason: "병원 방문",
          status: "approved",
        },
      ];

      return this.createSuccessResponse(mockHistory, "연차 이력 조회 완료");
    } catch (error) {
      logger.error("연차 이력 조회 실패:", error);
      return this.createErrorResponse(error, "연차 이력 조회 중 오류 발생");
    }
  }

  /**
   * 📊 연차 현황 조회 (메서드 추가)
   */
  async getLeaveStatus(userId) {
    try {
      // Mock 데이터 (실제로는 DB 조회 로직 구현 필요)
      const mockStatus = {
        totalLeave: this.config.defaultAnnualLeave,
        usedLeave: Math.floor(Math.random() * 10),
        remainingLeave: 0,
        scheduledLeave: Math.floor(Math.random() * 3),
        year: new Date().getFullYear(),
      };

      mockStatus.remainingLeave =
        mockStatus.totalLeave -
        mockStatus.usedLeave -
        mockStatus.scheduledLeave;

      return this.createSuccessResponse(mockStatus, "연차 현황 조회 완료");
    } catch (error) {
      logger.error("연차 현황 조회 실패:", error);
      return this.createErrorResponse(error, "연차 현황 조회 중 오류 발생");
    }
  }

  /**
   * ⚙️ 연차 설정 조회
   */
  async getUserSettings(userId) {
    try {
      // Mock 설정 (실제로는 DB 조회)
      const mockSettings = {
        totalAnnualLeave: this.config.defaultAnnualLeave,
        enableNotifications: true,
        notifyBeforeDays: 7,
        carryOverEnabled: true,
      };

      return this.createSuccessResponse(mockSettings, "설정 조회 완료");
    } catch (error) {
      logger.error("설정 조회 실패:", error);
      return this.createErrorResponse(error, "설정 조회 중 오류 발생");
    }
  }

  /**
   * ⚙️ 연차 설정 업데이트
   */
  async updateUserSettings(userId, settings) {
    try {
      // Mock 업데이트 (실제로는 DB 업데이트)
      const updatedSettings = {
        ...settings,
        updatedAt: new Date(),
      };

      return this.createSuccessResponse(updatedSettings, "설정 업데이트 완료");
    } catch (error) {
      logger.error("설정 업데이트 실패:", error);
      return this.createErrorResponse(error, "설정 업데이트 중 오류 발생");
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      defaultAnnualLeave: this.config.defaultAnnualLeave,
      maxCarryOver: this.config.maxCarryOver,
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
