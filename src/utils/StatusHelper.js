// ========================================
// 🎯 src/utils/StatusHelper.js
// ========================================
// 복잡한 JSON 대신 간단한 상태 텍스트로!
// ========================================

/**
 * 🎯 간단한 상태 변환기
 *
 * 복잡한 JSON 객체 → 간단한 한 줄 텍스트
 */
class StatusHelper {
  /**
   * 📊 상태 객체를 간단한 텍스트로 변환
   */
  static getSimpleStatus(status) {
    if (!status || typeof status !== "object") {
      return status || "알 수 없음";
    }

    if (status.isInitialized === false) return "준비 중";
    if (status.serviceStatus === "Not Connected") return "연결 대기";
    if (status.serviceConnected === false) return "연결 대기";
    if (status.isConnected === false) return "연결 대기";
    if (status.serviceStatus === "Ready" || status.serviceConnected === true || status.isConnected === true) return "준비됨";
    if (status.isInitialized === true) return "준비됨";
    if (status.moduleName) return "활성";

    return "알 수 없음";
  }

  /**
   * 🎨 상태별 이모지 추가
   */
  static getStatusWithEmoji(status) {
    const simpleStatus = this.getSimpleStatus(status);

    const emojiMap = {
      준비됨: "✅ 준비됨",
      "준비 중": "⏳ 준비 중",
      "연결 대기": "🔌 연결 대기",
      활성: "🟢 활성",
      "알 수 없음": "❓ 알 수 없음"
    };

    return emojiMap[simpleStatus] || `📦 ${simpleStatus}`;
  }

  /**
   * 🎯 모듈별 상태 로그 (한 줄로!)
   */
  static logModuleStatus(logger, moduleName, status) {
    const simpleStatus = this.getStatusWithEmoji(status);
    logger.info(`📦 ${moduleName}: ${simpleStatus}`);
  }

  /**
   * 📊 전체 모듈 상태 요약 (깔끔하게!)
   */
  static logSystemSummary(logger, moduleStatuses) {
    logger.info("📊 ═══ 시스템 상태 ═══");

    for (const [moduleName, status] of Object.entries(moduleStatuses)) {
      const simpleStatus = this.getSimpleStatus(status);
      logger.info(`   📦 ${moduleName}: ${simpleStatus}`);
    }

    logger.info("📊 ═══════════════════");
  }
}

// ========================================
// 🔌 기존 Logger에 간단히 추가하는 함수
// ========================================

/**
 * 🔌 Logger에 간단한 상태 로깅 기능 추가
 */
function enhanceLoggerWithSimpleStatus(logger) {
  // 🎯 간단한 모듈 상태 로그
  logger.moduleStatus = (moduleName, status) => {
    StatusHelper.logModuleStatus(logger, moduleName, status);
  };

  // 📊 시스템 상태 요약
  logger.systemSummary = (moduleStatuses) => {
    StatusHelper.logSystemSummary(logger, moduleStatuses);
  };

  // 🎯 상태 변환 유틸리티
  logger.getSimpleStatus = StatusHelper.getSimpleStatus;
  logger.getStatusWithEmoji = StatusHelper.getStatusWithEmoji;

  return logger;
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  StatusHelper,
  enhanceLoggerWithSimpleStatus
};
