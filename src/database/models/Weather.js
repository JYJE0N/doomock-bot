// src/models/Weather.js - 날씨 데이터 모델

const logger = require("../../utils/Logger");
const TimeHelper = require("../../utils/TimeHelper");

/**
 * 🌤️ Weather 모델 - 날씨 데이터 구조 및 변환 담당
 *
 * 🎯 책임:
 * - 날씨 데이터 스키마 정의
 * - API 응답 → 내부 포맷 변환
 * - 폴백 데이터 생성
 * - 데이터 검증 및 기본값
 * - 매핑 데이터 관리 (아이콘, 도시명)
 */
class Weather {
  /**
   * 🏗️ 표준 날씨 데이터 생성 (API 응답 → 내부 포맷)
   */
  static createFromApiResponse(apiResponse, originalLocation) {
    try {
      const main = apiResponse.main || {};
      const weather = apiResponse.weather?.[0] || {};
      const wind = apiResponse.wind || {};
      const clouds = apiResponse.clouds || {};
      const sys = apiResponse.sys || {};

      // 🌡️ 온도 데이터 안전 추출
      const temperature =
        main.temp !== undefined ? Math.round(main.temp) : null;
      const feelsLike =
        main.feels_like !== undefined ? Math.round(main.feels_like) : null;
      const tempMin =
        main.temp_min !== undefined ? Math.round(main.temp_min) : null;
      const tempMax =
        main.temp_max !== undefined ? Math.round(main.temp_max) : null;

      // 🌡️ 온도가 null인 경우 추정값 사용
      const estimatedTemp = temperature ?? this.estimateTemperature();

      return {
        // 📍 위치 정보
        location: originalLocation,
        cityName: apiResponse.name || originalLocation,
        country: sys.country || "KR",
        coordinates: {
          lat: apiResponse.coord?.lat || 0,
          lon: apiResponse.coord?.lon || 0,
        },

        // 🌡️ 온도 데이터 (핵심!)
        temperature: estimatedTemp,
        feelsLike: feelsLike ?? estimatedTemp,
        tempMin: tempMin ?? estimatedTemp - 3,
        tempMax: tempMax ?? estimatedTemp + 5,

        // 🌤️ 날씨 상태
        condition: weather.main || "Clear",
        description: weather.description || "맑음",
        iconCode: weather.icon || "01d",
        icon: this.getWeatherIcon(weather.icon || "01d"),

        // 💨 환경 데이터
        humidity: main.humidity || 50,
        pressure: main.pressure || 1013,
        windSpeed: wind.speed ? Math.round(wind.speed * 10) / 10 : 0,
        windDeg: wind.deg || 0,
        windDirection: this.getWindDirection(wind.deg || 0),
        cloudiness: clouds.all || 0,
        visibility: apiResponse.visibility
          ? Math.round(apiResponse.visibility / 1000)
          : 10,

        // 🌅 태양 데이터
        sunrise: sys.sunrise
          ? TimeHelper.format(new Date(sys.sunrise * 1000), "time")
          : "06:00",
        sunset: sys.sunset
          ? TimeHelper.format(new Date(sys.sunset * 1000), "time")
          : "18:00",

        // 📅 시간 정보
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),
        lastUpdate: TimeHelper.format(TimeHelper.now(), "time"),

        // 🎯 추가 정보
        summary: this.createWeatherSummary(
          estimatedTemp,
          weather.description,
          wind.speed
        ),
        advice: this.generateWeatherAdvice(
          estimatedTemp,
          weather.main,
          wind.speed
        ),

        // 📡 메타 정보
        meta: {
          source: "OpenWeatherMap",
          apiResponse: true,
          hasApiData: true,
          cacheExpiry: TimeHelper.format(
            TimeHelper.addMinutes(TimeHelper.now(), 10),
            "time"
          ),
        },
      };
    } catch (error) {
      logger.error("API 응답 변환 실패:", error);
      return this.createFallbackWeather(originalLocation);
    }
  }

  /**
   * 🔄 폴백 날씨 데이터 생성 (API 실패시)
   */
  static createFallbackWeather(location) {
    const estimatedTemp = this.estimateTemperature();

    return {
      // 📍 위치 정보
      location: location || "화성시",
      cityName: location || "화성시",
      country: "KR",
      coordinates: { lat: 37.1989, lon: 127.0056 },

      // 🌡️ 추정 온도 데이터
      temperature: estimatedTemp,
      feelsLike: estimatedTemp + Math.floor(Math.random() * 4 - 2),
      tempMin: estimatedTemp - 3,
      tempMax: estimatedTemp + 5,

      // 🌤️ 기본 날씨 상태
      condition: "Clear",
      description: "맑음 (추정)",
      iconCode: "01d",
      icon: this.getWeatherIcon("01d"),

      // 💨 추정 환경 데이터
      humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
      pressure: Math.floor(Math.random() * 40) + 1000, // 1000-1040
      windSpeed: Math.random() * 3 + 1, // 1-4 m/s
      windDeg: Math.floor(Math.random() * 360),
      windDirection: this.getWindDirection(Math.floor(Math.random() * 360)),
      cloudiness: Math.floor(Math.random() * 50),
      visibility: Math.floor(Math.random() * 10) + 10, // 10-20km

      // 🌅 기본 태양 데이터
      sunrise: "06:30",
      sunset: "18:30",

      // 📅 시간 정보
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),
      lastUpdate: TimeHelper.format(TimeHelper.now(), "time"),

      // 🎯 추정 정보
      summary: `추정 기온 ${estimatedTemp}°C, 맑음`,
      advice: "정확한 날씨 확인을 위해 API 키를 설정해주세요.",

      // 📡 메타 정보
      meta: {
        source: "폴백 데이터",
        apiResponse: false,
        hasApiData: false,
        estimated: true,
        notice: "실제 API 연결 시 정확한 정보를 제공합니다",
      },
    };
  }

  /**
   * 🧠 스마트 온도 추정 (시간/계절 고려)
   */
  static estimateTemperature() {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth() + 1; // 1-12월

    // 계절별 기본 온도
    let baseTemp;
    if (month >= 3 && month <= 5) baseTemp = 15; // 봄
    else if (month >= 6 && month <= 8) baseTemp = 25; // 여름
    else if (month >= 9 && month <= 11) baseTemp = 18; // 가을
    else baseTemp = 5; // 겨울

    // 시간대별 보정
    let hourOffset = 0;
    if (hour >= 6 && hour <= 12) hourOffset = 2; // 오전
    else if (hour >= 13 && hour <= 18) hourOffset = 5; // 오후
    else if (hour >= 19 && hour <= 21) hourOffset = 1; // 저녁
    else hourOffset = -3; // 새벽/밤

    // ±2도 자연스러운 변화
    const randomVariation = Math.random() * 4 - 2;

    return Math.round(baseTemp + hourOffset + randomVariation);
  }

  /**
   * 🎨 날씨 아이콘 매핑
   */
  static getWeatherIcon(iconCode) {
    const iconMapping = {
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

    return iconMapping[iconCode] || "🌤️";
  }

  /**
   * 🗺️ 도시명 매핑
   */
  static getCityMapping(koreanCity) {
    const cityMapping = {
      서울: "Seoul,KR",
      서울시: "Seoul,KR",
      부산: "Busan,KR",
      부산시: "Busan,KR",
      대구: "Daegu,KR",
      대구시: "Daegu,KR",
      인천: "Incheon,KR",
      인천시: "Incheon,KR",
      광주: "Gwangju,KR",
      광주시: "Gwangju,KR",
      대전: "Daejeon,KR",
      대전시: "Daejeon,KR",
      울산: "Ulsan,KR",
      울산시: "Ulsan,KR",
      화성: "Hwaseong,KR",
      화성시: "Hwaseong,KR",
      수원: "Suwon,KR",
      수원시: "Suwon,KR",
      용인: "Yongin,KR",
      용인시: "Yongin,KR",
      안산: "Ansan,KR",
      안산시: "Ansan,KR",
      부천: "Bucheon,KR",
      부천시: "Bucheon,KR",
    };

    const normalized = koreanCity.trim();
    return (
      cityMapping[normalized] ||
      cityMapping[normalized + "시"] ||
      `${normalized},KR`
    );
  }

  /**
   * 🧭 바람 방향 계산
   */
  static getWindDirection(degrees) {
    const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  /**
   * 📝 날씨 요약 생성
   */
  static createWeatherSummary(temperature, description, windSpeed) {
    let summary = "";

    if (temperature !== null) {
      summary += `현재 기온 ${temperature}°C`;

      if (temperature >= 30) summary += " (매우 더움)";
      else if (temperature >= 25) summary += " (더움)";
      else if (temperature >= 20) summary += " (따뜻함)";
      else if (temperature >= 10) summary += " (쌀쌀함)";
      else if (temperature >= 0) summary += " (추움)";
      else summary += " (매우 추움)";
    }

    if (description) {
      summary += `, ${description}`;
    }

    if (windSpeed && windSpeed > 3) {
      summary += `, 바람 ${windSpeed}m/s`;
    }

    return summary || "날씨 정보 확인 중";
  }

  /**
   * 💡 날씨 조언 생성
   */
  static generateWeatherAdvice(temperature, condition, windSpeed) {
    const advice = [];

    // 온도 기반 조언
    if (temperature !== null) {
      if (temperature >= 30) {
        advice.push("매우 더우니 충분한 수분 섭취하세요");
      } else if (temperature >= 25) {
        advice.push("더운 날씨, 시원한 곳에서 휴식하세요");
      } else if (temperature <= 0) {
        advice.push("매우 추우니 따뜻하게 입으세요");
      } else if (temperature <= 10) {
        advice.push("쌀쌀하니 겉옷을 준비하세요");
      }
    }

    // 날씨 상태 기반 조언
    if (condition) {
      switch (condition.toLowerCase()) {
        case "rain":
        case "drizzle":
          advice.push("비가 오니 우산을 챙기세요");
          break;
        case "snow":
          advice.push("눈이 오니 미끄럼 주의하세요");
          break;
        case "thunderstorm":
          advice.push("천둥번개가 있으니 실내에 있으세요");
          break;
        case "mist":
        case "fog":
          advice.push("안개가 있으니 운전 시 주의하세요");
          break;
      }
    }

    // 바람 기반 조언
    if (windSpeed && windSpeed > 7) {
      advice.push("바람이 강하니 외출 시 주의하세요");
    }

    return advice.length > 0 ? advice.join(". ") + "." : "날씨가 양호합니다.";
  }

  /**
   * ✅ 데이터 검증
   */
  static validateWeatherData(data) {
    const errors = [];

    // 필수 필드 체크
    if (!data.location) errors.push("위치 정보가 없습니다");
    if (data.temperature === null || data.temperature === undefined) {
      errors.push("온도 정보가 없습니다");
    }

    // 온도 범위 체크 (-50°C ~ 60°C)
    if (
      data.temperature !== null &&
      (data.temperature < -50 || data.temperature > 60)
    ) {
      errors.push("온도가 정상 범위를 벗어났습니다");
    }

    // 습도 범위 체크 (0% ~ 100%)
    if (data.humidity !== null && (data.humidity < 0 || data.humidity > 100)) {
      errors.push("습도가 정상 범위를 벗어났습니다");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 🔄 데이터 정규화 (안전한 기본값 적용)
   */
  static normalizeWeatherData(data) {
    return {
      ...data,
      location: data.location || "알수없음",
      temperature:
        data.temperature !== null
          ? data.temperature
          : this.estimateTemperature(),
      humidity: data.humidity !== null ? data.humidity : 50,
      pressure: data.pressure !== null ? data.pressure : 1013,
      windSpeed: data.windSpeed !== null ? data.windSpeed : 0,
      cloudiness: data.cloudiness !== null ? data.cloudiness : 0,
      visibility: data.visibility !== null ? data.visibility : 10,
      icon: data.icon || this.getWeatherIcon(data.iconCode || "01d"),
      timestamp: data.timestamp || TimeHelper.format(TimeHelper.now(), "full"),
    };
  }
}

module.exports = Weather;
