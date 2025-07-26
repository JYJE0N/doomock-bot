// src/utils/Logger.js - 완전한 Logger 클래스 (마스킹 기능 포함)
const chalk = require("chalk");
const moment = require("moment-timezone");

/**
 * 🛡️ 민감한 정보 마스킹 클래스
 */
class SensitiveDataMasker {
  constructor() {
    // 마스킹할 패턴들
    this.patterns = [
      // 봇 토큰 (숫자:영숫자 형식)
      {
        regex: /\b\d{8,12}:[A-Za-z0-9_-]{30,40}\b/g,
        replacement: "[BOT_TOKEN]",
      },
      // MongoDB URI
      {
        regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/\s]+/gi,
        replacement: "mongodb://[USER]:[PASS]@[HOST]",
      },
      // MongoDB 비밀번호만
      {
        regex: /mongo:[A-Za-z0-9]{20,}/g,
        replacement: "mongo:[MONGODB_PASS]",
      },
      // Railway 도메인
      {
        regex: /[a-z0-9-]+\.proxy\.rlwy\.net/g,
        replacement: "[RAILWAY_HOST]",
      },
      // 포트 번호가 포함된 URL
      {
        regex: /:(\d{4,5})\//g,
        replacement: ":[PORT]/",
      },
    ];

    // 환경변수로 추가 패턴 설정 가능
    this.customPatterns = this.loadCustomPatterns();
  }

  /**
   * 커스텀 패턴 로드
   */
  loadCustomPatterns() {
    const patterns = [];

    // 특정 환경변수 값들을 마스킹
    const sensitiveEnvVars = [
      "BOT_TOKEN",
      "MONGO_URL",
      "MONGODB_URI",
      "DATABASE_URL",
      "OPENWEATHER_API_KEY",
      "GOOGLE_CLOUD_KEY",
    ];

    sensitiveEnvVars.forEach((varName) => {
      const value = process.env[varName];
      if (value && value.length > 5) {
        patterns.push({
          regex: new RegExp(this.escapeRegExp(value), "g"),
          replacement: `[${varName}]`,
        });
      }
    });

    return patterns;
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 텍스트 마스킹
   */
  mask(text) {
    if (typeof text !== "string") {
      if (typeof text === "object") {
        return this.maskObject(text);
      }
      return text;
    }

    let maskedText = text;

    // 기본 패턴 적용
    this.patterns.forEach((pattern) => {
      if (typeof pattern.replacement === "function") {
        maskedText = maskedText.replace(pattern.regex, pattern.replacement);
      } else {
        maskedText = maskedText.replace(pattern.regex, pattern.replacement);
      }
    });

    // 커스텀 패턴 적용
    this.customPatterns.forEach((pattern) => {
      maskedText = maskedText.replace(pattern.regex, pattern.replacement);
    });

    return maskedText;
  }

  /**
   * 객체 마스킹 (재귀적)
   */
  maskObject(obj) {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    // 배열인 경우
    if (Array.isArray(obj)) {
      return obj.map((item) => this.mask(item));
    }

    // 객체인 경우
    const maskedObj = {};
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "auth",
      "credential",
      "private",
      "api_key",
      "apikey",
      "access_token",
      "refresh_token",
      "bearer",
    ];

    for (const [key, value] of Object.entries(obj)) {
      // 키 이름이 민감한 정보를 나타내는 경우
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        maskedObj[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        maskedObj[key] = this.mask(value);
      } else if (typeof value === "object") {
        maskedObj[key] = this.maskObject(value);
      } else {
        maskedObj[key] = value;
      }
    }

    return maskedObj;
  }
}

/**
 * 📝 Logger 클래스
 */
class Logger {
  constructor() {
    // 로그 레벨 정의 (중요!)
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      SUCCESS: 1, // INFO와 같은 레벨
    };

    // 현재 로그 레벨
    this.level =
      this.levels[process.env.LOG_LEVEL?.toUpperCase()] || this.levels.INFO;

    // 아이콘 정의
    this.icons = {
      debug: "🐛",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      success: "✅",
    };

