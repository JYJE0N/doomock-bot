// doomock_bot.js - v3.0.1 안정화 버전
require("dotenv").config();
const logger = require("./src/utils/Logger");
const BotController = require("./src/controllers/BotController");
const { getRegistryStats } = require("./src/config/ModuleRegistry");
const TimeHelper = require("./src/utils/TimeHelper");

// 로그때문에 별짓을 다한다
const originalStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
  // getStatus 결과인지 확인
  if (
    value &&
    typeof value === "object" &&
    (value.moduleName ||
      value.serviceStatus ||
      value.isInitialized !== undefined)
  ) {
    // 간단한 상태로 변환
    let simpleStatus = "알 수 없음";

    if (value.isInitialized === false) {
      simpleStatus = "⏳ 준비 중";
    } else if (value.serviceStatus) {
      switch (value.serviceStatus.toLowerCase()) {
        case "connected":
          simpleStatus = "✅ 준비됨";
          break;
        case "not connected":
          simpleStatus = "🔌 연결 대기";
          break;
        case "connecting":
          simpleStatus = "🔄 연결 중";
          break;
        case "error":
          simpleStatus = "❌ 오류";
          break;
        default:
          simpleStatus = value.serviceStatus;
          break;
      }
    } else if (value.isConnected !== undefined) {
      simpleStatus = value.isConnected ? "✅ 준비됨" : "🔌 연결 대기";
    } else if (value.errorsCount > 0 || value.stats?.errorsCount > 0) {
      const errorCount = value.errorsCount || value.stats.errorsCount;
      simpleStatus = `❌ 오류 (${errorCount}건)`;
    } else if (value.isInitialized === true) {
      simpleStatus = "✅ 준비됨";
    } else if (value.moduleName) {
      simpleStatus = "🟢 활성";
    }

    return simpleStatus;
  }

  // 일반 객체는 원래대로
  return originalStringify.call(this, value, replacer, space);
};

/**
 * 🚀 DooMockBot v3.0.1 - 안정화 버전
 *
 * ✨ 주요 기능:
 * - 텔레그램 봇 서비스
 * - 모듈형 아키텍처
 * - Railway 최적화
 * - 우아한 종료 처리
 */

console.log("Logger 타입:", typeof logger);
console.log(
  "Logger 메서드들:",
  Object.getOwnPropertyNames(Object.getPrototypeOf(logger))
);

class DooMockBot {
  constructor() {
    this.botController = null;
    this.isRunning = false;
    this.startTime = Date.now();
    this.isInitialized = false;

    // 📊 실행 통계
    this.stats = {
      startTime: this.startTime,
      restartCount: 0,
      totalUptime: 0,
      criticalErrors: 0,
      gracefulShutdowns: 0,
    };

    console.log("🤖 DooMockBot v3.0.1 인스턴스 생성됨");
  }

  /**
   * 🎯 봇 시작
   */
  async start() {
    try {
      logger.startup("DooMock Bot", "3.0.1");
      logger.system("두목봇 초기화 시작...");

      this.showWelcomeBanner();
      this.showEnvironmentInfo();

      await this.executeStartupSequence();

      this.showStartupComplete();
    } catch (error) {
      logger.error("💥 봇 시작 실패", error);
      await this.handleStartupError(error);
    }
  }

