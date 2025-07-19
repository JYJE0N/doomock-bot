// src/modules/TodoModule.js - 콜백 처리 안정화

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

    // ⭐ 중복 처리 방지
    this.processingUsers = new Set();
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

  // ⭐ 표준화된 콜백 처리 - 중복 방지 로직 추가
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    // 중복 처리 방지
    const userKey = `${userId}_${subAction}`;
    if (this.processingUsers.has(userKey)) {
      Logger.warn(`중복 할일 처리 무시: ${userKey}`);
      return false;
    }

    this.processingUsers.add(userKey);

    try {
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
          Logger.warn(`알 수 없는 할일 콜백: ${subAction}`);
          await this.showTodoMenu(bot, chatId, messageId, userName);
          break;
      }

      return true;
    } catch (error) {
      Logger.error(`할일 콜백 처리 오류 (${subAction}):`, error);

      // 에러 발생시 안전한 복구
      try {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ 처리 중 오류가 발생했습니다.\n\n할일 메뉴로 돌아갑니다.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
              ],
            },
          }
        );
      } catch (recoveryError) {
        Logger.error("할일 에러 복구 실패:", recoveryError);
      }

      return false;
    } finally {
      // 처리 완료 후 플래그 해제
      setTimeout(() => {
        this.processingUsers.delete(userKey);
      }, 2000);
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

      const completedCount = todos.filter((todo) => todo.completed).length;
      const totalCount = todos.length;
      const progressPercent = Math.round((completedCount / totalCount) * 100);

      let listText =
        `📝 **할일 목록** (${completedCount}/${totalCount})\n\n` +
        `📊 진행률: ${progressPercent}% ${"▓".repeat(
          Math.floor(progressPercent / 10)
        )}${"░".repeat(10 - Math.floor(progressPercent / 10))}\n\n`;

      const buttons = this.createTodoButtons(todos);

      await this.editMessage(bot, chatId, messageId, listText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
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
      const statusIcon = todo.completed ? "✅" : "☐";
      const taskText =
        todo.task.length > 25 ? todo.task.substring(0, 25) + "..." : todo.task;

      buttons.push([
        {
          text: `${statusIcon} ${taskText}`,
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
        "💡 **예시:** 회의 자료 준비, 점심 약속 등\n\n" +
        "⚠️ **주의:** 100자 이내로 입력해주세요.",
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

      const result = await this.todoService.addTodo(userId, text);

      if (result.success) {
        this.userStates.delete(userId);

        await this.sendMessage(
          bot,
          chatId,
          `✅ **할일 추가 완료!**\n\n` +
            `📝 "${result.task}" 이(가) 추가되었습니다.\n\n` +
            `📊 총 할일: ${result.totalCount}개\n` +
            `💾 저장: ${result.saved ? "DB 저장됨" : "메모리만"}\n\n` +
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
          `❌ **할일 추가 실패**\n\n${result.error}\n\n다시 시도해주세요.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔄 다시 시도", callback_data: "todo_add" },
                  { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
                ],
              ],
            },
          }
        );
      }

      return true;
    } catch (error) {
      Logger.error("할일 추가 처리 오류:", error);
      this.userStates.delete(userId);

      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 추가 중 오류가 발생했습니다.\n\n다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
            ],
          },
        }
      );
      return true;
    }
  }

  async toggleTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.toggleTodo(userId, todoIndex);

      if (result.success) {
        const statusText = result.completed ? "완료 처리" : "미완료로 변경";

        // 할일 목록을 다시 표시
        await this.showTodoList(bot, chatId, messageId, userId);

        // 상태 변경 알림 (임시 메시지)
        const notificationMsg = await this.sendMessage(
          bot,
          chatId,
          `${result.completed ? "✅" : "☐"} **${statusText}**\n\n"${
            result.task
          }"`,
          { parse_mode: "Markdown" }
        );

        // 3초 후 알림 메시지 삭제
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, notificationMsg.message_id);
          } catch (error) {
            Logger.debug("알림 메시지 삭제 실패 (무시)");
          }
        }, 3000);
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      Logger.error("할일 상태 변경 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  async deleteTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.deleteTodo(userId, todoIndex);

      if (result.success) {
        // 할일 목록을 다시 표시
        await this.showTodoList(bot, chatId, messageId, userId);

        // 삭제 알림 (임시 메시지)
        const notificationMsg = await this.sendMessage(
          bot,
          chatId,
          `🗑️ **할일 삭제 완료**\n\n"${result.task}" 이(가) 삭제되었습니다.`,
          { parse_mode: "Markdown" }
        );

        // 3초 후 알림 메시지 삭제
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, notificationMsg.message_id);
          } catch (error) {
            Logger.debug("알림 메시지 삭제 실패 (무시)");
          }
        }, 3000);
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  // 나머지 메서드들 (통계, 도움말, 삭제 등)은 기존과 동일...
  async showTodoStats(bot, chatId, messageId, userId) {
    try {
      const stats = await this.todoService.getStats(userId);

      const statsText =
        "📊 **할일 통계**\n\n" +
        `📝 전체 할일: ${stats.total}개\n` +
        `✅ 완료: ${stats.completed}개\n` +
        `☐ 미완료: ${stats.pending}개\n` +
        `📈 완료율: ${stats.completionRate}%\n\n` +
        `📅 오늘 추가: ${stats.todayAdded}개\n` +
        `✨ 오늘 완료: ${stats.todayCompleted}개`;

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
    } catch (error) {
      Logger.error("할일 통계 표시 오류:", error);
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

  async clearCompletedTodos(bot, chatId, messageId, userId) {
    try {
      const result = await this.todoService.clearCompleted(userId);

      if (result.success) {
        const resultText =
          result.count > 0
            ? `🗑️ **완료된 할일 삭제**\n\n${result.count}개의 완료된 할일을 삭제했습니다! ✨`
            : "📝 **완료된 할일 없음**\n\n삭제할 완료된 할일이 없습니다.";

        await this.editMessage(bot, chatId, messageId, resultText, {
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
      "**💡 팁:**\n" +
      "• 할일은 100자 이내로 작성\n" +
      "• 중복된 할일은 추가되지 않음\n" +
      "• 완료된 할일은 정기적으로 정리\n\n" +
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
      const result = await this.todoService.addTodo(userId, todoText);

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `✅ **할일 추가 완료!**\n\n` +
            `📝 "${result.task}" 이(가) 추가되었습니다.\n\n` +
            `📊 총 할일: ${result.totalCount}개`,
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
        await this.sendMessage(
          bot,
          chatId,
          `❌ **할일 추가 실패**\n\n${result.error}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📝 할일 메뉴", callback_data: "todo_menu" }],
              ],
            },
          }
        );
      }

      return true;
    } catch (error) {
      Logger.error("빠른 할일 추가 오류:", error);
      await this.sendMessage(bot, chatId, `❌ ${error.message}`);
      return true;
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
