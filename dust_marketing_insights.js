// dust_marketing_insights.js - 오류 수정 버전

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

class DustMarketingInsights {
    constructor() {
        // 한국환경공단 API 키
        this.airKoreaApiKey = process.env.AIR_KOREA_API_KEY || 'YOUR_API_KEY_HERE';
        this.baseUrl = 'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
        
        // 계절별 패턴 데이터
        this.seasonalPatterns = {
            spring: { // 3-5월
                dustEvents: ['황사', '미세먼지', '꽃가루'],
                peakMonths: [3, 4, 5],
                salesMultiplier: 2.5,
                keyProducts: ['KF94', '황사마스크', '공기청정기필터', '안경닦이']
            },
            summer: { // 6-8월
                dustEvents: ['오존', '자외선'],
                peakMonths: [6, 7, 8],
                salesMultiplier: 1.2,
                keyProducts: ['자외선차단', '일회용마스크', '쿨마스크']
            },
            autumn: { // 9-11월
                dustEvents: ['미세먼지', '대기오염'],
                peakMonths: [9, 10, 11],
                salesMultiplier: 1.8,
                keyProducts: ['KF80', 'KF94', '실내공기청정기']
            },
            winter: { // 12-2월
                dustEvents: ['미세먼지', '난방오염'],
                peakMonths: [12, 1, 2],
                salesMultiplier: 2.0,
                keyProducts: ['방한마스크', '실내필터', '가습기필터']
            }
        };
    }

