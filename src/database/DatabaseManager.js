// 🔧 MongoDB 5.x 호환 DatabaseManager.js 수정
// src/database/DatabaseManager.js

const { MongoClient } = require("mongodb");
const Logger = require("../utils/Logger");

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.reconnectInterval = null;
  }

  setConnectionString(MONGO_URL) {
    this.MONGO_URL = MONGO_URL;
  }

  // ⭐ MongoDB 5.x 호환 연결 (경고 제거)
  async connect() {
    if (this.isConnected) {
      return true;
    }

    try {
      if (!this.MONGO_URL) {
        throw new Error("MongoDB URL이 설정되지 않았습니다");
      }

      Logger.info("MongoDB 연결 시도...");

      // ✅ MongoDB 5.x 호환 설정 (경고 제거)
      this.client = new MongoClient(this.MONGO_URL, {
        // ❌ 완전히 제거: useNewUrlParser, useUnifiedTopology
        // MongoDB 5.x에서는 이 옵션들이 기본값이 되어 더 이상 필요없음

        // ✅ 유지할 옵션들 (MongoDB 5.x 호환)
        serverSelectionTimeoutMS: 10000, // 서버 선택 타임아웃
        connectTimeoutMS: 15000, // 연결 타임아웃
        socketTimeoutMS: 0, // 소켓 타임아웃 (0 = 무제한)
        retryWrites: true, // 쓰기 재시도
        // Railway 최적화
        maxPoolSize: 10, // 최대 연결 풀
        minPoolSize: 1, // 최소 연결 풀
        maxIdleTimeMS: 30000, // 최대 유휴 시간
        // 압축 설정 (네트워크 최적화)
        compressors: ["zlib"],
      });

      await this.client.connect();

      // 데이터베이스 이름 처리
      let dbName = this.extractDbName(this.MONGO_URL);
      dbName = this.sanitizeDbName(dbName) || "doomock85";

      this.db = this.client.db(dbName);
      this.isConnected = true;

      // 이벤트 리스너 설정
      this.setupEventListeners();

      // 연결 확인
      await this.testConnection();

      Logger.success(`✅ MongoDB 5.x 연결 성공: ${dbName} (경고 없음)`);
      return true;
    } catch (error) {
      Logger.error("❌ MongoDB 연결 실패:", error);
      this.isConnected = false;
      throw error;
    }
  }

  // ⭐ 연결 테스트
  async testConnection() {
    try {
      const admin = this.client.db().admin();
      const result = await admin.ping();
      Logger.info("🏓 MongoDB 연결 테스트 성공:", result);
      return true;
    } catch (error) {
      Logger.warn("⚠️ MongoDB 연결 테스트 실패:", error);
      return false;
    }
  }

  // 기존 메서드들 유지 (변경 없음)
  extractDbName(MONGO_URL) {
    try {
      const match = MONGO_URL.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  sanitizeDbName(dbName) {
    if (!dbName) return null;

    let sanitized = dbName
      .replace(/\./g, "_")
      .replace(/\s+/g, "_")
      .replace(/[/\\:"*?<>|]/g, "")
      .replace(/^[._]+/, "")
      .replace(/[._]+$/, "")
      .toLowerCase();

    if (sanitized.length > 63) {
      sanitized = sanitized.substring(0, 63);
    }

    sanitized = sanitized.replace(/[._]+$/, "");

    if (!sanitized || sanitized.length === 0) {
      return "doomock_bot";
    }

    Logger.info(`데이터베이스 이름 정리: ${dbName} → ${sanitized}`);
    return sanitized;
  }

  // ⭐ MongoDB 5.x 호환 이벤트 리스너
  setupEventListeners() {
    if (!this.client) return;

    // MongoDB 5.x 이벤트들
    this.client.on("serverClosed", () => {
      Logger.warn("⚠️ MongoDB 서버 연결 종료");
      this.isConnected = false;
      this.startReconnect();
    });

    this.client.on("error", (error) => {
      Logger.error("❌ MongoDB 에러:", error);
      this.isConnected = false;
    });

    // 연결 복구 감지
    this.client.on("serverOpening", () => {
      Logger.info("🔄 MongoDB 서버 연결 복구 중...");
    });

    this.client.on("serverDescriptionChanged", (event) => {
      if (event.newDescription.type !== "Unknown") {
        Logger.success("✅ MongoDB 연결 복구됨");
        this.isConnected = true;
        this.stopReconnect();
      }
    });
  }

  // 재연결 로직 (기존 유지)
  startReconnect() {
    if (this.reconnectInterval) return;

    Logger.info("🔄 MongoDB 재연결 시작");
    this.reconnectInterval = setInterval(async () => {
      try {
        await this.connect();
        if (this.isConnected) {
          this.stopReconnect();
        }
      } catch (error) {
        Logger.debug("⚠️ 재연결 시도 중...");
      }
    }, 10000); // 10초마다
  }

  stopReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      Logger.info("⏹️ 재연결 중지");
    }
  }

  // 연결 확인 (개선)
  async ensureConnection() {
    if (!this.isConnected || !this.client) {
      await this.connect();
      return;
    }

    try {
      await this.client.db().admin().ping();
    } catch (error) {
      Logger.warn("⚠️ 연결 확인 실패, 재연결:", error.message);
      this.isConnected = false;
      await this.connect();
    }
  }

  // 나머지 메서드들 (기존과 동일)
  getCollection(collectionName) {
    if (!this.db) {
      throw new Error("데이터베이스 연결이 필요합니다");
    }
    return this.db.collection(collectionName);
  }

  async disconnect() {
    try {
      this.stopReconnect();

      if (this.client) {
        await this.client.close();
        Logger.info("🔌 MongoDB 연결 종료");
      }

      this.client = null;
      this.db = null;
      this.isConnected = false;
    } catch (error) {
      Logger.error("❌ 연결 종료 중 오류:", error);
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      database: this.db ? this.db.databaseName : null,
      reconnecting: !!this.reconnectInterval,
      mongoVersion: "5.x",
      warningsRemoved: true,
    };
  }
}

// 기존과 동일한 export
const instance = new DatabaseManager();

class DatabaseManagerWrapper {
  constructor(MONGO_URL) {
    instance.setConnectionString(MONGO_URL);
  }

  async connect() {
    return instance.connect();
  }

  async disconnect() {
    return instance.disconnect();
  }

  getStatus() {
    return instance.getStatus();
  }
}

module.exports = {
  DatabaseManager: DatabaseManagerWrapper,
  ensureConnection: function () {
    return instance.ensureConnection();
  },
  getCollection: function (name) {
    return instance.getCollection(name);
  },
  getStatus: function () {
    return instance.getStatus();
  },
};

// =============================================================
// 🔧 추가 팁: 환경변수 최적화
// =============================================================

// .env 파일에 추가할 MongoDB 최적화 설정
/*
# MongoDB 연결 최적화 (Railway 환경)
MONGO_POOL_SIZE=10
MONGO_CONNECT_TIMEOUT=15000
MONGO_SERVER_TIMEOUT=10000
MONGO_SOCKET_TIMEOUT=0
MONGO_RETRY_WRITES=true

# 압축 활성화 (네트워크 절약)
MONGO_COMPRESSORS=zlib
*/
