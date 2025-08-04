// src/data/TarotData.js - 완전한 타로 카드 데이터 (78장)

/**
 * 🎴 타로 카드 전체 데이터
 * - 메이저 아르카나 22장
 * - 마이너 아르카나 56장 (4개 슈트 × 14장)
 */

// 🌟 메이저 아르카나 (0-21번)
const MAJOR_ARCANA = [
  {
    id: 0,
    number: 0,
    name: "The Fool",
    korean: "바보",
    emoji: "🤡",
    arcana: "major",
    keywords: ["새로운 시작", "순수함", "모험", "자유로운 영혼"],
    meaning: {
      upright:
        "새로운 여정이 시작됩니다. 순수한 마음으로 도전하세요. 예상치 못한 모험이 기다리고 있습니다.",
      reversed: "무모함과 경솔함을 경계하세요. 신중한 판단이 필요한 시기입니다."
    },
    advice: "두려움 없이 새로운 시작을 받아들이되, 기본적인 준비는 하세요."
  },
  {
    id: 1,
    number: 1,
    name: "The Magician",
    korean: "마법사",
    emoji: "🎩",
    arcana: "major",
    keywords: ["창조력", "의지력", "집중", "능력 발현"],
    meaning: {
      upright:
        "당신에게는 목표를 달성할 모든 능력이 있습니다. 의지력을 발휘하여 원하는 것을 창조하세요.",
      reversed:
        "재능을 낭비하거나 잘못 사용하고 있을 수 있습니다. 진정한 목적을 찾으세요."
    },
    advice: "자신의 능력을 믿고 구체적인 행동으로 옮기세요."
  },
  {
    id: 2,
    number: 2,
    name: "The High Priestess",
    korean: "여교황",
    emoji: "🔮",
    arcana: "major",
    keywords: ["직관", "내면의 지혜", "신비", "잠재의식"],
    meaning: {
      upright:
        "내면의 목소리에 귀 기울이세요. 직관이 올바른 길을 안내할 것입니다.",
      reversed: "감정과 논리 사이의 균형이 필요합니다. 숨겨진 진실을 찾으세요."
    },
    advice: "명상과 성찰을 통해 내면의 지혜를 발견하세요."
  },
  {
    id: 3,
    number: 3,
    name: "The Empress",
    korean: "황후",
    emoji: "👸",
    arcana: "major",
    keywords: ["풍요", "창조성", "모성애", "자연"],
    meaning: {
      upright:
        "창조적 에너지가 넘치는 시기입니다. 풍요로운 결실을 기대할 수 있습니다.",
      reversed: "자기 관리가 필요합니다. 과도한 의존이나 질투를 경계하세요."
    },
    advice: "창조적 프로젝트를 시작하기 좋은 때입니다. 자연과 교감하세요."
  },
  {
    id: 4,
    number: 4,
    name: "The Emperor",
    korean: "황제",
    emoji: "🤴",
    arcana: "major",
    keywords: ["권위", "안정", "구조", "리더십"],
    meaning: {
      upright:
        "체계적인 계획과 강한 리더십이 성공을 가져옵니다. 책임감을 가지고 행동하세요.",
      reversed: "경직된 사고나 독재적 태도를 경계하세요. 유연성이 필요합니다."
    },
    advice: "규칙과 질서를 확립하되, 타인의 의견도 존중하세요."
  },
  {
    id: 5,
    number: 5,
    name: "The Hierophant",
    korean: "교황",
    emoji: "⛪",
    arcana: "major",
    keywords: ["전통", "영적 지도", "교육", "믿음"],
    meaning: {
      upright:
        "전통적인 가치와 지혜에서 답을 찾을 수 있습니다. 멘토나 스승을 만날 수 있습니다.",
      reversed:
        "기존 관념에서 벗어나 새로운 관점이 필요합니다. 독립적으로 생각하세요."
    },
    advice: "검증된 방법을 따르되, 자신만의 신념도 중요하게 여기세요."
  },
  {
    id: 6,
    number: 6,
    name: "The Lovers",
    korean: "연인",
    emoji: "💕",
    arcana: "major",
    keywords: ["사랑", "선택", "조화", "관계"],
    meaning: {
      upright:
        "중요한 선택의 순간입니다. 사랑과 조화가 당신을 인도할 것입니다.",
      reversed: "관계의 불균형이나 잘못된 선택을 재고해야 합니다."
    },
    advice: "마음의 소리를 따르되, 현실적인 면도 고려하세요."
  },
  {
    id: 7,
    number: 7,
    name: "The Chariot",
    korean: "전차",
    emoji: "🏎️",
    arcana: "major",
    keywords: ["승리", "의지력", "결단력", "전진"],
    meaning: {
      upright:
        "강한 의지와 결단력으로 목표를 향해 전진하세요. 승리가 가까이 있습니다.",
      reversed:
        "방향을 잃었거나 통제력을 상실했을 수 있습니다. 목표를 재정립하세요."
    },
    advice: "감정과 이성의 균형을 유지하며 목표를 향해 나아가세요."
  },
  {
    id: 8,
    number: 8,
    name: "Strength",
    korean: "힘",
    emoji: "💪",
    arcana: "major",
    keywords: ["내면의 힘", "용기", "인내", "자제력"],
    meaning: {
      upright:
        "부드러운 힘과 인내로 어려움을 극복할 수 있습니다. 자신을 믿으세요.",
      reversed: "자신감 부족이나 내면의 두려움을 극복해야 합니다."
    },
    advice: "공격적이지 않은 방법으로 상황을 다루세요. 인내가 열쇠입니다."
  },
  {
    id: 9,
    number: 9,
    name: "The Hermit",
    korean: "은둔자",
    emoji: "🏔️",
    arcana: "major",
    keywords: ["내적 탐구", "지혜", "고독", "성찰"],
    meaning: {
      upright:
        "내면을 들여다보고 진정한 자아를 찾을 시간입니다. 혼자만의 시간이 필요합니다.",
      reversed: "고립감이나 외로움을 느낄 수 있습니다. 적절한 균형을 찾으세요."
    },
    advice: "잠시 물러나 상황을 객관적으로 바라보세요."
  },
  {
    id: 10,
    number: 10,
    name: "Wheel of Fortune",
    korean: "운명의 수레바퀴",
    emoji: "🎰",
    arcana: "major",
    keywords: ["운명", "변화", "순환", "기회"],
    meaning: {
      upright:
        "운명의 수레바퀴가 돌고 있습니다. 긍정적인 변화와 새로운 기회가 찾아옵니다.",
      reversed: "일시적인 불운이나 정체기입니다. 이 또한 지나갈 것입니다."
    },
    advice: "변화를 받아들이고 흐름에 맡기세요. 모든 것은 순환합니다."
  },
  {
    id: 11,
    number: 11,
    name: "Justice",
    korean: "정의",
    emoji: "⚖️",
    arcana: "major",
    keywords: ["공정", "균형", "진실", "책임"],
    meaning: {
      upright:
        "공정한 판단과 균형이 중요합니다. 정직하게 행동하면 좋은 결과가 있을 것입니다.",
      reversed: "불공정한 상황이나 편견을 경계하세요. 객관적 시각이 필요합니다."
    },
    advice: "모든 면을 고려하여 공정한 결정을 내리세요."
  },
  {
    id: 12,
    number: 12,
    name: "The Hanged Man",
    korean: "매달린 남자",
    emoji: "🙃",
    arcana: "major",
    keywords: ["희생", "새로운 관점", "인내", "깨달음"],
    meaning: {
      upright:
        "다른 관점에서 상황을 바라볼 필요가 있습니다. 희생이 새로운 깨달음을 가져옵니다.",
      reversed: "불필요한 희생이나 정체 상태에서 벗어나야 합니다."
    },
    advice: "기다림과 관점의 전환이 해답을 가져다줄 것입니다."
  },
  {
    id: 13,
    number: 13,
    name: "Death",
    korean: "죽음",
    emoji: "💀",
    arcana: "major",
    keywords: ["변화", "종료", "재생", "변환"],
    meaning: {
      upright:
        "한 단계가 끝나고 새로운 시작이 다가옵니다. 과거를 놓아주고 변화를 받아들이세요.",
      reversed: "변화에 대한 저항이나 과거에 대한 집착을 버려야 합니다."
    },
    advice: "끝은 새로운 시작입니다. 변화를 두려워하지 마세요."
  },
  {
    id: 14,
    number: 14,
    name: "Temperance",
    korean: "절제",
    emoji: "🧘",
    arcana: "major",
    keywords: ["균형", "조화", "인내", "통합"],
    meaning: {
      upright:
        "균형과 조화가 성공의 열쇠입니다. 인내심을 가지고 차근차근 진행하세요.",
      reversed: "극단적인 성향이나 조급함을 경계하세요. 중도를 찾으세요."
    },
    advice: "서두르지 말고 적절한 균형점을 찾으세요."
  },
  {
    id: 15,
    number: 15,
    name: "The Devil",
    korean: "악마",
    emoji: "😈",
    arcana: "major",
    keywords: ["속박", "유혹", "물질주의", "집착"],
    meaning: {
      upright:
        "물질적 욕망이나 나쁜 습관에 속박되어 있을 수 있습니다. 자유를 찾으세요.",
      reversed:
        "속박에서 벗어나 자유를 찾고 있습니다. 해방의 시기가 다가옵니다."
    },
    advice: "자신을 속박하는 것이 무엇인지 인식하고 벗어나세요."
  },
  {
    id: 16,
    number: 16,
    name: "The Tower",
    korean: "탑",
    emoji: "🏰",
    arcana: "major",
    keywords: ["급변", "파괴", "계시", "해방"],
    meaning: {
      upright:
        "예상치 못한 변화나 충격이 있을 수 있습니다. 하지만 이는 필요한 변화입니다.",
      reversed:
        "위기를 피하거나 변화에 저항하고 있습니다. 불가피한 것을 받아들이세요."
    },
    advice: "혼란 속에서도 침착함을 유지하세요. 재건의 기회입니다."
  },
  {
    id: 17,
    number: 17,
    name: "The Star",
    korean: "별",
    emoji: "⭐",
    arcana: "major",
    keywords: ["희망", "영감", "평화", "재생"],
    meaning: {
      upright: "희망과 영감이 당신을 인도합니다. 꿈을 향해 나아가세요.",
      reversed:
        "희망을 잃거나 자신감이 부족한 상태입니다. 내면의 빛을 되찾으세요."
    },
    advice: "희망을 잃지 마세요. 당신의 꿈은 이루어질 것입니다."
  },
  {
    id: 18,
    number: 18,
    name: "The Moon",
    korean: "달",
    emoji: "🌙",
    arcana: "major",
    keywords: ["환상", "직관", "불안", "잠재의식"],
    meaning: {
      upright:
        "직관을 믿되 환상과 현실을 구분하세요. 숨겨진 진실이 드러날 것입니다.",
      reversed: "혼란과 불안에서 벗어나고 있습니다. 명확성을 찾아가고 있습니다."
    },
    advice: "두려움에 맞서고 직관을 신뢰하세요."
  },
  {
    id: 19,
    number: 19,
    name: "The Sun",
    korean: "태양",
    emoji: "☀️",
    arcana: "major",
    keywords: ["성공", "기쁨", "활력", "긍정"],
    meaning: {
      upright:
        "밝은 미래와 성공이 기다리고 있습니다. 자신감을 가지고 빛나세요.",
      reversed: "일시적인 좌절이나 자신감 부족을 경험할 수 있습니다."
    },
    advice: "긍정적인 에너지로 주변을 밝히세요."
  },
  {
    id: 20,
    number: 20,
    name: "Judgement",
    korean: "심판",
    emoji: "🎺",
    arcana: "major",
    keywords: ["부활", "각성", "결산", "용서"],
    meaning: {
      upright:
        "과거를 정리하고 새롭게 시작할 때입니다. 진정한 자아를 깨우세요.",
      reversed: "과거에 대한 후회나 자기 비판에서 벗어나야 합니다."
    },
    advice: "과거를 용서하고 새로운 삶을 시작하세요."
  },
  {
    id: 21,
    number: 21,
    name: "The World",
    korean: "세계",
    emoji: "🌍",
    arcana: "major",
    keywords: ["완성", "성취", "통합", "여행"],
    meaning: {
      upright:
        "한 사이클이 완성되었습니다. 성취와 만족을 즐기며 새로운 시작을 준비하세요.",
      reversed: "미완성된 일이나 아직 도달하지 못한 목표가 있습니다."
    },
    advice: "성취를 축하하고 다음 여정을 준비하세요."
  }
];

