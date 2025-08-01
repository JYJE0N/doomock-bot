// src/renderers/FortuneRenderer.js - 2열 배치 수정

const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneRenderer - 타로 카드 UI 렌더링 (2열 배치 개선)
 */
class FortuneRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "fortune";
  }

  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "draw_select":
        return await this.renderDrawSelect(data, ctx);
      case "draw_result":
        return await this.renderDrawResult(data, ctx);
      case "custom_result":
        return await this.renderCustomResult(data, ctx);
      case "question_prompt":
        return await this.renderQuestionPrompt(data, ctx);
      case "question_error":
        return await this.renderQuestionError(data, ctx);
      case "daily_limit":
        return await this.renderDailyLimit(data, ctx);
      case "shuffle_result":
        return await this.renderShuffleResult(data, ctx);
      case "stats":
        return await this.renderStats(data, ctx);
      case "history":
        return await this.renderHistory(data, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError(
          { message: "지원하지 않는 기능입니다." },
          ctx
        );
    }
  }

  /**
   * 🔮 메뉴 렌더링 (2열 배치 개선!)
   */
  async renderMenu(data, ctx) {
    const { userName, todayCount, maxDraws, canDraw, fortuneTypes } = data;

    let text = `🔮 **타로 카드 운세**\n\n`;
    text += `신비로운 타로의 세계에 오신 것을 환영합니다, ${userName}님!\n\n`;

    text += `📊 **오늘의 현황**\n`;
    text += `• 뽑은 횟수: ${todayCount}/${maxDraws}번\n`;

    if (canDraw) {
      text += `• 남은 횟수: ${maxDraws - todayCount}번\n\n`;
      text += `어떤 운세를 알아보시겠어요?`;
    } else {
      text += `• 오늘은 더 이상 뽑을 수 없습니다\n\n`;
      text += `내일 다시 새로운 운세를 확인해보세요! 🌅`;
    }

    const buttons = [];

    if (canDraw) {
      // 🎯 운세 타입 버튼들을 2열로 배치
      const fortuneTypeEntries = Object.entries(fortuneTypes);

      for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
        const row = [];

        // 첫 번째 운세 타입
        const [key1, config1] = fortuneTypeEntries[i];
        row.push({
          text: `${config1.emoji} ${config1.label}`,
          action: "draw",
          params: key1,
        });

        // 두 번째 운세 타입 (있으면)
        if (i + 1 < fortuneTypeEntries.length) {
          const [key2, config2] = fortuneTypeEntries[i + 1];
          row.push({
            text: `${config2.emoji} ${config2.label}`,
            action: "draw",
            params: key2,
          });
        }

        buttons.push(row);
      }

      // 카드 셔플 버튼 (1열)
      buttons.push([{ text: "🔄 카드 셔플", action: "shuffle" }]);
    }

    // 통계/기록 버튼 (2열)
    buttons.push([
      { text: "📊 통계", action: "stats" },
      { text: "📋 기록", action: "history" },
    ]);

    // 메인 메뉴 버튼 (1열)
    buttons.push([{ text: "🔙 메인 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(
      buttons,
      canDraw ? this.moduleName : "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🃏 운세 타입 선택 렌더링 (2열 배치)
   */
  async renderDrawSelect(data, ctx) {
    const { fortuneTypes, remaining } = data;

    let text = `🃏 **운세 선택**\n\n`;
    text += `💫 **남은 횟수**: ${remaining}번\n\n`;
    text += `어떤 종류의 운세를 알아보시겠어요?`;

    const buttons = [];

    // 🎯 운세 타입 버튼들을 2열로 배치
    const fortuneTypeEntries = Object.entries(fortuneTypes);

    for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
      const row = [];

      // 첫 번째 운세 타입
      const [key1, config1] = fortuneTypeEntries[i];
      row.push({
        text: `${config1.emoji} ${config1.label}`,
        action: "draw",
        params: key1,
      });

      // 두 번째 운세 타입 (있으면)
      if (i + 1 < fortuneTypeEntries.length) {
        const [key2, config2] = fortuneTypeEntries[i + 1];
        row.push({
          text: `${config2.emoji} ${config2.label}`,
          action: "draw",
          params: key2,
        });
      }

      buttons.push(row);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ✨ 운세 결과 렌더링
   */
  async renderDrawResult(data, ctx) {
    const { card, cards, fortuneType, remaining } = data;

    let text = `✨ **${fortuneType.label} 결과**\n\n`;

    if (cards) {
      // 삼카드 결과
      text += `🔮 **삼카드 리딩**\n\n`;
      cards.forEach((c, index) => {
        const positions = ["과거", "현재", "미래"];
        text += `**${positions[index]}**: ${c.emoji} ${c.korean}\n`;
        text += `${c.meaning}\n\n`;
      });

      if (data.interpretation) {
        text += `🎯 **종합 해석**\n${data.interpretation}\n\n`;
      }
    } else if (card) {
      // 단일 카드 결과
      text += `🎴 **뽑힌 카드**\n`;
      text += `${card.emoji} **${card.korean}** (${card.name})\n\n`;

      if (card.isReversed) {
        text += `🔄 **역방향 카드**\n`;
      }

      text += `💫 **의미**: ${card.meaning}\n\n`;

      if (card.advice) {
        text += `💡 **조언**: ${card.advice}\n\n`;
      }

      if (card.interpretation) {
        text += `🎯 **해석**: ${card.interpretation}\n\n`;
      }
    }

    text += `💫 **남은 횟수**: ${remaining}번`;

    const buttons = [
      [
        { text: "🎴 다시 뽑기", action: "draw" },
        { text: "🔄 카드 셔플", action: "shuffle" },
      ],
      [
        { text: "📊 통계", action: "stats" },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 커스텀 질문 결과 렌더링
   */
  async renderCustomResult(data, ctx) {
    const { question, card, fortuneType } = data;

    let text = `❓ **${fortuneType.label} 결과**\n\n`;
    text += `**질문**: "${question}"\n\n`;
    text += `🎴 **답변 카드**\n`;
    text += `${card.emoji} **${card.korean}** (${card.name})\n\n`;

    if (card.isReversed) {
      text += `🔄 **역방향 카드**\n`;
    }

    text += `💫 **답변**: ${card.meaning}\n\n`;

    if (card.advice) {
      text += `💡 **조언**: ${card.advice}\n\n`;
    }

    if (card.interpretation) {
      text += `🎯 **해석**: ${card.interpretation}`;
    }

    const buttons = [
      [
        { text: "❓ 다른 질문", action: "draw", params: "custom" },
        { text: "🎴 일반 운세", action: "draw" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 💬 질문 입력 프롬프트 렌더링
   */
  async renderQuestionPrompt(data, ctx) {
    const text = `❓ **질문 운세**

궁금한 것을 자유롭게 질문해주세요.

**예시 질문:**
• "이번 주 중요한 결정을 내려야 하는데 어떻게 해야 할까요?"
• "새로운 도전을 시작해야 할 시기인가요?"
• "지금 내가 집중해야 할 것은 무엇인가요?"

**입력 규칙:**
• 최대 100자
• 구체적이고 명확한 질문

/cancel 명령으로 취소할 수 있습니다.`;

    const buttons = [[{ text: "❌ 취소", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 질문 오류 렌더링
   */
  async renderQuestionError(data, ctx) {
    const text = `❌ **입력 오류**

${data.message}

다시 입력해주세요.`;

    const buttons = [[{ text: "❌ 취소", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🚫 일일 제한 렌더링
   */
  async renderDailyLimit(data, ctx) {
    const { used, max } = data;

    const text = `🚫 **일일 제한 도달**

오늘은 이미 ${used}/${max}번의 운세를 모두 뽑으셨습니다.

내일 다시 새로운 운세를 확인해보세요! 🌅

**운세는 하루에 ${max}번까지만 뽑을 수 있습니다.**`;

    const buttons = [
      [
        { text: "📊 통계 보기", action: "stats" },
        { text: "📋 기록 보기", action: "history" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🔄 셔플 결과 렌더링
   */
  async renderShuffleResult(data, ctx) {
    const text = `🔄 **카드 셔플 완료**

${data.message}

이제 새로운 기운으로 운세를 뽑아보세요! ✨`;

    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    const { userName, stats } = data;

    let text = `📊 **${userName}님의 타로 통계**\n\n`;

    text += `🎴 **전체 통계**\n`;
    text += `• 총 뽑기 횟수: ${stats.totalDraws}번\n`;
    text += `• 오늘 뽑기 횟수: ${stats.todayDraws}번\n`;
    text += `• 연속 뽑기: ${stats.streak}일\n`;
    text += `• 선호 타입: ${this.getFortuneTypeName(stats.favoriteType)}\n`;
    text += `• 만족도: ${stats.accuracy}%\n\n`;

    // 레벨 시스템 (재미 요소)
    const level = Math.floor(stats.totalDraws / 10) + 1;
    const nextLevelDraws = level * 10;
    const remaining = nextLevelDraws - stats.totalDraws;

    text += `🏆 **타로 레벨**: ${level}레벨\n`;
    text += `📈 **다음 레벨까지**: ${remaining}번 남음\n\n`;

    text += `계속해서 타로와 소통해보세요! 🔮`;

    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "📋 기록 보기", action: "history" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 기록 렌더링
   */
  async renderHistory(data, ctx) {
    const { history, totalCount } = data;

    let text = `📋 **타로 뽑기 기록** (${totalCount}건)\n\n`;

    if (history.length === 0) {
      text += `아직 뽑은 기록이 없습니다.\n\n`;
    } else {
      history.slice(0, 10).forEach((record, index) => {
        const cardName =
          record.card?.korean || record.card?.name || "알 수 없음";
        text += `${index + 1}. ${record.date}\n`;
        text += `   ${this.getFortuneTypeName(record.type)} - ${cardName}\n\n`;
      });

      if (history.length > 10) {
        text += `... 그 외 ${history.length - 10}건의 기록\n\n`;
      }
    }

    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "📊 통계 보기", action: "stats" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const text = `❌ **오류 발생**

${data.message}

다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: "🔙 메인 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, "system");

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 운세 타입 이름 변환
   */
  getFortuneTypeName(type) {
    const typeNames = {
      single: "원카드",
      triple: "삼카드",
      love: "연애운",
      work: "사업운",
      custom: "질문",
    };

    return typeNames[type] || type;
  }
}

module.exports = FortuneRenderer;
