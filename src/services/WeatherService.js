// src/services/WeatherService.js - 디버깅 버전
const {
  ensureConnection,
  getCollection,
} = require("../database/DatabaseManager");
const axios = require("axios");

class WeatherService {
  constructor(apiKey) {
    // 🔧 다양한 방법으로 API 키 찾기
    this.apiKey =
      apiKey ||
      process.env.WEATHER_API_KEY ||
      process.env.OPENWEATHER_API_KEY ||
      process.env.OPENWEATHERMAP_API_KEY;

    // 🚨 디버그 로그 추가
    console.log("🌤️ WeatherService 초기화");
    console.log(
      "🔑 API 키 상태:",
      this.apiKey ? `설정됨 (${this.apiKey.slice(0, 8)}...)` : "❌ 없음"
    );
    console.log("📍 환경변수들:", {
      WEATHER_API_KEY: process.env.WEATHER_API_KEY ? "O" : "X",
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY ? "O" : "X",
      NODE_ENV: process.env.NODE_ENV,
    });

    // 도시 매핑 (한글 -> 영문)
    this.cityMapping = {
      화성: "Hwaseong",
      동탄: "Dongtan",
      서울: "Seoul",
      부산: "Busan",
      인천: "Incheon",
      광주: "Gwangju",
      대전: "Daejeon",
      울산: "Ulsan",
      제주: "Jeju",
      수원: "Suwon",
      성남: "Seongnam",
    };
  }

  // 도시명 유효성 검사 및 변환
  validateCity(inputCity) {
    if (!inputCity) return "화성";

    const normalizedInput = inputCity.trim();

    // 한글 도시명인 경우 영문으로 변환
    if (this.cityMapping[normalizedInput]) {
      return this.cityMapping[normalizedInput];
    }

    // 영문 도시명인 경우 그대로 사용
    return normalizedInput;
  }

