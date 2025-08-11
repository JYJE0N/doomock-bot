/**
 * 🌤️ WeatherModuleV2 - EventBus 기반 날씨 모듈
 * 완전한 이벤트 기반 아키텍처로 구현된 날씨 정보 모듈
 */

const { EVENTS } = require("../events/index");
const logger = require("../utils/core/Logger");
const Utils = require("../utils");

class WeatherModuleV2 {
  constructor(moduleName = "weather", options = {}) {
    this.moduleName = moduleName;
    this.serviceBuilder = options.serviceBuilder || null;
    
    // EventBus는 ModuleManager에서 주입받거나 글로벌 인스턴스 사용
    // ✅ EventBus 강제 주입 - fallback 제거로 중복 인스턴스 방지
    if (!options.eventBus) {
      throw new Error(`EventBus must be injected via options for module: ${moduleName}`);
    }
    this.eventBus = options.eventBus;
    
    // 서비스 인스턴스
    this.weatherService = null;
    
    // 초기화 상태
    this.isInitialized = false;
    
    // 모듈 설정
    this.config = {
      defaultCity: process.env.DEFAULT_WEATHER_CITY || "서울",
      enableDustInfo: process.env.WEATHER_ENABLE_DUST !== "false",
      enableForecast: process.env.WEATHER_ENABLE_FORECAST !== "false",
      enableAutoResponse: process.env.WEATHER_AUTO_RESPONSE !== "false",
      ...options.config
    };

    // 지원 도시 목록
    this.majorCities = [
      { id: "seoul", name: "서울", fullName: "서울시", lat: 37.5665, lon: 126.9780 },
      { id: "suwon", name: "수원", fullName: "수원시", lat: 37.2636, lon: 127.0286 },
      { id: "incheon", name: "인천", fullName: "인천시", lat: 37.4563, lon: 126.7052 },
      { id: "daejeon", name: "대전", fullName: "대전시", lat: 36.3504, lon: 127.3845 },
      { id: "daegu", name: "대구", fullName: "대구시", lat: 35.8714, lon: 128.6014 },
      { id: "busan", name: "부산", fullName: "부산시", lat: 35.1796, lon: 129.0756 },
      { id: "gwangju", name: "광주", fullName: "광주시", lat: 35.1595, lon: 126.8526 },
      { id: "jeju", name: "제주", fullName: "제주시", lat: 33.4996, lon: 126.5312 }
    ];

    // 사용자별 선호 도시 (메모리 캐시)
    this.userPreferences = new Map();
    
    // 이벤트 구독 관리
    this.subscriptions = [];
    
    // 자동 정리 인터벌 (30분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredPreferences();
    }, 1800000);

    logger.info("🌤️ WeatherModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 WeatherService 가져오기
      if (this.serviceBuilder) {
        this.weatherService = await this.serviceBuilder.getOrCreate("weather", {
          config: {
            defaultLocation: this.config.defaultCity + "시",
            enableDustInfo: this.config.enableDustInfo
          }
        });
      }

      if (!this.weatherService) {
        throw new Error("WeatherService 생성에 실패했습니다");
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기화 완료 표시
      this.isInitialized = true;
      
      logger.success("🌤️ WeatherModuleV2 초기화 완료 (EventBus 기반)");
      return true;
    } catch (error) {
      logger.error("❌ WeatherModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 현재 날씨 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.CURRENT_REQUEST, async (event) => {
        await this.handleCurrentWeatherRequest(event);
      })
    );

    // 예보 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.FORECAST_REQUEST, async (event) => {
        await this.handleForecastRequest(event);
      })
    );

    // 도시별 날씨 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.CITY_REQUEST, async (event) => {
        await this.handleCityWeatherRequest(event);
      })
    );

    // 도시 목록 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.CITY_LIST_REQUEST, async (event) => {
        await this.handleCityListRequest(event);
      })
    );

    // 기본 도시 설정
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.DEFAULT_CITY_SET, async (event) => {
        await this.handleDefaultCitySet(event);
      })
    );

    // 메뉴 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 도움말 요청
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.WEATHER.HELP_REQUEST, async (event) => {
        await this.handleHelpRequest(event);
      })
    );

    // 사용자 메시지 (자동 날씨 응답)
    if (this.config.enableAutoResponse) {
      this.subscriptions.push(
        this.eventBus.subscribe(EVENTS.USER.MESSAGE, async (event) => {
          await this.handleUserMessage(event);
        })
      );
    }

    logger.debug("🎧 WeatherModuleV2 EventBus 리스너 설정 완료");
  }

  /**
   * 🎯 ModuleManager 호환 이벤트 핸들러
   */
  async handleEvent(eventName, event) {
    try {
      switch (eventName) {
        case EVENTS.USER.CALLBACK:
          await this.handleCallback(event);
          break;
        case EVENTS.USER.MESSAGE:
          await this.handleUserMessage(event);
          break;
        default:
          // 다른 이벤트는 개별 리스너에서 처리
          break;
      }
    } catch (error) {
      logger.error(`🌤️ WeatherModuleV2 이벤트 처리 오류: ${eventName}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🎯 콜백 처리 (레거시 호환) - ModuleManager에서 호출
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    
    // 레거시 콜백을 처리하는 맵
    const actionMap = {
      'menu': () => this.showMenu(userId, chatId),
      'current': () => this.publishCurrentRequest(userId, chatId, params),
      'forecast': () => this.publishForecastRequest(userId, chatId, params),
      'city': () => this.publishCityRequest(userId, chatId, params),
      'cities': () => this.publishCitiesRequest(userId, chatId),
      'help': () => this.publishHelpRequest(userId, chatId)
    };
    
    const handler = actionMap[subAction];
    if (handler) {
      const result = await handler();
      // menu 액션은 렌더러용 결과를 반환
      if (subAction === 'menu' && result) {
        return result;
      }
      return {
        type: subAction,
        module: 'weather',
        success: true
      };
    }
    
    logger.debug(`WeatherModuleV2: 알 수 없는 액션 - ${subAction}`);
    return null;
  }

  /**
   * 🌤️ 현재 날씨 요청 (레거시 콜백용)
   */
  async publishCurrentRequest(userId, chatId, params) {
    const city = params?.[0] || '서울';
    this.eventBus.publish(EVENTS.WEATHER.CURRENT_WEATHER_REQUEST, {
      userId,
      chatId,
      city
    });
    return { success: true };
  }

  /**
   * 📅 날씨 예보 요청 (레거시 콜백용)
   */
  async publishForecastRequest(userId, chatId, params) {
    const city = params?.[0] || '서울';
    this.eventBus.publish(EVENTS.WEATHER.FORECAST_REQUEST, {
      userId,
      chatId,
      city
    });
    return { success: true };
  }

  /**
   * 🏙️ 도시별 날씨 요청 (레거시 콜백용)
   */
  async publishCityRequest(userId, chatId, params) {
    const city = params?.[0] || '서울';
    this.eventBus.publish(EVENTS.WEATHER.CITY_WEATHER_REQUEST, {
      userId,
      chatId,
      city
    });
    return { success: true };
  }

  /**
   * 🏙️ 도시 목록 요청 (레거시 콜백용)
   */
  async publishCitiesRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WEATHER.CITY_LIST_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * ❓ 도움말 요청 (레거시 콜백용)
   */
  async publishHelpRequest(userId, chatId) {
    this.eventBus.publish(EVENTS.WEATHER.HELP_REQUEST, {
      userId,
      chatId
    });
    return { success: true };
  }

  /**
   * 🏠 메뉴 표시 (V2 렌더러 방식)
   */
  async showMenu(userId, chatId) {
    try {
      const userName = "사용자"; // 기본 사용자명
      const defaultCity = '서울'; // 기본 도시
      const majorCities = ['서울', '부산', '대구', '인천', '광주', '대전', '울산'];

      // 렌더러에게 전달할 데이터 구성
      return {
        type: 'menu',
        module: 'weather',
        success: true,
        data: {
          title: '🌤️ *날씨 정보*',
          userName: userName,
          defaultCity: defaultCity,
          majorCities: majorCities,
          supportedCities: majorCities, // 호환성을 위해 유지
          config: {
            enableDustInfo: this.config.enableDustInfo || false,
            enableForecast: this.config.enableForecast || true
          },
          userId: userId
        }
      };

    } catch (error) {
      logger.error('🌤️ WeatherModuleV2.showMenu 실패:', error);
      return {
        type: 'error',
        module: 'weather',
        success: false,
        data: {
          message: '날씨 메뉴를 불러오는 중 오류가 발생했습니다.',
          canRetry: true
        }
      };
    }
  }

  /**
   * 🎯 이벤트 기반 콜백 처리 (구 handleCallback)
   */
  async handleCallbackEvent(event) {
    const { data, userId, chatId } = event.payload;
    const [module, action, ...params] = data.split(':');
    
    if (module !== 'weather') return;

    try {
      switch (action) {
        case 'menu':
          await this.publishMenuRequest(userId, chatId);
          break;
        case 'current':
          await this.publishCurrentWeatherRequest(userId, chatId);
          break;
        case 'city':
          await this.publishCityWeatherRequest(userId, chatId, params[0]);
          break;
        case 'cities':
          await this.publishCityListRequest(userId, chatId);
          break;
        case 'forecast':
          await this.publishForecastRequest(userId, chatId, params[0]);
          break;
        case 'setdefault':
          await this.setDefaultCity(userId, params[0]);
          break;
        case 'help':
          await this.publishHelpRequest(userId, chatId);
          break;
        default:
          logger.debug(`🌤️ 알 수 없는 액션: ${action}`);
      }
    } catch (error) {
      logger.error(`🌤️ 콜백 처리 오류: ${action}`, error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🌤️ 현재 날씨 요청 처리
   */
  async handleCurrentWeatherRequest(event) {
    const { userId, chatId, cityId, cityName } = event.payload;

    try {
      const targetCityId = cityId || this.getDefaultCityId(userId);
      const city = this.findCity(targetCityId, cityName);
      
      if (!city) {
        await this.eventBus.publish(EVENTS.WEATHER.CURRENT_ERROR, {
          userId,
          chatId,
          error: "도시를 찾을 수 없습니다."
        });
        return;
      }

      // 날씨 데이터 조회
      const weatherResult = await this.weatherService.getCurrentWeather(city.fullName);
      
      if (!weatherResult.success) {
        await this.eventBus.publish(EVENTS.WEATHER.CURRENT_ERROR, {
          userId,
          chatId,
          error: weatherResult.message || "날씨 정보를 가져올 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WEATHER.CURRENT_READY, {
        userId,
        chatId,
        weather: weatherResult.data,
        cityInfo: city
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatCurrentWeather(weatherResult.data, city),
        options: {
          reply_markup: this.createWeatherKeyboard(city.id),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('🌤️ 현재 날씨 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📅 예보 요청 처리
   */
  async handleForecastRequest(event) {
    const { userId, chatId, cityId, days = 3 } = event.payload;

    try {
      if (!this.config.enableForecast) {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: "❌ 날씨 예보 기능이 비활성화되어 있습니다.",
          options: { parse_mode: 'Markdown' }
        });
        return;
      }

      const targetCityId = cityId || this.getDefaultCityId(userId);
      const city = this.findCity(targetCityId);
      
      if (!city) {
        await this.eventBus.publish(EVENTS.WEATHER.FORECAST_ERROR, {
          userId,
          chatId,
          error: "도시를 찾을 수 없습니다."
        });
        return;
      }

      // 예보 데이터 조회
      const forecastResult = await this.weatherService.getForecast(city.fullName, days);
      
      if (!forecastResult.success) {
        await this.eventBus.publish(EVENTS.WEATHER.FORECAST_ERROR, {
          userId,
          chatId,
          error: forecastResult.message || "예보 정보를 가져올 수 없습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.WEATHER.FORECAST_READY, {
        userId,
        chatId,
        forecast: forecastResult.data,
        cityInfo: city,
        days
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatForecast(forecastResult.data, city, days),
        options: {
          reply_markup: this.createForecastKeyboard(city.id),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📅 날씨 예보 조회 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🏙️ 도시별 날씨 요청 처리
   */
  async handleCityWeatherRequest(event) {
    const { userId, chatId, cityId } = event.payload;

    try {
      const city = this.findCity(cityId);
      
      if (!city) {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: "❌ 알 수 없는 도시입니다.",
          options: { parse_mode: 'Markdown' }
        });
        return;
      }

      // 현재 날씨 요청으로 위임
      await this.eventBus.publish(EVENTS.WEATHER.CURRENT_REQUEST, {
        userId,
        chatId,
        cityId
      });

    } catch (error) {
      logger.error('🏙️ 도시별 날씨 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📋 도시 목록 요청 처리
   */
  async handleCityListRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const defaultCity = this.getUserPreferredCity(userId);
      
      await this.eventBus.publish(EVENTS.WEATHER.CITY_LIST_READY, {
        userId,
        chatId,
        cities: this.majorCities,
        defaultCity
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatCityList(defaultCity),
        options: {
          reply_markup: this.createCityListKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📋 도시 목록 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ⚙️ 기본 도시 설정 처리
   */
  async handleDefaultCitySet(event) {
    const { userId, cityId, cityName } = event.payload;

    try {
      const city = this.findCity(cityId, cityName);
      
      if (!city) {
        logger.warn(`⚙️ 알 수 없는 도시 설정 시도: ${cityId || cityName}`);
        return;
      }

      // 사용자 기본 도시 설정
      this.setUserPreferredCity(userId, city.name);
      
      logger.info(`⚙️ 기본 도시 설정: ${userId} → ${city.name}`);

      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId: event.payload.chatId || userId,
        text: `✅ 기본 도시가 *${city.name}*로 설정되었습니다.`,
        options: {
          reply_markup: this.createAfterSetKeyboard(city.id),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('⚙️ 기본 도시 설정 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📝 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const defaultCity = this.getUserPreferredCity(userId);
      
      await this.eventBus.publish(EVENTS.WEATHER.MENU_READY, {
        userId,
        chatId,
        defaultCity,
        config: this.config
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatMenu(defaultCity),
        options: {
          reply_markup: this.createMenuKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('📝 날씨 메뉴 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ❓ 도움말 요청 처리
   */
  async handleHelpRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      await this.eventBus.publish(EVENTS.WEATHER.HELP_READY, {
        userId,
        chatId
      });

      // 렌더링 요청
      await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
        chatId,
        text: this.formatHelp(),
        options: {
          reply_markup: this.createHelpKeyboard(),
          parse_mode: 'Markdown'
        }
      });

    } catch (error) {
      logger.error('❓ 도움말 요청 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 💬 사용자 메시지 처리 (자동 날씨 응답)
   */
  async handleUserMessage(event) {
    if (!this.config.enableAutoResponse) return;

    const { userId, chatId, text } = event.payload;
    
    if (!text) return;

    try {
      const lowerText = text.toLowerCase();
      const weatherKeywords = ["날씨", "weather", "온도", "습도", "미세먼지"];
      
      const hasWeatherKeyword = weatherKeywords.some(keyword => 
        lowerText.includes(keyword)
      );

      if (!hasWeatherKeyword) return;

      // 도시 키워드 검색
      const city = this.findCityByKeyword(text);
      const cityId = city ? city.id : this.getDefaultCityId(userId);

      // 현재 날씨 요청 발행
      await this.eventBus.publish(EVENTS.WEATHER.CURRENT_REQUEST, {
        userId,
        chatId,
        cityId
      });

    } catch (error) {
      logger.error('💬 자동 날씨 응답 처리 실패:', error);
    }
  }

  // === 이벤트 발행 헬퍼 메서드들 ===

  async publishCurrentWeatherRequest(userId, chatId, cityId = null) {
    await this.eventBus.publish(EVENTS.WEATHER.CURRENT_REQUEST, {
      userId,
      chatId,
      cityId
    });
  }

  async publishForecastRequest(userId, chatId, cityId = null, days = 3) {
    await this.eventBus.publish(EVENTS.WEATHER.FORECAST_REQUEST, {
      userId,
      chatId,
      cityId,
      days
    });
  }

  async publishCityWeatherRequest(userId, chatId, cityId) {
    await this.eventBus.publish(EVENTS.WEATHER.CITY_REQUEST, {
      userId,
      chatId,
      cityId
    });
  }

  async publishCityListRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WEATHER.CITY_LIST_REQUEST, {
      userId,
      chatId
    });
  }

  async publishMenuRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WEATHER.MENU_REQUEST, {
      userId,
      chatId
    });
  }

  async publishHelpRequest(userId, chatId) {
    await this.eventBus.publish(EVENTS.WEATHER.HELP_REQUEST, {
      userId,
      chatId
    });
  }

  async publishError(error, originalEvent) {
    const chatId = originalEvent?.payload?.chatId;
    
    if (chatId) {
      await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
        chatId,
        error: error.message || '날씨 정보 처리 중 오류가 발생했습니다.'
      });
    }

    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: 'WeatherModuleV2',
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: Utils.timestamp()
    });
  }

  // === 유틸리티 메서드들 ===

  findCity(cityId, cityName = null) {
    if (cityId) {
      return this.majorCities.find(c => c.id === cityId);
    }
    if (cityName) {
      return this.majorCities.find(c => 
        c.name === cityName || c.fullName === cityName
      );
    }
    return null;
  }

  findCityByKeyword(text) {
    const lowerText = text.toLowerCase();
    return this.majorCities.find(city => 
      lowerText.includes(city.name) || lowerText.includes(city.fullName)
    );
  }

  getDefaultCityId(userId) {
    const preferred = this.getUserPreferredCity(userId);
    const city = this.majorCities.find(c => c.name === preferred);
    return city ? city.id : 'seoul';
  }

  getUserPreferredCity(userId) {
    return this.userPreferences.get(userId) || this.config.defaultCity;
  }

  setUserPreferredCity(userId, cityName) {
    this.userPreferences.set(userId, cityName);
  }

  async setDefaultCity(userId, cityId) {
    const city = this.findCity(cityId);
    if (city) {
      await this.eventBus.publish(EVENTS.WEATHER.DEFAULT_CITY_SET, {
        userId,
        cityId,
        cityName: city.name
      });
    }
  }

  cleanupExpiredPreferences() {
    // 실제로는 마지막 사용 시간 기반으로 정리해야 하지만
    // 여기서는 단순히 크기 제한만 적용
    if (this.userPreferences.size > 1000) {
      const entries = Array.from(this.userPreferences.entries());
      const keepEntries = entries.slice(-500);
      
      this.userPreferences.clear();
      keepEntries.forEach(([userId, city]) => {
        this.userPreferences.set(userId, city);
      });
      
      logger.debug('🧹 날씨 모듈 사용자 선호도 정리 완료');
    }
  }

  // === 포맷팅 메서드들 ===

  formatCurrentWeather(weather, city) {
    const lines = [
      `🌤️ *${city.name} 현재 날씨*\n`,
      `🌡️ **온도**: ${weather.temperature}°C`,
      `💧 **습도**: ${weather.humidity}%`,
      `💨 **바람**: ${weather.windSpeed}m/s`
    ];

    if (weather.description) {
      lines.push(`☁️ **날씨**: ${weather.description}`);
    }

    if (this.config.enableDustInfo && weather.dust) {
      lines.push(`🌫️ **미세먼지**: ${weather.dust.pm10} (${weather.dust.grade})`);
    }

    lines.push(`\n📅 **측정시간**: ${Utils.now()}`);

    return lines.join('\n');
  }

  formatForecast(forecast, city, days) {
    const lines = [
      `📅 *${city.name} ${days}일 예보*\n`
    ];

    if (Array.isArray(forecast)) {
      forecast.forEach((day, index) => {
        lines.push(`**${index + 1}일째**`);
        lines.push(`🌡️ ${day.minTemp}°C ~ ${day.maxTemp}°C`);
        lines.push(`☁️ ${day.description}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  formatCityList(defaultCity) {
    return [
      '🏙️ *도시 선택*\n',
      `현재 기본 도시: **${defaultCity}**\n`,
      '아래 버튼을 눌러 도시를 선택하세요:'
    ].join('\n');
  }

  formatMenu(defaultCity) {
    return [
      '🌤️ *날씨 정보*\n',
      `📍 기본 도시: **${defaultCity}**\n`,
      '원하는 기능을 선택하세요:'
    ].join('\n');
  }

  formatHelp() {
    return [
      '❓ *날씨 모듈 도움말*\n',
      '**사용 가능한 기능:**',
      '• 현재 날씨 조회',
      '• 날씨 예보 확인',
      '• 도시별 날씨 비교',
      '• 기본 도시 설정',
      '',
      '**자동 응답:**',
      '메시지에 "날씨", "온도" 등의',
      '키워드를 포함하면 자동으로 응답합니다.',
      '',
      '**지원 도시:**',
      this.majorCities.map(city => city.name).join(', ')
    ].join('\n');
  }

  // === 키보드 생성 메서드들 ===

  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🌡️ 현재 날씨', callback_data: 'weather:current' },
          { text: '📅 날씨 예보', callback_data: 'weather:forecast' }
        ],
        [
          { text: '🏙️ 도시 선택', callback_data: 'weather:cities' },
          { text: '⚙️ 기본 도시', callback_data: 'weather:setdefault' }
        ],
        [
          { text: '❓ 도움말', callback_data: 'weather:help' },
          { text: '🏠 메인 메뉴', callback_data: 'system:menu' }
        ]
      ]
    };
  }

  createCityListKeyboard() {
    const keyboard = [];
    
    // 도시 버튼들 (2열로 배치)
    for (let i = 0; i < this.majorCities.length; i += 2) {
      const row = [];
      
      const city1 = this.majorCities[i];
      row.push({ 
        text: `🏙️ ${city1.name}`, 
        callback_data: `weather:city:${city1.id}` 
      });

      if (i + 1 < this.majorCities.length) {
        const city2 = this.majorCities[i + 1];
        row.push({ 
          text: `🏙️ ${city2.name}`, 
          callback_data: `weather:city:${city2.id}` 
        });
      }

      keyboard.push(row);
    }

    // 메뉴 버튼
    keyboard.push([
      { text: '🔙 날씨 메뉴', callback_data: 'weather:menu' }
    ]);

    return { inline_keyboard: keyboard };
  }

  createWeatherKeyboard(cityId) {
    return {
      inline_keyboard: [
        [
          { text: '📅 예보 보기', callback_data: `weather:forecast:${cityId}` },
          { text: '🔄 새로고침', callback_data: `weather:city:${cityId}` }
        ],
        [
          { text: '⚙️ 기본 설정', callback_data: `weather:setdefault:${cityId}` },
          { text: '🏙️ 다른 도시', callback_data: 'weather:cities' }
        ],
        [
          { text: '🔙 날씨 메뉴', callback_data: 'weather:menu' }
        ]
      ]
    };
  }

  createForecastKeyboard(cityId) {
    return {
      inline_keyboard: [
        [
          { text: '🌡️ 현재 날씨', callback_data: `weather:city:${cityId}` },
          { text: '🔄 새로고침', callback_data: `weather:forecast:${cityId}` }
        ],
        [
          { text: '🏙️ 다른 도시', callback_data: 'weather:cities' },
          { text: '🔙 날씨 메뉴', callback_data: 'weather:menu' }
        ]
      ]
    };
  }

  createAfterSetKeyboard(cityId) {
    return {
      inline_keyboard: [
        [
          { text: '🌡️ 현재 날씨', callback_data: `weather:city:${cityId}` },
          { text: '📅 날씨 예보', callback_data: `weather:forecast:${cityId}` }
        ],
        [
          { text: '🔙 날씨 메뉴', callback_data: 'weather:menu' }
        ]
      ]
    };
  }

  createHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🌡️ 현재 날씨', callback_data: 'weather:current' },
          { text: '🏙️ 도시 선택', callback_data: 'weather:cities' }
        ],
        [
          { text: '🔙 날씨 메뉴', callback_data: 'weather:menu' }
        ]
      ]
    };
  }

  // === 정리 ===

  async cleanup() {
    try {
      logger.info('🧹 WeatherModuleV2 정리 시작...');
      
      // 인터벌 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // 이벤트 구독 해제
      this.subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      // 사용자 선호도 정리
      this.userPreferences.clear();
      
      logger.success('✅ WeatherModuleV2 정리 완료');
    } catch (error) {
      logger.error('❌ WeatherModuleV2 정리 실패:', error);
      throw error;
    }
  }
}

module.exports = WeatherModuleV2;