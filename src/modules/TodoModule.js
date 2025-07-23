// src/modules/TodoModule.js - 리팩토링된 할일 관리 모듈
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 할일 관리 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - TodoService를 통한 데이터 관리
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // TodoService 초기화
    this.todoService = null;

    // UI 상태 관리
    this.userStates = new Map();

    // 페이지네이션 설정
    this.pageSize = 10;

    logger.info("📝 TodoModule 생성됨");
  }

  /**
   * 모듈 초기화
   */
  async initialize() {
    try {
      this.todoService = new TodoService();
      this.todoService.db = this.db; // DB 연결 전달
      await this.todoService.initialize();

      logger.info("📝 TodoService 연결 성공");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      list: this.showTodoList,
      add: this.startAddTodo,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,
      search: this.startSearch,
      stats: this.showStats,
      clear: this.showClearMenu,
      "clear:completed": this.clearCompleted,
      "clear:all": this.clearAll,
      "clear:all:confirm": this.confirmClearAll,
      page: this.changePage,
    });
  }

  /**
   * 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.userStates.get(userId);

    // 할일 추가 대기 상태
    if (userState?.action === "waiting_todo_input") {
      await this.handleTodoInput(bot, chatId, userId, text);
      return true;
    }

    // 검색 대기 상태
    if (userState?.action === "waiting_search_input") {
      await this.handleSearchInput(bot, chatId, userId, text);
      return true;
    }

    // 명령어 처리
    const command = text.toLowerCase().trim();
    if (command === "/todo" || command === "할일") {
      await this.sendTodoMenu(bot, chatId);
      return true;
    }

    return false;
  }

  // ===== 메뉴 액션 =====

  /**
   * 할일 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    try {
      // 할일 통계 가져오기
      const stats = await this.todoService.getUserStats(from.id);

      const menuText = `📝 **할일 관리**

${userName}님의 할일 현황:
• 전체: ${stats.total}개
• 완료: ${stats.completed}개
• 진행중: ${stats.pending}개
• 완료율: ${stats.completionRate}%

무엇을 하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "🔍 검색", callback_data: "todo:search" },
            { text: "📊 통계", callback_data: "todo:stats" },
          ],
          [{ text: "🗑️ 삭제 관리", callback_data: "todo:clear" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 목록 표시
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 페이지 번호 파싱
      const page = params[0] ? parseInt(params[0]) : 1;

      // 할일 목록 가져오기
      const todos = await this.todoService.getUserTodos(userId);

      if (todos.length === 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "📝 **할일 목록**\n\n아직 등록된 할일이 없습니다.\n할일을 추가해보세요!",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
                [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 페이지네이션 계산
      const totalPages = Math.ceil(todos.length / this.pageSize);
      const startIdx = (page - 1) * this.pageSize;
      const endIdx = startIdx + this.pageSize;
      const pageTodos = todos.slice(startIdx, endIdx);

      // 할일 목록 텍스트 생성
      let listText = `📝 **할일 목록** (${page}/${totalPages})\n\n`;

      pageTodos.forEach((todo, idx) => {
        const num = startIdx + idx + 1;
        const status = todo.completed ? "✅" : "⬜";
        const date = this.formatDate(todo.createdAt, "MM/DD HH:mm");
        listText += `${num}. ${status} ${todo.text}\n   📅 ${date}\n\n`;
      });

      // 키보드 생성
      const keyboard = this.createTodoListKeyboard(
        pageTodos,
        startIdx,
        page,
        totalPages
      );

      await this.editMessage(bot, chatId, messageId, listText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 목록 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 추가 시작
   */
  async startAddTodo(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.userStates.set(userId, {
      action: "waiting_todo_input",
      messageId: callbackQuery.message.message_id,
    });

    const inputText = `📝 **할일 추가**

추가할 할일을 입력해주세요.
(취소하려면 /cancel 입력)`;

    await this.sendMessage(bot, chatId, inputText);
  }

  /**
   * 할일 토글
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;
    const todoId = params[0];

    if (!todoId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 할일 ID가 없습니다.",
        show_alert: true,
      });
      return;
    }

    try {
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.todo.completed ? "✅ 완료!" : "⬜ 완료 취소!",
          show_alert: false,
        });

        // 목록 새로고침
        await this.showTodoList(bot, callbackQuery, [], moduleManager);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 할일을 찾을 수 없습니다.",
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("할일 토글 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;
    const todoId = params[0];

    if (!todoId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 할일 ID가 없습니다.",
        show_alert: true,
      });
      return;
    }

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "🗑️ 삭제되었습니다.",
          show_alert: false,
        });

        // 목록 새로고침
        await this.showTodoList(bot, callbackQuery, [], moduleManager);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 할일을 찾을 수 없습니다.",
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("할일 삭제 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const stats = await this.todoService.getUserDetailedStats(from.id);

      const statsText = `📊 **할일 통계**

**전체 현황**
• 총 할일: ${stats.total}개
• 완료: ${stats.completed}개
• 진행중: ${stats.pending}개
• 완료율: ${stats.completionRate}%

**기간별 통계**
• 오늘 추가: ${stats.todayAdded}개
• 오늘 완료: ${stats.todayCompleted}개
• 이번주 완료: ${stats.weekCompleted}개
• 이번달 완료: ${stats.monthCompleted}개

**평균 완료 시간**
• ${stats.avgCompletionTime}

최근 업데이트: ${this.formatDate(new Date())}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 새로고침", callback_data: "todo:stats" }],
          [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("통계 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  // ===== 입력 처리 =====

  /**
   * 할일 입력 처리
   */
  async handleTodoInput(bot, chatId, userId, text) {
    // 상태 초기화
    const userState = this.userStates.get(userId);
    this.userStates.delete(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(bot, chatId, "✅ 할일 추가가 취소되었습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
          ],
        },
      });
      return;
    }

    try {
      // 할일 추가
      const todo = await this.todoService.addTodo(userId, text);

      const successText = `✅ **할일이 추가되었습니다!**

"${todo.text}"

총 ${await this.todoService.getUserTodoCount(userId)}개의 할일이 있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 추가하기", callback_data: "todo:add" },
            { text: "📋 목록보기", callback_data: "todo:list" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      // 이전 메시지 삭제 시도
      if (userState?.messageId) {
        try {
          await bot.deleteMessage(chatId, userState.messageId);
        } catch (e) {
          // 삭제 실패 무시
        }
      }

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 추가 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 할일 추가 중 오류가 발생했습니다.\n다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
            ],
          },
        }
      );
    }
  }

  // ===== 유틸리티 메서드 =====

  /**
   * 할일 목록 키보드 생성
   */
  createTodoListKeyboard(todos, startIdx, currentPage, totalPages) {
    const keyboard = [];

    // 할일 버튼들 (2열로 배치)
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];

      for (let j = 0; j < 2 && i + j < todos.length; j++) {
        const todo = todos[i + j];
        const num = startIdx + i + j + 1;
        const icon = todo.completed ? "✅" : "⬜";

        row.push({
          text: `${icon} ${num}`,
          callback_data: `todo:toggle:${todo._id}`,
        });
      }

      keyboard.push(row);
    }

    // 페이지네이션
    if (totalPages > 1) {
      const pageRow = [];

      if (currentPage > 1) {
        pageRow.push({
          text: "◀️ 이전",
          callback_data: `todo:page:${currentPage - 1}`,
        });
      }

      pageRow.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "todo:noop",
      });

      if (currentPage < totalPages) {
        pageRow.push({
          text: "다음 ▶️",
          callback_data: `todo:page:${currentPage + 1}`,
        });
      }

      keyboard.push(pageRow);
    }

    // 메뉴 버튼
    keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "🔙 메뉴", callback_data: "todo:menu" },
    ]);

    return { inline_keyboard: keyboard };
  }

  /**
   * 페이지 변경
   */
  async changePage(bot, callbackQuery, params, moduleManager) {
    const page = params[0] ? parseInt(params[0]) : 1;
    await this.showTodoList(bot, callbackQuery, [page], moduleManager);
  }

  /**
   * 명령어로 메뉴 전송
   */
  async sendTodoMenu(bot, chatId) {
    const menuText = "📝 할일 관리 메뉴입니다.";

    const keyboard = {
      inline_keyboard: [
        [{ text: "📝 할일 메뉴 열기", callback_data: "todo:menu" }],
      ],
    };

    await this.sendMessage(bot, chatId, menuText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 검색 시작
   */
  async startSearch(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    this.userStates.set(userId, {
      action: "waiting_search_input",
      messageId: callbackQuery.message.message_id,
    });

    await this.sendMessage(
      bot,
      chatId,
      "🔍 **할일 검색**\n\n검색할 키워드를 입력해주세요.\n(취소하려면 /cancel 입력)"
    );
  }

  /**
   * 삭제 메뉴
   */
  async showClearMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const clearText = `🗑️ **삭제 관리**

어떤 할일을 삭제하시겠습니까?`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ 완료된 할일 삭제",
            callback_data: "todo:clear:completed",
          },
        ],
        [{ text: "❌ 모든 할일 삭제", callback_data: "todo:clear:all" }],
        [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, clearText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 완료된 할일 삭제
   */
  async clearCompleted(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = await this.todoService.clearCompletedTodos(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ ${result.deletedCount}개의 완료된 할일이 삭제되었습니다.`,
        show_alert: true,
      });

      await this.showMenu(bot, callbackQuery, params, moduleManager);
    } catch (error) {
      logger.error("완료 할일 삭제 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }
}

module.exports = TodoModule;
