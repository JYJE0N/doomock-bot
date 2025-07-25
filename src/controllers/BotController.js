// src/controllers/BotController.js - v3.0.1 헬스체커 연동 완성본
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎮 봇 컨트롤러 v3.0.1 - 헬스체커 중앙화
 *
 * ✅ 변경 사항:
 * - 개별 헬스체크 로직 제거
 * - 중앙 HealthChecker와 연동
 * - 불필요한 중복 코드 정리
 * - 표준 매개변수 체계 유지
 * - 핵심 기능에만 집중
 */
class BotController {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.dbManager = options.dbManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🛡️ 중앙 시스템들 연결
    this.validationManager = options.validationManager;
    this.healthChecker = options.healthChecker;

    // 🚫 중복 처리 방지 시스템
    this.processingMessages = new Map();
    this.processingCallbacks = new Map();
    this.rateLimitMap = new Map();

    // ⏱️ Railway 최적화 설정
    this.config = {
      messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT) || 8000,
      callbackTimeout: parseInt(process.env.CALLBACK_TIMEOUT) || 2000,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
      maxConcurrentRequests:
        parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 30,
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 300000,
      ...options.config,
    };

    // 📊 핵심 통계만 유지
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      slowestResponseTime: 0,
      fastestResponseTime: Number.MAX_SAFE_INTEGER,
      peakMemoryUsage: 0,
      startTime: TimeHelper.getTimestamp(),
      lastActivity: null,
      uniqueUsers: new Set(),
      totalUsers: 0,
      activeMessages: 0,
      activeCallbacks: 0,
    };

    // 정리 스케줄러 ID 저장
    this.cleanupIntervalId = null;

    this.isInitialized = false;
    this.isRunning = false;

    logger.info("🎮 BotController v3.0.1 생성됨 (헬스체커 연동)");
  }

  /**
   * 🎯 컨트롤러 초기화 (중앙 시스템 연동)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("BotController 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎮 BotController v3.0.1 초기화 시작...");

      // 의존성 검증
      this.validateDependencies();

      // 중앙 시스템들과 연결
      this.connectToCentralSystems();

      // 봇 이벤트 핸들러 설정
      this.setupBotEventHandlers();

      // 정리 작업 스케줄러 시작
      this.startCleanupScheduler();

      // 자체를 HealthChecker에 등록
      if (this.healthChecker) {
        try {
          this.healthChecker.registerComponent("botController", this);
          logger.debug("🏥 HealthChecker에 컴포넌트 등록됨");
        } catch (error) {
          logger.error("❌ HealthChecker 등록 실패:", error);
        }
      }

      this.isInitialized = true;
      this.isRunning = true;

      logger.success("✅ BotController v3.0.1 초기화 완료 (중앙 시스템 연동)");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔗 중앙 시스템들과 연결
   */
  connectToCentralSystems() {
    // ValidationManager 연결
    if (this.validationManager) {
      logger.debug("🛡️ ValidationManager 연결됨");
    } else {
      logger.warn("⚠️ ValidationManager가 연결되지 않음 - 기본 검증만 사용");
    }

    // HealthChecker 연결
    if (this.healthChecker) {
      logger.debug("🏥 HealthChecker 연결됨");
    } else {
      logger.warn("⚠️ HealthChecker가 연결되지 않음 - 개별 상태 관리");
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
   * 🎮 봇 이벤트 핸들러 설정
   */
  setupBotEventHandlers() {
    // 메시지 처리
    this.bot.on("message", async (msg) => {
      await this.handleMessage(msg);
    });

    // 콜백 쿼리 처리
    this.bot.on("callback_query", async (callbackQuery) => {
      await this.handleCallback(callbackQuery);
    });

    // 인라인 쿼리 처리
    this.bot.on("inline_query", async (inlineQuery) => {
      await this.handleInlineQuery(inlineQuery);
    });

    // 에러 처리
    this.bot.on("error", (error) => {
      this.handleBotError(error, "bot_error");
    });

    // 폴링 에러 처리
    this.bot.on("polling_error", (error) => {
      this.handleBotError(error, "polling_error");
    });

    // 웹훅 에러 처리 (사용하는 경우)
    this.bot.on("webhook_error", (error) => {
      this.handleBotError(error, "webhook_error");
    });

    logger.debug("🎮 봇 이벤트 핸들러 설정 완료");
  }

  /**
   * 🚨 봇 에러 처리 (중앙화)
   */
  handleBotError(error, type) {
    logger.error(`❌ ${type}:`, error);
    this.stats.errorsCount++;

    // 크리티컬 에러인 경우 HealthChecker에 보고
    if (this.healthChecker && this.isCriticalError(error)) {
      try {
        this.healthChecker.reportError("botController", {
          type,
          error: error.message || error,
          code: error.code,
          timestamp: TimeHelper.getLogTimeString(),
        });
      } catch (reportError) {
        logger.error("❌ HealthChecker 에러 보고 실패:", reportError);
      }
    }
  }

  /**
   * 🔍 크리티컬 에러 판단
   */
  isCriticalError(error) {
    return (
      error.code === "EFATAL" ||
      error.message?.includes("NETWORK") ||
      error.message?.includes("TOKEN") ||
      error.message?.includes("ETELEGRAM")
    );
  }

  /**
   * 💬 메시지 처리 (중앙 검증 시스템 활용)
   */
  async handleMessage(msg) {
    const startTime = Date.now();
    const userId = msg.from?.id;
    const messageId = msg.message_id;
    const uniqueKey = `${userId}-${messageId}`;

    try {
      // 중복 처리 방지
      if (this.processingMessages.has(uniqueKey)) {
        logger.debug(`🚫 중복 메시지 무시: ${uniqueKey}`);
        return;
      }

      // 🛡️ 사용자 입력 검증 (ValidationManager 활용)
      if (this.validationManager && msg.text) {
        const validationResult = await this.validationManager.validate(
          "userInput",
          {
            text: msg.text,
            userId: userId,
          }
        );

        if (!validationResult.isValid) {
          logger.warn(
            `🛡️ 사용자 입력 검증 실패 (${userId}):`,
            validationResult.errors
          );
          await this.sendValidationErrorMessage(
            userId,
            validationResult.errors
          );
          return;
        }
      }

      // 속도 제한 체크
      if (this.config.rateLimitEnabled && this.isRateLimited(userId)) {
        logger.warn(`⏱️ 속도 제한 적용: 사용자 ${userId}`);
        await this.bot.sendMessage(
          userId,
          "⏱️ 잠시 기다려주세요. 너무 많은 요청을 보내고 있습니다."
        );
        return;
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
        `💬 메시지 처리 시작: ${getUserName(msg.from)} (${uniqueKey})`
      );

      // ModuleManager에 위임
      if (this.moduleManager) {
        await this.moduleManager.handleMessage(this.bot, msg);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 메시지 처리 불가");
      }
    } catch (error) {
      logger.error(`❌ 메시지 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      // 사용자에게 에러 알림
      try {
        await this.bot.sendMessage(
          userId,
          "❌ 메시지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      } catch (notifyError) {
        logger.error("사용자 에러 알림 실패:", notifyError);
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
   * ⚡ 콜백 처리 (중앙 검증 시스템 활용)
   */
  async handleCallback(callbackQuery) {
    const startTime = Date.now();
    const userId = callbackQuery.from?.id;
    const callbackId = callbackQuery.id;
    const uniqueKey = `${userId}-${callbackId}`;

    try {
      // 중복 처리 방지
      if (this.processingCallbacks.has(uniqueKey)) {
        logger.debug(`🚫 중복 콜백 무시: ${uniqueKey}`);
        await this.bot.answerCallbackQuery(callbackId);
        return;
      }

      // 🛡️ 콜백 데이터 검증 (ValidationManager 활용)
      if (this.validationManager && callbackQuery.data) {
        const validationResult = await this.validationManager.validate(
          "callbackData",
          {
            data: callbackQuery.data,
            userId: userId,
          }
        );

        if (!validationResult.isValid) {
          logger.warn(
            `🛡️ 콜백 데이터 검증 실패 (${userId}):`,
            validationResult.errors
          );
          await this.bot.answerCallbackQuery(callbackId, {
            text: "❌ 잘못된 요청입니다.",
            show_alert: true,
          });
          return;
        }
      }

      // 콜백 답변 (사용자 대기 상태 해제)
      await this.bot.answerCallbackQuery(callbackId);

      // 처리 시작
      this.processingCallbacks.set(uniqueKey, Date.now());
      this.stats.activeCallbacks++;
      this.stats.callbacksReceived++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `⚡ 콜백 처리 시작: ${getUserName(callbackQuery.from)} (${uniqueKey})`
      );

      // ModuleManager에 위임
      if (this.moduleManager) {
        await this.moduleManager.handleCallback(this.bot, callbackQuery);
      } else {
        logger.warn("⚠️ ModuleManager가 없어 콜백 처리 불가");
      }
    } catch (error) {
      logger.error(`❌ 콜백 처리 실패 (${uniqueKey}):`, error);
      this.stats.errorsCount++;

      // 콜백 에러 답변
      try {
        await this.bot.answerCallbackQuery(callbackId, {
          text: "❌ 처리 중 오류가 발생했습니다.",
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
   * 🛡️ 검증 오류 메시지 전송
   */
  async sendValidationErrorMessage(userId, errors) {
    try {
      let errorMessage = "❌ **입력 오류**\n\n";

      // 에러 메시지 포맷팅
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

      await this.bot.sendMessage(userId, errorMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("검증 오류 메시지 전송 실패:", error);
    }
  }

  /**
   * 🔍 인라인 쿼리 처리
   */
  async handleInlineQuery(inlineQuery) {
    try {
      const userId = inlineQuery.from?.id;
      logger.debug(`🔍 인라인 쿼리: ${getUserName(inlineQuery.from)}`);

      // 빈 결과 반환 (필요시 확장)
      await this.bot.answerInlineQuery(inlineQuery.id, []);
    } catch (error) {
      logger.error("❌ 인라인 쿼리 처리 실패:", error);
      this.stats.errorsCount++;
    }
  }

  /**
   * ⏱️ 속도 제한 체크
   */
  isRateLimited(userId) {
    if (!this.config.rateLimitEnabled || !userId) return false;

    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit) {
      this.rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
      return false;
    }

    // 리셋 시간 확인
    if (now > userLimit.resetTime) {
      this.rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
      return false;
    }

    // 제한 확인
    if (userLimit.count >= this.config.maxRequestsPerMinute) {
      return true;
    }

    // 카운트 증가
    userLimit.count++;
    return false;
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

    if (duration > this.stats.slowestResponseTime) {
      this.stats.slowestResponseTime = duration;
    }

    if (duration < this.stats.fastestResponseTime) {
      this.stats.fastestResponseTime = duration;
    }

    // 메모리 사용량 업데이트
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    if (memUsage > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = memUsage;
    }
  }

  /**
   * 🧹 정리 작업 스케줄러 시작
   */
  startCleanupScheduler() {
    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    logger.debug(
      `🧹 정리 작업 스케줄러 시작됨 (${this.config.cleanupInterval}ms)`
    );
  }

  /**
   * 🧹 정리 작업 수행
   */
  performCleanup() {
    const now = Date.now();
    const staleTimeout = 600000; // 10분

    try {
      // 오래된 처리 중 메시지 정리
      let cleanedMessages = 0;
      for (const [key, timestamp] of this.processingMessages.entries()) {
        if (now - timestamp > staleTimeout) {
          this.processingMessages.delete(key);
          this.stats.activeMessages = Math.max(
            0,
            this.stats.activeMessages - 1
          );
          cleanedMessages++;
        }
      }

      // 오래된 처리 중 콜백 정리
      let cleanedCallbacks = 0;
      for (const [key, timestamp] of this.processingCallbacks.entries()) {
        if (now - timestamp > staleTimeout) {
          this.processingCallbacks.delete(key);
          this.stats.activeCallbacks = Math.max(
            0,
            this.stats.activeCallbacks - 1
          );
          cleanedCallbacks++;
        }
      }

      // 속도 제한 맵 정리
      let cleanedRateLimits = 0;
      for (const [userId, limit] of this.rateLimitMap.entries()) {
        if (now > limit.resetTime + 60000) {
          // 추가 1분 여유
          this.rateLimitMap.delete(userId);
          cleanedRateLimits++;
        }
      }

      // 정리 통계 로깅 (개발 환경에서만)
      if (
        process.env.NODE_ENV === "development" &&
        (cleanedMessages > 0 || cleanedCallbacks > 0 || cleanedRateLimits > 0)
      ) {
        logger.debug(
          `🧹 정리 작업 완료: 메시지 ${cleanedMessages}개, 콜백 ${cleanedCallbacks}개, 제한 ${cleanedRateLimits}개`
        );
      }

      // 메모리 사용량 체크 및 가비지 컬렉션
      const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      if (memUsage > 400 && global.gc) {
        // 400MB 이상일 때
        global.gc();
        logger.debug(`🧹 가비지 컬렉션 실행됨 (메모리: ${memUsage}MB)`);
      }
    } catch (error) {
      logger.error("❌ 정리 작업 실패:", error);
    }
  }

  /**
   * 📊 컨트롤러 상태 조회 (HealthChecker 연동)
   */
  getStatus() {
    const memUsage = process.memoryUsage();
    const currentMemoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);

    return {
      // 헬스 상태
      status: this.isRunning ? "healthy" : "stopped",

      // 기본 상태
      initialized: this.isInitialized,
      running: this.isRunning,
      timestamp: TimeHelper.getLogTimeString(),

      // 연결 상태
      connections: {
        bot: !!this.bot,
        moduleManager: !!this.moduleManager,
        dbManager: !!this.dbManager,
        validationManager: !!this.validationManager,
        healthChecker: !!this.healthChecker,
      },

      // 성능 지표
      performance: {
        averageResponseTime: this.stats.averageResponseTime,
        slowestResponseTime: this.stats.slowestResponseTime,
        fastestResponseTime:
          this.stats.fastestResponseTime === Number.MAX_SAFE_INTEGER
            ? 0
            : this.stats.fastestResponseTime,
        memoryUsage: currentMemoryUsage,
        peakMemoryUsage: Math.max(
          this.stats.peakMemoryUsage || 0,
          currentMemoryUsage
        ),
        errorRate: this.calculateErrorRate(),
      },

      // 활동 통계
      activity: {
        messagesReceived: this.stats.messagesReceived,
        callbacksReceived: this.stats.callbacksReceived,
        errorsCount: this.stats.errorsCount,
        totalUsers: this.stats.totalUsers,
        lastActivity: this.stats.lastActivity,
        startTime: this.stats.startTime,
        uptime: Date.now() - this.stats.startTime,
      },

      // 현재 처리 상황
      processing: {
        activeMessages: this.stats.activeMessages,
        activeCallbacks: this.stats.activeCallbacks,
        processingMessages: this.processingMessages.size,
        processingCallbacks: this.processingCallbacks.size,
        rateLimitedUsers: this.rateLimitMap.size,
      },

      // 설정 정보
      config: {
        messageTimeout: this.config.messageTimeout,
        callbackTimeout: this.config.callbackTimeout,
        rateLimitEnabled: this.config.rateLimitEnabled,
        maxRequestsPerMinute: this.config.maxRequestsPerMinute,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
        cleanupInterval: this.config.cleanupInterval,
      },

      // 중앙 시스템 상태
      centralSystems: {
        validation: this.validationManager
          ? {
              enabled: true,
              status: this.validationManager.getStatus
                ? this.validationManager.getStatus()
                : "available",
            }
          : { enabled: false },

        healthCheck: this.healthChecker
          ? {
              enabled: true,
              status: this.healthChecker.getStatus
                ? this.healthChecker.getStatus()
                : "available",
            }
          : { enabled: false },
      },

      // 품질 지표
      quality: {
        errorRate: this.calculateErrorRate(),
        responseTimeGrade: this.getResponseTimeGrade(),
        memoryEfficiency: this.getMemoryEfficiencyGrade(),
      },
    };
  }

  /**
   * 📊 에러율 계산
   */
  calculateErrorRate() {
    const total = this.stats.messagesReceived + this.stats.callbacksReceived;
    return total > 0 ? Math.round((this.stats.errorsCount / total) * 100) : 0;
  }

  /**
   * 📊 응답 시간 등급 계산
   */
  getResponseTimeGrade() {
    const avgTime = this.stats.averageResponseTime;
    if (avgTime < 500) return "excellent";
    if (avgTime < 1000) return "good";
    if (avgTime < 2000) return "fair";
    return "poor";
  }

  /**
   * 📊 메모리 효율성 등급 계산
   */
  getMemoryEfficiencyGrade() {
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    if (memUsage < 100) return "excellent";
    if (memUsage < 200) return "good";
    if (memUsage < 400) return "fair";
    return "poor";
  }

  /**
   * 🧹 정리 작업 (중앙 시스템 연동 해제)
   */
  async cleanup() {
    try {
      logger.info("🧹 BotController v3.0.1 정리 시작...");
      this.isRunning = false;

      // 중앙 시스템에서 자신을 해제
      if (this.healthChecker) {
        try {
          this.healthChecker.unregisterComponent("botController");
          logger.debug("🏥 HealthChecker에서 등록 해제됨");
        } catch (error) {
          logger.error("❌ HealthChecker 등록 해제 실패:", error);
        }
      }

      // 정리 스케줄러 정지
      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
        this.cleanupIntervalId = null;
        logger.debug("🧹 정리 스케줄러 정지됨");
      }

      // 처리 중인 작업 완료 대기 (최대 5초)
      const maxWaitTime = 5000;
      const startWait = Date.now();

      while (
        (this.processingMessages.size > 0 ||
          this.processingCallbacks.size > 0) &&
        Date.now() - startWait < maxWaitTime
      ) {
        logger.debug(
          `⏳ 처리 중인 작업 대기 중... (메시지: ${this.processingMessages.size}, 콜백: ${this.processingCallbacks.size})`
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // 강제 정리
      this.processingMessages.clear();
      this.processingCallbacks.clear();
      this.rateLimitMap.clear();

      // 봇 이벤트 리스너 제거
      if (this.bot) {
        this.bot.removeAllListeners();
        logger.debug("🎮 봇 이벤트 리스너 제거됨");
      }

      // 통계 초기화
      this.stats.uniqueUsers.clear();

      this.isInitialized = false;

      const totalRuntime = Date.now() - this.stats.startTime;
      logger.info(
        `✅ BotController v3.0.1 정리 완료 (총 실행 시간: ${TimeHelper.formatDuration(
          totalRuntime
        )})`
      );

      // 최종 통계 출력 (개발 환경에서만)
      if (process.env.NODE_ENV === "development") {
        logger.debug("📊 최종 통계:", {
          messagesReceived: this.stats.messagesReceived,
          callbacksReceived: this.stats.callbacksReceived,
          errorsCount: this.stats.errorsCount,
          totalUsers: this.stats.totalUsers,
          averageResponseTime: this.stats.averageResponseTime + "ms",
          peakMemoryUsage: this.stats.peakMemoryUsage + "MB",
          errorRate: this.calculateErrorRate() + "%",
        });
      }
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
      throw error;
    }
  }
}

module.exports = BotController;
