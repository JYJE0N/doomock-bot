// ===== 📝 Enhanced TodoModule v3.0.1 - 화려한 할일 관리 =====
// src/modules/TodoModule.js
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const enhancedResponses = require("../utils/EnhancedBotResponses");

/**
 * 📝 Enhanced TodoModule v3.0.1 - 화려한 할일 관리 시스템
 *
 * 🎨 Enhanced 특징:
 * - MarkdownV2 화려한 UI
 * - 실시간 진행률 표시
 * - 동적 이모지 애니메이션
 * - 사용자 친화적 에러 처리
 * - Enhanced Logger 완벽 연동
 *
 * 🎯 표준 플로우 준수:
 * - ServiceBuilder 의존성 주입
 * - 표준 매개변수 체계
 * - actionMap 방식
 * - NavigationHandler UI 위임
 */
class TodoModule extends BaseModule {
  constructor(moduleKey, options = {}) {
    super("TodoModule", options);

    // 🎨 Enhanced Logger - 화려한 모듈 시작
    logger.moduleStart("TodoModule", "3.0.1");
    console.log("📝".repeat(20));

    // 🔧 ServiceBuilder를 통한 서비스 의존성 주입
    this.todoService = null;

    // 📊 Railway 환경변수 기반 설정
    this.config = {
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 8,
      maxTodos: parseInt(process.env.MAX_TODOS_PER_USER) || 100,
      enablePriority: process.env.TODO_ENABLE_PRIORITY !== "false",
      enableDueDate: process.env.TODO_ENABLE_DUE_DATE !== "false",
      enableCategories: process.env.TODO_ENABLE_CATEGORIES !== "false",
      autoComplete: process.env.TODO_AUTO_COMPLETE === "true",
      ...this.config,
    };

    // 📋 Todo 상수들
    this.constants = {
      PRIORITIES: [
        { value: 1, name: "낮음", emoji: "🟢" },
        { value: 2, name: "보통", emoji: "🟡" },
        { value: 3, name: "높음", emoji: "🟠" },
        { value: 4, name: "긴급", emoji: "🔴" },
        { value: 5, name: "매우긴급", emoji: "🚨" },
      ],
      CATEGORIES: [
        { id: "work", name: "업무", emoji: "💼" },
        { id: "personal", name: "개인", emoji: "👤" },
        { id: "study", name: "공부", emoji: "📚" },
        { id: "health", name: "건강", emoji: "🏥" },
        { id: "hobby", name: "취미", emoji: "🎨" },
      ],
      STATUSES: [
        { id: "pending", name: "대기", emoji: "⏳" },
        { id: "progress", name: "진행중", emoji: "🔄" },
        { id: "completed", name: "완료", emoji: "✅" },
        { id: "cancelled", name: "취소", emoji: "❌" },
      ],
      MAX_TITLE_LENGTH: 100,
      MAX_DESCRIPTION_LENGTH: 500,
    };

    // 🎯 사용자 상태 관리 (Enhanced)
    this.userStates = new Map();
    this.addingStates = new Map(); // 할일 추가 중 상태
    this.editingStates = new Map(); // 할일 편집 중 상태

    logger.success("📝 Enhanced TodoModule 생성됨", {
      maxTodos: this.config.maxTodos,
      pageSize: this.config.pageSize,
      featuresEnabled: {
        priority: this.config.enablePriority,
        dueDate: this.config.enableDueDate,
        categories: this.config.enableCategories,
      },
    });
  }

