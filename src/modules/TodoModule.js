// src/modules/TodoModule.js - 완전 표준화 적용

const BaseModule = require("./BaseModule");
const { TodoService } = require("../services/TodoService");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { getUserName } = require("../utils/UserHelper");
const Logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule", {
      commands: ["todo", "할일", "add"],
      callbacks: ["todo"],
      description: "할일 관리 및 생산성 도구",
      features: ["할일 추가", "완료 처리", "통계", "삭제"],
    });

    this.todoService = new TodoService();
  }

  // ⭐ 표준 초기화
  async onInitialize() {
    // TodoService 초기화 등
    Logger.info(`${this.name}: TodoService 초기화 완료`);
  }

  // ⭐ 표준 메시지 처리
  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    this.updateStats("command");

    // 사용자 상태 확인
    const userState = this.userStates.get(userId);
    if (userState && userState.action === "waiting_todo_input") {
      return await this.handleTodoInput(bot, chatId, userId, text);
    }

    // 명령어 처리
    if (text && (text.startsWith("/todo") || text.startsWith("/할일"))) {
      await this.showMenu(bot, chatId, null, userId, msg.from.first_name);
      return true;
    }

    // 빠른 할일 추가
    if (text && text.startsWith("/add ")) {
      const todoText = text.slice(5).trim();
      if (todoText) {
        return await this.addTodoQuick(bot, chatId, userId, todoText);
      }
    }

    return false;
  }

  // ⭐ 표준화된 콜백 처리 (매개변수 통일)
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    switch (subAction) {
      case "list":
        await this.showTodoList(bot, chatId, messageId, userId);
        return true;
      case "add":
        await this.startTodoAdd(bot, chatId, messageId, userId);
        return true;
      case "stats":
        await this.showTodoStats(bot, chatId, messageId, userId);
        return true;
      case "clear_completed":
        await this.clearCompletedTodos(bot, chatId, messageId, userId);
        return true;
      case "clear_all":
        await this.clearAllTodos(bot, chatId, messageId, userId);
        return true;
      case "clear_all_confirm":
        await this.confirmClearAllTodos(bot, chatId, messageId, userId);
        return true;
      default:
        return false;
    }
  }

  // ⭐ 동적 콜백 처리 (표준 매개변수)
  async handleDynamicCallback(
    bot,
    callbackQuery,
    subAction,
    params,
    menuManager
  ) {
    if (!subAction.includes("_")) return false;

    const parts = subAction.split("_");
    if (parts.length !== 2) return false;

    const [action, indexStr] = parts;
    const index = parseInt(indexStr);

    if (isNaN(index)) return false;

    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    if (action === "toggle") {
      await this.toggleTodo(bot, chatId, messageId, userId, index);
      return true;
    } else if (action === "delete") {
      await this.deleteTodo(bot, chatId, messageId, userId, index);
      return true;
    }

    return false;
  }

  // ⭐ 표준화된 메뉴 표시 (매개변수 통일)
  async showMenu(bot, chatId, messageId, userId, userName, menuManager = null) {
    const menuText =
      `📝 **${userName}님의 할일 관리**\n\n` +
      "효율적인 할일 관리로 생산성을 높여보세요! 💪\n\n" +
      "원하는 기능을 선택해주세요:";

    const options = {
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
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, options);
    } else {
      await this.sendMessage(bot, chatId, menuText, options);
    }
  }

  // ⭐ 할일 목록 표시
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
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 목록을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  // ⭐ 할일 추가 시작
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

  // ⭐ 할일 입력 처리
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
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // ⭐ 할일 토글
  async toggleTodo(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.toggleTodo(userId, todoIndex);

      if (result.success) {
        // 할일 목록을 다시 표시
        await this.showTodoList(bot, chatId, messageId, userId);

        // 상태 변경 알림 (임시 메시지)
        const notificationMsg = await this.sendMessage(
          bot,
          chatId,
          `${result.completed ? "✅" : "☐"} **${
            result.completed ? "완료 처리" : "미완료로 변경"
          }**\n\n"${result.task}"`,
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
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      Logger.error("할일 상태 변경 오류:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 상태 변경 중 오류가 발생했습니다."
      );
    }
  }

  // ⭐ 할일 삭제
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
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      Logger.error("할일 삭제 오류:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 삭제 중 오류가 발생했습니다."
      );
    }
  }

  // ⭐ 할일 버튼 생성
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

  // ⭐ 기타 메서드들 (통계, 삭제 등)
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
      await this.sendErrorMessage(
        bot,
        chatId,
        "통계를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  // ⭐ 빠른 할일 추가
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
        await this.sendErrorMessage(bot, chatId, result.error);
      }

      return true;
    } catch (error) {
      Logger.error("빠른 할일 추가 오류:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // ⭐ 완료된 할일 삭제
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
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      Logger.error("완료된 할일 삭제 오류:", error);
      await this.sendErrorMessage(bot, chatId, "삭제 중 오류가 발생했습니다.");
    }
  }

  // ⭐ 전체 할일 삭제 확인
  async clearAllTodos(bot, chatId, messageId, userId) {
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

  // ⭐ 전체 할일 삭제 실행
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
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      Logger.error("전체 할일 삭제 확인 오류:", error);
      await this.sendErrorMessage(bot, chatId, "삭제 중 오류가 발생했습니다.");
    }
  }
}

module.exports = TodoModule;
