// src/services/WeatherService.js
// 🔧 Weather 서비스 - 데이터 조회 및 가공만!

const BaseService = require("./BaseService");
const logger = require('../utils/core/Logger');
const axios = require("axios");

/**
 * WeatherService - SoC 원칙 준수
 * ✅ 역할: API 호출, 데이터 변환, 캐싱
 * ❌ 금지: UI 로직, Mock 데이터 생성
 */
class WeatherService extends BaseService {
  constructor(serviceManager, config = {}) {
    super("weather", serviceManager);

    this.config = {
      apiKey: process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY,
      apiUrl: "https://api.openweathermap.org/data/2.5",
      dustApiKey: process.env.AIR_KOREA_API_KEY
        ? decodeURIComponent(process.env.AIR_KOREA_API_KEY)
        : process.env.DUST_API_KEY,
      dustApiUrl:
        "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
      cacheTimeout: 300000, // 5분
      ...config
    };

    // 캐시 저장소
    this.weatherCache = new Map();
    this.dustCache = new Map();

    // API 키 검증
    if (!this.config.apiKey) {
      logger.error("❌ OpenWeatherMap API 키가 설정되지 않았습니다");
    } else {
      logger.info(
        `✅ OpenWeatherMap API 키 설정됨 (길이: ${this.config.apiKey.length})`
      );
    }

    logger.info("✅ WeatherService 초기화 완료");

    // API 키 디버깅
    if (this.config.dustApiKey) {
      logger.debug("🔑 미세먼지 API 키 정보:", {
        length: this.config.dustApiKey.length,
        hasSpecialChars: /[\/+=]/.test(this.config.dustApiKey),
        isEncoded: this.config.dustApiKey.includes("%")
      });
    }
  }

  /**
   * 현재 날씨 조회
   */
  async getCurrentWeather(location) {
    try {
      // 1. 캐시 확인
      const cached = this.getCached(this.weatherCache, location);
      if (cached) {
        logger.debug(`📦 캐시된 날씨 데이터 반환: ${location}`);
        return this.createSuccessResponse(cached, "캐시된 데이터");
      }

      // 2. API 키 확인
      if (!this.config.apiKey) {
        // 개발 환경에서만 테스트 데이터 반환
        if (process.env.NODE_ENV === "development") {
          logger.warn("⚠️ API 키 없음 - 테스트 데이터 반환");
          const testData = {
            location,
            temperature: 20,
            feelsLike: 18,
            tempMin: 15,
            tempMax: 25,
            humidity: 60,
            pressure: 1013,
            description: "[테스트] 맑음",
            iconCode: "01d",
            windSpeed: 3.5,
            cloudiness: 20,
            timestamp: new Date().toISOString()
          };
          this.setCached(this.weatherCache, location, testData);
          return this.createSuccessResponse(testData, "⚠️ 테스트 데이터입니다");
        }
        throw new Error("날씨 API 키가 설정되지 않았습니다");
      }

      // 3. API 호출
      const apiData = await this.fetchWeatherFromAPI(location);

      // 4. 데이터 변환
      const weatherData = this.transformWeatherData(apiData, location);

      // 5. 캐시 저장
      this.setCached(this.weatherCache, location, weatherData);

      return this.createSuccessResponse(weatherData);
    } catch (error) {
      logger.error(`날씨 조회 실패: ${location}`, error);
      return this.createErrorResponse(error, "날씨 정보 조회 실패");
    }
  }

  /**
   * 미세먼지 정보 조회
   */
  async getDustInfo(location) {
    try {
      // 캐시 확인
      const cached = this.getCached(this.dustCache, location);
      if (cached) {
        return this.createSuccessResponse(cached, "캐시된 데이터");
      }

      // API 키 확인
      if (!this.config.dustApiKey) {
        throw new Error("미세먼지 API 키가 설정되지 않았습니다");
      }

      // API 호출
      const apiData = await this.fetchDustFromAPI(location);

      // 데이터 변환
      const dustData = this.transformDustData(apiData, location);

      // 캐시 저장
      this.setCached(this.dustCache, location, dustData);

      return this.createSuccessResponse(dustData);
    } catch (error) {
      logger.error(`미세먼지 조회 실패: ${location}`, error);
      return this.createErrorResponse(error, "미세먼지 정보 조회 실패");
    }
  }

