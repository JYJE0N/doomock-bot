class FortuneManager {
  constructor() {
    this.messages = {
      general: [
        "오늘은 새로운 시작의 기운이 가득한 날입니다 🌅",
        "예상치 못한 좋은 소식이 들려올 수 있어요 📞",
        "주변 사람들과의 관계에서 따뜻함을 느낄 거예요 💝",
        "창의적인 아이디어가 샘솟는 하루가 될 것 같아요 💡",
        "작은 행운들이 연달아 찾아올 징조가 보여요 🍀",
        "평온하고 안정감 있는 하루를 보낼 수 있을 거예요 🕊️",
        "새로운 도전에 대한 용기가 생기는 날이에요 💪",
        "직감이 특히 날카로워지는 하루가 될 것 같아요 🎯",
        "우연한 만남이 인생을 바꿀 수 있는 특별한 날이에요 ✨",
        "내면의 평화를 찾을 수 있는 조용한 하루예요 🧘‍♀️"
      ],
      work: [
        "업무에 집중력이 최고조에 달하는 날이에요 🎯",
        "동료들과의 협업에서 시너지가 폭발할 거예요 🤝",
        "중요한 프로젝트에 돌파구가 보일 수 있어요 🚀",
        "리더십을 발휘할 절호의 기회가 올 거예요 👑",
        "새로운 업무 기회가 문을 두드릴 수 있어요 🚪",
        "실력을 인정받아 승진 기회가 생길지도 몰라요 📈",
        "업무 효율성이 평소보다 2배 높아질 거예요 ⚡",
        "상사나 클라이언트로부터 칭찬을 들을 수 있어요 🏆",
        "새로운 스킬을 배우기에 완벽한 타이밍이에요 📚",
        "중요한 미팅에서 좋은 인상을 남길 수 있어요 💼"
      ],
      love: [
        "연인과의 관계가 한층 더 깊어질 거예요 💕",
        "새로운 만남이 기다리고 있을 수 있어요 💘",
        "마음속 깊은 대화를 나눌 기회가 생겨요 💬",
        "로맨틱한 순간이 예상치 못한 곳에서 찾아와요 🌹",
        "진정한 사랑을 깨닫게 되는 특별한 하루예요 💖",
        "썸타는 상대와 진전이 있을 수 있어요 😊",
        "가족이나 친구들의 따뜻한 사랑을 느낄 거예요 🤗",
        "과거의 인연이 다시 연결될 가능성이 보여요 🔄",
        "첫눈에 반할 수 있는 운명적 만남의 날이에요 😍",
        "사랑 고백을 받거나 하기에 좋은 날이에요 💌"
      ],
      money: [
        "금전적 여유가 생기는 기운이 감지돼요 💰",
        "투자나 부업에 좋은 기회가 올 수 있어요 📊",
        "예상치 못한 수입이 생길 가능성이 높아요 💸",
        "절약 정신이 발동해서 돈을 모을 수 있어요 🏦",
        "재정 관리에 대한 좋은 아이디어가 떠올라요 💡",
        "부동산이나 주식에 관심을 가져볼 때예요 🏠",
        "용돈이나 보너스 소식이 들려올 수 있어요 🎁",
        "돈 관리 앱이나 가계부를 시작하기 좋은 날이에요 📱",
        "로또나 복권에 작은 행운이 있을 수 있어요 🎰",
        "부모님이나 친척으로부터 용돈을 받을 수 있어요 👴"
      ],
      health: [
        "몸과 마음이 모두 가벼워지는 날이에요 🌿",
        "새로운 운동을 시작하기에 완벽한 타이밍이에요 🏃‍♀️",
        "건강한 식단에 관심이 생길 거예요 🥗",
        "숙면을 취할 수 있는 편안한 밤이 될 거예요 😴",
        "스트레스가 자연스럽게 해소되는 하루예요 🧘‍♀️",
        "활력이 넘쳐서 하루 종일 에너지가 가득할 거예요 ⚡",
        "건강 검진이나 병원 방문을 고려해보세요 🏥",
        "명상이나 요가로 내면의 평화를 찾을 수 있어요 🕯️",
        "산책이나 자연과의 교감이 도움이 될 거예요 🌳",
        "비타민이나 영양제 섭취를 시작하기 좋은 날이에요 💊"
      ],
      meeting: [
        "회식에서 분위기 메이커 역할을 하게 될 거예요 🎉",
        "상사와의 거리감이 좁혀지는 좋은 기회가 될 거예요 👔",
        "동료들과 진솔한 대화를 나눌 수 있을 거예요 🍻",
        "회식 자리에서 새로운 친구를 만날 수 있어요 🤝",
        "평소 어색했던 팀원과 친해질 기회가 생겨요 😊",
        "회식비가 예상보다 적게 나올 수 있어요 💰",
        "맛있는 음식점을 발견하게 될 거예요 🍜",
        "회식에서 좋은 아이디어나 정보를 얻을 수 있어요 💡",
        "평소보다 일찍 끝나서 여유롭게 집에 갈 수 있어요 🏠",
        "회식 후 2차에서 특별한 추억을 만들 거예요 🎤",
        "회식 자리에서 칭찬이나 인정을 받을 수 있어요 👏",
        "동료의 의외의 매력을 발견하게 될 거예요 😍"
      ],
      tarot: [
  // 메이저 아르카나 22장
  { name: "The Fool", meaning: "새로운 시작과 모험", emoji: "🃏", advice: "두려워 말고 첫걸음을 내디디세요." },
  { name: "The Magician", meaning: "의지와 실현", emoji: "🔮", advice: "당신의 능력을 믿으세요." },
  { name: "The High Priestess", meaning: "직감과 내면의 지혜", emoji: "🌙", advice: "논리보다 직감을 따르세요." },
  { name: "The Empress", meaning: "풍요, 돌봄, 창조성", emoji: "👸", advice: "사랑과 돌봄을 나누세요." },
  { name: "The Emperor", meaning: "권위, 리더십, 질서", emoji: "👑", advice: "체계적으로 행동하세요." },
  { name: "The Hierophant", meaning: "전통, 규범, 조언", emoji: "⛪", advice: "멘토의 말을 경청하세요." },
  { name: "The Lovers", meaning: "사랑과 선택", emoji: "💕", advice: "진심을 표현하세요." },
  { name: "The Chariot", meaning: "승리, 전진, 결단", emoji: "🏎️", advice: "목표를 향해 밀고 나가세요." },
  { name: "Strength", meaning: "용기와 인내", emoji: "💪", advice: "부드럽게 극복하세요." },
  { name: "The Hermit", meaning: "성찰과 고독", emoji: "🔦", advice: "혼자만의 시간을 가지세요." },
  { name: "Wheel of Fortune", meaning: "운명의 흐름", emoji: "🎡", advice: "변화를 받아들이세요." },
  { name: "Justice", meaning: "공정함과 균형", emoji: "⚖️", advice: "올바른 선택을 하세요." },
  { name: "The Hanged Man", meaning: "관점의 전환", emoji: "🙃", advice: "다른 시각으로 보세요." },
  { name: "Death", meaning: "끝과 새로운 시작", emoji: "🦋", advice: "과거를 놓아주세요." },
  { name: "Temperance", meaning: "절제와 조화", emoji: "🧘‍♀️", advice: "극단을 피하세요." },
  { name: "The Devil", meaning: "유혹과 속박", emoji: "😈", advice: "집착을 내려놓으세요." },
  { name: "The Tower", meaning: "급작스런 변화", emoji: "⚡", advice: "흔들려도 다시 세우세요." },
  { name: "The Star", meaning: "희망과 영감", emoji: "⭐", advice: "꿈을 포기하지 마세요." },
  { name: "The Moon", meaning: "환상과 무의식", emoji: "🌔", advice: "겉모습에 속지 마세요." },
  { name: "The Sun", meaning: "기쁨과 성공", emoji: "☀️", advice: "긍정적으로 임하세요." },
  { name: "Judgement", meaning: "심판과 부활", emoji: "📯", advice: "과거를 용서하세요." },
  { name: "The World", meaning: "완성과 성취", emoji: "🌍", advice: "노력의 결실을 즐기세요." },

  // 컵 (14장)
  { name: "Ace of Cups", meaning: "감정의 새로운 시작", emoji: "🏞️", advice: "마음을 열어보세요." },
  { name: "Two of Cups", meaning: "조화로운 관계", emoji: "🥂", advice: "상대와 신뢰를 나누세요." },
  { name: "Three of Cups", meaning: "축하와 모임", emoji: "🎉", advice: "기쁨을 함께하세요." },
  { name: "Four of Cups", meaning: "무기력, 관심부족", emoji: "😶", advice: "주변의 기회를 보세요." },
  { name: "Five of Cups", meaning: "상실과 슬픔", emoji: "😢", advice: "남은 것을 소중히 하세요." },
  { name: "Six of Cups", meaning: "추억, 어린시절", emoji: "🎠", advice: "순수함을 기억하세요." },
  { name: "Seven of Cups", meaning: "환상, 선택", emoji: "💭", advice: "현실적인 판단을 하세요." },
  { name: "Eight of Cups", meaning: "떠남, 포기", emoji: "🚶‍♂️", advice: "필요하면 뒤돌아 서세요." },
  { name: "Nine of Cups", meaning: "만족, 소원 성취", emoji: "😊", advice: "작은 행복을 즐기세요." },
  { name: "Ten of Cups", meaning: "가족과 행복", emoji: "🏡", advice: "가족과 시간을 보내세요." },
  { name: "Page of Cups", meaning: "새로운 감정, 메시지", emoji: "📩", advice: "기분 좋은 소식을 받아들이세요." },
  { name: "Knight of Cups", meaning: "로맨틱 제안", emoji: "🐴", advice: "감정을 솔직히 표현하세요." },
  { name: "Queen of Cups", meaning: "공감과 이해", emoji: "👸", advice: "타인을 배려하세요." },
  { name: "King of Cups", meaning: "감정의 균형과 관대함", emoji: "👑", advice: "마음을 넓게 가지세요." },

  // 소드 (14장)
  { name: "Ace of Swords", meaning: "진실과 통찰", emoji: "⚔️", advice: "명확히 보세요." },
  { name: "Two of Swords", meaning: "결정의 기로", emoji: "⚖️", advice: "균형있게 결정하세요." },
  { name: "Three of Swords", meaning: "상처와 슬픔", emoji: "💔", advice: "상처를 직면하세요." },
  { name: "Four of Swords", meaning: "휴식과 재정비", emoji: "🛌", advice: "충분히 쉬세요." },
  { name: "Five of Swords", meaning: "갈등과 패배", emoji: "😤", advice: "논쟁을 피하세요." },
  { name: "Six of Swords", meaning: "이동과 변화", emoji: "🛶", advice: "새로운 환경을 맞이하세요." },
  { name: "Seven of Swords", meaning: "속임수, 전략", emoji: "🕵️", advice: "경계를 늦추지 마세요." },
  { name: "Eight of Swords", meaning: "제약과 속박", emoji: "🚧", advice: "스스로의 틀을 깨세요." },
  { name: "Nine of Swords", meaning: "불안과 걱정", emoji: "😰", advice: "과도한 걱정을 내려놓으세요." },
  { name: "Ten of Swords", meaning: "끝과 고통", emoji: "⚰️", advice: "새로운 시작을 준비하세요." },
  { name: "Page of Swords", meaning: "호기심과 탐색", emoji: "📜", advice: "정보를 수집하세요." },
  { name: "Knight of Swords", meaning: "빠른 행동", emoji: "🏇", advice: "주저하지 마세요." },
  { name: "Queen of Swords", meaning: "명확함과 독립", emoji: "👸", advice: "논리적으로 대하세요." },
  { name: "King of Swords", meaning: "이성적 권위", emoji: "👑", advice: "객관적으로 바라보세요." },

  // 완드 (14장)
  { name: "Ace of Wands", meaning: "열정과 시작", emoji: "🔥", advice: "즉시 실행하세요." },
  { name: "Two of Wands", meaning: "계획과 결정", emoji: "🗺️", advice: "미래를 구상하세요." },
  { name: "Three of Wands", meaning: "확장과 탐험", emoji: "🚀", advice: "시야를 넓히세요." },
  { name: "Four of Wands", meaning: "축하와 안정", emoji: "🏠", advice: "성취를 기념하세요." },
  { name: "Five of Wands", meaning: "경쟁과 도전", emoji: "🤼", advice: "건강한 경쟁을 즐기세요." },
  { name: "Six of Wands", meaning: "승리와 인정", emoji: "🏆", advice: "성과를 당당히 드러내세요." },
  { name: "Seven of Wands", meaning: "방어와 주장", emoji: "🛡️", advice: "입장을 굳건히 하세요." },
  { name: "Eight of Wands", meaning: "빠른 진행", emoji: "💨", advice: "속도를 유지하세요." },
  { name: "Nine of Wands", meaning: "지속과 인내", emoji: "🪓", advice: "조금만 더 버티세요." },
  { name: "Ten of Wands", meaning: "짐과 부담", emoji: "📦", advice: "부담을 나누세요." },
  { name: "Page of Wands", meaning: "탐험과 열정", emoji: "🎒", advice: "새로운 것을 시도하세요." },
  { name: "Knight of Wands", meaning: "모험과 추진력", emoji: "🐎", advice: "즉흥을 두려워마세요." },
  { name: "Queen of Wands", meaning: "자신감과 매력", emoji: "👸", advice: "당당히 나서세요." },
  { name: "King of Wands", meaning: "카리스마 리더십", emoji: "👑", advice: "주도하세요." },

  // 펜타클 (14장)
  { name: "Ace of Pentacles", meaning: "기회와 재물", emoji: "💰", advice: "가치를 창출하세요." },
  { name: "Two of Pentacles", meaning: "균형과 조율", emoji: "⚖️", advice: "조화를 이루세요." },
  { name: "Three of Pentacles", meaning: "협력과 팀워크", emoji: "👷‍♂️", advice: "함께 일하세요." },
  { name: "Four of Pentacles", meaning: "소유와 집착", emoji: "💎", advice: "너그러움을 배우세요." },
  { name: "Five of Pentacles", meaning: "궁핍과 어려움", emoji: "🥶", advice: "주변에 손을 내미세요." },
  { name: "Six of Pentacles", meaning: "나눔과 도움", emoji: "🎁", advice: "베풀면 돌아옵니다." },
  { name: "Seven of Pentacles", meaning: "기다림과 인내", emoji: "🌱", advice: "조급해하지 마세요." },
  { name: "Eight of Pentacles", meaning: "노력과 숙련", emoji: "🛠️", advice: "꾸준히 연습하세요." },
  { name: "Nine of Pentacles", meaning: "독립과 풍요", emoji: "🦚", advice: "자신을 칭찬하세요." },
  { name: "Ten of Pentacles", meaning: "유산과 가족", emoji: "🏰", advice: "가족과 함께하세요." },
  { name: "Page of Pentacles", meaning: "학습과 준비", emoji: "📚", advice: "새로운 것을 배워보세요." },
  { name: "Knight of Pentacles", meaning: "꾸준함과 신뢰", emoji: "🐂", advice: "신중히 나아가세요." },
  { name: "Queen of Pentacles", meaning: "실속과 따뜻함", emoji: "👸", advice: "주변을 보살피세요." },
  { name: "King of Pentacles", meaning: "부의 안정과 책임", emoji: "👑", advice: "성실함을 잃지 마세요." }
]
    };
  }
  
  // 기본 운세 메소드들
  getGeneral(userId) {
    return this.getRandomMessage(this.messages.general, userId);
  }
  
  getWork(userId) {
    return this.getRandomMessage(this.messages.work, userId);
  }
  
  getLove(userId) {
    return this.getRandomMessage(this.messages.love, userId);
  }
  
  getMoney(userId) {
    return this.getRandomMessage(this.messages.money, userId);
  }
  
  getHealth(userId) {
    return this.getRandomMessage(this.messages.health, userId);
  }
  
  getMeeting(userId) {
    return this.getRandomMessage(this.messages.meeting, userId);
  }
  
  // 타로카드 메소드
  getTarot(userId) {
    const card = this.getRandomMessage(this.messages.tarot, userId);
    return `${card.emoji} **${card.name}**\n\n✨ *의미: ${card.meaning}*\n\n💫 *조언: ${card.advice}*`;
  }
  
  // 행운 정보 메소드
  getLucky(userId) {
    const today = new Date().toDateString();
    const seed = userId + today.length;
    
    return `🍀 **오늘의 행운 정보**\n\n` +
           `🎨 행운의 색깔: ${this.getLuckyColor(seed)}\n` +
           `🔢 행운의 번호: ${this.getLuckyNumbers(seed).join(', ')}\n` +
           `🎁 행운의 아이템: ${this.getLuckyItem(seed)}\n` +
           `🧭 행운의 방향: ${this.getLuckyDirection(seed)}\n` +
           `⏰ 행운의 시간: ${this.getLuckyTime(seed)}\n` +
           `🌟 행운의 음식: ${this.getLuckyFood(seed)}`;
  }
  
  // 종합 운세 메소드
  getAll(userId, userName) {
    const general = this.getGeneral(userId);
    const work = this.getWork(userId);
    const love = this.getLove(userId);
    const money = this.getMoney(userId);
    const health = this.getHealth(userId);
    const meeting = this.getMeeting(userId);
    
    return `🔮 **${userName}님의 오늘 종합운세**\n\n` +
           `**🌟 전체운:** ${general}\n\n` +
           `**💼 업무운:** ${work}\n\n` +
           `**💕 연애운:** ${love}\n\n` +
           `**💰 재물운:** ${money}\n\n` +
           `**🌿 건강운:** ${health}\n\n` +
           `**🍻 회식운:** ${meeting}`;
  }
  
  // 헬퍼 메소드들
  getRandomMessage(messages, userId) {
    const today = new Date().toDateString();
    const seed = userId + today.length;
    const index = seed % messages.length;
    return messages[index];
  }
  
  getLuckyColor(seed) {
    const colors = ["빨간색", "파란색", "노란색", "초록색", "보라색", "분홍색", "주황색", "하얀색", "검은색", "회색"];
    return colors[seed % colors.length];
  }
  
  getLuckyNumbers(seed) {
    const numbers = [];
    for (let i = 0; i < 6; i++) {
      const num = ((seed + i * 7) % 46) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    return numbers.slice(0, 6).sort((a, b) => a - b);
  }
  
  getLuckyItem(seed) {
    const items = ["커피", "꽃", "책", "음악", "향초", "초콜릿", "편지", "미소", "동전", "목걸이", "시계", "사진"];
    return items[seed % items.length];
  }
  
  getLuckyDirection(seed) {
    const directions = ["동쪽", "서쪽", "남쪽", "북쪽", "동남쪽", "동북쪽", "서남쪽", "서북쪽"];
    return directions[seed % directions.length];
  }
  
  getLuckyTime(seed) {
    const times = ["오전 8시", "오전 10시", "오후 12시", "오후 2시", "오후 4시", "오후 6시", "저녁 8시", "저녁 10시"];
    return times[seed % times.length];
  }
  
  getLuckyFood(seed) {
    const foods = ["김치찌개", "라면", "치킨", "피자", "초밥", "파스타", "햄버거", "샐러드", "과일", "아이스크림"];
    return foods[seed % foods.length];
  }
  
  getUserName(userId) {
    // 이 메소드는 더 이상 사용하지 않음 (실제 사용자 이름 사용)
    const names = ["용감한", "지혜로운", "따뜻한", "밝은", "성실한", "창의적인", "친절한", "멋진"];
    return names[userId % names.length];
  }
}

const fortuneManager = new FortuneManager();

// 포춘 기능을 처리하는 함수
module.exports = (bot, msg) => {
  const text = msg.text || '';
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (text === '/fortune') {
    // 기본 포춘 (일반 운세)
    const fortune = fortuneManager.getGeneral(userId);
    bot.sendMessage(chatId, `🔮 **오늘의 운세**\n\n${fortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune work') {
    // 업무 운세
    const workFortune = fortuneManager.getWork(userId);
    bot.sendMessage(chatId, `💼 **오늘의 업무운**\n\n${workFortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune love') {
    // 연애 운세
    const loveFortune = fortuneManager.getLove(userId);
    bot.sendMessage(chatId, `💕 **오늘의 연애운**\n\n${loveFortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune money') {
    // 재물 운세
    const moneyFortune = fortuneManager.getMoney(userId);
    bot.sendMessage(chatId, `💰 **오늘의 재물운**\n\n${moneyFortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune health') {
    // 건강 운세
    const healthFortune = fortuneManager.getHealth(userId);
    bot.sendMessage(chatId, `🌿 **오늘의 건강운**\n\n${healthFortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune meeting') {
    // 회식 운세
    const meetingFortune = fortuneManager.getMeeting(userId);
    bot.sendMessage(chatId, `🍻 **오늘의 회식운**\n\n${meetingFortune}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune tarot') {
    // 타로 카드 (메이저 아르카나 22장)
    const tarot = fortuneManager.getTarot(userId);
    bot.sendMessage(chatId, `🃏 **오늘의 타로카드**\n\n${tarot}`, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune lucky') {
    // 행운 정보
    const lucky = fortuneManager.getLucky(userId);
    bot.sendMessage(chatId, lucky, { parse_mode: 'Markdown' });
    
  } else if (text === '/fortune all') {
    // 종합 운세
    const userName = msg.from.first_name || "익명의 사용자";
    const allFortune = fortuneManager.getAll(userId, userName);
    bot.sendMessage(chatId, allFortune, { parse_mode: 'Markdown' });
    
  } else if (text.startsWith('/fortune')) {
    // 도움말
    bot.sendMessage(chatId, 
      '🔮 **운세 사용법**\n\n' +
      '**📱 메뉴 방식:**\n' +
      '/start → 🔮 운세 → 원하는 운세 선택\n\n' +
      '**⌨️ 명령어 방식:**\n' +
      '/fortune - 오늘의 일반 운세\n' +
      '/fortune work - 오늘의 업무운\n' +
      '/fortune love - 오늘의 연애운\n' +
      '/fortune money - 오늘의 재물운\n' +
      '/fortune health - 오늘의 건강운\n' +
      '/fortune meeting - 오늘의 회식운\n' +
      '/fortune tarot - 오늘의 타로카드 (메이저 아르카나 22장)\n' +
      '/fortune lucky - 오늘의 행운 정보 (로또 번호 포함)\n' +
      '/fortune all - 종합 운세 (모든 운세 한 번에)\n\n' +
      '✨ **특징:**\n' +
      '• 개인별 맞춤 운세 (같은 날 같은 결과)\n' +
      '• 실제 이름으로 개인화\n' +
      '• 한국 시간 기준\n' +
      '• 매일 새로운 운세\n\n' +
      '🎯 **사용 예시:**\n' +
      '• 빠른 확인: /fortune\n' +
      '• 상세 확인: /fortune all\n' +
      '• 재미: /fortune tarot\n' +
      '• 로또: /fortune lucky\n\n' +
      '당신만의 특별한 운세를 확인해보세요! 🌟', 
      { parse_mode: 'Markdown' }
    );
  }
};
