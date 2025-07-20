// src/modules/TodoModule.js - 완전 표준화된 할일 관리 모듈

const BaseModule = require("./BaseModule");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { getUserName } = require("../utils/UserHelper");
const { TimeHelper } = require("../utils/TimeHelper");
const Logger = require("../utils/Logger");

class TodoModule extends BaseModule {
  constructor() {
    super("TodoModule", {
      commands: ["todo", "할일", "add"],
      callbacks: ["todo"],
      description: "📝 할일 관리",
      emoji: "📝",
      features: ["할일 추가", "완료 처리", "통계", "삭제", "검색"],
      priority: 1, // 높은 우선순위
      maxConcurrentUsers: 50,
      timeout: 60000, // 1분
    });

    // 📊 Todo 전용 통계
    this.todoStats = {
      totalTodos: 0,
      completedTodos: 0,
      deletedTodos: 0,
      averageCompletionTime: 0,
    };

    // 🔍 검색 상태 관리
    this.searchStates = new Map();
  }

  // 🔧 모듈별 초기화
  async onInitialize() {
    try {
      // Todo 컬렉션 확인 및 생성
      await this._ensureTodoCollection();

      // 기존 Todo 통계 로드
      await this._loadTodoStats();

      Logger.success("📝 TodoModule 초기화 완료");
    } catch (error) {
      throw new Error(`TodoModule 초기화 실패: ${error.message}`);
    }
  }

