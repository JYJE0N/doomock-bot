// src/modules/WeatherModule.js - 수정된 버전
const BaseModule = require("./BaseModule");
const { WeatherService } = require("../services/WeatherService");
const { getUserName } = require("../utils/UserHelper");

class WeatherModule extends BaseModule {
  constructor() {
    super("WeatherModule");
    this.weatherService = new WeatherService();
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    if (text && (text.startsWith("/weather") || text.startsWith("/날씨"))) {
      await this.handleWeatherCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    switch (subAction) {
      case "menu":
        await this.showWeatherMenu(bot, chatId, messageId, userName);
        break;
      case "current":
        await this.showCurrentWeather(bot, chatId, messageId, "화성");
        break;
      case "forecast":
        await this.showWeatherForecast(bot, chatId, messageId, "화성");
        break;
      case "seoul":
        await this.showCurrentWeather(bot, chatId, messageId, "서울");
        break;
      case "busan":
        await this.showCurrentWeather(bot, chatId, messageId, "부산");
        break;
      case "more":
        if (params[0] === "cities") {
          await this.showMoreCities(bot, chatId, messageId);
        }
        break;
      default:
        // 동적 도시 처리 (weather_incheon, weather_gwangju 등)
        await this.showCurrentWeather(bot, chatId, messageId, subAction);
    }
  }

  async handleWeatherCommand(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    // 도시 추출
    let city = "화성"; // 기본값
    if (text) {
      const cityMatch = text.match(/(?:weather|날씨)\s*(.+)/i);
      if (cityMatch && cityMatch[1]) {
        const inputCity = cityMatch[1].trim();
        city = this.weatherService.validateCity(inputCity) || city;
      }
    }

    if (text === "/weather" || text === "/날씨") {
      await this.showCurrentWeather(bot, chatId, null, city);
    } else if (text.includes("예보")) {
      await this.showWeatherForecast(bot, chatId, null, city);
    } else {
      await this.showWeatherHelp(bot, chatId);
    }
  }

  // menuManager 의존성 제거한 showWeatherMenu
  async showWeatherMenu(bot, chatId, messageId, userName) {
    const menuText = this.getWeatherMenuText(userName);
    const keyboard = this.createWeatherMenuKeyboard();

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 직접 메뉴 텍스트 생성
  getWeatherMenuText(userName) {
    return (
      `🌤️ **날씨 정보**\n\n` +
      `안녕하세요 ${userName}님! 👋\n\n` +
      `🏡 **화성/동탄 중심의 날씨 서비스**\n` +
      `• 실시간 날씨 정보\n` +
      `• 시간별 날씨 예보\n` +
      `• 전국 주요 도시 날씨\n\n` +
      `원하는 기능을 선택해주세요:`
    );
  }

  // 직접 키보드 생성
  createWeatherMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🏡 화성 날씨", callback_data: "weather_current" },
          { text: "📅 날씨 예보", callback_data: "weather_forecast" },
        ],
        [
          { text: "🌆 서울", callback_data: "weather_seoul" },
          { text: "🌊 부산", callback_data: "weather_busan" },
        ],
        [{ text: "🏙️ 더 많은 도시", callback_data: "weather_more_cities" }],
        [
          { text: "❓ 날씨 도움말", callback_data: "weather_help" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  async showCurrentWeather(bot, chatId, messageId, city = "화성") {
    try {
      const weatherData = await this.weatherService.getCurrentWeather(city);
      const weatherMessage =
        this.weatherService.formatWeatherMessage(weatherData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏙️ 다른 도시", callback_data: "weather_more_cities" },
            { text: "⏰ 시간별 예보", callback_data: `weather_forecast` },
          ],
          [
            { text: "🔄 새로고침", callback_data: `weather_${city}` },
            { text: "🔙 날씨 메뉴", callback_data: "weather_menu" },
          ],
        ],
      };

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, weatherMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, weatherMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      const errorMessage = `❌ ${city} 날씨 정보를 가져올 수 없습니다.\n\n${error.message}`;

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, errorMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
            ],
          },
        });
      } else {
        await this.sendMessage(bot, chatId, errorMessage);
      }
    }
  }

  async showWeatherForecast(bot, chatId, messageId, city = "화성") {
    try {
      const forecastData = await this.weatherService.getWeatherForecast(city);
      const forecastMessage = this.weatherService.formatForecastMessage(
        forecastData,
        city
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌤️ 현재 날씨", callback_data: `weather_current` },
            { text: "🏙️ 다른 도시", callback_data: "weather_more_cities" },
          ],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
        ],
      };

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, forecastMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, forecastMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      const errorMessage = `❌ ${city} 날씨 예보를 가져올 수 없습니다.\n\n${error.message}`;

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, errorMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
            ],
          },
        });
      } else {
        await this.sendMessage(bot, chatId, errorMessage);
      }
    }
  }

  async showMoreCities(bot, chatId, messageId) {
    const moreCitiesKeyboard = {
      inline_keyboard: [
        [
          { text: "🌆 인천", callback_data: "weather_인천" },
          { text: "🌄 광주", callback_data: "weather_광주" },
        ],
        [
          { text: "🏛️ 대전", callback_data: "weather_대전" },
          { text: "🏝️ 제주", callback_data: "weather_제주" },
        ],
        [
          { text: "🌄 수원", callback_data: "weather_수원" },
          { text: "🌊 울산", callback_data: "weather_울산" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
      ],
    };

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "🌍 **더 많은 지역**\n\n원하는 지역을 선택해주세요:",
      {
        parse_mode: "Markdown",
        reply_markup: moreCitiesKeyboard,
      }
    );
  }

  async showWeatherHelp(bot, chatId, messageId = null) {
    const helpText =
      `🌤️ **날씨 정보 도움말**\n\n` +
      `**사용법:**\n` +
      `• /weather 또는 /날씨 - 화성 날씨 (기본!) 🏡\n` +
      `• /weather 서울 - 서울 날씨\n` +
      `• /날씨 예보 - 시간별 예보\n\n` +
      `**지원 도시:**\n` +
      `🏡 화성(동탄), 서울, 부산, 인천, 광주, 대전, 울산, 제주, 수원 등\n\n` +
      `**제공 정보:**\n` +
      `• 현재 온도 및 체감온도\n` +
      `• 습도, 바람, 대기질\n` +
      `• 날씨에 맞는 옷차림 추천\n` +
      `• 시간별 날씨 예보\n\n` +
      `🏡 **화성/동탄 지역이 기본으로 설정되어 있어요!**`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  // 도움말 메시지 생성 (ModuleManager용)
  getHelpMessage() {
    return (
      `🌤️ **날씨 모듈**\n` +
      `• /weather - 화성 날씨\n` +
      `• /weather [도시명] - 특정 도시 날씨\n` +
      `• /날씨 예보 - 시간별 예보`
    );
  }

  // 명령어 처리 가능 여부 확인
  canHandleCommand(command) {
    const commands = ["weather", "날씨"];
    return commands.includes(command);
  }

  // 콜백 처리 가능 여부 확인
  canHandleCallback(callbackData) {
    return callbackData.startsWith("weather_");
  }
}

module.exports = WeatherModule;
