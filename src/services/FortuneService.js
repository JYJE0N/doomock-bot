// src/services/FortuneService.js - 개인정보 보호 적용 버전

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { FortuneUser } = require("../database/models/Fortune");
const { getSafeUserName } = require("../utils/UserHelper");

/**
 * 🔮 FortuneService - 개인정보 보호 강화 버전
 *
 * 🛡️ 개인정보 보호 적용:
 * - 사용자 ID 자동 마스킹
 * - 안전한 로깅 시스템
 * - GDPR 준수 데이터 처리
 */
class FortuneService {
  constructor(options = {}) {
    this.config = {
      dailyLimit: 1,
      resetHour: 0,
      enableCache: true,
      cacheTimeout: 300000,

      // 개발자 모드 설정
      devMode: process.env.FORTUNE_DEV_MODE === "true",
      testMode: process.env.NODE_ENV === "development",
      allowUnlimited: process.env.FORTUNE_UNLIMITED === "true",

      ...options.config,
    };

    // 개발자 모드 사용자 목록
    this.devUsers = new Set(
      (process.env.FORTUNE_DEV_USERS || "").split(",").filter(Boolean)
    );

    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // 🛡️ 개인정보 보호 로깅
    if (this.config.devMode) {
      logger.warn("🚨 FortuneService 개발자 모드 활성화됨!");
      // 개발자 사용자 목록은 로깅하지 않음 (개인정보 보호)
      logger.info(`📝 개발자 사용자 수: ${this.devUsers.size}명`);
    }

    logger.info("🔮 FortuneService 초기화됨 (개인정보 보호 적용)");
  }

  /**
   * 🛡️ 안전한 사용자 정보 로깅 헬퍼
   */
  createSafeUserInfo(userId, userName) {
    return {
      from: {
        id: userId,
        first_name: userName,
      },
    };
  }

  /**
   * 🔓 개발자 모드 사용자 확인
   */
  isDevModeUser(userId, userName) {
    if (!this.config.devMode) return false;

    const userIdStr = String(userId);
    const userNameLower = userName ? userName.toLowerCase() : "";

    return (
      this.devUsers.has(userIdStr) ||
      this.devUsers.has(userName) ||
      userNameLower.includes("admin") ||
      userNameLower.includes("dev") ||
      userNameLower.includes("test")
    );
  }

  /**
   * 🛡️ 개인정보 보호 일일 제한 체크
   */
  async canUserDrawToday(userId, userName) {
    const userInfo = this.createSafeUserInfo(userId, userName);

    // 🔓 개발자 모드 체크
    if (this.isDevModeUser(userId, userName)) {
      logger.debug(`🔓 개발자 모드: 제한 우회`, userInfo);
      return true;
    }

    // 🧪 테스트 모드 체크
    if (this.config.testMode || this.config.allowUnlimited) {
      logger.debug(`🧪 테스트 모드: 무제한 뽑기 허용`, userInfo);
      return true;
    }

    // 📅 일반 사용자 일일 제한 체크
    return await FortuneUser.canUserDrawToday(userId);
  }

  /**
   * 🎴 1장 뽑기 (개인정보 보호 적용)
   */
  async drawSingleCard(userId, userName) {
    const userInfo = this.createSafeUserInfo(userId, userName);

    try {
      // 🛡️ 개인정보 보호 로깅
      logger.fortuneLog("1장 뽑기 요청", userInfo);

      // 일일 제한 체크
      const canDraw = await this.canUserDrawToday(userId, userName);
      if (!canDraw) {
        const limitMessage = FortuneUser.getDoomockMessage(
          "dailyLimit",
          userName
        );

        // 🛡️ 제한 로깅 (개인정보 마스킹)
        logger.fortuneLog("일일 제한 도달", userInfo);

        return {
          success: false,
          type: "daily_limit",
          message: limitMessage,
          devHint: this.config.devMode
            ? "💡 개발자 모드를 사용하려면 FORTUNE_DEV_USERS에 사용자 ID를 추가하세요"
            : null,
        };
      }

      // 개발자 모드 로깅
      if (this.isDevModeUser(userId, userName)) {
        logger.success(`🔓 개발자 모드로 뽑기 진행`, userInfo);
      }

      // 셔플링 메시지
      const shuffleMessage = FortuneUser.getDoomockMessage("shuffle", userName);

      // 카드 뽑기
      const cardData = this.drawRandomCard();
      cardData.drawType = "single";

      // 두목의 카드별 특별 멘트
      const doomockComment = FortuneUser.getDoomockMessage(
        "cardSpecific",
        userName,
        cardData
      );

      // 기록 저장 (개발자 모드에서도 저장)
      if (!this.config.devMode || this.config.saveDevRecords !== false) {
        const user = await FortuneUser.findOrCreateUser(userId, userName);
        await user.recordDraw(cardData, userName);
      }

      const endingMessage = FortuneUser.getDoomockMessage("ending", userName);

      // 🛡️ 성공 로깅 (카드 정보는 민감하지 않으므로 포함)
      logger.fortuneLog("1장 뽑기 완료", userInfo, {
        cardName: cardData.cardName,
        isReversed: cardData.isReversed,
      });

      return {
        success: true,
        type: "single_card",
        shuffleMessage,
        card: cardData,
        doomockComment,
        endingMessage,
        nextDrawTime: this.getNextDrawTime(),
        devMode: this.isDevModeUser(userId, userName),
      };
    } catch (error) {
      // 🛡️ 에러 로깅 (개인정보 보호)
      logger.error("❌ 1장 뽑기 실패", {
        user: getSafeUserName(userInfo),
        error: error.message,
      });

      return {
        success: false,
        type: "error",
        message: `👔 두목: '${userName}씨, 시스템 오류가 발생했네요. 잠시 후 다시 시도해주세요.'`,
      };
    }
  }

