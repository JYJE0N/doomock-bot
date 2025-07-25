// src/controllers/BotController.js - v3.0.1 완전 표준화 리팩토링

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const HealthCheck = require("../utils/HealthCheck");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎮 봇 컨트롤러 v3.0.1 - 완전 표준화
 * - BaseModule 표준 매개변수 체계 완벽 지원
 * - ModuleManager 중앙집중식 라우팅
 * - Railway 환경 완벽 최적화
 * - HealthCheck 분리로 모듈화
 * - 견고한 에러 처리 및 복구
 */
class BotController {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.dbManager = options.dbManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🚫 중복 처리 방지 시스템 (강화)
    this.processingMessages = new Map(); // userId-messageId -> timestamp
    this.processingCallbacks = new Map(); // userId-callbackId -> timestamp
    this.rateLimitMap = new Map(); // userId -> { count, resetTime }

    // ⏱️ Railway 최적화 설정
    this.config = {
      // 처리 타임아웃 (Railway 환경 고려)
      messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT) || 8000,
      callbackTimeout: parseInt(process.env.CALLBACK_TIMEOUT) || 2000,

      // 재시도 설정
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,

      // 성능 설정
      maxConcurrentRequests:
        parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 400, // MB

      // 정리 작업 설정
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 300000, // 5분
      staleTimeout: parseInt(process.env.STALE_TIMEOUT) || 600000, // 10분

      // 속도 제한
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 30,

