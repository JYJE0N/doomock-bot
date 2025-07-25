// src/modules/TodoModule.js - 완전 표준화 리팩토링
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");

/**
 * 📝 할일 관리 모듈 - 완전 표준화
 * - BaseModule 상속
 * - 표준 매개변수 체계 완벽 준수
 * - actionMap 방식 사용
 * - Railway 환경 최적화
 * - 완벽한 에러 처리
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // TodoService 인스턴스
    this.todoService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 10,
      maxTextLength: parseInt(process.env.TODO_MAX_TEXT_LENGTH) || 500,
      autoSave: process.env.TODO_AUTO_SAVE !== "false",
      enableNotifications: process.env.ENABLE_TODO_NOTIFICATIONS !== "false",
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 30000,
      enableCategories: process.env.ENABLE_TODO_CATEGORIES !== "false",
      enablePriorities: process.env.ENABLE_TODO_PRIORITIES !== "false",
      enableDueDates: process.env.ENABLE_TODO_DUE_DATES !== "false",
      ...this.config,
    };

    // 카테고리 정의
    this.categories = [
      { key: "work", name: "업무", emoji: "💼" },
      { key: "personal", name: "개인", emoji: "👤" },
      { key: "study", name: "학습", emoji: "📚" },
      { key: "health", name: "건강", emoji: "💪" },
      { key: "shopping", name: "쇼핑", emoji: "🛒" },
      { key: "family", name: "가족", emoji: "👨‍👩‍👧‍👦" },
      { key: "hobby", name: "취미", emoji: "🎨" },
      { key: "general", name: "일반", emoji: "📋" },
    ];

    // 우선순위 정의
    this.priorities = [
      { level: 1, name: "매우 낮음", emoji: "⚪", color: "#CCCCCC" },
      { level: 2, name: "낮음", emoji: "🟢", color: "#4CAF50" },
      { level: 3, name: "보통", emoji: "🟡", color: "#FFC107" },
      { level: 4, name: "높음", emoji: "🟠", color: "#FF9800" },
      { level: 5, name: "매우 높음", emoji: "🔴", color: "#F44336" },
    ];

    // 빠른 추가 템플릿
    this.quickTemplates = [
      "회의 참석",
      "이메일 확인",
      "보고서 작성",
      "운동하기",
      "장보기",
      "독서",
      "청소",
      "공부하기",
    ];

    logger.info("📝 TodoModule (v2.0) 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // TodoService 초기화
      this.todoService = new TodoService({
        enableCache: this.config.autoSave,
        cacheTimeout: this.config.syncInterval,
      });
      this.todoService.db = this.db;
      await this.todoService.initialize();

      // 데이터 마이그레이션 (필요시)
      await this.todoService.migrateData();

      logger.info("✅ TodoService 연결 및 초기화 완료");
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
      // 메인 메뉴
      menu: this.showMenu,
      help: this.showHelp,

      // 할일 목록 및 관리
      list: this.showTodoList,
      add: this.startAddTodo,
      "add:quick": this.showQuickAdd,
      "add:template": this.addFromTemplate,
      edit: this.startEditTodo,
      toggle: this.toggleTodo,
      delete: this.confirmDeleteTodo,
      "delete:confirm": this.executeTodoDelete,

      // 검색 및 필터링
      search: this.startSearch,
      filter: this.showFilter,
      "filter:category": this.filterByCategory,
      "filter:priority": this.filterByPriority,
      "filter:status": this.filterByStatus,
      "filter:clear": this.clearFilter,

      // 통계 및 분석
      stats: this.showStats,
      "stats:detailed": this.showDetailedStats,
      "stats:weekly": this.showWeeklyStats,
      "stats:monthly": this.showMonthlyStats,

      // 정리 및 관리
      clear: this.showClearMenu,
      "clear:completed": this.clearCompleted,
      "clear:all": this.confirmClearAll,
      "clear:old": this.clearOldTodos,

      // 설정
      settings: this.showSettings,
      "settings:categories": this.manageCategories,
      "settings:notifications": this.toggleNotifications,
      "settings:autosave": this.toggleAutoSave,

      // 페이지네이션
      page: this.changePage,
      "page:first": this.goToFirstPage,
      "page:last": this.goToLastPage,

      // 우선순위 관리
      priority: this.changePriority,
      "priority:set": this.setPriority,

      // 카테고리 관리
      category: this.changeCategory,
      "category:set": this.setCategory,

      // 마감일 관리
      duedate: this.setDueDate,
      "duedate:clear": this.clearDueDate,

      // 익스포트/임포트
      export: this.exportTodos,
      import: this.startImport,
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

    // 입력 대기 상태별 처리
    if (userState?.action === "waiting_todo_input") {
      await this.handleTodoInput(bot, chatId, userId, text);
      return true;
    }

    if (userState?.action === "waiting_edit_input") {
      await this.handleEditInput(bot, chatId, userId, text, userState.todoId);
      return true;
    }

    if (userState?.action === "waiting_search_input") {
      await this.handleSearchInput(bot, chatId, userId, text);
      return true;
    }

    if (userState?.action === "waiting_category_input") {
      await this.handleCategoryInput(bot, chatId, userId, text);
      return true;
    }

    // 빠른 할일 추가 (특정 패턴)
    if (text.startsWith("할일:") || text.startsWith("todo:")) {
      const todoText = text.substring(text.indexOf(":") + 1).trim();
      if (todoText) {
        await this.quickAddTodo(bot, chatId, userId, todoText);
        return true;
      }
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
   * 할일 메인 메뉴 표시
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
    const userId = from.id;

    try {
      // 사용자 통계 조회
      const userStats = await this.todoService.getUserStats(userId);

      // 진행률 계산
      const progressInfo = this.calculateProgress(
        userStats.completedTodos || 0,
        userStats.totalTodos || 0
      );

      const menuText = `📝 **할일 관리**

안녕하세요, **${userName}**님! 👋

**📊 현재 상황**
• 📋 전체 할일: ${userStats.totalTodos || 0}개
• ✅ 완료: ${userStats.completedTodos || 0}개
• ⏳ 미완료: ${userStats.pendingTodos || 0}개
• 📈 완료율: ${progressInfo.percentage}%

${progressInfo.progressBar}

**⏰ 최근 활동**
• 마지막 추가: ${userStats.lastAdded || "없음"}
• 마지막 완료: ${userStats.lastCompleted || "없음"}

원하는 기능을 선택해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "⚡ 빠른 추가", callback_data: "todo:add:quick" },
            { text: "🔍 검색", callback_data: "todo:search" },
          ],
          [
            { text: "📊 통계", callback_data: "todo:stats" },
            { text: "🎛️ 필터", callback_data: "todo:filter" },
          ],
          [
            { text: "🗑️ 정리", callback_data: "todo:clear" },
            { text: "⚙️ 설정", callback_data: "todo:settings" },
          ],
          [
            { text: "❓ 도움말", callback_data: "todo:help" },
            { text: "🔙 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 메뉴 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "메뉴를 표시하는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 할일 목록 표시 (개선된 버전)
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
      // 페이지 및 필터 파라미터 파싱
      const page = parseInt(params[0]) || 1;
      const filterType = params[1] || null;
      const filterValue = params[2] || null;

      // 필터 조건 구성
      let filter = {};
      if (filterType && filterValue) {
        switch (filterType) {
          case "category":
            filter.category = filterValue;
            break;
          case "priority":
            filter.priority = parseInt(filterValue);
            break;
          case "status":
            filter.completed = filterValue === "completed";
            break;
        }
      }

      // 할일 목록 조회
      const result = await this.todoService.getTodosList(userId, {
        page: page,
        limit: this.config.pageSize,
        filter: filter,
        sortBy: "priority",
        sortOrder: -1, // 높은 우선순위부터
      });

      if (!result.success) {
        await this.sendError(
          bot,
          callbackQuery,
          "할일 목록을 불러오는 중 오류가 발생했습니다."
        );
        return;
      }

      const {
        todos,
        totalCount,
        totalPages,
        currentPage,
        hasNextPage,
        hasPrevPage,
      } = result.data;

      // 목록 텍스트 구성
      let listText = `📋 **할일 목록** (${totalCount}개)

**📄 페이지 ${currentPage}/${totalPages}**`;

      // 필터 정보 표시
      if (filterType) {
        const filterName = this.getFilterDisplayName(filterType, filterValue);
        listText += `\n🎛️ **필터**: ${filterName}`;
      }

      listText += `\n\n`;

      if (todos.length === 0) {
        if (filterType) {
          listText += "해당 조건에 맞는 할일이 없습니다.";
        } else {
          listText += `등록된 할일이 없습니다.
➕ 버튼을 눌러 새 할일을 추가해보세요!`;
        }
      } else {
        // 할일 목록 생성
        todos.forEach((todo, index) => {
          const itemNumber =
            (currentPage - 1) * this.config.pageSize + index + 1;
          const status = todo.completed ? "✅" : "⬜";
          const priority = this.getPriorityEmoji(todo.priority || 3);
          const category = this.getCategoryEmoji(todo.category || "general");
          const createdDate = TimeHelper.formatDate(todo.createdAt, "MM/DD");

          listText += `${status} **${itemNumber}.** ${todo.text}\n`;
          listText += `   ${priority} ${category} | 📅 ${createdDate}`;

          // 마감일 표시
          if (todo.dueDate) {
            const dueDate = TimeHelper.formatDate(todo.dueDate, "MM/DD");
            const isOverdue = new Date(todo.dueDate) < new Date();
            const dueDateEmoji = isOverdue ? "🚨" : "📅";
            listText += ` | ${dueDateEmoji} ${dueDate}`;
          }

          listText += `\n\n`;
        });
      }

      // 키보드 생성
      const keyboard = this.buildListKeyboard(todos, currentPage, totalPages, {
        filterType,
        filterValue,
        hasItems: todos.length > 0,
      });

      await this.editMessage(bot, chatId, messageId, listText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 목록 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "목록을 표시하는 중 오류가 발생했습니다."
      );
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

      if (todoCount >= this.config.maxTodosPerUser) {
        const limitText = `❌ **할일 추가 제한**

최대 ${this.config.maxTodosPerUser}개까지만 등록 가능합니다.
현재: ${todoCount}개

완료된 할일을 정리하거나 불필요한 할일을 삭제해주세요.`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🗑️ 완료된 할일 삭제",
                callback_data: "todo:clear:completed",
              },
              { text: "🧹 오래된 할일 정리", callback_data: "todo:clear:old" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, limitText, {
          reply_markup: keyboard,
        });
        return;
      }

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "waiting_todo_input",
        messageId: messageId,
        step: "text",
      });

      const inputText = `➕ **할일 추가**

새로운 할일을 입력해주세요.

**📝 입력 규칙:**
• 최대 ${this.config.maxTextLength}자
• 이모지 사용 가능
• 줄바꿈 지원

**💡 고급 기능:**
• \`할일: 내용\` - 빠른 추가
• 카테고리와 우선순위는 추가 후 설정 가능

**📊 현재 상황:** ${todoCount}/${this.config.maxTodosPerUser}개

/cancel 명령으로 취소할 수 있습니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⚡ 빠른 추가", callback_data: "todo:add:quick" },
            { text: "📋 템플릿", callback_data: "todo:add:template" },
          ],
          [{ text: "❌ 취소", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, inputText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 추가 시작 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "할일 추가를 시작하는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 빠른 할일 추가 메뉴
   */
  async showQuickAdd(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const quickText = `⚡ **빠른 할일 추가**

자주 사용하는 할일 템플릿을 선택하세요:`;

    const keyboard = { inline_keyboard: [] };

    // 템플릿 버튼들 (2개씩 배치)
    for (let i = 0; i < this.quickTemplates.length; i += 2) {
      const row = [];

      const template1 = this.quickTemplates[i];
      row.push({
        text: template1,
        callback_data: `todo:add:template:${encodeURIComponent(template1)}`,
      });

      if (i + 1 < this.quickTemplates.length) {
        const template2 = this.quickTemplates[i + 1];
        row.push({
          text: template2,
          callback_data: `todo:add:template:${encodeURIComponent(template2)}`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 하단 메뉴
    keyboard.inline_keyboard.push([
      { text: "✏️ 직접 입력", callback_data: "todo:add" },
      { text: "🔙 뒤로", callback_data: "todo:menu" },
    ]);

    await this.editMessage(bot, chatId, messageId, quickText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 템플릿으로 할일 추가
   */
  async addFromTemplate(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const templateText = decodeURIComponent(params[0]);

      if (!templateText) {
        await this.sendError(bot, callbackQuery, "템플릿을 찾을 수 없습니다.");
        return;
      }

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        text: templateText,
        category: "general",
        priority: 3,
        source: "template",
      });

      if (result.success) {
        const successText = `✅ **할일 추가 완료**

"**${templateText}**"이(가) 추가되었습니다.

추가 설정을 하시겠습니까?`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🏷️ 카테고리 설정",
                callback_data: `todo:category:${result.todo._id}`,
              },
              {
                text: "⭐ 우선순위 설정",
                callback_data: `todo:priority:${result.todo._id}`,
              },
            ],
            [
              {
                text: "📅 마감일 설정",
                callback_data: `todo:duedate:${result.todo._id}`,
              },
            ],
            [
              { text: "📋 목록 보기", callback_data: "todo:list" },
              { text: "➕ 계속 추가", callback_data: "todo:add:quick" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, successText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendError(
          bot,
          callbackQuery,
          result.message || "할일 추가 중 오류가 발생했습니다."
        );
      }
    } catch (error) {
      logger.error("템플릿 할일 추가 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "템플릿 할일 추가 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 할일 토글 (완료/미완료)
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
        const emoji = result.todo.completed ? "🎉" : "📝";

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `${emoji} ${status}로 변경되었습니다!`,
          show_alert: false,
        });

        // 목록 새로고침 (현재 페이지 유지)
        const currentPage = this.extractPageFromCallback(callbackQuery) || 1;
        await this.showTodoList(
          bot,
          callbackQuery,
          [currentPage.toString()],
          moduleManager
        );
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
   * 할일 삭제 확인
   */
  async confirmDeleteTodo(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    const todoId = params[0];

    if (!todoId) {
      await this.sendError(bot, callbackQuery, "잘못된 요청입니다.");
      return;
    }

    try {
      // 할일 정보 조회
      const todo = await this.todoService.getTodoById(userId, todoId);

      if (!todo) {
        await this.sendError(bot, callbackQuery, "할일을 찾을 수 없습니다.");
        return;
      }

      const confirmText = `🗑️ **할일 삭제 확인**

정말로 이 할일을 삭제하시겠습니까?

**삭제할 할일:**
"**${todo.text}**"

**⚠️ 이 작업은 되돌릴 수 없습니다!**`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🗑️ 네, 삭제합니다",
              callback_data: `todo:delete:confirm:${todoId}`,
            },
          ],
          [{ text: "❌ 취소", callback_data: "todo:list" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, confirmText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("할일 삭제 확인 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "삭제 확인 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 할일 삭제 실행
   */
  async executeTodoDelete(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;
    const todoId = params[0];

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "🗑️ 할일이 삭제되었습니다.",
          show_alert: false,
        });

        // 목록으로 돌아가기
        await this.showTodoList(bot, callbackQuery, [], moduleManager);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 삭제 실패: " + (result.message || "알 수 없는 오류"),
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("할일 삭제 실행 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 삭제 중 오류가 발생했습니다.",
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
      from: { id: userId },
    } = callbackQuery;

    try {
      // 통계 데이터 조회
      const stats = await this.todoService.getDetailedStats(userId);

      // 진행률 계산
      const progressInfo = this.calculateProgress(
        stats.completedTodos,
        stats.totalTodos
      );

      // 카테고리별 통계
      const categoryStats = this.formatCategoryStats(
        stats.categoryBreakdown || {}
      );

      // 우선순위별 통계
      const priorityStats = this.formatPriorityStats(
        stats.priorityBreakdown || {}
      );

      const statsText = `📊 **할일 통계**

**📈 전체 현황**
• 📋 총 할일: ${stats.totalTodos || 0}개
• ✅ 완료: ${stats.completedTodos || 0}개
• ⏳ 미완료: ${stats.pendingTodos || 0}개
• 📈 완료율: ${progressInfo.percentage}%

${progressInfo.progressBar}

**📅 기간별 현황**
• 오늘 추가: ${stats.todayAdded || 0}개
• 이번 주 완료: ${stats.weekCompleted || 0}개
• 이번 달 완료: ${stats.monthCompleted || 0}개

**🏷️ 카테고리별**
${categoryStats}

**⭐ 우선순위별**
${priorityStats}

**⏰ 활동 정보**
• 첫 할일: ${stats.firstTodoDate || "없음"}
• 마지막 활동: ${stats.lastActivity || "없음"}
• 평균 완료 시간: ${stats.averageCompletionTime || "측정 중"}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📈 상세 분석", callback_data: "todo:stats:detailed" },
            { text: "📅 주간 리포트", callback_data: "todo:stats:weekly" },
          ],
          [
            { text: "📋 월간 리포트", callback_data: "todo:stats:monthly" },
            { text: "📤 내보내기", callback_data: "todo:export" },
          ],
          [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("통계 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "통계를 표시하는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **할일 관리 도움말**

**🎯 주요 기능**
• **할일 추가**: 새로운 할일을 등록
• **완료 처리**: 체크박스로 간편 완료
• **검색**: 키워드로 할일 찾기
• **카테고리**: 할일을 분류하여 관리
• **우선순위**: 중요도에 따른 정렬
• **마감일**: 날짜 기반 알림
• **통계**: 진행 상황 분석

**⌨️ 사용법**
• \`/todo\` - 할일 메뉴 열기
• \`할일: 내용\` - 빠른 추가
• 버튼 클릭으로 쉬운 조작
• \`/cancel\` - 현재 작업 취소

**💡 고급 팁**
• **카테고리 활용**: 업무/개인 등으로 분류
• **우선순위 설정**: 중요한 일부터 처리
• **정기 정리**: 완료된 할일은 주기적으로 삭제
• **템플릿 활용**: 반복되는 할일은 빠른 추가 메뉴 사용

**🎨 특별 기능**
• **진행률 표시**: 시각적 진행 상황
• **빠른 템플릿**: 자주 쓰는 할일 패턴
• **스마트 필터**: 조건별 할일 조회
• **상세 통계**: 생산성 분석

**🆘 문제 해결**
• 할일이 너무 많으면 정리 메뉴 활용
• 버튼이 응답하지 않으면 \`/cancel\` 입력
• 오류 발생 시 메인 메뉴로 돌아가기
• 지속적인 문제는 관리자 문의`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📖 사용 가이드", callback_data: "todo:guide" },
          { text: "🎯 팁 더보기", callback_data: "todo:tips" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "todo:settings" },
          { text: "🔙 메뉴로", callback_data: "todo:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🛠️ 입력 처리 메서드들 =====

  /**
   * 할일 입력 처리
   */
  async handleTodoInput(bot, chatId, userId, text) {
    try {
      // 취소 처리
      if (text.toLowerCase() === "/cancel" || text.trim() === "취소") {
        this.clearUserState(userId);
        await this.sendMessage(bot, chatId, "❌ 할일 추가가 취소되었습니다.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        });
        return;
      }

      // 입력 검증
      const validation = ValidationHelper.validateText(text, {
        maxLength: this.config.maxTextLength,
        required: true,
        minLength: 1,
      });

      if (!validation.isValid) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ ${validation.errors[0]}

다시 입력해주세요.`
        );
        return;
      }

      const cleanText = text.trim();

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        text: cleanText,
        category: "general",
        priority: 3,
        source: "manual",
      });

      // 상태 초기화
      this.clearUserState(userId);

      if (result.success) {
        const successText = `✅ **할일 추가 완료**

"**${cleanText}**"이(가) 성공적으로 추가되었습니다.

추가 설정을 하시겠습니까?`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🏷️ 카테고리",
                callback_data: `todo:category:${result.todo._id}`,
              },
              {
                text: "⭐ 우선순위",
                callback_data: `todo:priority:${result.todo._id}`,
              },
            ],
            [
              {
                text: "📅 마감일",
                callback_data: `todo:duedate:${result.todo._id}`,
              },
            ],
            [
              { text: "📋 목록 보기", callback_data: "todo:list" },
              { text: "➕ 계속 추가", callback_data: "todo:add" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, successText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 할일 추가 실패: ${result.message || "알 수 없는 오류"}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 다시 시도", callback_data: "todo:add" }],
                [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("할일 입력 처리 오류:", error);
      this.clearUserState(userId);

      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        },
      });
    }
  }

  /**
   * 검색 입력 처리
   */
  async handleSearchInput(bot, chatId, userId, text) {
    try {
      // 취소 처리
      if (text.toLowerCase() === "/cancel" || text.trim() === "취소") {
        this.clearUserState(userId);
        await this.sendMessage(bot, chatId, "❌ 검색이 취소되었습니다.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        });
        return;
      }

      const searchTerm = text.trim();

      if (searchTerm.length < 2) {
        await this.sendMessage(
          bot,
          chatId,
          "🔍 검색어는 2글자 이상 입력해주세요."
        );
        return;
      }

      // 검색 실행
      const result = await this.todoService.searchTodos(userId, searchTerm);

      // 상태 초기화
      this.clearUserState(userId);

      if (result.success) {
        const { todos } = result.data;

        let searchText = `🔍 **검색 결과**

검색어: "**${searchTerm}**"
결과: **${todos.length}개** 할일\n\n`;

        if (todos.length === 0) {
          searchText += "검색 결과가 없습니다.";
        } else {
          todos.slice(0, 10).forEach((todo, index) => {
            const status = todo.completed ? "✅" : "⬜";
            const priority = this.getPriorityEmoji(todo.priority || 3);
            const category = this.getCategoryEmoji(todo.category || "general");

            // 검색어 하이라이트
            const highlightedText = this.highlightSearchTerm(
              todo.text,
              searchTerm
            );

            searchText += `${status} **${index + 1}.** ${highlightedText}\n`;
            searchText += `   ${priority} ${category}\n\n`;
          });

          if (todos.length > 10) {
            searchText += `... 외 **${todos.length - 10}개** 항목`;
          }
        }

        const keyboard = {
          inline_keyboard: [
            [
              { text: "🔍 다시 검색", callback_data: "todo:search" },
              { text: "📋 전체 목록", callback_data: "todo:list" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, searchText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, "❌ 검색 중 오류가 발생했습니다.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        });
      }
    } catch (error) {
      logger.error("검색 입력 처리 오류:", error);
      this.clearUserState(userId);

      await this.sendMessage(
        bot,
        chatId,
        "❌ 검색 처리 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        }
      );
    }
  }

  /**
   * 빠른 할일 추가
   */
  async quickAddTodo(bot, chatId, userId, todoText) {
    try {
      const result = await this.todoService.addTodo(userId, {
        text: todoText,
        category: "general",
        priority: 3,
        source: "quick",
      });

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `⚡ **빠른 추가 완료**\n\n"**${todoText}**"이(가) 추가되었습니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📋 목록 보기", callback_data: "todo:list" },
                  { text: "➕ 계속 추가", callback_data: "todo:add" },
                ],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 빠른 추가 실패: " + result.message
        );
      }
    } catch (error) {
      logger.error("빠른 할일 추가 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 빠른 추가 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 목록 키보드 생성 (개선된 버전)
   */
  buildListKeyboard(todos, page, totalPages, options = {}) {
    const { filterType, filterValue, hasItems } = options;
    const keyboard = { inline_keyboard: [] };

    if (hasItems) {
      // 할일 액션 버튼들 (항목별로 한 줄씩)
      todos.forEach((todo, index) => {
        const itemNumber = (page - 1) * this.config.pageSize + index + 1;

        const row = [
          {
            text: `${todo.completed ? "✅" : "⬜"} ${itemNumber}`,
            callback_data: `todo:toggle:${todo._id}`,
          },
          {
            text: "✏️",
            callback_data: `todo:edit:${todo._id}`,
          },
          {
            text: "🗑️",
            callback_data: `todo:delete:${todo._id}`,
          },
        ];

        // 우선순위나 카테고리 버튼 추가 (공간이 있으면)
        if (this.config.enablePriorities) {
          row.push({
            text: this.getPriorityEmoji(todo.priority || 3),
            callback_data: `todo:priority:${todo._id}`,
          });
        }

        keyboard.inline_keyboard.push(row);
      });

      // 구분선 추가
      if (todos.length > 0) {
        keyboard.inline_keyboard.push([
          { text: "━━━━━━━━━━━━━━━━━━━━", callback_data: "noop" },
        ]);
      }
    }

    // 페이지네이션 버튼
    if (totalPages > 1) {
      const pageRow = [];

      if (page > 1) {
        pageRow.push({
          text: "⬅️ 이전",
          callback_data: `todo:page:${page - 1}${
            filterType ? `:${filterType}:${filterValue}` : ""
          }`,
        });
      }

      pageRow.push({
        text: `📄 ${page}/${totalPages}`,
        callback_data: "noop",
      });

      if (page < totalPages) {
        pageRow.push({
          text: "다음 ➡️",
          callback_data: `todo:page:${page + 1}${
            filterType ? `:${filterType}:${filterValue}` : ""
          }`,
        });
      }

      keyboard.inline_keyboard.push(pageRow);
    }

    // 액션 버튼들
    const actionRow1 = [
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "🔍 검색", callback_data: "todo:search" },
    ];

    const actionRow2 = [
      { text: "🎛️ 필터", callback_data: "todo:filter" },
      { text: "📊 통계", callback_data: "todo:stats" },
    ];

    keyboard.inline_keyboard.push(actionRow1);
    keyboard.inline_keyboard.push(actionRow2);

    // 필터 해제 버튼 (필터가 적용된 경우)
    if (filterType) {
      keyboard.inline_keyboard.push([
        { text: "🔄 필터 해제", callback_data: "todo:filter:clear" },
        { text: "🔙 메뉴", callback_data: "todo:menu" },
      ]);
    } else {
      keyboard.inline_keyboard.push([
        { text: "🔙 메뉴", callback_data: "todo:menu" },
      ]);
    }

    return keyboard;
  }

  /**
   * 진행률 계산
   */
  calculateProgress(completed, total) {
    if (total === 0) {
      return {
        percentage: 0,
        progressBar: "▱▱▱▱▱▱▱▱▱▱",
        text: "0%",
      };
    }

    const percentage = Math.round((completed / total) * 100);
    const filledBlocks = Math.round((percentage / 100) * 10);
    const emptyBlocks = 10 - filledBlocks;

    const progressBar = "▰".repeat(filledBlocks) + "▱".repeat(emptyBlocks);

    return {
      percentage,
      progressBar,
      text: `${percentage}%`,
    };
  }

  /**
   * 우선순위 이모지 가져오기
   */
  getPriorityEmoji(priority) {
    const priorityInfo = this.priorities.find((p) => p.level === priority);
    return priorityInfo ? priorityInfo.emoji : "🟡";
  }

  /**
   * 카테고리 이모지 가져오기
   */
  getCategoryEmoji(category) {
    const categoryInfo = this.categories.find((c) => c.key === category);
    return categoryInfo ? categoryInfo.emoji : "📋";
  }

  /**
   * 검색어 하이라이트
   */
  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, "**$1**");
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(date, format = "MM/DD HH:mm") {
    if (!date) return "날짜 없음";
    return TimeHelper.formatDate(date, format);
  }

  /**
   * 현재 페이지 추출
   */
  extractPageFromCallback(callbackQuery) {
    // 이전 콜백에서 페이지 정보 추출 로직
    return 1; // 기본값
  }

  /**
   * 필터 표시명 가져오기
   */
  getFilterDisplayName(filterType, filterValue) {
    switch (filterType) {
      case "category":
        const category = this.categories.find((c) => c.key === filterValue);
        return `${category?.emoji || ""} ${category?.name || filterValue}`;
      case "priority":
        const priority = this.priorities.find(
          (p) => p.level === parseInt(filterValue)
        );
        return `${priority?.emoji || ""} ${priority?.name || filterValue}`;
      case "status":
        return filterValue === "completed" ? "✅ 완료됨" : "⏳ 미완료";
      default:
        return filterValue;
    }
  }

  /**
   * 카테고리 통계 포맷팅
   */
  formatCategoryStats(categoryBreakdown) {
    let result = "";
    for (const [category, count] of Object.entries(categoryBreakdown)) {
      const emoji = this.getCategoryEmoji(category);
      const name =
        this.categories.find((c) => c.key === category)?.name || category;
      result += `${emoji} ${name}: ${count}개\n`;
    }
    return result || "• 데이터 없음";
  }

  /**
   * 우선순위 통계 포맷팅
   */
  formatPriorityStats(priorityBreakdown) {
    let result = "";
    for (const [priority, count] of Object.entries(priorityBreakdown)) {
      const emoji = this.getPriorityEmoji(parseInt(priority));
      const name =
        this.priorities.find((p) => p.level === parseInt(priority))?.name ||
        priority;
      result += `${emoji} ${name}: ${count}개\n`;
    }
    return result || "• 데이터 없음";
  }

  /**
   * 할일 메뉴 전송 (명령어용)
   */
  async sendTodoMenu(bot, chatId) {
    const menuText = `📝 **할일 관리**

효율적인 할일 관리로 생산성을 높여보세요!

무엇을 하시겠습니까?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 할일 목록", callback_data: "todo:list" },
          { text: "➕ 할일 추가", callback_data: "todo:add" },
        ],
        [
          { text: "⚡ 빠른 추가", callback_data: "todo:add:quick" },
          { text: "🔍 검색", callback_data: "todo:search" },
        ],
        [
          { text: "📊 통계", callback_data: "todo:stats" },
          { text: "❓ 도움말", callback_data: "todo:help" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, menuText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 정리 작업 (onCleanup 구현)
   */
  async onCleanup() {
    try {
      // TodoService 정리
      if (this.todoService && this.todoService.cleanup) {
        await this.todoService.cleanup();
      }

      logger.debug("📝 TodoModule 정리 완료");
    } catch (error) {
      logger.error("📝 TodoModule 정리 오류:", error);
    }
  }
}

module.exports = TodoModule;
