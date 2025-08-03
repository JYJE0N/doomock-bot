// src/modules/WeatherModule.js
// ⚙️ Weather 모듈 - 순수 비즈니스 로직만!

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * WeatherModule - SoC 원칙 준수
 * ✅ 역할: 비즈니스 로직, 콜백 처리, 데이터 조합
 * ❌ 금지: UI 생성, 직접적인 DB 접근
 */
class WeatherModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.weatherService = null;

    // 지원 도시 목록
    this.majorCities = [
      { id: "seoul", name: "서울", fullName: "서울시" },
      { id: "suwon", name: "수원", fullName: "수원시" },
      { id: "incheon", name: "인천", fullName: "인천시" },
      { id: "daejeon", name: "대전", fullName: "대전시" },
      { id: "daegu", name: "대구", fullName: "대구시" },
      { id: "busan", name: "부산", fullName: "부산시" },
      { id: "gwangju", name: "광주", fullName: "광주시" },
      { id: "jeju", name: "제주", fullName: "제주시" },
    ];

    // 모듈 설정
    this.config = {
      defaultCity: process.env.DEFAULT_WEATHER_CITY || "서울",
      enableDustInfo: process.env.WEATHER_ENABLE_DUST !== "false",
      enableForecast: process.env.WEATHER_ENABLE_FORECAST !== "false",
      ...options.config,
    };

    // 사용자별 선호 도시 (메모리 캐시)
    this.userPreferredCity = new Map();

    logger.info("🌤️ WeatherModule 생성 완료");
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    try {
      if (this.serviceBuilder) {
        this.weatherService = await this.serviceBuilder.getOrCreate("weather", {
          config: {
            defaultLocation: this.config.defaultCity + "시",
            enableDustInfo: this.config.enableDustInfo,
          },
        });
      }

      if (!this.weatherService) {
        throw new Error("WeatherService 생성 실패");
      }

      logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      city: this.showCityWeather,
      cities: this.showCityList,
      current: this.showCurrentWeather,
      setdefault: this.setDefaultCity,
      forecast: this.showForecast,
      help: this.showHelp,
    });

    logger.info(`✅ WeatherModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: _chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    const lowerText = text.toLowerCase();
    const weatherKeywords = ["날씨", "weather", "온도", "습도"];
    const hasWeatherKeyword = weatherKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (!hasWeatherKeyword) return false;

    // 도시 검색
    const city = this.findCityByKeyword(text);
    if (city) {
      const weatherData = await this.getCityWeatherData(city.id);
      return {
        type: "city_weather_direct",
        module: "weather",
        data: weatherData,
      };
    }

    // 기본 도시 날씨
    const defaultCityId = this.getDefaultCityId(userId);
    const weatherData = await this.getCityWeatherData(defaultCityId);
    return {
      type: "default_weather_direct",
      module: "weather",
      data: weatherData,
    };
  }

  // ===== 액션 핸들러 =====

  /**
   * 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const defaultCity = this.getUserPreferredCity(userId);

    return {
      type: "menu",
      module: "weather",
      data: {
        userName,
        defaultCity,
        majorCities: this.majorCities,
        config: this.config,
      },
    };
  }

  /**
   * 도시 목록 표시
   */
  async showCityList(bot, callbackQuery) {
    return {
      type: "cities",
      module: "weather",
      data: {
        cities: this.majorCities,
        defaultCity: this.getUserPreferredCity(getUserId(callbackQuery.from)),
      },
    };
  }

  /**
   * 특정 도시 날씨 표시
   */
  async showCityWeather(bot, callbackQuery, subAction, params) {
    const cityId = params;
    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      return {
        type: "error",
        message: "알 수 없는 도시입니다.",
      };
    }

    try {
      const weatherData = await this.getCityWeatherData(cityId);
      return {
        type: "weather",
        module: "weather",
        data: weatherData,
      };
    } catch (error) {
      logger.error(`날씨 조회 실패: ${city.name}`, error);
      return {
        type: "error",
        data: {
          message: this.getErrorMessage(error),
        },
      };
    }
  }

  /**
   * 현재 날씨 표시 (기본 도시)
   */
  async showCurrentWeather(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    const defaultCityId = this.getDefaultCityId(userId);

    try {
      const weatherData = await this.getCityWeatherData(defaultCityId);
      return {
        type: "current_weather",
        module: "weather",
        data: weatherData,
      };
    } catch (error) {
      logger.error("현재 날씨 조회 실패:", error);
      return {
        type: "error",
        data: {
          message: this.getErrorMessage(error),
        },
      };
    }
  }

  /**
   * 기본 도시 설정
   */
  async setDefaultCity(bot, callbackQuery, subAction, params) {
    const cityId = params;
    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      return {
        type: "error",
        message: "알 수 없는 도시입니다.",
      };
    }

    const userId = getUserId(callbackQuery.from);
    this.userPreferredCity.set(userId, city.name);

    logger.info(`👤 기본 도시 설정: ${userId} → ${city.name}`);

    return {
      type: "default_set",
      module: "weather",
      data: {
        city,
        userName: getUserName(callbackQuery.from),
      },
    };
  }

  /**
   * 날씨 예보 표시
   */
  async showForecast(bot, callbackQuery, subAction, params) {
    const cityId =
      params || this.getDefaultCityId(getUserId(callbackQuery.from));
    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      return {
        type: "error",
        message: "알 수 없는 도시입니다.",
      };
    }

    if (!this.config.enableForecast) {
      return {
        type: "error",
        message: "날씨 예보 기능이 비활성화되어 있습니다.",
      };
    }

    try {
      const forecastResult = await this.weatherService.getForecast(
        city.fullName
      );

      if (forecastResult.success) {
        return {
          type: "forecast",
          module: "weather",
          data: {
            city,
            forecast: forecastResult.data,
            timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          },
        };
      } else {
        throw new Error(forecastResult.error || "예보 조회 실패");
      }
    } catch (error) {
      logger.error("날씨 예보 조회 실패:", error);
      return {
        type: "error",
        data: {
          message: this.getErrorMessage(error),
        },
      };
    }
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery) {
    return {
      type: "help",
      module: "weather",
      data: {
        config: this.config,
        majorCities: this.majorCities,
        features: {
          weather: "실시간 날씨 정보",
          cities: "주요 8개 도시 지원",
          dust: this.config.enableDustInfo ? "미세먼지 정보" : null,
          forecast: this.config.enableForecast ? "5일 날씨 예보" : null,
          setting: "기본 도시 설정",
        },
      },
    };
  }

  // ===== 헬퍼 메서드 =====

  /**
   * 도시 날씨 데이터 조회
   */
  async getCityWeatherData(cityId) {
    const city = this.majorCities.find((c) => c.id === cityId);
    if (!city) {
      throw new Error(`알 수 없는 도시: ${cityId}`);
    }

    // 날씨 정보 조회
    const weatherResult = await this.weatherService.getCurrentWeather(
      city.fullName
    );

    // 미세먼지 정보 조회 (옵션)
    let dustResult = null;
    if (this.config.enableDustInfo) {
      try {
        dustResult = await this.weatherService.getDustInfo(city.fullName);
      } catch (dustError) {
        logger.warn(`미세먼지 정보 조회 실패 (${city.name}):`, dustError);
      }
    }

    if (!weatherResult.success) {
      throw new Error(weatherResult.error || "날씨 정보를 가져올 수 없습니다");
    }

    return {
      city,
      weather: weatherResult.data,
      dust: dustResult?.success ? dustResult.data : null,
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
    };
  }

  /**
   * 사용자 선호 도시 가져오기
   */
  getUserPreferredCity(userId) {
    return this.userPreferredCity.get(userId) || this.config.defaultCity;
  }

  /**
   * 기본 도시 ID 가져오기
   */
  getDefaultCityId(userId) {
    const preferredCityName = this.getUserPreferredCity(userId);
    const city = this.majorCities.find((c) => c.name === preferredCityName);
    return city?.id || "seoul";
  }

  /**
   * 도시 검색
   */
  findCityByKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.majorCities.find(
      (city) =>
        city.name.toLowerCase().includes(lowerKeyword) ||
        city.id.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 에러 메시지 처리
   */
  getErrorMessage(error) {
    if (error.message.includes("API 키")) {
      return "날씨 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.";
    }
    if (error.message.includes("timeout")) {
      return "날씨 정보를 불러오는데 시간이 오래 걸렸습니다. 잠시 후 다시 시도하세요.";
    }
    return "날씨 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요.";
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.weatherService,
      citiesCount: this.majorCities.length,
      userPreferences: this.userPreferredCity.size,
      config: {
        defaultCity: this.config.defaultCity,
        enableDustInfo: this.config.enableDustInfo,
        enableForecast: this.config.enableForecast,
      },
    };
  }

  /**
   * 모듈 정리
   */
  async onCleanup() {
    this.userPreferredCity.clear();
    logger.info("✅ WeatherModule 정리 완료");
  }
}

module.exports = WeatherModule;
