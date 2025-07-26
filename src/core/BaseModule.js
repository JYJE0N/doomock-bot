// src/core/BaseModule.js - 메시지 편집 및 콜백 처리 문제 해결 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ BaseModule v3.0.1 - 메시지 편집 및 콜백 처리 문제 해결
 *
 * 🎯 해결된 문제들:
 * 1. 메시지 편집 실패 문제 (안전한 fallback)
 * 2. 콜백 처리 매개변수 표준화
 * 3. 에러 핸들링 강화
 * 4. Markdown 파싱 오류 대응
 * 5. 텔레그램 API 제한 대응
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.serviceBuilder = options.serviceBuilder;

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      messageEditAttempts: 0,
      messageEditFailures: 0,
      lastActivity: null,
    };

    // ⏱️ 설정
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      enableSafeMessageEdit: true, // 안전한 메시지 편집
      enableFallbackText: true, // fallback 텍스트 사용
      retryDelay: 1000, // 재시도 간격
      ...options.config,
    };

    // 🔒 상태 관리
    this.isInitialized = false;
    this.editOperationsInProgress = new Set(); // 편집 작업 추적

    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨 (메시지 편집 문제 해결)`);
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 표준 콜백 처리 (매개변수 문제 해결)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 🔍 매개변수 검증 및 정규화
      const {
        normalizedBot,
        normalizedCallbackQuery,
        normalizedSubAction,
        normalizedParams,
        normalizedModuleManager,
      } = this.normalizeCallbackParams(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      // 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 액션 실행
      const action = this.actionMap.get(normalizedSubAction);
      if (!action) {
        logger.warn(
          `${this.moduleName}: 알 수 없는 액션 - ${normalizedSubAction}`
        );
        await this.sendActionNotFoundSafely(
          normalizedBot,
          normalizedCallbackQuery,
          normalizedSubAction
        );
        return false;
      }

      // 🎯 표준 매개변수로 액션 실행 (안전한 방식)
      await this.executeActionSafely(
        action,
        normalizedBot,
        normalizedCallbackQuery,
        normalizedParams,
        normalizedModuleManager
      );

      logger.debug(
        `✅ ${this.moduleName}.${normalizedSubAction} 처리 완료 (${
          Date.now() - startTime
        }ms)`
      );
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      await this.sendErrorSafely(
        bot,
        callbackQuery,
        "처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🔧 매개변수 정규화 (안전한 처리)
   */
  normalizeCallbackParams(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // bot 정규화
    const normalizedBot = bot || this.bot;

    // callbackQuery 정규화
    let normalizedCallbackQuery = callbackQuery;
    if (!normalizedCallbackQuery || !normalizedCallbackQuery.message) {
      logger.warn(`${this.moduleName}: 잘못된 callbackQuery 구조`);
      normalizedCallbackQuery = this.createFallbackCallbackQuery(callbackQuery);
    }

    // subAction 정규화
    let normalizedSubAction = subAction;
    if (!normalizedSubAction || typeof normalizedSubAction !== "string") {
      // callbackQuery.data에서 추출 시도
      if (normalizedCallbackQuery.data) {
        const parts = normalizedCallbackQuery.data.split(":");
        normalizedSubAction = parts[1] || "menu";
      } else {
        normalizedSubAction = "menu";
      }
    }

    // params 정규화
    const normalizedParams = Array.isArray(params) ? params : [];

    // moduleManager 정규화
    const normalizedModuleManager = moduleManager || this.moduleManager;

    return {
      normalizedBot,
      normalizedCallbackQuery,
      normalizedSubAction,
      normalizedParams,
      normalizedModuleManager,
    };
  }

  /**
   * 🛡️ Fallback CallbackQuery 생성
   */
  createFallbackCallbackQuery(originalCallbackQuery) {
    const fallback = {
      id: originalCallbackQuery?.id || `fallback_${Date.now()}`,
      from: originalCallbackQuery?.from || { id: 0, first_name: "Unknown" },
      data: originalCallbackQuery?.data || `${this.moduleName}:menu`,
      message: originalCallbackQuery?.message || {
        message_id: 0,
        chat: { id: originalCallbackQuery?.from?.id || 0 },
        text: "메시지를 찾을 수 없습니다.",
      },
    };

    logger.warn(`${this.moduleName}: Fallback CallbackQuery 생성됨`);
    return fallback;
  }

  /**
   * 🎯 안전한 액션 실행
   */
  async executeActionSafely(action, bot, callbackQuery, params, moduleManager) {
    try {
      // 액션 함수 바인딩 확인
      if (typeof action !== "function") {
        throw new Error(`액션이 함수가 아닙니다: ${typeof action}`);
      }

      // 표준 매개변수로 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);
    } catch (actionError) {
      logger.error(`${this.moduleName} 액션 실행 오류:`, actionError);

      // 에러 액션 처리 시도
      try {
        await this.handleActionError(bot, callbackQuery, actionError);
      } catch (errorHandlingError) {
        logger.error(
          `${this.moduleName} 에러 액션 처리도 실패:`,
          errorHandlingError
        );

        // 최후의 수단: 간단한 메시지
        try {
          await this.sendSimpleErrorMessage(bot, callbackQuery);
        } catch (finalError) {
          logger.error(`${this.moduleName} 최종 에러 처리도 실패:`, finalError);
        }
      }

      throw actionError;
    }
  }

  /**
   * 🛡️ 안전한 메시지 편집 (핵심 해결책!)
   */
  async editMessageSafely(bot, chatId, messageId, text, options = {}) {
    const operationId = `${chatId}-${messageId}-${Date.now()}`;

    // 중복 편집 방지
    if (this.editOperationsInProgress.has(operationId)) {
      logger.debug(
        `${this.moduleName}: 중복 메시지 편집 방지 - ${operationId}`
      );
      return false;
    }

    this.editOperationsInProgress.add(operationId);
    this.stats.messageEditAttempts++;

    try {
      // 1차 시도: Markdown 모드
      try {
        const result = await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          ...options,
        });

        logger.debug(`✅ ${this.moduleName}: 메시지 편집 성공 (Markdown)`);
        return result;
      } catch (markdownError) {
        logger.debug(
          `${this.moduleName}: Markdown 편집 실패, 일반 텍스트로 재시도`
        );

        // 2차 시도: 일반 텍스트
        const result = await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: undefined,
          ...options,
        });

        logger.debug(`✅ ${this.moduleName}: 메시지 편집 성공 (일반 텍스트)`);
        return result;
      }
    } catch (editError) {
      this.stats.messageEditFailures++;
      logger.error(`❌ ${this.moduleName} 메시지 편집 실패:`, editError);

      // 3차 시도: 새 메시지 전송
      if (this.config.enableFallbackText) {
        try {
          const fallbackText = `📝 ${text}\n\n⚠️ 메시지 업데이트 중 문제가 발생했습니다.`;

          const newMessage = await bot.sendMessage(chatId, fallbackText, {
            reply_markup: options.reply_markup,
            parse_mode: undefined,
          });

          logger.warn(`⚠️ ${this.moduleName}: Fallback 메시지 전송됨`);
          return newMessage;
        } catch (fallbackError) {
          logger.error(
            `❌ ${this.moduleName} Fallback 메시지도 실패:`,
            fallbackError
          );
        }
      }

      throw editError;
    } finally {
      this.editOperationsInProgress.delete(operationId);
    }
  }

  /**
   * 🛡️ 안전한 메시지 전송
   */
  async sendMessageSafely(bot, chatId, text, options = {}) {
    try {
      // 1차 시도: Markdown 모드
      try {
        return await bot.sendMessage(chatId, text, {
          parse_mode: "Markdown",
          ...options,
        });
      } catch (markdownError) {
        // 2차 시도: 일반 텍스트
        return await bot.sendMessage(chatId, text, {
          ...options,
          parse_mode: undefined,
        });
      }
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 전송 오류:`, error);
      throw error;
    }
  }

  /**
   * ❌ 안전한 액션 Not Found 처리
   */
  async sendActionNotFoundSafely(bot, callbackQuery, action) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❓ **알 수 없는 액션**\n\n\`${action}\` 기능을 찾을 수 없습니다.\n\n메인 메뉴로 돌아가세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          [{ text: "🔄 새로고침", callback_data: `${this.moduleName}:menu` }],
        ],
      };

      await this.editMessageSafely(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 액션 Not Found 처리 실패:`, error);
      await this.sendSimpleErrorMessage(bot, callbackQuery);
    }
  }

  /**
   * 🚨 안전한 에러 메시지 전송
   */
  async sendErrorSafely(bot, callbackQuery, message) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `🚨 **오류 발생**\n\n${message}\n\n다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 다시 시도", callback_data: `${this.moduleName}:menu` }],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessageSafely(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 에러 메시지 전송 실패:`, error);
      await this.sendSimpleErrorMessage(bot, callbackQuery);
    }
  }

  /**
   * 📝 간단한 에러 메시지 (최후의 수단)
   */
  async sendSimpleErrorMessage(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;

      if (chatId) {
        await bot.sendMessage(
          chatId,
          "❌ 처리 중 오류가 발생했습니다. /start 명령으로 다시 시작해주세요.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 다시 시작", callback_data: "system:start" }],
              ],
            },
          }
        );
      }
    } catch (finalError) {
      logger.error(`${this.moduleName} 최종 에러 메시지 실패:`, finalError);
    }
  }

  /**
   * 🔧 액션 에러 처리
   */
  async handleActionError(bot, callbackQuery, error) {
    const errorMessage = error.message || "알 수 없는 오류";

    // 특정 에러 타입별 처리
    if (errorMessage.includes("message is not modified")) {
      logger.debug(`${this.moduleName}: 메시지 중복 편집 시도 (무시)`);
      return; // 중복 편집은 에러가 아님
    }

    if (errorMessage.includes("message to edit not found")) {
      logger.warn(
        `${this.moduleName}: 편집할 메시지를 찾을 수 없음 - 새 메시지 전송`
      );
      await this.sendFreshMessage(bot, callbackQuery);
      return;
    }

    if (errorMessage.includes("Bad Request")) {
      logger.warn(`${this.moduleName}: 잘못된 요청 - ${errorMessage}`);
      await this.sendErrorSafely(bot, callbackQuery, "잘못된 요청입니다.");
      return;
    }

    // 일반적인 에러 처리
    await this.sendErrorSafely(
      bot,
      callbackQuery,
      "처리 중 오류가 발생했습니다."
    );
  }

  /**
   * 📨 새 메시지 전송 (편집 실패 시)
   */
  async sendFreshMessage(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;

      const freshText = `🔄 **새로운 메뉴**\n\n${this.moduleName} 메뉴입니다.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          [{ text: "🔄 새로고침", callback_data: `${this.moduleName}:menu` }],
        ],
      };

      await this.sendMessageSafely(bot, chatId, freshText, {
        reply_markup: keyboard,
      });

      logger.info(`📨 ${this.moduleName}: 새 메시지 전송됨`);
    } catch (error) {
      logger.error(`${this.moduleName} 새 메시지 전송 실패:`, error);
    }
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 액션 등록 (기존 로직 유지)
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 ${this.moduleName}.${name} 액션 등록됨`);
  }

  /**
   * 여러 액션 한번에 등록
   */
  registerActions(actions) {
    for (const [name, handler] of Object.entries(actions)) {
      this.registerAction(name, handler);
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  /**
   * 📊 모듈 상태 조회
   */
  getModuleStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: this.stats,
      config: this.config,
      activeEditOperations: this.editOperationsInProgress.size,
      lastActivity: this.stats.lastActivity,
    };
  }
}

module.exports = BaseModule;
