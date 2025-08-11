// src/renderers/WeatherRenderer.js
// 🎨 Weather 렌더러 - UI 생성만!

const BaseRenderer = require("./BaseRenderer");
const logger = require('../utils/core/Logger');
const TimeHelper = require('../utils/formatting/TimeHelper');

/**
 * WeatherRenderer - SoC 원칙 준수
 * ✅ 역할: UI 텍스트 생성, 인라인 키보드 생성, 아이콘 변환
 * ❌ 금지: 비즈니스 로직, 데이터 조회
 */
class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "weather";

    // UI 관련 매핑 (렌더러의 책임!)
    this.weatherIcons = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "⛅",
      "02n": "☁️",
      "03d": "☁️",
      "03n": "☁️",
      "04d": "☁️",
      "04n": "☁️",
      "09d": "🌧️",
      "09n": "🌧️",
      "10d": "🌦️",
      "10n": "🌧️",
      "11d": "⛈️",
      "11n": "⛈️",
      "13d": "🌨️",
      "13n": "🌨️",
      "50d": "🌫️",
      "50n": "🌫️"
    };

    this.dustEmojis = {
      좋음: "🟢",
      보통: "🟡",
      나쁨: "🟠",
      매우나쁨: "🔴"
    };

    this.cityEmojis = {
      서울: "🏛️",
      수원: "🏰",
      인천: "✈️",
      대전: "🚄",
      대구: "🍎",
      부산: "🌊",
      광주: "🌻",
      제주: "🏝️"
    };

    logger.info("🌤️ WeatherRenderer 생성됨");
  }

  /**
   * 메인 render 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

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
          { message: `지원하지 않는 렌더링 타입: ${type}` },
          ctx
        );
    }
  }

  /**
   * 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, defaultCity, majorCities, config } = data;

    const text = `🌤️ *날씨 정보*

안녕하세요, ${userName}님!
현재 기본 도시: *${defaultCity}* ${this.cityEmojis[defaultCity] || "🏙️"}

실시간 날씨 정보를 확인하세요! 📡
${config?.enableDustInfo ? "미세먼지 정보도 함께 제공됩니다 🌬️" : ""}

📍 *지원 도시*: ${majorCities?.length || 8}개 도시`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🌡️ 현재 날씨", action: "current" },
          { text: "🏙️ 도시 선택", action: "cities" }
        ],
        config?.enableForecast
          ? [{ text: "📊 날씨 예보", action: "forecast" }]
          : null,
        [
          { text: "❓ 도움말", action: "help" },
          { text: "◀️ 메인", action: "menu", module: "system" }
        ]
      ].filter(Boolean)
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 도시 목록 렌더링
   */
  async renderCities(data, ctx) {
    const { cities, defaultCity } = data;

    const text = `🏙️ *도시 선택*

날씨를 확인할 도시를 선택하세요:
현재 기본 도시: *${defaultCity}* ${this.cityEmojis[defaultCity] || "🏙️"}`;

    // 2x4 그리드로 도시 버튼 배열
    const cityButtons = [];
    for (let i = 0; i < cities.length; i += 2) {
      const row = [];
      for (let j = 0; j < 2 && i + j < cities.length; j++) {
        const city = cities[i + j];
        row.push({
          text: `${this.cityEmojis[city.name] || "🏙️"} ${city.name}`,
          action: `city:${city.id}`
        });
      }
      cityButtons.push(row);
    }

    // 설정 및 뒤로가기 버튼
    cityButtons.push([{ text: "⚙️ 기본 도시 설정", action: "cities" }]);
    cityButtons.push([{ text: "◀️ 뒤로", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(cityButtons);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 날씨 정보 렌더링
   */
  async renderWeather(data, ctx) {
    const { city, weather, dust, timestamp } = data;

    // 아이콘 변환 (렌더러의 책임!)
    const weatherIcon = this.getWeatherIcon(weather.iconCode);
    const tempEmoji = this.getTemperatureEmoji(weather.temperature);

    let text = `${weatherIcon} *${city.name} 날씨*

🌡️ 현재: *${weather.temperature}°C* ${tempEmoji}
🌡️ 체감: ${weather.feelsLike}°C
💧 습도: ${weather.humidity}%
☁️ 구름: ${weather.cloudiness}%
💨 바람: ${weather.windSpeed}m/s
*${weather.description}*`;

    // 미세먼지 정보 추가
    if (dust) {
      const dustEmoji = this.dustEmojis[dust.grade] || "⚪";
      text += `

🌬️ *미세먼지 정보*
PM10: ${dust.pm10}㎍/㎥ ${dustEmoji}
PM2.5: ${dust.pm25}㎍/㎥
등급: *${dust.grade}*`;
    }

    text += `

⏰ ${timestamp}`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 새로고침", action: `city:${city.id}` },
          { text: "⭐ 기본 설정", action: `setdefault:${city.id}` }
        ],
        data.config?.enableForecast
          ? [{ text: "📊 날씨 예보", action: `forecast:${city.id}` }]
          : null,
        [
          { text: "🏙️ 도시 목록", action: "cities" },
          { text: "🏠 메인", action: "menu" }
        ]
      ].filter(Boolean)
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 날씨 예보 렌더링
   */
  async renderForecast(data, ctx) {
    const { city, forecast, timestamp } = data;

    let text = `📊 *${city.name} 5일 날씨 예보*\n\n`;

    forecast.forecasts.forEach((day, index) => {
      const date = new Date(day.date);
      const dayName = this.getDayName(date, index);
      const icon = this.getWeatherIcon(day.iconCode);

      text += `*${dayName}* (${TimeHelper.format(date, "MM/DD")})\n`;
      text += `${icon} ${day.description}\n`;
      text += `🌡️ ${day.tempMin}°C - ${day.tempMax}°C\n`;
      text += `💧 습도: ${day.avgHumidity}%\n\n`;
    });

    text += `⏰ ${timestamp}`;

    const keyboard = this.createInlineKeyboard([
      [
        { text: "🌡️ 현재 날씨", action: `city:${city.id}` },
        { text: "🔄 새로고침", action: `forecast:${city.id}` }
      ],
      [
        { text: "🏙️ 도시 목록", action: "cities" },
        { text: "🏠 메인", action: "menu" }
      ]
    ]);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 기본 도시 설정 성공 렌더링
   */
  async renderSettingSuccess(data, ctx) {
    const { city, userName } = data;

    const text = `✅ *설정 완료!*

${userName}님의 기본 도시가 *${city.name}*로 설정되었습니다.
이제 "현재 날씨"를 선택하면 ${city.name}의 날씨가 표시됩니다.`;

    const keyboard = this.createInlineKeyboard([
      [
        { text: "🌡️ 날씨 확인", action: `city:${city.id}` },
        { text: "🏠 메인", action: "menu" }
      ]
    ]);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 직접 메시지 날씨 렌더링
   */
  async renderCityWeatherDirect(data, ctx) {
    // 일반 날씨와 동일하지만 키보드 구성이 다름
    const result = await this.renderWeather(data, ctx);
    return result;
  }

  /**
   * 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { _config, majorCities, features } = data;

    let text = `❓ *날씨 모듈 도움말*
*주요 기능:*
• ${features.weather} - 온도, 습도, 구름량 등
• ${features.cities} - ${majorCities.map((c) => c.name).join(", ")}
${features.dust ? `• ${features.dust}` : ""}
${features.forecast ? `• ${features.forecast}` : ""}
• ${features.setting}
*사용 방법:*
• 채팅창에 "날씨" 또는 "서울 날씨"라고 입력
• 버튼을 눌러 도시별 날씨 확인
• ⭐ 버튼으로 자주 보는 도시를 기본 설정
*팁:*
• 날씨 정보는 5분마다 업데이트됩니다
• 기본 도시를 설정하면 더 빠르게 확인 가능`;

    const keyboard = this.createInlineKeyboard([
      [
        { text: "🌡️ 날씨 확인", action: "current" },
        { text: "🏙️ 도시 선택", action: "cities" }
      ],
      [{ text: "🏠 메인", action: "menu" }]
    ]);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 에러 렌더링
   */
  async renderError(data, ctx) {
    // data가 없거나 message가 없는 경우 처리
    const message = data?.message || "알 수 없는 오류가 발생했습니다.";

    const text = `❌ *오류 발생*

${message}

문제가 지속되면 관리자에게 문의하세요.`;

    const keyboard = this.createInlineKeyboard([
      [
        { text: "🏠 메인", action: "menu" },
        { text: "◀️ 메인 메뉴", action: "menu", module: "system" }
      ]
    ]);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ===== 헬퍼 메서드 (UI 관련만!) =====

  /**
   * 날씨 아이콘 변환
   */
  getWeatherIcon(iconCode) {
    return this.weatherIcons[iconCode] || "🌤️";
  }

  /**
   * 온도별 이모지
   */
  getTemperatureEmoji(temp) {
    if (temp >= 35) return "🥵";
    if (temp >= 30) return "🔥";
    if (temp >= 25) return "☀️";
    if (temp >= 20) return "😊";
    if (temp >= 15) return "🌤️";
    if (temp >= 10) return "🌥️";
    if (temp >= 5) return "🧥";
    if (temp >= 0) return "🥶";
    return "🧊";
  }

  /**
   * 요일 이름 생성
   */
  getDayName(date, index) {
    if (index === 0) return "오늘";
    if (index === 1) return "내일";

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return weekdays[date.getDay()] + "요일";
  }
}

module.exports = WeatherRenderer;
