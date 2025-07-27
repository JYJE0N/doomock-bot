// src/services/WorktimeService.js
// 🔧 근무시간 데이터 관리 (v3.0.1)

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔧 WorktimeService - 근무시간 데이터 관리
 * 
 * @version 3.0.1
 */
class WorktimeService {
  constructor(db) {
    this.db = db;
    this.collection = null;
    this.collectionName = "worktimes";
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    try {
      this.collection = this.db.collection(this.collectionName);
      
      // 인덱스 생성
      await this.createIndexes();
      
      logger.success(`✅ ${this.constructor.name} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.constructor.name} 초기화 실패`, error);
      throw error;
    }
  }

  /**
   * 🔍 인덱스 생성
   */
  async createIndexes() {
    try {
      // 기본 인덱스
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ updatedAt: -1 });
      
      // TODO: 서비스별 추가 인덱스
      
      logger.debug(`🔍 ${this.collectionName} 인덱스 생성 완료`);
    } catch (error) {
      logger.warn(`인덱스 생성 실패 (이미 존재할 수 있음): ${error.message}`);
    }
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      const total = await this.collection.countDocuments({ userId });
      
      // TODO: 서비스별 통계 구현
      return {
        total,
        // 추가 통계...
      };
    } catch (error) {
      logger.error(`사용자 통계 조회 실패: ${error.message}`);
      return { total: 0 };
    }
  }

  /**
   * 📝 데이터 생성
   */
  async create(userId, data) {
    try {
      const document = {
        userId,
        ...data,
        createdAt: TimeHelper.now(),
        updatedAt: TimeHelper.now(),
        version: "3.0.1",
        isActive: true,
      };

      const result = await this.collection.insertOne(document);
      
      logger.debug(`📝 ${this.collectionName} 데이터 생성: ${result.insertedId}`);
      
      return result.insertedId;
    } catch (error) {
      logger.error(`데이터 생성 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 데이터 조회
   */
  async findByUserId(userId, options = {}) {
    try {
      const query = { userId, isActive: true };
      
      const cursor = this.collection.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 10);
      
      return await cursor.toArray();
    } catch (error) {
      logger.error(`데이터 조회 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 🔄 데이터 업데이트
   */
  async update(id, updates) {
    try {
      const result = await this.collection.updateOne(
        { _id: id },
        {
          $set: {
            ...updates,
            updatedAt: TimeHelper.now(),
          },
        }
      );

      logger.debug(`🔄 ${this.collectionName} 업데이트: ${id}`);
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`데이터 업데이트 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 🗑️ 데이터 삭제 (소프트 삭제)
   */
  async delete(id) {
    try {
      const result = await this.collection.updateOne(
        { _id: id },
        {
          $set: {
            isActive: false,
            deletedAt: TimeHelper.now(),
            updatedAt: TimeHelper.now(),
          },
        }
      );

      logger.debug(`🗑️ ${this.collectionName} 삭제: ${id}`);
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`데이터 삭제 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    // TODO: 필요한 정리 작업
    logger.debug(`🧹 ${this.constructor.name} 정리 완료`);
  }

  // TODO: 서비스별 추가 메서드 구현
}

module.exports = WorktimeService;
