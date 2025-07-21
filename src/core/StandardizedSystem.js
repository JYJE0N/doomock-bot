// src/core/StandardizedSystem.js - 중복 선언 해결 + 한국시간 통합
// Railway 환경 v3.0.1 리팩토링 표준
const logger = require("../utils/Logger");
const { TimeHelper } = require("../utils/TimeHelper");

/**
 * 🎯 표준 매개변수 정의 (절대 변경 금지!)
 * 모든 모듈의 handleMessage, handleCallback에서 이 순서를 지켜야 함
 */
const STANDARD_PARAMS = {
  // 메시지 처리: (bot, msg)
  MESSAGE_HANDLER: ["bot", "msg"],

  // 콜백 처리: (bot, callbackQuery, subAction, params, menuManager)
  CALLBACK_HANDLER: [
    "bot",
    "callbackQuery",
    "subAction",
    "params",
    "menuManager",
  ],
};

/**
 * 🚫 중복 호출 방지 시스템
 */
class DuplicationPreventer {
  constructor() {
    this.activeOperations = new Map(); // 진행 중인 작업들
    this.operationTimeouts = new Map(); // 타임아웃 추적
    this.maxTimeout = 10000; // 10초 최대 대기
    this.debugMode = process.env.NODE_ENV === "development";
  }

  // 🔒 작업 시작 (중복 체크)
  async startOperation(operationId, context = {}) {
    const now = Date.now();

    // 이미 진행 중인 작업 체크
    if (this.activeOperations.has(operationId)) {
      const startTime = this.activeOperations.get(operationId);
      const elapsed = now - startTime;

      if (elapsed < this.maxTimeout) {
        if (this.debugMode) {
          logger.warn(
            `🚫 중복 호출 차단: ${operationId} (${elapsed}ms 진행 중)`,
            context
          );
        }
        return false; // 중복 호출 차단
      } else {
        // 타임아웃된 작업 정리
        logger.warn(`⏰ 타임아웃된 작업 정리: ${operationId} (${elapsed}ms)`);
        this.endOperation(operationId);
      }
    }

    // 새 작업 등록
    this.activeOperations.set(operationId, now);

    // 자동 타임아웃 설정
    const timeoutId = setTimeout(() => {
      logger.warn(`⏰ 작업 타임아웃: ${operationId}`);
      this.endOperation(operationId);
    }, this.maxTimeout);

    this.operationTimeouts.set(operationId, timeoutId);

    if (this.debugMode) {
      logger.debug(`✅ 작업 시작: ${operationId}`, context);
    }

    return true; // 진행 허가
  }

  // 🔓 작업 완료
  endOperation(operationId) {
    if (this.activeOperations.has(operationId)) {
      const startTime = this.activeOperations.get(operationId);
      const duration = Date.now() - startTime;

      // 작업 제거
      this.activeOperations.delete(operationId);

      // 타임아웃 정리
      if (this.operationTimeouts.has(operationId)) {
        clearTimeout(this.operationTimeouts.get(operationId));
        this.operationTimeouts.delete(operationId);
      }

      if (this.debugMode) {
        logger.debug(`✅ 작업 완료: ${operationId} (${duration}ms)`);
      }
    }
  }

  // 📊 현재 상태 조회
  getStatus() {
    const now = Date.now();
    const activeOps = Array.from(this.activeOperations.entries()).map(
      ([id, startTime]) => ({
        id,
        duration: now - startTime,
        isTimedOut: now - startTime > this.maxTimeout,
      })
    );

    return {
      activeCount: this.activeOperations.size,
      activeOperations: activeOps,
      timeoutCount: activeOps.filter((op) => op.isTimedOut).length,
    };
  }

  // 🧹 정리 작업
  cleanup() {
    // 모든 타임아웃 정리
    for (const timeoutId of this.operationTimeouts.values()) {
      clearTimeout(timeoutId);
    }

    this.activeOperations.clear();
    this.operationTimeouts.clear();

    logger.info("🧹 DuplicationPreventer 정리 완료");
  }
}

/**
 * 🎯 표준화된 매개변수 검증기
 */
class ParameterValidator {
  // 메시지 핸들러 매개변수 검증
  static validateMessageParams(bot, msg) {
    const errors = [];

    if (!bot || typeof bot.sendMessage !== "function") {
      errors.push("bot 매개변수가 유효하지 않음");
    }

    if (!msg || !msg.chat || !msg.from) {
      errors.push("msg 매개변수가 유효하지 않음");
    }

    if (errors.length > 0) {
      throw new Error(`메시지 핸들러 매개변수 오류: ${errors.join(", ")}`);
    }

    return true;
  }

  // 콜백 핸들러 매개변수 검증
  static validateCallbackParams(
    bot,
    callbackQuery,
    subAction,
    params,
    menuManager
  ) {
    const errors = [];

    if (!bot || typeof bot.answerCallbackQuery !== "function") {
      errors.push("bot 매개변수가 유효하지 않음");
    }

    if (!callbackQuery || !callbackQuery.message || !callbackQuery.from) {
      errors.push("callbackQuery 매개변수가 유효하지 않음");
    }

    if (typeof subAction !== "string") {
      errors.push("subAction은 문자열이어야 함");
    }

    if (params && typeof params !== "object") {
      errors.push("params는 객체여야 함");
    }

    // menuManager는 선택적이므로 null 허용

    if (errors.length > 0) {
      throw new Error(`콜백 핸들러 매개변수 오류: ${errors.join(", ")}`);
    }

    return true;
  }
}

