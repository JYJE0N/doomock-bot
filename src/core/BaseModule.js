// src/core/BaseModule.js - 모든 모듈의 부모 클래스 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏗️ 베이스 모듈 - 모든 모듈의 부모 클래스
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용 (switch문 금지)
 * - 공통 기능 제공
 * - Railway 환경 최적화
 * - 중앙 집중식 의존성 관리
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    if (!moduleName) {
      throw new Error("모듈명이 필요합니다");
    }

    // 🎯 기본 속성 설정
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.validationManager = options.validationManager; // 🛡️ 검증 매니저
    this.config = options.config || {};

    // 🎯 액션 맵 (핵심!) - switch문 대신 사용
    this.actionMap = new Map();

    // 📊 사용자 상태 관리 (메모리 기반)
    this.userStates = new Map();

    // 📊 모듈 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      lastActivity: null,
      initializeTime: null,
    };

    // ⏱️ 기본 설정 (Railway 환경 최적화)
    this.config = {
      timeout: parseInt(process.env.MODULE_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.MODULE_MAX_RETRIES) || 3,
      cacheEnabled: process.env.MODULE_CACHE_ENABLED !== "false",
      enableDebugLogs: process.env.NODE_ENV === "development",
      ...options.config,
    };

    // 🏗️ 초기화 상태
    this.isInitialized = false;
    this.initializeStartTime = Date.now();

    logger.info(`🏗️ ${moduleName} 베이스 모듈 생성됨`);
  }

  /**
   * 🎯 모듈 초기화 (표준 패턴)
   * - onInitialize -> setupActions 순서 보장
   * - 예외 발생 시 롤백 처리
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      logger.info(`🎯 ${this.moduleName} 초기화 시작...`);

      // 1단계: 자식 클래스 초기화 로직
      if (this.onInitialize && typeof this.onInitialize === "function") {
        await this.onInitialize();
      }

      // 2단계: 액션 설정
      if (this.setupActions && typeof this.setupActions === "function") {
        this.setupActions();
      }

      // 3단계: 기본 액션 등록 (모든 모듈 공통)
      this.registerDefaultActions();

      // 초기화 완료
      this.isInitialized = true;
      this.stats.initializeTime = Date.now() - this.initializeStartTime;

      logger.success(
        `✅ ${this.moduleName} 초기화 완료 (${this.stats.initializeTime}ms)`
      );
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);

      // 롤백 처리
      await this.rollbackInitialization();
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

  /**
   * 🎯 기본 액션 등록 (모든 모듈 공통)
   */
  registerDefaultActions() {
    this.registerActions({
      // 공통 액션들
      cancel: this.handleCancel,
      back: this.handleBack,
      refresh: this.handleRefresh,
    });
  }

  /**
   * 🎯 액션 등록 헬퍼 (actionMap 방식 강제)
   */
  registerActions(actions) {
    if (!actions || typeof actions !== "object") {
      logger.warn(`${this.moduleName}: 잘못된 액션 객체`);
      return;
    }

    for (const [actionName, actionHandler] of Object.entries(actions)) {
      if (typeof actionHandler === "function") {
        this.actionMap.set(actionName, actionHandler);

        if (this.config.enableDebugLogs) {
          logger.debug(`🎯 ${this.moduleName}: 액션 등록 - ${actionName}`);
        }
      } else {
        logger.warn(
          `${this.moduleName}: 잘못된 액션 핸들러 - ${actionName} (함수가 아님)`
        );
      }
    }

    logger.debug(
      `🎯 ${this.moduleName}: 총 ${this.actionMap.size}개 액션 등록됨`
    );
  }

  /**
   * 🎯 표준 콜백 처리 (핵심!)
   * 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 🛡️ 매개변수 검증
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

      // 📊 통계 업데이트
      this.stats.callbacksHandled++;
      this.stats.lastActivity = TimeHelper.getCurrentTime("log");

      // 🎯 액션 실행
      const action = this.actionMap.get(subAction);
      if (!action) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);
        await this.sendActionNotFound(bot, callbackQuery, subAction);
        return false;
      }

      // 표준 매개변수로 액션 실행
      await action.call(this, bot, callbackQuery, params, moduleManager);

      logger.debug(`✅ ${this.moduleName}.${subAction} 처리 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      this.stats.errorsCount++;

      await this.sendError(bot, callbackQuery, "처리 중 오류가 발생했습니다.");
      return false;
    }
  }

  /**
   * 🎯 표준 메시지 처리 (자식 클래스에서 구현)
   * 매개변수: (bot, msg)
   */
  async handleMessage(bot, msg) {
    try {
      this.stats.messagesHandled++;
      this.stats.lastActivity = TimeHelper.getCurrentTime("log");

      // 자식 클래스에서 구현
      if (this.onHandleMessage && typeof this.onHandleMessage === "function") {
        return await this.onHandleMessage(bot, msg);
      }

      return false;
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 🎯 자식 클래스에서 구현할 메시지 처리 메서드
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false;
  }

  // ===== 🛡️ 검증 메서드들 =====

  /**
   * 콜백 매개변수 검증
   */
  validateCallbackParams(bot, callbackQuery, subAction, params, moduleManager) {
    if (!bot) {
      logger.error(`${this.moduleName}: bot 매개변수가 없습니다`);
      return false;
    }

    if (!callbackQuery) {
      logger.error(`${this.moduleName}: callbackQuery 매개변수가 없습니다`);
      return false;
    }

    if (!subAction) {
      logger.error(`${this.moduleName}: subAction 매개변수가 없습니다`);
      return false;
    }

    // params는 선택적, moduleManager는 선택적 (self-contained 모듈을 위해)
    return true;
  }

  // ===== 📤 공통 응답 메서드들 =====

  /**
   * 에러 메시지 전송
   */
  async sendError(bot, callbackQuery, message = "오류가 발생했습니다.") {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `❌ ${message}`,
        show_alert: true,
      });
    } catch (error) {
      logger.error(`${this.moduleName}: 에러 메시지 전송 실패:`, error);
    }
  }

  /**
   * 성공 메시지 전송
   */
  async sendSuccess(bot, callbackQuery, message = "완료되었습니다.") {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ ${message}`,
        show_alert: false,
      });
    } catch (error) {
      logger.error(`${this.moduleName}: 성공 메시지 전송 실패:`, error);
    }
  }

  /**
   * 액션을 찾을 수 없음 메시지
   */
  async sendActionNotFound(bot, callbackQuery, actionName) {
    await this.sendError(
      bot,
      callbackQuery,
      `알 수 없는 작업입니다: ${actionName}`
    );
  }

  // ===== 🎯 기본 액션 핸들러들 =====

  /**
   * 취소 액션 (모든 모듈 공통)
   */
  async handleCancel(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = callbackQuery.from.id;

      // 사용자 상태 초기화
      this.userStates.delete(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🚫 작업이 취소되었습니다.",
        show_alert: false,
      });

      // 메인 메뉴로 돌아가기
      if (moduleManager) {
        return await moduleManager.handleCallback(
          bot,
          callbackQuery,
          "system:menu"
        );
      }
    } catch (error) {
      logger.error(`${this.moduleName}: 취소 처리 오류:`, error);
      await this.sendError(
        bot,
        callbackQuery,
        "취소 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 뒤로가기 액션 (모든 모듈 공통)
   */
  async handleBack(bot, callbackQuery, params, moduleManager) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id);

      // 이전 메뉴로 돌아가기 (기본적으로 해당 모듈 메뉴)
      return await this.handleCallback(
        bot,
        callbackQuery,
        "menu",
        params,
        moduleManager
      );
    } catch (error) {
      logger.error(`${this.moduleName}: 뒤로가기 처리 오류:`, error);
      await this.sendError(
        bot,
        callbackQuery,
        "뒤로가기 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 새로고침 액션 (모든 모듈 공통)
   */
  async handleRefresh(bot, callbackQuery, params, moduleManager) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔄 새로고침 중...",
        show_alert: false,
      });

      // 현재 메뉴 다시 로드
      return await this.handleCallback(
        bot,
        callbackQuery,
        "menu",
        params,
        moduleManager
      );
    } catch (error) {
      logger.error(`${this.moduleName}: 새로고침 처리 오류:`, error);
      await this.sendError(
        bot,
        callbackQuery,
        "새로고침 처리 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 명령어 추출 헬퍼
   */
  extractCommand(text) {
    if (!text) return null;

    const trimmed = text.trim().toLowerCase();
    if (trimmed.startsWith("/")) {
      return trimmed.substring(1);
    }
    return trimmed;
  }

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now(),
      module: this.moduleName,
    });
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId) {
    return this.userStates.get(userId) || null;
  }

  /**
   * 사용자 상태 삭제
   */
  clearUserState(userId) {
    return this.userStates.delete(userId);
  }

  // ===== 📊 상태 및 통계 =====

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: { ...this.stats },
      config: {
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
        cacheEnabled: this.config.cacheEnabled,
      },
      actionCount: this.actionMap.size,
      userStateCount: this.userStates.size,
      uptime: this.isInitialized ? Date.now() - this.stats.initializeTime : 0,
    };
  }

  // ===== 🧹 정리 작업 =====

  /**
   * 모듈 정리 (애플리케이션 종료 시)
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 자식 클래스 정리 로직
      if (this.onCleanup && typeof this.onCleanup === "function") {
        await this.onCleanup();
      }

      // 기본 정리 작업
      this.userStates.clear();
      this.actionMap.clear();

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

  /**
   * 초기화 실패 시 롤백
   */
  async rollbackInitialization() {
    try {
      this.actionMap.clear();
      this.userStates.clear();
      this.isInitialized = false;

      logger.debug(`🔄 ${this.moduleName} 초기화 롤백 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 롤백 실패:`, error);
    }
  }
}

module.exports = BaseModule;
