// src/modules/FortuneModule.js - 에러 처리 개선 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🔮 FortuneModule - 타로 카드 운세 모듈 (안전한 버전)
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.fortuneService = null;
    this.userStates = new Map(); // 사용자 질문 입력 상태

    // 간단한 설정
    this.config = {
      maxDrawsPerDay: 5, // 하루 최대 5번
      fortuneTypes: {
        single: {
          label: "원카드",
          emoji: "🃏",
          description: "하나의 카드로 오늘의 운세",
        },
        triple: {
          label: "삼카드",
          emoji: "🔮",
          description: "과거-현재-미래 흐름",
        },
        love: {
          label: "연애운",
          emoji: "💕",
          description: "연애와 사랑에 관한 운세",
        },
        work: {
          label: "사업운",
          emoji: "💼",
          description: "일과 사업에 관한 운세",
        },
        custom: {
          label: "질문운",
          emoji: "❓",
          description: "궁금한 것을 직접 질문",
        },
      },
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      this.fortuneService = await this.serviceBuilder.getOrCreate("fortune");

      if (!this.fortuneService) {
        logger.warn("FortuneService 없음 - 더미 모드로 동작");
      }

      this.setupActions();
      logger.success("🔮 FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("FortuneModule 초기화 실패:", error);
      // 서비스 없이도 동작하도록 함
      this.setupActions();
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("draw", this.drawCard.bind(this));
    this.actionMap.set("shuffle", this.shuffleCards.bind(this));
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
  }

  /**
   * 🔮 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 오늘 뽑은 횟수 확인 (안전하게)
      const todayCount = await this.getTodayDrawCount(userId);

      return {
        type: "menu",
        module: "fortune",
        data: {
          userId,
          userName,
          todayCount,
          maxDraws: this.config.maxDrawsPerDay,
          canDraw: todayCount < this.config.maxDrawsPerDay,
          fortuneTypes: this.config.fortuneTypes,
        },
      };
    } catch (error) {
      logger.error("FortuneModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "메뉴를 불러오는 중 오류가 발생했습니다." },
      };
    }
  }

  /**
   * 🃏 카드 뽑기 (안전한 버전)
   */
  async drawCard(bot, callbackQuery, params) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 일일 제한 확인 (안전하게)
      let todayCount;
      try {
        todayCount = await this.getTodayDrawCount(userId);
      } catch (error) {
        logger.warn("오늘 뽑기 횟수 조회 실패, 기본값 사용:", error);
        todayCount = 0; // 안전한 기본값
      }

      if (todayCount >= this.config.maxDrawsPerDay) {
        return {
          type: "daily_limit",
          module: "fortune",
          data: {
            used: todayCount,
            max: this.config.maxDrawsPerDay,
          },
        };
      }

      // 운세 타입이 지정된 경우
      if (params) {
        const fortuneType = params;

        if (!this.config.fortuneTypes[fortuneType]) {
          return {
            type: "error",
            module: "fortune",
            data: { message: "잘못된 운세 타입입니다." },
          };
        }

        // 커스텀 질문인 경우
        if (fortuneType === "custom") {
          this.userStates.set(userId, {
            action: "waiting_question",
            messageId: callbackQuery.message.message_id,
          });

          return {
            type: "question_prompt",
            module: "fortune",
            data: { fortuneType },
          };
        }

        // 일반 운세 뽑기 (안전하게)
        const result = await this.performDraw(userId, fortuneType);

        if (!result.success) {
          return {
            type: "error",
            module: "fortune",
            data: {
              message: result.message || "운세를 뽑는 중 오류가 발생했습니다.",
            },
          };
        }

        return {
          type: "draw_result",
          module: "fortune",
          data: {
            ...result.data,
            fortuneType: this.config.fortuneTypes[fortuneType],
            remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount - 1), // 음수 방지
          },
        };
      }

      // 운세 타입 선택 화면
      return {
        type: "draw_select",
        module: "fortune",
        data: {
          fortuneTypes: this.config.fortuneTypes,
          remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount), // 음수 방지
        },
      };
    } catch (error) {
      logger.error("FortuneModule.drawCard 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "카드 뽑기 중 오류가 발생했습니다." },
      };
    }
  }

  /**
   * 🔄 카드 셔플
   */
  async shuffleCards(bot, callbackQuery, params) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 셔플 처리 (안전하게)
      let result;
      try {
        result = this.fortuneService
          ? await this.fortuneService.shuffleDeck(userId)
          : {
              success: true,
              message: "카드를 섞어서 새로운 기운을 불어넣었습니다!",
            };
      } catch (error) {
        logger.warn("셔플 서비스 호출 실패, 더미 응답 사용:", error);
        result = {
          success: true,
          message: "카드를 섞어서 새로운 기운을 불어넣었습니다!",
        };
      }

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          success: result.success,
          message: result.message || "카드 셔플이 완료되었습니다.",
        },
      };
    } catch (error) {
      logger.error("FortuneModule.shuffleCards 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "카드 셔플 중 오류가 발생했습니다." },
      };
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      const stats = await this.getUserStats(userId);

      return {
        type: "stats",
        module: "fortune",
        data: {
          userName,
          stats,
        },
      };
    } catch (error) {
      logger.error("FortuneModule.showStats 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "통계를 불러오는 중 오류가 발생했습니다." },
      };
    }
  }

  /**
   * 📋 운세 기록
   */
  async showHistory(bot, callbackQuery, params) {
    try {
      const userId = getUserId(callbackQuery.from);

      const history = await this.getDrawHistory(userId);

      return {
        type: "history",
        module: "fortune",
        data: {
          history,
          totalCount: history.length,
        },
      };
    } catch (error) {
      logger.error("FortuneModule.showHistory 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "기록을 불러오는 중 오류가 발생했습니다." },
      };
    }
  }

  /**
   * 💬 메시지 처리 (커스텀 질문 입력)
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg.from);
      const userState = this.userStates.get(userId);

      if (!userState || userState.action !== "waiting_question") {
        return; // 이 모듈에서 처리할 메시지가 아님
      }

      const question = msg.text?.trim();

      if (!question) {
        return {
          type: "question_error",
          module: "fortune",
          data: { message: "질문을 입력해주세요." },
        };
      }

      if (question.length > 100) {
        return {
          type: "question_error",
          module: "fortune",
          data: { message: "질문이 너무 깁니다. (최대 100자)" },
        };
      }

      // 커스텀 운세 뽑기
      const result = await this.performDraw(userId, "custom", question);

      // 상태 초기화
      this.userStates.delete(userId);

      if (!result.success) {
        return {
          type: "error",
          module: "fortune",
          data: {
            message:
              result.message || "질문 운세를 뽑는 중 오류가 발생했습니다.",
          },
        };
      }

      return {
        type: "custom_result",
        module: "fortune",
        data: {
          ...result.data,
          question,
          fortuneType: this.config.fortuneTypes.custom,
        },
      };
    } catch (error) {
      logger.error("FortuneModule.onHandleMessage 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "메시지 처리 중 오류가 발생했습니다." },
      };
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 (안전한 버전) =====

  /**
   * 실제 운세 뽑기 처리 (안전한 버전)
   */
  async performDraw(userId, fortuneType, question = null) {
    try {
      let result;

      if (this.fortuneService) {
        // 실제 서비스 사용
        try {
          result = await this.fortuneService.drawCard(userId, {
            type: fortuneType,
            question: question,
          });
        } catch (serviceError) {
          logger.warn(
            "FortuneService 호출 실패, 더미 데이터 사용:",
            serviceError
          );
          result = this.generateDummyCard(fortuneType, question);
        }
      } else {
        // 더미 데이터 생성
        result = this.generateDummyCard(fortuneType, question);
      }

      if (result && result.success) {
        // 뽑기 기록 저장 (안전하게)
        try {
          await this.recordDraw(userId, fortuneType, result.data);
        } catch (recordError) {
          logger.warn("뽑기 기록 저장 실패:", recordError);
          // 기록 저장 실패해도 운세 결과는 반환
        }
      }

      return (
        result || {
          success: false,
          message: "운세를 뽑는 중 문제가 발생했습니다.",
        }
      );
    } catch (error) {
      logger.error("FortuneModule.performDraw 오류:", error);
      return {
        success: false,
        message: "운세를 뽑는 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 더미 카드 생성 (안전한 버전)
   */
  generateDummyCard(fortuneType, question = null) {
    try {
      const cards = [
        {
          name: "The Fool",
          korean: "바보",
          emoji: "🤡",
          meaning: "새로운 시작을 의미합니다",
          advice: "용기를 갖고 첫 걸음을 내디디세요",
        },
        {
          name: "The Magician",
          korean: "마법사",
          emoji: "🎩",
          meaning: "당신의 능력을 믿고 실행하세요",
          advice: "지금이 행동할 때입니다",
        },
        {
          name: "The Star",
          korean: "별",
          emoji: "⭐",
          meaning: "희망과 영감이 가득한 시기입니다",
          advice: "긍정적인 마음으로 앞으로 나아가세요",
        },
        {
          name: "The Sun",
          korean: "태양",
          emoji: "☀️",
          meaning: "성공과 행복이 찾아올 것입니다",
          advice: "자신감을 갖고 당당하게 행동하세요",
        },
        {
          name: "The Moon",
          korean: "달",
          emoji: "🌙",
          meaning: "직감을 믿고 신중하게 행동하세요",
          advice: "숨겨진 진실을 찾아보세요",
        },
      ];

      const randomCard = cards[Math.floor(Math.random() * cards.length)];
      const isReversed = Math.random() > 0.7; // 30% 확률로 역방향

      let result = {
        success: true,
        data: {
          card: {
            ...randomCard,
            isReversed,
            position: isReversed ? "reversed" : "upright",
          },
          date: new Date().toISOString().split("T")[0],
        },
      };

      // 삼카드인 경우
      if (fortuneType === "triple") {
        result.data.cards = [
          {
            ...randomCard,
            position: "past",
            meaning: "과거의 경험이 지혜가 됩니다",
          },
          {
            ...cards[1],
            position: "present",
            meaning: "현재 상황을 받아들이세요",
          },
          {
            ...cards[2],
            position: "future",
            meaning: "밝은 미래가 기다리고 있습니다",
          },
        ];
        delete result.data.card;
      }

      return result;
    } catch (error) {
      logger.error("더미 카드 생성 실패:", error);
      return {
        success: false,
        message: "카드 생성 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 오늘 뽑은 횟수 조회 (안전한 버전)
   */
  async getTodayDrawCount(userId) {
    try {
      if (this.fortuneService) {
        const result = await this.fortuneService.getTodayDrawCount(userId);
        return result.success ? result.data.count : 0;
      }

      // 더미: 랜덤 횟수 (0-2) - 테스트 가능하도록
      return Math.floor(Math.random() * 3);
    } catch (error) {
      logger.warn("오늘 뽑기 횟수 조회 실패:", error);
      return 0; // 안전한 기본값
    }
  }

  /**
   * 사용자 통계 조회 (안전한 버전)
   */
  async getUserStats(userId) {
    try {
      if (this.fortuneService) {
        const result = await this.fortuneService.getUserStats(userId);
        return result.success ? result.data : this.generateDummyStats();
      }

      return this.generateDummyStats();
    } catch (error) {
      logger.warn("사용자 통계 조회 실패:", error);
      return this.generateDummyStats();
    }
  }

  /**
   * 더미 통계 생성 (안전한 버전)
   */
  generateDummyStats() {
    return {
      totalDraws: Math.floor(Math.random() * 50) + 10,
      todayDraws: Math.floor(Math.random() * 3),
      favoriteType: "single",
      streak: Math.floor(Math.random() * 7) + 1,
      accuracy: Math.floor(Math.random() * 20) + 80,
    };
  }

  /**
   * 뽑기 기록 조회 (안전한 버전)
   */
  async getDrawHistory(userId) {
    try {
      if (this.fortuneService) {
        const result = await this.fortuneService.getDrawHistory(userId);
        return result.success ? result.data.records : [];
      }

      // 더미 기록
      return [
        {
          date: "2024-12-01",
          type: "single",
          card: "The Star",
          result: "긍정적",
        },
        { date: "2024-11-30", type: "love", card: "The Sun", result: "좋음" },
        {
          date: "2024-11-29",
          type: "work",
          card: "The Magician",
          result: "성공",
        },
      ];
    } catch (error) {
      logger.warn("뽑기 기록 조회 실패:", error);
      return []; // 빈 배열 반환
    }
  }

  /**
   * 뽑기 기록 저장 (안전한 버전)
   */
  async recordDraw(userId, fortuneType, cardData) {
    try {
      if (this.fortuneService) {
        await this.fortuneService.recordDraw(userId, {
          type: fortuneType,
          card: cardData.card || cardData.cards,
          date: new Date(),
        });
      }

      // 더미 모드에서는 기록하지 않음
    } catch (error) {
      logger.warn("뽑기 기록 저장 실패:", error);
      // 에러를 던지지 않고 로그만 남김
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.userStates.clear();
      logger.debug("🔮 FortuneModule 정리 완료");
    } catch (error) {
      logger.error("FortuneModule 정리 실패:", error);
    }
  }
}

module.exports = FortuneModule;
