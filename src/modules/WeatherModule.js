// src/modules/WeatherModule.js - 표준화된 날씨 모듈

const BaseModule = require("../core/BaseModule");
const WeatherService = require("../services/WeatherService");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class WeatherModule extends BaseModule {
  constructor() {
    super("WeatherModule", {
      commands: ["weather", "날씨"],
      callbacks: ["weather"],
      features: ["current", "forecast", "location", "clothing"],
    });

    this.weatherService = new WeatherService();
    this.userStates = new Map();

    // 날씨 이모지
    this.weatherEmojis = {
      clear: "☀️",
      clouds: "☁️",
      rain: "🌧️",
      snow: "❄️",
      mist: "🌫️",
      thunderstorm: "⛈️",
      drizzle: "🌦️",
    };

    logger.info("🌤️ WeatherModule 생성됨");
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showWeatherMenu.bind(this),
      current: this.showCurrentWeather.bind(this),
      forecast: this.showForecast.bind(this),
      location: this.changeLocation.bind(this),
      clothing: this.getClothingAdvice.bind(this),
      help: this.showWeatherHelp.bind(this),
    });
  }

  // ✅ 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);
    if (userState?.action === "waiting_location") {
      return await this.handleLocationInput(bot, chatId, userId, text);
    }

    // 명령어 처리
    const command = this.extractCommand(text);

    if (command === "weather" || text === "날씨") {
      await this.showCurrentWeather(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    return false;
  }

  // ==================== 액션 핸들러 ====================

  /**
   * 날씨 메뉴 표시
   */
  async showWeatherMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    const userName = getUserName(callbackQuery.from);

    const menuText = `🌤️ **날씨 정보**\n\n${userName}님, 어떤 날씨 정보를 확인하시겠어요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "📅 예보", callback_data: "weather:forecast" },
        ],
        [
          { text: "📍 지역 변경", callback_data: "weather:location" },
          { text: "👕 의상 추천", callback_data: "weather:clothing" },
        ],
        [
          { text: "❓ 도움말", callback_data: "weather:help" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 현재 날씨 표시
   */
  async showCurrentWeather(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.chat?.id;
    const userId = callbackQuery.from?.id;

    try {
      // 로딩 메시지 (콜백인 경우)
      if (callbackQuery.message) {
        await this.editMessage(
          bot,
          chatId,
          callbackQuery.message.message_id,
          "🌤️ 날씨 정보를 가져오는 중..."
        );
      }

      // 날씨 데이터 가져오기
      const weatherData = await this.weatherService.getCurrentWeather("Seoul");

      if (!weatherData.success) {
        const errorText =
          "❌ 날씨 정보를 가져올 수 없습니다.\n잠시 후 다시 시도해주세요.";

        if (callbackQuery.message) {
          await this.editMessage(
            bot,
            chatId,
            callbackQuery.message.message_id,
            errorText
          );
        } else {
          await this.sendMessage(bot, chatId, errorText);
        }
        return;
      }

      const weather = weatherData.data;
      const emoji = this.getWeatherEmoji(weather.main);

      const weatherText = `🌤️ **현재 날씨 - 서울**

${emoji} **${weather.description}**

🌡️ **온도**: ${weather.temp}°C (체감 ${weather.feels_like}°C)
💧 **습도**: ${weather.humidity}%
💨 **바람**: ${weather.wind_speed}m/s
👁️ **가시거리**: ${(weather.visibility / 1000).toFixed(1)}km

📅 **업데이트**: ${new Date().toLocaleString("ko-KR")}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📅 예보 보기", callback_data: "weather:forecast" },
            { text: "👕 의상 추천", callback_data: "weather:clothing" },
          ],
          [
            { text: "🔄 새로고침", callback_data: "weather:current" },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      if (callbackQuery.message) {
        await this.editMessage(
          bot,
          chatId,
          callbackQuery.message.message_id,
          weatherText,
          {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );
      } else {
        await this.sendMessage(bot, chatId, weatherText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error("현재 날씨 표시 오류:", error);

      const errorText = "❌ 날씨 정보 처리 중 오류가 발생했습니다.";

      if (callbackQuery.message) {
        await this.editMessage(
          bot,
          chatId,
          callbackQuery.message.message_id,
          errorText
        );
      } else {
        await this.sendMessage(bot, chatId, errorText);
      }
    }
  }

  /**
   * 날씨 예보 표시
   */
  async showForecast(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "📅 **5일 날씨 예보**\n\n🔜 곧 지원 예정입니다!",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
          ],
        },
      }
    );
  }

  /**
   * 지역 변경
   */
  async changeLocation(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "📍 **지역 변경**\n\n🔜 곧 지원 예정입니다!\n현재는 서울 날씨만 제공됩니다.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
          ],
        },
      }
    );
  }

  /**
   * 의상 추천
   */
  async getClothingAdvice(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const weatherData = await this.weatherService.getCurrentWeather("Seoul");

      if (!weatherData.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ 날씨 정보를 가져올 수 없어 의상 추천이 어렵습니다."
        );
        return;
      }

      const temp = weatherData.data.temp;
      const weather = weatherData.data.main;

      let advice = this.getClothingAdviceText(temp, weather);

      await this.editMessage(bot, chatId, messageId, advice, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
          ],
        },
      });
    } catch (error) {
      logger.error("의상 추천 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 의상 추천 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 도움말 표시
   */
  async showWeatherHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **날씨 모듈 도움말**

**명령어:**
• \`/weather\` 또는 "날씨" - 현재 날씨 확인

**기능:**
🌡️ **현재 날씨** - 실시간 날씨 정보
📅 **예보** - 5일 날씨 예보 (준비 중)
📍 **지역 변경** - 다른 지역 날씨 (준비 중)
👕 **의상 추천** - 날씨별 의상 가이드

**사용법:**
1. /weather 명령어 입력
2. 버튼을 눌러 원하는 정보 선택
3. 실시간으로 업데이트된 정보 확인`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 날씨 이모지 가져오기
   */
  getWeatherEmoji(weatherMain) {
    const main = weatherMain.toLowerCase();
    return this.weatherEmojis[main] || "🌤️";
  }

  /**
   * 의상 추천 텍스트 생성
   */
  getClothingAdviceText(temp, weather) {
    let advice = "👕 **의상 추천**\n\n";

    if (temp >= 28) {
      advice += "🌞 **매우 더움** (28°C 이상)\n";
      advice += "• 민소매, 반팔, 반바지\n";
      advice += "• 린넨 소재 추천\n";
      advice += "• 모자, 선글라스 필수";
    } else if (temp >= 23) {
      advice += "☀️ **더움** (23-27°C)\n";
      advice += "• 반팔, 얇은 셔츠\n";
      advice += "• 면 소재 추천\n";
      advice += "• 가벼운 외투 준비";
    } else if (temp >= 20) {
      advice += "🌤️ **적당함** (20-22°C)\n";
      advice += "• 긴팔, 얇은 니트\n";
      advice += "• 가디건, 얇은 재킷\n";
      advice += "• 편안한 복장";
    } else if (temp >= 15) {
      advice += "🍂 **선선함** (15-19°C)\n";
      advice += "• 얇은 니트, 자켓\n";
      advice += "• 트렌치코트\n";
      advice += "• 레이어드 룩";
    } else if (temp >= 10) {
      advice += "🧥 **쌀쌀함** (10-14°C)\n";
      advice += "• 두꺼운 니트, 코트\n";
      advice += "• 스카프 추천\n";
      advice += "• 따뜻한 외투";
    } else if (temp >= 5) {
      advice += "❄️ **추움** (5-9°C)\n";
      advice += "• 패딩, 두꺼운 코트\n";
      advice += "• 목도리, 장갑\n";
      advice += "• 히트텍 착용";
    } else {
      advice += "🥶 **매우 추움** (5°C 미만)\n";
      advice += "• 두꺼운 패딩, 롱코트\n";
      advice += "• 목도리, 장갑, 모자 필수\n";
      advice += "• 겹겹이 입기";
    }

    // 날씨별 추가 조언
    if (weather.includes("rain")) {
      advice += "\n\n🌧️ **비 예보**\n• 우산 또는 우비 필수\n• 방수 신발 추천";
    } else if (weather.includes("snow")) {
      advice += "\n\n❄️ **눈 예보**\n• 미끄럽지 않은 신발\n• 두꺼운 외투 필수";
    } else if (weather.includes("wind")) {
      advice += "\n\n💨 **바람**\n• 바람막이 추천\n• 모자 고정 필요";
    }

    return advice;
  }

  /**
   * 위치 입력 처리
   */
  async handleLocationInput(bot, chatId, userId, text) {
    this.clearUserState(userId);

    await this.sendMessage(
      bot,
      chatId,
      `📍 "${text}" 지역은 아직 지원되지 않습니다.\n현재는 서울 날씨만 제공됩니다.`
    );

    return true;
  }
}

module.exports = WeatherModule;
