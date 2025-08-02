// src/handlers/ErrorHandler.js - 🚨 전담 에러 처리 컴포넌트

const logger = require("../utils/Logger");

/**
 * 🚨 ErrorHandler - 모든 에러 처리 전담 (SoC 원칙)
 *
 * 🎯 단일 책임: 에러 상황만 전담 처리
 * - 사용자 정보 없음
 * - 모듈 로드 실패
 * - 메시지 전송 실패
 * - 렌더러 없음
 * - 예상치 못한 오류
 *
 * 🔧 비유: 병원의 응급의학과
 * - 모든 응급상황을 전문적으로 처리
 * - 다른 과에서 해결 못한 문제들을 받아서 처리
 * - 표준화된 응급 프로토콜 적용
 */
class ErrorHandler {
  constructor() {
    this.bot = null;

    // 📊 에러 통계
    this.stats = {
      totalErrors: 0,
      handledErrors: 0,
      criticalErrors: 0,
      userInfoErrors: 0,
      moduleErrors: 0,
      messageErrors: 0,
      rendererErrors: 0,
      unexpectedErrors: 0,
      lastError: null,
    };

    // ⚙️ 설정
    this.config = {
      enableDetailedLogging: true,
      enableUserNotification: true,
      enableRecovery: true,
      maxRetries: 3,
      fallbackMessages: {
        general: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        userInfo: "사용자 정보를 확인할 수 없습니다.",
        moduleLoad: "시스템 구성요소 로드에 실패했습니다.",
        messageSend: "메시지 전송에 실패했습니다.",
        renderer: "화면 구성에 실패했습니다.",
      },
    };

    logger.debug("🚨 ErrorHandler 생성됨");
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot) {
    this.bot = bot;
    this.stats.lastError = null;

    logger.info("🚨 ErrorHandler 초기화 완료");
  }

  /**
   * 👤 사용자 정보 없음 처리
   */
  async handleMissingUserInfo(ctx) {
    this.stats.totalErrors++;
    this.stats.userInfoErrors++;
    this.stats.lastError = new Date();

    logger.error("👤 사용자 정보 없음 오류");

    if (this.config.enableUserNotification) {
      try {
        await this.sendErrorMessage(ctx, this.config.fallbackMessages.userInfo);
        this.stats.handledErrors++;
        return true;
      } catch (notificationError) {
        logger.error("에러 알림 전송 실패:", notificationError);
        return false;
      }
    }

    return false;
  }

  /**
   * 📦 모듈 로드 에러 처리
   */
  async handleModulesLoadError(ctx, originalError) {
    this.stats.totalErrors++;
    this.stats.moduleErrors++;
    this.stats.lastError = new Date();

    logger.error("📦 모듈 로드 오류:", originalError);

    // 폴백 모듈 목록 제공
    const fallbackModules = [
      {
        key: "system",
        icon: "🖥️",
        displayName: "시스템",
        showInMenu: true,
      },
    ];

    try {
      const keyboard = {
        inline_keyboard: fallbackModules.map((module) => [
          {
            text: `${module.icon} ${module.displayName}`,
            callback_data: `${module.key}:menu`,
          },
        ]),
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(
          "⚠️ 일부 기능을 로드할 수 없습니다. 기본 기능만 제공됩니다.",
          { reply_markup: keyboard }
        );
      } else {
        await ctx.reply(
          "⚠️ 일부 기능을 로드할 수 없습니다. 기본 기능만 제공됩니다.",
          { reply_markup: keyboard }
        );
      }

      this.stats.handledErrors++;
      return true;
    } catch (fallbackError) {
      logger.error("폴백 처리 실패:", fallbackError);
      return await this.handleCriticalError(ctx, fallbackError);
    }
  }

