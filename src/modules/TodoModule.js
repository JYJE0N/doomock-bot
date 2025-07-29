// src/modules/TodoModule.js - 🎯 단순화된 할일 관리 (문법 오류 수정)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

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
   * 🔑 TodoModule 키워드 정의
   */
  getModuleKeywords() {
    return ["todo", "todos", "task", "tasks", "할일", "할일목록", "태스크"];
  }
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // ServiceBuilder에서 서비스 주입
    this.serviceBuilder = options.serviceBuilder || null;
    this.todoService = null;

    // 🔔 ReminderService도 주입받기
    this.reminderService = null;

    // 사용자 입력 상태 관리 (메모리 기반)
    this.userStates = new Map();

    // 모듈 설정
    this.config = {
      maxTodosPerUser: parseInt(process.env.MAX_TODOS_PER_USER) || 50,
      enableReminders: process.env.ENABLE_TODO_REMINDERS !== "false", // 🔔 기본 활성화
      ...options.config,
    };

    logger.info("📋 TodoModule 생성됨 - 리마인더 통합! 🔔");
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
      menu: this.showTodoList.bind(this), // 메인 화면 = 할일 목록
      list: this.showTodoList.bind(this), // 목록보기

      // CRUD 액션들 - 단순화!
      add: this.promptAddTodo.bind(this), // 추가 입력 대기
      toggle: this.toggleTodo.bind(this), // 완료/미완료 토글
      delete: this.deleteTodo.bind(this), // 바로 삭제 (확인 없음)

      // 🔔 리마인더 관련 액션 추가
      set_reminder: this.setTodoReminder.bind(this), // 리마인더 설정
      skip_reminder: this.addTodoWithoutReminder.bind(this), // 리마인더 없이 추가
      quick_reminder: this.setQuickReminder.bind(this), // 빠른 리마인더 설정

      // 부가 기능
      stats: this.showSimpleStats.bind(this), // 간단한 완료율만
      help: this.showHelp.bind(this), // 도움말
    });
  }

  /**
   * ✅ 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 📝 할일 입력 대기 상태 확인
    const userState = this.getUserState(userId);

    if (userState?.awaitingTodoInput) {
      return await this.handleTodoInput(bot, msg, text);
    }

    // 📋 명령어 확인 (todo, 할일, todos)
    const keywords = ["할일", "리마인드", "todo"];
    if (this.isModuleMessage(text, keywords)) {
      // NavigationHandler를 통해 메뉴 표시
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "todo"
      );
      return true;
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 📋 할일 목록 표시 (메인 화면)
   */
  async showTodoList(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`📋 할일 목록 요청 (사용자: ${userId})`);

      // 할일 목록 조회
      const todos = await this.todoService.getTodos(userId, {
        limit: 20,
        sort: { completed: 1, createdAt: -1 }, // 미완료 먼저, 최신순
      });

      // 간단한 통계
      const completedCount = todos.filter((todo) => todo.completed).length;
      const totalCount = todos.length;

      return {
        type: "list",
        module: "todo",
        data: {
          todos,
          stats: {
            completed: completedCount,
            total: totalCount,
            completionRate:
              totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0,
          },
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
   * ➕ 할일 추가 입력 대기 (리마인더 옵션 포함)
   */
  async promptAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    logger.info(`➕ 할일 추가 프롬프트 (사용자: ${userId})`);

    // 사용자 상태를 "입력 대기"로 설정
    this.setUserState(userId, { awaitingTodoInput: true });

    return {
      type: "add_prompt_with_reminder", // 🔔 리마인더 옵션 포함
      module: "todo",
      data: { inputType: "add" },
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
        type: "error",
        module: "todo",
        data: { message: "할일 ID가 필요합니다" },
      };
    }

    try {
      logger.info(`✅ 할일 토글 (사용자: ${userId}, ID: ${todoId})`);

      const updatedTodo = await this.todoService.toggleTodo(userId, todoId);

      if (!updatedTodo) {
        return {
          type: "error",
          module: "todo",
          data: { message: "할일을 찾을 수 없습니다" },
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
        module: "todo",
        data: { message: "할일 상태 변경에 실패했습니다" },
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
        type: "error",
        module: "todo",
        data: { message: "할일 ID가 필요합니다" },
      };
    }

    try {
      logger.info(`🗑️ 할일 삭제 (사용자: ${userId}, ID: ${todoId})`);

      const deleted = await this.todoService.deleteTodo(userId, todoId);

      if (!deleted) {
        return {
          type: "error",
          module: "todo",
          data: { message: "할일을 찾을 수 없습니다" },
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
        type: "error",
        module: "todo",
        data: { message: "할일 삭제에 실패했습니다" },
      };
    }
  }
  async handleUserInput(bot, msg, text, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (userState.action === "awaiting_todo_input") {
      // 할일 추가 처리
      const todoText = text.trim();

      if (todoText.length === 0) {
        await bot.sendMessage(chatId, "할일 내용을 입력해주세요.");
        return true;
      }

      try {
        await this.todoService.addTodo(userId, { text: todoText });
        this.clearUserState(userId);

        await bot.sendMessage(
          chatId,
          `✅ 할일 '${todoText}'이(가) 추가되었습니다!`
        );

        // 목록 다시 표시
        setTimeout(() => {
          this.moduleManager.navigationHandler.sendModuleMenu(
            bot,
            chatId,
            "todo"
          );
        }, 1000);

        return true;
      } catch (error) {
        logger.error("할일 추가 실패:", error);
        await bot.sendMessage(chatId, "❌ 할일 추가에 실패했습니다.");
        return true;
      }
    }

    return false;
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
        type: "stats",
        module: "todo",
        data: { stats },
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "통계를 불러올 수 없습니다" },
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
      data: {},
    };
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📝 할일 입력 처리 (리마인더 옵션 통합)
   */
  async handleTodoInput(bot, msg, text) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      // 상태 정보 확인
      const userState = this.getUserState(userId);

      // 리마인더 시간 입력 처리에서 Enhanced TimeHelper 활용
      if (userState?.awaitingReminderTime) {
        // 🔔 고급 시간 파싱 사용
        const reminderTime = this.parseReminderTime(text);

        if (!reminderTime) {
          await bot.sendMessage(
            chatId,
            `❌ 시간을 인식할 수 없습니다\\. 다시 입력해주세요\\!\n\n` +
              `💡 *다양한 표현을 지원합니다*:\n` +
              `• 상대시간: "30분 후", "2시간 후", "내일"\n` +
              `• 절대시간: "오후 3시", "월요일 10시"\n` +
              `• 자연어: "점심시간", "회의시간", "마감일"\n` +
              `• 특별한 날: "크리스마스", "설날", "주말에"`,
            { parse_mode: "MarkdownV2" }
          );
          return true;
        }

        // Enhanced TimeHelper로 시간 검증
        const TimeHelper = require("../utils/TimeHelper");
        const now = TimeHelper.now().toDate();

        if (reminderTime <= now) {
          const friendlyTime = TimeHelper.smartFormat(reminderTime, "reminder");
          await bot.sendMessage(
            chatId,
            `❌ 과거 시간으로는 설정할 수 없습니다\\.\n\n` +
              `입력하신 시간: ${TimeHelper.escapeMarkdownV2(friendlyTime)}\n` +
              `현재 시간보다 미래의 시간을 입력해주세요\\.`,
            { parse_mode: "MarkdownV2" }
          );
          return true;
        }

        // 할일과 리마인더 동시 생성
        const todoText = userState.pendingTodo;
        const savedTodo = await this.todoService.addTodo(userId, {
          text: todoText,
        });

        // 리마인더 생성
        await this.reminderService.createReminder(userId, {
          text: `📝 할일 리마인더: ${todoText}`,
          reminderTime: reminderTime,
          todoId: savedTodo.id,
          type: "todo_reminder",
        });

        // 상태 초기화
        this.clearUserState(userId);

        // 성공 메시지 (스마트 포맷팅 활용)
        const friendlyTime = TimeHelper.smartFormat(reminderTime, "reminder");
        const isWorkingTime = TimeHelper.isWorkingTime(reminderTime);
        const isWorkday = TimeHelper.isWorkday(reminderTime);

        let extraInfo = "";
        if (!isWorkday) {
          extraInfo += "\n🌴 주말/휴일 알림입니다";
        } else if (!isWorkingTime) {
          extraInfo += "\n🌙 업무시간 외 알림입니다";
        } else {
          extraInfo += "\n💼 업무시간 알림입니다";
        }

        await bot.sendMessage(
          chatId,
          `✅ 할일과 리마인더가 설정되었습니다\\!\n\n` +
            `📝 할일: ${todoText}\n` +
            `🔔 알림시간: ${TimeHelper.escapeMarkdownV2(
              friendlyTime
            )}${extraInfo}\n\n` +
            `정확한 시간에 알림을 보내드릴게요\\! 🎯`,
          { parse_mode: "MarkdownV2" }
        );

        // 목록 다시 표시
        setTimeout(() => {
          this.moduleManager.navigationHandler.sendModuleMenu(
            bot,
            chatId,
            "todo"
          );
        }, 2000);

        return true;
      }

      // 기본 할일 입력 처리
      const todoText = text.trim();

      // 상태 초기화
      this.clearUserState(userId);

      // 🔔 리마인더 기능이 활성화되어 있으면 선택 제공
      if (this.config.enableReminders && this.reminderService) {
        // 할일 임시 저장
        this.setUserState(userId, {
          pendingTodo: todoText,
          awaitingReminderChoice: true,
        });

        // 리마인더 선택 UI 표시
        await bot.sendMessage(
          chatId,
          `📝 할일 "${todoText}"이(가) 준비되었습니다!\n\n🔔 리마인더를 설정하시겠어요?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⏰ 시간 설정하기",
                    callback_data: "todo:set_reminder",
                  },
                  { text: "➕ 바로 추가", callback_data: "todo:skip_reminder" },
                ],
                [{ text: "❌ 취소", callback_data: "todo:menu" }],
              ],
            },
          }
        );

        return true;
      } else {
        // 리마인더 없이 바로 할일 추가
        await this.todoService.addTodo(userId, { text: todoText });

        await bot.sendMessage(
          chatId,
          `✅ 할일 '${todoText}'이(가) 추가되었습니다!`
        );

        // 목록 다시 표시
        setTimeout(() => {
          this.moduleManager.navigationHandler.sendModuleMenu(
            bot,
            chatId,
            "todo"
          );
        }, 1000);

        return true;
      }
    } catch (error) {
      logger.error("할일 입력 처리 실패:", error);
      await bot.sendMessage(
        chatId,
        "❌ 할일 추가에 실패했습니다. 다시 시도해주세요."
      );
      return true;
    }
  }

  /**
   * 🔔 리마인더 설정 액션
   */
  async setTodoReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const userState = this.getUserState(userId);
      const todoText = userState?.pendingTodo;

      if (!todoText) {
        return {
          type: "error",
          module: "todo",
          data: { message: "임시 저장된 할일을 찾을 수 없습니다" },
        };
      }

      // 리마인더 시간 입력 대기 상태로 변경
      this.setUserState(userId, {
        pendingTodo: todoText,
        awaitingReminderTime: true,
      });

      return {
        type: "reminder_time_prompt",
        module: "todo",
        data: {
          todoText,
          supportedExpressions: [
            // 상대 시간
            "30분 후",
            "2시간 후",
            "내일",
            "모레",
            // 절대 시간
            "오후 3시",
            "월요일 10시",
            "금요일 오후 2시",
            // 자연어
            "점심시간",
            "저녁시간",
            "회의시간",
            "마감일",
            // 특별한 날
            "주말에",
            "크리스마스",
            "설날",
          ],
        },
      };
    } catch (error) {
      logger.error("리마인더 설정 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "리마인더 설정에 실패했습니다" },
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
      const todoText = userState?.pendingTodo;

      if (!todoText) {
        return {
          type: "error",
          module: "todo",
          data: { message: "임시 저장된 할일을 찾을 수 없습니다" },
        };
      }

      // 할일 추가
      await this.todoService.addTodo(userId, { text: todoText });

      // 상태 초기화
      this.clearUserState(userId);

      logger.info(
        `➕ 리마인더 없이 할일 추가: ${todoText} (사용자: ${userId})`
      );

      // 성공 후 목록 표시
      return await this.showTodoList(
        bot,
        callbackQuery,
        "list",
        "",
        moduleManager
      );
    } catch (error) {
      logger.error("리마인더 없이 할일 추가 실패:", error);
      return {
        type: "error",
        module: "todo",
        data: { message: "할일 추가에 실패했습니다" },
      };
    }
  }

  /**
   * ⚡ 빠른 리마인더 설정
   */
  async setQuickReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const quickType = params; // 30m, 1h, lunch, dinner, etc.

    try {
      const userState = this.getUserState(userId);
      const todoText = userState?.pendingTodo;

      if (!todoText) {
        return {
          type: "error",
          module: "todo",
          data: { message: "임시 저장된 할일을 찾을 수 없습니다" },
        };
      }

      // 🕐 빠른 시간 계산 (Enhanced TimeHelper 활용)
      const TimeHelper = require("../utils/TimeHelper");
      let reminderTime;

      switch (quickType) {
        case "30m":
          reminderTime = TimeHelper.now().add(30, "minutes").toDate();
          break;
        case "1h":
          reminderTime = TimeHelper.now().add(1, "hour").toDate();
          break;
        case "lunch":
          reminderTime = TimeHelper.parseNaturalLanguage("점심시간");
          break;
        case "dinner":
          reminderTime = TimeHelper.parseNaturalLanguage("저녁시간");
          break;
        case "tomorrow_9":
          reminderTime = TimeHelper.parseNaturalLanguage("내일 9시");
          break;
        case "tomorrow_19":
          reminderTime = TimeHelper.parseNaturalLanguage("내일 저녁 7시");
          break;
        case "monday_am":
          reminderTime = TimeHelper.parseNaturalLanguage("월요일 오전 9시");
          break;
        case "friday_pm":
          reminderTime = TimeHelper.parseNaturalLanguage("금요일 오후 2시");
          break;
        default:
          reminderTime = TimeHelper.now().add(1, "hour").toDate();
      }

      if (!reminderTime || reminderTime <= new Date()) {
        return {
          type: "error",
          module: "todo",
          data: { message: "유효하지 않은 리마인더 시간입니다" },
        };
      }

      // 할일과 리마인더 동시 생성
      const savedTodo = await this.todoService.addTodo(userId, {
        text: todoText,
      });

      // 리마인더 생성
      await this.reminderService.createReminder(userId, {
        text: `📝 할일 리마인더: ${todoText}`,
        reminderTime: reminderTime,
        todoId: savedTodo.id,
        type: "todo_reminder",
      });

      // 상태 초기화
      this.clearUserState(userId);

      logger.info(
        `⚡ 빠른 리마인더 설정 완료: ${quickType} (사용자: ${userId})`
      );

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
        type: "error",
        module: "todo",
        data: { message: "리마인더 설정에 실패했습니다" },
      };
    }
  }

  /**
   * 🕐 고급 시간 파싱 (Enhanced TimeHelper 통합)
   */
  parseReminderTime(input) {
    const text = input.trim().toLowerCase();

    try {
      // moment 한국어 로케일 설정
      const moment = require("moment-timezone");
      moment.locale("ko");

      // 현재 한국 시간
      const now = moment.tz("Asia/Seoul");

      // === 1. 상대 시간 파싱 (moment의 강력한 기능) ===

      // "N분 후", "N시간 후", "N일 후"
      const relativeMatch = text.match(/(\d+)(분|시간|일)\s*후/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];

        const unitMap = { 분: "minutes", 시간: "hours", 일: "days" };
        return now.add(amount, unitMap[unit]).toDate();
      }

      // === 2. 절대 시간 파싱 (오늘 기준) ===

      // "오전/오후 N시" 패턴
      const timeMatch = text.match(/(오전|오후)\s*(\d+)시(?:\s*(\d+)분)?/);
      if (timeMatch) {
        const period = timeMatch[1];
        let hour = parseInt(timeMatch[2]);
        const minute = parseInt(timeMatch[3]) || 0;

        if (period === "오후" && hour !== 12) hour += 12;
        if (period === "오전" && hour === 12) hour = 0;

        const targetTime = now.clone().hour(hour).minute(minute).second(0);

        // 이미 지난 시간이면 내일로
        if (targetTime.isBefore(now)) {
          targetTime.add(1, "day");
        }

        return targetTime.toDate();
      }

      // "N시" 패턴 (24시간 형식)
      const hourMatch = text.match(/(\d+)시(?:\s*(\d+)분)?/);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1]);
        const minute = parseInt(hourMatch[2]) || 0;

        if (hour >= 0 && hour <= 23) {
          const targetTime = now.clone().hour(hour).minute(minute).second(0);

          if (targetTime.isBefore(now)) {
            targetTime.add(1, "day");
          }

          return targetTime.toDate();
        }
      }

      // === 3. 날짜 기반 파싱 (moment의 유연한 파싱) ===

      // "내일", "모레", "글피" 등
      const dayWords = {
        내일: 1,
        모레: 2,
        글피: 3,
        그글피: 4,
      };

      for (const [word, days] of Object.entries(dayWords)) {
        if (text.includes(word)) {
          const timeMatch = text.match(/(\d+)시(?:\s*(\d+)분)?/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]) || 0;

            return now
              .clone()
              .add(days, "day")
              .hour(hour)
              .minute(minute)
              .second(0)
              .toDate();
          } else {
            // 시간 지정 없으면 오전 9시로 기본 설정
            return now
              .clone()
              .add(days, "day")
              .hour(9)
              .minute(0)
              .second(0)
              .toDate();
          }
        }
      }

      // === 4. 요일 기반 파싱 (moment의 강력한 요일 처리) ===

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

      for (const [dayName, dayOfWeek] of Object.entries(weekdays)) {
        if (text.includes(dayName)) {
          const timeMatch = text.match(/(\d+)시(?:\s*(\d+)분)?/);
          const hour = timeMatch ? parseInt(timeMatch[1]) : 9;
          const minute = timeMatch ? parseInt(timeMatch[2]) || 0 : 0;

          // 다음 해당 요일 찾기
          let targetDay = now
            .clone()
            .day(dayOfWeek)
            .hour(hour)
            .minute(minute)
            .second(0);

          // 이번 주 해당 요일이 이미 지났으면 다음 주로
          if (targetDay.isSameOrBefore(now)) {
            targetDay.add(1, "week");
          }

          return targetDay.toDate();
        }
      }

      // === 5. 자연어 파싱 ===

      if (text.includes("점심시간") || text.includes("점심")) {
        const lunchTime = now.clone().hour(12).minute(0).second(0);
        if (lunchTime.isBefore(now)) {
          lunchTime.add(1, "day");
        }
        return lunchTime.toDate();
      }

      if (text.includes("저녁시간") || text.includes("저녁")) {
        const dinnerTime = now.clone().hour(19).minute(0).second(0);
        if (dinnerTime.isBefore(now)) {
          dinnerTime.add(1, "day");
        }
        return dinnerTime.toDate();
      }

      return null;
    } catch (error) {
      logger.warn("고급 시간 파싱 실패:", error);
      return null;
    }
  }

  /**
   * 👤 사용자 상태 관리 (메모리 기반)
   */
  getUserState(userId) {
    return this.userStates.get(String(userId));
  }

  setUserState(userId, state) {
    this.userStates.set(String(userId), state);
  }

  clearUserState(userId) {
    this.userStates.delete(String(userId));
  }

  /**
   * 📊 모듈 상태 정보
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceStatus: this.todoService ? "Connected" : "Disconnected",
      userStatesCount: this.userStates.size,
      stats: this.stats,
    };
  }
}

module.exports = TodoModule;
