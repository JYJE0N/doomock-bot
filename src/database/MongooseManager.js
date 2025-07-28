// src/database/MongooseManager.js
const mongoose = require("mongoose");
const logger = require("../utils/Logger");

let instance = null;

class MongooseManager {
  constructor() {
    if (instance) {
      return instance;
    }

    this.isConnected = false;
    this.models = new Map();

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    instance = this;
  }

  /**
   * MongoDB 연결
   */
  async connect() {
    if (this.isConnected) {
      logger.debug("이미 Mongoose로 연결됨");
      return true;
    }

    try {
      const mongoUrl = process.env.MONGO_URL;
      if (!mongoUrl) {
        throw new Error("MONGO_URL 환경변수가 설정되지 않음");
      }

      logger.info("🔌 Mongoose로 MongoDB 연결 시도 중...");

      // Mongoose 옵션
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        family: 4, // IPv4 강제
      };

      await mongoose.connect(mongoUrl, options);
      this.isConnected = true;

      // 이벤트 리스너 설정
      this.setupEventListeners();

      logger.success("✅ Mongoose MongoDB 연결 성공");

      // 모든 모델 등록
      await this.registerModels();

      return true;
    } catch (error) {
      logger.error("❌ Mongoose 연결 실패:", error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    mongoose.connection.on("connected", () => {
      logger.info("✅ Mongoose 연결됨");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("❌ Mongoose 연결 오류:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ Mongoose 연결 끊김");
      this.isConnected = false;
    });

    // 프로세스 종료 시 연결 해제
    process.on("SIGINT", this.gracefulShutdown.bind(this));
  }

  /**
   * 모든 모델 등록
   */
  async registerModels() {
    try {
      // 모델 파일들을 불러와서 등록
      const models = {
        Todo: require("./models/Todo"),
        Timer: require("./models/Timer"),
        Worktime: require("./models/Worktime"),
        Leave: require("./models/Leave"),
        Reminder: require("./models/Reminder"),
        UserSetting: require("./models/UserSetting"),
      };

      for (const [name, model] of Object.entries(models)) {
        this.models.set(name, model);
        logger.debug(`📋 모델 등록됨: ${name}`);
      }

      logger.success(`✅ ${this.models.size}개 모델 등록 완료`);
    } catch (error) {
      logger.error("❌ 모델 등록 실패:", error);
      throw error;
    }
  }

  /**
   * 모델 가져오기
   */
  getModel(name) {
    if (!this.models.has(name)) {
      throw new Error(`등록되지 않은 모델: ${name}`);
    }
    return this.models.get(name);
  }

  /**
   * 트랜잭션 실행
   */
  async withTransaction(callback) {
    const session = await mongoose.startSession();
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
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info("✅ Mongoose 연결 종료됨");
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    logger.info("🔄 Graceful shutdown 시작...");
    await this.disconnect();
    process.exit(0);
  }

  /**
   * 상태 정보
   */
  getStatus() {
    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      models: Array.from(this.models.keys()),
      railway: this.isRailway,
    };
  }
}

// 싱글톤 인스턴스 반환
function getInstance() {
  if (!instance) {
    instance = new MongooseManager();
  }
  return instance;
}

module.exports = {
  MongooseManager,
  getInstance,
};
