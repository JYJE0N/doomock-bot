// src/modules/TimerModule.js - 표준화된 최종 수정 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * ⏱️ TimerModule - 포모도로 타이머 모듈
 *
 * 🎯 핵심 기능:
 * - ⏱️ 포모도로 타이머 (기본 25분)
 * - ▶️ 시작/정지 제어
 * - 📊 진행 상황 표시
 * - 📈 통계 및 기록
 *
 * ✅ 표준 준수:
 * - BaseModule 상속
 * - 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
 * - actionMap 방식
 * - onInitialize/onHandleMessage 패턴
 * - 순수 데이터 반환
 */
class TimerModule extends BaseModule {
  /**
   * 🏗️ 생성자 - 표준 매개변수 구조 준수
   */
  constructor(moduleName, options = {}) {
    // 🔥 핵심 수정: options 구조 올바르게 사용
    super(moduleName, options);

    // ServiceBuilder에서 서비스 주입
    this.serviceBuilder = options.serviceBuilder || null;
    this.timerService = null;

    // 모듈 설정
    this.config = {
      defaultDuration: parseInt(process.env.DEFAULT_TIMER_DURATION) || 25, // 25분
      shortBreak: parseInt(process.env.SHORT_BREAK_DURATION) || 5, // 5분
      longBreak: parseInt(process.env.LONG_BREAK_DURATION) || 15, // 15분
      maxDuration: parseInt(process.env.MAX_TIMER_DURATION) || 120, // 2시간
      enableNotifications: process.env.ENABLE_TIMER_NOTIFICATIONS !== "false",
      ...options.config,
    };

    // 실시간 타이머 상태 추적 (메모리 기반)
    this.activeTimers = new Map();

    logger.info("⏱️ TimerModule 생성됨", {
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      hasServiceBuilder: !!this.serviceBuilder,
      defaultDuration: this.config.defaultDuration,
      enableNotifications: this.config.enableNotifications,
    });
  }

  /**
   * 🔑 TimerModule 키워드 정의
   */
  getModuleKeywords() {
    return [
      // 한국어 키워드
      "timer",
      "타이머",
      "포모도로",
      "pomodoro",
      "시간",
      "집중",
      "작업시간",
      "휴식",
      "알람",
      "스톱워치",
    ];
  }

