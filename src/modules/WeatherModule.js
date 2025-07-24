// src/modules/WeatherModule.js - 완전 리팩토링된 날씨 모듈
const BaseModule = require("./BaseModule");
const WeatherService = require("../services/WeatherService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 날씨 정보 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - WeatherService를 통한 날씨 API 연동
 * - 화성/동탄 지역 특화 서비스
 * - 표준 매개변수 체계 완벽 준수
 */
class WeatherModule extends BaseModule {
  constructor(bot, options = {}) {
    super("WeatherModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // WeatherService 초기화
    this.weatherService = null;

    // 화성/동탄 특화 설정
    this.dongtan = {
      defaultCity: process.env.DEFAULT_CITY || "화성",
      specialLocations: ["동탄", "화성", "수원", "성남", "용인", "오산"],
      timeZone: "Asia/Seoul",
    };

    // 날씨 이모지 매핑
    this.weatherEmojis = {
      sunny: "☀️",
      partlyCloudy: "🌤️",
      cloudy: "☁️",
      overcast: "🌫️",
      rain: "🌧️",
      shower: "🌦️",
      thunderstorm: "⛈️",
      snow: "🌨️",
      mist: "🌫️",
      fog: "🌫️",
      hot: "🌡️",
      cold: "🥶",
    };

    // 도시 추천 리스트
    this.recommendedCities = [
      { name: "화성", display: "🏡 화성 (기본)", priority: 1 },
      { name: "동탄", display: "🏢 동탄 신도시", priority: 2 },
      { name: "수원", display: "🏰 수원", priority: 3 },
      { name: "서울", display: "🌃 서울", priority: 4 },
      { name: "성남", display: "🌆 성남", priority: 5 },
      { name: "용인", display: "🌿 용인", priority: 6 },
    ];

    logger.info("🌤️ WeatherModule 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      this.weatherService = new WeatherService();
      await this.weatherService.initialize();

      // API 키 상태 확인
      const status = await this.weatherService.checkStatus();
      if (status.status === "error") {
        logger.warn(`⚠️ WeatherService 상태: ${status.message}`);
      }

      logger.info("🌤️ WeatherService 연결 성공");
    } catch (error) {
      logger.error("❌ WeatherService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      current: this.showCurrentWeather,
      forecast: this.showForecast,
      search: this.startCitySearch,

      // 도시별 날씨 (빠른 선택)
      "city:화성": this.showCityWeather,
      "city:동탄": this.showCityWeather,
      "city:수원": this.showCityWeather,
      "city:서울": this.showCityWeather,
      "city:성남": this.showCityWeather,
      "city:용인": this.showCityWeather,

      // 기능별 액션
      refresh: this.refreshWeather,
      help: this.showHelp,
      settings: this.showSettings,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    // 도시 검색 대기 상태
    if (userState?.action === "waiting_city_input") {
      await this.handleCityInput(bot, chatId, userId, text);
      return true;
    }

    // 명령어 처리
    const command = this.extractCommand(text);

    // 날씨 명령어들
    if (command === "weather" || command === "날씨") {
      await this.sendWeatherMenu(bot, chatId);
      return true;
    }

    // 빠른 날씨 조회 (도시명 포함)
    if (command === "weather" && text.split(" ").length > 1) {
      const cityName = text.split(" ").slice(1).join(" ");
      await this.showQuickWeather(bot, chatId, cityName);
      return true;
    }

    // 도시명만으로 날씨 조회
    if (this.isKnownCity(text.trim())) {
      await this.showQuickWeather(bot, chatId, text.trim());
      return true;
    }

    return false;
  }

  // ===== 🌤️ 날씨 정보 액션들 (표준 매개변수 준수) =====

  /**
   * 날씨 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);

    try {
      // 기본 도시(화성) 현재 날씨 미리보기
      const weatherPreview = await this.weatherService.getCurrentWeather(
        this.dongtan.defaultCity
      );

      let previewText = "";
      if (weatherPreview.success) {
        const data = weatherPreview.data;
        previewText = `\n🌡️ **${data.city} 현재**: ${data.icon} ${data.temperature}°C, ${data.description}`;
      }

      const menuText = `🌤️ **${userName}님의 날씨 정보**

📅 ${TimeHelper.formatDateTime()}${previewText}

🏡 **화성/동탄 지역 특화 서비스**
• 화성시 날씨 우선 제공
• 동탄 신도시 맞춤 정보
• 경기 남부 지역 특화

어떤 날씨 정보를 확인하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
            { text: "📅 일기예보", callback_data: "weather:forecast" },
          ],
          [
            { text: "🏡 화성", callback_data: "weather:city:화성" },
            { text: "🏢 동탄", callback_data: "weather:city:동탄" },
          ],
          [
            { text: "🏰 수원", callback_data: "weather:city:수원" },
            { text: "🌃 서울", callback_data: "weather:city:서울" },
          ],
          [
            { text: "🔍 도시 검색", callback_data: "weather:search" },
            { text: "❓ 도움말", callback_data: "weather:help" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("날씨 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 현재 날씨 표시
   */
  async showCurrentWeather(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const cityName = params[0] || this.dongtan.defaultCity;

    try {
      const weatherResult = await this.weatherService.getCurrentWeather(
        cityName
      );

      if (!weatherResult.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **날씨 정보 오류**\n\n${weatherResult.error}\n\n기본 정보로 대체됩니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 다시 시도",
                    callback_data: `weather:current:${cityName}`,
                  },
                ],
                [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
              ],
            },
          }
        );
        return;
      }

      const data = weatherResult.data;
      const cached = weatherResult.cached ? " (캐시됨)" : "";

      const weatherText = `🌤️ **${data.city} 현재 날씨**

${data.icon} **${data.temperature}°C**
📝 **상태**: ${data.description}
💧 **습도**: ${data.humidity}%
💨 **바람**: ${data.windDirection} ${data.windSpeed}m/s

🕐 **업데이트**: ${data.timestamp}${cached}

${this.getWeatherAdvice(data)}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 새로고침",
              callback_data: `weather:refresh:${cityName}`,
            },
            {
              text: "📅 일기예보",
              callback_data: `weather:forecast:${cityName}`,
            },
          ],
          [
            { text: "🏡 화성", callback_data: "weather:city:화성" },
            { text: "🏢 동탄", callback_data: "weather:city:동탄" },
          ],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, weatherText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("현재 날씨 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 일기예보 표시
   */
  async showForecast(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const cityName = params[0] || this.dongtan.defaultCity;

    try {
      const forecastResult = await this.weatherService.getForecast(cityName);

      if (!forecastResult.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **일기예보 오류**\n\n${forecastResult.error}\n\n기본 예보로 대체됩니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 다시 시도",
                    callback_data: `weather:forecast:${cityName}`,
                  },
                ],
                [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
              ],
            },
          }
        );
        return;
      }

      const data = forecastResult.data;
      const cached = forecastResult.cached ? " (캐시됨)" : "";

      let forecastText = `📅 **${data.city} 5일 예보**\n\n`;

      data.forecast.forEach((day, index) => {
        const dayName =
          index === 0
            ? "오늘"
            : index === 1
            ? "내일"
            : index === 2
            ? "모레"
            : day.date;

        forecastText += `**${dayName}**: ${day.icon} ${day.temp} - ${day.desc}\n`;
      });

      forecastText += `\n🕐 **업데이트**: ${data.timestamp}${cached}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 새로고침",
              callback_data: `weather:forecast:${cityName}`,
            },
            {
              text: "🌡️ 현재 날씨",
              callback_data: `weather:current:${cityName}`,
            },
          ],
          [
            { text: "🏡 화성", callback_data: "weather:city:화성" },
            { text: "🏢 동탄", callback_data: "weather:city:동탄" },
          ],
          [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, forecastText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("일기예보 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 도시별 날씨 표시
   */
  async showCityWeather(bot, callbackQuery, params, moduleManager) {
    // params[0]에서 도시명 추출 또는 콜백 데이터에서 파싱
    const cityName = params[0] || callbackQuery.data.split(":")[2];

    if (!cityName) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 도시명을 찾을 수 없습니다.",
        show_alert: true,
      });
      return;
    }

    // 현재 날씨를 해당 도시로 표시
    await this.showCurrentWeather(
      bot,
      callbackQuery,
      [cityName],
      moduleManager
    );
  }

  /**
   * 도시 검색 시작
   */
  async startCitySearch(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, { action: "waiting_city_input" });

    const searchText = `🔍 **도시 검색**

날씨를 확인할 도시명을 입력해주세요.

💡 **지원 도시:**
• 전국 주요 도시 (한글/영문)
• 해외 주요 도시 (영문)

📝 **입력 예시:**
• 한국: 화성, 동탄, 수원, 서울, 부산, 대구...
• 해외: New York, Tokyo, London...

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏡 화성", callback_data: "weather:city:화성" },
          { text: "🏢 동탄", callback_data: "weather:city:동탄" },
        ],
        [
          { text: "🏰 수원", callback_data: "weather:city:수원" },
          { text: "🌃 서울", callback_data: "weather:city:서울" },
        ],
        [{ text: "❌ 취소", callback_data: "weather:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, searchText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 새로고침
   */
  async refreshWeather(bot, callbackQuery, params, moduleManager) {
    const cityName = params[0] || this.dongtan.defaultCity;

    // 캐시 무효화
    this.weatherService.clearCache();

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🔄 날씨 정보를 새로고침합니다...",
      show_alert: false,
    });

    // 현재 날씨 다시 표시
    await this.showCurrentWeather(
      bot,
      callbackQuery,
      [cityName],
      moduleManager
    );
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `🌤️ **날씨 모듈 사용법**

