// ===== 🏢 Enhanced WorktimeModule v3.0.1 - 화려한 근무시간 관리 =====
// src/modules/WorktimeModule.js
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const enhancedResponses = require("../utils/EnhancedBotResponses");

/**
 * 🏢 Enhanced WorktimeModule v3.0.1 - 화려한 근무시간 관리 시스템
 *
 * 🎨 Enhanced 특징:
 * - 실시간 근무시간 추적
 * - 시각적 대시보드
 * - 자동 초과근무 감지
 * - 휴식시간 관리
 * - Enhanced Logger 완벽 연동
 *
 * 🎯 표준 플로우 준수:
 * - ServiceBuilder 의존성 주입
 * - 표준 매개변수 체계
 * - actionMap 방식
 * - NavigationHandler UI 위임
 */
class WorktimeModule extends BaseModule {
  constructor(moduleKey, options = {}) {
    super("WorktimeModule", options);

    // 🎨 Enhanced Logger - 화려한 모듈 시작
    logger.moduleStart("WorktimeModule", "3.0.1");
    console.log("🏢".repeat(20));

    // 🔧 ServiceBuilder를 통한 서비스 의존성 주입
    this.worktimeService = null;

    // 📊 Railway 환경변수 기반 설정
    this.config = {
      // 기본 근무 시간 설정
      standardWorkHours: parseFloat(process.env.STANDARD_WORK_HOURS) || 8.0,
      standardStartTime: process.env.STANDARD_START_TIME || "09:00",
      standardEndTime: process.env.STANDARD_END_TIME || "18:00",
      lunchBreakDuration: parseInt(process.env.LUNCH_BREAK_MINUTES) || 60,

      // 유연 근무 설정
      flexibleWorking: process.env.FLEXIBLE_WORKING === "true",
      coreTimeStart: process.env.CORE_TIME_START || "10:00",
      coreTimeEnd: process.env.CORE_TIME_END || "16:00",

      // 알림 설정
      enableNotifications: process.env.WORKTIME_NOTIFICATIONS !== "false",
      notifyBeforeEndTime:
        parseInt(process.env.NOTIFY_BEFORE_END_MINUTES) || 30,
      notifyOvertimeAfter:
        parseInt(process.env.NOTIFY_OVERTIME_AFTER_MINUTES) || 60,

      // 휴무 설정
      weekends: [0, 6], // 일요일, 토요일
      holidays: process.env.HOLIDAYS ? process.env.HOLIDAYS.split(",") : [],

      ...this.config,
    };

    // 🏢 근무 상태 정의
    this.workStates = {
      NOT_WORKING: {
        id: "not_working",
        name: "미출근",
        emoji: "🏠",
        color: "gray",
      },
      WORKING: { id: "working", name: "근무중", emoji: "💼", color: "green" },
      BREAK: { id: "break", name: "휴식중", emoji: "☕", color: "yellow" },
      OVERTIME: { id: "overtime", name: "초과근무", emoji: "🔥", color: "red" },
      OFF_DUTY: {
        id: "off_duty",
        name: "퇴근완료",
        emoji: "🏠",
        color: "blue",
      },
    };

    // 📊 근무 유형 정의
    this.workTypes = {
      regular: { name: "정규근무", emoji: "🏢", description: "일반 출퇴근" },
      remote: { name: "재택근무", emoji: "🏠", description: "집에서 근무" },
      hybrid: { name: "하이브리드", emoji: "🔄", description: "사무실+재택" },
      business_trip: { name: "출장", emoji: "✈️", description: "업무 출장" },
      conference: {
        name: "컨퍼런스",
        emoji: "🎤",
        description: "회의/행사 참석",
      },
    };

    // 🎯 실시간 근무 상태 관리
    this.activeWorkSessions = new Map(); // userId -> workSession
    this.breakSessions = new Map(); // userId -> breakData
    this.notificationTimers = new Map(); // userId -> timerId

    // 📈 성과 지표
    this.performanceMetrics = {
      punctuality: "출근 정시성",
      consistency: "근무 일관성",
      balance: "워라밸 지수",
      productivity: "생산성 점수",
    };

    logger.success("🏢 Enhanced WorktimeModule 생성됨", {
      standardHours: this.config.standardWorkHours,
      flexibleWorking: this.config.flexibleWorking,
      notificationsEnabled: this.config.enableNotifications,
    });
  }