  // 현재 날씨 정보 가져오기 (WeatherModule에서 호출하는 메서드)
  async getCurrentWeather(city = "화성") {
    console.log(`🌤️ 날씨 요청: ${city}`);
    console.log(`🔑 현재 API 키: ${this.apiKey ? "있음" : "없음"}`);

    try {
      const validatedCity = this.validateCity(city);
      console.log(`📍 변환된 도시명: ${city} -> ${validatedCity}`);

      if (!this.apiKey) {
        console.log("⚠️ API 키가 없어서 더미 데이터 반환");
        return this.getDummyWeatherData(city);
      }

      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(validatedCity)}&appid=${this.apiKey}&units=metric&lang=kr`;
      console.log(
        "🌐 API 호출 URL:",
        url.replace(this.apiKey, "API_KEY_HIDDEN")
      );

      const response = await axios.get(url, { timeout: 10000 });
      console.log("✅ API 응답 성공:", response.data.name);

      return response.data;
    } catch (error) {
      console.error("❌ Weather API 오류:", error.message);
      console.error("📊 오류 상세:", {
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // 오류 시 더미 데이터 반환 (봇이 멈추지 않도록)
      return this.getDummyWeatherData(city, error.message);
    }
  }

  // 더미 데이터 생성
  getDummyWeatherData(city, errorMessage = null) {
    return {
      name: city,
      main: { temp: 15, feels_like: 13, humidity: 65 },
      wind: { speed: 2.5 },
      weather: [{ main: "Clouds", description: "구름많음" }],
      sys: { country: "KR" },
      coord: { lat: 37.2, lon: 127.0 },
      isDummy: true,
      errorMessage,
    };
  }

  // 날씨 예보 가져오기
  async getWeatherForecast(city = "화성") {
    try {
      const validatedCity = this.validateCity(city);

      if (!this.apiKey) {
        console.log("⚠️ API 키가 없어서 더미 예보 반환");
        return this.getDummyForecastData(city);
      }

      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(validatedCity)}&appid=${this.apiKey}&units=metric&lang=kr`;
      console.log("🌐 예보 API 호출");

      const response = await axios.get(url, { timeout: 10000 });
      console.log("✅ 예보 API 응답 성공");

      return response.data;
    } catch (error) {
      console.error("❌ Weather Forecast API 오류:", error.message);

      // 오류 시 더미 예보 반환
      return this.getDummyForecastData(city, error.message);
    }
  }

  // 더미 예보 데이터
  getDummyForecastData(city, errorMessage = null) {
    return {
      city: { name: city },
      list: [
        {
          dt_txt: new Date().toISOString(),
          main: { temp: 16, humidity: 70 },
          weather: [{ description: "맑음" }],
        },
        {
          dt_txt: new Date(Date.now() + 3600000).toISOString(),
          main: { temp: 18, humidity: 65 },
          weather: [{ description: "구름조금" }],
        },
      ],
      isDummy: true,
      errorMessage,
    };
  }

  // 날씨 메시지 포맷팅
  formatWeatherMessage(weatherData) {
    try {
      const { name, main, weather, wind, sys } = weatherData;

      const temp = Math.round(main.temp);
      const feelsLike = Math.round(main.feels_like);
      const humidity = main.humidity;
      const windSpeed = wind ? Math.round(wind.speed * 10) / 10 : 0;
      const description = weather[0].description;

      // 날씨 아이콘 선택
      const weatherIcon = this.getWeatherIcon(weather[0].main);

      // 옷차림 추천
      const clothingAdvice = this.getClothingAdvice(temp);

      let message = `${weatherIcon} **${name} 현재 날씨**\n\n`;
      message += `🌡️ **온도**: ${temp}°C (체감 ${feelsLike}°C)\n`;
      message += `💧 **습도**: ${humidity}%\n`;
      message += `🌬️ **바람**: ${windSpeed}m/s\n`;
      message += `☁️ **날씨**: ${description}\n\n`;
      message += `👔 **추천 옷차림**: ${clothingAdvice}`;

      // 🚨 더미 데이터 표시 개선
      if (weatherData.isDummy) {
        if (weatherData.errorMessage) {
          message += `\n\n❌ *API 오류: ${weatherData.errorMessage}*`;
          message += `\n⚠️ *임시 데이터를 표시합니다*`;
        } else {
          message += `\n\n⚠️ *API 키가 설정되지 않아 샘플 데이터를 표시합니다*`;
        }
        message += `\n🔧 *실제 날씨 정보를 보려면 WEATHER_API_KEY를 확인해주세요*`;
      }

      return message;
    } catch (error) {
      return `❌ 날씨 정보 포맷팅 오류: ${error.message}`;
    }
  }

  // 예보 메시지 포맷팅
  formatForecastMessage(forecastData, city) {
    try {
      const cityName = forecastData.city ? forecastData.city.name : city;
      let message = `📅 **${cityName} 시간별 예보**\n\n`;

      // 처음 8개 예보만 표시 (24시간)
      const forecasts = forecastData.list.slice(0, 8);

      forecasts.forEach((forecast, index) => {
        const date = new Date(forecast.dt_txt);
        const time = date.getHours();
        const temp = Math.round(forecast.main.temp);
        const desc = forecast.weather[0].description;
        const icon = this.getWeatherIcon(forecast.weather[0].main);

        message += `${icon} **${time}시**: ${temp}°C, ${desc}\n`;
      });

      if (forecastData.isDummy) {
        message += `\n⚠️ *샘플 예보 데이터입니다*`;
        message += `\n🔧 *실제 예보를 보려면 WEATHER_API_KEY를 확인해주세요*`;
      }

      return message;
    } catch (error) {
      return `❌ 예보 정보 포맷팅 오류: ${error.message}`;
    }
  }

  // 날씨 아이콘 반환
  getWeatherIcon(weatherMain) {
    const iconMap = {
      Clear: "☀️",
      Clouds: "☁️",
      Rain: "🌧️",
      Drizzle: "🌦️",
      Thunderstorm: "⛈️",
      Snow: "❄️",
      Mist: "🌫️",
      Fog: "🌫️",
      Haze: "🌫️",
      Dust: "🌪️",
      Sand: "🌪️",
      Ash: "🌋",
      Squall: "💨",
      Tornado: "🌪️",
    };

    return iconMap[weatherMain] || "🌤️";
  }

  // 온도별 옷차림 추천
  getClothingAdvice(temp) {
    if (temp >= 28) return "👕 반팔, 반바지, 샌들";
    if (temp >= 23) return "👔 얇은 셔츠, 긴바지";
    if (temp >= 20) return "👖 긴팔, 얇은 가디건";
    if (temp >= 17) return "🧥 자켓, 니트";
    if (temp >= 12) return "🧥 트렌치코트, 스웨터";
    if (temp >= 9) return "🧥 자켓, 가디건";
    if (temp >= 5) return "🧤 코트, 히트텍";
    return "🧣 패딩, 목도리, 장갑";
  }

  // 기존 getWeather 메서드 (호환성 유지)
  async getWeather(city = "Seoul") {
    try {
      const weatherData = await this.getCurrentWeather(city);
      return this.formatWeatherMessage(weatherData);
    } catch (error) {
      return `❌ 날씨 정보를 불러오지 못했습니다: ${error.message}`;
    }
  }
}

module.exports = { WeatherService };
