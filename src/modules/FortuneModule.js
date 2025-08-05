// src/modules/FortuneModule.js

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserId, getUserName, isDeveloper } = require("../utils/UserHelper");
const KoreanPostpositionHelper = require("../utils/KoreanPostpositionHelper");

class FortuneModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);
    this.fortuneService = null;
    this.userStates = new Map();
    this.lastCelticResults = new Map();
    this.config = {
      maxDrawsPerDay: 3,
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
      }
      this.setupActions();
      setInterval(() => this.cleanupStates(), 60000);
      logger.success("🔮 FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("FortuneModule 초기화 실패:", error);
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
    const userId = getUserId(msg.from);
    // 질문 대기 상태를 최우선으로 체크
    if (this.userStates.has(userId)) {
      const state = this.userStates.get(userId);
      const text = msg.text?.trim();
      if (state.type === "waiting_question" && text) {
        return this.handleQuestionInput(bot, msg, state, text);
      }
    }

    // 이후 일반 명령어 체크
    const text = msg.text?.trim();
    const commands = ["/fortune", "/타로", "운세", "타로"];
    if (commands.some((cmd) => text?.toLowerCase().includes(cmd))) {
      return this.showMenu(bot, msg);
    }
    return false;
  }

  /**
   * 💬 질문 입력 처리 (흐름 제어 수정)
   */
  async handleQuestionInput(bot, msg, state, question) {
    const user = msg.from;
    const userName = getUserName(user);

    // 🔥 의미 없는 입력 체크
    if (!this.isValidQuestion(question)) {
      // 사용자 메시지 삭제
      try {
        await bot.telegram.deleteMessage(msg.chat.id, msg.message_id);
      } catch (error) {
        logger.debug("사용자 메시지 삭제 실패:", error);
      }

      const errorMessage = `${userName}님, 진정한 고민을 들려주세요. 🙏\n카드는 진심 어린 질문에만 답을 줍니다.`;

      // 기존 메시지 수정
      if (state.promptMessageId) {
        try {
          await bot.telegram.editMessageText(
            msg.chat.id,
            state.promptMessageId,
            null,
            errorMessage,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🙅 그만두기", callback_data: "fortune:menu" }]
                ]
              }
            }
          );
          return true;
        } catch (error) {
          logger.debug("메시지 수정 실패:", error);
        }
      }

      return true;
    }

    // 길이 체크
    let errorMessage = null;

    if (question.length < 10) {
      errorMessage = `${userName}님, 고민을 좀 더 자세히 들려주세요. 🤔\n최소 10자 이상 적어주시면 카드가 더 정확한 답을 줄 수 있어요.`;
    } else if (question.length > 100) {
      errorMessage = `${userName}님, 고민의 핵심을 간결하게 정리해주세요. 📝\n100자 이내로 적어주시면 카드가 더 명확한 메시지를 전달할 수 있어요.`;
    }

    if (errorMessage) {
      // 사용자 메시지 삭제
      try {
        await bot.telegram.deleteMessage(msg.chat.id, msg.message_id);
      } catch (error) {
        logger.debug("사용자 메시지 삭제 실패:", error);
      }

      // 🔥 기존 질문 프롬프트 메시지 수정
      if (state.promptMessageId) {
        try {
          await bot.telegram.editMessageText(
            msg.chat.id,
            state.promptMessageId,
            null,
            errorMessage,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🙅 그만두기", callback_data: "fortune:menu" }]
                ]
              }
            }
          );
          return true;
        } catch (error) {
          logger.debug("메시지 수정 실패:", error);
        }
      }

      // 수정 실패시 새 메시지로 전송
      await this.sendToRenderer(
        {
          type: "question_error",
          module: "fortune",
          data: { message: errorMessage }
        },
        msg
      );
      return true;
    }

    // 정상 처리
    this.userStates.delete(user.id);
    return await this.performDraw(user, state.fortuneType, question);
  }

  async showHistory(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const result = await this.fortuneService.getDrawHistory(userId, 5); // 5개로 제한

    const historyData = result.data || { records: [], total: 0 };

    return {
      type: "history",
      module: "fortune",
      data: {
        userName,
        ...result.data,
        ...historyData, // 안전하게 펼침

        isEmpty: result.data.records.length === 0
      }
    };
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

  // 질문 프롬프트에 대한 메시지 ID를 저장
  async askQuestion(bot, callbackQuery, subAction, params) {
    const userId = getUserId(callbackQuery.from);

    // 질문 프롬프트 렌더링
    const result = {
      type: "question_prompt",
      module: "fortune",
      data: {
        fortuneTypeLabel: this.config.fortuneTypes[params || "celtic"]?.label
      }
    };

    // 렌더러를 통해 메시지 전송하고 ID 저장
    const renderer =
      this.moduleManager?.navigationHandler?.renderers?.get("fortune");
    if (renderer) {
      const ctx = {
        message: callbackQuery.message,
        update: callbackQuery,
        editMessageText: async (text, extra) => {
          const sentMessage = await bot.telegram.editMessageText(
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            null,
            text,
            extra
          );
          return sentMessage;
        }
      };

      await renderer.render(result, ctx);

      // 상태에 메시지 ID 저장
      this.userStates.set(userId, {
        type: "waiting_question",
        fortuneType: params || "celtic",
        timestamp: Date.now(),
        promptMessageId: callbackQuery.message.message_id // 🔥 중요
      });
    }

    return result;
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
      todayCount: limitCheck.todayCount,
      remainingDraws: limitCheck.remainingDraws
    };
  }

  /*  헬퍼 메서드 자연어 질문 프롬프트 검증 로직 */

  isValidQuestion(text) {
    if (!text || typeof text !== "string") return false;

    // 공백 제거한 텍스트
    const trimmed = text.trim();

    // 너무 짧으면 false
    if (trimmed.length < 3) return false;

    // 같은 문자가 전체의 50% 이상이면 false
    const charCounts = {};
    for (const char of trimmed) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(charCounts));
    if (maxCount > trimmed.length * 0.5) {
      return false;
    }

    // 의미 있는 단어가 하나라도 있는지 체크
    const meaningfulWords = [
      "사랑",
      "일",
      "직장",
      "가족",
      "친구",
      "미래",
      "고민",
      "선택",
      "결정",
      "관계",
      "건강",
      "돈",
      "학업",
      "시험",
      "이직",
      "결혼",
      "연애",
      "프로젝트",
      "계획",
      "목표",
      "재회",
      "후폭풍"
    ];

    const hasMeaningfulWord = meaningfulWords.some((word) =>
      text.includes(word)
    );

    // 의미 있는 단어가 있으면 통과
    if (hasMeaningfulWord) return true;

    // 1. 반복 패턴 체크 (ㄴㅇㄹ, ㅋㅋㅋ, ㅎㅎㅎ 등)
    const repetitivePattern = /(.)\1{4,}|(.{2,3})\2{2,}/;
    if (repetitivePattern.test(text)) {
      return false;
    }

    // 2. 자음/모음만 있는지 체크
    const onlyConsonantsOrVowels = /^[ㄱ-ㅎㅏ-ㅣ\s]+$/;
    if (onlyConsonantsOrVowels.test(text)) {
      return false;
    }

    // 3. 의미 없는 키보드 패턴 체크
    const keyboardPatterns = [
      /^[ㅁㄴㅇㄹ\s]+$/, // ㅁㄴㅇㄹ 조합
      /^[ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ\s]+$/, // 키보드 왼쪽
      /^[ㅋㅌㅊㅍㅠㅜㅡ\s]+$/, // 키보드 오른쪽
      /^[qwerty\s]+$/i, // qwerty
      /^[asdfgh\s]+$/i, // asdf
      /^[zxcvbn\s]+$/i // zxcv
    ];

    if (keyboardPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }

    // 4. 완성된 한글 글자가 최소 2개 이상 있는지 체크
    const completeKoreanChars = text.match(/[가-힣]/g);
    if (!completeKoreanChars || completeKoreanChars.length < 2) {
      return false;
    }

    // 5. 숫자나 특수문자만 있는지 체크 (수정된 부분)
    const onlyNumbersOrSpecial = /^[\d\s!@#$%^&*()\-_+=[\]{};:'"<>,.?/\\|`~]+$/;
    if (onlyNumbersOrSpecial.test(text)) {
      return false;
    }

    return true;
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
  interpretCelticCore(cards) {
    const present = cards[0];
    const challenge = cards[1];
    const kph = KoreanPostpositionHelper;
    const presentName = `*${present.korean}*${present.isReversed ? " (역방향)" : ""}`;
    const challengeName = `*${challenge.korean}*${challenge.isReversed ? " (역방향)" : ""}`;
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
      interpretation += `**${positions[index]}**: ${card.emoji} ${card.korean}${card.isReversed ? " (역)" : ""}\n`;
    });
    interpretation += "\n과거에서 미래로 이어지는 명확한 흐름이 보입니다.";
    return interpretation;
  }
  interpretCelticInfluences(cards) {
    const positions = ["당신의 접근", "외부 환경", "희망과 두려움"];
    let interpretation = "";
    cards.forEach((card, index) => {
      interpretation += `**${positions[index]}**: ${card.emoji} ${card.korean}${card.isReversed ? " (역)" : ""}\n`;
    });
    interpretation += "\n내면과 외부의 영향이 조화를 이루고 있습니다.";
    return interpretation;
  }
  interpretCelticOutcome(card) {
    const kph = KoreanPostpositionHelper;
    let interpretation = `최종 결과는 *${card.emoji} ${kph.a(card.korean, "으로/로")}*`;
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
    if (majorCount >= 5) message += "매우 중요한 인생의 전환점에 있습니다. ";
    if (reversedCount >= 5)
      message +=
        "많은 에너지가 내면으로 향하고 있습니다. 성찰이 필요한 시기입니다. ";
    if (result.question)
      message += `"${result.question}"에 대한 답은 카드들이 보여주는 여정 속에 있습니다.`;
    else message += "카드들이 보여주는 메시지를 깊이 성찰해보세요.";
    return message;
  }
  async resetDailyLimit(bot, callbackQuery) {
    const user = callbackQuery.from;
    if (!isDeveloper(user))
      return {
        type: "error",
        module: "fortune",
        data: { message: "개발자만 사용 가능한 기능입니다." }
      };
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
