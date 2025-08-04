// src/data/FortuneInterpretations.js - 타로 해석 전문 데이터

/**
 * 🔮 타로 해석 전문 데이터
 * 각 상황별, 조합별 해석을 제공합니다
 */

// 🎯 질문 카테고리별 해석
const QUESTION_CATEGORIES = {
  love: {
    name: "사랑과 연애",
    keywords: ["사랑", "연애", "관계", "짝사랑", "이별", "재회"],
    interpretations: {
      // 메이저 아르카나 특별 해석
      "The Fool": {
        upright:
          "새로운 사랑이 시작될 수 있습니다. 순수한 마음으로 다가가세요.",
        reversed:
          "성급한 판단은 금물입니다. 상대를 더 알아가는 시간이 필요합니다."
      },
      "The Lovers": {
        upright: "운명적인 만남이나 중요한 선택의 순간입니다. 진심을 따르세요.",
        reversed: "관계의 불균형이나 가치관 차이를 해결해야 합니다."
      },
      "The Star": {
        upright:
          "희망적인 미래가 기다립니다. 상대를 신뢰하고 긍정적으로 나아가세요.",
        reversed: "실망감을 극복하고 자존감을 회복할 시간이 필요합니다."
      }
    }
  },

  career: {
    name: "직업과 경력",
    keywords: ["직장", "일", "승진", "이직", "사업", "경력"],
    interpretations: {
      "The Emperor": {
        upright:
          "리더십을 발휘할 때입니다. 체계적인 계획으로 목표를 달성하세요.",
        reversed: "경직된 조직문화나 권위적인 상사와의 갈등을 조심하세요."
      },
      "Eight of Pentacles": {
        upright:
          "전문성을 키우기 좋은 시기입니다. 꾸준한 노력이 결실을 맺을 것입니다.",
        reversed: "번아웃을 조심하세요. 일과 삶의 균형이 필요합니다."
      }
    }
  },

  money: {
    name: "금전과 재물",
    keywords: ["돈", "재산", "투자", "부채", "수입", "지출"],
    interpretations: {
      "Ace of Pentacles": {
        upright:
          "새로운 수입원이나 투자 기회가 찾아옵니다. 신중하게 검토하세요.",
        reversed: "계획했던 수익이 지연될 수 있습니다. 예산 관리에 신경쓰세요."
      },
      "Ten of Pentacles": {
        upright:
          "장기적인 재정 안정을 이룰 수 있습니다. 가족과 함께 번영하세요.",
        reversed: "가족 간 재산 문제나 상속 관련 갈등을 조심하세요."
      }
    }
  },

  health: {
    name: "건강과 웰빙",
    keywords: ["건강", "병", "치료", "회복", "운동", "다이어트"],
    interpretations: {
      Strength: {
        upright:
          "내면의 힘으로 건강을 회복할 수 있습니다. 긍정적인 마음이 중요합니다.",
        reversed:
          "체력 저하나 면역력 약화를 조심하세요. 충분한 휴식이 필요합니다."
      },
      "The Sun": {
        upright: "활력이 넘치고 건강이 호전됩니다. 야외 활동이 도움이 됩니다.",
        reversed: "과로나 스트레스로 인한 번아웃을 조심하세요."
      }
    }
  },

  general: {
    name: "일반 운세",
    keywords: [],
    interpretations: {
      // 기본 해석은 TarotData.js의 meaning 사용
    }
  }
};

// 🎴 카드 조합 해석
const CARD_COMBINATIONS = {
  // 메이저 + 메이저 조합
  "The Fool+The World": "한 사이클이 끝나고 완전히 새로운 시작이 다가옵니다.",
  "The Magician+The High Priestess":
    "의식과 무의식의 완벽한 조화. 강력한 창조력이 발현됩니다.",
  "The Emperor+The Empress":
    "권위와 풍요의 조화. 안정적인 성장과 번영을 암시합니다.",
  "Death+The Tower":
    "급격하고 근본적인 변화. 과거와의 완전한 단절이 필요합니다.",
  "The Star+The Sun": "매우 긍정적인 조합. 희망이 현실이 되는 시기입니다.",

  // 메이저 + 마이너 조합
  "The Lovers+Two of Cups":
    "깊은 사랑과 완벽한 파트너십. 소울메이트를 만날 수 있습니다.",
  "The Tower+Five of Cups":
    "예상치 못한 상실. 하지만 이는 더 나은 미래를 위한 과정입니다.",
  "The World+Ten of Pentacles":
    "물질적, 정신적 완성. 모든 면에서 풍요로운 시기입니다.",

  // 같은 숫자 조합
  "Ace+Ace": "강력한 새로운 시작. 여러 분야에서 동시에 기회가 찾아옵니다.",
  "Four+Four": "안정과 정체. 현상 유지는 좋지만 변화도 필요합니다.",
  "Ten+Ten": "하나의 큰 사이클이 완성됨. 다음 단계로 나아갈 준비를 하세요."
};