    // 색상 설정
    this.colors = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green,
    };

    // 한국 시간대
    this.timezone = "Asia/Seoul";

    // 🛡️ 마스킹 인스턴스
    this.masker = new SensitiveDataMasker();

    // 마스킹 활성화 여부
    this.enableMasking = process.env.ENABLE_LOG_MASKING !== "false";

    // 초기화 메시지
    const env = process.env.NODE_ENV || "development";
    const railway = process.env.RAILWAY_ENVIRONMENT ? "railway" : "local";
    const logLevel =
      Object.keys(this.levels)
        .find((key) => this.levels[key] === this.level)
        ?.toLowerCase() || "info";

    this.info(
      `🚀 Logger v3.0.1 초기화 완료 [${
        env === "production" ? "운영" : "개발"
      }]`,
      {
        environment: env,
        railway: railway === "railway",
        logLevel: logLevel,
      }
    );
  }

  /**
   * 타임스탬프 생성
   */
  getTimestamp() {
    return moment().tz(this.timezone).format("YYYY. MM. DD. HH:mm:ss");
  }

  /**
   * 아이콘 가져오기
   */
  getIcon(level) {
    return this.icons[level] || "";
  }

  /**
   * 색상 적용
   */
  colorize(text, level) {
    const colorFn = this.colors[level];
    return colorFn ? colorFn(text) : text;
  }

  /**
   * 🛡️ 메시지 마스킹
   */
  maskMessage(message, ...args) {
    if (!this.enableMasking) {
      return { message, args };
    }

    // 메시지 마스킹
    const maskedMessage = this.masker.mask(message);

    // 인자들 마스킹
    const maskedArgs = args.map((arg) => {
      if (typeof arg === "string") {
        return this.masker.mask(arg);
      } else if (typeof arg === "object") {
        return this.masker.maskObject(arg);
      }
      return arg;
    });

    return { message: maskedMessage, args: maskedArgs };
  }

  /**
   * 기본 로그 메서드
   */
  log(level, message, ...args) {
    // 마스킹 적용
    const { message: maskedMessage, args: maskedArgs } = this.maskMessage(
      message,
      ...args
    );

    const timestamp = this.getTimestamp();
    const coloredLevel = this.colorize(level.toUpperCase().padEnd(7), level);
    const icon = this.getIcon(level);

    let logMessage = `${icon} [${timestamp}] ${coloredLevel} ${maskedMessage}`;

    if (maskedArgs.length > 0) {
      const formattedArgs = maskedArgs
        .map((arg) => {
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return "[Circular Object]";
            }
          }
          return arg;
        })
        .join(" ");

      if (formattedArgs) {
        logMessage += ` ${formattedArgs}`;
      }
    }

    console.log(logMessage);
  }

  // 로그 레벨별 메서드
  debug(message, ...args) {
    if (this.level <= this.levels.DEBUG) {
      this.log("debug", message, ...args);
    }
  }

  info(message, ...args) {
    if (this.level <= this.levels.INFO) {
      this.log("info", message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.level <= this.levels.WARN) {
      this.log("warn", message, ...args);
    }
  }

  error(message, ...args) {
    if (this.level <= this.levels.ERROR) {
      this.log("error", message, ...args);
    }
  }

  success(message, ...args) {
    if (this.level <= this.levels.SUCCESS) {
      this.log("success", message, ...args);
    }
  }

  // 특별한 로그 메서드
  moduleStart(moduleName, version = "") {
    const width = 30;
    const title = version ? `🚀 ${moduleName} v${version}` : `🚀 ${moduleName}`;
    const padding = Math.max(0, width - title.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;

    console.log(chalk.cyan("┌" + "─".repeat(width - 2) + "┐"));
    console.log(
      chalk.cyan("│") +
        " ".repeat(leftPad) +
        chalk.white.bold(title) +
        " ".repeat(rightPad) +
        chalk.cyan("│")
    );
    console.log(chalk.cyan("└" + "─".repeat(width - 2) + "┘"));

    this.info(`${title} 시작`, { module: moduleName, version });
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const logger = new Logger();
module.exports = logger;
