// src/renderers/FortuneRenderer.js - 콜백 버튼 수정 버전

const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

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
      case "celtic_result":
        return await this.renderCelticResult(data, ctx);
      case "celtic_detail": // ✅ 추가
        return await this.renderCelticDetail(data, ctx);
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
        return await this.renderError({ message: "지원하지 않는 기능입니다." }, ctx);
    }
  }

  /**
   * 🔮 메뉴 렌더링 (수정된 콜백 버튼)
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
      // 🔧 수정된 운세 타입 버튼들 - 올바른 콜백 데이터 생성
      const fortuneTypeEntries = Object.entries(fortuneTypes);

      for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
        const row = [];

        // 첫 번째 운세 타입
        const [key1, config1] = fortuneTypeEntries[i];
        row.push({
          text: `${config1.emoji} ${config1.label}`,
          // 🎯 핵심 수정: action을 "draw"에서 "draw"로, params에 실제 타입을 넘김
          action: "draw",
          params: key1 // "single", "triple", "celtic"이 정확히 전달됨
        });

        // 두 번째 운세 타입 (있으면)
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

      // 카드 셔플 버튼
      buttons.push([{ text: "🔄 카드 셔플", action: "shuffle" }]);
    }

    // 통계/기록 버튼
    buttons.push([
      { text: "📊 통계", action: "stats" },
      { text: "📋 기록", action: "history" }
    ]);

    // 메인 메뉴 버튼 - 🔧 수정: system 모듈로 올바르게 라우팅
    buttons.push([
      {
        text: "🔙 메인 메뉴",
        action: "menu"
        // NavigationHandler의 buildCallbackData 형식에 맞게 수정
        // "system:menu"가 되도록 처리
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

    let text = `🃏 **운세 선택**\n\n`;
    text += `💫 **남은 횟수**: ${remaining}번\n\n`;
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

  /**
   * ✨ 운세 결과 렌더링 (새 데이터 구조 호환!)
   */
  async renderDrawResult(data, ctx) {
    // 🔧 새 FortuneService 데이터 구조 처리
    const {
      cards,
      type: drawType,
      timestamp,
      fortuneType,
      remaining,
      remainingDraws,
      totalDraws,
      message,
      isDemo // 더미 데이터 표시용
    } = data;

    let text = `✨ **${fortuneType?.label || this.getFortuneTypeName(drawType)} 결과**\n\n`;

    // 더미 데이터 표시
    if (isDemo) {
      text += `🎭 **데모 모드** (실제 데이터베이스 연결 후 정상 동작)\n\n`;
    }

    // 두목봇 멘트가 있으면 표시
    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length > 1) {
      // 🔮 다중 카드 결과 (트리플, 캘틱 등)
      text += `🔮 **${cards.length}카드 리딩**\n\n`;

      if (drawType === "triple") {
        const positions = ["과거", "현재", "미래"];
        cards.forEach((card, index) => {
          const position = card.position || positions[index] || `${index + 1}번째`;
          text += `**${position}**: ${card.emoji || "🎴"} ${card.korean || card.name}\n`;

          if (card.isReversed) {
            text += `🔄 역방향 - `;
          }

          // 간단한 의미 추가
          text += this.getCardMeaning(card, drawType, position) + "\n\n";
        });

        // 종합 해석
        text += `🎯 **종합 해석**\n`;
        text += this.getOverallInterpretation(cards, drawType) + "\n\n";
      } else if (drawType === "celtic") {
        // 캘틱 크로스는 별도 렌더링 함수 호출
        return await this.renderCelticResult(data, ctx);
      }
    } else if (cards && cards.length === 1) {
      // 🎴 단일 카드 결과
      const card = cards[0];

      text += `🎴 **뽑힌 카드**\n`;
      text += `${card.emoji || "🎴"} **${card.korean || card.name}**\n`;

      if (card.name && card.korean !== card.name) {
        text += `(${card.name})\n`;
      }
      text += `\n`;

      if (card.isReversed) {
        text += `🔄 **역방향 카드**\n`;
        text += `평소와는 다른 관점에서 해석해보세요.\n\n`;
      }

      text += `💫 **의미**: ${this.getCardMeaning(card, drawType)}\n\n`;
      text += `💡 **조언**: ${this.getCardAdvice(card, drawType)}\n\n`;
    }

    // 남은 횟수 표시
    const remainingCount = remainingDraws ?? remaining ?? 0;
    text += `💫 **남은 횟수**: ${remainingCount}번`;

    if (totalDraws) {
      text += ` (총 ${totalDraws}번 뽑으셨습니다)`;
    }

    const buttons = [
      [
        { text: "🎴 다시 뽑기", action: "draw" },
        { text: "🔄 카드 셔플", action: "shuffle" }
      ],
      [
        { text: "📊 통계", action: "stats" },
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
    const { question, cards, fortuneType, message, isDemo } = data;

    let text = `🔮 **캘틱 크로스 완성**\n\n`;

    if (isDemo) {
      text += `🎭 **데모 모드**\n\n`;
    }

    text += `**질문**: "${question}"\n\n`;

    // 두목봇 멘트
    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length === 10) {
      text += `✨ **10장 카드 배치 완료**\n\n`;

      // 카드 요약 (5장씩 나누어 표시)
      text += `🎴 **카드 배치 (1-5)**\n`;
      for (let i = 0; i < 5; i++) {
        const card = cards[i];
        const reversed = card.isReversed ? " (역방향)" : "";
        const positionName = card.positionName || `위치 ${i + 1}`;
        text += `${i + 1}. ${positionName}: ${card.emoji || "🎴"} ${card.korean || card.name}${reversed}\n`;
      }

      text += `\n🎴 **카드 배치 (6-10)**\n`;
      for (let i = 5; i < 10; i++) {
        const card = cards[i];
        const reversed = card.isReversed ? " (역방향)" : "";
        const positionName = card.positionName || `위치 ${i + 1}`;
        text += `${i + 1}. ${positionName}: ${card.emoji || "🎴"} ${card.korean || card.name}${reversed}\n`;
      }

      text += `\n📖 **상세 해석을 보려면 아래 버튼을 누르세요**`;
    }

    const buttons = [
      [{ text: "📖 상세 해석 보기", action: "celtic_detail", params: "show" }],
      [
        { text: "🔮 다른 질문", action: "draw", params: "celtic" },
        { text: "🎴 간단한 운세", action: "draw" }
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
    const { fortuneType, isCeltic } = data;

    let text = `❓ **${fortuneType?.label || "질문 운세"}**\n\n`;

    if (isCeltic) {
      text += `🔮 **캘틱 크로스**는 가장 강력하고 상세한 타로 스프레드입니다.\n`;
      text += `10장의 카드가 당신의 상황을 완전히 분석해드립니다.\n\n`;

      text += `**어떤 질문이든 좋습니다:**\n`;
      text += `• "내 인생의 방향은 무엇인가요?"\n`;
      text += `• "이 선택이 올바른 걸까요?"\n`;
      text += `• "앞으로 어떻게 살아야 할까요?"\n`;
      text += `• "내가 놓치고 있는 것은 무엇인가요?"\n\n`;

      text += `**💎 캘틱 크로스 10개 위치:**\n`;
      text += `1. 현재 상황 | 6. 무의식적 영향\n`;
      text += `2. 도전/장애물 | 7. 당신의 접근법\n`;
      text += `3. 원인/과거 | 8. 외부 환경\n`;
      text += `4. 가능한 미래 | 9. 희망과 두려움\n`;
      text += `5. 의식적 접근 | 10. 최종 결과\n\n`;
    } else {
      text += `궁금한 것을 자유롭게 질문해주세요.\n\n`;

      text += `**예시 질문:**\n`;
      text += `• "이번 주 중요한 결정을 내려야 하는데 어떻게 해야 할까요?"\n`;
      text += `• "새로운 도전을 시작해야 할 시기인가요?"\n`;
      text += `• "지금 내가 집중해야 할 것은 무엇인가요?"\n\n`;
    }

    text += `**입력 규칙:**\n`;
    text += `• 최대 100자\n`;
    text += `• 구체적이고 명확한 질문\n\n`;
    text += `메뉴로 돌아가려면 아래 버튼을 누르세요.`;

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
    const text = `🔄 **카드 셔플 완료**

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
    const { userName, stats } = data;

    let text = `📊 **${userName}님의 타로 통계**\n\n`;

    text += `🎴 **전체 통계**\n`;
    text += `• 총 뽑기 횟수: ${stats.totalDraws}번\n`;
    text += `• 오늘 뽑기 횟수: ${stats.todayDraws}번\n`;
    text += `• 연속 뽑기: ${stats.streak}일\n`;
    text += `• 선호 타입: ${this.getFortuneTypeName(stats.favoriteType)}\n`;

    if (stats.accuracy) {
      text += `• 만족도: ${stats.accuracy}%\n`;
    }
    text += `\n`;

    // 레벨 시스템
    const level = Math.floor(stats.totalDraws / 10) + 1;
    const nextLevelDraws = level * 10;
    const remaining = nextLevelDraws - stats.totalDraws;

    text += `🏆 **타로 레벨**: ${level}레벨\n`;
    text += `📈 **다음 레벨까지**: ${remaining}번 남음\n\n`;

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
    const { history, totalCount } = data;

    let text = `📋 **타로 뽑기 기록** (${totalCount}건)\n\n`;

    if (history.length === 0) {
      text += `아직 뽑은 기록이 없습니다.\n\n`;
      text += `첫 번째 운세를 뽑아보세요! 🔮`;
    } else {
      history.slice(0, 10).forEach((record, index) => {
        const cardName = record.koreanName || record.cardName || record.card?.korean || "알 수 없음";
        const recordDate = record.date || "날짜 불명";
        const fortuneType = this.getFortuneTypeName(record.drawType || record.type);

        text += `${index + 1}. ${recordDate}\n`;
        text += `   ${fortuneType} - ${cardName}\n`;

        // 두목 멘트가 있으면 표시
        if (record.doomockComment) {
          text += `   💬 ${record.doomockComment}\n`;
        }
        text += `\n`;
      });

      if (history.length > 10) {
        text += `... 그 외 ${history.length - 10}건의 기록\n\n`;
      }
    }

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
      const errorMessage = data && data.message ? data.message : "알 수 없는 오류가 발생했습니다.";

      const text = `❌ **오류 발생**

${errorMessage}

다시 시도해주세요.`;

      const buttons = [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "🔙 메인 메뉴", action: "menu" }
        ]
      ];

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    } catch (error) {
      // 에러 렌더링 중에도 오류가 발생할 경우를 대비한 최후 방어
      logger.error("FortuneRenderer.renderError 중 오류:", error);

      try {
        await ctx.reply("❌ 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
   * 카드 의미 생성
   */
  getCardMeaning(card, fortuneType, position = null) {
    // 메이저 아르카나 의미
    const majorMeanings = {
      "The Fool": "새로운 시작과 순수한 가능성",
      바보: "새로운 시작과 순수한 가능성",
      "The Magician": "의지력과 창조적 능력",
      마법사: "의지력과 창조적 능력",
      "The Star": "희망과 영감, 밝은 미래",
      별: "희망과 영감, 밝은 미래"
    };

    const cardKey = card.korean || card.name;
    const meaning = majorMeanings[cardKey] || "새로운 기회와 변화";

    if (position) {
      return `${position}에서 ${meaning}을 보여줍니다.`;
    }

    return meaning;
  }

  /**
   * 카드 조언 생성
   */
  getCardAdvice(card, fortuneType) {
    const advice = {
      "The Fool": "용기를 갖고 새로운 시작을 두려워하지 마세요.",
      바보: "용기를 갖고 새로운 시작을 두려워하지 마세요.",
      "The Magician": "당신의 능력을 믿고 목표를 향해 나아가세요.",
      마법사: "당신의 능력을 믿고 목표를 향해 나아가세요.",
      "The Star": "희망을 잃지 말고 긍정적으로 생각하세요.",
      별: "희망을 잃지 말고 긍정적으로 생각하세요."
    };

    const cardKey = card.korean || card.name;
    return advice[cardKey] || "직감을 믿고 현명한 선택을 하세요.";
  }

  /**
   * 🔮 캘틱 크로스 상세 해석 렌더링 (추가)
   */
  async renderCelticDetail(data, ctx) {
    try {
      const { userName, question, cards, detailedInterpretation, overallMessage, isDemo, timestamp } = data;

      let text = `📖 **캘틱 크로스 상세 해석**\n\n`;

      if (isDemo) {
        text += `🎭 **데모 모드**\n\n`;
      }

      text += `**질문**: "${question}"\n`;

      if (timestamp) {
        text += `**뽑은 시간**: ${new Date(timestamp).toLocaleString("ko-KR")}\n`;
      }

      text += `\n`;

      // 10장 카드 상세 설명
      if (cards && cards.length === 10) {
        text += `🎴 **10장 카드 상세 분석**\n\n`;

        // 첫 5장
        text += `**🔵 핵심 스프레드 (1-5번)**\n`;
        for (let i = 0; i < 5 && i < cards.length; i++) {
          const card = cards[i];
          const reversed = card.isReversed ? " 🔄" : "";
          text += `${i + 1}. **${card.positionName}**: ${card.emoji || "🎴"} ${card.korean}${reversed}\n`;
          text += `   ${card.positionDescription}\n`;

          // 카드별 간단 해석
          if (card.isReversed) {
            text += `   💭 역방향으로 평상시와 다른 관점에서 접근해보세요.\n`;
          } else {
            text += `   💭 긍정적인 에너지와 변화의 신호입니다.\n`;
          }
          text += `\n`;
        }

        // 나머지 5장
        text += `**🟡 주변 환경 스프레드 (6-10번)**\n`;
        for (let i = 5; i < 10 && i < cards.length; i++) {
          const card = cards[i];
          const reversed = card.isReversed ? " 🔄" : "";
          text += `${i + 1}. **${card.positionName}**: ${card.emoji || "🎴"} ${card.korean}${reversed}\n`;
          text += `   ${card.positionDescription}\n\n`;
        }
      }

      // 상세 해석
      if (detailedInterpretation) {
        text += `📋 **단계별 상세 해석**\n\n`;

        Object.values(detailedInterpretation).forEach((section, index) => {
          text += `**${index + 1}. ${section.title}**\n`;
          text += `${section.content}\n\n`;
        });
      }

      // 종합 메시지
      if (overallMessage) {
        text += `💫 **종합 메시지**\n`;
        text += `${overallMessage}\n\n`;
      }

      text += `🎯 **조언**: 카드가 제시하는 방향을 참고하여 현명한 판단을 내리세요.`;

      const buttons = [
        [
          { text: "🔮 새로운 질문", action: "draw", params: "celtic" },
          { text: "🎴 간단 운세", action: "draw" }
        ],
        [
          { text: "📊 통계", action: "stats" },
          { text: "📋 기록", action: "history" }
        ],
        [{ text: "🔙 메뉴", action: "menu" }]
      ];

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    } catch (error) {
      logger.error("FortuneRenderer.renderCelticDetail 오류:", error);
      await this.renderError({ message: "상세 해석 표시 중 오류가 발생했습니다." }, ctx);
    }
  }

  /**
   * 종합 해석 생성
   */
  getOverallInterpretation(cards, fortuneType) {
    if (fortuneType === "triple") {
      return `과거의 경험을 바탕으로 현재 상황을 이해하고, 미래를 향한 명확한 방향을 설정하세요. 세 카드가 보여주는 흐름을 주의 깊게 살펴보시기 바랍니다.`;
    }

    return `카드들이 전하는 메시지를 종합해보면, 현재 상황에서 중요한 것은 균형과 조화입니다.`;
  }
}

module.exports = FortuneRenderer;