  /**
   * 날씨 예보 조회
   */
  async getForecast(location) {
    try {
      if (!this.config.apiKey) {
        throw new Error("날씨 API 키가 설정되지 않았습니다");
      }

      // 한글 도시명을 영어로 변환
      const cityNameMap = {
        서울시: "Seoul",
        서울: "Seoul",
        수원시: "Suwon",
        수원: "Suwon",
        인천시: "Incheon",
        인천: "Incheon",
        대전시: "Daejeon",
        대전: "Daejeon",
        대구시: "Daegu",
        대구: "Daegu",
        부산시: "Busan",
        부산: "Busan",
        광주시: "Gwangju",
        광주: "Gwangju",
        제주시: "Jeju",
        제주: "Jeju"
      };

      const englishLocation = cityNameMap[location] || location;

      const response = await axios.get(`${this.config.apiUrl}/forecast`, {
        params: {
          q: englishLocation + ",KR",
          appid: this.config.apiKey,
          units: "metric",
          lang: "kr",
          cnt: 40 // 5일치
        }
      });

      const forecastData = this.transformForecastData(response.data, location);
      return this.createSuccessResponse(forecastData);
    } catch (error) {
      logger.error(`날씨 예보 조회 실패: ${location}`, error);
      return this.createErrorResponse(error, "날씨 예보 조회 실패");
    }
  }

  // ===== Private Methods =====

  /**
   * OpenWeatherMap API 호출
   */
  async fetchWeatherFromAPI(location) {
    // 한글 도시명을 영어로 변환
    const cityNameMap = {
      서울시: "Seoul",
      서울: "Seoul",
      수원시: "Suwon",
      수원: "Suwon",
      인천시: "Incheon",
      인천: "Incheon",
      대전시: "Daejeon",
      대전: "Daejeon",
      대구시: "Daegu",
      대구: "Daegu",
      부산시: "Busan",
      부산: "Busan",
      광주시: "Gwangju",
      광주: "Gwangju",
      제주시: "Jeju",
      제주: "Jeju"
    };

    const englishLocation = cityNameMap[location] || location;

    const url = `${this.config.apiUrl}/weather`;
    const params = {
      q: englishLocation + ",KR", // 한국 지정
      appid: this.config.apiKey,
      units: "metric",
      lang: "kr"
    };

    logger.debug(`🌐 API 호출: ${url}`, {
      originalLocation: location,
      englishLocation,
      hasApiKey: !!this.config.apiKey
    });

    const response = await axios.get(url, {
      params,
      timeout: 5000
    });

    return response.data;
  }

