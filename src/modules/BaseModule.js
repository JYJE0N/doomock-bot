// src/modules/BaseModule.js - Logger 통일 및 완전한 표준 패턴

const logger = require("../utils/Logger"); // ✅ 직접 import 방식
const { getUserName } = require("../utils/UserHelper");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.toLowerCase().replace("module", "");
    this.config = config;

    // 액션 맵
    this.actionMap = new Map();

    // 사용자 상태
    this.userStates = new Map();
  }

  // 초기화
  async initialize() {
    try {
      // 기본 액션 등록
      this.registerDefaultActions();

      // 모듈별 액션 등록
      if (this.registerActions) {
        this.registerActions();
      }

      // 모듈별 초기화
      if (this.onInitialize) {
        await this.onInitialize();
      }

      logger.debug(`${this.name} 초기화 완료`);
    } catch (error) {
      logger.error(`${this.name} 초기화 실패:`, error);
      throw error;
    }
  }

  // 기본 액션 등록
  registerDefaultActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("main", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));
    this.actionMap.set("cancel", this.handleCancel.bind(this));
  }

  // 표준 콜백 처리
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      // 콜백 응답
      await bot.answerCallbackQuery(callbackQuery.id);

      // 액션 맵에서 처리
      const action = this.actionMap.get(subAction);
      if (action) {
        return await action(bot, chatId, messageId, userId, userName, params);
      }

      // 모듈별 커스텀 처리
      if (this.onHandleCallback) {
        return await this.onHandleCallback(
          bot,
          callbackQuery,
          subAction,
          params,
          menuManager
        );
      }

      logger.warn(`${this.name}: 알 수 없는 액션 - ${subAction}`);
      return false;
    } catch (error) {
      logger.error(`${this.name} 콜백 처리 오류:`, error);
      await this.sendErrorMessage(bot, chatId);
      return false;
    }
  }

  // =============== 하위 클래스에서 구현할 메서드들 ===============

  async onInitialize() {
    // 하위 클래스에서 구현
    logger.debug(`${this.name} 기본 초기화 완료`);
  }

  async onHandleMessage(bot, msg) {
    // 하위 클래스에서 구현
    logger.debug(`${this.name} 메시지 처리되지 않음`);
    return false;
  }

  async onHandleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 하위 클래스에서 구현
    logger.debug(`${this.name} 콜백 처리되지 않음: ${subAction}`);
    return false;
  }

  // =============== 기본 UI 메서드들 (표준 패턴) ===============

  async showMenu(bot, chatId, messageId, userId, userName) {
    try {
      const menuData = this.getMenuData(userName);
      await this.editOrSendMessage(bot, chatId, messageId, menuData.text, {
        parse_mode: "Markdown",
        reply_markup: menuData.keyboard,
      });

      logger.debug(`✅ ${this.name} 메뉴 표시 완료: ${userName}`);
    } catch (error) {
      logger.error(`${this.name} 메뉴 표시 실패:`, error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        `❌ ${this.name} 메뉴를 불러오는 중 오류가 발생했습니다.`
      );
    }
  }

  async showHelp(bot, chatId, messageId, userId, userName) {
    try {
      const helpText = `❓ **${this.name} 도움말**\n\n기본 도움말입니다.`;
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` }],
          [{ text: "🏠 메인 메뉴", callback_data: "main_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${this.name} 도움말 표시 완료: ${userName}`);
    } catch (error) {
      logger.error(`${this.name} 도움말 표시 실패:`, error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        `❌ ${this.name} 도움말을 불러오는 중 오류가 발생했습니다.`
      );
    }
  }

  // ✅ 메뉴 데이터 제공 (하위 클래스에서 오버라이드)
  getMenuData(userName) {
    return {
      text: `📝 **${userName}님의 할일 관리**\n\n무엇을 도와드릴까요?`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "🔍 할일 검색", callback_data: "todo:search" },
            { text: "📊 할일 통계", callback_data: "todo:stats" },
          ],
          [
            {
              text: "✅ 완료된 할일 정리",
              callback_data: "todo:clear_completed",
            },
            { text: "🗑️ 모든 할일 삭제", callback_data: "todo:clear_all" },
          ],
          [
            { text: "📤 할일 내보내기", callback_data: "todo:export" },
            { text: "📥 할일 가져오기", callback_data: "todo:import" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ✅ 메시지 편집 또는 전송 (표준 패턴)
  async editOrSendMessage(bot, chatId, messageId, text, options = {}) {
    try {
      if (messageId) {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        await bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      logger.error(`${this.name} 메시지 전송 실패:`, error);

      // 폴백: 새 메시지 전송
      if (messageId) {
        try {
          await bot.sendMessage(chatId, text, options);
          logger.debug(`${this.name} 폴백 메시지 전송 성공`);
        } catch (fallbackError) {
          logger.error(`${this.name} 폴백 메시지도 실패:`, fallbackError);
        }
      }
    }
  }

  // =============== 유틸리티 메서드들 ===============

  // 통계 업데이트
  updateStats(type) {
    this.stats.lastUsed = new Date();

    switch (type) {
      case "command":
        this.stats.commandCount++;
        break;
      case "callback":
        this.stats.callbackCount++;
        break;
      case "error":
        this.stats.errorCount++;
        break;
    }

    logger.debug(`📊 ${this.name} ${type} 통계 업데이트됨`);
  }

  // 에러 처리
  async handleError(bot, chatId, error, messageId = null) {
    logger.error(`${this.name} 에러 처리:`, error);
    this.updateStats("error");

    const errorMessage = `❌ ${this.name}에서 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.`;

    try {
      await this.editOrSendMessage(bot, chatId, messageId, errorMessage);
    } catch (sendError) {
      logger.error(`${this.name} 에러 메시지 전송도 실패:`, sendError);
    }
  }

  // 사용자 상태 관리
  getUserState(userId) {
    return this.userStates.get(userId) || null;
  }

  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: new Date(),
      module: this.name,
    });
    logger.debug(`👤 ${this.name} 사용자 상태 설정: ${userId}`);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
    logger.debug(`👤 ${this.name} 사용자 상태 삭제: ${userId}`);
  }

  // =============== 정리 작업 ===============

  async cleanup() {
    try {
      logger.info(`🧹 ${this.name} 정리 작업 시작`);

      // 사용자 상태 정리
      this.userStates.clear();

      // 액션맵 정리
      this.actionMap.clear();

      // 초기화 상태 재설정
      this.isInitialized = false;

      logger.success(`✅ ${this.name} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.name} 정리 실패:`, error);
    }
  }

  // 모듈 상태 정보
  getModuleInfo() {
    return {
      name: this.name,
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      startTime: this.startTime,
      stats: { ...this.stats },
      actionCount: this.actionMap.size,
      userStateCount: this.userStates.size,
      config: { ...this.config },
    };
  }
}

module.exports = BaseModule;
