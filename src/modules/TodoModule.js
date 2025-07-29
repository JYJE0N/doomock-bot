// src/modules/TodoModule.js - 표준화된 최종 수정 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 TodoModule - 단순하고 재미있는 할일 관리
 *
 * 🎯 핵심 기능:
 * - 📋 할일 목록보기
 * - ➕ 새 할일 추가 (간단 입력)
 * - ✅ 완료처리 (원터치)
 * - 🗑️ 삭제 (바로 삭제)
 * - 📊 간단 완료율
 *
 * ✅ 표준 준수:
 * - BaseModule 상속
 * - 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
 * - actionMap 방식
 * - onInitialize/onHandleMessage 패턴
 * - 단일 책임 원칙
 */
class TodoModule extends BaseModule {
  /**
   * 🏗️ 생성자 - 표준 매개변수 구조 준수
   */
  constructor(moduleName, options = {}) {
    // 🔥 핵심 수정: options 구조 올바르게 사용
    super(moduleName, options);

    // ServiceBuilder에서 서비스 주입
    this.serviceBuilder = options.serviceBuilder || null;
    this.todoService = null;

    // 🔔 ReminderService도 주입받기
    this.reminderService = null;

    // 모듈 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableReminders: process.env.ENABLE_TODO_REMINDERS !== "false", // 🔔 기본 활성화
      ...options.config,
    };

