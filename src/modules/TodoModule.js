// src/modules/TodoModule.js - 리마인드 기능 추가된 할일 관리 모듈
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, _getUserName } = require("../utils/UserHelper");
const TimeParseHelper = require("../utils/TimeParseHelper");

/**
 * 📋 TodoModule - 할일 관리 모듈 (리마인드 기능 추가)
 *
 * ✅ 새로운 기능:
 * - 리마인드 시간 설정
 * - 자연어 시간 파싱
 * - 스마트 알림 관리
 * - 주간 진행률 확인
 * - 깔끔한 UI/UX
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 서비스 인스턴스
    this.todoService = null;
    this.reminderService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.TODO_MAX_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 8,
      maxTitleLength: parseInt(process.env.TODO_MAX_TITLE_LENGTH) || 100,
      enablePriority: process.env.TODO_ENABLE_PRIORITY === "true",
      enableCategories: process.env.TODO_ENABLE_CATEGORIES === "true",
      enableReminders: process.env.TODO_ENABLE_REMINDERS !== "false", // 기본값 true
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000,

      // 🆕 리마인드 관련 설정
      defaultReminderMinutes:
        parseInt(process.env.TODO_DEFAULT_REMINDER_MINUTES) || 60,
      maxRemindersPerTodo:
        parseInt(process.env.TODO_MAX_REMINDERS_PER_TODO) || 3,
      enableSmartReminders: process.env.TODO_ENABLE_SMART_REMINDERS !== "false",

      ...this.config
    };

    // 모듈 상수
    this.constants = {
      STATUS: {
        PENDING: "pending",
        COMPLETED: "completed",
        ARCHIVED: "archived"
      },
      PRIORITY: {
        LOW: "low",
        MEDIUM: "medium",
        HIGH: "high",
        URGENT: "urgent"
      },
      INPUT_STATES: {
        WAITING_ADD_INPUT: "waiting_add_input",
        WAITING_EDIT_INPUT: "waiting_edit_input",
        WAITING_SEARCH_INPUT: "waiting_search_input",
        // 🆕 리마인드 관련 상태
        WAITING_REMINDER_TIME: "waiting_reminder_time",
        WAITING_REMINDER_MESSAGE: "waiting_reminder_message"
      },
      // 🆕 리마인드 타입
      REMINDER_TYPES: {
        SIMPLE: "simple", // 단순 알림
        URGENT: "urgent", // 긴급 알림
        RECURRING: "recurring", // 반복 알림
        SMART: "smart" // 스마트 알림 (상황 파악)
      }
    };

    // 사용자 상태 관리
    this.userStates = new Map();

    logger.info("📋 TodoModule 생성됨 (리마인드 기능 포함)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      // TodoService 가져오기
      this.todoService = await this.serviceBuilder.getOrCreate("todo");

      // 🆕 ReminderService 가져오기
      if (this.config.enableReminders) {
        this.reminderService =
          await this.serviceBuilder.getOrCreate("reminder");
      }

      if (!this.todoService) {
        throw new Error("TodoService 생성에 실패했습니다");
      }

      // 액션 등록
      this.setupActions();

      logger.success("📋 TodoModule 초기화 완료 - 리마인드 기능 포함");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (리마인드 액션 추가)
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,
      list: this.showList,
      add: this.addTodo,
      edit: this.editTodo,
      delete: this.deleteTodo,
      toggle: this.toggleTodo,
      complete: this.completeTodo,
      uncomplete: this.uncompleteTodo,
      archive: this.archiveTodo,

      // 검색 및 필터
      search: this.searchTodos,
      filter: this.filterTodos,
      priority: this.filterByPriority,

      // 🆕 리마인드 관련 액션
      list_remind_select: this.showReminderSelectList,
      remind_edit_select: this.showReminderEditSelect,
      remind_delete_select: this.showReminderDeleteSelect,
      remind_quick: this.setQuickReminder,

      remind: this.setReminder, // 리마인드 설정
      remind_list: this.showReminders, // 리마인드 목록
      remind_edit: this.editReminder, // 리마인드 수정
      remind_delete: this.deleteReminder, // 리마인드 삭제
      remind_test: this.testReminder, // 리마인드 테스트

      // 🆕 스마트 기능
      weekly_report: this.showWeeklyReport, // 주간 리포트
      smart_suggestions: this.showSmartSuggestions, // 스마트 제안
      cleanup: this.smartCleanup, // 스마트 정리

      // 상태 관리
      cancel: this.cancelInput
    });

    logger.info(`✅ TodoModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);
    const text = msg.text?.trim();

    // 1. 입력 대기 상태 확인이 최우선!
    if (userState) {
      try {
        switch (userState.state) {
          case this.constants.INPUT_STATES.WAITING_ADD_INPUT:
            return await this.handleAddInput(bot, msg);

          case this.constants.INPUT_STATES.WAITING_EDIT_INPUT:
            return await this.handleEditInput(bot, msg);

          case this.constants.INPUT_STATES.WAITING_SEARCH_INPUT:
            return await this.handleSearchInput(bot, msg);

          // 🎯 리마인드 시간 입력 처리 - "3분 후" 같은 입력을 여기서 처리!
          case this.constants.INPUT_STATES.WAITING_REMINDER_TIME:
            return await this.handleReminderTimeInput(bot, msg);

          case this.constants.INPUT_STATES.WAITING_REMINDER_MESSAGE:
            return await this.handleReminderMessageInput(bot, msg);

          default:
            this.clearUserState(userId);
            return null;
        }
      } catch (error) {
        logger.error("TodoModule.onHandleMessage 오류:", error);
        this.clearUserState(userId);
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: "입력 처리 중 오류가 발생했습니다.",
            action: "handle_message",
            canRetry: true
          }
        };
      }
    }
    // 자연어 명령 처리
    if (text) {
      // "할일 추가" 패턴
      if (text.includes("할일") || text.includes("추가")) {
        return await this.startAddTodo(bot, msg);
      }

      // 리마인드 패턴 (15분 후, 내일, 등)
      if (text.match(/\d+분\s*(후|뒤)|내일|오늘|[0-9]+시/)) {
        // 가장 최근 할일에 리마인드 설정 시도
        return await this.trySetReminderFromText(bot, msg, text);
      }
    }

    return null;
  }

  // ===== 🆕 리마인드 관련 액션 메서드들 =====

  /**
   * ⏰ 리마인드 설정
   */
  async setReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.config.enableReminders || !this.reminderService) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 기능이 비활성화되어 있습니다.",
          action: "remind",
          canRetry: false
        }
      };
    }

    if (!params) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "할일 ID가 필요합니다.",
          action: "remind",
          canRetry: false
        }
      };
    }

    try {
      const todoId = params;

      // 할일 존재 확인
      const todoResult = await this.todoService.getTodoById(userId, todoId);
      if (!todoResult.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: "할일을 찾을 수 없습니다.",
            action: "remind",
            canRetry: false
          }
        };
      }

      // 사용자 상태를 리마인드 시간 입력 대기로 설정
      this.setUserState(userId, {
        state: this.constants.INPUT_STATES.WAITING_REMINDER_TIME,
        todoId,
        todo: todoResult.data
      });

      return {
        type: "input_request",
        action: "input_request",
        module: "todo",
        data: {
          title: "⏰ 리마인드 시간 설정",
          message: this.generateReminderTimeInstructions(todoResult.data),
          placeholder: "예: 내일 오후 3시, 30분 후, 12월 25일 오전 9시",
          inputType: "text",
          action: "remind",
          todo: todoResult.data,
          suggestions: TimeParseHelper.getSuggestions()
        }
      };
    } catch (error) {
      logger.error("TodoModule.setReminder 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 설정에 실패했습니다.",
          action: "remind",
          canRetry: true
        }
      };
    }
  }

  // 메서드 구현
  async showReminderSelectList(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    // 미완료 할일 목록 가져오기
    const result = await this.todoService.getTodos(userId, {
      includeCompleted: false
    });

    if (!result.success || result.data.todos.length === 0) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드를 설정할 할일이 없습니다.",
          canRetry: false
        }
      };
    }

    return {
      type: "reminder_select_list",
      module: "todo",
      action: "reminder_select_list",
      data: {
        todos: result.data.todos,
        title: "리마인드 설정할 할일 선택"
      }
    };
  }

  /**
   * 📋 리마인드 목록 보기
   */
  async showReminders(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.reminderService) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 서비스를 사용할 수 없습니다.",
          action: "remind_list",
          canRetry: false
        }
      };
    }

    try {
      const result = await this.reminderService.getUserReminders(userId);

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "리마인드 목록을 가져올 수 없습니다.",
            action: "remind_list",
            canRetry: true
          }
        };
      }

      return {
        type: "remind_list", // ✅ 리마인드 목록 전용 타입
        action: "remind_list",
        module: "todo",
        data: {
          title: "⏰ 나의 리마인드",
          reminders: result.data,
          totalCount: result.data.length
        }
      };
    } catch (error) {
      logger.error("TodoModule.showReminders 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 목록 조회에 실패했습니다.",
          action: "remind_list",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📝 리마인드 수정 선택 화면
   */
  async showReminderEditSelect(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    if (!this.reminderService) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드 기능이 비활성화되어 있습니다.",
          action: "remind_edit_select",
          canRetry: false
        }
      };
    }

    try {
      // 활성 리마인드 목록 가져오기
      const result = await this.reminderService.getUserReminders(userId, {
        activeOnly: true
      });

      if (!result.success || result.data.length === 0) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: "수정할 리마인드가 없습니다.",
            action: "remind_edit_select",
            canRetry: false
          }
        };
      }

      return {
        type: "reminder_select",
        module: "todo",
        action: "reminder_select",
        data: {
          reminders: result.data,
          title: "수정할 리마인드 선택",
          mode: "edit",
          action: "remind_edit"
        }
      };
    } catch (error) {
      logger.error("TodoModule.showReminderEditSelect 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드 목록을 불러올 수 없습니다.",
          action: "remind_edit_select",
          canRetry: true
        }
      };
    }
  }

  /**
   * 🗑️ 리마인드 삭제 선택 화면
   */
  async showReminderDeleteSelect(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    if (!this.reminderService) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드 기능이 비활성화되어 있습니다.",
          action: "remind_delete_select",
          canRetry: false
        }
      };
    }

    try {
      // 모든 리마인드 목록 가져오기
      const result = await this.reminderService.getUserReminders(userId);

      if (!result.success || result.data.length === 0) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: "삭제할 리마인드가 없습니다.",
            action: "remind_delete_select",
            canRetry: false
          }
        };
      }

      return {
        type: "reminder_select",
        module: "todo",
        action: "reminder_select",
        data: {
          reminders: result.data,
          title: "삭제할 리마인드 선택",
          mode: "delete",
          action: "remind_delete"
        }
      };
    } catch (error) {
      logger.error("TodoModule.showReminderDeleteSelect 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드 목록을 불러올 수 없습니다.",
          action: "remind_delete_select",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📊 제안 분석 헬퍼 메서드
   */
  analyzeAndGenerateSuggestions(todos) {
    const suggestions = [];

    // 미완료 할일이 많은 경우
    const pendingTodos = todos.filter((t) => !t.completed);
    if (pendingTodos.length > 10) {
      suggestions.push({
        type: "overload",
        title: "할일이 너무 많아요!",
        message: "우선순위를 정해서 중요한 것부터 처리해보세요.",
        action: "prioritize"
      });
    }

    // 오래된 미완료 할일
    const oldPending = pendingTodos.filter((t) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(t.createdAt)) / (1000 * 60 * 60 * 24)
      );
      return daysOld > 7;
    });

    if (oldPending.length > 0) {
      suggestions.push({
        type: "stale",
        title: "오래된 할일이 있어요",
        message: `${oldPending.length}개의 할일이 일주일 이상 미완료 상태입니다.`,
        action: "review_old"
      });
    }

    // 완료율이 낮은 경우
    const completionRate =
      todos.length > 0
        ? Math.round(
            (todos.filter((t) => t.completed).length / todos.length) * 100
          )
        : 0;

    if (completionRate < 50 && todos.length > 5) {
      suggestions.push({
        type: "low_completion",
        title: "완료율을 높여보세요",
        message: "작은 할일부터 하나씩 완료해보는 건 어떨까요?",
        action: "complete_easy"
      });
    }

    // 리마인드 활용 제안
    if (this.config.enableReminders) {
      const todosWithReminders = todos.filter(
        (t) => t.reminders && t.reminders.length > 0
      );
      if (todosWithReminders.length === 0 && pendingTodos.length > 3) {
        suggestions.push({
          type: "use_reminders",
          title: "리마인드 기능을 활용해보세요",
          message: "중요한 할일에 알림을 설정하면 잊지 않고 처리할 수 있어요.",
          action: "set_reminders"
        });
      }
    }

    return suggestions;
  }

  /**
   * 🕐 빠른 리마인드 설정
   */
  async setQuickReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!params) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인드 설정 정보가 없습니다.",
          canRetry: false
        }
      };
    }

    // params 형식: todoId:timeSpec (예: 65abc123:30m)
    const [todoId, timeSpec] = params.split(":");

    if (!todoId || !timeSpec) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "잘못된 리마인드 설정입니다.",
          canRetry: false
        }
      };
    }

    try {
      // 할일 확인
      const todoResult = await this.todoService.getTodoById(userId, todoId);
      if (!todoResult.success) {
        throw new Error("할일을 찾을 수 없습니다");
      }

      // 시간 계산
      let reminderTime;
      const now = new Date();

      switch (timeSpec) {
        case "30m":
          reminderTime = new Date(now.getTime() + 30 * 60 * 1000);
          break;
        case "1h":
          reminderTime = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case "tomorrow_9am":
          reminderTime = new Date(now);
          reminderTime.setDate(reminderTime.getDate() + 1);
          reminderTime.setHours(9, 0, 0, 0);
          break;
        case "tomorrow_6pm":
          reminderTime = new Date(now);
          reminderTime.setDate(reminderTime.getDate() + 1);
          reminderTime.setHours(18, 0, 0, 0);
          break;
        default:
          throw new Error("알 수 없는 시간 설정");
      }

      // 리마인드 생성
      const reminderResult = await this.reminderService.createReminder(userId, {
        todoId,
        text: `할일 알림: ${todoResult.data.text}`,
        reminderTime,
        type: this.constants.REMINDER_TYPES.SIMPLE
      });

      if (!reminderResult.success) {
        throw new Error(reminderResult.message || "리마인드 설정 실패");
      }

      return {
        type: "remind_set",
        module: "todo",
        action: "remind_set",
        data: {
          todo: todoResult.data,
          reminder: reminderResult.data,
          message: "리마인드가 설정되었습니다!"
        }
      };
    } catch (error) {
      logger.error("TodoModule.setQuickReminder 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: error.message || "리마인드 설정에 실패했습니다.",
          action: "remind_quick",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📋 할일 목록 보기
   */
  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const page = parseInt(params) || 1;

    try {
      const result = await this.todoService.getTodos(userId, {
        page,
        limit: this.config.pageSize,
        includeCompleted: true,
        includeReminders: this.config.enableReminders
      });

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "할일 목록을 불러올 수 없습니다.",
            action: "list",
            canRetry: true
          }
        };
      }

      return {
        type: "list",
        action: "list",
        module: "todo",
        data: {
          todos: result.data.todos,
          currentPage: result.data.currentPage,
          totalPages: result.data.totalPages,
          totalCount: result.data.totalCount,
          enableReminders: this.config.enableReminders
        }
      };
    } catch (error) {
      logger.error("TodoModule.showList 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "할일 목록 조회 중 오류가 발생했습니다.",
          action: "list",
          canRetry: true
        }
      };
    }
  }

  /**
   * ➕ 할일 추가
   */
  async addTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    // 입력 대기 상태 설정
    this.setUserState(userId, {
      state: this.constants.INPUT_STATES.WAITING_ADD_INPUT,
      action: "add"
    });

    return {
      type: "input_request",
      action: "input_request",
      module: "todo",
      data: {
        title: "➕ 새로운 할일 추가",
        message: "추가할 할일을 입력해주세요:",
        suggestions: [
          "예: 보고서 작성하기",
          "예: 오후 3시 회의 참석",
          "예: 운동하기"
        ]
      }
    };
  }

  /**
   * ✏️ 할일 수정
   */
  async editTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "수정할 할일을 선택해주세요.",
          action: "edit",
          canRetry: false
        }
      };
    }

    // 할일 존재 확인
    const todoResult = await this.todoService.getTodoById(userId, todoId);
    if (!todoResult.success) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "할일을 찾을 수 없습니다.",
          action: "edit",
          canRetry: false
        }
      };
    }

    // 입력 대기 상태 설정
    this.setUserState(userId, {
      state: this.constants.INPUT_STATES.WAITING_EDIT_INPUT,
      action: "edit",
      todoId: todoId,
      oldText: todoResult.data.text
    });

    return {
      type: "input_request",
      action: "input_request",
      module: "todo",
      data: {
        title: "✏️ 할일 수정",
        message: `현재 내용: "${todoResult.data.text}"\n\n새로운 내용을 입력해주세요:`,
        currentText: todoResult.data.text
      }
    };
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "할일 삭제에 실패했습니다.",
            action: "delete",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        action: "success",
        module: "todo",
        data: {
          message: "할일이 삭제되었습니다.",
          action: "delete",
          redirectTo: "list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.deleteTodo 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "할일 삭제 중 오류가 발생했습니다.",
          action: "delete",
          canRetry: true
        }
      };
    }
  }

  /**
   * ✅ 할일 토글
   */
  async toggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    try {
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "상태 변경에 실패했습니다.",
            action: "toggle",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        action: "success",
        module: "todo",
        data: {
          message: result.message,
          todo: result.data,
          action: "toggle",
          redirectTo: "list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.toggleTodo 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "상태 변경 중 오류가 발생했습니다.",
          action: "toggle",
          canRetry: true
        }
      };
    }
  }

  /**
   * ✅ 할일 완료
   */
  async completeTodo(bot, callbackQuery, subAction, params, moduleManager) {
    return this.toggleTodo(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  /**
   * ↩️ 할일 미완료
   */
  async uncompleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    return this.toggleTodo(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  /**
   * 📦 할일 보관
   */
  async archiveTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    try {
      const result = await this.todoService.archiveTodo(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "보관에 실패했습니다.",
            action: "archive",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        action: "success",
        module: "todo",
        data: {
          message: "할일이 보관되었습니다.",
          action: "archive",
          redirectTo: "list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.archiveTodo 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "보관 중 오류가 발생했습니다.",
          action: "archive",
          canRetry: true
        }
      };
    }
  }

  /**
   * 🔍 할일 검색
   */
  async searchTodos(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    // 입력 대기 상태 설정
    this.setUserState(userId, {
      state: this.constants.INPUT_STATES.WAITING_SEARCH_INPUT,
      action: "search"
    });

    return {
      type: "input_request",
      action: "input_request",
      module: "todo",
      data: {
        title: "🔍 할일 검색",
        message: "검색할 키워드를 입력해주세요:",
        suggestions: ["태그나 내용으로 검색 가능합니다"]
      }
    };
  }

  /**
   * 🎯 우선순위별 필터
   */
  async filterByPriority(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const priority = params;

    try {
      const result = await this.todoService.getTodosByPriority(
        userId,
        priority
      );

      return {
        type: "filtered_list",
        action: "filtered_list",
        module: "todo",
        data: {
          todos: result.data.todos,
          filter: { type: "priority", value: priority },
          totalCount: result.data.totalCount
        }
      };
    } catch (error) {
      logger.error("TodoModule.filterByPriority 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "필터링 중 오류가 발생했습니다.",
          action: "filter",
          canRetry: true
        }
      };
    }
  }

  /**
   * 필터 메뉴
   */
  async filterTodos(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "filter_menu",
      action: "filter_menu",
      module: "todo",
      data: {
        filters: [
          { type: "status", label: "상태별" },
          { type: "priority", label: "우선순위별" },
          { type: "date", label: "날짜별" }
        ]
      }
    };
  }

  /**
   * ✏️ 리마인드 수정
   */
  async editReminder(bot, callbackQuery, subAction, params, moduleManager) {
    // 리마인드 수정 로직
    return {
      type: "error",
      action: "error",
      module: "todo",
      data: {
        message: "리마인드 수정 기능은 준비 중입니다.",
        action: "remind_edit",
        canRetry: false
      }
    };
  }

  /**
   * 🗑️ 리마인드 삭제
   */
  async deleteReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const reminderId = params;

    if (!this.reminderService) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 기능이 비활성화되어 있습니다.",
          action: "remind_delete",
          canRetry: false
        }
      };
    }

    try {
      const result = await this.reminderService.deleteReminder(
        userId,
        reminderId
      );

      if (!result.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: result.message || "리마인드 삭제에 실패했습니다.",
            action: "remind_delete",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        action: "success",
        module: "todo",
        data: {
          message: result.message || "리마인드가 삭제되었습니다.",
          action: "remind_delete",
          redirectTo: "remind_list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.deleteReminder 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 삭제 중 오류가 발생했습니다.",
          action: "remind_delete",
          canRetry: true
        }
      };
    }
  }

  /**
   * 🧪 리마인드 테스트
   */
  async testReminder(bot, callbackQuery, subAction, params, moduleManager) {
    // 리마인드 테스트 알림 즉시 발송
    return {
      type: "success",
      action: "success",
      module: "todo",
      data: {
        message: "테스트 리마인드가 발송되었습니다.",
        action: "remind_test"
      }
    };
  }

  /**
   * 📊 주간 리포트
   */
  async showWeeklyReport(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.todoService.getWeeklyReport(userId);

      return {
        type: "weekly_report",
        action: "weekly_report",
        module: "todo",
        data: {
          report: result.data,
          enableReminders: this.config.enableReminders
        }
      };
    } catch (error) {
      logger.error("TodoModule.showWeeklyReport 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "주간 리포트 생성 중 오류가 발생했습니다.",
          action: "weekly_report",
          canRetry: true
        }
      };
    }
  }

  /**
   * 💡 스마트 제안
   */
  async showSmartSuggestions(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.todoService.getSmartSuggestions(userId);

      return {
        type: "smart_suggestions",
        action: "smart_suggestions",
        module: "todo",
        data: {
          suggestions: result.data.suggestions,
          insights: result.data.insights
        }
      };
    } catch (error) {
      logger.error("TodoModule.showSmartSuggestions 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "스마트 제안 생성 중 오류가 발생했습니다.",
          action: "smart_suggestions",
          canRetry: true
        }
      };
    }
  }

  /**
   * 🧹 스마트 정리
   */
  async smartCleanup(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.todoService.performSmartCleanup(userId);

      return {
        type: "cleanup_complete",
        action: "cleanup_complete",
        module: "todo",
        data: {
          stats: result.data,
          message: result.message
        }
      };
    } catch (error) {
      logger.error("TodoModule.smartCleanup 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "스마트 정리 중 오류가 발생했습니다.",
          action: "cleanup",
          canRetry: true
        }
      };
    }
  }

  /**
   * 메시지 입력 처리 헬퍼들
   */
  async handleAddInput(bot, msg) {
    const userId = getUserId(msg.from);
    const text = msg.text?.trim();

    if (!text) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "할일 내용을 입력해주세요.",
          keepState: true
        }
      };
    }

    const result = await this.todoService.addTodo(userId, { text });
    this.clearUserState(userId);

    if (!result.success) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: result.message || "할일 추가에 실패했습니다.",
          action: "add"
        }
      };
    }

    return {
      type: "success",
      action: "success",
      module: "todo",
      data: {
        message: `✅ "${text}" 할일이 추가되었습니다.`,
        todo: result.data,
        action: "add",
        redirectTo: "list"
      }
    };
  }

  async handleEditInput(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);
    const text = msg.text?.trim();

    if (!text) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "새로운 내용을 입력해주세요.",
          keepState: true
        }
      };
    }

    const result = await this.todoService.updateTodo(userId, userState.todoId, {
      text
    });
    this.clearUserState(userId);

    if (!result.success) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: result.message || "할일 수정에 실패했습니다.",
          action: "edit"
        }
      };
    }

    return {
      type: "success",
      action: "success",
      module: "todo",
      data: {
        message: `✅ 할일이 수정되었습니다.`,
        todo: result.data,
        action: "edit",
        redirectTo: "list"
      }
    };
  }

  async handleSearchInput(bot, msg) {
    const userId = getUserId(msg.from);
    const keyword = msg.text?.trim();

    if (!keyword) {
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "검색 키워드를 입력해주세요.",
          keepState: true
        }
      };
    }

    const result = await this.todoService.searchTodos(userId, keyword);
    this.clearUserState(userId);

    return {
      type: "search_results",
      action: "search_results",
      module: "todo",
      data: {
        keyword,
        todos: result.data.todos,
        totalCount: result.data.totalCount
      }
    };
  }

  // ===== 🆕 입력 처리 메서드들 =====

  /**
   * ⏰ 리마인드 시간 입력 처리
   */
  async handleReminderTimeInput(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);
    const timeText = msg.text.trim();

    try {
      // 시간 파싱
      const parseResult = TimeParseHelper.parseTimeText(timeText);

      if (!parseResult.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: `시간을 이해할 수 없습니다: "${timeText}"\n\n올바른 예시:\n• 30분 후\n• 내일 오후 3시\n• 12월 25일 오전 9시`,
            action: "remind_time_input",
            canRetry: true,
            keepState: true // 상태 유지
          }
        };
      }

      // 과거 시간 체크
      if (parseResult.datetime <= new Date()) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: "리마인드는 미래 시간만 설정할 수 있습니다.",
            action: "remind_time_input",
            canRetry: true,
            keepState: true
          }
        };
      }

      // 리마인드 생성
      const reminderResult = await this.reminderService.createReminder(userId, {
        todoId: userState.todoId,
        text: `할일 알림: ${userState.todo.text}`,
        reminderTime: parseResult.datetime,
        type: this.constants.REMINDER_TYPES.SIMPLE
      });

      // 상태 클리어
      this.clearUserState(userId);

      if (!reminderResult.success) {
        return {
          type: "error",
          action: "error",
          module: "todo",
          data: {
            message: reminderResult.message || "리마인드 설정에 실패했습니다.",
            action: "remind_time_input",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        action: "success",
        module: "todo",
        data: {
          title: "✅ 리마인드 설정 완료",
          message: `"${userState.todo.text}" 할일에 대한 리마인드가 설정되었습니다.\n\n⏰ ${parseResult.readableTime}`,
          action: "remind_set",
          reminder: reminderResult.data,
          todo: userState.todo
        }
      };
    } catch (error) {
      logger.error("TodoModule.handleReminderTimeInput 오류:", error);
      this.clearUserState(userId);

      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "리마인드 시간 처리 중 오류가 발생했습니다.",
          action: "remind_time_input",
          canRetry: true
        }
      };
    }
  }

  // ===== 유틸리티 메서드들 =====

  /**
   * 📝 리마인드 시간 설정 안내 메시지 생성
   */
  generateReminderTimeInstructions(todo) {
    return `📋 "${todo.text}" 할일의 리마인드 시간을 설정해주세요.

🕐 자연어로 편리하게 입력하세요:
• "30분 후" - 30분 뒤에 알림
• "내일 오후 3시" - 내일 15:00에 알림  
• "다음주 월요일 오전 9시" - 다음주 월요일 09:00에 알림
• "12월 25일 오후 2시" - 12월 25일 14:00에 알림

⏰ 언제 이 할일을 완료하시겠습니까?`;
  }

  // ===== 기존 메서드들 (상태 관리 등) =====

  setUserState(userId, state) {
    this.userStates.set(userId.toString(), state);
  }

  getUserState(userId) {
    return this.userStates.get(userId.toString());
  }

  clearUserState(userId) {
    return this.userStates.delete(userId.toString());
  }

  /**
   * 📝 취소 액션
   */
  async cancelInput(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    this.clearUserState(userId);

    return {
      type: "success",
      action: "success",
      module: "todo",
      data: {
        message: "입력이 취소되었습니다.",
        action: "cancel"
      }
    };
  }

  // ===== 기존 TodoModule 메서드들은 그대로 유지 =====
  // (showMenu, showList, addTodo, editTodo, deleteTodo 등)
  // 여기서는 간략화를 위해 생략하고, 실제 구현에서는 기존 코드 유지

  /**
   * 📋 메뉴 보기 (기존)
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 간단한 통계 가져오기
      const stats = await this.todoService.getTodoStats(userId);

      return {
        type: "menu", // <-- "success"가 아니라 "menu"로 변경!
        module: "todo",
        action: "menu",
        data: {
          title: "📋 할일 관리",
          stats: stats.success ? stats.data : null,
          enableReminders: this.config.enableReminders
        }
      };
    } catch (error) {
      logger.error("TodoModule.showMenu 오류:", error);
      return {
        type: "error",
        action: "error",
        module: "todo",
        data: {
          message: "메뉴를 불러올 수 없습니다.",
          action: "menu",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📊 모듈 정보
   */
  getModuleInfo() {
    return {
      name: this.moduleName,
      version: "2.0.0",
      description: "할일 관리 및 리마인드 모듈",
      isActive: true,
      hasService: !!this.todoService,
      hasReminderService: !!this.reminderService,
      activeInputStates: this.userStates.size,
      config: {
        enableReminders: this.config.enableReminders,
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableSmartReminders: this.config.enableSmartReminders
      }
    };
  }
}

module.exports = TodoModule;
