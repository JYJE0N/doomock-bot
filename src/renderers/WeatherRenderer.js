// src/renderers/WeatherRenderer.js - 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌤️ WeatherRenderer - 날씨 정보 UI 렌더링 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "weather:action:params" 형태 표준화
 * - 도시별 날씨 정보를 파서 규칙으로 단순화
 * - 미세먼지, 예보 등 확장 기능 통합 처리
 * - 실시간 날씨 업데이트 지원
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 스마트 날씨 정보 대시보드
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 복잡한 날씨 데이터를 직관적으로 표시
 * - 실시간 업데이트와 시각적 피드백
 * - 다양한 도시와 상세 정보 관리
 *
 * 🌤️ 날씨 파서 규칙:
 * - weather:menu → 날씨 메인 메뉴
 * - weather:city:seoul → 서울 날씨 조회
 * - weather:city:busan → 부산 날씨 조회
 * - weather:forecast:seoul → 서울 날씨 예보
 * - weather:setdefault:seoul → 서울을 기본 도시로 설정
 * - weather:dust:seoul → 서울 미세먼지 정보
 */
class WeatherRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "weather";

    // 🌤️ 날씨 특화 설정
    this.config = {
      ...this.config,
      supportedCities: 8,
      showDustInfo: true,
      showForecast: false,
      autoRefreshInterval: 300000, // 5분
      showWeatherAdvice: true,
    };

    // 🎭 이모지 컬렉션 (날씨 특화)
    this.emojis = {
      // 기본 날씨 관련
      weather: "🌤️",
      sunny: "☀️",
      cloudy: "☁️",
      rainy: "🌧️",
      snowy: "❄️",
      stormy: "⛈️",
      foggy: "🌫️",

      // 측정 요소
      temperature: "🌡️",
      humidity: "💧",
      wind: "🌬️",
      pressure: "🔽",
      visibility: "👁️",

      // 미세먼지
      dust: "🏭",
      pm25: "🔸",
      pm10: "🔹",

      // 시간 관련
      sunrise: "🌅",
      sunset: "🌇",
      time: "⏰",
      update: "🔄",

      // 도시 아이콘
      seoul: "🏛️",
      suwon: "🏰",
      incheon: "✈️",
      daejeon: "🚄",
      daegu: "🍎",
      busan: "🌊",
      gwangju: "🌻",
      jeju: "🏝️",

      // 기능
      menu: "📋",
      cities: "📍",
      forecast: "📊",
      settings: "⚙️",
      help: "❓",

      // 상태
      good: "😊",
      moderate: "😐",
      bad: "😷",
      very_bad: "🤢",

      // UI 요소
      refresh: "🔄",
      star: "⭐",
      check: "✅",
      error: "❌",
    };

    // 🏙️ 주요 도시 정보
    this.cities = {
      seoul: {
        id: "seoul",
        name: "서울",
        emoji: this.emojis.seoul,
        fullName: "Seoul",
        region: "수도권",
      },
      suwon: {
        id: "suwon",
        name: "수원",
        emoji: this.emojis.suwon,
        fullName: "Suwon",
        region: "수도권",
      },
      incheon: {
        id: "incheon",
        name: "인천",
        emoji: this.emojis.incheon,
        fullName: "Incheon",
        region: "수도권",
      },
      daejeon: {
        id: "daejeon",
        name: "대전",
        emoji: this.emojis.daejeon,
        fullName: "Daejeon",
        region: "충청권",
      },
      daegu: {
        id: "daegu",
        name: "대구",
        emoji: this.emojis.daegu,
        fullName: "Daegu",
        region: "경상권",
      },
      busan: {
        id: "busan",
        name: "부산",
        emoji: this.emojis.busan,
        fullName: "Busan",
        region: "경상권",
      },
      gwangju: {
        id: "gwangju",
        name: "광주",
        emoji: this.emojis.gwangju,
        fullName: "Gwangju",
        region: "전라권",
      },
      jeju: {
        id: "jeju",
        name: "제주",
        emoji: this.emojis.jeju,
        fullName: "Jeju",
        region: "제주권",
      },
    };

    // 🌡️ 날씨 상태 매핑
    this.weatherConditions = {
      Clear: { emoji: this.emojis.sunny, label: "맑음" },
      Clouds: { emoji: this.emojis.cloudy, label: "흐림" },
      Rain: { emoji: this.emojis.rainy, label: "비" },
      Drizzle: { emoji: this.emojis.rainy, label: "이슬비" },
      Thunderstorm: { emoji: this.emojis.stormy, label: "천둥번개" },
      Snow: { emoji: this.emojis.snowy, label: "눈" },
      Mist: { emoji: this.emojis.foggy, label: "안개" },
      Fog: { emoji: this.emojis.foggy, label: "안개" },
      Haze: { emoji: this.emojis.foggy, label: "연무" },
    };

    logger.debug("🌤️ WeatherRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, {
      dataKeys: Object.keys(data || {}),
      hasData: !!data,
    });

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "city_list":
          return await this.renderCityList(data, ctx);

        case "city_weather":
          return await this.renderCityWeather(data, ctx);

        case "forecast":
          return await this.renderForecast(data, ctx);

        case "dust_info":
          return await this.renderDustInfo(data, ctx);

        case "default_set":
          return await this.renderDefaultSet(data, ctx);

        case "weather_comparison":
          return await this.renderWeatherComparison(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "loading":
          return await this.renderLoading(data, ctx);

        case "info":
          return await this.renderInfo(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "알 수 없는 오류가 발생했습니다.",
            ctx
          );

        default:
          this.warn(`지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            `지원하지 않는 기능입니다: ${type}`,
            ctx
          );
      }
    } catch (error) {
      this.error(`렌더링 오류 (${type})`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다.", ctx);
    }
  }

  // ===== 🌤️ 메인 메뉴 렌더링 =====

  /**
   * 🌤️ 날씨 메인 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMenu(data, ctx) {
    this.debug("날씨 메뉴 렌더링", {
      hasDefaultCity: !!data?.defaultCity,
      userName: data?.userName,
    });

    const { userName, defaultCity, quickWeather } = data;

    let text = `${this.emojis.weather} **날씨 정보 \\- ${userName}**\n\n`;
    text += `🌤️ **전국 주요 도시의 실시간 날씨를 확인하세요\\!**\n\n`;

    // 기본 도시 정보
    if (defaultCity) {
      const cityInfo = this.cities[defaultCity] || {
        name: defaultCity,
        emoji: "🏙️",
      };
      text += `⭐ **기본 도시**: ${cityInfo.emoji} ${cityInfo.name}\n`;
    }

    // 빠른 날씨 정보 (기본 도시)
    if (quickWeather) {
      const weatherInfo = this.getWeatherCondition(quickWeather.condition);
      text += `${weatherInfo.emoji} **현재 날씨**: ${quickWeather.temperature}°C, ${weatherInfo.label}\n`;
    }

    text += "\n✨ **원하는 기능을 선택해주세요\\!**";

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [
      [
        { text: `${this.emojis.cities} 도시별 날씨`, action: "cities" },
        { text: `${this.emojis.dust} 미세먼지`, action: "dust" },
      ],
    ];

    // 기본 도시가 설정되어 있으면 바로가기 추가
    if (defaultCity) {
      const cityInfo = this.cities[defaultCity];
      if (cityInfo) {
        buttons.unshift([
          {
            text: `${cityInfo.emoji} ${cityInfo.name} 날씨`,
            action: "city",
            params: defaultCity,
          },
          {
            text: `${this.emojis.refresh} 새로고침`,
            action: "city",
            params: defaultCity,
          },
        ]);
      }
    }

    buttons.push([
      { text: `${this.emojis.settings} 설정`, action: "settings" },
      { text: `${this.emojis.help} 도움말`, action: "help" },
    ]);

    buttons.push([this.createHomeButton()]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🏙️ 도시 목록 렌더링 =====

  /**
   * 🏙️ 도시 목록 렌더링
   */
  async renderCityList(data, ctx) {
    this.debug("도시 목록 렌더링", {
      cityCount: Object.keys(this.cities).length,
    });

    let text = `${this.emojis.cities} **주요 도시 날씨**\n\n`;
    text += `📍 **원하는 도시를 선택하세요** (${
      Object.keys(this.cities).length
    }개 도시)\n\n`;

    // 지역별 분류
    const regions = {
      수도권: [],
      충청권: [],
      경상권: [],
      전라권: [],
      제주권: [],
    };

    Object.values(this.cities).forEach((city) => {
      regions[city.region].push(city);
    });

    // 지역별 도시 표시
    Object.entries(regions).forEach(([region, cities]) => {
      if (cities.length > 0) {
        text += `**${region}**: `;
        text += cities.map((city) => `${city.emoji} ${city.name}`).join(", ");
        text += "\n";
      }
    });

    // 도시 선택 키보드 (파서 규칙 적용)
    const cityButtons = [];
    const cityEntries = Object.entries(this.cities);

    // 2열씩 배치
    for (let i = 0; i < cityEntries.length; i += 2) {
      const row = [];

      const [id1, city1] = cityEntries[i];
      row.push({
        text: `${city1.emoji} ${city1.name}`,
        action: "city",
        params: id1,
      });

      if (i + 1 < cityEntries.length) {
        const [id2, city2] = cityEntries[i + 1];
        row.push({
          text: `${city2.emoji} ${city2.name}`,
          action: "city",
          params: id2,
        });
      }

      cityButtons.push(row);
    }

    // 하단 메뉴
    cityButtons.push([
      { text: `${this.emojis.dust} 미세먼지`, action: "dust" },
      { text: `${this.emojis.help} 도움말`, action: "help" },
    ]);

    cityButtons.push([
      { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
      this.createHomeButton(),
    ]);

    const keyboard = this.createInlineKeyboard(cityButtons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🌡️ 도시별 날씨 렌더링 =====

  /**
   * 🌡️ 도시별 날씨 상세 렌더링
   */
  async renderCityWeather(data, ctx) {
    this.debug("도시별 날씨 렌더링", {
      cityId: data?.city?.id,
      hasWeather: !!data?.weather,
      hasDust: !!data?.dust,
    });

    const { city, weather, dust, timestamp, hasError, errorMessage } = data;

    if (hasError) {
      return await this.renderWeatherError(city, errorMessage, ctx);
    }

    const cityInfo = this.cities[city.id] || city;

    let text = `${cityInfo.emoji} **${cityInfo.name} 날씨**\n\n`;

    // 메인 날씨 정보
    if (weather) {
      const weatherInfo = this.getWeatherCondition(weather.condition);

      text += `${weatherInfo.emoji} **${weatherInfo.label}**\n`;
      if (weather.description && weather.description !== weatherInfo.label) {
        text += `📝 ${weather.description}\n`;
      }
      text += "\n";

      // 온도 정보
      text += `${this.emojis.temperature} **온도**: **${weather.temperature}°C**`;
      if (weather.feelsLike && weather.feelsLike !== weather.temperature) {
        text += ` (체감 ${weather.feelsLike}°C)`;
      }
      text += "\n";

      if (weather.tempMin !== undefined && weather.tempMax !== undefined) {
        text += `📊 **최저/최고**: ${weather.tempMin}°C / ${weather.tempMax}°C\n`;
      }

      // 환경 정보
      text += `${this.emojis.humidity} **습도**: ${weather.humidity}%\n`;

      if (weather.windSpeed > 0) {
        text += `${this.emojis.wind} **풍속**: ${weather.windSpeed}m/s`;
        if (weather.windDirection) {
          text += ` (${weather.windDirection})`;
        }
        text += "\n";
      }

      if (weather.pressure) {
        text += `${this.emojis.pressure} **기압**: ${weather.pressure}hPa\n`;
      }

      if (weather.visibility && weather.visibility < 10) {
        text += `${this.emojis.visibility} **가시거리**: ${weather.visibility}km\n`;
      }

      text += "\n";
    }

    // 미세먼지 정보
    if (dust && this.config.showDustInfo) {
      text += "━━━ **미세먼지** ━━━\n";

      if (dust.pm25 !== undefined) {
        const pm25Grade = this.getDustGrade(dust.pm25, "pm25");
        const pm25Emoji = this.getDustEmoji(pm25Grade);
        text += `${this.emojis.pm25} **PM2.5**: ${dust.pm25}㎍/㎥ ${pm25Emoji} ${pm25Grade}\n`;
      }

      if (dust.pm10 !== undefined) {
        const pm10Grade = this.getDustGrade(dust.pm10, "pm10");
        const pm10Emoji = this.getDustEmoji(pm10Grade);
        text += `${this.emojis.pm10} **PM10**: ${dust.pm10}㎍/㎥ ${pm10Emoji} ${pm10Grade}\n`;
      }

      text += "\n";
    }

    // 날씨 조언
    if (this.config.showWeatherAdvice && weather) {
      const advice = this.generateWeatherAdvice(weather);
      if (advice) {
        text += `💡 **날씨 조언**: ${advice}\n\n`;
      }
    }

    // 일출/일몰 정보
    if (weather?.sunrise || weather?.sunset) {
      text += `${this.emojis.sunrise} **일출**: ${
        weather.sunrise || "정보없음"
      } | `;
      text += `${this.emojis.sunset} **일몰**: ${
        weather.sunset || "정보없음"
      }\n\n`;
    }

    // 업데이트 시간
    text += `${this.emojis.time} **업데이트**: ${
      timestamp || TimeHelper.format(new Date(), "time")
    }`;

    // 액션 키보드
    const buttons = [
      [
        {
          text: `${this.emojis.refresh} 새로고침`,
          action: "city",
          params: city.id,
        },
        {
          text: `${this.emojis.forecast} 예보`,
          action: "forecast",
          params: city.id,
        },
      ],
      [
        {
          text: `${this.emojis.dust} 미세먼지`,
          action: "dust",
          params: city.id,
        },
        {
          text: `${this.emojis.star} 기본으로 설정`,
          action: "setdefault",
          params: city.id,
        },
      ],
      [
        { text: `${this.emojis.cities} 다른 도시`, action: "cities" },
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 날씨 에러 상태 렌더링
   */
  async renderWeatherError(city, errorMessage, ctx) {
    const cityInfo = this.cities[city.id] || city;

    let text = `${this.emojis.error} **날씨 정보 오류**\n\n`;
    text += `${cityInfo.emoji} **${cityInfo.name}** 날씨 정보를 불러올 수 없습니다\\.\n\n`;
    text += `⚠️ ${errorMessage}\n\n`;
    text += "💡 **해결 방법**:\n";
    text += "• 잠시 후 다시 시도해보세요\n";
    text += "• 다른 도시를 선택해보세요\n";
    text += "• 인터넷 연결을 확인해보세요";

    const buttons = [
      [
        {
          text: `${this.emojis.retry} 다시 시도`,
          action: "city",
          params: city.id,
        },
        { text: `${this.emojis.cities} 다른 도시`, action: "cities" },
      ],
      [
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📊 예보 및 추가 기능 렌더링 =====

  /**
   * 📊 날씨 예보 렌더링
   */
  async renderForecast(data, ctx) {
    this.debug("날씨 예보 렌더링", {
      cityId: data?.city?.id,
      forecastDays: data?.forecast?.length,
    });

    const { city, forecast } = data;
    const cityInfo = this.cities[city.id] || city;

    let text = `${this.emojis.forecast} **${cityInfo.name} 날씨 예보**\n\n`;

    if (!forecast || forecast.length === 0) {
      text += `${this.emojis.error} 예보 정보를 불러올 수 없습니다\\.\n`;
      text += "현재 날씨 정보만 제공됩니다\\.";
    } else {
      text += `📅 **${forecast.length}일간 예보**\n\n`;

      forecast.slice(0, 5).forEach((day, index) => {
        const weatherInfo = this.getWeatherCondition(day.condition);
        const date = new Date(day.date).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        });

        text += `**${date}** ${weatherInfo.emoji} ${day.tempMin}°C ~ ${day.tempMax}°C\n`;
        text += `   ${weatherInfo.label}`;

        if (day.precipitationChance > 0) {
          text += `, 강수확률 ${day.precipitationChance}%`;
        }

        text += "\n\n";
      });
    }

    const buttons = [
      [
        {
          text: `${cityInfo.emoji} 현재 날씨`,
          action: "city",
          params: city.id,
        },
        {
          text: `${this.emojis.dust} 미세먼지`,
          action: "dust",
          params: city.id,
        },
      ],
      [
        { text: `${this.emojis.cities} 다른 도시`, action: "cities" },
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🏭 미세먼지 정보 렌더링
   */
  async renderDustInfo(data, ctx) {
    this.debug("미세먼지 정보 렌더링", { cityId: data?.city?.id });

    const { city, dust, allCitiesDust } = data;

    let text = `${this.emojis.dust} **미세먼지 정보**\n\n`;

    if (city && dust) {
      // 특정 도시 미세먼지
      const cityInfo = this.cities[city.id] || city;
      text += `${cityInfo.emoji} **${cityInfo.name}**\n\n`;
      text += this.formatDustInfo(dust);
    } else if (allCitiesDust) {
      // 전국 미세먼지 현황
      text += `🇰🇷 **전국 미세먼지 현황**\n\n`;

      Object.entries(allCitiesDust).forEach(([cityId, dustData]) => {
        const cityInfo = this.cities[cityId];
        if (cityInfo && dustData) {
          const pm25Grade = this.getDustGrade(dustData.pm25, "pm25");
          const pm25Emoji = this.getDustEmoji(pm25Grade);

          text += `${cityInfo.emoji} **${cityInfo.name}**: ${dustData.pm25}㎍/㎥ ${pm25Emoji}\n`;
        }
      });
    } else {
      text += `${this.emojis.error} 미세먼지 정보를 불러올 수 없습니다\\.`;
    }

    text += `\n${this.emojis.time} **업데이트**: ${TimeHelper.format(
      new Date(),
      "time"
    )}`;

    const buttons = [
      [
        { text: `${this.emojis.cities} 도시별 날씨`, action: "cities" },
        { text: `${this.emojis.refresh} 새로고침`, action: "dust" },
      ],
      [
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⭐ 기본 도시 설정 완료 렌더링
   */
  async renderDefaultSet(data, ctx) {
    this.debug("기본 도시 설정 완료 렌더링");

    const { city, message } = data;
    const cityInfo = this.cities[city.id] || city;

    let text = `${this.emojis.check} **기본 도시 설정 완료\\!**\n\n`;
    text += `⭐ **새 기본 도시**: ${cityInfo.emoji} ${cityInfo.name}\n\n`;
    text += `💡 이제 "날씨"라고 입력하면 ${cityInfo.name} 날씨가 표시됩니다\\.\n\n`;
    text += `${this.emojis.success} ${message}`;

    const buttons = [
      [
        {
          text: `${cityInfo.emoji} ${cityInfo.name} 날씨 보기`,
          action: "city",
          params: city.id,
        },
        { text: `${this.emojis.cities} 다른 도시`, action: "cities" },
      ],
      [
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ❓ 도움말 및 정보 렌더링 =====

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("도움말 렌더링");

    let text = `${this.emojis.help} **날씨 정보 사용법**\n\n`;
    text += `${this.emojis.weather} **두목봇과 함께하는 스마트 날씨 서비스\\!**\n\n`;

    text += "📱 **주요 기능**\n";
    text += `• ${this.emojis.cities} **도시별 날씨** \\- 전국 8개 주요 도시 실시간 날씨\n`;
    text += `• ${this.emojis.dust} **미세먼지 정보** \\- PM2\\.5, PM10 농도 및 등급\n`;
    text += `• ${this.emojis.forecast} **날씨 예보** \\- 5일간 날씨 예보\n`;
    text += `• ${this.emojis.star} **기본 도시 설정** \\- 자주 확인하는 도시 설정\n\n`;

    text += "🏙️ **지원 도시**\n";
    Object.values(this.cities).forEach((city) => {
      text += `• ${city.emoji} **${city.name}** (${city.region})\n`;
    });
    text += "\n";

    text += "💬 **사용법**\n";
    text += '• "날씨" \\- 기본 도시 날씨\n';
    text += '• "서울 날씨" \\- 서울 날씨 조회\n';
    text += '• "부산 날씨" \\- 부산 날씨 조회\n';
    text += '• "미세먼지" \\- 전국 미세먼지 현황\n\n';

    text += "📊 **제공 정보**\n";
    text += `• ${this.emojis.temperature} 온도 (현재/체감/최저/최고)\n`;
    text += `• ${this.emojis.humidity} 습도, ${this.emojis.wind} 풍속, ${this.emojis.pressure} 기압\n`;
    text += `• ${this.emojis.sunrise} 일출/일몰 시간\n`;
    text += `• ${this.emojis.dust} 미세먼지 (PM2\\.5, PM10)\n`;
    text += `• 💡 날씨에 따른 생활 조언\n\n`;

    text += "✨ **두목봇과 함께 스마트한 날씨 정보를 활용해보세요\\!**";

    const buttons = [
      [
        { text: `${this.emojis.cities} 도시별 날씨`, action: "cities" },
        { text: `${this.emojis.dust} 미세먼지`, action: "dust" },
      ],
      [
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⏳ 로딩 상태 렌더링
   */
  async renderLoading(data, ctx) {
    this.debug("로딩 상태 렌더링", { action: data.action });

    const { action, cityName } = data;

    let text = `⏳ **날씨 정보 불러오는 중\\.\\.\\.**\n\n`;

    if (cityName) {
      text += `📍 **${cityName}** 날씨 정보를 가져오고 있습니다\\.\n`;
    }

    text += `🌤️ 잠시만 기다려주세요\\!`;

    const buttons = [[{ text: `${this.emojis.cancel} 취소`, action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 메시지 렌더링
   */
  async renderInfo(data, ctx) {
    this.debug("정보 메시지 렌더링");

    const { message, type = "info" } = data;

    const typeEmojis = {
      info: this.emojis.info,
      warning: this.emojis.warning,
      success: this.emojis.success,
    };

    let text = `${typeEmojis[type] || this.emojis.info} **알림**\n\n`;
    text += `${message}`;

    const buttons = [
      [
        { text: `${this.emojis.cities} 도시별 날씨`, action: "cities" },
        { text: `${this.emojis.menu} 날씨 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎨 헬퍼 메서드들 =====

  /**
   * 🌤️ 날씨 상태 정보 가져오기
   */
  getWeatherCondition(condition) {
    return (
      this.weatherConditions[condition] || {
        emoji: this.emojis.weather,
        label: condition || "알수없음",
      }
    );
  }

  /**
   * 🏭 미세먼지 등급 판정
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

  /**
   * 😊 미세먼지 등급별 이모지
   */
  getDustEmoji(grade) {
    const gradeEmojis = {
      좋음: this.emojis.good,
      보통: this.emojis.moderate,
      나쁨: this.emojis.bad,
      매우나쁨: this.emojis.very_bad,
    };

    return gradeEmojis[grade] || "😐";
  }

  /**
   * 🏭 미세먼지 정보 포맷팅
   */
  formatDustInfo(dust) {
    let text = "";

    if (dust.pm25 !== undefined) {
      const pm25Grade = this.getDustGrade(dust.pm25, "pm25");
      const pm25Emoji = this.getDustEmoji(pm25Grade);
      text += `${this.emojis.pm25} **PM2.5**: ${dust.pm25}㎍/㎥ ${pm25Emoji} ${pm25Grade}\n`;
    }

    if (dust.pm10 !== undefined) {
      const pm10Grade = this.getDustGrade(dust.pm10, "pm10");
      const pm10Emoji = this.getDustEmoji(pm10Grade);
      text += `${this.emojis.pm10} **PM10**: ${dust.pm10}㎍/㎥ ${pm10Emoji} ${pm10Grade}\n`;
    }

    // 미세먼지 조언
    const worstGrade = this.getWorstDustGrade(dust);
    if (worstGrade) {
      text += `\n💡 **조언**: ${this.getDustAdvice(worstGrade)}`;
    }

    return text;
  }

  /**
   * 🤔 최악의 미세먼지 등급 찾기
   */
  getWorstDustGrade(dust) {
    const grades = [];

    if (dust.pm25) {
      grades.push(this.getDustGrade(dust.pm25, "pm25"));
    }

    if (dust.pm10) {
      grades.push(this.getDustGrade(dust.pm10, "pm10"));
    }

    const gradeOrder = ["좋음", "보통", "나쁨", "매우나쁨"];
    let worstIndex = -1;

    grades.forEach((grade) => {
      const index = gradeOrder.indexOf(grade);
      if (index > worstIndex) {
        worstIndex = index;
      }
    });

    return worstIndex >= 0 ? gradeOrder[worstIndex] : null;
  }

  /**
   * 💡 미세먼지 조언 생성
   */
  getDustAdvice(grade) {
    const advice = {
      좋음: "야외 활동하기 좋은 날입니다!",
      보통: "일반적인 야외 활동에는 문제없습니다.",
      나쁨: "민감군은 실외 활동을 줄이세요. 마스크 착용을 권장합니다.",
      매우나쁨: "외출을 자제하고 실내에 머물러주세요. 마스크는 필수입니다.",
    };

    return advice[grade] || "미세먼지 농도를 확인하고 적절히 대응하세요.";
  }

  /**
   * 💡 날씨 조언 생성
   */
  generateWeatherAdvice(weather) {
    const advice = [];

    // 온도 기반 조언
    if (weather.temperature !== null) {
      if (weather.temperature >= 30) {
        advice.push("매우 더우니 충분한 수분 섭취하세요");
      } else if (weather.temperature >= 25) {
        advice.push("더운 날씨입니다. 시원한 곳에서 휴식하세요");
      } else if (weather.temperature <= 0) {
        advice.push("매우 추우니 따뜻하게 입으세요");
      } else if (weather.temperature <= 10) {
        advice.push("쌀쌀하니 겉옷을 준비하세요");
      }
    }

    // 날씨 상태 기반 조언
    if (weather.condition) {
      switch (weather.condition.toLowerCase()) {
        case "rain":
        case "drizzle":
          advice.push("비가 오니 우산을 챙기세요");
          break;
        case "snow":
          advice.push("눈이 오니 미끄럼 주의하세요");
          break;
        case "thunderstorm":
          advice.push("낙뢰 주의 외출을 삼가세요");
          break;
        case "mist":
        case "fog":
          advice.push("안개가 있으니 운전 시 주의하세요");
          break;
      }
    }

    // 바람 기반 조언
    if (weather.windSpeed && weather.windSpeed > 7) {
      advice.push("바람이 강하니 외출 시 주의하세요");
    }

    // 습도 기반 조언
    if (weather.humidity) {
      if (weather.humidity >= 80) {
        advice.push("습도가 높으니 불쾌지수에 주의하세요");
      } else if (weather.humidity <= 30) {
        advice.push("건조하니 수분 보충과 보습에 신경쓰세요");
      }
    }

    return advice.length > 0 ? advice.join(". ") + "." : null;
  }

  // ===== 🧪 레거시 호환성 메서드들 =====

  /**
   * 📤 레거시 메시지 전송 (호환성 유지)
   * @deprecated BaseRenderer.sendSafeMessage 사용 권장
   */
  async sendMessage(chatId, text, keyboard, messageId) {
    try {
      const options = {
        reply_markup: keyboard,
        parse_mode: this.config.defaultParseMode,
      };

      if (messageId) {
        return await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        return await this.bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      this.warn("레거시 메시지 전송 실패, 안전 모드로 전환", error);

      // 안전한 전송으로 폴백
      const ctx = {
        chat: { id: chatId },
        callbackQuery: messageId
          ? { message: { message_id: messageId } }
          : null,
      };

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }
  }
}

module.exports = WeatherRenderer;
