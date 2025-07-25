// src/controllers/BotController.js - 완전 리팩토링 버전
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎮 봇 컨트롤러 - 완전 리팩토링
 * - 표준 매개변수 체계 준수
 * - Railway 환경 최적화
 * - 중복 처리 방지 강화
 */
class BotController {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.dbManager = options.dbManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🚫 중복 처리 방지 (강화)
    this.processingMessages = new Map(); // Set → Map으로 변경 (타임스탬프 저장)
    this.processingCallbacks = new Map();

    // ⏱️ 설정 (Railway 최적화)
    this.config = {
      messageTimeout: 8000, // Railway 환경에 맞게 증가
      callbackTimeout: 2000,
      maxRetries: 3,
      healthCheckInterval: 60000, // 1분
      cleanupInterval: 300000, // 5분
      ...options.config,
    };

    // 📊 통계 (향상된)
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
      startTime: TimeHelper.getTimestamp(),
      lastActivity: null,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
    };

    this.isInitialized = false;
    logger.info("🎮 BotController (v2.0) 생성됨");
  }

  /**
   * 🎯 컨트롤러 초기화 (완전판)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("BotController 이미 초기화됨");
      return;
    }

    try {
      logger.info("🎮 BotController v2.0 초기화 시작...");

      // 이벤트 핸들러 설정
      this.setupEventHandlers();

      // 에러 핸들러 설정
      this.setupErrorHandlers();

      // Railway 환경 최적화
      this.setupRailwayOptimizations();

      // 헬스체크 시작
      this.startHealthCheck();

      // 정리 작업 스케줄러
      this.startCleanupScheduler();

      this.isInitialized = true;
      logger.success("✅ BotController v2.0 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📡 이벤트 핸들러 설정 (완전판)
   */
  setupEventHandlers() {
    // 메시지 핸들러 (강화)
    this.bot.on("message", async (msg) => {
      await this.handleMessage(msg);
    });

    // 콜백쿼리 핸들러 (핵심 개선!)
    this.bot.on("callback_query", async (callbackQuery) => {
      await this.handleCallbackQuery(callbackQuery);
    });

    // 인라인 쿼리 핸들러
    this.bot.on("inline_query", async (query) => {
      await this.handleInlineQuery(query);
    });

    // 편집된 메시지 핸들러
    this.bot.on("edited_message", async (msg) => {
      await this.handleEditedMessage(msg);
    });

    logger.debug("📡 이벤트 핸들러 설정 완료");
  }

  /**
   * 🚨 에러 핸들러 설정 (Railway 특화)
   */
  setupErrorHandlers() {
    this.bot.on("polling_error", (error) => {
      logger.error("❌ 폴링 에러:", error);
      this.stats.errorsCount++;

      // Railway 환경에서 자동 재시작 로직
      if (process.env.RAILWAY_ENVIRONMENT) {
        this.handleRailwayError(error);
      }
    });

    this.bot.on("webhook_error", (error) => {
      logger.error("❌ 웹훅 에러:", error);
      this.stats.errorsCount++;
    });

    // 전역 에러 처리
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      this.stats.errorsCount++;
    });
  }

  /**
   * 🏗️ Railway 환경 최적화
   */
  setupRailwayOptimizations() {
    if (!process.env.RAILWAY_ENVIRONMENT) return;

    // 메모리 사용량 모니터링
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.stats.peakMemoryUsage = Math.max(
        this.stats.peakMemoryUsage,
        memUsage.heapUsed
      );

      // 메모리 사용량이 높으면 정리
      if (memUsage.heapUsed > 100 * 1024 * 1024) {
        // 100MB
        this.forceCleanup();
      }
    }, 30000); // 30초마다

    logger.debug("🏗️ Railway 최적화 설정 완료");
  }

  /**
   * 🏥 헬스체크 시작
   */
  startHealthCheck() {
    setInterval(async () => {
      try {
        // DB 연결 상태 확인
        if (this.dbManager) {
          const dbStatus = await this.dbManager.checkConnection();
          if (!dbStatus) {
            logger.warn("⚠️ DB 연결 문제 감지 - 재연결 시도");
            await this.dbManager.connect();
          }
        }

        // 모듈 상태 확인
        if (this.moduleManager) {
          const moduleStatus = this.moduleManager.getStatus();
          if (!moduleStatus.initialized) {
            logger.warn("⚠️ ModuleManager 문제 감지");
          }
        }

        // 통계 업데이트
        this.updatePerformanceStats();
      } catch (error) {
        logger.error("❌ 헬스체크 오류:", error);
      }
    }, this.config.healthCheckInterval);

    logger.debug("🏥 헬스체크 시작됨");
  }

  /**
   * 🧹 정리 작업 스케줄러
   */
  startCleanupScheduler() {
    setInterval(() => {
      this.performScheduledCleanup();
    }, this.config.cleanupInterval);

    logger.debug("🧹 정리 스케줄러 시작됨");
  }

  /**
   * 📬 메시지 처리 (개선판)
   */
  async handleMessage(msg) {
    const messageKey = `${msg.chat.id}-${msg.message_id}`;
    const timestamp = TimeHelper.getTimestamp();

    // 중복 처리 방지 (강화)
    if (this.processingMessages.has(messageKey)) {
      logger.debug("🔁 중복 메시지 무시:", messageKey);
      return;
    }

    this.processingMessages.set(messageKey, timestamp);
    this.stats.messagesReceived++;
    this.stats.lastActivity = TimeHelper.getLogTimeString();

    const startTime = Date.now();

    try {
      // 사용자 정보 로깅
      const userName = getUserName(msg.from);
      logger.info(
        `📬 메시지 수신: ${userName} -> "${
          msg.text?.substring(0, 50) || "[비텍스트]"
        }..."`
      );

      // 메시지 유효성 검사
      if (!this.isValidMessage(msg)) {
        return;
      }

      // 봇 멘션 또는 개인 채팅 확인
      if (!this.shouldProcessMessage(msg)) {
        return;
      }

      // ModuleManager로 라우팅
      let handled = false;
      if (this.moduleManager) {
        handled = await this.moduleManager.handleMessage(this.bot, msg);
      }

      // 처리되지 않은 명령어
      if (!handled && msg.text?.startsWith("/")) {
        await this.handleUnknownCommand(msg);
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
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingMessages.delete(messageKey);
      }, this.config.messageTimeout);
    }
  }

  /**
   * 🎯 콜백쿼리 처리 (핵심 개선!)
   */
  async handleCallbackQuery(callbackQuery) {
    // 입력 검증 (강화)
    if (!this.isValidCallbackQuery(callbackQuery)) {
      return;
    }

    const callbackKey = `${callbackQuery.from.id}-${callbackQuery.id}`;
    const timestamp = TimeHelper.getTimestamp();

    // 중복 처리 방지
    if (this.processingCallbacks.has(callbackKey)) {
      logger.debug("🔁 중복 콜백 무시:", callbackKey);
      await this.answerCallbackQuery(callbackQuery.id, "⏳ 처리 중입니다...");
      return;
    }

    this.processingCallbacks.set(callbackKey, timestamp);
    this.stats.callbacksReceived++;
    this.stats.lastActivity = TimeHelper.getLogTimeString();

    const startTime = Date.now();

    try {
      // 콜백 로깅
      const userName = getUserName(callbackQuery.from);
      logger.info(`🎯 콜백 수신: ${userName} -> "${callbackQuery.data}"`);

      // 즉시 콜백 응답 (타임아웃 방지)
      await this.answerCallbackQuery(callbackQuery.id);

      // 🔥 핵심! 새로운 콜백 라우팅 시스템
      const handled = await this.routeCallback(callbackQuery);

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
      // 타임아웃 후 제거
      setTimeout(() => {
        this.processingCallbacks.delete(callbackKey);
      }, this.config.callbackTimeout);
    }
  }

  /**
   * 🔥 새로운 콜백 라우팅 시스템 (핵심!)
   */
  async routeCallback(callbackQuery) {
    try {
      // 콜백 데이터 파싱: "module:action:param1:param2..."
      const { moduleKey, subAction, params } = this.parseCallbackData(
        callbackQuery.data
      );

      logger.debug(
        `🎯 콜백 라우팅: ${moduleKey}.${subAction}(${params.join(", ")})`
      );

      // 모듈 찾기
      if (!this.moduleManager) {
        logger.error("❌ ModuleManager가 없음");
        return false;
      }

      const moduleInstance = this.moduleManager.getModule(moduleKey);
      if (!moduleInstance) {
        logger.warn(`❓ 모듈을 찾을 수 없음: ${moduleKey}`);
        return false;
      }

      // 🎯 표준 매개변수로 모듈 메서드 호출
      const handled = await moduleInstance.handleCallback(
        this.bot,
        callbackQuery,
        subAction,
        params,
        this.moduleManager
      );

      if (handled) {
        logger.debug(`✅ ${moduleKey} 콜백 처리 완료`);
      }

      return handled;
    } catch (error) {
      logger.error("❌ 콜백 라우팅 오류:", error);
      return false;
    }
  }

  /**
   * 🔍 콜백 데이터 파싱 (새로운 형식)
   * 형식: "module:action:param1:param2..."
   * 예시: "todo:add:urgent", "timer:start:25", "system:menu"
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
   * ✅ 콜백쿼리 유효성 검사 (강화)
   */
  isValidCallbackQuery(callbackQuery) {
    if (!callbackQuery) {
      logger.error("❌ callbackQuery가 null/undefined");
      return false;
    }

    if (!callbackQuery.id) {
      logger.error("❌ callbackQuery.id가 없음");
      return false;
    }

    if (!callbackQuery.data) {
      logger.warn("⚠️ callbackQuery.data가 없음");
      // 빈 콜백도 일단 응답은 해주기
      this.answerCallbackQuery(callbackQuery.id, "⚠️ 잘못된 요청입니다.");
      return false;
    }

    if (!callbackQuery.from) {
      logger.error("❌ callbackQuery.from이 없음");
      return false;
    }

    return true;
  }

  /**
   * 📱 콜백 응답 (안전한 버전)
   */
  async answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
    try {
      await this.bot.answerCallbackQuery(callbackQueryId, {
        text: text,
        show_alert: showAlert,
      });
    } catch (error) {
      logger.warn("⚠️ 콜백 응답 실패:", error.message);
      // 응답 실패는 치명적이지 않으므로 계속 진행
    }
  }

  /**
   * 📊 성능 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    // 평균 응답 시간 계산 (지수 평활법)
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        this.stats.averageResponseTime * 0.9 + responseTime * 0.1;
    }
  }

  /**
   * 📊 성능 통계 업데이트
   */
  updatePerformanceStats() {
    const now = TimeHelper.getTimestamp();
    const uptime = now - this.stats.startTime;

    // 메모리 사용량 업데이트
    const memUsage = process.memoryUsage();
    this.stats.peakMemoryUsage = Math.max(
      this.stats.peakMemoryUsage,
      memUsage.heapUsed
    );

    // 30분마다 통계 로깅
    if (uptime % (30 * 60 * 1000) < 1000) {
      logger.info(
        `📊 성능 통계 - 업타임: ${TimeHelper.formatDuration(
          uptime
        )}, 평균응답: ${Math.round(this.stats.averageResponseTime)}ms`
      );
    }
  }

  /**
   * 🧹 예약된 정리 작업
   */
  performScheduledCleanup() {
    const now = TimeHelper.getTimestamp();

    // 오래된 처리 기록 제거
    for (const [key, timestamp] of this.processingMessages) {
      if (now - timestamp > this.config.messageTimeout * 2) {
        this.processingMessages.delete(key);
      }
    }

    for (const [key, timestamp] of this.processingCallbacks) {
      if (now - timestamp > this.config.callbackTimeout * 2) {
        this.processingCallbacks.delete(key);
      }
    }

    // 가비지 컬렉션 힌트
    if (global.gc) {
      global.gc();
    }

    logger.debug("🧹 예약된 정리 작업 완료");
  }

  /**
   * 🚨 강제 정리 (메모리 부족 시)
   */
  forceCleanup() {
    logger.warn("🚨 메모리 부족 - 강제 정리 시작");

    this.processingMessages.clear();
    this.processingCallbacks.clear();

    if (global.gc) {
      global.gc();
    }

    logger.warn("🚨 강제 정리 완료");
  }

  /**
   * 🏗️ Railway 에러 처리
   */
  handleRailwayError(error) {
    // Railway 환경에서의 특별한 에러 처리 로직
    if (error.code === "ETELEGRAM") {
      logger.warn("🔄 Railway 환경에서 텔레그램 연결 재시도");
      // 재연결 로직 등
    }
  }

  /**
   * 📊 상태 조회 (향상된)
   */
  getStatus() {
    const uptime = TimeHelper.getTimestamp() - this.stats.startTime;
    const memUsage = process.memoryUsage();

    return {
      initialized: this.isInitialized,
      version: "2.0",
      uptime: TimeHelper.formatDuration(uptime),
      performance: {
        averageResponseTime: Math.round(this.stats.averageResponseTime),
        peakMemoryUsage: Math.round(this.stats.peakMemoryUsage / 1024 / 1024), // MB
        currentMemoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      },
      stats: this.stats,
      processing: {
        messages: this.processingMessages.size,
        callbacks: this.processingCallbacks.size,
      },
      config: {
        environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
        messageTimeout: this.config.messageTimeout,
        callbackTimeout: this.config.callbackTimeout,
      },
      moduleManager: this.moduleManager?.getStatus() || null,
    };
  }

  /**
   * 🧹 정리 (향상된)
   */
  async cleanup() {
    try {
      logger.info("🧹 BotController v2.0 정리 시작...");

      // 처리 중인 작업 정리
      this.processingMessages.clear();
      this.processingCallbacks.clear();

      // 봇 이벤트 리스너 제거
      if (this.bot) {
        this.bot.removeAllListeners();
      }

      this.isInitialized = false;

      logger.info("✅ BotController v2.0 정리 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 실패:", error);
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 메시지 유효성 검사
   */
  isValidMessage(msg) {
    return msg && msg.chat && msg.from && msg.message_id;
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
   * 알 수 없는 명령어 처리
   */
  async handleUnknownCommand(msg) {
    const command = msg.text.split(" ")[0];

    await this.bot.sendMessage(
      msg.chat.id,
      `❓ 알 수 없는 명령어: ${command}\n\n/help 명령어로 사용 가능한 기능을 확인하세요.`,
      {
        reply_to_message_id: msg.message_id,
      }
    );
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
   * 콜백 에러 전송
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
}

module.exports = BotController;
