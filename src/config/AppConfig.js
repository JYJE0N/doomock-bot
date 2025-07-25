// src/config/AppConfig.js - Export 방식 수정 (보안 강화 버전)

require("dotenv").config();

class AppConfig {
  constructor() {
    this.loadConfiguration();
    this.validateConfiguration();
  }

  loadConfiguration() {
    // 🤖 봇 설정
    this.BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.BOT_USERNAME = process.env.BOT_USERNAME || "doomock-bot";

    // 🌍 환경 설정
    this.NODE_ENV = process.env.NODE_ENV || "development";
    this.PORT = parseInt(process.env.PORT) || 3000;
    this.VERSION =
      process.env.npm_package_version || this.getPackageVersion() || "3.0.1";

    // 💾 데이터베이스 설정
    this.MONGO_URL = this.getMONGO_URL();
    this.DB_NAME = process.env.DB_NAME || "doomock85";

    // 🌤️ 외부 API 설정
    this.WEATHER_API_KEY = process.env.WEATHER_API_KEY;
    this.AIR_KOREA_API_KEY = process.env.AIR_KOREA_API_KEY;

    // 🔐 보안 설정
    this.ADMIN_USER_IDS = this.parseAdminUsers();
    this.ALLOWED_USER_IDS = this.parseAllowedUsers();

    // ⚡ 성능 설정
    this.RATE_LIMIT_WINDOW_MS =
      parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
    this.RATE_LIMIT_MAX_REQUESTS =
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;
    this.CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 600000;

    // 📁 파일 시스템 설정
    this.TEMP_DIR = process.env.TEMP_DIR || "./temp";
    this.LOGS_DIR = process.env.LOGS_DIR || "./logs";

    // 🔧 기능 토글
    this.FEATURES = {
      TODO_MODULE: this.parseBoolean(process.env.ENABLE_TODO_MODULE, true),
      LEAVE_MODULE: this.parseBoolean(process.env.ENABLE_LEAVE_MODULE, true),
      WEATHER_MODULE: this.parseBoolean(
        process.env.ENABLE_WEATHER_MODULE,
        true
      ),
      FORTUNE_MODULE: this.parseBoolean(
        process.env.ENABLE_FORTUNE_MODULE,
        true
      ),
      TIMER_MODULE: this.parseBoolean(process.env.ENABLE_TIMER_MODULE, true),
      INSIGHT_MODULE: this.parseBoolean(
        process.env.ENABLE_INSIGHT_MODULE,
        false
      ),
      REMINDER_MODULE: this.parseBoolean(
        process.env.ENABLE_REMINDER_MODULE,
        true
      ),
      WORKTIME_MODULE: this.parseBoolean(
        process.env.ENABLE_WORKTIME_MODULE,
        true
      ),
      UTILS_MODULE: this.parseBoolean(process.env.ENABLE_UTILS_MODULE, true),
    };

    // 🌍 지역 설정
    this.DONGTAN = {
      DEFAULT_CITY: process.env.DEFAULT_CITY || "화성시",
      WEATHER_STATION: process.env.WEATHER_STATION || "수원",
      AIR_STATION: process.env.AIR_STATION || "동탄2동",
    };

    // 📝 로깅 설정
    this.LOGGING = {
      LEVEL: process.env.LOG_LEVEL || "info",
      FILE_ENABLED: this.parseBoolean(process.env.LOG_FILE_ENABLED, false),
      CONSOLE_ENABLED: this.parseBoolean(process.env.LOG_CONSOLE_ENABLED, true),
      MAX_FILES: parseInt(process.env.LOG_MAX_FILES) || 7,
      MAX_SIZE: process.env.LOG_MAX_SIZE || "10m",
    };

    // 🌐 Railway 설정
    this.RAILWAY = {
      DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
      PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
      SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
      ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT_NAME,
      PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
      GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
      GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH,
    };

    // 🎯 파생 설정
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
    this.isProduction = this.NODE_ENV === "production";
    this.isWebhookMode = this.parseBoolean(process.env.WEBHOOK_MODE, false);

    // 🗂️ 내부 설정 구조화
    this.botToken = this.BOT_TOKEN;
    this.database = {
      uri: this.MONGO_URL,
      name: this.DB_NAME,
    };
  }

