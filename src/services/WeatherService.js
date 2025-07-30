// src/services/WeatherService.js - GPS 기반 날씨 서비스 완전판

const WeatherHelper = require("../utils/WeatherHelper");
const AirQualityHelper = require("../utils/AirQualityHelper");
const LocationHelper = require("../utils/LocationHelper");
const UserLocation = require("../database/models/Weather");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherService - GPS 기반 날씨 서비스
 *
 * 주요 기능:
 * - GPS 좌표 기반 위치 감지
 * - 사용자별 위치 저장
 * - 날씨 및 미세먼지 정보 제공
 * - 캐시 관리
 */
class WeatherService {
  constructor(options = {}) {
    // 설정
    this.config = {
      defaultLocation: process.env.DEFAULT_LOCATION || "수원시", // 기본 도시 수원시
      defaultRegion: process.env.DEFAULT_REGION || "경기도",
      enableGPS: true,
      enableWeather: true,
      enableDust: true,
      weatherApiKey: options.config?.apiKey || process.env.WEATHER_API_KEY,
      airKoreaApiKey: process.env.AIR_KOREA_API_KEY,
      kakaoApiKey: process.env.KAKAO_API_KEY,
      cacheTimeout: 10 * 60 * 1000, // 10분
      locationCacheTimeout: 60 * 60 * 1000, // 1시간
      ...options.config,
    };

    // 헬퍼 인스턴스
    this.weatherHelper = null;
    this.airQualityHelper = null;
    this.locationHelper = new LocationHelper();

    // 캐시
    this.cache = new Map();
    this.userLocationCache = new Map();

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

    logger.info("🌤️ WeatherService 생성됨", {
      defaultLocation: this.config.defaultLocation,
      hasWeatherKey: !!this.config.weatherApiKey,
      hasKakaoKey: !!this.config.kakaoApiKey,
    });
  }

