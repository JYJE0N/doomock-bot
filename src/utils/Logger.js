// src/utils/Logger.js - 무한 재귀 완전 방지 + 안전한 싱글톤

// 🚨 최우선: 순환참조 방지를 위한 전역 플래그
if (global._LOGGER_INITIALIZING) {
  console.warn("⚠️ Logger 초기화 중 재귀 호출 감지, 임시 Logger 반환");
  module.exports = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
    success: (...args) => console.log("[SUCCESS]", ...args),
    trace: (...args) => console.log("[TRACE]", ...args),
    setLevel: () => {},
    logTimeInfo: () => console.log("[INFO] 시간 정보 로딩 중..."),
    getStatus: () => ({ emergency: true }),
  };
  return;
}

global._LOGGER_INITIALIZING = true;

class Logger {
  constructor() {
    // ✅ 중복 초기화 완전 차단
    if (Logger._instance) {
      global._LOGGER_INITIALIZING = false;
      return Logger._instance;
    }

    // ✅ 초기화 상태 추적
    this._isInitializing = true;
    this._isFullyInitialized = false;

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

    // 🚨 무한 재귀 방지 시스템 (극도로 보수적)
    this._loggingInProgress = false;
    this._recursionDepth = 0;
    this._maxRecursionDepth = 2; // 매우 엄격하게
    this._emergencyMode = false;
    this._callStack = new Set(); // 호출 스택 추적

    // 🇰🇷 한국 시간 캐시 (에러 방지)
    this._lastTimestampCheck = 0;
    this._cachedTimestamp = null;
    this._timestampCacheMs = 1000;

    // 🔒 민감정보 패턴 (간단하게)
    this._sensitivePatterns = [
      {
        pattern: /\b\d+:[A-Za-z0-9_-]{35}\b/g,
        replacement: (match) => `${match.slice(0, 8)}***[BOT_TOKEN]`,
      },
      {
        pattern: /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^/]+)/g,
        replacement: "mongodb://***:***@[HIDDEN_HOST]",
      },
    ];

    this._sensitiveKeys = [
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

    // ✅ 싱글톤 저장
    Logger._instance = this;
    this._isInitializing = false;
    this._isFullyInitialized = true;

    global._LOGGER_INITIALIZING = false;
  }

  // ✅ 완전 안전한 로깅 메서드 (재귀 불가능)
  _safeLog(level, ...args) {
    // 🚨 응급 모드면 바로 console 사용
    if (this._emergencyMode) {
      console.log(`[${level.toUpperCase()}-EMERGENCY]`, ...args);
      return;
    }

    // 🚨 초기화 중이면 console로 직접
    if (this._isInitializing || !this._isFullyInitialized) {
      console.log(`[${level.toUpperCase()}-INIT]`, ...args);
      return;
    }

    // 🚨 로깅 중복 체크 (가장 중요!)
    if (this._loggingInProgress) {
      console.log(`[${level.toUpperCase()}-RECURSIVE]`, ...args);
      return;
    }

    // 🚨 재귀 깊이 체크
    this._recursionDepth++;
    if (this._recursionDepth > this._maxRecursionDepth) {
      this._emergencyMode = true;
      console.error("🚨 Logger 재귀 깊이 초과, 응급 모드 활성화");
      console.log(`[${level.toUpperCase()}-DEPTH_EXCEEDED]`, ...args);
      return;
    }

    // 🚨 호출 스택 체크
    const callKey = level + JSON.stringify(args).slice(0, 50);
    if (this._callStack.has(callKey)) {
      console.log(`[${level.toUpperCase()}-STACK_LOOP]`, ...args);
      this._recursionDepth = Math.max(0, this._recursionDepth - 1);
      return;
    }

    try {
      this._loggingInProgress = true;
      this._callStack.add(callKey);

      this._actualLog(level, ...args);
    } catch (error) {
      // 절대 Logger를 호출하지 않음!
      console.error("🚨 Logger 내부 오류:", error.message);
      console.log(`[${level.toUpperCase()}-FALLBACK]`, ...args);
    } finally {
      this._loggingInProgress = false;
      this._callStack.delete(callKey);
      this._recursionDepth = Math.max(0, this._recursionDepth - 1);
    }
  }

  // ✅ 실제 로깅 로직 (재귀 없음)
  _actualLog(level, ...args) {
    if (this.logLevels[level] > this.currentLevel) {
      return;
    }

    const timestamp = this._getTimestampSafe();
    const emoji = this.emojis[level] || "📝";

    // 메시지 처리 (안전하게)
    const processedArgs = args.map((arg) => {
      try {
        if (typeof arg === "string") {
          return this._maskSensitiveDataSafe(arg);
        } else if (typeof arg === "object" && arg !== null) {
          return this._maskObjectSafe(arg);
        }
        return arg;
      } catch (error) {
        return "[PROCESSING_ERROR]";
      }
    });

    const message = `${emoji} [${timestamp}] ${processedArgs.join(" ")}`;

    // Console 출력 (절대 Logger 재호출 없음)
    try {
      switch (level) {
        case "error":
          console.error(message);
          break;
        case "warn":
          console.warn(message);
          break;
        case "debug":
          console.debug(message);
          break;
        default:
          console.log(message);
      }
    } catch (consoleError) {
      // console 에러도 발생할 수 있음
      process.stdout.write(`${message}\n`);
    }
  }

  // ✅ 안전한 타임스탬프 (에러 방지)
  _getTimestampSafe() {
    try {
      const now = Date.now();

      if (
        now - this._lastTimestampCheck < this._timestampCacheMs &&
        this._cachedTimestamp
      ) {
        return this._cachedTimestamp;
      }

      const koreanTime = new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      this._cachedTimestamp = koreanTime;
      this._lastTimestampCheck = now;

      return koreanTime;
    } catch (error) {
      // 타임스탬프 실패시 간단한 대안
      return new Date().toISOString().slice(11, 19);
    }
  }

  // 🔒 안전한 민감정보 마스킹
  _maskSensitiveDataSafe(message) {
    if (typeof message !== "string") {
      return "[NON_STRING]";
    }

    try {
      let masked = message;

      for (const { pattern, replacement } of this._sensitivePatterns) {
        masked = masked.replace(pattern, replacement);
      }

      return masked;
    } catch (error) {
      return message; // 마스킹 실패시 원본 반환
    }
  }

  // 🔒 안전한 객체 마스킹 (깊이 제한)
  _maskObjectSafe(obj, depth = 0) {
    // 깊이 제한 (매우 보수적)
    if (depth > 2) {
      return "[MAX_DEPTH]";
    }

    try {
      if (!obj || typeof obj !== "object") {
        return obj;
      }

      // 특수 객체 처리
      if (obj instanceof Date) {
        return obj.toISOString();
      }
      if (obj instanceof Error) {
        return {
          name: obj.name,
          message: obj.message,
          code: obj.code,
        };
      }
      if (obj instanceof RegExp) {
        return obj.toString();
      }

      // 배열 처리
      if (Array.isArray(obj)) {
        return obj
          .slice(0, 5)
          .map((item) => this._maskObjectSafe(item, depth + 1));
      }

      // 일반 객체 처리
      const masked = {};
      const keys = Object.keys(obj).slice(0, 10); // 최대 10개 키만

      for (const key of keys) {
        try {
          const isKeyMatch = this._sensitiveKeys.some((sensitiveKey) =>
            key.toLowerCase().includes(sensitiveKey.toLowerCase())
          );

          if (isKeyMatch) {
            masked[key] = "[MASKED]";
          } else {
            const value = obj[key];
            if (typeof value === "string") {
              masked[key] = this._maskSensitiveDataSafe(value);
            } else if (typeof value === "object" && value !== null) {
              masked[key] = this._maskObjectSafe(value, depth + 1);
            } else {
              masked[key] = value;
            }
          }
        } catch (keyError) {
          masked[key] = "[KEY_ERROR]";
        }
      }

      return masked;
    } catch (error) {
      return "[MASKING_ERROR]";
    }
  }

  // ✅ 공개 로깅 메서드들 (절대 재귀 없음)
  error(...args) {
    this._safeLog("error", ...args);
  }

  warn(...args) {
    this._safeLog("warn", ...args);
  }

  info(...args) {
    this._safeLog("info", ...args);
  }

  debug(...args) {
    this._safeLog("debug", ...args);
  }

  trace(...args) {
    this._safeLog("trace", ...args);
  }

  success(...args) {
    this._safeLog("success", ...args);
  }

  // ✅ 로그 레벨 설정 (안전)
  setLevel(level) {
    try {
      if (this.logLevels.hasOwnProperty(level)) {
        this.currentLevel = this.logLevels[level];
        console.log(`[INFO] 로그 레벨이 ${level}로 설정됨`);
      } else {
        console.warn(`[WARN] 잘못된 로그 레벨: ${level}`);
      }
    } catch (error) {
      console.error("[ERROR] 로그 레벨 설정 실패:", error.message);
    }
  }

  // ✅ 시간 정보 로깅 (안전)
  logTimeInfo() {
    try {
      const now = new Date();
      const utc = now.toISOString();
      const korean = this._getTimestampSafe();

      console.log(`[INFO] ⏰ 시간 정보 - UTC: ${utc}, 한국: ${korean}`);
    } catch (error) {
      console.log("[INFO] ⏰ 시간 정보 로딩 중 오류 발생");
    }
  }

  // ✅ 상태 확인 (안전)
  getStatus() {
    try {
      return {
        isInitialized: this._isFullyInitialized,
        emergencyMode: this._emergencyMode,
        recursionDepth: this._recursionDepth,
        currentLevel:
          Object.keys(this.logLevels)[this.currentLevel] || "unknown",
      };
    } catch (error) {
      return { error: true, emergency: true };
    }
  }
}

