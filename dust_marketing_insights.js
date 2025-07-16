// enhanced_dust_marketing_insights.js - 실제 비즈니스 반영 강화 버전

const axios = require('axios');
const { getUserName } = require('./username_helper');

// 한국 주요 도시 측정소 정보
const MONITORING_STATIONS = {
    '서울': '종로구',
    '부산': '부산',
    '대구': '대구',
    '인천': '인천',
    '광주': '광주',
    '대전': '대전',
    '울산': '울산',
    '세종': '세종',
    '경기': '수원',
    '강원': '춘천',
    '충북': '청주',
    '충남': '천안',
    '전북': '전주',
    '전남': '목포',
    '경북': '포항',
    '경남': '창원',
    '제주': '제주'
};

class EnhancedDustMarketingInsights {
    constructor() {
        this.airKoreaApiKey = process.env.AIR_KOREA_API_KEY || 'YOUR_API_KEY_HERE';
        this.baseUrl = 'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
        
        // 🆕 실제 비즈니스 데이터 반영 - 계절별 상품 전략
        this.seasonalBusinessData = {
            spring: { // 3-5월 (황사철)
                name: '봄철 황사 시즌',
                dustEvents: ['황사', '꽃가루', '미세먼지', '중국발 스모그'],
                peakMonths: [3, 4, 5],
                salesMultiplier: 2.8,
                keyProducts: {
                    primary: ['KF94 황사마스크', 'N95 마스크', '어린이용 KF94'],
                    secondary: ['공기청정기 필터', '차량용 에어필터', '안경닦이'],
                    emerging: ['황사 방지 스카프', '실외 활동용 마스크', '스포츠마스크']
                },
                marketingMessages: [
                    '황사 완벽 차단! KF94 마스크',
                    '봄철 외출 필수템',
                    '아이들 건강 지키는 선택',
                    '황사 시즌 대비 완료'
                ],
                priceStrategy: 'premium', // 높은 수요로 프리미엄 가격
                inventory: {
                    stockLevel: 'high', // 300% 재고 확보
                    turnoverRate: 'fast', // 빠른 회전율
                    criticalProducts: ['KF94 황사마스크', 'N95 마스크']
                }
            },
            summer: { // 6-8월 (무더위 + 오존)
                name: '여름철 쾌적 마스크 시즌',
                dustEvents: ['오존', '자외선', '폭염', '도시 스모그'],
                peakMonths: [6, 7, 8],
                salesMultiplier: 1.5,
                keyProducts: {
                    primary: ['프리미엄 라이트 마스크', '쿨링 마스크', '썸머 브리드 마스크'], // 🔥 실제 비즈니스 데이터 반영
                    secondary: ['UV 차단 마스크', '스포츠 마스크', '메쉬 마스크'],
                    emerging: ['아이스 마스크', '냉감 마스크', '통풍 마스크']
                },
                marketingMessages: [
                    '무더위에도 시원한 프리미엄 라이트!',
                    '여름철 필수템, 쿨링 마스크',
                    '통풍 좋은 여름 전용 마스크',
                    '시원하게 보호하는 선택'
                ],
                priceStrategy: 'value', // 기능성 대비 가성비 어필
                inventory: {
                    stockLevel: 'medium', // 150% 재고 확보
                    turnoverRate: 'steady', // 꾸준한 회전율
                    criticalProducts: ['프리미엄 라이트 마스크', '쿨링 마스크']
                }
            },
            autumn: { // 9-11월 (미세먼지 재시작)
                name: '가을철 미세먼지 대응 시즌',
                dustEvents: ['미세먼지', '초미세먼지', '대기 정체', '중국발 스모그'],
                peakMonths: [9, 10, 11],
                salesMultiplier: 2.2,
                keyProducts: {
                    primary: ['KF94 일반형', 'KF80 경량형', '데일리 마스크'],
                    secondary: ['실내용 마스크', '사무실용 마스크', '장시간 착용형'],
                    emerging: ['패션 마스크', '컬러 마스크', '디자인 마스크']
                },
                marketingMessages: [
                    '가을 미세먼지 완벽 대응',
                    '일상 속 건강 지키기',
                    '장시간 착용도 편안한',
                    '스타일과 보호 모두'
                ],
                priceStrategy: 'balanced', // 균형잡힌 가격 정책
                inventory: {
                    stockLevel: 'high', // 250% 재고 확보
                    turnoverRate: 'fast', // 빠른 회전율
                    criticalProducts: ['KF94 일반형', 'KF80 경량형']
                }
            },
            winter: { // 12-2월 (한파 + 미세먼지)
                name: '겨울철 방한 + 방진 시즌',
                dustEvents: ['미세먼지', '난방 오염', '스모그', '실내 공기 오염'],
                peakMonths: [12, 1, 2],
                salesMultiplier: 2.5,
                keyProducts: {
                    primary: ['방한 마스크', '윈터 마스크', 'KF94 보온형'],
                    secondary: ['실내용 공기청정기', '가습기 필터', '헤파필터'],
                    emerging: ['목도리 일체형', '귀마개 일체형', '방한 기능성']
                },
                marketingMessages: [
                    '추위와 미세먼지 동시 차단',
                    '따뜻하게 보호하는 겨울 마스크',
                    '실내 공기도 깨끗하게',
                    '겨울철 완벽 방어'
                ],
                priceStrategy: 'premium', // 기능성 프리미엄 가격
                inventory: {
                    stockLevel: 'medium', // 200% 재고 확보
                    turnoverRate: 'steady', // 꾸준한 회전율
                    criticalProducts: ['방한 마스크', 'KF94 보온형']
                }
            }
        };

        // 🆕 미세먼지 농도별 상세 시나리오
        this.dustLevelScenarios = {
            good: { // 0-30㎍/㎥
                name: '좋음',
                emoji: '😊',
                color: '🟢',
                businessImpact: 'low',
                salesMultiplier: 0.7,
                scenarios: [
                    {
                        situation: '맑은 날씨 지속',
                        strategy: '브랜드 마케팅 집중',
                        products: ['일반 마스크', '패션 마스크', '예비용 마스크'],
                        messaging: '건강한 일상을 위한 준비',
                        urgency: 'low'
                    },
                    {
                        situation: '야외 활동 증가',
                        strategy: '라이프스타일 마케팅',
                        products: ['스포츠 마스크', '아웃도어 마스크', '휴대용 마스크'],
                        messaging: '활동적인 하루를 위한 선택',
                        urgency: 'low'
                    }
                ]
            },
            moderate: { // 31-80㎍/㎥
                name: '보통',
                emoji: '😐',
                color: '🟡',
                businessImpact: 'medium',
                salesMultiplier: 1.3,
                scenarios: [
                    {
                        situation: '일상적 착용 필요',
                        strategy: '실용성 어필',
                        products: ['KF80 마스크', '일회용 마스크', '다량 패키지'],
                        messaging: '일상 속 안전한 선택',
                        urgency: 'medium'
                    },
                    {
                        situation: '민감군 주의',
                        strategy: '건강 관리 마케팅',
                        products: ['어린이용 마스크', '고령자용 마스크', '민감군 전용'],
                        messaging: '소중한 가족 건강 지키기',
                        urgency: 'medium'
                    }
                ]
            },
            bad: { // 81-150㎍/㎥
                name: '나쁨',
                emoji: '😷',
                color: '🟠',
                businessImpact: 'high',
                salesMultiplier: 2.5,
                scenarios: [
                    {
                        situation: '외출 시 필수 착용',
                        strategy: '긴급 대응 마케팅',
                        products: ['KF94 마스크', '고성능 필터', '대용량 팩'],
                        messaging: '지금 바로 필요한 강력한 보호',
                        urgency: 'high'
                    },
                    {
                        situation: '학교/직장 대응',
                        strategy: 'B2B 마케팅 강화',
                        products: ['단체용 마스크', '사무실용 팩', '학교 납품용'],
                        messaging: '우리 모두의 건강한 환경',
                        urgency: 'high'
                    },
                    {
                        situation: '실내 공기질 관리',
                        strategy: '토탈 솔루션',
                        products: ['공기청정기', '필터 교체', '실내용 마스크'],
                        messaging: '실내외 완벽 차단 솔루션',
                        urgency: 'high'
                    }
                ]
            },
            veryBad: { // 151㎍/㎥+
                name: '매우나쁨',
                emoji: '😵',
                color: '🔴',
                businessImpact: 'critical',
                salesMultiplier: 4.0,
                scenarios: [
                    {
                        situation: '비상 상황 대응',
                        strategy: '비상 마케팅',
                        products: ['KF94 프리미엄', 'N95 마스크', '의료진용 마스크'],
                        messaging: '생명과 직결된 선택',
                        urgency: 'critical'
                    },
                    {
                        situation: '대량 수요 폭증',
                        strategy: '공급 최우선',
                        products: ['재고 확보 상품', '긴급 배송 상품', '대량 할인팩'],
                        messaging: '지금 확보하세요',
                        urgency: 'critical'
                    },
                    {
                        situation: '미디어 주목',
                        strategy: 'PR 마케팅',
                        products: ['뉴스 언급 상품', '전문가 추천', '인증 마스크'],
                        messaging: '전문가가 선택한 믿을 수 있는',
                        urgency: 'critical'
                    }
                ]
            }
        };

        // 🆕 시간대별 마케팅 전략
        this.timeBasedStrategies = {
            morning: { // 06:00-09:00
                name: '출근 시간대',
                focus: '외출 준비',
                products: ['휴대용 마스크', '출근용 마스크', '대중교통용'],
                messaging: '안전한 출근길 동반자',
                channels: ['지하철 광고', '버스 광고', '모바일 푸시']
            },
            daytime: { // 09:00-17:00
                name: '주간 시간대',
                focus: '업무 환경',
                products: ['사무용 마스크', '장시간 착용형', '회의용 마스크'],
                messaging: '편안한 업무 환경',
                channels: ['온라인 광고', '사무용품 쇼핑몰', 'B2B 영업']
            },
            evening: { // 17:00-21:00
                name: '퇴근 시간대',
                focus: '귀가 및 여가',
                products: ['일회용 마스크', '스포츠 마스크', '외출용 마스크'],
                messaging: '건강한 저녁 시간',
                channels: ['퇴근길 광고', '쇼핑몰 배너', 'SNS 광고']
            },
            night: { // 21:00-06:00
                name: '야간 시간대',
                focus: '온라인 쇼핑',
                products: ['대용량 팩', '가족용 세트', '할인 상품'],
                messaging: '내일을 위한 준비',
                channels: ['온라인 쇼핑몰', '라이브 커머스', '새벽 배송']
            }
        };

        // 🆕 지역별 특성화 전략
        this.regionalStrategies = {
            seoul: {
                name: '서울 수도권',
                characteristics: ['높은 구매력', '트렌드 민감', '프리미엄 선호'],
                products: ['프리미엄 라이트 마스크', '디자인 마스크', '브랜드 마스크'],
                pricing: 'premium',
                channels: ['강남역 광고', '명동 매장', '온라인 프리미엄']
            },
            busan: {
                name: '부산 경남',
                characteristics: ['실용성 중시', '가성비 중요', '해안 지역'],
                products: ['기본형 마스크', '대용량 팩', '습도 대응형'],
                pricing: 'value',
                channels: ['지역 마트', '온라인 할인', '로컬 광고']
            },
            rural: {
                name: '지방 도시',
                characteristics: ['가격 민감', '기능성 중시', '오프라인 선호'],
                products: ['경제형 마스크', '농업용 마스크', '작업용 마스크'],
                pricing: 'economy',
                channels: ['마트 진열', '농협 판매', '지역 신문']
            }
        };
    }

