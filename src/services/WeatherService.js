const { getInstance } = require("../database/DatabaseManager");

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class WeatherService {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.dbManager = getInstance(); // 👈 이 부분!

    this.defaultLocation = options.defaultLocation || "서울";
    this.config = {
      enableCache: true,
      cacheTimeout: 600000, // 10분
      ...options.config,
    };

    this.cache = new Map();
    this.cacheTimestamps = new Map();

    logger.service("WeatherService", "서비스 생성");
  }

  async initialize() {
    await this.dbManager.ensureConnection(); // 👈 이 부분!

    if (!this.apiKey) {
      logger.warn("날씨 API 키가 설정되지 않음");
    }
    logger.success("WeatherService 초기화 완료");
  }

  async getCurrentWeather(location = null) {
    const loc = location || this.defaultLocation;
    const cacheKey = `weather_${loc}`;

    if (this.config.enableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      // 실제 API 호출 대신 더미 데이터
      const weather = {
        location: loc,
        temperature: 22,
        description: "맑음",
        icon: "☀️",
        humidity: 60,
        windSpeed: 2.5,
        pressure: 1013,
      };

      if (this.config.enableCache) {
        this.saveToCache(cacheKey, weather);
      }

      logger.data("weather", "current", null, { location: loc });
      return weather;
    } catch (error) {
      logger.error("현재 날씨 조회 실패", error);
      throw error;
    }
  }

  async getDustInfo(location = null) {
    const loc = location || this.defaultLocation;

    try {
      const dust = {
        location: loc,
        pm25: "좋음",
        pm10: "보통",
        icon: "😊",
      };

      logger.data("weather", "dust", null, { location: loc });
      return dust;
    } catch (error) {
      logger.error("미세먼지 조회 실패", error);
      throw error;
    }
  }

  getFromCache(key) {
    if (!this.config.enableCache) return null;
    const data = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);
    if (
      data &&
      timestamp &&
      Date.now() - timestamp < this.config.cacheTimeout
    ) {
      return data;
    }
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return null;
  }

  saveToCache(key, data) {
    if (!this.config.enableCache) return;
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  async cleanup() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.info("WeatherService 정리 완료");
  }
}

module.exports = WeatherService;
