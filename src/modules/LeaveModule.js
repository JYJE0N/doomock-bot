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
    this.leaveService = this.serviceBuilder.getOrCreate("leave");

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
