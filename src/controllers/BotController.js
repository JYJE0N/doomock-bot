// src/controllers/BotController.js - 리팩토링된 봇 컨트롤러
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
      logger.info(
        `📨 메시지 수신: ${msg.text || "[비텍스트]"} from @${msg.from?.username || msg.from?.id}`
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
   * 콜백 쿼리 처리
   */
  async handleCallbackQuery(callbackQuery) {
    const callbackKey = callbackQuery.id;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackKey);
      return;
    }

    this.processingCallbacks.add(callbackKey);
    this.stats.callbacksReceived++;

    try {
      // 콜백 로깅
      logger.info(
        `🔘 콜백 수신: ${callbackQuery.data} from @${callbackQuery.from?.username || callbackQuery.from?.id}`
      );

      // 즉시 응답 (타임아웃 방지)
      await this.bot.answerCallbackQuery(callbackQuery.id).catch((e) => {
        logger.warn("콜백 응답 실패:", e.message);
      });

      // 콜백 데이터 유효성 검사
      if (!callbackQuery.data) {
        logger.warn("콜백 데이터 없음");
        return;
      }

      // 모듈 매니저로 전달
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleCallback(callbackQuery);
      }

      // 처리되지 않은 콜백
      if (!handled) {
        await this.handleUnknownCallback(callbackQuery);
      }
    } catch (error) {
      logger.error("콜백 처리 오류:", error);
      this.stats.errorsCount++;

      if (callbackQuery.message) {
        await this.sendErrorCallback(callbackQuery);
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
      // 현재는 인라인 쿼리 미지원
      await this.bot.answerInlineQuery(query.id, [], {
        cache_time: 0,
        is_personal: true,
        switch_pm_text: "봇으로 이동",
        switch_pm_parameter: "start",
      });
    } catch (error) {
      logger.error("인라인 쿼리 처리 오류:", error);
    }
  }

  /**
   * 메시지 유효성 검사
   */
  isValidMessage(msg) {
    // 기본 검증
    if (!msg || !msg.chat || !msg.from) {
      return false;
    }

    // 봇 자신의 메시지 무시
    if (msg.from.is_bot && msg.from.username === this.bot.options.username) {
      return false;
    }

    return true;
  }

  /**
   * 메시지 처리 여부 확인
   */
  shouldProcessMessage(msg) {
    // 개인 채팅은 항상 처리
    if (msg.chat.type === "private") {
      return true;
    }

    // 그룹에서는 봇 멘션 또는 명령어만 처리
    if (msg.text) {
      // 봇 멘션 확인
      const botUsername = this.bot.options.username;
      if (botUsername && msg.text.includes(`@${botUsername}`)) {
        return true;
      }

      // 명령어 확인
      if (msg.text.startsWith("/")) {
        return true;
      }
    }

    return false;
  }

  /**
   * 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(msg) {
    const command = msg.text.split(" ")[0];

    const response = `❓ **알 수 없는 명령어**

"${command}" 명령어를 찾을 수 없습니다.

사용 가능한 명령어:
• /start - 봇 시작
• /help - 도움말
• /todo - 할일 관리
• /timer - 타이머
• /weather - 날씨 정보

도움이 필요하시면 /help를 입력하세요.`;

    await this.bot.sendMessage(msg.chat.id, response, {
      parse_mode: "Markdown",
      reply_to_message_id: msg.message_id,
    });
  }

  /**
   * 알 수 없는 콜백 처리
   */
  async handleUnknownCallback(callbackQuery) {
    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "⚠️ 이 버튼은 더 이상 유효하지 않습니다.",
        show_alert: true,
      });

      // 오래된 메시지 업데이트
      if (callbackQuery.message) {
        const timeDiff = Date.now() - callbackQuery.message.date * 1000;
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));

        if (hours > 24) {
          await this.bot
            .editMessageText(
              "⏰ 이 메시지는 만료되었습니다.\n새로운 명령을 시작해주세요.",
              {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
                  ],
                },
              }
            )
            .catch((e) => {
              logger.debug("만료 메시지 수정 실패:", e.message);
            });
        }
      }
    } catch (error) {
      logger.error("알 수 없는 콜백 처리 오류:", error);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(chatId, error) {
    try {
      const errorMessage = `❌ **오류 발생**

처리 중 문제가 발생했습니다.
잠시 후 다시 시도해주세요.

오류가 계속되면 관리자에게 문의하세요.`;

      await this.bot.sendMessage(chatId, errorMessage, {
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
   * 콜백 에러 처리
   */
  async sendErrorCallback(callbackQuery) {
    try {
      await this.bot.editMessageText("❌ 처리 중 오류가 발생했습니다.", {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
          ],
        },
      });
    } catch (error) {
      logger.error("콜백 에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000), // 초 단위
      messagesPerMinute: this.stats.messagesReceived / (uptime / 60000),
      errorRate:
        this.stats.errorsCount /
          (this.stats.messagesReceived + this.stats.callbacksReceived) || 0,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.info("🧹 BotController 정리 시작...");

    // 처리 중인 작업 대기
    const waitTime = Math.max(
      this.config.messageTimeout,
      this.config.callbackTimeout
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 큐 정리
    this.processingMessages.clear();
    this.processingCallbacks.clear();

    logger.info("✅ BotController 정리 완료");
  }
}

module.exports = BotController;
