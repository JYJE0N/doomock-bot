const axios = require("axios");
const { TimeHelper } = require("../utils/TimeHelper");

class WeatherService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.WEATHER_API_KEY;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";
  }

  // 현재 날씨 정보
  async getCurrentWeather(city = "화성") {
    try {
      const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=kr`;
      const response = await axios.get(url);
      const data = response.data;

      // 한국 시간으로 변환
      const currentTime = TimeHelper.getKoreaTime();
      const sunrise = new Date((data.sys.sunrise + data.timezone) * 1000);
      const sunset = new Date((data.sys.sunset + data.timezone) * 1000);

      return {
        city: data.name,
        country: data.sys.country,
        currentTime: currentTime,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        visibility: data.visibility / 1000, // km 변환
        cloudiness: data.clouds.all,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        sunrise: sunrise,
        sunset: sunset,
        timezone: data.timezone,
      };
    } catch (error) {
      throw new Error(`날씨 정보를 가져올 수 없습니다: ${error.message}`);
    }
  }

  // 5일 날씨 예보
  async getWeatherForecast(city = "화성") {
    try {
      const url = `${this.baseUrl}/forecast?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=kr`;
      const response = await axios.get(url);
      const data = response.data;

      const forecasts = data.list.slice(0, 8).map((item) => {
        // UTC 시간을 한국 시간으로 변환
        const forecastTime = new Date(item.dt * 1000);
        const koreaTime = new Date(forecastTime.getTime() + 9 * 60 * 60 * 1000); // UTC+9

        return {
          time: koreaTime,
          temperature: Math.round(item.main.temp),
          feelsLike: Math.round(item.main.feels_like),
          humidity: item.main.humidity,
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          windSpeed: item.wind.speed,
          pop: Math.round(item.pop * 100), // 강수 확률
        };
      });

      return {
        city: data.city.name,
        forecasts: forecasts,
      };
    } catch (error) {
      throw new Error(`날씨 예보를 가져올 수 없습니다: ${error.message}`);
    }
  }

  // 현재 날씨 메시지 포맷팅
  formatWeatherMessage(weatherData) {
    const currentTime = TimeHelper.formatDateTime(weatherData.currentTime);
    const sunrise = TimeHelper.formatTime(weatherData.sunrise);
    const sunset = TimeHelper.formatTime(weatherData.sunset);

    // 날씨 아이콘 이모지 매핑
    const weatherEmoji = this.getWeatherEmoji(weatherData.icon);

    // 바람 방향
    const windDirection = this.getWindDirection(weatherData.windDirection);

    // 옷차림 추천
    const clothingAdvice = this.getClothingAdvice(weatherData.temperature);

    return (
      `${weatherEmoji} **${weatherData.city} 날씨**\n\n` +
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
  formatForecastMessage(forecastData, city) {
    const currentTime = TimeHelper.formatDateTime(TimeHelper.getKoreaTime());

    let message = `🌤️ **${forecastData.city} 시간별 예보**\n\n`;
    message += `📅 **업데이트:** ${currentTime}\n\n`;

    forecastData.forecasts.forEach((forecast, index) => {
      const time = TimeHelper.formatTime(forecast.time);
      const date = TimeHelper.formatDate(forecast.time);
      const weatherEmoji = this.getWeatherEmoji(forecast.icon);

      // 첫 번째와 이후 날짜가 다를 때 날짜 구분선 추가
      if (index === 0) {
        message += `**📅 ${date}**\n`;
      } else if (index > 0) {
        const prevDate = TimeHelper.formatDate(
          forecastData.forecasts[index - 1].time
        );
        const currentDate = TimeHelper.formatDate(forecast.time);
        if (prevDate !== currentDate) {
          message += `\n**📅 ${currentDate}**\n`;
        }
      }

      message += `${weatherEmoji} **${time}** ${forecast.temperature}°C `;
      message += `(체감 ${forecast.feelsLike}°C) `;
      if (forecast.pop > 0) {
        message += `🌧️ ${forecast.pop}% `;
      }
      message += `${forecast.description}\n`;
    });

    return message;
  }

  // 날씨 아이콘을 이모지로 변환
  getWeatherEmoji(icon) {
    const iconMap = {
      "01d": "☀️",
      "01n": "🌙", // 맑음
      "02d": "⛅",
      "02n": "☁️", // 구름 조금
      "03d": "☁️",
      "03n": "☁️", // 구름 많음
      "04d": "☁️",
      "04n": "☁️", // 흐림
      "09d": "🌦️",
      "09n": "🌧️", // 소나기
      "10d": "🌦️",
      "10n": "🌧️", // 비
      "11d": "⛈️",
      "11n": "⛈️", // 천둥번개
      "13d": "🌨️",
      "13n": "🌨️", // 눈
      "50d": "🌫️",
      "50n": "🌫️", // 안개
    };
    return iconMap[icon] || "🌤️";
  }

  // 바람 방향
  getWindDirection(degree) {
    const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    const index = Math.round(degree / 45) % 8;
    return directions[index];
  }

  // 옷차림 추천
  getClothingAdvice(temperature) {
    if (temperature >= 28) {
      return "🩳 반팔, 반바지, 원피스 (매우 더움)";
    } else if (temperature >= 23) {
      return "👕 얇은 셔츠, 면바지 (더움)";
    } else if (temperature >= 20) {
      return "👔 긴팔 셔츠, 얇은 가디건 (따뜻함)";
    } else if (temperature >= 17) {
      return "🧥 얇은 니트, 자켓 (선선함)";
    } else if (temperature >= 12) {
      return "🧥 자켓, 가디건, 얇은 코트 (쌀쌀함)";
    } else if (temperature >= 9) {
      return "🧥 트렌치코트, 야상 (추움)";
    } else if (temperature >= 5) {
      return "🧥 울코트, 히트텍 (매우 추움)";
    } else {
      return "🧥 패딩, 두꺼운 코트, 목도리 (혹한)";
    }
  }

  // 도시명 검증
  validateCity(city) {
    const cityMap = {
      화성: "화성",
      동탄: "화성",
      서울: "서울",
      부산: "부산",
      인천: "인천",
      광주: "광주",
      대전: "대전",
      울산: "울산",
      제주: "제주",
      수원: "수원",
      성남: "성남",
      고양: "고양",
      용인: "용인",
      안양: "안양",
      안산: "안산",
      평택: "평택",
    };

    return cityMap[city] || city;
  }
}

module.exports = { WeatherService };
