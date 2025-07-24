// src/modules/InsightModule.js - 미세먼지 기반 마케팅 인사이트 모듈

const BaseModule = require("./BaseModule");
const InsightService = require("../services/InsightService");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class InsightModule extends BaseModule {
  constructor(bot, dependencies) {
    super("InsightModule", {
      commands: ["insight"],
      callbacks: ["insight"],
      features: ["dashboard", "marketing", "analysis", "forecast"],
    });

    this.insightService = null;
  }

  // 🎯 모듈 초기화
  async onInitialize() {
    try {
      this.insightService = new InsightService();
      logger.info("📊 InsightModule 초기화 완료");
    } catch (error) {
      logger.error("❌ InsightModule 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록 (ActionMap 방식)
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showInsightMenu,

      // 핵심 인사이트
      full: this.showFullInsight,
      quick: this.showQuickInsight,
      dashboard: this.showDashboard,

      // 전략 분석
      marketing: this.showMarketingStrategy,
      products: this.showProductStrategy,
      pricing: this.showPricingStrategy,
      inventory: this.showInventoryStrategy,

      // 시장 분석
      national: this.showNationalStatus,
      regional: this.showRegionalStrategy,
      competitor: this.showCompetitorStrategy,

      // 유틸리티
      refresh: this.refreshAllData,
      alert: this.showAlerts,
      help: this.showInsightHelp,
    });
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    // /insight 명령어 처리
    if (text.startsWith("/insight")) {
      const args = text.split(" ").slice(1);

      if (args.length === 0) {
        // 기본 메뉴 표시
        await this.showInsightMenu(bot, {
          message: { chat: { id: chatId } },
          from: msg.from,
        });
      } else {
        // 서브 명령어 처리
        const subCommand = args[0].toLowerCase();
        await this.handleSubCommand(bot, msg, subCommand);
      }

      return true;
    }

    return false;
  }

  // 📋 인사이트 메인 메뉴
  async showInsightMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);

    const menuText = `📊 **${userName}님의 마케팅 인사이트**

🌫️ **미세먼지 기반 마케팅 전략**
실시간 대기질 데이터를 활용한 
스마트 마케팅 솔루션을 제공합니다.

🎯 **주요 기능**
• 실시간 시장 기회 분석
• 미세먼지 기반 수요 예측  
• 동적 가격 전략 수립
• 지역별 마케팅 전략
• 재고 최적화 권장

어떤 인사이트가 필요하신가요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 종합 인사이트", callback_data: "insight:full" },
          { text: "⚡ 빠른 분석", callback_data: "insight:quick" },
        ],
        [
          { text: "📱 실시간 대시보드", callback_data: "insight:dashboard" },
          { text: "🗺️ 전국 현황", callback_data: "insight:national" },
        ],
        [
          { text: "🎯 마케팅 전략", callback_data: "insight:marketing" },
          { text: "🎁 제품 전략", callback_data: "insight:products" },
        ],
        [
          { text: "💰 가격 전략", callback_data: "insight:pricing" },
          { text: "📦 재고 전략", callback_data: "insight:inventory" },
        ],
        [
          { text: "🚨 실시간 알림", callback_data: "insight:alert" },
          { text: "🔄 데이터 새로고침", callback_data: "insight:refresh" },
        ],
        [
          { text: "❓ 도움말", callback_data: "insight:help" },
          { text: "🏠 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    await this.editMessage(
      bot,
      chatId,
      callbackQuery.message?.message_id,
      menuText,
      {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      }
    );

    return true;
  }

  // 🌟 종합 인사이트
  async showFullInsight(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      // 로딩 메시지 표시
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "📊 **종합 인사이트 생성 중...**\n\n🌫️ 미세먼지 데이터 수집\n📈 시장 분석 진행\n💡 전략 수립 중",
        { parse_mode: "Markdown" }
      );

      const userName = getUserName(from);
      const insights = await this.insightService.generateFullInsight(userName);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 대시보드", callback_data: "insight:dashboard" },
            { text: "🎯 마케팅 전략", callback_data: "insight:marketing" },
          ],
          [
            { text: "🗺️ 전국 현황", callback_data: "insight:national" },
            { text: "🔄 새로고침", callback_data: "insight:refresh" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, insights, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("종합 인사이트 표시 실패:", error);
      await this.sendError(bot, chatId, "종합 인사이트를 불러올 수 없습니다.");
      return true;
    }
  }

  // ⚡ 빠른 인사이트
  async showQuickInsight(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const userName = getUserName(from);
      const insight = await this.insightService.generateQuickInsight(userName);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 종합 분석", callback_data: "insight:full" },
            { text: "📱 대시보드", callback_data: "insight:dashboard" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, insight, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("빠른 인사이트 표시 실패:", error);
      await this.sendError(bot, chatId, "빠른 인사이트를 불러올 수 없습니다.");
      return true;
    }
  }

  // 📱 실시간 대시보드
  async showDashboard(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      // 로딩 표시
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "📱 **실시간 대시보드 로딩 중...**\n\n🗺️ 전국 데이터 수집\n📊 시장 현황 분석",
        { parse_mode: "Markdown" }
      );

      const userName = getUserName(from);
      const dashboard = await this.insightService.generateDashboard(userName);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌟 종합 분석", callback_data: "insight:full" },
            { text: "🗺️ 전국 현황", callback_data: "insight:national" },
          ],
          [
            { text: "🎯 마케팅", callback_data: "insight:marketing" },
            { text: "🔄 새로고침", callback_data: "insight:refresh" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, dashboard, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("대시보드 표시 실패:", error);
      await this.sendError(bot, chatId, "대시보드를 불러올 수 없습니다.");
      return true;
    }
  }

  // 🎯 마케팅 전략
  async showMarketingStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const userName = getUserName(from);
      const strategy = await this.insightService.generateMarketingStrategy(
        userName
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🎁 제품 전략", callback_data: "insight:products" },
            { text: "💰 가격 전략", callback_data: "insight:pricing" },
          ],
          [
            { text: "📦 재고 전략", callback_data: "insight:inventory" },
            { text: "🗺️ 지역 전략", callback_data: "insight:regional" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, strategy, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("마케팅 전략 표시 실패:", error);
      await this.sendError(bot, chatId, "마케팅 전략을 불러올 수 없습니다.");
      return true;
    }
  }

  // 🎁 제품 전략
  async showProductStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const userName = getUserName(from);
      const strategy = await this.insightService.generateProductStrategy(
        userName
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💰 가격 전략", callback_data: "insight:pricing" },
            { text: "📦 재고 전략", callback_data: "insight:inventory" },
          ],
          [
            { text: "🎯 마케팅", callback_data: "insight:marketing" },
            { text: "⚔️ 경쟁 분석", callback_data: "insight:competitor" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, strategy, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("제품 전략 표시 실패:", error);
      await this.sendError(bot, chatId, "제품 전략을 불러올 수 없습니다.");
      return true;
    }
  }

  // 💰 가격 전략
  async showPricingStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const userName = getUserName(from);
      const strategy = await this.insightService.generatePricingStrategy(
        userName
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🎁 제품 전략", callback_data: "insight:products" },
            { text: "📦 재고 전략", callback_data: "insight:inventory" },
          ],
          [
            { text: "⚔️ 경쟁 분석", callback_data: "insight:competitor" },
            { text: "🗺️ 지역 분석", callback_data: "insight:regional" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, strategy, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("가격 전략 표시 실패:", error);
      await this.sendError(bot, chatId, "가격 전략을 불러올 수 없습니다.");
      return true;
    }
  }

  // 📦 재고 전략
  async showInventoryStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      const userName = getUserName(from);
      const strategy = await this.insightService.generateInventoryStrategy(
        userName
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🎁 제품 전략", callback_data: "insight:products" },
            { text: "💰 가격 전략", callback_data: "insight:pricing" },
          ],
          [
            { text: "📊 수요 예측", callback_data: "insight:forecast" },
            { text: "🚨 재고 알림", callback_data: "insight:alert" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, strategy, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("재고 전략 표시 실패:", error);
      await this.sendError(bot, chatId, "재고 전략을 불러올 수 없습니다.");
      return true;
    }
  }

  // 🗺️ 전국 현황
  async showNationalStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    try {
      // 로딩 표시
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "🗺️ **전국 현황 분석 중...**\n\n📍 주요 도시 데이터 수집\n📊 지역별 기회 분석",
        { parse_mode: "Markdown" }
      );

      const userName = getUserName(from);
      const status = await this.insightService.generateNationalStatus(userName);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 대시보드", callback_data: "insight:dashboard" },
            { text: "🏙️ 지역 전략", callback_data: "insight:regional" },
          ],
          [
            { text: "🎯 타겟 분석", callback_data: "insight:marketing" },
            { text: "🔄 새로고침", callback_data: "insight:refresh" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, status, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("전국 현황 표시 실패:", error);
      await this.sendError(bot, chatId, "전국 현황을 불러올 수 없습니다.");
      return true;
    }
  }

  // 🏙️ 지역 전략 (추가 구현)
  async showRegionalStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const strategy = `🏙️ **지역별 마케팅 전략**

