// src/database/MongoPoolManager.js - MongoDB 연결 풀링 관리자
const { MongoClient } = require("mongodb");
const Logger = require("../utils/Logger");

class MongoPoolManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionString = process.env.MONGO_URL || process.env.MONGODB_URI;

    // ✅ Railway 호환 연결 옵션 (구식 옵션 제거)
    this.poolOptions = {
      maxPoolSize: 10, // 최대 연결 수
      minPoolSize: 2, // 최소 연결 수
      maxIdleTimeMS: 30000, // 30초 후 idle 연결 해제
      serverSelectionTimeoutMS: 5000, // 5초 서버 선택 타임아웃
      socketTimeoutMS: 45000, // 45초 소켓 타임아웃
      connectTimeoutMS: 10000, // 10초 연결 타임아웃
      heartbeatFrequencyMS: 10000, // 10초마다 heartbeat
      // ❌ 제거: bufferMaxEntries - 더 이상 지원되지 않음
      retryWrites: true, // 쓰기 재시도
      retryReads: true, // 읽기 재시도
      family: 4, // IPv4 강제 (Railway 호환성)
    };

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

    Logger.info("🗄️ MongoPoolManager 생성됨");
  }

  // 🔗 데이터베이스 연결 (풀링 포함)
  async connect() {
    if (this.isConnected && this.client) {
      Logger.debug("✅ MongoDB 이미 연결됨");
      return this.db;
    }

    if (!this.connectionString) {
      throw new Error("MongoDB 연결 문자열이 없습니다");
    }

    try {
      Logger.info("🔗 MongoDB 연결 풀 초기화 중...");

      // MongoDB 클라이언트 생성
      const { MongoClient } = require("mongodb");
      this.client = new MongoClient(this.connectionString, this.poolOptions);

      // 연결 시도 (타임아웃 포함)
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("연결 타임아웃")), 10000)
        ),
      ]);

      // 연결 테스트
      await this.client.db("admin").command({ ping: 1 });

      this.db = this.client.db(); // 기본 데이터베이스 사용
      this.isConnected = true;
      this.stats.lastConnected = new Date();

      Logger.success(
        `✅ MongoDB 연결 풀 초기화 완료 (DB: ${this.db.databaseName})`
      );

      // 연결 이벤트 리스너 등록
      this.setupEventListeners();

      return this.db;
    } catch (error) {
      this.isConnected = false;
      Logger.error("❌ MongoDB 연결 실패:", error.message);
      throw error;
    }
  }

  // 📡 이벤트 리스너 설정
  setupEventListeners() {
    if (!this.client) return;

    this.client.on("serverOpening", () => {
      Logger.debug("🔓 MongoDB 서버 연결 열림");
    });

    this.client.on("serverClosed", () => {
      Logger.warn("🔒 MongoDB 서버 연결 닫힘");
    });

    this.client.on("error", (error) => {
      Logger.error("🚨 MongoDB 연결 오류:", error);
      this.isConnected = false;
    });

    this.client.on("timeout", () => {
      Logger.warn("⏰ MongoDB 연결 타임아웃");
    });
  }

  // 📊 연결 상태 확인
  async isHealthy() {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      // 빠른 핑 테스트 (타임아웃 포함)
      const start = Date.now();
      await Promise.race([
        this.client.db("admin").command({ ping: 1 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("핑 타임아웃")), 3000)
        ),
      ]);

      const responseTime = Date.now() - start;
      Logger.debug(`💓 MongoDB 핑: ${responseTime}ms`);
      return responseTime < 2000; // 2초 이내 응답 정상
    } catch (error) {
      Logger.warn("⚠️ MongoDB 상태 확인 실패:", error.message);
      return false;
    }
  }

  // 🔄 자동 재연결
  async reconnect() {
    Logger.info("🔄 MongoDB 재연결 시도...");
    this.stats.reconnectCount++;

    try {
      await this.disconnect();
      await this.connect();
      Logger.success("✅ MongoDB 재연결 성공");
      return true;
    } catch (error) {
      Logger.error("❌ MongoDB 재연결 실패:", error);
      return false;
    }
  }

  // 📋 컬렉션 접근 (안전한 방식)
  async getCollection(name) {
    try {
      if (!this.isConnected || !this.db) {
        await this.connect();
      }

      return this.db.collection(name);
    } catch (error) {
      Logger.error(`❌ 컬렉션 '${name}' 접근 실패:`, error);
      throw new Error(`컬렉션 접근 실패: ${error.message}`);
    }
  }

  // 🔍 통계가 포함된 쿼리 실행
  async executeQuery(collectionName, operation, ...args) {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection[operation](...args);

      // 성공 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, true);

      Logger.debug(
        `✅ Query ${operation} on ${collectionName}: ${queryTime}ms`
      );
      return result;
    } catch (error) {
      // 실패 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, false);

      Logger.error(`❌ Query ${operation} on ${collectionName} 실패:`, error);

      // 연결 문제라면 재연결 시도
      if (this.isConnectionError(error)) {
        Logger.warn("🔄 연결 문제 감지, 재연결 시도...");
        await this.reconnect();

        // 한 번 더 시도
        try {
          const collection = await this.getCollection(collectionName);
          const result = await collection[operation](...args);
          this.stats.successfulQueries++;
          return result;
        } catch (retryError) {
          this.stats.failedQueries++;
          throw retryError;
        }
      }

      this.stats.failedQueries++;
      throw error;
    }
  }

  // 📊 쿼리 통계 업데이트
  updateQueryStats(queryTime, success) {
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    // 응답 시간 추적
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    // 평균 응답 시간 계산
    this.stats.averageResponseTime =
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  // 🔌 연결 오류 판단
  isConnectionError(error) {
    const connectionErrors = [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "MongoNetworkError",
      "MongoTimeoutError",
      "topology was destroyed",
    ];

    return connectionErrors.some(
      (errorType) =>
        error.message?.includes(errorType) || error.name?.includes(errorType)
    );
  }

  // 📈 상태 보고서
  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      poolSize: this.client?.topology?.s?.servers?.size || 0,
      databaseName: this.db?.databaseName || "N/A",
      connectionString:
        this.connectionString?.replace(/\/\/.*@/, "//*****@") || "N/A",
      successRate:
        this.stats.totalQueries > 0
          ? (
              (this.stats.successfulQueries / this.stats.totalQueries) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  // 🧹 연결 종료
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        Logger.info("🔌 MongoDB 연결 종료 중...");
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        Logger.success("✅ MongoDB 연결 종료 완료");
      }
    } catch (error) {
      Logger.error("❌ MongoDB 연결 종료 실패:", error);
    }
  }

  // 🎯 간편한 CRUD 메서드들
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

  // 🔍 인덱스 관리
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
      Logger.error(`❌ 인덱스 생성 실패 (${collectionName}):`, error);
    }
  }

  // 🧼 데이터베이스 정리 (개발용)
  async cleanup() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("프로덕션 환경에서는 cleanup을 실행할 수 없습니다");
    }

    try {
      Logger.warn("🧼 데이터베이스 정리 시작...");
      const collections = await this.db.listCollections().toArray();

      for (const collection of collections) {
        await this.db.collection(collection.name).deleteMany({});
        Logger.debug(`🗑️ 컬렉션 정리됨: ${collection.name}`);
      }

      Logger.success("✅ 데이터베이스 정리 완료");
    } catch (error) {
      Logger.error("❌ 데이터베이스 정리 실패:", error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
const mongoPoolManager = new MongoPoolManager();

module.exports = {
  MongoPoolManager,
  mongoPoolManager, // 기본 인스턴스
};
