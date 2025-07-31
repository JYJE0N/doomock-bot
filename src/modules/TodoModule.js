// src/modules/TodoModule.js - 📝 할일 관리 모듈 (올바른 SoC 버전)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 📝 TodoModule - 할일 관리 모듈 (SoC 준수 + Mongoose)
 *
 * 🎯 새로운 콜백 체계:
 * - todo:menu → 메인 메뉴 (할일 목록)
 * - todo:add → 할일 추가 입력 모드
 * - todo:toggle:123 → 할일 완료/미완료 토글 (params="123")
 * - todo:delete:456 → 할일 삭제 (params="456")
 * - todo:page:2 → 페이지 이동 (params="2")
 * - todo:stats → 통계 보기
 * - todo:filter:completed → 완료된 할일만 (params="completed")
 * - todo:filter:pending → 미완료 할일만 (params="pending")
 *
 * ✅ SoC 준수:
 * - 모듈: 순수 데이터만 반환 (UI 코드 없음!)
 * - 서비스: Mongoose 기반 데이터 처리
 * - 렌더러: UI 생성 담당
 * - NavigationHandler: 라우팅 담당
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // Mongoose 기반 서비스
    this.todoService = null;

    // 모듈 설정 (환경변수 우선)
    this.config = {
      maxTextLength: parseInt(process.env.TODO_MAX_TEXT_LENGTH) || 100,
      maxTodosPerPage: parseInt(process.env.TODO_MAX_PER_PAGE) || 8,
      maxTodosPerUser: parseInt(process.env.TODO_MAX_PER_USER) || 50,
      enableCategories: process.env.TODO_ENABLE_CATEGORIES !== "false",
      enablePriority: process.env.TODO_ENABLE_PRIORITY === "true",
      enableTags: process.env.TODO_ENABLE_TAGS === "true",
      enableDueDate: process.env.TODO_ENABLE_DUE_DATE === "true",

      ...options.config,
    };

    // 사용자 입력 상태 관리
    this.userInputStates = new Map();

    logger.info("📝 TodoModule 생성됨 (SoC + Mongoose)", {
      version: "4.0.0-soc",
      config: this.config,
    });
  }

  /**
   * 🎯 모듈 초기화 (Mongoose 서비스 연결)
   */
  async onInitialize() {
    try {
      logger.info("📝 TodoModule 초기화 시작 (Mongoose)...");

      // ServiceBuilder에서 TodoService 가져오기
      this.todoService = this.serviceBuilder.getServiceInstance("todo");

      if (!this.todoService) {
        throw new Error("TodoService 인스턴스를 가져올 수 없습니다.");
      }

      logger.success("✅ TodoModule 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (단순화된 버전)
   */
  setupActions() {
    this.registerActions({
      // 🏠 메인 메뉴 (할일 목록)
      menu: this.handleTodoList,
      list: this.handleTodoList,

      // ➕ 할일 추가
      add: this.handleAddTodo,

      // 🔄 할일 토글 (완료/미완료)
      toggle: this.handleToggleTodo,

      // 🗑️ 할일 삭제
      delete: this.handleDeleteTodo,

      // 📄 페이지네이션
      page: this.handlePageNavigation,

      // 🔍 필터링
      filter: this.handleTodoFilter,

      // 📊 통계
      stats: this.handleTodoStats,

      // ❓ 도움말
      help: this.showHelp,
    });

    logger.info(`✅ TodoModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 입력 상태 처리
    const inputState = this.userInputStates.get(userId);
    if (inputState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, inputState);
    }

    // 모듈 키워드 확인
    if (this.isModuleMessage(text, this.getModuleKeywords())) {
      // ✅ NavigationHandler에게 위임 (UI 생성은 하지 않음!)
      if (this.moduleManager?.navigationHandler) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          chatId,
          "todo"
        );
        return true;
      }
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 데이터만 반환!) =====

  /**
   * 📋 할일 목록 처리 (메인 메뉴)
   *
   * ✅ SoC: 순수 데이터만 반환, UI는 TodoRenderer가 담당
   */
  async handleTodoList(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const page = parseInt(params) || 1;

    logger.debug(`📋 할일 목록 처리`, {
      userId,
      userName,
      page,
      action: subAction,
    });

    try {
      // Mongoose 서비스에서 할일 데이터 조회
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      // 페이지네이션 처리
      const startIndex = (page - 1) * this.config.maxTodosPerPage;
      const endIndex = startIndex + this.config.maxTodosPerPage;
      const pagedTodos = todos.slice(startIndex, endIndex);
      const totalPages = Math.ceil(todos.length / this.config.maxTodosPerPage);

      // ✅ 순수 데이터만 반환 (UI 코드 없음!)
      return {
        type: "list",
        module: "todo",
        data: {
          userName,
          todos: pagedTodos,
          stats,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: todos.length,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            pageSize: this.config.maxTodosPerPage,
          },
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      return {
        type: "error",
        module: "todo",
        message: "할일 목록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ➕ 할일 추가 처리
   *
   * ✅ SoC: 입력 모드 시작만 처리, UI는 TodoRenderer가 담당
   */
  async handleAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    logger.debug(`➕ 할일 추가 시작`, { userId, userName });

    try {
      // 할일 개수 제한 확인
      const currentTodos = await this.todoService.getTodos(userId);

      if (currentTodos.length >= this.config.maxTodosPerUser) {
        return {
          type: "limit_exceeded",
          module: "todo",
          data: {
            currentCount: currentTodos.length,
            maxCount: this.config.maxTodosPerUser,
            message: `할일은 최대 ${this.config.maxTodosPerUser}개까지만 추가할 수 있습니다.`,
          },
        };
      }

      // 사용자 입력 상태 설정
      this.userInputStates.set(userId, {
        awaitingInput: true,
        action: "add_todo",
        timestamp: Date.now(),
      });

      // ✅ 순수 데이터만 반환 (UI는 TodoRenderer가 처리)
      return {
        type: "input_prompt",
        module: "todo",
        data: {
          action: "add_todo",
          prompt: "새로운 할일을 입력해주세요:",
          maxLength: this.config.maxTextLength,
          currentCount: currentTodos.length,
          maxCount: this.config.maxTodosPerUser,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("할일 추가 준비 실패:", error);
      return {
        type: "error",
        module: "todo",
        message: "할일 추가를 준비할 수 없습니다.",
      };
    }
  }

  /**
   * 🔄 할일 토글 처리 (완료/미완료)
   *
   * ✅ SoC: 비즈니스 로직만 처리, UI는 TodoRenderer가 담당
   */
  async handleToggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const todoId = params;

    logger.debug(`🔄 할일 토글 처리`, {
      userId,
      userName,
      todoId,
    });

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      // Mongoose 서비스로 토글 처리
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (result.success) {
        logger.info(`✅ 할일 토글 성공`, {
          userId,
          todoId,
          newStatus: result.completed ? "완료" : "미완료",
        });

        // ✅ 순수 데이터만 반환 (UI 갱신은 TodoRenderer가 처리)
        return {
          type: "toggle_success",
          module: "todo",
          data: {
            todoId,
            completed: result.completed,
            todo: result.todo,
            message: `할일이 ${
              result.completed ? "완료" : "미완료"
            }로 변경되었습니다.`,
            timestamp: TimeHelper.now().toISOString(),
          },
        };
      } else {
        return {
          type: "error",
          module: "todo",
          message: result.reason || "할일 상태를 변경할 수 없습니다.",
        };
      }
    } catch (error) {
      logger.error("할일 토글 처리 오류:", error);
      return {
        type: "error",
        module: "todo",
        message: "할일 상태 변경 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🗑️ 할일 삭제 처리
   *
   * ✅ SoC: 삭제 로직만 처리, UI는 TodoRenderer가 담당
   */
  async handleDeleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const todoId = params;

    logger.debug(`🗑️ 할일 삭제 처리`, {
      userId,
      userName,
      todoId,
    });

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      // Mongoose 서비스로 삭제 처리
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (result.success) {
        logger.info(`✅ 할일 삭제 성공`, {
          userId,
          todoId,
          deletedText: result.deletedTodo?.text,
        });

        // ✅ 순수 데이터만 반환
        return {
          type: "delete_success",
          module: "todo",
          data: {
            todoId,
            deletedTodo: result.deletedTodo,
            message: `"${result.deletedTodo.text}" 할일이 삭제되었습니다.`,
            timestamp: TimeHelper.now().toISOString(),
          },
        };
      } else {
        return {
          type: "error",
          module: "todo",
          message: result.reason || "할일을 삭제할 수 없습니다.",
        };
      }
    } catch (error) {
      logger.error("할일 삭제 처리 오류:", error);
      return {
        type: "error",
        module: "todo",
        message: "할일 삭제 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📄 페이지네이션 처리
   *
   * ✅ SoC: 페이지 데이터만 처리, UI는 TodoRenderer가 담당
   */
  async handlePageNavigation(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    logger.debug(`📄 페이지네이션 처리`, {
      userId,
      params,
    });

    try {
      let targetPage = 1;

      // 파라미터에 따른 페이지 계산
      if (params) {
        const pageNum = parseInt(params);
        if (!isNaN(pageNum) && pageNum >= 1) {
          targetPage = pageNum;
        }
      }

      // 목록 표시 (targetPage를 params로 전달)
      return await this.handleTodoList(
        bot,
        callbackQuery,
        "list",
        targetPage.toString(),
        moduleManager
      );
    } catch (error) {
      logger.error("페이지네이션 처리 오류:", error);
      return {
        type: "error",
        module: "todo",
        message: "페이지 이동 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🔍 할일 필터링 처리
   *
   * ✅ SoC: 필터 데이터만 처리, UI는 TodoRenderer가 담당
   */
  async handleTodoFilter(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    logger.debug(`🔍 할일 필터링 처리`, {
      userId,
      params,
    });

    try {
      // 파라미터에 따른 필터링 옵션
      let filterOptions = {};

      switch (params) {
        case "completed":
          filterOptions.completed = true;
          break;
        case "pending":
          filterOptions.completed = false;
          break;
        case "overdue":
          filterOptions.overdue = true;
          break;
        case "today":
          filterOptions.dueToday = true;
          break;
        default:
          // 전체 보기
          break;
      }

      // 필터링된 할일 조회
      const todos = await this.todoService.getTodos(userId, filterOptions);
      const stats = this.calculateStats(todos);

      // ✅ 순수 데이터만 반환
      return {
        type: "filtered_list",
        module: "todo",
        data: {
          userName,
          todos,
          stats,
          filter: {
            type: params || "all",
            label: this.getFilterLabel(params),
            options: filterOptions,
          },
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("할일 필터링 처리 실패:", error);
      return {
        type: "error",
        module: "todo",
        message: "할일 필터링 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 통계 처리
   *
   * ✅ SoC: 통계 데이터만 처리, UI는 TodoRenderer가 담당
   */
  async handleTodoStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      const todos = await this.todoService.getTodos(userId);
      const detailedStats = this.calculateDetailedStats(todos);

      // ✅ 순수 데이터만 반환
      return {
        type: "stats",
        module: "todo",
        data: {
          userName,
          stats: detailedStats,
          config: this.config,
          timestamp: TimeHelper.now().toISOString(),
        },
      };
    } catch (error) {
      logger.error("할일 통계 조회 실패:", error);
      return {
        type: "error",
        module: "todo",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   *
   * ✅ SoC: 도움말 데이터만 반환, UI는 TodoRenderer가 담당
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "todo",
      data: {
        config: this.config,
        features: {
          add: "할일 추가",
          toggle: "완료/미완료 토글",
          delete: "할일 삭제",
          filter: "할일 필터링",
          stats: "통계 확인",
          pagination: "페이지 이동",
        },
        keywords: this.getModuleKeywords(),
        limits: {
          maxTodosPerUser: this.config.maxTodosPerUser,
          maxTextLength: this.config.maxTextLength,
          maxTodosPerPage: this.config.maxTodosPerPage,
        },
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 📝 사용자 입력 처리 (할일 추가 등)
   */
  async handleUserInput(bot, msg, text, inputState) {
    const { action } = inputState;
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    switch (action) {
      case "add_todo":
        return await this.handleAddTodoInput(bot, msg, text, inputState);

      default:
        logger.warn(`알 수 없는 입력 액션: ${action}`);
        this.userInputStates.delete(userId);
        return false;
    }
  }

  /**
   * ➕ 할일 추가 입력 처리
   */
  async handleAddTodoInput(bot, msg, text, inputState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    // 입력 검증
    if (!text || text.trim().length === 0) {
      // ✅ UI 없이 단순 메시지만 전송
      await bot.sendMessage(chatId, "❌ 할일 내용을 입력해주세요.");
      return true;
    }

    if (text.length > this.config.maxTextLength) {
      await bot.sendMessage(
        chatId,
        `❌ 할일은 ${this.config.maxTextLength}자 이하로 입력해주세요. (현재: ${text.length}자)`
      );
      return true;
    }

    try {
      // Mongoose 서비스로 할일 추가
      const result = await this.todoService.addTodo(userId, {
        text: text.trim(),
        createdAt: TimeHelper.now().toISOString(),
      });

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ 할일이 추가되었습니다!\n📝 "${result.todo.text}"`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `❌ 할일 추가에 실패했습니다: ${result.error}`
        );
      }
    } catch (error) {
      logger.error("할일 추가 처리 실패:", error);
      await bot.sendMessage(chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
    }

    // 입력 상태 제거
    this.userInputStates.delete(userId);
    return true;
  }

  /**
   * 📊 기본 통계 계산
   */
  calculateStats(todos) {
    const total = todos.length;
    const completed = todos.filter((todo) => todo.completed).length;
    const pending = total - completed;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending,
      completionRate,
    };
  }

  /**
   * 📊 상세 통계 계산
   */
  calculateDetailedStats(todos) {
    const basicStats = this.calculateStats(todos);

    // 최근 활동
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayCompleted = todos.filter(
      (todo) =>
        todo.completed &&
        todo.completedAt &&
        new Date(todo.completedAt) >= today
    ).length;

    const weekCompleted = todos.filter(
      (todo) =>
        todo.completed &&
        todo.completedAt &&
        new Date(todo.completedAt) >= thisWeek
    ).length;

    // 우선순위별 통계
    const priorityStats = {};
    todos.forEach((todo) => {
      const priority = todo.priority || 3;
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
    });

    // 카테고리별 통계
    const categoryStats = {};
    todos.forEach((todo) => {
      const category = todo.category || "일반";
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    return {
      ...basicStats,
      todayCompleted,
      weekCompleted,
      averagePerDay: Math.round((weekCompleted / 7) * 10) / 10,
      priorityStats,
      categoryStats,
      longestStreak: this.calculateLongestStreak(todos),
      currentStreak: this.calculateCurrentStreak(todos),
    };
  }

  /**
   * 🏆 최장 연속 완료 계산
   */
  calculateLongestStreak(todos) {
    // TODO: 구현
    return 0;
  }

  /**
   * 🔥 현재 연속 완료 계산
   */
  calculateCurrentStreak(todos) {
    // TODO: 구현
    return 0;
  }

  /**
   * 🏷️ 필터 라벨 가져오기
   */
  getFilterLabel(filterType) {
    const labels = {
      all: "전체",
      completed: "완료됨",
      pending: "미완료",
      overdue: "기한 초과",
      today: "오늘 마감",
    };

    return labels[filterType] || "전체";
  }

  /**
   * 🔑 모듈별 키워드 정의
   */
  getModuleKeywords() {
    return ["할일", "todo", "📝", "작업", "task"];
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.todoService,
      activeInputStates: this.userInputStates.size,
      config: {
        maxTextLength: this.config.maxTextLength,
        maxTodosPerPage: this.config.maxTodosPerPage,
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableCategories: this.config.enableCategories,
        enablePriority: this.config.enablePriority,
        enableTags: this.config.enableTags,
        enableDueDate: this.config.enableDueDate,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 입력 상태 정리
      this.userInputStates.clear();

      await super.cleanup();
      logger.info("✅ TodoModule 정리 완료 (SoC + Mongoose)");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
