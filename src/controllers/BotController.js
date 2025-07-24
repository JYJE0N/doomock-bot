// src/controllers/BotController.js - BotCommandsRegistry 통합된 봇 컨트롤러

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

// ⭐ BotCommandsRegistry 참조 추가
const botCommandsRegistry = require("../config/BotCommandsRegistry");

/**
 * 봇 컨트롤러
 * - 텔레그램 이벤트 수신 및 라우팅
 * - 중복 처리 방지
 * - 에러 처리 및 사용자 피드백
 * - BotFather 명령어 관리
 */
class BotController {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.dbManager = options.dbManager || null;
    this.moduleManager = options.moduleManager || null;

    // ⭐ BotCommandsRegistry 인스턴스 참조
    this.commandsRegistry = options.commandsRegistry || botCommandsRegistry;

    // 중복 처리 방지를 위한 Set
    this.processingMessages = new Set();
    this.processingCallbacks = new Set();

    // 통계
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
      commandsExecuted: 0,
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

      // ⭐ BotFather 명령어 등록 (선택적)
      if (this.config.autoRegisterCommands !== false) {
        await this.registerBotCommands();
      }

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 BotFather 명령어 등록
   */
  async registerBotCommands() {
    try {
      logger.info("📋 BotFather 명령어 등록 중...");

      const success = await this.commandsRegistry.setBotFatherCommands(
        this.bot
      );

      if (success) {
        const stats = this.commandsRegistry.getCommandStats();
        logger.success(
          `✅ BotFather 명령어 등록 완료 (${stats.publicCommands}개)`
        );
      } else {
        logger.warn("⚠️ BotFather 명령어 등록 실패");
      }

      return success;
    } catch (error) {
      logger.error("❌ BotFather 명령어 등록 중 오류:", error);
      return false;
    }
  }

