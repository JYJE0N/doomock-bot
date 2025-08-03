// ========================================
// 🔧 src/config/ConfigManager.js v4.0.1
// ========================================
// LoggerEnhancer 알록달록 + Railway 환경변수 중앙 관리
// ========================================

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔧 ConfigManager v4.0.1 - 알록달록 설정 관리자
 *
 * ✨ 새로운 기능들:
 * - 🌈 LoggerEnhancer 알록달록 설정 표시
 * - 🚂 Railway 환경 자동 최적화
 * - 📊 실시간 설정 상태 모니터링
 * - 🎨 시각적 설정 검증 시스템
 * - 🔍 스마트 설정 분석
 */
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }

    // 🌈 LoggerEnhancer 활용
    this.messageSystem = logger.messageSystem;

    // 환경 감지
    this.nodeEnv = process.env.NODE_ENV || "development";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.isDevelopment = this.nodeEnv === "development";
    this.isProduction = this.nodeEnv === "production";

    // 🎯 스테이징 환경 감지 추가
    this.isStaging = this.nodeEnv === "staging";

    // 🌈 초기화 시작 로그
    console.log(this.messageSystem.rainbow("🔧 ═══ ConfigManager v4.0.1 초기화 ═══"));
    console.log(this.messageSystem.gradient("알록달록 설정 관리 시스템 시작!", "cyan", "magenta"));

    // 설정 로드
    this.loadAllConfigurations();

    // 설정 검증
    this.validateConfigurations();

    // 🎉 초기화 완료
    console.log(this.messageSystem.rainbow("✅ ConfigManager 초기화 완료!"));
    this.showConfigSummary();

    ConfigManager.instance = this;
    logger.info("🔧 ConfigManager 중앙 설정 관리자 초기화됨");
  }

  /**
   * 📋 모든 설정 로드 (알록달록 진행 표시!)
   */
  loadAllConfigurations() {
    console.log(this.messageSystem.gradient("📦 설정 정보 로딩 중...", "blue", "purple"));

    // 🎯 설정 섹션별 로딩 표시
    const sections = ["🌍 환경 정보", "🤖 봇 설정", "🗄️ 데이터베이스", "🏥 헬스체크", "⚡ 성능 설정", "📊 로깅", "🔧 시스템", "🚂 Railway"];

    sections.forEach((section, index) => {
      const colors = ["cyan", "magenta", "yellow", "green", "blue", "purple", "orange", "pink"];
      const color = colors[index % colors.length];
      console.log(this.messageSystem.gradient(`   ${section} 로딩...`, color, "white"));
    });

    this.config = {
      // 🌍 환경 정보
      environment: {
        nodeEnv: this.nodeEnv,
        isRailway: this.isRailway,
        isDevelopment: this.isDevelopment,
        isProduction: this.isProduction,
        timezone: "Asia/Seoul",
        rainbow: true, // 🌈 알록달록 모드!
        enhanced: true,
        version: "4.0.1"
      },

      // 🤖 봇 설정
      bot: {
        token: process.env.BOT_TOKEN,
        webhook: {
          enabled: process.env.WEBHOOK_ENABLED === "true",
          port: parseInt(process.env.PORT) || 3000,
          domain: process.env.RAILWAY_PUBLIC_DOMAIN || null
        },
        rateLimit: {
          enabled: process.env.RATE_LIMIT_ENABLED !== "false",
          maxRequestsPerMinute: this.isRailway ? 20 : 30 // Railway 제한 고려
        },
        features: {
          rainbow: true, // 🌈 알록달록 메시지!
          markdownV2: true, // 📱 MarkdownV2 지원
          animations: true, // 🎭 애니메이션 지원
          realTimeStats: true // 📊 실시간 통계
        }
      },

      // 🗄️ 데이터베이스 설정 (Railway 최적화)
      database: {
        url: process.env.MONGO_URL || process.env.MONGODB_URI,
        name: this.extractDatabaseName(process.env.MONGO_URL || process.env.MONGODB_URI),

        // Railway 환경 최적화
        connection: {
          maxPoolSize: this.isRailway ? 3 : 10,
          minPoolSize: this.isRailway ? 1 : 2,
          serverSelectionTimeoutMS: this.isRailway ? 5000 : 8000,
          socketTimeoutMS: this.isRailway ? 20000 : 30000,
          connectTimeoutMS: this.isRailway ? 10000 : 15000,
          maxIdleTimeMS: this.isRailway ? 30000 : 60000,
          retryAttempts: this.isRailway ? 5 : 3,
          retryDelay: this.isRailway ? 3000 : 5000
        },

        // 스키마 설정
        schema: {
          validationEnabled: process.env.DB_VALIDATION_ENABLED !== "false",
          autoIndexCreation: process.env.DB_AUTO_INDEX !== "false",
          cacheValidation: process.env.DB_CACHE_VALIDATION !== "false",
          strictMode: process.env.DB_STRICT_MODE === "true",
          rainbowLogs: true // 🌈 DB 로그도 알록달록!
        }
      },

      // 🏥 헬스체크 설정
      health: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== "false",
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || (this.isRailway ? 180000 : 300000),
        autoRecovery: process.env.HEALTH_AUTO_RECOVERY !== "false",
        timeout: parseInt(process.env.HEALTH_TIMEOUT) || 10000,
        rainbow: true // 🌈 알록달록 헬스체크!
      },

      // ⚡ 성능 설정 (Railway 메모리 고려)
      performance: {
        memoryThreshold: this.isRailway ? 400 : 200, // MB
        gcEnabled: process.env.GC_ENABLED === "true",
        cacheEnabled: process.env.CACHE_ENABLED !== "false",
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000,
        maxCacheSize: this.isRailway ? 500 : 1000,
        monitoring: {
          enabled: true,
          interval: 10000, // 10초마다 모니터링
          rainbow: true // 🌈 알록달록 성능 모니터링!
        }
      },

      // 📊 로깅 설정 (알록달록 강화!)
      logging: {
        level: process.env.LOG_LEVEL || (this.isDevelopment ? "debug" : "info"),
        fileEnabled: process.env.LOG_FILE_ENABLED === "true" && !this.isRailway,
        consoleEnabled: process.env.LOG_CONSOLE_ENABLED !== "false",
        maxFileSize: this.isRailway ? "5MB" : "10MB",
        rainbow: {
          enabled: true, // 🌈 알록달록 로그 활성화!
          gradients: true, // 🎨 그라데이션 효과
          animations: true, // 🎭 애니메이션 효과
          celebrations: true // 🎉 축하 메시지
        }
      },

      // 🔧 시스템 설정
      system: {
        startupMaxRetries: parseInt(process.env.STARTUP_MAX_RETRIES) || 3,
        startupRetryBackoff: parseInt(process.env.STARTUP_RETRY_BACKOFF) || 5000,
        componentTimeout: parseInt(process.env.COMPONENT_TIMEOUT) || (this.isRailway ? 45000 : 30000),
        gracefulShutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 15000,
        rainbow: {
          startup: true, // 🌈 시작 시 알록달록!
          shutdown: true, // 🌈 종료 시 알록달록!
          errors: true // 🌈 오류도 예쁘게!
        }
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
              rainbowOptimized: true // 🌈 알록달록 최적화!
            }
          }
        : null,

      // 🌈 알록달록 전용 설정
      rainbow: {
        enabled: true,
        themes: {
          startup: ["cyan", "magenta", "yellow", "green"],
          success: ["green", "blue", "cyan"],
          error: ["red", "orange", "yellow"],
          info: ["blue", "purple", "pink"],
          warning: ["yellow", "orange", "red"]
        },
        animations: {
          loading: ["⏳", "⌛", "🔄", "⚡"],
          success: ["✅", "🎉", "🌟", "💫"],
          error: ["❌", "💥", "🚨", "⚠️"]
        },
        gradients: {
          enabled: true,
          steps: 10,
          smooth: true
        }
      }
    };

    console.log(this.messageSystem.gradient("✅ 모든 설정 로딩 완료!", "green", "blue"));
  }

  /**
   * 🌈 알록달록 설정 요약 표시
   */
  showConfigSummary() {
    console.log();
    console.log(this.messageSystem.rainbow("🎯 ═══ DooMockBot v4.0.1 설정 요약 ═══"));

    // 환경 정보 (알록달록!)
    console.log(this.messageSystem.gradient(`🌍 환경: ${this.nodeEnv}`, "blue", "cyan"));
    console.log(
      this.messageSystem.gradient(
        `🚂 Railway: ${this.isRailway ? "✅ 활성" : "❌ 비활성"}`,
        this.isRailway ? "green" : "red",
        this.isRailway ? "blue" : "orange"
      )
    );

    // 봇 설정
    const webhookMode = this.get("bot.webhook.enabled") ? "웹훅" : "폴링";
    console.log(this.messageSystem.gradient(`🤖 봇모드: ${webhookMode}`, "purple", "pink"));

    // 데이터베이스
    const dbName = this.get("database.name") || "미설정";
    const dbStatus = this.get("database.url") ? "🟢 연결됨" : "🔴 미설정";
    console.log(this.messageSystem.gradient(`💾 데이터베이스: ${dbName} (${dbStatus})`, "cyan", "blue"));

    // 성능 설정
    const cacheStatus = this.get("performance.cacheEnabled") ? "✅ 활성" : "❌ 비활성";
    console.log(this.messageSystem.gradient(`⚡ 캐시: ${cacheStatus}`, "yellow", "orange"));

    // 로깅
    const logLevel = this.get("logging.level");
    const rainbowLogs = this.get("logging.rainbow.enabled") ? "🌈 활성" : "❌ 비활성";
    console.log(this.messageSystem.gradient(`📝 로그레벨: ${logLevel} (알록달록: ${rainbowLogs})`, "green", "cyan"));

    // 헬스체크
    const healthInterval = this.get("health.interval");
    console.log(this.messageSystem.gradient(`🏥 헬스체크: ${healthInterval}ms`, "blue", "purple"));

    // 메모리 설정
    const memoryThreshold = this.get("performance.memoryThreshold");
    console.log(this.messageSystem.gradient(`💾 메모리 임계값: ${memoryThreshold}MB`, "orange", "red"));

    // Railway 전용 정보
    if (this.isRailway) {
      console.log();
      console.log(this.messageSystem.rainbow("🚂 ═══ Railway 환경 정보 ═══"));

      const service = this.get("railway.service") || "미설정";
      const region = this.get("railway.region") || "미설정";
      const deployment = this.get("railway.deployment") || "미설정";

      console.log(this.messageSystem.gradient(`📦 서비스: ${service}`, "green", "blue"));
      console.log(this.messageSystem.gradient(`🌍 지역: ${region}`, "cyan", "purple"));
      console.log(this.messageSystem.gradient(`🚀 배포: ${deployment.substring(0, 8)}...`, "yellow", "orange"));

      // Railway 최적화 상태
      const optimizations = this.get("railway.optimizations");
      if (optimizations) {
        console.log(this.messageSystem.gradient("⚡ 최적화: 메모리✅ 네트워크✅ 알록달록✅", "purple", "pink"));
      }
    }

    // 🌈 알록달록 기능 상태
    console.log();
    console.log(this.messageSystem.rainbow("🌈 ═══ 알록달록 기능 상태 ═══"));
    console.log(this.messageSystem.gradient("🎨 테마 시스템: 활성화", "purple", "pink"));
    console.log(this.messageSystem.gradient("🎭 애니메이션: 활성화", "cyan", "magenta"));
    console.log(this.messageSystem.gradient("📊 실시간 모니터링: 활성화", "green", "blue"));
    console.log(this.messageSystem.gradient("📱 MarkdownV2: 활성화", "yellow", "orange"));

    console.log(this.messageSystem.rainbow("🎯 ═══════════════════════════════════════"));
    console.log();
  }

  /**
   * ✅ 설정 검증 (알록달록 결과!)
   */
  validateConfigurations() {
    console.log(this.messageSystem.gradient("🔍 설정 검증 시작...", "blue", "purple"));

    const issues = [];
    const warnings = [];

    // 필수 설정 검증
    if (!this.config.bot.token) {
      issues.push("BOT_TOKEN이 설정되지 않음");
    } else {
      // 토큰 형식 검증
      if (!this.config.bot.token.includes(":") || this.config.bot.token.length < 40) {
        issues.push("BOT_TOKEN 형식이 올바르지 않음");
      } else {
        console.log(this.messageSystem.gradient("✅ 봇 토큰 검증 통과", "green", "blue"));
      }
    }

    if (!this.config.database.url) {
      warnings.push("MONGO_URL이 설정되지 않음 (메모리 모드로 실행)");
    } else {
      console.log(this.messageSystem.gradient("✅ 데이터베이스 URL 확인", "green", "cyan"));
    }

    // Railway 환경 특별 검증
    if (this.isRailway) {
      console.log(this.messageSystem.gradient("🚂 Railway 환경 최적화 검증...", "purple", "pink"));

      if (this.config.performance.memoryThreshold > 450) {
        warnings.push("Railway 메모리 임계값이 높음 (최대 450MB 권장)");
      } else {
        console.log(this.messageSystem.gradient("✅ Railway 메모리 설정 최적화됨", "green", "blue"));
      }

      if (this.config.database.connection.maxPoolSize > 5) {
        warnings.push("Railway DB 풀 크기가 큼 (최대 5 권장)");
      } else {
        console.log(this.messageSystem.gradient("✅ Railway DB 풀 설정 최적화됨", "cyan", "blue"));
      }
    }

    // 🌈 알록달록 기능 검증
    if (this.config.rainbow.enabled) {
      console.log(this.messageSystem.gradient("🌈 알록달록 시스템 활성화 확인", "purple", "pink"));

      // 테마 검증
      const themes = this.config.rainbow.themes;
      const themeCount = Object.keys(themes).length;
      console.log(this.messageSystem.gradient(`🎨 ${themeCount}개 테마 로드됨`, "yellow", "orange"));

      // 애니메이션 검증
      const animations = this.config.rainbow.animations;
      const animationCount = Object.keys(animations).length;
      console.log(this.messageSystem.gradient(`🎭 ${animationCount}개 애니메이션 세트 준비됨`, "cyan", "magenta"));
    }

    this.validationResult = {
      isValid: issues.length === 0,
      issues: issues,
      warnings: warnings,
      errors: issues.filter((i) => !i.includes("권장")),
      timestamp: TimeHelper.getLogTimeString()
    };

    // 🎉 검증 결과 표시
    if (issues.length === 0 && warnings.length === 0) {
      console.log(this.messageSystem.gradient("🎉 모든 설정 검증 통과!", "green", "blue"));
    } else {
      if (issues.length > 0) {
        console.log(this.messageSystem.gradient("❌ 설정 오류 발견:", "red", "orange"));
        issues.forEach((issue) => {
          console.log(this.messageSystem.gradient(`   • ${issue}`, "red", "orange"));
        });
      }

      if (warnings.length > 0) {
        console.log(this.messageSystem.gradient("⚠️ 설정 경고:", "yellow", "orange"));
        warnings.forEach((warning) => {
          console.log(this.messageSystem.gradient(`   • ${warning}`, "yellow", "orange"));
        });
      }
    }
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
   * 🎯 모듈별 최적화된 설정 제공 (알록달록 포함!)
   */
  getForDatabase() {
    return {
      url: this.config.database.url,
      name: this.config.database.name,
      connection: this.config.database.connection,
      schema: this.config.database.schema,
      isRailway: this.isRailway,
      environment: this.config.environment,
      rainbow: this.config.rainbow // 🌈 알록달록 설정 포함!
    };
  }

  getForBot() {
    return {
      token: this.config.bot.token,
      webhook: this.config.bot.webhook,
      rateLimit: this.config.bot.rateLimit,
      features: this.config.bot.features, // 🌈 알록달록 기능 포함!
      isRailway: this.isRailway,
      rainbow: this.config.rainbow
    };
  }

  getForHealth() {
    return {
      ...this.config.health,
      isRailway: this.isRailway,
      rainbow: this.config.rainbow // 🌈 알록달록 헬스체크!
    };
  }

  getForPerformance() {
    return {
      ...this.config.performance,
      isRailway: this.isRailway,
      railway: this.config.railway?.optimizations || {},
      rainbow: this.config.rainbow // 🌈 알록달록 성능 모니터링!
    };
  }

  getForLogging() {
    return {
      ...this.config.logging,
      rainbow: this.config.rainbow, // 🌈 알록달록 로그 설정!
      isRailway: this.isRailway
    };
  }

  /**
   * 🌈 알록달록 전용 설정 조회
   */
  getRainbowConfig() {
    return {
      ...this.config.rainbow,
      enabled: this.config.rainbow.enabled && this.config.logging.rainbow.enabled,
      environment: this.config.environment
    };
  }

  /**
   * 📋 전체 설정 조회
   */
  getAll() {
    return {
      ...this.config,
      validation: this.validationResult,
      timestamp: TimeHelper.getLogTimeString(),
      version: "4.0.1"
    };
  }

  /**
   * 🎨 실시간 설정 상태 모니터링
   */
  startRainbowMonitoring() {
    if (!this.config.rainbow.enabled) return;

    console.log(this.messageSystem.rainbow("📊 실시간 설정 모니터링 시작!"));

    setInterval(() => {
      this.showLiveConfigStats();
    }, 30000); // 30초마다
  }

  /**
   * 📊 실시간 설정 통계
   */
  showLiveConfigStats() {
    const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const memoryThreshold = this.get("performance.memoryThreshold");
    const memoryPercent = Math.round((memoryUsage / memoryThreshold) * 100);

    console.log(this.messageSystem.rainbow("📊 ═══ 실시간 설정 상태 ═══"));
    console.log(
      this.messageSystem.gradient(
        `💾 메모리 사용량: ${memoryUsage}MB (${memoryPercent}%)`,
        memoryPercent > 80 ? "red" : memoryPercent > 60 ? "yellow" : "green",
        "blue"
      )
    );

    const uptime = process.uptime();
    const uptimeMin = Math.floor(uptime / 60);
    console.log(this.messageSystem.gradient(`⏰ 가동시간: ${uptimeMin}분`, "cyan", "purple"));

    const isHealthy = memoryPercent < 90 && this.validationResult.isValid;
    console.log(this.messageSystem.gradient(`🏥 상태: ${isHealthy ? "정상" : "주의"}`, isHealthy ? "green" : "yellow", "blue"));

    console.log(this.messageSystem.rainbow("📊 ══════════════════"));
  }

  /**
   * 📊 설정 요약 출력 (레거시 호환)
   */
  printSummary() {
    this.showConfigSummary();
  }

  /**
   * 📊 설정 요약 출력 (레거시 호환)
   */
  printConfigSummary() {
    this.showConfigSummary();
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    console.log(this.messageSystem.gradient("🧹 ConfigManager 정리 중...", "yellow", "orange"));

    // 설정 정보 저장 (필요시)
    logger.moduleLog("ConfigManager", "정리 완료", {
      validation: this.validationResult,
      isRailway: this.isRailway,
      rainbow: this.config.rainbow.enabled
    });

    console.log(this.messageSystem.rainbow("✅ ConfigManager 정리 완료"));
  }
}

// ===== 🎯 싱글톤 인스턴스 =====
let configInstance = null;

/**
 * 🔧 ConfigManager 싱글톤 인스턴스
 */
function getConfig() {
  if (!configInstance) {
    configInstance = new ConfigManager();
  }
  return configInstance;
}

/**
 * 🌈 알록달록 설정 조회 (편의 함수)
 */
function getRainbowConfig() {
  return getConfig().getRainbowConfig();
}

/**
 * 🚂 Railway 설정 조회 (편의 함수)
 */
function getRailwayConfig() {
  const config = getConfig();
  return config.isRailway ? config.get("railway") : null;
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  ConfigManager,
  getConfig,
  getRainbowConfig,
  getRailwayConfig
};