// 🃏 마이너 아르카나 - 완드(Wands)
const WANDS_SUIT = [
  {
    id: 22,
    name: "Ace of Wands",
    korean: "완드의 에이스",
    emoji: "🔥",
    arcana: "minor",
    suit: "wands",
    number: 1,
    keywords: ["새로운 시작", "영감", "성장", "잠재력"],
    meaning: {
      upright:
        "창조적 에너지와 새로운 기회가 찾아옵니다. 열정적으로 시작하세요.",
      reversed: "지연이나 창조적 블록을 경험할 수 있습니다."
    }
  },
  {
    id: 23,
    name: "Two of Wands",
    korean: "완드의 2",
    emoji: "🌅",
    arcana: "minor",
    suit: "wands",
    number: 2,
    keywords: ["계획", "진보", "결정", "미래"],
    meaning: {
      upright: "미래를 계획하고 큰 그림을 그릴 때입니다.",
      reversed: "계획 부족이나 두려움으로 인한 정체"
    }
  },
  {
    id: 24,
    name: "Three of Wands",
    korean: "완드의 3",
    emoji: "🚢",
    arcana: "minor",
    suit: "wands",
    number: 3,
    keywords: ["확장", "예견", "리더십", "성장"],
    meaning: {
      upright: "노력의 결실이 보이기 시작합니다. 더 큰 기회가 옵니다.",
      reversed: "계획의 지연이나 장애물"
    }
  },
  {
    id: 25,
    name: "Four of Wands",
    korean: "완드의 4",
    emoji: "🎉",
    arcana: "minor",
    suit: "wands",
    number: 4,
    keywords: ["축하", "조화", "안정", "성취"],
    meaning: {
      upright: "축하할 일이 생깁니다. 안정과 조화의 시기",
      reversed: "불안정이나 조화의 부족"
    }
  },
  {
    id: 26,
    name: "Five of Wands",
    korean: "완드의 5",
    emoji: "⚔️",
    arcana: "minor",
    suit: "wands",
    number: 5,
    keywords: ["경쟁", "갈등", "도전", "차이"],
    meaning: {
      upright: "건전한 경쟁이나 의견 충돌. 성장의 기회",
      reversed: "갈등 회피나 내면의 갈등"
    }
  },
  {
    id: 27,
    name: "Six of Wands",
    korean: "완드의 6",
    emoji: "🏆",
    arcana: "minor",
    suit: "wands",
    number: 6,
    keywords: ["승리", "인정", "자신감", "성공"],
    meaning: {
      upright: "승리와 대중의 인정. 자신감이 높아집니다.",
      reversed: "자만심이나 인정받지 못함"
    }
  },
  {
    id: 28,
    name: "Seven of Wands",
    korean: "완드의 7",
    emoji: "🛡️",
    arcana: "minor",
    suit: "wands",
    number: 7,
    keywords: ["방어", "인내", "도전", "경쟁"],
    meaning: {
      upright: "자신의 입장을 방어해야 합니다. 굳건히 서세요.",
      reversed: "압도당함이나 포기"
    }
  },
  {
    id: 29,
    name: "Eight of Wands",
    korean: "완드의 8",
    emoji: "✈️",
    arcana: "minor",
    suit: "wands",
    number: 8,
    keywords: ["신속", "행동", "변화", "움직임"],
    meaning: {
      upright: "빠른 진행과 긍정적 변화. 신속한 행동이 필요",
      reversed: "지연이나 좌절"
    }
  },
  {
    id: 30,
    name: "Nine of Wands",
    korean: "완드의 9",
    emoji: "🏋️",
    arcana: "minor",
    suit: "wands",
    number: 9,
    keywords: ["인내", "회복력", "경계", "끈기"],
    meaning: {
      upright: "마지막 고비입니다. 조금만 더 인내하세요.",
      reversed: "피로감이나 편집증"
    }
  },
  {
    id: 31,
    name: "Ten of Wands",
    korean: "완드의 10",
    emoji: "🏗️",
    arcana: "minor",
    suit: "wands",
    number: 10,
    keywords: ["부담", "책임", "노력", "스트레스"],
    meaning: {
      upright: "과도한 부담과 책임. 도움을 요청하세요.",
      reversed: "부담을 내려놓음"
    }
  },
  {
    id: 32,
    name: "Page of Wands",
    korean: "완드의 시종",
    emoji: "📨",
    arcana: "minor",
    suit: "wands",
    number: 11,
    court: "page",
    keywords: ["열정", "탐험", "발견", "메시지"],
    meaning: {
      upright: "새로운 아이디어와 흥미로운 소식",
      reversed: "나쁜 소식이나 지연"
    }
  },
  {
    id: 33,
    name: "Knight of Wands",
    korean: "완드의 기사",
    emoji: "🏇",
    arcana: "minor",
    suit: "wands",
    number: 12,
    court: "knight",
    keywords: ["모험", "에너지", "열정", "충동"],
    meaning: {
      upright: "열정적인 추진력과 모험 정신",
      reversed: "무모함이나 조급함"
    }
  },
  {
    id: 34,
    name: "Queen of Wands",
    korean: "완드의 여왕",
    emoji: "👸",
    arcana: "minor",
    suit: "wands",
    number: 13,
    court: "queen",
    keywords: ["자신감", "용기", "열정", "결단력"],
    meaning: {
      upright: "자신감 있고 카리스마 있는 에너지",
      reversed: "질투나 이기심"
    }
  },
  {
    id: 35,
    name: "King of Wands",
    korean: "완드의 왕",
    emoji: "👑",
    arcana: "minor",
    suit: "wands",
    number: 14,
    court: "king",
    keywords: ["리더십", "비전", "기업가정신", "카리스마"],
    meaning: {
      upright: "자연스러운 리더십과 비전",
      reversed: "오만함이나 무모함"
    }
  }
];

