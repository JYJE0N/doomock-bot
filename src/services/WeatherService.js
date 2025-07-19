// src/services/WeatherService.js - axios 직접 사용 (Railway 호환)

const axios = require("axios");
const Logger = require("../utils/Logger");
const AppConfig = require("../config/AppConfig");

class WeatherService {
  constructor() {
    this.apiKey = AppConfig.WEATHER_API_KEY;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
    this.defaultCity = "Seoul";
    this.language = "kr"; // 한국어
    this.units = "metric"; // 섭씨

    // 캐시 설정
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분
  }

  // ⭐ 현재 날씨 조회
  async getCurrentWeather(city = this.defaultCity) {
    try {
      // 캐시 확인
      const cacheKey = `current_${city}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        Logger.debug(`날씨 캐시 사용: ${city}`);
        return { success: true, data: cached, cached: true };
      }

      if (!this.apiKey) {
        return {
          success: false,
          error: "날씨 API 키가 설정되지 않았습니다.",
        };
      }

      const url = `${this.baseUrl}/weather`;
      const params = {
        q: city,
        appid: this.apiKey,
        lang: this.language,
        units: this.units,
      };

      Logger.debug(`날씨 API 요청: ${city}`);
      const response = await axios.get(url, {
        params,
        timeout: 10000, // 10초 타임아웃
      });

      const weatherData = this.formatCurrentWeather(response.data);

      // 캐시 저장
      this.setCache(cacheKey, weatherData);

      Logger.info(`현재 날씨 조회 성공: ${city}`);
      return { success: true, data: weatherData, cached: false };
    } catch (error) {
      Logger.error("현재 날씨 조회 실패:", error.message);
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  // ⭐ 날씨 예보 조회 (5일)
  async getWeatherForecast(city = this.defaultCity) {
    try {
      // 캐시 확인
      const cacheKey = `forecast_${city}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        Logger.debug(`예보 캐시 사용: ${city}`);
        return { success: true, data: cached, cached: true };
      }

      if (!this.apiKey) {
        return {
          success: false,
          error: "날씨 API 키가 설정되지 않았습니다.",
        };
      }

      const url = `${this.baseUrl}/forecast`;
      const params = {
        q: city,
        appid: this.apiKey,
        lang: this.language,
        units: this.units,
        cnt: 40, // 5일 x 8회 (3시간 간격)
      };

      Logger.debug(`예보 API 요청: ${city}`);
      const response = await axios.get(url, {
        params,
        timeout: 15000, // 15초 타임아웃
      });

      const forecastData = this.formatForecast(response.data);

      // 캐시 저장 (예보는 30분 캐시)
      this.setCache(cacheKey, forecastData, 30 * 60 * 1000);

      Logger.info(`날씨 예보 조회 성공: ${city}`);
      return { success: true, data: forecastData, cached: false };
    } catch (error) {
      Logger.error("날씨 예보 조회 실패:", error.message);
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  // ⭐ 현재 날씨 데이터 포맷팅
  formatCurrentWeather(data) {
    return {
      city: data.name,
      country: data.sys.country,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
      windSpeed: data.wind?.speed ? Math.round(data.wind.speed * 3.6) : 0, // m/s → km/h
      windDirection: data.wind?.deg || 0,
      cloudiness: data.clouds?.all || 0,
      weather: {
        main: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
      },
      sunrise: new Date(data.sys.sunrise * 1000),
      sunset: new Date(data.sys.sunset * 1000),
      timestamp: new Date(),
    };
  }

  // ⭐ 예보 데이터 포맷팅
  formatForecast(data) {
    const dailyForecasts = {};

    data.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!dailyForecasts[dateKey]) {
        dailyForecasts[dateKey] = {
          date: dateKey,
          temps: [],
          weather: [],
          details: [],
        };
      }

      dailyForecasts[dateKey].temps.push(Math.round(item.main.temp));
      dailyForecasts[dateKey].weather.push({
        time: date.getHours(),
        temp: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: Math.round((item.wind?.speed || 0) * 3.6),
      });
    });

    // 일별 최고/최저 온도 계산
    const forecast = Object.values(dailyForecasts)
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        minTemp: Math.min(...day.temps),
        maxTemp: Math.max(...day.temps),
        weather: day.weather[0], // 첫 번째 시간대 날씨
        hourly: day.weather,
      }));

    return {
      city: data.city.name,
      country: data.city.country,
      forecast,
      timestamp: new Date(),
    };
  }

  // ⭐ 날씨 아이콘 이모지 변환
  getWeatherEmoji(iconCode) {
    const emojiMap = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "⛅",
      "02n": "☁️",
      "03d": "☁️",
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

    return emojiMap[iconCode] || "🌤️";
  }

  // ⭐ 의상 추천
  getClothingRecommendation(temp, weather) {
    let recommendation = "";

    if (temp >= 28) {
      recommendation = "👕 민소매, 반팔, 반바지, 원피스";
    } else if (temp >= 23) {
      recommendation = "👔 반팔, 얇은 셔츠, 반바지, 면바지";
    } else if (temp >= 20) {
      recommendation = "👕 얇은 가디건, 긴팔, 면바지, 청바지";
    } else if (temp >= 17) {
      recommendation = "🧥 얇은 니트, 자켓, 가디건, 청바지";
    } else if (temp >= 12) {
      recommendation = "🧥 자켓, 트렌치코트, 니트, 청바지, 스타킹";
    } else if (temp >= 9) {
      recommendation = "🧥 울 코트, 히트텍, 니트, 청바지";
    } else if (temp >= 5) {
      recommendation = "🧥 코트, 가죽자켓, 히트텍, 니트, 레깅스";
    } else {
      recommendation = "🧥 패딩, 두꺼운 코트, 목도리, 장갑, 기모제품";
    }

    // 날씨별 추가 추천
    if (weather.includes("rain") || weather.includes("비")) {
      recommendation += "\n☂️ 우산, 방수 외투 필수!";
    }
    if (weather.includes("snow") || weather.includes("눈")) {
      recommendation += "\n❄️ 미끄럼 방지 신발, 장갑, 목도리 추천!";
    }
    if (weather.includes("wind") || weather.includes("바람")) {
      recommendation += "\n💨 바람막이 추천!";
    }

    return recommendation;
  }

  // ⭐ 자외선 지수 계산 (간단한 추정)
  getUVIndex(weather, hour) {
    if (hour < 6 || hour > 18) return 0;

    let baseUV = 5; // 기본값

    if (weather.includes("clear") || weather.includes("맑음")) {
      baseUV = 8;
    } else if (weather.includes("cloud") || weather.includes("구름")) {
      baseUV = 5;
    } else if (weather.includes("rain") || weather.includes("비")) {
      baseUV = 2;
    }

    // 시간대별 조정
    if (hour >= 11 && hour <= 15) {
      baseUV += 2;
    } else if (hour >= 9 && hour <= 17) {
      baseUV += 1;
    }

    return Math.min(baseUV, 11);
  }

  // ⭐ 캐시 관리
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
    Logger.info("날씨 캐시 초기화");
  }

  // ⭐ 에러 포맷팅
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

  // ⭐ 서비스 상태 확인
  async checkStatus() {
    try {
      if (!this.apiKey) {
        return { status: "error", message: "API 키 없음" };
      }

      // 간단한 API 테스트
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

module.exports = WeatherService;
