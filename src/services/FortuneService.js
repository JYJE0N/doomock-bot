// src/services/FortuneService.js - 🔮 Mongoose 연동 완성판

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneService - 타로 카드 서비스 (DB 연동 버전)
 *
 * ✅ 주요 변경사항:
 * - Map 기반 임시 저장소 완전 제거
 * - Fortune 모델(this.models.Fortune)을 사용한 모든 데이터 처리
 * - Mongoose의 find, findOne, findOneAndUpdate 등 활용
 * - 날짜 기반 일일 제한 체크 구현
 * - 사용자별 통계 및 히스토리 관리
 */
class FortuneService extends BaseService {
  constructor(options = {}) {
    super("FortuneService", options);

    // 🎴 타로 카드 덱 (변경 없음)
    this.tarotDeck = this.initializeTarotDeck();

    // ⚙️ 설정 (하루 제한 등)
    this.config = {
      maxDrawsPerDay: 5,
      maxHistoryRecords: 100,
      shuffleCooldown: 60000, // 1분
      ...options.config,
    };

    // 📊 통계 정보
    this.stats = {
      totalDraws: 0,
      todayDraws: 0,
      errors: 0,
      lastUpdate: null,
    };

    logger.info("🔮 FortuneService 생성됨 (DB 연동 버전)");
  }

  /**
   * 🗃️ 필수 DB 모델 지정
   */
  getRequiredModels() {
    return ["Fortune"]; // Fortune 모델만 필요
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    try {
      // DB 연결 확인
      if (!this.models || !this.models.Fortune) {
        throw new Error("Fortune 모델이 연결되지 않았습니다");
      }

      // 인덱스 확인 및 생성 (필요시)
      await this.ensureIndexes();

      // 통계 초기화
      await this.updateStats();

      logger.success("🔮 FortuneService 초기화 완료 (DB 연동)");
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

      // userId 복합 인덱스 확인 (이미 unique 인덱스가 있음)
      // lastDrawDate 인덱스 확인
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
      // 인덱스 생성 실패는 치명적이지 않음
      logger.warn("⚠️ Fortune 인덱스 생성 중 경고:", error.message);
    }
  }

