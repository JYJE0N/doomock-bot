// src/utils/MarkdownHelper.js - 🎯 스마트 MarkdownV2 시스템

const logger = require("./Logger");

/**
 * 🎯 스마트 MarkdownV2 시스템
 *
 * 🎨 목표: MarkdownV2의 예쁨 + HTML의 안정성 둘 다 가져가기!
 *
 * 💡 전략:
 * 1. MarkdownV2를 먼저 시도 (예쁜 렌더링)
 * 2. 실패 시 즉시 HTML로 폴백 (안정성)
 * 3. 스마트 이스케이프로 성공률 높이기
 * 4. 패턴 학습으로 점점 더 똑똑해지기
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
      // 🎯 새로운 통계들
      problemPatterns: new Map(), // 문제가 되는 패턴들 학습
      successPatterns: new Map() // 성공하는 패턴들 학습
    };

    // ⚙️ 스마트 설정
    this.config = {
      defaultMode: "MarkdownV2", // 🎯 MarkdownV2 우선!
      fallbackModes: ["HTML", "plain"],
      enableAutoFallback: true,
      enableSmartEscape: true, // 🧠 스마트 이스케이프
      enablePatternLearning: true, // 📚 패턴 학습
      maxRetries: 1, // 빠른 폴백
      retryDelay: 100 // 빠른 폴백
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
      "!"
    ];

    // 🎯 날씨 모듈 전용 템플릿들 (MarkdownV2 최적화)
    this.weatherTemplates = {
      current: this.createWeatherCurrentTemplate(),
      forecast: this.createWeatherForecastTemplate(),
      cities: this.createWeatherCitiesTemplate()
    };

    logger.debug("🎯 스마트 MarkdownV2 시스템 생성됨");
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    this.stats.lastActivity = new Date();
    logger.info("🎯 스마트 MarkdownV2 시스템 초기화 완료");
  }

  /**
   * 🛡️ escape 메서드 - escapeMarkdownV2의 별칭
   * TimerRenderer와의 호환성을 위해 추가
   */
  escape(text) {
    return this.escapeMarkdownV2(text);
  }

  /**
   * 🧠 스마트 이스케이프 (패턴 학습 기반)
   */
  escapeMarkdownV2(text) {
    if (!text) return "";
    if (typeof text !== "string") {
      text = String(text);
    }

    this.stats.escapeOperations++;

    try {
      // 🎯 알려진 성공 패턴이 있으면 사용
      const patternKey = this.getPatternKey(text);
      if (this.stats.successPatterns.has(patternKey)) {
        return this.stats.successPatterns.get(patternKey);
      }

      // 기본 이스케이프 로직
      let escaped = text.replace(/\\/g, "\\\\");

      // 스마트 이스케이프: 컨텍스트에 따라 다르게 처리
      if (this.config.enableSmartEscape) {
        escaped = this.smartEscape(escaped);
      } else {
        // 기본 이스케이프
        this.markdownV2EscapeChars.forEach((char) => {
          const regex = new RegExp(`\\${char}`, "g");
          escaped = escaped.replace(regex, `\\${char}`);
        });
      }

      // 성공 패턴 저장
      if (this.config.enablePatternLearning) {
        this.stats.successPatterns.set(patternKey, escaped);
      }

      return escaped;
    } catch (error) {
      logger.error("MarkdownV2 이스케이프 실패:", error);
      this.stats.errors++;

      // 실패 패턴 저장
      if (this.config.enablePatternLearning) {
        const patternKey = this.getPatternKey(text);
        this.stats.problemPatterns.set(patternKey, error.message);
      }

      return text;
    }
  }

  /**
   * 🧠 스마트 이스케이프 로직
   */
  smartEscape(text) {
    // 숫자와 단위는 보호 (예: 27°C, 54%)
    text = text.replace(/(\d+[°%])/g, (match) => {
      return match.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
    });

    // 시간 형식 보호 (예: 14:30, 2024-01-02)
    text = text.replace(/(\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2})/g, (match) => {
      return match.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
    });

    // 이모지 주변은 보호
    text = text.replace(
      /([\u{1F300}-\u{1F9FF}])/gu,
      (match, emoji, offset, str) => {
        const before = str.substring(Math.max(0, offset - 2), offset);
        const after = str.substring(
          offset + match.length,
          offset + match.length + 2
        );
        return before + emoji + after;
      }
    );

    // 나머지 텍스트 이스케이프
    this.markdownV2EscapeChars.forEach((char) => {
      // 이미 이스케이프된 문자는 건드리지 않음
      const regex = new RegExp(`(?<!\\\\)\\${char}`, "g");
      text = text.replace(regex, `\\${char}`);
    });

    return text;
  }

  /**
   * 📚 패턴 키 생성 (학습용)
   */
  getPatternKey(text) {
    if (!text) return "";
    // 텍스트의 구조적 특징 추출
    return `${text.length}_${text.substring(0, 20)}_${text.includes("*")}_${text.includes("_")}`;
  }

  /**
   * 🌤️ 날씨 모듈 전용 템플릿 생성
   */
  createWeatherCurrentTemplate() {
    return (data) => {
      const { location, current, airQuality } = data;

      // 안전한 이스케이프 처리
      const city = this.escapeMarkdownV2(location.city || "알 수 없음");
      const temp = this.escapeMarkdownV2(`${current.temp}°C`);
      const feels = this.escapeMarkdownV2(`${current.feels_like}°C`);
      const desc = this.escapeMarkdownV2(current.description || "");

      let text = `🌤️ *${city} 현재 날씨*\n\n`;
      text += `🌡️ *온도*: ${temp} \\(체감 ${feels}\\)\n`;
      text += `☁️ *상태*: ${desc}\n`;
      text += `💧 *습도*: ${current.humidity}%\n`;
      text += `💨 *풍속*: ${current.wind_speed}m/s\n`;

      if (airQuality) {
        text += `\n🌫️ *대기질*\n`;
        text += `• PM10: ${airQuality.pm10}\n`;
        text += `• PM2\\.5: ${airQuality.pm25}\n`;
      }

      return text;
    };
  }

  createWeatherForecastTemplate() {
    return (data) => {
      const { location, forecast } = data;
      const city = this.escapeMarkdownV2(location.city || "알 수 없음");

      let text = `📅 *${city} 날씨 예보*\n\n`;

      forecast.forEach((day) => {
        const date = this.escapeMarkdownV2(day.date);
        const desc = this.escapeMarkdownV2(day.description);
        text += `*${date}*\n`;
        text += `${day.icon} ${desc}\n`;
        text += `🌡️ ${day.temp_max}°/${day.temp_min}°C\n`;
        text += `💧 강수: ${day.rain_prob}%\n\n`;
      });

      return text;
    };
  }

  createWeatherCitiesTemplate() {
    return (cities) => {
      let text = `🌍 *주요 도시 날씨*\n\n`;

      cities.forEach((city) => {
        const name = this.escapeMarkdownV2(city.name);
        const desc = this.escapeMarkdownV2(city.description);
        text += `*${name}*\n`;
        text += `${city.icon} ${desc}\n`;
        text += `🌡️ ${city.temp}°C\n\n`;
      });

      return text;
    };
  }

  /**
   * 🔄 MarkdownV2 → HTML 변환 (텔레그램 호환)
   */
  convertToHtml(markdownText) {
    if (!markdownText) return "";
    if (typeof markdownText !== "string") {
      markdownText = String(markdownText);
    }

    try {
      return (
        markdownText
          // MarkdownV2 문법 변환
          .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>") // **굵게**
          .replace(/\*([^*]+)\*/g, "<b>$1</b>") // *굵게*
          .replace(/__([^_]+)__/g, "<u>$1</u>") // __밑줄__
          .replace(/_([^_]+)_/g, "<i>$1</i>") // _기울임_
          .replace(/`([^`]+)`/g, "<code>$1</code>") // `코드`
          .replace(/~([^~]+)~/g, "<s>$1</s>") // ~취소선~
          .replace(/\|\|([^|]+)\|\|/g, '<span class="tg-spoiler">$1</span>') // ||스포일러||
          // 링크: [텍스트](URL)
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          // 이스케이프 문자 제거
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
    if (!text) return "";
    if (typeof text !== "string") {
      text = String(text);
    }

    try {
      return (
        text
          // MarkdownV2 제거
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/__([^_]+)__/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/~([^~]+)~/g, "$1")
          .replace(/\|\|([^|]+)\|\|/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          // HTML 제거
          .replace(/<[^>]*>/g, "")
          // 이스케이프 제거
          .replace(/\\(.)/g, "$1")
          // 줄바꿈과 공백 정리
          .replace(/\n+/g, "\n")
          .replace(/[ \t]+/g, " ")
          .trim()
      );
    } catch (error) {
      logger.error("마크업 제거 실패:", error);
      this.stats.errors++;
      return text;
    }
  }

  /**
   * 🚀 스마트 메시지 전송 (핵심 기능!)
   */
  async sendSafeMessage(ctx, text, options = {}) {
    if (!ctx || !text) {
      logger.error("잘못된 매개변수:", { hasCtx: !!ctx, hasText: !!text });
      return false;
    }

    this.stats.totalProcessed++;
    this.stats.lastActivity = new Date();

    // 🎯 1단계: MarkdownV2 시도 (예쁜 렌더링!)
    if (this.config.defaultMode === "MarkdownV2") {
      try {
        const messageOptions = {
          parse_mode: "MarkdownV2",
          ...options
        };

        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, messageOptions);
        } else {
          await ctx.reply(text, messageOptions);
        }

        this.stats.markdownV2Success++;
        logger.debug("✨ MarkdownV2 전송 성공!");
        return true;
      } catch (markdownError) {
        logger.warn("MarkdownV2 실패, HTML 폴백:", markdownError.message);

        // 실패 패턴 학습
        if (this.config.enablePatternLearning) {
          const patternKey = this.getPatternKey(text);
          this.stats.problemPatterns.set(patternKey, markdownError.message);
        }
      }
    }

    // 🔄 2단계: HTML 폴백 (안정성!)
    try {
      const htmlText = this.convertToHtml(text);
      const messageOptions = {
        parse_mode: "HTML",
        ...options
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(htmlText, messageOptions);
      } else {
        await ctx.reply(htmlText, messageOptions);
      }

      this.stats.htmlFallback++;
      logger.debug("🔄 HTML 폴백 성공!");
      return true;
    } catch (htmlError) {
      logger.warn("HTML도 실패, 일반 텍스트 폴백:", htmlError.message);
    }

    // 🆘 3단계: 일반 텍스트 (최종 폴백)
    try {
      const plainText = this.stripAllMarkup(text);
      const messageOptions = { ...options };
      delete messageOptions.parse_mode;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(plainText, messageOptions);
      } else {
        await ctx.reply(plainText, messageOptions);
      }

      this.stats.plainTextFallback++;
      logger.debug("🆘 일반 텍스트 폴백 성공");
      return true;
    } catch (finalError) {
      logger.error("❌ 모든 전송 방법 실패:", finalError);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 📊 통계 조회
   */
  getStats() {
    const total = this.stats.totalProcessed || 1;
    return {
      ...this.stats,
      successRate: Math.round((this.stats.markdownV2Success / total) * 100),
      htmlFallbackRate: Math.round((this.stats.htmlFallback / total) * 100),
      plainTextRate: Math.round((this.stats.plainTextFallback / total) * 100),
      errorRate: Math.round((this.stats.errors / total) * 100)
    };
  }

  /**
   * 🔧 설정 업데이트
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    logger.info("📋 MarkdownHelper 설정 업데이트:", this.config);
  }

  /**
   * 🎨 스타일 메서드들 (편의 기능)
   */
  bold(text) {
    return `*${this.escapeMarkdownV2(text)}*`;
  }

  italic(text) {
    return `_${this.escapeMarkdownV2(text)}_`;
  }

  code(text) {
    return `\`${this.escapeMarkdownV2(text)}\``;
  }

  underline(text) {
    return `__${this.escapeMarkdownV2(text)}__`;
  }

  strikethrough(text) {
    return `~${this.escapeMarkdownV2(text)}~`;
  }

  spoiler(text) {
    return `||${this.escapeMarkdownV2(text)}||`;
  }

  link(text, url) {
    return `[${this.escapeMarkdownV2(text)}](${url})`;
  }
}

module.exports = MarkdownHelper;
