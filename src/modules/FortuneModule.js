// src/modules/FortuneModule.js - 최신 표준 패턴으로 완전히 리팩토링

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { FortuneService } = require("../services/FortuneService");
const Logger = require("../utils/Logger");

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

    this.fortuneService = new FortuneService();
    Logger.info(
      "🔮 FortuneService 초기화:",
      this.fortuneService ? "성공" : "실패"
    );
  }

  // ✅ 표준 액션 등록 패턴 적용
  registerActions() {
    // 🔮 운세 타입별 액션 등록 (BaseModule의 기본 액션들과 별도)
    this.actionMap.set("general", this.showGeneralFortune.bind(this));
    this.actionMap.set("work", this.showWorkFortune.bind(this));
    this.actionMap.set("love", this.showLoveFortune.bind(this));
    this.actionMap.set("money", this.showMoneyFortune.bind(this));
    this.actionMap.set("health", this.showHealthFortune.bind(this));
    this.actionMap.set("meeting", this.showMeetingFortune.bind(this));

    // 🃏 타로카드 액션들
    this.actionMap.set("tarot", this.showTarot.bind(this));
    this.actionMap.set("tarot3", this.showTarotThreeSpread.bind(this));

    // 🍀 기타 운세 액션들
    this.actionMap.set("lucky", this.showLucky.bind(this));
    this.actionMap.set("all", this.showAllFortune.bind(this));

    // 📋 추가 액션들 (기존 구조 호환)
    this.actionMap.set("today", this.showGeneralFortune.bind(this)); // today는 general과 동일
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    return {
      text: `🔮 **${userName}님의 오늘 운세**\n\n어떤 운세를 확인하시겠어요?`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "🌟 일반운", callback_data: "fortune_general" },
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
            { text: "🔮 타로 3장", callback_data: "fortune_tarot3" },
          ],
          [
            { text: "🍀 행운정보", callback_data: "fortune_lucky" },
            { text: "📋 종합운세", callback_data: "fortune_all" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ========== 개별 운세 메서드들 - 표준 패턴 ==========

  async showGeneralFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "general");
      const text = `🌟 **${userName}님의 오늘 일반운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showGeneralFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showWorkFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "work");
      const text = `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showWorkFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showLoveFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "love");
      const text = `💕 **${userName}님의 오늘 연애운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showLoveFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showMoneyFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "money");
      const text = `💰 **${userName}님의 오늘 재물운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showMoneyFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showHealthFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "health");
      const text = `🌿 **${userName}님의 오늘 건강운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showHealthFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showMeetingFortune(bot, chatId, messageId, userId, userName) {
    try {
      const fortune = this.fortuneService.getFortune(userId, "meeting");
      const text = `🍻 **${userName}님의 오늘 회식운**\n\n${fortune}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showMeetingFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ========== 타로카드 메서드들 ==========

  async showTarot(bot, chatId, messageId, userId, userName) {
    try {
      const tarot = this.fortuneService.getTarot(userId);
      const text = `🃏 **${userName}님의 오늘 타로카드**\n\n${tarot}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTarotMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showTarot 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showTarotThreeSpread(bot, chatId, messageId, userId, userName) {
    try {
      const tarot3 = this.fortuneService.getTarotThreeSpread(userId);
      const text = `🔮 **${userName}님의 타로 3장 스프레드**\n\n${tarot3}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTarotMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showTarotThreeSpread 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ========== 기타 운세 메서드들 ==========

  async showLucky(bot, chatId, messageId, userId, userName) {
    try {
      const lucky = this.fortuneService.getLucky(userId, userName);

      await this.editMessage(bot, chatId, messageId, lucky, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showLucky 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showAllFortune(bot, chatId, messageId, userId, userName) {
    try {
      const allFortune = this.fortuneService.getAllFortune(userId, userName);

      await this.editMessage(bot, chatId, messageId, allFortune, {
        parse_mode: "Markdown",
        reply_markup: this.getFortuneMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`FortuneModule showAllFortune 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ========== 키보드 생성 메서드들 ==========

  getFortuneMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔮 운세 메뉴", callback_data: "fortune_menu" },
          { text: "🃏 타로카드", callback_data: "fortune_tarot" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };
  }

  getTarotMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔮 운세 메뉴", callback_data: "fortune_menu" },
          { text: "🍀 행운정보", callback_data: "fortune_lucky" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };
  }

  // ✅ 도움말 메시지 오버라이드
  getHelpMessage() {
    return `🔮 **운세 사용법**

**📱 메뉴 방식:**
/start → 🔮 운세 → 원하는 운세 선택

**⌨️ 명령어 방식:**
/fortune - 오늘의 일반 운세
/fortune work - 오늘의 업무운
/fortune love - 오늘의 연애운
/fortune money - 오늘의 재물운
/fortune health - 오늘의 건강운
/fortune meeting - 오늘의 회식운
/fortune tarot - 오늘의 타로카드
/fortune tarot3 - 타로 3장 스프레드
/fortune lucky - 오늘의 행운 정보
/fortune all - 종합 운세

✨ **특징:**
• 개인별 맞춤 운세
• 실제 이름으로 개인화
• 한국 시간 기준
• 매일 새로운 운세

당신만의 특별한 운세를 확인해보세요! 🌟`;
  }

  // ========== 명령어 처리 (기존 호환성 유지) ==========

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text && text.startsWith("/fortune")) {
      await this.handleFortuneCommand(bot, msg);
      this.updateStats("command");
      return true;
    }

    return false;
  }

  async handleFortuneCommand(bot, msg) {
    try {
      const {
        chat: { id: chatId },
        from,
        text,
      } = msg;
      const userName = getUserName(from);
      const args = text.split(" ");
      const subCommand = args[1];

      if (!subCommand) {
        // 기본 일반운세
        const fortune = this.fortuneService.getFortune(from.id, "general");
        const text = `🌟 **${userName}님의 오늘 일반운**\n\n${fortune}`;
        await this.sendMessage(bot, chatId, text, { parse_mode: "Markdown" });
        return;
      }

      // 서브 명령어 처리
      const commandMap = {
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

        await this.sendMessage(bot, chatId, responseText, {
          parse_mode: "Markdown",
        });
      } else {
        // 알 수 없는 명령어면 도움말 표시
        await this.sendMessage(bot, chatId, this.getHelpMessage(), {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      Logger.error("FortuneModule handleFortuneCommand 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  // ========== 초기화 ==========

  async initialize() {
    try {
      if (!this.fortuneService) {
        throw new Error("FortuneService가 초기화되지 않았습니다.");
      }

      await super.initialize();
      Logger.success("✅ FortuneModule 초기화 완료");
    } catch (error) {
      Logger.error("❌ FortuneModule 초기화 실패:", error);
      throw error;
    }
  }
}

module.exports = FortuneModule;
