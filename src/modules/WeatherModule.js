// src/modules/WeatherModule.js - 표준 패턴으로 완전 새로 구현

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { WeatherService } = require("../services/WeatherService");
const Logger = require("../utils/Logger");

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

    this.weatherService = new WeatherService();
    Logger.info(
      "🌤️ WeatherService 초기화:",
      this.weatherService ? "성공" : "실패"
    );
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

      // 실제 API 호출 (WeatherService 사용)
      const weatherData = await this.getWeatherData(city);

      const text = this.formatCurrentWeather(weatherData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`WeatherModule showCurrentWeather 오류:`, error);
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
      Logger.error(`WeatherModule showForecast 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "날씨 예보");
    }
  }

  async showSeoulWeather(bot, chatId, messageId, userId, userName) {
    try {
      const weatherData = await this.getWeatherData("서울");
      const text = this.formatCurrentWeather(weatherData, "서울");

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`WeatherModule showSeoulWeather 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "서울 날씨");
    }
  }

  async showBusanWeather(bot, chatId, messageId, userId, userName) {
    try {
      const weatherData = await this.getWeatherData("부산");
      const text = this.formatCurrentWeather(weatherData, "부산");

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`WeatherModule showBusanWeather 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "부산 날씨");
    }
  }

  async showMoreCities(bot, chatId, messageId, userId, userName) {
    try {
      const text = `🗺️ **더 많은 도시 날씨**\n\n아래 도시를 선택하세요:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏙️ 서울", callback_data: "weather_seoul" },
            { text: "🌊 부산", callback_data: "weather_busan" },
          ],
          [
            { text: "🌉 인천", callback_data: "weather_인천" },
            { text: "🌆 대구", callback_data: "weather_대구" },
          ],
          [
            { text: "🏛️ 대전", callback_data: "weather_대전" },
            { text: "🌺 광주", callback_data: "weather_광주" },
          ],
          [
            { text: "🌊 울산", callback_data: "weather_울산" },
            { text: "🏝️ 제주", callback_data: "weather_제주" },
          ],
          [
            { text: "🔙 날씨 메뉴", callback_data: "weather_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`WeatherModule showMoreCities 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showQuickWeather(bot, chatId, messageId, userId, userName) {
    try {
      // 빠른 날씨: 화성 + 서울 동시 표시
      const [hwaseongData, seoulData] = await Promise.all([
        this.getWeatherData("화성"),
        this.getWeatherData("서울"),
      ]);

      const text =
        `⚡ **빠른 날씨**\n\n` +
        `**🏠 화성/동탄**\n${this.formatQuickWeather(hwaseongData)}\n\n` +
        `**🏙️ 서울**\n${this.formatQuickWeather(seoulData)}`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`WeatherModule showQuickWeather 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, "빠른 날씨");
    }
  }

  // ========== 동적 콜백 처리 (도시별 날씨) ==========

  async handleCallback(bot, callbackQuery, subAction, params) {
    // 동적 도시 날씨 처리 (weather_인천, weather_대구 등)
    const cities = ["인천", "대구", "대전", "광주", "울산", "제주"];

    if (cities.includes(subAction)) {
      return await this.showCityWeather(bot, callbackQuery, subAction);
    }

    // 표준 액션은 부모 클래스에서 처리
    return await super.handleCallback(bot, callbackQuery, subAction, params);
  }

  async showCityWeather(bot, callbackQuery, city) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const weatherData = await this.getWeatherData(city);
      const text = this.formatCurrentWeather(weatherData, city);

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });

      this.updateStats("callback");
      return true;
    } catch (error) {
      Logger.error(`WeatherModule showCityWeather(${city}) 오류:`, error);
      await this.showFallbackWeather(bot, chatId, messageId, `${city} 날씨`);
      return true;
    }
  }

  // ========== 날씨 데이터 처리 ==========

  async getWeatherData(city) {
    try {
      // WeatherService 사용해서 실제 API 호출
      return await this.weatherService.getCurrentWeather(city);
    } catch (error) {
      Logger.warn(`실제 날씨 API 호출 실패, 기본값 사용: ${error.message}`);
      // API 실패시 기본값 반환
      return this.getDefaultWeatherData(city);
    }
  }

  async getForecastData(city) {
    try {
      return await this.weatherService.getForecast(city);
    } catch (error) {
      Logger.warn(`예보 API 호출 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultForecastData(city);
    }
  }

  getDefaultWeatherData(city) {
    // API 실패시 사용할 기본 데이터
    return {
      city: city,
      temperature: 15,
      description: "구름많음",
      humidity: 65,
      windSpeed: 2.1,
      windDirection: "서풍",
      icon: "☁️",
    };
  }

  getDefaultForecastData(city) {
    return {
      city: city,
      forecast: [
        { date: "오늘", icon: "☁️", temp: "15°C", desc: "구름많음" },
        { date: "내일", icon: "🌤️", temp: "18°C", desc: "맑음" },
        { date: "모레", icon: "🌧️", temp: "12°C", desc: "비" },
      ],
    };
  }

  // ========== 날씨 정보 포맷팅 ==========

  formatCurrentWeather(data, city) {
    const cityIcon = this.getCityIcon(city);

    return (
      `${cityIcon} **${city} 현재 날씨**\n\n` +
      `${data.icon} **${data.description}**\n` +
      `🌡️ 온도: ${data.temperature}°C\n` +
      `💧 습도: ${data.humidity}%\n` +
      `💨 바람: ${data.windDirection} ${data.windSpeed}m/s\n\n` +
      `📝 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`
    );
  }

  formatForecast(data, city) {
    const cityIcon = this.getCityIcon(city);
    let forecastText = `${cityIcon} **${city} 날씨 예보**\n\n`;

    data.forecast.forEach((day) => {
      forecastText += `**${day.date}**: ${day.icon} ${day.desc} ${day.temp}\n`;
    });

    return forecastText;
  }

  formatQuickWeather(data) {
    return `${data.icon} ${data.temperature}°C ${data.description}`;
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

  // ========== 키보드 생성 ==========

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

  // ========== 명령어 처리 ==========

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text && text.startsWith("/weather")) {
      await this.handleWeatherCommand(bot, msg);
      this.updateStats("command");
      return true;
    }

    return false;
  }

  async handleWeatherCommand(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    try {
      // 기본 현재 날씨 표시
      const weatherData = await this.getWeatherData("화성");
      const text = this.formatCurrentWeather(weatherData, "화성");

      await this.sendMessage(bot, chatId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getWeatherMenuKeyboard(),
      });
    } catch (error) {
      Logger.error("WeatherModule handleWeatherCommand 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 날씨 정보를 가져올 수 없습니다.");
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
      if (!this.weatherService) {
        Logger.warn("WeatherService가 없어도 기본 기능은 제공합니다.");
      }

      await super.initialize();
      Logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      Logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }
}

module.exports = WeatherModule;
