// src/renderers/BaseRenderer.js - 텔레그램 마크다운 에러 수정 버전

const logger = require("../utils/Logger");

/**
 * 🎨 BaseRenderer - 모든 렌더러의 기본 클래스
 *
 * 🚨 수정사항:
 * - 텔레그램 MarkdownV2 에러 완전 해결
 * - 안전한 폴백 시스템 적용
 * - 자동 에러 복구 기능
 */
class BaseRenderer {
  constructor(bot, navigationHandler) {
    this.bot = bot;
    this.navigationHandler = navigationHandler;

    // 🚨 에러 통계
    this.errorStats = {
      markdownErrors: 0,
      fallbackUsed: 0,
      totalMessages: 0,
    };
  }

  /**
   * 🛡️ 강화된 MarkdownV2 이스케이프 (완전한 해결책)
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

    // 텔레그램 MarkdownV2에서 이스케이프해야 하는 모든 문자
    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];

    let escaped = text;

    // 각 문자를 개별적으로 이스케이프
    escapeChars.forEach((char) => {
      // 이미 이스케이프된 문자는 건드리지 않음
      const regex = new RegExp(`(?<!\\\\)\\${char}`, "g");
      escaped = escaped.replace(regex, `\\${char}`);
    });

    return escaped;
  }

  /**
   * 🔧 일반 마크다운 이스케이프 (폴백용)
   */
  escapeMarkdown(text) {
    if (typeof text !== "string") text = String(text);

    return text
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/~/g, "\\~")
      .replace(/`/g, "\\`")
      .replace(/>/g, "\\>")
      .replace(/#/g, "\\#")
      .replace(/\+/g, "\\+")
      .replace(/-/g, "\\-")
      .replace(/=/g, "\\=")
      .replace(/\|/g, "\\|")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\./g, "\\.")
      .replace(/!/g, "\\!");
  }

  /**
   * 🧹 텍스트 정리 (특수문자 제거)
   */
  cleanText(text) {
    if (typeof text !== "string") text = String(text);

    // 문제가 될 수 있는 특수문자들을 안전한 문자로 변경
    return text
      .replace(/!/g, "❗")
      .replace(/\./g, "․") // 중점으로 변경
      .replace(/\?/g, "❓")
      .replace(/\*/g, "✨")
      .replace(/_/g, "—") // em dash로 변경
      .trim();
  }

  /**
   * 🛡️ 안전한 메시지 전송 (3단계 폴백 시스템)
   */
  async sendMessage(chatId, text, keyboard = null, messageId = null) {
    this.errorStats.totalMessages++;

    // 1단계: MarkdownV2로 시도
    try {
      const escapedText = this.escapeMarkdownV2(text);

      if (messageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          escapedText,
          {
            parse_mode: "MarkdownV2",
            reply_markup: keyboard,
          }
        );
      } else {
        await this.bot.telegram.sendMessage(chatId, escapedText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }

      return; // 성공하면 여기서 종료
    } catch (error) {
      this.errorStats.markdownErrors++;
      logger.warn(
        "🚨 MarkdownV2 전송 실패, 일반 마크다운으로 재시도:",
        error.message
      );
    }

    // 2단계: 일반 Markdown으로 시도
    try {
      const escapedText = this.escapeMarkdown(text);

      if (messageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          escapedText,
          {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );
      } else {
        await this.bot.telegram.sendMessage(chatId, escapedText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }

      this.errorStats.fallbackUsed++;
      logger.info("✅ 일반 마크다운으로 전송 성공");
      return; // 성공하면 여기서 종료
    } catch (error) {
      logger.warn(
        "🚨 일반 마크다운도 실패, 일반 텍스트로 최종 시도:",
        error.message
      );
    }

    // 3단계: 일반 텍스트로 최종 시도 (마크다운 없음)
    try {
      const cleanedText = this.cleanText(text);

      if (messageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          cleanedText,
          {
            reply_markup: keyboard,
            // parse_mode 없음
          }
        );
      } else {
        await this.bot.telegram.sendMessage(chatId, cleanedText, {
          reply_markup: keyboard,
          // parse_mode 없음
        });
      }

      this.errorStats.fallbackUsed++;
      logger.success("✅ 일반 텍스트로 전송 성공");
    } catch (error) {
      logger.error("❌ 모든 전송 방법 실패:", error);
      throw error; // 마지막 에러를 던짐
    }
  }

