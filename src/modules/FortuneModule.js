// src/modules/FortuneModule.js - 🔮 운세 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneModule - 운세/타로 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: fortune:action:params
 * ✅ 렌더링은 Renderer가 담당
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.fortuneService = null;

    // 모듈 설정
    this.config = {
      maxDrawsPerDay: parseInt(process.env.FORTUNE_MAX_DRAWS_PER_DAY) || 3,
      enableHistory: process.env.FORTUNE_ENABLE_HISTORY !== "false",
      enableStats: process.env.FORTUNE_ENABLE_STATS !== "false",
      shuffleRequired: process.env.FORTUNE_SHUFFLE_REQUIRED === "true",
      deckType: process.env.FORTUNE_DECK_TYPE || "tarot",
      language: process.env.FORTUNE_LANGUAGE || "ko",
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

    logger.info(`🔮 FortuneModule 생성 완료 (v4.1)`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
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
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,

      // 카드 뽑기 (통합 액션)
      draw: this.handleDrawCards,

      // 카드 셔플
      shuffle: this.handleShuffle,

      // 조회 기능
      stats: this.showStats,
      history: this.showHistory,

      // 기타
      settings: this.showSettings,
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
      return {
        type: "render_request",
        module: "fortune",
        action: "menu",
        chatId: chatId,
        data: await this.getMenuData(userId),
      };
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const menuData = await this.getMenuData(userId);

      return {
        type: "menu",
        module: "fortune",
        data: {
          ...menuData,
          userName,
        },
      };
    } catch (error) {
      logger.error("운세 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🃏 카드 뽑기 처리 (통합 액션)
   */
  async handleDrawCards(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🃏 카드 뽑기 처리`, { userId, userName, params });

    try {
      // 일일 제한 확인
      const limitCheck = await this.checkDailyLimit(userId);

      if (!limitCheck.allowed) {
        return {
          type: "daily_limit_exceeded",
          module: "fortune",
          data: {
            used: limitCheck.used,
            maxDraws: this.config.maxDrawsPerDay,
            resetTime: limitCheck.resetTime,
          },
        };
      }

      // 파라미터가 없으면 선택 메뉴 표시
      if (!params || params[0] === undefined) {
        return {
          type: "draw_select",
          module: "fortune",
          data: {
            fortuneTypes: this.fortuneTypes,
            remaining: limitCheck.remaining,
          },
        };
      }

      // 운세 타입별 처리
      const fortuneType = params[0];
      return await this.processFortuneByType(userId, userName, fortuneType);
    } catch (error) {
      logger.error("카드 뽑기 처리 실패:", error);
      return {
        type: "error",
        message: "카드를 뽑을 수 없습니다.",
      };
    }
  }

  /**
   * 🔄 카드 셔플 처리
   */
  async handleShuffle(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const result = await this.shuffleCards(userId);

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          success: result.success,
          message: result.message,
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
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const stats = await this.getDetailedStats(userId);

      return {
        type: "stats",
        module: "fortune",
        data: {
          userName,
          stats,
          config: this.config,
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
   * 📋 이력 표시
   */
  async showHistory(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const period = params[0] || "recent";
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
      logger.error("운세 이력 조회 실패:", error);
      return {
        type: "error",
        message: "이력을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
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

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 🎯 타입별 운세 처리 (핵심 비즈니스 로직)
   */
  async processFortuneByType(userId, userName, fortuneType) {
    // 커스텀 질문 처리
    if (fortuneType === "custom") {
      this.userInputStates.set(userId, {
        action: "custom_question",
        awaitingInput: true,
      });

      return {
        type: "custom_input_request",
        module: "fortune",
        data: {},
      };
    }

    // 운세 타입 검증
    const typeConfig = this.fortuneTypes[fortuneType];
    if (!typeConfig) {
      return {
        type: "error",
        message: `지원하지 않는 운세 타입입니다: ${fortuneType}`,
      };
    }

    try {
      // 실제 카드 뽑기
      const result = await this.drawFortuneCards(userId, fortuneType);

      if (result.success) {
        logger.info(`✅ 운세 뽑기 성공`, {
          userId,
          userName,
          type: fortuneType,
        });

        return {
          type: "draw_success",
          module: "fortune",
          data: {
            fortuneType: typeConfig.label,
            card: result.card,
            cards: result.cards, // 트리플카드 등
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
            typeConfig,
          },
        };
      } else {
        return {
          type: "error",
          message: result.message || "카드를 뽑는데 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("운세 뽑기 처리 오류:", error);
      return {
        type: "error",
        message: "운세를 뽑는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📝 커스텀 질문 입력 처리
   */
  async handleUserInput(bot, msg, text, inputState) {
    const { action } = inputState;
    const {
      from: { id: userId },
    } = msg;

    if (action !== "custom_question") return false;

    try {
      // 커스텀 질문으로 운세 뽑기
      const result = await this.drawFortuneCards(userId, "custom", text);

      this.userInputStates.delete(userId);

      if (result.success) {
        return {
          type: "custom_fortune_success",
          module: "fortune",
          data: {
            question: text,
            card: result.card,
            date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
          },
        };
      } else {
        return {
          type: "error",
          message: "운세를 뽑는데 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("커스텀 질문 처리 실패:", error);
      this.userInputStates.delete(userId);
      return {
        type: "error",
        message: "운세를 뽑는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🏠 메뉴 데이터 조회
   */
  async getMenuData(userId) {
    const stats = await this.getUserStats(userId);
    const limitCheck = await this.checkDailyLimit(userId);

    return {
      stats,
      limitCheck,
      fortuneTypes: this.fortuneTypes,
      config: this.config,
    };
  }

  // ===== 🛠️ 핵심 비즈니스 로직 메서드들 =====

  /**
   * 🃏 실제 카드 뽑기 로직
   */
  async drawFortuneCards(userId, fortuneType, question = null) {
    try {
      // 서비스 사용 시도
      if (
        this.fortuneService &&
        typeof this.fortuneService.drawCards === "function"
      ) {
        return await this.fortuneService.drawCards(userId, {
          type: fortuneType,
          question,
          timestamp: TimeHelper.now().toISOString(),
        });
      }

      // 폴백: 더미 데이터 생성
      return this.generateDummyFortune(fortuneType, question);
    } catch (error) {
      logger.error("카드 뽑기 로직 실패:", error);
      return this.generateDummyFortune(fortuneType, question);
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
  generateDummyFortune(fortuneType, question = null) {
    const cardNames = [
      "The Fool",
      "The Magician",
      "The High Priestess",
      "The Empress",
      "The Emperor",
    ];
    const koreanNames = ["바보", "마법사", "여교황", "황후", "황제"];
    const emojis = ["🤡", "🎩", "👩‍⚕️", "👸", "🤴"];

    const randomIndex = Math.floor(Math.random() * cardNames.length);

    const baseCard = {
      id: randomIndex,
      name: cardNames[randomIndex],
      koreanName: koreanNames[randomIndex],
      emoji: emojis[randomIndex],
      isReversed: Math.random() > 0.5,
      interpretation: {
        message: question
          ? `"${question}"에 대한 답변: 새로운 시작을 의미하는 카드입니다.`
          : "새로운 시작을 의미하는 카드입니다.",
        advice: "용기를 갖고 첫 걸음을 내디디세요.",
        keywords: ["새로운 시작", "모험", "순수함"],
      },
    };

    // 트리플카드인 경우
    if (fortuneType === "triple") {
      return {
        success: true,
        cards: [
          { ...baseCard, position: "past", meaning: "과거" },
          { ...baseCard, position: "present", meaning: "현재" },
          { ...baseCard, position: "future", meaning: "미래" },
        ],
      };
    }

    return {
      success: true,
      card: baseCard,
    };
  }

  /**
   * 📊 더미 통계 생성
   */
  generateDummyStats() {
    return {
      totalDraws: Math.floor(Math.random() * 50) + 10,
      todayDraws: Math.floor(Math.random() * 3),
      favoriteType: Object.keys(this.fortuneTypes)[
        Math.floor(Math.random() * Object.keys(this.fortuneTypes).length)
      ],
      accuracy: Math.floor(Math.random() * 30) + 70,
      streak: Math.floor(Math.random() * 10) + 1,
    };
  }

  /**
   * 📋 더미 기록 생성
   */
  generateDummyHistory(period) {
    const history = [];
    const count = period === "recent" ? 5 : 10;

    for (let i = 0; i < count; i++) {
      history.push({
        date: TimeHelper.format(
          TimeHelper.now().subtract(i, "days"),
          "YYYY-MM-DD"
        ),
        type: Object.keys(this.fortuneTypes)[
          Math.floor(Math.random() * Object.keys(this.fortuneTypes).length)
        ],
        card: "The Fool",
        result: "좋은 결과",
      });
    }

    return history;
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
  async onCleanup() {
    try {
      // 입력 상태 정리
      this.userInputStates.clear();

      if (this.fortuneService && this.fortuneService.cleanup) {
        await this.fortuneService.cleanup();
      }
      logger.info("✅ FortuneModule 정리 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 정리 실패:", error);
    }
  }
}

module.exports = FortuneModule;
