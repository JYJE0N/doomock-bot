// ===== 3. src/database/DatabaseManager.js - 간결한 연결 관리자 =====
const logger = require("../utils/Logger");
const { MongoClient } = require("mongodb");
const { SchemaManager } = require("./schemas/StandardSchema");

let globalInstance = null;

/**
 * 🗄️ DatabaseManager v3.0.1 - 간결한 연결 관리
 *
 * 🎯 핵심 역할:
 * 1. MongoDB 연결 관리 (연결/재연결/해제)
 * 2. 컬렉션 인스턴스 제공
 * 3. 트랜잭션 실행 환경 제공
 * 4. SchemaManager와 느슨한 결합
 *
 * 🌟 특징:
 * - AppConfig에서 모든 설정 받음
 * - SchemaManager 선택적 활용
 * - 최소한의 책임만 담당
 */
class DatabaseManager {
  constructor(config = null) {
    if (globalInstance) {
      logger.debug("🔄 기존 DatabaseManager 인스턴스 반환");
      return globalInstance;
    }

    // AppConfig에서 받은 설정 사용
    this.config = config || {};
    this.mongoUrl = this.config.url;
    this.databaseName = this.config.name || "doomock_bot";

    // 연결 상태
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;

    // 🗄️ 스키마 관리자 (선택적)
    this.schemaManager = null;
    if (this.config.schema?.validationEnabled) {
      this.schemaManager = new SchemaManager(this.config.schema);
    }

    // 📊 컬렉션 캐시
    this.collections = new Map();

    // 📊 통계
    this.stats = {
      connections: 0,
      disconnections: 0,
      reconnections: 0,
      transactionsExecuted: 0,
      queriesExecuted: 0,
      uptime: Date.now(),
    };

    globalInstance = this;
    logger.info("🗄️ DatabaseManager 생성됨");
  }

  /**
   * 🔌 데이터베이스 연결
   */
  async connect() {
    if (this.isConnected) {
      return true;
    }

    if (this.isConnecting) {
      await this.waitForConnection();
      return this.isConnected;
    }

    if (!this.mongoUrl) {
      logger.warn("⚠️ MongoDB URL이 없어 연결 건너뜀");
      return false;
    }

    this.isConnecting = true;

    try {
      logger.info("🔌 MongoDB 연결 중...");

      // AppConfig에서 받은 연결 옵션 사용
      const options = this.config.connection || {};

      this.client = new MongoClient(this.mongoUrl, {
        ...options,
        family: 4, // IPv4 강제
      });

      await this.client.connect();
      this.db = this.client.db(this.databaseName);

      // 연결 검증
      await this.db.admin().ping();

      this.isConnected = true;
      this.stats.connections++;

      // 스키마 기반 인덱스 생성 (선택적)
      if (this.schemaManager && this.config.schema?.autoIndexCreation) {
        await this.createSchemaIndexes();
      }

      logger.success(`✅ MongoDB 연결 성공 (${this.databaseName})`);
      return true;
    } catch (error) {
      logger.error("❌ MongoDB 연결 실패:", error.message);
      this.isConnected = false;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 🔍 스키마 기반 인덱스 생성
   */
  async createSchemaIndexes() {
    if (!this.schemaManager) return;

    try {
      const { IndexDefinitions } = require("./schemas/StandardSchema");

      for (const [collectionName, indexes] of Object.entries(
        IndexDefinitions
      )) {
        const collection = this.db.collection(collectionName);

        for (const indexDef of indexes) {
          try {
            await collection.createIndex(indexDef.fields, {
              background: indexDef.background !== false,
              unique: indexDef.unique === true,
              sparse: indexDef.sparse === true,
            });
          } catch (indexError) {
            if (!indexError.message.includes("already exists")) {
              logger.warn(
                `인덱스 생성 실패 (${collectionName}):`,
                indexError.message
              );
            }
          }
        }
      }

      logger.debug("✅ 스키마 기반 인덱스 생성 완료");
    } catch (error) {
      logger.warn("⚠️ 인덱스 생성 중 오류:", error.message);
    }
  }

  /**
   * 📦 컬렉션 가져오기 (캐시됨)
   */
  getCollection(name) {
    if (!this.isConnected || !this.db) {
      throw new Error(`데이터베이스에 연결되지 않음 (컬렉션: ${name})`);
    }

    if (!this.collections.has(name)) {
      const collection = this.db.collection(name);
      this.collections.set(name, collection);
    }

    return this.collections.get(name);
  }

  /**
   * ✅ 문서 검증 (SchemaManager 활용)
   */
  async validateDocument(collectionName, document, options = {}) {
    if (!this.schemaManager) {
      return { isValid: true, document }; // 스키마 관리자 없으면 통과
    }

    return await this.schemaManager.validateDocument(
      collectionName,
      document,
      options
    );
  }

  /**
   * 💾 트랜잭션 실행
   */
  async withTransaction(callback) {
    if (!this.client) {
      throw new Error("MongoDB 클라이언트가 없음");
    }

    const session = this.client.startSession();
    try {
      const result = await session.withTransaction(callback);
      this.stats.transactionsExecuted++;
      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 🏥 연결 상태 확인
   */
  async checkConnection() {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * ⏳ 연결 대기
   */
  async waitForConnection(timeout = 15000) {
    const startTime = Date.now();
    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.isConnected;
  }

  /**
   * 🔒 연결 종료
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.stats.disconnections++;
      }

      this.client = null;
      this.db = null;
      this.isConnected = false;
      this.collections.clear();

      logger.info("✅ MongoDB 연결 종료됨");
    } catch (error) {
      logger.error("❌ 연결 종료 중 오류:", error);
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      connected: this.isConnected,
      database: this.databaseName,
      collections: Array.from(this.collections.keys()),
      schemaEnabled: !!this.schemaManager,
      stats: this.stats,
      config: {
        validationEnabled: this.config.schema?.validationEnabled || false,
        autoIndexCreation: this.config.schema?.autoIndexCreation || false,
      },
    };
  }
}

function getInstance(config = null) {
  if (!globalInstance) {
    globalInstance = new DatabaseManager(config);
  }
  return globalInstance;
}

module.exports = { DatabaseManager, getInstance };
