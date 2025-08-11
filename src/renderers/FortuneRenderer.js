const BaseRenderer = require("./BaseRenderer");
const _logger = require('../utils/core/Logger');

/**
 * 🔮 FortuneRenderer - 타로 카드 UI 렌더링 (콜백 버튼 수정)
 */
class FortuneRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "fortune";
  }

  async render(result, ctx) {
    const { type, data } = result;
    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "draw_result":
        return await this.renderDrawResult(data, ctx);
      case "question_prompt":
        return await this.renderQuestionPrompt(data, ctx);
      case "question_error":
        return await this.renderQuestionError(data, ctx);
      case "celtic_result":
        return await this.renderCelticResult(data, ctx);
      case "daily_limit":
        return await this.renderDailyLimit(data, ctx);
      case "celtic_detail":
        return await this.renderCelticDetail(data, ctx);
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

  async renderMenu(data, ctx) {
    const {
      userName,
      todayCount,
      maxDrawsPerDay,
      canDraw,
      fortuneTypes,
      isDeveloper,
      remainingDraws
    } = data;
    let text = `🔮 *타로 카드 운세*\n\n*${userName}님*, 신비로운 타로의 세계에 오신 것을 환영합니다.\n\n`;

    text += `📊 *오늘의 현황*\n`;
    if (isDeveloper) {
      text += `• 뽑은 횟수: ${todayCount}번 (개발자 모드)\n`;
      text += `• 남은 횟수: 무제한\n\n`;
    } else {
      text += `• 뽑은 횟수: ${todayCount}/${maxDrawsPerDay}번\n`;
      text += `• 남은 횟수: ${remainingDraws}번\n\n`;
    }

    if (canDraw) {
      text += `_어떤 운세를 알아보시겠어요?_`;
    } else {
      text += `오늘은 더 이상 뽑을 수 없습니다. 내일 다시 새로운 운세를 확인해보세요! 🌅`;
    }

    const buttons = [];
    if (canDraw) {
      const typeEntries = Object.entries(fortuneTypes);
      for (let i = 0; i < typeEntries.length; i += 2) {
        const row = [];
        row.push({
          text: `${typeEntries[i][1].emoji} ${typeEntries[i][1].label}`,
          action: "draw",
          params: typeEntries[i][0]
        });
        if (i + 1 < typeEntries.length) {
          row.push({
            text: `${typeEntries[i + 1][1].emoji} ${typeEntries[i + 1][1].label}`,
            action: "draw",
            params: typeEntries[i + 1][0]
          });
        }
        buttons.push(row);
      }
    }
    if (isDeveloper)
      buttons.push([{ text: "🔧 일일 제한 리셋", action: "reset" }]);

    buttons.push([
      { text: "📊 통계", action: "stats" },
      { text: "📋 기록", action: "history" }
    ]);
    buttons.push([{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons, this.moduleName)
    });
  }

  async renderDrawResult(data, ctx) {
    const {
      cards,
      type: drawType,
      fortuneType,
      interpretation,
      remainingDraws,
      todayCount,
      todayDraws,
      message
    } = data;
    let text = `✨ *${fortuneType?.label || this.getFortuneTypeName(drawType)} 결과*\n\n`;

    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length > 1) {
      text += `*${cards.length}의 조언*\n\n`;
      if (drawType === "triple") {
        const positions = ["*과거*", "*현재*", "*미래*"];
        cards.forEach((card, index) => {
          const position = (card.position =
            card.positionName || positions[index] || `${index + 1}번째`);
          text += `*${position}*: ${card.emoji || "🎴"} ${card.korean || card.name}\n`;

          if (card.isReversed) {
            text += `🔄 역방향 - `;
          }

          text += `${interpretation.cards[index]?.meaning || "해석을 불러오는 중..."}\n\n`;
        });

        text += `🎯 *종합 해석*\n${interpretation.overall || "종합적인 흐름을 파악해보세요."}\n\n`;
      }
    } else if (drawType === "single" && cards && cards.length === 1) {
      const card = cards[0];

      text += `🎴 *뽑힌 카드*\n`;
      text += `${card.emoji || "🎴"} *${card.korean || card.name}*\n`;

      if (card.name && card.korean !== card.name) {
        text += `(${card.name})\n`;
      }

      text += `\n`;

      if (card.isReversed) {
        text += `🔄 *역방향 카드*\n평소와는 다른 관점에서 해석해보세요.\n\n`;
      } else {
        text += `⬆️ *정방향 카드*\n카드의 기본 의미가 그대로 적용됩니다.\n\n`;
      }

      text += `💫 *의미*: ${interpretation.cards[0]?.meaning || "카드의 기본 의미가 그대로 적용됩니다."}\n\n`;
    }

    if (interpretation && interpretation.advice) {
      const advicePrefix = `${data.userName}님을 위한 조언:`;
      let finalAdvice = interpretation.advice;
      if (finalAdvice.startsWith(advicePrefix)) {
        finalAdvice = finalAdvice.substring(advicePrefix.length).trim();
      }
      text += `💡 *조언*: ${finalAdvice}\n\n`;
    }

    // 남은 횟수 표시 부분 수정
    const actualTodayCount = todayCount ?? todayDraws ?? "?";
    const remainingText =
      remainingDraws === Infinity
        ? "무제한"
        : remainingDraws !== null && remainingDraws !== undefined
          ? `${remainingDraws}번`
          : "?번";

    text += `🔔 *남은 횟수*: ${remainingText} (오늘 ${actualTodayCount}번 뽑음)`;

    const buttons = [
      [
        {
          text: "🎴 다시 뽑기",
          action: "draw",
          params: drawType // 현재 뽑은 타입을 전달
        },
        { text: "📊 통계", action: "stats" }
      ],
      [
        { text: "📋 기록", action: "history" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderCelticResult(data, ctx) {
    const { cards, question, message } = data;
    let text = `✨ *캘틱 크로스 결과*\n\n`;
    if (question) {
      text += `❓ *질문*: ${question}\n\n`;
    }
    if (message) {
      text += `💬 ${message}\n\n`;
    }
    text += `🔮 *10장의 카드가 펼쳐졌습니다*\n\n`;
    if (cards && cards.length === 10) {
      const positionNames = {
        present: "현재 상황",
        challenge: "도전/장애물",
        distant_past: "원인/과거",
        recent_past: "최근 과거",
        future: "가능한 미래",
        immediate_future: "가까운 미래",
        approach: "당신의 접근법",
        environment: "외부 환경",
        hopes_fears: "희망과 두려움",
        outcome: "최종 결과"
      };
      cards.forEach((card, index) => {
        const position = card.position || Object.keys(positionNames)[index];
        const positionName =
          positionNames[position] || card.positionName || `${index + 1}번째`;
        text += `${index + 1}. *${positionName}*\n`;
        text += `   ${card.emoji || "🎴"} ${card.korean || card.name}`;
        if (card.isReversed) {
          text += ` (역방향)`;
        } else {
          text += ` (정방향)`;
        }
        text += `\n\n`;
      });
    }
    text += `💫 *해석을 원하시면 아래 버튼을 눌러주세요*`;
    const buttons = [
      [
        { text: "📋 상세 해석", action: "celtic_detail" },
        { text: "🔮 새 질문", action: "draw", params: "celtic" }
      ],
      [
        { text: "📊 통계", action: "stats" },
        { text: "📋 기록", action: "history" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderQuestionPrompt(data, ctx) {
    const { fortuneTypeLabel } = data;
    let text = `❓ *${fortuneTypeLabel} 질문 입력*\n\n`;
    text += `무엇이 궁금하신가요? 고민을 들려주세요.\n\n`;
    text += `💭 *예시*\n`;
    text += `• "최근 시작한 프로젝트가 잘 될까요?"\n`;
    text += `• "현재 관계에서 어떤 선택을 해야 할까요?"\n`;
    text += `• "다음 달 계획하는 일이 순조롭게 진행될까요?"\n\n`;
    text += `📏 *10자 이상, 100자 이하로 입력해주세요*`;

    const keyboard = this.createInlineKeyboard(
      [[{ text: "🙅 그만두기", action: "menu" }]],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderQuestionError(data, ctx) {
    const text = `❌ *입력 오류*\n\n${data.message}\n\n다시 입력해주세요.`;
    const keyboard = this.createInlineKeyboard(
      [[{ text: "❌ 취소", action: "menu" }]],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderDailyLimit(data, ctx) {
    const { used, max } = data;
    const text = `🚫 *일일 제한 도달*\n\n오늘은 이미 ${used}/${max}번의 운세를 모두 뽑으셨습니다.\n내일 다시 새로운 운세를 확인해보세요! 🌅`;
    const buttons = [
      [
        { text: "📊 통계 보기", action: "stats" },
        { text: "📋 기록 보기", action: "history" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderShuffleResult(data, ctx) {
    const text = `🔄 *카드 셔플 완료*\n\n${data.message}\n\n이제 새로운 기운으로 운세를 뽑아보세요! ✨`;
    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderStats(data, ctx) {
    const { userName, totalDraws = 0, todayDraws = 0, favoriteCard } = data;
    let text = `📊 *${userName}님의 타로 통계*\n\n`;
    text += `🎴 *전체 통계*\n`;
    text += `• 총 뽑기 횟수: ${totalDraws}번\n`;
    text += `• 오늘 뽑기 횟수: ${todayDraws}번\n`;
    if (favoriteCard) {
      text += `• 가장 많이 나온 카드: ${favoriteCard}\n`;
    }
    text += `\n`;
    const level = Math.floor(totalDraws / 10) + 1;
    const nextLevelDraws = level * 10;
    const remaining = nextLevelDraws - totalDraws;
    text += `🏆 *타로 레벨*: ${level}레벨\n`;
    text += `📈 *다음 레벨까지*: ${remaining}번 남음\n\n`;
    text += `계속해서 타로와 소통해보세요! 🔮`;
    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "📋 기록 보기", action: "history" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 기록 렌더링 (핵심 카드 UI 적용)
   */
  async renderHistory(data, ctx) {
    const { userName, records = [], total = 0 } = data;
    let text = `📋 *${userName}님의 타로 기록*\n\n`;

    if (records.length === 0) {
      text += `아직 뽑은 기록이 없습니다.\n\n첫 번째 운세를 뽑아보세요! 🔮`;
    } else {
      text += `**✨ ${userName}님의 핵심 카드 기록** (최근 ${records.length}건)\n\n`;

      records.forEach((record, index) => {
        const { keyCard, date } = record;

        if (keyCard) {
          const cardEmoji = keyCard.emoji || "🎴";
          const cardDisplayName =
            keyCard.name || keyCard.korean || "카드 이름 없음";
          const cardName = `${cardEmoji} *${cardDisplayName}*${keyCard.isReversed ? " (역)" : ""}`;

          text += `${index + 1}. ${cardName} - ${date}\n`;

          // 🔥 meaning과 keywords를 안전하게 처리
          const simpleMeaning = keyCard.meaning
            ? keyCard.meaning.length > 40
              ? keyCard.meaning.substring(0, 40) + "..."
              : keyCard.meaning
            : "해석 없음";

          const keywords =
            keyCard.keywords &&
            Array.isArray(keyCard.keywords) &&
            keyCard.keywords.length > 0
              ? keyCard.keywords.slice(0, 2).join(", ")
              : "키워드 없음";

          text += `   └ _"${simpleMeaning}"_\n`;
          text += `   └ 키워드: ${keywords}\n\n`;
        } else {
          // keyCard가 없는 경우
          text += `${index + 1}. 🎴 *기록 없음* - ${date}\n`;
          text += `   └ _카드 정보를 불러올 수 없습니다_\n\n`;
        }
      });

      if (total > records.length) {
        text += `_...그리고 ${total - records.length}개의 이전 기록들_\n`;
      }
    }

    const buttons = [
      [
        { text: "📊 통계 보기", action: "stats" },
        { text: "🎴 운세 뽑기", action: "draw" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  getFortuneTypeName(type) {
    return (
      { single: "싱글카드", triple: "트리플카드", celtic: "캘틱 크로스" }[
        type
      ] || type
    );
  }

  async renderCelticDetail(data, ctx) {
    const { _userName, question, _cards, detailedInterpretation, timestamp } =
      data;
    let text = `📖 *캘틱 크로스 상세 해석*\n\n`;
    text += `*질문*: "${question}"\n`;
    text += `*뽑은 시간*: ${new Date(timestamp).toLocaleString("ko-KR")}\n\n`;
    if (detailedInterpretation && detailedInterpretation.sections) {
      detailedInterpretation.sections.forEach((section) => {
        text += `*${section.title}*\n${section.content}\n\n`;
      });
    }
    if (detailedInterpretation && detailedInterpretation.overallMessage) {
      text += `💫 *종합 메시지*\n${detailedInterpretation.overallMessage}\n\n`;
    }
    const buttons = [
      [{ text: "🔮 새로운 질문", action: "draw", params: "celtic" }],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = FortuneRenderer;
