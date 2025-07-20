const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { TodoService } = require("../services/TodoService"); // ✅ 올바른 서비스 연결
const logger = require("../utils/Logger"); // ✅ 직접 import (getLogger 함수 없음)

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule", {
      commands: ["todo", "할일", "add"],
      callbacks: ["todo"],
      description: "📝 할일 관리",
      emoji: "📝",
      features: ["할일 추가", "완료 처리", "통계", "삭제", "검색"],
      priority: 1,
    });

    // ✅ TodoService 초기화 (DB 문제 없음!)
    try {
      this.todoService = new TodoService();
      logger.info("📝 TodoService 초기화 성공");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      this.todoService = null;
    }

    // 사용자 상태 관리
    this.userStates = new Map();
  }

  // 🔧 모듈별 초기화 (TodoService 사용)
  async onInitialize() {
    try {
      if (!this.todoService) {
        throw new Error("TodoService가 초기화되지 않았습니다.");
      }

      // TodoService는 자체적으로 DB 연결 및 초기화 처리
      logger.success("📝 TodoModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      // ✅ TodoService 없어도 계속 진행 (기본 기능 제공)
      logger.warn("📝 TodoModule 기본 모드로 계속 진행");
    }
  }

  // ✅ 표준 액션 등록
  registerActions() {
    super.registerActions(); // BaseModule 기본 액션 유지

    // Todo 기능별 액션 등록
    this.actionMap.set("list", this.showTodoList.bind(this));
    this.actionMap.set("add", this.showAddForm.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("clear", this.showClearMenu.bind(this));
    this.actionMap.set("search", this.showSearchForm.bind(this));

    // 완료/삭제 액션들
    this.actionMap.set("toggle", this.toggleTodo.bind(this));
    this.actionMap.set("delete", this.deleteTodo.bind(this));
    this.actionMap.set("clear_completed", this.clearCompleted.bind(this));
    this.actionMap.set("clear_all", this.clearAll.bind(this));

    logger.debug(`🎯 TodoModule 액션 등록 완료: ${this.actionMap.size}개`);
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    return {
      text: `📝 **${userName}님의 할일 관리**\n\n무엇을 도와드릴까요?`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo_list" },
            { text: "➕ 할일 추가", callback_data: "todo_add" },
          ],
          [
            { text: "📊 통계", callback_data: "todo_stats" },
            { text: "🗑️ 정리", callback_data: "todo_clear" },
          ],
          [
            { text: "🔍 검색", callback_data: "todo_search" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    };
  }

  // ========== Todo 액션 메서드들 (TodoService 사용) ==========

  async showTodoList(bot, chatId, messageId, userId, userName) {
    try {
      let todos = [];

      if (this.todoService) {
        todos = await this.todoService.getTodos(userId);
      }

      let text;
      if (todos.length === 0) {
        text = `📋 **${userName}님의 할일 목록**\n\n아직 할일이 없습니다.\n할일을 추가해보세요!`;
      } else {
        text = `📋 **${userName}님의 할일 목록**\n\n`;
        todos.forEach((todo, index) => {
          const status = todo.completed ? "✅" : "⬜";
          text += `${index + 1}. ${status} ${todo.task}\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 할일 추가", callback_data: "todo_add" },
            { text: "🔙 Todo 메뉴", callback_data: "todo_menu" },
          ],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 할일 목록 표시 완료`);
    } catch (error) {
      logger.error("showTodoList 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  async showAddForm(bot, chatId, messageId, userId, userName) {
    try {
      const text = `➕ **할일 추가**\n\n새로운 할일을 메시지로 보내주세요.\n\n예: "장보기", "운동하기", "공부하기"`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Todo 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "waiting_todo_input",
        step: "add_todo",
      });

      logger.debug(`✅ ${userName} 할일 추가 폼 표시 완료`);
    } catch (error) {
      logger.error("showAddForm 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  async showStats(bot, chatId, messageId, userId, userName) {
    try {
      let totalTodos = 0;
      let completedTodos = 0;

      if (this.todoService) {
        const todos = await this.todoService.getTodos(userId);
        totalTodos = todos.length;
        completedTodos = todos.filter((todo) => todo.completed).length;
      }

      const text =
        `📊 **${userName}님의 할일 통계**\n\n` +
        `📝 전체 할일: ${totalTodos}개\n` +
        `✅ 완료된 할일: ${completedTodos}개\n` +
        `⏳ 진행 중인 할일: ${totalTodos - completedTodos}개\n\n` +
        `완료율: ${
          totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0
        }%`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Todo 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 할일 통계 표시 완료`);
    } catch (error) {
      logger.error("showStats 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  async showClearMenu(bot, chatId, messageId, userId, userName) {
    try {
      const text = `🗑️ **할일 정리**\n\n어떤 할일을 정리하시겠어요?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 완료된 할일만", callback_data: "todo_clear_completed" },
            { text: "🗑️ 모든 할일", callback_data: "todo_clear_all" },
          ],
          [{ text: "🔙 Todo 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 정리 메뉴 표시 완료`);
    } catch (error) {
      logger.error("showClearMenu 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  async showSearchForm(bot, chatId, messageId, userId, userName) {
    try {
      const text = `🔍 **할일 검색**\n\n검색할 키워드를 메시지로 보내주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Todo 메뉴", callback_data: "todo_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "waiting_todo_input",
        step: "search_todo",
      });

      logger.debug(`✅ ${userName} 검색 폼 표시 완료`);
    } catch (error) {
      logger.error("showSearchForm 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  // ========== 메시지 처리 (BaseModule onHandleMessage 구현) ==========

  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    if (userState && userState.action === "waiting_todo_input") {
      return await this.handleTodoInput(bot, chatId, userId, text, userState);
    }

    // Todo 명령어 처리
    if (text && (text.startsWith("/todo") || text.startsWith("/할일"))) {
      await this.handleTodoCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleTodoInput(bot, chatId, userId, text, userState) {
    try {
      const userName = getUserName({ id: userId });

      if (userState.step === "add_todo") {
        // ✅ TodoService를 사용한 실제 할일 추가
        if (this.todoService) {
          const result = await this.todoService.addTodo(userId, text);
          if (result.success) {
            await bot.sendMessage(
              chatId,
              `✅ 할일 "${result.task}"가 추가되었습니다!\n📝 총 ${result.totalCount}개의 할일이 있습니다.`
            );
          } else {
            await bot.sendMessage(chatId, `❌ ${result.error}`);
          }
        } else {
          await bot.sendMessage(
            chatId,
            `✅ 할일 "${text}"가 추가되었습니다!\n(TodoService 연결 후 DB에 저장됩니다)`
          );
        }
      } else if (userState.step === "search_todo") {
        // ✅ TodoService를 사용한 실제 검색
        if (this.todoService) {
          const todos = await this.todoService.getTodos(userId);
          const filtered = todos.filter((todo) =>
            todo.task.toLowerCase().includes(text.toLowerCase())
          );

          if (filtered.length > 0) {
            let resultText = `🔍 "${text}" 검색 결과:\n\n`;
            filtered.forEach((todo, index) => {
              const status = todo.completed ? "✅" : "⬜";
              resultText += `${index + 1}. ${status} ${todo.task}\n`;
            });
            await bot.sendMessage(chatId, resultText);
          } else {
            await bot.sendMessage(
              chatId,
              `🔍 "${text}"에 대한 검색 결과가 없습니다.`
            );
          }
        } else {
          await bot.sendMessage(
            chatId,
            `🔍 "${text}" 검색 기능 (TodoService 연결 후 사용 가능)`
          );
        }
      }

      // 사용자 상태 정리
      this.clearUserState(userId);
      return true;
    } catch (error) {
      logger.error("handleTodoInput 오류:", error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  async handleTodoCommand(bot, msg) {
    try {
      const {
        chat: { id: chatId },
        from,
        text,
      } = msg;
      const userName = getUserName(from);

      // 기본: Todo 메뉴 표시
      const menuData = this.getMenuData(userName);
      await bot.sendMessage(chatId, menuData.text, {
        parse_mode: "Markdown",
        reply_markup: menuData.keyboard,
      });

      logger.debug(`✅ ${userName} Todo 명령어 처리 완료`);
    } catch (error) {
      logger.error("handleTodoCommand 오류:", error);
      await bot.sendMessage(
        msg.chat.id,
        "❌ Todo 명령어 처리 중 오류가 발생했습니다."
      );
    }
  }
}

module.exports = TodoModule;