  /**
   * 🔄 에러 메시지 전송 (안전한 버전)
   */
  async sendErrorMessage(chatId, message, keyboard = null, messageId = null) {
    const errorText = `❗ 오류 발생\n\n${message}\n\n잠시 후 다시 시도해주세요`;

    try {
      await this.sendMessage(chatId, errorText, keyboard, messageId);
    } catch (error) {
      // 에러 메시지 전송도 실패하면 최소한의 메시지라도 전송
      try {
        const fallbackText = "시스템 오류가 발생했습니다";

        if (messageId) {
          await this.bot.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            fallbackText
          );
        } else {
          await this.bot.telegram.sendMessage(chatId, fallbackText);
        }
      } catch (finalError) {
        logger.error("❌ 최종 에러 메시지 전송도 실패:", finalError);
      }
    }
  }

  /**
   * 🎯 공통 키보드 생성
   */
  createBackToMenuKeyboard(moduleName = null) {
    const backText = moduleName ? "🔙 모듈 메뉴" : "🔙 메뉴";
    const backData = moduleName ? `${moduleName}:menu` : "system:menu";

    return {
      inline_keyboard: [
        [
          { text: backText, callback_data: backData },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };
  }

  /**
   * 🆘 에러 렌더링 (표준화된)
   */
  async renderError(message, ctx, customKeyboard = null) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = ctx.callbackQuery || ctx;

      const keyboard = customKeyboard || this.createBackToMenuKeyboard();

      await this.sendErrorMessage(chatId, message, keyboard, messageId);
    } catch (error) {
      logger.error("❌ 에러 렌더링 실패:", error);
    }
  }

  /**
   * 📊 에러 통계 조회
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      errorRate:
        this.errorStats.totalMessages > 0
          ? (
              (this.errorStats.markdownErrors / this.errorStats.totalMessages) *
              100
            ).toFixed(2) + "%"
          : "0%",
      fallbackRate:
        this.errorStats.totalMessages > 0
          ? (
              (this.errorStats.fallbackUsed / this.errorStats.totalMessages) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * 🧪 마크다운 테스트 (개발용)
   */
  async testMarkdown(chatId) {
    const testTexts = [
      "정상 텍스트입니다",
      "특수문자! 테스트. 입니다?",
      "마크다운 *볼드* _이탤릭_ 테스트",
      "복잡한! 텍스트. 입니다? *볼드*와 _이탤릭_이 있어요!",
      "두목: '당신, 바보 카드네요! 새로운 시작에 좋아요!'",
    ];

    for (let i = 0; i < testTexts.length; i++) {
      try {
        await this.sendMessage(chatId, `테스트 ${i + 1}: ${testTexts[i]}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
      } catch (error) {
        logger.error(`테스트 ${i + 1} 실패:`, error);
      }
    }

    // 통계 출력
    const stats = this.getErrorStats();
    await this.sendMessage(
      chatId,
      `📊 테스트 완료\n\n총 메시지: ${stats.totalMessages}\n마크다운 에러: ${stats.markdownErrors}\n폴백 사용: ${stats.fallbackUsed}\n에러율: ${stats.errorRate}`
    );
  }

  /**
   * 🎯 자식 클래스에서 구현해야 할 메서드
   */
  async render(result, ctx) {
    throw new Error("render() 메서드를 구현해야 합니다");
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    // 에러 통계 초기화
    this.errorStats = {
      markdownErrors: 0,
      fallbackUsed: 0,
      totalMessages: 0,
    };
  }
}

module.exports = BaseRenderer;