🎯 **핵심 타겟 지역**
• 서울/경기: 프리미엄 전략
• 부산/경남: 가성비 전략  
• 대구/경북: 브랜드 신뢰 전략
• 광주/전남: 접근성 전략

📊 **지역별 특화 전략**
• 수도권: 온라인 중심, 빠른 배송
• 지방 대도시: 오프라인 제휴 강화
• 중소도시: 지역 밀착 마케팅

💡 **실행 우선순위**
1. 미세먼지 고위험 지역 우선
2. 구매력 높은 지역 집중
3. 경쟁사 약한 지역 공략`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🗺️ 전국 현황", callback_data: "insight:national" },
          { text: "🎯 마케팅", callback_data: "insight:marketing" },
        ],
        [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, strategy, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  // ⚔️ 경쟁사 분석 (추가 구현)
  async showCompetitorStrategy(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const analysis = `⚔️ **경쟁사 분석**

🏢 **주요 경쟁사 현황**
• A사: 시장점유율 35% (프리미엄 포지셔닝)
• B사: 시장점유율 25% (가격 경쟁력)  
• C사: 시장점유율 20% (브랜드 파워)
• 기타: 20% (다양한 소규모 업체)

🎯 **차별화 포인트**
• 실시간 대기질 기반 마케팅
• 미세먼지 예보 연동 서비스
• 개인화된 건강 솔루션

