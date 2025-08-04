// src/modules/TimerModule.js - 🍅 SoC 준수 버전 v3.0

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 (SoC 완전 준수 버전)
 *
 * ✅ 개선사항:
 * - startLiveUpdateInterval에서 직접 UI 생성 제거
 * - 모든 UI 렌더링은 TimerRenderer에 위임
 * - MarkdownHelper를 통한 안전한 마크다운 처리
 * - 순수 데이터만 반환 (UI는 렌더러가 담당)
 * - SoC 완전 준수
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 🔧 서비스
    this.timerService = null;
    this.timerRenderer = null; // 렌더러 참조 추가

    // 📊 상태 관리 (메모리 기반)
    this.activeTimers = new Map(); // 활성 타이머들
    this.timerIntervals = new Map(); // 인터벌 관리
    this.liveUpdateIntervals = new Map(); // 실시간 업데이트 인터벌

    // ⚙️ 설정 (환경변수 기반)
    this.config = {
      focusDuration: parseInt(process.env.TIMER_FOCUS_DURATION) || 25, // 분
      shortBreak: parseInt(process.env.TIMER_SHORT_BREAK) || 5, // 분
      longBreak: parseInt(process.env.TIMER_LONG_BREAK) || 15, // 분
      updateInterval: parseInt(process.env.TIMER_UPDATE_INTERVAL) || 1000, // ms
      liveUpdateInterval:
        parseInt(process.env.TIMER_LIVE_UPDATE_INTERVAL) || 5000, // ms
      maxCustomDuration: parseInt(process.env.TIMER_MAX_CUSTOM) || 120, // 분
      enableLiveUpdates: process.env.TIMER_ENABLE_LIVE_UPDATES !== "false",
      ...options.config
    };

    // 📏 상수
    this.constants = {
      TIMER_TYPES: {
        FOCUS: "focus",
        SHORT: "short",
        LONG: "long",
        CUSTOM: "custom"
      },
      TIMER_STAGES: {
        EARLY: "early", // 0-33%
        MIDDLE: "middle", // 34-66%
        LATE: "late" // 67-100%
      },
      TIMER_STATUS: {
        RUNNING: "running",
        PAUSED: "paused",
        STOPPED: "stopped",
        COMPLETED: "completed"
      }
    };

    logger.info("🍅 TimerModule 생성됨 (SoC 준수 v3.0)");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // ServiceBuilder 검증
      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 설정되지 않았습니다");
      }

      // TimerService 가져오기
      this.timerService = await this.serviceBuilder.getOrCreate("timer");

      if (!this.timerService) {
        throw new Error("TimerService 생성에 실패했습니다");
      }

      logger.success("🍅 TimerModule 초기화 완료 - SoC 준수");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎨 렌더러 설정 (ModuleManager에서 호출)
   */
  setRenderer(renderer) {
    this.timerRenderer = renderer;
    logger.debug("🎨 TimerRenderer 연결됨");
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,
      help: this.showHelp,

      // 타이머 제어
      start: this.startTimer,
      pause: this.pauseTimer,
      resume: this.resumeTimer,
      stop: this.stopTimer,
      reset: this.resetTimer,

      // 상태 조회
      status: this.showStatus,
      stats: this.showStats,

      // 실시간 기능
      live: this.toggleLiveUpdate,
      refresh: this.refreshStatus,

      // 설정
      settings: this.showSettings,
      "settings:focus": this.setFocusDuration,
      "settings:break": this.setBreakDuration
    });

    logger.info(`🍅 TimerModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 📨 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const text = msg.text;
    if (!text) return false;

    const lowerText = text.toLowerCase();
    const timerKeywords = ["타이머", "timer", "포모도로", "pomodoro", "집중"];

    const hasTimerKeyword = timerKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (!hasTimerKeyword) return false;

    const _userId = getUserId(msg.from);
    const userName = getUserName(msg.from);

    logger.info(`🍅 타이머 키워드 감지: ${userName} - "${text}"`);
    return true; // 키워드 매칭됨을 알림
  }

  // ===== 🎯 표준 매개변수를 사용하는 액션 메서드들 =====
  // 표준: (bot, callbackQuery, subAction, params, moduleManager)

  /**
   * 🍅 메뉴 표시 (표준 매개변수)
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      const activeTimer = this.activeTimers.get(userId);

      return {
        type: "menu",
        module: "timer",
        data: {
          userId,
          userName,
          activeTimer: activeTimer
            ? this.generateTimerDisplayData(activeTimer)
            : null,
          config: {
            focusDuration: this.config.focusDuration,
            shortBreak: this.config.shortBreak,
            longBreak: this.config.longBreak,
            enableLiveUpdates: this.config.enableLiveUpdates
          },
          timerTypes: this.constants.TIMER_TYPES
        }
      };
    } catch (error) {
      logger.error("TimerModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: {
          message: "메뉴를 표시할 수 없습니다.",
          action: "menu",
          canRetry: true
        }
      };
    }
  }

  /**
   * ▶️ 타이머 시작 (표준 매개변수)
   */
  async startTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 기존 타이머가 있으면 정리
      if (this.activeTimers.has(userId)) {
        await this.cleanupUserTimer(userId);
      }

      // 타이머 타입 결정
      const timerType = params || this.constants.TIMER_TYPES.FOCUS;
      const duration = this.getDurationByType(timerType);

      if (!duration) {
        return {
          type: "error",
          module: "timer",
          data: { message: "잘못된 타이머 타입입니다." }
        };
      }

      // 서비스에 세션 저장
      const sessionResult = await this.timerService.startSession(userId, {
        type: timerType,
        duration,
        userName
      });

      if (!sessionResult.success) {
        return {
          type: "error",
          module: "timer",
          data: { message: sessionResult.message }
        };
      }

      // 메모리 타이머 생성
      const timer = this.createTimerObject(
        sessionResult.data._id,
        timerType,
        duration
      );

      // 콜백 쿼리 정보 저장 (실시간 업데이트용)
      timer.chatId = callbackQuery.message.chat.id;
      timer.lastMessageId = callbackQuery.message.message_id;

      this.activeTimers.set(userId, timer);

      // 인터벌 시작
      this.startTimerInterval(userId);

      logger.info(`▶️ 타이머 시작: ${userName} - ${timerType} (${duration}분)`);

      return {
        type: "timer_started",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          message: `🍅 ${duration}분 ${this.getTimerTypeDisplay(timerType)} 시작!`,
          motivationData: this.generateMotivationData(timer)
        }
      };
    } catch (error) {
      logger.error("TimerModule.startTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 시작에 실패했습니다." }
      };
    }
  }

  /**
   * ⏸️ 타이머 일시정지 (표준 매개변수)
   */
  async pauseTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer) {
        return {
          type: "error",
          module: "timer",
          data: { message: "실행 중인 타이머가 없습니다." }
        };
      }

      if (timer.isPaused) {
        return {
          type: "error",
          module: "timer",
          data: { message: "타이머가 이미 일시정지되어 있습니다." }
        };
      }

      // 타이머 일시정지
      this.stopTimerInterval(userId);
      this.stopLiveUpdateInterval(userId); // 실시간 업데이트 중지
      timer.isPaused = true;
      timer.pausedAt = Date.now();

      // 서비스에 상태 업데이트
      await this.timerService.pauseSession(timer.sessionId);

      logger.info(`⏸️ 타이머 일시정지: ${userId}`);

      return {
        type: "timer_paused",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          message: "⏸️ 타이머가 일시정지되었습니다.",
          motivationData: this.generateMotivationData(timer)
        }
      };
    } catch (error) {
      logger.error("TimerModule.pauseTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 일시정지에 실패했습니다." }
      };
    }
  }

  /**
   * ▶️ 타이머 재개 (표준 매개변수)
   */
  async resumeTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer || !timer.isPaused) {
        return {
          type: "error",
          module: "timer",
          data: { message: "일시정지된 타이머가 없습니다." }
        };
      }

      // 타이머 재개
      timer.isPaused = false;
      timer.pausedAt = null;
      this.startTimerInterval(userId); // 타이머 재시작

      // 실시간 상태 확인에 필요한 로직
      if (timer.liveUpdate && this.config.enableLiveUpdates) {
        this.startLiveUpdateInterval(userId, bot, moduleManager);
      }

      // 서비스에 상태 업데이트
      await this.timerService.resumeSession(timer.sessionId);

      logger.info(`▶️ 타이머 재개: ${userId}`);

      return {
        type: "timer_resumed",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          message: "▶️ 타이머가 재개되었습니다.",
          motivationData: this.generateMotivationData(timer)
        }
      };
    } catch (error) {
      logger.error("TimerModule.resumeTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 재개에 실패했습니다." }
      };
    }
  }

  /**
   * ⏹️ 타이머 중지 (표준 매개변수)
   */
  async stopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer) {
        return {
          type: "error",
          module: "timer",
          data: { message: "실행 중인 타이머가 없습니다." }
        };
      }

      const elapsedTime = timer.duration - timer.remainingTime;

      // 타이머 정리
      await this.cleanupUserTimer(userId);

      // 서비스에 세션 중지
      await this.timerService.stopSession(timer.sessionId);

      logger.info(
        `⏹️ 타이머 중지: ${userId} - 경과시간: ${this.formatTime(elapsedTime)}`
      );

      return {
        type: "timer_stopped",
        module: "timer",
        data: {
          message: "⏹️ 타이머가 중지되었습니다.",
          elapsedTime: this.formatTime(elapsedTime),
          completionRate: Math.round((elapsedTime / timer.duration) * 100)
        }
      };
    } catch (error) {
      logger.error("TimerModule.stopTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 중지에 실패했습니다." }
      };
    }
  }

  /**
   * 📊 타이머 상태 표시 (표준 매개변수)
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer) {
        return {
          type: "no_timer",
          module: "timer",
          data: {
            message: "실행 중인 타이머가 없습니다.",
            suggestion: "새로운 타이머를 시작해보세요!"
          }
        };
      }

      return {
        type: "timer_status",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          motivationData: this.generateMotivationData(timer),
          canEnableLiveUpdate: this.config.enableLiveUpdates
        }
      };
    } catch (error) {
      logger.error("TimerModule.showStatus 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "상태를 조회할 수 없습니다." }
      };
    }
  }

  /**
   * 🔄 실시간 업데이트 토글 (표준 매개변수)
   */
  async toggleLiveUpdate(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer) {
        return {
          type: "error",
          module: "timer",
          data: { message: "실행 중인 타이머가 없습니다." }
        };
      }

      if (!this.config.enableLiveUpdates) {
        return {
          type: "error",
          module: "timer",
          data: { message: "실시간 업데이트가 비활성화되어 있습니다." }
        };
      }

      // 토글
      timer.liveUpdate = !timer.liveUpdate;

      // 메시지 정보 업데이트
      timer.chatId = callbackQuery.message.chat.id;
      timer.lastMessageId = callbackQuery.message.message_id;

      if (timer.liveUpdate) {
        this.startLiveUpdateInterval(userId, bot, moduleManager);
        logger.info(`🔄 실시간 업데이트 시작: ${userId}`);
      } else {
        this.stopLiveUpdateInterval(userId);
        logger.info(`⏹️ 실시간 업데이트 중지: ${userId}`);
      }

      return {
        type: "live_update_toggled",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          enabled: timer.liveUpdate,
          message: timer.liveUpdate
            ? "🔄 실시간 업데이트가 활성화되었습니다!"
            : "⏹️ 실시간 업데이트가 비활성화되었습니다."
        }
      };
    } catch (error) {
      logger.error("TimerModule.toggleLiveUpdate 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "실시간 업데이트 전환에 실패했습니다." }
      };
    }
  }

  /**
   * 🔄 타이머 새로고침 (표준 매개변수)
   */
  async refreshStatus(bot, callbackQuery, subAction, params, moduleManager) {
    return this.showStatus(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  /**
   * ❓ 도움말 표시 (표준 매개변수)
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
      data: {
        title: "🍅 뽀모도로 타이머 도움말",
        sections: {
          basics: {
            title: "기본 사용법",
            content: [
              "• 집중(25분) → 짧은 휴식(5분) 반복",
              "• 4회 반복 후 긴 휴식(15분)",
              "• 언제든지 일시정지/재개 가능"
            ]
          },
          features: {
            title: "주요 기능",
            content: [
              "• 🔄 실시간 업데이트",
              "• 📊 진행률 시각화",
              "• 💬 동기부여 메시지",
              "• 📈 통계 및 기록"
            ]
          },
          tips: {
            title: "효과적인 사용법",
            content: [
              "• 집중 시간 동안 하나의 작업에만 집중",
              "• 휴식 시간에는 화면에서 벗어나기",
              "• 주변 정리 후 시작하기",
              "• 알림 끄고 방해 요소 제거"
            ]
          }
        }
      }
    };
  }

  // ===== 🛠️ 내부 헬퍼 메서드들 (비즈니스 로직) =====

  /**
   * 🏗️ 타이머 객체 생성
   */
  createTimerObject(sessionId, type, duration) {
    return {
      sessionId,
      type,
      duration: duration * 60, // 분 → 초
      remainingTime: duration * 60,
      elapsedTime: 0,
      progress: 0,
      startedAt: Date.now(),
      pausedAt: null,
      isPaused: false,
      liveUpdate: false,
      chatId: null,
      lastMessageId: null
    };
  }

  /**
   * 📊 타이머 디스플레이 데이터 생성 (렌더러용)
   */
  generateTimerDisplayData(timer) {
    const elapsedTime = timer.duration - timer.remainingTime;
    const progress = Math.round((elapsedTime / timer.duration) * 100);

    return {
      ...timer,
      elapsedTime,
      progress,
      stage: this.getTimerStage(progress),
      statusData: {
        isPaused: timer.isPaused,
        hasLiveUpdate: timer.liveUpdate,
        remainingFormatted: this.formatTime(timer.remainingTime),
        elapsedFormatted: this.formatTime(elapsedTime)
      }
    };
  }

  /**
   * 💬 동기부여 데이터 생성 (비즈니스 로직)
   */
  generateMotivationData(timer) {
    const progress = Math.round(
      ((timer.duration - timer.remainingTime) / timer.duration) * 100
    );
    const stage = this.getTimerStage(progress);

    return {
      timerType: timer.type,
      stage,
      progress,
      isPaused: timer.isPaused,
      statusKey: `${timer.type}_${stage}_${timer.isPaused ? "paused" : "active"}`,
      encouragementLevel:
        progress < 25 ? "gentle" : progress < 75 ? "strong" : "final_push"
    };
  }

  /**
   * 📈 타이머 단계 계산
   */
  getTimerStage(progress) {
    if (progress < 33) return this.constants.TIMER_STAGES.EARLY;
    if (progress < 67) return this.constants.TIMER_STAGES.MIDDLE;
    return this.constants.TIMER_STAGES.LATE;
  }

  /**
   * 🏷️ 타이머 타입 표시명 (비즈니스 로직)
   */
  getTimerTypeDisplay(type) {
    const displays = {
      focus: "🍅 집중 시간",
      short: "☕ 짧은 휴식",
      long: "🌴 긴 휴식"
    };
    return displays[type] || `🔹 ${type}`;
  }

  /**
   * ⏰ 시간 포맷팅 (초 → MM:SS)
   */
  formatTime(seconds) {
    if (!seconds || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * 🕐 타입별 시간 가져오기
   */
  getDurationByType(type) {
    const durations = {
      focus: this.config.focusDuration,
      short: this.config.shortBreak,
      long: this.config.longBreak
    };

    // 숫자로 들어온 경우 (커스텀)
    if (!isNaN(type)) {
      const customDuration = parseInt(type);
      return customDuration > 0 &&
        customDuration <= this.config.maxCustomDuration
        ? customDuration
        : null;
    }

    return durations[type] || null;
  }

  /**
   * ⚡ 타이머 인터벌 시작
   */
  startTimerInterval(userId) {
    this.stopTimerInterval(userId); // 기존 인터벌 정리

    const interval = setInterval(() => {
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.isPaused) return;

      timer.remainingTime--;

      // 타이머 완료 확인
      if (timer.remainingTime <= 0) {
        this.completeTimer(userId);
      }
    }, this.config.updateInterval);

    this.timerIntervals.set(userId, interval);
  }

  /**
   * 🛑 타이머 인터벌 중지
   */
  stopTimerInterval(userId) {
    const interval = this.timerIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(userId);
    }
  }

  /**
   * 🔄 실시간 업데이트 인터벌 시작 (개선된 버전)
   * SoC 준수: UI 생성을 렌더러에 위임
   */
  startLiveUpdateInterval(userId, bot, moduleManager) {
    // 기존 인터벌이 있으면 정리
    this.stopLiveUpdateInterval(userId);

    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    const liveInterval = setInterval(async () => {
      try {
        const currentTimer = this.activeTimers.get(userId);
        if (
          !currentTimer ||
          currentTimer.isPaused ||
          !currentTimer.liveUpdate
        ) {
          this.stopLiveUpdateInterval(userId);
          return;
        }

        // 🎯 SoC 준수: 렌더러와 MarkdownHelper 활용
        if (currentTimer.chatId && currentTimer.lastMessageId) {
          // 타이머 데이터 준비
          const timerData = this.generateTimerDisplayData(currentTimer);
          const motivationData = this.generateMotivationData(currentTimer);

          // 렌더러가 있으면 렌더러 사용, 없으면 기본 처리
          if (this.timerRenderer && this.timerRenderer.renderStatus) {
            // 렌더러에서 텍스트 생성
            const messageText = this.timerRenderer.renderStatus(
              { timer: timerData },
              motivationData
            );

            // 렌더러의 버튼 생성 메서드 활용
            const buttons =
              this.timerRenderer.buildActiveTimerButtons(timerData);
            const keyboard = this.timerRenderer.createInlineKeyboard(
              buttons,
              this.moduleName
            );

            // MarkdownHelper를 통한 안전한 메시지 전송
            if (moduleManager?.markdownHelper) {
              await moduleManager.markdownHelper.sendSafeMessage(
                {
                  telegram: bot,
                  callbackQuery: {
                    editMessageText: async (text, options) => {
                      await bot.editMessageText(text, {
                        chat_id: currentTimer.chatId,
                        message_id: currentTimer.lastMessageId,
                        ...options
                      });
                    }
                  }
                },
                messageText,
                { reply_markup: keyboard }
              );
            } else {
              // 폴백: 직접 전송 (마크다운 없이)
              await bot.editMessageText(this.stripMarkdown(messageText), {
                chat_id: currentTimer.chatId,
                message_id: currentTimer.lastMessageId,
                reply_markup: { inline_keyboard: keyboard.inline_keyboard }
              });
            }
          } else {
            // 렌더러 없을 때 기본 처리
            logger.warn("TimerRenderer를 찾을 수 없습니다. 기본 처리 진행.");
          }
        }
      } catch (error) {
        logger.warn(`실시간 업데이트 실패 (${userId}):`, error.message);
        const timer = this.activeTimers.get(userId);
        if (timer) {
          timer.liveUpdate = false;
        }
        this.stopLiveUpdateInterval(userId);
      }
    }, this.config.liveUpdateInterval);

    this.liveUpdateIntervals.set(userId, liveInterval);
  }

  /**
   * 🛑 실시간 업데이트 인터벌 중지
   */
  stopLiveUpdateInterval(userId) {
    const interval = this.liveUpdateIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.liveUpdateIntervals.delete(userId);
    }
  }

  /**
   * ✅ 타이머 완료 처리
   */
  async completeTimer(userId) {
    const timer = this.activeTimers.get(userId);
    if (!timer) return;

    try {
      // 타이머 정리
      await this.cleanupUserTimer(userId);

      // 서비스에 완료 처리
      await this.timerService.completeSession(timer.sessionId);

      logger.info(`✅ 타이머 완료: ${userId} - ${timer.type}`);

      // 🔔 완료 알림은 별도 시스템에서 처리 (SoC)
      // 여기서는 로깅만!
    } catch (error) {
      logger.error(`타이머 완료 처리 실패 (${userId}):`, error);
    }
  }

  /**
   * 🧹 사용자 타이머 정리
   */
  async cleanupUserTimer(userId) {
    try {
      // 모든 인터벌 정리
      this.stopTimerInterval(userId);
      this.stopLiveUpdateInterval(userId);

      // 타이머 제거
      this.activeTimers.delete(userId);

      logger.debug(`🧹 타이머 정리 완료: ${userId}`);
    } catch (error) {
      logger.error(`타이머 정리 실패 (${userId}):`, error);
    }
  }

  /**
   * 🧹 마크다운 제거 헬퍼 (폴백용)
   */
  stripMarkdown(text) {
    return text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/__/g, "")
      .replace(/_/g, "")
      .replace(/`/g, "")
      .replace(/~/g, "")
      .replace(/\|\|/g, "")
      .replace(/\\/g, "");
  }

  /**
   * 📊 통계 표시 (표준 매개변수)
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const stats = await this.timerService.getUserStats(userId);

      if (!stats.success || !stats.data) {
        return {
          type: "error",
          module: "timer",
          data: { message: "통계를 불러올 수 없습니다." }
        };
      }

      return {
        type: "stats",
        module: "timer",
        data: {
          stats: stats.data,
          userName: getUserName(callbackQuery.from)
        }
      };
    } catch (error) {
      logger.error("TimerModule.showStats 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "통계 조회에 실패했습니다." }
      };
    }
  }

  /**
   * ⚙️ 설정 표시 (표준 매개변수)
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "settings",
      module: "timer",
      data: {
        currentSettings: {
          focusDuration: this.config.focusDuration,
          shortBreak: this.config.shortBreak,
          longBreak: this.config.longBreak,
          enableLiveUpdates: this.config.enableLiveUpdates
        }
      }
    };
  }

  /**
   * 🎯 포커스 시간 설정 (표준 매개변수)
   */
  async setFocusDuration(bot, callbackQuery, subAction, params, moduleManager) {
    // 구현 예정
    return {
      type: "info",
      module: "timer",
      data: { message: "설정 기능은 곧 추가될 예정입니다." }
    };
  }

  /**
   * ☕ 휴식 시간 설정 (표준 매개변수)
   */
  async setBreakDuration(bot, callbackQuery, subAction, params, moduleManager) {
    // 구현 예정
    return {
      type: "info",
      module: "timer",
      data: { message: "설정 기능은 곧 추가될 예정입니다." }
    };
  }

  /**
   * 🔄 타이머 리셋 (표준 매개변수)
   */
  async resetTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const timer = this.activeTimers.get(userId);

    try {
      if (!timer) {
        return {
          type: "error",
          module: "timer",
          data: { message: "리셋할 타이머가 없습니다." }
        };
      }

      // 타이머 리셋
      timer.remainingTime = timer.duration;
      timer.elapsedTime = 0;
      timer.progress = 0;
      timer.startedAt = Date.now();
      timer.isPaused = false;
      timer.pausedAt = null;

      // 인터벌 재시작
      this.startTimerInterval(userId);

      return {
        type: "timer_reset",
        module: "timer",
        data: {
          timer: this.generateTimerDisplayData(timer),
          message: "🔄 타이머가 리셋되었습니다!",
          motivationData: this.generateMotivationData(timer)
        }
      };
    } catch (error) {
      logger.error("TimerModule.resetTimer 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "타이머 리셋에 실패했습니다." }
      };
    }
  }
}

module.exports = TimerModule;
