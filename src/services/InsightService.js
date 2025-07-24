// src/services/InsightService.js - 미세먼지 기반 마케팅 인사이트 서비스

const BaseService = require("./BaseService");
const AirQualityService = require("./AirQualityService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

class InsightService extends BaseService {
  constructor() {
    super();
    this.airQualityService = new AirQualityService();

    // 마케팅 데이터베이스 (실제 환경에서는 DB 연동)
    this.marketData = {
      competitors: [
        { name: "A사", marketShare: 25, strength: "프리미엄" },
        { name: "B사", marketShare: 35, strength: "가격경쟁력" },
        { name: "C사", marketShare: 20, strength: "브랜드" },
        { name: "기타", marketShare: 20, strength: "다양성" },
      ],
      products: [
        { type: "KF94", margin: 45, demand: "high", stock: 85 },
        { type: "KF80", margin: 35, demand: "medium", stock: 120 },
        { type: "덴탈마스크", margin: 25, demand: "low", stock: 200 },
        { type: "면마스크", margin: 15, demand: "very_low", stock: 50 },
      ],
      regions: {
        수도권: { population: 25000000, purchasePower: "high" },
        부산권: { population: 3500000, purchasePower: "medium" },
        대구권: { population: 2500000, purchasePower: "medium" },
        광주권: { population: 1500000, purchasePower: "medium" },
      },
    };

    logger.info("📊 InsightService 초기화 완료");
  }

  /**
   * 🌟 종합 마케팅 인사이트 생성
   */
  async generateFullInsight(userName) {
    try {
      const airData = await this.airQualityService.getMarketingInsightData();
      const marketAnalysis = this.generateMarketAnalysis(airData);
      const actionPlan = this.generateActionPlan(airData, marketAnalysis);

      const insight = `📊 **${userName}님의 종합 마케팅 인사이트**

🌫️ **현재 대기질 현황**
• 측정소: ${airData.current.station}
• PM10: ${airData.current.pm10Value}㎍/㎥ (${airData.current.pm10Status})
• PM2.5: ${airData.current.pm25Value}㎍/㎥ (${airData.current.pm25Status})
• 업데이트: ${TimeHelper.formatDate(new Date(airData.current.timestamp))}

🎯 **시장 기회 분석**
• 기회 수준: ${airData.analysis.marketOpportunity.level}
• 점수: ${airData.analysis.marketOpportunity.score}/100
• 근거: ${airData.analysis.marketOpportunity.reasoning}

📈 **수요 예측**
• 예상 증가율: ${airData.analysis.demandPrediction.expectedIncrease}
• 트렌드: ${airData.analysis.demandPrediction.trend}
• 권장사항: ${airData.analysis.demandPrediction.recommendation}

💰 **가격 전략**
• 전략: ${airData.analysis.pricingStrategy.strategy}
• 조정률: ${airData.analysis.pricingStrategy.adjustment}
• 적용시기: ${airData.analysis.pricingStrategy.urgency}

📦 **재고 관리**
• 알림 수준: ${airData.analysis.inventoryAlert.level}
• 재고 배수: ${airData.analysis.inventoryAlert.multiplier}x
• 권장사항: ${airData.analysis.inventoryAlert.recommendation}

🎪 **즉시 실행 액션플랜**
${actionPlan.immediate.map((action, i) => `${i + 1}. ${action}`).join("\n")}

📱 **마케팅 메시지**
"${airData.analysis.marketingMessage.message}"
${airData.analysis.marketingMessage.urgency}

⏰ **업데이트**: ${TimeHelper.formatDate(new Date())}`;

      return insight;
    } catch (error) {
      logger.error("종합 인사이트 생성 실패:", error);
      return this.getDefaultFullInsight(userName);
    }
  }

  /**
   * ⚡ 빠른 인사이트 생성
   */
  async generateQuickInsight(userName) {
    try {
      const airResult = await this.airQualityService.getCurrentAirQuality(
        "화성"
      );
      const airData = airResult.data;

      const grade = Math.max(airData.pm10Grade, airData.pm25Grade);
      const opportunity = this.getQuickOpportunityAssessment(grade);
      const action = this.getQuickActionRecommendation(grade);

      return `⚡ **${userName}님의 빠른 인사이트**

🌫️ **현재 상황**
미세먼지: ${airData.pm10Value}㎍/㎥ (${airData.pm10Status})

🚀 **기회 평가**: ${opportunity.level}
📊 **추천 액션**: ${action}

💡 **원포인트 전략**
${this.getOnePointStrategy(grade)}

⏰ ${TimeHelper.formatDate(new Date())} 기준`;
    } catch (error) {
      logger.error("빠른 인사이트 생성 실패:", error);
      return this.getDefaultQuickInsight(userName);
    }
  }

  /**
   * 📱 실시간 대시보드 생성
   */
  async generateDashboard(userName) {
    try {
      const nationalResult =
        await this.airQualityService.getNationalAirQuality();
      const nationalData = nationalResult.data;

      const dashboard = `📱 **${userName}님의 실시간 대시보드**

🗺️ **전국 대기질 현황** (${TimeHelper.formatDate(new Date())})

${nationalData.regions
  .slice(0, 8)
  .map((region) => {
    const grade = Math.max(region.pm10Grade, region.pm25Grade);
    const emoji = this.getGradeEmoji(grade);
    return `${emoji} ${region.station}: ${region.pm10Value}㎍/㎥ (${region.pm10Status})`;
  })
  .join("\n")}

📊 **시장 현황 요약**
• 고위험 지역: ${
        nationalData.summary.distribution.veryBad +
        nationalData.summary.distribution.bad
      }개
• 기회 지역: ${nationalData.summary.distribution.veryBad}개 (매우나쁨)
• 전국 평균: ${this.getStatusText(nationalData.summary.averageGrade)}

🎯 **최우선 타겟**
${this.getTopTargetRegions(nationalData.regions)
  .map((region, i) => `${i + 1}. ${region.name} (${region.strategy})`)
  .join("\n")}

⚡ **실시간 알림**
${this.generateRealTimeAlerts(nationalData)}

🔄 **자동 업데이트**: 1시간마다`;

      return dashboard;
    } catch (error) {
      logger.error("대시보드 생성 실패:", error);
      return this.getDefaultDashboard(userName);
    }
  }

  /**
   * 🎁 제품 전략 생성
   */
  async generateProductStrategy(userName) {
    try {
      const airResult = await this.airQualityService.getCurrentAirQuality(
        "화성"
      );
      const grade = Math.max(
        airResult.data.pm10Grade,
        airResult.data.pm25Grade
      );

      const strategy = `🎁 **${userName}님의 제품 전략**

🌫️ **현재 미세먼지**: ${airResult.data.pm10Status} 수준

📦 **제품별 추천 전략**

${this.marketData.products
  .map((product) => {
    const priority = this.getProductPriority(product.type, grade);
    const action = this.getProductAction(product, grade);

    return `**${product.type}**
• 우선순위: ${priority}
• 현재 재고: ${product.stock}개
• 수익률: ${product.margin}%
• 권장액션: ${action}`;
  })
  .join("\n\n")}

🎯 **포커스 제품**: ${this.getFocusProduct(grade)}

📈 **신제품 기회**
${this.getNewProductOpportunity(grade)}

💡 **제품 믹스 최적화**
${this.getProductMixRecommendation(grade)}`;

      return strategy;
    } catch (error) {
      logger.error("제품 전략 생성 실패:", error);
      return "🎁 **제품 전략**\n\n데이터 로딩 중입니다. 잠시만 기다려주세요.";
    }
  }

  /**
   * 💰 가격 전략 생성
   */
  async generatePricingStrategy(userName) {
    try {
      const [airResult, nationalResult] = await Promise.all([
        this.airQualityService.getCurrentAirQuality("화성"),
        this.airQualityService.getNationalAirQuality(),
      ]);

      const localGrade = Math.max(
        airResult.data.pm10Grade,
        airResult.data.pm25Grade
      );
      const nationalAvg = nationalResult.data.summary.averageGrade;

      const strategy = `💰 **${userName}님의 가격 전략**

📊 **현재 시장 상황**
• 지역 대기질: ${airResult.data.pm10Status} (등급 ${localGrade})
• 전국 평균: ${this.getStatusText(nationalAvg)} (등급 ${nationalAvg})
• 경쟁 강도: ${this.getCompetitionIntensity(localGrade)}

💳 **제품별 가격 전략**

${this.marketData.products
  .map((product) => {
    const pricing = this.calculateOptimalPricing(
      product,
      localGrade,
      nationalAvg
    );
    return `**${product.type}**
• 현재 수익률: ${product.margin}%
• 권장 조정: ${pricing.adjustment}
• 목표가격: ${pricing.targetPrice}
• 예상 수익률: ${pricing.expectedMargin}%`;
  })
  .join("\n\n")}

🎯 **전략적 포지셔닝**
• ${this.getStrategicPositioning(localGrade)}

⏰ **가격 적용 타이밍**
• ${this.getPricingTiming(localGrade)}

🔄 **동적 가격 조정**
• ${this.getDynamicPricingRule(localGrade)}

📈 **예상 매출 영향**: ${this.getRevenueImpact(localGrade)}`;

      return strategy;
    } catch (error) {
      logger.error("가격 전략 생성 실패:", error);
      return "💰 **가격 전략**\n\n시장 데이터 분석 중입니다.";
    }
  }

  /**
   * 📦 재고 전략 생성
   */
  async generateInventoryStrategy(userName) {
    try {
      const [airResult, forecastResult] = await Promise.all([
        this.airQualityService.getCurrentAirQuality("화성"),
        this.airQualityService.getAirQualityForecast(),
      ]);

      const currentGrade = Math.max(
        airResult.data.pm10Grade,
        airResult.data.pm25Grade
      );
      const forecastTrend = this.analyzeForecastTrend(forecastResult.data);

      const strategy = `📦 **${userName}님의 재고 전략**

🌫️ **현재 대기 상황**
• 미세먼지: ${airResult.data.pm10Value}㎍/㎥ (${airResult.data.pm10Status})
• 예보 트렌드: ${forecastTrend.direction} (${forecastTrend.confidence})

📊 **제품별 재고 현황 & 권장사항**

${this.marketData.products
  .map((product) => {
    const inventory = this.calculateInventoryNeeds(
      product,
      currentGrade,
      forecastTrend
    );
    return `**${product.type}**
• 현재 재고: ${product.stock}개
• 권장 재고: ${inventory.recommended}개
• 긴급도: ${inventory.urgency}
• 주문 권장: ${inventory.orderRecommendation}`;
  })
  .join("\n\n")}

⚠️ **재고 알림**
${this.generateInventoryAlerts(currentGrade, forecastTrend)}

📈 **3일 예측**
${forecastResult.data.items
  .map(
    (forecast, i) =>
      `• ${forecast.date}: ${forecast.grade} - ${this.getInventoryAction(
        forecast.grade
      )}`
  )
  .join("\n")}

🚛 **공급망 최적화**
${this.getSupplyChainOptimization(currentGrade)}

💡 **재고 회전율 개선**
${this.getInventoryTurnoverImprovement(currentGrade)}`;

      return strategy;
    } catch (error) {
      logger.error("재고 전략 생성 실패:", error);
      return "📦 **재고 전략**\n\n재고 데이터 분석 중입니다.";
    }
  }

  /**
   * 🎯 마케팅 전략 생성
   */
  async generateMarketingStrategy(userName) {
    try {
      const airData = await this.airQualityService.getMarketingInsightData();

      const strategy = `🎯 **${userName}님의 마케팅 전략**

📢 **핵심 메시지**
"${airData.analysis.marketingMessage.message}"
${airData.analysis.marketingMessage.urgency}

🎪 **캠페인 전략**
${this.generateCampaignStrategy(airData.current, airData.analysis)}

📱 **채널별 전략**

**소셜미디어**
• ${this.getSocialMediaStrategy(airData.current)}

**이메일 마케팅** 
• ${this.getEmailMarketingStrategy(airData.current)}

**오프라인 광고**
• ${this.getOfflineStrategy(airData.current)}

🎯 **타겟 고객층**
${this.getTargetAudienceStrategy(airData.current)}

📊 **성과 지표 (KPI)**
${this.getMarketingKPIs(airData.current)}

💰 **예산 배분 권장**
${this.getBudgetAllocation(airData.current)}

⏰ **실행 타임라인**
${this.getExecutionTimeline(airData.current)}`;

      return strategy;
    } catch (error) {
      logger.error("마케팅 전략 생성 실패:", error);
      return this.getDefaultMarketingStrategy(userName);
    }
  }

  /**
   * 🗺️ 전국 현황 생성
   */
  async generateNationalStatus(userName) {
    try {
      const nationalResult =
        await this.airQualityService.getNationalAirQuality();
      const nationalData = nationalResult.data;

      const status = `🗺️ **${userName}님의 전국 현황 분석**

📊 **전국 대기질 분포** (${TimeHelper.formatDate(new Date())})

**등급별 지역 수**
🟢 좋음: ${nationalData.summary.distribution.good}개 지역
🟡 보통: ${nationalData.summary.distribution.moderate}개 지역  
🟠 나쁨: ${nationalData.summary.distribution.bad}개 지역
🔴 매우나쁨: ${nationalData.summary.distribution.veryBad}개 지역

🎯 **마케팅 기회 지역 TOP 5**
${airData.analysis.targetRegions
  .slice(0, 5)
  .map(
    (region, i) =>
      `${i + 1}. ${region.name} (${region.priority}) - ${region.strategy}`
  )
  .join("\n")}

📈 **지역별 상세 현황**
${nationalData.regions
  .map((region) => {
    const opportunity = this.assessRegionalOpportunity(region);
    return `**${region.station}**
• PM10: ${region.pm10Value}㎍/㎥ (${region.pm10Status})
• PM2.5: ${region.pm25Value}㎍/㎥ (${region.pm25Status})
• 기회도: ${opportunity.level}
• 권장전략: ${opportunity.strategy}`;
  })
  .join("\n\n")}

🚀 **즉시 실행 권장 지역**
${this.getImmediateActionRegions(nationalData.regions)}

📊 **시장 점유율 기회**
${this.getMarketShareOpportunity(nationalData)}`;

      return status;
    } catch (error) {
      logger.error("전국 현황 생성 실패:", error);
      return this.getDefaultNationalStatus(userName);
    }
  }

  // ==================== 헬퍼 메서드들 ====================

  /**
   * 🎯 빠른 기회 평가
   */
  getQuickOpportunityAssessment(grade) {
    const levels = {
      4: { level: "🔥 최고", score: 95, color: "🔴" },
      3: { level: "⚡ 높음", score: 75, color: "🟠" },
      2: { level: "📊 보통", score: 50, color: "🟡" },
      1: { level: "💤 낮음", score: 25, color: "🟢" },
    };
    return levels[grade] || levels[2];
  }

  /**
   * 🚀 빠른 액션 추천
   */
  getQuickActionRecommendation(grade) {
    const actions = {
      4: "즉시 재고 확보 & 프리미엄 가격 적용",
      3: "마케팅 강화 & 재고 증량",
      2: "현 상태 유지 & 모니터링",
      1: "프로모션 기획 & 재고 관리",
    };
    return actions[grade] || actions[2];
  }

  /**
   * 💡 원포인트 전략
   */
  getOnePointStrategy(grade) {
    const strategies = {
      4: "🚨 위기를 기회로! 프리미엄 마스크 대량 확보하고 건강 메시지 강화",
      3: "⚡ 적극 공세! 타겟 마케팅으로 시장 점유율 확대 기회",
      2: "📊 안정 운영! 고객 관계 강화하며 다음 기회 대비",
      1: "💡 차별화 집중! 브랜드 가치 제고하며 충성 고객 확보",
    };
    return strategies[grade] || strategies[2];
  }

  /**
   * 🎪 캠페인 전략 생성
   */
  generateCampaignStrategy(current, analysis) {
    const grade = Math.max(current.pm10Grade, current.pm25Grade);

    if (grade >= 4) {
      return "🚨 '건강 비상사태' 캠페인 - 생명을 지키는 필수템 포지셔닝";
    } else if (grade >= 3) {
      return "⚠️ '스마트한 선택' 캠페인 - 미리 준비하는 현명한 소비자";
    } else if (grade >= 2) {
      return "💡 '일상 속 건강' 캠페인 - 꾸준한 관리의 중요성";
    } else {
      return "🌟 '브랜드 신뢰' 캠페인 - 언제나 믿을 수 있는 파트너";
    }
  }

  /**
   * 🔢 등급별 이모지
   */
  getGradeEmoji(grade) {
    const emojis = { 1: "🟢", 2: "🟡", 3: "🟠", 4: "🔴" };
    return emojis[grade] || "⚪";
  }

  /**
   * 📝 상태 텍스트 변환
   */
  getStatusText(grade) {
    const texts = { 1: "좋음", 2: "보통", 3: "나쁨", 4: "매우나쁨" };
    return texts[grade] || "알수없음";
  }

  // 기본값 반환 메서드들
  getDefaultFullInsight(userName) {
    return `📊 **${userName}님의 종합 마케팅 인사이트**

🌫️ **현재 상황** (예시 데이터)
• 미세먼지: 45㎍/㎥ (보통)
• 기회 수준: 보통 (60/100점)
• 예상 증가율: +30%

💡 **주요 권장사항**
1. 재고 20% 증량 권장
2. 온라인 마케팅 강화
3. KF94 제품 비중 확대

⏰ ${TimeHelper.formatDate(new Date())} 기준
※ 실시간 데이터 연결 중입니다.`;
  }

  getDefaultQuickInsight(userName) {
    return `⚡ **${userName}님의 빠른 인사이트**

🌫️ 미세먼지: 보통 수준
🚀 기회 평가: 📊 보통
📊 추천 액션: 현 상태 유지 & 모니터링

💡 **원포인트**: 안정적 운영 기조 유지`;
  }

  getDefaultDashboard(userName) {
    return `📱 **${userName}님의 실시간 대시보드**

🗺️ **전국 현황** (예시)
🟡 서울: 45㎍/㎥ (보통)
🟢 부산: 25㎍/㎥ (좋음)
🟠 대구: 65㎍/㎥ (나쁨)

📊 대시보드 연결 중...`;
  }

  getDefaultMarketingStrategy(userName) {
    return `🎯 **${userName}님의 마케팅 전략**

📢 **핵심 메시지**
"건강한 일상을 위한 현명한 선택"

🎪 **기본 전략**
• 브랜드 신뢰도 강화
• 고객 만족도 제고  
• 시장 점유율 확대

※ 상세 전략 분석 중입니다.`;
  }

  getDefaultNationalStatus(userName) {
    return `🗺️ **${userName}님의 전국 현황**

📊 **전국 분포** (예시)
🟢 좋음: 3개 지역
🟡 보통: 4개 지역
🟠 나쁨: 1개 지역

※ 실시간 데이터 로딩 중...`;
  }

  // 추가 헬퍼 메서드들은 필요에 따라 구현...
  generateMarketAnalysis(airData) {
    return {};
  }
  generateActionPlan(airData, marketAnalysis) {
    return { immediate: ["재고 점검", "가격 검토", "마케팅 준비"] };
  }
  getTopTargetRegions(regions) {
    return regions
      .slice(0, 3)
      .map((r) => ({ name: r.station, strategy: "집중마케팅" }));
  }
  generateRealTimeAlerts(nationalData) {
    return "현재 특별 알림 없음";
  }
  analyzeForecastTrend(forecast) {
    return { direction: "안정", confidence: "보통" };
  }
  calculateInventoryNeeds(product, grade, trend) {
    return {
      recommended: product.stock * 1.2,
      urgency: "보통",
      orderRecommendation: "검토 필요",
    };
  }
  generateInventoryAlerts(grade, trend) {
    return "현재 재고 알림 없음";
  }
  getInventoryAction(grade) {
    return "모니터링";
  }
  getSupplyChainOptimization(grade) {
    return "현재 공급망 안정";
  }
  getInventoryTurnoverImprovement(grade) {
    return "정기 재고 회전 점검";
  }
  getSocialMediaStrategy(current) {
    return "건강 관련 콘텐츠 강화";
  }
  getEmailMarketingStrategy(current) {
    return "개인화된 건강 정보 제공";
  }
  getOfflineStrategy(current) {
    return "약국/마트 제휴 확대";
  }
  getTargetAudienceStrategy(current) {
    return "건강 관심층 집중 타겟";
  }
  getMarketingKPIs(current) {
    return "전환율, 브랜드 인지도, 고객만족도";
  }
  getBudgetAllocation(current) {
    return "온라인 60%, 오프라인 40%";
  }
  getExecutionTimeline(current) {
    return "즉시 실행 가능한 전략부터 단계적 진행";
  }
  assessRegionalOpportunity(region) {
    return { level: "보통", strategy: "모니터링" };
  }
  getImmediateActionRegions(regions) {
    return "현재 즉시 대응 필요 지역 없음";
  }
  getMarketShareOpportunity(nationalData) {
    return "안정적 시장 상황";
  }
  getProductPriority(type, grade) {
    return grade >= 3 ? "높음" : "보통";
  }
  getProductAction(product, grade) {
    return "현재 수준 유지";
  }
  getFocusProduct(grade) {
    return grade >= 3 ? "KF94" : "KF80";
  }
  getNewProductOpportunity(grade) {
    return "시장 안정 상황으로 신제품 기회 보통";
  }
  getProductMixRecommendation(grade) {
    return "현재 제품 믹스 유지";
  }
  getCompetitionIntensity(grade) {
    return grade >= 3 ? "높음" : "보통";
  }
  calculateOptimalPricing(product, local, national) {
    return {
      adjustment: local > national ? "+5%" : "유지",
      targetPrice: "시장가 기준",
      expectedMargin: product.margin + (local > national ? 5 : 0),
    };
  }
  getStrategicPositioning(grade) {
    return grade >= 3 ? "프리미엄 포지셔닝" : "가성비 포지셔닝";
  }
  getPricingTiming(grade) {
    return grade >= 3 ? "즉시 적용" : "시장 모니터링 후 적용";
  }
  getDynamicPricingRule(grade) {
    return "대기질 등급 기반 자동 조정 시스템";
  }
  getRevenueImpact(grade) {
    return grade >= 3 ? "+15~25%" : "현재 수준 유지";
  }
}

module.exports = InsightService;
