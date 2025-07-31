// src/renderers/FortuneRenderer.js - 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const AnimationHelper = require("../utils/AnimationHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🔮 FortuneRenderer - 타로 카드 UI 렌더링 전담 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "fortune:action:params" 형태 표준화
 * - 표준 키보드 생성 메서드 사용
 * - 안전한 메시지 전송 시스템 적용
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 타로 카페의 전문 서빙 시스템
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 표준화된 메뉴판(키보드) 제공
 * - 아름다운 플레이팅(렌더링)으로 서빙
 */
class FortuneRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "fortune";

    // 🎴 타로 특화 설정
    this.config = {
      ...this.config,
      enableAnimations: true,
      showCardEmojis: true,
      maxInterpretationLength: 500,
    };

    // 🎭 이모지 컬렉션
    this.emojis = {
      tarot: "🔮",
      card: "🎴",
      triple: "🎴🎴🎴",
      shuffle: "🔀",
      stats: "📊",
      help: "❓",
      reversed: "🔄",
      upright: "✨",
      past: "🕰️",
      present: "⭐",
      future: "🌟",
      doomock: "👔",
    };

    logger.debug("🔮 FortuneRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, { dataKeys: Object.keys(data || {}) });

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
            data.message || "알 수 없는 오류가 발생했습니다.",
            ctx
          );

        default:
          this.warn(`지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            `지원하지 않는 기능입니다: ${type}`,
            ctx
          );
      }
    } catch (error) {
      this.error(`렌더링 오류 (${type})`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다.", ctx);
    }
  }

  // ===== 🔮 타로 메뉴 렌더링 =====

  /**
   * 🔮 타로 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMenu(data, ctx) {
    this.debug("타로 메뉴 렌더링", { stats: !!data?.stats });

    let text = `${this.emojis.tarot} **타로 카드 \\- 두목봇**\n\n`;
    text += `${this.emojis.card} **신비로운 타로의 세계에 오신 것을 환영합니다\\!**\n\n`;

    // 통계 정보 표시 (있으면)
    if (data?.stats) {
      text += this.formatStatsText(data.stats);
    }

    text += "✨ **어떤 카드를 뽑아보시겠어요\\?**";

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [
      [
        { text: `${this.emojis.card} 원카드 뽑기`, action: "single" },
        { text: `${this.emojis.triple} 트리플카드`, action: "triple" },
      ],
      [
        { text: `${this.emojis.shuffle} 카드 셔플`, action: "shuffle" },
        { text: `${this.emojis.stats} 내 기록`, action: "stats" },
      ],
      [
        { text: `${this.emojis.help} 사용법`, action: "help" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 통계 텍스트 포맷팅
   */
  formatStatsText(stats) {
    let text = `${this.emojis.stats} **나의 타로 기록**\n`;
    text += `• 총 뽑기 횟수: ${stats.totalDraws || 0}회\n`;
    text += `• 연속 뽑기: ${stats.currentStreak || 0}일\n`;
    text += `• 최고 연속: ${stats.longestStreak || 0}일\n\n`;

    if (!stats.canDrawToday) {
      text += "⏰ **오늘은 이미 뽑으셨네요\\!** 내일 다시 오세요\\.\n\n";
    }

    return text;
  }

  // ===== 🎴 원카드 렌더링 =====

  /**
   * 🎴 원카드 렌더링 (완전 리팩토링)
   */
  async renderSingleCard(data, ctx) {
    this.debug("원카드 렌더링", { hasData: !!data });

    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    try {
      // 데이터 검증 및 파싱
      const cardResult = this.parseSingleCardData(data);

      if (!cardResult.success) {
        return await this.renderError(cardResult.error, ctx);
      }

      const { card, needsShuffle } = cardResult;

      // 셔플 애니메이션 실행 (옵션)
      if (needsShuffle && this.config.enableAnimations) {
        await this.performShuffleAnimation(ctx);
      }

      // 카드 결과 렌더링
      await this.renderSingleCardResult(card, userName, ctx);
    } catch (error) {
      this.error("원카드 렌더링 실패", error);
      await this.renderError("카드를 뽑는 중 오류가 발생했습니다.", ctx);
    }
  }

  /**
   * 🔧 원카드 데이터 파싱
   */
  parseSingleCardData(data) {
    if (!data?.fortune) {
      return { success: false, error: "카드 데이터를 찾을 수 없습니다." };
    }

    const { fortune } = data;

    if (!fortune.success) {
      return {
        success: false,
        error: fortune.message || "카드를 뽑을 수 없습니다.",
      };
    }

    if (!fortune.card) {
      return { success: false, error: "카드 정보가 없습니다." };
    }

    return {
      success: true,
      card: fortune.card,
      needsShuffle: fortune.needsShuffle !== false,
    };
  }

  /**
   * 🎴 원카드 결과 표시
   */
  async renderSingleCardResult(card, userName, ctx) {
    let text = `${this.emojis.card} **당신의 타로 카드**\n\n`;

    // 카드 기본 정보
    text += `✨ **뽑힌 카드**: ${
      card.koreanName || card.cardName || "알 수 없음"
    }\n`;

    if (card.cardName && card.koreanName) {
      text += `${this.emojis.tarot} **영문명**: ${card.cardName}\n`;
    }

    text += `${
      card.isReversed ? this.emojis.reversed : this.emojis.upright
    } **방향**: ${card.isReversed ? "역방향" : "정방향"}\n\n`;

    // 카드 의미
    if (card.interpretation?.message) {
      text += `📝 **카드의 메시지**:\n${card.interpretation.message}\n\n`;
    }

    // 조언
    if (card.interpretation?.advice) {
      text += `💡 **타로의 조언**:\n${card.interpretation.advice}\n\n`;
    }

    // 두목봇 멘트
    text += this.generateDoomockComment(userName, card);

    // 표준 키보드 생성
    const buttons = [
      [
        { text: `${this.emojis.card} 새 카드 뽑기`, action: "single" },
        { text: `${this.emojis.triple} 트리플카드`, action: "triple" },
      ],
      [
        { text: `${this.emojis.tarot} 타로 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎴🎴🎴 트리플카드 렌더링 =====

  /**
   * 🎴🎴🎴 트리플카드 렌더링 (파서 규칙 적용)
   */
  async renderTripleCards(data, ctx) {
    this.debug("트리플카드 렌더링", { hasData: !!data });

    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    try {
      // 데이터 검증 및 파싱
      const cardResult = this.parseTripleCardData(data);

      if (!cardResult.success) {
        return await this.renderError(cardResult.error, ctx);
      }

      const { cards, summary, needsShuffle } = cardResult;

      // 셔플 애니메이션 실행 (옵션)
      if (needsShuffle && this.config.enableAnimations) {
        await this.performShuffleAnimation(ctx);
      }

      // 트리플카드 결과 렌더링
      await this.renderTripleCardResult(cards, summary, userName, ctx);
    } catch (error) {
      this.error("트리플카드 렌더링 실패", error);
      await this.renderError(
        "트리플카드를 표시하는 중 오류가 발생했습니다.",
        ctx
      );
    }
  }

  /**
   * 🔧 트리플카드 데이터 파싱
   */
  parseTripleCardData(data) {
    if (!data?.fortune) {
      return { success: false, error: "카드 데이터를 찾을 수 없습니다." };
    }

    const { fortune } = data;

    // 에러 케이스 처리
    if (fortune.type === "error" || fortune.type === "daily_limit") {
      return {
        success: false,
        error: fortune.message || "트리플카드를 뽑을 수 없습니다.",
      };
    }

    // 성공 케이스 검증
    if (!fortune.success) {
      return {
        success: false,
        error: fortune.message || "트리플카드를 뽑을 수 없습니다.",
      };
    }

    // 카드 데이터 검증
    const cards = fortune.cards || fortune; // 레거시 지원
    if (!Array.isArray(cards) || cards.length !== 3) {
      return {
        success: false,
        error: "트리플카드 데이터가 올바르지 않습니다.",
      };
    }

    return {
      success: true,
      cards,
      summary: fortune.interpretation || fortune.summary,
      needsShuffle: fortune.needsShuffle !== false,
    };
  }

  /**
   * 🎴🎴🎴 트리플카드 결과 표시
   */
  async renderTripleCardResult(cards, summary, userName, ctx) {
    let text = `${this.emojis.triple} **타로 트리플카드**\n\n`;
    text += "✨ **과거\\, 현재\\, 미래를 보여주는 세 장의 카드입니다**\n\n";

    // 카드 위치 정보
    const positions = [
      { name: "과거", emoji: this.emojis.past },
      { name: "현재", emoji: this.emojis.present },
      { name: "미래", emoji: this.emojis.future },
    ];

    // 각 카드 정보 표시
    cards.forEach((card, index) => {
      const pos = positions[index];
      text += `${pos.emoji} **${pos.name}**: ${
        card.koreanName || card.cardName
      }\n`;
      text += `   ${
        card.isReversed ? this.emojis.reversed : this.emojis.upright
      } ${card.isReversed ? "역방향" : "정방향"}\n`;

      if (card.interpretation?.message) {
        text += `   📝 ${card.interpretation.message}\n`;
      }
      text += "\n";
    });

    // 종합 해석
    if (summary) {
      text += `${this.emojis.tarot} **종합 해석**:\n${summary}\n\n`;
    }

    // 두목봇 멘트
    text += this.generateTripleDoomockComment(userName);

    // 표준 키보드 생성
    const buttons = [
      [
        { text: `${this.emojis.card} 원카드 뽑기`, action: "single" },
        { text: `${this.emojis.triple} 새 트리플카드`, action: "triple" },
      ],
      [
        { text: `${this.emojis.tarot} 타로 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🔀 셔플 전용 렌더링 =====

  /**
   * 🔀 셔플만 렌더링
   */
  async renderShuffleOnly(data, ctx) {
    this.debug("셔플 전용 렌더링");

    try {
      // 셔플 애니메이션 실행
      if (this.config.enableAnimations) {
        await this.performShuffleAnimation(ctx);
      }

      // 완료 메시지
      const text = `${this.emojis.shuffle} **카드 셔플 완료**\\!\n\n✨ 카드들이 새롭게 섞였습니다\\.\n이제 원하시는 뽑기를 선택해주세요:`;

      const buttons = [
        [
          { text: `${this.emojis.card} 원카드 뽑기`, action: "single" },
          { text: `${this.emojis.triple} 트리플카드`, action: "triple" },
        ],
        [
          { text: `${this.emojis.tarot} 타로 메뉴`, action: "menu" },
          this.createHomeButton(),
        ],
      ];

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      await this.sendSafeMessage(ctx, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      this.error("셔플 렌더링 실패", error);
      await this.renderError("셔플 중 오류가 발생했습니다.", ctx);
    }
  }

  // ===== 📊 통계 렌더링 =====

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    this.debug("통계 렌더링", { hasStats: !!data?.stats });

    let text = `${this.emojis.stats} **나의 타로 기록**\n\n`;

    if (data?.stats) {
      const stats = data.stats;
      text += `${this.emojis.card} **총 뽑기 횟수**: ${
        stats.totalDraws || 0
      }회\n`;
      text += `⚡ **연속 뽑기**: ${stats.currentStreak || 0}일\n`;
      text += `🏆 **최고 연속**: ${stats.longestStreak || 0}일\n`;
      text += `📅 **이번달 뽑기**: ${stats.thisMonthDraws || 0}회\n\n`;

      if (stats.canDrawToday) {
        text += "✅ **오늘 뽑기 가능합니다\\!**";
      } else {
        text += "⏰ **오늘은 이미 뽑으셨네요\\.**";
      }
    } else {
      text += "아직 타로 기록이 없습니다\\.\n";
      text += "카드를 뽑아보시면 기록이 쌓여요\\! 🎴✨";
    }

    const buttons = [
      [
        { text: `${this.emojis.card} 카드 뽑기`, action: "single" },
        { text: `${this.emojis.tarot} 타로 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ❓ 도움말 렌더링 =====

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("도움말 렌더링");

    let text = `${this.emojis.help} **타로 카드 사용법**\n\n`;
    text += `${this.emojis.tarot} **두목봇의 신비로운 타로 카드 기능입니다\\!**\n\n`;

    text += "📋 **주요 기능**:\n";
    text += `• ${this.emojis.card} **원카드 뽑기** \\- 하나의 카드로 간단한 메시지\n`;
    text += `• ${this.emojis.triple} **트리플카드** \\- 과거\\, 현재\\, 미래 3장\n`;
    text += `• ${this.emojis.shuffle} **카드 셔플** \\- 카드를 다시 섞기\n`;
    text += `• ${this.emojis.stats} **내 기록** \\- 뽑기 통계 확인\n\n`;

    text += "💡 **사용 팁**:\n";
    text += "• 마음을 집중하고 질문을 떠올려보세요\n";
    text += "• 하루에 한 번만 뽑을 수 있어요\n";
    text += "• 정방향과 역방향의 의미가 달라요\n";
    text += "• 트리플카드는 더 자세한 해석을 제공해요\n\n";

    text += "🎯 **타로는 참고용입니다\\. 즐거운 마음으로 이용하세요\\!**";

    const buttons = [
      [
        { text: `${this.emojis.card} 원카드 뽑기`, action: "single" },
        { text: `${this.emojis.triple} 트리플카드`, action: "triple" },
      ],
      [
        { text: `${this.emojis.tarot} 타로 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎭 헬퍼 메서드들 =====

  /**
   * 🔀 셔플 애니메이션 실행
   */
  async performShuffleAnimation(ctx) {
    try {
      const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await AnimationHelper.performShuffle(this.bot, chatId, messageId);
      }
    } catch (error) {
      this.warn("셔플 애니메이션 실패 (계속 진행)", error);
    }
  }

  /**
   * 🎭 두목봇 멘트 생성 (원카드용)
   */
  generateDoomockComment(userName, card) {
    const baseComments = [
      `${this.emojis.doomock} 두목: '${userName}님, ${
        card.koreanName || card.cardName
      } 카드가 나왔네요\\!'`,
      `${this.emojis.doomock} 두목: '${userName}님, 좋은 메시지를 담은 카드입니다\\.'`,
      `${this.emojis.doomock} 두목: '${userName}님, 이 카드의 조언을 참고해보세요\\.'`,
      `${this.emojis.doomock} 두목: '${userName}님, 타로가 전하는 메시지를 마음에 새기세요\\.'`,
      `${this.emojis.doomock} 두목: '${userName}님, 신중하게 생각해보시길 바랍니다\\.'`,
    ];

    // 특별한 카드별 멘트
    const specialComments = {
      "The Fool": `${this.emojis.doomock} 두목: '${userName}님, 새로운 시작의 카드네요\\! 용기를 내세요\\.'`,
      "The Sun": `${this.emojis.doomock} 두목: '${userName}님, 태양 카드\\! 오늘은 좋은 일이 있을 것 같아요\\.'`,
      "The Star": `${this.emojis.doomock} 두목: '${userName}님, 희망의 별 카드입니다\\. 꿈을 포기하지 마세요\\.'`,
      Death: `${this.emojis.doomock} 두목: '${userName}님, 변화와 새로운 시작을 의미하는 카드네요\\.'`,
    };

    return (
      specialComments[card.cardName] ||
      baseComments[Math.floor(Math.random() * baseComments.length)]
    );
  }

  /**
   * 🎭 두목봇 멘트 생성 (트리플카드용)
   */
  generateTripleDoomockComment(userName) {
    const comments = [
      `${this.emojis.doomock} 두목: '${userName}님, 과거와 현재를 바탕으로 미래를 준비하세요\\!'`,
      `${this.emojis.doomock} 두목: '${userName}님, 세 장의 카드가 전하는 메시지를 잘 들어보세요\\.'`,
      `${this.emojis.doomock} 두목: '${userName}님, 시간의 흐름 속에서 지혜를 찾으시길\\.'`,
      `${this.emojis.doomock} 두목: '${userName}님, 과거를 교훈삼아 현재에 충실하고 미래를 준비하세요\\.'`,
    ];

    return comments[Math.floor(Math.random() * comments.length)];
  }

  // ===== 🧪 레거시 호환성 메서드들 =====

  /**
   * 📤 레거시 메시지 전송 (호환성 유지)
   * @deprecated BaseRenderer.sendSafeMessage 사용 권장
   */
  async sendMessage(chatId, text, keyboard, messageId) {
    try {
      const options = {
        reply_markup: keyboard,
        parse_mode: this.config.defaultParseMode,
      };

      if (messageId) {
        return await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        return await this.bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      this.warn("레거시 메시지 전송 실패, 안전 모드로 전환", error);

      // 안전한 전송으로 폴백
      const ctx = {
        chat: { id: chatId },
        callbackQuery: messageId
          ? { message: { message_id: messageId } }
          : null,
      };

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }
  }
}

module.exports = FortuneRenderer;
