// src/database/DatabaseManager.js - 중복 선언 문제 해결
// 표준 매개변수: (bot, callbackQuery, subAction, params, menuManager)

// ✅ 안전한 로거 획득
const getLogger = () => {
  try {
    return require("../utils/Logger");
  } catch {
    return {
      info: (...args) => console.log("[DB-INFO]", ...args),
      error: (...args) => console.error("[DB-ERROR]", ...args),
      warn: (...args) => console.warn("[DB-WARN]", ...args),
      debug: (...args) => console.log("[DB-DEBUG]", ...args),
      success: (...args) => console.log("[DB-SUCCESS]", ...args),
    };
  }
};

const logger = getLogger();

// 기타 안전한 imports
const { MongoClient } = require("mongodb");
const { StandardizedBaseModule } = require("../core/StandardizedSystem");

// 🌍 싱글톤 인스턴스 저장소
let globalDatabaseInstance = null;

class DatabaseManager extends StandardizedBaseModule {
  constructor(mongoUrl = null, options = {}) {
    super("DatabaseManager", {
      priority: 0,
      required: true,
    });

    // 🔒 싱글톤 패턴 적용
    if (globalDatabaseInstance) {
      logger.debug("🔄 기존 DatabaseManager 인스턴스 반환");
      return globalDatabaseInstance;
    }

    this.logger = logger;

    // Railway 환경 감지
    this.isRailwayEnvironment = !!(
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_SERVICE_NAME ||
      process.env.RAILWAY_PROJECT_NAME
    );

    // 연결 설정
    this.mongoUrl =
      mongoUrl || process.env.MONGO_URL || process.env.MONGODB_URL;
    this.databaseName =
      options.databaseName || process.env.DB_NAME || "doomock_bot";

    // 연결 상태
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isShuttingDown = false;

    // 재연결 관련
    this.reconnectInterval = null;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;

    // 풀링 통계
    this.poolStats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      lastConnected: null,
      reconnectCount: 0,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      peakConnections: 0,
      currentConnections: 0,
    };

    // 성능 추적
    this.queryTimes = [];
    this.maxQueryTimeHistory = 100;

