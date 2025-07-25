// src/modules/BaseModule.js - 모든 모듈의 부모 클래스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏗️ 베이스 모듈 - 모든 모듈의 부모 클래스
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 * - 공통 기능 제공
 * - Railway 환경 최적화
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.config = options.config || {};

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      lastActivity: null,
    };

    // ⏱️ 설정
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      ...options.config,
    };

    this.isInitialized = false;
    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`);
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
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 서비스 연결, DB 초기화 등
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 매개변수 검증
      if (
        !this.validateCallbackParams(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        )
      ) {
        return false;
      }

      // 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 액션 실행
      const action = this.actionMap.get(subAction);
      if (!action) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await this.sendActionNotFound(bot, callbackQuery, subAction);
        return false;
      }

      // 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);

      logger.debug(`✅ ${this.moduleName}.${subAction} 처리 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리
   */
  async handleMessage(bot, msg) {
    try {
      // 메시지 검증
      if (!this.validateMessageParams(bot, msg)) {
        return false;
      }

      // 통계 업데이트
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 자식 클래스의 메시지 처리 로직
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`✅ ${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 액션 등록
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
   * 매개변수 검증 - 콜백
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot || !callbackQuery) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
      return false;
    }

    if (!callbackQuery.message || !callbackQuery.from) {
      logger.error(`${this.moduleName}: callbackQuery 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 매개변수 검증 - 메시지
   */
  validateMessageParams(bot, msg) {
    if (!bot || !msg) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
      return false;
    }

    if (!msg.chat || !msg.from) {
      logger.error(`${this.moduleName}: 메시지 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (!text || !text.startsWith("/")) {
      return null;
    }
    return text.split(" ")[0].substring(1).toLowerCase();
  }

  /**
   * 사용자 상태 관리
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
      module: this.moduleName,
    });
  }

  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  clearUserState(userId) {
    this.userStates.delete(userId.toString());
  }

  /**
   * 메시지 전송 (안전한 버전)
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 전송 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        return await bot.sendMessage(chatId, text, {
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 재전송 실패:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * 메시지 편집 (안전한 버전)
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 편집 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        return await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 재편집 실패:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❌ **${this.moduleName} 오류**

${message}

잠시 후 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 다시 시도",
              callback_data: `${this.moduleName.toLowerCase()}:menu`,
            },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 에러 메시지 전송 실패:`, error);
    }
  }

  /**
   * 액션 없음 메시지
   */
  async sendActionNotFound(bot, callbackQuery, action) {
    await this.sendError(
      bot,
      callbackQuery,
      `"${action}" 기능을 찾을 수 없습니다.`
    );
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: this.stats,
      activeUserStates: this.userStates.size,
      availableActions: Array.from(this.actionMap.keys()),
      config: this.config,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 사용자 상태 정리
      this.userStates.clear();

      // 액션 맵 정리
      this.actionMap.clear();

      // 자식 클래스의 정리 로직
      await this.onCleanup();

      this.isInitialized = false;

      logger.info(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }

  /**
   * 자식 클래스에서 구현할 정리 메서드
   */
  async onCleanup() {
    // 자식 클래스에서 구현
  }
}

module.exports = BaseModule;
