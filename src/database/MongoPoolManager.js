// src/database/MongoPoolManager.js - Railway MongoDB 최적화 + 안전한 Logger 사용

const { MongoClient } = require("mongodb");

// ✅ 안전한 Logger import (무한재귀 방지)
let Logger;
try {
  Logger = require("../utils/Logger");

  // Logger가 제대로 로드되었는지 확인
  if (!Logger || typeof Logger.info !== "function") {
    throw new Error("Logger 함수가 올바르지 않음");
  }

  // 테스트 로그 (순환참조 체크)
  Logger.debug("🔍 Logger 테스트 - MongoPoolManager에서 정상 로드됨");
} catch (loggerError) {
  // 폴백: 안전한 console 래퍼
  console.warn("⚠️ Logger 로드 실패, console 폴백 사용:", loggerError.message);

  Logger = {
    info: (...args) =>
      console.log("[INFO]", new Date().toLocaleString("ko-KR"), ...args),
    error: (...args) =>
      console.error("[ERROR]", new Date().toLocaleString("ko-KR"), ...args),
    warn: (...args) =>
      console.warn("[WARN]", new Date().toLocaleString("ko-KR"), ...args),
    debug: (...args) =>
      console.log("[DEBUG]", new Date().toLocaleString("ko-KR"), ...args),
    success: (...args) =>
      console.log("[SUCCESS]", new Date().toLocaleString("ko-KR"), ...args),
    trace: (...args) =>
      console.log("[TRACE]", new Date().toLocaleString("ko-KR"), ...args),
  };
}

class MongoPoolManager {
  constructor() {
    // 🚫 중복 생성 방지
    if (MongoPoolManager._instance) {
      Logger.warn("⚠️ MongoPoolManager 이미 생성됨, 기존 인스턴스 반환");
      return MongoPoolManager._instance;
    }

    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionString = process.env.MONGO_URL || process.env.MONGODB_URI;

    // 🚂 Railway MongoDB 플러그인 전용 연결 옵션
    this.poolOptions = this.getRailwayOptimizedOptions();

    // 📈 통계 추적
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      lastConnected: null,
      reconnectCount: 0,
    };

    this.queryTimes = [];
    this.maxQueryTimeHistory = 100;

    // 싱글톤 저장
    MongoPoolManager._instance = this;

