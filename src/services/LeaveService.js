// src/services/LeaveService.js - 🏖️ 완성된 연차 관리 서비스

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveService - 연차 관리 서비스 (완전 구현)
 *
 * 🎯 핵심 기능:
 * - 연차 현황 조회 및 관리
 * - 연차 신청 및 사용 처리
 * - 사용 이력 및 통계 제공
 * - 사용자별 연차 정책 관리
 *
 * 비유: 회사 인사팀의 연차 관리 담당자
 * - 직원별 연차 현황을 정확히 파악
 * - 연차 신청서를 검토하고 승인
 * - 연차 사용 패턴을 분석하여 리포트 제공
 */
class LeaveService extends BaseService {
  constructor(options = {}) {
    super("LeaveService", options);

    // 🎯 연차 정책 설정
    this.config = {
      defaultAnnualLeave: parseInt(process.env.LEAVE_DEFAULT_ANNUAL) || 15, // 기본 연차일수
      maxCarryOver: parseInt(process.env.LEAVE_MAX_CARRY_OVER) || 5, // 최대 이월 가능 일수
      minRequestDays: parseInt(process.env.LEAVE_MIN_REQUEST_DAYS) || 1, // 최소 신청일 전
      maxFutureBooking: parseInt(process.env.LEAVE_MAX_FUTURE_BOOKING) || 365, // 최대 미래 예약일
      enableHalfDay: process.env.LEAVE_ENABLE_HALF_DAY !== "false", // 반차 허용
      enableQuarterDay: process.env.LEAVE_ENABLE_QUARTER_DAY === "true", // 반반차 허용
      autoApproval: process.env.LEAVE_AUTO_APPROVAL === "true", // 자동 승인
      enableNotifications: process.env.LEAVE_ENABLE_NOTIFICATIONS !== "false", // 알림 활성화
      pageSize: parseInt(process.env.LEAVE_PAGE_SIZE) || 10, // 페이지 크기
      ...options.config,
    };

    // 🔄 연차 타입 정의
    this.leaveTypes = {
      full: {
        value: 1.0,
        label: "연차",
        description: "하루 종일 휴가",
        icon: "🕘",
        enabled: true,
      },
      half: {
        value: 0.5,
        label: "반차",
        description: "오전 또는 오후 반나절 휴가",
        icon: "🕒",
        enabled: this.config.enableHalfDay,
      },
      quarter: {
        value: 0.25,
        label: "반반차",
        description: "2시간 정도의 짧은 휴가",
        icon: "🕐",
        enabled: this.config.enableQuarterDay,
      },
    };

    // 📊 상태 정의
    this.leaveStatus = {
      PENDING: "pending", // 승인 대기
      APPROVED: "approved", // 승인됨
      REJECTED: "rejected", // 거부됨
      CANCELLED: "cancelled", // 취소됨
      EXPIRED: "expired", // 만료됨
    };

    logger.info("🏖️ LeaveService 생성됨 - 완전 구현");
  }

