// src/modules/LeaveModule.js - 🏖️ 연차 관리 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveModule - 연차 관리 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: leave:action:params
 * ✅ 렌더링은 Renderer가 담당
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.leaveService = null;

    // 모듈 설정
    this.config = {
      defaultAnnualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,

      leaveTypes: {
        full: { value: 1.0, label: "연차 (1일)", schemaType: "연차" },
        half: { value: 0.5, label: "반차 (0.5일)", schemaType: "반차" },
        quarter: {
          value: 0.25,
          label: "반반차 (0.25일)",
          schemaType: "반반차",
        },
      },

      enableHistory: true,
      enableStats: true,
      maxHistoryItems: 50,
      ...options.config,
    };

    logger.info(`🏖️ LeaveModule 생성 완료 (v4.1)`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      if (this.serviceBuilder) {
        this.leaveService = await this.serviceBuilder.getOrCreate("leave", {
          config: this.config,
        });
      }

      if (!this.leaveService) {
        throw new Error("LeaveService 생성 실패");
      }

      logger.success("✅ LeaveModule 초기화 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      use: this.handleUseLeave,
      status: this.showStatus,
      remaining: this.showRemaining,
      history: this.handleHistory,
      settings: this.showSettings,
      stats: this.showStats,
      help: this.showHelp,
    });

    logger.info(`✅ LeaveModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 모듈 키워드 확인
    const keywords = ["연차", "휴가", "반차", "반반차", "leave", "vacation"];

    if (this.isModuleMessage(text, keywords)) {
      // 렌더러에게 메뉴 렌더링 요청
      return {
        type: "render_request",
        module: "leave",
        action: "menu",
        chatId: chatId,
        data: await this.getMenuData(userId),
      };
    }

    // 사용자 입력 상태 처리
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const menuData = await this.getMenuData(userId);

      return {
        type: "menu",
        module: "leave",
        data: {
          ...menuData,
          userName,
        },
      };
    } catch (error) {
      logger.error("연차 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🏖️ 연차 사용 처리
   */
  async handleUseLeave(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏖️ 연차 사용 처리`, { userId, userName, params });

    try {
      const status = await this.leaveService.getLeaveStatus(userId);

      if (status.remaining <= 0) {
        return {
          type: "error",
          message: "사용 가능한 연차가 없습니다.",
        };
      }

      // 파라미터가 없으면 선택 메뉴 데이터 반환
      if (!params || params[0] === undefined) {
        return {
          type: "use_select",
          module: "leave",
          data: {
            status,
            leaveTypes: this.config.leaveTypes,
          },
        };
      }

      // 연차 타입별 사용 처리
      const leaveType = params[0];
      return await this.processLeaveByType(userId, userName, leaveType, status);
    } catch (error) {
      logger.error("연차 사용 처리 실패:", error);
      return {
        type: "error",
        message: "연차 사용을 처리할 수 없습니다.",
      };
    }
  }

  /**
   * 📋 이력 조회 처리
   */
  async handleHistory(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      const filterType = params[0] || "recent";

      let historyData;
      let title;

      switch (filterType) {
        case "month":
          const currentMonth = new Date().getMonth() + 1;
          historyData = await this.leaveService.getMonthlyHistory(
            userId,
            currentYear,
            currentMonth
          );
          title = `${currentYear}년 ${currentMonth}월 이력`;
          break;

        case "year":
          historyData = await this.leaveService.getYearlyHistory(
            userId,
            currentYear
          );
          title = `${currentYear}년 전체 이력`;
          break;

        default:
          historyData = await this.leaveService.getRecentHistory(
            userId,
            this.config.maxHistoryItems
          );
          title = "최근 사용 이력";
      }

      return {
        type: "history",
        module: "leave",
        data: {
          history: historyData,
          title,
          filterType,
          year: currentYear,
        },
      };
    } catch (error) {
      logger.error("연차 이력 조회 실패:", error);
      return {
        type: "error",
        message: "이력을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 현황 표시
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

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
          userName,
          status,
          monthlyUsage,
          year: currentYear,
          recommendation: this.getUsageRecommendation(status),
        },
      };
    } catch (error) {
      logger.error("연차 현황 조회 실패:", error);
      return {
        type: "error",
        message: "현황을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📈 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      const stats = await this.leaveService.getUserStats(userId, currentYear);

      return {
        type: "stats",
        module: "leave",
        data: {
          stats,
          year: currentYear,
        },
      };
    } catch (error) {
      logger.error("연차 통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    return {
      type: "help",
      module: "leave",
      data: {
        config: this.config,
        features: {
          use: "연차/반차/반반차 사용",
          status: "연차 현황 확인",
          history: "사용 이력 조회",
          stats: "통계 확인",
        },
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 🎯 타입별 연차 사용 처리 (핵심 비즈니스 로직)
   */
  async processLeaveByType(userId, userName, leaveType, status) {
    // 커스텀 입력 처리
    if (leaveType === "custom") {
      return {
        type: "custom_input_request",
        module: "leave",
        data: { status },
      };
    }

    // 표준 타입 처리
    const typeConfig = this.config.leaveTypes[leaveType];
    if (!typeConfig) {
      return {
        type: "error",
        message: `지원하지 않는 연차 타입입니다: ${leaveType}`,
      };
    }

    try {
      // 연차 사용 처리
      const result = await this.leaveService.useLeave(userId, {
        amount: typeConfig.value,
        type: typeConfig.schemaType,
        reason: `${typeConfig.label} 사용`,
        date: TimeHelper.now().toISOString(),
      });

      if (result.success) {
        logger.info(`✅ 연차 사용 성공`, {
          userId,
          userName,
          type: leaveType,
          amount: typeConfig.value,
          remaining: result.currentRemaining,
        });

        return {
          type: "use_success",
          module: "leave",
          data: {
            leaveType: typeConfig.label,
            amount: typeConfig.value,
            currentRemaining: result.currentRemaining,
            usageRecord: result.record,
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
          },
        };
      } else {
        return {
          type: "error",
          message: result.reason || "연차 사용에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("연차 사용 처리 오류:", error);
      return {
        type: "error",
        message: "연차 사용 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📝 커스텀 연차 입력 처리
   */
  async handleUserInput(bot, msg, text, userState) {
    const { action, chatId, status } = userState;
    const {
      from: { id: userId },
    } = msg;

    if (action !== "custom_leave") return false;

    const days = parseFloat(text.trim());

    // 입력 검증
    if (isNaN(days) || days <= 0 || days > 5) {
      return {
        type: "input_error",
        message: "올바른 연차 일수를 입력해주세요 (0.25 - 5.0일)",
      };
    }

    if ((days * 4) % 1 !== 0) {
      return {
        type: "input_error",
        message:
          "연차는 0.25일 단위로만 사용 가능합니다\n(예: 0.25, 0.5, 1.0, 1.5)",
      };
    }

    if (days > status.remaining) {
      return {
        type: "input_error",
        message: `잔여 연차(${status.remaining}일)보다 많이 사용할 수 없습니다.`,
      };
    }

    try {
      // 타입 결정
      const schemaType =
        days >= 1.0 ? "연차" : days === 0.5 ? "반차" : "반반차";

      const result = await this.leaveService.useLeave(userId, {
        amount: days,
        type: schemaType,
        reason: `${days}일 연차 사용`,
        date: TimeHelper.now().toISOString(),
      });

      this.clearUserState(userId);

      if (result.success) {
        return {
          type: "custom_use_success",
          module: "leave",
          data: {
            amount: days,
            currentRemaining: result.currentRemaining,
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
          },
        };
      } else {
        return {
          type: "error",
          message: result.reason || "연차 사용에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("커스텀 연차 사용 처리 실패:", error);
      this.clearUserState(userId);
      return {
        type: "error",
        message: "연차 사용 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🏠 메뉴 데이터 조회
   */
  async getMenuData(userId) {
    const status = await this.leaveService.getLeaveStatus(userId);
    const todayUsage = await this.leaveService.getTodayUsage(userId);

    return {
      status,
      todayUsage,
      config: this.config,
    };
  }

  /**
   * 💡 사용 권장사항 생성
   */
  getUsageRecommendation(status) {
    const { remaining, usageRate, annual } = status;
    const currentMonth = new Date().getMonth() + 1;
    const remainingMonths = 12 - currentMonth + 1;

    if (usageRate < 30 && currentMonth > 6) {
      return "연차 사용이 부족합니다. 적절한 휴식을 취하세요!";
    } else if (usageRate > 80 && currentMonth < 10) {
      return "연차 사용이 많습니다. 계획적으로 사용하세요.";
    } else if (remaining > 0 && currentMonth === 12) {
      return "올해 남은 연차를 모두 사용하세요!";
    } else {
      const monthlyRecommend = (remaining / remainingMonths).toFixed(1);
      return `월 평균 ${monthlyRecommend}일씩 사용하시면 적절합니다.`;
    }
  }

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
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.leaveService,
      config: {
        defaultAnnualLeave: this.config.defaultAnnualLeave,
        leaveTypes: Object.keys(this.config.leaveTypes),
        enableHistory: this.config.enableHistory,
        enableStats: this.config.enableStats,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async onCleanup() {
    try {
      if (this.leaveService && this.leaveService.cleanup) {
        await this.leaveService.cleanup();
      }
      logger.info("✅ LeaveModule 정리 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 정리 실패:", error);
    }
  }
}

module.exports = LeaveModule;