📅 ${TimeHelper.formatDateTime()}

🌡️ **현재 날씨**
• 실시간 온도, 습도, 바람 정보
• 10분마다 캐시 업데이트
• 날씨 상태별 조언 제공

📅 **일기예보**
• 5일간 날씨 예보
• 간단한 날씨 상태 요약
• 계획 수립에 도움

🏡 **화성/동탄 특화**
• 화성시를 기본 도시로 설정
• 동탄 신도시 날씨 우선 제공
• 경기 남부 지역 특화 서비스

🔍 **도시 검색**
• 전국 주요 도시 지원
• 해외 주요 도시 지원 (영문)
• 한글/영문 도시명 모두 인식

⚡ **빠른 명령어**
• /weather 또는 "날씨" - 날씨 메뉴
• 도시명 직접 입력 - 해당 도시 날씨
• "화성", "동탄", "수원" 등

🔄 **자동 업데이트**
• 10분마다 캐시 갱신
• 실시간 정보 제공
• Railway 서버에서 24/7 운영`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "📅 일기예보", callback_data: "weather:forecast" },
        ],
        [
          { text: "🔙 날씨 메뉴", callback_data: "weather:menu" },
          { text: "🏠 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎯 입력 처리 메서드들 =====

  /**
   * 도시 입력 처리
   */
  async handleCityInput(bot, chatId, userId, text) {
    // 상태 초기화
    this.clearUserState(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(bot, chatId, "✅ 도시 검색이 취소되었습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
          ],
        },
      });
      return;
    }

    try {
      const cityName = text.trim();

      // 입력 검증
      if (!cityName || cityName.length < 2) {
        await this.sendError(bot, chatId, "도시명을 올바르게 입력해주세요.");
        return;
      }

      // 날씨 정보 조회
      const weatherResult = await this.weatherService.getCurrentWeather(
        cityName
      );

      if (!weatherResult.success) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ **"${cityName}" 날씨 정보를 찾을 수 없습니다**\n\n${weatherResult.error}\n\n다른 도시명으로 다시 시도해보세요.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔍 다시 검색", callback_data: "weather:search" }],
                [{ text: "🔙 날씨 메뉴", callback_data: "weather:menu" }],
              ],
            },
          }
        );
        return;
      }

      const data = weatherResult.data;

      const weatherText = `🌤️ **${data.city} 날씨 검색 결과**

