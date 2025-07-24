// src/modules/FortuneModule.js - BaseModule 표준 완전 호환

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const FortuneService = require("../services/FortuneService");

// ✅ BaseModule과 동일한 logger 방식 사용 (getLogger 함수 삭제됨)
const logger = require("../utils/Logger");

class FortuneModule extends BaseModule {
  constructor() {
    super("FortuneModule", {
      commands: ["fortune"],
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
      logger.info("🔮 FortuneService 초기화 성공");
    } catch (error) {
      logger.error("❌ FortuneService 초기화 실패:", error);
      this.fortuneService = null;
    }
  }

  // ✅ BaseModule 표준 액션 등록 (이게 핵심!)
  // FortuneModule의 setupActions 메서드

  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,
      help: this.showHelp,

      // 🔮 운세 타입별 액션
      general: this.showGeneralFortune,
      work: this.showWorkFortune,
      love: this.showLoveFortune,
      money: this.showMoneyFortune,
      health: this.showHealthFortune,
      meeting: this.showMeetingFortune,

      // 🃏 타로카드 액션
      tarot: this.showTarot,
      tarot3: this.showTarotThreeSpread,

      // 🍀 기타 운세 액션
      lucky: this.showLucky,
      all: this.showAllFortune,

      // 📋 호환성을 위한 별칭
      today: this.showGeneralFortune,
    });

    logger.debug(`🎯 FortuneModule 액션 등록 완료: ${this.actionMap.size}개`);
  }

  // ✅ BaseModule의 getMenuData 오버라이드
  getMenuData(userName) {
    return {
      text: `🔮 **${userName}님의 오늘 운세**\n\n어떤 운세를 확인하시겠어요?`,
      keyboard: {
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
          [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
        ],
      },
    };
  }
  // 🎴 운세 메뉴
  async showMenu(bot, chatId, messageId, from) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const text = `🔮 *${userName}님의 운세 메뉴*\n\n오늘의 운세를 확인해보세요!`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🎴 운세 뽑기", callback_data: "fortune:draw" }],
        [{ text: "❓ 도움말", callback_data: "fortune:help" }],
        [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ❓ 운세 도움말
  async showHelp(bot, chatId, messageId, from) {
    const text =
      "🎴 *운세 도움말*\n\n" +
      "• 운세 뽑기: 무작위 운세를 보여줍니다\n" +
      "• 매일 한 번만 뽑을 수 있어요\n" +
      "• 재미로만 보세요 😉";

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
        ],
      },
    });
  }

  // ========== 개별 운세 메서드들 - BaseModule 표준 패턴 ==========

  async showGeneralFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "general");
      const text = `🌟 **${userName}님의 오늘 일반운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 일반운 표시 완료`);
    } catch (error) {
      logger.error("showGeneralFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 일반운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showWorkFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "work");
      const text = `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 업무운 표시 완료`);
    } catch (error) {
      logger.error("showWorkFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 업무운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showLoveFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "love");
      const text = `💕 **${userName}님의 오늘 연애운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 연애운 표시 완료`);
    } catch (error) {
      logger.error("showLoveFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 연애운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showMoneyFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "money");
      const text = `💰 **${userName}님의 오늘 재물운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 재물운 표시 완료`);
    } catch (error) {
      logger.error("showMoneyFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 재물운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showHealthFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "health");
      const text = `🌿 **${userName}님의 오늘 건강운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 건강운 표시 완료`);
    } catch (error) {
      logger.error("showHealthFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 건강운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showMeetingFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const fortune = this.fortuneService.getFortune(userId, "meeting");
      const text = `🍻 **${userName}님의 오늘 회식운**\n\n${fortune}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 회식운 표시 완료`);
    } catch (error) {
      logger.error("showMeetingFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 회식운을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showTarot(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const tarot = this.fortuneService.getTarot(userId);
      const text = `🃏 **${userName}님의 타로카드**\n\n${tarot}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 타로카드 표시 완료`);
    } catch (error) {
      logger.error("showTarot 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 타로카드를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showTarotThreeSpread(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const tarotSpread = this.fortuneService.getTarotThreeSpread(userId);
      const text = `🔮 **${userName}님의 타로 3장 스프레드**\n\n${tarotSpread}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 타로 3장 스프레드 표시 완료`);
    } catch (error) {
      logger.error("showTarotThreeSpread 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 타로 3장 스프레드를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showLucky(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const lucky = this.fortuneService.getLucky(userId, userName);
      const text = `🍀 **${userName}님의 행운 정보**\n\n${lucky}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 행운 정보 표시 완료`);
    } catch (error) {
      logger.error("showLucky 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 행운 정보를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async showAllFortune(bot, chatId, messageId, userId, userName) {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      const allFortune = this.fortuneService.getAllFortune(userId, userName);

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 운세 메뉴", callback_data: "fortune:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, allFortune, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 종합운세 표시 완료`);
    } catch (error) {
      logger.error("showAllFortune 오류:", error);
      await this.editOrSendMessage(
        bot,
        chatId,
        messageId,
        "❌ 종합운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  // ========== 메시지 처리 (BaseModule onHandleMessage 구현) ==========

  // FortuneModule의 handleMessage 메서드 수정
  async handleMessage(bot, msg) {
    // msg에서 필요한 정보 추출
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text) return false;

    // 운세 명령어 처리
    const fortuneMatch = text.match(/^\/?(fortune|운세)(?:\s+(.+))?/i);
    if (fortuneMatch) {
      await this.handleFortuneCommand(bot, msg, fortuneMatch[2]);
      return true;
    }

    return false;
  }

  async handleFortuneCommand(bot, msg, subCommand) {
    // msg 대신 개별 변수 사용
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = getUserName(msg.from);

    // if (!subCommand) {
    //   // 기본: 운세 메뉴 표시
    //   const menuData = this.getMenuData(userName);
    //   await bot.sendMessage(chatId, menuData.text, {
    //     parse_mode: "Markdown",
    //     reply_markup: menuData.keyboard,
    //   });
    //   return;
    // }

    try {
      if (!this.fortuneService) {
        await bot.sendMessage(chatId, "❌ 운세 서비스를 사용할 수 없습니다.");
        return;
      }

      // 서브 명령어 직접 처리 (기존 호환성)
      const commandMap = {
        general: () => this.fortuneService.getFortune(from.id, "general"),
        work: () => this.fortuneService.getFortune(from.id, "work"),
        love: () => this.fortuneService.getFortune(from.id, "love"),
        money: () => this.fortuneService.getFortune(from.id, "money"),
        health: () => this.fortuneService.getFortune(from.id, "health"),
        meeting: () => this.fortuneService.getFortune(from.id, "meeting"),
        tarot: () => this.fortuneService.getTarot(from.id),
        tarot3: () => this.fortuneService.getTarotThreeSpread(from.id),
        lucky: () => this.fortuneService.getLucky(from.id, userName),
        all: () => this.fortuneService.getAllFortune(from.id, userName),
      };

      const typeIcons = {
        general: "🌟",
        work: "💼",
        love: "💕",
        money: "💰",
        health: "🌿",
        meeting: "🍻",
        tarot: "🃏",
        tarot3: "🔮",
        lucky: "🍀",
        all: "📋",
      };

      const typeNames = {
        general: "일반운",
        work: "업무운",
        love: "연애운",
        money: "재물운",
        health: "건강운",
        meeting: "회식운",
        tarot: "타로카드",
        tarot3: "타로 3장 스프레드",
        lucky: "행운 정보",
        all: "종합운세",
      };

      if (commandMap[subCommand]) {
        const result = commandMap[subCommand]();
        const icon = typeIcons[subCommand];
        const typeName = typeNames[subCommand];

        let responseText;
        if (subCommand === "lucky" || subCommand === "all") {
          responseText = result; // 이미 포맷팅된 텍스트
        } else {
          responseText = `${icon} **${userName}님의 오늘 ${typeName}**\n\n${result}`;
        }

        await bot.sendMessage(chatId, responseText, {
          parse_mode: "Markdown",
        });
      } else {
        // 알 수 없는 명령어 - 운세 메뉴 표시
        const menuData = this.getMenuData(userName);
        await bot.sendMessage(chatId, menuData.text, {
          parse_mode: "Markdown",
          reply_markup: menuData.keyboard,
        });
      }
    } catch (error) {
      logger.error("handleFortuneCommand 오류:", error);
      await bot.sendMessage(
        msg.chat.id,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  // ========== 초기화 (BaseModule onInitialize 구현) ==========

  async onInitialize() {
    if (!this.fortuneService) {
      throw new Error("FortuneService가 초기화되지 않았습니다.");
    }

    logger.success("✅ FortuneModule 초기화 완료");
  }
}

module.exports = FortuneModule;
