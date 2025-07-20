// src/utils/ConflictResolver.js - 고급 409 충돌 해결 시스템

const logger = require("../utils/Logger");
const { Bot } = require("node-telegram-bot-api");
// 충돌 해결을 위한 고급 시스템

class ConflictResolver {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;

    this.config = {
      maxRetries: options.maxRetries || 5,
      baseDelay: options.baseDelay || 2000,
      maxDelay: options.maxDelay || 30000,
      exponentialBackoff: options.exponentialBackoff || true,
      forceWebhookDelete: options.forceWebhookDelete || true,
      healthCheckInterval: options.healthCheckInterval || 30000,
      conflictDetectionThreshold: options.conflictDetectionThreshold || 3,
      ...options,
    };

    this.state = {
      isResolving: false,
      lastConflictTime: null,
      conflictCount: 0,
      resolutionAttempts: 0,
      isHealthy: true,
      lastHealthCheck: null,
    };

    // 자동 헬스체크 시작 (Railway 환경에서만)
    if (this.isRailway) {
      this.startHealthMonitoring();
    }

    logger.info("🔧 ConflictResolver 초기화됨");
  }

  // 🚨 메인 409 충돌 해결 메서드
  async resolveConflict(error, context = {}) {
    if (this.state.isResolving) {
      logger.warn("⚠️ 충돌 해결이 이미 진행 중입니다");
      return { success: false, reason: "already_resolving" };
    }

    this.state.isResolving = true;
    this.state.lastConflictTime = Date.now();
    this.state.conflictCount++;

    try {
      logger.error(`🚨 409 충돌 감지! (${this.state.conflictCount}번째)`);

      // 단계별 해결 시도
      const result = await this.performResolutionSteps(error, context);

      if (result.success) {
        logger.success("✅ 409 충돌 해결 완료!");
        this.state.conflictCount = 0; // 성공 시 카운트 리셋
      } else {
        logger.error("❌ 409 충돌 해결 실패:", result.reason);
      }

      return result;
    } catch (resolverError) {
      logger.error("❌ ConflictResolver 내부 오류:", resolverError);
      return { success: false, reason: "resolver_error", error: resolverError };
    } finally {
      this.state.isResolving = false;
      this.state.resolutionAttempts++;
    }
  }

  // 단계별 충돌 해결
  async performResolutionSteps(error, context) {
    const steps = [
      () => this.stepGracefulStop(),
      () => this.stepForceWebhookDeletion(),
      () => this.stepWaitForPreviousInstance(),
      () => this.stepValidateBotToken(),
      () => this.stepRestartPolling(),
    ];

    for (let i = 0; i < steps.length; i++) {
      const stepName = steps[i].name.replace("step", "");
      logger.info(`🔄 단계 ${i + 1}/${steps.length}: ${stepName}`);

      try {
        const stepResult = await steps[i]();

        if (!stepResult.success) {
          logger.warn(`⚠️ 단계 ${i + 1} 실패:`, stepResult.reason);

          // 치명적 실패인 경우 중단
          if (stepResult.critical) {
            return { success: false, reason: stepResult.reason, step: i + 1 };
          }
        } else {
          logger.info(`✅ 단계 ${i + 1} 성공`);
        }

        // 단계 간 대기 (백오프 적용)
        if (i < steps.length - 1) {
          const delay = this.calculateBackoffDelay(i);
          logger.debug(`⏳ ${delay / 1000}초 대기...`);
          await this.sleep(delay);
        }
      } catch (stepError) {
        logger.error(`❌ 단계 ${i + 1} 오류:`, stepError);

        // 마지막 단계가 아니면 계속 진행
        if (i === steps.length - 1) {
          return {
            success: false,
            reason: "final_step_failed",
            error: stepError,
          };
        }
      }
    }

    return { success: true };
  }

  // 단계 1: 현재 폴링 우아하게 중지
  async stepGracefulStop() {
    try {
      if (this.bot && this.bot.isPolling()) {
        logger.info("⏹️ 현재 폴링 중지 중...");
        await this.bot.stopPolling();
        logger.info("✅ 폴링 중지 완료");
      }
      return { success: true };
    } catch (error) {
      logger.warn("⚠️ 폴링 중지 실패:", error.message);
      return { success: false, reason: "polling_stop_failed", critical: false };
    }
  }

  // 단계 2: 웹훅 강제 삭제
  async stepForceWebhookDeletion() {
    if (!this.config.forceWebhookDelete) {
      return { success: true, reason: "skipped" };
    }

    try {
      logger.info("🧹 웹훅 강제 삭제 중...");

      // 여러 번 시도 (텔레그램 서버가 느릴 수 있음)
      const maxWebhookRetries = 3;
      let webhookDeleted = false;

      for (let i = 0; i < maxWebhookRetries; i++) {
        try {
          await this.bot.deleteWebHook();
          webhookDeleted = true;
          break;
        } catch (webhookError) {
          logger.debug(`웹훅 삭제 시도 ${i + 1} 실패:`, webhookError.message);
          if (i < maxWebhookRetries - 1) {
            await this.sleep(1000 * (i + 1)); // 1초, 2초, 3초
          }
        }
      }

      if (webhookDeleted) {
        logger.info("✅ 웹훅 삭제 완료");
        return { success: true };
      } else {
        logger.warn("⚠️ 웹훅 삭제 실패 (계속 진행)");
        return {
          success: false,
          reason: "webhook_delete_failed",
          critical: false,
        };
      }
    } catch (error) {
      logger.warn("⚠️ 웹훅 삭제 예외:", error.message);
      return {
        success: false,
        reason: "webhook_delete_error",
        critical: false,
      };
    }
  }

  // 단계 3: 이전 인스턴스 종료 대기
  async stepWaitForPreviousInstance() {
    const waitTime = this.isRailway ? 20000 : 10000; // Railway는 더 긴 대기
    const additionalWait = Math.min(this.state.conflictCount * 5000, 30000); // 충돌 횟수에 따라 추가 대기
    const totalWait = waitTime + additionalWait;

    logger.info(`⏳ 이전 인스턴스 종료 대기 (${totalWait / 1000}초)...`);

    try {
      await this.sleep(totalWait);
      return { success: true };
    } catch (error) {
      return { success: false, reason: "wait_interrupted", critical: false };
    }
  }

  // 단계 4: 봇 토큰 유효성 검증
  async stepValidateBotToken() {
    try {
      logger.info("🔍 봇 토큰 유효성 검증 중...");

      // getMe API 호출로 토큰 검증
      const botInfo = await this.bot.getMe();

      if (botInfo && botInfo.id) {
        logger.info(`✅ 봇 토큰 유효 (${botInfo.username})`);
        return { success: true, botInfo };
      } else {
        logger.error("❌ 봇 정보 조회 실패");
        return {
          success: false,
          reason: "invalid_bot_response",
          critical: true,
        };
      }
    } catch (error) {
      logger.error("❌ 봇 토큰 검증 실패:", error.message);

      // 토큰 관련 오류는 치명적
      if (
        error.message.includes("token") ||
        error.message.includes("Unauthorized")
      ) {
        return { success: false, reason: "invalid_token", critical: true };
      }

      return {
        success: false,
        reason: "token_validation_failed",
        critical: false,
      };
    }
  }

  // 단계 5: 폴링 재시작
  async stepRestartPolling() {
    try {
      logger.info("🚀 폴링 재시작 중...");

      // 폴링이 이미 실행 중인지 확인
      if (this.bot.isPolling()) {
        logger.warn("⚠️ 폴링이 이미 실행 중임");
        return { success: true, reason: "already_polling" };
      }

      // 폴링 시작
      await this.bot.startPolling();

      // 폴링 상태 확인 (3초 후)
      await this.sleep(3000);

      if (this.bot.isPolling()) {
        logger.success("✅ 폴링 재시작 성공!");
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
      environment: this.isRailway ? "Railway" : "Local",
    };
  }

  // 통계 조회
  getStats() {
    const uptime = Date.now() - (this.state.lastConflictTime || Date.now());

    return {
      ...this.getStatus(),
      uptimeMs: uptime,
      avgResolutionTime:
        this.state.resolutionAttempts > 0
          ? uptime / this.state.resolutionAttempts
          : 0,
      config: {
        maxRetries: this.config.maxRetries,
        baseDelay: this.config.baseDelay,
        healthCheckInterval: this.config.healthCheckInterval,
      },
    };
  }

  // 수동 복구 트리거
  async manualRecover() {
    logger.info("🔧 수동 복구 요청됨");
    return await this.autoRecover();
  }

  // 유틸리티: sleep
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 정리
  cleanup() {
    this.state.isResolving = false;
    logger.info("🧹 ConflictResolver 정리됨");
  }
}

module.exports = ConflictResolver;
