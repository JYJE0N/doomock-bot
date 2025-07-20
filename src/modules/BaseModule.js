// src/modules/BaseModule.js - 완전 표준화된 베이스 모듈 (v3 리팩토링)

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { mongoPoolManager } = require("../database/MongoPoolManager");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.replace("Module", "").toLowerCase();
    this.config = {
      enabled: true,
      priority: 100,
      dependencies: [],
      commands: [],
      callbacks: [],
      features: [],
      maxConcurrentUsers: 100,
      timeout: 30000,
      ...config,
    };

    // 🔧 초기화 상태
    this.isInitialized = false;
    this.isLoaded = false;
    this.startTime = new Date();

    // 📊 통계 추적 (리팩토링된 구조)
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
      totalResponseTime: 0,
      averageResponseTime: 0,
      uniqueUsers: new Set(),
    };

    // 👥 사용자 상태 관리 (표준화)
    this.userStates = new Map();
    this.processingUsers = new Set();
    this.userTimeouts = new Map();

    // 🎯 액션 매핑 시스템 (표준화)
    this.actionMap = new Map();
    this.registerBaseActions();

    // 🛡️ 에러 처리 (근본 원인 해결)
    this.errorHandlers = new Map();
    this.setupErrorHandlers();

    // 🗄️ 데이터베이스 접근
    this.db = mongoPoolManager;

    Logger.debug(`📦 ${this.name} 모듈 생성됨 (우선순위: ${this.config.priority})`);
  }

  // ⚙️ 기본 액션 등록
  registerBaseActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("cancel", this.cancelUserAction.bind(this));
  }

  // 🛡️ 에러 핸들러 설정 (근본 원인 해결)
  setupErrorHandlers() {
    // MongoDB 연결 오류
    this.errorHandlers.set('MongoNetworkError', async (error, context) => {
      Logger.error(`🔌 MongoDB 연결 오류 (${this.name}):`, error.message);
      await this.db.reconnect();
      return "⚡ 데이터베이스 연결을 복구하고 있습니다. 잠시 후 다시 시도해주세요.";
    });

    // 텔레그램 API 오류
    this.errorHandlers.set('TelegramError', async (error, context) => {
      Logger.error(`📱 텔레그램 API 오류 (${this.name}):`, error.message);
      return "📱 텔레그램 서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.";
    });

    // 사용자 입력 검증 오류
    this.errorHandlers.set('ValidationError', async (error, context) => {
      Logger.warn(`📝 입력 검증 오류 (${this.name}):`, error.message);
      return `❌ ${error.message}`;
    });

    // 시간 초과 오류
    this.errorHandlers.set('TimeoutError', async (error, context) => {
      Logger.warn(`⏰ 시간 초과 (${this.name}):`, error.message);
      this.cleanupUserTimeout(context.userId);
      return "⏰ 요청 시간이 초과되었습니다. 다시 시도해주세요.";
    });

    // 일반 오류
    this.errorHandlers.set('default', async (error, context) => {
      Logger.error(`🚨 일반 오류 (${this.name}):`, error);
      this.stats.errorCount++;
      return "❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    });
  }

  // 🔧 모듈 초기화 (표준)
  async initialize() {
    if (this.isInitialized) {
      Logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      Logger.info(`🔧 ${this.name} 초기화 중...`);

      // 데이터베이스 연결 확인
      await this.ensureDatabaseConnection();

      // 서브클래스별 초기화
      await this.onInitialize();

      // 인덱스 설정
      await this.setupDatabaseIndexes();

      this.isInitialized = true;
      this.isLoaded = true;
      
      Logger.success(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      this.stats.errorCount++;
      Logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🗄️ 데이터베이스 연결 확인
  async ensureDatabaseConnection() {
    try {
      if (!await this.db.isHealthy()) {
        await this.db.connect();
      }
    } catch (error) {
      throw new Error(`데이터베이스 연결 실패: ${error.message}`);
    }
  }

  // 📑 데이터베이스 인덱스 설정 (서브클래스에서 오버라이드)
  async setupDatabaseIndexes() {
    // 기본 사용자 상태 인덱스
    const userStateIndexes = [
      { key: { userId: 1, moduleName: 1 }, options: { unique: true } },
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 86400 } } // 24시간 후 자동 삭제
    ];

    try {
      await this.db.ensureIndexes(`${this.moduleName}_userStates`, userStateIndexes);
      Logger.debug(`📑 ${this.name} 기본 인덱스 설정 완료`);
    } catch (error) {
      Logger.warn(`⚠️ ${this.name} 인덱스 설정 실패:`, error.message);
    }
  }

  // 🎯 서브클래스 초기화 (오버라이드 필요)
  async onInitialize() {
    // 서브클래스에서 구현
  }

  // 📨 표준 메시지 처리 (표준 매개변수)
  async handleMessage(bot, msg) {
    const startTime = Date.now();
    const { chat: { id: chatId }, from: { id: userId }, text } = msg;

    try {
      // 처리 중복 방지
      if (this.processingUsers.has(userId)) {
        Logger.debug(`⏭️ 사용자 ${userId} 처리 중 - 무시`);
        return false;
      }

      this.processingUsers.add(userId);
      this.setUserTimeout(userId);

      // 통계 업데이트
      this.updateStats('command', userId, startTime);

      // 서브클래스 처리
      const result = await this.onHandleMessage(bot, msg);

      return result;
    } catch (error) {
      await this.handleError(error, { userId, chatId, type: 'message' });
      return false;
    } finally {
      this.processingUsers.delete(userId);
      this.clearUserTimeout(userId);
      this.updateResponseTime(startTime);
    }
  }

  // 📞 표준 콜백 처리 (🎯 매개변수 완전 표준화)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const startTime = Date.now();
    const {
      message: { chat: { id: chatId }, message_id: messageId },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 처리 중복 방지
      const callbackKey = `${userId}_${subAction}`;
      if (this.processingUsers.has(callbackKey)) {
        Logger.debug(`⏭️ 콜백 ${callbackKey} 처리 중 - 무시`);
        return false;
      }

      this.processingUsers.add(callbackKey);
      this.setUserTimeout(userId);

      // 통계 업데이트
      this.updateStats('callback', userId, startTime);

      // 액션 매핑 처리
      const action = this.actionMap.get(subAction);
      if (action) {
        const userName = getUserName(callbackQuery.from);
        await action(bot, chatId, messageId, userId, userName, params, menuManager);
        return true;
      }

      // 서브클래스 처리
      const result = await this.onHandleCallback(bot, callbackQuery, subAction, params, menuManager);
      return result;

    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, type: 'callback', subAction });
      return false;
    } finally {
      this.processingUsers.delete(`${userId}_${subAction}`);
      this.clearUserTimeout(userId);
      this.updateResponseTime(startTime);
    }
  }

  // 🎯 서브클래스 메시지 처리 (오버라이드 필요)
  async onHandleMessage(bot, msg) {
    return false;
  }

  // 🎯 서브클래스 콜백 처리 (오버라이드 필요)
  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    return false;
  }

  // 📋 메뉴 표시 (표준)
  async showMenu(bot, chatId, messageId, userId, userName, params, menuManager) {
    try {
      const menuData = this.getMenuData(userName);
      
      if (messageId) {
        await bot.editMessageText(menuData.text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: menuData.keyboard,
          parse_mode: 'Markdown',
        });
      } else {
        await bot.sendMessage(chatId, menuData.text, {
          reply_markup: menuData.keyboard,
          parse_mode: 'Markdown',
        });
      }
    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, type: 'menu' });
    }
  }

  // 📋 메뉴 데이터 제공 (서브클래스에서 오버라이드)
  getMenuData(userName) {
    return {
      text: `🔧 **${userName}님, ${this.name}에 오신 것을 환영합니다!**\n\n사용 가능한 기능을 선택해주세요.`,
      keyboard: {
        inline_keyboard: [
          [{ text: "📊 통계", callback_data: `${this.moduleName}_stats` }],
          [{ text: "❓ 도움말", callback_data: `${this.moduleName}_help` }],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ❓ 도움말 표시
  async showHelp(bot, chatId, messageId, userId, userName) {
    const helpText = this.getHelpText();
    
    try {
      if (messageId) {
        await bot.editMessageText(helpText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
        });
      } else {
        await bot.sendMessage(chatId, helpText, {
          parse_mode: 'Markdown',
        });
      }
    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, type: 'help' });
    }
  }

  // ❓ 도움말 텍스트 (서브클래스에서 오버라이드)
  getHelpText() {
    return `**${this.name} 도움말** 📖\n\n기본 기능들을 제공합니다.\n\n더 자세한 도움말은 각 기능에서 확인하세요.`;
  }

  // 📊 통계 표시
  async showStats(bot, chatId, messageId, userId, userName) {
    const uptime = Date.now() - this.startTime.getTime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    const statsText = `**${this.name} 통계** 📊\n\n` +
      `📈 명령어 실행: ${this.stats.commandCount}회\n` +
      `📞 콜백 처리: ${this.stats.callbackCount}회\n` +
      `❌ 오류 발생: ${this.stats.errorCount}회\n` +
      `👥 고유 사용자: ${this.stats.uniqueUsers.size}명\n` +
      `⚡ 평균 응답: ${this.stats.averageResponseTime.toFixed(0)}ms\n` +
      `⏰ 가동 시간: ${hours}시간 ${minutes}분\n` +
      `🔧 상태: ${this.isInitialized ? '정상' : '초기화 중'}`;

    try {
      if (messageId) {
        await bot.editMessageText(statsText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
        });
      } else {
        await bot.sendMessage(chatId, statsText, {
          parse_mode: 'Markdown',
        });
      }
    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, type: 'stats' });
    }
  }

  // ❌ 사용자 작업 취소
  async cancelUserAction(bot, chatId, messageId, userId, userName) {
    try {
      // 사용자 상태 정리
      this.clearUserState(userId);
      this.clearUserTimeout(userId);
      this.processingUsers.delete(userId);

      const message = "✅ 현재 작업이 취소되었습니다.";
      
      if (messageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
        });
      } else {
        await bot.sendMessage(chatId, message);
      }
    } catch (error) {
      await this.handleError(error, { userId, chatId, messageId, type: 'cancel' });
    }
  }

  // 👥 사용자 상태 관리 (표준화)
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      moduleName: this.moduleName,
      timestamp: Date.now(),
      timeout: Date.now() + this.config.timeout,
    });
  }

  getUserState(userId) {
    const state = this.userStates.get(userId);
    if (state && state.timeout < Date.now()) {
      this.clearUserState(userId);
      return null;
    }
    return state;
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  // ⏰ 사용자 타임아웃 관리
  setUserTimeout(userId) {
    this.clearUserTimeout(userId);
    
    const timeoutId = setTimeout(() => {
      this.cleanupUserTimeout(userId);
    }, this.config.timeout);

    this.userTimeouts.set(userId, timeoutId);
  }

  clearUserTimeout(userId) {
    const timeoutId = this.userTimeouts.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.userTimeouts.delete(userId);
    }
  }

  cleanupUserTimeout(userId) {
    this.clearUserState(userId);
    this.clearUserTimeout(userId);
    this.processingUsers.delete(userId);
    Logger.debug(`⏰ 사용자 ${userId} 타임아웃으로 정리됨`);
  }

  // 📊 통계 업데이트
  updateStats(type, userId, startTime) {
    if (type === 'command') {
      this.stats.commandCount++;
    } else if (type === 'callback') {
      this.stats.callbackCount++;
    }

    this.stats.uniqueUsers.add(userId);
    this.stats.lastUsed = new Date();
  }

  updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    this.stats.totalResponseTime += responseTime;
    const totalRequests = this.stats.commandCount + this.stats.callbackCount;
    this.stats.averageResponseTime = this.stats.totalResponseTime / totalRequests;
  }

  // 🛡️ 통합 에러 처리 (근본 원인 해결)
  async handleError(error, context) {
    this.stats.errorCount++;
    
    // 에러 타입별 처리
    let errorType = 'default';
    
    if (error.name?.includes('Mongo')) {
      errorType = 'MongoNetworkError';
    } else if (error.name?.includes('Telegram')) {
      errorType = 'TelegramError';
    } else if (error.name?.includes('Validation')) {
      errorType = 'ValidationError';
    } else if (error.name?.includes('Timeout')) {
      errorType = 'TimeoutError';
    }

    const handler = this.errorHandlers.get(errorType) || this.errorHandlers.get('default');
    const userMessage = await handler(error, context);

    // 사용자에게 알림
    if (context.chatId && userMessage) {
      try {
        await this.sendErrorMessage(context, userMessage);
      } catch (sendError) {
        Logger.error(`📱 에러 메시지 전송 실패:`, sendError);
      }
    }
  }

  // 📱 에러 메시지 전송
  async sendErrorMessage(context, message) {
    // 기본 봇 인스턴스가 있다면 사용 (ModuleManager에서 주입)
    if (this.bot) {
      await this.bot.sendMessage(context.chatId, message);
    }
  }

  // 🧹 정리 작업
  async cleanup() {
    try {
      Logger.info(`🧹 ${this.name} 정리 작업 시작...`);

      // 모든 사용자 상태 정리
      for (const userId of this.userStates.keys()) {
        this.clearUserState(userId);
        this.clearUserTimeout(userId);
      }

      // 처리 중 사용자 정리
      this.processingUsers.clear();

      // 서브클래스 정리 작업
      await this.onCleanup();

      Logger.success(`✅ ${this.name} 정리 작업 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name} 정리 작업 실패:`, error);
    }
  }

  // 🎯 서브클래스 정리 작업 (오버라이드 가능)
  async onCleanup() {
    // 서브클래스에서 구현
  }

  // 📊 모듈 상태 반환
  getStatus() {
    return {
      name: this.name,
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      isLoaded: this.isLoaded,
      stats: { ...this.stats, uniqueUsers: this.stats.uniqueUsers.size },
      activeUsers: this.processingUsers.size,
      userStates: this.userStates.size,
      uptime: Date.now() - this.startTime.getTime(),
      config: this.config,
    };
  }
}

module.exports = BaseModule;