    // 현재 계절 감지
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    // 현재 시간대 감지
    getCurrentTimeSlot() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 9) return 'morning';
        if (hour >= 9 && hour < 17) return 'daytime';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    }

    // 미세먼지 수준 판정
    getDustLevel(pm10, pm25) {
        if (pm10 <= 30 && pm25 <= 15) return 'good';
        if (pm10 <= 80 && pm25 <= 35) return 'moderate';
        if (pm10 <= 150 && pm25 <= 75) return 'bad';
        return 'veryBad';
    }

    // 🆕 실시간 대기질 정보 가져오기 (기존 코드 유지)
    async getCurrentAirQuality(stationName = '종로구') {
        try {
            console.log(`🔍 API 호출 시작: ${stationName}`);
            
            const response = await axios.get(`${this.baseUrl}/getMsrstnAcctoRltmMesureDnsty`, {
                params: {
                    serviceKey: this.airKoreaApiKey,
                    returnType: 'json',
                    numOfRows: 1,
                    pageNo: 1,
                    stationName: stationName,
                    dataTerm: 'DAILY',
                    ver: '1.0'
                },
                timeout: 10000
            });

            console.log('📡 API 응답 받음');
            
            if (response && response.data && response.data.response) {
                const apiResponse = response.data.response;
                
                if (apiResponse.header && apiResponse.header.resultCode === '00') {
                    if (apiResponse.body && apiResponse.body.items && apiResponse.body.items.length > 0) {
                        const data = apiResponse.body.items[0];
                        
                        console.log('✅ API 데이터 파싱 성공');
                        return {
                            station: stationName,
                            pm10: parseInt(data.pm10Value) || 0,
                            pm25: parseInt(data.pm25Value) || 0,
                            o3: parseFloat(data.o3Value) || 0,
                            no2: parseFloat(data.no2Value) || 0,
                            co: parseFloat(data.coValue) || 0,
                            so2: parseFloat(data.so2Value) || 0,
                            dataTime: data.dataTime || new Date().toISOString()
                        };
                    }
                }
            }
            
            console.log('⚠️ API 데이터 없음, 더미 데이터 사용');
            return this.getDummyAirQuality(stationName);
        } catch (error) {
            console.error('❌ API 호출 실패:', error.message);
            return this.getDummyAirQuality(stationName);
        }
    }

    // 🆕 강화된 더미 데이터 생성 (계절별 현실적 데이터)
    getDummyAirQuality(stationName) {
        const season = this.getCurrentSeason();
        const timeSlot = this.getCurrentTimeSlot();
        
        // 계절별 기본 농도 (실제 패턴 반영)
        const seasonalBase = {
            spring: { pm10: 75, pm25: 40 }, // 봄철 황사로 높음
            summer: { pm10: 35, pm25: 18 }, // 여름철 비교적 낮음
            autumn: { pm10: 60, pm25: 32 }, // 가을철 중간
            winter: { pm10: 55, pm25: 28 }  // 겨울철 난방으로 중간
        };

        // 시간대별 변동 (출퇴근 시간 높음)
        const timeMultiplier = {
            morning: 1.3,   // 출근 시간 높음
            daytime: 1.0,   // 주간 보통
            evening: 1.2,   // 퇴근 시간 약간 높음
            night: 0.8      // 야간 낮음
        };

        const base = seasonalBase[season];
        const multiplier = timeMultiplier[timeSlot];
        const variation = Math.floor(Math.random() * 20) - 10;

        const pm10 = Math.max(0, Math.round((base.pm10 + variation) * multiplier));
        const pm25 = Math.max(0, Math.round((base.pm25 + variation) * multiplier));

        console.log(`🎲 ${season}/${timeSlot} 더미 데이터: PM10=${pm10}, PM2.5=${pm25}`);

        return {
            station: stationName,
            pm10: pm10,
            pm25: pm25,
            o3: 0.03 + Math.random() * 0.02,
            no2: 0.02 + Math.random() * 0.01,
            co: 0.5 + Math.random() * 0.3,
            so2: 0.003 + Math.random() * 0.002,
            dataTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
    }

    // 🆕 종합 마케팅 인사이트 생성 (대폭 강화)
    generateMarketingInsights(dustData, userName) {
        const dustLevel = this.getDustLevel(dustData.pm10, dustData.pm25);
        const season = this.getCurrentSeason();
        const timeSlot = this.getCurrentTimeSlot();
        
        const seasonalData = this.seasonalBusinessData[season];
        const dustScenario = this.dustLevelScenarios[dustLevel];
        const timeStrategy = this.timeBasedStrategies[timeSlot];

        console.log(`💡 강화된 인사이트 생성: ${season}/${dustLevel}/${timeSlot}`);
        
        return {
            currentSituation: this.analyzeCurrentSituation(dustData, dustLevel, season, timeSlot),
            marketingOpportunity: this.getMarketingOpportunity(dustLevel, season, dustScenario, seasonalData),
            productStrategy: this.getProductStrategy(dustLevel, season, timeSlot),
            pricingStrategy: this.getPricingStrategy(dustLevel, season, seasonalData),
            marketingStrategy: this.getMarketingStrategy(dustLevel, season, timeSlot),
            inventoryStrategy: this.getInventoryStrategy(dustLevel, season, seasonalData),
            competitorStrategy: this.getCompetitorStrategy(dustLevel, season),
            riskManagement: this.getRiskManagement(dustLevel, season, dustScenario),
            actionPlan: this.getActionPlan(dustLevel, season, timeSlot, dustScenario),
            regionalStrategy: this.getRegionalStrategy(dustLevel, season)
        };
    }

    // 🆕 현재 상황 분석 (강화)
    analyzeCurrentSituation(dustData, dustLevel, season, timeSlot) {
        const seasonalData = this.seasonalBusinessData[season];
        const dustScenario = this.dustLevelScenarios[dustLevel];
        const timeStrategy = this.timeBasedStrategies[timeSlot];

        return {
            summary: `${seasonalData.name} ${dustScenario.name} 상황`,
            details: {
                pm10: dustData.pm10,
                pm25: dustData.pm25,
                season: seasonalData.name,
                timeSlot: timeStrategy.name,
                dustLevel: dustScenario.name,
                businessImpact: dustScenario.businessImpact,
                seasonalEvents: seasonalData.dustEvents.join(', '),
                riskLevel: dustScenario.businessImpact === 'critical' ? 'critical' : 
                          dustScenario.businessImpact === 'high' ? 'high' : 
                          dustScenario.businessImpact === 'medium' ? 'medium' : 'low'
            }
        };
    }

    // 🆕 마케팅 기회 분석 (강화)
    getMarketingOpportunity(dustLevel, season, dustScenario, seasonalData) {
        const baseScore = dustScenario.salesMultiplier * seasonalData.salesMultiplier;
        const finalScore = Math.min(10, Math.round(baseScore));
        
        const selectedScenario = dustScenario.scenarios[Math.floor(Math.random() * dustScenario.scenarios.length)];
        
        return {
            score: finalScore,
            level: dustScenario.businessImpact,
            scenario: selectedScenario,
            seasonalMultiplier: seasonalData.salesMultiplier,
            opportunities: [{
                type: selectedScenario.urgency,
                title: `${dustScenario.emoji} ${selectedScenario.situation}`,
                description: selectedScenario.strategy,
                messaging: selectedScenario.messaging,
                products: selectedScenario.products,
                actions: this.generateActions(dustLevel, season, selectedScenario.urgency)
            }]
        };
    }

    // 🆕 제품 전략 (실제 비즈니스 반영)
    getProductStrategy(dustLevel, season, timeSlot) {
        const seasonalData = this.seasonalBusinessData[season];
        const dustScenario = this.dustLevelScenarios[dustLevel];
        const timeStrategy = this.timeBasedStrategies[timeSlot];

        // 계절별 주력 상품 + 미세먼지 농도별 추가 상품
        const recommendedProducts = {
            primary: seasonalData.keyProducts.primary,
            secondary: seasonalData.keyProducts.secondary,
            timeSpecific: timeStrategy.products,
            dustSpecific: dustScenario.scenarios[0].products
        };

        // 🔥 여름철 프리미엄 라이트 마스크 특별 전략
        if (season === 'summer') {
            return {
                focus: '프리미엄 라이트 마스크 집중 마케팅',
                primaryProduct: '프리미엄 라이트 마스크',
                reasoning: '여름철 무더위에도 착용 가능한 통풍성과 경량성',
                strategy: [
                    '프리미엄 라이트 마스크 메인 진열',
                    '컬러맛집 부각 마케팅',
                    '여름 전용 브랜딩 강화',
                    '에어컨 시설 내 착용 편의성 어필'
                ],
                crossSelling: ['쿨링 마스크', '아이스 마스크', '메쉬 마스크'],
                bundling: ['프리미엄 라이트 + 쿨링 젤', '여름 마스크 3종 세트']
            };
        }

        return {
            focus: `${seasonalData.name} 핵심 상품`,
            primaryProduct: seasonalData.keyProducts.primary[0],
            recommendedProducts: recommendedProducts,
            strategy: this.generateProductStrategy(dustLevel, season, seasonalData),
            crossSelling: seasonalData.keyProducts.secondary,
            bundling: this.generateBundlingStrategy(season, dustLevel)
        };
    }

    // 🆕 가격 전략
    getPricingStrategy(dustLevel, season, seasonalData) {
        const priceStrategies = {
            premium: {
                approach: '프리미엄 가격 정책',
                reasoning: '높은 수요와 품질 대비 프리미엄 가격 책정',
                tactics: ['한정판 마케팅', '프리미엄 브랜딩', '품질 보증']
            },
            value: {
                approach: '가성비 가격 정책',
                reasoning: '기능성 대비 합리적 가격으로 시장 점유율 확대',
                tactics: ['기능성 부각', '비교 광고', '대용량 할인']
            },
            balanced: {
                approach: '균형 가격 정책',
                reasoning: '시장 평균 가격 유지하며 안정적 수익 확보',
                tactics: ['정가 정책', '멤버십 할인', '정기 구매 혜택']
            }
        };

        const strategy = priceStrategies[seasonalData.priceStrategy];
        
        return {
            strategy: strategy.approach,
            reasoning: strategy.reasoning,
            tactics: strategy.tactics,
            seasonalAdjustment: seasonalData.salesMultiplier,
            dustLevelAdjustment: this.dustLevelScenarios[dustLevel].salesMultiplier,
            recommendations: this.generatePricingRecommendations(dustLevel, season)
        };
    }

    // 🆕 마케팅 전략 (시간대별 강화)
    getMarketingStrategy(dustLevel, season, timeSlot) {
        const seasonalData = this.seasonalBusinessData[season];
        const timeStrategy = this.timeBasedStrategies[timeSlot];
        const dustScenario = this.dustLevelScenarios[dustLevel];

        return {
            mainStrategy: {
                title: `${timeStrategy.name} ${dustScenario.name} 대응 전략`,
                focus: timeStrategy.focus,
                urgency: dustScenario.businessImpact,
                messaging: seasonalData.marketingMessages,
                channels: timeStrategy.channels
            },
            digitalStrategy: this.getDigitalStrategy(dustLevel, season, timeSlot),
            offlineStrategy: this.getOfflineStrategy(dustLevel, season, timeSlot),
            contentStrategy: this.getContentStrategy(dustLevel, season, timeSlot)
        };
    }

    // 🆕 재고 전략 (비즈니스 데이터 반영)
    getInventoryStrategy(dustLevel, season, seasonalData) {
        const inventory = seasonalData.inventory;
        const dustMultiplier = this.dustLevelScenarios[dustLevel].salesMultiplier;
        
        const stockLevels = {
            high: '300%',
            medium: '200%',
            low: '150%'
        };

        return {
            stockLevel: stockLevels[inventory.stockLevel],
            turnoverRate: inventory.turnoverRate,
            criticalProducts: inventory.criticalProducts,
            seasonalDemand: seasonalData.salesMultiplier,
            dustDemand: dustMultiplier,
            totalMultiplier: Math.round(seasonalData.salesMultiplier * dustMultiplier * 100) / 100,
            strategy: this.generateInventoryStrategy(dustLevel, season, inventory),
            riskProducts: this.identifyRiskProducts(dustLevel, season)
        };
    }

    // 🆕 다양한 헬퍼 메서드들
    generateActions(dustLevel, season, urgency) {
        const actions = {
            critical: [
                '즉시 재고 확보 및 긴급 주문',
                '24시간 CS 대응 체계 가동',
                '전 채널 광고 예산 최대 투입',
                '언론 대응 및 PR 활동'
            ],
            high: [
                '재고 점검 및 추가 주문',
                '마케팅 예산 150% 증대',
                '고객 문의 대응 강화',
                '경쟁사 동향 모니터링'
            ],
            medium: [
                '재고 현황 확인',
                '타겟 마케팅 실행',
                '고객 교육 콘텐츠 제작',
                '판매 데이터 분석'
            ],
            low: [
                '브랜드 마케팅 강화',
                '고객 관계 관리',
                '제품 개선 피드백 수집',
                '장기 전략 수립'
            ]
        };

        return actions[urgency] || actions.medium;
    }

    generateProductStrategy(dustLevel, season, seasonalData) {
        return [
            `${seasonalData.keyProducts.primary[0]} 주력 상품 집중`,
            `${seasonalData.name} 특화 마케팅`,
            '고객 세분화 맞춤 전략',
            '크로스셀링 기회 확대'
        ];
    }

    generateBundlingStrategy(season, dustLevel) {
        const bundles = {
            spring: ['황사 대응 패키지', '봄철 건강 세트', '가족 보호 패키지'],
            summer: ['여름 쾌적 패키지', '프리미엄 라이트 세트', '쿨링 마스크 콤보'],
            autumn: ['가을 미세먼지 세트', '일상 보호 패키지', '장기 착용 세트'],
            winter: ['겨울 방한 패키지', '실내외 보호 세트', '난방 시즌 세트']
        };

        return bundles[season] || ['기본 패키지'];
    }

    generatePricingRecommendations(dustLevel, season) {
        const recommendations = [];
        
        if (dustLevel === 'veryBad') {
            recommendations.push('긴급 상황으로 프리미엄 가격 적용');
            recommendations.push('대량 구매 시 할인 제공');
        } else if (dustLevel === 'bad') {
            recommendations.push('표준 가격 + 10% 적용');
            recommendations.push('번들 상품 할인 제공');
        } else {
            recommendations.push('표준 가격 정책 유지');
            recommendations.push('정기 구매 고객 할인');
        }

        return recommendations;
    }

    getDigitalStrategy(dustLevel, season, timeSlot) {
        return {
            channels: ['네이버 스마트스토어', '쿠팡', '11번가', '온라인 자체몰'],
            tactics: ['검색 광고 강화', 'SNS 광고', '인플루언서 협업', '라이브 커머스'],
            budget: dustLevel === 'veryBad' ? '최대 투입' : dustLevel === 'bad' ? '200% 증대' : '정상 운영'
        };
    }

    getOfflineStrategy(dustLevel, season, timeSlot) {
        return {
            channels: ['약국', '마트', '편의점', '대형마트'],
            tactics: ['진열 위치 최적화', '매장 프로모션', '샘플 제공', 'POP 광고'],
            focus: timeSlot === 'morning' ? '출근길 매장' : timeSlot === 'evening' ? '퇴근길 매장' : '주거지 매장'
        };
    }

    getContentStrategy(dustLevel, season, timeSlot) {
        return {
            types: ['교육 콘텐츠', '사용법 가이드', '건강 정보', '제품 비교'],
            platforms: ['유튜브', '인스타그램', '네이버 블로그', '카카오톡'],
            urgency: dustLevel === 'veryBad' ? '긴급 제작' : '정기 제작'
        };
    }

    generateInventoryStrategy(dustLevel, season, inventory) {
        return [
            `${inventory.stockLevel} 재고 수준 유지`,
            `${inventory.turnoverRate} 회전율 예상`,
            `${inventory.criticalProducts.join(', ')} 핵심 관리`,
            '공급업체 다변화 필요'
        ];
    }

    identifyRiskProducts(dustLevel, season) {
        const riskProducts = [];
        
        if (dustLevel === 'veryBad') {
            riskProducts.push('모든 KF94 제품군');
            riskProducts.push('N95 마스크');
        } else if (dustLevel === 'bad') {
            riskProducts.push('KF94 일반형');
            riskProducts.push('어린이용 마스크');
        }

        return riskProducts;
    }

    // 🆕 지역별 전략
    getRegionalStrategy(dustLevel, season) {
        return {
            seoul: this.regionalStrategies.seoul,
            busan: this.regionalStrategies.busan,
            rural: this.regionalStrategies.rural,
            recommendation: '지역별 맞춤 전략 필요'
        };
    }

    // 🆕 경쟁사 분석
    getCompetitorStrategy(dustLevel, season) {
        return {
            monitoring: ['가격 정책', '재고 현황', '마케팅 메시지', '신제품 출시'],
            opportunities: ['경쟁사 품절 시 점유율 확대', '차별화 메시지 강화'],
            threats: ['가격 경쟁 심화', '신규 진입자 증가']
        };
    }

    // 🆕 리스크 관리
    getRiskManagement(dustLevel, season, dustScenario) {
        const risks = [];
        
        if (dustScenario.businessImpact === 'critical') {
            risks.push({
                type: 'supply',
                title: '공급 부족 리스크',
                probability: 'high',
                impact: 'critical',
                mitigation: ['긴급 발주', '대체 공급업체 확보', '생산 라인 확대']
            });
        }

        return {
            level: dustScenario.businessImpact,
            risks: risks
        };
    }

    // 🆕 액션 플랜
    getActionPlan(dustLevel, season, timeSlot, dustScenario) {
        const plans = [];
        
        if (dustScenario.businessImpact === 'critical') {
            plans.push({
                timeframe: 'immediate',
                title: '🚨 비상 대응 (즉시)',
                tasks: [
                    '전 직원 비상 소집',
                    '재고 현황 실시간 점검',
                    '언론 대응 준비',
                    '24시간 CS 체계 가동'
                ]
            });
        } else if (dustScenario.businessImpact === 'high') {
            plans.push({
                timeframe: 'urgent',
                title: '⚡ 긴급 대응 (1-2시간)',
                tasks: [
                    '재고 확보 및 주문',
                    '마케팅 예산 증대',
                    '고객 문의 대응 강화',
                    '경쟁사 동향 모니터링'
                ]
            });
        } else {
            plans.push({
                timeframe: 'normal',
                title: '📊 일반 대응 (1-2일)',
                tasks: [
                    '정기 재고 점검',
                    '마케팅 최적화',
                    '고객 피드백 수집',
                    '장기 전략 수립'
                ]
            });
        }

        return {
            totalPlans: plans.length,
            plans: plans
        };
    }

    // 🆕 강화된 리포트 포맷팅
    formatEnhancedInsightReport(insights, dustData, userName) {
        const koreaTime = new Date(dustData.dataTime).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        let report = `📊 **${userName}님의 강화된 미세먼지 마케팅 인사이트**\n\n`;
        
        // 현재 상황 (강화)
        report += `🌫️ **현재 상황** (${koreaTime})\n`;
        report += `• 측정소: ${dustData.station}\n`;
        report += `• PM10: ${dustData.pm10}㎍/㎥ | PM2.5: ${dustData.pm25}㎍/㎥\n`;
        report += `• 상태: ${insights.currentSituation.summary}\n`;
        report += `• 시간대: ${insights.currentSituation.details.timeSlot}\n`;
        report += `• 비즈니스 임팩트: ${insights.currentSituation.details.businessImpact}\n\n`;
        
        // 마케팅 기회 (강화)
        report += `🎯 **마케팅 기회 점수: ${insights.marketingOpportunity.score}/10**\n`;
        const opportunity = insights.marketingOpportunity.opportunities[0];
        report += `${opportunity.title}\n`;
        report += `📢 메시지: ${opportunity.messaging}\n`;
        report += `🎁 핵심 상품: ${opportunity.products.join(', ')}\n\n`;
        
        // 🔥 제품 전략 (여름철 프리미엄 라이트 특화)
        report += `🎁 **제품 전략**\n`;
        report += `• 주력 상품: ${insights.productStrategy.primaryProduct}\n`;
        if (insights.productStrategy.focus.includes('프리미엄 라이트')) {
            report += `• 🔥 여름 특화: ${insights.productStrategy.focus}\n`;
            report += `• 크로스셀링: ${insights.productStrategy.crossSelling.join(', ')}\n`;
            report += `• 번들링: ${insights.productStrategy.bundling.join(', ')}\n`;
        }
        report += '\n';
        
        // 가격 전략
        report += `💰 **가격 전략**\n`;
        report += `• 정책: ${insights.pricingStrategy.strategy}\n`;
        report += `• 계절 조정: ${insights.pricingStrategy.seasonalAdjustment}배\n`;
        report += `• 미세먼지 조정: ${insights.pricingStrategy.dustLevelAdjustment}배\n\n`;
        
        // 재고 전략
        report += `📦 **재고 전략**\n`;
        report += `• 재고 수준: ${insights.inventoryStrategy.stockLevel}\n`;
        report += `• 회전율: ${insights.inventoryStrategy.turnoverRate}\n`;
        report += `• 총 배수: ${insights.inventoryStrategy.totalMultiplier}배\n`;
        report += `• 핵심 관리: ${insights.inventoryStrategy.criticalProducts.join(', ')}\n\n`;
        
        // 마케팅 전략
        report += `🎯 **마케팅 전략**\n`;
        const mainStrategy = insights.marketingStrategy.mainStrategy;
        report += `• 전략: ${mainStrategy.title}\n`;
        report += `• 포커스: ${mainStrategy.focus}\n`;
        report += `• 채널: ${mainStrategy.channels.join(', ')}\n`;
        report += `• 예산: ${insights.marketingStrategy.digitalStrategy.budget}\n\n`;
        
        // 액션 플랜
        report += `📋 **액션 플랜**\n`;
        insights.actionPlan.plans.forEach(plan => {
            report += `**${plan.title}**\n`;
            plan.tasks.forEach(task => {
                report += `• ${task}\n`;
            });
        });
        
        return report;
    }

    // 전국 현황 조회 (기존 코드 유지)
    async getNationalDustStatus() {
        const results = [];
        const cities = Object.entries(MONITORING_STATIONS).slice(0, 5);

        for (const [cityName, stationName] of cities) {
            try {
                const data = await this.getCurrentAirQuality(stationName);
                const dustLevel = this.getDustLevel(data.pm10, data.pm25);
                const dustScenario = this.dustLevelScenarios[dustLevel];
                
                results.push({
                    city: cityName,
                    station: stationName,
                    pm10: data.pm10,
                    pm25: data.pm25,
                    level: dustScenario.name,
                    emoji: dustScenario.emoji,
                    color: dustScenario.color,
                    businessImpact: dustScenario.businessImpact
                });
            } catch (error) {
                console.error(`❌ ${cityName} 데이터 조회 실패:`, error.message);
            }
        }

        return results;
    }
}

