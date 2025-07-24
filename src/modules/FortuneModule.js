// src/modules/FortuneModule.js - 표준화된 운세 모듈

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const FortuneService = require("../services/FortuneService");
const logger = require("../utils/Logger"); // ✅ 소문자 logger로 통일

class FortuneModule extends BaseModule {
  constructor() {
    super("FortuneModule", {
      commands: ["fortune", "운세"],
      callbacks: ["fortune"],
      features: [
        "general",
        "work",
        "love",
        "money",
        "health",
        "meeting",
        "tarot",
        "tarot3",
        "lucky",
        "all",
      ],
    });

    // FortuneService 초기화
    try {
      this.fortuneService = new FortuneService();
      logger.info("🔮 FortuneService 초기화 성공"); // ✅ 소문자 logger 사용
    } catch (error) {
      logger.error("❌ FortuneService 초기화 실패:", error); // ✅ 소문자 logger 사용
      this.fortuneService = null;
    }

    logger.info("🔮 FortuneModule 생성됨"); // ✅ 소문자 logger 사용
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showFortuneMenu.bind(this),
      general: this.showGeneralFortune.bind(this),
      work: this.showWorkFortune.bind(this),
      love: this.showLoveFortune.bind(this),
      money: this.showMoneyFortune.bind(this),
      health: this.showHealthFortune.bind(this),
      meeting: this.showMeetingFortune.bind(this),
      tarot: this.showTarotFortune.bind(this),
      tarot3: this.showTarot3Fortune.bind(this),
      lucky: this.showLuckyInfo.bind(this),
      all: this.showAllFortune.bind(this),
      help: this.showFortuneHelp.bind(this),
    });
  }

  // ✅ 모듈 초기화
  async onInitialize() {
    if (!this.fortuneService) {
      throw new Error("FortuneService가 초기화되지 않았습니다.");
    }
    logger.info("✅ FortuneModule 초기화 완료");
  }

  // ✅ 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    // 명령어 처리
    const command = this.extractCommand(text);

    if (command === "fortune" || text === "운세") {
      await this.showFortuneMenu(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    // 운세 관련 텍스트 처리
    if (this.isFortuneRelated(text)) {
      await this.handleFortuneCommand(bot, msg, text);
      return true;
    }

    return false;
  }

  // ==================== 액션 핸들러 ====================

  /**
   * 운세 메뉴 표시
   */
  async showFortuneMenu(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const userName = getUserName(callbackQuery.from);

    const menuText = `🔮 **오늘의 운세**\n\n${userName}님, 어떤 운세를 확인하시겠어요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 종합운세", callback_data: "fortune:general" },
          { text: "💼 업무운", callback_data: "fortune:work" },
        ],
        [
          { text: "💕 연애운", callback_data: "fortune:love" },
          { text: "💰 재물운", callback_data: "fortune:money" },
        ],
        [
          { text: "🏥 건강운", callback_data: "fortune:health" },
          { text: "🍻 회식운", callback_data: "fortune:meeting" },
        ],
        [
          { text: "🃏 타로카드", callback_data: "fortune:tarot" },
          { text: "🔮 타로 3장", callback_data: "fortune:tarot3" },
        ],
        [
          { text: "🍀 행운정보", callback_data: "fortune:lucky" },
          { text: "🌈 전체운세", callback_data: "fortune:all" },
        ],
        [
          { text: "❓ 도움말", callback_data: "fortune:help" },
          { text: "🏠 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
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

  /**
   * 종합운세 표시
   */
  async showGeneralFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getGeneralFortune();

      const fortuneText = `🌟 **${userName}님의 오늘 종합운세**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💼 업무운", callback_data: "fortune:work" },
            { text: "💕 연애운", callback_data: "fortune:love" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("종합운세 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
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
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getWorkFortune();

      const fortuneText = `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💰 재물운", callback_data: "fortune:money" },
            { text: "🏥 건강운", callback_data: "fortune:health" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("업무운 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 연애운 표시
   */
  async showLoveFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getLoveFortune();

      const fortuneText = `💕 **${userName}님의 오늘 연애운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🍻 회식운", callback_data: "fortune:meeting" },
            { text: "🃏 타로카드", callback_data: "fortune:tarot" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("연애운 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 재물운 표시
   */
  async showMoneyFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getMoneyFortune();

      const fortuneText = `💰 **${userName}님의 오늘 재물운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🍀 행운정보", callback_data: "fortune:lucky" },
            { text: "🌟 종합운세", callback_data: "fortune:general" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("재물운 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 건강운 표시
   */
  async showHealthFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getHealthFortune();

      const fortuneText = `🏥 **${userName}님의 오늘 건강운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💼 업무운", callback_data: "fortune:work" },
            { text: "💕 연애운", callback_data: "fortune:love" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("건강운 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 회식운 표시
   */
  async showMeetingFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const fortune = this.fortuneService.getMeetingFortune();

      const fortuneText = `🍻 **${userName}님의 오늘 회식운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💰 재물운", callback_data: "fortune:money" },
            { text: "🏥 건강운", callback_data: "fortune:health" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("회식운 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 타로카드 표시
   */
  async showTarotFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const tarot = this.fortuneService.getTarotCard();

      const tarotText = `🃏 **${userName}님의 타로카드**\n\n${tarot}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔮 타로 3장", callback_data: "fortune:tarot3" },
            { text: "🃏 다른 카드", callback_data: "fortune:tarot" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, tarotText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("타로카드 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 타로카드를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 타로 3장 스프레드 표시
   */
  async showTarot3Fortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const tarot3 = this.fortuneService.getTarot3Spread();

      const tarot3Text = `🔮 **${userName}님의 타로 3장 스프레드**\n\n${tarot3}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🃏 단일 타로", callback_data: "fortune:tarot" },
            { text: "🔮 다시 뽑기", callback_data: "fortune:tarot3" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, tarot3Text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("타로 3장 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 타로카드를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 행운 정보 표시
   */
  async showLuckyInfo(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const luckyInfo = this.fortuneService.getLuckyInfo();

      const luckyText = `🍀 **${userName}님의 행운 정보**\n\n${luckyInfo}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💰 재물운", callback_data: "fortune:money" },
            { text: "🌈 전체운세", callback_data: "fortune:all" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, luckyText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("행운정보 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 행운정보를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 전체 운세 표시
   */
  async showAllFortune(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      const allFortune = this.fortuneService.getAllFortune();

      const allFortuneText = `🌈 **${userName}님의 오늘 전체운세**\n\n${allFortune}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🃏 타로카드", callback_data: "fortune:tarot" },
            { text: "🍀 행운정보", callback_data: "fortune:lucky" },
          ],
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, allFortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("전체운세 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 운세 도움말 표시
   */
  async showFortuneHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **운세 모듈 도움말**

**명령어:**
• \`/fortune\` 또는 "운세" - 운세 메뉴 열기

**운세 종류:**
🌟 **종합운세** - 오늘의 전반적인 운세
💼 **업무운** - 직장에서의 운세
💕 **연애운** - 사랑과 관련된 운세  
💰 **재물운** - 금전과 관련된 운세
🏥 **건강운** - 건강과 관련된 운세
🍻 **회식운** - 사교활동 운세

**특별 기능:**
🃏 **타로카드** - 신비로운 타로 점술
🔮 **타로 3장** - 과거/현재/미래 스프레드
🍀 **행운정보** - 행운의 숫자, 색깔, 방향

**사용법:**
1. 메뉴에서 원하는 운세 선택
2. 매일 새로운 운세 확인 가능
3. 타로카드는 언제든 다시 뽑기 가능`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 운세 관련 텍스트인지 확인
   */
  isFortuneRelated(text) {
    const fortuneKeywords = [
      "운세",
      "타로",
      "점",
      "오늘운세",
      "내운세",
      "종합운",
      "업무운",
      "연애운",
      "재물운",
      "건강운",
      "회식운",
      "행운",
      "카드",
      "점술",
      "운명",
    ];

    return fortuneKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * 운세 명령어 처리 (레거시 지원)
   */
  async handleFortuneCommand(bot, msg, text) {
    const {
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 간단한 텍스트 매칭
      if (text.includes("종합운") || text.includes("전체")) {
        const fortune = this.fortuneService.getGeneralFortune();
        await bot.sendMessage(
          chatId,
          `🌟 **${userName}님의 오늘 종합운세**\n\n${fortune}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else if (text.includes("업무운") || text.includes("직장")) {
        const fortune = this.fortuneService.getWorkFortune();
        await bot.sendMessage(
          chatId,
          `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else if (text.includes("타로")) {
        const tarot = this.fortuneService.getTarotCard();
        await bot.sendMessage(
          chatId,
          `🃏 **${userName}님의 타로카드**\n\n${tarot}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else {
        // 기본 운세 메뉴 표시
        await this.showFortuneMenu(bot, {
          message: { chat: { id: chatId } },
          from: msg.from,
        });
      }
    } catch (error) {
      logger.error("운세 명령어 처리 오류:", error);
      await bot.sendMessage(
        chatId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }
}

module.exports = FortuneModule;
