// src/renderers/WeatherRenderer.js - render 메서드 구현
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherRenderer - 날씨 정보 렌더링 (표준 render 메서드 구현)
 */
class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "weather";

    // 날씨 이모지 매핑
    this.weatherEmojis = {
      맑음: "☀️",
      "구름 조금": "🌤️",
      "구름 많음": "⛅",
      흐림: "☁️",
      소나기: "🌦️",
      비: "🌧️",
      천둥번개: "⛈️",
      눈: "🌨️",
      안개: "🌫️",
      보통: "🌤️",
    };

    // 미세먼지 등급 이모지
    this.dustEmojis = {
      좋음: "🟢",
      보통: "🟡",
      나쁨: "🟠",
      매우나쁨: "🔴",
    };

    // 도시별 이모지
    this.cityEmojis = {
      서울: "🏛️",
      수원: "🏰",
      인천: "✈️",
      대전: "🚄",
      대구: "🍎",
      부산: "🌊",
      광주: "🌻",
      제주: "🏝️",
    };

    logger.info("🌤️ WeatherRenderer 생성됨");
  }

  /**
   * 🎯 표준 render 메서드 (current_weather 타입 추가)
   */
  async render(result, ctx) {
    try {
      if (!result || typeof result !== "object") {
        logger.error("WeatherRenderer: 잘못된 결과 데이터", result);
        return await this.renderError({ message: "잘못된 데이터입니다." }, ctx);
      }

      const { type, data } = result;

      logger.debug(`🌤️ WeatherRenderer.render: ${type}`, data);

      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);
        case "current":
        case "current_weather": // ✅ 추가!
        case "weather":
          return await this.renderWeather(data, ctx);
        case "cities":
          return await this.renderCities(data, ctx);
        case "forecast":
          return await this.renderForecast(data, ctx);
        case "settings":
          return await this.renderSettings(data, ctx);
        case "error":
          return await this.renderError(data, ctx);
        case "default_set": // ✅ 기본 도시 설정 성공
          return await this.renderSettingSuccess(data, ctx);
        default:
          logger.warn(`🌤️ 지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            { message: "지원하지 않는 기능입니다." },
            ctx
          );
      }
    } catch (error) {
      logger.error("WeatherRenderer.render 오류:", error);
      return await this.renderError(
        { message: "렌더링 중 오류가 발생했습니다." },
        ctx
      );
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, defaultCity, majorCities, config } = data;

    // ✅ 안전성 체크
    const safeUserName = userName || "사용자";
    const safeDefaultCity = defaultCity || "서울";
    const safeCitiesCount = majorCities?.length || 8;

    // ✅ 디버그 로그
    logger.debug(`🏠 renderMenu - 데이터:`, {
      userName: safeUserName,
      defaultCity: safeDefaultCity,
      citiesCount: safeCitiesCount,
    });

    const text = `🌤️ **날씨 정보** 

안녕하세요, ${safeUserName}님! 
현재 기본 도시: **${safeDefaultCity}** ${
      this.cityEmojis[safeDefaultCity] || "🏙️"
    }

실시간 날씨 정보를 확인하세요! 📡
${config?.enableDustInfo ? "미세먼지 정보도 함께 제공됩니다 🌬️" : ""}

📍 **지원 도시**: ${safeCitiesCount}개 도시`;

    const keyboard = this.createInlineKeyboard(
      [
        // 첫 번째 행: 현재 날씨 + 도시 목록
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 선택", action: "cities" },
        ],
        // 두 번째 행: 예보 + 설정
        config?.enableForecast
          ? [
              { text: "📊 날씨 예보", action: "forecast" },
              { text: "⚙️ 설정", action: "settings" },
            ]
          : [{ text: "⚙️ 설정", action: "settings" }],
        // 세 번째 행: 메인 메뉴
        [{ text: "🔙 메인 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🌡️ 날씨 정보 렌더링 (에러 처리 강화)
   */
  async renderWeather(data, ctx) {
    const { city, weather, dust, timestamp, hasError, errorMessage } = data;

    if (hasError) {
      return await this.renderWeatherError(data, ctx);
    }

    // 안전성 체크
    if (!city || !weather) {
      logger.error("날씨 렌더링 - 필수 데이터 누락:", {
        city: !!city,
        weather: !!weather,
      });
      return await this.renderError(
        { message: "날씨 데이터가 올바르지 않습니다." },
        ctx
      );
    }

    // 메인 날씨 카드
    let text = `${city.emoji || this.cityEmojis[city.name] || "🏙️"} **${
      city.name
    } 날씨** ${this.weatherEmojis[weather.description] || "🌤️"}

🌡️ **온도**: ${weather.temperature}°C (체감 ${weather.feelsLike}°C)
📝 **날씨**: ${weather.description}
💧 **습도**: ${weather.humidity}%
🌬️ **바람**: ${weather.windSpeed}m/s`;

    // 기압 정보 (있으면)
    if (weather.pressure) {
      text += `\n📊 **기압**: ${weather.pressure}hPa`;
    }

    // 가시거리 (있으면)
    if (weather.visibility) {
      text += `\n👁️ **가시거리**: ${weather.visibility}km`;
    }

    // ✅ 미세먼지 정보 추가 (수정된 버전!)
    if (dust && (dust.pm10 || dust.pm25 || dust.overall)) {
      text += `\n\n🌬️ **미세먼지 정보**\n`;

      // 전체 등급 표시
      if (dust.overall && dust.overall.grade) {
        const gradeEmoji = this.dustEmojis[dust.overall.grade] || "🟡";
        text += `${gradeEmoji} **등급**: ${dust.overall.grade}`;
      }

      // PM10 정보
      if (dust.pm10) {
        const pm10Value = dust.pm10.value || dust.pm10;
        const pm10Grade = dust.pm10.grade || "";
        text += `\n🔸 **PM10**: ${pm10Value}㎍/m³`;
        if (pm10Grade && pm10Grade !== dust.overall?.grade) {
          text += ` (${pm10Grade})`;
        }
      }

      // PM2.5 정보
      if (dust.pm25) {
        const pm25Value = dust.pm25.value || dust.pm25;
        const pm25Grade = dust.pm25.grade || "";
        text += `\n🔹 **PM2.5**: ${pm25Value}㎍/m³`;
        if (pm25Grade && pm25Grade !== dust.overall?.grade) {
          text += ` (${pm25Grade})`;
        }
      }

      // 측정소 정보 (있으면)
      if (dust.stationName) {
        text += `\n📍 **측정소**: ${dust.stationName}`;
      }

      // 행동요령 (있으면)
      if (dust.advice) {
        text += `\n💡 **행동요령**: ${dust.advice}`;
      }
    }

    // 하단 정보
    text += `\n\n📍 **위치**: ${city.fullName || city.name}
⏰ **업데이트**: ${timestamp || "알수없음"}`;

    if (weather.isOffline) {
      text += `\n⚠️ **오프라인 모드** (기본 데이터)`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 새로고침", action: `city:${city.id}` },
          { text: "🏙️ 다른 도시", action: "cities" },
        ],
        [
          { text: "📊 예보", action: `forecast:${city.id}` },
          { text: "⭐ 기본 설정", action: `setdefault:${city.id}` },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏙️ 도시 목록 렌더링
   */
  async renderCities(data, ctx) {
    const { cities, defaultCity, config } = data;

    // ✅ defaultCity가 undefined인 경우 처리
    const currentDefaultCity = defaultCity || "서울";

    // ✅ 디버그 로그 추가
    logger.debug(`🏙️ renderCities - 받은 데이터:`, {
      cities: cities?.length,
      defaultCity,
      currentDefaultCity,
    });

    let text = `🏙️ **도시 선택**\n\n현재 기본 도시: **${currentDefaultCity}** ${
      this.cityEmojis[currentDefaultCity] || "🏙️"
    }\n\n날씨를 확인할 도시를 선택해주세요:`;

    // 도시 버튼을 2x4 그리드로 배치
    const cityButtons = [];
    for (let i = 0; i < cities.length; i += 2) {
      const row = [];
      if (cities[i]) {
        // ✅ 현재 기본 도시는 ⭐ 표시
        const isDefault = cities[i].name === currentDefaultCity;
        const prefix = isDefault ? "⭐ " : "";

        row.push({
          text: `${prefix}${this.cityEmojis[cities[i].name] || "🏙️"} ${
            cities[i].name
          }`,
          action: `city:${cities[i].id}`,
        });
      }
      if (cities[i + 1]) {
        // ✅ 현재 기본 도시는 ⭐ 표시
        const isDefault = cities[i + 1].name === currentDefaultCity;
        const prefix = isDefault ? "⭐ " : "";

        row.push({
          text: `${prefix}${this.cityEmojis[cities[i + 1].name] || "🏙️"} ${
            cities[i + 1].name
          }`,
          action: `city:${cities[i + 1].id}`,
        });
      }
      cityButtons.push(row);
    }

    // 하단 버튼들
    cityButtons.push([{ text: "🔙 날씨 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(cityButtons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🌡️ 날씨 정보 렌더링
   */
  async renderWeather(data, ctx) {
    const { city, weather, dust, timestamp, hasError, errorMessage } = data;

    if (hasError) {
      return await this.renderWeatherError(data, ctx);
    }

    // 메인 날씨 카드
    let text = `${city.emoji || this.cityEmojis[city.name] || "🏙️"} **${
      city.name
    } 날씨** ${this.weatherEmojis[weather.description] || "🌤️"}

🌡️ **온도**: ${weather.temperature}°C (체감 ${weather.feelsLike}°C)
📝 **날씨**: ${weather.description}
💧 **습도**: ${weather.humidity}%
🌬️ **바람**: ${weather.windSpeed}m/s`;

    // 기압 정보 (있으면)
    if (weather.pressure) {
      text += `\n📊 **기압**: ${weather.pressure}hPa`;
    }

    // 가시거리 (있으면)
    if (weather.visibility) {
      text += `\n👁️ **가시거리**: ${weather.visibility}km`;
    }

    // 미세먼지 정보 추가
    if (dust) {
      text += `\n\n🌬️ **미세먼지 정보**
${this.dustEmojis[dust.grade] || "🟡"} **등급**: ${dust.grade}
🔸 **PM10**: ${dust.pm10}㎍/m³
🔹 **PM2.5**: ${dust.pm25}㎍/m³`;
    }

    // 하단 정보
    text += `\n\n📍 **위치**: ${city.fullName || city.name}
⏰ **업데이트**: ${timestamp}`;

    if (weather.isOffline) {
      text += `\n⚠️ **오프라인 모드** (기본 데이터)`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 새로고침", action: `city:${city.id}` },
          { text: "🏙️ 다른 도시", action: "cities" },
        ],
        [
          { text: "📊 예보", action: `forecast:${city.id}` },
          { text: "⭐ 기본 설정", action: `setdefault:${city.id}` },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 날씨 예보 렌더링
   */
  async renderForecast(data, ctx) {
    const { city, forecast, timestamp } = data;

    let text = `📊 **${city.name} 날씨 예보** ${
      city.emoji || this.cityEmojis[city.name] || "🏙️"
    }

`;

    // 5일 예보 표시 - 데이터 구조 수정
    if (forecast && forecast.forecast) {
      // forecasts → forecast로 변경
      forecast.forecast.forEach((day, index) => {
        const dayEmoji = index === 0 ? "📅" : "📆";
        const weatherEmoji =
          day.icon || this.weatherEmojis[day.description] || "🌤️";

        text += `${dayEmoji} **${day.date}**
${weatherEmoji} ${day.description}
🌡️ ${day.tempMin}°C ~ ${day.tempMax}°C

`;
      });
    } else {
      text += "예보 데이터를 불러올 수 없습니다.";
      logger.warn("예보 데이터 구조 문제:", { forecast });
    }

    text += `⏰ **업데이트**: ${timestamp}`;

    if (forecast && forecast.isOffline) {
      text += `\n⚠️ **오프라인 모드** (기본 예보)`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌡️ 현재 날씨", action: `city:${city.id}` },
          { text: "🔄 새로고침", action: `forecast:${city.id}` },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    const { userName, defaultCity, config } = data;

    const text = `⚙️ **날씨 설정**

안녕하세요, ${userName}님!

📍 **현재 설정**
• 기본 도시: ${defaultCity} ${this.cityEmojis[defaultCity] || "🏙️"}
• 미세먼지 정보: ${config.enableDustInfo ? "✅ 활성화" : "❌ 비활성화"}
• 날씨 예보: ${config.enableForecast ? "✅ 활성화" : "❌ 비활성화"}

💡 **팁**: 도시 이름을 직접 말하면 해당 도시의 날씨를 바로 볼 수 있어요!`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌤️ 날씨 메뉴", action: "menu" },
          { text: "🏙️ 도시 목록", action: "cities" },
        ],
        [{ text: "🔙 메인메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message } = data;

    const text = `❌ **날씨 서비스 오류**

${message || "알 수 없는 오류가 발생했습니다"}

잠시 후 다시 시도해주세요 🔄`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "🔙 메인메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚠️ 날씨 오류 렌더링
   */
  async renderWeatherError(data, ctx) {
    const { city, errorMessage } = data;

    const text = `⚠️ **날씨 조회 실패**

${city ? `📍 도시: ${city.name}` : ""}
❌ **오류**: ${errorMessage || "날씨 정보를 가져올 수 없습니다"}

잠시 후 다시 시도해주세요 🔄`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          {
            text: "🔄 다시 시도",
            action: city ? `city:${city.id}` : "current",
          },
          { text: "🏙️ 다른 도시", action: "cities" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ✅ 설정 성공 렌더링
   */
  async renderSettingSuccess(data, ctx) {
    const { city, message } = data;

    const text = `✅ **설정 완료**

${city.emoji || this.cityEmojis[city.name] || "🏙️"} **${
      city.name
    }**이(가) 기본 도시로 설정되었습니다!

이제 "날씨" 또는 "현재 날씨"라고 말하시면 
${city.name} 날씨가 자동으로 표시됩니다 🎯`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 변경", action: "cities" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🌡️ 온도 색상 표현
   */
  getTemperatureColor(temperature) {
    if (temperature >= 30) return "🔴"; // 매우 더움
    if (temperature >= 25) return "🟠"; // 더움
    if (temperature >= 20) return "🟡"; // 따뜻함
    if (temperature >= 10) return "🟢"; // 쾌적함
    if (temperature >= 0) return "🔵"; // 쌀쌀함
    return "🟣"; // 매우 추움
  }

  /**
   * 🌬️ 바람 강도 표현
   */
  getWindDescription(windSpeed) {
    if (windSpeed >= 10) return "💨 강풍";
    if (windSpeed >= 5) return "🌬️ 바람";
    if (windSpeed >= 2) return "🍃 산들바람";
    return "😴 무풍";
  }

  /**
   * 💧 습도 상태 표현
   */
  getHumidityDescription(humidity) {
    if (humidity >= 70) return "💧 습함";
    if (humidity >= 40) return "💦 적당함";
    return "🏜️ 건조함";
  }

  /**
   * 📊 기압 상태 표현
   */
  getPressureDescription(pressure) {
    if (pressure >= 1020) return "📈 고기압";
    if (pressure >= 1000) return "📊 평상";
    return "📉 저기압";
  }
}

module.exports = WeatherRenderer;
