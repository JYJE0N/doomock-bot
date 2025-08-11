/**
 * 🏖️ LeaveModuleV2 - EventBus 기반 연차 관리 모듈
 * 완전한 이벤트 기반 아키텍처로 구현된 연차 관리 모듈
 */

const { EVENTS } = require("../events/index");
const logger = require("../utils/core/Logger");
const Utils = require("../utils");

class LeaveModuleV2 {
  constructor(moduleName = "leave", options = {}) {
    this.moduleName = moduleName;
    this.serviceBuilder = options.serviceBuilder || null;
    
    // EventBus는 ModuleManager에서 주입받거나 글로벌 인스턴스 사용
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    
    // 서비스 인스턴스
    this.leaveService = null;
    
    // 초기화 상태
    this.isInitialized = false;
    
    // 모듈 설정
    this.config = {
      maxLeavePerDay: 1,
      maxContinuousDays: parseInt(process.env.LEAVE_MAX_CONTINUOUS_DAYS) || 10,
      allowedIncrements: [0.25, 0.5, 0.75, 1],
      inputTimeout: 60000,
      ...options.config
    };

    // 모듈 상수
    this.constants = {
      LEAVE_TYPES: {
        QUARTER: "quarter",
        HALF: "half", 
        FULL: "full",
        CUSTOM: "custom"
      },
      LEAVE_AMOUNTS: {
        quarter: 0.25,
        half: 0.5,
        full: 1.0
      },
      INPUT_STATES: {
        WAITING_CUSTOM_AMOUNT: "waiting_custom_amount",
        WAITING_JOIN_DATE_INPUT: "waiting_join_date_input"
      },
      SETTINGS_ACTIONS: {
        ADD: "add",
        REMOVE: "remove", 
        JOIN_DATE: "joindate"
      }
    };

    // 사용자 입력 상태 관리 (메모리 캐시)
    this.userInputStates = new Map();
    
    // 이벤트 구독 관리
    this.subscriptions = [];
    
    // 자동 정리 인터벌 (5분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredInputStates();
    }, 300000);

    logger.info("🏖️ LeaveModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 LeaveService 가져오기
      if (this.serviceBuilder) {
        this.leaveService = await this.serviceBuilder.getOrCreate("leave");
      }

      if (!this.leaveService) {
        throw new Error("LeaveService 생성에 실패했습니다");
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기화 완료 표시
      this.isInitialized = true;
      
      logger.success("🏖️ LeaveModuleV2 초기화 완료 (EventBus 기반)");
      return true;
    } catch (error) {
      logger.error("❌ LeaveModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 메뉴 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 월별 현황 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.MONTHLY_REQUEST, async (event) => {
        await this.handleMonthlyRequest(event);
      })
    );

    // 연차 사용 폼 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.USE_FORM_REQUEST, async (event) => {
        await this.handleUseFormRequest(event);
      })
    );

    // 연차 사용 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.USE_REQUEST, async (event) => {
        await this.handleUseRequest(event);
      })
    );

    // 사용자 정의 입력 시작
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.CUSTOM_INPUT_START, async (event) => {
        await this.handleCustomInputStart(event);
      })
    );

    // 사용자 정의 입력 수신
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.CUSTOM_INPUT_RECEIVED, async (event) => {
        await this.handleCustomInputReceived(event);
      })
    );

    // 설정 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.SETTINGS_REQUEST, async (event) => {
        await this.handleSettingsRequest(event);
      })
    );

    // 입사일 설정
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.JOIN_DATE_SET, async (event) => {
        await this.handleJoinDateSet(event);
      })
    );

    // 잔여 연차 조회
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.BALANCE_REQUEST, async (event) => {
        await this.handleBalanceRequest(event);
      })
    );

    // 사용 히스토리 조회
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.LEAVE.HISTORY_REQUEST, async (event) => {
        await this.handleHistoryRequest(event);
      })
    );

    // 사용자 메시지 처리 (직접 입력 감지)
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.USER.MESSAGE, async (event) => {
        await this.handleUserMessage(event);
      })
    );

    logger.debug("🎧 LeaveModuleV2 EventBus 리스너 설정 완료");
  }

  /**
   * 🎯 ModuleManager 호환 이벤트 핸들러
   */
  async handleEvent(eventName, event) {
    try {
      switch (eventName) {
        case EVENTS.USER.CALLBACK:
          await this.handleCallback(event);
          break;
        case EVENTS.USER.MESSAGE:
          await this.handleUserMessage(event);
          break;
        default:
          // 다른 이벤트는 개별 리스너에서 처리
          break;
      }
    } catch (error) {
      logger.error(`🏖️ LeaveModuleV2 이벤트 처리 오류: ${eventName}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🎯 콜백 처리 (레거시 호환) - ModuleManager에서 호출
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    
    // 디버그 로그 추가
    logger.debug(`LeaveModuleV2.handleCallback 호출됨:`, {
      subAction,
      params,
      hasLeaveService: !!this.leaveService,
      isInitialized: this.isInitialized,
      hasServiceBuilder: !!this.serviceBuilder
    });
    
    // LeaveService 확인
    if (!this.leaveService) {
      logger.error('LeaveService가 초기화되지 않음. 재시도...');
      if (this.serviceBuilder) {
        this.leaveService = await this.serviceBuilder.getOrCreate("leave");
      }
      if (!this.leaveService) {
        throw new Error('LeaveService를 초기화할 수 없습니다');
      }
    }
    
    // 레거시 콜백을 처리하는 맵
    const actionMap = {
      'menu': () => this.showMenu(userId, chatId),
      'monthly': () => this.publishMonthlyRequest(userId, chatId, params[0]),
      'use': () => this.publishUseFormRequest(userId, chatId),
      'add': () => this.publishUseRequest(userId, chatId, params[0], params[1]),
      'custom': () => this.publishCustomInputStart(userId, chatId),
      'settings': () => this.publishSettingsRequest(userId, chatId),
      'joindate': () => this.handleJoinDateStart(userId, chatId),
      'config': () => this.publishSettingsRequest(userId, chatId),
      'balance': () => this.publishBalanceRequest(userId, chatId),
      'history': () => this.publishHistoryRequest(userId, chatId)
    };
    
    const handler = actionMap[subAction];
    if (handler) {
      const result = await handler();
      // menu 액션은 렌더러용 결과를 반환
      if (subAction === 'menu' && result) {
        return result;
      }
      return {
        type: subAction,
        module: 'leave',
        success: true
      };
    }
    
    logger.debug(`LeaveModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 🏠 메뉴 표시 (V2 렌더러 방식)
   */
  /**
   * 📅 입사일 설정 시작 (레거시 콜백용)
   */
  async handleJoinDateStart(userId, chatId) {
    // 입력 상태 설정
    this.setUserInputState(userId, {
      state: this.constants.INPUT_STATES.WAITING_JOIN_DATE_INPUT,
      chatId,
      startTime: Date.now()
    });

    await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
      chatId,
      text: '📅 입사일을 입력하세요 (형식: YYYY-MM-DD)\n예: 2023-01-15',
      options: {
        reply_markup: this.createCancelKeyboard(),
        parse_mode: 'Markdown'
      }
    });

    return { success: true };
  }

  /**
   * 💰 잔여 연차 조회 (레거시 콜백용)
   */
  async publishBalanceRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.LEAVE.BALANCE_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📜 휴가 히스토리 조회 (레거시 콜백용)
   */
  async publishHistoryRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.LEAVE.HISTORY_REQUEST, {
      userId,
      chatId,
      limit: 10
    });
    return { success: true };
  }

  async showMenu(userId, chatId) {
    try {
      const currentYear = new Date().getFullYear();
      const totalLeave = 15; // 기본 연차
      const usedLeave = 0;   // 사용한 연차 (실제로는 DB에서 조회)
      const remainingLeave = totalLeave - usedLeave;
      const workYears = 1;   // 근무 년수 (실제로는 입사일 기준 계산)

      // 렌더러에게 전달할 데이터 구성  
      return {
        type: 'menu',
        module: 'leave',
        success: true,
        data: {
          title: '🏖️ *휴가 관리*',
          totalLeave: totalLeave,
          usedLeave: usedLeave,
          remainingLeave: remainingLeave,
          currentYear: currentYear,
          joinDate: null, // 입사일 정보 (실제로는 DB에서 조회)
          workYears: workYears,
          // 호환성을 위해 기존 필드들도 유지
          totalDays: totalLeave,
          usedDays: usedLeave,
          remainingDays: remainingLeave,
          userId: userId
        }
      };

    } catch (error) {
      logger.error('🏖️ LeaveModuleV2.showMenu 실패:', error);
      return {
        type: 'error',
        module: 'leave',
        success: false,
        data: {
          message: '휴가 메뉴를 불러오는 중 오류가 발생했습니다.',
          canRetry: true
        }
      };
    }
  }

  /**
   * 🎯 이벤트 기반 콜백 처리 (구 handleCallback)
   */
  async handleCallbackEvent(event) {
    const { data, userId, chatId } = event.payload;
    const [module, action, ...params] = data.split(':');
    
    if (module !== 'leave') return;

    try {
      switch (action) {
        case 'menu':
          await this.publishMenuRequest(userId, chatId);
          break;
        case 'monthly':
          await this.publishMonthlyRequest(userId, chatId, params[0]);
          break;
        case 'use':
          await this.publishUseFormRequest(userId, chatId);
          break;
        case 'add':
          await this.publishUseRequest(userId, chatId, params[0], params[1]);
          break;
        case 'custom':
          await this.publishCustomInputStart(userId, chatId);
          break;
        case 'settings':
          await this.publishSettingsRequest(userId, chatId);
          break;
        default:
          logger.debug(`🏖️ 알 수 없는 액션: ${action}`);
      }
    } catch (error) {
      logger.error(`🏖️ 콜백 처리 오류: ${action}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📝 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 현재 잔여 연차 조회
      const balanceResult = await this.leaveService.getBalance(userId);
      
      if (!balanceResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: balanceResult.message || "연차 정보를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.MENU_READY, {
        userId,
        chatId,
        balance: balanceResult.data,
        config: this.config
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatMenu(balanceResult.data),
        options: {
          reply_markup: this.createMenuKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📝 메뉴 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📅 월별 현황 요청 처리
   */
  async handleMonthlyRequest(event) {
    const { userId, chatId, year, month } = event.payload;

    try {
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;

      // 월별 사용 내역 조회
      const historyResult = await this.leaveService.getMonthlyHistory(userId, targetYear, targetMonth);
      
      if (!historyResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: historyResult.message || "월별 현황을 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.MONTHLY_READY, {
        userId,
        chatId,
        year: targetYear,
        month: targetMonth,
        history: historyResult.data
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatMonthlyView(historyResult.data, targetYear, targetMonth),
        options: {
          reply_markup: this.createMonthlyKeyboard(targetYear, targetMonth),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📅 월별 현황 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📝 연차 사용 폼 요청 처리
   */
  async handleUseFormRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 잔여 연차 확인
      const balanceResult = await this.leaveService.getBalance(userId);
      
      if (!balanceResult.success) {
        await this.eventBus.publish(EVENTS.LEAVE.USE_ERROR, {
          userId,
          chatId,
          error: "연차 정보를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.USE_FORM_READY, {
        userId,
        chatId,
        balance: balanceResult.data
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatUseForm(balanceResult.data),
        options: {
          reply_markup: this.createUseFormKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📝 연차 사용 폼 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ✅ 연차 사용 요청 처리
   */
  async handleUseRequest(event) {
    const { userId, chatId, leaveType, customAmount } = event.payload;

    try {
      // 사용할 연차량 결정
      let amount = customAmount;
      if (!amount) {
        amount = this.constants.LEAVE_AMOUNTS[leaveType];
      }

      if (!amount || amount <= 0) {
        await this.eventBus.publish(EVENTS.LEAVE.USE_ERROR, {
          userId,
          chatId,
          error: "유효하지 않은 연차량입니다."
        });
        return;
      }

      // 연차 사용 처리
      const useResult = await this.leaveService.useLeave(userId, amount);
      
      if (!useResult.success) {
        await this.eventBus.publish(EVENTS.LEAVE.USE_ERROR, {
          userId,
          chatId,
          error: useResult.message || "연차 사용 처리에 실패했습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.USED, {
        userId,
        chatId,
        amount,
        leaveType,
        remaining: useResult.data.remaining,
        record: useResult.data.record
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatUseSuccess(useResult.data, amount),
        options: {
          reply_markup: this.createAfterUseKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('✅ 연차 사용 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ⌨️ 사용자 정의 입력 시작 처리
   */
  async handleCustomInputStart(event) {
    const { userId, chatId } = event.payload;

    try {
      // 입력 상태 설정
      this.setUserInputState(userId, {
        state: this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT,
        chatId,
        startTime: Date.now()
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatCustomInputPrompt(),
        options: {
          reply_markup: this.createCancelKeyboard(),
          parse_mode: 'Markdown'
        }
      });

      // 타임아웃 설정
      setTimeout(() => {
        const currentState = this.getUserInputState(userId);
        if (currentState && currentState.state === this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT) {
          this.clearUserInputState(userId);
          this.eventBus.publish(EVENTS.LEAVE.CUSTOM_INPUT_TIMEOUT, { userId, chatId });
        }
      }, this.config.inputTimeout);

    } catch (error) {
      logger.error('⌨️ 사용자 정의 입력 시작 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📥 사용자 정의 입력 수신 처리
   */
  async handleCustomInputReceived(event) {
    const { userId, chatId, text } = event.payload;

    try {
      const inputState = this.getUserInputState(userId);
      if (!inputState) return;

      if (inputState.state === this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT) {
        const amount = parseFloat(text);
        
        if (isNaN(amount) || amount <= 0 || amount > this.config.maxLeavePerDay) {
          await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
            chatId,
            text: `❌ 유효하지 않은 값입니다. 0보다 크고 ${this.config.maxLeavePerDay}보다 작은 숫자를 입력하세요.`,
            options: { parse_mode: 'Markdown' }
          });
          return;
        }

        // 입력 상태 정리
        this.clearUserInputState(userId);

        // 연차 사용 요청 발행
        await this.eventBus.publish(EVENTS.LEAVE.USE_REQUEST, {
          userId,
          chatId,
          leaveType: 'custom',
          customAmount: amount
        });
      } else if (inputState.state === this.constants.INPUT_STATES.WAITING_JOIN_DATE_INPUT) {
        // 날짜 형식 검증 (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(text)) {
          await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
            chatId,
            text: '❌ 올바른 날짜 형식이 아닙니다. YYYY-MM-DD 형식으로 입력하세요.\n예: 2023-01-15',
            options: { parse_mode: 'Markdown' }
          });
          return;
        }

        // 날짜 유효성 검증
        const inputDate = new Date(text);
        if (isNaN(inputDate.getTime())) {
          await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
            chatId,
            text: '❌ 유효하지 않은 날짜입니다. 다시 입력하세요.',
            options: { parse_mode: 'Markdown' }
          });
          return;
        }

        // 입력 상태 정리
        this.clearUserInputState(userId);

        // 입사일 설정 요청 발행
        await this.eventBus.publish(EVENTS.LEAVE.JOIN_DATE_SET, {
          userId,
          chatId,
          joinDate: text
        });
      }

    } catch (error) {
      logger.error('📥 사용자 정의 입력 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ⚙️ 설정 요청 처리
   */
  async handleSettingsRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 사용자 설정 조회
      const settingsResult = await this.leaveService.getUserSettings(userId);
      
      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.SETTINGS_READY, {
        userId,
        chatId,
        settings: settingsResult.success ? settingsResult.data : {}
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatSettings(settingsResult.success ? settingsResult.data : {}),
        options: {
          reply_markup: this.createSettingsKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('⚙️ 설정 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📅 입사일 설정 처리
   */
  async handleJoinDateSet(event) {
    const { userId, chatId, joinDate } = event.payload;

    try {
      // 입사일 업데이트
      const updateResult = await this.leaveService.setJoinDate(userId, joinDate);
      
      if (!updateResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: updateResult.message || "입사일 설정에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: `✅ 입사일이 *${joinDate}*로 설정되었습니다.`,
        options: {
          reply_markup: this.createAfterSetKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📅 입사일 설정 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 💰 잔여 연차 조회 처리
   */
  async handleBalanceRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const balanceResult = await this.leaveService.getBalance(userId);
      
      if (!balanceResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: balanceResult.message || "연차 정보를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.BALANCE_READY, {
        userId,
        chatId,
        balance: balanceResult.data
      });

    } catch (error) {
      logger.error('💰 잔여 연차 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📋 사용 히스토리 조회 처리
   */
  async handleHistoryRequest(event) {
    const { userId, chatId, limit = 10 } = event.payload;

    try {
      const historyResult = await this.leaveService.getHistory(userId, limit);
      
      if (!historyResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: historyResult.message || "사용 히스토리를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.LEAVE.HISTORY_READY, {
        userId,
        chatId,
        history: historyResult.data,
        limit
      });

    } catch (error) {
      logger.error('📋 사용 히스토리 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 💬 사용자 메시지 처리 (직접 입력 감지)
   */
  async handleUserMessage(event) {
    const { userId, chatId, text } = event.payload;
    
    if (!text) return;

    try {
      // 사용자 입력 상태 확인
      const inputState = this.getUserInputState(userId);
      if (inputState) {
        await this.eventBus.publish(EVENTS.LEAVE.CUSTOM_INPUT_RECEIVED, {
          userId,
          chatId,
          text
        });
      }

    } catch (error) {
      logger.error('💬 사용자 메시지 처리 실패:', error);
    }
  }

  // === 이벤트 발행 헬퍼 메서드들 ===

  async publishMenuRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.LEAVE.MENU_REQUEST, { userId, chatId });
  }

  async publishMonthlyRequest(userId, chatId, monthParam = null) {
    const payload = { userId, chatId };
    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number);
      payload.year = year;
      payload.month = month;
    }
    await this.eventBus.publish(EVENTS.LEAVE.MONTHLY_REQUEST, payload);
  }

  async publishUseFormRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.LEAVE.USE_FORM_REQUEST, { userId, chatId });
  }

  async publishUseRequest(userId, chatId, leaveType, customAmount = null) {
    await this.eventBus.publish(EVENTS.LEAVE.USE_REQUEST, {
      userId,
      chatId,
      leaveType,
      customAmount: customAmount ? parseFloat(customAmount) : null
    });
  }

  async publishCustomInputStart(userId, chatId) {
    await this.eventBus.publish(EVENTS.LEAVE.CUSTOM_INPUT_START, { userId, chatId });
  }

  async publishSettingsRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.LEAVE.SETTINGS_REQUEST, { userId, chatId });
  }

  async publishError(error, originalEvent) {
    const chatId = originalEvent?.payload?.chatId;
    
    if (chatId) {
      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: error.message || '연차 관리 처리 중 오류가 발생했습니다.'
      });
    }

    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: 'LeaveModuleV2',
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: Utils.timestamp()
    });
  }

  // === 사용자 입력 상태 관리 ===

  getUserInputState(userId) {
    return this.userInputStates.get(userId);
  }

  setUserInputState(userId, state) {
    this.userInputStates.set(userId, state);
  }

  clearUserInputState(userId) {
    this.userInputStates.delete(userId);
  }

  cleanupExpiredInputStates() {
    const now = Date.now();
    const expired = [];
    
    this.userInputStates.forEach((state, userId) => {
      if (now - state.startTime > this.config.inputTimeout) {
        expired.push(userId);
      }
    });

    expired.forEach(userId => {
      this.clearUserInputState(userId);
    });

    if (expired.length > 0) {
      logger.debug(`🧹 만료된 입력 상태 ${expired.length}개 정리됨`);
    }
  }

  // === 포맷팅 메서드들 ===

  formatMenu(balance) {
    const lines = [
      '🏖️ *연차 관리 시스템*\\n',
      `💰 **잔여 연차**: ${balance.remaining || 0}일`,
      `📊 **총 연차**: ${balance.total || 0}일`,
      `✅ **사용한 연차**: ${balance.used || 0}일`,
      ''
    ];

    if (balance.joinDate) {
      lines.push(`📅 **입사일**: ${balance.joinDate}`);
    }

    lines.push('\\n아래 버튼을 눌러 원하는 기능을 선택하세요:');

    return lines.join('\\n');
  }

  formatMonthlyView(history, year, month) {
    const lines = [
      `📅 *${year}년 ${month}월 연차 사용 현황*\\n`
    ];

    if (!history || history.length === 0) {
      lines.push('이번 달에는 연차 사용 기록이 없습니다.');
    } else {
      let totalUsed = 0;
      history.forEach((record, index) => {
        const date = new Date(record.date).toLocaleDateString('ko-KR');
        lines.push(`${index + 1}. ${date} - ${record.amount}일`);
        totalUsed += record.amount;
      });
      lines.push('');
      lines.push(`📊 **이번 달 총 사용**: ${totalUsed}일`);
    }

    return lines.join('\\n');
  }

  formatUseForm(balance) {
    return [
      '📝 *연차 사용 신청*\\n',
      `💰 현재 잔여 연차: **${balance.remaining || 0}일**\\n`,
      '사용하실 연차량을 선택하세요:'
    ].join('\\n');
  }

  formatUseSuccess(result, amount) {
    return [
      '✅ *연차 사용 완료!*\\n',
      `📝 **사용한 연차**: ${amount}일`,
      `💰 **남은 연차**: ${result.remaining}일`,
      `📅 **사용 날짜**: ${Utils.now('date')}`
    ].join('\\n');
  }

  formatCustomInputPrompt() {
    return [
      '⌨️ *사용자 정의 연차량 입력*\\n',
      `0보다 크고 ${this.config.maxLeavePerDay}보다 작은 숫자를 입력하세요.`,
      '(예: 0.5, 0.25, 1.0)\\n',
      '⏰ 1분 내에 입력하지 않으면 자동으로 취소됩니다.'
    ].join('\\n');
  }

  formatSettings(settings) {
    const lines = [
      '⚙️ *연차 관리 설정*\\n'
    ];

    if (settings.joinDate) {
      lines.push(`📅 **입사일**: ${settings.joinDate}`);
    } else {
      lines.push('📅 **입사일**: 설정되지 않음');
    }

    lines.push(`📊 **최대 연속 휴가**: ${this.config.maxContinuousDays}일`);
    lines.push(`⏰ **입력 대기 시간**: ${this.config.inputTimeout / 1000}초`);
    
    return lines.join('\\n');
  }

  // === 키보드 생성 메서드들 ===

  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📝 연차 사용', callback_data: 'leave:use' },
          { text: '📅 월별 현황', callback_data: 'leave:monthly' }
        ],
        [
          { text: '💰 잔여 조회', callback_data: 'leave:balance' },
          { text: '📋 사용 내역', callback_data: 'leave:history' }
        ],
        [
          { text: '⚙️ 설정', callback_data: 'leave:settings' },
          { text: '🏠 메인 메뉴', callback_data: 'system:menu' }
        ]
      ]
    };
  }

  createUseFormKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🕐 0.25일', callback_data: 'leave:add:quarter' },
          { text: '🕑 0.5일', callback_data: 'leave:add:half' }
        ],
        [
          { text: '🕒 1일', callback_data: 'leave:add:full' },
          { text: '⌨️ 직접 입력', callback_data: 'leave:custom' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  createMonthlyKeyboard(year, month) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextYear = month === 12 ? year + 1 : year;

    return {
      inline_keyboard: [
        [
          { text: '◀️ 이전달', callback_data: `leave:monthly:${prevYear}-${prevMonth}` },
          { text: '다음달 ▶️', callback_data: `leave:monthly:${nextYear}-${nextMonth}` }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  createAfterUseKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📝 추가 사용', callback_data: 'leave:use' },
          { text: '📅 월별 현황', callback_data: 'leave:monthly' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  createSettingsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📅 입사일 설정', callback_data: 'leave:joindate' },
          { text: '🔧 기타 설정', callback_data: 'leave:config' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  createCancelKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '❌ 취소', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  createAfterSetKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📝 연차 사용', callback_data: 'leave:use' },
          { text: '🔙 메뉴로', callback_data: 'leave:menu' }
        ]
      ]
    };
  }

  // === 정리 ===

  async cleanup() {
    try {
      logger.info('🧹 LeaveModuleV2 정리 시작...');
      
      // 인터벌 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // 이벤트 구독 해제
      this.subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      // 사용자 입력 상태 정리
      this.userInputStates.clear();
      
      logger.success('✅ LeaveModuleV2 정리 완료');
    } catch (error) {
      logger.error('❌ LeaveModuleV2 정리 실패:', error);
      throw error;
    }
  }
}

module.exports = LeaveModuleV2;