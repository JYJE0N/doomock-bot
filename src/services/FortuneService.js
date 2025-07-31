const BaseService = require("./BaseService");

/**
 * 🔮 FortuneService - 타로 카드 서비스 (심플 버전)
 */
class FortuneService extends BaseService {
  constructor(options = {}) {
    super("FortuneService", options);

    // 임시 메모리 저장소 (나중에 Mongoose로 변경)
    this.drawHistory = new Map(); // userId -> records[]
    this.dailyDraws = new Map(); // userId -> {date: count}

    // 타로 카드 덱 (간단 버전)
    this.tarotDeck = this.initializeTarotDeck();
  }

  getRequiredModels() {
    return []; // 나중에 ["Fortune", "TarotCard"] 추가
  }

  /**
   * 타로 카드 덱 초기화
   */
  initializeTarotDeck() {
    return [
      { id: 0, name: "The Fool", korean: "바보", emoji: "🤡", arcana: "major" },
      {
        id: 1,
        name: "The Magician",
        korean: "마법사",
        emoji: "🎩",
        arcana: "major",
      },
      {
        id: 2,
        name: "The High Priestess",
        korean: "여교황",
        emoji: "👩‍⚕️",
        arcana: "major",
      },
      {
        id: 3,
        name: "The Empress",
        korean: "황후",
        emoji: "👸",
        arcana: "major",
      },
      {
        id: 4,
        name: "The Emperor",
        korean: "황제",
        emoji: "🤴",
        arcana: "major",
      },
      {
        id: 5,
        name: "The Hierophant",
        korean: "교황",
        emoji: "👨‍⚕️",
        arcana: "major",
      },
      {
        id: 6,
        name: "The Lovers",
        korean: "연인",
        emoji: "💕",
        arcana: "major",
      },
      {
        id: 7,
        name: "The Chariot",
        korean: "전차",
        emoji: "🏎️",
        arcana: "major",
      },
      { id: 8, name: "Strength", korean: "힘", emoji: "💪", arcana: "major" },
      {
        id: 9,
        name: "The Hermit",
        korean: "은둔자",
        emoji: "🏔️",
        arcana: "major",
      },
      {
        id: 10,
        name: "Wheel of Fortune",
        korean: "운명의 수레바퀴",
        emoji: "🎰",
        arcana: "major",
      },
      { id: 11, name: "Justice", korean: "정의", emoji: "⚖️", arcana: "major" },
      {
        id: 12,
        name: "The Hanged Man",
        korean: "매달린 남자",
        emoji: "🙃",
        arcana: "major",
      },
      { id: 13, name: "Death", korean: "죽음", emoji: "💀", arcana: "major" },
      {
        id: 14,
        name: "Temperance",
        korean: "절제",
        emoji: "🧘",
        arcana: "major",
      },
      {
        id: 15,
        name: "The Devil",
        korean: "악마",
        emoji: "👹",
        arcana: "major",
      },
      { id: 16, name: "The Tower", korean: "탑", emoji: "🗼", arcana: "major" },
      { id: 17, name: "The Star", korean: "별", emoji: "⭐", arcana: "major" },
      { id: 18, name: "The Moon", korean: "달", emoji: "🌙", arcana: "major" },
      { id: 19, name: "The Sun", korean: "태양", emoji: "☀️", arcana: "major" },
      {
        id: 20,
        name: "Judgement",
        korean: "심판",
        emoji: "📯",
        arcana: "major",
      },
      {
        id: 21,
        name: "The World",
        korean: "세계",
        emoji: "🌍",
        arcana: "major",
      },
    ];
  }

  /**
   * 카드 뽑기
   */
  async drawCard(userId, drawData) {
    try {
      const { type, question } = drawData;

      // 단일 카드 뽑기
      if (type === "triple") {
        const cards = [];
        const positions = ["past", "present", "future"];

        for (let i = 0; i < 3; i++) {
          const randomCard = this.getRandomCard();
          cards.push({
            ...randomCard,
            position: positions[i],
            isReversed: Math.random() > 0.7,
            meaning: this.getCardMeaning(randomCard, type, positions[i]),
          });
        }

        return this.createSuccessResponse(
          {
            cards,
            type,
            interpretation: this.getInterpretation(cards, type, question),
          },
          "삼카드 운세를 뽑았습니다."
        );
      } else {
        // 단일 카드
        const card = this.getRandomCard();
        const isReversed = Math.random() > 0.7;

        return this.createSuccessResponse(
          {
            card: {
              ...card,
              isReversed,
              meaning: this.getCardMeaning(card, type),
              advice: this.getCardAdvice(card, type),
              interpretation: this.getInterpretation([card], type, question),
            },
            type,
          },
          "카드를 뽑았습니다."
        );
      }
    } catch (error) {
      return this.createErrorResponse(error, "카드 뽑기 실패");
    }
  }

  /**
   * 랜덤 카드 선택
   */
  getRandomCard() {
    const randomIndex = Math.floor(Math.random() * this.tarotDeck.length);
    return { ...this.tarotDeck[randomIndex] };
  }