    // ✅ 안전한 Logger 사용
    Logger.info("🗄️ MongoPoolManager 생성됨 (Railway MongoDB 플러그인 최적화)");
  }

  // 🚂 Railway MongoDB 플러그인에 최적화된 연결 옵션
  getRailwayOptimizedOptions() {
    const isRailwayMongo = this.connectionString?.includes(
      "caboose.proxy.rlwy.net"
    );

    if (isRailwayMongo) {
      Logger.info("🚂 Railway MongoDB 플러그인 감지, 최적화된 설정 적용");

      return {
        // Railway 내부 네트워크 최적화
        maxPoolSize: 5, // Railway MongoDB 플러그인 제한
        minPoolSize: 1, // 최소 연결
        maxIdleTimeMS: 60000, // 1분 유휴 시간 (Railway 내부망)
        serverSelectionTimeoutMS: 10000, // 10초 서버 선택
        socketTimeoutMS: 60000, // 1분 소켓 타임아웃
        connectTimeoutMS: 15000, // 15초 연결 타임아웃
        heartbeatFrequencyMS: 20000, // 20초 하트비트

        // Railway 내부 네트워크는 안정적이므로 재시도 설정 간소화
        retryWrites: true,
        retryReads: true,

        // Railway 환경 특화
        authSource: "admin", // Railway MongoDB 기본 인증
        readPreference: "primary", // 기본 읽기 설정

        // 🚫 제거된 구식 옵션들 (mongoose 아님!)
        // bufferMaxEntries: 제거됨
        // useUnifiedTopology: 기본값
        // useNewUrlParser: 기본값
      };
    } else {
      Logger.info("🌐 외부 MongoDB 서비스 감지, 표준 설정 적용");

      return {
        // 외부 MongoDB Atlas 등을 위한 설정
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,

        retryWrites: true,
        retryReads: true,

        authSource: "admin",
        readPreference: "primary",
      };
    }
  }

  // ✅ 연결 메서드
  async connect() {
    if (this.isConnected) {
      Logger.debug("📋 이미 MongoDB에 연결됨");
      return true;
    }

    if (!this.connectionString) {
      Logger.error("❌ MongoDB 연결 문자열이 없음");
      return false;
    }

    try {
      Logger.info("🔌 MongoDB 연결 시도 중... (네이티브 드라이버)");

      // ✅ MongoDB 네이티브 클라이언트 생성 (mongoose 아님!)
      this.client = new MongoClient(this.connectionString, this.poolOptions);

      await this.client.connect();

      // Railway MongoDB는 일반적으로 'test' 데이터베이스 사용
      const dbName = this.connectionString.includes("caboose.proxy.rlwy.net")
        ? "test"
        : this.connectionString.split("/").pop()?.split("?")[0] || "doomock";

      this.db = this.client.db(dbName);
      this.isConnected = true;
      this.stats.lastConnected = new Date();

      Logger.success(`✅ MongoDB 연결 성공 (${dbName}) - 네이티브 드라이버`);
      return true;
    } catch (error) {
      Logger.error(`❌ MongoDB 연결 실패: ${error.message}`);
      this.isConnected = false;
      return false;
    }
  }

  // ✅ 연결 해제
  async disconnect() {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
      Logger.success("🔌 MongoDB 연결 해제됨");
    } catch (error) {
      Logger.error(`❌ MongoDB 연결 해제 실패: ${error.message}`);
    }
  }

  // ✅ 상태 확인
  async isHealthy() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.db("admin").command({ ismaster: 1 });
      return true;
    } catch (error) {
      Logger.warn(`❌ MongoDB 상태 확인 실패: ${error.message}`);
      return false;
    }
  }

  // ✅ 재연결
  async reconnect() {
    Logger.info("🔄 MongoDB 재연결 시도...");

    if (this.isConnected) {
      await this.disconnect();
    }

    this.stats.reconnectCount++;
    return await this.connect();
  }

  // ✅ 컬렉션 가져오기
  async getCollection(collectionName) {
    if (!this.isConnected || !this.db) {
      throw new Error("MongoDB가 연결되지 않았습니다");
    }
    return this.db.collection(collectionName);
  }

  // ✅ 쿼리 실행
  async executeQuery(collectionName, operation, ...args) {
    const startTime = Date.now();

    try {
      if (!this.isConnected) {
        const reconnected = await this.reconnect();
        if (!reconnected) {
          throw new Error("데이터베이스 재연결 실패");
        }
      }

      const collection = await this.getCollection(collectionName);
      const result = await collection[operation](...args);

      // 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updateStats(queryTime, true);

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.updateStats(queryTime, false);

      Logger.error(
        `❌ 쿼리 실행 실패 (${collectionName}.${operation}): ${error.message}`
      );
      throw error;
    }
  }

  // 통계 업데이트
  updateStats(queryTime, success) {
    this.stats.totalQueries++;
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    if (this.queryTimes.length > 0) {
      this.stats.averageResponseTime =
        this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
    }
  }

  // 연결 문자열 마스킹
  maskConnectionString(connectionString) {
    if (!connectionString) return "N/A";
    return connectionString.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  }

  // 상태 정보
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      dbType: this.connectionString?.includes("caboose.proxy.rlwy.net")
        ? "Railway Plugin"
        : "External",
      databaseName: this.db?.databaseName || "N/A",
      connectionString: this.maskConnectionString(this.connectionString),
      successRate:
        this.stats.totalQueries > 0
          ? (
              (this.stats.successfulQueries / this.stats.totalQueries) *
              100
            ).toFixed(2) + "%"
          : "0%",
      mongooseUsed: false, // ✅ mongoose 사용 안함 명시!
      nativeDriver: true, // ✅ 네이티브 드라이버 사용 명시!
    };
  }

  // ✅ 편의 메서드들 (mongoose 없이 순수 MongoDB)
  async findOne(collectionName, query, options = {}) {
    return this.executeQuery(collectionName, "findOne", query, options);
  }

  async find(collectionName, query, options = {}) {
    const cursor = await this.executeQuery(
      collectionName,
      "find",
      query,
      options
    );
    return cursor.toArray();
  }

  async insertOne(collectionName, document) {
    return this.executeQuery(collectionName, "insertOne", {
      ...document,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateOne(collectionName, filter, update, options = {}) {
    return this.executeQuery(
      collectionName,
      "updateOne",
      filter,
      {
        $set: { ...update, updatedAt: new Date() },
      },
      options
    );
  }

  async deleteOne(collectionName, filter) {
    return this.executeQuery(collectionName, "deleteOne", filter);
  }

  async countDocuments(collectionName, query = {}) {
    return this.executeQuery(collectionName, "countDocuments", query);
  }

  // ✅ 인덱스 관리
  async ensureIndexes(collectionName, indexes) {
    try {
      const collection = await this.getCollection(collectionName);

      for (const index of indexes) {
        await collection.createIndex(index.key, index.options || {});
        Logger.debug(
          `📑 인덱스 생성됨: ${collectionName}.${JSON.stringify(index.key)}`
        );
      }
    } catch (error) {
      Logger.error(`❌ 인덱스 생성 실패 (${collectionName}): ${error.message}`);
    }
  }

  // ✅ 집계 파이프라인 (mongoose 없이)
  async aggregate(collectionName, pipeline) {
    const cursor = await this.executeQuery(
      collectionName,
      "aggregate",
      pipeline
    );
    return cursor.toArray();
  }

  // ✅ 벌크 작업
  async bulkWrite(collectionName, operations) {
    return this.executeQuery(collectionName, "bulkWrite", operations);
  }

  // ✅ 트랜잭션 지원 (mongoose 없이)
  async withTransaction(callback) {
    if (!this.isConnected) {
      throw new Error("MongoDB가 연결되지 않았습니다");
    }

    const session = this.client.startSession();

    try {
      return await session.withTransaction(async () => {
        return await callback(session);
      });
    } finally {
      await session.endSession();
    }
  }

  // 🧹 정리 작업
  async cleanup() {
    try {
      Logger.info("🧹 MongoPoolManager 정리 작업 시작...");

      await this.disconnect();

      // 통계 초기화
      this.stats = {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageResponseTime: 0,
        lastConnected: null,
        reconnectCount: 0,
      };

      this.queryTimes = [];

      Logger.success("✅ MongoPoolManager 정리 완료");
    } catch (error) {
      Logger.error("❌ MongoPoolManager 정리 중 오류:", error);
    }
  }
}

// ✅ 싱글톤 인스턴스 생성
const mongoPoolManager = new MongoPoolManager();

// ✅ 모듈 내보내기 (mongoose 없음!)
module.exports = {
  MongoPoolManager,
  mongoPoolManager,
};
