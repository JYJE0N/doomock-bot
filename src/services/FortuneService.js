// src/services/FortuneService.js - 타로 운세 비즈니스 로직

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { FortuneUser } = require("../database/models/Fortune");

/**
 * 🔮 FortuneService - 타로 운세 비즈니스 로직
 * - 메이저 아르카나 22장 관리
 * - 일일 제한 시스템
 * - 두목봇 캐릭터 멘트
 * - 정/역방향 카드 뽑기
 */
class FortuneService {
  constructor(options = {}) {
    this.config = {
      dailyLimit: 1, // 하루 1회 제한
      resetHour: 0, // 자정 기준 리셋
      enableCache: true,
      cacheTimeout: 300000, // 5분 캐시
      ...options.config,
    };

    // 메모리 캐시
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    logger.info("🔮 FortuneService 초기화됨");
  }

  /**
   * 🎴 메이저 아르카나 22장 데이터 (정/역방향 44개 해석)
   */
  getMajorArcana() {
    return [
      {
        id: 0,
        name: "The Fool",
        koreanName: "바보",
        emoji: "🤡",
        upright: {
          keywords: ["새로운 시작", "모험", "순수", "가능성"],
          message:
            "새로운 여행이 시작됩니다. 미지의 세계로 발걸음을 내딛을 때입니다.",
          advice: "두려워하지 말고 첫 걸음을 내디디세요",
        },
        reversed: {
          keywords: ["무모함", "경솔", "혼란", "실수"],
          message:
            "성급한 판단보다는 신중함이 필요합니다. 계획을 세우고 움직이세요.",
          advice: "계획을 세우고 차근차근 준비하세요",
        },
      },
      {
        id: 1,
        name: "The Magician",
        koreanName: "마법사",
        emoji: "🎩",
        upright: {
          keywords: ["의지", "능력", "창조", "실행력"],
          message:
            "당신에게는 목표를 실현할 모든 도구와 능력이 갖춰져 있습니다.",
          advice: "자신의 능력을 믿고 적극적으로 행동하세요",
        },
        reversed: {
          keywords: ["남용", "조작", "기만", "실력 부족"],
          message:
            "능력을 과신하거나 잘못된 방향으로 사용하고 있을 수 있습니다.",
          advice: "겸손함을 잃지 말고 올바른 방향으로 노력하세요",
        },
      },
      {
        id: 2,
        name: "The High Priestess",
        koreanName: "여교황",
        emoji: "🔮",
        upright: {
          keywords: ["직관", "신비", "내면의 지혜", "잠재력"],
          message: "직감을 믿고 내면의 목소리에 귀 기울일 때입니다.",
          advice: "논리보다는 직감을 따라보세요",
        },
        reversed: {
          keywords: ["무시", "표면적", "직감 부족", "소음"],
          message:
            "내면의 목소리를 무시하고 외부의 소음에만 귀 기울이고 있습니다.",
          advice: "조용한 시간을 갖고 자신을 돌아보세요",
        },
      },
      {
        id: 3,
        name: "The Empress",
        koreanName: "여황제",
        emoji: "👑",
        upright: {
          keywords: ["풍요", "창조", "모성", "자연"],
          message:
            "풍요로운 시기가 찾아왔습니다. 창조적인 에너지가 충만합니다.",
          advice: "자연스러운 흐름에 몸을 맡기고 창조적 활동을 해보세요",
        },
        reversed: {
          keywords: ["창조력 부족", "의존", "과보호", "정체"],
          message: "창조적 에너지가 막혀있거나 과도한 의존 상태에 있습니다.",
          advice: "독립성을 기르고 스스로 결정하는 연습을 하세요",
        },
      },
      {
        id: 4,
        name: "The Emperor",
        koreanName: "황제",
        emoji: "👨‍👑",
        upright: {
          keywords: ["권위", "안정", "질서", "리더십"],
          message: "강력한 리더십과 확고한 의지로 상황을 이끌어갈 때입니다.",
          advice: "자신감을 가지고 리더십을 발휘하세요",
        },
        reversed: {
          keywords: ["독재", "경직", "권위주의", "통제"],
          message: "과도한 통제나 경직된 사고가 문제를 일으킬 수 있습니다.",
          advice: "유연함을 잃지 말고 다른 의견도 수용해보세요",
        },
      },
      {
        id: 13,
        name: "Death",
        koreanName: "죽음",
        emoji: "💀",
        upright: {
          keywords: ["변화", "재생", "끝과 시작", "변환"],
          message:
            "한 단계가 끝나고 새로운 단계가 시작됩니다. 변화를 받아들이세요.",
          advice: "과거에 얽매이지 말고 새로운 변화를 맞이하세요",
        },
        reversed: {
          keywords: ["정체", "저항", "변화 거부", "집착"],
          message: "변화를 거부하고 현상 유지에만 매달리고 있습니다.",
          advice: "변화를 두려워하지 말고 조금씩 받아들여보세요",
        },
      },
      {
        id: 16,
        name: "The Tower",
        koreanName: "탑",
        emoji: "🏗️",
        upright: {
          keywords: ["갑작스런 변화", "파괴", "각성", "진실"],
          message:
            "예상치 못한 변화가 기다리고 있습니다. 놀라더라도 이는 필요한 과정입니다.",
          advice: "변화를 두려워하지 말고 새로운 기회로 받아들이세요",
        },
        reversed: {
          keywords: ["위기 회피", "내적 변화", "점진적 변화", "안정"],
          message:
            "큰 변화 없이 안정된 상황이 유지됩니다. 내면의 성찰 시간을 가지세요.",
          advice: "급하게 무언가를 바꾸려 하지 말고 차분히 준비하세요",
        },
      },
      {
        id: 19,
        name: "The Sun",
        koreanName: "태양",
        emoji: "☀️",
        upright: {
          keywords: ["성공", "기쁨", "활력", "희망"],
          message: "밝고 긍정적인 에너지가 당신을 둘러싸고 있습니다.",
          advice: "자신감을 가지고 도전하세요",
        },
        reversed: {
          keywords: ["과도함", "자만", "지연", "실망"],
          message: "너무 낙관적이거나 과도한 기대를 하고 있을 수 있습니다.",
          advice: "겸손함을 잃지 말고 현실적으로 접근하세요",
        },
      },
      {
        id: 21,
        name: "The World",
        koreanName: "세계",
        emoji: "🌍",
        upright: {
          keywords: ["완성", "성취", "조화", "통합"],
          message:
            "모든 것이 완성되어 가고 있습니다. 큰 성취감을 느낄 수 있는 시기입니다.",
          advice: "지금까지의 노력을 자랑스러워하세요",
        },
        reversed: {
          keywords: ["미완성", "부족", "지연", "불만족"],
          message: "아직 부족한 부분이 있거나 완성도를 높일 필요가 있습니다.",
          advice: "조급해하지 말고 마지막까지 신경 쓰세요",
        },
      },
      // TODO: 나머지 13장 추가 예정
      // The Hierophant(5), The Lovers(6), The Chariot(7), Strength(8),
      // The Hermit(9), Wheel of Fortune(10), Justice(11), The Hanged Man(12),
      // Temperance(14), The Devil(15), The Star(17), The Moon(18), Judgement(20)
    ];
  }

