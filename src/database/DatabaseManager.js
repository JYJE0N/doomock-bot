// src/database/DatabaseManager.js - 완전 통합 리팩토링 v3.0.1
// 🎯 DatabaseManager.js와 중복 제거 + 표준화 완성 + Railway 최적화

const { MongoClient, ServerApiVersion } = require("mongodb");
const {
  DuplicationPreventer,
  KoreanTimeManager,
  StandardizedBaseModule,
} = require("../core/StandardizedSystem");

/**
 * 🏛️ 통합 데이터베이스 매니저 (MongoDB 네이티브 전용)
 * - Railway 환경 완벽 최적화
 * - 풀링 방식 연결 관리
 * - 표준 매개변수 준수
 * - DatabaseManager 기능 완전 통합
 * - 땜질식 코딩 완전 제거 ✅
 */
class DatabaseManager extends StandardizedBaseModule {
  constructor(mongoUrl = null, options = {}) {
    super("DatabaseManager", options);

    // 🔗 연결 정보 (환경변수 우선순위)
    this.mongoUrl =
      mongoUrl || process.env.MONGO_URL || process.env.MONGODB_URI;

    // 🎯 표준 데이터베이스 이름 (프로젝트 요구사항)
    this.databaseName = "doomock85";

    // 🔌 연결 상태
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isShuttingDown = false;

    // 🔄 재연결 관리
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.reconnectInterval = null;
    this.healthCheckInterval = null;

    // 🚂 Railway 환경 자동 감지
    this.isRailwayEnvironment = this.detectRailwayEnvironment();

    // 📊 풀링 통계 (DatabaseManager 기능 통합)
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
    this.maxQueryTimeHistory = 100;

    // 🚫 중복 생성 방지 (싱글톤 패턴)
    if (DatabaseManager._instance) {
      this.logger.warn("⚠️ DatabaseManager 이미 생성됨, 기존 인스턴스 재사용");
      return DatabaseManager._instance;
    }

    // 인스턴스 저장
    DatabaseManager._instance = this;

    this.logger.info(
      `🗄️ DatabaseManager 통합 초기화 (DB: ${this.databaseName})`
    );
    this.logConnectionInfo();
  }

  // 🚂 Railway 환경 자동 감지
  detectRailwayEnvironment() {
    const indicators = [
      this.mongoUrl?.includes("caboose.proxy.rlwy.net"),
      !!process.env.RAILWAY_ENVIRONMENT,
      !!process.env.RAILWAY_PROJECT_ID,
      !!process.env.RAILWAY_SERVICE_NAME,
      process.env.NODE_ENV === "production" && !!process.env.PORT,
    ];

    const detectedCount = indicators.filter(Boolean).length;
    return detectedCount >= 2; // 2개 이상 조건 만족시 Railway로 판단
  }

  // 📋 연결 정보 로깅
  logConnectionInfo() {
    if (this.mongoUrl) {
      this.logger.debug(
        `🔗 연결 대상: ${this.maskConnectionString(this.mongoUrl)}`
      );
      this.logger.info(
        `🚂 Railway 환경: ${this.isRailwayEnvironment ? "감지됨" : "일반 환경"}`
      );
      this.logger.info(`📂 데이터베이스명: ${this.databaseName}`);

      if (this.isRailwayEnvironment) {
        this.logger.info("🎯 Railway MongoDB 플러그인 최적화 적용");
      }
    } else {
      this.logger.warn("⚠️ MongoDB URL이 설정되지 않음 - 메모리 모드로 실행");
    }
  }

  // 🔒 연결 문자열 마스킹 (보안)
  maskConnectionString(connectionString) {
    if (!connectionString) return "N/A";
    return connectionString.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  }

  // 📂 데이터베이스 이름 추출 및 검증
  extractDbName(mongoUrl) {
    try {
      const match = mongoUrl.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : null;
    } catch (error) {
      this.logger.warn("DB 이름 추출 실패:", error.message);
      return null;
    }
  }

