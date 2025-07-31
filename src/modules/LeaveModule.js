// src/modules/LeaveModule.js - 🏖️ 연차 관리 모듈 (리팩토링 버전)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveModule - 연차 관리 모듈 (단순화된 콜백 파서 대응)
 *
 * 🎯 새로운 콜백 체계:
 * - leave:menu → 메인 메뉴
 * - leave:use:full → use 액션에 params="full"
 * - leave:use:half → use 액션에 params="half"
 * - leave:use:quarter → use 액션에 params="quarter"
 * - leave:history:month → history 액션에 params="month"
 *
 * ✅ 표준 준수:
 * - 단순화된 actionMap
 * - params 매개변수 적극 활용
 * - SRP 준수 (각 액션의 단일 책임)
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ServiceBuilder 연결
    this.serviceBuilder = options.serviceBuilder || null;
    this.leaveService = null;

    // 모듈 설정
    this.config = {
      // 기본 연차일수
      defaultAnnualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,

      // 연차 사용 단위 (새로운 매핑)
      leaveTypes: {
        full: { value: 1.0, label: "연차 (1일)", schemaType: "연차" },
        half: { value: 0.5, label: "반차 (0.5일)", schemaType: "반차" },
        quarter: {
          value: 0.25,
          label: "반반차 (0.25일)",
          schemaType: "반반차",
        },
      },

      // 연차 년도 관리
      yearStartMonth: 1,
      yearStartDay: 1,

      // 기능 설정
      enableHistory: true,
      enableStats: true,
      maxHistoryItems: 100,

      ...options.config,
    };

    logger.info("[LeaveModule] 모듈 생성 (v4.0 - 단순화된 파서)", {
      version: "4.0.0",
    });
  }

  /**
   * 🎯 모듈 초기화
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

      logger.success("✅ LeaveModule 초기화 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (단순화된 버전!)
   */
  setupActions() {
    this.registerActions({
      // 🏠 메인 메뉴
      menu: this.showMenu,

      // 🏖️ 연차 사용 (통합된 단일 액션)
      use: this.handleUseLeave,

      // 📊 연차 현황
      status: this.showStatus,
      remaining: this.showRemaining,

      // 📋 연차 이력 (통합된 단일 액션)
      history: this.handleHistory,

      // ⚙️ 설정
      settings: this.showSettings,

      // 📈 통계
      stats: this.showStats,

      // ❓ 도움말
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

  // ===== 🎯 핵심 액션 메서드들 =====

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
   * 🏖️ 연차 사용 처리 (통합된 단일 액션!)
   *
   * 콜백 예시:
   * - leave:use → 사용 타입 선택 메뉴
   * - leave:use:full → 연차 1일 사용
   * - leave:use:half → 반차 사용
   * - leave:use:quarter → 반반차 사용
   * - leave:use:custom → 커스텀 일수 입력
   */
  async handleUseLeave(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏖️ 연차 사용 처리 시작`, {
      userId,
      userName,
      params,
      action: "use",
    });

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

      // 파라미터가 없으면 선택 메뉴 표시
      if (!params || params.trim() === "") {
        return {
          type: "use_select",
          module: "leave",
          data: {
            status,
            leaveTypes: this.config.leaveTypes,
          },
        };
      }

      // 파라미터에 따른 연차 사용 처리
      return await this.processLeaveByType(callbackQuery, params.trim());
    } catch (error) {
      logger.error("연차 사용 처리 실패:", error);
      return {
        type: "error",
        message: "연차 사용을 처리할 수 없습니다.",
      };
    }
  }

  /**
   * 📋 연차 이력 처리 (통합된 단일 액션!)
   *
   * 콜백 예시:
   * - leave:history → 전체 이력
   * - leave:history:month → 월별 이력
   * - leave:history:year → 연도별 이력
   */
  async handleHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const currentYear = new Date().getFullYear();
      let historyData;

      // 파라미터에 따른 이력 조회
      switch (params) {
        case "month":
          const currentMonth = new Date().getMonth() + 1;
          historyData = await this.leaveService.getMonthlyHistory(
            userId,
            currentYear,
            currentMonth
          );
          break;

        case "year":
          historyData = await this.leaveService.getYearlyHistory(
            userId,
            currentYear
          );
          break;

        default:
          // 기본: 최근 이력
          historyData = await this.leaveService.getRecentHistory(
            userId,
            this.config.maxHistoryItems
          );
      }

      return {
        type: "history",
        module: "leave",
        data: {
          history: historyData,
          filterType: params || "recent",
          year: currentYear,
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
   * 📈 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
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
        message: "연차 통계를 불러올 수 없습니다.",
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

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 🎯 타입별 연차 사용 처리 (핵심 로직!)
   */
  async processLeaveByType(callbackQuery, leaveType) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🎯 타입별 연차 사용 처리`, {
      userId,
      userName,
      leaveType,
    });

    // 연차 타입 검증
    const typeConfig = this.config.leaveTypes[leaveType];
    if (!typeConfig) {
      logger.warn(`❌ 알 수 없는 연차 타입: ${leaveType}`);
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
          },
        };
      } else {
        logger.warn(`❌ 연차 사용 실패`, {
          userId,
          reason: result.reason,
        });

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
   * 📝 사용자 입력 처리 (커스텀 연차 등)
   */
  async handleUserInput(bot, msg, text, userState) {
    const { action } = userState;
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    switch (action) {
      case "custom_leave":
        return await this.handleCustomLeaveInput(bot, msg, text, userState);

      default:
        logger.warn(`알 수 없는 입력 액션: ${action}`);
        this.clearUserState(userId);
        return false;
    }
  }

  /**
   * 🎯 커스텀 연차 입력 처리
   */
  async handleCustomLeaveInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const days = parseFloat(text.trim());

    // 입력 검증
    if (isNaN(days) || days <= 0 || days > 5) {
      await bot.sendMessage(
        chatId,
        "❌ 올바른 연차 일수를 입력해주세요 (0.25 - 5.0일)"
      );
      return true;
    }

    // 0.25 단위 검증
    if ((days * 4) % 1 !== 0) {
      await bot.sendMessage(
        chatId,
        "❌ 연차는 0.25일 단위로만 사용 가능합니다 (예: 0.25, 0.5, 1.0, 1.5)"
      );
      return true;
    }

    try {
      // 커스텀 연차 사용 처리
      const schemaType =
        days >= 1.0 ? "연차" : days === 0.5 ? "반차" : "반반차";

      const result = await this.leaveService.useLeave(userId, {
        amount: days,
        type: schemaType,
        reason: `${days}일 연차 사용`,
        date: TimeHelper.now().toISOString(),
      });

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ ${days}일 연차가 성공적으로 사용되었습니다.\n잔여 연차: ${result.currentRemaining}일`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `❌ 연차 사용에 실패했습니다: ${result.reason}`
        );
      }
    } catch (error) {
      logger.error("커스텀 연차 사용 처리 실패:", error);
      await bot.sendMessage(chatId, "❌ 연차 사용 중 오류가 발생했습니다.");
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
  async cleanup() {
    try {
      await super.cleanup();
      logger.info("✅ LeaveModule 정리 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 정리 실패:", error);
    }
  }
}

module.exports = LeaveModule;
