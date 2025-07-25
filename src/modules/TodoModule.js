// src/modules/TodoModule.js - 리팩토링 완성버전
const BaseModule = require("./BaseModule");
const TodoService = require("../services/TodoService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 할일 관리 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - TodoService를 통한 데이터 관리
 * - 표준 매개변수 체계 완벽 준수
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

    // 페이지네이션 설정
    this.pageSize = 10;

    logger.info("📝 TodoModule 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
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
   * 🎯 액션 등록 (표준 setupActions 패턴)
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
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

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
    const command = this.extractCommand(text);
    if (command === "todo" || text.trim() === "할일") {
      await this.sendTodoMenu(bot, chatId);
      return true;
    }

    return false;
  }

  // ===== 📋 메뉴 액션들 (표준 매개변수 준수) =====

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
      // 페이지 처리
      const page = parseInt(params[0]) || 1;
      const result = await this.todoService.getUserTodos(
        userId,
        page,
        this.pageSize
      );

      if (!result.success) {
        throw new Error(result.error || "할일 목록을 가져올 수 없습니다");
      }

      const { todos, total, totalPages } = result;

      if (todos.length === 0) {
        const emptyText = `📝 **할일 목록**

아직 등록된 할일이 없습니다.
새로운 할일을 추가해보세요! 💪`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, emptyText, {
          reply_markup: keyboard,
        });
        return;
      }

      // ✅ 개선된 목록 표시
      let listText = `📝 **할일 목록** (${todos.filter((t) => !t.completed).length}/${total})\n\n`;

      const startIdx = (page - 1) * this.pageSize;
      todos.forEach((todo, idx) => {
        const num = startIdx + idx + 1;
        const status = todo.completed ? "✅" : "⬜";
        const date = TimeHelper.formatDate(todo.createdAt);

        // 완료된 항목은 취소선 추가
        const todoText = todo.completed ? `~${todo.text}~` : todo.text;

        listText += `${num}. ${status} **${todoText}**\n`;
        listText += `    📅 ${date}\n\n`;
      });

      // ✅ 개선된 키보드 레이아웃
      const keyboard = { inline_keyboard: [] };

      // 할일 토글/삭제 버튼 (2열로 정리)
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        const idx = startIdx + i + 1;

        keyboard.inline_keyboard.push([
          {
            text: `${todo.completed ? "✅" : "⬜"} ${idx}`,
            callback_data: `todo:toggle:${todo._id}`,
          },
          {
            text: "🗑️",
            callback_data: `todo:delete:${todo._id}`,
          },
        ]);
      }

      // 페이지네이션 (필요한 경우만)
      if (totalPages > 1) {
        const pageRow = [];

        // 이전 페이지
        pageRow.push({
          text: page > 1 ? "◀️" : "　",
          callback_data: page > 1 ? `todo:page:${page - 1}` : "noop",
        });

        // 페이지 정보
        pageRow.push({
          text: `${page}/${totalPages}`,
          callback_data: "noop",
        });

        // 다음 페이지
        pageRow.push({
          text: page < totalPages ? "▶️" : "　",
          callback_data: page < totalPages ? `todo:page:${page + 1}` : "noop",
        });

        keyboard.inline_keyboard.push(pageRow);
      }

      // 하단 메뉴 (3개씩 배치)
      keyboard.inline_keyboard.push([
        { text: "➕ 추가", callback_data: "todo:add" },
        { text: "📊 통계", callback_data: "todo:stats" },
        { text: "🔙 뒤로", callback_data: "todo:menu" },
      ]);

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
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 할일 개수 제한 확인
      const todoCount = await this.todoService.getUserTodoCount(userId);
      const maxTodos = parseInt(process.env.MAX_TODOS_PER_USER) || 50;

      if (todoCount >= maxTodos) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **할일 추가 불가**\n\n최대 ${maxTodos}개까지만 등록 가능합니다.\n완료된 할일을 정리해보세요.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🗑️ 완료 할일 삭제",
                    callback_data: "todo:clear:completed",
                  },
                ],
                [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 사용자 상태 설정
      this.setUserState(userId, { action: "waiting_todo_input" });

      const inputText = `➕ **할일 추가**

새로운 할일을 입력해주세요.

💡 **팁:**
• 구체적으로 작성하면 더 효과적입니다
• 취소하려면 "/cancel" 또는 "취소"를 입력하세요

현재 할일: ${todoCount}/${maxTodos}개`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await this.editMessage(bot, chatId, messageId, inputText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 추가 시작 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;
    const todoId = params[0];

    if (!todoId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 잘못된 요청입니다.",
        show_alert: true,
      });
      return;
    }

    try {
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (result.success) {
        const status = result.todo.completed ? "완료" : "미완료";
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `✅ ${status}로 변경되었습니다.`,
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
        text: "❌ 잘못된 요청입니다.",
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
  // 진행률 바 생성 헬퍼
  createProgressBar(percentage) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return "▓".repeat(filled) + "░".repeat(empty);
  }

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

      // 진행률 바 생성
      const progressBar = this.createProgressBar(stats.stats.completionRate);

      const statsText = `📊 **할일 통계**

${progressBar} ${stats.stats.completionRate}%

📋 **전체 현황**
├ 총 할일: **${stats.stats.total}**개
├ 완료: **${stats.stats.completed}**개
└ 진행중: **${stats.stats.active}**개

📅 **오늘 활동**
├ 추가: **${stats.stats.todayAdded || 0}**개
└ 완료: **${stats.stats.todayCompleted || 0}**개

⏱️ **이번주 성과**
└ 완료: **${stats.stats.weekCompleted || 0}**개

_최근 업데이트: ${TimeHelper.formatDateTime()}_`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "todo:stats" },
            { text: "🗑️ 정리하기", callback_data: "todo:clear" },
          ],
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

  // ===== 🎯 입력 처리 메서드들 =====

  /**
   * 할일 입력 처리
   */
  async handleTodoInput(bot, chatId, userId, text) {
    // 상태 초기화
    this.clearUserState(userId);

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

      // ✅ TimeHelper를 직접 사용하도록 수정
      const successText = `✅ **할일이 추가되었습니다!**

📝 **${todo.text}**

📅 등록일: ${TimeHelper.formatDateTime(todo.createdAt)}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 더 추가", callback_data: "todo:add" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 입력 처리 오류:", error);

      let errorMessage = "❌ 할일 추가 중 오류가 발생했습니다.";
      if (error.message.includes("최대")) {
        errorMessage = `❌ ${error.message}`;
      }

      // ✅ sendError 대신 sendMessage 사용
      await this.sendMessage(bot, chatId, errorMessage);
    }
  }

  /**
   * 검색 입력 처리
   */
  async handleSearchInput(bot, chatId, userId, text) {
    // 상태 초기화
    this.clearUserState(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(bot, chatId, "✅ 검색이 취소되었습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
          ],
        },
      });
      return;
    }

    try {
      // 할일 검색
      const todos = await this.todoService.searchTodos(userId, text);

      if (todos.length === 0) {
        await this.sendMessage(
          bot,
          chatId,
          `🔍 **검색 결과**\n\n"${text}"에 대한 검색 결과가 없습니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔍 다시 검색", callback_data: "todo:search" }],
                [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 검색 결과 표시
      let resultText = `🔍 **검색 결과** (${todos.length}개)\n\n`;

      todos.slice(0, 10).forEach((todo, idx) => {
        const status = todo.completed ? "✅" : "⬜";
        const date = this.formatDate(todo.createdAt);
        resultText += `${idx + 1}. ${status} ${todo.text}\n`;
        resultText += `   📅 ${date}\n\n`;
      });

      if (todos.length > 10) {
        resultText += `... 그리고 ${todos.length - 10}개 더`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔍 다시 검색", callback_data: "todo:search" }],
          [{ text: "📋 전체 목록", callback_data: "todo:list" }],
          [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, resultText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("검색 처리 오류:", error);
      await this.sendError(bot, chatId, "검색 중 오류가 발생했습니다.");
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 할일 목록 키보드 생성
   */
  buildListKeyboard(todos, page, totalPages, startIdx) {
    const keyboard = { inline_keyboard: [] };

    // 할일 액션 버튼들 (4개씩 그룹화)
    const actionRows = [];
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];

      // 첫 번째 할일
      const todo1 = todos[i];
      const idx1 = startIdx + i + 1;
      row.push({
        text: `${todo1.completed ? "✅" : "⬜"} ${idx1}`,
        callback_data: `todo:toggle:${todo1._id}`,
      });
      row.push({
        text: "🗑️",
        callback_data: `todo:delete:${todo1._id}`,
      });

      // 두 번째 할일 (있으면)
      if (i + 1 < todos.length) {
        const todo2 = todos[i + 1];
        const idx2 = startIdx + i + 2;
        row.push({
          text: `${todo2.completed ? "✅" : "⬜"} ${idx2}`,
          callback_data: `todo:toggle:${todo2._id}`,
        });
        row.push({
          text: "🗑️",
          callback_data: `todo:delete:${todo2._id}`,
        });
      }

      actionRows.push(row);
    }

    keyboard.inline_keyboard.push(...actionRows);

    // 페이지네이션 버튼
    if (totalPages > 1) {
      const pageRow = [];
      if (page > 1) {
        pageRow.push({
          text: "⬅️ 이전",
          callback_data: `todo:page:${page - 1}`,
        });
      }
      if (page < totalPages) {
        pageRow.push({
          text: "다음 ➡️",
          callback_data: `todo:page:${page + 1}`,
        });
      }
      if (pageRow.length > 0) {
        keyboard.inline_keyboard.push(pageRow);
      }
    }

    // 하단 메뉴
    keyboard.inline_keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "📊 통계", callback_data: "todo:stats" },
      { text: "🔙 뒤로", callback_data: "todo:menu" },
    ]);

    return keyboard;
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(date, format = "MM/DD HH:mm") {
    if (!date) return "날짜 없음";

    // TimeHelper를 사용해서 한국 시간으로 표시
    return TimeHelper.formatDateTime(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });
  }

  /**
   * 할일 메뉴 전송 (명령어용)
   */
  async sendTodoMenu(bot, chatId) {
    try {
      const text = `📝 **할일 관리**

할일을 효율적으로 관리해보세요!

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
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 메뉴 전송 오류:", error);
      await this.sendError(bot, chatId, "메뉴 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * 에러 처리
   */
  async handleError(bot, callbackQuery, error) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **오류 발생**\n\n처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "todo:menu" }],
              [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        }
      );
    } catch (editError) {
      logger.error("에러 메시지 표시 실패:", editError);
    }
  }

  // ===== 🚧 추가 구현 필요한 메서드들 =====

  /**
   * 검색 시작
   */
  async startSearch(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, { action: "waiting_search_input" });

    const searchText = `🔍 **할일 검색**

검색할 키워드를 입력해주세요.

💡 **팁:**
• 할일 내용에서 키워드를 찾습니다
• 취소하려면 "/cancel" 또는 "취소"를 입력하세요`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, searchText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 페이지 변경
   */
  async changePage(bot, callbackQuery, params, moduleManager) {
    const page = params[0] ? parseInt(params[0]) : 1;
    await this.showTodoList(bot, callbackQuery, [page], moduleManager);
  }

  /**
   * 삭제 메뉴 표시
   */
  async showClearMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const stats = await this.todoService.getUserStats(userId);

      const clearText = `🗑️ **할일 삭제 관리**

현재 상황:
• 전체: ${stats.total}개
• 완료: ${stats.completed}개
• 진행중: ${stats.pending}개

어떤 작업을 하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🗑️ 완료된 할일만 삭제",
              callback_data: "todo:clear:completed",
            },
          ],
          [{ text: "💣 모든 할일 삭제", callback_data: "todo:clear:all" }],
          [{ text: "🔙 뒤로", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, clearText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("삭제 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
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

      // 메뉴로 돌아가기
      await this.showMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("완료 할일 삭제 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 삭제 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  // 에러 메시지
  async sendError(chatId, errorMessage = "처리 중 오류가 발생했습니다.") {
    try {
      // bot이 cyclic object일 수 있으므로 직접 사용
      await this.bot.sendMessage(chatId, `❌ ${errorMessage}`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error(`${this.name} 에러 메시지 전송 실패:`, error.message);
      // 에러 객체 전체를 로깅하지 않고 메시지만 로깅
    }
  }

  /**
   * 모든 할일 삭제 확인
   */
  async clearAll(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const confirmText = `⚠️ **모든 할일 삭제 확인**

정말로 모든 할일을 삭제하시겠습니까?

**이 작업은 되돌릴 수 없습니다!**`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "💣 네, 모두 삭제", callback_data: "todo:clear:all:confirm" }],
        [{ text: "❌ 취소", callback_data: "todo:clear" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, confirmText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 모든 할일 삭제 확인
   */
  async confirmClearAll(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = await this.todoService.clearAllTodos(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ ${result.deletedCount}개의 모든 할일이 삭제되었습니다.`,
        show_alert: true,
      });

      // 메뉴로 돌아가기
      await this.showMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("모든 할일 삭제 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 삭제 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }
}

module.exports = TodoModule;