  /**
   * ✅ 서비스 초기화
   */
  async initialize() {
    try {
      logger.info("🌤️ WeatherService 초기화 시작...");

      // WeatherHelper 초기화
      if (this.config.enableWeather) {
        this.weatherHelper = new WeatherHelper(this.config.weatherApiKey, {
          cacheTimeout: this.config.cacheTimeout,
        });
        logger.info("✅ WeatherHelper 초기화됨");
      }

      // AirQualityHelper 초기화
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
   * 🌍 현재 위치 감지 (GPS 우선)
   */
  async getCurrentLocation(
    userId = null,
    forceRefresh = false,
    gpsCoords = null
  ) {
    this.stats.gpsRequests++;

    try {
      // 1. GPS 좌표가 제공되면 최우선 사용
      if (gpsCoords && gpsCoords.latitude && gpsCoords.longitude) {
        logger.info(
          `🛰️ GPS 좌표 사용: ${gpsCoords.latitude}, ${gpsCoords.longitude}`
        );

        const location = await this.locationHelper.getAddressFromGPS(
          gpsCoords.latitude,
          gpsCoords.longitude
        );

        // 캐시 업데이트
        if (userId) {
          this.userLocationCache.set(userId, {
            location,
            timestamp: Date.now(),
          });
        }

        return {
          success: true,
          data: location,
          source: "gps",
          coords: gpsCoords,
        };
      }

      // 2. 캐시 확인 (GPS가 없을 때만)
      if (!forceRefresh && userId) {
        const cached = this.userLocationCache.get(userId);
        if (
          cached &&
          Date.now() - cached.timestamp < this.config.locationCacheTimeout
        ) {
          this.stats.locationCacheHits++;
          logger.info(`📦 캐시된 위치 사용: ${cached.location.city}`);
          return { success: true, data: cached.location, source: "cache" };
        }
      }

      // 3. DB에서 저장된 위치 확인
      if (userId) {
        const savedLocation = await this.getUserSavedLocation(userId);
        if (savedLocation) {
          logger.info(`💾 저장된 위치 사용: ${savedLocation.location.city}`);

          const locationData = savedLocation.toSimpleObject();

          // 캐시 업데이트
          this.userLocationCache.set(userId, {
            location: locationData,
            timestamp: Date.now(),
          });

          return {
            success: true,
            data: locationData,
            source: "saved",
          };
        }
      }

      // 4. 기본 위치 사용
      const location = await this.locationHelper.detectLocation(userId);

      if (userId && location.city) {
        this.userLocationCache.set(userId, { location, timestamp: Date.now() });
      }

      logger.info(`📍 위치 감지: ${location.city} (${location.method})`);
      return { success: true, data: location, source: location.method };
    } catch (error) {
      logger.error("위치 감지 실패:", error);

      // 실패 시 기본값 반환
      const defaultLocation = this.locationHelper.getDefaultLocation();
      return {
        success: true,
        data: defaultLocation,
        source: "default",
        error: error.message,
      };
    }
  }

  /**
   * 🌤️ 현재 날씨 조회 (GPS 지원)
   */
  async getCurrentWeather(location = null, userId = null, gpsCoords = null) {
    this.stats.weatherRequests++;

    try {
      let targetLocation = location;
      let locationInfo = {};

      if (!targetLocation) {
        // GPS 좌표 또는 저장된 위치 사용
        const locationResult = await this.getCurrentLocation(
          userId,
          false,
          gpsCoords
        );

        if (locationResult.success) {
          targetLocation =
            locationResult.data.city || locationResult.data.fullAddress;
          locationInfo = {
            ...locationResult.data,
            source: locationResult.source,
            coords: locationResult.coords,
          };
        } else {
          throw new Error("위치를 확인할 수 없습니다");
        }
      }

      // 캐시 확인
      const cacheKey = `weather_${targetLocation}`;
      const cached = this.getCache(cacheKey);
      if (cached) {
        logger.debug(`📦 캐시된 날씨 데이터 사용: ${targetLocation}`);
        return {
          success: true,
          data: {
            ...cached,
            locationInfo,
            autoDetectedLocation: locationInfo.source !== "saved",
          },
          location: targetLocation,
          fullAddress: locationInfo.fullAddress || targetLocation,
          timestamp: TimeHelper.now().toISOString(),
          source: "cache",
        };
      }

      // 날씨 데이터 가져오기
      const weatherData = await this.weatherHelper.getWeather(targetLocation);

      if (!weatherData) {
        throw new Error("날씨 정보를 가져올 수 없습니다");
      }

      // 좌표가 있으면 더 정확한 날씨 정보 가져오기
      if (locationInfo.coords || (locationInfo.lat && locationInfo.lon)) {
        const coords = locationInfo.coords || {
          latitude: locationInfo.lat,
          longitude: locationInfo.lon,
        };

        // OpenWeatherMap API가 좌표를 지원한다면 사용
        const coordWeather = await this.weatherHelper.getWeatherByCoords(
          coords.latitude,
          coords.longitude
        );

        if (coordWeather) {
          weatherData.coordBased = true;
          weatherData.accuracy = "high";
          // 좌표 기반 날씨 데이터 병합
          Object.assign(weatherData, coordWeather);
        }
      }

      // 캐시 저장
      this.setCache(cacheKey, weatherData);
      this.stats.lastUpdate = Date.now();

      return {
        success: true,
        data: {
          ...weatherData,
          locationInfo,
          autoDetectedLocation: locationInfo.source !== "saved",
        },
        location: targetLocation,
        fullAddress: locationInfo.fullAddress || targetLocation,
        timestamp: TimeHelper.now().toISOString(),
        source: locationInfo.source || "api",
        warning: null,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error("날씨 조회 실패:", error);

      // 폴백 데이터 제공
      const fallbackData = this.createFallbackWeatherData(
        location || this.config.defaultLocation
      );

      return {
        success: true,
        data: fallbackData,
        location: location || this.config.defaultLocation,
        source: "fallback",
        error: error.message,
      };
    }
  }

  /**
   * 🌬️ 미세먼지 정보 조회 (GPS 지원)
   */
  async getDustInfo(location = null, userId = null, gpsCoords = null) {
    this.stats.dustRequests++;

    try {
      let targetLocation = location;
      let locationInfo = {};

      if (!targetLocation) {
        // GPS 좌표 또는 저장된 위치 사용
        const locationResult = await this.getCurrentLocation(
          userId,
          false,
          gpsCoords
        );

        if (locationResult.success) {
          targetLocation =
            locationResult.data.city || locationResult.data.fullAddress;
          locationInfo = {
            ...locationResult.data,
            source: locationResult.source,
            coords: locationResult.coords,
          };
        } else {
          throw new Error("위치를 확인할 수 없습니다");
        }
      }

      // 캐시 확인
      const cacheKey = `dust_${targetLocation}`;
      const cached = this.getCache(cacheKey);
      if (cached) {
        logger.debug(`📦 캐시된 미세먼지 데이터 사용: ${targetLocation}`);
        return {
          success: true,
          data: {
            ...cached,
            locationInfo,
            autoDetectedLocation: locationInfo.source !== "saved",
          },
          location: targetLocation,
          fullAddress: locationInfo.fullAddress || targetLocation,
          timestamp: TimeHelper.now().toISOString(),
          source: "cache",
        };
      }

      // 미세먼지 정보 가져오기
      const dustData = await this.airQualityHelper.getAirQuality(
        targetLocation
      );

      if (!dustData) {
        throw new Error("미세먼지 정보를 가져올 수 없습니다");
      }

      // GPS 좌표가 있으면 가장 가까운 측정소 찾기
      if (locationInfo.coords || (locationInfo.lat && locationInfo.lon)) {
        const coords = locationInfo.coords || {
          latitude: locationInfo.lat,
          longitude: locationInfo.lon,
        };

        const nearestStation = await this.airQualityHelper.findNearestStation(
          coords.latitude,
          coords.longitude
        );

        if (nearestStation) {
          dustData.station = nearestStation.stationName;
          dustData.distance = nearestStation.distance;
          dustData.accuracy = "high";
        }
      }

      // 캐시 저장
      this.setCache(cacheKey, dustData);
      this.stats.lastUpdate = Date.now();

      return {
        success: true,
        data: {
          ...dustData,
          locationInfo,
          autoDetectedLocation: locationInfo.source !== "saved",
        },
        location: targetLocation,
        fullAddress: locationInfo.fullAddress || targetLocation,
        timestamp: TimeHelper.now().toISOString(),
        source: locationInfo.source || "api",
        warning: dustData.warning || null,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error("미세먼지 조회 실패:", error);

      // 폴백 데이터 제공
      const fallbackData = this.createFallbackDustData(
        location || this.config.defaultLocation
      );

      return {
        success: true,
        data: fallbackData,
        location: location || this.config.defaultLocation,
        source: "fallback",
        error: error.message,
      };
    }
  }

  /**
   * 🌍 통합 날씨 정보 조회 (GPS 지원)
   */
  async getCompleteWeatherInfo(
    location = null,
    userId = null,
    gpsCoords = null
  ) {
    try {
      // 위치 정보 한 번만 조회
      const locationResult = await this.getCurrentLocation(
        userId,
        false,
        gpsCoords
      );

      if (!locationResult.success) {
        throw new Error("위치를 확인할 수 없습니다");
      }

      const targetLocation = location || locationResult.data.city;
      const locationInfo = locationResult.data;

      // 병렬로 날씨와 미세먼지 정보 조회
      const [weatherResult, dustResult] = await Promise.all([
        this.getCurrentWeather(targetLocation, userId, gpsCoords),
        this.getDustInfo(targetLocation, userId, gpsCoords),
      ]);

      return {
        success: true,
        weather: weatherResult.data,
        dust: dustResult.data,
        location: targetLocation,
        fullAddress: locationInfo.fullAddress || targetLocation,
        timestamp: TimeHelper.now().toISOString(),
        source: locationInfo.source || "api",
        locationInfo,
        autoDetectedLocation: locationInfo.source !== "saved",
      };
    } catch (error) {
      logger.error("통합 날씨 정보 조회 실패:", error);
      return {
        success: false,
        error: error.message,
        location: location || this.config.defaultLocation,
      };
    }
  }

  /**
   * 📍 사용자 위치 저장
   */
  async saveUserLocation(userId, username, locationData) {
    try {
      const saved = await UserLocation.setUserLocation(userId, username, {
        city: locationData.city,
        district: locationData.district || "",
        region: locationData.region,
        fullAddress: locationData.fullAddress,
        lat: locationData.lat,
        lon: locationData.lon,
        method: locationData.method || "manual",
      });

      // 캐시 업데이트
      this.userLocationCache.set(userId, {
        location: locationData,
        timestamp: Date.now(),
      });

      logger.info(`✅ 사용자 위치 저장: ${username} → ${locationData.city}`);
      return saved;
    } catch (error) {
      logger.error("사용자 위치 저장 실패:", error);
      throw error;
    }
  }

  /**
   * 📍 저장된 사용자 위치 조회
   */
  async getUserSavedLocation(userId) {
    try {
      return await UserLocation.getUserLocation(userId);
    } catch (error) {
      logger.error("사용자 위치 조회 실패:", error);
      return null;
    }
  }

  /**
   * ❌ 사용자 위치 삭제
   */
  async removeUserLocation(userId) {
    try {
      await UserLocation.removeUserLocation(userId);

      // 캐시에서도 삭제
      this.userLocationCache.delete(userId);

      logger.info(`✅ 사용자 위치 삭제: ${userId}`);
    } catch (error) {
      logger.error("사용자 위치 삭제 실패:", error);
      throw error;
    }
  }

  /**
   * 🗺️ 가장 가까운 측정소 찾기
   */
  async findNearestStation(latitude, longitude) {
    if (!this.airQualityHelper) {
      return null;
    }

    return await this.airQualityHelper.findNearestStation(latitude, longitude);
  }

  /**
   * 📦 캐시 관리
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache() {
    this.cache.clear();
    this.userLocationCache.clear();
    logger.info("📦 WeatherService 캐시 정리됨");
  }

  /**
   * 🔄 폴백 데이터 생성
   */
  createFallbackWeatherData(location) {
    return {
      temperature: 20,
      feels_like: 18,
      humidity: 60,
      description: "맑음",
      icon: "☀️",
      wind_speed: 2.5,
      location: location,
      isFallback: true,
      message: "실시간 날씨 정보를 가져올 수 없어 기본값을 표시합니다",
    };
  }

  createFallbackDustData(location) {
    return {
      pm10: { value: 50, grade: "보통", emoji: "😊" },
      pm25: { value: 25, grade: "보통", emoji: "😊" },
      station: location,
      dataTime: TimeHelper.now().toISOString(),
      isFallback: true,
      message: "실시간 미세먼지 정보를 가져올 수 없어 기본값을 표시합니다",
    };
  }

  /**
   * 📊 서비스 상태 조회
   */
  async getStatus() {
    const status = {
      initialized: this.isInitialized,
      config: {
        defaultLocation: this.config.defaultLocation,
        enableGPS: this.config.enableGPS,
        enableWeather: this.config.enableWeather,
        enableDust: this.config.enableDust,
      },
      stats: { ...this.stats },
      cache: {
        weatherCache: this.cache.size,
        userLocations: this.userLocationCache.size,
      },
      services: {
        weather: this.weatherHelper ? "Active" : "Inactive",
        dust: this.airQualityHelper ? "Active" : "Inactive",
        location: "Active",
      },
      lastUpdate: this.stats.lastUpdate
        ? TimeHelper.format(new Date(this.stats.lastUpdate), "full")
        : "없음",
    };

    // 각 헬퍼의 상태도 포함
    if (this.weatherHelper) {
      status.weatherHelper = await this.weatherHelper.getStatus();
    }

    if (this.airQualityHelper) {
      status.airQualityHelper = this.airQualityHelper.getStatus();
    }

    if (this.locationHelper) {
      status.locationHelper = this.locationHelper.getCacheStats();
    }

    return status;
  }
}

module.exports = WeatherService;
