// src/modules/WeatherModule.js - Import 방식 수정

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const WeatherService = require("../services/WeatherService"); // ✅ 수정: 구조 분해 할당 제거
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

    // ✅ 수정: WeatherService 클래스로 직접 인스턴스화
    try {
      this.weatherService = new WeatherService();
      Logger.info("🌤️ WeatherService 초기화 성공");
    } catch (error) {
      Logger.error("❌ WeatherService 초기화 실패:", error);
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

  // ========== 안전한 날씨 데이터 처리 ==========

  async getWeatherData(city) {
    try {
      if (!this.weatherService) {
        Logger.warn("WeatherService가 없어서 기본값 사용");
        return this.getDefaultWeatherData(city);
      }

      // WeatherService 사용해서 실제 API 호출
      const result = await this.weatherService.getCurrentWeather(city);

      if (result.success) {
        return result.data;
      } else {
        Logger.warn(`실제 날씨 API 호출 실패: ${result.error}`);
        return result.data || this.getDefaultWeatherData(city);
      }
    } catch (error) {
      Logger.warn(`날씨 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultWeatherData(city);
    }
  }

  async getForecastData(city) {
    try {
      if (!this.weatherService) {
        Logger.warn("WeatherService가 없어서 기본 예보 사용");
        return this.getDefaultForecastData(city);
      }

      const result = await this.weatherService.getForecast(city);

      if (result.success) {
        return result.data;
      } else {
        Logger.warn(`예보 API 호출 실패: ${result.error}`);
        return result.data || this.getDefaultForecastData(city);
      }
    } catch (error) {
      Logger.warn(`예보 데이터 조회 실패, 기본값 사용: ${error.message}`);
      return this.getDefaultForecastData(city);
    }
  }

  getDefaultWeatherData(city) {
    // API 실패시 사용할 기본 데이터
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
        desc: "구름조금",
        icon: "🌤️",
        humidity: 70,
        wind: "남동풍 3.2m/s",
      },
    };

    const data = defaultData[city] || defaultData["화성"];

    return {
      city: city,
      temperature: data.temp,
      description: data.desc,
      humidity: data.humidity,
      windSpeed: data.wind.split(" ")[1],
      windDirection: data.wind.split(" ")[0],
      icon: data.icon,
      timestamp: new Date().toLocaleString("ko-KR"),
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
      timestamp: new Date().toLocaleString("ko-KR"),
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
      `💨 바람: ${data.windDirection} ${data.windSpeed}\n\n` +
      `📝 업데이트: ${data.timestamp || new Date().toLocaleTimeString("ko-KR")}`
    );
  }

  formatForecast(data, city) {
    const cityIcon = this.getCityIcon(city);
    let forecastText = `${cityIcon} **${city} 날씨 예보**\n\n`;

    if (data.forecast && data.forecast.length > 0) {
      data.forecast.forEach((day) => {
        forecastText += `**${day.date}**: ${day.icon} ${day.desc} ${day.temp}\n`;
      });
    } else {
      forecastText += "예보 데이터를 불러올 수 없습니다.";
    }

    forecastText += `\n📝 업데이트: ${
      data.timestamp || new Date().toLocaleTimeString("ko-KR")
    }`;

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
      // WeatherService가 없어도 기본 기능은 제공
      if (!this.weatherService) {
        Logger.warn("⚠️ WeatherService가 없지만 기본 날씨 기능은 제공합니다.");
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
