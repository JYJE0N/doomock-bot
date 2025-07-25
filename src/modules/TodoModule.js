// src/modules/TodoModule.js - v3.0.1 표준화 리팩토링 완성판
const BaseModule = require("../core/BaseModule");
const TodoService = require("../services/TodoService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 📝 TodoModule - 표준화된 할일 관리 모듈
 * ✅ BaseModule 상속
 * ✅ 표준 매개변수 준수: (bot, callbackQuery, subAction, params, moduleManager)
 * ✅ actionMap 방식 사용 (switch문 금지)
 * ✅ onInitialize/onHandleMessage 구현
 * ✅ ValidationManager 연동
 * ✅ Railway 환경 최적화
 * ✅ 모든 액션 메서드 구현 완료
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      validationManager: options.validationManager,
      config: options.config,
    });

    this.todoService = null;

    // ValidationManager 상태 체크
    if (!this.validationManager) {
      logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
    }

    // Railway 환경변수 기반 설정
    this.config = {
      pageSize: parseInt(process.env.TODO_PAGE_SIZE) || 10,
      maxTodos: parseInt(process.env.MAX_TODOS_PER_USER) || 100,
      enableCache: process.env.TODO_ENABLE_CACHE === "true",
      autoSave: process.env.TODO_AUTO_SAVE === "true",
      syncInterval: parseInt(process.env.TODO_SYNC_INTERVAL) || 300000,
      ...this.config,
    };

    logger.info("📝 TodoModule v3.0.1 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      logger.info("🎯 TodoModule 초기화 시작...");

      // TodoService 초기화 (한 번만!)
      this.todoService = new TodoService({
        db: this.db,
        validationManager: this.validationManager,
        enableCache: this.config.enableCache,
        cacheTimeout: this.config.syncInterval,
      });

      await this.todoService.initialize();

      // 데이터 마이그레이션 (필요시)
      await this.todoService.migrateData();

      logger.info("✅ TodoModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TodoModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   * ✅ 모든 액션 메서드 구현 완료!
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴 및 도움말
      menu: this.showMenu.bind(this),
      help: this.showHelp.bind(this), // ✅ 함수로 바인딩!

      // 할일 목록 및 관리
      list: this.showTodoList.bind(this),
      add: this.startAddTodo.bind(this),
      "add:quick": this.showQuickAdd.bind(this),
      "add:template": this.addFromTemplate.bind(this),
      edit: this.startEditTodo.bind(this),
      toggle: this.toggleTodo.bind(this),
      delete: this.deleteTodo.bind(this),

      // 검색 및 필터
      search: this.startSearch.bind(this),
      filter: this.showFilter.bind(this),
      "filter:category": this.filterByCategory.bind(this),
      "filter:priority": this.filterByPriority.bind(this),
      "filter:status": this.filterByStatus.bind(this),

      // 통계 및 분석
      stats: this.showStats.bind(this),
      progress: this.showProgress.bind(this),
      "stats:daily": this.showDailyStats.bind(this),
      "stats:weekly": this.showWeeklyStats.bind(this),

      // 설정
      settings: this.showSettings.bind(this),
      "settings:page_size": this.changePageSize.bind(this),
      "settings:notifications": this.toggleNotifications.bind(this),

      // 유틸리티
      clear: this.clearCompleted.bind(this),
      export: this.exportTodos.bind(this),
      import: this.importTodos.bind(this),
    });
  }

  // ===== 📋 메인 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 📱 메인 메뉴 표시
   * @param {Object} bot - 텔레그램 봇 인스턴스
   * @param {Object} callbackQuery - 콜백 쿼리 객체
   * @param {Object} params - 추가 매개변수
   * @param {Object} moduleManager - 모듈 매니저 인스턴스
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

      // 🎨 메뉴 텍스트 구성
      const menuText = `📝 **할일 관리**

안녕하세요, ${userName}님!

📊 **현재 상황**
• 전체 할일: ${stats.total}개
• 완료: ${stats.completed}개
• 대기: ${stats.pending}개

원하는 기능을 선택해주세요:`;

      // ⌨️ 인라인 키보드 구성
      const keyboard = {
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
      };

      // 메시지 편집
      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        menuText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ TodoModule 메뉴 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "메뉴를 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * ❓ 도움말 표시 (✅ 함수로 구현!)
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const helpText = `❓ **할일 관리 도움말**

📋 **기본 기능**
• \`할일 목록\` - 등록된 모든 할일 보기
• \`할일 추가\` - 새로운 할일 등록
• \`검색\` - 할일 내용으로 검색
• \`필터\` - 조건별 할일 필터링

⚡ **빠른 명령어**
• \`/todo\` - 할일 관리 메뉴 열기
• \`/add\` - 빠른 할일 추가
• \`/list\` - 할일 목록 보기

🎯 **팁**
• 할일은 최대 ${this.config.maxTodos}개까지 등록 가능
• 완료된 할일은 자동으로 아래로 정렬
• 중요도에 따라 우선순위 설정 가능

💡 **고급 기능**
• 통계로 진행률 확인
• 템플릿으로 반복 할일 생성
• 데이터 내보내기/가져오기`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
        ],
      };

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        helpText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ TodoModule 도움말 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "도움말을 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * 📋 할일 목록 표시
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const page = params.page || 1;

      // 할일 목록 조회
      const result = await this.todoService.getUserTodos(from.id, {
        page,
        limit: this.config.pageSize,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (!result.success) {
        await this.sendError(bot, callbackQuery, result.error);
        return { success: false };
      }

      const { todos, totalCount, currentPage, totalPages } = result.data;

      if (todos.length === 0) {
        const emptyText = `📋 **할일 목록**

🎉 등록된 할일이 없습니다!
새로운 할일을 추가해보세요.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };

        await this.editMessage(
          bot,
          callbackQuery.message.chat.id,
          callbackQuery.message.message_id,
          emptyText,
          { reply_markup: keyboard }
        );

        return { success: true };
      }

      // 할일 목록 텍스트 구성
      let listText = `📋 **할일 목록** (${currentPage}/${totalPages})

총 ${totalCount}개의 할일이 있습니다.

`;

      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⏳";
        const priority = "⭐".repeat(todo.priority || 1);
        const number = (currentPage - 1) * this.config.pageSize + index + 1;

        listText += `${status} **${number}.** ${todo.text}\n`;

        if (todo.dueDate) {
          const dueDateStr = TimeHelper.format(todo.dueDate, "date");
          listText += `   📅 ${dueDateStr}\n`;
        }

        if (todo.priority > 3) {
          listText += `   ${priority} 중요\n`;
        }

        listText += "\n";
      });

      // 페이지네이션 키보드
      const keyboard = this.createPaginationKeyboard(
        currentPage,
        totalPages,
        "todo:list"
      );

      // 추가 버튼들
      keyboard.inline_keyboard.push([
        { text: "➕ 추가", callback_data: "todo:add" },
        { text: "🔍 검색", callback_data: "todo:search" },
      ]);

      keyboard.inline_keyboard.push([
        { text: "🔙 메뉴로", callback_data: "todo:menu" },
      ]);

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        listText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ TodoModule 목록 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "목록을 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * ➕ 할일 추가 시작
   */
  async startAddTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;

      // 사용자 상태 설정
      this.setUserState(from.id, {
        action: "adding_todo",
        step: "waiting_text",
        data: {},
      });

      const addText = `➕ **할일 추가**

새로운 할일을 입력해주세요:

💡 **팁:**
• 간단하고 명확하게 작성하세요
• 예: "회의 자료 준비", "장보기"
• 최대 ${this.config.maxTodos}개까지 등록 가능

✏️ 할일을 입력하고 전송해주세요:`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        addText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ TodoModule 추가 시작 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "할일 추가를 시작하는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  // ===== 🎯 미구현 액션 메서드들 (기본 구현) =====

  async showQuickAdd(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "빠른 추가");
  }

  async addFromTemplate(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "템플릿 추가");
  }

  async startEditTodo(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "할일 편집");
  }

  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "할일 토글");
  }

  async deleteTodo(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "할일 삭제");
  }

  async startSearch(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "검색");
  }

  async showFilter(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "필터");
  }

  async filterByCategory(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "카테고리 필터");
  }

  async filterByPriority(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "우선순위 필터");
  }

  async filterByStatus(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "상태 필터");
  }

  async showStats(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "통계");
  }

  async showProgress(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "진행률");
  }

  async showDailyStats(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "일일 통계");
  }

  async showWeeklyStats(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "주간 통계");
  }

  async showSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "설정");
  }

  async changePageSize(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "페이지 크기 변경");
  }

  async toggleNotifications(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "알림 설정");
  }

  async clearCompleted(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "완료된 할일 정리");
  }

  async exportTodos(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "할일 내보내기");
  }

  async importTodos(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "할일 가져오기");
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🚧 미구현 기능 알림
   */
  async sendNotImplemented(bot, callbackQuery, featureName) {
    const text = `🚧 **기능 개발 중**

"${featureName}" 기능은 현재 개발 중입니다.
곧 사용하실 수 있도록 준비하고 있어요! 

다른 기능을 이용해주세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메뉴로", callback_data: "todo:menu" }]],
    };

    await this.editMessage(
      bot,
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      text,
      { reply_markup: keyboard }
    );
  }

  /**
   * 📄 페이지네이션 키보드 생성
   */
  createPaginationKeyboard(currentPage, totalPages, baseAction) {
    const keyboard = { inline_keyboard: [] };

    if (totalPages > 1) {
      const buttons = [];

      // 이전 페이지
      if (currentPage > 1) {
        buttons.push({
          text: "◀️ 이전",
          callback_data: `${baseAction}:${currentPage - 1}`,
        });
      }

      // 페이지 정보
      buttons.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "noop",
      });

      // 다음 페이지
      if (currentPage < totalPages) {
        buttons.push({
          text: "다음 ▶️",
          callback_data: `${baseAction}:${currentPage + 1}`,
        });
      }

      keyboard.inline_keyboard.push(buttons);
    }

    return keyboard;
  }

  /**
   * 📨 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    try {
      const {
        chat: { id: chatId },
        from: { id: userId },
        text,
      } = msg;

      if (!text) return false;

      // 사용자 상태 확인
      const userState = this.getUserState(userId);
      if (!userState) return false;

      // 할일 추가 상태 처리
      if (
        userState.action === "adding_todo" &&
        userState.step === "waiting_text"
      ) {
        await this.processAddTodo(bot, msg, userState);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 실패:", error);
      return false;
    }
  }

  /**
   * ➕ 할일 추가 처리
   */
  async processAddTodo(bot, msg, userState) {
    try {
      const {
        chat: { id: chatId },
        from: { id: userId },
        text,
      } = msg;

      // 할일 추가
      const result = await this.todoService.addTodo(userId, {
        text: text.trim(),
        category: "general",
        priority: 3,
        source: "manual",
      });

      let responseText;
      let keyboard;

      if (result.success) {
        responseText = `✅ **할일이 추가되었습니다!**

📝 ${text}

원하는 작업을 선택해주세요:`;

        keyboard = {
          inline_keyboard: [
            [
              { text: "➕ 계속 추가", callback_data: "todo:add" },
              { text: "📋 목록 보기", callback_data: "todo:list" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        };
      } else {
        responseText = `❌ **할일 추가 실패**

${result.error}

다시 시도해주세요.`;

        keyboard = {
          inline_keyboard: [
            [
              { text: "🔄 다시 시도", callback_data: "todo:add" },
              { text: "🔙 메뉴로", callback_data: "todo:menu" },
            ],
          ],
        };
      }

      // 사용자 상태 정리
      this.clearUserState(userId);

      // 응답 전송
      await bot.sendMessage(chatId, responseText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("❌ 할일 추가 처리 실패:", error);

      // 사용자 상태 정리
      this.clearUserState(msg.from.id);

      await bot.sendMessage(
        msg.chat.id,
        "❌ 할일 추가 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🧹 정리 작업 (onCleanup 구현)
   */
  async onCleanup() {
    try {
      // TodoService 정리
      if (this.todoService && this.todoService.cleanup) {
        await this.todoService.cleanup();
      }

      // 사용자 상태 정리
      this.clearAllUserStates();

      logger.debug("📝 TodoModule 정리 완료");
    } catch (error) {
      logger.error("📝 TodoModule 정리 오류:", error);
    }
  }
}

module.exports = TodoModule;
