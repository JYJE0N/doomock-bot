// src/modules/TodoModule.js - 리팩토링된 할일 모듈
const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

/**
 * 할일 관리 모듈
 * - 할일 추가/완료/삭제
 * - 할일 목록 조회
 * - 통계 및 리포트
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // 할일 서비스
    this.todoService = null;

    logger.info("📝 TodoModule 생성됨");
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    try {
      // TodoService 초기화
      const TodoService = require("../services/TodoService");
      this.todoService = new TodoService(this.db);
      await this.todoService.initialize();

      logger.info("✅ TodoModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      add: this.handleAdd,
      list: this.showList,
      complete: this.handleComplete,
      remove: this.handleDelete, // delete 대신 remove 사용
      stats: this.showStats,
      back: this.handleBack,
    });
  }

  /**
   * 메시지 처리 - BaseModule의 handleMessage를 오버라이드
   */
  async handleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);
    if (userState?.module === "todo") {
      return await this.handleUserState(bot, msg, userState);
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    switch (command) {
      case "todo":
      case "할일":
        await this.sendTodoMenu(bot, chatId);
        return true;

      default:
        return false;
    }
  }

  /**
   * 사용자 상태별 처리
   */
  async handleUserState(bot, msg, userState) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    switch (userState.action) {
      case "adding":
        await this.processTodoAdd(bot, chatId, userId, text);
        return true;

      case "completing":
        await this.processTodoComplete(bot, chatId, userId, text);
        return true;

      case "deleting":
        await this.processTodoDelete(bot, chatId, userId, text);
        return true;

      default:
        return false;
    }
  }

  // ===== 액션 핸들러 =====

  /**
   * 할일 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, text, options);

    const userName = getUserName(callbackQuery.from);
    const stats = await this.todoService.getUserStats(userId);

    const menuText = `📝 **할일 관리**

${userName}님의 할일 현황:
• 전체: ${stats.total}개
• 완료: ${stats.completed}개
• 진행중: ${stats.pending}개

무엇을 도와드릴까요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "➕ 할일 추가", callback_data: "todo:add" },
          { text: "📋 목록 보기", callback_data: "todo:list" },
        ],
        [
          { text: "✅ 완료하기", callback_data: "todo:complete" },
          { text: "🗑️ 삭제하기", callback_data: "todo:remove" }, // delete → remove
        ],
        [{ text: "📊 통계 보기", callback_data: "todo:stats" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      reply_markup: keyboard,
    });
  }

  /**
   * 할일 메뉴 전송 (명령어)
   */
  async sendTodoMenu(bot, chatId, userId) {
    const stats = await this.todoService.getUserStats(userId);

    const menuText = `📝 **할일 관리**

할일 현황:
• 전체: ${stats.total}개
• 완료: ${stats.completed}개
• 진행중: ${stats.pending}개

무엇을 도와드릴까요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "➕ 할일 추가", callback_data: "todo:add" },
          { text: "📋 목록 보기", callback_data: "todo:list" },
        ],
        [
          { text: "✅ 완료하기", callback_data: "todo:complete" },
          { text: "🗑️ 삭제하기", callback_data: "todo:remove" }, // delete → remove
        ],
        [{ text: "📊 통계 보기", callback_data: "todo:stats" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.sendMessage(bot, chatId, menuText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 할일 추가 처리
   */
  async handleAdd(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, text, options);

    // 사용자 상태 설정
    this.setUserState(userId, {
      module: "todo",
      action: "adding",
      messageId: messageId,
    });

    const text = `📝 **할일 추가**

추가할 할일을 입력해주세요.
(취소하려면 /cancel 입력)`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 할일 추가 처리 (실제)
   */
  async processTodoAdd(bot, chatId, userId, text) {
    try {
      // 할일 추가
      const todo = await this.todoService.addTodo(userId, text);

      // 상태 초기화
      this.clearUserState(userId);

      const successText = `✅ 할일이 추가되었습니다!

"${todo.text}"`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 더 추가하기", callback_data: "todo:add" },
            { text: "📋 목록 보기", callback_data: "todo:list" },
          ],
          [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 추가 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 할일 목록 표시
   */
  async showList(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, text, options);

    try {
      const todos = await this.todoService.getUserTodos(userId);

      if (todos.length === 0) {
        const emptyText = `📋 **할일 목록**

등록된 할일이 없습니다.
새로운 할일을 추가해보세요!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, text, {
          reply_markup: keyboard,
        });
        return;
      }

      // 할일 목록 생성
      const todoList = todos
        .map((todo, index) => {
          const status = todo.completed ? "✅" : "⏳";
          const text = todo.completed ? `~${todo.text}~` : todo.text;
          return `${index + 1}. ${status} ${text}`;
        })
        .join("\n");

      const listText = `📋 **할일 목록**

${todoList}

전체 ${todos.length}개 (완료: ${todos.filter((t) => t.completed).length}개)`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 완료하기", callback_data: "todo:complete" },
            { text: "🗑️ 삭제하기", callback_data: "todo:delete" },
          ],
          [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 목록 조회 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 완료 처리
   */
  async handleComplete(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, text, options);

    try {
      const todos = await this.todoService.getUserTodos(userId, false);

      if (todos.length === 0) {
        const emptyText = `✅ **할일 완료**

완료할 할일이 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, text, {
          reply_markup: keyboard,
        });
        return;
      }

      // 미완료 할일 목록
      const todoList = todos
        .map((todo, index) => `${index + 1}. ${todo.text}`)
        .join("\n");

      const text = `✅ **할일 완료**

완료할 할일의 번호를 입력해주세요:

${todoList}

(취소하려면 /cancel 입력)`;

      // 사용자 상태 설정
      this.setUserState(userId, {
        module: "todo",
        action: "completing",
        todos: todos,
        messageId: messageId,
      });

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 완료 처리 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 삭제 처리
   */
  async handleDelete(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, text, options);

    try {
      const todos = await this.todoService.getUserTodos(userId);

      if (todos.length === 0) {
        const emptyText = `🗑️ **할일 삭제**

삭제할 할일이 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, text, {
          reply_markup: keyboard,
        });
        return;
      }

      // 할일 목록 표시
      const todoList = todos
        .map((todo, index) => {
          const status = todo.completed ? "✅" : "⏳";
          return `${index + 1}. ${status} ${todo.text}`;
        })
        .join("\n");

      const text = `🗑️ **할일 삭제**

삭제할 할일의 번호를 입력해주세요:

${todoList}

(취소하려면 /cancel 입력)`;

      // 사용자 상태 설정
      this.setUserState(userId, {
        module: "todo",
        action: "deleting",
        todos: todos,
        messageId: messageId,
      });

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 삭제 처리 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 완료 처리 (실제)
   */
  async processTodoComplete(bot, chatId, userId, text) {
    try {
      const userState = this.getUserState(userId);
      const todos = userState.todos;
      const index = parseInt(text) - 1;

      if (isNaN(index) || index < 0 || index >= todos.length) {
        await this.sendMessage(bot, chatId, "❌ 올바른 번호를 입력해주세요.");
        return;
      }

      const todoToComplete = todos[index];
      const result = await this.todoService.toggleTodo(
        userId,
        todoToComplete._id
      );

      if (!result.success) {
        await this.sendMessage(bot, chatId, `❌ ${result.message}`);
        return;
      }

      // 상태 초기화
      this.clearUserState(userId);

      const successText = `✅ 할일을 완료했습니다!

"${todoToComplete.text}"`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 더 완료하기", callback_data: "todo:complete" },
            { text: "📋 목록 보기", callback_data: "todo:list" },
          ],
          [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 완료 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 완료 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 할일 삭제 처리 (실제)
   */
  async processTodoDelete(bot, chatId, userId, text) {
    try {
      const userState = this.getUserState(userId);
      const todos = userState.todos;
      const index = parseInt(text) - 1;

      if (isNaN(index) || index < 0 || index >= todos.length) {
        await this.sendMessage(bot, chatId, "❌ 올바른 번호를 입력해주세요.");
        return;
      }

      const todoToDelete = todos[index];
      const result = await this.todoService.deleteTodo(
        userId,
        todoToDelete._id
      );

      if (!result.success) {
        await this.sendMessage(bot, chatId, `❌ ${result.message}`);
        return;
      }

      // 상태 초기화
      this.clearUserState(userId);

      const successText = `✅ 할일이 삭제되었습니다!

"${todoToDelete.text}"`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🗑️ 더 삭제하기", callback_data: "todo:remove" },
            { text: "📋 목록 보기", callback_data: "todo:list" },
          ],
          [{ text: "📝 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 삭제 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 삭제 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 뒤로가기 처리
   */
  async handleBack(bot, callbackQuery, params, moduleManager) {
    await this.showMenu(bot, callbackQuery, params, moduleManager);
  }
}

module.exports = TodoModule;
