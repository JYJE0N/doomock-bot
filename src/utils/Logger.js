// src/utils/Logger.js - 민감정보 보호 강화 버전

class Logger {
  constructor() {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      trace: "🔍",
      success: "✅",
    };

    this.currentLevel = this.logLevels.info;

    // 🔒 민감정보 패턴 정의
    this.sensitivePatterns = [
      // 봇 토큰 패턴
      {
        pattern: /\b\d+:[A-Za-z0-9_-]{35}\b/g,
        replacement: (match) => `${match.slice(0, 8)}***[BOT_TOKEN]`,
      },
      // MongoDB URL 패턴
      {
        pattern: /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^/]+)/g,
        replacement: "mongodb://***:***@[HIDDEN_HOST]",
      },
      // API 키 패턴 (32자 이상의 영숫자)
      {
        pattern: /\b[A-Za-z0-9]{32,}\b/g,
        replacement: (match) => `${match.slice(0, 8)}***[API_KEY]`,
      },
      // 비밀번호 필드
      {
        pattern: /"password"\s*:\s*"[^"]+"/g,
        replacement: '"password":"***"',
      },
      // 토큰 필드
      {
        pattern: /"token"\s*:\s*"[^"]+"/g,
        replacement: '"token":"***"',
      },
      // 일반적인 secret 패턴
      {
        pattern: /"secret"\s*:\s*"[^"]+"/g,
        replacement: '"secret":"***"',
      },
    ];

    // 🚫 완전히 숨겨야 할 키워드들
    this.sensitiveKeys = [
      "BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "TOKEN",
      "MONGO_URL",
      "MONGODB_URI",
      "DATABASE_URL",
      "API_KEY",
      "SECRET_KEY",
      "PRIVATE_KEY",
      "PASSWORD",
      "PASS",
      "PWD",
      "AUTH_TOKEN",
      "ACCESS_TOKEN",
      "REFRESH_TOKEN",
      "WEBHOOK_SECRET",
      "ENCRYPTION_KEY",
    ];
  }

  // 🔒 민감정보 마스킹 함수
  maskSensitiveData(message) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    let maskedMessage = message;

    // 정의된 패턴으로 마스킹
    this.sensitivePatterns.forEach(({ pattern, replacement }) => {
      maskedMessage = maskedMessage.replace(pattern, replacement);
    });

    return maskedMessage;
  }

  // 🔒 객체에서 민감정보 마스킹_무한 재귀 방지 버전
  maskSensitiveObject(obj, visited = new Set()) {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    // 🚨 무한 재귀 방지
    if (visited.has(obj)) {
      return "[CIRCULAR_REFERENCE]";
    }
    visited.add(obj);

    const masked = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyUpper = key.toUpperCase();

      const isSensitiveKey = this.sensitiveKeys.some((sensitiveKey) =>
        keyUpper.includes(sensitiveKey)
      );

      if (isSensitiveKey) {
        if (typeof value === "string" && value.length > 0) {
          masked[key] = `${value.slice(0, 4)}***[${keyUpper}]`;
        } else {
          masked[key] = "[HIDDEN]";
        }
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskSensitiveObject(value, visited);
      } else if (typeof value === "string") {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    visited.delete(obj);
    return masked;
  }

  // ✅ 통일된 시간 포맷
  getTimestamp() {
    const now = new Date();
    const koreaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
    );
    return koreaTime.toISOString().replace("T", " ").substring(0, 19);
  }

  // ✅ 보안 강화된 로그 포맷
  formatLog(level, message, metadata = {}) {
    const timestamp = this.getTimestamp();
    const emoji = this.emojis[level] || "";
    const levelUpper = level.toUpperCase().padEnd(5);

    // 🔒 메시지 마스킹
    const maskedMessage = this.maskSensitiveData(message);

    let logMessage = `[${timestamp}] [${levelUpper}] ${emoji} ${maskedMessage}`;

    // 🔒 메타데이터 마스킹
    if (metadata && Object.keys(metadata).length > 0) {
      const maskedMetadata = this.maskSensitiveObject(metadata);
      const metaString = Object.entries(maskedMetadata)
        .map(([key, value]) => {
          // 값이 객체면 JSON으로 변환 후 마스킹
          if (typeof value === "object" && value !== null) {
            return `${key}=${JSON.stringify(value)}`;
          }
          return `${key}=${value}`;
        })
        .join(", ");
      logMessage += ` | ${metaString}`;
    }

    return logMessage;
  }

  // ✅ 기본 로그 메서드들
  log(level, message, metadata = {}) {
    if (this.logLevels[level] > this.currentLevel) {
      return;
    }

    const formatted = this.formatLog(level, message, metadata);
    console.log(formatted);
  }

  error(message, metadata = {}) {
    this.log("error", message, metadata);
  }

  warn(message, metadata = {}) {
    this.log("warn", message, metadata);
  }

  info(message, metadata = {}) {
    this.log("info", message, metadata);
  }

  debug(message, metadata = {}) {
    this.log("debug", message, metadata);
  }

  success(message, metadata = {}) {
    this.log("success", message, metadata);
  }

  // 🔒 안전한 환경변수 로깅
  logEnvironmentSafe(config) {
    const safeConfig = {
      NODE_ENV: config.NODE_ENV,
      VERSION: config.VERSION,
      PORT: config.PORT,
      BOT_USERNAME: config.BOT_USERNAME,

      // 🔒 민감정보는 존재 여부만 로깅
      BOT_TOKEN_SET: !!config.BOT_TOKEN,
      MONGO_URL_SET: !!config.MONGO_URL,
      WEATHER_API_KEY_SET: !!config.WEATHER_API_KEY,
      AIR_KOREA_API_KEY_SET: !!config.AIR_KOREA_API_KEY,

      // 사용자 수는 안전
      ADMIN_USER_COUNT: config.ADMIN_USER_IDS?.length || 0,
      ALLOWED_USER_COUNT: config.ALLOWED_USER_IDS?.length || "ALL",

      // 기능 상태
      ENABLED_FEATURES: Object.entries(config.FEATURES || {})
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature)
        .join(", "),

      // 환경 정보
      RAILWAY: config.isRailway ? "YES" : "NO",
      WEBHOOK_MODE: config.isWebhookMode ? "YES" : "NO",
    };

    this.info("🔒 봇 설정 요약 (보안):");
    Object.entries(safeConfig).forEach(([key, value]) => {
      this.info(`  ${key}: ${value}`);
    });
  }

  // 🔒 안전한 사용자 로깅 (개인정보 보호)
  safeUserAction(userId, action, metadata = {}) {
    // 사용자 ID 마스킹 (뒤 3자리만 표시)
    const maskedUserId = `***${String(userId).slice(-3)}`;

    const safeMetadata = {
      ...metadata,
      // 개인정보가 포함될 수 있는 필드들 제거
      username: undefined,
      first_name: undefined,
      last_name: undefined,
      phone_number: undefined,
    };

    this.info(`👤 사용자 ${maskedUserId}: ${action}`, safeMetadata);
  }

  // 🔒 안전한 API 로깅
  safeApiCall(service, endpoint, status, responseTime, metadata = {}) {
    // API 키가 포함된 URL이나 헤더 정보 마스킹
    const safeMetadata = this.maskSensitiveObject(metadata);

    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info";
    const message = `🌐 API ${service}/${endpoint}`;

    this.log(level, message, {
      status,
      responseTime: `${responseTime}ms`,
      ...safeMetadata,
    });
  }

  // ✅ 모듈별 로깅 (기존 유지)
  module(moduleName, event, metadata = {}) {
    const safeMetadata = this.maskSensitiveObject(metadata);
    const message = `🔧 모듈 ${moduleName}: ${event}`;
    this.info(message, safeMetadata);
  }

  // ✅ 봇 이벤트 로깅 (기존 유지)
  botEvent(event, metadata = {}) {
    const safeMetadata = this.maskSensitiveObject(metadata);
    const message = `🤖 봇 이벤트: ${event}`;
    this.info(message, safeMetadata);
  }

  // ✅ 성능 측정 (기존 유지)
  startTimer(label) {
    const start = process.hrtime.bigint();

    return {
      end: (metadata = {}) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // ms

        const safeMetadata = this.maskSensitiveObject(metadata);

        this.info(`⏱️ ${label}`, {
          duration: `${duration.toFixed(2)}ms`,
          ...safeMetadata,
        });

        return duration;
      },
    };
  }

  // ✅ 레벨 설정 (기존 유지)
  setLevel(level) {
    if (Object.prototype.hasOwnProperty.call(this.logLevels, level)) {
      this.currentLevel = this.logLevels[level];
      this.info(`🔧 로그 레벨 변경: ${level}`);
    }
  }

  // 🔒 개발용 디버깅 (민감정보 마스킹)
  debugSafe(message, data = {}) {
    if (this.currentLevel >= this.logLevels.debug) {
      const maskedData = this.maskSensitiveObject(data);
      this.debug(message, maskedData);
    }
  }

  // 🔒 에러 로깅 (스택 트레이스에서 민감정보 제거)
  errorSafe(message, error = {}) {
    const safeError = {
      message: error.message,
      code: error.code,
      name: error.name,
      // 스택에서 민감정보 마스킹
      stack: error.stack ? this.maskSensitiveData(error.stack) : undefined,
    };

    this.error(message, safeError);
  }
}

// 싱글톤 인스턴스
const logger = new Logger();
module.exports = logger;
