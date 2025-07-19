// src/services/WeatherService.js - 도시명 및 메시지 포맷팅 수정

const {
  ensureConnection,
  getCollection,
} = require("../database/DatabaseManager");
const axios = require("axios");

class WeatherService {
  constructor(apiKey) {
    // 🔧 Railway 환경변수에서 API 키 가져오기
    this.apiKey = apiKey || process.env.WEATHER_API_KEY;

    // 🚨 디버그 로그 추가
    console.log("🌤️ WeatherService 초기화");
    console.log(
      "🔑 API 키 상태:",
      this.apiKey ? `설정됨 (${this.apiKey.slice(0, 8)}...)` : "❌ 없음"
    );

    // 🔧 도시 매핑 개선 (OpenWeatherMap 호환)
    this.cityMapping = {
      화성: "Suwon,KR", // 화성은 수원으로 대체 (근접 지역)
      동탄: "Suwon,KR", // 동탄도 수원으로 대체
      서울: "Seoul,KR",
      부산: "Busan,KR",
      인천: "Incheon,KR",
      광주: "Gwangju,KR",
      대전: "Daejeon,KR",
      울산: "Ulsan,KR",
      제주: "Jeju,KR",
      수원: "Suwon,KR",
      성남: "Seongnam,KR",
    };
  }

  // 도시명 유효성 검사 및 변환
  validateCity(inputCity) {
    if (!inputCity) return "화성";

    const normalizedInput = inputCity.trim();

    // 한글 도시명인 경우 영문으로 변환
    if (this.cityMapping[normalizedInput]) {
      console.log(
        `🏙️ 도시 매핑: ${normalizedInput} → ${this.cityMapping[normalizedInput]}`
      );
      return this.cityMapping[normalizedInput];
    }

    // 영문 도시명인 경우 그대로 사용
    return normalizedInput;
  }

  // 현재 날씨 정보 가져오기
  async getCurrentWeather(city = "화성") {
    console.log(`🌤️ 날씨 요청: ${city}`);
    console.log(`🔑 현재 API 키: ${this.apiKey ? "있음" : "없음"}`);

    try {
      const validatedCity = this.validateCity(city);
      console.log(`📍 최종 도시명: ${city} → ${validatedCity}`);

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

      if (error.response?.status === 404) {
        console.error("🏙️ 도시를 찾을 수 없음, 수원으로 대체 시도");

        try {
          // 도시를 찾을 수 없으면 수원으로 재시도
          const fallbackUrl = `https://api.openweathermap.org/data/2.5/weather?q=Suwon,KR&appid=${this.apiKey}&units=metric&lang=kr`;
          const fallbackResponse = await axios.get(fallbackUrl, {
            timeout: 10000,
          });
          console.log("✅ 대체 도시 응답 성공:", fallbackResponse.data.name);

          // 원래 요청한 도시명으로 표시명 변경
          fallbackResponse.data.displayName = city;
          return fallbackResponse.data;
        } catch (fallbackError) {
          console.error("❌ 대체 도시도 실패:", fallbackError.message);
        }
      }

      // 최종적으로 더미 데이터 반환
      return this.getDummyWeatherData(city, error.message);
    }
  }

  // 더미 데이터 생성
  getDummyWeatherData(city, errorMessage = null) {
    return {
      name: city,
      displayName: city,
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

  // 🔧 안전한 날씨 메시지 포맷팅 (Markdown 오류 방지)
  formatWeatherMessage(weatherData) {
    try {
      const { name, displayName, main, weather, wind, sys } = weatherData;

      // 표시할 도시명 결정
      const cityName = displayName || name || "알 수 없는 지역";

      const temp = Math.round(main.temp);
      const feelsLike = Math.round(main.feels_like);
      const humidity = main.humidity;
      const windSpeed = wind ? Math.round(wind.speed * 10) / 10 : 0;
      const description = weather[0].description;

      // 날씨 아이콘 선택
      const weatherIcon = this.getWeatherIcon(weather[0].main);

      // 옷차림 추천
      const clothingAdvice = this.getClothingAdvice(temp);

      // 🔧 Markdown 특수문자 이스케이프 처리
      const safeCityName = this.escapeMarkdown(cityName);
      const safeDescription = this.escapeMarkdown(description);
      const safeClothingAdvice = this.escapeMarkdown(clothingAdvice);

      let message = `${weatherIcon} *${safeCityName} 현재 날씨*\n\n`;
      message += `🌡️ *온도*: ${temp}°C (체감 ${feelsLike}°C)\n`;
      message += `💧 *습도*: ${humidity}%\n`;
      message += `🌬️ *바람*: ${windSpeed}m/s\n`;
      message += `☁️ *날씨*: ${safeDescription}\n\n`;
      message += `👔 *추천 옷차림*: ${safeClothingAdvice}`;

      // 🚨 더미 데이터 표시 개선
      if (weatherData.isDummy) {
        if (weatherData.errorMessage) {
          message += `\n\n❌ _API 오류 발생_`;
          message += `\n⚠️ _임시 데이터를 표시합니다_`;
        } else {
          message += `\n\n⚠️ _API 키가 설정되지 않아 샘플 데이터를 표시합니다_`;
        }
        message += `\n🔧 _실제 날씨 정보를 보려면 WEATHER_API_KEY를 확인해주세요_`;
      }

      return message;
    } catch (error) {
      console.error("❌ 날씨 메시지 포맷팅 오류:", error);
      return `❌ 날씨 정보 표시 중 오류가 발생했습니다.`;
    }
  }

  // 예보 메시지 포맷팅
  formatForecastMessage(forecastData, city) {
    try {
      const cityName = forecastData.city ? forecastData.city.name : city;
      const safeCityName = this.escapeMarkdown(cityName);

      let message = `📅 *${safeCityName} 시간별 예보*\n\n`;

      // 처음 8개 예보만 표시 (24시간)
      const forecasts = forecastData.list.slice(0, 8);

      forecasts.forEach((forecast, index) => {
        const date = new Date(forecast.dt_txt);
        const time = date.getHours();
        const temp = Math.round(forecast.main.temp);
        const desc = this.escapeMarkdown(forecast.weather[0].description);
        const icon = this.getWeatherIcon(forecast.weather[0].main);

        message += `${icon} *${time}시*: ${temp}°C, ${desc}\n`;
      });

      if (forecastData.isDummy) {
        message += `\n⚠️ _샘플 예보 데이터입니다_`;
        message += `\n🔧 _실제 예보를 보려면 WEATHER_API_KEY를 확인해주세요_`;
      }

      return message;
    } catch (error) {
      console.error("❌ 예보 메시지 포맷팅 오류:", error);
      return `❌ 예보 정보 표시 중 오류가 발생했습니다.`;
    }
  }

  // 🔧 Markdown 특수문자 이스케이프
  escapeMarkdown(text) {
    if (!text) return "";

    // Markdown에서 특별한 의미를 가지는 문자들을 이스케이프
    return text.replace(/([_*\]()~`>#+=|{}!-])/g, "\\$1");
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
    if (temp >= 28) return "반팔, 반바지, 샌들";
    if (temp >= 23) return "얇은 셔츠, 긴바지";
    if (temp >= 20) return "긴팔, 얇은 가디건";
    if (temp >= 17) return "자켓, 니트";
    if (temp >= 12) return "트렌치코트, 스웨터";
    if (temp >= 9) return "자켓, 가디건";
    if (temp >= 5) return "코트, 히트텍";
    return "패딩, 목도리, 장갑";
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
