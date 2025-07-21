// src/modules/TodoModule.js 수정

const BaseModule = require("./BaseModule");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { getUserName } = require("../utils/UserHelper");
const { TimeHelper } = require("../utils/TimeHelper");
const { TodoService } = require("../services/TodoService"); // ✅ TodoService import 추가
const logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      commands: ["todo", "할일", "add"],
      callbacks: ["todo"],
      description: "📝 할일 관리",
    });

    this.bot = bot;
    this.todoService = new TodoService();
  }
  // Todo 전용 액션만 등록
  registerActions() {
    // BaseModule의 기본 액션은 이미 등록됨
    // Todo 전용 액션만 추가
    this.actionMap.set("list", this.showTodoList.bind(this));
    this.actionMap.set("add", this.startTodoAdd.bind(this));
    this.actionMap.set("search", this.startTodoSearch.bind(this));
    this.actionMap.set("stats", this.showTodoStats.bind(this));
    this.actionMap.set("clear_completed", this.clearCompletedTodos.bind(this));
    this.actionMap.set("clear_all", this.clearAllTodos.bind(this));
    this.actionMap.set("export", this.exportTodos.bind(this));
    this.actionMap.set("import", this.startTodoImport.bind(this));
  }

  // 커스텀 콜백 처리 (동적 액션)
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    if (subAction.startsWith("complete_")) {
      const todoId = subAction.substring(9);
      return await this.completeTodo(bot, callbackQuery, todoId);
    }

    if (subAction.startsWith("delete_")) {
      const todoId = subAction.substring(7);
      return await this.deleteTodo(bot, callbackQuery, todoId);
    }

    if (subAction.startsWith("page_")) {
      const page = parseInt(subAction.substring(5));
      return await this.showTodoPage(bot, callbackQuery, page);
    }

    return false;
  }
  // 모듈 초기화
  async onInitialize() {
    try {
      // ✅ TodoService 초기화
      await this.todoService.initialize();

      logger.success("📝 TodoModule 초기화 완료");
    } catch (error) {
      logger.error("TodoModule 초기화 실패:", error);
    }
  }

  // ✅ 할일 입력 처리 수정 - TodoService 사용
  async _processTodoInput(bot, chatId, userId, text, userName) {
    try {
      if (text.length > 200) {
        throw new Error("할일 내용이 너무 깁니다. (최대 200자)");
      }

      // ✅ TodoService를 통해 할일 추가
      const result = await this.todoService.addTodo(userId, text);

      if (!result.success) {
        await bot.sendMessage(chatId, `❌ ${result.error}`, {
          parse_mode: "Markdown",
        });
        return true;
      }

      this.clearUserState(userId);

      const successMessage = `✅ **할일이 추가되었습니다!**\n\n📝 "${result.task}"\n\n현재 총 ${result.totalCount}개의 할일이 있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "➕ 더 추가하기", callback_data: "todo_add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await bot.sendMessage(chatId, successMessage, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("할일 추가 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 할일 추가 중 오류가 발생했습니다.", {
        parse_mode: "Markdown",
      });
      return true;
    }
  }

  // ✅ 할일 목록 가져오기 - TodoService 사용
  async _getTodos(userId) {
    try {
      return await this.todoService.getTodos(userId);
    } catch (error) {
      logger.error("할일 목록 조회 오류:", error);
      return [];
    }
  }

  // ✅ 할일 완료 처리 - TodoService 사용
  async _completeTodoById(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.toggleTodo(
        userId,
        parseInt(todoIndex)
      );

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.error,
          show_alert: true,
        });
        return false;
      }

      // 목록 다시 표시
      await this.showTodoList(
        bot,
        chatId,
        messageId,
        userId,
        getUserName({ id: userId })
      );
      return true;
    } catch (error) {
      logger.error("할일 완료 처리 오류:", error);
      return false;
    }
  }

  // ✅ 할일 삭제 - TodoService 사용
  async _deleteTodoById(bot, chatId, messageId, userId, todoIndex) {
    try {
      const result = await this.todoService.deleteTodo(
        userId,
        parseInt(todoIndex)
      );

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.error,
          show_alert: true,
        });
        return false;
      }

      // 목록 다시 표시
      await this.showTodoList(
        bot,
        chatId,
        messageId,
        userId,
        getUserName({ id: userId })
      );
      return true;
    } catch (error) {
      logger.error("할일 삭제 처리 오류:", error);
      return false;
    }
  }

  // ✅ 할일 통계 - TodoService 사용
  async showTodoStats(bot, chatId, messageId, userId, userName) {
    try {
      const stats = await this.todoService.getTodoStats(userId);

      if (!stats) {
        await this._sendErrorMessage(bot, chatId, "통계를 불러올 수 없습니다.");
        return;
      }

      const statsText = `📊 **${userName}님의 할일 통계**

📝 **전체 할일:** ${stats.total}개
✅ **완료된 할일:** ${stats.completed}개
📌 **진행중인 할일:** ${stats.pending}개
📈 **완료율:** ${stats.completionRate}%

${this._getProgressBar(stats.completionRate)}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo_list" },
            { text: "➕ 할일 추가", callback_data: "todo_add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      };

      return await this._editOrSendMessage(
        bot,
        chatId,
        messageId,
        statsText,
        keyboard
      );
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      await this._sendErrorMessage(bot, chatId, "통계를 불러올 수 없습니다.");
    }
  }

  // ✅ 완료된 할일 정리 - TodoService 사용
  async clearCompletedTodos(bot, chatId, messageId, userId, userName) {
    try {
      const result = await this.todoService.clearCompleted(userId);

      if (!result.success) {
        await this._sendErrorMessage(bot, chatId, result.error);
        return;
      }

      if (result.count === 0) {
        const message = `📝 **완료된 할일이 없습니다.**\n\n정리할 할일이 없어요!`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 할일 목록", callback_data: "todo_list" }],
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        };
        return await this._editOrSendMessage(
          bot,
          chatId,
          messageId,
          message,
          keyboard
        );
      }

      const successMessage = `✅ **정리 완료!**\n\n${result.count}개의 완료된 할일을 정리했습니다.\n현재 ${result.remainingCount}개의 할일이 남아있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo_list" },
            { text: "📊 통계 보기", callback_data: "todo_stats" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      };

      return await this._editOrSendMessage(
        bot,
        chatId,
        messageId,
        successMessage,
        keyboard
      );
    } catch (error) {
      logger.error("완료된 할일 정리 실패:", error);
      await this._sendErrorMessage(bot, chatId, "할일 정리에 실패했습니다.");
    }
  }

  // ✅ 할일 검색 - TodoService 사용
  async _processSearchInput(bot, chatId, userId, text, userName) {
    try {
      const result = await this.todoService.searchTodos(userId, text);

      if (!result.success) {
        await bot.sendMessage(chatId, `❌ ${result.error}`, {
          parse_mode: "Markdown",
        });
        return true;
      }

      this.clearUserState(userId);

      if (result.count === 0) {
        const noResultMessage = `🔍 **검색 결과가 없습니다.**\n\n"${result.keyword}"와 일치하는 할일을 찾을 수 없어요.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "🔍 다시 검색", callback_data: "todo_search" },
              { text: "📋 전체 목록", callback_data: "todo_list" },
            ],
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        };

        await bot.sendMessage(chatId, noResultMessage, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
        return true;
      }

      let resultText = `🔍 **검색 결과** (${result.count}개)\n\n"${result.keyword}"를 포함한 할일:\n\n`;

      result.results.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const date = TimeHelper.formatDateTime(todo.createdAt);
        resultText += `${status} **${index + 1}.** ${todo.task}\n📅 ${date}\n\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔍 다시 검색", callback_data: "todo_search" },
            { text: "📋 전체 목록", callback_data: "todo_list" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await bot.sendMessage(chatId, resultText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("검색 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 검색 중 오류가 발생했습니다.", {
        parse_mode: "Markdown",
      });
      return true;
    }
  }
}

module.exports = TodoModule;
