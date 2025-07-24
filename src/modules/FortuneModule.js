// src/modules/FortuneModule.js - 완전히 수정된 버전
const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class FortuneModule extends BaseModule {
  constructor(bot, options = {}) {
    // ✅ 표준 매개변수
    super("FortuneModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    this.fortuneService = null;

    logger.info("🔮 FortuneModule 생성됨");
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    try {
      const FortuneService = require("../services/FortuneService");
      this.fortuneService = new FortuneService();

      if (this.fortuneService.initialize) {
        await this.fortuneService.initialize();
      }

      logger.info("✅ FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 초기화 실패:", error);
      this.fortuneService = null;
    }
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      draw: this.showFortuneMenu, // fortune:draw 처리
      general: this.showGeneralFortune,
      work: this.showWorkFortune,
      love: this.showLoveFortune,
      money: this.showMoneyFortune,
      health: this.showHealthFortune,
      meeting: this.showMeetingFortune,
      tarot: this.showTarot,
      tarot3: this.showTarotThreeSpread,
      lucky: this.showLucky,
      all: this.showAllFortune,
      help: this.showHelp,
    });
  }

  /**
   * 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);
    const text = `🔮 **${userName}님의 운세 메뉴**\n\n오늘의 운세를 확인해보세요!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🎴 운세 뽑기", callback_data: "fortune:draw" }],
        [{ text: "❓ 도움말", callback_data: "fortune:help" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 운세 종류 선택 메뉴
   */
  async showFortuneMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);
    const text = `🔮 **${userName}님의 오늘 운세**\n\n어떤 운세를 확인하시겠어요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 일반운", callback_data: "fortune:general" },
          { text: "💼 업무운", callback_data: "fortune:work" },
        ],
        [
          { text: "💕 연애운", callback_data: "fortune:love" },
          { text: "💰 재물운", callback_data: "fortune:money" },
        ],
        [
          { text: "🌿 건강운", callback_data: "fortune:health" },
          { text: "🍻 회식운", callback_data: "fortune:meeting" },
        ],
        [
          { text: "🃏 타로카드", callback_data: "fortune:tarot" },
          { text: "🔮 타로 3장", callback_data: "fortune:tarot3" },
        ],
        [
          { text: "🍀 행운정보", callback_data: "fortune:lucky" },
          { text: "📋 종합운세", callback_data: "fortune:all" },
        ],
        [{ text: "🔙 뒤로", callback_data: "fortune:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 일반운 표시
   */
  async showGeneralFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "general");
      const text = `🌟 **${userName}님의 오늘 일반운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showGeneralFortune 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 일반운을 가져오는 중 오류가 발생했습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 뒤로", callback_data: "fortune:menu" }],
            ],
          },
        }
      );
    }
  }

  /**
   * 업무운 표시
   */
  async showWorkFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "work");
      const text = `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showWorkFortune 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  // 나머지 운세 메서드들도 동일한 패턴으로...
  async showLoveFortune(bot, callbackQuery, params, moduleManager) {
    await this.showFortune(bot, callbackQuery, "love", "💕", "연애운");
  }

  async showMoneyFortune(bot, callbackQuery, params, moduleManager) {
    await this.showFortune(bot, callbackQuery, "money", "💰", "재물운");
  }

  async showHealthFortune(bot, callbackQuery, params, moduleManager) {
    await this.showFortune(bot, callbackQuery, "health", "🌿", "건강운");
  }

  async showMeetingFortune(bot, callbackQuery, params, moduleManager) {
    await this.showFortune(bot, callbackQuery, "meeting", "🍻", "회식운");
  }

  /**
   * 공통 운세 표시 메서드
   */
  async showFortune(bot, callbackQuery, type, icon, typeName) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, type);
      const text = `${icon} **${userName}님의 오늘 ${typeName}**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`show${type}Fortune 오류:`, error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 타로카드
   */
  async showTarot(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const tarot = this.fortuneService.getTarot(userId);
      const text = `🃏 **${userName}님의 타로카드**\n\n${tarot}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showTarot 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 타로 3장 스프레드
   */
  async showTarotThreeSpread(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const tarot = this.fortuneService.getTarotThreeSpread(userId);
      const text = `🔮 **${userName}님의 타로 3장 스프레드**\n\n${tarot}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showTarotThreeSpread 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 행운 정보
   */
  async showLucky(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const lucky = this.fortuneService.getLucky(userId, userName);

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, lucky, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showLucky 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 종합 운세
   */
  async showAllFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userId = from.id;
    const userName = getUserName(from);

    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const allFortune = this.fortuneService.getAllFortune(userId, userName);

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:draw" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, allFortune, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("showAllFortune 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 도움말
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const text = `🎴 **운세 도움말**

• 운세 뽑기: 다양한 종류의 운세를 확인할 수 있습니다
• 매일 새로운 운세가 제공됩니다
• 재미로만 보세요 😉

**운세 종류:**
• 일반운, 업무운, 연애운, 재물운
• 건강운, 회식운, 타로카드
• 행운정보, 종합운세`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 메시지 처리
   */
  async handleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    if (text === "/fortune" || text === "운세") {
      await this.sendFortuneMenu(bot, chatId);
      return true;
    }

    return false;
  }

  /**
   * 운세 메뉴 전송 (메시지용)
   */
  async sendFortuneMenu(bot, chatId) {
    const text = `🔮 **운세 메뉴**\n\n오늘의 운세를 확인해보세요!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🎴 운세 뽑기", callback_data: "fortune:draw" }],
        [{ text: "❓ 도움말", callback_data: "fortune:help" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.sendMessage(bot, chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
}

module.exports = FortuneModule;
