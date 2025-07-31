// src/modules/TodoModule.js - 완성도 높은 할일 관리 모듈

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 TodoModule - 완성도 높은 할일 관리 시스템
 *
 * 🎯 핵심 기능:
 * - 📋 할일 목록보기 (완료/미완료 분리)
 * - ➕ 새 할일 추가 (리마인더 옵션)
 * - ✅ 완료처리 (원터치)
 * - 🔍 검색 기능
 * - 📊 간단 통계 (완료율)
 * - 🔔 자동 리마인더 설정
 *
 * ✅ 표준 준수:
 * - BaseModule 상속
 * - 표준 매개변수 구조
 * - actionMap 방식
 * - SoC 준수
 */
class TodoModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ServiceBuilder 연결
    this.serviceBuilder = options.serviceBuilder || null;
    this.todoService = null;
    this.reminderService = null;

    // 모듈 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableReminders: process.env.ENABLE_TODO_REMINDERS !== "false",
      enableSearch: true,
      defaultPriority: 3,
      ...options.config,
    };

    // 사용자 입력 상태 관리
    this.inputStates = new Map();

    logger.info("[TodoModule] 모듈 생성", { version: "2.0.0" });
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("[TodoModule] 초기화 시작...");

      // ServiceBuilder를 통한 서비스 생성
      if (this.serviceBuilder) {
        this.todoService = await this.serviceBuilder.getOrCreate("todo", {
          config: this.config,
        });

        // 리마인더 서비스 연결 (옵션)
        if (this.config.enableReminders) {
          try {
            this.reminderService = await this.serviceBuilder.getOrCreate(
              "reminder",
              {
                config: this.config,
              }
            );
            logger.info("🔔 ReminderService 연결됨");
          } catch (error) {
            logger.warn(
              "⚠️ ReminderService 연결 실패, 리마인더 기능 비활성화:",
              error.message
            );
            this.config.enableReminders = false;
          }
        }
      }

      if (!this.todoService) {
        throw new Error("TodoService 생성 실패");
      }

      // 액션 등록
      this.setupActions();

      logger.success("TodoModule 초기화 완료");
    } catch (error) {
      logger.error("TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showTodoList,
      list: this.showTodoList,

      // CRUD 액션들
      add: this.promptAddTodo,
      "add:simple": this.promptAddSimple,
      "add:reminder": this.promptAddWithReminder,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,

      // 검색 및 필터
      search: this.promptSearch,
      "filter:completed": this.showCompleted,
      "filter:pending": this.showPending,

      // 통계 및 기타
      stats: this.showStats,
      help: this.showHelp,

      // 리마인더 관련
      "reminder:quick": this.setQuickReminder,
      "reminder:custom": this.setCustomReminder,
      "reminder:skip": this.addWithoutReminder,
    });
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 모듈 키워드 확인
    const keywords = [
      "todo",
      "todos",
      "task",
      "tasks",
      "할일",
      "할일목록",
      "태스크",
      "작업",
      "업무",
      "투두",
      "체크리스트",
    ];

    if (this.isModuleMessage(text, keywords)) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "todo"
      );
      return true;
    }

    // 사용자 입력 상태 처리
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  // ===== 📋 메인 액션 메서드들 =====

  /**
   * 📋 할일 목록 표시 (메인 화면)
   */
  async showTodoList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      logger.debug(`📋 할일 목록 요청 (사용자: ${userId})`);

      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      return {
        type: "list",
        module: "todo",
        data: {
          userName,
          todos: todos.map((todo) => this.formatTodoForDisplay(todo)),
          stats,
          enableReminders: this.config.enableReminders,
          enableSearch: this.config.enableSearch,
        },
      };
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      return {
        type: "error",
        message: "할일 목록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ➕ 할일 추가 프롬프트 (기본)
   */
  async promptAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`➕ 할일 추가 선택 (사용자: ${userId})`);

    return {
      type: "add_select",
      module: "todo",
      data: {
        enableReminders: this.config.enableReminders,
        quickReminderOptions: [
          { key: "30m", label: "30분 후", time: "30분 후" },
          { key: "1h", label: "1시간 후", time: "1시간 후" },
          { key: "lunch", label: "점심시간", time: "12:00" },
          { key: "evening", label: "저녁시간", time: "18:00" },
        ],
      },
    };
  }

  /**
   * ➕ 간단 할일 추가
   */
  async promptAddSimple(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      awaitingInput: true,
      inputType: "simple_todo",
      step: "text",
    });

    return {
      type: "input_prompt",
      module: "todo",
      data: {
        inputType: "simple_todo",
        message: "새로운 할일을 입력해주세요:",
        placeholder: "예: 장보기, 회의 준비, 운동하기",
      },
    };
  }

  /**
   * 🔔 리마인더와 함께 할일 추가
   */
  async promptAddWithReminder(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      awaitingInput: true,
      inputType: "todo_with_reminder",
      step: "text",
    });

    return {
      type: "input_prompt",
      module: "todo",
      data: {
        inputType: "todo_with_reminder",
        message: "리마인더와 함께 추가할 할일을 입력해주세요:",
        placeholder: "예: 병원 예약, 프레젠테이션 준비",
        showReminderNote: true,
      },
    };
  }

  /**
   * ✅ 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      logger.debug(`✅ 할일 토글 (사용자: ${userId}, ID: ${todoId})`);

      const updatedTodo = await this.todoService.toggleTodo(userId, todoId);

      if (!updatedTodo) {
        return {
          type: "error",
          message: "할일을 찾을 수 없습니다.",
        };
      }

      // 토글 후 목록 다시 표시
      return await this.showTodoList(
        bot,
        callbackQuery,
        "list",
        "",
        moduleManager
      );
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return {
        type: "error",
        message: "할일 상태 변경에 실패했습니다.",
      };
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoId = params;

    if (!todoId) {
      return {
        type: "error",
        message: "할일 ID가 필요합니다.",
      };
    }

    try {
      logger.debug(`🗑️ 할일 삭제 (사용자: ${userId}, ID: ${todoId})`);

      const deleted = await this.todoService.deleteTodo(userId, todoId);

      if (!deleted) {
        return {
          type: "error",
          message: "할일을 찾을 수 없습니다.",
        };
      }

      // 연결된 리마인더도 삭제
      if (this.reminderService && deleted.reminderId) {
        try {
          await this.reminderService.deleteReminder(deleted.reminderId);
        } catch (reminderError) {
          logger.warn("리마인더 삭제 실패:", reminderError);
        }
      }

      // 삭제 후 목록 다시 표시
      return await this.showTodoList(
        bot,
        callbackQuery,
        "list",
        "",
        moduleManager
      );
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return {
        type: "error",
        message: "할일 삭제에 실패했습니다.",
      };
    }
  }

  /**
   * 🔍 검색 프롬프트
   */
  async promptSearch(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      awaitingInput: true,
      inputType: "search",
      step: "keyword",
    });

    return {
      type: "input_prompt",
      module: "todo",
      data: {
        inputType: "search",
        message: "검색할 키워드를 입력해주세요:",
        placeholder: "예: 회의, 장보기, 운동",
      },
    };
  }

  /**
   * ✅ 완료된 할일만 표시
   */
  async showCompleted(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const todos = await this.todoService.getTodos(userId, {
        completed: true,
      });
      const stats = this.calculateStats(todos);

      return {
        type: "filtered_list",
        module: "todo",
        data: {
          filter: "completed",
          filterLabel: "완료된 할일",
          todos: todos.map((todo) => this.formatTodoForDisplay(todo)),
          stats,
        },
      };
    } catch (error) {
      logger.error("완료된 할일 조회 실패:", error);
      return {
        type: "error",
        message: "완료된 할일을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📋 미완료된 할일만 표시
   */
  async showPending(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const todos = await this.todoService.getTodos(userId, {
        completed: false,
      });
      const stats = this.calculateStats(todos);

      return {
        type: "filtered_list",
        module: "todo",
        data: {
          filter: "pending",
          filterLabel: "미완료 할일",
          todos: todos.map((todo) => this.formatTodoForDisplay(todo)),
          stats,
        },
      };
    } catch (error) {
      logger.error("미완료 할일 조회 실패:", error);
      return {
        type: "error",
        message: "미완료 할일을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateDetailedStats(todos);

      return {
        type: "stats",
        module: "todo",
        data: {
          stats,
          chartData: this.generateChartData(todos),
        },
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "todo",
      data: {
        features: [
          "📋 할일 목록 관리",
          "➕ 새 할일 추가",
          "✅ 완료 처리",
          "🔍 할일 검색",
          "📊 완료율 통계",
        ],
        reminderFeatures: this.config.enableReminders
          ? ["🔔 리마인더 설정", "⏰ 빠른 시간 설정", "📱 텔레그램 알림"]
          : [],
        commands: ["/todo - 할일 메뉴 열기", "텍스트 입력으로 할일 추가"],
      },
    };
  }

  // ===== 🔔 리마인더 관련 메서드들 =====

  /**
   * ⏰ 빠른 리마인더 설정
   */
  async setQuickReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const [todoText, reminderType] = params.split("|");

    if (!todoText || !reminderType) {
      return {
        type: "error",
        message: "할일 내용과 리마인더 시간이 필요합니다.",
      };
    }

    try {
      const reminderTime = this.calculateQuickReminderTime(reminderType);
      const todo = await this.createTodoWithReminder(
        userId,
        todoText,
        reminderTime
      );

      return {
        type: "add_success",
        module: "todo",
        data: {
          todo: this.formatTodoForDisplay(todo),
          reminderTime: TimeHelper.format(reminderTime, "MM월 DD일 HH:mm"),
          reminderType,
        },
      };
    } catch (error) {
      logger.error("빠른 리마인더 설정 실패:", error);
      return {
        type: "error",
        message: "리마인더 설정에 실패했습니다.",
      };
    }
  }

  /**
   * 🔔 커스텀 리마인더 설정
   */
  async setCustomReminder(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoText = params;

    if (!todoText) {
      return {
        type: "error",
        message: "할일 내용이 필요합니다.",
      };
    }

    this.setUserState(userId, {
      awaitingInput: true,
      inputType: "custom_reminder",
      step: "time",
      data: { todoText },
    });

    return {
      type: "input_prompt",
      module: "todo",
      data: {
        inputType: "custom_reminder",
        message: "리마인더 시간을 입력해주세요:",
        placeholder: "예: 오후 3시, 내일 9시, 2시간 후",
        examples: ["30분 후", "오후 2시", "내일 오전 9시", "금요일 오후 5시"],
      },
    };
  }

  /**
   * ➕ 리마인더 없이 추가
   */
  async addWithoutReminder(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const todoText = params;

    if (!todoText) {
      return {
        type: "error",
        message: "할일 내용이 필요합니다.",
      };
    }

    try {
      const todo = await this.todoService.addTodo(userId, { text: todoText });

      return {
        type: "add_success",
        module: "todo",
        data: {
          todo: this.formatTodoForDisplay(todo),
          withReminder: false,
        },
      };
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      return {
        type: "error",
        message: "할일 추가에 실패했습니다.",
      };
    }
  }

  // ===== 🎯 사용자 입력 처리 =====

  /**
   * 📝 사용자 입력 처리
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    try {
      switch (userState.inputType) {
        case "simple_todo":
          return await this.handleSimpleTodoInput(bot, msg, text, userState);

        case "todo_with_reminder":
          return await this.handleTodoWithReminderInput(
            bot,
            msg,
            text,
            userState
          );

        case "search":
          return await this.handleSearchInput(bot, msg, text, userState);

        case "custom_reminder":
          return await this.handleCustomReminderInput(
            bot,
            msg,
            text,
            userState
          );

        default:
          this.clearUserState(userId);
          return false;
      }
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.clearUserState(userId);

      await bot.sendMessage(chatId, "❌ 입력 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  /**
   * 📝 간단 할일 입력 처리
   */
  async handleSimpleTodoInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const todoText = text.trim();

    if (!todoText || todoText.length < 2) {
      await bot.sendMessage(chatId, "❌ 할일은 최소 2글자 이상 입력해주세요.");
      return true;
    }

    if (todoText.length > 200) {
      await bot.sendMessage(chatId, "❌ 할일은 200글자 이하로 입력해주세요.");
      return true;
    }

    try {
      const todo = await this.todoService.addTodo(userId, { text: todoText });

      await bot.sendMessage(
        chatId,
        `✅ 할일이 추가되었습니다!\n📋 "${todoText}"`
      );

      this.clearUserState(userId);
      return true;
    } catch (error) {
      logger.error("간단 할일 추가 실패:", error);
      await bot.sendMessage(chatId, "❌ 할일 추가에 실패했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  /**
   * 🔔 리마인더 할일 입력 처리
   */
  async handleTodoWithReminderInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const todoText = text.trim();

    if (!todoText || todoText.length < 2) {
      await bot.sendMessage(chatId, "❌ 할일은 최소 2글자 이상 입력해주세요.");
      return true;
    }

    // 다음 단계: 리마인더 시간 입력 대기
    this.setUserState(userId, {
      awaitingInput: true,
      inputType: "custom_reminder",
      step: "time",
      data: { todoText },
    });

    await bot.sendMessage(
      chatId,
      `📋 할일: "${todoText}"\n\n🔔 리마인더 시간을 입력해주세요:\n\n💡 예시: 30분 후, 오후 3시, 내일 9시`
    );

    return true;
  }

  /**
   * 🔍 검색 입력 처리
   */
  async handleSearchInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const keyword = text.trim();

    if (!keyword || keyword.length < 1) {
      await bot.sendMessage(chatId, "❌ 검색 키워드를 입력해주세요.");
      return true;
    }

    try {
      const searchResults = await this.todoService.searchTodos(userId, keyword);

      if (searchResults.length === 0) {
        await bot.sendMessage(
          chatId,
          `🔍 "${keyword}"에 대한 검색 결과가 없습니다.`
        );
      } else {
        let message = `🔍 "${keyword}" 검색 결과 (${searchResults.length}개):\n\n`;

        searchResults.forEach((todo, index) => {
          const status = todo.completed ? "✅" : "📋";
          message += `${index + 1}. ${status} ${todo.text}\n`;
        });

        await bot.sendMessage(chatId, message);
      }

      this.clearUserState(userId);
      return true;
    } catch (error) {
      logger.error("검색 실패:", error);
      await bot.sendMessage(chatId, "❌ 검색 중 오류가 발생했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  /**
   * ⏰ 커스텀 리마인더 시간 입력 처리
   */
  async handleCustomReminderInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    const timeText = text.trim();
    const { todoText } = userState.data;

    try {
      const reminderTime = this.parseReminderTime(timeText);

      if (!reminderTime) {
        await bot.sendMessage(
          chatId,
          "❌ 시간 형식을 인식할 수 없습니다.\n\n💡 예시: 30분 후, 오후 3시, 내일 9시"
        );
        return true;
      }

      // 과거 시간 체크
      if (TimeHelper.isBefore(reminderTime, TimeHelper.now())) {
        await bot.sendMessage(
          chatId,
          "❌ 과거 시간으로는 리마인더를 설정할 수 없습니다."
        );
        return true;
      }

      const todo = await this.createTodoWithReminder(
        userId,
        todoText,
        reminderTime
      );

      await bot.sendMessage(
        chatId,
        `✅ 리마인더와 함께 할일이 추가되었습니다!\n\n📋 "${todoText}"\n🔔 ${TimeHelper.format(
          reminderTime,
          "MM월 DD일 HH:mm"
        )}에 알림`
      );

      this.clearUserState(userId);
      return true;
    } catch (error) {
      logger.error("커스텀 리마인더 설정 실패:", error);
      await bot.sendMessage(chatId, "❌ 리마인더 설정에 실패했습니다.");
      this.clearUserState(userId);
      return true;
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 🔔 리마인더와 함께 할일 생성
   */
  async createTodoWithReminder(userId, todoText, reminderTime) {
    // 할일 먼저 추가
    const todo = await this.todoService.addTodo(userId, { text: todoText });

    // 리마인더 설정 (ReminderService가 있는 경우)
    if (this.reminderService && this.config.enableReminders) {
      try {
        const reminder = await this.reminderService.createReminder({
          userId,
          title: `📝 할일 리마인더`,
          message: `📝 리마인더: ${todoText} 시간입니다!`,
          scheduledTime: reminderTime,
          type: "todo",
          relatedId: todo._id.toString(),
        });

        // 할일에 리마인더 ID 연결
        await this.todoService.updateTodo(userId, todo._id.toString(), {
          reminderId: reminder._id.toString(),
        });

        logger.info(`🔔 할일 리마인더 설정: ${todoText} @ ${reminderTime}`);
      } catch (error) {
        logger.warn("리마인더 설정 실패:", error);
        // 리마인더 실패해도 할일은 유지
      }
    }

    return todo;
  }

  /**
   * ⏰ 빠른 리마인더 시간 계산
   */
  calculateQuickReminderTime(reminderType) {
    const now = TimeHelper.now();

    switch (reminderType) {
      case "30m":
        return TimeHelper.addMinutes(now, 30);
      case "1h":
        return TimeHelper.addHours(now, 1);
      case "lunch":
        const lunch = TimeHelper.setTime(now, 12, 0, 0);
        return TimeHelper.isBefore(lunch, now)
          ? TimeHelper.addDays(lunch, 1)
          : lunch;
      case "evening":
        const evening = TimeHelper.setTime(now, 18, 0, 0);
        return TimeHelper.isBefore(evening, now)
          ? TimeHelper.addDays(evening, 1)
          : evening;
      default:
        return TimeHelper.addHours(now, 1);
    }
  }

  /**
   * 🕐 리마인더 시간 파싱
   */
  parseReminderTime(timeText) {
    try {
      const now = TimeHelper.now();
      const lowerText = timeText.toLowerCase().trim();

      // 상대적 시간 ("30분 후", "2시간 후")
      const relativeMatch = lowerText.match(/(\d+)\s*(분|시간)\s*후/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];

        if (unit === "분") {
          return TimeHelper.addMinutes(now, amount);
        } else if (unit === "시간") {
          return TimeHelper.addHours(now, amount);
        }
      }

      // 절대적 시간 ("오후 3시", "내일 9시")
      const timeMatch = lowerText.match(
        /(내일|모레)?\s*(오전|오후)?\s*(\d+)시(?:\s*(\d+)분)?/
      );
      if (timeMatch) {
        const dayOffset =
          timeMatch[1] === "내일" ? 1 : timeMatch[1] === "모레" ? 2 : 0;
        const period = timeMatch[2];
        let hour = parseInt(timeMatch[3]);
        const minute = parseInt(timeMatch[4]) || 0;

        // 오후 처리
        if (period === "오후" && hour !== 12) {
          hour += 12;
        } else if (period === "오전" && hour === 12) {
          hour = 0;
        }

        let target = TimeHelper.setTime(now, hour, minute, 0);
        if (dayOffset > 0) {
          target = TimeHelper.addDays(target, dayOffset);
        } else if (TimeHelper.isBefore(target, now)) {
          // 오늘인데 시간이 지났으면 내일
          target = TimeHelper.addDays(target, 1);
        }

        return target;
      }

      return null;
    } catch (error) {
      logger.error("리마인더 시간 파싱 실패:", error);
      return null;
    }
  }

  /**
   * 📊 통계 계산
   */
  calculateStats(todos) {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * 📊 상세 통계 계산
   */
  calculateDetailedStats(todos) {
    const basicStats = this.calculateStats(todos);

    // 최근 7일간 통계
    const sevenDaysAgo = TimeHelper.addDays(TimeHelper.now(), -7);
    const recentTodos = todos.filter(
      (t) => new Date(t.createdAt) >= sevenDaysAgo
    );
    const recentCompleted = recentTodos.filter((t) => t.completed).length;

    return {
      ...basicStats,
      recent: {
        added: recentTodos.length,
        completed: recentCompleted,
        productivity:
          recentTodos.length > 0
            ? Math.round((recentCompleted / recentTodos.length) * 100)
            : 0,
      },
      averagePerDay: Math.round(todos.length / 30), // 한달 기준
    };
  }

  /**
   * 📊 차트 데이터 생성
   */
  generateChartData(todos) {
    // 간단한 완료율 차트 데이터
    const stats = this.calculateStats(todos);

    return {
      labels: ["완료", "미완료"],
      data: [stats.completed, stats.pending],
      colors: ["#4CAF50", "#FFC107"],
    };
  }

  /**
   * 🎨 할일 표시용 포맷팅
   */
  formatTodoForDisplay(todo) {
    return {
      id: todo._id ? todo._id.toString() : todo.id || "unknown",
      text: todo.text || "제목 없음",
      completed: todo.completed || false,
      createdAt: todo.createdAt || new Date(),
      hasReminder: !!todo.reminderId,
      displayText:
        todo.text.length > 50 ? todo.text.substring(0, 47) + "..." : todo.text,
      createdRelative: TimeHelper.fromNow(todo.createdAt),
    };
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceConnected: !!this.todoService,
      reminderServiceConnected: !!this.reminderService,
      activeInputStates: this.inputStates.size,
      config: {
        maxTodosPerUser: this.config.maxTodosPerUser,
        enableReminders: this.config.enableReminders,
        enableSearch: this.config.enableSearch,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 입력 상태 정리
      this.inputStates.clear();

      // 부모 클래스 정리 호출
      await super.cleanup();

      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
