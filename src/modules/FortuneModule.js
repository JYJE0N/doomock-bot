// ===== 🔮 FortuneModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper"); // ✅ 추가

class FortuneModule extends BaseModule {
  constructor(bot, options = {}) {
    super("FortuneModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;
    this.fortuneService = null;

    logger.module("FortuneModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.fortuneService = await this.serviceBuilder.getOrCreate("fortune", {
        config: this.config,
      });

      // this.fortuneService = new FortuneService();
      await this.fortuneService.initialize();
      logger.success("FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("FortuneModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      today: this.showToday,
      love: this.showLove,
      money: this.showMoney,
      help: this.showHelp,
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const command = this.extractCommand(text);
    if (command === "fortune" || command === "운세") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "fortune"
      );
      return true;
    }
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from); // ✅ 이제 작동함

    try {
      // 운세
      const stats = await this.fortuneService.getFortuneStatus(userId);

      return {
        type: "menu",
        module: "fortune",
        data: { stats },
      };
    } catch (error) {
      return { type: "error", message: "운세 메뉴를 불러올 수 없습니다." };
    }
  }

  async showToday(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const fortune = await this.fortuneService.getTodayFortune(userId);
      return {
        type: "today",
        module: "fortune",
        data: { fortune },
      };
    } catch (error) {
      logger.error("today fortune 실패", error);
      return { type: "error", message: "오늘의 운세를 불러올 수 없습니다." };
    }
  }

  async showLove(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const fortune = await this.fortuneService.getLoveFortune(userId);
      return {
        type: "love",
        module: "fortune",
        data: { fortune },
      };
    } catch (error) {
      return { type: "error", message: "애정운을 불러올 수 없습니다." };
    }
  }

  async showMoney(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const fortune = await this.fortuneService.getMoneyFortune(userId);
      return {
        type: "money",
        module: "fortune",
        data: { fortune },
      };
    } catch (error) {
      return { type: "error", message: "금전운을 불러올 수 없습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "fortune",
      data: {
        title: "운세 도움말",
        features: ["오늘의 운세", "애정운", "금전운"],
        commands: ["/fortune - 운세 메뉴"],
      },
    };
  }
}
module.exports = FortuneModule; // ✅ 필수!
