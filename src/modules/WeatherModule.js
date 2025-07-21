// src/modules/WeatherModule.js - 완전 리팩토링 (명확한 메서드명)

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { getInstance } = require("../database/DatabaseManager");
const dbManager = getInstance();
const { TimeHelper } = require("../utils/TimeHelper");
// ✅ WeatherService를 모듈로 가져오기
const { WeatherService } = require("../services/WeatherService");
const logger = require("../utils/Logger");

class WeatherModule extends BaseModule {
  constructor() {
    super("WeatherModule", {
      commands: ["weather"],
      callbacks: ["weather"],
      features: [
        "current",
        "forecast",
        "seoul",
        "busan",
        "more_cities",
        "quick",
      ],
    });

    // ✅ WeatherService 초기화
    try {
      this.weatherService = new WeatherService();
      logger.info("🌤️ WeatherService 초기화 성공");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      this.weatherService = null;
    }
  }

  // 🔧 모듈별 초기화
  async onInitialize() {
    try {
      if (!this.weatherService) {
        logger.warn("⚠️ WeatherService가 없지만 기본 날씨 기능은 제공합니다.");
      }

      logger.success("🌤️ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      logger.warn("🌤️ WeatherModule 기본 모드로 계속 진행");
    }
  }

  // ✅ 표준 액션 등록
  registerActions() {
    super.registerActions(); // BaseModule 기본 액션 유지

    // 날씨 기능별 액션 등록
    this.actionMap.set("current", this.showCurrentWeather.bind(this));
    this.actionMap.set("forecast", this.showForecast.bind(this));
    this.actionMap.set("seoul", this.showSeoulWeather.bind(this));
    this.actionMap.set("busan", this.showBusanWeather.bind(this));
    this.actionMap.set("more_cities", this.showMoreCities.bind(this));
    this.actionMap.set("quick", this.showQuickWeather.bind(this));

    logger.debug(`🎯 WeatherModule 액션 등록 완료: ${this.actionMap.size}개`);
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    return {
      text: `🌤️ **${userName}님, 날씨 정보입니다**\n\n실시간 날씨와 예보를 확인하세요!`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📍 현재 날씨", callback_data: "weather_current" },
            { text: "📅 날씨 예보", callback_data: "weather_forecast" },
          ],
          [
            { text: "🏙️ 서울", callback_data: "weather_seoul" },
            { text: "🌊 부산", callback_data: "weather_busan" },
          ],
          [
            { text: "🗺️ 더 많은 도시", callback_data: "weather_more_cities" },
            { text: "⚡ 빠른 날씨", callback_data: "weather_quick" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ========== 날씨 액션 메서드들 (새로운 메서드명 사용) ==========

  async showCurrentWeather(bot, chatId, messageId, userId, userName) {
    try {
      const city = "서울";
      const weatherData = await this.fetchCurrentWeatherSafely(city);
      const text = this.buildCurrentWeatherText(weatherData, city);
      const keyboard = this.createWeatherMenuKeyboard();

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 현재 날씨 표시 완료`);
    } catch (error) {
      logger.error("showCurrentWeather 오류:", error);
      await this.displayWeatherError(bot, chatId, messageId, "api_fail");
    }
  }

  async showForecast(bot, chatId, messageId, userId, userName) {
    try {
      const city = "서울";
      const forecastData = await this.fetchForecastSafely(city);
      const text = this.buildForecastText(forecastData, city);
      const keyboard = this.createWeatherMenuKeyboard();

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 날씨 예보 표시 완료`);
    } catch (error) {
      logger.error("showForecast 오류:", error);
      await this.displayWeatherError(bot, chatId, messageId, "api_fail");
    }
  }

  async showSeoulWeather(bot, chatId, messageId, userId, userName) {
    try {
      const city = "서울";
      const weatherData = await this.fetchCurrentWeatherSafely(city);
      const text = this.buildCurrentWeatherText(weatherData, city);
      const keyboard = this.createCityWeatherKeyboard(city);

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 서울 날씨 표시 완료`);
    } catch (error) {
      logger.error("showSeoulWeather 오류:", error);
      await this.displayWeatherError(bot, chatId, messageId, "api_fail");
    }
  }

  async showBusanWeather(bot, chatId, messageId, userId, userName) {
    try {
      const city = "부산";
      const weatherData = await this.fetchCurrentWeatherSafely(city);
      const text = this.buildCurrentWeatherText(weatherData, city);
      const keyboard = this.createCityWeatherKeyboard(city);

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 부산 날씨 표시 완료`);
    } catch (error) {
      logger.error("showBusanWeather 오류:", error);
      await this.displayWeatherError(bot, chatId, messageId, "api_fail");
    }
  }

  async showMoreCities(bot, chatId, messageId, userId, userName) {
    try {
      const text = `🗺️ **더 많은 도시**\n\n원하는 도시를 메시지로 보내주세요.\n\n예: "대구", "인천", "광주"`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "waiting_city_input",
      });

      logger.debug(`✅ ${userName} 도시 선택 폼 표시 완료`);
    } catch (error) {
      logger.error("showMoreCities 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  async showQuickWeather(bot, chatId, messageId, userId, userName) {
    try {
      // 여러 도시의 간단한 날씨 정보를 한 번에 표시
      const cities = ["서울", "부산", "대구"];
      let quickText = `⚡ **빠른 날씨**\n\n`;

      for (const city of cities) {
        const weatherData = await this.fetchCurrentWeatherSafely(city);
        const emoji = this.getWeatherEmoji(weatherData.description);
        quickText += `${emoji} ${city}: ${weatherData.temperature}°C ${weatherData.description}\n`;
      }

      quickText += `\n⏰ ${TimeHelper.getLogTimeString()}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📍 상세 정보", callback_data: "weather_current" },
            { text: "🔙 날씨 메뉴", callback_data: "weather_menu" },
          ],
        ],
      };

      await this.editOrSendMessage(bot, chatId, messageId, quickText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug(`✅ ${userName} 빠른 날씨 표시 완료`);
    } catch (error) {
      logger.error("showQuickWeather 오류:", error);
      await this.handleError(bot, chatId, error, messageId);
    }
  }

  // ========== 날씨 데이터 가져오기 메서드들 ==========

  /**
   * WeatherService를 통해 현재 날씨 데이터 안전하게 가져오기
   */
  async fetchCurrentWeatherSafely(city) {
    try {
      if (!this.weatherService) {
        logger.warn(`WeatherService 없음, ${city} 기본 데이터 사용`);
        return this.createFallbackWeatherData(city);
      }

      const result = await this.weatherService.getCurrentWeather(city);

      if (result.success && this.validateWeatherData(result.data)) {
        logger.debug(`✅ ${city} 실제 날씨 데이터 가져옴`);
        return result.data;
      } else {
        logger.warn(`⚠️ ${city} API 호출 실패: ${result.error}`);
        return this.createFallbackWeatherData(city);
      }
    } catch (error) {
      logger.error(`❌ ${city} 날씨 데이터 가져오기 실패:`, error.message);
      return this.createFallbackWeatherData(city);
    }
  }

  /**
   * WeatherService를 통해 예보 데이터 안전하게 가져오기
   */
  async fetchForecastSafely(city) {
    try {
      if (!this.weatherService) {
        logger.warn(`WeatherService 없음, ${city} 기본 예보 사용`);
        return this.createFallbackForecastData(city);
      }

      const result = await this.weatherService.getForecast(city);

      if (result.success && this.validateForecastData(result.data)) {
        logger.debug(`✅ ${city} 실제 예보 데이터 가져옴`);
        return result.data;
      } else {
        logger.warn(`⚠️ ${city} 예보 API 호출 실패: ${result.error}`);
        return this.createFallbackForecastData(city);
      }
    } catch (error) {
      logger.error(`❌ ${city} 예보 데이터 가져오기 실패:`, error.message);
      return this.createFallbackForecastData(city);
    }
  }

  // ========== 텍스트 생성 메서드들 ==========

  /**
   * 날씨 API 데이터를 사용자에게 보여줄 형태로 변환
   */
  buildCurrentWeatherText(weatherData, city) {
    const emoji = this.getWeatherEmoji(weatherData.description);
    const windEmoji = weatherData.windSpeed > 5 ? "💨" : "🌬️";

    let text = `${emoji} **${city} 현재 날씨**\n\n`;
    text += `🌡️ **온도:** ${weatherData.temperature}°C\n`;
    text += `📝 **날씨:** ${weatherData.description}\n`;
    text += `💧 **습도:** ${weatherData.humidity}%\n`;
    text += `${windEmoji} **바람:** ${weatherData.windSpeed}m/s`;

    if (weatherData.windDirection) {
      text += ` (${weatherData.windDirection})`;
    }

    // timestamp가 이미 TimeHelper로 포맷된 경우
    if (weatherData.timestamp) {
      text += `\n\n⏰ ${weatherData.timestamp}`;
    } else {
      // timestamp가 없는 경우 현재 시간 사용
      text += `\n\n⏰ ${TimeHelper.getLogTimeString()}`;
    }

    if (weatherData.isFallback) {
      text += `\n\n⚠️ _기본 날씨 정보입니다_`;
    }

    return text;
  }

  /**
   * 예보 데이터를 사용자에게 보여줄 형태로 변환
   */
  buildForecastText(forecastData, city) {
    let text = `📅 **${city} 날씨 예보**\n\n`;

    forecastData.forecast.forEach((day, index) => {
      const dayLabel = index === 0 ? "오늘" : index === 1 ? "내일" : "모레";
      const emoji = this.getWeatherEmoji(day.description);
      text += `${dayLabel}: ${emoji} ${day.description || "맑음"} ${
        day.temperature || "25"
      }°C\n`;
    });

    // timestamp가 이미 포맷된 경우
    if (forecastData.timestamp) {
      text += `\n⏰ 업데이트: ${forecastData.timestamp}`;
    } else {
      // timestamp가 없는 경우 현재 시간 사용
      text += `\n⏰ 업데이트: ${TimeHelper.getLogTimeString()}`;
    }

    return text;
  }

  // ========== 기본 데이터 생성 메서드들 ==========

  /**
   * API 호출 실패 시 사용할 기본 날씨 데이터 생성
   */
  createFallbackWeatherData(city) {
    const cityDefaults = {
      서울: { temp: 16, desc: "맑음", humidity: 60, wind: 1.8 },
      부산: { temp: 18, desc: "흐림", humidity: 70, wind: 3.2 },
      대구: { temp: 17, desc: "맑음", humidity: 55, wind: 2.5 },
      인천: { temp: 14, desc: "구름조금", humidity: 62, wind: 3.0 },
      광주: { temp: 19, desc: "맑음", humidity: 58, wind: 2.2 },
      대전: { temp: 15, desc: "구름많음", humidity: 65, wind: 1.9 },
      울산: { temp: 18, desc: "맑음", humidity: 63, wind: 2.8 },
      제주: { temp: 20, desc: "구름조금", humidity: 72, wind: 4.1 },
    };

    const defaults = cityDefaults[city] || {
      temp: 20,
      desc: "정보없음",
      humidity: 50,
      wind: 2.0,
    };

    return {
      temperature: defaults.temp,
      description: defaults.desc,
      humidity: defaults.humidity,
      windSpeed: defaults.wind,
      city: city,
      isFallback: true,
    };
  }

  /**
   * API 호출 실패 시 사용할 기본 예보 데이터 생성
   */
  createFallbackForecastData(city) {
    return {
      city: city,
      forecast: [
        { description: "맑음", temperature: 25, icon: "☀️", day: "오늘" },
        { description: "구름조금", temperature: 23, icon: "🌤️", day: "내일" },
        { description: "흐림", temperature: 21, icon: "☁️", day: "모레" },
      ],
      isFallback: true,
    };
  }

  // ========== 데이터 검증 메서드들 ==========

  /**
   * WeatherService에서 받은 데이터가 유효한지 검증
   */
  validateWeatherData(data) {
    if (!data) return false;

    // 필수 필드 검증
    const requiredFields = ["temperature", "description"];
    return requiredFields.every((field) => data.hasOwnProperty(field));
  }

  /**
   * 예보 데이터가 유효한지 검증
   */
  validateForecastData(data) {
    if (!data || !Array.isArray(data.forecast)) return false;

    // 최소 1개 이상의 예보가 있어야 함
    return data.forecast.length > 0;
  }

  // ========== 키보드 생성 메서드들 ==========

  /**
   * 날씨 메뉴용 키보드 생성
   */
  createWeatherMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "weather_current" },
          { text: "📅 예보", callback_data: "weather_forecast" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
      ],
    };
  }

  /**
   * 도시별 날씨용 키보드 생성
   */
  createCityWeatherKeyboard(city) {
    return {
      inline_keyboard: [
        [
          {
            text: "🔄 새로고침",
            callback_data: `weather_${city === "서울" ? "seoul" : "busan"}`,
          },
          { text: "📅 예보", callback_data: "weather_forecast" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
      ],
    };
  }

  // ========== 에러 처리 메서드들 ==========

  /**
   * 날씨 서비스 오류 시 사용자에게 안내 메시지 표시
   */
  async displayWeatherError(bot, chatId, messageId, errorType) {
    const errorMessages = {
      api_fail:
        "🌤️ **날씨 서비스 일시 중단**\n\n실시간 날씨 데이터를 가져올 수 없습니다.",
      network: "🌐 **네트워크 오류**\n\n인터넷 연결을 확인해주세요.",
      invalid_city:
        "📍 **도시를 찾을 수 없음**\n\n정확한 도시명을 입력해주세요.",
      rate_limit: "⏱️ **요청 제한**\n\n잠시 후 다시 시도해주세요.",
    };

    const text = errorMessages[errorType] || errorMessages["api_fail"];

    const fallbackText =
      text +
      `\n\n📱 **대체 서비스:**\n` +
      `• 기상청: weather.go.kr\n` +
      `• 네이버 날씨\n` +
      `• 다음 날씨\n\n` +
      `🔄 잠시 후 다시 시도해주세요!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "weather_current" },
          { text: "🔙 날씨 메뉴", callback_data: "weather_menu" },
        ],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, fallbackText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ========== 헬퍼 메서드들 ==========

  /**
   * 날씨 설명에 맞는 이모지 반환
   */
  getWeatherEmoji(description) {
    const emojiMap = {
      맑음: "☀️",
      구름조금: "🌤️",
      구름많음: "⛅",
      흐림: "☁️",
      비: "🌧️",
      눈: "🌨️",
      안개: "🌫️",
      천둥번개: "⛈️",
    };

    // 키워드 기반 매칭
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      if (description && description.includes(keyword)) {
        return emoji;
      }
    }

    return "🌤️"; // 기본 이모지
  }

  // ========== 메시지 처리 (BaseModule onHandleMessage 구현) ==========

  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    if (userState && userState.action === "waiting_city_input") {
      return await this.handleCityInput(bot, chatId, userId, text);
    }

    // 날씨 명령어 처리
    if (text && text.startsWith("/weather")) {
      await this.handleWeatherCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleCityInput(bot, chatId, userId, cityName) {
    try {
      const userName = getUserName({ id: userId });

      // 도시명 검증
      if (!cityName || cityName.trim().length === 0) {
        await bot.sendMessage(chatId, "❌ 도시명을 입력해주세요.");
        this.clearUserState(userId);
        return true;
      }

      const cleanCityName = cityName.trim();

      // 새로운 메서드명으로 날씨 데이터 가져오기
      const weatherData = await this.fetchCurrentWeatherSafely(cleanCityName);

      if (
        weatherData.isFallback &&
        ![
          "서울",
          "부산",
          "대구",
          "인천",
          "광주",
          "대전",
          "울산",
          "제주",
        ].includes(cleanCityName)
      ) {
        // 지원하지 않는 도시인 경우
        await bot.sendMessage(
          chatId,
          `❓ "${cleanCityName}"의 정확한 날씨 정보를 찾을 수 없습니다.\n\n` +
            `🏙️ **지원 도시:** 서울, 부산, 대구, 인천, 광주, 대전, 울산, 제주\n\n` +
            `다른 도시명을 시도해보세요.`
        );
      } else {
        // 지원하는 도시이거나 실제 API 데이터인 경우
        const text = this.buildCurrentWeatherText(weatherData, cleanCityName);
        await bot.sendMessage(chatId, text, {
          parse_mode: "Markdown",
        });
      }

      this.clearUserState(userId);
      return true;
    } catch (error) {
      logger.error("handleCityInput 오류:", error);
      await bot.sendMessage(
        chatId,
        "❌ 날씨 정보 조회 중 오류가 발생했습니다."
      );
      this.clearUserState(userId);
      return true;
    }
  }

  async handleWeatherCommand(bot, msg) {
    try {
      const {
        chat: { id: chatId },
        from,
      } = msg;
      const userName = getUserName(from);

      // 기본: 날씨 메뉴 표시
      const menuData = this.getMenuData(userName);
      await bot.sendMessage(chatId, menuData.text, {
        parse_mode: "Markdown",
        reply_markup: menuData.keyboard,
      });

      logger.debug(`✅ ${userName} 날씨 명령어 처리 완료`);
    } catch (error) {
      logger.error("handleWeatherCommand 오류:", error);
      await bot.sendMessage(
        msg.chat.id,
        "❌ 날씨 명령어 처리 중 오류가 발생했습니다."
      );
    }
  }
}

module.exports = WeatherModule;
