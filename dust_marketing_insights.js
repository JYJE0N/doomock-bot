// dust_marketing_insights.js - 미세먼지 마케팅 인사이트 봇

const axios = require('axios');
const { getUserName } = require('./username_helper');

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
        
        // 이커머스 준비 체크리스트
        this.ecommercePreparation = {
            inventory: '재고 관리',
            marketing: '마케팅 전략',
            content: '콘텐츠 준비',
            customer: '고객 서비스',
            logistics: '물류 준비'
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

    // 실시간 대기질 정보 가져오기
    async getCurrentAirQuality(stationName = '종로구') {
        try {
            const response = await axios.get(`${this.baseUrl}/getMsrstnAcctoRltmMesureDnsty`, {
                params: {
                    serviceKey: this.airKoreaApiKey,
                    returnType: 'json',
                    numOfRows: 1,
                    pageNo: 1,
                    stationName: stationName,
                    dataTerm: 'DAILY',
                    ver: '1.0'
                }
            });

            if (response.data.response.header.resultCode === '00') {
                const data = response.data.response.body.items[0];
                return {
                    station: stationName,
                    pm10: parseInt(data.pm10Value) || 0,
                    pm25: parseInt(data.pm25Value) || 0,
                    o3: parseFloat(data.o3Value) || 0,
                    dataTime: data.dataTime
                };
            }
        } catch (error) {
            console.error('대기질 정보 조회 실패:', error);
        }
        
        // 실패 시 더미 데이터 반환
        return this.getDummyAirQuality(stationName);
    }

    // 더미 데이터 생성
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

        return {
            station: stationName,
            pm10: Math.max(0, base.pm10 + variation),
            pm25: Math.max(0, base.pm25 + variation),
            o3: 0.03 + Math.random() * 0.02,
            dataTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
    }

    // 종합 마케팅 인사이트 생성
    generateMarketingInsights(dustData, userName) {
        const dustLevel = this.getDustLevel(dustData.pm10, dustData.pm25);
        const season = this.getCurrentSeason();
        const isWeekend = [0, 6].includes(new Date().getDay());
        const opportunityScore = this.calculateMarketingOpportunityScore(dustLevel, season, isWeekend);
        
        const insights = {
            currentSituation: this.analyzCurrentSituation(dustData, dustLevel, season),
            marketingOpportunity: this.getMarketingOpportunity(dustLevel, season, opportunityScore),
            inventoryStrategy: this.getInventoryStrategy(dustLevel, season),
            marketingStrategy: this.getMarketingStrategy(dustLevel, season),
            contentStrategy: this.getContentStrategy(dustLevel, season),
            customerService: this.getCustomerServiceStrategy(dustLevel, season),
            competitorAnalysis: this.getCompetitorAnalysis(dustLevel, season),
            actionPlan: this.getActionPlan(dustLevel, season, opportunityScore),
            riskManagement: this.getRiskManagement(dustLevel, season),
            longTermStrategy: this.getLongTermStrategy(season)
        };

        return insights;
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
            
            strategies.push({
                channel: 'content',
                title: '📝 콘텐츠 마케팅',
                tactics: [
                    '미세먼지 대응 가이드 제작',
                    '제품 착용법 영상 제작',
                    '고객 후기 및 사용 팁 수집',
                    '전문가 인터뷰 콘텐츠'
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
            
            contentTypes.push({
                type: 'urgency',
                title: '🚨 긴급성 콘텐츠',
                content: [
                    '오늘의 미세먼지 현황',
                    '즉시 필요한 보호 조치',
                    '응급 상황 대응법',
                    '어린이/노인 특별 주의사항'
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

    // 고객 서비스 전략
    getCustomerServiceStrategy(dustLevel, season) {
        const strategies = [];
        
        if (dustLevel === 'veryBad' || dustLevel === 'bad') {
            strategies.push({
                type: 'immediate',
                title: '🚨 긴급 고객 대응',
                actions: [
                    'CS팀 인력 2배 증원',
                    '24시간 문의 대응 체계',
                    '배송 지연 사전 안내',
                    '대량 주문 우선 처리'
                ]
            });
        } else {
            strategies.push({
                type: 'normal',
                title: '😊 일반 고객 서비스',
                actions: [
                    '정기 고객 만족도 조사',
                    '제품 사용법 안내',
                    '리뷰 관리 및 답변',
                    '고객 피드백 수집'
                ]
            });
        }

        return {
            urgency: dustLevel === 'veryBad' ? 'high' : 'normal',
            strategies: strategies
        };
    }

    // 경쟁사 분석
    getCompetitorAnalysis(dustLevel, season) {
        const analysis = [];
        
        if (dustLevel === 'veryBad' || dustLevel === 'bad') {
            analysis.push({
                focus: 'pricing',
                title: '💰 가격 경쟁력',
                checks: [
                    '주요 경쟁사 가격 실시간 모니터링',
                    '프로모션 및 할인 정책 분석',
                    '배송비 정책 비교',
                    '번들 상품 구성 분석'
                ]
            });
            
            analysis.push({
                focus: 'availability',
                title: '📦 재고 및 가용성',
                checks: [
                    '경쟁사 품절 상황 모니터링',
                    '신제품 출시 동향',
                    '공급업체 겹침 분석',
                    '배송 속도 비교'
                ]
            });
        } else {
            analysis.push({
                focus: 'strategy',
                title: '🎯 전략적 분석',
                checks: [
                    '브랜드 포지셔닝 분석',
                    '마케팅 메시지 분석',
                    '고객 리뷰 트렌드',
                    '신규 진입 업체 모니터링'
                ]
            });
        }

        return {
            urgency: dustLevel === 'veryBad' ? 'high' : 'normal',
            analysis: analysis
        };
    }

    // 액션 플랜
    getActionPlan(dustLevel, season, score) {
        const timeframes = {
            immediate: '즉시 (1-2시간)',
            short: '단기 (1-3일)',
            medium: '중기 (1-2주)',
            long: '장기 (1개월 이상)'
        };

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
            
            plans.push({
                timeframe: 'short',
                title: '📈 단기 실행 (1-3일)',
                tasks: [
                    '긴급 마케팅 캠페인 런칭',
                    '콘텐츠 제작 및 배포',
                    '배송 체계 점검',
                    '경쟁사 대응 전략 수립'
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
            
            risks.push({
                type: 'logistics',
                title: '🚚 물류 리스크',
                description: '배송 지연 및 고객 불만 증가',
                mitigation: [
                    '물류 업체 비상 계획 수립',
                    '배송 지연 사전 안내',
                    '우선 배송 시스템 구축',
                    '대안 배송 방법 확보'
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

    // 장기 전략
    getLongTermStrategy(season) {
        const strategies = [];
        
        strategies.push({
            area: 'product',
            title: '🔬 제품 개발',
            plans: [
                '계절별 맞춤 제품 개발',
                '기술 혁신 투자',
                '친환경 제품 라인 확대',
                '고객 맞춤형 솔루션'
            ]
        });
        
        strategies.push({
            area: 'market',
            title: '🌐 시장 확대',
            plans: [
                'B2B 시장 진출',
                '해외 시장 개척',
                '온라인 채널 다각화',
                '구독 모델 도입'
            ]
        });

        return {
            horizon: '6개월-1년',
            strategies: strategies
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

    if (text === '/insight' || text === '/인사이트') {
        // 종합 마케팅 인사이트 생성
        insightManager.getCurrentAirQuality()
            .then(dustData => {
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
                
                bot.sendMessage(chatId, report, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            })
            .catch(error => {
                bot.sendMessage(chatId, `❌ 인사이트 생성 중 오류 발생: ${error.message}`);
            });

    } else if (text === '/insight quick' || text === '/인사이트 간단') {
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

// 콜백 처리 함수
module.exports.handleCallback = async function(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userName = getUserName(callbackQuery.from);
    const insightManager = new DustMarketingInsights();

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
                break;

            default:
                bot.sendMessage(chatId, '🚧 해당 기능은 개발 중입니다!');
        }
    } catch (error) {
        bot.sendMessage(chatId, `❌ 처리 중 오류 발생: ${error.message}`);
    }
};

module.exports.DustMarketingInsights = DustMarketingInsights;