  /**
   * 🎲 랜덤 카드 뽑기 (정/역방향 포함)
   */
  drawRandomCard() {
    const cards = this.getMajorArcana();
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    const isReversed = Math.random() < 0.5; // 50% 확률로 역방향

    const cardData = {
      cardId: randomCard.id,
      cardName: randomCard.name,
      koreanName: randomCard.koreanName,
      emoji: randomCard.emoji,
      isReversed: isReversed,
      interpretation: isReversed ? randomCard.reversed : randomCard.upright,
    };

    return cardData;
  }

  /**
   * 🎴 1장 뽑기 (메인 기능)
   */
  async drawSingleCard(userId, userName) {
    try {
      logger.info(`🎴 1장 뽑기 요청: ${userId} (${userName})`);

      // 1. 일일 제한 체크
      const canDraw = await FortuneUser.canUserDrawToday(userId);
      if (!canDraw) {
        const limitMessage = FortuneUser.getDoomockMessage(
          "dailyLimit",
          userName
        );
        return {
          success: false,
          type: "daily_limit",
          message: limitMessage,
          canDrawAgain: this.getNextDrawTime(),
        };
      }

      // 2. 셔플링 메시지 생성
      const shuffleMessage = FortuneUser.getDoomockMessage("shuffle", userName);

      // 3. 카드 뽑기
      const cardData = this.drawRandomCard();
      cardData.drawType = "single";

      // 4. 두목의 카드별 특별 멘트 생성
      const doomockComment = FortuneUser.getDoomockMessage(
        "cardSpecific",
        userName,
        cardData
      );

      // 5. 사용자 기록 저장
      const user = await FortuneUser.findOrCreateUser(userId, userName);
      await user.recordDraw(cardData, userName);

      // 6. 마무리 멘트
      const endingMessage = FortuneUser.getDoomockMessage("ending", userName);

      logger.info(
        `✅ 1장 뽑기 완료: ${cardData.cardName} (${
          cardData.isReversed ? "역방향" : "정방향"
        })`
      );

      return {
        success: true,
        type: "single_card",
        shuffleMessage,
        card: cardData,
        doomockComment,
        endingMessage,
        nextDrawTime: this.getNextDrawTime(),
      };
    } catch (error) {
      logger.error("❌ 1장 뽑기 실패:", error);
      return {
        success: false,
        type: "error",
        message: `👔 두목: '${userName}씨, 시스템 오류가 발생했네요. 잠시 후 다시 시도해주세요.'`,
      };
    }
  }

