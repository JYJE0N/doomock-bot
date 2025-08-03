// src/core/BaseModule.js
const logger = require("../utils/Logger");

/**
 * 🏗️ BaseModule - 모든 모듈의 부모 클래스
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.moduleManager = options.moduleManager;
    this.serviceBuilder = options.serviceBuilder;
    this.actionMap = new Map();
    this.isInitialized = false;
    this.config = options.config || {};

    logger.info(`📦 ${moduleName} 모듈 생성됨`);
  }

  /**
   * 모듈 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // 하위 클래스의 초기화 메서드 호출
      await this.onInitialize();

      // 액션 등록
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
   * 하위 클래스에서 구현해야 할 초기화 메서드
   */
  async onInitialize() {
    // 하위 클래스에서 구현
  }

  /**
   * 콜백 처리
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const handler = this.actionMap.get(subAction);

      if (!handler) {
        logger.warn(`❓ ${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        return {
          type: "error",
          message: `알 수 없는 액션입니다: ${subAction}`,
          module: this.moduleName
        };
      }

      // 핸들러 실행
      const result = await handler.call(this, bot, callbackQuery, subAction, params, moduleManager);

      return result;
    } catch (error) {
      logger.error(`💥 ${this.moduleName} 콜백 처리 오류:`, error);
      return {
        type: "error",
        message: "처리 중 오류가 발생했습니다.",
        module: this.moduleName,
        error: error.message
      };
    }
  }

  /**
   * 메시지 처리
   */
  async handleMessage(bot, msg) {
    if (this.onHandleMessage) {
      return await this.onHandleMessage(bot, msg);
    }
    return false;
  }

  /**
   * 액션 등록 헬퍼
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      if (typeof handler !== "function") {
        logger.warn(`⚠️ ${this.moduleName}: ${action} 액션의 핸들러가 함수가 아닙니다`);
        continue;
      }
      this.actionMap.set(action, handler.bind(this));
    }
  }

  /**
   * 모듈 정리
   */
  async cleanup() {
    try {
      if (this.onCleanup) {
        await this.onCleanup();
      }
      this.actionMap.clear();
      logger.debug(`🧹 ${this.moduleName} 모듈 정리됨`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      actionCount: this.actionMap.size,
      actions: Array.from(this.actionMap.keys())
    };
  }
}

module.exports = BaseModule;
