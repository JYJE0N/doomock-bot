// src/utils/MarkdownHelper.js - 📝 전담 마크다운 처리 컴포넌트

const logger = require("./Logger");

/**
 * 📝 MarkdownHelper - 마크다운 처리 전담 (SoC 원칙)
 *
 * 🎯 단일 책임: 텔레그램 마크다운만 전담 처리
 * - MarkdownV2 이스케이프
 * - HTML 변환
 * - 안전한 메시지 전송
 * - 폴백 처리
 *
 * 🔧 비유: 약국의 전문 약사
 * - 처방전(텍스트)을 안전하게 조제(이스케이프)
 * - 환자별 맞춤 처방(파서 모드 선택)
 * - 부작용 방지(400 에러 예방)
 * - 대체약 제공(폴백 시스템)
 */
class MarkdownHelper {
  constructor() {
    // 📊 처리 통계
    this.stats = {
      totalProcessed: 0,
      markdownV2Success: 0,
      htmlFallback: 0,
      plainTextFallback: 0,
      escapeOperations: 0,
      errors: 0,
      lastActivity: null,
    };

    // ⚙️ 설정
    this.config = {
      defaultMode: "MarkdownV2",
      fallbackModes: ["HTML", "plain"],
      enableAutoFallback: true,
      maxRetries: 3,
      retryDelay: 500, // ms
    };

    // 🛡️ MarkdownV2 예약 문자들
    this.markdownV2EscapeChars = [
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

    logger.debug("📝 MarkdownHelper 생성됨");
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    this.stats.lastActivity = new Date();
    logger.info("📝 MarkdownHelper 초기화 완료");
  }

  /**
   * 🛡️ MarkdownV2용 안전한 이스케이프 (핵심 기능!)
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") {
      text = String(text);
    }

    this.stats.escapeOperations++;

    try {
      // 백슬래시부터 처리 (중요한 순서!)
      let escaped = text.replace(/\\/g, "\\\\");

      // 나머지 특수문자들 이스케이프
      this.markdownV2EscapeChars.forEach((char) => {
        const regex = new RegExp(`\\${char}`, "g");
        escaped = escaped.replace(regex, `\\${char}`);
      });

      return escaped;
    } catch (error) {
      logger.error("MarkdownV2 이스케이프 실패:", error);
      this.stats.errors++;
      return text; // 실패시 원본 반환
    }
  }

  /**
   * 📝 표시용 텍스트 이스케이프 (사용자명 등)
   */
  escapeForDisplay(text) {
    if (typeof text !== "string") {
      text = String(text);
    }

    // 사용자명 같은 표시용 텍스트는 보수적으로 이스케이프
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
  }

  /**
   * 🔄 MarkdownV2 → HTML 변환
   */
  convertToHtml(markdownText) {
    if (typeof markdownText !== "string") {
      markdownText = String(markdownText);
    }

    try {
      return (
        markdownText
          // 굵게: *텍스트* → <b>텍스트</b>
          .replace(/\*([^*]+)\*/g, "<b>$1</b>")
          // 기울임: _텍스트_ → <i>텍스트</i>
          .replace(/_([^_]+)_/g, "<i>$1</i>")
          // 코드: `텍스트` → <code>텍스트</code>
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          // 취소선: ~텍스트~ → <s>텍스트</s>
          .replace(/~([^~]+)~/g, "<s>텍스트</s>")
          // 이스케이프 문자 제거: \문자 → 문자
          .replace(/\\(.)/g, "$1")
      );
    } catch (error) {
      logger.error("HTML 변환 실패:", error);
      this.stats.errors++;
      return markdownText;
    }
  }

  /**
   * 🧹 모든 마크업 제거 (최종 폴백)
   */
  stripAllMarkup(text) {
    if (typeof text !== "string") {
      text = String(text);
    }

    try {
      return (
        text
          // 마크다운 제거
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/~([^~]+)~/g, "$1")
          // HTML 제거
          .replace(/<[^>]*>/g, "")
          // 이스케이프 제거
          .replace(/\\(.)/g, "$1")
          // 과도한 공백 정리
          .replace(/\s+/g, " ")
          .trim()
      );
    } catch (error) {
      logger.error("마크업 제거 실패:", error);
      this.stats.errors++;
      return text;
    }
  }