  /**
   * 🎴🎴🎴 3장 뽑기 (과거-현재-미래)
   */
  async draw3Cards(userId, userName) {
    try {
      logger.info(`🎴🎴🎴 3장 뽑기 요청: ${userId} (${userName})`);

      // 1. 일일 제한 체크
      const canDraw = await FortuneUser.canUserDrawToday(userId);
      if (!canDraw) {
        const limitMessage = FortuneUser.getDoomockMessage(
          "dailyLimit",
          userName
        );
        return {
          success: false,
          type: "daily_limit",
          message: limitMessage,
        };
      }

      // 2. 셔플링 메시지
      const shuffleMessage = FortuneUser.getDoomockMessage("shuffle", userName);

      // 3. 3장 카드 뽑기 (중복 방지)
      const drawnCards = [];
      const cards = this.getMajorArcana();
      const usedIds = new Set();

      for (let i = 0; i < 3; i++) {
        let cardData;
        do {
          cardData = this.drawRandomCard();
        } while (usedIds.has(cardData.cardId)); // 중복 방지

        usedIds.add(cardData.cardId);
        cardData.drawType = "triple";
        cardData.position = ["past", "present", "future"][i];
        drawnCards.push(cardData);
      }

      // 4. 각 카드 기록 저장
      const user = await FortuneUser.findOrCreateUser(userId, userName);
      for (const card of drawnCards) {
        await user.recordDraw(card, userName);
      }

      // 5. 3장 종합 해석 생성
      const overallInterpretation = this.generate3CardInterpretation(
        drawnCards,
        userName
      );

      logger.info(
        `✅ 3장 뽑기 완료: ${drawnCards.map((c) => c.cardName).join(", ")}`
      );

      return {
        success: true,
        type: "triple_cards",
        shuffleMessage,
        cards: drawnCards,
        interpretation: overallInterpretation,
        nextDrawTime: this.getNextDrawTime(),
      };
    } catch (error) {
      logger.error("❌ 3장 뽑기 실패:", error);
      return {
        success: false,
        type: "error",
        message: `👔 두목: '${userName}씨, 시스템 오류가 발생했네요. 잠시 후 다시 시도해주세요.'`,
      };
    }
  }

