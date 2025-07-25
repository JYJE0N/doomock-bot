// src/services/BaseService.js - 모든 서비스의 표준 부모 클래스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { MongoClient } = require("mongodb");

/**
 * 모든 서비스의 기본 클래스
 * - MongoDB 네이티브 드라이버 사용 (mongoose 사용 안함!)
 * - 풀링 방식 데이터베이스 연결
 * - 메모리 캐싱 지원
 */
class BaseService {
  constructor(collectionName, options = {}) {
    this.collectionName = collectionName;
    this.db = options.db || null;
    this.collection = null;

    // 설정
    this.config = {
      enableCache: true,
      cacheTimeout: 300000, // 5분
      maxRetries: 3,
      retryDelay: 1000,
      ...options.config,
    };

    // 메모리 캐시
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 체크
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    logger.info(`🔧 ${this.constructor.name} 서비스 생성됨`);
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      if (this.db && this.collectionName) {
        this.collection = this.db.collection(this.collectionName);

        // 인덱스 생성 (자식 클래스에서 정의)
        await this.createIndexes();

        logger.info(`✅ ${this.constructor.name} 초기화 완료`);
      }

      // 자식 클래스의 초기화 로직
      await this.onInitialize();
    } catch (error) {
      logger.error(`❌ ${this.constructor.name} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 인덱스 생성 (자식 클래스에서 구현)
   */
  async createIndexes() {
    // 기본 인덱스: createdAt, updatedAt
    if (this.collection) {
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ updatedAt: -1 });
    }
  }

  // ===== CRUD 기본 메서드 =====

  /**
   * 문서 생성
   */
  async create(data) {
    try {
      const document = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.collection.insertOne(document);

      // 캐시 무효화
      this.invalidateCache();

      return { _id: result.insertedId, ...document };
    } catch (error) {
      logger.error(`${this.constructor.name} 생성 오류:`, error);
      throw error;
    }
  }

  /**
   * 문서 조회
   */
  async findOne(filter, options = {}) {
    try {
      // 캐시 확인
      const cacheKey = JSON.stringify({ filter, options });
      if (this.config.enableCache && this.cache.has(cacheKey)) {
        if (this.isCacheValid(cacheKey)) {
          return this.cache.get(cacheKey);
        }
      }

      const document = await this.collection.findOne(filter, options);

      // 캐시 저장
      if (this.config.enableCache && document) {
        this.setCache(cacheKey, document);
      }

      return document;
    } catch (error) {
      logger.error(`${this.constructor.name} 조회 오류:`, error);
      throw error;
    }
  }

  /**
   * 여러 문서 조회
   */
  async find(filter = {}, options = {}) {
    try {
      const { sort = { createdAt: -1 }, limit = 100, skip = 0 } = options;

      const documents = await this.collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      return documents;
    } catch (error) {
      logger.error(`${this.constructor.name} 목록 조회 오류:`, error);
      throw error;
    }
  }

  /**
   * 문서 업데이트
   */
  async updateOne(filter, update, options = {}) {
    try {
      const updateDoc = {
        $set: {
          ...update.$set,
          updatedAt: new Date(),
        },
      };

      if (update.$push) updateDoc.$push = update.$push;
      if (update.$pull) updateDoc.$pull = update.$pull;
      if (update.$inc) updateDoc.$inc = update.$inc;

      const result = await this.collection.updateOne(
        filter,
        updateDoc,
        options
      );

      // 캐시 무효화
      this.invalidateCache();

      return result;
    } catch (error) {
      logger.error(`${this.constructor.name} 업데이트 오류:`, error);
      throw error;
    }
  }

  /**
   * 문서 삭제
   */
  async deleteOne(filter) {
    try {
      const result = await this.collection.deleteOne(filter);

      // 캐시 무효화
      this.invalidateCache();

      return result;
    } catch (error) {
      logger.error(`${this.constructor.name} 삭제 오류:`, error);
      throw error;
    }
  }

  /**
   * 카운트
   */
  async count(filter = {}) {
    try {
      return await this.collection.countDocuments(filter);
    } catch (error) {
      logger.error(`${this.constructor.name} 카운트 오류:`, error);
      throw error;
    }
  }

  // ===== 캐시 관리 =====

  /**
   * 캐시 설정
   */
  setCache(key, value) {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * 캐시 유효성 확인
   */
  isCacheValid(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;

    return Date.now() - timestamp < this.config.cacheTimeout;
  }

  /**
   * 캐시 무효화
   */
  invalidateCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  // ===== 유틸리티 메서드 =====

  /**
   * 재시도 로직
   */
  async withRetry(operation, retries = this.config.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;

        logger.warn(`재시도 ${i + 1}/${retries}:`, error.message);
        await this.delay(this.config.retryDelay * (i + 1));
      }
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 현재 한국 시간
   */
  getKoreanTime() {
    return TimeHelper.getKoreanTime();
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(date, format) {
    return TimeHelper.formatDate(date, format);
  }

  // ===== 자식 클래스에서 구현 =====

  /**
   * 서비스별 초기화 로직
   */
  async onInitialize() {
    // 자식 클래스에서 구현
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    logger.info(`🧹 ${this.constructor.name} 정리 중...`);
    this.invalidateCache();
  }

  /**
   * 여러 문서 조회
   */
  async find(filter = {}, options = {}) {
    try {
      // collection이 없으면 빈 배열 반환
      if (!this.collection) {
        logger.error(`${this.constructor.name}: collection이 초기화되지 않음`);
        return [];
      }

      const { sort = { createdAt: -1 }, limit = 100, skip = 0 } = options;

      const documents = await this.collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      return documents;
    } catch (error) {
      logger.error(`${this.constructor.name} 목록 조회 오류:`, error);
      // 에러 발생시에도 빈 배열 반환하여 서비스 중단 방지
      return [];
    }
  }

  /**
   * 문서 조회 (findOne도 안전하게)
   */
  async findOne(filter, options = {}) {
    try {
      if (!this.collection) {
        logger.error(`${this.constructor.name}: collection이 초기화되지 않음`);
        return null;
      }

      // 캐시 확인
      const cacheKey = JSON.stringify({ filter, options });
      if (this.config.enableCache && this.cache.has(cacheKey)) {
        if (this.isCacheValid(cacheKey)) {
          return this.cache.get(cacheKey);
        }
      }

      const document = await this.collection.findOne(filter, options);

      // 캐시 저장
      if (this.config.enableCache && document) {
        this.setCache(cacheKey, document);
      }

      return document;
    } catch (error) {
      logger.error(`${this.constructor.name} 조회 오류:`, error);
      return null;
    }
  }

  /**
   * 카운트 (안전한 버전)
   */
  async count(filter = {}) {
    try {
      if (!this.collection) {
        logger.error(`${this.constructor.name}: collection이 초기화되지 않음`);
        return 0;
      }

      return await this.collection.countDocuments(filter);
    } catch (error) {
      logger.error(`${this.constructor.name} 카운트 오류:`, error);
      return 0;
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      service: this.constructor.name,
      collection: this.collectionName,
      cacheSize: this.cache.size,
      isRailway: this.isRailway,
    };
  }
}

module.exports = BaseService;
