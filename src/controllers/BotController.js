// src/controllers/BotController.js - Telegraf 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎮 봇 컨트롤러 v3.0.1 - Telegraf 버전
 *
 * 🎯 핵심 변경사항:
 * - Context(ctx) 기반 처리
 * - bot.on() → ctx 직접 사용
 * - answerCallbackQuery 자동 처리
 * - 더 간결한 API
 *
 * 📊 주요 역할:
 * - Telegraf 이벤트 처리
 * - ModuleManager 연동
 * - 중앙 검증 시스템 활용
 * - 통계 및 모니터링
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

    logger.info("🎮 BotController 생성됨 (Telegraf)");
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    try {
      logger.info("🎮 BotController 초기화 중...");

      // 의존성 검증
      this.validateDependencies();

      // Telegraf 핸들러 설정
      this.setupHandlers();

      // 정리 스케줄러 시작
      this.startCleanupScheduler();

      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
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

    // 콜백 쿼리 처리
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
   * 💬 메시지 처리
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

      // 텍스트가 없거나 명령어인 경우 무시
      if (!ctx.message?.text || ctx.message.text.startsWith("/")) {
        return;
      }

      // 🛡️ 사용자 입력 검증
      if (this.validationManager) {
        const validationResult = await this.validationManager.validate(
          "userInput",
          {
            text: ctx.message.text,
            userId: userId,
          }
        );

        if (!validationResult.isValid) {
          logger.warn(
            `🛡️ 사용자 입력 검증 실패 (${userId}):`,
            validationResult.errors
          );
          await this.sendValidationError(ctx, validationResult.errors);
          return;
        }
      }

      // 처리 시작
      this.processingMessages.set(uniqueKey, Date.now());
      this.stats.activeMessages++;
      this.stats.messagesReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 사용자 통계 업데이트
      if (userId) {
        this.stats.uniqueUsers.add(userId);
        this.stats.totalUsers = this.stats.uniqueUsers.size;
      }

      logger.debug(
        `💬 메시지 처리 시작: ${getUserName(ctx.from)} (${uniqueKey})`
      );

      // ModuleManager에 위임 (Telegraf 컨텍스트 전달)
      if (this.moduleManager) {
        // 호환성을 위해 기존 msg 형식으로 변환
        const msg = ctx.message;
        await this.moduleManager.handleMessage(ctx, msg);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 메시지 처리 불가");
      }
    } catch (error) {
      logger.error(`❌ 메시지 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      try {
        await ctx.reply(
          "❌ 메시지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      } catch (replyError) {
        logger.error("사용자 에러 알림 실패:", replyError);
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
   * ⚡ 콜백 처리
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
        await ctx.answerCbQuery();
        return;
      }

      // 🛡️ 콜백 데이터 검증
      if (this.validationManager && ctx.callbackQuery?.data) {
        const validationResult = await this.validationManager.validate(
          "callbackData",
          {
            data: ctx.callbackQuery.data,
            userId: userId,
          }
        );

        if (!validationResult.isValid) {
          logger.warn(
            `🛡️ 콜백 데이터 검증 실패 (${userId}):`,
            validationResult.errors
          );
          await ctx.answerCbQuery("❌ 잘못된 요청입니다.", {
            show_alert: true,
          });
          return;
        }
      }

      // 처리 시작
      this.processingCallbacks.set(uniqueKey, Date.now());
      this.stats.activeCallbacks++;
      this.stats.callbacksReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `⚡ 콜백 처리 시작: ${getUserName(ctx.from)} (${uniqueKey})`
      );

      // 콜백 응답 (사용자 대기 상태 해제)
      await ctx.answerCbQuery();

      // ModuleManager에 위임
      if (this.moduleManager) {
        // 호환성을 위해 기존 callbackQuery 형식 유지
        await this.moduleManager.handleCallback(ctx, ctx.callbackQuery);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 콜백 처리 불가");
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
   * 🔧 명령어 처리
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
          // 기타 명령어는 ModuleManager로 위임
          if (this.moduleManager) {
            await this.moduleManager.handleMessage(ctx, ctx.message);
          }
      }
    } catch (error) {
      logger.error(`❌ 명령어 처리 실패 (/${command}):`, error);
      await ctx.reply("❌ 명령어 처리 중 오류가 발생했습니다.");
    } finally {
      const duration = Date.now() - startTime;
      logger.debug(`⌨️ 명령어 처리 완료: /${command} (${duration}ms)`);
    }
  }

  /**
   * 🖼️ 미디어 처리
   */
  async handleMedia(ctx, type) {
    try {
      logger.debug(`📎 ${type} 메시지 수신: ${getUserName(ctx.from)}`);

      // 필요시 ModuleManager로 위임
      if (this.moduleManager) {
        await this.moduleManager.handleMessage(ctx, ctx.message);
      } else {
        await ctx.reply(`📎 ${type} 파일을 받았습니다.`);
      }
    } catch (error) {
      logger.error(`❌ ${type} 처리 실패:`, error);
    }
  }

  /**
   * 🔍 인라인 쿼리 처리
   */
  async handleInlineQuery(ctx) {
    try {
      logger.debug(`🔍 인라인 쿼리: ${getUserName(ctx.from)}`);

      // 빈 결과 반환 (필요시 확장)
      await ctx.answerInlineQuery([]);
    } catch (error) {
      logger.error("❌ 인라인 쿼리 처리 실패:", error);
      this.stats.errorsCount++;
    }
  }

  /**
   * 🛡️ 검증 오류 메시지
   */
  async sendValidationError(ctx, errors) {
    try {
      let errorMessage = "❌ **입력 오류**\n\n";

      if (typeof errors === "object" && errors !== null) {
        for (const [field, fieldErrors] of Object.entries(errors)) {
          if (Array.isArray(fieldErrors)) {
            errorMessage += `• ${fieldErrors.join("\n• ")}\n`;
          }
        }
      } else if (Array.isArray(errors)) {
        errorMessage += `• ${errors.join("\n• ")}`;
      } else {
        errorMessage += `• ${errors}`;
      }

      errorMessage += "\n\n올바른 형식으로 다시 입력해주세요.";

      await ctx.reply(errorMessage, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error("검증 오류 메시지 전송 실패:", error);
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(duration) {
    this.stats.totalResponseTime += duration;

    const totalRequests =
      this.stats.messagesReceived + this.stats.callbacksReceived;
    this.stats.averageResponseTime =
      totalRequests > 0
        ? Math.round(this.stats.totalResponseTime / totalRequests)
        : 0;
  }

  /**
   * 🧹 정리 스케줄러
   */
  startCleanupScheduler() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30분

      // 오래된 처리 기록 정리
      for (const [key, timestamp] of this.processingMessages) {
        if (now - timestamp > timeout) {
          this.processingMessages.delete(key);
        }
      }

      for (const [key, timestamp] of this.processingCallbacks) {
        if (now - timestamp > timeout) {
          this.processingCallbacks.delete(key);
        }
      }

      logger.debug(
        `🧹 정리 완료 - 메시지: ${this.processingMessages.size}, 콜백: ${this.processingCallbacks.size}`
      );
    }, 5 * 60 * 1000); // 5분마다
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      stats: this.stats,
      activeProcessing: {
        messages: this.processingMessages.size,
        callbacks: this.processingCallbacks.size,
      },
      config: {
        rateLimitEnabled: this.config.rateLimitEnabled,
        maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  /**
   * 📊 상태 포맷팅
   */
  formatStatus(status) {
    const uptimeHours = Math.floor(status.uptime / 3600);
    const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);
    const memoryUsed = Math.round(status.memory.heapUsed / 1024 / 1024);

    return `
📈 통계:
• 메시지: ${status.stats.messagesReceived}
• 콜백: ${status.stats.callbacksReceived}
• 오류: ${status.stats.errorsCount}
• 사용자: ${status.stats.totalUsers}명
• 평균 응답: ${status.stats.averageResponseTime}ms

⏱️ 가동 시간: ${uptimeHours}시간 ${uptimeMinutes}분
💾 메모리: ${memoryUsed}MB
🔄 처리 중: 메시지 ${status.activeProcessing.messages}, 콜백 ${status.activeProcessing.callbacks}
    `.trim();
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 BotController 정리 시작...");

      // 처리 중인 작업 정리
      this.processingMessages.clear();
      this.processingCallbacks.clear();

      // 통계 초기화
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

      logger.info("✅ BotController 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
    }
  }
}

module.exports = BotController;
