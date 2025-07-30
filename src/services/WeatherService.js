// src/services/WeatherService.js - 메서드 이름 수정 버전

const WeatherHelper = require("../utils/WeatherHelper");
const AirQualityHelper = require("../utils/AirQualityHelper");
const Weather = require("../database/models/Weather");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const LocationHelper = require("../utils/LocationHelper");

/**
 * 🌤️ WeatherService - GPS 기반 위치 서비스 개선 (SoC 준수)
 */
class WeatherService {
  constructor(options = {}) {
    // ServiceBuilder 호환 구조
    this.config = {
      enableGPS: true,
      fallbackLocation: "화성시",
      apiKey:
        options.config?.apiKey ||
        process.env.WEATHER_API_KEY ||
        process.env.OPEN_WEATHER_API_KEY,
      cacheTimeout: 10 * 60 * 1000, // 10분
      enableDust: true,
      enableWeather: true,
      ...options.config,
    };

    // 헬퍼 클래스 인스턴스화
    this.weatherHelper = null;
    this.airQualityHelper = null;
    this.locationHelper = new LocationHelper();

    // 사용자 위치 관련 캐시
    this.userLocationSettings = new Map();
    this.userLocationCache = new Map();
    this.locationCacheTimeout = 60 * 60 * 1000; // 1시간

    // 통계
    this.stats = {
      weatherRequests: 0,
      dustRequests: 0,
      gpsRequests: 0,
      locationCacheHits: 0,
      errors: 0,
      lastUpdate: null,
    };

    this.isInitialized = false;

    logger.info("🌤️ WeatherService 생성됨 (표준 준수)", {
      hasApiKey: !!this.config.apiKey,
      enableGPS: this.config.enableGPS,
    });
  }

