const logger = require("../utils/core/Logger");

/**
 * 🌍 Environment Configuration Manager
 * 환경변수 검증 및 관리를 담당하는 클래스
 */
class Environment {
  constructor() {
    this.requiredVars = ["BOT_TOKEN", "MONGO_URL"];

    this.optionalVars = {
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      DEFAULT_WEATHER_CITY: "서울",
      TODO_PAGE_SIZE: "10",
      TTS_CACHE_DIR: "./cache/tts",
      TTS_DEFAULT_LANGUAGE: "ko-KR",
      TTS_MAX_TEXT_LENGTH: "5000"
    };

    this.sensitiveVars = [
      "BOT_TOKEN",
      "MONGO_URL",
      "GOOGLE_PRIVATE_KEY",
      "TTS_API_KEY",
      "WEATHER_API_KEY",
      "AIR_KOREA_API_KEY"
    ];
  }

  /**
   * 🔍 환경변수 검증
   */
  validate() {
    const errors = [];
    const warnings = [];

    // 필수 환경변수 확인
    this.requiredVars.forEach((varName) => {
      if (!process.env[varName]) {
        errors.push(`Required environment variable ${varName} is missing`);
      }
    });

    // 선택적 환경변수 기본값 설정
    Object.entries(this.optionalVars).forEach(([varName, defaultValue]) => {
      if (!process.env[varName]) {
        process.env[varName] = defaultValue;
        warnings.push(
          `Environment variable ${varName} not set, using default: ${defaultValue}`
        );
      }
    });

    // 민감한 정보 로깅 방지 확인
    if (process.env.NODE_ENV === "production") {
      if (process.env.LOG_LEVEL === "debug") {
        warnings.push(
          "Debug logging is enabled in production - consider using info level"
        );
      }
    }

    // 결과 처리
    if (errors.length > 0) {
      logger.error("❌ Environment validation failed:");
      errors.forEach((error) => logger.error(`  - ${error}`));
      throw new Error("Environment validation failed");
    }

    if (warnings.length > 0) {
      logger.warn("⚠️ Environment warnings:");
      warnings.forEach((warning) => logger.warn(`  - ${warning}`));
    }

    logger.success("✅ Environment validation passed");
    return true;
  }

  /**
   * 🔒 안전한 환경변수 정보 표시 (민감 정보 마스킹)
   */
  getSafeInfo() {
    const safeEnv = {};

    Object.keys(process.env).forEach((key) => {
      if (
        this.sensitiveVars.some((sensitive) =>
          key.includes(sensitive.toUpperCase())
        )
      ) {
        // 민감한 정보는 마스킹
        const value = process.env[key];
        if (value && value.length > 4) {
          safeEnv[key] = `${value.substring(0, 4)}****`;
        } else {
          safeEnv[key] = "****";
        }
      } else if (
        key.startsWith("DOOMOCK_") ||
        key.startsWith("TODO_") ||
        key.startsWith("TIMER_")
      ) {
        // 앱 관련 환경변수만 표시
        safeEnv[key] = process.env[key];
      }
    });

    return safeEnv;
  }

  /**
   * 📊 환경변수 통계
   */
  getStats() {
    const allEnvVars = Object.keys(process.env);
    const appEnvVars = allEnvVars.filter(
      (key) =>
        key.startsWith("DOOMOCK_") ||
        key.startsWith("TODO_") ||
        key.startsWith("TIMER_") ||
        key.startsWith("TTS_") ||
        key.startsWith("WEATHER_") ||
        this.requiredVars.includes(key)
    );

    return {
      total: allEnvVars.length,
      appSpecific: appEnvVars.length,
      required: this.requiredVars.length,
      optional: Object.keys(this.optionalVars).length,
      sensitive: this.sensitiveVars.length
    };
  }

  /**
   * 🚨 보안 검사
   */
  securityCheck() {
    const issues = [];

    // 프로덕션 환경에서 개발용 설정 확인
    if (process.env.NODE_ENV === "production") {
      if (process.env.FORTUNE_DEV_MODE === "true") {
        issues.push(
          "Development mode is enabled in production (FORTUNE_DEV_MODE)"
        );
      }

      if (process.env.LOG_LEVEL === "debug") {
        issues.push("Debug logging enabled in production");
      }
    }

    // 빈 값 확인
    this.requiredVars.forEach((varName) => {
      const value = process.env[varName];
      if (
        value &&
        (value.trim() === "" || value === "undefined" || value === "null")
      ) {
        issues.push(
          `Environment variable ${varName} appears to be empty or placeholder`
        );
      }
    });

    return issues;
  }
}

// 싱글톤 인스턴스
const environmentManager = new Environment();

module.exports = environmentManager;