    logger.info("📋 TodoModule 생성됨 - 리마인더 통합! 🔔", {
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      hasServiceBuilder: !!this.serviceBuilder,
      config: this.config,
    });
  }

  /**
   * 🔑 TodoModule 키워드 정의
   */
  getModuleKeywords() {
    return [
      // 한국어 키워드
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
  }

  /**
   * ✅ 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      logger.info("📋 TodoModule 초기화 시작...");

      // ServiceBuilder를 통한 서비스 연결
      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 필요합니다");
      }

      // TodoService 연결
      this.todoService = await this.serviceBuilder.getOrCreate("todo", {
        config: this.config,
      });

      if (!this.todoService) {
        throw new Error("TodoService를 찾을 수 없습니다");
      }

      // 🔔 ReminderService 연결 (리마인더 기능이 활성화된 경우)
      if (this.config.enableReminders) {
        try {
          this.reminderService = await this.serviceBuilder.getOrCreate(
            "reminder",
            {
              config: this.config,
            }
          );

          if (this.reminderService) {
            logger.info("🔔 ReminderService 연결됨 - 할일 리마인더 활성화");
          }
        } catch (error) {
          logger.warn(
            "⚠️ ReminderService 연결 실패, 리마인더 기능 비활성화:",
            error.message
          );
          this.config.enableReminders = false;
        }
      }

      // 액션 등록
      this.setupActions();

      logger.success("✅ TodoModule 초기화 완료 (리마인더 통합)");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 기본 액션들
      menu: this.showTodoList,
      list: this.showTodoList,

      // CRUD 액션들 - 단순화!
      add: this.promptAddTodo,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,

      // 🔔 리마인더 관련 액션들
      add_with_reminder: this.promptAddTodoWithReminder,
      set_reminder: this.setTodoReminder,
      quick_reminder: this.setQuickReminder,
      skip_reminder: this.addTodoWithoutReminder,

      // 통계 및 기타
      stats: this.showSimpleStats,
    });
  }

  // ===== 📋 메뉴 액션들 (표준 매개변수 준수) =====

  /**
   * 📋 할일 목록 표시 (메인 화면)
   */
  async showTodoList(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`📋 할일 목록 요청 (사용자: ${userId})`);

      const todos = await this.todoService.getTodos(userId);
      const completedCount = todos.filter((todo) => todo.completed).length;
      const totalCount = todos.length;

      // ✅ 순수 데이터만 반환 (UI는 NavigationHandler가 처리)
      return {
        type: "list", // ✅ 렌더러가 기대하는 타입
        module: "todo",
        data: {
          userName,
          todos: todos.map((todo) => ({
            id: todo._id ? todo._id.toString() : todo.id || "unknown",
            text: todo.text || "제목 없음",
            completed: todo.completed || false,
            createdAt: todo.createdAt || new Date(),
            hasReminder: !!todo.reminderId, // 🔔 리마인더 유무
          })),
          stats: {
            total: totalCount,
            completed: completedCount,
            pending: totalCount - completedCount,
            completionRate:
              totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0,
          },
          enableReminders: this.config.enableReminders, // 🔔 리마인더 기능 활성화 여부
        },
      };
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "할일 목록을 불러올 수 없습니다" },
      };
    }
  }

  /**
   * ➕ 할일 추가 입력 대기 (기본)
   */
  async promptAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    logger.info(`➕ 할일 추가 프롬프트 (사용자: ${userId})`);

    // 사용자 상태를 "입력 대기"로 설정
    this.setUserState(userId, {
      awaitingInput: true,
      action: "awaiting_todo_input",
      withReminder: false,
    });

    return {
      type: "add_prompt",
      module: "todo",
      data: {
        inputType: "todo_text",
        message: "새로운 할일을 입력해주세요:",
      },
    };
  }

  /**
   * ➕ 할일 추가 입력 대기 (리마인더 포함)
   */
  async promptAddTodoWithReminder(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    logger.info(`➕ 리마인더 포함 할일 추가 프롬프트 (사용자: ${userId})`);

    // 사용자 상태를 "입력 대기"로 설정
    this.setUserState(userId, {
      awaitingInput: true,
      action: "awaiting_todo_input",
      withReminder: true,
    });

    return {
      success: true,
      action: "prompt_add_todo_with_reminder",
      data: {
        type: "add_prompt_with_reminder",
        inputType: "todo_text",
        message: "새로운 할일을 입력해주세요 (리마인더 설정 포함):",
      },
    };
  }

  /**
   * ✅ 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        success: false,
        error: "할일 ID가 필요합니다",
        data: { type: "error", message: "할일 ID가 필요합니다" },
      };
    }

    try {
      logger.info(`✅ 할일 토글 (사용자: ${userId}, ID: ${todoId})`);

      const updatedTodo = await this.todoService.toggleTodo(userId, todoId);

      if (!updatedTodo) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
          data: { type: "error", message: "할일을 찾을 수 없습니다" },
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
        success: false,
        error: "할일 상태 변경에 실패했습니다",
        data: { type: "error", message: "할일 상태 변경에 실패했습니다" },
      };
    }
  }

  /**
   * 🗑️ 할일 삭제 (바로 삭제 - 확인 없음)
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    if (!todoId) {
      return {
        success: false,
        error: "할일 ID가 필요합니다",
        data: { type: "error", message: "할일 ID가 필요합니다" },
      };
    }

    try {
      logger.info(`🗑️ 할일 삭제 (사용자: ${userId}, ID: ${todoId})`);

      const deleted = await this.todoService.deleteTodo(userId, todoId);

      if (!deleted) {
        return {
          success: false,
          error: "할일을 찾을 수 없습니다",
          data: { type: "error", message: "할일을 찾을 수 없습니다" },
        };
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
        success: false,
        error: "할일 삭제에 실패했습니다",
        data: { type: "error", message: "할일 삭제에 실패했습니다" },
      };
    }
  }

  /**
   * 📊 간단한 통계 표시
   */
  async showSimpleStats(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`📊 간단 통계 요청 (사용자: ${userId})`);

      const todos = await this.todoService.getTodos(userId);
      const completedTodos = todos.filter((todo) => todo.completed);

      const stats = {
        total: todos.length,
        completed: completedTodos.length,
        pending: todos.length - completedTodos.length,
        completionRate:
          todos.length > 0
            ? Math.round((completedTodos.length / todos.length) * 100)
            : 0,
      };

      return {
        success: true,
        action: "show_stats",
        data: {
          type: "todo_stats",
          stats,
          recentTodos: todos.slice(-5), // 최근 5개
        },
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        success: false,
        error: "통계를 불러올 수 없습니다",
        data: { type: "error", message: "통계를 불러올 수 없습니다" },
      };
    }
  }

  // ===== 🔔 리마인더 관련 액션들 =====

  /**
   * 🔔 빠른 리마인더 설정
   */
  async setQuickReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const reminderType = params; // 예: "30m", "1h", "lunch", etc.

    try {
      const userState = this.getUserState(userId);
      if (!userState || !userState.todoText) {
        return {
          success: false,
          error: "할일 텍스트가 필요합니다",
          data: { type: "error", message: "할일 텍스트가 필요합니다" },
        };
      }

      // 빠른 리마인더 시간 계산
      const reminderTime = this.calculateQuickReminderTime(reminderType);
      if (!reminderTime) {
        return {
          success: false,
          error: "잘못된 리마인더 타입입니다",
          data: { type: "error", message: "잘못된 리마인더 타입입니다" },
        };
      }

      // 리마인더와 함께 할일 추가
      await this.createTodoWithReminder(
        userId,
        userState.todoText,
        reminderTime
      );

      // 사용자 상태 정리
      this.clearUserState(userId);

      // 성공 후 목록 표시
      return await this.showTodoList(
        bot,
        callbackQuery,
        "list",
        "",
        moduleManager
      );
    } catch (error) {
      logger.error("빠른 리마인더 설정 실패:", error);
      return {
        success: false,
        error: "리마인더 설정에 실패했습니다",
        data: { type: "error", message: "리마인더 설정에 실패했습니다" },
      };
    }
  }

  /**
   * ➕ 리마인더 없이 할일 추가
   */
  async addTodoWithoutReminder(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    try {
      const userState = this.getUserState(userId);
      if (!userState || !userState.todoText) {
        return {
          success: false,
          error: "할일 텍스트가 필요합니다",
          data: { type: "error", message: "할일 텍스트가 필요합니다" },
        };
      }

      // 리마인더 없이 할일 추가
      await this.todoService.addTodo(userId, { text: userState.todoText });

      // 사용자 상태 정리
      this.clearUserState(userId);

      logger.info(`✅ 할일 추가됨 (리마인더 없음): ${userState.todoText}`);

      // 성공 후 목록 표시
      return await this.showTodoList(
        bot,
        callbackQuery,
        "list",
        "",
        moduleManager
      );
    } catch (error) {
      logger.error("할일 추가 실패:", error);
      return {
        success: false,
        error: "할일 추가에 실패했습니다",
        data: { type: "error", message: "할일 추가에 실패했습니다" },
      };
    }
  }

  // ===== 🛠️ 사용자 입력 처리 =====

  /**
   * 📝 사용자 입력 처리 (상태 기반)
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (userState.action === "awaiting_todo_input") {
      // 할일 텍스트 입력 처리
      const todoText = text.trim();

      if (todoText.length === 0) {
        await bot.sendMessage(chatId, "할일 내용을 입력해주세요.");
        return true;
      }

      if (todoText.length > 200) {
        await bot.sendMessage(chatId, "할일 내용이 너무 깁니다. (최대 200자)");
        return true;
      }

      try {
        if (userState.withReminder && this.config.enableReminders) {
          // 리마인더 포함 모드
          this.setUserState(userId, {
            awaitingInput: true,
            action: "awaiting_reminder_time",
            todoText: todoText,
          });

          // 리마인더 시간 입력 프롬프트 표시
          if (this.moduleManager?.navigationHandler) {
            await this.moduleManager.navigationHandler.sendReminderTimePrompt(
              bot,
              chatId,
              { todoText }
            );
          } else {
            await bot.sendMessage(
              chatId,
              `📝 할일: ${todoText}\n\n` +
                "🔔 리마인더 시간을 자연어로 입력해주세요.\n" +
                "예: '30분 후', '내일 9시', '금요일 오후 2시'"
            );
          }
        } else {
          // 바로 추가 모드
          await this.todoService.addTodo(userId, { text: todoText });
          this.clearUserState(userId);

          await bot.sendMessage(
            chatId,
            `✅ 할일 '${todoText}'이(가) 추가되었습니다!`
          );

          // 목록 다시 표시
          setTimeout(() => {
            if (this.moduleManager?.navigationHandler) {
              this.moduleManager.navigationHandler.sendModuleMenu(
                bot,
                chatId,
                "todo"
              );
            }
          }, 1000);
        }

        return true;
      } catch (error) {
        logger.error("할일 추가 실패:", error);
        await bot.sendMessage(chatId, "❌ 할일 추가에 실패했습니다.");
        this.clearUserState(userId);
        return true;
      }
    }

    if (
      userState.action === "awaiting_reminder_time" &&
      this.config.enableReminders
    ) {
      // 리마인더 시간 입력 처리
      const reminderTime = this.parseReminderTime(text);

      if (!reminderTime) {
        await bot.sendMessage(
          chatId,
          "⚠️ 시간을 인식할 수 없습니다.\n" +
            "다시 입력해주세요. 예: '30분 후', '내일 9시', '금요일 오후 2시'"
        );
        return true;
      }

      try {
        // 리마인더와 함께 할일 추가
        await this.createTodoWithReminder(
          userId,
          userState.todoText,
          reminderTime
        );
        this.clearUserState(userId);

        const formattedTime = TimeHelper.format(reminderTime, "full");
        await bot.sendMessage(
          chatId,
          `✅ 할일이 추가되었습니다!\n` +
            `📝 내용: ${userState.todoText}\n` +
            `🔔 리마인더: ${formattedTime}`
        );

        // 목록 다시 표시
        setTimeout(() => {
          if (this.moduleManager?.navigationHandler) {
            this.moduleManager.navigationHandler.sendModuleMenu(
              bot,
              chatId,
              "todo"
            );
          }
        }, 1000);

        return true;
      } catch (error) {
        logger.error("리마인더 할일 추가 실패:", error);
        await bot.sendMessage(chatId, "❌ 할일 추가에 실패했습니다.");
        this.clearUserState(userId);
        return true;
      }
    }

    return false;
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
          title: `할일 리마인더: ${todoText}`,
          message: `📋 할일을 잊지 마세요: ${todoText}`,
          scheduledTime: reminderTime,
          type: "todo",
          relatedId: todo._id.toString(),
        });

        // 할일에 리마인더 ID 연결
        await this.todoService.updateTodo(userId, todo._id.toString(), {
          reminderId: reminder._id.toString(),
        });

        logger.info(`🔔 할일 리마인더 설정됨: ${todoText} @ ${reminderTime}`);
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
      case "dinner":
        const dinner = TimeHelper.setTime(now, 19, 0, 0);
        return TimeHelper.isBefore(dinner, now)
          ? TimeHelper.addDays(dinner, 1)
          : dinner;
      case "tomorrow_9":
        return TimeHelper.setTime(TimeHelper.addDays(now, 1), 9, 0, 0);
      case "tomorrow_19":
        return TimeHelper.setTime(TimeHelper.addDays(now, 1), 19, 0, 0);
      case "monday_am":
        return this.getNextWeekday(1, 9, 0); // 월요일 오전 9시
      case "friday_pm":
        return this.getNextWeekday(5, 14, 0); // 금요일 오후 2시
      default:
        return null;
    }
  }

  /**
   * 📅 다음 요일 계산
   */
  getNextWeekday(weekday, hour = 9, minute = 0) {
    const now = TimeHelper.now();
    let target = TimeHelper.setTime(now, hour, minute, 0);

    // 이번 주 해당 요일로 설정
    const currentWeekday = TimeHelper.getWeekday(target);
    const daysToAdd = (weekday - currentWeekday + 7) % 7;

    if (daysToAdd === 0 && TimeHelper.isBefore(target, now)) {
      // 오늘이 해당 요일인데 시간이 지났으면 다음 주
      target = TimeHelper.addDays(target, 7);
    } else if (daysToAdd > 0) {
      target = TimeHelper.addDays(target, daysToAdd);
    }

    return target;
  }

  /**
   * 🧠 자연어 리마인더 시간 파싱
   */
  parseReminderTime(text) {
    try {
      const now = TimeHelper.now();
      const lowerText = text.toLowerCase().trim();

      // 상대적 시간 ("30분 후", "2시간 후", "3일 후")
      const relativeMatch = lowerText.match(/(\d+)\s*(분|시간|일)\s*후/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];

        switch (unit) {
          case "분":
            return TimeHelper.addMinutes(now, amount);
          case "시간":
            return TimeHelper.addHours(now, amount);
          case "일":
            return TimeHelper.addDays(now, amount);
        }
      }

      // 절대적 시간 ("오후 3시", "내일 9시")
      const absoluteMatch = lowerText.match(
        /(내일|모레)?\s*(오전|오후)?\s*(\d+)시(?:\s*(\d+)분)?/
      );
      if (absoluteMatch) {
        const dayOffset =
          absoluteMatch[1] === "내일" ? 1 : absoluteMatch[1] === "모레" ? 2 : 0;
        const period = absoluteMatch[2];
        let hour = parseInt(absoluteMatch[3]);
        const minute = parseInt(absoluteMatch[4]) || 0;

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

      // 특별한 시간 표현
      if (lowerText.includes("점심") || lowerText.includes("lunch")) {
        const lunch = TimeHelper.setTime(now, 12, 0, 0);
        return TimeHelper.isBefore(lunch, now)
          ? TimeHelper.addDays(lunch, 1)
          : lunch;
      }

      if (lowerText.includes("저녁") || lowerText.includes("dinner")) {
        const dinner = TimeHelper.setTime(now, 19, 0, 0);
        return TimeHelper.isBefore(dinner, now)
          ? TimeHelper.addDays(dinner, 1)
          : dinner;
      }

      // 요일 기반 파싱
      const weekdays = {
        월요일: 1,
        월: 1,
        화요일: 2,
        화: 2,
        수요일: 3,
        수: 3,
        목요일: 4,
        목: 4,
        금요일: 5,
        금: 5,
        토요일: 6,
        토: 6,
        일요일: 0,
        일: 0,
      };

      for (const [dayName, weekday] of Object.entries(weekdays)) {
        if (lowerText.includes(dayName)) {
          const timeMatch = lowerText.match(/(\d+)시(?:\s*(\d+)분)?/);
          const hour = timeMatch ? parseInt(timeMatch[1]) : 9;
          const minute = timeMatch ? parseInt(timeMatch[2]) || 0 : 0;

          return this.getNextWeekday(weekday, hour, minute);
        }
      }

      return null;
    } catch (error) {
      logger.warn("리마인더 시간 파싱 실패:", error);
      return null;
    }
  }

  /**
   * 📊 모듈 상태 정보
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceStatus: this.todoService ? "Connected" : "Disconnected",
      reminderEnabled: this.config.enableReminders,
      activeUserStates: this.userStates.size,
      features: {
        basicTodo: true,
        reminders: this.config.enableReminders && !!this.reminderService,
        naturalLanguageParsing: true,
        quickReminders: true,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 모든 사용자 상태 정리
      this.userStates.clear();

      // 부모 클래스 정리 호출
      await super.cleanup();

      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
