// src/services/WeatherService.js - ServiceBuilder 호환 + GPS 위치 기반

const WeatherHelper = require("../utils/WeatherHelper");
const AirQualityHelper = require("../utils/AirQualityHelper");
const Weather = require("../database/models/Weather");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const axios = require("axios");

/**
 * 🌤️ WeatherService - ServiceBuilder 호환 + GPS 기반 위치
 *
 * 🎯 주요 기능:
 * - ServiceBuilder 패턴 준수
 * - GPS 기반 자동 위치 감지
 * - 날씨 + 미세먼지 통합
 * - 사용자별 위치 캐싱
 */
class WeatherService {
  constructor(options = {}) {
    // ServiceBuilder 호환 구조
    this.db = options.db;
    this.dbManager = options.dbManager;
    this.config = {
      // 🌏 GPS 기반 설정
      enableGPS: true,
      fallbackLocation: "화성시", // GPS 실패시 기본값
      ipApiUrl: "https://ipapi.co/json/",

      // 날씨 설정
      apiKey:
        options.config?.apiKey ||
        process.env.WEATHER_API_KEY ||
        process.env.OPENWEATHERMAP_API_KEY,
      cacheTimeout: 10 * 60 * 1000, // 10분
      enableDust: true,
      enableWeather: true,

      ...options.config,
    };

    // 헬퍼들
    this.weatherHelper = null;
    this.airQualityHelper = null;

    // 📍 사용자별 위치 캐시 (메모리 기반)
    this.userLocationCache = new Map();
    this.locationCacheTimeout = 60 * 60 * 1000; // 1시간

    // 📊 통계
    this.stats = {
      weatherRequests: 0,
      dustRequests: 0,
      gpsRequests: 0,
      locationCacheHits: 0,
      errors: 0,
      lastUpdate: null,
    };

    this.isInitialized = false;

    logger.info("🌤️ WeatherService 생성됨 (ServiceBuilder + GPS)", {
      hasApiKey: !!this.config.apiKey,
      enableGPS: this.config.enableGPS,
      fallbackLocation: this.config.fallbackLocation,
    });
  }

