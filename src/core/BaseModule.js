// src/core/BaseModule.js - v3.0.1 완전 구현본
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const ServiceBuilder = require("./ServiceBuilder");

/**
 * 🏗️ 베이스 모듈 v3.0.1 - 완전 구현본
 *
 * 🎯 주요 기능:
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용 (핵심!)
 * - registerActions 메서드 구현 ⭐
 * - 공통 기능 제공
 * - Railway 환경 최적화
 * - ServiceBuilder 연동 지원
 *
 * 🔧 사용법:
 * class YourModule extends BaseModule {
 *   setupActions() {
 *     this.registerActions({
 *       menu: this.showMenu,
 *       help: this.showHelp
 *     });
 *   }
 * }
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    // ✅ ServiceBuilder 연결 (주입받거나 기본값 사용)
    this.serviceBuilder = options.serviceBuilder || ServiceBuilder;
    this.moduleManager = options.moduleManager;
    this.moduleKey = options.moduleKey;
    this.moduleConfig = options.moduleConfig;

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 📊 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      serviceRequests: 0,
      serviceCacheHits: 0,
      serviceCacheMisses: 0,
      averageResponseTime: 0,
      lastActivity: null,
      createdAt: TimeHelper.getTimestamp(),
      totalResponseTime: 0,
    };

    // ⏱️ 설정
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      cacheEnabled: true,
      enableMetrics: true,
      enableFallback: true,
      ...options.config,
    };

    // 🔧 서비스 캐시 (ServiceBuilder 연동)
    this.serviceCache = new Map();
    this.serviceCacheTimestamps = new Map();

    // 📊 헬스 상태
    this.healthStatus = {
      healthy: true,
      lastCheck: null,
      services: new Map(),
    };

    this.isInitialized = false;
    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`);
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      // 초기 헬스 체크
      await this.performHealthCheck();

      this.isInitialized = true;
      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 서비스 연결, DB 초기화 등
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  // ===== 🎯 액션 등록 시스템 (핵심!) =====

  /**
   * 🎯 단일 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`${this.moduleName}: 핸들러는 함수여야 합니다 - ${name}`);
    }

    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 ${this.moduleName}.${name} 액션 등록됨`);
  }

  /**
   * 🎯 여러 액션 한번에 등록 (핵심 메서드!)
   */
  registerActions(actions) {
    if (!actions || typeof actions !== "object") {
      throw new Error(`${this.moduleName}: actions는 객체여야 합니다`);
    }

    let registeredCount = 0;

    for (const [name, handler] of Object.entries(actions)) {
      try {
        this.registerAction(name, handler);
        registeredCount++;
      } catch (error) {
        logger.error(`❌ ${this.moduleName} 액션 등록 실패 (${name}):`, error);
      }
    }

    logger.debug(`🎯 ${this.moduleName}: ${registeredCount}개 액션 등록 완료`);
  }

  // ===== 🎯 콜백 및 메시지 처리 =====

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 매개변수 검증
      if (
        !this.validateCallbackParams(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        )
      ) {
        return false;
      }

      // ✅ 액션 정규화
      const action = subAction?.toLowerCase()?.trim() || "menu";

      logger.debug(
        `📦 ${this.moduleName} 콜백: ${action} (params: [${
          params?.join(", ") || ""
        }])`
      );

      // 📊 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getTimestamp();

      // 액션 맵에서 핸들러 조회
      const handler = this.actionMap.get(action);

      if (handler && typeof handler === "function") {
        // ✅ 표준 매개변수로 핸들러 호출
        const result = await handler.call(
          this,
          bot,
          callbackQuery,
          subAction, // 원본 액션명 전달
          params,
          moduleManager
        );

        // 응답 시간 측정
        const responseTime = Date.now() - startTime;
        this.updateResponseTimeStats(responseTime);

        logger.debug(
          `✅ ${this.moduleName}.${action} 처리 완료 (${responseTime}ms)`
        );
        return !!result;
      } else {
        // ❓ 액션 없음
        logger.warn(`❓ ${this.moduleName}: "${action}" 액션 없음`);

        if (this.config.enableFallback !== false) {
          await this.sendActionNotFound(bot, callbackQuery, action);
        }

        return false;
      }
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 오류:`, error);
      this.stats.errorsCount++;

      // 오류 처리
      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리
   */
  async handleMessage(bot, msg) {
    try {
      // 메시지 검증
      if (!this.validateMessageParams(bot, msg)) {
        return false;
      }

      // 통계 업데이트
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getTimestamp();

      // 자식 클래스의 메시지 처리 로직
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`✅ ${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🔧 ServiceBuilder 연동 메서드들 =====

  /**
   * 🔧 서비스 요청 (캐시 지원)
   */
  async getService(serviceName, options = {}) {
    try {
      this.stats.serviceRequests++;

      // 캐시 확인
      if (this.config.cacheEnabled && this.serviceCache.has(serviceName)) {
        const cacheTimestamp = this.serviceCacheTimestamps.get(serviceName);
        const cacheAge = Date.now() - cacheTimestamp;
        const cacheTimeout = options.cacheTimeout || 300000; // 5분

        if (cacheAge < cacheTimeout) {
          this.stats.serviceCacheHits++;
          logger.debug(`🎯 ${this.moduleName}: ${serviceName} 캐시 히트`);
          return this.serviceCache.get(serviceName);
        } else {
          // 캐시 만료
          this.serviceCache.delete(serviceName);
          this.serviceCacheTimestamps.delete(serviceName);
        }
      }

      this.stats.serviceCacheMisses++;

      // ServiceBuilder를 통한 서비스 요청
      let service = null;

      if (this.serviceBuilder) {
        service = await this.serviceBuilder.getService(serviceName, options);
      } else {
        logger.warn(
          `⚠️ ${this.moduleName}: ServiceBuilder 없음, 서비스 요청 실패`
        );
        return null;
      }

      // 캐시 저장
      if (service && this.config.cacheEnabled) {
        this.serviceCache.set(serviceName, service);
        this.serviceCacheTimestamps.set(serviceName, Date.now());
      }

      logger.debug(`🔧 ${this.moduleName}: ${serviceName} 서비스 요청 완료`);
      return service;
    } catch (error) {
      logger.error(
        `❌ ${this.moduleName} 서비스 요청 실패 (${serviceName}):`,
        error
      );
      return null;
    }
  }

  /**
   * 🔧 필수 서비스 요청 (없으면 에러)
   */
  async requireService(serviceName, options = {}) {
    const service = await this.getService(serviceName, options);

    if (!service) {
      throw new Error(`${this.moduleName}: 필수 서비스 없음 - ${serviceName}`);
    }

    return service;
  }

  /**
   * 🔧 서비스 존재 확인
   */
  async hasService(serviceName) {
    try {
      if (this.serviceBuilder) {
        return await this.serviceBuilder.hasService(serviceName);
      }
      return false;
    } catch (error) {
      logger.debug(
        `🔍 ${this.moduleName} 서비스 확인 실패 (${serviceName}):`,
        error.message
      );
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 매개변수 검증 - 콜백
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot || !callbackQuery) {
      logger.error(
        `${this.moduleName}: 필수 매개변수 누락 (bot, callbackQuery)`
      );
      return false;
    }

    if (!callbackQuery.message || !callbackQuery.from) {
      logger.error(`${this.moduleName}: callbackQuery 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 매개변수 검증 - 메시지
   */
  validateMessageParams(bot, msg) {
    if (!bot || !msg) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락 (bot, msg)`);
      return false;
    }

    if (!msg.chat || !msg.from) {
      logger.error(`${this.moduleName}: msg 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (!text || typeof text !== "string") return null;

    const match = text.trim().match(/^\/(\w+)/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = Math.round(
      this.stats.totalResponseTime / Math.max(this.stats.callbacksHandled, 1)
    );
  }

  // ===== 📤 메시지 전송 메서드들 =====

  /**
   * 메시지 전송
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      const messageOptions = {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...options,
      };

      return await bot.telegram.sendMessage(chatId, text, messageOptions);
    } catch (error) {
      logger.error(`${this.moduleName}: 메시지 전송 실패`, error);
      throw error;
    }
  }

  /**
   * 메시지 편집
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      const messageOptions = {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...options,
      };

      return await bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        text,
        messageOptions
      );
    } catch (error) {
      if (error.description?.includes("message is not modified")) {
        logger.debug(`${this.moduleName}: 메시지 내용 동일, 편집 스킵`);
        return null;
      }

      logger.error(`${this.moduleName}: 메시지 편집 실패`, error);

      // 재시도 (한 번만)
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          text,
          messageOptions
        );
      } catch (retryError) {
        logger.error(`${this.moduleName}: 메시지 재편집 실패`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❌ **${this.moduleName} 오류**

${message}

잠시 후 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 다시 시도",
              callback_data: `${this.moduleName.toLowerCase()}:menu`,
            },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, errorText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`${this.moduleName}: 에러 메시지 전송 실패`, error);
    }
  }

  /**
   * 액션 없음 메시지
   */
  async sendActionNotFound(bot, callbackQuery, action) {
    await this.sendError(
      bot,
      callbackQuery,
      `"${action}" 기능을 찾을 수 없습니다.`
    );
  }

  // ===== 📊 상태 및 헬스체크 =====

  /**
   * 헬스 체크 수행
   */
  async performHealthCheck() {
    try {
      this.healthStatus.lastCheck = TimeHelper.getTimestamp();

      // 기본 상태 체크
      const isHealthy =
        this.isInitialized &&
        this.actionMap.size > 0 &&
        this.stats.errorsCount < 100; // 에러 임계값

      // 서비스 상태 체크
      if (this.serviceBuilder) {
        // 각 캐시된 서비스의 상태 확인
        for (const serviceName of this.serviceCache.keys()) {
          try {
            const service = this.serviceCache.get(serviceName);
            const serviceHealthy =
              service && typeof service.getStatus === "function"
                ? service.getStatus().healthy
                : true;

            this.healthStatus.services.set(serviceName, serviceHealthy);
          } catch (error) {
            this.healthStatus.services.set(serviceName, false);
          }
        }
      }

      this.healthStatus.healthy = isHealthy;

      logger.debug(
        `🏥 ${this.moduleName} 헬스체크: ${isHealthy ? "정상" : "문제"}`
      );
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 헬스체크 실패:`, error);
      this.healthStatus.healthy = false;
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      moduleKey: this.moduleKey,
      initialized: this.isInitialized,
      healthy: this.healthStatus.healthy,
      stats: this.stats,
      config: {
        timeout: this.config.timeout,
        cacheEnabled: this.config.cacheEnabled,
        enableMetrics: this.config.enableMetrics,
      },
      services: {
        cached: Array.from(this.serviceCache.keys()),
        health: Object.fromEntries(this.healthStatus.services),
      },
      actions: Array.from(this.actionMap.keys()),
      lastActivity: this.stats.lastActivity,
      healthStatus: this.healthStatus,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 사용자 상태 정리
      this.userStates.clear();

      // 서비스 캐시 정리
      this.serviceCache.clear();
      this.serviceCacheTimestamps.clear();

      // 액션 맵 정리
      this.actionMap.clear();

      // 헬스 상태 정리
      this.healthStatus.services.clear();

      // 자식 클래스의 정리 로직
      await this.onCleanup();

      // 통계 초기화
      this.stats = {
        callbacksHandled: 0,
        messagesHandled: 0,
        errorsCount: 0,
        serviceRequests: 0,
        serviceCacheHits: 0,
        serviceCacheMisses: 0,
        averageResponseTime: 0,
        lastActivity: null,
        createdAt: TimeHelper.getTimestamp(),
        totalResponseTime: 0,
      };

      this.isInitialized = false;

      logger.info(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
    }
  }

  /**
   * 자식 클래스에서 구현할 정리 메서드
   */
  async onCleanup() {
    // 자식 클래스에서 구현
  }
}

module.exports = BaseModule;