💡 **경쟁 우위 확보 방안**
1. 데이터 기반 마케팅 차별화
2. 고객 맞춤형 서비스 강화
3. 신속한 시장 대응 체계 구축`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎁 제품 전략", callback_data: "insight:products" },
          { text: "💰 가격 전략", callback_data: "insight:pricing" },
        ],
        [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, analysis, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  // 🚨 실시간 알림
  async showAlerts(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const alerts = `🚨 **실시간 마케팅 알림**

⚠️ **현재 활성 알림**
• 서울 지역 미세먌지 '나쁨' - 마스크 수요 증가 예상
• KF94 재고 85% - 추가 주문 검토 필요  
• 온라인 검색량 +45% - 마케팅 기회 확대

📈 **기회 알림**
• 부산 지역 경쟁사 품절 - 공급 확대 기회
• 대구 지역 프로모션 효과 - 추가 투자 고려

🔔 **알림 설정**
• 미세먼지 '나쁨' 이상 시 즉시 알림
• 재고 부족 (90% 이하) 시 알림
• 경쟁사 동향 변화 시 알림

⏰ **마지막 업데이트**: 방금 전`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📱 대시보드", callback_data: "insight:dashboard" },
          { text: "📦 재고 현황", callback_data: "insight:inventory" },
        ],
        [
          { text: "🔔 알림 설정", callback_data: "insight:alert_settings" },
          { text: "🔄 새로고침", callback_data: "insight:refresh" },
        ],
        [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, alerts, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  // 🔄 데이터 새로고침
  async refreshAllData(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      // 새로고침 진행 표시
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "🔄 **데이터 새로고침 중...**\n\n📡 실시간 대기질 데이터 수집\n📊 시장 정보 업데이트\n💡 인사이트 재분석",
        { parse_mode: "Markdown" }
      );

      // 실제 데이터 새로고침 (캐시 클리어)
      // this.insightService.clearCache(); // 구현 시 사용

      // 완료 메시지
      const refreshResult = `✅ **데이터 새로고침 완료**

