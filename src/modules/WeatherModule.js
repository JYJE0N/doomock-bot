// src/modules/WeatherModule.js - 표준화된 날씨 모듈

const BaseModule = require("./BaseModule");
const { WeatherService } = require("../services/WeatherService");
const { getUserName } = require("../utils/UserHelper");
const { TimeHelper } = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

class WeatherModule extends BaseModule {
  constructor(bot, dependencies) {
    super("WeatherModule", {
      commands: ["weather", "날씨"],
      callbacks: ["weather"],
      features: ["current", "forecast", "cities", "quick"],
    });

    this.weatherService = null;

    // 도시 목록
    this.cities = {
      seoul: { name: "서울", emoji: "🏙️" },
      busan: { name: "부산", emoji: "🌊" },
      daegu: { name: "대구", emoji: "🏛️" },
      incheon: { name: "인천", emoji: "✈️" },
      gwangju: { name: "광주", emoji: "🌻" },
      daejeon: { name: "대전", emoji: "🚄" },
      ulsan: { name: "울산", emoji: "🏭" },
      jeju: { name: "제주", emoji: "🏝️" },
    };

    // 날씨 이모지 매핑
    this.weatherEmojis = {
      맑음: "☀️",
      구름조금: "🌤️",
      구름많음: "⛅",
      흐림: "☁️",
      비: "🌧️",
      눈: "🌨️",
      천둥번개: "⛈️",
      안개: "🌫️",
    };
  }

  // 🎯 모듈별 초기화
  async onInitialize() {
    try {
      this.weatherService = new WeatherService();
      await this.weatherService.initialize();
      logger.info("🌤️ WeatherService 초기화 성공");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      logger.warn("🌤️ 기본 날씨 데이터로 서비스 제공");
    }
  }

  // 🎯 액션 등록
  registerActions() {
    this.actionMap.set("current", this.showCurrentWeather);
    this.actionMap.set("forecast", this.showForecast);
    this.actionMap.set("quick", this.showQuickWeather);
    this.actionMap.set("cities", this.showCityList);
    this.actionMap.set("help", this.showWeatherHelp);

    // 도시별 액션 동적 등록
    Object.keys(this.cities).forEach((cityKey) => {
      this.actionMap.set(`city_${cityKey}`, (bot, query) =>
        this.showCityWeather(bot, query, cityKey)
      );
    });
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 사용자 상태에 따른 처리
    if (userState?.action === "waiting_city_input") {
      return await this.handleCityInput(bot, chatId, userId, text);
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "weather" || command === "날씨") {
      await this.showMenu(bot, chatId, null, userId);
      return true;
    }

    return false;
  }

