// src/core/BaseModule.js - 모든 모듈의 표준 부모 클래스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 모든 모듈의 기본 클래스
 * - 표준화된 콜백 처리
 * - actionMap 기반 라우팅
 * - 공통 유틸리티 메서드
 */
class BaseModule {
  constructor(name, options = {}) {
    this.name = name;
    this.bot = options.bot || null;
    this.db = options.db || null;
    this.moduleManager = options.moduleManager || null;

    // 액션 맵 초기화
    this.actionMap = new Map();

    // 공통 설정
    this.config = {
      enableLogging: true,
      responseTimeout: 5000,
      ...options.config,
    };

    // 초기화 플래그
    this.isInitialized = false;

    // 액션 설정 (자식 클래스에서 구현)
    this.setupActions();

    logger.info(`📦 ${this.name} 모듈 생성됨`);
  }

  /**
   * 모듈 초기화 (비동기)
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
   * 액션 등록 메서드
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerAction('menu', this.showMenu);
  }

  /**
   * 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 액션 등록: ${this.name}.${name}`);
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
   * 표준 콜백 처리 메서드
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
      await this.handleError(bot, callbackQuery, error);
      return false;
    }
  }

  /**
   * 메시지 처리 메서드
   */
  async handleMessage(bot, msg) {
    try {
      // 자식 클래스에서 구현
      return await this.onHandleMessage(bot, msg);
    } catch (error) {
      logger.error(`${this.name} 메시지 처리 오류:`, error);
      await this.sendError(bot, msg.chat.id, error);
      return false;
    }
  }

  // ===== 공통 유틸리티 메서드 =====

  /**
   * 메시지 전송 (래퍼)
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error("메시지 전송 실패:", error);
      throw error;
    }
  }

  /**
   * 메시지 수정 (래퍼)
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
      logger.error("메시지 수정 실패:", error);
      throw error;
    }
  }

  /**
   * 에러 처리
   */
  async handleError(bot, callbackQuery, error) {
    const errorMessage =
      "⚠️ 처리 중 오류가 발생했습니다.\\n잠시 후 다시 시도해주세요.";

    if (callbackQuery.message) {
      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        errorMessage,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 돌아가기", callback_data: "main:menu" }],
            ],
          },
        }
      );
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, chatId, error) {
    const errorMessage =
      "⚠️ 처리 중 오류가 발생했습니다.\\n잠시 후 다시 시도해주세요.";
    await this.sendMessage(bot, chatId, errorMessage);
  }

  /**
   * 로딩 메시지 표시
   */
  async showLoading(bot, chatId, messageId, text = "처리 중...") {
    return await this.editMessage(bot, chatId, messageId, `⏳ ${text}`);
  }

  /**
   * 사용자 이름 가져오기 (헬퍼)
   */
  getUserName(from) {
    return getUserName(from);
  }

  /**
   * 현재 한국 시간 가져오기 (헬퍼)
   */
  getKoreanTime() {
    return TimeHelper.getKoreanTime();
  }

  /**
   * 날짜 포맷팅 (헬퍼)
   */
  formatDate(date, format = "YYYY-MM-DD HH:mm") {
    return TimeHelper.formatDate(date, format);
  }

  // ===== 자식 클래스에서 구현할 메서드 =====

  /**
   * 모듈별 초기화 로직
   */
  async onInitialize() {
    // 자식 클래스에서 구현
  }

  /**
   * 메시지 처리 로직
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  /**
   * 모듈 정리
   */
  async cleanup() {
    logger.info(`🧹 ${this.name} 정리 중...`);
    this.actionMap.clear();
    this.isInitialized = false;
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.isInitialized,
      actions: Array.from(this.actionMap.keys()),
      actionCount: this.actionMap.size,
    };
  }
}

module.exports = BaseModule;
