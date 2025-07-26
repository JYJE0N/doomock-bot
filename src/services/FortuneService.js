// src/services/FortuneService.js - 표준화된 운세 서비스

const BaseService = require("./BaseService");
const logger = require("../utils/Logger"); // ✅ 소문자 logger로 통일
const TimeHelper = require("../utils/TimeHelper");

class FortuneService extends BaseService {
  constructor() {
    super("fortune_history");

    logger.info("🔮 FortuneService 생성 중..."); // ✅ 소문자 logger 사용

    this.initializeMessages();
    this.initializeTarotCards();
    this.initializeLuckyItems();

    logger.info("🔮 FortuneService 생성 완료"); // ✅ 소문자 logger 사용
  }

  initializeMessages() {
    this.messages = {
      general: {
        positive: [
          "오늘은 새로운 시작의 기운이 가득한 날입니다. 모든 일이 순조롭게 풀릴 거예요 🌅",
          "예상치 못한 행운이 문을 두드릴 것 같아요. 좋은 소식이 연달아 들려올 거예요 📞",
          "주변 사람들의 사랑과 관심이 당신을 따뜻하게 감싸는 날이에요 💝",
          "창의적인 아이디어가 샘솟고 모든 일에 영감이 넘치는 하루가 될 거예요 💡",
          "작은 행운들이 모여 큰 기쁨을 만들어내는 특별한 날이에요 🍀",
          "당신의 매력이 빛나고 카리스마가 폭발하는 날이에요 ✨",
          "오랜 소원이 이루어질 수 있는 기회가 찾아올 거예요 🌠",
          "모든 일이 계획대로 착착 진행되는 완벽한 하루가 될 거예요 🎯",
          "당신의 노력이 드디어 결실을 맺는 보람찬 날이에요 🏆",
          "행복이 문득문득 찾아와 미소 짓게 만드는 날이에요 😊",
        ],
        negative: [
          "약간의 장애물이 있을 수 있지만, 이는 성장의 기회가 될 거예요 🌱",
          "예상치 못한 변화가 있을 수 있으니 유연하게 대처하세요 🌊",
          "작은 실수가 있을 수 있지만, 이를 통해 더 많이 배울 수 있어요 📚",
          "에너지가 조금 부족할 수 있으니 충분한 휴식을 취하세요 😴",
          "의견 충돌이 있을 수 있으니 상대방의 입장을 이해해보세요 🤝",
          "계획이 조금 틀어질 수 있지만, 더 나은 방향으로 나아갈 거예요 🔄",
          "마음이 조금 불안정할 수 있으니 명상이나 산책을 해보세요 🧘",
          "기대와 다른 결과가 나올 수 있지만, 이것도 하나의 경험이에요 🎲",
          "인내심이 필요한 하루가 될 것 같아요. 조급해하지 마세요 ⏳",
          "작은 손실이 있을 수 있지만, 더 큰 것을 얻기 위한 과정이에요 🔄",
        ],
        neutral: [
          "평온하고 안정감 있는 하루를 보낼 수 있을 거예요 🕊️",
          "일상적인 루틴 속에서 소소한 행복을 찾을 수 있는 날이에요 ☕",
          "특별한 일은 없지만 마음이 편안한 하루가 될 거예요 🌿",
          "평범한 일상 속에서 감사함을 느낄 수 있는 날이에요 🙏",
          "큰 변화보다는 안정을 추구하는 것이 좋은 날이에요 ⚖️",
          "차분하게 자신을 돌아볼 수 있는 시간을 가질 수 있어요 🪞",
          "소박하지만 확실한 행복을 느낄 수 있는 날이에요 🏡",
          "현상 유지가 최선인 날이에요. 무리하지 마세요 🛡️",
          "작은 것부터 차근차근 해나가는 것이 좋은 날이에요 🐌",
          "주변을 정리하고 마음도 정리할 수 있는 날이에요 🧹",
        ],
      },
      work: {
        positive: [
          "업무에서 뛰어난 성과를 낼 수 있는 날이에요. 자신감을 가지세요! 💼",
          "동료들과의 협력이 빛을 발하는 날입니다. 팀워크를 발휘하세요 🤝",
          "새로운 프로젝트나 기회가 찾아올 수 있어요 📈",
          "상사나 클라이언트로부터 좋은 평가를 받을 수 있는 날이에요 👏",
          "창의적인 아이디어로 문제를 해결할 수 있을 거예요 💡",
          "업무 효율이 최고조에 달하는 날입니다 ⚡",
          "중요한 결정을 내리기에 좋은 날이에요 🎯",
          "전문성을 인정받을 수 있는 기회가 올 거예요 🏆",
          "업무상 네트워킹이 활발해지는 날이에요 🌐",
          "목표 달성에 한 발짝 더 가까워지는 날입니다 🚀",
        ],
        negative: [
          "업무에서 작은 실수가 있을 수 있으니 신중하게 행동하세요 ⚠️",
          "동료와의 의견 차이가 있을 수 있어요. 소통을 중시하세요 💬",
          "예상보다 업무가 지연될 수 있으니 여유를 두세요 ⏰",
          "스트레스가 쌓일 수 있으니 적절한 휴식을 취하세요 😓",
          "우선순위를 명확히 하여 업무를 진행하세요 📋",
          "감정적인 판단보다는 논리적인 접근이 필요해요 🤔",
          "계획을 다시 점검하고 수정할 필요가 있을 수 있어요 🔄",
          "인내심을 가지고 차근차근 진행하세요 🐢",
          "상황 파악을 정확히 한 후 행동하세요 🔍",
          "무리하지 말고 할 수 있는 만큼만 하세요 🛡️",
        ],
        neutral: [
          "평소와 같은 업무 루틴을 유지하는 것이 좋아요 📅",
          "안정적으로 업무를 처리할 수 있는 날이에요 ⚖️",
          "현재 진행 중인 일들을 차근차근 마무리하세요 ✅",
          "급하게 서두르기보다는 꼼꼼히 확인하세요 🔍",
          "팀원들과의 일상적인 소통을 유지하세요 💭",
          "기존 계획을 그대로 따르는 것이 좋은 날이에요 📋",
          "새로운 시도보다는 안정성을 추구하세요 🏠",
          "업무와 개인 시간의 균형을 맞추세요 ⚖️",
          "작은 성취들을 인정하고 격려하세요 👍",
          "내일을 위한 준비를 차분히 해보세요 📝",
        ],
      },
      love: {
        positive: [
          "연애운이 상승하는 날이에요! 적극적으로 다가가세요 💕",
          "이상형을 만날 수 있는 기회가 찾아올 거예요 👫",
          "연인과의 관계가 한층 더 깊어질 수 있어요 💏",
          "로맨틱한 분위기를 연출하기 좋은 날이에요 🌹",
          "고백이나 프러포즈에 성공할 확률이 높아요 💍",
          "애인과의 오해가 풀리고 화해할 수 있을 거예요 🤗",
          "새로운 만남의 기회가 많아지는 날이에요 ✨",
          "매력이 최고조에 달해 인기가 많을 거예요 💫",
          "연애에 대한 자신감이 생기는 날이에요 😊",
          "사랑하는 사람과 특별한 추억을 만들 수 있어요 📸",
        ],
        negative: [
          "연인과의 소통에서 오해가 생길 수 있어요. 진심을 전하세요 💬",
          "질투나 의심이 관계에 악영향을 줄 수 있어요 😤",
          "과거의 연인이 생각나서 마음이 복잡할 수 있어요 💭",
          "연애보다는 자기 계발에 집중하는 것이 좋을 수도 있어요 📚",
          "성급한 결정을 내리지 말고 신중하게 생각하세요 🤔",
          "외로움을 느낄 수 있지만 곧 좋은 일이 있을 거예요 🌈",
          "연애 문제로 스트레스를 받을 수 있으니 마음을 편히 가지세요 😌",
          "상대방의 마음을 너무 재촉하지 마세요 ⏰",
          "이별의 아픔이 있을 수 있지만 새로운 시작의 기회에요 🌱",
          "연애보다는 친구들과의 시간을 소중히 하세요 👥",
        ],
        neutral: [
          "연애에 있어서 현상 유지가 최선인 날이에요 💝",
          "서두르지 말고 자연스럽게 흘러가도록 하세요 🌊",
          "연인과 평범하지만 소중한 시간을 보내세요 ☕",
          "연애보다는 자신에게 집중하는 시간을 가지세요 🪞",
          "무리한 만남보다는 편안한 관계를 유지하세요 😌",
          "연애에 대한 기대를 너무 높이지 마세요 📏",
          "상대방을 있는 그대로 받아들이려 노력하세요 🤲",
          "연애 관련 조언을 구해보는 것도 좋을 거예요 💭",
          "혼자만의 시간도 충분히 즐기세요 📖",
          "연애에 대해 너무 고민하지 말고 자연스럽게 하세요 🍃",
        ],
      },
      money: {
        positive: [
          "재물운이 상승하는 날이에요! 투자나 사업에 좋은 기회가 있을 거예요 💰",
          "예상치 못한 수입이 생길 수 있어요 💵",
          "금전적인 문제가 해결되는 실마리를 찾을 수 있어요 🔑",
          "투자 수익이 기대보다 좋을 수 있어요 📈",
          "부업이나 사이드 프로젝트에서 좋은 결과가 있을 거예요 💼",
          "금전 관리 능력이 향상되는 날이에요 📊",
          "재테크에 대한 좋은 정보를 얻을 수 있어요 💡",
          "돈을 벌 수 있는 새로운 아이디어가 떠오를 거예요 🌟",
          "경제적 안정감을 느낄 수 있는 날이에요 🏦",
          "저축 목표 달성에 한 발짝 더 가까워져요 🎯",
        ],
        negative: [
          "불필요한 지출이 늘어날 수 있으니 가계부를 확인하세요 📝",
          "투자에 신중해야 하는 날이에요. 리스크를 잘 따져보세요 ⚠️",
          "큰 구매는 미루는 것이 좋을 수 있어요 🛒",
          "금전적인 유혹에 빠지지 않도록 주의하세요 🚫",
          "사기나 금융 사고에 주의가 필요해요 🔍",
          "돈 관련 결정을 성급하게 내리지 마세요 ⏰",
          "가족이나 친구와의 금전 거래는 피하는 것이 좋아요 👥",
          "카드 사용을 줄이고 현금 사용을 늘려보세요 💳",
          "부채가 늘어날 수 있으니 지출을 줄이세요 📉",
          "금전적 스트레스를 받을 수 있으니 마음을 편히 가지세요 😌",
        ],
        neutral: [
          "재정 상태를 점검하고 계획을 세우기 좋은 날이에요 📋",
          "현재의 재정 상태를 유지하는 것이 좋아요 ⚖️",
          "작은 저축부터 시작해보세요 🐷",
          "금전 관리에 대해 공부하는 시간을 가져보세요 📚",
          "기존의 투자를 재검토해보는 것이 좋아요 🔄",
          "돈에 대한 가치관을 다시 생각해보세요 💭",
          "현명한 소비 습관을 기르려 노력하세요 🎯",
          "재테크 관련 정보를 수집해보세요 🔍",
          "금전적 목표를 구체적으로 설정해보세요 📌",
          "안정적인 수입원을 유지하는 데 집중하세요 💪",
        ],
      },
      health: {
        positive: [
          "몸과 마음이 건강한 하루를 보낼 수 있어요 💪",
          "운동이나 다이어트에 좋은 성과가 있을 거예요 🏃",
          "컨디션이 최상으로 좋아지는 날이에요 ✨",
          "건강 관리에 대한 동기부여가 생기는 날이에요 🎯",
          "새로운 건강 습관을 시작하기 좋은 날이에요 🌱",
          "스트레스가 해소되고 마음이 편안해져요 😌",
          "충분한 수면으로 피로가 풀릴 거예요 😴",
          "건강한 음식에 대한 욕구가 생길 거예요 🥗",
          "면역력이 강해지는 날이에요 🛡️",
          "활력이 넘치고 에너지가 충만한 하루예요 ⚡",
        ],
        negative: [
          "피로가 누적될 수 있으니 충분한 휴식을 취하세요 😴",
          "스트레스로 인한 몸의 이상 신호에 주의하세요 ⚠️",
          "과로하지 말고 적당한 운동을 하세요 🚶",
          "불규칙한 식사보다는 규칙적인 식습관을 유지하세요 🍽️",
          "감정적 스트레스가 몸에 영향을 줄 수 있어요 💭",
          "무리한 다이어트나 운동은 피하세요 🚫",
          "작은 부상이나 몸살에 주의가 필요해요 🤕",
          "수분 섭취를 늘리고 건강한 음식을 드세요 💧",
          "충분한 잠을 자지 못해 컨디션이 나빠질 수 있어요 😪",
          "건강 검진을 받아보는 것을 고려해보세요 🏥",
        ],
        neutral: [
          "현재의 건강 상태를 유지하는 것이 좋아요 ⚖️",
          "규칙적인 생활 패턴을 유지하세요 🕐",
          "가벼운 산책이나 스트레칭을 해보세요 🚶",
          "건강한 식습관에 대해 관심을 가져보세요 🍎",
          "충분한 수면 시간을 확보하려 노력하세요 😴",
          "스트레스 관리 방법을 찾아보세요 🧘",
          "건강 관련 정보를 찾아 공부해보세요 📚",
          "몸의 변화에 관심을 가지고 관찰하세요 🔍",
          "적절한 휴식과 활동의 균형을 맞추세요 ⚖️",
          "건강한 취미 활동을 시작해보세요 🎨",
        ],
      },
      meeting: {
        positive: [
          "회식이나 모임에서 인기의 중심이 될 거예요 🌟",
          "새로운 인맥을 만날 수 있는 좋은 기회가 있어요 🤝",
          "분위기 메이커 역할을 톡톡히 해낼 거예요 🎉",
          "술자리에서 좋은 이야기를 많이 들을 수 있어요 🗣️",
          "동료들과의 관계가 더욱 돈독해질 거예요 👥",
          "회식 자리에서 좋은 기회나 정보를 얻을 수 있어요 💡",
          "유머 감각이 빛을 발하는 날이에요 😄",
          "회식비를 아낄 수 있는 행운이 있을 거예요 💰",
          "맛있는 음식을 먹을 수 있는 기회가 많아져요 🍽️",
          "회식 후 2차, 3차까지 즐겁게 이어질 거예요 🍻",
        ],
        negative: [
          "과음하지 않도록 주의하세요. 적당히 마시는 게 좋아요 🚫",
          "회식 자리에서 말실수를 하지 않도록 조심하세요 🤐",
          "술자리에서 생기는 오해나 갈등에 주의하세요 ⚠️",
          "회식비 지출이 예상보다 많을 수 있어요 💸",
          "다음 날 숙취로 고생할 수 있으니 물을 많이 드세요 💧",
          "회식을 핑계로 일을 미루지 마세요 📋",
          "술자리 분위기에 휩쓸려 무리하지 마세요 🌪️",
          "개인적인 이야기를 너무 많이 하지 마세요 🤫",
          "귀가가 늦어져 다음 날 컨디션이 나빠질 수 있어요 😴",
          "회식 자리에서의 약속은 신중하게 하세요 🤔",
        ],
        neutral: [
          "평소와 같은 수준의 회식 참여가 좋을 거예요 ⚖️",
          "적당한 분위기 조성에 도움을 주세요 😊",
          "술보다는 음식 위주로 즐기는 것이 좋아요 🍽️",
          "동료들의 이야기에 귀 기울여 주세요 👂",
          "회식 자리에서는 업무 이야기를 피하세요 💼",
          "모든 사람이 즐길 수 있는 화제를 선택하세요 💬",
          "일찍 자리를 뜨는 것도 나쁘지 않아요 🚪",
          "술을 마시지 않는다면 음료수로 분위기를 맞추세요 🥤",
          "회식 장소나 메뉴 선택에 의견을 제시해보세요 📍",
          "다음 모임 계획에 대해 이야기해보세요 📅",
        ],
      },
    };

    logger.debug("🔮 운세 메시지 초기화 완료"); // ✅ 소문자 logger 사용
  }