  /**
   * 🎯 모듈 초기화 - ServiceBuilder 활용
   */
  async onInitialize() {
    try {
      logger.info("🎯 Enhanced TodoModule 초기화 시작...", {
        module: "TodoModule",
        version: "3.0.1",
      });

      // 🔧 ServiceBuilder로 TodoService 요청
      this.todoService = await this.requireService("todo");

      if (!this.todoService) {
        throw new Error("TodoService 초기화 실패");
      }

      // 🎨 Enhanced Logger - 성공 로깅
      logger.success("✅ TodoService 연결 완료", {
        service: "TodoService",
        hasService: !!this.todoService,
        serviceStatus: this.todoService.getStatus(),
      });
    } catch (error) {
      logger.error("❌ Enhanced TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 - Enhanced actionMap
   */
  setupActions() {
    logger.debug("🎯 TodoModule Enhanced 액션 등록 시작...");

    this.registerActions({
      // 메인 액션들
      menu: this.handleMenu.bind(this),
      help: this.handleHelp.bind(this),

      // CRUD 액션들 (Enhanced)
      list: this.handleList.bind(this),
      add: this.handleAdd.bind(this),
      "add:quick": this.handleQuickAdd.bind(this),
      "add:detail": this.handleDetailAdd.bind(this),

      // 완료/편집/삭제
      complete: this.handleComplete.bind(this),
      "complete:confirm": this.handleCompleteConfirm.bind(this),
      edit: this.handleEdit.bind(this),
      "edit:save": this.handleEditSave.bind(this),
      delete: this.handleDelete.bind(this),
      "delete:confirm": this.handleDeleteConfirm.bind(this),

      // 고급 기능들
      priority: this.handlePriority.bind(this),
      "priority:set": this.handlePrioritySet.bind(this),
      category: this.handleCategory.bind(this),
      "category:set": this.handleCategorySet.bind(this),

      // 페이징 및 필터
      page: this.handlePage.bind(this),
      filter: this.handleFilter.bind(this),
      "filter:apply": this.handleFilterApply.bind(this),

      // 통계 및 분석
      stats: this.handleStats.bind(this),
      progress: this.handleProgress.bind(this),
    });

    logger.success(`✅ TodoModule Enhanced 액션 등록 완료`, {
      actionCount: this.actionMap.size,
      actions: Array.from(this.actionMap.keys()),
    });
  }

  // ===== 🎯 Enhanced 액션 핸들러들 (표준 매개변수 준수!) =====

  /**
   * 🏠 Enhanced 메뉴 핸들러
   * 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const chatId = callbackQuery.message.chat.id;

      // 🎨 Enhanced Logger - 사용자 액션 로깅
      logger.info("🏠 Enhanced Todo 메뉴 요청", {
        module: "TodoModule",
        action: "menu",
        userId,
        userName,
        chatId,
      });

      // 📊 사용자 Todo 통계 수집
      const stats = await this.todoService.getUserStats(userId);
      const recentTodos = await this.todoService.getRecentTodos(userId, 3);

      // 🎨 Enhanced Logger - 데이터 수집 완료
      logger.debug("📊 Todo 메뉴 데이터 수집 완료", {
        totalTodos: stats.total,
        completedTodos: stats.completed,
        pendingTodos: stats.pending,
        recentCount: recentTodos.length,
      });

      // 📱 Enhanced UI - 화려한 Todo 메뉴 카드 생성
      const menuData = {
        userName,
        stats,
        recentTodos,
        features: {
          priorityEnabled: this.config.enablePriority,
          dueDateEnabled: this.config.enableDueDate,
          categoriesEnabled: this.config.enableCategories,
        },
        limits: {
          current: stats.total,
          max: this.config.maxTodos,
        },
      };

      // ✅ NavigationHandler에게 데이터 전달 (UI는 중앙에서!)
      return {
        success: true,
        action: "show_todo_menu",
        data: menuData,
        uiType: "enhanced_card",
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 메뉴 처리 실패:", error, {
        module: "TodoModule",
        action: "menu",
        userId: getUserId(callbackQuery),
      });

      return {
        success: false,
        error: error.message,
        action: "show_error",
        suggestion: "잠시 후 다시 시도하거나 목록을 새로고침해보세요.",
      };
    }
  }

  /**
   * 📋 Enhanced 목록 핸들러
   */
  async handleList(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const page = parseInt(params[0]) || 1;
      const filter = params[1] || "all"; // all, pending, completed

      logger.info("📋 Enhanced Todo 목록 요청", {
        module: "TodoModule",
        action: "list",
        userId,
        page,
        filter,
      });

      // 📊 페이징된 Todo 목록 조회
      const todos = await this.todoService.getTodosByPage(
        userId,
        page,
        this.config.pageSize,
        { status: filter !== "all" ? filter : undefined }
      );

      const totalCount = await this.todoService.getTotalCount(userId, {
        status: filter !== "all" ? filter : undefined,
      });
      const totalPages = Math.ceil(totalCount / this.config.pageSize);

      // 📊 각 Todo에 Enhanced 정보 추가
      const enhancedTodos = todos.map((todo) => ({
        ...todo,
        priorityInfo: this.constants.PRIORITIES.find(
          (p) => p.value === todo.priority
        ),
        categoryInfo: this.constants.CATEGORIES.find(
          (c) => c.id === todo.category
        ),
        statusInfo: this.constants.STATUSES.find((s) => s.id === todo.status),
        isOverdue: todo.dueDate && new Date(todo.dueDate) < new Date(),
        daysLeft: todo.dueDate
          ? Math.ceil(
              (new Date(todo.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
            )
          : null,
      }));

      logger.debug("📊 Enhanced Todo 목록 조회 완료", {
        todoCount: enhancedTodos.length,
        page,
        totalPages,
        totalCount,
        filter,
      });

      // ✅ NavigationHandler에게 Enhanced 데이터 전달
      return {
        success: true,
        action: "show_todo_list",
        data: {
          todos: enhancedTodos,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            pageSize: this.config.pageSize,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          filter,
          stats: await this.todoService.getUserStats(userId),
        },
        uiType: "enhanced_list",
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 목록 조회 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
        suggestion: "목록을 새로고침하거나 필터를 변경해보세요.",
      };
    }
  }

  /**
   * ➕ Enhanced 할일 추가 핸들러
   */
  async handleAdd(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const chatId = callbackQuery.message.chat.id;

      logger.info("➕ Enhanced Todo 추가 요청", {
        module: "TodoModule",
        action: "add",
        userId,
      });

      // 📊 사용자 Todo 수 체크
      const currentCount = await this.todoService.getTotalCount(userId);
      if (currentCount >= this.config.maxTodos) {
        logger.warn("⚠️ Todo 한도 초과", {
          userId,
          currentCount,
          maxAllowed: this.config.maxTodos,
        });

        return {
          success: false,
          error: `최대 ${this.config.maxTodos}개까지만 생성 가능합니다`,
          action: "show_error",
          suggestion: "완료된 할일을 삭제하거나 정리해보세요.",
        };
      }

      // 🎯 사용자 상태 설정 (할일 추가 모드)
      this.setUserState(userId, {
        action: "adding",
        step: "title",
        data: {},
        timestamp: Date.now(),
      });

      logger.debug("🎯 사용자 추가 모드 설정", {
        userId,
        state: "adding",
      });

      // ✅ NavigationHandler에게 추가 UI 요청
      return {
        success: true,
        action: "show_add_form",
        data: {
          currentCount,
          maxTodos: this.config.maxTodos,
          features: {
            priorityEnabled: this.config.enablePriority,
            dueDateEnabled: this.config.enableDueDate,
            categoriesEnabled: this.config.enableCategories,
          },
          priorities: this.constants.PRIORITIES,
          categories: this.constants.CATEGORIES,
        },
        uiType: "enhanced_form",
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 추가 처리 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * ✅ Enhanced 완료 처리 핸들러
   */
  async handleComplete(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const todoId = params[0];

      logger.info("✅ Enhanced Todo 완료 요청", {
        module: "TodoModule",
        action: "complete",
        userId,
        todoId,
      });

      // 🔍 Todo 조회
      const todo = await this.todoService.getTodoById(userId, todoId);
      if (!todo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
          action: "show_error",
        };
      }

      // ✅ 완료 처리
      const completedTodo = await this.todoService.completeTodo(userId, todoId);

      // 🎨 Enhanced Logger - 완료 성공
      logger.success("🎊 Todo 완료!", {
        module: "TodoModule",
        todoId,
        title: completedTodo.title,
        userId,
      });

      // 📊 사용자 통계 업데이트
      const updatedStats = await this.todoService.getUserStats(userId);

      // ✅ 성공 애니메이션과 함께 응답
      return {
        success: true,
        action: "show_complete_success",
        data: {
          completedTodo,
          stats: updatedStats,
          celebration: true,
        },
        uiType: "enhanced_success",
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 완료 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 📊 Enhanced 통계 핸들러
   */
  async handleStats(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      logger.info("📊 Enhanced Todo 통계 요청", {
        module: "TodoModule",
        action: "stats",
        userId,
      });

      // 📊 상세 통계 수집
      const stats = await this.todoService.getDetailedStats(userId);
      const trends = await this.todoService.getWeeklyTrends(userId);
      const achievements = await this.todoService.getUserAchievements(userId);

      logger.debug("📈 통계 데이터 수집 완료", {
        totalTodos: stats.total,
        completionRate: stats.completionRate,
        weeklyCompleted: trends.weeklyCompleted,
      });

      return {
        success: true,
        action: "show_stats_dashboard",
        data: {
          stats,
          trends,
          achievements,
          progressData: {
            daily: trends.daily,
            weekly: trends.weekly,
            monthly: trends.monthly,
          },
        },
        uiType: "enhanced_dashboard",
      };
    } catch (error) {
      logger.error("❌ Enhanced Todo 통계 조회 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 💬 Enhanced 메시지 처리 (표준 매개변수!)
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg);
      const text = msg.text?.trim();
      const userState = this.getUserState(userId);

      // 🎨 Enhanced Logger - 메시지 수신
      logger.debug("💬 Enhanced Todo 메시지 수신", {
        module: "TodoModule",
        userId,
        hasState: !!userState,
        stateAction: userState?.action,
        textLength: text?.length || 0,
      });

      // 사용자 상태에 따른 처리
      if (userState?.action === "adding") {
        return await this.processAddingMessage(bot, msg, userState);
      }

      if (userState?.action === "editing") {
        return await this.processEditingMessage(bot, msg, userState);
      }

      // 처리하지 않음
      return false;
    } catch (error) {
      logger.error("❌ Enhanced Todo 메시지 처리 실패:", error);
      return false;
    }
  }

  /**
   * 🔧 할일 추가 중 메시지 처리
   */
  async processAddingMessage(bot, msg, userState) {
    try {
      const userId = getUserId(msg);
      const text = msg.text?.trim();
      const chatId = msg.chat.id;

      if (!text || text.length === 0) {
        return false; // 빈 메시지 무시
      }

      // 제목 길이 체크
      if (text.length > this.constants.MAX_TITLE_LENGTH) {
        // 에러 메시지는 NavigationHandler가 처리하도록
        return true; // 처리했다고 표시
      }

      // 새 Todo 생성
      const newTodo = await this.todoService.createTodo(userId, {
        title: text,
        priority: 2, // 기본 우선순위
        category: "personal", // 기본 카테고리
        status: "pending",
      });

      // 사용자 상태 정리
      this.clearUserState(userId);

      // 🎨 Enhanced Logger - 메시지로 추가 성공
      logger.success("✅ 메시지로 Todo 추가 완료", {
        module: "TodoModule",
        todoId: newTodo.id,
        title: newTodo.title,
        userId,
      });

      // NavigationHandler에게 성공 알림 (비동기로)
      setImmediate(async () => {
        try {
          await enhancedResponses.sendSuccessAnimation(
            bot,
            chatId,
            "할일 추가 완료!",
            `"${text}" 항목이 성공적으로 추가되었습니다!`
          );
        } catch (error) {
          logger.error("❌ 성공 애니메이션 전송 실패:", error);
        }
      });

      return true;
    } catch (error) {
      logger.error("❌ 추가 중 메시지 처리 실패:", error);

      // 에러 상태로 NavigationHandler에게 알림
      setImmediate(async () => {
        try {
          await enhancedResponses.sendFriendlyError(
            bot,
            msg.chat.id,
            "할일 추가 중 오류가 발생했습니다",
            "다시 시도하거나 /todo 명령어를 사용해보세요"
          );
        } catch (errorSendError) {
          logger.error("❌ 에러 메시지 전송도 실패:", errorSendError);
        }
      });

      return true; // 처리했다고 표시 (에러여도)
    }
  }

  /**
   * 📊 모듈 상태 조회 (Enhanced)
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      version: "3.0.1",
      type: "Enhanced",
      features: {
        markdownV2: true,
        dynamicUI: true,
        enhancedLogging: true,
        realTimeProgress: true,
      },
      serviceStatus: this.todoService?.getStatus(),
      userStatesActive: this.userStates.size,
      config: {
        maxTodos: this.config.maxTodos,
        pageSize: this.config.pageSize,
        featuresEnabled: {
          priority: this.config.enablePriority,
          dueDate: this.config.enableDueDate,
          categories: this.config.enableCategories,
        },
      },
    };
  }
}

module.exports = TodoModule;
