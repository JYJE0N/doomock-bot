// src/modules/BaseModule.js

const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class BaseModule {
  constructor(moduleName) {
    this.moduleName = moduleName;

    // ⭐ 중요: actionMap을 먼저 초기화
    this.actionMap = new Map();

    // 통계 초기화
    this.stats = {
      messageCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastActivity: null,
    };

    // ⭐ 기본 액션 등록 (생성자 안에서)
    this.registerDefaultActions();

    logger.debug(`📦 ${moduleName} 모듈 생성됨`);
  }

  // ⭐ 기본 액션을 자동으로 등록
  registerDefaultActions() {
    try {
      // 기본 액션들을 등록 (모든 모듈에서 공통으로 사용)
      if (typeof this.showMenu === "function") {
        this.actionMap.set("menu", this.showMenu.bind(this));
      }
      if (typeof this.goBack === "function") {
        this.actionMap.set("back", this.goBack.bind(this));
      }
      if (typeof this.showHelp === "function") {
        this.actionMap.set("help", this.showHelp.bind(this));
      }

      logger.debug(`✅ ${this.moduleName}: 기본 액션 등록 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName}: 기본 액션 등록 실패`, error);
    }
  }

  // ⭐ 하위 모듈에서 액션을 등록할 수 있도록 하는 메서드
  registerActions(actions) {
    try {
      if (!this.actionMap) {
        logger.error(`❌ ${this.moduleName}: actionMap이 초기화되지 않음`);
        this.actionMap = new Map();
      }

      for (const [actionName, handler] of Object.entries(actions)) {
        if (typeof handler === "function") {
          this.actionMap.set(actionName, handler.bind(this));
          logger.debug(`📝 ${this.moduleName}: 액션 등록 - ${actionName}`);
        } else {
          logger.warn(`⚠️ ${this.moduleName}: ${actionName}은 함수가 아님`);
        }
      }
    } catch (error) {
      logger.error(`❌ ${this.moduleName}: 액션 등록 실패`, error);
    }
  }

  // 🎯 표준 콜백 핸들러
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 통계 업데이트
      this.stats.callbackCount++;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      logger.debug(`🎯 ${this.moduleName} 콜백 처리: ${subAction}`);

      // 1. 액션맵에서 먼저 찾기
      if (this.actionMap && this.actionMap.has(subAction)) {
        const action = this.actionMap.get(subAction);
        logger.debug(`✅ ${this.moduleName}: 액션맵에서 ${subAction} 찾음`);

        // 액션 실행 (표준 매개변수 전달)
        return await action.call(
          this,
          bot,
          callbackQuery,
          params,
          moduleManager
        );
      }

      // 2. 동적 핸들러 확인 (하위 클래스에서 오버라이드 가능)
      if (typeof this.handleDynamicCallback === "function") {
        const handled = await this.handleDynamicCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
        if (handled) return true;
      }

      // 3. 기본 액션 처리 (레거시 호환성)
      switch (subAction) {
        case "menu":
          if (typeof this.showMenu === "function") {
            return await this.showMenu(bot, chatId, messageId, userId);
          }
          break;
        case "back":
          if (typeof this.goBack === "function") {
            return await this.goBack(bot, callbackQuery);
          }
          break;
        case "help":
          if (typeof this.showHelp === "function") {
            return await this.showHelp(bot, chatId, messageId);
          }
          break;
        default:
          logger.warn(
            `⚠️ ${this.moduleName}: 처리되지 않은 액션 - ${subAction}`
          );
          return false;
      }

      return false;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      await this.sendError(bot, chatId, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  // 🔧 초기화 메서드 (하위 클래스에서 오버라이드 가능)
  async onInitialize() {
    logger.debug(`🔧 ${this.moduleName} 초기화 중...`);
    return true;
  }

  // 🧹 정리 메서드 (하위 클래스에서 오버라이드 가능)
  async onShutdown() {
    logger.debug(`🧹 ${this.moduleName} 정리 중...`);
    return true;
  }

  // ⭐ 메시지 전송 헬퍼 메서드들
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      const defaultOptions = {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      };
      return await bot.sendMessage(chatId, text, {
        ...defaultOptions,
        ...options,
      });
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 전송 실패:`, error);
      // Markdown 파싱 오류 시 일반 텍스트로 재시도
      if (error.message?.includes("parse")) {
        return await bot.sendMessage(
          chatId,
          text.replace(/[*_`\[\]]/g, ""),
          options
        );
      }
      throw error;
    }
  }

  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      const defaultOptions = {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      };
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...defaultOptions,
        ...options,
      });
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 수정 실패:`, error);
      // 메시지가 변경되지 않은 경우 무시
      if (error.message?.includes("message is not modified")) {
        return null;
      }
      throw error;
    }
  }

  async sendError(bot, chatId, errorMessage) {
    const text = `❌ **오류 발생**\n\n${errorMessage}`;
    await this.sendMessage(bot, chatId, text);
  }

  // 🔙 뒤로가기 기본 구현
  async goBack(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    // ModuleManager의 메인 메뉴로 돌아가기
    await bot.editMessageText("🏠 메인 메뉴로 돌아갑니다...", {
      chat_id: chatId,
      message_id: messageId,
    });

    // main:menu 콜백 에뮬레이트
    callbackQuery.data = "main:menu";
    return false; // ModuleManager가 처리하도록
  }

  // 📊 통계 조회
  getStats() {
    return {
      moduleName: this.moduleName,
      ...this.stats,
      actionCount: this.actionMap ? this.actionMap.size : 0,
    };
  }

  // 📝 명령어 추출 헬퍼
  extractCommand(text) {
    if (!text || !text.startsWith("/")) return null;
    const match = text.match(/^\/(\w+)/);
    return match ? match[1] : null;
  }

  // 동적 콜백을 처리하기 위한 훅 (하위 클래스에서 오버라이드)
  async handleDynamicCallback(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    // 하위 클래스에서 구현
    return false;
  }
}

module.exports = BaseModule;