// 🏆 마이너 아르카나 - 컵(Cups)
const CUPS_SUIT = [
  {
    id: 36,
    name: "Ace of Cups",
    korean: "컵의 에이스",
    emoji: "💧",
    arcana: "minor",
    suit: "cups",
    number: 1,
    keywords: ["새로운 사랑", "감정", "직관", "창조성"],
    meaning: {
      upright: "새로운 감정적 시작. 사랑과 기쁨이 넘칩니다.",
      reversed: "감정적 막힘이나 공허함"
    }
  },
  {
    id: 37,
    name: "Two of Cups",
    korean: "컵의 2",
    emoji: "💑",
    arcana: "minor",
    suit: "cups",
    number: 2,
    keywords: ["파트너십", "연결", "사랑", "조화"],
    meaning: {
      upright: "아름다운 파트너십과 상호 이해",
      reversed: "불균형이나 분리"
    }
  },
  {
    id: 38,
    name: "Three of Cups",
    korean: "컵의 3",
    emoji: "🥂",
    arcana: "minor",
    suit: "cups",
    number: 3,
    keywords: ["축하", "우정", "커뮤니티", "창조성"],
    meaning: {
      upright: "우정과 축하. 함께하는 기쁨",
      reversed: "과잉이나 삼각관계"
    }
  },
  {
    id: 39,
    name: "Four of Cups",
    korean: "컵의 4",
    emoji: "😔",
    arcana: "minor",
    suit: "cups",
    number: 4,
    keywords: ["무관심", "숙고", "재평가", "권태"],
    meaning: {
      upright: "내면을 돌아보는 시간. 새로운 기회를 놓치지 마세요.",
      reversed: "새로운 가능성에 대한 각성"
    }
  },
  {
    id: 40,
    name: "Five of Cups",
    korean: "컵의 5",
    emoji: "😢",
    arcana: "minor",
    suit: "cups",
    number: 5,
    keywords: ["상실", "슬픔", "후회", "실망"],
    meaning: {
      upright: "상실과 슬픔. 하지만 희망은 남아있습니다.",
      reversed: "회복과 수용"
    }
  },
  {
    id: 41,
    name: "Six of Cups",
    korean: "컵의 6",
    emoji: "🎈",
    arcana: "minor",
    suit: "cups",
    number: 6,
    keywords: ["향수", "순수", "선물", "과거"],
    meaning: {
      upright: "과거의 아름다운 기억. 순수한 기쁨",
      reversed: "과거에 집착하거나 미래로 나아감"
    }
  },
  {
    id: 42,
    name: "Seven of Cups",
    korean: "컵의 7",
    emoji: "🌈",
    arcana: "minor",
    suit: "cups",
    number: 7,
    keywords: ["선택", "환상", "꿈", "가능성"],
    meaning: {
      upright: "많은 선택지. 현실과 환상을 구분하세요.",
      reversed: "명확성과 결정"
    }
  },
  {
    id: 43,
    name: "Eight of Cups",
    korean: "컵의 8",
    emoji: "🚶",
    arcana: "minor",
    suit: "cups",
    number: 8,
    keywords: ["떠남", "환멸", "탐색", "변화"],
    meaning: {
      upright: "더 깊은 의미를 찾아 떠납니다.",
      reversed: "목적 없는 방황이나 포기"
    }
  },
  {
    id: 44,
    name: "Nine of Cups",
    korean: "컵의 9",
    emoji: "😊",
    arcana: "minor",
    suit: "cups",
    number: 9,
    keywords: ["만족", "소원성취", "행복", "풍요"],
    meaning: {
      upright: "소원이 이루어집니다. 감정적 만족",
      reversed: "탐욕이나 공허한 만족"
    }
  },
  {
    id: 45,
    name: "Ten of Cups",
    korean: "컵의 10",
    emoji: "🌈",
    arcana: "minor",
    suit: "cups",
    number: 10,
    keywords: ["행복", "가족", "조화", "완성"],
    meaning: {
      upright: "완벽한 행복과 감정적 충족",
      reversed: "가족 문제나 깨진 조화"
    }
  },
  {
    id: 46,
    name: "Page of Cups",
    korean: "컵의 시종",
    emoji: "💌",
    arcana: "minor",
    suit: "cups",
    number: 11,
    court: "page",
    keywords: ["창의성", "메시지", "직관", "감성"],
    meaning: {
      upright: "창의적 영감과 감정적 메시지",
      reversed: "감정적 미성숙이나 막힘"
    }
  },
  {
    id: 47,
    name: "Knight of Cups",
    korean: "컵의 기사",
    emoji: "🏇",
    arcana: "minor",
    suit: "cups",
    number: 12,
    court: "knight",
    keywords: ["로맨스", "매력", "상상력", "감정"],
    meaning: {
      upright: "로맨틱한 제안이나 창의적 추구",
      reversed: "감정적 조작이나 비현실성"
    }
  },
  {
    id: 48,
    name: "Queen of Cups",
    korean: "컵의 여왕",
    emoji: "👸",
    arcana: "minor",
    suit: "cups",
    number: 13,
    court: "queen",
    keywords: ["직관", "보살핌", "감성", "영성"],
    meaning: {
      upright: "감정적 성숙과 직관적 지혜",
      reversed: "감정적 불안정이나 의존성"
    }
  },
  {
    id: 49,
    name: "King of Cups",
    korean: "컵의 왕",
    emoji: "👑",
    arcana: "minor",
    suit: "cups",
    number: 14,
    court: "king",
    keywords: ["감정통제", "지혜", "외교", "균형"],
    meaning: {
      upright: "감정적 균형과 성숙한 지혜",
      reversed: "감정 억압이나 조작"
    }
  }
];

