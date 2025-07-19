// src/config/AppConfig.js - 완전히 개선된 앱 설정
require("dotenv").config();

class AppConfig {
  constructor() {
    this.loadConfiguration();
    this.validateConfiguration();
  }

  loadConfiguration() {
    // 🤖 봇 설정
    this.BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.BOT_USERNAME = process.env.BOT_USERNAME || "doomock_bot";
    // 호환성을 위한 alias 추가
    this.mongoUrl = this.MONGO_URL;

    // 🌍 환경 설정
    this.NODE_ENV = process.env.NODE_ENV || "development";
    this.PORT = parseInt(process.env.PORT) || 3000;
    this.VERSION =
      process.env.npm_package_version || this.getPackageVersion() || "1.0.0";

    // 💾 데이터베이스 설정
    this.MONGO_URL = this.getMongoUrl();
    this.DB_NAME = process.env.DB_NAME || "doomock85";

    // 🌤️ 외부 API 설정
    this.WEATHER_API_KEY = process.env.WEATHER_API_KEY;
    this.AIR_KOREA_API_KEY = process.env.AIR_KOREA_API_KEY;

    // 🔐 보안 설정
    this.ADMIN_USER_IDS = this.parseAdminUsers();
    this.ALLOWED_USER_IDS = this.parseAllowedUsers();

    // ⚡ 성능 설정
    this.RATE_LIMIT_WINDOW_MS =
      parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1분
    this.RATE_LIMIT_MAX_REQUESTS =
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;
    this.CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 600000; // 10분

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
        true
      ),
      UTILS_MODULE: this.parseBoolean(process.env.ENABLE_UTILS_MODULE, true),
      REMINDER_MODULE: this.parseBoolean(
        process.env.ENABLE_REMINDER_MODULE,
        true
      ),
      WORKTIME_MODULE: this.parseBoolean(
        process.env.ENABLE_WORKTIME_MODULE,
        true
      ),
      TTS_FEATURE: this.parseBoolean(process.env.ENABLE_TTS_FEATURE, true),
      VOICE_FEATURE: this.parseBoolean(process.env.ENABLE_VOICE_FEATURE, true),
    };

    // 🌐 Railway 특화 설정
    this.RAILWAY = {
      DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
      PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
      SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
      ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
      GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
      GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH,
    };

    // 📊 로깅 설정
    this.LOGGING = {
      LEVEL: process.env.LOG_LEVEL || "info",
      CONSOLE_ENABLED: this.parseBoolean(process.env.CONSOLE_LOGGING, true),
      FILE_ENABLED: this.parseBoolean(process.env.FILE_LOGGING, false),
      MAX_LOG_FILES: parseInt(process.env.MAX_LOG_FILES) || 5,
      MAX_LOG_SIZE: process.env.MAX_LOG_SIZE || "10MB",
      STRUCTURED: this.parseBoolean(process.env.STRUCTURED_LOGGING, false),
    };

    // 🏡 화성/동탄 특화 설정
    this.DONGTAN = {
      DEFAULT_CITY: process.env.DEFAULT_CITY || "화성",
      SPECIAL_LOCATIONS: ["동탄", "화성", "수원", "성남"],
      TIME_ZONE: "Asia/Seoul",
      WORK_START: process.env.WORK_START || "08:30",
      WORK_END: process.env.WORK_END || "17:30",
      LUNCH_START: process.env.LUNCH_START || "11:30",
      LUNCH_END: process.env.LUNCH_END || "13:00",
    };

    // 🎯 텔레그램 봇 설정
    this.TELEGRAM = {
      POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL) || 300,
      POLLING_TIMEOUT: parseInt(process.env.POLLING_TIMEOUT) || 10,
      WEBHOOK_URL: process.env.WEBHOOK_URL,
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS) || 40,
      ALLOWED_UPDATES: process.env.ALLOWED_UPDATES?.split(",") || [
        "message",
        "callback_query",
      ],
    };

    // 🔧 시스템 설정
    this.SYSTEM = {
      GRACEFUL_SHUTDOWN_TIMEOUT:
        parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 30000,
      HEALTH_CHECK_ENABLED: this.parseBoolean(
        process.env.HEALTH_CHECK_ENABLED,
        true
      ),
      METRICS_ENABLED: this.parseBoolean(process.env.METRICS_ENABLED, false),
      AUTO_RESTART: this.parseBoolean(process.env.AUTO_RESTART, true),
      MAX_RESTART_ATTEMPTS: parseInt(process.env.MAX_RESTART_ATTEMPTS) || 3,
    };
  }

  // package.json에서 버전 읽기
  getPackageVersion() {
    try {
      const path = require("path");
      const fs = require("fs");
      const packagePath = path.join(process.cwd(), "package.json");

      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        return packageJson.version;
      }
    } catch (error) {
      // 조용히 실패
    }
    return null;
  }

  // MongoDB URL 우선순위에 따라 결정
  getMongoUrl() {
    const candidates = [
      process.env.MONGO_URL,
      process.env.MONGO_PUBLIC_URL,
      process.env.MONGODB_URI,
      process.env.MONGO_URI,
      process.env.DATABASE_URL,
    ];

    // 환경 변수에서 직접 URL 찾기
    for (const url of candidates) {
      if (url && this.isValidMongoUrl(url)) {
        return url;
      }
    }

    // 개별 컴포넌트로 URL 구성
    const mongoUser = process.env.MONGOUSER || process.env.MONGO_USER;
    const mongoPassword =
      process.env.MONGOPASSWORD || process.env.MONGO_PASSWORD;
    const mongoHost =
      process.env.MONGOHOST || process.env.MONGO_HOST || "localhost";
    const mongoPort =
      process.env.MONGOPORT || process.env.MONGO_PORT || "27017";
    const mongoDb = process.env.MONGODB || process.env.MONGO_DB || this.DB_NAME;

    if (mongoUser && mongoPassword && mongoHost) {
      return `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDb}`;
    }

    return null; // MongoDB 설정 없음
  }

  // 관리자 사용자 파싱
  parseAdminUsers() {
    const adminIds = process.env.ADMIN_USER_IDS || process.env.ADMIN_IDS || "";
    if (!adminIds) {
      return [];
    }

    return this.parseUserIds(adminIds);
  }

  // 허용된 사용자 파싱
  parseAllowedUsers() {
    const allowedIds =
      process.env.ALLOWED_USER_IDS || process.env.ALLOWED_IDS || "";
    if (!allowedIds) {
      return [];
    } // 빈 배열이면 모든 사용자 허용

    return this.parseUserIds(allowedIds);
  }

  // 사용자 ID 파싱 헬퍼
  parseUserIds(idsString) {
    return idsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && !isNaN(id))
      .map((id) => parseInt(id))
      .filter((id) => id > 0); // 유효한 텔레그램 사용자 ID만
  }

  // 불린 값 파싱
  parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === "boolean") {
      return value;
    }

    const str = value.toString().toLowerCase();
    return ["true", "1", "yes", "on", "enable", "enabled"].includes(str);
  }

  // 설정 검증
  validateConfiguration() {
    const errors = [];

    // 필수 설정 검증
    if (!this.BOT_TOKEN) {
      errors.push("BOT_TOKEN이 설정되지 않았습니다");
    } else if (!this.isValidBotToken(this.BOT_TOKEN)) {
      errors.push("BOT_TOKEN 형식이 올바르지 않습니다");
    }

    // MongoDB URL 검증 (선택사항이지만 형식은 확인)
    if (this.MONGO_URL && !this.isValidMongoUrl(this.MONGO_URL)) {
      errors.push("MONGO_URL 형식이 올바르지 않습니다");
    }

    // 포트 번호 검증
    if (this.PORT < 1 || this.PORT > 65535) {
      errors.push("PORT 번호가 유효하지 않습니다 (1-65535)");
    }

    // 관리자 사용자 ID 검증
    if (this.ADMIN_USER_IDS.some((id) => id <= 0)) {
      errors.push("관리자 사용자 ID가 유효하지 않습니다");
    }

    // 작업 시간 검증
    if (
      !this.isValidTimeFormat(this.DONGTAN.WORK_START) ||
      !this.isValidTimeFormat(this.DONGTAN.WORK_END)
    ) {
      errors.push("작업 시간 형식이 올바르지 않습니다 (HH:MM)");
    }

    // 로그 레벨 검증
    const validLogLevels = ["error", "warn", "info", "debug", "trace"];
    if (!validLogLevels.includes(this.LOGGING.LEVEL)) {
      errors.push(
        `로그 레벨이 유효하지 않습니다. 사용 가능: ${validLogLevels.join(", ")}`
      );
    }

    if (errors.length > 0) {
      throw new Error("설정 검증 실패:\n" + errors.join("\n"));
    }
  }

  // 텔레그램 봇 토큰 유효성 검사
  isValidBotToken(token) {
    return token && /^\d+:[A-Za-z0-9_-]{35}$/.test(token);
  }

  // MongoDB URL 유효성 검사
  isValidMongoUrl(url) {
    return (
      url && (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://"))
    );
  }

  // 시간 형식 검증 (HH:MM)
  isValidTimeFormat(time) {
    return time && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  // 개발 환경 여부
  get isDevelopment() {
    return this.NODE_ENV === "development";
  }

  // 프로덕션 환경 여부
  get isProduction() {
    return this.NODE_ENV === "production";
  }

  // 테스트 환경 여부
  get isTest() {
    return this.NODE_ENV === "test";
  }

  // Railway 환경 여부
  get isRailway() {
    return !!this.RAILWAY.DEPLOYMENT_ID;
  }

  // 로컬 환경 여부
  get isLocal() {
    return !this.isRailway && this.isDevelopment;
  }

  // 웹훅 모드 여부
  get isWebhookMode() {
    return !!this.TELEGRAM.WEBHOOK_URL;
  }

  // 기능 활성화 확인
  isFeatureEnabled(featureName) {
    const upperName = featureName.toUpperCase();
    return (
      this.FEATURES[upperName] || this.FEATURES[`${upperName}_MODULE`] || false
    );
  }

  // 관리자 여부 확인
  isAdmin(userId) {
    return this.ADMIN_USER_IDS.includes(parseInt(userId));
  }

  // 허용된 사용자 여부 확인
  isAllowedUser(userId) {
    // 허용 목록이 비어있으면 모든 사용자 허용
    if (this.ALLOWED_USER_IDS.length === 0) {
      return true;
    }

    return this.ALLOWED_USER_IDS.includes(parseInt(userId));
  }

  // 현재 설정 요약 반환
  getSummary() {
    return {
      environment: this.NODE_ENV,
      version: this.VERSION,
      port: this.PORT,
      botUsername: this.BOT_USERNAME,
      mongoConfigured: !!this.MONGO_URL,
      weatherApiConfigured: !!this.WEATHER_API_KEY,
      adminUsers: this.ADMIN_USER_IDS.length,
      allowedUsers: this.ALLOWED_USER_IDS.length || "전체",
      enabledFeatures: Object.entries(this.FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
      railway: this.isRailway,
      webhookMode: this.isWebhookMode,
      defaultCity: this.DONGTAN.DEFAULT_CITY,
      logLevel: this.LOGGING.LEVEL,
    };
  }

  // 환경 변수 마스킹하여 로그 출력용 정보 생성
  getLoggableConfig() {
    return {
      NODE_ENV: this.NODE_ENV,
      VERSION: this.VERSION,
      PORT: this.PORT,
      BOT_USERNAME: this.BOT_USERNAME,
      BOT_TOKEN: this.BOT_TOKEN
        ? `${this.BOT_TOKEN.slice(0, 8)}***`
        : "NOT_SET",
      MONGO_URL: this.MONGO_URL ? "CONFIGURED" : "NOT_SET",
      WEATHER_API_KEY: this.WEATHER_API_KEY ? "CONFIGURED" : "NOT_SET",
      AIR_KOREA_API_KEY: this.AIR_KOREA_API_KEY ? "CONFIGURED" : "NOT_SET",
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

  // 디버그용 전체 설정 덤프 (민감한 정보 마스킹)
  getDebugConfig() {
    const config = { ...this };

    // 민감한 정보 마스킹
    if (config.BOT_TOKEN) {
      config.BOT_TOKEN = `${config.BOT_TOKEN.slice(0, 8)}***`;
    }
    if (config.MONGO_URL) {
      config.MONGO_URL = config.MONGO_URL.replace(
        /\/\/([^:]+):([^@]+)@/,
        "//***:***@"
      );
    }
    if (config.WEATHER_API_KEY) {
      config.WEATHER_API_KEY = `${config.WEATHER_API_KEY.slice(0, 8)}***`;
    }
    if (config.AIR_KOREA_API_KEY) {
      config.AIR_KOREA_API_KEY = `${config.AIR_KOREA_API_KEY.slice(0, 8)}***`;
    }

    return config;
  }

  // Railway 배포 정보
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

  // 시스템 상태 정보
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

// 싱글톤 인스턴스 생성 및 내보내기
const appConfig = new AppConfig();

module.exports = appConfig;