  initializeTarotCards() {
    this.majorArcana = [
      {
        emoji: "🃏",
        name: "광대 (The Fool)",
        meaning: "새로운 시작, 모험, 순수함",
        advice: "두려워하지 말고 새로운 도전을 시작하세요",
      },
      {
        emoji: "🎩",
        name: "마법사 (The Magician)",
        meaning: "의지력, 집중력, 창조력",
        advice: "목표에 집중하고 자신의 능력을 믿으세요",
      },
      {
        emoji: "🔮",
        name: "여교황 (The High Priestess)",
        meaning: "직감, 내면의 지혜, 신비",
        advice: "직감을 믿고 내면의 목소리에 귀 기울이세요",
      },
      {
        emoji: "👑",
        name: "여황제 (The Empress)",
        meaning: "풍요, 모성, 창조성",
        advice: "사랑과 돌봄으로 주변을 감싸 안으세요",
      },
      {
        emoji: "⚖️",
        name: "황제 (The Emperor)",
        meaning: "권위, 안정, 질서",
        advice: "확고한 의지로 목표를 달성하세요",
      },
      {
        emoji: "🕊️",
        name: "교황 (The Hierophant)",
        meaning: "전통, 지혜, 영성",
        advice: "경험 많은 이의 조언을 구해보세요",
      },
      {
        emoji: "💕",
        name: "연인 (The Lovers)",
        meaning: "사랑, 선택, 조화",
        advice: "마음이 이끄는 방향을 따르세요",
      },
      {
        emoji: "🏆",
        name: "전차 (The Chariot)",
        meaning: "승리, 의지력, 통제",
        advice: "강한 의지로 목표를 향해 나아가세요",
      },
      {
        emoji: "💪",
        name: "힘 (Strength)",
        meaning: "용기, 인내, 내적 힘",
        advice: "인내와 용기로 어려움을 극복하세요",
      },
      {
        emoji: "🕯️",
        name: "은둔자 (The Hermit)",
        meaning: "성찰, 내적 탐구, 지혜",
        advice: "혼자만의 시간을 가지며 내면을 탐구하세요",
      },
      {
        emoji: "🎡",
        name: "운명의 바퀴 (Wheel of Fortune)",
        meaning: "변화, 운명, 순환",
        advice: "변화를 받아들이고 새로운 기회를 잡으세요",
      },
      {
        emoji: "⚖️",
        name: "정의 (Justice)",
        meaning: "공정, 균형, 진실",
        advice: "공정하고 균형 잡힌 판단을 내리세요",
      },
      {
        emoji: "🙃",
        name: "매달린 사람 (The Hanged Man)",
        meaning: "희생, 관점의 변화, 기다림",
        advice: "다른 관점에서 상황을 바라보세요",
      },
      {
        emoji: "💀",
        name: "죽음 (Death)",
        meaning: "변화, 끝과 시작, 변신",
        advice: "과거를 놓아주고 새로운 시작을 받아들이세요",
      },
      {
        emoji: "🌸",
        name: "절제 (Temperance)",
        meaning: "조화, 균형, 중용",
        advice: "모든 것에 균형과 조화를 추구하세요",
      },
      {
        emoji: "👹",
        name: "악마 (The Devil)",
        meaning: "유혹, 속박, 물질주의",
        advice: "욕망에 사로잡히지 말고 자유로워지세요",
      },
      {
        emoji: "🗼",
        name: "탑 (The Tower)",
        meaning: "파괴, 급작스런 변화, 깨달음",
        advice: "급작스런 변화를 받아들이고 새롭게 시작하세요",
      },
      {
        emoji: "⭐",
        name: "별 (The Star)",
        meaning: "희망, 영감, 치유",
        advice: "희망을 잃지 말고 꿈을 향해 나아가세요",
      },
      {
        emoji: "🌙",
        name: "달 (The Moon)",
        meaning: "착각, 불안, 무의식",
        advice: "혼란스러운 상황에서 직감을 믿으세요",
      },
      {
        emoji: "☀️",
        name: "태양 (The Sun)",
        meaning: "기쁨, 성공, 활력",
        advice: "긍정적인 에너지로 모든 것을 밝게 만드세요",
      },
      {
        emoji: "⚰️",
        name: "심판 (Judgement)",
        meaning: "부활, 각성, 새로운 기회",
        advice: "과거를 반성하고 새로운 기회를 잡으세요",
      },
      {
        emoji: "🌍",
        name: "세계 (The World)",
        meaning: "완성, 성취, 통합",
        advice: "목표를 달성하고 새로운 여정을 준비하세요",
      },
    ];

    this.minorArcana = {
      wands: [
        {
          emoji: "🔥",
          name: "완드 에이스",
          meaning: "새로운 창조적 에너지",
          advice: "열정을 가지고 새로운 프로젝트를 시작하세요",
        },
        {
          emoji: "🎯",
          name: "완드 2",
          meaning: "계획과 전략",
          advice: "장기적인 계획을 세우고 실행하세요",
        },
        {
          emoji: "🚀",
          name: "완드 3",
          meaning: "확장과 발전",
          advice: "시야를 넓히고 새로운 기회를 찾으세요",
        },
      ],
      cups: [
        {
          emoji: "💖",
          name: "컵 에이스",
          meaning: "새로운 감정의 시작",
          advice: "마음을 열고 새로운 관계를 맞이하세요",
        },
        {
          emoji: "🤝",
          name: "컵 2",
          meaning: "파트너십과 협력",
          advice: "타인과의 협력을 통해 더 큰 성과를 이루세요",
        },
        {
          emoji: "🎉",
          name: "컵 3",
          meaning: "축하와 우정",
          advice: "친구들과 기쁨을 나누고 축하하세요",
        },
      ],
      swords: [
        {
          emoji: "⚔️",
          name: "검 에이스",
          meaning: "새로운 아이디어와 통찰",
          advice: "명확한 사고로 문제를 해결하세요",
        },
        {
          emoji: "🤔",
          name: "검 2",
          meaning: "선택의 기로",
          advice: "신중하게 생각하고 현명한 선택을 하세요",
        },
        {
          emoji: "💔",
          name: "검 3",
          meaning: "슬픔과 상처",
          advice: "고통을 받아들이고 치유의 시간을 가지세요",
        },
      ],
      pentacles: [
        {
          emoji: "💰",
          name: "펜타클 에이스",
          meaning: "새로운 물질적 기회",
          advice: "실용적인 계획을 세우고 안정을 추구하세요",
        },
        {
          emoji: "⚖️",
          name: "펜타클 2",
          meaning: "균형과 우선순위",
          advice: "자원을 효율적으로 배분하고 관리하세요",
        },
        {
          emoji: "🏗️",
          name: "펜타클 3",
          meaning: "기술과 협력",
          advice: "전문성을 키우고 팀워크를 발휘하세요",
        },
      ],
    };

    logger.debug("🃏 타로카드 초기화 완료"); // ✅ 소문자 logger 사용
  }

