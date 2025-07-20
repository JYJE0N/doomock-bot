// src/modules/TodoModule.js - 완전 표준화된 할일 관리 모듈

const BaseModule = require("./BaseModule");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { getUserName } = require("../utils/UserHelper");
const { TimeHelper } = require("../utils/TimeHelper");

// ✅ 직접 logger 가져오기 (표준 방식)
const logger = require("../utils/Logger");

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

    // ✅ logger 초기화 (표준 방식)
    // logger는 이미 위에서 require로 가져옴
  }

  // 🔧 모듈별 초기화
  async onInitialize() {
    try {
      // 데이터베이스 연결 확인
      if (!this.db) {
        logger.warn("⚠️ 데이터베이스 연결 없음, 메모리 모드로 실행");
        this.memoryTodos = new Map(); // 메모리 저장소
        return;
      }

      // Todo 컬렉션 확인 및 생성
      await this._ensureTodoCollection();

      // 기존 Todo 통계 로드
      await this._loadTodoStats();

      logger.success("📝 TodoModule 초기화 완료");
    } catch (error) {
      logger.error("TodoModule 초기화 실패:", error);
      // 메모리 모드로 폴백
      this.memoryTodos = new Map();
      logger.info("메모리 모드로 실행합니다.");
    }
  }

  // 📑 Todo 컬렉션 설정
  async _ensureTodoCollection() {
    if (!this.db || !this.db.ensureIndexes) return;

    try {
      const indexes = [
        { key: { userId: 1, createdAt: -1 }, options: {} },
        { key: { userId: 1, completed: 1 }, options: {} },
        { key: { userId: 1, text: "text" }, options: {} }, // 텍스트 검색용
        { key: { createdAt: 1 }, options: { expireAfterSeconds: 7776000 } }, // 90일 후 삭제
      ];

      await this.db.ensureIndexes("todos", indexes);
    } catch (error) {
      logger.warn("인덱스 생성 실패:", error.message);
    }
  }

  // 📊 기존 통계 로드
  async _loadTodoStats() {
    try {
      if (!this.db) return;

      const totalCount = await this.db.countDocuments("todos", {});
      const completedCount = await this.db.countDocuments("todos", {
        completed: true,
      });

      this.todoStats.totalTodos = totalCount;
      this.todoStats.completedTodos = completedCount;

      logger.debug(
        `📊 Todo 통계 로드됨: 전체 ${totalCount}, 완료 ${completedCount}`
      );
    } catch (error) {
      logger.warn("⚠️ Todo 통계 로드 실패:", error.message);
    }
  }

  // 🎯 액션 등록 (BaseModule 확장)
  registerActions() {
    super.registerActions(); // 기본 액션 유지

    // Todo 전용 액션들 - 모든 메서드가 존재하는지 확인 후 등록
    const actions = [
      ["list", this.showTodoList],
      ["add", this.startTodoAdd],
      // ["complete", this.completeTodo],
      // ["delete", this.deleteTodo],
      ["clear_completed", this.clearCompletedTodos],
      ["clear_all", this.clearAllTodos],
      ["search", this.startTodoSearch],
      ["export", this.exportTodos],
      ["import", this.startTodoImport],
      ["stats", this.showTodoStats],
      ["cancel", this.handleCancel],
    ];

    actions.forEach(([actionName, method]) => {
      if (typeof method === "function") {
        this.actionMap.set(actionName, method.bind(this));
      } else {
        logger.warn(`⚠️ 메서드 없음: ${actionName}`);
      }
    });

    logger.debug("🎯 TodoModule 액션 등록 완료");
  }

  // ✅ 표준 메시지 처리 구현
  async onHandleMessage(bot, msg) {
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
        const searchMatch = text.match(
          /^\/?(todo|할일)\s+(검색|search)\s+(.+)$/i
        );
        if (searchMatch) {
          const keyword = searchMatch[3].trim();
          return await this._searchTodoQuick(
            bot,
            chatId,
            userId,
            keyword,
            userName
          );
        }
      }

      return false; // 다른 모듈이 처리하도록
    } catch (error) {
      logger.error("TodoModule 메시지 처리 오류:", error);
      return false;
    }
  }

  // ✅ 표준 콜백 처리 구현
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
      logger.debug(`📞 Todo 콜백 처리: ${subAction}`);

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
      logger.warn(`⚠️ 알 수 없는 Todo 액션: ${subAction}`);
      return false;
    } catch (error) {
      logger.error("Todo 콜백 처리 오류:", error);
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
      const todos = await this._getTodos(userId);

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
      logger.error("할일 목록 조회 실패:", error);
      await this._sendErrorMessage(
        bot,
        chatId,
        "할일 목록을 불러올 수 없습니다."
      );
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
      const date = this._formatDate(todo.createdAt);

      todoText += `${status} **${actualIndex}.** ${todo.text}\n`;
      todoText += `   📅 ${date}`;

      if (todo.completed && todo.completedAt) {
        const completedDate = this._formatDate(todo.completedAt);
        todoText += ` → ✅ ${completedDate}`;
      }

      todoText += "\n\n";

      // 각 할일에 대한 액션 버튼
      const todoButtons = [];

      if (!todo.completed) {
        todoButtons.push({
          text: `✅ ${actualIndex}번 완료`,
          callback_data: `todo_complete_${todo._id || todo.id}`,
        });
      }

      todoButtons.push({
        text: `🗑️ ${actualIndex}번 삭제`,
        callback_data: `todo_delete_${todo._id || todo.id}`,
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

  // 🔍 할일 검색 시작
  async startTodoSearch(bot, chatId, messageId, userId, userName) {
    const message = `🔍 **할일 검색**\n\n${userName}님, 검색할 키워드를 입력해주세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_cancel" }]],
    };

    this.setUserState(userId, {
      action: "waiting_search_input",
      step: "search",
    });

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // 📊 할일 통계 표시
  async showTodoStats(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this._getTodos(userId);
      const completed = todos.filter((t) => t.completed).length;
      const pending = todos.length - completed;
      const completionRate =
        todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;

      const statsText = `📊 **${userName}님의 할일 통계**

📝 **전체 할일:** ${todos.length}개
✅ **완료된 할일:** ${completed}개
⭕ **진행중인 할일:** ${pending}개
📈 **완료율:** ${completionRate}%

${this._getProgressBar(completionRate)}`;

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

  // ✅ 완료된 할일 정리
  async clearCompletedTodos(bot, chatId, messageId, userId, userName) {
    try {
      const deletedCount = await this._deleteCompletedTodos(userId);

      if (deletedCount === 0) {
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

      const successMessage = `✅ **정리 완료!**\n\n${deletedCount}개의 완료된 할일을 정리했습니다.`;

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

  // 🗑️ 모든 할일 삭제
  async clearAllTodos(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this._getTodos(userId);

      if (todos.length === 0) {
        const message = `📝 **삭제할 할일이 없습니다.**`;

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

      const confirmMessage = `⚠️ **정말로 모든 할일을 삭제하시겠습니까?**\n\n총 ${todos.length}개의 할일이 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ 네, 삭제합니다",
              callback_data: "todo_confirm_clear_all",
            },
            { text: "❌ 아니오", callback_data: "todo_menu" },
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
      logger.error("할일 삭제 확인 실패:", error);
      await this._sendErrorMessage(bot, chatId, "삭제 확인에 실패했습니다.");
    }
  }

  // 📤 할일 내보내기
  async exportTodos(bot, chatId, messageId, userId, userName) {
    try {
      const todos = await this._getTodos(userId);

      if (todos.length === 0) {
        const message = `📝 **내보낼 할일이 없습니다.**`;

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

      const exportText = todos
        .map((todo) => {
          const status = todo.completed ? "✅" : "⭕";
          const date = this._formatDate(todo.createdAt);
          return `${status} ${todo.text} (${date})`;
        })
        .join("\n");

      const message = `📤 **할일 내보내기**\n\n총 ${todos.length}개의 할일을 내보냅니다:\n\n${exportText}`;

      const keyboard = {
        inline_keyboard: [
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
      logger.error("할일 내보내기 실패:", error);
      await this._sendErrorMessage(bot, chatId, "내보내기에 실패했습니다.");
    }
  }

  // 📥 할일 가져오기 시작
  async startTodoImport(bot, chatId, messageId, userId, userName) {
    const message = `📥 **할일 가져오기**\n\n${userName}님, 가져올 할일들을 한 줄에 하나씩 입력해주세요.\n\n예시:\n프레젠테이션 준비\n보고서 작성\n회의 참석`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo_cancel" }]],
    };

    this.setUserState(userId, {
      action: "waiting_import_input",
      step: "import",
    });

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // ❌ 취소 처리
  async handleCancel(bot, chatId, messageId, userId, userName) {
    this.clearUserState(userId);

    const message = `❌ **작업이 취소되었습니다.**`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]],
    };

    return await this._editOrSendMessage(
      bot,
      chatId,
      messageId,
      message,
      keyboard
    );
  }

  // ================== 내부 메서드들 ==================

  // 💾 할일 가져오기 (DB 또는 메모리)
  async _getTodos(userId) {
    if (this.memoryTodos) {
      // 메모리 모드
      const userTodos = this.memoryTodos.get(userId) || [];
      return userTodos.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // DB 모드
    if (this.db && this.db.find) {
      return await this.db.find(
        "todos",
        { userId },
        { sort: { createdAt: -1 } }
      );
    }

    return [];
  }

  // 💾 할일 저장
  async _saveTodo(todo) {
    if (this.memoryTodos) {
      // 메모리 모드
      const userTodos = this.memoryTodos.get(todo.userId) || [];
      todo.id = Date.now().toString(); // 간단한 ID 생성
      userTodos.push(todo);
      this.memoryTodos.set(todo.userId, userTodos);
      return todo;
    }

    // DB 모드
    if (this.db && this.db.insertOne) {
      return await this.db.insertOne("todos", todo);
    }

    throw new Error("저장소가 초기화되지 않았습니다.");
  }

  // 🗑️ 완료된 할일들 삭제
  async _deleteCompletedTodos(userId) {
    if (this.memoryTodos) {
      // 메모리 모드
      const userTodos = this.memoryTodos.get(userId) || [];
      const completedCount = userTodos.filter((t) => t.completed).length;
      const remaining = userTodos.filter((t) => !t.completed);
      this.memoryTodos.set(userId, remaining);
      return completedCount;
    }

    // DB 모드
    if (this.db && this.db.deleteMany) {
      const result = await this.db.deleteMany("todos", {
        userId,
        completed: true,
      });
      return result.deletedCount || 0;
    }

    return 0;
  }

  // 📅 날짜 포맷팅
  _formatDate(date) {
    try {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return "날짜 없음";
    }
  }

  // 📊 진행률 바
  _getProgressBar(percentage) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty) + ` ${percentage}%`;
  }

  // 📨 메시지 편집 또는 전송
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

      logger.warn("메시지 편집 실패, 새 메시지 전송:", error.message);
      return await bot.sendMessage(chatId, text, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    }
  }

  // ❌ 에러 메시지 전송
  async _sendErrorMessage(bot, chatId, message) {
    try {
      await bot.sendMessage(chatId, `❌ ${message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        },
      });
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // 🔄 사용자 상태 관리
  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  getUserState(userId) {
    return this.userStates.get(userId);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  // 📨 사용자 상태별 메시지 처리
  async _handleUserStateMessage(bot, msg, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    try {
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
          return await this._processSearchInput(
            bot,
            chatId,
            userId,
            text,
            userName
          );

        case "waiting_import_input":
          return await this._processImportInput(
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
    } catch (error) {
      logger.error("사용자 상태 메시지 처리 오류:", error);
      this.clearUserState(userId);
      return false;
    }
  }

  // ✏️ 할일 입력 처리
  async _processTodoInput(bot, chatId, userId, text, userName) {
    try {
      if (text.length > 200) {
        throw new Error("할일 내용이 너무 깁니다. (최대 200자)");
      }

      const newTodo = {
        userId,
        text: text.trim(),
        completed: false,
        createdAt: new Date(),
      };

      await this._saveTodo(newTodo);
      this.todoStats.totalTodos++;
      this.clearUserState(userId);

      const successMessage = `✅ **할일이 추가되었습니다!**\n\n📝 ${text}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo_list" },
            { text: "➕ 또 추가하기", callback_data: "todo_add" },
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
      const errorMessage = `❌ **할일 추가 실패**\n\n${error.message}`;
      await bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      return true;
    }
  }

  // 🔍 검색 입력 처리
  async _processSearchInput(bot, chatId, userId, text, userName) {
    try {
      const keyword = text.trim();
      const todos = await this._getTodos(userId);
      const searchResults = todos.filter((todo) =>
        todo.text.toLowerCase().includes(keyword.toLowerCase())
      );

      this.clearUserState(userId);

      if (searchResults.length === 0) {
        const message = `🔍 **검색 결과 없음**\n\n"${keyword}"에 대한 할일이 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "🔍 다시 검색", callback_data: "todo_search" }],
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
          ],
        };

        await bot.sendMessage(chatId, message, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
        return true;
      }

      let resultText = `🔍 **검색 결과** (${searchResults.length}개)\n\n키워드: "${keyword}"\n\n`;

      searchResults.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const date = this._formatDate(todo.createdAt);
        resultText += `${status} **${index + 1}.** ${
          todo.text
        }\n📅 ${date}\n\n`;
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
      const errorMessage = `❌ **검색 실패**\n\n검색 중 오류가 발생했습니다.`;
      await bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      return true;
    }
  }

  // 📥 가져오기 입력 처리
  async _processImportInput(bot, chatId, userId, text, userName) {
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
        text: line.substring(0, 200), // 길이 제한
        completed: false,
        createdAt: new Date(),
      }));

      // 저장
      for (const todo of todos) {
        await this._saveTodo(todo);
      }

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
      await bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      return true;
    }
  }

  // 📊 모듈 상태 반환 (BaseModule 확장)
  getStatus() {
    return {
      ...super.getStatus(),
      todoStats: this.todoStats,
      searchStates: this.searchStates.size,
      memoryMode: !!this.memoryTodos,
    };
  }

  // 🧹 정리 작업 (BaseModule 확장)
  async onCleanup() {
    this.searchStates.clear();
    if (this.memoryTodos) {
      this.memoryTodos.clear();
    }
    logger.debug("📝 TodoModule 정리 완료");
  }
}

module.exports = TodoModule;
