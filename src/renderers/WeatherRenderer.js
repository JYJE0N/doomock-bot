// src/renderers/WeatherRenderer.js - 완성된 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherRenderer - 날씨 정보 렌더링
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
        case "current":
          await this.renderCurrentWeather(data, ctx);
          break;
        case "dust":
          await this.renderDustInfo(data, ctx);
          break;
        case "complete":
          await this.renderCompleteInfo(data, ctx);
          break;
        case "help":
          await this.renderHelp(data, ctx);
          break;
        case "status":
          await this.renderStatus(data, ctx);
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
   * 📍 위치 정보 포맷팅
   */
  formatLocationInfo(data) {
    let locationText = "";

    // GPS 감지 여부에 따른 아이콘
    const locationIcon = data.isGPSDetected ? "📍" : "📌";

    // 전체 주소가 있으면 사용
    if (data.fullAddress) {
      locationText = `${locationIcon} **${this.escapeMarkdownV2(
        data.fullAddress
      )}**`;
    } else if (data.location) {
      locationText = `${locationIcon} **${this.escapeMarkdownV2(
        data.location
      )}**`;
    }

    // GPS 감지 방법 표시 (사용자 친화적으로)
    if (data.locationInfo?.method) {
      const methodText =
        {
          kakao_api: "현재 위치",
          kakao_search: "지역 검색",
          auto: "자동 감지",
          cache: "저장된 위치",
          default: "기본 위치",
          manual: "직접 입력",
          user_input: "설정 위치",
        }[data.locationInfo.method] || "";

      if (methodText) {
        locationText += ` \\(${methodText}\\)`;
      }
    }

    return locationText;
  }

  /**
   * 📋 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    let text = "🌤️ *날씨 정보 메뉴*\n\n";
    text += "GPS 기반으로 현재 위치의 날씨 정보를 제공합니다\\.\n\n";
    text += "원하는 정보를 선택해주세요:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "💨 미세먼지", callback_data: "weather:dust" },
        ],
        [{ text: "🌍 통합 정보", callback_data: "weather:complete" }],
        [
          { text: "❓ 도움말", callback_data: "weather:help" },
          { text: "📊 상태", callback_data: "weather:status" },
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
   * 🌡️ 현재 날씨 렌더링
   */
  async renderCurrentWeather(data, ctx) {
    const weather = data?.data?.weather || data?.data;

    let text = "🌤️ *현재 날씨*\n\n";

    if (weather) {
      // 위치 정보 표시
      text += this.formatLocationInfo(data.data || data) + "\n\n";

      // 날씨 아이콘 및 설명
      if (weather.description) {
        const weatherEmoji = this.getWeatherEmoji(weather.main);
        text += `${weatherEmoji} **${this.escapeMarkdownV2(
          weather.description
        )}**\n\n`;
      }

      // 온도 정보
      text += `🌡️ **온도**: ${weather.temperature}°C`;
      if (weather.feelsLike) {
        text += ` \\(체감 ${weather.feelsLike}°C\\)`;
      }
      text += "\n";

      // 습도
      if (weather.humidity) {
        text += `💧 **습도**: ${weather.humidity}%\n`;
      }

      // 바람
      if (weather.windSpeed !== undefined && weather.windSpeed > 0) {
        text += `🌬️ **풍속**: ${weather.windSpeed}m/s`;
        if (weather.windDirection) {
          text += ` \\(${weather.windDirection}\\)`;
        }
        text += "\n";
      }

      // 기압
      if (weather.pressure) {
        text += `📊 **기압**: ${weather.pressure}hPa\n`;
      }

      // 가시거리
      if (weather.visibility) {
        text += `👁️ **가시거리**: ${weather.visibility}km\n`;
      }

      // 구름량
      if (weather.cloudiness !== undefined) {
        text += `☁️ **구름량**: ${weather.cloudiness}%\n`;
      }

      // 일출/일몰
      if (weather.sunrise && weather.sunset) {
        text += `\n🌅 **일출**: ${weather.sunrise}\n`;
        text += `🌇 **일몰**: ${weather.sunset}\n`;
      }

      // 날씨 조언
      if (weather.advice) {
        text += `\n💡 **조언**: ${this.escapeMarkdownV2(weather.advice)}\n`;
      }

      // 업데이트 시간
      text += `\n⏰ **업데이트**: ${
        data.timestamp || TimeHelper.format(TimeHelper.now(), "time")
      }`;

      // 데이터 출처
      if (data.source) {
        text += `\n📡 **출처**: ${this.escapeMarkdownV2(data.source)}`;
      }

      // 경고 메시지
      if (data.warning) {
        text += `\n⚠️ ${this.escapeMarkdownV2(data.warning)}`;
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
   * 💨 미세먼지 정보 렌더링
   */
  async renderDustInfo(data, ctx) {
    const dust = data?.data?.dust || data?.data;

    let text = "💨 *미세먼지 정보*\n\n";

    if (dust) {
      // 위치 정보 표시
      text += this.formatLocationInfo(data.data || data) + "\n";

      // 측정소 정보
      if (dust.stationName) {
        text += `🏢 측정소: ${this.escapeMarkdownV2(dust.stationName)}\n\n`;
      } else {
        text += "\n";
      }

      // PM2.5 정보
      if (dust.pm25) {
        const pm25Value = dust.pm25.value || dust.pm25;
        const pm25Grade =
          dust.pm25.grade || this.getDustGrade(pm25Value, "pm25");
        const pm25Emoji = this.getDustEmoji(pm25Grade);
        text += `🔸 **초미세먼지\\(PM2\\.5\\)**: ${pm25Value}${
          dust.pm25.unit || "㎍/㎥"
        } ${pm25Emoji}\n`;
        text += `   상태: ${this.escapeMarkdownV2(pm25Grade)}\n\n`;
      }

      // PM10 정보
      if (dust.pm10) {
        const pm10Value = dust.pm10.value || dust.pm10;
        const pm10Grade =
          dust.pm10.grade || this.getDustGrade(pm10Value, "pm10");
        const pm10Emoji = this.getDustEmoji(pm10Grade);
        text += `🔹 **미세먼지\\(PM10\\)**: ${pm10Value}${
          dust.pm10.unit || "㎍/㎥"
        } ${pm10Emoji}\n`;
        text += `   상태: ${this.escapeMarkdownV2(pm10Grade)}\n\n`;
      }

      // 종합 상태
      if (dust.overall) {
        const overallGrade = dust.overall.grade || dust.overall;
        const overallEmoji =
          dust.overall.emoji || this.getDustEmoji(overallGrade);
        text += `📊 **종합 대기질**: ${this.escapeMarkdownV2(
          overallGrade
        )} ${overallEmoji}\n`;
        if (dust.overall.value && dust.overall.value !== "-") {
          text += `   통합지수: ${dust.overall.value}\n`;
        }
        text += "\n";
      }

      // 행동 요령
      if (dust.advice) {
        text += `💡 **행동요령**:\n${this.escapeMarkdownV2(dust.advice)}\n\n`;
      }

      // 업데이트 시간
      text += `⏰ **측정시간**: ${
        dust.timestamp || TimeHelper.format(TimeHelper.now(), "time")
      }`;

      // 데이터 출처
      if (data.source) {
        const sourceText =
          {
            api: "한국환경공단",
            estimated: "추정 데이터",
            cache: "캐시 데이터",
            fallback: "대체 데이터",
          }[data.source] || data.source;
        text += `\n📡 **출처**: ${this.escapeMarkdownV2(sourceText)}`;
      }

      // 경고 메시지
      if (data.warning) {
        text += `\n⚠️ ${this.escapeMarkdownV2(data.warning)}`;
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
   * 🌍 통합 정보 렌더링
   */
  async renderCompleteInfo(data, ctx) {
    let text = "🌍 *날씨 & 미세먼지 통합 정보*\n\n";

    // 위치 정보
    if (data.data) {
      text += this.formatLocationInfo(data.data) + "\n\n";
    }

    // 날씨 정보
    if (data.data?.weather) {
      const weather = data.data.weather;
      text += "━━━ *날씨 정보* ━━━\n";
      text += `${this.getWeatherEmoji(weather.main)} ${this.escapeMarkdownV2(
        weather.description || "날씨 정보 없음"
      )}\n`;
      text += `🌡️ ${weather.temperature || "-"}°C \\(체감 ${
        weather.feelsLike || weather.temperature || "-"
      }°C\\)\n`;
      text += `💧 습도 ${weather.humidity || "-"}%\n`;
      if (weather.windSpeed) {
        text += `🌬️ 풍속 ${weather.windSpeed}m/s\n`;
      }
      text += "\n";
    }

    // 미세먼지 정보
    if (data.data?.dust) {
      const dust = data.data.dust;
      text += "━━━ *대기질 정보* ━━━\n";

      if (dust.pm25) {
        const pm25Value = dust.pm25.value || dust.pm25;
        text += `🔸 PM2\\.5: ${pm25Value}㎍/㎥ \\(${
          dust.pm25.grade || "보통"
        }\\)\n`;
      }

      if (dust.pm10) {
        const pm10Value = dust.pm10.value || dust.pm10;
        text += `🔹 PM10: ${pm10Value}㎍/㎥ \\(${
          dust.pm10.grade || "보통"
        }\\)\n`;
      }

      if (dust.overall) {
        text += `📊 종합: ${dust.overall.grade || "보통"} ${
          dust.overall.emoji || ""
        }\n`;
      }
    }

    // 업데이트 시간 표시 개선
    text += "\n━━━ *업데이트 정보* ━━━\n";

    // 날씨 업데이트 시간
    if (data.data?.weather?.timestamp) {
      text += `🌤️ 날씨: ${this.escapeMarkdownV2(
        data.data.weather.timestamp
      )}\n`;
    }

    // 미세먼지 업데이트 시간
    if (data.data?.dust?.timestamp) {
      text += `💨 미세먼지: ${this.escapeMarkdownV2(
        data.data.dust.timestamp
      )}\n`;
    }

    // 통합 업데이트 시간 (최종)
    const updateTime =
      data.data?.timestamp ||
      data.timestamp ||
      TimeHelper.format(TimeHelper.now(), "full");
    text += `📅 **업데이트**: ${this.escapeMarkdownV2(updateTime)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "weather:complete" },
          { text: "🌡️ 날씨만", callback_data: "weather:current" },
          { text: "💨 미세먼지만", callback_data: "weather:dust" },
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
    text += "• 🌍 통합 대시보드\n";
    text += "• 🔄 실시간 업데이트\n\n";

    text += "📍 **위치 감지 방법**:\n";
    text += "• 자동으로 대략적인 위치를 파악합니다\n";
    text += "• 더 정확한 위치는 직접 설정 가능합니다\n";
    text += "• 위치 정보는 1시간 동안 저장됩니다\n\n";

    text += "⏰ **업데이트 주기**:\n";
    text += "• 날씨: 10분마다 갱신\n";
    text += "• 미세먼지: 실시간 조회\n";
    text += "• 위치 캐시: 1시간 유지\n\n";

    text += "💡 **팁**:\n";
    text += "• GPS 위치는 자동으로 감지됩니다\n";
    text += "• 새로고침으로 최신 정보를 확인하세요\n";
    text += "• 미세먼지 나쁨 이상일 때 마스크 착용을 권장합니다";

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
   * 📊 상태 렌더링
   */
  async renderStatus(data, ctx) {
    let text = "📊 *날씨 서비스 상태*\n\n";

    if (data.data) {
      const status = data.data;

      text += "**서비스 상태**:\n";
      text += `• 초기화: ${status.initialized ? "✅" : "❌"}\n`;
      text += `• 날씨 서비스: ${status.services?.weather || "Unknown"}\n`;
      text += `• 미세먼지 서비스: ${status.services?.dust || "Unknown"}\n`;
      text += `• 위치 서비스: ${status.services?.location || "Unknown"}\n\n`;

      if (status.stats) {
        text += "**통계**:\n";
        text += `• 날씨 요청: ${status.stats.weatherRequests || 0}회\n`;
        text += `• 미세먼지 요청: ${status.stats.dustRequests || 0}회\n`;
        text += `• GPS 요청: ${status.stats.gpsRequests || 0}회\n`;
        text += `• 위치 캐시 히트: ${status.stats.locationCacheHits || 0}회\n`;
        text += `• 오류: ${status.stats.errors || 0}회\n\n`;
      }

      if (status.cache) {
        text += "**캐시 정보**:\n";
        text += `• 사용자 위치: ${status.cache.userLocations || 0}개\n\n`;
      }

      text += `**마지막 업데이트**: ${status.lastUpdate || "없음"}`;
    }

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
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    let text = "❌ *오류 발생*\n\n";
    text += this.escapeMarkdownV2(
      data.message || "알 수 없는 오류가 발생했습니다."
    );

    if (data.data?.canRetry) {
      text += "\n\n다시 시도해주세요\\.";
    }

    if (data.data?.suggestions) {
      text += "\n\n💡 **제안사항**:\n";
      data.data.suggestions.forEach((suggestion) => {
        text += `• ${this.escapeMarkdownV2(suggestion)}\n`;
      });
    }

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
   * 🌤️ 날씨 아이콘 매핑
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
   * 😷 미세먼지 등급별 이모지
   */
  getDustEmoji(grade) {
    const emojiMap = {
      좋음: "😊",
      보통: "🙂",
      나쁨: "😷",
      매우나쁨: "🚨",
    };
    return emojiMap[grade] || "❓";
  }

  /**
   * 🎯 미세먼지 등급 판정
   */
  getDustGrade(value, type) {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return "알 수 없음";

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
