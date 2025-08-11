// src/services/FortuneService.js

const BaseService = require("./BaseService");
const logger = require('../utils/core/Logger');
const TimeHelper = require('../utils/formatting/TimeHelper');
const { isDeveloper, getUserId, getUserName } = require('../utils/helpers/UserHelper');

const {
  FULL_TAROT_DECK,
  CELTIC_CROSS_POSITIONS,
  TarotHelpers,
  TarotAnalytics
} = require("../data/TarotData");

const {
  QUESTION_CATEGORIES,
  TRIPLE_SPREAD_INTERPRETATIONS,
  CELTIC_CROSS_INTERPRETATIONS,
  InterpretationHelpers
} = require("../data/FortuneInterpretations");

const KoreanPostpositionHelper = require("../utils/KoreanPostpositionHelper");

class FortuneService extends BaseService {
  constructor(options = {}) {
    super("FortuneService", options);
    this.tarotDeck = [...FULL_TAROT_DECK];
    this.celticPositions = CELTIC_CROSS_POSITIONS;
    this.config = {
      maxDrawsPerDay: 5,
      maxHistoryRecords: 100,
      specialDrawHours: [0, 12]
    };
    this.stats = { totalDraws: 0, cardFrequency: {}, popularTypes: {} };
  }

  getRequiredModels() {
    return ["Fortune"];
  }

  async onInitialize() {
    try {
      this.Fortune = this.models?.Fortune;
      if (this.Fortune) await this.createIndexes();
      logger.success("✅ FortuneService 초기화 완료");
    } catch (error) {
      logger.error("FortuneService 초기화 실패:", error);
      throw error;
    }
  }

  async createIndexes() {
    if (!this.Fortune?.collection) return;
    await this.Fortune.collection.createIndex({ userId: 1, createdAt: -1 });
    await this.Fortune.collection.createIndex({ "draws.timestamp": -1 });
  }

  async drawCard(user, options = {}) {
    const { type = "single", question = null } = options;
    const limitCheck = await this.checkDailyLimit(
      user,
      this.config.maxDrawsPerDay
    );

    if (!limitCheck.allowed) {
      return {
        success: false,
        message: limitCheck.message,
        data: { ...limitCheck }
      };
    }

    const drawResult = this.performCardDraw(type, question);

    // 🔥 interpretation 생성 전에 카드에 기본 정보 추가
    const enrichedDrawResult = {
      ...drawResult,
      cards: drawResult.cards.map((card) => ({
        ...card,
        meaning: card.meaning || this.getCardBasicMeaning(card),
        keywords: card.keywords || this.getCardKeywords(card),
        emoji: card.emoji || "🎴",
        advice: card.advice || this.getCardAdvice(card) // advice 추가
      }))
    };

    const interpretation = await this.generateInterpretation(
      enrichedDrawResult.cards,
      type,
      question,
      user
    );

    if (this.Fortune) {
      await this.saveDrawRecord(getUserId(user), {
        ...enrichedDrawResult,
        interpretation
      });
    }

    this.updateStats(type, enrichedDrawResult.cards);
    const bossMessage = this.generateBossMessage(
      type,
      enrichedDrawResult,
      getUserId(user)
    );
    const newLimitCheck = await this.checkDailyLimit(
      user,
      this.config.maxDrawsPerDay
    );

    return {
      success: true,
      message: bossMessage,
      data: {
        ...enrichedDrawResult,
        interpretation,
        ...newLimitCheck
      }
    };
  }

