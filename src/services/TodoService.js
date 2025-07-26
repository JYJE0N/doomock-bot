// src/services/TodoService.js - 누락된 TodoService 생성
const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 📝 TodoService v3.0.1 - 할일 관리 서비스
 *
 * 🎯 기능:
 * - CRUD 작업 (생성, 조회, 수정, 삭제)
 * - 우선순위 및 카테고리 관리
 * - 상태 추적 (진행중, 완료, 취소)
 * - 검색 및 필터링
 * - 통계 제공
 */
class TodoService extends BaseService {
  constructor(db) {
    super("todos", {
      db: db,
      enableCache: true,
      cacheTimeout: 30000, // 30초
    });

    // 메모리 저장소 (DB 없을 때 사용)
    this.memoryStore = new Map(); // userId -> todos[]
    this.nextId = 1;

    // 상수 정의
    this.STATUSES = {
      PENDING: "pending",
      IN_PROGRESS: "progress",
      COMPLETED: "completed",
      CANCELLED: "cancelled",
      PAUSED: "paused",
    };

    this.PRIORITIES = {
      VERY_HIGH: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
      VERY_LOW: 5,
    };

    this.CATEGORIES = [
      "일반",
      "업무",
      "개인",
      "중요",
      "긴급",
      "공부",
      "운동",
      "쇼핑",
      "약속",
      "기타",
    ];

    logger.info("📝 TodoService 생성됨");
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      await super.initialize();

      // 컬렉션 존재 확인 및 인덱스 생성
      if (this.collection) {
        await this.createIndexes();
        logger.info("✅ TodoService 초기화 성공 (DB 모드)");
      } else {
        logger.warn("⚠️ TodoService 초기화 성공 (메모리 모드)");
      }

      return true;
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      return false;
    }
  }

  /**
   * 🔍 인덱스 생성
   */
  async createIndexes() {
    try {
      if (!this.collection) return;

      await this.collection.createIndex({ userId: 1, status: 1 });
      await this.collection.createIndex({ userId: 1, priority: 1 });
      await this.collection.createIndex({ userId: 1, category: 1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, dueDate: 1 });

      logger.debug("✅ TodoService 인덱스 생성 완료");
    } catch (error) {
      logger.warn("⚠️ TodoService 인덱스 생성 실패:", error);
    }
  }

  /**
   * 📝 할일 추가
   */
  async addTodo(userId, todoData) {
    try {
      const todo = {
        id: this.collection ? undefined : this.nextId++,
        userId: userId,
        text: todoData.text || "",
        description: todoData.description || "",
        status: this.STATUSES.PENDING,
        priority: todoData.priority || this.PRIORITIES.MEDIUM,
        category: todoData.category || "일반",
        tags: this.sanitizeTags(todoData.tags || []),
        dueDate: todoData.dueDate || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        estimatedMinutes: todoData.estimatedMinutes || null,
        actualMinutes: null,
        notes: [],
      };

      // 유효성 검사
      const validation = this.validateTodo(todo);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message,
          todo: null,
        };
      }

      let result;

      if (this.collection) {
        // DB 저장
        result = await this.collection.insertOne(todo);
        todo.id = result.insertedId;
      } else {
        // 메모리 저장
        const userTodos = this.memoryStore.get(userId) || [];
        userTodos.push(todo);
        this.memoryStore.set(userId, userTodos);
      }

      logger.debug(`📝 할일 추가: ${userId} -> "${todo.text}"`);

      return {
        success: true,
        message: "할일이 추가되었습니다.",
        todo: todo,
      };
    } catch (error) {
      logger.error("❌ 할일 추가 실패:", error);
      return {
        success: false,
        message: "할일 추가 중 오류가 발생했습니다.",
        todo: null,
      };
    }
  }

  /**
   * 📋 할일 목록 조회
   */
  async getTodos(userId, options = {}) {
    try {
      const {
        status = null,
        category = null,
        priority = null,
        limit = 50,
        offset = 0,
        sortBy = "createdAt",
        sortOrder = -1,
        search = null,
      } = options;

      let todos = [];

      if (this.collection) {
        // DB 조회
        const query = { userId: userId };

        if (status) query.status = status;
        if (category) query.category = category;
        if (priority) query.priority = priority;
        if (search) {
          query.$or = [
            { text: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        todos = await this.collection
          .find(query)
          .sort({ [sortBy]: sortOrder })
          .skip(offset)
          .limit(limit)
          .toArray();
      } else {
        // 메모리 조회
        todos = this.memoryStore.get(userId) || [];

        // 필터링
        if (status) todos = todos.filter((t) => t.status === status);
        if (category) todos = todos.filter((t) => t.category === category);
        if (priority) todos = todos.filter((t) => t.priority === priority);
        if (search) {
          const searchLower = search.toLowerCase();
          todos = todos.filter(
            (t) =>
              t.text.toLowerCase().includes(searchLower) ||
              t.description.toLowerCase().includes(searchLower)
          );
        }

        // 정렬
        todos.sort((a, b) => {
          const aVal = a[sortBy];
          const bVal = b[sortBy];
          return sortOrder === 1
            ? aVal > bVal
              ? 1
              : -1
            : aVal < bVal
            ? 1
            : -1;
        });

        // 페이지네이션
        todos = todos.slice(offset, offset + limit);
      }

      return {
        success: true,
        todos: todos,
        total: todos.length,
        hasMore: todos.length === limit,
      };
    } catch (error) {
      logger.error("❌ 할일 조회 실패:", error);
      return {
        success: false,
        todos: [],
        total: 0,
        hasMore: false,
        message: "할일 조회 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ✏️ 할일 수정
   */
  async updateTodo(userId, todoId, updateData) {
    try {
      const allowedFields = [
        "text",
        "description",
        "status",
        "priority",
        "category",
        "tags",
        "dueDate",
        "estimatedMinutes",
        "notes",
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (updateData.hasOwnProperty(field)) {
          updates[field] = updateData[field];
        }
      }

      // 완료 시간 처리
      if (updates.status === this.STATUSES.COMPLETED && !updates.completedAt) {
        updates.completedAt = new Date();
      } else if (updates.status !== this.STATUSES.COMPLETED) {
        updates.completedAt = null;
      }

      updates.updatedAt = new Date();

      let result;

      if (this.collection) {
        // DB 업데이트
        result = await this.collection.updateOne(
          { _id: todoId, userId: userId },
          { $set: updates }
        );

        if (result.matchedCount === 0) {
          return {
            success: false,
            message: "할일을 찾을 수 없습니다.",
          };
        }
      } else {
        // 메모리 업데이트
        const userTodos = this.memoryStore.get(userId) || [];
        const todoIndex = userTodos.findIndex((t) => t.id === todoId);

        if (todoIndex === -1) {
          return {
            success: false,
            message: "할일을 찾을 수 없습니다.",
          };
        }

        Object.assign(userTodos[todoIndex], updates);
      }

      logger.debug(`✏️ 할일 수정: ${userId} -> ${todoId}`);

      return {
        success: true,
        message: "할일이 수정되었습니다.",
      };
    } catch (error) {
      logger.error("❌ 할일 수정 실패:", error);
      return {
        success: false,
        message: "할일 수정 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(userId, todoId) {
    try {
      let result;

      if (this.collection) {
        // DB 삭제
        result = await this.collection.deleteOne({
          _id: todoId,
          userId: userId,
        });

        if (result.deletedCount === 0) {
          return {
            success: false,
            message: "할일을 찾을 수 없습니다.",
          };
        }
      } else {
        // 메모리 삭제
        const userTodos = this.memoryStore.get(userId) || [];
        const todoIndex = userTodos.findIndex((t) => t.id === todoId);

        if (todoIndex === -1) {
          return {
            success: false,
            message: "할일을 찾을 수 없습니다.",
          };
        }

        userTodos.splice(todoIndex, 1);
      }

      logger.debug(`🗑️ 할일 삭제: ${userId} -> ${todoId}`);

      return {
        success: true,
        message: "할일이 삭제되었습니다.",
      };
    } catch (error) {
      logger.error("❌ 할일 삭제 실패:", error);
      return {
        success: false,
        message: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ✅ 할일 유효성 검사
   */
  validateTodo(todo) {
    if (!todo.text || todo.text.trim().length === 0) {
      return {
        isValid: false,
        message: "할일 내용을 입력해주세요.",
      };
    }

    if (todo.text.length > 500) {
      return {
        isValid: false,
        message: "할일 내용은 500자 이내로 입력해주세요.",
      };
    }

    if (todo.description && todo.description.length > 1000) {
      return {
        isValid: false,
        message: "설명은 1000자 이내로 입력해주세요.",
      };
    }

    if (!Object.values(this.PRIORITIES).includes(todo.priority)) {
      return {
        isValid: false,
        message: "올바른 우선순위를 선택해주세요.",
      };
    }

    return { isValid: true };
  }

  /**
   * 🏷️ 태그 정리
   */
  sanitizeTags(tags) {
    return Array.isArray(tags)
      ? tags
          .map((tag) => String(tag).trim())
          .filter((tag) => tag.length > 0)
          .slice(0, 10) // 최대 10개
      : [];
  }

  /**
   * 📊 통계 조회
   */
  async getStats(userId) {
    try {
      const allTodos = await this.getTodos(userId, { limit: 1000 });

      if (!allTodos.success) {
        return { success: false, stats: null };
      }

      const todos = allTodos.todos;
      const stats = {
        total: todos.length,
        completed: todos.filter((t) => t.status === this.STATUSES.COMPLETED)
          .length,
        pending: todos.filter((t) => t.status === this.STATUSES.PENDING).length,
        inProgress: todos.filter((t) => t.status === this.STATUSES.IN_PROGRESS)
          .length,
        cancelled: todos.filter((t) => t.status === this.STATUSES.CANCELLED)
          .length,

        byPriority: {},
        byCategory: {},

        completionRate: 0,
        avgCompletionTime: 0,
      };

      // 우선순위별 통계
      for (const priority of Object.values(this.PRIORITIES)) {
        stats.byPriority[priority] = todos.filter(
          (t) => t.priority === priority
        ).length;
      }

      // 카테고리별 통계
      for (const category of this.CATEGORIES) {
        stats.byCategory[category] = todos.filter(
          (t) => t.category === category
        ).length;
      }

      // 완료율 계산
      if (stats.total > 0) {
        stats.completionRate = Math.round(
          (stats.completed / stats.total) * 100
        );
      }

      return {
        success: true,
        stats: stats,
      };
    } catch (error) {
      logger.error("❌ 통계 조회 실패:", error);
      return {
        success: false,
        stats: null,
      };
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getServiceStatus() {
    return {
      serviceName: "TodoService",
      status: "active",
      mode: this.collection ? "database" : "memory",
      stats: {
        totalUsers: this.memoryStore.size,
        cacheEnabled: this.config.enableCache,
        lastActivity: this.stats.lastActivity,
      },
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      await super.cleanup();

      this.memoryStore.clear();

      logger.info("✅ TodoService 정리 완료");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }
}

module.exports = TodoService;