  /**
   * 🔮 3장 종합 해석 생성
   */
  generate3CardInterpretation(cards, userName) {
    const [pastCard, presentCard, futureCard] = cards;

    const interpretation = {
      title: `👔 두목의 ${userName}씨 3장 카드 분석`,
      sections: {
        past: {
          emoji: "⏪",
          title: "과거 (지나온 길)",
          card: pastCard,
          analysis: `${pastCard.koreanName} 카드는 ${userName}씨의 지나온 상황을 보여줍니다. ${pastCard.interpretation.message}`,
        },
        present: {
          emoji: "⏺️",
          title: "현재 (지금 이 순간)",
          card: presentCard,
          analysis: `현재 ${presentCard.koreanName} 카드가 나왔네요. ${presentCard.interpretation.message}`,
        },
        future: {
          emoji: "⏩",
          title: "미래 (앞으로의 전망)",
          card: futureCard,
          analysis: `앞으로는 ${futureCard.koreanName}의 에너지가 기다리고 있습니다. ${futureCard.interpretation.message}`,
        },
      },
      doomockSummary: this.generateDoomockSummary(cards, userName),
    };

    return interpretation;
  }

  /**
   * 👔 두목의 종합 분석 생성
   */
  generateDoomockSummary(cards, userName) {
    const [pastCard, presentCard, futureCard] = cards;

    // 카드 조합에 따른 두목의 분석
    const summaries = [
      `👔 두목: '${userName}씨, 과거의 ${pastCard.koreanName}에서 현재의 ${presentCard.koreanName}로, 그리고 미래의 ${futureCard.koreanName}로 이어지는 흐름이 보이네요.'`,
      `👔 두목: '${userName}씨, 전체적으로 보면 좋은 방향으로 흘러가고 있습니다. 특히 ${futureCard.koreanName} 카드가 희망적이에요.'`,
      `👔 두목: '${userName}씨, 과거와 현재를 토대로 볼 때 미래는 충분히 밝다고 봅니다. 준비만 잘 하시면 돼요.'`,
      `👔 두목: '${userName}씨, 이 세 장의 카드가 전하는 메시지를 잘 새겨두시고 업무에 활용해보세요.'`,
    ];

    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  /**
   * ⏰ 다음 뽑기 가능 시간 계산
   */
  getNextDrawTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // 자정으로 설정

    return {
      timestamp: tomorrow,
      formatted: TimeHelper.format(tomorrow, "YYYY-MM-DD HH:mm:ss"),
      message: "내일 자정 이후 다시 뽑기 가능",
    };
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      const user = await FortuneUser.findOne({ userId });
      if (!user) {
        return {
          totalDraws: 0,
          currentStreak: 0,
          longestStreak: 0,
          favoriteCards: [],
          canDrawToday: true,
        };
      }

      return {
        totalDraws: user.totalDraws,
        currentStreak: user.dailyStats.currentStreak,
        longestStreak: user.dailyStats.longestStreak,
        totalDaysUsed: user.dailyStats.totalDaysUsed,
        favoriteCards: user.preferences.favoriteCards.slice(0, 3), // 상위 3개
        lastDrawDate: user.lastDrawDate,
        canDrawToday: user.canDrawToday,
        thisMonthDraws: user.thisMonthDraws,
      };
    } catch (error) {
      logger.error("❌ 사용자 통계 조회 실패:", error);
      return null;
    }
  }

  /**
   * 🎴 인기 카드 순위 조회
   */
  async getPopularCards(limit = 5) {
    try {
      return await FortuneUser.getPopularCards(limit);
    } catch (error) {
      logger.error("❌ 인기 카드 조회 실패:", error);
      return [];
    }
  }

  /**
   * 🔄 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "FortuneService",
      totalCards: this.getMajorArcana().length,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      dailyLimit: this.config.dailyLimit,
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.cache.clear();
      this.cacheTimestamps.clear();
      logger.info("✅ FortuneService 정리 완료");
    } catch (error) {
      logger.error("❌ FortuneService 정리 실패:", error);
    }
  }
}

module.exports = FortuneService;
