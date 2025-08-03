// src/services/TodoService.js - 리마인드 기능이 강화된 할일 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 📋 TodoService - 할일 데이터 서비스 (리마인드 기능 강화)
 *
 * ✅ 새로운 기능:
 * - 주간/월간 통계 분석
 * - 스마트 할일 정리
 * - 리마인드 연동 데이터
 * - 생산성 분석
 */
class TodoService extends BaseService {
  constructor(options = {}) {
    super("TodoService", options);

    // 서비스 설정
    this.config = {
      maxTodosPerUser: 100,
      archiveAfterDays: 30,
      enableSmartAnalysis: true,
      cacheTimeout: 300000, // 5분
      ...options.config
    };

    logger.info("📋 TodoService 생성됨 (리마인드 기능 강화)");
  }

  getRequiredModels() {
    return ["Todo", "Reminder"];
  }

  async onInitialize() {
    try {
      // 인덱스 최적화
      if (this.models.Todo) {
        await this.models.Todo.collection.createIndex({ userId: 1, isActive: 1 });
        await this.models.Todo.collection.createIndex({ userId: 1, completed: 1 });
        await this.models.Todo.collection.createIndex({ createdAt: -1 });
      }

      logger.success("✅ TodoService 초기화 완료 (리마인드 기능 포함)");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
    }
  }

  // ===== 기본 CRUD 메서드들 =====

  /**
   * 📋 할일 목록 조회 (리마인드 정보 포함)
   */
  async getTodos(userId, options = {}) {
    try {
      const { page = 1, limit = 10, includeCompleted = true, includeReminders = false, sortBy = "createdAt", sortOrder = -1 } = options;

      const query = {
        userId: userId.toString(),
        isActive: true
      };

      // 완료된 할일 제외 옵션
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

      // 🆕 리마인드 정보 포함
      let enrichedTodos = todos;
      if (includeReminders && this.models.Reminder) {
        enrichedTodos = await this.enrichTodosWithReminders(todos);
      }

      return this.createSuccessResponse({
        todos: enrichedTodos,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        hasReminders: includeReminders
      });
    } catch (error) {
      return this.createErrorResponse(error, "할일 목록 조회 실패");
    }
  }

