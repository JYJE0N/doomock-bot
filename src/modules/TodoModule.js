// src/modules/TodoModule.js - v3.0.1 ValidationManager 연동 정리판
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📝 할일 관리 모듈 v3.0.1 - ValidationManager 중앙화
 *
 * ✅ 변경 사항:
 * - ValidationHelper 개별 호출 제거
 * - ValidationManager 중앙 집중식 검증 사용
 * - 중복 검증 로직 완전 제거
 * - 스키마 기반 자동 검증
 * - 성능 최적화 (캐싱)
 *
 * 🎯 핵심 개선:
 * - 일관된 검증 로직
 * - 재사용 가능한 검증 규칙
 * - 확장성 및 유지보수성 향상
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // ValidationManager 인스턴스 (중앙 검증 시스템)
    this.validationManager = options.validationManager || null;

    // TodoService 인스턴스
    this.todoService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 10,
      autoSave: process.env.TODO_AUTO_SAVE !== "false",
      enableNotifications: process.env.ENABLE_TODO_NOTIFICATIONS !== "false",
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 30000,
      enableCategories: process.env.ENABLE_TODO_CATEGORIES !== "false",
      enablePriorities: process.env.ENABLE_TODO_PRIORITIES !== "false",
      enableDueDates: process.env.ENABLE_TODO_DUE_DATES !== "false",
      ...this.config,
    };

    // 카테고리 정의 (UI 표시용)
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

    // 우선순위 정의 (UI 표시용)
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

    logger.info("📝 TodoModule v3.0.1 생성됨 (ValidationManager 연동)");
  }

  /**
   * 🎯 모듈 초기화 (ValidationManager 연동)
   */
  async onInitialize() {
    try {
      // ValidationManager 확인
      if (!this.validationManager) {
        logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
      }

      // TodoService 초기화
      this.todoService = new TodoService({
        enableCache: this.config.autoSave,
        cacheTimeout: this.config.syncInterval,
      });
      this.todoService.db = this.db;
      await this.todoService.initialize();

      // 데이터 마이그레이션 (필요시)
      await this.todoService.migrateData();

      logger.info("✅ TodoModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
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
      delete: this.deleteTodo,

      // 검색 및 필터
      search: this.startSearch,
      filter: this.showFilter,
      "filter:category": this.filterByCategory,
      "filter:priority": this.filterByPriority,
      "filter:status": this.filterByStatus,

      // 통계 및 분석
      stats: this.showStats,
      progress: this.showProgress,
      "stats:daily": this.showDailyStats,
      "stats:weekly": this.showWeeklyStats,

      // 설정
      settings: this.showSettings,
      "settings:page_size": this.changePageSize,
      "settings:notifications": this.toggleNotifications,

      // 유틸리티
      clear: this.clearCompleted,
      export: this.exportTodos,
      import: this.importTodos,
    });
  }

  /**
   * 💬 메시지 처리 (ValidationManager 활용)
   */
  async onHandleMessage(bot, msg) {
    const userId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!text || !userId) return;

    try {
      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      if (userState?.action === "adding_todo") {
        await this.handleTodoInput(bot, chatId, userId, text);
        return;
      }

      if (userState?.action === "searching") {
        await this.handleSearchInput(bot, chatId, userId, text);
        return;
      }

      if (userState?.action === "editing_todo") {
        await this.handleEditInput(bot, chatId, userId, text);
        return;
      }

      // 빠른 할일 추가 패턴 체크 ("할일: 내용" 형식)
      const quickAddMatch = text.match(/^(?:할일|todo):\s*(.+)$/i);
      if (quickAddMatch) {
        await this.handleQuickAdd(bot, chatId, userId, quickAddMatch[1]);
        return;
      }

      // 기본 메뉴 표시
      if (["/todo", "할일", "todo"].includes(text.toLowerCase())) {
        await this.showMenu(bot, { message: { chat: { id: chatId } } });
        return;
      }
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 실패:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 메시지 처리 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🎯 할일 입력 처리 (ValidationManager 활용) =====

  /**
   * 📝 할일 입력 처리 (중앙 검증 시스템 사용)
   */
  async handleTodoInput(bot, chatId, userId, text) {
    try {
      // 취소 처리
      if (this.isCancelCommand(text)) {
        return await this.handleCancel(bot, chatId, userId);
      }

      // 🛡️ 중앙 검증 시스템 사용
      const validationResult = await this.validateTodoData({
        text: text,
        category: "general",
        priority: 3,
      });

      if (!validationResult.isValid) {
        await this.sendValidationError(bot, chatId, validationResult.errors);
        return;
      }

      // 검증된 데이터 사용
      const validatedData = validationResult.data;

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        ...validatedData,
        source: "manual",
      });

      // 상태 초기화
      this.clearUserState(userId);

      if (result.success) {
        await this.sendSuccessMessage(bot, chatId, validatedData.text);
      } else {
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      logger.error("❌ 할일 입력 처리 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 추가 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ⚡ 빠른 할일 추가 처리
   */
  async handleQuickAdd(bot, chatId, userId, todoText) {
    try {
      // 🛡️ 중앙 검증 시스템 사용
      const validationResult = await this.validateTodoData({
        text: todoText,
        category: "general",
        priority: 3,
      });

      if (!validationResult.isValid) {
        await this.sendValidationError(bot, chatId, validationResult.errors);
        return;
      }

      const validatedData = validationResult.data;

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        ...validatedData,
        source: "quick",
      });

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `⚡ **빠른 추가 완료**\n\n"**${validatedData.text}**"이(가) 추가되었습니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 목록 보기", callback_data: "todo:list" }],
                [{ text: "➕ 더 추가하기", callback_data: "todo:add" }],
              ],
            },
          }
        );
      } else {
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      logger.error("❌ 빠른 할일 추가 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "빠른 추가 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔍 검색 입력 처리
   */
  async handleSearchInput(bot, chatId, userId, query) {
    try {
      // 취소 처리
      if (this.isCancelCommand(query)) {
        return await this.handleCancel(bot, chatId, userId);
      }

      // 🛡️ 중앙 검증 시스템 사용 (검색 스키마)
      const validationResult = await this.validateSearchData({
        query: query,
        filters: {},
      });

      if (!validationResult.isValid) {
        await this.sendValidationError(bot, chatId, validationResult.errors);
        return;
      }

      const validatedQuery = validationResult.data.query;

      // 검색 수행
      const searchResult = await this.todoService.searchTodos(
        userId,
        validatedQuery
      );

      // 상태 초기화
      this.clearUserState(userId);

      // 결과 표시
      await this.displaySearchResults(
        bot,
        chatId,
        validatedQuery,
        searchResult
      );
    } catch (error) {
      logger.error("❌ 검색 처리 실패:", error);
      await this.sendErrorMessage(bot, chatId, "검색 중 오류가 발생했습니다.");
    }
  }

  /**
   * ✏️ 수정 입력 처리
   */
  async handleEditInput(bot, chatId, userId, newText) {
    try {
      const userState = this.getUserState(userId);
      const todoId = userState?.data?.todoId;

      if (!todoId) {
        throw new Error("수정할 할일 ID가 없습니다.");
      }

      // 취소 처리
      if (this.isCancelCommand(newText)) {
        return await this.handleCancel(bot, chatId, userId);
      }

      // 🛡️ 중앙 검증 시스템 사용
      const validationResult = await this.validateTodoData({
        text: newText,
      });

      if (!validationResult.isValid) {
        await this.sendValidationError(bot, chatId, validationResult.errors);
        return;
      }

      const validatedText = validationResult.data.text;

      // 할일 수정
      const result = await this.todoService.updateTodo(userId, todoId, {
        text: validatedText,
      });

      // 상태 초기화
      this.clearUserState(userId);

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `✅ **수정 완료**\n\n"**${validatedText}**"로 변경되었습니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 목록 보기", callback_data: "todo:list" }],
                [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
              ],
            },
          }
        );
      } else {
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      logger.error("❌ 할일 수정 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "할일 수정 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🛡️ 검증 관련 메서드들 (ValidationManager 활용) =====

  /**
   * 🛡️ 할일 데이터 검증 (중앙 시스템 활용)
   */
  async validateTodoData(data) {
    if (this.validationManager) {
      return await this.validationManager.validate("todo", data);
    }

    // ValidationManager가 없는 경우 기본 검증
    return this.performBasicTodoValidation(data);
  }

  /**
   * 🛡️ 검색 데이터 검증
   */
  async validateSearchData(data) {
    if (this.validationManager) {
      return await this.validationManager.validate("search", data);
    }

    // 기본 검증
    return this.performBasicSearchValidation(data);
  }

  /**
   * 🛡️ 설정 데이터 검증
   */
  async validateSettingsData(data) {
    if (this.validationManager) {
      return await this.validationManager.validate("settings", data);
    }

    // 기본 검증
    return this.performBasicSettingsValidation(data);
  }

  /**
   * 🛡️ 기본 할일 검증 (fallback)
   */
  performBasicTodoValidation(data) {
    const errors = {};

    // 텍스트 검증
    if (!data.text || typeof data.text !== "string") {
      errors.text = ["할일 내용을 입력해주세요."];
    } else {
      const trimmed = data.text.trim();
      if (trimmed.length === 0) {
        errors.text = ["할일 내용을 입력해주세요."];
      } else if (trimmed.length > 500) {
        errors.text = ["할일 내용은 500자 이내로 입력해주세요."];
      }
    }

    // 카테고리 검증
    if (
      data.category &&
      !this.categories.find((c) => c.key === data.category)
    ) {
      errors.category = ["올바른 카테고리를 선택해주세요."];
    }

    // 우선순위 검증
    if (data.priority !== undefined) {
      const priority = parseInt(data.priority);
      if (isNaN(priority) || priority < 1 || priority > 5) {
        errors.priority = ["우선순위는 1~5 사이의 값이어야 합니다."];
      }
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      data: isValid
        ? {
            text: data.text?.trim(),
            category: data.category || "general",
            priority: data.priority || 3,
            description: data.description?.trim() || "",
            tags: data.tags || [],
            dueDate: data.dueDate || null,
          }
        : {},
    };
  }

  /**
   * 🛡️ 기본 검색 검증 (fallback)
   */
  performBasicSearchValidation(data) {
    const errors = {};

    if (!data.query || typeof data.query !== "string") {
      errors.query = ["검색어를 입력해주세요."];
    } else {
      const trimmed = data.query.trim();
      if (trimmed.length < 2) {
        errors.query = ["검색어는 2자 이상 입력해주세요."];
      } else if (trimmed.length > 100) {
        errors.query = ["검색어는 100자 이내로 입력해주세요."];
      }
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      data: isValid
        ? {
            query: data.query.trim(),
            filters: data.filters || {},
          }
        : {},
    };
  }

  /**
   * 🛡️ 기본 설정 검증 (fallback)
   */
  performBasicSettingsValidation(data) {
    const errors = {};

    if (data.pageSize !== undefined) {
      const pageSize = parseInt(data.pageSize);
      if (isNaN(pageSize) || pageSize < 5 || pageSize > 50) {
        errors.pageSize = ["페이지 크기는 5~50 사이의 값이어야 합니다."];
      }
    }

    const isValid = Object.keys(errors).length === 0;

    return {
      isValid,
      errors,
      data: isValid ? data : {},
    };
  }

  // ===== 🎯 UI 메시지 헬퍼 메서드들 =====

  /**
   * 📤 검증 오류 메시지 전송
   */
  async sendValidationError(bot, chatId, errors) {
    let errorMessage = "❌ **입력 오류**\n\n";

    // 에러 메시지 포맷팅
    if (typeof errors === "object" && errors !== null) {
      for (const [field, fieldErrors] of Object.entries(errors)) {
        if (Array.isArray(fieldErrors)) {
          errorMessage += `• ${fieldErrors.join("\n• ")}\n`;
        }
      }
    } else if (Array.isArray(errors)) {
      errorMessage += `• ${errors.join("\n• ")}`;
    } else {
      errorMessage += `• ${errors}`;
    }

    errorMessage += "\n다시 입력해주세요.";

    await this.sendMessage(bot, chatId, errorMessage);
  }

  /**
   * ✅ 성공 메시지 전송
   */
  async sendSuccessMessage(bot, chatId, todoText) {
    const successText = `✅ **할일 추가 완료**

"**${todoText}**"이(가) 성공적으로 추가되었습니다.

무엇을 하시겠습니까?`;

    await this.sendMessage(bot, chatId, successText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 더 추가하기", callback_data: "todo:add" },
          ],
          [
            { text: "⚡ 빠른 추가", callback_data: "todo:add:quick" },
            { text: "🔙 메뉴로", callback_data: "todo:menu" },
          ],
        ],
      },
    });
  }

  /**
   * ❌ 에러 메시지 전송
   */
  async sendErrorMessage(bot, chatId, errorMessage) {
    await this.sendMessage(bot, chatId, `❌ ${errorMessage}`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 메뉴로", callback_data: "todo:menu" }]],
      },
    });
  }

  /**
   * 🚫 취소 명령어 체크
   */
  isCancelCommand(text) {
    const cancelCommands = ["/cancel", "취소", "cancel", "ㅊ"];
    return cancelCommands.includes(text.toLowerCase().trim());
  }

  /**
   * 🚫 취소 처리
   */
  async handleCancel(bot, chatId, userId) {
    this.clearUserState(userId);
    await this.sendMessage(bot, chatId, "❌ 작업이 취소되었습니다.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 메뉴로", callback_data: "todo:menu" }]],
      },
    });
  }

  // ===== 🎯 기존 메서드들 (간소화) =====

  /**
   * 📋 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    if (!chatId) return;

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

    if (callbackQuery.message?.message_id) {
      await this.editMessage(
        bot,
        chatId,
        callbackQuery.message.message_id,
        menuText,
        {
          reply_markup: keyboard,
        }
      );
    } else {
      await this.sendMessage(bot, chatId, menuText, { reply_markup: keyboard });
    }
  }

  /**
   * ➕ 할일 추가 시작
   */
  async startAddTodo(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, { action: "adding_todo" });

    const addText = `➕ **새 할일 추가**

할일 내용을 입력해주세요.

💡 **팁**: 간단하고 구체적으로 작성하세요!

📝 **예시**
• "프로젝트 기획서 작성"
• "운동 30분하기"
• "마트에서 우유 사기"

⚠️ 취소하려면 \`/cancel\` 입력`;

    await this.editMessage(bot, chatId, messageId, addText, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚫 취소", callback_data: "todo:menu" }]],
      },
    });
  }

  /**
   * 📋 할일 목록 표시
   */
  async showTodoList(bot, callbackQuery, subAction, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const page = parseInt(params?.page) || 1;
      const filter = params?.filter || "all";

      // 할일 목록 조회
      const result = await this.todoService.getTodoList(userId, {
        page,
        pageSize: this.config.pageSize,
        filter,
      });

      if (!result.success) {
        await this.sendErrorMessage(bot, chatId, result.error);
        return;
      }

      const { todos, pagination } = result.data;

      if (todos.length === 0) {
        await this.showEmptyTodoList(bot, chatId, messageId);
        return;
      }

      // 목록 텍스트 생성
      let listText = `📋 **할일 목록** (${pagination.total}개)\n\n`;

      todos.forEach((todo, index) => {
        const checkbox = todo.completed ? "✅" : "☐";
        const categoryEmoji = this.getCategoryEmoji(todo.category);
        const priorityEmoji = this.getPriorityEmoji(todo.priority);

        listText += `${checkbox} ${categoryEmoji}${priorityEmoji} ${todo.text}\n`;

        if (todo.dueDate) {
          const dueDateStr = TimeHelper.formatDate(todo.dueDate);
          listText += `   📅 마감: ${dueDateStr}\n`;
        }
        listText += "\n";
      });

      // 페이지네이션 정보
      if (pagination.totalPages > 1) {
        listText += `📄 페이지 ${pagination.currentPage}/${pagination.totalPages}`;
      }

      // 키보드 생성
      const keyboard = this.createTodoListKeyboard(todos, pagination, filter);

      await this.editMessage(bot, chatId, messageId, listText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 할일 목록 표시 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "목록을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const stats = await this.todoService.getUserStats(userId);

      if (!stats.success) {
        await this.sendErrorMessage(bot, chatId, stats.error);
        return;
      }

      const data = stats.data;
      const completionRate =
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

      const progressBar = this.createProgressBar(completionRate);

      const statsText = `📊 **할일 통계**

${progressBar} **${completionRate}%** 완료

📈 **전체 현황**
• 총 할일: **${data.total}**개
• 완료: **${data.completed}**개 ✅
• 진행중: **${data.pending}**개 ⏳
• 오늘 추가: **${data.todayAdded}**개 ➕

🏷️ **카테고리별**
${this.formatCategoryStats(data.byCategory)}

⭐ **우선순위별**
${this.formatPriorityStats(data.byPriority)}

📅 **이번 주 활동**
• 완료한 할일: **${data.weeklyCompleted}**개
• 평균 완료율: **${data.weeklyCompletionRate}%**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📈 상세 통계", callback_data: "todo:stats:detailed" },
            { text: "📊 주간 리포트", callback_data: "todo:stats:weekly" },
          ],
          [
            { text: "🧹 완료된 할일 정리", callback_data: "todo:clear" },
            { text: "🔙 메뉴로", callback_data: "todo:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 통계 표시 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "통계를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ⚡ 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, subAction, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const todoId = params?.id;
      if (!todoId) {
        throw new Error("할일 ID가 없습니다.");
      }

      const result = await this.todoService.toggleTodo(userId, todoId);

      if (result.success) {
        const status = result.data.completed ? "완료" : "미완료";
        const emoji = result.data.completed ? "✅" : "⏳";

        // 성공 알림 (임시 메시지)
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: `${emoji} ${status}로 변경되었습니다!`,
          show_alert: false,
        });

        // 목록 새로고침
        await this.showTodoList(bot, callbackQuery, subAction, params);
      } else {
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      logger.error("❌ 할일 토글 실패:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "상태 변경 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const todoId = params?.id;
      if (!todoId) {
        throw new Error("할일 ID가 없습니다.");
      }

      // 확인 단계 처리
      if (!params?.confirmed) {
        const todo = await this.todoService.getTodoById(userId, todoId);
        if (!todo.success) {
          await this.sendErrorMessage(bot, chatId, "할일을 찾을 수 없습니다.");
          return;
        }

        const confirmText = `🗑️ **할일 삭제 확인**

정말로 이 할일을 삭제하시겠습니까?

**"${todo.data.text}"**

⚠️ 삭제된 할일은 복구할 수 없습니다.`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ 삭제",
                callback_data: `todo:delete:id=${todoId}&confirmed=true`,
              },
              { text: "❌ 취소", callback_data: "todo:list" },
            ],
          ],
        };

        await this.editMessage(bot, chatId, messageId, confirmText, {
          reply_markup: keyboard,
        });
        return;
      }

      // 실제 삭제 수행
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (result.success) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "🗑️ 할일이 삭제되었습니다.",
          show_alert: false,
        });

        // 목록으로 돌아가기
        await this.showTodoList(bot, callbackQuery);
      } else {
        await this.sendErrorMessage(bot, chatId, result.error);
      }
    } catch (error) {
      logger.error("❌ 할일 삭제 실패:", error);
      await this.sendErrorMessage(bot, chatId, "삭제 중 오류가 발생했습니다.");
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📋 빈 할일 목록 표시
   */
  async showEmptyTodoList(bot, chatId, messageId) {
    const emptyText = `📋 **할일 목록**

아직 등록된 할일이 없습니다.

첫 번째 할일을 추가해보세요! 🚀`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "➕ 할일 추가", callback_data: "todo:add" },
          { text: "⚡ 빠른 추가", callback_data: "todo:add:quick" },
        ],
        [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, emptyText, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⌨️ 할일 목록 키보드 생성
   */
  createTodoListKeyboard(todos, pagination, filter) {
    const keyboard = { inline_keyboard: [] };

    // 할일 항목들 (첫 5개만 빠른 액션)
    const quickActionTodos = todos.slice(0, 5);
    quickActionTodos.forEach((todo, index) => {
      const toggleText = todo.completed ? "✅➡️☐" : "☐➡️✅";
      const toggleCallback = `todo:toggle:id=${todo._id}`;
      const deleteCallback = `todo:delete:id=${todo._id}`;

      keyboard.inline_keyboard.push([
        { text: `${index + 1}. ${toggleText}`, callback_data: toggleCallback },
        { text: "🗑️", callback_data: deleteCallback },
      ]);
    });

    // 페이지네이션
    if (pagination.totalPages > 1) {
      const paginationRow = [];

      if (pagination.currentPage > 1) {
        paginationRow.push({
          text: "◀️ 이전",
          callback_data: `todo:list:page=${
            pagination.currentPage - 1
          }&filter=${filter}`,
        });
      }

      paginationRow.push({
        text: `${pagination.currentPage}/${pagination.totalPages}`,
        callback_data: "noop",
      });

      if (pagination.currentPage < pagination.totalPages) {
        paginationRow.push({
          text: "다음 ▶️",
          callback_data: `todo:list:page=${
            pagination.currentPage + 1
          }&filter=${filter}`,
        });
      }

      keyboard.inline_keyboard.push(paginationRow);
    }

    // 필터 및 액션 버튼들
    keyboard.inline_keyboard.push([
      { text: "🔍 검색", callback_data: "todo:search" },
      { text: "🏷️ 필터", callback_data: "todo:filter" },
    ]);

    keyboard.inline_keyboard.push([
      { text: "➕ 새 할일", callback_data: "todo:add" },
      { text: "🔙 메뉴로", callback_data: "todo:menu" },
    ]);

    return keyboard;
  }

  /**
   * 🏷️ 카테고리 이모지 가져오기
   */
  getCategoryEmoji(categoryKey) {
    const category = this.categories.find((c) => c.key === categoryKey);
    return category ? category.emoji : "📋";
  }

  /**
   * ⭐ 우선순위 이모지 가져오기
   */
  getPriorityEmoji(priority) {
    const priorityObj = this.priorities.find((p) => p.level === priority);
    return priorityObj ? priorityObj.emoji : "🟡";
  }

  /**
   * 📊 진행률 바 생성
   */
  createProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return "▓".repeat(filled) + "░".repeat(empty);
  }

  /**
   * 🏷️ 카테고리별 통계 포맷팅
   */
  formatCategoryStats(categoryStats) {
    return Object.entries(categoryStats)
      .map(([key, count]) => {
        const category = this.categories.find((c) => c.key === key);
        const emoji = category ? category.emoji : "📋";
        const name = category ? category.name : key;
        return `${emoji} ${name}: ${count}개`;
      })
      .join("\n");
  }

  /**
   * ⭐ 우선순위별 통계 포맷팅
   */
  formatPriorityStats(priorityStats) {
    return Object.entries(priorityStats)
      .sort(([a], [b]) => parseInt(b) - parseInt(a)) // 높은 우선순위부터
      .map(([level, count]) => {
        const priority = this.priorities.find(
          (p) => p.level === parseInt(level)
        );
        const emoji = priority ? priority.emoji : "🟡";
        const name = priority ? priority.name : `레벨 ${level}`;
        return `${emoji} ${name}: ${count}개`;
      })
      .join("\n");
  }

  /**
   * 🔍 검색 결과 표시
   */
  async displaySearchResults(bot, chatId, query, searchResult) {
    if (!searchResult.success) {
      await this.sendErrorMessage(bot, chatId, searchResult.error);
      return;
    }

    const { todos, total } = searchResult.data;

    if (todos.length === 0) {
      await this.sendMessage(
        bot,
        chatId,
        `🔍 **검색 결과**\n\n"${query}"에 대한 검색 결과가 없습니다.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        }
      );
      return;
    }

    let resultText = `🔍 **검색 결과** (${total}개)\n\n검색어: "${query}"\n\n`;

    todos.forEach((todo, index) => {
      const checkbox = todo.completed ? "✅" : "☐";
      const categoryEmoji = this.getCategoryEmoji(todo.category);
      resultText += `${checkbox} ${categoryEmoji} ${todo.text}\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔍 다시 검색", callback_data: "todo:search" },
          { text: "📋 전체 목록", callback_data: "todo:list" },
        ],
        [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
      ],
    };

    await this.sendMessage(bot, chatId, resultText, { reply_markup: keyboard });
  }

  /**
   * 🔍 검색 시작
   */
  async startSearch(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, { action: "searching" });

    const searchText = `🔍 **할일 검색**

검색할 키워드를 입력해주세요.

💡 **검색 팁**
• 할일 내용의 일부만 입력해도 됩니다
• 2자 이상 입력해주세요
• 대소문자 구분하지 않습니다

⚠️ 취소하려면 \`/cancel\` 입력`;

    await this.editMessage(bot, chatId, messageId, searchText, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚫 취소", callback_data: "todo:menu" }]],
      },
    });
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery) {
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
• **빠른 추가**: "할일: 내용" 형식으로 즉시 추가

**🔧 ValidationManager 연동**
• 자동 입력 검증으로 데이터 품질 보장
• 중복 검증 로직 제거로 성능 향상
• 일관된 오류 메시지 제공`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📖 상세 가이드", callback_data: "todo:guide" },
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

  /**
   * 🧹 정리 작업 (onCleanup 구현)
   */
  async onCleanup() {
    try {
      // TodoService 정리
      if (this.todoService && this.todoService.cleanup) {
        await this.todoService.cleanup();
      }

      // 사용자 상태 정리
      this.clearAllUserStates();

      logger.debug("📝 TodoModule 정리 완료");
    } catch (error) {
      logger.error("📝 TodoModule 정리 오류:", error);
    }
  }
}

module.exports = TodoModule;
