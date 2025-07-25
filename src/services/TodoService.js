// src/services/TodoService.js - 인덱스 충돌 수정 버전

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
  constructor(options = {}) {
    // BaseService에 올바른 options 전달
    super("todos", {
      db: options.db,
      enableCache: true,
      cacheTimeout: 60000, // 1분
      ...options, // 추가 옵션 병합
    });

    // 설정
    this.maxTodosPerUser = parseInt(process.env.MAX_TODOS_PER_USER) || 50;

    logger.info("📝 TodoService 생성됨");
  }

  async initialize() {
    try {
      // 부모 클래스 초기화 (인덱스 생성 포함)
      await super.initialize();

      // collection 확인
      if (!this.collection) {
        logger.error("❌ TodoService: collection이 초기화되지 않음");
        logger.debug("db 상태:", this.db ? "있음" : "없음");
        logger.debug("collectionName:", this.collectionName);
        throw new Error("Database collection not initialized");
      }

      // 추가 인덱스 생성 (안전하게)
      await this.createIndexesSafely();

      logger.info("✅ TodoService 초기화 성공");
      return true;
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      return false;
    }
  }

  // BaseService에서 호출하는 메서드
  async onInitialize() {
    // 추가 초기화 로직이 필요한 경우
    logger.debug("📝 TodoService onInitialize 호출됨");
  }

  /**
   * 안전한 인덱스 생성
   */
  async createIndexesSafely() {
    if (!this.collection) {
      logger.warn("⚠️ 컬렉션이 연결되지 않음, 인덱스 생성 스킵");
      return;
    }

    try {
      // 기존 인덱스 확인
      const existingIndexes = await this.collection.listIndexes().toArray();
      const indexNames = existingIndexes.map((idx) => idx.name);

      logger.debug("📝 기존 인덱스:", indexNames);

      // 1. 사용자별 조회 최적화 인덱스
      if (!indexNames.includes("userId_1_createdAt_-1")) {
        try {
          await this.collection.createIndex(
            { userId: 1, createdAt: -1 },
            { name: "userId_1_createdAt_-1" }
          );
          logger.debug("✅ userId + createdAt 인덱스 생성");
        } catch (error) {
          logger.warn("⚠️ userId + createdAt 인덱스 생성 실패:", error.message);
        }
      }

      // 2. 완료 상태별 조회 인덱스
      if (!indexNames.includes("userId_1_completed_1")) {
        try {
          await this.collection.createIndex(
            { userId: 1, completed: 1 },
            { name: "userId_1_completed_1" }
          );
          logger.debug("✅ userId + completed 인덱스 생성");
        } catch (error) {
          logger.warn("⚠️ userId + completed 인덱스 생성 실패:", error.message);
        }
      }

      // 3. 텍스트 검색 인덱스 (기존 텍스트 인덱스 확인)
      const hasTextIndex = existingIndexes.some(
        (idx) => idx.key && Object.values(idx.key).includes("text")
      );

      if (!hasTextIndex) {
        try {
          await this.collection.createIndex(
            { text: "text" },
            { name: "text_text_index" }
          );
          logger.debug("✅ 텍스트 검색 인덱스 생성");
        } catch (error) {
          logger.warn("⚠️ 텍스트 인덱스 생성 실패:", error.message);
          // 텍스트 인덱스 실패는 치명적이지 않음
        }
      } else {
        logger.debug("✅ 텍스트 인덱스 이미 존재");
      }

      logger.debug("📝 Todo 인덱스 설정 완료");
    } catch (error) {
      logger.error("❌ 인덱스 생성 중 오류:", error);
      // 인덱스 생성 실패해도 서비스는 계속 동작
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

      if (text.trim().length > 200) {
        throw new Error("할일 내용은 200자 이하로 입력해주세요.");
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
        createdAt: TimeHelper.getKoreaTime(),
        updatedAt: TimeHelper.getKoreaTime(),
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
        completedAt: newCompleted ? TimeHelper.getKoreaTime() : null,
        updatedAt: TimeHelper.getKoreaTime(),
      };

      await this.updateOne(
        { _id: new ObjectId(todoId), userId: userId.toString() },
        { $set: updateData }
      );

      // 캐시 무효화
      this.invalidateCache();

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

      if (text.trim().length > 200) {
        throw new Error("할일 내용은 200자 이하로 입력해주세요.");
      }

      const result = await this.updateOne(
        { _id: new ObjectId(todoId), userId: userId.toString() },
        {
          $set: {
            text: text.trim(),
            updatedAt: TimeHelper.getKoreaTime(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return { success: false, message: "할일을 찾을 수 없습니다." };
      }

      // 캐시 무효화
      this.invalidateCache();

      logger.debug(`할일 수정: ${userId} - ${todoId}`);
      return { success: true, message: "할일이 수정되었습니다." };
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

      // 캐시 무효화
      this.invalidateCache();

      logger.debug(`할일 삭제: ${userId} - ${todoId}`);
      return { success: true, message: "할일이 삭제되었습니다." };
    } catch (error) {
      logger.error("할일 삭제 오류:", error);
      throw error;
    }
  }

  /**
   * 상세 통계 조회 (TodoModule에서 사용)
   * getDetailedStats 메서드명을 getUserDetailedStats로 변경
   */
  async getUserDetailedStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);
      const now = TimeHelper.getKoreaTime();

      // 기본 통계
      const stats = {
        total: todos.length,
        completed: todos.filter((todo) => todo.completed).length,
        pending: todos.filter((todo) => !todo.completed).length,
        completionRate: 0,
      };

      if (stats.total > 0) {
        stats.completionRate = Math.round(
          (stats.completed / stats.total) * 100
        );
      }

      // 오늘 날짜 계산
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // 오늘 추가된 할일
      const todayAddedTodos = todos.filter((todo) => {
        const createdDate = new Date(todo.createdAt);
        return createdDate >= todayStart;
      });

      // 오늘 완료된 할일
      const todayCompletedTodos = todos.filter((todo) => {
        if (!todo.completed || !todo.completedAt) return false;
        const completedDate = new Date(todo.completedAt);
        return completedDate >= todayStart;
      });

      stats.todayAdded = todayAddedTodos.length;
      stats.todayCompleted = todayCompletedTodos.length;

      // 이번주 시작일 계산 (일요일 기준)
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      // 이번주 완료된 할일
      const weekCompletedTodos = todos.filter((todo) => {
        if (!todo.completed || !todo.completedAt) return false;
        const completedDate = new Date(todo.completedAt);
        return completedDate >= weekStart;
      });

      stats.weekCompleted = weekCompletedTodos.length;

      // 이번달 시작일
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      // 이번달 완료된 할일
      const monthCompletedTodos = todos.filter((todo) => {
        if (!todo.completed || !todo.completedAt) return false;
        const completedDate = new Date(todo.completedAt);
        return completedDate >= monthStart;
      });

      stats.monthCompleted = monthCompletedTodos.length;

      // 평균 완료 시간 계산
      const completedWithTime = todos.filter(
        (todo) => todo.completed && todo.completedAt && todo.createdAt
      );

      if (completedWithTime.length > 0) {
        let totalTime = 0;
        completedWithTime.forEach((todo) => {
          const completedAt = new Date(todo.completedAt);
          const createdAt = new Date(todo.createdAt);
          totalTime += completedAt.getTime() - createdAt.getTime();
        });

        const avgTime = totalTime / completedWithTime.length;
        stats.avgCompletionTime = this.formatDuration(avgTime);
      } else {
        stats.avgCompletionTime = "데이터 없음";
      }

      logger.debug(`📊 상세 통계 조회 완료: userId=${userId}`, stats);
      return stats;
    } catch (error) {
      logger.error("상세 통계 조회 오류:", error);
      // 에러 발생시 기본값 반환
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
        todayAdded: 0,
        todayCompleted: 0,
        weekCompleted: 0,
        monthCompleted: 0,
        avgCompletionTime: "데이터 없음",
      };
    }
  }

  getDefaultStats() {
    return {
      total: 0,
      completed: 0,
      active: 0,
      completionRate: 0,
    };
  }
  // ===== 통계 메서드 =====

  /**
   * 사용자 할일 개수 조회
   */
  async getUserTodoCount(userId) {
    try {
      const count = await this.collection.countDocuments({
        userId: userId.toString(),
      });

      return count;
    } catch (error) {
      logger.error("할일 개수 조회 오류:", error);
      return 0;
    }
  }

  /**
   * 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      const stats = {
        total: todos.length,
        completed: todos.filter((todo) => todo.completed).length,
        pending: todos.filter((todo) => !todo.completed).length,
        completionRate: 0,
      };

      if (stats.total > 0) {
        stats.completionRate = Math.round(
          (stats.completed / stats.total) * 100
        );
      }

      return stats;
    } catch (error) {
      logger.error("사용자 통계 조회 오류:", error);
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
      };
    }
  }

  /**
   * 상세 통계 조회
   */
  async getDetailedStats(userId) {
    try {
      const todos = await this.getUserTodos(userId);

      const stats = await this.getUserStats(userId);

      // 추가 통계
      const now = TimeHelper.getKoreaTime();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const todayTodos = todos.filter((todo) => todo.createdAt >= todayStart);

      const todayCompleted = todayTodos.filter((todo) => todo.completed);

      stats.todayTotal = todayTodos.length;
      stats.todayCompleted = todayCompleted.length;
      stats.todayPending = stats.todayTotal - stats.todayCompleted;

      // 완료 시간 분석
      const completedWithTime = todos.filter(
        (todo) => todo.completed && todo.completedAt && todo.createdAt
      );

      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, todo) => {
          return sum + (todo.completedAt.getTime() - todo.createdAt.getTime());
        }, 0);

        const avgTime = totalTime / completedWithTime.length;
        stats.avgCompletionTime = this.formatDuration(avgTime);
      } else {
        stats.avgCompletionTime = "데이터 없음";
      }

      return stats;
    } catch (error) {
      logger.error("상세 통계 조회 오류:", error);
      return await this.getUserStats(userId);
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

      // 캐시 무효화
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

      // 캐시 무효화
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
   * 할일 검색 (안전한 버전)
   */
  async searchTodos(userId, keyword) {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return [];
      }

      // 먼저 텍스트 인덱스를 사용해 검색 시도
      try {
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
      } catch (textSearchError) {
        // 텍스트 인덱스가 없는 경우 정규식으로 폴백
        logger.warn(
          "텍스트 검색 실패, 정규식 검색으로 폴백:",
          textSearchError.message
        );

        const regex = new RegExp(
          keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        const todos = await this.find(
          {
            userId: userId.toString(),
            text: regex,
          },
          { limit: 20, sort: { createdAt: -1 } }
        );

        return todos;
      }
    } catch (error) {
      logger.error("할일 검색 오류:", error);
      throw error;
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
   * 캐시 무효화
   */
  invalidateCache() {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * 데이터 마이그레이션 (필요시)
   */
  async migrateData() {
    try {
      if (!this.collection) {
        return;
      }

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

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      collectionConnected: !!this.collection,
      cacheEnabled: !!this.cache,
      maxTodosPerUser: this.maxTodosPerUser,
    };
  }
}

module.exports = TodoService;