  /**
   * 카드 의미 해석
   */
  getCardMeaning(card, type, position = null) {
    const meanings = {
      "The Fool": {
        general: "새로운 시작과 모험을 의미합니다",
        love: "새로운 사랑이나 관계의 시작을 암시합니다",
        work: "새로운 기회나 도전이 기다리고 있습니다",
        past: "과거의 순수했던 시절을 의미합니다",
        present: "지금 새로운 출발이 필요한 시점입니다",
        future: "곧 새로운 기회가 찾아올 것입니다",
      },
      "The Magician": {
        general: "능력과 의지로 목표를 달성할 수 있습니다",
        love: "적극적인 접근이 좋은 결과를 가져올 것입니다",
        work: "당신의 능력을 발휘할 때입니다",
        past: "과거에 보여준 능력이 지금도 유효합니다",
        present: "지금이 행동할 최적의 시기입니다",
        future: "당신의 노력이 결실을 맺을 것입니다",
      },
      "The Star": {
        general: "희망과 영감이 가득한 시기입니다",
        love: "이상적인 사랑을 만날 수 있습니다",
        work: "창의적인 아이디어가 성공을 가져다줄 것입니다",
        past: "과거의 꿈과 희망이 현재에 도움이 됩니다",
        present: "희망을 잃지 말고 계속 나아가세요",
        future: "밝은 미래가 기다리고 있습니다",
      },
    };

    const cardMeanings = meanings[card.name];
    if (!cardMeanings) {
      return "새로운 가능성과 변화를 의미합니다";
    }

    return cardMeanings[position] || cardMeanings[type] || cardMeanings.general;
  }

  /**
   * 카드 조언
   */
  getCardAdvice(card, type) {
    const advices = {
      "The Fool": "용기를 갖고 첫 걸음을 내디디세요",
      "The Magician": "당신의 능력을 믿고 행동하세요",
      "The Star": "희망을 품고 꾸준히 노력하세요",
    };

    return advices[card.name] || "긍정적인 마음으로 앞으로 나아가세요";
  }

  /**
   * 종합 해석
   */
  getInterpretation(cards, type, question = null) {
    if (question) {
      return `"${question}"에 대한 답변: ${cards[0].meaning}`;
    }

    if (type === "triple") {
      return "과거의 경험을 바탕으로 현재 상황을 잘 파악하고, 미래를 위한 준비를 하세요.";
    }

    const typeMessages = {
      love: "사랑과 관계에 있어서 긍정적인 변화가 예상됩니다.",
      work: "일과 사업에서 좋은 기회를 잡을 수 있을 것입니다.",
      single: "오늘 하루 긍정적인 에너지로 가득할 것입니다.",
    };

    return typeMessages[type] || "전반적으로 좋은 흐름입니다.";
  }

  /**
   * 오늘 뽑은 횟수 조회
   */
  async getTodayDrawCount(userId) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const userDraws = this.dailyDraws.get(userId.toString()) || {};
      const count = userDraws[today] || 0;

      return this.createSuccessResponse({ count, date: today });
    } catch (error) {
      return this.createErrorResponse(error, "오늘 뽑기 횟수 조회 실패");
    }
  }

  /**
   * 뽑기 기록 저장
   */
  async recordDraw(userId, drawData) {
    try {
      const today = new Date().toISOString().split("T")[0];

      // 일일 카운트 업데이트
      const userDraws = this.dailyDraws.get(userId.toString()) || {};
      userDraws[today] = (userDraws[today] || 0) + 1;
      this.dailyDraws.set(userId.toString(), userDraws);

      // 기록 저장
      const record = {
        _id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId.toString(),
        date: today,
        type: drawData.type,
        card: drawData.card,
        createdAt: new Date(),
      };

      const userHistory = this.drawHistory.get(userId.toString()) || [];
      userHistory.push(record);
      this.drawHistory.set(userId.toString(), userHistory);

      return this.createSuccessResponse(record, "뽑기 기록이 저장되었습니다.");
    } catch (error) {
      return this.createErrorResponse(error, "뽑기 기록 저장 실패");
    }
  }

  /**
   * 뽑기 기록 조회
   */
  async getDrawHistory(userId, options = {}) {
    try {
      const { limit = 20 } = options;
      const history = this.drawHistory.get(userId.toString()) || [];

      const recentHistory = history
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);

      return this.createSuccessResponse({
        records: recentHistory,
        totalCount: history.length,
      });
    } catch (error) {
      return this.createErrorResponse(error, "기록 조회 실패");
    }
  }

  /**
   * 사용자 통계
   */
  async getUserStats(userId) {
    try {
      const history = this.drawHistory.get(userId.toString()) || [];
      const dailyDraws = this.dailyDraws.get(userId.toString()) || {};

      const today = new Date().toISOString().split("T")[0];
      const todayDraws = dailyDraws[today] || 0;

      // 가장 많이 뽑은 타입 계산
      const typeCounts = {};
      history.forEach((record) => {
        typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
      });

      const favoriteType = Object.keys(typeCounts).reduce(
        (a, b) => (typeCounts[a] > typeCounts[b] ? a : b),
        "single"
      );

      return this.createSuccessResponse({
        totalDraws: history.length,
        todayDraws,
        favoriteType,
        streak: this.calculateStreak(dailyDraws),
        accuracy: Math.floor(Math.random() * 20) + 80, // 더미 정확도
      });
    } catch (error) {
      return this.createErrorResponse(error, "통계 조회 실패");
    }
  }

  /**
   * 연속 뽑기 일수 계산
   */
  calculateStreak(dailyDraws) {
    const dates = Object.keys(dailyDraws).sort().reverse();
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < dates.length; i++) {
      const date = new Date(dates[i]);
      const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

      if (diffDays === i && dailyDraws[dates[i]] > 0) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * 카드 셔플
   */
  async shuffleDeck(userId) {
    try {
      // 더미 셔플 (실제로는 아무것도 하지 않음)
      const messages = [
        "카드를 완전히 섞었습니다! 새로운 기운이 느껴지네요.",
        "덱을 재정렬했습니다. 이제 새로운 운세를 뽑아보세요!",
        "카드들이 새로운 에너지로 충전되었습니다.",
        "우주의 에너지로 카드를 정화했습니다.",
      ];

      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];

      return this.createSuccessResponse({}, randomMessage);
    } catch (error) {
      return this.createErrorResponse(error, "카드 셔플 실패");
    }
  }
}

module.exports = FortuneService;
