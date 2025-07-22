// src/modules/TodoModule.js - 표준화된 할일 관리 모듈

const BaseModule = require("./BaseModule");
const TodoService = require("../services/TodoService");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor(bot, dependencies) {
    super("TodoModule", {
      commands: ["todo", "할일", "add"],
      callbacks: ["todo"],
      features: ["list", "add", "search", "stats", "export", "import"],
    });

    this.todoService = null;
    this.pageSize = 10; // 페이지당 할일 수
    this.userStates = new Map();
  }

  // 🎯 모듈별 초기화
  async onInitialize() {
    try {
      this.todoService = new TodoService(this.db);
      await this.todoService.initialize();
      logger.info("📝 TodoService 초기화 성공");
    } catch (error) {
      logger.error("❌ TodoService 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showMenu.bind(this), // bind 추가로 this 컨텍스트 유지
      list: this.showTodoList.bind(this),
      add: this.startTodoAdd.bind(this),
      search: this.startTodoSearch.bind(this),
      stats: this.showTodoStats.bind(this),
      export: this.exportTodos.bind(this),
      import: this.startImportTodoData.bind(this),
      "clear:completed": this.clearCompletedTodos.bind(this),
      help: this.showHelp.bind(this), // ← 선택적으로 추가
    });
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 사용자 상태에 따른 처리
    if (userState) {
      switch (userState.action) {
        case "waiting_todo_input":
          return await this.handleTodoInput(bot, chatId, userId, text);
        case "waiting_search_input":
          return await this.handleSearchInput(bot, chatId, userId, text);
        case "waiting_import_data":
          return await this.handleImportData(bot, chatId, userId, text);
      }
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "todo" || command === "할일") {
      await this.showMenu(bot, chatId, null, userId);
      return true;
    } else if (command === "add") {
      // 바로 추가 모드로
      await this.startTodoAdd(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    return false;
  }

  // 🎯 콜백 처리 (동적 액션 포함)
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    // ✅ from 객체를 메서드에 전달
    if (subAction === "menu") {
      await this.showMenu(bot, callbackQuery, moduleManager); // 전체 callbackQuery 전달
      return true;
    }

    if (subAction.startsWith("delete_")) {
      const todoId = subAction.substring(7);
      return await this.deleteTodo(bot, callbackQuery, todoId);
    }

    if (subAction.startsWith("page_")) {
      const page = parseInt(subAction.substring(5));
      return await this.showTodoPage(bot, callbackQuery, page);
    }

    // 기본 액션은 부모 클래스에서 처리
    return await super.handleCallback(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  // 📋 할일 메뉴
  async showMenu(bot, callbackQuery, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // ✅ 올바른 사용자명 추출
    const userName = getUserName(callbackQuery.from);

    try {
      const stats = await this.todoService.getTodoStats(userId);

      const menuText =
        `📝 **할일 관리**\n\n` +
        `${userName}님의 할일 현황:\n` + // ← 이제 "undefined" 대신 실제 이름 표시
        `• 전체: ${stats.total}개\n` +
        `• 완료: ${stats.completed}개\n` +
        `• 진행중: ${stats.pending}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "🔍 검색", callback_data: "todo:search" },
            { text: "📊 통계", callback_data: "todo:stats" },
          ],
          [
            { text: "📤 내보내기", callback_data: "todo:export" },
            { text: "📥 가져오기", callback_data: "todo:import" },
          ],
          [{ text: "🗑️ 정리", callback_data: "todo:clear:completed" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("할일 메뉴 표시 실패:", error);
      await this.sendError(bot, chatId, "메뉴를 불러올 수 없습니다.");
      return true;
    }
  }

  // 📋 할일 목록 표시
  async showTodoList(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // ✅ getTodos 메서드 사용 (이제 별칭으로 정의됨)
      const todos = await this.todoService.getTodos(userId);

      if (todos.length === 0) {
        const emptyText =
          `📋 **할일 목록**\n\n` +
          `아직 등록된 할일이 없습니다.\n` +
          `새로운 할일을 추가해보세요!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "🔙 돌아가기", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, emptyText, {
          reply_markup: keyboard,
        });
        return true;
      }

      // 첫 페이지 표시
      return await this.showTodoPage(bot, callbackQuery, 1);
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      await this.sendError(bot, chatId, "할일 목록을 불러올 수 없습니다.");
      return true;
    }
  }

  // 📄 페이지별 할일 표시
  async showTodoPage(bot, callbackQuery, page = 1) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const todos = await this.todoService.getUserTodos(userId);
      const totalPages = Math.ceil(todos.length / this.pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const startIdx = (currentPage - 1) * this.pageSize;
      const endIdx = startIdx + this.pageSize;
      const pageTodos = todos.slice(startIdx, endIdx);

      let listText = `📋 **할일 목록** (${currentPage}/${totalPages})\n\n`;

      pageTodos.forEach((todo, idx) => {
        const globalIdx = startIdx + idx;
        const status = todo.completed ? "✅" : "📌";
        const date = TimeHelper.formatDate(todo.createdAt);
        listText += `${status} **${globalIdx + 1}.** ${todo.task}\n`;
        listText += `   📅 ${date}\n\n`;
      });

      // 동적 키보드 생성
      const keyboard = this.createTodoListKeyboard(
        pageTodos,
        startIdx,
        currentPage,
        totalPages
      );

      await this.editMessage(bot, chatId, messageId, listText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("할일 페이지 표시 실패:", error);
      await this.sendError(bot, chatId, "할일 목록을 표시할 수 없습니다.");
      return true;
    }
  }

  // 🎨 할일 목록 키보드 생성
  createTodoListKeyboard(todos, startIdx, currentPage, totalPages) {
    const keyboard = [];

    // 할일별 액션 버튼 (2열)
    todos.forEach((todo, idx) => {
      const globalIdx = startIdx + idx;
      const toggleText = todo.completed ? "↩️" : "✅";

      if (idx % 2 === 0) {
        keyboard.push([
          {
            text: `${globalIdx + 1}. ${toggleText}`,
            callback_data: `todo:complete:${globalIdx}`,
          },
          {
            text: `${globalIdx + 1}. 🗑️`,
            callback_data: `todo:delete:${globalIdx}`,
          },
        ]);
      }
    });

    // 홀수 개일 경우 마지막 버튼 처리
    if (todos.length % 2 === 1) {
      const lastIdx = startIdx + todos.length - 1;
      keyboard[keyboard.length - 1].push({
        text: `${lastIdx + 1}. 🗑️`,
        callback_data: `todo:delete:${lastIdx}`,
      });
    }

    // 페이지 네비게이션
    const navButtons = [];
    if (currentPage > 1) {
      navButtons.push({
        text: "◀️ 이전",
        callback_data: `todo:page:${currentPage - 1}`,
      });
    }
    navButtons.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: "todo:noop",
    });
    if (currentPage < totalPages) {
      navButtons.push({
        text: "다음 ▶️",
        callback_data: `todo:page:${currentPage + 1}`,
      });
    }

    if (navButtons.length > 1) {
      keyboard.push(navButtons);
    }

    // 하단 메뉴
    keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "🔍 검색", callback_data: "todo:search" },
    ]);
    keyboard.push([{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }]);

    return { inline_keyboard: keyboard };
  }

  // ➕ 할일 추가 시작
  async startTodoAdd(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    this.userStates.set(userId, {
      action: "waiting_todo_input",
      messageId: callbackQuery.message?.message_id,
    });

    const promptText =
      `➕ **새 할일 추가**\n\n` +
      `추가할 할일을 입력해주세요.\n` +
      `(최대 200자)`;

    await this.sendMessage(bot, chatId, promptText);
    return true;
  }

  // 📝 할일 입력 처리
  async handleTodoInput(bot, chatId, userId, text) {
    try {
      // 유효성 검사
      if (text.length > 200) {
        await this.sendError(
          bot,
          chatId,
          "할일 내용이 너무 깁니다. (최대 200자)"
        );
        return true;
      }

      // ✅ addTodo 결과 처리 (success/error 형태)
      const result = await this.todoService.addTodo(userId, text);

      if (!result.success) {
        await this.sendError(bot, chatId, result.error);
        return true;
      }

      // 상태 초기화
      this.userStates.delete(userId);

      const successText =
        `✅ **할일이 추가되었습니다!**\n\n` +
        `📝 "${result.todo.task}"\n\n` +
        `현재 총 ${result.stats.total}개의 할일이 있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 더 추가하기", callback_data: "todo:add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      await this.sendError(bot, chatId, "할일 추가에 실패했습니다.");
      return true;
    }
  }

  // ✅ 할일 완료/미완료 토글
  async toggleTodo(bot, callbackQuery, todoIdx) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const idx = parseInt(todoIdx);
      const result = await this.todoService.toggleTodo(userId, idx);

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.error,
          show_alert: true,
        });
        return true;
      }

      // 목록 새로고침
      const todos = await this.todoService.getUserTodos(userId);
      const currentPage = Math.floor(idx / this.pageSize) + 1;

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: result.todo.completed ? "✅ 완료!" : "↩️ 미완료로 변경",
      });

      return await this.showTodoPage(bot, callbackQuery, currentPage);
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 실패",
        show_alert: true,
      });
      return true;
    }
  }

  // 🗑️ 할일 삭제
  async deleteTodo(bot, callbackQuery, todoIdx) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const idx = parseInt(todoIdx);
      const result = await this.todoService.deleteTodo(userId, idx);

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.error,
          show_alert: true,
        });
        return true;
      }

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🗑️ 삭제됨",
      });

      // 목록 새로고침
      const todos = await this.todoService.getUserTodos(userId);
      if (todos.length === 0) {
        return await this.showTodoList(bot, callbackQuery);
      }

      const currentPage = Math.min(
        Math.floor(idx / this.pageSize) + 1,
        Math.ceil(todos.length / this.pageSize)
      );

      return await this.showTodoPage(bot, callbackQuery, currentPage);
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 삭제 실패",
        show_alert: true,
      });
      return true;
    }
  }

  // 🔍 검색 시작
  async startTodoSearch(bot, callbackQuery) {
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

    const promptText = `🔍 **할일 검색**\n\n` + `검색할 키워드를 입력해주세요.`;

    await this.sendMessage(bot, chatId, promptText);
    return true;
  }

  // 🔍 검색 입력 처리
  async handleSearchInput(bot, chatId, userId, keyword) {
    try {
      // ✅ searchTodos 결과를 getUserTodos 기반으로 수정
      const allTodos = await this.todoService.getUserTodos(userId);
      const filteredTodos = allTodos.filter((todo) =>
        todo.task.toLowerCase().includes(keyword.toLowerCase())
      );

      // 상태 초기화
      this.userStates.delete(userId);

      if (filteredTodos.length === 0) {
        const noResultText =
          `🔍 **검색 결과 없음**\n\n` +
          `"${keyword}"에 대한 검색 결과가 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "🔍 다시 검색", callback_data: "todo:search" },
              { text: "📋 전체 목록", callback_data: "todo:list" },
            ],
            [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, noResultText, {
          reply_markup: keyboard,
        });
        return true;
      }

      let resultText = `🔍 **검색 결과** (${filteredTodos.length}개)\n\n`;
      resultText += `키워드: "${keyword}"\n\n`;

      filteredTodos.forEach((todo, idx) => {
        const status = todo.completed ? "✅" : "⭕";
        const date = TimeHelper.formatDate(todo.createdAt);
        resultText += `${status} **${idx + 1}.** ${todo.task}\n`;
        resultText += `   📅 ${date}\n\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔍 다시 검색", callback_data: "todo:search" },
            { text: "📋 전체 목록", callback_data: "todo:list" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, resultText, {
        reply_markup: keyboard,
      });
      return true;
    } catch (error) {
      logger.error("할일 검색 실패:", error);
      await this.sendError(bot, chatId, "검색에 실패했습니다.");
      return true;
    }
  }

  // 📊 통계 표시 (수정됨)
  async showTodoStats(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const stats = await this.todoService.getTodoStats(userId);
      const todos = await this.todoService.getUserTodos(userId); // ✅ 추가

      const completionRate =
        stats.total > 0
          ? ((stats.completed / stats.total) * 100).toFixed(1)
          : 0;

      const statsText =
        `📊 **할일 통계**\n\n` +
        `📈 **전체 현황:**\n` +
        `• 총 할일: ${stats.total}개\n` +
        `• 완료: ${stats.completed}개\n` +
        `• 진행중: ${stats.pending}개\n` +
        `• 완료율: ${completionRate}%\n\n` +
        `🎯 **우선순위 별:**\n` +
        `• 높음: ${stats.highPriority}개\n` +
        `• 보통: ${stats.normalPriority}개\n` +
        `• 낮음: ${stats.lowPriority}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      await this.sendError(bot, chatId, "통계를 불러올 수 없습니다.");
      return true;
    }
  }

  // 📊 진행률 바 생성
  async clearCompletedTodos(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const clearedCount = await this.todoService.clearCompleted(userId);
      const remainingTodos = await this.todoService.getUserTodos(userId); // ✅ 추가

      const clearedText =
        `🗑️ **정리 완료**\n\n` +
        `${clearedCount}개의 완료된 할일을 정리했습니다.\n` +
        `현재 ${remainingTodos.length}개의 할일이 남아있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "📊 통계 보기", callback_data: "todo:stats" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, clearedText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("할일 정리 실패:", error);
      await this.sendError(bot, chatId, "할일 정리에 실패했습니다.");
      return true;
    }
  }

  // ❓ 도움말 표시
  async showHelp(bot, chatId, messageId, from) {
    await this.sendMessage(bot, chatId, "❓ /todo, /add로 할일을 관리하세요.");
  }

  // 📥 할일 가져오기 (준비 중)
  async startImportTodoData(bot, chatId, messageId, from) {
    await this.sendMessage(bot, chatId, "📥 가져오기 기능은 준비 중입니다.");
  }

  // 📤 할일 내보내기
  async exportTodos(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = await this.todoService.exportTodos(userId);

      if (!result.success) {
        await this.sendError(bot, chatId, result.error);
        return true;
      }

      const exportText = `📤 **할일 내보내기**\n\n` + `${result.data}`;

      await this.sendMessage(bot, chatId, exportText);
      return true;
    } catch (error) {
      logger.error("할일 내보내기 실패:", error);
      await this.sendError(bot, chatId, "내보내기에 실패했습니다.");
      return true;
    }
  }
}

module.exports = TodoModule;
