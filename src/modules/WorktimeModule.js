// src/modules/WorktimeModule.js - 🏢 근무시간 관리 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏢 WorktimeModule - 근무시간 관리 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: worktime:action:params
 * ✅ 렌더링은 Renderer가 담당
 */
class WorktimeModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.worktimeService = null;

    // 모듈 설정
    this.config = {
      workStartTime: process.env.WORK_START_TIME || "09:00",
      workEndTime: process.env.WORK_END_TIME || "18:00",
      lunchStartTime: process.env.LUNCH_START_TIME || "12:00",
      lunchEndTime: process.env.LUNCH_END_TIME || "13:00",
      overtimeThreshold: parseInt(process.env.OVERTIME_THRESHOLD) || 480, // 8시간(분)

      // 알림 설정
      enableReminders: true,
      checkoutReminder: "18:00",

      // 통계 설정
      enableWeeklyStats: true,
      enableMonthlyStats: true,

      ...options.config,
    };

    logger.info(`🏢 WorktimeModule 생성 완료 (v4.1)`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      if (this.serviceBuilder) {
        this.worktimeService = await this.serviceBuilder.getOrCreate(
          "worktime",
          {
            config: this.config,
          }
        );
      }

      if (!this.worktimeService) {
        throw new Error("WorktimeService 생성 실패");
      }

      logger.success("✅ WorktimeModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WorktimeModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,

      // 출퇴근 관리
      checkin: this.handleCheckIn,
      checkout: this.handleCheckOut,

      // 조회 기능
      today: this.showToday,
      week: this.showWeek,
      month: this.showMonth,

      // 통계 및 설정
      stats: this.showStats,
      history: this.showHistory,
      settings: this.showSettings,
      help: this.showHelp,
    });

    logger.info(`✅ WorktimeModule 액션 등록 완료 (${this.actionMap.size}개)`);
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
    const keywords = [
      "출근",
      "퇴근",
      "근무",
      "근무시간",
      "work",
      "worktime",
      "체크인",
      "체크아웃",
      "checkin",
      "checkout",
      "집에가고싶어",
      "포로",
      "야근",
    ];

    if (this.isModuleMessage(text, keywords)) {
      return {
        type: "render_request",
        module: "worktime",
        action: "menu",
        chatId: chatId,
        data: await this.getMenuData(userId),
      };
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
        module: "worktime",
        data: {
          ...menuData,
          userName,
        },
      };
    } catch (error) {
      logger.error("근무시간 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🏢 출근 처리
   */
  async handleCheckIn(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏢 출근 처리 시작`, { userId, userName });

    try {
      // 이미 출근했는지 확인
      const todayStatus = await this.worktimeService.getTodayStatus(userId);

      if (todayStatus.isCheckedIn) {
        return {
          type: "already_checked_in",
          module: "worktime",
          data: {
            checkInTime: todayStatus.checkInTime,
            currentDuration: this.calculateCurrentDuration(
              todayStatus.checkInTime
            ),
          },
        };
      }

      // 출근 처리
      const result = await this.worktimeService.checkIn(userId);

      if (result.success) {
        logger.info(`✅ 출근 성공`, {
          userId,
          userName,
          checkInTime: result.checkInTime,
        });

        return {
          type: "checkin_success",
          module: "worktime",
          data: {
            checkInTime: result.checkInTime,
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
            message: result.message,
            isEarly: this.isEarlyCheckIn(result.checkInTime),
            isLate: this.isLateCheckIn(result.checkInTime),
          },
        };
      } else {
        return {
          type: "error",
          message: result.message || "출근 처리에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      return {
        type: "error",
        message: "출근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🏠 퇴근 처리
   */
  async handleCheckOut(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏠 퇴근 처리 시작`, { userId, userName });

    try {
      // 출근 기록이 있는지 확인
      const todayStatus = await this.worktimeService.getTodayStatus(userId);

      if (!todayStatus.isCheckedIn) {
        return {
          type: "not_checked_in",
          module: "worktime",
          data: {},
        };
      }

      if (todayStatus.isCheckedOut) {
        return {
          type: "already_checked_out",
          module: "worktime",
          data: {
            checkOutTime: todayStatus.checkOutTime,
            workDuration: todayStatus.workDuration,
          },
        };
      }

      // 퇴근 처리
      const result = await this.worktimeService.checkOut(userId);

      if (result.success) {
        logger.info(`✅ 퇴근 성공`, {
          userId,
          userName,
          checkOutTime: result.checkOutTime,
          duration: result.workDuration,
        });

        return {
          type: "checkout_success",
          module: "worktime",
          data: {
            checkOutTime: result.checkOutTime,
            workDuration: result.workDuration,
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
            message: result.message,
            isOvertime: this.isOvertime(result.workDuration),
            workSummary: this.generateWorkSummary(
              todayStatus.checkInTime,
              result.workDuration
            ),
          },
        };
      } else {
        return {
          type: "error",
          message: result.message || "퇴근 처리에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      return {
        type: "error",
        message: "퇴근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 오늘 근무 현황
   */
  async showToday(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const todayWorktime = await this.worktimeService.getTodayWorktime(userId);

      return {
        type: "today",
        module: "worktime",
        data: {
          userName,
          today: todayWorktime,
          date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
          dayOfWeek: TimeHelper.format(new Date(), "dddd"),
          recommendations: this.getWorkRecommendations(todayWorktime),
        },
      };
    } catch (error) {
      logger.error("오늘 근무시간 조회 실패:", error);
      return {
        type: "error",
        message: "오늘 근무시간을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📅 주간 근무 현황
   */
  async showWeek(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const weeklyData = await this.worktimeService.getWeeklyStats(userId);

      return {
        type: "week",
        module: "worktime",
        data: {
          weekly: weeklyData,
          weekStart: weeklyData.weekStart,
          weekEnd: weeklyData.weekEnd,
        },
      };
    } catch (error) {
      logger.error("주간 근무시간 조회 실패:", error);
      return {
        type: "error",
        message: "주간 근무시간을 불러올 수 없습니다.",
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
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const stats = await this.worktimeService.getMonthlyStats(
        userId,
        currentYear,
        currentMonth
      );

      return {
        type: "stats",
        module: "worktime",
        data: {
          stats,
          month: currentMonth,
          year: currentYear,
        },
      };
    } catch (error) {
      logger.error("근무시간 통계 조회 실패:", error);
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
      module: "worktime",
      data: {
        config: this.config,
        features: {
          checkin: "출근 시간 기록",
          checkout: "퇴근 시간 기록",
          today: "오늘 근무시간 확인",
          week: "주간 근무 현황",
          stats: "월간 통계 확인",
        },
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 🏠 메뉴 데이터 조회
   */
  async getMenuData(userId) {
    const todayStatus = await this.worktimeService.getTodayStatus(userId);
    const todayWorktime = await this.worktimeService.getTodayWorktime(userId);

    return {
      status: todayStatus,
      worktime: todayWorktime,
      config: this.config,
      currentTime: TimeHelper.format(TimeHelper.now(), "HH:mm"),
    };
  }

  /**
   * ⏰ 현재 근무 시간 계산
   */
  calculateCurrentDuration(checkInTime) {
    if (!checkInTime) return 0;

    const now = TimeHelper.now();
    return Math.round((now - new Date(checkInTime)) / (1000 * 60)); // 분 단위
  }

  /**
   * 🌅 이른 출근 확인
   */
  isEarlyCheckIn(checkInTime) {
    const checkIn = TimeHelper.format(checkInTime, "HH:mm");
    return checkIn < this.config.workStartTime;
  }

  /**
   * 🐌 지각 확인
   */
  isLateCheckIn(checkInTime) {
    const checkIn = TimeHelper.format(checkInTime, "HH:mm");
    return checkIn > this.config.workStartTime;
  }

  /**
   * 🌙 야근 확인
   */
  isOvertime(workDuration) {
    return workDuration > this.config.overtimeThreshold;
  }

  /**
   * 📝 근무 요약 생성
   */
  generateWorkSummary(checkInTime, workDuration) {
    const hours = Math.floor(workDuration / 60);
    const minutes = workDuration % 60;

    const isEarly = this.isEarlyCheckIn(checkInTime);
    const isOvertime = this.isOvertime(workDuration);

    let summary = `총 ${hours}시간 ${minutes}분 근무`;

    if (isEarly) summary += " (이른 출근)";
    if (isOvertime) summary += " (야근)";

    return summary;
  }

  /**
   * 💡 근무 권장사항 생성
   */
  getWorkRecommendations(todayWorktime) {
    const recommendations = [];

    if (!todayWorktime.isCheckedIn) {
      recommendations.push("출근 기록을 해주세요.");
    } else if (!todayWorktime.isCheckedOut) {
      const currentDuration = this.calculateCurrentDuration(
        todayWorktime.checkInTime
      );

      if (currentDuration > this.config.overtimeThreshold) {
        recommendations.push("장시간 근무 중입니다. 휴식을 취하세요.");
      } else if (currentDuration > 240) {
        // 4시간
        recommendations.push("점심시간을 잊지 마세요!");
      }
    } else {
      const { workDuration } = todayWorktime;

      if (workDuration < 240) {
        // 4시간 미만
        recommendations.push("짧은 근무시간이네요.");
      } else if (workDuration > this.config.overtimeThreshold) {
        recommendations.push("오늘 고생 많으셨습니다!");
      } else {
        recommendations.push("적절한 근무시간입니다.");
      }
    }

    return recommendations;
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
      serviceConnected: !!this.worktimeService,
      config: {
        workStartTime: this.config.workStartTime,
        workEndTime: this.config.workEndTime,
        overtimeThreshold: this.config.overtimeThreshold,
        enableReminders: this.config.enableReminders,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async onCleanup() {
    try {
      if (this.worktimeService && this.worktimeService.cleanup) {
        await this.worktimeService.cleanup();
      }
      logger.info("✅ WorktimeModule 정리 완료");
    } catch (error) {
      logger.error("❌ WorktimeModule 정리 실패:", error);
    }
  }
}

module.exports = WorktimeModule;