  /**
   * 📨 메시지 전송 에러 처리
   */
  async handleMessageSendError(ctx, reason) {
    this.stats.totalErrors++;
    this.stats.messageErrors++;
    this.stats.lastError = new Date();

    logger.error("📨 메시지 전송 오류:", reason);

    // 재시도 로직
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000)); // 백오프

        if (ctx.callbackQuery) {
          await ctx.answerCbQuery(this.config.fallbackMessages.messageSend, {
            show_alert: true,
          });
        } else {
          await ctx.reply(`❌ ${this.config.fallbackMessages.messageSend}`);
        }

        this.stats.handledErrors++;
        return true;
      } catch (retryError) {
        logger.warn(
          `메시지 재시도 ${attempt}/${this.config.maxRetries} 실패:`,
          retryError.message
        );

        if (attempt === this.config.maxRetries) {
          return await this.handleCriticalError(ctx, retryError);
        }
      }
    }

    return false;
  }

  /**
   * 🎨 렌더링 에러 처리 (LeaveRenderer 등에서 사용)
   */
  async handleRenderError(bot, callbackQuery, error, options = {}) {
    this.stats.totalErrors++;
    this.stats.rendererErrors++;
    this.stats.lastError = new Date();

    const {
      module = "unknown",
      renderer = "unknown",
      fallbackMessage,
    } = options;

    logger.error(`🎨 렌더링 오류 [${module}/${renderer}]:`, error);

    try {
      // 사용자에게 에러 알림
      const errorMessage =
        fallbackMessage || this.config.fallbackMessages.renderer;

      // 🛡️ callbackQuery가 있을 때만 답변
      if (callbackQuery && callbackQuery.id) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: errorMessage,
          show_alert: true,
        });
      }

      // 기본 에러 화면 표시 시도
      try {
        const fallbackKeyboard = {
          inline_keyboard: [
            [{ text: "🔄 다시 시도", callback_data: `${module}:menu` }],
            [{ text: "🏠 메인으로", callback_data: "main:show" }],
          ],
        };

        await bot.editMessageText(
          `❌ **화면 표시 오류**\n\n${errorMessage}\n\n다시 시도하거나 메인 메뉴로 돌아가세요.`,
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            reply_markup: fallbackKeyboard,
            parse_mode: "Markdown",
          }
        );

        this.stats.handledErrors++;
        return { success: false, handled: true, error: error.message };
      } catch (fallbackError) {
        logger.error("폴백 메시지 표시 실패:", fallbackError);
        return await this.handleCriticalError({ callbackQuery }, error);
      }
    } catch (criticalError) {
      logger.error("🔥 렌더링 에러 처리 중 치명적 오류:", criticalError);
      return { success: false, handled: false, error: criticalError.message };
    }
  }

  /**
   * 🎨 렌더러 없음 처리
   */
  async handleMissingRenderer(ctx, moduleKey, result) {
    this.stats.totalErrors++;
    this.stats.rendererErrors++;
    this.stats.lastError = new Date();

    logger.error(`🎨 렌더러 없음: ${moduleKey}`);

    try {
      // 기본 텍스트 형태로 결과 표시
      let fallbackText = `📋 ${moduleKey} 결과\n\n`;

      if (result.data) {
        if (typeof result.data === "object") {
          fallbackText += JSON.stringify(result.data, null, 2);
        } else {
          fallbackText += String(result.data);
        }
      } else {
        fallbackText += "처리가 완료되었습니다.";
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(fallbackText, { reply_markup: keyboard });
      } else {
        await ctx.reply(fallbackText, { reply_markup: keyboard });
      }

      this.stats.handledErrors++;
      return true;
    } catch (fallbackError) {
      logger.error("렌더러 폴백 실패:", fallbackError);
      return await this.handleCriticalError(ctx, fallbackError);
    }
  }

  /**
   * 🔥 모듈 처리 에러 처리
   */
  async handleModuleProcessingError(ctx, moduleKey, subAction, reason) {
    this.stats.totalErrors++;
    this.stats.moduleErrors++;
    this.stats.lastError = new Date();

    logger.error(`🔥 모듈 처리 오류: ${moduleKey}.${subAction} - ${reason}`);

    try {
      const errorMessage =
        `❌ ${moduleKey} 기능에서 오류가 발생했습니다.\n` +
        `액션: ${subAction}\n` +
        `잠시 후 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 다시 시도",
              callback_data: `${moduleKey}:${subAction}`,
            },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(errorMessage, { reply_markup: keyboard });
      } else {
        await ctx.reply(errorMessage, { reply_markup: keyboard });
      }

      this.stats.handledErrors++;
      return true;
    } catch (notificationError) {
      logger.error("모듈 에러 알림 실패:", notificationError);
      return await this.handleCriticalError(ctx, notificationError);
    }
  }

  /**
   * 💥 예상치 못한 오류 처리
   */
  async handleUnexpectedError(ctx, error, context = "unknown") {
    this.stats.totalErrors++;
    this.stats.unexpectedErrors++;
    this.stats.lastError = new Date();

    logger.error(`💥 예상치 못한 오류 [${context}]:`, {
      message: error.message,
      stack: error.stack,
      context: context,
    });

    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(this.config.fallbackMessages.general, {
          show_alert: true,
        });
      } else {
        await ctx.reply(`❌ ${this.config.fallbackMessages.general}`);
      }

      this.stats.handledErrors++;
      return true;
    } catch (notificationError) {
      logger.error("예상치 못한 오류 알림 실패:", notificationError);
      return await this.handleCriticalError(ctx, notificationError);
    }
  }

  /**
   * 🚨 치명적 오류 처리 (최후 수단)
   */
  async handleCriticalError(ctx, error) {
    this.stats.totalErrors++;
    this.stats.criticalErrors++;
    this.stats.lastError = new Date();

    logger.error("🚨 치명적 오류:", error);

    // 최후 수단: 가장 기본적인 알림만
    try {
      if (ctx.callbackQuery && ctx.callbackQuery.id) {
        // answerCbQuery는 반드시 호출해야 함
        await this.bot.telegram.answerCbQuery(ctx.callbackQuery.id, {
          text: "시스템 오류가 발생했습니다.",
          show_alert: true,
        });
      }
      return false; // 치명적 오류는 복구 불가능으로 표시
    } catch (finalError) {
      logger.error("🔥 최종 오류 처리도 실패:", finalError);
      return false;
    }
  }

  /**
   * 📨 안전한 에러 메시지 전송
   */
  async sendErrorMessage(ctx, message) {
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(message, { show_alert: true });
      } else {
        await ctx.reply(`❌ ${message}`);
      }
      return true;
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
      return false;
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      stats: this.stats,
      config: this.config,
      successRate:
        this.stats.totalErrors > 0
          ? Math.round(
              (this.stats.handledErrors / this.stats.totalErrors) * 100
            )
          : 100,
      criticalRate:
        this.stats.totalErrors > 0
          ? Math.round(
              (this.stats.criticalErrors / this.stats.totalErrors) * 100
            )
          : 0,
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.info("🧹 ErrorHandler 정리 시작...");

    // 최종 통계 로그
    logger.info("📊 ErrorHandler 최종 통계:", this.getStatus());

    this.bot = null;

    logger.info("✅ ErrorHandler 정리 완료");
  }
}

module.exports = ErrorHandler;
