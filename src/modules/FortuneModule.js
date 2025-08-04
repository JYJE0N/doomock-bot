// src/modules/FortuneModule.js - 완전한 타로 데이터 적용

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserId, getUserName, isDeveloper } = require("../utils/UserHelper");

/**
 * 🔮 FortuneModule - 타로 카드 운세 모듈
 * FortuneService와 연동하여 완전한 타로 경험을 제공합니다
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.fortuneService = null;
    this.userStates = new Map(); // 사용자 질문 입력 상태
    this.lastCelticResults = new Map(); // 캘틱 크로스 결과 캐시

    // 전문 타로 설정
    this.config = {
      maxDrawsPerDay: 5,
      questionTimeout: 300000, // 5분
      fortuneTypes: {
        single: {
          label: "싱글카드 🃏",
          emoji: "🃏",
          description: "하나의 카드로 오늘의 메시지",
          cost: 1 // 일일 횟수
        },
        triple: {
          label: "트리플카드 🔮",
          emoji: "🔮",
          description: "과거-현재-미래의 흐름 읽기",
          cost: 1
        },
        celtic: {
          label: "캘틱 크로스 ✨",
          emoji: "✨",
          description: "10장으로 보는 완전한 상황 분석",
          cost: 2,
          special: true
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
        logger.warn("FortuneService 없음 - 제한된 기능으로 동작");
      } else {
        logger.success("🔮 FortuneModule이 FortuneService와 연결됨");
      }

      this.setupActions();

      // 주기적 상태 정리
      setInterval(() => this.cleanupStates(), 60000); // 1분마다

      logger.success("🔮 FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("FortuneModule 초기화 실패:", error);
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
    this.actionMap.set("ask_question", this.askQuestion.bind(this));
    this.actionMap.set("cancel_question", this.cancelQuestion.bind(this));
  }

  /**
   * 💬 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg.from);
      const text = msg.text?.trim();

      // 질문 대기 상태 확인
      if (this.userStates.has(userId)) {
        const state = this.userStates.get(userId);

        if (state.type === "waiting_question" && text) {
          // 질문 입력 완료
          await this.handleQuestionInput(bot, msg, state, text);
          return true;
        }
      }

      // 일반 명령어 처리
      const commands = [
        { cmd: "/fortune", action: "menu" },
        { cmd: "/타로", action: "menu" },
        { cmd: "운세", action: "menu" },
        { cmd: "타로", action: "menu" }
      ];

      for (const { cmd, _action } of commands) {
        if (text?.toLowerCase().includes(cmd)) {
          await this.showMenu(bot, msg);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error("FortuneModule 메시지 처리 오류:", error);
      return false;
    }
  }

  /**
   * 🔮 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 🎯 개발자 여부 직접 확인
      const developerMode = isDeveloper(callbackQuery.from);

      // 🎯 이 변수를 사용하도록 수정합니다.
      const serviceStatus = this.fortuneService?.getStatus() || {
        hasDatabase: false,
        stats: { totalDraws: 0 }
      };

      const todayInfo = await this.getTodayDrawInfo(userId);
      logger.debug(`🔮 Fortune 메뉴 표시: ${userName} (${userId})`);

      return {
        type: "menu",
        module: "fortune",
        data: {
          userName,
          todayCount: todayInfo.todayCount,
          remainingDraws: todayInfo.remainingDraws,
          maxDrawsPerDay: this.config.maxDrawsPerDay,
          canDraw: developerMode || todayInfo.remainingDraws > 0,
          fortuneTypes: this.config.fortuneTypes,
          isDeveloper: developerMode,
          // ✨ 수정된 부분: serviceStatus 변수를 여기서 사용합니다.
          serviceConnected: !!this.fortuneService,
          hasDatabase: serviceStatus.hasDatabase,
          totalServiceDraws: serviceStatus.stats?.totalDraws || 0
        }
      };
    } catch (error) {
      logger.error("FortuneModule.showMenu 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: {
          message: "메뉴를 불러오는 중 오류가 발생했습니다.",
          error: error.message
        }
      };
    }
  }

  /**
   * 🎴 카드 뽑기
   */
  async drawCard(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);
      const fortuneType = params || "single";

      logger.info(`🎴 카드 뽑기 요청: ${userName} - ${fortuneType}`);

      // 🎯 개발자인 경우, 횟수 제한 검사 건너뛰기
      if (!isDeveloper(callbackQuery.from)) {
        const todayInfo = await this.getTodayDrawInfo(userId);
        if (todayInfo.remainingDraws <= 0) {
          return {
            type: "daily_limit",
            module: "fortune",
            data: {
              used: todayInfo.todayCount,
              max: this.config.maxDrawsPerDay
            }
          };
        }
      }

      // 🎯 캘틱 크로스는 질문 입력 필요
      if (fortuneType === "celtic") {
        return await this.askQuestion(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      // 일반 카드 뽑기 진행
      return await this.performDraw(userId, userName, fortuneType);
    } catch (error) {
      logger.error("FortuneModule.drawCard 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: {
          message: "카드를 뽑는 중 오류가 발생했습니다.",
          error: error.message
        }
      };
    }
  }

  /**
   * ❓ 질문 입력 요청
   */
  async askQuestion(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);
      const fortuneType = params || "celtic";

      // 질문 대기 상태 설정
      this.userStates.set(userId, {
        type: "waiting_question",
        fortuneType,
        timestamp: Date.now(),
        userName
      });

      logger.info(`❓ 질문 입력 대기: ${userName} - ${fortuneType}`);

      return {
        type: "ask_question",
        module: "fortune",
        data: {
          userName,
          fortuneType,
          fortuneTypeLabel:
            this.config.fortuneTypes[fortuneType]?.label || fortuneType,
          message:
            "무엇이든 물어보세요! 구체적일수록 정확한 답을 얻을 수 있습니다."
        }
      };
    } catch (error) {
      logger.error("FortuneModule.askQuestion 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "질문 입력 화면을 표시하는 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 💬 질문 입력 처리
   */
  async handleQuestionInput(bot, msg, state, question) {
    try {
      const userId = getUserId(msg.from);
      const { fortuneType, userName } = state;

      // ✨ 질문 검증
      if (!question || question.length < 10) {
        const errorResult = {
          type: "question_error",
          module: "fortune",
          data: { message: "질문은 최소 10자 이상 입력해주세요." }
        };
        // 렌더러로 에러 메시지 전송
        await this.sendToRenderer(errorResult, msg);
        return; // 여기서 처리를 중단합니다.
      }
      if (question.length > 100) {
        const errorResult = {
          type: "question_error",
          module: "fortune",
          data: { message: "질문은 100자를 넘을 수 없습니다." }
        };
        await this.sendToRenderer(errorResult, msg);
        return;
      }

      logger.info(`💬 질문 입력 완료: ${userName} - "${question}"`);
      this.userStates.delete(userId);

      // 카드 뽑기 진행
      const result = await this.performDraw(
        userId,
        userName,
        fortuneType,
        question
      );

      // 렌더러로 결과 전송
      await this.sendToRenderer(result, msg);
    } catch (error) {
      logger.error("질문 입력 처리 오류:", error);
      await bot.sendMessage(
        msg.chat.id,
        "질문 처리 중 오류가 발생했습니다. 다시 시도해주세요."
      );
    }
  }

  /**
   * ❌ 질문 입력 취소
   */
  async cancelQuestion(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);

      // 대기 상태 제거
      if (this.userStates.has(userId)) {
        this.userStates.delete(userId);
        logger.info(`❌ 질문 입력 취소: ${userId}`);
      }

      // 메뉴로 돌아가기
      return await this.showMenu(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      logger.error("질문 취소 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "취소 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 🎴 실제 카드 뽑기 수행
   */
  async performDraw(userId, userName, fortuneType, question = null) {
    try {
      // FortuneService 사용
      if (this.fortuneService) {
        const result = await this.fortuneService.drawCard(userId, {
          type: fortuneType,
          question: question
        });

        if (!result.success) {
          return {
            type: "error",
            module: "fortune",
            data: {
              message: result.message || "카드를 뽑을 수 없습니다.",
              remainingDraws: result.data?.remainingDraws || 0
            }
          };
        }

        // 캘틱 크로스 결과 캐싱
        if (fortuneType === "celtic" && result.data) {
          this.lastCelticResults.set(userId, {
            ...result.data,
            userName,
            timestamp: new Date()
          });
        }

        return {
          type: "draw_result",
          module: "fortune",
          data: {
            ...result.data,
            userName,
            fortuneType: this.config.fortuneTypes[fortuneType]
          }
        };
      }

      // 서비스 없을 때 기본 응답
      return {
        type: "error",
        module: "fortune",
        data: {
          message: "운세 서비스가 일시적으로 사용 불가능합니다.",
          isDemo: true
        }
      };
    } catch (error) {
      logger.error("performDraw 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: {
          message: "카드 뽑기 중 오류가 발생했습니다.",
          error: error.message
        }
      };
    }
  }

  /**
   * 🔄 카드 셔플
   */
  async shuffleCards(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.info(`🔄 카드 셔플 요청: ${userName}`);

      let shuffleResult;

      if (this.fortuneService) {
        shuffleResult = await this.fortuneService.shuffleDeck(userId);
      } else {
        // 서비스 없을 때 기본 동작
        shuffleResult = {
          success: true,
          message: "카드가 새롭게 섞였습니다! ✨",
          data: { shuffled: true }
        };
      }

      // 애니메이션 효과
      await AnimationHelper.performShuffle(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id
      ); // <- 이렇게 수정해주세요.

      return {
        type: "shuffle_result",
        module: "fortune",
        data: {
          userName,
          message: shuffleResult.message,
          success: shuffleResult.success
        }
      };
    } catch (error) {
      logger.error("카드 셔플 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "카드 셔플 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 📜 기록 조회
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.info(`📜 기록 조회: ${userName}`);

      let historyData;

      if (this.fortuneService) {
        const result = await this.fortuneService.getDrawHistory(userId, 10);
        historyData = result.success ? result.data : { records: [] };
      } else {
        // 서비스 없을 때 더미 데이터
        historyData = {
          records: [
            {
              date: "2025-08-04 14:30",
              type: "single",
              cards: "⭐ 별",
              question: "오늘의 운세",
              summary: "희망과 영감의 메시지"
            }
          ],
          message: "최근 1개의 기록 (데모)"
        };
      }

      return {
        type: "history",
        module: "fortune",
        data: {
          userName,
          ...historyData,
          isEmpty: historyData.records.length === 0
        }
      };
    } catch (error) {
      logger.error("기록 조회 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "기록을 불러오는 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 📊 통계 조회
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.info(`📊 통계 조회: ${userName}`);

      let statsData;

      if (this.fortuneService) {
        const result = await this.fortuneService.getUserStats(userId);
        statsData = result.success ? result.data : this.getDefaultStats();
      } else {
        statsData = this.getDefaultStats();
      }

      return {
        type: "stats",
        module: "fortune",
        data: {
          userName,
          ...statsData,
          hasData: statsData.totalDraws > 0
        }
      };
    } catch (error) {
      logger.error("통계 조회 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "통계를 불러오는 중 오류가 발생했습니다." }
      };
    }
  }

  // 헬퍼 메서드 추가
  async sendToRenderer(result, msg) {
    const renderer =
      this.moduleManager?.navigationHandler?.renderers?.get("fortune");
    if (renderer) {
      // 일반 메시지에 대한 응답이므로 ctx를 새로 구성
      const ctx = {
        message: msg,
        reply: (text, options) =>
          this.bot.telegram.sendMessage(msg.chat.id, text, options),
        answerCbQuery: () => Promise.resolve(true) // no-op for text messages
      };
      await renderer.render(result, ctx);
    }
  }

  /**
   * 📖 캘틱 크로스 상세 보기
   */
  async showCelticDetail(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.info(`📖 캘틱 크로스 상세 조회: ${userName}`);

      // 캐시된 결과 확인
      const cachedResult = this.lastCelticResults.get(userId);

      if (!cachedResult || !cachedResult.cards) {
        return {
          type: "error",
          module: "fortune",
          data: {
            message:
              "최근 캘틱 크로스 결과가 없습니다. 먼저 캘틱 크로스를 뽑아주세요."
          }
        };
      }

      // 상세 해석 생성
      const detailedInterpretation =
        this.generateDetailedCelticInterpretation(cachedResult);

      return {
        type: "celtic_detail",
        module: "fortune",
        data: {
          userName,
          ...cachedResult,
          detailedInterpretation,
          timestamp: cachedResult.timestamp
        }
      };
    } catch (error) {
      logger.error("캘틱 상세 조회 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "상세 해석을 불러오는 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 📊 오늘 뽑기 정보 조회
   */
  async getTodayDrawInfo(userId) {
    try {
      if (this.fortuneService) {
        const limitCheck = await this.fortuneService.checkDailyLimit(userId);
        return {
          todayCount: limitCheck.todayDraws || 0,
          remainingDraws:
            limitCheck.remainingDraws || this.config.maxDrawsPerDay
        };
      }

      // 서비스 없을 때 기본값
      return {
        todayCount: 0,
        remainingDraws: this.config.maxDrawsPerDay
      };
    } catch (error) {
      logger.warn("오늘 뽑기 정보 조회 실패:", error);
      return {
        todayCount: 0,
        remainingDraws: this.config.maxDrawsPerDay
      };
    }
  }

  /**
   * 📊 기본 통계 생성
   */
  getDefaultStats() {
    return {
      totalDraws: 0,
      favoriteCard: null,
      favoriteCardCount: 0,
      typeStats: {
        single: 0,
        triple: 0,
        celtic: 0
      },
      todayDraws: 0,
      weeklyDraws: 0,
      isDemo: true
    };
  }

  /**
   * 📖 캘틱 크로스 상세 해석 생성
   */
  generateDetailedCelticInterpretation(celticResult) {
    const interpretation = {
      sections: []
    };

    // 핵심 상황 분석 (1-2번 카드)
    interpretation.sections.push({
      title: "🎯 핵심 상황 분석",
      content: this.interpretCelticCore(celticResult.cards.slice(0, 2))
    });

    // 시간의 흐름 (3-6번 카드)
    interpretation.sections.push({
      title: "⏰ 시간의 흐름",
      content: this.interpretCelticTimeline(celticResult.cards.slice(2, 6))
    });

    // 내외부 영향 (7-9번 카드)
    interpretation.sections.push({
      title: "🌐 내외부 영향",
      content: this.interpretCelticInfluences(celticResult.cards.slice(6, 9))
    });

    // 최종 결과 (10번 카드)
    interpretation.sections.push({
      title: "🎊 최종 전망",
      content: this.interpretCelticOutcome(celticResult.cards[9])
    });

    // 종합 메시지
    interpretation.overallMessage =
      this.generateCelticOverallMessage(celticResult);

    return interpretation;
  }

  /**
   * 🧹 상태 정리
   */
  cleanupStates() {
    const now = Date.now();
    const timeout = this.config.questionTimeout;

    // 오래된 질문 대기 상태 제거
    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.timestamp > timeout) {
        this.userStates.delete(userId);
        logger.debug(`⏱️ 질문 대기 타임아웃: ${userId}`);
      }
    }

    // 오래된 캘틱 결과 캐시 제거 (1시간)
    for (const [userId, result] of this.lastCelticResults.entries()) {
      if (now - result.timestamp > 3600000) {
        this.lastCelticResults.delete(userId);
      }
    }
  }

  /**
   * 📖 캘틱 해석 헬퍼 메서드들
   */
  interpretCelticCore(cards) {
    const present = cards[0];
    const challenge = cards[1];

    let interpretation = `현재 상황은 **${present.korean}**`;
    if (present.isReversed) interpretation += " (역방향)";
    interpretation += "가 나타내고 있습니다. ";

    interpretation += `이를 가로막는 도전은 **${challenge.korean}**`;
    if (challenge.isReversed) interpretation += " (역방향)";
    interpretation += "입니다.\n\n";

    interpretation +=
      "두 카드의 관계는 현재 직면한 상황과 극복해야 할 과제를 명확히 보여줍니다.";

    return interpretation;
  }

  interpretCelticTimeline(cards) {
    const positions = ["원인/과거", "최근 과거", "가능한 미래", "가까운 미래"];
    let interpretation = "";

    cards.forEach((card, index) => {
      interpretation += `**${positions[index]}**: ${card.emoji} ${card.korean}`;
      if (card.isReversed) interpretation += " (역)";
      interpretation += "\n";
    });

    interpretation += "\n과거에서 미래로 이어지는 명확한 흐름이 보입니다.";

    return interpretation;
  }

  interpretCelticInfluences(cards) {
    const positions = ["당신의 접근", "외부 환경", "희망과 두려움"];
    let interpretation = "";

    cards.forEach((card, index) => {
      interpretation += `**${positions[index]}**: ${card.emoji} ${card.korean}`;
      if (card.isReversed) interpretation += " (역)";
      interpretation += "\n";
    });

    interpretation += "\n내면과 외부의 영향이 조화를 이루고 있습니다.";

    return interpretation;
  }

  interpretCelticOutcome(card) {
    let interpretation = `최종 결과는 **${card.emoji} ${card.korean}**`;
    if (card.isReversed) interpretation += " (역방향)";
    interpretation += "입니다.\n\n";

    if (card.arcana === "major") {
      interpretation +=
        "메이저 아르카나가 결과로 나왔으므로, 매우 중요한 의미를 갖습니다. ";
    }

    interpretation +=
      "모든 요소를 고려할 때, 이는 당신의 여정이 도달할 지점을 보여줍니다.";

    return interpretation;
  }

  generateCelticOverallMessage(result) {
    const majorCount = result.cards.filter((c) => c.arcana === "major").length;
    const reversedCount = result.cards.filter((c) => c.isReversed).length;

    let message = "";

    if (majorCount >= 5) {
      message += "매우 중요한 인생의 전환점에 있습니다. ";
    }

    if (reversedCount >= 5) {
      message +=
        "많은 에너지가 내면으로 향하고 있습니다. 성찰이 필요한 시기입니다. ";
    }

    if (result.question) {
      message += `"${result.question}"에 대한 답은 카드들이 보여주는 여정 속에 있습니다.`;
    } else {
      message += "카드들이 보여주는 메시지를 깊이 성찰해보세요.";
    }

    return message;
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.userStates.clear();
      this.lastCelticResults.clear();
      logger.debug("🔮 FortuneModule 정리 완료");
    } catch (error) {
      logger.error("FortuneModule 정리 실패:", error);
    }
  }
}

module.exports = FortuneModule;
