// src/services/TodoService.js - 수정된 버전
const {
  ensureConnection,
  getCollection,
} = require("../database/DatabaseManager");
const Logger = require("../utils/Logger");

class TodoService {
  constructor() {
    // 메모리 기반 저장소 (Railway 환경변수 활용 가능)
    this.todos = new Map(); // userId -> todos[]
    this.initialize();
  }

  initialize() {
    try {
      // Railway 환경변수에서 기본 데이터 로드 (선택사항)
      const defaultTodos = process.env.DEFAULT_TODOS;
      if (defaultTodos) {
        // JSON 형태로 저장된 기본 할일 로드
        // 예: DEFAULT_TODOS='{"12345":["회의 준비","점심 약속"]}'
        const parsed = JSON.parse(defaultTodos);
        for (const [userId, tasks] of Object.entries(parsed)) {
          this.todos.set(
            userId,
            tasks.map((task) => ({
              task,
              completed: false,
              createdAt: new Date(),
            }))
          );
        }
      }

      Logger.info("✅ TodoService 초기화 완료");
    } catch (error) {
      Logger.error("❌ TodoService 초기화 실패:", error);
    }
  }

  // 할일 목록 조회
  async getTodos(userId) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];
      Logger.info(`📋 할일 목록 조회: 사용자 ${userId}, ${userTodos.length}개`);
      return userTodos;
    } catch (error) {
      Logger.error("할일 목록 조회 오류:", error);
      return [];
    }
  }

  // 할일 추가
  async addTodo(userId, todoText) {
    try {
      if (!todoText || todoText.trim().length === 0) {
        return {
          success: false,
          error: "할일 내용을 입력해주세요.",
        };
      }

      if (todoText.length > 100) {
        return {
          success: false,
          error: "할일은 100자 이내로 입력해주세요.",
        };
      }

      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      // 중복 체크
      const exists = userTodos.find((todo) => todo.task === todoText.trim());
      if (exists) {
        return {
          success: false,
          error: "이미 동일한 할일이 있습니다.",
        };
      }

      const newTodo = {
        task: todoText.trim(),
        completed: false,
        createdAt: new Date(),
        id: Date.now(), // 간단한 ID 생성
      };

      userTodos.push(newTodo);
      this.todos.set(userIdStr, userTodos);

      Logger.info(`➕ 할일 추가: 사용자 ${userId}, "${todoText}"`);

      return {
        success: true,
        task: newTodo.task,
        totalCount: userTodos.length,
      };
    } catch (error) {
      Logger.error("할일 추가 오류:", error);
      return {
        success: false,
        error: "할일 추가 중 오류가 발생했습니다.",
      };
    }
  }

  // 할일 완료 상태 토글
  async toggleTodo(userId, todoIndex) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      if (todoIndex < 0 || todoIndex >= userTodos.length) {
        return {
          success: false,
          error: "유효하지 않은 할일 번호입니다.",
        };
      }

      const todo = userTodos[todoIndex];
      todo.completed = !todo.completed;
      todo.updatedAt = new Date();

      this.todos.set(userIdStr, userTodos);

      Logger.info(
        `🔄 할일 토글: 사용자 ${userId}, "${todo.task}" -> ${
          todo.completed ? "완료" : "미완료"
        }`
      );

      return {
        success: true,
        task: todo.task,
        completed: todo.completed,
        index: todoIndex,
      };
    } catch (error) {
      Logger.error("할일 토글 오류:", error);
      return {
        success: false,
        error: "할일 상태 변경 중 오류가 발생했습니다.",
      };
    }
  }

  // 할일 삭제
  async deleteTodo(userId, todoIndex) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      if (todoIndex < 0 || todoIndex >= userTodos.length) {
        return {
          success: false,
          error: "유효하지 않은 할일 번호입니다.",
        };
      }

      const deletedTodo = userTodos.splice(todoIndex, 1)[0];
      this.todos.set(userIdStr, userTodos);

      Logger.info(`🗑️ 할일 삭제: 사용자 ${userId}, "${deletedTodo.task}"`);

      return {
        success: true,
        task: deletedTodo.task,
        remainingCount: userTodos.length,
      };
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      return {
        success: false,
        error: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // 완료된 할일 일괄 삭제
  async clearCompleted(userId) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      const beforeCount = userTodos.length;
      const filteredTodos = userTodos.filter((todo) => !todo.completed);
      const deletedCount = beforeCount - filteredTodos.length;

      this.todos.set(userIdStr, filteredTodos);

      Logger.info(
        `🗑️ 완료된 할일 삭제: 사용자 ${userId}, ${deletedCount}개 삭제`
      );

      return {
        success: true,
        count: deletedCount,
        remainingCount: filteredTodos.length,
      };
    } catch (error) {
      Logger.error("완료된 할일 삭제 오류:", error);
      return {
        success: false,
        error: "완료된 할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // 모든 할일 삭제
  async clearAll(userId) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];
      const deletedCount = userTodos.length;

      this.todos.set(userIdStr, []);

      Logger.info(
        `🗑️ 모든 할일 삭제: 사용자 ${userId}, ${deletedCount}개 삭제`
      );

      return {
        success: true,
        count: deletedCount,
      };
    } catch (error) {
      Logger.error("모든 할일 삭제 오류:", error);
      return {
        success: false,
        error: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  // 할일 통계
  async getTodoStats(userId) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];

      const total = userTodos.length;
      const completed = userTodos.filter((todo) => todo.completed).length;
      const pending = total - completed;

      Logger.info(
        `📊 할일 통계: 사용자 ${userId}, 전체 ${total}, 완료 ${completed}, 진행중 ${pending}`
      );

      return {
        total,
        completed,
        pending,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      Logger.error("할일 통계 조회 오류:", error);
      return null;
    }
  }

  // 사용자 할일 검색
  async searchTodos(userId, keyword) {
    try {
      const userTodos = this.todos.get(userId.toString()) || [];
      const results = userTodos.filter((todo) =>
        todo.task.toLowerCase().includes(keyword.toLowerCase())
      );

      Logger.info(
        `🔍 할일 검색: 사용자 ${userId}, 키워드 "${keyword}", ${results.length}개 발견`
      );

      return {
        success: true,
        results,
        keyword,
        count: results.length,
      };
    } catch (error) {
      Logger.error("할일 검색 오류:", error);
      return {
        success: false,
        error: "할일 검색 중 오류가 발생했습니다.",
      };
    }
  }

  // 할일 우선순위 변경 (선택적 기능)
  async moveTodo(userId, fromIndex, toIndex) {
    try {
      const userIdStr = userId.toString();
      const userTodos = this.todos.get(userIdStr) || [];

      if (
        fromIndex < 0 ||
        fromIndex >= userTodos.length ||
        toIndex < 0 ||
        toIndex >= userTodos.length
      ) {
        return {
          success: false,
          error: "유효하지 않은 할일 번호입니다.",
        };
      }

      // 배열에서 요소 이동
      const [movedTodo] = userTodos.splice(fromIndex, 1);
      userTodos.splice(toIndex, 0, movedTodo);

      this.todos.set(userIdStr, userTodos);

      Logger.info(
        `📋 할일 순서 변경: 사용자 ${userId}, "${movedTodo.task}" ${fromIndex} -> ${toIndex}`
      );

      return {
        success: true,
        task: movedTodo.task,
        fromIndex,
        toIndex,
      };
    } catch (error) {
      Logger.error("할일 순서 변경 오류:", error);
      return {
        success: false,
        error: "할일 순서 변경 중 오류가 발생했습니다.",
      };
    }
  }

  // 데이터 백업 (Railway 환경변수 저장용)
  async backupData() {
    try {
      const backup = {};
      for (const [userId, todos] of this.todos.entries()) {
        backup[userId] = todos;
      }

      Logger.info(
        `💾 데이터 백업: ${Object.keys(backup).length}명의 할일 데이터`
      );
      return JSON.stringify(backup);
    } catch (error) {
      Logger.error("데이터 백업 오류:", error);
      return null;
    }
  }

  // 데이터 복원
  async restoreData(backupData) {
    try {
      const parsed = JSON.parse(backupData);
      this.todos.clear();

      for (const [userId, todos] of Object.entries(parsed)) {
        this.todos.set(userId, todos);
      }

      Logger.info(
        `📥 데이터 복원: ${Object.keys(parsed).length}명의 할일 데이터`
      );
      return {
        success: true,
        userCount: Object.keys(parsed).length,
      };
    } catch (error) {
      Logger.error("데이터 복원 오류:", error);
      return {
        success: false,
        error: "데이터 복원 중 오류가 발생했습니다.",
      };
    }
  }

  // 서비스 상태 확인
  getServiceStatus() {
    const totalUsers = this.todos.size;
    let totalTodos = 0;
    let completedTodos = 0;

    for (const todos of this.todos.values()) {
      totalTodos += todos.length;
      completedTodos += todos.filter((todo) => todo.completed).length;
    }

    return {
      users: totalUsers,
      totalTodos,
      completedTodos,
      pendingTodos: totalTodos - completedTodos,
      memoryUsage: process.memoryUsage(),
    };
  }
}

module.exports = { TodoService };
