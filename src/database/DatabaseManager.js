// ===== 3. src/database/DatabaseManager.js - 간결한 연결 관리자 =====
const logger = require("../utils/Logger");
const { MongoClient } = require("mongodb");
const { SchemaManager } = require("./schemas/StandardSchema");

// 🌍 싱글톤 인스턴스
let globalInstance = null;

class DatabaseManager {
  constructor(mongoUrl = null, bypassSingleton = false) {
    // ✅ 수정: 싱글톤 우회 옵션 추가
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

    // ✅ 수정: 싱글톤 우회가 아닌 경우에만 전역 인스턴스로 저장
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

    // ✅ URL 확인 추가
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

      // URL에서 데이터베이스 이름 추출 (Railway 환경)
      const urlMatch = this.mongoUrl.match(/\/([^/?]+)(\?|$)/);
      this.databaseName = urlMatch ? urlMatch[1] : "doomock_bot";

      logger.info(`📊 데이터베이스: ${this.databaseName}`);

      // MongoDB 클라이언트 옵션
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        family: 4 // IPv4 강제
      };

      this.client = new MongoClient(this.mongoUrl, options);
      await this.client.connect();

      this.db = this.client.db(this.databaseName);
      this.isConnected = true;
      this.connectionAttempts = 0; // 성공 시 초기화

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
        await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));
        return await this.connect();
      }

      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (!this.client) return;

    this.client.on("close", () => {
      logger.warn("⚠️ MongoDB 연결 종료됨");
      this.isConnected = false;
    });

    this.client.on("error", (error) => {
      logger.error("❌ MongoDB 오류:", error.message);
    });

    this.client.on("serverOpening", () => {
      logger.debug("MongoDB 서버 연결 중...");
    });

    this.client.on("serverClosed", () => {
      logger.debug("MongoDB 서버 연결 종료");
    });
  }

  /**
   * 연결 대기
   */
  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return this.isConnected;
  }

  /**
   * 연결 보장
   */
  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.isConnected;
  }

  /**
   * 컬렉션 가져오기
   */
  getCollection(name) {
    if (!this.isConnected || !this.db) {
      throw new Error("데이터베이스에 연결되지 않음");
    }
    return this.db.collection(name);
  }

  /**
   * 트랜잭션 실행
   */
  async withTransaction(callback) {
    if (!this.client) {
      throw new Error("MongoDB 클라이언트가 없음");
    }

    const session = this.client.startSession();
    try {
      await session.withTransaction(callback);
    } finally {
      await session.endSession();
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
   * 연결 상태 확인
   */
  async checkConnection() {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
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
      connectionAttempts: this.connectionAttempts,
      mongoUrl: this.mongoUrl ? "SET" : "NOT_SET"
    };
  }

  // ⭐️ 여기에 추가! (getStatus 메서드 다음)
  /**
   * DB 인스턴스 가져오기 (호환성을 위한 메서드)
   */
  getDb() {
    if (!this.db) {
      throw new Error("데이터베이스가 연결되지 않았습니다");
    }
    return this.db;
  }

  /**
   * DB 인스턴스 가져오기 (별칭)
   */
  getDatabase() {
    return this.getDb();
  }

  /**
   * 연결 상태 확인 (메서드 형태)
   */
  isConnected() {
    return this.isConnected;
  }
} // 클래스 끝

/**
 * 싱글톤 인스턴스 가져오기
 */
function getInstance() {
  if (!globalInstance) {
    globalInstance = new DatabaseManager();
  }
  return globalInstance;
}

/**
 * ✅ 수정: 새 인스턴스 생성 (싱글톤 완전 우회)
 */
function createInstance(mongoUrl) {
  // 싱글톤을 우회하여 새 인스턴스 생성
  return new DatabaseManager(mongoUrl, true); // bypassSingleton = true
}

module.exports = {
  DatabaseManager,
  getInstance,
  createInstance
};
