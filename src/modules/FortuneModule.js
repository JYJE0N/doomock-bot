// src/modules/FortuneModule.js - 완전한 타로 데이터 적용

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserId, getUserName, isDeveloper } = require("../utils/UserHelper");
const KoreanPostpositionHelper = require("../utils/KoreanPostpositionHelper"); // ✅ 추가: 한국어 조사 헬퍼

/**
 * 🔮 FortuneModule - 타로 카드 운세 모듈
 * FortuneService와 연동하여 완전한 타로 경험을 제공합니다
 */
class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.fortuneService = null;
    this.userStates = new Map();
    this.lastCelticResults = new Map();

    this.config = {
      maxDrawsPerDay: 5,
      questionTimeout: 300000,
      fortuneTypes: {
        single: { label: "싱글카드 🃏", emoji: "🃏", cost: 1 },
        triple: { label: "트리플카드 🔮", emoji: "🔮", cost: 1 },
        celtic: { label: "캘틱 크로스 ✨", emoji: "✨", cost: 2, special: true }
      }
    };
  }

  async onInitialize() {
    try {
      this.fortuneService = await this.serviceBuilder.getOrCreate("fortune");
      if (this.fortuneService) {
        this.fortuneService.config.maxDrawsPerDay = this.config.maxDrawsPerDay;
        logger.success("🔮 FortuneModule이 FortuneService와 연결됨");
      } else {
        logger.warn("FortuneService 없음 - 제한된 기능으로 동작");
      }
      this.setupActions();
      setInterval(() => this.cleanupStates(), 60000);
      logger.success("🔮 FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("FortuneModule 초기화 실패:", error);
      this.setupActions();
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      draw: this.drawCard,
      stats: this.showStats,
      history: this.showHistory,
      shuffle: this.shuffleCards,
      cancelQuestion: this.cancelQuestion,
      celtic_detail: this.showCelticDetail,
      reset: this.resetDailyLimit
    });
  }

  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg.from);
      const text = msg.text?.trim();

      if (this.userStates.has(userId)) {
        const state = this.userStates.get(userId);
        if (state.type === "waiting_question" && text) {
          return await this.handleQuestionInput(bot, msg, state, text);
        }
      }

      const commands = ["/fortune", "/타로", "운세", "타로"];
      if (commands.some((cmd) => text?.toLowerCase().includes(cmd))) {
        return await this.showMenu(bot, msg);
      }
      return false;
    } catch (error) {
      logger.error("FortuneModule 메시지 처리 오류:", error);
      return false;
    }
  }

  async showMenu(bot, callbackQuery) {
    const user = callbackQuery.from;
    const todayInfo = await this.getTodayDrawInfo(user);
    return {
      type: "menu",
      module: "fortune",
      data: {
        userName: getUserName(user),
        todayCount: todayInfo.todayCount,
        remainingDraws: todayInfo.remainingDraws,
        maxDrawsPerDay: this.config.maxDrawsPerDay,
        canDraw: isDeveloper(user) || todayInfo.remainingDraws > 0,
        fortuneTypes: this.config.fortuneTypes,
        isDeveloper: isDeveloper(user)
      }
    };
  }

  async drawCard(bot, callbackQuery, subAction, params) {
    const user = callbackQuery.from;
    const fortuneType = params || "single";

    if (fortuneType === "celtic") {
      return await this.askQuestion(bot, callbackQuery, subAction, params);
    }

    if (!isDeveloper(user)) {
      const todayInfo = await this.getTodayDrawInfo(user);
      if (todayInfo.remainingDraws <= 0) {
        return {
          type: "daily_limit",
          module: "fortune",
          data: { used: todayInfo.todayCount, max: this.config.maxDrawsPerDay }
        };
      }
    }
    return await this.performDraw(user, fortuneType);
  }

  async askQuestion(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);
    this.userStates.set(userId, {
      type: "waiting_question",
      fortuneType: params || "celtic",
      timestamp: Date.now()
    });
    return {
      type: "question_prompt",
      module: "fortune",
      data: {
        fortuneTypeLabel: this.config.fortuneTypes[params || "celtic"]?.label
      }
    };
  }

  async handleQuestionInput(bot, msg, state, question) {
    const user = msg.from;
    if (!question || question.length < 10 || question.length > 100) {
      await this.sendToRenderer(
        {
          type: "question_error",
          module: "fortune",
          data: { message: "질문은 10자 이상 100자 이하로 입력해주세요." }
        },
        msg
      );
      return;
    }
    this.userStates.delete(user.id);
    return await this.performDraw(user, state.fortuneType, question);
  }

  async cancelQuestion(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    this.userStates.delete(userId);
    return await this.showMenu(
      bot,
      callbackQuery,
      subAction,
      params,
      moduleManager
    );
  }

  async performDraw(user, fortuneType, question = null) {
    if (!this.fortuneService)
      return {
        type: "error",
        module: "fortune",
        data: { message: "운세 서비스가 일시적으로 사용 불가능합니다." }
      };
    const result = await this.fortuneService.drawCard(user, {
      type: fortuneType,
      question
    });
    if (!result.success)
      return {
        type: "error",
        module: "fortune",
        data: { message: result.message }
      };

    const responseData = {
      ...result.data,
      userName: getUserName(user),
      fortuneType: this.config.fortuneTypes[fortuneType],
      maxDrawsPerDay: this.config.maxDrawsPerDay
    };

    if (fortuneType === "celtic") {
      this.lastCelticResults.set(user.id, {
        ...responseData,
        timestamp: new Date()
      });
      return { type: "celtic_result", module: "fortune", data: responseData };
    }
    return { type: "draw_result", module: "fortune", data: responseData };
  }

  async shuffleCards(bot, callbackQuery) {
    const shuffleResult = this.fortuneService
      ? await this.fortuneService.shuffleDeck(getUserId(callbackQuery.from))
      : { success: true, message: "카드가 새롭게 섞였습니다! ✨" };
    await AnimationHelper.performShuffle(
      bot,
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id
    );
    return {
      type: "shuffle_result",
      module: "fortune",
      data: {
        userName: getUserName(callbackQuery.from),
        message: shuffleResult.message
      }
    };
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
        // ✅ 수정: 기록 요청 개수를 5개로 변경
        const result = await this.fortuneService.getDrawHistory(userId, 5);
        historyData = result.success ? result.data : { records: [] };
      } else {
        historyData = { records: [], message: "최근 1개의 기록 (데모)" };
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

  async showStats(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const result = this.fortuneService
      ? await this.fortuneService.getUserStats(userId)
      : { success: true, data: this.getDefaultStats() };
    return {
      type: "stats",
      module: "fortune",
      data: {
        userName: getUserName(callbackQuery.from),
        ...result.data,
        hasData: result.data.totalDraws > 0
      }
    };
  }

  async showCelticDetail(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const cachedResult = this.lastCelticResults.get(userId);
    if (!cachedResult || !cachedResult.cards) {
      return {
        type: "error",
        module: "fortune",
        data: { message: "최근 캘틱 크로스 결과가 없습니다." }
      };
    }
    const detailedInterpretation =
      this.generateDetailedCelticInterpretation(cachedResult);
    return {
      type: "celtic_detail",
      module: "fortune",
      data: {
        userName: getUserName(callbackQuery.from),
        ...cachedResult,
        detailedInterpretation
      }
    };
  }

  async getTodayDrawInfo(user) {
    if (!this.fortuneService)
      return { todayCount: 0, remainingDraws: this.config.maxDrawsPerDay };
    const limitCheck = await this.fortuneService.checkDailyLimit(
      user,
      this.config.maxDrawsPerDay
    );
    return {
      todayCount: limitCheck.todayDraws || 0,
      remainingDraws: limitCheck.remainingDraws
    };
  }

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

  cleanupStates() {
    const now = Date.now();
    this.userStates.forEach((state, userId) => {
      if (now - state.timestamp > this.config.questionTimeout)
        this.userStates.delete(userId);
    });
    this.lastCelticResults.forEach((result, userId) => {
      if (now - result.timestamp > 3600000)
        this.lastCelticResults.delete(userId);
    });
  }

  /**
   * 📖 캘틱 해석 헬퍼 메서드들 (조사 헬퍼 적용)
   */
  interpretCelticCore(cards) {
    const present = cards[0];
    const challenge = cards[1];
    const kph = KoreanPostpositionHelper;

    const presentName = `**${present.korean}**${present.isReversed ? " (역방향)" : ""}`;
    const challengeName = `**${challenge.korean}**${challenge.isReversed ? " (역방향)" : ""}`;

    let interpretation = `현재 상황은 ${kph.a(presentName, "으로/로")} 나타나고 있습니다.\n`;
    interpretation += `이를 가로막는 도전 과제는 ${kph.a(challengeName, "입니다/입니다")}.\n\n`;

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
    const kph = KoreanPostpositionHelper;
    let interpretation = `최종 결과는 **${card.emoji} ${kph.a(card.korean, "으로/로")}**`;
    if (card.isReversed) interpretation += " (역방향)";
    interpretation += " 나타납니다.\n\n";
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

  async resetDailyLimit(bot, callbackQuery) {
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
    return await this.showMenu(bot, callbackQuery);
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
}

module.exports = FortuneModule;
