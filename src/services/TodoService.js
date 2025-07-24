// src/services/TodoService.js - 리팩토링된 할일 데이터 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");

/**
 * 할일 데이터 서비스
 * - 순수 데이터 처리만 담당
 * - UI/메시지는 TodoModule에서 처리
 * - MongoDB 네이티브 드라이버 사용
 */
class TodoService extends BaseService {
  constructor() {
    super("todos", {
      enableCache: true,
      cacheTimeout: 60000, // 1분
    });

    // 설정
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;

    logger.info("📝 TodoService 생성됨");
  }

  async initialize() {
    try {
      // BaseService의 initialize 호출 (필요한 경우)
      if (super.initialize) {
        await super.initialize();
      }

      // this.logger가 아닌 전역 logger 사용!
      logger.info("✅ TodoService 초기화 성공");
      return true;
    } catch (error) {
      // this.logger가 아닌 전역 logger 사용!
      logger.error("❌ TodoService 초기화 실패:", error);
      return false;
    }
  }

  /**
   * 인덱스 생성
   */
  async createIndexes() {
    if (this.collection) {
      // 기본 인덱스
      await super.createIndexes();

      // 사용자별 조회 최적화
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.collection.createIndex({ userId: 1, completed: 1 });

      // 텍스트 검색을 위한 인덱스
      await this.collection.createIndex({ text: "text" });

      logger.debug("📝 Todo 인덱스 생성 완료");
    }
  }

  // ===== 기본 CRUD 메서드 =====

