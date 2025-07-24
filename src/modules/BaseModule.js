// src/modules/BaseModule.js - 리팩토링된 기본 모듈 클래스
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
    this.setupActions();

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
      // 자식 클래스의 초기화 로직 호출
      await this.onInitialize();
      this.isInitialized = true;
      logger.info(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 자식 클래스에서 오버라이드할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
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
    // 자식 클래스에서 오버라이드
    return false;
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
      // 액션 찾기
      const action = this.actionMap.get(subAction);

      if (!action) {
        logger.warn(`알 수 없는 액션: ${this.name}.${subAction}`);
        return false;
      }

      // 콜백 응답
      await bot.answerCallbackQuery(callbackQuery.id);

      // 액션 실행 (표준 매개변수 전달)
      await action(bot, callbackQuery, params, moduleManager);

      return true;
    } catch (error) {
      logger.error(`${this.name} 콜백 처리 오류:`, error);

      // 에러 응답
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (err) {
        logger.error("콜백 응답 실패:", err);
      }

      return false;
    }
  }

  /**
   * 🎯 메시지 전송 헬퍼
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      const defaultOptions = {
        parse_mode: "Markdown",
        ...options,
      };
      return await bot.sendMessage(chatId, text, defaultOptions);
    } catch (error) {
      logger.error(`${this.name} 메시지 전송 오류:`, error);

      // Markdown 파싱 오류시 일반 텍스트로 재시도
      if (error.code === "ETELEGRAM" && error.description?.includes("parse")) {
        try {
          const fallbackOptions = { ...options };
          delete fallbackOptions.parse_mode;
          return await bot.sendMessage(chatId, text, fallbackOptions);
        } catch (fallbackError) {
          logger.error(`${this.name} 메시지 재전송 실패:`, fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * 🎯 메시지 수정 헬퍼
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      const defaultOptions = {
        parse_mode: "Markdown",
        ...options,
      };
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...defaultOptions,
      });
    } catch (error) {
      logger.error(`${this.name} 메시지 수정 오류:`, error);

      // Markdown 파싱 오류시 일반 텍스트로 재시도
      if (error.code === "ETELEGRAM" && error.description?.includes("parse")) {
        try {
          const fallbackOptions = { ...options };
          delete fallbackOptions.parse_mode;
          return await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            ...fallbackOptions,
          });
        } catch (fallbackError) {
          logger.error(`${this.name} 메시지 수정 재시도 실패:`, fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * 🎯 에러 처리 헬퍼
   */
  async handleError(bot, callbackQuery, error) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    logger.error(`${this.name} 오류:`, error);

    const errorText = `❌ **오류 발생**

처리 중 오류가 발생했습니다.
잠시 후 다시 시도해주세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main:menu" }]],
    };

    try {
      await this.editMessage(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (editError) {
      logger.error("에러 메시지 전송 실패:", editError);
    }
  }

  /**
   * 🎯 사용자 상태 관리
   */
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  /**
   * 🎯 모듈 활성화/비활성화
   */
  setActive(active) {
    this.isActive = active;
    logger.info(`${this.name} 모듈 ${active ? "활성화" : "비활성화"}`);
  }

  /**
   * 🎯 모듈 정리
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.name} 모듈 정리 중...`);

      // 사용자 상태 초기화
      this.userStates.clear();

      // 액션 맵 초기화
      this.actionMap.clear();

      // 자식 클래스의 정리 로직 호출
      await this.onCleanup();

      this.isInitialized = false;
      logger.info(`✅ ${this.name} 모듈 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.name} 모듈 정리 실패:`, error);
    }
  }

  /**
   * 🎯 자식 클래스에서 오버라이드할 정리 메서드
   */
  async onCleanup() {
    // 자식 클래스에서 구현
  }

  /**
   * ✅ 명령어 추출 유틸리티
   */
  extractCommand(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    // "/command" 형태 처리
    if (text.startsWith("/")) {
      return text.substring(1).split(" ")[0].toLowerCase();
    }

    // 일반 텍스트에서 명령어 추출
    return text.toLowerCase().trim();
  }
}

module.exports = BaseModule;