  initializeLuckyItems() {
    this.luckyColors = [
      "빨간색 🔴",
      "주황색 🟠",
      "노란색 🟡",
      "초록색 🟢",
      "파란색 🔵",
      "보라색 🟣",
      "분홍색 🩷",
      "검은색 ⚫",
      "흰색 ⚪",
      "금색 🟨",
      "은색 ⚪",
      "갈색 🤎",
    ];

    this.luckyItems = [
      "반지 💍",
      "목걸이 📿",
      "열쇠고리 🗝️",
      "향수 🌸",
      "시계 ⌚",
      "모자 🎩",
      "선글라스 🕶️",
      "스카프 🧣",
      "지갑 💳",
      "펜 🖊️",
      "책 📚",
      "식물 🌱",
      "캔들 🕯️",
      "크리스털 💎",
      "동전 🪙",
    ];

    this.luckyDirections = [
      "동쪽 →",
      "서쪽 ←",
      "남쪽 ↓",
      "북쪽 ↑",
      "동남쪽 ↘",
      "동북쪽 ↗",
      "서남쪽 ↙",
      "서북쪽 ↖",
    ];

    this.luckyTimes = [
      "오전 6-8시",
      "오전 8-10시",
      "오전 10-12시",
      "오후 12-2시",
      "오후 2-4시",
      "오후 4-6시",
      "오후 6-8시",
      "오후 8-10시",
      "오후 10-12시",
    ];

    this.luckyFoods = [
      "비빔밥 🍲",
      "김치찌개 🍲",
      "삼겹살 🥓",
      "치킨 🍗",
      "피자 🍕",
      "파스타 🍝",
      "초밥 🍣",
      "라면 🍜",
      "햄버거 🍔",
      "샐러드 🥗",
      "과일 🍎",
      "디저트 🍰",
    ];

    logger.debug("🍀 행운 아이템 초기화 완료"); // ✅ 소문자 logger 사용
  }