  /**
   * 봇 이벤트 핸들러 설정
   */
  setupBotHandlers() {
    // 메시지 핸들러
    this.bot.on("message", async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        logger.error("메시지 처리 오류:", error);
        this.stats.errorsCount++;
      }
    });

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        await this.handleCallbackQuery(callbackQuery);
      } catch (error) {
        logger.error("콜백 처리 오류:", error);
        this.stats.errorsCount++;
      }
    });

    // 인라인 쿼리 핸들러 (선택적)
    this.bot.on("inline_query", async (query) => {
      try {
        await this.handleInlineQuery(query);
      } catch (error) {
        logger.error("인라인 쿼리 처리 오류:", error);
      }
    });

    logger.info("🎯 봇 이벤트 핸들러 설정 완료");
  }

  /**
   * 에러 핸들러 설정
   */
  setupErrorHandlers() {
    // 폴링 에러
    this.bot.on("polling_error", (error) => {
      logger.error("폴링 에러:", error);
      this.stats.errorsCount++;
    });

    // 웹훅 에러
    this.bot.on("webhook_error", (error) => {
      logger.error("웹훅 에러:", error);
      this.stats.errorsCount++;
    });

    logger.info("🛡️ 에러 핸들러 설정 완료");
  }

  /**
   * 메시지 처리
   */
  async handleMessage(msg) {
    if (!msg || !msg.from) return;

    const messageKey = `${msg.from.id}-${msg.message_id}`;

    // 중복 처리 방지
    if (this.processingMessages.has(messageKey)) {
      logger.debug("중복 메시지 무시:", messageKey);
      return;
    }

    this.processingMessages.add(messageKey);
    this.stats.messagesReceived++;

    try {
      const {
        chat: { id: chatId },
        from: { id: userId },
        text,
      } = msg;

      const userName = getUserName(msg.from);
      logger.info(`💬 메시지 수신: "${text}" (${userName})`);

      // ⭐ 명령어 검증 및 처리
      if (text && text.startsWith("/")) {
        const commandName = text.split(" ")[0].substring(1);
        const isValidCommand = await this.validateAndExecuteCommand(
          msg,
          commandName
        );

        if (isValidCommand) {
          this.stats.commandsExecuted++;
          return;
        }
      }

      // 모듈 메시지 처리
      if (this.moduleManager) {
        const handled = await this.moduleManager.handleMessage?.(this.bot, msg);
        if (handled) return;
      }

      // 일반 메시지 처리 (TTS 등)
      await this.handleGeneralMessage(msg);
    } catch (error) {
      logger.error("메시지 처리 실패:", error);
      await this.sendErrorMessage(msg.chat?.id, error);
    } finally {
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, this.config.messageTimeout);
    }
  }

  /**
   * ⭐ 명령어 검증 및 실행
   */
  async validateAndExecuteCommand(msg, commandName) {
    try {
      const {
        chat: { id: chatId },
        from: { id: userId },
      } = msg;

      // 명령어 찾기
      const commandConfig = this.commandsRegistry.findCommand(commandName);

      if (!commandConfig) {
        // 알 수 없는 명령어
        await this.bot.sendMessage(
          chatId,
          `❓ '/${commandName}' 는 알 수 없는 명령어입니다.\n💡 /help 를 입력하여 사용 가능한 명령어를 확인하세요.`
        );
        return true; // 처리됨으로 표시
      }

      // 권한 확인 (관리자 명령어)
      if (commandConfig.category === "admin") {
        const isAdmin = await this.checkAdminPermission(userId);
        if (!isAdmin) {
          await this.bot.sendMessage(chatId, "❌ 관리자 권한이 필요합니다.");
          return true;
        }
      }

      // 명령어 실행
      logger.info(
        `🎯 명령어 실행: /${commandName} (${commandConfig.module || "system"})`
      );

      if (commandConfig.module) {
        // 모듈 명령어
        const handled = await this.moduleManager?.handleCommand?.(
          this.bot,
          msg,
          commandName
        );
        return handled || false;
      } else {
        // 시스템 명령어
        return await this.executeSystemCommand(msg, commandName, commandConfig);
      }
    } catch (error) {
      logger.error(`명령어 처리 실패 [${commandName}]:`, error);
      await this.sendErrorMessage(msg.chat?.id, error);
      return true; // 에러도 처리됨으로 표시
    }
  }

  /**
   * 시스템 명령어 실행
   */
  async executeSystemCommand(msg, commandName, commandConfig) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    switch (commandName) {
      case "start":
        await this.handleStartCommand(msg);
        return true;

      case "help":
        await this.handleHelpCommand(msg);
        return true;

      case "status":
        await this.handleStatusCommand(msg);
        return true;

      case "cancel":
        await this.handleCancelCommand(msg);
        return true;

      default:
        logger.warn(`처리되지 않은 시스템 명령어: ${commandName}`);
        return false;
    }
  }

  /**
   * /start 명령어 처리
   */
  async handleStartCommand(msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    const welcomeText = `안녕하세요 ${userName}님! 👋

🤖 **두목봇 v3.0.1**에 오신 것을 환영합니다.

아래 메뉴에서 원하는 기능을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏖️ 휴가 관리", callback_data: "leave:menu" }],
        [{ text: "📝 할일 관리", callback_data: "todo:menu" }],
        [{ text: "⏰ 타이머", callback_data: "timer:menu" }],
        [{ text: "❓ 도움말", callback_data: "system:help" }],
      ],
    };

    await this.bot.sendMessage(chatId, welcomeText, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  /**
   * /help 명령어 처리
   */
  async handleHelpCommand(msg) {
    const {
      chat: { id: chatId },
    } = msg;

    // ⭐ BotCommandsRegistry를 활용한 도움말 생성
    const stats = this.commandsRegistry.getCommandStats();

    const helpText = `📖 **두목봇 도움말**

**🎯 사용 가능한 명령어**: ${stats.publicCommands}개

**🏛️ 시스템 명령어**
• /start - 봇 시작 및 메인 메뉴
• /help - 도움말 보기
• /status - 봇 상태 확인
• /cancel - 현재 작업 취소

**📦 모듈 명령어**
• /leave - 휴가 관리 (연차/월차/반차/반반차)
• /todo - 할일 관리
• /timer - 타이머 및 뽀모도로
• /weather - 날씨 정보
• /fortune - 오늘의 운세

**💡 팁**
각 모듈을 선택한 후 도움말 버튼을 누르거나
\`/help [모듈이름]\` 명령어를 사용하세요.

**🆘 문의**
문제가 있으시면 관리자에게 연락주세요.`;

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  }

  /**
   * /status 명령어 처리
   */
  async handleStatusCommand(msg) {
    const {
      chat: { id: chatId },
    } = msg;

    const uptime = process.uptime();
    const stats = this.commandsRegistry.getCommandStats();

    const statusText = `📊 **봇 상태**

**⏱️ 운영 정보**
• 가동 시간: ${this.formatUptime(uptime)}
• 시작 시간: ${TimeHelper.formatDateTime(new Date(this.stats.startTime))}

**📈 사용 통계**
• 메시지 처리: ${this.stats.messagesReceived}개
• 콜백 처리: ${this.stats.callbacksReceived}개  
• 명령어 실행: ${this.stats.commandsExecuted}개
• 오류 발생: ${this.stats.errorsCount}회

**📋 명령어 현황**
• 등록된 명령어: ${stats.totalCommands}개
• 공개 명령어: ${stats.publicCommands}개
• 모듈: ${stats.moduleCommands}개

**🛡️ 시스템 상태**
• 데이터베이스: ${this.dbManager ? "연결됨" : "비연결"}
• 모듈 매니저: ${this.moduleManager ? "활성" : "비활성"}
• 환경: ${process.env.NODE_ENV || "development"}

✅ 모든 시스템이 정상 작동 중입니다.`;

    await this.bot.sendMessage(chatId, statusText, {
      parse_mode: "Markdown",
    });
  }

  /**
   * /cancel 명령어 처리
   */
  async handleCancelCommand(msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    // 모듈에 취소 알림
    if (this.moduleManager) {
      await this.moduleManager.cancelUserAction?.(userId);
    }

    await this.bot.sendMessage(chatId, "✅ 현재 작업이 취소되었습니다.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      },
    });
  }

  /**
   * 콜백 쿼리 처리
   */
  async handleCallbackQuery(callbackQuery) {
    if (!callbackQuery || !callbackQuery.from) return;

    const callbackKey = `${callbackQuery.from.id}-${callbackQuery.id}`;

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("중복 콜백 무시:", callbackKey);
      return;
    }

    this.processingCallbacks.add(callbackKey);
    this.stats.callbacksReceived++;

    try {
      const userName = getUserName(callbackQuery.from);
      logger.info(`🔘 콜백 수신: "${callbackQuery.data}" (${userName})`);

      // 콜백 응답 (로딩 표시 제거)
      await this.bot.answerCallbackQuery(callbackQuery.id);

      // 모듈 콜백 처리
      if (this.moduleManager) {
        const handled = await this.moduleManager.handleCallback?.(
          this.bot,
          callbackQuery
        );
        if (handled) return;
      }

      // 시스템 콜백 처리
      await this.handleSystemCallback(callbackQuery);
    } catch (error) {
      logger.error("콜백 처리 실패:", error);
      await this.sendErrorCallback(callbackQuery);
    } finally {
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, this.config.callbackTimeout);
    }
  }

  /**
   * 시스템 콜백 처리
   */
  async handleSystemCallback(callbackQuery) {
    const { data } = callbackQuery;

    if (data === "system:start") {
      // /start와 동일한 메뉴 표시
      await this.handleStartCommand({
        chat: callbackQuery.message.chat,
        from: callbackQuery.from,
      });
    } else if (data === "system:help") {
      // /help와 동일한 도움말 표시
      await this.handleHelpCommand({
        chat: callbackQuery.message.chat,
        from: callbackQuery.from,
      });
    } else {
      logger.warn(`처리되지 않은 시스템 콜백: ${data}`);
    }
  }

  /**
   * 일반 메시지 처리 (TTS 등)
   */
  async handleGeneralMessage(msg) {
    // TTS나 기타 자동 기능 처리
    // 구현은 필요에 따라 추가
  }

  /**
   * 인라인 쿼리 처리
   */
  async handleInlineQuery(query) {
    // 인라인 쿼리 처리 로직
    await this.bot.answerInlineQuery(query.id, []);
  }

  /**
   * 관리자 권한 확인
   */
  async checkAdminPermission(userId) {
    const adminIds = process.env.ADMIN_IDS?.split(",") || [];
    return adminIds.includes(userId.toString());
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
            [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
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
            [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
          ],
        },
      });
    } catch (error) {
      logger.error("콜백 에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 가동 시간 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const commandStats = this.commandsRegistry.getCommandStats();

    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000), // 초 단위
      messagesPerMinute: this.stats.messagesReceived / (uptime / 60000),
      errorRate:
        this.stats.errorsCount /
          (this.stats.messagesReceived + this.stats.callbacksReceived) || 0,
      commands: commandStats,
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