  /**
   * 📊 일일 제한 확인 (undefined 오류 수정)
   */
  async checkDailyLimit(user, maxDrawsPerDay) {
    const userId = getUserId(user);
    const today = TimeHelper.getKSTDate();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const maxDraws = maxDrawsPerDay || this.config.maxDrawsPerDay;

    try {
      const userDoc = this.Fortune
        ? await this.Fortune.findOne({ userId })
        : null;
      const todayCount = userDoc
        ? userDoc.draws.filter((draw) => new Date(draw.timestamp) >= startOfDay)
            .length
        : 0;

      if (isDeveloper(user)) {
        return {
          allowed: true,
          isDeveloper: true,
          remainingDraws: Infinity,
          todayCount
        };
      }

      const remainingDraws = Math.max(0, maxDraws - todayCount);

      if (remainingDraws <= 0) {
        return {
          allowed: false,
          message: `오늘의 운세 횟수를 모두 사용했습니다. (${todayCount}/${maxDraws})`,
          remainingDraws: 0,
          todayCount
        };
      }

      return { allowed: true, isDeveloper: false, remainingDraws, todayCount };
    } catch (error) {
      logger.error("일일 제한 확인 실패:", error);
      return { allowed: true, remainingDraws: 1, todayCount: 0 };
    }
  }

  /**
   * 📜 사용자 기록 조회 (안정성 강화 및 핵심 카드 정보 추가)
   */
  async getDrawHistory(userId, limit = 3) {
    try {
      const emptyResult = { success: true, data: { records: [], total: 0 } };

      if (!this.Fortune) return emptyResult;

      const user = await this.Fortune.findOne({ userId });
      if (!user || !user.draws || user.draws.length === 0) {
        return emptyResult;
      }

      // 🔥 slice의 인덱스 수정 (최근 기록을 가져오기 위해)
      const records = user.draws
        .slice(-limit) // 마지막 N개 (최신순)
        .reverse() // 역순으로 정렬
        .map((draw) => {
          try {
            if (!draw.cards || draw.cards.length === 0) return null;

            // 🔥 기록에서 핵심 카드 선택 로직 간소화
            let keyCard = null;
            if (draw.type === "single" && draw.cards.length > 0) {
              keyCard = draw.cards[0];
            } else if (draw.type === "triple" && draw.cards.length >= 3) {
              keyCard = draw.cards[2]; // 미래 카드
            } else if (draw.type === "celtic" && draw.cards.length > 0) {
              // 결과 카드 또는 첫 번째 메이저 카드
              keyCard =
                draw.cards[9] ||
                draw.cards.find((c) => c.arcana === "major") ||
                draw.cards[0];
            }

            return {
              date: TimeHelper.format(draw.timestamp, "relative"),
              type: draw.type,
              keyCard: keyCard
                ? {
                    name: keyCard.name || keyCard.korean || "알 수 없는 카드",
                    korean: keyCard.korean || keyCard.name || "알 수 없는 카드",
                    emoji: keyCard.emoji || "🎴",
                    isReversed: keyCard.isReversed || false,
                    // 🔥 meaning과 keywords 안전하게 처리
                    meaning:
                      keyCard.meaning ||
                      this.getCardBasicMeaning(keyCard) ||
                      "해석을 불러올 수 없습니다",
                    keywords:
                      keyCard.keywords &&
                      Array.isArray(keyCard.keywords) &&
                      keyCard.keywords.length > 0
                        ? keyCard.keywords
                        : this.getCardKeywords(keyCard) || []
                  }
                : null
            };
          } catch (mapError) {
            logger.error(`기록 가공 중 오류 발생 (ID: ${draw._id}):`, mapError);
            return null;
          }
        })
        .filter((record) => record !== null);

      return {
        success: true,
        data: {
          records,
          total: user.draws.length
        }
      };
    } catch (error) {
      logger.error("기록 조회 실패:", error);
      return {
        success: false,
        data: { records: [], total: 0 },
        message: "기록을 불러오는 중 오류가 발생했습니다."
      };
    }
  }

  // ... (이하 다른 함수들은 이전과 동일하게 유지) ...

  // 카드 기본 의미 가져오기
  getCardBasicMeaning(card) {
    const tarotCard = this.tarotDeck.find((t) => t.id === card.id);
    if (!tarotCard) return "해석을 불러올 수 없습니다";

    // meaning이 객체 형태로 저장되어 있는 경우
    if (tarotCard.meaning && typeof tarotCard.meaning === "object") {
      return card.isReversed
        ? tarotCard.meaning.reversed || "역방향 해석"
        : tarotCard.meaning.upright || "정방향 해석";
    }

    // meaning이 문자열인 경우
    return tarotCard.meaning || "해석을 불러올 수 없습니다";
  }

