// src/modules/TodoModule.js - 📝 할일 관리 모듈 (표준 준수)
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 📝 TodoModule - 할일 관리 모듈
 *
 * 🎯 핵심 기능:
 * - 할일 추가/완료/삭제
 * - 깔끔한 라디오버튼 UI
 * - 글자수 제한으로 UI 보호
 * - 완성/미완성/삭제 구분
 * - Mongoose 스키마 활용
 *
 * ✅ 표준 준수:
 * - BaseModule 상속
 * - actionMap 방식
 * - 표준 매개변수 체계
 * - MongooseManager 활용
 * - SRP & SoC 준수
 */
class TodoModule extends BaseModule {
  constructor(options = {}) {
    super("TodoModule", options);

    // 서비스 인스턴스
    this.todoService = null;

    // UI 설정
    this.config = {
      maxTextLength: 30, // UI 표시용 최대 글자수
      maxTodosPerPage: 8, // 페이지당 할일 개수
      enablePagination: true, // 페이지네이션 활성화
      showPriority: true, // 우선순위 표시
      showDueDate: false, // 마감일 표시 (간단한 UI를 위해 비활성화)
      ...options.config,
    };

    // 사용자 입력 상태 관리
    this.userInputStates = new Map();

    logger.info("📝 TodoModule 생성됨 - Mongoose 버전!");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("📝 TodoModule 초기화 시작...");

      // TodoService 초기화
      this.todoService = new TodoService({
        config: this.config,
      });

      await this.todoService.initialize();

      logger.success("✅ TodoModule 초기화 완료!");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정
   */
  setupActions() {
    this.registerActions({
      menu: this.showTodoMenu,
      list: this.showTodoList,
      add: this.handleAddTodo,
      toggle: this.handleToggleTodo,
      delete: this.handleDeleteTodo,
      complete: this.handleCompleteTodo,
      stats: this.showTodoStats,
      filter: this.handleFilterTodos,
      page: this.handlePageNavigation,
    });
  }

  /**
   * 🎯 모듈별 키워드
   */
  getModuleKeywords() {
    return ["할일", "todo", "📝"];
  }

  /**
   * 🎯 사용자 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const text = msg.text?.trim();

    if (!text) return false;

    // 사용자가 할일 입력 대기 중인지 확인
    const inputState = this.userInputStates.get(userId);
    if (inputState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, inputState);
    }

    // 간단한 할일 추가 (텍스트만 입력)
    if (text.length > 0 && !text.startsWith("/")) {
      return await this.handleQuickAdd(bot, msg, text);
    }

    return false;
  }

  // ===== 📋 액션 핸들러들 =====

  /**
   * 📋 할일 메뉴 표시
   */
  async showTodoMenu(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      // 간단한 통계 조회
      const todos = await this.todoService.getTodos(userId);
      const completedCount = todos.filter((t) => t.completed).length;
      const pendingCount = todos.filter((t) => !t.completed).length;

      const menuText =
        `📝 **할일 관리**\n\n` +
        `👋 안녕하세요, ${userName}님!\n\n` +
        `📊 **현재 상황**\n` +
        `▸ 미완료: ${pendingCount}개\n` +
        `▸ 완료: ${completedCount}개\n` +
        `▸ 총계: ${todos.length}개\n\n` +
        `🎯 원하는 작업을 선택해주세요:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "📊 통계 보기", callback_data: "todo:stats" },
            { text: "🔍 필터링", callback_data: "todo:filter" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return { success: true, module: "todo" };
    } catch (error) {
      logger.error("할일 메뉴 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 불러올 수 없습니다.");
      return { success: false, error: error.message };
    }
  }

  /**
   * 📋 할일 목록 표시 (라디오버튼 스타일)
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const page = parseInt(params[0]) || 1;

    try {
      const todos = await this.todoService.getTodos(userId, {
        sort: { completed: 1, createdAt: -1 }, // 미완료 먼저
      });

      if (todos.length === 0) {
        return await this.showEmptyTodoList(bot, callbackQuery);
      }

      // 페이지네이션 계산
      const itemsPerPage = this.config.maxTodosPerPage;
      const totalPages = Math.ceil(todos.length / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageTodos = todos.slice(startIndex, endIndex);

      // 리스트 텍스트 생성
      let listText = `📋 **할일 목록** (${page}/${totalPages} 페이지)\n\n`;

      pageTodos.forEach((todo, index) => {
        const globalIndex = startIndex + index;
        const status = todo.completed ? "✅" : "🔘"; // 입체감 있는 라디오버튼 스타일
        const truncatedText = this.truncateText(
          todo.text,
          this.config.maxTextLength
        );
        const priorityIcon = this.getPriorityIcon(todo.priority);

        listText += `${status} ${priorityIcon} ${truncatedText}`;
        if (todo.completed && todo.completedAt) {
          const completedTime = TimeHelper.format(todo.completedAt, "time");
          listText += ` _(${completedTime} 완료)_`;
        }
        listText += `\n`;
      });

      // 키보드 생성
      const keyboard = this.buildTodoListKeyboard(
        pageTodos,
        startIndex,
        page,
        totalPages
      );

      await bot.editMessageText(listText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return { success: true, module: "todo" };
    } catch (error) {
      logger.error("할일 목록 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "목록을 불러올 수 없습니다.");
      return { success: false, error: error.message };
    }
  }

  /**
   * ➕ 할일 추가 처리
   */
  async handleAddTodo(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      // 사용자 입력 상태 설정
      this.userInputStates.set(userId, {
        awaitingInput: true,
        inputType: "add_todo",
        chatId: callbackQuery.message.chat.id,
        messageId: callbackQuery.message.message_id,
        timestamp: Date.now(),
      });

      const instructionText =
        `➕ **새 할일 추가**\n\n` +
        `📝 할일 내용을 입력해주세요:\n\n` +
        `💡 **팁:**\n` +
        `▸ 간단하고 명확하게 작성하세요\n` +
        `▸ 최대 500자까지 가능합니다\n` +
        `▸ 취소하려면 /cancel을 입력하세요`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await bot.editMessageText(instructionText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return { success: true, module: "todo" };
    } catch (error) {
      logger.error("할일 추가 처리 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "할일 추가를 시작할 수 없습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔄 할일 완료/미완료 토글
   */
  async handleToggleTodo(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params[0];

    if (!todoId) {
      await this.sendError(bot, callbackQuery, "할일 ID가 필요합니다.");
      return { success: false, error: "Missing todo ID" };
    }

    try {
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (result.success) {
        const status = result.data.completed ? "완료" : "미완료";
        const message = `✅ 할일이 ${status} 상태로 변경되었습니다.`;

        // 목록 새로고침
        await this.showTodoList(bot, callbackQuery, [], moduleManager);

        // 간단한 알림 (선택사항)
        setTimeout(async () => {
          try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: message });
          } catch (e) {
            // 무시 (이미 응답된 경우)
          }
        }, 100);

        return { success: true, module: "todo", data: result.data };
      } else {
        await this.sendError(
          bot,
          callbackQuery,
          result.error || "토글에 실패했습니다."
        );
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      await this.sendError(bot, callbackQuery, "상태 변경에 실패했습니다.");
      return { success: false, error: error.message };
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async handleDeleteTodo(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params[0];

    if (!todoId) {
      await this.sendError(bot, callbackQuery, "할일 ID가 필요합니다.");
      return { success: false, error: "Missing todo ID" };
    }

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (result.success) {
        // 목록 새로고침
        await this.showTodoList(bot, callbackQuery, [], moduleManager);

        // 삭제 완료 알림
        setTimeout(async () => {
          try {
            await bot.answerCallbackQuery(callbackQuery.id, {
              text: "🗑️ 할일이 삭제되었습니다.",
              show_alert: false,
            });
          } catch (e) {
            // 무시
          }
        }, 100);

        return { success: true, module: "todo" };
      } else {
        await this.sendError(
          bot,
          callbackQuery,
          result.error || "삭제에 실패했습니다."
        );
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      await this.sendError(bot, callbackQuery, "삭제에 실패했습니다.");
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 할일 통계 표시
   */
  async showTodoStats(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      const todos = await this.todoService.getTodos(userId);
      const stats = this.calculateStats(todos);

      const statsText =
        `📊 **할일 통계**\n\n` +
        `📈 **전체 현황**\n` +
        `▸ 총 할일: ${stats.total}개\n` +
        `▸ 완료: ${stats.completed}개 (${stats.completionRate}%)\n` +
        `▸ 미완료: ${stats.pending}개\n\n` +
        `🎯 **우선순위별**\n` +
        `▸ 높음: ${stats.priority.high}개\n` +
        `▸ 보통: ${stats.priority.medium}개\n` +
        `▸ 낮음: ${stats.priority.low}개\n\n` +
        `📅 **최근 활동**\n` +
        `▸ 오늘 완료: ${stats.completedToday}개\n` +
        `▸ 이번 주 완료: ${stats.completedThisWeek}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await bot.editMessageText(statsText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return { success: true, module: "todo" };
    } catch (error) {
      logger.error("할일 통계 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "통계를 불러올 수 없습니다.");
      return { success: false, error: error.message };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 사용자 입력 처리
   */
  async handleUserInput(bot, msg, text, inputState) {
    const userId = getUserId(msg.from);

    try {
      if (inputState.inputType === "add_todo") {
        if (text === "/cancel" || text.toLowerCase() === "취소") {
          this.userInputStates.delete(userId);
          await bot.sendMessage(
            inputState.chatId,
            "➕ 할일 추가가 취소되었습니다."
          );
          return true;
        }

        // 할일 추가 처리
        const result = await this.todoService.addTodo(userId, {
          text: text,
          priority: 3, // 기본 우선순위
        });

        if (result.success) {
          this.userInputStates.delete(userId);

          const successText =
            `✅ **할일이 추가되었습니다!**\n\n` +
            `📝 ${result.data.text}\n\n` +
            `🎯 계속 관리하시겠어요?`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: "📋 목록 보기", callback_data: "todo:list" },
                { text: "➕ 더 추가", callback_data: "todo:add" },
              ],
              [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
            ],
          };

          await bot.sendMessage(inputState.chatId, successText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });

          return true;
        } else {
          await bot.sendMessage(
            inputState.chatId,
            `❌ 할일 추가 실패: ${result.error}`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.userInputStates.delete(userId);
      await bot.sendMessage(
        msg.chat.id,
        "❌ 입력 처리 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  /**
   * 빈 할일 목록 표시
   */
  async showEmptyTodoList(bot, callbackQuery) {
    const emptyText =
      `📋 **할일 목록**\n\n` +
      `🎉 아직 등록된 할일이 없습니다!\n\n` +
      `💡 첫 번째 할일을 추가해보세요:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
        [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
      ],
    };

    await bot.editMessageText(emptyText, {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    return { success: true, module: "todo" };
  }

  /**
   * 할일 목록 키보드 생성
   */
  buildTodoListKeyboard(todos, startIndex, currentPage, totalPages) {
    const keyboard = [];

    // 할일 항목들 (라디오버튼 스타일)
    todos.forEach((todo, index) => {
      const globalIndex = startIndex + index;
      const toggleText = todo.completed ? "✅" : "🔘"; // 입체감 있는 스타일
      const deleteText = "🗑️";

      keyboard.push([
        {
          text: `${toggleText} ${this.truncateText(todo.text, 25)}`,
          callback_data: `todo:toggle:${todo.id}`,
        },
        {
          text: deleteText,
          callback_data: `todo:delete:${todo.id}`,
        },
      ]);
    });

    // 페이지네이션 버튼
    if (totalPages > 1) {
      const paginationRow = [];

      if (currentPage > 1) {
        paginationRow.push({
          text: "◀️ 이전",
          callback_data: `todo:page:${currentPage - 1}`,
        });
      }

      paginationRow.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "todo:list",
      });

      if (currentPage < totalPages) {
        paginationRow.push({
          text: "다음 ▶️",
          callback_data: `todo:page:${currentPage + 1}`,
        });
      }

      keyboard.push(paginationRow);
    }

    // 하단 메뉴
    keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "📊 통계", callback_data: "todo:stats" },
    ]);
    keyboard.push([{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }]);

    return { inline_keyboard: keyboard };
  }

  /**
   * 텍스트 자르기 (UI 보호)
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text || "";
    }
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * 우선순위 아이콘
   */
  getPriorityIcon(priority) {
    switch (priority) {
      case 5:
      case 4:
        return "🔴"; // 높음
      case 3:
        return "🟡"; // 보통
      case 2:
      case 1:
        return "🟢"; // 낮음
      default:
        return "⚪"; // 기본
    }
  }

  /**
   * 통계 계산
   */
  calculateStats(todos) {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const pending = total - completed;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // 우선순위별 통계
    const priority = {
      high: todos.filter((t) => t.priority >= 4).length,
      medium: todos.filter((t) => t.priority === 3).length,
      low: todos.filter((t) => t.priority <= 2).length,
    };

    // 시간별 통계
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(
      today.getTime() - today.getDay() * 24 * 60 * 60 * 1000
    );

    const completedToday = todos.filter(
      (t) => t.completed && t.completedAt && new Date(t.completedAt) >= today
    ).length;

    const completedThisWeek = todos.filter(
      (t) =>
        t.completed && t.completedAt && new Date(t.completedAt) >= thisWeekStart
    ).length;

    return {
      total,
      completed,
      pending,
      completionRate,
      priority,
      completedToday,
      completedThisWeek,
    };
  }

  /**
   * 빠른 할일 추가 (메시지로 직접 입력)
   */
  async handleQuickAdd(bot, msg, text) {
    const userId = getUserId(msg.from);

    try {
      const result = await this.todoService.addTodo(userId, {
        text: text,
        priority: 3,
      });

      if (result.success) {
        const successText =
          `✅ 할일이 추가되었습니다!\n\n` +
          `📝 ${result.data.text}\n\n` +
          `할일 관리를 계속하시려면 /todo를 입력하세요.`;

        await bot.sendMessage(msg.chat.id, successText);
        return true;
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `❌ 할일 추가 실패: ${result.error}`
        );
        return true;
      }
    } catch (error) {
      logger.error("빠른 할일 추가 실패:", error);
      return false;
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const errorText = `❌ **오류 발생**\n\n${message}\n\n다시 시도해주세요.`;
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }],
        ],
      };

      await bot.editMessageText(errorText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 페이지 네비게이션 처리
   */
  async handlePageNavigation(bot, callbackQuery, params, moduleManager) {
    const page = parseInt(params[0]) || 1;
    return await this.showTodoList(
      bot,
      callbackQuery,
      [page.toString()],
      moduleManager
    );
  }

  /**
   * 필터링 처리 (간단한 버전)
   */
  async handleFilterTodos(bot, callbackQuery, params, moduleManager) {
    // 향후 구현 예정
    await this.sendError(bot, callbackQuery, "필터링 기능은 준비 중입니다.");
    return { success: false, error: "Not implemented" };
  }

  /**
   * 할일 완료 처리 (별도 액션)
   */
  async handleCompleteTodo(bot, callbackQuery, params, moduleManager) {
    // toggle과 동일한 로직
    return await this.handleToggleTodo(
      bot,
      callbackQuery,
      params,
      moduleManager
    );
  }

  /**
   * 모듈 정리
   */
  async cleanup() {
    try {
      // 사용자 입력 상태 정리
      this.userInputStates.clear();

      // 서비스 정리
      if (this.todoService) {
        await this.todoService.cleanup();
      }

      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }

  /**
   * 모듈 상태 정보
   */
  getStatus() {
    return {
      ...super.getStatus(),
      service: {
        initialized: !!this.todoService,
        activeInputs: this.userInputStates.size,
        config: this.config,
      },
    };
  }
}

module.exports = TodoModule;
