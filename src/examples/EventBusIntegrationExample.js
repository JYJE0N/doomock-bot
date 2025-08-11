/**
 * 🚇 EventBus 통합 예제
 * DoomockBot에 EventBus를 통합하는 방법을 보여주는 예제
 */

const EventBus = require('../core/EventBus');
const ModuleManager = require('../core/ModuleManager');
const { EVENTS } = require('../events/index');
const logger = require('../utils/core/Logger');

class EventBusIntegrationExample {
  constructor() {
    this.eventBus = EventBus.getInstance();
    this.moduleManager = null;
    this.bot = null;
  }

  /**
   * 🚀 EventBus 통합 시작
   */
  async initialize(bot, serviceBuilder) {
    try {
      logger.info("🚇 EventBus 통합 예제 시작...");

      this.bot = bot;

      // 1. EventBus 미들웨어 설정
      this.setupEventBusMiddleware();

      // 2. ModuleManager에 EventBus 주입
      this.moduleManager = new ModuleManager({
        bot,
        serviceBuilder,
        eventBus: this.eventBus
      });

      // 3. ModuleManager 초기화
      await this.moduleManager.initialize(bot);

      // 4. Telegram 이벤트를 EventBus로 연결
      this.setupTelegramToEventBridge();

      // 5. EventBus 이벤트를 Telegram으로 연결
      this.setupEventToTelegramBridge();

      logger.success("✅ EventBus 통합 완료");

    } catch (error) {
      logger.error("❌ EventBus 통합 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 EventBus 미들웨어 설정
   */
  setupEventBusMiddleware() {
    // 로깅 미들웨어
    this.eventBus.use(async (event, next) => {
      logger.debug(`🚇 이벤트: ${event.name}`, {
        source: event.metadata.source,
        timestamp: event.metadata.timestamp
      });
      await next();
    });

    // 성능 모니터링 미들웨어
    this.eventBus.use(async (event, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      if (duration > 100) {
        logger.warn(`⚠️ 느린 이벤트: ${event.name} (${duration}ms)`);
      }
    });

    // 에러 처리 미들웨어
    this.eventBus.use(async (event, next) => {
      try {
        await next();
      } catch (error) {
        logger.error(`💥 이벤트 처리 오류: ${event.name}`, error);
        
        // 시스템 에러 이벤트 발행
        await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
          error: error.message,
          originalEvent: event.name,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 🌉 Telegram → EventBus 브릿지
   */
  setupTelegramToEventBridge() {
    // 텍스트 메시지 → 이벤트
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;

      if (text.startsWith('/')) {
        // 명령어 이벤트
        await this.eventBus.publish(EVENTS.USER.COMMAND, {
          command: text.slice(1),
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id
        });
      } else {
        // 일반 메시지 이벤트
        await this.eventBus.publish(EVENTS.USER.MESSAGE, {
          text,
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          messageId: ctx.message.message_id
        });
      }
    });

    // 콜백 쿼리 → 이벤트
    this.bot.on('callback_query', async (ctx) => {
      await ctx.answerCbQuery("⏳ 처리 중...");

      await this.eventBus.publish(EVENTS.USER.CALLBACK, {
        data: ctx.callbackQuery.data,
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        messageId: ctx.callbackQuery.message?.message_id
      });
    });
  }

  /**
   * 🌉 EventBus → Telegram 브릿지
   */
  setupEventToTelegramBridge() {
    // 메시지 렌더링 요청 처리
    this.eventBus.subscribe(EVENTS.RENDER.MESSAGE_REQUEST, async (event) => {
      const { chatId, text, options = {} } = event.payload;

      try {
        await this.bot.telegram.sendMessage(chatId, text, options);
        
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_SENT, {
          chatId,
          text,
          success: true,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error("📤 메시지 전송 실패:", error);
        
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: "메시지 전송에 실패했습니다."
        });
      }
    });

    // 메뉴 렌더링 요청 처리
    this.eventBus.subscribe(EVENTS.RENDER.MENU_REQUEST, async (event) => {
      const { chatId, menuType, data = {}, options = {} } = event.payload;

      try {
        // 메뉴 키보드 생성 (NavigationHandler 대신 EventBus로)
        const keyboard = this.generateMenuKeyboard(menuType, data);
        const text = this.generateMenuText(menuType, data);

        await this.bot.telegram.sendMessage(chatId, text, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
          ...options
        });

        await this.eventBus.publish(EVENTS.RENDER.MENU_SENT, {
          chatId,
          menuType,
          success: true,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error("📋 메뉴 전송 실패:", error);
        
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: "메뉴 생성에 실패했습니다."
        });
      }
    });

    // 에러 메시지 처리
    this.eventBus.subscribe(EVENTS.RENDER.ERROR_REQUEST, async (event) => {
      const { chatId, error } = event.payload;

      try {
        await this.bot.telegram.sendMessage(chatId, `❌ ${error}`, {
          parse_mode: "Markdown"
        });
      } catch (sendError) {
        logger.error("💥 에러 메시지 전송 실패:", sendError);
      }
    });
  }

  /**
   * 🎨 메뉴 키보드 생성
   */
  generateMenuKeyboard(menuType, data) {
    switch (menuType) {
      case 'main':
        return {
          inline_keyboard: [
            [
              { text: "📝 할일 관리", callback_data: "todo:menu" },
              { text: "⏰ 타이머", callback_data: "timer:menu" }
            ],
            [
              { text: "💼 근무시간", callback_data: "worktime:menu" },
              { text: "🏖️ 휴가 관리", callback_data: "leave:menu" }
            ],
            [
              { text: "🔮 운세", callback_data: "fortune:menu" },
              { text: "🌤️ 날씨", callback_data: "weather:menu" }
            ],
            [
              { text: "📊 시스템 상태", callback_data: "system:status" },
              { text: "❓ 도움말", callback_data: "system:help" }
            ]
          ]
        };

      case 'system':
        return {
          inline_keyboard: [
            [
              { text: "🔄 새로고침", callback_data: "system:status" },
              { text: "🔍 건강도", callback_data: "system:health" }
            ],
            [
              { text: "🏠 메인 메뉴", callback_data: "system:menu" }
            ]
          ]
        };

      default:
        return { inline_keyboard: [] };
    }
  }

  /**
   * 📝 메뉴 텍스트 생성
   */
  generateMenuText(menuType, data) {
    switch (menuType) {
      case 'main':
        return (
          `🤖 *DoomockBot 메인 메뉴*\n\n` +
          `👋 안녕하세요 ${data.userName || '사용자'}님!\n` +
          `🚇 EventBus 기반으로 동작하는 생산성 봇입니다.\n\n` +
          `📊 *시스템 정보:*\n` +
          `• 버전: ${data.version || '4.0.0'}\n` +
          `• 모듈: ${data.moduleCount || 0}개 활성화\n` +
          `• 건강도: ${data.systemHealth?.score || 0}/100\n\n` +
          `원하는 기능을 선택해주세요:`
        );

      case 'system':
        return (
          `🔧 *시스템 상태*\n\n` +
          `⏱️ 업타임: ${data.uptime || '알 수 없음'}\n` +
          `💾 메모리: ${data.memory || '알 수 없음'}\n` +
          `🚇 EventBus: 활성화\n` +
          `📊 처리된 이벤트: ${data.totalEvents || 0}개\n\n` +
          `상세 정보를 확인하시겠습니까?`
        );

      default:
        return "메뉴 정보를 불러올 수 없습니다.";
    }
  }

  /**
   * 📊 EventBus 상태 확인
   */
  getEventBusStatus() {
    const health = this.eventBus.getHealthStatus();
    const stats = this.eventBus.getStats();

    return {
      health: health.status,
      score: health.score,
      totalEvents: stats.totalEvents,
      errorRate: stats.errorRate,
      uptime: stats.uptime,
      listeners: health.listeners
    };
  }

  /**
   * 🧹 정리 및 종료
   */
  async shutdown() {
    try {
      logger.info("🚇 EventBus 통합 예제 종료 시작...");

      // ModuleManager 종료
      if (this.moduleManager) {
        await this.moduleManager.shutdown();
      }

      // EventBus 종료
      if (this.eventBus) {
        await this.eventBus.shutdown();
      }

      logger.success("✅ EventBus 통합 예제 종료 완료");

    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
      throw error;
    }
  }
}

module.exports = EventBusIntegrationExample;