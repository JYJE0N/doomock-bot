// src/renderers/FortuneRenderer.js - 새 데이터 구조 호환 버전

const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔮 FortuneRenderer - 타로 카드 UI 렌더링 (새 데이터 구조 호환)
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
      case "celtic_result":
        return await this.renderCelticResult(data, ctx);
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
   * 🔮 메뉴 렌더링
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
      // 운세 타입 버튼들을 2열로 배치
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

      // 카드 셔플 버튼
      buttons.push([{ text: "🔄 카드 셔플", action: "shuffle" }]);
    }

    // 통계/기록 버튼
    buttons.push([
      { text: "📊 통계", action: "stats" },
      { text: "📋 기록", action: "history" },
    ]);

    // 메인 메뉴 버튼
    buttons.push([{ text: "🔙 메인 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🃏 운세 타입 선택 렌더링
   */
  async renderDrawSelect(data, ctx) {
    const { fortuneTypes, remaining } = data;

    let text = `🃏 **운세 선택**\n\n`;
    text += `💫 **남은 횟수**: ${remaining}번\n\n`;
    text += `어떤 종류의 운세를 알아보시겠어요?`;

    const buttons = [];

    // 운세 타입 버튼들을 2열로 배치
    const fortuneTypeEntries = Object.entries(fortuneTypes);

    for (let i = 0; i < fortuneTypeEntries.length; i += 2) {
      const row = [];

      const [key1, config1] = fortuneTypeEntries[i];
      row.push({
        text: `${config1.emoji} ${config1.label}`,
        action: "draw",
        params: key1,
      });

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
    } = data;

    let text = `✨ **${
      fortuneType?.label || this.getFortuneTypeName(drawType)
    } 결과**\n\n`;

    // 두목봇 멘트가 있으면 표시
    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length > 1) {
      // 🔮 삼카드 결과
      text += `🔮 **삼카드 리딩**\n\n`;

      const positions = ["과거", "현재", "미래"];
      cards.forEach((card, index) => {
        const position =
          card.position || positions[index] || `${index + 1}번째`;
        text += `**${position}**: ${card.emoji || "🎴"} ${
          card.korean || card.name
        }\n`;

        if (card.isReversed) {
          text += `🔄 역방향 - `;
        }

        // 간단한 의미 추가
        text += this.getCardMeaning(card, drawType, position) + "\n\n";
      });

      // 종합 해석
      text += `🎯 **종합 해석**\n`;
      text += this.getOverallInterpretation(cards, drawType) + "\n\n";
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
   * 🔮 캘틱 크로스 결과 렌더링
   */
  async renderCelticResult(data, ctx) {
    const { question, cards, fortuneType, message } = data;

    let text = `🔮 **캘틱 크로스 완성**\n\n`;
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
        text += `${i + 1}. ${card.positionName}: ${card.emoji} ${
          card.korean
        }${reversed}\n`;
      }

      text += `\n🎴 **카드 배치 (6-10)**\n`;
      for (let i = 5; i < 10; i++) {
        const card = cards[i];
        const reversed = card.isReversed ? " (역방향)" : "";
        text += `${i + 1}. ${card.positionName}: ${card.emoji} ${
          card.korean
        }${reversed}\n`;
      }

      text += `\n📖 **상세 해석을 보려면 아래 버튼을 누르세요**`;
    }

    const buttons = [
      [{ text: "📖 상세 해석 보기", action: "celtic_detail", params: "show" }],
      [
        { text: "🔮 다른 질문", action: "draw", params: "celtic" },
        { text: "🎴 간단한 운세", action: "draw" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 커스텀 질문 결과 렌더링
   */
  async renderCustomResult(data, ctx) {
    const { question, cards, fortuneType, message } = data;

    let text = `❓ **${fortuneType?.label || "자유질문"} 결과**\n\n`;
    text += `**질문**: "${question}"\n\n`;

    // 두목봇 멘트
    if (message) {
      text += `💬 ${message}\n\n`;
    }

    if (cards && cards.length > 0) {
      const card = cards[0];

      text += `🎴 **답변 카드**\n`;
      text += `${card.emoji || "🎴"} **${card.korean || card.name}**\n\n`;

      if (card.isReversed) {
        text += `🔄 **역방향 카드**\n`;
      }

      text += `💫 **답변**: ${this.getCardMeaning(card, "custom")}\n\n`;
      text += `💡 **조언**: ${this.getCardAdvice(card, "custom")}`;
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
    text += `• 최대 200자\n`;
    text += `• 구체적이고 명확한 질문\n\n`;
    text += `/cancel 명령으로 취소할 수 있습니다.`;

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
      text += `첫 번째 운세를 뽑아보세요! 🔮`;
    } else {
      history.slice(0, 10).forEach((record, index) => {
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

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
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
      custom: "자유질문",
    };

    return typeNames[type] || type;
  }

  /**
   * 카드 의미 생성 (메이저/마이너 구분)
   */
  getCardMeaning(card, fortuneType, position = null) {
    // 메이저 아르카나 의미
    const majorMeanings = {
      "The Fool": "새로운 시작과 순수한 가능성",
      "The Magician": "의지력과 창조적 능력",
      "The High Priestess": "직감과 내면의 지혜",
      "The Empress": "풍요로움과 창조적 에너지",
      "The Emperor": "리더십과 질서",
      "The Hierophant": "전통과 정신적 지도",
      "The Lovers": "선택과 관계의 조화",
      "The Chariot": "의지력과 승리",
      Strength: "내면의 힘과 용기",
      "The Hermit": "내면 탐구와 지혜 추구",
      "Wheel of Fortune": "운명의 변화와 기회",
      Justice: "공정함과 균형",
      "The Hanged Man": "희생과 새로운 관점",
      Death: "변화와 재탄생",
      Temperance: "조화와 절제",
      "The Devil": "유혹과 속박에서의 해방",
      "The Tower": "급작스러운 변화와 깨달음",
      "The Star": "희망과 영감",
      "The Moon": "환상과 무의식의 세계",
      "The Sun": "성공과 긍정적 에너지",
      Judgement: "재탄생과 새로운 깨달음",
      "The World": "완성과 성취",
    };

    // 마이너 아르카나 의미 (간단히)
    const getMinorMeaning = (card) => {
      const suitMeanings = {
        Cups: "감정과 인간관계의 영역",
        Wands: "열정과 창의성의 영역",
        Swords: "지성과 갈등의 영역",
        Pentacles: "물질과 현실의 영역",
      };

      const suitMeaning = suitMeanings[card.suit] || "균형의 영역";

      if (card.court) {
        const courtMeanings = {
          Page: "새로운 시작과 학습",
          Knight: "행동과 모험",
          Queen: "성숙한 감정과 직감",
          King: "숙련된 리더십과 권위",
        };
        return `${courtMeanings[card.court]}을 통해 ${suitMeaning}에서의 발전`;
      } else {
        return `${suitMeaning}에서의 ${
          card.number === 1 ? "새로운 시작" : "발전과 성장"
        }`;
      }
    };

    let meaning;
    if (card.arcana === "major") {
      meaning = majorMeanings[card.name] || "중요한 인생의 교훈";
    } else {
      meaning = getMinorMeaning(card);
    }

    // 역방향 의미 조정 (메이저 아르카나만)
    if (card.isReversed && card.arcana === "major") {
      meaning = "내면의 " + meaning + " 또는 그 반대 상황";
    }

    // 포지션별 추가 설명 (캘틱 크로스용)
    if (position && card.positionDescription) {
      meaning += ". " + card.positionDescription;
    }

    return meaning;
  }

  /**
   * 카드 조언 생성
   */
  getCardAdvice(card, fortuneType) {
    const advice = {
      "The Fool": "용기를 갖고 새로운 도전을 시작해보세요",
      "The Magician": "당신의 능력을 믿고 적극적으로 행동하세요",
      "The Star": "희망을 잃지 말고 꿈을 향해 나아가세요",
      "The Sun": "자신감을 갖고 긍정적으로 생각하세요",
      "The Moon": "직감을 믿고 내면의 소리에 귀 기울이세요",
      Death: "변화를 두려워하지 말고 받아들이세요",
      "The World": "현재의 성과를 인정하고 다음 목표를 설정하세요",
    };

    const cardName = card.name || card.korean;
    return (
      advice[card.name] ||
      advice[cardName] ||
      "긍정적인 마음가짐으로 하루를 보내세요"
    );
  }

  /**
   * 종합 해석 생성 (삼카드용)
   */
  getOverallInterpretation(cards, fortuneType) {
    if (cards.length === 3) {
      return "과거의 경험을 바탕으로 현재를 이해하고, 미래를 위한 준비를 하는 시기입니다. 세 카드가 전하는 메시지를 종합하여 균형잡힌 판단을 내리세요.";
    }

    return "카드들이 전하는 메시지를 마음에 새기고 실천해보세요.";
  }
}

module.exports = FortuneRenderer;