  /**
   * 🎯 모듈 초기화 - ServiceBuilder 활용
   */
  async onInitialize() {
    try {
      logger.info("🎯 Enhanced WorktimeModule 초기화 시작...", {
        module: "WorktimeModule",
        version: "3.0.1",
      });

      // 🔧 ServiceBuilder로 WorktimeService 요청
      this.worktimeService = await this.requireService("worktime");

      if (!this.worktimeService) {
        throw new Error("WorktimeService 초기화 실패");
      }

      // 🔄 활성 근무 세션 복구
      await this.restoreActiveWorkSessions();

      // 🔔 알림 시스템 초기화
      if (this.config.enableNotifications) {
        this.initializeNotificationSystem();
      }

      logger.success("✅ WorktimeService 연결 완료", {
        service: "WorktimeService",
        hasService: !!this.worktimeService,
        activeSessionsCount: this.activeWorkSessions.size,
      });
    } catch (error) {
      logger.error("❌ Enhanced WorktimeModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 - Enhanced actionMap
   */
  setupActions() {
    logger.debug("🎯 WorktimeModule Enhanced 액션 등록 시작...");

    this.registerActions({
      // 메인 액션들
      menu: this.handleMenu.bind(this),
      help: this.handleHelp.bind(this),
      dashboard: this.handleDashboard.bind(this),

      // 출퇴근 관리
      checkin: this.handleCheckIn.bind(this),
      "checkin:confirm": this.handleCheckInConfirm.bind(this),
      checkout: this.handleCheckOut.bind(this),
      "checkout:confirm": this.handleCheckOutConfirm.bind(this),

      // 휴식 관리
      "break:start": this.handleBreakStart.bind(this),
      "break:end": this.handleBreakEnd.bind(this),
      "break:lunch": this.handleLunchBreak.bind(this),

      // 근무 유형 설정
      "type:set": this.handleSetWorkType.bind(this),
      "location:set": this.handleSetLocation.bind(this),

      // 조회 및 관리
      today: this.handleToday.bind(this),
      weekly: this.handleWeekly.bind(this),
      monthly: this.handleMonthly.bind(this),

      // 수정 및 조정
      adjust: this.handleAdjustTime.bind(this),
      "adjust:save": this.handleAdjustSave.bind(this),
      correct: this.handleCorrectTime.bind(this),

      // 설정 및 통계
      settings: this.handleSettings.bind(this),
      "settings:save": this.handleSettingsSave.bind(this),
      stats: this.handleStats.bind(this),
      performance: this.handlePerformance.bind(this),
    });

    logger.success(`✅ WorktimeModule Enhanced 액션 등록 완료`, {
      actionCount: this.actionMap.size,
      actions: Array.from(this.actionMap.keys()),
    });
  }

  // ===== 🎯 Enhanced 액션 핸들러들 (표준 매개변수 준수!) =====

  /**
   * 🏠 Enhanced 메뉴 핸들러
   * 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);

      logger.info("🏠 Enhanced Worktime 메뉴 요청", {
        module: "WorktimeModule",
        action: "menu",
        userId,
        userName,
      });

      // 📊 현재 근무 상태 수집
      const currentSession = this.activeWorkSessions.get(userId);
      const todayStats = await this.worktimeService.getTodayStats(userId);
      const currentWeekStats = await this.worktimeService.getCurrentWeekStats(
        userId
      );
      const currentBreak = this.breakSessions.get(userId);

      // 🎯 근무 상태 분석
      const workStatus = this.analyzeCurrentWorkStatus(
        currentSession,
        currentBreak,
        todayStats
      );
      const dailyProgress = this.calculateDailyProgress(todayStats);
      const weeklyProgress = this.calculateWeeklyProgress(currentWeekStats);

      logger.debug("📊 Worktime 메뉴 데이터 수집 완료", {
        hasActiveSession: !!currentSession,
        workStatus: workStatus.id,
        todayHours: todayStats.totalHours,
        weeklyHours: currentWeekStats.totalHours,
      });

      // 📱 Enhanced UI 데이터
      const menuData = {
        userName,
        currentTime: TimeHelper.getKoreanTime(),
        workStatus,
        currentSession: currentSession
          ? {
              ...currentSession,
              elapsedTime: this.calculateElapsedTime(currentSession),
              formattedStartTime: TimeHelper.format(
                currentSession.startTime,
                "HH:mm"
              ),
              workDuration: this.formatWorkDuration(
                this.calculateElapsedTime(currentSession)
              ),
            }
          : null,
        currentBreak: currentBreak
          ? {
              ...currentBreak,
              elapsedTime: this.calculateElapsedTime(currentBreak),
              formattedStartTime: TimeHelper.format(
                currentBreak.startTime,
                "HH:mm"
              ),
            }
          : null,
        todayStats: {
          ...todayStats,
          progress: dailyProgress,
          formattedHours: this.formatWorkDuration(todayStats.totalHours * 60),
          overtime: Math.max(
            0,
            todayStats.totalHours - this.config.standardWorkHours
          ),
          isOvertime: todayStats.totalHours > this.config.standardWorkHours,
        },
        weeklyStats: {
          ...currentWeekStats,
          progress: weeklyProgress,
          targetHours: this.config.standardWorkHours * 5, // 주 5일
          averageDaily:
            currentWeekStats.workDays > 0
              ? currentWeekStats.totalHours / currentWeekStats.workDays
              : 0,
        },
        quickActions: this.getQuickActions(
          workStatus,
          currentSession,
          currentBreak
        ),
        workTypes: this.workTypes,
      };

      // ✅ NavigationHandler에게 데이터 전달
      return {
        success: true,
        action: "show_worktime_menu",
        data: menuData,
        uiType: "enhanced_dashboard",
      };
    } catch (error) {
      logger.error("❌ Enhanced Worktime 메뉴 처리 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
        suggestion: "근무시간을 새로고침하거나 수동으로 출근 처리해보세요.",
      };
    }
  }

  /**
   * 🕐 Enhanced 출근 핸들러
   */
  async handleCheckIn(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const workType = params[0] || "regular";

      logger.info("🕐 Enhanced 출근 요청", {
        module: "WorktimeModule",
        action: "checkin",
        userId,
        userName,
        workType,
      });

      // 기존 활성 세션 체크
      const existingSession = this.activeWorkSessions.get(userId);
      if (existingSession && existingSession.status === "working") {
        return {
          success: false,
          error: "이미 출근 상태입니다",
          action: "show_error",
          suggestion: "현재 근무 중입니다. 퇴근 처리 후 다시 출근해주세요.",
          data: { existingSession },
        };
      }

      // 오늘 이미 출근했는지 체크
      const todaySession = await this.worktimeService.getTodaySession(userId);
      if (todaySession && todaySession.status !== "completed") {
        return {
          success: false,
          error: "오늘 이미 출근 기록이 있습니다",
          action: "show_error",
          suggestion: "기존 세션을 확인하거나 새로운 세션을 시작해주세요.",
        };
      }

      // 출근 처리
      const checkInTime = new Date();
      const workSession = await this.startWorkSession(userId, {
        type: workType,
        startTime: checkInTime,
        userName,
      });

      // 출근 시간 분석
      const punctualityAnalysis = this.analyzePunctuality(checkInTime);
      const todayPrediction = this.predictTodayWorkHours(checkInTime);

      logger.success("🎯 출근 처리 완료", {
        module: "WorktimeModule",
        sessionId: workSession.id,
        startTime: TimeHelper.format(checkInTime, "HH:mm"),
        workType,
        punctuality: punctualityAnalysis.status,
      });

      // ✅ 출근 성공 응답
      return {
        success: true,
        action: "show_checkin_success",
        data: {
          session: workSession,
          checkInTime: TimeHelper.format(checkInTime, "HH:mm"),
          punctualityAnalysis,
          todayPrediction,
          motivationalMessage: this.getCheckInMessage(punctualityAnalysis),
          workTypeInfo: this.workTypes[workType],
          estimatedEndTime: this.calculateEstimatedEndTime(checkInTime),
        },
        uiType: "enhanced_checkin_card",
      };
    } catch (error) {
      logger.error("❌ Enhanced 출근 처리 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 🏠 Enhanced 퇴근 핸들러
   */
  async handleCheckOut(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("🏠 Enhanced 퇴근 요청", {
        module: "WorktimeModule",
        action: "checkout",
        userId,
      });

      const activeSession = this.activeWorkSessions.get(userId);
      if (!activeSession) {
        return {
          success: false,
          error: "활성 근무 세션이 없습니다",
          action: "show_error",
          suggestion: "먼저 출근 처리를 해주세요.",
        };
      }

      // 현재 휴식 중이면 휴식 종료
      const currentBreak = this.breakSessions.get(userId);
      if (currentBreak) {
        await this.endBreak(userId);
      }

      // 퇴근 처리
      const checkOutTime = new Date();
      const completedSession = await this.endWorkSession(userId, checkOutTime);

      // 근무 분석
      const workAnalysis = this.analyzeWorkSession(completedSession);
      const performanceScore = await this.calculateDailyPerformance(
        userId,
        completedSession
      );

      logger.success("🎊 퇴근 처리 완료", {
        module: "WorktimeModule",
        sessionId: completedSession.id,
        totalHours: completedSession.totalHours,
        overtime: workAnalysis.overtimeHours,
        performance: performanceScore,
      });

      return {
        success: true,
        action: "show_checkout_success",
        data: {
          session: completedSession,
          workAnalysis,
          performanceScore,
          celebrationMessage: this.getCheckOutMessage(workAnalysis),
          weeklyProgress: await this.worktimeService.getCurrentWeekStats(
            userId
          ),
          achievements: await this.checkAchievements(userId, completedSession),
        },
        uiType: "enhanced_checkout_card",
      };
    } catch (error) {
      logger.error("❌ Enhanced 퇴근 처리 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * ☕ Enhanced 휴식 시작 핸들러
   */
  async handleBreakStart(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const breakType = params[0] || "short"; // short, lunch, long

      logger.info("☕ Enhanced 휴식 시작 요청", {
        module: "WorktimeModule",
        action: "break_start",
        userId,
        breakType,
      });

      const activeSession = this.activeWorkSessions.get(userId);
      if (!activeSession) {
        return {
          success: false,
          error: "활성 근무 세션이 없습니다",
          action: "show_error",
        };
      }

      const existingBreak = this.breakSessions.get(userId);
      if (existingBreak) {
        return {
          success: false,
          error: "이미 휴식 중입니다",
          action: "show_error",
        };
      }

      // 휴식 시작
      const breakData = await this.startBreak(userId, breakType);

      logger.success("☕ 휴식 시작", {
        module: "WorktimeModule",
        breakType,
        startTime: TimeHelper.format(breakData.startTime, "HH:mm"),
      });

      return {
        success: true,
        action: "show_break_started",
        data: {
          breakData,
          breakTypeInfo: this.getBreakTypeInfo(breakType),
          workingTime: this.calculateElapsedTime(activeSession),
          estimatedReturnTime: this.calculateEstimatedReturnTime(breakData),
          relaxationTips: this.getRelaxationTips(breakType),
        },
        uiType: "enhanced_break_card",
      };
    } catch (error) {
      logger.error("❌ Enhanced 휴식 시작 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 📊 Enhanced 대시보드 핸들러
   */
  async handleDashboard(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("📊 Enhanced Worktime 대시보드 요청", {
        module: "WorktimeModule",
        action: "dashboard",
        userId,
      });

      // 종합 데이터 수집
      const currentSession = this.activeWorkSessions.get(userId);
      const todayStats = await this.worktimeService.getTodayStats(userId);
      const weeklyStats = await this.worktimeService.getCurrentWeekStats(
        userId
      );
      const monthlyStats = await this.worktimeService.getCurrentMonthStats(
        userId
      );
      const recentSessions = await this.worktimeService.getRecentSessions(
        userId,
        5
      );

      // 성과 분석
      const performanceMetrics = await this.calculatePerformanceMetrics(userId);
      const trends = await this.analyzeWorkTrends(userId);
      const insights = this.generateWorkInsights(
        weeklyStats,
        monthlyStats,
        trends
      );

      logger.debug("📈 대시보드 데이터 수집 완료", {
        todayHours: todayStats.totalHours,
        weeklyHours: weeklyStats.totalHours,
        monthlyHours: monthlyStats.totalHours,
        performanceScore: performanceMetrics.overallScore,
      });

      return {
        success: true,
        action: "show_worktime_dashboard",
        data: {
          currentSession: currentSession
            ? {
                ...currentSession,
                elapsedTime: this.calculateElapsedTime(currentSession),
                realTimeData: true,
              }
            : null,
          stats: {
            today: todayStats,
            weekly: weeklyStats,
            monthly: monthlyStats,
          },
          recentSessions: recentSessions.map((session) => ({
            ...session,
            formattedDate: TimeHelper.format(session.date, "MM/DD"),
            formattedHours: this.formatWorkDuration(session.totalHours * 60),
            efficiency: this.calculateSessionEfficiency(session),
          })),
          performanceMetrics,
          trends,
          insights,
          charts: {
            weeklyHours: trends.weeklyHours,
            dailyPattern: trends.dailyPattern,
            overtimePattern: trends.overtimePattern,
          },
        },
        uiType: "enhanced_dashboard_full",
      };
    } catch (error) {
      logger.error("❌ Enhanced 대시보드 조회 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  // ===== 🛠️ Enhanced 근무시간 핵심 기능들 =====

  /**
   * 🎯 근무 세션 시작 (내부 로직)
   */
  async startWorkSession(userId, sessionData) {
    try {
      const startTime = sessionData.startTime || new Date();

      // 근무 세션 생성
      const workSession = {
        id: `work_${userId}_${Date.now()}`,
        userId,
        startTime,
        endTime: null,
        type: sessionData.type || "regular",
        status: "working",
        breaks: [],
        totalBreakTime: 0,
        location: sessionData.location || "office",
        notes: sessionData.notes || "",
        metadata: {
          userName: sessionData.userName,
          version: "3.0.1",
          enhanced: true,
        },
      };

      // 메모리에 저장
      this.activeWorkSessions.set(userId, workSession);

      // 데이터베이스에 저장
      await this.worktimeService.createWorkSession(userId, workSession);

      // 🔔 출근 알림
      if (this.config.enableNotifications) {
        await this.scheduleWorkNotifications(userId, workSession);
      }

      return workSession;
    } catch (error) {
      logger.error("❌ 근무 세션 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🏠 근무 세션 종료 (내부 로직)
   */
  async endWorkSession(userId, endTime) {
    try {
      const activeSession = this.activeWorkSessions.get(userId);
      if (!activeSession) {
        throw new Error("활성 근무 세션이 없습니다");
      }

      const finalEndTime = endTime || new Date();

      // 세션 완료 처리
      activeSession.endTime = finalEndTime;
      activeSession.status = "completed";

      // 근무시간 계산
      const totalWorkMinutes = Math.floor(
        (finalEndTime - activeSession.startTime) / (1000 * 60)
      );
      const totalWorkHours =
        (totalWorkMinutes - activeSession.totalBreakTime) / 60;

      activeSession.totalWorkMinutes = totalWorkMinutes;
      activeSession.totalHours = totalWorkHours;
      activeSession.completedAt = finalEndTime;

      // 데이터베이스 업데이트
      await this.worktimeService.completeWorkSession(userId, activeSession.id, {
        endTime: finalEndTime,
        totalHours: totalWorkHours,
        totalBreakTime: activeSession.totalBreakTime,
        status: "completed",
      });

      // 알림 타이머 정리
      const notificationTimer = this.notificationTimers.get(userId);
      if (notificationTimer) {
        clearTimeout(notificationTimer);
        this.notificationTimers.delete(userId);
      }

      // 메모리에서 제거
      this.activeWorkSessions.delete(userId);

      return activeSession;
    } catch (error) {
      logger.error("❌ 근무 세션 종료 실패:", error);
      throw error;
    }
  }

  /**
   * ☕ 휴식 시작 (내부 로직)
   */
  async startBreak(userId, breakType) {
    try {
      const startTime = new Date();

      const breakData = {
        id: `break_${userId}_${Date.now()}`,
        userId,
        type: breakType,
        startTime,
        endTime: null,
        status: "active",
        expectedDuration: this.getBreakDuration(breakType),
      };

      // 메모리에 저장
      this.breakSessions.set(userId, breakData);

      // 활성 세션에 휴식 기록 추가
      const activeSession = this.activeWorkSessions.get(userId);
      if (activeSession) {
        activeSession.breaks.push(breakData);
      }

      return breakData;
    } catch (error) {
      logger.error("❌ 휴식 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🔄 휴식 종료 (내부 로직)
   */
  async endBreak(userId) {
    try {
      const breakData = this.breakSessions.get(userId);
      if (!breakData) {
        throw new Error("활성 휴식이 없습니다");
      }

      const endTime = new Date();
      const breakDuration = Math.floor(
        (endTime - breakData.startTime) / (1000 * 60)
      );

      breakData.endTime = endTime;
      breakData.actualDuration = breakDuration;
      breakData.status = "completed";

      // 활성 세션에 휴식 시간 누적
      const activeSession = this.activeWorkSessions.get(userId);
      if (activeSession) {
        activeSession.totalBreakTime += breakDuration;
      }

      // 메모리에서 제거
      this.breakSessions.delete(userId);

      return breakData;
    } catch (error) {
      logger.error("❌ 휴식 종료 실패:", error);
      throw error;
    }
  }

  // ===== 🛠️ Enhanced 분석 및 계산 메서드들 =====

  /**
   * 🎯 현재 근무 상태 분석
   */
  analyzeCurrentWorkStatus(session, breakData, todayStats) {
    if (!session) {
      return this.workStates.NOT_WORKING;
    }

    if (breakData) {
      return this.workStates.BREAK;
    }

    // 초과근무 체크
    if (todayStats.totalHours > this.config.standardWorkHours) {
      return this.workStates.OVERTIME;
    }

    return this.workStates.WORKING;
  }

  /**
   * 📊 일일 진행률 계산
   */
  calculateDailyProgress(todayStats) {
    const progress =
      (todayStats.totalHours / this.config.standardWorkHours) * 100;
    return Math.min(Math.max(progress, 0), 150); // 최대 150%
  }

  /**
   * 📈 주간 진행률 계산
   */
  calculateWeeklyProgress(weeklyStats) {
    const targetWeeklyHours = this.config.standardWorkHours * 5; // 주 5일
    const progress = (weeklyStats.totalHours / targetWeeklyHours) * 100;
    return Math.min(Math.max(progress, 0), 150);
  }

  /**
   * ⏱️ 경과 시간 계산
   */
  calculateElapsedTime(sessionData) {
    if (!sessionData || !sessionData.startTime) {
      return 0;
    }

    const now = new Date();
    const elapsed = Math.floor((now - sessionData.startTime) / (1000 * 60));
    return Math.max(elapsed, 0);
  }

  /**
   * 🕐 예상 퇴근 시간 계산
   */
  calculateEstimatedEndTime(startTime) {
    const estimatedEnd = new Date(startTime);
    estimatedEnd.setHours(
      estimatedEnd.getHours() + this.config.standardWorkHours
    );
    estimatedEnd.setMinutes(
      estimatedEnd.getMinutes() + this.config.lunchBreakDuration
    );

    return TimeHelper.format(estimatedEnd, "HH:mm");
  }

  /**
   * 🎯 정시성 분석
   */
  analyzePunctuality(checkInTime) {
    const checkInHour = checkInTime.getHours();
    const checkInMinute = checkInTime.getMinutes();
    const standardTime = this.parseTime(this.config.standardStartTime);

    const checkInMinutes = checkInHour * 60 + checkInMinute;
    const standardMinutes = standardTime.hour * 60 + standardTime.minute;
    const diffMinutes = checkInMinutes - standardMinutes;

    let status, emoji, message;

    if (diffMinutes <= -30) {
      status = "very_early";
      emoji = "🌟";
      message = "매우 일찍 출근하셨네요! 훌륭합니다!";
    } else if (diffMinutes <= -10) {
      status = "early";
      emoji = "✨";
      message = "일찍 출근하셨네요! 좋은 습관입니다!";
    } else if (diffMinutes <= 10) {
      status = "on_time";
      emoji = "⏰";
      message = "정시 출근! 완벽합니다!";
    } else if (diffMinutes <= 30) {
      status = "slightly_late";
      emoji = "⚠️";
      message = "조금 늦었지만 괜찮아요!";
    } else {
      status = "late";
      emoji = "🚨";
      message = "늦었지만 오늘 열심히 해봐요!";
    }

    return {
      status,
      emoji,
      message,
      diffMinutes,
      isEarly: diffMinutes < 0,
      isLate: diffMinutes > 10,
    };
  }

  /**
   * 📊 근무 세션 분석
   */
  analyzeWorkSession(session) {
    const standardHours = this.config.standardWorkHours;
    const actualHours = session.totalHours;
    const overtimeHours = Math.max(0, actualHours - standardHours);
    const efficiency =
      actualHours > 0
        ? (actualHours / (actualHours + session.totalBreakTime / 60)) * 100
        : 0;

    return {
      actualHours,
      standardHours,
      overtimeHours,
      isOvertime: overtimeHours > 0,
      efficiency: Math.round(efficiency),
      totalBreakTime: session.totalBreakTime,
      breakEfficiency: this.analyzeBreakEfficiency(session.breaks),
      workIntensity: this.calculateWorkIntensity(session),
    };
  }

  /**
   * 🏆 성과 지표 계산
   */
  async calculatePerformanceMetrics(userId) {
    try {
      const weeklyStats = await this.worktimeService.getCurrentWeekStats(
        userId
      );
      const monthlyStats = await this.worktimeService.getCurrentMonthStats(
        userId
      );
      const recentSessions = await this.worktimeService.getRecentSessions(
        userId,
        10
      );

      // 정시성 점수
      const punctualityScore = this.calculatePunctualityScore(recentSessions);

      // 일관성 점수 (근무시간의 일정함)
      const consistencyScore = this.calculateConsistencyScore(recentSessions);

      // 워라밸 점수
      const balanceScore = this.calculateWorkLifeBalance(
        weeklyStats,
        monthlyStats
      );

      // 생산성 점수
      const productivityScore = this.calculateProductivityScore(recentSessions);

      // 전체 점수
      const overallScore = Math.round(
        (punctualityScore +
          consistencyScore +
          balanceScore +
          productivityScore) /
          4
      );

      return {
        overallScore,
        punctuality: {
          score: punctualityScore,
          grade: this.getGrade(punctualityScore),
        },
        consistency: {
          score: consistencyScore,
          grade: this.getGrade(consistencyScore),
        },
        balance: { score: balanceScore, grade: this.getGrade(balanceScore) },
        productivity: {
          score: productivityScore,
          grade: this.getGrade(productivityScore),
        },
        trend: this.calculateScoreTrend(recentSessions),
      };
    } catch (error) {
      logger.error("❌ 성과 지표 계산 실패:", error);
      return {
        overallScore: 0,
        punctuality: { score: 0, grade: "F" },
        consistency: { score: 0, grade: "F" },
        balance: { score: 0, grade: "F" },
        productivity: { score: 0, grade: "F" },
        trend: "stable",
      };
    }
  }

  /**
   * 💡 업무 인사이트 생성
   */
  generateWorkInsights(weeklyStats, monthlyStats, trends) {
    const insights = [];

    try {
      // 근무시간 패턴 분석
      if (weeklyStats.averageDaily > this.config.standardWorkHours + 1) {
        insights.push({
          type: "warning",
          emoji: "⚠️",
          title: "과로 주의",
          message:
            "주간 평균 근무시간이 표준보다 높습니다. 적절한 휴식을 취하세요.",
        });
      } else if (
        weeklyStats.averageDaily >=
        this.config.standardWorkHours - 0.5
      ) {
        insights.push({
          type: "positive",
          emoji: "🎯",
          title: "균형잡힌 근무",
          message: "적정 근무시간을 잘 유지하고 있습니다!",
        });
      }

      // 정시성 분석
      if (trends.punctualityTrend === "improving") {
        insights.push({
          type: "positive",
          emoji: "📈",
          title: "정시성 개선",
          message: "출근 시간이 점점 좋아지고 있어요!",
        });
      }

      // 생산성 패턴
      if (trends.mostProductiveTime) {
        insights.push({
          type: "info",
          emoji: "⚡",
          title: "최고 생산성 시간",
          message: `${trends.mostProductiveTime}에 가장 집중력이 높아요!`,
        });
      }

      // 휴식 패턴
      if (weeklyStats.averageBreakTime < 30) {
        insights.push({
          type: "suggestion",
          emoji: "☕",
          title: "휴식 부족",
          message: "충분한 휴식을 취하세요. 생산성 향상에 도움됩니다.",
        });
      }

      return insights;
    } catch (error) {
      logger.error("❌ 업무 인사이트 생성 실패:", error);
      return [];
    }
  }

  // ===== 🛠️ Enhanced 유틸리티 메서드들 =====

  /**
   * ⏰ 시간 파싱
   */
  parseTime(timeString) {
    const [hour, minute] = timeString.split(":").map(Number);
    return { hour, minute };
  }

  /**
   * 📏 근무시간 포맷팅
   */
  formatWorkDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}분`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours}시간`;
    }

    return `${hours}시간 ${mins}분`;
  }

  /**
   * ☕ 휴식 유형별 지속시간
   */
  getBreakDuration(breakType) {
    const durations = {
      short: 15, // 15분
      lunch: 60, // 1시간
      long: 30, // 30분
      coffee: 10, // 10분
    };

    return durations[breakType] || 15;
  }

  /**
   * ☕ 휴식 유형 정보
   */
  getBreakTypeInfo(breakType) {
    const types = {
      short: {
        name: "짧은 휴식",
        emoji: "☕",
        duration: 15,
        description: "간단한 휴식",
      },
      lunch: {
        name: "점심시간",
        emoji: "🍽️",
        duration: 60,
        description: "점심 식사",
      },
      long: {
        name: "긴 휴식",
        emoji: "🛌",
        duration: 30,
        description: "충분한 휴식",
      },
      coffee: {
        name: "커피 타임",
        emoji: "☕",
        duration: 10,
        description: "커피 한 잔",
      },
    };

    return types[breakType] || types.short;
  }

  /**
   * 💪 휴식 팁 제공
   */
  getRelaxationTips(breakType) {
    const tips = {
      short: [
        "🚶 잠깐 산책해보세요",
        "💧 물을 마시세요",
        "🧘 간단한 스트레칭을 해보세요",
      ],
      lunch: [
        "🍱 영양가 있는 식사를 하세요",
        "🌳 야외에서 식사해보세요",
        "🎵 좋아하는 음악을 들어보세요",
      ],
      long: [
        "😴 짧은 낮잠을 자보세요",
        "📚 책을 읽어보세요",
        "🎮 취미 활동을 해보세요",
      ],
      coffee: [
        "☕ 좋아하는 음료를 마시세요",
        "👥 동료와 대화해보세요",
        "🌅 창밖을 바라보세요",
      ],
    };

    return tips[breakType] || tips.short;
  }

  /**
   * 🎯 빠른 액션 목록 생성
   */
  getQuickActions(workStatus, currentSession, currentBreak) {
    const actions = [];

    if (workStatus.id === "not_working") {
      actions.push(
        { text: "🕐 출근", callback_data: "worktime:checkin" },
        { text: "🏠 재택근무", callback_data: "worktime:checkin:remote" }
      );
    } else if (workStatus.id === "working") {
      actions.push(
        { text: "☕ 휴식", callback_data: "worktime:break:start" },
        { text: "🍽️ 점심", callback_data: "worktime:break:lunch" },
        { text: "🏠 퇴근", callback_data: "worktime:checkout" }
      );
    } else if (workStatus.id === "break") {
      actions.push(
        { text: "🔄 복귀", callback_data: "worktime:break:end" },
        { text: "📊 현황", callback_data: "worktime:today" }
      );
    }

    return actions;
  }

  /**
   * 💬 출근 메시지 생성
   */
  getCheckInMessage(punctualityAnalysis) {
    const messages = {
      very_early: [
        "🌟 일찍 시작하는 하루! 멋집니다!",
        "✨ 성실함이 돋보이네요!",
        "🚀 오늘도 생산적인 하루 되세요!",
      ],
      early: ["👍 좋은 습관이에요!", "⭐ 여유로운 시작!", "💪 오늘도 화이팅!"],
      on_time: [
        "⏰ 완벽한 출근 시간!",
        "🎯 정시성 최고!",
        "👌 오늘도 좋은 하루!",
      ],
      slightly_late: [
        "😊 괜찮아요! 오늘 힘내세요!",
        "🌱 내일은 더 일찍!",
        "💝 늦어도 와주셔서 감사해요!",
      ],
      late: ["🔥 늦었지만 열심히!", "⚡ 지금부터 집중!", "🎈 화이팅!"],
    };

    const messageArray =
      messages[punctualityAnalysis.status] || messages.on_time;
    return messageArray[Math.floor(Math.random() * messageArray.length)];
  }

  /**
   * 🎊 퇴근 메시지 생성
   */
  getCheckOutMessage(workAnalysis) {
    if (workAnalysis.isOvertime) {
      return `🔥 ${this.formatWorkDuration(
        workAnalysis.overtimeHours * 60
      )} 초과근무! 정말 수고하셨습니다!`;
    } else if (
      workAnalysis.actualHours >=
      this.config.standardWorkHours - 0.5
    ) {
      return "🎯 완벽한 근무! 오늘도 수고하셨어요!";
    } else {
      return "😊 오늘 하루도 수고하셨습니다!";
    }
  }

  /**
   * 🏆 업적 체크
   */
  async checkAchievements(userId, session) {
    try {
      const achievements = [];

      // 연속 정시 출근
      const recentSessions = await this.worktimeService.getRecentSessions(
        userId,
        5
      );
      const consecutivePunctual =
        this.checkConsecutivePunctuality(recentSessions);

      if (consecutivePunctual >= 5) {
        achievements.push({
          id: "punctual_week",
          name: "정시 출근 달인",
          description: "5일 연속 정시 출근",
          emoji: "⏰",
          unlockedAt: new Date(),
        });
      }

      // 과로 경고
      if (session.totalHours > this.config.standardWorkHours + 2) {
        achievements.push({
          id: "overtime_warrior",
          name: "야근 전사",
          description: "2시간 이상 초과근무",
          emoji: "🔥",
          unlockedAt: new Date(),
        });
      }

      // 효율적 근무
      if (
        session.totalBreakTime <= 60 &&
        session.totalHours >= this.config.standardWorkHours
      ) {
        achievements.push({
          id: "efficient_worker",
          name: "효율적인 근무자",
          description: "적절한 휴식으로 효율적 근무",
          emoji: "⚡",
          unlockedAt: new Date(),
        });
      }

      return achievements;
    } catch (error) {
      logger.error("❌ 업적 체크 실패:", error);
      return [];
    }
  }

  /**
   * 🔄 활성 근무 세션 복구
   */
  async restoreActiveWorkSessions() {
    try {
      logger.info("🔄 활성 근무 세션 복구 시작...");

      const activeSessions = await this.worktimeService.getActiveSessions();
      let restoredCount = 0;

      for (const session of activeSessions) {
        try {
          // 세션이 오늘 것인지 확인
          const sessionDate = new Date(session.startTime);
          const today = new Date();

          if (!this.isSameDay(sessionDate, today)) {
            // 어제 세션은 자동 완료 처리
            await this.worktimeService.autoCompleteSession(
              session.userId,
              session.id
            );
            continue;
          }

          // 활성 세션 복구
          const restoredSession = {
            id: session.id,
            userId: session.userId,
            startTime: new Date(session.startTime),
            endTime: null,
            type: session.type,
            status: session.status,
            breaks: session.breaks || [],
            totalBreakTime: session.totalBreakTime || 0,
            location: session.location,
            notes: session.notes || "",
            metadata: session.metadata || {},
          };

          this.activeWorkSessions.set(session.userId, restoredSession);

          // 알림 재설정
          if (this.config.enableNotifications) {
            await this.scheduleWorkNotifications(
              session.userId,
              restoredSession
            );
          }

          restoredCount++;
        } catch (error) {
          logger.error(`❌ 세션 복구 실패 (ID: ${session.id}):`, error);
        }
      }

      logger.success(`✅ 활성 근무 세션 복구 완료: ${restoredCount}개`);
    } catch (error) {
      logger.error("❌ 활성 근무 세션 복구 실패:", error);
    }
  }

  /**
   * 🔔 알림 시스템 초기화
   */
  initializeNotificationSystem() {
    logger.info("🔔 근무시간 알림 시스템 초기화...");

    // 일일 체크 (매시간)
    this.dailyCheckInterval = setInterval(async () => {
      await this.performDailyCheck();
    }, 60 * 60 * 1000); // 1시간마다

    logger.success("✅ 근무시간 알림 시스템 초기화 완료");
  }

  /**
   * 🔔 근무 알림 스케줄링
   */
  async scheduleWorkNotifications(userId, session) {
    try {
      // 퇴근 시간 30분 전 알림
      const endTime = new Date(session.startTime);
      endTime.setHours(endTime.getHours() + this.config.standardWorkHours);
      endTime.setMinutes(
        endTime.getMinutes() - this.config.notifyBeforeEndTime
      );

      const now = new Date();
      const timeToNotification = endTime.getTime() - now.getTime();

      if (timeToNotification > 0) {
        const timerId = setTimeout(async () => {
          await this.sendWorkNotification(
            userId,
            "end_time_approaching",
            session
          );
        }, timeToNotification);

        this.notificationTimers.set(userId, timerId);
      }
    } catch (error) {
      logger.error("❌ 근무 알림 스케줄링 실패:", error);
    }
  }

  /**
   * 🔔 근무 알림 전송
   */
  async sendWorkNotification(userId, type, data) {
    try {
      let title, message;

      switch (type) {
        case "end_time_approaching":
          title = "퇴근 시간 임박";
          message = `${this.config.notifyBeforeEndTime}분 후 퇴근 시간입니다!`;
          break;

        case "overtime_warning":
          title = "초과근무 시작";
          message = "표준 근무시간을 초과했습니다. 건강 관리에 유의하세요!";
          break;

        case "break_reminder":
          title = "휴식 권장";
          message = "충분한 휴식을 취하세요. 생산성 향상에 도움됩니다!";
          break;

        default:
          return;
      }

      logger.info(`🔔 근무 알림: ${type}`, {
        module: "WorktimeModule",
        userId,
        type,
      });

      // NavigationHandler를 통한 알림 (비동기)
      setImmediate(async () => {
        try {
          await enhancedResponses.sendSmartNotification(bot, userId, {
            id: `worktime_${type}_${Date.now()}`,
            title,
            message,
            urgency: type === "overtime_warning" ? "high" : "medium",
            time: TimeHelper.getKoreanTime(),
            type: "worktime",
            data,
          });
        } catch (error) {
          logger.error("❌ 근무 알림 전송 실패:", error);
        }
      });
    } catch (error) {
      logger.error("❌ 근무 알림 처리 실패:", error);
    }
  }

  /**
   * 📅 같은 날짜인지 확인
   */
  isSameDay(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * 📊 모듈 상태 조회 (Enhanced)
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      version: "3.0.1",
      type: "Enhanced",
      features: {
        markdownV2: true,
        realTimeDashboard: true,
        smartNotifications: true,
        performanceAnalytics: true,
        enhancedLogging: true,
      },
      activeWorkSessions: {
        count: this.activeWorkSessions.size,
        working: Array.from(this.activeWorkSessions.values()).filter(
          (s) => s.status === "working"
        ).length,
      },
      activeBreaks: {
        count: this.breakSessions.size,
      },
      notificationTimers: {
        active: this.notificationTimers.size,
      },
      serviceStatus: this.worktimeService?.getStatus(),
      config: {
        standardWorkHours: this.config.standardWorkHours,
        flexibleWorking: this.config.flexibleWorking,
        notificationsEnabled: this.config.enableNotifications,
      },
    };
  }

  /**
   * 🧹 정리 작업 (Enhanced)
   */
  async cleanup() {
    try {
      logger.info("🧹 Enhanced WorktimeModule 정리 시작...");

      // 모든 알림 타이머 정리
      for (const [userId, timerId] of this.notificationTimers.entries()) {
        clearTimeout(timerId);
      }
      this.notificationTimers.clear();

      // 일일 체크 인터벌 정리
      if (this.dailyCheckInterval) {
        clearInterval(this.dailyCheckInterval);
      }

      // 활성 세션들 일시 저장
      for (const [userId, session] of this.activeWorkSessions.entries()) {
        if (session.status === "working") {
          await this.worktimeService.pauseSession(userId, session.id);
        }
      }

      // 메모리 정리
      this.activeWorkSessions.clear();
      this.breakSessions.clear();

      // 부모 클래스 정리
      await super.cleanup();

      logger.success("✅ Enhanced WorktimeModule 정리 완료");
    } catch (error) {
      logger.error("❌ Enhanced WorktimeModule 정리 실패:", error);
    }
  }
}

module.exports = WorktimeModule;