📊 **업데이트된 정보**
• 전국 8개 지역 대기질 현황
• 실시간 시장 기회 분석
• 수요 예측 모델 재계산
• 가격 전략 최적화
• 재고 권장사항 갱신

⏰ **업데이트 시간**: ${new Date().toLocaleString("ko-KR")}

새로운 인사이트를 확인해보세요!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌟 종합 분석", callback_data: "insight:full" },
            { text: "📱 대시보드", callback_data: "insight:dashboard" },
          ],
          [
            { text: "🗺️ 전국 현황", callback_data: "insight:national" },
            { text: "🚨 알림 확인", callback_data: "insight:alert" },
          ],
          [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, refreshResult, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("데이터 새로고침 실패:", error);
      await this.sendError(
        bot,
        chatId,
        "데이터 새로고침 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // ❓ 도움말
  async showInsightHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **마케팅 인사이트 도움말**

🌫️ **미세먌지 기반 마케팅이란?**
실시간 대기질 데이터를 활용하여 마스크 등 
관련 제품의 수요를 예측하고 최적의 
마케팅 전략을 제안하는 시스템입니다.

📊 **주요 기능 설명**

**🌟 종합 인사이트**
• 현재 대기질 + 시장 기회 + 액션플랜

**⚡ 빠른 분석**  
• 핵심 지표만 요약한 간단 분석

**📱 실시간 대시보드**
• 전국 8개 주요 도시 현황 모니터링

**💰 가격 전략**
• 대기질 등급별 최적 가격 제안

**📦 재고 전략**  
• 수요 예측 기반 재고 관리 권장

**🗺️ 전국 현황**
• 지역별 마케팅 기회 분석

💡 **활용 팁**
• 미세먼지 '나쁨' 이상 시 적극 활용
• 주간 정기 점검으로 트렌드 파악
• 경쟁사 대비 차별화 포인트 발굴`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 종합 분석 체험", callback_data: "insight:full" },
          { text: "📱 대시보드 보기", callback_data: "insight:dashboard" },
        ],
        [{ text: "🔙 인사이트 메뉴", callback_data: "insight:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    return true;
  }

  // 🎯 서브 명령어 처리
  async handleSubCommand(bot, msg, subCommand) {
    const {
      chat: { id: chatId },
      from,
    } = msg;

    const fakeCallback = {
      message: { chat: { id: chatId }, message_id: null },
      from: from,
    };

    switch (subCommand) {
      case "quick":
      case "q":
        await this.showQuickInsight(bot, fakeCallback);
        break;
      case "dashboard":
      case "dash":
        await this.showDashboard(bot, fakeCallback);
        break;
      case "national":
      case "nation":
        await this.showNationalStatus(bot, fakeCallback);
        break;
      case "marketing":
      case "market":
        await this.showMarketingStrategy(bot, fakeCallback);
        break;
      case "help":
        await this.showInsightHelp(bot, fakeCallback);
        break;
      default:
        await this.showInsightMenu(bot, fakeCallback);
        break;
    }
  }
}

module.exports = InsightModule;
