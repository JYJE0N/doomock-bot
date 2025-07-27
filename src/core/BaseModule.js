// src/core/BaseModule.js - 수정된 버전 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏗️ BaseModule v3.0.1 - answerCallbackQuery 제거 버전
 *
 * 🎯 주요 변경사항:
 * - answerCallbackQuery 호출 완전 제거
 * - BotController가 콜백 응답 전담
 * - 순수 비즈니스 로직과 데이터 처리만 담당
 * - UI 렌더링은 NavigationHandler에게 위임
 *
 * ✅ 올바른 역할:
 * - 비즈니스 로직 처리
 * - 데이터 조회/변경
 * - 상태 관리
 * - 결과 데이터 반환
 *
 * ❌ 하면 안 되는 일:
 * - answerCallbackQuery 호출 (BotController 전담)
 * - 직접적인 UI 렌더링 (NavigationHandler 전담)
 * - 키보드 생성 (NavigationHandler 전담)
 */
class BaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.bot = options.bot;
    this.db = options.db;
    this.moduleManager = options.moduleManager;
    this.serviceBuilder = options.serviceBuilder; // v3.0.1 ServiceBuilder 지원
    this.config = options.config || {};

    // 액션 맵 (switch문 대신 사용)
    this.actionMap = new Map();

    // 사용자 상태 관리 (내장)
    this.userStates = new Map();

    // 상태
    this.isInitialized = false;
    this.lastActivity = null;

    // 통계
    this.stats = {
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      createdAt: TimeHelper.now(),
    };

    // 모듈 설정 (기본값)
    this.defaultConfig = {
      timeout: 30000,
      retryCount: 3,
      cacheEnabled: true,
      maxUserStates: 1000,
      stateTimeout: 30 * 60 * 1000, // 30분
    };

    // 최종 설정 (기본값 + 사용자 설정)
    this.config = { ...this.defaultConfig, ...this.config };

    logger.module(this.moduleName, "모듈 생성됨");
  }

  /**
   * 🎯 초기화 (자식 클래스에서 오버라이드)
   */
  async initialize() {
    try {
      logger.module(this.moduleName, "초기화 시작...");

      // 자식 클래스의 onInitialize 호출
      if (this.onInitialize) {
        await this.onInitialize();
      }

      // 액션 설정
      this.setupActions();

      // 사용자 상태 정리 스케줄러 시작
      this.startStateCleanupScheduler();

      this.isInitialized = true;
      logger.success(`${this.moduleName} 초기화 완료`);
    } catch (error) {
      logger.error(`${this.moduleName} 초기화 실패`, error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (자식 클래스에서 호출)
   */
  registerActions(actions) {
    for (const [action, handler] of Object.entries(actions)) {
      this.actionMap.set(action, handler.bind(this));
    }

    logger.debug(`${this.moduleName}: ${this.actionMap.size}개 액션 등록됨`);
  }

  /**
   * 🎯 액션 설정 (자식 클래스에서 구현 필수!)
   */
  setupActions() {
    throw new Error(`${this.moduleName}: setupActions() 구현 필요`);
  }

  /**
   * 🎯 콜백 처리
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.stats.callbacksHandled++;
      this.lastActivity = TimeHelper.now();

      logger.debug(
        `${this.moduleName}: ${subAction} 호출 (사용자: ${getUserId(
          callbackQuery
        )})`
      );

      // 액션 찾기
      const handler = this.actionMap.get(subAction);
      if (!handler) {
        logger.warn(`${this.moduleName}: 알 수 없는 액션 - ${subAction}`);

        // NavigationHandler가 에러 UI 처리하도록 데이터만 반환
        return {
          type: "error",
          message: "알 수 없는 명령입니다",
          module: this.moduleName,
          action: subAction,
        };
      }

      // 핸들러 실행 (표준 매개변수) - UI 데이터만 반환
      const result = await handler.call(
        this,
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      // ✅ 결과 데이터 반환 (NavigationHandler가 UI 렌더링)
      return (
        result || {
          type: "success",
          module: this.moduleName,
          action: subAction,
        }
      );
    } catch (error) {
      this.stats.errorsCount++;
      logger.error(`${this.moduleName} 콜백 처리 실패`, error);

      // NavigationHandler가 에러 UI 처리하도록 에러 데이터만 반환
      return {
        type: "error",
        message: "처리 중 오류가 발생했습니다",
        module: this.moduleName,
        action: subAction,
        error: error.message,
      };
    }
  }

  /**
   * 💬 메시지 처리 (표준 패턴)
   */
  async handleMessage(bot, msg) {
    try {
      this.stats.messagesHandled++;
      this.lastActivity = TimeHelper.now();

      // 자식 클래스의 onHandleMessage 호출
      const handled = await this.onHandleMessage(bot, msg);

      if (handled) {
        logger.debug(`${this.moduleName} 메시지 처리 완료`);
      }

      return handled;
    } catch (error) {
      this.stats.errorsCount++;
      logger.error(`${this.moduleName} 메시지 처리 실패`, error);
      return false;
    }
  }

  /**
   * 💬 메시지 처리 (자식 클래스에서 구현)
   */
  async onHandleMessage(bot, msg) {
    // 자식 클래스에서 구현
    return false; // handled 여부 반환
  }

  // ===== 🛠️ 사용자 상태 관리 =====

  /**
   * 사용자 상태 설정
   */
  setUserState(userId, state) {
    const stateData = {
      ...state,
      timestamp: Date.now(),
      module: this.moduleName,
      expires: Date.now() + this.config.stateTimeout,
    };

    this.userStates.set(userId.toString(), stateData);

    // 상태 개수 제한 확인
    if (this.userStates.size > this.config.maxUserStates) {
      this.cleanupExpiredStates();
    }
  }

  /**
   * 사용자 상태 조회
   */
  getUserState(userId) {
    const state = this.userStates.get(userId.toString());

    if (!state) {
      return null;
    }

    // 만료된 상태 확인
    if (state.expires && Date.now() > state.expires) {
      this.userStates.delete(userId.toString());
      return null;
    }

    return state;
  }

  /**
   * 사용자 상태 삭제
   */
  clearUserState(userId) {
    return this.userStates.delete(userId.toString());
  }

  /**
   * 만료된 상태 정리
   */
  cleanupExpiredStates() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, state] of this.userStates.entries()) {
      if (state.expires && now > state.expires) {
        this.userStates.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`${this.moduleName}: ${cleanedCount}개 만료된 상태 정리됨`);
    }
  }

  /**
   * 상태 정리 스케줄러 시작
   */
  startStateCleanupScheduler() {
    // 10분마다 만료된 상태 정리
    this.stateCleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 10 * 60 * 1000);
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 명령어 추출
   */
  extractCommand(text) {
    if (!text || typeof text !== "string") return null;

    const match = text.match(/^\/([a-zA-Z0-9_]+)/);
    return match ? match[1].toLowerCase() : null;
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
      logger.error(`${this.moduleName}: 메시지 구조 오류`);
      return false;
    }

    return true;
  }

  /**
   * ✅ 안전한 메시지 전송 (에러 처리 포함)
   */
  async sendMessage(bot, chatId, text, options = {}) {
    try {
      return await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...options,
      });
    } catch (error) {
      logger.error(`${this.moduleName} 메시지 전송 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        const plainText = text.replace(/[*_`~|\\]/g, "");
        return await bot.sendMessage(chatId, plainText, {
          disable_web_page_preview: true,
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 재전송 실패:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * ✅ 안전한 메시지 편집 (에러 처리 포함)
   */
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        ...options,
      });
    } catch (error) {
      if (error.message.includes("message is not modified")) {
        logger.debug("메시지 내용이 동일함 - 편집 스킵");
        return;
      }

      logger.error(`${this.moduleName} 메시지 편집 오류:`, error);

      // 마크다운 실패 시 일반 텍스트로 재시도
      try {
        const plainText = text.replace(/[*_`~|\\]/g, "");
        return await bot.editMessageText(plainText, {
          chat_id: chatId,
          message_id: messageId,
          disable_web_page_preview: true,
          ...options,
          parse_mode: undefined,
        });
      } catch (retryError) {
        logger.error(`${this.moduleName} 메시지 편집 재시도 실패:`, retryError);
        throw retryError;
      }
    }
  }

  // ===== 📊 모니터링 & 헬스체크 =====

  /**
   * 헬스체크
   */
  async healthCheck() {
    try {
      const health = {
        status: "healthy",
        module: this.moduleName,
        timestamp: TimeHelper.getLogTimeString(),
        stats: this.getStats(),
        memory: {
          userStates: this.userStates.size,
          actionMap: this.actionMap.size,
        },
      };

      // 상태 검증
      if (this.userStates.size > this.config.maxUserStates * 0.9) {
        health.status = "warning";
        health.message = "사용자 상태 메모리 사용량이 높습니다";
      }

      if (this.stats.errorsCount > 10) {
        health.status = "degraded";
        health.message = "에러 발생 횟수가 많습니다";
      }

      return health;
    } catch (error) {
      return {
        status: "error",
        module: this.moduleName,
        message: error.message,
        timestamp: TimeHelper.getLogTimeString(),
      };
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      userStates: this.userStates.size,
      actionCount: this.actionMap.size,
      isInitialized: this.isInitialized,
      lastActivity: this.lastActivity,
      uptime: this.stats.createdAt
        ? TimeHelper.now() - this.stats.createdAt
        : 0,
    };
  }

  /**
   * 상세 통계 조회
   */
  getDetailedStats() {
    const stats = this.getStats();

    return {
      ...stats,
      performance: {
        successRate:
          this.stats.callbacksHandled > 0
            ? (
                ((this.stats.callbacksHandled +
                  this.stats.messagesHandled -
                  this.stats.errorsCount) /
                  (this.stats.callbacksHandled + this.stats.messagesHandled)) *
                100
              ).toFixed(2)
            : 100,
        errorRate:
          (this.stats.errorsCount /
            Math.max(
              1,
              this.stats.callbacksHandled + this.stats.messagesHandled
            )) *
          100,
        avgResponseTime: this.lastActivity ? Date.now() - this.lastActivity : 0,
      },
      config: this.config,
      userStatesDetail: {
        total: this.userStates.size,
        maxAllowed: this.config.maxUserStates,
        utilizationPercent: (
          (this.userStates.size / this.config.maxUserStates) *
          100
        ).toFixed(2),
      },
    };
  }

  // ===== 🧹 정리 작업 =====

  /**
   * 리소스 정리
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName} 정리 시작...`);

      // 상태 정리 스케줄러 중지
      if (this.stateCleanupInterval) {
        clearInterval(this.stateCleanupInterval);
        this.stateCleanupInterval = null;
      }

      // 사용자 상태 정리
      this.userStates.clear();

      // 액션 맵 정리
      this.actionMap.clear();

      // 자식 클래스의 정리 로직
      if (this.onCleanup) {
        await this.onCleanup();
      }

      logger.success(`✅ ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 실패:`, error);
      throw error;
    }
  }

  /**
   * 자식 클래스에서 구현할 정리 메서드
   */
  async onCleanup() {
    // 자식 클래스에서 구현
  }

  // ===== 🎯 표준 응답 데이터 생성기들 =====

  /**
   * 메뉴 응답 데이터 생성
   */
  createMenuResponse(data = {}, options = {}) {
    return {
      type: "menu",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      data: {
        title: options.title || `${this.moduleName} 메뉴`,
        description: options.description || "",
        items: data.items || [],
        stats: data.stats || {},
        ...data,
      },
      ui: {
        showBackButton: options.showBackButton !== false,
        showRefreshButton: options.showRefreshButton || false,
        maxItemsPerPage: options.maxItemsPerPage || 5,
      },
    };
  }

  /**
   * 리스트 응답 데이터 생성
   */
  createListResponse(items = [], options = {}) {
    return {
      type: "list",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      data: {
        items: items,
        total: items.length,
        page: options.page || 1,
        pageSize: options.pageSize || 5,
        hasMore: options.hasMore || false,
      },
      ui: {
        showAddButton: options.showAddButton !== false,
        showSearchButton: options.showSearchButton || false,
        showSortButton: options.showSortButton || false,
        emptyMessage: options.emptyMessage || "항목이 없습니다",
      },
    };
  }

  /**
   * 폼 응답 데이터 생성
   */
  createFormResponse(formData = {}, options = {}) {
    return {
      type: "form",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      data: {
        title: formData.title || "입력",
        fields: formData.fields || [],
        currentStep: formData.currentStep || 1,
        totalSteps: formData.totalSteps || 1,
        validation: formData.validation || {},
      },
      ui: {
        showCancelButton: options.showCancelButton !== false,
        showProgressBar: options.showProgressBar || false,
        submitText: options.submitText || "완료",
      },
    };
  }

  /**
   * 성공 응답 데이터 생성
   */
  createSuccessResponse(message, data = {}, options = {}) {
    return {
      type: "success",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      message: message,
      data: data,
      ui: {
        showContinueButton: options.showContinueButton || false,
        showMenuButton: options.showMenuButton !== false,
        autoClose: options.autoClose || false,
        closeDelay: options.closeDelay || 3000,
      },
    };
  }

  /**
   * 에러 응답 데이터 생성
   */
  createErrorResponse(message, error = null, options = {}) {
    return {
      type: "error",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      message: message,
      error: error
        ? {
            message: error.message,
            code: error.code || "UNKNOWN",
          }
        : null,
      ui: {
        showRetryButton: options.showRetryButton !== false,
        showMenuButton: options.showMenuButton !== false,
        showReportButton: options.showReportButton || false,
      },
    };
  }

  /**
   * 로딩 응답 데이터 생성
   */
  createLoadingResponse(message = "처리 중...", options = {}) {
    return {
      type: "loading",
      module: this.moduleName,
      timestamp: TimeHelper.getLogTimeString(),
      message: message,
      ui: {
        showSpinner: options.showSpinner !== false,
        showProgress: options.showProgress || false,
        progress: options.progress || 0,
        cancelable: options.cancelable || false,
      },
    };
  }

  // ===== 🎯 데이터 검증 헬퍼들 =====

  /**
   * 사용자 입력 검증
   */
  validateUserInput(input, rules = {}) {
    const errors = [];

    // 필수 입력 확인
    if (rules.required && (!input || input.trim().length === 0)) {
      errors.push("필수 입력 항목입니다");
    }

    // 길이 확인
    if (input && rules.minLength && input.length < rules.minLength) {
      errors.push(`최소 ${rules.minLength}자 이상 입력해주세요`);
    }

    if (input && rules.maxLength && input.length > rules.maxLength) {
      errors.push(`최대 ${rules.maxLength}자까지 입력 가능합니다`);
    }

    // 패턴 확인
    if (input && rules.pattern && !rules.pattern.test(input)) {
      errors.push(rules.patternMessage || "형식이 올바르지 않습니다");
    }

    // 커스텀 검증
    if (input && rules.customValidator) {
      const customError = rules.customValidator(input);
      if (customError) {
        errors.push(customError);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      cleanInput: input ? input.trim() : "",
    };
  }

  /**
   * 페이지네이션 계산
   */
  calculatePagination(items, page = 1, pageSize = 5) {
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);

    return {
      items: items.slice(startIndex, endIndex),
      pagination: {
        currentPage,
        totalPages,
        pageSize,
        total,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        startIndex: startIndex + 1,
        endIndex,
      },
    };
  }

  /**
   * 텍스트 포맷팅 (안전한 마크다운)
   */
  formatText(text, options = {}) {
    if (!text) return "";

    let formatted = text.toString();

    // 이스케이프 처리
    if (options.escape !== false) {
      formatted = formatted
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/`/g, "\\`")
        .replace(/~/g, "\\~")
        .replace(/\|/g, "\\|");
    }

    // 길이 제한
    if (options.maxLength && formatted.length > options.maxLength) {
      formatted = formatted.substring(0, options.maxLength - 3) + "...";
    }

    // 줄바꿈 처리
    if (options.preserveNewlines === false) {
      formatted = formatted.replace(/\n/g, " ");
    }

    return formatted;
  }

  // ===== 🔧 개발 도구 =====

  /**
   * 디버그 정보 출력
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV === "development") {
      logger.debug(`[${this.moduleName}] ${message}`, data);
    }
  }

  /**
   * 성능 측정 시작
   */
  startTimer(label = "default") {
    if (!this._timers) {
      this._timers = new Map();
    }
    this._timers.set(label, Date.now());
  }

  /**
   * 성능 측정 종료
   */
  endTimer(label = "default") {
    if (!this._timers || !this._timers.has(label)) {
      return 0;
    }

    const elapsed = Date.now() - this._timers.get(label);
    this._timers.delete(label);

    this.debug(`Timer [${label}]: ${elapsed}ms`);
    return elapsed;
  }

  /**
   * 메모리 사용량 확인
   */
  getMemoryUsage() {
    return {
      userStates: this.userStates.size,
      actionMap: this.actionMap.size,
      moduleMemory: process.memoryUsage(),
    };
  }
}

module.exports = BaseModule;
