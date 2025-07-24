// src/controllers/BotController.js - 콜백 처리 로직 수정

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 봇 컨트롤러
 * - 텔레그램 이벤트 수신 및 라우팅
 * - 중복 처리 방지
 * - 에러 처리 및 사용자 피드백
 */
class BotController {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.dbManager = options.dbManager || null;
    this.moduleManager = options.moduleManager || null;
    this.commandsRegistry = options.commandsRegistry || null;

    // 중복 처리 방지를 위한 Set
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // 통계
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
      startTime: Date.now(),
    };

    // 설정
    this.config = {
      messageTimeout: 5000, // 5초
      callbackTimeout: 1000, // 1초
      maxRetries: 3,
      ...options.config,
    };

    this.isInitialized = false;
    logger.info("🎮 BotController 생성됨");
  }

  /**
   * 컨트롤러 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("BotController 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎮 BotController 초기화 시작...");

      // 봇 이벤트 핸들러 설정
      this.setupBotHandlers();

      // 에러 핸들러 설정
      this.setupErrorHandlers();

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 봇 이벤트 핸들러 설정
   */
  setupBotHandlers() {
    // 메시지 핸들러
    this.bot.on("message", async (msg) => {
      await this.handleMessage(msg);
    });

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", async (callbackQuery) => {
      await this.handleCallbackQuery(callbackQuery);
    });

    // 인라인 쿼리 핸들러 (필요시)
    this.bot.on("inline_query", async (query) => {
      await this.handleInlineQuery(query);
    });

    logger.debug("📡 봇 이벤트 핸들러 설정 완료");
  }

  /**
   * 에러 핸들러 설정
   */
  setupErrorHandlers() {
    // 폴링 에러
    this.bot.on("polling_error", (error) => {
      logger.error("❌ 폴링 에러:", error);
      this.stats.errorsCount++;
    });

    // 웹훅 에러
    this.bot.on("webhook_error", (error) => {
      logger.error("❌ 웹훅 에러:", error);
      this.stats.errorsCount++;
    });
  }

  /**
   * 메시지 처리
   */
  async handleMessage(msg) {
    const messageKey = `${msg.chat.id}-${msg.message_id}`;

    // 중복 처리 방지
    if (this.processingMessages.has(messageKey)) {
      logger.debug("🔁 중복 메시지 무시:", messageKey);
      return;
    }

    this.processingMessages.add(messageKey);
    this.stats.messagesReceived++;

    try {
      // 메시지 로깅
      const userName = getUserName(msg.from);
      logger.info(
        `💬 메시지 수신: "${msg.text || "[비텍스트]"}" (${userName})`
      );

      // 메시지 유효성 검사
      if (!this.isValidMessage(msg)) {
        return;
      }

      // 봇 멘션 또는 개인 채팅인 경우만 처리
      if (!this.shouldProcessMessage(msg)) {
        return;
      }

      // 모듈 매니저로 전달
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleMessage(this.bot, msg);
      }

      // 처리되지 않은 명령어
      if (!handled && msg.text?.startsWith("/")) {
        await this.handleUnknownCommand(msg);
      }
    } catch (error) {
      logger.error("메시지 처리 오류:", error);
      this.stats.errorsCount++;
      await this.sendErrorMessage(msg.chat.id, error);
    } finally {
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, this.config.messageTimeout);
    }
  }

  /**
   * 콜백 쿼리 처리 (✅ 수정된 버전)
   */
  async handleCallbackQuery(callbackQuery) {
    // ✅ 콜백 데이터 유효성 검사를 가장 먼저 수행
    if (!callbackQuery) {
      logger.error("❌ callbackQuery가 null 또는 undefined입니다");
      return;
    }

    if (!callbackQuery.data) {
      logger.error("❌ callbackQuery.data가 없습니다");
      // ✅ 빈 콜백이라도 응답해주기
      if (callbackQuery.id) {
        try {
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "⚠️ 잘못된 요청입니다.",
            show_alert: false,
          });
        } catch (error) {
          logger.error("빈 콜백 응답 실패:", error);
        }
      }
      return;
    }

    if (!callbackQuery.id) {
      logger.error("❌ callbackQuery.id가 없습니다");
      return;
    }

    const callbackKey = callbackQuery.id;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackKey);
      // ✅ 중복 콜백도 응답해주기
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "⏳ 처리 중입니다...",
          show_alert: false,
        });
      } catch (error) {
        logger.error("중복 콜백 응답 실패:", error);
      }
      return;
    }

    this.processingCallbacks.add(callbackKey);
    this.stats.callbacksReceived++;

    try {
      // ✅ 콜백 로깅 (사용자 이름 포함)
      const userName = getUserName(callbackQuery.from);
      logger.info(`🔘 콜백 수신: "${callbackQuery.data}" (${userName})`);

      // ✅ 모듈 매니저로 전달 (콜백 응답은 ModuleManager에서 처리)
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleCallback(callbackQuery);
      }

      // 처리되지 않은 콜백
      if (!handled) {
        logger.warn(`⚠️ 처리되지 않은 시스템 콜백: ${callbackQuery.data}`);
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      logger.error("콜백 처리 중 오류:", error);
      this.stats.errorsCount++;

      // ✅ 에러 응답 (ModuleManager에서 이미 응답했을 수도 있으니 조심스럽게)
      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: false,
        });
      } catch (answerError) {
        // 이미 응답했을 수 있으니 에러 무시
        logger.debug("콜백 에러 응답 실패 (이미 응답됨):", answerError.message);
      }

      // ✅ 사용자에게 에러 메시지 표시
      if (callbackQuery.message && callbackQuery.message.chat) {
        await this.sendErrorMessage(callbackQuery.message.chat.id, error);
      }
    } finally {
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, this.config.callbackTimeout);
    }
  }

  /**
   * 인라인 쿼리 처리
   */
  async handleInlineQuery(query) {
    try {
      // 기본적인 인라인 쿼리 응답
      await this.bot.answerInlineQuery(query.id, []);
    } catch (error) {
      logger.error("인라인 쿼리 처리 오류:", error);
    }
  }

  /**
   * 메시지 유효성 검사
   */
  isValidMessage(msg) {
    return msg && msg.chat && msg.from && msg.message_id && !msg.from.is_bot;
  }

  /**
   * 메시지 처리 여부 결정
   */
  shouldProcessMessage(msg) {
    // 개인 채팅은 항상 처리
    if (msg.chat.type === "private") {
      return true;
    }

    // 그룹 채팅에서는 봇 멘션이나 명령어만 처리
    if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
      return (
        msg.text?.startsWith("/") ||
        msg.text?.includes(`@${this.bot.options.username}`) ||
        (msg.reply_to_message && msg.reply_to_message.from.is_bot)
      );
    }

    return false;
  }

  /**
   * 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(msg) {
    const command = msg.text.split(" ")[0];
    logger.info(`🎯 알 수 없는 명령어: ${command}`);

    const helpText = `❓ **알 수 없는 명령어**

\`${command}\` 명령어를 찾을 수 없습니다.

**사용 가능한 명령어:**
• \`/start\` - 시작하기
• \`/help\` - 도움말
• \`/todo\` - 할일 관리
• \`/timer\` - 타이머
• \`/fortune\` - 운세
• \`/weather\` - 날씨
• \`/leave\` - 휴가 관리

자세한 사용법은 \`/help\` 명령어를 입력해주세요.`;

    await this.bot.sendMessage(msg.chat.id, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🏠 메인 메뉴", callback_data: "main:menu" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      },
    });
  }

  /**
   * 알 수 없는 콜백 처리
   */
  async handleUnknownCallback(callbackQuery) {
    try {
      // ✅ 콜백 응답 먼저
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리할 수 없는 요청입니다.",
        show_alert: false,
      });

      // ✅ 메시지 업데이트
      if (callbackQuery.message) {
        await this.bot.editMessageText(
          "❌ **알 수 없는 요청**\n\n처리할 수 없는 요청입니다.\n메인 메뉴로 돌아가세요.",
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("알 수 없는 콜백 처리 오류:", error);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(chatId, error) {
    const errorText = `❌ **오류 발생**

처리 중 문제가 발생했습니다.
잠시 후 다시 시도해주세요.

**해결 방법:**
• 잠시 후 다시 시도해주세요
• 문제가 지속되면 /start 명령어를 사용하세요

⏰ ${TimeHelper.getCurrentTime()}`;

    try {
      await this.bot.sendMessage(chatId, errorText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
          ],
        },
      });
    } catch (sendError) {
      logger.error("에러 메시지 전송 실패:", sendError);
    }
  }

  /**
   * 상태 조회
   */
  getStatus() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      initialized: this.isInitialized,
      uptime: Math.round(uptime / 1000), // 초 단위
      stats: {
        ...this.stats,
        averageResponseTime:
          this.stats.messagesReceived > 0
            ? Math.round(uptime / this.stats.messagesReceived)
            : 0,
      },
      processing: {
        messages: this.processingMessages.size,
        callbacks: this.processingCallbacks.size,
      },
      moduleManager: this.moduleManager?.getStatus() || null,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.info("🧹 BotController 정리 시작...");

    // 처리 중인 작업 정리
    this.processingMessages.clear();
    this.processingCallbacks.clear();

    // 봇 이벤트 리스너 제거
    if (this.bot) {
      this.bot.removeAllListeners();
    }

    this.isInitialized = false;
    logger.info("✅ BotController 정리 완료");
  }
}

module.exports = BotController;
