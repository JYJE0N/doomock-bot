// src/modules/TodoModule.js - 📝 할일 관리 모듈 (UI 로직 분리 버전)
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
    if (text.length > 0 && !text.startsWith("/")) {
      return await this.handleQuickAdd(bot, msg, text);
    }
    return false;
  }

  // ===== 📋 액션 핸들러 (데이터만 반환하도록 수정) =====

  async showTodoMenu(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      // ✅ UI 대신 데이터 객체 반환
      return {
        type: "list", // TodoRenderer가 list 타입으로 처리
        module: "todo",
        data: { userName, todos, stats },
      };
    } catch (error) {
      logger.error("할일 메뉴 데이터 생성 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "메뉴 데이터를 불러올 수 없습니다." },
      };
    }
  }

  async showTodoList(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      // ✅ UI 대신 데이터 객체 반환
      return {
        type: "list",
        module: "todo",
        data: { userName, todos, stats },
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

    // ✅ UI 대신 데이터 객체 반환
    return {
      type: "input_prompt",
      module: "todo",
      data: {
        message: "추가할 할일 내용을 입력해주세요.",
        placeholder: "예: 주간 보고서 작성하기",
      },
    };
  }

  async handleToggleTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;
    try {
      await this.todoService.toggleTodo(userId, todoId);
      // ✅ 처리 후, 전체 목록 데이터를 다시 반환하여 화면 갱신
      return await this.showTodoList(bot, callbackQuery, "");
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
      // ✅ 처리 후, 전체 목록 데이터를 다시 반환하여 화면 갱신
      return await this.showTodoList(bot, callbackQuery, "");
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

      // ✅ UI 대신 데이터 객체 반환
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
    // 페이지네이션은 showTodoList에서 처리하므로 그대로 호출
    return await this.showTodoList(bot, callbackQuery, params);
  }

  // ===== 🛠️ 유틸리티 메서드들 (변경 없음) =====

  async handleUserInput(bot, msg, text, inputState) {
    const userId = getUserId(msg.from);
    try {
      if (inputState.inputType === "add_todo") {
        this.userInputStates.delete(userId); // 먼저 상태를 제거
        const result = await this.todoService.addTodo(userId, { text });
        if (result.success) {
          // 성공 시, 갱신된 목록을 보여주기 위해 showTodoList 호출
          const updatedListResult = await this.showTodoList(
            bot,
            {
              from: msg.from,
              message: {
                chat: { id: inputState.chatId },
                message_id: inputState.messageId,
              },
            },
            ""
          );
          // 성공 메시지를 별도로 보냄
          await bot.telegram.sendMessage(
            inputState.chatId,
            `✅ 할일 "${text}"이(가) 추가되었습니다.`
          );
          return updatedListResult;
        } else {
          await bot.telegram.sendMessage(
            inputState.chatId,
            `❌ 할일 추가 실패: ${result.error}`
          );
        }
      }
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.userInputStates.delete(userId);
      await bot.telegram.sendMessage(
        msg.chat.id,
        "❌ 입력 처리 중 오류가 발생했습니다."
      );
    }
    return true;
  }

  async handleQuickAdd(bot, msg, text) {
    const userId = getUserId(msg.from);
    try {
      const result = await this.todoService.addTodo(userId, { text });
      if (result.success) {
        await bot.telegram.sendMessage(
          msg.chat.id,
          `✅ 할일이 추가되었습니다: ${text}`
        );
      } else {
        await bot.telegram.sendMessage(
          msg.chat.id,
          `❌ 할일 추가 실패: ${result.error}`
        );
      }
      return true;
    } catch (error) {
      logger.error("빠른 할일 추가 실패:", error);
      return false;
    }
  }

  calculateStats(todos) {
    const total = todos.length;
    if (total === 0)
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
        priority: { high: 0, medium: 0, low: 0 },
        completedToday: 0,
        completedThisWeek: 0,
      };

    const completed = todos.filter((t) => t.completed).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());

    return {
      total,
      completed,
      pending: total - completed,
      completionRate: Math.round((completed / total) * 100),
      priority: {
        high: todos.filter((t) => t.priority >= 4).length,
        medium: todos.filter((t) => t.priority === 3).length,
        low: todos.filter((t) => t.priority <= 2).length,
      },
      completedToday: todos.filter(
        (t) => t.completed && new Date(t.completedAt) >= today
      ).length,
      completedThisWeek: todos.filter(
        (t) => t.completed && new Date(t.completedAt) >= thisWeekStart
      ).length,
    };
  }

  truncateText(text, maxLength) {
    return (text || "").length > maxLength
      ? text.substring(0, maxLength - 3) + "..."
      : text || "";
  }

  getPriorityIcon(priority) {
    if (priority >= 4) return "🔴";
    if (priority === 3) return "🟡";
    return "🟢";
  }
}

module.exports = TodoModule;
