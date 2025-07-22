// src/utils/ConflictResolver.js - TimeHelper import 추가
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper"); // ✅ TimeHelper import 추가

class ConflictResolver {
  constructor(bot, isRailway = false) {
    this.bot = bot;
    this.isRailway = isRailway;

    // 상태 추적
    this.state = {
      lastConflictTime: null,
      conflictCount: 0,
      isResolving: false,
      resolutionAttempts: 0,
      lastHealthCheck: null,
      isHealthy: true,
    };

    // 설정
    this.config = {
      maxRetries: 3,
      baseDelay: 3000, // 3초
      maxDelay: 30000, // 30초
      exponentialBackoff: true,
      healthCheckInterval: 30000, // 30초
    };

    logger.info(
      `🛡️ ConflictResolver 초기화됨 (Railway: ${isRailway ? "예" : "아니오"})`
    );
  }

  // 409 충돌 해결
  async resolveConflict(error, options = {}) {
    if (this.state.isResolving) {
      logger.warn("⚠️ 이미 충돌 해결 중...");
      return { success: false, reason: "already_resolving" };
    }

    this.state.isResolving = true;
    this.state.conflictCount++;
    this.state.lastConflictTime = Date.now();

    logger.warn(
      `🔧 409 충돌 감지 (${this.state.conflictCount}번째), 해결 시도 중...`
    );

    const steps = [
      { name: "폴링 중지", action: () => this.stopPolling() },
      { name: "대기", action: () => this.waitWithBackoff(0) },
      { name: "폴링 재시작", action: () => this.restartPolling() },
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        logger.info(`📍 ${i + 1}단계: ${step.name}`);

        const result = await step.action();
        if (!result.success && result.critical) {
          throw new Error(`${step.name} 실패: ${result.reason}`);
        }
      }

      logger.success("✅ 409 충돌 해결 완료!");
      this.state.resolutionAttempts = 0;
      return { success: true };
    } catch (error) {
      logger.error("❌ 충돌 해결 실패:", error.message);

      this.state.resolutionAttempts++;
      if (this.state.resolutionAttempts < this.config.maxRetries) {
        logger.warn(
          `🔄 재시도 예정 (${this.state.resolutionAttempts}/${this.config.maxRetries})`
        );
        await this.sleep(this.config.baseDelay * this.state.resolutionAttempts);
        return await this.resolveConflict(error, { recursive: true });
      }

      return { success: false, reason: "max_retries_exceeded", critical: true };
    } finally {
      this.state.isResolving = false;
    }
  }

  // 폴링 중지
  async stopPolling() {
    try {
      if (this.bot.isPolling()) {
        logger.info("⏸️ 텔레그램 폴링 중지 중...");
        await this.bot.stopPolling();
        logger.success("✅ 폴링 중지 완료");
      } else {
        logger.info("ℹ️ 폴링이 이미 중지됨");
      }
      return { success: true };
    } catch (error) {
      logger.error("❌ 폴링 중지 실패:", error.message);
      return { success: false, reason: "stop_failed", critical: false };
    }
  }

  // 백오프 대기
  async waitWithBackoff(attemptIndex) {
    const delay = this.calculateBackoffDelay(attemptIndex);
    logger.info(`⏳ ${delay / 1000}초 대기 중...`);
    await this.sleep(delay);
    return { success: true };
  }

  // 폴링 재시작
  async restartPolling() {
    try {
      logger.info("▶️ 텔레그램 폴링 재시작 중...");

      // 추가 안전 대기
      await this.sleep(2000);

      await this.bot.startPolling({
        restart: true,
      });

      // 폴링 상태 확인
      await this.sleep(1000);
      if (this.bot.isPolling()) {
        logger.success("✅ 폴링 재시작 성공");
        return { success: true };
      } else {
        logger.error("❌ 폴링 재시작 실패 (상태 확인)");
        return {
          success: false,
          reason: "polling_not_started",
          critical: true,
        };
      }
    } catch (error) {
      logger.error("❌ 폴링 재시작 오류:", error.message);

      // 409 에러가 다시 발생하면 재귀적으로 해결 시도
      if (error.response?.body?.error_code === 409) {
        if (this.state.resolutionAttempts < this.config.maxRetries) {
          logger.warn("🔄 409 에러 재발생, 재시도...");
          await this.sleep(5000);
          return await this.resolveConflict(error, { recursive: true });
        } else {
          logger.error("❌ 최대 재시도 횟수 초과");
          return {
            success: false,
            reason: "max_retries_exceeded",
            critical: true,
          };
        }
      }

      return { success: false, reason: "polling_start_failed", critical: true };
    }
  }

  // 백오프 지연 계산
  calculateBackoffDelay(stepIndex) {
    if (!this.config.exponentialBackoff) {
      return this.config.baseDelay;
    }

    const delay = this.config.baseDelay * Math.pow(2, stepIndex);
    return Math.min(delay, this.config.maxDelay);
  }

  // 헬스 모니터링 시작 (Railway 전용)
  startHealthMonitoring() {
    if (!this.isRailway) return;

    const healthCheck = async () => {
      try {
        this.state.lastHealthCheck = Date.now();

        // 봇 상태 확인
        if (!this.bot.isPolling()) {
          logger.warn("⚠️ 헬스체크: 봇이 폴링 중이 아님");
          this.state.isHealthy = false;

          // 자동 복구 시도
          await this.autoRecover();
        } else {
          this.state.isHealthy = true;
        }
      } catch (error) {
        logger.error("❌ 헬스체크 오류:", error);
        this.state.isHealthy = false;
      }
    };

    // 주기적 헬스체크
    setInterval(healthCheck, this.config.healthCheckInterval);

    logger.info("💓 헬스 모니터링 시작됨");
  }

  // 자동 복구
  async autoRecover() {
    if (this.state.isResolving) {
      logger.debug("복구가 이미 진행 중");
      return;
    }

    logger.warn("🔧 자동 복구 시작...");

    try {
      const result = await this.resolveConflict(
        new Error("Auto recovery triggered"),
        { autoRecover: true }
      );

      if (result.success) {
        logger.success("✅ 자동 복구 성공");
      } else {
        logger.error("❌ 자동 복구 실패:", result.reason);
      }
    } catch (error) {
      logger.error("❌ 자동 복구 오류:", error);
    }
  }

  // 현재 상태 조회
  getStatus() {
    return {
      isHealthy: this.state.isHealthy,
      isResolving: this.state.isResolving,
      conflictCount: this.state.conflictCount,
      resolutionAttempts: this.state.resolutionAttempts,
      lastConflictTime: this.state.lastConflictTime,
      lastHealthCheck: this.state.lastHealthCheck,
      botPolling: this.bot ? this.bot.isPolling() : false,
      environment: this.isRailway ? "railway" : "local",
      lastHealthCheckTime: this.state.lastHealthCheck
        ? TimeHelper.getLogTimeString(new Date(this.state.lastHealthCheck)) // ✅ TimeHelper 사용
        : "없음",
    };
  }

  // 유틸리티: sleep
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 정리
  cleanup() {
    logger.info("🧹 ConflictResolver 정리 중...");
    // 필요한 정리 작업
  }
}

module.exports = ConflictResolver;
