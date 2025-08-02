// src/modules/FortuneModule.js - 표준 매개변수 5개 적용 수정

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🔮 FortuneModule - 타로 카드 운세 모듈 (표준 매개변수 적용)
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.fortuneService = null;
    this.userStates = new Map(); // 사용자 질문 입력 상태

    // 전문 타로 설정
    this.config = {
      maxDrawsPerDay: 3,
      fortuneTypes: {
        single: {
          label: "싱글카드",
          emoji: "🃏",
          description: "하나의 카드로 간단한 운세",
        },
        triple: {
          label: "트리플카드",
          emoji: "🔮",
          description: "과거-현재-미래 흐름",
        },
        celtic: {
          label: "무엇이든 물어보세요 (캘틱 크로스)",
          emoji: "✨",
          description: "10장 카드로 완전한 상황 분석",
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
      } else {
        logger.success("🔮 FortuneModule이 FortuneService와 연결됨");
      }

      this.setupActions();
      logger.success("🔮 FortuneModule 초기화 완료 (표준 매개변수 적용)");
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
   * 🔮 메뉴 표시 (표준 매개변수 5개)
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 오늘 뽑은 횟수 확인 (새 FortuneService 호환)
      const todayCount = await this.getTodayDrawCount(userId, userName);

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
   * 🃏 카드 뽑기 (표준 매개변수 5개 - 수정됨!)
   */
  async drawCard(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);
      const chatId = callbackQuery.message.chat.id;

      logger.debug(
        `🎴 drawCard 시작: ${userName}, subAction: ${subAction}, params: ${params}`
      );

      // 일일 제한 확인 (새 FortuneService 호환)
      const todayCount = await this.getTodayDrawCount(userId, userName);
      logger.debug(
        `📅 오늘 뽑기 횟수: ${todayCount}/${this.config.maxDrawsPerDay}`
      );

      if (todayCount >= this.config.maxDrawsPerDay) {
        logger.warn(`⛔ 일일 제한 도달: ${userName}`);
        return {
          type: "daily_limit",
          module: "fortune",
          data: {
            used: todayCount,
            max: this.config.maxDrawsPerDay,
          },
        };
      }

      // 🎯 운세 타입이 지정된 경우 (params에 실제 타입이 들어있음!)
      if (params) {
        const fortuneType = params; // "single", "triple", "celtic"
        logger.debug(`🎯 운세 타입 선택됨: ${fortuneType}`);

        if (!this.config.fortuneTypes[fortuneType]) {
          logger.error(`❌ 잘못된 운세 타입: ${fortuneType}`);
          return {
            type: "error",
            module: "fortune",
            data: { message: "잘못된 운세 타입입니다." },
          };
        }

        // 캘틱 크로스 질문인 경우
        if (fortuneType === "celtic") {
          logger.debug("🔮 캘틱 크로스 질문 모드 시작");
          this.userStates.set(userId, {
            action: "waiting_question",
            messageId: callbackQuery.message.message_id,
            fortuneType: "celtic",
          });

          return {
            type: "question_prompt",
            module: "fortune",
            data: {
              fortuneType: this.config.fortuneTypes.celtic,
              isCeltic: true,
            },
          };
        }

        // 🎬 카드 뽑기 애니메이션 시작
        logger.debug("🎬 카드 뽑기 애니메이션 시작");
        logger.debug("🔍 Bot 객체 디버깅:", {
          hasBot: !!bot,
          botType: typeof bot,
          hasTelegram: !!(bot && bot.telegram),
          botKeys: bot ? Object.keys(bot) : [],
        });

        const animationMessage = await AnimationHelper.performShuffle(
          bot,
          chatId
        );

        // 일반 운세 뽑기 (새 FortuneService 사용)
        logger.debug(`🎴 performDraw 호출 시작: ${userName}, ${fortuneType}`);
        const result = await this.performDraw(
          userId,
          fortuneType,
          null,
          userName
        );

        logger.debug("🎴 performDraw 결과:", {
          success: result?.success,
          hasData: !!result?.data,
          message: result?.message,
          dataKeys: result?.data ? Object.keys(result.data) : [],
        });

        // 🔍 디버깅: 결과 상세 분석
        if (!result) {
          logger.error("❌ performDraw가 null/undefined 반환");
          return {
            type: "error",
            module: "fortune",
            data: { message: "내부 오류: 결과가 반환되지 않았습니다." },
          };
        }

        if (!result.success) {
          logger.error("❌ performDraw 실패:", result);

          // 🎭 실패 애니메이션 표시 (AnimationHelper 활용)
          if (animationMessage) {
            await bot.telegram.editMessageText(
              chatId,
              animationMessage,
              undefined,
              "❌ 카드 뽑기에 실패했습니다\\. 다시 시도해주세요\\.",
              { parse_mode: "MarkdownV2" }
            );
          }

          return {
            type: "error",
            module: "fortune",
            data: {
              message: result.message || "운세를 뽑는 중 오류가 발생했습니다.",
            },
          };
        }

        // ✅ 성공! 성공 애니메이션으로 전환
        if (animationMessage) {
          await bot.telegram.editMessageText(
            chatId,
            animationMessage,
            undefined,
            "✨ 운세 카드 뽑기 완료\\! 결과를 확인하세요\\.",
            { parse_mode: "MarkdownV2" }
          );
        }

        logger.success(`✅ 카드 뽑기 성공: ${userName}, ${fortuneType}`);

        return {
          type: "draw_result",
          module: "fortune",
          data: {
            ...result.data,
            fortuneType: this.config.fortuneTypes[fortuneType],
            remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount - 1),
          },
        };
      }

      // 운세 타입 선택 화면
      logger.debug("🎯 운세 타입 선택 화면 표시");
      return {
        type: "draw_select",
        module: "fortune",
        data: {
          fortuneTypes: this.config.fortuneTypes,
          remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount),
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
   * 🔄 카드 셔플 (표준 매개변수 5개 - 수정됨!)
   */
  async shuffleCards(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);
      const chatId = callbackQuery.message.chat.id;

      logger.debug(`🔄 카드 셔플 시작: ${userName}`);

      // 🎬 셔플 애니메이션 실행
      const animationMessage = await AnimationHelper.performShuffle(
        bot,
        chatId
      );

      // 셔플 처리 (새 FortuneService 호환)
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

      logger.success(`✅ 카드 셔플 완료: ${userName}`);

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          success: result.success,
          message: result.message || "카드 셔플이 완료되었습니다.",
          animationMessageId: animationMessage, // 렌더러에서 활용할 수 있도록
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
   * 📊 통계 표시 (표준 매개변수 5개 - 수정됨!)
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
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
   * 📋 운세 기록 (표준 매개변수 5개 - 수정됨!)
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
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

      // 캘틱 크로스 질문 운세 뽑기
      const isCeltic = userState?.fortuneType === "celtic";
      const userName = "User"; // 메시지에서는 안전한 표시명 사용
      const result = await this.performDraw(
        userId,
        isCeltic ? "celtic" : "single",
        question,
        userName
      );

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
        type: isCeltic ? "celtic_result" : "custom_result",
        module: "fortune",
        data: {
          ...result.data,
          question,
          fortuneType: isCeltic
            ? this.config.fortuneTypes.celtic
            : this.config.fortuneTypes.single,
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

  // ===== 🛠️ 헬퍼 메서드들 (DB 연동 호환 버전) =====

  /**
   * 📅 오늘 뽑기 횟수 조회 (디버깅 강화)
   */
  async getTodayDrawCount(userId) {
    try {
      const userName = "User"; // 안전한 표시명
      if (this.fortuneService) {
        logger.debug(`🔍 getTodayDrawCount 호출: ${userName}`);
        const result = await this.fortuneService.getTodayDrawCount(userId);

        logger.debug("🔍 FortuneService.getTodayDrawCount 응답:", {
          success: result?.success,
          hasData: !!result?.data,
          count: result?.data?.count,
          date: result?.data?.date,
        });

        // 새 FortuneService 응답 형식 처리
        if (result && result.success && result.data) {
          const count = result.data.count || 0;
          logger.debug(`✅ 오늘 뽑기 횟수: ${count}`);
          return count;
        } else {
          logger.warn("FortuneService 응답 형식이 예상과 다름:", result);
          return 0;
        }
      }

      // 더미: 서비스가 없는 경우
      logger.debug("FortuneService 없음 - 더미 데이터 사용");
      return Math.floor(Math.random() * 3);
    } catch (error) {
      logger.error("오늘 뽑기 횟수 조회 실패:", error);
      return 0; // 안전한 기본값
    }
  }

  /**
   * 🎴 실제 운세 뽑기 처리 (디버깅 강화)
   */
  async performDraw(userId, fortuneType, question = null, userName = "User") {
    try {
      logger.debug(
        `🎴 performDraw 시작: ${userName}, ${fortuneType}, question: ${
          question ? "yes" : "no"
        }`
      );

      if (this.fortuneService) {
        logger.debug(`🔗 FortuneService.drawCard 호출 시작`);

        // 새 FortuneService.drawCard() 호출
        const result = await this.fortuneService.drawCard(userId, {
          type: fortuneType,
          question: question,
        });

        logger.debug("🎴 FortuneService.drawCard 상세 응답:", {
          success: result?.success,
          message: result?.message,
          hasData: !!result?.data,
          dataStructure: result?.data
            ? {
                hasCards: !!result.data.cards,
                hasCard: !!result.data.card,
                remainingDraws: result.data.remainingDraws,
                totalDraws: result.data.totalDraws,
                keys: Object.keys(result.data),
              }
            : null,
        });

        // 🔍 서비스 응답 검증
        if (!result) {
          logger.error("❌ FortuneService.drawCard가 null/undefined 반환");
          return this.generateDummyCard(fortuneType, question);
        }

        if (result.success === false) {
          logger.error("❌ FortuneService.drawCard 실패:", result.message);
          // 실패 시에도 더미 카드를 생성해서 사용자 경험 유지
          return this.generateDummyCard(fortuneType, question);
        }

        return result;
      } else {
        // 더미 데이터 생성
        logger.debug("FortuneService 없음 - 더미 카드 생성");
        return this.generateDummyCard(fortuneType, question);
      }
    } catch (error) {
      logger.error("FortuneModule.performDraw 오류:", error);

      // 오류 시 더미 데이터 반환
      logger.warn("오류로 인해 더미 카드 생성");
      return this.generateDummyCard(fortuneType, question);
    }
  }

  /**
   * 🎨 더미 카드 생성 (향상된 버전)
   */
  generateDummyCard(fortuneType, question = null) {
    try {
      logger.debug(`🎨 더미 카드 생성: ${fortuneType}`);

      const cards = [
        {
          id: 1,
          name: "The Fool",
          korean: "바보",
          emoji: "🤡",
          meaning: "새로운 시작과 모험을 의미합니다",
          advice: "용기를 갖고 첫 걸음을 내디디세요",
          suit: "major",
          number: 0,
        },
        {
          id: 2,
          name: "The Magician",
          korean: "마법사",
          emoji: "🎩",
          meaning: "당신의 능력과 의지력을 믿으세요",
          advice: "지금이 행동할 때입니다",
          suit: "major",
          number: 1,
        },
        {
          id: 3,
          name: "The Star",
          korean: "별",
          emoji: "⭐",
          meaning: "희망과 영감이 가득한 시기입니다",
          advice: "긍정적인 마음으로 앞으로 나아가세요",
          suit: "major",
          number: 17,
        },
      ];

      const randomCard = cards[Math.floor(Math.random() * cards.length)];
      const isReversed = Math.random() > 0.7;

      let result = {
        success: true,
        message: `${randomCard.korean} 카드가 나왔습니다!`,
        data: {
          cards: [
            {
              ...randomCard,
              isReversed,
              position: isReversed ? "reversed" : "upright",
            },
          ],
          type: fortuneType,
          date: new Date().toISOString().split("T")[0],
          isDemo: true, // 더미 데이터임을 표시
        },
      };

      if (fortuneType === "triple") {
        result.data.cards = [
          { ...cards[0], position: "past", isReversed: false },
          { ...cards[1], position: "present", isReversed: Math.random() > 0.5 },
          { ...cards[2], position: "future", isReversed: false },
        ];
      } else if (fortuneType === "celtic") {
        // 캘틱 크로스는 10장
        result.data.cards = Array.from({ length: 10 }, (_, i) => ({
          ...cards[i % cards.length],
          position: `position_${i + 1}`,
          order: i + 1,
          isReversed: Math.random() > 0.6,
        }));
      }

      if (question) {
        result.data.question = question;
      }

      logger.debug("✅ 더미 카드 생성 완료:", {
        cardCount: result.data.cards.length,
        type: fortuneType,
        hasQuestion: !!question,
      });

      return result;
    } catch (error) {
      logger.error("더미 카드 생성 실패:", error);
      return {
        success: false,
        message: "카드 생성 중 오류가 발생했습니다.",
        data: { error: error.message },
      };
    }
  }

  /**
   * 📊 사용자 통계 조회
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
   * 📋 뽑기 기록 조회
   */
  async getDrawHistory(userId) {
    try {
      if (this.fortuneService) {
        const result = await this.fortuneService.getDrawHistory(userId);
        return result.success ? result.data.records : [];
      }

      return [
        {
          date: "2025-08-02",
          type: "single",
          card: "The Star",
          result: "긍정적",
        },
      ];
    } catch (error) {
      logger.warn("뽑기 기록 조회 실패:", error);
      return [];
    }
  }

  /**
   * 📊 더미 통계 생성
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
