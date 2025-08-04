// src/services/FortuneService.js - 완전한 타로 데이터 적용

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

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
  constructor() {
    super("FortuneService");

    // 전체 타로 덱 초기화
    this.tarotDeck = [...FULL_TAROT_DECK];
    this.celticPositions = CELTIC_CROSS_POSITIONS;

    // 설정
    this.config = {
      maxDrawsPerDay: 5, // 일일 최대 뽑기 횟수
      maxHistoryRecords: 100, // 최대 기록 보관 수
      specialDrawHours: [0, 12] // 특별 운세 시간
    };

    // 통계
    this.stats = {
      totalDraws: 0,
      cardFrequency: {},
      popularTypes: {}
    };
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      logger.info("🔮 FortuneService 초기화 시작...");

      // MongoDB 모델 확인
      this.Fortune = this.models?.Fortune;

      if (!this.Fortune) {
        logger.warn("Fortune 모델 없음 - 제한된 기능으로 동작");
      } else {
        // 인덱스 생성
        await this.createIndexes();
      }

      // 타로 덱 검증
      logger.info(`🎴 타로 덱 초기화 완료: ${this.tarotDeck.length}장`);
      logger.debug(
        "- 메이저 아르카나:",
        this.tarotDeck.filter((c) => c.arcana === "major").length
      );
      logger.debug(
        "- 마이너 아르카나:",
        this.tarotDeck.filter((c) => c.arcana === "minor").length
      );

      this.isInitialized = true;
      logger.success("✅ FortuneService 초기화 완료");

      return { success: true };
    } catch (error) {
      logger.error("FortuneService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🗄️ 인덱스 생성
   */
  async createIndexes() {
    try {
      if (!this.Fortune) return;

      await this.Fortune.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.Fortune.collection.createIndex({ "draws.timestamp": -1 });
      await this.Fortune.collection.createIndex({ "stats.totalDraws": -1 });

      logger.debug("📑 Fortune 인덱스 생성 완료");
    } catch (error) {
      logger.warn("인덱스 생성 실패:", error.message);
    }
  }

  /**
   * 🎴 카드 뽑기 (메인 메서드)
   */
  async drawCard(userId, options = {}) {
    try {
      const { type = "single", question = null } = options;
      const drawTime = new Date();

      logger.info(`🎴 카드 뽑기 요청: ${userId}, 타입: ${type}`);

      // 일일 제한 확인
      const limitCheck = await this.checkDailyLimit(userId);
      if (!limitCheck.allowed) {
        return {
          success: false,
          message: limitCheck.message,
          data: { remainingDraws: 0 }
        };
      }

      // 카드 뽑기 실행
      const drawResult = this.performCardDraw(type, question);

      // 해석 생성
      const interpretation = await this.generateInterpretation(
        drawResult.cards,
        type,
        question,
        userId
      );

      // DB 저장 (가능한 경우)
      if (this.Fortune) {
        await this.saveDrawRecord(userId, {
          type,
          question,
          cards: drawResult.cards,
          interpretation,
          timestamp: drawTime
        });
      }

      // 통계 업데이트
      this.updateStats(type, drawResult.cards);

      // 두목봇 멘트 생성
      const bossMessage = this.generateBossMessage(type, drawResult, userId);

      return {
        success: true,
        message: bossMessage,
        data: {
          type,
          question,
          cards: drawResult.cards,
          interpretation,
          remainingDraws: limitCheck.remainingDraws - 1,
          totalDraws: limitCheck.todayDraws + 1,
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

  /**
   * 🎴 실제 카드 뽑기 로직 (중복 방지)
   */
  performCardDraw(type, question = null) {
    try {
      const result = {
        type,
        question,
        timestamp: new Date(),
        cards: []
      };

      // 매번 새로운 덱 생성 (셔플)
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

  /**
   * 🔀 셔플된 덱 생성
   */
  createShuffledDeck() {
    const deck = [...this.tarotDeck];

    // Fisher-Yates 셔플 알고리즘
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  /**
   * 🃏 단일 카드 뽑기
   */
  drawSingleCardFromDeck(deck) {
    if (deck.length === 0) {
      throw new Error("덱에 카드가 없습니다");
    }

    const randomIndex = Math.floor(Math.random() * deck.length);
    const [selectedCard] = deck.splice(randomIndex, 1);

    // 카드 복사 및 역방향 결정
    const card = {
      ...selectedCard,
      isReversed: this.shouldBeReversed(selectedCard),
      drawnAt: new Date()
    };

    return card;
  }

  /**
   * 🎴 트리플 카드 뽑기
   */
  drawTripleCards(deck) {
    const positions = ["past", "present", "future"];
    const cards = [];

    for (let i = 0; i < 3; i++) {
      const card = this.drawSingleCardFromDeck(deck);
      card.position = positions[i];
      card.positionName = this.getPositionName(positions[i]);
      cards.push(card);
    }

    return cards;
  }

  /**
   * 🔮 캘틱 크로스 뽑기
   */
  drawCelticCross(deck) {
    const cards = [];

    for (let i = 0; i < 10; i++) {
      const card = this.drawSingleCardFromDeck(deck);
      const position = this.celticPositions[i];

      card.position = position.key;
      card.positionName = position.name;
      card.positionDescription = position.description;
      card.area = position.area;
      card.order = i + 1;

      cards.push(card);
    }

    return cards;
  }

  /**
   * 🎯 역방향 여부 결정
   */
  shouldBeReversed(card) {
    // 메이저 아르카나는 30% 확률로 역방향
    if (card.arcana === "major") {
      return Math.random() < 0.3;
    }

    // 코트 카드는 25% 확률로 역방향
    if (card.court) {
      return Math.random() < 0.25;
    }

    // 일반 마이너 카드는 20% 확률로 역방향
    return Math.random() < 0.2;
  }

  /**
   * 💡 카드 해석 생성
   */
  async generateInterpretation(cards, type, question, userId) {
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

      // 타입별 종합 해석
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

      // 특별 패턴 감지
      interpretation.specialPatterns =
        InterpretationHelpers.detectSpecialPatterns(cards);

      // 전체 분석
      const analysis = TarotAnalytics.analyzeCardCombination(cards);
      interpretation.analysis = analysis;

      // 개인화된 조언
      interpretation.advice = this.generatePersonalizedAdvice(
        cards,
        analysis,
        category,
        await this.getUserName(userId)
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

  /**
   * 🎴 단일 카드 해석
   */
  interpretSingleCard(card, category) {
    const basicMeaning = TarotHelpers.getCardMeaning(card, card.isReversed);

    // 카테고리별 특수 해석이 있는 경우
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

  /**
   * 🃏 싱글 스프레드 해석
   */
  interpretSingleSpread(card, category, question) {
    let interpretation = `${card.emoji} **${card.korean}** `;

    if (card.isReversed) {
      interpretation += "(역방향)\n\n";
      interpretation +=
        "카드가 뒤집혀 나왔습니다. 일반적인 의미와는 다른 관점에서 접근이 필요합니다.\n\n";
    } else {
      interpretation += "\n\n";
    }

    interpretation += `**핵심 메시지**: ${card.meaning}\n\n`;

    if (card.keywords) {
      interpretation += `**키워드**: ${card.keywords}\n\n`;
    }

    // 아르카나별 설명
    if (card.arcana === "major") {
      interpretation +=
        "메이저 아르카나 카드로, 인생의 중요한 전환점을 나타냅니다.\n";
    } else {
      interpretation += `${TarotHelpers.getSuitDescription(card.suit)}\n`;
    }

    return interpretation;
  }

  /**
   * 🎴 트리플 스프레드 해석
   */
  interpretTripleSpread(cards, category, question) {
    let interpretation = "**과거 - 현재 - 미래의 흐름**\n\n";

    // 각 카드 설명
    cards.forEach((card, index) => {
      const positionInterpretation = this.getTriplePositionInterpretation(
        card,
        card.position,
        index
      );
      interpretation += positionInterpretation + "\n\n";
    });

    // 전체 흐름 분석
    const flowType = this.analyzeTripleFlow(cards);
    interpretation += "**전체적인 흐름**\n";
    interpretation +=
      TRIPLE_SPREAD_INTERPRETATIONS.flow_interpretations[flowType];

    // 카드 조합 특별 해석
    const combinations = this.findCardCombinations(cards);
    if (combinations.length > 0) {
      interpretation += "\n\n**특별한 조합**\n";
      interpretation += combinations.join("\n");
    }

    return interpretation;
  }

  /**
   * 🔮 캘틱 크로스 해석
   */
  interpretCelticSpread(cards, category, question) {
    let interpretation =
      "**캘틱 크로스 - 10장의 카드가 보여주는 전체 상황**\n\n";

    // 영역별 그룹화
    const areas = {
      center: cards.filter((c) =>
        ["present", "challenge"].includes(c.position)
      ),
      timeline: cards.filter((c) => c.area === "timeline"),
      internal: cards.filter((c) => c.area === "internal"),
      external: cards.filter((c) => c.area === "external"),
      outcome: cards.filter((c) => c.area === "outcome")
    };

    // 각 영역 해석
    Object.entries(areas).forEach(([area, areaCards]) => {
      if (areaCards.length > 0) {
        interpretation += `\n**${this.getAreaTitle(area)}**\n`;

        // CELTIC_CROSS_INTERPRETATIONS 활용
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

    // 스토리 구성 (CELTIC_CROSS_INTERPRETATIONS 활용)
    interpretation += "\n**전체 이야기**\n";
    const storyTemplate = CELTIC_CROSS_INTERPRETATIONS.story_templates[0];
    interpretation += this.createCelticStory(cards, question, storyTemplate);

    // 핵심 조언
    interpretation += "\n\n**핵심 조언**\n";
    interpretation += this.generateCelticAdvice(cards, category);

    return interpretation;
  }

  /**
   * 🎯 개인화된 조언 생성
   */
  generatePersonalizedAdvice(cards, analysis, category, userName) {
    let advice = `${userName}님을 위한 조언:\n\n`;

    // 메이저 아르카나 비율에 따른 조언
    if (analysis.majorCount > cards.length / 2) {
      advice +=
        "중요한 영적 메시지가 담겨 있습니다. 우주가 보내는 신호에 귀 기울이세요.\n";
    }

    // 역방향 카드에 대한 조언
    if (analysis.reversedCount > 0) {
      advice +=
        "일부 에너지가 막혀 있거나 다른 방향으로 흐르고 있습니다. 새로운 관점이 필요합니다.\n";
    }

    // 지배적인 슈트에 따른 조언
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

    // 카테고리별 맞춤 조언
    if (category !== "general") {
      advice += `\n${QUESTION_CATEGORIES[category].name}과 관련하여: `;
      advice += this.getCategorySpecificAdvice(cards, category);
    }

    return advice;
  }

  /**
   * 📊 일일 제한 확인
   */
  async checkDailyLimit(userId) {
    try {
      const today = TimeHelper.getKSTDate();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      if (this.Fortune) {
        const user = await this.Fortune.findOne({ userId });

        if (user) {
          const todayDraws = user.draws.filter(
            (draw) => new Date(draw.timestamp) >= startOfDay
          );

          const todayCount = todayDraws.length;
          const remainingDraws = Math.max(
            0,
            this.config.maxDrawsPerDay - todayCount
          );

          if (remainingDraws === 0) {
            return {
              allowed: false,
              message:
                "오늘의 운세 횟수를 모두 사용했습니다. 내일 다시 만나요! 🌙",
              remainingDraws: 0,
              todayDraws: todayCount
            };
          }

          return {
            allowed: true,
            remainingDraws,
            todayDraws: todayCount,
            message: `오늘 ${remainingDraws}번 더 뽑을 수 있습니다.`
          };
        }
      }

      // DB 없는 경우 기본값
      return {
        allowed: true,
        remainingDraws: this.config.maxDrawsPerDay,
        todayDraws: 0,
        message: "카드를 뽑을 준비가 되었습니다."
      };
    } catch (error) {
      logger.error("일일 제한 확인 실패:", error);
      return {
        allowed: true,
        remainingDraws: 1,
        todayDraws: 0,
        message: "제한 확인 중 오류가 발생했지만 계속 진행합니다."
      };
    }
  }

  /**
   * 💾 뽑기 기록 저장
   */
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

      // Upsert 사용자 레코드
      await this.Fortune.findOneAndUpdate(
        { userId },
        {
          $push: {
            draws: {
              $each: [record],
              $sort: { timestamp: -1 },
              $slice: this.config.maxHistoryRecords
            }
          },
          $inc: { "stats.totalDraws": 1 },
          $set: { lastDrawAt: drawData.timestamp }
        },
        { upsert: true, new: true }
      );

      logger.debug(`✅ ${userId}의 뽑기 기록 저장 완료`);
    } catch (error) {
      logger.error("뽑기 기록 저장 실패:", error);
    }
  }

  /**
   * 💬 두목봇 멘트 생성
   */
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

    // 특별 시간 체크
    const isSpecial = this.isSpecialDrawTime(new Date());

    if (isSpecial) {
      return messages.special[
        Math.floor(Math.random() * messages.special.length)
      ];
    }

    const typeMessages = messages[type] || messages.single;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * ⏰ 특별 뽑기 시간 확인
   */
  isSpecialDrawTime(time) {
    const hour = time.getHours();
    return this.config.specialDrawHours.includes(hour);
  }

  /**
   * 📊 통계 업데이트
   */
  updateStats(type, cards) {
    this.stats.totalDraws++;
    this.stats.popularTypes[type] = (this.stats.popularTypes[type] || 0) + 1;

    cards.forEach((card) => {
      const key = `${card.id}_${card.name}`;
      this.stats.cardFrequency[key] = (this.stats.cardFrequency[key] || 0) + 1;
    });
  }

  /**
   * 🔄 셔플 애니메이션용 메서드
   */
  async shuffleDeck(userId) {
    try {
      logger.info(`🔄 ${userId}의 덱 셔플 요청`);

      // 실제로는 매번 새로운 덱을 생성하므로 여기서는 피드백만 제공
      const messages = [
        "카드들이 우주의 에너지로 새롭게 섞였습니다! ✨",
        "타로 덱이 완전히 리셋되어 새로운 기운을 담았습니다! 🔮",
        "모든 카드가 원래 자리로 돌아가 새로운 메시지를 준비했습니다! 🎴",
        "신성한 에너지가 카드를 정화했습니다! 🌟"
      ];

      return {
        success: true,
        message: messages[Math.floor(Math.random() * messages.length)],
        data: {
          shuffled: true,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error("셔플 실패:", error);
      return {
        success: false,
        message: "카드 셔플 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 📜 사용자 기록 조회
   */
  async getDrawHistory(userId, limit = 10) {
    try {
      if (!this.Fortune) {
        return {
          success: true,
          data: {
            records: [],
            message: "기록을 불러올 수 없습니다."
          }
        };
      }

      const user = await this.Fortune.findOne({ userId });

      if (!user || !user.draws || user.draws.length === 0) {
        return {
          success: true,
          data: {
            records: [],
            message: "아직 뽑은 기록이 없습니다."
          }
        };
      }

      const records = user.draws.slice(0, limit).map((draw) => ({
        date: TimeHelper.format(draw.timestamp),
        type: draw.type,
        cards: draw.cards
          .map((c) => `${c.emoji || "🎴"} ${c.korean}`)
          .join(", "),
        question: draw.question || "일반 운세",
        summary: this.createDrawSummary(draw)
      }));

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

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      if (!this.Fortune) {
        return {
          success: true,
          data: this.generateDummyStats()
        };
      }

      const user = await this.Fortune.findOne({ userId });

      if (!user) {
        return {
          success: true,
          data: this.generateDummyStats()
        };
      }

      // 카드별 통계
      const cardStats = {};
      user.draws.forEach((draw) => {
        draw.cards.forEach((card) => {
          const key = card.korean;
          cardStats[key] = (cardStats[key] || 0) + 1;
        });
      });

      // 가장 많이 나온 카드
      const favoriteCard = Object.entries(cardStats).sort(
        ([, a], [, b]) => b - a
      )[0];

      // 타입별 통계
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

  /**
   * 🎲 더미 통계 생성
   */
  generateDummyStats() {
    return {
      totalDraws: Math.floor(Math.random() * 50) + 10,
      favoriteCard: "별",
      favoriteCardCount: Math.floor(Math.random() * 10) + 1,
      typeStats: {
        single: Math.floor(Math.random() * 20) + 5,
        triple: Math.floor(Math.random() * 10) + 2,
        celtic: Math.floor(Math.random() * 5) + 1
      },
      todayDraws: Math.floor(Math.random() * 3),
      weeklyDraws: Math.floor(Math.random() * 15) + 3
    };
  }

  /**
   * 🛠️ 헬퍼 메서드들
   */

  getPositionName(position) {
    const names = {
      past: "과거",
      present: "현재",
      future: "미래"
    };
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
    // 카드 조합에 따른 흐름 타입 결정
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
        if (combo) {
          combinations.push(combo);
        }
      }
    }

    return combinations;
  }

  createCelticStory(cards, question, template = null) {
    const present = cards.find((c) => c.position === "present");
    const challenge = cards.find((c) => c.position === "challenge");
    const outcome = cards.find((c) => c.position === "outcome");

    // 템플릿 사용
    if (template && template.type === "hero_journey") {
      const past = cards.find((c) => c.position === "distant_past");
      const approach = cards.find((c) => c.position === "approach");

      let story = template.template
        .replace("{present}", present?.korean || "현재")
        .replace("{challenge}", challenge?.korean || "도전")
        .replace("{past}", past?.korean || "과거")
        .replace("{approach}", approach?.korean || "접근")
        .replace("{outcome}", outcome?.korean || "결과");

      return story;
    }

    // 기본 스토리
    let story = `현재 당신은 ${present.korean}의 상황에 있습니다. `;
    story += `${challenge.korean}이(가) 도전 과제로 나타나고 있지만, `;
    story += `최종적으로 ${outcome.korean}의 결과로 이어질 것입니다. `;

    if (question) {
      story += `\n\n"${question}"에 대한 답은 이 카드들 속에 담겨 있습니다.`;
    }

    return story;
  }

  generateCelticAdvice(cards, category) {
    const outcome = cards.find((c) => c.position === "outcome");
    const approach = cards.find((c) => c.position === "approach");

    // CELTIC_CROSS_INTERPRETATIONS 활용
    const positionEmphasis = CELTIC_CROSS_INTERPRETATIONS.position_emphasis;

    let advice = `${approach.korean}의 자세로 접근하면 `;
    advice += `${outcome.korean}의 결과를 얻을 수 있습니다. `;

    // 결과 카드에 대한 특별 해석
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

  async getUserName(userId) {
    // 실제 구현에서는 사용자 정보를 가져옴
    return "고객";
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 FortuneService 정리 중...");
      this.stats = {
        totalDraws: 0,
        cardFrequency: {},
        popularTypes: {}
      };
      logger.debug("✅ FortuneService 정리 완료");
    } catch (error) {
      logger.error("FortuneService 정리 실패:", error);
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
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
