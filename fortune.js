class FortuneManager {
  constructor() {
    this.messages = {
      general: [
        "오늘은 기분 좋은 일이 생길 거예요 🌸",
        "새로운 기회가 찾아올 거예요 🚀",
        "행운이 함께할 하루가 될 거예요 🍀",
        "긍정적인 에너지가 넘치는 날이에요 ✨",
        "좋은 소식을 들을 수 있을 거예요 📬",
        "평화롭고 안정된 하루가 될 거예요 🕊️",
        "창의력이 샘솟는 날이에요 🎨",
        "소중한 사람과의 만남이 있을 거예요 💕"
      ],
      work: [
        "업무 집중이 잘 되는 날이에요 💼",
        "중요한 결정을 내리기 좋은 시기예요 📊",
        "팀워크가 빛을 발하는 날이에요 🤝",
        "새로운 아이디어가 떠오를 거예요 💡",
        "프로젝트 진행이 순조로울 거예요 📈",
        "리더십을 발휘할 기회가 올 거예요 👑",
        "효율적으로 일을 처리할 수 있어요 ⚡",
        "성과를 인정받을 수 있는 날이에요 🏆"
      ],
      tarot: [
        { name: "The Star", meaning: "희망과 영감이 솟구치는 날", emoji: "⭐" },
        { name: "The Sun", meaning: "밝고 긍정적인 에너지가 가득한 날", emoji: "☀️" },
        { name: "The Wheel of Fortune", meaning: "운명의 전환점이 될 수 있는 날", emoji: "🎡" },
        { name: "Strength", meaning: "내면의 힘을 발휘할 수 있는 날", emoji: "💪" },
        { name: "The Magician", meaning: "목표를 현실로 만들 수 있는 날", emoji: "🔮" },
        { name: "The Empress", meaning: "풍요로움과 창조성이 넘치는 날", emoji: "👸" },
        { name: "Justice", meaning: "균형과 조화를 찾을 수 있는 날", emoji: "⚖️" },
        { name: "The Hermit", meaning: "내면의 지혜를 발견할 수 있는 날", emoji: "🔦" }
      ]
    };
  }
  
  getGeneral(userId) {
    const i = userId % this.messages.general.length;
    return this.messages.general[i];
  }
  
  getWork(userId) {
    const i = userId % this.messages.work.length;
    return this.messages.work[i];
  }
  
  getTarot(userId) {
    const card = this.messages.tarot[userId % this.messages.tarot.length];
    return `${card.emoji} ${card.name}\n${card.meaning}`;
  }
}

const fortuneManager = new FortuneManager();

// 포춘 기능을 처리하는 함수
module.exports = function(bot, msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (text === '/fortune') {
    // 기본 포춘 (일반 운세)
    const fortune = fortuneManager.getGeneral(userId);
    bot.sendMessage(chatId, `🔮 오늘의 운세\n\n${fortune}`);
    
  } else if (text === '/fortune work') {
    // 업무 운세
    const workFortune = fortuneManager.getWork(userId);
    bot.sendMessage(chatId, `💼 오늘의 업무운\n\n${workFortune}`);
    
  } else if (text === '/fortune tarot') {
    // 타로 카드
    const tarot = fortuneManager.getTarot(userId);
    bot.sendMessage(chatId, `🃏 오늘의 타로카드\n\n${tarot}`);
    
  } else if (text.startsWith('/fortune')) {
    // 도움말
    bot.sendMessage(chatId, 
      '🔮 운세 사용법:\n\n' +
      '/fortune - 오늘의 일반 운세\n' +
      '/fortune work - 오늘의 업무운\n' +
      '/fortune tarot - 오늘의 타로카드\n\n' +
      '당신만의 특별한 운세를 확인해보세요! ✨'
    );
  }
};
