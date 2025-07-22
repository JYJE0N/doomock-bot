// src/modules/TodoModule.js - 올바른 역할 분리

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
    this.pageSize = 10;
    this.userStates = new Map(); // 🎯 UI 상태만 관리
  }

  // 🎯 모듈별 초기화 (UI 관련만)
  async onInitialize() {
    try {
      this.todoService = new TodoService(this.db);
      await this.todoService.initialize();
      logger.info("📝 TodoService 연결 성공");
    } catch (error) {
      logger.error("❌ TodoService 연결 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록 (UI 라우팅만)
  setupActions() {
    this.registerActions({
      menu: this.showMenu.bind(this),
      list: this.showTodoList.bind(this),
      add: this.handleAddFlow.bind(this), // 🔄 이름 변경
      search: this.handleSearchFlow.bind(this), // 🔄 이름 변경
      stats: this.showStats.bind(this), // 🔄 이름 변경
      export: this.handleExport.bind(this), // 🔄 이름 변경
      import: this.handleImport.bind(this), // 🔄 이름 변경
      "clear:completed": this.handleClearCompleted.bind(this),
      toggle: this.handleToggle.bind(this), // 🔄 새로 추가
      delete: this.handleDelete.bind(this), // 🔄 새로 추가
    });
  }

  // 🎯 메시지 처리 (UI 인터페이스만)
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    // 1️⃣ 명령어 파싱만 처리
    if (text.startsWith("/todo") || text.startsWith("/할일")) {
      return await this.showMenu(bot, msg);
    }

    // 2️⃣ 사용자 입력 상태 확인
    const userState = this.userStates.get(userId);
    if (!userState) return false;

    try {
      // 3️⃣ 상태별 입력 처리 (UI 플로우만)
      switch (userState.action) {
        case "adding_todo":
          return await this.processAddInput(bot, msg, userState);

        case "searching_todo":
          return await this.processSearchInput(bot, msg, userState);

        case "importing_data":
          return await this.processImportInput(bot, msg, userState);

        default:
          this.clearUserState(userId);
          return false;
      }
    } catch (error) {
      logger.error(`TodoModule 메시지 처리 실패 (${userName}):`, error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  // 🎯 콜백 처리 (UI 라우팅만)
  async onHandleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    // actionMap을 통한 표준 라우팅 (중복 제거)
    return await this.executeAction(
      subAction,
      bot,
      callbackQuery,
      params,
      moduleManager
    );
  }

  // ========== 🎨 UI 전용 메서드들 ==========

  /**
   * 🏠 메뉴 표시 (UI만)
   */
  async showMenu(bot, msgOrCallback) {
    const chatId = msgOrCallback.message?.chat?.id || msgOrCallback.chat?.id;
    const userId = msgOrCallback.from.id;

    // 📊 서비스에서 통계 가져오기
    const stats = await this.todoService.getTodoStats(userId);

    const menuText = `
📝 **할일 관리**

📋 현재 상황:
• 전체 할일: ${stats.total}개
• 완료: ${stats.completed}개  
• 미완료: ${stats.incomplete}개
• 완료율: ${stats.completionRate}%

어떤 작업을 하시겠습니까?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 목록 보기", callback_data: "todo:list" },
          { text: "➕ 추가하기", callback_data: "todo:add" },
        ],
        [
          { text: "🔍 검색하기", callback_data: "todo:search" },
          { text: "📊 통계 보기", callback_data: "todo:stats" },
        ],
        [
          { text: "📤 내보내기", callback_data: "todo:export" },
          { text: "📥 가져오기", callback_data: "todo:import" },
        ],
        [
          {
            text: "🧹 완료된 할일 정리",
            callback_data: "todo:clear:completed",
          },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    if (msgOrCallback.message) {
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: msgOrCallback.message.message_id,
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    } else {
      await bot.sendMessage(chatId, menuText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    }
    return true;
  }

  /**
   * 📋 할일 목록 표시 (UI + 페이징)
   */
  async showTodoList(bot, callbackQuery, page = 1) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    // 🔄 서비스에서 데이터만 가져오기
    const todos = await this.todoService.getUserTodos(userId);

    if (todos.length === 0) {
      const emptyText =
        "📝 **할일 목록이 비어있습니다**\n\n➕ 새로운 할일을 추가해보세요!";
      const keyboard = {
        inline_keyboard: [
          [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
          [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
        ],
      };

      await bot.editMessageText(emptyText, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
      return true;
    }

    // 🎨 UI 페이징 로직
    const totalPages = Math.ceil(todos.length / this.pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, todos.length);
    const pageTodos = todos.slice(startIdx, endIdx);

    // 📝 할일 목록 포맷팅 (UI만 담당)
    let listText = `📋 **할일 목록** (${currentPage}/${totalPages})\n\n`;

    pageTodos.forEach((todo, index) => {
      const globalIndex = startIdx + index;
      const status = todo.completed ? "✅" : "⏳";
      const task = todo.completed ? `~~${todo.task}~~` : todo.task;
      listText += `${status} ${globalIndex + 1}. ${task}\n`;
    });

    listText += `\n📊 전체: ${todos.length}개`;

    // 🎮 인터랙션 버튼 생성
    const keyboard = this.buildListKeyboard(
      currentPage,
      totalPages,
      startIdx,
      pageTodos
    );

    await bot.editMessageText(listText, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  // ========== 🔧 UI 플로우 핸들러들 ==========

  /**
   * ➕ 할일 추가 플로우 시작
   */
  async handleAddFlow(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
      },
      from: { id: userId },
    } = callbackQuery;

    // UI 상태 설정
    this.userStates.set(userId, {
      action: "adding_todo",
      chatId: chatId,
      messageId: callbackQuery.message.message_id,
    });

    const inputText = `
➕ **할일 추가**

새로운 할일을 입력해주세요:
• 간단하고 명확하게 작성해주세요
• 취소하려면 /cancel 입력

예시: "회의 자료 준비하기"`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
    };

    await bot.editMessageText(inputText, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  /**
   * ➕ 할일 추가 입력 처리
   */
  async processAddInput(bot, msg, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text === "/cancel" || text === "취소") {
      this.clearUserState(userId);
      return await this.showMenu(bot, msg);
    }

    try {
      // 🎯 서비스를 통해 데이터 처리
      const result = await this.todoService.addTodo(userId, text.trim());

      this.clearUserState(userId);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ 할일이 추가되었습니다!\n\n📝 "${text}"`
        );
        return await this.showMenu(bot, msg);
      } else {
        await bot.sendMessage(chatId, `❌ ${result.error}`);
        return true;
      }
    } catch (error) {
      logger.error("할일 추가 처리 실패:", error);
      await bot.sendMessage(chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  /**
   * 🔄 할일 토글 처리
   */
  async handleToggle(bot, callbackQuery, todoIdx) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const idx = parseInt(todoIdx);
      const todos = await this.todoService.getUserTodos(userId);

      if (idx < 0 || idx >= todos.length) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 잘못된 할일 번호입니다.",
          show_alert: true,
        });
        return true;
      }

      const todo = todos[idx];

      // 🎯 서비스를 통해 토글 처리
      const result = await this.todoService.toggleTodo(userId, todo.id);

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.message,
        });

        const currentPage = Math.floor(idx / this.pageSize) + 1;
        return await this.showTodoList(bot, callbackQuery, currentPage);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.error,
          show_alert: true,
        });
        return true;
      }
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 실패",
        show_alert: true,
      });
      return true;
    }
  }

  // ========== 🛠️ UI 유틸리티들 ==========

  /**
   * 🎮 목록용 키보드 빌더
   */
  buildListKeyboard(currentPage, totalPages, startIdx, pageTodos) {
    const keyboard = { inline_keyboard: [] };

    // 할일 토글/삭제 버튼들
    const todoButtons = [];
    pageTodos.forEach((todo, index) => {
      const globalIdx = startIdx + index;
      todoButtons.push([
        {
          text: todo.completed ? "✅ 완료취소" : "⏳ 완료",
          callback_data: `todo:toggle:${globalIdx}`,
        },
        {
          text: "🗑️ 삭제",
          callback_data: `todo:delete:${globalIdx}`,
        },
      ]);
    });

    keyboard.inline_keyboard.push(...todoButtons);

    // 페이징 버튼
    if (totalPages > 1) {
      const pageButtons = [];
      if (currentPage > 1) {
        pageButtons.push({
          text: "◀️ 이전",
          callback_data: `todo:list:${currentPage - 1}`,
        });
      }

      pageButtons.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "noop",
      });

      if (currentPage < totalPages) {
        pageButtons.push({
          text: "다음 ▶️",
          callback_data: `todo:list:${currentPage + 1}`,
        });
      }

      keyboard.inline_keyboard.push(pageButtons);
    }

    // 메뉴 버튼
    keyboard.inline_keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "🔙 메뉴", callback_data: "todo:menu" },
    ]);

    return keyboard;
  }

  /**
   * 🧹 사용자 상태 정리
   */
  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  // ========== 📊 나머지 UI 핸들러들 (간략화) ==========

  async showStats(bot, callbackQuery) {
    // 통계는 서비스에서 가져와서 UI만 담당
    const stats = await this.todoService.getTodoStats(callbackQuery.from.id);
    // ... UI 표시 로직
    return true;
  }

  async handleExport(bot, callbackQuery) {
    // 내보내기는 서비스에서 처리하고 UI만 담당
    const result = await this.todoService.exportTodos(callbackQuery.from.id);
    // ... UI 응답 처리
    return true;
  }

  async handleSearchFlow(bot, callbackQuery) {
    // 검색 UI 플로우만 담당
    return true;
  }

  async handleImport(bot, callbackQuery) {
    // 가져오기 UI 플로우만 담당
    return true;
  }

  async handleClearCompleted(bot, callbackQuery) {
    // 완료된 할일 정리 - 서비스 호출 후 UI 응답
    const result = await this.todoService.clearCompletedTodos(
      callbackQuery.from.id
    );
    // ... UI 처리
    return true;
  }

  async handleDelete(bot, callbackQuery, todoIdx) {
    // 삭제는 서비스에서 처리하고 UI만 담당
    const result = await this.todoService.deleteTodo(
      callbackQuery.from.id,
      todoIdx
    );
    // ... UI 응답 처리
    return true;
  }
}

module.exports = TodoModule;