  // 📑 Todo 컬렉션 설정
  async _ensureTodoCollection() {
    const indexes = [
      { key: { userId: 1, createdAt: -1 }, options: {} },
      { key: { userId: 1, completed: 1 }, options: {} },
      { key: { userId: 1, text: "text" }, options: {} }, // 텍스트 검색용
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 7776000 } }, // 90일 후 삭제
    ];

    await this.db.ensureIndexes("todos", indexes);
  }

  // 📊 기존 통계 로드
  async _loadTodoStats() {
    try {
      const totalCount = await this.db.countDocuments("todos", {});
      const completedCount = await this.db.countDocuments("todos", {
        completed: true,
      });

      this.todoStats.totalTodos = totalCount;
      this.todoStats.completedTodos = completedCount;

      Logger.debug(
        `📊 Todo 통계 로드됨: 전체 ${totalCount}, 완료 ${completedCount}`
      );
    } catch (error) {
      Logger.warn("⚠️ Todo 통계 로드 실패:", error.message);
    }
  }

  // 🎯 액션 등록 (BaseModule 확장)
  registerActions() {
    super.registerActions(); // 기본 액션 유지

    // Todo 전용 액션들
    this.actionMap.set("list", this.showTodoList.bind(this));
    this.actionMap.set("add", this.startTodoAdd.bind(this));
    this.actionMap.set("complete", this.completeTodo.bind(this));
    this.actionMap.set("delete", this.deleteTodo.bind(this));
    this.actionMap.set("clear_completed", this.clearCompletedTodos.bind(this));
    this.actionMap.set("clear_all", this.clearAllTodos.bind(this));
    this.actionMap.set("search", this.startTodoSearch.bind(this));
    this.actionMap.set("export", this.exportTodos.bind(this));
    this.actionMap.set("import", this.startTodoImport.bind(this));
  }

  // 📨 메시지 처리 (표준 매개변수)
  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      if (userState) {
        return await this._handleUserStateMessage(bot, msg, userState);
      }

      // 명령어 처리
      if (text) {
        // 기본 Todo 명령어
        if (text.match(/^\/?(todo|할일)$/i)) {
          await this.showMenu(bot, chatId, null, userId, userName);
          return true;
        }

        // 빠른 할일 추가: "/add 할일내용" 또는 "/할일 추가 내용"
        const addMatch = text.match(/^\/?(add|할일)\s+(.+)$/i);
        if (addMatch) {
          const todoText = addMatch[2].trim();
          return await this._addTodoQuick(
            bot,
            chatId,
            userId,
            todoText,
            userName
          );
        }

        // 빠른 검색: "/todo 검색 키워드"
        const searchMatch = text.match(/^\/?(todo|할일)\s+검색\s+(.+)$/i);
        if (searchMatch) {
          const keyword = searchMatch[2].trim();
          return await this._searchTodosQuick(bot, chatId, userId, keyword);
        }
      }

      return false; // 다른 모듈이 처리하도록
    } catch (error) {
      await this.handleError(error, { userId, chatId, type: "message" });
      return false;
    }
  }

  // 👤 사용자 상태별 메시지 처리
  async _handleUserStateMessage(bot, msg, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    switch (userState.action) {
      case "waiting_todo_input":
        return await this._processTodoInput(
          bot,
          chatId,
          userId,
          text,
          userName
        );

      case "waiting_search_input":
        return await this._processSearchInput(bot, chatId, userId, text);

      case "waiting_import_data":
        return await this._processImportData(
          bot,
          chatId,
          userId,
          text,
          userName
        );

      default:
        this.clearUserState(userId);
        return false;
    }
  }

  // 📞 콜백 처리 (🎯 표준 매개변수)
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      // 액션 매핑에서 처리
      const action = this.actionMap.get(subAction);
      if (action) {
        await action(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          params,
          menuManager
        );
        return true;
      }

      // 동적 액션 처리 (complete_ID, delete_ID 등)
      if (subAction.startsWith("complete_")) {
        const todoId = subAction.substring(9);
        return await this._completeTodoById(
          bot,
          chatId,
          messageId,
          userId,
          todoId
        );
      }

      if (subAction.startsWith("delete_")) {
        const todoId = subAction.substring(7);
        return await this._deleteTodoById(
          bot,
          chatId,
          messageId,
          userId,
          todoId
        );
      }

      if (subAction.startsWith("page_")) {
        const page = parseInt(subAction.substring(5));
        return await this._showTodoPage(bot, chatId, messageId, userId, page);
      }

      // 알 수 없는 액션
      Logger.warn(`⚠️ 알 수 없는 Todo 액션: ${subAction}`);
      return false;
    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, subAction });
      return false;
    }
  }

  // 📋 메뉴 데이터 (BaseModule 오버라이드)
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
            { text: "🔍 할일 검색", callback_data: "todo_search" },
            { text: "📊 할일 통계", callback_data: "todo_stats" },
          ],
          [
            {
              text: "✅ 완료된 할일 정리",
              callback_data: "todo_clear_completed",
            },
            { text: "🗑️ 모든 할일 삭제", callback_data: "todo_clear_all" },
          ],
          [
            { text: "📤 할일 내보내기", callback_data: "todo_export" },
            { text: "📥 할일 가져오기", callback_data: "todo_import" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ❓ 도움말 텍스트 (BaseModule 오버라이드)
  getHelpText() {
    return `**📝 할일 관리 도움말**

**기본 명령어:**
• \`/todo\` - 할일 메뉴 열기
• \`/add [내용]\` - 빠른 할일 추가
• \`/todo 검색 [키워드]\` - 빠른 검색

**주요 기능:**
📋 **할일 목록** - 등록된 할일들을 확인
➕ **할일 추가** - 새로운 할일 등록
✅ **완료 처리** - 할일 완료 체크
🗑️ **삭제** - 불필요한 할일 제거
🔍 **검색** - 키워드로 할일 찾기
📊 **통계** - 할일 처리 현황 확인

**팁:**
• 할일은 자동으로 90일 후 삭제됩니다
• 완료된 할일은 한 번에 정리할 수 있습니다
• 데이터 백업을 위해 내보내기 기능을 활용하세요`;
  }

  // ================== Todo 기능 구현 ==================

  // 📋 할일 목록 표시
  async showTodoList(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this.db.find(
        "todos",
        { userId },
        { sort: { createdAt: -1 }, limit: 10 }
      );

      if (todos.length === 0) {
        const emptyMessage = `📝 **${userName}님의 할일 목록이 비어있습니다.**\n\n새로운 할일을 추가해보세요!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가하기", callback_data: "todo_add" }],
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        };

        return await this._editOrSendMessage(
          bot,
          chatId,
          messageId,
          emptyMessage,
          keyboard
        );
      }

      return await this._displayTodoList(
        bot,
        chatId,
        messageId,
        userId,
        todos,
        1,
        userName
      );
    } catch (error) {
      throw new Error(`할일 목록 조회 실패: ${error.message}`);
    }
  }

  // 📋 할일 목록 표시 (페이지네이션 포함)
  async _displayTodoList(
    bot,
    chatId,
    messageId,
    userId,
    todos,
    page = 1,
    userName
  ) {
    const itemsPerPage = 5;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTodos = todos.slice(startIndex, endIndex);

    let todoText = `📝 **${userName}님의 할일 목록** (${page}/${Math.ceil(
      todos.length / itemsPerPage
    )}페이지)\n\n`;

    const keyboard = { inline_keyboard: [] };

    // 할일 항목들
    pageTodos.forEach((todo, index) => {
      const actualIndex = startIndex + index + 1;
      const status = todo.completed ? "✅" : "⭕";
      const date = TimeHelper.formatDate(todo.createdAt, "MM/DD");

      todoText += `${status} **${actualIndex}.** ${todo.text}\n`;
      todoText += `   📅 ${date}`;

      if (todo.completed && todo.completedAt) {
        const completedDate = TimeHelper.formatDate(todo.completedAt, "MM/DD");
        todoText += ` → ✅ ${completedDate}`;
      }

      todoText += "\n\n";

      // 각 할일에 대한 액션 버튼
      const todoButtons = [];

      if (!todo.completed) {
        todoButtons.push({
          text: `✅ ${actualIndex}번 완료`,
          callback_data: `todo_complete_${todo._id}`,
        });
      }

      todoButtons.push({
        text: `🗑️ ${actualIndex}번 삭제`,
        callback_data: `todo_delete_${todo._id}`,
      });

      if (todoButtons.length > 0) {
        keyboard.inline_keyboard.push(todoButtons);
      }
    });

    // 페이지네이션 버튼
    const navButtons = [];
    if (page > 1) {
      navButtons.push({
        text: "⬅️ 이전",
        callback_data: `todo_page_${page - 1}`,
      });
    }
    if (endIndex < todos.length) {
      navButtons.push({
        text: "➡️ 다음",
        callback_data: `todo_page_${page + 1}`,
      });
    }
    if (navButtons.length > 0) {
      keyboard.inline_keyboard.push(navButtons);
    }

    // 하단 메뉴 버튼
    keyboard.inline_keyboard.push([
      { text: "➕ 할일 추가", callback_data: "todo_add" },
      { text: "🔍 검색", callback_data: "todo_search" },
    ]);
    keyboard.inline_keyboard.push([
      { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
    ]);

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      todoText,
      keyboard
    );
  }

  // ➕ 할일 추가 시작
  async startTodoAdd(bot, chatId, messageId, userId, userName) {
    const message = `📝 **새로운 할일 추가**\n\n${userName}님, 추가하실 할일을 입력해주세요.\n\n예시: "프레젠테이션 자료 준비"`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_cancel" }]],
    };

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "waiting_todo_input",
      step: "add",
    });

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // ✏️ 할일 입력 처리
  async _processTodoInput(bot, chatId, userId, text, userName) {
    try {
      // 입력 검증
      const todoText = ValidationHelper.validateText(text, 1, 200);

      // 할일 저장
      const newTodo = {
        userId,
        text: todoText,
        completed: false,
        createdAt: new Date(),
      };

      const result = await this.db.insertOne("todos", newTodo);

      // 통계 업데이트
      this.todoStats.totalTodos++;

      // 사용자 상태 정리
      this.clearUserState(userId);

      // 성공 메시지
      const successMessage = `✅ **할일이 추가되었습니다!**\n\n📝 ${todoText}\n\n다른 할일을 더 추가하시거나 목록을 확인해보세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 또 추가하기", callback_data: "todo_add" },
            { text: "📋 목록 보기", callback_data: "todo_list" },
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
      // 입력 오류 처리
      const errorMessage = `❌ **입력 오류**\n\n${error.message}\n\n다시 할일을 입력해주세요.`;

      await bot.sendMessage(chatId, errorMessage, {
        parse_mode: "Markdown",
      });

      return true; // 상태 유지
    }
  }

  // ⚡ 빠른 할일 추가
  async _addTodoQuick(bot, chatId, userId, todoText, userName) {
    try {
      const validatedText = ValidationHelper.validateText(todoText, 1, 200);

      const newTodo = {
        userId,
        text: validatedText,
        completed: false,
        createdAt: new Date(),
      };

      await this.db.insertOne("todos", newTodo);
      this.todoStats.totalTodos++;

      const successMessage = `✅ **할일이 추가되었습니다!**\n\n📝 ${validatedText}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "➕ 더 추가하기", callback_data: "todo_add" },
          ],
        ],
      };

      await bot.sendMessage(chatId, successMessage, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      const errorMessage = `❌ **할일 추가 실패**\n\n${error.message}`;
      await bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      return true;
    }
  }

  // ✅ 할일 완료 처리
  async _completeTodoById(bot, chatId, messageId, userId, todoId) {
    try {
      const todo = await this.db.findOne("todos", {
        _id: this.db.ObjectId(todoId),
        userId,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      if (todo.completed) {
        throw new Error("이미 완료된 할일입니다.");
      }

      // 완료 처리
      await this.db.updateOne(
        "todos",
        { _id: this.db.ObjectId(todoId), userId },
        {
          completed: true,
          completedAt: new Date(),
        }
      );

      // 통계 업데이트
      this.todoStats.completedTodos++;

      const message = `✅ **할일을 완료했습니다!**\n\n📝 ${todo.text}\n\n🎉 수고하셨습니다!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "📊 통계 보기", callback_data: "todo_stats" },
          ],
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
    } catch (error) {
      throw new Error(`할일 완료 처리 실패: ${error.message}`);
    }
  }

  // 🗑️ 할일 삭제
  async _deleteTodoById(bot, chatId, messageId, userId, todoId) {
    try {
      const todo = await this.db.findOne("todos", {
        _id: this.db.ObjectId(todoId),
        userId,
      });

      if (!todo) {
        throw new Error("할일을 찾을 수 없습니다.");
      }

      await this.db.deleteOne("todos", {
        _id: this.db.ObjectId(todoId),
        userId,
      });

      // 통계 업데이트
      this.todoStats.deletedTodos++;
      if (todo.completed) {
        this.todoStats.completedTodos--;
      }
      this.todoStats.totalTodos--;

      const message = `🗑️ **할일이 삭제되었습니다.**\n\n📝 ${todo.text}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "➕ 할일 추가", callback_data: "todo_add" },
          ],
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
    } catch (error) {
      throw new Error(`할일 삭제 실패: ${error.message}`);
    }
  }

  // 🧹 완료된 할일 모두 삭제
  async clearCompletedTodos(bot, chatId, messageId, userId, userName) {
    try {
      const completedCount = await this.db.countDocuments("todos", {
        userId,
        completed: true,
      });

      if (completedCount === 0) {
        const message = `📝 **${userName}님, 완료된 할일이 없습니다.**\n\n정리할 할일이 없어요!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 목록 보기", callback_data: "todo_list" }],
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

      await this.db.deleteMany("todos", { userId, completed: true });

      // 통계 업데이트
      this.todoStats.completedTodos -= completedCount;
      this.todoStats.totalTodos -= completedCount;
      this.todoStats.deletedTodos += completedCount;

      const message = `🧹 **완료된 할일 ${completedCount}개가 정리되었습니다!**\n\n깔끔해졌네요! 🎉`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "📊 통계 보기", callback_data: "todo_stats" },
          ],
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
    } catch (error) {
      throw new Error(`완료된 할일 정리 실패: ${error.message}`);
    }
  }

  // 🗑️ 모든 할일 삭제 (확인 후)
  async clearAllTodos(bot, chatId, messageId, userId, userName) {
    try {
      const totalCount = await this.db.countDocuments("todos", { userId });

      if (totalCount === 0) {
        const message = `📝 **${userName}님, 삭제할 할일이 없습니다.**`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo_add" }],
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

      const confirmMessage = `⚠️ **정말로 모든 할일을 삭제하시겠습니까?**\n\n${userName}님의 할일 ${totalCount}개가 모두 삭제됩니다.\n\n**이 작업은 되돌릴 수 없습니다.**`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ 네, 모두 삭제",
              callback_data: "todo_confirm_clear_all",
            },
            { text: "❌ 취소", callback_data: "todo_menu" },
          ],
        ],
      };

      return await this._editOrSendMessage(
        bot,
        chatId,
        messageId,
        confirmMessage,
        keyboard
      );
    } catch (error) {
      throw new Error(`할일 삭제 확인 실패: ${error.message}`);
    }
  }

  // 📊 Todo 통계 표시 (BaseModule stats 확장)
  async showStats(bot, chatId, messageId, userId, userName) {
    try {
      const userTodos = await this.db.find("todos", { userId });
      const completed = userTodos.filter((t) => t.completed).length;
      const pending = userTodos.length - completed;
      const completionRate =
        userTodos.length > 0
          ? ((completed / userTodos.length) * 100).toFixed(1)
          : 0;

      // 최근 활동 분석
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const weekStart = new Date(
        todayStart.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      const todayTodos = userTodos.filter(
        (t) => t.createdAt >= todayStart
      ).length;
      const weekTodos = userTodos.filter(
        (t) => t.createdAt >= weekStart
      ).length;
      const todayCompleted = userTodos.filter(
        (t) => t.completedAt && t.completedAt >= todayStart
      ).length;

      const statsText =
        `📊 **${userName}님의 할일 통계**\n\n` +
        `📝 **전체 할일:** ${userTodos.length}개\n` +
        `✅ **완료:** ${completed}개\n` +
        `⭕ **미완료:** ${pending}개\n` +
        `📈 **완료율:** ${completionRate}%\n\n` +
        `📅 **오늘 활동:**\n` +
        `　• 새 할일: ${todayTodos}개\n` +
        `　• 완료: ${todayCompleted}개\n\n` +
        `📅 **이번 주:** ${weekTodos}개 추가\n\n` +
        `🏆 **전체 완료한 할일:** ${this.todoStats.completedTodos}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
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
      throw new Error(`통계 조회 실패: ${error.message}`);
    }
  }

  // 🔍 할일 검색 시작
  async startTodoSearch(bot, chatId, messageId, userId, userName) {
    const message = `🔍 **할일 검색**\n\n${userName}님, 검색하실 키워드를 입력해주세요.\n\n예시: "회의", "프로젝트", "보고서"`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_cancel" }]],
    };

    this.setUserState(userId, {
      action: "waiting_search_input",
    });

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // 🔍 검색 입력 처리
  async _processSearchInput(bot, chatId, userId, text) {
    try {
      const keyword = ValidationHelper.validateSearchKeyword(text);

      const searchResults = await this.db.find(
        "todos",
        {
          userId,
          text: { $regex: keyword, $options: "i" },
        },
        {
          sort: { createdAt: -1 },
        }
      );

      this.clearUserState(userId);

      if (searchResults.length === 0) {
        const message = `🔍 **검색 결과 없음**\n\n"${keyword}"에 대한 할일을 찾을 수 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "🔍 다시 검색", callback_data: "todo_search" },
              { text: "📋 전체 목록", callback_data: "todo_list" },
            ],
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        };

        await bot.sendMessage(chatId, message, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });

        return true;
      }

      // 검색 결과 표시
      let resultText = `🔍 **검색 결과: "${keyword}"** (${searchResults.length}개)\n\n`;

      searchResults.slice(0, 10).forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const date = TimeHelper.formatDate(todo.createdAt, "MM/DD");
        resultText += `${status} **${index + 1}.** ${
          todo.text
        }\n📅 ${date}\n\n`;
      });

      if (searchResults.length > 10) {
        resultText += `\n... 및 ${searchResults.length - 10}개 더`;
      }

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
      const errorMessage = `❌ **검색 오류**\n\n${error.message}\n\n다시 키워드를 입력해주세요.`;

      await bot.sendMessage(chatId, errorMessage, {
        parse_mode: "Markdown",
      });

      return true;
    }
  }

  // ⚡ 빠른 검색
  async _searchTodosQuick(bot, chatId, userId, keyword) {
    try {
      const validatedKeyword = ValidationHelper.validateSearchKeyword(keyword);

      const searchResults = await this.db.find(
        "todos",
        {
          userId,
          text: { $regex: validatedKeyword, $options: "i" },
        },
        {
          sort: { createdAt: -1 },
          limit: 10,
        }
      );

      let message;
      const keyboard = { inline_keyboard: [] };

      if (searchResults.length === 0) {
        message = `🔍 **검색 결과 없음**\n\n"${validatedKeyword}"에 대한 할일을 찾을 수 없습니다.`;
      } else {
        message = `🔍 **검색 결과: "${validatedKeyword}"** (${searchResults.length}개)\n\n`;

        searchResults.forEach((todo, index) => {
          const status = todo.completed ? "✅" : "⭕";
          const date = TimeHelper.formatDate(todo.createdAt, "MM/DD");
          message += `${status} **${index + 1}.** ${todo.text}\n📅 ${date}\n\n`;
        });
      }

      keyboard.inline_keyboard.push([
        { text: "🔍 다른 검색", callback_data: "todo_search" },
        { text: "📋 전체 목록", callback_data: "todo_list" },
      ]);

      await bot.sendMessage(chatId, message, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      const errorMessage = `❌ **검색 실패**\n\n${error.message}`;
      await bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      return true;
    }
  }

  // 📤 할일 내보내기
  async exportTodos(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this.db.find(
        "todos",
        { userId },
        { sort: { createdAt: -1 } }
      );

      if (todos.length === 0) {
        const message = `📤 **내보낼 할일이 없습니다.**\n\n${userName}님의 할일 목록이 비어있어요.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo_add" }],
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

      // 텍스트 형식으로 내보내기
      let exportText = `📝 ${userName}님의 할일 목록 (${new Date().toLocaleDateString()})\n\n`;

      todos.forEach((todo, index) => {
        const status = todo.completed ? "[완료]" : "[미완료]";
        const date = TimeHelper.formatDate(todo.createdAt, "YYYY-MM-DD");
        exportText += `${index + 1}. ${status} ${todo.text} (${date})\n`;
      });

      exportText += `\n총 ${todos.length}개의 할일 (완료: ${
        todos.filter((t) => t.completed).length
      }개)`;

      // 파일로 전송
      await bot.sendDocument(chatId, Buffer.from(exportText, "utf8"), {
        filename: `할일목록_${userName}_${
          new Date().toISOString().split("T")[0]
        }.txt`,
        caption: `📤 **할일 목록이 내보내졌습니다!**\n\n총 ${todos.length}개의 할일이 포함되어 있습니다.`,
      });

      return true;
    } catch (error) {
      throw new Error(`할일 내보내기 실패: ${error.message}`);
    }
  }

  // 📥 할일 가져오기 시작
  async startTodoImport(bot, chatId, messageId, userId, userName) {
    const message =
      `📥 **할일 가져오기**\n\n${userName}님, 가져오실 할일 데이터를 다음 형식으로 입력해주세요:\n\n` +
      `**형식:**\n` +
      `할일 1\n` +
      `할일 2\n` +
      `할일 3\n\n` +
      `**예시:**\n` +
      `회의 자료 준비\n` +
      `이메일 답장하기\n` +
      `프로젝트 계획서 작성`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_cancel" }]],
    };

    this.setUserState(userId, {
      action: "waiting_import_data",
    });

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // 📥 가져오기 데이터 처리
  async _processImportData(bot, chatId, userId, text, userName) {
    try {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        throw new Error("가져올 할일이 없습니다.");
      }

      if (lines.length > 50) {
        throw new Error("한 번에 최대 50개까지만 가져올 수 있습니다.");
      }

      // 할일 일괄 추가
      const todos = lines.map((line) => ({
        userId,
        text: ValidationHelper.validateText(line, 1, 200),
        completed: false,
        createdAt: new Date(),
      }));

      await this.db.insertMany("todos", todos);

      // 통계 업데이트
      this.todoStats.totalTodos += todos.length;

      this.clearUserState(userId);

      const successMessage = `📥 **할일 가져오기 완료!**\n\n${todos.length}개의 할일이 추가되었습니다.\n\n🎉 이제 할일 목록을 확인해보세요!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "📊 통계 보기", callback_data: "todo_stats" },
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
      const errorMessage = `❌ **가져오기 실패**\n\n${error.message}\n\n다시 올바른 형식으로 입력해주세요.`;

      await bot.sendMessage(chatId, errorMessage, {
        parse_mode: "Markdown",
      });

      return true;
    }
  }

  // 🛠️ 유틸리티 메서드들

  // 메시지 편집 또는 전송
  async _editOrSendMessage(bot, chatId, messageId, text, keyboard) {
    try {
      if (messageId) {
        return await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
      } else {
        return await bot.sendMessage(chatId, text, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      // 편집 실패 시 새 메시지 전송
      if (error.message?.includes("message is not modified")) {
        return; // 내용이 같아서 편집되지 않음 (정상)
      }

      Logger.warn("메시지 편집 실패, 새 메시지 전송:", error.message);
      return await bot.sendMessage(chatId, text, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    }
  }

  // 📊 모듈 상태 반환 (BaseModule 확장)
  getStatus() {
    return {
      ...super.getStatus(),
      todoStats: this.todoStats,
      searchStates: this.searchStates.size,
    };
  }

  // 🧹 정리 작업 (BaseModule 확장)
  async onCleanup() {
    this.searchStates.clear();
    Logger.debug("📝 TodoModule 정리 완료");
  }
}

module.exports = TodoModule;
