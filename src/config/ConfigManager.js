// ===== 1. src/config/ConfigManager.js - Railway 환경변수 중앙 관리 =====
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔧 ConfigManager v3.0.1 - 모든 환경설정 중앙 관리
 *
 * 🎯 역할:
 * 1. Railway/로컬 환경변수 통합 관리
 * 2. 환경별 최적화 설정 제공
 * 3. 설정 검증 및 기본값 보장
 * 4. 다른 클래스들에게 설정만 제공 (의존성 최소화)
 */
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }

    // 환경 감지
    this.nodeEnv = process.env.NODE_ENV || "development";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.isDevelopment = this.nodeEnv === "development";
    this.isProduction = this.nodeEnv === "production";

    // 설정 로드
    this.loadAllConfigurations();

    // 설정 검증
    this.validateConfigurations();

    ConfigManager.instance = this;
    logger.info("🔧 ConfigManager 중앙 설정 관리자 초기화됨");
  }

  /**
   * 📋 모든 설정 로드 (환경별 최적화)
   */
  loadAllConfigurations() {
    this.config = {
      // 🌍 환경 정보
      environment: {
        nodeEnv: this.nodeEnv,
        isRailway: this.isRailway,
        isDevelopment: this.isDevelopment,
        isProduction: this.isProduction,
        timezone: "Asia/Seoul",
      },

      // 🤖 봇 설정
      bot: {
        token: process.env.BOT_TOKEN,
        webhook: {
          enabled: process.env.WEBHOOK_ENABLED === "true",
          port: parseInt(process.env.PORT) || 3000,
          domain: process.env.RAILWAY_PUBLIC_DOMAIN || null,
        },
        rateLimit: {
          enabled: process.env.RATE_LIMIT_ENABLED !== "false",
          maxRequestsPerMinute: this.isRailway ? 20 : 30, // Railway 제한 고려
        },
      },

      // 🗄️ 데이터베이스 설정 (Railway 최적화)
      database: {
        url: process.env.MONGO_URL,
        name: this.extractDatabaseName(process.env.MONGO_URL),

        // Railway 환경 최적화
        connection: {
          maxPoolSize: this.isRailway ? 3 : 10,
          minPoolSize: this.isRailway ? 1 : 2,
          serverSelectionTimeoutMS: this.isRailway ? 5000 : 8000,
          socketTimeoutMS: this.isRailway ? 20000 : 30000,
          connectTimeoutMS: this.isRailway ? 10000 : 15000,
          maxIdleTimeMS: this.isRailway ? 30000 : 60000,
          retryAttempts: this.isRailway ? 5 : 3,
          retryDelay: this.isRailway ? 3000 : 5000,
        },

        // 스키마 설정
        schema: {
          validationEnabled: process.env.DB_VALIDATION_ENABLED !== "false",
          autoIndexCreation: process.env.DB_AUTO_INDEX !== "false",
          cacheValidation: process.env.DB_CACHE_VALIDATION !== "false",
          strictMode: process.env.DB_STRICT_MODE === "true",
        },
      },

      // 🏥 헬스체크 설정
      health: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== "false",
        interval:
          parseInt(process.env.HEALTH_CHECK_INTERVAL) ||
          (this.isRailway ? 180000 : 300000),
        autoRecovery: process.env.HEALTH_AUTO_RECOVERY !== "false",
        timeout: parseInt(process.env.HEALTH_TIMEOUT) || 10000,
      },

      // ⚡ 성능 설정 (Railway 메모리 고려)
      performance: {
        memoryThreshold: this.isRailway ? 400 : 200, // MB
        gcEnabled: process.env.GC_ENABLED === "true",
        cacheEnabled: process.env.CACHE_ENABLED !== "false",
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000,
        maxCacheSize: this.isRailway ? 500 : 1000,
      },

      // 📊 로깅 설정
      logging: {
        level: process.env.LOG_LEVEL || (this.isDevelopment ? "debug" : "info"),
        fileEnabled: process.env.LOG_FILE_ENABLED === "true" && !this.isRailway,
        consoleEnabled: process.env.LOG_CONSOLE_ENABLED !== "false",
        maxFileSize: this.isRailway ? "5MB" : "10MB",
      },

      // 🔧 시스템 설정
      system: {
        startupMaxRetries: parseInt(process.env.STARTUP_MAX_RETRIES) || 3,
        startupRetryBackoff:
          parseInt(process.env.STARTUP_RETRY_BACKOFF) || 5000,
        componentTimeout:
          parseInt(process.env.COMPONENT_TIMEOUT) ||
          (this.isRailway ? 45000 : 30000),
        gracefulShutdownTimeout:
          parseInt(process.env.SHUTDOWN_TIMEOUT) || 15000,
      },

      // 🚂 Railway 전용 설정
      railway: this.isRailway
        ? {
            service: process.env.RAILWAY_SERVICE_NAME,
            environment: process.env.RAILWAY_ENVIRONMENT,
            deployment: process.env.RAILWAY_DEPLOYMENT_ID,
            region: process.env.RAILWAY_REGION,
            publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,

            // Railway 최적화 플래그들
            optimizations: {
              memoryOptimized: true,
              networkOptimized: true,
              fastShutdown: true,
              compressionEnabled: true,
            },
          }
        : null,
    };
  }

  /**
   * 설정 요약 출력 메서드
   */
  printConfigSummary() {
    console.log("\n🎯 ===== DooMockBot v3.0.1 설정 요약 =====");
    console.log(`🌍 환경: ${this.nodeEnv}`);
    console.log(`🚂 Railway: ${this.isRailway ? "✅ 활성" : "❌ 비활성"}`);
    console.log(
      `🤖 봇모드: ${this.get("bot.webhook.enabled") ? "웹훅" : "폴링"}`
    );
    console.log(`💾 데이터베이스: ${this.get("database.name")}`);
    console.log(
      `⚡ 캐시: ${this.get("cache.enabled") ? "✅ 활성" : "❌ 비활성"}`
    );
    console.log(`📝 로그레벨: ${this.get("logging.level")}`);
    console.log(
      `🎤 TTS: ${this.get("apis.tts.enabled") ? "✅ 활성" : "❌ 비활성"}`
    );
    console.log(
      `🛡️ 보안: ${
        this.get("security.rateLimitEnabled") ? "✅ 활성" : "❌ 비활성"
      }`
    );
    console.log(
      `🏥 헬스체크: ${this.get("performance.healthCheckInterval")}ms`
    );
    console.log(
      `💾 메모리 임계값: ${this.get("performance.memoryThreshold")}MB`
    );

    if (this.isRailway) {
      console.log(
        `🚂 Railway 서비스: ${this.get("railway.service") || "미설정"}`
      );
      console.log(`🌍 Railway 지역: ${this.get("railway.region") || "미설정"}`);
    }

    console.log("=======================================\n");
  }

  /**
   * 🔍 MongoDB URL에서 DB 이름 추출
   */
  extractDatabaseName(mongoUrl) {
    if (!mongoUrl) return "doomock_bot";

    try {
      const url = new URL(mongoUrl);
      const match = url.pathname.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : "doomock_bot";
    } catch (error) {
      return "doomock_bot";
    }
  }

  /**
   * ✅ 설정 검증
   */
  validateConfigurations() {
    const issues = [];

    // 필수 설정 검증
    if (!this.config.bot.token) {
      issues.push("BOT_TOKEN이 설정되지 않음");
    }

    if (!this.config.database.url) {
      issues.push("MONGO_URL이 설정되지 않음 (DB 없이 실행됨)");
    }

    // Railway 환경 특별 검증
    if (this.isRailway) {
      if (this.config.performance.memoryThreshold > 450) {
        issues.push("Railway 메모리 임계값이 너무 높음 (최대 450MB 권장)");
      }

      if (this.config.database.connection.maxPoolSize > 5) {
        issues.push("Railway DB 풀 크기가 너무 큼 (최대 5 권장)");
      }
    }

    this.validationResult = {
      isValid: issues.length === 0,
      issues: issues,
      warnings: issues.filter((i) => i.includes("권장")),
      errors: issues.filter((i) => !i.includes("권장")),
    };

    if (issues.length > 0) {
      logger.warn("⚠️ 설정 검증 이슈:");
      issues.forEach((issue) => logger.warn(`   - ${issue}`));
    }
  }

  /**
   * 📊 특정 설정 조회 (점 표기법 지원)
   */
  get(path, defaultValue = null) {
    const keys = path.split(".");
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * 🎯 모듈별 최적화된 설정 제공
   */
  getForDatabase() {
    return {
      url: this.config.database.url,
      name: this.config.database.name,
      connection: this.config.database.connection,
      schema: this.config.database.schema,
      isRailway: this.isRailway,
      environment: this.config.environment,
    };
  }

  getForBot() {
    return {
      token: this.config.bot.token,
      webhook: this.config.bot.webhook,
      rateLimit: this.config.bot.rateLimit,
      isRailway: this.isRailway,
    };
  }

  getForHealth() {
    return {
      ...this.config.health,
      isRailway: this.isRailway,
    };
  }

  getForPerformance() {
    return {
      ...this.config.performance,
      isRailway: this.isRailway,
      railway: this.config.railway?.optimizations || {},
    };
  }

  /**
   * 📋 전체 설정 조회
   */
  getAll() {
    return {
      ...this.config,
      validation: this.validationResult,
    };
  }

  /**
   * 📊 설정 요약 출력
   */
  printSummary() {
    logger.info("📊 AppConfig 설정 요약:");
    logger.info(`   🌍 환경: ${this.nodeEnv}`);
    logger.info(`   🚂 Railway: ${this.isRailway ? "활성" : "비활성"}`);
    logger.info(`   🗄️ 데이터베이스: ${this.config.database.name}`);
    logger.info(
      `   🏥 헬스체크: ${this.config.health.enabled ? "활성" : "비활성"}`
    );
    logger.info(`   📊 로그 레벨: ${this.config.logging.level}`);

    if (this.isRailway) {
      logger.info("🚂 Railway 최적화:");
      logger.info(
        `   메모리 임계값: ${this.config.performance.memoryThreshold}MB`
      );
      logger.info(
        `   DB 풀 크기: ${this.config.database.connection.maxPoolSize}`
      );
      logger.info(
        `   연결 타임아웃: ${this.config.database.connection.connectTimeoutMS}ms`
      );
    }

    if (!this.validationResult.isValid) {
      logger.warn(
        "⚠️ 설정 문제 발견:",
        this.validationResult.issues.length + "개"
      );
    }
  }
}

// 싱글톤 인스턴스
let configInstance = null;

function getConfig() {
  if (!configInstance) {
    configInstance = new ConfigManager();
  }
  return configInstance;
}

module.exports = { ConfigManager, getConfig };
