// src/services/TodoService.js - 🎯 완전한 Mongoose 기반 할일 데이터 서비스
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔧 TodoService - Mongoose 기반 할일 데이터 관리
 *
 * 🎯 핵심 기능:
 * - 할일 CRUD (생성/조회/업데이트/삭제)
 * - 완료/미완료 토글
 * - 사용자별 할일 관리
 * - 간단한 통계
 * - MongooseManager 연동
 *
 * ✅ 표준 준수:
 * - Mongoose 라이브러리 사용 ✨
 * - 모델 기반 스키마 검증
 * - 메모리 캐싱 시스템
 * - Railway 환경 최적화
 * - 표준 필드 활용
 */
class TodoService {
  constructor(options = {}) {
    // Mongoose 모델 (나중에 주입받음)
    this.Todo = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableCache: process.env.ENABLE_TODO_CACHE !== "false",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000, // 5분
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableValidation: process.env.TODO_VALIDATION_ENABLED !== "false",
      ...options.config,
    };

    // 메모리 캐시 (간단한 Map 기반)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 서비스 통계
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
    };

    logger.info("🔧 TodoService 생성됨 - Mongoose 버전! 🎉");
  }

  /**
   * 🎯 서비스 초기화 (Mongoose 모델 연결)
   */
  async initialize() {
    try {
      logger.info("🔧 TodoService 초기화 시작 (Mongoose)...");

      // MongooseManager에서 Todo 모델 가져오기
      const { getInstance } = require("../database/MongooseManager");
      const mongooseManager = getInstance();

      this.Todo = mongooseManager.getModel("Todo");

      if (!this.Todo) {
        throw new Error("Todo 모델을 찾을 수 없습니다");
      }

      logger.success("✅ TodoService 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📊 Mongoose 기반 CRUD 메서드들 =====

  /**
   * 📋 할일 목록 조회 (Mongoose 메서드 활용)
   */
  async getTodos(userId, options = {}) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `todos:${userId}:${JSON.stringify(options)}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // 🎯 Mongoose 정적 메서드 사용
      const todos = await this.Todo.findByUser(userId, {
        completed: options.completed,
        category: options.category,
        priority: options.priority,
        tags: options.tags,
        sort: options.sort || { completed: 1, createdAt: -1 }, // 미완료 먼저
        limit: options.limit || 50,
      });

      // 데이터 정규화 (Mongoose 문서 -> 플레인 객체)
      const processedTodos = todos.map((todo) => ({
        id: todo._id.toString(),
        userId: todo.userId,
        text: todo.text,
        description: todo.description,
        completed: todo.completed,
        completedAt: todo.completedAt,
        priority: todo.priority,
        category: todo.category,
        tags: todo.tags,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        isActive: todo.isActive,

        // 가상 속성들
        daysUntilDue: todo.daysUntilDue,
        isOverdue: todo.isOverdue,
      }));

      // 캐시에 저장
      if (this.config.enableCache) {
        this.cache.set(cacheKey, processedTodos);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(
        `📋 할일 ${processedTodos.length}개 조회됨 (사용자: ${userId}) - Mongoose`
      );

      return processedTodos;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 목록 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * ➕ 할일 추가 (Mongoose 모델 활용)
   */
  async addTodo(userId, data) {
    this.stats.operationsCount++;

    try {
      // 할일 개수 제한 확인
      const existingCount = await this.Todo.countDocuments({
        userId: String(userId),
        isActive: true,
      });

      if (existingCount >= this.config.maxTodosPerUser) {
        this.stats.validationErrors++;
        return {
          success: false,
          error: `할일은 최대 ${this.config.maxTodosPerUser}개까지만 등록 가능합니다`,
        };
      }

      // 📝 할일 데이터 구성
      const todoData = {
        userId: String(userId),
        text: (typeof data === "string" ? data : data.text || "").trim(),
        description: data.description || null,
        completed: false,
        priority: data.priority || 3,
        category: data.category || "일반",
        tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      };

      // 빈 텍스트 검증
      if (!todoData.text) {
        this.stats.validationErrors++;
        return {
          success: false,
          error: "할일 내용이 비어있습니다",
        };
      }

      // 🎯 Mongoose 모델 인스턴스 생성 및 저장
      const todo = new this.Todo(todoData);
      const savedTodo = await todo.save(); // Mongoose 자동 검증!

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(`➕ 할일 추가됨: ${savedTodo.text} (ID: ${savedTodo._id})`);

      return {
        success: true,
        data: {
          id: savedTodo._id.toString(),
          userId: savedTodo.userId,
          text: savedTodo.text,
          priority: savedTodo.priority,
          category: savedTodo.category,
          createdAt: savedTodo.createdAt,
        },
      };
    } catch (error) {
      this.stats.errorCount++;

      // Mongoose 검증 오류 처리
      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const validationMessage = Object.values(error.errors)
          .map((e) => e.message)
          .join(", ");
        return {
          success: false,
          error: `검증 실패: ${validationMessage}`,
        };
      }

      logger.error("할일 추가 실패 (Mongoose):", error);
      return {
        success: false,
        error: "할일 추가 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 🔄 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
        };
      }

      // 🎯 Mongoose 인스턴스 메서드 활용
      const updatedTodo = await todo.toggle();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      const status = updatedTodo.completed ? "완료" : "미완료";
      logger.debug(`🔄 할일 상태 변경: ${updatedTodo.text} -> ${status}`);

      return {
        success: true,
        data: {
          id: updatedTodo._id.toString(),
          text: updatedTodo.text,
          completed: updatedTodo.completed,
          completedAt: updatedTodo.completedAt,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 토글 실패 (Mongoose):", error);
      return {
        success: false,
        error: "상태 변경 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 🗑️ 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
        };
      }

      // 🎯 Mongoose 인스턴스 메서드로 소프트 삭제
      await todo.softDelete();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(`🗑️ 할일 삭제됨: ${todo.text} (ID: ${todoId})`);

      return {
        success: true,
        data: {
          id: todoId,
          text: todo.text,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 삭제 실패 (Mongoose):", error);
      return {
        success: false,
        error: "삭제 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * ✏️ 할일 수정
   */
  async updateTodo(userId, todoId, data) {
    this.stats.operationsCount++;

    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
        };
      }

      // 업데이트할 필드들
      if (data.text !== undefined) todo.text = data.text.trim();
      if (data.description !== undefined) todo.description = data.description;
      if (data.priority !== undefined) todo.priority = data.priority;
      if (data.category !== undefined) todo.category = data.category;
      if (data.tags !== undefined)
        todo.tags = Array.isArray(data.tags) ? data.tags : [];
      if (data.dueDate !== undefined) {
        todo.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }

      const updatedTodo = await todo.save();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(`✏️ 할일 수정됨: ${updatedTodo.text} (ID: ${todoId})`);

      return {
        success: true,
        data: {
          id: updatedTodo._id.toString(),
          userId: updatedTodo.userId,
          text: updatedTodo.text,
          description: updatedTodo.description,
          priority: updatedTodo.priority,
          category: updatedTodo.category,
          tags: updatedTodo.tags,
          dueDate: updatedTodo.dueDate,
          updatedAt: updatedTodo.updatedAt,
        },
      };
    } catch (error) {
      this.stats.errorCount++;

      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const validationMessage = Object.values(error.errors)
          .map((e) => e.message)
          .join(", ");
        return {
          success: false,
          error: `검증 실패: ${validationMessage}`,
        };
      }

      logger.error("할일 수정 실패 (Mongoose):", error);
      return {
        success: false,
        error: "수정 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 🔍 할일 단건 조회
   */
  async getTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
        };
      }

      this.stats.successCount++;

      return {
        success: true,
        data: {
          id: todo._id.toString(),
          userId: todo.userId,
          text: todo.text,
          description: todo.description,
          completed: todo.completed,
          completedAt: todo.completedAt,
          priority: todo.priority,
          category: todo.category,
          tags: todo.tags,
          dueDate: todo.dueDate,
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
          isActive: todo.isActive,
          daysUntilDue: todo.daysUntilDue,
          isOverdue: todo.isOverdue,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 조회 실패 (Mongoose):", error);
      return {
        success: false,
        error: "조회 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 📊 할일 통계 조회
   */
  async getTodoStats(userId) {
    this.stats.operationsCount++;

    try {
      // 🎯 Mongoose 정적 메서드로 카테고리별 통계
      const categoryStats = await this.Todo.getCategoryStats(userId);

      // 기본 통계
      const allTodos = await this.Todo.find({
        userId: String(userId),
        isActive: true,
      });

      const total = allTodos.length;
      const completed = allTodos.filter((t) => t.completed).length;
      const pending = total - completed;
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      // 우선순위별 통계
      const priority = {
        high: allTodos.filter((t) => t.priority >= 4).length,
        medium: allTodos.filter((t) => t.priority === 3).length,
        low: allTodos.filter((t) => t.priority <= 2).length,
      };

      // 오늘/이번 주 완료된 할일
      const today = TimeHelper.getStartOfDay();
      const thisWeekStart = TimeHelper.getStartOfWeek();

      const completedToday = allTodos.filter(
        (t) => t.completed && t.completedAt && t.completedAt >= today
      ).length;

      const completedThisWeek = allTodos.filter(
        (t) => t.completed && t.completedAt && t.completedAt >= thisWeekStart
      ).length;

      // 🎯 오늘 마감인 할일 (Mongoose 정적 메서드)
      const dueToday = await this.Todo.findDueToday(userId);

      // 🎯 지연된 할일 (Mongoose 정적 메서드)
      const overdue = await this.Todo.findOverdue(userId);

      this.stats.successCount++;

      return {
        success: true,
        data: {
          overview: {
            total,
            completed,
            pending,
            completionRate,
          },
          priority,
          recent: {
            completedToday,
            completedThisWeek,
          },
          schedule: {
            dueToday: dueToday.length,
            overdue: overdue.length,
          },
          categories: categoryStats,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 통계 조회 실패 (Mongoose):", error);
      return {
        success: false,
        error: "통계 조회 중 오류가 발생했습니다",
      };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🔄 사용자 캐시 무효화
   */
  invalidateUserCache(userId) {
    if (!this.config.enableCache) return;

    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`todos:${userId}`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.debug(
      `🔄 사용자 ${userId} 캐시 무효화 (${keysToDelete.length}개 키)`
    );
  }

  /**
   * ✅ 캐시 유효성 검사
   */
  isValidCache(cacheKey) {
    if (!this.cache.has(cacheKey)) return false;

    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;

    const isExpired = Date.now() - timestamp > this.config.cacheTimeout;
    if (isExpired) {
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * 🧹 캐시 정리
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.debug("🧹 TodoService 캐시 정리됨");
  }

  /**
   * 🔧 캐시 크기 제한
   */
  maintainCacheSize() {
    const maxCacheSize = 1000; // 최대 1000개 엔트리

    if (this.cache.size > maxCacheSize) {
      // 가장 오래된 것부터 삭제
      const entries = Array.from(this.cacheTimestamps.entries()).sort(
        (a, b) => a[1] - b[1]
      );

      const toDelete = entries.slice(0, entries.length - maxCacheSize + 100);

      toDelete.forEach(([key]) => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      });

      logger.debug(`🔧 캐시 크기 조정: ${toDelete.length}개 엔트리 삭제`);
    }
  }

  /**
   * 🔍 할일 검색 (텍스트 검색)
   */
  async searchTodos(userId, searchText, options = {}) {
    this.stats.operationsCount++;

    try {
      if (!searchText || searchText.trim().length < 2) {
        return {
          success: false,
          error: "검색어는 최소 2글자 이상 입력해주세요",
        };
      }

      const searchRegex = new RegExp(searchText.trim(), "i");

      const todos = await this.Todo.find({
        userId: String(userId),
        isActive: true,
        $or: [
          { text: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } },
        ],
      })
        .sort(options.sort || { completed: 1, createdAt: -1 })
        .limit(options.limit || 20);

      const processedTodos = todos.map((todo) => ({
        id: todo._id.toString(),
        userId: todo.userId,
        text: todo.text,
        description: todo.description,
        completed: todo.completed,
        completedAt: todo.completedAt,
        priority: todo.priority,
        category: todo.category,
        tags: todo.tags,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        isActive: todo.isActive,
        daysUntilDue: todo.daysUntilDue,
        isOverdue: todo.isOverdue,
      }));

      this.stats.successCount++;
      logger.debug(
        `🔍 할일 검색 완료: "${searchText}" -> ${processedTodos.length}개 결과`
      );

      return {
        success: true,
        data: processedTodos,
        searchText: searchText.trim(),
        resultCount: processedTodos.length,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 검색 실패 (Mongoose):", error);
      return {
        success: false,
        error: "검색 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 📅 마감일별 할일 조회
   */
  async getTodosByDueDate(userId, dueDate, options = {}) {
    this.stats.operationsCount++;

    try {
      const targetDate = new Date(dueDate);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const todos = await this.Todo.find({
        userId: String(userId),
        isActive: true,
        dueDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }).sort({ priority: -1, createdAt: -1 });

      const processedTodos = todos.map((todo) => ({
        id: todo._id.toString(),
        userId: todo.userId,
        text: todo.text,
        completed: todo.completed,
        priority: todo.priority,
        category: todo.category,
        dueDate: todo.dueDate,
        isOverdue: todo.isOverdue,
      }));

      this.stats.successCount++;

      return {
        success: true,
        data: processedTodos,
        date: startOfDay,
        count: processedTodos.length,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("마감일별 할일 조회 실패:", error);
      return {
        success: false,
        error: "조회 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 🏷️ 태그별 할일 조회
   */
  async getTodosByTag(userId, tag, options = {}) {
    this.stats.operationsCount++;

    try {
      const todos = await this.Todo.find({
        userId: String(userId),
        isActive: true,
        tags: { $in: [tag.toLowerCase()] },
      })
        .sort(options.sort || { completed: 1, createdAt: -1 })
        .limit(options.limit || 50);

      const processedTodos = todos.map((todo) => ({
        id: todo._id.toString(),
        text: todo.text,
        completed: todo.completed,
        priority: todo.priority,
        category: todo.category,
        tags: todo.tags,
        createdAt: todo.createdAt,
      }));

      this.stats.successCount++;

      return {
        success: true,
        data: processedTodos,
        tag: tag,
        count: processedTodos.length,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("태그별 할일 조회 실패:", error);
      return {
        success: false,
        error: "조회 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 📈 사용자 태그 목록 조회
   */
  async getUserTags(userId) {
    this.stats.operationsCount++;

    try {
      const result = await this.Todo.aggregate([
        {
          $match: {
            userId: String(userId),
            isActive: true,
          },
        },
        {
          $unwind: "$tags",
        },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: ["$completed", 1, 0] },
            },
          },
        },
        {
          $project: {
            tag: "$_id",
            count: 1,
            completed: 1,
            pending: { $subtract: ["$count", "$completed"] },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      this.stats.successCount++;

      return {
        success: true,
        data: result,
        totalTags: result.length,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("사용자 태그 조회 실패:", error);
      return {
        success: false,
        error: "태그 조회 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 🔄 할일 우선순위 변경
   */
  async updateTodoPriority(userId, todoId, priority) {
    this.stats.operationsCount++;

    try {
      if (priority < 1 || priority > 5) {
        return {
          success: false,
          error: "우선순위는 1~5 사이의 값이어야 합니다",
        };
      }

      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
        };
      }

      // 🎯 Mongoose 인스턴스 메서드 활용
      const updatedTodo = await todo.setPriority(priority);

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(`🔄 할일 우선순위 변경: ${updatedTodo.text} -> ${priority}`);

      return {
        success: true,
        data: {
          id: updatedTodo._id.toString(),
          text: updatedTodo.text,
          priority: updatedTodo.priority,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 우선순위 변경 실패:", error);
      return {
        success: false,
        error: "우선순위 변경 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * ⚠️ 모든 할일 삭제 (위험한 작업)
   */
  async deleteAllTodos(userId, confirm = false) {
    if (!confirm) {
      return {
        success: false,
        error: "확인이 필요한 작업입니다",
      };
    }

    this.stats.operationsCount++;

    try {
      const result = await this.Todo.updateMany(
        {
          userId: String(userId),
          isActive: true,
        },
        {
          $set: { isActive: false },
        }
      );

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.warn(
        `⚠️ 사용자 ${userId}의 모든 할일 삭제됨 (${result.modifiedCount}개)`
      );

      return {
        success: true,
        data: {
          deletedCount: result.modifiedCount,
        },
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("모든 할일 삭제 실패:", error);
      return {
        success: false,
        error: "삭제 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * 📊 서비스 상태 정보
   */
  getStatus() {
    // 캐시 크기 유지
    this.maintainCacheSize();

    return {
      initialized: !!this.Todo,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: this.stats,
      environment: this.isRailway ? "railway" : "local",

      // Mongoose 관련 정보
      mongoose: {
        validationEnabled: this.config.enableValidation,
        validationErrors: this.stats.validationErrors,
        modelMethods: [
          "findByUser",
          "findDueToday",
          "findOverdue",
          "getCategoryStats",
        ],
        instanceMethods: [
          "toggle",
          "softDelete",
          "restore",
          "setPriority",
          "addTag",
          "removeTag",
        ],
      },
    };
  }

  /**
   * 🧹 정리 작업 (앱 종료 시)
   */
  async cleanup() {
    try {
      this.clearCache();
      logger.info("✅ TodoService 정리 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TodoService 정리 실패:", error);
    }
  }
}

module.exports = TodoService;
