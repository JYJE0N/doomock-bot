// src/renderers/FortuneRenderer.js - MarkdownV2 완벽 이스케이프 버전

const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🔮 FortuneRenderer - 타로 카드 UI 렌더링 전담
 *
 * ✅ 단순화된 기능:
 * - 원카드 뽑기 (1장)
 * - 트리플카드 뽑기 (3장: 과거/현재/미래)
 * - 카드 셔플
 * - 통계 및 도움말
 *
 * ✅ MarkdownV2 완벽 이스케이프 처리
 */
class FortuneRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "fortune";
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    logger.debug(`🔮 FortuneRenderer: ${type} 타입 렌더링`);

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "single":
          return await this.renderSingleCard(data, ctx);

        case "triple":
          return await this.renderTripleCards(data, ctx);

        case "shuffle_only":
          return await this.renderShuffleOnly(data, ctx);

        case "stats":
          return await this.renderStats(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "알 수 없는 오류가 발생했습니다\\.",
            ctx
          );

        default:
          logger.warn(`🔮 FortuneRenderer: 지원하지 않는 타입 - ${type}`);
          return await this.renderError("지원하지 않는 기능입니다\\.", ctx);
      }
    } catch (error) {
      logger.error(`🔮 FortuneRenderer 렌더링 오류 (${type}):`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다\\.", ctx);
    }
  }

  /**
   * 🔮 타로 메뉴 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderMenu(data, ctx) {
    logger.debug("🔮 타로 메뉴 렌더링");

    let text = "🔮 *타로 카드 \\- 두목봇*\n\n";
    text += "🎴 *신비로운 타로의 세계에 오신 것을 환영합니다\\!*\n\n";

    // 통계 정보 (있으면 표시)
    if (data?.stats) {
      const stats = data.stats;
      text += "📊 *나의 타로 기록*\n";
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
        text += "⏰ *오늘은 이미 뽑으셨네요\\!* 내일 다시 오세요\\.\n\n";
      }
    }

    text += "✨ *어떤 카드를 뽑아보시겠어요\\?*";

    // ✅ 단순화된 키보드
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 원카드 뽑기", callback_data: "fortune:single" },
          { text: "🎴🎴🎴 트리플카드", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔀 카드 셔플", callback_data: "fortune:shuffle" },
          { text: "📊 내 기록", callback_data: "fortune:stats" },
        ],
        [
          { text: "❓ 사용법", callback_data: "fortune:help" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 🎴 원카드 렌더링 - ✅ 완전 단순화
   */
  async renderSingleCard(data, ctx) {
    logger.debug("🎴 원카드 렌더링", { data });

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;
    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    try {
      // 데이터 구조 파싱
      let cardData;
      let needsShuffle = false;
      let isSuccess = true;

      if (data?.fortune) {
        isSuccess = data.fortune.success;
        cardData = data.fortune.card;
        needsShuffle = data.fortune.needsShuffle !== false; // 기본값 true
      } else {
        throw new Error("카드 데이터를 찾을 수 없습니다");
      }

      // 실패한 경우 (일일 제한 등)
      if (!isSuccess) {
        const errorMessage =
          data.fortune.message || "카드를 뽑을 수 없습니다\\.";
        await this.renderErrorWithKeyboard(ctx, errorMessage);
        return;
      }

      // 셔플 애니메이션 실행
      let finalMessageId = messageId;
      if (needsShuffle) {
        try {
          finalMessageId = await AnimationHelper.performShuffle(
            this.bot,
            chatId,
            messageId
          );
        } catch (shuffleError) {
          logger.warn("셔플 애니메이션 실패, 계속 진행:", shuffleError);
        }
      }

      // 카드 결과 표시
      await this.renderSingleCardResult(
        cardData,
        chatId,
        finalMessageId,
        userName
      );
    } catch (error) {
      logger.error("원카드 렌더링 오류:", error);
      await this.renderErrorWithKeyboard(
        ctx,
        "카드를 뽑는 중 오류가 발생했습니다\\."
      );
    }
  }

  /**
   * 🎴 원카드 결과 표시 - ✅ MarkdownV2 완벽 처리
   */
  async renderSingleCardResult(card, chatId, messageId, userName) {
    if (!card) {
      throw new Error("카드 데이터가 없습니다");
    }

    let text = "🎴 *당신의 타로 카드*\n\n";

    // 카드 기본 정보
    text += `✨ *뽑힌 카드*: ${this.escapeMarkdownV2(
      card.koreanName || card.cardName || "알 수 없음"
    )}\n`;

    if (card.cardName && card.koreanName) {
      text += `🔮 *영문명*: ${this.escapeMarkdownV2(card.cardName)}\n`;
    }

    text += `${card.isReversed ? "🔄" : "✨"} *방향*: ${
      card.isReversed ? "역방향" : "정방향"
    }\n\n`;

    // 카드 의미
    if (card.interpretation?.message) {
      text += `📝 *카드의 메시지*:\n${this.escapeMarkdownV2(
        card.interpretation.message
      )}\n\n`;
    }

    // 조언
    if (card.interpretation?.advice) {
      text += `💡 *타로의 조언*:\n${this.escapeMarkdownV2(
        card.interpretation.advice
      )}\n\n`;
    }

    // 두목봇 멘트
    try {
      const doomockComment = this.generateDoomockComment(userName, card);
      text += `💬 ${this.escapeMarkdownV2(doomockComment)}`;
    } catch (msgError) {
      logger.warn("두목봇 멘트 생성 실패:", msgError);
      text += `💬 👔 두목: '${this.escapeMarkdownV2(
        userName
      )}형씨, 좋은 카드네요\\!'`;
    }

    // 키보드
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 새 카드 뽑기", callback_data: "fortune:single" },
          { text: "🎴🎴🎴 트리플카드", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 타로 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 🎴🎴🎴 트리플카드 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderTripleCards(data, ctx) {
    logger.debug("🎴🎴🎴 트리플카드 렌더링", { data });

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;
    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    try {
      // 데이터 구조 안전하게 파싱
      let cards;
      let summary;
      let needsShuffle = false;
      let isSuccess = true;

      // 🚨 수정: 더 안전한 데이터 파싱
      if (data?.fortune) {
        isSuccess = data.fortune.success !== false;

        if (data.fortune.type === "triple_cards") {
          cards = data.fortune.cards;
          summary = data.fortune.interpretation || data.fortune.summary;
          needsShuffle = data.fortune.needsShuffle !== false;
        } else if (
          data.fortune.type === "error" ||
          data.fortune.type === "daily_limit"
        ) {
          // 에러나 일일 제한의 경우
          const errorMessage =
            data.fortune.message || "트리플카드를 뽑을 수 없습니다\\.";
          await this.renderErrorWithKeyboard(ctx, errorMessage);
          return;
        } else if (Array.isArray(data.fortune)) {
          // 레거시 포맷 지원
          cards = data.fortune;
          isSuccess = true;
        }
      }

      // 카드 데이터 검증
      if (!isSuccess || !cards || !Array.isArray(cards) || cards.length !== 3) {
        logger.error("트리플카드 데이터 검증 실패", {
          isSuccess,
          cardsType: typeof cards,
          cardsLength: cards?.length,
        });

        const errorMessage = "트리플카드 데이터를 불러올 수 없습니다\\.";
        await this.renderErrorWithKeyboard(ctx, errorMessage);
        return;
      }

      // 셔플 애니메이션 (에러 발생해도 계속 진행)
      let finalMessageId = messageId;
      if (needsShuffle) {
        try {
          finalMessageId = await AnimationHelper.performShuffle(
            this.bot,
            chatId,
            messageId
          );
        } catch (shuffleError) {
          logger.warn("셔플 애니메이션 실패 (계속 진행):", shuffleError);
        }
      }

      // 트리플카드 결과 표시
      await this.renderTripleCardResult(
        cards,
        summary,
        chatId,
        finalMessageId,
        userName
      );
    } catch (error) {
      logger.error("트리플카드 렌더링 오류:", error);
      await this.renderErrorWithKeyboard(
        ctx,
        "트리플카드를 표시하는 중 오류가 발생했습니다\\."
      );
    }
  }

  /**
   * 🎴🎴🎴 트리플카드 결과 표시 - ✅ MarkdownV2 완벽 처리
   */
  async renderTripleCardResult(cards, summary, chatId, messageId, userName) {
    let text = "🎴🎴🎴 *타로 트리플카드*\n\n";
    text += "✨ *과거\\, 현재\\, 미래를 보여주는 세 장의 카드입니다*\n\n";

    // 각 카드 정보
    const positions = [
      { name: "과거", emoji: "🕰️" },
      { name: "현재", emoji: "⭐" },
      { name: "미래", emoji: "🌟" },
    ];

    cards.forEach((card, index) => {
      const pos = positions[index];
      text += `${pos.emoji} *${pos.name}*: ${this.escapeMarkdownV2(
        card.koreanName || card.cardName
      )}\n`;
      text += `   ${card.isReversed ? "🔄 역방향" : "✨ 정방향"}\n`;

      if (card.interpretation?.message) {
        text += `   📝 ${this.escapeMarkdownV2(card.interpretation.message)}\n`;
      }
      text += "\n";
    });

    // 종합 해석
    if (summary) {
      text += `🔮 *종합 해석*:\n${this.escapeMarkdownV2(summary)}\n\n`;
    }

    // 두목봇 멘트
    const doomockComment = `👔 두목: '${userName}형씨, 과거와 현재를 바탕으로 미래를 준비하세요\\!'`;
    text += `💬 ${this.escapeMarkdownV2(doomockComment)}`;

    // 키보드
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 원카드 뽑기", callback_data: "fortune:single" },
          { text: "🎴🎴🎴 새 트리플카드", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 타로 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 🔀 셔플만 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderShuffleOnly(data, ctx) {
    logger.debug("🔀 카드 셔플 렌더링");

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;

    try {
      // 셔플 애니메이션 실행
      await AnimationHelper.performShuffle(this.bot, chatId, messageId);
    } catch (error) {
      logger.warn("셔플 애니메이션 실패:", error);
    }

    // 완료 메시지
    const text =
      "🔀 *카드 셔플 완료*\\!\n\n✨ 카드들이 새롭게 섞였습니다\\.\n이제 원하시는 뽑기를 선택해주세요:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 원카드 뽑기", callback_data: "fortune:single" },
          { text: "🎴🎴🎴 트리플카드", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 타로 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 📊 통계 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderStats(data, ctx) {
    logger.debug("📊 타로 통계 렌더링");

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;

    let text = "📊 *나의 타로 기록*\n\n";

    if (data?.stats) {
      const stats = data.stats;
      text += `🎴 *총 뽑기 횟수*: ${this.escapeMarkdownV2(
        String(stats.totalDraws || 0)
      )}회\n`;
      text += `⚡ *연속 뽑기*: ${this.escapeMarkdownV2(
        String(stats.currentStreak || 0)
      )}일\n`;
      text += `🏆 *최고 연속*: ${this.escapeMarkdownV2(
        String(stats.longestStreak || 0)
      )}일\n`;
      text += `📅 *이번달 뽑기*: ${this.escapeMarkdownV2(
        String(stats.thisMonthDraws || 0)
      )}회\n\n`;

      if (stats.canDrawToday) {
        text += "✅ *오늘 뽑기 가능합니다\\!*";
      } else {
        text += "⏰ *오늘은 이미 뽑으셨네요\\.*";
      }
    } else {
      text += "아직 타로 기록이 없습니다\\.\n";
      text += "카드를 뽑아보시면 기록이 쌓여요\\! 🎴✨";
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 카드 뽑기", callback_data: "fortune:single" },
          { text: "🔮 타로 메뉴", callback_data: "fortune:menu" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * ❓ 도움말 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderHelp(data, ctx) {
    logger.debug("❓ 타로 도움말 렌더링");

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;

    let text = "❓ *타로 카드 사용법*\n\n";
    text += "🔮 *두목봇의 신비로운 타로 카드 기능입니다\\!*\n\n";

    text += "📋 *주요 기능*:\n";
    text += "• 🎴 *원카드 뽑기* \\- 하나의 카드로 간단한 메시지\n";
    text += "• 🎴🎴🎴 *트리플카드* \\- 과거\\, 현재\\, 미래 3장\n";
    text += "• 🔀 *카드 셔플* \\- 카드를 다시 섞기\n";
    text += "• 📊 *내 기록* \\- 뽑기 통계 확인\n\n";

    text += "💡 *사용 팁*:\n";
    text += "• 마음을 집중하고 질문을 떠올려보세요\n";
    text += "• 하루에 한 번만 뽑을 수 있어요\n";
    text += "• 정방향과 역방향의 의미가 달라요\n";
    text += "• 트리플카드는 더 자세한 해석을 제공해요\n\n";

    text += "🎯 *타로는 참고용입니다\\. 즐거운 마음으로 이용하세요\\!*";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎴 원카드 뽑기", callback_data: "fortune:single" },
          { text: "🎴🎴🎴 트리플카드", callback_data: "fortune:triple" },
        ],
        [
          { text: "🔮 타로 메뉴", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * ❌ 오류 메시지 렌더링 - ✅ MarkdownV2 완벽 처리
   */
  async renderError(message, ctx) {
    await this.renderErrorWithKeyboard(ctx, message);
  }

  /**
   * ❌ 오류 메시지 + 키보드 - ✅ MarkdownV2 완벽 처리
   */
  async renderErrorWithKeyboard(ctx, message) {
    logger.debug("❌ 타로 오류 메시지 렌더링", { message });

    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const messageId = ctx.callbackQuery?.message?.message_id;

    let text = "❌ *타로 오류*\n\n";
    text += `${this.escapeMarkdownV2(message)}\n\n`;
    text += "잠시 후 다시 시도해주세요\\.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "fortune:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(chatId, text, keyboard, messageId);
  }

  /**
   * 🎭 두목봇 멘트 생성 - ✅ MarkdownV2 완벽 처리
   */
  generateDoomockComment(userName, card) {
    const comments = [
      `👔 두목: '${userName}형씨, ${card.koreanName} 카드가 나왔네요\\!'`,
      `👔 두목: '${userName}형씨, 좋은 메시지를 담은 카드입니다\\.'`,
      `👔 두목: '${userName}형씨, 이 카드의 조언을 참고해보세요\\.'`,
      `👔 두목: '${userName}형씨, 타로가 전하는 메시지를 마음에 새기세요\\.'`,
      `👔 두목: '${userName}형씨, 신중하게 생각해보시길 바랍니다\\.'`,
    ];

    // 카드별 특별 멘트 (옵션)
    if (card.cardName === "The Fool") {
      return `👔 두목: '${userName}형씨, 새로운 시작의 카드네요\\! 용기를 내세요\\.'`;
    }
    if (card.cardName === "The Sun") {
      return `👔 두목: '${userName}형씨, 태양 카드\\! 오늘은 좋은 일이 있을 것 같아요\\.'`;
    }

    return comments[Math.floor(Math.random() * comments.length)];
  }
}

module.exports = FortuneRenderer;
