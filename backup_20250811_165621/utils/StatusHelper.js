// src/utils/StatusHelper.js - 강화된 상태 헬퍼 v2.0
const logger = require("./Logger");

/**
 * 🎯 StatusHelper v2.0 - 고급 상태 관리 유틸리티
 *
 * ✨ 새로운 기능:
 * - 더 많은 상태 패턴 지원
 * - 건강도 점수 계산
 * - 상태 변화 추적
 * - 알림 및 경고 시스템
 * - SystemModule/SystemRenderer와 완벽 통합
 *
 * 🎭 기존 기능 유지:
 * - 복잡한 JSON → 간단한 텍스트 변환
 * - 이모지 상태 표시
 * - Logger 통합
 */
class StatusHelper {
  // ===== 🎯 기존 핵심 기능들 (개선) =====

  /**
   * 📊 상태 객체를 간단한 텍스트로 변환 (기존 + 대폭 강화!)
   */
  static getSimpleStatus(status) {
    if (!status) {
      return "알 수 없음";
    }

    // 문자열이면 그대로 반환
    if (typeof status === "string") {
      return this.normalizeStatusText(status);
    }

    // 숫자면 점수로 해석
    if (typeof status === "number") {
      return this.scoreToStatus(status);
    }

    // 불린이면 단순 변환
    if (typeof status === "boolean") {
      return status ? "활성" : "비활성";
    }

    // 객체가 아니면 문자열로 변환
    if (typeof status !== "object") {
      return String(status) || "알 수 없음";
    }

    // ===== 🔍 객체 상태 분석 (기존 + 확장) =====

    // 에러 상태 우선 체크
    if (status.error || status.hasError) {
      return "오류";
    }

    // 초기화 상태 체크 (기존 + 강화)
    if (status.isInitialized === false || status.initialized === false) {
      return "준비 중";
    }
    if (status.isInitialized === true || status.initialized === true) {
      return "준비됨";
    }

    // 연결 상태 체크 (기존 + 확장)
    if (
      status.serviceStatus === "Not Connected" ||
      status.serviceConnected === false ||
      status.isConnected === false ||
      status.connected === false
    ) {
      return "연결 대기";
    }
    if (
      status.serviceStatus === "Ready" ||
      status.serviceConnected === true ||
      status.isConnected === true ||
      status.connected === true
    ) {
      return "준비됨";
    }

    // 건강도 점수 기반 상태 (새로 추가!)
    if (typeof status.health === "number") {
      return this.scoreToStatus(status.health);
    }
    if (status.healthScore || status.score) {
      return this.scoreToStatus(status.healthScore || status.score);
    }

    // 상태 필드 체크 (새로 추가!)
    if (status.status) {
      return this.normalizeStatusText(status.status);
    }
    if (status.state) {
      return this.normalizeStatusText(status.state);
    }

    // 활성 상태 체크 (기존 + 확장)
    if (status.active === true || status.isActive === true) {
      return "활성";
    }
    if (status.active === false || status.isActive === false) {
      return "비활성";
    }

    // 실행 상태 체크 (새로 추가!)
    if (status.running === true || status.isRunning === true) {
      return "실행 중";
    }
    if (status.running === false || status.isRunning === false) {
      return "중지됨";
    }

    // 모듈명이 있으면 활성으로 간주 (기존)
    if (status.moduleName || status.name) {
      return "활성";
    }

    // 타임스탬프가 최근이면 활성 (새로 추가!)
    if (status.lastActivity || status.timestamp) {
      const timestamp = new Date(status.lastActivity || status.timestamp);
      const now = new Date();
      const diffMinutes = (now - timestamp) / 60000;

      if (diffMinutes < 5) return "활성";
      if (diffMinutes < 30) return "유휴";
      return "비활성";
    }

    // 기본값
    return "알 수 없음";
  }

