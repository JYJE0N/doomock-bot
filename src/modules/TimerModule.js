// ===== ⏰ Enhanced TimerModule v3.0.1 - 화려한 타이머 시스템 =====
// src/modules/TimerModule.js
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const enhancedResponses = require("../utils/EnhancedBotResponses");

/**
 * ⏰ Enhanced TimerModule v3.0.1 - 화려한 타이머 시스템
 *
 * 🎨 Enhanced 특징:
 * - 실시간 진행률 표시
 * - 동적 이모지 애니메이션
 * - 포모도로 기법 지원
 * - 화려한 알림 시스템
 * - Enhanced Logger 완벽 연동
 *
 * 🎯 표준 플로우 준수:
 * - ServiceBuilder 의존성 주입
 * - 표준 매개변수 체계
 * - actionMap 방식
 * - NavigationHandler UI 위임
 */
class TimerModule extends BaseModule {
  constructor(moduleKey, options = {}) {
    super("TimerModule", options);

    // 🎨 Enhanced Logger - 화려한 모듈 시작
    logger.moduleStart("TimerModule", "3.0.1");
    console.log("⏰".repeat(20));

    // 🔧 ServiceBuilder를 통한 서비스 의존성 주입
    this.timerService = null;

    // 📊 Railway 환경변수 기반 설정
    this.config = {
      maxTimers: parseInt(process.env.MAX_TIMERS_PER_USER) || 10,
      minMinutes: parseInt(process.env.MIN_TIMER_MINUTES) || 1,
      maxMinutes: parseInt(process.env.MAX_TIMER_MINUTES) || 480, // 8시간
      enablePomodoro: process.env.ENABLE_POMODORO !== "false",
      enableNotifications: process.env.ENABLE_TIMER_NOTIFICATIONS !== "false",
      updateInterval: parseInt(process.env.TIMER_UPDATE_INTERVAL) || 60000, // 1분
      ...this.config,
    };

    // ⏰ 타이머 템플릿들
    this.timerTemplates = {
      pomodoro: {
        name: "포모도로",
        duration: 25,
        emoji: "🍅",
        description: "25분 집중 + 5분 휴식",
        breakDuration: 5,
        cycles: 4,
      },
      shortBreak: {
        name: "짧은 휴식",
        duration: 5,
        emoji: "☕",
        description: "5분 간단 휴식",
      },
      longBreak: {
        name: "긴 휴식",
        duration: 15,
        emoji: "🛌",
        description: "15분 충분한 휴식",
      },
      focus: {
        name: "집중 시간",
        duration: 45,
        emoji: "🎯",
        description: "45분 deep work",
      },
      meeting: {
        name: "회의",
        duration: 30,
        emoji: "👥",
        description: "30분 회의 시간",
      },
    };

    // 🎯 타이머 상태 관리 (Enhanced)
    this.activeTimers = new Map(); // userId -> timerData
    this.timerIntervals = new Map(); // userId -> intervalId
    this.pomodoroSessions = new Map(); // userId -> sessionData

    // 🔔 알림 설정
    this.notificationTypes = {
      start: { emoji: "▶️", sound: "start" },
      pause: { emoji: "⏸️", sound: "pause" },
      resume: { emoji: "▶️", sound: "resume" },
      complete: { emoji: "🔔", sound: "complete" },
      warning: { emoji: "⚠️", sound: "warning" }, // 5분 전
      break: { emoji: "☕", sound: "break" },
    };

    logger.success("⏰ Enhanced TimerModule 생성됨", {
      maxTimers: this.config.maxTimers,
      pomodoroEnabled: this.config.enablePomodoro,
      templatesCount: Object.keys(this.timerTemplates).length,
    });
  }

