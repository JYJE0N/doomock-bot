// src/modules/BaseModule.js - 리팩토링된 기본 모듈 클래스 (로거 오류 수정)
const logger = require("../utils/Logger");

/**
 * 기본 모듈 클래스
 * - 모든 모듈이 상속받는 베이스 클래스
 * - 표준화된 인터페이스 제공
 * - 공통 기능 구현
 */
class BaseModule {
  constructor(name, options = {}) {
    this.name = name;
    this.bot = options.bot;
    this.db = options.db || null;
    this.moduleManager = options.moduleManager || null;

    // 액션 맵
    this.actionMap = new Map();
    this.userStates = new Map();

    // 공통 설정
    this.config = {
      enableLogging: true,
      responseTimeout: 5000,
      ...options.config,
    };

    // 초기화 플래그
    this.isInitialized = false;
    this.isActive = true;

    // 액션 설정 (자식 클래스에서 구현)
    // this.setupActions();

    logger.info(`📦 ${this.name} 모듈 생성됨`);
  }

  /**
   * 🎯 모듈 초기화 (비동기)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      // ✅ setupActions를 여기서 호출
      if (typeof this.setupActions === "function") {
        this.setupActions();
      }

      // 자식 클래스의 초기화 로직 호출
      await this.onInitialize();
      this.isInitialized = true;
      logger.info(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 명령어 추출 메서드
  extractCommand(text) {
    if (!text || typeof text !== "string") return null;

    // 슬래시 명령어 처리
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      return {
        command: parts[0].substring(1),
        args: parts.slice(1).join(" "),
      };
    }

    return null;
  }

  // 에러 전송 메서드 추가
  async sendError(chatId, errorMessage = "처리 중 오류가 발생했습니다.") {
    try {
      await this.bot.sendMessage(chatId, `❌ ${errorMessage}`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error(`${this.name} 에러 메시지 전송 실패:`, error);
    }
  }

  //에러
  async handleError(bot, callbackQuery, error) {
    logger.error(`${this.name} 에러:`, error);

    try {
      // 콜백 응답
      if (callbackQuery.id) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      }
    } catch (answerError) {
      logger.error("콜백 응답 실패:", answerError);
    }
  }

  /**
   * 🎯 액션 등록 메서드 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerAction('menu', this.showMenu);
  }

  /**
   * 🎯 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 액션 등록: ${this.name}.${name}`);
  }

  /**
   * 🎯 여러 액션 한번에 등록
   */
  registerActions(actions) {
    for (const [name, handler] of Object.entries(actions)) {
      this.registerAction(name, handler);
    }
  }

  /**
   * 🎯 메시지 처리 메서드
   * @param {Object} bot - 텔레그램 봇 인스턴스
   * @param {Object} msg - 메시지 객체
   * @returns {boolean} - 처리 여부
   */
  async handleMessage(bot, msg) {
    try {
      // 자식 클래스에서 onHandleMessage 구현
      if (this.onHandleMessage) {
        return await this.onHandleMessage(bot, msg);
      }
      return false;
    } catch (error) {
      logger.error(`${this.name} 메시지 처리 오류:`, error);
      return false;
    }
  }

  /**
   * 🎯 표준 콜백 처리 메서드
   * @param {Object} bot - 텔레그램 봇 인스턴스
   * @param {Object} callbackQuery - 콜백 쿼리 객체
   * @param {string} subAction - 서브 액션 (예: 'menu', 'list')
   * @param {Array} params - 추가 매개변수
   * @param {Object} moduleManager - 모듈 매니저
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // ✅ null/undefined 체크 강화
      if (!callbackQuery) {
        logger.error(`${this.name}: callbackQuery가 null 또는 undefined입니다`);
        return false;
      }

      if (!subAction) {
        logger.warn(`${this.name}: subAction이 없습니다. 'menu'로 대체합니다.`);
        subAction = "menu";
      }

      const action = this.actionMap.get(subAction);

      if (!action) {
        logger.warn(`${this.name}: 알 수 없는 액션 - ${subAction}`);

        // 사용자에게 친화적인 메시지 전송
        if (callbackQuery.message && callbackQuery.message.chat) {
          await this.sendMessage(
            bot,
            callbackQuery.message.chat.id,
            `⚠️ 요청하신 기능(${subAction})을 찾을 수 없습니다.`
          );
        }

        return false;
      }

      // 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);
      return true;
    } catch (error) {
      // ✅ logger 직접 사용 (this.logger가 아닌!)
      logger.error(`${this.name} 콜백 처리 오류:`, error);

      // 에러 시 사용자에게 알림
      try {
        if (
          callbackQuery &&
          callbackQuery.message &&
          callbackQuery.message.chat
        ) {
          const chatId = callbackQuery.message.chat.id;
          await this.sendMessage(
            bot,
            chatId,
            "❌ 처리 중 오류가 발생했습니다."
          );
        }
      } catch (sendError) {
        logger.error(`${this.name} 에러 메시지 전송 실패:`, sendError);
      }

      return false;
    }
  }
  /**
   * 🎯 자식 클래스에서 오버라이드할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
  }

  /**
   * 🎯 자식 클래스에서 오버라이드할 메시지 처리 메서드
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  /**
   * 🎯 사용자 상태 관리
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now(),
    });
    logger.debug(`${this.name}: 사용자 상태 설정 - ${userId}`);
  }

  getUserState(userId) {
    return this.userStates.get(userId);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
    logger.debug(`${this.name}: 사용자 상태 삭제 - ${userId}`);
  }

  /**
   * 🎯 메시지 전송 헬퍼
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.name} 메시지 전송 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 메시지 수정 헬퍼
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
      logger.error(`${this.name} 메시지 수정 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 키보드 생성 헬퍼
   */
  createInlineKeyboard(buttons) {
    return {
      inline_keyboard: buttons,
    };
  }

  /**
   * 🎯 모듈 상태 확인
   */
  isModuleActive() {
    return this.isActive && this.isInitialized;
  }

  /**
   * 🎯 모듈 비활성화
   */
  deactivate() {
    this.isActive = false;
    logger.info(`${this.name} 모듈 비활성화됨`);
  }

  /**
   * 🎯 모듈 활성화
   */
  activate() {
    this.isActive = true;
    logger.info(`${this.name} 모듈 활성화됨`);
  }

  /**
   * 🎯 정리 메서드 (종료 시 호출)
   */
  async cleanup() {
    this.userStates.clear();
    this.actionMap.clear();
    logger.info(`${this.name} 모듈 정리 완료`);
  }
}

module.exports = BaseModule;
