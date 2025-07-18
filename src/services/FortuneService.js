const { TimeHelper } = require("../utils/TimeHelper");

class FortuneService {
  constructor() {
    this.initializeMessages();
    this.initializeTarotCards();
    this.initializeLuckyItems();
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
          "일상의 소중함을 깨달을 수 있는 평화로운 하루예요 🕯️",
          "조용히 에너지를 충전하기 좋은 날이에요 🔋",
        ],
      },
      work: {
        positive: [
          "업무 능력이 최고조에 달해 모든 일을 완벽하게 처리할 수 있어요 🚀",
          "동료들과의 협업이 환상적으로 이루어져 시너지가 폭발해요 🤝",
          "중요한 프로젝트에서 핵심적인 역할을 하게 될 거예요 🎯",
          "상사로부터 특별한 인정과 칭찬을 받을 수 있어요 👏",
          "승진이나 연봉 인상의 기회가 찾아올 수 있어요 📈",
          "새로운 비즈니스 기회를 포착하게 될 거예요 💼",
          "프레젠테이션이나 발표에서 큰 성공을 거둘 거예요 🎤",
          "업무 효율이 평소의 200% 이상 발휘되는 날이에요 ⚡",
          "중요한 계약이나 거래가 성사될 가능성이 높아요 📋",
          "당신의 아이디어가 회사의 혁신을 이끌어낼 거예요 💡",
        ],
        negative: [
          "업무량이 평소보다 많을 수 있으니 우선순위를 정하세요 📊",
          "예상치 못한 업무 변경이 있을 수 있으니 유연하게 대처하세요 🔄",
          "동료와의 의견 차이가 있을 수 있으니 대화로 해결하세요 💬",
          "마감 기한에 쫓길 수 있으니 시간 관리를 철저히 하세요 ⏰",
          "실수가 발생하기 쉬운 날이니 꼼꼼히 확인하세요 🔍",
          "회의가 길어질 수 있으니 인내심을 가지세요 🪑",
          "예산이나 자원이 부족할 수 있으니 창의적으로 해결하세요 💭",
          "비판적인 피드백을 받을 수 있지만 성장의 기회로 삼으세요 📝",
          "업무 스트레스가 높을 수 있으니 적절한 휴식을 취하세요 🧘",
          "계획한 일정이 지연될 수 있으니 여유를 가지세요 📅",
        ],
        neutral: [
          "일상적인 업무를 차분히 처리하는 평범한 하루가 될 거예요 📄",
          "특별한 성과는 없지만 안정적으로 일할 수 있어요 🏢",
          "루틴한 업무 속에서 작은 개선점을 찾을 수 있어요 🔧",
          "동료들과 편안한 분위기에서 일할 수 있는 날이에요 ☕",
          "큰 프로젝트보다는 작은 업무들을 정리하기 좋은 날이에요 📌",
          "업무 속도가 평균적이지만 실수는 없을 거예요 ✅",
          "새로운 시도보다는 기존 방식을 유지하는 게 좋아요 🔒",
          "회사 분위기가 전반적으로 조용하고 평화로울 거예요 🕊️",
          "업무 부담이 적당해서 워라밸을 지킬 수 있어요 ⚖️",
          "일상적인 미팅과 보고서 작성으로 하루가 지나갈 거예요 📊",
        ],
      },
      love: {
        positive: [
          "연인과의 관계가 한층 더 깊어지고 사랑이 충만한 날이에요 💕",
          "운명적인 만남이 기다리고 있을 수 있어요. 마음을 열어두세요 💘",
          "고백하기에 완벽한 타이밍이에요. 용기를 내보세요 💝",
          "연인에게서 깜짝 선물이나 이벤트가 있을 수 있어요 🎁",
          "결혼이나 프로포즈 같은 중요한 결정을 내리기 좋은 날이에요 💍",
          "첫눈에 반할 만한 매력적인 사람을 만날 수 있어요 😍",
          "연애 운이 최고조에 달해 모든 것이 로맨틱하게 느껴질 거예요 🌹",
          "오해가 풀리고 관계가 더욱 돈독해지는 날이에요 🤗",
          "데이트 코스가 완벽하게 맞아떨어지는 환상적인 하루예요 🎭",
          "사랑하는 사람과 특별한 추억을 만들 수 있는 날이에요 📸",
        ],
        negative: [
          "연인과 작은 다툼이 있을 수 있으니 서로 이해하려 노력하세요 💔",
          "오해가 생기기 쉬운 날이니 소통을 충분히 하세요 💬",
          "연애보다는 자기 자신에게 집중하는 것이 좋을 수 있어요 🪞",
          "과거 연애의 상처가 떠오를 수 있지만 이겨낼 수 있어요 🩹",
          "질투심이 생길 수 있으니 마음을 다스리세요 😤",
          "데이트 약속이 취소될 수 있으니 대안을 준비하세요 📱",
          "연인의 단점이 크게 보일 수 있지만 장점도 생각하세요 ⚖️",
          "혼자만의 시간이 필요할 수 있으니 거리를 두세요 🚶",
          "고백이 거절당할 수 있으니 마음의 준비를 하세요 😔",
          "연애에 대한 부담감을 느낄 수 있으니 천천히 가세요 🐌",
        ],
        neutral: [
          "연애 상태가 현상 유지되는 평온한 날이에요 💑",
          "특별한 이벤트보다는 일상적인 데이트가 어울려요 ☕",
          "연인과 편안한 대화를 나누기 좋은 날이에요 💬",
          "싱글이라면 자연스러운 만남을 기대해보세요 🤝",
          "연애보다는 친구들과의 시간이 더 즐거울 수 있어요 👥",
          "감정이 안정적이어서 현명한 연애 결정을 내릴 수 있어요 🧠",
          "평범하지만 따뜻한 애정을 느낄 수 있는 날이에요 🤗",
          "연애 고민이 있다면 조언을 구하기 좋은 때예요 👂",
          "커플이라면 함께 영화 보기 좋은 날이에요 🎬",
          "혼자여도 외롭지 않고 평화로운 하루가 될 거예요 🕊️",
        ],
      },
      money: {
        positive: [
          "예상치 못한 금전적 행운이 찾아올 수 있어요. 복권도 고려해보세요 💸",
          "투자 수익이 기대 이상으로 늘어날 가능성이 높아요 📈",
          "보너스나 성과급 소식이 들려올 수 있어요 💰",
          "부업이나 사이드 프로젝트에서 큰 수익을 얻을 수 있어요 💵",
          "오래된 빚을 받거나 환급금이 나올 수 있어요 🏦",
          "가치 있는 물건을 저렴하게 구입할 기회가 생겨요 🛍️",
          "재테크 정보를 얻어 큰 수익을 낼 수 있어요 📊",
          "예상보다 많은 용돈이나 선물을 받을 수 있어요 🎁",
          "사업 아이디어가 대박을 칠 가능성이 있어요 💡",
          "금전 운이 최고조에 달해 모든 거래가 유리하게 진행돼요 🍀",
        ],
        negative: [
          "충동구매를 조심하세요. 나중에 후회할 수 있어요 🛑",
          "예상치 못한 지출이 발생할 수 있으니 비상금을 준비하세요 💳",
          "투자는 신중하게 하세요. 손실 위험이 있어요 📉",
          "돈을 빌려주는 것은 피하세요. 돌려받기 어려울 수 있어요 🚫",
          "카드 사용을 자제하고 현금 위주로 사용하세요 💵",
          "세일이나 할인에 현혹되지 마세요. 필요한 것만 구매하세요 🏷️",
          "도박이나 투기는 절대 피하세요. 큰 손실이 있을 수 있어요 🎰",
          "수입이 일시적으로 줄어들 수 있으니 절약하세요 📊",
          "계약서는 꼼꼼히 읽고 서명하세요. 함정이 있을 수 있어요 📝",
          "친구와의 금전 거래는 관계를 해칠 수 있으니 조심하세요 ⚠️",
        ],
        neutral: [
          "재정 상태가 안정적으로 유지되는 날이에요 💼",
          "큰 수입이나 지출 없이 평범한 하루가 될 거예요 🏦",
          "가계부를 정리하고 재정 계획을 세우기 좋은 날이에요 📝",
          "저축을 시작하거나 늘리기에 적당한 때예요 🐷",
          "금전적으로 무리하지 않는 선에서 소소한 즐거움을 누리세요 ☕",
          "투자 공부를 시작하기 좋은 날이에요 📚",
          "중고 물품을 정리해서 용돈을 마련할 수 있어요 📦",
          "금전 관련 조언을 구하기 좋은 시기예요 💬",
          "예산 내에서 알뜰하게 생활할 수 있는 날이에요 🛒",
          "재테크 앱을 시작해보기 좋은 타이밍이에요 📱",
        ],
      },
      health: {
        positive: [
          "몸과 마음이 최상의 컨디션을 유지하는 활력 넘치는 날이에요 💪",
          "운동 효과가 평소보다 두 배로 나타나는 날이에요 🏃‍♀️",
          "면역력이 강해져서 어떤 질병도 이겨낼 수 있어요 🛡️",
          "다이어트나 체중 관리가 성공적으로 진행될 거예요 📏",
          "피부가 맑고 깨끗해져서 자신감이 넘칠 거예요 ✨",
          "숙면을 취해서 아침에 개운하게 일어날 수 있어요 😴",
          "스트레스가 모두 해소되고 마음이 평화로워져요 🧘",
          "체력이 넘쳐서 평소보다 더 많은 일을 할 수 있어요 ⚡",
          "건강 검진 결과가 매우 좋게 나올 거예요 🏥",
          "젊음과 활력이 온몸에서 뿜어져 나오는 날이에요 🌟",
        ],
        negative: [
          "컨디션이 좋지 않을 수 있으니 무리하지 마세요 😷",
          "감기에 걸리기 쉬우니 옷을 따뜻하게 입으세요 🧥",
          "소화가 잘 안 될 수 있으니 가벼운 음식을 드세요 🥗",
          "두통이나 어지러움이 있을 수 있으니 충분히 쉬세요 🤕",
          "수면 부족으로 피곤할 수 있으니 일찍 주무세요 🛌",
          "관절이나 근육통이 있을 수 있으니 스트레칭하세요 🤸",
          "눈의 피로가 심할 수 있으니 자주 쉬어주세요 👁️",
          "스트레스로 인한 긴장이 있을 수 있으니 명상하세요 🧘",
          "알레르기 증상이 나타날 수 있으니 주의하세요 🤧",
          "체력이 떨어질 수 있으니 영양제를 챙겨 드세요 💊",
        ],
        neutral: [
          "평소와 비슷한 건강 상태를 유지하는 날이에요 🌿",
          "특별히 아프지도 건강하지도 않은 보통의 하루예요 😌",
          "가벼운 산책이나 스트레칭을 하기 좋은 날이에요 🚶",
          "건강한 식단을 계획하고 실천하기 좋은 때예요 🥦",
          "정기적인 건강 체크를 받기에 적당한 시기예요 🏥",
          "새로운 운동을 시작하기보다는 유지하는 게 좋아요 🏃",
          "몸의 신호에 귀 기울이며 필요한 휴식을 취하세요 👂",
          "평범한 일상 속에서 건강 습관을 만들어가세요 📋",
          "물을 충분히 마시고 규칙적인 생활을 하세요 💧",
          "몸과 마음의 균형을 유지하기 좋은 날이에요 ⚖️",
        ],
      },
      meeting: {
        positive: [
          "회식에서 분위기 메이커가 되어 모두를 즐겁게 할 거예요 🎉",
          "상사나 선배와 특별히 가까워질 수 있는 기회가 생겨요 🤝",
          "회식 자리에서 승진이나 좋은 소식을 들을 수 있어요 📢",
          "평소 어색했던 동료와 친해져서 든든한 아군이 생겨요 😊",
          "회식 게임에서 연승해서 인기를 독차지할 거예요 🏆",
          "맛있는 음식과 즐거운 대화로 완벽한 회식이 될 거예요 🍻",
          "노래방에서 당신의 숨은 실력이 폭발할 거예요 🎤",
          "회식비를 상사가 모두 계산해줄 수도 있어요 💳",
          "팀의 결속력이 강화되는 의미 있는 시간이 될 거예요 👥",
          "2차, 3차까지 즐겁게 이어지는 완벽한 회식이에요 🎊",
        ],
        negative: [
          "회식에서 실수할 수 있으니 술은 적당히 드세요 🍺",
          "민감한 화제는 피하고 듣는 역할을 하세요 🤐",
          "늦게까지 이어질 수 있으니 다음 날 일정을 체크하세요 ⏰",
          "음식이 입맛에 안 맞을 수 있으니 미리 간식을 드세요 🍔",
          "술자리 압박이 있을 수 있으니 정중히 거절하세요 🙅",
          "시끄러운 장소일 수 있으니 목 관리를 하세요 🗣️",
          "교통이 불편할 수 있으니 미리 귀가 방법을 정하세요 🚖",
          "지갑을 조심하세요. 분실 위험이 있어요 👛",
          "다음 날 숙취가 심할 수 있으니 해장 준비를 하세요 💊",
          "원치 않는 2차 참석 압박이 있을 수 있어요 😓",
        ],
        neutral: [
          "평범하고 무난한 회식이 될 거예요 🍽️",
          "특별한 일 없이 적당히 먹고 마시는 자리가 될 거예요 🥘",
          "일찍 끝나서 충분한 휴식을 취할 수 있어요 🏠",
          "조용한 분위기에서 차분한 대화를 나눌 수 있어요 ☕",
          "새로운 맛집을 발견하는 소소한 즐거움이 있어요 🍴",
          "동료들과 일상적인 대화를 나누는 편안한 시간이에요 💬",
          "1차만 하고 깔끔하게 마무리될 가능성이 높아요 ✅",
          "특별히 기억에 남지는 않지만 나쁘지 않은 회식이에요 😌",
          "음식이 평범하지만 분위기는 화목할 거예요 🤗",
          "회식 인원이 적어서 부담 없이 즐길 수 있어요 👫",
        ],
      },
    };

    // 타로카드 데이터는 별도 메서드로 분리
  }

  initializeTarotCards() {
    // 타로카드 데이터 - 메이저 아르카나
    this.majorArcana = [
      {
        name: "The Fool",
        meaning: "새로운 시작과 모험",
        emoji: "🃏",
        advice: "두려워 말고 첫걸음을 내디디세요.",
      },
      {
        name: "The Magician",
        meaning: "의지와 실현",
        emoji: "🔮",
        advice: "당신의 능력을 믿으세요.",
      },
      {
        name: "The High Priestess",
        meaning: "직감과 내면의 지혜",
        emoji: "🌙",
        advice: "논리보다 직감을 따르세요.",
      },
      {
        name: "The Empress",
        meaning: "풍요, 돌봄, 창조성",
        emoji: "👸",
        advice: "사랑과 돌봄을 나누세요.",
      },
      {
        name: "The Emperor",
        meaning: "권위, 리더십, 질서",
        emoji: "👑",
        advice: "체계적으로 행동하세요.",
      },
      {
        name: "The Hierophant",
        meaning: "전통, 규범, 조언",
        emoji: "⛪",
        advice: "멘토의 말을 경청하세요.",
      },
      {
        name: "The Lovers",
        meaning: "사랑과 선택",
        emoji: "💕",
        advice: "진심을 표현하세요.",
      },
      {
        name: "The Chariot",
        meaning: "승리, 전진, 결단",
        emoji: "🏎️",
        advice: "목표를 향해 밀고 나가세요.",
      },
      {
        name: "Strength",
        meaning: "용기와 인내",
        emoji: "💪",
        advice: "부드럽게 극복하세요.",
      },
      {
        name: "The Hermit",
        meaning: "성찰과 고독",
        emoji: "🔦",
        advice: "혼자만의 시간을 가지세요.",
      },
      {
        name: "Wheel of Fortune",
        meaning: "운명의 수레바퀴",
        emoji: "☸️",
        advice: "변화를 받아들이세요.",
      },
      {
        name: "Justice",
        meaning: "정의와 균형",
        emoji: "⚖️",
        advice: "공정하게 판단하세요.",
      },
      {
        name: "The Hanged Man",
        meaning: "희생과 관점의 전환",
        emoji: "🙃",
        advice: "다른 각도로 바라보세요.",
      },
      {
        name: "Death",
        meaning: "변화와 재생",
        emoji: "💀",
        advice: "끝은 새로운 시작입니다.",
      },
      {
        name: "Temperance",
        meaning: "절제와 조화",
        emoji: "🏺",
        advice: "균형을 유지하세요.",
      },
      {
        name: "The Devil",
        meaning: "속박과 유혹",
        emoji: "😈",
        advice: "자유를 찾으세요.",
      },
      {
        name: "The Tower",
        meaning: "급격한 변화",
        emoji: "🏚️",
        advice: "무너짐은 재건의 시작입니다.",
      },
      {
        name: "The Star",
        meaning: "희망과 영감",
        emoji: "⭐",
        advice: "꿈을 포기하지 마세요.",
      },
      {
        name: "The Moon",
        meaning: "환상과 불안",
        emoji: "🌙",
        advice: "직감을 믿으세요.",
      },
      {
        name: "The Sun",
        meaning: "기쁨과 성공",
        emoji: "☀️",
        advice: "긍정적으로 임하세요.",
      },
      {
        name: "Judgement",
        meaning: "심판과 각성",
        emoji: "🎺",
        advice: "과거를 정리하고 앞으로 나아가세요.",
      },
      {
        name: "The World",
        meaning: "완성과 성취",
        emoji: "🌍",
        advice: "당신은 모든 것을 이룰 수 있습니다.",
      },
    ];

    // 타로카드 데이터 - 마이너 아르카나
    this.minorArcana = {
      wands: [
        {
          name: "Ace of Wands",
          meaning: "새로운 시작, 영감, 성장",
          emoji: "🔥",
          advice: "열정적인 시작을 하세요.",
        },
        {
          name: "Two of Wands",
          meaning: "계획, 진보, 결정",
          emoji: "🎯",
          advice: "장기적인 계획을 세우세요.",
        },
        {
          name: "Three of Wands",
          meaning: "확장, 예견, 기회",
          emoji: "🌅",
          advice: "더 넓은 시야를 가지세요.",
        },
        {
          name: "Four of Wands",
          meaning: "축하, 조화, 안정",
          emoji: "🎉",
          advice: "성취를 축하하세요.",
        },
        {
          name: "Five of Wands",
          meaning: "갈등, 경쟁, 도전",
          emoji: "⚔️",
          advice: "건설적인 경쟁을 하세요.",
        },
        {
          name: "Six of Wands",
          meaning: "승리, 인정, 성공",
          emoji: "🏆",
          advice: "자신감을 가지세요.",
        },
        {
          name: "Seven of Wands",
          meaning: "방어, 도전, 인내",
          emoji: "🛡️",
          advice: "신념을 지키세요.",
        },
        {
          name: "Eight of Wands",
          meaning: "빠른 진행, 움직임",
          emoji: "⚡",
          advice: "신속하게 행동하세요.",
        },
        {
          name: "Nine of Wands",
          meaning: "인내, 용기, 지속",
          emoji: "💪",
          advice: "조금만 더 버티세요.",
        },
        {
          name: "Ten of Wands",
          meaning: "부담, 책임, 압박",
          emoji: "🏋️",
          advice: "짐을 나누세요.",
        },
        {
          name: "Page of Wands",
          meaning: "열정, 모험, 발견",
          emoji: "🔍",
          advice: "새로운 것을 탐험하세요.",
        },
        {
          name: "Knight of Wands",
          meaning: "모험, 열정, 충동",
          emoji: "🏇",
          advice: "열정을 행동으로 옮기세요.",
        },
        {
          name: "Queen of Wands",
          meaning: "자신감, 용기, 결단력",
          emoji: "👸",
          advice: "카리스마를 발휘하세요.",
        },
        {
          name: "King of Wands",
          meaning: "리더십, 비전, 영향력",
          emoji: "👑",
          advice: "리더의 자질을 보이세요.",
        },
      ],
      cups: [
        {
          name: "Ace of Cups",
          meaning: "새로운 사랑, 감정, 직관",
          emoji: "💖",
          advice: "마음을 열어보세요.",
        },
        {
          name: "Two of Cups",
          meaning: "파트너십, 조화, 연결",
          emoji: "💑",
          advice: "관계를 소중히 하세요.",
        },
        {
          name: "Three of Cups",
          meaning: "축하, 우정, 공동체",
          emoji: "🥂",
          advice: "함께 기뻐하세요.",
        },
        {
          name: "Four of Cups",
          meaning: "무관심, 성찰, 재평가",
          emoji: "😔",
          advice: "새로운 기회를 놓치지 마세요.",
        },
        {
          name: "Five of Cups",
          meaning: "상실, 후회, 실망",
          emoji: "😢",
          advice: "남은 것에 감사하세요.",
        },
        {
          name: "Six of Cups",
          meaning: "향수, 순수, 과거",
          emoji: "🎁",
          advice: "순수한 마음을 회복하세요.",
        },
        {
          name: "Seven of Cups",
          meaning: "환상, 선택, 가능성",
          emoji: "🌈",
          advice: "현실적으로 선택하세요.",
        },
        {
          name: "Eight of Cups",
          meaning: "포기, 전환, 여정",
          emoji: "🚶",
          advice: "더 나은 것을 찾아 떠나세요.",
        },
        {
          name: "Nine of Cups",
          meaning: "만족, 성취, 소원",
          emoji: "😊",
          advice: "감사하는 마음을 가지세요.",
        },
        {
          name: "Ten of Cups",
          meaning: "행복, 가족, 완성",
          emoji: "👨‍👩‍👧‍👦",
          advice: "가족과 함께하세요.",
        },
        {
          name: "Page of Cups",
          meaning: "감성, 창의성, 메시지",
          emoji: "💌",
          advice: "감정에 귀 기울이세요.",
        },
        {
          name: "Knight of Cups",
          meaning: "로맨스, 매력, 상상력",
          emoji: "🤴",
          advice: "낭만을 추구하세요.",
        },
        {
          name: "Queen of Cups",
          meaning: "직관, 공감, 치유",
          emoji: "👸",
          advice: "타인을 이해하고 돌보세요.",
        },
        {
          name: "King of Cups",
          meaning: "감정의 균형, 관대함",
          emoji: "👑",
          advice: "감정을 현명하게 다스리세요.",
        },
      ],
      swords: [
        {
          name: "Ace of Swords",
          meaning: "명확성, 돌파구, 진실",
          emoji: "⚔️",
          advice: "진실을 말하세요.",
        },
        {
          name: "Two of Swords",
          meaning: "결정 불능, 교착, 균형",
          emoji: "🤔",
          advice: "결정을 미루지 마세요.",
        },
        {
          name: "Three of Swords",
          meaning: "상심, 슬픔, 치유",
          emoji: "💔",
          advice: "아픔을 받아들이고 치유하세요.",
        },
        {
          name: "Four of Swords",
          meaning: "휴식, 회복, 평화",
          emoji: "😴",
          advice: "충분히 쉬세요.",
        },
        {
          name: "Five of Swords",
          meaning: "갈등, 패배, 포기",
          emoji: "😤",
          advice: "물러날 때를 알아보세요.",
        },
        {
          name: "Six of Swords",
          meaning: "전환, 변화, 여행",
          emoji: "⛵",
          advice: "더 나은 곳으로 이동하세요.",
        },
        {
          name: "Seven of Swords",
          meaning: "속임수, 전략, 고독",
          emoji: "🕵️",
          advice: "정직하게 행동하세요.",
        },
        {
          name: "Eight of Swords",
          meaning: "제한, 속박, 무력감",
          emoji: "😰",
          advice: "스스로 만든 한계를 벗어나세요.",
        },
        {
          name: "Nine of Swords",
          meaning: "불안, 걱정, 악몽",
          emoji: "😱",
          advice: "걱정을 내려놓으세요.",
        },
        {
          name: "Ten of Swords",
          meaning: "끝, 배신, 재생",
          emoji: "😵",
          advice: "끝은 새로운 시작입니다.",
        },
        {
          name: "Page of Swords",
          meaning: "호기심, 정신력, 경계",
          emoji: "🗡️",
          advice: "배우고 관찰하세요.",
        },
        {
          name: "Knight of Swords",
          meaning: "행동, 충동, 용기",
          emoji: "🏇",
          advice: "신중하게 돌진하세요.",
        },
        {
          name: "Queen of Swords",
          meaning: "독립성, 명확성, 직접성",
          emoji: "👸",
          advice: "명확하게 소통하세요.",
        },
        {
          name: "King of Swords",
          meaning: "지적 권위, 진실, 정의",
          emoji: "👑",
          advice: "공정하게 판단하세요.",
        },
      ],
      pentacles: [
        {
          name: "Ace of Pentacles",
          meaning: "새로운 기회, 번영, 보상",
          emoji: "💰",
          advice: "현실적인 기회를 잡으세요.",
        },
        {
          name: "Two of Pentacles",
          meaning: "균형, 적응력, 시간 관리",
          emoji: "🤹",
          advice: "균형을 유지하세요.",
        },
        {
          name: "Three of Pentacles",
          meaning: "팀워크, 계획, 능력",
          emoji: "👥",
          advice: "협력하여 일하세요.",
        },
        {
          name: "Four of Pentacles",
          meaning: "보안, 통제, 보수성",
          emoji: "🔒",
          advice: "너무 움켜쥐지 마세요.",
        },
        {
          name: "Five of Pentacles",
          meaning: "재정적 손실, 고립, 걱정",
          emoji: "❄️",
          advice: "도움을 요청하세요.",
        },
        {
          name: "Six of Pentacles",
          meaning: "관대함, 자선, 공유",
          emoji: "🤲",
          advice: "나누는 기쁨을 느끼세요.",
        },
        {
          name: "Seven of Pentacles",
          meaning: "인내, 투자, 성과",
          emoji: "🌱",
          advice: "인내심을 가지고 기다리세요.",
        },
        {
          name: "Eight of Pentacles",
          meaning: "기술, 헌신, 세부사항",
          emoji: "🔨",
          advice: "꾸준히 연마하세요.",
        },
        {
          name: "Nine of Pentacles",
          meaning: "풍요, 자립, 사치",
          emoji: "💎",
          advice: "성취를 즐기세요.",
        },
        {
          name: "Ten of Pentacles",
          meaning: "유산, 안정, 가족",
          emoji: "🏰",
          advice: "장기적인 안정을 추구하세요.",
        },
        {
          name: "Page of Pentacles",
          meaning: "기회, 학습, 새로운 시작",
          emoji: "📚",
          advice: "배움에 투자하세요.",
        },
        {
          name: "Knight of Pentacles",
          meaning: "책임감, 노력, 보수성",
          emoji: "🐴",
          advice: "꾸준히 전진하세요.",
        },
        {
          name: "Queen of Pentacles",
          meaning: "실용성, 돌봄, 풍요",
          emoji: "👸",
          advice: "현실적으로 돌보세요.",
        },
        {
          name: "King of Pentacles",
          meaning: "성공, 안정성, 리더십",
          emoji: "👑",
          advice: "물질적 성공을 나누세요.",
        },
      ],
    };
  }
  initializeLuckyItems() {
    this.luckyColors = [
      "정열의 빨간색",
      "평화의 파란색",
      "희망의 노란색",
      "생명의 초록색",
      "신비의 보라색",
      "사랑의 분홍색",
      "활력의 주황색",
      "순수의 하얀색",
      "고급스러운 검정색",
      "중립의 회색",
      "자연의 갈색",
      "청량한 하늘색",
      "우아한 남색",
      "부드러운 연두색",
      "따뜻한 베이지색",
      "시원한 민트색",
      "로맨틱한 라벤더색",
      "화려한 금색",
      "세련된 은색",
      "깊은 청록색",
      "상큼한 라임색",
      "달콤한 복숭아색",
      "차분한 카키색",
      "신선한 아쿠아색",
    ];

    this.luckyItems = [
      "행운의 동전",
      "네잎클로버",
      "드림캐처",
      "작은 수정",
      "향초",
      "귀여운 인형",
      "예쁜 머그컵",
      "향수",
      "립밤",
      "손수건",
      "열쇠고리",
      "북마크",
      "펜",
      "노트",
      "스티커",
      "엽서",
      "배지",
      "팔찌",
      "반지",
      "목걸이",
      "귀걸이",
      "시계",
      "선글라스",
      "모자",
      "스카프",
      "양말",
      "텀블러",
      "에코백",
      "필통",
      "다이어리",
      "캔들",
      "디퓨저",
      "쿠션",
      "블랭킷",
      "슬리퍼",
      "안대",
      "귀마개",
      "핸드크림",
      "마스크팩",
      "비타민",
      "차",
      "초콜릿",
      "사탕",
      "껌",
      "USB",
      "충전기",
      "이어폰",
      "스마트폰 케이스",
      "그립톡",
      "보조배터리",
    ];

    this.luckyFoods = [
      // 한식
      "김치찌개",
      "된장찌개",
      "순두부찌개",
      "부대찌개",
      "김치볶음밥",
      "비빔밥",
      "불고기",
      "삼겹살",
      "갈비",
      "냉면",
      "국밥",
      "설렁탕",
      "삼계탕",
      "갈비탕",
      "육개장",
      "해장국",
      "떡볶이",
      "순대",
      "김밥",
      "제육볶음",
      "닭갈비",
      "보쌈",
      "족발",
      "파전",
      "김치전",
      "두부김치",

      // 중식
      "짜장면",
      "짬뽕",
      "탕수육",
      "깐풍기",
      "마파두부",
      "양장피",
      "팔보채",
      "유산슬",
      "라조기",
      "깐쇼새우",
      "멘보샤",
      "고추잡채",
      "볶음밥",

      // 일식
      "초밥",
      "라멘",
      "우동",
      "소바",
      "돈카츠",
      "카레",
      "덮밥",
      "벤토",
      "오코노미야키",
      "타코야키",
      "야키토리",
      "스키야키",
      "샤브샤브",

      // 양식
      "파스타",
      "피자",
      "스테이크",
      "햄버거",
      "샌드위치",
      "리조또",
      "그라탕",
      "오믈렛",
      "샐러드",
      "수프",
      "브런치",
      "팬케이크",
      "와플",
      "토스트",

      // 아시아
      "쌀국수",
      "팟타이",
      "똠양꿍",
      "나시고렝",
      "미고렝",
      "분짜",
      "반미",
      "카오팟",
      "뿌팟퐁커리",
      "월남쌈",
      "짜조",
      "커리",
      "사테이",

      // 패스트푸드/간식
      "치킨",
      "피자",
      "떡볶이",
      "핫도그",
      "츄러스",
      "도넛",
      "마카롱",
      "케이크",
      "아이스크림",
      "빙수",
      "와플",
      "크로플",
      "타르트",

      // 디저트/음료
      "커피",
      "라떼",
      "스무디",
      "에이드",
      "차",
      "주스",
      "맥주",
      "소주",
      "와인",
      "칵테일",
      "모히또",
      "하이볼",
      "사케",
      "위스키",
    ];

    this.luckyDirections = [
      "동쪽 - 새로운 시작의 방향",
      "서쪽 - 성취와 완성의 방향",
      "남쪽 - 열정과 활력의 방향",
      "북쪽 - 지혜와 성찰의 방향",
      "동남쪽 - 번영과 성장의 방향",
      "동북쪽 - 학업과 지식의 방향",
      "서남쪽 - 사랑과 관계의 방향",
      "서북쪽 - 도움과 조력의 방향",
      "중앙 - 안정과 균형의 방향",
    ];

    this.luckyTimes = [
      "새벽 4-6시 - 영감의 시간",
      "아침 6-8시 - 시작의 시간",
      "오전 8-10시 - 집중의 시간",
      "오전 10-12시 - 성취의 시간",
      "정오 12-14시 - 만남의 시간",
      "오후 14-16시 - 결정의 시간",
      "오후 16-18시 - 마무리의 시간",
      "저녁 18-20시 - 화합의 시간",
      "밤 20-22시 - 휴식의 시간",
      "심야 22-24시 - 성찰의 시간",
    ];
  }

  getRandomMessage(messages, userId, type = null) {
    const today = TimeHelper.formatDate(new Date());
    const seed = parseInt(userId.toString() + today.replace(/\D/g, ""));

    if (type) {
      // 긍정/부정/중립 타입 결정
      const typeIndex = seed % 3;
      const types = ["positive", "negative", "neutral"];
      const selectedType = types[typeIndex];
      const typeMessages = messages[selectedType];
      const index = seed % typeMessages.length;
      return typeMessages[index];
    } else {
      const index = seed % messages.length;
      return messages[index];
    }
  }

  getFortune(userId, type) {
    return this.getRandomMessage(this.messages[type], userId, "type");
  }

  getTarot(userId) {
    const allCards = [
      ...this.majorArcana,
      ...this.minorArcana.wands,
      ...this.minorArcana.cups,
      ...this.minorArcana.swords,
      ...this.minorArcana.pentacles,
    ];
    const card = this.getRandomMessage(allCards, userId);
    return `${card.emoji} **${card.name}**\n\n✨ *의미: ${card.meaning}*\n\n💫 *조언: ${card.advice}*`;
  }

  getLucky(userId, userName) {
    const today = TimeHelper.formatDate(new Date());
    const seed = parseInt(userId.toString() + today.replace(/\D/g, ""));

    return (
      `🍀 **${userName}님의 오늘 행운 정보**\n\n` +
      `🎨 행운의 색깔: ${this.getLuckyColor(seed)}\n` +
      `🔢 행운의 번호: ${this.getLuckyNumbers(seed).join(", ")}\n` +
      `🎁 행운의 아이템: ${this.getLuckyItem(seed)}\n` +
      `🧭 행운의 방향: ${this.getLuckyDirection(seed)}\n` +
      `⏰ 행운의 시간: ${this.getLuckyTime(seed)}\n` +
      `🍽️ 오늘 점메추: ${this.getLuckyFood(seed)}`
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
}

module.exports = { FortuneService };