  // ===== 메인 메서드 =====

  getRandomMessage(messages, userId, type = "general") {
    const today = TimeHelper.formatDate(new Date());
    const seed = parseInt(userId.toString() + today.replace(/\D/g, "") + type);

    // 시드를 이용한 메시지 분류 결정
    const rand = seed % 100;
    let category;

    if (rand < 60) {
      // 60% 확률로 긍정적
      category = "positive";
    } else if (rand < 85) {
      // 25% 확률로 중립적
      category = "neutral";
    } else {
      // 15% 확률로 부정적
      category = "negative";
    }

    if (Array.isArray(messages)) {
      // 타로카드 등 배열인 경우
      const index = seed % messages.length;
      return messages[index];
    } else if (messages[category]) {
      // 카테고리별 메시지인 경우
      const categoryMessages = messages[category];
      const index = seed % categoryMessages.length;
      return categoryMessages[index];
    }
  }

  getFortune(userId, type) {
    return this.getRandomMessage(this.messages[type], userId, type);
  }

  getGeneralFortune() {
    return this.getFortune(Math.random() * 1000, "general");
  }

  getWorkFortune() {
    return this.getFortune(Math.random() * 1000, "work");
  }

  getLoveFortune() {
    return this.getFortune(Math.random() * 1000, "love");
  }

