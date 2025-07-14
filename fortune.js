class FortuneManager {
  constructor() {
    this.messages = {
      general: ["오늘은 기분 좋은 일이 생길 거예요 🌸", "새로운 기회가 찾아올 거예요 🚀"],
      work: ["업무 집중이 잘 되는 날이에요 💼"],
      tarot: [{ name: "The Star", meaning: "희망과 영감이 솟구치는 날", emoji: "⭐" }]
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
    return `${card.emoji} *${card.name}* - ${card.meaning}`;
  }
}
module.exports = new FortuneManager();
