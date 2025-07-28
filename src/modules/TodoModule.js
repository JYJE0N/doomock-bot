// src/modules/TodoModule.js - 할일 관리 모듈 (표준 준수)
const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📝 TodoModule - 할일 관리 모듈
 * - 표준 매개변수 준수: (bot, callbackQuery, subAction, params, moduleManager)
 * - BaseModule 상속
 * - actionMap 방식 사용
 * - 3-depth 네비게이션 지원
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // 서비스 인스턴스
    this.todoService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxItemsPerUser: parseInt(process.env.MAX_TODO_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 5,
      enableReminders: process.env.ENABLE_TODO_REMINDERS === "true",
      maxTitleLength: parseInt(process.env.MAX_TODO_TITLE_LENGTH) || 100,
      ...this.config,
    };

    // 모듈별 상수
    this.constants = {
      EMOJI: {
        PENDING: "⏳",
        COMPLETED: "✅",
        DELETED: "🗑️",
        ADD: "➕",
        EDIT: "✏️",
        LIST: "📋",
      },
      STATUS: {
        PENDING: "pending",
        COMPLETED: "completed",
        DELETED: "deleted",
      },
    };

    logger.info("📝 TodoModule 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // TodoService 초기화 (BaseModule에서 serviceBuilder 활용)
      const TodoService = require("../services/TodoService");
      this.todoService = new TodoService();
      this.todoService.db = this.db;
      await this.todoService.initialize();

      logger.info("📝 TodoService 연결 성공");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 1-depth: 메인 메뉴
      menu: this.showMenu,
      help: this.showHelp,

      // 2-depth: 주요 기능들
      list: this.showList,
      add: this.showAdd,
      search: this.showSearch,
      stats: this.showStats,

      // 3-depth: 세부 액션들
      "list:pending": this.showPendingList,
      "list:completed": this.showCompletedList,
      "add:quick": this.addQuickTodo,
      "add:detailed": this.addDetailedTodo,
      "search:by_title": this.searchByTitle,
      "search:by_date": this.searchByDate,

      // 할일 조작
      toggle: this.toggleTodo,
      delete: this.deleteTodo,
      edit: this.editTodo,

      // 페이지네이션
      page: this.changePage,
    });

    logger.info("📝 TodoModule 액션 등록 완료", { count: this.actionMap.size });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인 (할일 추가 대기 중인지)
    const userState = this.getUserState(userId);
    if (userState && userState.waitingFor === "todo_title") {
      return await this.handleTodoInput(bot, msg, userState);
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "todo" || command === "할일") {
      // 직접 텔레그램 메시지 전송 (NavigationHandler를 통하지 않음)
      const keyboard = {
        inline_keyboard: [
          [{ text: "📝 할일 관리", callback_data: "todo:menu" }],
        ],
      };

      await bot.telegram.sendMessage(
        chatId,
        "📝 *할일 관리*\n\n버튼을 눌러 시작하세요\\!",
        {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        }
      );
      return true;
    }

    return false;
  }

  // ===== 📋 1-Depth 액션들 (메인 메뉴) =====

  /**
   * 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 사용자 통계 조회
      const stats = await this.todoService.getUserStats(userId);

      return {
        module: "todo",
        type: "menu",
        data: {
          userName: getUserName(from),
          stats: {
            total: stats.total,
            pending: stats.pending,
            completed: stats.completed,
            todayAdded: stats.todayAdded,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule menu 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      module: "todo",
      type: "help",
      data: {
        commands: [
          "/todo - 할일 관리 시작",
          "➕ 추가 - 새 할일 추가",
          "📋 목록 - 할일 목록 보기",
          "🔍 검색 - 할일 검색",
          "📊 통계 - 할일 통계 보기",
        ],
        tips: [
          "할일은 최대 " + this.config.maxItemsPerUser + "개까지 등록 가능",
          "완료된 할일은 30일 후 자동 삭제",
          "제목은 " + this.config.maxTitleLength + "자 이내로 작성",
        ],
      },
    };
  }

  // ===== 📋 2-Depth 액션들 (주요 기능) =====

  /**
   * 할일 목록 선택 화면
   */
  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.todoService.getUserStats(userId);

      return {
        module: "todo",
        type: "list_menu",
        data: {
          stats: {
            pending: stats.pending,
            completed: stats.completed,
            total: stats.total,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule list menu 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "목록 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 할일 추가 방식 선택
   */
  async showAdd(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      module: "todo",
      type: "add_menu",
      data: {
        maxItems: this.config.maxItemsPerUser,
        maxTitleLength: this.config.maxTitleLength,
      },
    };
  }

  /**
   * 검색 방식 선택
   */
  async showSearch(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      module: "todo",
      type: "search_menu",
      data: {},
    };
  }

  /**
   * 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.todoService.getDetailedStats(userId);

      return {
        module: "todo",
        type: "stats",
        data: {
          daily: stats.daily,
          weekly: stats.weekly,
          monthly: stats.monthly,
          topCategories: stats.topCategories,
          completionRate: stats.completionRate,
        },
      };
    } catch (error) {
      logger.error("TodoModule stats 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  // ===== 📋 3-Depth 액션들 (세부 기능) =====

  /**
   * 진행 중인 할일 목록
   */
  async showPendingList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const page = parseInt(params) || 1;

    try {
      const result = await this.todoService.getUserTodos(userId, {
        status: this.constants.STATUS.PENDING,
        page,
        limit: this.config.pageSize,
      });

      return {
        module: "todo",
        type: "list",
        subType: "pending",
        data: {
          todos: result.todos.map((todo) => ({
            id: todo._id.toString(),
            title: todo.title,
            createdAt: TimeHelper.format(todo.createdAt, "relative"),
            status: todo.status,
            priority: todo.priority || "normal",
          })),
          pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule pending list 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "할일 목록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 완료된 할일 목록
   */
  async showCompletedList(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const page = parseInt(params) || 1;

    try {
      const result = await this.todoService.getUserTodos(userId, {
        status: this.constants.STATUS.COMPLETED,
        page,
        limit: this.config.pageSize,
      });

      return {
        module: "todo",
        type: "list",
        subType: "completed",
        data: {
          todos: result.todos.map((todo) => ({
            id: todo._id.toString(),
            title: todo.title,
            completedAt: TimeHelper.format(todo.completedAt, "relative"),
            status: todo.status,
          })),
          pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule completed list 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "완료된 할일 목록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 빠른 할일 추가 (제목만)
   */
  async addQuickTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    // 사용자 상태 설정 (입력 대기)
    this.setUserState(userId, {
      waitingFor: "todo_title",
      action: "add_quick",
      timestamp: Date.now(),
    });

    return {
      module: "todo",
      type: "input_mode",
      data: {
        message: "📝 할일 제목을 입력하세요:",
        placeholder: "예: 장보기, 운동하기, 책 읽기",
        maxLength: this.config.maxTitleLength,
      },
    };
  }

  // ===== 🔧 할일 조작 액션들 =====

  /**
   * 할일 상태 토글 (완료/미완료)
   */
  async toggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params;

    if (!todoId) {
      return {
        module: "todo",
        type: "error",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      const result = await this.todoService.toggleTodoStatus(userId, todoId);

      logger.info(`할일 상태 변경: ${todoId} -> ${result.status}`);

      // 성공 시 현재 목록으로 돌아가기
      return await this.showPendingList(
        bot,
        callbackQuery,
        subAction,
        "1",
        moduleManager
      );
    } catch (error) {
      logger.error("TodoModule toggle 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "상태 변경에 실패했습니다.",
      };
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params;

    if (!todoId) {
      return {
        module: "todo",
        type: "error",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      await this.todoService.deleteTodo(userId, todoId);

      logger.info(`할일 삭제: ${todoId}`);

      // 성공 시 현재 목록으로 돌아가기
      return await this.showPendingList(
        bot,
        callbackQuery,
        subAction,
        "1",
        moduleManager
      );
    } catch (error) {
      logger.error("TodoModule delete 실패:", error);
      return {
        module: "todo",
        type: "error",
        message: "삭제에 실패했습니다.",
      };
    }
  }

  // ===== 🎯 헬퍼 메서드들 =====

  /**
   * 할일 입력 처리
   */
  async handleTodoInput(bot, msg, userState) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      if (userState.action === "add_quick") {
        // 제목 길이 검증
        if (text.length > this.config.maxTitleLength) {
          await bot.telegram.sendMessage(
            chatId,
            `❌ 제목이 너무 깁니다\\. ${this.config.maxTitleLength}자 이내로 입력해주세요\\.`,
            { parse_mode: "MarkdownV2" }
          );
          return true;
        }

        // 할일 추가
        const todo = await this.todoService.createTodo(userId, {
          title: text.trim(),
          status: this.constants.STATUS.PENDING,
          createdAt: new Date(),
        });

        // 사용자 상태 초기화
        this.clearUserState(userId);

        // 성공 메시지
        await bot.telegram.sendMessage(
          chatId,
          `✅ 할일이 추가되었습니다\\!\n📝 ${this.escapeMarkdownV2(text)}`,
          {
            parse_mode: "MarkdownV2",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 목록 보기",
                    callback_data: "todo:list:pending:1",
                  },
                ],
                [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
              ],
            },
          }
        );

        return true;
      }
    } catch (error) {
      logger.error("할일 입력 처리 실패:", error);

      // 사용자 상태 초기화
      this.clearUserState(userId);

      await bot.telegram.sendMessage(
        chatId,
        "❌ 할일 추가에 실패했습니다\\. 다시 시도해주세요\\.",
        { parse_mode: "MarkdownV2" }
      );
      return true;
    }

    return false;
  }

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (text.startsWith("/")) {
      return text.slice(1).split(" ")[0].toLowerCase();
    }
    return text.toLowerCase();
  }

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
    });
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId) {
    const state = this.userStates.get(userId.toString());

    // 5분 후 상태 자동 만료
    if (state && Date.now() - state.timestamp > 300000) {
      this.userStates.delete(userId.toString());
      return null;
    }

    return state;
  }

  /**
   * 텔레그램 MarkdownV2 형식에 맞게 특수 문자를 이스케이프 처리합니다.
   * @param {string} text - 이스케이프 처리할 원본 텍스트
   * @returns {string} - 이스케이프 처리된 텍스트
   */
  escapeMarkdownV2(text) {
    // 만약 텍스트가 문자열이 아니면, 일단 문자열로 변환합니다.
    if (typeof text !== "string") {
      text = String(text);
    }

    // 이스케이프 처리해야 할 특수 문자 목록
    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];

    // 정규식을 사용하여 목록에 있는 모든 특수 문자를 찾아 그 앞에 '\'를 붙여줍니다.
    return text.replace(
      new RegExp(`[${escapeChars.map((c) => `\\${c}`).join("")}]`, "g"),
      "\\$&" // <--- 이 부분 주의!
    );
  }
}

module.exports = TodoModule;
