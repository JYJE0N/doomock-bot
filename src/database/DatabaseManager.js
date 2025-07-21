// src/database/DatabaseManager.js - 완전 수정 버전

const logger = require("../utils/Logger");
const { MongoClient } = require("mongodb");

// 🌍 싱글톤 인스턴스 저장소 - 파일 최상단에 선언
let globalDatabaseInstance = null;

class DatabaseManager {
  constructor(mongoUrl = null, options = {}) {
    // 🔒 싱글톤 패턴 적용
    if (globalDatabaseInstance) {
      logger.debug("🔄 기존 DatabaseManager 인스턴스 반환");
      return globalDatabaseInstance;
    }

    this.logger = logger;
    this.mongoUrl = mongoUrl || process.env.MONGO_URL;
    this.options = options;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;

    // Railway 환경 감지
    this.isRailwayEnvironment = !!process.env.RAILWAY_ENVIRONMENT;

    // 데이터베이스 이름
    this.databaseName = options.dbName || process.env.DB_NAME || "doomock_bot";

    // 연결 통계
    this.poolStats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      lastConnected: null,
      connectionAttempts: 0,
      reconnectCount: 0,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      peakConnections: 0,
    };

    // 재연결 설정
    this.reconnectInterval = null;
    this.reconnectDelay = 5000;
    this.maxReconnectAttempts = 10;
    this.connectionAttempts = 0;

    // 쿼리 성능 추적
    this.queryTimes = [];
    this.maxQueryTimeSamples = 100;

    // 종료 상태
    this.isShuttingDown = false;

    // 싱글톤 인스턴스 저장
    globalDatabaseInstance = this;

    logger.info("🗄️ DatabaseManager 생성됨 (MongoDB 네이티브)");
  }

  // 🔌 연결 메서드
  async connect() {
    if (this.isConnected) {
      logger.debug("이미 MongoDB에 연결됨");
      return true;
    }

    if (this.isConnecting) {
      logger.debug("MongoDB 연결 진행 중...");
      await this.waitForConnection();
      return this.isConnected;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      logger.info(
        `🔌 MongoDB 연결 시도 중... (시도 #${this.connectionAttempts})`
      );

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        family: 4,
      };

      this.client = new MongoClient(this.mongoUrl, options);
      await this.client.connect();

      this.db = this.client.db(this.databaseName);
      this.isConnected = true;
      this.poolStats.lastConnected = new Date();
      this.poolStats.connectionsCreated++;

      // 연결 이벤트 리스너
      this.setupEventListeners();

      logger.success(
        `✅ MongoDB 연결 성공 (데이터베이스: ${this.databaseName})`
      );

      return true;
    } catch (error) {
      logger.error("❌ MongoDB 연결 실패:", error);
      this.isConnected = false;

      // 재연결 시도
      if (this.connectionAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }

      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    if (!this.client) return;

    this.client.on("close", () => {
      logger.warn("⚠️ MongoDB 연결 종료됨");
      this.isConnected = false;
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.client.on("error", (error) => {
      logger.error("❌ MongoDB 오류:", error);
    });
  }

  // 재연결 스케줄
  scheduleReconnect() {
    if (this.reconnectInterval) return;

    logger.info(`🔄 ${this.reconnectDelay / 1000}초 후 재연결 시도...`);

    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      this.poolStats.reconnectCount++;

      try {
        await this.connect();
      } catch (error) {
        logger.error("재연결 실패:", error);
      }
    }, this.reconnectDelay);
  }

  // 연결 대기
  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return this.isConnected;
  }

  // 컬렉션 가져오기
  getCollection(name) {
    if (!this.isConnected || !this.db) {
      throw new Error("데이터베이스에 연결되지 않음");
    }

    return this.db.collection(name);
  }

  // 연결 종료
  async disconnect() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.client) {
      this.isShuttingDown = true;
      await this.client.close();
      this.isConnected = false;
      this.poolStats.connectionsDestroyed++;
      logger.info("✅ MongoDB 연결 종료됨");
    }
  }

  // 상태 조회
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      database: this.databaseName,
      railwayDetected: this.isRailwayEnvironment,
      reconnecting: !!this.reconnectInterval,
      connectionAttempts: this.connectionAttempts,
      poolStats: this.poolStats,
    };
  }
}

// 🌍 싱글톤 팩토리 함수
function createDatabaseManager(mongoUrl = null, options = {}) {
  if (globalDatabaseInstance) {
    return globalDatabaseInstance;
  }
  return new DatabaseManager(mongoUrl, options);
}

// 🌍 getInstance 함수
function getInstance() {
  if (!globalDatabaseInstance) {
    globalDatabaseInstance = createDatabaseManager();
  }
  return globalDatabaseInstance;
}

// ✅ 올바른 Export 구조
module.exports = {
  DatabaseManager,
  createDatabaseManager,
  getInstance,
};
