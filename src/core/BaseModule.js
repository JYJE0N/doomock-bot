// src/core/BaseModule.js
// 🏗️ 베이스 모듈 - 모든 모듈의 부모 클래스 (v3.0.1)

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏗️ BaseModule - 모든 모듈이 상속받는 표준 클래스
 *
 * 역할: 표준 구조와 공통 기능 제공
 * 비유: 모든 매장이 지켜야 할 표준 규격
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.config = options.config || {};

    // 액션 맵 (switch문 대신 사용)
    this.actionMap = new Map();

    // 상태
    this.isInitialized = false;
    this.lastActivity = null;

    // 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      createdAt: TimeHelper.now(),
    };
  }

  /**
   * 🎯 초기화 (자식 클래스에서 오버라이드)
   */
  async initialize() {
    try {
      logger.module(this.moduleName, "초기화 시작...");

      // 자식 클래스의 onInitialize 호출
      if (this.onInitialize) {
        await this.onInitialize();
      }

      // 액션 설정
      this.setupActions();

      this.isInitialized = true;
      logger.module(this.moduleName, "✅ 초기화 완료");
    } catch (error) {
      logger.error(`${this.moduleName} 초기화 실패`, error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (자식 클래스에서 호출)
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      this.actionMap.set(action, handler);
    }

    logger.debug(`${this.moduleName}: ${this.actionMap.size}개 액션 등록됨`);
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현 필수!)
   */
  setupActions() {
    throw new Error(`${this.moduleName}: setupActions() 구현 필요`);
  }

  /**
   * 🎯 콜백 처리 (표준 매개변수)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbacksHandled++;
      this.lastActivity = TimeHelper.now();

      // 액션 찾기
      const handler = this.actionMap.get(subAction);
      if (!handler) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await callbackQuery.reply("❌ 알 수 없는 명령입니다.");
        return;
      }

      // 핸들러 실행
      await handler.call(
        this,
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      this.stats.errorsCount++;
      logger.error(`${this.moduleName} 콜백 처리 실패`, error);
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 💬 메시지 처리 가능 여부
   */
  async canHandleMessage(msg) {
    // 기본적으로 false (자식 클래스에서 오버라이드)
    return false;
  }

  /**
   * 💬 메시지 처리 (자식 클래스에서 오버라이드)
   */
  async onHandleMessage(bot, msg) {
    this.stats.messagesHandled++;
    this.lastActivity = TimeHelper.now();

    // 자식 클래스에서 구현
    logger.warn(`${this.moduleName}: onHandleMessage() 구현 필요`);
  }

  /**
   * ❌ 에러 처리
   */
  async handleError(ctx, error) {
    logger.error(`${this.moduleName} 에러`, error);

    try {
      const errorMessage = `❌ 처리 중 오류가 발생했습니다.\n다시 시도해주세요.`;

      if (ctx.editMessageText) {
        await ctx.editMessageText(errorMessage);
      } else if (ctx.reply) {
        await ctx.reply(errorMessage);
      }
    } catch (replyError) {
      logger.error("에러 메시지 전송 실패", replyError);
    }
  }

  /**
   * 📊 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      uptime: TimeHelper.getTimeDiff(this.stats.createdAt, TimeHelper.now()),
      lastActivity: this.lastActivity,
    };
  }

  /**
   * 🏥 헬스 체크
   */
  isHealthy() {
    return this.isInitialized && !this.hasErrors();
  }

  /**
   * ❌ 에러 여부
   */
  hasErrors() {
    // 최근 1분간 에러가 5개 이상이면 unhealthy
    return this.stats.errorsCount > 5;
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      module: this.moduleName,
      initialized: this.isInitialized,
      healthy: this.isHealthy(),
      stats: this.getStats(),
      actionCount: this.actionMap.size,
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.module(this.moduleName, "정리 시작...");

    try {
      // 자식 클래스의 onCleanup 호출
      if (this.onCleanup) {
        await this.onCleanup();
      }

      // 액션 맵 정리
      this.actionMap.clear();

      this.isInitialized = false;
      logger.module(this.moduleName, "✅ 정리 완료");
    } catch (error) {
      logger.error(`${this.moduleName} 정리 실패`, error);
    }
  }

  // ===== 자식 클래스에서 구현할 수 있는 선택적 메서드들 =====

  /**
   * 🎯 초기화 시 호출 (선택적)
   */
  async onInitialize() {
    // 자식 클래스에서 오버라이드
  }

  /**
   * 🧹 정리 시 호출 (선택적)
   */
  async onCleanup() {
    // 자식 클래스에서 오버라이드
  }
}

module.exports = BaseModule;
