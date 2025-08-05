// src/services/FortuneService.js - 완전한 타로 데이터 적용

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { isDeveloper, getUserId, getUserName } = require("../utils/UserHelper");

// 🎴 타로 데이터 불러오기
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

/**
 * 🔮 FortuneService - 타로 카드 운세 서비스
 * 완전한 78장 타로 덱과 전문적인 해석을 제공합니다
 */
class FortuneService extends BaseService {
  constructor(options = {}) {
    super("FortuneService", options);

    this.tarotDeck = [...FULL_TAROT_DECK];
    this.celticPositions = CELTIC_CROSS_POSITIONS;

    this.config = {
      maxDrawsPerDay: 5, // 기본값, 모듈에서 덮어쓸 수 있음
      maxHistoryRecords: 100,
      specialDrawHours: [0, 12]
    };

    this.stats = {
      totalDraws: 0,
      cardFrequency: {},
      popularTypes: {}
    };
  }

  getRequiredModels() {
    return ["Fortune"];
  }

  async onInitialize() {
    try {
      logger.info("🔮 FortuneService 초기화 시작...");
      this.Fortune = this.models?.Fortune;

      if (!this.Fortune) {
        logger.warn("Fortune 모델 없음 - 제한된 기능으로 동작");
      } else {
        logger.success("✅ Fortune 모델 로드 성공");
        await this.createIndexes();
      }

      logger.info(`🎴 타로 덱 초기화 완료: ${this.tarotDeck.length}장`);
      logger.success("✅ FortuneService 초기화 완료");
      return { success: true };
    } catch (error) {
      logger.error("FortuneService 초기화 실패:", error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      if (!this.Fortune || !this.Fortune.collection) {
        logger.warn("Fortune 모델 또는 collection이 없어 인덱스 생성 스킵");
        return;
      }
      await this.Fortune.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.Fortune.collection.createIndex({ "draws.timestamp": -1 });
      await this.Fortune.collection.createIndex({ "stats.totalDraws": -1 });
      logger.success("📑 Fortune 인덱스 생성 완료");
    } catch (error) {
      logger.warn("인덱스 생성 실패:", error.message);
    }
  }

  async drawCard(user, options = {}) {
    try {
      const { type = "single", question = null } = options;
      const drawTime = new Date();
      const userId = getUserId(user);

      logger.info(`🎴 카드 뽑기 요청: ${userId}, 타입: ${type}`);

      const limitCheck = await this.checkDailyLimit(user);
      if (!limitCheck.allowed) {
        return {
          success: false,
          message: limitCheck.message,
          data: { remainingDraws: 0 }
        };
      }

      const drawResult = this.performCardDraw(type, question);
      const interpretation = await this.generateInterpretation(
        drawResult.cards,
        type,
        question,
        user
      );

      if (this.Fortune) {
        await this.saveDrawRecord(userId, {
          type,
          question,
          cards: drawResult.cards,
          interpretation,
          timestamp: drawTime
        });
      }

      this.updateStats(type, drawResult.cards);
      const bossMessage = this.generateBossMessage(type, drawResult, userId);

      const newLimitCheck = await this.checkDailyLimit(user);

      return {
        success: true,
        message: bossMessage,
        data: {
          type,
          question,
          cards: drawResult.cards,
          interpretation,
          remainingDraws: newLimitCheck.remainingDraws,
          todayDraws: newLimitCheck.todayCount,
          timestamp: drawTime,
          isSpecialTime: this.isSpecialDrawTime(drawTime)
        }
      };
    } catch (error) {
      logger.error("카드 뽑기 실패:", error);
      return {
        success: false,
        message: "카드 뽑기 중 오류가 발생했습니다.",
        data: { error: error.message }
      };
    }
  }

  performCardDraw(type, question = null) {
    try {
      const result = { type, question, timestamp: new Date(), cards: [] };
      const availableDeck = this.createShuffledDeck();
      switch (type) {
        case "single":
          result.cards = [this.drawSingleCardFromDeck(availableDeck)];
          break;
        case "triple":
          result.cards = this.drawTripleCards(availableDeck);
          break;
        case "celtic":
          result.cards = this.drawCelticCross(availableDeck);
          break;
        default:
          result.cards = [this.drawSingleCardFromDeck(availableDeck)];
      }
      return result;
    } catch (error) {
      logger.error("카드 뽑기 로직 오류:", error);
      throw error;
    }
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
    const randomIndex = Math.floor(Math.random() * deck.length);
    const [selectedCard] = deck.splice(randomIndex, 1);
    return {
      ...selectedCard,
      isReversed: this.shouldBeReversed(selectedCard),
      drawnAt: new Date()
    };
  }

  drawTripleCards(deck) {
    const positions = ["past", "present", "future"];
    return positions.map((position) => ({
      ...this.drawSingleCardFromDeck(deck),
      position,
      positionName: this.getPositionName(position)
    }));
  }

  drawCelticCross(deck) {
    return this.celticPositions.map((positionInfo, index) => ({
      ...this.drawSingleCardFromDeck(deck),
      position: positionInfo.key,
      positionName: positionInfo.name,
      positionDescription: positionInfo.description,
      area: positionInfo.area,
      order: index + 1
    }));
  }

  shouldBeReversed(card) {
    if (card.arcana === "major") return Math.random() < 0.3;
    if (card.court) return Math.random() < 0.25;
    return Math.random() < 0.2;
  }

  async generateInterpretation(cards, type, question, user) {
    try {
      const category = InterpretationHelpers.detectQuestionCategory(question);
      const interpretation = {
        category,
        type,
        cards: cards.map((card) => this.interpretSingleCard(card, category)),
        overall: null,
        advice: null,
        specialPatterns: []
      };
      switch (type) {
        case "single":
          interpretation.overall = this.interpretSingleSpread(
            cards[0],
            category,
            question
          );
          break;
        case "triple":
          interpretation.overall = this.interpretTripleSpread(
            cards,
            category,
            question
          );
          break;
        case "celtic":
          interpretation.overall = this.interpretCelticSpread(
            cards,
            category,
            question
          );
          break;
      }
      interpretation.specialPatterns =
        InterpretationHelpers.detectSpecialPatterns(cards);
      const analysis = TarotAnalytics.analyzeCardCombination(cards);
      interpretation.analysis = analysis;
      interpretation.advice = this.generatePersonalizedAdvice(
        cards,
        analysis,
        category,
        user
      );
      return interpretation;
    } catch (error) {
      logger.error("해석 생성 실패:", error);
      return {
        overall: "카드의 메시지를 해석하는 중입니다...",
        advice: "마음을 열고 카드의 메시지를 받아들이세요."
      };
    }
  }

  interpretSingleCard(card, category) {
    const basicMeaning = TarotHelpers.getCardMeaning(card, card.isReversed);
    const categoryInterpretations =
      QUESTION_CATEGORIES[category]?.interpretations;
    if (categoryInterpretations && categoryInterpretations[card.name]) {
      const special = categoryInterpretations[card.name];
      return {
        ...card,
        meaning: card.isReversed ? special.reversed : special.upright,
        basicMeaning,
        keywords: TarotHelpers.getKeywordString(card)
      };
    }
    return {
      ...card,
      meaning: basicMeaning,
      keywords: TarotHelpers.getKeywordString(card)
    };
  }

  interpretSingleSpread(card, category, question) {
    let interpretation = `${card.emoji} **${card.korean}** `;
    if (card.isReversed) {
      interpretation +=
        "(역방향)\n\n카드가 뒤집혀 나왔습니다. 일반적인 의미와는 다른 관점에서 접근이 필요합니다.\n\n";
    } else {
      interpretation += "\n\n";
    }
    interpretation += `**핵심 메시지**: ${card.meaning}\n\n`;
    if (card.keywords) {
      interpretation += `**키워드**: ${card.keywords}\n\n`;
    }
    if (card.arcana === "major") {
      interpretation +=
        "메이저 아르카나 카드로, 인생의 중요한 전환점을 나타냅니다.\n";
    } else {
      interpretation += `${TarotHelpers.getSuitDescription(card.suit)}\n`;
    }
    return interpretation;
  }

  interpretTripleSpread(cards, category, question) {
    let interpretation = "**과거 - 현재 - 미래의 흐름**\n\n";
    cards.forEach((card, index) => {
      interpretation +=
        this.getTriplePositionInterpretation(card, card.position, index) +
        "\n\n";
    });
    const flowType = this.analyzeTripleFlow(cards);
    interpretation +=
      "**전체적인 흐름**\n" +
      TRIPLE_SPREAD_INTERPRETATIONS.flow_interpretations[flowType];
    const combinations = this.findCardCombinations(cards);
    if (combinations.length > 0) {
      interpretation += "\n\n**특별한 조합**\n" + combinations.join("\n");
    }
    return interpretation;
  }

  interpretCelticSpread(cards, category, question) {
    let interpretation =
      "**캘틱 크로스 - 10장의 카드가 보여주는 전체 상황**\n\n";
    const areas = {
      center: cards.filter((c) =>
        ["present", "challenge"].includes(c.position)
      ),
      timeline: cards.filter((c) => c.area === "timeline"),
      internal: cards.filter((c) => c.area === "internal"),
      external: cards.filter((c) => c.area === "external"),
      outcome: cards.filter((c) => c.area === "outcome")
    };
    Object.entries(areas).forEach(([area, areaCards]) => {
      if (areaCards.length > 0) {
        interpretation += `\n**${this.getAreaTitle(area)}**\n`;
        const areaSynthesis = CELTIC_CROSS_INTERPRETATIONS.area_synthesis[area];
        areaCards.forEach((card) => {
          interpretation += `- ${card.positionName}: ${card.emoji} ${card.korean}`;
          if (card.isReversed) interpretation += " (역)";
          interpretation += "\n";
        });
        if (areaSynthesis) {
          interpretation += `\n*${areaSynthesis}*\n`;
        }
      }
    });
    interpretation += "\n**전체 이야기**\n";
    const storyTemplate = CELTIC_CROSS_INTERPRETATIONS.story_templates[0];
    interpretation += this.createCelticStory(cards, question, storyTemplate);
    interpretation +=
      "\n\n**핵심 조언**\n" + this.generateCelticAdvice(cards, category);
    return interpretation;
  }

  generatePersonalizedAdvice(cards, analysis, category, user) {
    const userName = getUserName(user);
    let advice = `${userName}님을 위한 조언:\n\n`;
    if (analysis.majorCount > cards.length / 2) {
      advice +=
        "중요한 영적 메시지가 담겨 있습니다. 우주가 보내는 신호에 귀 기울이세요.\n";
    }
    if (analysis.reversedCount > 0) {
      advice +=
        "일부 에너지가 막혀 있거나 다른 방향으로 흐르고 있습니다. 새로운 관점이 필요합니다.\n";
    }
    const dominantSuit = Object.entries(analysis.suits).sort(
      ([, a], [, b]) => b - a
    )[0];
    if (dominantSuit && dominantSuit[1] >= 2) {
      const suitAdvice = {
        wands: "행동력과 열정을 발휘할 때입니다. 적극적으로 나서세요.",
        cups: "감정과 직관을 신뢰하세요. 마음이 이끄는 대로 따르세요.",
        swords: "명확한 사고와 소통이 중요합니다. 진실을 추구하세요.",
        pentacles: "현실적이고 실용적인 접근이 필요합니다. 꾸준히 노력하세요."
      };
      advice += (suitAdvice[dominantSuit[0]] || "") + "\n";
    }
    if (category !== "general") {
      advice +=
        `\n${QUESTION_CATEGORIES[category].name}과 관련하여: ` +
        this.getCategorySpecificAdvice(cards, category);
    }
    return advice;
  }

  async checkDailyLimit(user, maxDrawsPerDay) {
    const userId = getUserId(user);
    try {
      if (isDeveloper(user)) {
        return {
          allowed: true,
          isDeveloper: true,
          message: "개발자 모드: 횟수 제한 없음",
          remainingDraws: Infinity,
          todayCount: 0
        };
      }
      const today = TimeHelper.getKSTDate();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const maxDraws = maxDrawsPerDay || this.config.maxDrawsPerDay;

      if (this.Fortune) {
        const userDoc = await this.Fortune.findOne({ userId });
        if (userDoc) {
          const todayDraws = userDoc.draws.filter(
            (draw) => new Date(draw.timestamp) >= startOfDay
          );
          const todayCount = todayDraws.length;
          const remainingDraws = Math.max(0, maxDraws - todayCount);
          if (remainingDraws <= 0) {
            return {
              allowed: false,
              message: `오늘의 운세 횟수를 모두 사용했습니다. (${todayCount}/${maxDraws})`,
              remainingDraws: 0,
              todayCount
            };
          }
          return {
            allowed: true,
            isDeveloper: false,
            remainingDraws,
            todayCount,
            message: `오늘 ${remainingDraws}번 더 뽑을 수 있습니다.`
          };
        }
      }
      return {
        allowed: true,
        remainingDraws: maxDraws,
        todayCount: 0,
        message: "카드를 뽑을 준비가 되었습니다."
      };
    } catch (error) {
      logger.error("일일 제한 확인 실패:", error);
      return {
        allowed: true,
        remainingDraws: 1,
        todayCount: 0,
        message: "제한 확인 중 오류가 발생했지만 계속 진행합니다."
      };
    }
  }

  async saveDrawRecord(userId, drawData) {
    try {
      if (!this.Fortune) return;
      const record = {
        type: drawData.type,
        question: drawData.question,
        cards: drawData.cards.map((card) => ({
          id: card.id,
          name: card.name,
          korean: card.korean,
          arcana: card.arcana,
          suit: card.suit,
          isReversed: card.isReversed,
          position: card.position
        })),
        interpretation: drawData.interpretation,
        timestamp: drawData.timestamp
      };
      let user = await this.Fortune.findOne({ userId });
      if (!user) {
        user = new this.Fortune({ userId, draws: [], stats: {} });
      }
      user.draws.unshift(record);
      if (user.draws.length > this.config.maxHistoryRecords) {
        user.draws.pop();
      }
      user.stats.totalDraws = user.draws.length;
      user.stats.typeCount = {
        single: user.draws.filter((d) => d.type === "single").length,
        triple: user.draws.filter((d) => d.type === "triple").length,
        celtic: user.draws.filter((d) => d.type === "celtic").length
      };
      const favorite = user.findFavoriteCard();
      if (favorite) user.stats.favoriteCard = favorite;
      user.lastDrawAt = drawData.timestamp;
      if (!user.firstDrawAt) user.firstDrawAt = drawData.timestamp;
      await user.save();
      logger.debug(`✅ ${userId}의 뽑기 기록 및 통계 저장 완료`);
    } catch (error) {
      logger.error("뽑기 기록 저장 실패:", error);
    }
  }

  generateBossMessage(type, drawResult, userId) {
    const messages = {
      single: [
        "두목: '한 장의 카드가 모든 답을 담고 있지!'",
        "두목: '우주의 메시지가 도착했다구!'",
        "두목: '이 카드가 너의 길을 밝혀줄거야!'"
      ],
      triple: [
        "두목: '과거, 현재, 미래가 한눈에 보이는구나!'",
        "두목: '시간의 흐름 속에서 답을 찾아봐!'",
        "두목: '3장의 카드가 완벽한 스토리를 만들었어!'"
      ],
      celtic: [
        "두목: '캘틱 크로스! 가장 신성한 배치야!'",
        "두목: '10장의 카드가 너의 우주를 그려냈어!'",
        "두목: '이건 정말 특별한 메시지야! 집중해서 봐!'"
      ],
      special: [
        "두목: '오늘은 특별한 날! 카드도 더 밝게 빛나는군!'",
        "두목: '행운의 시간에 뽑았구나! 좋은 일이 생길거야!'",
        "두목: '우와! 이 시간에 뽑은 카드는 효과가 2배!'"
      ]
    };
    if (this.isSpecialDrawTime(new Date())) {
      return messages.special[
        Math.floor(Math.random() * messages.special.length)
      ];
    }
    const typeMessages = messages[type] || messages.single;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  isSpecialDrawTime(time) {
    return this.config.specialDrawHours.includes(time.getHours());
  }

  updateStats(type, cards) {
    this.stats.totalDraws++;
    this.stats.popularTypes[type] = (this.stats.popularTypes[type] || 0) + 1;
    cards.forEach((card) => {
      const key = `${card.id}_${card.name}`;
      this.stats.cardFrequency[key] = (this.stats.cardFrequency[key] || 0) + 1;
    });
  }

  async shuffleDeck(userId) {
    try {
      logger.info(`🔄 ${userId}의 덱 셔플 요청`);
      const messages = [
        "카드들이 우주의 에너지로 새롭게 섞였습니다! ✨",
        "타로 덱이 완전히 리셋되어 새로운 기운을 담았습니다! 🔮",
        "모든 카드가 원래 자리로 돌아가 새로운 메시지를 준비했습니다! 🎴",
        "신성한 에너지가 카드를 정화했습니다! 🌟"
      ];
      return {
        success: true,
        message: messages[Math.floor(Math.random() * messages.length)],
        data: { shuffled: true, timestamp: new Date() }
      };
    } catch (error) {
      logger.error("셔플 실패:", error);
      return { success: false, message: "카드 셔플 중 오류가 발생했습니다." };
    }
  }

  async getDrawHistory(userId, limit = 10) {
    try {
      if (!this.Fortune) {
        return {
          success: true,
          data: { records: [], message: "기록을 불러올 수 없습니다." }
        };
      }
      const user = await this.Fortune.findOne({ userId });
      if (!user || !user.draws || user.draws.length === 0) {
        return {
          success: true,
          data: { records: [], message: "아직 뽑은 기록이 없습니다." }
        };
      }
      const records = user.draws.slice(0, limit).map((draw) => {
        const mainCard = draw.cards[0];
        return {
          date: TimeHelper.format(draw.timestamp, "relative"),
          type: draw.type,
          drawType: draw.type,
          card: {
            korean: mainCard?.korean || "알 수 없는 카드",
            name: mainCard?.name,
            emoji: mainCard?.emoji || "🎴"
          },
          cardName: mainCard?.korean || "알 수 없는 카드",
          koreanName: mainCard?.korean || "알 수 없는 카드",
          cards: draw.cards
            .map((c) => `${c.emoji || "🎴"} ${c.korean || "알 수 없음"}`)
            .join(", "),
          question: draw.question || "일반 운세",
          summary: this.createDrawSummary(draw),
          isReversed: mainCard?.isReversed || false,
          cardCount: draw.cards.length
        };
      });
      return {
        success: true,
        data: {
          records,
          total: user.draws.length,
          message: `최근 ${records.length}개의 기록`
        }
      };
    } catch (error) {
      logger.error("기록 조회 실패:", error);
      return {
        success: false,
        message: "기록을 불러오는 중 오류가 발생했습니다."
      };
    }
  }

  async getUserStats(userId) {
    try {
      if (!this.Fortune) {
        return { success: true, data: this.generateDummyStats() };
      }
      const user = await this.Fortune.findOne({ userId });
      if (!user) {
        return { success: true, data: this.generateDummyStats() };
      }
      const cardStats = {};
      user.draws.forEach((draw) => {
        draw.cards.forEach((card) => {
          const key = card.korean;
          cardStats[key] = (cardStats[key] || 0) + 1;
        });
      });
      const favoriteCard = Object.entries(cardStats).sort(
        ([, a], [, b]) => b - a
      )[0];
      const typeStats = {};
      user.draws.forEach((draw) => {
        typeStats[draw.type] = (typeStats[draw.type] || 0) + 1;
      });
      return {
        success: true,
        data: {
          totalDraws: user.stats?.totalDraws || user.draws.length,
          firstDraw: user.draws[user.draws.length - 1]?.timestamp,
          lastDraw: user.draws[0]?.timestamp,
          favoriteCard: favoriteCard ? favoriteCard[0] : null,
          favoriteCardCount: favoriteCard ? favoriteCard[1] : 0,
          typeStats,
          todayDraws: this.getTodayDrawCount(user),
          weeklyDraws: this.getWeeklyDrawCount(user)
        }
      };
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return {
        success: false,
        message: "통계를 불러오는 중 오류가 발생했습니다."
      };
    }
  }

  generateDummyStats() {
    return {
      totalDraws: 0,
      favoriteCard: null,
      favoriteCardCount: 0,
      typeStats: { single: 0, triple: 0, celtic: 0 },
      todayDraws: 0,
      weeklyDraws: 0,
      isDemo: true
    };
  }

  getPositionName(position) {
    const names = { past: "과거", present: "현재", future: "미래" };
    return names[position] || position;
  }

  getAreaTitle(area) {
    const titles = {
      center: "핵심 상황",
      timeline: "시간의 흐름",
      internal: "내면의 영향",
      external: "외부 환경",
      outcome: "최종 결과"
    };
    return titles[area] || area;
  }

  analyzeTripleFlow(cards) {
    const hasPositiveOutcome =
      cards[2].arcana === "major" &&
      ["The Sun", "The Star", "The World"].includes(cards[2].name);
    const hasChallenges =
      cards.some((c) => c.isReversed) ||
      cards.some((c) => ["Death", "The Tower", "The Devil"].includes(c.name));
    if (hasPositiveOutcome && !hasChallenges) return "positive_flow";
    if (hasChallenges && hasPositiveOutcome) return "transformative_flow";
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

  createCelticStory(cards, question, template = null) {
    const present = cards.find((c) => c.position === "present");
    const challenge = cards.find((c) => c.position === "challenge");
    const outcome = cards.find((c) => c.position === "outcome");
    if (template && template.type === "hero_journey") {
      const past = cards.find((c) => c.position === "distant_past");
      const approach = cards.find((c) => c.position === "approach");
      return template.template
        .replace("{present}", present?.korean || "현재")
        .replace("{challenge}", challenge?.korean || "도전")
        .replace("{past}", past?.korean || "과거")
        .replace("{approach}", approach?.korean || "접근")
        .replace("{outcome}", outcome?.korean || "결과");
    }
    let story = `현재 당신은 ${present.korean}의 상황에 있습니다. ${challenge.korean}이(가) 도전 과제로 나타나고 있지만, 최종적으로 ${outcome.korean}의 결과로 이어질 것입니다. `;
    if (question)
      story += `\n\n"${question}"에 대한 답은 이 카드들 속에 담겨 있습니다.`;
    return story;
  }

  generateCelticAdvice(cards, category) {
    const outcome = cards.find((c) => c.position === "outcome");
    const approach = cards.find((c) => c.position === "approach");
    const positionEmphasis = CELTIC_CROSS_INTERPRETATIONS.position_emphasis;
    let advice = `${approach.korean}의 자세로 접근하면 ${outcome.korean}의 결과를 얻을 수 있습니다. `;
    if (outcome) {
      const outcomeType = outcome.isReversed ? "challenging" : "positive";
      const outcomeAdvice = positionEmphasis.outcome[outcomeType];
      if (outcomeAdvice) {
        advice += outcomeAdvice;
      } else if (outcome.isReversed) {
        advice += `다만 예상과는 다른 형태로 나타날 수 있으니 열린 마음을 가지세요.`;
      } else {
        advice += `긍정적인 결과가 예상되니 자신감을 가지고 나아가세요.`;
      }
    }
    return advice;
  }

  getCategorySpecificAdvice(cards, category) {
    const adviceTemplates = {
      love: "상대방의 마음을 이해하고 진심으로 다가가세요.",
      career: "전문성을 키우고 네트워크를 확장하세요.",
      money: "장기적인 관점에서 재정 계획을 세우세요.",
      health: "몸과 마음의 균형을 유지하세요."
    };
    return adviceTemplates[category] || "직감을 믿고 최선을 다하세요.";
  }

  getTriplePositionInterpretation(card, position, index) {
    const templates =
      TRIPLE_SPREAD_INTERPRETATIONS.temporal[
        `${position}_${index === 0 ? "influence" : index === 1 ? "situation" : "potential"}`
      ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return template.replace("{card}", `${card.emoji} ${card.korean}`);
  }

  createDrawSummary(draw) {
    const mainCard = draw.cards[0];
    const cardNames = draw.cards.map((c) => c.korean).join(", ");
    switch (draw.type) {
      case "single":
        return `${mainCard.korean} - ${mainCard.isReversed ? "역방향" : "정방향"}`;
      case "triple":
        return `과거-현재-미래: ${cardNames}`;
      case "celtic":
        return `캘틱 크로스 10장 전체 리딩`;
      default:
        return cardNames;
    }
  }

  getTodayDrawCount(user) {
    const today = TimeHelper.getKSTDate();
    const startOfDay = new Date(today);
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

  async cleanup() {
    try {
      logger.info("🧹 FortuneService 정리 중...");
      this.stats = { totalDraws: 0, cardFrequency: {}, popularTypes: {} };
      logger.debug("✅ FortuneService 정리 완료");
    } catch (error) {
      logger.error("FortuneService 정리 실패:", error);
    }
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