  /**
   * 할일 추가
   */
  async addTodo(userId, text) {
    try {
      // 유효성 검사
      if (!text || text.trim().length === 0) {
        throw new Error("할일 내용이 비어있습니다.");
      }

      // 개수 제한 확인
      const count = await this.getUserTodoCount(userId);
      if (count >= this.maxTodosPerUser) {
        throw new Error(
          `최대 ${this.maxTodosPerUser}개까지만 등록 가능합니다.`
        );
      }

      // 할일 생성
      const todo = {
        userId: userId.toString(),
        text: text.trim(),
        completed: false,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.collection.insertOne(todo);
      todo._id = result.insertedId;

      // 캐시 무효화
      this.invalidateCache();

      logger.debug(`할일 추가: ${userId} - ${text}`);
      return todo;
    } catch (error) {
      logger.error("할일 추가 오류:", error);
      throw error;
    }
  }

  /**
   * 사용자의 모든 할일 조회
   */
  async getUserTodos(userId, options = {}) {
    try {
      const {
        includeCompleted = true,
        sort = { createdAt: -1 },
        limit = 100,
      } = options;

      const filter = { userId: userId.toString() };
      if (!includeCompleted) {
        filter.completed = false;
      }

      const todos = await this.find(filter, { sort, limit });
      return todos;
    } catch (error) {
      logger.error("할일 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 특정 할일 조회
   */
  async getTodo(userId, todoId) {
    try {
      const todo = await this.findOne({
        _id: new ObjectId(todoId),
        userId: userId.toString(),
      });

      return todo;
    } catch (error) {
      logger.error("할일 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(userId, todoId) {
    try {
      const todo = await this.getTodo(userId, todoId);

      if (!todo) {
        return { success: false, message: "할일을 찾을 수 없습니다." };
      }

      const newCompleted = !todo.completed;
      const updateData = {
        completed: newCompleted,
        completedAt: newCompleted ? new Date() : null,
      };

      await this.updateOne(
        { _id: new ObjectId(todoId), userId: userId.toString() },
        { $set: updateData }
      );

      // 업데이트된 할일 반환
      const updatedTodo = { ...todo, ...updateData };

      logger.debug(`할일 토글: ${userId} - ${todoId} -> ${newCompleted}`);
      return { success: true, todo: updatedTodo };
    } catch (error) {
      logger.error("할일 토글 오류:", error);
      throw error;
    }
  }

  /**
   * 할일 수정
   */
  async updateTodo(userId, todoId, text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("할일 내용이 비어있습니다.");
      }

      const result = await this.updateOne(
        { _id: new ObjectId(todoId), userId: userId.toString() },
        { $set: { text: text.trim() } }
      );

      if (result.matchedCount === 0) {
        return { success: false, message: "할일을 찾을 수 없습니다." };
      }

      logger.debug(`할일 수정: ${userId} - ${todoId}`);
      return { success: true };
    } catch (error) {
      logger.error("할일 수정 오류:", error);
      throw error;
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(userId, todoId) {
    try {
      const result = await this.deleteOne({
        _id: new ObjectId(todoId),
        userId: userId.toString(),
      });

      if (result.deletedCount === 0) {
        return { success: false, message: "할일을 찾을 수 없습니다." };
      }

      logger.debug(`할일 삭제: ${userId} - ${todoId}`);
      return { success: true };
    } catch (error) {
      logger.error("할일 삭제 오류:", error);
      throw error;
    }
  }

  // ===== 통계 메서드 =====

  /**
   * 사용자 할일 개수
   */
  async getUserTodoCount(userId) {
    try {
      return await this.count({ userId: userId.toString() });
    } catch (error) {
      logger.error("할일 개수 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 사용자 할일 기본 통계
   */
  async getUserStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      const total = todos.length;
      const completed = todos.filter((t) => t.completed).length;
      const pending = total - completed;
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        completed,
        pending,
        completionRate,
      };
    } catch (error) {
      logger.error("통계 조회 오류:", error);
      throw error;
    }
  }

  /**
   * 사용자 할일 상세 통계
   */
  async getUserDetailedStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 기본 통계
      const stats = await this.getUserStats(userId);

      // 오늘 추가된 할일
      stats.todayAdded = todos.filter((t) => t.createdAt >= todayStart).length;

      // 오늘 완료된 할일
      stats.todayCompleted = todos.filter(
        (t) => t.completed && t.completedAt >= todayStart
      ).length;

      // 이번주 완료된 할일
      stats.weekCompleted = todos.filter(
        (t) => t.completed && t.completedAt >= weekStart
      ).length;

      // 이번달 완료된 할일
      stats.monthCompleted = todos.filter(
        (t) => t.completed && t.completedAt >= monthStart
      ).length;

      // 평균 완료 시간 계산
      const completedWithTime = todos.filter(
        (t) => t.completed && t.completedAt && t.createdAt
      );

      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, todo) => {
          return sum + (todo.completedAt - todo.createdAt);
        }, 0);

        const avgTime = totalTime / completedWithTime.length;
        stats.avgCompletionTime = this.formatDuration(avgTime);
      } else {
        stats.avgCompletionTime = "데이터 없음";
      }

      return stats;
    } catch (error) {
      logger.error("상세 통계 조회 오류:", error);
      throw error;
    }
  }

  // ===== 일괄 작업 메서드 =====

  /**
   * 완료된 할일 삭제
   */
  async clearCompletedTodos(userId) {
    try {
      const result = await this.collection.deleteMany({
        userId: userId.toString(),
        completed: true,
      });

      this.invalidateCache();

      logger.debug(`완료 할일 삭제: ${userId} - ${result.deletedCount}개`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      logger.error("완료 할일 삭제 오류:", error);
      throw error;
    }
  }

  /**
   * 모든 할일 삭제
   */
  async clearAllTodos(userId) {
    try {
      const result = await this.collection.deleteMany({
        userId: userId.toString(),
      });

      this.invalidateCache();

      logger.debug(`모든 할일 삭제: ${userId} - ${result.deletedCount}개`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      logger.error("모든 할일 삭제 오류:", error);
      throw error;
    }
  }

  // ===== 검색 메서드 =====

  /**
   * 할일 검색
   */
  async searchTodos(userId, keyword) {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return [];
      }

      // 텍스트 검색 사용
      const todos = await this.collection
        .find(
          {
            userId: userId.toString(),
            $text: { $search: keyword },
          },
          {
            score: { $meta: "textScore" },
          }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(20)
        .toArray();

      return todos;
    } catch (error) {
      // 텍스트 인덱스가 없는 경우 정규식으로 폴백
      try {
        const regex = new RegExp(keyword, "i");
        const todos = await this.find(
          {
            userId: userId.toString(),
            text: regex,
          },
          { limit: 20 }
        );

        return todos;
      } catch (fallbackError) {
        logger.error("할일 검색 오류:", fallbackError);
        throw fallbackError;
      }
    }
  }

  // ===== 유틸리티 메서드 =====

  /**
   * 시간 간격 포맷팅
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return "1분 미만";
    }
  }

  /**
   * 데이터 마이그레이션 (필요시)
   */
  async migrateData() {
    try {
      // 구버전 데이터 구조 마이그레이션
      const result = await this.collection.updateMany(
        { completedAt: { $exists: false } },
        { $set: { completedAt: null } }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `📝 ${result.modifiedCount}개의 할일 데이터 마이그레이션 완료`
        );
      }
    } catch (error) {
      logger.error("데이터 마이그레이션 오류:", error);
    }
  }
}

module.exports = TodoService;
