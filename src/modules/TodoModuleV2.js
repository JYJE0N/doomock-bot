/**
 * 📝 TodoModuleV2 - EventBus 기반 할일 관리 모듈
 * 완전한 이벤트 기반 아키텍처로 구현된 할일 관리 모듈
 */

const { EVENTS } = require("../events/index");
const logger = require("../utils/core/Logger");
// const { getUserId } = require("../utils/core/UserHelper");

class TodoModuleV2 {
  constructor(moduleName = "todo", options = {}) {
    this.moduleName = moduleName;
    
    // EventBus는 ModuleManager에서 주입받거나 글로벌 인스턴스 사용
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    
    // V2 모듈 필수 속성들
    this.isInitialized = false;
    this.serviceBuilder = options.serviceBuilder || null;
    
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
        WAITING_EDIT_INPUT: "waiting_edit_input"
      }
    };

    // 사용자 상태 관리
    this.userStates = new Map();
    
    // 이벤트 구독 관리
    this.subscriptions = [];
    
    // 30분마다 만료된 사용자 상태 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 1800000);

    logger.info("📝 TodoModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 V2 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 TodoService 가져오기
      if (this.serviceBuilder) {
        this.todoService = await this.serviceBuilder.getOrCreate("todo");
      }

      if (!this.todoService) {
        throw new Error("TodoService 생성에 실패했습니다");
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기화 완료 표시
      this.isInitialized = true;
      
      logger.success("📝 TodoModuleV2 초기화 완료 (EventBus 기반)");
      return true;
    } catch (error) {
      logger.error("❌ TodoModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 할일 생성 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TODO.CREATE_REQUEST, async (event) => {
        await this.handleCreateRequest(event);
      })
    );

    // 할일 목록 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TODO.LIST_REQUEST, async (event) => {
        await this.handleListRequest(event);
      })
    );

    // 할일 완료 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TODO.COMPLETE_REQUEST, async (event) => {
        await this.handleCompleteRequest(event);
      })
    );

    // 할일 삭제 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TODO.DELETE_REQUEST, async (event) => {
        await this.handleDeleteRequest(event);
      })
    );

    // 할일 수정 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TODO.UPDATE_REQUEST, async (event) => {
        await this.handleUpdateRequest(event);
      })
    );

    // 사용자 텍스트 메시지 (할일 추가 입력 대기 중)
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.USER.MESSAGE, async (event) => {
        await this.handleUserMessage(event);
      })
    );

    logger.debug("🎧 TodoModuleV2 EventBus 리스너 설정 완료");
  }

  /**
   * 🎯 ModuleManager 호환 이벤트 핸들러
   */
  async handleEvent(eventName, event) {
    try {
      switch (eventName) {
        case EVENTS.USER.CALLBACK:
          await this.handleCallback(event);
          break;
        case EVENTS.USER.MESSAGE:
          await this.handleUserMessage(event);
          break;
        default:
          // 다른 이벤트는 개별 리스너에서 처리
          break;
      }
    } catch (error) {
      logger.error(`📝 TodoModuleV2 이벤트 처리 오류: ${eventName}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🎯 콜백 처리 (레거시 호환) - ModuleManager에서 호출
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    
    // 레거시 콜백을 처리하는 맵
    const actionMap = {
      'menu': () => this.showMenu(userId, chatId),
      'list': () => this.showList(userId, chatId, params),
      'add': () => this.startAddFlow(userId, chatId),
      'complete': () => this.publishCompleteRequest(userId, chatId, params),
      'delete': () => this.publishDeleteRequest(userId, chatId, params),
      'edit': () => this.startEditFlow(userId, chatId, params)
    };
    
    const handler = actionMap[subAction];
    if (handler) {
      const result = await handler();
      // menu와 list 액션은 렌더러용 결과를 반환
      if ((subAction === 'menu' || subAction === 'list') && result) {
        return result;
      }
      return {
        type: subAction,
        module: 'todo',
        success: true
      };
    }
    
    logger.debug(`TodoModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 📋 할일 목록 표시
   */
  async handleListRequest(event) {
    const { userId, chatId, page = 1 } = event.payload;

    try {
      const result = await this.todoService.getTodos(userId, {
        page,
        limit: this.config.pageSize
      });

      // 목록 준비 이벤트 발행
      await this.eventBus.publish(EVENTS.TODO.LIST_READY, {
        userId,
        chatId,
        todos: result.todos,
        pagination: result.pagination,
        stats: result.stats
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatTodoList(result),
        options: {
          reply_markup: this.createListKeyboard(result, page),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📋 할일 목록 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ➕ 할일 생성 요청 처리
   */
  async handleCreateRequest(event) {
    const { userId, chatId, text, priority = 'medium' } = event.payload;

    try {
      // 최대 개수 체크
      const stats = await this.todoService.getStats(userId);
      if (stats.total >= this.config.maxTodosPerUser) {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: `❌ 할일은 최대 ${this.config.maxTodosPerUser}개까지만 등록할 수 있습니다.`,
          options: { parse_mode: 'Markdown' }
        });
        return;
      }

      // 할일 생성
      const todo = await this.todoService.createTodo(userId, {
        text,
        priority,
        status: this.constants.STATUS.PENDING
      });

      // 생성 완료 이벤트 발행
      await this.eventBus.publish(EVENTS.TODO.CREATED, {
        id: todo._id,
        text: todo.text,
        userId,
        priority: todo.priority,
        createdAt: todo.createdAt
      });

      // 성공 메시지 렌더링
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: `✅ 할일이 추가되었습니다!\n\n📝 *${this.escapeMarkdown(todo.text)}*`,
        options: {
          reply_markup: this.createAfterAddKeyboard(todo._id),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('➕ 할일 생성 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ✅ 할일 완료 요청 처리
   */
  async handleCompleteRequest(event) {
    const { userId, chatId, todoId } = event.payload;

    try {
      const todo = await this.todoService.toggleTodo(userId, todoId);
      
      if (!todo) {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: '❌ 할일을 찾을 수 없습니다.',
          options: { parse_mode: 'Markdown' }
        });
        return;
      }

      // 완료 이벤트 발행
      await this.eventBus.publish(EVENTS.TODO.COMPLETED, {
        id: todo._id,
        userId,
        status: todo.status,
        completedAt: todo.completedAt
      });

      const statusEmoji = todo.status === 'completed' ? '✅' : '⏸️';
      const statusText = todo.status === 'completed' ? '완료' : '미완료';

      // 성공 메시지 렌더링
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: `${statusEmoji} 할일을 ${statusText} 처리했습니다!\n\n📝 *${this.escapeMarkdown(todo.text)}*`,
        options: {
          reply_markup: this.createAfterActionKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('✅ 할일 완료 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🗑️ 할일 삭제 요청 처리
   */
  async handleDeleteRequest(event) {
    const { userId, chatId, todoId } = event.payload;

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);
      
      if (!result.success) {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: '❌ 할일을 찾을 수 없습니다.',
          options: { parse_mode: 'Markdown' }
        });
        return;
      }

      // 삭제 완료 이벤트 발행
      await this.eventBus.publish(EVENTS.TODO.DELETED, {
        id: todoId,
        userId,
        deletedAt: new Date().toISOString()
      });

      // 성공 메시지 렌더링
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: '🗑️ 할일이 삭제되었습니다.',
        options: {
          reply_markup: this.createAfterActionKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🗑️ 할일 삭제 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 💬 사용자 메시지 처리 (입력 대기 상태)
   */
  async handleUserMessage(event) {
    const { userId, chatId, text } = event.payload;
    const userState = this.userStates.get(userId);

    if (!userState) return;

    try {
      switch (userState.state) {
        case this.constants.INPUT_STATES.WAITING_ADD_INPUT:
          // 할일 추가 입력 처리
          await this.eventBus.publish(EVENTS.TODO.CREATE_REQUEST, {
            userId,
            chatId,
            text,
            priority: userState.priority || 'medium'
          });
          this.clearUserState(userId);
          break;

        case this.constants.INPUT_STATES.WAITING_EDIT_INPUT:
          // 할일 수정 입력 처리
          await this.eventBus.publish(EVENTS.TODO.UPDATE_REQUEST, {
            userId,
            chatId,
            todoId: userState.todoId,
            text
          });
          this.clearUserState(userId);
          break;
      }
    } catch (error) {
      logger.error('💬 사용자 메시지 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📋 할일 목록 표시 (V2 렌더러 방식)
   */
  async showList(userId, chatId, page = 1) {
    try {
      const pageNum = parseInt(page) || 1;
      const result = await this.todoService.getTodos(userId, {
        page: pageNum,
        limit: this.config.pageSize
      });

      if (!result.success) {
        logger.error('TodoModuleV2.showList: 목록 조회 실패:', result.error);
        return {
          type: 'error',
          module: 'todo',
          success: false,
          data: {
            message: '할일 목록을 불러오는 중 오류가 발생했습니다.',
            canRetry: true
          }
        };
      }

      // 렌더러에게 전달할 데이터 구성
      return {
        type: 'list',
        module: 'todo',
        success: true,
        data: {
          todos: result.data.todos || [],
          currentPage: pageNum,
          totalPages: result.data.pagination?.totalPages || 1,
          totalCount: result.data.pagination?.totalCount || 0,
          enableReminders: this.config.enableReminders
        }
      };

    } catch (error) {
      logger.error('📋 할일 목록 표시 실패:', error);
      return {
        type: 'error',
        module: 'todo',
        success: false,
        data: {
          message: '할일 목록을 불러오는 중 오류가 발생했습니다.',
          canRetry: true
        }
      };
    }
  }

  /**
   * ➕ 할일 추가 플로우 시작
   */
  async startAddFlow(userId, chatId) {
    // 입력 대기 상태 설정
    this.setUserState(userId, {
      state: this.constants.INPUT_STATES.WAITING_ADD_INPUT,
      timestamp: Date.now()
    });

    await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
      chatId,
      text: '📝 추가할 할일을 입력해주세요:',
      options: {
        reply_markup: { 
          inline_keyboard: [[
            { text: '❌ 취소', callback_data: 'todo:menu' }
          ]]
        },
        parse_mode: 'Markdown'
      }
    });
  }

  /**
   * 📝 메뉴 표시 (V2 렌더러 방식)
   */
  async showMenu(userId, chatId) {
    try {
      const statsResult = await this.todoService.getStats(userId);
      
      if (!statsResult.success) {
        logger.error('통계 조회 실패:', statsResult.error);
        await this.publishError(new Error(statsResult.message), { payload: { chatId } });
        return;
      }

      // 렌더러에게 전달할 데이터 구성
      return {
        type: 'menu',
        module: 'todo',
        success: true,
        data: {
          title: '📝 *할일 관리*',
          stats: statsResult.data,
          enableReminders: this.config.enableReminders,
          userId: userId
        }
      };

    } catch (error) {
      logger.error('📝 메뉴 표시 실패:', error);
      await this.publishError(error, { payload: { chatId } });
      return {
        success: false,
        result: {
          type: 'error',
          data: { message: '메뉴 로딩 중 오류가 발생했습니다.' }
        }
      };
    }
  }

  /**
   * 🎯 이벤트 발행 헬퍼 메서드들
   */
  async publishListRequest(userId, chatId, page = 1) {
    await this.eventBus.publish(EVENTS.TODO.LIST_REQUEST, {
      userId,
      chatId,
      page: parseInt(page) || 1
    });
  }

  async publishCompleteRequest(userId, chatId, todoId) {
    await this.eventBus.publish(EVENTS.TODO.COMPLETE_REQUEST, {
      userId,
      chatId,
      todoId
    });
  }

  async publishDeleteRequest(userId, chatId, todoId) {
    await this.eventBus.publish(EVENTS.TODO.DELETE_REQUEST, {
      userId,
      chatId,
      todoId
    });
  }

  async publishError(error, originalEvent) {
    const chatId = originalEvent?.payload?.chatId;
    
    if (chatId) {
      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: error.message || '처리 중 오류가 발생했습니다.'
      });
    }

    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: 'TodoModuleV2',
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🎨 키보드 생성 메서드들
   */
  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📋 목록 보기', callback_data: 'todo:list' },
          { text: '➕ 추가', callback_data: 'todo:add' }
        ],
        [
          { text: '📊 통계', callback_data: 'todo:stats' },
          { text: '🗓️ 오늘 할일', callback_data: 'todo:today' }
        ],
        [
          { text: '🏠 메인 메뉴', callback_data: 'system:menu' }
        ]
      ]
    };
  }

  createListKeyboard(result, currentPage) {
    const keyboard = [];
    const { todos, pagination } = result;

    // 할일 버튼들 (2열로 배치)
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];
      
      const todo1 = todos[i];
      const emoji1 = todo1.status === 'completed' ? '✅' : '⏸️';
      const text1 = `${emoji1} ${this.truncateText(todo1.text, 20)}`;
      row.push({ 
        text: text1, 
        callback_data: `todo:detail:${todo1._id}` 
      });

      if (i + 1 < todos.length) {
        const todo2 = todos[i + 1];
        const emoji2 = todo2.status === 'completed' ? '✅' : '⏸️';
        const text2 = `${emoji2} ${this.truncateText(todo2.text, 20)}`;
        row.push({ 
          text: text2, 
          callback_data: `todo:detail:${todo2._id}` 
        });
      }

      keyboard.push(row);
    }

    // 페이지네이션
    const paginationRow = [];
    if (pagination.hasPrev) {
      paginationRow.push({ 
        text: '⬅️ 이전', 
        callback_data: `todo:list:${currentPage - 1}` 
      });
    }
    if (pagination.hasNext) {
      paginationRow.push({ 
        text: '다음 ➡️', 
        callback_data: `todo:list:${currentPage + 1}` 
      });
    }
    if (paginationRow.length > 0) {
      keyboard.push(paginationRow);
    }

    // 메뉴 버튼
    keyboard.push([
      { text: '➕ 추가', callback_data: 'todo:add' },
      { text: '🔄 새로고침', callback_data: `todo:list:${currentPage}` }
    ]);
    keyboard.push([
      { text: '🏠 메뉴', callback_data: 'todo:menu' }
    ]);

    return { inline_keyboard: keyboard };
  }

  createAfterAddKeyboard(todoId) {
    return {
      inline_keyboard: [
        [
          { text: '📋 목록 보기', callback_data: 'todo:list' },
          { text: '➕ 또 추가', callback_data: 'todo:add' }
        ],
        [
          { text: '🏠 메뉴', callback_data: 'todo:menu' }
        ]
      ]
    };
  }

  createAfterActionKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📋 목록 보기', callback_data: 'todo:list' },
          { text: '➕ 추가', callback_data: 'todo:add' }
        ],
        [
          { text: '🏠 메뉴', callback_data: 'todo:menu' }
        ]
      ]
    };
  }

  /**
   * 📝 할일 목록 포맷팅
   */
  formatTodoList(result) {
    const { todos, pagination, stats } = result;
    
    if (todos.length === 0) {
      return '📭 *할일이 없습니다*\n\n➕ 버튼을 눌러 할일을 추가해보세요!';
    }

    const lines = ['📋 *할일 목록*\n'];
    
    todos.forEach((todo, index) => {
      const emoji = todo.status === 'completed' ? '✅' : '⏸️';
      const priority = this.getPriorityEmoji(todo.priority);
      const text = this.escapeMarkdown(todo.text);
      
      lines.push(`${emoji} ${priority} ${text}`);
    });

    lines.push('');
    lines.push(`📊 ${pagination.page}/${pagination.totalPages} 페이지 | 전체 ${stats.total}개`);

    return lines.join('\n');
  }

  /**
   * 🛠️ 유틸리티 메서드들
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now()
    });
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  cleanupExpiredStates() {
    const now = Date.now();
    this.userStates.forEach((state, userId) => {
      if (now - state.timestamp > 1800000) { // 30분
        this.userStates.delete(userId);
        logger.debug(`🧹 만료된 TodoModuleV2 사용자 상태 정리: ${userId}`);
      }
    });
  }

  getPriorityEmoji(priority) {
    const emojis = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return emojis[priority] || '';
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      logger.info('🧹 TodoModuleV2 정리 시작...');
      
      // 인터벌 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // 이벤트 구독 해제
      this.subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      // 사용자 상태 정리
      this.userStates.clear();
      
      logger.success('✅ TodoModuleV2 정리 완료');
    } catch (error) {
      logger.error('❌ TodoModuleV2 정리 실패:', error);
      throw error;
    }
  }
}

module.exports = TodoModuleV2;