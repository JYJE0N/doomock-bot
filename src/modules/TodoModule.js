// ✅ 중앙 관리 체제에 맞는 TodoModule 구조
// 모듈은 데이터 처리만, UI는 ModuleManager가 담당
const BaseModule = require("../core/BaseModule");
const TimerService = require("../services/TimerService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 📝 TodoModule - 중앙 관리 체제 버전
 * - 데이터 처리 및 비즈니스 로직만 담당
 * - UI 처리는 ModuleManager에게 위임
 * - 결과 객체를 반환하여 ModuleManager가 처리
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

    // ValidationManager 인스턴스 없음 경고 처리
    this.validationManager = options.validationManager || null;
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
      // ValidationManager 부재 경고
      if (!this.validationManager) {
        logger.warn("⚠️ ValidationManager가 없어 기본 검증만 사용됩니다.");
      }

      // TodoService 초기화
      this.todoService = new TodoService({
        enableCache: this.config.autoSave,
        cacheTimeout: this.config.syncInterval,
      });

      logger.info("🔧 TodoService v3.0.1 생성됨 (ValidationManager 연동)");

      this.todoService.db = this.db;
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
   * ⚠️ 누락된 메서드들을 모두 구현해야 함!
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,
      help: this.showHelp,

      // 할일 목록 및 관리
      list: this.showTodoList,
      add: this.startAddTodo,
      "add:quick": this.showQuickAdd, // ❌ 구현 필요
      "add:template": this.addFromTemplate, // ❌ 구현 필요
      edit: this.startEditTodo, // ❌ 구현 필요
      toggle: this.toggleTodo, // ❌ 구현 필요
      delete: this.deleteTodo, // ❌ 구현 필요

      // 검색 및 필터
      search: this.startSearch, // ❌ 구현 필요
      filter: this.showFilter, // ❌ 구현 필요
      "filter:category": this.filterByCategory, // ❌ 구현 필요
      "filter:priority": this.filterByPriority, // ❌ 구현 필요
      "filter:status": this.filterByStatus, // ❌ 구현 필요

      // 통계 및 분석
      stats: this.showStats, // ❌ 구현 필요
      progress: this.showProgress, // ❌ 구현 필요
      "stats:daily": this.showDailyStats, // ❌ 구현 필요
      "stats:weekly": this.showWeeklyStats, // ❌ 구현 필요

      // 설정
      settings: this.showSettings, // ❌ 구현 필요
      "settings:page_size": this.changePageSize, // ❌ 구현 필요
      "settings:notifications": this.toggleNotifications, // ❌ 구현 필요

      // 유틸리티
      clear: this.clearCompleted, // ❌ 구현 필요
      export: this.exportTodos, // ❌ 구현 필요
      import: this.importTodos, // ❌ 구현 필요
    });
  }

  // ===== 📋 중앙 관리 체제 액션 메서드들 =====

  /**
   * 📱 메인 메뉴 표시 - 중앙 관리 방식
   * @returns {Object} UI 데이터를 반환, ModuleManager가 렌더링
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

      // 🎨 UI 데이터 구성 (ModuleManager가 렌더링)
      const uiData = {
        type: "menu",
        title: "📝 **할일 관리**",
        content: `안녕하세요, ${userName}님!

📊 **현재 상황**
• 전체 할일: ${stats.total}개
• 완료: ${stats.completed}개
• 대기: ${stats.pending}개

원하는 기능을 선택해주세요:`,

        keyboard: {
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
      };

      // 🔄 ModuleManager에게 UI 처리 위임
      return await moduleManager.sendUIData(bot, callbackQuery, uiData);
    } catch (error) {
      logger.error("❌ TodoModule 메뉴 표시 실패:", error);
      return {
        success: false,
        error: "메뉴를 불러오는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📋 할일 목록 표시 - 중앙 관리 방식
   */
  async showTodoList(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const page = parseInt(params[0]) || 1;
      const filter = params[1] || "all";

      // 📋 할일 목록 조회
      const result = await this.todoService.getTodoList(from.id, {
        page,
        pageSize: this.config.pageSize,
        filter,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const { todos, pagination } = result.data;

      // 📄 빈 목록 처리
      if (todos.length === 0) {
        const emptyUI = {
          type: "empty_list",
          title: "📋 **할일 목록**",
          content: `아직 등록된 할일이 없습니다.

첫 번째 할일을 추가해보세요! 🚀`,
          keyboard: {
            inline_keyboard: [
              [{ text: "➕ 첫 할일 추가", callback_data: "todo:add" }],
              [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
            ],
          },
        };
        return await moduleManager.sendUIData(bot, callbackQuery, emptyUI);
      }

      // 📋 목록 UI 데이터 구성
      let listContent = `📋 **할일 목록** (${pagination.total}개)\n\n`;

      const listButtons = [];
      todos.forEach((todo, index) => {
        const checkbox = todo.completed ? "✅" : "☐";
        const categoryEmoji = this.getCategoryEmoji(todo.category);
        const priorityEmoji = this.getPriorityEmoji(todo.priority);

        listContent += `${checkbox} ${categoryEmoji}${priorityEmoji} ${todo.text}\n`;

        if (todo.dueDate) {
          const dueDateStr = TimeHelper.formatDate(todo.dueDate);
          listContent += `   📅 마감: ${dueDateStr}\n`;
        }
        listContent += "\n";

        // 개별 할일 버튼 추가
        const todoButtons = [
          {
            text: todo.completed ? "✅" : "☐",
            callback_data: `todo:toggle:${todo._id}`,
          },
          { text: "✏️", callback_data: `todo:edit:${todo._id}` },
          { text: "🗑️", callback_data: `todo:delete:${todo._id}` },
        ];
        listButtons.push(todoButtons);
      });

      // 페이지네이션 정보
      if (pagination.totalPages > 1) {
        listContent += `📄 페이지 ${pagination.currentPage}/${pagination.totalPages}`;

        // 페이지네이션 버튼
        const pageButtons = [];
        if (pagination.currentPage > 1) {
          pageButtons.push({
            text: "⬅️ 이전",
            callback_data: `todo:list:${pagination.currentPage - 1}:${filter}`,
          });
        }
        if (pagination.currentPage < pagination.totalPages) {
          pageButtons.push({
            text: "다음 ➡️",
            callback_data: `todo:list:${pagination.currentPage + 1}:${filter}`,
          });
        }
        if (pageButtons.length > 0) {
          listButtons.push(pageButtons);
        }
      }

      // 하단 메뉴 버튼
      listButtons.push([
        { text: "➕ 추가", callback_data: "todo:add" },
        { text: "🔍 검색", callback_data: "todo:search" },
        { text: "🎯 필터", callback_data: "todo:filter" },
      ]);
      listButtons.push([{ text: "🔙 메뉴로", callback_data: "todo:menu" }]);

      const listUI = {
        type: "list",
        title: "📋 할일 목록",
        content: listContent,
        keyboard: { inline_keyboard: listButtons },
      };

      return await moduleManager.sendUIData(bot, callbackQuery, listUI);
    } catch (error) {
      logger.error("❌ 할일 목록 표시 실패:", error);
      return {
        success: false,
        error: "목록을 불러오는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * ➕ 할일 추가 시작 - 중앙 관리 방식
   */
  async startAddTodo(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const userName = getUserName(from);

      // 👤 사용자 상태 설정
      this.setUserState(from.id, { action: "adding_todo", context: "manual" });

      const addUI = {
        type: "input_request",
        title: "➕ **할일 추가**",
        content: `안녕하세요, ${userName}님!

새로운 할일을 입력해주세요:

💡 **팁**: 간단하고 구체적으로 작성하세요!

📝 **예시**
• "프로젝트 기획서 작성"
• "운동 30분하기"  
• "마트에서 우유 사기"

⚠️ 취소하려면 \`/cancel\` 입력`,
        keyboard: {
          inline_keyboard: [
            [{ text: "⚡ 빠른 추가", callback_data: "todo:add:quick" }],
            [{ text: "🚫 취소", callback_data: "todo:menu" }],
          ],
        },
      };

      return await moduleManager.sendUIData(bot, callbackQuery, addUI);
    } catch (error) {
      logger.error("❌ 할일 추가 시작 실패:", error);
      return {
        success: false,
        error: "할일 추가 모드 진입 중 오류가 발생했습니다.",
      };
    }
  }

  // ===== 🚫 누락된 메서드들 구현 (기본 구조만) =====

  /**
   * ⚡ 빠른 할일 추가 표시
   */
  async showQuickAdd(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 템플릿 기반 빠른 추가 UI
    return { success: false, error: "빠른 추가 기능을 구현해야 합니다." };
  }

  /**
   * 📝 템플릿으로 할일 추가
   */
  async addFromTemplate(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 미리 정의된 템플릿 사용
    return { success: false, error: "템플릿 추가 기능을 구현해야 합니다." };
  }

  /**
   * ✏️ 할일 편집 시작
   */
  async startEditTodo(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 할일 편집 모드
    return { success: false, error: "편집 기능을 구현해야 합니다." };
  }

  /**
   * ✅ 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 완료 상태 토글
    return { success: false, error: "토글 기능을 구현해야 합니다." };
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 할일 삭제 확인
    return { success: false, error: "삭제 기능을 구현해야 합니다." };
  }

  /**
   * 🔍 검색 시작
   */
  async startSearch(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 검색 모드
    return { success: false, error: "검색 기능을 구현해야 합니다." };
  }

  /**
   * 🎯 필터 메뉴 표시
   */
  async showFilter(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 필터 옵션
    return { success: false, error: "필터 기능을 구현해야 합니다." };
  }

  /**
   * 🏷️ 카테고리별 필터
   */
  async filterByCategory(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 카테고리 필터링
    return { success: false, error: "카테고리 필터를 구현해야 합니다." };
  }

  /**
   * ⭐ 우선순위별 필터
   */
  async filterByPriority(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 우선순위 필터링
    return { success: false, error: "우선순위 필터를 구현해야 합니다." };
  }

  /**
   * 📊 상태별 필터
   */
  async filterByStatus(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 상태별 필터링
    return { success: false, error: "상태 필터를 구현해야 합니다." };
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 사용자 통계
    return { success: false, error: "통계 기능을 구현해야 합니다." };
  }

  /**
   * 📈 진행상황 표시
   */
  async showProgress(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 진행률 시각화
    return { success: false, error: "진행상황 기능을 구현해야 합니다." };
  }

  /**
   * 📅 일일 통계
   */
  async showDailyStats(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 일별 통계
    return { success: false, error: "일일 통계를 구현해야 합니다." };
  }

  /**
   * 📊 주간 통계
   */
  async showWeeklyStats(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 주별 통계
    return { success: false, error: "주간 통계를 구현해야 합니다." };
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 모듈 설정
    return { success: false, error: "설정 기능을 구현해야 합니다." };
  }

  /**
   * 📄 페이지 크기 변경
   */
  async changePageSize(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 페이지 크기 설정
    return { success: false, error: "페이지 크기 설정을 구현해야 합니다." };
  }

  /**
   * 🔔 알림 토글
   */
  async toggleNotifications(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 알림 설정
    return { success: false, error: "알림 설정을 구현해야 합니다." };
  }

  /**
   * 🧹 완료된 할일 정리
   */
  async clearCompleted(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 완료 항목 삭제
    return { success: false, error: "정리 기능을 구현해야 합니다." };
  }

  /**
   * 📤 할일 내보내기
   */
  async exportTodos(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 데이터 내보내기
    return { success: false, error: "내보내기 기능을 구현해야 합니다." };
  }

  /**
   * 📥 할일 가져오기
   */
  async importTodos(bot, callbackQuery, params, moduleManager) {
    // 구현 필요: 데이터 가져오기
    return { success: false, error: "가져오기 기능을 구현해야 합니다." };
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

      if (userState?.action === "searching") {
        await this.handleSearchInput(bot, chatId, userId, text);
        return true;
      }

      if (userState?.action === "editing_todo") {
        await this.handleEditInput(bot, chatId, userId, text);
        return true;
      }

      // 빠른 할일 추가 패턴 체크 ("할일: 내용" 형식)
      const quickAddMatch = text.match(/^(?:할일|todo):\s*(.+)$/i);
      if (quickAddMatch) {
        await this.handleQuickAdd(bot, chatId, userId, quickAddMatch[1]);
        return true;
      }

      // 기본 메뉴 표시
      if (["/todo", "할일", "todo"].includes(text.toLowerCase())) {
        // 중앙 관리 방식: 메뉴 데이터만 생성하고 ModuleManager가 처리
        const menuCallbackQuery = {
          message: { chat: { id: chatId }, message_id: 0 },
          from: msg.from,
        };
        await this.showMenu(bot, menuCallbackQuery, [], this.moduleManager);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ TodoModule 메시지 처리 실패:", error);
      // 중앙 관리 방식: 에러도 ModuleManager에게 위임
      return { success: false, error: "메시지 처리 중 오류가 발생했습니다." };
    }
  }

  // ===== 🎯 데이터 처리 메서드들 (ModuleManager와 독립적) =====

  /**
   * 📝 할일 입력 처리
   */
  async handleTodoInput(bot, chatId, userId, text) {
    // 구현 필요: 텍스트 입력 처리 로직
    logger.info("📝 할일 입력 처리:", text);
  }

  /**
   * 🔍 검색 입력 처리
   */
  async handleSearchInput(bot, chatId, userId, text) {
    // 구현 필요: 검색 쿼리 처리
    logger.info("🔍 검색 입력 처리:", text);
  }

  /**
   * ✏️ 편집 입력 처리
   */
  async handleEditInput(bot, chatId, userId, text) {
    // 구현 필요: 편집 내용 처리
    logger.info("✏️ 편집 입력 처리:", text);
  }

  /**
   * ⚡ 빠른 추가 처리
   */
  async handleQuickAdd(bot, chatId, userId, todoText) {
    // 구현 필요: 빠른 할일 추가
    logger.info("⚡ 빠른 추가:", todoText);
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
