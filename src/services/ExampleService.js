// src/services/ExampleService.js - 표준 서비스 템플릿
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const { ObjectId } = require("mongodb");

/**
 * 🔧 ExampleService - 표준 서비스 템플릿
 *
 * 🎯 구현 순서:
 * 1. 스키마 정의
 * 2. 기본 CRUD 메서드
 * 3. 비즈니스 로직
 * 4. 통계/집계
 */
class ExampleService extends BaseService {
  constructor() {
    super("examples"); // MongoDB 컬렉션명

    // 서비스 설정
    this.config = {
      cacheEnabled: true,
      cacheTimeout: 300000, // 5분
      maxItemsPerUser: 100,
    };

    // 메모리 캐시
    this.cache = new Map();

    logger.module("ExampleService", "🔧 서비스 생성됨");
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      logger.module("ExampleService", "📦 초기화 시작...");

      // DatabaseManager에서 컬렉션 가져오기
      const { getInstance } = require("../database/DatabaseManager");
      this.dbManager = getInstance();

      if (this.dbManager && this.dbManager.db) {
        this.collection = this.dbManager.db.collection(this.collectionName);

        // 인덱스 생성
        await this.createIndexes();

        logger.success("✅ ExampleService DB 연결 성공");
      } else {
        logger.warn("⚠️ ExampleService 메모리 모드로 실행");
        this.memoryMode = true;
      }
    } catch (error) {
      logger.error("❌ ExampleService 초기화 실패", error);
      this.memoryMode = true;
    }
  }

  /**
   * 🔍 인덱스 생성
   */
  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ "metadata.status": 1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });

      logger.debug("🔍 ExampleService 인덱스 생성 완료");
    } catch (error) {
      logger.error("❌ 인덱스 생성 실패", error);
    }
  }

  // ===== 🎯 CRUD 메서드들 =====

  /**
   * ➕ 항목 생성
   */
  async create(userId, data) {
    try {
      logger.debug("➕ 항목 생성 시도", { userId, data });

      const item = {
        _id: new ObjectId(),
        userId: userId.toString(),
        title: data.title,
        description: data.description || "",
        metadata: {
          status: "active",
          priority: data.priority || 1,
          tags: data.tags || [],
          category: data.category || "general",
        },
        settings: {
          notifications: true,
          public: false,
        },
        stats: {
          views: 0,
          updates: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isActive: true,
      };

      if (this.memoryMode) {
        this.cache.set(item._id.toString(), item);
      } else {
        await this.collection.insertOne(item);
      }

      logger.success("✅ 항목 생성 성공", { itemId: item._id });

      return {
        success: true,
        data: item,
        message: "항목이 생성되었습니다.",
      };
    } catch (error) {
      logger.error("❌ 항목 생성 실패", error);
      return {
        success: false,
        error: error.message,
        message: "항목 생성 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📋 목록 조회
   */
  async getList(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = null,
        sortBy = "createdAt",
        order = -1,
      } = options;

      logger.debug("📋 목록 조회", { userId, options });

      const query = {
        userId: userId.toString(),
        isActive: true,
      };

      if (status) {
        query["metadata.status"] = status;
      }

      if (this.memoryMode) {
        // 메모리 모드
        const items = Array.from(this.cache.values()).filter(
          (item) => item.userId === userId.toString() && item.isActive
        );

        return {
          success: true,
          data: {
            items: items.slice((page - 1) * limit, page * limit),
            totalCount: items.length,
            page,
            totalPages: Math.ceil(items.length / limit),
          },
        };
      }

      // DB 모드
      const totalCount = await this.collection.countDocuments(query);
      const items = await this.collection
        .find(query)
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      logger.success("✅ 목록 조회 성공", { count: items.length });

      return {
        success: true,
        data: {
          items,
          totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error("❌ 목록 조회 실패", error);
      return {
        success: false,
        error: error.message,
        data: { items: [], totalCount: 0 },
      };
    }
  }

  /**
   * 🔍 단일 항목 조회
   */
  async getById(userId, itemId) {
    try {
      logger.debug("🔍 항목 조회", { userId, itemId });

      if (this.memoryMode) {
        const item = this.cache.get(itemId);
        if (item && item.userId === userId.toString()) {
          return { success: true, data: item };
        }
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      const item = await this.collection.findOne({
        _id: new ObjectId(itemId),
        userId: userId.toString(),
        isActive: true,
      });

      if (!item) {
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      // 조회수 증가
      await this.collection.updateOne(
        { _id: item._id },
        { $inc: { "stats.views": 1 } }
      );

      return { success: true, data: item };
    } catch (error) {
      logger.error("❌ 항목 조회 실패", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✏️ 항목 수정
   */
  async update(userId, itemId, updateData) {
    try {
      logger.debug("✏️ 항목 수정", { userId, itemId, updateData });

      const updates = {
        ...updateData,
        updatedAt: new Date(),
        $inc: { version: 1, "stats.updates": 1 },
      };

      if (this.memoryMode) {
        const item = this.cache.get(itemId);
        if (item && item.userId === userId.toString()) {
          Object.assign(item, updates);
          return { success: true, data: item };
        }
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      const result = await this.collection.findOneAndUpdate(
        {
          _id: new ObjectId(itemId),
          userId: userId.toString(),
          isActive: true,
        },
        { $set: updates },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      logger.success("✅ 항목 수정 성공", { itemId });

      return {
        success: true,
        data: result.value,
        message: "항목이 수정되었습니다.",
      };
    } catch (error) {
      logger.error("❌ 항목 수정 실패", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🗑️ 항목 삭제 (소프트 삭제)
   */
  async delete(userId, itemId) {
    try {
      logger.debug("🗑️ 항목 삭제", { userId, itemId });

      if (this.memoryMode) {
        const item = this.cache.get(itemId);
        if (item && item.userId === userId.toString()) {
          item.isActive = false;
          item.deletedAt = new Date();
          return { success: true, message: "항목이 삭제되었습니다." };
        }
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      const result = await this.collection.updateOne(
        {
          _id: new ObjectId(itemId),
          userId: userId.toString(),
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            deletedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return { success: false, message: "항목을 찾을 수 없습니다." };
      }

      logger.success("✅ 항목 삭제 성공", { itemId });

      return {
        success: true,
        message: "항목이 삭제되었습니다.",
      };
    } catch (error) {
      logger.error("❌ 항목 삭제 실패", error);
      return { success: false, error: error.message };
    }
  }

  // ===== 📊 통계/집계 메서드들 =====

  /**
   * 📊 사용자 통계
   */
  async getUserStats(userId) {
    try {
      logger.debug("📊 사용자 통계 조회", { userId });

      if (this.memoryMode) {
        const items = Array.from(this.cache.values()).filter(
          (item) => item.userId === userId.toString() && item.isActive
        );

        return {
          success: true,
          data: {
            total: items.length,
            active: items.filter((i) => i.metadata.status === "active").length,
            completed: items.filter((i) => i.metadata.status === "completed")
              .length,
          },
        };
      }

      const stats = await this.collection
        .aggregate([
          {
            $match: {
              userId: userId.toString(),
              isActive: true,
            },
          },
          {
            $group: {
              _id: "$metadata.status",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const result = {
        total: 0,
        active: 0,
        completed: 0,
      };

      stats.forEach((stat) => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      return { success: true, data: result };
    } catch (error) {
      logger.error("❌ 통계 조회 실패", error);
      return {
        success: false,
        error: error.message,
        data: { total: 0, active: 0, completed: 0 },
      };
    }
  }

  /**
   * 🔍 검색
   */
  async search(userId, query, options = {}) {
    try {
      logger.debug("🔍 검색 실행", { userId, query });

      const searchQuery = {
        userId: userId.toString(),
        isActive: true,
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          { "metadata.tags": { $in: [query] } },
        ],
      };

      if (this.memoryMode) {
        const items = Array.from(this.cache.values()).filter((item) => {
          if (item.userId !== userId.toString() || !item.isActive) return false;

          const lowerQuery = query.toLowerCase();
          return (
            item.title.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery) ||
            item.metadata.tags.some((tag) => tag.toLowerCase() === lowerQuery)
          );
        });

        return { success: true, data: items };
      }

      const items = await this.collection
        .find(searchQuery)
        .limit(options.limit || 20)
        .toArray();

      logger.success("✅ 검색 완료", { count: items.length });

      return { success: true, data: items };
    } catch (error) {
      logger.error("❌ 검색 실패", error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      this.cache.clear();
      logger.info("✅ ExampleService 정리 완료");
    } catch (error) {
      logger.error("❌ ExampleService 정리 실패", error);
    }
  }

  /**
   * 📊 서비스 상태
   */
  getStatus() {
    return {
      name: "ExampleService",
      mode: this.memoryMode ? "memory" : "database",
      cacheSize: this.cache.size,
      connected: !this.memoryMode && !!this.collection,
    };
  }
}

module.exports = ExampleService;