  /**
   * ✅ ServiceBuilder 호환 초기화
   */
  async initialize() {
    try {
      logger.info("🌤️ WeatherService 초기화 시작 (ServiceBuilder)...");

      // 날씨 헬퍼 초기화
      if (this.config.enableWeather) {
        this.weatherHelper = new WeatherHelper(this.config.apiKey, {
          cacheTimeout: this.config.cacheTimeout,
        });
        logger.info("✅ WeatherHelper 초기화됨");
      }

      // 미세먼지 헬퍼 초기화
      if (this.config.enableDust) {
        this.airQualityHelper = new AirQualityHelper();
        logger.info("✅ AirQualityHelper 초기화됨");
      }

      this.isInitialized = true;
      logger.success("✅ WeatherService 초기화 완료 (GPS 기능 포함)");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌍 GPS 기반 현재 위치 감지 (핵심 기능!)
   */
  async getCurrentLocation(userId = null, forceRefresh = false) {
    try {
      // 캐시 확인 (사용자별)
      if (userId && !forceRefresh) {
        const cacheKey = `location_${userId}`;
        const cached = this.getLocationCache(cacheKey);
        if (cached) {
          this.stats.locationCacheHits++;
          logger.info(
            `📦 캐시된 위치 사용: ${cached.city} (사용자: ${userId})`
          );
          return { success: true, data: cached, source: "cache" };
        }
      }

      if (!this.config.enableGPS) {
        logger.info("🚫 GPS 비활성화 - 기본 위치 사용");
        return {
          success: true,
          data: {
            city: this.config.fallbackLocation,
            region: "경기도",
            country: "KR",
            source: "fallback",
          },
          source: "fallback",
        };
      }

      this.stats.gpsRequests++;
      logger.info("🌍 IP 기반 위치 감지 시작...");

      // IP API를 통한 위치 감지
      const response = await axios.get(this.config.ipApiUrl, {
        timeout: 5000,
        headers: {
          "User-Agent": "DoomockBot/1.0 (Weather Service)",
        },
      });

      const locationData = response.data;

      if (!locationData || !locationData.city) {
        throw new Error("위치 정보를 찾을 수 없습니다");
      }

      // 한국 위치인지 확인
      const isKorea =
        locationData.country_code === "KR" ||
        locationData.country === "South Korea";

      const detectedLocation = {
        city: isKorea ? locationData.city : this.config.fallbackLocation,
        region: isKorea ? locationData.region : "경기도",
        country: isKorea ? "KR" : locationData.country_code || "KR",
        latitude: locationData.latitude || 37.1989,
        longitude: locationData.longitude || 127.0056,
        timezone: locationData.timezone || "Asia/Seoul",
        source: "gps",
        detectedAt: new Date().toISOString(),
      };

      // 🇰🇷 한국이 아닌 경우 기본 위치 사용
      if (!isKorea) {
        logger.warn(
          `⚠️ 해외 위치 감지됨 (${locationData.country}), 기본 위치 사용`
        );
        detectedLocation.city = this.config.fallbackLocation;
        detectedLocation.source = "fallback_foreign";
      }

      // 사용자별 위치 캐싱
      if (userId) {
        this.setLocationCache(`location_${userId}`, detectedLocation);
      }

      logger.success(
        `✅ 위치 감지 성공: ${detectedLocation.city}, ${detectedLocation.region}`
      );

      return {
        success: true,
        data: detectedLocation,
        source: "gps",
      };
    } catch (error) {
      logger.warn("⚠️ GPS 위치 감지 실패, 기본 위치 사용:", error.message);

      // GPS 실패시 기본 위치 반환
      const fallbackLocation = {
        city: this.config.fallbackLocation,
        region: "경기도",
        country: "KR",
        latitude: 37.1989,
        longitude: 127.0056,
        source: "fallback_error",
        error: error.message,
      };

      return {
        success: true,
        data: fallbackLocation,
        source: "fallback",
      };
    }
  }

  /**
   * 🌤️ 현재 날씨 조회 (GPS 위치 기반)
   */
  async getCurrentWeather(location = null, userId = null) {
    try {
      this.stats.weatherRequests++;

      let targetLocation = location;

      // 위치가 지정되지 않으면 GPS로 자동 감지
      if (!targetLocation) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation = locationResult.data.city;
          logger.info(`🌍 GPS 위치 기반 날씨 조회: ${targetLocation}`);
        } else {
          targetLocation = this.config.fallbackLocation;
          logger.warn(`⚠️ GPS 실패, 기본 위치 사용: ${targetLocation}`);
        }
      }

      // WeatherHelper를 통해 날씨 정보 조회
      const weatherResult = await this.weatherHelper.getCurrentWeather(
        targetLocation
      );

      this.stats.lastUpdate = TimeHelper.now();

      if (weatherResult.success) {
        logger.success(
          `✅ 날씨 조회 성공: ${targetLocation} (${weatherResult.source})`
        );

        return {
          success: true,
          data: {
            ...weatherResult.data,
            autoDetectedLocation: !location, // GPS로 자동 감지했는지 표시
            detectionMethod: !location ? "gps" : "manual",
          },
          location: targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: weatherResult.source,
        };
      } else {
        // WeatherHelper에서 폴백 데이터를 제공하는 경우
        if (weatherResult.data) {
          logger.warn(
            `⚠️ 날씨 API 실패, 폴백 데이터 사용: ${weatherResult.error}`
          );

          return {
            success: true,
            data: {
              ...weatherResult.data,
              autoDetectedLocation: !location,
              detectionMethod: !location ? "gps" : "manual",
            },
            location: targetLocation,
            timestamp: TimeHelper.format(TimeHelper.now(), "full"),
            source: "fallback",
            warning: weatherResult.error,
          };
        }

        throw new Error(
          weatherResult.error || "날씨 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ 현재 날씨 조회 실패:", error);

      return {
        success: false,
        error: error.message,
        data: Weather.createFallbackWeather(
          location || this.config.fallbackLocation
        ),
      };
    }
  }

  /**
   * 🌬️ 미세먼지 정보 조회 (GPS 위치 기반)
   */
  async getDustInfo(location = null, userId = null) {
    try {
      this.stats.dustRequests++;

      let targetLocation = location;

      // 위치가 지정되지 않으면 GPS로 자동 감지
      if (!targetLocation) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation = locationResult.data.city;
          logger.info(`🌍 GPS 위치 기반 미세먼지 조회: ${targetLocation}`);
        } else {
          targetLocation = this.config.fallbackLocation;
        }
      }

      if (!this.config.enableDust || !this.airQualityHelper) {
        throw new Error("미세먼지 서비스가 비활성화됨");
      }

      // AirQualityHelper를 통해 미세먼지 정보 조회
      const dustResult = await this.airQualityHelper.getCurrentAirQuality(
        targetLocation
      );

      this.stats.lastUpdate = TimeHelper.now();

      if (dustResult.success) {
        logger.success(
          `✅ 미세먼지 조회 성공: ${targetLocation} (${dustResult.source})`
        );

        return {
          success: true,
          data: {
            ...this.formatDustResponse(dustResult.data),
            autoDetectedLocation: !location,
            detectionMethod: !location ? "gps" : "manual",
          },
          location: targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: dustResult.source,
        };
      } else {
        throw new Error(
          dustResult.error || "미세먼지 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ 미세먼지 정보 조회 실패:", error);

      return {
        success: false,
        error: error.message,
        data: this.getFallbackDustData(
          location || this.config.fallbackLocation
        ),
      };
    }
  }

