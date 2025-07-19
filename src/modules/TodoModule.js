// src/modules/TodoModule.js - 견고한 구현 예시

const BaseModule = require("./BaseModule");
const { TodoService } = require("../services/TodoService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
const Logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule", {
      features: ["list", "add", "toggle", "delete", "stats", "clear"],
    });

    this.todoService = new TodoService();
    this.userStates = new Map();
  }

  // ✅ 액션 등록 (표준 패턴)
  registerActions() {
    // 기본 액션들은 BaseModule에서 자동 등록됨 (menu, help, status)
    this.actionMap.set("list", this.showList.bind(this));
    this.actionMap.set("add", this.startAdd.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("clear", this.handleClear.bind(this));

    // 동적 액션들은 handleCallback에서 별도 처리
    // (toggle_0, delete_1 등)
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    return {
      text: `📝 **${userName}님의 할일 관리**\n\n할일을 효율적으로 관리해보세요:`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📝 할일 추가", callback_data: "todo_add" },
            { text: "📋 할일 목록", callback_data: "todo_list" },
          ],
          [
            { text: "📊 통계 보기", callback_data: "todo_stats" },
            { text: "❓ 도움말", callback_data: "todo_help" },
          ],
          [
            { text: "🗑️ 완료 삭제", callback_data: "todo_clear_completed" },
            { text: "⚠️ 전체 삭제", callback_data: "todo_clear_all" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ✅ 동적 콜백 처리 (BaseModule 확장)
  async handleCallback(bot, callbackQuery, subAction, params) {
    // 동적 액션 처리 (toggle_0, delete_1 등)
    if (subAction.startsWith("toggle_") || subAction.startsWith("delete_")) {
      return await this.handleDynamicAction(bot, callbackQuery, subAction);
    }

    // 표준 액션은 부모 클래스에서 처리
    return await super.handleCallback(bot, callbackQuery, subAction, params);
  }

  // ✅ 동적 액션 처리
  async handleDynamicAction(bot, callbackQuery, action) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const [actionType, indexStr] = action.split("_");
      const index = parseInt(indexStr);

      if (actionType === "toggle") {
        await this.toggleTodo(bot, chatId, messageId, userId, index);
      } else if (actionType === "delete") {
        await this.deleteTodo(bot, chatId, messageId, userId, index);
      }

      return true;
    } catch (error) {
      Logger.error(`동적 액션 처리 오류 (${action}):`, error);
      return false;
    }
  }

  // ✅ 개별 기능 구현들
  async showList(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this.todoService.getTodos(userId);

      if (!Array.isArray(todos) || todos.length === 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `📝 ${userName}님의 할일이 없습니다.\n\n새로운 할일을 추가해보세요!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ 할일 추가", callback_data: "todo_add" }],
                [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
              ],
            },
          }
        );
        return;
      }

      const todoText = this.formatTodoList(todos, userName);
      const todoButtons = this.createTodoButtons(todos);

      await this.editMessage(bot, chatId, messageId, todoText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: todoButtons },
      });
    } catch (error) {
      Logger.error("할일 목록 조회 오류:", error);
      await this.handleError(bot, chatId, error);
    }
  }

  async startAdd(bot, chatId, messageId, userId, userName) {
    this.userStates.set(userId, { action: "adding_todo" });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_menu" }]],
        },
      }
    );
  }

  async showStats(bot, chatId, messageId, userId, userName) {
    try {
      const stats = await this.todoService.getStats(userId);

      const statsText =
        `📊 **할일 통계**\n\n` +
        `📝 전체 할일: ${stats.total}개\n` +
        `✅ 완료: ${stats.completed}개\n` +
        `⏳ 진행중: ${stats.pending}개\n` +
        `📈 완료율: ${stats.completionRate}%\n\n` +
        `${
          stats.completionRate >= 80
            ? "🎉 훌륭해요!"
            : stats.completionRate >= 50
              ? "💪 잘하고 있어요!"
              : "📚 화이팅!"
        }`;

      await this.editMessage(bot, chatId, messageId, statsText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    } catch (error) {
      Logger.error("할일 통계 조회 오류:", error);
      await this.handleError(bot, chatId, error);
    }
  }

  async handleClear(bot, chatId, messageId, userId, userName, params) {
    const clearType = params && params[0]; // 'completed' 또는 'all'

    try {
      if (clearType === "completed") {
        await this.todoService.clearCompletedTodos(userId);
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "✅ 완료된 할일이 모두 삭제되었습니다!"
        );
      } else if (clearType === "all") {
        await this.todoService.clearAllTodos(userId);
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "⚠️ 모든 할일이 삭제되었습니다!"
        );
      }
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ✅ 메시지 처리 (할일 추가 상태 처리)
  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 할일 추가 상태 처리
    if (userState && userState.action === "adding_todo") {
      try {
        const validatedTask = ValidationHelper.validateTodoTask(text);
        const success = await this.todoService.addTodo(userId, validatedTask);

        if (success) {
          await this.sendMessage(
            bot,
            chatId,
            `✅ 할일이 추가되었습니다!\n\n📝 "${validatedTask}"`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
                  [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
                ],
              },
            }
          );
        } else {
          await this.sendMessage(
            bot,
            chatId,
            "❌ 할일 추가 중 오류가 발생했습니다."
          );
        }

        this.userStates.delete(userId);
        return true;
      } catch (error) {
        await this.sendMessage(bot, chatId, `❌ ${error.message}`);
        return true;
      }
    }

    // 빠른 명령어 처리
    if (text && text.startsWith("/add ")) {
      const taskText = text.replace("/add ", "").trim();
      if (taskText) {
        const success = await this.todoService.addTodo(userId, taskText);
        if (success) {
          await this.sendMessage(bot, chatId, `✅ 할일 추가: "${taskText}"`);
        }
        return true;
      }
    }

    return false;
  }

  // ✅ 유틸리티 메서드들
  formatTodoList(todos, userName) {
    const pendingTodos = todos.filter((todo) => !todo.done);
    const completedTodos = todos.filter((todo) => todo.done);

    let todoText = `📋 **${userName}님의 할일 관리**\n\n`;

    if (pendingTodos.length > 0) {
      todoText += `🟢 **진행 중** (${pendingTodos.length}개)\n`;
      pendingTodos.forEach((todo) => {
        todoText += `☐ ${todo.task}\n`;
      });
      todoText += "\n";
    }

    if (completedTodos.length > 0) {
      todoText += `📌 **완료** (${completedTodos.length}개)\n`;
      completedTodos.forEach((todo) => {
        todoText += `📌 ~~${todo.task}~~\n`;
      });
    }

    return todoText;
  }

  createTodoButtons(todos) {
    const todoButtons = [];

    todos.forEach((todo, index) => {
      todoButtons.push([
        {
          text: `${todo.done ? "✅" : "☐"} ${todo.task}`,
          callback_data: `todo_toggle_${index}`,
        },
        {
          text: "🗑️",
          callback_data: `todo_delete_${index}`,
        },
      ]);
    });

    todoButtons.push([
      { text: "➕ 할일 추가", callback_data: "todo_add" },
      { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
    ]);

    return todoButtons;
  }

  async toggleTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const newStatus = await this.todoService.toggleTodo(userId, todoIndex);
      if (newStatus !== null) {
        const statusText = newStatus ? "완료" : "미완료";
        await this.sendMessage(
          bot,
          chatId,
          `✅ 할일이 ${statusText}로 변경되었습니다!`
        );
      }
    } catch (error) {
      Logger.error("할일 토글 오류:", error);
    }
  }

  async deleteTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const success = await this.todoService.deleteTodo(userId, todoIndex);
      if (success) {
        await this.sendMessage(bot, chatId, `🗑️ 할일이 삭제되었습니다!`);
      }
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
    }
  }

  // ✅ 도움말 메시지 오버라이드
  getHelpMessage() {
    return (
      `📝 **할일 관리 도움말**\n\n` +
      `**🎯 주요 기능:**\n` +
      `• 할일 추가/삭제\n` +
      `• 완료 상태 토글\n` +
      `• 통계 확인\n` +
      `• 완료된 할일 정리\n\n` +
      `**⌨️ 빠른 명령어:**\n` +
      `/add [할일] - 할일 빠른 추가\n\n` +
      `효율적인 할일 관리로 생산성을 높여보세요! 💪`
    );
  }
}

module.exports = TodoModule;