// 🔮 트리플 카드 해석 템플릿
const TRIPLE_SPREAD_INTERPRETATIONS = {
  // 시간의 흐름 해석
  temporal: {
    past_influence: [
      "과거의 {card}가 현재 상황의 씨앗이 되었습니다.",
      "{card}의 경험이 당신을 성장시켰습니다.",
      "지나간 {card}의 교훈을 기억하세요."
    ],
    present_situation: [
      "현재 {card}의 에너지가 강하게 작용하고 있습니다.",
      "{card}가 보여주는 현실을 직시하세요.",
      "지금은 {card}의 지혜가 필요한 때입니다."
    ],
    future_potential: [
      "미래에는 {card}의 결실을 맺을 것입니다.",
      "{card}가 암시하는 미래를 준비하세요.",
      "앞으로 {card}의 기회가 찾아올 것입니다."
    ]
  },

  // 전체적인 흐름 해석
  flow_interpretations: {
    positive_flow:
      "과거의 교훈을 잘 활용하여 현재를 충실히 살고 있으며, 밝은 미래가 기다리고 있습니다.",
    challenging_flow:
      "과거의 어려움이 현재에도 영향을 미치고 있지만, 이를 극복하면 더 나은 미래가 열릴 것입니다.",
    transformative_flow:
      "지금은 큰 변화의 시기입니다. 과거를 놓아주고 새로운 미래를 받아들이세요.",
    stable_flow:
      "안정적인 흐름 속에 있습니다. 현재의 노력이 미래의 성공으로 이어질 것입니다."
  }
};

// 🌟 캘틱 크로스 해석 템플릿
const CELTIC_CROSS_INTERPRETATIONS = {
  // 각 포지션별 해석 강화
  position_emphasis: {
    present: {
      major:
        "인생의 중요한 전환점에 서 있습니다. {card}의 메시지에 귀 기울이세요.",
      wands: "열정과 창의성이 필요한 상황입니다. 적극적으로 행동하세요.",
      cups: "감정적인 문제가 핵심입니다. 마음의 소리를 들어보세요.",
      swords: "명확한 사고와 결단이 필요합니다. 진실을 직시하세요.",
      pentacles: "현실적이고 실용적인 접근이 필요합니다. 기초를 튼튼히 하세요."
    },
    challenge: {
      major: "넘어야 할 큰 산이 있습니다. 하지만 이는 성장의 기회입니다.",
      reversed: "내면의 블록이나 잘못된 접근이 문제입니다. 관점을 바꿔보세요."
    },
    outcome: {
      positive: "노력이 결실을 맺어 원하는 결과를 얻을 것입니다.",
      neutral:
        "예상과는 다른 결과가 나올 수 있지만, 이 또한 필요한 경험입니다.",
      challenging: "어려움이 예상되지만, 이를 통해 더 강해질 것입니다."
    }
  },

  // 영역별 종합 해석
  area_synthesis: {
    center:
      "현재 상황과 도전 과제가 서로 얽혀 있습니다. 균형잡힌 시각이 필요합니다.",
    timeline:
      "과거에서 미래로 이어지는 명확한 흐름이 보입니다. 시간이 해결해줄 것입니다.",
    internal: "내면의 성장과 자기 인식이 핵심입니다. 스스로를 믿으세요.",
    external: "주변 환경과의 조화가 중요합니다. 혼자가 아님을 기억하세요."
  },

  // 전체 스토리 구성
  story_templates: [
    {
      type: "hero_journey",
      template:
        "당신은 {present}의 상황에서 {challenge}라는 도전에 직면해 있습니다. {past}의 경험이 힘이 되어주고, {approach}의 자세로 나아간다면, {outcome}의 결과를 얻을 것입니다."
    },
    {
      type: "transformation",
      template:
        "{past}에서 시작된 변화가 {present}에서 정점에 달했습니다. {challenge}를 극복하는 과정에서 {hopes_fears}와 마주하게 되지만, 궁극적으로 {outcome}로 이어질 것입니다."
    }
  ]
};

// 🎨 감정과 분위기별 해석
const MOOD_INTERPRETATIONS = {
  hopeful: {
    cards: ["The Star", "The Sun", "Ace of Cups", "Three of Cups"],
    message: "희망의 빛이 보입니다. 긍정적인 에너지가 당신을 감싸고 있습니다.",
    advice: "지금의 긍정적인 기운을 유지하며 꿈을 향해 나아가세요."
  },

  challenging: {
    cards: ["The Tower", "Five of Cups", "Three of Swords", "Ten of Swords"],
    message: "시련의 시기이지만, 이는 더 나은 미래를 위한 준비 과정입니다.",
    advice: "어려움을 성장의 기회로 삼고, 곧 찾아올 새벽을 기다리세요."
  },

  transformative: {
    cards: ["Death", "The Tower", "Judgement", "Eight of Cups"],
    message:
      "큰 변화의 물결이 다가오고 있습니다. 낡은 것을 버리고 새로운 것을 받아들일 때입니다.",
    advice: "변화를 두려워하지 말고 용기있게 받아들이세요."
  },

  stable: {
    cards: ["The Emperor", "Four of Wands", "Ten of Pentacles", "Two of Cups"],
    message:
      "안정과 조화의 시기입니다. 현재의 평화를 즐기되 미래도 준비하세요.",
    advice: "기초를 더욱 튼튼히 하고 관계를 돈독히 하세요."
  }
};

