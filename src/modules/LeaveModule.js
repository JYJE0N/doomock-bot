// src/modules/LeaveModule.js - 🏖️ LeaveService와 호환되는 업데이트된 모듈

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🏖️ LeaveModule - 연차 관리 모듈 (완전 구현)
 *
 * 🎯 핵심 역할: 연차 관리 비즈니스 로직 처리
 * ✅ SRP 준수: 데이터 처리만 담당 (UI는 렌더러가 처리)
 *
 * 비유: 회사의 인사팀 담당자
 * - 연차 신청서를 검토하고 처리
 * - 직원별 연차 현황을 파악
 * - 연차 사용 이력을 관리
 * - 렌더러(UI 담당자)에게 정리된 데이터 전달
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.leaveService = null;

    // 🎯 모듈 설정 (LeaveService와 동기화)
    this.config = {
      defaultAnnualLeave: 15, // 기본 연차 일수
      leaveTypes: {
        full: { value: 1.0, label: "연차 (1일)", icon: "🕘" },
        half: { value: 0.5, label: "반차 (0.5일)", icon: "🕒" },
        quarter: { value: 0.25, label: "반반차 (0.25일)", icon: "🕐" },
      },
      pageSize: 10,
      ...options.config,
    };

    logger.info("🏖️ LeaveModule 생성됨 - 완전 구현");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      // ServiceBuilder에서 LeaveService 가져오기
      this.leaveService = await this.serviceBuilder.getOrCreate("leave");

      if (!this.leaveService) {
        throw new Error("LeaveService를 찾을 수 없습니다");
      }

      // 액션 등록
      this.setupActions();

      logger.success("🏖️ LeaveModule 초기화 완료 - LeaveService 연동");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 패턴)
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("main", this.showMenu.bind(this)); // menu 별칭
    this.actionMap.set("status", this.showStatus.bind(this));
    this.actionMap.set("request", this.showRequestForm.bind(this));
    this.actionMap.set("selectDate", this.handleLeaveTypeSelection.bind(this));
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("monthly", this.showMonthlyStats.bind(this));
    this.actionMap.set("today", this.showTodayUsage.bind(this));
    this.actionMap.set("settings", this.showSettings.bind(this));

    logger.debug(
      "🎯 LeaveModule 액션 등록 완료:",
      Array.from(this.actionMap.keys())
    );
  }

  // ===== 🏠 메인 메뉴 및 현황 =====

  /**
   * 🏠 연차 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 현재 연차 현황 조회 (메뉴에서 간단히 표시용)
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      return {
        type: "main_menu",
        module: "leave",
        data: {
          userId,
          userName,
          status: statusResult.success ? statusResult.data : null,
        },
      };
    } catch (error) {
      logger.error("🏠 LeaveModule.showMenu 실패:", error);
      return this.createErrorResult("메인 메뉴를 표시할 수 없습니다.");
    }
  }

  /**
   * 📊 연차 현황 상세 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 상세 연차 현황 조회
      const result = await this.leaveService.getLeaveStatus(userId);

      if (!result.success) {
        return this.createErrorResult(result.message);
      }

      return {
        type: "status",
        module: "leave",
        data: {
          userName,
          ...result.data, // totalLeave, usedLeave, remainingLeave, usageRate 등
          year: new Date().getFullYear(),
        },
      };
    } catch (error) {
      logger.error("📊 LeaveModule.showStatus 실패:", error);
      return this.createErrorResult("연차 현황을 조회할 수 없습니다.");
    }
  }

  // ===== 🏖️ 연차 신청 및 처리 =====

  /**
   * 🏖️ 연차 신청 폼 표시
   */
  async showRequestForm(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 현재 연차 현황 확인 (신청 가능 여부 체크)
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      if (!statusResult.success) {
        return this.createErrorResult("연차 현황을 확인할 수 없습니다.");
      }

      return {
        type: "request_form",
        module: "leave",
        data: statusResult.data, // remainingLeave, canUseHalfDay, canUseQuarterDay 등
      };
    } catch (error) {
      logger.error("🏖️ LeaveModule.showRequestForm 실패:", error);
      return this.createErrorResult("연차 신청 폼을 표시할 수 없습니다.");
    }
  }

  /**
   * 🎯 연차 타입 선택 처리
   */
  async handleLeaveTypeSelection(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const userId = getUserId(callbackQuery.from);
      const leaveType = params; // full, half, quarter

      // 유효한 연차 타입인지 확인
      const leaveConfig = this.config.leaveTypes[leaveType];
      if (!leaveConfig) {
        return this.createErrorResult("잘못된 연차 타입입니다.");
      }

      // 🎯 실제 연차 신청 처리 (Mock 데이터로 즉시 처리)
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // 내일 날짜로 신청

      const leaveData = {
        date: tomorrow.toISOString().split("T")[0], // YYYY-MM-DD 형식
        type: leaveType,
        reason: `${leaveConfig.label} 신청`,
        timeSlot: leaveType === "half" ? "오전" : null,
      };

      // LeaveService를 통해 연차 신청 처리
      const requestResult = await this.leaveService.requestLeave(
        userId,
        leaveData
      );

      if (!requestResult.success) {
        return this.createErrorResult(requestResult.message);
      }

      return {
        type: "request_success",
        module: "leave",
        data: requestResult.data, // 신청 완료 정보
      };
    } catch (error) {
      logger.error("🎯 LeaveModule.handleLeaveTypeSelection 실패:", error);
      return this.createErrorResult("연차 신청 처리 중 오류가 발생했습니다.");
    }
  }

  // ===== 📋 이력 및 통계 =====

  /**
   * 📋 연차 사용 이력 표시
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // params에서 year:page 파싱 (예: "2024:1")
      const [year, page] = params ? params.split(":") : [null, null];
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const currentPage = page ? parseInt(page) : 1;

      const result = await this.leaveService.getLeaveHistory(userId, {
        year: targetYear,
        page: currentPage,
        limit: this.config.pageSize,
      });

      if (!result.success) {
        return this.createErrorResult("이력을 불러올 수 없습니다.");
      }

      return {
        type: "history",
        module: "leave",
        data: {
          ...result.data, // items, pagination, year, summary
          year: targetYear,
        },
      };
    } catch (error) {
      logger.error("📋 LeaveModule.showHistory 실패:", error);
      return this.createErrorResult("연차 이력을 조회할 수 없습니다.");
    }
  }

  /**
   * 📈 월별 연차 사용 통계
   */
  async showMonthlyStats(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // params에서 year 파싱 (예: "2024")
      const year = params ? parseInt(params) : new Date().getFullYear();

      const result = await this.leaveService.getMonthlyStats(userId, year);

      if (!result.success) {
        return this.createErrorResult("월별 통계를 불러올 수 없습니다.");
      }

      return {
        type: "monthly_stats",
        module: "leave",
        data: result.data, // year, monthlyData, yearSummary
      };
    } catch (error) {
      logger.error("📈 LeaveModule.showMonthlyStats 실패:", error);
      return this.createErrorResult("월별 통계를 조회할 수 없습니다.");
    }
  }

  /**
   * 📆 오늘 연차 사용 현황
   */
  async showTodayUsage(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      const result = await this.leaveService.getTodayUsage(userId);

      if (!result.success) {
        return this.createErrorResult("오늘 연차 현황을 확인할 수 없습니다.");
      }

      return {
        type: "today_usage",
        module: "leave",
        data: result.data, // hasUsage, totalDays, records
      };
    } catch (error) {
      logger.error("📆 LeaveModule.showTodayUsage 실패:", error);
      return this.createErrorResult("오늘 연차 현황을 조회할 수 없습니다.");
    }
  }

  // ===== ⚙️ 설정 관리 =====

  /**
   * ⚙️ 연차 설정 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      const result = await this.leaveService.getUserSettings(userId);

      if (!result.success) {
        return this.createErrorResult("설정을 불러올 수 없습니다.");
      }

      return {
        type: "settings",
        module: "leave",
        data: {
          ...result.data,
          message: "연차 설정을 관리합니다.",
          config: this.config, // 모듈 설정도 함께 전달
        },
      };
    } catch (error) {
      logger.error("⚙️ LeaveModule.showSettings 실패:", error);
      return this.createErrorResult("설정을 조회할 수 없습니다.");
    }
  }

  // ===== 🔧 헬퍼 메서드 =====

  /**
   * 🚨 에러 결과 생성 헬퍼
   */
  createErrorResult(message) {
    return {
      type: "error",
      module: "leave",
      data: { message },
    };
  }

  /**
   * ✅ 성공 결과 생성 헬퍼
   */
  createSuccessResult(type, data, message = "완료") {
    return {
      type,
      module: "leave",
      data: {
        ...data,
        message,
      },
    };
  }

  // ===== 📊 모듈 상태 및 정리 =====

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.leaveService,
      config: this.config,
      version: "1.0.0",
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    await super.cleanup();
    logger.debug("🧹 LeaveModule 정리 완료");
  }
}

module.exports = LeaveModule;
