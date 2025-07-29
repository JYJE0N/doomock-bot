// ===== 🔮 FortuneModule.js - 단순화된 버전 =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

class FortuneModule extends BaseModule {
  getModuleKeywords() {
    return [
      // 한국어 키워드
      "운세",
      "타로",
      "점",
      "점괘",
      "운",
      "오늘운세",
      "내일운세",
      // 영어 키워드
      "fortune",
      "tarot",
      "luck",
      "fate",
      // 추가 키워드
      "카드",
      "미래",
      "예언",
    ];
  }
  constructor(moduleName, options = {}) {
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
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // ✅ 새로운 방식: 직접 키워드 매칭
    const lowerText = text.toLowerCase().trim();
    const keywords = this.getModuleKeywords();

    // 키워드 매칭 확인
    const isFortuneMessage = keywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      return (
        lowerText === lowerKeyword ||
        lowerText.startsWith(lowerKeyword + " ") ||
        lowerText.includes(lowerKeyword)
      );
    });

    if (isFortuneMessage) {
      // ✅ NavigationHandler를 통한 표준 메뉴 호출
      if (this.moduleManager?.navigationHandler?.sendModuleMenu) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          chatId,
          "fortune"
        );
      } else {
        // 폴백 메시지
        await bot.sendMessage(chatId, "🔮 운세 메뉴를 불러오는 중...");
      }
      return true;
    }

    // 사용자 입력 상태 처리 (운세 관련 입력 대기 등)
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  /**
   * 📝 사용자 입력 처리 (운세 선택 등)
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    // 예시: 운세 타입 선택 대기 상태
    if (userState.action === "awaiting_fortune_type") {
      const fortuneType = text.trim().toLowerCase();

      // 운세 타입 매칭
      const typeMap = {
        일반: "general",
        연애: "love",
        사업: "business",
        건강: "health",
        general: "general",
        love: "love",
        business: "business",
        health: "health",
      };

      const selectedType = typeMap[fortuneType];
      if (selectedType) {
        // 운세 처리 로직
        await this.processFortuneRequest(bot, chatId, userId, selectedType);
        this.clearUserState(userId);
        return true;
      } else {
        await bot.sendMessage(
          chatId,
          "❓ 알 수 없는 운세 타입입니다.\n" +
            "다음 중에서 선택해주세요: 일반, 연애, 사업, 건강"
        );
        return true;
      }
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
