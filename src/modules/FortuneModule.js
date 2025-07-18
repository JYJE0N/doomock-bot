// src/modules/FortuneModule.js - 수정된 버전

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { FortuneService } = require("../services/FortuneService");

class FortuneModule extends BaseModule {
  constructor() {
    super("FortuneModule", {
      commands: ["fortune"],
      callbacks: ["fortune"],
    });
    // FortuneService 인스턴스 생성
    this.fortuneService = new FortuneService();
    console.log(
      "🔮 FortuneService 초기화:",
      this.fortuneService ? "성공" : "실패"
    );
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text && text.startsWith("/fortune")) {
      await this.handleFortuneCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);
    switch (subAction) {
      case "menu":
        await this.showFortuneMenu(
          bot,
          chatId,
          messageId,
          userName,
          menuManager
        );
        break;
      case "general":
        await this.showFortune(bot, chatId, messageId, from.id, "general");
        break;
      case "work":
        await this.showFortune(bot, chatId, messageId, from.id, "work");
        break;
      case "love":
        await this.showFortune(bot, chatId, messageId, from.id, "love");
        break;
      case "money":
        await this.showFortune(bot, chatId, messageId, from.id, "money");
        break;
      case "health":
        await this.showFortune(bot, chatId, messageId, from.id, "health");
        break;
      case "meeting":
        await this.showFortune(bot, chatId, messageId, from.id, "meeting");
        break;
      case "tarot":
        await this.showTarot(bot, chatId, messageId, from.id);
        break;
      case "tarot3":
        await this.showTarotThreeSpread(bot, chatId, messageId, from.id);
        break;
      case "lucky":
        await this.showLucky(bot, chatId, messageId, from.id);
        break;
      case "all":
        await this.showAllFortune(bot, chatId, messageId, from);
        break;
      default:
        await this.sendMessage(bot, chatId, "❌ 알 수 없는 미래입니다.");
    }
  }

  async handleFortuneCommand(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const text = msg.text;
    const userName = getUserName(from);

    if (text === "/fortune") {
      await this.showFortune(bot, chatId, null, from.id, "general");
    } else if (text === "/fortune work") {
      await this.showFortune(bot, chatId, null, from.id, "work");
    } else if (text === "/fortune love") {
      await this.showFortune(bot, chatId, null, from.id, "love");
    } else if (text === "/fortune money") {
      await this.showFortune(bot, chatId, null, from.id, "money");
    } else if (text === "/fortune health") {
      await this.showFortune(bot, chatId, null, from.id, "health");
    } else if (text === "/fortune meeting") {
      await this.showFortune(bot, chatId, null, from.id, "meeting");
    } else if (text === "/fortune tarot") {
      await this.showTarot(bot, chatId, null, from.id);
    } else if (text === "/fortune lucky") {
      await this.showLucky(bot, chatId, null, from.id);
    } else if (text === "/fortune all") {
      await this.showAllFortune(bot, chatId, null, from);
    } else {
      await this.showFortuneHelp(bot, chatId);
    }
  }

  async showFortuneMenu(bot, chatId, messageId, userName, menuManager) {
    const menuText = `🔮 **${userName}님의 운세 메뉴**\n\n오늘의 운세를 확인해보세요:`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 일반운세", callback_data: "fortune_general" },
          { text: "💼 업무운", callback_data: "fortune_work" },
        ],
        [
          { text: "💕 연애운", callback_data: "fortune_love" },
          { text: "💰 재물운", callback_data: "fortune_money" },
        ],
        [
          { text: "🌿 건강운", callback_data: "fortune_health" },
          { text: "🍻 회식운", callback_data: "fortune_meeting" },
        ],
        [
          { text: "🃏 타로카드", callback_data: "fortune_tarot" },
          { text: "🍀 행운정보", callback_data: "fortune_lucky" },
        ],
        [
          { text: "🔮 종합운세", callback_data: "fortune_all" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showFortune(bot, chatId, messageId, userId, type) {
    const fortune = this.fortuneService.getFortune(userId, type);
    const typeNames = {
      general: "🌟 일반운세",
      work: "💼 업무운",
      love: "💕 연애운",
      money: "💰 재물운",
      health: "🌿 건강운",
      meeting: "🍻 회식운",
    };

    const fortuneText = `${typeNames[type]}\n\n${fortune}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔮 다른 운세", callback_data: "fortune_menu" },
          { text: "🃏 타로카드", callback_data: "fortune_tarot" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, fortuneText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showTarot(bot, chatId, messageId, userId) {
    const tarot = this.fortuneService.getTarot(userId);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔮 다른 운세", callback_data: "fortune_menu" },
          { text: "🍀 행운정보", callback_data: "fortune_lucky" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `🃏 **오늘의 타로카드**\n\n${tarot}`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } else {
      await this.sendMessage(
        bot,
        chatId,
        `🃏 **오늘의 타로카드**\n\n${tarot}`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    }
  }

  async showLucky(bot, chatId, messageId, userId) {
    const lucky = this.fortuneService.getLucky(userId);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔮 다른 운세", callback_data: "fortune_menu" },
          { text: "🃏 타로카드", callback_data: "fortune_tarot" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, lucky, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, lucky, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showAllFortune(bot, chatId, messageId, user) {
    const userName = getUserName(user);
    const allFortune = this.fortuneService.getAllFortune(user.id, userName);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔮 운세 메뉴", callback_data: "fortune_menu" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, allFortune, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, allFortune, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showFortuneHelp(bot, chatId) {
    const helpText =
      `🔮 **운세 사용법**\n\n` +
      `**📱 메뉴 방식:**\n` +
      `/start → 🔮 운세 → 원하는 운세 선택\n\n` +
      `**⌨️ 명령어 방식:**\n` +
      `/fortune - 오늘의 일반 운세\n` +
      `/fortune work - 오늘의 업무운\n` +
      `/fortune love - 오늘의 연애운\n` +
      `/fortune money - 오늘의 재물운\n` +
      `/fortune health - 오늘의 건강운\n` +
      `/fortune meeting - 오늘의 회식운\n` +
      `/fortune tarot - 오늘의 타로카드\n` +
      `/fortune lucky - 오늘의 행운 정보\n` +
      `/fortune all - 종합 운세\n\n` +
      `✨ **특징:**\n` +
      `• 개인별 맞춤 운세\n` +
      `• 실제 이름으로 개인화\n` +
      `• 한국 시간 기준\n` +
      `• 매일 새로운 운세\n\n` +
      `당신만의 특별한 운세를 확인해보세요! 🌟`;

    await this.sendMessage(bot, chatId, helpText, { parse_mode: "Markdown" });
  }
}

module.exports = FortuneModule;
