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

      // 카드가 없으면 에러
      if (!cards || cards.length < 3) {
        throw new Error("사용 가능한 카드가 충분하지 않습니다");
      }

      // 카드 인덱스 배열 생성 (0 ~ cards.length-1)
      const availableIndices = Array.from(
        { length: cards.length },
        (_, i) => i
      );

      // Fisher-Yates 셔플 알고리즘으로 인덱스 섞기
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIndices[i], availableIndices[j]] = [
          availableIndices[j],
          availableIndices[i],
        ];
      }

      // 상위 3개 인덱스로 카드 선택
      const positions = ["past", "present", "future"];

      for (let i = 0; i < 3; i++) {
        const selectedCard = cards[availableIndices[i]];

        // selectedCard가 undefined인 경우 체크
        if (!selectedCard) {
          logger.error(
            `카드 선택 실패: index=${availableIndices[i]}, cards.length=${cards.length}`
          );
          throw new Error("카드를 선택할 수 없습니다");
        }

        const isReversed = Math.random() < 0.5;

        const cardData = {
          cardId: selectedCard.id,
          cardName: selectedCard.name,
          koreanName: selectedCard.koreanName,
          emoji: selectedCard.emoji || "🎴",
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
  // FortuneService.js의 getMajorArcana 메서드를 이걸로 교체하세요!
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
          keywords: ["의지력", "창조", "집중", "능력"],
          message:
            "당신은 원하는 것을 실현할 수 있는 모든 도구를 갖추고 있습니다.",
          advice: "자신의 능력을 믿고 행동으로 옮기세요",
        },
        reversed: {
          keywords: ["조작", "속임수", "혼란", "재능낭비"],
          message: "능력은 있지만 올바르게 사용하지 못하고 있습니다.",
          advice: "목표를 재정립하고 정직하게 행동하세요",
        },
      },
      {
        id: 2,
        name: "The High Priestess",
        koreanName: "여교황",
        emoji: "🔮",
        upright: {
          keywords: ["직관", "신비", "잠재의식", "지혜"],
          message:
            "내면의 목소리에 귀를 기울이세요. 직관이 답을 알고 있습니다.",
          advice: "명상과 성찰을 통해 내면의 지혜를 찾으세요",
        },
        reversed: {
          keywords: ["숨겨진 동기", "단절", "침묵", "비밀"],
          message: "중요한 정보가 숨겨져 있거나 직관을 무시하고 있습니다.",
          advice: "진실을 직시하고 내면과 연결하세요",
        },
      },
      {
        id: 3,
        name: "The Empress",
        koreanName: "여제",
        emoji: "👑",
        upright: {
          keywords: ["풍요", "창조", "모성", "자연"],
          message:
            "창조적 에너지가 넘치는 시기입니다. 새로운 것을 탄생시킬 때입니다.",
          advice: "자신과 타인을 돌보고 창조적 활동을 시작하세요",
        },
        reversed: {
          keywords: ["창조적 막힘", "의존", "무기력", "불임"],
          message: "창조적 에너지가 차단되어 있거나 자기 돌봄이 부족합니다.",
          advice: "자신을 먼저 돌보고 창의성을 되찾으세요",
        },
      },
      {
        id: 4,
        name: "The Emperor",
        koreanName: "황제",
        emoji: "👨‍💼",
        upright: {
          keywords: ["권위", "구조", "통제", "아버지"],
          message:
            "리더십을 발휘하고 질서를 세울 때입니다. 책임감 있게 행동하세요.",
          advice: "계획을 세우고 단호하게 실행하세요",
        },
        reversed: {
          keywords: ["독재", "경직", "통제욕", "무책임"],
          message: "지나친 통제욕이나 권위 남용을 경계해야 합니다.",
          advice: "유연성을 갖추고 타인의 의견을 경청하세요",
        },
      },
      {
        id: 5,
        name: "The Hierophant",
        koreanName: "교황",
        emoji: "⛪",
        upright: {
          keywords: ["전통", "교육", "믿음", "순응"],
          message: "전통적 가치와 교육의 중요성을 깨닫는 시기입니다.",
          advice: "멘토를 찾거나 전통적 지혜를 배우세요",
        },
        reversed: {
          keywords: ["비순응", "새로운 방법", "반항", "자유사상"],
          message: "기존 체제에 의문을 품고 새로운 길을 모색하고 있습니다.",
          advice: "자신만의 진리를 찾되 지혜로운 조언도 들으세요",
        },
      },
      {
        id: 6,
        name: "The Lovers",
        koreanName: "연인들",
        emoji: "💑",
        upright: {
          keywords: ["사랑", "조화", "관계", "선택"],
          message: "중요한 선택의 순간이며, 사랑과 조화가 찾아옵니다.",
          advice: "마음을 따르되 신중하게 선택하세요",
        },
        reversed: {
          keywords: ["불화", "불균형", "잘못된 선택", "유혹"],
          message: "관계의 불균형이나 가치관의 충돌을 경험하고 있습니다.",
          advice: "소통을 통해 균형을 찾고 진정한 가치를 재확인하세요",
        },
      },
      {
        id: 7,
        name: "The Chariot",
        koreanName: "전차",
        emoji: "🏇",
        upright: {
          keywords: ["승리", "의지력", "결단력", "통제"],
          message: "강한 의지로 목표를 향해 전진하면 승리가 기다립니다.",
          advice: "집중력을 유지하고 단호하게 나아가세요",
        },
        reversed: {
          keywords: ["방향상실", "공격성", "무모함", "통제불능"],
          message: "방향을 잃었거나 감정이 통제되지 않고 있습니다.",
          advice: "잠시 멈추고 방향을 재설정하세요",
        },
      },
      {
        id: 8,
        name: "Strength",
        koreanName: "힘",
        emoji: "🦁",
        upright: {
          keywords: ["내면의 힘", "용기", "인내", "자비"],
          message: "부드러운 힘으로 어려움을 극복할 수 있습니다.",
          advice: "인내심을 갖고 자비로운 마음으로 대하세요",
        },
        reversed: {
          keywords: ["자기의심", "나약함", "인내부족", "분노"],
          message: "내면의 힘을 의심하거나 감정 조절에 어려움을 겪고 있습니다.",
          advice: "자신을 믿고 내면의 힘을 회복하세요",
        },
      },
      {
        id: 9,
        name: "The Hermit",
        koreanName: "은둔자",
        emoji: "🏔️",
        upright: {
          keywords: ["내면탐구", "지혜", "고독", "인도"],
          message: "혼자만의 시간을 통해 내면의 지혜를 찾을 때입니다.",
          advice: "명상과 성찰을 통해 진정한 답을 찾으세요",
        },
        reversed: {
          keywords: ["고립", "외로움", "철수", "거부"],
          message: "지나친 고립이나 타인과의 단절을 경험하고 있습니다.",
          advice: "적절한 균형을 찾고 필요시 도움을 구하세요",
        },
      },
      {
        id: 10,
        name: "Wheel of Fortune",
        koreanName: "운명의 수레바퀴",
        emoji: "☸️",
        upright: {
          keywords: ["행운", "순환", "운명", "전환점"],
          message: "운명의 수레바퀴가 당신에게 유리하게 돌고 있습니다.",
          advice: "기회를 잡고 변화를 받아들이세요",
        },
        reversed: {
          keywords: ["불운", "저항", "통제불능", "반복"],
          message: "일시적인 어려움이나 반복되는 패턴에 갇혀 있습니다.",
          advice: "흐름을 받아들이고 교훈을 찾으세요",
        },
      },
      {
        id: 11,
        name: "Justice",
        koreanName: "정의",
        emoji: "⚖️",
        upright: {
          keywords: ["공정", "진실", "인과", "균형"],
          message: "공정한 결과가 나타나고 진실이 밝혀집니다.",
          advice: "정직하고 공정하게 행동하세요",
        },
        reversed: {
          keywords: ["불공정", "부정직", "책임회피", "편견"],
          message: "불공정한 상황이나 진실 왜곡을 경험하고 있습니다.",
          advice: "진실을 직시하고 책임을 받아들이세요",
        },
      },
      {
        id: 12,
        name: "The Hanged Man",
        koreanName: "매달린 사람",
        emoji: "🙃",
        upright: {
          keywords: ["희생", "새로운 관점", "인내", "깨달음"],
          message: "시각을 바꾸면 새로운 깨달음을 얻을 수 있습니다.",
          advice: "다른 관점에서 바라보고 인내하세요",
        },
        reversed: {
          keywords: ["무의미한 희생", "정체", "저항", "지연"],
          message: "불필요한 희생을 하거나 변화를 거부하고 있습니다.",
          advice: "집착을 놓고 새로운 방향을 모색하세요",
        },
      },
      {
        id: 13,
        name: "Death",
        koreanName: "죽음",
        emoji: "💀",
        upright: {
          keywords: ["변화", "종료", "전환", "재생"],
          message: "하나의 장이 끝나고 새로운 시작이 기다립니다.",
          advice: "과거를 놓아주고 변화를 받아들이세요",
        },
        reversed: {
          keywords: ["변화거부", "정체", "두려움", "집착"],
          message: "필요한 변화를 거부하거나 과거에 집착하고 있습니다.",
          advice: "두려움을 극복하고 변화를 수용하세요",
        },
      },
      {
        id: 14,
        name: "Temperance",
        koreanName: "절제",
        emoji: "🏺",
        upright: {
          keywords: ["균형", "중용", "인내", "조화"],
          message: "균형과 조화를 통해 목표를 달성할 수 있습니다.",
          advice: "중용을 지키고 인내심을 갖으세요",
        },
        reversed: {
          keywords: ["불균형", "과잉", "조급함", "충돌"],
          message: "삶의 균형이 깨지고 극단으로 치우치고 있습니다.",
          advice: "균형을 회복하고 조급함을 버리세요",
        },
      },
      {
        id: 15,
        name: "The Devil",
        koreanName: "악마",
        emoji: "😈",
        upright: {
          keywords: ["속박", "집착", "유혹", "물질주의"],
          message:
            "스스로 만든 사슬에 묶여 있습니다. 자유는 당신의 선택입니다.",
          advice: "집착을 놓고 진정한 자유를 찾으세요",
        },
        reversed: {
          keywords: ["해방", "자유", "극복", "각성"],
          message: "속박에서 벗어나 자유를 찾고 있습니다.",
          advice: "계속해서 건강한 선택을 하세요",
        },
      },
      {
        id: 16,
        name: "The Tower",
        koreanName: "탑",
        emoji: "🗼",
        upright: {
          keywords: ["파괴", "혼란", "계시", "해방"],
          message: "갑작스러운 변화가 오지만 이는 필요한 정화입니다.",
          advice: "변화를 받아들이고 새로운 토대를 쌓으세요",
        },
        reversed: {
          keywords: ["변화회피", "재난", "두려움", "연기"],
          message: "필요한 변화를 회피하거나 더 큰 붕괴를 경험합니다.",
          advice: "피할 수 없는 변화를 수용하세요",
        },
      },
      {
        id: 17,
        name: "The Star",
        koreanName: "별",
        emoji: "⭐",
        upright: {
          keywords: ["희망", "영감", "평온", "갱신"],
          message: "어둠 뒤에 빛이 있습니다. 희망을 잃지 마세요.",
          advice: "믿음을 갖고 긍정적인 미래를 그려보세요",
        },
        reversed: {
          keywords: ["절망", "신념상실", "불안", "실망"],
          message: "희망을 잃고 미래에 대한 불안을 느끼고 있습니다.",
          advice: "작은 것에서 희망을 찾고 신념을 회복하세요",
        },
      },
      {
        id: 18,
        name: "The Moon",
        koreanName: "달",
        emoji: "🌙",
        upright: {
          keywords: ["환상", "두려움", "불안", "직관"],
          message: "모든 것이 보이는 대로는 아닙니다. 직관을 신뢰하세요.",
          advice: "두려움을 직시하고 진실을 구별하세요",
        },
        reversed: {
          keywords: ["혼란해소", "진실발견", "극복", "명확성"],
          message: "혼란이 걷히고 진실이 드러나고 있습니다.",
          advice: "명확성을 유지하고 앞으로 나아가세요",
        },
      },
      {
        id: 19,
        name: "The Sun",
        koreanName: "태양",
        emoji: "☀️",
        upright: {
          keywords: ["성공", "활력", "기쁨", "긍정"],
          message: "밝은 에너지가 넘치고 성공이 보장됩니다.",
          advice: "긍정적인 에너지를 나누고 성공을 즐기세요",
        },
        reversed: {
          keywords: ["일시적 좌절", "낙관주의 부족", "지연", "자아도취"],
          message: "일시적인 구름이 태양을 가리고 있습니다.",
          advice: "긍정적인 마인드를 회복하세요",
        },
      },
      {
        id: 20,
        name: "Judgement",
        koreanName: "심판",
        emoji: "🎺",
        upright: {
          keywords: ["심판", "재생", "결정", "각성"],
          message: "과거를 정리하고 새로운 단계로 나아갈 때입니다.",
          advice: "과거를 용서하고 새로운 시작을 준비하세요",
        },
        reversed: {
          keywords: ["자기비판", "의심", "회피", "후회"],
          message: "자기 판단이 너무 가혹하거나 결정을 회피하고 있습니다.",
          advice: "자신을 용서하고 앞으로 나아가세요",
        },
      },
      {
        id: 21,
        name: "The World",
        koreanName: "세계",
        emoji: "🌍",
        upright: {
          keywords: ["완성", "성취", "통합", "여행"],
          message: "한 사이클이 완성되고 새로운 세계가 열립니다.",
          advice: "성취를 축하하고 새로운 모험을 준비하세요",
        },
        reversed: {
          keywords: ["미완성", "지연", "좌절", "막힘"],
          message: "목표 달성이 지연되거나 무언가가 미완성 상태입니다.",
          advice: "부족한 부분을 채우고 완성을 향해 나아가세요",
        },
      },
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
