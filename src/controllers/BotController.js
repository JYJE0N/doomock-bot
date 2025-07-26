// src/controllers/BotController.js - 수정된 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const NavigationHandler = require("../handlers/NavigationHandler"); // ✅ 추가!

/**
 * 🎮 봇 컨트롤러 v3.0.1 - Telegraf 버전 (NavigationHandler 연결)
 *
 * 🔧 핵심 수정사항:
 * - NavigationHandler 인스턴스 생성
 * - 콜백 처리를 NavigationHandler로 위임
 * - 표준 매개변수 체계 준수
 * - 중앙집중식 네비게이션 처리
 */
class BotController {
  constructor(options = {}) {
    // 🤖 텔레그래프 봇
    this.bot = options.bot;

    // 🏗️ 의존성들
    this.moduleManager = options.moduleManager;
    this.dbManager = options.dbManager;
    this.validationManager = options.validationManager;
    this.healthChecker = options.healthChecker;

    // ⚙️ 설정
    this.config = {
      rateLimitEnabled: options.config?.rateLimitEnabled ?? true,
      maxRequestsPerMinute: options.config?.maxRequestsPerMinute || 30,
      messageTimeout: options.config?.messageTimeout || 5000,
      callbackTimeout: options.config?.callbackTimeout || 2000,
      ...options.config,
    };

    // 🎹 NavigationHandler 생성 (핵심 추가!)
    this.navigationHandler = null; // initialize()에서 생성

    // 📊 통계
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
      activeMessages: 0,
      activeCallbacks: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      uniqueUsers: new Set(),
      totalUsers: 0,
      lastActivity: null,
    };

    // 🔒 중복 처리 방지
    this.processingMessages = new Map();
    this.processingCallbacks = new Map();

    // 초기화 상태
    this.initialized = false;

