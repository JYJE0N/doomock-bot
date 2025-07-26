// src/modules/WeatherModule.js - 표준 구조 수정 v3.0.1
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🌤️ WeatherModule v3.0.1 - 날씨 정보 모듈
 *
 * 🎯 주요 수정사항:
 * - 표준 생성자 매개변수 사용 (bot, options)
 * - WeatherService 직접 생성
 * - 인라인 키보드 제거
 * - 표준 매개변수 체계 준수
 */
class WeatherModule extends BaseModule {
  constructor(bot, options = {}) {
    super("WeatherModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스 (onInitialize에서 생성)
    this.weatherService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      defaultLocation: process.env.WEATHER_DEFAULT_LOCATION || "서울",
      apiKey: process.env.OPENWEATHER_API_KEY,
      cacheDuration: parseInt(process.env.WEATHER_CACHE_DURATION) || 600000, // 10분
      enableForecast: process.env.WEATHER_ENABLE_FORECAST !== "false",
      enableClothingAdvice: process.env.WEATHER_ENABLE_CLOTHING !== "false",
      ...this.config,
    };

    // 날씨 이모지
    this.weatherEmojis = {
      Clear: "☀️",
      Clouds: "☁️",
      Rain: "🌧️",
      Drizzle: "🌦️",
      Thunderstorm: "⛈️",
      Snow: "❄️",
      Mist: "🌫️",
      Smoke: "🌫️",
      Haze: "🌫️",
      Dust: "🌫️",
      Fog: "🌫️",
      Sand: "🌫️",
      Ash: "🌫️",
      Squall: "💨",
      Tornado: "🌪️",
    };

    logger.info("🌤️ WeatherModule v3.0.1 생성됨");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🌤️ WeatherModule 초기화 시작...");

      // WeatherService 직접 생성
      const WeatherService = require("../services/WeatherService");
      this.weatherService = new WeatherService();

      // API 키 확인
      if (!this.config.apiKey) {
        logger.warn("⚠️ OpenWeather API 키가 설정되지 않았습니다.");
      }

      logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정
   */
  setupActions() {
    this.registerActions({
      // 메인
      menu: this.showMenu,

      // 날씨 정보
      current: this.showCurrentWeather,
      forecast: this.showForecast,
      hourly: this.showHourlyForecast,

      // 부가 정보
      clothing: this.showClothingAdvice,
      detail: this.showDetailedWeather,

      // 위치 관련
      location: this.changeLocation,

      // 도움말
      help: this.showHelp,
    });
  }

  /**
   * 🎯 메인 메뉴
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 사용자 위치 가져오기
      const userId = getUserId(callbackQuery);
      const userLocation =
        this.getUserLocation(userId) || this.config.defaultLocation;

      const menuText = `🌤️ **날씨 정보**

${userName}님, ${userLocation}의 날씨 정보입니다.

사용 가능한 명령:
• 현재 날씨 보기
• 시간별 예보 보기
• 주간 예보 보기
• 옷차림 추천 받기
• 상세 날씨 정보
• 지역 변경하기

무엇을 확인하시겠습니까?`;

      await this.editMessage(bot, chatId, messageId, menuText);
      return true;
    } catch (error) {
      logger.error("WeatherModule 메뉴 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🌡️ 현재 날씨
   */
  async showCurrentWeather(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 사용자 위치
      const location =
        params[0] ||
        this.getUserLocation(userId) ||
        this.config.defaultLocation;

      // API 키 확인
      if (!this.config.apiKey) {
        await this.sendError(
          bot,
          callbackQuery,
          "날씨 API가 설정되지 않았습니다."
        );
        return false;
      }

      // 날씨 정보 가져오기
      const weather = await this.weatherService.getCurrentWeather(
        location,
        this.config.apiKey
      );

      if (!weather.success) {
        await this.sendError(
          bot,
          callbackQuery,
          weather.message || "날씨 정보를 가져올 수 없습니다."
        );
        return false;
      }

      const data = weather.data;
      const emoji = this.weatherEmojis[data.weather[0].main] || "🌈";

      const weatherText = `${emoji} **${location} 현재 날씨**

🌡️ 온도: ${Math.round(data.main.temp)}°C
🤔 체감: ${Math.round(data.main.feels_like)}°C
📊 최저/최고: ${Math.round(data.main.temp_min)}°C / ${Math.round(
        data.main.temp_max
      )}°C

☁️ 날씨: ${data.weather[0].description}
💧 습도: ${data.main.humidity}%
💨 바람: ${data.wind.speed}m/s
👁️ 가시거리: ${(data.visibility / 1000).toFixed(1)}km

🌅 일출: ${this.formatTime(data.sys.sunrise)}
🌆 일몰: ${this.formatTime(data.sys.sunset)}

_${TimeHelper.format(new Date(), "time")} 기준_`;

      await this.editMessage(bot, chatId, messageId, weatherText);

      // 위치 저장
      this.setUserLocation(userId, location);

      return true;
    } catch (error) {
      logger.error("WeatherModule 현재 날씨 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "날씨 정보를 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 📅 주간 예보
   */
  async showForecast(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const location =
        this.getUserLocation(userId) || this.config.defaultLocation;

      // 예보 정보 가져오기
      const forecast = await this.weatherService.getForecast(
        location,
        this.config.apiKey
      );

      if (!forecast.success) {
        await this.sendError(
          bot,
          callbackQuery,
          "예보 정보를 가져올 수 없습니다."
        );
        return false;
      }

      // 일별 예보로 그룹핑
      const dailyForecasts = this.groupForecastByDay(forecast.data.list);

      let forecastText = `📅 **${location} 5일 예보**\n\n`;

      for (const [date, forecasts] of Object.entries(dailyForecasts).slice(
        0,
        5
      )) {
        const dayName = this.getDayName(new Date(date));
        const minTemp = Math.min(...forecasts.map((f) => f.main.temp_min));
        const maxTemp = Math.max(...forecasts.map((f) => f.main.temp_max));
        const mainWeather = this.getMostCommonWeather(forecasts);
        const emoji = this.weatherEmojis[mainWeather] || "🌈";

        forecastText += `**${dayName}** ${emoji}\n`;
        forecastText += `최저 ${Math.round(minTemp)}°C / 최고 ${Math.round(
          maxTemp
        )}°C\n\n`;
      }

      await this.editMessage(bot, chatId, messageId, forecastText);
      return true;
    } catch (error) {
      logger.error("WeatherModule 예보 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "예보를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * ⏰ 시간별 예보
   */
  async showHourlyForecast(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const location =
        this.getUserLocation(userId) || this.config.defaultLocation;

      // 예보 정보 가져오기
      const forecast = await this.weatherService.getForecast(
        location,
        this.config.apiKey
      );

      if (!forecast.success) {
        await this.sendError(
          bot,
          callbackQuery,
          "예보 정보를 가져올 수 없습니다."
        );
        return false;
      }

      let hourlyText = `⏰ **${location} 24시간 예보**\n\n`;

      // 24시간만 표시 (3시간 간격 = 8개)
      const hourlyData = forecast.data.list.slice(0, 8);

      for (const item of hourlyData) {
        const time = TimeHelper.format(new Date(item.dt * 1000), "time");
        const temp = Math.round(item.main.temp);
        const weather = item.weather[0].main;
        const emoji = this.weatherEmojis[weather] || "🌈";

        hourlyText += `${time} ${emoji} ${temp}°C\n`;
      }

      await this.editMessage(bot, chatId, messageId, hourlyText);
      return true;
    } catch (error) {
      logger.error("WeatherModule 시간별 예보 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "시간별 예보를 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 👔 옷차림 추천
   */
  async showClothingAdvice(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const location =
        this.getUserLocation(userId) || this.config.defaultLocation;

      // 현재 날씨 가져오기
      const weather = await this.weatherService.getCurrentWeather(
        location,
        this.config.apiKey
      );

      if (!weather.success) {
        await this.sendError(
          bot,
          callbackQuery,
          "날씨 정보를 가져올 수 없습니다."
        );
        return false;
      }

      const temp = Math.round(weather.data.main.temp);
      const feels = Math.round(weather.data.main.feels_like);
      const weatherMain = weather.data.weather[0].main;

      const advice = this.getClothingAdvice(temp, feels, weatherMain);

      const adviceText = `👔 **${location} 옷차림 추천**

현재 온도: ${temp}°C (체감 ${feels}°C)
날씨: ${weather.data.weather[0].description}

${advice}`;

      await this.editMessage(bot, chatId, messageId, adviceText);
      return true;
    } catch (error) {
      logger.error("WeatherModule 옷차림 추천 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "옷차림 추천을 표시할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 📍 위치 변경
   */
  async changeLocation(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
        },
      } = callbackQuery;

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "changing_location",
      });

      const instructionText = `📍 **위치 변경**

날씨를 확인할 도시명을 입력해주세요.

예시:
• 서울
• 부산
• 대구
• Seoul
• Tokyo
• New York

/cancel - 취소`;

      await bot.sendMessage(chatId, instructionText, {
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("WeatherModule 위치 변경 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "위치 변경을 시작할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 📨 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg);
      const userState = this.getUserState(userId);
      const text = msg.text?.trim() || "";

      // 위치 변경 중
      if (userState?.action === "changing_location") {
        if (text === "/cancel") {
          this.clearUserState(userId);
          await bot.sendMessage(msg.chat.id, "❌ 위치 변경이 취소되었습니다.");
          return true;
        }

        // 위치 유효성 검사
        const weather = await this.weatherService.getCurrentWeather(
          text,
          this.config.apiKey
        );

        if (weather.success) {
          this.setUserLocation(userId, text);
          this.clearUserState(userId);

          await bot.sendMessage(
            msg.chat.id,
            `✅ 위치가 **${text}**로 변경되었습니다.\n\n날씨를 확인해보세요!`,
            { parse_mode: "Markdown" }
          );
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `❌ "${text}"의 날씨 정보를 찾을 수 없습니다.\n\n다른 도시명을 입력해주세요.`
          );
        }

        return true;
      }

      // 날씨 관련 키워드 확인
      if (this.isWeatherRelated(text)) {
        const location =
          this.extractLocation(text) ||
          this.getUserLocation(userId) ||
          this.config.defaultLocation;

        // 날씨 정보 전송
        const weather = await this.weatherService.getCurrentWeather(
          location,
          this.config.apiKey
        );

        if (weather.success) {
          const data = weather.data;
          const emoji = this.weatherEmojis[data.weather[0].main] || "🌈";

          const weatherText = `${emoji} **${location} 현재 날씨**

🌡️ ${Math.round(data.main.temp)}°C (체감 ${Math.round(data.main.feels_like)}°C)
☁️ ${data.weather[0].description}
💧 습도 ${data.main.humidity}%`;

          await bot.sendMessage(msg.chat.id, weatherText, {
            parse_mode: "Markdown",
          });
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `❌ ${location}의 날씨 정보를 가져올 수 없습니다.`
          );
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.error("WeatherModule 메시지 처리 오류:", error);
      return false;
    }
  }

  // ===== 헬퍼 메서드들 =====

  /**
   * 날씨 관련 텍스트 확인
   */
  isWeatherRelated(text) {
    const keywords = [
      "날씨",
      "기온",
      "온도",
      "비",
      "눈",
      "맑음",
      "흐림",
      "weather",
      "temperature",
      "rain",
      "snow",
      "sunny",
      "cloudy",
    ];

    return keywords.some((keyword) => text.toLowerCase().includes(keyword));
  }

  /**
   * 텍스트에서 위치 추출
   */
  extractLocation(text) {
    // "서울 날씨", "부산의 날씨" 등에서 위치 추출
    const patterns = [
      /(.+?)(?:\s*의?\s*날씨)/,
      /날씨\s+(.+)/,
      /(.+?)\s+weather/i,
      /weather\s+in\s+(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * 사용자 위치 저장/조회
   */
  getUserLocation(userId) {
    const state = this.getUserState(userId);
    return state?.location;
  }

  setUserLocation(userId, location) {
    const state = this.getUserState(userId) || {};
    state.location = location;
    this.setUserState(userId, state);
  }

  /**
   * 시간 포맷
   */
  formatTime(timestamp) {
    return TimeHelper.format(new Date(timestamp * 1000), "time");
  }

  /**
   * 요일 이름
   */
  getDayName(date) {
    const days = [
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ];
    return days[date.getDay()];
  }

  /**
   * 예보를 일별로 그룹핑
   */
  groupForecastByDay(forecasts) {
    const grouped = {};

    for (const forecast of forecasts) {
      const date = TimeHelper.format(
        new Date(forecast.dt * 1000),
        "YYYY-MM-DD"
      );
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(forecast);
    }

    return grouped;
  }

  /**
   * 가장 빈번한 날씨
   */
  getMostCommonWeather(forecasts) {
    const weatherCount = {};

    for (const forecast of forecasts) {
      const weather = forecast.weather[0].main;
      weatherCount[weather] = (weatherCount[weather] || 0) + 1;
    }

    return Object.entries(weatherCount).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * 옷차림 추천 로직
   */
  getClothingAdvice(temp, feels, weather) {
    let advice = "**추천 옷차림:**\n";

    // 온도별 기본 추천
    if (temp >= 28) {
      advice += "🎽 민소매, 반팔, 반바지, 원피스\n";
      advice += "☀️ 자외선 차단제 필수!\n";
    } else if (temp >= 23) {
      advice += "👕 반팔, 얇은 셔츠, 반바지, 면바지\n";
    } else if (temp >= 20) {
      advice += "👔 얇은 가디건, 긴팔티, 면바지, 청바지\n";
    } else if (temp >= 17) {
      advice += "🧥 얇은 니트, 맨투맨, 가디건, 청바지\n";
    } else if (temp >= 12) {
      advice += "🧥 자켓, 가디건, 니트, 청바지, 면바지\n";
    } else if (temp >= 9) {
      advice += "🧥 트렌치코트, 야상, 니트, 청바지\n";
    } else if (temp >= 5) {
      advice += "🧥 코트, 가죽자켓, 니트, 레깅스\n";
    } else {
      advice += "🧥 패딩, 두꺼운 코트, 목도리, 기모제품\n";
      advice += "🧤 장갑, 귀마개 착용 권장\n";
    }

    // 날씨별 추가 조언
    if (weather === "Rain" || weather === "Drizzle") {
      advice += "\n☔ 우산이나 우비를 준비하세요!";
    } else if (weather === "Snow") {
      advice += "\n❄️ 미끄럼 방지 신발을 착용하세요!";
    } else if (weather === "Clear" && temp >= 25) {
      advice += "\n🕶️ 선글라스와 모자를 준비하세요!";
    }

    // 체감온도 차이가 큰 경우
    if (Math.abs(temp - feels) >= 5) {
      advice += "\n\n💡 체감온도가 실제 온도와 차이가 많이 나니 주의하세요!";
    }

    return advice;
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const helpText = `🌤️ **날씨 도움말**

**사용 가능한 기능:**
• 현재 날씨 - 실시간 날씨 정보
• 시간별 예보 - 24시간 날씨 예보
• 주간 예보 - 5일간 날씨 예보
• 옷차림 추천 - 날씨에 맞는 의상
• 위치 변경 - 다른 도시 날씨 확인

**텍스트 명령 예시:**
• "서울 날씨"
• "부산의 날씨 알려줘"
• "날씨 어때?"
• "오늘 비와?"

💡 위치를 한 번 설정하면 기억됩니다!`;

      await this.editMessage(bot, chatId, messageId, helpText);
      return true;
    } catch (error) {
      logger.error("WeatherModule 도움말 오류:", error);
      await this.sendError(bot, callbackQuery, "도움말을 표시할 수 없습니다.");
      return false;
    }
  }
}

module.exports = WeatherModule;