  // 카드 키워드 가져오기
  getCardKeywords(card) {
    const tarotCard = this.tarotDeck.find((t) => t.id === card.id);
    if (!tarotCard) return [];

    // 🔥 keywords는 카드의 최상위 레벨에 있음!
    return tarotCard.keywords || [];
  }

  performCardDraw(type, question) {
    const deck = this.createShuffledDeck();
    let cards = [];
    switch (type) {
      case "single":
        cards = [this.drawSingleCardFromDeck(deck)];
        break;
      case "triple":
        cards = this.drawTripleCards(deck);
        break;
      case "celtic":
        cards = this.drawCelticCross(deck);
        break;
      default:
        cards = [this.drawSingleCardFromDeck(deck)];
    }
    return { type, question, timestamp: new Date(), cards };
  }

  createShuffledDeck() {
    const deck = [...this.tarotDeck];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  drawSingleCardFromDeck(deck) {
    if (deck.length === 0) throw new Error("덱에 카드가 없습니다");
    const card = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
    return { ...card, isReversed: this.shouldBeReversed(card) };
  }

  drawTripleCards(deck) {
    return ["past", "present", "future"].map((pos) => ({
      ...this.drawSingleCardFromDeck(deck),
      position: pos,
      positionName: this.getPositionName(pos)
    }));
  }

  drawCelticCross(deck) {
    return CELTIC_CROSS_POSITIONS.map((pos, i) => ({
      ...this.drawSingleCardFromDeck(deck),
      position: pos.key, // pos.position이 아닌 pos.key 사용
      positionName: pos.name,
      positionDescription: pos.description,
      order: i + 1
    }));
  }

  shouldBeReversed(card) {
    if (card.arcana === "major") return Math.random() < 0.3;
    if (card.court) return Math.random() < 0.25;
    return Math.random() < 0.2;
  }
  async generateInterpretation(cards, type, question, user) {
    const category = InterpretationHelpers.detectQuestionCategory(question);
    const analysis = TarotAnalytics.analyzeCardCombination(cards);
    let overall;
    switch (type) {
      case "single":
        overall = this.interpretSingleSpread(cards[0], category, question);
        break;
      case "triple":
        overall = this.interpretTripleSpread(cards, category, question);
        break;
      case "celtic":
        overall = this.interpretCelticSpread(cards, category, question);
        break;
    }
    const advice = this.generatePersonalizedAdvice(
      cards,
      analysis,
      category,
      user
    );
    return {
      category,
      type,
      cards: cards.map((c) => this.interpretSingleCard(c, category)),
      overall,
      advice,
      specialPatterns: InterpretationHelpers.detectSpecialPatterns(cards),
      analysis
    };
  }

  // 카드의 advice 가져오기 메서드 추가
  getCardAdvice(card) {
    const tarotCard = this.tarotDeck.find((t) => t.id === card.id);
    if (!tarotCard) return null;
    return tarotCard.advice || null;
  }

  interpretSingleCard(card, category) {
    const basicMeaning = TarotHelpers.getCardMeaning(card, card.isReversed);
    const special = QUESTION_CATEGORIES[category]?.interpretations?.[card.name];

    // meaning이 객체인 경우 처리
    let meaningText = "";
    if (card.meaning && typeof card.meaning === "object") {
      meaningText = card.isReversed
        ? card.meaning.reversed || basicMeaning
        : card.meaning.upright || basicMeaning;
    } else if (special) {
      meaningText = card.isReversed
        ? special.reversed || basicMeaning
        : special.upright || basicMeaning;
    } else {
      meaningText = card.meaning || basicMeaning;
    }

    return {
      ...card,
      meaning: meaningText, // 문자열로 변환
      keywords:
        card.keywords && card.keywords.length > 0
          ? card.keywords
          : this.getCardKeywords(card),
      emoji: card.emoji || "🎴"
      // advice 필드 제거
    };
  }

  // 안 되면 주석처리 하라
  generateSimpleAdvice(card, category) {
    const categoryAdvice = {
      love: {
        positive:
          "사랑에 있어 긍정적인 변화가 예상됩니다. 마음을 열고 기회를 받아들이세요.",
        negative:
          "관계에서 신중함이 필요합니다. 서두르지 말고 천천히 진행하세요."
      },
      career: {
        positive:
          "직업적 성장의 기회가 다가옵니다. 자신감을 가지고 도전하세요.",
        negative: "업무에서 주의가 필요합니다. 세부사항을 꼼꼼히 확인하세요."
      },
      general: {
        positive:
          "긍정적인 에너지가 당신을 둘러싸고 있습니다. 희망을 잃지 마세요.",
        negative:
          "잠시 멈추고 상황을 재평가할 시간입니다. 급하게 결정하지 마세요."
      }
    };

    const isPositive = !card.isReversed && card.arcana === "major";
    const adviceType = isPositive ? "positive" : "negative";
    const categoryKey = category || "general";

    return (
      categoryAdvice[categoryKey]?.[adviceType] ||
      categoryAdvice.general[adviceType]
    );
  }

  interpretSingleSpread(card, category, question) {
    // meaning이 객체인 경우 처리
    const meaningText =
      typeof card.meaning === "object"
        ? card.isReversed
          ? card.meaning.reversed
          : card.meaning.upright
        : card.meaning;

    let text = `${card.emoji} **${card.korean}** ${card.isReversed ? "(역방향)" : ""}\n\n`;
    text += `*핵심 메시지*: ${meaningText}\n\n`;
    if (card.keywords && Array.isArray(card.keywords)) {
      text += `*키워드*: ${card.keywords.join(", ")}\n\n`;
    }
    text +=
      card.arcana === "major"
        ? "메이저 아르카나 카드로, 인생의 중요한 전환점을 나타냅니다.\n"
        : `${TarotHelpers.getSuitDescription(card.suit)}\n`;
    return text;
  }

  interpretTripleSpread(cards, category, question) {
    let interpretation = "_과거 > 현재 > 미래의 흐름_\n\n";
    cards.forEach((card, index) => {
      interpretation +=
        this.getTriplePositionInterpretation(card, card.position, index) +
        "\n\n";
    });
    const flowType = this.analyzeTripleFlow(cards);
    interpretation += `*전체적인 흐름*\n${TRIPLE_SPREAD_INTERPRETATIONS.flow_interpretations[flowType]}`;
    const combinations = this.findCardCombinations(cards);
    if (combinations.length > 0)
      interpretation += `\n\n**특별한 조합**\n${combinations.join("\n")}`;
    return interpretation;
  }

  interpretCelticSpread(cards, category, question) {
    let interpretation =
      "**캘틱 크로스 - 10장의 카드가 보여주는 전체 상황**\n\n";

    // 각 카드가 올바른 position을 가지고 있는지 디버깅
    console.log(
      "Celtic cards positions:",
      cards.map((c) => ({
        position: c.position,
        name: c.korean
      }))
    );

    const areas = {
      center: ["present", "challenge"],
      timeline: ["distant_past", "recent_past", "future", "immediate_future"],
      internal: ["approach", "hopes_fears"],
      external: ["environment"],
      outcome: ["outcome"]
    };

    Object.entries(areas).forEach(([area, positions]) => {
      const areaCards = cards.filter((c) => positions.includes(c.position));
      if (areaCards.length > 0) {
        interpretation += `\n**${this.getAreaTitle(area)}**\n`;
        areaCards.forEach((card) => {
          interpretation += `- ${card.positionName || card.position}: ${card.emoji} ${card.korean}${card.isReversed ? " (역)" : ""}\n`;
        });
        if (CELTIC_CROSS_INTERPRETATIONS?.area_synthesis?.[area]) {
          interpretation += `\n*${CELTIC_CROSS_INTERPRETATIONS.area_synthesis[area]}*\n`;
        }
      }
    });

    // createCelticStory도 안전하게 처리
    if (cards.length >= 10) {
      interpretation +=
        "\n**전체 이야기**\n" + this.createCelticStory(cards, question);
    }

    interpretation +=
      "\n\n**핵심 조언**\n" + this.generateCelticAdvice(cards, category);
    return interpretation;
  }

  // createCelticStory 메서드도 수정
  createCelticStory(cards, question) {
    // CELTIC_CROSS_INTERPRETATIONS이 정의되어 있는지 확인
    if (!CELTIC_CROSS_INTERPRETATIONS?.story_templates?.[0]?.template) {
      return "카드들이 보여주는 이야기를 통해 당신의 여정을 이해해보세요.";
    }

    const templateFn = CELTIC_CROSS_INTERPRETATIONS.story_templates[0].template;
    const cardData = cards.reduce((acc, card) => {
      if (card.position && card.korean) {
        acc[card.position] = card.korean;
      }
      return acc;
    }, {});

    // 필수 카드들이 있는지 확인
    const requiredPositions = ["present", "challenge", "outcome"];
    const hasAllRequired = requiredPositions.every((pos) => cardData[pos]);

    if (!hasAllRequired) {
      return "카드들이 보여주는 전체적인 흐름을 통해 통찰을 얻으세요.";
    }

    return templateFn(cardData);
  }

  generatePersonalizedAdvice(cards, analysis, category, user) {
    const userName = getUserName(user);
    const _kph = KoreanPostpositionHelper;
    let advice = `${userName}님,\n\n`;
    if (cards.length === 1) {
      const card = cards[0];
      const cardAdvice =
        card.advice ||
        (card.isReversed ? card.meaning.reversed : card.meaning.upright);
      advice += `🔮✨ ${cardAdvice}\n\n`;
    }
    if (cards.length > 1) {
      if (analysis.majorCount > cards.length / 2)
        advice +=
          "💡 인생의 중요한 전환점일 수 있습니다. 각 카드의 영적 메시지에 깊이 귀 기울여 보세요.\n";
      if (analysis.reversedCount > cards.length / 2)
        advice +=
          "💡 많은 에너지가 내면으로 향하고 있습니다. 외부 활동보다는 자기 성찰의 시간이 필요해 보입니다.\n";
      const dominantSuit = Object.entries(analysis.suits).sort(
        ([, a], [, b]) => b - a
      )[0];
      if (dominantSuit && dominantSuit[1] >= cards.length / 2) {
        const suitAdvice = {
          wands:
            "🔥 행동력과 열정이 넘치는 시기입니다. 지금 계획한 일을 추진해 보세요.",
          cups: "💧 감정과 관계가 중요한 시점입니다. 마음의 소리를 따르는 것이 좋겠습니다.",
          swords:
            "⚔️ 명확한 사고와 소통이 필요합니다. 논리적으로 상황을 분석하고 결단하세요.",
          pentacles:
            "💰 현실적이고 실용적인 접근이 중요합니다. 꾸준함이 결실을 맺을 것입니다."
        };
        advice += (suitAdvice[dominantSuit[0]] || "") + "\n";
      }
    }
    if (category !== "general") {
      advice += `\n**${QUESTION_CATEGORIES[category].name}**과 관련하여:\n${this.getCategorySpecificAdvice(cards, category)}`;
    }
    if (advice.split("\n").filter((line) => line.trim() !== "").length <= 2) {
      advice +=
        "💡 카드의 전체적인 흐름을 읽고, 당신의 직관을 믿는 것이 중요합니다.";
    }
    return advice;
  }
  getCategorySpecificAdvice(cards, category) {
    const primaryCard =
      cards.find((c) => c.position === "outcome") ||
      cards.find((c) => c.position === "present") ||
      cards[cards.length - 1];
    const adviceTemplates = {
      love: [
        `${primaryCard.korean} 카드는 관계에서 진실한 소통이 중요하다고 말해주고 있어요.`,
        `현재 사랑의 기운은 ${primaryCard.korean}의 영향을 받고 있습니다. 상대방의 입장을 고려해보세요.`
      ],
      career: [
        `${primaryCard.korean} 카드를 볼 때, 현재 업무에서 창의력을 발휘할 좋은 기회로 보입니다.`,
        `직업적으로 ${primaryCard.korean}의 에너지가 강합니다. 동료와의 협력이 좋은 결과를 가져올 것입니다.`
      ],
      money: [
        `재물운과 관련하여 ${primaryCard.korean} 카드는 신중한 지출 관리가 필요함을 암시합니다.`,
        `${primaryCard.korean}의 등장은 새로운 재정적 기회를 의미할 수 있습니다. 잘 살펴보세요.`
      ],
      health: [
        `${primaryCard.korean} 카드는 몸과 마음의 균형을 찾으라고 조언합니다.`,
        `건강을 위해 ${primaryCard.korean}이 상징하는 활동적인 에너지를 활용해 보세요.`
      ]
    };
    const specificAdvice = adviceTemplates[category] || [
      `${primaryCard.korean} 카드의 의미를 현재 상황에 맞게 깊이 생각해보세요.`
    ];
    return specificAdvice[Math.floor(Math.random() * specificAdvice.length)];
  }

  async saveDrawRecord(userId, drawData) {
    try {
      if (!this.Fortune) return;

      // 🔥 cards 데이터를 저장할 때 meaning과 keywords 포함
      const record = {
        ...drawData,
        cards: drawData.cards.map(({ drawnAt, ...card }) => ({
          ...card,
          // 카드의 해석 정보도 함께 저장
          // 🔥 meaning을 문자열로 변환 (중요!)
          meaning:
            typeof card.meaning === "object"
              ? card.isReversed
                ? card.meaning.reversed
                : card.meaning.upright
              : card.meaning || "",
          keywords: Array.isArray(card.keywords) ? card.keywords : [],
          emoji: card.emoji || "🎴",
          advice: card.advice || ""
        }))
      };
      await this.Fortune.findOneAndUpdate(
        { userId },
        {
          $push: {
            draws: { $each: [record], $slice: -this.config.maxHistoryRecords }
          },
          $inc: {
            "stats.totalDraws": 1,
            [`stats.typeCount.${drawData.type}`]: 1
          },
          $set: { lastDrawAt: drawData.timestamp }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error("뽑기 기록 저장 실패:", error);
    }
  }

  generateBossMessage(type, drawResult, userId) {
    const messages = {
      single: [
        "두목: '한 장의 카드가 모든 답을 담고 있지!'",
        "두목: '우주의 메시지가 도착했다구!'"
      ],
      triple: [
        "두목: '과거, 현재, 미래가 한눈에 보이는구나!'",
        "두목: '시간의 흐름 속에서 답을 찾아봐!'"
      ],
      celtic: [
        "두목: '캘틱 크로스! 가장 신성한 배치야!'",
        "두목: '10장의 카드가 너의 우주를 그려냈어!'"
      ],
      special: [
        "두목: '오늘은 특별한 날! 카드도 더 밝게 빛나는군!'",
        "두목: '행운의 시간에 뽑았구나! 좋은 일이 생길거야!'"
      ]
    };
    const typeMessages = this.isSpecialDrawTime(new Date())
      ? messages.special
      : messages[type] || messages.single;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  isSpecialDrawTime(time) {
    return this.config.specialDrawHours.includes(time.getHours());
  }
  updateStats(type, cards) {
    this.stats.totalDraws++;
    this.stats.popularTypes[type] = (this.stats.popularTypes[type] || 0) + 1;
    cards.forEach(
      (card) =>
        (this.stats.cardFrequency[card.id] =
          (this.stats.cardFrequency[card.id] || 0) + 1)
    );
  }
  async shuffleDeck(userId) {
    return {
      success: true,
      message: "카드들이 우주의 에너지로 새롭게 섞였습니다! ✨"
    };
  }

  async getUserStats(userId) {
    if (!this.Fortune)
      return { success: true, data: this.generateDummyStats() };
    const user = await this.Fortune.findOne({ userId });
    if (!user) return { success: true, data: this.generateDummyStats() };

    // 가장 많이 나온 카드 찾기
    const favoriteCardObj = user.findFavoriteCard();
    const favoriteCard = favoriteCardObj
      ? `${favoriteCardObj.emoji || "🎴"} ${favoriteCardObj.korean || favoriteCardObj.name}`
      : null;

    const stats = user.stats ? user.stats.toObject() : {};
    return {
      success: true,
      data: {
        ...stats,
        favoriteCard, // 문자열로 변환된 카드 이름
        todayDraws: this.getTodayDrawCount(user),
        weeklyDraws: this.getWeeklyDrawCount(user)
      }
    };
  }

  generateDummyStats() {
    return {
      totalDraws: 0,
      favoriteCard: null,
      typeStats: {},
      todayDraws: 0,
      weeklyDraws: 0
    };
  }

  getPositionName(position) {
    return (
      { past: "과거", present: "현재", future: "미래" }[position] || position
    );
  }

  getAreaTitle(area) {
    return (
      {
        center: "핵심 상황",
        timeline: "시간의 흐름",
        internal: "내면의 영향",
        external: "외부 환경",
        outcome: "최종 결과"
      }[area] || area
    );
  }

  analyzeTripleFlow(cards) {
    const hasPositiveOutcome = ["The Sun", "The Star", "The World"].includes(
      cards[2].name
    );
    const hasChallenges = cards.some(
      (c) =>
        c.isReversed || ["Death", "The Tower", "The Devil"].includes(c.name)
    );
    if (hasPositiveOutcome && !hasChallenges) return "positive_flow";
    if (hasChallenges) return "challenging_flow";
    return "stable_flow";
  }

  findCardCombinations(cards) {
    const combinations = [];
    for (let i = 0; i < cards.length - 1; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const combo = InterpretationHelpers.findCombinationInterpretation(
          cards[i],
          cards[j]
        );
        if (combo) combinations.push(combo);
      }
    }
    return combinations;
  }

  // createCelticStory(cards, question) {
  //   const templateFn = CELTIC_CROSS_INTERPRETATIONS.story_templates[0].template;
  //   const cardData = cards.reduce((acc, card) => {
  //     acc[card.position] = card.korean;
  //     return acc;
  //   }, {});
  //   return templateFn(cardData);
  // }

  generateCelticAdvice(cards, category) {
    const outcome = cards.find((c) => c.position === "outcome");
    const approach = cards.find((c) => c.position === "approach");

    // 카드를 찾지 못한 경우 처리
    if (!outcome || !approach) {
      return "카드의 전체적인 흐름을 통해 답을 찾아보세요. 당신의 직관을 믿으세요.";
    }

    let advice = `${approach.korean}의 자세로 접근하면 ${outcome.korean}의 결과를 얻을 수 있습니다. `;
    const outcomeType = outcome.isReversed ? "challenging" : "positive";

    // CELTIC_CROSS_INTERPRETATIONS이 정의되어 있는지 확인
    if (
      CELTIC_CROSS_INTERPRETATIONS?.position_emphasis?.outcome?.[outcomeType]
    ) {
      advice +=
        CELTIC_CROSS_INTERPRETATIONS.position_emphasis.outcome[outcomeType]();
    }

    return advice;
  }

  getTriplePositionInterpretation(card, position, index) {
    const positionKey =
      index === 0
        ? "past_influence"
        : index === 1
          ? "present_situation"
          : "future_potential";
    const templates = TRIPLE_SPREAD_INTERPRETATIONS.temporal[positionKey];
    const templateFn = templates[Math.floor(Math.random() * templates.length)];
    const cardName = `${card.emoji} ${card.korean}`;
    return templateFn(cardName);
  }

  createDrawSummary(draw) {
    const mainCard = draw.cards[0];
    return `${mainCard.korean} - ${mainCard.isReversed ? "역방향" : "정방향"}`;
  }

  getTodayDrawCount(user) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return user.draws.filter((draw) => new Date(draw.timestamp) >= startOfDay)
      .length;
  }

  getWeeklyDrawCount(user) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return user.draws.filter((draw) => new Date(draw.timestamp) >= weekAgo)
      .length;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      hasDatabase: !!this.Fortune,
      deckSize: this.tarotDeck.length,
      stats: this.stats,
      config: this.config
    };
  }
}

module.exports = FortuneService;
