// src/database/MongooseManager.js - isConnected() 메서드 추가 수정
const mongoose = require("mongoose");
const logger = require("../utils/core/Logger");

let instance = null;

class MongooseManager {
  constructor() {
    if (instance) {
      return instance;
    }

    this._isConnected = false; // ✅ 변수명 변경
    this.models = new Map();
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    instance = this;
  }

  /**
   * MongoDB 연결
   */
  async connect() {
    if (this._isConnected) {
      // ✅ 변경
      logger.debug("이미 Mongoose로 연결됨");
      return true;
    }

    try {
      const mongoUrl = process.env.MONGO_URL;
      if (!mongoUrl) {
        throw new Error("MONGO_URL 환경변수가 설정되지 않음");
      }

      logger.info("🔌 Mongoose로 MongoDB 연결 시도 중...");

      // Mongoose 옵션 (Railway 환경 고려)
      const options = {
        // 연결 풀링 최적화
        maxPoolSize: this.isRailway ? 5 : 10,    // Railway에서는 연결 수 제한
        minPoolSize: this.isRailway ? 1 : 2,     // 최소 연결 유지
        maxIdleTimeMS: 30000,                     // 유휴 연결 타임아웃
        
        // 타임아웃 최적화
        serverSelectionTimeoutMS: this.isRailway ? 10000 : 5000,
        socketTimeoutMS: this.isRailway ? 45000 : 30000,
        connectTimeoutMS: this.isRailway ? 10000 : 5000,
        
        // 재연결 및 안정성 (Mongoose 6+ 호환)
        heartbeatFrequencyMS: 10000,              // 하트비트 빈도
        
        // 네트워크 최적화 (Mongoose 호환)
        family: 4                                 // IPv4 강제
      };

      await mongoose.connect(mongoUrl, options);
      this._isConnected = true; // ✅ 변경

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
      this._isConnected = false; // ✅ 변경
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
        TimerStats: require("./models/TimerStats"),
        TimerSettings: require("./models/TimerSettings"),
        Worktime: require("./models/Worktime"),
        Leave: require("./models/Leave"),
        UserLeaveSetting: require("./models/UserLeaveSetting"),
        Reminder: require("./models/Reminder"),
        UserSetting: require("./models/UserSetting"),
        TTSHistory: require("./models/TTSHistory"),
        Fortune: require("./models/Fortune").FortuneUser // Fortune을 Fortune으로 등록
      };

      for (const [name, model] of Object.entries(models)) {
        // 모델이 존재하는지 확인
        if (!model) {
          logger.warn(`⚠️ 모델이 존재하지 않음: ${name}`);
          continue;
        }

        this.models.set(name, model);
        logger.debug(`📋 모델 등록됨: ${name}`);
      }

      logger.success(`✅ ${this.models.size}개 모델 등록 완료`);

      // 등록된 모델 목록 확인용 로그 (중요!)
      logger.debug("📋 등록된 모델 목록:", Array.from(this.models.keys()));
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
   * 🔍 연결 상태 확인 (메서드로 추가!) - 핵심 수정!
   */
  isConnected() {
    return this._isConnected && mongoose.connection.readyState === 1; // ✅ 변경
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
      this._isConnected = false; // ✅ 변경
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
      railway: this.isRailway
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
  getInstance
};