      ...options.config,
    };

    // 📊 상세 통계 시스템
    this.stats = {
      // 기본 통계
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,

      // 성능 통계
      totalResponseTime: 0,
      averageResponseTime: 0,
      slowestResponseTime: 0,
      fastestResponseTime: Number.MAX_SAFE_INTEGER,

      // 시간 정보
      startTime: TimeHelper.getTimestamp(),
      lastActivity: null,
      uptime: 0,

      // 메모리 사용량
      peakMemoryUsage: 0,
      currentMemoryUsage: 0,

      // 처리 현황
      activeMessages: 0,
      activeCallbacks: 0,

      // 사용자 통계
      uniqueUsers: new Set(),
      totalUsers: 0,
    };

    // 🏥 헬스체크 시스템
    this.healthCheck = new HealthCheck({
      controller: this,
      dbManager: this.dbManager,
      moduleManager: this.moduleManager,
      interval: this.config.cleanupInterval,
    });

    this.isInitialized = false;
    this.isRunning = false;

    logger.info("🎮 BotController v3.0.1 생성됨");
  }

  /**
   * 🎯 컨트롤러 초기화 (표준화)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("BotController 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎮 BotController v3.0.1 초기화 시작...");

      // 1. 이벤트 핸들러 설정
      this.setupEventHandlers();

      // 2. 에러 핸들러 설정
      this.setupErrorHandlers();

      // 3. Railway 환경 최적화
      this.setupRailwayOptimizations();

      // 4. 헬스체크 시작
      await this.healthCheck.initialize();

      // 5. 정리 작업 스케줄러 시작
      this.startCleanupScheduler();

      // 6. 성능 모니터링 시작
      this.startPerformanceMonitoring();

      this.isInitialized = true;
      this.isRunning = true;

      logger.success("✅ BotController v3.0.1 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📡 이벤트 핸들러 설정 (완전 표준화)
   */
  setupEventHandlers() {
    // 메시지 핸들러 (표준 매개변수 지원)
    this.bot.on("message", async (msg) => {
      await this.handleMessage(msg);
    });

    // 콜백쿼리 핸들러 (ModuleManager 라우팅)
    this.bot.on("callback_query", async (callbackQuery) => {
      await this.handleCallbackQuery(callbackQuery);
    });

    // 인라인 쿼리 핸들러 (확장성)
    this.bot.on("inline_query", async (inlineQuery) => {
      await this.handleInlineQuery(inlineQuery);
    });

    // 편집된 메시지 핸들러
    this.bot.on("edited_message", async (msg) => {
      await this.handleEditedMessage(msg);
    });

    logger.debug("📡 이벤트 핸들러 설정 완료");
  }

  /**
   * 🚨 에러 핸들러 설정 (Railway 환경 특화)
   */
  setupErrorHandlers() {
    // 폴링 에러
    this.bot.on("polling_error", (error) => {
      logger.error("❌ 폴링 에러:", error);
      this.stats.errorsCount++;

      // Railway 환경에서는 자동 재시작 유도
      if (this.isRailwayEnvironment() && this.shouldRestart(error)) {
        logger.warn("🔄 Railway 환경에서 재시작 유도");
        setTimeout(() => process.exit(1), 2000);
      }
    });

    // 웹훅 에러
    this.bot.on("webhook_error", (error) => {
      logger.error("❌ 웹훅 에러:", error);
      this.stats.errorsCount++;
    });

    logger.debug("🚨 에러 핸들러 설정 완료");
  }

  /**
   * 🚂 Railway 환경 최적화
   */
  setupRailwayOptimizations() {
    if (!this.isRailwayEnvironment()) {
      return;
    }

    // 메모리 임계값 모니터링
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      this.stats.currentMemoryUsage = usedMB;

      if (usedMB > this.stats.peakMemoryUsage) {
        this.stats.peakMemoryUsage = usedMB;
      }

      if (usedMB > this.config.memoryThreshold) {
        logger.warn(
          `⚠️ 메모리 사용량 높음: ${usedMB}MB (임계값: ${this.config.memoryThreshold}MB)`
        );
        this.performMemoryCleanup();
      }
    }, 30000); // 30초마다

    // Railway 환경 정보 로깅
    logger.info("🚂 Railway 최적화 활성화", {
      service: process.env.RAILWAY_SERVICE_NAME,
      region: process.env.RAILWAY_REGION,
      deployment: process.env.RAILWAY_DEPLOYMENT_ID,
    });
  }

  /**
   * 🧹 정리 작업 스케줄러
   */
  startCleanupScheduler() {
    setInterval(() => {
      this.performRoutineCleanup();
    }, this.config.cleanupInterval);

    logger.debug(
      `🧹 정리 작업 스케줄러 시작 (${
        this.config.cleanupInterval / 1000
      }초 간격)`
    );
  }

  /**
   * 📊 성능 모니터링 시작
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats();
    }, 60000); // 1분마다

    logger.debug("📊 성능 모니터링 시작");
  }

  /**
   * 📬 메시지 처리 (표준 매개변수 지원)
   */
  async handleMessage(msg) {
    // 입력 검증
    if (!this.isValidMessage(msg)) {
      return;
    }

    const userId = msg.from.id;
    const messageKey = `${userId}-${msg.message_id}`;
    const timestamp = TimeHelper.getTimestamp();

    // 속도 제한 확인
    if (this.config.rateLimitEnabled && !this.checkRateLimit(userId)) {
      logger.warn(`🚫 속도 제한: 사용자 ${userId}`);
      return;
    }

    // 중복 처리 방지
    if (this.processingMessages.has(messageKey)) {
      logger.debug(`🔁 중복 메시지 무시: ${messageKey}`);
      return;
    }

    this.processingMessages.set(messageKey, timestamp);
    this.stats.messagesReceived++;
    this.stats.activeMessages++;
    this.stats.lastActivity = TimeHelper.getLogTimeString();

    // 사용자 통계 업데이트
    this.stats.uniqueUsers.add(userId);
    this.stats.totalUsers = this.stats.uniqueUsers.size;

    const startTime = Date.now();

    try {
      // 사용자 정보 로깅
      const userName = getUserName(msg.from);
      logger.info(
        `📬 메시지 수신: ${userName} -> "${
          msg.text?.substring(0, 50) || "[비텍스트]"
        }..."`
      );

      // 메시지 처리 여부 결정
      if (!this.shouldProcessMessage(msg)) {
        return;
      }

      // 🎯 ModuleManager로 라우팅 (표준 매개변수)
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleMessage(this.bot, msg);
      }

      // CommandsRegistry로 명령어 처리
      if (!handled && msg.text?.startsWith("/")) {
        handled = await this.handleCommand(msg);
      }

      // 처리되지 않은 메시지
      if (!handled) {
        await this.handleUnprocessedMessage(msg);
      }

      // 성능 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    } catch (error) {
      logger.error("❌ 메시지 처리 오류:", error);
      this.stats.errorsCount++;

      await this.sendErrorMessage(
        msg.chat.id,
        "메시지 처리 중 오류가 발생했습니다."
      );
    } finally {
      this.stats.activeMessages--;

      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, this.config.messageTimeout);
    }
  }

  /**
   * 🎯 콜백쿼리 처리 (ModuleManager 중앙 라우팅)
   */
  async handleCallbackQuery(callbackQuery) {
    // 입력 검증
    if (!this.isValidCallbackQuery(callbackQuery)) {
      return;
    }

    const userId = callbackQuery.from.id;
    const callbackKey = `${userId}-${callbackQuery.id}`;
    const timestamp = TimeHelper.getTimestamp();

    // 속도 제한 확인
    if (this.config.rateLimitEnabled && !this.checkRateLimit(userId)) {
      await this.answerCallbackQuery(
        callbackQuery.id,
        "⏳ 너무 빠른 요청입니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug(`🔁 중복 콜백 무시: ${callbackKey}`);
      await this.answerCallbackQuery(callbackQuery.id, "⏳ 처리 중입니다...");
      return;
    }

    this.processingCallbacks.set(callbackKey, timestamp);
    this.stats.callbacksReceived++;
    this.stats.activeCallbacks++;
    this.stats.lastActivity = TimeHelper.getLogTimeString();

    // 사용자 통계 업데이트
    this.stats.uniqueUsers.add(userId);
    this.stats.totalUsers = this.stats.uniqueUsers.size;

    const startTime = Date.now();

    try {
      // 콜백 로깅
      const userName = getUserName(callbackQuery.from);
      logger.info(`🎯 콜백 수신: ${userName} -> "${callbackQuery.data}"`);

      // 즉시 콜백 응답 (타임아웃 방지)
      await this.answerCallbackQuery(callbackQuery.id);

      // 🔥 ModuleManager로 중앙 라우팅 (표준 매개변수)
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleCallback(
          this.bot,
          callbackQuery,
          this.parseCallbackData(callbackQuery.data)
        );
      }

      if (!handled) {
        logger.warn(`❓ 처리되지 않은 콜백: "${callbackQuery.data}"`);
        await this.handleUnknownCallback(callbackQuery);
      }

      // 성능 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    } catch (error) {
      logger.error("❌ 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      await this.sendCallbackError(
        callbackQuery,
        "처리 중 오류가 발생했습니다."
      );
    } finally {
      this.stats.activeCallbacks--;

      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, this.config.callbackTimeout);
    }
  }

  /**
   * ⌨️ 명령어 처리 (CommandsRegistry 연동)
   */
  async handleCommand(msg) {
    if (!this.commandsRegistry) {
      return false;
    }

    try {
      const commandText = msg.text.split(" ")[0].substring(1); // Remove "/"
      const args = msg.text.split(" ").slice(1);

      // CommandsRegistry에서 명령어 처리
      const handled = await this.commandsRegistry.executeCommand(
        this.bot,
        msg,
        commandText,
        args
      );

      if (!handled) {
        await this.handleUnknownCommand(msg, commandText);
      }

      return handled;
    } catch (error) {
      logger.error("❌ 명령어 처리 오류:", error);
      return false;
    }
  }

  /**
   * 🔍 콜백 데이터 파싱 (ModuleManager 호환)
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      return {
        moduleKey: "system",
        subAction: "menu",
        params: [],
      };
    }

    const parts = data.split(":");
    return {
      moduleKey: parts[0] || "system",
      subAction: parts[1] || "menu",
      params: parts.slice(2) || [],
    };
  }

  /**
   * 🚫 속도 제한 확인
   */
  checkRateLimit(userId) {
    if (!this.config.rateLimitEnabled) {
      return true;
    }

    const now = Date.now();
    const resetTime = 60000; // 1분
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // 새로운 시간 창 시작
      this.rateLimitMap.set(userId, {
        count: 1,
        resetTime: now + resetTime,
      });
      return true;
    }

    if (userLimit.count >= this.config.maxRequestsPerMinute) {
      return false; // 제한 초과
    }

    userLimit.count++;
    return true;
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = Math.round(
      this.stats.totalResponseTime /
        (this.stats.messagesReceived + this.stats.callbacksReceived)
    );

    if (responseTime > this.stats.slowestResponseTime) {
      this.stats.slowestResponseTime = responseTime;
    }

    if (responseTime < this.stats.fastestResponseTime) {
      this.stats.fastestResponseTime = responseTime;
    }

    // 느린 응답 경고
    if (responseTime > 5000) {
      logger.warn(`⚠️ 느린 응답: ${responseTime}ms`);
    }
  }

  /**
   * 🧹 정기 정리 작업
   */
  performRoutineCleanup() {
    const now = Date.now();
    let cleanedMessages = 0;
    let cleanedCallbacks = 0;
    let cleanedRateLimits = 0;

    // 오래된 메시지 처리 정리
    for (const [key, timestamp] of this.processingMessages.entries()) {
      if (now - timestamp > this.config.staleTimeout) {
        this.processingMessages.delete(key);
        cleanedMessages++;
      }
    }

    // 오래된 콜백 처리 정리
    for (const [key, timestamp] of this.processingCallbacks.entries()) {
      if (now - timestamp > this.config.staleTimeout) {
        this.processingCallbacks.delete(key);
        cleanedCallbacks++;
      }
    }

    // 오래된 속도 제한 정리
    for (const [userId, data] of this.rateLimitMap.entries()) {
      if (now > data.resetTime) {
        this.rateLimitMap.delete(userId);
        cleanedRateLimits++;
      }
    }

    if (cleanedMessages > 0 || cleanedCallbacks > 0 || cleanedRateLimits > 0) {
      logger.debug(
        `🧹 정리 완료: 메시지 ${cleanedMessages}, 콜백 ${cleanedCallbacks}, 속도제한 ${cleanedRateLimits}`
      );
    }
  }

  /**
   * 🔄 메모리 정리 작업
   */
  performMemoryCleanup() {
    logger.warn("🔄 메모리 정리 작업 시작...");

    // 강제 정리
    this.processingMessages.clear();
    this.processingCallbacks.clear();

    // 오래된 사용자 통계 정리 (크기 제한)
    if (this.stats.uniqueUsers.size > 10000) {
      this.stats.uniqueUsers.clear();
      this.stats.totalUsers = 0;
    }

    // 가비지 컬렉션 요청
    if (global.gc) {
      global.gc();
    }

    logger.warn("✅ 메모리 정리 완료");
  }

  /**
   * 📊 성능 통계 업데이트
   */
  updatePerformanceStats() {
    this.stats.uptime = Math.round(process.uptime());

    const memUsage = process.memoryUsage();
    this.stats.currentMemoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (this.stats.currentMemoryUsage > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = this.stats.currentMemoryUsage;
    }
  }

  /**
   * 🛑 재시작 필요 여부 판단
   */
  shouldRestart(error) {
    const restartCodes = ["EFATAL", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];

    return restartCodes.some(
      (code) => error.code === code || error.message?.includes(code)
    );
  }

  /**
   * 🌍 Railway 환경 확인
   */
  isRailwayEnvironment() {
    return !!process.env.RAILWAY_ENVIRONMENT;
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 메시지 유효성 검사
   */
  isValidMessage(msg) {
    return msg && msg.chat && msg.from && msg.message_id;
  }

  /**
   * 콜백쿼리 유효성 검사
   */
  isValidCallbackQuery(callbackQuery) {
    if (!callbackQuery || !callbackQuery.id) {
      return false;
    }

    if (!callbackQuery.data) {
      // 빈 콜백도 응답은 해주기
      this.answerCallbackQuery(callbackQuery.id, "⚠️ 잘못된 요청입니다.");
      return false;
    }

    return true;
  }

  /**
   * 메시지 처리 여부 결정
   */
  shouldProcessMessage(msg) {
    // 개인 채팅은 항상 처리
    if (msg.chat.type === "private") {
      return true;
    }

    // 그룹에서는 봇 멘션이나 명령어만 처리
    return (
      msg.text &&
      (msg.text.startsWith("/") ||
        msg.text.includes(`@${this.bot.options.username}`))
    );
  }

  /**
   * 콜백 응답
   */
  async answerCallbackQuery(callbackQueryId, text = "✅") {
    try {
      await this.bot.answerCallbackQuery(callbackQueryId, {
        text: text,
        show_alert: false,
      });
    } catch (error) {
      logger.debug("콜백 응답 실패 (무시):", error.message);
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendErrorMessage(chatId, message) {
    try {
      await this.bot.sendMessage(chatId, `❌ ${message}`, {
        parse_mode: "HTML",
      });
    } catch (error) {
      logger.error("❌ 에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 콜백 에러 처리
   */
  async sendCallbackError(callbackQuery, message) {
    try {
      if (callbackQuery.message) {
        await this.bot.editMessageText(`⚠️ ${message}`, {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
            ],
          },
        });
      }
    } catch (error) {
      logger.error("❌ 콜백 에러 메시지 전송 실패:", error);
    }
  }

  /**
   * 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(msg, command) {
    const availableCommands =
      this.commandsRegistry?.getAvailableCommands() || [];

    let response = `❓ 알 수 없는 명령어: /${command}\n\n`;

    if (availableCommands.length > 0) {
      response += "**사용 가능한 명령어:**\n";
      availableCommands.slice(0, 5).forEach((cmd) => {
        response += `• /${cmd.command} - ${cmd.description}\n`;
      });
      response += "\n/help 명령어로 전체 목록을 확인하세요.";
    } else {
      response += "/help 명령어로 사용 가능한 기능을 확인하세요.";
    }

    await this.bot.sendMessage(msg.chat.id, response, {
      reply_to_message_id: msg.message_id,
      parse_mode: "Markdown",
    });
  }

  /**
   * 알 수 없는 콜백 처리
   */
  async handleUnknownCallback(callbackQuery) {
    if (callbackQuery.message) {
      await this.bot.editMessageText(
        "⚠️ **알 수 없는 요청**\n\n요청하신 기능을 찾을 수 없습니다.",
        {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
            ],
          },
        }
      );
    }
  }

  /**
   * 처리되지 않은 메시지 처리
   */
  async handleUnprocessedMessage(msg) {
    // 개인 채팅에서만 안내 메시지 전송
    if (msg.chat.type === "private" && msg.text && !msg.text.startsWith("/")) {
      await this.bot.sendMessage(
        msg.chat.id,
        "안녕하세요! 🤖\n\n/help 명령어로 사용 가능한 기능을 확인해보세요.",
        { reply_to_message_id: msg.message_id }
      );
    }
  }

  /**
   * 인라인 쿼리 처리 (확장성)
   */
  async handleInlineQuery(inlineQuery) {
    try {
      // 기본적인 인라인 응답
      await this.bot.answerInlineQuery(inlineQuery.id, [], {
        cache_time: 300,
        is_personal: true,
      });
    } catch (error) {
      logger.debug("인라인 쿼리 처리 실패:", error.message);
    }
  }

  /**
   * 편집된 메시지 처리
   */
  async handleEditedMessage(msg) {
    // 현재는 로깅만 수행
    logger.debug(`📝 메시지 편집됨: ${getUserName(msg.from)}`);
  }

  /**
   * 📊 상태 조회 (완전판)
   */
  getStatus() {
    return {
      // 기본 정보
      version: "3.0.1",
      initialized: this.isInitialized,
      running: this.isRunning,
      uptime: this.stats.uptime,

      // 환경 정보
      environment: {
        railway: this.isRailwayEnvironment(),
        nodeEnv: process.env.NODE_ENV,
        platform: process.platform,
        nodeVersion: process.version,
      },

      // 성능 통계
      performance: {
        averageResponseTime: this.stats.averageResponseTime,
        slowestResponseTime: this.stats.slowestResponseTime,
        fastestResponseTime:
          this.stats.fastestResponseTime === Number.MAX_SAFE_INTEGER
            ? 0
            : this.stats.fastestResponseTime,
        memoryUsage: this.stats.currentMemoryUsage,
        peakMemoryUsage: this.stats.peakMemoryUsage,
      },

      // 활동 통계
      activity: {
        messagesReceived: this.stats.messagesReceived,
        callbacksReceived: this.stats.callbacksReceived,
        errorsCount: this.stats.errorsCount,
        totalUsers: this.stats.totalUsers,
        lastActivity: this.stats.lastActivity,
      },

      // 현재 처리 상황
      processing: {
        activeMessages: this.stats.activeMessages,
        activeCallbacks: this.stats.activeCallbacks,
        processingMessages: this.processingMessages.size,
        processingCallbacks: this.processingCallbacks.size,
      },

      // 설정 정보
      config: {
        messageTimeout: this.config.messageTimeout,
        callbackTimeout: this.config.callbackTimeout,
        rateLimitEnabled: this.config.rateLimitEnabled,
        maxRequestsPerMinute: this.config.maxRequestsPerMinute,
        memoryThreshold: this.config.memoryThreshold,
      },

      // 연결된 컴포넌트 상태
      components: {
        moduleManager: this.moduleManager?.getStatus() || null,
        dbManager: this.dbManager?.getStatus() || null,
        commandsRegistry: this.commandsRegistry?.getStatus() || null,
        healthCheck: this.healthCheck?.getStatus() || null,
      },
    };
  }

  /**
   * 🧹 정리 작업 (완전판)
   */
  async cleanup() {
    try {
      logger.info("🧹 BotController v3.0.1 정리 시작...");
      this.isRunning = false;

      // 1. 헬스체크 정지
      if (this.healthCheck) {
        await this.healthCheck.cleanup();
      }

      // 2. 처리 중인 작업 정리
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.rateLimitMap.clear();

      // 3. 봇 이벤트 리스너 제거
      if (this.bot) {
        this.bot.removeAllListeners();
      }

      // 4. 통계 초기화
      this.stats.uniqueUsers.clear();

      this.isInitialized = false;

      logger.info("✅ BotController v3.0.1 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
    }
  }
}

module.exports = BotController;
