// enhanced_dust_marketing_insights.js - 새부리형/귀편한 마스크 특화 리팩토링 버전

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
        
        // 🆕 새부리형/귀편한 마스크 중심 계절별 비즈니스 전략
        this.seasonalBusinessData = {
            spring: { // 3-5월 (성수기 - 황사철)
                name: '봄철 황사 성수기',
                season_type: '성수기',
                dustEvents: ['황사', '꽃가루', '미세먼지', '중국발 스모그'],
                peakMonths: [3, 4, 5],
                salesMultiplier: 3.2, // 높은 성수기 배수
                keyProducts: {
                    primary: ['KF94 새부리형 마스크', '귀편한 황사방지 마스크', 'N95 새부리형'],
                    secondary: ['어린이용 새부리형', '공기청정기 필터', '차량용 에어필터'],
                    trending: ['2D 새부리형 마스크', '귀아프지않는 마스크', '황사차단 새부리형']
                },
                marketingMessages: [
                    '황사 완벽 차단! 새부리형 KF94',
                    '귀 아프지 않는 편안한 착용감',
                    '봄철 외출 필수템 새부리형',
                    '숨쉬기 편한 2D 새부리 구조'
                ],
                priceStrategy: 'premium', // 성수기 프리미엄 가격
                inventory: {
                    stockLevel: 'high', // 400% 재고 확보
                    turnoverRate: 'very_fast', // 매우 빠른 회전율
                    criticalProducts: ['KF94 새부리형 마스크', '귀편한 황사방지 마스크']
                }
            },
            summer: { // 6-8월 (비수기 - 숨쉬기 편한 마스크 중심)
                name: '하절기 비수기 (숨쉬기 편한 마스크)',
                season_type: '비수기',
                dustEvents: ['오존', '자외선', '폭염', '실내 냉방'],
                peakMonths: [6, 7, 8],
                salesMultiplier: 1.2, // 비수기 낮은 배수
                keyProducts: {
                    primary: ['숨쉬기 편한 새부리형', '통풍 새부리 마스크', '귀편한 여름용'],
                    secondary: ['메쉬 새부리형', 'UV차단 새부리형', '경량 귀편한 마스크'],
                    trending: ['시원한 새부리형', '여름용 귀편한', '통기성 새부리 마스크']
                },
                marketingMessages: [
                    '무더위에도 숨쉬기 편한 새부리형!',
                    '귀 아프지 않는 여름 필수템',
                    '통풍 좋은 2D 새부리 구조',
                    '여름철에도 편안한 착용감'
                ],
                priceStrategy: 'value', // 비수기 가성비 어필
                inventory: {
                    stockLevel: 'medium', // 150% 재고 확보
                    turnoverRate: 'steady', // 안정적 회전율
                    criticalProducts: ['숨쉬기 편한 새부리형', '귀편한 여름용']
                }
            },
            autumn: { // 9-11월 (성수기 - 미세먼지 재시작)
                name: '가을철 미세먼지 성수기',
                season_type: '성수기',
                dustEvents: ['미세먼지', '초미세먼지', '대기 정체', '중국발 스모그'],
                peakMonths: [9, 10, 11],
                salesMultiplier: 2.8,
                keyProducts: {
                    primary: ['KF94 새부리형 일반', '귀편한 데일리 마스크', 'KF80 새부리형'],
                    secondary: ['실내용 새부리형', '사무실용 귀편한', '장시간용 새부리형'],
                    trending: ['패션 새부리형', '컬러 귀편한 마스크', '슬림 새부리형']
                },
                marketingMessages: [
                    '가을 미세먼지 완벽 대응 새부리형',
                    '하루종일 귀 편한 착용감',
                    '장시간 착용도 숨쉬기 편한',
                    '스타일과 보호 모두, 새부리형'
                ],
                priceStrategy: 'balanced', // 균형잡힌 가격 정책
                inventory: {
                    stockLevel: 'high', // 300% 재고 확보
                    turnoverRate: 'fast', // 빠른 회전율
                    criticalProducts: ['KF94 새부리형 일반', '귀편한 데일리 마스크']
                }
            },
            winter: { // 12-2월 (성수기 - 최대 성수기)
                name: '동절기 최대 성수기 (방한+방진)',
                season_type: '최대 성수기',
                dustEvents: ['미세먼지', '난방 오염', '스모그', '실내 공기 오염'],
                peakMonths: [12, 1, 2],
                salesMultiplier: 3.5, // 최고 성수기 배수
                keyProducts: {
                    primary: ['방한 새부리형 마스크', '귀편한 윈터 마스크', 'KF94 보온 새부리형'],
                    secondary: ['실내용 공기청정기', '가습기 필터', '헤파필터'],
                    trending: ['목도리 일체형 새부리', '귀마개 일체형', '보온 귀편한 마스크']
                },
                marketingMessages: [
                    '추위와 미세먼지 동시 차단 새부리형',
                    '따뜻하고 귀편한 겨울 마스크',
                    '실내외 완벽 보호 새부리형',
                    '겨울철 최고의 선택, 귀편한 마스크'
                ],
                priceStrategy: 'premium', // 최대 성수기 프리미엄
                inventory: {
                    stockLevel: 'very_high', // 500% 재고 확보
                    turnoverRate: 'very_fast', // 매우 빠른 회전율
                    criticalProducts: ['방한 새부리형 마스크', '귀편한 윈터 마스크']
                }
            }
        };

        // 🆕 미세먼지 농도별 새부리형/귀편한 마스크 중심 시나리오
        this.dustLevelScenarios = {
            good: { // 0-30㎍/㎥ (깨끗함)
                name: '좋음',
                emoji: '😊',
                color: '🟢',
                businessImpact: 'low',
                salesMultiplier: 0.8,
                scenarios: [
                    {
                        situation: '맑은 날씨 지속',
                        strategy: '예방 마케팅 + 편의성 강조',
                        products: ['귀편한 일반 마스크', '패션 새부리형', '예비용 새부리형'],
                        messaging: '평상시에도 편안한 새부리형',
                        urgency: 'low'
                    },
                    {
                        situation: '야외 활동 증가',
                        strategy: '라이프스타일 + 편의성 마케팅',
                        products: ['스포츠 새부리형', '아웃도어 귀편한', '휴대용 새부리형'],
                        messaging: '활동적인 하루, 귀편한 선택',
                        urgency: 'low'
                    }
                ]
            },
            moderate: { // 31-80㎍/㎥ (보통)
                name: '보통',
                emoji: '😐',
                color: '🟡',
                businessImpact: 'medium',
                salesMultiplier: 1.5,
                scenarios: [
                    {
                        situation: '일상적 착용 필요',
                        strategy: '편안함 + 실용성 어필',
                        products: ['KF80 새부리형', '귀편한 일회용', '다량 새부리형 팩'],
                        messaging: '하루종일 귀편한 새부리형',
                        urgency: 'medium'
                    },
                    {
                        situation: '민감군 주의',
                        strategy: '건강 + 편의성 마케팅',
                        products: ['어린이용 새부리형', '고령자용 귀편한', '민감군 전용 새부리형'],
                        messaging: '소중한 가족, 편안한 새부리형으로',
                        urgency: 'medium'
                    }
                ]
            },
            bad: { // 81-150㎍/㎥ (나쁨)
                name: '나쁨',
                emoji: '😷',
                color: '🟠',
                businessImpact: 'high',
                salesMultiplier: 3.0,
                scenarios: [
                    {
                        situation: '외출 시 필수 착용',
                        strategy: '보호력 + 편안함 강조 마케팅',
                        products: ['KF94 새부리형', '고성능 귀편한 마스크', '대용량 새부리형 팩'],
                        messaging: '강력한 보호, 편안한 착용감',
                        urgency: 'high'
                    },
                    {
                        situation: '학교/직장 대응',
                        strategy: 'B2B + 편의성 강화',
                        products: ['단체용 새부리형', '사무실용 귀편한 팩', '학교 납품용 새부리형'],
                        messaging: '모두가 편안한 새부리형 마스크',
                        urgency: 'high'
                    },
                    {
                        situation: '실내 공기질 관리',
                        strategy: '토탈 솔루션 + 편안함',
                        products: ['공기청정기', '필터 교체', '실내용 귀편한 마스크'],
                        messaging: '실내외 완벽 차단, 귀편한 솔루션',
                        urgency: 'high'
                    }
                ]
            },
            veryBad: { // 151㎍/㎥+ (매우나쁨)
                name: '매우나쁨',
                emoji: '😵',
                color: '🔴',
                businessImpact: 'critical',
                salesMultiplier: 4.5,
                scenarios: [
                    {
                        situation: '비상 상황 대응',
                        strategy: '최고 보호력 + 장시간 착용 편의성',
                        products: ['KF94 프리미엄 새부리형', 'N95 귀편한 마스크', '의료진용 새부리형'],
                        messaging: '생명 보호, 하루종일 편안한',
                        urgency: 'critical'
                    },
                    {
                        situation: '대량 수요 폭증',
                        strategy: '공급 최우선 + 품질 보증',
                        products: ['재고 확보 새부리형', '긴급 배송 귀편한', '대량 할인 새부리형 팩'],
                        messaging: '지금 확보하세요, 새부리형',
                        urgency: 'critical'
                    },
                    {
                        situation: '미디어 주목',
                        strategy: 'PR + 브랜드 신뢰성',
                        products: ['뉴스 언급 새부리형', '전문가 추천 귀편한', '인증 새부리형 마스크'],
                        messaging: '전문가 선택, 신뢰의 새부리형',
                        urgency: 'critical'
                    }
                ]
            }
        };

        // 🆕 시간대별 새부리형/귀편한 마스크 마케팅 전략
        this.timeBasedStrategies = {
            morning: { // 06:00-09:00
                name: '출근 시간대',
                focus: '외출 준비 + 하루종일 편안함',
                products: ['휴대용 새부리형', '출근용 귀편한 마스크', '대중교통용 새부리형'],
                messaging: '하루종일 편안한 출근 동반자',
                channels: ['지하철 광고', '버스 광고', '모바일 푸시']
            },
            daytime: { // 09:00-17:00
                name: '주간 시간대',
                focus: '업무 환경 + 장시간 착용',
                products: ['사무용 새부리형', '장시간 귀편한', '회의용 새부리형'],
                messaging: '업무 중에도 귀편한 착용감',
                channels: ['온라인 광고', '사무용품 쇼핑몰', 'B2B 영업']
            },
            evening: { // 17:00-21:00
                name: '퇴근 시간대',
                focus: '귀가 + 여가 활동',
                products: ['일회용 새부리형', '스포츠 귀편한', '외출용 새부리형'],
                messaging: '퇴근 후에도 편안한 새부리형',
                channels: ['퇴근길 광고', '쇼핑몰 배너', 'SNS 광고']
            },
            night: { // 21:00-06:00
                name: '야간 시간대',
                focus: '온라인 쇼핑 + 대용량',
                products: ['대용량 새부리형 팩', '가족용 귀편한 세트', '할인 새부리형'],
                messaging: '가족 모두 편안한 새부리형',
                channels: ['온라인 쇼핑몰', '라이브 커머스', '새벽 배송']
            }
        };

        // 🆕 지역별 새부리형/귀편한 마스크 특성화 전략
        this.regionalStrategies = {
            seoul: {
                name: '서울 수도권',
                characteristics: ['높은 구매력', '브랜드 선호', '편의성 중시'],
                products: ['프리미엄 새부리형', '디자인 귀편한 마스크', '브랜드 새부리형'],
                pricing: 'premium',
                channels: ['강남역 광고', '명동 매장', '온라인 프리미엄'],
                messaging: '세련된 새부리형, 편안한 일상'
            },
            busan: {
                name: '부산 경남',
                characteristics: ['실용성 중시', '가성비 중요', '습도 대응'],
                products: ['기본형 새부리형', '대용량 귀편한 팩', '습도 대응 새부리형'],
                pricing: 'value',
                channels: ['지역 마트', '온라인 할인', '로컬 광고'],
                messaging: '실용적인 새부리형, 가성비 최고'
            },
            rural: {
                name: '지방 도시',
                characteristics: ['가격 민감', '기능성 중시', '오프라인 선호'],
                products: ['경제형 새부리형', '농업용 귀편한', '작업용 새부리형'],
                pricing: 'economy',
                channels: ['마트 진열', '농협 판매', '지역 신문'],
                messaging: '경제적인 새부리형, 실속형 선택'
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

    // 🆕 실시간 대기질 정보 가져오기
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

    // 🆕 계절별 성수기/비수기 반영 더미 데이터
    getDummyAirQuality(stationName) {
        const season = this.getCurrentSeason();
        const timeSlot = this.getCurrentTimeSlot();
        
        // 성수기/비수기별 기본 농도 (실제 패턴 반영)
        const seasonalBase = {
            spring: { pm10: 85, pm25: 45 },  // 봄철 성수기 - 높음
            summer: { pm10: 25, pm25: 12 },  // 여름철 비수기 - 낮음  
            autumn: { pm10: 70, pm25: 35 },  // 가을철 성수기 - 중간
            winter: { pm10: 75, pm25: 38 }   // 겨울철 최대 성수기 - 높음
        };

        // 시간대별 변동
        const timeMultiplier = {
            morning: 1.4,   // 출근 시간 높음
            daytime: 1.0,   // 주간 보통
            evening: 1.3,   // 퇴근 시간 높음
            night: 0.7      // 야간 낮음
        };

        const base = seasonalBase[season];
        const multiplier = timeMultiplier[timeSlot];
        const variation = Math.floor(Math.random() * 25) - 12;

        const pm10 = Math.max(0, Math.round((base.pm10 + variation) * multiplier));
        const pm25 = Math.max(0, Math.round((base.pm25 + variation) * multiplier));

        console.log(`🎲 ${season}(${this.seasonalBusinessData[season].season_type})/${timeSlot} 더미 데이터: PM10=${pm10}, PM2.5=${pm25}`);

        return {
            station: stationName,
            pm10: pm10,
            pm25: pm25,
            o3: 0.025 + Math.random() * 0.03,
            no2: 0.015 + Math.random() * 0.02,
            co: 0.4 + Math.random() * 0.4,
            so2: 0.002 + Math.random() * 0.003,
            dataTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
    }

    // 🆕 새부리형/귀편한 마스크 중심 종합 인사이트 생성
    generateMarketingInsights(dustData, userName) {
        const dustLevel = this.getDustLevel(dustData.pm10, dustData.pm25);
        const season = this.getCurrentSeason();
        const timeSlot = this.getCurrentTimeSlot();
        
        const seasonalData = this.seasonalBusinessData[season];
        const dustScenario = this.dustLevelScenarios[dustLevel];
        const timeStrategy = this.timeBasedStrategies[timeSlot];

        console.log(`💡 새부리형/귀편한 마스크 인사이트 생성: ${season}(${seasonalData.season_type})/${dustLevel}/${timeSlot}`);
        
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

    // 🆕 현재 상황 분석 (성수기/비수기 포함)
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
                seasonType: seasonalData.season_type,
                timeSlot: timeStrategy.name,
                dustLevel: dustScenario.name,
                businessImpact: dustScenario.businessImpact,
                seasonalEvents: seasonalData.dustEvents.join(', '),
                primaryProducts: seasonalData.keyProducts.primary.join(', '),
                riskLevel: this.calculateRiskLevel(dustScenario.businessImpact, seasonalData.season_type)
            }
        };
    }

    // 리스크 레벨 계산 (성수기/비수기 + 미세먼지 수준)
    calculateRiskLevel(businessImpact, seasonType) {
        const seasonRisk = {
            '최대 성수기': 3,
            '성수기': 2,
            '비수기': 1
        };
        
        const impactRisk = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        };
        
        const totalRisk = seasonRisk[seasonType] + impactRisk[businessImpact];
        
        if (totalRisk >= 6) return 'critical';
        if (totalRisk >= 5) return 'high';
        if (totalRisk >= 3) return 'medium';
        return 'low';
    }

    // 🆕 제품 전략 (새부리형/귀편한 마스크 특화)
    getProductStrategy(dustLevel, season, timeSlot) {
        const seasonalData = this.seasonalBusinessData[season];
        const dustScenario = this.dustLevelScenarios[dustLevel];
        const timeStrategy = this.timeBasedStrategies[timeSlot];

        // 🔥 여름철 비수기 특별 전략
        if (season === 'summer') {
            return {
                focus: '숨쉬기 편한 새부리형 마스크 집중 마케팅',
                primaryProduct: '숨쉬기 편한 새부리형',
                reasoning: '하절기 비수기 - 무더위에도 편안한 착용감과 통풍성 강조',
                strategy: [
                    '숨쉬기 편한 새부리형 메인 진열',
                    '귀편한 마스크 편의성 마케팅',
                    '비수기 가성비 브랜딩 강화',
                    '냉방 시설 내 장시간 착용 편의성 어필'
                ],
                crossSelling: ['통풍 새부리형', '메쉬 귀편한', '경량 새부리형'],
                bundling: ['숨쉬기 편한 + 귀편한 세트', '여름용 새부리형 3종 세트'],
                seasonContext: '하절기 비수기 전략'
            };
        }

        // 성수기 전략
        if (seasonalData.season_type === '성수기' || seasonalData.season_type === '최대 성수기') {
            return {
                focus: `${seasonalData.season_type} 새부리형/귀편한 마스크 전략`,
                primaryProduct: seasonalData.keyProducts.primary[0],
                reasoning: `${seasonalData.season_type} - 높은 수요 대비 최고 품질과 편의성 제공`,
                strategy: [
                    `${seasonalData.keyProducts.primary[0]} 최우선 진열`,
                    '귀편한 마스크 장점 집중 홍보',
                    `${seasonalData.season_type} 프리미엄 브랜딩`,
                    '새부리형 구조의 우수성 강조'
                ],
                crossSelling: seasonalData.keyProducts.secondary,
                bundling: this.generateBundlingStrategy(season, dustLevel),
                seasonContext: seasonalData.season_type
            };
        }

        return {
            focus: `${seasonalData.name} 핵심 상품`,
            primaryProduct: seasonalData.keyProducts.primary[0],
            strategy: this.generateProductStrategy(dustLevel, season, seasonalData),
            crossSelling: seasonalData.keyProducts.secondary,
            bundling: this.generateBundlingStrategy(season, dustLevel),
            seasonContext: seasonalData.season_type
        };
    }

    // 🆕 마케팅 기회 분석 (성수기/비수기 강화)
    getMarketingOpportunity(dustLevel, season, dustScenario, seasonalData) {
        const baseScore = dustScenario.salesMultiplier * seasonalData.salesMultiplier;
        const finalScore = Math.min(10, Math.round(baseScore));
        
        const selectedScenario = dustScenario.scenarios[Math.floor(Math.random() * dustScenario.scenarios.length)];
        
        return {
            score: finalScore,
            level: dustScenario.businessImpact,
            seasonType: seasonalData.season_type,
            scenario: selectedScenario,
            seasonalMultiplier: seasonalData.salesMultiplier,
            opportunities: [{
                type: selectedScenario.urgency,
                title: `${dustScenario.emoji} ${selectedScenario.situation}`,
                description: selectedScenario.strategy,
                messaging: selectedScenario.messaging,
                products: selectedScenario.products,
                actions: this.generateActions(dustLevel, season, selectedScenario.urgency),
                seasonContext: `${seasonalData.season_type} 대응 전략`
            }]
        };
    }

    // 🆕 강화된 리포트 포맷팅 (새부리형/귀편한 마스크 중심)
    formatEnhancedInsightReport(insights, dustData, userName) {
        const koreaTime = new Date(dustData.dataTime).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        let report = `📊 **${userName}님의 새부리형/귀편한 마스크 인사이트**\n\n`;
        
        // 현재 상황 (성수기/비수기 포함)
        report += `🌫️ **현재 상황** (${koreaTime})\n`;
        report += `• 측정소: ${dustData.station}\n`;
        report += `• PM10: ${dustData.pm10}㎍/㎥ | PM2.5: ${dustData.pm25}㎍/㎥\n`;
        report += `• 상태: ${insights.currentSituation.summary}\n`;
        report += `• 시기: ${insights.currentSituation.details.seasonType}\n`;
        report += `• 시간대: ${insights.currentSituation.details.timeSlot}\n`;
        report += `• 비즈니스 리스크: ${insights.currentSituation.details.riskLevel}\n\n`;
        
        // 마케팅 기회 (성수기/비수기 강화)
        report += `🎯 **마케팅 기회 점수: ${insights.marketingOpportunity.score}/10**\n`;
        const opportunity = insights.marketingOpportunity.opportunities[0];
        report += `${opportunity.title}\n`;
        report += `📢 메시지: ${opportunity.messaging}\n`;
        report += `🎁 핵심 상품: ${opportunity.products.join(', ')}\n`;
        report += `📅 시기 전략: ${opportunity.seasonContext}\n\n`;
        
        // 🔥 제품 전략 (새부리형/귀편한 마스크 특화)
        report += `🎁 **제품 전략** (${insights.productStrategy.seasonContext})\n`;
        report += `• 주력 상품: ${insights.productStrategy.primaryProduct}\n`;
        report += `• 전략 포커스: ${insights.productStrategy.focus}\n`;
        if (insights.productStrategy.crossSelling) {
            report += `• 크로스셀링: ${insights.productStrategy.crossSelling.join(', ')}\n`;
        }
        if (insights.productStrategy.bundling) {
            report += `• 번들링: ${insights.productStrategy.bundling.join(', ')}\n`;
        }
        report += '\n';
        
        // 가격 전략 (성수기/비수기 반영)
        report += `💰 **가격 전략**\n`;
        report += `• 정책: ${insights.pricingStrategy.strategy}\n`;
        report += `• 계절 배수: ${insights.pricingStrategy.seasonalAdjustment}배\n`;
        report += `• 미세먼지 배수: ${insights.pricingStrategy.dustLevelAdjustment}배\n`;
        report += `• 총 기회 배수: ${Math.round(insights.pricingStrategy.seasonalAdjustment * insights.pricingStrategy.dustLevelAdjustment * 100) / 100}배\n\n`;
        
        // 재고 전략
        report += `📦 **재고 전략**\n`;
        report += `• 재고 수준: ${insights.inventoryStrategy.stockLevel}\n`;
        report += `• 회전율: ${insights.inventoryStrategy.turnoverRate}\n`;
        report += `• 총 배수: ${insights.inventoryStrategy.totalMultiplier}배\n`;
        report += `• 핵심 관리: ${insights.inventoryStrategy.criticalProducts.join(', ')}\n\n`;
        
        // 액션 플랜
        report += `📋 **즉시 액션 플랜**\n`;
        insights.actionPlan.plans.forEach(plan => {
            report += `**${plan.title}**\n`;
            plan.tasks.slice(0, 3).forEach(task => {
                report += `• ${task}\n`;
            });
        });
        
        return report;
    }

    // 헬퍼 메서드들 (새부리형/귀편한 마스크 중심으로 수정)
    generateProductStrategy(dustLevel, season, seasonalData) {
        return [
            `${seasonalData.keyProducts.primary[0]} 주력 상품 집중`,
            '새부리형 마스크 구조적 우수성 강조',
            '귀편한 마스크 편의성 마케팅',
            `${seasonalData.name} 특화 전략`
        ];
    }

    generateBundlingStrategy(season, dustLevel) {
        const bundles = {
            spring: ['새부리형 황사 대응 패키지', '귀편한 봄철 건강 세트', '가족 보호 새부리형 패키지'],
            summer: ['숨쉬기 편한 여름 패키지', '귀편한 새부리형 세트', '통풍 마스크 콤보'],
            autumn: ['새부리형 가을 미세먼지 세트', '귀편한 일상 보호 패키지', '장시간 착용 새부리형 세트'],
            winter: ['방한 새부리형 겨울 패키지', '귀편한 실내외 보호 세트', '보온 새부리형 시즌 세트']
        };

        return bundles[season] || ['기본 새부리형 패키지'];
    }

    generateActions(dustLevel, season, urgency) {
        const seasonalData = this.seasonalBusinessData[season];
        const actions = {
            critical: [
                `즉시 ${seasonalData.keyProducts.primary[0]} 재고 확보`,
                '24시간 새부리형/귀편한 마스크 CS 대응',
                '전 채널 새부리형 마스크 광고 최대 투입',
                '언론 대응 및 브랜드 PR 활동'
            ],
            high: [
                `${seasonalData.keyProducts.primary[0]} 재고 점검 및 추가 주문`,
                '새부리형/귀편한 마스크 마케팅 예산 150% 증대',
                '고객 문의 대응 강화 (편의성 중심)',
                '경쟁사 동향 모니터링'
            ],
            medium: [
                '새부리형 마스크 재고 현황 확인',
                '귀편한 마스크 타겟 마케팅 실행',
                '고객 교육 콘텐츠 제작 (착용법, 장점)',
                '판매 데이터 분석'
            ],
            low: [
                '새부리형/귀편한 마스크 브랜드 마케팅 강화',
                '고객 관계 관리 (만족도 조사)',
                '제품 개선 피드백 수집',
                '장기 전략 수립'
            ]
        };

        return actions[urgency] || actions.medium;
    }

    // 나머지 메서드들도 새부리형/귀편한 마스크 중심으로 조정
    getPricingStrategy(dustLevel, season, seasonalData) {
        const priceStrategies = {
            premium: {
                approach: '프리미엄 가격 정책',
                reasoning: `${seasonalData.season_type} 높은 수요 대비 최고 품질 새부리형/귀편한 마스크 제공`,
                tactics: ['한정판 새부리형 마케팅', '프리미엄 브랜딩', '품질 보증']
            },
            value: {
                approach: '가성비 가격 정책',
                reasoning: '편의성과 품질 대비 합리적 가격으로 시장 점유율 확대',
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

    generatePricingRecommendations(dustLevel, season) {
        const seasonalData = this.seasonalBusinessData[season];
        const recommendations = [];
        
        if (seasonalData.season_type === '최대 성수기') {
            recommendations.push('최대 성수기 프리미엄 가격 적용');
            recommendations.push('새부리형/귀편한 마스크 번들 할인');
        } else if (seasonalData.season_type === '성수기') {
            recommendations.push('성수기 가격 + 15% 적용');
            recommendations.push('대량 구매 시 새부리형 마스크 할인');
        } else if (seasonalData.season_type === '비수기') {
            recommendations.push('비수기 가성비 마케팅 강화');
            recommendations.push('귀편한 마스크 편의성 가치 부각');
        }

        return recommendations;
    }

    getInventoryStrategy(dustLevel, season, seasonalData) {
        const inventory = seasonalData.inventory;
        const dustMultiplier = this.dustLevelScenarios[dustLevel].salesMultiplier;
        
        const stockLevels = {
            very_high: '500%',
            high: '400%',
            medium: '200%',
            low: '150%'
        };

        return {
            stockLevel: stockLevels[inventory.stockLevel] || '200%',
            turnoverRate: inventory.turnoverRate,
            criticalProducts: inventory.criticalProducts,
            seasonalDemand: seasonalData.salesMultiplier,
            dustDemand: dustMultiplier,
            totalMultiplier: Math.round(seasonalData.salesMultiplier * dustMultiplier * 100) / 100,
            strategy: this.generateInventoryStrategy(dustLevel, season, inventory),
            riskProducts: this.identifyRiskProducts(dustLevel, season)
        };
    }

    generateInventoryStrategy(dustLevel, season, inventory) {
        const seasonalData = this.seasonalBusinessData[season];
        return [
            `${seasonalData.season_type} ${inventory.stockLevel} 재고 수준 유지`,
            `${inventory.turnoverRate} 회전율 예상`,
            `새부리형/귀편한 마스크 우선 관리: ${inventory.criticalProducts.join(', ')}`,
            '공급업체 다변화 및 품질 관리 강화'
        ];
    }

    identifyRiskProducts(dustLevel, season) {
        const seasonalData = this.seasonalBusinessData[season];
        const riskProducts = [];
        
        if (dustLevel === 'veryBad') {
            riskProducts.push('모든 새부리형 KF94 제품군');
            riskProducts.push('귀편한 N95 마스크');
        } else if (dustLevel === 'bad') {
            riskProducts.push('KF94 새부리형 일반');
            riskProducts.push('어린이용 귀편한 마스크');
        }

        // 성수기 추가 리스크 상품
        if (seasonalData.season_type === '성수기' || seasonalData.season_type === '최대 성수기') {
            riskProducts.push(...seasonalData.keyProducts.primary);
        }

        return riskProducts;
    }

    // 나머지 메서드들 (기존과 동일하지만 새부리형/귀편한 마스크 키워드 포함)
    getMarketingStrategy(dustLevel, season, timeSlot) {
        const seasonalData = this.seasonalBusinessData[season];
        const timeStrategy = this.timeBasedStrategies[timeSlot];
        const dustScenario = this.dustLevelScenarios[dustLevel];

        return {
            mainStrategy: {
                title: `${timeStrategy.name} ${dustScenario.name} 새부리형/귀편한 마스크 전략`,
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

    getDigitalStrategy(dustLevel, season, timeSlot) {
        return {
            channels: ['네이버 스마트스토어', '쿠팡', '11번가', '온라인 자체몰'],
            tactics: ['새부리형 마스크 검색 광고', 'SNS 귀편한 마스크 광고', '인플루언서 협업', '라이브 커머스'],
            budget: dustLevel === 'veryBad' ? '최대 투입' : dustLevel === 'bad' ? '200% 증대' : '정상 운영',
            keywords: ['새부리형 마스크', '귀편한 마스크', '숨쉬기 편한', 'KF94 새부리형']
        };
    }

    getOfflineStrategy(dustLevel, season, timeSlot) {
        return {
            channels: ['약국', '마트', '편의점', '대형마트'],
            tactics: ['새부리형 마스크 진열 최적화', '귀편한 마스크 매장 프로모션', '샘플 제공', 'POP 광고'],
            focus: timeSlot === 'morning' ? '출근길 매장' : timeSlot === 'evening' ? '퇴근길 매장' : '주거지 매장',
            displayFocus: '새부리형 구조와 귀편한 착용감 강조'
        };
    }

    getContentStrategy(dustLevel, season, timeSlot) {
        return {
            types: ['새부리형 마스크 교육 콘텐츠', '귀편한 착용법 가이드', '건강 정보', '제품 비교'],
            platforms: ['유튜브', '인스타그램', '네이버 블로그', '카카오톡'],
            urgency: dustLevel === 'veryBad' ? '긴급 제작' : '정기 제작',
            focus: '새부리형 마스크의 우수성과 귀편한 착용감 강조'
        };
    }

    getCompetitorStrategy(dustLevel, season) {
        return {
            monitoring: ['경쟁사 새부리형 마스크 가격', '귀편한 마스크 재고 현황', '마케팅 메시지', '신제품 출시'],
            opportunities: ['경쟁사 품절 시 새부리형 마스크 점유율 확대', '귀편한 마스크 차별화 메시지 강화'],
            threats: ['새부리형 마스크 가격 경쟁 심화', '신규 귀편한 마스크 진입자 증가']
        };
    }

    getRiskManagement(dustLevel, season, dustScenario) {
        const seasonalData = this.seasonalBusinessData[season];
        const risks = [];
        
        if (dustScenario.businessImpact === 'critical' || seasonalData.season_type === '최대 성수기') {
            risks.push({
                type: 'supply',
                title: '새부리형/귀편한 마스크 공급 부족 리스크',
                probability: 'high',
                impact: 'critical',
                mitigation: ['긴급 발주', '대체 공급업체 확보', '생산 라인 확대', '핵심 제품 우선 생산']
            });
        }

        return {
            level: dustScenario.businessImpact,
            seasonRisk: seasonalData.season_type,
            risks: risks
        };
    }

    getActionPlan(dustLevel, season, timeSlot, dustScenario) {
        const seasonalData = this.seasonalBusinessData[season];
        const plans = [];
        
        if (dustScenario.businessImpact === 'critical' || seasonalData.season_type === '최대 성수기') {
            plans.push({
                timeframe: 'immediate',
                title: '🚨 비상 대응 (즉시)',
                tasks: [
                    '전 직원 비상 소집',
                    '새부리형/귀편한 마스크 재고 실시간 점검',
                    '언론 대응 준비',
                    '24시간 CS 체계 가동',
                    '핵심 제품 긴급 생산 지시'
                ]
            });
        } else if (dustScenario.businessImpact === 'high' || seasonalData.season_type === '성수기') {
            plans.push({
                timeframe: 'urgent',
                title: '⚡ 긴급 대응 (1-2시간)',
                tasks: [
                    '새부리형/귀편한 마스크 재고 확보',
                    '마케팅 예산 증대',
                    '고객 문의 대응 강화',
                    '경쟁사 동향 모니터링',
                    '주요 판매처 재고 점검'
                ]
            });
        } else {
            plans.push({
                timeframe: 'normal',
                title: '📊 일반 대응 (1-2일)',
                tasks: [
                    '정기 재고 점검',
                    '새부리형/귀편한 마스크 마케팅 최적화',
                    '고객 피드백 수집',
                    '장기 전략 수립',
                    '제품 개선 검토'
                ]
            });
        }

        return {
            totalPlans: plans.length,
            plans: plans,
            seasonContext: seasonalData.season_type
        };
    }

    getRegionalStrategy(dustLevel, season) {
        return {
            seoul: {
                ...this.regionalStrategies.seoul,
                focus: '프리미엄 새부리형/귀편한 마스크'
            },
            busan: {
                ...this.regionalStrategies.busan,
                focus: '실용적 새부리형/귀편한 마스크'
            },
            rural: {
                ...this.regionalStrategies.rural,
                focus: '경제적 새부리형/귀편한 마스크'
            },
            recommendation: '지역별 새부리형/귀편한 마스크 맞춤 전략 필요'
        };
    }

    // 전국 현황 조회
    async getNationalDustStatus() {
        const results = [];
        const cities = Object.entries(MONITORING_STATIONS).slice(0, 5);

        for (const [cityName, stationName] of cities) {
            try {
                const data = await this.getCurrentAirQuality(stationName);
                const dustLevel = this.getDustLevel(data.pm10, data.pm25);
                const dustScenario = this.dustLevelScenarios[dustLevel];
                const season = this.getCurrentSeason();
                const seasonalData = this.seasonalBusinessData[season];
                
                results.push({
                    city: cityName,
                    station: stationName,
                    pm10: data.pm10,
                    pm25: data.pm25,
                    level: dustScenario.name,
                    emoji: dustScenario.emoji,
                    color: dustScenario.color,
                    businessImpact: dustScenario.businessImpact,
                    seasonType: seasonalData.season_type,
                    recommendedProduct: seasonalData.keyProducts.primary[0]
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

    console.log(`📥 새부리형/귀편한 마스크 인사이트 요청: ${text} (사용자: ${userName})`);

    if (text === '/insight' || text === '/인사이트') {
        console.log('🔍 새부리형/귀편한 마스크 중심 종합 인사이트 생성 시작...');
        
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
                            { text: '📱 실시간 대시보드', callback_data: 'insight_dashboard' },
                            { text: '🗺️ 전국 현황', callback_data: 'insight_national' }
                        ],
                        [
                            { text: '🔄 새로고침', callback_data: 'insight_refresh' },
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                console.log('✅ 새부리형/귀편한 마스크 인사이트 전송 준비 완료');
                bot.sendMessage(chatId, report, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            })
            .catch(error => {
                console.error('❌ 새부리형/귀편한 마스크 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 인사이트 생성 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
            });

    } else if (text === '/insight quick' || text === '/인사이트 간단') {
        console.log('⚡ 새부리형/귀편한 마스크 빠른 인사이트 생성 시작...');
        
        insightManager.getCurrentAirQuality()
            .then(dustData => {
                const insights = insightManager.generateMarketingInsights(dustData, userName);
                const season = insightManager.getCurrentSeason();
                const seasonalData = insightManager.seasonalBusinessData[season];
                
                let quickReport = `⚡ **새부리형/귀편한 마스크 빠른 인사이트**\n\n`;
                quickReport += `🌫️ 미세먼지: ${insights.currentSituation.details.dustLevel} (${dustData.pm25}㎍/㎥)\n`;
                quickReport += `📅 시기: ${seasonalData.season_type}\n`;
                quickReport += `🎯 기회 점수: ${insights.marketingOpportunity.score}/10\n`;
                quickReport += `🎁 주력 상품: ${insights.productStrategy.primaryProduct}\n`;
                quickReport += `💰 총 기회 배수: ${Math.round(insights.pricingStrategy.seasonalAdjustment * insights.pricingStrategy.dustLevelAdjustment * 100) / 100}배\n\n`;
                
                // 🔥 계절별 특별 메시지
                if (season === 'summer') {
                    quickReport += `🔥 **하절기 비수기 전략**\n`;
                    quickReport += `숨쉬기 편한 새부리형 마스크 집중!\n`;
                    quickReport += `무더위에도 편안한 착용감으로 차별화\n\n`;
                } else if (seasonalData.season_type === '최대 성수기') {
                    quickReport += `🚨 **최대 성수기 전략**\n`;
                    quickReport += `새부리형/귀편한 마스크 최대 수요 예상!\n`;
                    quickReport += `재고 확보와 프리미엄 전략 필수\n\n`;
                } else if (seasonalData.season_type === '성수기') {
                    quickReport += `📈 **성수기 전략**\n`;
                    quickReport += `새부리형/귀편한 마스크 수요 증가!\n`;
                    quickReport += `적극적 마케팅과 재고 관리 필요\n\n`;
                }
                
                quickReport += `📋 **즉시 실행 사항**\n`;
                const actions = insights.actionPlan.plans[0].tasks.slice(0, 3);
                actions.forEach((action, index) => {
                    quickReport += `${index + 1}. ${action}\n`;
                });
                
                const quickKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '📊 상세 인사이트', callback_data: 'insight_full' },
                            { text: '📱 실시간 대시보드', callback_data: 'insight_dashboard' }
                        ],
                        [
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                bot.sendMessage(chatId, quickReport, { 
                    parse_mode: 'Markdown',
                    reply_markup: quickKeyboard
                });
            })
            .catch(error => {
                console.error('❌ 새부리형/귀편한 마스크 빠른 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 빠른 인사이트 생성 실패: ${error.message}`);
            });

    } else if (text === '/insight national' || text === '/인사이트 전국') {
        console.log('🗺️ 전국 새부리형/귀편한 마스크 현황 조회 시작...');
        
        insightManager.getNationalDustStatus()
            .then(nationalData => {
                let nationalReport = `🗺️ **전국 새부리형/귀편한 마스크 현황**\n\n`;
                
                nationalData.forEach(city => {
                    nationalReport += `${city.color} **${city.city}** (${city.station})\n`;
                    nationalReport += `• PM10: ${city.pm10}㎍/㎥ | PM2.5: ${city.pm25}㎍/㎥\n`;
                    nationalReport += `• 상태: ${city.emoji} ${city.level}\n`;
                    nationalReport += `• 시기: ${city.seasonType}\n`;
                    nationalReport += `• 추천: ${city.recommendedProduct}\n\n`;
                });
                
                // 전국 평균 및 권장 사항
                const averagePM10 = Math.round(nationalData.reduce((sum, city) => sum + city.pm10, 0) / nationalData.length);
                const averagePM25 = Math.round(nationalData.reduce((sum, city) => sum + city.pm25, 0) / nationalData.length);
                const season = insightManager.getCurrentSeason();
                const seasonalData = insightManager.seasonalBusinessData[season];
                
                nationalReport += `📊 **전국 평균 & 전략**\n`;
                nationalReport += `• 평균 PM10: ${averagePM10}㎍/㎥ | PM2.5: ${averagePM25}㎍/㎥\n`;
                nationalReport += `• 현재 시기: ${seasonalData.season_type}\n`;
                nationalReport += `• 전국 주력 상품: ${seasonalData.keyProducts.primary[0]}\n\n`;
                
                // 권장 마케팅 액션
                const criticalCities = nationalData.filter(city => city.businessImpact === 'critical').length;
                const highImpactCities = nationalData.filter(city => city.businessImpact === 'high').length;
                
                nationalReport += `🎯 **권장 마케팅 액션**\n`;
                if (criticalCities > 0) {
                    nationalReport += `• 🚨 ${criticalCities}개 도시 비상 - 새부리형/귀편한 마스크 긴급 공급\n`;
                    nationalReport += `• 24시간 대응 체계 및 재고 확보 필수\n`;
                } else if (highImpactCities > 0) {
                    nationalReport += `• ⚡ ${highImpactCities}개 도시 높은 수요 - 적극적 새부리형 마케팅\n`;
                    nationalReport += `• 해당 지역 귀편한 마스크 광고 예산 200% 증대\n`;
                } else {
                    nationalReport += `• 📊 안정적 상황 - 새부리형/귀편한 마스크 브랜드 마케팅\n`;
                    nationalReport += `• 장기 전략 수립 및 고객 만족도 제고\n`;
                }
                
                if (seasonalData.season_type === '최대 성수기' || seasonalData.season_type === '성수기') {
                    nationalReport += `• 🔥 ${seasonalData.season_type} - 새부리형/귀편한 마스크 최대 기회\n`;
                    nationalReport += `• 전국 재고 확보 및 프리미엄 전략 실행\n`;
                }
                
                const nationalKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔄 새로고침', callback_data: 'insight_national' },
                            { text: '📊 상세 분석', callback_data: 'insight_full' }
                        ],
                        [
                            { text: '📱 실시간 대시보드', callback_data: 'insight_dashboard' },
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                bot.sendMessage(chatId, nationalReport, {
                    parse_mode: 'Markdown',
                    reply_markup: nationalKeyboard
                });
            })
            .catch(error => {
                console.error('❌ 전국 새부리형/귀편한 마스크 현황 조회 실패:', error);
                bot.sendMessage(chatId, `❌ 전국 현황 조회 실패: ${error.message}`);
            });

    } else {
        // 강화된 도움말
        const helpMessage = `📊 **새부리형/귀편한 마스크 특화 인사이트**\n\n` +
                           `**📱 명령어**\n` +
                           `• /insight - 종합 마케팅 인사이트\n` +
                           `• /insight quick - 빠른 인사이트\n` +
                           `• /insight national - 전국 현황\n\n` +
                           `**🆕 새부리형/귀편한 마스크 특화 기능**\n` +
                           `• 성수기/비수기별 차별화 전략\n` +
                           `• 새부리형 마스크 구조적 우수성 강조\n` +
                           `• 귀편한 마스크 편의성 마케팅\n` +
                           `• 숨쉬기 편한 착용감 중심 전략\n\n` +
                           `**🎯 핵심 키워드**\n` +
                           `• 🔥 새부리형 마스크 - 2D 구조, 숨쉬기 편함\n` +
                           `• 🔥 귀편한 마스크 - 장시간 착용, 편안함\n` +
                           `• 하절기 비수기 - 통풍성, 가성비\n` +
                           `• 동절기 성수기 - 보온성, 프리미엄\n\n` +
                           `**💡 계절별 전략**\n` +
                           `• 🌸 봄철 성수기 → 황사 차단 새부리형\n` +
                           `• ☀️ 여름철 비수기 → 숨쉬기 편한 새부리형\n` +
                           `• 🍂 가을철 성수기 → 일상 보호 귀편한\n` +
                           `• ❄️ 겨울철 최대 성수기 → 방한 새부리형\n\n` +
                           `**📊 비즈니스 인사이트**\n` +
                           `• 실시간 성수기/비수기 판단\n` +
                           `• 미세먼지 농도별 맞춤 전략\n` +
                           `• 지역별 새부리형/귀편한 마스크 차별화\n` +
                           `• 시간대별 최적 마케팅 채널\n\n` +
                           `새부리형/귀편한 마스크로 시장을 선도하세요! 🚀`;

        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    }
};

// 🆕 강화된 콜백 처리 함수 (새부리형/귀편한 마스크 중심)
module.exports.handleCallback = async function(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userName = getUserName(callbackQuery.from);
    const insightManager = new EnhancedDustMarketingInsights();

    console.log(`📞 새부리형/귀편한 마스크 콜백 처리: ${data} (사용자: ${userName})`);

    try {
        // 메인 봇에서 처리해야 하는 콜백들은 여기서 처리하지 않음
        const mainBotCallbacks = [
            'insight_menu',
            'insight_quick',      // ✅ 추가
            'insight_dashboard',  // ✅ 추가
            'insight_national',   // ✅ 추가
            'insight_refresh'     // ✅ 추가
        ];
        
        if (mainBotCallbacks.includes(data)) {
            console.log(`🔄 ${data}는 메인 봇에서 처리됨 - 스킵`);
            return; // 처리하지 않고 메인 봇으로 위임
        }
        
        // 데이터가 필요한 콜백들은 미리 인사이트 생성
        let insights = null;
        let dustData = null;
        
        if (data.startsWith('insight_') && 
            !['insight_menu', 'insight_refresh', 'insight_help'].includes(data)) {
            dustData = await insightManager.getCurrentAirQuality();
            insights = insightManager.generateMarketingInsights(dustData, userName);
        }
        
        switch (data) {
            case 'insight_full':
                // 전체 인사이트 재생성
                await module.exports(bot, { 
                    chat: { id: chatId }, 
                    from: callbackQuery.from, 
                    text: '/insight' 
                });
                break;
                
            case 'insight_products':
                if (insights) {
                    await handleProductStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 제품 전략 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'insight_pricing':
                if (insights) {
                    await handlePricingStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 가격 전략 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'insight_inventory':
                if (insights) {
                    await handleInventoryStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 재고 전략 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'insight_marketing':
                if (insights) {
                    await handleMarketingStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 마케팅 전략 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'insight_regional':
                if (insights) {
                    await handleRegionalStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 지역별 전략 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'insight_competitor':
                if (insights) {
                    await handleCompetitorStrategy(bot, chatId, insights);
                } else {
                    await bot.sendMessage(chatId, "❌ 경쟁사 분석 데이터를 불러올 수 없습니다.");
                }
                break;
                
            case 'main_menu':
                await showMainMenu(bot, chatId);
                break;
                
            default:
                console.log(`⚠️ 처리되지 않은 새부리형/귀편한 마스크 콜백: ${data}`);
                // ❌ 오류 메시지를 보내지 않고 조용히 무시
                // 메인 봇에서 처리될 수 있도록 함
                break;
        }
        
    } catch (error) {
        console.error('❌ 새부리형/귀편한 마스크 콜백 처리 실패:', error);
        await bot.sendMessage(chatId, `❌ 처리 중 오류가 발생했습니다.\n\n오류: ${error.message}`);
    }
};

// ===========================================
// 🔧 새부리형/귀편한 마스크 특화 핸들러 함수들
// ===========================================

async function handleProductStrategy(bot, chatId, insights) {
    const productStrategy = insights.productStrategy;
    let productMsg = `🎁 **새부리형/귀편한 마스크 제품 전략**\n\n`;
    productMsg += `• 계절 상황: ${productStrategy.seasonContext}\n`;
    productMsg += `• 주력 상품: ${productStrategy.primaryProduct}\n`;
    productMsg += `• 전략 포커스: ${productStrategy.focus}\n\n`;
    
    if (productStrategy.reasoning) {
        productMsg += `**📋 전략 근거**\n`;
        productMsg += `${productStrategy.reasoning}\n\n`;
    }
    
    if (productStrategy.strategy) {
        productMsg += `**🎯 실행 전략**\n`;
        productStrategy.strategy.forEach(strategy => {
            productMsg += `• ${strategy}\n`;
        });
        productMsg += `\n`;
    }
    
    if (productStrategy.crossSelling) {
        productMsg += `**🔄 크로스셀링 (새부리형/귀편한)**\n`;
        productStrategy.crossSelling.forEach(product => {
            productMsg += `• ${product}\n`;
        });
        productMsg += `\n`;
    }
    
    if (productStrategy.bundling) {
        productMsg += `**📦 번들링 제안**\n`;
        productStrategy.bundling.forEach(bundle => {
            productMsg += `• ${bundle}\n`;
        });
    }
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📱 실시간 대시보드', callback_data: 'insight_dashboard' },
                { text: '📦 재고 전략', callback_data: 'insight_inventory' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, productMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handlePricingStrategy(bot, chatId, insights) {
    const pricingStrategy = insights.pricingStrategy;
    let pricingMsg = `💰 **새부리형/귀편한 마스크 가격 전략**\n\n`;
    pricingMsg += `• 가격 정책: ${pricingStrategy.strategy}\n`;
    pricingMsg += `• 전략 근거: ${pricingStrategy.reasoning}\n`;
    pricingMsg += `• 계절 배수: ${pricingStrategy.seasonalAdjustment}배\n`;
    pricingMsg += `• 미세먼지 배수: ${pricingStrategy.dustLevelAdjustment}배\n`;
    pricingMsg += `• **총 기회 배수: ${Math.round(pricingStrategy.seasonalAdjustment * pricingStrategy.dustLevelAdjustment * 100) / 100}배**\n\n`;
    
    pricingMsg += `**🎯 실행 방안**\n`;
    pricingStrategy.tactics.forEach(tactic => {
        pricingMsg += `• ${tactic}\n`;
    });
    
    if (pricingStrategy.recommendations) {
        pricingMsg += `\n**💡 새부리형/귀편한 마스크 추천 사항**\n`;
        pricingStrategy.recommendations.forEach(rec => {
            pricingMsg += `• ${rec}\n`;
        });
    }
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎁 제품 전략', callback_data: 'insight_products' },
                { text: '📦 재고 전략', callback_data: 'insight_inventory' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, pricingMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleInventoryStrategy(bot, chatId, insights) {
    const inventoryStrategy = insights.inventoryStrategy;
    let inventoryMsg = `📦 **새부리형/귀편한 마스크 재고 전략**\n\n`;
    inventoryMsg += `• 권장 재고 수준: ${inventoryStrategy.stockLevel}\n`;
    inventoryMsg += `• 예상 회전율: ${inventoryStrategy.turnoverRate}\n`;
    inventoryMsg += `• 총 수요 배수: ${inventoryStrategy.totalMultiplier}배\n`;
    inventoryMsg += `• 핵심 관리 상품: ${inventoryStrategy.criticalProducts.join(', ')}\n\n`;
    
    inventoryMsg += `**📊 수요 분석**\n`;
    inventoryMsg += `• 계절 수요: ${inventoryStrategy.seasonalDemand}배\n`;
    inventoryMsg += `• 미세먼지 수요: ${inventoryStrategy.dustDemand}배\n\n`;
    
    inventoryMsg += `**🎯 실행 전략 (새부리형/귀편한 마스크)**\n`;
    inventoryStrategy.strategy.forEach(strategy => {
        inventoryMsg += `• ${strategy}\n`;
    });
    
    if (inventoryStrategy.riskProducts && inventoryStrategy.riskProducts.length > 0) {
        inventoryMsg += `\n**⚠️ 위험 상품 (재고 부족 우려)**\n`;
        inventoryStrategy.riskProducts.forEach(product => {
            inventoryMsg += `• ${product}\n`;
        });
    }
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎁 제품 전략', callback_data: 'insight_products' },
                { text: '💰 가격 전략', callback_data: 'insight_pricing' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, inventoryMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleMarketingStrategy(bot, chatId, insights) {
    const marketingStrategy = insights.marketingStrategy;
    let marketingMsg = `🎯 **새부리형/귀편한 마스크 마케팅 전략**\n\n`;
    marketingMsg += `• 전략명: ${marketingStrategy.mainStrategy.title}\n`;
    marketingMsg += `• 포커스: ${marketingStrategy.mainStrategy.focus}\n`;
    marketingMsg += `• 긴급도: ${marketingStrategy.mainStrategy.urgency}\n\n`;
    
    marketingMsg += `**📱 디지털 전략**\n`;
    marketingStrategy.digitalStrategy.channels.forEach(channel => {
        marketingMsg += `• ${channel}\n`;
    });
    marketingMsg += `• 예산 수준: ${marketingStrategy.digitalStrategy.budget}\n`;
    if (marketingStrategy.digitalStrategy.keywords) {
        marketingMsg += `• 핵심 키워드: ${marketingStrategy.digitalStrategy.keywords.join(', ')}\n`;
    }
    marketingMsg += `\n`;
    
    marketingMsg += `**🏪 오프라인 전략**\n`;
    marketingStrategy.offlineStrategy.channels.forEach(channel => {
        marketingMsg += `• ${channel}\n`;
    });
    marketingMsg += `• 집중 지역: ${marketingStrategy.offlineStrategy.focus}\n`;
    if (marketingStrategy.offlineStrategy.displayFocus) {
        marketingMsg += `• 진열 전략: ${marketingStrategy.offlineStrategy.displayFocus}\n`;
    }
    marketingMsg += `\n`;
    
    marketingMsg += `**📝 콘텐츠 전략**\n`;
    marketingStrategy.contentStrategy.types.forEach(type => {
        marketingMsg += `• ${type}\n`;
    });
    if (marketingStrategy.contentStrategy.focus) {
        marketingMsg += `• 콘텐츠 포커스: ${marketingStrategy.contentStrategy.focus}\n`;
    }
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🏙️ 지역별 전략', callback_data: 'insight_regional' },
                { text: '⚔️ 경쟁사 분석', callback_data: 'insight_competitor' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, marketingMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleRegionalStrategy(bot, chatId, insights) {
    const regionalStrategy = insights.regionalStrategy;
    let regionalMsg = `🏙️ **새부리형/귀편한 마스크 지역별 전략**\n\n`;
    
    regionalMsg += `**🌆 서울/수도권**\n`;
    regionalMsg += `• 특성: ${regionalStrategy.seoul.characteristics.join(', ')}\n`;
    regionalMsg += `• 추천 상품: ${regionalStrategy.seoul.products.join(', ')}\n`;
    regionalMsg += `• 가격 정책: ${regionalStrategy.seoul.pricing}\n`;
    regionalMsg += `• 주력 채널: ${regionalStrategy.seoul.channels.join(', ')}\n`;
    regionalMsg += `• 메시지: ${regionalStrategy.seoul.messaging}\n`;
    regionalMsg += `• 포커스: ${regionalStrategy.seoul.focus}\n\n`;
    
    regionalMsg += `**🌊 부산/경남**\n`;
    regionalMsg += `• 특성: ${regionalStrategy.busan.characteristics.join(', ')}\n`;
    regionalMsg += `• 추천 상품: ${regionalStrategy.busan.products.join(', ')}\n`;
    regionalMsg += `• 가격 정책: ${regionalStrategy.busan.pricing}\n`;
    regionalMsg += `• 주력 채널: ${regionalStrategy.busan.channels.join(', ')}\n`;
    regionalMsg += `• 메시지: ${regionalStrategy.busan.messaging}\n`;
    regionalMsg += `• 포커스: ${regionalStrategy.busan.focus}\n\n`;
    
    regionalMsg += `**🏘️ 지방 도시**\n`;
    regionalMsg += `• 특성: ${regionalStrategy.rural.characteristics.join(', ')}\n`;
    regionalMsg += `• 추천 상품: ${regionalStrategy.rural.products.join(', ')}\n`;
    regionalMsg += `• 가격 정책: ${regionalStrategy.rural.pricing}\n`;
    regionalMsg += `• 주력 채널: ${regionalStrategy.rural.channels.join(', ')}\n`;
    regionalMsg += `• 메시지: ${regionalStrategy.rural.messaging}\n`;
    regionalMsg += `• 포커스: ${regionalStrategy.rural.focus}\n\n`;
    
    regionalMsg += `**💡 종합 권장사항**\n`;
    regionalMsg += `• ${regionalStrategy.recommendation}\n`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎯 마케팅 전략', callback_data: 'insight_marketing' },
                { text: '⚔️ 경쟁사 분석', callback_data: 'insight_competitor' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, regionalMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleCompetitorStrategy(bot, chatId, insights) {
    const competitorStrategy = insights.competitorStrategy;
    let competitorMsg = `⚔️ **새부리형/귀편한 마스크 경쟁사 분석**\n\n`;
    
    competitorMsg += `**🔍 모니터링 포인트**\n`;
    competitorStrategy.monitoring.forEach(point => {
        competitorMsg += `• ${point}\n`;
    });
    
    competitorMsg += `\n**✅ 기회 요소**\n`;
    competitorStrategy.opportunities.forEach(opportunity => {
        competitorMsg += `• ${opportunity}\n`;
    });
    
    competitorMsg += `\n**⚠️ 위협 요소**\n`;
    competitorStrategy.threats.forEach(threat => {
        competitorMsg += `• ${threat}\n`;
    });
    
    competitorMsg += `\n**🎯 새부리형/귀편한 마스크 대응 전략**\n`;
    competitorMsg += `• 경쟁사 재고 부족 시 새부리형 마스크 적극 마케팅\n`;
    competitorMsg += `• 귀편한 마스크 차별화 포인트 지속 강화\n`;
    competitorMsg += `• 새부리형 구조의 우수성 지속 어필\n`;
    competitorMsg += `• 가격 경쟁력 유지 및 편의성 품질 우위 확보\n`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🏙️ 지역별 전략', callback_data: 'insight_regional' },
                { text: '🎯 마케팅 전략', callback_data: 'insight_marketing' }
            ],
            [
                { text: '🔙 인사이트 메뉴', callback_data: 'insight_full' },
                { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, competitorMsg, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleInsightDashboard(bot, chatId, from) {
    try {
        const insightManager = new EnhancedDustMarketingInsights();
        const dustData = await insightManager.getCurrentAirQuality();
        const insights = insightManager.generateMarketingInsights(dustData, getUserName(from));
        const season = insightManager.getCurrentSeason();
        const seasonalData = insightManager.seasonalBusinessData[season];
        
        let dashboard = `📱 **새부리형/귀편한 마스크 실시간 대시보드**\n\n`;
        
        // 현재 상황 요약
        dashboard += `⏰ **현재 상황** (${new Date().toLocaleTimeString('ko-KR')})\n`;
        dashboard += `• 미세먼지: ${insights.currentSituation.details.dustLevel} ${dustData.pm25}㎍/㎥\n`;
        dashboard += `• 시기: ${seasonalData.season_type}\n`;
        dashboard += `• 시간대: ${insights.currentSituation.details.timeSlot}\n`;
        dashboard += `• 기회점수: ${insights.marketingOpportunity.score}/10\n\n`;
        
        // 실시간 지표
        dashboard += `📊 **실시간 지표**\n`;
        dashboard += `• 예상 매출 배수: ${insights.inventoryStrategy.totalMultiplier}배\n`;
        dashboard += `• 재고 수준: ${insights.inventoryStrategy.stockLevel}\n`;
        dashboard += `• 주력 상품: ${insights.productStrategy.primaryProduct}\n`;
        dashboard += `• 마케팅 예산: ${insights.marketingStrategy.digitalStrategy.budget}\n\n`;
        
        // 즉시 액션
        dashboard += `⚡ **즉시 액션**\n`;
        const actions = insights.actionPlan.plans[0].tasks.slice(0, 3);
        actions.forEach((action, index) => {
            dashboard += `${index + 1}. ${action}\n`;
        });
        
        // 계절별 특별 모니터링
        if (season === 'summer') {
            dashboard += `\n☀️ **하절기 비수기 특별 모니터링**\n`;
            dashboard += `• 숨쉬기 편한 새부리형 마스크 우선 관리\n`;
            dashboard += `• 귀편한 마스크 편의성 마케팅 활성화\n`;
            dashboard += `• 통풍성 제품 재고 점검\n`;
        } else if (seasonalData.season_type === '최대 성수기') {
            dashboard += `\n❄️ **최대 성수기 특별 모니터링**\n`;
            dashboard += `• 방한 새부리형 마스크 최대 수요 대비\n`;
            dashboard += `• 귀편한 윈터 마스크 재고 확보\n`;
            dashboard += `• 프리미엄 전략 실행 상황\n`;
        } else if (seasonalData.season_type === '성수기') {
            dashboard += `\n🍂 **성수기 특별 모니터링**\n`;
            dashboard += `• 새부리형/귀편한 마스크 수요 증가 대비\n`;
            dashboard += `• 핵심 제품 재고 관리 강화\n`;
            dashboard += `• 마케팅 효과 실시간 모니터링\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 새로고침', callback_data: 'insight_dashboard' },
                    { text: '📊 상세 분석', callback_data: 'insight_full' }
                ],
                [
                    { text: '🗺️ 전국 현황', callback_data: 'insight_national' },
                    { text: '⚡ 빠른 인사이트', callback_data: 'insight_quick' }
                ],
                [
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, dashboard, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ 새부리형/귀편한 마스크 대시보드 표시 실패:', error);
        await bot.sendMessage(chatId, `❌ 대시보드 표시 중 오류가 발생했습니다.\n\n오류: ${error.message}`);
    }
}

async function showMainMenu(bot, chatId) {
    const mainMenuMessage = `🏠 **메인 메뉴**\n\n` +
                          `**📊 새부리형/귀편한 마스크 인사이트**\n` +
                          `• 종합 마케팅 인사이트\n` +
                          `• 실시간 대시보드\n` +
                          `• 전국 현황 모니터링\n` +
                          `• 성수기/비수기별 전략\n\n` +
                          `**🔥 핵심 키워드**\n` +
                          `• 새부리형 마스크 - 2D 구조\n` +
                          `• 귀편한 마스크 - 편안한 착용감\n` +
                          `• 숨쉬기 편한 - 통풍성 우수\n\n` +
                          `원하시는 기능을 선택해주세요! 🚀`;
    
    const mainKeyboard = {
        inline_keyboard: [
            [
                { text: '🎯 종합 인사이트', callback_data: 'insight_full' },
                { text: '📱 실시간 대시보드', callback_data: 'insight_dashboard' }
            ],
            [
                { text: '⚡ 빠른 인사이트', callback_data: 'insight_quick' },
                { text: '🗺️ 전국 현황', callback_data: 'insight_national' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, mainMenuMessage, {
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
}
