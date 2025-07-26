// src/utils/Logger.js - 통합 로깅 시스템 v3.0.1
const winston = require("winston");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

/**
 * 🎨 고급 로깅 시스템 v3.0.1 (리팩토링)
 *
 * 🔧 주요 개선사항:
 * - 중복 출력 문제 해결
 * - Railway 환경 최적화
 * - 한국 시간 표준화
 * - 성능 개선된 로그 포맷팅
 * - 메모리 사용량 최적화
 */
class AdvancedLogger {
  constructor() {
    // 싱글톤 패턴
    if (AdvancedLogger.instance) {
      return AdvancedLogger.instance;
    }

    // 🌍 환경 감지
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.logLevel =
      process.env.LOG_LEVEL || (this.isDevelopment ? "debug" : "info");

    // 📊 통계
    this.stats = {
      logsCount: 0,
      errorsCount: 0,
      warningsCount: 0,
      startTime: Date.now(),
    };

    // 🎨 컬러 테마 설정
    this.setupColorTheme();

    // 🎯 이모지 매핑
    this.setupEmojiMapping();

    // 📁 로그 디렉토리 설정
    this.setupLogDirectory();

    // 🔧 Winston 설정
    this.setupWinston();

    // 🎖️ 레벨 매핑
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      success: 2, // info와 동일 레벨
      http: 3,
      debug: 4,
    };

    this.currentLevel = this.levels[this.logLevel] || this.levels.info;

    AdvancedLogger.instance = this;

