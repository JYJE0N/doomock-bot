// src/services/AirQualityService.js - 한국환경공단 대기질 API 서비스

const axios = require("axios");
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class AirQualityService extends BaseService {
  constructor() {
    super();
    this.apiKey = process.env.AIR_KOREA_API_KEY;
    this.baseUrl = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc";

    // 캐시 설정 (대기질 데이터는 1시간마다 갱신)
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1시간

    // 주요 측정소 매핑
    this.stations = {
      서울: [
        "종로구",
        "중구",
        "용산구",
        "성동구",
        "광진구",
        "동대문구",
        "중랑구",
        "성북구",
      ],
      경기: ["수원", "고양", "용인", "성남", "부천", "화성", "안산", "안양"],
      인천: [
        "연수구",
        "남동구",
        "부평구",
        "계양구",
        "서구",
        "중구",
        "동구",
        "강화군",
      ],
      부산: [
        "중구",
        "서구",
        "동구",
        "영도구",
        "부산진구",
        "동래구",
        "남구",
        "북구",
      ],
      대구: [
        "중구",
        "동구",
        "서구",
        "남구",
        "북구",
        "수성구",
        "달서구",
        "달성군",
      ],
      대전: ["동구", "중구", "서구", "유성구", "대덕구"],
      광주: ["동구", "서구", "남구", "북구", "광산구"],
      울산: ["중구", "남구", "동구", "북구", "울주군"],
    };

    logger.info(
      `🌬️ AirQualityService 초기화 (API 키: ${this.apiKey ? "설정됨" : "없음"})`
    );
  }

  /**
   * 🌫️ 실시간 대기질 현황 조회
   */
  async getCurrentAirQuality(station = "화성") {
    try {
      const cacheKey = `current_${station}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }

      if (!this.apiKey) {
        logger.warn("대기질 API 키가 설정되지 않음, 기본값 반환");
        return {
          success: false,
          error: "대기질 API 키가 설정되지 않았습니다.",
          data: this.getDefaultAirQualityData(station),
        };
      }

      const url = `${this.baseUrl}/getMsrstnAcctoRltmMesureDnsty`;
      const params = {
        serviceKey: this.apiKey,
        returnType: "json",
        numOfRows: 1,
        pageNo: 1,
        stationName: station,
        dataTerm: "DAILY",
        ver: "1.0",
      };

      logger.debug(`대기질 API 요청: ${station}`);
      const response = await axios.get(url, { params, timeout: 10000 });

      if (response.data.response.header.resultCode !== "00") {
        throw new Error(`API 오류: ${response.data.response.header.resultMsg}`);
      }

      const items = response.data.response.body.items;
      if (!items || items.length === 0) {
        throw new Error("대기질 데이터를 찾을 수 없습니다.");
      }

      const airData = this.formatAirQualityData(items[0], station);
      this.setCache(cacheKey, airData);

      logger.info(`대기질 조회 성공: ${station}`);
      return { success: true, data: airData, cached: false };
    } catch (error) {
      logger.error("대기질 조회 실패:", error.message);
      return {
        success: false,
        error: this.formatError(error),
        data: this.getDefaultAirQualityData(station),
      };
    }
  }

  /**
   * 🗺️ 전국 주요 지역 대기질 현황
   */
  async getNationalAirQuality() {
    try {
      const cacheKey = "national_air_quality";
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }

      const majorStations = [
        "서울",
        "부산",
        "대구",
        "인천",
        "광주",
        "대전",
        "울산",
        "화성",
      ];
      const results = [];

      for (const station of majorStations) {
        const result = await this.getCurrentAirQuality(station);
        if (result.success) {
          results.push(result.data);
        }
        // API 요청 간격 조절
        await this.delay(200);
      }

      const nationalData = {
        timestamp: TimeHelper.getKoreaTimeString(),
        regions: results,
        summary: this.generateNationalSummary(results),
      };

      this.setCache(cacheKey, nationalData, 30 * 60 * 1000); // 30분 캐시
      return { success: true, data: nationalData, cached: false };
    } catch (error) {
      logger.error("전국 대기질 조회 실패:", error.message);
      return {
        success: false,
        error: error.message,
        data: this.getDefaultNationalData(),
      };
    }
  }

  /**
   * 📊 대기질 예보 조회 (향후 3일)
   */
  async getAirQualityForecast() {
    try {
      const cacheKey = "air_quality_forecast";
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }

      const url = `${this.baseUrl}/getMinuDustFrcstDspth`;
      const today = TimeHelper.formatDate(new Date(), "YYYY-MM-DD");

      const params = {
        serviceKey: this.apiKey,
        returnType: "json",
        numOfRows: 10,
        pageNo: 1,
        searchDate: today,
        InformCode: "PM10",
      };

      const response = await axios.get(url, { params, timeout: 10000 });

      if (response.data.response.header.resultCode !== "00") {
        throw new Error(
          `예보 API 오류: ${response.data.response.header.resultMsg}`
        );
      }

      const items = response.data.response.body.items;
      const forecastData = this.formatForecastData(items);

      this.setCache(cacheKey, forecastData, 4 * 60 * 60 * 1000); // 4시간 캐시
      return { success: true, data: forecastData, cached: false };
    } catch (error) {
      logger.error("대기질 예보 조회 실패:", error.message);
      return {
        success: false,
        error: error.message,
        data: this.getDefaultForecastData(),
      };
    }
  }

  /**
   * 🎯 마케팅 인사이트 생성을 위한 대기질 분석
   */
  async getMarketingInsightData() {
    try {
      const [currentResult, nationalResult, forecastResult] = await Promise.all(
        [
          this.getCurrentAirQuality("화성"),
          this.getNationalAirQuality(),
          this.getAirQualityForecast(),
        ]
      );

      return {
        current: currentResult.data,
        national: nationalResult.data,
        forecast: forecastResult.data,
        analysis: this.generateMarketingAnalysis(
          currentResult.data,
          nationalResult.data,
          forecastResult.data
        ),
      };
    } catch (error) {
      logger.error("마케팅 인사이트 데이터 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📈 마케팅 분석 생성
   */
  generateMarketingAnalysis(current, national, forecast) {
    const analysis = {
      marketOpportunity: this.assessMarketOpportunity(current, national),
      demandPrediction: this.predictDemand(current, forecast),
      pricingStrategy: this.suggestPricing(current, national),
      inventoryAlert: this.generateInventoryAlert(current, forecast),
      marketingMessage: this.generateMarketingMessage(current),
      targetRegions: this.identifyTargetRegions(national),
      competitiveAdvantage: this.analyzeCompetitiveAdvantage(current, national),
    };

    return analysis;
  }

  /**
   * 🎯 시장 기회 평가
   */
  assessMarketOpportunity(current, national) {
    const pm10Level = current.pm10Grade;
    const pm25Level = current.pm25Grade;

    let opportunity = "보통";
    let score = 50;
    let reasoning = "";

    if (pm10Level >= 4 || pm25Level >= 4) {
      opportunity = "매우 높음";
      score = 90;
      reasoning = "매우 나쁨 수준의 미세먼지로 마스크 수요 폭증 예상";
    } else if (pm10Level >= 3 || pm25Level >= 3) {
      opportunity = "높음";
      score = 75;
      reasoning = "나쁨 수준의 미세먼지로 마스크 수요 증가";
    } else if (pm10Level >= 2 || pm25Level >= 2) {
      opportunity = "보통";
      score = 60;
      reasoning = "보통 수준의 미세먼지로 평상시 수요 유지";
    } else {
      opportunity = "낮음";
      score = 30;
      reasoning = "좋음 수준의 미세먼지로 수요 감소 예상";
    }

    return { level: opportunity, score, reasoning };
  }

  /**
   * 📊 수요 예측
   */
  predictDemand(current, forecast) {
    const currentGrade = Math.max(current.pm10Grade, current.pm25Grade);
    let demandMultiplier = 1;
    let trend = "유지";

    // 현재 상태 기반 기본 수요
    switch (currentGrade) {
      case 4:
        demandMultiplier = 3.5;
        break; // 매우 나쁨
      case 3:
        demandMultiplier = 2.2;
        break; // 나쁨
      case 2:
        demandMultiplier = 1.3;
        break; // 보통
      case 1:
        demandMultiplier = 0.8;
        break; // 좋음
    }

    // 예보 기반 트렌드 분석
    if (forecast && forecast.items && forecast.items.length > 0) {
      const avgForecastGrade =
        forecast.items.reduce((sum, item) => {
          return sum + this.parseGradeFromForecast(item.informGrade);
        }, 0) / forecast.items.length;

      if (avgForecastGrade > currentGrade) {
        trend = "증가";
        demandMultiplier *= 1.2;
      } else if (avgForecastGrade < currentGrade) {
        trend = "감소";
        demandMultiplier *= 0.9;
      }
    }

    return {
      multiplier: demandMultiplier,
      trend,
      expectedIncrease: `${Math.round((demandMultiplier - 1) * 100)}%`,
      recommendation: this.getDemandRecommendation(demandMultiplier, trend),
    };
  }

  /**
   * 💰 가격 전략 제안
   */
  suggestPricing(current, national) {
    const localGrade = Math.max(current.pm10Grade, current.pm25Grade);
    const nationalAvg = national.summary?.averageGrade || 2;

    let strategy = "유지";
    let adjustment = 0;
    let reasoning = "";

    if (localGrade >= 4) {
      strategy = "프리미엄";
      adjustment = 25;
      reasoning = "매우 나쁨 수준으로 프리미엄 가격 정책 적용";
    } else if (localGrade >= 3) {
      strategy = "상향";
      adjustment = 15;
      reasoning = "나쁨 수준으로 가격 상향 조정";
    } else if (localGrade < nationalAvg) {
      strategy = "경쟁";
      adjustment = -10;
      reasoning = "전국 평균보다 좋은 상황으로 경쟁가격 적용";
    }

    return {
      strategy,
      adjustment: `${adjustment > 0 ? "+" : ""}${adjustment}%`,
      reasoning,
      urgency: localGrade >= 3 ? "즉시 적용" : "검토 후 적용",
    };
  }

  /**
   * 📦 재고 알림 생성
   */
  generateInventoryAlert(current, forecast) {
    const currentGrade = Math.max(current.pm10Grade, current.pm25Grade);
    let alertLevel = "정상";
    let recommendation = "";
    let stockMultiplier = 1;

    if (currentGrade >= 4) {
      alertLevel = "긴급";
      stockMultiplier = 3;
      recommendation = "긴급 재고 확보 필요. KF94, KF80 마스크 대량 주문";
    } else if (currentGrade >= 3) {
      alertLevel = "주의";
      stockMultiplier = 2;
      recommendation = "재고 보충 권장. 일반용 마스크 추가 확보";
    } else if (currentGrade >= 2) {
      alertLevel = "양호";
      stockMultiplier = 1.2;
      recommendation = "현재 재고 수준 유지";
    } else {
      alertLevel = "여유";
      stockMultiplier = 0.8;
      recommendation = "재고 회전율 관리에 집중";
    }

    return {
      level: alertLevel,
      multiplier: stockMultiplier,
      recommendation,
      priority: currentGrade >= 3 ? "높음" : "보통",
    };
  }

  /**
   * 💬 마케팅 메시지 생성
   */
  generateMarketingMessage(current) {
    const grade = Math.max(current.pm10Grade, current.pm25Grade);
    const pm10Value = current.pm10Value;
    const pm25Value = current.pm25Value;

    let message = "";
    let urgency = "";
    let cta = "";

    switch (grade) {
      case 4:
        message = `🚨 매우 나쁨 주의보! 미세먼지 ${pm10Value}㎍/㎥`;
        urgency = "외출 시 반드시 마스크 착용하세요!";
        cta = "지금 바로 KF94 마스크 주문하기";
        break;
      case 3:
        message = `⚠️ 나쁨 단계 미세먼지 ${pm10Value}㎍/㎥`;
        urgency = "마스크 착용을 권장합니다";
        cta = "건강한 호흡을 위한 마스크 준비";
        break;
      case 2:
        message = `😐 보통 수준 미세먼지 ${pm10Value}㎍/㎥`;
        urgency = "민감한 분들은 마스크 준비";
        cta = "일상용 마스크 미리 준비하기";
        break;
      case 1:
        message = `😊 좋음 수준 미세먌지 ${pm10Value}㎍/㎥`;
        urgency = "쾌적한 하루 되세요";
        cta = "비상용 마스크 상시 구비";
        break;
    }

    return { message, urgency, cta, grade };
  }

  /**
   * 🎯 타겟 지역 식별
   */
  identifyTargetRegions(national) {
    if (!national.regions) return [];

    return national.regions
      .filter((region) => Math.max(region.pm10Grade, region.pm25Grade) >= 3)
      .sort(
        (a, b) =>
          Math.max(b.pm10Grade, b.pm25Grade) -
          Math.max(a.pm10Grade, a.pm25Grade)
      )
      .slice(0, 5)
      .map((region) => ({
        name: region.station,
        grade: Math.max(region.pm10Grade, region.pm25Grade),
        priority:
          region.pm10Grade >= 4 || region.pm25Grade >= 4 ? "최우선" : "우선",
        strategy: region.pm10Grade >= 4 ? "긴급 마케팅" : "집중 마케팅",
      }));
  }

  /**
   * ⚔️ 경쟁 우위 분석
   */
  analyzeCompetitiveAdvantage(current, national) {
    const localGrade = Math.max(current.pm10Grade, current.pm25Grade);
    const advantages = [];

    if (localGrade >= 3) {
      advantages.push("높은 수요로 인한 시장 기회");
      advantages.push("필수재 특성으로 가격 탄력성 낮음");
    }

    if (localGrade >= 4) {
      advantages.push("공급 부족 상황에서 선점 효과");
      advantages.push("브랜드 인지도 상승 기회");
    }

    return {
      advantages,
      threats: localGrade <= 1 ? ["수요 감소", "재고 과잉"] : [],
      recommendation: localGrade >= 3 ? "적극적 마케팅" : "수요 창출 마케팅",
    };
  }

  // ==================== 유틸리티 메서드들 ====================

  /**
   * 📊 대기질 데이터 포맷팅
   */
  formatAirQualityData(item, station) {
    return {
      station: station,
      timestamp: item.dataTime,
      pm10Value: parseInt(item.pm10Value) || 0,
      pm25Value: parseInt(item.pm25Value) || 0,
      pm10Grade: this.getGradeFromValue(item.pm10Value, "PM10"),
      pm25Grade: this.getGradeFromValue(item.pm25Value, "PM25"),
      pm10Status: this.getStatusText(
        this.getGradeFromValue(item.pm10Value, "PM10")
      ),
      pm25Status: this.getStatusText(
        this.getGradeFromValue(item.pm25Value, "PM25")
      ),
      o3Value: parseFloat(item.o3Value) || 0,
      no2Value: parseFloat(item.no2Value) || 0,
      coValue: parseFloat(item.coValue) || 0,
      so2Value: parseFloat(item.so2Value) || 0,
      khaiValue: parseInt(item.khaiValue) || 0,
      khaiGrade: parseInt(item.khaiGrade) || 1,
    };
  }

  /**
   * 📈 예보 데이터 포맷팅
   */
  formatForecastData(items) {
    if (!items || items.length === 0) {
      return this.getDefaultForecastData();
    }

    return {
      timestamp: TimeHelper.getKoreaTimeString(),
      items: items.slice(0, 3).map((item) => ({
        date: item.informData,
        grade: item.informGrade,
        cause: item.informCause,
        overview: item.informOverall,
      })),
    };
  }

  /**
   * 🌟 전국 현황 요약 생성
   */
  generateNationalSummary(regions) {
    if (!regions || regions.length === 0) return null;

    const grades = regions.map((r) => Math.max(r.pm10Grade, r.pm25Grade));
    const averageGrade =
      grades.reduce((sum, grade) => sum + grade, 0) / grades.length;

    const distribution = {
      good: grades.filter((g) => g === 1).length,
      moderate: grades.filter((g) => g === 2).length,
      bad: grades.filter((g) => g === 3).length,
      veryBad: grades.filter((g) => g === 4).length,
    };

    return {
      averageGrade: Math.round(averageGrade),
      totalRegions: regions.length,
      distribution,
      worstRegion: regions.reduce((prev, curr) =>
        Math.max(prev.pm10Grade, prev.pm25Grade) >
        Math.max(curr.pm10Grade, curr.pm25Grade)
          ? prev
          : curr
      ),
      bestRegion: regions.reduce((prev, curr) =>
        Math.max(prev.pm10Grade, prev.pm25Grade) <
        Math.max(curr.pm10Grade, curr.pm25Grade)
          ? prev
          : curr
      ),
    };
  }

  /**
   * 📊 농도값으로 등급 계산
   */
  getGradeFromValue(value, type) {
    const numValue = parseInt(value) || 0;

    if (type === "PM10") {
      if (numValue <= 30) return 1; // 좋음
      if (numValue <= 80) return 2; // 보통
      if (numValue <= 150) return 3; // 나쁨
      return 4; // 매우 나쁨
    } else if (type === "PM25") {
      if (numValue <= 15) return 1; // 좋음
      if (numValue <= 35) return 2; // 보통
      if (numValue <= 75) return 3; // 나쁨
      return 4; // 매우 나쁨
    }

    return 1;
  }

  /**
   * 📝 등급을 텍스트로 변환
   */
  getStatusText(grade) {
    const statusMap = {
      1: "좋음",
      2: "보통",
      3: "나쁨",
      4: "매우나쁨",
    };
    return statusMap[grade] || "알수없음";
  }

  /**
   * 📊 예보에서 등급 파싱
   */
  parseGradeFromForecast(gradeText) {
    if (!gradeText) return 2;

    if (gradeText.includes("좋음")) return 1;
    if (gradeText.includes("보통")) return 2;
    if (gradeText.includes("나쁨")) return gradeText.includes("매우") ? 4 : 3;

    return 2;
  }

  /**
   * 💡 수요 예측 권장사항
   */
  getDemandRecommendation(multiplier, trend) {
    if (multiplier >= 3) {
      return "재고 대폭 확대 및 긴급 주문 필요";
    } else if (multiplier >= 2) {
      return "재고 확충 및 공급업체 연락";
    } else if (multiplier >= 1.5) {
      return "평소보다 많은 재고 준비";
    } else if (multiplier < 1) {
      return "재고 관리 및 프로모션 고려";
    }
    return "현재 수준 유지";
  }

  /**
   * 📊 기본 대기질 데이터 (API 실패시)
   */
  getDefaultAirQualityData(station) {
    return {
      station: station,
      timestamp: TimeHelper.getKoreaTimeString(),
      pm10Value: 45,
      pm25Value: 25,
      pm10Grade: 2,
      pm25Grade: 2,
      pm10Status: "보통",
      pm25Status: "보통",
      o3Value: 0.05,
      no2Value: 0.03,
      coValue: 0.8,
      so2Value: 0.005,
      khaiValue: 75,
      khaiGrade: 2,
    };
  }

  /**
   * 📊 기본 전국 데이터
   */
  getDefaultNationalData() {
    const regions = [
      "서울",
      "부산",
      "대구",
      "인천",
      "광주",
      "대전",
      "울산",
      "화성",
    ].map((city) => ({
      ...this.getDefaultAirQualityData(city),
      pm10Value: 30 + Math.floor(Math.random() * 40),
      pm25Value: 15 + Math.floor(Math.random() * 25),
    }));

    return {
      timestamp: TimeHelper.getKoreaTimeString(),
      regions,
      summary: this.generateNationalSummary(regions),
    };
  }

  /**
   * 📊 기본 예보 데이터
   */
  getDefaultForecastData() {
    const today = new Date();
    const items = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      items.push({
        date: TimeHelper.formatDate(date),
        grade: "보통",
        cause: "대기 정체",
        overview: "전국 대부분 지역 보통 수준",
      });
    }

    return {
      timestamp: TimeHelper.getKoreaTimeString(),
      items,
    };
  }

  // 캐시 관리 메서드들
  setCache(key, data, timeout = this.cacheTimeout) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout,
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clearCache() {
    this.cache.clear();
    logger.info("대기질 캐시 초기화");
  }

  // 지연 함수
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 에러 포맷팅
  formatError(error) {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          return "대기질 API 키가 유효하지 않습니다.";
        case 404:
          return "측정소를 찾을 수 없습니다.";
        case 429:
          return "API 요청 한도를 초과했습니다.";
        default:
          return `대기질 정보를 가져올 수 없습니다: ${error.message}`;
      }
    }
    return "대기질 서비스에 일시적인 문제가 발생했습니다.";
  }

  /**
   * 🔍 서비스 상태 확인
   */
  async checkStatus() {
    try {
      if (!this.apiKey) {
        return { status: "error", message: "API 키 없음" };
      }

      const result = await this.getCurrentAirQuality("화성");

      return {
        status: result.success ? "ok" : "error",
        message: result.success ? "정상" : result.error,
        apiKey: this.apiKey ? "설정됨" : "없음",
        cacheSize: this.cache.size,
      };
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        apiKey: this.apiKey ? "설정됨" : "없음",
      };
    }
  }
}

module.exports = AirQualityService;
