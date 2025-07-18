// src/database/DatabaseManager.js - MongoDB 연결 관리 (최신 버전)

const mongoose = require("mongoose");
const Logger = require("../utils/Logger");

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect(uri) {
    try {
      if (this.isConnected) {
        Logger.info("이미 데이터베이스에 연결되어 있습니다.");
        return this.connection;
      }

      Logger.info("MongoDB 연결 시도 중...");

      // Mongoose 7.x/8.x 옵션 (구버전 옵션 제거)
      const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // useNewUrlParser와 useUnifiedTopology 제거 (더 이상 필요 없음)
      };

      // MongoDB 연결
      this.connection = await mongoose.connect(
        uri || process.env.MONGO_URL || process.env.MONGODB_URI,
        options
      );
      this.isConnected = true;

      // 연결 이벤트 핸들러
      mongoose.connection.on("connected", () => {
        Logger.success("MongoDB 연결 성공");
      });

      mongoose.connection.on("error", (err) => {
        Logger.error("MongoDB 연결 오류:", err);
      });

      mongoose.connection.on("disconnected", () => {
        Logger.warn("MongoDB 연결 끊김");
        this.isConnected = false;
      });

      // MongoDB 버전 정보 로깅 (선택사항)
      const adminDb = mongoose.connection.db.admin();
      const info = await adminDb.serverStatus();
      Logger.info(`MongoDB 버전: ${info.version}`);

      Logger.success("데이터베이스 연결 완료");
      return this.connection;
    } catch (error) {
      Logger.error("데이터베이스 연결 실패:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected) {
        Logger.info("이미 데이터베이스 연결이 끊어져 있습니다.");
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      Logger.info("데이터베이스 연결 종료");
    } catch (error) {
      Logger.error("데이터베이스 연결 종료 실패:", error);
      throw error;
    }
  }

  // 연결 상태 확인
  isReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // 연결 상태 문자열 반환
  getConnectionStatus() {
    const states = {
      0: "연결 끊김",
      1: "연결됨",
      2: "연결 중",
      3: "연결 끊는 중",
    };
    return states[mongoose.connection.readyState] || "알 수 없음";
  }

  // 헬스체크
  async healthCheck() {
    try {
      if (!this.isReady()) {
        return {
          status: "unhealthy",
          message: "Database not connected",
          state: this.getConnectionStatus(),
        };
      }

      // 간단한 쿼리로 연결 테스트
      await mongoose.connection.db.admin().ping();

      return {
        status: "healthy",
        message: "Database is responsive",
        state: this.getConnectionStatus(),
        mongooseVersion: mongoose.version,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error.message,
        state: this.getConnectionStatus(),
      };
    }
  }

  // 컬렉션 목록 가져오기 (디버깅용)
  async getCollections() {
    try {
      if (!this.isReady()) {
        throw new Error("Database not connected");
      }

      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      return collections.map((col) => col.name);
    } catch (error) {
      Logger.error("컬렉션 목록 조회 실패:", error);
      return [];
    }
  }
}

module.exports = DatabaseManager;
