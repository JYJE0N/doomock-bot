// src/modules/LeaveModule.js - 개인용 연차 관리 모듈
const BaseModule = require("../core/BaseModule");
const { getUserId, getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveModule - 개인용 연차 관리 모듈
 *
 * 🎯 핵심 액션:
 * - menu: 메인 현황
 * - monthly: 월별 현황
 * - use: 연차 사용 폼
 * - add: 연차 사용 처리 (quarter/half/full)
 * - settings: 설정 메뉴
 * - settings:add/remove: 연차 추가/삭제
 * - settings:joindate: 입사일 설정
 */
class LeaveModule extends BaseModule {
  constructor() {
    super("leave");
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    this.leaveService = await this.serviceBuilder.getOrCreate("leave");
    logger.debug("🏖️ LeaveModule 초기화 완료");
  }

  /**
   * 🎯 액션 매핑 설정
   */
  setupActions() {
    this.actionMap = {
      // 기본 메뉴
      menu: this.showMenu.bind(this),
      monthly: this.showMonthlyView.bind(this),

      // 연차 사용
      use: this.showUseForm.bind(this),
      add: this.handleUseLeave.bind(this),

      // 설정
      settings: this.showSettings.bind(this),

      // 설정 액션들 - settings:action:value 형태
    };
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 연차 현황 조회
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      if (!statusResult.success) {
        return this.createErrorResult(statusResult.message);
      }

      return {
        type: "main_menu",
        module: "leave",
        data: {
          userId,
          userName,
          ...statusResult.data,
        },
      };
    } catch (error) {
      logger.error("🏠 LeaveModule.showMenu 실패:", error);
      return this.createErrorResult("메인 메뉴를 표시할 수 없습니다.");
    }
  }

  /**
   * 📈 월별 현황 표시
   */
  async showMonthlyView(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 월별 사용량 조회
      const monthlyResult = await this.leaveService.getMonthlyUsage(userId);

      if (!monthlyResult.success) {
        return this.createErrorResult(monthlyResult.message);
      }

      return {
        type: "monthly_view",
        module: "leave",
        data: monthlyResult.data,
      };
    } catch (error) {
      logger.error("📈 LeaveModule.showMonthlyView 실패:", error);
      return this.createErrorResult("월별 현황을 표시할 수 없습니다.");
    }
  }

  /**
   * ➕ 연차 사용 폼 표시
   */
  async showUseForm(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 현재 연차 현황 확인
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      if (!statusResult.success) {
        return this.createErrorResult("연차 현황을 확인할 수 없습니다.");
      }

      return {
        type: "use_form",
        module: "leave",
        data: {
          remainingLeave: statusResult.data.remainingLeave,
        },
      };
    } catch (error) {
      logger.error("➕ LeaveModule.showUseForm 실패:", error);
      return this.createErrorResult("연차 사용 폼을 표시할 수 없습니다.");
    }
  }

  /**
   * 🎯 연차 사용 처리
   */
  async handleUseLeave(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const leaveType = params; // quarter, half, full

      // 연차 타입별 사용량 매핑
      const leaveAmounts = {
        quarter: 0.25,
        half: 0.5,
        full: 1,
      };

      const amount = leaveAmounts[leaveType];
      if (!amount) {
        return this.createErrorResult("잘못된 연차 타입입니다.");
      }

      // 연차 사용 처리
      const useResult = await this.leaveService.useLeave(
        userId,
        amount,
        "개인 사용"
      );

      if (!useResult.success) {
        return this.createErrorResult(useResult.message);
      }

      return {
        type: "use_success",
        module: "leave",
        data: useResult.data,
      };
    } catch (error) {
      logger.error("🎯 LeaveModule.handleUseLeave 실패:", error);
      return this.createErrorResult("연차 사용 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * ⚙️ 설정 메뉴 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 사용자 설정 조회
      const settingsResult = await this.leaveService.getUserSettings(userId);

      if (!settingsResult.success) {
        return this.createErrorResult(settingsResult.message);
      }

      return {
        type: "settings",
        module: "leave",
        data: settingsResult.data,
      };
    } catch (error) {
      logger.error("⚙️ LeaveModule.showSettings 실패:", error);
      return this.createErrorResult("설정 메뉴를 표시할 수 없습니다.");
    }
  }

  /**
   * 🎯 콜백 처리 (설정 액션들)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 기본 액션들 먼저 처리
      if (this.actionMap[subAction]) {
        return await this.actionMap[subAction](
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      // 설정 관련 액션들 (settings:action:value 형태)
      if (subAction === "settings") {
        return await this.handleSettingsAction(
          bot,
          callbackQuery,
          params,
          moduleManager
        );
      }

      // 매핑되지 않은 액션
      logger.warn(`🏖️ 지원하지 않는 액션: ${subAction}`);
      return this.createErrorResult(`지원하지 않는 기능입니다: ${subAction}`);
    } catch (error) {
      logger.error("🎯 LeaveModule.handleCallback 실패:", error);
      return this.createErrorResult("처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * ⚙️ 설정 액션 처리 (settings:action:value)
   */
  async handleSettingsAction(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const [action, value] = params.split(":");

      let result;

      switch (action) {
        case "add":
          // 연차 추가 (settings:add:1)
          const addAmount = parseInt(value) || 1;
          result = await this.leaveService.addLeave(userId, addAmount);
          break;

        case "remove":
          // 연차 삭제 (settings:remove:1)
          const removeAmount = parseInt(value) || 1;
          result = await this.leaveService.removeLeave(userId, removeAmount);
          break;

        case "joindate":
          // 입사일 설정 안내 (실제 설정은 텍스트 입력 필요)
          return {
            type: "settings",
            module: "leave",
            data: {
              message: "입사일 설정 기능은 추후 업데이트될 예정입니다.",
              canModify: true,
            },
          };

        default:
          return this.createErrorResult(`지원하지 않는 설정 액션: ${action}`);
      }

      if (!result.success) {
        return this.createErrorResult(result.message);
      }

      return {
        type: "settings_success",
        module: "leave",
        data: result.data,
      };
    } catch (error) {
      logger.error("⚙️ LeaveModule.handleSettingsAction 실패:", error);
      return this.createErrorResult("설정 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📝 일반 메시지 처리 (입사일 설정 등)
   */
  async onHandleMessage(bot, msg) {
    // 향후 입사일 설정 등 텍스트 입력 처리용
    return false; // 현재는 처리하지 않음
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      actions: Object.keys(this.actionMap),
      features: [
        "개인 연차 현황",
        "월별 사용량",
        "연차 사용 기록",
        "연차 설정 관리",
      ],
    };
  }
}

module.exports = LeaveModule;
