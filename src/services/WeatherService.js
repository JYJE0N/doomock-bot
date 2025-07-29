// src/services/WeatherService.js - 표준 구조 준수 완전 수정 버전
const axios = require("axios");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherService - 날씨 정보 서비스
 * - 표준 구조 준수 (dbManager 주입 방식)
 * - API 키 정상 전달 구조
 * - OpenWeatherMap API 연동
 * - 캐시 시스템 내장
 */
class WeatherService {
  constructor(options = {}) {
    console.log("🔍 WeatherService 생성자 디버깅:");
    console.log("🔧 WeatherService 생성"); // ✅ 안전
    console.log("🔧 options.config:", options.config);
    console.log("🔧 options.dbManager:", !!options.dbManager);

    // ✅ 표준: dbManager는 주입받기 (직접 import 금지)
    this.dbManager = options.dbManager;

    // ✅ API 키 추출 (다양한 경로에서 받을 수 있도록)
    this.apiKey =
      options.config?.apiKey || options.apiKey || process.env.WEATHER_API_KEY;

    console.log(
      "🔑 최종 this.apiKey:",
      this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined"
    );

    // 기본 설정
    this.defaultLocation =
      options.config?.defaultLocation || options.defaultLocation || "서울";

    this.baseUrl = "https://api.openweathermap.org/data/2.5";

    this.config = {
      enableCache: true,
      cacheTimeout: 600000, // 10분
      units: "metric", // 섭씨 온도
      lang: "kr", // 한국어 (OpenWeatherMap 지원)
      retryAttempts: 3,
      timeout: 10000,
      ...options.config,
    };

    // 캐시 시스템
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    logger.info("🔧 WeatherService 생성", {
      hasApiKey: !!this.apiKey,
      hasDbManager: !!this.dbManager,
      defaultLocation: this.defaultLocation,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * 🎯 서비스 초기화 (ServiceBuilder가 호출)
   */
  async initialize() {
    // ✅ 표준: dbManager 연결 확인 (있는 경우에만)
    if (this.dbManager) {
      try {
        await this.dbManager.ensureConnection();
        logger.debug("✅ WeatherService - DB 연결 확인 완료");
      } catch (error) {
        logger.warn(
          "⚠️ WeatherService - DB 연결 실패, 계속 진행:",
          error.message
        );
      }
    }

    // API 키 검증 및 상태 로깅
    if (!this.apiKey) {
      logger.warn("⚠️ 날씨 API 키가 설정되지 않음 - 더미 데이터 모드");
      logger.warn("💡 다음 중 하나를 설정해주세요:");
      logger.warn("   - WEATHER_API_KEY 환경변수");
      logger.warn("   - WeatherModule config에서 apiKey 전달");
    } else {
      logger.success(
        `✅ 날씨 API 키 설정됨 (${this.apiKey.substring(0, 8)}...)`
      );

      // API 연결 테스트 (선택적)
      if (this.config.testConnection) {
        await this.testApiConnection();
      }
    }

    logger.success("WeatherService 초기화 완료");
  }

  /**
   * 🌡️ 현재 날씨 조회
   */
  async getCurrentWeather(location = null) {
    const loc = location || this.defaultLocation;
    const cacheKey = `weather_${loc}`;

    // 캐시 확인
    if (this.config.enableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug(`캐시에서 날씨 데이터 반환: ${loc}`);
        return cached;
      }
    }

    try {
      // API 키가 없으면 더미 데이터 반환
      if (!this.apiKey) {
        logger.warn("API 키가 없어 더미 데이터 반환");
        return this.getDummyWeatherData(loc);
      }

      // ✅ 도시명 매핑 (한국어 → 영어)
      const cityMap = {
        서울: "Seoul,KR",
        부산: "Busan,KR",
        대구: "Daegu,KR",
        인천: "Incheon,KR",
        광주: "Gwangju,KR",
        대전: "Daejeon,KR",
        울산: "Ulsan,KR",
        화성: "Hwaseong,KR",
        수원: "Suwon,KR",
      };

      const searchLocation = cityMap[loc] || loc;
      logger.debug(`날씨 API 요청: ${loc} → ${searchLocation}`);

      // ✅ 실제 OpenWeatherMap API 호출
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: searchLocation, // 매핑된 도시명 사용
          appid: this.apiKey,
          units: this.config.units,
          lang: this.config.lang,
        },
        timeout: this.config.timeout,
      });

      const data = response.data;
      const weather = {
        location: loc, // 원래 요청한 도시명 사용
        country: data.sys.country,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: this.getWeatherIcon(data.weather[0].icon),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind?.speed * 10) / 10 || 0, // 소수점 1자리
        pressure: data.main.pressure,
        feelsLike: Math.round(data.main.feels_like),
        visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
        cloudiness: data.clouds?.all || 0,
        sunrise: data.sys.sunrise ? new Date(data.sys.sunrise * 1000) : null,
        sunset: data.sys.sunset ? new Date(data.sys.sunset * 1000) : null,
        timestamp: new Date().toISOString(),
        source: "openweathermap",
      };

