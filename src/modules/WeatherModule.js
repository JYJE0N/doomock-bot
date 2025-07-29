// src/modules/WeatherModule.js - 완전 수정 버전
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

class WeatherModule extends BaseModule {
  constructor(bot, options = {}) {
    super("WeatherModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;
    this.weatherService = null;
    this.config = {
      defaultLocation: process.env.DEFAULT_LOCATION || "서울",
      apiKey: process.env.WEATHER_API_KEY,
      ...options.config,
    };

    logger.module("WeatherModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      // 1. 서비스 초기화
      this.weatherService = await this.serviceBuilder.getOrCreate("weather", {
        config: this.config,
      });

      await this.weatherService.initialize();

      // 2. ✅ 액션 등록 (중요!)
      this.setupActions();

      logger.success("WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("WeatherModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      current: this.showCurrent,
      dust: this.showDust,
      help: this.showHelp,
    });

    logger.debug("WeatherModule 액션 등록 완료:", {
      registeredActions: Array.from(this.actionMap.keys()),
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const command = this.extractCommand(text);
    if (command === "weather" || command === "날씨") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "weather"
      );
      return true;
    }
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // ✅ 수정: city 변수 제거
      const weather = await this.weatherService.getCurrentWeather();
      return {
        type: "menu",
        module: "weather",
        data: { weather },
      };
    } catch (error) {
      logger.error("weather menu 실패", error);
      return {
        type: "error",
        message: error.message || "날씨 메뉴를 불러올 수 없습니다.",
        error: error.message,
      };
    }
  }

  async showCurrent(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const weather = await this.weatherService.getCurrentWeather();
      return {
        type: "current",
        module: "weather",
        data: { weather },
      };
    } catch (error) {
      logger.error("current weather 실패", error);
      return { type: "error", message: "현재 날씨를 불러올 수 없습니다." };
    }
  }

  async showDust(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const dust = await this.weatherService.getDustInfo();
      return {
        type: "dust",
        module: "weather",
        data: { dust },
      };
    } catch (error) {
      logger.error("dust info 실패", error);
      return { type: "error", message: "미세먼지 정보를 불러올 수 없습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "weather",
      data: {
        title: "날씨 도움말",
        features: ["현재 날씨", "미세먼지 정보"],
        commands: ["/weather - 날씨 메뉴"],
      },
    };
  }
}

module.exports = WeatherModule;
