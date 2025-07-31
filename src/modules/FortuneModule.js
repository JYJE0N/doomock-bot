// src/modules/FortuneModule.js - 🔮 운세 모듈 (리팩토링 버전)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneModule - 운세/타로 모듈 (단순화된 콜백 파서 대응)
 *
 * 🎯 새로운 콜백 체계:
 * - fortune:menu → 메인 메뉴
 * - fortune:draw → 카드 뽑기 선택
 * - fortune:draw:single → 원카드 뽑기 (params="single")
 * - fortune:draw:triple → 트리플카드 뽑기 (params="triple")
 * - fortune:draw:love → 연애운 뽑기 (params="love")
 * - fortune:draw:business → 사업운 뽑기 (params="business")
 * - fortune:shuffle → 카드 셔플
 * - fortune:history → 운세 기록
 * - fortune:stats → 통계
 *
 * ✅ 표준 준수:
 * - 단순화된 actionMap
 * - params 매개변수 적극 활용
 * - SRP 준수 (각 액션의 단일 책임)
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // ServiceBuilder에서 서비스 주입
    this.serviceBuilder = options.serviceBuilder || null;
    this.fortuneService = null;

    // 모듈 설정 (환경변수 우선)
    this.config = {
      // 운세 관련 설정
      maxDrawsPerDay: parseInt(process.env.FORTUNE_MAX_DRAWS_PER_DAY) || 3,
      enableHistory: process.env.FORTUNE_ENABLE_HISTORY !== "false",
      enableStats: process.env.FORTUNE_ENABLE_STATS !== "false",
      shuffleRequired: process.env.FORTUNE_SHUFFLE_REQUIRED === "true",

      // 카드 덱 설정
      deckType: process.env.FORTUNE_DECK_TYPE || "tarot", // tarot, oracle, custom
      language: process.env.FORTUNE_LANGUAGE || "ko", // ko, en

      ...options.config,
    };

    // 운세 타입 정의
    this.fortuneTypes = {
      single: {
        label: "원카드",
        description: "하나의 카드로 오늘의 운세를 확인",
        emoji: "🃏",
        cost: 1,
      },
      triple: {
        label: "트리플카드",
        description: "과거-현재-미래의 흐름을 확인",
        emoji: "🔮",
        cost: 1,
      },
      love: {
        label: "연애운",
        description: "연애와 관련된 운세",
        emoji: "💕",
        cost: 1,
      },
      business: {
        label: "사업운",
        description: "사업과 재정에 관한 운세",
        emoji: "💰",
        cost: 1,
      },
      health: {
        label: "건강운",
        description: "건강과 관련된 조언",
        emoji: "🌿",
        cost: 1,
      },
      general: {
        label: "종합운",
        description: "전반적인 운세와 조언",
        emoji: "✨",
        cost: 2,
      },
    };

    // 사용자 입력 상태 관리
    this.userInputStates = new Map();

    logger.info("🔮 FortuneModule 생성됨 (v4.0 - 단순화된 파서)", {
      version: "4.0.0",
      config: this.config,
    });
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🔮 FortuneModule 초기화 시작...");

      // ServiceBuilder를 통한 서비스 생성
      if (this.serviceBuilder) {
        this.fortuneService = await this.serviceBuilder.getOrCreate("fortune", {
          config: this.config,
        });
      }

      // 서비스가 없어도 더미 데이터로 작동
      if (!this.fortuneService) {
        logger.warn("FortuneService 없음 - 더미 데이터 모드로 작동");
      }

      logger.success("✅ FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 초기화 실패:", error);
      // 초기화 실패해도 더미 모드로 계속 진행
    }
  }

  /**
   * 🎯 액션 등록 (개선된 버전!)
   */
  setupActions() {
    this.registerActions({
      // 🏠 메인 메뉴
      menu: this.handleFortuneMenu,

      // 🃏 카드 뽑기 (통합된 단일 액션)
      draw: this.handleDrawCards,

      // 🔄 카드 셔플
      shuffle: this.handleShuffle,

      // 📊 통계 및 기록
      stats: this.handleStats,
      history: this.handleHistory,

      // ⚙️ 설정
      settings: this.handleSettings,

      // ❓ 도움말
      help: this.showHelp,
    });

    logger.info(`✅ FortuneModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 입력 상태 처리
    const inputState = this.userInputStates.get(userId);
    if (inputState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, inputState);
    }

    // 모듈 키워드 확인
    const keywords = this.getModuleKeywords();
    if (this.isModuleMessage(text, keywords)) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "fortune"
      );
      return true;
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 =====

  /**
   * 🏠 운세 메뉴 처리 (메인 화면)
   *
   * 콜백 예시:
   * - fortune:menu → 메인 메뉴
   */
  async handleFortuneMenu(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🏠 운세 메뉴 처리`, {
      userId,
      userName,
    });

    try {
      // 사용자 통계 조회
      const stats = await this.getUserStats(userId);

      return {
        type: "menu",
        module: "fortune",
        data: {
          userName,
          stats,
          fortuneTypes: this.fortuneTypes,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("운세 메뉴 조회 실패:", error);
      return {
        type: "error",
        message: "운세 메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🃏 카드 뽑기 처리 (통합된 단일 액션!)
   *
   * 콜백 예시:
   * - fortune:draw → 뽑기 타입 선택 메뉴
   * - fortune:draw:single → 원카드 뽑기 (params="single")
   * - fortune:draw:triple → 트리플카드 뽑기 (params="triple")
   * - fortune:draw:love → 연애운 뽑기 (params="love")
   * - fortune:draw:business → 사업운 뽑기 (params="business")
   * - fortune:draw:health → 건강운 뽑기 (params="health")
   * - fortune:draw:general → 종합운 뽑기 (params="general")
   */
  async handleDrawCards(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🃏 카드 뽑기 처리`, {
      userId,
      userName,
      params,
    });

    try {
      // 파라미터가 없으면 선택 메뉴 표시
      if (!params || params.trim() === "") {
        return {
          type: "draw_select",
          module: "fortune",
          data: {
            userName,
            fortuneTypes: this.fortuneTypes,
            dailyLimit: await this.checkDailyLimit(userId),
          },
        };
      }

      // 운세 타입 검증
      const fortuneType = this.fortuneTypes[params];
      if (!fortuneType) {
        return {
          type: "error",
          message: `알 수 없는 운세 타입: ${params}`,
        };
      }

      // 일일 제한 확인
      const canDraw = await this.checkDailyLimit(userId);
      if (!canDraw.allowed) {
        return {
          type: "limit_exceeded",
          module: "fortune",
          data: {
            limit: this.config.maxDrawsPerDay,
            remaining: canDraw.remaining,
            resetTime: canDraw.resetTime,
          },
        };
      }

      // 카드 뽑기 실행
      const result = await this.drawFortuneCards(userId, params);

      if (result.success) {
        logger.info(`✅ 카드 뽑기 성공`, {
          userId,
          type: params,
          cardCount: result.cards ? result.cards.length : 1,
        });

        return {
          type: `draw_result_${params}`,
          module: "fortune",
          data: {
            ...result,
            fortuneType: fortuneType,
            timestamp: TimeHelper.now().toISOString(),
          },
        };
      } else {
        return {
          type: "error",
          message: result.reason || "카드를 뽑을 수 없습니다.",
        };
      }
    } catch (error) {
      logger.error("카드 뽑기 처리 실패:", error);
      return {
        type: "error",
        message: "카드 뽑기 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🔄 카드 셔플 처리
   */
  async handleShuffle(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.debug(`🔄 카드 셔플 처리`, { userId });

    try {
      // 셔플 실행
      const shuffleResult = await this.shuffleCards(userId);

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          success: shuffleResult.success,
          message: shuffleResult.message || "카드를 섞었습니다!",
          canDrawNow: true,
        },
      };
    } catch (error) {
      logger.error("카드 셔플 처리 실패:", error);
      return {
        type: "error",
        message: "카드 셔플 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 통계 처리
   */
  async handleStats(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.getDetailedStats(userId);

      return {
        type: "stats",
        module: "fortune",
        data: {
          stats,
          config: this.config,
          fortuneTypes: this.fortuneTypes,
        },
      };
    } catch (error) {
      logger.error("운세 통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 📋 운세 기록 처리
   */
  async handleHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 파라미터에 따른 기간 필터링
      let period = "recent";
      if (params) {
        period = params; // week, month, all
      }

      const history = await this.getFortuneHistory(userId, period);

      return {
        type: "history",
        module: "fortune",
        data: {
          history,
          period,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("운세 기록 조회 실패:", error);
      return {
        type: "error",
        message: "운세 기록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ⚙️ 설정 처리
   */
  async handleSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 파라미터가 없으면 설정 메뉴
      if (!params || params.trim() === "") {
        return {
          type: "settings_menu",
          module: "fortune",
          data: {
            config: this.config,
            userSettings: await this.getUserSettings(userId),
          },
        };
      }

      // 파라미터에 따른 설정 처리
      return await this.handleSpecificSetting(userId, params);
    } catch (error) {
      logger.error("설정 처리 실패:", error);
      return {
        type: "error",
        message: "설정을 처리할 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "fortune",
      data: {
        config: this.config,
        fortuneTypes: this.fortuneTypes,
        features: {
          draw: "다양한 운세 카드 뽑기",
          shuffle: "카드 섞기",
          stats: "운세 통계 확인",
          history: "뽑은 카드 기록 보기",
        },
        keywords: this.getModuleKeywords(),
      },
    };
  }

  // ===== 🛠️ 핵심 비즈니스 로직 메서드들 =====

  /**
   * 🃏 실제 카드 뽑기 로직
   */
  async drawFortuneCards(userId, fortuneType) {
    try {
      // 서비스 사용 시도
      if (
        this.fortuneService &&
        typeof this.fortuneService.drawCards === "function"
      ) {
        return await this.fortuneService.drawCards(userId, {
          type: fortuneType,
          timestamp: TimeHelper.now().toISOString(),
        });
      }

      // 폴백: 더미 데이터 생성
      return this.generateDummyFortune(fortuneType);
    } catch (error) {
      logger.error("카드 뽑기 로직 실패:", error);
      return this.generateDummyFortune(fortuneType);
    }
  }

  /**
   * 🔄 카드 셔플 로직
   */
  async shuffleCards(userId) {
    try {
      if (
        this.fortuneService &&
        typeof this.fortuneService.shuffleDeck === "function"
      ) {
        return await this.fortuneService.shuffleDeck(userId);
      }

      // 폴백: 더미 셔플
      return {
        success: true,
        message: "카드를 완전히 섞었습니다! 이제 새로운 운세를 뽑아보세요.",
      };
    } catch (error) {
      logger.error("카드 셔플 실패:", error);
      return {
        success: false,
        message: "카드 셔플 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 일일 제한 확인
   */
  async checkDailyLimit(userId) {
    try {
      if (
        this.fortuneService &&
        typeof this.fortuneService.checkDailyLimit === "function"
      ) {
        return await this.fortuneService.checkDailyLimit(userId);
      }

      // 폴백: 제한 없음
      return {
        allowed: true,
        remaining: this.config.maxDrawsPerDay,
        used: 0,
        resetTime: null,
      };
    } catch (error) {
      logger.error("일일 제한 확인 실패:", error);
      return { allowed: true, remaining: this.config.maxDrawsPerDay, used: 0 };
    }
  }

  /**
   * 📈 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      if (
        this.fortuneService &&
        typeof this.fortuneService.getUserStats === "function"
      ) {
        return await this.fortuneService.getUserStats(userId);
      }

      // 폴백: 더미 통계
      return this.generateDummyStats();
    } catch (error) {
      logger.error("사용자 통계 조회 실패:", error);
      return this.generateDummyStats();
    }
  }

  /**
   * 📊 상세 통계 조회
   */
  async getDetailedStats(userId) {
    try {
      const basicStats = await this.getUserStats(userId);

      if (
        this.fortuneService &&
        typeof this.fortuneService.getDetailedStats === "function"
      ) {
        return await this.fortuneService.getDetailedStats(userId);
      }

      // 폴백: 기본 통계 + 추가 정보
      return {
        ...basicStats,
        favoriteType: "single",
        accuracyRating: 4.2,
        monthlyTrend: "increasing",
      };
    } catch (error) {
      logger.error("상세 통계 조회 실패:", error);
      return this.generateDummyStats();
    }
  }

  /**
   * 📋 운세 기록 조회
   */
  async getFortuneHistory(userId, period = "recent") {
    try {
      if (
        this.fortuneService &&
        typeof this.fortuneService.getHistory === "function"
      ) {
        return await this.fortuneService.getHistory(userId, { period });
      }

      // 폴백: 더미 기록
      return this.generateDummyHistory(period);
    } catch (error) {
      logger.error("운세 기록 조회 실패:", error);
      return this.generateDummyHistory(period);
    }
  }

  // ===== 🛠️ 폴백 더미 데이터 생성 메서드들 =====

  /**
   * 🎭 더미 운세 생성
   */
  generateDummyFortune(fortuneType) {
    const dummyCards = {
      single: {
        success: true,
        card: {
          id: Math.floor(Math.random() * 78),
          name: "The Fool",
          koreanName: "바보",
          emoji: "🤡",
          isReversed: Math.random() > 0.5,
          interpretation: {
            message: "새로운 시작을 의미하는 카드입니다.",
            advice: "용기를 갖고 첫 걸음을 내디디세요.",
            keyword: "새로운 시작",
          },
        },
      },
      triple: {
        success: true,
        cards: [
          {
            position: "past",
            name: "The Magician",
            koreanName: "마법사",
            interpretation: {
              message: "과거의 능력과 의지",
              advice: "경험을 활용하세요",
            },
          },
          {
            position: "present",
            name: "The High Priestess",
            koreanName: "여교황",
            interpretation: {
              message: "현재의 직관과 지혜",
              advice: "직감을 믿으세요",
            },
          },
          {
            position: "future",
            name: "The Sun",
            koreanName: "태양",
            interpretation: {
              message: "밝은 미래와 성공",
              advice: "긍정적인 마음을 유지하세요",
            },
          },
        ],
        summary: "경험을 바탕으로 직감을 믿고 나아가면 밝은 미래가 기다립니다.",
      },
      love: {
        success: true,
        card: {
          name: "The Lovers",
          koreanName: "연인",
          emoji: "💕",
          interpretation: {
            message: "사랑과 관계에서 중요한 선택의 시기입니다.",
            advice: "마음의 소리에 귀 기울이세요.",
            keyword: "선택",
          },
        },
      },
      business: {
        success: true,
        card: {
          name: "Ace of Pentacles",
          koreanName: "펜타클 에이스",
          emoji: "💰",
          interpretation: {
            message: "새로운 사업 기회가 다가오고 있습니다.",
            advice: "신중하게 계획을 세우세요.",
            keyword: "기회",
          },
        },
      },
    };

    return dummyCards[fortuneType] || dummyCards.single;
  }

  /**
   * 📊 더미 통계 생성
   */
  generateDummyStats() {
    return {
      totalDraws: Math.floor(Math.random() * 50) + 10,
      todayDraws: Math.floor(Math.random() * 3),
      currentStreak: Math.floor(Math.random() * 7) + 1,
      longestStreak: Math.floor(Math.random() * 15) + 5,
      favoriteType: "single",
      canDrawToday: true,
      thisMonthDraws: Math.floor(Math.random() * 20) + 5,
      lastDrawTime: TimeHelper.now()
        .subtract(Math.floor(Math.random() * 24), "hours")
        .toISOString(),
    };
  }

  /**
   * 📋 더미 기록 생성
   */
  generateDummyHistory(period) {
    const dummyItems = [
      {
        date: TimeHelper.now().subtract(1, "day").toISOString(),
        type: "single",
        card: "The Fool",
        result: "새로운 시작",
      },
      {
        date: TimeHelper.now().subtract(2, "days").toISOString(),
        type: "love",
        card: "The Lovers",
        result: "관계의 선택",
      },
    ];

    return {
      items: dummyItems,
      total: dummyItems.length,
      period: period,
    };
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📝 사용자 입력 처리
   */
  async handleUserInput(bot, msg, text, inputState) {
    const { action } = inputState;
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    switch (action) {
      case "custom_question":
        return await this.handleCustomQuestionInput(bot, msg, text, inputState);

      default:
        logger.warn(`알 수 없는 입력 액션: ${action}`);
        this.userInputStates.delete(userId);
        return false;
    }
  }

  /**
   * ❓ 커스텀 질문 입력 처리
   */
  async handleCustomQuestionInput(bot, msg, text, inputState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;

    // 질문 길이 검증
    if (text.length > 100) {
      await bot.sendMessage(chatId, "❌ 질문은 100자 이하로 입력해주세요.");
      return true;
    }

    try {
      // 커스텀 질문으로 운세 뽑기
      const result = await this.drawFortuneCards(userId, "custom");

      await bot.sendMessage(
        chatId,
        `🔮 "${text}"에 대한 답변:\n\n${result.card.interpretation.message}\n\n💡 조언: ${result.card.interpretation.advice}`
      );
    } catch (error) {
      logger.error("커스텀 질문 처리 실패:", error);
      await bot.sendMessage(chatId, "❌ 운세를 뽑는 중 오류가 발생했습니다.");
    }

    this.userInputStates.delete(userId);
    return true;
  }

  /**
   * 🔑 모듈 키워드 정의
   */
  getModuleKeywords() {
    return [
      // 한국어
      "운세",
      "타로",
      "점",
      "점괘",
      "운",
      "오늘운세",
      "내일운세",
      "카드",
      "미래",
      "예언",
      "사주",
      "궁합",
      // 영어
      "fortune",
      "tarot",
      "luck",
      "fate",
      "cards",
      "divination",
    ];
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * ⚙️ 특정 설정 처리
   */
  async handleSpecificSetting(userId, settingType) {
    // TODO: 사용자별 설정 저장 기능 구현
    return {
      type: `setting_${settingType}`,
      module: "fortune",
      data: {
        settingType,
        message: "이 설정 기능은 곧 추가될 예정입니다.",
      },
    };
  }

  /**
   * ⚙️ 사용자 설정 조회
   */
  async getUserSettings(userId) {
    // TODO: 사용자별 설정 조회 기능 구현
    return {
      language: this.config.language,
      notifications: true,
      deckType: this.config.deckType,
    };
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.fortuneService,
      activeInputStates: this.userInputStates.size,
      config: {
        maxDrawsPerDay: this.config.maxDrawsPerDay,
        enableHistory: this.config.enableHistory,
        enableStats: this.config.enableStats,
        deckType: this.config.deckType,
        language: this.config.language,
      },
      fortuneTypesCount: Object.keys(this.fortuneTypes).length,
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 입력 상태 정리
      this.userInputStates.clear();

      await super.cleanup();
      logger.info("✅ FortuneModule 정리 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 정리 실패:", error);
    }
  }
}

module.exports = FortuneModule;
