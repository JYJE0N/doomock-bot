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
        // 서비스의 설정값을 모듈의 설정값으로 동기화
        this.fortuneService.config.maxDrawsPerDay = this.config.maxDrawsPerDay;
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
    this.actionMap = new Map();
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("draw", this.drawCard.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("shuffle", this.shuffleCards.bind(this));
    this.actionMap.set("cancelQuestion", this.cancelQuestion.bind(this));
    this.actionMap.set("celticDetail", this.showCelticDetail.bind(this)); // ✅ 수정: 이 부분을 추가합니다.
    this.actionMap.set("reset", this.resetDailyLimit.bind(this));
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
          return await this.handleQuestionInput(bot, msg, state, text);
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
          return await this.showMenu(bot, msg);
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
      const user = callbackQuery.from;
      const userName = getUserName(user);
      const developerMode = isDeveloper(user);

      const serviceStatus = this.fortuneService?.getStatus() || {
        hasDatabase: false,
        stats: { totalDraws: 0 }
      };

      const todayInfo = await this.getTodayDrawInfo(user);

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
      const user = callbackQuery.from;
      const fortuneType = params || "single";

      logger.info(`🎴 카드 뽑기 요청: ${getUserName(user)} - ${fortuneType}`);

      // 캘틱 크로스는 질문 입력이 항상 필요
      if (fortuneType === "celtic") {
        return await this.askQuestion(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      // 개발자인지 먼저 확인
      if (!isDeveloper(user)) {
        const todayInfo = await this.getTodayDrawInfo(user);
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

      // 일반 카드 뽑기 진행
      return await this.performDraw(user, fortuneType);
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

      this.userStates.set(userId, {
        type: "waiting_question",
        fortuneType,
        timestamp: Date.now(),
        userName
      });

      logger.info(`❓ 질문 입력 대기: ${userName} - ${fortuneType}`);

      return {
        type: "question_prompt",
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
      const user = msg.from;
      const { fortuneType } = state;

      if (!question || question.length < 10) {
        await this.sendToRenderer(
          {
            type: "question_error",
            module: "fortune",
            data: { message: "질문은 최소 10자 이상 입력해주세요." }
          },
          msg
        );
        return;
      }
      if (question.length > 100) {
        await this.sendToRenderer(
          {
            type: "question_error",
            module: "fortune",
            data: { message: "질문은 100자를 넘을 수 없습니다." }
          },
          msg
        );
        return;
      }

      logger.info(`💬 질문 입력 완료: ${getUserName(user)} - "${question}"`);
      this.userStates.delete(user.id);

      return await this.performDraw(user, fortuneType, question);
    } catch (error) {
      logger.error("질문 입력 처리 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "질문 처리 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * ❌ 질문 입력 취소
   */
  async cancelQuestion(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      if (this.userStates.has(userId)) {
        this.userStates.delete(userId);
        logger.info(`❌ 질문 입력 취소: ${userId}`);
      }
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
  async performDraw(user, fortuneType, question = null) {
    try {
      if (this.fortuneService) {
        const result = await this.fortuneService.drawCard(user, {
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

        if (fortuneType === "celtic" && result.data) {
          this.lastCelticResults.set(user.id, {
            ...result.data,
            userName: getUserName(user),
            timestamp: new Date()
          });
          return {
            type: "celtic_result",
            module: "fortune",
            data: {
              ...result.data,
              userName: getUserName(user),
              fortuneType: this.config.fortuneTypes[fortuneType],
              maxDrawsPerDay: this.config.maxDrawsPerDay,
              remainingDraws: result.data?.remainingDraws || 0,
              todayDraws: result.data?.todayDraws || 0
            }
          };
        }

        return {
          type: "draw_result",
          module: "fortune",
          data: {
            ...result.data,
            userName: getUserName(user),
            fortuneType: this.config.fortuneTypes[fortuneType],
            maxDrawsPerDay: this.config.maxDrawsPerDay,
            remainingDraws: result.data?.remainingDraws || 0,
            todayDraws: result.data?.todayDraws || 0
          }
        };
      }

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
        shuffleResult = {
          success: true,
          message: "카드가 새롭게 섞였습니다! ✨",
          data: { shuffled: true }
        };
      }

      await AnimationHelper.performShuffle(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id
      );

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

  async sendToRenderer(result, msg) {
    const renderer =
      this.moduleManager?.navigationHandler?.renderers?.get("fortune");
    if (renderer) {
      const ctx = {
        message: msg,
        reply: (text, options) =>
          this.bot.telegram.sendMessage(msg.chat.id, text, options),
        answerCbQuery: () => Promise.resolve(true)
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
  async getTodayDrawInfo(user) {
    try {
      if (this.fortuneService) {
        const limitCheck = await this.fortuneService.checkDailyLimit(
          user,
          this.config.maxDrawsPerDay
        );
        return {
          todayCount: limitCheck.todayDraws || 0,
          remainingDraws: limitCheck.remainingDraws
        };
      }
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
      typeStats: { single: 0, triple: 0, celtic: 0 },
      todayDraws: 0,
      weeklyDraws: 0,
      isDemo: true
    };
  }

  /**
   * 📖 캘틱 크로스 상세 해석 생성
   */
  generateDetailedCelticInterpretation(celticResult) {
    const interpretation = { sections: [] };
    interpretation.sections.push({
      title: "🎯 핵심 상황 분석",
      content: this.interpretCelticCore(celticResult.cards.slice(0, 2))
    });
    interpretation.sections.push({
      title: "⏰ 시간의 흐름",
      content: this.interpretCelticTimeline(celticResult.cards.slice(2, 6))
    });
    interpretation.sections.push({
      title: "🌐 내외부 영향",
      content: this.interpretCelticInfluences(celticResult.cards.slice(6, 9))
    });
    interpretation.sections.push({
      title: "🎊 최종 전망",
      content: this.interpretCelticOutcome(celticResult.cards[9])
    });
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
    for (const [userId, state] of this.userStates.entries()) {
      if (now - state.timestamp > timeout) {
        this.userStates.delete(userId);
        logger.debug(`⏱️ 질문 대기 타임아웃: ${userId}`);
      }
    }
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

  async resetDailyLimit(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const user = callbackQuery.from;
      if (!isDeveloper(user)) {
        return {
          type: "error",
          module: "fortune",
          data: { message: "개발자만 사용 가능한 기능입니다." }
        };
      }
      if (this.fortuneService && this.fortuneService.Fortune) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await this.fortuneService.Fortune.updateOne(
          { userId: user.id },
          { $pull: { draws: { timestamp: { $gte: today } } } }
        );
        logger.info(`🔄 ${getUserName(user)}의 일일 제한 리셋됨`);
      }
      return await this.showMenu(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      logger.error("일일 제한 리셋 오류:", error);
      return {
        type: "error",
        module: "fortune",
        data: { message: "리셋 중 오류가 발생했습니다." }
      };
    }
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