  /**
   * ✅ 서비스 초기화 (표준 준수)
   */
  async initialize() {
    try {
      logger.info("🌤️ WeatherService 초기화 시작...");

      if (this.config.enableWeather) {
        this.weatherHelper = new WeatherHelper(this.config.apiKey, {
          cacheTimeout: this.config.cacheTimeout,
        });
        logger.info("✅ WeatherHelper 초기화됨");
      }

      if (this.config.enableDust) {
        this.airQualityHelper = new AirQualityHelper();
        logger.info("✅ AirQualityHelper 초기화됨");
      }

      this.isInitialized = true;
      logger.success("✅ WeatherService 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌍 현재 위치 감지
   */
  async getCurrentLocation(userId = null, forceRefresh = false) {
    this.stats.gpsRequests++;

    if (!forceRefresh && userId) {
      const cached = this.userLocationCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.locationCacheTimeout) {
        this.stats.locationCacheHits++;
        logger.info(`📦 캐시된 위치 사용: ${cached.location.city}`);
        return { success: true, data: cached.location, source: "cache" };
      }
    }

    const location = await this.locationHelper.detectLocation(userId);

    if (userId && location.city) {
      this.userLocationCache.set(userId, { location, timestamp: Date.now() });
    }

    logger.info(`📍 위치 감지: ${location.city} (${location.method})`);
    return { success: true, data: location, source: location.method };
  }

  /**
   * 🌤️ 현재 날씨 조회
   */
  async getCurrentWeather(location = null, userId = null) {
    this.stats.weatherRequests++;
    try {
      let targetLocation = location;
      let locationInfo = {};

      if (!targetLocation && userId) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation =
            locationResult.data.simpleCity || locationResult.data.city;
          locationInfo = {
            fullAddress: `${locationResult.data.city} ${
              locationResult.data.district || ""
            }`.trim(),
            method: locationResult.data.method,
            isGPSDetected: true,
          };
        } else {
          targetLocation = this.config.fallbackLocation;
          locationInfo = {
            fullAddress: targetLocation,
            method: "default",
            isGPSDetected: false,
          };
        }
      } else {
        locationInfo = {
          fullAddress: targetLocation,
          method: "manual",
          isGPSDetected: false,
        };
      }

      // ✅ 올바른 메서드 호출
      const weatherResult = await this.weatherHelper.getCurrentWeather(
        targetLocation
      );
      this.stats.lastUpdate = TimeHelper.now();

      if (weatherResult.success) {
        return {
          success: true,
          data: { ...weatherResult.data, locationInfo },
          location: targetLocation,
          fullAddress: locationInfo.fullAddress,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: weatherResult.source,
        };
      } else {
        return {
          success: true, // 폴백 데이터도 성공으로 처리
          data: { ...weatherResult.data, locationInfo },
          location: targetLocation,
          fullAddress: locationInfo.fullAddress,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: "fallback",
          warning: weatherResult.error,
        };
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ 현재 날씨 조회 서비스 오류:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🌬️ 미세먼지 정보 조회
   */
  async getDustInfo(location = null, userId = null) {
    this.stats.dustRequests++;
    try {
      let targetLocation = location;
      let locationInfo = {};

      if (!targetLocation && userId) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation =
            locationResult.data.simpleCity || locationResult.data.city;
          locationInfo = {
            fullAddress: `${locationResult.data.city} ${
              locationResult.data.district || ""
            }`.trim(),
            method: locationResult.data.method,
            isGPSDetected: true,
          };
        } else {
          targetLocation = this.config.fallbackLocation;
          locationInfo = {
            fullAddress: targetLocation,
            method: "default",
            isGPSDetected: false,
          };
        }
      } else {
        locationInfo = {
          fullAddress: targetLocation,
          method: "manual",
          isGPSDetected: false,
        };
      }

      // ✅ 올바른 메서드 호출
      const dustResult = await this.airQualityHelper.getCurrentAirQuality(
        targetLocation
      );
      this.stats.lastUpdate = TimeHelper.now();

      return {
        success: true,
        data: { ...dustResult.data, locationInfo },
        location: targetLocation,
        fullAddress: locationInfo.fullAddress,
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        source: dustResult.source,
        warning: dustResult.warning,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ 미세먼지 조회 서비스 오류:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🌍 통합 정보 조회
   */
  async getCompleteWeatherInfo(location = null, userId = null) {
    try {
      let targetLocation = location;
      let locationInfo = {};

      if (!targetLocation && userId) {
        const locationResult = await this.getCurrentLocation(userId);
        targetLocation = locationResult.success
          ? locationResult.data.simpleCity || locationResult.data.city
          : this.config.fallbackLocation;
        locationInfo = locationResult.success
          ? {
              fullAddress: `${locationResult.data.city} ${
                locationResult.data.district || ""
              }`.trim(),
              method: locationResult.data.method,
              isGPSDetected: true,
            }
          : {
              fullAddress: targetLocation,
              method: "default",
              isGPSDetected: false,
            };
      } else {
        locationInfo = {
          fullAddress: targetLocation,
          method: "manual",
          isGPSDetected: false,
        };
      }

      const [weatherResult, dustResult] = await Promise.all([
        this.getCurrentWeather(targetLocation, null), // 위치를 이미 정했으므로 userId는 null로 전달
        this.getDustInfo(targetLocation, null),
      ]);

      return {
        success: true,
        data: {
          weather: weatherResult.success ? weatherResult.data : null,
          dust: dustResult.success ? dustResult.data : null,
          location: targetLocation,
          fullAddress: locationInfo.fullAddress,
          locationInfo: locationInfo,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        },
        errors: {
          weather: !weatherResult.success ? weatherResult.error : null,
          dust: !dustResult.success ? dustResult.error : null,
        },
      };
    } catch (error) {
      logger.error("통합 날씨 정보 조회 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 서비스 상태 조회 (메서드 이름 통일)
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      stats: this.stats,
      cache: {
        userLocations: this.userLocationCache.size,
      },
      services: {
        weather: this.weatherHelper ? "Active" : "Inactive",
        dust: this.airQualityHelper ? "Active" : "Inactive",
        location: "Active",
      },
      lastUpdate: this.stats.lastUpdate
        ? TimeHelper.format(this.stats.lastUpdate, "full")
        : "없음",
    };
  }

  /**
   * 📊 서비스 상태 조회 (별칭 - 호환성 유지)
   */
  getStatus() {
    return this.getServiceStatus();
  }

  /**
   * 🧹 캐시 정리
   */
  clearLocationCache() {
    const before = this.userLocationCache.size;
    this.userLocationCache.clear();
    logger.info(`📦 위치 캐시 정리됨: ${before}개 항목 삭제`);
  }
}

module.exports = WeatherService;
