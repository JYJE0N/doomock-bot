// src/modules/BaseModule.js - ServiceBuilder 연동 리팩토링 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

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
 *
 * 🔧 ServiceBuilder 활용:
 * - this.getService('todo') - 서비스 요청
 * - this.requireService('timer') - 필수 서비스 요청
 * - this.hasService('weather') - 서비스 존재 확인
 */
class BaseModule {
  /**
   * 🎯 표준 콜백 처리 (개선된 버전)
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
    } finally {
      // 응답 시간 통계
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   */
  async initialize() {
    if (this.initializationInProgress || this.isInitialized) {
      logger.debug(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    this.initializationInProgress = true;
    const startTime = Date.now();

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // ServiceBuilder 연결 확인
      await this.validateServiceBuilder();

      // 자식 클래스의 초기화 로직
      await this.onInitialize();

      // 액션 설정
      this.setupActions();

      // 초기 헬스체크
      await this.performHealthCheck();

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      const initTime = Date.now() - startTime;
      logger.success(`✅ ${this.moduleName} 초기화 완료 (${initTime}ms)`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      this.stats.errorsCount++;
      this.healthStatus.healthy = false;
      this.healthStatus.errors.push({
        type: "initialization",
        message: error.message,
        timestamp: TimeHelper.getTimestamp(),
      });
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * 🏗️ ServiceBuilder 연결 확인
   */
  async validateServiceBuilder() {
    if (!this.serviceBuilder) {
      throw new Error(`${this.moduleName}: ServiceBuilder가 필요합니다`);
    }

    if (!this.serviceBuilder.isInitialized) {
      logger.warn(`⚠️ ${this.moduleName}: ServiceBuilder가 초기화되지 않음`);
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

      // 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 액션 실행
      const action = this.actionMap.get(subAction);
      if (!action) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await this.sendActionNotFound(bot, callbackQuery, subAction);
        return false;
      }

      // 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);

      // 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);

      logger.debug(
        `✅ ${this.moduleName}.${subAction} 처리 완료 (${responseTime}ms)`
      );
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      // 헬스 상태 업데이트
      this.healthStatus.errors.push({
        type: "callback_error",
        action: subAction,
        message: error.message,
        timestamp: TimeHelper.getTimestamp(),
      });

      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리
   */
  async handleMessage(bot, msg) {
    const startTime = Date.now();

    try {
      // 메시지 검증
      if (!this.validateMessageParams(bot, msg)) {
        return false;
      }

      // 통계 업데이트
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 자식 클래스의 메시지 처리 로직
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        const responseTime = Date.now() - startTime;
        this.updateResponseTimeStats(responseTime);
        logger.debug(
          `✅ ${this.moduleName} 메시지 처리 완료 (${responseTime}ms)`
        );
      }

      return handled;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;

      // 헬스 상태 업데이트
      this.healthStatus.errors.push({
        type: "message_error",
        message: error.message,
        timestamp: TimeHelper.getTimestamp(),
      });

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

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 서비스 캐시 유효성 확인
   */
  isServiceCacheValid(serviceName) {
    if (!this.serviceCacheTimestamps.has(serviceName)) {
      return false;
    }

    const timestamp = this.serviceCacheTimestamps.get(serviceName);
    const age = Date.now() - timestamp;
    const maxAge = parseInt(process.env.SERVICE_CACHE_TIMEOUT) || 300000; // 5분

    return age < maxAge;
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime = Math.round(
        (this.stats.averageResponseTime + responseTime) / 2
      );
    }
  }

  /**
   * 🏥 헬스체크 수행
   */
  async performHealthCheck() {
    try {
      this.healthStatus.lastCheck = TimeHelper.getTimestamp();

      // 기본 상태 체크
      const isHealthy =
        this.isInitialized && this.actionMap.size > 0 && !!this.serviceBuilder;

      // 서비스 상태 체크
      const serviceHealth = {};
      for (const [serviceName, service] of this.serviceCache) {
        try {
          // 서비스 헬스체크
          if (service.getStatus && typeof service.getStatus === "function") {
            const status = service.getStatus();
            serviceHealth[serviceName] = {
              healthy: !!status && status.isConnected !== false,
              status: status,
            };
          } else {
            serviceHealth[serviceName] = { healthy: !!service };
          }
        } catch (error) {
          serviceHealth[serviceName] = {
            healthy: false,
            error: error.message,
          };
        }
      }

      // 전체 상태 업데이트
      this.healthStatus.healthy = isHealthy;
      this.healthStatus.services = serviceHealth;

      // 오래된 에러 정리 (24시간 이상)
      const dayAgo = Date.now() - 86400000;
      this.healthStatus.errors = this.healthStatus.errors.filter(
        (error) => error.timestamp > dayAgo
      );

      return this.healthStatus;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 헬스체크 실패:`, error);
      this.healthStatus.healthy = false;
      return this.healthStatus;
    }
  }

  /**
   * 액션 등록
   */
  registerAction(name, handler) {
    if (typeof handler !== "function") {
      throw new Error(`핸들러는 함수여야 합니다: ${name}`);
    }
    this.actionMap.set(name, handler.bind(this));
    logger.debug(`🎯 ${this.moduleName}.${name} 액션 등록됨`);
  }

  /**
   * 여러 액션 한번에 등록
   */
  registerActions(actions) {
    for (const [name, handler] of Object.entries(actions)) {
      this.registerAction(name, handler);
    }
  }

  /**
   * 매개변수 검증 - 콜백
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot || !callbackQuery) {
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
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
      logger.error(`${this.moduleName}: 필수 매개변수 누락`);
      return false;
    }

    if (!msg.chat || !msg.from) {
      logger.error(`${this.moduleName}: msg 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * 명령어 추출 유틸리티
   */
  extractCommand(text) {
    if (!text || typeof text !== "string") return null;

    const trimmed = text.trim().toLowerCase();

    // /명령어 형태
    if (trimmed.startsWith("/")) {
      return trimmed.substring(1);
    }

    // 일반 텍스트
    return trimmed;
  }

  /**
   * 사용자 상태 관리
   */
  setUserState(userId, state) {
    this.userStates.set(userId.toString(), {
      state,
      timestamp: Date.now(),
      moduleId: this.moduleName,
    });
  }

  getUserState(userId) {
    return this.userStates.get(userId.toString());
  }

  clearUserState(userId) {
    this.userStates.delete(userId.toString());
  }

  /**
   * 안전한 메시지 전송
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName}: 메시지 전송 실패`, error);
      throw error;
    }
  }

  /**
   * 안전한 메시지 수정
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
      logger.error(`${this.moduleName}: 메시지 수정 실패`, error);
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
        },
      } = callbackQuery;

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `❌ ${message}`,
        show_alert: false,
      });
    } catch (error) {
      logger.error(`${this.moduleName}: 에러 메시지 전송 실패`, error);
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
