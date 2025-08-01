// doomock_bot.js - v3.0.1 안정화 버전
require("dotenv").config();
const logger = require("./src/utils/Logger");
const BotController = require("./src/controllers/BotController");
const { getRegistryStats } = require("./src/config/ModuleRegistry");
const TimeHelper = require("./src/utils/TimeHelper");

/**
 * 🚀 DooMockBot v3.0.1 - 안정화 버전
 *
 * ✨ 주요 기능:
 * - 텔레그램 봇 서비스
 * - 모듈형 아키텍처
 * - Railway 최적화
 * - 우아한 종료 처리
 */

class DooMockBot {
  constructor() {
    // 초기화 상태 관리
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.startTime = Date.now();

    // 핵심 컴포넌트
    this.botController = null;

    // 통계
    this.stats = {
      startAttempts: 0,
      successfulStarts: 0,
      gracefulShutdowns: 0,
      errors: 0,
    };

    // 🛡️ 전역 Promise 거부 처리
    this.setupGlobalErrorHandlers();

    logger.info("🤖 DooMockBot 인스턴스 생성됨");
  }

  /**
   * 🛡️ 전역 에러 핸들러 설정 (무한재귀 방지)
   */
  setupGlobalErrorHandlers() {
    // 처리되지 않은 Promise 거부
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("🚨 처리되지 않은 Promise 거부:", {
        reason: reason?.message || reason,
        stack: reason?.stack || "No stack trace",
        promise: promise?.toString() || "Unknown promise",
      });

      this.stats.errors++;

      // 🔥 중요: 여기서 process.exit()를 호출하지 않음!
      // 무한재귀의 원인이었음
    });

    // 캐치되지 않은 예외
    process.on("uncaughtException", (error) => {
      logger.error("💥 캐치되지 않은 예외:", error);
      this.stats.errors++;

      // 심각한 오류만 종료
      if (error.code === "EADDRINUSE" || error.code === "ENOTFOUND") {
        logger.error("🚨 심각한 오류로 인한 종료");
        process.exit(1);
      }
    });

    // 프로세스 종료 신호
    process.once("SIGINT", () => this.shutdown("SIGINT"));
    process.once("SIGTERM", () => this.shutdown("SIGTERM"));
  }

  /**
   * 🚀 애플리케이션 시작
   */
  async start() {
    if (this.isInitialized) {
      logger.warn("⚠️ 이미 초기화된 애플리케이션");
      return;
    }

    if (this.isShuttingDown) {
      logger.warn("⚠️ 종료 중인 애플리케이션");
      return;
    }

    this.stats.startAttempts++;

    try {
      logger.celebration("🎊 DooMockBot v3.0.1 시작!");
      logger.info(`🌍 환경: ${process.env.NODE_ENV || "development"}`);
      logger.info(
        `🚀 Railway: ${process.env.RAILWAY_ENVIRONMENT ? "Yes" : "No"}`
      );

      // 🎯 BotController 초기화
      logger.info("🤖 BotController 초기화 중...");
      this.botController = new BotController();
      await this.botController.initialize();

      // 🚀 봇 시작
      // logger.info("🚀 텔레그램 봇 시작 중...");
      await this.botController.start();

      // 초기화 완료
      this.isInitialized = true;
      this.stats.successfulStarts++;

      const uptime = Date.now() - this.startTime;
      logger.celebration(`🎉 DooMockBot 시작 완료! (${uptime}ms)`);
      logger.success("✅ 모든 시스템이 정상적으로 작동 중입니다.");
    } catch (error) {
      logger.error("💥 애플리케이션 시작 실패:", error);
      await this.handleStartupError(error);
    }
  }

  /**
   * 💥 시작 오류 처리
   */
  async handleStartupError(error) {
    this.stats.errors++;

    logger.error("💀 시작 오류 상세:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // 정리 작업 시도
    try {
      await this.cleanup();
    } catch (cleanupError) {
      logger.error("정리 작업도 실패:", cleanupError);
    }

    // 치명적 오류는 종료
    if (
      error.code === "EADDRINUSE" ||
      error.message?.includes("MONGO_URL") ||
      error.message?.includes("TELEGRAM_BOT_TOKEN")
    ) {
      logger.error("🚨 치명적 오류로 인한 종료");
      process.exit(1);
    }
  }

  /**
   * 🛑 우아한 종료
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn("⚠️ 이미 종료 중입니다");
      return;
    }

    this.isShuttingDown = true;

    logger.info(`🛑 ${signal} 신호 수신 - 우아한 종료 시작`);

    try {
      this.stats.gracefulShutdowns++;

      // 정리 작업
      await this.cleanup();

      logger.success("✅ 우아한 종료 완료");
      logger.info(`📊 최종 통계: ${JSON.stringify(this.stats)}`);

      process.exit(0);
    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
      process.exit(1);
    }
  }

  /**
   * 🧹 정리 작업 (무한재귀 방지)
   */
  async cleanup() {
    if (this.cleanupInProgress) {
      logger.warn("⚠️ 정리 작업이 이미 진행 중입니다");
      return;
    }

    this.cleanupInProgress = true;

    try {
      logger.info("🧹 정리 작업 시작...");

      // BotController 정리
      if (this.botController && this.isInitialized) {
        if (typeof this.botController.cleanup === "function") {
          logger.info("   🤖 BotController 정리 중...");
          await this.botController.cleanup();
          logger.debug("   ✅ BotController 정리 완료");
        } else if (this.botController.bot) {
          // 수동 정리
          logger.info("   🔄 봇 인스턴스 수동 정리...");
          try {
            await this.botController.bot.stop();
            logger.debug("   ✅ 봇 중지 완료");
          } catch (stopError) {
            logger.warn("   ⚠️ 봇 중지 실패:", stopError.message);
          }
        }
      } else {
        logger.debug("   ⚠️ BotController가 초기화되지 않음 - 정리 생략");
      }

      // 상태 초기화
      this.isInitialized = false;
      this.botController = null;

      logger.success("✅ 모든 정리 작업 완료");
    } catch (error) {
      logger.error("❌ 정리 작업 중 오류:", error);
      throw error;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * 📊 상태 정보
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      shuttingDown: this.isShuttingDown,
      uptime: Date.now() - this.startTime,
      stats: this.stats,
      botController: this.botController ? "initialized" : "not_initialized",
      environment: {
        node: process.env.NODE_ENV || "development",
        railway: !!process.env.RAILWAY_ENVIRONMENT,
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  }
}

// ========================================
// 🚀 메인 실행부
// ========================================

async function main() {
  const dooMockBot = new DooMockBot();

  try {
    await dooMockBot.start();
  } catch (error) {
    logger.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  }
}

// 메인 함수 실행 (모듈로 직접 실행된 경우만)
if (require.main === module) {
  main().catch((error) => {
    logger.error("💥 최상위 메인 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
