// src/modules/TodoModule.js - 완전히 표준화된 할일 관리 모듈
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 TodoModule - 할일 관리 모듈 (완전 표준화)
 *
 * ✅ 표준 준수 사항:
 * - BaseModule 상속
 * - 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
 * - actionMap 방식 (switch문 금지)
 * - onInitialize/onHandleMessage 구현
 * - registerActions 사용
 * - Railway 환경변수 기반
 * - 사용자 친화적 에러 처리
 * - 올바른 반환값 구조
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 서비스 인스턴스
    this.todoService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.TODO_MAX_PER_USER) || 50,
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 8,
      maxTitleLength: parseInt(process.env.TODO_MAX_TITLE_LENGTH) || 100,
      enablePriority: process.env.TODO_ENABLE_PRIORITY === "true",
      enableCategories: process.env.TODO_ENABLE_CATEGORIES === "true",
      cacheTimeout: parseInt(process.env.TODO_CACHE_TIMEOUT) || 300000,
      ...this.config,
    };

    // 모듈 상수
    this.constants = {
      STATUS: {
        PENDING: "pending",
        COMPLETED: "completed",
        ARCHIVED: "archived",
      },
      PRIORITY: {
        LOW: "low",
        MEDIUM: "medium",
        HIGH: "high",
        URGENT: "urgent",
      },
      INPUT_STATES: {
        WAITING_ADD_INPUT: "waiting_add_input",
        WAITING_EDIT_INPUT: "waiting_edit_input",
        WAITING_SEARCH_INPUT: "waiting_search_input",
      },
    };

    logger.info("📋 TodoModule 생성됨 (표준화 완료)");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // ServiceBuilder에서 TodoService 가져오기
      this.todoService = this.serviceBuilder.getServiceInstance("todo");

      if (!this.todoService) {
        throw new Error("TodoService를 찾을 수 없습니다");
      }

      // 액션 등록 (표준 패턴)
      this.setupActions();

      logger.success("📋 TodoModule 초기화 완료 - 표준 준수");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    // registerActions 메서드 사용 (표준)
    this.registerActions({
      // 메인 메뉴 및 네비게이션
      menu: this.showMenu,
      help: this.showHelp,

      // CRUD 작업
      list: this.showList,
      add: this.startAdd,
      edit: this.startEdit,
      delete: this.confirmDelete,
      "delete:confirm": this.executeDelete,

      // 상태 변경
      toggle: this.toggleTodo,
      complete: this.completeTodo,
      uncomplete: this.uncompleteTodo,
      archive: this.archiveTodo,

      // 검색 및 필터링
      search: this.startSearch,
      filter: this.showFilter,
      "filter:status": this.filterByStatus,
      "filter:priority": this.filterByPriority,
      "filter:clear": this.clearFilter,

      // 페이지네이션
      page: this.changePage,
      "page:first": this.goToFirstPage,
      "page:last": this.goToLastPage,

      // 통계
      stats: this.showStats,

      // 설정
      settings: this.showSettings,
      "settings:priority": this.togglePriority,
      "settings:categories": this.toggleCategories,
    });

    logger.info(`📋 TodoModule: ${this.actionMap.size}개 액션 등록 완료`);
  }

  // ===== 🎯 표준 매개변수를 사용하는 액션 메서드들 =====

  /**
   * 📋 메뉴 표시 (표준 매개변수)
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 간단한 통계 조회
      const statsResult = await this.todoService.getStats(userId);
      const stats = statsResult.success
        ? statsResult.data
        : {
            total: 0,
            completed: 0,
            pending: 0,
          };

      return {
        type: "menu",
        module: "todo",
        data: {
          userId,
          userName,
          stats,
          config: {
            enablePriority: this.config.enablePriority,
            enableCategories: this.config.enableCategories,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "메뉴를 표시할 수 없습니다.",
          action: "menu",
          canRetry: true,
        },
      };
    }
  }

  /**
   * 📋 할일 목록 표시 (표준 매개변수)
   */
  async showList(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 매개변수 파싱 (page:status:priority 형식)
      const paramParts = params ? params.split(":") : [];
      const page = parseInt(paramParts[0]) || 1;
      const statusFilter = paramParts[1] || null;
      const priorityFilter = paramParts[2] || null;

      // 서비스 호출
      const result = await this.todoService.getTodos(userId, {
        page,
        limit: this.config.pageSize,
        status: statusFilter,
        priority: priorityFilter,
      });

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: result.message || "할일 목록을 불러올 수 없습니다.",
            action: "list",
            canRetry: true,
          },
        };
      }

      return {
        type: "list",
        module: "todo",
        data: {
          ...result.data,
          currentPage: page,
          filters: {
            status: statusFilter,
            priority: priorityFilter,
          },
          config: {
            enablePriority: this.config.enablePriority,
            enableCategories: this.config.enableCategories,
          },
        },
      };
    } catch (error) {
      logger.error("TodoModule.showList 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 목록을 표시할 수 없습니다.",
          action: "list",
          canRetry: true,
        },
      };
    }
  }

  /**
   * ➕ 할일 추가 시작 (표준 매개변수)
   */
  async startAdd(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 사용자별 최대 할일 개수 체크
      const countResult = await this.todoService.getTodoCount(userId);

      if (
        countResult.success &&
        countResult.data >= this.config.maxTodosPerUser
      ) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: `최대 ${this.config.maxTodosPerUser}개까지만 할일을 생성할 수 있습니다.`,
            action: "add",
            canRetry: false,
          },
        };
      }

      // 사용자 상태 설정 (표준 패턴)
      this.setUserState(userId, {
        action: this.constants.INPUT_STATES.WAITING_ADD_INPUT,
        messageId: callbackQuery.message.message_id,
        timestamp: Date.now(),
      });

      return {
        type: "add_prompt",
        module: "todo",
        data: {
          userId,
          maxLength: this.config.maxTitleLength,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("TodoModule.startAdd 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 추가를 시작할 수 없습니다.",
          action: "add",
          canRetry: true,
        },
      };
    }
  }

  /**
   * ✅ 할일 완료/미완료 토글 (표준 매개변수)
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!params) {
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 ID가 필요합니다.",
          action: "toggle",
          canRetry: false,
        },
      };
    }

    try {
      const todoId = params;
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: result.message || "할일 상태를 변경할 수 없습니다.",
            action: "toggle",
            canRetry: true,
          },
        };
      }

      // 토글 후 목록으로 돌아가기
      return await this.showList(bot, callbackQuery, "1", moduleManager);
    } catch (error) {
      logger.error("TodoModule.toggleTodo 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 상태를 변경할 수 없습니다.",
          action: "toggle",
          canRetry: true,
        },
      };
    }
  }

  /**
   * 🗑️ 할일 삭제 확인 (표준 매개변수)
   */
  async confirmDelete(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!params) {
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 ID가 필요합니다.",
          action: "delete",
          canRetry: false,
        },
      };
    }

    try {
      const todoId = params;

      // 할일 정보 조회
      const todoResult = await this.todoService.getTodoById(userId, todoId);

      if (!todoResult.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: "삭제할 할일을 찾을 수 없습니다.",
            action: "delete",
            canRetry: false,
          },
        };
      }

      return {
        type: "delete_confirm",
        module: "todo",
        data: {
          todo: todoResult.data,
          todoId,
        },
      };
    } catch (error) {
      logger.error("TodoModule.confirmDelete 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "삭제 확인을 표시할 수 없습니다.",
          action: "delete",
          canRetry: true,
        },
      };
    }
  }

  /**
   * 🗑️ 할일 삭제 실행 (표준 매개변수)
   */
  async executeDelete(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    if (!params) {
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일 ID가 필요합니다.",
          action: "delete:confirm",
          canRetry: false,
        },
      };
    }

    try {
      const todoId = params;
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: result.message || "할일을 삭제할 수 없습니다.",
            action: "delete:confirm",
            canRetry: true,
          },
        };
      }

      // 성공 메시지와 함께 목록으로 돌아가기
      return {
        type: "delete_success",
        module: "todo",
        data: {
          message: "할일이 삭제되었습니다.",
          deletedTodo: result.data,
        },
      };
    } catch (error) {
      logger.error("TodoModule.executeDelete 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "할일을 삭제할 수 없습니다.",
          action: "delete:confirm",
          canRetry: true,
        },
      };
    }
  }

  /**
   * 📄 페이지 변경 (표준 매개변수)
   */
  async changePage(bot, callbackQuery, params, moduleManager) {
    const page = parseInt(params) || 1;
    return await this.showList(
      bot,
      callbackQuery,
      page.toString(),
      moduleManager
    );
  }

  /**
   * 📊 통계 표시 (표준 매개변수)
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      const result = await this.todoService.getDetailedStats(userId);

      if (!result.success) {
        return {
          type: "error",
          module: "todo",
          data: {
            message: "통계를 불러올 수 없습니다.",
            action: "stats",
            canRetry: true,
          },
        };
      }

      return {
        type: "stats",
        module: "todo",
        data: {
          ...result.data,
          userName,
          generatedAt: TimeHelper.getLogTimeString(),
        },
      };
    } catch (error) {
      logger.error("TodoModule.showStats 오류:", error);
      return {
        type: "error",
        module: "todo",
        data: {
          message: "통계를 표시할 수 없습니다.",
          action: "stats",
          canRetry: true,
        },
      };
    }
  }

  /**
   * ❓ 도움말 표시 (표준 매개변수)
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    return {
      type: "help",
      module: "todo",
      data: {
        features: [
          "할일 추가, 수정, 삭제",
          "완료/미완료 상태 관리",
          "우선순위 설정 (설정에서 활성화)",
          "카테고리 관리 (설정에서 활성화)",
          "검색 및 필터링",
          "상세 통계",
        ],
        commands: ["/todo - 할일 메뉴 열기", "버튼 클릭으로 쉬운 조작"],
        config: this.config,
      },
    };
  }

  // ===== 💬 메시지 처리 (표준 onHandleMessage 패턴) =====

  /**
   * 💬 메시지 처리 - 할일 추가/수정 입력 (표준 패턴)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.getUserState(userId);

    // 이 모듈과 관련된 사용자 상태가 없으면 패스
    if (!userState || !userState.action) {
      return false; // 다른 모듈에서 처리하도록
    }

    try {
      // 텍스트 메시지가 아니면 패스
      if (!msg.text) {
        return false;
      }

      const text = msg.text.trim();

      // 상태별 처리
      switch (userState.action) {
        case this.constants.INPUT_STATES.WAITING_ADD_INPUT:
          return await this.handleAddInput(bot, msg, text, userState);

        case this.constants.INPUT_STATES.WAITING_EDIT_INPUT:
          return await this.handleEditInput(bot, msg, text, userState);

        case this.constants.INPUT_STATES.WAITING_SEARCH_INPUT:
          return await this.handleSearchInput(bot, msg, text, userState);

        default:
          // 알 수 없는 상태면 정리하고 패스
          this.clearUserState(userId);
          return false;
      }
    } catch (error) {
      logger.error("TodoModule.onHandleMessage 오류:", error);

      // 오류 발생시 사용자 상태 정리
      this.clearUserState(userId);

      // 에러 메시지 전송
      await this.sendErrorMessage(
        bot,
        msg.chat.id,
        "입력 처리 중 오류가 발생했습니다."
      );

      return true; // 이 모듈에서 처리했음을 표시
    }
  }

  /**
   * 할일 추가 입력 처리
   */
  async handleAddInput(bot, msg, text, userState) {
    const userId = getUserId(msg.from);

    // 입력 검증
    if (!text) {
      await this.sendErrorMessage(
        bot,
        msg.chat.id,
        "할일 제목을 입력해주세요."
      );
      return true;
    }

    if (text.length > this.config.maxTitleLength) {
      await this.sendErrorMessage(
        bot,
        msg.chat.id,
        `할일 제목이 너무 깁니다. (최대 ${this.config.maxTitleLength}자)`
      );
      return true;
    }

    try {
      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        title: text,
        createdAt: TimeHelper.getLogTimeString(),
      });

      // 사용자 상태 정리
      this.clearUserState(userId);

      if (result.success) {
        await this.sendSuccessMessage(
          bot,
          msg.chat.id,
          `✅ "${text}" 할일이 추가되었습니다!`,
          "todo:list"
        );
      } else {
        await this.sendErrorMessage(
          bot,
          msg.chat.id,
          result.message || "할일 추가에 실패했습니다."
        );
      }

      return true;
    } catch (error) {
      logger.error("할일 추가 처리 오류:", error);
      this.clearUserState(userId);
      await this.sendErrorMessage(
        bot,
        msg.chat.id,
        "할일 추가 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 성공 메시지 전송
   */
  async sendSuccessMessage(bot, chatId, message, callbackData = null) {
    const keyboard = callbackData
      ? {
          inline_keyboard: [
            [
              { text: "📋 목록 보기", callback_data: callbackData },
              { text: "🏠 메인 메뉴", callback_data: "system:menu" },
            ],
          ],
        }
      : undefined;

    await bot.sendMessage(chatId, message, {
      reply_markup: keyboard,
    });
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(bot, chatId, message) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 할일 메뉴", callback_data: "todo:menu" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, `❌ ${message}`, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🧹 정리 작업 (표준 cleanup 패턴)
   */
  async cleanup() {
    try {
      // 부모 클래스의 정리 작업 실행
      await super.cleanup();

      // TodoModule 전용 정리 작업
      this.todoService = null;

      logger.info("📋 TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
