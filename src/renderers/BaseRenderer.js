// src/renderers/BaseRenderer.js - 속도 제한 처리가 추가된 버전

const logger = require("../utils/core/Logger");
const Utils = require("../utils");

class BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper = null) {
    this.bot = bot;
    this.navigationHandler = navigationHandler;
    this._markdownHelper = markdownHelper;
    this.moduleName = "base";

    // 📊 통계
    this.stats = {
      renderCount: 0,
      successCount: 0,
      errorCount: 0,
      fallbackUsed: 0,
      lastActivity: null,
      rateLimitHits: 0 // 추가
    };

    // ⚙️ 속도 제한 설정
    this.rateLimitConfig = {
      minInterval: 50, // 최소 메시지 간격 (ms)
      retryAttempts: 3, // 재시도 횟수
      backoffMultiplier: 1.5, // 백오프 배수
      maxWaitTime: 30000 // 최대 대기 시간 (ms)
    };

    // 🚦 메시지 큐
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.lastMessageTime = 0;

    logger.debug(`🎨 ${this.constructor.name} 생성됨`);
  }

  // ===== 🔗 의존성 접근자 =====
  get errorHandler() {
    return this.navigationHandler?.errorHandler;
  }

  get markdownHelper() {
    // Utils로 대체된 MarkdownHelper 기능 제공
    return {
      escape: Utils.escape.bind(Utils),
      escapeMarkdownV2: Utils.escapeMarkdownV2.bind(Utils),
      stripAllMarkup: Utils.stripAllMarkup.bind(Utils),
      sendSafeMessage: Utils.sendSafeMessage.bind(Utils)
    };
  }

  // ===== 📨 메시지 전송 헬퍼 메서드 =====
  // sendSafeMessage는 아래 메인 구현에서 처리 (큐 시스템 포함)

  // ===== 🎯 핵심 추상 메서드 =====
  async render(result, ctx) {
    throw new Error(
      `render() 메서드는 ${this.constructor.name}에서 구현해야 합니다`
    );
  }

  // ===== 🔧 콜백 데이터 처리 =====
  buildCallbackData(moduleKey, subAction, params = "") {
    const paramsStr = Array.isArray(params)
      ? params.join(":")
      : String(params || "");
    return paramsStr
      ? `${moduleKey}:${subAction}:${paramsStr}`
      : `${moduleKey}:${subAction}`;
  }

  // ===== 💬 메시지 전송 시스템 (개선됨) =====

  /**
   * 🛡️ 안전한 메시지 전송 (속도 제한 포함)
   */
  async sendSafeMessage(ctx, text, options = {}) {
    // 큐에 추가하고 처리
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        ctx,
        text,
        options: {
          parse_mode: "Markdown",
          ...options
        },
        resolve,
        reject,
        retryCount: 0
      });

      // 큐 처리 시작
      if (!this.isProcessingQueue) {
        this.processMessageQueue();
      }
    });
  }

  /**
   * 📬 메시지 큐 처리
   */
  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();

      // 속도 제한 확인
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;

      if (timeSinceLastMessage < this.rateLimitConfig.minInterval) {
        const waitTime =
          this.rateLimitConfig.minInterval - timeSinceLastMessage;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // 메시지 전송 시도
      try {
        const result = await this.sendMessageWithRetry(message);
        message.resolve(result);
        this.lastMessageTime = Date.now();
      } catch (error) {
        message.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 🔄 재시도 로직이 포함된 메시지 전송
   */
  async sendMessageWithRetry(message) {
    const { ctx, text, options, retryCount } = message;

    try {
      // 실제 전송 시도
      if (ctx.callbackQuery) {
        return await ctx.editMessageText(text, options);
      } else {
        return await ctx.reply(text, options);
      }
    } catch (error) {
      // "message is not modified" 에러는 무시
      if (error.message?.includes("message is not modified")) {
        logger.debug("메시지가 변경되지 않음 - 무시");
        return null;
      }

      // 429 에러 (속도 제한) 처리
      if (
        error.message?.includes("429") &&
        retryCount < this.rateLimitConfig.retryAttempts
      ) {
        this.stats.rateLimitHits++;

        // retry after 시간 추출
        const retryAfter = this.extractRetryAfter(error.message);
        const waitTime = Math.min(
          (retryAfter + 1) *
            1000 *
            Math.pow(this.rateLimitConfig.backoffMultiplier, retryCount),
          this.rateLimitConfig.maxWaitTime
        );

        logger.warn(
          `⏳ 속도 제한 감지. ${waitTime}ms 후 재시도... (시도 ${retryCount + 1}/${this.rateLimitConfig.retryAttempts})`
        );

        // 대기 후 재시도
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        message.retryCount++;
        return await this.sendMessageWithRetry(message);
      }

      // 다른 에러는 그대로 전파
      throw error;
    }
  }

  /**
   * 🕐 retry after 시간 추출
   */
  extractRetryAfter(errorMessage) {
    const match = errorMessage.match(/retry after (\d+)/);
    return match ? parseInt(match[1]) : 5; // 기본값 5초
  }

  // ===== 🎹 키보드 생성 시스템 =====
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
    const { text, action, params, url, module, callback_data } = config;

    // URL 버튼
    if (url) return { text, url };

    // callback_data가 직접 지정된 경우 (레거시 지원)
    if (callback_data) {
      logger.warn(`직접 callback_data 사용 발견: ${callback_data}`);
      return { text, callback_data };
    }

    // action이 없으면 에러
    if (!action) {
      logger.error(`버튼에 action이 없음: ${text}`);
      return { text, callback_data: `${defaultModule}:error:no_action` };
    }

    // 정상 처리
    const targetModule = module || defaultModule;
    const callbackData = this.buildCallbackData(targetModule, action, params);
    return { text, callback_data: callbackData };
  }

  /**
   * 📊 통계 조회 (개선됨)
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessingQueue,
      rateLimitConfig: this.rateLimitConfig
    };
  }
}

module.exports = BaseRenderer;
