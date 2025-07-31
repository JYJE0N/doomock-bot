// src/modules/TodoModule.js - 📝 할일 관리 모듈 (UI 로직 완전 분리 버전)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);
    this.todoService = null;
    this.config = {
      maxTextLength: 30,
      maxTodosPerPage: 8,
      ...options.config,
    };
    this.userInputStates = new Map();
    logger.info("📝 TodoModule 생성됨 - Mongoose 버전!");
  }

  async onInitialize() {
    try {
      logger.info("📝 TodoModule 초기화 시작...");
      this.todoService = this.serviceBuilder.getServiceInstance("todo");
      if (!this.todoService) {
        throw new Error("TodoService 인스턴스를 가져올 수 없습니다.");
      }
      this.setupActions();
      logger.success("✅ TodoModule 초기화 완료!");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showTodoMenu,
      list: this.showTodoList,
      add: this.handleAddTodo,
      toggle: this.handleToggleTodo,
      delete: this.handleDeleteTodo,
      stats: this.showTodoStats,
      page: this.handlePageNavigation,
    });
  }

  getModuleKeywords() {
    return ["할일", "todo", "📝"];
  }

  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const text = msg.text?.trim();
    if (!text) return false;

    const inputState = this.userInputStates.get(userId);
    if (inputState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, inputState);
    }

    if (this.isModuleMessage(text, this.getModuleKeywords())) {
      if (this.moduleManager?.navigationHandler) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          msg.chat.id,
          "todo"
        );
        return true;
      }
    }
    return false;
  }

  // ===== 📋 액션 핸들러 (데이터만 반환) =====

  async showTodoMenu(bot, callbackQuery) {
    return this.showTodoList(bot, callbackQuery, "1");
  }

  async showTodoList(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      return {
        type: "list",
        module: "todo",
        data: {
          userName,
          todos,
          stats,
          page: parseInt(params) || 1,
          ...this.config,
        },
      };
    } catch (error) {
      logger.error("할일 목록 데이터 생성 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "목록 데이터를 불러올 수 없습니다." },
      };
    }
  }

  async handleAddTodo(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    this.userInputStates.set(userId, {
      awaitingInput: true,
      inputType: "add_todo",
      chatId: callbackQuery.message.chat.id,
      messageId: callbackQuery.message.message_id,
    });
    return {
      type: "input_prompt",
      module: "todo",
      data: { message: "추가할 할일 내용을 입력해주세요." },
    };
  }

  async handleToggleTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;
    try {
      await this.todoService.toggleTodo(userId, todoId);
      return await this.showTodoList(bot, callbackQuery, "1");
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "상태 변경에 실패했습니다." },
      };
    }
  }

  async handleDeleteTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;
    try {
      await this.todoService.deleteTodo(userId, todoId);
      return await this.showTodoList(bot, callbackQuery, "1");
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "삭제에 실패했습니다." },
      };
    }
  }

  async showTodoStats(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      return {
        type: "stats",
        module: "todo",
        data: { stats },
      };
    } catch (error) {
      logger.error("할일 통계 데이터 생성 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "통계 데이터를 불러올 수 없습니다." },
      };
    }
  }

  async handlePageNavigation(bot, callbackQuery, params) {
    return await this.showTodoList(bot, callbackQuery, params);
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  async handleUserInput(bot, msg, text, inputState) {
    const userId = getUserId(msg.from);
    try {
      if (inputState.inputType === "add_todo") {
        this.userInputStates.delete(userId);
        const result = await this.todoService.addTodo(userId, { text });

        if (result.success) {
          await bot.telegram
            .deleteMessage(msg.chat.id, msg.message_id)
            .catch(() => {});
          const fakeCallbackQuery = {
            from: msg.from,
            message: {
              chat: { id: inputState.chatId },
              message_id: inputState.messageId,
            },
          };
          return this.showTodoList(bot, fakeCallbackQuery, "1");
        } else {
          return {
            type: "error",
            module: "todo",
            data: { message: `할일 추가 실패: ${result.error}` },
          };
        }
      }
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.userInputStates.delete(userId);
      return {
        type: "error",
        module: "todo",
        data: { message: "입력 처리 중 오류가 발생했습니다." },
      };
    }
    return false;
  }

  calculateStats(todos) {
    const total = todos.length;
    if (total === 0)
      return { total: 0, completed: 0, pending: 0, completionRate: 0 };

    const completed = todos.filter((t) => t.completed).length;
    return {
      total,
      completed,
      pending: total - completed,
      completionRate: Math.round((completed / total) * 100),
    };
  }
}

module.exports = TodoModule;
