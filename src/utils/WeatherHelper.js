// src/utils/WeatherHelper.js - 조율만 담당 (SoC 준수)

const axios = require("axios");
const logger = require("./Logger");
const Weather = require("../models/Weather");

/**
 * 🌤️ WeatherHelper - 조율 전용 헬퍼 (SoC 준수)
 *
 * 🎯 단 하나의 책임: API 호출과 Weather 모델 조율
 *
 * ✅ 담당 업무:
 * - API 호출
 * - Weather 모델과 연결
 * - 간단한 캐시 관리
 * - 에러 처리 및 폴백 연결
 *
 * ❌ 하지 않는 일:
 * - 데이터 구조 정의 (Weather 모델)
 * - 복잡한 비즈니스 로직 (WeatherService)
 * - 통계 관리 (WeatherService)
 * - UI 관련 처리 (NavigationHandler)
 */
class WeatherHelper {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";

    // 🗄️ 최소한의 캐시 (조율에 필요한 것만)
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 10 * 60 * 1000; // 10분

    logger.info("🌤️ WeatherHelper 초기화됨", {
      hasApiKey: !!this.apiKey,
      cacheTimeout: this.cacheTimeout / 1000 / 60 + "분",
    });
  }

  /**
   * 🎯 핵심 메서드: API 호출 + Weather 모델 조율
   */
  async getCurrentWeather(location) {
    try {
      // 1. 캐시 확인 (조율 차원에서 필요)
      const cacheKey = `weather_${location}`;
      const cached = this.getCached(cacheKey);
      if (cached) {
        logger.info(`📦 캐시에서 날씨 반환: ${location}`);
        return { success: true, data: cached, source: "cache" };
      }

      // 2. API 키 없으면 Weather 모델의 폴백 사용
      if (!this.apiKey) {
        logger.warn("❌ API 키 없음 - Weather 모델 폴백 사용");
        const fallbackData = Weather.createFallbackWeather(location);
        return { success: true, data: fallbackData, source: "fallback" };
      }

      // 3. 도시명 변환 (Weather 모델 활용)
      const mappedCity = Weather.getCityMapping(location);
      logger.info(`🌐 날씨 API 요청: ${location} → ${mappedCity}`);

      // 4. API 호출 (순수 HTTP 통신)
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: mappedCity,
          appid: this.apiKey,
          units: "metric",
          lang: "kr",
        },
        timeout: 10000,
      });

      // 5. Weather 모델로 데이터 변환
      const weatherData = Weather.createFromApiResponse(
        response.data,
        location
      );

      // 6. 데이터 검증 (Weather 모델 활용)
      const validation = Weather.validateWeatherData(weatherData);
      if (!validation.isValid) {
        logger.warn("⚠️ 날씨 데이터 검증 실패:", validation.errors);
        // 검증 실패해도 정규화해서 사용
        const normalizedData = Weather.normalizeWeatherData(weatherData);
        this.setCache(cacheKey, normalizedData);
        return {
          success: true,
          data: normalizedData,
          source: "api_normalized",
        };
      }

      // 7. 캐시 저장
      this.setCache(cacheKey, weatherData);

      logger.success(
        `✅ 날씨 조회 성공: ${location} (${weatherData.temperature}°C)`
      );

      return { success: true, data: weatherData, source: "api" };
    } catch (error) {
      logger.error("❌ WeatherHelper API 실패:", error);

      // 에러 시 Weather 모델의 폴백 사용
      const fallbackData = Weather.createFallbackWeather(location);

      return {
        success: false,
        data: fallbackData,
        error: this.getErrorMessage(error),
        source: "fallback",
      };
    }
  }

  /**
   * 📦 간단한 캐시 관리 (조율에 필요한 최소한)
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
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
    const oldSize = this.cache.size;
    this.cache.clear();
    logger.info(`🧹 WeatherHelper 캐시 정리됨: ${oldSize}개 항목`);
  }

  /**
   * 🚨 에러 메시지 처리 (간단한 매핑만)
   */
  getErrorMessage(error) {
    if (error.code === "ENOTFOUND") {
      return "인터넷 연결을 확인해주세요";
    }

    if (error.code === "ECONNABORTED") {
      return "요청 시간이 초과되었습니다";
    }

    if (error.response) {
      switch (error.response.status) {
        case 401:
          return "날씨 API 키가 유효하지 않습니다";
        case 404:
          return "해당 지역을 찾을 수 없습니다";
        case 429:
          return "API 요청 한도를 초과했습니다";
        case 500:
          return "날씨 서비스에 일시적인 문제가 발생했습니다";
        default:
          return `날씨 서비스 오류 (${error.response.status})`;
      }
    }

    return "날씨 정보를 가져올 수 없습니다";
  }

  /**
   * 🔍 간단한 상태 확인
   */
  async checkStatus() {
    try {
      if (!this.apiKey) {
        return {
          status: "warning",
          message: "API 키 없음 - 폴백 모드",
          details: {
            hasApiKey: false,
            cacheSize: this.cache.size,
          },
        };
      }

      // 기본 위치로 간단 테스트
      const testResult = await this.getCurrentWeather("화성시");

      return {
        status: testResult.success ? "ok" : "error",
        message: testResult.success ? "정상 작동" : testResult.error,
        details: {
          hasApiKey: true,
          cacheSize: this.cache.size,
          lastTest: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        details: {
          hasApiKey: !!this.apiKey,
          cacheSize: this.cache.size,
        },
      };
    }
  }

  /**
   * 📊 간단한 상태 정보 (통계는 WeatherService에서)
   */
  getStatus() {
    return {
      hasApiKey: !!this.apiKey,
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout / 1000 / 60 + "분",
      baseUrl: this.baseUrl,
    };
  }
}

module.exports = WeatherHelper;
