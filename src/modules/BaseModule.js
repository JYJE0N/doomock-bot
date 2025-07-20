// src/modules/BaseModule.js - 완전 단순화된 베이스 모듈

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { mongoPoolManager } = require("../database/MongoPoolManager");
const ErrorHandler = require("../utils/ErrorHandler");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.replace("Module", "").toLowerCase();
    this.config = {
      enabled: true,
      priority: 100,
      ...config,
    };

    // 기본 상태
    this.isInitialized = false;
    this.isLoaded = false;
    this.startTime = new Date();

    // 통계
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
      totalResponseTime: 0,
      averageResponseTime: 0,
      uniqueUsers: new Set(),
    };

    // 사용자 관리
    this.userStates = new Map();
    this.processingUsers = new Set();

    // 에러 핸들러
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 데이터베이스
    this.db = mongoPoolManager;

    Logger.debug(`📦 ${this.name} 생성됨`);
  }

  // 🔧 초기화 (서브클래스에서 super.initialize() 호출)
  async initialize() {
    if (this.isInitialized) {
      Logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      Logger.info(`🔧 ${this.name} 초기화 중...`);

      // 데이터베이스 연결 확인 (선택적)
      await this.ensureDatabaseConnection();

      this.isInitialized = true;
      this.isLoaded = true;

      Logger.success(`✅ ${this.name} 초기화 완료`);
    } catch (error) {
      this.stats.errorCount++;
      Logger.error(`❌ ${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🗄️ 데이터베이스 연결 (선택적)
  async ensureDatabaseConnection() {
    try {
      if (this.db && !(await this.db.isHealthy())) {
        await this.db.connect();
      }
    } catch (error) {
      Logger.warn(`⚠️ ${this.name} DB 연결 실패 (무시됨):`, error.message);
    }
  }

  // 📊 통계 업데이트 헬퍼
  updateStats(type, startTime = Date.now()) {
    const responseTime = startTime ? Date.now() - startTime : 0;

    this.stats.lastUsed = new Date();
    this.stats.totalResponseTime += responseTime;

    if (type === "message") {
      this.stats.commandCount++;
    } else if (type === "callback") {
      this.stats.callbackCount++;
    }

    const totalRequests = this.stats.commandCount + this.stats.callbackCount;
    this.stats.averageResponseTime =
      totalRequests > 0 ? this.stats.totalResponseTime / totalRequests : 0;
  }

  // 👤 사용자 상태 관리 헬퍼들
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  // 🛡️ 에러 처리 헬퍼
  async handleError(error, context = {}) {
    this.stats.errorCount++;
    Logger.error(`❌ ${this.name} 에러:`, error);

    return await this.errorHandler.handleError(error, {
      module: this.name,
      ...context,
    });
  }

  // 📤 메시지 전송 헬퍼들
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      Logger.error(`${this.name} 메시지 전송 실패:`, error);
      throw error;
    }
  }

  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      Logger.error(`${this.name} 메시지 수정 실패:`, error);
      throw error;
    }
  }

  async answerCallback(bot, callbackQueryId, text = "", showAlert = false) {
    try {
      return await bot.answerCallbackQuery(callbackQueryId, {
        text,
        show_alert: showAlert,
      });
    } catch (error) {
      Logger.debug("콜백 응답 실패 (무시됨):", error.message);
    }
  }

  // 🏠 기본 메뉴 표시 (서브클래스에서 오버라이드)
  async showMenu(bot, chatId, messageId, userId, userName) {
    const menuText = `🔧 **${this.name} 메뉴**\n\n기본 메뉴입니다.`;
    const keyboard = {
      inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  // ❓ 기본 도움말 (서브클래스에서 오버라이드)
  async showHelp(bot, chatId, messageId) {
    const helpText = `❓ **${this.name} 도움말**\n\n구체적인 도움말이 준비되지 않았습니다.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 📊 통계 표시
  async showStats(bot, chatId, messageId) {
    const statsText =
      `📊 **${this.name} 통계**\n\n` +
      `• 명령어 실행: ${this.stats.commandCount}회\n` +
      `• 콜백 처리: ${this.stats.callbackCount}회\n` +
      `• 에러 발생: ${this.stats.errorCount}회\n` +
      `• 고유 사용자: ${this.stats.uniqueUsers.size}명\n` +
      `• 평균 응답시간: ${Math.round(this.stats.averageResponseTime)}ms\n` +
      `• 마지막 사용: ${
        this.stats.lastUsed ? this.stats.lastUsed.toLocaleString() : "없음"
      }`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메뉴", callback_data: `${this.moduleName}_menu` }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, statsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 🧹 정리 작업
  async cleanup() {
    Logger.info(`🧹 ${this.name} 정리 중...`);

    try {
      // 사용자 상태 정리
      this.userStates.clear();
      this.processingUsers.clear();

      // ErrorHandler 정리
      if (
        this.errorHandler &&
        typeof this.errorHandler.cleanup === "function"
      ) {
        this.errorHandler.cleanup();
      }

      Logger.success(`✅ ${this.name} 정리 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name} 정리 오류:`, error);
    }
  }

  // ⚠️ 추상 메서드들 (서브클래스에서 반드시 구현)
  async handleMessage(bot, msg) {
    Logger.warn(`${this.name}에서 handleMessage 미구현`);
    return false;
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    Logger.warn(`${this.name}에서 handleCallback 미구현`);
    return false;
  }
}

module.exports = BaseModule;
