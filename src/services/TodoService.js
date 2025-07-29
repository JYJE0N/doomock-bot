// src/services/TodoService.js - 🎯 Mongoose 기반 할일 데이터 서비스
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
      const cacheKey = `todos:${userId}`;
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
        throw new Error(
          `할일은 최대 ${this.config.maxTodosPerUser}개까지만 등록 가능합니다`
        );
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
        throw new Error("할일 내용이 비어있습니다");
      }

      // 🎯 Mongoose 모델 인스턴스 생성 및 저장
      const todo = new this.Todo(todoData);
      const savedTodo = await todo.save(); // Mongoose 자동 검증!

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `➕ Mongoose 할일 추가: ${savedTodo._id} (사용자: ${userId})`
      );

      // 응답 데이터 정규화
      return {
        id: savedTodo._id.toString(),
        userId: savedTodo.userId,
        text: savedTodo.text,
        description: savedTodo.description,
        completed: savedTodo.completed,
        priority: savedTodo.priority,
        category: savedTodo.category,
        tags: savedTodo.tags,
        dueDate: savedTodo.dueDate,
        createdAt: savedTodo.createdAt,
        updatedAt: savedTodo.updatedAt,
        isActive: savedTodo.isActive,
      };
    } catch (error) {
      this.stats.errorCount++;

      // Mongoose 검증 오류 처리
      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const validationMessages = Object.values(error.errors).map(
          (e) => e.message
        );
        throw new Error(`데이터 검증 실패: ${validationMessages.join(", ")}`);
      }

      logger.error("할일 추가 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * ✅ 할일 완료/미완료 토글 (Mongoose 인스턴스 메서드 활용)
   */
  async toggleTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      // 🎯 Mongoose findOne으로 문서 조회
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 🎯 Mongoose 인스턴스 메서드 사용
      const updatedTodo = await todo.toggle(); // 모델에 정의된 toggle() 메서드

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `✅ Mongoose 할일 토글: ${todoId} -> ${updatedTodo.completed} (사용자: ${userId})`
      );

      // 응답 데이터 정규화
      return {
        id: updatedTodo._id.toString(),
        userId: updatedTodo.userId,
        text: updatedTodo.text,
        completed: updatedTodo.completed,
        completedAt: updatedTodo.completedAt,
        priority: updatedTodo.priority,
        category: updatedTodo.category,
        tags: updatedTodo.tags,
        dueDate: updatedTodo.dueDate,
        createdAt: updatedTodo.createdAt,
        updatedAt: updatedTodo.updatedAt,
        isActive: updatedTodo.isActive,

        // 가상 속성들
        daysUntilDue: updatedTodo.daysUntilDue,
        isOverdue: updatedTodo.isOverdue,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 토글 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🗑️ 할일 삭제 (Mongoose 소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    this.stats.operationsCount++;

    try {
      // 🎯 Mongoose findOne으로 문서 조회
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 🎯 Mongoose 인스턴스 메서드 사용 (소프트 삭제)
      await todo.softDelete(); // 모델에 정의된 softDelete() 메서드

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`🗑️ Mongoose 할일 삭제: ${todoId} (사용자: ${userId})`);

      return true;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("할일 삭제 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📊 간단한 통계 조회 (Mongoose Aggregation)
   */
  async getTodoStats(userId) {
    this.stats.operationsCount++;

    try {
      // 🎯 Mongoose 정적 메서드 활용하여 통계 조회
      const categoryStats = await this.Todo.getCategoryStats(userId);

      // 전체 통계 계산
      const totalStats = categoryStats.reduce(
        (acc, cat) => ({
          total: acc.total + cat.total,
          completed: acc.completed + cat.completed,
          pending: acc.pending + cat.pending,
        }),
        { total: 0, completed: 0, pending: 0 }
      );

      const completionRate =
        totalStats.total > 0
          ? Math.round((totalStats.completed / totalStats.total) * 100)
          : 0;

      const stats = {
        total: totalStats.total,
        completed: totalStats.completed,
        pending: totalStats.pending,
        completionRate,

        // 카테고리별 세부 통계
        categories: categoryStats,
      };

      this.stats.successCount++;
      return stats;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("통계 조회 실패 (Mongoose):", error);

      // 기본 통계로 폴백
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
        categories: [],
      };
    }
  }

  /**
   * 🔍 오늘 마감인 할일 조회 (Mongoose 정적 메서드)
   */
  async getTodosDueToday(userId) {
    this.stats.operationsCount++;

    try {
      const todosDue = await this.Todo.findDueToday(userId);

      this.stats.successCount++;
      return todosDue.map((todo) => ({
        id: todo._id.toString(),
        text: todo.text,
        dueDate: todo.dueDate,
        priority: todo.priority,
        category: todo.category,
        isOverdue: todo.isOverdue,
      }));
    } catch (error) {
      this.stats.errorCount++;
      logger.error("오늘 마감 할일 조회 실패:", error);
      return [];
    }
  }

  /**
   * ⚠️ 지연된 할일 조회 (Mongoose 정적 메서드)
   */
  async getOverdueTodos(userId) {
    this.stats.operationsCount++;

    try {
      const overdueTodos = await this.Todo.findOverdue(userId);

      this.stats.successCount++;
      return overdueTodos.map((todo) => ({
        id: todo._id.toString(),
        text: todo.text,
        dueDate: todo.dueDate,
        priority: todo.priority,
        category: todo.category,
        daysOverdue: Math.abs(todo.daysUntilDue) || 0,
      }));
    } catch (error) {
      this.stats.errorCount++;
      logger.error("지연된 할일 조회 실패:", error);
      return [];
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 캐시 유효성 검사
   */
  isValidCache(key) {
    if (!this.cache.has(key) || !this.cacheTimestamps.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    return Date.now() - timestamp < this.config.cacheTimeout;
  }

  /**
   * 사용자 캐시 무효화
   */
  invalidateUserCache(userId) {
    const cacheKey = `todos:${userId}`;
    this.cache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);
  }

  /**
   * 전체 캐시 정리
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.debug("📝 TodoService 캐시 정리됨 (Mongoose)");
  }

  /**
   * 서비스 상태 조회 (Mongoose 정보 포함)
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      framework: "Mongoose", // ✨ Mongoose 사용 표시
      modelName: "Todo",
      isConnected: !!this.Todo,
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
   * 정리 작업 (앱 종료 시)
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
