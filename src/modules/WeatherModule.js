// src/modules/WeatherModule.js - 심플한 주요 도시 날씨

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherModule - 주요 8개 도시 날씨 정보
 */
class WeatherModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.weatherService = null;

    // 주요 8개 도시 설정
    this.majorCities = [
      { id: "seoul", name: "서울", emoji: "🏛️" },
      { id: "suwon", name: "수원", emoji: "🏰" },
      { id: "incheon", name: "인천", emoji: "✈️" },
      { id: "daejeon", name: "대전", emoji: "🚄" },
      { id: "daegu", name: "대구", emoji: "🍎" },
      { id: "busan", name: "부산", emoji: "🌊" },
      { id: "gwangju", name: "광주", emoji: "🌻" },
      { id: "jeju", name: "제주", emoji: "🏝️" },
    ];

    // 사용자별 선호 도시 저장
    this.userPreferredCity = new Map();

    logger.info("🌤️ WeatherModule 생성됨");
  }

  /**
   * ✅ 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🌤️ WeatherModule 초기화 시작...");

      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 필요합니다");
      }

      // WeatherService 연결
      this.weatherService = await this.serviceBuilder.getOrCreate("weather", {
        config: { defaultLocation: "서울시" },
      });

      if (!this.weatherService) {
        throw new Error("WeatherService를 찾을 수 없습니다");
      }

      // 액션 등록
      this.setupActions();

      logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showWeatherMenu,
      city: this.showCityWeather,
      cities: this.showCityList,
      setdefault: this.setDefaultCity,
      help: this.showHelp,
    });
  }

  /**
   * 📋 날씨 메뉴 표시
   */
  async showWeatherMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const defaultCity = this.userPreferredCity.get(userId) || "서울";

    return {
      type: "menu",
      module: "weather",
      data: {
        title: "날씨 정보",
        description: `주요 도시의 날씨를 확인하세요.\n기본 도시: ${defaultCity}`,
        defaultCity: defaultCity,
      },
    };
  }

  /**
   * 🏙️ 도시 목록 표시
   */
  async showCityList(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "cities",
      module: "weather",
      data: {
        cities: this.majorCities,
      },
    };
  }

  /**
   * 🌡️ 특정 도시 날씨 표시
   */
  async showCityWeather(bot, callbackQuery, subAction, params, moduleManager) {
    const cityId = params;
    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      return {
        type: "error",
        module: "weather",
        data: {
          message: "알 수 없는 도시입니다.",
        },
      };
    }

    try {
      logger.info(`🌡️ ${city.name} 날씨 요청`);

      // 날씨 정보 조회
      const weatherResult = await this.weatherService.getCurrentWeather(
        city.name + "시"
      );

      // 미세먼지 정보 조회
      const dustResult = await this.weatherService.getDustInfo(
        city.name + "시"
      );

      if (weatherResult.success) {
        return {
          type: "weather",
          module: "weather",
          data: {
            city: city,
            weather: weatherResult.data,
            dust: dustResult.success ? dustResult.data : null,
            timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          },
        };
      } else {
        throw new Error(
          weatherResult.error || "날씨 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      logger.error(`${city.name} 날씨 조회 실패:`, error);
      return {
        type: "error",
        module: "weather",
        data: {
          message: `${city.name} 날씨 정보를 불러올 수 없습니다.`,
          canRetry: true,
        },
      };
    }
  }

  /**
   * ⭐ 기본 도시 설정
   */
  async setDefaultCity(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const cityId = params;
    const city = this.majorCities.find((c) => c.id === cityId);

    if (city) {
      this.userPreferredCity.set(userId, city.name);

      return {
        type: "default_set",
        module: "weather",
        data: {
          city: city,
          message: `기본 도시가 ${city.name}(으)로 설정되었습니다.`,
        },
      };
    }

    return {
      type: "error",
      module: "weather",
      data: {
        message: "도시 설정에 실패했습니다.",
      },
    };
  }

  /**
   * 💬 메시지 핸들러
   */
  async onHandleMessage(bot, msg) {
    const text = msg.text?.toLowerCase() || "";
    const chatId = msg.chat.id;
    const userId = getUserId(msg.from);

    // 날씨 키워드 감지
    if (text.includes("날씨") || text.includes("weather")) {
      logger.info(`💬 날씨 키워드 감지: "${text}"`);

      // 특정 도시 날씨 요청 확인
      for (const city of this.majorCities) {
        if (text.includes(city.name)) {
          const weatherResult = await this.weatherService.getCurrentWeather(
            city.name + "시"
          );

          if (weatherResult.success) {
            const weather = weatherResult.data;
            await bot.sendMessage(
              chatId,
              `${city.emoji} *${city.name} 날씨*\n\n` +
                `${weather.description}\n` +
                `🌡️ 온도: ${weather.temperature}°C (체감 ${
                  weather.feelsLike || weather.temperature
                }°C)\n` +
                `💧 습도: ${weather.humidity}%\n` +
                `🌬️ 풍속: ${weather.windSpeed || 0}m/s`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "🔄 새로고침",
                        callback_data: `weather:city:${city.id}`,
                      },
                      { text: "📋 도시 목록", callback_data: "weather:cities" },
                    ],
                    [
                      {
                        text: "⭐ 기본 도시로 설정",
                        callback_data: `weather:setdefault:${city.id}`,
                      },
                    ],
                  ],
                },
              }
            );
            return true;
          }
        }
      }

      // 기본 도시 날씨 표시
      const defaultCity = this.userPreferredCity.get(userId) || "서울";
      const weatherResult = await this.weatherService.getCurrentWeather(
        defaultCity + "시"
      );

      if (weatherResult.success) {
        const weather = weatherResult.data;
        const cityInfo = this.majorCities.find((c) => c.name === defaultCity);

        await bot.sendMessage(
          chatId,
          `${cityInfo?.emoji || "🌤️"} *${defaultCity} 날씨*\n\n` +
            `${weather.description}\n` +
            `🌡️ 온도: ${weather.temperature}°C (체감 ${
              weather.feelsLike || weather.temperature
            }°C)\n` +
            `💧 습도: ${weather.humidity}%\n` +
            `🌬️ 풍속: ${weather.windSpeed || 0}m/s\n\n` +
            `💡 다른 도시: "서울 날씨", "부산 날씨" 등으로 검색`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 전체 도시 날씨",
                    callback_data: "weather:cities",
                  },
                ],
                [
                  {
                    text: "🔄 새로고침",
                    callback_data: `weather:city:${cityInfo?.id || "seoul"}`,
                  },
                ],
              ],
            },
          }
        );
      }

      return true;
    }

    return false;
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "weather",
      data: {
        title: "날씨 도움말",
        features: [
          "🏛️ 서울, 수원 등 주요 8개 도시 날씨",
          "🌡️ 실시간 온도, 습도, 풍속 정보",
          "💨 미세먼지 정보 (PM2.5, PM10)",
          "⭐ 기본 도시 설정 가능",
        ],
        usage: [
          '"날씨" - 기본 도시 날씨',
          '"서울 날씨" - 특정 도시 날씨',
          '"부산 날씨" - 부산 날씨 확인',
        ],
        tips: [
          "자주 확인하는 도시를 기본으로 설정하세요",
          "8개 주요 도시 날씨를 빠르게 확인 가능",
        ],
      },
    };
  }
}

module.exports = WeatherModule;
