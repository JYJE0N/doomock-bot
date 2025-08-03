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
      defaultReminderMinutes: parseInt(process.env.TODO_DEFAULT_REMINDER_MINUTES) || 60,
      maxRemindersPerTodo: parseInt(process.env.TODO_MAX_REMINDERS_PER_TODO) || 3,
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
        this.reminderService = await this.serviceBuilder.getOrCreate("reminder");
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

  /**
   * 🎯 메시지 처리 (리마인드 입력 처리 추가)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);

    if (!userState) {
      return null; // 처리하지 않음
    }

    try {
      switch (userState.state) {
        case this.constants.INPUT_STATES.WAITING_ADD_INPUT:
          return await this.handleAddInput(bot, msg);

        case this.constants.INPUT_STATES.WAITING_EDIT_INPUT:
          return await this.handleEditInput(bot, msg);

        case this.constants.INPUT_STATES.WAITING_SEARCH_INPUT:
          return await this.handleSearchInput(bot, msg);

        // 🆕 리마인드 시간 입력 처리
        case this.constants.INPUT_STATES.WAITING_REMINDER_TIME:
          return await this.handleReminderTimeInput(bot, msg);

        // 🆕 리마인드 메시지 입력 처리
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
        module: "todo",
        data: {
          message: "입력 처리 중 오류가 발생했습니다.",
          action: "handle_message",
          canRetry: true
        }
      };
    }
  }

  // ===== 🆕 리마인드 관련 액션 메서드들 =====

  /**
   * ⏰ 리마인드 설정
   */
  async setReminder(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.config.enableReminders || !this.reminderService) {
      return {
        type: "error",
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
        module: "todo",
        data: {
          message: "리마인드 설정에 실패했습니다.",
          action: "remind",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📋 리마인드 목록 보기
   */
  async showReminders(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!this.reminderService) {
      return {
        type: "error",
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
          module: "todo",
          data: {
            message: result.message || "리마인드 목록을 가져올 수 없습니다.",
            action: "remind_list",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        data: {
          title: "⏰ 나의 리마인드",
          reminders: result.data,
          action: "remind_list",
          totalCount: result.data.length
        }
      };
    } catch (error) {
      logger.error("TodoModule.showReminders 오류:", error);
      return {
        type: "error",
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
   * 📊 주간 리포트 보기
   */
  async showWeeklyReport(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 주간 통계 가져오기
      const weeklyStats = await this.todoService.getWeeklyStats(userId);

      if (!weeklyStats.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: "주간 리포트를 생성할 수 없습니다.",
            action: "weekly_report",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        data: {
          title: "📊 이번 주 할일 리포트",
          stats: weeklyStats.data,
          action: "weekly_report",
          period: "이번 주"
        }
      };
    } catch (error) {
      logger.error("TodoModule.showWeeklyReport 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "주간 리포트 생성에 실패했습니다.",
          action: "weekly_report",
          canRetry: true
        }
      };
    }
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
  async cancelInput(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    this.clearUserState(userId);

    return {
      type: "success",
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
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 간단한 통계 가져오기
      const stats = await this.todoService.getTodoStats(userId);

      return {
        type: "success",
        module: "todo",
        data: {
          title: "📋 할일 관리",
          action: "menu",
          stats: stats.success ? stats.data : null,
          enableReminders: this.config.enableReminders
        }
      };
    } catch (error) {
      logger.error("TodoModule.showMenu 오류:", error);
      return {
        type: "error",
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
