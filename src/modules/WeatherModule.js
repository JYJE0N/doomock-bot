// src/modules/WeatherModule.js - GPS 기반 날씨 모듈 완전판

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherModule - GPS 기반 날씨 + 미세먼지 통합 모듈
 */
class WeatherModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.weatherService = null;

    // 사용자 상태 캐시
    this.userSearchStates = new Map();
    this.searchResultsCache = new Map();

    this.config = {
      defaultLocation: process.env.DEFAULT_LOCATION || "수원시", // 기본 도시 수원시로 변경
      defaultRegion: process.env.DEFAULT_REGION || "경기도",
      enableDust: true,
      enableWeather: true,
      enableGPS: true,
      ...options.config,
    };

    logger.info("🌤️ WeatherModule 생성됨", {
      config: this.config,
    });
  }

  /**
   * ✅ 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🌤️ WeatherModule 초기화 시작...");

      if (!this.serviceBuilder) {
        throw new Error("ServiceBuilder가 필요합니다");
      }

      // WeatherService 연결
      this.weatherService = await this.serviceBuilder.getOrCreate("weather", {
        config: this.config,
      });

      if (!this.weatherService) {
        throw new Error("WeatherService를 찾을 수 없습니다");
      }

      // 액션 등록
      this.setupActions();

      logger.success("✅ WeatherModule 초기화 완료");
    } catch (error) {
      logger.error("❌ WeatherModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 메인 액션
      menu: this.showWeatherMenu,
      current: this.showCurrent,
      dust: this.showDust,
      complete: this.showCompleteInfo,

      // 위치 관련 액션
      location_menu: this.showLocationMenu,
      major_cities: this.showMajorCities,
      metro_cities: this.showMetroCities,
      gyeonggi_cities: this.showGyeonggiCities,
      set_location: this.setLocation,
      remove_location: this.removeLocation,
      search_location: this.showSearchLocation,
      select_search: this.selectSearchResult,

      // 기타 액션
      help: this.showHelp,
      status: this.showStatus,
    });
  }

  /**
   * 📋 날씨 메뉴 표시
   */
  async showWeatherMenu(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("🌤️ 날씨 메뉴 표시");

    return {
      type: "menu",
      module: "weather",
      data: {
        title: "날씨 정보 메뉴",
        description: "GPS 기반으로 현재 위치의 날씨 정보를 제공합니다.",
        features: {
          weather: this.config.enableWeather,
          dust: this.config.enableDust,
          gps: this.config.enableGPS,
        },
      },
    };
  }

  /**
   * 📋 날씨 메뉴 직접 표시 (메시지용)
   */
  async showWeatherMenuDirect(bot, chatId) {
    const menuText =
      `🌤️ *날씨 정보 메뉴*\n\n` +
      `GPS 기반으로 현재 위치의 날씨 정보를 제공합니다\\.\n\n` +
      `무엇을 확인하시겠습니까?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌡️ 현재 날씨", callback_data: "weather:current" },
          { text: "🌬️ 미세먼지", callback_data: "weather:dust" },
        ],
        [{ text: "🌍 통합 정보", callback_data: "weather:complete" }],
        [
          { text: "📍 위치 설정", callback_data: "weather:location_menu" },
          { text: "❓ 도움말", callback_data: "weather:help" },
        ],
        [{ text: "◀️ 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    await bot.sendMessage(chatId, menuText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 🌡️ 현재 날씨 표시 (GPS 기반)
   */
  async showCurrent(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`🌡️ 현재 날씨 요청 (사용자: ${userName})`);

      // GPS 기반 날씨 조회
      const weatherResult = await this.weatherService.getCurrentWeather(
        null,
        userId
      );

      if (weatherResult.success) {
        const weatherData = weatherResult.data;

        logger.success(
          `✅ 날씨 표시: ${
            weatherResult.fullAddress || weatherResult.location
          } - ${weatherData.temperature}°C`
        );

        return {
          type: "current",
          module: "weather",
          data: {
            weather: weatherData,
            location: weatherResult.location,
            fullAddress: weatherResult.fullAddress,
            timestamp: weatherResult.timestamp,
            source: weatherResult.source,
            warning: weatherResult.warning || null,
            locationInfo: weatherData.locationInfo,
            isGPSDetected: weatherData.autoDetectedLocation,
          },
        };
      } else {
        throw new Error(
          weatherResult.error || "날씨 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      logger.error("현재 날씨 조회 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: {
          message: "현재 날씨 정보를 불러올 수 없습니다: " + error.message,
          canRetry: true,
          suggestions: [
            "잠시 후 다시 시도해보세요",
            "위치 서비스를 확인해보세요",
            "API 키 설정을 확인해보세요",
          ],
        },
      };
    }
  }

  /**
   * 🌬️ 미세먼지 정보 표시 (GPS 기반)
   */
  async showDust(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`🌬️ 미세먼지 정보 요청 (사용자: ${userName})`);

      // GPS 기반 미세먼지 조회
      const dustResult = await this.weatherService.getDustInfo(null, userId);

      if (dustResult.success) {
        logger.success(
          `✅ 미세먼지 정보 조회 성공: ${
            dustResult.fullAddress || dustResult.location
          } (${dustResult.source})`
        );

        return {
          type: "dust",
          module: "weather",
          data: {
            dust: dustResult.data,
            location: dustResult.location,
            fullAddress: dustResult.fullAddress,
            timestamp: dustResult.timestamp,
            source: dustResult.source,
            warning: dustResult.warning || null,
            locationInfo: dustResult.data.locationInfo,
            isGPSDetected: dustResult.data.autoDetectedLocation,
          },
        };
      } else {
        throw new Error(
          dustResult.error || "미세먼지 정보를 가져올 수 없습니다"
        );
      }
    } catch (error) {
      logger.error("미세먼지 정보 조회 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: {
          message: "미세먼지 정보를 불러올 수 없습니다: " + error.message,
          canRetry: true,
          suggestions: [
            "잠시 후 다시 시도해보세요",
            "위치 서비스를 확인해보세요",
            "API 키 설정을 확인해보세요",
          ],
        },
      };
    }
  }

  /**
   * 🌍 통합 정보 표시 (날씨 + 미세먼지)
   */
  async showCompleteInfo(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`🌍 통합 날씨 정보 요청 (사용자: ${userName})`);

      const completeInfo = await this.weatherService.getCompleteWeatherInfo(
        null,
        userId
      );

      if (completeInfo.success) {
        logger.success(
          `✅ 통합 정보 조회 성공: ${
            completeInfo.fullAddress || completeInfo.location
          }`
        );

        return {
          type: "complete",
          module: "weather",
          data: {
            weather: completeInfo.weather,
            dust: completeInfo.dust,
            location: completeInfo.location,
            fullAddress: completeInfo.fullAddress,
            timestamp: completeInfo.timestamp,
            source: completeInfo.source,
            locationInfo: completeInfo.locationInfo,
            isGPSDetected: completeInfo.autoDetectedLocation,
          },
        };
      } else {
        throw new Error(completeInfo.error || "통합 정보를 가져올 수 없습니다");
      }
    } catch (error) {
      logger.error("통합 정보 조회 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: {
          message: "통합 날씨 정보를 불러올 수 없습니다: " + error.message,
          canRetry: true,
        },
      };
    }
  }

  /**
   * 📍 위치 설정 메뉴 (GPS 버튼 포함)
   */
  async showLocationMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const username = getUserName(callbackQuery.from);

    try {
      // 현재 저장된 위치 확인
      const userLocation = await this.weatherService.getUserSavedLocation(
        userId
      );

      let currentLocation = "설정되지 않음";
      if (userLocation) {
        currentLocation = userLocation.location.fullAddress;
      }

      const menuText =
        `📍 *위치 설정*\n\n` +
        `현재 위치: *${this.escapeMarkdown(currentLocation)}*\n\n` +
        `아래 방법 중 하나를 선택해주세요:`;

      // GPS 위치 공유 버튼 (request_location 사용)
      const keyboard = {
        inline_keyboard: [
          [
            { text: "📍 위치 검색", callback_data: "weather:search_location" },
            { text: "🎯 주요 도시", callback_data: "weather:major_cities" },
          ],
          [
            {
              text: "🗺️ 경기도 도시",
              callback_data: "weather:gyeonggi_cities",
            },
            { text: "🏙️ 광역시", callback_data: "weather:metro_cities" },
          ],
          userLocation
            ? [
                {
                  text: "❌ 위치 삭제",
                  callback_data: "weather:remove_location",
                },
              ]
            : [],
          [{ text: "◀️ 뒤로", callback_data: "weather:menu" }],
        ].filter((row) => row.length > 0),
      };

      await bot.editMessageText(menuText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // GPS 위치 공유 요청 메시지 (별도 메시지로 전송)
      await this.sendGPSRequestMessage(bot, callbackQuery.message.chat.id);

      logger.info(`📍 위치 설정 메뉴 표시 (사용자: ${username})`);
    } catch (error) {
      logger.error("위치 설정 메뉴 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "위치 설정 메뉴를 불러올 수 없습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 🛰️ GPS 위치 공유 요청 메시지
   */
  async sendGPSRequestMessage(bot, chatId) {
    const gpsText =
      `🛰️ *GPS로 현재 위치 공유하기*\n\n` +
      `아래 버튼을 눌러 현재 위치를 공유해주세요\\.\n` +
      `더 정확한 날씨 정보를 제공받을 수 있습니다\\!`;

    // request_location을 사용한 키보드
    const gpsKeyboard = {
      reply_markup: {
        keyboard: [
          [
            {
              text: "📍 현재 위치 공유하기",
              request_location: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    };

    await bot.sendMessage(chatId, gpsText, {
      parse_mode: "MarkdownV2",
      ...gpsKeyboard,
    });
  }

  /**
   * 🏙️ 주요 도시 목록
   */
  async showMajorCities(bot, callbackQuery, subAction, params, moduleManager) {
    const cities = [
      { name: "서울", data: "weather:set_location:서울" },
      { name: "수원시", data: "weather:set_location:수원시" },
      { name: "용인시", data: "weather:set_location:용인시" },
      { name: "성남시", data: "weather:set_location:성남시" },
      { name: "부천시", data: "weather:set_location:부천시" },
      { name: "안양시", data: "weather:set_location:안양시" },
      { name: "화성시", data: "weather:set_location:화성시" },
      { name: "평택시", data: "weather:set_location:평택시" },
      { name: "안산시", data: "weather:set_location:안산시" },
    ];

    const keyboard = {
      inline_keyboard: [
        ...cities
          .map((city, index) => {
            if (index % 3 === 0) {
              return cities.slice(index, index + 3).map((c) => ({
                text: c.name,
                callback_data: c.data,
              }));
            }
            return null;
          })
          .filter((row) => row !== null),
        [{ text: "◀️ 뒤로", callback_data: "weather:location_menu" }],
      ],
    };

    await bot.editMessageText(
      "🏙️ *주요 도시 선택*\n\n원하시는 도시를 선택해주세요:",
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  }

  /**
   * 🏙️ 광역시 목록
   */
  async showMetroCities(bot, callbackQuery, subAction, params, moduleManager) {
    const cities = [
      { name: "서울", data: "weather:set_location:서울" },
      { name: "부산", data: "weather:set_location:부산" },
      { name: "대구", data: "weather:set_location:대구" },
      { name: "인천", data: "weather:set_location:인천" },
      { name: "광주", data: "weather:set_location:광주" },
      { name: "대전", data: "weather:set_location:대전" },
      { name: "울산", data: "weather:set_location:울산" },
      { name: "세종", data: "weather:set_location:세종" },
    ];

    const keyboard = {
      inline_keyboard: [
        ...cities
          .map((city, index) => {
            if (index % 3 === 0) {
              return cities.slice(index, index + 3).map((c) => ({
                text: c.name,
                callback_data: c.data,
              }));
            }
            return null;
          })
          .filter((row) => row !== null),
        [{ text: "◀️ 뒤로", callback_data: "weather:location_menu" }],
      ],
    };

    await bot.editMessageText(
      "🏙️ *광역시 선택*\n\n원하시는 광역시를 선택해주세요:",
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  }

  /**
   * 🗺️ 경기도 도시 목록
   */
  async showGyeonggiCities(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const cities = [
      { name: "수원시", data: "weather:set_location:수원시" },
      { name: "용인시", data: "weather:set_location:용인시" },
      { name: "성남시", data: "weather:set_location:성남시" },
      { name: "화성시", data: "weather:set_location:화성시" },
      { name: "안양시", data: "weather:set_location:안양시" },
      { name: "안산시", data: "weather:set_location:안산시" },
      { name: "부천시", data: "weather:set_location:부천시" },
      { name: "평택시", data: "weather:set_location:평택시" },
      { name: "의정부시", data: "weather:set_location:의정부시" },
      { name: "고양시", data: "weather:set_location:고양시" },
      { name: "남양주시", data: "weather:set_location:남양주시" },
      { name: "파주시", data: "weather:set_location:파주시" },
    ];

    const keyboard = {
      inline_keyboard: [
        ...cities
          .map((city, index) => {
            if (index % 3 === 0) {
              return cities.slice(index, index + 3).map((c) => ({
                text: c.name,
                callback_data: c.data,
              }));
            }
            return null;
          })
          .filter((row) => row !== null),
        [{ text: "◀️ 뒤로", callback_data: "weather:location_menu" }],
      ],
    };

    await bot.editMessageText(
      "🗺️ *경기도 도시 선택*\n\n원하시는 도시를 선택해주세요:",
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  }

  /**
   * 📍 위치 설정
   */
  async setLocation(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const username = getUserName(callbackQuery.from);
    const city = params[0]; // set_location:용인시 에서 "용인시" 추출

    try {
      // LocationHelper를 통해 위치 정보 파싱
      const locationHelper = this.weatherService.locationHelper;
      const locationData = locationHelper.parseUserLocation(city);

      // DB에 저장
      await this.weatherService.saveUserLocation(
        userId,
        username,
        locationData
      );

      // 캐시 업데이트
      locationHelper.setCache(userId, locationData);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ 위치가 ${city}로 설정되었습니다!`,
        show_alert: true,
      });

      // 날씨 메뉴로 돌아가기
      await this.showWeatherMenu(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      logger.info(`📍 위치 설정 완료: ${username} → ${city}`);
    } catch (error) {
      logger.error("위치 설정 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "위치 설정 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * ❌ 위치 삭제
   */
  async removeLocation(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const username = getUserName(callbackQuery.from);

    try {
      await this.weatherService.removeUserLocation(userId);

      // 캐시도 삭제
      this.weatherService.locationHelper.clearCache(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ 저장된 위치가 삭제되었습니다.",
        show_alert: true,
      });

      await this.showLocationMenu(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      logger.info(`❌ 위치 삭제 완료: ${username}`);
    } catch (error) {
      logger.error("위치 삭제 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "위치 삭제 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 🔍 위치 검색 기능
   */
  async showSearchLocation(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);

    // 위치 검색 대기 상태 설정
    this.setUserSearchState(userId, true);

    await bot.editMessageText(
      "🔍 *위치 검색*\n\n" +
        "검색할 위치를 입력해주세요\\.\n" +
        "예시: 용인시, 수원역, 강남구 등",
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ 취소", callback_data: "weather:location_menu" }],
          ],
        },
      }
    );
  }

  /**
   * 🔍 검색 결과 선택 처리
   */
  async selectSearchResult(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    const userId = getUserId(callbackQuery.from);
    const username = getUserName(callbackQuery.from);
    const selectedIndex = parseInt(params[0]);

    try {
      const searchResults = this.getSearchResults(userId);
      if (!searchResults || selectedIndex >= searchResults.length) {
        throw new Error("검색 결과를 찾을 수 없습니다.");
      }

      const selected = searchResults[selectedIndex];

      // 위치 정보 생성
      const locationData = {
        city: selected.city,
        district: "",
        fullAddress: selected.address,
        region: this.weatherService.locationHelper.getRegionByCity(
          selected.city
        ),
        lat: selected.lat,
        lon: selected.lon,
        method: "search",
      };

      // DB에 저장
      await this.weatherService.saveUserLocation(
        userId,
        username,
        locationData
      );

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ ${selected.city}로 위치가 설정되었습니다!`,
        show_alert: true,
      });

      // 날씨 메뉴로 돌아가기
      await this.showWeatherMenu(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      // 검색 결과 삭제
      this.clearSearchResults(userId);

      logger.info(`📍 검색 위치 설정: ${username} → ${selected.city}`);
    } catch (error) {
      logger.error("검색 결과 선택 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "위치 설정 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("❓ 날씨 도움말 표시");

    return {
      type: "help",
      module: "weather",
      data: {
        commands: [
          {
            command: "🌡️ 현재 날씨",
            description: "현재 위치의 날씨 정보를 확인합니다",
          },
          {
            command: "🌬️ 미세먼지",
            description: "미세먼지 및 대기질 정보를 확인합니다",
          },
          {
            command: "🌍 통합 정보",
            description: "날씨와 미세먼지 정보를 함께 확인합니다",
          },
          {
            command: "📍 위치 설정",
            description: "GPS 공유 또는 직접 위치를 설정합니다",
          },
        ],
        tips: [
          "GPS 위치 공유로 더 정확한 날씨 정보를 받을 수 있습니다",
          "위치를 한 번 설정하면 계속 사용됩니다",
          "Railway 환경에서는 기본 위치가 설정되어 있습니다",
        ],
      },
    };
  }

  /**
   * 📊 상태 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const status = await this.weatherService.getStatus();

    logger.info("📊 날씨 모듈 상태 표시");

    return {
      type: "status",
      module: "weather",
      data: status,
    };
  }

  /**
   * 📍 메시지 처리 (GPS 위치 수신 포함)
   */
  async onHandleMessage(bot, msg) {
    // GPS 위치 메시지 처리
    if (msg.location) {
      return await this.handleLocationMessage(bot, msg);
    }

    // 일반 텍스트 메시지 처리
    if (msg.text) {
      const text = msg.text.toLowerCase();

      // 위치 검색 처리
      if (this.isWaitingForLocationSearch(msg.from.id)) {
        return await this.handleLocationSearch(bot, msg);
      }

      // 날씨 관련 키워드
      const weatherKeywords = ["날씨", "weather", "미세먼지", "대기질"];
      if (weatherKeywords.some((keyword) => text.includes(keyword))) {
        await this.showWeatherMenuDirect(bot, msg.chat.id);
        return true;
      }
    }

    return false;
  }

  /**
   * 🛰️ GPS 위치 메시지 처리
   */
  async handleLocationMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const username = getUserName(msg);
    const location = msg.location;

    try {
      logger.info(
        `🛰️ GPS 위치 수신: ${username} (${location.latitude}, ${location.longitude})`
      );

      // 로딩 메시지
      const loadingMsg = await bot.sendMessage(
        msg.chat.id,
        "🔄 위치 정보를 처리하고 있습니다..."
      );

      // LocationHelper를 통해 주소 변환
      const locationHelper = this.weatherService.locationHelper;
      const locationData = await locationHelper.getAddressFromGPS(
        location.latitude,
        location.longitude
      );

      // DB에 저장
      await this.weatherService.saveUserLocation(userId, username, {
        ...locationData,
        lat: location.latitude,
        lon: location.longitude,
        method: "gps",
      });

      // 로딩 메시지 삭제
      await bot.deleteMessage(msg.chat.id, loadingMsg.message_id);

      // 일반 키보드로 복원
      await bot.sendMessage(
        msg.chat.id,
        `✅ 위치가 설정되었습니다!\n\n` +
          `📍 설정된 위치: *${locationData.city} ${
            locationData.district || ""
          }*\n` +
          `🗺️ 주소: ${locationData.fullAddress}\n\n` +
          `이제 이 위치를 기준으로 날씨 정보를 제공해드립니다.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            remove_keyboard: true,
          },
        }
      );

      // 날씨 메뉴 표시
      await this.showWeatherMenuDirect(bot, msg.chat.id);

      logger.info(`✅ GPS 위치 설정 완료: ${username} → ${locationData.city}`);
      return true;
    } catch (error) {
      logger.error("GPS 위치 처리 오류:", error);

      await bot.sendMessage(
        msg.chat.id,
        "❌ 위치 처리 중 오류가 발생했습니다.\n다시 시도해주세요.",
        {
          reply_markup: {
            remove_keyboard: true,
          },
        }
      );

      return true;
    }
  }

  /**
   * 🔍 위치 검색 처리
   */
  async handleLocationSearch(bot, msg) {
    const userId = getUserId(msg.from);
    const username = getUserName(msg);
    const searchQuery = msg.text.trim();

    try {
      // 로딩 메시지
      const loadingMsg = await bot.sendMessage(
        msg.chat.id,
        `🔍 "${searchQuery}" 검색 중...`
      );

      // 카카오 API로 검색
      const locationHelper = this.weatherService.locationHelper;
      const searchResults = await locationHelper.searchLocation(searchQuery);

      await bot.deleteMessage(msg.chat.id, loadingMsg.message_id);

      if (!searchResults || searchResults.length === 0) {
        await bot.sendMessage(
          msg.chat.id,
          `❌ "${searchQuery}"에 대한 검색 결과가 없습니다.\n다시 시도해주세요.`
        );
        return true;
      }

      // 검색 결과 표시
      let resultText = `🔍 *검색 결과*\n\n`;
      const keyboard = {
        inline_keyboard: [],
      };

      searchResults.slice(0, 5).forEach((result, index) => {
        resultText += `${index + 1}\\. ${this.escapeMarkdown(result.name)}\n`;
        resultText += `   📍 ${this.escapeMarkdown(result.address)}\n\n`;

        keyboard.inline_keyboard.push([
          {
            text: `${index + 1}. ${result.city}`,
            callback_data: `weather:select_search:${index}`,
          },
        ]);
      });

      keyboard.inline_keyboard.push([
        { text: "❌ 취소", callback_data: "weather:location_menu" },
      ]);

      // 검색 결과 임시 저장
      this.storeSearchResults(userId, searchResults);

      await bot.sendMessage(msg.chat.id, resultText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });

      // 검색 상태 해제
      this.setUserSearchState(userId, false);

      return true;
    } catch (error) {
      logger.error("위치 검색 오류:", error);

      await bot.sendMessage(
        msg.chat.id,
        "❌ 위치 검색 중 오류가 발생했습니다."
      );

      this.setUserSearchState(userId, false);
      return true;
    }
  }

  // ===== 📊 사용자 상태 관리 메서드들 =====

  setUserSearchState(userId, isSearching) {
    if (isSearching) {
      this.userSearchStates.set(userId, {
        searching: true,
        timestamp: Date.now(),
      });
    } else {
      this.userSearchStates.delete(userId);
    }
  }

  isWaitingForLocationSearch(userId) {
    const state = this.userSearchStates.get(userId);
    if (!state) return false;

    // 5분 이상 지난 상태는 자동 삭제
    if (Date.now() - state.timestamp > 5 * 60 * 1000) {
      this.userSearchStates.delete(userId);
      return false;
    }

    return state.searching;
  }

  storeSearchResults(userId, results) {
    this.searchResultsCache.set(userId, {
      results,
      timestamp: Date.now(),
    });
  }

  getSearchResults(userId) {
    const cached = this.searchResultsCache.get(userId);
    if (!cached) return null;

    // 10분 이상 지난 결과는 삭제
    if (Date.now() - cached.timestamp > 10 * 60 * 1000) {
      this.searchResultsCache.delete(userId);
      return null;
    }

    return cached.results;
  }

  clearSearchResults(userId) {
    this.searchResultsCache.delete(userId);
  }

  // ===== 🛠️ 유틸리티 메서드 =====

  escapeMarkdown(text) {
    if (!text) return "";
    return text.replace(/[_*\[\]()~`>#\+\-=|{}.!]/g, "\\$&");
  }
}

module.exports = WeatherModule;
