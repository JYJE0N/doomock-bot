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
   * 🎯 표준 render 메서드 (필수 구현!)
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

    const text = `🌤️ **날씨 정보** 

안녕하세요, ${userName}님! 
현재 기본 도시: **${defaultCity}** ${this.cityEmojis[defaultCity] || "🏙️"}

실시간 날씨 정보를 확인하세요! 📡
${config.enableDustInfo ? "미세먼지 정보도 함께 제공됩니다 🌬️" : ""}

📍 **지원 도시**: ${majorCities.length}개 도시`;

    const keyboard = this.createInlineKeyboard(
      [
        // 첫 번째 행: 현재 날씨 + 도시 목록
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 선택", action: "cities" },
        ],
        // 두 번째 행: 예보 + 설정
        config.enableForecast
          ? [
              { text: "📊 날씨 예보", action: "forecast" },
              { text: "⚙️ 설정", action: "settings" },
            ]
          : [{ text: "⚙️ 설정", action: "settings" }],
        // 세 번째 행: 메인 메뉴
        [{ text: "🔙 메인 메뉴", action: "menu" }],
      ],
      "system" // 메인 메뉴는 system으로
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏙️ 도시 목록 렌더링
   */
  async renderCities(data, ctx) {
    const { cities, defaultCity } = data;

    let text = `🏙️ **도시 선택**\n\n현재 기본 도시: **${defaultCity}** ${
      this.cityEmojis[defaultCity] || "🏙️"
    }\n\n날씨를 확인할 도시를 선택해주세요:`;

    // 도시 버튼을 2x4 그리드로 배치
    const cityButtons = [];
    for (let i = 0; i < cities.length; i += 2) {
      const row = [];
      if (cities[i]) {
        row.push({
          text: `${this.cityEmojis[cities[i].name] || "🏙️"} ${cities[i].name}`,
          action: `city:${cities[i].id}`,
        });
      }
      if (cities[i + 1]) {
        row.push({
          text: `${this.cityEmojis[cities[i + 1].name] || "🏙️"} ${
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

    // 5일 예보 표시
    if (forecast && forecast.forecasts) {
      forecast.forecasts.forEach((day, index) => {
        const dayEmoji = index === 0 ? "📅" : "📆";
        const weatherEmoji = this.weatherEmojis[day.description] || "🌤️";

        text += `${dayEmoji} **${day.dayOfWeek}** (${day.date})
${weatherEmoji} ${day.description}
🌡️ ${day.temperature.min}°C ~ ${day.temperature.max}°C
💧 ${day.humidity}% | ☔ ${day.rainProbability}%

`;
      });
    } else {
      text += "예보 데이터를 불러올 수 없습니다.";
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
      "system"
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
      "system"
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