  getMoneyFortune() {
    return this.getFortune(Math.random() * 1000, "money");
  }

  getHealthFortune() {
    return this.getFortune(Math.random() * 1000, "health");
  }

  getMeetingFortune() {
    return this.getFortune(Math.random() * 1000, "meeting");
  }

  getTarotCard() {
    const allCards = [
      ...this.majorArcana,
      ...this.minorArcana.wands,
      ...this.minorArcana.cups,
      ...this.minorArcana.swords,
      ...this.minorArcana.pentacles,
    ];
    const card = this.getRandomMessage(allCards, Math.random() * 1000);
    return `${card.emoji} **${card.name}**\n\n✨ *의미: ${card.meaning}*\n\n💫 *조언: ${card.advice}*`;
  }

  getTarot3Spread() {
    const allCards = [
      ...this.majorArcana,
      ...this.minorArcana.wands,
      ...this.minorArcana.cups,
      ...this.minorArcana.swords,
      ...this.minorArcana.pentacles,
    ];

    const today = TimeHelper.formatDate(new Date());
    const seed = parseInt(Date.now().toString() + today.replace(/\D/g, ""));

    // 3개의 서로 다른 카드 선택을 위한 시드 생성
    const selectedCards = [];
    const usedIndices = new Set();

    for (let i = 0; i < 3; i++) {
      let cardSeed = (seed + i * 17 + i * i * 31) % allCards.length;

      // 중복 방지
      while (usedIndices.has(cardSeed)) {
        cardSeed = (cardSeed + 7) % allCards.length;
      }

      usedIndices.add(cardSeed);
      selectedCards.push(allCards[cardSeed]);
    }

    const [pastCard, presentCard, futureCard] = selectedCards;

    return (
      "🔮 **과거 - 현재 - 미래 스프레드**\n\n" +
      "**📜 과거 (Past):**\n" +
      `${pastCard.emoji} ${pastCard.name}\n` +
      `*${pastCard.meaning}*\n\n` +
      "**🌟 현재 (Present):**\n" +
      `${presentCard.emoji} ${presentCard.name}\n` +
      `*${presentCard.meaning}*\n\n` +
      "**✨ 미래 (Future):**\n" +
      `${futureCard.emoji} ${futureCard.name}\n` +
      `*${futureCard.meaning}*\n\n` +
      `💫 **종합 조언:** ${presentCard.advice}`
    );
  }

