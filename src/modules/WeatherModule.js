// src/modules/WeatherModule.js - GPS 기반 날씨 모듈 개선

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

    this.config = {
      defaultLocation: "화성시",
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
      menu: this.showWeatherMenu,
      current: this.showCurrent,
      dust: this.showDust,
      complete: this.showCompleteInfo,
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
          data: completeInfo,
        };
      } else {
        throw new Error(completeInfo.error || "통합 정보를 가져올 수 없습니다");
      }
    } catch (error) {
      logger.error("통합 날씨 정보 조회 실패:", error);
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
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "weather",
      data: {
        title: "🌤️ 날씨 모듈 도움말",
        features: [
          "🌡️ GPS 기반 현재 날씨",
          "🌬️ 실시간 미세먼지 정보",
          "🌍 통합 대시보드",
          "📍 자동 위치 감지",
        ],
        commands: ["/weather - 날씨 메뉴 열기", "버튼 클릭으로 정보 조회"],
        tips: [
          "GPS로 현재 위치를 자동 감지합니다",
          "정보는 10분마다 자동 갱신됩니다",
          "API 오류 시 추정 데이터를 표시합니다",
          "미세먼지 정보는 가장 가까운 측정소 데이터를 사용합니다",
        ],
      },
    };
  }

  /**
   * 📊 서비스 상태 표시
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const serviceStatus = await this.weatherService.getServiceStatus();

      return {
        type: "status",
        module: "weather",
        data: serviceStatus,
      };
    } catch (error) {
      logger.error("서비스 상태 조회 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: { message: "서비스 상태를 확인할 수 없습니다: " + error.message },
      };
    }
  }

  /**
   * 💬 메시지 핸들러
   */
  async onHandleMessage(bot, msg) {
    const text = msg.text?.toLowerCase() || "";
    const chatId = msg.chat.id;
    const userId = getUserId(msg.from);

    // 날씨 관련 키워드 감지
    if (text.includes("날씨") || text.includes("weather")) {
      logger.info(`💬 날씨 키워드 감지: "${text}"`);

      // 미세먼지 키워드 확인
      if (
        text.includes("미세먼지") ||
        text.includes("dust") ||
        text.includes("pm")
      ) {
        const dustResult = await this.weatherService.getDustInfo(null, userId);

        if (dustResult.success) {
          await bot.sendMessage(
            chatId,
            `🌬️ 현재 미세먼지 정보 (${
              dustResult.fullAddress || dustResult.location
            })\n\n` +
              `PM2.5: ${dustResult.data.pm25?.value || "-"}㎍/㎥ (${
                dustResult.data.pm25?.grade || "-"
              })\n` +
              `PM10: ${dustResult.data.pm10?.value || "-"}㎍/㎥ (${
                dustResult.data.pm10?.grade || "-"
              })\n` +
              `종합: ${dustResult.data.overall?.grade || "-"}\n\n` +
              `💡 ${dustResult.data.advice || ""}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 새로고침", callback_data: "weather:dust" }],
                  [{ text: "📋 날씨 메뉴", callback_data: "weather:menu" }],
                ],
              },
            }
          );
        }
      } else {
        // 일반 날씨 정보
        const weatherResult = await this.weatherService.getCurrentWeather(
          null,
          userId
        );

        if (weatherResult.success) {
          const weather = weatherResult.data;
          await bot.sendMessage(
            chatId,
            `🌤️ 현재 날씨 (${
              weatherResult.fullAddress || weatherResult.location
            })\n\n` +
              `${weather.description}\n` +
              `🌡️ 온도: ${weather.temperature}°C (체감 ${
                weather.feelsLike || weather.temperature
              }°C)\n` +
              `💧 습도: ${weather.humidity}%\n` +
              `🌬️ 풍속: ${weather.windSpeed || 0}m/s`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 새로고침", callback_data: "weather:current" }],
                  [{ text: "📋 날씨 메뉴", callback_data: "weather:menu" }],
                ],
              },
            }
          );
        }
      }

      return true; // 메시지 처리됨
    }

    return false; // 다른 모듈에서 처리
  }

  /**
   * 📊 모듈 상태 정보
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceStatus: this.weatherService ? "Connected" : "Disconnected",
      features: {
        weather: this.config.enableWeather,
        dust: this.config.enableDust,
        gps: this.config.enableGPS,
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      if (this.weatherService?.clearLocationCache) {
        this.weatherService.clearLocationCache();
      }
      logger.info("🧹 WeatherModule 정리 완료");
    } catch (error) {
      logger.error("WeatherModule 정리 실패:", error);
    }
  }
}

module.exports = WeatherModule;
