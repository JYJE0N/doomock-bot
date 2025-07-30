// src/renderers/WeatherRenderer.js - 데이터 매핑 수정 버전

const BaseRenderer = require("./BaseRenderer");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🌤️ WeatherRenderer - 날씨 정보 UI 렌더러 (데이터 매핑 수정)
 *
 * 🔧 수정사항:
 * - Weather 모델의 속성명과 일치하도록 매핑 수정
 * - temperature, feelsLike, windSpeed 등 정확한 속성명 사용
 * - 데이터 존재 여부 안전하게 확인
 * - 일관된 데이터 접근 패턴 적용
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
   * 🌤️ 날씨 메인 메뉴 렌더링 (수정됨)
   */
  async renderWeatherMenu(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);
    const weather = data?.weather;

    let text = "🌤️ *날씨 정보*\n\n";

    if (weather) {
      // ✅ 수정: Weather 모델의 정확한 속성명 사용
      text += `📍 *${this.escapeMarkdownV2(weather.location || "서울")}*\n`;

      // 🌡️ temperature 속성 사용 (temp가 아닌!)
      if (weather.temperature !== undefined && weather.temperature !== null) {
        text += `🌡️ **${weather.temperature}°C**\n`;
      } else {
        text += `🌡️ **측정중**\n`;
      }

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
   * 🌡️ 현재 날씨 상세 렌더링 (완전 수정됨)
   */
  async renderCurrentWeather(data, ctx) {
    const weather = data?.weather;

    let text = "🌡️ *현재 날씨*\n\n";

    if (weather) {
      // 📍 위치 정보
      text += `📍 **${this.escapeMarkdownV2(weather.location || "서울")}**\n\n`;

      // 🌡️ 온도 정보 - 정확한 속성명 사용
      if (weather.temperature !== undefined && weather.temperature !== null) {
        const tempEmoji = this.getTemperatureEmoji(weather.temperature);
        text += `🌡️ **온도**: ${weather.temperature}°C ${tempEmoji}\n`;
      } else {
        text += `🌡️ **온도**: 측정중\n`;
      }

      // 🤗 체감온도 - Weather 모델의 feelsLike 속성 사용
      if (
        weather.feelsLike !== undefined &&
        weather.feelsLike !== null &&
        weather.feelsLike !== weather.temperature
      ) {
        text += `🤗 **체감온도**: ${weather.feelsLike}°C\n`;
      }

      // 🌡️ 최저/최고 온도
      if (weather.tempMin !== undefined && weather.tempMax !== undefined) {
        text += `📊 **최저/최고**: ${weather.tempMin}°C / ${weather.tempMax}°C\n`;
      }

      // ☁️ 날씨 설명
      if (weather.description) {
        const weatherEmoji = this.getWeatherEmoji(weather.description);
        text += `☁️ **날씨**: ${this.escapeMarkdownV2(
          weather.description
        )} ${weatherEmoji}\n`;
      }

      text += "\n";

      // 💨 환경 정보
      if (weather.humidity) {
        text += `💧 **습도**: ${weather.humidity}%\n`;
      }

      // 🌬️ 바람 정보 - Weather 모델의 windSpeed 속성 사용
      if (weather.windSpeed !== undefined && weather.windSpeed > 0) {
        text += `🌬️ **풍속**: ${weather.windSpeed}m/s`;
        if (weather.windDirection) {
          text += ` (${weather.windDirection})`;
        }
        text += "\n";
      }

      if (weather.pressure) {
        text += `📊 **기압**: ${weather.pressure}hPa\n`;
      }

      // 👁️ 가시거리
      if (weather.visibility) {
        text += `👁️ **가시거리**: ${weather.visibility}km\n`;
      }

      // ☁️ 구름량
      if (weather.cloudiness !== undefined) {
        text += `☁️ **구름량**: ${weather.cloudiness}%\n`;
      }

      // 🌅 일출/일몰 정보
      if (weather.sunrise && weather.sunset) {
        text += `\n🌅 **일출**: ${weather.sunrise}\n`;
        text += `🌇 **일몰**: ${weather.sunset}\n`;
      }

      // 💡 날씨 조언
      if (weather.advice) {
        text += `\n💡 **조언**: ${this.escapeMarkdownV2(weather.advice)}\n`;
      }

      // ⏰ 업데이트 시간
      text += `\n⏰ **업데이트**: ${
        weather.lastUpdate || new Date().toLocaleTimeString("ko-KR")
      }`;

      // 📡 데이터 출처
      if (weather.meta?.source) {
        text += `\n📡 **출처**: ${weather.meta.source}`;
      }
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
   * 💨 미세먼지 정보 렌더링 (기존 유지)
   */
  async renderDustInfo(data, ctx) {
    const dust = data?.dust;

    let text = "💨 *미세먼지 정보*\n\n";

    if (dust) {
      // 🔥 수정: dust.location이 아니라 data.location 사용!
      const displayLocation = data.location || dust.location || "서울";
      text += `📍 **${this.escapeMarkdownV2(displayLocation)}**\n\n`;

      // 🚨 수정: dust.pm25.value 사용 (dust.pm25가 아닌!)
      // PM2.5 정보
      if (dust.pm25) {
        // value 속성을 명시적으로 가져옴
        const pm25Value = dust.pm25.value || dust.pm25;
        const pm25Level = this.getDustLevel(pm25Value, "pm25");
        text += `🔸 **PM2\\.5**: ${pm25Value}㎍/㎥ ${pm25Level.emoji}\n`;
        text += `   ${this.escapeMarkdownV2(pm25Level.description)}\n\n`;
      }

      // PM10 정보
      if (dust.pm10) {
        // value 속성을 명시적으로 가져옴
        const pm10Value = dust.pm10.value || dust.pm10;
        const pm10Level = this.getDustLevel(pm10Value, "pm10");
        text += `🔹 **PM10**: ${pm10Value}㎍/㎥ ${pm10Level.emoji}\n`;
        text += `   ${this.escapeMarkdownV2(pm10Level.description)}\n\n`;
      }

      // 종합 상태
      if (dust.overall) {
        text += `📊 **종합**: ${this.escapeMarkdownV2(
          dust.overall.grade || dust.overall
        )} ${dust.overall.emoji || ""}\n\n`;
      }

      // 행동 요령
      if (dust.advice) {
        text += `💡 **행동요령**:\n${this.escapeMarkdownV2(dust.advice)}\n\n`;
      }

      // 업데이트 시간
      text += `⏰ **업데이트**: ${
        dust.timestamp || TimeHelper.format(TimeHelper.now(), "time")
      }`;

      // 데이터 출처
      if (data.source) {
        text += `\n📡 **출처**: ${this.escapeMarkdownV2(data.source)}`;
      }

      // GPS 위치 정보
      if (data.locationInfo) {
        text += `\n${this.escapeMarkdownV2(data.locationInfo)}`;
      }
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
   * ❓ 도움말 렌더링 (기존 유지)
   */
  async renderHelp(data, ctx) {
    let text = "❓ *날씨 모듈 도움말*\n\n";

    text += "🌤️ **사용 가능한 기능**:\n";
    text += "• 🌡️ 현재 날씨 조회\n";
    text += "• 💨 미세먼지 정보\n";
    text += "• 🔄 실시간 업데이트\n\n";

    text += "📍 **지역 설정**:\n";
    text += "GPS 기반으로 현재 위치의 날씨를 제공합니다\\.\n\n";

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
   * ❌ 에러 화면 렌더링 (기존 유지)
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

  // ===== 🛠️ 유틸리티 메서드들 (기존 유지) =====

  /**
   * 🌤️ 날씨 이모지 선택
   */
  getWeatherEmoji(description) {
    if (!description) return "🌤️";

    const desc = description.toLowerCase();

    if (desc.includes("맑")) return "☀️";
    if (desc.includes("구름")) return "☁️";
    if (desc.includes("흐림")) return "☁️";
    if (desc.includes("비")) return "🌧️";
    if (desc.includes("눈")) return "❄️";
    if (desc.includes("천둥")) return "⛈️";
    if (desc.includes("안개")) return "🌫️";
    if (desc.includes("clear")) return "☀️";
    if (desc.includes("cloud")) return "☁️";
    if (desc.includes("rain")) return "🌧️";
    if (desc.includes("snow")) return "❄️";
    if (desc.includes("storm")) return "⛈️";
    if (desc.includes("mist") || desc.includes("fog")) return "🌫️";

    return "🌤️";
  }

  /**
   * 💨 미세먼지 등급 판정 (기존 유지)
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
   * 🌡️ 온도별 이모지 (개선됨)
   */
  getTemperatureEmoji(temp) {
    if (temp === null || temp === undefined) return "❓";

    if (temp >= 35) return "🔥"; // 매우 더움
    if (temp >= 30) return "😵"; // 더움
    if (temp >= 25) return "😎"; // 따뜻함
    if (temp >= 20) return "😊"; // 좋음
    if (temp >= 15) return "🙂"; // 약간 시원
    if (temp >= 10) return "😐"; // 시원
    if (temp >= 5) return "🥶"; // 춥다
    if (temp >= 0) return "🧊"; // 매우 춥다
    return "❄️"; // 극한 추위
  }
}

module.exports = WeatherRenderer;
