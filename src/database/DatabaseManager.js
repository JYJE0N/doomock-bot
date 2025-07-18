// src/database/DatabaseManager.js - 안정화된 MongoDB 연결

const { MongoClient } = require("mongodb");
const Logger = require("../utils/Logger");

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.reconnectInterval = null;
    this.isShuttingDown = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  setConnectionString(MONGO_URL) {
    this.MONGO_URL = MONGO_URL;
  }

  // 🔧 안정화된 MongoDB 연결
  async connect() {
    if (this.isConnected) {
      return true;
    }

    if (this.isShuttingDown) {
      Logger.info("🛑 종료 중이므로 연결하지 않습니다");
      return false;
    }

    try {
      if (!this.MONGO_URL) {
        Logger.warn("⚠️ MongoDB URL이 설정되지 않음, 메모리 모드로 실행");
        return false;
      }

      this.connectionAttempts++;
      Logger.info(
        `📊 MongoDB 연결 시도 ${this.connectionAttempts}/${this.maxConnectionAttempts}...`
      );

      // MongoDB 연결 옵션 (Railway 최적화)
      const options = {
        serverSelectionTimeoutMS: 15000, // 15초
        connectTimeoutMS: 20000, // 20초
        socketTimeoutMS: 45000, // 45초
        heartbeatFrequencyMS: 10000, // 10초마다 헬스체크
        maxPoolSize: 5, // Railway 제한을 고려한 작은 풀
        minPoolSize: 1,
        maxIdleTimeMS: 30000, // 30초 후 유휴 연결 정리
        authSource: "admin",
        retryWrites: true,
        compressors: ["zlib"],
        // Railway 네트워크 안정성을 위한 설정
        bufferMaxEntries: 0, // 연결 실패 시 버퍼링 비활성화
        useUnifiedTopology: true,
      };

      this.client = new MongoClient(this.MONGO_URL, options);

      // 연결 시도 (타임아웃 포함)
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("연결 타임아웃")), 25000)
        ),
      ]);

      // 데이터베이스 이름 추출 및 정리
      let dbName = this.extractDbName(this.MONGO_URL);
      dbName = this.sanitizeDbName(dbName) || "doomock85";

      this.db = this.client.db(dbName);

      // 연결 테스트
      await this.testConnection();

      this.isConnected = true;
      this.connectionAttempts = 0; // 성공 시 리셋

      // 이벤트 리스너 설정
      this.setupEventListeners();

      Logger.success(`✅ MongoDB 연결 성공: ${dbName}`);
      return true;
    } catch (error) {
      Logger.error(
        `❌ MongoDB 연결 실패 (${this.connectionAttempts}/${this.maxConnectionAttempts}):`,
        error.message
      );

      this.isConnected = false;

      // 최대 시도 횟수 초과 시 포기
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        Logger.warn("⚠️ MongoDB 연결을 포기하고 메모리 모드로 실행합니다");
        return false;
      }

      // 재시도 전 대기
      const waitTime = this.connectionAttempts * 3000; // 3초, 6초, 9초
      Logger.info(`⏳ ${waitTime / 1000}초 후 재시도...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      return await this.connect(); // 재귀 호출
    }
  }

  // 🏓 연결 테스트
  async testConnection() {
    try {
      const admin = this.client.db().admin();
      const result = await admin.ping();
      Logger.debug("🏓 MongoDB ping 성공:", result);
      return true;
    } catch (error) {
      throw new Error(`연결 테스트 실패: ${error.message}`);
    }
  }

  // 🎧 이벤트 리스너 설정
  setupEventListeners() {
    if (!this.client) return;

    // 연결 해제 감지
    this.client.on("close", () => {
      if (!this.isShuttingDown) {
        Logger.warn("⚠️ MongoDB 연결이 닫혔습니다");
        this.isConnected = false;
        this.startReconnect();
      }
    });

    // 에러 이벤트
    this.client.on("error", (error) => {
      Logger.error("❌ MongoDB 클라이언트 에러:", error.message);
      this.isConnected = false;
    });

    // 서버 상태 변화 모니터링
    this.client.on("serverDescriptionChanged", (event) => {
      const { newDescription } = event;

      if (newDescription.type === "Unknown") {
        Logger.warn("⚠️ MongoDB 서버 상태 불명");
        this.isConnected = false;
      } else if (newDescription.type !== "Unknown" && !this.isConnected) {
        Logger.success("✅ MongoDB 서버 연결 복구됨");
        this.isConnected = true;
        this.stopReconnect();
      }
    });

    Logger.debug("🎧 MongoDB 이벤트 리스너 설정 완료");
  }

  // 🔄 재연결 로직
  startReconnect() {
    if (this.reconnectInterval || this.isShuttingDown) return;

    Logger.info("🔄 MongoDB 재연결 시작");

    this.reconnectInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        this.stopReconnect();
        return;
      }

      try {
        Logger.debug("⚡ 재연결 시도 중...");
        await this.connect();

        if (this.isConnected) {
          Logger.success("✅ MongoDB 재연결 성공");
          this.stopReconnect();
        }
      } catch (error) {
        Logger.debug("⚠️ 재연결 실패, 계속 시도 중...");
      }
    }, 15000); // 15초마다 재연결 시도
  }

  stopReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      Logger.info("⏹️ 재연결 중지");
    }
  }

  // 🔍 연결 확인 및 복구
  async ensureConnection() {
    if (this.isShuttingDown) {
      throw new Error("데이터베이스가 종료 중입니다");
    }

    if (!this.isConnected || !this.client) {
      Logger.info("🔄 연결이 끊어져 재연결 시도");
      return await this.connect();
    }

    try {
      // 빠른 연결 상태 확인
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      Logger.warn("⚠️ 연결 확인 실패, 재연결:", error.message);
      this.isConnected = false;
      return await this.connect();
    }
  }

  // 📂 컬렉션 조회
  getCollection(collectionName) {
    if (!this.db) {
      throw new Error("데이터베이스가 연결되지 않았습니다");
    }
    return this.db.collection(collectionName);
  }

  // 🔌 안전한 연결 종료
  async disconnect() {
    this.isShuttingDown = true;

    try {
      this.stopReconnect();

      if (this.client) {
        Logger.info("🔌 MongoDB 연결 종료 중...");
        await this.client.close(false); // 강제 종료 비활성화
        Logger.info("✅ 데이터베이스 연결 종료");
      }

      this.client = null;
      this.db = null;
      this.isConnected = false;
    } catch (error) {
      Logger.error("❌ 연결 종료 중 오류:", error.message);
    }
  }

  // 🏷️ 데이터베이스 이름 추출
  extractDbName(MONGO_URL) {
    try {
      const match = MONGO_URL.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // 🧹 데이터베이스 이름 정리
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

    Logger.debug(`데이터베이스 이름 정리: ${dbName} → ${sanitized}`);
    return sanitized;
  }

  // 📊 상태 조회
  getStatus() {
    return {
      connected: this.isConnected,
      database: this.db ? this.db.databaseName : null,
      reconnecting: !!this.reconnectInterval,
      shuttingDown: this.isShuttingDown,
      connectionAttempts: this.connectionAttempts,
      hasClient: !!this.client,
      mongoUrl: this.MONGO_URL ? "설정됨" : "없음",
    };
  }
}

// 싱글톤 인스턴스
const instance = new DatabaseManager();

// 래퍼 클래스
class DatabaseManagerWrapper {
  constructor(MONGO_URL) {
    if (MONGO_URL) {
      instance.setConnectionString(MONGO_URL);
    }
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

// 안전한 연결 확인 함수
async function ensureConnection() {
  try {
    return await instance.ensureConnection();
  } catch (error) {
    Logger.warn(
      "⚠️ 데이터베이스 연결 실패, 메모리 모드로 계속:",
      error.message
    );
    return false;
  }
}

// 안전한 컬렉션 조회
function getCollection(name) {
  try {
    return instance.getCollection(name);
  } catch (error) {
    Logger.warn(`⚠️ 컬렉션 ${name} 조회 실패:`, error.message);
    throw error;
  }
}

// 안전한 상태 조회
function getStatus() {
  try {
    return instance.getStatus();
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

module.exports = {
  DatabaseManager: DatabaseManagerWrapper,
  ensureConnection,
  getCollection,
  getStatus,
};