  /**
   * 🎯 모듈 초기화 - ServiceBuilder 활용
   */
  async onInitialize() {
    try {
      logger.info("🎯 Enhanced TimerModule 초기화 시작...", {
        module: "TimerModule",
        version: "3.0.1",
      });

      // 🔧 ServiceBuilder로 TimerService 요청
      this.timerService = await this.requireService("timer");

      if (!this.timerService) {
        throw new Error("TimerService 초기화 실패");
      }

      // 🔄 활성 타이머 복구
      await this.restoreActiveTimers();

      // 🔔 알림 시스템 초기화
      if (this.config.enableNotifications) {
        this.initializeNotificationSystem();
      }

      logger.success("✅ TimerService 연결 완료", {
        service: "TimerService",
        hasService: !!this.timerService,
        activeTimersCount: this.activeTimers.size,
      });
    } catch (error) {
      logger.error("❌ Enhanced TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 - Enhanced actionMap
   */
  setupActions() {
    logger.debug("🎯 TimerModule Enhanced 액션 등록 시작...");

    this.registerActions({
      // 메인 액션들
      menu: this.handleMenu.bind(this),
      help: this.handleHelp.bind(this),

      // 타이머 기본 조작
      start: this.handleStart.bind(this),
      pause: this.handlePause.bind(this),
      resume: this.handleResume.bind(this),
      stop: this.handleStop.bind(this),
      reset: this.handleReset.bind(this),

      // 타이머 생성 및 설정
      create: this.handleCreate.bind(this),
      "create:template": this.handleCreateTemplate.bind(this),
      "create:custom": this.handleCreateCustom.bind(this),

      // 포모도로 전용
      "pomodoro:start": this.handlePomodoroStart.bind(this),
      "pomodoro:break": this.handlePomodoroBreak.bind(this),
      "pomodoro:cycle": this.handlePomodoroCycle.bind(this),

      // 타이머 관리
      list: this.handleList.bind(this),
      delete: this.handleDelete.bind(this),
      "delete:confirm": this.handleDeleteConfirm.bind(this),

      // 고급 기능
      templates: this.handleTemplates.bind(this),
      settings: this.handleSettings.bind(this),
      "settings:save": this.handleSettingsSave.bind(this),

      // 통계 및 분석
      stats: this.handleStats.bind(this),
      history: this.handleHistory.bind(this),
    });

    logger.success(`✅ TimerModule Enhanced 액션 등록 완료`, {
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

      logger.info("🏠 Enhanced Timer 메뉴 요청", {
        module: "TimerModule",
        action: "menu",
        userId,
        userName,
      });

      // 📊 타이머 현황 수집
      const activeTimer = this.activeTimers.get(userId);
      const timerStats = await this.timerService.getUserStats(userId);
      const recentTimers = await this.timerService.getRecentTimers(userId, 3);
      const pomodoroSession = this.pomodoroSessions.get(userId);

      logger.debug("📊 Timer 메뉴 데이터 수집 완료", {
        hasActiveTimer: !!activeTimer,
        totalTimers: timerStats.total,
        recentCount: recentTimers.length,
        hasPomodoroSession: !!pomodoroSession,
      });

      // 📱 Enhanced UI 데이터
      const menuData = {
        userName,
        activeTimer: activeTimer
          ? {
              ...activeTimer,
              progressPercentage: this.calculateProgress(activeTimer),
              timeRemaining: this.getTimeRemaining(activeTimer),
              statusEmoji: this.getTimerStatusEmoji(activeTimer.status),
              urgencyLevel: this.getUrgencyLevel(activeTimer),
            }
          : null,
        stats: timerStats,
        recentTimers: recentTimers.map((timer) => ({
          ...timer,
          durationFormatted: this.formatDuration(timer.duration),
          statusEmoji: this.getTimerStatusEmoji(timer.status),
        })),
        pomodoroSession,
        templates: this.timerTemplates,
        features: {
          pomodoroEnabled: this.config.enablePomodoro,
          notificationsEnabled: this.config.enableNotifications,
        },
      };

      // ✅ NavigationHandler에게 데이터 전달
      return {
        success: true,
        action: "show_timer_menu",
        data: menuData,
        uiType: "enhanced_dashboard",
      };
    } catch (error) {
      logger.error("❌ Enhanced Timer 메뉴 처리 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
        suggestion: "타이머를 새로고침하거나 새로운 타이머를 시작해보세요.",
      };
    }
  }

  /**
   * ▶️ Enhanced 타이머 시작 핸들러
   */
  async handleStart(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const timerId = params[0];

      logger.info("▶️ Enhanced Timer 시작 요청", {
        module: "TimerModule",
        action: "start",
        userId,
        timerId,
      });

      // 기존 활성 타이머 체크
      const existingTimer = this.activeTimers.get(userId);
      if (existingTimer && existingTimer.status === "running") {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다",
          action: "show_error",
          suggestion: "기존 타이머를 정지하고 새로운 타이머를 시작해보세요.",
          data: { existingTimer },
        };
      }

      // 타이머 데이터 조회
      let timerData;
      if (timerId) {
        timerData = await this.timerService.getTimerById(userId, timerId);
      } else {
        // 새 타이머 생성 (기본값)
        timerData = await this.timerService.createTimer(userId, {
          name: "새 타이머",
          duration: 25, // 기본 25분
          type: "focus",
        });
      }

      if (!timerData) {
        return {
          success: false,
          error: "타이머를 찾을 수 없습니다",
          action: "show_error",
        };
      }

      // 타이머 시작
      const startedTimer = await this.startTimer(userId, timerData);

      logger.success("🎯 타이머 시작 완료", {
        module: "TimerModule",
        timerId: startedTimer.id,
        name: startedTimer.name,
        duration: startedTimer.duration,
      });

      // ✅ 시작 성공 응답
      return {
        success: true,
        action: "show_timer_started",
        data: {
          timer: startedTimer,
          progressBar: this.createProgressBar(startedTimer),
          estimatedEndTime: this.getEstimatedEndTime(startedTimer),
          motivationalMessage: this.getMotivationalMessage("start"),
        },
        uiType: "enhanced_timer_display",
      };
    } catch (error) {
      logger.error("❌ Enhanced Timer 시작 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * ⏸️ Enhanced 타이머 일시정지 핸들러
   */
  async handlePause(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("⏸️ Enhanced Timer 일시정지 요청", {
        module: "TimerModule",
        action: "pause",
        userId,
      });

      const activeTimer = this.activeTimers.get(userId);
      if (!activeTimer || activeTimer.status !== "running") {
        return {
          success: false,
          error: "실행 중인 타이머가 없습니다",
          action: "show_error",
        };
      }

      // 타이머 일시정지
      const pausedTimer = await this.pauseTimer(userId);

      logger.success("⏸️ 타이머 일시정지 완료", {
        module: "TimerModule",
        timerId: pausedTimer.id,
        elapsedTime: pausedTimer.elapsedTime,
      });

      return {
        success: true,
        action: "show_timer_paused",
        data: {
          timer: pausedTimer,
          pauseMessage: "타이머가 일시정지되었습니다",
          elapsedFormatted: this.formatDuration(pausedTimer.elapsedTime),
          remainingFormatted: this.formatDuration(
            pausedTimer.duration - pausedTimer.elapsedTime
          ),
        },
        uiType: "enhanced_timer_display",
      };
    } catch (error) {
      logger.error("❌ Enhanced Timer 일시정지 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 🍅 Enhanced 포모도로 시작 핸들러
   */
  async handlePomodoroStart(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("🍅 Enhanced Pomodoro 시작 요청", {
        module: "TimerModule",
        action: "pomodoro_start",
        userId,
      });

      // 포모도로 세션 초기화
      const pomodoroSession = {
        currentCycle: 1,
        totalCycles: 4,
        type: "work", // work, short_break, long_break
        completedCycles: 0,
        startTime: new Date(),
        totalWorkTime: 0,
        totalBreakTime: 0,
      };

      this.pomodoroSessions.set(userId, pomodoroSession);

      // 포모도로 타이머 생성 및 시작
      const pomodoroTimer = await this.timerService.createTimer(userId, {
        name: `🍅 포모도로 ${pomodoroSession.currentCycle}/${pomodoroSession.totalCycles}`,
        duration: this.timerTemplates.pomodoro.duration,
        type: "pomodoro",
        metadata: {
          isPomodoroSession: true,
          sessionData: pomodoroSession,
        },
      });

      const startedTimer = await this.startTimer(userId, pomodoroTimer);

      logger.success("🍅 포모도로 세션 시작", {
        module: "TimerModule",
        cycle: pomodoroSession.currentCycle,
        totalCycles: pomodoroSession.totalCycles,
      });

      return {
        success: true,
        action: "show_pomodoro_started",
        data: {
          timer: startedTimer,
          session: pomodoroSession,
          motivationalMessage: "🍅 포모도로 시작! 25분간 집중해보세요!",
          tips: [
            "📱 핸드폰을 멀리 두세요",
            "🎯 한 가지 작업에만 집중하세요",
            "💧 물을 충분히 마시세요",
          ],
        },
        uiType: "enhanced_pomodoro_display",
      };
    } catch (error) {
      logger.error("❌ Enhanced Pomodoro 시작 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 📊 Enhanced 통계 핸들러
   */
  async handleStats(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("📊 Enhanced Timer 통계 요청", {
        module: "TimerModule",
        action: "stats",
        userId,
      });

      // 상세 통계 수집
      const detailedStats = await this.timerService.getDetailedStats(userId);
      const weeklyTrends = await this.timerService.getWeeklyTrends(userId);
      const pomodoroStats = await this.timerService.getPomodoroStats(userId);
      const achievements = await this.calculateAchievements(
        userId,
        detailedStats
      );

      logger.debug("📈 Timer 통계 데이터 수집 완료", {
        totalTimers: detailedStats.totalTimers,
        totalFocusTime: detailedStats.totalFocusTime,
        pomodoroCompleted: pomodoroStats.completedCycles,
      });

      return {
        success: true,
        action: "show_timer_stats",
        data: {
          stats: detailedStats,
          trends: weeklyTrends,
          pomodoroStats,
          achievements,
          progressCharts: {
            dailyFocus: weeklyTrends.dailyFocus,
            weeklyCompletion: weeklyTrends.weeklyCompletion,
            categoryBreakdown: detailedStats.categoryBreakdown,
          },
          insights: this.generateInsights(detailedStats, weeklyTrends),
        },
        uiType: "enhanced_stats_dashboard",
      };
    } catch (error) {
      logger.error("❌ Enhanced Timer 통계 조회 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  // ===== 🛠️ Enhanced 타이머 핵심 기능들 =====

  /**
   * 🎯 타이머 시작 (내부 로직)
   */
  async startTimer(userId, timerData) {
    try {
      const startTime = new Date();
      const endTime = new Date(
        startTime.getTime() + timerData.duration * 60 * 1000
      );

      // 활성 타이머 데이터
      const activeTimer = {
        id: timerData.id,
        name: timerData.name,
        duration: timerData.duration, // 분 단위
        startTime,
        endTime,
        elapsedTime: 0,
        status: "running",
        type: timerData.type || "focus",
        metadata: timerData.metadata || {},
      };

      // 메모리에 저장
      this.activeTimers.set(userId, activeTimer);

      // 업데이트 인터벌 시작
      const intervalId = setInterval(async () => {
        await this.updateTimerProgress(userId);
      }, this.config.updateInterval);

      this.timerIntervals.set(userId, intervalId);

      // 데이터베이스에도 저장
      await this.timerService.updateTimerStatus(userId, timerData.id, {
        status: "running",
        startTime,
        endTime,
      });

      // 🔔 시작 알림
      if (this.config.enableNotifications) {
        await this.sendTimerNotification(userId, "start", activeTimer);
      }

      return activeTimer;
    } catch (error) {
      logger.error("❌ 타이머 시작 내부 로직 실패:", error);
      throw error;
    }
  }

  /**
   * ⏸️ 타이머 일시정지 (내부 로직)
   */
  async pauseTimer(userId) {
    try {
      const activeTimer = this.activeTimers.get(userId);
      if (!activeTimer) {
        throw new Error("활성 타이머가 없습니다");
      }

      // 경과 시간 계산
      const now = new Date();
      const elapsed = Math.floor((now - activeTimer.startTime) / (1000 * 60)); // 분 단위

      // 상태 업데이트
      activeTimer.status = "paused";
      activeTimer.elapsedTime = elapsed;
      activeTimer.pausedAt = now;

      // 인터벌 정리
      const intervalId = this.timerIntervals.get(userId);
      if (intervalId) {
        clearInterval(intervalId);
        this.timerIntervals.delete(userId);
      }

      // 데이터베이스 업데이트
      await this.timerService.updateTimerStatus(userId, activeTimer.id, {
        status: "paused",
        elapsedTime: elapsed,
        pausedAt: now,
      });

      // 🔔 일시정지 알림
      if (this.config.enableNotifications) {
        await this.sendTimerNotification(userId, "pause", activeTimer);
      }

      return activeTimer;
    } catch (error) {
      logger.error("❌ 타이머 일시정지 내부 로직 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 타이머 진행률 업데이트
   */
  async updateTimerProgress(userId) {
    try {
      const activeTimer = this.activeTimers.get(userId);
      if (!activeTimer || activeTimer.status !== "running") {
        return;
      }

      const now = new Date();
      const elapsed = Math.floor((now - activeTimer.startTime) / (1000 * 60));
      activeTimer.elapsedTime = elapsed;

      // 타이머 완료 체크
      if (elapsed >= activeTimer.duration) {
        await this.completeTimer(userId);
        return;
      }

      // 경고 알림 (5분 전)
      const remaining = activeTimer.duration - elapsed;
      if (remaining === 5 && this.config.enableNotifications) {
        await this.sendTimerNotification(userId, "warning", activeTimer);
      }
    } catch (error) {
      logger.error("❌ 타이머 진행률 업데이트 실패:", error);
    }
  }

  /**
   * ✅ 타이머 완료
   */
  async completeTimer(userId) {
    try {
      const activeTimer = this.activeTimers.get(userId);
      if (!activeTimer) {
        return;
      }

      // 상태 업데이트
      activeTimer.status = "completed";
      activeTimer.completedAt = new Date();

      // 인터벌 정리
      const intervalId = this.timerIntervals.get(userId);
      if (intervalId) {
        clearInterval(intervalId);
        this.timerIntervals.delete(userId);
      }

      // 데이터베이스 완료 처리
      await this.timerService.completeTimer(userId, activeTimer.id);

      // 포모도로 세션 처리
      const pomodoroSession = this.pomodoroSessions.get(userId);
      if (pomodoroSession && activeTimer.type === "pomodoro") {
        await this.handlePomodoroCompletion(userId, pomodoroSession);
      }

      // 🔔 완료 알림
      if (this.config.enableNotifications) {
        await this.sendTimerNotification(userId, "complete", activeTimer);
      }

      // 메모리에서 제거
      this.activeTimers.delete(userId);

      logger.success("🎊 타이머 완료!", {
        module: "TimerModule",
        timerId: activeTimer.id,
        name: activeTimer.name,
        duration: activeTimer.duration,
        actualDuration: activeTimer.elapsedTime,
      });

      return activeTimer;
    } catch (error) {
      logger.error("❌ 타이머 완료 처리 실패:", error);
      throw error;
    }
  }

  /**
   * 🍅 포모도로 완료 처리
   */
  async handlePomodoroCompletion(userId, pomodoroSession) {
    try {
      logger.info("🍅 포모도로 사이클 완료", {
        cycle: pomodoroSession.currentCycle,
        totalCycles: pomodoroSession.totalCycles,
      });

      pomodoroSession.completedCycles++;

      // 모든 사이클 완료
      if (pomodoroSession.currentCycle >= pomodoroSession.totalCycles) {
        pomodoroSession.status = "completed";
        pomodoroSession.completedAt = new Date();

        // 포모도로 세션 통계 저장
        await this.timerService.savePomodoroSession(userId, pomodoroSession);

        logger.success("🎊 포모도로 세션 완료!", {
          totalCycles: pomodoroSession.completedCycles,
          totalTime: pomodoroSession.totalWorkTime,
        });

        // 세션 정리
        this.pomodoroSessions.delete(userId);

        return { type: "session_complete", session: pomodoroSession };
      }

      // 다음 사이클 준비
      pomodoroSession.currentCycle++;

      // 휴식 타입 결정 (4번째마다 긴 휴식)
      const isLongBreak = pomodoroSession.currentCycle % 4 === 0;
      const breakDuration = isLongBreak ? 15 : 5;
      const breakType = isLongBreak ? "long_break" : "short_break";

      return {
        type: "break_time",
        breakType,
        breakDuration,
        session: pomodoroSession,
        isLongBreak,
      };
    } catch (error) {
      logger.error("❌ 포모도로 완료 처리 실패:", error);
      throw error;
    }
  }

  /**
   * 🔔 타이머 알림 전송
   */
  async sendTimerNotification(userId, type, timerData) {
    try {
      const notification = this.notificationTypes[type];
      if (!notification) {
        return;
      }

      let title, message;

      switch (type) {
        case "start":
          title = "타이머 시작!";
          message = `${notification.emoji} "${timerData.name}" 타이머가 시작되었습니다 (${timerData.duration}분)`;
          break;

        case "pause":
          title = "타이머 일시정지";
          message = `${notification.emoji} "${timerData.name}" 타이머가 일시정지되었습니다`;
          break;

        case "complete":
          title = "타이머 완료!";
          message = `${notification.emoji} "${timerData.name}" 타이머가 완료되었습니다! 수고하셨습니다!`;
          break;

        case "warning":
          title = "5분 남았습니다!";
          message = `${notification.emoji} "${timerData.name}" 타이머가 곧 완료됩니다`;
          break;

        default:
          return;
      }

      // Enhanced Logger에 알림 로그
      logger.info(`🔔 타이머 알림: ${type}`, {
        module: "TimerModule",
        userId,
        type,
        timerName: timerData.name,
      });

      // NavigationHandler를 통한 알림 (비동기)
      setImmediate(async () => {
        try {
          await enhancedResponses.sendSmartNotification(bot, userId, {
            id: `timer_${timerData.id}_${type}`,
            title,
            message,
            urgency: type === "complete" ? "high" : "medium",
            time: TimeHelper.getKoreanTime(),
            type: "timer",
            data: timerData,
          });
        } catch (error) {
          logger.error("❌ 타이머 알림 전송 실패:", error);
        }
      });
    } catch (error) {
      logger.error("❌ 타이머 알림 처리 실패:", error);
    }
  }

  // ===== 🛠️ Enhanced 유틸리티 메서드들 =====

  /**
   * 📊 진행률 계산
   */
  calculateProgress(timerData) {
    if (!timerData || timerData.duration <= 0) {
      return 0;
    }

    const progress = (timerData.elapsedTime / timerData.duration) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  /**
   * ⏰ 남은 시간 계산
   */
  getTimeRemaining(timerData) {
    if (!timerData) {
      return 0;
    }

    const remaining = timerData.duration - timerData.elapsedTime;
    return Math.max(remaining, 0);
  }

  /**
   * 🎨 타이머 상태 이모지
   */
  getTimerStatusEmoji(status) {
    const statusEmojis = {
      running: "▶️",
      paused: "⏸️",
      completed: "✅",
      stopped: "⏹️",
      pending: "⏳",
    };

    return statusEmojis[status] || "❓";
  }

  /**
   * 🚨 긴급도 레벨 계산
   */
  getUrgencyLevel(timerData) {
    const remaining = this.getTimeRemaining(timerData);
    const total = timerData.duration;
    const percentage = (remaining / total) * 100;

    if (percentage <= 10) return "critical"; // 10% 이하
    if (percentage <= 25) return "high"; // 25% 이하
    if (percentage <= 50) return "medium"; // 50% 이하
    return "low";
  }

  /**
   * 📏 시간 포맷팅
   */
  formatDuration(minutes) {
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
   * 🕐 예상 종료 시간
   */
  getEstimatedEndTime(timerData) {
    if (!timerData || !timerData.startTime) {
      return null;
    }

    const remaining = this.getTimeRemaining(timerData);
    const endTime = new Date(Date.now() + remaining * 60 * 1000);

    return TimeHelper.format(endTime, "HH:mm");
  }

  /**
   * 💪 동기부여 메시지
   */
  getMotivationalMessage(type) {
    const messages = {
      start: [
        "🎯 집중의 시간이 시작되었습니다!",
        "💪 목표를 향해 달려보세요!",
        "🚀 생산성 모드 ON!",
        "⚡ 집중력을 발휘할 시간입니다!",
      ],
      complete: [
        "🎊 훌륭합니다! 목표를 달성했어요!",
        "👏 집중력이 대단하네요!",
        "🌟 또 하나의 성취를 이뤘습니다!",
        "🏆 오늘도 한 걸음 더 나아갔어요!",
      ],
      break: [
        "☕ 잠깐 쉬어가세요!",
        "🧘 휴식도 중요한 생산성입니다!",
        "🌱 재충전의 시간이에요!",
        "😌 마음을 편히 하고 쉬세요!",
      ],
    };

    const messageArray = messages[type] || messages.start;
    return messageArray[Math.floor(Math.random() * messageArray.length)];
  }

  /**
   * 📈 진행률 바 생성
   */
  createProgressBar(timerData, width = 15) {
    const progress = this.calculateProgress(timerData);
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const filledChar = "▰";
    const emptyChar = "▱";

    return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)}`;
  }

  /**
   * 📊 활성 타이머 복구
   */
  async restoreActiveTimers() {
    try {
      logger.info("🔄 활성 타이머 복구 시작...");

      const activeTimers = await this.timerService.getActiveTimers();
      let restoredCount = 0;

      for (const timer of activeTimers) {
        try {
          // 타이머가 이미 만료되었는지 체크
          const now = new Date();
          if (timer.endTime && now >= new Date(timer.endTime)) {
            // 만료된 타이머 완료 처리
            await this.timerService.completeTimer(timer.userId, timer.id);
            continue;
          }

          // 진행 중인 타이머 복구
          const elapsedMinutes = Math.floor(
            (now - new Date(timer.startTime)) / (1000 * 60)
          );

          const restoredTimer = {
            id: timer.id,
            name: timer.name,
            duration: timer.duration,
            startTime: new Date(timer.startTime),
            endTime: new Date(timer.endTime),
            elapsedTime: elapsedMinutes,
            status: timer.status,
            type: timer.type || "focus",
            metadata: timer.metadata || {},
          };

          this.activeTimers.set(timer.userId, restoredTimer);

          // 업데이트 인터벌 재시작
          const intervalId = setInterval(async () => {
            await this.updateTimerProgress(timer.userId);
          }, this.config.updateInterval);

          this.timerIntervals.set(timer.userId, intervalId);

          restoredCount++;
        } catch (error) {
          logger.error(`❌ 타이머 복구 실패 (ID: ${timer.id}):`, error);
        }
      }

      logger.success(`✅ 활성 타이머 복구 완료: ${restoredCount}개`);
    } catch (error) {
      logger.error("❌ 활성 타이머 복구 실패:", error);
    }
  }

  /**
   * 🔔 알림 시스템 초기화
   */
  initializeNotificationSystem() {
    logger.info("🔔 타이머 알림 시스템 초기화...");

    // 글로벌 타이머 체크 (1분마다)
    this.globalCheckInterval = setInterval(async () => {
      await this.performGlobalTimerCheck();
    }, 60000);

    logger.success("✅ 타이머 알림 시스템 초기화 완료");
  }

  /**
   * 🔍 글로벌 타이머 체크
   */
  async performGlobalTimerCheck() {
    try {
      for (const [userId, timerData] of this.activeTimers.entries()) {
        if (timerData.status === "running") {
          // 완료 체크
          const now = new Date();
          if (now >= timerData.endTime) {
            await this.completeTimer(userId);
          }
        }
      }
    } catch (error) {
      logger.error("❌ 글로벌 타이머 체크 실패:", error);
    }
  }

  /**
   * 🏆 업적 계산
   */
  async calculateAchievements(userId, stats) {
    try {
      const achievements = [];

      // 기본 업적들
      if (stats.totalTimers >= 10) {
        achievements.push({
          id: "timer_veteran",
          name: "타이머 베테랑",
          description: "10개 이상의 타이머 완료",
          emoji: "🏅",
          unlockedAt: new Date(),
        });
      }

      if (stats.totalFocusTime >= 1000) {
        // 1000분 = 16.7시간
        achievements.push({
          id: "focus_master",
          name: "집중의 달인",
          description: "총 1000분 이상 집중",
          emoji: "🎯",
          unlockedAt: new Date(),
        });
      }

      if (stats.pomodoroCompleted >= 25) {
        achievements.push({
          id: "pomodoro_expert",
          name: "포모도로 전문가",
          description: "25개 포모도로 완료",
          emoji: "🍅",
          unlockedAt: new Date(),
        });
      }

      // 연속 완료 업적
      if (stats.streakDays >= 7) {
        achievements.push({
          id: "weekly_warrior",
          name: "주간 전사",
          description: "7일 연속 타이머 완료",
          emoji: "🔥",
          unlockedAt: new Date(),
        });
      }

      return achievements;
    } catch (error) {
      logger.error("❌ 업적 계산 실패:", error);
      return [];
    }
  }

  /**
   * 💡 인사이트 생성
   */
  generateInsights(stats, trends) {
    const insights = [];

    try {
      // 생산성 패턴 분석
      if (trends.dailyFocus && trends.dailyFocus.length > 0) {
        const avgDaily =
          trends.dailyFocus.reduce((sum, day) => sum + day.minutes, 0) /
          trends.dailyFocus.length;

        if (avgDaily > 120) {
          // 2시간 이상
          insights.push({
            type: "positive",
            emoji: "🌟",
            message:
              "훌륭한 집중력을 보여주고 있어요! 하루 평균 2시간 이상 집중하고 있습니다.",
          });
        } else if (avgDaily < 30) {
          // 30분 미만
          insights.push({
            type: "suggestion",
            emoji: "💡",
            message:
              "조금 더 집중 시간을 늘려보세요. 작은 목표부터 시작해보는 것은 어떨까요?",
          });
        }
      }

      // 완료율 분석
      if (stats.completionRate > 80) {
        insights.push({
          type: "positive",
          emoji: "🎯",
          message: `완료율이 ${stats.completionRate}%로 매우 우수합니다! 목표 달성 능력이 뛰어나네요.`,
        });
      }

      // 포모도로 분석
      if (stats.pomodoroCompleted > 0) {
        const pomodoroEfficiency =
          (stats.pomodoroCompleted / stats.totalTimers) * 100;
        if (pomodoroEfficiency > 50) {
          insights.push({
            type: "info",
            emoji: "🍅",
            message:
              "포모도로 기법을 잘 활용하고 있어요! 이런 패턴을 유지해보세요.",
          });
        }
      }

      return insights;
    } catch (error) {
      logger.error("❌ 인사이트 생성 실패:", error);
      return [];
    }
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
        realTimeProgress: true,
        pomodoroSupport: true,
        smartNotifications: true,
        enhancedLogging: true,
      },
      activeTimers: {
        count: this.activeTimers.size,
        running: Array.from(this.activeTimers.values()).filter(
          (t) => t.status === "running"
        ).length,
        paused: Array.from(this.activeTimers.values()).filter(
          (t) => t.status === "paused"
        ).length,
      },
      pomodoroSessions: {
        active: this.pomodoroSessions.size,
      },
      serviceStatus: this.timerService?.getStatus(),
      config: {
        maxTimers: this.config.maxTimers,
        pomodoroEnabled: this.config.enablePomodoro,
        notificationsEnabled: this.config.enableNotifications,
        updateInterval: this.config.updateInterval,
      },
    };
  }

  /**
   * 🧹 정리 작업 (Enhanced)
   */
  async cleanup() {
    try {
      logger.info("🧹 Enhanced TimerModule 정리 시작...");

      // 모든 타이머 인터벌 정리
      for (const [userId, intervalId] of this.timerIntervals.entries()) {
        clearInterval(intervalId);
      }
      this.timerIntervals.clear();

      // 글로벌 체크 인터벌 정리
      if (this.globalCheckInterval) {
        clearInterval(this.globalCheckInterval);
      }

      // 활성 타이머들 일시정지 상태로 저장
      for (const [userId, timerData] of this.activeTimers.entries()) {
        if (timerData.status === "running") {
          await this.pauseTimer(userId);
        }
      }

      // 메모리 정리
      this.activeTimers.clear();
      this.pomodoroSessions.clear();

      // 부모 클래스 정리
      await super.cleanup();

      logger.success("✅ Enhanced TimerModule 정리 완료");
    } catch (error) {
      logger.error("❌ Enhanced TimerModule 정리 실패:", error);
    }
  }
}

module.exports = TimerModule;
