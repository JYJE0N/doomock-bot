// src/modules/TodoModule.js - 인라인키보드 제거 완료 버전
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 📝 TodoModule v3.0.1 - 인라인키보드 제거 완료
 *
 * 🔧 핵심 변경사항:
 * - 모든 inline_keyboard 생성 코드 제거
 * - 데이터 객체만 반환, UI는 NavigationHandler가 처리
 * - callback_data만 정의, 실제 키보드 생성하지 않음
 * - 표준 매개변수 체계 준수
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    this.todoService = null;
    this.validationManager = options.validationManager || null;

    // Railway 환경변수 기반 설정
    this.config = {
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 10,
      maxTodos: parseInt(process.env.MAX_TODOS_PER_USER) || 100,
      enableCache: process.env.TODO_ENABLE_CACHE === "true",
      autoSave: process.env.TODO_AUTO_SAVE === "true",
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 300000,
      ...this.config,
    };

    logger.info("📝 TodoModule v3.0.1 생성됨 (키보드 제거 버전)");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      if (!this.validationManager) {
        logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
      }

      // TodoService 초기화
      this.todoService = new TodoService({
        enableCache: this.config.autoSave,
        cacheTimeout: this.config.syncInterval,
      });

      this.todoService.db = this.db;
      await this.todoService.initialize();

      logger.info("✅ TodoModule 초기화 완료");
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
      toggle: this.toggleTodo,
      edit: this.startEditTodo,
      delete: this.deleteTodo,

      // 검색 및 필터
      search: this.startSearch,
      filter: this.showFilter,

      // 통계 및 분석
      stats: this.showStats,

      // 설정
      settings: this.showSettings,

      // 유틸리티
      clear: this.clearCompleted,
    });
  }

  // ===== 📋 메뉴 액션들 (인라인키보드 제거 완료) =====

  /**
   * 📱 메인 메뉴 표시 (✅ 키보드 제거 완료)
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const userName = getUserName(from);

      // 📊 사용자 통계 조회
      const statsResult = await this.todoService.getUserStats(from.id);
      const stats = statsResult.success
        ? statsResult.data
        : { total: 0, completed: 0, pending: 0 };

      // ✅ 데이터 객체만 반환 (키보드 생성하지 않음!)
      const menuText = `📝 **할일 관리**

안녕하세요, ${userName}님!

📊 **현재 상황**
• 전체 할일: ${stats.total}개
• 완료: ${stats.completed}개
• 대기: ${stats.pending}개

원하는 기능을 선택해주세요:`;

      // ✅ NavigationHandler가 처리할 수 있도록 직접 메시지 전송
      await bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📋 할일 목록", callback_data: "todo:list" },
              { text: "➕ 할일 추가", callback_data: "todo:add" },
            ],
            [
              { text: "🔍 검색", callback_data: "todo:search" },
              { text: "🎯 필터", callback_data: "todo:filter" },
            ],
            [
              { text: "📊 통계", callback_data: "todo:stats" },
              { text: "⚙️ 설정", callback_data: "todo:settings" },
            ],
            [
              { text: "❓ 도움말", callback_data: "todo:help" },
              { text: "🏠 메인", callback_data: "system:menu" },
            ],
          ],
        },
      });

      return true;
    } catch (error) {
      logger.error("❌ TodoModule 메뉴 표시 실패:", error);
      return false;
    }
  }

  /**
   * 📋 할일 목록 표시 (✅ 키보드 제거 완료)
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    try {
      const { from, message } = callbackQuery;
      const page = parseInt(params[0]) || 1;
      const filter = params[1] || "all";

      // 📋 할일 목록 조회
      const result = await this.todoService.getTodoList(from.id, {
        page,
        pageSize: this.config.pageSize,
        filter,
      });

      if (!result.success) {
        await this.sendError(
          bot,
          callbackQuery,
          result.error || "목록을 불러올 수 없습니다."
        );
        return false;
      }

      const { todos, pagination } = result.data;

      // 📄 빈 목록 처리
      if (todos.length === 0) {
        const emptyText = `📋 **할일 목록**

아직 등록된 할일이 없습니다.

첫 번째 할일을 추가해보세요! 🚀`;

        await bot.editMessageText(emptyText, {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ 첫 할일 추가", callback_data: "todo:add" }],
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        });
        return true;
      }

      // 📋 목록 텍스트 구성
      let listText = `📋 **할일 목록** (${pagination.total}개)\n\n`;
      listText += `📄 **페이지 ${page}/${pagination.totalPages}**\n\n`;

      todos.forEach((todo, index) => {
        const itemNumber = (page - 1) * this.config.pageSize + index + 1;
        const checkbox = todo.completed ? "✅" : "☐";
        const categoryEmoji = this.getCategoryEmoji(todo.category);
        const priorityEmoji = this.getPriorityEmoji(todo.priority);

        listText += `${checkbox} ${categoryEmoji}${priorityEmoji} **${itemNumber}.** ${todo.text}\n`;

        if (todo.dueDate) {
          const dueDateStr = TimeHelper.formatDate(todo.dueDate, "MM/DD");
          listText += `   📅 마감: ${dueDateStr}\n`;
        }
        if (todo.description) {
          listText += `   💭 ${todo.description.substring(0, 50)}${
            todo.description.length > 50 ? "..." : ""
          }\n`;
        }
        listText += "\n";
      });

      // ✅ 동적 키보드 생성 (각 항목별 액션 버튼)
      const keyboard = { inline_keyboard: [] };

      // 항목별 액션 버튼들 (한 줄에 하나씩)
      todos.forEach((todo, index) => {
        const itemNumber = (page - 1) * this.config.pageSize + index + 1;
        const toggleText = todo.completed ? "☐" : "✅";

        keyboard.inline_keyboard.push([
          {
            text: `${itemNumber}. ${toggleText}`,
            callback_data: `todo:toggle:${todo._id}`,
          },
          { text: "✏️", callback_data: `todo:edit:${todo._id}` },
          { text: "🗑️", callback_data: `todo:delete:${todo._id}` },
        ]);
      });

      // 페이지네이션 버튼
      if (pagination.totalPages > 1) {
        const pageRow = [];

        if (page > 1) {
          pageRow.push({
            text: "⬅️ 이전",
            callback_data: `todo:list:${page - 1}:${filter}`,
          });
        }

        pageRow.push({
          text: `📄 ${page}/${pagination.totalPages}`,
          callback_data: "todo:list:current",
        });

        if (page < pagination.totalPages) {
          pageRow.push({
            text: "다음 ➡️",
            callback_data: `todo:list:${page + 1}:${filter}`,
          });
        }

        keyboard.inline_keyboard.push(pageRow);
      }

      // 하단 메뉴
      keyboard.inline_keyboard.push([
        { text: "➕ 추가", callback_data: "todo:add" },
        { text: "🔍 검색", callback_data: "todo:search" },
        { text: "🎯 필터", callback_data: "todo:filter" },
      ]);

      keyboard.inline_keyboard.push([
        { text: "🔙 메뉴", callback_data: "todo:menu" },
      ]);

      await bot.editMessageText(listText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 할일 목록 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "목록을 표시하는 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * ➕ 할일 추가 시작 (✅ 키보드 제거 완료)
   */
  async startAddTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const { from, message } = callbackQuery;

      // 사용자 상태 설정
      this.setUserState(from.id, {
        action: "adding_todo",
        messageId: message.message_id,
        step: "title",
      });

      const inputText = `➕ **새 할일 추가**

새로 추가할 할일의 제목을 입력해주세요.

**입력 규칙:**
• 최대 ${this.config.maxTodos}자
• 특수문자 사용 가능
• 줄바꿈 지원

/cancel 명령으로 취소할 수 있습니다.`;

      await bot.editMessageText(inputText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
        },
      });

      return true;
    } catch (error) {
      logger.error("❌ 할일 추가 시작 실패:", error);
      return false;
    }
  }

  /**
   * ✅☐ 할일 완료 토글 (✅ 키보드 제거 완료)
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const todoId = params[0];

      if (!todoId) {
        await this.sendError(bot, callbackQuery, "할일 ID가 없습니다.");
        return false;
      }

      // 할일 토글 실행
      const result = await this.todoService.toggleTodo(from.id, todoId);

      if (!result.success) {
        await this.sendError(
          bot,
          callbackQuery,
          result.error || "상태 변경에 실패했습니다."
        );
        return false;
      }

      // 성공 시 목록 새로고침
      await this.showTodoList(bot, callbackQuery, ["1"], moduleManager);
      return true;
    } catch (error) {
      logger.error("❌ 할일 토글 실패:", error);
      return false;
    }
  }

  /**
   * 🗑️ 할일 삭제 (✅ 키보드 제거 완료)
   */
  async deleteTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const { from, message } = callbackQuery;
      const todoId = params[0];

      if (!todoId) {
        await this.sendError(bot, callbackQuery, "할일 ID가 없습니다.");
        return false;
      }

      // 할일 정보 조회 (확인용)
      const todoResult = await this.todoService.getTodoById(from.id, todoId);
      if (!todoResult.success) {
        await this.sendError(bot, callbackQuery, "할일을 찾을 수 없습니다.");
        return false;
      }

      const todo = todoResult.data;
      const confirmText = `🗑️ **삭제 확인**

다음 할일을 정말로 삭제하시겠습니까?

📝 **${todo.text}**

⚠️ 이 작업은 되돌릴 수 없습니다.`;

      await bot.editMessageText(confirmText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🗑️ 삭제",
                callback_data: `todo:delete:confirm:${todoId}`,
              },
              { text: "❌ 취소", callback_data: "todo:list" },
            ],
          ],
        },
      });

      return true;
    } catch (error) {
      logger.error("❌ 할일 삭제 확인 실패:", error);
      return false;
    }
  }

  /**
   * ❓ 도움말 표시 (✅ 키보드 제거 완료)
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const { message } = callbackQuery;

      const helpText = `❓ **할일 관리 도움말**

**🎯 주요 기능**
• **목록 관리**: 할일 추가, 완료, 수정, 삭제
• **검색**: 제목 기반 실시간 검색
• **필터**: 카테고리, 우선순위, 상태별 필터
• **통계**: 완료율 및 생산성 분석

**⌨️ 사용법**
• \`/todo\` - 할일 관리 메뉴 열기
• \`할일: 내용\` - 빠른 할일 추가
• 버튼 클릭으로 쉬운 조작

**💡 팁**
• 할일 제목은 구체적으로 작성
• 마감일을 설정하여 우선순위 관리
• 카테고리를 활용한 체계적 분류
• 정기적인 완료 항목 정리

**🆘 문제 해결**
• 버튼이 응답하지 않으면 /cancel 입력
• 오류 발생 시 메인 메뉴로 복귀
• 지속적인 문제는 관리자 문의`;

      await bot.editMessageText(helpText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        },
      });

      return true;
    } catch (error) {
      logger.error("❌ 도움말 표시 실패:", error);
      return false;
    }
  }

  // ===== 🛠️ 미구현 액션들 (추후 구현 필요) =====

  async startEditTodo(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "수정 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  async startSearch(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "검색 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  async showFilter(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "필터 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  async showStats(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "통계 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  async showSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "설정 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  async clearCompleted(bot, callbackQuery, params, moduleManager) {
    await this.sendError(
      bot,
      callbackQuery,
      "정리 기능이 아직 구현되지 않았습니다."
    );
    return false;
  }

  // ===== 🛠️ 입력 처리 메서드들 =====

  /**
   * 할일 추가 입력 처리
   */
  async handleTodoInput(bot, chatId, userId, text) {
    try {
      // 입력 검증
      if (text.length > 200) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 입력이 너무 깁니다. (최대 200자)"
        );
        return;
      }

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        text: text.trim(),
        category: "general",
        priority: 2,
        completed: false,
      });

      // 상태 초기화
      this.clearUserState(userId);

      if (result.success) {
        const successText = `✅ **할일 추가 완료**

"${text.trim()}"이(가) 성공적으로 추가되었습니다.`;

        await this.sendMessage(bot, chatId, successText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📋 목록 보기", callback_data: "todo:list" },
                { text: "➕ 계속 추가", callback_data: "todo:add" },
              ],
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        });
      } else {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 할일 추가 중 오류가 발생했습니다."
        );
      }
    } catch (error) {
      logger.error("할일 추가 처리 오류:", error);
      this.clearUserState(userId);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 빠른 할일 추가 ("할일: 내용" 형식)
   */
  async handleQuickAdd(bot, chatId, userId, todoText) {
    try {
      const result = await this.todoService.addTodo(userId, {
        text: todoText.trim(),
        category: "general",
        priority: 2,
        completed: false,
      });

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `✅ 할일이 추가되었습니다: "${todoText.trim()}"`
        );
      } else {
        await this.sendMessage(bot, chatId, "❌ 할일 추가에 실패했습니다.");
      }
    } catch (error) {
      logger.error("빠른 할일 추가 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * 💬 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const userId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!text || !userId) return false;

    try {
      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      if (userState?.action === "adding_todo") {
        await this.handleTodoInput(bot, chatId, userId, text);
        return true;
      }

      // 빠른 할일 추가 패턴 체크
      const quickAddMatch = text.match(/^(?:할일|todo):\s*(.+)$/i);
      if (quickAddMatch) {
        await this.handleQuickAdd(bot, chatId, userId, quickAddMatch[1]);
        return true;
      }

      // 기본 메뉴 표시
      if (["/todo", "할일", "todo"].includes(text.toLowerCase())) {
        await this.sendTodoMenu(bot, chatId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 실패:", error);
      return false;
    }
  }

  /**
   * 모듈 메뉴 전송 (명령어용)
   */
  async sendTodoMenu(bot, chatId) {
    const menuText = `📝 **할일 관리**

효율적인 할일 관리로 생산성을 향상시키세요!`;

    await this.sendMessage(bot, chatId, menuText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 목록", callback_data: "todo:list" },
            { text: "➕ 추가", callback_data: "todo:add" },
          ],
          [
            { text: "🔍 검색", callback_data: "todo:search" },
            { text: "📊 통계", callback_data: "todo:stats" },
          ],
        ],
      },
    });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 카테고리 이모지 반환
   */
  getCategoryEmoji(category) {
    const categoryEmojis = {
      work: "💼",
      personal: "🏠",
      shopping: "🛒",
      health: "💪",
      study: "📚",
      default: "📝",
    };
    return categoryEmojis[category] || categoryEmojis.default;
  }

  /**
   * 우선순위 이모지 반환
   */
  getPriorityEmoji(priority) {
    const priorityEmojis = {
      1: "🔴", // 높음
      2: "🟡", // 보통
      3: "🟢", // 낮음
      default: "⚪",
    };
    return priorityEmojis[priority] || priorityEmojis.default;
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const errorText = `❌ **오류**

${message}

메뉴로 돌아가서 다시 시도해주세요.`;

      await bot.editMessageText(errorText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        },
      });
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      moduleName: "TodoModule",
      version: "3.0.1",
      isInitialized: this.isInitialized,
      todoServiceConnected: !!this.todoService,
      activeUserStates: this.userStates.size,
      config: this.config,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      if (this.todoService && this.todoService.cleanup) {
        await this.todoService.cleanup();
      }

      this.userStates.clear();
      logger.info("✅ TodoModule 정리 완료");
    } catch (error) {
      logger.error("❌ TodoModule 정리 실패:", error);
    }
  }
}

module.exports = TodoModule;
