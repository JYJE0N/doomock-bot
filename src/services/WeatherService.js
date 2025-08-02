// src/services/WeatherService.js - 🌤️ 날씨 API 서비스 (완성판)
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherService - 날씨 정보 API 서비스
 *
 * ✅ 특징:
 * - 실제 날씨 API 연동 (OpenWeatherMap)
 * - 8개 주요 도시 지원
 * - 캐싱 시스템으로 API 호출 최적화
 * - 미세먼지 정보 포함 * - 에러 상황에서도 기본 데이터 제공
 */
class WeatherService extends BaseService {
  constructor(options = {}) {
    super("WeatherService", options);

    // API 설정 (변경 없음)
    this.config = {
      apiKey: process.env.WEATHER_API_KEY,
      baseUrl: "https://api.openweathermap.org/data/2.5",
      dustApiUrl: "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc",
      dustApiKey: process.env.AIR_KOREA_API_KEY,
      cacheTimeout: 10 * 60 * 1000, // 10분
      defaultLocation: "서울",
      enableDustInfo: process.env.WEATHER_ENABLE_DUST !== "false",
      ...options.config,
    };

    // 도시 매핑 (한글 → 영문)
    this.cityMapping = {
      서울: "Seoul,KR",
      수원: "Suwon,KR",
      인천: "Incheon,KR",
      대전: "Daejeon,KR",
      대구: "Daegu,KR",
      부산: "Busan,KR",
      광주: "Gwangju,KR",
      제주: "Jeju,KR",
      서울시: "Seoul,KR",
      수원시: "Suwon,KR",
      인천시: "Incheon,KR",
      대전시: "Daejeon,KR",
      대구시: "Daegu,KR",
      부산시: "Busan,KR",
      광주시: "Gwangju,KR",
      제주시: "Jeju,KR",
    };

    // 캐싱 시스템
    this.weatherCache = new Map();
    this.dustCache = new Map();
    this.forecastCache = new Map();

    // 통계
    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      errors: 0,
      lastUpdate: null,
    };