/**
 * 🎯 표준화된 베이스 모듈 (모든 모듈이 상속해야 함)
 * ⚠️ 주의: 파일 내에서 단 한 번만 선언!
 */
class StandardizedBaseModule {
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;
    this.options = options;

    // 🚫 중복 방지 시스템
    this.duplicationPreventer = new DuplicationPreventer();
    // ⏰ TimeHelper 설정 (인스턴스가 아닌 클래스 직접 사용)
    this.timeHelper = TimeHelper; // ✅ TimeHelper 추가

    // 📊 통계
    this.stats = {
      messageCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastActivity: null,
    };

    // 🎯 액션 맵 (모든 모듈에서 사용)
    this.actionMap = new Map();

    // 🔄 초기화 상태
    this.isInitialized = false;

    logger.info(`🎯 ${moduleName} 표준화 모듈 생성됨`);
  }

  // ✅ 표준 초기화
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.moduleName} 이미 초기화됨`);
      return;
    }

    try {
      // 시간 정보 로깅 (개발 환경에서만)
      if (process.env.NODE_ENV === "development") {
        logger.debug(
          `${this.moduleName} 시간 정보:`,
          TimeHelper.getDebugInfo() // ✅ 직접 호출
        );
      }

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString(); // ✅ 올바른 메서드명

      logger.success(`✅ ${this.moduleName} 표준 초기화 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 초기화 실패:`, error);
      throw error;
    }
  }

  // 🎯 표준 메시지 핸들러 (모든 모듈에서 오버라이드)
  async handleMessage(bot, msg) {
    // 🔒 매개변수 검증
    ParameterValidator.validateMessageParams(bot, msg);

    // 🚫 중복 호출 방지
    const operationId = TimeHelper.generateOperationId(
      // ✅ TimeHelper 직접 사용
      "message",
      msg.from.id,
      `_${this.moduleName}`
    );

    if (
      !(await this.duplicationPreventer.startOperation(operationId, {
        module: this.moduleName,
        userId: msg.from.id,
        messageId: msg.message_id,
      }))
    ) {
      return false; // 중복 호출 차단
    }

    try {
      // 통계 업데이트
      this.stats.messageCount++;
      this.stats.lastActivity = TimeHelper.getLogTimeString(); // ✅ 올바른 메서드명

      // 실제 처리 (하위 클래스에서 구현)
      const result = await this._processMessage(bot, msg);

      return result;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 메시지 처리 오류:`, error);
      throw error;
    } finally {
      // 🔓 작업 완료
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 🎯 표준 콜백 핸들러 (모든 모듈에서 오버라이드)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // 🔒 매개변수 검증
    ParameterValidator.validateCallbackParams(
      bot,
      callbackQuery,
      subAction,
      params,
      menuManager
    );

    // 🚫 중복 호출 방지
    const operationId = TimeHelper.generateOperationId(
      // ✅ TimeHelper 직접 사용
      "callback",
      callbackQuery.from.id,
      `_${this.moduleName}_${subAction}`
    );

    if (
      !(await this.duplicationPreventer.startOperation(operationId, {
        module: this.moduleName,
        userId: callbackQuery.from.id,
        action: subAction,
      }))
    ) {
      return false; // 중복 호출 차단
    }

    try {
      // 통계 업데이트
      this.stats.callbackCount++;
      this.stats.lastActivity = TimeHelper.getLogTimeString(); // ✅ 올바른 메서드명

      // 실제 처리 (하위 클래스에서 구현)
      const result = await this._processCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        menuManager
      );

      return result;
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ ${this.moduleName} 콜백 처리 오류:`, error);
      throw error;
    } finally {
      // 🔓 작업 완료
      this.duplicationPreventer.endOperation(operationId);
    }
  }

  // 🎯 하위 클래스에서 구현해야 하는 메서드들 (추상 메서드)
  async _processMessage(bot, msg) {
    throw new Error(
      `${this.moduleName}에서 _processMessage 메서드를 구현해야 합니다`
    );
  }

  async _processCallback(bot, callbackQuery, subAction, params, menuManager) {
    throw new Error(
      `${this.moduleName}에서 _processCallback 메서드를 구현해야 합니다`
    );
  }

  // 📊 모듈 상태 조회
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      stats: this.stats,
      duplicationStatus: this.duplicationPreventer.getStatus(),
      timeInfo: {
        lastActivity: this.stats.lastActivity,
        currentTime: TimeHelper.getLogTimeString(), // ✅ 올바른 메서드명
      },
    };
  }

  // 🧹 정리 작업
  async cleanup() {
    try {
      this.duplicationPreventer.cleanup();
      this.timeManager.cleanup();
      logger.info(`🧹 ${this.moduleName} 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName} 정리 중 오류:`, error);
    }
  }
}

// 🌍 전역 표준화 시스템 (깔끔한 export)
module.exports = {
  STANDARD_PARAMS,
  DuplicationPreventer,
  ParameterValidator,
  StandardizedBaseModule,
};
