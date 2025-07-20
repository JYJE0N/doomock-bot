// src/database/MongoPoolManager.js - Railway MongoDB 플러그인 전용 버전

const { MongoClient } = require("mongodb");
const Logger = require("../utils/Logger");

class MongoPoolManager {
  constructor() {
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

        // 🚫 제거된 구식 옵션들
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
        family: 4, // IPv4 강제
      };
    }
  }

  // 🔗 Railway 환경에 최적화된 연결 메서드
  async connect() {
    if (this.isConnected && this.client) {
      Logger.debug("✅ MongoDB 이미 연결되어 있음");
      return this.db;
    }

    if (!this.connectionString) {
      throw new Error(
        "MongoDB 연결 문자열이 없습니다 (MONGO_URL 또는 MONGODB_URI 필요)"
      );
    }

    try {
      Logger.info("🔗 Railway MongoDB 연결 시작...");
      Logger.debug(
        `🔌 연결 대상: ${this.maskConnectionString(this.connectionString)}`
      );

      // 기존 연결이 있다면 정리
      if (this.client) {
        await this.disconnect();
      }

      // Railway MongoDB 플러그인 연결 생성
      this.client = new MongoClient(this.connectionString, this.poolOptions);

      // 연결 시도 (Railway 환경 최적화된 타임아웃)
      const connectionTimeout = this.connectionString.includes(
        "caboose.proxy.rlwy.net"
      )
        ? 15000
        : 10000;

      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `MongoDB 연결 타임아웃 (${connectionTimeout / 1000}초)`
                )
              ),
            connectionTimeout
          )
        ),
      ]);

      // 연결 테스트
      await this.client.db("admin").command({ ping: 1 });

      // 데이터베이스 선택 (Railway는 보통 기본 DB 사용)
      this.db = this.client.db(); // 기본 데이터베이스 사용
      this.isConnected = true;
      this.stats.lastConnected = new Date();

      Logger.success(`✅ Railway MongoDB 연결 완료!`);
      Logger.info(`📊 DB 이름: ${this.db.databaseName}`);
      Logger.info(`🔗 풀 크기: ${this.poolOptions.maxPoolSize}`);

      // 연결 이벤트 리스너 등록
      this.setupEventListeners();

      return this.db;
    } catch (error) {
      this.isConnected = false;
      Logger.error("❌ Railway MongoDB 연결 실패:", error.message);

      // Railway 환경별 구체적인 오류 메시지
      if (error.message.includes("ENOTFOUND")) {
        throw new Error(
          "Railway MongoDB 호스트를 찾을 수 없습니다. Railway MongoDB 플러그인이 활성화되어 있는지 확인하세요."
        );
      } else if (error.message.includes("ECONNREFUSED")) {
        throw new Error(
          "Railway MongoDB 서버에 연결할 수 없습니다. 서비스가 실행 중인지 확인하세요."
        );
      } else if (error.message.includes("Authentication failed")) {
        throw new Error(
          "Railway MongoDB 인증에 실패했습니다. 환경변수 MONGO_URL을 확인하세요."
        );
      } else if (error.message.includes("timeout")) {
        throw new Error(
          "Railway MongoDB 연결 시간이 초과되었습니다. 네트워크 상태를 확인하세요."
        );
      } else {
        throw error;
      }
    }
  }

  // 🔒 연결 문자열 마스킹 (보안)
  maskConnectionString(connectionString) {
    if (!connectionString) return "N/A";

    try {
      // mongodb://username:password@host:port/database 형식에서 패스워드 마스킹
      return connectionString.replace(/:([^:@]+)@/, ":****@");
    } catch (error) {
      return "[MASKED]";
    }
  }

  // 📡 Railway 환경 최적화된 이벤트 리스너
  setupEventListeners() {
    if (!this.client) return;

    this.client.on("serverOpening", () => {
      Logger.debug("🔓 Railway MongoDB 서버 연결 열림");
    });

    this.client.on("serverClosed", () => {
      Logger.warn("🔒 Railway MongoDB 서버 연결 닫힘");
      this.isConnected = false;
    });

    this.client.on("error", (error) => {
      Logger.error("🚨 Railway MongoDB 연결 오류:", error.message);
      this.isConnected = false;
    });

    this.client.on("timeout", () => {
      Logger.warn("⏰ Railway MongoDB 연결 타임아웃");
    });

    this.client.on("close", () => {
      Logger.info("🔌 Railway MongoDB 연결 닫힘");
      this.isConnected = false;
    });

    // Railway 환경에서 연결 풀 모니터링
    this.client.on("connectionPoolCreated", () => {
      Logger.debug("🏊‍♂️ Railway MongoDB 연결 풀 생성됨");
    });

    this.client.on("connectionPoolClosed", () => {
      Logger.debug("🏊‍♂️ Railway MongoDB 연결 풀 닫힘");
    });
  }

  // 📊 Railway 환경 최적화된 연결 상태 확인
  async isHealthy() {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      // Railway 내부 네트워크는 빠르므로 짧은 타임아웃
      const pingTimeout = this.connectionString.includes(
        "caboose.proxy.rlwy.net"
      )
        ? 5000
        : 3000;

      const start = Date.now();
      await Promise.race([
        this.client.db("admin").command({ ping: 1 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("핑 타임아웃")), pingTimeout)
        ),
      ]);

      const responseTime = Date.now() - start;
      Logger.debug(`💓 Railway MongoDB 핑: ${responseTime}ms`);

      // Railway 내부망은 더 관대한 기준 적용
      const healthyThreshold = this.connectionString.includes(
        "caboose.proxy.rlwy.net"
      )
        ? 3000
        : 2000;
      return responseTime < healthyThreshold;
    } catch (error) {
      Logger.warn("⚠️ Railway MongoDB 상태 확인 실패:", error.message);
      this.isConnected = false;
      return false;
    }
  }

  // 🔄 Railway 환경 최적화된 재연결
  async reconnect() {
    Logger.info("🔄 Railway MongoDB 재연결 시도...");
    this.stats.reconnectCount++;

    try {
      await this.disconnect();

      // Railway 환경에서는 짧은 대기 후 재연결
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.connect();
      Logger.success("✅ Railway MongoDB 재연결 성공");
      return true;
    } catch (error) {
      Logger.error("❌ Railway MongoDB 재연결 실패:", error.message);
      return false;
    }
  }

  // 나머지 메서드들은 기존과 동일하게 유지...
  async getCollection(name) {
    try {
      if (!this.isConnected || !this.db) {
        await this.connect();
      }
      return this.db.collection(name);
    } catch (error) {
      Logger.error(`❌ 컬렉션 '${name}' 접근 실패:`, error.message);
      throw new Error(`컬렉션 접근 실패: ${error.message}`);
    }
  }

  async executeQuery(collectionName, operation, ...args) {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection[operation](...args);

      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, true);

      Logger.debug(
        `✅ Query ${operation} on ${collectionName}: ${queryTime}ms`
      );
      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, false);

      Logger.error(
        `❌ Query ${operation} on ${collectionName} 실패:`,
        error.message
      );

      // 연결 문제라면 재연결 시도
      if (this.isConnectionError(error)) {
        Logger.warn("🔄 연결 문제 감지, 재연결 시도...");
        try {
          await this.reconnect();
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

  updateQueryStats(queryTime, success) {
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    this.stats.averageResponseTime =
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  isConnectionError(error) {
    const connectionErrors = [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "MongoNetworkError",
      "MongoTimeoutError",
      "topology was destroyed",
      "connection closed",
      "server closed",
    ];

    return connectionErrors.some(
      (errorType) =>
        error.message?.includes(errorType) || error.name?.includes(errorType)
    );
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        Logger.info("🔌 Railway MongoDB 연결 종료 중...");
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        Logger.success("✅ Railway MongoDB 연결 종료 완료");
      }
    } catch (error) {
      Logger.error("❌ Railway MongoDB 연결 종료 실패:", error.message);
    }
  }

  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      connectionType: this.connectionString?.includes("caboose.proxy.rlwy.net")
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
    };
  }

  // 편의 메서드들...
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
      Logger.error(`❌ 인덱스 생성 실패 (${collectionName}):`, error.message);
    }
  }
}

// 싱글톤 인스턴스 생성
const mongoPoolManager = new MongoPoolManager();

module.exports = {
  MongoPoolManager,
  mongoPoolManager,
};
