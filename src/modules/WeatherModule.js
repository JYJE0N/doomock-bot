// src/modules/WeatherModule.js - 🌤️ 날씨 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherModule - 날씨 정보 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: weather:action:params
 * ✅ 렌더링은 Renderer가 담당
 */
class WeatherModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.weatherService = null;

    // 주요 8개 도시 설정
    this.majorCities = [
      { id: "seoul", name: "서울", emoji: "🏛️", fullName: "서울시" },
      { id: "suwon", name: "수원", emoji: "🏰", fullName: "수원시" },
      { id: "incheon", name: "인천", emoji: "✈️", fullName: "인천시" },
      { id: "daejeon", name: "대전", emoji: "🚄", fullName: "대전시" },
      { id: "daegu", name: "대구", emoji: "🍎", fullName: "대구시" },
      { id: "busan", name: "부산", emoji: "🌊", fullName: "부산시" },
      { id: "gwangju", name: "광주", emoji: "🌻", fullName: "광주시" },
      { id: "jeju", name: "제주", emoji: "🏝️", fullName: "제주시" },
    ];

    // 모듈 설정
    this.config = {
      defaultCity: process.env.DEFAULT_WEATHER_CITY || "서울",
      enableDustInfo: process.env.WEATHER_ENABLE_DUST !== "false",
      cacheTimeout: parseInt(process.env.WEATHER_CACHE_TIMEOUT) || 300000, // 5분
      enableForecast: process.env.WEATHER_ENABLE_FORECAST !== "false",
      ...options.config,
    };

    // 사용자별 선호 도시 저장 (메모리 캐시)
    this.userPreferredCity = new Map();

    logger.info(`🌤️ WeatherModule 생성 완료 (v4.1)`);
  }

  /**
   * 🎯 모듈 초기화
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
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,
      main: this.showMenu,
      // 날씨 조회
      city: this.showCityWeather,
      cities: this.showCityList,
      current: this.showCurrentWeather,

      // 설정
      setdefault: this.setDefaultCity,

      // 기타
      forecast: this.showForecast,
      help: this.showHelp,
    });

    logger.info(`✅ WeatherModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    const lowerText = text.toLowerCase();

    // 날씨 키워드 확인
    const weatherKeywords = ["날씨", "weather", "온도", "습도"];
    const hasWeatherKeyword = weatherKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (hasWeatherKeyword) {
      logger.info(`💬 날씨 키워드 감지: "${text}"`);

      // 특정 도시 날씨 요청 확인
      for (const city of this.majorCities) {
        if (lowerText.includes(city.name)) {
          return {
            type: "render_request",
            module: "weather",
            action: "city_weather_direct",
            chatId: chatId,
            data: await this.getCityWeatherData(city.id),
          };
        }
      }

      // 기본 도시 날씨 표시
      const defaultCityId = this.getDefaultCityId(userId);
      return {
        type: "render_request",
        module: "weather",
        action: "default_weather_direct",
        chatId: chatId,
        data: await this.getCityWeatherData(defaultCityId),
      };
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const defaultCity = this.getUserPreferredCity(userId);

      // ✅ 로그 추가로 확인
      logger.info(`🏠 날씨 메뉴 - 사용자: ${userId}, 기본도시: ${defaultCity}`);

      return {
        type: "menu",
        module: "weather",
        data: {
          userName,
          defaultCity, // ✅ 이미 있음
          majorCities: this.majorCities,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("날씨 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🏙️ 도시 목록 표시
   */
  async showCityList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    // ✅ 수정: 현재 사용자의 기본 도시 정보 추가
    const defaultCity = this.getUserPreferredCity(userId); // ✅ 추가!

    return {
      type: "cities",
      module: "weather",
      data: {
        cities: this.majorCities,
        config: this.config,
        defaultCity: defaultCity, // ✅ 추가된 부분!
      },
    };
  }

  /**
   * 🛠️ WeatherModule 전용 파라미터 파서
   */
  parseParams(params) {
    if (!params) return [];

    if (typeof params === "string") {
      // "suwon" 또는 "suwon:extra:data" → ["suwon", "extra", "data"]
      return params.split(":").filter((p) => p.length > 0);
    } else if (Array.isArray(params)) {
      return params;
    } else {
      return [String(params)];
    }
  }

  /**
   * 🌡️ 특정 도시 날씨 표시 (안전한 파라미터 처리)
   */
  async showCityWeather(bot, callbackQuery, subAction, params, moduleManager) {
    // ✅ WeatherModule 전용 파싱
    const parsedParams = this.parseParams(params);
    const cityId = parsedParams[0];

    // ✅ 로그 추가
    logger.info(
      `🌡️ 도시 날씨 요청 - 원본 params: "${params}", 파싱된 params: [${parsedParams.join(
        ","
      )}], cityId: ${cityId}`
    );

    if (!cityId) {
      return {
        type: "error",
        message: "도시 정보가 필요합니다.",
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
      logger.error(`도시 날씨 조회 실패 (${cityId}):`, error);
      return {
        type: "error",
        message: "날씨 정보를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🌤️ 현재 날씨 표시 (기본 도시)
   */
  async showCurrentWeather(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const defaultCityId = this.getDefaultCityId(userId);
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
        message: "현재 날씨를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ⭐ 기본 도시 설정
   */
  async setDefaultCity(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    // ✅ WeatherModule 전용 파싱
    const parsedParams = this.parseParams(params);
    const cityId = parsedParams[0];

    // ✅ 로그 추가
    logger.info(
      `⭐ 기본 도시 설정 요청 - 사용자: ${userId}, 원본 params: "${params}", 파싱된 params: [${parsedParams.join(
        ","
      )}], cityId: ${cityId}`
    );

    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      logger.warn(`❌ 알 수 없는 도시 ID: ${cityId}`);
      return {
        type: "error",
        message: "알 수 없는 도시입니다.",
      };
    }

    try {
      // 사용자 선호 도시 설정
      this.userPreferredCity.set(userId, city.name);

      // ✅ 설정 후 확인 로그
      const verifyCity = this.userPreferredCity.get(userId);
      logger.info(`✅ 기본 도시 설정 완료`, {
        userId,
        cityId,
        cityName: city.name,
        verified: verifyCity,
      });

      return {
        type: "default_set",
        module: "weather",
        data: {
          city,
          message: `기본 도시가 ${city.name}(으)로 설정되었습니다.`,
        },
      };
    } catch (error) {
      logger.error("기본 도시 설정 실패:", error);
      return {
        type: "error",
        message: "도시 설정에 실패했습니다.",
      };
    }
  }

  /**
   * 📅 날씨 예보 표시
   */
  async showForecast(bot, callbackQuery, subAction, params, moduleManager) {
    // ✅ WeatherModule 전용 파싱
    const parsedParams = this.parseParams(params);
    const cityId =
      parsedParams[0] || this.getDefaultCityId(getUserId(callbackQuery.from));

    // ✅ 로그 추가
    logger.info(
      `📊 날씨 예보 요청 - 원본 params: "${params}", 파싱된 params: [${parsedParams.join(
        ","
      )}], cityId: ${cityId}`
    );

    if (!this.config.enableForecast) {
      return {
        type: "error",
        message: "날씨 예보 기능이 비활성화되어 있습니다.",
      };
    }

    try {
      const city = this.majorCities.find((c) => c.id === cityId);
      if (!city) {
        return {
          type: "error",
          message: "알 수 없는 도시입니다.",
        };
      }

      // 날씨 예보 조회 (서비스에서 구현)
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
        message: "날씨 예보를 불러올 수 없습니다.",
      };
    }
  }
  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "weather",
      data: {
        config: this.config,
        majorCities: this.majorCities,
        features: {
          weather: "실시간 날씨 정보",
          cities: "주요 8개 도시 지원",
          dust: "미세먼지 정보 (선택)",
          forecast: "날씨 예보 (선택)",
          setting: "기본 도시 설정",
        },
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 🌡️ 도시 날씨 데이터 조회 (핵심 로직)
   */
  async getCityWeatherData(cityId) {
    const city = this.majorCities.find((c) => c.id === cityId);

    if (!city) {
      throw new Error(`알 수 없는 도시: ${cityId}`);
    }

    try {
      logger.info(`🌡️ ${city.name} 날씨 요청`);

      // 날씨 정보 조회
      const weatherResult = await this.weatherService.getCurrentWeather(
        city.fullName
      );

      // 미세먼지 정보 조회 (선택사항)
      let dustResult = null;
      if (this.config.enableDustInfo) {
        try {
          dustResult = await this.weatherService.getDustInfo(city.fullName);
        } catch (dustError) {
          logger.warn(`미세먼지 정보 조회 실패 (${city.name}):`, dustError);
        }
      }

      if (weatherResult.success) {
        return {
          city,
          weather: weatherResult.data,
          dust: dustResult?.success ? dustResult.data : null,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          hasError: false,
        };
      } else {
        throw new Error(
          weatherResult.error || "날씨 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      logger.error(`${city.name} 날씨 조회 실패:`, error);

      // 에러 상황에서도 기본 구조 반환
      return {
        city,
        weather: null,
        dust: null,
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        hasError: true,
        errorMessage: error.message || "날씨 정보를 불러올 수 없습니다",
      };
    }
  }

  /**
   * 👤 사용자 선호 도시 가져오기
   */
  getUserPreferredCity(userId) {
    const preferredCity = this.userPreferredCity.get(userId);
    const defaultCity = preferredCity || this.config.defaultCity;

    // ✅ 디버그 로그 추가
    logger.debug(
      `👤 getUserPreferredCity - 사용자: ${userId}, 저장된: ${preferredCity}, 기본: ${this.config.defaultCity}, 결과: ${defaultCity}`
    );

    return defaultCity;
  }

  /**
   * 🆔 기본 도시 ID 가져오기
   */
  getDefaultCityId(userId) {
    const preferredCityName = this.getUserPreferredCity(userId);
    const city = this.majorCities.find((c) => c.name === preferredCityName);
    return city?.id || "seoul";
  }

  /**
   * 🔍 도시 검색
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
   * 📊 모듈 상태 조회
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
        cacheTimeout: this.config.cacheTimeout,
      },
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async onCleanup() {
    try {
      // 사용자 선호도 정리
      this.userPreferredCity.clear();

      if (this.weatherService && this.weatherService.cleanup) {
        await this.weatherService.cleanup();
      }
      logger.info("✅ WeatherModule 정리 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 정리 실패:", error);
    }
  }
}

module.exports = WeatherModule;
