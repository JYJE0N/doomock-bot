// src/utils/ErrorHandler.js - 표준화된 클래스 기반 에러 핸들러 (v3 리팩토링)

const logger = require("./utils/Logger");
// 표준화된 에러 핸들러 클래스

class ErrorHandler {
  constructor(config = {}) {
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.instanceId = Date.now() + Math.random(); // 인스턴스 구분용

    this.errorStats = {
      total: 0,
      resolved: 0,
      unresolved: 0,
      byType: {},
      byModule: {},
      lastReset: new Date(),
    };

    this.healthStatus = {
      status: "ok", // ok, degraded, error
      lastUpdate: new Date(),
      issues: [],
    };

    // Railway 특화 설정
    this.config = {
      maxRetries: this.isRailway ? 5 : 3,
      retryDelay: this.isRailway ? 2000 : 1000,
      alertThreshold: 10,
      healthCheckInterval: 30000,
      ...config,
    };

    logger.info(`🛡️ ErrorHandler 인스턴스 초기화됨 (${this.instanceId})`);
  }

  // 🚨 메인 에러 처리
  async handleError(error, context = {}) {
    try {
      this.errorStats.total++;
      const errorType = error.constructor.name;

      // 에러 통계 업데이트
      this.errorStats.byType[errorType] =
        (this.errorStats.byType[errorType] || 0) + 1;
      if (context.module) {
        this.errorStats.byModule[context.module] =
          (this.errorStats.byModule[context.module] || 0) + 1;
      }

      logger.error(`🚨 에러 발생 (${errorType}):`, error.message);

      // 에러 유형별 처리
      const result = await this.processErrorByType(error, context);

      if (result.resolved) {
        this.errorStats.resolved++;
      } else {
        this.errorStats.unresolved++;
        await this.handleCriticalError(error, context);
      }

      return result;
    } catch (handlerError) {
      logger.error("❌ ErrorHandler 내부 오류:", handlerError);
      return { resolved: false, message: "에러 처리 중 문제가 발생했습니다." };
    }
  }

  // 🎯 에러 유형별 처리
  async processErrorByType(error, context) {
    const errorType = error.constructor.name;

    switch (errorType) {
      case "TelegramError":
        return await this.handleTelegramError(error, context);
      case "MongoNetworkError":
      case "MongoServerError":
        return await this.handleDatabaseError(error, context);
      case "ValidationError":
        return await this.handleValidationError(error, context);
      case "TimeoutError":
        return await this.handleTimeoutError(error, context);
      default:
        return await this.handleGenericError(error, context);
    }
  }

  // 📱 텔레그램 에러 처리
  async handleTelegramError(error, context) {
    if (error.response?.body?.error_code === 409) {
      logger.warn("🔄 409 충돌 감지 - 폴링 재시작 시도");
      return { resolved: true, message: "텔레그램 충돌이 해결되었습니다." };
    }

    if (error.response?.body?.error_code === 429) {
      logger.warn("⏳ 429 Rate Limit - 잠시 대기");
      await this.sleep(5000);
      return { resolved: true, message: "요청 제한으로 잠시 대기했습니다." };
    }

    return { resolved: false, message: "텔레그램 서비스 오류입니다." };
  }

  // 🗄️ 데이터베이스 에러 처리
  async handleDatabaseError(error, context) {
    logger.error("🔌 데이터베이스 연결 오류:", error.message);

    try {
      const { DatabaseManager } = require("../database/DatabaseManager");
      await DatabaseManager.reconnect();
      return { resolved: true, message: "데이터베이스 연결이 복구되었습니다." };
    } catch (reconnectError) {
      logger.error("❌ 데이터베이스 재연결 실패:", reconnectError);
      return {
        resolved: false,
        message: "데이터베이스 연결에 문제가 있습니다.",
      };
    }
  }

  // 📝 검증 에러 처리
  async handleValidationError(error, context) {
    logger.warn("📝 입력 검증 오료:", error.message);
    return {
      resolved: true,
      message: `입력 오류: ${error.message}`,
    };
  }

  // ⏰ 타임아웃 에러 처리
  async handleTimeoutError(error, context) {
    logger.warn("⏰ 요청 타임아웃:", error.message);
    return {
      resolved: true,
      message: "요청 시간이 초과되었습니다. 다시 시도해주세요.",
    };
  }

  // 🔧 일반 에러 처리
  async handleGenericError(error, context) {
    logger.error("🚨 일반 에러:", error);
    return {
      resolved: false,
      message: "예상치 못한 오류가 발생했습니다.",
    };
  }

  // 🚨 크리티컬 에러 처리
  async handleCriticalError(error, context) {
    this.healthStatus.status = "error";
    this.healthStatus.issues.push(`크리티컬 에러: ${error.message}`);
    this.healthStatus.lastUpdate = new Date();

    logger.error("🚨 크리티컬 에러 감지:", error);

    // Railway 관리자에게 알림
    await this.triggerAlert("critical_error", {
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }

  // 📢 알림 전송
  async triggerAlert(type, data) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (!adminChatId) return;

    try {
      const alertMessage = this.formatAlertMessage(type, data);
      logger.info("📢 관리자 알림:", alertMessage);
    } catch (error) {
      logger.error("📢 알림 전송 실패:", error);
    }
  }

  // 📝 알림 메시지 포맷
  formatAlertMessage(type, data) {
    const timestamp = data.timestamp.toLocaleString();

    switch (type) {
      case "critical_error":
        return `🚨 크리티컬 에러 발생\n\n⏰ 시간: ${timestamp}\n❌ 오류: ${data.error}`;
      default:
        return `⚠️ 시스템 알림\n\n⏰ 시간: ${timestamp}\n📝 내용: ${JSON.stringify(
          data
        )}`;
    }
  }

  // 💓 헬스 상태 조회
  getHealthSummary() {
    const successRate =
      this.errorStats.total > 0
        ? ((this.errorStats.resolved / this.errorStats.total) * 100).toFixed(
            2
          ) + "%"
        : "100%";

    return {
      instanceId: this.instanceId,
      status: this.healthStatus.status,
      lastUpdate: this.healthStatus.lastUpdate,
      issues: this.healthStatus.issues,
      stats: {
        totalErrors: this.errorStats.total,
        resolvedErrors: this.errorStats.resolved,
        criticalErrors: this.errorStats.unresolved,
        successRate,
      },
    };
  }

  // 📊 에러 통계 조회
  getErrorStats() {
    const successRate =
      this.errorStats.total > 0
        ? ((this.errorStats.resolved / this.errorStats.total) * 100).toFixed(
            2
          ) + "%"
        : "100%";

    return {
      instanceId: this.instanceId,
      total: this.errorStats.total,
      resolved: this.errorStats.resolved,
      unresolved: this.errorStats.unresolved,
      successRate,
      byType: this.errorStats.byType,
      byModule: this.errorStats.byModule,
      lastReset: this.errorStats.lastReset,
    };
  }

  // 🧹 정리 작업
  cleanup() {
    logger.info(`🧹 ErrorHandler 정리 작업 (${this.instanceId})`);
    // 통계 초기화 등 필요한 정리 작업
    this.errorStats = {
      total: 0,
      resolved: 0,
      unresolved: 0,
      byType: {},
      byModule: {},
      lastReset: new Date(),
    };
  }

  // ⏳ 대기 유틸리티
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ✅ 클래스만 export (표준화된 방식)
module.exports = ErrorHandler;
