// src/modules/TimerModule.js - 리팩토링 v6.0

const BaseModule = require("../core/BaseModule");
const { getUserId, getUserName } = require("../utils/UserHelper");
const { getInstance: getStateManager } = require("../utils/TimerStateManager");
const logger = require("../utils/Logger");

/**
 * 🍅 TimerModule - 타이머 비즈니스 로직
 *
 * 책임:
 * - 사용자 요청 처리
 * - 비즈니스 규칙 적용
 * - 서비스/렌더러 조율
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);
    this.timerService = null;
    this.stateManager = getStateManager();
  }

  /**
   * 🚀 모듈 초기화
   */
  async onInitialize() {
    try {
      // 서비스 초기화
      this.timerService = await this.serviceBuilder.getOrCreate("timer");
      if (!this.timerService) {
        throw new Error("TimerService를 찾을 수 없습니다.");
      }

      // 상태 관리자 콜백 설정
      this.stateManager.onTimerComplete = this.handleTimerComplete.bind(this);

      // 액션 등록
      this.setupActions();

      logger.success("🍅 TimerModule 초기화 완료 (리팩토링 v6.0)");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🕹️ 액션 매핑
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      start: this.startTimer,
      pause: this.pauseTimer,
      resume: this.resumeTimer,
      stop: this.stopTimer,
      refresh: this.refreshTimer,
      pomodoro1: this.startPomodoro1,
      pomodoro2: this.startPomodoro2,
      custom: this.showCustomSetup,
      reset: this.resetTimer,
      stats: this.showStats
    });
  }

  // ===== 📋 메뉴 액션 =====

  /**
   * 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    // 활성 타이머가 있으면 상태 표시
    if (this.stateManager.hasActiveTimer(userId)) {
      return this.refreshTimer(bot, callbackQuery);
    }

    return {
      type: "menu",
      data: {
        userName: getUserName(callbackQuery.from)
      }
    };
  }

  /**
   * 커스텀 타이머 설정
   */
  async showCustomSetup(bot, callbackQuery) {
    return {
      type: "custom_setup",
      data: {
        userName: getUserName(callbackQuery.from)
      }
    };
  }

  // ===== ⏱️ 타이머 액션 =====

  /**
   * 타이머 시작
   */
  async startTimer(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    // 기존 타이머 자동 정리
    await this.cleanupExistingSession(userId);

    // 타입과 시간 파싱
    let type = params;
    let duration;

    if (params?.includes(":")) {
      [type, duration] = params.split(":");
      duration = parseInt(duration, 10);
    } else {
      duration = this.getDefaultDuration(type);
    }

    if (!duration || duration <= 0) {
      return {
        type: "error",
        data: { message: "올바른 시간을 입력해주세요." }
      };
    }

    // DB에 세션 생성
    const result = await this.timerService.startSession(userId, {
      userName,
      type,
      duration
    });

    if (!result.success) {
      return {
        type: "error",
        data: { message: result.message }
      };
    }

    // 메모리에 타이머 생성
    this.stateManager.createTimer(userId, type, duration, result.data._id, {
      chatId: callbackQuery.message.chat.id,
      messageId: callbackQuery.message.message_id
    });

    return {
      type: "timer_started",
      data: {
        timer: this.stateManager.getTimerData(userId),
        message: `⏱️ ${this.stateManager.getTypeDisplay(type)} 타이머가 시작되었습니다!`
      }
    };
  }

  /**
   * 타이머 일시정지
   */
  async pauseTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    try {
      // const timer = 제거
      this.stateManager.pauseTimer(userId);
      await this.timerService.pauseSession(userId);

      return {
        type: "timer_paused",
        data: {
          timer: this.stateManager.getTimerData(userId),
          message: "⏸️ 타이머가 일시정지되었습니다."
        }
      };
    } catch (error) {
      return {
        type: "error",
        data: { message: error.message }
      };
    }
  }

  /**
   * 타이머 재개
   */
  async resumeTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    try {
      // const timer = 제거
      this.stateManager.resumeTimer(userId);
      await this.timerService.resumeSession(userId);

      return {
        type: "timer_resumed",
        data: {
          timer: this.stateManager.getTimerData(userId),
          message: "▶️ 타이머가 재개되었습니다."
        }
      };
    } catch (error) {
      return {
        type: "error",
        data: { message: error.message }
      };
    }
  }

  /**
   * 타이머 중지
   */
  async stopTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    try {
      const stoppedTimer = this.stateManager.stopTimer(userId);
      // const result = 제거
      await this.timerService.stopSession(userId);

      return {
        type: "timer_stopped",
        data: {
          completionRate: stoppedTimer.completionRate,
          actualDuration: stoppedTimer.actualDuration,
          message: `⏹️ 타이머를 중지했습니다. (완료율: ${stoppedTimer.completionRate}%)`
        }
      };
    } catch (error) {
      return {
        type: "no_timer",
        data: {
          message: "실행 중인 타이머가 없습니다.",
          suggestion: "새로운 타이머를 시작해보세요!"
        }
      };
    }
  }

  /**
   * 타이머 새로고침
   */
  async refreshTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const timerData = this.stateManager.getTimerData(userId);

    if (!timerData) {
      return {
        type: "no_timer",
        data: {
          message: "실행 중인 타이머가 없습니다.",
          suggestion: "새로운 타이머를 시작해보세요!"
        }
      };
    }

    return {
      type: "timer_status",
      data: {
        timer: timerData,
        isRefresh: true
      }
    };
  }

  /**
   * 타이머 초기화
   */
  async resetTimer(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 메모리 정리
      this.stateManager.cleanupTimer(userId);

      // DB 정리
      await this.timerService.forceStopAllSessions(userId);

      return {
        type: "success",
        data: {
          message: "✅ 타이머가 초기화되었습니다.",
          redirectTo: "menu"
        }
      };
    } catch (error) {
      logger.error("타이머 초기화 실패:", error);
      return {
        type: "error",
        data: { message: "타이머 초기화에 실패했습니다." }
      };
    }
  }

  // ===== 🍅 뽀모도로 액션 =====

  /**
   * 뽀모도로 1 시작
   */
  async startPomodoro1(bot, callbackQuery) {
    return this.startPomodoro(bot, callbackQuery, "pomodoro1");
  }

  /**
   * 뽀모도로 2 시작
   */
  async startPomodoro2(bot, callbackQuery) {
    return this.startPomodoro(bot, callbackQuery, "pomodoro2");
  }

  /**
   * 뽀모도로 시작 (공통)
   */
  async startPomodoro(bot, callbackQuery, presetKey) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    // 기존 세션 정리
    await this.cleanupExistingSession(userId);

    const preset = this.stateManager.presets[presetKey];
    if (!preset) {
      return {
        type: "error",
        data: { message: "잘못된 뽀모도로 프리셋입니다." }
      };
    }

    // DB에 뽀모도로 세션 생성
    const result = await this.timerService.startPomodoroSet(userId, {
      userName,
      preset: presetKey,
      focusDuration: preset.focus,
      shortBreak: preset.shortBreak,
      longBreak: preset.longBreak,
      cycles: preset.cycles
    });

    if (!result.success) {
      return {
        type: "error",
        data: { message: result.message }
      };
    }

    // 메모리에 타이머 생성
    const timer = this.stateManager.createTimer(
      userId,
      "focus",
      preset.focus,
      result.data._id,
      {
        isPomodoro: true,
        preset: presetKey,
        currentCycle: 1,
        totalCycles: preset.cycles,
        chatId: callbackQuery.message.chat.id,
        messageId: callbackQuery.message.message_id
      }
    );

    logger.debug(`🍅 뽀모도로 타이머 생성: ${timer.userId}`); // 로깅에 사용

    // ✅ return 문 추가 - timer 변수는 사용하지 않지만,
    // 나중에 필요할 수 있으므로 그대로 유지
    return {
      type: "pomodoro_started",
      data: {
        timer: this.stateManager.getTimerData(userId),
        preset: presetKey,
        message: `🍅 ${preset.name} 시작!`
      }
    };
  }

  // ===== 📊 통계 =====

  /**
   * 통계 표시
   */
  async showStats(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);

    const stats = await this.timerService.getUserStats(userId);

    return {
      type: "stats",
      data: {
        userName: getUserName(callbackQuery.from),
        stats: stats.data
      }
    };
  }

  // ===== 🔄 타이머 완료 처리 =====

  /**
   * 타이머 완료 핸들러 (StateManager에서 호출)
   */
  async handleTimerComplete(userId) {
    try {
      const timer = this.stateManager.completeTimer(userId);
      if (!timer) return;

      // DB 세션 완료 처리
      await this.timerService.completeSession(userId);

      // 뽀모도로인 경우 다음 세션으로 전환
      if (timer.isPomodoro) {
        await this.handlePomodoroTransition(userId, timer);
      } else {
        await this.notifyCompletion(timer);
      }
    } catch (error) {
      logger.error("타이머 완료 처리 실패:", error);
    }
  }

  /**
   * 뽀모도로 전환 처리
   */
  async handlePomodoroTransition(userId, completedTimer) {
    // 다음 세션 정보 계산
    const nextSession =
      this.stateManager.getNextPomodoroSession(completedTimer);

    if (!nextSession) {
      // 뽀모도로 세트 완료
      await this.notifyPomodoroSetCompletion(completedTimer);
      return;
    }

    // 다음 세션 시작
    const result = await this.timerService.startSession(userId, {
      userName: getUserName({ id: userId }),
      type: nextSession.type,
      duration: nextSession.duration,
      pomodoroInfo: {
        isPomodoro: true,
        preset: completedTimer.preset,
        currentCycle: nextSession.currentCycle,
        totalCycles: completedTimer.totalCycles
      }
    });

    if (result.success) {
      // 메모리에 새 타이머 생성
      this.stateManager.createTimer(
        userId,
        nextSession.type,
        nextSession.duration,
        result.data._id,
        {
          isPomodoro: true,
          preset: completedTimer.preset,
          currentCycle: nextSession.currentCycle,
          totalCycles: completedTimer.totalCycles,
          chatId: completedTimer.chatId,
          messageId: completedTimer.messageId
        }
      );

      // 전환 알림
      await this.notifyTransition(userId);
    }
  }

  // ===== 🔔 알림 =====

  /**
   * 타이머 완료 알림
   */
  async notifyCompletion(timer) {
    try {
      // 렌더러에게 완료 알림 요청
      const renderer = this.getRenderer();
      if (!renderer) return;

      const result = {
        type: "timer_completed",
        data: {
          type: timer.type,
          duration: timer.duration
        }
      };

      const ctx = this.createNotificationContext(timer);
      await renderer.render(result, ctx);
    } catch (error) {
      logger.error("완료 알림 실패:", error);
    }
  }

  /**
   * 뽀모도로 전환 알림
   */
  async notifyTransition(userId) {
    try {
      const timerData = this.stateManager.getTimerData(userId);
      if (!timerData) return;

      const renderer = this.getRenderer();
      if (!renderer) return;

      const result = {
        type: "timer_transition",
        data: {
          timer: timerData,
          message: `🔄 ${timerData.typeDisplay} 세션이 시작되었습니다!`
        }
      };

      const ctx = this.createNotificationContext(timerData);
      await renderer.render(result, ctx);
    } catch (error) {
      logger.error("전환 알림 실패:", error);
    }
  }

  /**
   * 뽀모도로 세트 완료 알림
   */
  async notifyPomodoroSetCompletion(timer) {
    try {
      const renderer = this.getRenderer();
      if (!renderer) return;

      const result = {
        type: "pomodoro_set_completed",
        data: {
          userName: getUserName({ id: timer.userId }),
          totalCycles: timer.totalCycles,
          preset: timer.preset
        }
      };

      const ctx = this.createNotificationContext(timer);
      await renderer.render(result, ctx);
    } catch (error) {
      logger.error("뽀모도로 완료 알림 실패:", error);
    }
  }

  // ===== 🛠️ 유틸리티 =====

  /**
   * 기존 세션 정리
   */
  async cleanupExistingSession(userId) {
    try {
      // 메모리 정리
      if (this.stateManager.hasActiveTimer(userId)) {
        this.stateManager.cleanupTimer(userId);
      }

      // DB 정리
      const existingSession = await this.timerService.findActiveSession(userId);
      if (existingSession) {
        await this.timerService.forceStopSession(userId);
      }
    } catch (error) {
      logger.warn("기존 세션 정리 실패:", error.message);
    }
  }

  /**
   * 기본 시간 가져오기
   */
  getDefaultDuration(type) {
    const durations = {
      focus: 25,
      shortBreak: 5,
      longBreak: 15
    };
    return durations[type] || 25;
  }

  /**
   * 렌더러 가져오기
   */
  getRenderer() {
    return this.moduleManager?.navigationHandler?.renderers?.get("timer");
  }

  /**
   * 알림용 ctx 생성
   */
  createNotificationContext(timer) {
    return {
      from: { id: timer.userId },
      chat: { id: timer.chatId },
      callbackQuery: {
        message: {
          message_id: timer.messageId,
          chat: { id: timer.chatId }
        }
      },
      editMessageText: async (text, options) => {
        try {
          return await this.bot.telegram.editMessageText(
            timer.chatId,
            timer.messageId,
            null,
            text,
            options
          );
        } catch (error) {
          if (!error.message?.includes("message is not modified")) {
            throw error;
          }
        }
      },
      answerCbQuery: async () => Promise.resolve()
    };
  }

  /**
   * 모듈 정리
   */
  async onCleanup() {
    try {
      this.stateManager.cleanup();
      logger.info("🧹 TimerModule 정리 완료");
    } catch (error) {
      logger.error("TimerModule 정리 실패:", error);
    }
  }
}

module.exports = TimerModule;