  // 📋 날씨 메뉴
  async showMenu(bot, chatId, messageId, userId) {
    const userName = getUserName({ id: userId });
    const currentTime = TimeHelper.getCurrentTime();

    const menuText =
      `🌤️ **날씨 정보**\n\n` +
      `${userName}님, 실시간 날씨 정보입니다.\n` +
      `현재 시각: ${currentTime}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📍 현재 날씨", callback_data: "weather:current" },
          { text: "📅 일기예보", callback_data: "weather:forecast" },
        ],
        [
          { text: "⚡ 빠른 날씨", callback_data: "weather:quick" },
          { text: "🏙️ 도시별", callback_data: "weather:cities" },
        ],
        [{ text: "❓ 도움말", callback_data: "weather:help" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        reply_markup: keyboard,
      });
    }

    return true;
  }

  // 📍 현재 날씨
  async showCurrentWeather(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 기본 도시는 서울
      const weatherData = await this.getWeatherData("서울");
      const weatherText = this.formatCurrentWeather(weatherData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "weather:current" },
            { text: "📅 일기예보", callback_data: "weather:forecast" },
          ],
          [{ text: "🏙️ 다른 도시", callback_data: "weather:cities" }],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, weatherText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("현재 날씨 조회 실패:", error);
      await this.sendError(bot, chatId, "날씨 정보를 가져올 수 없습니다.");
      return true;
    }
  }

  // 📅 일기예보
  async showForecast(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const forecastData = await this.getForecastData("서울");
      const forecastText = this.formatForecast(forecastData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📍 현재 날씨", callback_data: "weather:current" },
            { text: "🔄 새로고침", callback_data: "weather:forecast" },
          ],
          [{ text: "🏙️ 다른 도시", callback_data: "weather:cities" }],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, forecastText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("일기예보 조회 실패:", error);
      await this.sendError(bot, chatId, "일기예보를 가져올 수 없습니다.");
      return true;
    }
  }

  // ⚡ 빠른 날씨 (한 줄 요약)
  async showQuickWeather(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const weatherData = await this.getWeatherData("서울");
      const quickText =
        `⚡ **빠른 날씨 정보**\n\n` +
        `${this.getWeatherEmoji(weatherData.description)} 서울: ` +
        `${weatherData.temperature}°C, ${weatherData.description}\n` +
        `💧 습도: ${weatherData.humidity}% | 💨 풍속: ${weatherData.windSpeed}m/s`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📍 자세히 보기", callback_data: "weather:current" },
            { text: "📅 일기예보", callback_data: "weather:forecast" },
          ],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, quickText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("빠른 날씨 조회 실패:", error);
      await this.sendError(bot, chatId, "날씨 정보를 가져올 수 없습니다.");
      return true;
    }
  }

  // 🏙️ 도시 목록
  async showCityList(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const cityText = `🏙️ **도시별 날씨**\n\n` + `원하는 도시를 선택하세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏙️ 서울", callback_data: "weather:city_seoul" },
          { text: "🌊 부산", callback_data: "weather:city_busan" },
        ],
        [
          { text: "🏛️ 대구", callback_data: "weather:city_daegu" },
          { text: "✈️ 인천", callback_data: "weather:city_incheon" },
        ],
        [
          { text: "🌻 광주", callback_data: "weather:city_gwangju" },
          { text: "🚄 대전", callback_data: "weather:city_daejeon" },
        ],
        [
          { text: "🏭 울산", callback_data: "weather:city_ulsan" },
          { text: "🏝️ 제주", callback_data: "weather:city_jeju" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, cityText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🏙️ 도시별 날씨
  async showCityWeather(bot, callbackQuery, cityKey) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const city = this.cities[cityKey];
    if (!city) {
      await this.sendError(bot, chatId, "알 수 없는 도시입니다.");
      return true;
    }

    try {
      const weatherData = await this.getWeatherData(city.name);
      const weatherText = this.formatCurrentWeather(weatherData, city);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: `weather:city_${cityKey}` },
            { text: "📅 일기예보", callback_data: "weather:forecast" },
          ],
          [{ text: "🏙️ 다른 도시", callback_data: "weather:cities" }],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, weatherText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error(`${city.name} 날씨 조회 실패:`, error);
      await this.sendError(bot, chatId, "날씨 정보를 가져올 수 없습니다.");
      return true;
    }
  }

  // ❓ 도움말
  async showWeatherHelp(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText =
      `❓ **날씨 도움말**\n\n` +
      `🌤️ **제공 기능:**\n` +
      `• 실시간 날씨 정보\n` +
      `• 3일 일기예보\n` +
      `• 주요 도시별 날씨\n` +
      `• 빠른 날씨 요약\n\n` +
      `💡 **사용 방법:**\n` +
      `/weather - 날씨 메뉴 열기\n` +
      `/날씨 - 날씨 메뉴 열기\n\n` +
      `📊 **제공 정보:**\n` +
      `• 기온, 체감온도\n` +
      `• 습도, 풍속\n` +
      `• 날씨 상태\n` +
      `• 미세먼지 정보 (예정)`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🛠️ 데이터 처리 메서드
  async getWeatherData(cityName) {
    try {
      if (this.weatherService) {
        return await this.weatherService.getCurrentWeather(cityName);
      }
      return this.getFallbackWeatherData(cityName);
    } catch (error) {
      logger.warn("WeatherService 호출 실패, 기본값 사용");
      return this.getFallbackWeatherData(cityName);
    }
  }

  async getForecastData(cityName) {
    try {
      if (this.weatherService) {
        return await this.weatherService.getForecast(cityName);
      }
      return this.getFallbackForecastData(cityName);
    } catch (error) {
      logger.warn("WeatherService 예보 호출 실패, 기본값 사용");
      return this.getFallbackForecastData(cityName);
    }
  }

  // 기본 날씨 데이터
  getFallbackWeatherData(cityName) {
    const defaults = {
      서울: { temp: 16, desc: "맑음", humidity: 60, wind: 1.8 },
      부산: { temp: 18, desc: "흐림", humidity: 70, wind: 3.2 },
      대구: { temp: 17, desc: "맑음", humidity: 55, wind: 2.5 },
      인천: { temp: 14, desc: "구름조금", humidity: 62, wind: 3.0 },
      광주: { temp: 19, desc: "맑음", humidity: 58, wind: 2.2 },
      대전: { temp: 15, desc: "구름많음", humidity: 65, wind: 1.9 },
      울산: { temp: 18, desc: "맑음", humidity: 63, wind: 2.8 },
      제주: { temp: 20, desc: "구름조금", humidity: 72, wind: 4.1 },
    };

    const data = defaults[cityName] || defaults["서울"];

    return {
      city: cityName,
      temperature: data.temp,
      description: data.desc,
      humidity: data.humidity,
      windSpeed: data.wind,
      feelsLike: data.temp - 2,
      timestamp: TimeHelper.getCurrentTime(),
    };
  }

  // 기본 예보 데이터
  getFallbackForecastData(cityName) {
    return {
      city: cityName,
      forecast: [
        { day: "오늘", description: "맑음", high: 18, low: 10 },
        { day: "내일", description: "구름조금", high: 20, low: 12 },
        { day: "모레", description: "흐림", high: 17, low: 11 },
      ],
      timestamp: TimeHelper.getCurrentTime(),
    };
  }

  // 날씨 이모지 가져오기
  getWeatherEmoji(description) {
    return this.weatherEmojis[description] || "🌈";
  }

  // 현재 날씨 포맷팅
  formatCurrentWeather(data, city = null) {
    const emoji = this.getWeatherEmoji(data.description);
    const cityInfo = city || { name: data.city, emoji: "📍" };

    return (
      `${cityInfo.emoji} **${cityInfo.name} 날씨**\n\n` +
      `${emoji} ${data.description}\n` +
      `🌡️ 기온: ${data.temperature}°C\n` +
      `🤒 체감: ${data.feelsLike}°C\n` +
      `💧 습도: ${data.humidity}%\n` +
      `💨 풍속: ${data.windSpeed}m/s\n\n` +
      `⏰ ${data.timestamp || TimeHelper.getCurrentTime()}`
    );
  }

  // 예보 포맷팅
  formatForecast(data) {
    let text = `📅 **${data.city} 일기예보**\n\n`;

    data.forecast.forEach((day) => {
      const emoji = this.getWeatherEmoji(day.description);
      text += `**${day.day}**\n`;
      text += `${emoji} ${day.description}\n`;
      text += `🌡️ 최고 ${day.high}°C / 최저 ${day.low}°C\n\n`;
    });

    text += `⏰ ${data.timestamp || TimeHelper.getCurrentTime()}`;
    return text;
  }
}

module.exports = WeatherModule;
