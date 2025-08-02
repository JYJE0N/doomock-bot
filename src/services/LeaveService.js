// src/services/LeaveService.js - 🏖️ SoC 완벽 준수 버전
const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveService - 휴가/연차 관리 서비스
 *
 * 🎯 핵심 역할: 실제 DB와 연동하여 연차 데이터 관리
 * ✅ SRP 준수: 데이터 처리만 담당 (UI 생성은 렌더러에서)
 *
 * 비유: 호텔의 객실 관리 시스템
 * - 객실 현황 파악 (잔여 연차)
 * - 예약 처리 (연차 신청)
 * - 이용 내역 관리 (사용 기록)
 */
class LeaveService extends BaseService {
  constructor() {
    super();
    this.config = {
      defaultAnnualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,
      maxLeavePerRequest: 5,
      minAdvanceNotice: 1,
    };

    // 🎯 SoC 준수: 모델 접근은 serviceBuilder를 통해서만
    this.mongooseManager = null;
    this.Leave = null;
    this.UserLeaveSetting = null;
  }

  /**
   * 🔧 서비스 초기화 (SoC 준수)
   */
  async onInitialize() {
    try {
      // ServiceBuilder에서 MongooseManager 가져오기
      this.mongooseManager = this.serviceBuilder?.mongooseManager;

      if (!this.mongooseManager) {
        throw new Error("MongooseManager를 찾을 수 없습니다");
      }

      // 모델 연결
      this.Leave = this.mongooseManager.getModel("Leave");
      this.UserLeaveSetting = this.mongooseManager.getModel("UserLeaveSetting");

      if (!this.Leave || !this.UserLeaveSetting) {
        throw new Error("Leave 또는 UserLeaveSetting 모델을 찾을 수 없습니다");
      }

      logger.success("🏖️ LeaveService 초기화 완료");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 연차 현황 조회 (핵심 메서드!)
   *
   * 비유: 은행 계좌 잔고 확인
   * - 총 한도 (연차 할당량)
   * - 사용 금액 (이미 쓴 연차)
   * - 잔여 금액 (남은 연차)
   */
  async getLeaveStatus(userId) {
    try {
      // 🎯 SoC: 초기화 확인은 한 번만
      this.ensureInitialized();

      const currentYear = new Date().getFullYear();

      // 1. 사용자 설정 조회/생성 (DB 스키마의 정적 메서드 활용)
      const userSetting = await this.UserLeaveSetting.getOrCreate(
        userId,
        currentYear
      );

      // 2. 실제 사용량 조회 (DB 스키마의 정적 메서드 활용)
      const leaveStatus = await this.Leave.getLeaveStatus(userId, currentYear);

      // 3. 종합 현황 생성 (순수 데이터 처리)
      const status = {
        userId,
        year: currentYear,
        totalLeave: userSetting.annualLeave,
        usedLeave: leaveStatus.used,
        remainingLeave: userSetting.annualLeave - leaveStatus.used,
        usageRate: leaveStatus.usageRate,
        // 정책 정보
        canUseHalfDay: userSetting.policy.allowHalfDay,
        canUseQuarterDay: userSetting.policy.allowQuarterDay,
        requireApproval: userSetting.policy.requireApproval,
      };

      logger.debug(
        `📊 연차 현황 조회: ${userId} - ${status.remainingLeave}일 남음`
      );
      return this.createSuccessResponse(status, "연차 현황 조회 완료");
    } catch (error) {
      return this.handleServiceError("연차 현황 조회", error);
    }
  }

  /**
   * 🏖️ 연차 신청 (실제 DB 저장)
   *
   * 비유: 여행사에서 항공편 예약
   * - 좌석 확인 (잔여 연차)
   * - 예약 처리 (DB 저장)
   * - 확인서 발급 (응답 반환)
   */
  async requestLeave(userId, date, type, reason = "") {
    try {
      this.ensureInitialized();

      // 1. 입력 검증 (순수 로직)
      const validation = this.validateLeaveRequest(date, type);
      if (!validation.isValid) {
        return this.createErrorResponse(
          new Error("INVALID_INPUT"),
          validation.message
        );
      }

      // 2. 현재 연차 현황 확인
      const statusResponse = await this.getLeaveStatus(userId);
      if (!statusResponse.success) {
        return statusResponse;
      }

      const status = statusResponse.data;
      const leaveAmount = this.calculateLeaveAmount(type);

      // 3. 잔여 연차 확인
      if (status.remainingLeave < leaveAmount) {
        return this.createErrorResponse(
          new Error("INSUFFICIENT_LEAVE"),
          `잔여 연차가 부족합니다. (필요: ${leaveAmount}일, 잔여: ${status.remainingLeave}일)`
        );
      }

      // 4. 중복 신청 확인 (DB 쿼리)
      const duplicateCheck = await this.checkDuplicateLeave(userId, date);
      if (duplicateCheck) {
        return this.createErrorResponse(
          new Error("DUPLICATE_LEAVE"),
          "해당 날짜에 이미 연차 신청이 있습니다"
        );
      }

      // 5. 실제 DB에 저장 (스키마 미들웨어가 자동 처리)
      const leaveRecord = new this.Leave({
        userId: userId.toString(),
        usedDate: new Date(date),
        days: leaveAmount,
        reason: reason.trim(),
        status: status.requireApproval ? "pending" : "approved",
        metadata: {
          requestedBy: "user",
          source: "bot",
        },
      });

      await leaveRecord.save();

      logger.success(`🏖️ 연차 신청 완료: ${userId} - ${leaveAmount}일`);

      return this.createSuccessResponse(
        {
          id: leaveRecord._id,
          date: TimeHelper.format(date, "full"),
          type,
          amount: leaveAmount,
          reason,
          status: leaveRecord.status,
        },
        "연차 신청이 완료되었습니다"
      );
    } catch (error) {
      return this.handleServiceError("연차 신청", error);
    }
  }

  /**
   * 📋 연차 사용 이력 조회 (실제 DB에서)
   *
   * 비유: 신용카드 사용 내역서
   * - 시간순 정렬
   * - 페이징 처리
   * - 필터링 옵션
   */
  async getLeaveHistory(userId, options = {}) {
    try {
      await this.initializeModels();

      const {
        year = new Date().getFullYear(),
        limit = 20,
        page = 1,
        type = null,
      } = options;

      const skip = (page - 1) * limit;

      // DB에서 실제 이력 조회
      const history = await this.Leave.getLeaveHistory(userId, {
        year,
        limit,
        skip,
        type,
      });

      // 데이터 가공 (UI 친화적으로)
      const formattedHistory = history.map((leave) => ({
        id: leave._id,
        date: TimeHelper.format(leave.usedDate, "simple"),
        type: leave.leaveType,
        amount: leave.days,
        reason: leave.reason || "사유 없음",
        status: leave.status,
        requestedAt: TimeHelper.format(leave.createdAt, "simple"),
      }));

      logger.info(`📋 연차 이력 조회: ${userId} - ${history.length}건`);

      return this.createSuccessResponse(
        {
          items: formattedHistory,
          pagination: {
            page,
            limit,
            total: formattedHistory.length,
            hasMore: formattedHistory.length === limit,
          },
        },
        "연차 이력 조회 완료"
      );
    } catch (error) {
      logger.error("연차 이력 조회 실패:", error);
      return this.createErrorResponse(error, "연차 이력 조회 중 오류 발생");
    }
  }

  /**
   * 📈 월별 연차 사용 통계
   *
   * 비유: 가계부의 월별 지출 내역
   */
  async getMonthlyStats(userId, year = null) {
    try {
      await this.initializeModels();

      const targetYear = year || new Date().getFullYear();
      const monthlyData = await this.Leave.getMonthlyUsage(userId, targetYear);

      return this.createSuccessResponse(monthlyData, "월별 통계 조회 완료");
    } catch (error) {
      logger.error("월별 통계 조회 실패:", error);
      return this.createErrorResponse(error, "월별 통계 조회 중 오류 발생");
    }
  }

  /**
   * 🔍 오늘 연차 사용 여부 확인
   */
  async getTodayUsage(userId) {
    try {
      await this.initializeModels();

      const todayUsage = await this.Leave.getTodayUsage(userId);

      return this.createSuccessResponse(todayUsage, "오늘 연차 사용 조회 완료");
    } catch (error) {
      logger.error("오늘 연차 조회 실패:", error);
      return this.createErrorResponse(error, "오늘 연차 조회 중 오류 발생");
    }
  }

  // ===== 🔧 유틸리티 메서드들 (순수 로직) =====

  /**
   * 🔧 초기화 상태 확인
   */
  ensureInitialized() {
    if (!this.Leave || !this.UserLeaveSetting) {
      throw new Error("LeaveService가 초기화되지 않았습니다");
    }
  }

  /**
   * 🔧 서비스 에러 처리 (중복 제거)
   */
  handleServiceError(operation, error) {
    logger.error(`${operation} 실패:`, error);
    return this.createErrorResponse(
      error,
      `${operation} 중 오류가 발생했습니다`
    );
  }

  /**
   * 연차 신청 입력값 검증
   */
  validateLeaveRequest(date, type) {
    const targetDate = new Date(date);
    const today = new Date();
    const minDate = new Date(
      today.getTime() + this.config.minAdvanceNotice * 24 * 60 * 60 * 1000
    );

    // 과거 날짜 체크
    if (targetDate < minDate) {
      return {
        isValid: false,
        message: `최소 ${this.config.minAdvanceNotice}일 전에 신청해야 합니다`,
      };
    }

    // 주말 체크
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isValid: false,
        message: "주말에는 연차를 사용할 수 없습니다",
      };
    }

    // 연차 타입 체크
    const validTypes = ["quarter", "half", "full"];
    if (!validTypes.includes(type)) {
      return {
        isValid: false,
        message: "유효하지 않은 연차 타입입니다",
      };
    }

    return { isValid: true };
  }

