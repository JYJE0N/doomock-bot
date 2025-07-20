// src/utils/Logger.js - 무한 재귀 방지 강화 Logger

class Logger {
  constructor() {
    // 중복 초기화 방지
    if (Logger.instance) {
      return Logger.instance;
    }

    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
      success: 5,
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
    this.isInitialized = false;

    // 🚨 무한 재귀 방지 시스템
    this.isLogging = false; // 로깅 진행 중 플래그
    this.recursionDepth = 0; // 재귀 깊이 추적
    this.maxRecursionDepth = 5; // 최대 재귀 깊이
    this.recursionGuard = new Set(); // 순환 참조 추적
    this.emergencyMode = false; // 응급 모드 (console.log만 사용)

    // 🇰🇷 한국 시간 캐시 (성능 개선)
    this.lastTimestampCheck = 0;
    this.cachedTimestamp = null;
    this.timestampCacheMs = 1000; // 1초 캐시

    // 🔒 민감정보 패턴 정의
    this.sensitivePatterns = [
      {
        pattern: /\b\d+:[A-Za-z0-9_-]{35}\b/g,
        replacement: (match) => `${match.slice(0, 8)}***[BOT_TOKEN]`,
      },
      {
        pattern: /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^/]+)/g,
        replacement: "mongodb://***:***@[HIDDEN_HOST]",
      },
      {
        pattern: /\b[A-Za-z0-9]{32,}\b/g,
        replacement: (match) => `${match.slice(0, 8)}***[API_KEY]`,
      },
    ];

    this.sensitiveKeys = [
      "BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "TOKEN",
      "MONGO_URL",
      "MONGODB_URI",
      "DATABASE_URL",
      "API_KEY",
      "SECRET_KEY",
      "PASSWORD",
    ];

    // 싱글톤 인스턴스 저장
    Logger.instance = this;
    this.isInitialized = true;
  }

  // 🔒 민감정보 마스킹
  maskSensitiveData(message) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    let maskedMessage = message;
    this.sensitivePatterns.forEach(({ pattern, replacement }) => {
      maskedMessage = maskedMessage.replace(pattern, replacement);
    });

    return maskedMessage;
  }

  // 🔒 객체 마스킹 (강화된 무한 재귀 방지)
  maskSensitiveObject(obj, visited = new Set(), depth = 0) {
    // 🚨 깊이 제한 (5단계까지만)
    if (depth > 5) {
      return "[MAX_DEPTH_REACHED]";
    }

    // 기본 타입 체크
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    // 순환 참조 체크
    if (visited.has(obj)) {
      return "[CIRCULAR_REFERENCE]";
    }

    // 특수 객체 처리
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: this.maskSensitiveData(obj.message || ""),
        code: obj.code,
      };
    }
    if (obj instanceof RegExp) {
      return obj.toString();
    }

    // 배열 처리
    if (Array.isArray(obj)) {
      if (obj.length > 10) {
        return `[ARRAY_LENGTH_${obj.length}]`;
      }
      visited.add(obj);
      const masked = obj.map((item) =>
        this.maskSensitiveObject(item, visited, depth + 1)
      );
      visited.delete(obj);
      return masked;
    }

    // 객체 크기 제한
    const keys = Object.keys(obj);
    if (keys.length > 20) {
      return `[LARGE_OBJECT_${keys.length}_KEYS]`;
    }

    visited.add(obj);

    try {
      const masked = {};
      for (const [key, value] of Object.entries(obj)) {
        // 키 길이 제한
        if (key.length > 100) {
          masked["[LONG_KEY]"] = "[TRUNCATED]";
          continue;
        }

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
          masked[key] = this.maskSensitiveObject(value, visited, depth + 1);
        } else if (typeof value === "string") {
          // 문자열 길이 제한
          if (value.length > 500) {
            masked[key] = this.maskSensitiveData(
              value.slice(0, 500) + "...[TRUNCATED]"
            );
          } else {
            masked[key] = this.maskSensitiveData(value);
          }
        } else {
          masked[key] = value;
        }
      }

      visited.delete(obj);
      return masked;
    } catch (error) {
      visited.delete(obj);
      return "[MASKING_ERROR]";
    }
  }

  // 한국 시간 포맷 (정확한 방식 + 캐시)
  getTimestamp() {
    try {
      // 캐시 확인 (1초 이내면 재사용)
      const now = Date.now();
      if (
        this.cachedTimestamp &&
        now - this.lastTimestampCheck < this.timestampCacheMs
      ) {
        return this.cachedTimestamp;
      }

      // 🇰🇷 방법 1: UTC 시간에 9시간 더하기 (가장 안정적)
      const currentDate = new Date();
      const utcTime =
        currentDate.getTime() + currentDate.getTimezoneOffset() * 60000;
      const koreaTime = new Date(utcTime + 9 * 3600000); // UTC+9

      const timestamp = koreaTime
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);

      // 캐시 업데이트
      this.lastTimestampCheck = now;
      this.cachedTimestamp = timestamp;

      return timestamp;
    } catch (error) {
      // 🚨 폴백: 기본 로컬 시간 사용
      try {
        const now = new Date();
        const formatted = now.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        // "2025. 07. 20. 15:30:45" → "2025-07-20 15:30:45"
        return formatted
          .replace(/\. /g, "-")
          .replace(/\./g, "")
          .replace(/(\d{4})-(\d{2})-(\d{2}) /, "$1-$2-$3 ");
      } catch (fallbackError) {
        // 🚨 최후의 수단: 현재 시간 그대로 (잘못된 시간대일 수 있음)
        return new Date().toISOString().replace("T", " ").substring(0, 19);
      }
    }
  }

  // 🇰🇷 한국시간 전용 메서드들
  getKoreaTime() {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcTime + 9 * 3600000);
  }

  formatKoreaTime(date = null, format = "full") {
    const targetDate = date || this.getKoreaTime();

    try {
      switch (format) {
        case "date":
          return targetDate.toLocaleDateString("ko-KR", {
            timeZone: "Asia/Seoul",
          });
        case "time":
          return targetDate.toLocaleTimeString("ko-KR", {
            timeZone: "Asia/Seoul",
            hour12: false,
          });
        case "short":
          return targetDate.toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        default:
          return targetDate.toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            hour12: false,
          });
      }
    } catch (error) {
      return targetDate.toISOString().replace("T", " ").substring(0, 19);
    }
  }

  // 로그 포맷팅 (재귀 방지)
  formatLog(level, message, metadata = {}) {
    // 🚨 재귀 감지
    if (this.isLogging) {
      console.log(`[RECURSION_DETECTED] ${level}: ${message}`);
      return null;
    }

    // 🚨 응급 모드 체크
    if (this.emergencyMode) {
      return `[EMERGENCY] ${level}: ${message}`;
    }

    try {
      this.isLogging = true;
      this.recursionDepth++;

      // 깊이 제한 체크
      if (this.recursionDepth > this.maxRecursionDepth) {
        this.emergencyMode = true;
        console.log("[MAX_RECURSION] Logger가 응급 모드로 전환됩니다");
        return `[MAX_RECURSION] ${level}: ${message}`;
      }

      const timestamp = this.getTimestamp();
      const emoji = this.emojis[level] || "";
      const levelUpper = level.toUpperCase().padEnd(5);

      const maskedMessage = this.maskSensitiveData(message);
      let logMessage = `[${timestamp}] [${levelUpper}] ${emoji} ${maskedMessage}`;

      if (metadata && Object.keys(metadata).length > 0) {
        const maskedMetadata = this.maskSensitiveObject(metadata);
        const metaString = Object.entries(maskedMetadata)
          .map(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              try {
                return `${key}=${JSON.stringify(value)}`;
              } catch (jsonError) {
                return `${key}=[JSON_ERROR]`;
              }
            }
            return `${key}=${value}`;
          })
          .join(", ");
        logMessage += ` | ${metaString}`;
      }

      return logMessage;
    } catch (error) {
      this.emergencyMode = true;
      console.log(`[FORMAT_ERROR] Logger 포맷 오류: ${error.message}`);
      return `[FORMAT_ERROR] ${level}: ${message}`;
    } finally {
      this.recursionDepth--;
      this.isLogging = false;
    }
  }

  // 기본 로그 메서드 (안전 장치 추가)
  log(level, message, metadata = {}) {
    try {
      // 레벨 체크
      if (this.logLevels[level] > this.currentLevel) {
        return;
      }

      // 응급 모드면 단순 출력
      if (this.emergencyMode) {
        console.log(`[EMERGENCY] ${level}: ${message}`);
        return;
      }

      const formatted = this.formatLog(level, message, metadata);

      if (formatted) {
        console.log(formatted);
      }
    } catch (error) {
      // 최후의 보루 - 직접 console.log
      console.log(
        `[LOGGER_ERROR] ${level}: ${message} | Error: ${error.message}`
      );
    }
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

  trace(message, metadata = {}) {
    this.log("trace", message, metadata);
  }

  success(message, metadata = {}) {
    this.log("success", message, metadata);
  }

  // 성능 측정
  startTimer(label) {
    const start = process.hrtime.bigint();

    return {
      end: (metadata = {}) => {
        try {
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;

          const safeMetadata = this.maskSensitiveObject(metadata);

          this.info(`⏱️ ${label}`, {
            duration: `${duration.toFixed(2)}ms`,
            ...safeMetadata,
          });

          return duration;
        } catch (error) {
          console.log(`[TIMER_ERROR] ${label}: ${error.message}`);
          return 0;
        }
      },
    };
  }

  // 레벨 설정
  setLevel(level) {
    if (Object.prototype.hasOwnProperty.call(this.logLevels, level)) {
      this.currentLevel = this.logLevels[level];
      this.info(`🔧 로그 레벨 변경: ${level}`);
    }
  }

  // 안전한 에러 로깅 (강화)
  errorSafe(message, error = {}) {
    try {
      const safeError = {
        message: error.message || "[NO_MESSAGE]",
        code: error.code || "[NO_CODE]",
        name: error.name || "[NO_NAME]",
        stack: error.stack
          ? this.maskSensitiveData(error.stack.slice(0, 1000))
          : "[NO_STACK]",
      };

      this.error(message, safeError);
    } catch (safeError) {
      // 최후의 보루 - 직접 console.error
      console.error(
        `[SAFE_ERROR_FAILED] ${message} | Original Error: ${
          error?.message || "Unknown"
        } | Safe Error: ${safeError?.message || "Unknown"}`
      );
    }
  }

  // 응급 모드 복구
  resetEmergencyMode() {
    if (this.emergencyMode) {
      this.emergencyMode = false;
      this.recursionDepth = 0;
      this.recursionGuard.clear();
      this.isLogging = false;
      console.log("[RECOVERY] Logger 응급 모드 해제됨");
    }
  }

  // 🇰🇷 시간 디버깅 정보
  getTimeDebugInfo() {
    const systemTime = new Date();
    const koreaTime = this.getKoreaTime();

    return {
      systemTime: systemTime.toISOString(),
      systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      koreaTime: koreaTime.toISOString(),
      koreaFormatted: this.formatKoreaTime(koreaTime),
      timestamp: this.getTimestamp(),
      timezoneOffset: systemTime.getTimezoneOffset(),
      utcTime: new Date().toUTCString(),
    };
  }

  // 시간 정보 로깅 (디버깅용)
  logTimeInfo() {
    try {
      const timeInfo = this.getTimeDebugInfo();
      this.debug("🇰🇷 시간 정보", timeInfo);
    } catch (error) {
      console.log("[TIME_DEBUG_ERROR]", error.message);
    }
  }
}

module.exports = Logger;
