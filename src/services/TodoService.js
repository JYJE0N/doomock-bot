// ===== 💾 Enhanced TodoService - 화려한 데이터 서비스 =====
// src/services/TodoService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 💾 Enhanced TodoService v3.0.1 - 화려한 Todo 데이터 서비스
 *
 * 🎯 Enhanced 특징:
 * - MongoDB 네이티브 드라이버
 * - 고급 집계 쿼리
 * - 실시간 통계
 * - 캐싱 최적화
 * - Enhanced Logger 통합
 */
class TodoService extends BaseService {
  constructor(options = {}) {
    super("todos", options);

    // 🎨 Enhanced Logger - 서비스 시작
    logger.moduleStart("TodoService", "3.0.1");

    // 📋 비즈니스 규칙 (Enhanced)
    this.rules = {
      maxTodosPerUser: 100,
      maxTitleLength: 100,
      maxDescriptionLength: 500,
      allowedPriorities: [1, 2, 3, 4, 5],
      allowedStatuses: ["pending", "progress", "completed", "cancelled"],
      allowedCategories: ["work", "personal", "study", "health", "hobby"],
    };

    // 📊 Enhanced 인덱스 설정
    this.indexes = [
      { userId: 1, createdAt: -1 },
      { userId: 1, status: 1, priority: -1 },
      { userId: 1, category: 1 },
      { userId: 1, dueDate: 1 },
      { title: "text", description: "text" }, // 풀텍스트 검색
      { userId: 1, status: 1, completedAt: -1 }, // 완료 시간 순
      { userId: 1, priority: -1, createdAt: -1 }, // 우선순위 + 생성시간
    ];

    logger.success("💾 Enhanced TodoService 생성됨");
  }

  /**
   * 📝 Enhanced Todo 생성
   */
  async createTodo(userId, todoData) {
    try {
      logger.info("📝 Enhanced Todo 생성 시작", {
        service: "TodoService",
        userId,
        title: todoData.title,
      });

      // 검증
      this.validateTodoData(userId, todoData);

      // 사용자 Todo 수 체크
      const currentCount = await this.getTotalCount(userId);
      if (currentCount >= this.rules.maxTodosPerUser) {
        const error = new Error(
          `최대 ${this.rules.maxTodosPerUser}개까지만 생성 가능합니다`
        );
        logger.warn("⚠️ Todo 한도 초과", {
          userId,
          currentCount,
          maxAllowed: this.rules.maxTodosPerUser,
        });
        throw error;
      }

      // Enhanced 문서 준비
      const document = {
        userId,
        title: todoData.title.trim(),
        description: todoData.description?.trim() || "",
        priority: todoData.priority || 2,
        category: todoData.category || "personal",
        status: "pending",
        dueDate: todoData.dueDate || null,
        tags: todoData.tags || [],
        metadata: {
          source: "telegram",
          version: "3.0.1",
          enhanced: true,
        },
        // 통계용 필드들
        estimatedMinutes: todoData.estimatedMinutes || null,
        actualMinutes: null,
        completedAt: null,
        ...this.getStandardFields(),
      };

      // 저장
      const result = await this.create(document);

      logger.success("✅ Enhanced Todo 생성 완료", {
        service: "TodoService",
        todoId: result.insertedId,
        title: document.title,
        priority: document.priority,
        category: document.category,
      });

      return {
        id: result.insertedId,
        ...document,
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 Enhanced 상세 통계
   */
  async getDetailedStats(userId) {
    try {
      logger.debug("📊 Enhanced 상세 통계 조회", {
        service: "TodoService",
        userId,
      });

      const pipeline = [
        { $match: { userId, isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ["$status", "progress"] }, 1, 0] },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$dueDate", null] },
                      { $lt: ["$dueDate", new Date()] },
                      { $ne: ["$status", "completed"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            avgPriority: { $avg: "$priority" },
            totalEstimatedTime: { $sum: "$estimatedMinutes" },
            totalActualTime: { $sum: "$actualMinutes" },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      if (!stats) {
        return {
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          overdue: 0,
          completionRate: 0,
          avgPriority: 0,
          totalEstimatedTime: 0,
          totalActualTime: 0,
        };
      }

      // 완료율 계산
      stats.completionRate =
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

      logger.debug("📈 상세 통계 조회 완료", {
        total: stats.total,
        completionRate: stats.completionRate,
      });

      return stats;
    } catch (error) {
      logger.error("❌ Enhanced 상세 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 주간 트렌드 분석
   */
  async getWeeklyTrends(userId) {
    try {
      logger.debug("📅 주간 트렌드 분석", {
        service: "TodoService",
        userId,
      });

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const pipeline = [
        {
          $match: {
            userId,
            isActive: true,
            completedAt: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$completedAt",
              },
            },
            completed: { $sum: 1 },
            avgPriority: { $avg: "$priority" },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const dailyData = await this.aggregate(pipeline);

      return {
        daily: dailyData,
        weeklyCompleted: dailyData.reduce((sum, day) => sum + day.completed, 0),
        weeklyAvgPriority:
          dailyData.length > 0
            ? dailyData.reduce((sum, day) => sum + day.avgPriority, 0) /
              dailyData.length
            : 0,
      };
    } catch (error) {
      logger.error("❌ 주간 트렌드 분석 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 데이터 검증 (Enhanced)
   */
  validateTodoData(userId, data) {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다");
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new Error("제목을 입력해주세요");
    }

    if (data.title.length > this.rules.maxTitleLength) {
      throw new Error(
        `제목은 ${this.rules.maxTitleLength}자 이내로 입력해주세요`
      );
    }

    if (
      data.description &&
      data.description.length > this.rules.maxDescriptionLength
    ) {
      throw new Error(
        `설명은 ${this.rules.maxDescriptionLength}자 이내로 입력해주세요`
      );
    }

    if (
      data.priority &&
      !this.rules.allowedPriorities.includes(data.priority)
    ) {
      throw new Error(`허용되지 않은 우선순위입니다: ${data.priority}`);
    }

    if (data.status && !this.rules.allowedStatuses.includes(data.status)) {
      throw new Error(`허용되지 않은 상태입니다: ${data.status}`);
    }

    if (
      data.category &&
      !this.rules.allowedCategories.includes(data.category)
    ) {
      throw new Error(`허용되지 않은 카테고리입니다: ${data.category}`);
    }
  }
}

module.exports = TodoService;
