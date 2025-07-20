// src/services/WeatherService.js - 올바른 서비스 Export 방식

const axios = require("axios");
const logger = require("../utils/Logger");

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
    this.defaultCity = "Seoul";
    this.language = "kr";
    this.units = "metric";

    // 캐시 설정
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분

    logger.debug(
      `🌤️ WeatherService 초기화 (API 키: ${this.apiKey ? "설정됨" : "없음"})`
    );
  }

  // 현재 날씨 조회
  async getCurrentWeather(city = this.defaultCity) {
    try {
      const cacheKey = `current_${city}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug(`날씨 캐시 사용: ${city}`);
        return { success: true, data: cached, cached: true };
      }

      if (!this.apiKey) {
        logger.warn("날씨 API 키가 설정되지 않음, 기본값 반환");
        return {
          success: false,
          error: "날씨 API 키가 설정되지 않았습니다.",
          data: this.getDefaultWeatherData(city),
        };
      }

      const url = `${this.baseUrl}/weather`;
      const params = {
        q: city,
        appid: this.apiKey,
        lang: this.language,
        units: this.units,
      };

      logger.debug(`날씨 API 요청: ${city}`);
      const response = await axios.get(url, {
        params,
        timeout: 10000,
      });

      const weatherData = this.formatCurrentWeather(response.data);
      this.setCache(cacheKey, weatherData);

      logger.info(`현재 날씨 조회 성공: ${city}`);
      return { success: true, data: weatherData, cached: false };
    } catch (error) {
      logger.error("현재 날씨 조회 실패:", error.message);
      return {
        success: false,
        error: this.formatError(error),
        data: this.getDefaultWeatherData(city),
      };
    }
  }

  // 날씨 예보 조회
  async getForecast(city = this.defaultCity) {
    try {
      const cacheKey = `forecast_${city}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug(`예보 캐시 사용: ${city}`);
        return { success: true, data: cached, cached: true };
      }

      if (!this.apiKey) {
        logger.warn("날씨 API 키가 설정되지 않음, 기본 예보 반환");
        return {
          success: false,
          error: "날씨 API 키가 설정되지 않았습니다.",
          data: this.getDefaultForecastData(city),
        };
      }

      const url = `${this.baseUrl}/forecast`;
      const params = {
        q: city,
        appid: this.apiKey,
        lang: this.language,
        units: this.units,
      };

      logger.debug(`예보 API 요청: ${city}`);
      const response = await axios.get(url, {
        params,
        timeout: 10000,
      });

      const forecastData = this.formatForecast(response.data);
      this.setCache(cacheKey, forecastData);

      logger.info(`날씨 예보 조회 성공: ${city}`);
      return { success: true, data: forecastData, cached: false };
    } catch (error) {
      logger.error("날씨 예보 조회 실패:", error.message);
      return {
        success: false,
        error: this.formatError(error),
        data: this.getDefaultForecastData(city),
      };
    }
  }

  // 기본 날씨 데이터 (API 실패시)
  getDefaultWeatherData(city) {
    const defaultData = {
      화성: {
        temp: 15,
        desc: "구름많음",
        icon: "☁️",
        humidity: 65,
        wind: "서풍 2.1m/s",
      },
      서울: {
        temp: 16,
        desc: "맑음",
        icon: "☀️",
        humidity: 60,
        wind: "남풍 1.8m/s",
      },
      부산: {
        temp: 18,
        desc: "구름조금",
        icon: "🌤️",
        humidity: 70,
        wind: "남동풍 3.2m/s",
      },
    };

    const data = defaultData[city] || defaultData["화성"];

    return {
      city: city,
      temperature: data.temp,
      description: data.desc,
      humidity: data.humidity,
      windSpeed: data.wind.split(" ")[1],
      windDirection: data.wind.split(" ")[0],
      icon: data.icon,
      timestamp: new Date().toLocaleString("ko-KR"),
    };
  }

  // 기본 예보 데이터 (API 실패시)
  getDefaultForecastData(city) {
    return {
      city: city,
      forecast: [
        { date: "오늘", icon: "☁️", temp: "15°C", desc: "구름많음" },
        { date: "내일", icon: "🌤️", temp: "18°C", desc: "맑음" },
        { date: "모레", icon: "🌧️", temp: "12°C", desc: "비" },
        { date: "글피", icon: "☀️", temp: "20°C", desc: "맑음" },
        { date: "그후", icon: "⛅", temp: "16°C", desc: "구름조금" },
      ],
      timestamp: new Date().toLocaleString("ko-KR"),
    };
  }

  // 현재 날씨 데이터 포맷팅
  formatCurrentWeather(apiData) {
    return {
      city: apiData.name,
      temperature: Math.round(apiData.main.temp),
      description: apiData.weather[0].description,
      humidity: apiData.main.humidity,
      windSpeed: apiData.wind?.speed || 0,
      windDirection: this.getWindDirection(apiData.wind?.deg || 0),
      icon: this.getWeatherIcon(apiData.weather[0].icon),
      timestamp: new Date().toLocaleString("ko-KR"),
    };
  }

  // 예보 데이터 포맷팅
  formatForecast(apiData) {
    const dailyForecasts = [];
    const processedDates = new Set();

    for (const item of apiData.list.slice(0, 15)) {
      const date = new Date(item.dt * 1000);
      const dateStr = date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });

      if (!processedDates.has(dateStr) && dailyForecasts.length < 5) {
        dailyForecasts.push({
          date: dateStr,
          icon: this.getWeatherIcon(item.weather[0].icon),
          temp: `${Math.round(item.main.temp)}°C`,
          desc: item.weather[0].description,
        });
        processedDates.add(dateStr);
      }
    }

    return {
      city: apiData.city.name,
      forecast: dailyForecasts,
      timestamp: new Date().toLocaleString("ko-KR"),
    };
  }

  // 날씨 아이콘 매핑
  getWeatherIcon(iconCode) {
    const iconMap = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "🌤️",
      "02n": "🌙",
      "03d": "⛅",
      "03n": "☁️",
      "04d": "☁️",
      "04n": "☁️",
      "09d": "🌧️",
      "09n": "🌧️",
      "10d": "🌦️",
      "10n": "🌧️",
      "11d": "⛈️",
      "11n": "⛈️",
      "13d": "🌨️",
      "13n": "🌨️",
      "50d": "🌫️",
      "50n": "🌫️",
    };
    return iconMap[iconCode] || "🌤️";
  }

  // 풍향 계산
  getWindDirection(degrees) {
    const directions = [
      "북풍",
      "북동풍",
      "동풍",
      "남동풍",
      "남풍",
      "남서풍",
      "서풍",
      "북서풍",
    ];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  // 캐시 관리
  setCache(key, data, timeout = this.cacheTimeout) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout,
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clearCache() {
    this.cache.clear();
    logger.info("날씨 캐시 초기화");
  }

  // 에러 포맷팅
  formatError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 401:
          return "날씨 API 키가 유효하지 않습니다.";
        case 404:
          return "도시를 찾을 수 없습니다. 도시명을 확인해주세요.";
        case 429:
          return "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
        default:
          return `날씨 정보를 가져올 수 없습니다: ${message}`;
      }
    } else if (error.code === "ENOTFOUND") {
      return "인터넷 연결을 확인해주세요.";
    } else if (error.code === "ETIMEDOUT") {
      return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
    } else {
      return "날씨 서비스에 일시적인 문제가 발생했습니다.";
    }
  }

  // 서비스 상태 확인
  async checkStatus() {
    try {
      if (!this.apiKey) {
        return { status: "error", message: "API 키 없음" };
      }

      const result = await this.getCurrentWeather("Seoul");

      return {
        status: result.success ? "ok" : "error",
        message: result.success ? "정상" : result.error,
        apiKey: this.apiKey ? "설정됨" : "없음",
        cacheSize: this.cache.size,
      };
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        apiKey: this.apiKey ? "설정됨" : "없음",
      };
    }
  }
}

// ✅ 올바른 서비스 Export 방식 (중괄호 사용)
module.exports = { WeatherService };
