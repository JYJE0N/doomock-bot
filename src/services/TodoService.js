// src/services/TodoService.js - 데이터 관리 전담 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 📋 TodoService - 데이터 관리만 담당
 *
 * ✅ 역할: 데이터베이스 조회, 데이터 가공, 비즈니스 데이터 로직
 * ❌ 하지 않는 것: UI 생성, 메시지 전송, 콜백 처리
 */
class TodoService extends BaseService {
  constructor(options = {}) {
    super("TodoService", options);

    this.config = {
      maxTodosPerUser: 100,
      archiveAfterDays: 30,
      cacheTimeout: 300000, // 5분
      ...options.config
    };

    logger.info("📋 TodoService 생성됨");
  }

  /**
   * 필수 모델 정의
   */
  getRequiredModels() {
    return ["Todo", "Reminder"];
  }

  /**
   * 서비스 초기화
   */
  async onInitialize() {
    try {
      // 인덱스 최적화
      if (this.models.Todo) {
        await this.models.Todo.collection.createIndex({
          userId: 1,
          isActive: 1
        });
        await this.models.Todo.collection.createIndex({
          userId: 1,
          completed: 1
        });
        await this.models.Todo.collection.createIndex({ createdAt: -1 });
        await this.models.Todo.collection.createIndex({
          userId: 1,
          remindAt: 1
        });
      }

      if (this.models.Reminder) {
        await this.models.Reminder.collection.createIndex({
          userId: 1,
          todoId: 1
        });
        await this.models.Reminder.collection.createIndex({
          remindAt: 1,
          isActive: 1
        });
        await this.models.Reminder.collection.createIndex({
          userId: 1,
          isActive: 1
        });
      }

      logger.success("✅ TodoService 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 기본 CRUD 메서드 =====

  /**
   * 할일 목록 조회
   */
  async getTodos(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        includeCompleted = true,
        sortBy = "createdAt",
        sortOrder = -1
      } = options;

      const query = {
        userId: userId.toString(),
        isActive: true
      };

      if (!includeCompleted) {
        query.completed = false;
      }

      const [totalCount, todos] = await Promise.all([
        this.models.Todo.countDocuments(query),
        this.models.Todo.find(query)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      ]);

      return this.createSuccessResponse({
        todos,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      });
    } catch (error) {
      return this.createErrorResponse(error, "할일 목록 조회 실패");
    }
  }

  /**
   * 특정 할일 조회
   */
  async getTodoById(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      }).lean();

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      return this.createSuccessResponse(todo);
    } catch (error) {
      return this.createErrorResponse(error, "할일 조회 실패");
    }
  }

  /**
   * 할일 추가
   */
  async addTodo(userId, todoData) {
    try {
      // 사용자 할일 수 체크
      const userTodoCount = await this.models.Todo.countDocuments({
        userId: userId.toString(),
        isActive: true
      });

      if (userTodoCount >= this.config.maxTodosPerUser) {
        return this.createErrorResponse(
          new Error("LIMIT_EXCEEDED"),
          `할일은 최대 ${this.config.maxTodosPerUser}개까지 등록 가능합니다.`
        );
      }

      // 텍스트 검증
      const todoText = todoData.text?.trim();
      if (!todoText) {
        return this.createErrorResponse(
          new Error("MISSING_TEXT"),
          "할일 내용이 필요합니다."
        );
      }

      // 중복 체크
      const existingTodo = await this.models.Todo.findOne({
        userId: userId.toString(),
        text: todoText,
        isActive: true,
        completed: false
      });

      if (existingTodo) {
        return this.createErrorResponse(
          new Error("DUPLICATE_TODO"),
          "이미 동일한 할일이 존재합니다."
        );
      }

      // 새 할일 생성
      const newTodo = new this.models.Todo({
        userId: userId.toString(),
        text: todoText,
        description: todoData.description?.trim() || null,
        priority: todoData.priority || "medium",
        category: todoData.category?.trim() || null,
        tags: todoData.tags || [],
        dueDate: todoData.dueDate || null,
        remindAt: todoData.remindAt || null
      });

      const savedTodo = await newTodo.save();

      // 리마인더 생성 (있는 경우)
      if (todoData.remindAt && this.models.Reminder) {
        await this.createReminder(userId, {
          todoId: savedTodo._id,
          remindAt: todoData.remindAt,
          message: todoData.reminderMessage || todoText
        });
      }

      logger.info(`📋 할일 추가: ${userId} - "${todoText}"`);

      return this.createSuccessResponse(
        savedTodo.toJSON(),
        "할일이 추가되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "할일 추가 실패");
    }
  }

  /**
   * 할일 수정
   */
  async updateTodo(userId, todoId, updateData) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      });

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      // 허용된 필드만 업데이트
      const allowedFields = [
        "text",
        "description",
        "priority",
        "category",
        "tags",
        "dueDate",
        "remindAt"
      ];
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          todo[field] = updateData[field];
        }
      });

      const updatedTodo = await todo.save();

      return this.createSuccessResponse(
        updatedTodo.toJSON(),
        "할일이 수정되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "할일 수정 실패");
    }
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      });

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      // 상태 토글
      todo.completed = !todo.completed;
      const updatedTodo = await todo.save();

      const message = todo.completed
        ? "할일이 완료되었습니다."
        : "할일이 미완료로 변경되었습니다.";

      return this.createSuccessResponse(updatedTodo.toJSON(), message);
    } catch (error) {
      return this.createErrorResponse(error, "상태 변경 실패");
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      });

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      // 소프트 삭제
      todo.isActive = false;
      await todo.save();

      // 관련 리마인더도 비활성화
      if (this.models.Reminder) {
        await this.models.Reminder.updateMany(
          { todoId: todoId, userId: userId.toString() },
          { isActive: false }
        );
      }

      return this.createSuccessResponse(null, "할일이 삭제되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "할일 삭제 실패");
    }
  }

  /**
   * 할일 보관
   */
  async archiveTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      });

      if (!todo) {
        return this.createErrorResponse(
          new Error("TODO_NOT_FOUND"),
          "할일을 찾을 수 없습니다."
        );
      }

      todo.archived = true;
      todo.archivedAt = new Date();
      await todo.save();

      return this.createSuccessResponse(null, "할일이 보관되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "할일 보관 실패");
    }
  }

  // ===== 통계 및 분석 메서드 =====

  /**
   * 할일 통계
   */
  async getTodoStats(userId) {
    try {
      const stats = await this.models.Todo.aggregate([
        {
          $match: {
            userId: userId.toString(),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: ["$completed", 1, 0] }
            },
            pending: {
              $sum: { $cond: ["$completed", 0, 1] }
            }
          }
        }
      ]);

      const result = stats[0] || { total: 0, completed: 0, pending: 0 };
      result.completionRate =
        result.total > 0
          ? Math.round((result.completed / result.total) * 100)
          : 0;

      return this.createSuccessResponse(result);
    } catch (error) {
      return this.createErrorResponse(error, "통계 조회 실패");
    }
  }

  /**
   * 주간 리포트
   */
  async getWeeklyReport(userId) {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalAdded, totalCompleted, pendingTodos] = await Promise.all([
        // 이번 주 추가된 할일
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          createdAt: { $gte: weekAgo },
          isActive: true
        }),
        // 이번 주 완료된 할일
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          completedAt: { $gte: weekAgo },
          completed: true,
          isActive: true
        }),
        // 현재 미완료 할일
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          completed: false,
          isActive: true
        })
      ]);

      // 일별 완료 통계
      const dailyStats = await this.models.Todo.aggregate([
        {
          $match: {
            userId: userId.toString(),
            completedAt: { $gte: weekAgo },
            completed: true,
            isActive: true
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      return this.createSuccessResponse({
        totalAdded,
        totalCompleted,
        pendingTodos,
        completionRate:
          totalAdded > 0 ? Math.round((totalCompleted / totalAdded) * 100) : 0,
        dailyStats,
        period: {
          start: weekAgo,
          end: now
        }
      });
    } catch (error) {
      return this.createErrorResponse(error, "주간 리포트 생성 실패");
    }
  }

  // ===== 리마인더 관련 메서드 =====

  /**
   * 리마인더 생성
   */
  async createReminder(userId, reminderData) {
    try {
      if (!this.models.Reminder) {
        return this.createErrorResponse(
          new Error("REMINDER_NOT_SUPPORTED"),
          "리마인더 기능을 사용할 수 없습니다."
        );
      }

      const reminder = new this.models.Reminder({
        userId: userId.toString(),
        todoId: reminderData.todoId,
        remindAt: reminderData.remindAt,
        message: reminderData.message,
        type: reminderData.type || "simple"
      });

      const savedReminder = await reminder.save();

      return this.createSuccessResponse(
        savedReminder.toJSON(),
        "리마인더가 설정되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "리마인더 생성 실패");
    }
  }

  /**
   * 리마인더 목록 조회
   */
  async getReminders(userId, options = {}) {
    try {
      if (!this.models.Reminder) {
        return this.createSuccessResponse({ reminders: [], totalCount: 0 });
      }

      const query = {
        userId: userId.toString(),
        isActive: true
      };

      if (options.todoId) {
        query.todoId = options.todoId;
      }

      const reminders = await this.models.Reminder.find(query)
        .populate("todoId", "text completed")
        .sort({ remindAt: 1 })
        .lean();

      return this.createSuccessResponse({
        reminders,
        totalCount: reminders.length
      });
    } catch (error) {
      return this.createErrorResponse(error, "리마인더 조회 실패");
    }
  }

  /**
   * 리마인더 삭제
   */
  async deleteReminder(userId, reminderId) {
    try {
      if (!this.models.Reminder) {
        return this.createErrorResponse(
          new Error("REMINDER_NOT_SUPPORTED"),
          "리마인더 기능을 사용할 수 없습니다."
        );
      }

      const reminder = await this.models.Reminder.findOne({
        _id: reminderId,
        userId: userId.toString(),
        isActive: true
      });

      if (!reminder) {
        return this.createErrorResponse(
          new Error("REMINDER_NOT_FOUND"),
          "리마인더를 찾을 수 없습니다."
        );
      }

      reminder.isActive = false;
      await reminder.save();

      return this.createSuccessResponse(null, "리마인더가 삭제되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "리마인더 삭제 실패");
    }
  }

  /**
   * 서비스 헬스체크
   */
  async healthCheck() {
    try {
      const _checks = await Promise.all([
        this.models.Todo.findOne({}).limit(1).exec(),
        this.models.Reminder
          ? this.models.Reminder.findOne({}).limit(1).exec()
          : Promise.resolve()
      ]);

      return {
        healthy: true,
        service: "TodoService",
        models: {
          Todo: "connected",
          Reminder: this.models.Reminder ? "connected" : "not available"
        }
      };
    } catch (error) {
      return {
        healthy: false,
        service: "TodoService",
        message: error.message
      };
    }
  }
}

module.exports = TodoService;
