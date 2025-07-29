const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserName } = require("../utils/UserHelper");

class FortuneRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "fortune";
  }

  /**
   * 🎯 메인 렌더링 메서드 - 결과 타입별 분기
   */
  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);

      case "today":
      case "love":
      case "money":
        return await this.renderSingleCard(data, ctx, type);

      case "triple":
        return await this.renderTripleCards(data, ctx);

      case "shuffle_only":
        return await this.renderShuffleOnly(data, ctx);

      case "stats":
        return await this.renderStats(data, ctx);

      case "help":
        return await this.renderHelp(data, ctx);

      default:
        return await this.renderError("지원하지 않는 기능입니다.", ctx);
    }
  }

  /**
   * 🔮 운세 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    let text = "🔮 *타로 운세 \\- 두목봇*\n\n";
    text += "안녕하세요\\! 오늘의 운세를 알아보시겠어요\\?\n\n";

    if (data?.stats) {
      const stats = data.stats;
      text += `📊 *개인 통계*\n`;
      text += `• 총 뽑기 횟수: ${this.escapeMarkdownV2(
        String(stats.totalDraws || 0)
      )}회\n`;
      text += `• 연속 뽑기: ${this.escapeMarkdownV2(
        String(stats.currentStreak || 0)
      )}일\n`;
      text += `• 최고 연속: ${this.escapeMarkdownV2(
        String(stats.longestStreak || 0)
      )}일\n\n`;

      if (!stats.canDrawToday) {
        text += "⏰ 오늘은 이미 뽑으셨네요\\! 내일 다시 오세요\\.\n\n";
      }
    }

    text += "원하시는 운세를 선택해주세요\\:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 오늘의 운세", callback_data: "fortune:today" },
          { text: "💕 애정운", callback_data: "fortune:love" },
        ],
        [
          { text: "💰 금전운", callback_data: "fortune:money" },
          { text: "🎴🎴🎴 3장 뽑기", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔀 카드 셔플하기", callback_data: "fortune:shuffle" },
          { text: "📊 내 통계", callback_data: "fortune:stats" },
        ],
        [
          { text: "❓ 도움말", callback_data: "fortune:help" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.chat.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 🎴 단일 카드 렌더링 (셔플 + 결과)
   */
  async renderSingleCard(data, ctx, drawType) {
    const {
      from,
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = ctx.callbackQuery;
    const userName = getUserName(from);

    // 셔플이 필요한 경우 애니메이션 실행
    if (data.needsShuffle) {
      const shuffleMessageId = await AnimationHelper.performShuffle(
        this.bot,
        chatId,
        messageId
      );

      // 실패한 경우 오류 메시지 표시
      if (!data.fortune.success) {
        const errorMessage = this.getErrorMessage(data.fortune.type, userName);
        await this.sendMessage(
          chatId,
          errorMessage,
          this.createBackToMenuKeyboard(),
          shuffleMessageId
        );
        return;
      }

      // 성공한 경우 카드 결과 렌더링
      await this.renderCardResult(
        data.fortune.card,
        drawType,
        chatId,
        shuffleMessageId,
        userName
      );
    }
  }

  /**
   * 🎴 카드 결과 렌더링
   */
  async renderCardResult(card, drawType, chatId, messageId, userName) {
    let text = "";

    switch (drawType) {
      case "today":
        text = "🌟 *오늘의 운세*\n\n";
        break;
      case "love":
        text = "💕 *애정운*\n\n";
        break;
      case "money":
        text = "💰 *금전운*\n\n";
        break;
    }

    text += `🎴 *뽑힌 카드*: ${this.escapeMarkdownV2(card.koreanName)}\n`;
    text += `🔮 *영문명*: ${this.escapeMarkdownV2(card.cardName)}\n`;
    text += `${card.isReversed ? "🔄" : "✨"} *방향*: ${
      card.isReversed ? "역방향" : "정방향"
    }\n\n`;
    text += `📝 *카드 의미*:\n${this.escapeMarkdownV2(
      card.interpretation.message
    )}\n\n`;

    if (card.interpretation.advice) {
      text += `💡 *조언*:\n${this.escapeMarkdownV2(
        card.interpretation.advice
      )}\n\n`;
    }

    // 두목봇 멘트 추가
    const doomockComment = DoomockMessageGenerator.getContextualMessage(
      "cardDrawn",
      userName,
      card
    );
    text += `💬 ${this.escapeMarkdownV2(doomockComment)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 오늘의 운세", callback_data: "fortune:today" },
          { text: "💕 애정운", callback_data: "fortune:love" },
        ],
        [
          { text: "💰 금전운", callback_data: "fortune:money" },
          { text: "🎴🎴🎴 3장 뽑기", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 운세 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 🎴🎴🎴 3장 카드 렌더링
   */
  async renderTripleCards(data, ctx) {
    // 3장 뽑기 렌더링 로직 (기존과 동일하지만 분리됨)
    // ... 구현 생략 (길어서)
  }

  /**
   * 🔀 셔플만 렌더링
   */
  async renderShuffleOnly(data, ctx) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = ctx.callbackQuery;

    // 셔플 애니메이션 실행
    await AnimationHelper.performShuffle(this.bot, chatId, messageId);

    // 완료 메시지
    const text =
      "✨ *카드 셔플 완료*\\!\n\n이제 원하시는 운세를 선택해주세요\\:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 오늘의 운세", callback_data: "fortune:today" },
          { text: "💕 애정운", callback_data: "fortune:love" },
        ],
        [
          { text: "💰 금전운", callback_data: "fortune:money" },
          { text: "🎴🎴🎴 3장 뽑기", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 운세 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 오류 메시지 생성
   */
  getErrorMessage(errorType, userName) {
    if (errorType === "daily_limit") {
      return this.escapeMarkdownV2(
        DoomockMessageGenerator.getContextualMessage(
          "dailyLimitReached",
          userName
        )
      );
    }
    return this.escapeMarkdownV2(
      "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    );
  }

  /**
   * 통계, 도움말 등 기타 렌더링 메서드들...
   */
  async renderStats(data, ctx) {
    /* 구현 */
  }
  async renderHelp(data, ctx) {
    /* 구현 */
  }
  async renderError(message, ctx) {
    /* 구현 */
  }
}
module.exports = FortuneRenderer;