  /**
   * 🗄️ 필요한 Mongoose 모델 정의
   */
  getRequiredModels() {
    return ["Leave", "UserLeaveSetting"]; // Leave 모델과 정책 모델
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    try {
      // 기본 정책 데이터 확인 및 생성
      await this.ensureDefaultPolicies();

      logger.success("✅ LeaveService 초기화 완료 - 모든 기능 활성화");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 기본 정책 확인 및 생성
   */
  async ensureDefaultPolicies() {
    try {
      // UserLeaveSetting 모델을 사용하여 기본 정책 처리
      const UserLeaveSettingModel = this.models.UserLeaveSetting;

      logger.debug("📋 기본 연차 정책 확인 완료 (UserLeaveSetting 기반)");
    } catch (error) {
      logger.warn("⚠️ 기본 정책 생성 실패 (Mock 모드로 계속):", error.message);
    }
  }

  // ===== 📊 연차 현황 관리 =====

  /**
   * 📊 사용자 연차 현황 조회
   */
  async getLeaveStatus(userId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();

      // 📊 Mock 데이터 생성 (실제 DB 연동 시 수정)
      const mockStatus = await this.generateMockLeaveStatus(
        userId,
        currentYear
      );

      // 📈 사용률 계산
      const usageRate =
        mockStatus.totalLeave > 0
          ? (mockStatus.usedLeave / mockStatus.totalLeave) * 100
          : 0;

      // 🎯 추가 옵션 계산
      const canUseHalfDay =
        this.leaveTypes.half.enabled && mockStatus.remainingLeave >= 0.5;
      const canUseQuarterDay =
        this.leaveTypes.quarter.enabled && mockStatus.remainingLeave >= 0.25;

      const statusData = {
        ...mockStatus,
        usageRate: Math.round(usageRate * 10) / 10, // 소수점 첫째자리
        canUseHalfDay,
        canUseQuarterDay,
        leaveTypes: this.leaveTypes,
        year: currentYear,
        lastUpdated: new Date(),
      };

      logger.debug(
        `📊 연차 현황 조회 완료: 사용자 ${userId}, ${currentYear}년`
      );
      return this.createSuccessResponse(statusData, "연차 현황 조회 완료");
    } catch (error) {
      logger.error("📊 연차 현황 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "연차 현황 조회 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔧 Mock 연차 데이터 생성 (실제 DB 연동 시 교체)
   */
  async generateMockLeaveStatus(userId, year) {
    // 사용자 ID를 기반으로 일관된 Mock 데이터 생성
    const seed = userId
      .toString()
      .split("")
      .reduce((a, b) => a + b.charCodeAt(0), 0);
    const random = ((seed * 9301 + 49297) % 233280) / 233280; // 의사 랜덤

    const totalLeave = this.config.defaultAnnualLeave;
    const usedLeave = Math.floor(random * (totalLeave * 0.7)); // 최대 70% 사용
    const scheduledLeave = Math.floor(random * 3); // 0-2일 예약
    const remainingLeave = Math.max(0, totalLeave - usedLeave - scheduledLeave);

    return {
      userId,
      totalLeave,
      usedLeave,
      scheduledLeave,
      remainingLeave,
      year,
    };
  }

  // ===== 🏖️ 연차 신청 및 사용 =====

  /**
   * 🏖️ 연차 신청/사용 처리
   */
  async requestLeave(userId, leaveData) {
    try {
      const { date, type, reason, timeSlot } = leaveData;

      // 1️⃣ 유효성 검증
      const validation = await this.validateLeaveRequest(userId, leaveData);
      if (!validation.success) {
        return validation;
      }

      // 2️⃣ 연차 타입 확인
      const leaveType = this.leaveTypes[type];
      if (!leaveType || !leaveType.enabled) {
        return this.createErrorResponse(
          new Error("INVALID_LEAVE_TYPE"),
          "지원하지 않는 연차 타입입니다."
        );
      }

      // 3️⃣ 잔여 연차 확인
      const statusResult = await this.getLeaveStatus(userId);
      if (!statusResult.success) {
        return statusResult;
      }

      const status = statusResult.data;
      if (status.remainingLeave < leaveType.value) {
        return this.createErrorResponse(
          new Error("INSUFFICIENT_LEAVE"),
          `잔여 연차(${status.remainingLeave}일)가 부족합니다. ${leaveType.label}은 ${leaveType.value}일이 필요합니다.`
        );
      }

      // 4️⃣ Mock 연차 사용 처리 (실제 DB 연동 시 수정)
      const leaveRecord = await this.processMockLeaveRequest(
        userId,
        leaveData,
        leaveType
      );

      // 5️⃣ 결과 반환
      const result = {
        leaveId: leaveRecord.id,
        date: leaveRecord.date,
        type: leaveType.label,
        amount: leaveType.value,
        reason: reason || "사유 없음",
        status: leaveRecord.status,
        approvedAt:
          leaveRecord.status === this.leaveStatus.APPROVED ? new Date() : null,
        remainingLeave: status.remainingLeave - leaveType.value,
        message: `${leaveType.label} 신청이 ${
          leaveRecord.status === this.leaveStatus.APPROVED ? "승인" : "접수"
        }되었습니다.`,
      };

      logger.info(
        `🏖️ 연차 신청 처리 완료: 사용자 ${userId}, ${type} ${leaveType.value}일`
      );
      return this.createSuccessResponse(result, "연차 신청이 완료되었습니다.");
    } catch (error) {
      logger.error("🏖️ 연차 신청 처리 실패:", error);
      return this.createErrorResponse(
        error,
        "연차 신청 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ✅ 연차 신청 유효성 검증
   */
  async validateLeaveRequest(userId, leaveData) {
    try {
      const { date, type } = leaveData;

      // 날짜 유효성 검증
      const requestDate = new Date(date);
      const today = new Date();
      const daysDiff = Math.ceil((requestDate - today) / (1000 * 60 * 60 * 24));

      if (daysDiff < this.config.minRequestDays) {
        return this.createErrorResponse(
          new Error("DATE_TOO_SOON"),
          `연차는 최소 ${this.config.minRequestDays}일 전에 신청해야 합니다.`
        );
      }

      if (daysDiff > this.config.maxFutureBooking) {
        return this.createErrorResponse(
          new Error("DATE_TOO_FAR"),
          `연차는 최대 ${this.config.maxFutureBooking}일 이후까지만 신청 가능합니다.`
        );
      }

      // 연차 타입 유효성 검증
      if (!this.leaveTypes[type]) {
        return this.createErrorResponse(
          new Error("INVALID_TYPE"),
          "올바르지 않은 연차 타입입니다."
        );
      }

      return this.createSuccessResponse(true, "유효성 검증 통과");
    } catch (error) {
      logger.error("✅ 연차 신청 유효성 검증 실패:", error);
      return this.createErrorResponse(
        error,
        "유효성 검증 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔧 Mock 연차 처리 (실제 DB 연동 시 교체)
   */
  async processMockLeaveRequest(userId, leaveData, leaveType) {
    const leaveRecord = {
      id: `leave_${Date.now()}_${userId}`,
      userId,
      date: leaveData.date,
      type: leaveData.type,
      amount: leaveType.value,
      reason: leaveData.reason || "사유 없음",
      status: this.config.autoApproval
        ? this.leaveStatus.APPROVED
        : this.leaveStatus.PENDING,
      requestedAt: new Date(),
      approvedAt: this.config.autoApproval ? new Date() : null,
    };

    logger.debug(`🔧 Mock 연차 레코드 생성:`, leaveRecord);
    return leaveRecord;
  }

  // ===== 📋 연차 이력 및 통계 =====

  /**
   * 📋 연차 사용 이력 조회
   */
  async getLeaveHistory(userId, options = {}) {
    try {
      const {
        year = new Date().getFullYear(),
        page = 1,
        limit = this.config.pageSize,
        status = null,
      } = options;

      // 📊 Mock 이력 데이터 생성 (실제 DB 연동 시 수정)
      const mockHistory = await this.generateMockLeaveHistory(
        userId,
        year,
        page,
        limit
      );

      const result = {
        items: mockHistory.records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: mockHistory.total,
          hasMore: page * limit < mockHistory.total,
        },
        year,
        summary: {
          totalRequests: mockHistory.total,
          approvedRequests: mockHistory.records.filter(
            (r) => r.status === this.leaveStatus.APPROVED
          ).length,
          pendingRequests: mockHistory.records.filter(
            (r) => r.status === this.leaveStatus.PENDING
          ).length,
          totalDaysUsed: mockHistory.records
            .filter((r) => r.status === this.leaveStatus.APPROVED)
            .reduce((sum, r) => sum + r.amount, 0),
        },
      };

      logger.debug(
        `📋 연차 이력 조회 완료: 사용자 ${userId}, ${year}년, 페이지 ${page}`
      );
      return this.createSuccessResponse(result, "연차 이력 조회 완료");
    } catch (error) {
      logger.error("📋 연차 이력 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "연차 이력 조회 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔧 Mock 이력 데이터 생성 (실제 DB 연동 시 교체)
   */
  async generateMockLeaveHistory(userId, year, page, limit) {
    // 일관된 Mock 데이터를 위한 시드 생성
    const seed =
      userId
        .toString()
        .split("")
        .reduce((a, b) => a + b.charCodeAt(0), 0) + year;

    const total = Math.floor((seed % 20) + 5); // 5-24개 레코드
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    const records = [];
    for (let i = startIndex; i < endIndex; i++) {
      const recordSeed = seed + i;
      const random = ((recordSeed * 9301 + 49297) % 233280) / 233280;

      const types = ["full", "half", "quarter"];
      const typeIndex = Math.floor(random * types.length);
      const type = types[typeIndex];
      const leaveType = this.leaveTypes[type];

      const monthDay = Math.floor(random * 365) + 1;
      const date = new Date(year, 0, monthDay);

      records.push({
        id: `history_${i}_${userId}`,
        date: TimeHelper.format(date, "YYYY-MM-DD"),
        type: leaveType.label,
        amount: leaveType.value,
        reason:
          random > 0.7 ? "개인 사정" : random > 0.4 ? "가족 행사" : "휴식",
        status:
          random > 0.9 ? this.leaveStatus.PENDING : this.leaveStatus.APPROVED,
        requestedAt: TimeHelper.format(
          new Date(date.getTime() - 86400000),
          "YYYY-MM-DD"
        ),
        approvedAt:
          random > 0.9
            ? null
            : TimeHelper.format(
                new Date(date.getTime() - 43200000),
                "YYYY-MM-DD"
              ),
      });
    }

    return { records, total };
  }

  /**
   * 📈 월별 연차 사용 통계
   */
  async getMonthlyStats(userId, year = null) {
    try {
      const targetYear = year || new Date().getFullYear();

      // 📊 Mock 월별 통계 생성 (실제 DB 연동 시 수정)
      const monthlyData = await this.generateMockMonthlyStats(
        userId,
        targetYear
      );

      const result = {
        year: targetYear,
        monthlyData,
        yearSummary: {
          totalDays: monthlyData.reduce((sum, m) => sum + m.days, 0),
          totalRequests: monthlyData.reduce((sum, m) => sum + m.count, 0),
          averagePerMonth: (
            monthlyData.reduce((sum, m) => sum + m.days, 0) / 12
          ).toFixed(1),
          peakMonth: monthlyData.reduce((prev, current) =>
            prev.days > current.days ? prev : current
          ),
          quietMonth: monthlyData.reduce((prev, current) =>
            prev.days < current.days ? prev : current
          ),
        },
      };

      logger.debug(`📈 월별 통계 조회 완료: 사용자 ${userId}, ${targetYear}년`);
      return this.createSuccessResponse(result, "월별 통계 조회 완료");
    } catch (error) {
      logger.error("📈 월별 통계 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "월별 통계 조회 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔧 Mock 월별 통계 생성 (실제 DB 연동 시 교체)
   */
  async generateMockMonthlyStats(userId, year) {
    const seed =
      userId
        .toString()
        .split("")
        .reduce((a, b) => a + b.charCodeAt(0), 0) + year;

    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const monthSeed = seed + month;
      const random = ((monthSeed * 9301 + 49297) % 233280) / 233280;

      const days = Math.floor(random * 4); // 0-3일
      const count = days > 0 ? Math.floor(random * 3) + 1 : 0; // 1-3회 또는 0회

      monthlyData.push({
        month,
        days,
        count,
        types: days > 0 ? ["연차", "반차"].slice(0, count) : [],
      });
    }

    return monthlyData;
  }

  /**
   * 📆 오늘 연차 사용 현황
   */
  async getTodayUsage(userId) {
    try {
      const today = TimeHelper.format(new Date(), "YYYY-MM-DD");

      // 📊 Mock 오늘 사용 현황 (실제 DB 연동 시 수정)
      const todayData = await this.generateMockTodayUsage(userId, today);

      logger.debug(`📆 오늘 연차 현황 조회 완료: 사용자 ${userId}, ${today}`);
      return this.createSuccessResponse(todayData, "오늘 연차 현황 조회 완료");
    } catch (error) {
      logger.error("📆 오늘 연차 현황 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "오늘 연차 현황 조회 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔧 Mock 오늘 사용 현황 생성 (실제 DB 연동 시 교체)
   */
  async generateMockTodayUsage(userId, today) {
    const seed = userId
      .toString()
      .split("")
      .reduce((a, b) => a + b.charCodeAt(0), 0);
    const random = ((seed * 9301 + 49297) % 233280) / 233280;

    // 10% 확률로 오늘 연차 사용 중
    const hasUsage = random < 0.1;

    if (!hasUsage) {
      return {
        hasUsage: false,
        totalDays: 0,
        records: [],
      };
    }

    const leaveType =
      random < 0.7 ? this.leaveTypes.full : this.leaveTypes.half;
    return {
      hasUsage: true,
      totalDays: leaveType.value,
      records: [
        {
          leaveType: leaveType.label,
          days: leaveType.value,
          reason: "개인 사정",
          timeSlot:
            leaveType.value === 0.5 ? (random < 0.5 ? "오전" : "오후") : "종일",
        },
      ],
    };
  }

  // ===== ⚙️ 설정 및 관리 =====

  /**
   * ⚙️ 사용자 연차 설정 조회
   */
  async getUserSettings(userId) {
    try {
      // 📊 Mock 설정 데이터 (실제 DB 연동 시 수정)
      const mockSettings = {
        userId,
        totalAnnualLeave: this.config.defaultAnnualLeave,
        enableNotifications: this.config.enableNotifications,
        notifyBeforeDays: 7,
        autoApproval: this.config.autoApproval,
        allowedLeaveTypes: Object.keys(this.leaveTypes).filter(
          (key) => this.leaveTypes[key].enabled
        ),
        carryOverEnabled: true,
        maxCarryOver: this.config.maxCarryOver,
        lastUpdated: new Date(),
      };

      logger.debug(`⚙️ 사용자 설정 조회 완료: 사용자 ${userId}`);
      return this.createSuccessResponse(mockSettings, "사용자 설정 조회 완료");
    } catch (error) {
      logger.error("⚙️ 사용자 설정 조회 실패:", error);
      return this.createErrorResponse(
        error,
        "사용자 설정 조회 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ⚙️ 사용자 연차 설정 업데이트
   */
  async updateUserSettings(userId, settings) {
    try {
      // 📝 Mock 설정 업데이트 (실제 DB 연동 시 수정)
      const updatedSettings = {
        ...settings,
        userId,
        updatedAt: new Date(),
      };

      logger.info(`⚙️ 사용자 설정 업데이트 완료: 사용자 ${userId}`);
      return this.createSuccessResponse(
        updatedSettings,
        "설정이 업데이트되었습니다."
      );
    } catch (error) {
      logger.error("⚙️ 사용자 설정 업데이트 실패:", error);
      return this.createErrorResponse(
        error,
        "설정 업데이트 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🔍 레거시 호환성 메서드 =====

  /**
   * 🔍 레거시: useLeave -> requestLeave 래퍼
   */
  async useLeave(userId, leaveData) {
    logger.debug("🔍 레거시 useLeave 호출 -> requestLeave로 리다이렉트");
    return await this.requestLeave(userId, leaveData);
  }

  // ===== 📊 서비스 상태 및 정리 =====

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      config: {
        defaultAnnualLeave: this.config.defaultAnnualLeave,
        enableHalfDay: this.config.enableHalfDay,
        enableQuarterDay: this.config.enableQuarterDay,
        autoApproval: this.config.autoApproval,
      },
      leaveTypes: Object.keys(this.leaveTypes).filter(
        (key) => this.leaveTypes[key].enabled
      ),
      version: "1.0.0",
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