  getLuckyInfo(userName) {
    const today = TimeHelper.formatDate(new Date());
    const seed = parseInt(Date.now().toString() + today.replace(/\D/g, ""));

    return (
      `🍀 **${userName}님의 오늘 행운 정보**\n\n` +
      `🎨 행운의 색깔: ${this.getLuckyColor(seed)}\n` +
      `🔢 행운의 번호: ${this.getLuckyNumbers(seed).join(", ")}\n` +
      `🎁 행운의 아이템: ${this.getLuckyItem(seed)}\n` +
      `🧭 행운의 방향: ${this.getLuckyDirection(seed)}\n` +
      `⏰ 행운의 시간: ${this.getLuckyTime(seed)}\n` +
      `🍽️ 오늘의 메뉴: ${this.getLuckyFood(seed)}`
    );
  }

  getAllFortune(userId, userName) {
    const general = this.getFortune(userId, "general");
    const work = this.getFortune(userId, "work");
    const love = this.getFortune(userId, "love");
    const money = this.getFortune(userId, "money");
    const health = this.getFortune(userId, "health");
    const meeting = this.getFortune(userId, "meeting");

    return (
      `🔮 **${userName}님의 오늘 종합운세**\n\n` +
      `**🌟 전체운:** ${general}\n\n` +
      `**💼 업무운:** ${work}\n\n` +
      `**💕 연애운:** ${love}\n\n` +
      `**💰 재물운:** ${money}\n\n` +
      `**🌿 건강운:** ${health}\n\n` +
      `**🍻 회식운:** ${meeting}`
    );
  }

