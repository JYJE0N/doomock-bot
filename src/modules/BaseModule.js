// src/modules/BaseModule.js - 완전 표준화된 베이스 모듈 (v3 완전 리팩토링)

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
const { mongoPoolManager } = require("../database/MongoPoolManager");
const ErrorHandler = require("../utils/ErrorHandler"); // ✅ 클래스 import

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

    // ✅ ErrorHandler 인스턴스 생성 (모듈별 독립적)
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 🗄️ 데이터베이스 접근
    this.db = mongoPoolManager;

    Logger.debug(
      `📦 ${this.name} 모듈 생성됨 (우선순위: ${this.config.priority})`
    );
  }

  // ⚙️ 기본 액션 등록
  registerBaseActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("cancel", this.cancelUserAction.bind(this));
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

      // ✅ ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "initialization",
        module: this.name,
      });

      throw error;
    }
  }

  // 🗄️ 데이터베이스 연결 확인
  async ensureDatabaseConnection() {
    try {
      if (!(await this.db.isHealthy())) {
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
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 86400 } }, // 24시간 후 자동 삭제
    ];

    try {
      await this.db.ensureIndexes(
        `${this.moduleName}_userStates`,
        userStateIndexes
      );
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
    const {
      from: { id: userId },
      text,
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 중복 처리 방지
      if (this.processingUsers.has(userId)) {
        Logger.debug(`⏭️ 사용자 ${userId} 처리 중, 무시`);
        return false;
      }

      this.processingUsers.add(userId);
      this.setUserTimeout(userId);

      // 통계 업데이트
      this.updateStats("message", startTime);
      this.stats.uniqueUsers.add(userId);

      Logger.debug(`📨 ${this.name} 메시지 처리: "${text}" (${userName})`);

      // 실제 메시지 처리 (서브클래스에서 구현)
      const handled = await this.processMessage(bot, msg);

      return handled;
    } catch (error) {
      Logger.error(`❌ ${this.name} 메시지 처리 오류:`, error);

      // ✅ ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "message",
        module: this.name,
        userId: userId,
      });

      return false;
    } finally {
      this.processingUsers.delete(userId);
      this.cleanupUserTimeout(userId);
    }
  }

  // 📞 표준 콜백 처리 (표준 매개변수)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const startTime = Date.now();
    const {
      from: { id: userId },
      data,
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      // 중복 처리 방지
      const callbackKey = `${userId}_${data}`;
      if (this.processingUsers.has(callbackKey)) {
        Logger.debug(`⏭️ 콜백 ${callbackKey} 처리 중, 무시`);
        return false;
      }

      this.processingUsers.add(callbackKey);
      this.setUserTimeout(userId);

      // 통계 업데이트
      this.updateStats("callback", startTime);
      this.stats.uniqueUsers.add(userId);

      Logger.debug(`📞 ${this.name} 콜백 처리: "${data}" (${userName})`);

      // 콜백 응답 (텔레그램 요구사항)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (answerError) {
        Logger.debug("콜백 응답 실패 (무시됨):", answerError.message);
      }

      // 실제 콜백 처리 (서브클래스에서 구현)
      const handled = await this.processCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );

      return handled;
    } catch (error) {
      Logger.error(`❌ ${this.name} 콜백 처리 오류:`, error);

      // ✅ ErrorHandler를 통한 에러 처리
      await this.errorHandler.handleError(error, {
        type: "callback",
        module: this.name,
        userId: userId,
        data: data,
      });

      // 사용자에게 에러 메시지 전송
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (answerError) {
        Logger.debug("에러 콜백 응답 실패:", answerError.message);
      }

      return false;
    } finally {
      this.processingUsers.delete(`${userId}_${data}`);
      this.cleanupUserTimeout(userId);
    }
  }

  // 🎯 실제 메시지 처리 (서브클래스에서 구현)
  async processMessage(bot, msg) {
    // 서브클래스에서 오버라이드
    Logger.warn(`${this.name}에서 processMessage가 구현되지 않음`);
    return false;
  }

  // 🎯 실제 콜백 처리 (서브클래스에서 구현)
  async processCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 서브클래스에서 오버라이드
    Logger.warn(`${this.name}에서 processCallback가 구현되지 않음`);
    return false;
  }

  // 📊 통계 업데이트
  updateStats(type, startTime) {
    const responseTime = Date.now() - startTime;

    this.stats.lastUsed = new Date();
    this.stats.totalResponseTime += responseTime;

    if (type === "message") {
      this.stats.commandCount++;
    } else if (type === "callback") {
      this.stats.callbackCount++;
    }

    const totalRequests = this.stats.commandCount + this.stats.callbackCount;
    this.stats.averageResponseTime =
      totalRequests > 0
        ? Math.round(this.stats.totalResponseTime / totalRequests)
        : 0;

    Logger.debug(`📊 ${this.name} 응답시간: ${responseTime}ms`);
  }

  // ⏰ 사용자 타임아웃 설정
  setUserTimeout(userId) {
    this.cleanupUserTimeout(userId);

    const timeout = setTimeout(() => {
      this.processingUsers.delete(userId);
      Logger.debug(`⏰ ${this.name} 사용자 ${userId} 타임아웃`);
    }, this.config.timeout);

    this.userTimeouts.set(userId, timeout);
  }

  // 🧹 사용자 타임아웃 정리
  cleanupUserTimeout(userId) {
    const timeout = this.userTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.userTimeouts.delete(userId);
    }
  }

  // 📋 메뉴 표시 (기본 구현)
  async showMenu(bot, chatId, messageId, userId, userName) {
    const menuText = `🔧 **${this.name} 메뉴**\n\n사용 가능한 기능을 선택하세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 통계", callback_data: `${this.moduleName}_stats` },
          { text: "❓ 도움말", callback_data: `${this.moduleName}_help` },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    try {
      if (messageId) {
        await bot.editMessageText(menuText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(chatId, menuText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      Logger.error(`${this.name} 메뉴 표시 오류:`, error);
      await this.errorHandler.handleError(error, {
        type: "menu_display",
        module: this.name,
        userId: userId,
      });
    }
  }

  // 📊 통계 표시
  async showStats(bot, chatId, messageId, userId, userName) {
    const stats = this.getModuleStats();
    const statsText = `📊 **${this.name} 통계**\n\n${stats}`;

    try {
      await this.editMessage(bot, chatId, messageId, statsText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` }],
          ],
        },
      });
    } catch (error) {
      Logger.error(`${this.name} 통계 표시 오류:`, error);
    }
  }

  // 📈 모듈 통계 조회
  getModuleStats() {
    const uptime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return `
• 📨 처리된 명령: ${this.stats.commandCount}개
• 📞 처리된 콜백: ${this.stats.callbackCount}개
• 👥 고유 사용자: ${this.stats.uniqueUsers.size}명
• ❌ 오류 횟수: ${this.stats.errorCount}개
• ⚡ 평균 응답시간: ${this.stats.averageResponseTime}ms
• ⏰ 가동시간: ${hours}시간 ${minutes}분
• 📅 마지막 사용: ${
      this.stats.lastUsed ? this.stats.lastUsed.toLocaleString() : "없음"
    }
    `.trim();
  }

  // ❓ 도움말 표시 (서브클래스에서 오버라이드)
  async showHelp(bot, chatId, messageId, userId, userName) {
    const helpText = `❓ **${this.name} 도움말**\n\n이 모듈의 도움말이 아직 구현되지 않았습니다.`;

    try {
      await this.editMessage(bot, chatId, messageId, helpText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` }],
          ],
        },
      });
    } catch (error) {
      Logger.error(`${this.name} 도움말 표시 오류:`, error);
    }
  }

  // ❌ 사용자 액션 취소
  async cancelUserAction(bot, chatId, messageId, userId, userName) {
    // 사용자 상태 초기화
    this.userStates.delete(userId);
    this.processingUsers.delete(userId);
    this.cleanupUserTimeout(userId);

    const cancelText = `❌ **작업 취소됨**\n\n${userName}님의 작업이 취소되었습니다.`;

    try {
      await this.editMessage(bot, chatId, messageId, cancelText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` }],
          ],
        },
      });
    } catch (error) {
      Logger.error(`${this.name} 작업 취소 오류:`, error);
    }
  }

  // 🔧 유틸리티: 메시지 전송
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error(`${this.name} 메시지 전송 오류:`, error);
      await this.errorHandler.handleError(error, {
        type: "send_message",
        module: this.name,
      });
      throw error;
    }
  }

  // 🔧 유틸리티: 메시지 수정
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      Logger.error(`${this.name} 메시지 수정 오류:`, error);
      await this.errorHandler.handleError(error, {
        type: "edit_message",
        module: this.name,
      });
      throw error;
    }
  }

  // 🧹 모듈 정리
  async cleanup() {
    Logger.info(`🧹 ${this.name} 정리 작업 시작`);

    try {
      // 진행 중인 모든 작업 중단
      this.processingUsers.clear();

      // 모든 타임아웃 정리
      for (const timeout of this.userTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.userTimeouts.clear();

      // 사용자 상태 정리
      this.userStates.clear();

      // ErrorHandler 정리
      if (this.errorHandler) {
        this.errorHandler.cleanup();
      }

      // 서브클래스별 정리 (있다면)
      if (this.onCleanup) {
        await this.onCleanup();
      }

      Logger.success(`✅ ${this.name} 정리 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name} 정리 중 오류:`, error);
    }
  }

  // 🎯 서브클래스 정리 (오버라이드 가능)
  async onCleanup() {
    // 서브클래스에서 구현
  }
}

module.exports = BaseModule;
