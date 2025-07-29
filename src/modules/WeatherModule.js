// src/modules/WeatherModule.js - 미세먼지 기능 완전 수정 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherModule - 날씨 + 미세먼지 통합 모듈
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
      ...options.config,
    };

    logger.info("🌤️ WeatherModule 생성됨", {
      config: this.config,
    });
  }

  /**
   * 🏗️ 모듈 키워드 정의
   */
  getModuleKeywords() {
    return [
      "weather",
      "날씨",
      "기상",
      "온도",
      "습도",
      "바람",
      "dust",
      "미세먼지",
      "초미세먼지",
      "pm2.5",
      "pm10",
      "대기질",
    ];
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
      dust: this.showDust, // 핵심 수정!
      complete: this.showCompleteInfo,
      help: this.showHelp,
      status: this.showStatus,
    });
  }

  // ===== 📋 메뉴 액션들 =====

  /**
   * 🌤️ 날씨 메뉴 표시
   */
  async showWeatherMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    try {
      logger.info(`🌤️ 날씨 메뉴 요청 (사용자: ${userId})`);

      return {
        type: "menu",
        module: "weather",
        data: {
          userName,
          currentTime: TimeHelper.format(TimeHelper.now(), "full"),
          features: {
            weather: this.config.enableWeather,
            dust: this.config.enableDust,
          },
        },
      };
    } catch (error) {
      logger.error("날씨 메뉴 표시 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: { message: "날씨 메뉴를 불러올 수 없습니다" },
      };
    }
  }

  /**
   * 🌡️ 현재 날씨 표시 (GPS 기반)
   */
  async showCurrent(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);

    try {
      logger.info(`🌡️ 현재 날씨 요청 (사용자: ${userId}) - GPS 기반`);

      // 🌍 GPS 기반 날씨 조회 (userId 전달)
      const weatherResult = await this.weatherService.getCurrentWeather(
        null,
        userId
      );

      if (weatherResult.success) {
        // 🚨 온도 데이터 검증
        const weatherData = weatherResult.data;
        if (!weatherData.temperature && weatherData.temperature !== 0) {
          logger.warn("⚠️ 온도 데이터 누락, 보정 적용");
          weatherData.temperature = "측정중";
          weatherData.feelsLike = "측정중";
        }

        // 🌍 GPS 감지 여부 표시
        const locationInfo = weatherData.autoDetectedLocation
          ? `📍 자동 감지된 위치: ${weatherResult.location}`
          : `📍 지정된 위치: ${weatherResult.location}`;

        logger.success(
          `✅ 날씨 표시: ${locationInfo} ${weatherData.temperature}°C`
        );

        return {
          type: "current",
          module: "weather",
          data: {
            weather: weatherData,
            location: weatherResult.location,
            timestamp: weatherResult.timestamp,
            source: weatherResult.source,
            warning: weatherResult.warning || null,
            locationInfo: locationInfo,
            isGPSDetected: weatherData.autoDetectedLocation,
          },
        };
      } else {
        throw new Error(weatherResult.error);
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
            "GPS 위치 서비스를 확인해보세요",
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

    try {
      logger.info(`🌬️ 미세먼지 정보 요청 (사용자: ${userId}) - GPS 기반`);

      // 🌍 GPS 기반 미세먼지 조회 (userId 전달)
      const dustResult = await this.weatherService.getDustInfo(null, userId);

      if (dustResult.success) {
        // 🌍 GPS 감지 여부 표시
        const locationInfo = dustResult.data.autoDetectedLocation
          ? `📍 자동 감지된 위치: ${dustResult.location}`
          : `📍 지정된 위치: ${dustResult.location}`;

        logger.success(
          `✅ 미세먼지 정보 조회 성공: ${locationInfo} (${dustResult.source})`
        );

        return {
          type: "dust",
          module: "weather",
          data: {
            dust: dustResult.data,
            location: dustResult.location,
            timestamp: dustResult.timestamp,
            source: dustResult.source,
            locationInfo: locationInfo,
            isGPSDetected: dustResult.data.autoDetectedLocation,
          },
        };
      } else {
        // 실패했지만 폴백 데이터가 있는 경우
        if (dustResult.data) {
          logger.warn(
            `⚠️ 미세먼지 조회 실패, 폴백 데이터 사용: ${dustResult.error}`
          );

          return {
            type: "dust",
            module: "weather",
            data: {
              dust: dustResult.data,
              location: dustResult.location || "화성시",
              timestamp: TimeHelper.format(TimeHelper.now(), "full"),
              error: dustResult.error,
              fallback: true,
              locationInfo: `📍 기본 위치: ${dustResult.location || "화성시"}`,
            },
          };
        }

        throw new Error(dustResult.error);
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
            "GPS 위치 서비스를 확인해보세요",
            "인터넷 연결을 확인해보세요",
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

    try {
      logger.info(`🌍 통합 날씨 정보 요청 (사용자: ${userId})`);

      const completeInfo = await this.weatherService.getCompleteWeatherInfo();

      return {
        type: "complete",
        module: "weather",
        data: completeInfo,
      };
    } catch (error) {
      logger.error("통합 날씨 정보 조회 실패:", error);
      return {
        type: "error",
        module: "weather",
        data: {
          message: "통합 날씨 정보를 불러올 수 없습니다: " + error.message,
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
          "🌡️ 현재 날씨 정보",
          "🌬️ 실시간 미세먼지 정보",
          "🌍 통합 대시보드",
          "📊 대기질 분석",
        ],
        commands: ["/weather - 날씨 메뉴 열기", "버튼 클릭으로 정보 조회"],
        tips: [
          "정보는 5-10분마다 자동 갱신됩니다",
          "캐시된 데이터로 빠른 응답을 제공합니다",
          "API 오류 시 폴백 데이터를 표시합니다",
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
   * 📊 모듈 상태 정보
   */
  getModuleStatus() {
    return {
      ...super.getModuleStatus(),
      serviceStatus: this.weatherService ? "Connected" : "Disconnected",
      features: {
        weather: this.config.enableWeather,
        dust: this.config.enableDust,
        complete: this.config.enableWeather && this.config.enableDust,
      },
    };
  }
}

module.exports = WeatherModule;