// ✅ 안전한 싱글톤 인스턴스 생성
let loggerInstance;

try {
  loggerInstance = new Logger();
} catch (error) {
  // Logger 생성 실패시 폴백
  console.error("🚨 Logger 생성 실패, 폴백 사용:", error.message);
  loggerInstance = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
    success: (...args) => console.log("[SUCCESS]", ...args),
    trace: (...args) => console.log("[TRACE]", ...args),
    setLevel: () => {},
    logTimeInfo: () => console.log("[INFO] 시간 정보 로딩 중..."),
    getStatus: () => ({ fallback: true }),
  };
}

// ✅ 정적 메서드도 안전하게
// try {
//   Logger.info = (...args) => loggerInstance.info(...args);
//   Logger.error = (...args) => loggerInstance.error(...args);
//   Logger.warn = (...args) => loggerInstance.warn(...args);
//   Logger.debug = (...args) => loggerInstance.debug(...args);
//   Logger.trace = (...args) => loggerInstance.trace(...args);
//   Logger.success = (...args) => loggerInstance.success(...args);
//   Logger.setLevel = (level) => loggerInstance.setLevel(level);
//   Logger.logTimeInfo = () => loggerInstance.logTimeInfo();
//   Logger.getStatus = () => loggerInstance.getStatus();
// } catch (error) {
//   console.error("🚨 Logger 정적 메서드 설정 실패:", error.message);
// }

module.exports = loggerInstance;
