// src/services/WeatherService.js - 한국시간 수정

const axios = require("axios");
const { TimeHelper } = require("../utils/TimeHelper");
const { Logger } = require("../utils/Logger");

class WeatherService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.WEATHER_API_KEY;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
  }

  // 현재 날씨 정보
  async getCurrentWeather(city = "화성") {
    try {
      const url = `${this.baseUrl}/weather?q=${encodeURIComponent(
        city
      )}&appid=${this.apiKey}&units=metric&lang=kr`;
      const response = await axios.get(url);
      const data = response.data;

      // ⭐ 정확한 한국시간 처리
      const currentTime = TimeHelper.getKoreaTime();

      // 일출/일몰 시간을 한국시간으로 변환
      const sunrise = new Date((data.sys.sunrise + data.timezone) * 1000);
      const sunset = new Date((data.sys.sunset + data.timezone) * 1000);

      return {
        city: data.name,
        country: data.sys.country,
        currentTime: currentTime, // 한국시간
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg || 0,
        visibility: Math.round((data.visibility || 10000) / 1000), // km 변환
        cloudiness: data.clouds.all,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        sunrise: sunrise,
        sunset: sunset,
        timezone: data.timezone,
      };
    } catch (error) {
      Logger.error("날씨 정보 조회 실패:", error);
      throw new Error(`날씨 정보를 가져올 수 없습니다: ${error.message}`);
    }
  }

  // 5일 날씨 예보
  async getWeatherForecast(city = "화성") {
    try {
      const url = `${this.baseUrl}/forecast?q=${encodeURIComponent(
        city
      )}&appid=${this.apiKey}&units=metric&lang=kr`;
      const response = await axios.get(url);
      const data = response.data;

      const forecasts = data.list.slice(0, 8).map((item) => {
        // ⭐ UTC 시간을 한국 시간으로 정확히 변환
        const utcTime = new Date(item.dt * 1000);
        const koreaTime = TimeHelper.fromTimestamp(utcTime.getTime());

        return {
          time: koreaTime,
          temperature: Math.round(item.main.temp),
          feelsLike: Math.round(item.main.feels_like),
          humidity: item.main.humidity,
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          windSpeed: Math.round(item.wind.speed * 10) / 10, // 소수점 1자리
          pop: Math.round((item.pop || 0) * 100), // 강수 확률
        };
      });

      return {
        city: data.city.name,
        forecasts: forecasts,
        updatedAt: TimeHelper.getKoreaTime(), // 한국시간 업데이트 시간
      };
    } catch (error) {
      Logger.error("날씨 예보 조회 실패:", error);
      throw new Error(`날씨 예보를 가져올 수 없습니다: ${error.message}`);
    }
  }

  // 현재 날씨 메시지 포맷팅
  formatWeatherMessage(weatherData) {
    const currentTime = TimeHelper.formatDateTime(weatherData.currentTime);
    const sunrise = TimeHelper.formatTime(weatherData.sunrise, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sunset = TimeHelper.formatTime(weatherData.sunset, {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 날씨 아이콘 이모지 매핑
    const weatherEmoji = this.getWeatherEmoji(weatherData.icon);

    // 바람 방향
    const windDirection = this.getWindDirection(weatherData.windDirection);

    // 옷차림 추천
    const clothingAdvice = this.getClothingAdvice(weatherData.temperature);

    // 한국시간 기준 인사말
    const greeting = this.getTimeBasedGreeting();

    return (
      `${weatherEmoji} **${weatherData.city} 날씨** ${greeting}\n\n` +
      `📅 **업데이트:** ${currentTime}\n\n` +
      `🌡️ **기온:** ${weatherData.temperature}°C (체감 ${weatherData.feelsLike}°C)\n` +
      `💧 **습도:** ${weatherData.humidity}%\n` +
      `🌬️ **바람:** ${windDirection} ${weatherData.windSpeed}m/s\n` +
      `👁️ **가시거리:** ${weatherData.visibility}km\n` +
      `☁️ **구름량:** ${weatherData.cloudiness}%\n` +
      `🌅 **일출:** ${sunrise} | **일몰:** ${sunset}\n\n` +
      `📝 **현재:** ${weatherData.description}\n\n` +
      `👕 **옷차림:** ${clothingAdvice}`
    );
  }

  // 날씨 예보 메시지 포맷팅
  formatForecastMessage(forecastData) {
    const currentTime = TimeHelper.formatDateTime(forecastData.updatedAt);

    let message = `🌤️ **${forecastData.city} 시간별 예보**\n\n`;
    message += `📅 **업데이트:** ${currentTime}\n\n`;

    let currentDate = "";

    forecastData.forecasts.forEach((forecast, index) => {
      const time = TimeHelper.formatTime(forecast.time, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const date = TimeHelper.formatDate(forecast.time, {
        month: "long",
        day: "numeric",
      });
      const weatherEmoji = this.getWeatherEmoji(forecast.icon);

      // 날짜가 바뀔 때 구분선 추가
      if (date !== currentDate) {
        if (index > 0) message += "\n";
        message += `**📅 ${date}**\n`;
        currentDate = date;
      }

      message += `${weatherEmoji} **${time}** ${forecast.temperature}°C `;
      message += `(체감 ${forecast.feelsLike}°C)`;

      if (forecast.pop > 10) {
        // 10% 이상일 때만 표시
        message += ` 🌧️ ${forecast.pop}%`;
      }

      message += ` ${forecast.description}\n`;
    });

    return message;
  }

  // 한국시간 기준 인사말
  getTimeBasedGreeting() {
    const hour = TimeHelper.getCurrentHour();

    if (hour >= 6 && hour < 12) {
      return "🌅"; // 오전
    } else if (hour >= 12 && hour < 18) {
      return "☀️"; // 오후
    } else if (hour >= 18 && hour < 22) {
      return "🌆"; // 저녁
    } else {
      return "🌙"; // 밤
    }
  }

  // 날씨 아이콘을 이모지로 변환
  getWeatherEmoji(icon) {
    const iconMap = {
      "01d": "☀️", // 맑음 (낮)
      "01n": "🌙", // 맑음 (밤)
      "02d": "⛅", // 구름 조금 (낮)
      "02n": "☁️", // 구름 조금 (밤)
      "03d": "☁️", // 구름 많음
      "03n": "☁️", // 구름 많음
      "04d": "☁️", // 흐림
      "04n": "☁️", // 흐림
      "09d": "🌧️", // 소나기
      "09n": "🌧️", // 소나기
      "10d": "🌦️", // 비 (낮)
      "10n": "🌧️", // 비 (밤)
      "11d": "⛈️", // 천둥번개
      "11n": "⛈️", // 천둥번개
      "13d": "❄️", // 눈
      "13n": "❄️", // 눈
      "50d": "🌫️", // 안개
      "50n": "🌫️", // 안개
    };

    return iconMap[icon] || "🌤️";
  }

  // 바람 방향 계산
  getWindDirection(degree) {
    if (!degree && degree !== 0) return "정보 없음";

    const directions = [
      "북",
      "북북동",
      "북동",
      "동북동",
      "동",
      "동남동",
      "남동",
      "남남동",
      "남",
      "남남서",
      "남서",
      "서남서",
      "서",
      "서북서",
      "북서",
      "북북서",
    ];

    const index = Math.round(degree / 22.5) % 16;
    return directions[index];
  }

  // 기온별 옷차림 추천
  getClothingAdvice(temperature) {
    if (temperature >= 28) {
      return "반팔, 반바지, 원피스 👕🩳";
    } else if (temperature >= 23) {
      return "얇은 셔츠, 긴바지 👔👖";
    } else if (temperature >= 20) {
      return "블라우스, 긴바지, 얇은 가디건 👚🧥";
    } else if (temperature >= 17) {
      return "얇은 니트, 자켓, 가디건 🧶🧥";
    } else if (temperature >= 12) {
      return "자켓, 가디건, 청바지 🧥👖";
    } else if (temperature >= 9) {
      return "트렌치코트, 야상, 점퍼 🧥";
    } else if (temperature >= 5) {
      return "울코트, 히트텍, 니트 🧥🧣";
    } else {
      return "패딩, 두꺼운 코트, 목도리, 장갑 🧥🧣🧤";
    }
  }

  // 대기질 정보 (선택적)
  async getAirQuality(city = "화성") {
    try {
      // 먼저 좌표를 얻어야 함
      const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        city
      )}&limit=1&appid=${this.apiKey}`;
      const geoResponse = await axios.get(geoUrl);

      if (geoResponse.data.length === 0) {
        throw new Error("위치를 찾을 수 없습니다");
      }

      const { lat, lon } = geoResponse.data[0];

      // 대기질 데이터 조회
      const airUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;
      const airResponse = await axios.get(airUrl);
      const airData = airResponse.data;

      const aqi = airData.list[0].main.aqi;
      const components = airData.list[0].components;

      const aqiText =
        ["좋음", "보통", "나쁨", "매우 나쁨", "위험"][aqi - 1] || "알 수 없음";
      const aqiEmoji = ["🟢", "🟡", "🟠", "🔴", "🟣"][aqi - 1] || "⚪";

      return {
        aqi,
        aqiText,
        aqiEmoji,
        pm25: Math.round(components.pm2_5 || 0),
        pm10: Math.round(components.pm10 || 0),
        updatedAt: TimeHelper.getKoreaTime(),
      };
    } catch (error) {
      Logger.error("대기질 정보 조회 실패:", error);
      return null;
    }
  }

  // 대기질 메시지 포맷팅
  formatAirQualityMessage(airData, city) {
    if (!airData) {
      return `\n\n💨 **${city} 대기질**\n정보를 가져올 수 없습니다.`;
    }

    const updateTime = TimeHelper.formatTime(airData.updatedAt);

    return (
      `\n\n💨 **${city} 대기질** ${airData.aqiEmoji}\n` +
      `📊 **상태:** ${airData.aqiText}\n` +
      `🔸 **미세먼지(PM2.5):** ${airData.pm25}㎍/㎥\n` +
      `🔹 **미세먼지(PM10):** ${airData.pm10}㎍/㎥\n` +
      `⏰ **업데이트:** ${updateTime}`
    );
  }
}

module.exports = { WeatherService };
