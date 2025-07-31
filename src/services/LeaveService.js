// src/modules/LeaveModule.js - 심플 연결 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🏖️ LeaveModule - 연차 관리 모듈 (심플 버전)
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.leaveService = null;

    // 간단한 설정
    this.config = {
      defaultAnnualLeave: 15, // 기본 연차 일수
      leaveTypes: {
        full: { value: 1.0, label: "연차 (1일)" },
        half: { value: 0.5, label: "반차 (0.5일)" },
        quarter: { value: 0.25, label: "반반차 (0.25일)" },
      },
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    this.leaveService = this.serviceBuilder.getServiceInstance("leave");

    if (!this.leaveService) {
      throw new Error("LeaveService를 찾을 수 없습니다");
    }

    this.setupActions();
    logger.success("🏖️ LeaveModule 초기화 완료");
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("status", this.showStatus.bind(this));
    this.actionMap.set("use", this.useLeave.bind(this));
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("settings", this.showSettings.bind(this));
  }

  /**
   * 🏖️ 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    // 현재 연차 현황 조회
    const statusResult = await this.leaveService.getLeaveStatus(userId);

    return {
      type: "menu",
      module: "leave",
      data: {
        userId,
        userName,
        status: statusResult.success ? statusResult.data : null,
      },
    };
  }

  /**
   * 📊 연차 현황 표시
   */
  async showStatus(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    const result = await this.leaveService.getLeaveStatus(userId);

    if (!result.success) {
      return {
        type: "error",
        module: "leave",
        data: { message: result.message },
      };
    }

    return {
      type: "status",
      module: "leave",
      data: {
        userName,
        status: result.data,
        year: new Date().getFullYear(),
      },
    };
  }

  /**
   * 🏖️ 연차 사용
   */
  async useLeave(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    // 현재 연차 현황 확인
    const statusResult = await this.leaveService.getLeaveStatus(userId);

    if (!statusResult.success) {
      return {
        type: "error",
        module: "leave",
        data: { message: "연차 현황을 확인할 수 없습니다." },
      };
    }

    const status = statusResult.data;

    // 연차 사용 타입이 지정된 경우
    if (params) {
      const leaveType = params;
      const leaveConfig = this.config.leaveTypes[leaveType];

      if (!leaveConfig) {
        return {
          type: "error",
          module: "leave",
          data: { message: "잘못된 연차 타입입니다." },
        };
      }

      // 잔여 연차 확인
      if (status.remaining < leaveConfig.value) {
        return {
          type: "error",
          module: "leave",
          data: {
            message: `잔여 연차(${status.remaining}일)가 부족합니다.`,
          },
        };
      }

      // 연차 사용 처리
      const useResult = await this.leaveService.useLeave(userId, {
        amount: leaveConfig.value,
        type: leaveType,
        reason: leaveConfig.label,
        date: new Date(),
      });

      if (!useResult.success) {
        return {
          type: "error",
          module: "leave",
          data: { message: useResult.message },
        };
      }

      return {
        type: "use_success",
        module: "leave",
        data: {
          amount: leaveConfig.value,
          type: leaveType,
          label: leaveConfig.label,
          remaining: useResult.data.remaining,
          message: `${leaveConfig.label}을 사용했습니다.`,
        },
      };
    }

    // 연차 타입 선택 화면
    return {
      type: "use_select",
      module: "leave",
      data: {
        status,
        leaveTypes: this.config.leaveTypes,
      },
    };
  }

  /**
   * 📋 연차 사용 이력
   */
  async showHistory(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    const result = await this.leaveService.getLeaveHistory(userId, {
      limit: 10,
      year: new Date().getFullYear(),
    });

    if (!result.success) {
      return {
        type: "error",
        module: "leave",
        data: { message: "이력을 불러올 수 없습니다." },
      };
    }

    return {
      type: "history",
      module: "leave",
      data: {
        history: result.data.records,
        year: new Date().getFullYear(),
      },
    };
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    return {
      type: "settings",
      module: "leave",
      data: {
        config: this.config,
        message: "연차 설정 기능은 곧 추가될 예정입니다.",
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.debug("🏖️ LeaveModule 정리 완료");
  }
}

module.exports = LeaveModule;

// ===== LeaveService.js - 심플 버전 =====

// src/services/LeaveService.js
const BaseService = require("./BaseService");

/**
 * 🏖️ LeaveService - 연차 데이터 서비스 (심플 버전)
 */
class LeaveService extends BaseService {
  constructor(options = {}) {
    super("LeaveService", options);

    // 임시 메모리 저장소 (나중에 Mongoose로 변경)
    this.leaveRecords = new Map(); // userId -> records[]
    this.userSettings = new Map(); // userId -> settings
  }

  getRequiredModels() {
    return []; // 나중에 ["Leave", "UserLeaveSetting"] 추가
  }

  /**
   * 연차 현황 조회
   */
  async getLeaveStatus(userId) {
    try {
      const currentYear = new Date().getFullYear();
      const records = this.leaveRecords.get(userId.toString()) || [];

      // 올해 사용한 연차 계산
      const thisYearRecords = records.filter(
        (record) => new Date(record.date).getFullYear() === currentYear
      );

      const used = thisYearRecords.reduce(
        (sum, record) => sum + record.amount,
        0
      );
      const annual = this.getUserAnnualLeave(userId);
      const remaining = Math.max(0, annual - used);
      const usageRate = annual > 0 ? (used / annual) * 100 : 0;

      return this.createSuccessResponse({
        year: currentYear,
        annual,
        used: parseFloat(used.toFixed(2)),
        remaining: parseFloat(remaining.toFixed(2)),
        usageRate: parseFloat(usageRate.toFixed(1)),
      });
    } catch (error) {
      return this.createErrorResponse(error, "연차 현황 조회 실패");
    }
  }

  /**
   * 연차 사용
   */
  async useLeave(userId, leaveData) {
    try {
      const { amount, type, reason, date } = leaveData;

      // 현재 연차 현황 확인
      const statusResult = await this.getLeaveStatus(userId);
      if (!statusResult.success) {
        return statusResult;
      }

      const status = statusResult.data;

      // 잔여 연차 확인
      if (status.remaining < amount) {
        return this.createErrorResponse(
          new Error("INSUFFICIENT_LEAVE"),
          `잔여 연차(${status.remaining}일)가 부족합니다.`
        );
      }

      // 연차 사용 기록 생성
      const record = {
        _id: `leave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId.toString(),
        amount: parseFloat(amount),
        type,
        reason,
        date: new Date(date),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 메모리에 저장
      const userRecords = this.leaveRecords.get(userId.toString()) || [];
      userRecords.push(record);
      this.leaveRecords.set(userId.toString(), userRecords);

      // 업데이트된 현황 조회
      const updatedStatus = await this.getLeaveStatus(userId);

      return this.createSuccessResponse(
        {
          record,
          remaining: updatedStatus.data.remaining,
          used: updatedStatus.data.used,
        },
        "연차가 사용되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "연차 사용 실패");
    }
  }

  /**
   * 연차 사용 이력 조회
   */
  async getLeaveHistory(userId, options = {}) {
    try {
      const { year, limit = 20 } = options;
      const records = this.leaveRecords.get(userId.toString()) || [];

      let filteredRecords = records;

      // 연도 필터링
      if (year) {
        filteredRecords = records.filter(
          (record) => new Date(record.date).getFullYear() === year
        );
      }

      // 최신순 정렬 및 제한
      const sortedRecords = filteredRecords
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

      return this.createSuccessResponse({
        records: sortedRecords,
        totalCount: filteredRecords.length,
      });
    } catch (error) {
      return this.createErrorResponse(error, "연차 이력 조회 실패");
    }
  }

  /**
   * 사용자 연간 연차 일수 조회
   */
  getUserAnnualLeave(userId) {
    const settings = this.userSettings.get(userId.toString());
    return settings?.annualLeave || 15; // 기본 15일
  }

  /**
   * 사용자 연차 설정 업데이트
   */
  async updateUserSettings(userId, settings) {
    try {
      this.userSettings.set(userId.toString(), {
        ...this.userSettings.get(userId.toString()),
        ...settings,
        updatedAt: new Date(),
      });

      return this.createSuccessResponse(settings, "설정이 업데이트되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "설정 업데이트 실패");
    }
  }
}

module.exports = LeaveService;