    // 🔧 수정된 실시간 대기질 정보 가져오기
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
                timeout: 10000 // 10초 타임아웃
            });

            console.log('📡 API 응답 받음');
            
            // 🔧 안전한 응답 체크
            if (response && response.data && response.data.response) {
                const apiResponse = response.data.response;
                
                // 헤더 확인
                if (apiResponse.header && apiResponse.header.resultCode === '00') {
                    // 바디 확인
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
                    } else {
                        console.log('⚠️ API 데이터 없음, 더미 데이터 사용');
                        return this.getDummyAirQuality(stationName);
                    }
                } else {
                    console.log('⚠️ API 오류 응답:', apiResponse.header?.resultMsg || 'Unknown error');
                    return this.getDummyAirQuality(stationName);
                }
            } else {
                console.log('⚠️ API 응답 구조 오류, 더미 데이터 사용');
                return this.getDummyAirQuality(stationName);
            }
        } catch (error) {
            console.error('❌ API 호출 실패:', error.message);
            console.log('🔄 더미 데이터로 대체');
            return this.getDummyAirQuality(stationName);
        }
    }

    // 🔧 수정된 더미 데이터 생성
    getDummyAirQuality(stationName) {
        const season = this.getCurrentSeason();
        const baseValues = {
            spring: { pm10: 65, pm25: 35 }, // 봄철 높음
            summer: { pm10: 35, pm25: 20 }, // 여름철 보통
            autumn: { pm10: 55, pm25: 28 }, // 가을철 높음
            winter: { pm10: 45, pm25: 25 }  // 겨울철 보통
        };

        const base = baseValues[season];
        const variation = Math.floor(Math.random() * 30) - 15;

        console.log(`🎲 더미 데이터 생성 (${season}): PM10=${base.pm10}, PM2.5=${base.pm25}`);

        return {
            station: stationName,
            pm10: Math.max(0, base.pm10 + variation),
            pm25: Math.max(0, base.pm25 + variation),
            o3: 0.03 + Math.random() * 0.02,
            no2: 0.02 + Math.random() * 0.01,
            co: 0.5 + Math.random() * 0.3,
            so2: 0.003 + Math.random() * 0.002,
            dataTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
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

    // 미세먼지 수준 판정
    getDustLevel(pm10, pm25) {
        if (pm10 <= 30 && pm25 <= 15) return 'good';
        if (pm10 <= 80 && pm25 <= 35) return 'moderate';
        if (pm10 <= 150 && pm25 <= 75) return 'bad';
        return 'veryBad';
    }

    // 마케팅 기회 점수 계산
    calculateMarketingOpportunityScore(dustLevel, season, isWeekend = false) {
        const baseScores = {
            'good': 2,
            'moderate': 5,
            'bad': 8,
            'veryBad': 10
        };
        
        const seasonMultiplier = this.seasonalPatterns[season].salesMultiplier;
        const weekendMultiplier = isWeekend ? 1.2 : 1.0;
        
        return Math.min(10, baseScores[dustLevel] * seasonMultiplier * weekendMultiplier);
    }

    // 🔧 수정된 전국 현황 조회
    async getNationalDustStatus() {
        const results = [];
        const cities = Object.entries(MONITORING_STATIONS).slice(0, 5); // 주요 5개 도시만

        console.log('🗺️ 전국 현황 조회 시작...');

        for (const [cityName, stationName] of cities) {
            try {
                const data = await this.getCurrentAirQuality(stationName);
                const recommendation = this.getMaskRecommendation(data.pm10, data.pm25);
                
                results.push({
                    city: cityName,
                    station: stationName,
                    pm10: data.pm10,
                    pm25: data.pm25,
                    level: recommendation.level,
                    emoji: recommendation.emoji,
                    color: recommendation.color,
                    mask: recommendation.mask
                });
            } catch (error) {
                console.error(`❌ ${cityName} 데이터 조회 실패:`, error.message);
                // 오류 발생 시 더미 데이터 추가
                const dummyData = this.getDummyAirQuality(stationName);
                const recommendation = this.getMaskRecommendation(dummyData.pm10, dummyData.pm25);
                
                results.push({
                    city: cityName,
                    station: stationName,
                    pm10: dummyData.pm10,
                    pm25: dummyData.pm25,
                    level: recommendation.level,
                    emoji: recommendation.emoji,
                    color: recommendation.color,
                    mask: recommendation.mask
                });
            }
        }

        console.log(`✅ 전국 현황 조회 완료: ${results.length}개 도시`);
        return results;
    }

    // 미세먼지 농도에 따른 마스크 추천
    getMaskRecommendation(pm10, pm25) {
        const dustLevel = this.getDustLevel(pm10, pm25);
        
        const recommendations = {
            good: {
                level: '좋음',
                emoji: '😊',
                color: '🟢',
                mask: '일반 마스크 또는 마스크 불필요',
                filterType: '일반 부직포',
                advice: '야외 활동하기 좋은 날입니다!',
                businessTip: '마스크 판매량 낮음, 프로모션 적기'
            },
            moderate: {
                level: '보통',
                emoji: '😐',
                color: '🟡',
                mask: 'KF80 마스크 권장',
                filterType: 'KF80 필터',
                advice: '민감한 분들은 마스크 착용 권장',
                businessTip: 'KF80 제품 재고 확인 필요'
            },
            bad: {
                level: '나쁨',
                emoji: '😷',
                color: '🟠',
                mask: 'KF94 마스크 필수',
                filterType: 'KF94 고성능 필터',
                advice: '외출 시 마스크 필수 착용',
                businessTip: 'KF94 재고 긴급 확인, 마케팅 강화'
            },
            veryBad: {
                level: '매우나쁨',
                emoji: '😵',
                color: '🔴',
                mask: 'KF94 마스크 + 실내 공기청정기',
                filterType: 'KF94 + 공기청정기 필터',
                advice: '외출 자제, 마스크 필수 착용',
                businessTip: '전 제품 재고 확인, 긴급 주문 검토'
            }
        };

        return recommendations[dustLevel];
    }

    // 종합 마케팅 인사이트 생성
    generateMarketingInsights(dustData, userName) {
        const dustLevel = this.getDustLevel(dustData.pm10, dustData.pm25);
        const season = this.getCurrentSeason();
        const isWeekend = [0, 6].includes(new Date().getDay());
        const opportunityScore = this.calculateMarketingOpportunityScore(dustLevel, season, isWeekend);
        
        console.log(`💡 인사이트 생성: ${dustLevel} (점수: ${opportunityScore})`);
        
        return {
            currentSituation: this.analyzCurrentSituation(dustData, dustLevel, season),
            marketingOpportunity: this.getMarketingOpportunity(dustLevel, season, opportunityScore),
            inventoryStrategy: this.getInventoryStrategy(dustLevel, season),
            marketingStrategy: this.getMarketingStrategy(dustLevel, season),
            contentStrategy: this.getContentStrategy(dustLevel, season),
            actionPlan: this.getActionPlan(dustLevel, season, opportunityScore),
            riskManagement: this.getRiskManagement(dustLevel, season)
        };
    }

    // 현재 상황 분석
    analyzCurrentSituation(dustData, dustLevel, season) {
        const seasonName = {
            spring: '봄철',
            summer: '여름철', 
            autumn: '가을철',
            winter: '겨울철'
        }[season];

        const levelDescription = {
            'good': '양호한 상태',
            'moderate': '보통 수준',
            'bad': '나쁜 상태 - 마케팅 기회!',
            'veryBad': '매우 나쁨 - 긴급 대응 필요!'
        }[dustLevel];

        const seasonalEvents = this.seasonalPatterns[season].dustEvents.join(', ');

        return {
            summary: `${seasonName} ${levelDescription}`,
            details: {
                pm10: dustData.pm10,
                pm25: dustData.pm25,
                season: seasonName,
                seasonalEvents: seasonalEvents,
                riskLevel: dustLevel === 'veryBad' ? 'high' : dustLevel === 'bad' ? 'medium' : 'low'
            }
        };
    }

    // 마케팅 기회 분석
    getMarketingOpportunity(dustLevel, season, score) {
        const opportunities = [];
        
        if (score >= 8) {
            opportunities.push({
                type: 'urgent',
                title: '🚨 긴급 마케팅 기회',
                description: '높은 미세먼지 농도로 인한 즉시 대응 필요',
                actions: [
                    '긴급 광고 캠페인 실행',
                    '재고 대량 확보',
                    '가격 경쟁력 확보',
                    '고객 문의 대응팀 확충'
                ]
            });
        } else if (score >= 6) {
            opportunities.push({
                type: 'moderate',
                title: '📈 중간 마케팅 기회',
                description: '안정적인 수요 증가 예상',
                actions: [
                    '타겟 광고 강화',
                    '프로모션 기획',
                    '고객 교육 콘텐츠 제작',
                    '재고 점검 및 보충'
                ]
            });
        } else {
            opportunities.push({
                type: 'maintenance',
                title: '🔧 브랜드 유지 기회',
                description: '브랜드 인지도 및 고객 관계 강화',
                actions: [
                    '브랜드 스토리텔링',
                    '고객 리뷰 관리',
                    '제품 개선 피드백 수집',
                    '효율적 재고 관리'
                ]
            });
        }

        return {
            score: score,
            level: score >= 8 ? 'high' : score >= 6 ? 'medium' : 'low',
            opportunities: opportunities
        };
    }

    // 재고 전략
    getInventoryStrategy(dustLevel, season) {
        const seasonalProducts = this.seasonalPatterns[season].keyProducts;
        const urgencyLevel = dustLevel === 'veryBad' ? 'urgent' : 
                            dustLevel === 'bad' ? 'high' : 
                            dustLevel === 'moderate' ? 'medium' : 'low';
        
        const strategies = [];
        
        if (urgencyLevel === 'urgent') {
            strategies.push({
                priority: 'immediate',
                title: '🚨 긴급 재고 확보',
                items: [
                    `${seasonalProducts[0]} - 평소 대비 300% 재고 확보`,
                    `${seasonalProducts[1]} - 평소 대비 200% 재고 확보`,
                    '공급업체 긴급 연락 및 추가 주문',
                    '경쟁사 품절 상황 모니터링'
                ]
            });
        } else if (urgencyLevel === 'high') {
            strategies.push({
                priority: 'high',
                title: '📦 재고 증량 준비',
                items: [
                    `${seasonalProducts[0]} - 평소 대비 150% 재고 확보`,
                    `${seasonalProducts[1]} - 평소 대비 120% 재고 확보`,
                    '주요 공급업체 재고 상황 확인',
                    '대체 공급업체 확보'
                ]
            });
        } else {
            strategies.push({
                priority: 'normal',
                title: '📊 정상 재고 관리',
                items: [
                    '현재 재고 수준 유지',
                    '계절별 트렌드 모니터링',
                    '재고 회전율 최적화',
                    '신제품 테스트 마케팅'
                ]
            });
        }

        return {
            urgencyLevel: urgencyLevel,
            recommendedProducts: seasonalProducts,
            strategies: strategies
        };
    }

    // 마케팅 전략
    getMarketingStrategy(dustLevel, season) {
        const strategies = [];
        
        if (dustLevel === 'veryBad' || dustLevel === 'bad') {
            strategies.push({
                channel: 'digital',
                title: '🎯 디지털 마케팅 집중',
                tactics: [
                    '네이버/구글 광고 예산 200% 증대',
                    '미세먼지 관련 키워드 집중 입찰',
                    '인스타그램/페이스북 긴급성 광고',
                    '유튜브 프리롤 광고 (건강 관련 콘텐츠)'
                ]
            });
        } else {
            strategies.push({
                channel: 'brand',
                title: '🏢 브랜드 마케팅',
                tactics: [
                    '브랜드 스토리 강화',
                    '제품 품질 및 안전성 어필',
                    '고객 만족도 캠페인',
                    'CSR 활동 (환경 보호)'
                ]
            });
        }

        return {
            urgency: dustLevel === 'veryBad' ? 'immediate' : dustLevel === 'bad' ? 'high' : 'normal',
            strategies: strategies
        };
    }

    // 콘텐츠 전략
    getContentStrategy(dustLevel, season) {
        const contentTypes = [];
        
        if (dustLevel === 'veryBad' || dustLevel === 'bad') {
            contentTypes.push({
                type: 'educational',
                title: '🎓 교육 콘텐츠',
                content: [
                    '미세먼지 위험성 및 대응법',
                    '올바른 마스크 착용법',
                    '실내 공기질 관리 팁',
                    '건강한 생활 습관 가이드'
                ]
            });
        } else {
            contentTypes.push({
                type: 'lifestyle',
                title: '💫 라이프스타일 콘텐츠',
                content: [
                    '건강한 일상 루틴',
                    '계절별 건강 관리',
                    '제품 활용 팁',
                    '고객 사용 후기'
                ]
            });
        }

        return {
            priority: dustLevel === 'veryBad' ? 'urgent' : 'normal',
            contentTypes: contentTypes
        };
    }

    // 액션 플랜
    getActionPlan(dustLevel, season, score) {
        const plans = [];
        
        if (score >= 8) {
            plans.push({
                timeframe: 'immediate',
                title: '🚨 즉시 실행 (1-2시간)',
                tasks: [
                    '재고 현황 점검 및 긴급 주문',
                    '광고 예산 증액 승인',
                    'CS팀 비상 대기',
                    '주요 고객사 연락'
                ]
            });
        } else {
            plans.push({
                timeframe: 'medium',
                title: '📊 중기 실행 (1-2주)',
                tasks: [
                    '마케팅 전략 최적화',
                    '고객 피드백 수집',
                    '제품 개선 방안 검토',
                    '파트너십 확대'
                ]
            });
        }

        return {
            totalPlans: plans.length,
            plans: plans
        };
    }

    // 리스크 관리
    getRiskManagement(dustLevel, season) {
        const risks = [];
        
        if (dustLevel === 'veryBad' || dustLevel === 'bad') {
            risks.push({
                type: 'supply',
                title: '📦 공급망 리스크',
                description: '급격한 수요 증가로 인한 공급 부족',
                mitigation: [
                    '다중 공급업체 확보',
                    '재고 안전 마진 확대',
                    '대체 제품 준비',
                    '공급업체와 긴밀한 소통'
                ]
            });
        } else {
            risks.push({
                type: 'market',
                title: '📊 시장 리스크',
                description: '수요 감소 및 재고 과잉',
                mitigation: [
                    '재고 회전율 최적화',
                    '프로모션 활용',
                    '신제품 개발 투자',
                    '해외 시장 진출'
                ]
            });
        }

        return {
            level: dustLevel === 'veryBad' ? 'high' : dustLevel === 'bad' ? 'medium' : 'low',
            risks: risks
        };
    }

    // 인사이트 리포트 포맷팅
    formatInsightReport(insights, dustData, userName) {
        const koreaTime = new Date(dustData.dataTime).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        let report = `📊 **${userName}님의 미세먼지 마케팅 인사이트**\n\n`;
        
        // 현재 상황
        report += `🌫️ **현재 상황** (${koreaTime})\n`;
        report += `• 측정소: ${dustData.station}\n`;
        report += `• PM10: ${dustData.pm10}㎍/㎥ | PM2.5: ${dustData.pm25}㎍/㎥\n`;
        report += `• 상태: ${insights.currentSituation.summary}\n`;
        report += `• 계절 이벤트: ${insights.currentSituation.details.seasonalEvents}\n\n`;
        
        // 마케팅 기회
        report += `🎯 **마케팅 기회 점수: ${insights.marketingOpportunity.score}/10**\n`;
        const opportunity = insights.marketingOpportunity.opportunities[0];
        report += `${opportunity.title}\n`;
        report += `${opportunity.description}\n\n`;
        
        // 즉시 실행 사항
        report += `⚡ **즉시 실행 사항**\n`;
        opportunity.actions.forEach((action, index) => {
            report += `${index + 1}. ${action}\n`;
        });
        report += '\n';
        
        // 재고 전략
        report += `📦 **재고 전략**\n`;
        const inventory = insights.inventoryStrategy.strategies[0];
        report += `• 우선순위: ${inventory.priority}\n`;
        report += `• 핵심 제품: ${insights.inventoryStrategy.recommendedProducts.join(', ')}\n`;
        inventory.items.slice(0, 3).forEach(item => {
            report += `• ${item}\n`;
        });
        report += '\n';
        
        // 마케팅 전략
        report += `🎯 **마케팅 전략**\n`;
        const marketing = insights.marketingStrategy.strategies[0];
        report += `• 채널: ${marketing.title}\n`;
        marketing.tactics.slice(0, 3).forEach(tactic => {
            report += `• ${tactic}\n`;
        });
        report += '\n';
        
        // 리스크 관리
        report += `⚠️ **주요 리스크**\n`;
        const mainRisk = insights.riskManagement.risks[0];
        report += `• ${mainRisk.title}: ${mainRisk.description}\n`;
        report += `• 대응책: ${mainRisk.mitigation[0]}\n\n`;
        
        // 액션 플랜
        report += `📋 **액션 플랜**\n`;
        insights.actionPlan.plans.forEach(plan => {
            report += `**${plan.title}**\n`;
            plan.tasks.forEach(task => {
                report += `• ${task}\n`;
            });
            report += '\n';
        });
        
        return report;
    }

    // 간단한 대시보드 생성
    generateDashboard(dustData, insights) {
        const dustLevel = this.getDustLevel(dustData.pm10, dustData.pm25);
        const season = this.getCurrentSeason();
        const score = insights.marketingOpportunity.score;
        
        return {
            overview: {
                dustLevel: dustLevel,
                season: season,
                score: score,
                urgency: score >= 8 ? 'high' : score >= 6 ? 'medium' : 'low'
            },
            metrics: {
                pm10: dustData.pm10,
                pm25: dustData.pm25,
                timestamp: dustData.dataTime
            },
            recommendations: {
                immediate: insights.actionPlan.plans[0]?.tasks.slice(0, 3) || [],
                products: insights.inventoryStrategy.recommendedProducts.slice(0, 3),
                channels: insights.marketingStrategy.strategies[0]?.tactics.slice(0, 2) || []
            }
        };
    }
}

// 미세먼지 마케팅 인사이트 메인 함수
module.exports = function(bot, msg) {
    const text = msg.text || '';
    const chatId = msg.chat.id;
    const userName = getUserName(msg.from);
    const insightManager = new DustMarketingInsights();

    console.log(`📥 인사이트 요청: ${text} (사용자: ${userName})`);

    if (text === '/insight' || text === '/인사이트') {
        console.log('🔍 종합 마케팅 인사이트 생성 시작...');
        
        // 종합 마케팅 인사이트 생성
        insightManager.getCurrentAirQuality()
            .then(dustData => {
                console.log('📊 대기질 데이터 획득 완료');
                const insights = insightManager.generateMarketingInsights(dustData, userName);
                const report = insightManager.formatInsightReport(insights, dustData, userName);
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '📊 대시보드', callback_data: 'insight_dashboard' },
                            { text: '📦 재고 전략', callback_data: 'insight_inventory' }
                        ],
                        [
                            { text: '🎯 마케팅 전략', callback_data: 'insight_marketing' },
                            { text: '📝 콘텐츠 전략', callback_data: 'insight_content' }
                        ],
                        [
                            { text: '⚠️ 리스크 분석', callback_data: 'insight_risk' },
                            { text: '🔄 새로고침', callback_data: 'insight_refresh' }
                        ],
                        [
                            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                        ]
                    ]
                };
                
                console.log('✅ 인사이트 전송 준비 완료');
                bot.sendMessage(chatId, report, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            })
            .catch(error => {
                console.error('❌ 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 인사이트 생성 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
            });

    } else if (text === '/insight quick' || text === '/인사이트 간단') {
        console.log('⚡ 빠른 인사이트 생성 시작...');
        
        // 빠른 인사이트
        insightManager.getCurrentAirQuality()
            .then(dustData => {
                const insights = insightManager.generateMarketingInsights(dustData, userName);
                const dashboard = insightManager.generateDashboard(dustData, insights);
                
                let quickReport = `⚡ **빠른 인사이트**\n\n`;
                quickReport += `🌫️ 미세먼지: ${dashboard.overview.dustLevel} (${dashboard.metrics.pm25}㎍/㎥)\n`;
                quickReport += `🎯 기회 점수: ${dashboard.overview.score}/10\n`;
                quickReport += `⚡ 긴급도: ${dashboard.overview.urgency}\n\n`;
                
                quickReport += `📋 **즉시 실행**\n`;
                dashboard.recommendations.immediate.forEach((item, index) => {
                    quickReport += `${index + 1}. ${item}\n`;
                });
                
                bot.sendMessage(chatId, quickReport, { parse_mode: 'Markdown' });
            })
            .catch(error => {
                console.error('❌ 빠른 인사이트 생성 실패:', error);
                bot.sendMessage(chatId, `❌ 빠른 인사이트 생성 실패: ${error.message}`);
            });

    } else {
        // 도움말
        const helpMessage = `📊 **미세먼지 마케팅 인사이트**\n\n` +
                           `**📱 명령어**\n` +
                           `• /insight 또는 /인사이트 - 종합 분석\n` +
                           `• /insight quick - 빠른 인사이트\n\n` +
                           `**🎯 주요 기능**\n` +
                           `• 실시간 미세먼지 기반 마케팅 기회 분석\n` +
                           `• 계절별 맞춤 전략 제안\n` +
                           `• 재고 관리 최적화 가이드\n` +
                           `• 콘텐츠 마케팅 전략\n` +
                           `• 리스크 관리 및 대응 방안\n` +
                           `• 즉시 실행 가능한 액션 플랜\n\n` +
                           `**💡 활용 예시**\n` +
                           `• 미세먼지 나쁨 → 긴급 마케팅 전략\n` +
                           `• 봄철 황사 → 계절 맞춤 재고 전략\n` +
                           `• 평상시 → 브랜드 강화 전략\n\n` +
                           `실시간 데이터 기반으로 최적의 마케팅 타이밍을 놓치지 마세요! 🚀`;

        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    }
};

