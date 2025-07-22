// src/modules/BaseModule.js - 리팩토링된 깔끔한 버전

const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

class BaseModule {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.actionMap = new Map();

    // 통계
    this.stats = {
      messageCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastActivity: null,
    };

    logger.debug(`📦 ${moduleName} 모듈 생성됨`);
  }

  extractCommand(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    // 텍스트 정리
    text = text.trim();

    // 명령어가 /로 시작하는지 확인
    if (text.startsWith("/")) {
      // /weather@botname 형태에서 @botname 제거
      const command = text.substring(1).split(" ")[0].replace(/@\w+$/, "");
      return command.toLowerCase();
    }

    // 일반 텍스트에서 명령어 추출 (예: "날씨" -> "날씨")
    const firstWord = text.split(" ")[0].toLowerCase();
    return firstWord;
  }

  // 🎯 표준 초기화 메서드
  async initialize() {
    try {
      // 액션 설정 (하위 클래스에서 구현)
      if (typeof this.setupActions === "function") {
        await this.setupActions();
        logger.debug(
          `✅ ${this.moduleName}: 액션 설정 완료 (${this.actionMap.size}개)`
        );
      }

      // 하위 클래스의 초기화 로직
      if (typeof this.onInitialize === "function") {
        await this.onInitialize();
      }

      this.stats.lastActivity = TimeHelper.getCurrentTime();
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🎯 메시지 핸들러 (표준 매개변수)
  async handleMessage(bot, msg) {
    try {
      this.stats.messageCount++;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      // 하위 클래스에서 구현
      if (typeof this.onHandleMessage === "function") {
        return await this.onHandleMessage(bot, msg);
      }

      return false;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      throw error;
    }
  }

  // 🎯 콜백 핸들러 (표준 매개변수)
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbackCount++;
      this.stats.lastActivity = TimeHelper.getCurrentTime();

      logger.debug(`🎯 ${this.moduleName} 콜백 처리: ${subAction}`);

      // 액션맵에서 핸들러 찾기
      const handler = this.actionMap.get(subAction);
      if (handler) {
        logger.debug(`✅ ${this.moduleName}: 액션 '${subAction}' 실행`);
        return await handler.call(
          this,
          bot,
          callbackQuery,
          params,
          moduleManager
        );
      }

      // 동적 콜백 처리 (하위 클래스에서 구현)
      if (typeof this.onHandleDynamicCallback === "function") {
        const handled = await this.onHandleDynamicCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
        if (handled) return true;
      }

      logger.warn(`⚠️ ${this.moduleName}: 처리할 수 없는 액션 - ${subAction}`);
      return false;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      throw error;
    }
  }

  // 🔧 액션 등록 헬퍼
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      logger.warn(`⚠️ ${this.moduleName}: '${name}'은 함수가 아님`);
      return;
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`📝 ${this.moduleName}: 액션 등록 - ${name}`);
  }

  // 🔧 여러 액션 한번에 등록
  registerActions(actions) {
    Object.entries(actions).forEach(([name, handler]) => {
      this.registerAction(name, handler);
    });
  }

  // 📤 메시지 전송 헬퍼
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

  // 📝 메시지 편집 헬퍼
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      if (!messageId) {
        logger.warn("⚠️ messageId가 없어 새 메시지 전송");
        return await this.sendMessage(bot, chatId, text, options);
      }

      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      // 편집 실패 시 새 메시지로 대체
      if (error.response?.body?.error_code === 400) {
        const errorDesc = error.response.body.description;

        if (
          errorDesc.includes("message is not modified") ||
          errorDesc.includes("message to edit not found") ||
          errorDesc.includes("message identifier is not specified")
        ) {
          logger.debug("메시지 편집 불가, 새 메시지 전송");
          return await this.sendMessage(bot, chatId, text, options);
        }
      }

      logger.error(`❌ ${this.moduleName} 메시지 편집 실패:`, error);
      throw error;
    }
  }

  // ❌ 에러 메시지 전송
  async sendError(bot, chatId, errorMessage, options = {}) {
    const text = `❌ **오류 발생**\n\n${errorMessage}`;
    return await this.sendMessage(bot, chatId, text, options);
  }

  // 📊 통계 조회
  getStats() {
    return {
      moduleName: this.moduleName,
      ...this.stats,
      actionCount: this.actionMap.size,
    };
  }
  xtractCommand(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    // 텍스트 정리
    text = text.trim();

    // 명령어가 /로 시작하는지 확인
    if (text.startsWith("/")) {
      // /weather@botname 형태에서 @botname 제거
      const command = text.substring(1).split(" ")[0].replace(/@\w+$/, "");
      return command.toLowerCase();
    }

    // 일반 텍스트에서 명령어 추출 (예: "날씨" -> "날씨")
    const firstWord = text.split(" ")[0].toLowerCase();
    return firstWord;
  }

  // 🎯 메시지 처리 (수정된 버전 - 더 안전한 처리)
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    if (!text) return false;

    try {
      const command = this.extractCommand(text);

      if (command === "weather" || command === "날씨") {
        await this.showMenu(bot, chatId);
        return true;
      }

      // 도시명으로 날씨 검색
      if (text.includes("날씨")) {
        const city = text.replace(/날씨/g, "").trim();
        if (city) {
          await this.showCityWeather(bot, chatId, city);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error(`WeatherModule 메시지 처리 오류:`, error);
      return false;
    }
  }
  // 🧹 정리
  async cleanup() {
    try {
      if (typeof this.onCleanup === "function") {
        await this.onCleanup();
      }

      this.actionMap.clear();
      logger.info(`🧹 ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 중 오류:`, error);
    }
  }

  // ===== 하위 클래스에서 구현해야 할 메서드들 =====

  // async setupActions() {
  //   // 액션 등록
  //   this.registerActions({
  //     menu: this.showMenu,
  //     help: this.showHelp,
  //   });
  // }

  // async onInitialize() {
  //   // 초기화 로직
  // }

  // async onHandleMessage(bot, msg) {
  //   // 메시지 처리 로직
  //   return false;
  // }

  // async onHandleDynamicCallback(bot, callbackQuery, subAction, params, moduleManager) {
  //   // 동적 콜백 처리 로직
  //   return false;
  // }

  // async onCleanup() {
  //   // 정리 로직
  // }
}

module.exports = BaseModule;
