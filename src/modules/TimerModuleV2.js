/**
 * ⏰ TimerModuleV2 - EventBus 기반 타이머 모듈
 * 
 * EventBus를 통한 완전한 이벤트 기반 아키텍처
 * - 뽀모도로 타이머 지원
 * - 일시정지/재개 기능
 * - 통계 및 히스토리 관리
 * - 실시간 상태 업데이트
 */

const { EVENTS } = require('../events/EventRegistry');
const logger = require('../utils/core/Logger');
const StateCleanupHelper = require('../utils/core/StateCleanupHelper');

class TimerModuleV2 {
  constructor(moduleName = 'timer', options = {}) {
    this.moduleName = moduleName;
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    this.timerService = null; // 선택적 서비스
    
    // 메모리 기반 타이머 상태 관리
    this.activeTimers = new Map(); // userId -> timer state
    this.userStates = new Map(); // userId -> user interaction state
    this.subscriptions = [];
    
    // 초기화 상태
    this.isInitialized = false;
    
    // 상태 정리 인터벌
    this.cleanupInterval = null;
    
    // 뽀모도로 프리셋 설정
    this.pomodoroPresets = {
      pomodoro1: {
        name: "기본 뽀모도로",
        focus: 25,
        shortBreak: 5,
        longBreak: 15,
        cycles: 4
      },
      pomodoro2: {
        name: "긴 뽀모도로",
        focus: 45,
        shortBreak: 10,
        longBreak: 30,
        cycles: 3
      }
    };
    
    // 타이머 타입별 기본 설정
    this.timerDefaults = {
      focus: { duration: 25, display: "집중" },
      shortBreak: { duration: 5, display: "짧은 휴식" },
      longBreak: { duration: 15, display: "긴 휴식" },
      custom: { duration: 30, display: "커스텀" }
    };

    logger.info('⏰ TimerModuleV2 생성됨 (EventBus 기반)');
  }

  /**
   * 🚀 모듈 초기화
   */
  async initialize() {
    try {
      // 서비스는 선택적으로 사용 (테스트 모드에서는 null 가능)
      if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
        try {
          this.timerService = await this.serviceBuilder?.getOrCreate?.('timer');
        } catch (error) {
          logger.warn('TimerService 로드 실패, 테스트 모드로 동작:', error.message);
        }
      }

      // EventBus 리스너 설정
      this.setupEventListeners();
      
      // 자동 상태 정리 설정
      this.cleanupInterval = StateCleanupHelper.setupAutoCleanup(
        this.userStates, 
        this.moduleName,
        {
          cleanupInterval: 60000, // 1분마다
          timeout: 300000,        // 5분 후 만료
          maxSize: 500           // 최대 500개 상태
        }
      );

      // 초기화 완료 표시
      this.isInitialized = true;

      logger.success('⏰ TimerModuleV2 초기화 완료 (테스트 모드, EventBus 기반)');
    } catch (error) {
      logger.error('TimerModuleV2 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 리스너 설정
   */
  setupEventListeners() {
    // 메뉴 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TIMER.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 타이머 제어 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TIMER.START_REQUEST, async (event) => {
        await this.handleStartRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.PAUSE_REQUEST, async (event) => {
        await this.handlePauseRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.RESUME_REQUEST, async (event) => {
        await this.handleResumeRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.STOP_REQUEST, async (event) => {
        await this.handleStopRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.RESET_REQUEST, async (event) => {
        await this.handleResetRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.REFRESH_REQUEST, async (event) => {
        await this.handleRefreshRequest(event);
      })
    );

    // 뽀모도로 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TIMER.POMODORO_START_REQUEST, async (event) => {
        await this.handlePomodoroStartRequest(event);
      })
    );

    // 커스텀 타이머 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TIMER.CUSTOM_SETUP_REQUEST, async (event) => {
        await this.handleCustomSetupRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.CUSTOM_START_REQUEST, async (event) => {
        await this.handleCustomStartRequest(event);
      })
    );

