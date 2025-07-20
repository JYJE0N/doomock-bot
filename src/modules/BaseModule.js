// src/modules/BaseModule.js - 표준 구조 (모든 혼란 제거)

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
    this.startTime = new Date();

    // 통계
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
      uniqueUsers: new Set(),
    };

    // 사용자 관리
    this.userStates = new Map();

    // 에러 핸들러
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 데이터베이스
    this.db = mongoPoolManager;

    Logger.debug(`📦 ${this.name} 생성됨`);
  }

  // 🔧 초기화
  async initialize() {
    if (this.isInitialized) {
      Logger.warn(`${this.name} 이미 초기화됨`);
      return;
    }

    try {
      Logger.info(`🔧 ${this.name} 초기화 중...`);

      // 데이터베이스 연결 (선택적)
      await this.ensureDatabaseConnection();

      this.isInitialized = true;
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
  updateStats(type) {
    this.stats.lastUsed = new Date();
    this.stats.uniqueUsers.add("temp"); // 실제 구현에서는 userId

    if (type === "message" || type === "command") {
      this.stats.commandCount++;
    } else if (type === "callback") {
      this.stats.callbackCount++;
    }
  }

  // 👤 사용자 상태 관리
  getUserState(userId) {
    return this.userStates.get(userId);
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  // 🛡️ 에러 처리
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

  // 🧹 정리 작업
  async cleanup() {
    Logger.info(`🧹 ${this.name} 정리 중...`);

    try {
      this.userStates.clear();

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

  // ⚠️ 서브클래스에서 반드시 구현해야 할 메서드들 (기본은 처리하지 않음)
  async handleMessage(bot, msg) {
    // 기본: 처리하지 않음 (경고 없음)
    return false;
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 기본: 처리하지 않음 (경고 없음)
    return false;
  }
}

module.exports = BaseModule;
