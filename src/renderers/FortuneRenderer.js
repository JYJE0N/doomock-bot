const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");

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
      case "draw_select":
        return await this.renderDrawSelect(data, ctx);
      case "draw_result":
        return await this.renderDrawResult(data, ctx);

      case "question_prompt": // ✏️ 이름 변경 및 추가
        return await this.renderQuestionPrompt(data, ctx);
      case "question_error": // ✨ 추가
        return await this.renderQuestionError(data, ctx);

      case "celtic_result": // ✨ 추가
        return await this.renderCelticResult(data, ctx);
      case "daily_limit": // ✨ 추가
        return await this.renderDailyLimit(data, ctx);
      case "celtic_detail": // ✨ 추가
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

  /**
   * 🔮 메뉴 렌더링 (수정된 콜백 버튼)
   */
  async renderMenu(data, ctx) {
    const {
      userName,
      todayCount,
      maxDrawsPerDay,
      canDraw,
      fortuneTypes,
      isDeveloper
    } = data;

    let text = `🔮 *타로 카드 운세*\n\n`;
    text += `*${userName}님!*\n\n신비로운 타로의 세계에\n오신 것을 환영합니다.\n\n`;

    // ✨ 개발자 모드 표시
    if (isDeveloper) {
      text += `👑 *개발자 모드 활성*\n\n`;
    }

    text += `📊 *오늘의 현황*\n`;

    // ✨ 개발자는 무제한으로 표시
    if (isDeveloper) {
      text += `• 뽑은 횟수: ${todayCount}번 (무제한)\n`;
      text += `• 개발자 특권: 일일 제한 없음\n\n`;
      text += `_어떤 운세를 알아보시겠어요?_`;
    } else {
      text += `• 뽑은 횟수: ${todayCount}/${maxDrawsPerDay}번\n`;

      if (canDraw) {
        text += `• 남은 횟수: ${maxDrawsPerDay - todayCount}번\n\n`;
        text += `_어떤 운세를 알아보시겠어요?_`;
      } else {
        text += `• 오늘은 더 이상 뽑을 수 없습니다\n\n`;
        text += `내일 다시 새로운 운세를 확인해보세요! 🌅`;
      }
    }

    const buttons = [];

    // ✨ 개발자는 항상 버튼 표시
    if (canDraw || isDeveloper) {
      const fortuneTypeEntries = Object.entries(fortuneTypes);

      for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
        const row = [];

        const [key1, config1] = fortuneTypeEntries[i];
        row.push({
          text: `${config1.emoji} ${config1.label}`,
          action: "draw",
          params: key1
        });

        if (i + 1 < fortuneTypeEntries.length) {
          const [key2, config2] = fortuneTypeEntries[i + 1];
          row.push({
            text: `${config2.emoji} ${config2.label}`,
            action: "draw",
            params: key2
          });
        }

        buttons.push(row);
      }

      // 카드 셔플 버튼
      buttons.push([{ text: "🔄 카드 셔플", action: "shuffle" }]);
    }

    // 통계/기록 버튼
    buttons.push([
      { text: "📊 통계", action: "stats" },
      { text: "📋 기록", action: "history" }
    ]);

    // 메인 메뉴 버튼
    buttons.push([
      {
        text: "🔙 메인 메뉴",
        action: "menu",
        module: "system"
      }
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🃏 운세 타입 선택 렌더링 (수정된 콜백 버튼)
   */
  async renderDrawSelect(data, ctx) {
    const { fortuneTypes, remaining } = data;

    let text = `🃏 *운세 선택*\n\n`;
    text += `💫 *남은 횟수*: ${remaining}번\n\n`;
    text += `어떤 종류의 운세를 알아보시겠어요?`;

    const buttons = [];

    // 🔧 수정된 운세 타입 버튼들 - 올바른 콜백 데이터 생성
    const fortuneTypeEntries = Object.entries(fortuneTypes);

    for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
      const row = [];

      const [key1, config1] = fortuneTypeEntries[i];
      row.push({
        text: `${config1.emoji} ${config1.label}`,
        action: "draw",
        params: key1 // "single", "triple", "celtic"이 정확히 전달됨
      });

      if (i + 1 < fortuneTypeEntries.length) {
        const [key2, config2] = fortuneTypeEntries[i + 1];
        row.push({
          text: `${config2.emoji} ${config2.label}`,
          action: "draw",
          params: key2 // "single", "triple", "celtic"이 정확히 전달됨
        });
      }

      buttons.push(row);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderDrawResult(data, ctx) {
    const {
      cards,
      type: drawType,
      fortuneType,
      interpretation,
      remainingDraws,
      totalDraws,
      message
    } = data;

    let text = `✨ *${fortuneType?.label || this.getFortuneTypeName(drawType)} 결과*\n\n`;

    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length > 1) {
      // 🔮 다중 카드 결과 (트리플, 캘틱 등)
      text += `🔮 *${cards.length}카드 리딩*\n\n`;

      if (drawType === "triple") {
        const positions = ["과거", "현재", "미래"];

        cards.forEach((card, index) => {
          const position =
            card.position || positions[index] || `${index + 1}번째`;
          text += `*${position}*: ${card.emoji || "🎴"} ${card.korean || card.name}\n`;

          if (card.isReversed) {
            text += `🔄 역방향 - `;
          }

          text += `${interpretation.cards[index]?.meaning || "해석을 불러오는 중..."}\n\n`;
        });

        // 종합 해석
        text += `🎯 *종합 해석*\n`;
        text += `${interpretation.overall || "종합적인 흐름을 파악해보세요."}\n\n`;

        // ✅ 수정: 트리플카드에도 조언 추가!
        if (interpretation.advice) {
          text += `💡 *조언*: ${interpretation.advice}\n\n`;
        }
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
        text += `🔄 *역방향 카드*\n`;
        text += `평소와는 다른 관점에서 해석해보세요.\n\n`;
      } else {
        text += `⬆️ *정방향 카드*\n`;
        text += `카드의 기본 의미가 그대로 적용됩니다.\n\n`;
      }

      text += `💫 *의미*: ${interpretation.cards[0]?.meaning || "카드의 기본 의미가 그대로 적용됩니다."}\n\n`;

      // ✅ 수정: 조건 개선 - interpretation과 advice 모두 체크
      if (interpretation && interpretation.advice) {
        text += `💡 *조언*: ${interpretation.advice}\n\n`;
      } else {
        // ✅ 추가: 기본 조언 제공
        text += `💡 *조언*: 지금이 중요한 시기입니다. 카드의 메시지를 마음에 새기고 최선을 다하세요.\n\n`;
      }
    }

    // ✅ 추가: 모든 타입에 대해 조언이 없으면 기본 조언 제공
    if (!text.includes("💡 *조언*:") && interpretation?.advice) {
      text += `💡 *조언*: ${interpretation.advice}\n\n`;
    }

    // 남은 횟수 표시
    const remainingCount = remainingDraws ?? "?";
    text += `🔔 *남은 횟수*: ${remainingCount}번 (중 ${totalDraws || 0}번 뽑음)`;

    const buttons = [
      [
        { text: "🎴 다시 뽑기", action: "draw" },
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

  /**
   * 🔮 캘틱 크로스 결과 렌더링
   */
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

    // 캘틱 크로스 위치별 표시
    if (cards && cards.length === 10) {
      // ✅ 한글 위치명 사용
      const positionNames = {
        present: "현재 상황",
        challenge: "도전/장애물",
        distant_past: "원인/과거", // past → distant_past
        recent_past: "최근 과거", // 추가
        future: "가능한 미래",
        immediate_future: "가까운 미래", // 추가
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
          text += ` (역방향)`; // ✅ 한글로 변경
        } else {
          text += ` (정방향)`; // ✅ 정방향도 명시
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

  /**
   * 💬 질문 입력 프롬프트 렌더링
   */
  async renderQuestionPrompt(data, ctx) {
    const { fortuneTypeLabel } = data;
    let text = `❓ *${fortuneTypeLabel} 질문 입력*\n\n`;
    text += `알고 싶은 것에 대해 구체적으로 질문해주세요.\n`;
    text += `(_예: "현재 진행 중인 프로젝트를 성공적으로 이끌려면 어떻게 해야 할까요?_")\n\n`;
    text += `*질문은 10자 이상, 100자 이하로 입력해주세요.*`;

    const keyboard = this.createInlineKeyboard(
      [[{ text: "🙅 그만두기", action: "menu" }]],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 질문 오류 렌더링
   */
  async renderQuestionError(data, ctx) {
    const text = `❌ *입력 오류*\n\n${data.message}\n\n다시 입력해주세요.`;
    const keyboard = this.createInlineKeyboard(
      [[{ text: "❌ 취소", action: "menu" }]],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🚫 일일 제한 렌더링
   */
  async renderDailyLimit(data, ctx) {
    const { used, max } = data;
    const text = `🚫 *일일 제한 도달*

오늘은 이미 ${used}/${max}번의 운세를 모두 뽑으셨습니다.
내일 다시 새로운 운세를 확인해보세요! 🌅`;

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

  /**
   * 🔄 셔플 결과 렌더링
   */
  async renderShuffleResult(data, ctx) {
    const text = `🔄 *카드 셔플 완료*

${data.message}

이제 새로운 기운으로 운세를 뽑아보세요! ✨`;

    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    const {
      userName,
      totalDraws = 0,
      todayDraws = 0,
      favoriteCard,
      _typeStats = {}
    } = data;

    let text = `📊 *${userName}님의 타로 통계*\n\n`;

    text += `🎴 *전체 통계*\n`;
    text += `• 총 뽑기 횟수: ${totalDraws}번\n`;
    text += `• 오늘 뽑기 횟수: ${todayDraws}번\n`;

    if (favoriteCard) {
      text += `• 가장 많이 나온 카드: ${favoriteCard}\n`;
    }
    text += `\n`;

    // 레벨 시스템 (stats.totalDraws를 data의 totalDraws로 변경)
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
   * 📋 기록 렌더링
   */
  async renderHistory(data, ctx) {
    const { userName, records = [], total = 0, message } = data;

    let text = `📋 *${userName}님의 타로 뽑기 기록* (${total}건)\n\n`;

    if (records.length === 0) {
      text += message || `아직 뽑은 기록이 없습니다.\n\n`;
      text += `첫 번째 운세를 뽑아보세요! 🔮`;
    } else {
      records.slice(0, 10).forEach((record, index) => {
        const cardName =
          record.koreanName ||
          record.cardName ||
          record.card?.korean ||
          "알 수 없음";
        const recordDate = record.date || "날짜 불명";
        const fortuneType = this.getFortuneTypeName(
          record.drawType || record.type
        );

        text += `${index + 1}. ${recordDate}\n`;
        text += `   ${fortuneType} - ${cardName}\n`;

        // 두목 멘트가 있으면 표시
        if (record.doomockComment) {
          text += `   💬 ${record.doomockComment}\n`;
        }
        text += `\n`;
      }); // forEach 닫기

      if (records.length > 10) {
        text += `... 그 외 ${records.length - 10}건의 기록\n\n`;
      }
    } // else 닫기

    const buttons = [
      [
        { text: "🎴 운세 뽑기", action: "draw" },
        { text: "📊 통계 보기", action: "stats" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링 (안전성 수정)
   */
  async renderError(data, ctx) {
    try {
      // ✅ 수정: 안전한 데이터 접근
      const errorMessage =
        data && data.message ? data.message : "알 수 없는 오류가 발생했습니다.";

      const text = `❌ *오류 발생*

${errorMessage}

다시 시도해주세요.`;

      const buttons = [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "🔙 메인 메뉴", action: "menu", module: "system" }
        ]
      ];

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    } catch (error) {
      // 에러 렌더링 중에도 오류가 발생할 경우를 대비한 최후 방어
      logger.error("FortuneRenderer.renderError 중 오류:", error);

      try {
        await ctx.reply(
          "❌ 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      } catch (replyError) {
        logger.error("최후 에러 메시지 전송도 실패:", replyError);
      }
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 운세 타입 이름 변환
   */
  getFortuneTypeName(type) {
    const typeNames = {
      single: "싱글카드",
      triple: "트리플카드",
      celtic: "캘틱 크로스",
      love: "연애운",
      work: "사업운",
      custom: "자유질문"
    };

    return typeNames[type] || type;
  }

  /**
   * 🔮 캘틱 크로스 상세 해석 렌더링 (추가)
   */
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