    // 통계 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TIMER.STATS_REQUEST, async (event) => {
        await this.handleStatsRequest(event);
      }),
      this.eventBus.subscribe(EVENTS.TIMER.HISTORY_REQUEST, async (event) => {
        await this.handleHistoryRequest(event);
      })
    );

    logger.debug('🎧 TimerModuleV2 EventBus 리스너 설정 완료');
  }

  /**
   * 🎯 콜백 처리 (레거시 호환) - ModuleManager에서 호출
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    
    // 레거시 콜백을 처리하는 맵
    const actionMap = {
      'menu': () => this.showMenu(userId, chatId),
      'start': () => this.handleTimerStart(userId, chatId, params),
      'pause': () => this.handleTimerPause(userId, chatId),
      'resume': () => this.handleTimerResume(userId, chatId),
      'stop': () => this.handleTimerStop(userId, chatId),
      'reset': () => this.handleTimerReset(userId, chatId),
      'refresh': () => this.handleTimerRefresh(userId, chatId),
      'pomodoro_start': () => this.handlePomodoroStart(userId, chatId, params),
      'pomodoro1': () => this.handlePomodoroPreset(userId, chatId, 'pomodoro1'),
      'pomodoro2': () => this.handlePomodoroPreset(userId, chatId, 'pomodoro2'),
      'pomodoro3': () => this.handlePomodoroPreset(userId, chatId, 'pomodoro3'),
      'custom_setup': () => this.handleCustomSetup(userId, chatId),
      'stats': () => this.showStats(userId, chatId)
    };
    
    const handler = actionMap[subAction];
    if (handler) {
      const result = await handler();
      // menu와 stats 액션은 렌더러용 결과를 반환
      if ((subAction === 'menu' || subAction === 'stats') && result) {
        return result;
      }
      return {
        type: subAction,
        module: 'timer',
        success: true
      };
    }
    
    logger.debug(`TimerModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 📋 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      // 활성 타이머가 있는지 확인
      const activeTimer = this.activeTimers.get(userId);
      
      if (activeTimer) {
        // 활성 타이머가 있으면 상태 정보와 함께 메뉴 전송
        this.eventBus.publish(EVENTS.TIMER.MENU_READY, {
          userId,
          chatId,
          menuData: {
            hasActiveTimer: true,
            timerData: this.getTimerDisplayData(activeTimer),
            pomodoroPresets: this.pomodoroPresets,
            timerDefaults: this.timerDefaults
          }
        });
      } else {
        // 활성 타이머가 없으면 기본 메뉴
        this.eventBus.publish(EVENTS.TIMER.MENU_READY, {
          userId,
          chatId,
          menuData: {
            hasActiveTimer: false,
            pomodoroPresets: this.pomodoroPresets,
            timerDefaults: this.timerDefaults
          }
        });
      }
    } catch (error) {
      logger.error('타이머 메뉴 요청 처리 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '메뉴를 불러올 수 없습니다.'
      });
    }
  }

  /**
   * 🟢 타이머 시작 요청 처리
   */
  async handleStartRequest(event) {
    try {
      const { userId, chatId, timerType, duration, customDuration } = event.payload;

      // 기존 타이머 정리
      await this.cleanupExistingTimer(userId);

      // 시간 결정
      let finalDuration;
      if (customDuration && customDuration > 0) {
        finalDuration = customDuration;
      } else if (duration && duration > 0) {
        finalDuration = duration;
      } else {
        finalDuration = this.timerDefaults[timerType]?.duration || 25;
      }

      // 타이머 생성 및 시작
      const timer = this.createTimer(userId, {
        type: timerType,
        duration: finalDuration,
        chatId,
        isPomodoro: false
      });

      // DB에 세션 저장 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.startSession(userId, {
            type: timerType,
            duration: finalDuration
          });
        } catch (error) {
          logger.warn('DB 세션 저장 실패 (계속 진행):', error.message);
        }
      }

      this.eventBus.publish(EVENTS.TIMER.STARTED, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        message: `⏱️ ${this.timerDefaults[timerType]?.display || '타이머'}가 시작되었습니다! (${finalDuration}분)`
      });

    } catch (error) {
      logger.error('타이머 시작 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '타이머 시작에 실패했습니다.'
      });
    }
  }

  /**
   * ⏸️ 타이머 일시정지 요청 처리
   */
  async handlePauseRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.status !== 'running') {
        throw new Error('실행 중인 타이머가 없습니다.');
      }

      // 타이머 일시정지
      timer.status = 'paused';
      timer.pausedAt = Date.now();
      
      // DB 업데이트 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.pauseSession(userId);
        } catch (error) {
          logger.warn('DB 세션 일시정지 실패 (계속 진행):', error.message);
        }
      }

      this.eventBus.publish(EVENTS.TIMER.PAUSED, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        message: '⏸️ 타이머가 일시정지되었습니다.'
      });

    } catch (error) {
      logger.error('타이머 일시정지 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: error.message
      });
    }
  }

  /**
   * ▶️ 타이머 재개 요청 처리
   */
  async handleResumeRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      const timer = this.activeTimers.get(userId);
      if (!timer || timer.status !== 'paused') {
        throw new Error('일시정지된 타이머가 없습니다.');
      }

      // 일시정지된 시간만큼 시작 시간 조정
      const pausedDuration = Date.now() - timer.pausedAt;
      timer.startedAt += pausedDuration;
      timer.status = 'running';
      delete timer.pausedAt;

      // DB 업데이트 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.resumeSession(userId);
        } catch (error) {
          logger.warn('DB 세션 재개 실패 (계속 진행):', error.message);
        }
      }

      this.eventBus.publish(EVENTS.TIMER.RESUMED, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        message: '▶️ 타이머가 재개되었습니다.'
      });

    } catch (error) {
      logger.error('타이머 재개 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: error.message
      });
    }
  }

  /**
   * ⏹️ 타이머 중지 요청 처리
   */
  async handleStopRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        throw new Error('실행 중인 타이머가 없습니다.');
      }

      // 완료율 계산
      const elapsed = this.calculateElapsed(timer);
      const completionRate = Math.round((elapsed / (timer.duration * 60 * 1000)) * 100);

      // 타이머 정리
      this.activeTimers.delete(userId);

      // DB 업데이트 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.stopSession(userId);
        } catch (error) {
          logger.warn('DB 세션 중지 실패 (계속 진행):', error.message);
        }
      }

      this.eventBus.publish(EVENTS.TIMER.STOPPED, {
        userId,
        chatId,
        stopData: {
          completionRate,
          elapsedTime: this.formatDuration(elapsed),
          message: `⏹️ 타이머를 중지했습니다. (완료율: ${completionRate}%)`
        }
      });

    } catch (error) {
      logger.error('타이머 중지 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: error.message
      });
    }
  }

  /**
   * 🔄 타이머 리셋 요청 처리
   */
  async handleResetRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      // 모든 타이머 정리
      await this.cleanupExistingTimer(userId);

      this.eventBus.publish(EVENTS.TIMER.RESET_COMPLETE, {
        userId,
        chatId,
        message: '✅ 타이머가 초기화되었습니다.'
      });

    } catch (error) {
      logger.error('타이머 리셋 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '타이머 초기화에 실패했습니다.'
      });
    }
  }

  /**
   * 🔄 타이머 상태 새로고침 요청 처리
   */
  async handleRefreshRequest(event) {
    try {
      const { userId, chatId } = event.payload;
      
      const timer = this.activeTimers.get(userId);
      if (!timer) {
        this.eventBus.publish(EVENTS.TIMER.MENU_READY, {
          userId,
          chatId,
          menuData: {
            hasActiveTimer: false,
            pomodoroPresets: this.pomodoroPresets,
            timerDefaults: this.timerDefaults
          }
        });
        return;
      }

      // 타이머 완료 체크
      if (this.isTimerCompleted(timer)) {
        await this.handleTimerCompletion(userId, timer);
        return;
      }

      this.eventBus.publish(EVENTS.TIMER.STATUS_UPDATE, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        isRefresh: true
      });

    } catch (error) {
      logger.error('타이머 새로고침 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '타이머 상태를 불러올 수 없습니다.'
      });
    }
  }

  /**
   * 🍅 뽀모도로 프리셋 선택 처리 (레거시 콜백용)
   */
  async handlePomodoroPreset(userId, chatId, presetKey) {
    try {
      const preset = this.pomodoroPresets[presetKey];
      if (!preset) {
        throw new Error('잘못된 뽀모도로 프리셋입니다.');
      }

      // 기존 타이머 정리
      await this.cleanupExistingTimer(userId);

      // 뽀모도로 타이머 생성
      const timer = this.createTimer(userId, {
        type: 'focus',
        duration: preset.focus,
        chatId,
        isPomodoro: true,
        pomodoroData: {
          preset: presetKey,
          currentCycle: 1,
          totalCycles: preset.cycles,
          currentPhase: 'focus'
        }
      });

      // DB에 세션 저장
      if (this.timerService) {
        try {
          await this.timerService.startPomodoroSet(userId, {
            preset: presetKey,
            focusDuration: preset.focus,
            shortBreakDuration: preset.shortBreak,
            longBreakDuration: preset.longBreak,
            totalCycles: preset.cycles
          });
        } catch (error) {
          logger.warn('뽀모도로 세트 DB 저장 실패:', error.message);
        }
      }

      this.activeTimers.set(userId, timer);
      this.startTimerTick(timer);

      return {
        type: 'pomodoro_started',
        module: 'timer',
        data: {
          preset: preset.name,
          timerData: this.getTimerDisplayData(timer)
        }
      };
    } catch (error) {
      logger.error('뽀모도로 프리셋 시작 실패:', error);
      return {
        type: 'error',
        module: 'timer',
        error: error.message
      };
    }
  }

  /**
   * 🟢 타이머 시작 (레거시 콜백용)
   */
  async handleTimerStart(userId, chatId, params) {
    this.eventBus.publish(EVENTS.TIMER.START_REQUEST, {
      userId,
      chatId,
      timerType: params?.[0] || 'focus',
      duration: params?.[1] ? parseInt(params[1]) : 25
    });
    return { success: true };
  }

  /**
   * ⏸️ 타이머 일시정지 (레거시 콜백용)
   */
  async handleTimerPause(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.PAUSE_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * ▶️ 타이머 재개 (레거시 콜백용)
   */
  async handleTimerResume(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.RESUME_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🛑 타이머 정지 (레거시 콜백용)
   */
  async handleTimerStop(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.STOP_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🔄 타이머 리셋 (레거시 콜백용)
   */
  async handleTimerReset(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.RESET_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🔄 타이머 새로고침 (레거시 콜백용)
   */
  async handleTimerRefresh(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.REFRESH_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🍅 뽀모도로 시작 (레거시 콜백용)
   */
  async handlePomodoroStart(userId, chatId, params) {
    const presetKey = params?.[0] || 'pomodoro1';
    this.eventBus.publish(EVENTS.TIMER.POMODORO_START_REQUEST, {
      userId,
      chatId,
      presetKey
    });
    return { success: true };
  }

  /**
   * ⚙️ 커스텀 설정 (레거시 콜백용)
   */
  async handleCustomSetup(userId, chatId) {
    this.eventBus.publish(EVENTS.TIMER.CUSTOM_SETUP_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🍅 뽀모도로 시작 요청 처리
   */
  async handlePomodoroStartRequest(event) {
    try {
      const { userId, chatId, presetKey } = event.payload;

      const preset = this.pomodoroPresets[presetKey];
      if (!preset) {
        throw new Error('잘못된 뽀모도로 프리셋입니다.');
      }

      // 기존 타이머 정리
      await this.cleanupExistingTimer(userId);

      // 뽀모도로 타이머 생성
      const timer = this.createTimer(userId, {
        type: 'focus',
        duration: preset.focus,
        chatId,
        isPomodoro: true,
        pomodoroData: {
          preset: presetKey,
          currentCycle: 1,
          totalCycles: preset.cycles,
          currentPhase: 'focus' // focus, shortBreak, longBreak
        }
      });

      // DB에 뽀모도로 세트 저장 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.startPomodoroSet(userId, {
            preset: presetKey,
            focusDuration: preset.focus,
            shortBreak: preset.shortBreak,
            longBreak: preset.longBreak,
            cycles: preset.cycles
          });
        } catch (error) {
          logger.warn('DB 뽀모도로 세트 저장 실패 (계속 진행):', error.message);
        }
      }

      this.eventBus.publish(EVENTS.TIMER.POMODORO_STARTED, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        pomodoroData: {
          presetName: preset.name,
          currentCycle: 1,
          totalCycles: preset.cycles,
          currentPhase: 'focus'
        },
        message: `🍅 ${preset.name} 시작! (1/${preset.cycles} 사이클)`
      });

    } catch (error) {
      logger.error('뽀모도로 시작 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: error.message
      });
    }
  }

  /**
   * ⚙️ 커스텀 타이머 설정 요청 처리
   */
  async handleCustomSetupRequest(event) {
    try {
      const { userId, chatId } = event.payload;

      this.eventBus.publish(EVENTS.TIMER.CUSTOM_SETUP_READY, {
        userId,
        chatId,
        setupData: {
          minDuration: 1,
          maxDuration: 180, // 3시간
          defaultDuration: 30,
          availableTypes: ['focus', 'break', 'work', 'study']
        }
      });

    } catch (error) {
      logger.error('커스텀 설정 요청 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '커스텀 설정을 불러올 수 없습니다.'
      });
    }
  }

  /**
   * 🔧 커스텀 타이머 시작 요청 처리
   */
  async handleCustomStartRequest(event) {
    try {
      const { userId, chatId, duration, label } = event.payload;

      if (!duration || duration < 1 || duration > 180) {
        throw new Error('시간은 1분에서 180분 사이로 설정해주세요.');
      }

      // 기존 타이머 정리
      await this.cleanupExistingTimer(userId);

      // 커스텀 타이머 생성
      const timer = this.createTimer(userId, {
        type: 'custom',
        duration: duration,
        chatId,
        isPomodoro: false,
        customLabel: label || '커스텀 타이머'
      });

      this.eventBus.publish(EVENTS.TIMER.STARTED, {
        userId,
        chatId,
        timerData: this.getTimerDisplayData(timer),
        message: `⏱️ ${label || '커스텀 타이머'}가 시작되었습니다! (${duration}분)`
      });

    } catch (error) {
      logger.error('커스텀 타이머 시작 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: error.message
      });
    }
  }

  /**
   * 📊 통계 요청 처리
   */
  async handleStatsRequest(event) {
    try {
      const { userId, chatId } = event.payload;

      let statsData = {};

      if (this.timerService) {
        try {
          // 실제 서비스에서 통계 가져오기
          const weeklyStats = await this.timerService.getWeeklyStats(userId);
          const recentSessions = await this.timerService.getRecentSessions(userId, 30);
          
          statsData = {
            weekly: weeklyStats.success ? weeklyStats.data : {},
            recent: recentSessions.success ? recentSessions.data : [],
            totalSessions: recentSessions.success ? recentSessions.data.length : 0
          };
        } catch (error) {
          logger.warn('실제 통계 조회 실패, 더미 데이터 사용:', error.message);
          statsData = this.getDummyStats();
        }
      } else {
        // 더미 데이터
        statsData = this.getDummyStats();
      }

      this.eventBus.publish(EVENTS.TIMER.STATS_READY, {
        userId,
        chatId,
        statsData
      });

    } catch (error) {
      logger.error('통계 요청 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '통계를 불러올 수 없습니다.'
      });
    }
  }

  /**
   * 📜 히스토리 요청 처리
   */
  async handleHistoryRequest(event) {
    try {
      const { userId, chatId, days = 7 } = event.payload;

      let historyData = {};

      if (this.timerService) {
        try {
          // 실제 서비스에서 히스토리 가져오기
          const response = await this.timerService.getRecentSessions(userId, days);
          historyData = {
            sessions: response.success ? response.data : [],
            days: days,
            isEmpty: !response.success || response.data.length === 0
          };
        } catch (error) {
          logger.warn('실제 히스토리 조회 실패, 더미 데이터 사용:', error.message);
          historyData = this.getDummyHistory(days);
        }
      } else {
        // 더미 데이터
        historyData = this.getDummyHistory(days);
      }

      this.eventBus.publish(EVENTS.TIMER.HISTORY_READY, {
        userId,
        chatId,
        historyData
      });

    } catch (error) {
      logger.error('히스토리 요청 실패:', error);
      this.eventBus.publish(EVENTS.TIMER.ERROR, {
        userId: event.payload.userId,
        chatId: event.payload.chatId,
        error: '히스토리를 불러올 수 없습니다.'
      });
    }
  }

  /**
   * 🏗️ 타이머 생성
   */
  createTimer(userId, config) {
    const timer = {
      userId,
      type: config.type,
      duration: config.duration, // 분 단위
      chatId: config.chatId,
      startedAt: Date.now(),
      status: 'running', // running, paused, completed
      isPomodoro: config.isPomodoro || false,
      customLabel: config.customLabel,
      pomodoroData: config.pomodoroData || null
    };

    this.activeTimers.set(userId, timer);
    return timer;
  }

  /**
   * 🏁 타이머 완료 체크
   */
  isTimerCompleted(timer) {
    const elapsed = this.calculateElapsed(timer);
    const totalDuration = timer.duration * 60 * 1000; // 밀리초로 변환
    return elapsed >= totalDuration;
  }

  /**
   * 🎉 타이머 완료 처리
   */
  async handleTimerCompletion(userId, timer) {
    try {
      // DB 세션 완료 처리 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.completeSession(userId);
        } catch (error) {
          logger.warn('DB 세션 완료 실패 (계속 진행):', error.message);
        }
      }

      if (timer.isPomodoro) {
        await this.handlePomodoroCompletion(userId, timer);
      } else {
        // 일반 타이머 완료
        this.activeTimers.delete(userId);
        
        this.eventBus.publish(EVENTS.TIMER.COMPLETED, {
          userId,
          chatId: timer.chatId,
          completionData: {
            type: timer.type,
            duration: timer.duration,
            completedAt: Date.now(),
            message: `🎉 ${timer.customLabel || this.timerDefaults[timer.type]?.display || '타이머'}가 완료되었습니다!`
          }
        });
      }

    } catch (error) {
      logger.error('타이머 완료 처리 실패:', error);
    }
  }

  /**
   * 🍅 뽀모도로 완료 처리
   */
  async handlePomodoroCompletion(userId, timer) {
    try {
      const { pomodoroData } = timer;
      const preset = this.pomodoroPresets[pomodoroData.preset];

      // 현재 사이클 완료 이벤트
      this.eventBus.publish(EVENTS.TIMER.POMODORO_CYCLE_COMPLETE, {
        userId,
        chatId: timer.chatId,
        cycleData: {
          completedPhase: pomodoroData.currentPhase,
          currentCycle: pomodoroData.currentCycle,
          totalCycles: pomodoroData.totalCycles
        }
      });

      // 다음 세션 결정
      let nextPhase = null;
      let nextDuration = 0;
      let nextCycle = pomodoroData.currentCycle;

      if (pomodoroData.currentPhase === 'focus') {
        // 집중 세션 완료 -> 휴식
        if (pomodoroData.currentCycle === pomodoroData.totalCycles) {
          // 마지막 사이클이면 긴 휴식
          nextPhase = 'longBreak';
          nextDuration = preset.longBreak;
        } else {
          // 일반 휴식
          nextPhase = 'shortBreak';
          nextDuration = preset.shortBreak;
        }
      } else {
        // 휴식 세션 완료
        if (pomodoroData.currentCycle < pomodoroData.totalCycles) {
          // 다음 사이클의 집중 세션
          nextPhase = 'focus';
          nextDuration = preset.focus;
          nextCycle += 1;
        }
      }

      if (nextPhase) {
        // 다음 세션 시작
        const nextTimer = this.createTimer(userId, {
          type: nextPhase,
          duration: nextDuration,
          chatId: timer.chatId,
          isPomodoro: true,
          pomodoroData: {
            preset: pomodoroData.preset,
            currentCycle: nextCycle,
            totalCycles: pomodoroData.totalCycles,
            currentPhase: nextPhase
          }
        });

        this.eventBus.publish(EVENTS.TIMER.POMODORO_TRANSITION, {
          userId,
          chatId: timer.chatId,
          transitionData: {
            fromPhase: pomodoroData.currentPhase,
            toPhase: nextPhase,
            currentCycle: nextCycle,
            totalCycles: pomodoroData.totalCycles,
            timerData: this.getTimerDisplayData(nextTimer)
          },
          message: `🔄 ${this.getPhaseDisplay(nextPhase)} 세션이 시작되었습니다! (${nextCycle}/${pomodoroData.totalCycles} 사이클)`
        });

      } else {
        // 뽀모도로 세트 완료
        this.activeTimers.delete(userId);
        
        this.eventBus.publish(EVENTS.TIMER.POMODORO_SET_COMPLETE, {
          userId,
          chatId: timer.chatId,
          completionData: {
            preset: pomodoroData.preset,
            presetName: preset.name,
            totalCycles: pomodoroData.totalCycles,
            completedAt: Date.now()
          },
          message: `🎊 ${preset.name} 세트 완료! 총 ${pomodoroData.totalCycles}사이클을 완주했습니다!`
        });
      }

    } catch (error) {
      logger.error('뽀모도로 완료 처리 실패:', error);
    }
  }

  /**
   * 📊 타이머 표시용 데이터 생성
   */
  getTimerDisplayData(timer) {
    const elapsed = this.calculateElapsed(timer);
    const totalDuration = timer.duration * 60 * 1000;
    const remaining = Math.max(0, totalDuration - elapsed);
    
    return {
      type: timer.type,
      typeDisplay: timer.customLabel || this.getPhaseDisplay(timer.type),
      duration: timer.duration,
      status: timer.status,
      statusDisplay: this.getStatusDisplay(timer.status),
      elapsed: Math.floor(elapsed / 1000), // 초 단위
      elapsedDisplay: this.formatDuration(elapsed),
      remaining: Math.floor(remaining / 1000), // 초 단위
      remainingDisplay: this.formatDuration(remaining),
      progress: Math.round((elapsed / totalDuration) * 100),
      isPomodoro: timer.isPomodoro,
      pomodoroData: timer.pomodoroData
    };
  }

  /**
   * ▶️ 타이머 틱 시작 (주기적 업데이트)
   */
  startTimerTick(timer) {
    // 기존 타이머가 있다면 정리
    if (timer.tickInterval) {
      clearInterval(timer.tickInterval);
    }

    // 1초마다 타이머 상태 체크
    timer.tickInterval = setInterval(() => {
      if (this.isTimerCompleted(timer)) {
        // 타이머 완료
        clearInterval(timer.tickInterval);
        this.handleTimerCompletion(timer.userId, timer);
      } else {
        // 진행 상황 업데이트 (필요시)
        // 여기에 실시간 진행률 업데이트 로직 추가 가능
      }
    }, 1000);

    logger.debug(`⏰ 타이머 틱 시작: ${timer.type} (${timer.duration}분)`);
  }

  /**
   * ⏹️ 타이머 틱 정지
   */
  stopTimerTick(timer) {
    if (timer.tickInterval) {
      clearInterval(timer.tickInterval);
      timer.tickInterval = null;
      logger.debug(`⏹️ 타이머 틱 정지: ${timer.type}`);
    }
  }

  /**
   * ⏰ 경과 시간 계산
   */
  calculateElapsed(timer) {
    let elapsed = Date.now() - timer.startedAt;
    
    // 일시정지 상태면 일시정지된 시점까지만 계산
    if (timer.status === 'paused' && timer.pausedAt) {
      elapsed = timer.pausedAt - timer.startedAt;
    }
    
    return Math.max(0, elapsed);
  }

  /**
   * 🕐 시간 포맷팅
   */
  formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * 🏷️ 페이즈 표시명 가져오기
   */
  getPhaseDisplay(phase) {
    const displays = {
      focus: '집중',
      shortBreak: '짧은 휴식',
      longBreak: '긴 휴식',
      custom: '커스텀'
    };
    return displays[phase] || phase;
  }

  /**
   * 📋 상태 표시명 가져오기
   */
  getStatusDisplay(status) {
    const displays = {
      running: '실행 중',
      paused: '일시정지',
      completed: '완료'
    };
    return displays[status] || status;
  }

  /**
   * 🧹 기존 타이머 정리
   */
  async cleanupExistingTimer(userId) {
    try {
      // 메모리에서 제거
      if (this.activeTimers.has(userId)) {
        this.activeTimers.delete(userId);
      }

      // DB 정리 (서비스 있을 때만)
      if (this.timerService) {
        try {
          await this.timerService.forceStopAllSessions(userId);
        } catch (error) {
          logger.warn('DB 세션 정리 실패 (계속 진행):', error.message);
        }
      }

    } catch (error) {
      logger.warn('타이머 정리 중 오류:', error.message);
    }
  }

  /**
   * 📊 더미 통계 데이터 생성
   */
  getDummyStats() {
    return {
      weekly: {
        totalSessions: 15,
        completedSessions: 12,
        totalMinutes: 350,
        averageCompletion: 80
      },
      recent: [],
      totalSessions: 0,
      byType: {
        focus: { count: 8, minutes: 200, completed: 6 },
        shortBreak: { count: 4, minutes: 20, completed: 4 },
        longBreak: { count: 3, minutes: 45, completed: 2 }
      },
      isDemo: true
    };
  }

  /**
   * 📜 더미 히스토리 데이터 생성
   */
  getDummyHistory(days) {
    return {
      sessions: [],
      days: days,
      isEmpty: true,
      isDemo: true
    };
  }

  /**
   * 완료된 타이머 정리 (1분마다 실행)
   */
  cleanupCompletedTimers() {
    for (const [userId, timer] of this.activeTimers.entries()) {
      if (this.isTimerCompleted(timer)) {
        this.handleTimerCompletion(userId, timer);
      }
    }
  }

  /**
   * 🏠 메뉴 표시 (V2 렌더러 방식)
   */
  async showMenu(userId, chatId) {
    try {
      // 활성 타이머가 있는지 확인
      const activeTimer = this.activeTimers.get(userId);
      const userName = "사용자"; // 기본 사용자명
      
      // 렌더러에게 전달할 데이터 구성
      return {
        type: 'menu',
        module: 'timer',
        success: true,
        data: {
          title: '⏰ *타이머 관리*',
          userName: userName,
          activeTimer: activeTimer ? this.getTimerDisplayData(activeTimer) : null,
          hasActiveTimer: !!activeTimer,
          recentSessions: [], // 최근 세션 정보 (향후 구현)
          presets: this.pomodoroPresets, // 전체 preset 객체 전달
          userId: userId
        }
      };

    } catch (error) {
      logger.error('⏰ TimerModuleV2.showMenu 실패:', error);
      return {
        type: 'error',
        module: 'timer',
        success: false,
        data: {
          message: '타이머 메뉴를 불러오는 중 오류가 발생했습니다.',
          canRetry: true
        }
      };
    }
  }

  /**
   * 📊 통계 표시 (V2 렌더러 방식)
   */
  async showStats(userId, chatId) {
    try {
      // 더미 통계 데이터 사용 (향후 실제 데이터로 교체)
      const stats = this.getDummyStats();
      
      return {
        type: 'stats',
        module: 'timer',
        success: true,
        data: {
          title: '📊 *타이머 통계*',
          stats: stats,
          userId: userId
        }
      };

    } catch (error) {
      logger.error('📊 TimerModuleV2.showStats 실패:', error);
      return {
        type: 'error',
        module: 'timer',
        success: false,
        data: {
          message: '통계를 불러오는 중 오류가 발생했습니다.',
          canRetry: true
        }
      };
    }
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      logger.info('🧹 TimerModuleV2 정리 시작...');

      // EventBus 구독 해제
      this.subscriptions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          logger.debug('구독 해제 실패:', error.message);
        }
      });
      this.subscriptions.length = 0;

      // StateCleanupHelper를 사용한 정리
      StateCleanupHelper.cleanup(this.cleanupInterval, this.userStates, this.moduleName);
      
      // 활성 타이머 정리
      this.activeTimers.clear();

      logger.success('✅ TimerModuleV2 정리 완료');
    } catch (error) {
      logger.error('TimerModuleV2 정리 실패:', error);
    }
  }
}

module.exports = TimerModuleV2;