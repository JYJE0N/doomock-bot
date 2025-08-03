// src/renderers/BaseRenderer.js - 🎨 최종 리팩토링 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
/**
 * 🎨 BaseRenderer - 모든 렌더러의 표준 기반 클래스
 *
 * 🎯 핵심 원칙:
 * - 의존성 위임: NavigationHandler를 통해 다른 헬퍼에 접근합니다.
 * - 단일 책임 원칙: 각 메서드는 하나의 명확한 역할만 수행합니다.
 * - 계층화된 폴백: 메시지 전송 실패 시 단계별로 안전하게 처리합니다.
 * - 표준화된 콜백 처리: 모든 렌더러가 동일한 방식으로 콜백을 생성하고 해석합니다.
 */

class BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    this.bot = bot;
    this.navigationHandler = navigationHandler;

    // 👇 실제 값을 내부 속성(_markdownHelper)에 저장합니다.
    this._markdownHelper = markdownHelper;

    this.moduleName = "base";

    this.stats = {
      renderCount: 0,
      successCount: 0,
      errorCount: 0,
      fallbackUsed: 0,
      lastActivity: null
    };

    this.config = {
      enableFallback: true
    };

    logger.debug(`🎨 ${this.constructor.name} 생성됨`);
  }

  // ===== 🔗 의존성 접근자 =====

  /**
   * 🚨 ErrorHandler는 NavigationHandler를 통해 접근합니다.
   */
  get errorHandler() {
    return this.navigationHandler?.errorHandler;
  }

  /**
   * 📝 MarkdownHelper 접근 (수정된 버전)
   */
  get markdownHelper() {
    // 👇 내부 속성(_markdownHelper)을 반환하여 무한 반복을 방지합니다.
    return this._markdownHelper || this.navigationHandler?.markdownHelper;
  }

  // ===== 🎯 핵심 추상 메서드 =====

  /**
   * 🎯 메인 렌더링 메서드 (자식 클래스에서 필수 구현)
   */
  async render(result, ctx) {
    throw new Error(`render() 메서드는 ${this.constructor.name}에서 구현해야 합니다`);
  }

  // ===== 🔧 콜백 데이터 처리 =====

  /**
   * 🔧 콜백 데이터 생성
   */
  buildCallbackData(moduleKey, subAction, params = "") {
    const paramsStr = Array.isArray(params) ? params.join(":") : String(params || "");
    return paramsStr
      ? `${moduleKey}:${subAction}:${paramsStr}`
      : `${moduleKey}:${subAction}`;
  }

  // ===== 💬 메시지 전송 시스템 =====

  /**
   * 🛡️ 안전한 메시지 전송 (통합된 폴백 시스템)
   */
  async sendSafeMessage(ctx, text, options = {}) {
    this.stats.renderCount++;
    this.stats.lastActivity = new Date();

    try {
      // 1단계: HTML 모드로 시도 (MarkdownHelper 사용)
      const htmlText = this.markdownHelper.convertToHtml(text);
      await this.sendMessage(ctx, htmlText, { parse_mode: "HTML", ...options });
      this.stats.successCount++;
      return true;
    } catch (error) {
      // "message is not modified" 에러는 성공으로 간주하고 조용히 처리
      if (error.message?.includes("message is not modified")) {
        if (ctx.callbackQuery) await ctx.answerCbQuery();
        this.stats.successCount++; // 성공으로 카운트
        return true;
      }

      logger.warn(`HTML 전송 실패, 폴백 시도: ${error.message}`);
    }

    // 2단계: 일반 텍스트로 폴백
    if (this.config.enableFallback) {
      try {
        const plainText = this.markdownHelper.stripAllMarkup(text);
        await this.sendMessage(ctx, plainText, {
          ...options,
          parse_mode: undefined
        });
        this.stats.fallbackUsed++;
        return true;
      } catch (fallbackError) {
        logger.error(`폴백 전송도 실패: ${fallbackError.message}`);
      }
    }

    // 3단계: 최종적으로 ErrorHandler에 위임
    this.stats.errorCount++;
    if (this.errorHandler) {
      await this.errorHandler.handleMessageSendError(ctx, "메시지 전송 최종 실패");
    }
    return false;
  }

  /**
   * 📤 실제 메시지 전송 로직 (수정/전송 분기)
   */
  async sendMessage(ctx, text, options) {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, options);
    } else {
      await ctx.reply(text, options);
    }
  }

  // ===== 🎹 키보드 생성 시스템 =====

  /**
   * 🎹 인라인 키보드 생성
   */
  createInlineKeyboard(buttons, moduleKey = this.moduleName) {
    return {
      inline_keyboard: buttons.map((row) =>
        Array.isArray(row)
          ? row.map((btn) => this.createButton(btn, moduleKey))
          : [this.createButton(row, moduleKey)]
      )
    };
  }

  /**
   * 🔘 개별 버튼 생성
   */
  createButton(config, defaultModule) {
    const { text, action, params, url, module } = config;
    if (url) return { text, url };

    let targetModule = module || defaultModule;
    if (action === "menu" && text.includes("메인 메뉴")) {
      targetModule = "system";
    }

    const callback_data = this.buildCallbackData(targetModule, action, params);
    return { text, callback_data };
  }

  // ... (createHomeButton, createBackButton, createPaginationButtons 등 유틸성 키보드 메서드)
}

module.exports = BaseRenderer;