    logger.info("🎮 BotController 생성됨 (Telegraf + NavigationHandler)");
  }

  /**
   * 🎯 초기화 (NavigationHandler 포함)
   */
  async initialize() {
    try {
      logger.info("🎮 BotController 초기화 중...");

      // 의존성 검증
      this.validateDependencies();

      // 🎹 NavigationHandler 생성 (핵심!)
      this.createNavigationHandler();

      // Telegraf 핸들러 설정
      this.setupHandlers();

      // 정리 스케줄러 시작
      this.startCleanupScheduler();

      this.initialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎹 NavigationHandler 생성 (핵심 추가!)
   */
  createNavigationHandler() {
    try {
      this.navigationHandler = new NavigationHandler(this.bot, {
        moduleManager: this.moduleManager,
        commandsRegistry: null, // 필요시 추가
      });

      logger.info("🎹 NavigationHandler 생성 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 의존성 검증
   */
  validateDependencies() {
    const required = [
      { name: "bot", obj: this.bot },
      { name: "moduleManager", obj: this.moduleManager },
    ];

    const optional = [
      { name: "dbManager", obj: this.dbManager },
      { name: "validationManager", obj: this.validationManager },
      { name: "healthChecker", obj: this.healthChecker },
    ];

    // 필수 의존성 체크
    for (const { name, obj } of required) {
      if (!obj) {
        throw new Error(`필수 의존성 누락: ${name}`);
      }
    }

    // 선택적 의존성 체크 (경고만)
    for (const { name, obj } of optional) {
      if (!obj) {
        logger.warn(
          `⚠️ 선택적 의존성 누락: ${name} - 관련 기능이 제한될 수 있습니다.`
        );
      }
    }

    logger.debug("✅ 의존성 검증 완료");
  }

  /**
   * 🎮 Telegraf 핸들러 설정
   */
  setupHandlers() {
    // 명령어 처리
    this.bot.command("start", (ctx) => this.handleCommand(ctx, "start"));
    this.bot.command("help", (ctx) => this.handleCommand(ctx, "help"));
    this.bot.command("status", (ctx) => this.handleCommand(ctx, "status"));
    this.bot.command("cancel", (ctx) => this.handleCommand(ctx, "cancel"));

    // 텍스트 메시지 처리
    this.bot.on("text", (ctx) => this.handleMessage(ctx));

    // 🎯 콜백 쿼리 처리 (핵심 수정!)
    this.bot.on("callback_query", (ctx) => this.handleCallback(ctx));

    // 인라인 쿼리 처리
    this.bot.on("inline_query", (ctx) => this.handleInlineQuery(ctx));

    // 기타 메시지 타입
    this.bot.on("photo", (ctx) => this.handleMedia(ctx, "photo"));
    this.bot.on("document", (ctx) => this.handleMedia(ctx, "document"));
    this.bot.on("voice", (ctx) => this.handleMedia(ctx, "voice"));
    this.bot.on("audio", (ctx) => this.handleMedia(ctx, "audio"));

    logger.debug("🎮 Telegraf 핸들러 설정 완료");
  }

  /**
   * ⚡ 콜백 처리 (핵심 수정: NavigationHandler로 위임)
   */
  async handleCallback(ctx) {
    const startTime = Date.now();
    const userId = ctx.from?.id;
    const callbackId = ctx.callbackQuery?.id;
    const uniqueKey = `${userId}-${callbackId}`;

    try {
      // 중복 처리 방지
      if (this.processingCallbacks.has(uniqueKey)) {
        logger.debug(`🚫 중복 콜백 무시: ${uniqueKey}`);

        // 이미 처리 중이라는 알림
        try {
          await ctx.answerCbQuery("⏳ 처리 중입니다...", {
            show_alert: true,
          });
        } catch (answerError) {
          logger.debug("중복 콜백 답변 실패:", answerError.message);
        }
        return;
      }

      // 처리 시작
      this.processingCallbacks.set(uniqueKey, Date.now());
      this.stats.activeCallbacks++;
      this.stats.callbacksReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `⚡ 콜백 처리 시작: ${getUserName(ctx.from)} -> ${
          ctx.callbackQuery.data
        }`
      );

      // 콜백 응답 (사용자 대기 상태 해제)
      await ctx.answerCbQuery();

      // 🎹 NavigationHandler로 위임 (핵심!)
      if (this.navigationHandler) {
        const handled = await this.navigationHandler.handleNavigation(
          this.bot,
          ctx.callbackQuery,
          null, // subAction은 NavigationHandler에서 파싱
          [], // params도 NavigationHandler에서 파싱
          this.moduleManager
        );

        if (!handled) {
          logger.warn("❓ 처리되지 않은 콜백:", ctx.callbackQuery.data);

          // 처리되지 않은 콜백에 대한 사용자 알림
          try {
            await ctx.editMessageText(
              "⚠️ 요청을 처리할 수 없습니다.\n메인 메뉴로 돌아가세요.",
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
                  ],
                },
              }
            );
          } catch (editError) {
            logger.debug(
              "처리되지 않은 콜백 메시지 편집 실패:",
              editError.message
            );
          }
        }
      } else {
        logger.error("❌ NavigationHandler가 없어 콜백 처리 불가");

        try {
          await ctx.editMessageText(
            "❌ 시스템 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 새로고침", callback_data: "system:start" }],
                ],
              },
            }
          );
        } catch (editError) {
          logger.debug("시스템 오류 메시지 편집 실패:", editError.message);
        }
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      try {
        await ctx.answerCbQuery("❌ 처리 중 오류가 발생했습니다.", {
          show_alert: true,
        });
      } catch (answerError) {
        logger.error("콜백 에러 답변 실패:", answerError);
      }
    } finally {
      // 처리 완료 정리
      this.processingCallbacks.delete(uniqueKey);
      this.stats.activeCallbacks = Math.max(0, this.stats.activeCallbacks - 1);

      // 응답 시간 통계 업데이트
      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);

      logger.debug(`⚡ 콜백 처리 완료: ${uniqueKey} (${duration}ms)`);
    }
  }

  /**
   * 💬 메시지 처리 (기존 로직 유지)
   */
  async handleMessage(ctx) {
    const startTime = Date.now();
    const userId = ctx.from?.id;
    const messageId = ctx.message?.message_id;
    const uniqueKey = `${userId}-${messageId}`;

    try {
      // 중복 처리 방지
      if (this.processingMessages.has(uniqueKey)) {
        logger.debug(`🚫 중복 메시지 무시: ${uniqueKey}`);
        return;
      }

      this.processingMessages.set(uniqueKey, Date.now());
      this.stats.activeMessages++;
      this.stats.messagesReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 사용자 통계 업데이트
      this.stats.uniqueUsers.add(userId);
      this.stats.totalUsers = this.stats.uniqueUsers.size;

      logger.debug(
        `💬 메시지 처리 시작: ${getUserName(
          ctx.from
        )} -> "${ctx.message.text?.substring(0, 30)}..."`
      );

      // ModuleManager에 위임 (기존 로직)
      if (this.moduleManager) {
        await this.moduleManager.handleMessage(this.bot, ctx.message);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 메시지 처리 불가");
      }
    } catch (error) {
      logger.error(`❌ 메시지 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      try {
        await ctx.reply(
          "❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      } catch (replyError) {
        logger.error("에러 메시지 전송 실패:", replyError);
      }
    } finally {
      // 처리 완료 정리
      this.processingMessages.delete(uniqueKey);
      this.stats.activeMessages = Math.max(0, this.stats.activeMessages - 1);

      // 응답 시간 통계 업데이트
      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);

      logger.debug(`💬 메시지 처리 완료: ${uniqueKey} (${duration}ms)`);
    }
  }

  /**
   * 🔧 명령어 처리 (기존 로직 유지)
   */
  async handleCommand(ctx, command) {
    const startTime = Date.now();
    const userId = ctx.from?.id;
    const userName = getUserName(ctx.from);

    try {
      logger.info(`⌨️ 명령어 처리: /${command} (${userName})`);

      // 시스템 명령어는 직접 처리
      switch (command) {
        case "start":
          await ctx.reply(
            `🏠 안녕하세요 ${userName}님!\n두목봇에 오신 것을 환영합니다.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📋 메인 메뉴", callback_data: "system:menu" }],
                  [{ text: "❓ 도움말", callback_data: "system:help" }],
                ],
              },
            }
          );
          break;

        case "help":
          await ctx.reply("❓ 도움말 메뉴", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "📖 사용법", callback_data: "system:help:usage" }],
                [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
              ],
            },
          });
          break;

        case "status":
          const status = this.getStatus();
          await ctx.reply(
            `📊 **시스템 상태**\n\n${this.formatStatus(status)}`,
            {
              parse_mode: "Markdown",
            }
          );
          break;

        case "cancel":
          await ctx.reply("❌ 작업이 취소되었습니다.", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
              ],
            },
          });
          break;

        default:
          // 모듈 명령어는 ModuleManager에 위임
          if (this.moduleManager) {
            await this.moduleManager.handleMessage(this.bot, ctx.message);
          }
          break;
      }
    } catch (error) {
      logger.error(`❌ 명령어 처리 실패 (/${command}):`, error);
      await ctx.reply("명령어 처리 중 오류가 발생했습니다.");
    } finally {
      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);

      logger.debug(`⌨️ 명령어 처리 완료: /${command} (${duration}ms)`);
    }
  }

  /**
   * 🖼️ 미디어 처리 (기존 로직 유지)
   */
  async handleMedia(ctx, mediaType) {
    try {
      logger.debug(`🖼️ 미디어 처리: ${mediaType}`);

      // ModuleManager에 위임
      if (this.moduleManager) {
        await this.moduleManager.handleMessage(this.bot, ctx.message);
      }
    } catch (error) {
      logger.error(`❌ 미디어 처리 실패 (${mediaType}):`, error);
    }
  }

  /**
   * 🔍 인라인 쿼리 처리 (기존 로직 유지)
   */
  async handleInlineQuery(ctx) {
    try {
      logger.debug("🔍 인라인 쿼리 처리");

      // 기본 응답
      await ctx.answerInlineQuery([
        {
          type: "article",
          id: "1",
          title: "두목봇 v3.0.1",
          description: "봇과 개인 채팅으로 이동하기",
          input_message_content: {
            message_text:
              "안녕하세요! 두목봇입니다. /start 명령어로 시작하세요.",
          },
        },
      ]);
    } catch (error) {
      logger.error("❌ 인라인 쿼리 처리 실패:", error);
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트 (기존 로직 유지)
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;

    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      // 지수 평활법으로 평균 계산
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * 🧹 정리 스케줄러 시작 (기존 로직 유지)
   */
  startCleanupScheduler() {
    setInterval(() => {
      this.cleanupProcessingMaps();
    }, 60000); // 1분마다

    logger.debug("🧹 정리 스케줄러 시작됨");
  }

  /**
   * 🧹 처리 맵 정리 (기존 로직 유지)
   */
  cleanupProcessingMaps() {
    const now = Date.now();
    const messageTimeout = this.config.messageTimeout;
    const callbackTimeout = this.config.callbackTimeout;

    // 오래된 메시지 처리 정리
    for (const [key, timestamp] of this.processingMessages.entries()) {
      if (now - timestamp > messageTimeout) {
        this.processingMessages.delete(key);
        this.stats.activeMessages = Math.max(0, this.stats.activeMessages - 1);
      }
    }

    // 오래된 콜백 처리 정리
    for (const [key, timestamp] of this.processingCallbacks.entries()) {
      if (now - timestamp > callbackTimeout) {
        this.processingCallbacks.delete(key);
        this.stats.activeCallbacks = Math.max(
          0,
          this.stats.activeCallbacks - 1
        );
      }
    }
  }

  /**
   * 📊 상태 조회 (NavigationHandler 상태 포함)
   */
  getStatus() {
    return {
      initialized: this.initialized,
      botConnected: !!this.bot,
      navigationHandlerActive: !!this.navigationHandler,
      moduleManagerActive: !!this.moduleManager,
      stats: {
        ...this.stats,
        totalUsers: this.stats.uniqueUsers.size,
        averageResponseTime: Math.round(this.stats.averageResponseTime),
      },
      navigationStats: this.navigationHandler
        ? this.navigationHandler.getStats()
        : null,
      performance: {
        activeMessages: this.stats.activeMessages,
        activeCallbacks: this.stats.activeCallbacks,
        processingMapsSize: {
          messages: this.processingMessages.size,
          callbacks: this.processingCallbacks.size,
        },
      },
    };
  }

  /**
   * 📊 상태 포맷팅 (기존 로직 유지)
   */
  formatStatus(status) {
    return `🎮 **BotController**: ${status.initialized ? "✅" : "❌"}
🤖 **Bot 연결**: ${status.botConnected ? "✅" : "❌"}
🎹 **NavigationHandler**: ${status.navigationHandlerActive ? "✅" : "❌"}
📦 **ModuleManager**: ${status.moduleManagerActive ? "✅" : "❌"}

📊 **통계**:
• 메시지: ${status.stats.messagesReceived}개
• 콜백: ${status.stats.callbacksReceived}개  
• 사용자: ${status.stats.totalUsers}명
• 평균응답: ${status.stats.averageResponseTime}ms
• 에러: ${status.stats.errorsCount}개

⚡ **현재 처리 중**:
• 메시지: ${status.performance.activeMessages}개
• 콜백: ${status.performance.activeCallbacks}개`;
  }

  /**
   * 🏥 Railway 헬스체크 엔드포인트 설정
   */
  setupHealthEndpoint() {
    if (!this.config.isRailway) return;

    const express = require("express");
    const app = express();

    // 헬스체크 엔드포인트
    app.get("/health", (req, res) => {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bot: {
          initialized: this.initialized,
          connected: !!this.bot,
        },
        modules: {
          total: this.moduleManager?.stats?.totalModules || 0,
          active: this.moduleManager?.stats?.activeModules || 0,
          failed: this.moduleManager?.stats?.failedModules || 0,
        },
      };

      res.status(200).json(health);
    });

    // 간단한 핑
    app.get("/ping", (req, res) => {
      res.status(200).text("pong");
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.debug(`🏥 헬스체크 서버 시작: 포트 ${port}`);
    });
  }

  /**
   * 🛑 정리 (NavigationHandler 포함)
   */
  async cleanup() {
    try {
      logger.info("🛑 BotController 정리 시작...");

      // NavigationHandler 정리
      if (this.navigationHandler) {
        await this.navigationHandler.cleanup();
        this.navigationHandler = null;
      }

      // 처리 맵 정리
      this.processingMessages.clear();
      this.processingCallbacks.clear();

      // 통계 초기화
      this.stats.uniqueUsers.clear();

      this.initialized = false;
      logger.info("✅ BotController 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
    }
  }
}

module.exports = BotController;
