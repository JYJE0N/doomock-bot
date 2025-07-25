// src/modules/TodoModule.js - ServiceBuilder 연동 리팩토링 v3.0.1 (수정됨)
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");
const ValidationManager = require("../utils/ValidationHelper"); // ✅ 직접 import

/**
 * 📝 TodoModule v3.0.1 - ServiceBuilder 연동 리팩토링 (의존성 수정)
 *
 * 🎯 수정 사항:
 * - 존재하지 않는 ValidationService/NotificationService 의존성 제거
 * - ValidationManager 직접 사용 (utils에서 import)
 * - 필수 서비스는 TodoService만 유지
 * - 안전한 초기화 로직 적용
 * - 에러 발생 시에도 기본 기능 제공
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      serviceBuilder: options.serviceBuilder, // ServiceBuilder 주입
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스들 (ServiceBuilder로 요청)
    this.todoService = null;

    // ✅ ValidationManager 직접 생성 (서비스가 아님)
    this.validationManager = new ValidationManager();

    // Railway 환경변수 기반 설정
    this.config = {
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 10,
      maxTodos: parseInt(process.env.MAX_TODOS_PER_USER) || 100,
      enableNotifications: process.env.TODO_ENABLE_NOTIFICATIONS === "true",
      autoSave: process.env.TODO_AUTO_SAVE === "true",
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 300000,
      enableSearch: process.env.TODO_ENABLE_SEARCH !== "false",
      enableCategories: process.env.TODO_ENABLE_CATEGORIES !== "false",
      ...this.config,
    };

    // 📋 상수 정의
    this.constants = {
      CATEGORIES: ["일반", "업무", "개인", "중요", "긴급"],
      PRIORITIES: [1, 2, 3, 4, 5],
      MAX_TEXT_LENGTH: 500,
      MAX_DESCRIPTION_LENGTH: 1000,
      SEARCH_MIN_LENGTH: 2,
    };

    // 🎯 사용자 상태 관리 (추가 기능)
    this.addStates = new Map(); // 할일 추가 상태
    this.editStates = new Map(); // 할일 편집 상태
    this.searchStates = new Map(); // 검색 상태

    logger.info(
      "📝 TodoModule v3.0.1 생성됨 (ServiceBuilder 연동, 의존성 수정)"
    );
  }

  /**
   * 🎯 모듈 초기화 (ServiceBuilder 활용, 안전한 초기화)
   */
  async onInitialize() {
    try {
      logger.info("📝 TodoModule 초기화 시작 (ServiceBuilder 활용)...");

      // 🔧 필수 서비스 요청 (TodoService만)
      this.todoService = await this.requireService("todo");

      if (!this.todoService) {
        throw new Error("TodoService 초기화 실패");
      }

      // ✅ ValidationManager는 이미 생성되어 있음 (utils에서 직접 사용)
      logger.info("✅ ValidationManager 준비됨 (내장 검증 시스템)");

      // 📋 액션 설정
      this.setupActions();

      logger.success("✅ TodoModule 초기화 완료");
      return true;
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);

      // 🛡️ 안전 모드: 기본 기능이라도 제공
      logger.warn("⚠️ 안전 모드로 TodoModule 부분 초기화 시도...");

      try {
        // 최소한의 액션이라도 설정
        this.setupBasicActions();
        logger.warn("⚠️ TodoModule 부분 초기화됨 (제한된 기능)");
        return false; // 부분 초기화 성공
      } catch (safetyError) {
        logger.error("❌ TodoModule 안전 모드 초기화도 실패:", safetyError);
        throw error; // 완전 실패
      }
    }
  }

  /**
   * 🎯 액션 설정 (기본 기능)
   */
  setupActions() {
    this.registerActions({
      // 📋 메인 메뉴
      menu: this.handleMenuAction.bind(this),

      // ➕ 할일 관리
      add: this.handleAddAction.bind(this),
      list: this.handleListAction.bind(this),
      view: this.handleViewAction.bind(this),
      edit: this.handleEditAction.bind(this),
      delete: this.handleDeleteAction.bind(this),

      // ✅ 완료 관리
      complete: this.handleCompleteAction.bind(this),
      uncomplete: this.handleUncompleteAction.bind(this),

      // 📊 카테고리/필터
      category: this.handleCategoryAction.bind(this),
      filter: this.handleFilterAction.bind(this),

      // 🔍 검색
      search: this.handleSearchAction.bind(this),

      // ⚙️ 설정
      settings: this.handleSettingsAction.bind(this),
    });

    logger.debug("📝 TodoModule 액션 등록 완료");
  }

  /**
   * 🛡️ 안전 모드용 기본 액션 설정
   */
  setupBasicActions() {
    this.registerActions({
      menu: this.handleErrorMenuAction.bind(this),
      error: this.handleErrorAction.bind(this),
    });

    logger.debug("🛡️ TodoModule 기본 액션 등록 완료 (안전 모드)");
  }

  /**
   * 📬 메시지 핸들러 (onHandleMessage 구현)
   */
  async onHandleMessage(bot, msg) {
    try {
      const { text, from } = msg;

      // 사용자 상태별 메시지 처리
      if (this.addStates.has(from.id)) {
        return await this.handleAddTodoMessage(bot, msg);
      }

      if (this.editStates.has(from.id)) {
        return await this.handleEditTodoMessage(bot, msg);
      }

      if (this.searchStates.has(from.id)) {
        return await this.handleSearchMessage(bot, msg);
      }

      // 빠른 할일 추가 패턴 감지
      if (this.isQuickAddPattern(text)) {
        return await this.handleQuickAdd(bot, msg);
      }

      return false; // 처리하지 않음
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 실패:", error);
      return false;
    }
  }

  // ===== 🎯 액션 핸들러들 =====

  /**
   * 📋 메뉴 액션
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const chatId = callbackQuery.message.chat.id;

      // TodoService 상태 확인
      if (!this.todoService) {
        return await this.handleErrorMenuAction(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      const menuText = `📝 **할일 관리** v3.0.1

🎯 **현재 상태:**
• 할일 서비스: ${this.todoService ? "✅ 연결됨" : "❌ 비연결"}
• 검증 시스템: ✅ 활성화
• 데이터베이스: ${this.todoService?.getStatus?.()?.isConnected ? "✅" : "❌"}

📋 **주요 기능:**
• 할일 추가/수정/삭제
• 카테고리별 분류
• 우선순위 설정
• 완료 상태 관리
• 검색 및 필터링

**💡 빠른 사용법:**
• \`할일: 내용\` - 빠른 할일 추가
• \`[카테고리] 할일 내용 !우선순위\` - 상세 추가

버튼을 클릭해서 더 많은 기능을 사용하세요.`;

      await this.sendMessage(bot, chatId, menuText);
      return true;
    } catch (error) {
      logger.error("❌ 할일 메뉴 액션 실패:", error);
      return await this.handleErrorAction(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    }
  }

  /**
   * 🛡️ 에러 상황용 메뉴 액션
   */
  async handleErrorMenuAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;

      const errorMenuText = `📝 **할일 관리** (제한 모드)

❌ **서비스 상태:**
• 할일 서비스: 연결 실패
• 일부 기능을 사용할 수 없습니다

🔧 **가능한 작업:**
• 시스템 상태 확인
• 에러 신고
• 다른 모듈 이용

⚠️ 관리자에게 문의하거나 잠시 후 다시 시도해주세요.`;

      await this.sendMessage(bot, chatId, errorMenuText);
      return true;
    } catch (error) {
      logger.error("❌ 에러 메뉴 액션도 실패:", error);
      return false;
    }
  }

  /**
   * ➕ 할일 추가 액션
   */
  async handleAddAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      if (!this.todoService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;

      // 사용자 상태 설정
      this.addStates.set(userId, {
        step: "text",
        data: {},
        startTime: Date.now(),
      });

      await this.sendMessage(
        bot,
        chatId,
        "➕ **새 할일 추가**\n\n" +
          "할일 내용을 입력해주세요:\n\n" +
          "**💡 고급 형식:**\n" +
          "• `[카테고리] 할일 내용 !우선순위`\n" +
          "• 예: `[업무] 보고서 작성 !5`\n\n" +
          "취소하려면 `/cancel`을 입력하세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 할일 추가 액션 실패:", error);
      return false;
    }
  }

  /**
   * 📋 할일 목록 액션
   */
  async handleListAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      if (!this.todoService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;

      // 페이지 파라미터
      const page = parseInt(params?.page) || 1;
      const filter = params?.filter || "all";

      // 할일 목록 조회
      const result = await this.todoService.getUserTodos(userId, {
        page,
        limit: this.config.pageSize,
        filter,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (!result.success) {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
        return true;
      }

      const { todos, pagination } = result.data;

      if (todos.length === 0) {
        await this.sendMessage(
          bot,
          chatId,
          "📋 **할일 목록이 비어있습니다**\n\n" +
            "➕ 새로운 할일을 추가해보세요!\n" +
            "`할일: 내용` 형태로 빠르게 추가할 수 있습니다."
        );
        return true;
      }

      // 목록 포맷팅
      let listText = `📋 **할일 목록** (${pagination.total}개)\n\n`;

      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const priority = "⭐".repeat(todo.priority);
        const category = todo.category || "일반";

        listText += `${status} **${todo.text}**\n`;
        listText += `   📁 ${category} ${priority}\n`;
        listText += `   🕐 ${TimeHelper.format(todo.createdAt, "short")}\n\n`;
      });

      // 페이지네이션 정보
      if (pagination.totalPages > 1) {
        listText += `📄 페이지 ${pagination.currentPage}/${pagination.totalPages}`;
      }

      await this.sendMessage(bot, chatId, listText);
      return true;
    } catch (error) {
      logger.error("❌ 할일 목록 액션 실패:", error);
      return false;
    }
  }

  // ===== 📬 메시지 핸들러들 =====

  /**
   * 할일 추가 메시지 처리
   */
  async handleAddTodoMessage(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
        from,
      } = msg;

      if (text === "/cancel") {
        this.clearUserState(from.id);
        await this.sendMessage(bot, chatId, "✅ 할일 추가가 취소되었습니다.");
        return true;
      }

      // 텍스트 파싱
      const parsedTodo = this.parseAddTodoText(text);

      // ValidationManager로 검증
      const validationResult = await this.validationManager.validate(
        "todo",
        parsedTodo
      );

      if (!validationResult.isValid) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ ${validationResult.errors.join(", ")}`
        );
        return true;
      }

      // TodoService로 할일 추가
      const addResult = await this.todoService.addTodo(from.id, parsedTodo);

      if (!addResult.success) {
        await this.sendMessage(bot, chatId, `❌ ${addResult.error}`);
        return true;
      }

      const todo = addResult.data;
      this.clearUserState(from.id);

      await this.sendMessage(
        bot,
        chatId,
        `✅ **할일이 추가되었습니다!**\n\n` +
          `📝 ${todo.text}\n` +
          `📁 카테고리: ${todo.category}\n` +
          `⭐ 우선순위: ${todo.priority}단계` +
          (todo.dueDate
            ? `\n📅 마감일: ${TimeHelper.format(todo.dueDate, "short")}`
            : "")
      );

      return true;
    } catch (error) {
      logger.error("❌ 할일 추가 메시지 처리 실패:", error);
      await this.sendMessage(
        bot,
        msg.chat.id,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  /**
   * 빠른 할일 추가 패턴 감지
   */
  isQuickAddPattern(text) {
    if (!text || typeof text !== "string") return false;

    // "할일:" 패턴
    if (text.startsWith("할일:") && text.length > 4) return true;

    // "[카테고리] 내용" 패턴
    if (/^\[.+\]\s+.+/.test(text)) return true;

    return false;
  }

  /**
   * 빠른 할일 추가 처리
   */
  async handleQuickAdd(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
        from,
      } = msg;

      if (!this.todoService) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 할일 서비스를 사용할 수 없습니다."
        );
        return true;
      }

      // 텍스트 파싱
      const parsedTodo = this.parseAddTodoText(text);

      // 검증
      const validationResult = await this.validationManager.validate(
        "todo",
        parsedTodo
      );

      if (!validationResult.isValid) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ ${validationResult.errors.join(", ")}`
        );
        return true;
      }

      // 할일 추가
      const addResult = await this.todoService.addTodo(from.id, parsedTodo);

      if (!addResult.success) {
        await this.sendMessage(bot, chatId, `❌ ${addResult.error}`);
        return true;
      }

      const todo = addResult.data;

      await this.sendMessage(
        bot,
        chatId,
        `✅ **빠른 할일 추가 완료!**\n\n` +
          `📝 ${todo.text}\n` +
          `📁 ${todo.category} ⭐${todo.priority}단계`
      );

      return true;
    } catch (error) {
      logger.error("❌ 빠른 할일 추가 실패:", error);
      await this.sendMessage(
        bot,
        msg.chat.id,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 할일 텍스트 파싱
   */
  parseAddTodoText(text) {
    // "할일:" 제거
    let cleanText = text.replace(/^할일:\s*/, "").trim();

    const result = {
      text: "",
      category: "일반",
      priority: 3,
      tags: [],
    };

    // [카테고리] 파싱
    const categoryMatch = cleanText.match(/^\[(.+?)\]\s*/);
    if (categoryMatch) {
      result.category = categoryMatch[1].trim();
      cleanText = cleanText.replace(categoryMatch[0], "");
    }

    // !우선순위 파싱
    const priorityMatch = cleanText.match(/\s*!([1-5])\s*$/);
    if (priorityMatch) {
      result.priority = parseInt(priorityMatch[1]);
      cleanText = cleanText.replace(priorityMatch[0], "");
    }

    // #태그 파싱
    const tagMatches = cleanText.match(/#\w+/g);
    if (tagMatches) {
      result.tags = tagMatches.map((tag) => tag.substring(1));
      cleanText = cleanText.replace(/#\w+/g, "").trim();
    }

    result.text = cleanText.trim();
    return result;
  }

  /**
   * 서비스 사용 불가 에러 처리
   */
  async handleServiceUnavailableError(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;

      await this.sendMessage(
        bot,
        chatId,
        "❌ **서비스 일시 사용 불가**\n\n" +
          "할일 관리 서비스에 일시적인 문제가 발생했습니다.\n" +
          "잠시 후 다시 시도해주세요.\n\n" +
          "문제가 지속되면 관리자에게 문의하세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 서비스 사용 불가 에러 처리 실패:", error);
      return false;
    }
  }

  /**
   * 사용자 상태 정리
   */
  clearUserState(userId) {
    this.addStates.delete(userId);
    this.editStates.delete(userId);
    this.searchStates.delete(userId);
  }

  /**
   * 일반 에러 처리
   */
  async handleErrorAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;

      await this.sendMessage(
        bot,
        chatId,
        "❌ **작업 처리 실패**\n\n" +
          "요청하신 작업을 처리할 수 없습니다.\n" +
          "잠시 후 다시 시도해주세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 에러 액션 처리도 실패:", error);
      return false;
    }
  }

  // 기타 액션 핸들러들은 간단한 스텁으로 구현
  async handleViewAction() {
    return await this.handleNotImplementedAction();
  }
  async handleEditAction() {
    return await this.handleNotImplementedAction();
  }
  async handleDeleteAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCompleteAction() {
    return await this.handleNotImplementedAction();
  }
  async handleUncompleteAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCategoryAction() {
    return await this.handleNotImplementedAction();
  }
  async handleFilterAction() {
    return await this.handleNotImplementedAction();
  }
  async handleSearchAction() {
    return await this.handleNotImplementedAction();
  }
  async handleSettingsAction() {
    return await this.handleNotImplementedAction();
  }
  async handleEditTodoMessage() {
    return false;
  }
  async handleSearchMessage() {
    return false;
  }

  async handleNotImplementedAction() {
    // 미구현 기능 처리 로직
    return true;
  }

  /**
   * 📊 상태 조회 (ServiceBuilder 활용)
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      todoService: {
        connected: !!this.todoService,
        status: this.todoService?.getStatus?.() || "unknown",
      },
      validationManager: {
        connected: !!this.validationManager,
        status: this.validationManager?.getStatus?.() || "unknown",
      },
      userStates: {
        adding: this.addStates.size,
        editing: this.editStates.size,
        searching: this.searchStates.size,
      },
      config: this.config,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      // 상위 클래스 정리
      await super.cleanup();

      // 모듈별 상태 정리
      this.addStates.clear();
      this.editStates.clear();
      this.searchStates.clear();

      // ValidationManager 정리
      if (this.validationManager && this.validationManager.cleanup) {
        this.validationManager.cleanup();
      }

      // 서비스 참조 정리 (ServiceBuilder가 관리하므로 직접 정리하지 않음)
      this.todoService = null;
      this.validationManager = null;

      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