    // TimeManager 통합
    this.timeManager = {
      getKoreanTimeString: () => {
        return new Date().toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      },
      formatKoreanTime: (date) => {
        if (!date) return null;
        return new Date(date).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        });
      },
    };

    // 연결 옵션 설정
    this.connectionOptions = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      compressors: ["zlib"],
      zlibCompressionLevel: 6,
      ...options.connectionOptions,
    };

    // 🔒 싱글톤 설정
    globalDatabaseInstance = this;

    logger.info("🎯 DatabaseManager 생성됨 (통합 버전)");
  }

  // 🔌 연결 메서드
  async connect() {
    if (this.isConnected) {
      this.logger.debug("✅ 이미 연결됨");
      return true;
    }

    if (this.isConnecting) {
      this.logger.debug("🔄 연결 진행 중...");
      return this.waitForConnection();
    }

    if (!this.mongoUrl) {
      this.logger.warn("⚠️ MongoDB URL이 설정되지 않음");
      return false;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      this.logger.info(
        `🔌 MongoDB 연결 시도 중... (${this.connectionAttempts}/${this.maxReconnectAttempts})`
      );

      const startTime = Date.now();
      this.client = new MongoClient(this.mongoUrl, this.connectionOptions);
      await this.client.connect();

      this.db = this.client.db(this.databaseName);
      this.isConnected = true;
      this.isConnecting = false;

      const connectTime = Date.now() - startTime;
      this.poolStats.lastConnected = new Date();
      this.poolStats.connectionsCreated++;
      this.poolStats.currentConnections++;
      this.poolStats.peakConnections = Math.max(
        this.poolStats.peakConnections,
        this.poolStats.currentConnections
      );

      this.logger.success(`✅ MongoDB 연결 성공! (${connectTime}ms)`);
      this.logger.info(`📊 데이터베이스: ${this.databaseName}`);

      // 연결 성공 시 재연결 카운터 리셋
      this.connectionAttempts = 0;

      return true;
    } catch (error) {
      this.isConnecting = false;
      this.poolStats.failedQueries++;

      this.logger.error(
        `❌ MongoDB 연결 실패 (${this.connectionAttempts}/${this.maxReconnectAttempts}):`,
        error.message
      );

      if (this.connectionAttempts < this.maxReconnectAttempts) {
        this.logger.info(
          `🔄 ${this.reconnectDelay / 1000}초 후 재연결 시도...`
        );
        await this.sleep(this.reconnectDelay);
        return this.connect();
      } else {
        this.logger.error("💥 최대 재연결 시도 횟수 초과");
        throw error;
      }
    }
  }

  // ⏱️ 연결 대기
  async waitForConnection(timeout = 30000) {
    const startTime = Date.now();

    while (this.isConnecting && Date.now() - startTime < timeout) {
      await this.sleep(100);
    }

    return this.isConnected;
  }

  // 💤 sleep 유틸리티
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 🔌 연결 확인
  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.isConnected) {
      throw new Error("데이터베이스 연결을 설정할 수 없습니다");
    }
  }

  // 🔌 연결 해제
  async disconnect() {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.logger.info("🔌 MongoDB 연결 해제 중...");

    // 재연결 타이머 정리
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    try {
      if (this.client) {
        await this.client.close();
        this.poolStats.connectionsDestroyed++;
        this.poolStats.currentConnections = Math.max(
          0,
          this.poolStats.currentConnections - 1
        );
      }
    } catch (error) {
      this.logger.warn("⚠️ 연결 해제 중 오류:", error.message);
    } finally {
      this.client = null;
      this.db = null;
      this.isConnected = false;
      this.isShuttingDown = false;
      this.logger.success("✅ MongoDB 연결 해제 완료");
    }
  }

  // 🔄 재연결
  async reconnect() {
    this.logger.info("🔄 재연결 시도...");
    await this.disconnect();
    await this.sleep(1000);
    return this.connect();
  }

  // ⚡ 쿼리 실행 (표준 매개변수 준수)
  async executeQuery(collectionName, operation, ...params) {
    await this.ensureConnection();

    const startTime = Date.now();

    try {
      const collection = this.db.collection(collectionName);
      const result = await collection[operation](...params);

      const responseTime = Date.now() - startTime;
      this.updateQueryStats(responseTime, true);

      this.logger.debug(
        `✅ 쿼리 완료: ${collectionName}.${operation} (${responseTime}ms)`
      );
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateQueryStats(responseTime, false);

      this.logger.error(`❌ 쿼리 실패: ${collectionName}.${operation}`, error);
      throw error;
    }
  }

  // 📊 쿼리 통계 업데이트
  updateQueryStats(responseTime, success) {
    this.poolStats.totalQueries++;

    if (success) {
      this.poolStats.successfulQueries++;
    } else {
      this.poolStats.failedQueries++;
    }

    // 응답 시간 추적
    this.queryTimes.push(responseTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    // 평균 응답 시간 계산
    this.poolStats.averageResponseTime = Math.round(
      this.queryTimes.reduce((sum, time) => sum + time, 0) /
        this.queryTimes.length
    );
  }

  // 📋 기본 CRUD 작업들 (표준 매개변수 준수)
  async findOne(collectionName, query = {}, options = {}) {
    return this.executeQuery(collectionName, "findOne", query, options);
  }

  async findMany(collectionName, query = {}, options = {}) {
    const cursor = await this.executeQuery(
      collectionName,
      "find",
      query,
      options
    );
    return cursor.toArray();
  }

  async insertOne(collectionName, document) {
    return this.executeQuery(collectionName, "insertOne", document);
  }

  async insertMany(collectionName, documents) {
    return this.executeQuery(collectionName, "insertMany", documents);
  }

  async updateOne(collectionName, filter, update, options = {}) {
    return this.executeQuery(
      collectionName,
      "updateOne",
      filter,
      update,
      options
    );
  }

  async updateMany(collectionName, filter, update, options = {}) {
    return this.executeQuery(
      collectionName,
      "updateMany",
      filter,
      update,
      options
    );
  }

  async deleteOne(collectionName, filter) {
    return this.executeQuery(collectionName, "deleteOne", filter);
  }

  async deleteMany(collectionName, filter) {
    return this.executeQuery(collectionName, "deleteMany", filter);
  }

  async countDocuments(collectionName, query = {}) {
    return this.executeQuery(collectionName, "countDocuments", query);
  }

  async aggregate(collectionName, pipeline) {
    const cursor = await this.executeQuery(
      collectionName,
      "aggregate",
      pipeline
    );
    return cursor.toArray();
  }

  // 📊 상태 조회 (표준 매개변수 준수)
  getStatus() {
    const successRate =
      this.poolStats.totalQueries > 0
        ? (
            (this.poolStats.successfulQueries / this.poolStats.totalQueries) *
            100
          ).toFixed(2)
        : 0;

    return {
      // 기본 연결 상태
      connected: this.isConnected,
      connecting: this.isConnecting,
      database: this.databaseName,
      railwayDetected: this.isRailwayEnvironment,

      // 재연결 상태
      reconnecting: !!this.reconnectInterval,
      shuttingDown: this.isShuttingDown,
      connectionAttempts: this.connectionAttempts,
      hasClient: !!this.client,

      // 풀링 통계
      poolStats: {
        ...this.poolStats,
        successRate: `${successRate}%`,
        lastConnectedString: this.poolStats.lastConnected
          ? this.timeManager.formatKoreanTime(this.poolStats.lastConnected)
          : null,
        performanceMetrics: {
          averageResponseTime: `${this.poolStats.averageResponseTime}ms`,
          queryHistory: this.queryTimes.length,
          maxHistorySize: this.maxQueryTimeHistory,
        },
      },

      // 환경 정보
      environment: {
        isRailway: this.isRailwayEnvironment,
        nodeEnv: process.env.NODE_ENV,
        mongooseUsed: false, // mongoose 사용 안함 명시
        nativeDriver: true, // 네이티브 드라이버 사용 명시
      },

      // 시스템 정보
      moduleInfo: super.getStatus(),
    };
  }

  // 🧹 정리 작업
  async cleanup() {
    try {
      this.logger.info("🧹 DatabaseManager 정리 작업 시작...");

      await this.disconnect();

      // 통계 초기화
      this.poolStats = {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageResponseTime: 0,
        lastConnected: null,
        reconnectCount: 0,
        connectionsCreated: 0,
        connectionsDestroyed: 0,
        peakConnections: 0,
        currentConnections: 0,
      };

      this.queryTimes = [];

      // 싱글톤 해제
      globalDatabaseInstance = null;

      // 부모 클래스 정리
      await super.cleanup();

      this.logger.success("✅ DatabaseManager 정리 완료");
    } catch (error) {
      this.logger.error("❌ DatabaseManager 정리 중 오류:", error);
    }
  }

  // 📊 성능 리포트
  getPerformanceReport() {
    const stats = this.poolStats;
    const totalConnections = stats.connectionsCreated;
    const activeConnections = stats.currentConnections;

    return {
      connectionHealth: {
        status: this.isConnected ? "healthy" : "disconnected",
        totalQueries: stats.totalQueries,
        successRate:
          stats.totalQueries > 0
            ? `${((stats.successfulQueries / stats.totalQueries) * 100).toFixed(
                2
              )}%`
            : "0%",
        averageResponseTime: `${stats.averageResponseTime}ms`,
      },
      connectionPool: {
        active: activeConnections,
        created: totalConnections,
        destroyed: stats.connectionsDestroyed,
        peak: stats.peakConnections,
        reconnects: stats.reconnectCount,
      },
      environment: {
        railway: this.isRailwayEnvironment,
        database: this.databaseName,
        mongooseDisabled: true,
        nativeDriverOnly: true,
      },
      lastActivity: this.poolStats.lastConnected
        ? this.timeManager.formatKoreanTime(this.poolStats.lastConnected)
        : "없음",
    };
  }
}

// 🌍 싱글톤 팩토리 함수
const createDatabaseManager = (mongoUrl = null, options = {}) => {
  if (globalDatabaseInstance) {
    return globalDatabaseInstance;
  }
  return new DatabaseManager(mongoUrl, options);
};

// ✅ 수정된 export 구조 (중복 선언 제거)
module.exports = {
  DatabaseManager,
  createDatabaseManager,
  // 기본 export를 위한 기본 인스턴스 팩토리
  getInstance: () => globalDatabaseInstance || createDatabaseManager(),
};
