// src/database/DatabaseManager.js - MongoDB 연결 관리

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

      // Mongoose 옵션 설정
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
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
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error.message,
        state: this.getConnectionStatus(),
      };
    }
  }
}

module.exports = DatabaseManager;