      // 캐시 저장
      if (this.config.enableCache) {
        this.saveToCache(cacheKey, weather);
      }

      logger.info("날씨 조회 성공:", {
        location: loc,
        temp: weather.temperature,
      });

      return weather;
    } catch (error) {
      logger.error("현재 날씨 조회 실패", error);

      // 에러 타입별 처리
      if (error.response) {
        const status = error.response.status;
        switch (status) {
          case 401:
            logger.error("❌ 잘못된 API 키입니다");
            break;
          case 404:
            logger.error(
              `❌ 도시를 찾을 수 없습니다: ${loc} (검색어: ${
                searchLocation || loc
              })`
            );
            break;
          case 429:
            logger.error("❌ API 호출 한도를 초과했습니다");
            break;
          default:
            logger.error(
              `❌ API 오류 (${status}): ${
                error.response.data?.message || error.message
              }`
            );
        }
      }

      // API 실패 시 더미 데이터 반환 (서비스 지속성)
      logger.warn("더미 데이터로 대체하여 반환");
      return this.getDummyWeatherData(loc);
    }
  }

  /**
   * 🌫️ 미세먼지 정보 조회
   */
  async getDustInfo(location = null) {
    const loc = location || this.defaultLocation;

    try {
      // 현재는 더미 데이터, 나중에 대기질 API 연동 가능
      const dust = {
        location: loc,
        pm25: "좋음",
        pm10: "보통",
        icon: "😊",
        aqi: 75,
        timestamp: new Date().toISOString(),
        source: "dummy",
      };

      logger.data("weather", "dust", null, { location: loc });
      return dust;
    } catch (error) {
      logger.error("미세먼지 조회 실패", error);
      throw error;
    }
  }

  /**
   * 🎨 날씨 아이콘 매핑
   */
  getWeatherIcon(iconCode) {
    const iconMap = {
      "01d": "☀️",
      "01n": "🌙", // 맑음
      "02d": "⛅",
      "02n": "☁️", // 구름 조금
      "03d": "☁️",
      "03n": "☁️", // 구름
      "04d": "☁️",
      "04n": "☁️", // 구름 많음
      "09d": "🌧️",
      "09n": "🌧️", // 소나기
      "10d": "🌦️",
      "10n": "🌧️", // 비
      "11d": "⛈️",
      "11n": "⛈️", // 천둥번개
      "13d": "❄️",
      "13n": "❄️", // 눈
      "50d": "🌫️",
      "50n": "🌫️", // 안개
    };
    return iconMap[iconCode] || "🌤️";
  }

  /**
   * 📊 더미 날씨 데이터 (API 실패시)
   */
  getDummyWeatherData(location) {
    const temperatures = [18, 20, 22, 24, 26, 28];
    const descriptions = ["맑음", "흐림", "구름 많음", "부분적으로 흐림"];
    const icons = ["☀️", "☁️", "⛅", "🌤️"];

    const randomTemp =
      temperatures[Math.floor(Math.random() * temperatures.length)];
    const randomDesc =
      descriptions[Math.floor(Math.random() * descriptions.length)];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    return {
      location,
      country: "KR",
      temperature: randomTemp,
      description: randomDesc,
      icon: randomIcon,
      humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
      windSpeed: Math.random() * 5 + 1, // 1-6 m/s
      pressure: Math.floor(Math.random() * 40) + 1000, // 1000-1040 hPa
      feelsLike: randomTemp + Math.floor(Math.random() * 6) - 3, // ±3도
      visibility: Math.floor(Math.random() * 10) + 5, // 5-15 km
      cloudiness: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
      source: "dummy",
      isDummy: true,
    };
  }

  /**
   * 🔍 API 연결 테스트
   */
  async testApiConnection() {
    try {
      logger.info("날씨 API 연결 테스트 중...");
      const testResponse = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: "Seoul",
          appid: this.apiKey,
          units: "metric",
        },
        timeout: 5000,
      });

      if (testResponse.status === 200) {
        logger.success("✅ 날씨 API 연결 테스트 성공");
        return true;
      }
    } catch (error) {
      logger.error("❌ 날씨 API 연결 테스트 실패:", error.message);
      return false;
    }
  }

  /**
   * 📱 캐시 관리 메서드들
   */
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

    // 만료된 캐시 삭제
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return null;
  }

  saveToCache(key, data) {
    if (!this.config.enableCache) return;

    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // 캐시 크기 제한 (선택적)
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
  }

  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.info("날씨 캐시 초기화 완료");
  }

  /**
   * 🧹 정리 (봇 종료시 호출)
   */
  async cleanup() {
    this.clearCache();
    logger.info("WeatherService 정리 완료");
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "WeatherService",
      hasApiKey: !!this.apiKey,
      hasDbManager: !!this.dbManager,
      baseUrl: this.baseUrl,
      cacheSize: this.cache.size,
      defaultLocation: this.defaultLocation,
      isConnected: !!this.apiKey,
      lastUpdate: new Date().toISOString(),
    };
  }
}

module.exports = WeatherService;
