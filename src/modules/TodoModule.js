const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

/**
 * 📋 TodoModule - 할일 관리 모듈 (심플 연결 버전)
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.todoService = null;
    this.userStates = new Map(); // 사용자 입력 상태
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    // ServiceBuilder에서 TodoService 가져오기
    this.todoService = this.serviceBuilder.getServiceInstance("todo");

    if (!this.todoService) {
      throw new Error("TodoService를 찾을 수 없습니다");
    }

    this.setupActions();
    logger.success("📋 TodoModule 초기화 완료");
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("list", this.showList.bind(this));
    this.actionMap.set("add", this.startAdd.bind(this));
    this.actionMap.set("toggle", this.toggleTodo.bind(this));
    this.actionMap.set("delete", this.deleteTodo.bind(this));
    this.actionMap.set("page", this.changePage.bind(this));
  }

  /**
   * 📋 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    return {
      type: "menu",
      module: "todo",
      data: { userId },
    };
  }

  /**
   * 📋 할일 목록 표시
   */
  async showList(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const page = parseInt(params) || 1;

    const result = await this.todoService.getTodos(userId, { page, limit: 8 });

    if (!result.success) {
      return {
        type: "error",
        module: "todo",
        data: { message: result.message },
      };
    }

    return {
      type: "list",
      module: "todo",
      data: result.data,
    };
  }

  /**
   * ➕ 할일 추가 시작
   */
  async startAdd(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    // 사용자 상태 설정
    this.userStates.set(userId, {
      action: "waiting_add_input",
      messageId: callbackQuery.message.message_id,
    });

    return {
      type: "add_prompt",
      module: "todo",
      data: { userId },
    };
  }

  /**
   * ✅ 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        data: { message: "할일 ID가 필요합니다." },
      };
    }

    const result = await this.todoService.toggleTodo(userId, todoId);

    if (!result.success) {
      return {
        type: "error",
        module: "todo",
        data: { message: result.message },
      };
    }

    // 목록을 다시 표시
    return await this.showList(bot, callbackQuery, "1");
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        data: { message: "할일 ID가 필요합니다." },
      };
    }

    const result = await this.todoService.deleteTodo(userId, todoId);

    if (!result.success) {
      return {
        type: "error",
        module: "todo",
        data: { message: result.message },
      };
    }

    // 목록을 다시 표시
    return await this.showList(bot, callbackQuery, "1");
  }

  /**
   * 📄 페이지 변경
   */
  async changePage(bot, callbackQuery, params) {
    const page = parseInt(params) || 1;
    return await this.showList(bot, callbackQuery, page.toString());
  }

  /**
   * 💬 메시지 처리 (할일 추가 입력)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.userStates.get(userId);

    if (!userState || userState.action !== "waiting_add_input") {
      return; // 이 모듈에서 처리할 메시지가 아님
    }

    const title = msg.text?.trim();

    if (!title) {
      return {
        type: "add_error",
        module: "todo",
        data: { message: "할일 제목을 입력해주세요." },
      };
    }

    if (title.length > 100) {
      return {
        type: "add_error",
        module: "todo",
        data: { message: "할일 제목이 너무 깁니다. (최대 100자)" },
      };
    }

    // 할일 추가
    const result = await this.todoService.addTodo(userId, { title });

    // 상태 초기화
    this.userStates.delete(userId);

    if (result.success) {
      return {
        type: "add_success",
        module: "todo",
        data: {
          message: `"${title}" 할일이 추가되었습니다!`,
          todo: result.data,
        },
      };
    } else {
      return {
        type: "add_error",
        module: "todo",
        data: { message: result.message },
      };
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    this.userStates.clear();
    logger.debug("📋 TodoModule 정리 완료");
  }
}

module.exports = TodoModule;
