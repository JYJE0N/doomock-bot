// src/modules/BaseModule.js - 표준화된 모든 모듈의 부모 클래스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏗️ 모든 모듈의 기본 클래스
 * - 표준화된 콜백 처리
 * - actionMap 기반 라우팅
 * - 공통 유틸리티 메서드
 * - 사용자 상태 관리
 */
class BaseModule {
  constructor(name, options = {}) {
    this.name = name;
    this.bot = options.bot || null;
    this.db = options.db || null;
    this.moduleManager = options.moduleManager || null;

    // 🎯 표준 프로퍼티 초기화 (핵심!)
    this.actionMap = new Map();
    this.userStates = new Map(); // ✅ userStates 초기화 추가

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
   * ✅ 명령어 추출 유틸리티 (WeatherModule 오류 해결)
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
      } catch (answerError) {
        logger.error("콜백 응답 실패:", answerError);
      }

      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리 메서드
   * @param {Object} bot - 텔레그램 봇 인스턴스
   * @param {Object} msg - 메시지 객체
   */
  async handleMessage(bot, msg) {
    try {
      // 자식 클래스의 메시지 처리 로직 호출
      return await this.onHandleMessage(bot, msg);
    } catch (error) {
      logger.error(`${this.name} 메시지 처리 오류:`, error);
      return false;
    }
  }

  /**
   * 🎯 자식 클래스에서 오버라이드할 메시지 처리 메서드
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🛠️ 공통 유틸리티 메서드 =====

  /**
   * 메시지 전송
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`메시지 전송 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 메시지 수정
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
      logger.error(`메시지 수정 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, chatId, errorText = "오류가 발생했습니다.") {
    try {
      await this.sendMessage(bot, chatId, `❌ ${errorText}`);
    } catch (error) {
      logger.error(`에러 메시지 전송 실패: ${error.message}`);
    }
  }

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now(),
      moduleId: this.name,
    });
    logger.debug(`사용자 상태 설정: ${userId} -> ${JSON.stringify(state)}`);
  }

  /**
   * 사용자 상태 가져오기
   */
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  /**
   * 사용자 상태 삭제
   */
  clearUserState(userId) {
    const cleared = this.userStates.delete(userId);
    if (cleared) {
      logger.debug(`사용자 상태 삭제: ${userId}`);
    }
    return cleared;
  }

  /**
   * 한국 시간 포맷팅
   */
  formatKoreanTime(date = new Date()) {
    return TimeHelper.formatKoreanTime(date);
  }

  /**
   * 현재 시간 가져오기
   */
  getCurrentTime() {
    return TimeHelper.getCurrentTime();
  }

  /**
   * 사용자 이름 가져오기
   */
  getUserDisplayName(user) {
    return getUserName(user);
  }

  // ===== 🔧 메타 정보 =====

  /**
   * 모듈 정보 반환
   */
  getModuleInfo() {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      actionCount: this.actionMap.size,
      userStateCount: this.userStates.size,
      actions: Array.from(this.actionMap.keys()),
    };
  }

  /**
   * 모듈 상태 확인
   */
  isReady() {
    return this.isInitialized && this.actionMap.size > 0;
  }
}

module.exports = BaseModule;
