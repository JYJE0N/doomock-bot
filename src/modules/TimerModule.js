// src/modules/TimerModule.js - 🍅 완전 리팩토링 v2.0

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🍅 TimerModule - 뽀모도로 타이머 (완전 표준 준수 + 실시간 UI)
 *
 * ✅ 표준 준수:
 * - BaseModule 상속 ✅
 * - 표준 매개변수 5개: (bot, callbackQuery, subAction, params, moduleManager) ✅
 * - registerActions() 사용 (Map 직접 조작 금지) ✅
 * - onInitialize/onHandleMessage 구현 ✅
 * - 순수 데이터만 반환 (UI는 렌더러가 담당) ✅
 * - SoC 완전 준수 ✅
 *
 * ✨ 새로운 기능:
 * - 실시간 시각적 피드백을 위한 풍부한 데이터
 * - 동기부여 시스템
 * - 메모리 누수 방지
 * - 향상된 에러 처리
 */
class TimerModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 🔧 서비스
    this.timerService = null;

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

    logger.info("🍅 TimerModule 생성됨 (표준 준수 + 실시간 UI)");
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

      logger.success("🍅 TimerModule 초기화 완료 - 표준 준수");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   * ✅ registerActions 사용 (직접 actionMap 할당 금지!)
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
        this.startLiveUpdateInterval(userId, bot);
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

      timer.liveUpdate = !timer.liveUpdate;
      timer.lastMessageId = callbackQuery.message.message_id;
      timer.chatId = callbackQuery.message.chat.id;

      if (timer.liveUpdate && !timer.isPaused) {
        this.startLiveUpdateInterval(userId, bot);
      } else {
        this.stopLiveUpdateInterval(userId);
      }

      logger.info(
        `🔄 실시간 업데이트 ${timer.liveUpdate ? "활성화" : "비활성화"}: ${userId}`
      );

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
        data: { message: "실시간 업데이트 설정에 실패했습니다." }
      };
    }
  }

  /**
   * 🔄 새로고침 (표준 매개변수)
   */
  async refreshStatus(bot, callbackQuery, subAction, params, moduleManager) {
    // showStatus와 동일한 로직
    return await this.showStatus(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  /**
   * 🔄 타이머 리셋 (표준 매개변수)
   */
  async resetTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 기존 타이머 완전 정리
      await this.cleanupUserTimer(userId);

      logger.info(`🔄 타이머 리셋: ${userId}`);

      return {
        type: "timer_reset",
        module: "timer",
        data: {
          message: "🔄 타이머가 리셋되었습니다.",
          suggestion: "새로운 타이머를 시작해보세요!"
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

  /**
   * ⚙️ 설정 메뉴 표시 (표준 매개변수)
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      return {
        type: "settings",
        module: "timer",
        data: {
          userId,
          userName,
          currentSettings: {
            focusDuration: this.config.focusDuration,
            shortBreak: this.config.shortBreak,
            longBreak: this.config.longBreak,
            enableLiveUpdates: this.config.enableLiveUpdates
          },
          limits: {
            minDuration: 1,
            maxDuration: this.config.maxCustomDuration
          }
        }
      };
    } catch (error) {
      logger.error("TimerModule.showSettings 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "설정을 불러올 수 없습니다." }
      };
    }
  }

  /**
   * ⚙️ 집중 시간 설정 (표준 매개변수)
   */
  async setFocusDuration(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const newDuration = parseInt(params);
      if (
        !newDuration ||
        newDuration < 1 ||
        newDuration > this.config.maxCustomDuration
      ) {
        return {
          type: "error",
          module: "timer",
          data: {
            message: `집중 시간은 1분 ~ ${this.config.maxCustomDuration}분 사이여야 합니다.`
          }
        };
      }

      this.config.focusDuration = newDuration;

      logger.info(`⚙️ 집중 시간 설정 변경: ${userId} - ${newDuration}분`);

      return {
        type: "setting_updated",
        module: "timer",
        data: {
          settingType: "focus",
          newValue: newDuration,
          message: `🍅 집중 시간이 ${newDuration}분으로 설정되었습니다.`
        }
      };
    } catch (error) {
      logger.error("TimerModule.setFocusDuration 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "설정 변경에 실패했습니다." }
      };
    }
  }

  /**
   * ⚙️ 휴식 시간 설정 (표준 매개변수)
   */
  async setBreakDuration(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const [breakType, duration] = params.split(":");
      const newDuration = parseInt(duration);

      if (!newDuration || newDuration < 1 || newDuration > 60) {
        return {
          type: "error",
          module: "timer",
          data: { message: "휴식 시간은 1분 ~ 60분 사이여야 합니다." }
        };
      }

      if (breakType === "short") {
        this.config.shortBreak = newDuration;
      } else if (breakType === "long") {
        this.config.longBreak = newDuration;
      } else {
        return {
          type: "error",
          module: "timer",
          data: { message: "잘못된 휴식 타입입니다." }
        };
      }

      logger.info(
        `⚙️ ${breakType} 휴식 시간 설정 변경: ${userId} - ${newDuration}분`
      );

      return {
        type: "setting_updated",
        module: "timer",
        data: {
          settingType: breakType,
          newValue: newDuration,
          message: `${breakType === "short" ? "☕ 짧은" : "🌴 긴"} 휴식 시간이 ${newDuration}분으로 설정되었습니다.`
        }
      };
    } catch (error) {
      logger.error("TimerModule.setBreakDuration 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: { message: "설정 변경에 실패했습니다." }
      };
    }
  }

  /**
   * 📊 통계 표시 (표준 매개변수)
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 서비스에서 통계 조회
      const statsResult = await this.timerService.getUserStats(userId, {
        startDate: this.getDateString(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ), // 30일 전
        endDate: this.getTodayDateString()
      });

      if (!statsResult.success) {
        return {
          type: "error",
          module: "timer",
          data: {
            message: "통계를 불러올 수 없습니다.",
            canRetry: true,
            action: "stats"
          }
        };
      }

      return {
        type: "stats",
        module: "timer",
        data: {
          userId,
          userName,
          stats: statsResult.data,
          period: "30일"
        }
      };
    } catch (error) {
      logger.error("TimerModule.showStats 오류:", error);
      return {
        type: "error",
        module: "timer",
        data: {
          message: "통계 조회 중 오류가 발생했습니다.",
          canRetry: true,
          action: "stats"
        }
      };
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 비즈니스 로직만!) =====
  /**
   * ❓ 도움말 표시 (표준 매개변수) - 수정된 버전
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
      data: {
        title: "🍅 뽀모도로 타이머 도움말",
        sections: [
          {
            title: "🎯 기본 기능",
            items: [
              "• 🍅 집중 타이머 (25분): 깊은 집중을 위한 기본 시간",
              "• ☕ 짧은 휴식 (5분): 잠깐의 재충전 시간",
              "• 🌴 긴 휴식 (15분): 충분한 쉼을 위한 시간",
              "• ⏸️ 일시정지/재개: 언제든 멈추고 다시 시작",
              "• 📊 실시간 진행률: 시각적 진행 상황 확인"
            ]
          },
          {
            title: "🚀 사용법",
            items: [
              "• 타이머 시작: 원하는 타입 선택 후 시작 버튼",
              "• 일시정지: ⏸️ 버튼으로 언제든 멈춤",
              "• 재개: ▶️ 버튼으로 다시 시작",
              "• 중지: ⏹️ 버튼으로 완전 종료",
              "• 상태 확인: 📊 상세 보기로 진행률 체크"
            ]
          },
          {
            title: "⚡ 고급 기능",
            items: [
              "• 🔄 실시간 업데이트: 5초마다 자동 새로고침",
              "• 📈 진행률 분석: 단계별 동기부여 메시지",
              "• 💬 스마트 격려: 진행 상황에 맞는 응원",
              "• 📊 통계 추적: 완료율 및 사용 패턴 분석"
            ]
          }
        ],
        tips: [
          "🎯 첫 번째 세션은 25분 집중으로 시작해보세요!",
          "☕ 짧은 휴식 후에는 바로 다음 집중 세션을 권장해요!",
          "🌴 4번의 집중 후에는 긴 휴식을 취하세요!",
          "🔄 실시간 업데이트를 켜면 더 몰입감 있는 경험을 할 수 있어요!",
          "📱 버튼 하나로 쉽게 조작할 수 있도록 설계되었어요!"
        ],
        config: this.config // 추가 설정 정보 (필요시 렌더러에서 활용)
      }
    };
  }

  /**
   * 🎯 타이머 타입별 시간 반환
   */
  getDurationByType(type) {
    // 미리 정의된 타입들 처리
    const predefinedDurations = {
      [this.constants.TIMER_TYPES.FOCUS]: this.config.focusDuration,
      [this.constants.TIMER_TYPES.SHORT]: this.config.shortBreak,
      [this.constants.TIMER_TYPES.LONG]: this.config.longBreak
    };

    // 미리 정의된 타입이 있으면 반환
    if (predefinedDurations[type]) {
      return predefinedDurations[type];
    }

    // 커스텀 시간 처리 (숫자인 경우)
    const customTime = parseInt(type);
    if (
      !isNaN(customTime) &&
      customTime > 0 &&
      customTime <= this.config.maxCustomDuration
    ) {
      return customTime;
    }

    return null;
  }

  /**
   * 🏗️ 타이머 객체 생성
   */
  createTimerObject(sessionId, type, duration) {
    const totalSeconds = duration * 60;

    return {
      sessionId,
      type,
      duration: totalSeconds,
      remainingTime: totalSeconds,
      startTime: Date.now(),
      isPaused: false,
      pausedAt: null,
      liveUpdate: false,
      lastMessageId: null,
      chatId: null
    };
  }

  /**
   * 📊 타이머 표시용 데이터 생성 (SoC 준수: 계산만!)
   */
  generateTimerDisplayData(timer) {
    const progress = Math.round(
      ((timer.duration - timer.remainingTime) / timer.duration) * 100
    );
    const elapsedTime = timer.duration - timer.remainingTime;

    return {
      // 기본 정보
      type: timer.type,
      remainingTime: timer.remainingTime,
      totalTime: timer.duration,
      isPaused: timer.isPaused,
      progress: progress,
      displayTime: this.formatTime(timer.remainingTime),

      // 🎨 렌더러가 활용할 계산된 데이터
      progressData: {
        percentage: progress,
        filledBlocks: Math.floor(progress / 5), // 20블록 기준 (5% 단위)
        emptyBlocks: 20 - Math.floor(progress / 5),
        stage: this.getTimerStage(progress),
        isEarly: progress < 33,
        isMiddle: progress >= 33 && progress < 67,
        isLate: progress >= 67,
        isAlmostDone: progress >= 80
      },

      // ⏰ 시간 정보 (계산만)
      timeData: {
        elapsed: {
          seconds: elapsedTime,
          minutes: Math.floor(elapsedTime / 60),
          remainingSeconds: elapsedTime % 60,
          formatted: this.formatTime(elapsedTime)
        },
        remaining: {
          seconds: timer.remainingTime,
          minutes: Math.floor(timer.remainingTime / 60),
          remainingSeconds: timer.remainingTime % 60,
          formatted: this.formatTime(timer.remainingTime)
        },
        total: {
          seconds: timer.duration,
          minutes: Math.floor(timer.duration / 60),
          remainingSeconds: timer.duration % 60,
          formatted: this.formatTime(timer.duration)
        }
      },

      // 📱 상태 정보
      statusData: {
        stage: this.getTimerStage(progress),
        canPause: !timer.isPaused,
        canResume: timer.isPaused,
        canStop: true,
        hasLiveUpdate: timer.liveUpdate,
        isRunning: !timer.isPaused
      }
    };
  }

  /**
   * 💬 동기부여 데이터 생성 (비즈니스 로직만!)
   */
  generateMotivationData(timer) {
    const progress = Math.round(
      ((timer.duration - timer.remainingTime) / timer.duration) * 100
    );
    const stage = this.getTimerStage(progress);

    return {
      timerType: timer.type,
      progress: progress,
      stage: stage,
      isPaused: timer.isPaused,
      isAlmostDone: progress >= 80,
      needsEncouragement: progress > 20 && progress < 80,
      // 🎨 렌더러가 메시지를 선택할 수 있는 키
      messageKey: `${timer.type}_${stage}_${timer.isPaused ? "paused" : "active"}`,
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
   * 🔄 실시간 업데이트 인터벌 시작
   */
  startLiveUpdateInterval(userId, bot) {
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

        // 🎯 간단한 해결책: 기존 메서드 활용!
        // renderStatus 대신 직접 텍스트 생성
        const progress = currentTimer.progress || 0;
        const remainingTime = this.formatTime(currentTimer.remainingTime || 0);
        const elapsedTime = this.formatTime(currentTimer.elapsedTime || 0);

        const progressBar =
          "█".repeat(Math.floor(progress / 5)) +
          "░".repeat(20 - Math.floor(progress / 5));

        const messageText = `▶️ *타이머 실행 중*

${progressBar} ${progress}%

⏱️ *경과시간*: ${elapsedTime}
⏰ *남은시간*: ${remainingTime}
🎯 *타입*: ${this.getTimerTypeDisplay(currentTimer.type)}

💪 계속 집중하세요\\!`;

        // 키보드는 간단하게
        const keyboard = [
          [
            { text: "⏸️ 일시정지", callback_data: "timer:pause" },
            { text: "⏹️ 중지", callback_data: "timer:stop" }
          ],
          [
            { text: "🔄 새로고침", callback_data: "timer:refresh" },
            { text: "⏹️ 실시간 끄기", callback_data: "timer:live" }
          ]
        ];

        // 텔레그램 메시지 업데이트
        if (currentTimer.chatId && currentTimer.lastMessageId) {
          await bot.editMessageText(messageText, {
            chat_id: currentTimer.chatId,
            message_id: currentTimer.lastMessageId,
            parse_mode: "MarkdownV2",
            reply_markup: { inline_keyboard: keyboard }
          });
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
      logger.error("타이머 완료 처리 오류:", error);
    }
  }

  /**
   * 🧹 사용자 타이머 정리
   */
  async cleanupUserTimer(userId) {
    this.stopTimerInterval(userId);
    this.stopLiveUpdateInterval(userId);
    this.activeTimers.delete(userId);
  }

  /**
   * 🧹 모듈 정리 (모든 리소스 해제)
   */
  async cleanup() {
    try {
      // 모든 사용자 타이머 정리
      for (const [userId] of this.activeTimers) {
        await this.cleanupUserTimer(userId);
      }

      // Map 초기화
      this.activeTimers.clear();
      this.timerIntervals.clear();
      this.liveUpdateIntervals.clear();

      logger.debug("🍅 TimerModule 정리 완료 - 모든 리소스 해제됨");
    } catch (error) {
      logger.error("TimerModule 정리 오류:", error);
    }
  }
}

module.exports = TimerModule;