  validateConfiguration() {
    const requiredVars = ["BOT_TOKEN"];
    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(
        `필수 환경변수가 설정되지 않았습니다: ${missing.join(", ")}`
      );
    }
  }

  getPackageVersion() {
    try {
      const packageJson = require("../../package.json");
      return packageJson.version;
    } catch (error) {
      return null;
    }
  }

  getMONGO_URL() {
    return (
      process.env.MONGO_URL ||
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/doomock85"
    );
  }

  parseAdminUsers() {
    const adminStr =
      process.env.ADMIN_USER_IDS || process.env.ADMIN_USERS || "";
    return adminStr
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  parseAllowedUsers() {
    const allowedStr =
      process.env.ALLOWED_USER_IDS || process.env.ALLOWED_USERS || "";
    if (!allowedStr.trim()) {
      return []; // 빈 배열 = 모든 사용자 허용
    }
    return allowedStr
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === "boolean") {
      return value;
    }
    const str = value.toString().toLowerCase().trim();
    return ["true", "1", "yes", "on", "enabled"].includes(str);
  }

  // ✅ getConfig 메서드 추가 (호환성을 위해)
  getConfig() {
    return {
      // 기본 설정
      botToken: this.BOT_TOKEN,
      botUsername: this.BOT_USERNAME,
      version: this.VERSION,
      environment: this.NODE_ENV,
      port: this.PORT,
      isRailway: this.isRailway,
      isProduction: this.isProduction,
      isWebhookMode: this.isWebhookMode,

      // 데이터베이스
      database: {
        uri: this.MONGO_URL,
        name: this.DB_NAME,
      },

      // 외부 API
      apis: {
        weather: this.WEATHER_API_KEY,
        airKorea: this.AIR_KOREA_API_KEY,
      },

      // 보안
      security: {
        adminUsers: this.ADMIN_USER_IDS,
        allowedUsers: this.ALLOWED_USER_IDS,
        rateLimit: {
          window: this.RATE_LIMIT_WINDOW_MS,
          max: this.RATE_LIMIT_MAX_REQUESTS,
        },
      },

      // 기능
      features: this.FEATURES,

      // 지역
      location: this.DONGTAN,

      // 로깅
      logging: this.LOGGING,

      // Railway
      railway: this.RAILWAY,

      // 성능
      performance: {
        cacheTimeout: this.CACHE_TTL_MS,
      },

      // 파일
      paths: {
        temp: this.TEMP_DIR,
        logs: this.LOGS_DIR,
      },
    };
  }

  // 🔒 보안 설정 상태 (민감정보 제외)
  getSecurityStatus() {
    return {
      BOT_TOKEN: this.BOT_TOKEN ? "SET" : "NOT_SET",
      MONGO_URL: this.MONGO_URL ? "SET" : "NOT_SET",
      WEATHER_API_KEY: this.WEATHER_API_KEY ? "SET" : "NOT_SET",
      AIR_KOREA_API_KEY: this.AIR_KOREA_API_KEY ? "SET" : "NOT_SET",

      ADMIN_USER_COUNT: this.ADMIN_USER_IDS.length,
      ALLOWED_USER_COUNT: this.ALLOWED_USER_IDS.length || "ALL",

      FEATURES_ENABLED: Object.entries(this.FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature)
        .join(", "),

      RAILWAY: this.isRailway ? "YES" : "NO",
      WEBHOOK_MODE: this.isWebhookMode ? "YES" : "NO",
      DEFAULT_CITY: this.DONGTAN.DEFAULT_CITY,
      LOG_LEVEL: this.LOGGING.LEVEL,
    };
  }

  // 🔒 완전히 안전한 디버그 설정 (민감정보 완전 제거)
  getDebugConfig() {
    return {
      environment: this.NODE_ENV,
      version: this.VERSION,
      port: this.PORT,
      railway: this.isRailway,
      features: Object.keys(this.FEATURES).filter((key) => this.FEATURES[key]),

      // 🔒 모든 민감정보는 [HIDDEN]으로 표시
      credentials: {
        botToken: this.BOT_TOKEN ? "[HIDDEN]" : "NOT_SET",
        mongoUrl: this.MONGO_URL ? "[HIDDEN]" : "NOT_SET",
        weatherApiKey: this.WEATHER_API_KEY ? "[HIDDEN]" : "NOT_SET",
        airKoreaApiKey: this.AIR_KOREA_API_KEY ? "[HIDDEN]" : "NOT_SET",
      },

      userCounts: {
        admins: this.ADMIN_USER_IDS.length,
        allowed: this.ALLOWED_USER_IDS.length || "ALL",
      },
    };
  }

  // Railway 배포 정보 (민감정보 없음)
  getDeploymentInfo() {
    if (!this.isRailway) {
      return null;
    }

    return {
      deploymentId: this.RAILWAY.DEPLOYMENT_ID,
      projectId: this.RAILWAY.PROJECT_ID,
      serviceId: this.RAILWAY.SERVICE_ID,
      environment: this.RAILWAY.ENVIRONMENT,
      publicDomain: this.RAILWAY.PUBLIC_DOMAIN,
      gitCommit: this.RAILWAY.GIT_COMMIT_SHA?.slice(0, 7),
      gitBranch: this.RAILWAY.GIT_BRANCH,
    };
  }

  // 시스템 상태 정보 (민감정보 없음)
  getSystemStatus() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.round(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      env: this.NODE_ENV,
      pid: process.pid,
    };
  }
}

// ✅ 싱글톤 인스턴스 생성 및 두 가지 방식으로 export
const appConfigInstance = new AppConfig();

// 클래스와 인스턴스 모두 export
module.exports = {
  AppConfig: {
    getConfig: () => appConfigInstance.getConfig(),
    getSecurityStatus: () => appConfigInstance.getSecurityStatus(),
    getDebugConfig: () => appConfigInstance.getDebugConfig(),
    getDeploymentInfo: () => appConfigInstance.getDeploymentInfo(),
    getSystemStatus: () => appConfigInstance.getSystemStatus(),
  },
  // 직접 인스턴스도 export (기존 코드 호환성)
  appConfig: appConfigInstance,
};