// ⚔️ 마이너 아르카나 - 검(Swords)
const SWORDS_SUIT = [
  {
    id: 50,
    name: "Ace of Swords",
    korean: "검의 에이스",
    emoji: "⚔️",
    arcana: "minor",
    suit: "swords",
    number: 1,
    keywords: ["명확성", "돌파구", "진실", "정신력"],
    meaning: {
      upright: "명확한 사고와 새로운 아이디어. 진실의 승리",
      reversed: "혼란이나 잘못된 정보"
    }
  },
  {
    id: 51,
    name: "Two of Swords",
    korean: "검의 2",
    emoji: "🤔",
    arcana: "minor",
    suit: "swords",
    number: 2,
    keywords: ["결정", "교착", "균형", "선택"],
    meaning: {
      upright: "어려운 결정. 균형잡힌 판단이 필요",
      reversed: "우유부단이나 정보 과부하"
    }
  },
  {
    id: 52,
    name: "Three of Swords",
    korean: "검의 3",
    emoji: "💔",
    arcana: "minor",
    suit: "swords",
    number: 3,
    keywords: ["심장의 고통", "배신", "슬픔", "상실"],
    meaning: {
      upright: "가슴 아픈 진실이나 이별",
      reversed: "치유와 용서의 시작"
    }
  },
  {
    id: 53,
    name: "Four of Swords",
    korean: "검의 4",
    emoji: "😴",
    arcana: "minor",
    suit: "swords",
    number: 4,
    keywords: ["휴식", "회복", "명상", "준비"],
    meaning: {
      upright: "휴식과 회복이 필요한 시기",
      reversed: "활동 재개나 불안"
    }
  },
  {
    id: 54,
    name: "Five of Swords",
    korean: "검의 5",
    emoji: "😤",
    arcana: "minor",
    suit: "swords",
    number: 5,
    keywords: ["갈등", "패배", "배신", "손실"],
    meaning: {
      upright: "속이 빈 승리나 갈등",
      reversed: "화해나 과거 청산"
    }
  },
  {
    id: 55,
    name: "Six of Swords",
    korean: "검의 6",
    emoji: "⛵",
    arcana: "minor",
    suit: "swords",
    number: 6,
    keywords: ["전환", "여행", "회복", "이동"],
    meaning: {
      upright: "어려움에서 벗어나 평화로운 곳으로",
      reversed: "변화에 대한 저항"
    }
  },
  {
    id: 56,
    name: "Seven of Swords",
    korean: "검의 7",
    emoji: "🥷",
    arcana: "minor",
    suit: "swords",
    number: 7,
    keywords: ["기만", "전략", "은밀함", "계획"],
    meaning: {
      upright: "전략적 행동이나 기만",
      reversed: "발각되거나 자백"
    }
  },
  {
    id: 57,
    name: "Eight of Swords",
    korean: "검의 8",
    emoji: "🔒",
    arcana: "minor",
    suit: "swords",
    number: 8,
    keywords: ["제한", "갇힘", "무력감", "자기제한"],
    meaning: {
      upright: "자신이 만든 제한에 갇힘",
      reversed: "자유와 새로운 관점"
    }
  },
  {
    id: 58,
    name: "Nine of Swords",
    korean: "검의 9",
    emoji: "😰",
    arcana: "minor",
    suit: "swords",
    number: 9,
    keywords: ["불안", "악몽", "걱정", "죄책감"],
    meaning: {
      upright: "과도한 걱정과 불안",
      reversed: "희망과 회복의 시작"
    }
  },
  {
    id: 59,
    name: "Ten of Swords",
    korean: "검의 10",
    emoji: "🏳️",
    arcana: "minor",
    suit: "swords",
    number: 10,
    keywords: ["끝", "배신", "바닥", "재생"],
    meaning: {
      upright: "고통스러운 끝. 하지만 새로운 시작",
      reversed: "회복과 재생"
    }
  },
  {
    id: 60,
    name: "Page of Swords",
    korean: "검의 시종",
    emoji: "🗣️",
    arcana: "minor",
    suit: "swords",
    number: 11,
    court: "page",
    keywords: ["호기심", "정보", "경계", "학습"],
    meaning: {
      upright: "새로운 아이디어와 정보 수집",
      reversed: "험담이나 정찰"
    }
  },
  {
    id: 61,
    name: "Knight of Swords",
    korean: "검의 기사",
    emoji: "💨",
    arcana: "minor",
    suit: "swords",
    number: 12,
    court: "knight",
    keywords: ["행동", "야망", "성급함", "용기"],
    meaning: {
      upright: "빠른 행동과 직설적 소통",
      reversed: "무모함이나 공격성"
    }
  },
  {
    id: 62,
    name: "Queen of Swords",
    korean: "검의 여왕",
    emoji: "👸",
    arcana: "minor",
    suit: "swords",
    number: 13,
    court: "queen",
    keywords: ["명확성", "지성", "독립", "진실"],
    meaning: {
      upright: "명확한 사고와 독립적 판단",
      reversed: "차가움이나 잔인함"
    }
  },
  {
    id: 63,
    name: "King of Swords",
    korean: "검의 왕",
    emoji: "👑",
    arcana: "minor",
    suit: "swords",
    number: 14,
    court: "king",
    keywords: ["권위", "진실", "지성", "판단"],
    meaning: {
      upright: "지적 권위와 공정한 판단",
      reversed: "독재나 조작"
    }
  }
];