    // 🚀 초기화 완료 로그
    this.info(
      `🚀 Logger v3.0.1 초기화 완료 [${this.isDevelopment ? "개발" : "운영"}]`,
      {
        environment: this.isDevelopment ? "development" : "production",
        railway: this.isRailway,
        logLevel: this.logLevel,
      }
    );
  }

  /**
   * 🎨 컬러 테마 설정
   */
  setupColorTheme() {
    this.colors = {
      error: chalk.red.bold,
      warn: chalk.yellow.bold,
      info: chalk.cyan,
      success: chalk.green.bold,
      debug: chalk.gray,
      http: chalk.magenta,
      timestamp: chalk.gray,
      module: chalk.blue.bold,
      user: chalk.green,
    };
  }

  /**
   * 🎯 이모지 매핑 설정
   */
  setupEmojiMapping() {
    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      success: "✅",
      debug: "🐛",
      http: "🌐",
    };
  }

  /**
   * 📁 로그 디렉토리 설정
   */
  setupLogDirectory() {
    // Railway에서는 파일 로깅 비활성화
    if (this.isRailway) {
      this.logDir = null;
      return;
    }

    this.logDir = process.env.LOG_DIR || "logs";

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.warn("⚠️ 로그 디렉토리 생성 실패:", error.message);
      this.logDir = null;
    }
  }

  /**
   * 🔧 Winston 설정
   */
  setupWinston() {
    const transports = [];

    // 🖥️ 콘솔 Transport (운영 환경에서만 JSON 형태)
    if (this.isDevelopment) {
      // 개발환경: Winston 콘솔 비활성화 (중복 방지)
    } else {
      // 운영환경: JSON 포맷
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    // 📄 파일 Transport (Railway 제외)
    if (this.logDir) {
      try {
        // 에러 로그 파일
        transports.push(
          new winston.transports.File({
            filename: path.join(this.logDir, "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );

        // 전체 로그 파일
        transports.push(
          new winston.transports.File({
            filename: path.join(this.logDir, "combined.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );
      } catch (error) {
        console.warn("⚠️ 로그 파일 설정 실패:", error.message);
      }
    }

    // Winston 인스턴스 생성
    this.winston = winston.createLogger({
      level: this.logLevel,
      levels: winston.config.npm.levels,
      transports,
    });
  }

  /**
   * 🕐 한국 시간 문자열 생성
   */
  getKSTTimeString() {
    const now = new Date();
    return now.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });
  }

  /**
   * 🎯 핵심 로그 메서드 (중복 출력 방지)
   */
  _log(level, ...args) {
    // 레벨 체크
    if (this.levels[level] > this.currentLevel) return;

    // 통계 업데이트
    this.stats.logsCount++;
    if (level === "error") this.stats.errorsCount++;
    if (level === "warn") this.stats.warningsCount++;

    const timestamp = this.getKSTTimeString();
    const emoji = this.emojis[level] || "📝";
    const color = this.colors[level] || chalk.white;

    // 메시지와 메타데이터 분리
    let message = "";
    let meta = {};

    args.forEach((arg) => {
      if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
        Object.assign(meta, arg);
      } else {
        message += (message ? " " : "") + String(arg);
      }
    });

    // 🎨 개발 환경: 컬러풀한 콘솔 출력 (Winston 사용 안 함)
    if (this.isDevelopment) {
      const timestampStr = this.colors.timestamp(`[${timestamp}]`);
      const levelStr = color(level.toUpperCase().padEnd(7));

      // 메타데이터 포맷팅
      let metaStr = "";
      if (Object.keys(meta).length > 0) {
        const formattedMeta = [];
        for (const [key, value] of Object.entries(meta)) {
          if (key === "module") {
            formattedMeta.push(this.colors.module(`${key}:${value}`));
          } else if (key === "userId" || key === "userName") {
            formattedMeta.push(this.colors.user(`${key}:${value}`));
          } else {
            formattedMeta.push(chalk.gray(`${key}:${value}`));
          }
        }
        metaStr =
          chalk.gray(" {") +
          formattedMeta.join(chalk.gray(", ")) +
          chalk.gray("}");
      }

      console.log(`${emoji} ${timestampStr} ${levelStr} ${message}${metaStr}`);
    }

    // 🏭 운영 환경: Winston만 사용
    if (!this.isDevelopment) {
      this.winston.log(level === "success" ? "info" : level, message, meta);
    }

    // 📄 파일 로깅 (개발환경에서도)
    if (this.winston && this.logDir) {
      this.winston.log(level === "success" ? "info" : level, message, meta);
    }
  }

  // ===== 🎯 기본 로그 메서드들 =====

  /**
   * ❌ 에러 로그
   */
  error(message, meta = {}) {
    this._log("error", message, meta);
  }

  /**
   * ⚠️ 경고 로그
   */
  warn(message, meta = {}) {
    this._log("warn", message, meta);
  }

  /**
   * ℹ️ 정보 로그
   */
  info(message, meta = {}) {
    this._log("info", message, meta);
  }

  /**
   * 🐛 디버그 로그
   */
  debug(message, meta = {}) {
    this._log("debug", message, meta);
  }

  /**
   * ✅ 성공 로그
   */
  success(message, meta = {}) {
    this._log("success", message, meta);
  }

  /**
   * 🌐 HTTP 요청 로그
   */
  http(message, meta = {}) {
    this._log("http", message, meta);
  }

  // ===== 🎨 특수 로깅 메서드들 =====

  /**
   * 🚀 모듈 시작 로그 (박스 스타일)
   */
  moduleStart(moduleName, version = "") {
    const versionStr = version ? ` v${version}` : "";
    const boxLine = "─".repeat(moduleName.length + versionStr.length + 4);

    if (this.isDevelopment) {
      console.log(chalk.cyan(`┌─${boxLine}─┐`));
      console.log(chalk.cyan(`│ 🚀 ${moduleName}${versionStr} │`));
      console.log(chalk.cyan(`└─${boxLine}─┘`));
    }

    this.info(`🚀 ${moduleName}${versionStr} 시작`, {
      module: moduleName,
      version,
    });
  }

  /**
   * 🎖️ 중요한 메시지 (강조)
   */
  important(message, meta = {}) {
    if (this.isDevelopment) {
      console.log(chalk.bgYellow.black.bold(` ${message} `));
    }
    this.info(`🎖️ ${message}`, meta);
  }

  /**
   * 🌐 HTTP 요청 로그 (Express 스타일)
   */
  httpRequest(method, path, statusCode, duration) {
    const emoji = statusCode >= 400 ? "❌" : statusCode >= 300 ? "⚠️" : "✅";
    this.http(`${emoji} ${method} ${path} ${statusCode} (${duration}ms)`, {
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * 💚 시스템 상태 로그
   */
  systemStatus(component, status, details = {}) {
    const emoji =
      status === "healthy" ? "💚" : status === "warning" ? "💛" : "❤️";
    this.info(`${emoji} [${component}] ${status}`, {
      component,
      status,
      ...details,
    });
  }

  /**
   * 👤 사용자 활동 로그
   */
  userActivity(userId, action, details = {}) {
    this.info(`👤 사용자 활동: ${action}`, {
      userId,
      action,
      timestamp: this.getKSTTimeString(),
      ...details,
    });
  }

  /**
   * ⏱️ 성능 측정 로그
   */
  performance(operation, startTime, details = {}) {
    const duration = Date.now() - startTime;
    const emoji = duration > 1000 ? "🐌" : duration > 500 ? "⚠️" : "⚡";

    this.info(`${emoji} ${operation} 완료 (${duration}ms)`, {
      operation,
      duration,
      ...details,
    });
  }

  /**
   * 💾 메모리 사용량 로그
   */
  memory() {
    const usage = process.memoryUsage();
    const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    this.info("💾 메모리 사용량", {
      heap: `${formatMB(usage.heapUsed)}MB / ${formatMB(usage.heapTotal)}MB`,
      external: `${formatMB(usage.external)}MB`,
      rss: `${formatMB(usage.rss)}MB`,
    });

    if (this.isDevelopment) {
      console.table({
        "Heap Used": formatMB(usage.heapUsed) + " MB",
        "Heap Total": formatMB(usage.heapTotal) + " MB",
        External: formatMB(usage.external) + " MB",
        RSS: formatMB(usage.rss) + " MB",
      });
    }
  }

  // ===== 🚨 에러 처리 전용 메서드들 =====

  /**
   * 💀 치명적 에러 로그 (프로세스 종료 고려)
   */
  fatal(message, error = null, shouldExit = false) {
    this.error(
      `💀 FATAL: ${message}`,
      error
        ? {
            stack: error.stack,
            name: error.name,
            message: error.message,
          }
        : {}
    );

    if (shouldExit) {
      process.exit(1);
    }
  }

  /**
   * 🚂 Railway 전용 로그
   */
  railway(message, meta = {}) {
    if (this.isRailway) {
      this.info(`🚂 ${message}`, { railway: true, ...meta });
    }
  }

  // ===== 📊 통계 및 상태 =====

  /**
   * 📊 로거 통계 조회
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      environment: this.isDevelopment ? "development" : "production",
      railway: this.isRailway,
      logLevel: this.logLevel,
      logDirectory: this.logDir,
    };
  }

  /**
   * ⏱️ 지속시간 포맷팅
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.info("🧹 Logger 정리 시작...");

      if (this.winston) {
        await new Promise((resolve) => {
          this.winston.end(resolve);
        });
      }

      this.info("✅ Logger 정리 완료");
    } catch (error) {
      console.error("❌ Logger 정리 실패:", error);
    }
  }
}

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
      // API 키 형식 (32자 이상의 영숫자)
      {
        regex: /\b[A-Za-z0-9_-]{32,}\b/g,
        replacement: (match) => {
          // 파일 경로나 일반 텍스트는 제외
          if (match.includes("/") || match.includes("_") || match.length < 35) {
            return match;
          }
          return "[API_KEY]";
        },
      },
      // 이메일 주소
      {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: "[EMAIL]",
      },
      // IP 주소
      {
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: "[IP_ADDRESS]",
      },
      // 전화번호
      {
        regex: /\b\d{3}[-.]?\d{3,4}[-.]?\d{4}\b/g,
        replacement: "[PHONE]",
      },
      // JWT 토큰
      {
        regex: /Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
        replacement: "Bearer [JWT_TOKEN]",
      },
      // 신용카드 번호
      {
        regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        replacement: "[CARD_NUMBER]",
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
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
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

// Logger 클래스 수정
class Logger {
  constructor() {
    // ... 기존 코드 ...

    // 🛡️ 마스킹 인스턴스
    this.masker = new SensitiveDataMasker();

    // 마스킹 활성화 여부
    this.enableMasking = process.env.ENABLE_LOG_MASKING !== "false";
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

  // 기존 로그 메서드들 수정
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
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg
        )
        .join(" ");
      logMessage += ` ${formattedArgs}`;
    }

    console.log(logMessage);
  }

  // 각 로그 레벨 메서드도 수정
  info(message, ...args) {
    if (this.level <= this.levels.INFO) {
      this.log("info", message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.level <= this.levels.DEBUG) {
      this.log("debug", message, ...args);
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
    if (this.level <= this.levels.INFO) {
      this.log("success", message, ...args);
    }
  }
}

// 전역 인스턴스 생성
const logger = new Logger();

module.exports = logger;