  /**
   * ➕ 할일 추가 (개선된 버전)
   */
  async addTodo(userId, todoData) {
    try {
      // 사용자 할일 수 체크
      const userTodoCount = await this.models.Todo.countDocuments({
        userId: userId.toString(),
        isActive: true
      });

      if (userTodoCount >= this.config.maxTodosPerUser) {
        return this.createErrorResponse(new Error("LIMIT_EXCEEDED"), `할일은 최대 ${this.config.maxTodosPerUser}개까지 등록 가능합니다.`);
      }

      // 할일 텍스트 검증
      const todoText = todoData.text || todoData.title;
      if (!todoText || todoText.trim().length === 0) {
        return this.createErrorResponse(new Error("MISSING_TEXT"), "할일 내용이 필요합니다.");
      }

      // 중복 체크
      const existingTodo = await this.models.Todo.findOne({
        userId: userId.toString(),
        text: todoText.trim(),
        isActive: true,
        completed: false
      });

      if (existingTodo) {
        return this.createErrorResponse(new Error("DUPLICATE_TODO"), "이미 동일한 할일이 존재합니다.");
      }

      // 새 할일 생성
      const newTodo = new this.models.Todo({
        userId: userId.toString(),
        text: todoText.trim(),
        description: todoData.description?.trim() || null,
        priority: this.validatePriority(todoData.priority),
        category: todoData.category?.trim() || null,
        tags: this.validateTags(todoData.tags),
        estimatedMinutes: todoData.estimatedMinutes || null
      });

      const savedTodo = await newTodo.save();

      logger.info(`📋 할일 추가: ${userId} - "${todoText}"`);

      return this.createSuccessResponse(savedTodo.toJSON(), "할일이 추가되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "할일 추가 실패");
    }
  }

  /**
   * ✅ 할일 완료 토글 (개선된 버전)
   */
  async toggleTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      });

      if (!todo) {
        return this.createErrorResponse(new Error("TODO_NOT_FOUND"), "할일을 찾을 수 없습니다.");
      }

      const wasCompleted = todo.completed;
      todo.completed = !todo.completed;

      if (todo.completed) {
        todo.completedAt = new Date();
        // 🆕 완료 시 관련 리마인드 비활성화
        if (this.models.Reminder) {
          await this.deactivateRemindersByTodoId(todoId);
        }
      } else {
        todo.completedAt = undefined;
      }

      const updatedTodo = await todo.save();

      logger.info(`✅ 할일 상태 변경: ${userId} - "${todo.text}" (${wasCompleted ? "미완료" : "완료"})`);

      return this.createSuccessResponse(updatedTodo.toJSON(), `할일을 ${todo.completed ? "완료" : "미완료"}로 변경했습니다.`);
    } catch (error) {
      return this.createErrorResponse(error, "할일 상태 변경 실패");
    }
  }

  /**
   * 🗑️ 할일 삭제 (소프트 삭제)
   */
  async deleteTodo(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOneAndUpdate(
        { _id: todoId, userId: userId.toString(), isActive: true },
        {
          isActive: false,
          deletedAt: new Date()
        },
        { new: true }
      );

      if (!todo) {
        return this.createErrorResponse(new Error("TODO_NOT_FOUND"), "삭제할 할일을 찾을 수 없습니다.");
      }

      // 🆕 관련 리마인드도 함께 삭제
      if (this.models.Reminder) {
        await this.deactivateRemindersByTodoId(todoId);
      }

      logger.info(`🗑️ 할일 삭제: ${userId} - "${todo.text}"`);

      return this.createSuccessResponse(todo.toJSON(), "할일이 삭제되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "할일 삭제 실패");
    }
  }

  // ===== 🆕 통계 및 분석 메서드들 =====

  /**
   * 📊 할일 기본 통계
   */
  async getTodoStats(userId) {
    try {
      const [pending, completed, archived, total] = await Promise.all([
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          isActive: true,
          completed: false
        }),
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          isActive: true,
          completed: true
        }),
        this.models.Todo.countDocuments({
          userId: userId.toString(),
          isActive: false
        }),
        this.models.Todo.countDocuments({
          userId: userId.toString()
        })
      ]);

      // 🆕 리마인드 통계 추가
      let reminderStats = null;
      if (this.models.Reminder) {
        const [activeReminders, totalReminders] = await Promise.all([
          this.models.Reminder.countDocuments({
            userId: userId.toString(),
            isActive: true,
            reminderTime: { $gt: new Date() }
          }),
          this.models.Reminder.countDocuments({
            userId: userId.toString()
          })
        ]);

        reminderStats = {
          active: activeReminders,
          total: totalReminders
        };
      }

      const stats = {
        pending,
        completed,
        archived,
        total,
        completionRate: total > 0 ? Math.round((completed / (pending + completed)) * 100) : 0,
        reminders: reminderStats
      };

      return this.createSuccessResponse(stats, "통계 조회 완료");
    } catch (error) {
      return this.createErrorResponse(error, "통계 조회 실패");
    }
  }

  /**
   * 📈 주간 통계 (새로운 기능)
   */
  async getWeeklyStats(userId) {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // 이번 주 일요일
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // 이번 주 생성된 할일
      const createdThisWeek = await this.models.Todo.countDocuments({
        userId: userId.toString(),
        createdAt: { $gte: weekStart, $lte: weekEnd }
      });

      // 이번 주 완료된 할일
      const completedThisWeek = await this.models.Todo.countDocuments({
        userId: userId.toString(),
        completedAt: { $gte: weekStart, $lte: weekEnd }
      });

      // 🆕 이번 주 리마인드 통계
      let reminderStats = null;
      if (this.models.Reminder) {
        const [remindersCreated, remindersTriggered] = await Promise.all([
          this.models.Reminder.countDocuments({
            userId: userId.toString(),
            createdAt: { $gte: weekStart, $lte: weekEnd }
          }),
          this.models.Reminder.countDocuments({
            userId: userId.toString(),
            reminderTime: { $gte: weekStart, $lte: weekEnd },
            isActive: false // 실행된 리마인드는 비활성화됨
          })
        ]);

        reminderStats = {
          created: remindersCreated,
          triggered: remindersTriggered
        };
      }

      // 일별 생산성 분석
      const dailyStats = await this.getDailyProductivity(userId, weekStart, weekEnd);

      const weeklyStats = {
        period: "이번 주",
        created: createdThisWeek,
        completed: completedThisWeek,
        completionRate: createdThisWeek > 0 ? Math.round((completedThisWeek / createdThisWeek) * 100) : 0,
        reminders: reminderStats,
        daily: dailyStats,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString()
      };

      return this.createSuccessResponse(weeklyStats, "주간 통계 조회 완료");
    } catch (error) {
      return this.createErrorResponse(error, "주간 통계 조회 실패");
    }
  }

  /**
   * 🧹 스마트 정리 (완료된 할일 아카이브)
   */
  async smartCleanup(userId, options = {}) {
    try {
      const {
        archiveCompletedDays = 7, // 7일 전 완료된 할일 아카이브
        deleteArchivedDays = 30 // 30일 전 아카이브 할일 삭제
      } = options;

      const now = new Date();

      // 아카이브할 완료 할일 찾기
      const archiveDate = new Date(now);
      archiveDate.setDate(now.getDate() - archiveCompletedDays);

      const archiveResult = await this.models.Todo.updateMany(
        {
          userId: userId.toString(),
          completed: true,
          completedAt: { $lt: archiveDate },
          isActive: true
        },
        {
          $set: {
            isActive: false,
            archivedAt: new Date()
          }
        }
      );

      // 완전 삭제할 아카이브 할일 찾기
      const deleteDate = new Date(now);
      deleteDate.setDate(now.getDate() - deleteArchivedDays);

      const deleteResult = await this.models.Todo.deleteMany({
        userId: userId.toString(),
        isActive: false,
        archivedAt: { $lt: deleteDate }
      });

      // 🆕 만료된 리마인드 정리
      let reminderCleanup = null;
      if (this.models.Reminder) {
        const expiredReminderResult = await this.models.Reminder.deleteMany({
          userId: userId.toString(),
          reminderTime: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // 하루 전
          isActive: false
        });

        reminderCleanup = {
          deletedReminders: expiredReminderResult.deletedCount
        };
      }

      const cleanupStats = {
        archivedTodos: archiveResult.modifiedCount,
        deletedTodos: deleteResult.deletedCount,
        reminderCleanup,
        cleanupDate: now.toISOString()
      };

      logger.info(`🧹 스마트 정리 완료: ${userId} - 아카이브: ${archiveResult.modifiedCount}, 삭제: ${deleteResult.deletedCount}`);

      return this.createSuccessResponse(
        cleanupStats,
        `정리 완료: ${archiveResult.modifiedCount}개 아카이브, ${deleteResult.deletedCount}개 삭제`
      );
    } catch (error) {
      return this.createErrorResponse(error, "스마트 정리 실패");
    }
  }

  // ===== 🆕 리마인드 연동 메서드들 =====

  /**
   * 🔗 할일에 리마인드 정보 추가
   */
  async enrichTodosWithReminders(todos) {
    if (!this.models.Reminder || !todos || todos.length === 0) {
      return todos;
    }

    try {
      const todoIds = todos.map((todo) => todo._id);

      const reminders = await this.models.Reminder.find({
        todoId: { $in: todoIds },
        isActive: true
      }).lean();

      // 할일별로 리마인드 그룹화
      const remindersByTodoId = {};
      reminders.forEach((reminder) => {
        const todoId = reminder.todoId.toString();
        if (!remindersByTodoId[todoId]) {
          remindersByTodoId[todoId] = [];
        }
        remindersByTodoId[todoId].push(reminder);
      });

      // 할일에 리마인드 정보 추가
      return todos.map((todo) => ({
        ...todo,
        reminders: remindersByTodoId[todo._id.toString()] || []
      }));
    } catch (error) {
      logger.error("리마인드 정보 추가 실패:", error);
      return todos;
    }
  }

  /**
   * 🔕 할일 완료 시 관련 리마인드 비활성화
   */
  async deactivateRemindersByTodoId(todoId) {
    if (!this.models.Reminder) {
      return;
    }

    try {
      await this.models.Reminder.updateMany(
        { todoId, isActive: true },
        {
          $set: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedReason: "todo_completed"
          }
        }
      );

      logger.debug(`🔕 리마인드 비활성화: todoId ${todoId}`);
    } catch (error) {
      logger.error("리마인드 비활성화 실패:", error);
    }
  }

  // ===== 유틸리티 메서드들 =====

  /**
   * ✅ 우선순위 검증
   */
  validatePriority(priority) {
    if (typeof priority !== "number") {
      return 3; // 기본값: 보통
    }
    return Math.max(1, Math.min(5, priority));
  }

  /**
   * 🏷️ 태그 검증
   */
  validateTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    return tags
      .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim().toLowerCase())
      .slice(0, 5); // 최대 5개 태그
  }

  /**
   * 📅 일별 생산성 분석
   */
  async getDailyProductivity(userId, startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            userId: userId.toString(),
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$completedAt"
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const dailyData = await this.models.Todo.aggregate(pipeline);

      return dailyData.map((item) => ({
        date: item._id,
        completed: item.count
      }));
    } catch (error) {
      logger.error("일별 생산성 분석 실패:", error);
      return [];
    }
  }

  /**
   * 🔍 할일 ID로 조회
   */
  async getTodoById(userId, todoId) {
    try {
      const todo = await this.models.Todo.findOne({
        _id: todoId,
        userId: userId.toString(),
        isActive: true
      }).lean();

      if (!todo) {
        return this.createErrorResponse(new Error("TODO_NOT_FOUND"), "할일을 찾을 수 없습니다.");
      }

      return this.createSuccessResponse(todo, "할일 조회 완료");
    } catch (error) {
      return this.createErrorResponse(error, "할일 조회 실패");
    }
  }

  /**
   * 🔄 할일 완료 처리 (별도 메서드)
   */
  async completeTodo(userId, todoId) {
    return this.toggleTodo(userId, todoId);
  }

  /**
   * ↩️ 할일 미완료 처리 (별도 메서드)
   */
  async uncompleteTodo(userId, todoId) {
    return this.toggleTodo(userId, todoId);
  }
}

module.exports = TodoService;
