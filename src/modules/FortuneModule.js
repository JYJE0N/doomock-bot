// ===== 🔮 FortuneModule.js - 단순화된 버전 =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

class FortuneModule extends BaseModule {
  constructor(bot, options = {}) {
    super("FortuneModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;
    this.fortuneService = null;

    logger.module("FortuneModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      // ✅ ServiceBuilder에서 이미 생성된 인스턴스 가져오기
      this.fortuneService = this.serviceBuilder.getServiceInstance("fortune");

      if (!this.fortuneService) {
        logger.info("FortuneService 인스턴스가 없어서 새로 생성합니다...");
        this.fortuneService = await this.serviceBuilder.getOrCreate("fortune");
      }

      // ✅ initialize 메서드가 있을 때만 호출
      if (typeof this.fortuneService.initialize === "function") {
        await this.fortuneService.initialize();
        logger.success("FortuneService 초기화 완료");
      } else {
        logger.info("FortuneService는 별도의 initialize가 필요하지 않습니다");
      }

      // 액션 설정
      this.setupActions();

      logger.success("✅ FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("💥 FortuneModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    // ✅ 단순화된 액션들 - 원카드와 트리플카드만
    this.registerActions({
      menu: this.showMenu,
      single: this.showSingleCard, // 원카드 뽑기
      triple: this.showTripleCards, // 트리플카드 뽑기
      shuffle: this.shuffleOnly, // 셔플만
      stats: this.showStats, // 통계
      help: this.showHelp, // 도움말
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const command = this.extractCommand(text);
    if (command === "fortune" || command === "운세" || command === "타로") {
      // ✅ NavigationHandler를 통한 표준 메뉴 호출
      if (this.moduleManager?.navigationHandler?.sendModuleMenu) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          chatId,
          "fortune"
        );
      } else {
        await bot.sendMessage(chatId, "🔮 운세 메뉴를 불러오는 중...");
      }
      return true;
    }
    return false;
  }

  // ===== 🎯 액션 메서드들 (단순화된 버전) =====

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // ✅ 안전한 서비스 호출
      let stats = null;
      if (
        this.fortuneService &&
        typeof this.fortuneService.getUserStats === "function"
      ) {
        stats = await this.fortuneService.getUserStats(userId);
      } else {
        stats = this.getDummyStats();
      }

      return {
        type: "menu",
        module: "fortune",
        data: { stats },
      };
    } catch (error) {
      logger.error("운세 메뉴 오류:", error);
      return {
        type: "error",
        module: "fortune",
        message: "운세 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  async showSingleCard(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      let fortune = null;

      // ✅ 안전한 메서드 호출
      if (
        this.fortuneService &&
        typeof this.fortuneService.drawSingleCard === "function"
      ) {
        fortune = await this.fortuneService.drawSingleCard(userId);
      } else {
        // 폴백 - 더미 데이터
        fortune = this.getDummySingleCard();
      }

      return {
        type: "single",
        module: "fortune",
        data: { fortune },
      };
    } catch (error) {
      logger.error("원카드 뽑기 오류:", error);
      return {
        type: "error",
        module: "fortune",
        message: "카드를 뽑을 수 없습니다.",
      };
    }
  }

  async showTripleCards(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      let fortune = null;

      if (
        this.fortuneService &&
        typeof this.fortuneService.draw3Cards === "function"
      ) {
        fortune = await this.fortuneService.draw3Cards(userId);
      } else {
        fortune = this.getDummyTripleCards();
      }

      return {
        type: "triple",
        module: "fortune",
        data: { fortune },
      };
    } catch (error) {
      logger.error("트리플카드 뽑기 오류:", error);
      return {
        type: "error",
        module: "fortune",
        message: "3장 뽑기를 진행할 수 없습니다.",
      };
    }
  }

  async shuffleOnly(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "shuffle_only",
      module: "fortune",
      data: { message: "카드를 셔플합니다..." },
    };
  }

  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      let stats = null;

      if (
        this.fortuneService &&
        typeof this.fortuneService.getUserStats === "function"
      ) {
        stats = await this.fortuneService.getUserStats(userId);
      } else {
        stats = this.getDummyStats();
      }

      return {
        type: "stats",
        module: "fortune",
        data: { stats },
      };
    } catch (error) {
      logger.error("통계 조회 오류:", error);
      return {
        type: "error",
        module: "fortune",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "fortune",
      data: {
        title: "타로 운세 도움말",
        content: "🔮 두목봇의 타로 카드 기능을 이용해보세요!",
      },
    };
  }

  // ===== 🆘 폴백 메서드들 (서비스 실패 시 사용) =====

  getDummySingleCard() {
    const dummyCard = {
      success: true,
      card: {
        cardId: 0,
        cardName: "The Fool",
        koreanName: "바보",
        emoji: "🤡",
        isReversed: Math.random() > 0.5,
        interpretation: {
          message:
            "새로운 시작을 의미하는 카드입니다. 순수한 마음으로 도전해보세요.",
          advice: "용기를 갖고 첫 걸음을 내디디세요.",
        },
      },
      needsShuffle: true,
    };

    return dummyCard;
  }

  getDummyTripleCards() {
    const cards = [
      {
        cardId: 1,
        cardName: "The Magician",
        koreanName: "마법사",
        position: "past",
        isReversed: false,
        interpretation: {
          message: "과거의 능력과 의지를 보여줍니다.",
          advice: "지나온 경험을 활용하세요.",
        },
      },
      {
        cardId: 2,
        cardName: "The High Priestess",
        koreanName: "여교황",
        position: "present",
        isReversed: false,
        interpretation: {
          message: "현재의 직관과 내면의 지혜를 의미합니다.",
          advice: "직감을 믿고 행동하세요.",
        },
      },
      {
        cardId: 19,
        cardName: "The Sun",
        koreanName: "태양",
        position: "future",
        isReversed: false,
        interpretation: {
          message: "밝은 미래와 성공을 암시합니다.",
          advice: "긍정적인 마음을 유지하세요.",
        },
      },
    ];

    return {
      success: true,
      cards: cards,
      summary:
        "과거의 경험을 바탕으로 현재의 직감을 믿고 나아가면 밝은 미래가 기다리고 있습니다.",
      needsShuffle: true,
    };
  }

  getDummyStats() {
    return {
      totalDraws: 5,
      currentStreak: 2,
      longestStreak: 3,
      canDrawToday: true,
      thisMonthDraws: 5,
    };
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  extractCommand(text) {
    if (!text) return null;

    if (text.startsWith("/")) {
      return text.split(" ")[0].substring(1).toLowerCase();
    }

    const lowerText = text.trim().toLowerCase();
    const commands = ["fortune", "운세", "타로"];

    return commands.find(
      (cmd) => lowerText === cmd || lowerText.startsWith(cmd + " ")
    );
  }

  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceConnected: !!this.fortuneService,
      serviceType: this.fortuneService?.constructor?.name || "Unknown",
      actionCount: this.actionMap.size,
      stats: this.stats,
    };
  }
}

module.exports = FortuneModule;