  /**
   * 🌈 환영 배너
   */
  showWelcomeBanner() {
    // console.clear() 제거 - Logger 초기화 메시지를 지우지 않음

    console.log(); // 빈 줄 추가

    // chalk 라이브러리 가져오기
    const chalk = require("chalk");

    const bannerLines = [
      "██████╗  ██████╗  ██████╗ ███╗   ███╗ ██████╗  ██████╗██╗  ██╗",
      "██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║██╔═══██╗██╔════╝██║ ██╔╝",
      "██║  ██║██║   ██║██║   ██║██╔████╔██║██║   ██║██║     █████╔╝ ",
      "██║  ██║██║   ██║██║   ██║██║╚██╔╝██║██║   ██║██║     ██╔═██╗ ",
      "██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║╚██████╔╝╚██████╗██║  ██╗",
      "╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝",
    ];

    // 그라데이션 효과로 배너 출력
    bannerLines.forEach((line, index) => {
      const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
      const color = colors[index % colors.length];
      console.log(chalk[color].bold(line));
    });

    console.log();

    // 무지개 효과 구분선
    console.log(
      logger.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log(
      chalk.white.bold("                      🚀 두목봇 v3.0.1 시작 🚀")
    );
    console.log(
      chalk.cyan("                   직장인을 위한 스마트 어시스턴트")
    );
    console.log(
      logger.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log();
  }

  /**
   * 🌍 환경 정보 표시 (알록달록 버전)
   */
  showEnvironmentInfo() {
    const chalk = require("chalk");

    console.log(chalk.blue.bold("📋 ═══ 환경 정보 ═══"));
    console.log(
      chalk.green(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`)
    );
    console.log(
      chalk.yellow(
        `🚂 Railway: ${
          process.env.RAILWAY_ENVIRONMENT ? "✅ 활성화" : "❌ 로컬"
        }`
      )
    );
    console.log(chalk.cyan(`⏰ 시작 시간: ${TimeHelper.getLogTimeString()}`));
    console.log(chalk.magenta(`🔧 노드 버전: ${process.version}`));
    console.log(chalk.blue.bold("📋 ═════════════════"));
    console.log();
  }

  /**
   * 🚀 시작 시퀀스 실행
   */
  async executeStartupSequence() {
    logger.info("🎯 시작 시퀀스 실행...");

    const steps = [
      { name: "환경 검증", fn: () => this.validateEnvironment() },
      { name: "모듈 레지스트리 확인", fn: () => this.checkModuleRegistry() },
      { name: "BotController 생성", fn: () => this.createBotController() },
      {
        name: "BotController 초기화",
        fn: () => this.initializeBotController(),
      },
      { name: "프로세스 핸들러 설정", fn: () => this.setupProcessHandlers() },
      { name: "봇 시작", fn: () => this.startBot() },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        logger.info(`🔄 ${step.name} 중...`);

        if (typeof step.fn === "function") {
          await step.fn();
        }

        logger.success(`✅ ${step.name} 완료`);

        // 진행률 표시
        this.showProgressBar(i + 1, steps.length);
      } catch (error) {
        logger.error(`❌ ${step.name} 실패:`, error);
        throw error;
      }
    }

    this.isInitialized = true;
    logger.celebration("🎉 모든 시작 시퀀스 완료!");
  }

  /**
   * 📊 진행률 바 표시 (알록달록 버전)
   */
  showProgressBar(current, total, width = 30) {
    const chalk = require("chalk");
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    const filledBar = chalk.green("█".repeat(filled));
    const emptyBar = chalk.gray("░".repeat(empty));

    console.log(
      `   [${filledBar}${emptyBar}] ${chalk.yellow(percentage + "%")}`
    );
  }

  /**
   * 🔧 환경 변수 검증
   */
  async validateEnvironment() {
    const requiredEnvVars = ["BOT_TOKEN", "MONGO_URL"];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경 변수 누락: ${missingVars.join(", ")}`);
    }

    // 토큰 유효성 기본 체크
    const token = process.env.BOT_TOKEN;
    if (!token.includes(":") || token.length < 40) {
      throw new Error("유효하지 않은 텔레그램 봇 토큰 형식");
    }

    logger.debug("✅ 모든 환경 변수 검증 완료");
  }

  /**
   * 📦 모듈 레지스트리 확인
   */
  async checkModuleRegistry() {
    const registryStats = getRegistryStats();

    logger.debug(`📊 총 모듈: ${registryStats.totalModules}개`);
    logger.debug(`✅ 활성화: ${registryStats.enabledModules}개`);
    logger.debug(`⭐ Enhanced: ${registryStats.enhancedModules}개`);

    if (registryStats.totalModules === 0) {
      throw new Error("등록된 모듈이 없습니다");
    }

    if (registryStats.enabledModules === 0) {
      throw new Error("활성화된 모듈이 없습니다");
    }
  }

  /**
   * 🤖 BotController 생성
   */
  async createBotController() {
    logger.debug("🔧 BotController 인스턴스 생성 중...");
    this.botController = new BotController();
    logger.debug("✅ BotController 생성 완료");
  }

  /**
   * 🎯 BotController 초기화
   */
  async initializeBotController() {
    logger.debug("⚙️ BotController 초기화 중...");
    await this.botController.initialize();
    logger.debug("✅ BotController 초기화 완료");
  }

  /**
   * 🚀 봇 시작
   */
  async startBot() {
    logger.debug("🚀 봇 서비스 시작 중...");
    await this.botController.start();
    this.isRunning = true;
    logger.debug("✅ 봇 서비스 시작 완료");
  }

  /**
   * 🔗 프로세스 핸들러 설정
   */
  setupProcessHandlers() {
    // 정상 종료 신호
    process.once("SIGINT", () => this.shutdown("SIGINT"));
    process.once("SIGTERM", () => this.shutdown("SIGTERM"));

    // 예외 처리
    process.on("uncaughtException", (error) => {
      logger.error("예상치 못한 예외:", error);
      this.handleCriticalError(error);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("처리되지 않은 Promise 거부:", { reason, promise });
      this.handleCriticalError(new Error(`Unhandled rejection: ${reason}`));
    });

    logger.debug("✅ 프로세스 핸들러 설정 완료");
  }

  /**
   * 🎉 시작 완료 표시 (알록달록 버전)
   */
  showStartupComplete() {
    const chalk = require("chalk");

    console.log();
    console.log(
      logger.gradient(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log(logger.rainbow("                    🎊 두목봇 시작 완료! 🎊"));
    console.log(
      chalk.cyan.bold("                 텔레그램에서 봇과 대화하세요!")
    );
    console.log(
      logger.gradient(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log();

    // 성공 통계 표시
    this.showStartupSuccess();
    this.showOperationalStatus();

    // Logger의 celebration 메서드 사용
    logger.celebration("두목봇 v3.0.1 서비스 시작!");
  }

  /**
   * 🎊 시작 성공 통계 (알록달록 버전)
   */
  showStartupSuccess() {
    const chalk = require("chalk");
    const startupTime = Date.now() - this.startTime;
    const memoryUsage = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );

    console.log(chalk.cyan.bold("📊 ═══ 시작 통계 ═══"));
    console.log(chalk.yellow(`⚡ 시작 시간: ${startupTime}ms`));
    console.log(chalk.green(`💾 메모리 사용: ${memoryUsage}MB`));
    console.log(chalk.blue(`🔄 재시작 횟수: ${this.stats.restartCount}회`));
    console.log(chalk.red(`❌ 크리티컬 오류: ${this.stats.criticalErrors}건`));
    console.log(chalk.cyan.bold("📊 ═════════════════"));
  }

  /**
   * 🎨 운영 상태 표시 (알록달록 버전)
   */
  showOperationalStatus() {
    const chalk = require("chalk");

    console.log();
    console.log(logger.gradient("🎨 ═══ 운영 상태 ═══", "blue", "magenta"));
    console.log(chalk.green.bold("🟢 봇 서비스: 정상 운영"));
    console.log(chalk.yellow.bold("🌈 Logger: 활성화"));
    console.log(chalk.cyan.bold("📱 사용자 요청: 대기 중"));
    console.log(chalk.magenta.bold("💫 상태: 최적화됨"));
    console.log(logger.gradient("🎨 ═════════════════", "magenta", "blue"));
    console.log();
  }

  /**
   * 💥 크리티컬 오류 처리
   */
  async handleCriticalError(error) {
    this.stats.criticalErrors++;

    try {
      await this.cleanup();
    } catch (cleanupError) {
      logger.error("정리 중 추가 오류:", cleanupError);
    } finally {
      process.exit(1);
    }
  }

  /**
   * 💥 시작 오류 처리 (알록달록 버전)
   */
  async handleStartupError(error) {
    const chalk = require("chalk");

    console.log(
      chalk.red.bold("💥 ══════════════════════════════════════════════════")
    );
    console.log(chalk.red.bold("💀 FATAL ERROR - 애플리케이션 시작 실패"));
    console.log(chalk.red(`💀 오류: ${error.message}`));

    if (error.stack) {
      console.log(chalk.gray("📋 스택 트레이스:"));
      console.log(chalk.gray(error.stack));
    }

    console.log(chalk.red.bold("💀 프로세스를 종료합니다..."));
    console.log(
      chalk.red.bold("💀 ══════════════════════════════════════════════════")
    );

    process.exit(1);
  }

  /**
   * 🛑 우아한 종료 (알록달록 버전)
   */
  async shutdown(signal) {
    const chalk = require("chalk");

    console.log(chalk.yellow.bold(`🛑 ═══ ${signal} 신호 수신 ═══`));
    console.log(chalk.yellow("우아한 종료 시작..."));

    try {
      this.stats.gracefulShutdowns++;

      // 정리 작업
      await this.cleanup();

      console.log(chalk.green.bold("✅ 우아한 종료 완료"));
      console.log(chalk.green.bold("✅ ══════════════════"));

      logger.success("✅ 정상 종료 완료");
      process.exit(0);
    } catch (error) {
      console.log(chalk.red(`❌ 종료 중 오류: ${error.message}`));
      logger.error("종료 중 오류:", error);
      process.exit(1);
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 정리 작업 시작...");

      if (this.botController && this.isInitialized) {
        if (typeof this.botController.cleanup === "function") {
          logger.info("   🤖 BotController 정리...");
          await this.botController.cleanup();
          logger.debug("   ✅ BotController 정리 완료");
        } else {
          logger.warn(
            "   ⚠️ BotController.cleanup 메서드가 없음 (부분 초기화)"
          );

          // 수동 정리 시도
          if (this.botController.bot) {
            logger.info("   🔄 봇 인스턴스 수동 정리...");
            try {
              await this.botController.bot.stop();
              logger.debug("   ✅ 봇 중지 완료");
            } catch (stopError) {
              logger.warn("   ⚠️ 봇 중지 실패:", stopError.message);
            }
          }
        }
      } else {
        logger.warn("   ⚠️ BotController가 초기화되지 않음 - 정리 생략");
      }

      logger.success("✅ 모든 정리 작업 완료");
    } catch (error) {
      logger.error("정리 작업 중 오류:", error);
      throw error;
    }
  }
}

// ========================================
// 🚀 메인 실행부
// ========================================

async function main() {
  const dooMockBot = new DooMockBot();
  await dooMockBot.start();
}

// 메인 함수 실행
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