  /**
   * 🚀 안전한 메시지 전송 (핵심 기능!)
   */
  async sendSafeMessage(ctx, text, options = {}) {
    this.stats.totalProcessed++;
    this.stats.lastActivity = new Date();

    // 1️⃣ MarkdownV2 시도
    if (this.config.defaultMode === "MarkdownV2") {
      try {
        const messageOptions = {
          parse_mode: "MarkdownV2",
          ...options,
        };

        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, messageOptions);
        } else {
          await ctx.reply(text, messageOptions);
        }

        this.stats.markdownV2Success++;
        return true;
      } catch (markdownError) {
        logger.warn(
          "MarkdownV2 전송 실패, HTML로 폴백:",
          markdownError.message
        );

        if (!this.config.enableAutoFallback) {
          throw markdownError;
        }
      }
    }

    // 2️⃣ HTML 폴백
    try {
      const htmlText = this.convertToHtml(text);
      const messageOptions = {
        parse_mode: "HTML",
        ...options,
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(htmlText, messageOptions);
      } else {
        await ctx.reply(htmlText, messageOptions);
      }

      this.stats.htmlFallback++;
      return true;
    } catch (htmlError) {
      logger.warn("HTML 전송 실패, 일반 텍스트로 폴백:", htmlError.message);
    }

    // 3️⃣ 일반 텍스트 폴백 (최후 수단)
    try {
      const plainText = this.stripAllMarkup(text);
      const messageOptions = {
        ...options,
        parse_mode: undefined, // 파싱 모드 제거
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(plainText, messageOptions);
      } else {
        await ctx.reply(plainText, messageOptions);
      }

      this.stats.plainTextFallback++;
      return true;
    } catch (plainError) {
      logger.error("일반 텍스트 전송도 실패:", plainError);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 🎨 텍스트 스타일링 헬퍼들
   */
  bold(text) {
    return `*${this.escapeMarkdownV2(String(text))}*`;
  }

  italic(text) {
    return `_${this.escapeMarkdownV2(String(text))}_`;
  }

  code(text) {
    return `\`${String(text)}\``;
  }

  strikethrough(text) {
    return `~${this.escapeMarkdownV2(String(text))}~`;
  }

  /**
   * 🔗 링크 생성
   */
  link(text, url) {
    const safeText = this.escapeMarkdownV2(String(text));
    return `[${safeText}](${url})`;
  }

  /**
   * 👤 사용자 멘션 생성
   */
  mention(userName, userId) {
    const safeName = this.escapeMarkdownV2(String(userName));
    return `[${safeName}](tg://user?id=${userId})`;
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      stats: this.stats,
      config: this.config,
      successRate:
        this.stats.totalProcessed > 0
          ? Math.round(
              ((this.stats.markdownV2Success +
                this.stats.htmlFallback +
                this.stats.plainTextFallback) /
                this.stats.totalProcessed) *
                100
            )
          : 100,
      markdownV2Rate:
        this.stats.totalProcessed > 0
          ? Math.round(
              (this.stats.markdownV2Success / this.stats.totalProcessed) * 100
            )
          : 0,
      fallbackRate:
        this.stats.totalProcessed > 0
          ? Math.round(
              ((this.stats.htmlFallback + this.stats.plainTextFallback) /
                this.stats.totalProcessed) *
                100
            )
          : 0,
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.info("🧹 MarkdownHelper 정리 시작...");

    // 최종 통계 로그
    logger.info("📊 MarkdownHelper 최종 통계:", this.getStatus());

    logger.info("✅ MarkdownHelper 정리 완료");
  }
}

module.exports = MarkdownHelper;
