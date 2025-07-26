// src/controllers/BotController.js - 통합 봇 컨트롤러 v3.0.1
const { Telegraf } = require("telegraf");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const NavigationHandler = require("../handlers/NavigationHandler");

/**
 * 🤖 BotController v3.0.1 (리팩토링)
 *
 * 🔧 주요 개선사항:
 * - 중복 처리 방지 로직 강화
 * - NavigationHandler 위임 구조 명확화
 * - 에러 처리 표준화
 * - Railway 환경 최적화
 * - 성능 모니터링 강화
 */
class BotController {
  constructor(botToken, config = {}) {
    this.botToken = botToken;
    this.config = {
      timeout: 30000,
      retries: 3,
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      webhookMode: config.webhookMode || false,
      ...config,
    };

    // 🤖 Telegraf 인스턴스
    this.bot = null;

    // 🎹 핸들러들
    this.navigationHandler = null;
    this.moduleManager = null;

    // 🚫 중복 처리 방지 맵
    this.processingCallbacks = new Map();
    this.processingMessages = new Map();

    // ⏰ 정리 타이머
    this.cleanupInterval = null;

    // 📊 통계
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      activeMessages: 0,
      activeCallbacks: 0,
      totalUsers: 0,
      uniqueUsers: new Set(),
      errorsCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastActivity: null,
      startTime: Date.now(),
    };

