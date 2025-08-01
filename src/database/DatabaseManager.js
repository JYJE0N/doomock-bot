// src/database/DatabaseManager.js
const logger = require("../utils/Logger");
const { MongoClient } = require("mongodb");

// 🌍 싱글톤 인스턴스
let globalInstance = null;

/**
 * 🗄️ DatabaseManager - MongoDB Native Driver 관리자
 *
 * StandardSchema 의존성을 제거하고 순수한 MongoDB 연결 관리만 담당
 */
class DatabaseManager {
  constructor(mongoUrl = null, bypassSingleton = false) {
    if (globalInstance && !bypassSingleton) {
      logger.debug("🔄 기존 DatabaseManager 인스턴스 반환");
      return globalInstance;
    }

    this.mongoUrl = mongoUrl || process.env.MONGO_URL;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.databaseName = null;

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 연결 설정
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 5000;
    this.connectionAttempts = 0;

    if (!bypassSingleton) {
      globalInstance = this;
    }

    logger.info("🗄️ DatabaseManager 생성됨");
  }

  /**
   * MongoDB 연결
   */
  async connect() {
    if (this.isConnected) {
      logger.debug("이미 MongoDB에 연결됨");
      return true;
    }

    if (this.isConnecting) {
      logger.debug("연결 진행 중...");
      await this.waitForConnection();
      return this.isConnected;
    }

    if (!this.mongoUrl) {
      logger.warn("⚠️ MongoDB URL이 없어 연결 건너뜀");
      return false;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      logger.info(
        `🔌 MongoDB 연결 시도 중... (시도 ${this.connectionAttempts}/${this.maxReconnectAttempts})`
      );

      // URL에서 데이터베이스 이름 추출
      const urlMatch = this.mongoUrl.match(/\/([^/?]+)(\?|$)/);
      this.databaseName = urlMatch ? urlMatch[1] : "doomock_bot";

      logger.info(`📊 데이터베이스: ${this.databaseName}`);

      // MongoDB 클라이언트 옵션
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        family: 4, // IPv4 강제
      };

      this.client = new MongoClient(this.mongoUrl, options);
      await this.client.connect();

      this.db = this.client.db(this.databaseName);
      this.isConnected = true;
      this.connectionAttempts = 0;

      // 연결 이벤트 설정
      this.setupEventListeners();

      logger.success(`✅ MongoDB 연결 성공 (${this.databaseName})`);
      return true;
    } catch (error) {
      logger.error("❌ MongoDB 연결 실패:", error.message);
      this.isConnected = false;

      // 재연결 시도
      if (this.connectionAttempts < this.maxReconnectAttempts) {
        logger.info(`🔄 ${this.reconnectDelay / 1000}초 후 재연결 시도...`);
        await new Promise((resolve) =>
          setTimeout(resolve, this.reconnectDelay)
        );
        return await this.connect();
      }

      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 연결 대기
   */
  async waitForConnection() {
    const maxWaitTime = 30000;
    const checkInterval = 100;
    const startTime = Date.now();

    while (this.isConnecting && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    if (!this.isConnected) {
      throw new Error("연결 대기 시간 초과");
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    this.client.on("serverHeartbeatFailed", () => {
      logger.warn("⚠️ MongoDB 하트비트 실패");
    });

    this.client.on("error", (error) => {
      logger.error("❌ MongoDB 클라이언트 오류:", error);
    });

    this.client.on("close", () => {
      logger.warn("⚠️ MongoDB 연결 종료됨");
      this.isConnected = false;
    });
  }

  /**
   * 데이터베이스 가져오기
   */
  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error("데이터베이스가 연결되지 않음");
    }
    return this.db;
  }

  /**
   * 컬렉션 가져오기
   */
  getCollection(collectionName) {
    return this.getDb().collection(collectionName);
  }

  /**
   * 트랜잭션 실행
   */
  async withTransaction(callback) {
    const session = this.client.startSession();
    try {
      await session.withTransaction(callback);
    } finally {
      session.endSession();
    }
  }

  /**
   * 연결 종료
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info("✅ MongoDB 연결 종료됨");
    }
  }

  /**
   * 상태 정보
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      database: this.databaseName,
      railway: this.isRailway,
      attempts: this.connectionAttempts,
    };
  }
}

// 싱글톤 인스턴스 반환
function getInstance() {
  if (!globalInstance) {
    globalInstance = new DatabaseManager();
  }
  return globalInstance;
}

module.exports = {
  DatabaseManager,
  getInstance,
};
