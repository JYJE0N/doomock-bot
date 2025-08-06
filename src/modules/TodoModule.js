// src/modules/TodoModule.js - 비즈니스 로직만 담당
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

/**
 * 📋 TodoModule - 순수한 비즈니스 로직만 처리
 *
 * ✅ 역할: 비즈니스 로직, 상태 관리, 데이터 검증
 * ❌ 하지 않는 것: DB 직접 조회, UI 생성, 복잡한 데이터 가공
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 서비스 인스턴스
    this.todoService = null;

    // 모듈 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.TODO_MAX_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 8,
      maxTitleLength: parseInt(process.env.TODO_MAX_TITLE_LENGTH) || 100,
      enableReminders: process.env.TODO_ENABLE_REMINDERS !== "false",
      ...options.config
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
        WAITING_REMINDER_TIME: "waiting_reminder_time"
      }
    };

    // 사용자 상태 관리
    this.userStates = new Map();

    // ✨ 30분마다 만료된 사용자 상태를 정리하는 인터벌 추가
    setInterval(() => {
      const now = Date.now();
      this.userStates.forEach((state, userId) => {
        // 30분(1800000ms) 이상 지난 상태는 삭제
        if (now - state.timestamp > 1800000) {
          this.userStates.delete(userId);
          logger.debug(`🧹 만료된 TodoModule 사용자 상태 정리: ${userId}`);
        }
      });
    }, 1800000);

    logger.info("📋 TodoModule 생성됨");
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    try {
      // ServiceBuilder를 통해 TodoService 가져오기
      if (this.serviceBuilder) {
        this.todoService = await this.serviceBuilder.getOrCreate("todo");
      }

      if (!this.todoService) {
        throw new Error("TodoService 생성에 실패했습니다");
      }

      // 액션 등록
      this.setupActions();

      logger.success("📋 TodoModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 액션 매핑 설정
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu.bind(this),
      list: this.showList.bind(this),
      add: this.addTodo.bind(this),
      edit: this.editTodo.bind(this),
      delete: this.deleteTodo.bind(this),
      toggle: this.toggleTodo.bind(this),
      complete: this.completeTodo.bind(this),
      uncomplete: this.uncompleteTodo.bind(this),
      archive: this.archiveTodo.bind(this),

      // 리마인더 액션
      remind_list: this.showReminders.bind(this),
      remind_add: this.addReminder.bind(this),
      remind_remove: this.removeReminder.bind(this), // 🆕 추가!
      remind_delete: this.deleteReminder.bind(this),

      // 통계 액션
      stats: this.showStats.bind(this),
      weekly: this.showWeeklyReport.bind(this)
    });
  }

  /**
   * 메시지 처리 (입력 상태 처리)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);

    if (!userState) {
      return null;
    }

    const text = msg.text?.trim();
    if (!text) {
      return null;
    }

    let result = null;

    switch (userState.state) {
      case this.constants.INPUT_STATES.WAITING_ADD_INPUT:
        result = await this.processAddInput(userId, text);
        break;

      case this.constants.INPUT_STATES.WAITING_EDIT_INPUT:
        result = await this.processEditInput(userId, text, userState.todoId);
        break;

      case this.constants.INPUT_STATES.WAITING_REMINDER_TIME:
        result = await this.processReminderTimeInput(
          userId,
          text,
          userState.todoId
        );
        break;

      default:
        return null;
    }

    // 입력 처리 후 상태 초기화
    if (result) {
      this.clearUserState(userId);
    }

    return result;
  }

  // ===== 메인 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 📋 메뉴 보기
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const stats = await this.todoService.getTodoStats(userId);

      return {
        type: "menu",
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
        module: "todo",
        action: "error",
        data: {
          message: "메뉴를 불러올 수 없습니다.",
          action: "menu",
          canRetry: true
        }
      };
    }
  }

  /**
   * 📋 할일 목록
   */
  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const page = parseInt(params) || 1;

    try {
      const result = await this.todoService.getTodos(userId, {
        page,
        limit: this.config.pageSize,
        includeCompleted: true
      });

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "할일 목록을 불러올 수 없습니다.",
            action: "list",
            canRetry: true
          }
        };
      }

      return {
        type: "list",
        module: "todo",
        action: "list",
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
        module: "todo",
        action: "error",
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
      module: "todo",
      action: "input_request",
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
        module: "todo",
        action: "error",
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
        module: "todo",
        action: "error",
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
      module: "todo",
      action: "input_request",
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
          module: "todo",
          action: "error",
          data: {
            message: result.message || "할일 삭제에 실패했습니다.",
            action: "delete",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
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
        module: "todo",
        action: "error",
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
          module: "todo",
          action: "error",
          data: {
            message: result.message || "상태 변경에 실패했습니다.",
            action: "toggle",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
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
        module: "todo",
        action: "error",
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
          module: "todo",
          action: "error",
          data: {
            message: result.message || "보관에 실패했습니다.",
            action: "archive",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
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
        module: "todo",
        action: "error",
        data: {
          message: "보관 중 오류가 발생했습니다.",
          action: "archive",
          canRetry: true
        }
      };
    }
  }

  // ===== 리마인더 관련 액션 =====

  /**
   * ⏰ 리마인더 목록
   */
  async showReminders(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const result = await this.todoService.getReminders(userId);

      return {
        type: "remind_list",
        module: "todo",
        action: "remind_list",
        data: {
          reminders: result.data.reminders,
          totalCount: result.data.totalCount
        }
      };
    } catch (error) {
      logger.error("TodoModule.showReminders 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더 목록을 불러올 수 없습니다.",
          action: "remind_list",
          canRetry: true
        }
      };
    }
  }

  /**
   * ⏰ 리마인더 추가
   */
  async addReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더를 설정할 할일을 선택해주세요.",
          action: "remind_add",
          canRetry: false
        }
      };
    }

    // 입력 대기 상태 설정
    this.setUserState(userId, {
      state: this.constants.INPUT_STATES.WAITING_REMINDER_TIME,
      action: "remind_add",
      todoId: todoId
    });

    return {
      type: "input_request",
      module: "todo",
      action: "input_request",
      data: {
        title: "⏰ 리마인더 설정",
        message: "알림 시간을 입력해주세요:",
        suggestions: [
          "예: 30분 후",
          "예: 내일 오후 3시",
          "예: 2025-08-05 14:00"
        ]
      }
    };
  }

  /**
   * 🗑️ 리마인더 삭제
   */
  async deleteReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const reminderId = params;

    try {
      const result = await this.todoService.deleteReminder(userId, reminderId);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "리마인더 삭제에 실패했습니다.",
            action: "remind_delete",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
        data: {
          message: "리마인더가 삭제되었습니다.",
          action: "remind_delete",
          redirectTo: "remind_list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.deleteReminder 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더 삭제 중 오류가 발생했습니다.",
          action: "remind_delete",
          canRetry: true
        }
      };
    }
  }

  // ===== 통계 관련 액션 =====

  /**
   * 📊 통계 보기
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const stats = await this.todoService.getTodoStats(userId);

      return {
        type: "stats",
        module: "todo",
        action: "stats",
        data: stats.data
      };
    } catch (error) {
      logger.error("TodoModule.showStats 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "통계를 불러올 수 없습니다.",
          action: "stats",
          canRetry: true
        }
      };
    }
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
        module: "todo",
        action: "weekly_report",
        data: {
          report: result.data,
          enableReminders: this.config.enableReminders
        }
      };
    } catch (error) {
      logger.error("TodoModule.showWeeklyReport 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "주간 리포트 생성 중 오류가 발생했습니다.",
          action: "weekly_report",
          canRetry: true
        }
      };
    }
  }

  // ===== 입력 처리 메서드 =====

  /**
   * 할일 추가 입력 처리 (수정된 버전)
   */
  async processAddInput(userId, text) {
    try {
      const todoData = {
        text: text.trim(),
        priority: this.convertPriorityToNumber("medium"), // 🔧 수정: 숫자로 변환
        category: null,
        description: null,
        tags: []
      };

      const result = await this.todoService.addTodo(userId, todoData);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "할일 추가 실패",
            action: "add",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
        data: {
          message: "✅ 할일이 추가되었습니다!",
          todo: result.data,
          action: "add",
          redirectTo: "list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.processAddInput 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "할일 추가 중 오류가 발생했습니다.",
          action: "add",
          canRetry: true
        }
      };
    }
  }

  /**
   * Priority 문자열을 숫자로 변환하는 헬퍼 함수
   */
  convertPriorityToNumber(priority) {
    const priorityMap = {
      low: 1, // 낮음
      medium: 3, // 보통 (기본값)
      high: 4, // 높음
      urgent: 5 // 긴급
    };

    // 이미 숫자인 경우 그대로 반환 (1-5 범위 체크)
    if (typeof priority === "number") {
      return Math.min(Math.max(priority, 1), 5);
    }

    // 문자열인 경우 매핑 테이블에서 찾기
    const lowerPriority = String(priority).toLowerCase();
    return priorityMap[lowerPriority] || 3; // 기본값: medium(3)
  }

  /**
   * 할일 수정 입력 처리
   */
  async processEditInput(userId, text, todoId) {
    try {
      const result = await this.todoService.updateTodo(userId, todoId, {
        text
      });

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "할일 수정에 실패했습니다.",
            action: "edit",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
        data: {
          message: "✏️ 할일이 수정되었습니다!",
          todo: result.data,
          action: "edit",
          redirectTo: "list"
        }
      };
    } catch (error) {
      logger.error("TodoModule.processEditInput 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "할일 수정 중 오류가 발생했습니다.",
          action: "edit",
          canRetry: true
        }
      };
    }
  }

  /**
   * 리마인더 시간 입력 처리 - 완전 수정 버전
   */
  async processReminderTimeInput(userId, text, todoId) {
    try {
      // 🕐 TimeParseHelper로 실제 자연어 파싱
      const TimeParseHelper = require("../utils/TimeParseHelper");
      const parseResult = TimeParseHelper.parseTimeText(text);

      if (!parseResult.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: `⏰ ${parseResult.error}\n\n예시: "30분 후", "내일 오후 3시"`,
            action: "remind_add",
            canRetry: true
          }
        };
      }

      const remindAt = parseResult.datetime;

      // 과거 시간 체크
      const now = new Date();
      if (remindAt <= now) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: "⏰ 과거 시간으로는 리마인더를 설정할 수 없습니다.",
            action: "remind_add",
            canRetry: true
          }
        };
      }

      // 📋 할일 정보 가져오기
      const todoResult = await this.todoService.getTodoById(userId, todoId);
      if (!todoResult.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: "할일을 찾을 수 없습니다.",
            action: "remind_add",
            canRetry: false
          }
        };
      }

      // 🔔 리마인더 생성
      const result = await this.todoService.createReminder(userId, {
        todoId,
        remindAt,
        message: `"${todoResult.data.text}" 할일 알림`,
        type: "simple"
      });

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "리마인더 설정에 실패했습니다.",
            action: "remind_add",
            canRetry: true
          }
        };
      }

      // 🎯 성공 응답 - 자동 목록 새로고침으로 변경
      const TimeHelper = require("../utils/TimeHelper");
      const formattedTime = TimeHelper.format(remindAt, "full");

      return {
        type: "success",
        module: "todo",
        action: "success",
        data: {
          message: `⏰ 리마인더 설정 완료!\n\n📅 ${formattedTime}에 알려드릴게요!`,
          reminder: result.data,
          reminderTime: formattedTime,
          action: "remind_add",
          redirectTo: "list",
          // 🔧 핵심 수정: 자동 새로고침 플래그 추가
          autoRefresh: true,
          refreshDelay: 1000 // 1초 후 새로고침
        }
      };
    } catch (error) {
      logger.error("TodoModule.processReminderTimeInput 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더 설정 중 오류가 발생했습니다.",
          action: "remind_add",
          canRetry: true
        }
      };
    }
  }

  /**
   * 🔕 리마인더 해제
   */
  async removeReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더를 해제할 할일을 선택해주세요.",
          action: "remind_remove",
          canRetry: false
        }
      };
    }

    try {
      // 🎯 해당 할일의 활성 리마인더 찾아서 해제
      const result = await this.todoService.removeReminder(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          action: "error",
          data: {
            message: result.message || "리마인더 해제에 실패했습니다.",
            action: "remind_remove",
            canRetry: true
          }
        };
      }

      return {
        type: "success",
        module: "todo",
        action: "success",
        data: {
          message: "🔕 리마인더가 해제되었습니다!",
          action: "remind_remove",
          redirectTo: "list",
          // 🔧 핵심 수정: 자동 새로고침 플래그 추가
          autoRefresh: true,
          refreshDelay: 1000 // 1초 후 새로고침
        }
      };
    } catch (error) {
      logger.error("TodoModule.removeReminder 오류:", error);
      return {
        type: "error",
        module: "todo",
        action: "error",
        data: {
          message: "리마인더 해제 중 오류가 발생했습니다.",
          action: "remind_remove",
          canRetry: true
        }
      };
    }
  }

  // ===== 유틸리티 메서드 =====

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), { ...state, timestamp: Date.now() });
  }

  /**
   * 사용자 상태 가져오기
   */
  getUserState(userId) {
    return this.userStates.get(userId.toString());
  }

  /**
   * 사용자 상태 초기화
   */
  clearUserState(userId) {
    this.userStates.delete(userId.toString());
  }

  /**
   * 모듈 정보
   */
  getModuleInfo() {
    return {
      name: this.moduleName,
      version: "2.0.0",
      description: "할일 관리 및 리마인드 모듈",
      isActive: true,
      hasService: !!this.todoService,
      activeInputStates: this.userStates.size,
      config: {
        enableReminders: this.config.enableReminders,
        maxTodosPerUser: this.config.maxTodosPerUser
      }
    };
  }
}

module.exports = TodoModule;
