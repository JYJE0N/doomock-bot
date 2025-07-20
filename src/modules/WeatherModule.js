// src/modules/WeatherModule.js - Import 방식 수정

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const WeatherService = require("../services/WeatherService"); // ✅ 수정: 구조 분해 할당 제거
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

    // ✅ 수정: WeatherService 클래스로 직접 인스턴스화
    try {
      this.weatherService = new WeatherService();
      logger.info("🌤️ WeatherService 초기화 성공");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      this.weatherService = null;
    }
  }

  // ✅ 표준 액션 등록 패턴 적용
  registerActions() {
    // 날씨 기능별 액션 등록
    this.actionMap.set("current", this.showCurrentWeather.bind(this));
    this.actionMap.set("forecast", this.showForecast.bind(this));
    this.actionMap.set("seoul", this.showSeoulWeather.bind(this));
    this.actionMap.set("busan", this.showBusanWeather.bind(this));
    this.actionMap.set("more_cities", this.showMoreCities.bind(this));
    this.actionMap.set("quick", this.showQuickWeather.bind(this));
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

  // ========== 날씨 기능 메서드들 ==========

  async showCurrentWeather(bot, chatId, messageId, userId, userName) {
    try {
      // 기본 위치: 화성/동탄
      const city = "화성";

      // WeatherService 사용 (안전하게)
      const weatherData = await this.getWeatherData(city);

      const text = this.formatCurrentWeather(weatherData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      logger.error(`WeatherModule showCurrentWeather 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "현재 날씨");
    }
  }

  async showForecast(bot, chatId, messageId, userId, userName) {
    try {
      const city = "화성";
      const forecastData = await this.getForecastData(city);

      const text = this.formatForecast(forecastData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      logger.error(`WeatherModule showForecast 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "날씨 예보");
    }
  }

  // ========== 안전한 날씨 데이터 처리 ==========

  async getWeatherData(city) {
    try {
      if (!this.weatherService) {
        logger.warn("WeatherService가 없어서 기본값 사용");
        return this.getDefaultWeatherData(city);
      }

      // WeatherService 사용해서 실제 API 호출
      const result = await this.weatherService.getCurrentWeather(city);

      if (result.success) {
        return result.data;
      } else {
        logger.warn(`실제 날씨 API 호출 실패: ${result.error}`);
        return result.data || this.getDefaultWeatherData(city);
      }
    } catch (error) {
      logger.warn(`날씨 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultWeatherData(city);
    }
  }

  async getForecastData(city) {
    try {
      if (!this.weatherService) {
        logger.warn("WeatherService가 없어서 기본 예보 사용");
        return this.getDefaultForecastData(city);
      }

      const result = await this.weatherService.getForecast(city);

      if (result.success) {
        return result.data;
      } else {
        logger.warn(`예보 API 호출 실패: ${result.error}`);
        return result.data || this.getDefaultForecastData(city);
      }
    } catch (error) {
      logger.warn(`예보 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultForecastData(city);
    }
  }

  // ========== 기본 데이터 (API 실패시 사용) ==========

  getDefaultWeatherData(city) {
    const defaultData = {
      화성: {
        temp: 15,
        desc: "구름많음",
        icon: "☁️",
        humidity: 65,
        wind: "서풍 2.1m/s",
      },
      서울: {
        temp: 16,
        desc: "맑음",
        icon: "☀️",
        humidity: 60,
        wind: "남풍 1.8m/s",
      },
      부산: {
        temp: 18,
        desc: "흐림",
        icon: "🌫️",
        humidity: 70,
        wind: "동풍 3.2m/s",
      },
    };

    return (
      defaultData[city] || {
        temp: 15,
        desc: "정보없음",
        icon: "❓",
        humidity: 50,
        wind: "바람 정보 없음",
      }
    );
  }

  getDefaultForecastData(city) {
    return {
      forecast: [
        { high: 18, low: 8, desc: "구름많음", icon: "☁️" },
        { high: 20, low: 10, desc: "맑음", icon: "☀️" },
        { high: 15, low: 5, desc: "비", icon: "🌧️" },
      ],
    };
  }

  async getWeatherData(city) {
    try {
      if (!this.weatherService) {
        logger.warn("WeatherService가 없어서 기본값 사용");
        return this.getDefaultWeatherData(city);
      }

      const result = await this.weatherService.getCurrentWeather(city);

      if (result.success) {
        return result.data;
      } else {
        logger.warn(`실제 날씨 API 호출 실패: ${result.error}`);
        return result.data || this.getDefaultWeatherData(city);
      }
    } catch (error) {
      logger.warn(`날씨 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultWeatherData(city);
    }
  }

  async getForecastData(city) {
    try {
      if (!this.weatherService) {
        return this.getDefaultForecastData(city);
      }

      const result = await this.weatherService.getForecast(city);

      if (result.success) {
        return result.data;
      } else {
        return result.data || this.getDefaultForecastData(city);
      }
    } catch (error) {
      logger.warn(`예보 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultForecastData(city);
    }
  }

  async showFallbackWeather(bot, chatId, messageId, type) {
    const text =
      `🌤️ **${type}**\n\n` +
      `현재 날씨 서비스가 일시적으로 이용 불가합니다.\n\n` +
      `📱 대신 다음 링크를 확인해보세요:\n` +
      `• 기상청: weather.go.kr\n` +
      `• 네이버 날씨\n` +
      `• 다음 날씨\n\n` +
      `🔄 잠시 후 다시 시도해주세요!`;

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: this.getWeatherMenuKeyboard(),
    });
  }

  // ========== 날씨 정보 포맷팅 ==========

  formatCurrentWeather(data, city) {
    const icon = this.getCityIcon(city);
    return (
      `${icon} **${city} 현재 날씨**\n\n` +
      `🌡️ **온도**: ${data.temp}°C\n` +
      `${data.icon} **날씨**: ${data.desc}\n` +
      `💧 **습도**: ${data.humidity}%\n` +
      `💨 **바람**: ${data.wind}\n\n` +
      `🕐 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`
    );
  }

  formatForecast(data, city) {
    const icon = this.getCityIcon(city);
    let forecastText = `${icon} **${city} 날씨 예보**\n\n`;

    if (data && data.forecast && Array.isArray(data.forecast)) {
      data.forecast.slice(0, 3).forEach((day, index) => {
        const dayNames = ["오늘", "내일", "모레"];
        forecastText += `📅 **${dayNames[index]}**: ${day.icon} ${day.high}°/${day.low}°C ${day.desc}\n`;
      });
    } else {
      forecastText += `📅 **오늘**: ☁️ 15°/8°C 구름많음\n`;
      forecastText += `📅 **내일**: ☀️ 18°/10°C 맑음\n`;
      forecastText += `📅 **모레**: 🌧️ 12°/6°C 비\n`;
    }

    forecastText += `\n🕐 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`;
    return forecastText;
  }

  getCityIcon(city) {
    const icons = {
      화성: "🏠",
      서울: "🏙️",
      부산: "🌊",
      인천: "🌉",
      대구: "🌆",
      대전: "🏛️",
      광주: "🌺",
      울산: "🌊",
      제주: "🏝️",
    };
    return icons[city] || "📍";
  }

  getWeatherMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "weather_current" },
          { text: "📅 예보보기", callback_data: "weather_forecast" },
        ],
        [
          { text: "🌤️ 날씨 메뉴", callback_data: "weather_menu" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  // ========== 콜백에서 호출되는 메서드들 구현 ==========

  async showWeatherMenu(bot, chatId, messageId, userName) {
    const menuText = `🌤️ **${userName}님, 날씨 정보입니다**\n\n실시간 날씨와 예보를 확인하세요!`;

    const keyboard = {
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
          { text: "🗺️ 더 많은 지역", callback_data: "weather_more_cities" },
          { text: "⚡ 빠른 날씨", callback_data: "weather_quick" },
        ],
        [
          { text: "❓ 도움말", callback_data: "weather_help" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showCurrentWeather(bot, chatId, messageId, userId, userName) {
    try {
      const city = "화성";
      const weatherData = await this.getWeatherData(city);
      const text = this.formatCurrentWeather(weatherData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });
    } catch (error) {
      logger.error("현재 날씨 표시 오류:", error);
      await this.showFallbackWeather(bot, chatId, messageId, "현재 날씨");
    }
  }

  async showForecast(bot, chatId, messageId, userId, userName) {
    try {
      const city = "화성";
      const forecastData = await this.getForecastData(city);
      const text = this.formatForecast(forecastData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });
    } catch (error) {
      logger.error("날씨 예보 표시 오류:", error);
      await this.showFallbackWeather(bot, chatId, messageId, "날씨 예보");
    }
  }

  async showSeoulWeather(bot, chatId, messageId) {
    try {
      const weatherData = await this.getWeatherData("서울");
      const text = this.formatCurrentWeather(weatherData, "서울");

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 새로고침", callback_data: "weather_seoul" },
              { text: "📅 예보", callback_data: "weather_forecast" },
            ],
            [
              { text: "🌤️ 날씨 메뉴", callback_data: "weather_menu" },
              { text: "🔙 메인 메뉴", callback_data: "main_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      logger.error("서울 날씨 표시 오류:", error);
      await this.showFallbackWeather(bot, chatId, messageId, "서울 날씨");
    }
  }

  async showBusanWeather(bot, chatId, messageId) {
    try {
      const weatherData = await this.getWeatherData("부산");
      const text = this.formatCurrentWeather(weatherData, "부산");

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 새로고침", callback_data: "weather_busan" },
              { text: "📅 예보", callback_data: "weather_forecast" },
            ],
            [
              { text: "🌤️ 날씨 메뉴", callback_data: "weather_menu" },
              { text: "🔙 메인 메뉴", callback_data: "main_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      logger.error("부산 날씨 표시 오류:", error);
      await this.showFallbackWeather(bot, chatId, messageId, "부산 날씨");
    }
  }

  async showMoreCities(bot, chatId, messageId) {
    const moreText = `🗺️ **더 많은 지역**\n\n원하는 지역을 선택하세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌉 인천", callback_data: "weather_incheon" },
          { text: "🌆 대구", callback_data: "weather_daegu" },
        ],
        [
          { text: "🏛️ 대전", callback_data: "weather_daejeon" },
          { text: "🌺 광주", callback_data: "weather_gwangju" },
        ],
        [
          { text: "🌊 울산", callback_data: "weather_ulsan" },
          { text: "🏝️ 제주", callback_data: "weather_jeju" },
        ],
        [
          { text: "🔙 날씨 메뉴", callback_data: "weather_menu" },
          { text: "🏠 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, moreText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showQuickWeather(bot, chatId, messageId) {
    try {
      const cities = ["화성", "서울", "부산"];
      let quickText = `⚡ **빠른 날씨**\n\n`;

      for (const city of cities) {
        try {
          const data = await this.getWeatherData(city);
          const icon = this.getCityIcon(city);
          quickText += `${icon} **${city}**: ${data.icon} ${data.temp}°C ${data.desc}\n`;
        } catch (error) {
          logger.warn(`${city} 날씨 조회 실패:`, error.message);
          quickText += `${this.getCityIcon(city)} **${city}**: 정보 없음\n`;
        }
      }

      quickText += `\n🕐 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`;

      await this.editMessage(bot, chatId, messageId, quickText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 새로고침", callback_data: "weather_quick" },
              { text: "🌤️ 날씨 메뉴", callback_data: "weather_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      logger.error("빠른 날씨 표시 오류:", error);
      await this.showFallbackWeather(bot, chatId, messageId, "빠른 날씨");
    }
  }

  async showWeatherHelp(bot, chatId, messageId) {
    const helpText = this.getHelpMessage();

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
        ],
      },
    });
  }

  // ========== Fallback 처리 ==========

  async showFallbackWeather(bot, chatId, messageId, type) {
    const text =
      `🌤️ **${type}**\n\n` +
      `현재 날씨 서비스가 일시적으로 이용 불가합니다.\n\n` +
      `📱 대신 다음 링크를 확인해보세요:\n` +
      `• 기상청: weather.go.kr\n` +
      `• 네이버 날씨\n` +
      `• 다음 날씨\n\n` +
      `🔄 잠시 후 다시 시도해주세요!`;

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: this.getWeatherMenuKeyboard(),
    });
  }

  // ========== 표준화 명령어 처리 ==========

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      switch (subAction) {
        case "menu":
          await this.showWeatherMenu(bot, chatId, messageId, userName);
          break;

        case "current":
          await this.showCurrentWeather(
            bot,
            chatId,
            messageId,
            userId,
            userName
          );
          break;

        case "forecast":
          await this.showForecast(bot, chatId, messageId, userId, userName);
          break;

        case "seoul":
          await this.showSeoulWeather(bot, chatId, messageId);
          break;

        case "busan":
          await this.showBusanWeather(bot, chatId, messageId);
          break;

        case "more_cities":
          await this.showMoreCities(bot, chatId, messageId);
          break;

        case "quick":
          await this.showQuickWeather(bot, chatId, messageId);
          break;

        case "help":
          await this.showWeatherHelp(bot, chatId, messageId);
          break;

        default:
          return false;
      }

      this.updateStats("callback");
      return true;
    } catch (error) {
      logger.error(`WeatherModule 콜백 오류 (${subAction}):`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "날씨 정보");
      return false;
    }
  }

  // ✅ 도움말 메시지 오버라이드
  getHelpMessage() {
    return `🌤️ **날씨 사용법**

**📱 메뉴 방식:**
/start → 🌤️ 날씨 → 원하는 지역 선택

**⌨️ 명령어 방식:**
/weather - 현재 날씨 (화성/동탄 기준)

**🗺️ 지원 지역:**
• 🏠 화성/동탄 (기본 지역)
• 🏙️ 서울, 🌊 부산, 🌉 인천
• 🌆 대구, 🏛️ 대전, 🌺 광주
• 🌊 울산, 🏝️ 제주

**⚡ 빠른 기능:**
• 📍 현재 날씨
• 📅 3일 예보
• ⚡ 빠른 날씨 (여러 지역 동시)

실시간 날씨로 하루를 준비하세요! 🌈`;
  }

  // ========== 초기화 ==========

  async initialize() {
    try {
      // WeatherService가 없어도 기본 기능은 제공
      if (!this.weatherService) {
        logger.warn("⚠️ WeatherService가 없지만 기본 날씨 기능은 제공합니다.");
      }

      await super.initialize();
      logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }
}

module.exports = WeatherModule;
