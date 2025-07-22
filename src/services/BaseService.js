// src/services/BaseService.js
const { getInstance } = require("../database/DatabaseManager");
const logger = require("../utils/Logger");

class BaseService {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collection = null;
    this.dbEnabled = false;
    this.isInitialized = false;

    // 메모리 스토리지 (DB 연결 실패 시 폴백)
    this.memoryStorage = new Map();

    // Railway 환경변수 기반 설정
    this.config = {
      enableDatabase: process.env.ENABLE_DATABASE !== "false",
      syncInterval: parseInt(process.env.SYNC_INTERVAL) || 30000,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    };

    // 동기화 인터벌
    this.syncInterval = null;
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.constructor.name} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🚀 ${this.constructor.name} 초기화 시작...`);

      // DB 연결 시도
      if (this.config.enableDatabase) {
        await this.connectDatabase();
      }

      // 하위 클래스별 초기화
      await this.onInitialize();

      // 주기적 동기화 설정
      if (this.dbEnabled && this.config.syncInterval > 0) {
        this.setupPeriodicSync();
      }

      this.isInitialized = true;
      logger.success(`✅ ${this.constructor.name} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.constructor.name} 초기화 실패:`, error);
      // 초기화 실패해도 메모리 모드로 동작
      this.dbEnabled = false;
      this.isInitialized = true;
    }
  }

  /**
   * 데이터베이스 연결
   */
  async connectDatabase() {
    try {
      const dbManager = getInstance();
      await dbManager.ensureConnection();

      this.collection = dbManager.getCollection(this.collectionName);
      this.dbEnabled = true;

      logger.info(`📊 ${this.collectionName} 컬렉션 연결됨`);
    } catch (error) {
      logger.warn(`⚠️ ${this.collectionName} DB 연결 실패, 메모리 모드로 실행`);
      logger.debug(`에러: ${error.message}`);
      this.dbEnabled = false;
    }
  }

  /**
   * 주기적 동기화 설정
   */
  setupPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncToDatabase();
      } catch (error) {
        logger.error(`동기화 실패 (${this.constructor.name}):`, error);
      }
    }, this.config.syncInterval);

    logger.info(
      `⏰ ${this.constructor.name} 동기화 설정 (${this.config.syncInterval / 1000}초마다)`
    );
  }

  /**
   * 데이터 저장 (DB + 메모리)
   */
  async save(id, data) {
    // 메모리에 저장
    this.memoryStorage.set(id, data);

    // DB에 저장
    if (this.dbEnabled && this.collection) {
      try {
        await this.collection.replaceOne(
          { _id: id },
          { _id: id, ...data, updatedAt: new Date() },
          { upsert: true }
        );
      } catch (error) {
        logger.error(`DB 저장 실패 (${id}):`, error);
      }
    }
  }

  /**
   * 데이터 조회 (DB + 메모리)
   */
  async find(id) {
    // 먼저 메모리에서 조회
    if (this.memoryStorage.has(id)) {
      return this.memoryStorage.get(id);
    }

    // DB에서 조회
    if (this.dbEnabled && this.collection) {
      try {
        const doc = await this.collection.findOne({ _id: id });
        if (doc) {
          // 메모리에 캐시
          const { _id, ...data } = doc;
          this.memoryStorage.set(id, data);
          return data;
        }
      } catch (error) {
        logger.error(`DB 조회 실패 (${id}):`, error);
      }
    }

    return null;
  }

  /**
   * 데이터 삭제
   */
  async remove(id) {
    // 메모리에서 삭제
    this.memoryStorage.delete(id);

    // DB에서 삭제
    if (this.dbEnabled && this.collection) {
      try {
        await this.collection.deleteOne({ _id: id });
      } catch (error) {
        logger.error(`DB 삭제 실패 (${id}):`, error);
      }
    }
  }

  /**
   * 모든 데이터 조회
   */
  async findAll(filter = {}) {
    if (this.dbEnabled && this.collection) {
      try {
        const docs = await this.collection.find(filter).toArray();
        // 메모리에 캐시
        docs.forEach((doc) => {
          const { _id, ...data } = doc;
          this.memoryStorage.set(_id, data);
        });
        return docs;
      } catch (error) {
        logger.error("전체 조회 실패:", error);
      }
    }

    // 메모리에서 반환
    return Array.from(this.memoryStorage.entries()).map(([id, data]) => ({
      _id: id,
      ...data,
    }));
  }

  /**
   * 메모리 데이터를 DB로 동기화
   */
  async syncToDatabase() {
    if (!this.dbEnabled || !this.collection) return;

    const entries = Array.from(this.memoryStorage.entries());
    if (entries.length === 0) return;

    logger.debug(
      `🔄 ${this.constructor.name} 동기화 시작 (${entries.length}개)`
    );

    try {
      const operations = entries.map(([id, data]) => ({
        replaceOne: {
          filter: { _id: id },
          replacement: { _id: id, ...data, updatedAt: new Date() },
          upsert: true,
        },
      }));

      await this.collection.bulkWrite(operations);
      logger.debug(`✅ ${this.constructor.name} 동기화 완료`);
    } catch (error) {
      logger.error(`동기화 실패 (${this.constructor.name}):`, error);
    }
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // 마지막 동기화
    if (this.dbEnabled) {
      await this.syncToDatabase();
    }

    this.isInitialized = false;
    logger.info(`🧹 ${this.constructor.name} 정리 완료`);
  }

  /**
   * 하위 클래스에서 구현할 메서드
   */
  async onInitialize() {
    // 하위 클래스에서 구현
  }

  /**
   * 상태 정보
   */
  getStatus() {
    return {
      service: this.constructor.name,
      initialized: this.isInitialized,
      dbEnabled: this.dbEnabled,
      memoryCount: this.memoryStorage.size,
      collection: this.collectionName,
    };
  }
}

module.exports = BaseService;