  /**
   * ✅ 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      logger.info("⏱️ TimerModule 초기화 시작...");

      // ServiceBuilder를 통한 서비스 연결
      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 필요합니다");
      }

      // TimerService 연결
      this.timerService = await this.serviceBuilder.getOrCreate("timer", {
        config: this.config,
      });

      if (!this.timerService) {
        throw new Error("TimerService를 찾을 수 없습니다");
      }

      // 초기화 완료 확인
      if (typeof this.timerService.initialize === "function") {
        await this.timerService.initialize();
        logger.info("TimerService 초기화 완료");
      }

      // 액션 등록
      this.setupActions();

      // 타이머 만료 체크 시작
      this.startTimerExpiryCheck();

      logger.success("✅ TimerModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 메인 액션들
      menu: this.showTimerMenu,
      start: this.startTimer,
      stop: this.stopTimer,
      pause: this.pauseTimer,
      resume: this.resumeTimer,

      // 시간 설정 액션들
      "set:25": this.setTimer25,
      "set:50": this.setTimer50,
      "set:90": this.setTimer90,
      "set:custom": this.promptCustomTime,

      // 휴식 타이머 액션들
      "break:short": this.startShortBreak,
      "break:long": this.startLongBreak,

      // 상태 및 통계
      status: this.showTimerStatus,
      history: this.showTimerHistory,
      stats: this.showTimerStats,

      // 설정
      settings: this.showTimerSettings,
    });
  }

  // ===== ⏱️ 메뉴 액션들 (표준 매개변수 준수) =====

  /**
   * ⏱️ 타이머 메인 메뉴 표시
   */
  async showTimerMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`⏱️ 타이머 메뉴 요청 (사용자: ${userId})`);

      // 현재 타이머 상태 확인
      const currentTimer = await this.getCurrentTimerStatus(userId);

      // 오늘 완료된 타이머 통계
      const todayStats = await this.getTodayStats(userId);

      // ✅ 순수 데이터만 반환 (UI는 NavigationHandler가 처리)
      return {
        success: true,
        action: "show_timer_menu",
        data: {
          type: "timer_menu",
          userName,
          currentTimer,
          todayStats,
          presetDurations: [
            { label: "25분 (포모도로)", value: 25 },
            { label: "50분 (집중)", value: 50 },
            { label: "90분 (딥워크)", value: 90 },
          ],
          config: {
            defaultDuration: this.config.defaultDuration,
            enableNotifications: this.config.enableNotifications,
          },
        },
      };
    } catch (error) {
      logger.error("타이머 메뉴 표시 실패:", error);
      return {
        success: false,
        error: "타이머 메뉴를 불러올 수 없습니다",
        data: { type: "error", message: "타이머 메뉴를 불러올 수 없습니다" },
      };
    }
  }

  /**
   * ▶️ 타이머 시작 (기본 시간)
   */
  async startTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const duration = parseInt(params) || this.config.defaultDuration;

    try {
      logger.info(`▶️ 타이머 시작 (사용자: ${userId}, 시간: ${duration}분)`);

      // 기존 타이머 확인
      const existingTimer = await this.getCurrentTimerStatus(userId);
      if (existingTimer && existingTimer.isActive) {
        return {
          success: false,
          error: "이미 실행 중인 타이머가 있습니다",
          data: { type: "error", message: "이미 실행 중인 타이머가 있습니다" },
        };
      }

      // 타이머 시작
      const result = await this.timerService.startTimer(userId, duration);

      if (result.success) {
        // 메모리에 활성 타이머 등록
        this.activeTimers.set(userId, {
          startTime: new Date(),
          duration: duration,
          endTime: result.endTime,
          isPaused: false,
        });

        // 메뉴 새로고침을 위해 메뉴 데이터 반환
        return await this.showTimerMenu(
          bot,
          callbackQuery,
          "menu",
          "",
          moduleManager
        );
      } else {
        return {
          success: false,
          error: result.message || "타이머 시작에 실패했습니다",
          data: {
            type: "error",
            message: result.message || "타이머 시작에 실패했습니다",
          },
        };
      }
    } catch (error) {
      logger.error("타이머 시작 실패:", error);
      return {
        success: false,
        error: "타이머 시작에 실패했습니다",
        data: { type: "error", message: "타이머 시작에 실패했습니다" },
      };
    }
  }

  /**
   * ⏹️ 타이머 정지
   */
  async stopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`⏹️ 타이머 정지 (사용자: ${userId})`);

      const result = await this.timerService.stopTimer(userId);

      if (result.success) {
        // 메모리에서 활성 타이머 제거
        this.activeTimers.delete(userId);

        // 메뉴 새로고침을 위해 메뉴 데이터 반환
        return await this.showTimerMenu(
          bot,
          callbackQuery,
          "menu",
          "",
          moduleManager
        );
      } else {
        return {
          success: false,
          error: result.message || "타이머 정지에 실패했습니다",
          data: {
            type: "error",
            message: result.message || "타이머 정지에 실패했습니다",
          },
        };
      }
    } catch (error) {
      logger.error("타이머 정지 실패:", error);
      return {
        success: false,
        error: "타이머 정지에 실패했습니다",
        data: { type: "error", message: "타이머 정지에 실패했습니다" },
      };
    }
  }

  // ===== ⏱️ 프리셋 타이머 액션들 =====

  /**
   * 🍅 25분 포모도로 타이머
   */
  async setTimer25(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.startTimer(
      bot,
      callbackQuery,
      "start",
      "25",
      moduleManager
    );
  }

  /**
   * 🎯 50분 집중 타이머
   */
  async setTimer50(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.startTimer(
      bot,
      callbackQuery,
      "start",
      "50",
      moduleManager
    );
  }

  /**
   * 🧠 90분 딥워크 타이머
   */
  async setTimer90(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.startTimer(
      bot,
      callbackQuery,
      "start",
      "90",
      moduleManager
    );
  }

  /**
   * ⏰ 사용자 정의 시간 입력 프롬프트
   */
  async promptCustomTime(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    logger.info(`⏰ 사용자 정의 시간 프롬프트 (사용자: ${userId})`);

    // 사용자 상태를 "시간 입력 대기"로 설정
    this.setUserState(userId, {
      awaitingInput: true,
      action: "awaiting_timer_duration",
    });

    return {
      success: true,
      action: "prompt_custom_time",
      data: {
        type: "custom_time_prompt",
        message: "타이머 시간을 분 단위로 입력해주세요 (1-120분):",
        minDuration: 1,
        maxDuration: this.config.maxDuration,
      },
    };
  }

  // ===== 🛌 휴식 타이머 액션들 =====

  /**
   * ☕ 짧은 휴식 (5분)
   */
  async startShortBreak(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.startTimer(
      bot,
      callbackQuery,
      "start",
      this.config.shortBreak.toString(),
      moduleManager
    );
  }

  /**
   * 🛌 긴 휴식 (15분)
   */
  async startLongBreak(bot, callbackQuery, subAction, params, moduleManager) {
    return await this.startTimer(
      bot,
      callbackQuery,
      "start",
      this.config.longBreak.toString(),
      moduleManager
    );
  }

  // ===== 📊 상태 및 통계 액션들 =====

  /**
   * 📊 타이머 상태 표시
   */
  async showTimerStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`📊 타이머 상태 요청 (사용자: ${userId})`);

      const status = await this.timerService.getDetailedStatus(userId);
      const currentTimer = await this.getCurrentTimerStatus(userId);

      return {
        success: true,
        action: "show_timer_status",
        data: {
          type: "timer_status",
          status,
          currentTimer,
          serverTime: TimeHelper.now(),
        },
      };
    } catch (error) {
      logger.error("타이머 상태 조회 실패:", error);
      return {
        success: false,
        error: "타이머 상태를 불러올 수 없습니다",
        data: { type: "error", message: "타이머 상태를 불러올 수 없습니다" },
      };
    }
  }

  /**
   * 📈 타이머 통계 표시
   */
  async showTimerStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`📈 타이머 통계 요청 (사용자: ${userId})`);

      const stats = await this.getTimerStats(userId);

      return {
        success: true,
        action: "show_timer_stats",
        data: {
          type: "timer_stats",
          stats,
        },
      };
    } catch (error) {
      logger.error("타이머 통계 조회 실패:", error);
      return {
        success: false,
        error: "타이머 통계를 불러올 수 없습니다",
        data: { type: "error", message: "타이머 통계를 불러올 수 없습니다" },
      };
    }
  }

  // ===== 🛠️ 사용자 입력 처리 =====

  /**
   * 📝 사용자 입력 처리 (상태 기반)
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (userState.action === "awaiting_timer_duration") {
      // 타이머 시간 입력 처리
      const duration = parseInt(text.trim());

      if (isNaN(duration)) {
        await bot.sendMessage(chatId, "⚠️ 숫자로 입력해주세요. (예: 25)");
        return true;
      }

      if (duration < 1 || duration > this.config.maxDuration) {
        await bot.sendMessage(
          chatId,
          `⚠️ 1분에서 ${this.config.maxDuration}분 사이의 값을 입력해주세요.`
        );
        return true;
      }

      try {
        // 타이머 시작
        const result = await this.timerService.startTimer(userId, duration);

        if (result.success) {
          this.activeTimers.set(userId, {
            startTime: new Date(),
            duration: duration,
            endTime: result.endTime,
            isPaused: false,
          });

          await bot.sendMessage(
            chatId,
            `✅ ${duration}분 타이머가 시작되었습니다!\n` +
              `⏰ 종료 시간: ${TimeHelper.format(result.endTime, "HH:mm")}`
          );

          // 사용자 상태 정리
          this.clearUserState(userId);

          // 타이머 메뉴 표시
          setTimeout(() => {
            if (this.moduleManager?.navigationHandler) {
              this.moduleManager.navigationHandler.sendModuleMenu(
                bot,
                chatId,
                "timer"
              );
            }
          }, 2000);
        } else {
          await bot.sendMessage(
            chatId,
            `❌ ${result.message || "타이머 시작에 실패했습니다"}`
          );
        }

        return true;
      } catch (error) {
        logger.error("사용자 정의 타이머 시작 실패:", error);
        await bot.sendMessage(chatId, "❌ 타이머 시작에 실패했습니다.");
        this.clearUserState(userId);
        return true;
      }
    }

    return false;
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * ⏱️ 현재 타이머 상태 조회
   */
  async getCurrentTimerStatus(userId) {
    try {
      const serviceStatus = await this.timerService.getTimerStatus(userId);
      const memoryTimer = this.activeTimers.get(userId);

      return {
        ...serviceStatus,
        inMemory: !!memoryTimer,
        memoryData: memoryTimer || null,
      };
    } catch (error) {
      logger.error("현재 타이머 상태 조회 실패:", error);
      return { isActive: false, error: error.message };
    }
  }

  /**
   * 📊 오늘 타이머 통계
   */
  async getTodayStats(userId) {
    try {
      if (typeof this.timerService.getTodayStats === "function") {
        return await this.timerService.getTodayStats(userId);
      } else {
        // 기본값 반환
        return {
          completedToday: 0,
          totalMinutesToday: 0,
          averageDuration: 0,
        };
      }
    } catch (error) {
      logger.error("오늘 통계 조회 실패:", error);
      return { completedToday: 0, totalMinutesToday: 0, averageDuration: 0 };
    }
  }

  /**
   * 📈 전체 타이머 통계
   */
  async getTimerStats(userId) {
    try {
      if (typeof this.timerService.getTimerStats === "function") {
        return await this.timerService.getTimerStats(userId);
      } else {
        return {
          totalCompleted: 0,
          totalMinutes: 0,
          averageDuration: 0,
          streakDays: 0,
          bestDay: null,
        };
      }
    } catch (error) {
      logger.error("타이머 통계 조회 실패:", error);
      return { totalCompleted: 0, totalMinutes: 0, averageDuration: 0 };
    }
  }

  /**
   * ⏰ 타이머 만료 체크 시작
   */
  startTimerExpiryCheck() {
    // 30초마다 만료된 타이머 체크
    this.expiryCheckInterval = setInterval(async () => {
      const now = new Date();

      for (const [userId, timer] of this.activeTimers.entries()) {
        if (now >= timer.endTime && !timer.notified) {
          await this.handleTimerExpiry(userId, timer);
        }
      }
    }, 30000); // 30초마다

    logger.info("⏰ 타이머 만료 체크 시작됨");
  }

  /**
   * 🔔 타이머 만료 처리
   */
  async handleTimerExpiry(userId, timer) {
    try {
      logger.info(`🔔 타이머 만료 알림 (사용자: ${userId})`);

      // 알림 플래그 설정 (중복 알림 방지)
      timer.notified = true;

      // 서비스에서 타이머 완료 처리
      if (typeof this.timerService.completeTimer === "function") {
        await this.timerService.completeTimer(userId);
      }

      // 메모리에서 제거
      this.activeTimers.delete(userId);

      // 사용자에게 알림 (봇을 통해)
      if (this.config.enableNotifications && this.bot) {
        try {
          await this.bot.sendMessage(
            userId,
            `🔔 **타이머 완료!**\n\n` +
              `⏱️ ${timer.duration}분 집중 시간이 끝났습니다.\n` +
              `🎉 수고하셨습니다!\n\n` +
              `☕ 잠시 휴식을 취하거나 다음 작업을 시작하세요.`
          );
        } catch (botError) {
          logger.warn("타이머 만료 알림 전송 실패:", botError.message);
        }
      }
    } catch (error) {
      logger.error("타이머 만료 처리 실패:", error);
    }
  }

  /**
   * 📊 모듈 상태 정보
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceStatus: this.timerService ? "Connected" : "Disconnected",
      activeTimersCount: this.activeTimers.size,
      config: {
        defaultDuration: this.config.defaultDuration,
        enableNotifications: this.config.enableNotifications,
        maxDuration: this.config.maxDuration,
      },
      features: {
        pomodoro: true,
        customDuration: true,
        breakTimers: true,
        notifications: this.config.enableNotifications,
        statistics: true,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 타이머 만료 체크 중지
      if (this.expiryCheckInterval) {
        clearInterval(this.expiryCheckInterval);
        this.expiryCheckInterval = null;
      }

      // 활성 타이머 정리
      this.activeTimers.clear();

      // 부모 클래스 정리 호출
      await super.cleanup();

      logger.info("✅ TimerModule 정리 완료");
    } catch (error) {
      logger.error("❌ TimerModule 정리 실패:", error);
    }
  }
}

module.exports = TimerModule;
