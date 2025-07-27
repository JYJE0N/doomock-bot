const logger = require("../utils/Logger"); // LoggerEnhancer 적용
const TimeHelper = require("../utils/TimeHelper");
const { ObjectId } = require("mongodb");
const { getInstance } = require("../database/DatabaseManager");

class FortuneService {
  constructor() {
    this.dbManager = getInstance(); // 👈 이 부분!
    this.fortunes = {
      today: [
        "오늘은 좋은 일이 있을 것입니다.",
        "새로운 기회가 찾아올 것입니다.",
        "조심스럽게 행동하는 것이 좋겠습니다.",
      ],
      love: [
        "연인과의 관계가 좋아질 것입니다.",
        "새로운 만남이 기다리고 있습니다.",
        "인내심을 가지고 기다리세요.",
      ],
      money: [
        "재정 관리에 신경 쓰세요.",
        "투자 기회가 있을 것입니다.",
        "절약하는 것이 좋겠습니다.",
      ],
    };

    logger.service("FortuneService", "서비스 생성");
  }

  async initialize() {
    await this.dbManager.ensureConnection();

    logger.success("FortuneService 초기화 완료");
  }

  async getTodayFortune(userId) {
    const fortune = this.getRandomFortune("today");
    logger.data("fortune", "today", userId);
    return {
      type: "today",
      message: fortune,
      icon: "✨",
    };
  }

  async getLoveFortune(userId) {
    const fortune = this.getRandomFortune("love");
    logger.data("fortune", "love", userId);
    return {
      type: "love",
      message: fortune,
      icon: "💕",
    };
  }

  async getMoneyFortune(userId) {
    const fortune = this.getRandomFortune("money");
    logger.data("fortune", "money", userId);
    return {
      type: "money",
      message: fortune,
      icon: "💰",
    };
  }

  getRandomFortune(type) {
    const fortunes = this.fortunes[type] || this.fortunes.today;
    return fortunes[Math.floor(Math.random() * fortunes.length)];
  }

  async cleanup() {
    logger.info("FortuneService 정리 완료");
  }
}

module.exports = FortuneService;