// 💫 특별 메시지 생성기
const SPECIAL_MESSAGES = {
  // 모든 메이저 아르카나
  all_major:
    "우주가 당신에게 중요한 메시지를 전하고 있습니다. 인생의 큰 전환기에 있으니 각별히 주의를 기울이세요.",

  // 모든 같은 슈트
  all_same_suit: {
    wands: "열정과 창의성의 불꽃이 타오르고 있습니다. 지금이 행동할 때입니다!",
    cups: "감정의 바다에 잠겨 있습니다. 직관을 믿고 사랑으로 모든 것을 해결하세요.",
    swords:
      "명확한 사고와 진실 추구가 필요합니다. 논리적으로 상황을 분석하세요.",
    pentacles:
      "물질적 안정과 실용성이 중요한 시기입니다. 현실적인 계획을 세우세요."
  },

  // 연속 숫자
  sequential_numbers:
    "단계적인 성장과 발전이 이루어지고 있습니다. 자연스러운 흐름을 따르세요.",

  // 많은 역방향
  many_reversed:
    "내면의 블록이나 억압된 에너지가 있습니다. 자기 성찰의 시간이 필요합니다.",

  // 균형잡힌 배치
  balanced_spread:
    "완벽한 균형과 조화를 이루고 있습니다. 현재의 상태를 유지하며 발전시키세요."
};

// 🔮 해석 도우미 함수들
const InterpretationHelpers = {
  /**
   * 질문 카테고리 자동 감지
   */
  detectQuestionCategory(question) {
    if (!question) return "general";

    const lowerQuestion = question.toLowerCase();

    for (const [category, data] of Object.entries(QUESTION_CATEGORIES)) {
      if (data.keywords.some((keyword) => lowerQuestion.includes(keyword))) {
        return category;
      }
    }

    return "general";
  },

  /**
   * 카드 조합 해석 찾기
   */
  findCombinationInterpretation(card1, card2) {
    const key1 = `${card1.name}+${card2.name}`;
    const key2 = `${card2.name}+${card1.name}`;

    return CARD_COMBINATIONS[key1] || CARD_COMBINATIONS[key2] || null;
  },

  /**
   * 전체적인 분위기 분석
   */
  analyzeMood(cards) {
    for (const [mood, data] of Object.entries(MOOD_INTERPRETATIONS)) {
      const moodCards = cards.filter(
        (card) =>
          data.cards.includes(card.name) || data.cards.includes(card.korean)
      );

      if (moodCards.length >= Math.ceil(cards.length / 2)) {
        return { mood, ...data };
      }
    }

    return null;
  },

  /**
   * 특별 패턴 감지
   */
  detectSpecialPatterns(cards) {
    const patterns = [];

    // 모든 메이저 아르카나
    if (cards.every((card) => card.arcana === "major")) {
      patterns.push({ type: "all_major", message: SPECIAL_MESSAGES.all_major });
    }

    // 같은 슈트
    const suits = cards.filter((c) => c.suit).map((c) => c.suit);
    const suitCounts = suits.reduce((acc, suit) => {
      acc[suit] = (acc[suit] || 0) + 1;
      return acc;
    }, {});

    const dominantSuit = Object.entries(suitCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (dominantSuit && dominantSuit[1] === cards.length) {
      patterns.push({
        type: "all_same_suit",
        suit: dominantSuit[0],
        message: SPECIAL_MESSAGES.all_same_suit[dominantSuit[0]]
      });
    }

    // 많은 역방향
    const reversedCount = cards.filter((c) => c.isReversed).length;
    if (reversedCount > cards.length * 0.6) {
      patterns.push({
        type: "many_reversed",
        message: SPECIAL_MESSAGES.many_reversed
      });
    }

    return patterns;
  },

  /**
   * 개인화된 메시지 생성
   */
  generatePersonalizedMessage(cards, question, userName) {
    const category = this.detectQuestionCategory(question);
    const mood = this.analyzeMood(cards);
    const patterns = this.detectSpecialPatterns(cards);

    let message = `${userName}님, `;

    // 카테고리별 인사
    if (category !== "general") {
      message += `${QUESTION_CATEGORIES[category].name}에 대한 답을 찾고 계시는군요. `;
    }

    // 분위기 메시지
    if (mood) {
      message += mood.message + " ";
    }

    // 특별 패턴 메시지
    if (patterns.length > 0) {
      message += patterns[0].message + " ";
    }

    // 마무리 조언
    message += "카드가 전하는 메시지에 귀 기울여보세요.";

    return message;
  }
};

// 🌟 모듈 내보내기
module.exports = {
  QUESTION_CATEGORIES,
  CARD_COMBINATIONS,
  TRIPLE_SPREAD_INTERPRETATIONS,
  CELTIC_CROSS_INTERPRETATIONS,
  MOOD_INTERPRETATIONS,
  SPECIAL_MESSAGES,
  InterpretationHelpers
};
