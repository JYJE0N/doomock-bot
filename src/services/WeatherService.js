// ✅ src/services/WeatherService.js - 미세먼지 메서드 완전 구현

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const axios = require("axios");

class WeatherService extends BaseService {
  constructor(options = {}) {
    super("WeatherService", options);

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

    // 🌬️ 미세먼지 측정소 매핑 (한국 환경공단)
    this.dustStationMapping = {
      서울: "종로구",
      서울시: "종로구",
      수원: "수원",
      수원시: "수원",
      인천: "인천",
      인천시: "인천",
      대전: "대전",
      대전시: "대전",
      대구: "대구",
      대구시: "대구",
      부산: "부산",
      부산시: "부산",
      광주: "광주",
      광주시: "광주",
      제주: "제주",
      제주시: "제주",
    };

    this.weatherCache = new Map();
    this.dustCache = new Map();
    this.forecastCache = new Map();

    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      errors: 0,
      lastUpdate: null,
    };

    logger.info("🌤️ WeatherService 생성됨");
  }

  getRequiredModels() {
    return [];
  }

  async onInitialize() {
    if (!this.config.apiKey) {
      logger.warn("⚠️ OpenWeatherMap API 키가 설정되지 않음");
    } else {
      logger.success(
        `✅ 날씨 API 키 확인됨: ${this.config.apiKey.substring(0, 8)}...`
      );
    }

    if (!this.config.dustApiKey) {
      logger.warn("⚠️ 미세먼지 API 키가 설정되지 않음 - 추정 데이터 사용");
    } else {
      logger.success(
        `✅ 미세먼지 API 키 확인됨: ${this.config.dustApiKey.substring(
          0,
          8
        )}...`
      );
    }

    this.setupCacheCleaning();
  }

  // 🔄 Weather 모델에서 이동한 메서드들
  transformApiResponse(apiResponse, originalLocation) {
    const main = apiResponse.main || {};
    const weather = apiResponse.weather?.[0] || {};
    const wind = apiResponse.wind || {};

    return {
      location: originalLocation,
      temperature: main.temp
        ? Math.round(main.temp)
        : this.estimateTemperature(),
      feelsLike: main.feels_like ? Math.round(main.feels_like) : null,
      humidity: main.humidity || 50,
      description: weather.description || "맑음",
      icon: this.getWeatherIcon(weather.icon || "01d"),
      windSpeed: wind.speed || 0,
      timestamp: new Date().toISOString(),
      meta: { source: "API", hasApiData: true },
    };
  }

  createFallbackWeather(location) {
    return new Weather({
      location,
      temperature: this.estimateTemperature(),
      description: "맑음 (추정)",
      icon: "☀️",
      meta: { source: "폴백", estimated: true },
    });
  }

  // 🧠 유틸리티 메서드들 (Weather 모델에서 이동)
  estimateTemperature() {
    const hour = new Date().getHours();
    const month = new Date().getMonth() + 1;

    let baseTemp = month >= 6 && month <= 8 ? 25 : 15; // 간단화
    let hourOffset = hour >= 13 && hour <= 18 ? 5 : 0;

    return baseTemp + hourOffset + Math.floor(Math.random() * 4 - 2);
  }

  getWeatherIcon(iconCode) {
    const icons = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "⛅",
      "02n": "☁️",
      "09d": "🌧️",
      "10d": "🌦️",
      "11d": "⛈️",
      "13d": "❄️",
      "50d": "🌫️",
    };
    return icons[iconCode] || "🌤️";
  }

  /**
   * 🌡️ 현재 날씨 조회
   */
  async getCurrentWeather(location) {
    try {
      const cacheKey = `weather_${location}`;
      const cached = this.getCached(this.weatherCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 날씨 정보");
      }

      if (this.config.apiKey) {
        logger.info(`🌐 현재 날씨 API 호출: ${location}`);

        try {
          const mappedCity = this.cityMapping[location] || `${location},KR`;

          const response = await axios.get(`${this.config.baseUrl}/weather`, {
            params: {
              q: mappedCity,
              appid: this.config.apiKey,
              units: "metric",
              lang: "kr",
            },
            timeout: 10000,
          });

          const Weather = require("../database/models/Weather");
          const weatherData = Weather.createFromApiResponse(
            response.data,
            location
          );

          this.setCached(this.weatherCache, cacheKey, weatherData);
          this.stats.apiCalls++;
          this.stats.lastUpdate = new Date();

          logger.success(
            `✅ 현재 날씨 API 성공: ${location} (${weatherData.temperature}°C)`
          );
          return this.createSuccessResponse(weatherData, "실제 날씨 정보");
        } catch (apiError) {
          logger.error(
            `❌ 현재 날씨 API 호출 실패 (${location}):`,
            apiError.message
          );

          const mockData = this.createMockWeatherData(location);
          return this.createSuccessResponse(mockData, "API 실패 - Mock 데이터");
        }
      }

      logger.warn(`⚠️ API 키 없음 - ${location} Mock 데이터 사용`);
      const mockData = this.createMockWeatherData(location);
      return this.createSuccessResponse(mockData, "Mock 날씨 정보");
    } catch (error) {
      this.stats.errors++;
      return this.createErrorResponse(error, "날씨 정보 조회 실패");
    }
  }

  /**
   * 🌬️ 미세먼지 정보 조회 (완전 구현!)
   */
  async getDustInfo(location) {
    try {
      const cacheKey = `dust_${location}`;
      const cached = this.getCached(this.dustCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        logger.info(`📦 캐시에서 미세먼지 반환: ${location}`);
        return this.createSuccessResponse(cached, "캐시된 미세먼지 정보");
      }

      // ✅ 미세먼지 API 키가 있으면 실제 API 호출!
      if (this.config.dustApiKey) {
        logger.info(`🌬️ 실제 미세먼지 API 호출: ${location}`);

        try {
          // 측정소명 매핑
          const stationName =
            this.dustStationMapping[location] ||
            this.dustStationMapping[location.replace(/시$/, "")] ||
            "종로구";

          logger.info(`🏢 측정소 매핑: ${location} → ${stationName}`);

          // 한국 환경공단 API 호출
          const response = await axios.get(
            `${this.config.dustApiUrl}/getMsrstnAcctoRltmMesureDnsty`,
            {
              params: {
                serviceKey: this.config.dustApiKey,
                stationName: stationName,
                dataTerm: "DAILY",
                ver: "1.0",
                returnType: "json",
                numOfRows: 1,
                pageNo: 1,
              },
              timeout: 10000,
            }
          );

          logger.info(`📡 미세먼지 API 응답:`, {
            status: response.status,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
          });

          if (
            response.data &&
            response.data.response &&
            response.data.response.body &&
            response.data.response.body.items
          ) {
            const items = response.data.response.body.items;

            if (Array.isArray(items) && items.length > 0) {
              const dustData = this.parseKoreanDustData(
                items[0],
                location,
                stationName
              );

              // 캐시 저장
              this.setCached(this.dustCache, cacheKey, dustData);
              this.stats.apiCalls++;

              logger.success(
                `✅ 실제 미세먼지 API 성공: ${location} (PM2.5: ${dustData.pm25}㎍/m³)`
              );
              return this.createSuccessResponse(dustData, "실제 미세먼지 정보");
            } else {
              logger.warn(`⚠️ 미세먼지 API 응답에 데이터 없음: ${stationName}`);
            }
          } else {
            logger.warn(`⚠️ 미세먼지 API 응답 구조 이상:`, response.data);
          }
        } catch (dustError) {
          logger.error(`❌ 미세먼지 API 호출 실패 (${location}):`, {
            error: dustError.message,
            code: dustError.code,
            response: dustError.response
              ? {
                  status: dustError.response.status,
                  data: dustError.response.data,
                }
              : null,
          });
        }
      } else {
        logger.info(`ℹ️ 미세먼지 API 키 없음 - ${location} 추정 데이터 사용`);
      }

      // API 실패 또는 키 없음 → 추정 데이터 생성
      const estimatedData = this.createMockDustData(location);

      // 캐시에 저장 (단기간)
      this.setCached(this.dustCache, cacheKey, estimatedData);

      logger.warn(`🎭 추정 미세먼지 데이터 생성: ${location}`);
      return this.createSuccessResponse(estimatedData, "추정 미세먼지 정보");
    } catch (error) {
      this.stats.errors++;
      logger.error(`❌ 미세먼지 정보 조회 실패 (${location}):`, error);

      // 최종 폴백
      const fallbackData = this.createMockDustData(location);
      return this.createSuccessResponse(fallbackData, "폴백 미세먼지 정보");
    }
  }

  /**
   * 🔄 한국 환경공단 API 응답 → 내부 포맷 변환
   */
  parseKoreanDustData(apiData, location, stationName) {
    try {
      // API 응답 필드들
      const pm25Value = parseInt(apiData.pm25Value) || 0;
      const pm10Value = parseInt(apiData.pm10Value) || 0;
      const pm25Grade = parseInt(apiData.pm25Grade) || 1;
      const pm10Grade = parseInt(apiData.pm10Grade) || 1;
      const dataTime =
        apiData.dataTime || TimeHelper.format(TimeHelper.now(), "full");

      // 등급 변환
      const pm25GradeText = this.convertDustGrade(pm25Grade);
      const pm10GradeText = this.convertDustGrade(pm10Grade);
      const overallGrade = this.convertDustGrade(
        Math.max(pm25Grade, pm10Grade)
      );

      return {
        pm25: pm25Value,
        pm10: pm10Value,
        grade: overallGrade,
        pm25Grade: pm25GradeText,
        pm10Grade: pm10GradeText,
        location: location,
        stationName: stationName,
        dataTime: dataTime,
        timestamp: TimeHelper.format(TimeHelper.now(), "time"),
        source: "한국환경공단",
        isReal: true,
        advice: this.getDustAdvice(overallGrade),
      };
    } catch (error) {
      logger.error("미세먼지 데이터 파싱 실패:", error);
      return this.createMockDustData(location);
    }
  }

  /**
   * 🏷️ 미세먼지 등급 변환 (숫자 → 한글)
   */
  convertDustGrade(gradeNumber) {
    const gradeMap = {
      1: "좋음",
      2: "보통",
      3: "나쁨",
      4: "매우나쁨",
    };
    return gradeMap[gradeNumber] || "알수없음";
  }

  /**
   * 💡 미세먼지 행동요령
   */
  getDustAdvice(grade) {
    const adviceMap = {
      좋음: "외출하기 좋은 날씨입니다! 야외활동을 즐기세요.",
      보통: "일반적인 야외활동에 지장이 없습니다.",
      나쁨: "장시간 야외활동을 자제하고, 외출 시 마스크를 착용하세요.",
      매우나쁨:
        "외출을 자제하고, 꼭 외출해야 할 경우 KF94 마스크를 착용하세요.",
    };
    return adviceMap[grade] || "미세먼지 농도를 확인하세요.";
  }

  /**
   * 🎭 Mock 미세먼지 데이터 생성 (실제와 유사하게)
   */
  createMockDustData(location) {
    const hour = new Date().getHours();

    // 시간대별 미세먼지 추정 (서울 기준)
    let pm25Base, pm10Base, gradeText;

    if (hour >= 7 && hour <= 9) {
      // 출근 시간 - 나쁨
      pm25Base = 35;
      pm10Base = 65;
      gradeText = "나쁨";
    } else if (hour >= 18 && hour <= 20) {
      // 퇴근 시간 - 나쁨
      pm25Base = 40;
      pm10Base = 70;
      gradeText = "나쁨";
    } else if (hour >= 0 && hour <= 6) {
      // 새벽 - 좋음
      pm25Base = 15;
      pm10Base = 30;
      gradeText = "좋음";
    } else {
      // 평시 - 보통
      pm25Base = 25;
      pm10Base = 45;
      gradeText = "보통";
    }

    // 약간의 변동 추가
    const variation = Math.random() * 10 - 5;
    const pm25Value = Math.max(5, Math.round(pm25Base + variation));
    const pm10Value = Math.max(10, Math.round(pm10Base + variation * 1.5));

    // 실제 수치에 따른 등급 재계산
    const actualGrade = this.calculateDustGrade(pm25Value, pm10Value);

    return {
      pm25: pm25Value,
      pm10: pm10Value,
      grade: actualGrade,
      pm25Grade: this.getDustGradeFromValue(pm25Value, "pm25"),
      pm10Grade: this.getDustGradeFromValue(pm10Value, "pm10"),
      location: location,
      stationName: "추정값",
      dataTime: TimeHelper.format(TimeHelper.now(), "full"),
      timestamp: TimeHelper.format(TimeHelper.now(), "time"),
      source: "추정 데이터",
      isReal: false,
      advice: this.getDustAdvice(actualGrade),
      notice: "실제 미세먼지 API 연결 시 정확한 정보를 제공합니다.",
    };
  }

  /**
   * 📊 수치로부터 미세먼지 등급 계산
   */
  calculateDustGrade(pm25, pm10) {
    const pm25Grade = this.getDustGradeFromValue(pm25, "pm25");
    const pm10Grade = this.getDustGradeFromValue(pm10, "pm10");

    // 더 나쁜 등급을 선택
    const grades = ["좋음", "보통", "나쁨", "매우나쁨"];
    const pm25Index = grades.indexOf(pm25Grade);
    const pm10Index = grades.indexOf(pm10Grade);

    return grades[Math.max(pm25Index, pm10Index)];
  }

  /**
   * 🎯 수치별 미세먼지 등급 판정
   */
  getDustGradeFromValue(value, type) {
    if (type === "pm25") {
      if (value <= 15) return "좋음";
      if (value <= 35) return "보통";
      if (value <= 75) return "나쁨";
      return "매우나쁨";
    } else {
      // pm10
      if (value <= 30) return "좋음";
      if (value <= 80) return "보통";
      if (value <= 150) return "나쁨";
      return "매우나쁨";
    }
  }

  /**
   * 🌤️ 날씨 예보 조회 (기존과 동일)
   */
  async getForecast(location) {
    try {
      const cacheKey = `forecast_${location}`;
      const cached = this.getCached(this.forecastCache, cacheKey);

      if (cached) {
        this.stats.cacheHits++;
        return this.createSuccessResponse(cached, "캐시된 예보 정보");
      }

      if (!this.config.apiKey) {
        logger.warn(`⚠️ API 키 없음 - ${location} 예보 Mock 데이터 사용`);
        const mockForecast = this.createMockForecastData(location);
        mockForecast.isOffline = true;
        mockForecast.source = "Mock (API 키 없음)";
        return this.createSuccessResponse(mockForecast, "Mock 예보 정보");
      }

      const mappedCity = this.cityMapping[location] || `${location},KR`;

      logger.info(`🌐 실제 예보 API 호출: ${location} → ${mappedCity}`);

      const response = await axios.get(`${this.config.baseUrl}/forecast`, {
        params: {
          q: mappedCity,
          appid: this.config.apiKey,
          units: "metric",
          lang: "kr",
          cnt: 40,
        },
        timeout: 15000,
      });

      if (response.data && response.data.list) {
        const forecastData = this.parseOpenWeatherForecast(
          response.data,
          location
        );

        this.setCached(this.forecastCache, cacheKey, forecastData);
        this.stats.apiCalls++;

        logger.success(
          `✅ 실제 예보 API 성공: ${location} (${response.data.list.length}개 데이터)`
        );
        return this.createSuccessResponse(
          forecastData,
          "실제 예보 정보 조회 성공"
        );
      } else {
        throw new Error("API 응답에 예보 데이터가 없습니다");
      }
    } catch (error) {
      this.stats.errors++;
      logger.error(`❌ 예보 API 실패 (${location}):`, error.message);

      const mockForecast = this.createMockForecastData(location);
      mockForecast.isOffline = true;
      mockForecast.error = error.message;
      mockForecast.source = "Mock (API 실패)";

      return this.createSuccessResponse(mockForecast, "폴백 예보 정보");
    }
  }

  // ... 기존 메서드들 (parseOpenWeatherForecast, groupForecastByDay 등)은 동일하게 유지

  parseOpenWeatherForecast(apiResponse, originalLocation) {
    try {
      const { list, city } = apiResponse;
      const dailyForecasts = this.groupForecastByDay(list);

      return {
        location: originalLocation,
        cityName: city?.name || originalLocation,
        country: city?.country || "KR",
        forecast: dailyForecasts,
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        isOffline: false,
        source: "OpenWeatherMap 5-day forecast",
        meta: {
          totalItems: list.length,
          apiResponse: true,
          hasApiData: true,
        },
      };
    } catch (error) {
      logger.error("예보 API 응답 파싱 실패:", error);
      throw new Error("예보 데이터 파싱 실패");
    }
  }

  groupForecastByDay(forecastList) {
    const dailyData = new Map();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    forecastList.forEach((item, index) => {
      const date = new Date(item.dt * 1000);
      const dateKey = TimeHelper.format(date, "MM/DD");

      if (!dailyData.has(dateKey)) {
        const dayOfWeek =
          index === 0 ? "오늘" : weekdays[date.getDay()] + "요일";

        dailyData.set(dateKey, {
          date: dateKey,
          dayOfWeek: dayOfWeek,
          temperatures: [],
          conditions: [],
          icons: [],
          humidity: [],
          rainProbability: 0,
        });
      }

      const dayData = dailyData.get(dateKey);
      dayData.temperatures.push(Math.round(item.main.temp));
      dayData.conditions.push(item.weather[0].description);
      dayData.icons.push(item.weather[0].icon);
      dayData.humidity.push(item.main.humidity);

      if (
        item.weather[0].main.includes("Rain") ||
        item.weather[0].main.includes("Snow") ||
        item.weather[0].main.includes("Drizzle")
      ) {
        dayData.rainProbability = Math.max(
          dayData.rainProbability,
          Math.round((item.pop || 0) * 100)
        );
      }
    });

    return Array.from(dailyData.values())
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        tempMin: Math.min(...day.temperatures),
        tempMax: Math.max(...day.temperatures),
        description: this.getMostFrequentCondition(day.conditions),
        icon: this.getMostFrequentIcon(day.icons),
        humidity: Math.round(
          day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length
        ),
        rainProbability: day.rainProbability,
      }));
  }

  getMostFrequentCondition(conditions) {
    const counts = {};
    conditions.forEach((condition) => {
      counts[condition] = (counts[condition] || 0) + 1;
    });

    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
  }

  getMostFrequentIcon(icons) {
    const counts = {};
    icons.forEach((icon) => {
      counts[icon] = (counts[icon] || 0) + 1;
    });

    const mostFrequentIcon = Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );

    const Weather = require("../database/models/Weather");
    return Weather.getWeatherIcon(mostFrequentIcon);
  }

  createMockForecastData(location) {
    logger.warn(`🎭 Mock 예보 데이터 생성: ${location}`);

    const days = [];
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    for (let i = 0; i < 5; i++) {
      const date = new Date(Date.now() + i * 86400000);
      const dayOfWeek = i === 0 ? "오늘" : weekdays[date.getDay()] + "요일";

      days.push({
        date: TimeHelper.format(date, "MM/DD"),
        dayOfWeek: dayOfWeek,
        tempMin: Math.round(15 + Math.random() * 5),
        tempMax: Math.round(25 + Math.random() * 8),
        description: ["맑음", "구름조금", "흐림", "비"][
          Math.floor(Math.random() * 4)
        ],
        icon: ["☀️", "⛅", "☁️", "🌧️"][Math.floor(Math.random() * 4)],
        humidity: Math.round(50 + Math.random() * 30),
        rainProbability: Math.round(Math.random() * 50),
      });
    }

    return {
      location,
      forecast: days,
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      isOffline: true,
      source: "Mock 데이터 (개발용)",
    };
  }

  createMockWeatherData(location) {
    const Weather = require("../database/models/Weather");
    return Weather.createFallbackWeather(location);
  }

  // 캐시 및 유틸리티 메서드들
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

  setupCacheCleaning() {
    setInterval(() => {
      [this.weatherCache, this.dustCache, this.forecastCache].forEach(
        (cache) => {
          for (const [key, item] of cache.entries()) {
            if (Date.now() - item.timestamp >= this.config.cacheTimeout) {
              cache.delete(key);
            }
          }
        }
      );
    }, this.config.cacheTimeout);
  }

  createSuccessResponse(data, message) {
    return { success: true, data, message };
  }

  createErrorResponse(error, message) {
    return { success: false, error: error.message, message };
  }

  getStatus() {
    return {
      isHealthy: true,
      hasApiKey: !!this.config.apiKey,
      hasdustApiKey: !!this.config.dustApiKey,
      apiKeyStatus: this.config.apiKey ? "설정됨" : "없음",
      dustApiKeyStatus: this.config.dustApiKey ? "설정됨" : "없음",
      mockMode: !this.config.apiKey,
      dustMockMode: !this.config.dustApiKey,
      cacheSize: {
        weather: this.weatherCache.size,
        dust: this.dustCache.size,
        forecast: this.forecastCache.size,
      },
      stats: this.stats,
      supportedCities: Object.keys(this.cityMapping).length,
    };
  }

  async cleanup() {
    this.weatherCache.clear();
    this.dustCache.clear();
    this.forecastCache.clear();
    await super.cleanup();
    logger.info("✅ WeatherService 정리 완료");
  }
}

module.exports = WeatherService;
