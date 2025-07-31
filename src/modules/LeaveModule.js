// src/modules/LeaveModule.js - 🏖️ 연차 관리 모듈 v3.0.1
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveModule - 연차 관리 모듈
 *
 * 🎯 주요 기능:
 * - 연차/반차/반반차 사용 (1일, 0.5일, 0.25일)
 * - 연간 연차 관리 (1월 1일 생성, 12월 31일 소멸)
 * - 사용 이력 조회
 * - 잔여 연차 확인
 *
 * ✅ 표준 준수:
 * - BaseModule 상속
 * - actionMap 방식
 * - 표준 매개변수 구조
 * - ServiceBuilder 패턴
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ServiceBuilder 연결
    this.serviceBuilder = options.serviceBuilder || null;
    this.leaveService = null;

    // 모듈 설정
    this.config = {
      // 기본 연차일수 (환경변수 또는 기본값)
      defaultAnnualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,

      // 연차 사용 단위
      leaveUnits: {
        full: { value: 1.0, label: "연차 (1일)" },
        half: { value: 0.5, label: "반차 (0.5일)" },
        quarter: { value: 0.25, label: "반반차 (0.25일)" },
      },

      // 연차 년도 관리
      yearStartMonth: 1, // 1월부터 시작
      yearStartDay: 1, // 1일부터 시작

      // 기능 활성화
      enableHistory: true,
      enableStats: true,
      maxHistoryItems: 100,

      ...options.config,
    };

    // 사용자 입력 상태 관리
    this.inputStates = new Map();

    logger.info("[LeaveModule] 모듈 생성", { version: "3.0.1" });
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      logger.info("[LeaveModule] 초기화 시작...");

      // ServiceBuilder를 통한 서비스 생성
      if (this.serviceBuilder) {
        this.leaveService = await this.serviceBuilder.getOrCreate("leave", {
          config: this.config,
        });
      }

      if (!this.leaveService) {
        throw new Error("LeaveService 생성 실패");
      }

      logger.success("LeaveModule 초기화 완료");
    } catch (error) {
      logger.error("LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,

      // 연차 사용
      use: this.startUseLeave,
      "use:full": this.useFullDay,
      "use:half": this.useHalfDay,
      "use:quarter": this.useQuarterDay,
      "use:custom": this.startCustomUse,
      "use:confirm": this.confirmUseLeave,

      // 연차 현황
      status: this.showStatus,
      remaining: this.showRemaining,

      // 연차 이력
      history: this.showHistory,
      "history:month": this.showMonthHistory,
      "history:year": this.showYearHistory,

      // 설정
      settings: this.showSettings,
      "settings:annual": this.setAnnualLeave,
      "settings:reset": this.resetAnnualLeave,

      // 통계
      stats: this.showStats,

      // 도움말
      help: this.showHelp,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 모듈 키워드 확인
    const keywords = [
      "연차",
      "휴가",
      "반차",
      "반반차",
      "leave",
      "vacation",
      "휴일",
    ];

    if (this.isModuleMessage(text, keywords)) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "leave"
      );
      return true;
    }

    // 사용자 입력 상태 처리
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  // ===== 📋 메인 액션 메서드들 =====

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      // 현재 연차 상태 조회
      const status = await this.leaveService.getLeaveStatus(userId);
      const todayUsage = await this.leaveService.getTodayUsage(userId);

      return {
        type: "menu",
        module: "leave",
        data: {
          userName,
          status,
          todayUsage,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("연차 메뉴 조회 실패:", error);
      return {
        type: "error",
        message: "연차 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 연차 현황 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      const status = await this.leaveService.getDetailedStatus(
        userId,
        currentYear
      );
      const monthlyUsage = await this.leaveService.getMonthlyUsage(
        userId,
        currentYear
      );

      return {
        type: "status",
        module: "leave",
        data: {
          status,
          monthlyUsage,
          year: currentYear,
        },
      };
    } catch (error) {
      logger.error("연차 현황 조회 실패:", error);
      return {
        type: "error",
        message: "연차 현황을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🏖️ 연차 사용 시작
   */
  async startUseLeave(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 잔여 연차 확인
      const status = await this.leaveService.getLeaveStatus(userId);

      if (status.remaining <= 0) {
        return {
          type: "info",
          message: "사용 가능한 연차가 없습니다.",
          data: { status },
        };
      }

      return {
        type: "use_select",
        module: "leave",
        data: {
          status,
          leaveUnits: this.config.leaveUnits,
        },
      };
    } catch (error) {
      logger.error("연차 사용 시작 실패:", error);
      return {
        type: "error",
        message: "연차 사용을 시작할 수 없습니다.",
      };
    }
  }

  /**
   * 📅 연차 사용 (1일)
   */
  async useFullDay(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.processLeaveUse(callbackQuery, 1.0, "연차 (1일)");
  }

  /**
   * 🕐 반차 사용 (0.5일)
   */
  async useHalfDay(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.processLeaveUse(callbackQuery, 0.5, "반차 (0.5일)");
  }

  /**
   * ⏰ 반반차 사용 (0.25일)
   */
  async useQuarterDay(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.processLeaveUse(callbackQuery, 0.25, "반반차 (0.25일)");
  }

  /**
   * 🎯 연차 사용 처리 공통 로직
   */
  async processLeaveUse(callbackQuery, days, leaveType) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      // 잔여 연차 확인
      const status = await this.leaveService.getLeaveStatus(userId);

      if (status.remaining < days) {
        return {
          type: "error",
          message: `잔여 연차가 부족합니다. (필요: ${days}일, 잔여: ${status.remaining}일)`,
        };
      }

      // 연차 사용 처리
      const result = await this.leaveService.useLeave(userId, days, {
        leaveType: leaveType,
        usedDate: new Date(),
        requestedBy: userName,
      });

      if (result.success) {
        // 성공 시 업데이트된 상태 조회
        const updatedStatus = await this.leaveService.getLeaveStatus(userId);

        return {
          type: "use_success",
          module: "leave",
          data: {
            usedDays: days,
            leaveType: leaveType,
            previousRemaining: status.remaining,
            currentRemaining: updatedStatus.remaining,
            usedDate: TimeHelper.format(new Date(), "YYYY-MM-DD"),
          },
        };
      } else {
        return {
          type: "error",
          message: result.error || "연차 사용 처리에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("연차 사용 처리 실패:", error);
      return {
        type: "error",
        message: "연차 사용 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📋 연차 사용 이력 표시
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      const history = await this.leaveService.getLeaveHistory(userId, {
        year: currentYear,
        limit: 20,
        includeStats: true,
      });

      return {
        type: "history",
        module: "leave",
        data: {
          history: history.data,
          year: currentYear,
          total: history.total,
          hasMore: history.hasMore,
        },
      };
    } catch (error) {
      logger.error("연차 이력 조회 실패:", error);
      return {
        type: "error",
        message: "연차 이력을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 연차 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      const stats = await this.leaveService.getYearlyStats(userId, currentYear);
      const monthlyBreakdown = await this.leaveService.getMonthlyUsage(
        userId,
        currentYear
      );

      return {
        type: "stats",
        module: "leave",
        data: {
          stats,
          monthlyBreakdown,
          year: currentYear,
        },
      };
    } catch (error) {
      logger.error("연차 통계 조회 실패:", error);
      return {
        type: "error",
        message: "연차 통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const userSettings = await this.leaveService.getUserSettings(userId);
      const currentYear = new Date().getFullYear();

      return {
        type: "settings",
        module: "leave",
        data: {
          settings: userSettings,
          defaultAnnualLeave: this.config.defaultAnnualLeave,
          currentYear,
        },
      };
    } catch (error) {
      logger.error("연차 설정 조회 실패:", error);
      return {
        type: "error",
        message: "설정을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📝 연간 연차 설정
   */
  async setAnnualLeave(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 사용자 입력 대기 상태로 설정
      this.setUserState(userId, {
        awaitingInput: true,
        inputType: "annual_leave",
        step: "days",
        data: {},
      });

      return {
        type: "input_request",
        module: "leave",
        data: {
          inputType: "annual_leave",
          message: "연간 연차 일수를 입력해주세요 (예: 15)",
          currentValue: this.config.defaultAnnualLeave,
        },
      };
    } catch (error) {
      logger.error("연차 설정 시작 실패:", error);
      return {
        type: "error",
        message: "연차 설정을 시작할 수 없습니다.",
      };
    }
  }

  /**
   * 🔄 연차 리셋 (새해)
   */
  async resetAnnualLeave(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const result = await this.leaveService.resetYearlyLeave(userId);

      return {
        type: "reset_success",
        module: "leave",
        data: {
          newAnnualLeave: result.annualLeave,
          resetDate: TimeHelper.format(new Date(), "YYYY-MM-DD"),
        },
      };
    } catch (error) {
      logger.error("연차 리셋 실패:", error);
      return {
        type: "error",
        message: "연차 리셋에 실패했습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "leave",
      data: {
        features: [
          "연차/반차/반반차 사용",
          "잔여 연차 확인",
          "사용 이력 조회",
          "월별/연도별 통계",
          "연간 연차 설정",
        ],
        leaveUnits: this.config.leaveUnits,
      },
    };
  }

  // ===== 🎯 사용자 입력 처리 =====

  /**
   * 📝 사용자 입력 처리
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    try {
      switch (userState.inputType) {
        case "annual_leave":
          return await this.handleAnnualLeaveInput(bot, msg, text, userState);

        case "custom_use":
          return await this.handleCustomUseInput(bot, msg, text, userState);

        default:
          this.clearUserState(userId);
          return false;
      }
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.clearUserState(userId);

      await bot.sendMessage(chatId, "❌ 입력 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  /**
   * 📊 연간 연차 입력 처리
   */
  async handleAnnualLeaveInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const days = parseInt(text.trim());

    if (isNaN(days) || days < 1 || days > 50) {
      await bot.sendMessage(
        chatId,
        "❌ 올바른 연차 일수를 입력해주세요 (1-50일)"
      );
      return true;
    }

    try {
      const result = await this.leaveService.setUserAnnualLeave(userId, days);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ 연간 연차가 ${days}일로 설정되었습니다.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `❌ 연차 설정에 실패했습니다: ${result.error}`
        );
      }
    } catch (error) {
      await bot.sendMessage(chatId, "❌ 연차 설정 중 오류가 발생했습니다.");
    }

    this.clearUserState(userId);
    return true;
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceConnected: !!this.leaveService,
      activeInputStates: this.inputStates.size,
      config: {
        defaultAnnualLeave: this.config.defaultAnnualLeave,
        leaveUnits: Object.keys(this.config.leaveUnits),
        enableHistory: this.config.enableHistory,
        enableStats: this.config.enableStats,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 입력 상태 정리
      this.inputStates.clear();

      // 부모 클래스 정리 호출
      await super.cleanup();

      logger.info("✅ LeaveModule 정리 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 정리 실패:", error);
    }
  }
}

module.exports = LeaveModule;