  /**
   * 📦 위치 캐시 관리
   */
  getLocationCache(key) {
    const cached = this.userLocationCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.locationCacheTimeout) {
      return cached.data;
    }
    this.userLocationCache.delete(key);
    return null;
  }

  setLocationCache(key, data) {
    this.userLocationCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 🎨 미세먼지 응답 포맷팅 (기존 로직 유지)
   */
  formatDustResponse(dustData) {
    if (!dustData) return null;

    return {
      location: dustData.location,
      timestamp: dustData.timestamp,
      pm25: dustData.pm25,
      pm10: dustData.pm10,
      overall: dustData.overall,
      advice: dustData.advice,
      others: dustData.others,
      meta: dustData.meta,
      summary: this.createDustSummary(dustData),
    };
  }

  createDustSummary(dustData) {
    const pm25Grade = dustData.pm25.grade;
    const pm10Grade = dustData.pm10.grade;
    const overallEmoji = dustData.overall.emoji;

    let summary = `${overallEmoji} ${dustData.location} 미세먼지 상태: ${dustData.overall.grade}`;

    if (pm25Grade === pm10Grade) {
      summary += `\n초미세먼지(PM2.5)와 미세먼지(PM10) 모두 '${pm25Grade}' 수준입니다.`;
    } else {
      summary += `\n초미세먼지(PM2.5): ${pm25Grade}, 미세먼지(PM10): ${pm10Grade}`;
    }

    return summary;
  }

  getFallbackDustData(location) {
    return {
      location: location,
      pm25: { value: "측정불가", grade: "정보없음", emoji: "❓" },
      pm10: { value: "측정불가", grade: "정보없음", emoji: "❓" },
      overall: { grade: "정보없음", emoji: "❓" },
      advice: "현재 미세먼지 정보를 확인할 수 없습니다",
      summary: "❓ 미세먼지 정보 확인 불가",
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
    };
  }

  /**
   * 📊 ServiceBuilder 호환 상태 조회
   */
  getStatus() {
    return {
      serviceName: "WeatherService",
      isInitialized: this.isInitialized,
      config: this.getMaskedConfig(),
      stats: {
        ...this.stats,
        locationCacheSize: this.userLocationCache.size,
      },
      features: {
        weather: this.config.enableWeather,
        dust: this.config.enableDust,
        gps: this.config.enableGPS,
      },
    };
  }

  getMaskedConfig() {
    const masked = { ...this.config };
    if (masked.apiKey) {
      const value = String(masked.apiKey);
      masked.apiKey =
        value.length > 4
          ? value.substring(0, 2) + "***" + value.substring(value.length - 2)
          : "***";
    }
    return masked;
  }

  /**
   * 🧹 ServiceBuilder 호환 정리
   */
  async cleanup() {
    try {
      this.userLocationCache.clear();
      if (
        this.weatherHelper &&
        typeof this.weatherHelper.clearCache === "function"
      ) {
        this.weatherHelper.clearCache();
      }
      if (
        this.airQualityHelper &&
        typeof this.airQualityHelper.clearCache === "function"
      ) {
        this.airQualityHelper.clearCache();
      }
      logger.info("✅ WeatherService 정리 완료");
    } catch (error) {
      logger.error("❌ WeatherService 정리 실패:", error);
    }
  }
}

module.exports = WeatherService;