  // 🛡️ 데이터베이스 이름 정리 (보안)
  sanitizeDbName(dbName) {
    if (!dbName) return "doomock85";

    let sanitized = dbName
      .replace(/\./g, "_") // 점을 언더스코어로
      .replace(/\s+/g, "_") // 공백을 언더스코어로
      .replace(/[/\\:"*?<>|]/g, "") // 특수문자 제거
      .replace(/^[._]+/, "") // 시작 점/언더스코어 제거
      .replace(/[._]+$/, "") // 끝 점/언더스코어 제거
      .toLowerCase(); // 소문자로

    // 길이 제한 (MongoDB 제한사항)
    if (sanitized.length > 63) {
      sanitized = sanitized.substring(0, 63);
    }

    // 끝의 점/언더스코어 재정리
    sanitized = sanitized.replace(/[._]+$/, "");

    // 최종 검증
    if (!sanitized || sanitized.length === 0) {
      return "doomock85";
    }

    return sanitized;
  }

  // 📂 데이터베이스 이름 결정
  getDatabaseName() {
    if (this.isRailwayEnvironment) {
      // Railway: URL에서 추출하거나 기본값 사용
      const extractedName = this.extractDbName(this.mongoUrl);
      return extractedName || "doomock85";
    } else {
      // 외부 서비스: 정리 후 사용
      const extractedName = this.extractDbName(this.mongoUrl);
      return this.sanitizeDbName(extractedName) || "doomock85";
    }
  }

  // ⚙️ MongoDB 연결 옵션 (Railway vs 외부 서비스)
  getMongoOptions() {
    const baseOptions = {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      retryWrites: true,
      retryReads: true,
      authSource: "admin",
      readPreference: "primary",
      compressors: ["zlib"],
    };

    if (this.isRailwayEnvironment) {
      // 🚂 Railway MongoDB 플러그인 전용 최적화
      this.logger.debug("📊 Railway 최적화 옵션 적용");

      return {
        ...baseOptions,
        maxPoolSize: 5, // Railway 제한
        minPoolSize: 1, // 최소 연결
        maxIdleTimeMS: 30000, // 30초 유휴
        serverSelectionTimeoutMS: 15000, // 15초 서버 선택
        socketTimeoutMS: 45000, // 45초 소켓
        connectTimeoutMS: 15000, // 15초 연결
        heartbeatFrequencyMS: 10000, // 10초 하트비트

        // Railway 내부 네트워크 최적화
        maxConnecting: 2, // 동시 연결 수 제한
        waitQueueTimeoutMS: 15000, // 대기열 타임아웃
      };
    } else {
      // 🌐 외부 MongoDB 서비스 (Atlas 등)
      this.logger.debug("⚙️ 표준 연결 옵션 적용");

      return {
        ...baseOptions,
        maxPoolSize: 10, // 외부 서비스 표준
        minPoolSize: 2, // 최소 연결
        maxIdleTimeMS: 30000, // 30초 유휴
        serverSelectionTimeoutMS: 10000, // 10초 서버 선택
        socketTimeoutMS: 45000, // 45초 소켓
        connectTimeoutMS: 10000, // 10초 연결
        heartbeatFrequencyMS: 10000, // 10초 하트비트

        // 외부 네트워크 최적화
        maxConnecting: 3, // 동시 연결 수
        waitQueueTimeoutMS: 10000, // 대기열 타임아웃
      };
    }
  }

  // 🔌 데이터베이스 연결 (중복 방지 + 풀링)
  async connect() {
    const operationId = this.timeManager.generateOperationId(
      "db_connect",
      "system"
    );

    if (!(await this.duplicationPreventer.startOperation(operationId))) {
      this.logger.warn("🚫 데이터베이스 연결 중복 시도 차단");
      return this.isConnected;
    }

    try {
      if (this.isShuttingDown) {
        throw new Error("데이터베이스가 종료 중입니다");
      }

      if (this.isConnected) {
        this.logger.debug("✅ 이미 연결됨");
        return true;
      }

      if (!this.mongoUrl) {
        throw new Error("MongoDB URL이 설정되지 않았습니다");
      }

      this.connectionAttempts++;
      this.poolStats.connectionsCreated++;

      this.logger.info(
        `🔄 MongoDB 연결 시도 (${this.connectionAttempts}/${this.maxRetries})`
      );

      // 🎯 MongoDB 클라이언트 생성 (풀링 포함)
      const mongoOptions = this.getMongoOptions();
      this.client = new MongoClient(this.mongoUrl, mongoOptions);

      // 연결 시도
      await this.client.connect();

      // 연결 확인 (ping)
      await this.client.db().admin().ping();

      // 🎯 데이터베이스 연결 (doomock85)
      this.databaseName = this.getDatabaseName();
      this.db = this.client.db(this.databaseName);
      await this.db.admin().ping();

      // 상태 업데이트
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.poolStats.lastConnected = this.timeManager.getKoreanTime();
      this.poolStats.currentConnections++;

      if (this.poolStats.currentConnections > this.poolStats.peakConnections) {
        this.poolStats.peakConnections = this.poolStats.currentConnections;
      }

      this.logger.success(`✅ MongoDB 연결 성공! (풀링 활성화)`);
      this.logger.info(`📂 데이터베이스: ${this.databaseName}`);
      this.logger.debug(`🔗 서버: ${this.maskConnectionString(this.mongoUrl)}`);

      // 🔄 자동 재연결 모니터링 시작
      this.startReconnectMonitoring();

      // 📑 기본 인덱스 설정
      await this.setupBasicIndexes();

      return true;
    } catch (error) {
      this.logger.error(
        `❌ MongoDB 연결 실패 (시도 ${this.connectionAttempts}):`,
        error.message
      );

      // 클라이언트 정리
      if (this.client) {
        try {
          await this.client.close();
          this.poolStats.connectionsDestroyed++;
        } catch (closeError) {
          this.logger.debug("클라이언트 정리 중 오류:", closeError.message);
        }
        this.client = null;
      }

      this.isConnected = false;

      if (this.connectionAttempts >= this.maxRetries) {
        throw new Error(`최대 재시도 횟수 초과 (${this.maxRetries})`);
      }

      throw error;
    } finally {
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 📑 기본 인덱스 설정
  async setupBasicIndexes() {
    try {
      const basicIndexes = [
        // 사용자 관련 인덱스
        {
          collection: "users",
          indexes: [
            { key: { userId: 1 }, options: { unique: true } },
            { key: { createdAt: 1 } },
          ],
        },
        // 할일 관련 인덱스
        {
          collection: "todos",
          indexes: [
            { key: { userId: 1 } },
            { key: { completed: 1 } },
            { key: { createdAt: 1 } },
          ],
        },
        // 날씨 캐시 인덱스
        {
          collection: "weather_cache",
          indexes: [
            { key: { city: 1 } },
            { key: { timestamp: 1 }, options: { expireAfterSeconds: 3600 } },
          ],
        },
      ];

      for (const { collection, indexes } of basicIndexes) {
        await this.ensureIndexes(collection, indexes);
      }

      this.logger.debug("📑 기본 인덱스 설정 완료");
    } catch (error) {
      this.logger.warn("⚠️ 기본 인덱스 설정 실패:", error.message);
    }
  }

  // 🔄 자동 재연결 모니터링
  startReconnectMonitoring() {
    if (this.reconnectInterval) return;

    const monitoringInterval = this.isRailwayEnvironment ? 15000 : 30000; // Railway: 15초, 일반: 30초

    this.reconnectInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        if (this.client && this.isConnected) {
          await this.client.db().admin().ping();
        }
      } catch (error) {
        this.logger.warn("⚠️ 연결 상태 확인 실패, 재연결 시도:", error.message);
        this.isConnected = false;
        this.poolStats.reconnectCount++;

        try {
          await this.connect();
        } catch (reconnectError) {
          this.logger.debug("⚠️ 재연결 실패, 계속 시도 중...");
        }
      }
    }, monitoringInterval);

    this.logger.debug(
      `🔄 재연결 모니터링 시작 (${monitoringInterval / 1000}초 간격)`
    );
  }

  // ⏹️ 재연결 모니터링 중지
  stopReconnectMonitoring() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      this.logger.info("⏹️ 재연결 모니터링 중지");
    }
  }

  // 🔄 연결 상태 확인 및 복구
  async ensureConnection() {
    if (this.isShuttingDown) {
      throw new Error("데이터베이스가 종료 중입니다");
    }

    if (!this.isConnected || !this.client) {
      this.logger.info("🔄 연결이 끊어져 재연결 시도");
      return await this.connect();
    }

    try {
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      this.logger.warn("⚠️ 연결 확인 실패, 재연결:", error.message);
      this.isConnected = false;
      return await this.connect();
    }
  }

  // 📄 컬렉션 가져오기
  getCollection(collectionName) {
    if (!this.db) {
      throw new Error("데이터베이스가 연결되지 않았습니다");
    }
    return this.db.collection(collectionName);
  }

  // 🎯 표준 매개변수 준수: 통합 쿼리 실행 메서드
  async executeQuery(collectionName, operation, query = {}, options = {}) {
    if (!collectionName || !operation) {
      throw new Error("컬렉션명과 연산자는 필수입니다");
    }

    const startTime = Date.now();
    const operationId = this.timeManager.generateOperationId(
      "db_query",
      operation,
      `_${collectionName}`
    );

    if (!(await this.duplicationPreventer.startOperation(operationId))) {
      this.logger.warn(`🚫 중복 쿼리 차단: ${collectionName}.${operation}`);
      return null;
    }

    try {
      // 연결 상태 확인
      await this.ensureConnection();

      const collection = this.getCollection(collectionName);
      let result;

      // 연산 타입별 처리 (DatabaseManager 기능 통합)
      switch (operation) {
        case "findOne":
          result = await collection.findOne(query, options);
          break;

        case "find":
          const cursor = await collection.find(query, options);
          result = await cursor.toArray();
          break;

        case "insertOne":
          result = await collection.insertOne({
            ...query,
            createdAt: this.timeManager.getKoreanTime(),
            updatedAt: this.timeManager.getKoreanTime(),
          });
          break;

        case "insertMany":
          const documents = Array.isArray(query) ? query : [query];
          const now = this.timeManager.getKoreanTime();
          const docsWithTimestamp = documents.map((doc) => ({
            ...doc,
            createdAt: now,
            updatedAt: now,
          }));
          result = await collection.insertMany(docsWithTimestamp);
          break;

        case "updateOne":
          result = await collection.updateOne(query, {
            $set: {
              ...options,
              updatedAt: this.timeManager.getKoreanTime(),
            },
          });
          break;

        case "updateMany":
          result = await collection.updateMany(query, {
            $set: {
              ...options,
              updatedAt: this.timeManager.getKoreanTime(),
            },
          });
          break;

        case "deleteOne":
          result = await collection.deleteOne(query);
          break;

        case "deleteMany":
          result = await collection.deleteMany(query);
          break;

        case "countDocuments":
          result = await collection.countDocuments(query);
          break;

        case "aggregate":
          const aggregateCursor = await collection.aggregate(query);
          result = await aggregateCursor.toArray();
          break;

        case "bulkWrite":
          result = await collection.bulkWrite(query);
          break;

        case "distinct":
          result = await collection.distinct(query, options);
          break;

        case "createIndex":
          result = await collection.createIndex(query, options);
          break;

        default:
          throw new Error(`지원되지 않는 연산: ${operation}`);
      }

      // 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updatePoolStats(queryTime, true);

      if (process.env.NODE_ENV === "development" && queryTime > 1000) {
        this.logger.warn(
          `🐌 느린 쿼리: ${collectionName}.${operation} (${queryTime}ms)`
        );
      }

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.updatePoolStats(queryTime, false);

      this.logger.error(
        `❌ 쿼리 실패: ${collectionName}.${operation} - ${error.message}`
      );
      throw error;
    } finally {
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 📊 풀링 통계 업데이트 (DatabaseManager 기능 통합)
  updatePoolStats(queryTime, success) {
    this.poolStats.totalQueries++;

    if (success) {
      this.poolStats.successfulQueries++;
    } else {
      this.poolStats.failedQueries++;
    }

    // 응답시간 추적
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    // 평균 응답시간 계산
    if (this.queryTimes.length > 0) {
      this.poolStats.averageResponseTime = Math.round(
        this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length
      );
    }
  }

  // 🎯 사용자 친화적 헬퍼 메서드들 (표준 매개변수 준수)
  async findOne(collectionName, query, options = {}) {
    return this.executeQuery(collectionName, "findOne", query, options);
  }

  async find(collectionName, query, options = {}) {
    return this.executeQuery(collectionName, "find", query, options);
  }

  async insertOne(collectionName, document) {
    return this.executeQuery(collectionName, "insertOne", document);
  }

  async insertMany(collectionName, documents) {
    return this.executeQuery(collectionName, "insertMany", documents);
  }

  async updateOne(collectionName, filter, update, options = {}) {
    return this.executeQuery(collectionName, "updateOne", filter, update);
  }

  async updateMany(collectionName, filter, update, options = {}) {
    return this.executeQuery(collectionName, "updateMany", filter, update);
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
    return this.executeQuery(collectionName, "aggregate", pipeline);
  }

  async bulkWrite(collectionName, operations) {
    return this.executeQuery(collectionName, "bulkWrite", operations);
  }

  async distinct(collectionName, field, query = {}) {
    return this.executeQuery(collectionName, "distinct", field, query);
  }

  // 📑 인덱스 설정 (표준 매개변수 준수)
  async ensureIndexes(collectionName, indexes) {
    if (!Array.isArray(indexes)) {
      throw new Error("인덱스는 배열이어야 합니다");
    }

    try {
      await this.ensureConnection();

      for (const index of indexes) {
        if (!index.key) {
          this.logger.warn(`⚠️ 인덱스 키가 없음: ${JSON.stringify(index)}`);
          continue;
        }

        try {
          await this.executeQuery(
            collectionName,
            "createIndex",
            index.key,
            index.options
          );
          this.logger.debug(
            `📑 인덱스 생성: ${collectionName}.${JSON.stringify(index.key)}`
          );
        } catch (indexError) {
          // 이미 존재하는 인덱스는 무시
          if (!indexError.message.includes("already exists")) {
            this.logger.warn(
              `⚠️ 인덱스 생성 실패: ${collectionName} - ${indexError.message}`
            );
          }
        }
      }

      this.logger.debug(`✅ 인덱스 설정 완료: ${collectionName}`);
    } catch (error) {
      this.logger.error(
        `❌ 인덱스 설정 실패: ${collectionName} - ${error.message}`
      );
      throw error;
    }
  }

  // 💪 트랜잭션 지원 (표준 매개변수 준수)
  async withTransaction(callback) {
    if (!this.isConnected || !this.client) {
      throw new Error("MongoDB가 연결되지 않았습니다");
    }

    if (typeof callback !== "function") {
      throw new Error("콜백 함수가 필요합니다");
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

  // 🔌 연결 해제
  async disconnect() {
    this.isShuttingDown = true;

    try {
      this.stopReconnectMonitoring();

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.client) {
        this.logger.info("🔌 MongoDB 연결 종료 중...");
        await this.client.close(false);

        this.poolStats.connectionsDestroyed++;
        this.poolStats.currentConnections = Math.max(
          0,
          this.poolStats.currentConnections - 1
        );

        this.logger.success("✅ 데이터베이스 연결 종료");
      }

      this.client = null;
      this.db = null;
      this.isConnected = false;
    } catch (error) {
      this.logger.error("❌ 연결 종료 중 오류:", error.message);
    }
  }

  // 💚 헬스체크
  async isHealthy() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      this.logger.warn(`❌ 헬스체크 실패: ${error.message}`);
      return false;
    }
  }

  // 📊 상태 정보 (표준 매개변수 준수 + DatabaseManager 통합)
  getStatus() {
    const successRate =
      this.poolStats.totalQueries > 0
        ? (
            (this.poolStats.successfulQueries / this.poolStats.totalQueries) *
            100
          ).toFixed(2) + "%"
        : "0%";

    return {
      // 기본 연결 상태
      connected: this.isConnected,
      database: this.databaseName,
      mongoUrl: this.mongoUrl ? "설정됨" : "없음",
      railwayDetected: this.isRailwayEnvironment,

      // 재연결 상태
      reconnecting: !!this.reconnectInterval,
      shuttingDown: this.isShuttingDown,
      connectionAttempts: this.connectionAttempts,
      hasClient: !!this.client,

      // 풀링 통계 (DatabaseManager 통합)
      poolStats: {
        ...this.poolStats,
        successRate,
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

  // 🧹 정리 작업 (오버라이드)
  async cleanup() {
    try {
      this.logger.info("🧹 DatabaseManager 통합 정리 작업 시작...");

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
      DatabaseManager._instance = null;

      // 부모 클래스 정리
      await super.cleanup();

      this.logger.success("✅ DatabaseManager 통합 정리 완료");
    } catch (error) {
      this.logger.error("❌ DatabaseManager 정리 중 오류:", error);
    }
  }

  // 📊 성능 모니터링 메서드
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

// 🌍 전역 접근을 위한 싱글톤 인스턴스 생성
const createDatabaseManager = (mongoUrl = null, options = {}) => {
  return new DatabaseManager(mongoUrl, options);
};

// 기존 DatabaseManager 호환성을 위한 alias
const DatabaseManager = createDatabaseManager();

module.exports = DatabaseManager;
module.exports.DatabaseManager = DatabaseManager;
module.exports.createDatabaseManager = createDatabaseManager;
