// src/renderers/WeatherRenderer.js - 심플한 주요 도시 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherRenderer - 심플한 날씨 렌더링
 */
class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    logger.info("🌤️ WeatherRenderer 생성됨");
  }

  /**
   * 🎯 타입별 렌더링 처리
   */
  async render(data, ctx) {
    if (!data || !data.type) {
      logger.error("렌더링 데이터 없음");
      return;
    }

    try {
      switch (data.type) {
        case "menu":
          await this.renderMenu(data, ctx);
          break;
        case "cities":
          await this.renderCityList(data, ctx);
          break;
        case "weather":
          await this.renderCityWeather(data, ctx);
          break;
        case "default_set":
          await this.renderDefaultSet(data, ctx);
          break;
        case "help":
          await this.renderHelp(data, ctx);
          break;
        case "error":
          await this.renderError(data, ctx);
          break;
        default:
          logger.warn(`알 수 없는 렌더링 타입: ${data.type}`);
      }
    } catch (error) {
      logger.error("WeatherRenderer 오류:", error);
      await this.renderError({ message: error.message }, ctx);
    }
  }

  /**
   * 📋 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    let text = "🌤️ *날씨 정보*\n\n";
    text += "주요 도시의 날씨를 확인하세요\\.\n";
    text += `⭐ 기본 도시: ${this.escapeMarkdownV2(data.data.defaultCity)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏛️ 서울", callback_data: "weather:city:seoul" },
          { text: "🏰 수원", callback_data: "weather:city:suwon" },
        ],
        [
          { text: "✈️ 인천", callback_data: "weather:city:incheon" },
          { text: "🚄 대전", callback_data: "weather:city:daejeon" },
        ],
        [
          { text: "🍎 대구", callback_data: "weather:city:daegu" },
          { text: "🌊 부산", callback_data: "weather:city:busan" },
        ],
        [
          { text: "🌻 광주", callback_data: "weather:city:gwangju" },
          { text: "🏝️ 제주", callback_data: "weather:city:jeju" },
        ],
        [
          { text: "❓ 도움말", callback_data: "weather:help" },
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

  /**
   * 🏙️ 도시 목록 렌더링
   */
  async renderCityList(data, ctx) {
    let text = "📍 *주요 도시 날씨*\n\n";
    text += "원하는 도시를 선택하세요:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏛️ 서울", callback_data: "weather:city:seoul" },
          { text: "🏰 수원", callback_data: "weather:city:suwon" },
        ],
        [
          { text: "✈️ 인천", callback_data: "weather:city:incheon" },
          { text: "🚄 대전", callback_data: "weather:city:daejeon" },
        ],
        [
          { text: "🍎 대구", callback_data: "weather:city:daegu" },
          { text: "🌊 부산", callback_data: "weather:city:busan" },
        ],
        [
          { text: "🌻 광주", callback_data: "weather:city:gwangju" },
          { text: "🏝️ 제주", callback_data: "weather:city:jeju" },
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
   * 🌡️ 도시별 날씨 렌더링
   */
  async renderCityWeather(data, ctx) {
    const { city, weather, dust } = data.data;

    let text = `${city.emoji} *${city.name} 날씨*\n\n`;

    // 날씨 정보
    if (weather) {
      text += `${this.getWeatherEmoji(weather.main)} **${this.escapeMarkdownV2(
        weather.description
      )}**\n\n`;

      text += `🌡️ **온도**: ${weather.temperature}°C`;
      if (weather.feelsLike) {
        text += ` \\(체감 ${weather.feelsLike}°C\\)`;
      }
      text += "\n";

      text += `💧 **습도**: ${weather.humidity}%\n`;

      if (weather.windSpeed > 0) {
        text += `🌬️ **풍속**: ${weather.windSpeed}m/s\n`;
      }

      text += "\n";
    }

    // 미세먼지 정보
    if (dust) {
      text += "━━━ *미세먼지* ━━━\n";

      if (dust.pm25) {
        const pm25Value = dust.pm25.value || dust.pm25;
        const pm25Grade =
          dust.pm25.grade || this.getDustGrade(pm25Value, "pm25");
        text += `🔸 PM2\\.5: ${pm25Value}㎍/㎥ \\(${pm25Grade}\\)\n`;
      }

      if (dust.pm10) {
        const pm10Value = dust.pm10.value || dust.pm10;
        const pm10Grade =
          dust.pm10.grade || this.getDustGrade(pm10Value, "pm10");
        text += `🔹 PM10: ${pm10Value}㎍/㎥ \\(${pm10Grade}\\)\n`;
      }

      text += "\n";
    }

    // 업데이트 시간
    text += `⏰ **업데이트**: ${this.escapeMarkdownV2(
      data.data.timestamp || TimeHelper.format(TimeHelper.now(), "time")
    )}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: `weather:city:${city.id}` },
          { text: "📋 다른 도시", callback_data: "weather:cities" },
        ],
        [
          {
            text: "⭐ 기본 도시로 설정",
            callback_data: `weather:setdefault:${city.id}`,
          },
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
   * ⭐ 기본 도시 설정 완료
   */
  async renderDefaultSet(data, ctx) {
    const { city, message } = data.data;

    let text = `✅ ${this.escapeMarkdownV2(message)}\n\n`;
    text += `이제 "날씨"라고 입력하면 ${city.emoji} ${city.name} 날씨가 표시됩니다\\.`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `${city.emoji} ${city.name} 날씨 보기`,
            callback_data: `weather:city:${city.id}`,
          },
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
    let text = "❓ *날씨 도움말*\n\n";

    text += "🌤️ **주요 기능**:\n";
    text += "• 전국 주요 8개 도시 날씨 확인\n";
    text += "• 실시간 온도, 습도, 풍속 정보\n";
    text += "• 미세먼지 \\(PM2\\.5, PM10\\) 정보\n";
    text += "• 기본 도시 설정 기능\n\n";

    text += "💬 **사용법**:\n";
    text += '• "날씨" \\- 기본 도시 날씨\n';
    text += '• "서울 날씨" \\- 서울 날씨\n';
    text += '• "부산 날씨" \\- 부산 날씨\n\n';

    text += "🏙️ **지원 도시**:\n";
    text += "서울, 수원, 인천, 대전, 대구, 부산, 광주, 제주\n\n";

    text += "💡 **팁**: 자주 확인하는 도시를 기본으로 설정하면 편리합니다\\!";

    const keyboard = {
      inline_keyboard: [
        [{ text: "📋 도시 목록", callback_data: "weather:cities" }],
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
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    let text = "❌ *오류*\n\n";
    text += this.escapeMarkdownV2(
      data.message || data.data?.message || "알 수 없는 오류가 발생했습니다."
    );

    const keyboard = {
      inline_keyboard: [
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
   * 🌤️ 날씨 아이콘
   */
  getWeatherEmoji(condition) {
    const emojiMap = {
      Clear: "☀️",
      Clouds: "☁️",
      Rain: "🌧️",
      Drizzle: "🌦️",
      Thunderstorm: "⛈️",
      Snow: "❄️",
      Mist: "🌫️",
      Fog: "🌫️",
      Haze: "🌫️",
    };
    return emojiMap[condition] || "🌤️";
  }

  /**
   * 🎯 미세먼지 등급 판정
   */
  getDustGrade(value, type) {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return "측정중";

    if (type === "pm25") {
      if (numValue <= 15) return "좋음";
      if (numValue <= 35) return "보통";
      if (numValue <= 75) return "나쁨";
      return "매우나쁨";
    } else {
      if (numValue <= 30) return "좋음";
      if (numValue <= 80) return "보통";
      if (numValue <= 150) return "나쁨";
      return "매우나쁨";
    }
  }
}

module.exports = WeatherRenderer;
