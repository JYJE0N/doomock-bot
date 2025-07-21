// src/services/BaseService.js - 모든 서비스의 표준 베이스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getInstance } = require("../database/DatabaseManager");

class BaseService {
  constructor(db, collectionName) {
    this.db = db;
    this.collectionName = collectionName;
    this.isInitialized = false;

    logger.info(`📦 ${this.constructor.name} 생성됨`);
  }

  // 표준 초기화 메서드 (모든 서비스가 상속)
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.constructor.name} 이미 초기화됨`);
      return;
    }

    try {
      // DB 없이도 작동 가능하도록
      if (!this.db) {
        logger.warn(`${this.constructor.name}: DB 없이 메모리 모드로 실행`);
        this.memoryMode = true;
        this.memoryStorage = new Map();
      }

      // 서비스별 초기화
      await this.onInitialize();

      this.isInitialized = true;
      logger.success(`✅ ${this.constructor.name} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.constructor.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 서비스별 초기화 (오버라이드용)
  async onInitialize() {
    // 하위 클래스에서 구현
  }

  // DB 연결 확인
  async ensureConnection() {
    if (this.memoryMode) {
      return true;
    }

    if (!this.db || !this.db.isConnected) {
      throw new Error("데이터베이스 연결이 없습니다");
    }

    return true;
  }

  // 컬렉션 가져오기
  getCollection() {
    if (this.memoryMode) {
      return null;
    }

    return this.db.getCollection(this.collectionName);
  }
}

module.exports = BaseService;
