// src/services/FortuneService.js - 🔮 캘틱 크로스 & 마이너 아르카나 완성판

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneService - 전문 타로 시스템 (캘틱 크로스 & 풀덱)
 *
 * ✨ 새로운 기능:
 * - 캘틱 크로스 10카드 스프레드
 * - 메이저 아르카나 22장 (정방향/역방향)
 * - 마이너 아르카나 56장 (정방향만)
 * - 전문적인 타로 해석 시스템
 */
class FortuneService extends BaseService {
  constructor(options = {}) {
    super("FortuneService", options);

    // 🎴 완전한 타로 덱 초기화
    this.tarotDeck = this.initializeFullTarotDeck();

    // ⚙️ 설정
    this.config = {
      maxDrawsPerDay: 3, // 캘틱 크로스는 하루 3번으로 제한
      maxHistoryRecords: 100,
      shuffleCooldown: 60000,
      ...options.config,
    };

    // 📊 통계 정보
    this.stats = {
      totalDraws: 0,
      todayDraws: 0,
      errors: 0,
      lastUpdate: null,
    };

    logger.info("🔮 FortuneService 생성됨 (캘틱 크로스 & 풀덱 버전)");
  }

  /**
   * 🗃️ 필수 DB 모델 지정
   */
  getRequiredModels() {
    return ["Fortune"];
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    try {
      if (!this.models || !this.models.Fortune) {
        throw new Error("Fortune 모델이 연결되지 않았습니다");
      }

      await this.ensureIndexes();
      await this.updateStats();

      logger.success("🔮 FortuneService 초기화 완료 (캘틱 크로스 & 풀덱)");
    } catch (error) {
      logger.error("❌ FortuneService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 인덱스 확인 및 생성
   */
  async ensureIndexes() {
    try {
      const Fortune = this.models.Fortune;

      await Fortune.collection.createIndex(
        {
          lastDrawDate: 1,
        },
        {
          name: "idx_lastDrawDate",
          background: true,
        }
      );

      logger.debug("📊 Fortune 인덱스 확인 완료");
    } catch (error) {
      logger.warn("⚠️ Fortune 인덱스 생성 중 경고:", error.message);
    }
  }

  /**
   * 📊 서비스 통계 업데이트
   */
  async updateStats() {
    try {
      const Fortune = this.models.Fortune;
      const today = TimeHelper.format(new Date(), "date");

      const totalUsers = await Fortune.countDocuments({});
      const todayUsers = await Fortune.countDocuments({
        lastDrawDate: today,
      });

      const totalDrawsResult = await Fortune.aggregate([
        {
          $group: {
            _id: null,
            totalDraws: { $sum: "$totalDraws" },
          },
        },
      ]);

      this.stats = {
        totalUsers,
        todayUsers,
        totalDraws: totalDrawsResult[0]?.totalDraws || 0,
        lastUpdate: new Date(),
      };

      logger.debug("📊 FortuneService 통계 업데이트:", this.stats);
    } catch (error) {
      logger.warn("⚠️ 통계 업데이트 실패:", error.message);
    }
  }

  /**
   * 🎴 타로 카드 뽑기 (메인 함수)
   */
  async drawCard(userId, options = {}) {
    try {
      const { type = "single", question = null } = options;
      const today = TimeHelper.format(new Date(), "date");

      // 1️⃣ 사용자 정보 조회 또는 생성
      let userRecord = await this.findOrCreateUser(userId);

      // 2️⃣ 일일 제한 체크
      const canDraw = await this.checkDailyLimit(userRecord, today);
      if (!canDraw.allowed) {
        return {
          success: false,
          message: canDraw.message,
          data: { remainingDraws: 0 },
        };
      }

      // 3️⃣ 카드 뽑기 실행
      const drawResult = this.performCardDraw(type);

      // 4️⃣ 결과를 DB에 저장
      const savedResult = await this.saveDrawResult(userRecord, drawResult, {
        type,
        question,
        date: today,
      });

      // 5️⃣ 통계 업데이트
      this.stats.totalDraws++;
      if (userRecord.lastDrawDate !== today) {
        this.stats.todayUsers++;
      }

      return {
        success: true,
        message: this.generateDoomockComment(
          "draw",
          savedResult.userName,
          drawResult
        ),
        data: {
          ...drawResult,
          remainingDraws:
            this.config.maxDrawsPerDay - (userRecord.todayDrawCount || 0) - 1,
          totalDraws: userRecord.totalDraws + 1,
        },
      };
    } catch (error) {
      logger.error("❌ FortuneService.drawCard 오류:", error);
      this.stats.errors++;

      return {
        success: false,
        message: "카드 뽑기 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        data: { error: error.message },
      };
    }
  }

  /**
   * 🔍 사용자 찾기 또는 생성
   */
  async findOrCreateUser(userId) {
    try {
      const Fortune = this.models.Fortune;

      let userRecord = await Fortune.findOne({ userId });

      if (!userRecord) {
        userRecord = new Fortune({
          userId,
          userName: `User${userId}`,
          totalDraws: 0,
          drawHistory: [],
          lastDrawDate: null,
          todayDrawCount: 0,
          createdAt: new Date(),
        });

        await userRecord.save();
        logger.info(`🆕 새 Fortune 사용자 생성: ${userId}`);
      }

      return userRecord;
    } catch (error) {
      logger.error("❌ 사용자 조회/생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 일일 제한 체크
   */
  async checkDailyLimit(userRecord, today) {
    try {
      if (userRecord.lastDrawDate !== today) {
        return {
          allowed: true,
          remainingDraws: this.config.maxDrawsPerDay,
          message: "오늘 첫 뽑기입니다!",
        };
      }

      const todayDrawCount = userRecord.todayDrawCount || 0;
      const remainingDraws = this.config.maxDrawsPerDay - todayDrawCount;

      if (remainingDraws <= 0) {
        return {
          allowed: false,
          remainingDraws: 0,
          message: `오늘은 이미 ${this.config.maxDrawsPerDay}번 뽑으셨습니다. 캘틱 크로스는 신중하게 하루에 몇 번만 뽑는 것이 좋습니다.`,
        };
      }

      return {
        allowed: true,
        remainingDraws,
        message: `오늘 ${remainingDraws}번 더 뽑을 수 있습니다.`,
      };
    } catch (error) {
      logger.error("❌ 일일 제한 체크 실패:", error);
      return {
        allowed: true,
        remainingDraws: 1,
        message: "제한 체크 중 오류가 발생했지만 뽑기를 진행합니다.",
      };
    }
  }

  /**
   * 🎴 실제 카드 뽑기 로직 (중복 방지)
   */
  performCardDraw(type) {
    try {
      const result = {
        type,
        timestamp: new Date(),
        cards: [],
      };

      // ✅ 수정: 중복 방지를 위한 덱 복사 및 관리
      const availableDeck = [...this.tarotDeck]; // 원본 덱 복사

      switch (type) {
        case "single":
          result.cards = [this.drawSingleCardFromDeck(availableDeck)];
          break;

        case "triple":
          result.cards = this.drawMultipleCards(availableDeck, 3, [
            "past",
            "present",
            "future",
          ]);
          break;

        case "celtic":
          result.cards = this.drawCelticCrossFromDeck(availableDeck);
          break;

        default:
          result.cards = [this.drawSingleCardFromDeck(availableDeck)];
      }

      return result;
    } catch (error) {
      logger.error("❌ 카드 뽑기 로직 오류:", error);
      throw error;
    }
  }

  /**
   * 🃏 덱에서 단일 카드 뽑기 (중복 방지)
   * @param {Array} deck - 사용 가능한 카드 덱 (이 배열에서 카드가 제거됨)
   * @returns {Object} 뽑힌 카드
   */
  drawSingleCardFromDeck(deck) {
    if (deck.length === 0) {
      throw new Error("덱에 카드가 남아있지 않습니다");
    }

    // 랜덤 인덱스 선택
    const randomIndex = Math.floor(Math.random() * deck.length);

    // 카드 추출 (원본 덱에서 제거)
    const [selectedCard] = deck.splice(randomIndex, 1);

    // 카드 복사 및 속성 추가
    const card = { ...selectedCard };

    // 메이저 아르카나는 역방향 가능, 마이너는 정방향만
    if (card.arcana === "major") {
      card.isReversed = Math.random() < 0.3; // 30% 확률로 역방향
    } else {
      card.isReversed = false; // 마이너 아르카나는 항상 정방향
    }

    card.drawnAt = new Date();

    logger.debug(
      `🎴 카드 뽑음: ${card.korean} (${card.name}), 덱 남은 개수: ${deck.length}`
    );

    return card;
  }

  /**
   * 🎴 여러 카드 뽑기 (중복 방지)
   * @param {Array} deck - 사용 가능한 카드 덱
   * @param {number} count - 뽑을 카드 수
   * @param {Array} positions - 포지션 배열 (옵션)
   * @returns {Array} 뽑힌 카드들
   */
  drawMultipleCards(deck, count, positions = []) {
    if (deck.length < count) {
      throw new Error(
        `덱에 카드가 부족합니다. 필요: ${count}장, 남은: ${deck.length}장`
      );
    }

    const cards = [];

    for (let i = 0; i < count; i++) {
      const card = this.drawSingleCardFromDeck(deck);

      // 포지션 정보 추가
      if (positions[i]) {
        card.position = positions[i];
      }

      cards.push(card);
    }

    logger.debug(`🎴 ${count}장 카드 뽑기 완료, 덱 남은 개수: ${deck.length}`);

    return cards;
  }

  /**
   * 🔮 캘틱 크로스 10카드 뽑기 (중복 방지)
   * @param {Array} deck - 사용 가능한 카드 덱
   * @returns {Array} 10장의 캘틱 크로스 카드
   */
  drawCelticCrossFromDeck(deck) {
    if (deck.length < 10) {
      throw new Error(
        `캘틱 크로스에는 10장이 필요합니다. 덱 남은: ${deck.length}장`
      );
    }

    const positions = [
      {
        key: "present",
        name: "현재 상황",
        description: "지금 당신이 처한 상황",
      },
      {
        key: "challenge",
        name: "도전/장애물",
        description: "극복해야 할 문제나 도전",
      },
      {
        key: "past",
        name: "원인/과거",
        description: "현재 상황의 근본 원인",
      },
      {
        key: "future",
        name: "가능한 미래",
        description: "현재 방향으로 갈 때의 미래",
      },
      {
        key: "conscious",
        name: "의식적 접근",
        description: "당신이 의식적으로 취하는 접근법",
      },
      {
        key: "unconscious",
        name: "무의식적 영향",
        description: "무의식적으로 작용하는 요소들",
      },
      {
        key: "approach",
        name: "당신의 접근법",
        description: "취해야 할 행동 방향",
      },
      {
        key: "environment",
        name: "외부 환경",
        description: "주변 환경과 타인의 영향",
      },
      {
        key: "hopes_fears",
        name: "희망과 두려움",
        description: "내면의 기대와 걱정",
      },
      {
        key: "outcome",
        name: "최종 결과",
        description: "모든 요소를 고려한 최종 결과",
      },
    ];

    // 10장의 카드를 중복 없이 뽑기
    const cards = [];

    for (let i = 0; i < 10; i++) {
      const card = this.drawSingleCardFromDeck(deck);
      const position = positions[i];

      // 포지션 정보 추가
      card.position = position.key;
      card.positionName = position.name;
      card.positionDescription = position.description;
      card.order = i + 1;

      cards.push(card);
    }

    logger.info(
      `🔮 캘틱 크로스 10카드 뽑기 완료 (모두 다른 카드), 덱 남은: ${deck.length}장`
    );

    // ✅ 중복 검증 로그
    const cardIds = cards.map((card) => card.id);
    const uniqueIds = new Set(cardIds);

    if (cardIds.length !== uniqueIds.size) {
      logger.error("❌ 캘틱 크로스에 중복 카드 발견!", {
        총카드수: cardIds.length,
        고유카드수: uniqueIds.size,
        카드ID들: cardIds,
      });
    } else {
      logger.success("✅ 캘틱 크로스 중복 없음 확인", {
        카드ID들: cardIds,
      });
    }

    return cards;
  }

  /**
   * ✅ 추가: 덱 셔플 기능
   * @returns {Object} 셔플 결과
   */
  async shuffleDeck(userId) {
    try {
      logger.info(`🔄 ${userId} 사용자의 덱 셔플 요청`);

      // 실제로는 매번 새로운 덱을 생성하므로 항상 셔플된 상태
      // 여기서는 사용자에게 피드백만 제공

      const messages = [
        "카드들이 우주의 에너지로 새롭게 섞였습니다! ✨",
        "타로 덱이 완전히 리셋되어 새로운 기운을 담았습니다! 🔮",
        "모든 카드가 원래 자리로 돌아가 새로운 메시지를 준비했습니다! 🎴",
        "덱이 초기화되어 순수한 에너지로 가득 찼습니다! 💫",
      ];

      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];

      return {
        success: true,
        message: randomMessage,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("❌ 덱 셔플 실패:", error);
      return {
        success: false,
        message: "덱 셔플 중 오류가 발생했습니다.",
        error: error.message,
      };
    }
  }

  /**
   * 💾 뽑기 결과 저장
   */
  async saveDrawResult(userRecord, drawResult, options) {
    try {
      const Fortune = this.models.Fortune;
      const { type, question, date } = options;

      // 히스토리 레코드 생성 (첫 번째 카드 기준)
      const mainCard = drawResult.cards[0];
      const historyRecord = {
        date,
        cardId: mainCard.id,
        cardName: mainCard.name,
        koreanName: mainCard.korean,
        isReversed: mainCard.isReversed,
        drawType: type,
        timestamp: new Date(),
        doomockComment: this.generateDoomockComment(
          "draw",
          userRecord.userName,
          drawResult
        ),
        question: type === "celtic" ? question : null,
        cardCount: drawResult.cards.length,
      };

      // 사용자 레코드 업데이트
      const updateData = {
        $inc: { totalDraws: 1 },
        $push: {
          drawHistory: {
            $each: [historyRecord],
            $slice: -this.config.maxHistoryRecords,
          },
        },
        $set: {
          lastDrawDate: date,
          lastActiveAt: new Date(),
        },
      };

      if (userRecord.lastDrawDate !== date) {
        updateData.$set.todayDrawCount = 1;
      } else {
        updateData.$inc.todayDrawCount = 1;
      }

      const updatedUser = await Fortune.findOneAndUpdate(
        { userId: userRecord.userId },
        updateData,
        { new: true, runValidators: true }
      );

      logger.debug(`💾 뽑기 결과 저장 완료: 사용자 ${userRecord.userId}`);

      return {
        ...historyRecord,
        userName: updatedUser.userName,
        totalDraws: updatedUser.totalDraws,
      };
    } catch (error) {
      logger.error("❌ 뽑기 결과 저장 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 오늘 뽑기 횟수 조회
   */
  async getTodayDrawCount(userId) {
    try {
      const Fortune = this.models.Fortune;
      const today = TimeHelper.format(new Date(), "date");

      const userRecord = await Fortune.findOne({ userId });

      if (!userRecord || userRecord.lastDrawDate !== today) {
        return {
          success: true,
          data: { count: 0, date: today },
        };
      }

      return {
        success: true,
        data: {
          count: userRecord.todayDrawCount || 0,
          date: today,
        },
      };
    } catch (error) {
      logger.error("❌ 오늘 뽑기 횟수 조회 실패:", error);
      return {
        success: false,
        message: error.message,
        data: { count: 0 },
      };
    }
  }

  /**
   * 🔄 카드 덱 셔플
   */
  async shuffleDeck(userId) {
    try {
      return {
        success: true,
        message: this.generateDoomockComment("shuffle", `User${userId}`),
      };
    } catch (error) {
      logger.error("❌ 덱 셔플 오류:", error);
      return {
        success: false,
        message: "카드 셔플 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      const Fortune = this.models.Fortune;
      const today = TimeHelper.format(new Date(), "date");

      const userRecord = await Fortune.findOne({ userId });

      if (!userRecord) {
        return {
          success: false,
          message: "사용자 기록을 찾을 수 없습니다.",
        };
      }

      const recentDays = await this.calculateRecentActivity(userRecord, 7);

      const stats = {
        totalDraws: userRecord.totalDraws,
        todayDraws:
          userRecord.lastDrawDate === today
            ? userRecord.todayDrawCount || 0
            : 0,
        remainingDraws:
          userRecord.lastDrawDate === today
            ? Math.max(
                0,
                this.config.maxDrawsPerDay - (userRecord.todayDrawCount || 0)
              )
            : this.config.maxDrawsPerDay,
        streak: recentDays.streak,
        favoriteType: recentDays.favoriteType,
        accuracy: Math.floor(Math.random() * 20) + 80,
        lastDrawDate: userRecord.lastDrawDate,
        joinDate: userRecord.createdAt,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logger.error("❌ 사용자 통계 조회 실패:", error);
      return {
        success: false,
        message: "통계 조회 중 오류가 발생했습니다.",
        data: null,
      };
    }
  }

  /**
   * 📋 뽑기 기록 조회
   */
  async getDrawHistory(userId, limit = 20) {
    try {
      const Fortune = this.models.Fortune;

      const userRecord = await Fortune.findOne({ userId });

      if (!userRecord) {
        return {
          success: false,
          message: "사용자 기록을 찾을 수 없습니다.",
        };
      }

      const history = userRecord.drawHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit)
        .map((record) => ({
          date: record.date,
          cardName: record.cardName,
          koreanName: record.koreanName,
          isReversed: record.isReversed,
          type: record.drawType,
          comment: record.doomockComment,
          timestamp: record.timestamp,
          cardCount: record.cardCount || 1,
          question: record.question,
        }));

      return {
        success: true,
        data: {
          records: history,
          totalCount: userRecord.drawHistory.length,
          hasMore: userRecord.drawHistory.length > limit,
        },
      };
    } catch (error) {
      logger.error("❌ 뽑기 기록 조회 실패:", error);
      return {
        success: false,
        message: "기록 조회 중 오류가 발생했습니다.",
        data: { records: [] },
      };
    }
  }

  /**
   * 📊 최근 활동 분석
   */
  async calculateRecentActivity(userRecord, days = 7) {
    try {
      const today = new Date();
      const recentRecords = userRecord.drawHistory.filter((record) => {
        const recordDate = new Date(record.timestamp);
        const diffDays = Math.floor(
          (today - recordDate) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= days;
      });

      let streak = 0;
      const dateMap = new Map();

      recentRecords.forEach((record) => {
        const date = record.date;
        if (!dateMap.has(date)) {
          dateMap.set(date, 0);
        }
        dateMap.set(date, dateMap.get(date) + 1);
      });

      const typeCount = {};
      recentRecords.forEach((record) => {
        typeCount[record.drawType] = (typeCount[record.drawType] || 0) + 1;
      });

      const favoriteType = Object.keys(typeCount).reduce(
        (a, b) => (typeCount[a] > typeCount[b] ? a : b),
        "single"
      );

      return {
        streak: Math.min(streak, days),
        favoriteType,
        recentDraws: recentRecords.length,
      };
    } catch (error) {
      logger.warn("⚠️ 최근 활동 분석 실패:", error);
      return {
        streak: 0,
        favoriteType: "single",
        recentDraws: 0,
      };
    }
  }

  /**
   * 💬 두목봇 멘트 생성
   */
  generateDoomockComment(type, userName = "User", cardData = null) {
    const name = userName || "User";

    const messages = {
      draw: [
        `👔 두목: '${name}, 타로가 답을 주었네요!'`,
        `💼 두목: '${name}, 카드의 메시지를 잘 새겨들으세요!'`,
        `☕두목: '${name}, 심호흡하고 카드를 해석해보세요!'`,
        `📊 두목: '${name}, 데이터만큼 정확한 타로의 지혜입니다!'`,
        `🎯 두목: '${name}, 직감을 믿고 받아들이세요!'`,
      ],
      shuffle: [
        `👔 두목: '${name}, 우주의 에너지로 카드를 정화했습니다!'`,
        `💼 두목: '${name}, 새로운 기운이 카드에 깃들었어요!'`,
        `🔄 두목: '${name}, 이제 진정한 메시지를 받을 준비가 되었습니다!'`,
      ],
    };

    // 캘틱 크로스 특별 멘트
    if (cardData && cardData.type === "celtic") {
      const celticMessages = [
        `👔 두목: '${name}, 캘틱 크로스가 완성되었습니다. 깊이 성찰해보세요!'`,
        `💼 두목: '${name}, 10장의 카드가 당신의 길을 비춰줍니다!'`,
        `🔮 두목: '${name}, 고대 켈트의 지혜가 담긴 신성한 배치입니다!'`,
      ];
      return celticMessages[Math.floor(Math.random() * celticMessages.length)];
    }

    const typeMessages = messages[type] || messages.draw;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * 🎴 완전한 타로 덱 초기화 (메이저 22장 + 마이너 56장)
   */
  initializeFullTarotDeck() {
    const deck = [];

    // 🌟 메이저 아르카나 (22장) - 정방향/역방향 가능
    const majorArcana = [
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

    deck.push(...majorArcana);

    // ⚔️ 마이너 아르카나 (56장) - 정방향만
    const suits = [
      { name: "Cups", korean: "컵", emoji: "🏆", element: "물" },
      { name: "Wands", korean: "완드", emoji: "🔥", element: "불" },
      { name: "Swords", korean: "검", emoji: "⚔️", element: "공기" },
      { name: "Pentacles", korean: "펜타클", emoji: "🪙", element: "땅" },
    ];

    suits.forEach((suit, suitIndex) => {
      // 숫자 카드 (Ace + 2-10)
      for (let i = 1; i <= 10; i++) {
        const cardName = i === 1 ? "Ace" : i.toString();
        deck.push({
          id: 100 + suitIndex * 14 + i,
          name: `${cardName} of ${suit.name}`,
          korean: `${suit.korean} ${i === 1 ? "에이스" : i}`,
          emoji: suit.emoji,
          arcana: "minor",
          suit: suit.name,
          suitKorean: suit.korean,
          element: suit.element,
          number: i,
        });
      }

      // 궁정 카드 (Page, Knight, Queen, King)
      const courtCards = [
        { name: "Page", korean: "페이지", emoji: "👤" },
        { name: "Knight", korean: "기사", emoji: "🐎" },
        { name: "Queen", korean: "여왕", emoji: "👑" },
        { name: "King", korean: "왕", emoji: "🤴" },
      ];

      courtCards.forEach((court, courtIndex) => {
        deck.push({
          id: 100 + suitIndex * 14 + 11 + courtIndex,
          name: `${court.name} of ${suit.name}`,
          korean: `${suit.korean} ${court.korean}`,
          emoji: court.emoji,
          arcana: "minor",
          suit: suit.name,
          suitKorean: suit.korean,
          element: suit.element,
          court: court.name,
          courtKorean: court.korean,
        });
      });
    });

    logger.info(
      `🎴 완전한 타로 덱 초기화: ${deck.length}장 (메이저 ${
        majorArcana.length
      }장 + 마이너 ${deck.length - majorArcana.length}장)`
    );

    return deck;
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.debug("🔮 FortuneService 정리 완료");
    } catch (error) {
      logger.error("❌ FortuneService 정리 실패:", error);
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "FortuneService",
      status: "active",
      dbConnected: !!this.models?.Fortune,
      deckSize: this.tarotDeck.length,
      stats: this.stats,
      config: {
        maxDrawsPerDay: this.config.maxDrawsPerDay,
        maxHistoryRecords: this.config.maxHistoryRecords,
      },
    };
  }
}

module.exports = FortuneService;
