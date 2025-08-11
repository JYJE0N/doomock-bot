// src/core/BaseModule.js
const logger = require("../utils/core/Logger");
const MessageHelper = require("../utils/MessageHelper");

/**
 * 🏗️ BaseModule - 모든 모듈의 부모 클래스 (MessageHelper 통합)
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
      const result = await handler.call(
        this,
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

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
        logger.warn(
          `⚠️ ${this.moduleName}: ${action} 액션의 핸들러가 함수가 아닙니다`
        );
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

  // ============================================
  // 🚀 MessageHelper 통합 메서드들 (새로 추가)
  // ============================================

  /**
   * 메시지 전송 (자동 Markdown 파싱)
   */
  async sendMessage(chatId, text, options = {}) {
    return await MessageHelper.sendMessage(this.bot, chatId, text, options);
  }

  /**
   * ctx로 메시지 전송
   */
  async send(ctx, text, options = {}) {
    return await MessageHelper.send(ctx, text, options);
  }

  /**
   * 콜백쿼리에서 메시지 편집
   */
  async editMessage(callbackQuery, text, options = {}) {
    const ctx = MessageHelper.createCtx(this.bot, callbackQuery);
    return await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      ...options
    });
  }

  /**
   * 메시지 응답 (일반 메시지용)
   */
  async reply(msg, text, options = {}) {
    const ctx = MessageHelper.createCtx(this.bot, msg);
    return await MessageHelper.send(ctx, text, options);
  }

  /**
   * ctx 생성 헬퍼
   */
  createCtx(msgOrCallback) {
    return MessageHelper.createCtx(this.bot, msgOrCallback);
  }

  /**
   * 텍스트 스타일링 헬퍼들
   */
  bold(text) {
    return MessageHelper.bold(text);
  }

  italic(text) {
    return MessageHelper.italic(text);
  }

  code(text) {
    return MessageHelper.code(text);
  }

  escape(text) {
    return MessageHelper.escape(text);
  }

  /**
   * 렌더러로 결과 전달 (수정된 버전)
   */
  async sendToRenderer(result, msgOrCallback) {
    try {
      // NavigationHandler를 통해 렌더러 접근
      if (this.moduleManager?.navigationHandler?.renderers) {
        const renderer = this.moduleManager.navigationHandler.renderers.get(
          this.moduleName
        );

        if (renderer) {
          const ctx = this.createCtx(msgOrCallback);
          await renderer.render(result, ctx);
          return true;
        }
      }

      // 렌더러가 없으면 직접 메시지 전송
      logger.warn(`⚠️ ${this.moduleName}: 렌더러를 찾을 수 없어 직접 전송`);

      const message = result.data?.message || "처리가 완료되었습니다.";
      const chatId = msgOrCallback.message
        ? msgOrCallback.message.chat.id
        : msgOrCallback.chat.id;

      await this.sendMessage(chatId, message);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName}: 렌더러 전달 실패:`, error);
      return false;
    }
  }
}

module.exports = BaseModule;
