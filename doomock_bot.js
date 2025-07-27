// doomock_bot.js
// 🤖 두목봇 v3.0.1 - 메인 엔트리 포인트

require("dotenv").config();
const logger = require("./src/utils/Logger");
const BotController = require("./src/controllers/BotController");

/**
 * 🚀 두목봇 메인 클래스
 */
class DooMockBot {
  constructor() {
    this.botController = null;
    this.isRunning = false;
  }

  /**
   * 🎯 봇 시작
   */
  async start() {
    try {
      // 시작 배너
      logger.startup("DooMock Bot", "3.0.1");
      logger.system("두목봇 초기화 시작...");

      // BotController 생성 및 초기화
      this.botController = new BotController();
      await this.botController.initialize();

      // 프로세스 핸들러 설정
      this.setupProcessHandlers();

      // 봇 시작
      await this.botController.start();
      this.isRunning = true;

      logger.success("🎉 두목봇이 성공적으로 시작되었습니다!");
      this.showStartupInfo();
    } catch (error) {
      logger.fatal("💥 봇 시작 실패", error);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * 📋 시작 정보 표시
   */
  showStartupInfo() {
    const info = {
      환경: process.env.NODE_ENV || "production",
      노드버전: process.version,
      메모리사용: `${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )}MB`,
      플랫폼: process.platform,
      PID: process.pid,
      업타임: "0초",
    };

    logger.summary("시스템 정보", info);

    // Railway 환경 정보
    if (process.env.RAILWAY_ENVIRONMENT_NAME) {
      logger.info("🚂 Railway 환경에서 실행 중", {
        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
      });
    }
  }

  /**
   * 🔧 프로세스 이벤트 핸들러
   */
  setupProcessHandlers() {
    // 정상 종료 신호
    process.once("SIGINT", () => this.shutdown("SIGINT"));
    process.once("SIGTERM", () => this.shutdown("SIGTERM"));

    // 예외 처리
    process.on("uncaughtException", (error) => {
      logger.fatal("처리되지 않은 예외", error);
      this.shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logger.fatal("처리되지 않은 Promise 거부", reason);
      this.shutdown("unhandledRejection");
    });

    logger.debug("프로세스 핸들러 설정 완료");
  }

  /**
   * 🚪 정상 종료
   */
  async shutdown(signal) {
    if (!this.isRunning) return;

    logger.warn(`📥 종료 신호 수신: ${signal}`);
    logger.system("정상 종료 프로세스 시작...");

    this.isRunning = false;
    await this.cleanup();

    logger.success("✅ 정상 종료 완료");
    process.exit(0);
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 정리 작업 시작...");

      if (this.botController) {
        await this.botController.cleanup();
        logger.debug("BotController 정리 완료");
      }

      logger.success("✅ 모든 정리 작업 완료");
    } catch (error) {
      logger.error("정리 작업 중 오류", error);
    }
  }
}

// ===== 🚀 애플리케이션 시작 =====

if (require.main === module) {
  const bot = new DooMockBot();

  bot.start().catch((error) => {
    logger.fatal("애플리케이션 시작 실패", error);
  });
}

module.exports = DooMockBot;