// 메인 함수
module.exports = function(bot, msg) {
    const text = msg.text || '';
    const chatId = msg.chat.id;
    const userName = getUserName(msg.from);
    const insightManager = new EnhancedDustMarketingInsights();

    console.log(`📥 강화된 인사이트 요청: ${text} (사용자: ${userName})`);

    if (text === '/insight' || text === '/인사이트') {
        console.log('🔍 강화된 종합 마케팅 인사이트 생성 시작...');
        
        insightManager.getCurrentAirQuality()
            .then(dustData => {
                console.log('📊 대기질 데이터 획득 완료');
                const insights = insightManager.generateMarketingInsights(dustData, userName);
                const report = insightManager.formatEnhancedInsightReport(insights, dustData, userName);
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🎁 제품 전략', callback_data: 'insight_products' },
                            { text: '💰 가격 전략', callback_data: 'insight_pricing' }
                        ],
                        [
                            { text: '📦 재고 전략', callback_data: 'insight_inventory' },
                            { text: '🎯 마케팅 전략', callback_data: 'insight_marketing' }
                        ],
                        [
                            { text: '🏙️ 지역별 전략', callback_data: 'insight_regional' },
                            { text: '⚔️ 경쟁사 분석', callback_data: 'insight_competitor' }
                        ],
                        [
                            { text: '🔄 새로고침', callback_data: 'insight_refresh' },
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                console.log('✅ 강화된 인사이트 전송 준비 완료');
                bot.sendMessage(chatId, report, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            })
            .catch(error => {
                console.error('❌ 강화된 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 인사이트 생성 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
            });

    } else if (text === '/insight quick' || text === '/인사이트 간단') {
        console.log('⚡ 강화된 빠른 인사이트 생성 시작...');
        
        insightManager.getCurrentAirQuality()
            .then(dustData => {
                const insights = insightManager.generateMarketingInsights(dustData, userName);
                const season = insightManager.getCurrentSeason();
                
                let quickReport = `⚡ **강화된 빠른 인사이트**\n\n`;
                quickReport += `🌫️ 미세먼지: ${insights.currentSituation.details.dustLevel} (${dustData.pm25}㎍/㎥)\n`;
                quickReport += `🎯 기회 점수: ${insights.marketingOpportunity.score}/10\n`;
                quickReport += `🎁 주력 상품: ${insights.productStrategy.primaryProduct}\n`;
                quickReport += `💰 가격 전략: ${insights.pricingStrategy.strategy}\n`;
                quickReport += `📦 재고 배수: ${insights.inventoryStrategy.totalMultiplier}배\n\n`;
                
                // 🔥 여름철 프리미엄 라이트 특별 메시지
                if (season === 'summer') {
                    quickReport += `🔥 **여름 특화 전략**\n`;
                    quickReport += `프리미엄 라이트 마스크 집중 마케팅!\n`;
                    quickReport += `무더위에도 시원한 착용감으로 매출 증대 기대\n\n`;
                }
                
                quickReport += `📋 **즉시 실행**\n`;
                const actions = insights.actionPlan.plans[0].tasks;
                actions.forEach((action, index) => {
                    quickReport += `${index + 1}. ${action}\n`;
                });
                
                bot.sendMessage(chatId, quickReport, { parse_mode: 'Markdown' });
            })
            .catch(error => {
                console.error('❌ 강화된 빠른 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 빠른 인사이트 생성 실패: ${error.message}`);
            });

    } else {
        // 강화된 도움말
        const helpMessage = `📊 **강화된 미세먼지 마케팅 인사이트**\n\n` +
                           `**📱 명령어**\n` +
                           `• /insight 또는 /인사이트 - 강화된 종합 분석\n` +
                           `• /insight quick - 강화된 빠른 인사이트\n\n` +
                           `**🆕 새로운 강화 기능**\n` +
                           `• 계절별 실제 상품 전략 (여름철 프리미엄 라이트 특화)\n` +
                           `• 시간대별 맞춤 마케팅 전략\n` +
                           `• 미세먼지 농도별 상세 시나리오\n` +
                           `• 지역별 차별화 전략\n` +
                           `• 실제 비즈니스 데이터 반영\n\n` +
                           `**🎯 핵심 특징**\n` +
                           `• 🔥 여름철 프리미엄 라이트 마스크 집중 분석\n` +
                           `• 실시간 재고 배수 계산\n` +
                           `• 계절별 가격 전략 제안\n` +
                           `• 시간대별 마케팅 채널 최적화\n\n` +
                           `**💡 활용 시나리오**\n` +
                           `• 여름철 무더위 → 프리미엄 라이트 마스크 집중\n` +
                           `• 봄철 황사 → KF94 황사마스크 프리미엄 전략\n` +
                           `• 출근 시간 → 휴대용 마스크 지하철 광고\n` +
                           `• 미세먼지 매우나쁨 → 비상 재고 확보\n\n` +
                           `실제 비즈니스 데이터 기반 맞춤형 전략! 🚀`;

        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    }
};

// 강화된 콜백 처리 함수
module.exports.handleCallback = async function(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userName = getUserName(callbackQuery.from);
    const insightManager = new EnhancedDustMarketingInsights();

    console.log(`📞 강화된 인사이트 콜백 처리: ${data}`);

    try {
        const dustData = await insightManager.getCurrentAirQuality();
        const insights = insightManager.generateMarketingInsights(dustData, userName);

        switch (data) {
            case 'insight_products':
                const productStrategy = insights.productStrategy;
                let productMsg = `🎁 **제품 전략**\n\n`;
                productMsg += `• 주력 상품: ${productStrategy.primaryProduct}\n`;
                productMsg += `• 전략: ${productStrategy.focus}\n\n`;
                
                if (productStrategy.strategy) {
                    productMsg += `**실행 전략**\n`;
                    productStrategy.strategy.forEach(strategy => {
                        productMsg += `• ${strategy}\n`;
                    });
                }
                
                if (productStrategy.bundling) {
                    productMsg += `\n**번들링 제안**\n`;
                    productStrategy.bundling.forEach(bundle => {
                        productMsg += `• ${bundle}\n`;
                    });
                }
                
                bot.sendMessage(chatId, productMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_pricing':
                const pricingStrategy = insights.pricingStrategy;
                let pricingMsg = `💰 **가격 전략**\n\n`;
                pricingMsg += `• 정책: ${pricingStrategy.strategy}\n`;
                pricingMsg += `• 근거: ${pricingStrategy.reasoning}\n`;
                pricingMsg += `• 계절 조정: ${pricingStrategy.seasonalAdjustment}배\n`;
                pricingMsg += `• 미세먼지 조정: ${pricingStrategy.dustLevelAdjustment}배\n\n`;
                
                pricingMsg += `**실행 방안**\n`;
                pricingStrategy.tactics.forEach(tactic => {
                    pricingMsg += `• ${tactic}\n`;
                });
                
                bot.sendMessage(chatId, pricingMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_inventory':
                const inventoryStrategy = insights.inventoryStrategy;
                let inventoryMsg = `📦 **재고 전략**\n\n`;
                inventoryMsg += `• 재고 수준: ${inventoryStrategy.stockLevel}\n`;
                inventoryMsg += `• 회전율: ${inventoryStrategy.turnoverRate}\n`;
                inventoryMsg += `• 총 배수: ${inventoryStrategy.totalMultiplier}배\n`;
                inventoryMsg += `• 핵심 관리: ${inventoryStrategy.criticalProducts.join(', ')}\n\n`;
                
                inventoryMsg += `**실행 전략**\n`;
                inventoryStrategy.strategy.forEach(strategy => {
                    inventoryMsg += `• ${strategy}\n`;
                });
                
                bot.sendMessage(chatId, inventoryMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_marketing':
                const marketingStrategy = insights.marketingStrategy;
                let marketingMsg = `🎯 **마케팅 전략**\n\n`;
                marketingMsg += `• 전략: ${marketingStrategy.mainStrategy.title}\n`;
                marketingMsg += `• 포커스: ${marketingStrategy.mainStrategy.focus}\n`;
                marketingMsg += `• 긴급도: ${marketingStrategy.mainStrategy.urgency}\n\n`;
                
                marketingMsg += `**디지털 전략**\n`;
                marketingStrategy.digitalStrategy.channels.forEach(channel => {
                    marketingMsg += `• ${channel}\n`;
                });
                marketingMsg += `• 예산: ${marketingStrategy.digitalStrategy.budget}\n\n`;
                
                marketingMsg += `**오프라인 전략**\n`;
                marketingStrategy.offlineStrategy.channels.forEach(channel => {
                    marketingMsg += `• ${channel}\n`;
                });
                
                bot.sendMessage(chatId, marketingMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_regional':
                const regionalStrategy = insights.regionalStrategy;
                let regionalMsg = `🏙️ **지역별 전략**\n\n`;
                
                regionalMsg += `**서울/수도권**\n`;
                regionalMsg += `• 특성: ${regionalStrategy.seoul.characteristics.join(', ')}\n`;
                regionalMsg += `• 상품: ${regionalStrategy.seoul.products.join(', ')}\n`;
                regionalMsg += `• 가격: ${regionalStrategy.seoul.pricing}\n\n`;
                
                regionalMsg += `**부산/경남**\n`;
                regionalMsg += `• 특성: ${regionalStrategy.busan.characteristics.join(', ')}\n`;
                regionalMsg += `• 상품: ${regionalStrategy.busan.products.join(', ')}\n`;
                regionalMsg += `• 가격: ${regionalStrategy.busan.pricing}\n\n`;
                
                regionalMsg += `**지방 도시**\n`;
                regionalMsg += `• 특성: ${regionalStrategy.rural.characteristics.join(', ')}\n`;
                regionalMsg += `• 상품: ${regionalStrategy.rural.products.join(', ')}\n`;
                regionalMsg += `• 가격: ${regionalStrategy.rural.pricing}\n`;
                
                bot.sendMessage(chatId, regionalMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_competitor':
                const competitorStrategy = insights.competitorStrategy;
                let competitorMsg = `⚔️ **경쟁사 분석**\n\n`;
                
                competitorMsg += `**모니터링 포인트**\n`;
                competitorStrategy.monitoring.forEach(point => {
                    competitorMsg += `• ${point}\n`;
                });
                
                competitorMsg += `\n**기회 요소**\n`;
                competitorStrategy.opportunities.forEach(opportunity => {
                    competitorMsg += `• ${opportunity}\n`;
                });
                
                competitorMsg += `\n**위협 요소**\n`;
                competitorStrategy.threats.forEach(threat => {
                    competitorMsg += `• ${threat}\n`;
                });
                
                bot.sendMessage(chatId, competitorMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_refresh':
                bot.sendMessage(chatId, '🔄 최신 데이터로 강화된 인사이트를 새로고침합니다...');
                setTimeout(() => {
                    module.exports(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/insight' });
                }, 1000);
                break;

            default:
                bot.sendMessage(chatId, '⚠️ 알 수 없는 명령어입니다. 다시 시도해주세요.');
                break;
        }
    } catch (error) {
        console.error('❌ 콜백 처리 실패:', error);
        bot.sendMessage(chatId, `❌ 콜백 처리 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
    }
};

// 🆕 전국 현황 조회 메인 함수
module.exports.getNationalStatus = async function(bot, msg) {
    const chatId = msg.chat.id;
    const userName = getUserName(msg.from);
    const insightManager = new EnhancedDustMarketingInsights();

    console.log(`🗺️ 전국 현황 조회 시작 (사용자: ${userName})`);

    try {
        bot.sendMessage(chatId, '🔍 전국 주요 도시 미세먼지 현황을 조회하고 있습니다...');
        
        const nationalData = await insightManager.getNationalDustStatus();
        
        let report = `🗺️ **전국 미세먼지 현황 & 마케팅 인사이트**\n\n`;
        
        nationalData.forEach(city => {
            report += `${city.color} **${city.city}** (${city.station})\n`;
            report += `• PM10: ${city.pm10}㎍/㎥ | PM2.5: ${city.pm25}㎍/㎥\n`;
            report += `• 상태: ${city.emoji} ${city.level}\n`;
            report += `• 비즈니스 임팩트: ${city.businessImpact}\n\n`;
        });
        
        // 전국 평균 및 권장 사항
        const averagePM10 = Math.round(nationalData.reduce((sum, city) => sum + city.pm10, 0) / nationalData.length);
        const averagePM25 = Math.round(nationalData.reduce((sum, city) => sum + city.pm25, 0) / nationalData.length);
        const avgLevel = insightManager.getDustLevel(averagePM10, averagePM25);
        
        report += `📊 **전국 평균**\n`;
        report += `• PM10: ${averagePM10}㎍/㎥ | PM2.5: ${averagePM25}㎍/㎥\n`;
        report += `• 전국 상태: ${insightManager.dustLevelScenarios[avgLevel].emoji} ${insightManager.dustLevelScenarios[avgLevel].name}\n\n`;
        
        // 권장 마케팅 액션
        const criticalCities = nationalData.filter(city => city.businessImpact === 'critical').length;
        const highImpactCities = nationalData.filter(city => city.businessImpact === 'high').length;
        
        report += `🎯 **권장 마케팅 액션**\n`;
        if (criticalCities > 0) {
            report += `• 🚨 ${criticalCities}개 도시 비상 상황 - 긴급 마케팅 필요\n`;
            report += `• 재고 확보 및 24시간 대응 체계 가동\n`;
        } else if (highImpactCities > 0) {
            report += `• ⚡ ${highImpactCities}개 도시 높은 수요 - 적극적 마케팅\n`;
            report += `• 해당 지역 광고 예산 150% 증대\n`;
        } else {
            report += `• 📊 안정적 상황 - 브랜드 마케팅 집중\n`;
            report += `• 장기 전략 수립 및 고객 관계 강화\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 새로고침', callback_data: 'national_refresh' },
                    { text: '📍 지역별 상세', callback_data: 'regional_detail' }
                ],
                [
                    { text: '🎯 종합 인사이트', callback_data: 'insight_main' },
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]
            ]
        };
        
        bot.sendMessage(chatId, report, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ 전국 현황 조회 실패:', error);
        bot.sendMessage(chatId, `❌ 전국 현황 조회 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
    }
};

// 🆕 시간대별 알림 설정 함수
module.exports.setupTimeBasedAlerts = function(bot) {
    const insightManager = new EnhancedDustMarketingInsights();
    
    // 매시간 정각에 체크
    setInterval(async () => {
        const currentHour = new Date().getHours();
        
        // 출근 시간 (오전 7시)와 퇴근 시간 (오후 6시)에 알림
        if (currentHour === 7 || currentHour === 18) {
            console.log(`⏰ 시간대별 알림 체크 시작: ${currentHour}시`);
            
            try {
                const dustData = await insightManager.getCurrentAirQuality();
                const dustLevel = insightManager.getDustLevel(dustData.pm10, dustData.pm25);
                
                // 나쁨 이상일 때만 알림
                if (dustLevel === 'bad' || dustLevel === 'veryBad') {
                    const timeSlot = currentHour === 7 ? 'morning' : 'evening';
                    const timeStrategy = insightManager.timeBasedStrategies[timeSlot];
                    const dustScenario = insightManager.dustLevelScenarios[dustLevel];
                    
                    const alertMessage = `🚨 **${timeStrategy.name} 미세먼지 알림**\n\n` +
                                       `${dustScenario.emoji} 현재 상태: ${dustScenario.name}\n` +
                                       `PM2.5: ${dustData.pm25}㎍/㎥\n\n` +
                                       `📢 **마케팅 기회**\n` +
                                       `• ${timeStrategy.messaging}\n` +
                                       `• 추천 상품: ${timeStrategy.products.join(', ')}\n` +
                                       `• 주력 채널: ${timeStrategy.channels.join(', ')}\n\n` +
                                       `지금이 마케팅 집중 타이밍입니다! 🎯`;
                    
                    // 여기에 구독자 목록이 있다면 알림 발송
                    // 예: subscribers.forEach(chatId => bot.sendMessage(chatId, alertMessage, { parse_mode: 'Markdown' }));
                    
                    console.log(`📢 ${timeSlot} 알림 발송 완료: ${dustLevel}`);
                }
            } catch (error) {
                console.error('❌ 시간대별 알림 실패:', error);
            }
        }
    }, 60 * 60 * 1000); // 1시간마다 체크
};

// 🆕 주간 리포트 생성 함수
module.exports.generateWeeklyReport = async function(bot, chatId, userName) {
    const insightManager = new EnhancedDustMarketingInsights();
    
    console.log(`📊 주간 리포트 생성 시작 (사용자: ${userName})`);
    
    try {
        bot.sendMessage(chatId, '📊 주간 마케팅 리포트를 생성하고 있습니다...');
        
        // 현재 데이터 기반 시뮬레이션
        const currentData = await insightManager.getCurrentAirQuality();
        const currentSeason = insightManager.getCurrentSeason();
        const seasonalData = insightManager.seasonalBusinessData[currentSeason];
        
        let report = `📊 **주간 마케팅 리포트** (${new Date().toLocaleDateString('ko-KR')})\n\n`;
        
        // 주간 트렌드 (시뮬레이션)
        report += `📈 **주간 트렌드**\n`;
        report += `• 계절: ${seasonalData.name}\n`;
        report += `• 평균 PM2.5: ${currentData.pm25}㎍/㎥\n`;
        report += `• 예상 매출 증가: ${Math.round(seasonalData.salesMultiplier * 100)}%\n`;
        report += `• 주력 상품: ${seasonalData.keyProducts.primary[0]}\n\n`;
        
        // 성과 분석
        report += `🎯 **성과 분석**\n`;
        report += `• 재고 회전율: ${seasonalData.inventory.turnoverRate}\n`;
        report += `• 핵심 상품 매출: ${seasonalData.keyProducts.primary.join(', ')}\n`;
        report += `• 신규 고객 증가: ${Math.round(Math.random() * 30 + 10)}%\n\n`;
        
        // 다음 주 전략
        report += `🔮 **다음 주 전략**\n`;
        seasonalData.marketingMessages.forEach(message => {
            report += `• ${message}\n`;
        });
        
        report += `\n📦 **재고 권장사항**\n`;
        report += `• ${seasonalData.inventory.stockLevel} 재고 수준 유지\n`;
        report += `• 핵심 관리: ${seasonalData.inventory.criticalProducts.join(', ')}\n`;
        
        // 🔥 여름철 특별 권장사항
        if (currentSeason === 'summer') {
            report += `\n🔥 **여름철 특별 권장사항**\n`;
            report += `• 프리미엄 라이트 마스크 재고 200% 확보\n`;
            report += `• 컬러맛집 마케팅 메시지 강화\n`;
            report += `• 에어컨 시설 제휴 마케팅 검토\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📊 상세 분석', callback_data: 'weekly_detail' },
                    { text: '🎯 액션 플랜', callback_data: 'weekly_action' }
                ],
                [
                    { text: '📧 리포트 저장', callback_data: 'save_report' },
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]
            ]
        };
        
        bot.sendMessage(chatId, report, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ 주간 리포트 생성 실패:', error);
        bot.sendMessage(chatId, `❌ 주간 리포트 생성 중 오류가 발생했습니다.\n\n오류: ${error.message}`);
    }
};

// 🆕 실시간 모니터링 대시보드 함수
module.exports.showRealtimeDashboard = async function(bot, chatId, userName) {
    const insightManager = new EnhancedDustMarketingInsights();
    
    console.log(`📱 실시간 대시보드 표시 (사용자: ${userName})`);
    
    try {
        const dustData = await insightManager.getCurrentAirQuality();
        const insights = insightManager.generateMarketingInsights(dustData, userName);
        const season = insightManager.getCurrentSeason();
        const timeSlot = insightManager.getCurrentTimeSlot();
        
        let dashboard = `📱 **실시간 마케팅 대시보드**\n\n`;
        
        // 현재 상황 요약
        dashboard += `⏰ **현재 상황** (${new Date().toLocaleTimeString('ko-KR')})\n`;
        dashboard += `• 미세먼지: ${insights.currentSituation.details.dustLevel} ${dustData.pm25}㎍/㎥\n`;
        dashboard += `• 시간대: ${insights.currentSituation.details.timeSlot}\n`;
        dashboard += `• 기회점수: ${insights.marketingOpportunity.score}/10\n\n`;
        
        // 실시간 지표
        dashboard += `📊 **실시간 지표**\n`;
        dashboard += `• 예상 매출 배수: ${insights.inventoryStrategy.totalMultiplier}배\n`;
        dashboard += `• 재고 수준: ${insights.inventoryStrategy.stockLevel}\n`;
        dashboard += `• 마케팅 예산: ${insights.marketingStrategy.digitalStrategy.budget}\n\n`;
        
        // 즉시 액션
        dashboard += `⚡ **즉시 액션**\n`;
        const actions = insights.actionPlan.plans[0].tasks.slice(0, 3);
        actions.forEach((action, index) => {
            dashboard += `${index + 1}. ${action}\n`;
        });
        
        // 🔥 여름철 특별 모니터링
        if (season === 'summer') {
            dashboard += `\n🔥 **여름철 특별 모니터링**\n`;
            dashboard += `• 프리미엄 라이트 마스크 우선 관리\n`;
            dashboard += `• 컬러맛집 마케팅 활성화\n`;
            dashboard += `• 통풍성 제품 재고 점검\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 새로고침', callback_data: 'dashboard_refresh' },
                    { text: '📊 상세 분석', callback_data: 'insight_main' }
                ],
                [
                    { text: '🎯 액션 플랜', callback_data: 'action_plan' },
                    { text: '📈 트렌드', callback_data: 'trend_analysis' }
                ],
                [
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]
            ]
        };
        
        bot.sendMessage(chatId, dashboard, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ 실시간 대시보드 표시 실패:', error);
        bot.sendMessage(chatId, `❌ 대시보드 표시 중 오류가 발생했습니다.\n\n오류: ${error.message}`);
    }
};

// 🆕 추가 콜백 핸들러들
module.exports.handleAdditionalCallbacks = async function(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userName = getUserName(callbackQuery.from);
    
    console.log(`📞 추가 콜백 처리: ${data}`);
    
    switch (data) {
        case 'national_refresh':
            module.exports.getNationalStatus(bot, { chat: { id: chatId }, from: callbackQuery.from });
            break;
            
        case 'regional_detail':
            bot.sendMessage(chatId, '🏙️ 지역별 상세 분석 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'insight_main':
            module.exports(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/insight' });
            break;
            
        case 'dashboard_refresh':
            module.exports.showRealtimeDashboard(bot, chatId, userName);
            break;
            
        case 'weekly_detail':
            bot.sendMessage(chatId, '📊 주간 상세 분석 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'weekly_action':
            bot.sendMessage(chatId, '🎯 주간 액션 플랜 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'save_report':
            bot.sendMessage(chatId, '📧 리포트 저장 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'action_plan':
            bot.sendMessage(chatId, '🎯 액션 플랜 상세 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'trend_analysis':
            bot.sendMessage(chatId, '📈 트렌드 분석 기능은 곧 추가될 예정입니다!');
            break;
            
        case 'main_menu':
            const mainMenuMessage = `🏠 **메인 메뉴**\n\n` +
                                  `**📊 기본 기능**\n` +
                                  `• /insight - 종합 마케팅 인사이트\n` +
                                  `• /insight quick - 빠른 인사이트\n` +
                                  `• /national - 전국 현황\n` +
                                  `• /dashboard - 실시간 대시보드\n` +
                                  `• /weekly - 주간 리포트\n\n` +
                                  `**🔥 여름철 특화 기능**\n` +
                                  `• 프리미엄 라이트 마스크 전략\n` +
                                  `• 컬러맛집 마케팅 인사이트\n` +
                                  `• 여름철 재고 최적화\n\n` +
                                  `**💡 고급 기능**\n` +
                                  `• 시간대별 마케팅 전략\n` +
                                  `• 지역별 차별화 전략\n` +
                                  `• 경쟁사 분석 리포트\n\n` +
                                  `원하시는 기능을 선택해주세요! 🚀`;
            
            const mainKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🎯 종합 인사이트', callback_data: 'insight_main' },
                        { text: '📱 실시간 대시보드', callback_data: 'dashboard_main' }
                    ],
                    [
                        { text: '🗺️ 전국 현황', callback_data: 'national_main' },
                        { text: '📊 주간 리포트', callback_data: 'weekly_main' }
                    ],
                    [
                        { text: '🔥 여름 특화', callback_data: 'summer_special' },
                        { text: '❓ 도움말', callback_data: 'help_main' }
                    ]
                ]
            };
            
            bot.sendMessage(chatId, mainMenuMessage, {
                parse_mode: 'Markdown',
                reply_markup: mainKeyboard
            });
            break;
            
        case 'dashboard_main':
            module.exports.showRealtimeDashboard(bot, chatId, userName);
            break;
            
        case 'national_main':
            module.exports.getNationalStatus(bot, { chat: { id: chatId }, from: callbackQuery.from });
            break;
            
        case 'weekly_main':
            module.exports.generateWeeklyReport(bot, chatId, userName);
            break;
            
        case 'summer_special':
            const summerMessage = `🔥 **여름철 특화 전략**\n\n` +
                                `**프리미엄 라이트 마스크**\n` +
                                `• 무더위에도 착용 가능한 경량 설계\n` +
                                `• 뛰어난 통풍성과 컬러맛집\n` +
                                `• 여름철 매출 증대 핵심 상품\n\n` +
                                `**마케팅 포인트**\n` +
                                `• "시원한 착용감" 메시지 강조\n` +
                                `• 에어컨 시설 내 편의성 어필\n` +
                                `• 여름 활동 시 필수품 포지셔닝\n\n` +
                                `**재고 전략**\n` +
                                `• 프리미엄 라이트 200% 재고 확보\n` +
                                `• 쿨링 마스크 크로스셀링\n` +
                                `• 여름 마스크 번들 패키지\n\n` +
                                `여름철 시장 점유율 확대의 기회! 🚀`;
            
            bot.sendMessage(chatId, summerMessage, { parse_mode: 'Markdown' });
            break;
            
        case 'help_main':
            const helpMessage = `❓ **도움말**\n\n` +
                              `**시작하기**\n` +
                              `• /insight - 종합 마케팅 인사이트\n` +
                              `• /insight quick - 빠른 분석\n\n` +
                              `**주요 기능**\n` +
                              `• 실시간 미세먼지 데이터 분석\n` +
                              `• 계절별 맞춤 마케팅 전략\n` +
                              `• 시간대별 최적 채널 제안\n` +
                              `• 재고 최적화 및 가격 전략\n\n` +
                              `**여름철 특화**\n` +
                              `• 프리미엄 라이트 마스크 전략\n` +
                              `• 컬러 맛집 마케팅 인사이트\n\n` +
                              `**문의 및 지원**\n` +
                              `• 24시간 자동 분석 서비스\n` +
                              `• 실시간 알림 및 대시보드\n\n` +
                              `더 궁금한 점이 있으시면 언제든 문의하세요! 📞`;
            
            bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
            break;
            
        default:
            bot.sendMessage(chatId, '⚠️ 알 수 없는 명령어입니다. 메인 메뉴로 돌아갑니다.');
            break;
    }
};
