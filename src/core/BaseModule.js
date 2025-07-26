// src/core/BaseModule.js - ServiceBuilder 연동 리팩토링 v3.0.1 (수정됨)
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ 베이스 모듈 v3.0.1 - ServiceBuilder 연동 리팩토링
 *
 * 🎯 주요 변경사항:
 * - ServiceBuilder를 통한 서비스 요청 시스템
 * - 서비스 의존성 자동 해결
 * - 느슨한 결합 (Loose Coupling) 구현
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 * - Railway 환경 최적화
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;

    // 🏗️ ServiceBuilder 연동 (핵심!)
    this.serviceBuilder = options.serviceBuilder;
    this.moduleManager = options.moduleManager;
    this.moduleKey = options.moduleKey;
    this.moduleConfig = options.moduleConfig;

    // 🎯 액션 맵 (핵심!)
    this.actionMap = new Map();

    // 📊 사용자 상태 관리
    this.userStates = new Map();

    // 🔧 서비스 캐시 (ServiceBuilder 연동용)
    this.serviceCache = new Map();
    this.serviceCacheTimestamps = new Map();

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
      cacheTTL: 300000, // 5분
      enableMetrics: true,
      enableFallback: true,
      ...options.config,
    };

    // 🏥 헬스 상태
    this.healthStatus = {
      healthy: true,
      services: {},
      errors: [],
      lastCheck: null,
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

      // ServiceBuilder 연결 확인
      this.validateServiceBuilder();

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      this.isInitialized = true;
      this.healthStatus.lastCheck = TimeHelper.getTimestamp();

      logger.success(`✅ ${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      this.healthStatus.healthy = false;
      this.healthStatus.errors.push({
        type: "initialization_error",
        message: error.message,
        timestamp: TimeHelper.getTimestamp(),
      });
      throw error;
    }
  }

  /**
   * 🔍 ServiceBuilder 연결 확인
   */
  validateServiceBuilder() {
    if (!this.serviceBuilder) {
      throw new Error(`${this.moduleName}: ServiceBuilder가 주입되지 않음`);
    }

    // ServiceBuilder가 정상적인 객체인지 확인
    if (
      typeof this.serviceBuilder.create !== "function" ||
      typeof this.serviceBuilder.get !== "function"
    ) {
      logger.warn(`⚠️ ${this.moduleName}: ServiceBuilder가 불완전함`);
    }

    logger.debug(`✅ ${this.moduleName}: ServiceBuilder 연결 확인됨`);
  }

  /**
   * 🎯 자식 클래스에서 구현할 초기화 메서드
   */
  async onInitialize() {
    // 자식 클래스에서 구현
    // 예: 필요한 서비스들 요청
    // this.todoService = await this.requireService('todo');
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현)
   */
  setupActions() {
    // 자식 클래스에서 구현
    // 예: this.registerActions({ menu: this.showMenu, ... });
  }

  /**
   * 📝 액션 등록 헬퍼
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      if (typeof handler === "function") {
        this.actionMap.set(action.toLowerCase(), handler);
        logger.debug(`📝 ${this.moduleName}: "${action}" 액션 등록됨`);
      }
    }
  }

  // ===== 🔧 ServiceBuilder 연동 메서드들 =====

  /**
   * 🔧 서비스 요청 (캐싱 지원)
   */
  async getService(serviceName, forceRefresh = false) {
    try {
      this.stats.serviceRequests++;

      // 캐시 확인 (강제 새로고침이 아닌 경우)
      if (
        !forceRefresh &&
        this.config.cacheEnabled &&
        this.serviceCache.has(serviceName)
      ) {
        if (this.isServiceCacheValid(serviceName)) {
          this.stats.serviceCacheHits++;
          logger.debug(
            `📦 ${this.moduleName}: 캐시된 서비스 반환 - ${serviceName}`
          );
          return this.serviceCache.get(serviceName);
        } else {
          // 만료된 캐시 제거
          this.serviceCache.delete(serviceName);
          this.serviceCacheTimestamps.delete(serviceName);
        }
      }

      this.stats.serviceCacheMisses++;

      // ServiceBuilder를 통해 서비스 요청
      const service = await this.serviceBuilder.create(serviceName);

      if (!service) {
        logger.warn(
          `⚠️ ${this.moduleName}: 서비스를 찾을 수 없음 - ${serviceName}`
        );
        return null;
      }

      // 캐시에 저장
      if (this.config.cacheEnabled) {
        this.serviceCache.set(serviceName, service);
        this.serviceCacheTimestamps.set(serviceName, Date.now());
      }

      // 헬스 상태 업데이트
      this.healthStatus.services[serviceName] = {
        connected: true,
        lastAccess: TimeHelper.getTimestamp(),
      };

      logger.debug(`🔧 ${this.moduleName}: 서비스 요청 성공 - ${serviceName}`);
      return service;
    } catch (error) {
      logger.error(
        `❌ ${this.moduleName}: 서비스 요청 실패 - ${serviceName}`,
        error
      );

      // 헬스 상태 업데이트
      this.healthStatus.services[serviceName] = {
        connected: false,
        error: error.message,
        lastError: TimeHelper.getTimestamp(),
      };

      this.stats.errorsCount++;
      return null;
    }
  }

  /**
   * 🔧 필수 서비스 요청 (실패 시 예외 발생)
   */
  async requireService(serviceName) {
    const service = await this.getService(serviceName);

    if (!service) {
      const error = new Error(
        `${this.moduleName}: 필수 서비스를 찾을 수 없음 - ${serviceName}`
      );
      this.healthStatus.healthy = false;
      this.healthStatus.errors.push({
        type: "required_service_missing",
        message: error.message,
        timestamp: TimeHelper.getTimestamp(),
      });
      throw error;
    }

    return service;
  }

  /**
   * 🔍 서비스 존재 확인
   */
  hasService(serviceName) {
    try {
      // 캐시 확인
      if (
        this.serviceCache.has(serviceName) &&
        this.isServiceCacheValid(serviceName)
      ) {
        return true;
      }

      // ServiceBuilder에서 확인
      const service = this.serviceBuilder.get(serviceName);
      return !!service;
    } catch (error) {
      logger.debug(
        `🔍 ${this.moduleName}: 서비스 존재 확인 실패 - ${serviceName}`,
        error
      );
      return false;
    }
  }

  /**
   * 🔍 서비스 캐시 유효성 검사
   */
  isServiceCacheValid(serviceName) {
    const timestamp = this.serviceCacheTimestamps.get(serviceName);
    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    return age < this.config.cacheTTL;
  }

  /**
   * 🔄 서비스 캐시 새로고침
   */
  async refreshService(serviceName) {
    logger.debug(
      `🔄 ${this.moduleName}: 서비스 캐시 새로고침 - ${serviceName}`
    );

    // 캐시에서 제거
    this.serviceCache.delete(serviceName);
    this.serviceCacheTimestamps.delete(serviceName);

    // 새로운 인스턴스 요청
    return await this.getService(serviceName, true);
  }

  /**
   * 📦 여러 서비스 한번에 요청
   */
  async getServices(serviceNames, required = false) {
    const services = {};
    const errors = [];

    for (const serviceName of serviceNames) {
      try {
        const service = required
          ? await this.requireService(serviceName)
          : await this.getService(serviceName);

        services[serviceName] = service;
      } catch (error) {
        errors.push({ serviceName, error: error.message });

        if (required) {
          throw new Error(
            `${this.moduleName}: 필수 서비스 요청 실패 - ${serviceName}: ${error.message}`
          );
        }
      }
    }

    if (errors.length > 0 && !required) {
      logger.warn(`⚠️ ${this.moduleName}: 일부 서비스 요청 실패`, errors);
    }

    return services;
  }

  // ===== 🎯 표준 콜백/메시지 처리 =====

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // ✅ 액션 정규화
      const action = subAction?.toLowerCase()?.trim() || "menu";

      // ✅ 상세 로깅 (모듈별)
      logger.debug(
        `📦 ${this.moduleName} 콜백: ${action} (params: [${params.join(", ")}])`
      );

      // 📊 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = new Date();

      // 액션 맵에서 핸들러 조회
      const handler = this.actionMap.get(action);

      if (handler && typeof handler === "function") {
        // ✅ 표준 매개변수로 핸들러 호출
        const result = await handler.call(
          this,
          bot,
          callbackQuery,
          params,
          moduleManager
        );

        // 응답 시간 기록
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);

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
   * 📨 표준 메시지 처리
   */
  async handleMessage(bot, msg) {
    try {
      logger.debug(`📨 ${this.moduleName} 메시지 처리: ${msg.text}`);

      this.stats.messagesHandled++;
      this.stats.lastActivity = new Date();

      // 자식 클래스의 메시지 처리 로직
      return await this.onHandleMessage(bot, msg);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;

      await bot.sendMessage(
        msg.chat.id,
        `❌ 처리 중 오류가 발생했습니다.\n다시 시도해주세요.`
      );

      return false;
    }
  }

  /**
   * 📨 자식 클래스에서 구현할 메시지 처리 메서드
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🔧 공통 유틸리티 메서드들 =====

  /**
   * 사용자 상태 관리
   */
  getUserState(userId) {
    return this.userStates.get(userId) || null;
  }

  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      updatedAt: TimeHelper.getTimestamp(),
    });
  }

  clearUserState(userId) {
    return this.userStates.delete(userId);
  }

  /**
   * 응답 시간 업데이트
   */
  updateResponseTime(responseTime) {
    this.stats.totalResponseTime += responseTime;
    const totalCalls = this.stats.callbacksHandled + this.stats.messagesHandled;
    this.stats.averageResponseTime = this.stats.totalResponseTime / totalCalls;
  }

  /**
   * 메시지 편집 헬퍼
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      if (
        error.response?.body?.error_code === 400 &&
        error.response?.body?.description?.includes("message is not modified")
      ) {
        logger.debug(`${this.moduleName} 메시지가 동일하여 편집하지 않음`);
        return null;
      }

      logger.error(`${this.moduleName} 메시지 편집 실패:`, error);
      throw error;
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
      const userName = getUserName(callbackQuery);

      const errorText = `❌ **오류 발생**

${userName}님, ${message}

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
      logger.error(`${this.moduleName} 에러 메시지 전송 실패:`, error);
    }
  }

  /**
   * 액션 없음 메시지
   */
  async sendActionNotFound(bot, callbackQuery, action) {
    await this.sendError(bot, callbackQuery, `알 수 없는 명령: ${action}`);
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
        health: this.healthStatus.services,
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
}

module.exports = BaseModule;