  // ===== 유틸리티 메서드 =====

  getLuckyColor(seed) {
    return this.luckyColors[seed % this.luckyColors.length];
  }

  getLuckyNumbers(seed) {
    const numbers = new Set();
    let currentSeed = seed;

    while (numbers.size < 6) {
      const num = (currentSeed % 45) + 1;
      numbers.add(num);
      currentSeed = (currentSeed * 7 + 13) % 1000000;
    }

    return Array.from(numbers).sort((a, b) => a - b);
  }

  getLuckyItem(seed) {
    return this.luckyItems[seed % this.luckyItems.length];
  }

  getLuckyDirection(seed) {
    return this.luckyDirections[seed % this.luckyDirections.length];
  }

  getLuckyTime(seed) {
    return this.luckyTimes[seed % this.luckyTimes.length];
  }

  getLuckyFood(seed) {
    return this.luckyFoods[seed % this.luckyFoods.length];
  }

  // ===== 서비스 상태 =====

  getStatus() {
    return {
      messagesLoaded: !!this.messages,
      tarotCardsLoaded: !!this.majorArcana && !!this.minorArcana,
      luckyItemsLoaded: !!this.luckyColors && !!this.luckyItems,
      totalMajorArcana: this.majorArcana?.length || 0,
      totalMinorArcana: Object.values(this.minorArcana || {}).reduce(
        (sum, cards) => sum + cards.length,
        0
      ),
    };
  }
}

module.exports = FortuneService;
