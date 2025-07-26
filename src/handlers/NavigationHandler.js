// src/handlers/NavigationHandler.js - 표준 메뉴 적용

const { MenuBuilder } = require("../config/menuConfig");
const logger = require("../utils/Logger");

class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;

    // 통계
    this.stats = {
      navigationsHandled: 0,
      keyboardsGenerated: 0,
      errorsCount: 0,
    };
  }

  /**
   * 🎯 메인 콜백 처리
   */
  async handleNavigation(bot, callbackQuery) {
    try {
      this.stats.navigationsHandled++;

      // callback_data 파싱
      const parsed = this.parseCallbackData(callbackQuery.data);
      if (!parsed) {
        logger.warn(`Invalid callback_data: ${callbackQuery.data}`);
        return false;
      }

      const { module, action, params } = parsed;
      logger.debug(`🎯 Navigation: ${module}:${action}`, { params });

      // 시스템 네비게이션 직접 처리
      if (module === "system") {
        return await this.handleSystemNavigation(
          bot,
          callbackQuery,
          action,
          params
        );
      }

      // 모듈 네비게이션은 ModuleManager에 위임
      return await this.moduleManager.handleModuleCallback(
        bot,
        callbackQuery,
        module,
        action,
        params
      );
    } catch (error) {
      logger.error("Navigation error:", error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 📊 시스템 네비게이션 처리
   */
  async handleSystemNavigation(bot, callbackQuery, action, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = this.getUserName(callbackQuery);

    switch (action) {
      case "menu":
      case "start":
        return await this.showMainMenu(bot, callbackQuery, userName);

      case "help":
        return await this.showHelp(bot, callbackQuery);

      case "settings":
        return await this.showSettings(bot, callbackQuery);

      default:
        logger.warn(`Unknown system action: ${action}`);
        return false;
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, userName) {
    try {
      const menuText = MenuBuilder.buildMainMenuText(userName);
      const keyboard = MenuBuilder.buildMainMenuKeyboard();

      await this.updateMessage(bot, callbackQuery, menuText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery) {
    const helpText = `❓ **두목봇 도움말**

**🎯 기본 사용법**
• 메뉴 버튼을 눌러 원하는 기능을 선택하세요
• 각 기능별로 세부 메뉴가 제공됩니다
• 언제든 🏠 메인메뉴로 돌아갈 수 있습니다

**⌨️ 명령어**
• /start - 봇 시작 및 메인 메뉴
• /help - 이 도움말 표시
• /cancel - 현재 작업 취소

**💡 사용 팁**
• 모든 메뉴는 2열 구조로 되어있습니다
• 하단에는 항상 메인메뉴/뒤로가기가 있습니다
• 문제 발생시 /start로 재시작하세요

**🆘 문의사항**
관리자에게 문의해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏠 메인메뉴", callback_data: "system:menu" },
          { text: "⚙️ 설정", callback_data: "system:settings" },
        ],
      ],
    };

    await this.updateMessage(bot, callbackQuery, helpText, keyboard);
    return true;
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery) {
    const settingsText = `⚙️ **시스템 설정**

**🔧 현재 설정**
• 언어: 한국어 🇰🇷
• 시간대: Asia/Seoul
• 알림: 활성화 ✅

**📊 사용 통계**
• 처리된 요청: ${this.stats.navigationsHandled}회
• 생성된 메뉴: ${this.stats.keyboardsGenerated}개
• 오류 발생: ${this.stats.errorsCount}회

설정 변경은 각 모듈 메뉴에서 가능합니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 알림설정", callback_data: "settings:notifications" },
          { text: "🌐 언어설정", callback_data: "settings:language" },
        ],
        [{ text: "🏠 메인메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.updateMessage(bot, callbackQuery, settingsText, keyboard);
    return true;
  }

  /**
   * 🎯 모듈 메뉴 렌더링 (모듈에서 호출)
   */
  async renderModuleMenu(bot, callbackQuery, moduleName, additionalInfo = {}) {
    try {
      const menuText = MenuBuilder.buildModuleMenuText(
        moduleName,
        additionalInfo
      );
      const keyboard = MenuBuilder.buildModuleMenuKeyboard(moduleName);

      if (!menuText || !keyboard) {
        logger.error(`Menu not found for module: ${moduleName}`);
        return false;
      }

      await this.updateMessage(bot, callbackQuery, menuText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error(`모듈 메뉴 렌더링 오류 (${moduleName}):`, error);
      return false;
    }
  }

  /**
   * 🔧 유틸리티 메서드들
   */
  parseCallbackData(data) {
    const parts = data.split(":");
    if (parts.length < 2) return null;

    return {
      module: parts[0],
      action: parts[1],
      params: parts.slice(2),
    };
  }

  getUserName(callbackQuery) {
    const user = callbackQuery.from;
    return user.first_name || user.username || "사용자";
  }

  async updateMessage(bot, callbackQuery, text, keyboard) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      if (
        error.response?.body?.description?.includes("message is not modified")
      ) {
        logger.debug("Message content unchanged");
      } else {
        throw error;
      }
    }
  }
}

module.exports = NavigationHandler;