  /**
   * 🔢 점수를 상태 텍스트로 변환 (새로 추가!)
   */
  static scoreToStatus(score) {
    if (score >= 90) return "최고";
    if (score >= 80) return "우수";
    if (score >= 70) return "양호";
    if (score >= 60) return "보통";
    if (score >= 40) return "주의";
    if (score >= 20) return "경고";
    return "위험";
  }

  /**
   * 📝 상태 텍스트 정규화 (새로 추가!)
   */
  static normalizeStatusText(text) {
    if (!text) return "알 수 없음";

    const statusMap = {
      // 영어 → 한국어
      healthy: "정상",
      good: "양호",
      warning: "주의",
      error: "오류",
      critical: "위험",
      unknown: "알 수 없음",
      active: "활성",
      inactive: "비활성",
      running: "실행 중",
      stopped: "중지됨",
      paused: "일시정지",
      ready: "준비됨",
      loading: "로딩 중",
      connecting: "연결 중",
      connected: "연결됨",
      disconnected: "연결 끊김",

      // 상태 변형들
      ok: "정상",
      fail: "실패",
      success: "성공",
      pending: "대기 중",
      processing: "처리 중",
      completed: "완료",
      cancelled: "취소됨"
    };

    const normalized = text.toString().toLowerCase().trim();
    return statusMap[normalized] || text;
  }

  /**
   * 🎨 상태별 이모지 추가 (기존 + 대폭 확장!)
   */
  static getStatusWithEmoji(status) {
    const simpleStatus = this.getSimpleStatus(status);

    const emojiMap = {
      // 기존
      준비됨: "✅ 준비됨",
      "준비 중": "⏳ 준비 중",
      "연결 대기": "🔌 연결 대기",
      활성: "🟢 활성",
      "알 수 없음": "❓ 알 수 없음",

      // 새로 추가
      최고: "🏆 최고",
      우수: "🌟 우수",
      양호: "✅ 양호",
      보통: "🟡 보통",
      주의: "⚠️ 주의",
      경고: "🟠 경고",
      위험: "🔴 위험",
      정상: "💚 정상",
      오류: "❌ 오류",
      비활성: "⚪ 비활성",
      "실행 중": "🔄 실행 중",
      중지됨: "⏹️ 중지됨",
      일시정지: "⏸️ 일시정지",
      "로딩 중": "⏳ 로딩 중",
      "연결 중": "🔗 연결 중",
      연결됨: "🔗 연결됨",
      "연결 끊김": "🔌 연결 끊김",
      유휴: "😴 유휴",
      성공: "✅ 성공",
      실패: "❌ 실패",
      "대기 중": "⏳ 대기 중",
      "처리 중": "⚙️ 처리 중",
      완료: "✅ 완료",
      취소됨: "🚫 취소됨"
    };

    return emojiMap[simpleStatus] || `📦 ${simpleStatus}`;
  }

  // ===== 🆕 새로운 고급 기능들 =====