// 💰 마이너 아르카나 - 펜타클(Pentacles)
const PENTACLES_SUIT = [
  {
    id: 64,
    name: "Ace of Pentacles",
    korean: "펜타클의 에이스",
    emoji: "💰",
    arcana: "minor",
    suit: "pentacles",
    number: 1,
    keywords: ["기회", "번영", "시작", "물질"],
    meaning: {
      upright: "새로운 재정적 기회나 물질적 시작",
      reversed: "기회 상실이나 계획 부족"
    }
  },
  {
    id: 65,
    name: "Two of Pentacles",
    korean: "펜타클의 2",
    emoji: "🤹",
    arcana: "minor",
    suit: "pentacles",
    number: 2,
    keywords: ["균형", "적응", "다중작업", "유연성"],
    meaning: {
      upright: "여러 일의 균형을 잘 맞추고 있음",
      reversed: "과부하나 균형 상실"
    }
  },
  {
    id: 66,
    name: "Three of Pentacles",
    korean: "펜타클의 3",
    emoji: "👷",
    arcana: "minor",
    suit: "pentacles",
    number: 3,
    keywords: ["팀워크", "계획", "실력", "협력"],
    meaning: {
      upright: "팀워크와 숙련된 작업",
      reversed: "팀워크 부족이나 품질 저하"
    }
  },
  {
    id: 67,
    name: "Four of Pentacles",
    korean: "펜타클의 4",
    emoji: "🔒",
    arcana: "minor",
    suit: "pentacles",
    number: 4,
    keywords: ["보존", "통제", "안정", "소유"],
    meaning: {
      upright: "재정적 안정과 보존",
      reversed: "인색함이나 물질주의"
    }
  },
  {
    id: 68,
    name: "Five of Pentacles",
    korean: "펜타클의 5",
    emoji: "🥶",
    arcana: "minor",
    suit: "pentacles",
    number: 5,
    keywords: ["어려움", "손실", "고립", "걱정"],
    meaning: {
      upright: "재정적 어려움이나 건강 문제",
      reversed: "회복과 영적 부유함"
    }
  },
  {
    id: 69,
    name: "Six of Pentacles",
    korean: "펜타클의 6",
    emoji: "🤝",
    arcana: "minor",
    suit: "pentacles",
    number: 6,
    keywords: ["관대함", "나눔", "공정", "자선"],
    meaning: {
      upright: "공정한 나눔과 관대함",
      reversed: "불공정이나 이기심"
    }
  },
  {
    id: 70,
    name: "Seven of Pentacles",
    korean: "펜타클의 7",
    emoji: "🌱",
    arcana: "minor",
    suit: "pentacles",
    number: 7,
    keywords: ["인내", "투자", "평가", "성장"],
    meaning: {
      upright: "장기 투자의 결실을 기다림",
      reversed: "조급함이나 잘못된 투자"
    }
  },
  {
    id: 71,
    name: "Eight of Pentacles",
    korean: "펜타클의 8",
    emoji: "🔨",
    arcana: "minor",
    suit: "pentacles",
    number: 8,
    keywords: ["숙련", "헌신", "장인정신", "교육"],
    meaning: {
      upright: "기술 향상과 헌신적 노력",
      reversed: "완벽주의나 무의미한 노동"
    }
  },
  {
    id: 72,
    name: "Nine of Pentacles",
    korean: "펜타클의 9",
    emoji: "💎",
    arcana: "minor",
    suit: "pentacles",
    number: 9,
    keywords: ["풍요", "독립", "자급자족", "성취"],
    meaning: {
      upright: "재정적 독립과 풍요",
      reversed: "과시나 의존성"
    }
  },
  {
    id: 73,
    name: "Ten of Pentacles",
    korean: "펜타클의 10",
    emoji: "🏰",
    arcana: "minor",
    suit: "pentacles",
    number: 10,
    keywords: ["유산", "가족", "전통", "부"],
    meaning: {
      upright: "가족의 부와 장기적 안정",
      reversed: "가족 문제나 재정 손실"
    }
  },
  {
    id: 74,
    name: "Page of Pentacles",
    korean: "펜타클의 시종",
    emoji: "📚",
    arcana: "minor",
    suit: "pentacles",
    number: 11,
    court: "page",
    keywords: ["학습", "기회", "신중함", "계획"],
    meaning: {
      upright: "새로운 학습 기회나 재정적 소식",
      reversed: "나쁜 소식이나 기회 상실"
    }
  },
  {
    id: 75,
    name: "Knight of Pentacles",
    korean: "펜타클의 기사",
    emoji: "🐎",
    arcana: "minor",
    suit: "pentacles",
    number: 12,
    court: "knight",
    keywords: ["근면", "책임", "보수적", "신뢰"],
    meaning: {
      upright: "꾸준하고 신뢰할 수 있는 진전",
      reversed: "게으름이나 정체"
    }
  },
  {
    id: 76,
    name: "Queen of Pentacles",
    korean: "펜타클의 여왕",
    emoji: "👸",
    arcana: "minor",
    suit: "pentacles",
    number: 13,
    court: "queen",
    keywords: ["양육", "실용성", "안락함", "풍요"],
    meaning: {
      upright: "실용적 지혜와 물질적 안정",
      reversed: "자기 관리 부족이나 의존성"
    }
  },
  {
    id: 77,
    name: "King of Pentacles",
    korean: "펜타클의 왕",
    emoji: "👑",
    arcana: "minor",
    suit: "pentacles",
    number: 14,
    court: "king",
    keywords: ["성공", "부", "리더십", "안정"],
    meaning: {
      upright: "사업적 성공과 재정적 안정",
      reversed: "탐욕이나 물질주의"
    }
  }
];

