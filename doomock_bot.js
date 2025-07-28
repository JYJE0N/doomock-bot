// doomock_bot.js - 수정된 버전 (임포트 통일)
require("dotenv").config();
const logger = require("./src/utils/Logger");
const BotController = require("./src/controllers/BotController");
// ✅ 수정: 임포트 방식 통일 (필요한 함수만 디스트럭처링)
const { getRegistryStats } = require("./src/config/ModuleRegistry");
const TimeHelper = require("./src/utils/TimeHelper");

/**
 * 🚀 DooMockBot v3.0.1 - 수정된 버전
 *
 * ✨ 수정사항:
 * - 임포트 방식 통일
 * - 변수명 일관성 확보
 * - logger 메서드 직접 사용
 * - 안정성 향상
 */
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

    // 🎭 시작 애니메이션 준비
    this.startupAnimations = {
      loading: ["⏳", "⌛", "🔄", "⚡", "🚀"],
      success: ["✅", "🎉", "🌟", "💫", "🎊"],
      error: ["❌", "💥", "🚨", "⚠️", "🔥"],
    };

    // ✅ 수정: logger 메서드 직접 사용
    console.log(logger.rainbow("🤖 DooMockBot v3.0.1 인스턴스 생성됨"));
  }

  /**
   * 📦 모듈 레지스트리 확인 (수정된 버전)
   *
   * ✅ 수정사항:
   * - 올바른 함수 호출
   * - 변수명 통일
   * - 상세한 검증 로직
   */
  async checkModuleRegistry() {
    try {
      // ✅ 수정: getRegistryStats() 직접 호출
      const registryStats = getRegistryStats();

      console.log(
        logger.gradient("   📋 모듈 레지스트리 검증 중...", "cyan", "purple")
      );

      console.log(
        logger.gradient(
          `   📊 총 모듈: ${registryStats.totalModules}개`,
          "blue",
          "cyan"
        )
      );
      console.log(
        logger.gradient(
          `   ✅ 활성화: ${registryStats.enabledModules}개`,
          "green",
          "blue"
        )
      );
      console.log(
        logger.gradient(
          `   ⭐ Enhanced: ${registryStats.enhancedModules}개`,
          "yellow",
          "orange"
        )
      );

      // ✅ 검증 로직
      if (registryStats.totalModules === 0) {
        throw new Error(
          "🚨 등록된 모듈이 없습니다. ModuleRegistry.js를 확인하세요."
        );
      }

      if (registryStats.enabledModules === 0) {
        throw new Error("⚠️ 활성화된 모듈이 없습니다. 환경변수를 확인하세요.");
      }

      // 📈 성능 지표
      const successRate =
        registryStats.totalModules > 0
          ? Math.round(
              (registryStats.enabledModules / registryStats.totalModules) * 100
            )
          : 0;

      console.log(
        logger.gradient(
          `   📈 모듈 활성화율: ${successRate}%`,
          successRate > 80 ? "green" : successRate > 50 ? "yellow" : "red",
          "blue"
        )
      );

      // ✅ 검증 완료
      console.log(logger.rainbow("   🎯 모듈 레지스트리 검증 완료!"));

      return registryStats;
    } catch (error) {
      console.log(
        logger.gradient(
          `   ❌ 모듈 레지스트리 검증 실패: ${error.message}`,
          "red",
          "orange"
        )
      );
      throw error;
    }
  }

  /**
   * 🎯 봇 시작 (수정된 시작 시퀀스)
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
      logger.fatal("💥 봇 시작 실패", error);
      await this.handleStartupError(error);
    }
  }

  /**
   * 🌈 화려한 환영 배너 (수정된 버전)
   */
  showWelcomeBanner() {
    console.clear();

    // ASCII 아트 배너
    const bannerLines = [
      "██████╗  ██████╗  ██████╗ ███╗   ███╗ ██████╗  ██████╗██╗  ██╗",
      "██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║██╔═══██╗██╔════╝██║ ██╔╝",
      "██║  ██║██║   ██║██║   ██║██╔████╔██║██║   ██║██║     █████╔╝ ",
      "██║  ██║██║   ██║██║   ██║██║╚██╔╝██║██║   ██║██║     ██╔═██╗ ",
      "██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║╚██████╔╝╚██████╗██║  ██╗",
      "╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝",
    ];

    // ✅ 수정: logger 메서드 직접 사용
    bannerLines.forEach((line) => {
      console.log(logger.gradient(line, "cyan", "magenta"));
    });

    console.log();
    console.log(
      logger.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log(
      logger.gradient(
        "                    두목봇 v3.0.1 알록달록 에디션",
        "cyan",
        "magenta"
      )
    );
    console.log(
      logger.gradient(
        "                     Enhanced with SimpleLogger",
        "purple",
        "blue"
      )
    );
    console.log(
      logger.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log();
  }

  /**
   * 📋 환경 정보 표시 (수정된 버전)
   */
  showEnvironmentInfo() {
    console.log(logger.rainbow("📋 ═══ 환경 정보 ═══"));

    const envInfo = {
      "🌍 환경": process.env.NODE_ENV || "production",
      "🟢 Node.js": process.version,
      "💾 메모리": `${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )}MB`,
      "🖥️ 플랫폼": `${process.platform} ${process.arch}`,
      "🆔 PID": process.pid,
      "⏰ 시작 시간": TimeHelper.format(new Date(), "full"),
    };

    for (const [key, value] of Object.entries(envInfo)) {
      console.log(logger.gradient(`   ${key}: ${value}`, "blue", "cyan"));
    }

    // Railway 환경 감지
    if (process.env.RAILWAY_ENVIRONMENT_NAME) {
      console.log();
      console.log(logger.gradient("🚂 Railway 환경 감지!", "green", "blue"));
      console.log(
        logger.gradient(
          `   프로젝트: ${process.env.RAILWAY_ENVIRONMENT_NAME}`,
          "cyan",
          "purple"
        )
      );
    }

    console.log(logger.rainbow("📋 ═══════════════"));
    console.log();
  }

  /**
   * 🚀 시작 시퀀스 실행 (수정된 버전)
   */
  async executeStartupSequence() {
    const steps = [
      { name: "환경 변수 검증", fn: () => this.validateEnvironment() },
      { name: "모듈 레지스트리 확인", fn: () => this.checkModuleRegistry() },
      { name: "BotController 생성", fn: () => this.createBotController() },
      {
        name: "BotController 초기화",
        fn: () => this.initializeBotController(),
      },
      { name: "봇 시작", fn: () => this.startBot() },
      { name: "프로세스 핸들러 설정", fn: () => this.setupProcessHandlers() },
    ];

    console.log(logger.rainbow("🚀 ═══ 시작 시퀀스 ═══"));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      try {
        console.log(
          logger.gradient(`${i + 1}. ${step.name} 중...`, "yellow", "orange")
        );

        if (typeof step.fn === "function") {
          await step.fn();
        }

        console.log(
          logger.gradient(`   ✅ ${step.name} 완료`, "green", "blue")
        );

        // 진행률 표시
        this.showProgressBar(i + 1, steps.length);
      } catch (error) {
        console.log(
          logger.gradient(
            `   ❌ ${step.name} 실패: ${error.message}`,
            "red",
            "orange"
          )
        );
        throw error;
      }
    }

    this.isInitialized = true;
    console.log(logger.rainbow("🚀 ═════════════════"));
  }

  /**
   * 📊 진행률 바 표시 (수정된 버전)
   */
  showProgressBar(current, total, width = 30) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    const filledBar = "█".repeat(filled);
    const emptyBar = "░".repeat(empty);

    console.log(
      logger.gradient(
        `   [${filledBar}${emptyBar}] ${percentage}%`,
        "cyan",
        "purple"
      )
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

    console.log(
      logger.gradient("   ✅ 모든 환경 변수 검증 완료", "green", "blue")
    );
  }

  /**
   * 🤖 BotController 생성
   */
  async createBotController() {
    console.log(
      logger.gradient(
        "   🔧 BotController 인스턴스 생성 중...",
        "purple",
        "pink"
      )
    );
    this.botController = new BotController();
    console.log(
      logger.gradient("   ✅ BotController 생성 완료", "green", "blue")
    );
  }

  /**
   * 🎯 BotController 초기화
   */
  async initializeBotController() {
    console.log(
      logger.gradient("   ⚙️ BotController 초기화 중...", "blue", "purple")
    );
    await this.botController.initialize();
    console.log(
      logger.gradient("   ✅ BotController 초기화 완료", "green", "blue")
    );
  }

  /**
   * 🚀 봇 시작
   */
  async startBot() {
    console.log(logger.gradient("   🚀 봇 서비스 시작 중...", "green", "blue"));
    await this.botController.start();
    this.isRunning = true;
    console.log(logger.gradient("   ✅ 봇 서비스 시작 완료", "green", "blue"));
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
      logger.fatal("예상치 못한 예외:", error);
      this.handleCriticalError(error);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.fatal("처리되지 않은 Promise 거부:", { reason, promise });
      this.handleCriticalError(new Error(`Unhandled rejection: ${reason}`));
    });

    console.log(
      logger.gradient("   ✅ 프로세스 핸들러 설정 완료", "green", "blue")
    );
  }

  /**
   * 🎉 시작 완료 표시 (수정된 버전)
   */
  showStartupComplete() {
    console.log();
    console.log(
      logger.rainbow(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log(
      logger.gradient(
        "                    🎊 두목봇 시작 완료! 🎊",
        "green",
        "blue"
      )
    );
    console.log(
      logger.gradient(
        "                 텔레그램에서 봇과 대화하세요!",
        "cyan",
        "purple"
      )
    );
    console.log(
      logger.rainbow(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log();

    // 성공 통계 표시
    this.showStartupSuccess();
    this.showOperationalStatus();

    logger.success("🎊 두목봇 v3.0.1 서비스 시작!");
  }

  /**
   * 🎊 시작 성공 통계 (수정된 버전)
   */
  showStartupSuccess() {
    const startupTime = Date.now() - this.startTime;
    const memoryUsage = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );

    console.log(logger.rainbow("📊 ═══ 시작 통계 ═══"));
    console.log(
      logger.gradient(`⚡ 시작 시간: ${startupTime}ms`, "green", "blue")
    );
    console.log(
      logger.gradient(`💾 메모리 사용: ${memoryUsage}MB`, "cyan", "purple")
    );
    console.log(
      logger.gradient(
        `🔄 재시작 횟수: ${this.stats.restartCount}회`,
        "yellow",
        "orange"
      )
    );
    console.log(
      logger.gradient(
        `❌ 크리티컬 오류: ${this.stats.criticalErrors}건`,
        "red",
        "orange"
      )
    );
    console.log(logger.rainbow("📊 ═════════════════"));
  }

  /**
   * 🎨 운영 상태 표시 (수정된 버전)
   */
  showOperationalStatus() {
    console.log();
    console.log(logger.rainbow("🎨 ═══ 운영 상태 ═══"));
    console.log(logger.gradient("🟢 봇 서비스: 정상 운영", "green", "blue"));
    console.log(logger.gradient("🌈 Logger: 활성화", "purple", "pink"));
    console.log(logger.gradient("📱 사용자 요청: 대기 중", "cyan", "purple"));
    console.log(logger.gradient("💫 상태: 최적화됨", "yellow", "orange"));
    console.log(logger.rainbow("🎨 ═════════════════"));
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
   * 🔥 시작 오류 처리
   */
  async handleStartupError(error) {
    console.log(
      logger.gradient(
        "💥 ══════════════════════════════════════════════════",
        "red",
        "orange"
      )
    );
    console.log(
      logger.gradient(
        "💀 FATAL ERROR - 애플리케이션 시작 실패",
        "red",
        "darkred"
      )
    );
    console.log(logger.gradient(`💀 오류: ${error.message}`, "red", "orange"));

    if (error.stack) {
      console.log("📋 스택 트레이스:");
      console.log(error.stack);
    }

    console.log(
      logger.gradient("💀 프로세스를 종료합니다...", "red", "darkred")
    );
    console.log(
      logger.gradient(
        "💀 ══════════════════════════════════════════════════",
        "red",
        "orange"
      )
    );

    process.exit(1);
  }

  /**
   * 🛑 우아한 종료 (수정된 버전)
   */
  async shutdown(signal) {
    console.log(logger.rainbow(`🛑 ═══ ${signal} 신호 수신 ═══`));
    console.log(logger.gradient("우아한 종료 시작...", "yellow", "red"));

    try {
      this.stats.gracefulShutdowns++;

      // 정리 작업
      await this.cleanup();

      console.log(logger.gradient("✅ 우아한 종료 완료", "green", "blue"));
      console.log(logger.rainbow("✅ ══════════════════"));

      logger.success("✅ 정상 종료 완료");
      process.exit(0);
    } catch (error) {
      console.log(
        logger.gradient(`❌ 종료 중 오류: ${error.message}`, "red", "orange")
      );
      logger.error("종료 중 오류:", error);
      process.exit(1);
    }
  }

  /**
   * 🧹 정리 작업 (수정된 버전)
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
