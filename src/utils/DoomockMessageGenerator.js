// src/utils/DoomockMessageGenerator.js - 두목봇 메시지 생성기 완성본

/**
 * 👔 DoomockMessageGenerator - 두목봇 캐릭터 메시지 생성 (UI 관심사)
 *
 * ✅ 담당 책임:
 * - 두목봇 캐릭터 멘트 생성
 * - 상황별 메시지 포맷팅
 * - 사용자 친화적 텍스트 생성
 *
 * ❌ 담당하지 않는 것:
 * - 데이터베이스 로직
 * - 비즈니스 로직
 * - Bot API 호출
 */
class DoomockMessageGenerator {
  /**
   * 🎭 두목봇 캐릭터 메시지 생성
   */
  static generateMessage(type, userName = null, cardData = null, extraData = null) {
    const name = userName ? `${userName}씨` : "자네";

    const messageTemplates = {
      // 🔀 셔플링 메시지들
      shuffle: [
        `👔 두목: '${name}, 제가 직접 카드를 골라드리겠소...'`,
        `🧠 두목: '${name}을(를) 위해 집중하고 있소'`,
        `💼 두목: '${name}의 운세를 위해 내 직감을 총동원할테다!'`,
        `📊 두목: '${name}, 확률 계산 중... 아니, 그냥 감으로 갑시다!'`,
        `🎯 두목: '${name}을(를) 위한 특별한 카드를 찾고 있습니다...'`,
        `💭 두목: '${name}, 지금까지의 생활을 떠올리며...'`
      ],

      // 🌙 일일 제한 메시지들
      dailyLimit: [
        `👔 두목: '${name}, 오늘은 이미 뽑으셨군!'`,
        `🛑 두목: '${name}, 하루에 한 번만 집중할 수 있다네.'`,
        `☕ 두목: '${name}, 내일 출근해서 다시 봐드립죠!'`,
        `📅 두목: '${name}, 하루 하나의 조언이면 충분하지!'`,
        `🌙 두목: '${name}, 내일 다시 오시게!'`,
        `💼 두목: '${name}, 오늘 영업은 끝! 잘가쇼!'`
      ],

      // ✨ 마무리 멘트들
      ending: [
        `👔 두목: '${name}, 오늘 영업은 여기까지. 수고핑!'`,
        `💼 두목: '${name}, ...힘내십시오.'`,
        `☕ 두목: '${name}, 빡치셨나요?'`,
        `📊 두목: '${name}, 때론 직감이 우선일 수도...'`,
        `🎯 두목: '${name}, 식사하십쇼!'`,
        `💪 두목: '${name}, 밥은 자시고 다니셔요.'`,
        `🤝 두목: '${name}, 내일 또 봅시다.'`
      ],

      // 🌅 새로운 하루 인사말들
      welcome: [
        `🌅 두목: '${name}, 새로운 하루네요! 오늘은 어떤 메시지가 나올까요?'`,
        `☀️ 두목: '${name}, 좋은 아침입니다! 오늘의 운세를 확인해보세요!'`,
        `📅 두목: '${name}, 새로운 날, 새로운 기회! 카드를 뽑아보시죠!'`,
        `🌤️ 두목: '${name}, 출근하셨나요? 오늘의 타로를 확인해보세요!'`,
        `☕ 두목: '${name}, 모닝커피와 함께 오늘의 운세는 어떨까요?'`,
        `💼 두목: '${name}, 오늘도 좋은 하루 되시길! 카드부터 뽑아볼까요?'`
      ],

      // 🎉 성공 메시지들
      success: [
        `👔 두목: '${name}, 훌륭하군!'`,
        `✨ 두목: '${name}, 이 카드의 메시지를 몸에 새겨두도록!'`,
        `🎯 두목: '${name}, 오늘은 운이 좋네?'`,
        `💫 두목: '${name}, 카드때문에 살았군..'`
      ],

      // 📊 통계 관련 멘트들
      stats: [
        `👔 두목: '${name}, 보기좋은 근성을 가졌군!'`,
        `📈 두목: '${name}, 의외로 샤머니즘에 관심이 많네?'`,
        `🏆 두목: '${name}, 연속 기록이 대단하군!'`,
        `📊 두목: '${name}, 아주 흥미로운 결과야!'`
      ],

      // 🔀 셔플 완료 멘트들
      shuffleComplete: [
        `✨ 두목: '${name}, 빨리 선택해!'`,
        `🎴 두목: '${name}, 정말 최고급이라고'`,
        `🔮 두목: '${name}, 이것이 운명이란 말인가!'`,
        `⭐ 두목: '${name}, 야바위라니 말이 심하잖아!'`
      ],

      // 🔊 TTS 관련 멘트들
      ttsWelcome: [
        `👔 두목: '${name}, 음성 변환 서비스에 오신 것을 환영합니다!'`,
        `🎤 두목: '${name}, 텍스트를 자연스러운 음성으로 바꿔드릴게요!'`,
        `🔊 두목: '${name}, 어떤 텍스트를 음성으로 들어보고 싶으신가요?'`
      ],

      ttsProcessing: [
        `👔 두목: '${name}, 최고 품질의 음성으로 변환 중입니다!'`,
        `🎵 두목: '${name}, 자연스러운 발음으로 만들어드리고 있어요!'`,
        `🔊 두목: '${name}, 잠시만 기다려주세요. 곧 완성됩니다!'`
      ],

      ttsSuccess: [
        `👔 두목: '${name}, 음성 변환이 완료되었습니다!'`,
        `🎤 두목: '${name}, 어떠세요? 발음이 자연스럽죠?'`,
        `✨ 두목: '${name}, 또 다른 텍스트도 변환해보세요!'`
      ],

      // 📋 할일 관리 관련 멘트들
      todoWelcome: [
        `👔 두목: '${name}, 계획이 다 있구나?'`,
        `📝 두목: '${name}, 성공하려면 체계적 관리는 필수야!'`,
        `✅ 두목: '${name}, 내가 도울테니 하나씩 해보는게 어때?'`
      ],

      todoComplete: [
        `👔 두목: '${name}, 끝! 수고많았습니다!'`,
        `🎉 두목: '${name}, 하나씩 해치우는 모습이 멋지군!'`,
        `💪 두목: '${name}, 자랑스럽다!'`
      ],

      // 🏠 시스템 관련 멘트들
      systemWelcome: [
        `👔 두목: '${name}, 식사는 하셨소? 두목 인사드립니다'`,
        `🤖 두목: '${name}, 목표? 그런건 잊어버린지 오래야!'`,
        `💼 두목: '${name}, 점보러 오는 걸 추천해 꽤 잘 맞거든'`
      ],

      systemError: [
        `👔 두목: '${name}, 죄송하다만 시스템에 문제가 있다'`,
        `🔧 두목: '${name}, 개발자 좀 만나고 올게. 금방 와!'`,
        `💻 두목: '${name}, 여유를 갖고 기다려보자...'`
      ]
    };

    // 카드별 특별 멘트가 있으면 우선 사용
    if (type === "cardSpecific" && cardData) {
      return this.getCardSpecificMessages(name, cardData);
    }

    // 3장 뽑기 종합 멘트
    if (type === "tripleSummary" && extraData) {
      return this.getTripleSummaryMessages(name, extraData);
    }

    // 일반 메시지 랜덤 선택
    const typeMessages = messageTemplates[type] || messageTemplates.ending;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * 🎴 카드별 특별 멘트 생성
   */
  static getCardSpecificMessages(name, cardData) {
    const cardMessages = {
      0: [
        // The Fool
        `👔 두목: '${name}, 바보 카드라고 놀라지 마세요\\! 새로운 시작이에요\\!'`,
        `🤡 두목: '${name}, 저도 가끔 바보 같은 실수를 하죠\\. 괜찮아요\\!'`,
        `🎪 두목: '${name}, 순수한 마음으로 시작하는 게 때로는 최고예요\\!'`
      ],
      1: [
        // The Magician
        `👔 두목: '${name}, 마법사 카드\\! 당신에게는 모든 능력이 있어요\\!'`,
        `🎩 두목: '${name}, 이제 마술처럼 문제를 해결해보세요\\!'`,
        `✨두목: '${name}, 창조의 힘이 당신 안에 있습니다\\!'`
      ],
      2: [
        // The High Priestess
        `👔 두목: '${name}, 여교황 카드네요\\. 직감을 믿어보세요\\!'`,
        `🔮 두목: '${name}, 내면의 목소리에 귀 기울일 때예요\\!'`,
        `🌙 두목: '${name}, 신비로운 지혜가 찾아왔네요\\!'`
      ],
      3: [
        // The Empress
        `👔 두목: '${name}, 여황제 카드\\! 풍요로운 시기가 올 거예요\\!'`,
        `👑 두목: '${name}, 창조적인 에너지가 넘치고 있어요\\!'`,
        `🌺 두목: '${name}, 자연스러운 흐름을 따라가세요\\!'`
      ],
      4: [
        // The Emperor
        `👔 두목: '${name}, 황제 카드\\! 리더십을 발휘할 때네요\\!'`,
        `👨‍👑 두목: '${name}, 확고한 의지로 이끌어가세요\\!'`,
        `🏛️ 두목: '${name}, 안정감 있게 결정을 내리세요\\!'`
      ],
      5: [
        // The Hierophant
        `👔 두목: '${name}, 교황 카드예요\\. 전통의 지혜를 따라보세요\\!'`,
        `🏛️ 두목: '${name}, 선배들의 조언이 도움이 될 거예요\\!'`,
        `📚 두목: '${name}, 검증된 방법이 최고입니다\\!'`
      ],
      6: [
        // The Lovers
        `👔 두목: '${name}, 연인 카드\\! 중요한 선택의 순간이네요\\!'`,
        `💕 두목: '${name}, 마음의 소리를 따라보세요\\!'`,
        `💝 두목: '${name}, 조화로운 관계가 열쇠예요\\!'`
      ],
      7: [
        // The Chariot
        `👔 두목: '${name}, 전차 카드\\! 승리를 향해 전진하세요\\!'`,
        `🏆 두목: '${name}, 강한 의지력으로 돌파하세요\\!'`,
        `🚗 두목: '${name}, 목표를 향해 달려가세요\\!'`
      ],
      8: [
        // Strength
        `👔 두목: '${name}, 힘 카드네요\\. 내면의 힘을 믿으세요\\!'`,
        `💪 두목: '${name}, 부드럽지만 확고하게 접근하세요\\!'`,
        `🦁 두목: '${name}, 용기를 내어 극복해보세요\\!'`
      ],
      9: [
        // The Hermit
        `👔 두목: '${name}, 은둔자 카드예요\\. 성찰의 시간이 필요해요\\!'`,
        `🕯️ 두목: '${name}, 혼자만의 시간을 가져보세요\\!'`,
        `🏔️ 두목: '${name}, 내면을 깊이 들여다볼 때네요\\!'`
      ],
      10: [
        // Wheel of Fortune
        `👔 두목: '${name}, 운명의 바퀴\\! 큰 변화가 올 거예요\\!'`,
        `🎡 두목: '${name}, 운명적인 기회를 놓치지 마세요\\!'`,
        `🔄 두목: '${name}, 변화의 바람이 불고 있어요\\!'`
      ],
      11: [
        // Justice
        `👔 두목: '${name}, 정의 카드네요. 공정한 판단이 필요해요\\!'`,
        `⚖️ 두목: '${name}, 균형잡힌 시각으로 보세요\\!'`,
        `🏛️ 두목: '${name}, 진실이 밝혀질 거예요\\!'`
      ],
      12: [
        // The Hanged Man
        `👔 두목: '${name}, 매달린 남자 카드예요\\. 잠시 기다려보세요\\!'`,
        `🙃 두목: '${name}, 다른 관점으로 바라보는 게 좋겠어요\\!'`,
        `⏳ 두목: '${name}, 때로는 기다림도 필요합니다\\!'`
      ],
      13: [
        // Death
        `👔 두목: '${name}, 죽음 카드라고 무서워하지 마세요\\. 변화의 시작이에요\\!'`,
        `💀 두목: '${name}, 이건 좋은 변화를 의미합니다\\. 믿어보세요\\!'`,
        `🔄 두목: '${name}, 끝은 새로운 시작의 다른 이름이에요\\!'`
      ],
      14: [
        // Temperance
        `👔 두목: '${name}, 절제 카드네요\\. 균형을 맞춰보세요\\!'`,
        `🍷 두목: '${name}, 조화로운 해결책을 찾아보세요\\!'`,
        `⚖️ 두목: '${name}, 극단보다는 중간 지점이 좋겠어요\\!'`
      ],
      15: [
        // The Devil
        `👔 두목: '${name}, 악마 카드예요\\. 무엇에 얽매여 있나요\\?'`,
        `😈 두목: '${name}, 속박에서 벗어날 때가 왔어요\\!'`,
        `🔗 두목: '${name}, 용기를 내어 자유로워지세요\\!'`
      ],
      16: [
        // The Tower
        `👔 두목: '${name}, 탑 카드네요. 급변이 있을 수 있어요\\!'`,
        `🏗️ 두목: '${name}, 변화는 때로 필요악이죠. 준비하세요\\!'`,
        `⚡ 두목: '${name}, 혼란 후에는 새로운 질서가 와요\\!'`
      ],
      17: [
        // The Star
        `👔 두목: '${name}, 별 카드\\! 희망이 보이기 시작해요\\!'`,
        `⭐ 두목: '${name}, 어려운 시기가 지나가고 있어요\\!'`,
        `✨ 두목: '${name}, 영감과 치유의 시간이에요\\!'`
      ],
      18: [
        // The Moon
        `👔 두목: '${name}, 달 카드네요\\. 직감을 믿어보세요\\!'`,
        `🌙 두목: '${name}, 불확실하지만 차분하게 가세요\\!'`,
        `🌊 두목: '${name}, 감정에 휩쓸리지 말고 현명하게\\!'`
      ],
      19: [
        // The Sun
        `👔 두목: '${name}, 태양 카드\\! 최고의 컨디션이네요\\!'`,
        `☀️ 두목: '${name}, 오늘은 뭘 해도 잘 될 것 같아요\\!'`,
        `🌞 두목: '${name}, 밝고 긍정적인 에너지가 가득해요\\!'`
      ],
      20: [
        // Judgement
        `👔 두목: '${name}, 심판 카드예요\\. 새로운 깨달음이 올 거예요\\!'`,
        `⚡ 두목: '${name}, 과거를 정리하고 새 출발하세요\\!'`,
        `🎺 두목: '${name}, 각성의 시간이 다가왔어요\\!'`
      ],
      21: [
        // The World
        `👔 두목: '${name}, 세계 카드\\! 완벽합니다\\!'`,
        `🌍 두목: '${name}, 프로젝트 마무리가 잘 될 것 같네요\\!'`,
        `🏆 두목: '${name}, 모든 것이 완성되어 가고 있어요\\!'`
      ]
    };

    const cardId = cardData.cardId || cardData.id;
    if (cardMessages[cardId]) {
      const messages = cardMessages[cardId];
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // 기본 메시지
    return `👔 두목: '${name}, 좋은 카드가 나왔네요\\!'`;
  }

  /**
   * 🎴🎴🎴 3장 뽑기 종합 멘트 생성
   */
  static getTripleSummaryMessages(name, cardsData) {
    if (!cardsData || !Array.isArray(cardsData) || cardsData.length !== 3) {
      return `👔 두목: '${name}, 3장의 카드가 전하는 메시지를 잘 새겨두세요\\!'`;
    }

    const [pastCard, presentCard, futureCard] = cardsData;

    const summaries = [
      `👔 두목: '${name}, 과거의 ${pastCard.koreanName}에서 현재의 ${presentCard.koreanName}로\\, 그리고 미래의 ${futureCard.koreanName}로 이어지는 흐름이 보이네요\\.'`,
      `👔 두목: '${name}, 전체적으로 보면 좋은 방향으로 흘러가고 있습니다\\. 특히 ${futureCard.koreanName} 카드가 희망적이에요\\.'`,
      `👔 두목: '${name}, 과거와 현재를 토대로 볼 때 미래는 충분히 밝다고 봅니다. 준비만 잘 하시면 돼요.'`,
      `👔 두목: '${name}, 이 세 장의 카드가 전하는 메시지를 잘 새겨두시고 업무에 활용해보세요\\.'`,
      `👔 두목: '${name}, 시간의 흐름 속에서 ${presentCard.koreanName}이 핵심이 될 것 같아요\\.'`
    ];

    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  /**
   * 🎯 컨텍스트별 메시지 생성 (외부 인터페이스)
   */
  static getContextualMessage(context, userName, data = null) {
    switch (context) {
      case "welcome":
        return this.generateMessage("welcome", userName);

      case "cardDrawn":
        return this.generateMessage("cardSpecific", userName, data);

      case "dailyLimitReached":
        return this.generateMessage("dailyLimit", userName);

      case "shuffling":
        return this.generateMessage("shuffle", userName);

      case "shuffleComplete":
        return this.generateMessage("shuffleComplete", userName);

      case "success":
        return this.generateMessage("success", userName);

      case "ending":
        return this.generateMessage("ending", userName);

      case "stats":
        return this.generateMessage("stats", userName);

      case "tripleReading":
        return this.generateMessage("tripleSummary", userName, data);

      // TTS 관련
      case "ttsWelcome":
        return this.generateMessage("ttsWelcome", userName);

      case "ttsProcessing":
        return this.generateMessage("ttsProcessing", userName);

      case "ttsSuccess":
        return this.generateMessage("ttsSuccess", userName);

      // Todo 관련
      case "todoWelcome":
        return this.generateMessage("todoWelcome", userName);

      case "todoComplete":
        return this.generateMessage("todoComplete", userName);

      // System 관련
      case "systemWelcome":
        return this.generateMessage("systemWelcome", userName);

      case "systemError":
        return this.generateMessage("systemError", userName);

      default:
        return this.generateMessage("ending", userName);
    }
  }
}

module.exports = DoomockMessageGenerator;