  /**
   * 연차 타입별 사용 일수 계산
   */
  calculateLeaveAmount(type) {
    const amounts = {
      quarter: 0.25, // 반반차
      half: 0.5, // 반차
      full: 1.0, // 연차
    };
    return amounts[type] || 1.0;
  }

  /**
   * 중복 연차 신청 확인
   */
  async checkDuplicateLeave(userId, date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.Leave.findOne({
      userId: userId.toString(),
      usedDate: { $gte: startOfDay, $lt: endOfDay },
      isActive: true,
      status: { $in: ["approved", "pending"] },
    });

    return !!existing;
  }

  /**
   * 연차 설정 업데이트
   */
  async updateUserSettings(userId, settings) {
    try {
      await this.initializeModels();

      const userSetting = await this.UserLeaveSetting.getOrCreate(userId);

      // 설정 업데이트
      if (settings.annualLeave) {
        userSetting.annualLeave = settings.annualLeave;
      }

      if (settings.policy) {
        Object.assign(userSetting.policy, settings.policy);
      }

      userSetting.metadata.lastModified = new Date();
      userSetting.metadata.modifiedBy = "user";

      await userSetting.save();

      return this.createSuccessResponse(userSetting, "설정 업데이트 완료");
    } catch (error) {
      logger.error("설정 업데이트 실패:", error);
      return this.createErrorResponse(error, "설정 업데이트 중 오류 발생");
    }
  }
}

module.exports = LeaveService;