  /**
   * 🎴🎴🎴 3장 뽑기 (개인정보 보호 적용)
   */
  async draw3Cards(userId, userName) {
    const userInfo = this.createSafeUserInfo(userId, userName);

    // 🚨 타임아웃 추가
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("3장 뽑기 타임아웃")), 10000)
    );

    try {
      // Promise.race로 타임아웃 처리
      return await Promise.race([
        this._performDraw3Cards(userId, userName, userInfo),
        timeout,
      ]);
    } catch (error) {
      logger.error("❌ 3장 뽑기 실패", {
        user: getSafeUserName(userInfo),
        error: error.message,
      });

      return {
        success: false,
        type: "error",
        message: `👔 두목: '${userName}씨, 시스템 오류가 발생했네요. 잠시 후 다시 시도해주세요.'`,
      };
    }
  }

  // 실제 3장 뽑기 로직을 별도 메서드로 분리
  async _performDraw3Cards(userId, userName, userInfo) {
    try {
      logger.fortuneLog("3장 뽑기 요청", userInfo);

      // 일일 제한 체크
      const canDraw = await this.canUserDrawToday(userId, userName);
      if (!canDraw) {
        const limitMessage = FortuneUser.getDoomockMessage(
          "dailyLimit",
          userName
        );
        logger.fortuneLog("일일 제한 도달", userInfo);

        return {
          success: false,
          type: "daily_limit",
          message: limitMessage,
        };
      }

      // 셔플링 메시지
      const shuffleMessage = FortuneUser.getDoomockMessage("shuffle", userName);

      // 🚨 수정: 무한 루프 방지를 위한 안전한 카드 뽑기
      const drawnCards = [];
      const cards = this.getMajorArcana();
      const availableCardIds = cards.map((c) => c.id); // 모든 카드 ID 목록

      // Fisher-Yates 셔플 알고리즘으로 3장 랜덤 선택
      for (let i = availableCardIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCardIds[i], availableCardIds[j]] = [
          availableCardIds[j],
          availableCardIds[i],
        ];
      }

      // 상위 3장 선택
      const selectedCardIds = availableCardIds.slice(0, 3);
      const positions = ["past", "present", "future"];

      for (let i = 0; i < 3; i++) {
        const selectedCard = cards.find((c) => c.id === selectedCardIds[i]);
        const isReversed = Math.random() < 0.5;

        const cardData = {
          cardId: selectedCard.id,
          cardName: selectedCard.name,
          koreanName: selectedCard.koreanName,
          emoji: selectedCard.emoji,
          isReversed,
          interpretation: isReversed
            ? selectedCard.reversed
            : selectedCard.upright,
          drawType: "triple",
          position: positions[i],
        };

        drawnCards.push(cardData);
      }

      // 각 카드 기록 저장 (타임아웃 추가)
      const saveTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB 저장 타임아웃")), 5000)
      );

      const user = await Promise.race([
        FortuneUser.findOrCreateUser(userId, userName),
        saveTimeout,
      ]);

      for (const card of drawnCards) {
        await Promise.race([user.recordDraw(card, userName), saveTimeout]);
      }

      // 3장 종합 해석 생성
      const overallInterpretation = this.generate3CardInterpretation(
        drawnCards,
        userName
      );

      // 🛡️ 성공 로깅
      logger.fortuneLog("3장 뽑기 완료", userInfo, {
        cards: drawnCards.map((c) => c.cardName).join(", "),
      });

      return {
        success: true,
        type: "triple_cards",
        shuffleMessage,
        cards: drawnCards,
        interpretation: overallInterpretation,
        summary: overallInterpretation, // FortuneRenderer가 기대하는 필드 추가
        needsShuffle: true,
        nextDrawTime: this.getNextDrawTime(),
      };
    } catch (error) {
      throw error; // 상위로 에러 전파
    }
  }

  /**
   * 🛡️ 개발자용 특수 기능들 (개인정보 보호 적용)
   */

  /**
   * 🎯 특정 카드 강제 뽑기 (개발/테스트용)
   */
  async drawSpecificCard(userId, userName, cardId, isReversed = false) {
    const userInfo = this.createSafeUserInfo(userId, userName);

    if (!this.isDevModeUser(userId, userName)) {
      logger.warn("🚫 비인가 특정 카드 뽑기 시도", userInfo);
      throw new Error("개발자 모드 전용 기능입니다");
    }

    const cards = this.getMajorArcana();
    const targetCard = cards.find((card) => card.id === cardId);

    if (!targetCard) {
      throw new Error(`카드 ID ${cardId}를 찾을 수 없습니다`);
    }

    const cardData = {
      cardId: targetCard.id,
      cardName: targetCard.name,
      koreanName: targetCard.koreanName,
      emoji: targetCard.emoji,
      isReversed,
      interpretation: isReversed ? targetCard.reversed : targetCard.upright,
      drawType: "dev_specific",
    };

    logger.fortuneLog("개발자 특정 카드 뽑기", userInfo, {
      cardName: cardData.cardName,
      isReversed,
    });

    return {
      success: true,
      type: "dev_specific_card",
      card: cardData,
      devMode: true,
    };
  }

  /**
   * 🔄 사용자 제한 리셋 (개발/테스트용)
   */
  async resetUserLimit(userId, userName) {
    const userInfo = this.createSafeUserInfo(userId, userName);

    if (!this.isDevModeUser(userId, userName)) {
      logger.warn("🚫 비인가 제한 리셋 시도", userInfo);
      throw new Error("개발자 모드 전용 기능입니다");
    }

    try {
      await FortuneUser.updateOne(
        { userId },
        {
          $unset: { lastDrawDate: 1 },
          $set: { canDrawToday: true },
        }
      );

      logger.fortuneLog("일일 제한 리셋", userInfo);
      return { success: true, message: "일일 제한이 리셋되었습니다" };
    } catch (error) {
      logger.error("제한 리셋 실패", {
        user: getSafeUserName(userInfo),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 📊 사용자 통계 조회 (개인정보 보호)
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

      // 🛡️ 통계 조회 로깅 (개인정보 마스킹)
      logger.debug("사용자 통계 조회", {
        userId: logger.safifyUserId(userId),
        totalDraws: user.totalDraws,
      });

      return {
        totalDraws: user.totalDraws,
        currentStreak: user.dailyStats.currentStreak,
        longestStreak: user.dailyStats.longestStreak,
        totalDaysUsed: user.dailyStats.totalDaysUsed,
        favoriteCards: user.preferences.favoriteCards.slice(0, 3),
        lastDrawDate: user.lastDrawDate,
        canDrawToday: user.canDrawToday,
        thisMonthDraws: user.thisMonthDraws,
      };
    } catch (error) {
      logger.error("❌ 사용자 통계 조회 실패", { error: error.message });
      return null;
    }
  }

  // 기존 메서드들 (getMajorArcana, drawRandomCard 등)은 개인정보와 무관하므로 그대로 유지
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
      // ... 나머지 21장의 카드들
    ];
  }

  drawRandomCard() {
    const cards = this.getMajorArcana();
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    const isReversed = Math.random() < 0.5;

    return {
      cardId: randomCard.id,
      cardName: randomCard.name,
      koreanName: randomCard.koreanName,
      emoji: randomCard.emoji,
      isReversed,
      interpretation: isReversed ? randomCard.reversed : randomCard.upright,
    };
  }

  generate3CardInterpretation(cards, userName) {
    const [pastCard, presentCard, futureCard] = cards;

    const summaries = [
      `👔 두목: '${userName}씨, 과거의 ${pastCard.koreanName}가 현재의 ${presentCard.koreanName}로 이어져 미래에 ${futureCard.koreanName}의 결과를 가져올 것 같습니다.'`,
      `👔 두목: '${userName}씨, 전체적으로 보면 좋은 방향으로 흘러가고 있습니다. 특히 ${futureCard.koreanName} 카드가 희망적이에요.'`,
      `👔 두목: '${userName}씨, 과거와 현재를 토대로 볼 때 미래는 충분히 밝다고 봅니다. 준비만 잘 하시면 돼요.'`,
      `👔 두목: '${userName}씨, 이 세 장의 카드가 전하는 메시지를 잘 새겨두시고 업무에 활용해보세요.'`,
    ];

    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  getNextDrawTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      timestamp: tomorrow,
      formatted: TimeHelper.format(tomorrow, "YYYY-MM-DD HH:mm:ss"),
      message: "내일 자정 이후 다시 뽑기 가능",
    };
  }

  getStatus() {
    return {
      serviceName: "FortuneService",
      totalCards: this.getMajorArcana().length,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      dailyLimit: this.config.dailyLimit,
      devMode: this.config.devMode,
      testMode: this.config.testMode,
      devUsersCount: this.devUsers.size, // 숫자만 표시
      privacyProtected: true, // 개인정보 보호 적용됨
    };
  }

  async cleanup() {
    try {
      this.cache.clear();
      this.cacheTimestamps.clear();
      logger.info("✅ FortuneService 정리 완료 (개인정보 보호 적용)");
    } catch (error) {
      logger.error("❌ FortuneService 정리 실패", { error: error.message });
    }
  }
}

module.exports = FortuneService;
