// ErrorHandler.js - 통합 에러 처리 유틸리티

const logger = require("./Logger");

/**
 * 모듈 에러 처리 표준 유틸리티
 */
class ErrorHandler {
  /**
   * 표준 에러 처리
   * @param {string} moduleName - 모듈 이름
   * @param {string} operation - 작업명 (예: "초기화", "할일 생성")
   * @param {Error} error - 에러 객체
   * @param {Object} context - 추가 컨텍스트
   * @returns {Object} 표준화된 에러 정보
   */
  static handle(moduleName, operation, error, context = {}) {
    const errorInfo = {
      module: moduleName,
      operation: operation,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    };

    // 에러 레벨에 따른 로깅
    const logLevel = this.getLogLevel(error);
    const emoji = this.getErrorEmoji(operation);

    logger[logLevel](`${emoji} ${moduleName} ${operation} 실패:`, error);

    return errorInfo;
  }

  /**
   * 사용자 친화적 에러 메시지 생성
   * @param {string} moduleName - 모듈 이름
   * @param {string} operation - 작업명
   * @param {Error} error - 에러 객체
   * @returns {string} 사용자 메시지
   */
  static getUserMessage(moduleName, operation, error) {
    const moduleDisplayNames = {
      todo: "할일",
      timer: "타이머",
      worktime: "근무시간",
      leave: "휴가",
      fortune: "운세",
      weather: "날씨",
      tts: "음성변환",
      system: "시스템"
    };

    const operationDisplayNames = {
      초기화: "시작",
      "할일 생성": "할일 추가",
      "할일 완료": "할일 완료",
      "할일 삭제": "할일 삭제",
      "출근 처리": "출근",
      "퇴근 처리": "퇴근",
      "타이머 시작": "타이머 시작",
      "운세 조회": "운세 보기"
    };

    const displayModule =
      moduleDisplayNames[moduleName.toLowerCase()] || moduleName;
    const displayOperation = operationDisplayNames[operation] || operation;

    // 알려진 에러 패턴 처리
    if (error.message.includes("timeout")) {
      return `⏰ ${displayOperation} 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.`;
    }

    if (error.message.includes("network")) {
      return `🌐 네트워크 연결을 확인하고 다시 시도해주세요.`;
    }

    if (
      error.message.includes("permission") ||
      error.message.includes("권한")
    ) {
      return `🔒 권한이 없습니다. 관리자에게 문의하세요.`;
    }

    if (
      error.message.includes("not found") ||
      error.message.includes("찾을 수 없")
    ) {
      return `❓ 요청한 항목을 찾을 수 없습니다.`;
    }

    if (
      error.message.includes("already exists") ||
      error.message.includes("이미 존재")
    ) {
      return `⚠️ 이미 존재합니다.`;
    }

    // 기본 메시지
    return `❌ ${displayModule} ${displayOperation} 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`;
  }

  /**
   * 모듈별 표준 에러 처리
   * @param {string} moduleName - 모듈 이름
   * @param {string} operation - 작업명
   * @param {Error} error - 에러 객체
   * @param {Object} options - 옵션
   * @returns {Object} 처리 결과
   */
  static processModuleError(moduleName, operation, error, options = {}) {
    const {
      throwError = false,
      returnUserMessage = false,
      logContext = {},
      eventBus = null,
      chatId = null
    } = options;

    // 에러 정보 수집
    const errorInfo = this.handle(moduleName, operation, error, logContext);

    // EventBus로 에러 발행 (시스템 모니터링용)
    if (eventBus) {
      eventBus.publish("system:error", errorInfo).catch((err) => {
        logger.error("에러 이벤트 발행 실패:", err);
      });
    }

    // 사용자 메시지 생성
    const userMessage = this.getUserMessage(moduleName, operation, error);

    // 사용자에게 에러 메시지 전송 (렌더링)
    if (eventBus && chatId) {
      eventBus
        .publish("render:error:request", {
          chatId,
          error: userMessage,
          module: moduleName
        })
        .catch((err) => {
          logger.error("에러 메시지 렌더링 실패:", err);
        });
    }

    // 결과 반환
    const result = {
      success: false,
      error: errorInfo,
      userMessage
    };

    // 에러 재발생 여부
    if (throwError) {
      throw error;
    }

    // 사용자 메시지만 반환
    if (returnUserMessage) {
      return userMessage;
    }

    return result;
  }

  /**
   * 에러 레벨 결정
   * @param {Error} error - 에러 객체
   * @returns {string} 로그 레벨
   */
  static getLogLevel(error) {
    // 시스템 에러
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("Database")
    ) {
      return "error";
    }

    // 사용자 입력 에러
    if (
      error.message.includes("validation") ||
      error.message.includes("invalid")
    ) {
      return "warn";
    }

    // 기본 에러
    return "error";
  }

  /**
   * 작업별 이모지 반환
   * @param {string} operation - 작업명
   * @returns {string} 이모지
   */
  static getErrorEmoji(operation) {
    const emojiMap = {
      초기화: "💥",
      "할일 생성": "📝",
      "할일 완료": "✅",
      "할일 삭제": "🗑️",
      "출근 처리": "🏢",
      "퇴근 처리": "🏁",
      "타이머 시작": "⏰",
      "운세 조회": "🔮",
      "날씨 조회": "🌤️",
      "음성 변환": "🔊"
    };

    return emojiMap[operation] || "❌";
  }

  /**
   * 비동기 작업 래퍼 (에러 자동 처리)
   * @param {string} moduleName - 모듈 이름
   * @param {string} operation - 작업명
   * @param {Function} asyncFn - 비동기 함수
   * @param {Object} options - 에러 처리 옵션
   * @returns {Promise} 결과
   */
  static async wrap(moduleName, operation, asyncFn, options = {}) {
    try {
      const result = await asyncFn();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return this.processModuleError(moduleName, operation, error, options);
    }
  }

  /**
   * 에러 발생률 모니터링 (간단한 메모리 기반)
   */
  static errorStats = new Map();

  static recordError(moduleName, operation) {
    const key = `${moduleName}:${operation}`;
    const current = this.errorStats.get(key) || { count: 0, lastError: null };
    current.count++;
    current.lastError = new Date();
    this.errorStats.set(key, current);
  }

  static getErrorStats(moduleName = null) {
    if (!moduleName) {
      return Object.fromEntries(this.errorStats);
    }

    const moduleStats = {};
    this.errorStats.forEach((stats, key) => {
      if (key.startsWith(`${moduleName}:`)) {
        moduleStats[key] = stats;
      }
    });

    return moduleStats;
  }
}

module.exports = ErrorHandler;
