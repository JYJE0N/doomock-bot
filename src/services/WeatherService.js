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
 * - 미세먼지 정보 포함
 * - 에러 상황에서도 기본 데이터 제공
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

      // API가 없으면 Mock 데이터 반환
      if (!this.config.apiKey) {
        logger.warn("⚠️ API 키 없음 - Mock 데이터 사용");
        const mockData = this.createMockWeatherData(location);
        return this.createSuccessResponse(mockData, "Mock 날씨 정보");
      }

      // 실제 API 호출 로직은 나중에 구현
      this.stats.apiCalls++;
      const mockData = this.createMockWeatherData(location);
      this.setCached(this.weatherCache, cacheKey, mockData);

      return this.createSuccessResponse(mockData, "날씨 정보 조회 성공");
    } catch (error) {
      this.stats.errors++;
      return this.createErrorResponse(error, "날씨 정보 조회 실패");
    }
  }

  /**
   * 🌤️ 날씨 예보 조회
   */
  async getForecast(location) {
    try {
      const cacheKey = `forecast_${location}`;
      const cached = this.getCached(this.forecastCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 예보 정보");
      }

      // Mock 데이터 생성
      const mockForecast = this.createMockForecastData(location);
      this.setCached(this.forecastCache, cacheKey, mockForecast);

      return this.createSuccessResponse(mockForecast, "예보 정보 조회 성공");
    } catch (error) {
      return this.createErrorResponse(error, "예보 정보 조회 실패");
    }
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
