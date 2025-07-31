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

    const lowerText = text.toLowerCase().trim();

    // 출근/퇴근 키워드 확인
    const checkinKeywords = ["출근", "checkin", "시작"];
    const checkoutKeywords = ["퇴근", "checkout", "끝", "종료"];
    const statusKeywords = ["근무", "worktime", "오늘", "시간"];

    if (this.isModuleMessage(lowerText, checkinKeywords)) {
      logger.info(`💼 출근 키워드 감지: "${text}"`);
      return {
        type: "render_request",
        module: "worktime",
        action: "checkin_direct",
        chatId: chatId,
        data: await this.processCheckIn(userId),
      };
    }

    if (this.isModuleMessage(lowerText, checkoutKeywords)) {
      logger.info(`🏠 퇴근 키워드 감지: "${text}"`);
      return {
        type: "render_request",
        module: "worktime",
        action: "checkout_direct",
        chatId: chatId,
        data: await this.processCheckOut(userId),
      };
    }

    if (this.isModuleMessage(lowerText, statusKeywords)) {
      logger.info(`📊 근무시간 상태 키워드 감지: "${text}"`);
      return {
        type: "render_request",
        module: "worktime",
        action: "status_direct",
        chatId: chatId,
        data: await this.getTodayStatus(userId),
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
      logger.error("근무시간 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 💼 출근 처리
   */
  async handleCheckIn(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const result = await this.processCheckIn(userId);

      return {
        type: "checkin",
        module: "worktime",
        data: result,
      };
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

    try {
      const result = await this.processCheckOut(userId);

      return {
        type: "checkout",
        module: "worktime",
        data: result,
      };
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      return {
        type: "error",
        message: "퇴근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📅 오늘 근무시간 조회
   */
  async showToday(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const todayStatus = await this.getTodayStatus(userId);

      return {
        type: "today",
        module: "worktime",
        data: todayStatus,
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
   * 📊 주간 근무시간 조회
   */
  async showWeek(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

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
      logger.error("주간 근무시간 조회 실패:", error);
      return {
        type: "error",
        message: "주간 근무시간을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📈 월간 근무시간 조회
   */
  async showMonth(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

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
      logger.error("월간 근무시간 조회 실패:", error);
      return {
        type: "error",
        message: "월간 근무시간을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 통계 조회
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.getComprehensiveStats(userId);

      return {
        type: "stats",
        module: "worktime",
        data: stats,
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📋 근무 이력 조회
   */
  async showHistory(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const days = parseInt(params[0]) || 7; // 기본 7일

    try {
      const history = await this.getWorkHistory(userId, days);

      return {
        type: "history",
        module: "worktime",
        data: history,
      };
    } catch (error) {
      logger.error("근무 이력 조회 실패:", error);
      return {
        type: "error",
        message: "근무 이력을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ⚙️ 설정 조회/변경
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
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
          tracking: "실시간 근무시간 추적",
          stats: "일/주/월 통계",
          overtime: "초과근무 계산",
          reminders: "퇴근 알림 (선택)",
        },
        commands: {
          text: ["출근", "퇴근", "근무시간", "오늘"],
          buttons: ["출근하기", "퇴근하기", "오늘 현황", "통계"],
        },
      },
    };
  }

  // ===== 🛠️ 핵심 비즈니스 로직 메서드들 =====

  /**
   * 💼 출근 처리 로직
   */
  async processCheckIn(userId) {
    const now = TimeHelper.now();
    const today = TimeHelper.format(now, "date");

    try {
      // 이미 출근했는지 확인
      const todayRecord = await this.worktimeService.getTodayRecord(userId);

      if (todayRecord && todayRecord.checkInTime) {
        return {
          success: false,
          alreadyCheckedIn: true,
          checkInTime: todayRecord.checkInTime,
          message: "이미 출근하셨습니다.",
        };
      }

      // 출근 처리
      const result = await this.worktimeService.checkIn(userId, now);

      if (result.success) {
        const recommendations = this.generateWorkRecommendations(result.record);

        return {
          success: true,
          checkInTime: now,
          record: result.record,
          recommendations,
          message: "출근 처리가 완료되었습니다.",
        };
      } else {
        throw new Error(result.error || "출근 처리 실패");
      }
    } catch (error) {
      logger.error(`출근 처리 실패 (userId: ${userId}):`, error);
      return {
        success: false,
        error: error.message,
        message: "출근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🏠 퇴근 처리 로직
   */
  async processCheckOut(userId) {
    const now = TimeHelper.now();

    try {
      // 출근 기록 확인
      const todayRecord = await this.worktimeService.getTodayRecord(userId);

      if (!todayRecord || !todayRecord.checkInTime) {
        return {
          success: false,
          notCheckedIn: true,
          message: "출근 기록이 없습니다.",
        };
      }

      if (todayRecord.checkOutTime) {
        return {
          success: false,
          alreadyCheckedOut: true,
          checkOutTime: todayRecord.checkOutTime,
          message: "이미 퇴근하셨습니다.",
        };
      }

      // 퇴근 처리
      const result = await this.worktimeService.checkOut(userId, now);

      if (result.success) {
        const workSummary = this.calculateWorkSummary(result.record);
        const recommendations = this.generateWorkRecommendations(result.record);

        return {
          success: true,
          checkOutTime: now,
          record: result.record,
          workSummary,
          recommendations,
          message: "퇴근 처리가 완료되었습니다.",
        };
      } else {
        throw new Error(result.error || "퇴근 처리 실패");
      }
    } catch (error) {
      logger.error(`퇴근 처리 실패 (userId: ${userId}):`, error);
      return {
        success: false,
        error: error.message,
        message: "퇴근 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📅 오늘 상태 조회
   */
  async getTodayStatus(userId) {
    const now = TimeHelper.now();

    try {
      const todayRecord = await this.worktimeService.getTodayRecord(userId);

      if (!todayRecord) {
        return {
          hasRecord: false,
          isWorking: false,
          message: "오늘 근무 기록이 없습니다.",
          recommendations: ["출근하기 버튼을 눌러 근무를 시작하세요."],
        };
      }

      const isWorking = todayRecord.checkInTime && !todayRecord.checkOutTime;
      const workSummary = this.calculateWorkSummary(todayRecord, now);
      const recommendations = this.generateWorkRecommendations(
        todayRecord,
        now
      );

      return {
        hasRecord: true,
        isWorking,
        record: todayRecord,
        workSummary,
        recommendations,
        timestamp: TimeHelper.format(now, "full"),
      };
    } catch (error) {
      logger.error(`오늘 상태 조회 실패 (userId: ${userId}):`, error);
      return {
        hasRecord: false,
        isWorking: false,
        error: error.message,
        message: "상태를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 주간 통계 조회
   */
  async getWeekStats(userId) {
    try {
      const weekData = await this.worktimeService.getWeekStats(userId);

      return {
        ...weekData,
        analysis: this.analyzeWeeklyWork(weekData),
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      };
    } catch (error) {
      logger.error(`주간 통계 조회 실패 (userId: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📈 월간 통계 조회
   */
  async getMonthStats(userId) {
    try {
      const monthData = await this.worktimeService.getMonthStats(userId);

      return {
        ...monthData,
        analysis: this.analyzeMonthlyWork(monthData),
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      };
    } catch (error) {
      logger.error(`월간 통계 조회 실패 (userId: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📊 종합 통계 조회
   */
  async getComprehensiveStats(userId) {
    try {
      const [todayStatus, weekStats, monthStats] = await Promise.all([
        this.getTodayStatus(userId),
        this.getWeekStats(userId),
        this.getMonthStats(userId),
      ]);

      return {
        today: todayStatus,
        week: weekStats,
        month: monthStats,
        trends: this.analyzeTrends(weekStats, monthStats),
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      };
    } catch (error) {
      logger.error(`종합 통계 조회 실패 (userId: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📋 근무 이력 조회
   */
  async getWorkHistory(userId, days = 7) {
    try {
      const history = await this.worktimeService.getWorkHistory(userId, days);

      return {
        days,
        records: history,
        summary: this.summarizeHistory(history),
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      };
    } catch (error) {
      logger.error(`근무 이력 조회 실패 (userId: ${userId}):`, error);
      throw error;
    }
  }

  // ===== 🧮 계산 및 분석 헬퍼 메서드들 =====

  /**
   * 📊 근무 요약 계산
   */
  calculateWorkSummary(record, currentTime = null) {
    if (!record.checkInTime) {
      return { workDuration: 0, displayTime: "00:00", status: "미출근" };
    }

    const endTime = record.checkOutTime || currentTime || TimeHelper.now();
    const workDuration = TimeHelper.diffMinutes(record.checkInTime, endTime);

    return {
      workDuration,
      displayTime: this.formatDuration(workDuration),
      status: record.checkOutTime ? "퇴근완료" : "근무중",
      isOvertime: workDuration > this.config.overtimeThreshold,
      overtimeMinutes: Math.max(
        0,
        workDuration - this.config.overtimeThreshold
      ),
    };
  }

  /**
   * 💡 근무 추천사항 생성
   */
  generateWorkRecommendations(record, currentTime = null) {
    const recommendations = [];

    if (!record.checkInTime) {
      recommendations.push("출근하기 버튼을 눌러 근무를 시작하세요.");
      return recommendations;
    }

    if (!record.checkOutTime) {
      // 현재 근무 중
      const currentDuration = TimeHelper.diffMinutes(
        record.checkInTime,
        currentTime || TimeHelper.now()
      );

      if (currentDuration > 120) {
        // 2시간
        recommendations.push("정기적으로 휴식을 취하세요.");
      } else if (currentDuration > 240) {
        // 4시간
        recommendations.push("점심시간을 잊지 마세요!");
      }
    } else {
      const { workDuration } = this.calculateWorkSummary(record);

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
   * 📊 주간 분석
   */
  analyzeWeeklyWork(weekData) {
    const analysis = {
      avgDailyHours: weekData.totalHours / 7,
      workDays: weekData.workDays,
      productivity: "보통", // 간단한 분석
    };

    if (analysis.avgDailyHours > 8) {
      analysis.productivity = "높음";
    } else if (analysis.avgDailyHours < 6) {
      analysis.productivity = "낮음";
    }

    return analysis;
  }

  /**
   * 📈 월간 분석
   */
  analyzeMonthlyWork(monthData) {
    return {
      avgWeeklyHours: monthData.totalHours / 4,
      workDays: monthData.workDays,
      trend: "안정", // 간단한 분석
    };
  }

  /**
   * 📊 트렌드 분석
   */
  analyzeTrends(weekStats, monthStats) {
    return {
      weeklyTrend: weekStats.totalHours > 40 ? "증가" : "감소",
      monthlyTrend: monthStats.totalHours > 160 ? "증가" : "감소",
      recommendation: "꾸준한 근무 패턴을 유지하세요.",
    };
  }

  /**
   * 📋 이력 요약
   */
  summarizeHistory(records) {
    const totalDays = records.length;
    const workDays = records.filter(
      (r) => r.checkInTime && r.checkOutTime
    ).length;
    const totalHours = records.reduce((sum, record) => {
      if (record.checkInTime && record.checkOutTime) {
        const duration = TimeHelper.diffMinutes(
          record.checkInTime,
          record.checkOutTime
        );
        return sum + duration / 60;
      }
      return sum;
    }, 0);

    return {
      totalDays,
      workDays,
      totalHours: Math.round(totalHours * 10) / 10,
      avgHours:
        workDays > 0 ? Math.round((totalHours / workDays) * 10) / 10 : 0,
    };
  }

  /**
   * ⏱️ 시간 포맷팅
   */
  formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
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
