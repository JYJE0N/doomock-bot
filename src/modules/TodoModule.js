const BaseModule = require("./BaseModule");
const { TodoService } = require("../services/TodoService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule");
    this.todoService = new TodoService();
    this.userStates = new Map();
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 상태별 메시지 처리
    if (userState && userState.action === "adding_todo") {
      return await this.handleTodoAdd(bot, chatId, userId, text);
    }

    // 명령어 처리
    if (text && text.startsWith("/add ")) {
      const taskText = text.replace("/add ", "").trim();
      if (taskText) {
        await this.addTodo(bot, chatId, userId, taskText);
        return true;
      }
    }

    return false;
  }

  // 새로운 콜백 구조에 맞춘 handleCallback 메서드
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    switch (subAction) {
      case "menu":
        await this.showTodoMenu(bot, chatId, messageId, userName);
        break;
      case "list":
        await this.showTodoList(bot, chatId, messageId, userId, userName);
        break;
      case "add":
        await this.startTodoAdd(bot, chatId, messageId, userId);
        break;
      case "stats":
        await this.showTodoStats(bot, chatId, messageId, userId);
        break;
      case "clear_completed":
        await this.clearCompletedTodos(bot, chatId, messageId, userId);
        break;
      case "clear_all":
        await this.clearAllTodos(bot, chatId, messageId, userId);
        break;
      default:
        await this.sendMessage(
          bot,
          chatId,
          "❌ 알 수 없는 할일 관리 명령입니다."
        );
    }
  }

  // 동적 콜백을 위한 메서드들 (CallbackManager에서 직접 호출)
  async toggleTodo(bot, chatId, messageId, userId, index) {
    const result = this.todoService.toggleTodo(userId, index);

    if (result.success) {
      const userName = getUserName({ id: userId }); // 기본 구조
      await this.showTodoList(bot, chatId, messageId, userId, userName);
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    }
  }

  async deleteTodo(bot, chatId, messageId, userId, index) {
    const result = this.todoService.deleteTodo(userId, index);

    if (result.success) {
      const userName = getUserName({ id: userId }); // 기본 구조
      await this.showTodoList(bot, chatId, messageId, userId, userName);
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    }
  }

  async showTodoMenu(bot, chatId, messageId, userName) {
    const menuText = `📝 **${userName}님의 할일 관리**\n\n할일을 효율적으로 관리하세요!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 추가", callback_data: "todo_add" },
          { text: "📋 할일 목록", callback_data: "todo_list" },
        ],
        [
          { text: "📊 통계 보기", callback_data: "todo_stats" },
          { text: "🗑️ 완료 항목 삭제", callback_data: "todo_clear_completed" },
        ],
        [
          { text: "🗑️ 전체 삭제", callback_data: "todo_clear_all" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showTodoList(bot, chatId, messageId, userId, userName) {
    const todos = this.todoService.getTodos(userId);

    if (todos.length === 0) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `📝 **${userName}님의 할일 목록**\n\n할일이 없습니다. 새로운 할일을 추가해보세요!`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📝 할일 추가", callback_data: "todo_add" },
                { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
              ],
            ],
          },
        }
      );
      return;
    }

    const completedCount = todos.filter((todo) => todo.completed).length;
    const todoText =
      `📝 **${userName}님의 할일 목록**\n\n` +
      `📊 진행률: ${completedCount}/${todos.length} (${Math.round((completedCount / todos.length) * 100)}%)\n\n` +
      todos
        .map(
          (todo, index) =>
            `${todo.completed ? "✅" : "⭕"} ${index + 1}. ${todo.task}`
        )
        .join("\n");

    const keyboard = {
      inline_keyboard: this.createTodoButtons(todos),
    };

    await this.editMessage(bot, chatId, messageId, todoText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async startTodoAdd(bot, chatId, messageId, userId) {
    this.userStates.set(userId, { action: "adding_todo" });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "📝 **새 할일 추가**\n\n할일 내용을 입력해주세요:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ 취소", callback_data: "cancel_action" }],
          ],
        },
      }
    );
  }

  async handleTodoAdd(bot, chatId, userId, text) {
    try {
      const task = ValidationHelper.validateTodoText(text);
      const result = this.todoService.addTodo(userId, task);

      if (result.success) {
        this.userStates.delete(userId);
        await this.sendMessage(
          bot,
          chatId,
          `✅ 할일이 추가되었습니다!\n\n📝 ${task}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📋 할일 목록", callback_data: "todo_list" },
                  { text: "📝 계속 추가", callback_data: "todo_add" },
                ],
                [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      await this.sendMessage(bot, chatId, "❌ 유효하지 않은 할일입니다.");
    }

    return true;
  }

  async addTodo(bot, chatId, userId, taskText) {
    try {
      const task = ValidationHelper.validateTodoText(taskText);
      const result = this.todoService.addTodo(userId, task);

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `✅ 할일이 추가되었습니다!\n\n📝 ${task}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 할일 목록", callback_data: "todo_list" }],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      await this.sendMessage(bot, chatId, "❌ 유효하지 않은 할일입니다.");
    }
  }

  async showTodoStats(bot, chatId, messageId, userId) {
    const stats = this.todoService.getStats(userId);

    const statsText =
      `📊 **할일 통계**\n\n` +
      `📝 전체 할일: ${stats.total}개\n` +
      `✅ 완료된 할일: ${stats.completed}개\n` +
      `⭕ 미완료 할일: ${stats.pending}개\n` +
      `📈 완료율: ${stats.completionRate}%\n\n` +
      `🎯 오늘도 화이팅!`;

    await this.editMessage(bot, chatId, messageId, statsText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo_list" },
            { text: "📝 할일 추가", callback_data: "todo_add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      },
    });
  }

  async clearCompletedTodos(bot, chatId, messageId, userId) {
    const result = this.todoService.clearCompleted(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `✅ 완료된 할일 ${result.data.count}개가 삭제되었습니다.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📋 할일 목록", callback_data: "todo_list" },
                { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
              ],
            ],
          },
        }
      );
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    }
  }

  async clearAllTodos(bot, chatId, messageId, userId) {
    const result = this.todoService.clearAll(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `🗑️ 모든 할일이 삭제되었습니다.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📝 새 할일 추가", callback_data: "todo_add" },
                { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
              ],
            ],
          },
        }
      );
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    }
  }

  createTodoButtons(todos) {
    const todoButtons = [];

    // 할일별 토글/삭제 버튼 (최대 5개까지만 표시)
    const displayTodos = todos.slice(0, 5);
    displayTodos.forEach((todo, index) => {
      todoButtons.push([
        {
          text: `${todo.completed ? "↩️" : "✅"} ${index + 1}번`,
          callback_data: `todo_toggle_${index}`,
        },
        {
          text: `🗑️ ${index + 1}번`,
          callback_data: `todo_delete_${index}`,
        },
      ]);
    });

    // 더 많은 할일이 있는 경우 안내
    if (todos.length > 5) {
      todoButtons.push([
        {
          text: `... 그 외 ${todos.length - 5}개 더`,
          callback_data: "todo_list",
        },
      ]);
    }

    todoButtons.push([
      { text: "📝 할일 추가", callback_data: "todo_add" },
      { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
    ]);

    return todoButtons;
  }
}

module.exports = TodoModule;