    // 🔧 상태
    this.initialized = false;
  }

  /**
   * 🚀 BotController 초기화
   */
  async initialize(moduleManager) {
    try {
      logger.moduleStart("BotController", "3.0.1");

      // 매개변수 검증
      if (!this.botToken) {
        throw new Error("봇 토큰이 없습니다");
      }

      if (!moduleManager) {
        throw new Error("ModuleManager가 필요합니다");
      }

      this.moduleManager = moduleManager;

      // 🤖 Telegraf 초기화
      await this.initializeTelegraf();

      // 🎹 NavigationHandler 초기화
      await this.initializeNavigationHandler();

      // 🎮 이벤트 핸들러 설정
      this.setupEventHandlers();

      // ⏰ 정리 작업 스케줄
      this.scheduleCleanup();

      // 🏥 헬스체크 엔드포인트 (Railway)
      if (this.config.isRailway) {
        this.setupHealthEndpoint();
      }

      this.initialized = true;
      logger.success("✅ BotController 초기화 완료", {
        bot: !!this.bot,
        navigation: !!this.navigationHandler,
        modules: !!this.moduleManager,
        railway: this.config.isRailway,
      });
    } catch (error) {
      logger.fatal("💀 BotController 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🤖 Telegraf 초기화
   */
  async initializeTelegraf() {
    try {
      this.bot = new Telegraf(this.botToken);

      // 봇 정보 확인
      const botInfo = await this.bot.telegram.getMe();
      logger.info(`🤖 봇 연결됨: @${botInfo.username}`, {
        botId: botInfo.id,
        botName: botInfo.first_name,
      });

      return true;
    } catch (error) {
      logger.error("❌ Telegraf 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎹 NavigationHandler 초기화
   */
  async initializeNavigationHandler() {
    try {
      this.navigationHandler = new NavigationHandler();
      await this.navigationHandler.initialize(this.moduleManager);

      logger.success("🎹 NavigationHandler 초기화 완료");
      return true;
    } catch (error) {
      logger.error("❌ NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎮 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    if (!this.bot) {
      throw new Error("Telegraf 인스턴스가 없습니다");
    }

    // 🔄 미들웨어: 기본 정보 로깅
    this.bot.use(async (ctx, next) => {
      const startTime = Date.now();

      try {
        await next();
      } catch (error) {
        logger.error("🔄 미들웨어 오류:", error);
      } finally {
        const duration = Date.now() - startTime;
        this.updateResponseTimeStats(duration);
      }
    });

    // 💬 메시지 처리
    this.bot.on("text", (ctx) => this.handleMessage(ctx));
    this.bot.command("start", (ctx) => this.handleMessage(ctx));

    // ⚡ 콜백 쿼리 처리 (핵심!)
    this.bot.on("callback_query", (ctx) => this.handleCallback(ctx));

    // 🔍 인라인 쿼리 처리
    this.bot.on("inline_query", (ctx) => this.handleInlineQuery(ctx));

    // 📎 미디어 처리
    this.bot.on("photo", (ctx) => this.handleMedia(ctx, "photo"));
    this.bot.on("document", (ctx) => this.handleMedia(ctx, "document"));
    this.bot.on("voice", (ctx) => this.handleMedia(ctx, "voice"));
    this.bot.on("audio", (ctx) => this.handleMedia(ctx, "audio"));

    logger.debug("🎮 Telegraf 핸들러 설정 완료");
  }

  /**
   * ⚡ 콜백 처리 (핵심 로직)
   */
  async handleCallback(ctx) {
    const startTime = Date.now();
    const userId = ctx.from?.id;
    const callbackId = ctx.callbackQuery?.id;
    const uniqueKey = `callback_${userId}_${callbackId}`;

    try {
      // 🚫 중복 처리 방지
      if (this.processingCallbacks.has(uniqueKey)) {
        logger.debug(`🚫 중복 콜백 차단: ${uniqueKey}`);

        await this.answerCallbackQuery(ctx, "⏳ 처리 중입니다...", true);
        return;
      }

      // 📊 처리 시작 등록
      this.processingCallbacks.set(uniqueKey, {
        startTime,
        userId,
        callbackData: ctx.callbackQuery.data,
      });

      this.stats.activeCallbacks++;
      this.stats.callbacksReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 👤 사용자 통계 업데이트
      this.stats.uniqueUsers.add(userId);
      this.stats.totalUsers = this.stats.uniqueUsers.size;

      logger.debug(
        `⚡ 콜백 처리 시작: ${getUserName(ctx.from)} -> ${
          ctx.callbackQuery.data
        }`
      );

      // ✅ 기본 콜백 응답 (사용자 대기 해제)
      await this.answerCallbackQuery(ctx);

      // 🎹 NavigationHandler로 위임 (표준 흐름)
      let handled = false;

      if (this.navigationHandler) {
        handled = await this.navigationHandler.handleNavigation(
          this.bot,
          ctx.callbackQuery,
          null, // subAction은 NavigationHandler에서 파싱
          [], // params도 NavigationHandler에서 파싱
          this.moduleManager
        );
      } else {
        logger.error("❌ NavigationHandler가 없음");
        await this.handleSystemError(ctx, "네비게이션 핸들러 오류");
        return;
      }

      // 🚨 처리되지 않은 콜백 처리
      if (!handled) {
        logger.warn(`❓ 처리되지 않은 콜백: ${ctx.callbackQuery.data}`);
        await this.handleUnprocessedCallback(ctx);
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      await this.handleCallbackError(ctx, error);
    } finally {
      // 🧹 정리 작업
      this.processingCallbacks.delete(uniqueKey);
      this.stats.activeCallbacks = Math.max(0, this.stats.activeCallbacks - 1);

      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);

      logger.debug(`⚡ 콜백 처리 완료: ${uniqueKey} (${duration}ms)`);
    }
  }

  /**
   * 💬 메시지 처리
   */
  async handleMessage(ctx) {
    const startTime = Date.now();
    const userId = ctx.from?.id;
    const messageId = ctx.message?.message_id;
    const uniqueKey = `message_${userId}_${messageId}`;

    try {
      // 🚫 중복 처리 방지
      if (this.processingMessages.has(uniqueKey)) {
        logger.debug(`🚫 중복 메시지 차단: ${uniqueKey}`);
        return;
      }

      // 📊 처리 시작 등록
      this.processingMessages.set(uniqueKey, {
        startTime,
        userId,
        text: ctx.message.text?.substring(0, 50),
      });

      this.stats.activeMessages++;
      this.stats.messagesReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 👤 사용자 통계 업데이트
      this.stats.uniqueUsers.add(userId);
      this.stats.totalUsers = this.stats.uniqueUsers.size;

      logger.debug(
        `💬 메시지 처리 시작: ${getUserName(
          ctx.from
        )} -> "${ctx.message.text?.substring(0, 30)}..."`
      );

      // 📦 ModuleManager로 위임
      if (this.moduleManager) {
        await this.moduleManager.handleMessage(this.bot, ctx.message);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 메시지 처리 불가");
        await ctx.reply(
          "🚧 시스템이 아직 준비되지 않았습니다. 잠시만 기다려주세요."
        );
      }
    } catch (error) {
      logger.error(`❌ 메시지 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      await this.handleMessageError(ctx, error);
    } finally {
      // 🧹 정리 작업
      this.processingMessages.delete(uniqueKey);
      this.stats.activeMessages = Math.max(0, this.stats.activeMessages - 1);

      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);

      logger.debug(`💬 메시지 처리 완료: ${uniqueKey} (${duration}ms)`);
    }
  }

  /**
   * 🔍 인라인 쿼리 처리
   */
  async handleInlineQuery(ctx) {
    try {
      logger.debug(`🔍 인라인 쿼리: ${ctx.inlineQuery.query}`);

      // 기본 인라인 응답
      await ctx.answerInlineQuery([]);
    } catch (error) {
      logger.error("❌ 인라인 쿼리 처리 실패:", error);
    }
  }

  /**
   * 📎 미디어 처리
   */
  async handleMedia(ctx, mediaType) {
    try {
      logger.debug(`📎 미디어 수신: ${mediaType}`);

      if (this.moduleManager) {
        await this.moduleManager.handleMessage(this.bot, ctx.message);
      }
    } catch (error) {
      logger.error(`❌ 미디어 처리 실패 (${mediaType}):`, error);
    }
  }

  /**
   * 🔍 의존성 검증 (상세 디버깅 추가)
   */
  validateDependencies() {
    console.log("🔍 BotController 의존성 검증 시작...");

    const required = [
      { name: "bot", obj: this.bot },
      { name: "moduleManager", obj: this.moduleManager },
    ];

    const optional = [
      { name: "dbManager", obj: this.dbManager },
      { name: "validationManager", obj: this.validationManager },
      { name: "healthChecker", obj: this.healthChecker },
    ];

    // 🔍 상세 디버깅: 각 의존성 개별 확인
    console.log("🔍 필수 의존성 상세 확인:");
    for (const { name, obj } of required) {
      console.log(`   ${name}:`, {
        exists: !!obj,
        type: typeof obj,
        constructor: obj?.constructor?.name,
        isNull: obj === null,
        isUndefined: obj === undefined,
        truthyCheck: !!obj,
      });
    }

    // 필수 의존성 체크
    for (const { name, obj } of required) {
      if (!obj) {
        console.error(`❌ 필수 의존성 누락 상세:`, {
          name,
          obj,
          type: typeof obj,
          isNull: obj === null,
          isUndefined: obj === undefined,
        });
        throw new Error(`필수 의존성 누락: ${name}`);
      }
    }

    // 선택적 의존성 체크 (경고만)
    console.log("🔍 선택적 의존성 확인:");
    for (const { name, obj } of optional) {
      console.log(`   ${name}: ${!!obj}`);
      if (!obj) {
        logger.warn(
          `⚠️ 선택적 의존성 누락: ${name} - 관련 기능이 제한될 수 있습니다.`
        );
      }
    }

    console.log("✅ 의존성 검증 완료");
    logger.debug("✅ 의존성 검증 완료");
  }

  // ===== 🚨 에러 처리 메서드들 =====

  /**
   * ✅ 안전한 콜백 응답
   */
  async answerCallbackQuery(ctx, text = null, showAlert = false) {
    try {
      const options = {};
      if (text) options.text = text;
      if (showAlert) options.show_alert = true;

      await ctx.answerCbQuery(options);
    } catch (error) {
      logger.debug("콜백 쿼리 응답 실패:", error.message);
    }
  }

  /**
   * 🚨 처리되지 않은 콜백 처리
   */
  async handleUnprocessedCallback(ctx) {
    try {
      await ctx.editMessageText(
        "⚠️ **요청을 처리할 수 없습니다**\n\n해당 기능이 일시적으로 사용할 수 없거나\n아직 구현되지 않았습니다.\n\n메인 메뉴로 돌아가서 다시 시도해주세요.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
            ],
          },
        }
      );
    } catch (editError) {
      logger.debug("처리되지 않은 콜백 메시지 편집 실패:", editError.message);
    }
  }

  /**
   * 🚨 시스템 오류 처리
   */
  async handleSystemError(ctx, errorMessage) {
    try {
      await ctx.editMessageText(
        `❌ **시스템 오류**\n\n${errorMessage}\n\n시스템 관리자에게 문의하거나\n잠시 후 다시 시도해주세요.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔄 새로고침", callback_data: "system:start" },
                { text: "📊 시스템 상태", callback_data: "system:status" },
              ],
            ],
          },
        }
      );
    } catch (editError) {
      logger.debug("시스템 오류 메시지 편집 실패:", editError.message);
    }
  }

  /**
   * 🚨 콜백 에러 처리
   */
  async handleCallbackError(ctx, error) {
    try {
      await this.answerCallbackQuery(
        ctx,
        "❌ 처리 중 오류가 발생했습니다.",
        true
      );
    } catch (answerError) {
      logger.error("콜백 에러 응답 실패:", answerError);
    }
  }

  /**
   * 🚨 메시지 에러 처리
   */
  async handleMessageError(ctx, error) {
    try {
      await ctx.reply(
        "❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } catch (replyError) {
      logger.error("메시지 에러 응답 실패:", replyError);
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * ⏰ 정리 작업 스케줄
   */
  scheduleCleanup() {
    // 5분마다 오래된 처리 맵 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleProcesses();
    }, 5 * 60 * 1000);

    logger.debug("⏰ 자동 정리 작업 예약됨 (5분 간격)");
  }

  /**
   * 🧹 오래된 프로세스 정리
   */
  cleanupStaleProcesses() {
    const now = Date.now();
    const timeout = 2 * 60 * 1000; // 2분 타임아웃
    let cleanedCount = 0;

    // 오래된 콜백 정리
    for (const [key, data] of this.processingCallbacks.entries()) {
      if (now - data.startTime > timeout) {
        this.processingCallbacks.delete(key);
        cleanedCount++;
      }
    }

    // 오래된 메시지 정리
    for (const [key, data] of this.processingMessages.entries()) {
      if (now - data.startTime > timeout) {
        this.processingMessages.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 오래된 프로세스 ${cleanedCount}개 정리됨`);
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;

    const totalRequests =
      this.stats.messagesReceived + this.stats.callbacksReceived;
    if (totalRequests > 0) {
      this.stats.averageResponseTime = Math.round(
        this.stats.totalResponseTime / totalRequests
      );
    }
  }

  // ===== 🔄 봇 시작/중지 =====

  /**
   * 🚀 봇 시작 (폴링 모드)
   */
  async startPolling() {
    try {
      if (!this.initialized) {
        throw new Error("BotController가 초기화되지 않았습니다");
      }

      logger.info("🚀 봇 폴링 시작...");
      await this.bot.launch();

      logger.success("✅ 봇이 성공적으로 시작되었습니다 (폴링 모드)");

      // Railway에서 업타임 유지
      if (this.config.isRailway) {
        this.keepAlive();
      }
    } catch (error) {
      logger.fatal("💀 봇 시작 실패", error, true);
    }
  }

  /**
   * 🌐 봇 시작 (웹훅 모드)
   */
  async startWebhook(domain, port = 3000) {
    try {
      if (!this.initialized) {
        throw new Error("BotController가 초기화되지 않았습니다");
      }

      const webhookUrl = `${domain}/webhook`;

      logger.info(`🌐 봇 웹훅 시작: ${webhookUrl}`);
      await this.bot.launch({
        webhook: {
          domain,
          port,
        },
      });

      logger.success(
        `✅ 봇이 성공적으로 시작되었습니다 (웹훅 모드: ${webhookUrl})`
      );
    } catch (error) {
      logger.fatal("💀 봇 웹훅 시작 실패", error, true);
    }
  }

  /**
   * 💚 Railway 업타임 유지
   */
  keepAlive() {
    if (!this.config.isRailway) return;

    setInterval(() => {
      logger.debug("💚 Railway 업타임 유지");
    }, 25 * 60 * 1000); // 25분마다
  }

  /**
   * 🏥 헬스체크 엔드포인트 설정
   */
  setupHealthEndpoint() {
    const express = require("express");
    const app = express();

    app.get("/health", (req, res) => {
      const health = {
        status: "healthy",
        timestamp: TimeHelper.getLogTimeString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bot: {
          initialized: this.initialized,
          connected: !!this.bot,
        },
        stats: this.stats,
        modules: this.moduleManager?.getStatus() || {},
      };

      res.status(200).json(health);
    });

    app.get("/ping", (req, res) => {
      res.status(200).send("pong");
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.debug(`🏥 헬스체크 서버 시작: 포트 ${port}`);
    });
  }

  // ===== 📊 상태 및 통계 =====

  /**
   * 📊 봇 상태 조회
   */
  getStatus() {
    return {
      className: "BotController",
      version: "3.0.1",
      initialized: this.initialized,
      botConnected: !!this.bot,
      navigationHandlerActive: !!this.navigationHandler,
      moduleManagerActive: !!this.moduleManager,
      stats: {
        ...this.stats,
        uniqueUsersCount: this.stats.uniqueUsers.size,
      },
      performance: {
        activeMessages: this.stats.activeMessages,
        activeCallbacks: this.stats.activeCallbacks,
        processingMapsSize: {
          callbacks: this.processingCallbacks.size,
          messages: this.processingMessages.size,
        },
      },
      config: {
        isRailway: this.config.isRailway,
        webhookMode: this.config.webhookMode,
      },
    };
  }

  /**
   * 📊 상태 텍스트 생성
   */
  generateStatusText() {
    const status = this.getStatus();
    const uptime = Date.now() - this.stats.startTime;

    return `🤖 **BotController v3.0.1 상태**

🔧 **시스템 상태**:
• 초기화: ${status.initialized ? "✅" : "❌"}
• 봇 연결: ${status.botConnected ? "✅" : "❌"}
• 네비게이션: ${status.navigationHandlerActive ? "✅" : "❌"}
• 모듈관리자: ${status.moduleManagerActive ? "✅" : "❌"}

📊 **통계**:
• 메시지: ${status.stats.messagesReceived}개
• 콜백: ${status.stats.callbacksReceived}개
• 사용자: ${status.stats.totalUsers}명
• 평균응답: ${status.stats.averageResponseTime}ms
• 에러: ${status.stats.errorsCount}개

⚡ **현재 처리**:
• 메시지: ${status.performance.activeMessages}개
• 콜백: ${status.performance.activeCallbacks}개

⏱️ **가동시간**: ${this.formatUptime(uptime)}`;
  }

  /**
   * ⏱️ 가동시간 포맷팅
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분`;
    return `${seconds}초`;
  }

  /**
   * 🛑 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🛑 BotController 정리 시작...");

      // 정리 타이머 중지
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // NavigationHandler 정리
      if (this.navigationHandler) {
        await this.navigationHandler.cleanup();
        this.navigationHandler = null;
      }

      // 처리 맵 정리
      this.processingCallbacks.clear();
      this.processingMessages.clear();

      // 통계 정리
      this.stats.uniqueUsers.clear();

      // 봇 정지
      if (this.bot) {
        await this.bot.stop();
        this.bot = null;
      }

      this.initialized = false;
      logger.success("✅ BotController 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
    }
  }
}

module.exports = BotController;
