// src/modules/TodoModule.js - handleCallback 구조 통일

const BaseModule = require("./BaseModule");
const { TodoService } = require("../services/TodoService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
const Logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule", {
      commands: ["todo", "할일"],
      callbacks: ["todo"],
    });
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

    // 상태가 있을 때 처리
    if (userState && userState.action === "waiting_todo_input") {
      return await this.handleTodoInput(bot, chatId, userId, text);
    }

    // 명령어 처리
    if (text && (text.startsWith("/todo") || text.startsWith("/할일"))) {
      await this.handleTodoCommand(bot, msg);
      return true;
    }

    // 빠른 할일 추가 (/add 할일내용)
    if (text && text.startsWith("/add ")) {
      const todoText = text.slice(5).trim();
      if (todoText) {
        return await this.addTodoQuick(bot, chatId, userId, todoText);
      }
    }

    return false;
  }

  // ⭐ TimerModule과 동일한 구조로 수정
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    // 동적 콜백 처리 (toggle_0, delete_1 등)
    if (
      subAction.includes("_") &&
      (subAction.startsWith("toggle") || subAction.startsWith("delete"))
    ) {
      return await this.handleDynamicCallback(bot, callbackQuery, subAction);
    }

    switch (subAction) {
      case "menu":
        await this.showTodoMenu(bot, chatId, messageId, userName);
        break;
      case "list":
        await this.showTodoList(bot, chatId, messageId, userId);
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
      case "help":
        await this.showTodoHelp(bot, chatId, messageId);
        break;
      case "clear_all_confirm":
        await this.confirmClearAllTodos(bot, chatId, messageId, userId);
        break;
      default:
        await this.sendMessage(bot, chatId, "❌ 알 수 없는 할일 명령입니다.");
    }
  }

  // 동적 콜백 처리 (toggle_0, delete_1 등)
  async handleDynamicCallback(bot, callbackQuery, subAction) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const parts = subAction.split("_");
      if (parts.length !== 2) {
        Logger.error("잘못된 동적 콜백 형식:", subAction);
        return false;
      }

      const [action, indexStr] = parts;
      const index = parseInt(indexStr);

      if (isNaN(index)) {
        Logger.error("잘못된 인덱스:", indexStr);
        return false;
      }

      if (action === "toggle") {
        await this.toggleTodo(bot, chatId, messageId, userId, index);
      } else if (action === "delete") {
        await this.deleteTodo(bot, chatId, messageId, userId, index);
      } else {
        Logger.error("알 수 없는 동적 액션:", action);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error("동적 콜백 처리 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  async showTodoMenu(bot, chatId, messageId, userName) {
    const menuText =
      `📝 **${userName}님의 할일 관리**\n\n` +
      "효율적인 할일 관리로 생산성을 높여보세요! 💪\n\n" +
      "원하는 기능을 선택해주세요:";

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: {
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
    });
  }

  async showTodoList(bot, chatId, messageId, userId) {
    try {
      const todos = await this.todoService.getTodos(userId);

      if (!todos || todos.length === 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "📝 **할일 목록**\n\n" +
            "아직 등록된 할일이 없습니다.\n" +
            "새로운 할일을 추가해보세요! ✨",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "➕ 할일 추가", callback_data: "todo_add" },
                  { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
                ],
              ],
            },
          }
        );
        return;
      }

      // 완료/미완료 분리
      const pendingTodos = todos.filter((todo) => !todo.completed);
      const completedTodos = todos.filter((todo) => todo.completed);

      let listText = "📝 **할일 목록**\n\n";

      // 미완료 할일
      if (pendingTodos.length > 0) {
        listText += "**🔄 진행 중인 할일:**\n";
        pendingTodos.forEach((todo, index) => {
          const originalIndex = todos.indexOf(todo);
          listText += `${index + 1}. ☐ ${todo.task}\n`;
        });
        listText += "\n";
      }

      // 완료된 할일
      if (completedTodos.length > 0) {
        listText += "**✅ 완료된 할일:**\n";
        completedTodos.forEach((todo, index) => {
          listText += `${index + 1}. ✅ ${todo.task}\n`;
        });
      }

      // 버튼 생성
      const buttons = this.createTodoButtons(todos);

      await this.editMessage(bot, chatId, messageId, listText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } catch (error) {
      Logger.error("할일 목록 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 할일 목록을 불러오는 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        }
      );
    }
  }

  createTodoButtons(todos) {
    const buttons = [];

    todos.forEach((todo, index) => {
      buttons.push([
        {
          text: `${todo.completed ? "✅" : "☐"} ${todo.task}`,
          callback_data: `todo_toggle_${index}`,
        },
        {
          text: "🗑️",
          callback_data: `todo_delete_${index}`,
        },
      ]);
    });

    // 하단 메뉴 버튼
    buttons.push([
      { text: "➕ 할일 추가", callback_data: "todo_add" },
      { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
    ]);

    return buttons;
  }

  async startTodoAdd(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_todo_input",
      originalMessageId: messageId,
    });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "📝 **할일 추가**\n\n" +
        "추가할 할일을 입력해주세요:\n\n" +
        "💡 예시: 회의 자료 준비, 점심 약속 등",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_menu" }]],
        },
      }
    );
  }

  async handleTodoInput(bot, chatId, userId, text) {
    try {
      const userState = this.userStates.get(userId);
      if (!userState) return false;

      const todoText = ValidationHelper.validateTodoText(text);
      const success = await this.todoService.addTodo(userId, todoText);

      if (success) {
        this.userStates.delete(userId);

        await this.sendMessage(
          bot,
          chatId,
          `✅ **할일 추가 완료!**\n\n` +
            `📝 "${todoText}" 이(가) 추가되었습니다.\n\n` +
            "계속해서 할일을 관리해보세요! 💪",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📋 할일 목록", callback_data: "todo_list" },
                  { text: "➕ 더 추가", callback_data: "todo_add" },
                ],
                [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 할일 추가에 실패했습니다. 다시 시도해주세요."
        );
      }

      return true;
    } catch (error) {
      Logger.error("할일 추가 처리 오류:", error);
      this.userStates.delete(userId);

      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  async toggleTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.toggleTodo(userId, todoIndex);

      if (result.success) {
        const statusText = result.completed ? "완료" : "미완료";

        // 성공 메시지 표시 후 목록 새로고침
        await this.sendMessage(
          bot,
          chatId,
          `✅ "${result.task}" 이(가) ${statusText}로 변경되었습니다!`
        );

        // 할일 목록 새로고침
        setTimeout(() => {
          this.showTodoList(bot, chatId, messageId, userId);
        }, 1500);
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      Logger.error("할일 토글 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  async deleteTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.deleteTodo(userId, todoIndex);

      if (result.success) {
        // 성공 메시지 표시 후 목록 새로고침
        await this.sendMessage(
          bot,
          chatId,
          `🗑️ "${result.task}" 이(가) 삭제되었습니다!`
        );

        // 할일 목록 새로고침
        setTimeout(() => {
          this.showTodoList(bot, chatId, messageId, userId);
        }, 1500);
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  async showTodoStats(bot, chatId, messageId, userId) {
    try {
      const stats = await this.todoService.getTodoStats(userId);

      if (stats) {
        const completion =
          stats.total > 0
            ? Math.round((stats.completed / stats.total) * 100)
            : 0;

        const statsText =
          "📊 **할일 통계**\n\n" +
          `📝 전체 할일: ${stats.total}개\n` +
          `✅ 완료된 할일: ${stats.completed}개\n` +
          `🔄 진행 중인 할일: ${stats.pending}개\n\n` +
          `💯 완료율: ${completion}%\n\n` +
          this.createProgressBar(stats.completed, stats.total);

        await this.editMessage(bot, chatId, messageId, statsText, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📋 할일 목록", callback_data: "todo_list" },
                { text: "➕ 할일 추가", callback_data: "todo_add" },
              ],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        });
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "📊 **할일 통계**\n\n아직 등록된 할일이 없습니다.",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "➕ 할일 추가", callback_data: "todo_add" },
                  { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
                ],
              ],
            },
          }
        );
      }
    } catch (error) {
      Logger.error("통계 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 통계를 불러오는 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        }
      );
    }
  }

  createProgressBar(current, total) {
    if (total === 0) return "░░░░░░░░░░ 0%";

    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;

    return `${"▓".repeat(filled)}${"░".repeat(empty)} ${percentage}%`;
  }

  async clearCompletedTodos(bot, chatId, messageId, userId) {
    try {
      const result = await this.todoService.clearCompleted(userId);

      if (result.success && result.count > 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `🗑️ **완료된 할일 삭제**\n\n` +
            `${result.count}개의 완료된 할일을 삭제했습니다! ✨`,
          {
            parse_mode: "Markdown",
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
      } else if (result.success && result.count === 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "🗑️ **완료된 할일 삭제**\n\n삭제할 완료된 할일이 없습니다.",
          {
            parse_mode: "Markdown",
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
    } catch (error) {
      Logger.error("완료된 할일 삭제 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 삭제 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        }
      );
    }
  }

  async clearAllTodos(bot, chatId, messageId, userId) {
    // 확인 메시지 표시
    await this.editMessage(
      bot,
      chatId,
      messageId,
      "⚠️ **전체 할일 삭제**\n\n" +
        "정말로 모든 할일을 삭제하시겠습니까?\n" +
        "이 작업은 되돌릴 수 없습니다! 🚨",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❌ 취소", callback_data: "todo_menu" },
              { text: "🗑️ 확인", callback_data: "todo_clear_all_confirm" },
            ],
          ],
        },
      }
    );
  }

  async showTodoHelp(bot, chatId, messageId) {
    const helpText =
      "📝 **할일 관리 도움말**\n\n" +
      "**🎯 주요 기능:**\n" +
      "• 할일 추가/삭제\n" +
      "• 완료 상태 토글\n" +
      "• 통계 확인\n" +
      "• 완료된 할일 정리\n\n" +
      "**⌨️ 빠른 명령어:**\n" +
      "/add [할일] - 할일 빠른 추가\n" +
      "/todo - 할일 메뉴 열기\n" +
      "/할일 - 할일 메뉴 열기\n\n" +
      "효율적인 할일 관리로 생산성을 높여보세요! 💪";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo_list" },
            { text: "➕ 할일 추가", callback_data: "todo_add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      },
    });
  }

  async addTodoQuick(bot, chatId, userId, todoText) {
    try {
      const validatedText = ValidationHelper.validateTodoText(todoText);
      const success = await this.todoService.addTodo(userId, validatedText);

      if (success) {
        await this.sendMessage(
          bot,
          chatId,
          `✅ **할일 추가 완료!**\n\n` +
            `📝 "${validatedText}" 이(가) 추가되었습니다.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📋 할일 목록", callback_data: "todo_list" },
                  { text: "📝 할일 메뉴", callback_data: "todo_menu" },
                ],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(bot, chatId, "❌ 할일 추가에 실패했습니다.");
      }

      return true;
    } catch (error) {
      Logger.error("빠른 할일 추가 오류:", error);
      await this.sendMessage(bot, chatId, `❌ ${error.message}`);
      return true;
    }
  }

  async confirmClearAllTodos(bot, chatId, messageId, userId) {
    try {
      const result = await this.todoService.clearAll(userId);

      if (result.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `🗑️ **전체 할일 삭제 완료**\n\n` +
            `${result.count}개의 할일을 모두 삭제했습니다!\n\n` +
            "새로운 시작을 위한 깨끗한 할일 목록이 준비되었어요! ✨",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "➕ 새 할일 추가", callback_data: "todo_add" },
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
    } catch (error) {
      Logger.error("전체 할일 삭제 확인 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 삭제 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        }
      );
    }
  }
  async handleTodoCommand(bot, msg) {
    const chatId = msg.chat.id;
    const userName = getUserName(msg.from);

    await this.sendMessage(
      bot,
      chatId,
      `📝 **${userName}님의 할일 관리**\n\n` +
        "효율적인 할일 관리로 생산성을 높여보세요! 💪\n\n" +
        "원하는 기능을 선택해주세요:",
      {
        parse_mode: "Markdown",
        reply_markup: {
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
      }
    );
  }
}

module.exports = TodoModule;
