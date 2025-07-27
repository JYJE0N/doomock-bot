// src/modules/TodoModule.js - 할일 관리 모듈 (표준 준수)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger"); // LoggerEnhancer 적용된 버전
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 📝 TodoModule - 할일 관리 모듈
 * - 표준 매개변수 준수: (bot, callbackQuery, subAction, params, moduleManager)
 * - LoggerEnhancer 활용
 * - NavigationHandler 중앙 관리 (UI는 여기서 안 만듦)
 * - 담백한 기능만
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // 서비스
    this.todoService = null;
    this.serviceBuilder = options.serviceBuilder || null;

    // 모듈 설정 (환경변수 기반)
    this.config = {
      maxItemsPerUser: parseInt(process.env.MAX_TODO_PER_USER) || 50,
      pageSize: 5, // 담백하게
      ...options.config,
    };

    logger.module("TodoModule", "모듈 생성", { version: "3.0.1" });
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      logger.module("TodoModule", "초기화 시작");
      this.todoService = await this.serviceBuilder.getOrCreate("todo", {
        config: this.config,
      });
      await this.todoService.initialize();

      logger.success("TodoModule 초기화 완료");
    } catch (error) {
      logger.error("TodoModule 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 기본 액션만 (담백하게)
      menu: this.showMenu,
      list: this.showList,
      add: this.showAdd,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,
      help: this.showHelp,
    });

    logger.module("TodoModule", "액션 등록 완료", {
      count: this.actionMap.size,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "todo" || command === "할일") {
      // NavigationHandler에게 메뉴 요청 (UI 중앙 관리)
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "todo"
      );
      return true;
    }

    return false;
  }

  // ===== 📋 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 메뉴 표시 (NavigationHandler가 호출)
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.todoService.getTodoStatus(userId);
    } catch (error) {
      return {
        type: "error",
        message: error.message, // ← 서비스의 에러 메시지 그대로 활용
      };
    }
  }

  /**
   * 목록 표시
   */
  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const page = parseInt(params.page) || 1;

    logger.debug(`TodoModule: list 호출 (사용자: ${userId})`);

    try {
      const result = await this.todoService.getUserTodos(userId, {
        page,
        limit: this.config.pageSize,
        status: "pending",
      });

      // NavigationHandler에게 데이터 전달
      return {
        type: "list",
        module: "todo",
        data: {
          todos: result.todos,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
        },
      };
    } catch (error) {
      logger.error("todo list 조회 실패", error);
      return { type: "error", message: "목록을 불러올 수 없습니다." };
    }
  }

  /**
   * 할일 추가
   */
  async showAdd(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.navigation("todo", "add", userId);

    // 사용자 상태 설정 (입력 대기)
    this.setUserState(userId, {
      waitingFor: "todo_title",
      action: "add",
    });

    // NavigationHandler에게 입력 모드 알림
    return {
      type: "input",
      module: "todo",
      message: "할일 제목을 입력하세요:",
    };
  }

  /**
   * 할일 토글 (완료/미완료)
   */
  async toggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params.id;

    logger.action("todo", "toggle", userId, todoId);

    try {
      await this.todoService.toggleTodo(userId, todoId);

      // 성공 시 목록 새로고침
      return await this.showList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      logger.error("todo toggle 실패", error);
      return { type: "error", message: "상태 변경에 실패했습니다." };
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params.id;

    logger.action("todo", "delete", userId, todoId);

    try {
      await this.todoService.deleteTodo(userId, todoId);

      // 성공 시 목록 새로고침
      return await this.showList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      logger.error("todo delete 실패", error);
      return { type: "error", message: "삭제에 실패했습니다." };
    }
  }

  /**
   * 도움말
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    logger.navigation("todo", "help");

    return {
      type: "help",
      module: "todo",
      data: {
        title: "할일 관리 도움말",
        features: ["할일 추가/완료/삭제", "목록 보기", "진행률 확인"],
        commands: ["/todo - 할일 메뉴"],
      },
    };
  }

  /**
   * 사용자 입력 처리 (제목 입력 등)
   */
  async handleUserInput(bot, msg, text) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userState = this.getUserState(userId);

    if (!userState || userState.waitingFor !== "todo_title") {
      return false;
    }

    try {
      // 할일 생성
      await this.todoService.createTodo(userId, {
        title: text.trim(),
        priority: "medium",
      });

      // 상태 초기화
      this.clearUserState(userId);

      // 성공 메시지 (NavigationHandler 통해)
      await this.moduleManager.navigationHandler.sendSuccess(
        bot,
        chatId,
        "할일이 추가되었습니다!"
      );

      logger.success("todo 추가 완료", { userId, title: text });
      return true;
    } catch (error) {
      logger.error("todo 추가 실패", error);
      await this.moduleManager.navigationHandler.sendError(
        bot,
        chatId,
        "할일 추가에 실패했습니다."
      );
      return false;
    }
  }
}

module.exports = TodoModule; // ✅ 필수!
