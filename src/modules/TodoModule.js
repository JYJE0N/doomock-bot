// src/modules/TodoModule.js - ServiceBuilder 연동 리팩토링 v3.0.1
const BaseModule = require("./BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 📝 TodoModule v3.0.1 - ServiceBuilder 연동 리팩토링
 *
 * 🎯 주요 변경사항:
 * - ServiceBuilder를 통한 서비스 요청 시스템
 * - 서비스 직접 생성 제거 (new TodoService() 삭제)
 * - 느슨한 결합 구현
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 * - Railway 환경 최적화
 *
 * 🔧 ServiceBuilder 활용:
 * - this.requireService('todo') - 필수 서비스 요청
 * - this.getService('validation') - 선택적 서비스 요청
 * - 서비스 캐싱 자동 관리
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
    this.validationService = null;

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

    logger.info("📝 TodoModule v3.0.1 생성됨 (ServiceBuilder 연동)");
  }

  /**
   * 🎯 모듈 초기화 (ServiceBuilder 활용)
   */
  async onInitialize() {
    try {
      logger.info("📝 TodoModule 초기화 시작 (ServiceBuilder 활용)...");

      // 🔧 필수 서비스 요청 (실패 시 예외 발생)
      this.todoService = await this.requireService("todo");

      // 🔧 선택적 서비스 요청 (실패해도 계속 진행)
      this.validationService = await this.getService("validation");

      if (!this.validationService) {
        logger.warn(
          "⚠️ ValidationService를 사용할 수 없어 기본 검증만 사용됩니다."
        );
      }

      // 🔧 추가 서비스들 (선택적)
      const additionalServices = await this.getServices(
        ["reminder", "notification"],
        false
      );
      this.reminderService = additionalServices.reminder;
      this.notificationService = additionalServices.notification;

      logger.success("✅ TodoModule 초기화 완료 (ServiceBuilder 연동)");
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
      "add:save": this.saveNewTodo,
      toggle: this.toggleTodo,
      edit: this.startEditTodo,
      "edit:save": this.saveEditedTodo,
      delete: this.confirmDeleteTodo,
      "delete:confirm": this.executeDeleteTodo,

      // 검색 및 필터
      search: this.startSearch,
      "search:execute": this.executeSearch,
      filter: this.showFilter,
      "filter:apply": this.applyFilter,
      "filter:clear": this.clearFilter,

      // 통계 및 분석
      stats: this.showStats,
      analytics: this.showAnalytics,

      // 설정
      settings: this.showSettings,
      "settings:save": this.saveSettings,

      // 유틸리티
      clear: this.clearCompleted,
      backup: this.createBackup,
      import: this.importTodos,

      // 페이지네이션
      page: this.changePage,
      "page:first": this.goToFirstPage,
      "page:last": this.goToLastPage,
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

    try {
      // 명령어 처리
      const command = this.extractCommand(text);

      if (command === "todo" || command === "todos" || text.trim() === "할일") {
        await this.sendTodoMenu(bot, chatId);
        return true;
      }

      // 사용자 상태별 메시지 처리
      const userState = this.getUserState(userId);

      if (userState) {
        switch (userState.state) {
          case "adding_todo":
            return await this.handleAddTodoMessage(bot, msg);

          case "editing_todo":
            return await this.handleEditTodoMessage(bot, msg);

          case "searching":
            return await this.handleSearchMessage(bot, msg);

          default:
            this.clearUserState(userId);
            break;
        }
      }

      // 간단한 할일 추가 처리 (예: "할일: 쇼핑하기")
      if (text.startsWith("할일:") || text.startsWith("todo:")) {
        return await this.handleQuickAddTodo(bot, msg, text);
      }

      return false;
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 메시지 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // ===== 📋 메뉴 액션들 (ServiceBuilder 활용) =====

  /**
   * 📱 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const userName = getUserName(from);

      // 📊 ServiceBuilder를 통해 요청한 서비스로 통계 조회
      const statsResult = await this.todoService.getUserStats(from.id);
      const stats = statsResult.success
        ? statsResult.data
        : { total: 0, completed: 0, pending: 0 };

      const completionRate =
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

      const menuText = `📝 **할일 관리**

안녕하세요, ${userName}님!

📊 **현재 상황**
• 전체 할일: ${stats.total}개
• 완료: ${stats.completed}개
• 대기: ${stats.pending}개
• 완료율: ${completionRate}%

원하는 기능을 선택해주세요.`;

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.editMessage(bot, chatId, messageId, menuText);

      return true;
    } catch (error) {
      logger.error("❌ 할일 메뉴 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 불러올 수 없습니다.");
      return false;
    }
  }

  /**
   * ❓ 도움말 표시
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
• 할일 추가/수정/삭제
• 완료 상태 토글
• 검색 및 필터링
• 통계 및 분석

**⌨️ 사용법**
• \`/todo\` - 할일 메뉴 열기
• \`할일: 내용\` - 빠른 할일 추가
• 버튼 클릭으로 쉬운 조작

**💡 팁**
• 카테고리를 활용해 할일을 체계적으로 관리하세요
• 우선순위를 설정해 중요한 일부터 처리하세요
• 정기적으로 완료된 할일을 정리하세요

**🔧 설정**
• 페이지 크기: ${this.config.pageSize}개
• 최대 할일: ${this.config.maxTodos}개
• 알림: ${this.config.enableNotifications ? "활성" : "비활성"}`;

    // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
    await this.editMessage(bot, chatId, messageId, helpText);

    return true;
  }

  /**
   * 📋 할일 목록 표시
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const page = parseInt(params[0]) || 1;
      const filter = params[1] || "all"; // all, active, completed

      // ServiceBuilder를 통해 요청한 서비스로 목록 조회
      const listResult = await this.todoService.getUserTodoList(from.id, {
        page,
        limit: this.config.pageSize,
        filter,
      });

      if (!listResult.success) {
        await this.sendError(
          bot,
          callbackQuery,
          listResult.error || "목록을 불러올 수 없습니다."
        );
        return false;
      }

      const { items, totalCount, totalPages, currentPage } = listResult.data;

      let listText = `📋 **할일 목록** (${currentPage}/${totalPages})\n\n`;

      if (items.length === 0) {
        listText +=
          "등록된 할일이 없습니다.\n\n➕ **새 할일** 버튼을 눌러 할일을 추가해보세요!";
      } else {
        items.forEach((todo, index) => {
          const status = todo.completed ? "✅" : "⭕";
          const priority = "★".repeat(todo.priority || 1);
          const dueDate = todo.dueDate
            ? ` (마감: ${TimeHelper.format(todo.dueDate, "short")})`
            : "";

          listText += `${status} **${todo.text}** ${priority}${dueDate}\n`;

          if (todo.category && todo.category !== "general") {
            listText += `   📁 ${todo.category}`;
          }

          if (todo.tags && todo.tags.length > 0) {
            listText += `   🏷️ ${todo.tags.join(", ")}`;
          }

          listText += "\n\n";
        });

        listText += `📊 전체 ${totalCount}개 할일`;
      }

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.editMessage(bot, chatId, messageId, listText);

      return true;
    } catch (error) {
      logger.error("❌ 할일 목록 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "목록을 불러올 수 없습니다.");
      return false;
    }
  }

  /**
   * ➕ 할일 추가 시작
   */
  async startAddTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      // 사용자 상태 설정
      this.setUserState(from.id, "adding_todo");

      const addText = `➕ **새 할일 추가**

할일 내용을 입력해주세요.

**📋 입력 형식 (선택사항):**
• 기본: \`할일 내용\`
• 카테고리: \`[업무] 할일 내용\`
• 우선순위: \`할일 내용 !3\` (1-5단계)
• 마감일: \`할일 내용 @2024-01-15\`

**예시:**
\`[업무] 보고서 작성 !4 @2024-01-20\`

❌ 취소하려면 /cancel 을 입력하세요.`;

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.editMessage(bot, chatId, messageId, addText);

      return true;
    } catch (error) {
      logger.error("❌ 할일 추가 시작 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "할일 추가를 시작할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * ✅ 할일 상태 토글
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const todoId = params[0];
      if (!todoId) {
        await this.sendError(bot, callbackQuery, "할일 ID가 필요합니다.");
        return false;
      }

      // ServiceBuilder를 통해 요청한 서비스로 상태 토글
      const toggleResult = await this.todoService.toggleTodo(from.id, todoId);

      if (!toggleResult.success) {
        await this.sendError(
          bot,
          callbackQuery,
          toggleResult.error || "상태 변경에 실패했습니다."
        );
        return false;
      }

      // 알림 전송 (선택적 서비스)
      if (this.notificationService && this.config.enableNotifications) {
        const todo = toggleResult.data;
        const statusText = todo.completed ? "완료" : "진행중";

        try {
          await this.notificationService.send(from.id, {
            type: "todo_status_changed",
            message: `할일 "${todo.text}"가 ${statusText}으로 변경되었습니다.`,
          });
        } catch (notificationError) {
          logger.debug("알림 전송 실패:", notificationError.message);
        }
      }

      // 콜백 답변
      const todo = toggleResult.data;
      const statusText = todo.completed ? "완료됨" : "진행중";
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ "${todo.text}" ${statusText}`,
        show_alert: false,
      });

      // 목록 새로고침
      return await this.showTodoList(bot, callbackQuery, params, moduleManager);
    } catch (error) {
      logger.error("❌ 할일 상태 토글 실패:", error);
      await this.sendError(bot, callbackQuery, "상태 변경에 실패했습니다.");
      return false;
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      // ServiceBuilder를 통해 요청한 서비스로 상세 통계 조회
      const statsResult = await this.todoService.getDetailedStats(from.id);

      if (!statsResult.success) {
        await this.sendError(bot, callbackQuery, "통계를 불러올 수 없습니다.");
        return false;
      }

      const stats = statsResult.data;

      const statsText = `📊 **할일 통계**

**📈 전체 현황**
• 총 할일: ${stats.total}개
• 완료: ${stats.completed}개 (${stats.completionRate}%)
• 진행중: ${stats.pending}개

**📅 기간별 통계**
• 이번 주: ${stats.thisWeek}개
• 이번 달: ${stats.thisMonth}개
• 평균 완료/일: ${stats.averagePerDay}개

**📁 카테고리별**
${stats.categories
  .map((cat) => `• ${cat.name}: ${cat.count}개 (${cat.percentage}%)`)
  .join("\n")}

**⭐ 우선순위별**
${stats.priorities
  .map((pri) => `• ${pri.priority}단계: ${pri.count}개`)
  .join("\n")}

**📊 최근 활동**
• 오늘 추가: ${stats.todayAdded}개
• 오늘 완료: ${stats.todayCompleted}개
• 마지막 활동: ${TimeHelper.format(stats.lastActivity, "relative")}`;

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.editMessage(bot, chatId, messageId, statsText);

      return true;
    } catch (error) {
      logger.error("❌ 할일 통계 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "통계를 불러올 수 없습니다.");
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

      // 검증 (ValidationService 활용)
      if (this.validationService) {
        const validationResult = await this.validationService.validateTodo(
          parsedTodo
        );
        if (!validationResult.valid) {
          await this.sendMessage(bot, chatId, `❌ ${validationResult.message}`);
          return true;
        }
      } else {
        // 기본 검증
        if (!parsedTodo.text || parsedTodo.text.length < 1) {
          await this.sendMessage(bot, chatId, "❌ 할일 내용을 입력해주세요.");
          return true;
        }
        if (parsedTodo.text.length > this.constants.MAX_TEXT_LENGTH) {
          await this.sendMessage(
            bot,
            chatId,
            `❌ 할일 내용이 너무 깁니다. (최대 ${this.constants.MAX_TEXT_LENGTH}자)`
          );
          return true;
        }
      }

      // ServiceBuilder를 통해 요청한 서비스로 할일 추가
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
      return false;
    }
  }

  /**
   * 빠른 할일 추가 처리
   */
  async handleQuickAddTodo(bot, msg, text) {
    try {
      const {
        chat: { id: chatId },
        from,
      } = msg;

      // 'todo:' 또는 '할일:' 부분 제거
      const todoText = text.replace(/^(할일:|todo:)\s*/i, "").trim();

      if (!todoText) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 할일 내용을 입력해주세요.\n예: `할일: 쇼핑하기`"
        );
        return true;
      }

      const parsedTodo = this.parseAddTodoText(todoText);

      // ServiceBuilder를 통해 요청한 서비스로 할일 추가
      const addResult = await this.todoService.addTodo(from.id, parsedTodo);

      if (!addResult.success) {
        await this.sendMessage(bot, chatId, `❌ ${addResult.error}`);
        return true;
      }

      const todo = addResult.data;

      await this.sendMessage(
        bot,
        chatId,
        `✅ **빠른 할일 추가 완료!**\n\n📝 ${todo.text}`
      );

      return true;
    } catch (error) {
      logger.error("❌ 빠른 할일 추가 실패:", error);
      await this.sendMessage(
        bot,
        msg.chat.id,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 할일 텍스트 파싱
   */
  parseAddTodoText(text) {
    const todo = {
      text: text,
      category: "general",
      priority: 3,
      tags: [],
      dueDate: null,
    };

    // 카테고리 파싱 [카테고리]
    const categoryMatch = text.match(/\[([^\]]+)\]/);
    if (categoryMatch) {
      todo.category = categoryMatch[1];
      todo.text = text.replace(categoryMatch[0], "").trim();
    }

    // 우선순위 파싱 !숫자
    const priorityMatch = todo.text.match(/!([1-5])/);
    if (priorityMatch) {
      todo.priority = parseInt(priorityMatch[1]);
      todo.text = todo.text.replace(priorityMatch[0], "").trim();
    }

    // 마감일 파싱 @날짜
    const dueDateMatch = todo.text.match(/@(\d{4}-\d{2}-\d{2})/);
    if (dueDateMatch) {
      try {
        todo.dueDate = new Date(dueDateMatch[1]);
        todo.text = todo.text.replace(dueDateMatch[0], "").trim();
      } catch (error) {
        logger.debug("날짜 파싱 실패:", dueDateMatch[1]);
      }
    }

    // 태그 파싱 #태그
    const tagMatches = todo.text.match(/#([^\s]+)/g);
    if (tagMatches) {
      todo.tags = tagMatches.map((tag) => tag.substring(1));
      todo.text = todo.text.replace(/#[^\s]+/g, "").trim();
    }

    return todo;
  }

  /**
   * 할일 메뉴 전송 (명령어용)
   */
  async sendTodoMenu(bot, chatId) {
    try {
      const menuText = `📝 **할일 관리**

할일을 체계적으로 관리해보세요!

**💡 빠른 사용법:**
• \`할일: 내용\` - 빠른 할일 추가
• \`[카테고리] 할일 내용 !우선순위\` - 상세 추가

버튼을 클릭해서 더 많은 기능을 사용하세요.`;

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.sendMessage(bot, chatId, menuText);
    } catch (error) {
      logger.error("❌ 할일 메뉴 전송 실패:", error);
      await this.sendMessage(bot, chatId, "❌ 메뉴를 불러올 수 없습니다.");
    }
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
      validationService: {
        connected: !!this.validationService,
        status: this.validationService?.getStatus?.() || "unknown",
      },
      additionalServices: {
        reminder: !!this.reminderService,
        notification: !!this.notificationService,
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

      // 서비스 참조 정리 (ServiceBuilder가 관리하므로 직접 정리하지 않음)
      this.todoService = null;
      this.validationService = null;
      this.reminderService = null;
      this.notificationService = null;

      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
