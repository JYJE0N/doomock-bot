// src/services/TodoService.js - Mongoose 버전
const logger = require("../utils/Logger");

class TodoService {
  constructor(options = {}) {
    // Mongoose 모델은 나중에 주입받음
    this.Todo = null;
    this.config = options.config || {};

    logger.info("🔧 TodoService 생성됨 (Mongoose 버전)");
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    try {
      // MongooseManager에서 모델 가져오기
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

  /**
   * 할일 목록 조회
   */
  async getTodos(userId, options = {}) {
    try {
      const todos = await this.Todo.findByUser(userId, {
        filter: options.filter || {},
        sort: options.sort || { createdAt: -1 },
        limit: options.limit,
      });

      logger.debug(`할일 ${todos.length}개 조회됨 (사용자: ${userId})`);
      return todos;
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 추가
   */
  async addTodo(userId, data) {
    try {
      // 문자열 또는 객체 모두 지원
      const todoData = typeof data === "string" ? { text: data } : data;

      const todo = new this.Todo({
        userId: String(userId),
        ...todoData,
      });

      const savedTodo = await todo.save();
      logger.info(`할일 추가됨: ${savedTodo._id} (사용자: ${userId})`);

      return savedTodo;
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      const updatedTodo = await todo.toggle();
      logger.info(`할일 토글됨: ${todoId} -> ${updatedTodo.completed}`);

      return updatedTodo;
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 수정
   */
  async updateTodo(userId, todoId, updates) {
    try {
      const todo = await this.Todo.findOneAndUpdate(
        {
          _id: todoId,
          userId: String(userId),
          isActive: true,
        },
        updates,
        {
          new: true, // 업데이트된 문서 반환
          runValidators: true, // 스키마 검증 실행
        }
      );

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      logger.info(`할일 수정됨: ${todoId}`);
      return todo;
    } catch (error) {
      logger.error("할일 수정 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    try {
      const todo = await this.Todo.findOne({
        _id: todoId,
        userId: String(userId),
        isActive: true,
      });

      if (!todo) {
        return false;
      }

      await todo.softDelete();
      logger.info(`할일 삭제됨: ${todoId} (사용자: ${userId})`);

      return true;
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 완전 삭제 (하드 삭제)
   */
  async hardDeleteTodo(userId, todoId) {
    try {
      const result = await this.Todo.deleteOne({
        _id: todoId,
        userId: String(userId),
      });

      if (result.deletedCount > 0) {
        logger.warn(`할일 완전 삭제됨: ${todoId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("할일 완전 삭제 실패:", error);
      throw error;
    }
  }

  /**
   * 우선순위별 할일 조회
   */
  async getTodosByPriority(userId, priority) {
    try {
      return await this.Todo.findByUser(userId, {
        filter: { priority },
      });
    } catch (error) {
      logger.error("우선순위별 할일 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 카테고리별 할일 조회
   */
  async getTodosByCategory(userId, category) {
    try {
      return await this.Todo.findByUser(userId, {
        filter: { category },
      });
    } catch (error) {
      logger.error("카테고리별 할일 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 태그로 할일 조회
   */
  async getTodosByTags(userId, tags) {
    try {
      return await this.Todo.findByUser(userId, {
        filter: { tags: { $in: tags } },
      });
    } catch (error) {
      logger.error("태그별 할일 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 오늘 마감인 할일 조회
   */
  async getTodosDueToday(userId) {
    try {
      return await this.Todo.findDueToday(userId);
    } catch (error) {
      logger.error("오늘 마감 할일 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 지연된 할일 조회
   */
  async getOverdueTodos(userId) {
    try {
      return await this.Todo.findOverdue(userId);
    } catch (error) {
      logger.error("지연된 할일 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 통계 조회
   */
  async getTodoStats(userId) {
    try {
      const [total, completed, categoryStats] = await Promise.all([
        this.Todo.countDocuments({
          userId: String(userId),
          isActive: true,
        }),
        this.Todo.countDocuments({
          userId: String(userId),
          isActive: true,
          completed: true,
        }),
        this.Todo.getCategoryStats(userId),
      ]);

      const pending = total - completed;
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        completed,
        pending,
        completionRate,
        byCategory: categoryStats,
      };
    } catch (error) {
      logger.error("할일 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 할일 검색
   */
  async searchTodos(userId, searchText, options = {}) {
    try {
      const searchOptions = {
        filter: {
          $text: { $search: searchText },
        },
        ...options,
      };

      return await this.Todo.findByUser(userId, searchOptions);
    } catch (error) {
      logger.error("할일 검색 실패:", error);
      throw error;
    }
  }

  /**
   * 벌크 작업 - 여러 할일 완료 처리
   */
  async completeTodos(userId, todoIds) {
    try {
      const result = await this.Todo.updateMany(
        {
          _id: { $in: todoIds },
          userId: String(userId),
          isActive: true,
        },
        {
          $set: {
            completed: true,
            completedAt: new Date(),
          },
        }
      );

      logger.info(`${result.modifiedCount}개 할일 완료 처리됨`);
      return result.modifiedCount;
    } catch (error) {
      logger.error("벌크 완료 처리 실패:", error);
      throw error;
    }
  }

  /**
   * 벌크 작업 - 여러 할일 삭제
   */
  async deleteTodos(userId, todoIds) {
    try {
      const result = await this.Todo.softDeleteMany({
        _id: { $in: todoIds },
        userId: String(userId),
      });

      logger.info(`${result.modifiedCount}개 할일 삭제됨`);
      return result.modifiedCount;
    } catch (error) {
      logger.error("벌크 삭제 실패:", error);
      throw error;
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TodoService",
      isReady: !!this.Todo,
      modelName: this.Todo?.modelName || "Not initialized",
      collectionName: this.Todo?.collection?.name || "Not available",
    };
  }
}

module.exports = TodoService;
