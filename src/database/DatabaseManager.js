// src/database/DatabaseManager.js - MongoDB 6.0+ 호환

const { MongoClient, ServerApiVersion } = require("mongodb");

class DatabaseManager {
  constructor(MONGO_URL = null) {
    this.MONGO_URL =
      MONGO_URL || process.env.MONGO_URL || process.env.MONGODB_URI;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isShuttingDown = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5; // ✅ 변수명 통일
    this.reconnectInterval = null;

    const logger = this.getLogger();
    if (this.MONGO_URL) {
      logger.info("🗄️ DatabaseManager 초기화됨");
    } else {
      logger.warn("⚠️ MongoDB URL이 설정되지 않음");
    }
  }

  // 안전한 logger 획득
  getLogger() {
    try {
      return require("../utils/Logger");
    } catch (error) {
      return {
        info: (...args) => console.log("[INFO]", ...args),
        error: (...args) => console.error("[ERROR]", ...args),
        warn: (...args) => console.warn("[WARN]", ...args),
        debug: (...args) => console.log("[DEBUG]", ...args),
        success: (...args) => console.log("[SUCCESS]", ...args),
      };
    }
  }

  // ✅ MongoDB 6.0+ 호환 옵션 생성
  getMongoOptions() {
    const isRailwayMongo = this.MONGO_URL?.includes("caboose.proxy.rlwy.net");

    const baseOptions = {
      // 서버 API 버전 설정 (권장)
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },

      // 연결 풀 설정
      maxPoolSize: isRailwayMongo ? 5 : 10,
      minPoolSize: isRailwayMongo ? 1 : 2,
      maxIdleTimeMS: 30000,

      // 타임아웃 설정 (Railway 최적화)
      serverSelectionTimeoutMS: isRailwayMongo ? 15000 : 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: isRailwayMongo ? 15000 : 10000,
      heartbeatFrequencyMS: 10000,

      // 재시도 설정
      retryWrites: true,
      retryReads: true,

      // 인증 및 읽기 설정
      authSource: "admin",
      readPreference: "primary",

      // 압축 (네트워크 최적화)
      compressors: ["zlib"],
    };

    const logger = this.getLogger();

    if (isRailwayMongo) {
      logger.info("🚂 Railway MongoDB 플러그인 감지, 최적화 옵션 적용");
    } else {
      logger.info("🌐 외부 MongoDB 서비스 감지, 표준 옵션 적용");
    }

    return baseOptions;
  }

  async connect() {
    if (this.isShuttingDown) {
      throw new Error("데이터베이스가 종료 중입니다");
    }

    if (this.isConnected) {
      const logger = this.getLogger();
      logger.debug("✅ 이미 연결됨");
      return true;
    }

    if (!this.MONGO_URL) {
      throw new Error("MongoDB URL이 설정되지 않았습니다");
    }

    const logger = this.getLogger();
    this.connectionAttempts++;

    try {
      // ✅ 수정: 변수명 통일
      logger.info(
        `🔄 MongoDB 연결 시도 (${this.connectionAttempts}/${this.maxRetries})`
      );

      // ✅ 최신 호환 옵션 사용
      const mongoOptions = this.getMongoOptions();

      this.client = new MongoClient(this.MONGO_URL, mongoOptions);

      // 연결 시도
      await this.client.connect();

      // 연결 확인
      await this.client.db().admin().ping();

      // 데이터베이스 설정
      const dbName = this.extractDbName(this.MONGO_URL);
      const sanitizedDbName = this.sanitizeDbName(dbName);
      this.db = this.client.db(sanitizedDbName);

      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.success(`✅ MongoDB 연결 성공! 데이터베이스: ${sanitizedDbName}`);

      // 자동 재연결 모니터링 시작
      this.startReconnectMonitoring();

      return true;
    } catch (error) {
      logger.error(
        `❌ MongoDB 연결 실패 (시도 ${this.connectionAttempts}):`,
        error.message
      );

      if (this.client) {
        try {
          await this.client.close();
        } catch (closeError) {
          logger.debug("클라이언트 정리 중 오류:", closeError.message);
        }
        this.client = null;
      }

      this.isConnected = false;

      // ✅ 수정: 변수명 통일
      if (this.connectionAttempts >= this.maxRetries) {
        throw new Error(`최대 재시도 횟수 초과 (${this.maxRetries})`);
      }

      throw error;
    }
  }

  // ... 나머지 메서드들은 동일 ...
}

module.exports = DatabaseManager;
