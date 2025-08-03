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
          description: "하나의 카드로 간단한 운세"
        },
        triple: {
          label: "트리플카드",
          emoji: "🔮",
          description: "과거-현재-미래 흐름"
        },
        celtic: {
          label: "무엇이든 물어보세요 (캘틱 크로스)",
          emoji: "✨",
          description: "10장 카드로 완전한 상황 분석"
        }
      }
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
    this.actionMap.set("celtic_detail", this.showCelticDetail.bind(this));
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
          fortuneTypes: this.config.fortuneTypes
        }
      };
    } catch (error) {
      logger.error("FortuneModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "메뉴를 불러오는 중 오류가 발생했습니다." }
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

      logger.debug(`🎴 drawCard 시작: ${userName}, subAction: ${subAction}, params: ${params}`);

      // ✅ 추가: Bot 객체 상세 디버깅
      logger.debug("🔍 Bot 객체 상세 분석:", {
        // 기본 정보
        hasBot: !!bot,
        botType: typeof bot,
        botConstructor: bot ? bot.constructor.name : null,

        // 직접적인 telegram 접근
        hasTelegram: !!(bot && bot.telegram),
        telegramType: bot && bot.telegram ? typeof bot.telegram : null,

        // 중첩된 구조 체크
        hasBotBot: !!(bot && bot.bot),
        hasBotBotTelegram: !!(bot && bot.bot && bot.bot.telegram),

        // 메서드 존재 체크
        hasSendMessage: !!(bot && bot.telegram && typeof bot.telegram.sendMessage === "function"),
        hasEditMessage: !!(bot && bot.telegram && typeof bot.telegram.editMessageText === "function"),

        // 키 목록 (상위 5개만)
        botKeys: bot ? Object.keys(bot).slice(0, 5) : [],
        telegramKeys: bot && bot.telegram ? Object.keys(bot.telegram).slice(0, 5) : []
      });

      // 일일 제한 확인
      const todayCount = await this.getTodayDrawCount(userId, userName);
      logger.debug(`📅 오늘 뽑기 횟수: ${todayCount}/${this.config.maxDrawsPerDay}`);

      if (todayCount >= this.config.maxDrawsPerDay) {
        logger.warn(`⛔ 일일 제한 도달: ${userName}`);
        return {
          type: "daily_limit",
          module: "fortune",
          data: { used: todayCount, max: this.config.maxDrawsPerDay }
        };
      }

      // 운세 타입이 지정된 경우
      if (params) {
        const fortuneType = params;
        logger.debug(`🎯 운세 타입 선택됨: ${fortuneType}`);

        if (!this.config.fortuneTypes[fortuneType]) {
          logger.error(`❌ 잘못된 운세 타입: ${fortuneType}`);
          return {
            type: "error",
            module: "fortune",
            data: { message: "잘못된 운세 타입입니다." }
          };
        }

        // 캘틱 크로스 질문인 경우
        if (fortuneType === "celtic") {
          logger.debug("🔮 캘틱 크로스 질문 모드 시작");
          this.userStates.set(userId, {
            action: "waiting_question",
            messageId: callbackQuery.message.message_id,
            fortuneType: "celtic"
          });

          return {
            type: "question_prompt",
            module: "fortune",
            data: {
              fortuneType: this.config.fortuneTypes.celtic,
              isCeltic: true
            }
          };
        }

        // 🎬 카드 뽑기 애니메이션 시작
        logger.debug("🎬 카드 뽑기 애니메이션 시작");

        // ✅ 수정: Bot 객체 null 체크 및 대안 처리
        let animationMessage = null;

        if (!bot) {
          logger.error("❌ Bot 객체가 null/undefined - 애니메이션 없이 진행");
        } else {
          try {
            logger.debug("🎬 AnimationHelper 호출 시도");
            animationMessage = await AnimationHelper.performShuffle(bot, chatId);

            if (animationMessage === "animation_skipped" || animationMessage === "animation_error") {
              logger.warn("⚠️ 애니메이션이 스킵되었지만 계속 진행");
              animationMessage = null;
            } else {
              logger.debug("✅ 애니메이션 성공:", animationMessage);
            }
          } catch (animationError) {
            logger.error("❌ 애니메이션 실행 중 오류 (계속 진행):", animationError.message);
            animationMessage = null;
          }
        }

        // 일반 운세 뽑기 (애니메이션 실패와 관계없이 진행)
        logger.debug(`🎴 performDraw 호출 시작: ${userName}, ${fortuneType}`);
        const result = await this.performDraw(userId, fortuneType, null, userName);

        // 결과 검증
        if (!result) {
          logger.error("❌ performDraw가 null/undefined 반환");

          // 실패 애니메이션 표시 (bot 객체가 있는 경우만)
          if (animationMessage && bot && bot.telegram) {
            try {
              await bot.telegram.editMessageText(
                chatId,
                animationMessage,
                undefined,
                "❌ 카드 뽑기에 실패했습니다\\. 다시 시도해주세요\\.",
                { parse_mode: "MarkdownV2" }
              );
            } catch (editError) {
              logger.warn("실패 메시지 수정 실패:", editError.message);
            }
          }

          return {
            type: "error",
            module: "fortune",
            data: { message: "내부 오류: 결과가 반환되지 않았습니다." }
          };
        }

        if (!result.success) {
          logger.error("❌ performDraw 실패:", result);

          // 실패 애니메이션 표시 (bot 객체가 있는 경우만)
          if (animationMessage && bot && bot.telegram) {
            try {
              await bot.telegram.editMessageText(
                chatId,
                animationMessage,
                undefined,
                "❌ 카드 뽑기에 실패했습니다\\. 다시 시도해주세요\\.",
                { parse_mode: "MarkdownV2" }
              );
            } catch (editError) {
              logger.warn("실패 메시지 수정 실패:", editError.message);
            }
          }

          return {
            type: "error",
            module: "fortune",
            data: {
              message: result.message || "운세를 뽑는 중 오류가 발생했습니다."
            }
          };
        }

        // ✅ 성공! 성공 애니메이션으로 전환 (bot 객체가 있는 경우만)
        if (animationMessage && bot && bot.telegram) {
          try {
            await bot.telegram.editMessageText(chatId, animationMessage, undefined, "✨ 운세 카드 뽑기 완료\\! 결과를 확인하세요\\.", {
              parse_mode: "MarkdownV2"
            });
          } catch (editError) {
            logger.warn("성공 메시지 수정 실패:", editError.message);
          }
        }

        logger.success(`✅ 카드 뽑기 성공: ${userName}, ${fortuneType}`);

        return {
          type: "draw_result",
          module: "fortune",
          data: {
            ...result.data,
            fortuneType: this.config.fortuneTypes[fortuneType],
            remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount - 1)
          }
        };
      }

      // 운세 타입 선택 화면
      logger.debug("🎯 운세 타입 선택 화면 표시");
      return {
        type: "draw_select",
        module: "fortune",
        data: {
          fortuneTypes: this.config.fortuneTypes,
          remaining: Math.max(0, this.config.maxDrawsPerDay - todayCount)
        }
      };
    } catch (error) {
      logger.error("FortuneModule.drawCard 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "카드 뽑기 중 오류가 발생했습니다." }
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
      const animationMessage = await AnimationHelper.performShuffle(bot, chatId);

      // 셔플 처리 (새 FortuneService 호환)
      let result;
      try {
        result = this.fortuneService
          ? await this.fortuneService.shuffleDeck(userId)
          : {
              success: true,
              message: "카드를 섞어서 새로운 기운을 불어넣었습니다!"
            };
      } catch (error) {
        logger.warn("셔플 서비스 호출 실패, 더미 응답 사용:", error);
        result = {
          success: true,
          message: "카드를 섞어서 새로운 기운을 불어넣었습니다!"
        };
      }

      logger.success(`✅ 카드 셔플 완료: ${userName}`);

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          success: result.success,
          message: result.message || "카드 셔플이 완료되었습니다.",
          animationMessageId: animationMessage // 렌더러에서 활용할 수 있도록
        }
      };
    } catch (error) {
      logger.error("FortuneModule.shuffleCards 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "카드 셔플 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 🔮 캘틱 크로스 상세 해석 (표준 매개변수 5개)
   */
  async showCelticDetail(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.debug(`🔮 캘틱 크로스 상세 해석 요청: ${userName}, params: ${params}`);

      // 최근 캘틱 크로스 결과 조회 시도
      let lastCelticResult = null;

      try {
        if (this.fortuneService) {
          const historyResult = await this.fortuneService.getDrawHistory(userId);
          if (historyResult.success && historyResult.data.records) {
            // 가장 최근의 캘틱 크로스 찾기
            const celticRecord = historyResult.data.records
              .filter((record) => record.drawType === "celtic")
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

            if (celticRecord && celticRecord.timestamp) {
              const timeDiff = Date.now() - new Date(celticRecord.timestamp).getTime();
              // 1시간 이내의 최근 결과만 사용
              if (timeDiff < 60 * 60 * 1000) {
                lastCelticResult = celticRecord;
                logger.debug("✅ 최근 캘틱 크로스 결과 발견");
              }
            }
          }
        }
      } catch (error) {
        logger.warn("최근 캘틱 크로스 조회 실패:", error.message);
      }

      // 최근 결과가 없으면 더미 데이터 생성
      if (!lastCelticResult) {
        logger.debug("🎨 더미 캘틱 크로스 상세 해석 생성");

        return {
          type: "celtic_detail",
          module: "fortune",
          data: {
            userName,
            question: "내 인생의 방향은 무엇인가요?",
            cards: this.generateDummyCelticCards(),
            detailedInterpretation: this.generateDetailedInterpretation(),
            overallMessage: "현재 상황을 잘 이해하고 있으며, 앞으로의 방향이 밝습니다.",
            isDemo: true
          }
        };
      }

      // 실제 데이터가 있는 경우 상세 해석 생성
      return {
        type: "celtic_detail",
        module: "fortune",
        data: {
          userName,
          question: lastCelticResult.question || "질문 없음",
          cards: lastCelticResult.cards || [],
          detailedInterpretation: this.generateDetailedInterpretation(lastCelticResult.cards),
          overallMessage: this.generateOverallMessage(lastCelticResult.cards),
          timestamp: lastCelticResult.timestamp
        }
      };
    } catch (error) {
      logger.error("FortuneModule.showCelticDetail 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "상세 해석을 불러오는 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 🎨 더미 캘틱 크로스 카드 생성
   */
  generateDummyCelticCards() {
    const positions = [
      {
        key: "present",
        name: "현재 상황",
        description: "지금 당신이 처한 상황"
      },
      {
        key: "challenge",
        name: "도전/장애물",
        description: "극복해야 할 문제나 도전"
      },
      { key: "past", name: "원인/과거", description: "현재 상황의 근본 원인" },
      {
        key: "future",
        name: "가능한 미래",
        description: "현재 방향으로 갈 때의 미래"
      },
      {
        key: "conscious",
        name: "의식적 접근",
        description: "당신이 의식적으로 취하는 접근법"
      },
      {
        key: "unconscious",
        name: "무의식적 영향",
        description: "무의식적으로 작용하는 요소들"
      },
      {
        key: "approach",
        name: "당신의 접근법",
        description: "취해야 할 행동 방향"
      },
      {
        key: "environment",
        name: "외부 환경",
        description: "주변 환경과 타인의 영향"
      },
      {
        key: "hopes_fears",
        name: "희망과 두려움",
        description: "내면의 기대와 걱정"
      },
      {
        key: "outcome",
        name: "최종 결과",
        description: "모든 요소를 고려한 최종 결과"
      }
    ];

    const dummyCards = [
      { id: 0, name: "The Fool", korean: "바보", emoji: "🤡", arcana: "major" },
      {
        id: 1,
        name: "The Magician",
        korean: "마법사",
        emoji: "🎩",
        arcana: "major"
      },
      {
        id: 2,
        name: "The High Priestess",
        korean: "여교황",
        emoji: "👩‍⚕️",
        arcana: "major"
      },
      { id: 17, name: "The Star", korean: "별", emoji: "⭐", arcana: "major" },
      { id: 19, name: "The Sun", korean: "태양", emoji: "☀️", arcana: "major" },
      {
        id: 21,
        name: "The World",
        korean: "세계",
        emoji: "🌍",
        arcana: "major"
      },
      {
        id: 6,
        name: "The Lovers",
        korean: "연인",
        emoji: "💕",
        arcana: "major"
      },
      { id: 8, name: "Strength", korean: "힘", emoji: "💪", arcana: "major" },
      { id: 11, name: "Justice", korean: "정의", emoji: "⚖️", arcana: "major" },
      {
        id: 14,
        name: "Temperance",
        korean: "절제",
        emoji: "🧘",
        arcana: "major"
      }
    ];

    return positions.map((position, index) => ({
      ...dummyCards[index],
      position: position.key,
      positionName: position.name,
      positionDescription: position.description,
      order: index + 1,
      isReversed: Math.random() > 0.7 // 30% 확률로 역방향
    }));
  }

  /**
   * 📖 상세 해석 생성
   */
  generateDetailedInterpretation(cards = null) {
    return {
      section1: {
        title: "현재 상황 분석 (1-3번 카드)",
        content: "현재 상황은 새로운 시작의 기운이 강합니다. 도전해야 할 과제가 있지만, 과거의 경험이 든든한 밑바탕이 되어주고 있습니다."
      },
      section2: {
        title: "미래 전망 (4-6번 카드)",
        content: "미래는 밝은 전망을 보여줍니다. 의식적인 노력과 무의식적인 직감이 조화를 이루어 좋은 결과를 가져올 것입니다."
      },
      section3: {
        title: "실행 가이드 (7-10번 카드)",
        content: "적극적으로 행동하되, 주변 환경을 잘 살피세요. 내면의 희망을 믿고 나아간다면 원하는 목표를 달성할 수 있을 것입니다."
      }
    };
  }

  /**
   * 💫 종합 메시지 생성
   */
  generateOverallMessage(cards = null) {
    const messages = [
      "전체적으로 긍정적인 흐름을 보여줍니다. 현재의 방향을 믿고 계속 나아가세요.",
      "변화의 시기입니다. 새로운 기회를 놓치지 마시고 과감하게 도전해보세요.",
      "균형과 조화가 중요한 시기입니다. 감정과 이성, 행동과 사고의 균형을 맞춰보세요.",
      "내면의 목소리에 귀 기울일 때입니다. 직감을 믿고 올바른 선택을 하세요."
    ];

    return messages[Math.floor(Math.random() * messages.length)];
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
          stats
        }
      };
    } catch (error) {
      logger.error("FortuneModule.showStats 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "통계를 불러오는 중 오류가 발생했습니다." }
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
          totalCount: history.length
        }
      };
    } catch (error) {
      logger.error("FortuneModule.showHistory 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "기록을 불러오는 중 오류가 발생했습니다." }
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
          data: { message: "질문을 입력해주세요." }
        };
      }

      if (question.length > 100) {
        return {
          type: "question_error",
          module: "fortune",
          data: { message: "질문이 너무 깁니다. (최대 100자)" }
        };
      }

      // 캘틱 크로스 질문 운세 뽑기
      const isCeltic = userState?.fortuneType === "celtic";
      const userName = "User"; // 메시지에서는 안전한 표시명 사용
      const result = await this.performDraw(userId, isCeltic ? "celtic" : "single", question, userName);

      // 상태 초기화
      this.userStates.delete(userId);

      if (!result.success) {
        return {
          type: "error",
          module: "fortune",
          data: {
            message: result.message || "질문 운세를 뽑는 중 오류가 발생했습니다."
          }
        };
      }

      return {
        type: isCeltic ? "celtic_result" : "custom_result",
        module: "fortune",
        data: {
          ...result.data,
          question,
          fortuneType: isCeltic ? this.config.fortuneTypes.celtic : this.config.fortuneTypes.single
        }
      };
    } catch (error) {
      logger.error("FortuneModule.onHandleMessage 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "메시지 처리 중 오류가 발생했습니다." }
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
          date: result?.data?.date
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
      logger.debug(`🎴 performDraw 시작: ${userName}, ${fortuneType}, question: ${question ? "yes" : "no"}`);

      if (this.fortuneService) {
        logger.debug(`🔗 FortuneService.drawCard 호출 시작`);

        // 새 FortuneService.drawCard() 호출
        const result = await this.fortuneService.drawCard(userId, {
          type: fortuneType,
          question: question
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
                keys: Object.keys(result.data)
              }
            : null
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

      // ✅ 수정: 더 많은 카드로 중복 방지
      const allCards = [
        {
          id: 0,
          name: "The Fool",
          korean: "바보",
          emoji: "🤡",
          arcana: "major",
          number: 0
        },
        {
          id: 1,
          name: "The Magician",
          korean: "마법사",
          emoji: "🎩",
          arcana: "major",
          number: 1
        },
        {
          id: 2,
          name: "The High Priestess",
          korean: "여교황",
          emoji: "👩‍⚕️",
          arcana: "major",
          number: 2
        },
        {
          id: 3,
          name: "The Empress",
          korean: "황후",
          emoji: "👸",
          arcana: "major",
          number: 3
        },
        {
          id: 4,
          name: "The Emperor",
          korean: "황제",
          emoji: "🤴",
          arcana: "major",
          number: 4
        },
        {
          id: 5,
          name: "The Hierophant",
          korean: "교황",
          emoji: "👨‍⚕️",
          arcana: "major",
          number: 5
        },
        {
          id: 6,
          name: "The Lovers",
          korean: "연인",
          emoji: "💕",
          arcana: "major",
          number: 6
        },
        {
          id: 7,
          name: "The Chariot",
          korean: "전차",
          emoji: "🏎️",
          arcana: "major",
          number: 7
        },
        {
          id: 8,
          name: "Strength",
          korean: "힘",
          emoji: "💪",
          arcana: "major",
          number: 8
        },
        {
          id: 9,
          name: "The Hermit",
          korean: "은둔자",
          emoji: "🏔️",
          arcana: "major",
          number: 9
        },
        {
          id: 10,
          name: "Wheel of Fortune",
          korean: "운명의 수레바퀴",
          emoji: "🎰",
          arcana: "major",
          number: 10
        },
        {
          id: 11,
          name: "Justice",
          korean: "정의",
          emoji: "⚖️",
          arcana: "major",
          number: 11
        },
        {
          id: 12,
          name: "The Hanged Man",
          korean: "매달린 남자",
          emoji: "🙃",
          arcana: "major",
          number: 12
        },
        {
          id: 13,
          name: "Death",
          korean: "죽음",
          emoji: "💀",
          arcana: "major",
          number: 13
        },
        {
          id: 14,
          name: "Temperance",
          korean: "절제",
          emoji: "🧘",
          arcana: "major",
          number: 14
        },
        {
          id: 15,
          name: "The Devil",
          korean: "악마",
          emoji: "👹",
          arcana: "major",
          number: 15
        },
        {
          id: 16,
          name: "The Tower",
          korean: "탑",
          emoji: "🗼",
          arcana: "major",
          number: 16
        },
        {
          id: 17,
          name: "The Star",
          korean: "별",
          emoji: "⭐",
          arcana: "major",
          number: 17
        },
        {
          id: 18,
          name: "The Moon",
          korean: "달",
          emoji: "🌙",
          arcana: "major",
          number: 18
        },
        {
          id: 19,
          name: "The Sun",
          korean: "태양",
          emoji: "☀️",
          arcana: "major",
          number: 19
        },
        {
          id: 20,
          name: "Judgement",
          korean: "심판",
          emoji: "📯",
          arcana: "major",
          number: 20
        },
        {
          id: 21,
          name: "The World",
          korean: "세계",
          emoji: "🌍",
          arcana: "major",
          number: 21
        }
      ];

      let result = {
        success: true,
        data: {
          type: fortuneType,
          date: new Date().toISOString().split("T")[0],
          isDemo: true
        }
      };

      // ✅ 수정: 중복 방지 카드 뽑기
      if (fortuneType === "single") {
        // 단일 카드
        const selectedCards = this.selectRandomCardsNoDuplicates(allCards, 1);
        result.data.cards = selectedCards;
        result.message = `${selectedCards[0].korean} 카드가 나왔습니다!`;
      } else if (fortuneType === "triple") {
        // 3장 카드 (중복 없음)
        const selectedCards = this.selectRandomCardsNoDuplicates(allCards, 3);
        const positions = ["past", "present", "future"];

        result.data.cards = selectedCards.map((card, index) => ({
          ...card,
          position: positions[index],
          isReversed: Math.random() > 0.7 // 30% 역방향
        }));
        result.message = "과거-현재-미래 3장 카드가 나왔습니다!";
      } else if (fortuneType === "celtic") {
        // 10장 캘틱 크로스 (중복 없음)
        const selectedCards = this.selectRandomCardsNoDuplicates(allCards, 10);
        const positions = [
          { key: "present", name: "현재 상황" },
          { key: "challenge", name: "도전/장애물" },
          { key: "past", name: "원인/과거" },
          { key: "future", name: "가능한 미래" },
          { key: "conscious", name: "의식적 접근" },
          { key: "unconscious", name: "무의식적 영향" },
          { key: "approach", name: "당신의 접근법" },
          { key: "environment", name: "외부 환경" },
          { key: "hopes_fears", name: "희망과 두려움" },
          { key: "outcome", name: "최종 결과" }
        ];

        result.data.cards = selectedCards.map((card, index) => ({
          ...card,
          position: positions[index].key,
          positionName: positions[index].name,
          positionDescription: `${positions[index].name}을 나타내는 카드`,
          order: index + 1,
          isReversed: Math.random() > 0.7 // 30% 역방향
        }));
        result.message = "캘틱 크로스 10장 카드가 배치되었습니다!";
      }

      if (question) {
        result.data.question = question;
      }

      // ✅ 중복 검증 로그
      const cardIds = result.data.cards.map((card) => card.id);
      const uniqueIds = new Set(cardIds);

      if (cardIds.length !== uniqueIds.size) {
        logger.error("❌ 더미 카드에 중복 발견!", {
          타입: fortuneType,
          총카드수: cardIds.length,
          고유카드수: uniqueIds.size,
          카드ID들: cardIds
        });
      } else {
        logger.success("✅ 더미 카드 중복 없음 확인", {
          타입: fortuneType,
          카드수: cardIds.length,
          카드ID들: cardIds
        });
      }

      logger.debug("✅ 더미 카드 생성 완료:", {
        cardCount: result.data.cards.length,
        type: fortuneType,
        hasQuestion: !!question,
        isNoDuplicate: cardIds.length === uniqueIds.size
      });

      return result;
    } catch (error) {
      logger.error("더미 카드 생성 실패:", error);
      return {
        success: false,
        message: "카드 생성 중 오류가 발생했습니다.",
        data: { error: error.message }
      };
    }
  }

  /**
   * ✅ 추가: 중복 없는 랜덤 카드 선택 헬퍼
   * @param {Array} deck - 전체 카드 배열
   * @param {number} count - 선택할 카드 수
   * @returns {Array} 중복 없는 선택된 카드들
   */
  selectRandomCardsNoDuplicates(deck, count) {
    if (deck.length < count) {
      logger.warn(`요청된 카드 수(${count})가 사용 가능한 카드 수(${deck.length})보다 많음`);
      count = deck.length; // 최대한 많이 선택
    }

    // 덱 복사 (원본 보존)
    const availableDeck = [...deck];
    const selectedCards = [];

    for (let i = 0; i < count; i++) {
      // 랜덤 인덱스 선택
      const randomIndex = Math.floor(Math.random() * availableDeck.length);

      // 카드 선택 및 덱에서 제거
      const [selectedCard] = availableDeck.splice(randomIndex, 1);

      // 카드 복사 후 추가 속성 설정
      const card = {
        ...selectedCard,
        meaning: this.getCardBasicMeaning(selectedCard),
        advice: this.getCardBasicAdvice(selectedCard)
      };

      selectedCards.push(card);
    }

    return selectedCards;
  }

  /**
   * ✅ 추가: 카드 기본 의미 생성
   */
  getCardBasicMeaning(card) {
    const meanings = {
      바보: "새로운 시작과 순수한 가능성",
      마법사: "의지력과 창조적 능력",
      여교황: "직감과 내면의 지혜",
      황후: "풍요로움과 창조성",
      황제: "권위와 안정성",
      교황: "전통과 영적 지도",
      연인: "선택과 인간관계",
      전차: "의지력과 승리",
      힘: "내면의 힘과 용기",
      은둔자: "내적 성찰과 지혜",
      "운명의 수레바퀴": "운명과 변화",
      정의: "균형과 공정함",
      "매달린 남자": "희생과 새로운 관점",
      죽음: "변화와 재생",
      절제: "균형과 조화",
      악마: "속박과 유혹",
      탑: "급격한 변화",
      별: "희망과 영감",
      달: "환상과 직감",
      태양: "성공과 기쁨",
      심판: "각성과 재생",
      세계: "완성과 성취"
    };

    return meanings[card.korean] || "새로운 기회와 변화";
  }

  /**
   * ✅ 추가: 카드 기본 조언 생성
   */
  getCardBasicAdvice(card) {
    const advice = {
      바보: "용기를 갖고 새로운 시작을 두려워하지 마세요",
      마법사: "당신의 능력을 믿고 목표를 향해 나아가세요",
      여교황: "내면의 목소리에 귀 기울이세요",
      황후: "창조적 에너지를 발휘할 시간입니다",
      황제: "체계적이고 안정적인 계획을 세우세요",
      교황: "전통적인 방법이 도움이 될 것입니다",
      연인: "중요한 선택을 신중하게 하세요",
      전차: "목표를 향해 꾸준히 전진하세요",
      힘: "인내와 끈기로 어려움을 극복하세요",
      은둔자: "혼자만의 시간을 가지며 성찰하세요",
      "운명의 수레바퀴": "변화를 받아들이고 적응하세요",
      정의: "공정하고 균형 잡힌 판단을 하세요",
      "매달린 남자": "다른 관점에서 상황을 바라보세요",
      죽음: "과거를 놓아주고 새로운 시작을 준비하세요",
      절제: "조화와 균형을 추구하세요",
      악마: "속박에서 벗어나 자유로워지세요",
      탑: "급변에 당황하지 말고 차분하게 대응하세요",
      별: "희망을 잃지 말고 꿈을 향해 나아가세요",
      달: "직감을 믿되 현실적 판단도 중요합니다",
      태양: "자신감을 갖고 긍정적으로 행동하세요",
      심판: "과거를 정리하고 새로운 출발을 준비하세요",
      세계: "목표를 달성하기 위한 마지막 노력을 하세요"
    };

    return advice[card.korean] || "직감을 믿고 현명한 선택을 하세요";
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
          result: "긍정적"
        }
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
      accuracy: Math.floor(Math.random() * 20) + 80
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