  /**
   * 📊 서비스 통계 업데이트
   */
  async updateStats() {
    try {
      const Fortune = this.models.Fortune;
      const today = TimeHelper.format(new Date(), "date"); // YYYY-MM-DD

      // 전체 사용자 수
      const totalUsers = await Fortune.countDocuments({});

      // 오늘 뽑기한 사용자 수
      const todayUsers = await Fortune.countDocuments({
        lastDrawDate: today,
      });

      // 전체 뽑기 횟수 집계
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
        // 새 사용자 생성
        userRecord = new Fortune({
          userId,
          userName: `User${userId}`, // 기본 이름
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
      // 오늘 첫 뽑기인 경우
      if (userRecord.lastDrawDate !== today) {
        return {
          allowed: true,
          remainingDraws: this.config.maxDrawsPerDay,
          message: "오늘 첫 뽑기입니다!",
        };
      }

      // 오늘 이미 뽑은 경우
      const todayDrawCount = userRecord.todayDrawCount || 0;
      const remainingDraws = this.config.maxDrawsPerDay - todayDrawCount;

      if (remainingDraws <= 0) {
        return {
          allowed: false,
          remainingDraws: 0,
          message: `오늘은 이미 ${this.config.maxDrawsPerDay}번 뽑으셨습니다. 내일 다시 시도해주세요!`,
        };
      }

      return {
        allowed: true,
        remainingDraws,
        message: `오늘 ${remainingDraws}번 더 뽑을 수 있습니다.`,
      };
    } catch (error) {
      logger.error("❌ 일일 제한 체크 실패:", error);
      // 안전한 기본값 반환
      return {
        allowed: true,
        remainingDraws: 1,
        message: "제한 체크 중 오류가 발생했지만 뽑기를 진행합니다.",
      };
    }
  }

  /**
   * 🎴 실제 카드 뽑기 로직
   */
  performCardDraw(type) {
    try {
      const result = {
        type,
        timestamp: new Date(),
        cards: [],
      };

      switch (type) {
        case "single":
          result.cards = [this.drawSingleCard()];
          break;

        case "triple":
          result.cards = [
            { ...this.drawSingleCard(), position: "past" },
            { ...this.drawSingleCard(), position: "present" },
            { ...this.drawSingleCard(), position: "future" },
          ];
          break;

        case "love":
        case "work":
        case "custom":
          result.cards = [this.drawSingleCard()];
          break;

        default:
          result.cards = [this.drawSingleCard()];
      }

      return result;
    } catch (error) {
      logger.error("❌ 카드 뽑기 로직 오류:", error);
      throw error;
    }
  }

  /**
   * 🃏 단일 카드 뽑기
   */
  drawSingleCard() {
    const randomIndex = Math.floor(Math.random() * this.tarotDeck.length);
    const card = { ...this.tarotDeck[randomIndex] };

    // 50% 확률로 역방향
    card.isReversed = Math.random() < 0.5;
    card.drawnAt = new Date();

    return card;
  }

  /**
   * 💾 뽑기 결과 저장
   */
  async saveDrawResult(userRecord, drawResult, options) {
    try {
      const Fortune = this.models.Fortune;
      const { type, question, date } = options;

      // 히스토리 레코드 생성
      const historyRecord = {
        date,
        cardId: drawResult.cards[0].id,
        cardName: drawResult.cards[0].name,
        koreanName: drawResult.cards[0].korean,
        isReversed: drawResult.cards[0].isReversed,
        drawType: type,
        timestamp: new Date(),
        doomockComment: this.generateDoomockComment(
          "draw",
          userRecord.userName,
          drawResult
        ),
      };

      // 3장 뽑기의 경우 첫 번째 카드만 메인으로 저장
      if (type === "triple" && drawResult.cards.length > 1) {
        historyRecord.position = "present"; // 현재 카드를 메인으로
      }

      // 사용자 레코드 업데이트 (원자적 업데이트)
      const updateData = {
        $inc: { totalDraws: 1 },
        $push: {
          drawHistory: {
            $each: [historyRecord],
            $slice: -this.config.maxHistoryRecords, // 최신 N개만 유지
          },
        },
        $set: {
          lastDrawDate: date,
          lastActiveAt: new Date(),
        },
      };

      // 날짜가 바뀐 경우 오늘 카운트 리셋
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
   * 🔄 카드 덱 셔플
   */
  async shuffleDeck(userId) {
    try {
      // 쿨다운 체크 (필요시)
      // ... 쿨다운 로직 구현

      // 실제로는 랜덤이라 의미 없지만 사용자 경험용
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

      // 최근 7일 활동 계산
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
        accuracy: Math.floor(Math.random() * 20) + 80, // 임시 더미 데이터
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

      // 최신 기록부터 정렬하여 제한된 개수만 반환
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
   * 📊 최근 활동 분석 (연속 기록, 선호 타입 등)
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

      // 연속 기록 계산
      let streak = 0;
      const dateMap = new Map();

      recentRecords.forEach((record) => {
        const date = record.date;
        if (!dateMap.has(date)) {
          dateMap.set(date, 0);
        }
        dateMap.set(date, dateMap.get(date) + 1);
      });

      // 선호 타입 계산
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
        `👔 두목: '${name}, 오늘의 카드가 나왔네요!'`,
        `💼 두목: '${name}, 이 카드가 답을 줄 거예요!'`,
        `☕ 두목: '${name}, 커피 마시며 해석해보세요!'`,
        `📊 두목: '${name}, 데이터처럼 정확한 카드네요!'`,
        `🎯 두목: '${name}, 직감을 믿어보세요!'`,
      ],
      shuffle: [
        `👔 두목: '${name}, 카드를 새로 섞었습니다!'`,
        `💼 두목: '${name}, 새로운 기운이 들어왔어요!'`,
        `🔄 두목: '${name}, 운명의 수레바퀴가 돌아갑니다!'`,
      ],
      limit: [
        `👔 두목: '${name}, 오늘은 여기까지입니다!'`,
        `💼 두목: '${name}, 내일 또 뵙겠습니다!'`,
        `☕ 두목: '${name}, 퇴근하고 쉬세요!'`,
      ],
    };

    const typeMessages = messages[type] || messages.draw;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * 🎴 타로 카드 덱 초기화 (변경 없음)
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
        emoji: "⚖️",
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
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      // 캐시 정리 등 필요시 구현
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
      stats: this.stats,
      config: {
        maxDrawsPerDay: this.config.maxDrawsPerDay,
        maxHistoryRecords: this.config.maxHistoryRecords,
      },
    };
  }
}

module.exports = FortuneService;