// 🎴 전체 타로 덱 조합
const FULL_TAROT_DECK = [
  ...MAJOR_ARCANA,
  ...WANDS_SUIT,
  ...CUPS_SUIT,
  ...SWORDS_SUIT,
  ...PENTACLES_SUIT
];

// 🔮 캘틱 크로스 포지션
const CELTIC_CROSS_POSITIONS = [
  {
    position: 1,
    key: "present",
    name: "현재 상황",
    description: "지금 당신이 처한 상황의 핵심",
    area: "중심"
  },
  {
    position: 2,
    key: "challenge",
    name: "도전/장애물",
    description: "극복해야 할 문제나 도전",
    area: "중심"
  },
  {
    position: 3,
    key: "distant_past",
    name: "원인/과거",
    description: "현재 상황의 근본 원인",
    area: "시간축"
  },
  {
    position: 4,
    key: "recent_past",
    name: "최근 과거",
    description: "최근에 일어난 관련 사건",
    area: "시간축"
  },
  {
    position: 5,
    key: "future",
    name: "가능한 미래",
    description: "현재 방향으로 갈 때의 미래",
    area: "시간축"
  },
  {
    position: 6,
    key: "immediate_future",
    name: "가까운 미래",
    description: "곧 일어날 일들",
    area: "시간축"
  },
  {
    position: 7,
    key: "approach",
    name: "당신의 접근법",
    description: "상황에 대한 당신의 태도와 접근",
    area: "내면"
  },
  {
    position: 8,
    key: "environment",
    name: "외부 환경",
    description: "주변 환경과 타인의 영향",
    area: "외부"
  },
  {
    position: 9,
    key: "hopes_fears",
    name: "희망과 두려움",
    description: "내면의 기대와 걱정",
    area: "내면"
  },
  {
    position: 10,
    key: "outcome",
    name: "최종 결과",
    description: "모든 요소를 고려한 최종 결과",
    area: "결과"
  }
];

