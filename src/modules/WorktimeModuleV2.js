/**
 * 💼 WorktimeModuleV2 - EventBus 기반 근무시간 관리 모듈
 * 완전한 이벤트 기반 아키텍처로 구현된 근무시간 관리 모듈
 */

const { EVENTS } = require("../events/index");
const logger = require("../utils/core/Logger");
const Utils = require("../utils");

class WorktimeModuleV2 {
  constructor(moduleName = "worktime", options = {}) {
    this.moduleName = moduleName;
    this.serviceBuilder = options.serviceBuilder || null;
    
    // EventBus는 ModuleManager에서 주입받거나 글로벌 인스턴스 사용
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    
    // 서비스 인스턴스
    this.worktimeService = null;
    
    // 초기화 상태
    this.isInitialized = false;
    
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
      ...options.config
    };

    // 상수 정의
    this.constants = {
      WORK_STATUS: {
        NOT_STARTED: "not_started",
        WORKING: "working", 
        LUNCH: "lunch",
        BREAK: "break",
        FINISHED: "finished"
      },
      BREAK_TYPES: {
        SHORT: "short",
        LONG: "long",
        LUNCH: "lunch"
      }
    };

    // 사용자별 임시 상태 (메모리 캐시)
    this.userStates = new Map();
    
    // 이벤트 구독 관리
    this.subscriptions = [];
    
    // 자동 정리 인터벌 (10분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 600000);