${data.icon} **${data.temperature}°C**
📝 **상태**: ${data.description}
💧 **습도**: ${data.humidity}%
💨 **바람**: ${data.windDirection} ${data.windSpeed}m/s

🕐 **검색 시간**: ${data.timestamp}

${this.getWeatherAdvice(data)}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 새로고침",
              callback_data: `weather:refresh:${cityName}`,
            },
            {
              text: "📅 일기예보",
              callback_data: `weather:forecast:${cityName}`,
            },
          ],
          [
            { text: "🔍 다른 도시", callback_data: "weather:search" },
            { text: "🔙 날씨 메뉴", callback_data: "weather:menu" },
          ],
        ],
      };

      await this.sendMessage(bot, chatId, weatherText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("도시 입력 처리 오류:", error);
      await this.sendError(bot, chatId, "도시 검색 중 오류가 발생했습니다.");
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 빠른 날씨 조회 (명령어용)
   */
  async showQuickWeather(bot, chatId, cityName) {
    try {
      const weatherResult = await this.weatherService.getCurrentWeather(
        cityName
      );

      if (!weatherResult.success) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ **"${cityName}" 날씨 정보를 찾을 수 없습니다**\n\n${weatherResult.error}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔍 도시 검색", callback_data: "weather:search" }],
                [{ text: "🌤️ 날씨 메뉴", callback_data: "weather:menu" }],
              ],
            },
          }
        );
        return;
      }

      const data = weatherResult.data;

      const quickText = `🌤️ **${data.city} 날씨**

${data.icon} **${data.temperature}°C** - ${data.description}
💧 습도 ${data.humidity}% | 💨 ${data.windDirection} ${data.windSpeed}m/s

🕐 ${data.timestamp}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "📅 일기예보",
              callback_data: `weather:forecast:${cityName}`,
            },
            {
              text: "🔄 새로고침",
              callback_data: `weather:refresh:${cityName}`,
            },
          ],
          [{ text: "🌤️ 날씨 메뉴", callback_data: "weather:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, quickText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("빠른 날씨 조회 오류:", error);
      await this.sendError(bot, chatId, "날씨 조회 중 오류가 발생했습니다.");
    }
  }

  /**
   * 날씨 메뉴 전송 (명령어용)
   */
  async sendWeatherMenu(bot, chatId) {
    try {
      // 기본 도시 날씨 미리보기
      const weatherPreview = await this.weatherService.getCurrentWeather(
        this.dongtan.defaultCity
      );

      let previewText = "";
      if (weatherPreview.success) {
        const data = weatherPreview.data;
        previewText = `\n🌡️ **${data.city} 현재**: ${data.icon} ${data.temperature}°C, ${data.description}`;
      }

      const text = `🌤️ **날씨 정보**

