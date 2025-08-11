// src/config/ConfigManager.js - Simplified Configuration Manager
const logger = require("../utils/core/Logger");

/**
 * 🔧 ConfigManager - 단순화된 설정 관리자
 * 
 * 핵심 기능만 유지:
 * - 환경 감지 (development, production, staging, railway)
 * - 필수 환경변수 검증
 * - 기본 설정 제공
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
    this.isStaging = this.nodeEnv === "staging";

    // 필수 설정 로드
    this.loadConfigurations();

    ConfigManager.instance = this;
    logger.info("🔧 ConfigManager 초기화 완료");
  }

  /**
   * 설정 로드
   */
  loadConfigurations() {
    // 1. 기본 애플리케이션 설정
    this.app = {
      name: "DooMock Bot",
      version: process.env.npm_package_version || "1.0.0",
      port: process.env.PORT || 3000
    };

    // 2. Telegram 봇 설정
    this.telegram = {
      token: process.env.BOT_TOKEN,
      developerIds: (process.env.DEVELOPER_IDS || "").split(",").filter(Boolean)
    };

    // 3. 데이터베이스 설정
    this.database = {
      mongodb: {
        url: process.env.MONGO_URL || process.env.MONGODB_URL,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      }
    };

    // 4. Railway 특화 설정
    if (this.isRailway) {
      this.railway = {
        projectId: process.env.RAILWAY_PROJECT_ID,
        serviceId: process.env.RAILWAY_SERVICE_ID,
        environment: process.env.RAILWAY_ENVIRONMENT,
        replica: process.env.RAILWAY_REPLICA_ID
      };
    }

    // 5. 서비스별 설정
    this.services = {
      weather: {
        apiKey: process.env.WEATHER_API_KEY,
        defaultCity: process.env.DEFAULT_WEATHER_CITY || "서울"
      },
      google: {
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY
      }
    };

    // 필수 환경변수 검증
    this.validateRequired();
  }

  /**
   * 필수 환경변수 검증
   */
  validateRequired() {
    const required = [
      { key: 'BOT_TOKEN', value: this.telegram.token, name: 'Telegram Bot Token' },
      { key: 'MONGO_URL', value: this.database.mongodb.url, name: 'MongoDB URL' }
    ];

    const missing = required.filter(config => !config.value);
    
    if (missing.length > 0) {
      logger.error("❌ 필수 환경변수 누락:", missing.map(m => m.name));
      throw new Error(`필수 환경변수 누락: ${missing.map(m => m.key).join(', ')}`);
    }

    logger.debug("✅ 필수 환경변수 검증 완료");
  }

  /**
   * 환경별 설정 가져오기
   */
  getEnvironmentConfig() {
    return {
      nodeEnv: this.nodeEnv,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      isStaging: this.isStaging,
      isRailway: this.isRailway
    };
  }

  /**
   * 전체 설정 조회
   */
  getAllConfig() {
    return {
      app: this.app,
      telegram: {
        token: this.telegram.token ? "***설정됨***" : "❌ 미설정",
        developerIds: this.telegram.developerIds.length
      },
      database: {
        mongodb: {
          url: this.database.mongodb.url ? "***설정됨***" : "❌ 미설정"
        }
      },
      environment: this.getEnvironmentConfig()
    };
  }

  /**
   * 정리
   */
  cleanup() {
    logger.info("🔧 ConfigManager 정리 완료");
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
}

// 싱글톤 인스턴스
ConfigManager.instance = null;

module.exports = ConfigManager;