  /**
   * 🏥 상태 건강도 점수 계산 (새로 추가!)
   */
  static calculateHealthScore(status) {
    if (!status || typeof status !== "object") {
      return 0;
    }

    let score = 50; // 기본 점수

    // 초기화 상태 (+30점)
    if (status.isInitialized === true || status.initialized === true) {
      score += 30;
    }

    // 연결 상태 (+20점)
    if (status.isConnected === true || status.connected === true) {
      score += 20;
    }

    // 활성 상태 (+10점)
    if (status.active === true || status.isActive === true) {
      score += 10;
    }

    // 에러 상태 (-50점)
    if (status.error || status.hasError) {
      score -= 50;
    }

    // 최근 활동 (+10점)
    if (status.lastActivity) {
      const timestamp = new Date(status.lastActivity);
      const now = new Date();
      const diffMinutes = (now - timestamp) / 60000;

      if (diffMinutes < 5) score += 10;
      else if (diffMinutes < 30) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 📊 다중 상태 요약 (새로 추가!)
   */
  static summarizeMultipleStatuses(statuses) {
    if (!statuses || typeof statuses !== "object") {
      return { overall: "알 수 없음", details: [] };
    }

    const details = [];
    let totalScore = 0;
    let count = 0;
    let hasError = false;
    let hasWarning = false;

    for (const [name, status] of Object.entries(statuses)) {
      const simple = this.getSimpleStatus(status);
      const score = this.calculateHealthScore(status);

      details.push({
        name,
        status: simple,
        emoji: this.getStatusWithEmoji(status),
        score
      });

      totalScore += score;
      count++;

      if (simple === "오류" || simple === "위험") hasError = true;
      if (simple === "주의" || simple === "경고") hasWarning = true;
    }

    const averageScore = count > 0 ? Math.round(totalScore / count) : 0;

    let overall = "정상";
    if (hasError) overall = "오류";
    else if (hasWarning) overall = "주의";
    else overall = this.scoreToStatus(averageScore);

    return {
      overall,
      overallEmoji: this.getStatusWithEmoji(overall),
      averageScore,
      details,
      summary: {
        total: count,
        healthy: details.filter((d) => d.score >= 70).length,
        warning: details.filter((d) => d.score >= 40 && d.score < 70).length,
        critical: details.filter((d) => d.score < 40).length
      }
    };
  }

  /**
   * 🚨 상태 변화 감지 (새로 추가!)
   */
  static detectStatusChange(oldStatus, newStatus) {
    const oldSimple = this.getSimpleStatus(oldStatus);
    const newSimple = this.getSimpleStatus(newStatus);

    if (oldSimple === newSimple) {
      return { changed: false, from: oldSimple, to: newSimple };
    }

    const severity = this.assessChangeSeverity(oldSimple, newSimple);

    return {
      changed: true,
      from: oldSimple,
      to: newSimple,
      severity,
      message: `${oldSimple} → ${newSimple}`,
      needsAlert: severity === "critical" || severity === "warning"
    };
  }

  /**
   * ⚠️ 변화 심각도 평가 (새로 추가!)
   */
  static assessChangeSeverity(from, to) {
    const criticalStates = ["오류", "위험", "연결 끊김"];
    const warningStates = ["주의", "경고", "연결 대기"];
    const goodStates = ["정상", "우수", "최고", "준비됨", "활성"];

    if (criticalStates.includes(to)) return "critical";
    if (goodStates.includes(from) && warningStates.includes(to))
      return "warning";
    if (warningStates.includes(from) && goodStates.includes(to))
      return "improvement";

    return "info";
  }

  // ===== 🔧 기존 Logger 통합 기능들 (유지 + 강화) =====

  /**
   * 🎯 모듈별 상태 로그 (기존 + 강화)
   */
  static logModuleStatus(logger, moduleName, status) {
    const _simple = this.getSimpleStatus(status);
    const emoji = this.getStatusWithEmoji(status);
    const score = this.calculateHealthScore(status);

    // 점수 포함 로그
    logger.info(`📦 ${moduleName}: ${emoji} (${score}점)`);
  }

  /**
   * 📊 전체 모듈 상태 요약 (기존 + 대폭 강화!)
   */
  static logSystemSummary(logger, moduleStatuses) {
    const summary = this.summarizeMultipleStatuses(moduleStatuses);

    logger.info("📊 ═══ 시스템 상태 요약 ═══");
    logger.info(
      `🏆 전체 상태: ${summary.overallEmoji} (평균 ${summary.averageScore}점)`
    );
    logger.info(
      `📈 건강한 모듈: ${summary.summary.healthy}/${summary.summary.total}개`
    );

    if (summary.summary.warning > 0) {
      logger.warn(`⚠️ 주의 필요: ${summary.summary.warning}개`);
    }

    if (summary.summary.critical > 0) {
      logger.error(`🚨 위험 상태: ${summary.summary.critical}개`);
    }

    // 개별 모듈 상태
    summary.details.forEach((detail) => {
      const icon = detail.score >= 70 ? "✅" : detail.score >= 40 ? "⚠️" : "🚨";
      logger.info(
        `   ${icon} ${detail.name}: ${detail.status} (${detail.score}점)`
      );
    });

    logger.info("📊 ═══════════════════════");
  }

  /**
   * 📱 SystemRenderer용 데이터 준비 (새로 추가!)
   */
  static prepareForRenderer(moduleStatuses) {
    const summary = this.summarizeMultipleStatuses(moduleStatuses);

    return {
      overall: {
        status: summary.overall,
        emoji: summary.overallEmoji,
        score: summary.averageScore,
        health:
          summary.averageScore >= 70
            ? "healthy"
            : summary.averageScore >= 40
              ? "warning"
              : "critical"
      },
      modules: summary.details.map((detail) => ({
        name: detail.name,
        displayName: detail.name.charAt(0).toUpperCase() + detail.name.slice(1),
        status: detail.status,
        emoji: detail.emoji,
        score: detail.score,
        healthy: detail.score >= 70
      })),
      summary: summary.summary,
      recommendations: this.generateRecommendations(summary)
    };
  }

  /**
   * 💡 개선 추천사항 생성 (새로 추가!)
   */
  static generateRecommendations(summary) {
    const recommendations = [];

    if (summary.summary.critical > 0) {
      recommendations.push(
        `🚨 ${summary.summary.critical}개 모듈이 위험 상태입니다. 즉시 점검이 필요합니다.`
      );
    }

    if (summary.summary.warning > 0) {
      recommendations.push(
        `⚠️ ${summary.summary.warning}개 모듈의 상태를 확인해보세요.`
      );
    }

    if (summary.averageScore < 60) {
      recommendations.push(
        "💊 전체 시스템 건강도가 낮습니다. 시스템 리소스를 점검하세요."
      );
    }

    if (summary.summary.healthy === summary.summary.total) {
      recommendations.push("🎉 모든 모듈이 정상 작동 중입니다! 훌륭해요!");
    }

    return recommendations;
  }
}

// ===== 🔌 기존 Logger 통합 (유지 + 강화) =====

/**
 * 🔌 Logger에 강화된 상태 로깅 기능 추가
 */
function enhanceLoggerWithSimpleStatus(logger) {
  // 기존 기능들
  logger.moduleStatus = (moduleName, status) => {
    StatusHelper.logModuleStatus(logger, moduleName, status);
  };

  logger.systemSummary = (moduleStatuses) => {
    StatusHelper.logSystemSummary(logger, moduleStatuses);
  };

  logger.getSimpleStatus = StatusHelper.getSimpleStatus;
  logger.getStatusWithEmoji = StatusHelper.getStatusWithEmoji;

  // 새로운 기능들
  logger.healthScore = (status) => {
    return StatusHelper.calculateHealthScore(status);
  };

  logger.statusChange = (oldStatus, newStatus, moduleName = "") => {
    const change = StatusHelper.detectStatusChange(oldStatus, newStatus);
    if (change.changed) {
      const prefix = moduleName ? `[${moduleName}] ` : "";
      if (change.severity === "critical") {
        logger.error(`🚨 ${prefix}심각한 상태 변화: ${change.message}`);
      } else if (change.severity === "warning") {
        logger.warn(`⚠️ ${prefix}상태 변화: ${change.message}`);
      } else if (change.severity === "improvement") {
        logger.success(`✅ ${prefix}상태 개선: ${change.message}`);
      } else {
        logger.info(`ℹ️ ${prefix}상태 변화: ${change.message}`);
      }
    }
  };

  return logger;
}

// ===== 📤 내보내기 =====

module.exports = {
  StatusHelper,
  enhanceLoggerWithSimpleStatus
};

// 초기화 로그
logger.info("🎯 StatusHelper v2.0 로드됨 - 고급 상태 관리 시스템");
