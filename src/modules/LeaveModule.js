// src/modules/LeaveModule.js - 완전히 표준화된 연차 관리 모듈
const BaseModule = require("../core/BaseModule");
const { getUserId, getUserName } = require('../utils/helpers/UserHelper');
const logger = require('../utils/core/Logger');

/**
 * 🏖️ LeaveModule - 개인용 연차 관리 모듈 (완전 표준화)
 *
 * ✅ 표준 준수 사항:
 * - BaseModule 상속 ✅
 * - 표준 constructor: (moduleName, options = {}) ✅
 * - 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager) ✅
 * - registerActions 방식 (직접 actionMap 할당 금지) ✅
 * - onInitialize/onHandleMessage 구현 ✅
 * - 순수 데이터만 반환 (UI는 렌더러가 담당!) ✅
 * - SoC 완전 준수 ✅
 *
 * 🎯 핵심 액션:
 * - menu: 메인 현황
 * - monthly: 월별 현황
 * - use: 연차 사용 폼
 * - add: 연차 사용 처리 (quarter/half/full)
 * - settings: 설정 메뉴
 */
class LeaveModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ✅ 추가: 사용자 입력 상태 관리
    this.userInputStates = new Map();

    // 서비스 인스턴스
    this.leaveService = null;

    // 모듈 설정 (환경변수 기반)
    this.config = {
      maxLeavePerDay: 1, // 하루 최대 연차
      maxContinuousDays: parseInt(process.env.LEAVE_MAX_CONTINUOUS_DAYS) || 10, // 연속 휴가 최대일
      allowedIncrements: [0.25, 0.5, 0.75, 1], // 허용되는 단위
      inputTimeout: 60000, // 입력 대기 시간 (1분)
      ...options.config
    };

    // 모듈 상수
    this.constants = {
      LEAVE_TYPES: {
        QUARTER: "quarter",
        HALF: "half",
        FULL: "full",
        CUSTOM: "custom" // ✅ 추가
      },
      LEAVE_AMOUNTS: {
        quarter: 0.25,
        half: 0.5,
        full: 1.0
      },
      // 👇 'WAITING_JOIN_DATE_INPUT' 상태를 추가합니다.
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
    // ✅ 디버깅: 상수 확인
    logger.debug(`🏖️ LeaveModule 생성됨 - 상수 확인:`, {
      waitingState: this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT,
      inputTimeout: this.config.inputTimeout,
      maxDays: this.config.maxContinuousDays
    });

    logger.info("🏖️ LeaveModule 생성됨 (직접 입력 기능 포함)");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // ✅ ServiceBuilder 검증
      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 설정되지 않았습니다");
      }

      if (!this.serviceBuilder.isInitialized) {
        throw new Error("ServiceBuilder가 초기화되지 않았습니다");
      }

      // ✅ LeaveService 가져오기
      this.leaveService = await this.serviceBuilder.getOrCreate("leave");

      if (!this.leaveService) {
        throw new Error("LeaveService 생성에 실패했습니다");
      }

      logger.success("🏖️ LeaveModule 초기화 완료 - 표준 준수");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    // ✅ registerActions 사용 (직접 actionMap 할당 금지!)
    this.registerActions({
      // 기본 메뉴
      menu: this.showMenu,
      main: this.showMenu, // ✅ 추가: main 액션도 menu로 처리 (호환성)
      monthly: this.showMonthlyView,

      // 연차 사용
      use: this.showUseForm,
      add: this.handleUseLeave,
      custom: this.startCustomInput, // ✅ 추가: 직접 입력 시작

      // 설정
      settings: this.showSettings
    });

    logger.debug(`🏖️ LeaveModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🏠 메인 메뉴 표시 (표준 매개변수 5개)
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 연차 현황 조회
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      if (!statusResult.success) {
        return this.createErrorResult(statusResult.message);
      }

      return {
        type: "main_menu",
        module: "leave",
        data: {
          userId,
          userName,
          ...statusResult.data
        }
      };
    } catch (error) {
      logger.error("🏠 LeaveModule.showMenu 실패:", error);
      return this.createErrorResult("메인 메뉴를 표시할 수 없습니다.");
    }
  }

  /**
   * 📈 월별 현황 표시 (표준 매개변수 5개)
   */
  async showMonthlyView(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 월별 사용량 조회
      const monthlyResult = await this.leaveService.getMonthlyUsage(userId);

      if (!monthlyResult.success) {
        return this.createErrorResult(monthlyResult.message);
      }

      return {
        type: "monthly_view",
        module: "leave",
        data: monthlyResult.data
      };
    } catch (error) {
      logger.error("📈 LeaveModule.showMonthlyView 실패:", error);
      return this.createErrorResult("월별 현황을 표시할 수 없습니다.");
    }
  }

  /**
   * ➕ 연차 사용 폼 표시 (표준 매개변수 5개)
   */
  async showUseForm(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 현재 연차 현황 확인
      const statusResult = await this.leaveService.getLeaveStatus(userId);

      if (!statusResult.success) {
        return this.createErrorResult("연차 현황을 확인할 수 없습니다.");
      }

      return {
        type: "use_form",
        module: "leave",
        data: {
          remainingLeave: statusResult.data.remainingLeave,
          availableTypes: Object.keys(this.constants.LEAVE_TYPES),
          leaveAmounts: this.constants.LEAVE_AMOUNTS,
          maxContinuousDays: this.config.maxContinuousDays // ✅ 추가
        }
      };
    } catch (error) {
      logger.error("➕ LeaveModule.showUseForm 실패:", error);
      return this.createErrorResult("연차 사용 폼을 표시할 수 없습니다.");
    }
  }

  /**
   * 🎯 연차 사용 처리 (표준 매개변수 5개)
   */
  async handleUseLeave(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const leaveType = params; // quarter, half, full

      // ✅ 수정: 연차 타입별 정보 매핑 (type 포함)
      const leaveInfo = {
        quarter: { amount: 0.25, type: "반반차", displayName: "반반차" },
        half: { amount: 0.5, type: "반차", displayName: "반차" },
        full: { amount: 1, type: "연차", displayName: "연차" }
      };

      const info = leaveInfo[leaveType];
      if (!info) {
        return this.createErrorResult(`잘못된 연차 타입입니다: ${leaveType}`);
      }

      // ✅ 수정: reason에 타입 정보 포함
      const reason = `${info.displayName} 사용`;

      // 연차 사용 처리
      const useResult = await this.leaveService.useLeave(
        userId,
        info.amount,
        reason
      );

      if (!useResult.success) {
        return this.createErrorResult(useResult.message);
      }

      return {
        type: "use_success",
        module: "leave",
        data: {
          ...useResult.data,
          leaveType: info.displayName,
          message: `${info.displayName}(${info.amount}일)이 사용되었습니다.`
        }
      };
    } catch (error) {
      logger.error("🎯 LeaveModule.handleUseLeave 실패:", error);
      return this.createErrorResult("연차 사용 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * ⚙️ 설정 메뉴 표시 (표준 매개변수 5개)
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 설정 관련 액션 처리 (settings:action:value 형태)
      if (params) {
        return await this.handleSettingsAction(
          bot,
          callbackQuery,
          params,
          moduleManager
        );
      }

      // 기본 설정 메뉴 조회
      const settingsResult = await this.leaveService.getUserSettings(userId);

      if (!settingsResult.success) {
        return this.createErrorResult(settingsResult.message);
      }

      return {
        type: "settings",
        module: "leave",
        data: {
          ...settingsResult.data,
          availableActions: Object.values(this.constants.SETTINGS_ACTIONS)
        }
      };
    } catch (error) {
      logger.error("⚙️ LeaveModule.showSettings 실패:", error);
      return this.createErrorResult("설정 메뉴를 표시할 수 없습니다.");
    }
  }

  // ===== 🎯 3. 직접 입력 시작 메서드 =====

  /**
   * ✏️ 직접 입력 시작
   */
  async startCustomInput(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      logger.info(`✏️ LeaveModule: 직접 입력 시작 - 사용자 ${userId}`);

      // 현재 연차 현황 확인
      const statusResult = await this.leaveService.getLeaveStatus(userId);
      if (!statusResult.success) {
        logger.error(
          `❌ LeaveModule: 연차 현황 조회 실패 - ${statusResult.message}`
        );
        return this.createErrorResult("연차 현황을 확인할 수 없습니다.");
      }

      const { remainingLeave } = statusResult.data;
      logger.debug(
        `✏️ LeaveModule: 연차 현황 확인 완료 - 잔여: ${remainingLeave}일`
      );

      // ✅ 사용자 입력 상태 설정 (디버깅 로그 추가)
      const inputState = {
        state: this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT,
        remainingLeave,
        timestamp: Date.now()
      };

      logger.info(`✏️ LeaveModule: 사용자 입력 상태 설정`, {
        userId,
        state: inputState.state,
        remainingLeave: inputState.remainingLeave,
        constantsCheck: this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT
      });

      this.userInputStates.set(userId, inputState);

      // ✅ 설정 확인 로그
      const verifyState = this.userInputStates.get(userId);
      logger.debug(`✏️ LeaveModule: 상태 설정 검증`, {
        hasState: !!verifyState,
        stateMatches:
          verifyState?.state ===
          this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT,
        totalStates: this.userInputStates.size,
        allUserIds: Array.from(this.userInputStates.keys())
      });

      // 1분 후 자동 정리
      setTimeout(() => {
        if (this.userInputStates.has(userId)) {
          this.userInputStates.delete(userId);
          logger.info(
            `⏰ LeaveModule: 사용자 ${userId} 입력 대기 시간 초과로 정리됨`
          );
        }
      }, this.config.inputTimeout);

      logger.info(`✅ LeaveModule: 직접 입력 준비 완료 - 사용자 ${userId}`);

      return {
        type: "custom_input_prompt",
        module: "leave",
        data: {
          remainingLeave,
          maxDays: this.config.maxContinuousDays,
          allowedIncrements: this.config.allowedIncrements,
          examples: ["1.5", "2", "3", "2.5"]
        }
      };
    } catch (error) {
      logger.error("❌ LeaveModule.startCustomInput 실패:", error);
      return this.createErrorResult("직접 입력을 시작할 수 없습니다.");
    }
  }

  // ===== 🎯 4. 텍스트 메시지 처리 =====

  /**
   * 📝 일반 메시지 처리 (직접 상태에 따라 분기)
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg.from);
      const inputText = msg.text?.trim();

      logger.debug(`📝 LeaveModule.onHandleMessage 호출됨:`, {
        userId,
        inputText,
        hasInputState: this.userInputStates.has(userId),
        inputStatesSize: this.userInputStates.size
      });

      const inputState = this.userInputStates.get(userId);

      // 입력 대기 상태가 아니면 무시
      if (!inputState) {
        logger.debug(`📝 LeaveModule: 입력 대기 상태 아님`);
        return false;
      }

      // 취소 명령 처리 (공통)
      if (inputText === "/cancel" || inputText === "취소") {
        logger.info(`📝 LeaveModule: 입력 취소 처리`);
        this.userInputStates.delete(userId);

        const cancelResult = {
          type: "input_cancelled",
          module: "leave",
          data: {
            message:
              inputState.state ===
              this.constants.INPUT_STATES.WAITING_JOIN_DATE_INPUT
                ? "입사일 입력이 취소되었습니다."
                : "연차 입력이 취소되었습니다.",
            userId
          }
        };

        await this.sendResultToRenderer(cancelResult, bot, msg);
        logger.info(`✅ LeaveModule: 취소 처리 완료`);
        return true;
      }

      // 상태별 처리 분기
      switch (inputState.state) {
        case this.constants.INPUT_STATES.WAITING_CUSTOM_AMOUNT:
          return await this.handleCustomAmountInput(
            bot,
            msg,
            userId,
            inputText,
            inputState
          );

        case this.constants.INPUT_STATES.WAITING_JOIN_DATE_INPUT:
          return await this.handleJoinDateInput(
            bot,
            msg,
            userId,
            inputText,
            inputState
          );

        default:
          logger.debug(`📝 LeaveModule: 알 수 없는 입력 상태`, {
            state: inputState.state
          });
          return false;
      }
    } catch (error) {
      logger.error("❌ LeaveModule.onHandleMessage 실패:", error);

      // 에러 시 입력 상태 정리
      const userId = getUserId(msg.from);
      this.userInputStates.delete(userId);
      logger.debug(`🧹 LeaveModule: 에러로 인한 입력 상태 정리`);

      const criticalErrorResult = {
        type: "error",
        module: "leave",
        data: {
          message: "처리 중 오류가 발생했습니다.",
          canRetry: true
        }
      };

      try {
        await this.sendResultToRenderer(criticalErrorResult, bot, msg);
        logger.info(`✅ LeaveModule: 에러 메시지 전송 완료`);
      } catch (renderError) {
        logger.error("❌ LeaveModule: 에러 메시지 전송도 실패:", renderError);
      }

      return true;
    }
  }

  /**
   * 📝 월차소진 커스텀 입력 처리 (기존 로직 분리)
   */
  async handleCustomAmountInput(bot, msg, userId, inputText, inputState) {
    logger.info(`📝 LeaveModule: 연차 입력 처리 시작 - "${inputText}"`);

    // 입력값 검증 및 처리
    logger.debug(`📝 LeaveModule: 입력값 검증 시작 - "${inputText}"`);
    const result = await this.processCustomLeaveInput(
      userId,
      inputText,
      inputState
    );

    logger.debug(`📝 LeaveModule: 검증 결과:`, {
      success: result.success,
      amount: result.amount,
      message: result.message
    });

    if (result.success) {
      logger.info(`📝 LeaveModule: 연차 사용 처리 시작 - ${result.amount}일`);

      // 연차 사용 처리
      const useResult = await this.leaveService.useLeave(
        userId,
        result.amount,
        `직접 입력: ${result.amount}일 연차`
      );

      this.userInputStates.delete(userId);
      logger.debug(`📝 LeaveModule: 입력 상태 정리됨`);

      if (useResult.success) {
        logger.info(`✅ LeaveModule: 연차 사용 성공 - ${result.amount}일`);

        const successResult = {
          type: "use_success",
          module: "leave",
          data: {
            ...useResult.data,
            amount: result.amount,
            leaveType: `직접 입력 ${result.amount}일`,
            message: `${result.amount}일 연차가 사용되었습니다.`
          }
        };

        await this.sendResultToRenderer(successResult, bot, msg);
        logger.info(`✅ LeaveModule: 성공 메시지 전송 완료`);
      } else {
        logger.error(`❌ LeaveModule: 연차 사용 실패 - ${useResult.message}`);

        const errorResult = {
          type: "use_error",
          module: "leave",
          data: {
            message: useResult.message,
            canRetry: true
          }
        };

        await this.sendResultToRenderer(errorResult, bot, msg);
        logger.info(`✅ LeaveModule: 에러 메시지 전송 완료`);
      }
    } else {
      logger.warn(`⚠️ LeaveModule: 입력값 검증 실패 - ${result.message}`);

      const inputErrorResult = {
        type: "input_error",
        module: "leave",
        data: {
          message: result.message,
          remainingLeave: inputState.remainingLeave,
          canRetry: true
        }
      };

      await this.sendResultToRenderer(inputErrorResult, bot, msg);
      logger.info(`✅ LeaveModule: 검증 실패 메시지 전송 완료`);
    }

    logger.info(`✅ LeaveModule: 메시지 처리 완료 - true 반환`);
    return true;
  }

  /**
   * 📅 입사일 입력 처리 (새로 추가)
   */
  async handleJoinDateInput(bot, msg, userId, inputText, inputState) {
    logger.info(`📅 LeaveModule: 입사일 입력 처리 시작 - "${inputText}"`);

    // 입사일 형식 검증
    const result = await this.processJoinDateInput(userId, inputText);

    logger.debug(`📅 LeaveModule: 입사일 검증 결과:`, {
      success: result.success,
      joinDate: result.joinDate,
      message: result.message
    });

    if (result.success) {
      logger.info(`📅 LeaveModule: 입사일 설정 처리 시작 - ${result.joinDate}`);

      // 입사일 설정 처리
      const setResult = await this.leaveService.setJoinDate(
        userId,
        result.joinDate
      );

      this.userInputStates.delete(userId);
      logger.debug(`📅 LeaveModule: 입력 상태 정리됨`);

      if (setResult.success) {
        logger.info(`✅ LeaveModule: 입사일 설정 성공 - ${result.joinDate}`);

        const successResult = {
          type: "settings_success",
          module: "leave",
          data: {
            ...setResult.data,
            action: "joindate",
            message: `입사일이 ${result.joinDate}로 설정되었습니다.`
          }
        };

        await this.sendResultToRenderer(successResult, bot, msg);
        logger.info(`✅ LeaveModule: 성공 메시지 전송 완료`);
      } else {
        logger.error(`❌ LeaveModule: 입사일 설정 실패 - ${setResult.message}`);

        const errorResult = {
          type: "error",
          module: "leave",
          data: {
            message: setResult.message,
            canRetry: true
          }
        };

        await this.sendResultToRenderer(errorResult, bot, msg);
        logger.info(`✅ LeaveModule: 에러 메시지 전송 완료`);
      }
    } else {
      logger.warn(`⚠️ LeaveModule: 입사일 검증 실패 - ${result.message}`);

      const inputErrorResult = {
        type: "input_error",
        module: "leave",
        data: {
          message: result.message,
          canRetry: true
        }
      };

      await this.sendResultToRenderer(inputErrorResult, bot, msg);
      logger.info(`✅ LeaveModule: 검증 실패 메시지 전송 완료`);
    }

    logger.info(`✅ LeaveModule: 입사일 처리 완료 - true 반환`);
    return true;
  }

  /**
   * 📅 입사일 입력값 검증 및 처리
   */
  async processJoinDateInput(userId, inputText) {
    try {
      // 기본 형식 검증 (YYYY-MM-DD)
      const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
      const match = inputText.match(datePattern);

      if (!match) {
        return {
          success: false,
          message: "올바른 날짜 형식이 아닙니다.\n예: 2020-03-15"
        };
      }

      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);

      // 날짜 유효성 검증
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return {
          success: false,
          message: "유효하지 않은 날짜입니다."
        };
      }

      // 미래 날짜 체크
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date > today) {
        return {
          success: false,
          message: "미래의 날짜는 입력할 수 없습니다."
        };
      }

      // 너무 오래된 날짜 체크 (50년 이상)
      const maxYearsAgo = new Date();
      maxYearsAgo.setFullYear(maxYearsAgo.getFullYear() - 50);

      if (date < maxYearsAgo) {
        return {
          success: false,
          message: "50년 이상 전의 날짜는 입력할 수 없습니다."
        };
      }

      return {
        success: true,
        joinDate: inputText,
        message: `입사일: ${inputText}`
      };
    } catch (error) {
      logger.error("📅 processJoinDateInput 실패:", error);
      return {
        success: false,
        message: "날짜 처리 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 🎨 결과를 렌더러로 전달하는 헬퍼 메서드 (새로 추가)
   */
  async sendResultToRenderer(result, bot, msg) {
    try {
      logger.debug(`🎨 LeaveModule: sendResultToRenderer 시작`, {
        resultType: result.type,
        hasModuleManager: !!this.moduleManager,
        hasNavigationHandler: !!this.moduleManager?.navigationHandler,
        hasRenderers: !!this.moduleManager?.navigationHandler?.renderers
      });

      // 1. NavigationHandler를 통해 렌더러 접근 시도
      let renderer = null;

      if (this.moduleManager?.navigationHandler?.renderers) {
        renderer = this.moduleManager.navigationHandler.renderers.get("leave");
        logger.debug(`🎨 LeaveModule: 렌더러 찾기 결과`, {
          hasRenderer: !!renderer,
          rendererCount: this.moduleManager.navigationHandler.renderers.size,
          availableRenderers: Array.from(
            this.moduleManager.navigationHandler.renderers.keys()
          )
        });
      }

      if (renderer) {
        // ctx 객체 생성 (일반 메시지용) - 수정된 부분
        const ctx = {
          chat: msg.chat,
          message: msg,
          from: msg.from,
          telegram: bot.telegram || bot, // Telegraf 호환성
          reply: async (text, options) => {
            // bot.sendMessage 대신 telegram API 사용
            if (bot.telegram) {
              return bot.telegram.sendMessage(msg.chat.id, text, options);
            } else if (bot.sendMessage) {
              return this.sendMessage(msg.chat.id, text, options);
            } else {
              throw new Error("Bot API not found");
            }
          },
          replyWithMarkdown: async (text, options) => {
            const opts = { ...options, parse_mode: "Markdown" };
            if (bot.telegram) {
              return bot.telegram.sendMessage(msg.chat.id, text, opts);
            } else if (bot.sendMessage) {
              return this.sendMessage(msg.chat.id, text, opts);
            }
          },
          replyWithHTML: async (text, options) => {
            const opts = { ...options, parse_mode: "HTML" };
            if (bot.telegram) {
              return bot.telegram.sendMessage(msg.chat.id, text, opts);
            } else if (bot.sendMessage) {
              return this.sendMessage(msg.chat.id, text, opts);
            }
          },
          editMessageText: async (text, options) => {
            // 일반 메시지는 수정할 수 없으므로 새 메시지 전송
            return ctx.reply(text, options);
          }
        };

        logger.info(
          `🎨 LeaveModule: 렌더러를 통해 결과 전송 중 - ${result.type}`
        );
        await renderer.render(result, ctx);
        logger.info(`✅ LeaveModule: 렌더러 전송 완료`);
        return;
      }

      // 2. 렌더러가 없으면 직접 메시지 생성
      logger.warn(
        "⚠️ LeaveModule: LeaveRenderer를 찾을 수 없어서 직접 메시지 생성"
      );
      await this.sendDirectMessage(result, bot, msg);
    } catch (renderError) {
      logger.error("❌ LeaveModule: 렌더러 전달 실패:", renderError);
      await this.sendFallbackMessage(result, bot, msg);
    }
  }

  /**
   * 📨 직접 메시지 전송 (렌더러 없을 때)
   */
  async sendDirectMessage(result, bot, msg) {
    try {
      const message = result.data?.message || "처리가 완료되었습니다.";

      // Telegraf 호환 API 사용
      if (bot.telegram) {
        await bot.telegram.sendMessage(msg.chat.id, message, {
          parse_mode: "Markdown"
        });
      } else if (bot.sendMessage) {
        await MessageHelper.sendMessage(bot, msg.chat.id, message);
      } else {
        logger.error("❌ Bot API를 찾을 수 없습니다");
      }
    } catch (error) {
      logger.error("❌ 직접 메시지 전송 실패:", error);
    }
  }

  /**
   * 🚨 폴백 메시지 전송 (최후의 수단)
   */
  async sendFallbackMessage(result, bot, msg) {
    try {
      const fallbackText = "요청이 처리되었습니다. 다시 시도해주세요.";

      if (bot.telegram) {
        await MessageHelper.sendMessage(bot, msg.chat.id, fallbackText);
      } else if (bot.sendMessage) {
        await MessageHelper.sendMessage(bot, msg.chat.id, fallbackText);
      } else {
        logger.error("❌ Fallback: Bot API를 찾을 수 없습니다");
      }
    } catch (error) {
      logger.error("❌ 폴백 메시지도 전송 실패:", error);
    }
  }

  // ===== 🎯 5. 입력값 검증 및 처리 =====

  /**
   * 📊 사용자 입력 연차량 처리
   */
  async processCustomLeaveInput(userId, inputText, inputState) {
    try {
      // 숫자 추출 및 검증
      const cleanInput = inputText.replace(/[^0-9.]/g, "");
      const amount = parseFloat(cleanInput);

      // 기본 검증
      if (isNaN(amount) || amount <= 0) {
        return {
          success: false,
          message: "올바른 숫자를 입력해주세요.\n예: 1, 1.5, 2, 2.5"
        };
      }

      // 최대 연차량 체크
      if (amount > this.config.maxContinuousDays) {
        return {
          success: false,
          message: `최대 ${this.config.maxContinuousDays}일까지만 사용 가능합니다.`
        };
      }

      // 잔여 연차 체크
      if (amount > inputState.remainingLeave) {
        return {
          success: false,
          message: `잔여 연차가 부족합니다.\n요청: ${amount}일, 잔여: ${inputState.remainingLeave}일`
        };
      }

      // 0.25 단위 체크
      const remainder = (amount * 4) % 1;
      if (remainder !== 0) {
        return {
          success: false,
          message:
            "0.25일 단위로만 입력 가능합니다.\n예: 0.25, 0.5, 0.75, 1, 1.25, 1.5, ..."
        };
      }

      // 소수점 둘째자리까지만 허용
      const roundedAmount = Math.round(amount * 100) / 100;

      return {
        success: true,
        amount: roundedAmount,
        message: `${roundedAmount}일 연차 사용`
      };
    } catch (error) {
      logger.error("📊 processCustomLeaveInput 실패:", error);
      return {
        success: false,
        message: "입력 처리 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * ⚙️ 설정 액션 처리 (settings:action:value)
   */
  async handleSettingsAction(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const [action, value] = params.split(":");

      let result;

      switch (action) {
        case this.constants.SETTINGS_ACTIONS.ADD:
          // 연차 추가 (settings:add:1)
          const addAmount = parseInt(value) || 1;
          result = await this.leaveService.addLeave(
            userId,
            addAmount,
            "수동 추가"
          );
          break;

        case this.constants.SETTINGS_ACTIONS.REMOVE:
          // 연차 삭제 (settings:remove:1)
          const removeAmount = parseInt(value) || 1;
          result = await this.leaveService.removeLeave(
            userId,
            removeAmount,
            "수동 삭제"
          );
          break;

        case this.constants.SETTINGS_ACTIONS.JOIN_DATE:
          // 👇 입사일 입력을 기다리는 상태로 설정합니다.
          this.userInputStates.set(userId, {
            state: this.constants.INPUT_STATES.WAITING_JOIN_DATE_INPUT,
            timestamp: Date.now()
          });

          // 1분 후 자동 정리
          setTimeout(() => {
            if (this.userInputStates.has(userId)) {
              this.userInputStates.delete(userId);
              logger.info(
                `⏰ LeaveModule: 사용자 ${userId} 입사일 입력 대기 시간 초과`
              );
            }
          }, this.config.inputTimeout);

          return {
            type: "joindate_prompt", // 렌더러가 프롬프트를 표시하도록 함
            module: "leave",
            data: {
              message: "입사일을 'YYYY-MM-DD' 형식으로 입력해주세요."
            }
          };

        default:
          return this.createErrorResult(`지원하지 않는 설정 액션: ${action}`);
      }

      if (!result || !result.success) {
        return this.createErrorResult(result?.message || "설정 처리 실패");
      }

      return {
        type: "settings_success",
        module: "leave",
        data: {
          ...result.data,
          action,
          value
        }
      };
    } catch (error) {
      logger.error("⚙️ LeaveModule.handleSettingsAction 실패:", error);
      return this.createErrorResult("설정 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🛠️ 헬퍼 메서드들
   */

  /**
   * 🛠️ 에러 결과 생성 (수정된 버전)
   */
  createErrorResult(message) {
    return {
      type: "error",
      module: "leave",
      data: {
        message: message || "알 수 없는 오류가 발생했습니다."
      } // ✅ data 객체에 message 포함
    };
  }

  /**
   * 📊 모듈 상태 조회 (표준 패턴)
   */
  getStatus() {
    return {
      ...super.getStatus(),
      features: [
        "개인 연차 현황",
        "월별 사용량",
        "연차 사용 기록 (고정 + 직접 입력)", // ✅ 업데이트
        "연차 설정 관리",
        "입사일 기반 보너스"
      ],
      inputStates: {
        activeUsers: this.userInputStates.size,
        waitingInputs: Array.from(this.userInputStates.keys())
      },
      constants: this.constants,
      version: "2.1.0-custom-input"
    };
  }

  /**
   * 🧹 모듈 정리 (표준 패턴)
   */
  async cleanup() {
    try {
      // 모든 사용자 입력 상태 정리
      this.userInputStates.clear();

      await super.cleanup();
      this.leaveService = null;
      logger.debug("🧹 LeaveModule 정리 완료 (입력 상태 포함)");
    } catch (error) {
      logger.error("❌ LeaveModule 정리 실패:", error);
    }
  }
}

module.exports = LeaveModule;
