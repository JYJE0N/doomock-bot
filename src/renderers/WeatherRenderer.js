// src/renderers/WeatherRenderer.js - 날씨 모듈 렌더러

const BaseRenderer = require("./BaseRenderer");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🌤️ WeatherRenderer - 날씨 정보 UI 렌더러
 * - 현재 날씨 표시
 * - 미세먼지 정보
 * - 간단하고 직관적인 디자인
 */
class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "weather";
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    logger.debug(`🌤️ WeatherRenderer: ${type} 타입 렌더링`);

    try {
      switch (type) {
        case "menu":
          return await this.renderWeatherMenu(data, ctx);

        case "current":
          return await this.renderCurrentWeather(data, ctx);

        case "dust":
          return await this.renderDustInfo(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "날씨 정보를 불러올 수 없습니다",
            ctx
          );

        default:
          logger.warn(`🌤️ WeatherRenderer: 지원하지 않는 타입 - ${type}`);
          return await this.renderError("지원하지 않는 기능입니다", ctx);
      }
    } catch (error) {
      logger.error(`🌤️ WeatherRenderer 렌더링 오류 (${type}):`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다", ctx);
    }
  }

  /**
   * 🌤️ 날씨 메인 메뉴 렌더링
   */
  async renderWeatherMenu(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);
    const weather = data?.weather;

    let text = "🌤️ *날씨 정보*\n\n";

    if (weather) {
      // 현재 날씨 정보 포함된 메뉴
      text += `📍 *${this.escapeMarkdownV2(weather.location || "서울")}*\n`;
      text += `🌡️ **${weather.temp}°C**\n`;

      if (weather.description) {
        text += `☁️ ${this.escapeMarkdownV2(weather.description)}\n`;
      }

      if (weather.humidity) {
        text += `💧 습도: ${weather.humidity}%\n`;
      }

      text += "\n";
    } else {
      text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n`;
      text += "원하는 날씨 정보를 선택해주세요\\.\n\n";
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "💨 미세먼지", callback_data: "weather:dust" },
        ],
        [
          { text: "❓ 도움말", callback_data: "weather:help" },
          { text: "🔄 새로고침", callback_data: "weather:menu" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 🌡️ 현재 날씨 상세 렌더링
   */
  async renderCurrentWeather(data, ctx) {
    const weather = data?.weather;

    let text = "🌡️ *현재 날씨*\n\n";

    if (weather) {
      text += `📍 **${this.escapeMarkdownV2(weather.location || "서울")}**\n\n`;

      // 온도 정보
      text += `🌡️ **온도**: ${weather.temp}°C\n`;

      if (weather.feels_like) {
        text += `🤗 **체감온도**: ${weather.feels_like}°C\n`;
      }

      // 날씨 설명
      if (weather.description) {
        text += `☁️ **날씨**: ${this.escapeMarkdownV2(weather.description)}\n`;
      }

      // 추가 정보
      if (weather.humidity) {
        text += `💧 **습도**: ${weather.humidity}%\n`;
      }

      if (weather.wind_speed) {
        text += `🌬️ **풍속**: ${weather.wind_speed}m/s\n`;
      }

      if (weather.pressure) {
        text += `📊 **기압**: ${weather.pressure}hPa\n`;
      }

      // 일출/일몰 정보 (있는 경우)
      if (weather.sunrise && weather.sunset) {
        text += `\n🌅 **일출**: ${weather.sunrise}\n`;
        text += `🌇 **일몰**: ${weather.sunset}\n`;
      }

      text += `\n⏰ 마지막 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`;
    } else {
      text += "❌ 날씨 정보를 불러올 수 없습니다\\.\n";
      text += "잠시 후 다시 시도해주세요\\.";
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "weather:current" },
          { text: "💨 미세먼지", callback_data: "weather:dust" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 💨 미세먼지 정보 렌더링
   */
  async renderDustInfo(data, ctx) {
    const dust = data?.dust;

    let text = "💨 *미세먼지 정보*\n\n";

    if (dust) {
      text += `📍 **${this.escapeMarkdownV2(dust.location || "서울")}**\n\n`;

      // PM2.5 정보
      if (dust.pm25) {
        const pm25Level = this.getDustLevel(dust.pm25, "pm25");
        text += `🔸 **PM2\\.5**: ${dust.pm25}㎍/㎥ ${pm25Level.emoji}\n`;
        text += `   ${this.escapeMarkdownV2(pm25Level.description)}\n\n`;
      }

      // PM10 정보
      if (dust.pm10) {
        const pm10Level = this.getDustLevel(dust.pm10, "pm10");
        text += `🔹 **PM10**: ${dust.pm10}㎍/㎥ ${pm10Level.emoji}\n`;
        text += `   ${this.escapeMarkdownV2(pm10Level.description)}\n\n`;
      }

      text += `⏰ 마지막 업데이트: ${new Date().toLocaleTimeString("ko-KR")}`;
    } else {
      text += "❌ 미세먼지 정보를 불러올 수 없습니다\\.\n";
      text += "잠시 후 다시 시도해주세요\\.";
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "weather:dust" },
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    let text = "❓ *날씨 모듈 도움말*\n\n";

    text += "🌤️ **사용 가능한 기능**:\n";
    text += "• 🌡️ 현재 날씨 조회\n";
    text += "• 💨 미세먼지 정보\n";
    text += "• 🔄 실시간 업데이트\n\n";

    text += "📍 **지역 설정**:\n";
    text += "기본적으로 서울 지역의 정보를 제공합니다\\.\n\n";

    text += "⏰ **업데이트 주기**:\n";
    text += "날씨 정보는 10분마다 자동 갱신됩니다\\.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "💨 미세먼지", callback_data: "weather:dust" },
        ],
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ❌ 에러 화면 렌더링
   */
  async renderError(message, ctx) {
    let text = "❌ *날씨 정보 오류*\n\n";
    text += `${this.escapeMarkdownV2(message)}\n\n`;
    text += "잠시 후 다시 시도해주세요\\.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "weather:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🌤️ 날씨 이모지 선택
   */
  getWeatherEmoji(description) {
    const desc = description.toLowerCase();

    if (desc.includes("맑")) return "☀️";
    if (desc.includes("구름")) return "☁️";
    if (desc.includes("흐림")) return "☁️";
    if (desc.includes("비")) return "🌧️";
    if (desc.includes("눈")) return "❄️";
    if (desc.includes("천둥")) return "⛈️";
    if (desc.includes("안개")) return "🌫️";

    return "🌤️";
  }

  /**
   * 💨 미세먼지 등급 판정
   */
  getDustLevel(value, type) {
    const levels = {
      pm25: [
        {
          max: 15,
          level: "좋음",
          emoji: "😊",
          description: "좋음 - 외출하기 좋은 날씨입니다",
        },
        {
          max: 35,
          level: "보통",
          emoji: "😐",
          description: "보통 - 일반적인 야외활동 가능합니다",
        },
        {
          max: 75,
          level: "나쁨",
          emoji: "😷",
          description: "나쁨 - 마스크 착용을 권장합니다",
        },
        {
          max: Infinity,
          level: "매우나쁨",
          emoji: "😨",
          description: "매우나쁨 - 외출을 자제해주세요",
        },
      ],
      pm10: [
        {
          max: 30,
          level: "좋음",
          emoji: "😊",
          description: "좋음 - 외출하기 좋은 날씨입니다",
        },
        {
          max: 80,
          level: "보통",
          emoji: "😐",
          description: "보통 - 일반적인 야외활동 가능합니다",
        },
        {
          max: 150,
          level: "나쁨",
          emoji: "😷",
          description: "나쁨 - 마스크 착용을 권장합니다",
        },
        {
          max: Infinity,
          level: "매우나쁨",
          emoji: "😨",
          description: "매우나쁨 - 외출을 자제해주세요",
        },
      ],
    };

    const thresholds = levels[type] || levels.pm25;

    for (const threshold of thresholds) {
      if (value <= threshold.max) {
        return threshold;
      }
    }

    return thresholds[thresholds.length - 1];
  }

  /**
   * 🌡️ 온도별 이모지
   */
  getTemperatureEmoji(temp) {
    if (temp >= 30) return "🔥";
    if (temp >= 25) return "😎";
    if (temp >= 20) return "😊";
    if (temp >= 10) return "😐";
    if (temp >= 0) return "🥶";
    return "🧊";
  }
}

module.exports = WeatherRenderer;
