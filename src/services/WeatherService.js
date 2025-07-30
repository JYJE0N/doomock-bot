// src/services/WeatherService.js - GPS 기반 위치 개선

const WeatherHelper = require("../utils/WeatherHelper");
const AirQualityHelper = require("../utils/AirQualityHelper");
const Weather = require("../database/models/Weather");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const LocationHelper = require("../utils/LocationHelper");

/**
 * 🌤️ WeatherService - GPS 기반 위치 서비스 개선
 */
class WeatherService {
  constructor(options = {}) {
    // ServiceBuilder 호환 구조
    this.db = options.db;
    this.dbManager = options.dbManager;
    this.config = {
      // 🌏 GPS 기반 설정
      enableGPS: true,
      fallbackLocation: "화성시",

      // 날씨 설정
      apiKey:
        options.config?.apiKey ||
        process.env.WEATHER_API_KEY ||
        process.env.OPEN_WEATHER_API_KEY,
      cacheTimeout: 10 * 60 * 1000, // 10분
      enableDust: true,
      enableWeather: true,

      ...options.config,
    };

    // 헬퍼들
    this.weatherHelper = null;
    this.airQualityHelper = null;
    this.locationHelper = new LocationHelper();

    // 📍 사용자별 위치 캐시
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

    logger.info("🌤️ WeatherService 생성됨 (GPS 개선)", {
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
      logger.info("🌤️ WeatherService 초기화 시작...");

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
      logger.success("✅ WeatherService 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌍 GPS 기반 현재 위치 감지 (개선)
   */
  async getCurrentLocation(userId = null, forceRefresh = false) {
    try {
      this.stats.gpsRequests++;

      // 캐시 확인
      if (!forceRefresh && userId) {
        const cached = this.userLocationCache.get(userId);
        if (
          cached &&
          Date.now() - cached.timestamp < this.locationCacheTimeout
        ) {
          this.stats.locationCacheHits++;
          logger.info(`📦 캐시된 위치 사용: ${cached.location.city}`);
          return {
            success: true,
            data: cached.location,
            source: "cache",
          };
        }
      }

      // LocationHelper로 위치 감지
      const location = await this.locationHelper.detectLocation(userId);

      // 캐시 저장
      if (userId && location.city) {
        this.userLocationCache.set(userId, {
          location: location,
          timestamp: Date.now(),
        });
      }

      logger.info(
        `📍 위치 감지 결과: ${location.city} ${location.district || ""} (${
          location.method
        }, 신뢰도: ${location.confidence})`
      );

      return {
        success: true,
        data: location,
        source: location.method,
      };
    } catch (error) {
      logger.error("위치 감지 실패:", error);
      return {
        success: false,
        error: error.message,
        data: this.locationHelper.getDefaultLocation(),
      };
    }
  }

  /**
   * 🌤️ 현재 날씨 조회 (사용자 설정 위치 우선)
   */
  async getCurrentWeather(location = null, userId = null) {
    try {
      this.stats.weatherRequests++;
      let targetLocation = location;
      let locationInfo = null;

      if (!targetLocation && userId) {
        // 1. 먼저 사용자가 설정한 위치 확인
        const userLocation = await this.getUserSavedLocation(userId);
        if (userLocation) {
          targetLocation = userLocation;
          locationInfo = {
            fullAddress: userLocation,
            method: "user_setting",
          };
          logger.info(`📍 사용자 설정 위치 사용: ${targetLocation}`);
        } else {
          // 2. 설정된 위치가 없으면 자동 감지
          const locationResult = await this.getCurrentLocation(userId);
          if (locationResult.success) {
            targetLocation =
              locationResult.data.simpleCity || locationResult.data.city;
            locationInfo = {
              fullAddress: `${locationResult.data.city} ${
                locationResult.data.district || ""
              }`,
              method: locationResult.data.method,
              coordinates: {
                lat: locationResult.data.lat,
                lon: locationResult.data.lon,
              },
            };
            logger.info(`🌍 자동 감지 위치: ${targetLocation}`);
          } else {
            targetLocation = this.config.fallbackLocation;
          }
        }
      }

      const weatherResult = await this.weatherHelper.getCurrentWeather(
        targetLocation
      );
      this.stats.lastUpdate = TimeHelper.now();

      if (weatherResult.success) {
        logger.success(`✅ 날씨 조회 성공: ${targetLocation}`);

        return {
          success: true,
          data: {
            ...weatherResult.data,
            autoDetectedLocation:
              !location && !locationInfo?.method?.includes("user"),
            detectionMethod: locationInfo?.method || "manual",
            locationInfo: locationInfo,
          },
          location: targetLocation,
          fullAddress: locationInfo?.fullAddress || targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: weatherResult.source,
        };
      } else if (weatherResult.data) {
        // 폴백 데이터 사용
        logger.warn(`⚠️ 날씨 API 실패, 폴백 데이터 사용`);

        return {
          success: true,
          data: {
            ...weatherResult.data,
            autoDetectedLocation:
              !location && !locationInfo?.method?.includes("user"),
            detectionMethod: locationInfo?.method || "manual",
            locationInfo: locationInfo,
          },
          location: targetLocation,
          fullAddress: locationInfo?.fullAddress || targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: "fallback",
          warning: weatherResult.error,
        };
      } else {
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
   * 📍 사용자 저장 위치 조회
   */
  async getUserSavedLocation(userId) {
    // TODO: DB에서 조회하는 로직 구현
    // 임시로 메모리 맵 사용
    return this.userLocationSettings.get(userId?.toString());
  }

  /**
   * 📍 사용자 위치 저장
   */
  async saveUserLocation(userId, location) {
    if (!this.userLocationSettings) {
      this.userLocationSettings = new Map();
    }
    this.userLocationSettings.set(userId?.toString(), location);
    logger.info(`📍 사용자 위치 저장: ${userId} → ${location}`);
  }

  /**
   * 🌬️ 미세먼지 정보 조회 (GPS 위치 기반)
   */
  async getDustInfo(location = null, userId = null) {
    try {
      this.stats.dustRequests++;
      let targetLocation = location;
      let locationInfo = null;

      if (!targetLocation) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation =
            locationResult.data.simpleCity || locationResult.data.city;
          locationInfo = {
            fullAddress: `${locationResult.data.city} ${
              locationResult.data.district || ""
            }`,
            method: locationResult.data.method,
            coordinates: {
              lat: locationResult.data.lat,
              lon: locationResult.data.lon,
            },
          };
          logger.info(`🌍 GPS 미세먼지 조회: ${targetLocation}`);
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
        logger.success(`✅ 미세먼지 조회 성공: ${targetLocation}`);

        return {
          success: true,
          data: {
            ...this.formatDustResponse(dustResult.data),
            autoDetectedLocation: !location,
            detectionMethod: locationInfo?.method || "manual",
            locationInfo: locationInfo,
            stationName: dustResult.data.stationName || null,
          },
          location: targetLocation,
          fullAddress: locationInfo?.fullAddress || targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: dustResult.source,
          warning: dustResult.warning || null,
        };
      } else {
        // 폴백 데이터 사용
        logger.warn(`⚠️ 미세먼지 API 실패, 추정 데이터 사용`);

        return {
          success: true,
          data: {
            ...this.formatDustResponse(dustResult.data),
            autoDetectedLocation: !location,
            detectionMethod: locationInfo?.method || "manual",
            locationInfo: locationInfo,
          },
          location: targetLocation,
          fullAddress: locationInfo?.fullAddress || targetLocation,
          timestamp: TimeHelper.format(TimeHelper.now(), "full"),
          source: "estimated",
          warning: "실시간 데이터를 가져올 수 없어 추정 데이터를 제공합니다",
        };
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ 미세먼지 조회 실패:", error);

      return {
        success: false,
        error: error.message,
        location: location || this.config.fallbackLocation,
      };
    }
  }

  /**
   * 🌍 통합 정보 조회 (날씨 + 미세먼지)
   */
  async getCompleteWeatherInfo(location = null, userId = null) {
    try {
      // 위치 한 번만 감지
      let targetLocation = location;
      let locationInfo = null;

      if (!targetLocation) {
        const locationResult = await this.getCurrentLocation(userId);
        if (locationResult.success) {
          targetLocation =
            locationResult.data.simpleCity || locationResult.data.city;
          locationInfo = {
            fullAddress: `${locationResult.data.city} ${
              locationResult.data.district || ""
            }`,
            method: locationResult.data.method,
          };
        } else {
          targetLocation = this.config.fallbackLocation;
        }
      }

      // 병렬 조회
      const [weatherResult, dustResult] = await Promise.all([
        this.getCurrentWeather(targetLocation, userId),
        this.getDustInfo(targetLocation, userId),
      ]);

      return {
        success: true,
        location: targetLocation,
        fullAddress: locationInfo?.fullAddress || targetLocation,
        locationInfo: locationInfo,
        weather: weatherResult.success ? weatherResult.data : null,
        dust: dustResult.success ? dustResult.data : null,
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        errors: {
          weather: weatherResult.success ? null : weatherResult.error,
          dust: dustResult.success ? null : dustResult.error,
        },
      };
    } catch (error) {
      logger.error("통합 날씨 정보 조회 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🎨 미세먼지 응답 포맷팅
   */
  formatDustResponse(data) {
    if (!data) return null;

    // 디버깅용 로그
    logger.debug("미세먼지 원본 데이터:", JSON.stringify(data, null, 2));

    return {
      pm25: {
        value: data.pm25?.value || data.pm25Value || data.pm25 || "-",
        grade:
          data.pm25?.grade ||
          data.pm25Grade ||
          this.getDustGrade(
            data.pm25?.value || data.pm25Value || data.pm25,
            "pm25"
          ),
        unit: "㎍/㎥",
      },
      pm10: {
        value: data.pm10?.value || data.pm10Value || data.pm10 || "-",
        grade:
          data.pm10?.grade ||
          data.pm10Grade ||
          this.getDustGrade(
            data.pm10?.value || data.pm10Value || data.pm10,
            "pm10"
          ),
        unit: "㎍/㎥",
      },
      overall: {
        grade: data.overall?.grade || data.khaiGrade || data.overall || "보통",
        value: data.overall?.value || data.khaiValue || "-",
        emoji: this.getDustEmoji(
          data.overall?.grade || data.khaiGrade || data.overall || "보통"
        ),
      },
      advice:
        data.advice ||
        this.getDustAdvice(
          data.overall?.grade || data.khaiGrade || data.overall || "보통"
        ),
      timestamp:
        data.timestamp ||
        data.dataTime ||
        TimeHelper.format(TimeHelper.now(), "time"),
      stationName: data.stationName || null,
    };
  }

  /**
   * 🎯 미세먼지 등급 판정
   */
  getDustGrade(value, type) {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return "알 수 없음";

    if (type === "pm25") {
      if (numValue <= 15) return "좋음";
      if (numValue <= 35) return "보통";
      if (numValue <= 75) return "나쁨";
      return "매우나쁨";
    } else {
      if (numValue <= 30) return "좋음";
      if (numValue <= 80) return "보통";
      if (numValue <= 150) return "나쁨";
      return "매우나쁨";
    }
  }

  /**
   * 😷 미세먼지 이모지
   */
  getDustEmoji(grade) {
    const emojiMap = {
      좋음: "😊",
      보통: "🙂",
      나쁨: "😷",
      매우나쁨: "🚨",
    };
    return emojiMap[grade] || "❓";
  }

  /**
   * 💡 미세먼지 행동요령
   */
  getDustAdvice(grade) {
    const adviceMap = {
      좋음: "외출하기 좋은 날씨입니다! 야외활동을 즐기세요.",
      보통: "일반적인 야외활동에 지장이 없습니다.",
      나쁨: "장시간 야외활동을 자제하고, 외출 시 마스크를 착용하세요.",
      매우나쁨: "외출을 자제하고, 부득이한 외출 시 보건용 마스크를 착용하세요.",
    };
    return adviceMap[grade] || "대기질 정보를 확인하세요.";
  }

  /**
   * 📊 서비스 상태
   */
  async getServiceStatus() {
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
   * 🧹 캐시 정리
   */
  clearLocationCache() {
    const before = this.userLocationCache.size;
    this.userLocationCache.clear();
    logger.info(`📦 위치 캐시 정리됨: ${before}개 항목 삭제`);
  }
}

module.exports = WeatherService;