// 🎯 타로 카드 의미 해석 도우미 함수들
const TarotHelpers = {
  /**
   * 카드의 종합적 의미 생성
   */
  getCardMeaning(card, isReversed = false) {
    if (!card.meaning) return "신비로운 메시지가 담겨 있습니다.";
    return isReversed ? card.meaning.reversed : card.meaning.upright;
  },

  /**
   * 카드 키워드 문자열 생성
   */
  getKeywordString(card) {
    return card.keywords ? card.keywords.join(", ") : "";
  },

  /**
   * 아르카나별 특성 설명
   */
  getArcanaDescription(arcana) {
    const descriptions = {
      major: "인생의 중요한 전환점과 영적 교훈을 나타냅니다.",
      minor: "일상적인 상황과 실질적인 조언을 제공합니다."
    };
    return descriptions[arcana] || "";
  },

  /**
   * 슈트별 특성 설명
   */
  getSuitDescription(suit) {
    const descriptions = {
      wands: "열정, 창의성, 행동, 영감의 에너지",
      cups: "감정, 사랑, 직관, 관계의 에너지",
      swords: "사고, 소통, 갈등, 진실의 에너지",
      pentacles: "물질, 건강, 일, 실용성의 에너지"
    };
    return descriptions[suit] || "";
  },

  /**
   * 카드 번호별 에너지 설명
   */
  getNumberEnergy(number) {
    const energies = {
      1: "새로운 시작과 순수한 잠재력",
      2: "균형, 파트너십, 선택",
      3: "창조, 성장, 협력",
      4: "안정, 구조, 기초",
      5: "변화, 도전, 불안정",
      6: "조화, 책임, 성취",
      7: "성찰, 평가, 인내",
      8: "숙달, 힘, 움직임",
      9: "완성에 가까움, 성취, 고독",
      10: "완성, 순환의 끝, 새로운 시작"
    };
    return energies[number] || "";
  },

  /**
   * 코트 카드 성격 설명
   */
  getCourtCardPersonality(court) {
    const personalities = {
      page: "호기심 많고 열정적인 초보자, 새로운 소식의 전달자",
      knight: "행동력 있고 모험적인 추구자, 변화의 주도자",
      queen: "성숙하고 직관적인 양육자, 감정적 지혜의 소유자",
      king: "권위 있고 경험 많은 지도자, 숙달된 전문가"
    };
    return personalities[court] || "";
  }
};