  /**
   * 날씨 데이터 변환 (API → 내부 형식)
   */
  transformWeatherData(apiData, originalLocation) {
    const weather = apiData.weather?.[0] || {};
    const main = apiData.main || {};
    const wind = apiData.wind || {};

    return {
      location: originalLocation,
      temperature: Math.round(main.temp),
      feelsLike: Math.round(main.feels_like),
      tempMin: Math.round(main.temp_min),
      tempMax: Math.round(main.temp_max),
      humidity: main.humidity,
      pressure: main.pressure,
      description: weather.description || "정보 없음",
      iconCode: weather.icon || "01d",
      windSpeed: wind.speed || 0,
      cloudiness: apiData.clouds?.all || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 미세먼지 API 호출 (에어코리아)
   */
  async fetchDustFromAPI(location) {
    // 도시명을 시도명으로 변환
    const sidoName = this.extractSidoName(location);

    logger.debug(`🌬️ 미세먼지 API 호출`, {
      location,
      sidoName,
      url: this.config.dustApiUrl,
      hasApiKey: !!this.config.dustApiKey
    });

    try {
      // URL과 파라미터를 직접 구성
      const params = new URLSearchParams({
        serviceKey: this.config.dustApiKey,
        returnType: "json",
        numOfRows: "100",
        pageNo: "1",
        sidoName: sidoName, // 인코딩하지 않음
        ver: "1.0"
      });

      const fullUrl = `${this.config.dustApiUrl}?${params.toString()}`;
      logger.debug(
        `🌬️ 전체 API URL:`,
        fullUrl.replace(this.config.dustApiKey, "API_KEY_HIDDEN")
      );

      const response = await axios.get(this.config.dustApiUrl, {
        params: {
          serviceKey: this.config.dustApiKey,
          returnType: "json",
          numOfRows: 100,
          pageNo: 1,
          sidoName: sidoName,
          ver: "1.0"
        },
        timeout: 10000,
        headers: {
          Accept: "application/json"
        }
      });

      // 전체 응답 구조 확인
      logger.debug(`🌬️ API 응답 구조:`, {
        status: response.status,
        hasData: !!response.data,
        hasResponse: !!response.data?.response,
        hasBody: !!response.data?.response?.body,
        totalCount: response.data?.response?.body?.totalCount
      });

      // 응답 확인
      const responseData = response.data?.response;

      // 에러 체크
      if (responseData?.header?.resultCode !== "00") {
        logger.error(`미세먼지 API 에러:`, responseData?.header);
        return null;
      }

      const body = responseData?.body;
      if (!body) {
        logger.warn(`미세먼지 응답 본문 없음`);
        return null;
      }

      // totalCount가 0이어도 items 배열 확인
      const items = Array.isArray(body.items)
        ? body.items
        : body.items && Array.isArray(body.items.item)
          ? body.items.item
          : [];

      logger.debug(`🌬️ 미세먼지 데이터:`, {
        totalCount: body.totalCount,
        itemsLength: items.length,
        itemsType: Array.isArray(items) ? "array" : typeof items
      });

      if (items.length === 0) {
        logger.warn(`미세먼지 데이터 없음: ${location} (${sidoName})`);
        return null;
      }

      // 처음 몇 개 측정소 이름 로그
      if (items.length > 0) {
        logger.debug(
          `🌬️ 측정소 예시:`,
          items.slice(0, 3).map((item) => ({
            stationName: item.stationName,
            pm10: item.pm10Value,
            pm25: item.pm25Value
          }))
        );
      }

      // 해당 도시의 측정소 데이터 찾기
      const cityName = location.replace("시", "");
      const cityData =
        items.find((item) => item.stationName?.includes(cityName)) || items[0]; // 못 찾으면 첫 번째 데이터 사용

      if (cityData) {
        logger.debug(`🌬️ 선택된 측정소:`, {
          stationName: cityData.stationName,
          pm10: cityData.pm10Value,
          pm25: cityData.pm25Value,
          dataTime: cityData.dataTime
        });
      }

      return cityData;
    } catch (error) {
      logger.error(`미세먼지 API 호출 실패:`, error.message);
      if (error.response) {
        logger.error(`API 응답 에러:`, {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  /**
   * 미세먼지 데이터 변환
   */
  transformDustData(apiData, location) {
    if (!apiData) {
      throw new Error("미세먼지 데이터가 없습니다");
    }

    const pm10Value = parseInt(apiData.pm10Value) || 0;
    const pm25Value = parseInt(apiData.pm25Value) || 0;

    return {
      location,
      pm10: pm10Value,
      pm25: pm25Value,
      pm10Grade: apiData.pm10Grade || "-",
      pm25Grade: apiData.pm25Grade || "-",
      grade: this.calculateDustGrade(pm10Value, pm25Value),
      dataTime: apiData.dataTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 예보 데이터 변환
   */
  transformForecastData(apiData, location) {
    const forecasts = apiData.list.reduce((acc, item) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split("T")[0];

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          temps: [],
          descriptions: [],
          icons: [],
          humidity: []
        };
      }

      acc[dateKey].temps.push(item.main.temp);
      acc[dateKey].descriptions.push(item.weather[0].description);
      acc[dateKey].icons.push(item.weather[0].icon);
      acc[dateKey].humidity.push(item.main.humidity);

      return acc;
    }, {});

    // 일별 요약 생성
    const dailyForecasts = Object.values(forecasts)
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        tempMin: Math.round(Math.min(...day.temps)),
        tempMax: Math.round(Math.max(...day.temps)),
        description: this.getMostFrequent(day.descriptions),
        iconCode: this.getMostFrequent(day.icons),
        avgHumidity: Math.round(
          day.humidity.reduce((a, b) => a + b) / day.humidity.length
        )
      }));

    return {
      location,
      forecasts: dailyForecasts,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 미세먼지 등급 계산
   */
  calculateDustGrade(pm10, pm25) {
    if (pm10 <= 30 && pm25 <= 15) return "좋음";
    if (pm10 <= 80 && pm25 <= 35) return "보통";
    if (pm10 <= 150 && pm25 <= 75) return "나쁨";
    return "매우나쁨";
  }

  /**
   * 가장 빈번한 요소 찾기
   */
  getMostFrequent(arr) {
    const counts = {};
    arr.forEach((item) => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
  }

  /**
   * 시도명 추출
   */
  extractSidoName(location) {
    // 주요 도시 매핑 (공공 API 형식에 맞춤)
    const sidoMap = {
      서울: "서울",
      서울시: "서울",
      수원: "경기",
      수원시: "경기",
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
      제주시: "제주"
    };

    const cityName = location.replace("시", "");
    return sidoMap[cityName] || sidoMap[location] || cityName;
  }

  /**
   * 캐시 조회
   */
  getCached(cache, key) {
    const item = cache.get(key);
    if (item && Date.now() - item.timestamp < this.config.cacheTimeout) {
      return item.data;
    }
    cache.delete(key);
    return null;
  }

  /**
   * 캐시 저장
   */
  setCached(cache, key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 서비스 상태
   */
  getStatus() {
    return {
      ...super.getStatus(),
      hasApiKey: !!this.config.apiKey,
      hasDustApiKey: !!this.config.dustApiKey,
      cacheSize: {
        weather: this.weatherCache.size,
        dust: this.dustCache.size
      }
    };
  }

  /**
   * 정리
   */
  async cleanup() {
    this.weatherCache.clear();
    this.dustCache.clear();
    await super.cleanup();
  }
}

module.exports = WeatherService;
