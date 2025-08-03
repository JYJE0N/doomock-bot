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
    this.markdownV2EscapeChars = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];

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

    // 이모지 다음의 공백은 보호
    text = text.replace(/([🌤️🌡️💧🌬️📊👁️📍⏰⚠️🏛️🔄🏙️📊⭐🔙]) /g, "$1 ");

    // 일반 특수문자 이스케이프
    this.markdownV2EscapeChars.forEach((char) => {
      const regex = new RegExp(`\\${char}`, "g");
      text = text.replace(regex, `\\${char}`);
    });

    return text;
  }

  /**
   * 🎯 날씨 전용 MarkdownV2 템플릿들
   */
  createWeatherCurrentTemplate() {
    return (data) => {
      const { city, weather, dust, timestamp } = data;

      return `${city.emoji || "🏙️"} *${this.escapeMarkdownV2(city.name)} 날씨* ${weather.emoji || "🌤️"}

🌡️ *온도*: ${weather.temperature}°C \\(체감 ${weather.feelsLike}°C\\)
📝 *날씨*: ${this.escapeMarkdownV2(weather.description)}
💧 *습도*: ${weather.humidity}%
🌬️ *바람*: ${weather.windSpeed}m/s${
        weather.pressure ? `\n📊 *기압*: ${weather.pressure}hPa` : ""
      }${weather.visibility ? `\n👁️ *가시거리*: ${weather.visibility}km` : ""}${
        dust
          ? `

🌬️ *미세먼지 정보*
${dust.emoji || "🟡"} *등급*: ${this.escapeMarkdownV2(dust.grade)}
🔸 *PM10*: ${dust.pm10}㎍/m³
🔹 *PM2\\.5*: ${dust.pm25}㎍/m³`
          : ""
      }

📍 *위치*: ${this.escapeMarkdownV2(city.fullName || city.name)}
⏰ *업데이트*: ${this.escapeMarkdownV2(timestamp)}${weather.isOffline ? "\n⚠️ *오프라인 모드* \\(기본 데이터\\)" : ""}`;
    };
  }

  createWeatherForecastTemplate() {
    return (data) => {
      const { city, forecast, timestamp } = data;

      let text = `📊 *${this.escapeMarkdownV2(city.name)} 날씨 예보* ${city.emoji || "🏙️"}

`;

      if (forecast && forecast.forecast && Array.isArray(forecast.forecast)) {
        forecast.forecast.forEach((day, index) => {
          const dayEmoji = index === 0 ? "📅" : "📆";
          const weatherEmoji = day.icon || "🌤️";

          text += `${dayEmoji} *${this.escapeMarkdownV2(day.dayOfWeek)}* \\(${this.escapeMarkdownV2(day.date)}\\)
${weatherEmoji} ${this.escapeMarkdownV2(day.description)}
🌡️ ${day.tempMin}°C ~ ${day.tempMax}°C`;

          if (day.humidity || day.rainProbability > 0) {
            text += `\n💧 ${day.humidity}%`;
            if (day.rainProbability > 0) {
              text += ` \\| ☔ ${day.rainProbability}%`;
            }
          }
          text += `\n\n`;
        });
      } else {
        text += "❌ 예보 데이터를 불러올 수 없습니다\\.\n\n";
      }

      text += `⏰ *업데이트*: ${this.escapeMarkdownV2(timestamp)}`;

      if (forecast && forecast.isOffline) {
        text += `\n⚠️ *오프라인 모드* \\(기본 예보\\)`;
      }

      return text;
    };
  }

  createWeatherCitiesTemplate() {
    return (data) => {
      const { cities, currentDefaultCity } = data;

      let text = `🏙️ *도시 선택*

원하는 도시를 선택해주세요\\!

`;

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
          // 줄바꿈은 그대로 유지 (텔레그램 HTML에서는 \n을 줄바꿈으로 인식)
          // .replace(/\n/g, "<br>") <- 이건 지원 안 됨!

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
      logger.warn("HTML 전송 실패:", htmlError.message);
    }

    // 🚨 3단계: 일반 텍스트 폴백 (최후 수단)
    try {
      const plainText = this.stripAllMarkup(text);
      const messageOptions = {
        ...options,
        parse_mode: undefined
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(plainText, messageOptions);
      } else {
        await ctx.reply(plainText, messageOptions);
      }

      this.stats.plainTextFallback++;
      logger.info("🚨 일반 텍스트 폴백 성공");
      return true;
    } catch (plainError) {
      logger.error("🚨 모든 전송 방법 실패:", plainError);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 🎯 날씨 전용 텍스트 생성 (MarkdownV2 최적화)
   */
  createWeatherText(data) {
    const template = this.weatherTemplates.current;
    return template(data);
  }

  createWeatherForecastText(data) {
    const template = this.weatherTemplates.forecast;
    return template(data);
  }

  /**
   * 🧠 패턴 학습 유틸리티들
   */
  getPatternKey(text) {
    // 텍스트의 구조적 패턴을 추출 (내용은 무시)
    return text
      .replace(/\d+/g, "N") // 숫자 -> N
      .replace(/[가-힣]+/g, "K") // 한글 -> K
      .replace(/[a-zA-Z]+/g, "E") // 영어 -> E
      .substring(0, 50); // 처음 50자만
  }

  /**
   * 🎨 스타일링 헬퍼들 (MarkdownV2 전용)
   */
  bold(text) {
    return `*${this.escapeMarkdownV2(String(text || ""))}*`;
  }

  italic(text) {
    return `_${this.escapeMarkdownV2(String(text || ""))}_`;
  }

  underline(text) {
    return `__${this.escapeMarkdownV2(String(text || ""))}__`;
  }

  strikethrough(text) {
    return `~${this.escapeMarkdownV2(String(text || ""))}~`;
  }

  code(text) {
    return `\`${String(text || "")}\``;
  }

  spoiler(text) {
    return `||${this.escapeMarkdownV2(String(text || ""))}||`;
  }

  link(text, url) {
    const safeText = this.escapeMarkdownV2(String(text));
    return `[${safeText}](${url})`;
  }

  /**
   * 📊 고급 상태 조회
   */
  getStatus() {
    const total = this.stats.totalProcessed;
    return {
      stats: this.stats,
      config: this.config,
      rates: {
        markdownV2: total > 0 ? Math.round((this.stats.markdownV2Success / total) * 100) : 0,
        html: total > 0 ? Math.round((this.stats.htmlFallback / total) * 100) : 0,
        plain: total > 0 ? Math.round((this.stats.plainTextFallback / total) * 100) : 0,
        success:
          total > 0
            ? Math.round(((this.stats.markdownV2Success + this.stats.htmlFallback + this.stats.plainTextFallback) / total) * 100)
            : 100
      },
      learning: {
        successPatterns: this.stats.successPatterns.size,
        problemPatterns: this.stats.problemPatterns.size,
        learningEnabled: this.config.enablePatternLearning
      },
      mode: "Smart MarkdownV2 System v2.0"
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.info("🧹 스마트 MarkdownV2 시스템 정리 시작...");

    const status = this.getStatus();
    logger.info("📊 최종 통계:", status);

    // 학습 패턴 저장 (필요시)
    if (this.config.enablePatternLearning) {
      logger.info(`🧠 학습된 패턴: 성공 ${status.learning.successPatterns}개, 실패 ${status.learning.problemPatterns}개`);
    }

    logger.info("✅ 스마트 MarkdownV2 시스템 정리 완료");
  }
}

module.exports = MarkdownHelper;
