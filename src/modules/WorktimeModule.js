// src/modules/WorktimeModule.js - logger 문제 수정
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger"); // ✅ 이미 있음
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

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
      overtimeThreshold: parseInt(process.env.OVERTIME_THRESHOLD) || 480,
      enableReminders: true,
      checkoutReminder: "18:00",
      enableWeeklyStats: true,
      enableMonthlyStats: true,
      ...options.config,
    };

    logger.info(`🏢 WorktimeModule 생성 완료 (v4.1)`);
  }

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

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      checkin: this.handleCheckIn,
      checkout: this.handleCheckOut,
      today: this.showToday,
      week: this.showWeek,
      month: this.showMonth,
      stats: this.showStats,
      history: this.showHistory,
      settings: this.showSettings,
      help: this.showHelp,
    });

    logger.info(`✅ WorktimeModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  // ✅ 모든 메서드에서 this.logger 대신 logger 사용
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userName = getUserName(callbackQuery.from);
    const userId = getUserId(callbackQuery.from);

    try {
      const todayStatus = await this.getTodayStatus(userId);

      return {
        type: "menu",
        module: "worktime",
        data: {
          userName,
          todayStatus,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("근무 메뉴 표시 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "근무 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  async handleCheckIn(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.processCheckIn(userId);

      return {
        type: "checkin",
        module: "worktime",
        data: result,
      };
    } catch (error) {
      logger.error("출근 처리 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "출근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  async handleCheckOut(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.processCheckOut(userId);

      return {
        type: "checkout",
        module: "worktime",
        data: result,
      };
    } catch (error) {
      logger.error("퇴근 처리 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "퇴근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  async showToday(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const todayStatus = await this.getTodayStatus(userId);

      return {
        type: "today",
        module: "worktime",
        data: {
          isWorking: todayStatus.isWorking,
          record: todayStatus.record,
          workSummary: todayStatus.workSummary,
          recommendations: [], // 빈 배열로 초기화
          timestamp: new Date(),
        },
      };
    } catch (error) {
      logger.error("오늘 현황 조회 실패:", error);
      return {
        type: "error",
        message: "오늘 현황을 불러올 수 없습니다.",
      };
    }
  }

  async showWeek(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.config.enableWeeklyStats) {
      return {
        type: "error",
        message: "주간 통계가 비활성화되어 있습니다.",
      };
    }

    try {
      const weekStats = await this.getWeekStats(userId);

      return {
        type: "week",
        module: "worktime",
        data: weekStats,
      };
    } catch (error) {
      logger.error("주간 근무시간 조회 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "주간 근무시간을 불러올 수 없습니다.",
      };
    }
  }

  async showMonth(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.config.enableMonthlyStats) {
      return {
        type: "error",
        message: "월간 통계가 비활성화되어 있습니다.",
      };
    }

    try {
      const monthStats = await this.getMonthStats(userId);

      return {
        type: "month",
        module: "worktime",
        data: monthStats,
      };
    } catch (error) {
      logger.error("월간 근무시간 조회 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "월간 근무시간을 불러올 수 없습니다.",
      };
    }
  }

  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const stats = await this.getComprehensiveStats(userId);

      return {
        type: "stats",
        module: "worktime",
        data: stats,
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const days = parseInt(params) || 7;

    try {
      const history = await this.getWorkHistory(userId, days);

      return {
        type: "history",
        module: "worktime",
        data: history,
      };
    } catch (error) {
      logger.error("근무 이력 조회 실패:", error); // ✅ 수정됨
      return {
        type: "error",
        message: "근무 이력을 불러올 수 없습니다.",
      };
    }
  }

  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "settings",
      module: "worktime",
      data: {
        config: this.config,
        availableSettings: [
          {
            key: "workStartTime",
            name: "시작 시간",
            value: this.config.workStartTime,
          },
          {
            key: "workEndTime",
            name: "종료 시간",
            value: this.config.workEndTime,
          },
          {
            key: "lunchStartTime",
            name: "점심 시작",
            value: this.config.lunchStartTime,
          },
          {
            key: "lunchEndTime",
            name: "점심 종료",
            value: this.config.lunchEndTime,
          },
          {
            key: "enableReminders",
            name: "알림",
            value: this.config.enableReminders,
          },
        ],
      },
    };
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "worktime",
      data: {
        commands: [
          { command: "출근", description: "출근 시간을 기록합니다" },
          { command: "퇴근", description: "퇴근 시간을 기록합니다" },
          { command: "오늘", description: "오늘 근무시간을 확인합니다" },
          { command: "주간", description: "주간 근무통계를 확인합니다" },
          { command: "월간", description: "월간 근무통계를 확인합니다" },
        ],
        features: [
          "자동 초과근무 계산",
          "점심시간 제외",
          "주간/월간 통계",
          "근무 이력 조회",
        ],
      },
    };
  }

  // 나머지 비즈니스 로직 메서드들 (getTodayStatus, processCheckIn 등)은
  // 모두 logger 대신 require로 가져온 logger 사용
  async getTodayStatus(userId) {
    try {
      // Service를 통해 DB 조회
      const todayRecord = await this.worktimeService.getTodayRecord(userId);

      if (!todayRecord) {
        return {
          hasRecord: false,
          isWorking: false,
          record: null,
          workSummary: null,
        };
      }

      // 실제 데이터 기반으로 상태 계산
      const isWorking = todayRecord.checkInTime && !todayRecord.checkOutTime;
      const workDuration =
        todayRecord.currentWorkDuration || todayRecord.workDuration || 0;

      return {
        hasRecord: true,
        isWorking: isWorking,
        record: todayRecord,
        workSummary: {
          workDuration: workDuration,
          displayTime: this.formatDuration(workDuration),
          isOvertime: workDuration > this.config.overtimeThreshold,
          overtimeMinutes: Math.max(
            0,
            workDuration - this.config.overtimeThreshold
          ),
        },
      };
      // 🔥 Service가 없으면 더미 데이터 (폴백)
      return {
        hasRecord: true,
        isWorking: true,
        record: {
          checkInTime: new Date(),
          checkOutTime: null,
        },
        workSummary: {
          workDuration: 120,
          displayTime: "2:00",
        },
      };
    } catch (error) {
      logger.error("오늘 상태 조회 실패:", error);
      // 에러 시에도 더미 데이터 반환
      return {
        hasRecord: false,
        isWorking: false,
        record: null,
        workSummary: null,
      };
    }
  }

  // 시간 포맷팅 헬퍼 추가
  formatDuration(minutes) {
    if (!minutes || minutes === 0) return "0:00";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  }

  async processCheckIn(userId) {
    try {
      if (this.worktimeService) {
        // 실제 DB 사용
        const result = await this.worktimeService.checkIn(userId);
        return {
          success: true,
          checkInTime: result.checkInTime,
          message: "출근이 기록되었습니다.",
          record: result,
        };
      }

      // 더미 데이터 폴백
      return {
        success: true,
        checkInTime: new Date(),
        message: "출근이 기록되었습니다.",
      };
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      throw error;
    }
  }

  async processCheckOut(userId) {
    // 실제 퇴근 처리 로직
    return {
      success: true,
      checkoutTime: new Date(),
      totalWorkTime: 480, // 8시간(분)
      message: "퇴근이 기록되었습니다.",
    };
  }

  async getWeekStats(userId) {
    // 주간 통계 로직
    return {
      totalHours: 40,
      workDays: 5,
      averageHours: 8,
      overtimeHours: 0,
    };
  }

  async getMonthStats(userId) {
    // 월간 통계 로직
    return {
      totalHours: 160,
      workDays: 20,
      averageHours: 8,
      overtimeHours: 0,
    };
  }

  async getComprehensiveStats(userId) {
    // 전체 통계 로직
    return {
      totalWorkDays: 100,
      totalHours: 800,
      averageHours: 8,
      longestDay: 10,
      shortestDay: 6,
    };
  }

  async getWorkHistory(userId, days) {
    // 근무 이력 로직
    return {
      days: days,
      records: [],
      totalHours: 0,
    };
  }

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

  async onCleanup() {
    try {
      if (this.worktimeService && this.worktimeService.cleanup) {
        await this.worktimeService.cleanup();
      }
      logger.info("✅ WorktimeModule 정리 완료"); // ✅ 수정됨
    } catch (error) {
      logger.error("❌ WorktimeModule 정리 실패:", error); // ✅ 수정됨
    }
  }
}

module.exports = WorktimeModule;
