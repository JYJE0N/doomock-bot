// ✅ src/renderers/WeatherRenderer.js (최종 완전 수정본 - 미세먼지 + 오타 해결)

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "weather";

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
    this.dustEmojis = { 좋음: "🟢", 보통: "🟡", 나쁨: "🟠", 매우나쁨: "🔴" };
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
   * ✅ 필수 render() 메서드 구현
   */
  async render(result, ctx) {
    const { type, data } = result;

    logger.debug(`🌤️ WeatherRenderer.render 타입: ${type}`, {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
    });

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "cities":
        return await this.renderCities(data, ctx);
      case "weather":
      case "current_weather":
        return await this.renderWeather(data, ctx);
      case "forecast":
        return await this.renderForecast(data, ctx);
      case "default_set":
        return await this.renderSettingSuccess(data, ctx);
      case "city_weather_direct":
      case "default_weather_direct":
        return await this.renderCityWeatherDirect(data, ctx);
      case "help":
        return await this.renderHelp(data, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError(
          { message: `지원하지 않는 기능 타입: ${type}` },
          ctx
        );
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, defaultCity, majorCities, config } = data;

    const safeUserName = userName || "사용자";
    const safeDefaultCity = defaultCity || "서울";
    const safeCitiesCount = majorCities?.length || 8;

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
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 선택", action: "cities" },
        ],
        config?.enableForecast
          ? [
              { text: "📊 날씨 예보", action: "forecast" },
              { text: "❓ 도움말", action: "help" },
            ]
          : [{ text: "❓ 도움말", action: "help" }],
        [{ text: "🔙 메인메뉴", action: "main" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏙️ 도시 목록 렌더링 (✅ currentDefaultCity 오타 수정)
   */
  async renderCities(data, ctx) {
    const { cities, defaultCity, config } = data;

    // ✅ 오타 수정: currentDefaultCity → defaultCity
    const currentDefaultCity = defaultCity || "서울";

    logger.debug(`🏙️ renderCities - 받은 데이터:`, {
      cities: cities?.length,
      defaultCity,
      currentDefaultCity,
    });

    let text = `🏙️ **도시 선택**

현재 기본 도시: **${currentDefaultCity}** ${
      this.cityEmojis[currentDefaultCity] || "🏙️"
    }

날씨를 확인할 도시를 선택해주세요:`;

    const cityButtons = [];
    for (let i = 0; i < cities.length; i += 2) {
      const row = [];

      if (cities[i]) {
        const isDefault = cities[i].name === currentDefaultCity;
        const prefix = isDefault ? "⭐ " : "";

        row.push({
          text: `${prefix}${this.cityEmojis[cities[i].name] || "🏙️"} ${
            cities[i].name
          }`,
          action: "city",
          params: cities[i].id,
        });
      }

      if (cities[i + 1]) {
        const isDefault2 = cities[i + 1].name === currentDefaultCity;
        const prefix2 = isDefault2 ? "⭐ " : "";

        row.push({
          text: `${prefix2}${this.cityEmojis[cities[i + 1].name] || "🏙️"} ${
            cities[i + 1].name
          }`,
          action: "city",
          params: cities[i + 1].id,
        });
      }
      cityButtons.push(row);
    }

    cityButtons.push([{ text: "🔙 날씨 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(cityButtons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🌡️ 날씨 정보 렌더링 (✅ 미세먼지 [object Object] 문제 해결)
   */
  async renderWeather(data, ctx) {
    const { city, weather, dust, timestamp, hasError, errorMessage } = data;

    if (hasError) {
      return await this.renderWeatherError(data, ctx);
    }

    let text = `${city.emoji || this.cityEmojis[city.name] || "🏙️"} **${
      city.name
    } 날씨** ${this.weatherEmojis[weather.description] || "🌤️"}

🌡️ **온도**: ${weather.temperature}°C (체감 ${weather.feelsLike}°C)
📝 **날씨**: ${weather.description}
💧 **습도**: ${weather.humidity}%
🌬️ **바람**: ${weather.windSpeed}m/s`;

    if (weather.pressure) {
      text += `\n📊 **기압**: ${weather.pressure}hPa`;
    }

    if (weather.visibility) {
      text += `\n👁️ **가시거리**: ${weather.visibility}km`;
    }

    // ✅ 미세먼지 정보 안전한 렌더링 (Object 문제 해결)
    if (dust) {
      logger.debug("🌬️ 미세먼지 데이터 구조:", dust);

      // dust 객체의 구조에 따라 안전하게 처리
      let dustText = "\n\n🌬️ **미세먼지 정보**\n";

      // 방법 1: dust.grade가 있는 경우 (단순 구조)
      if (dust.grade) {
        dustText += `${this.dustEmojis[dust.grade] || "🟡"} **등급**: ${
          dust.grade
        }`;

        // PM10, PM2.5가 문자열/숫자인 경우
        if (dust.pm10 && typeof dust.pm10 !== "object") {
          dustText += `\n🔸 **PM10**: ${dust.pm10}㎍/m³`;
        }
        if (dust.pm25 && typeof dust.pm25 !== "object") {
          dustText += `\n🔹 **PM2.5**: ${dust.pm25}㎍/m³`;
        }
      }
      // 방법 2: dust가 복잡한 객체 구조인 경우
      else if (dust.pm10 && dust.pm25) {
        // pm10, pm25가 객체인 경우 안전하게 접근
        const pm10Value =
          typeof dust.pm10 === "object"
            ? dust.pm10.value || dust.pm10.concentration
            : dust.pm10;
        const pm25Value =
          typeof dust.pm25 === "object"
            ? dust.pm25.value || dust.pm25.concentration
            : dust.pm25;
        const pm10Grade =
          typeof dust.pm10 === "object" ? dust.pm10.grade : "undefined";
        const pm25Grade =
          typeof dust.pm25 === "object" ? dust.pm25.grade : "undefined";

        // 전체 등급 (overall이 있으면 사용, 없으면 평균 추정)
        const overallGrade = dust.overall?.grade || dust.grade || "보통";

        dustText += `${
          this.dustEmojis[overallGrade] || "🟡"
        } **등급**: ${overallGrade}`;
        dustText += `\n🔸 **PM10**: ${pm10Value}㎍/m³`;
        dustText += `\n🔹 **PM2.5**: ${pm25Value}㎍/m³`;
      }
      // 방법 3: 알 수 없는 구조인 경우 기본 메시지
      else {
        dustText += "🟡 **등급**: 정보 확인 중";
      }

      text += dustText;
    }

    text += `\n\n📍 **위치**: ${city.fullName || city.name}
⏰ **업데이트**: ${timestamp}`;

    if (weather.isOffline) {
      text += `\n⚠️ **오프라인 모드** (기본 데이터)`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 새로고침", action: "city", params: city.id },
          { text: "🏙️ 다른 도시", action: "cities" },
        ],
        [
          { text: "📊 예보", action: "forecast", params: city.id },
          { text: "⭐ 기본 설정", action: "setdefault", params: city.id },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 날씨 예보 렌더링 (✅ forecast vs forecasts 통일)
   */
  async renderForecast(data, ctx) {
    const { city, forecast, timestamp } = data;

    let text = `📊 **${city.name} 날씨 예보** ${
      city.emoji || this.cityEmojis[city.name] || "🏙️"
    }\n\n`;

    // ✅ forecast.forecast 구조 체크 (forecasts 오타 없음)
    if (forecast && forecast.forecast && Array.isArray(forecast.forecast)) {
      forecast.forecast.forEach((day, index) => {
        const dayEmoji = index === 0 ? "📅" : "📆";
        const weatherEmoji =
          day.icon || this.weatherEmojis[day.description] || "🌤️";

        text += `${dayEmoji} **${day.dayOfWeek}** (${day.date})
${weatherEmoji} ${day.description}
🌡️ ${day.tempMin}°C ~ ${day.tempMax}°C`;

        if (day.humidity || day.rainProbability > 0) {
          text += `\n💧 ${day.humidity}%`;
          if (day.rainProbability > 0) {
            text += ` | ☔ ${day.rainProbability}%`;
          }
        }

        text += `\n\n`;
      });
    } else {
      text += "❌ 예보 데이터를 불러올 수 없습니다.\n\n";
      logger.warn("예보 데이터 구조 문제:", {
        hasData: !!forecast,
        hasForecast: !!forecast?.forecast,
        isArray: Array.isArray(forecast?.forecast),
        structure: forecast,
      });
    }

    text += `⏰ **업데이트**: ${timestamp}`;

    if (forecast && forecast.isOffline) {
      text += `\n⚠️ **오프라인 모드** (기본 예보)`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌡️ 현재 날씨", action: "city", params: city.id },
          { text: "🔄 새로고침", action: "forecast", params: city.id },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🎯 직접 도시 날씨 조회 결과 렌더링
   */
  async renderCityWeatherDirect(data, ctx) {
    const { city, weather, dust, timestamp, isDirectCall } = data;

    let text = `🎯 **${city.name} 날씨** ${
      this.cityEmojis[city.name] || "🏙️"
    }\n\n`;

    text += `🌡️ **온도**: ${weather.temperature}°C
📝 **날씨**: ${weather.description} ${
      this.weatherEmojis[weather.description] || "🌤️"
    }
💧 **습도**: ${weather.humidity}%
🌬️ **바람**: ${weather.windSpeed}m/s`;

    // ✅ 미세먼지 정보도 동일하게 안전 처리
    if (dust) {
      let dustGrade = "보통";
      if (dust.grade) dustGrade = dust.grade;
      else if (dust.overall?.grade) dustGrade = dust.overall.grade;

      let pm10 = "-";
      if (dust.pm10) {
        pm10 =
          typeof dust.pm10 === "object"
            ? dust.pm10.value || dust.pm10.concentration || "-"
            : dust.pm10;
      }

      text += `\n\n🌬️ **미세먼지**
${this.dustEmojis[dustGrade] || "🟡"} ${dustGrade} (PM10: ${pm10}㎍/m³)`;
    }

    text += `\n\n⏰ ${timestamp}`;

    if (isDirectCall) {
      text += `\n\n💡 **팁**: 이 도시를 기본으로 설정하시겠어요?`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📊 상세 정보", action: "city", params: city.id },
          { text: "⭐ 기본 설정", action: "setdefault", params: city.id },
        ],
        [
          { text: "🏙️ 다른 도시", action: "cities" },
          { text: "🔙 날씨 메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const text = `❓ **날씨 도움말**

🌤️ **사용법**:
• "날씨" 또는 "현재 날씨" - 기본 도시 날씨
• "서울 날씨", "부산 날씨" - 특정 도시 날씨
• 버튼을 클릭해서 메뉴 탐색

🏙️ **지원 도시**:
서울, 인천, 수원, 대전, 대구, 부산, 광주, 제주

💡 **팁**:
• ⭐ 기본 도시를 설정하면 더 편리해요
• 미세먼지 정보도 함께 확인 가능
• 5일 날씨 예보 제공

🔄 **업데이트**:
날씨 정보는 실시간으로 업데이트됩니다`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 선택", action: "cities" },
        ],
        [{ text: "🔙 날씨 메뉴", action: "menu" }],
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
          { text: "🔙 메인메뉴", action: "main" },
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
            action: city ? "city" : "current",
            params: city ? city.id : undefined,
          },
          { text: "🏙️ 다른 도시", action: "cities" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = WeatherRenderer;