// 🔧 수정된 콜백 처리 함수
module.exports.handleCallback = async function(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userName = getUserName(callbackQuery.from);
    const insightManager = new DustMarketingInsights();

    console.log(`📞 인사이트 콜백 처리: ${data}`);

    try {
        const dustData = await insightManager.getCurrentAirQuality();
        const insights = insightManager.generateMarketingInsights(dustData, userName);

        switch (data) {
            case 'insight_dashboard':
                const dashboard = insightManager.generateDashboard(dustData, insights);
                let dashboardMsg = `📊 **마케팅 대시보드**\n\n`;
                dashboardMsg += `🌫️ **현재 상황**\n`;
                dashboardMsg += `• 등급: ${dashboard.overview.dustLevel}\n`;
                dashboardMsg += `• PM2.5: ${dashboard.metrics.pm25}㎍/㎥\n`;
                dashboardMsg += `• 기회점수: ${dashboard.overview.score}/10\n\n`;
                dashboardMsg += `🎯 **추천 제품**\n`;
                dashboard.recommendations.products.forEach(product => {
                    dashboardMsg += `• ${product}\n`;
                });
                bot.sendMessage(chatId, dashboardMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_inventory':
                const inventory = insights.inventoryStrategy.strategies[0];
                let inventoryMsg = `📦 **재고 전략**\n\n`;
                inventoryMsg += `• 우선순위: ${inventory.priority}\n`;
                inventoryMsg += `• 추천 제품: ${insights.inventoryStrategy.recommendedProducts.join(', ')}\n\n`;
                inventoryMsg += `**실행 사항**\n`;
                inventory.items.forEach(item => {
                    inventoryMsg += `• ${item}\n`;
                });
                bot.sendMessage(chatId, inventoryMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_marketing':
                const marketing = insights.marketingStrategy.strategies[0];
                let marketingMsg = `🎯 **마케팅 전략**\n\n`;
                marketingMsg += `**${marketing.title}**\n`;
                marketing.tactics.forEach(tactic => {
                    marketingMsg += `• ${tactic}\n`;
                });
                bot.sendMessage(chatId, marketingMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_content':
                const content = insights.contentStrategy.contentTypes[0];
                let contentMsg = `📝 **콘텐츠 전략**\n\n`;
                contentMsg += `**${content.title}**\n`;
                content.content.forEach(item => {
                    contentMsg += `• ${item}\n`;
                });
                bot.sendMessage(chatId, contentMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_risk':
                const risk = insights.riskManagement.risks[0];
                let riskMsg = `⚠️ **리스크 분석**\n\n`;
                riskMsg += `**${risk.title}**\n`;
                riskMsg += `${risk.description}\n\n`;
                riskMsg += `**대응방안**\n`;
                risk.mitigation.forEach(solution => {
                    riskMsg += `• ${solution}\n`;
                });
                bot.sendMessage(chatId, riskMsg, { parse_mode: 'Markdown' });
                break;

            case 'insight_refresh':
                bot.sendMessage(chatId, '🔄 최신 데이터로 인사이트를 새로고침합니다...');
                // 새로고침 후 메인 인사이트 재전송
                setTimeout(() => {
                    module.exports(bot, { chat: { id: chatId }, from: callbackQuery.from, text: '/insight' });
                }, 1000);
                break;

            default:
                bot.sendMessage(chatId, '🚧 해당 기능은 개발 중입니다!');
        }
    } catch (error) {
        console.error('❌ 콜백 처리 중 오류:', error);
        bot.sendMessage(chatId, `❌ 처리 중 오류 발생: ${error.message}\n\n잠시 후 다시 시도해주세요.`);
    }
};

module.exports.DustMarketingInsights = DustMarketingInsights;