// 📊 타로 통계 및 분석 함수
const TarotAnalytics = {
  /**
   * 카드 조합 분석
   */
  analyzeCardCombination(cards) {
    const analysis = {
      majorCount: cards.filter((c) => c.arcana === "major").length,
      suits: {},
      elements: {},
      reversedCount: cards.filter((c) => c.isReversed).length
    };

    // 슈트별 카운트
    cards.forEach((card) => {
      if (card.suit) {
        analysis.suits[card.suit] = (analysis.suits[card.suit] || 0) + 1;
      }
      if (card.element) {
        analysis.elements[card.element] =
          (analysis.elements[card.element] || 0) + 1;
      }
    });

    return analysis;
  },

  /**
   * 전체적인 에너지 해석
   */
  interpretOverallEnergy(analysis) {
    let interpretation = [];

    // 메이저 아르카나 비율
    if (analysis.majorCount > 3) {
      interpretation.push("중요한 인생의 전환점에 있습니다");
    }

    // 역방향 카드 비율
    if (analysis.reversedCount > analysis.cards?.length / 2) {
      interpretation.push("내면의 성찰과 재평가가 필요한 시기입니다");
    }

    // 지배적인 슈트
    const dominantSuit = Object.entries(analysis.suits).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (dominantSuit && dominantSuit[1] >= 3) {
      interpretation.push(
        `${TarotHelpers.getSuitDescription(dominantSuit[0])}`
      );
    }

    return interpretation.join(". ");
  }
};

// 🌟 모듈 내보내기
module.exports = {
  MAJOR_ARCANA,
  WANDS_SUIT,
  CUPS_SUIT,
  SWORDS_SUIT,
  PENTACLES_SUIT,
  FULL_TAROT_DECK,
  CELTIC_CROSS_POSITIONS,
  TarotHelpers,
  TarotAnalytics
};
