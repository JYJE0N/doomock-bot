// src/core/BaseModule.js - 간단한 버전
const logger = require("../utils/Logger");

/**
 * 🏗️ BaseModule - 모든 모듈의 부모 클래스
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.config = options.config || {};

    // 액션 맵
    this.actionMap = new Map();

    // 사용자 상태
    this.userStates = new Map();

    // 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
    };

    this.isInitialized = false;
    logger.info(`🏗️ ${moduleName} 모듈 생성됨`);
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화
      if (this.onInitialize) {
        await this.onInitialize();
      }

      // 액션 설정
      if (this.setupActions) {
        this.setupActions();
      }

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 액션 등록
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      this.actionMap.set(action, handler.bind(this));
    }
  }

  /**
   * 콜백 처리
   */
  /**
   * 콜백 처리
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbacksHandled++;

      const handler = this.actionMap.get(subAction);
      if (handler) {
        // [수정] 핸들러의 결과(UI 데이터)를 반환하도록 변경
        return await handler(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      } else {
        logger.warn(`알 수 없는 액션: ${this.moduleName}:${subAction}`);
        // [수정] 직접 응답하는 대신 에러 객체 반환
        return { type: "error", message: "알 수 없는 명령입니다." };
      }
    } catch (error) {
      logger.error(`${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      // [수정] 중복 호출되던 answerCallbackQuery 제거하고 에러 객체 반환
      return { type: "error", message: "처리 중 오류가 발생했습니다." };
    }
  }

  /**
   * 메시지 처리 가능 여부
   */
  async canHandleMessage(msg) {
    // 기본적으로 false, 자식 클래스에서 구현
    return false;
  }

  /**
   * 메시지 편집 헬퍼
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      await bot.telegram.editMessageText(chatId, messageId, null, text, {
        parse_mode: "MarkdownV2",
        ...options,
      });
    } catch (error) {
      logger.error("메시지 편집 실패:", error);
    }
  }

  /**
   * 메시지 전송 헬퍼
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.telegram.sendMessage(chatId, text, {
        parse_mode: "MarkdownV2",
        ...options,
      });
    } catch (error) {
      logger.error("메시지 전송 실패:", error);
    }
  }

  /**
   * 정리
   */
  async cleanup() {
    logger.info(`🧹 ${this.moduleName} 정리 중...`);
    this.userStates.clear();
    this.actionMap.clear();
  }
}

module.exports = BaseModule;