    logger.info("🌤️ WeatherService 생성됨");
  }

  getRequiredModels() {
    // ✅ 중요: WeatherService는 외부 API 서비스라 DB 모델이 필요 없음!
    return [];
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    // API 키 검증
    if (!this.config.apiKey) {
      logger.warn("⚠️ OpenWeatherMap API 키가 설정되지 않음");
    }

    // 캐시 정리 스케줄링
    this.setupCacheCleaning();

    // logger.success("✅ WeatherService 초기화 완료");
  }

  /**
   * 🌡️ 현재 날씨 조회 (핵심 메서드)
   */
  async getCurrentWeather(location) {
    try {
      const cacheKey = `weather_${location}`;
      const cached = this.getCached(this.weatherCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 날씨 정보");
      }

      // ✅ API 키가 있으면 실제 API 호출!
      if (this.config.apiKey) {
        logger.info(`🌐 실제 API 호출: ${location}`);

        try {
          // 도시명 매핑
          const mappedCity = this.cityMapping[location] || `${location},KR`;

          // OpenWeatherMap API 호출
          const axios = require("axios");
          const response = await axios.get(`${this.config.baseUrl}/weather`, {
            params: {
              q: mappedCity,
              appid: this.config.apiKey,
              units: "metric",
              lang: "kr",
            },
            timeout: 10000,
          });

          // Weather 모델로 데이터 변환
          const Weather = require("../database/models/Weather");
          const weatherData = Weather.createFromApiResponse(
            response.data,
            location
          );

          // 캐시 저장
          this.setCached(this.weatherCache, cacheKey, weatherData);
          this.stats.apiCalls++;
          this.stats.lastUpdate = new Date();

          logger.success(
            `✅ 실제 날씨 API 성공: ${location} (${weatherData.temperature}°C)`
          );
          return this.createSuccessResponse(weatherData, "실제 날씨 정보");
        } catch (apiError) {
          logger.error(
            `❌ 날씨 API 호출 실패 (${location}):`,
            apiError.message
          );

          // API 실패 시 Mock 데이터로 폴백
          const mockData = this.createMockWeatherData(location);
          return this.createSuccessResponse(mockData, "API 실패 - Mock 데이터");
        }
      }

      // API 키 없으면 Mock 데이터 반환
      logger.warn("⚠️ API 키 없음 - Mock 데이터 사용");
      const mockData = this.createMockWeatherData(location);
      return this.createSuccessResponse(mockData, "Mock 날씨 정보");
    } catch (error) {
      this.stats.errors++;
      return this.createErrorResponse(error, "날씨 정보 조회 실패");
    }
  }

  /**
   * 🌤️ 실제 날씨 예보 조회 (OpenWeatherMap 5일 예보)
   */
  async getForecast(location) {
    try {
      const cacheKey = `forecast_${location}`;
      const cached = this.getCached(this.forecastCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 예보 정보");
      }

      // API 키 없으면 Mock 데이터 (명확히 표시)
      if (!this.config.apiKey) {
        logger.warn("⚠️ API 키 없음 - Mock 예보 데이터 사용");
        const mockForecast = this.createMockForecastData(location);
        mockForecast.isOffline = true; // Mock임을 명시
        mockForecast.source = "Mock (API 키 없음)";
        return this.createSuccessResponse(mockForecast, "Mock 예보 정보");
      }

      // 도시명 매핑
      const mappedCity = this.cityMapping[location] || location;

      logger.info(`🌐 실제 예보 API 호출: ${location} → ${mappedCity}`);

      // OpenWeatherMap 5일 예보 API 호출
      const axios = require("axios");
      const response = await axios.get(`${this.config.baseUrl}/forecast`, {
        params: {
          q: mappedCity,
          appid: this.config.apiKey,
          units: "metric",
          lang: "kr",
          cnt: 40, // 5일 * 8회 (3시간 간격)
        },
        timeout: 10000,
      });

      if (response.data && response.data.list) {
        // API 응답을 내부 포맷으로 변환
        const forecastData = this.parseOpenWeatherForecast(
          response.data,
          location
        );

        // 캐시에 저장
        this.setCached(this.forecastCache, cacheKey, forecastData);
        this.stats.apiCalls++;

        logger.success(`✅ 실제 예보 API 성공: ${location}`);
        return this.createSuccessResponse(
          forecastData,
          "실제 예보 정보 조회 성공"
        );
      } else {
        throw new Error("API 응답에 예보 데이터가 없습니다");
      }
    } catch (error) {
      this.stats.errors++;
      logger.error(`❌ 예보 API 실패 (${location}):`, error.message);

      // 실패시 Mock 데이터로 폴백 (에러임을 명시)
      const mockForecast = this.createMockForecastData(location);
      mockForecast.isOffline = true;
      mockForecast.error = error.message;
      mockForecast.source = "Mock (API 실패)";

      return this.createSuccessResponse(mockForecast, "폴백 예보 정보");
    }
  }

  /**
   * 🔄 OpenWeatherMap 예보 응답 → 내부 포맷 변환
   */
  parseOpenWeatherForecast(apiResponse, originalLocation) {
    try {
      const { list, city } = apiResponse;

      // 5일 예보를 하루별로 그룹핑 (3시간 간격 데이터를 하루로 합치기)
      const dailyForecasts = this.groupForecastByDay(list);

      return {
        location: originalLocation,
        cityName: city?.name || originalLocation,
        country: city?.country || "KR",
        forecast: dailyForecasts, // ← 여기가 중요! forecast 키로 통일
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        isOffline: false,
        source: "OpenWeatherMap 5-day forecast",
        meta: {
          totalItems: list.length,
          apiResponse: true,
          hasApiData: true,
        },
      };
    } catch (error) {
      logger.error("예보 API 응답 파싱 실패:", error);
      throw new Error("예보 데이터 파싱 실패");
    }
  }

  groupForecastByDay(forecastList) {
    const dailyData = new Map();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    forecastList.forEach((item, index) => {
      const date = new Date(item.dt * 1000);
      const dateKey = TimeHelper.format(date, "MM/DD");

      if (!dailyData.has(dateKey)) {
        const dayOfWeek =
          index === 0 ? "오늘" : weekdays[date.getDay()] + "요일";

        dailyData.set(dateKey, {
          date: dateKey,
          dayOfWeek: dayOfWeek,
          temperatures: [],
          conditions: [],
          icons: [],
          humidity: [],
          rainProbability: 0,
          rawData: [],
        });
      }

      const dayData = dailyData.get(dateKey);
      dayData.temperatures.push(Math.round(item.main.temp));
      dayData.conditions.push(item.weather[0].description);
      dayData.icons.push(item.weather[0].icon);
      dayData.humidity.push(item.main.humidity);
      dayData.rawData.push(item);

      // 강수확률 계산 (비/눈 관련 날씨 코드 확인)
      if (
        item.weather[0].main.includes("Rain") ||
        item.weather[0].main.includes("Snow") ||
        item.weather[0].main.includes("Drizzle")
      ) {
        dayData.rainProbability = Math.max(
          dayData.rainProbability,
          Math.round((item.pop || 0) * 100)
        );
      }
    });

    // 하루별 데이터 정리 (최대 5일)
    return Array.from(dailyData.values())
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        tempMin: Math.min(...day.temperatures),
        tempMax: Math.max(...day.temperatures),
        description: this.getMostFrequentCondition(day.conditions),
        icon: this.getMostFrequentIcon(day.icons),
        humidity: Math.round(
          day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length
        ),
        rainProbability: day.rainProbability,
      }));
  }

  /**
   * 🎯 가장 빈번한 날씨 상태 선택
   */
  getMostFrequentCondition(conditions) {
    const counts = {};
    conditions.forEach((condition) => {
      counts[condition] = (counts[condition] || 0) + 1;
    });

    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
  }

  /**
   * 🎨 가장 빈번한 아이콘 선택
   */
  getMostFrequentIcon(icons) {
    const counts = {};
    icons.forEach((icon) => {
      counts[icon] = (counts[icon] || 0) + 1;
    });

    const mostFrequentIcon = Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );

    // Weather 모델의 아이콘 매핑 사용
    const Weather = require("../database/models/Weather");
    return Weather.getWeatherIcon(mostFrequentIcon);
  }

  /**
   * 🎭 Mock 데이터 (개발용 - 데이터 구조 통일)
   */
  createMockForecastData(location) {
    logger.warn(`🎭 Mock 예보 데이터 생성: ${location}`);

    const days = [];
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    for (let i = 0; i < 5; i++) {
      const date = new Date(Date.now() + i * 86400000);
      const dayOfWeek = i === 0 ? "오늘" : weekdays[date.getDay()] + "요일";

      days.push({
        date: TimeHelper.format(date, "MM/DD"),
        dayOfWeek: dayOfWeek,
        tempMin: Math.round(15 + Math.random() * 5),
        tempMax: Math.round(25 + Math.random() * 8),
        description: ["맑음", "구름조금", "흐림", "비"][
          Math.floor(Math.random() * 4)
        ],
        icon: ["☀️", "⛅", "☁️", "🌧️"][Math.floor(Math.random() * 4)],
        humidity: Math.round(50 + Math.random() * 30),
        rainProbability: Math.round(Math.random() * 50),
      });
    }

    return {
      location,
      forecast: days, // ← 여기가 중요! forecast 키로 통일
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      isOffline: true,
      source: "Mock 데이터 (개발용)",
    };
  }

  /**
   * 🌬️ 미세먼지 정보 조회 (실제 API 호출 로직 추가!)
   */
  async getDustInfo(location) {
    try {
      const cacheKey = `dust_${location}`;
      const cached = this.getCached(this.dustCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 미세먼지 정보");
      }

      // ✅ 미세먼지 API 키가 있으면 실제 API 호출!
      if (this.config.dustApiKey) {
        logger.info(`🌬️ 실제 미세먼지 API 호출: ${location}`);

        try {
          const AirQualityHelper = require("../utils/AirQualityHelper");
          const airHelper = new AirQualityHelper();
          const result = await airHelper.getCurrentAirQuality(location);

          if (result.success && result.data) {
            // 캐시 저장
            this.setCached(this.dustCache, cacheKey, result.data);
            logger.success(`✅ 실제 미세먼지 API 성공: ${location}`);
            return this.createSuccessResponse(
              result.data,
              "실제 미세먼지 정보"
            );
          }
        } catch (dustError) {
          logger.error(
            `❌ 미세먼지 API 호출 실패 (${location}):`,
            dustError.message
          );
        }
      }

      // API 실패 또는 키 없음
      logger.warn("⚠️ 미세먼지 API 키 없거나 실패 - 추정 데이터 사용");
      const estimatedData = this.createMockDustData(location);
      return this.createSuccessResponse(estimatedData, "추정 미세먼지 정보");
    } catch (error) {
      this.stats.errors++;
      return this.createErrorResponse(error, "미세먼지 정보 조회 실패");
    }
  }

  /**
   * 🌬️ Mock 미세먼지 데이터 생성
   */
  createMockDustData(location) {
    const hour = new Date().getHours();

    // 시간대별 미세먼지 추정
    let pm25, pm10, grade;
    if (hour >= 7 && hour <= 9) {
      pm25 = Math.floor(Math.random() * 20) + 25; // 25-45
      pm10 = Math.floor(Math.random() * 30) + 45; // 45-75
      grade = "나쁨";
    } else if (hour >= 18 && hour <= 20) {
      pm25 = Math.floor(Math.random() * 15) + 20; // 20-35
      pm10 = Math.floor(Math.random() * 25) + 40; // 40-65
      grade = "보통";
    } else {
      pm25 = Math.floor(Math.random() * 15) + 10; // 10-25
      pm10 = Math.floor(Math.random() * 20) + 20; // 20-40
      grade = "좋음";
    }

    return {
      pm25: { value: pm25, grade },
      pm10: { value: pm10, grade },
      overall: { grade },
      location,
      timestamp: new Date().toISOString(),
      source: "estimated",
    };
  }

  /**
   * 🗺️ 지원 도시 목록
   */
  async getSupportedCities() {
    const cities = Object.keys(this.cityMapping).filter(
      (city) => !city.includes("시")
    );
    return this.createSuccessResponse(cities, "지원 도시 목록");
  }

  /**
   * 📦 캐시 관리 메서드들
   */
  getCached(cache, key) {
    const item = cache.get(key);
    if (item && Date.now() - item.timestamp < this.config.cacheTimeout) {
      return item.data;
    }
    cache.delete(key);
    return null;
  }

  setCached(cache, key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 🧹 캐시 정리 스케줄링
   */
  setupCacheCleaning() {
    setInterval(() => {
      this.cleanExpiredCache(this.weatherCache);
      this.cleanExpiredCache(this.dustCache);
      this.cleanExpiredCache(this.forecastCache);
    }, this.config.cacheTimeout);
  }

  /**
   * 🗑️ 만료된 캐시 정리
   */
  cleanExpiredCache(cache) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        cache.delete(key);
      }
    }
  }

  /**
   * 🎭 Mock 데이터 생성
   */
  createMockWeatherData(location) {
    return {
      location,
      temperature: Math.round(15 + Math.random() * 15),
      description: ["맑음", "구름 조금", "흐림", "비"][
        Math.floor(Math.random() * 4)
      ],
      humidity: Math.round(40 + Math.random() * 40),
      windSpeed: Math.round(Math.random() * 10),
      feelsLike: Math.round(15 + Math.random() * 15),
      icon: "☀️",
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
    };
  }

  createMockForecastData(location) {
    const days = [];
    for (let i = 0; i < 5; i++) {
      days.push({
        date: TimeHelper.format(new Date(Date.now() + i * 86400000), "MM/DD"),
        tempMin: Math.round(10 + Math.random() * 10),
        tempMax: Math.round(20 + Math.random() * 10),
        description: ["맑음", "구름", "비", "흐림"][
          Math.floor(Math.random() * 4)
        ],
        icon: ["☀️", "⛅", "🌧️", "☁️"][Math.floor(Math.random() * 4)],
      });
    }
    return { location, forecast: days };
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      apiKey: !!this.config.apiKey,
      cacheSize: {
        weather: this.weatherCache.size,
        dust: this.dustCache.size,
        forecast: this.forecastCache.size,
      },
      stats: this.stats,
      supportedCities: Object.keys(this.cityMapping).length,
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    this.weatherCache.clear();
    this.dustCache.clear();
    this.forecastCache.clear();
    await super.cleanup();
    logger.info("✅ WeatherService 정리 완료");
  }
}

module.exports = WeatherService;