    logger.info("💼 WorktimeModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 WorktimeService 가져오기 (선택적)
      if (this.serviceBuilder) {
        try {
          this.worktimeService = await this.serviceBuilder.getOrCreate("worktime", {
            config: this.config
          });
          logger.info("💼 WorktimeService 연결 완료");
        } catch (serviceError) {
          logger.warn("⚠️ WorktimeService 연결 실패 - 테스트 모드로 동작:", serviceError.message);
          this.worktimeService = null;
        }
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기화 완료 표시
      this.isInitialized = true;
      
      const mode = this.worktimeService ? "프로덕션" : "테스트";
      logger.success(`💼 WorktimeModuleV2 초기화 완료 (${mode} 모드, EventBus 기반)`);
      return true;
    } catch (error) {
      logger.error("❌ WorktimeModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 메뉴 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 출근 처리
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.CHECK_IN_REQUEST, async (event) => {
        await this.handleCheckInRequest(event);
      })
    );

    // 퇴근 처리
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.CHECK_OUT_REQUEST, async (event) => {
        await this.handleCheckOutRequest(event);
      })
    );

    // 오늘 현황 조회
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.TODAY_REQUEST, async (event) => {
        await this.handleTodayRequest(event);
      })
    );

    // 상태 조회
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.STATUS_REQUEST, async (event) => {
        await this.handleStatusRequest(event);
      })
    );

    // 주간 통계
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.WEEKLY_REQUEST, async (event) => {
        await this.handleWeeklyRequest(event);
      })
    );

    // 월간 통계
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.MONTHLY_REQUEST, async (event) => {
        await this.handleMonthlyRequest(event);
      })
    );

    // 전체 통계
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.STATS_REQUEST, async (event) => {
        await this.handleStatsRequest(event);
      })
    );

    // 이력 조회
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.HISTORY_REQUEST, async (event) => {
        await this.handleHistoryRequest(event);
      })
    );

    // 설정 관리
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.SETTINGS_REQUEST, async (event) => {
        await this.handleSettingsRequest(event);
      })
    );

    // 근무시간 설정
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.WORK_TIME_SET, async (event) => {
        await this.handleWorkTimeSet(event);
      })
    );

    // 휴식 시작
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.BREAK_START, async (event) => {
        await this.handleBreakStart(event);
      })
    );

    // 휴식 종료  
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.BREAK_END, async (event) => {
        await this.handleBreakEnd(event);
      })
    );

    // 점심 시작
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.LUNCH_START, async (event) => {
        await this.handleLunchStart(event);
      })
    );

    // 점심 종료
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WORKTIME.LUNCH_END, async (event) => {
        await this.handleLunchEnd(event);
      })
    );

    logger.debug("🎧 WorktimeModuleV2 EventBus 리스너 설정 완료");
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
        default:
          // 다른 이벤트는 개별 리스너에서 처리
          break;
      }
    } catch (error) {
      logger.error(`💼 WorktimeModuleV2 이벤트 처리 오류: ${eventName}`, error);
      await this.publishError(error, event);
    }
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
      'checkin': () => this.publishCheckinRequest(userId, chatId),
      'checkout': () => this.publishCheckoutRequest(userId, chatId),
      'today': () => this.publishTodayRequest(userId, chatId),
      'status': () => this.publishStatusRequest(userId, chatId),
      'weekly': () => this.publishWeeklyRequest(userId, chatId),
      'monthly': () => this.publishMonthlyRequest(userId, chatId),
      'stats': () => this.publishStatsRequest(userId, chatId),
      'history': () => this.publishHistoryRequest(userId, chatId),
      'settings': () => this.publishSettingsRequest(userId, chatId),
      'break_start': () => this.publishBreakStartRequest(userId, chatId),
      'break_end': () => this.publishBreakEndRequest(userId, chatId),
      'lunch_start': () => this.publishLunchStartRequest(userId, chatId),
      'lunch_end': () => this.publishLunchEndRequest(userId, chatId)
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
        module: 'worktime',
        success: true
      };
    }
    
    logger.debug(`WorktimeModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 📤 체크인 요청 발행 (레거시 콜백용)
   */
  async publishCheckinRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.CHECKIN_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 체크아웃 요청 발행 (레거시 콜백용)
   */
  async publishCheckoutRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.CHECKOUT_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 오늘 근무 현황 요청 발행 (레거시 콜백용)
   */
  async publishTodayRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.TODAY_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 상태 요청 발행 (레거시 콜백용)
   */
  async publishStatusRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.STATUS_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 주간 통계 요청 발행 (레거시 콜백용)
   */
  async publishWeeklyRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.WEEKLY_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 월간 통계 요청 발행 (레거시 콜백용)
   */
  async publishMonthlyRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.MONTHLY_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 통계 요청 발행 (레거시 콜백용)
   */
  async publishStatsRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.STATS_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🏠 메뉴 표시 (V2 렌더러 방식)
   */
  async showMenu(userId, chatId) {
    try {
      // 렌더러에게 전달할 데이터 구성
      return {
        type: 'menu',
        module: 'worktime',
        success: true,
        data: {
          title: '💼 *근무시간 관리*',
          isCheckedIn: false, // 기본값
          todayWorked: '0시간 0분',
          weeklyWorked: '0시간 0분',
          monthlyWorked: '0시간 0분',
          userId: userId
        }
      };

    } catch (error) {
      logger.error('💼 WorktimeModuleV2.showMenu 실패:', error);
      return {
        type: 'error',
        module: 'worktime',
        success: false,
        data: {
          message: '근무시간 메뉴를 불러오는 중 오류가 발생했습니다.',
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
    
    if (module !== 'worktime') return;

    try {
      switch (action) {
        case 'menu':
          await this.publishMenuRequest(userId, chatId);
          break;
        case 'checkin':
          await this.publishCheckInRequest(userId, chatId);
          break;
        case 'checkout':
          await this.publishCheckOutRequest(userId, chatId);
          break;
        case 'today':
          await this.publishTodayRequest(userId, chatId);
          break;
        case 'week':
          await this.publishWeeklyRequest(userId, chatId);
          break;
        case 'month':
          await this.publishMonthlyRequest(userId, chatId);
          break;
        case 'stats':
          await this.publishStatsRequest(userId, chatId);
          break;
        case 'history':
          await this.publishHistoryRequest(userId, chatId);
          break;
        case 'settings':
          await this.publishSettingsRequest(userId, chatId);
          break;
        case 'break':
          await this.publishBreakStart(userId, chatId, params[0] || 'short');
          break;
        case 'lunch':
          await this.publishLunchStart(userId, chatId);
          break;
        default:
          logger.debug(`💼 알 수 없는 액션: ${action}`);
      }
    } catch (error) {
      logger.error(`💼 콜백 처리 오류: ${action}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📝 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 오늘 근무 상태 조회 (Service가 있으면 실제 데이터, 없으면 더미 데이터)
      let todayStatus;
      
      if (this.worktimeService) {
        todayStatus = await this.worktimeService.getTodayStatus(userId);
        
        if (!todayStatus.success) {
          await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
            chatId,
            error: todayStatus.message || "근무 상태를 조회할 수 없습니다."
          });
          return;
        }
      } else {
        // 테스트 모드: 더미 데이터
        todayStatus = {
          success: true,
          data: {
            status: 'not_working',
            checkInTime: null,
            workingHours: 0,
            isWorking: false
          }
        };
      }

      const menuData = todayStatus.data || todayStatus;

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.MENU_READY, {
        userId,
        chatId,
        menuData,
        config: this.config
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatMenu(menuData),
          options: {
            reply_markup: this.createMenuKeyboard(menuData.status || 'not_working'),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('📝 메뉴 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🏢 출근 요청 처리
   */
  async handleCheckInRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 출근 처리 (Service가 있으면 실제 처리, 없으면 더미 응답)
      let checkInResult;
      
      if (this.worktimeService) {
        checkInResult = await this.worktimeService.checkIn(userId);
        
        if (!checkInResult.success) {
          await this.eventBus.publish(EVENTS.WORKTIME.CHECK_IN_ERROR, {
            userId,
            chatId,
            error: checkInResult.message || "출근 처리에 실패했습니다."
          });
          return;
        }
      } else {
        // 테스트 모드: 더미 출근 데이터
        checkInResult = {
          success: true,
          data: {
            checkInTime: new Date(),
            record: {
              userId,
              checkInTime: new Date(),
              date: new Date().toISOString().split('T')[0]
            }
          }
        };
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.CHECKED_IN, {
        userId,
        chatId,
        checkInTime: checkInResult.data.checkInTime,
        record: checkInResult.data.record
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatCheckInSuccess(checkInResult.data),
          options: {
            reply_markup: this.createAfterCheckInKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🏢 출근 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🏠 퇴근 요청 처리
   */
  async handleCheckOutRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 퇴근 처리
      // 퇴근 처리 (Service가 있으면 실제 처리, 없으면 더미 응답)
      let checkOutResult;
      
      if (this.worktimeService) {
        checkOutResult = await this.worktimeService.checkOut(userId);
      } else {
        // 테스트 모드: 더미 퇴근 데이터
        checkOutResult = {
          success: true,
          data: {
            checkOutTime: new Date(),
            workDuration: 480, // 8시간
            record: {
              userId,
              checkOutTime: new Date(),
              workDuration: 480
            }
          }
        };
      }
      
      if (!checkOutResult.success) {
        await this.eventBus.publish(EVENTS.WORKTIME.CHECK_OUT_ERROR, {
          userId,
          chatId,
          error: checkOutResult.message || "퇴근 처리에 실패했습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.CHECKED_OUT, {
        userId,
        chatId,
        checkOutTime: checkOutResult.data.checkOutTime,
        workDuration: checkOutResult.data.workDuration,
        record: checkOutResult.data.record
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatCheckOutSuccess(checkOutResult.data),
        options: {
          reply_markup: this.createAfterCheckOutKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🏠 퇴근 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📅 오늘 현황 요청 처리
   */
  async handleTodayRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      let todayStatus;
      
      if (this.worktimeService) {
        todayStatus = await this.worktimeService.getTodayStatus(userId);
        
        if (!todayStatus.success) {
          await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
            chatId,
            error: todayStatus.message || "오늘 현황을 조회할 수 없습니다."
          });
          return;
        }
      } else {
        // 테스트 모드: 더미 오늘 현황
        todayStatus = {
          success: true,
          data: {
            isWorking: false,
            checkInTime: null,
            workDuration: 0,
            status: 'not_working'
          }
        };
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.TODAY_READY, {
        userId,
        chatId,
        todayStatus: todayStatus.data
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatTodayStatus(todayStatus.data),
        options: {
          reply_markup: this.createTodayKeyboard(todayStatus.data.status),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📅 오늘 현황 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ℹ️ 상태 조회 처리
   */
  async handleStatusRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const statusResult = await this.worktimeService.getStatus(userId);
      
      if (!statusResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: statusResult.message || "상태를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.STATUS_READY, {
        userId,
        chatId,
        status: statusResult.data
      });

    } catch (error) {
      logger.error('ℹ️ 상태 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📊 주간 통계 요청 처리
   */
  async handleWeeklyRequest(event) {
    const { userId, chatId, weekOffset = 0 } = event.payload;

    try {
      let weeklyResult;
      
      if (this.worktimeService) {
        weeklyResult = await this.worktimeService.getWeeklyStats(userId, weekOffset);
      } else {
        // 테스트 모드: 더미 주간 통계
        weeklyResult = {
          success: true,
          data: {
            totalHours: 40,
            workDays: 5,
            averageHours: 8,
            thisWeek: {
              totalHours: 32,
              workDays: 4
            }
          }
        };
      }
      
      if (!weeklyResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: weeklyResult.message || "주간 통계를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.WEEKLY_READY, {
        userId,
        chatId,
        weeklyStats: weeklyResult.data,
        weekOffset
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatWeeklyStats(weeklyResult.data),
        options: {
          reply_markup: this.createWeeklyKeyboard(weekOffset),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📊 주간 통계 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📈 월간 통계 요청 처리
   */
  async handleMonthlyRequest(event) {
    const { userId, chatId, year, month } = event.payload;

    try {
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;

      let monthlyResult;
      
      if (this.worktimeService) {
        monthlyResult = await this.worktimeService.getMonthlyStats(userId, targetYear, targetMonth);
      } else {
        // 테스트 모드: 더미 월간 통계
        monthlyResult = {
          success: true,
          data: {
            totalHours: 160,
            workDays: 20,
            averageHours: 8,
            thisMonth: {
              totalHours: 120,
              workDays: 15
            }
          }
        };
      }
      
      if (!monthlyResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: monthlyResult.message || "월간 통계를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.MONTHLY_READY, {
        userId,
        chatId,
        monthlyStats: monthlyResult.data,
        year: targetYear,
        month: targetMonth
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatMonthlyStats(monthlyResult.data, targetYear, targetMonth),
        options: {
          reply_markup: this.createMonthlyKeyboard(targetYear, targetMonth),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📈 월간 통계 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📊 전체 통계 요청 처리
   */
  async handleStatsRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const statsResult = await this.worktimeService.getOverallStats(userId);
      
      if (!statsResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: statsResult.message || "통계를 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.STATS_READY, {
        userId,
        chatId,
        stats: statsResult.data
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatOverallStats(statsResult.data),
        options: {
          reply_markup: this.createStatsKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📊 전체 통계 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📋 이력 조회 처리
   */
  async handleHistoryRequest(event) {
    const { userId, chatId, limit = 10, offset = 0 } = event.payload;

    try {
      let historyResult;
      
      if (this.worktimeService) {
        historyResult = await this.worktimeService.getHistory(userId, limit, offset);
      } else {
        // 테스트 모드: 더미 이력 데이터
        historyResult = {
          success: true,
          data: {
            records: [],
            totalCount: 0,
            hasMore: false
          }
        };
      }
      
      if (!historyResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: historyResult.message || "이력을 조회할 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.HISTORY_READY, {
        userId,
        chatId,
        history: historyResult.data,
        limit,
        offset
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatHistory(historyResult.data),
        options: {
          reply_markup: this.createHistoryKeyboard(limit, offset),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📋 이력 조회 실패:', error);
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
      const settingsResult = await this.worktimeService.getUserSettings(userId);
      
      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WORKTIME.SETTINGS_READY, {
        userId,
        chatId,
        settings: settingsResult.success ? settingsResult.data : {},
        config: this.config
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
   * 🕘 근무시간 설정 처리
   */
  async handleWorkTimeSet(event) {
    const { userId, chatId, workStartTime, workEndTime } = event.payload;

    try {
      const updateResult = await this.worktimeService.setWorkTime(userId, workStartTime, workEndTime);
      
      if (!updateResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: updateResult.message || "근무시간 설정에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: `✅ 근무시간이 *${workStartTime} ~ ${workEndTime}*로 설정되었습니다.`,
        options: {
          reply_markup: this.createAfterSetKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🕘 근무시간 설정 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ☕ 휴식 시작 처리
   */
  async handleBreakStart(event) {
    const { userId, chatId, breakType = 'short' } = event.payload;

    try {
      const breakResult = await this.worktimeService.startBreak(userId, breakType);
      
      if (!breakResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: breakResult.message || "휴식 시작에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatBreakStart(breakType),
        options: {
          reply_markup: this.createBreakKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('☕ 휴식 시작 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔚 휴식 종료 처리
   */
  async handleBreakEnd(event) {
    const { userId, chatId } = event.payload;

    try {
      const endResult = await this.worktimeService.endBreak(userId);
      
      if (!endResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: endResult.message || "휴식 종료에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatBreakEnd(endResult.data),
        options: {
          reply_markup: this.createAfterBreakKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🔚 휴식 종료 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🍽️ 점심 시작 처리
   */
  async handleLunchStart(event) {
    const { userId, chatId } = event.payload;

    try {
      const lunchResult = await this.worktimeService.startLunch(userId);
      
      if (!lunchResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: lunchResult.message || "점심시간 시작에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatLunchStart(),
        options: {
          reply_markup: this.createLunchKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🍽️ 점심 시작 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔚 점심 종료 처리
   */
  async handleLunchEnd(event) {
    const { userId, chatId } = event.payload;

    try {
      const endResult = await this.worktimeService.endLunch(userId);
      
      if (!endResult.success) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: endResult.message || "점심시간 종료에 실패했습니다."
        });
        return;
      }

      // 성공 메시지
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatLunchEnd(endResult.data),
        options: {
          reply_markup: this.createAfterLunchKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🔚 점심 종료 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  // === 이벤트 발행 헬퍼 메서드들 ===

  async publishMenuRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WORKTIME.MENU_REQUEST, { userId, chatId });
  }

  async publishCheckInRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WORKTIME.CHECK_IN_REQUEST, { userId, chatId });
  }

  async publishCheckOutRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WORKTIME.CHECK_OUT_REQUEST, { userId, chatId });
  }


  async publishHistoryRequest(userId, chatId, limit = 10, offset = 0) {
    await this.eventBus.publish(EVENTS.WORKTIME.HISTORY_REQUEST, { userId, chatId, limit, offset });
  }

  async publishSettingsRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WORKTIME.SETTINGS_REQUEST, { userId, chatId });
  }

  async publishBreakStart(userId, chatId, breakType = 'short') {
    await this.eventBus.publish(EVENTS.WORKTIME.BREAK_START, { userId, chatId, breakType });
  }

  async publishLunchStart(userId, chatId) {
    await this.eventBus.publish(EVENTS.WORKTIME.LUNCH_START, { userId, chatId });
  }

  async publishError(error, originalEvent) {
    const chatId = originalEvent?.payload?.chatId;
    
    if (chatId) {
      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: error.message || '근무시간 처리 중 오류가 발생했습니다.'
      });
    }

    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: 'WorktimeModuleV2',
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: Utils.timestamp()
    });
  }

  // === 상태 관리 ===

  getUserState(userId) {
    return this.userStates.get(userId);
  }

  setUserState(userId, state) {
    this.userStates.set(userId, { ...state, lastUpdate: Date.now() });
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  cleanupExpiredStates() {
    const now = Date.now();
    const expired = [];
    
    this.userStates.forEach((state, userId) => {
      if (now - state.lastUpdate > 3600000) { // 1시간
        expired.push(userId);
      }
    });

    expired.forEach(userId => {
      this.clearUserState(userId);
    });

    if (expired.length > 0) {
      logger.debug(`🧹 만료된 사용자 상태 ${expired.length}개 정리됨`);
    }
  }

  // === 포맷팅 메서드들 ===

  formatMenu(todayStatus) {
    const lines = [
      '💼 *근무시간 관리*\\n',
      `📊 **현재 상태**: ${this.getStatusDisplay(todayStatus.status)}`
    ];

    if (todayStatus.checkInTime) {
      lines.push(`🏢 **출근시간**: ${this.formatTime(todayStatus.checkInTime)}`);
    }

    if (todayStatus.checkOutTime) {
      lines.push(`🏠 **퇴근시간**: ${this.formatTime(todayStatus.checkOutTime)}`);
    }

    if (todayStatus.workDuration) {
      lines.push(`⏰ **근무시간**: ${this.formatDuration(todayStatus.workDuration)}`);
    }

    lines.push('\\n아래 버튼을 눌러 원하는 기능을 선택하세요:');

    return lines.join('\\n');
  }

  formatCheckInSuccess(data) {
    return [
      '🏢 *출근 완료!*\\n',
      `⏰ **출근시간**: ${this.formatTime(data.checkInTime)}`,
      `📅 **날짜**: ${Utils.now('date')}`,
      '\\n오늘도 화이팅! 💪'
    ].join('\\n');
  }

  formatCheckOutSuccess(data) {
    return [
      '🏠 *퇴근 완료!*\\n',
      `⏰ **퇴근시간**: ${this.formatTime(data.checkOutTime)}`,
      `📊 **오늘 근무시간**: ${this.formatDuration(data.workDuration)}`,
      `📅 **날짜**: ${Utils.now('date')}`,
      '\\n오늘도 고생하셨습니다! 😊'
    ].join('\\n');
  }

  formatTodayStatus(todayStatus) {
    const lines = [
      `📅 *${Utils.now('date')} 근무 현황*\\n`,
      `📊 **현재 상태**: ${this.getStatusDisplay(todayStatus.status)}`
    ];

    if (todayStatus.checkInTime) {
      lines.push(`🏢 **출근**: ${this.formatTime(todayStatus.checkInTime)}`);
      
      if (!todayStatus.checkOutTime) {
        const workingTime = Date.now() - new Date(todayStatus.checkInTime).getTime();
        lines.push(`⏰ **현재 근무시간**: ${this.formatDuration(workingTime)}`);
      }
    }

    if (todayStatus.checkOutTime) {
      lines.push(`🏠 **퇴근**: ${this.formatTime(todayStatus.checkOutTime)}`);
      lines.push(`📊 **총 근무시간**: ${this.formatDuration(todayStatus.workDuration)}`);
    }

    if (todayStatus.breakTime) {
      lines.push(`☕ **휴식시간**: ${this.formatDuration(todayStatus.breakTime)}`);
    }

    return lines.join('\\n');
  }

  formatWeeklyStats(weeklyStats) {
    const lines = [
      '📊 *주간 근무 통계*\\n',
      `📅 **기간**: ${weeklyStats.startDate} ~ ${weeklyStats.endDate}`,
      `📈 **총 근무시간**: ${this.formatDuration(weeklyStats.totalWorkTime)}`,
      `📊 **평균 근무시간**: ${this.formatDuration(weeklyStats.averageWorkTime)}`,
      `📋 **출근일수**: ${weeklyStats.workDays}일`
    ];

    if (weeklyStats.overtimeHours > 0) {
      lines.push(`⏰ **초과근무**: ${this.formatDuration(weeklyStats.overtimeHours)}`);
    }

    return lines.join('\\n');
  }

  formatMonthlyStats(monthlyStats, year, month) {
    const lines = [
      `📈 *${year}년 ${month}월 근무 통계*\\n`,
      `📊 **총 근무시간**: ${this.formatDuration(monthlyStats.totalWorkTime)}`,
      `📋 **출근일수**: ${monthlyStats.workDays}일`,
      `📈 **평균 근무시간**: ${this.formatDuration(monthlyStats.averageWorkTime)}`
    ];

    if (monthlyStats.overtimeHours > 0) {
      lines.push(`⏰ **초과근무**: ${this.formatDuration(monthlyStats.overtimeHours)}`);
    }

    if (monthlyStats.lateCount > 0) {
      lines.push(`⏰ **지각횟수**: ${monthlyStats.lateCount}회`);
    }

    return lines.join('\\n');
  }

  formatOverallStats(stats) {
    return [
      '📊 *전체 근무 통계*\\n',
      `📈 **총 근무시간**: ${this.formatDuration(stats.totalWorkTime)}`,
      `📋 **총 출근일수**: ${stats.totalWorkDays}일`,
      `📊 **평균 근무시간**: ${this.formatDuration(stats.averageWorkTime)}`,
      `⏰ **총 초과근무**: ${this.formatDuration(stats.totalOvertime)}`,
      `📅 **첫 출근일**: ${stats.firstWorkDate || '정보 없음'}`
    ].join('\\n');
  }

  formatHistory(history) {
    const lines = [
      '📋 *근무 기록*\\n'
    ];

    if (!history || history.length === 0) {
      lines.push('아직 근무 기록이 없습니다.');
    } else {
      history.forEach((record, index) => {
        const date = new Date(record.date).toLocaleDateString('ko-KR');
        const checkIn = record.checkInTime ? this.formatTime(record.checkInTime) : '미출근';
        const checkOut = record.checkOutTime ? this.formatTime(record.checkOutTime) : '미퇴근';
        const duration = record.workDuration ? this.formatDuration(record.workDuration) : '-';
        
        lines.push(`${index + 1}. **${date}**`);
        lines.push(`   🏢 ${checkIn} → 🏠 ${checkOut} (${duration})`);
      });
    }

    return lines.join('\\n');
  }

  formatSettings(settings) {
    return [
      '⚙️ *근무시간 설정*\\n',
      `🏢 **출근시간**: ${settings.workStartTime || this.config.workStartTime}`,
      `🏠 **퇴근시간**: ${settings.workEndTime || this.config.workEndTime}`,
      `🍽️ **점심시간**: ${this.config.lunchStartTime} ~ ${this.config.lunchEndTime}`,
      `⏰ **초과근무 기준**: ${Math.floor(this.config.overtimeThreshold / 60)}시간`,
      `🔔 **알림**: ${this.config.enableReminders ? '활성화' : '비활성화'}`
    ].join('\\n');
  }

  formatBreakStart(breakType) {
    const typeMap = {
      short: '짧은 휴식',
      long: '긴 휴식', 
      custom: '사용자 정의 휴식'
    };

    return [
      `☕ *${typeMap[breakType] || '휴식'} 시작*\\n`,
      `⏰ **시작시간**: ${Utils.now('time')}`,
      '\\n충분한 휴식을 취하세요! 😊'
    ].join('\\n');
  }

  formatBreakEnd(data) {
    return [
      '🔚 *휴식 종료*\\n',
      `⏰ **종료시간**: ${Utils.now('time')}`,
      `📊 **휴식시간**: ${this.formatDuration(data.breakDuration)}`,
      '\\n업무를 계속하세요! 💪'
    ].join('\\n');
  }

  formatLunchStart() {
    return [
      '🍽️ *점심시간 시작*\\n',
      `⏰ **시작시간**: ${Utils.now('time')}`,
      '\\n맛있는 점심 드세요! 😋'
    ].join('\\n');
  }

  formatLunchEnd(data) {
    return [
      '🔚 *점심시간 종료*\\n',
      `⏰ **종료시간**: ${Utils.now('time')}`,
      `📊 **점심시간**: ${this.formatDuration(data.lunchDuration)}`,
      '\\n오후 업무 화이팅! 💪'
    ].join('\\n');
  }

  // === 헬퍼 메서드들 ===

  getStatusDisplay(status) {
    const statusMap = {
      not_started: '미출근',
      working: '근무중 💼',
      lunch: '점심시간 🍽️', 
      break: '휴식시간 ☕',
      finished: '퇴근완료 ✅'
    };
    return statusMap[status] || status;
  }

  formatTime(timeStr) {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(milliseconds) {
    if (!milliseconds || milliseconds === 0) return '0분';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
  }

  // === 키보드 생성 메서드들 ===

  createMenuKeyboard(status) {
    const buttons = [];

    // 출퇴근 버튼 (상태에 따라)
    if (status === this.constants.WORK_STATUS.NOT_STARTED) {
      buttons.push([
        { text: '🏢 출근', callback_data: 'worktime:checkin' }
      ]);
    } else if (status === this.constants.WORK_STATUS.WORKING) {
      buttons.push([
        { text: '🏠 퇴근', callback_data: 'worktime:checkout' },
        { text: '☕ 휴식', callback_data: 'worktime:break:short' }
      ]);
      buttons.push([
        { text: '🍽️ 점심', callback_data: 'worktime:lunch' }
      ]);
    }

    // 공통 버튼들
    buttons.push([
      { text: '📅 오늘 현황', callback_data: 'worktime:today' },
      { text: '📊 주간 통계', callback_data: 'worktime:week' }
    ]);

    buttons.push([
      { text: '📈 월간 통계', callback_data: 'worktime:month' },
      { text: '📋 근무 기록', callback_data: 'worktime:history' }
    ]);

    buttons.push([
      { text: '⚙️ 설정', callback_data: 'worktime:settings' },
      { text: '🏠 메인 메뉴', callback_data: 'system:menu' }
    ]);

    return { inline_keyboard: buttons };
  }

  createAfterCheckInKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' },
          { text: '☕ 휴식', callback_data: 'worktime:break:short' }
        ],
        [
          { text: '🍽️ 점심', callback_data: 'worktime:lunch' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createAfterCheckOutKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📊 오늘 통계', callback_data: 'worktime:today' },
          { text: '📈 주간 통계', callback_data: 'worktime:week' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createTodayKeyboard(status) {
    const buttons = [];

    if (status === this.constants.WORK_STATUS.WORKING) {
      buttons.push([
        { text: '🏠 퇴근', callback_data: 'worktime:checkout' },
        { text: '☕ 휴식', callback_data: 'worktime:break:short' }
      ]);
    }

    buttons.push([
      { text: '📊 주간 통계', callback_data: 'worktime:week' },
      { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
    ]);

    return { inline_keyboard: buttons };
  }

  createWeeklyKeyboard(weekOffset) {
    return {
      inline_keyboard: [
        [
          { text: '◀️ 이전주', callback_data: `worktime:week:${weekOffset - 1}` },
          { text: '다음주 ▶️', callback_data: `worktime:week:${weekOffset + 1}` }
        ],
        [
          { text: '📈 월간 통계', callback_data: 'worktime:month' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
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
          { text: '◀️ 이전달', callback_data: `worktime:month:${prevYear}-${prevMonth}` },
          { text: '다음달 ▶️', callback_data: `worktime:month:${nextYear}-${nextMonth}` }
        ],
        [
          { text: '📊 주간 통계', callback_data: 'worktime:week' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createStatsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📊 주간 통계', callback_data: 'worktime:week' },
          { text: '📈 월간 통계', callback_data: 'worktime:month' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createHistoryKeyboard(limit, offset) {
    const buttons = [];

    if (offset > 0) {
      buttons.push([
        { text: '◀️ 이전', callback_data: `worktime:history:${Math.max(0, offset - limit)}` }
      ]);
    }

    buttons.push([
      { text: '더보기 ▶️', callback_data: `worktime:history:${offset + limit}` }
    ]);

    buttons.push([
      { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
    ]);

    return { inline_keyboard: buttons };
  }

  createSettingsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🕘 근무시간 설정', callback_data: 'worktime:worktime:set' },
          { text: '🔔 알림 설정', callback_data: 'worktime:reminder:set' }
        ],
        [
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createBreakKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🔚 휴식 종료', callback_data: 'worktime:break:end' }
        ],
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' }
        ]
      ]
    };
  }

  createLunchKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🔚 점심 종료', callback_data: 'worktime:lunch:end' }
        ],
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' }
        ]
      ]
    };
  }

  createAfterBreakKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🏠 퇴근', callback_data: 'worktime:checkout' },
          { text: '🍽️ 점심', callback_data: 'worktime:lunch' }
        ],
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createAfterLunchKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🏠 퇴근', callback_data: 'worktime:checkout' },
          { text: '☕ 휴식', callback_data: 'worktime:break:short' }
        ],
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  createAfterSetKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📅 오늘 현황', callback_data: 'worktime:today' },
          { text: '🔙 메뉴로', callback_data: 'worktime:menu' }
        ]
      ]
    };
  }

  // === 누락된 메서드들 ===

  /**
   * 📤 히스토리 요청 발행 (레거시 콜백용)
   */
  async publishHistoryRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.HISTORY_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 설정 요청 발행 (레거시 콜백용)
   */
  async publishSettingsRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.SETTINGS_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 휴식 시작 요청 발행 (레거시 콜백용)
   */
  async publishBreakStartRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.BREAK_START, {
      userId,
      chatId,
      breakType: 'short'
    });
    return { success: true };
  }

  /**
   * 📤 휴식 종료 요청 발행 (레거시 콜백용)
   */
  async publishBreakEndRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.BREAK_END, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 점심 시작 요청 발행 (레거시 콜백용)
   */
  async publishLunchStartRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.LUNCH_START, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 📤 점심 종료 요청 발행 (레거시 콜백용)
   */
  async publishLunchEndRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WORKTIME.LUNCH_END, {
      userId,
      chatId
    });
    return { success: true };
  }

  // === 정리 ===

  async cleanup() {
    try {
      logger.info('🧹 WorktimeModuleV2 정리 시작...');
      
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
      
      // 사용자 상태 정리
      this.userStates.clear();
      
      logger.success('✅ WorktimeModuleV2 정리 완료');
    } catch (error) {
      logger.error('❌ WorktimeModuleV2 정리 실패:', error);
      throw error;
    }
  }
}

module.exports = WorktimeModuleV2;