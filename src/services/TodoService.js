// src/services/TodoService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
/**
 * 📋 TodoService - 할일 데이터 서비스 (심플 버전)
 */
class TodoService extends BaseService {
  constructor(options = {}) {
    super("TodoService", options);
  }

  getRequiredModels() {
    return ["Todo"];
  }

  async getTodos(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;

      const query = { userId: userId.toString(), isActive: true };

      const [totalCount, todos] = await Promise.all([
        this.models.Todo.countDocuments(query),
        this.models.Todo.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      return this.createSuccessResponse({
        todos,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      });
    } catch (error) {
      return this.createErrorResponse(error, "할일 목록 조회 실패");
    }
  }

  async addTodo(userId, todoData) {
    try {
      const newTodo = new this.models.Todo({
        userId: userId.toString(),
        text: todoData.text.trim(), // 'title'을 모델 스키마에 맞는 'text'로 변경
        description: todoData.description?.trim(),
        priority: todoData.priority || 3,
      });

      const savedTodo = await newTodo.save();

      return this.createSuccessResponse(
        savedTodo.toJSON(),
        "할일이 추가되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "할일 추가 실패");
    }
  }

  async toggleTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true,
      });

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? new Date() : undefined;

      const updatedTodo = await todo.save();

      return this.createSuccessResponse(
        updatedTodo.toJSON(),
        `할일을 ${todo.completed ? "완료" : "미완료"}로 변경했습니다.`
      );
    } catch (error) {
      return this.createErrorResponse(error, "할일 상태 변경 실패");
    }
  }

  async deleteTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOneAndUpdate(
        { _id: todoId, userId: userId.toString(), isActive: true },
        { isActive: false },
        { new: true }
      );

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "삭제할 할일을 찾을 수 없습니다."
        );
      }

      return this.createSuccessResponse(
        { deletedId: todoId },
        "할일이 삭제되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "할일 삭제 실패");
    }
  }
  // ===== 🎯 누락된 메서드 추가 =====

  /**
   * 📊 할일 통계 조회
   */
  async getStats(userId) {
    try {
      const stats = await this.models.Todo.aggregate([
        { $match: { userId: userId.toString(), isActive: true } },
        {
          $group: {
            _id: "$completed",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        total: 0,
        completed: 0,
        pending: 0,
      };

      stats.forEach((stat) => {
        if (stat._id === true) {
          result.completed = stat.count;
        } else {
          result.pending = stat.count;
        }
        result.total += stat.count;
      });

      return this.createSuccessResponse(result);
    } catch (error) {
      return this.createErrorResponse(error, "통계 조회 실패");
    }
  }

  /**
   * 🔢 사용자의 할일 개수 조회
   */
  async getTodoCount(userId) {
    try {
      const count = await this.models.Todo.countDocuments({
        userId: userId.toString(),
        isActive: true,
      });
      return this.createSuccessResponse(count);
    } catch (error) {
      return this.createErrorResponse(error, "할일 개수 조회 실패");
    }
  }

  /**
   * 🆔 ID로 특정 할일 조회
   */
  async getTodoById(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true,
      }).lean();

      if (!todo) {
        return this.createErrorResponse(
          new Error("NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }
      return this.createSuccessResponse(todo);
    } catch (error) {
      return this.createErrorResponse(error, "할일 조회 실패");
    }
  }
}

module.exports = TodoService;