📅 ${TimeHelper.formatDateTime()}${previewText}

🏡 **화성/동탄 지역 특화 서비스**
• 실시간 날씨 정보
• 5일 일기예보
• 전국 도시 검색 지원

어떤 날씨 정보를 확인하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
            { text: "📅 일기예보", callback_data: "weather:forecast" },
          ],
          [
            { text: "🏡 화성", callback_data: "weather:city:화성" },
            { text: "🏢 동탄", callback_data: "weather:city:동탄" },
          ],
          [
            { text: "🔍 도시 검색", callback_data: "weather:search" },
            { text: "❓ 도움말", callback_data: "weather:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("날씨 메뉴 전송 오류:", error);
      await this.sendError(bot, chatId, "메뉴 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * 알려진 도시인지 확인
   */
  isKnownCity(text) {
    const knownCities = [
      "화성",
      "동탄",
      "수원",
      "서울",
      "부산",
      "대구",
      "인천",
      "광주",
      "대전",
      "울산",
      "제주",
      "성남",
      "용인",
      "고양",
      "안산",
      "안양",
      "남양주",
      "의정부",
    ];

    return (
      knownCities.includes(text) || this.dongtan.specialLocations.includes(text)
    );
  }

  /**
   * 날씨별 조언 생성
   */
  getWeatherAdvice(weatherData) {
    const temp = weatherData.temperature;
    const desc = weatherData.description.toLowerCase();

    // 온도별 조언
    if (temp >= 30) {
      return "🔥 **매우 더워요!** 충분한 수분 섭취와 시원한 곳에서 휴식하세요.";
    } else if (temp >= 25) {
      return "☀️ **따뜻한 날씨예요!** 가벼운 옷차림이 좋겠어요.";
    } else if (temp >= 20) {
      return "🌤️ **쾌적한 날씨예요!** 외출하기 좋은 날씨네요.";
    } else if (temp >= 10) {
      return "🧥 **조금 쌀쌀해요.** 얇은 겉옷을 준비하세요.";
    } else if (temp >= 0) {
      return "🧣 **추워요!** 따뜻하게 입고 나가세요.";
    } else {
      return "🥶 **매우 추워요!** 보온에 각별히 신경 쓰세요.";
    }
  }

  /**
   * 에러 처리
   */
  async handleError(bot, callbackQuery, error) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **오류 발생**\n\n날씨 정보 처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "weather:menu" }],
              [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        }
      );
    } catch (editError) {
      logger.error("에러 메시지 표시 실패:", editError);
    }
  }
}

module.exports = WeatherModule;
