// ========================================
// 🤖 doomock_bot.js v3.0.1 - 알록달록 메인 엔트리
// ========================================
// LoggerEnhancer + BotController 완벽 통합!
// ========================================

require("dotenv").config();
const logger = require("./src/utils/Logger");
const BotController = require("./src/controllers/BotController");
const { getRegistryStats } = require("./src/config/ModuleRegistry");
const TimeHelper = require("./src/utils/TimeHelper");

/**
 * 🚀 DooMockBot v3.0.1 - 알록달록 메인 클래스
 *
 * ✨ 새로운 기능들:
 * - 🌈 LoggerEnhancer 알록달록 시작 배너
 * - 📊 실시간 시스템 모니터링
 * - 🎨 화려한 상태 표시
 * - 🚂 Railway 최적화
 * - 🛡️ 강화된 오류 처리
 */
class DooMockBot {
  constructor() {
    this.botController = null;
    this.isRunning = false;
    this.startTime = Date.now();

    // 🌈 LoggerEnhancer 활용
    this.messageSystem = logger.messageSystem;

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

    // 🌈 화려한 생성자 완료 로그
    console.log(
      this.messageSystem.rainbow("🤖 DooMockBot v3.0.1 인스턴스 생성됨")
    );
  }

  /**
   * 🎯 봇 시작 (알록달록 시작 시퀀스!)
   */
  async start() {
    try {
      // 🌈 화려한 시작 배너
      this.showWelcomeBanner();

      // 📋 환경 정보 표시
      this.showEnvironmentInfo();

      // 🎯 시작 단계별 진행
      await this.executeStartupSequence();

      // 🎉 시작 완료 축하
      this.celebrateStartup();
    } catch (error) {
      await this.handleStartupError(error);
    }
  }

  /**
   * 🌈 화려한 환영 배너
   */
  showWelcomeBanner() {
    console.clear();

    // ASCII 아트 배너 (알록달록!)
    const bannerLines = [
      "██████╗  ██████╗  ██████╗ ███╗   ███╗ ██████╗  ██████╗██╗  ██╗",
      "██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║██╔═══██╗██╔════╝██║ ██╔╝",
      "██║  ██║██║   ██║██║   ██║██╔████╔██║██║   ██║██║     █████╔╝ ",
      "██║  ██║██║   ██║██║   ██║██║╚██╔╝██║██║   ██║██║     ██╔═██╗ ",
      "██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║╚██████╔╝╚██████╗██║  ██╗",
      "╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝",
    ];

    bannerLines.forEach((line, index) => {
      const colors = ["cyan", "magenta", "yellow", "green", "blue", "purple"];
      const color1 = colors[index % colors.length];
      const color2 = colors[(index + 1) % colors.length];
      console.log(this.messageSystem.gradient(line, color1, color2));
    });

    console.log();
    console.log(
      this.messageSystem.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log(
      this.messageSystem.gradient(
        "                    두목봇 v3.0.1 알록달록 에디션",
        "cyan",
        "magenta"
      )
    );
    console.log(
      this.messageSystem.gradient(
        "                     Enhanced with LoggerEnhancer",
        "purple",
        "blue"
      )
    );
    console.log(
      this.messageSystem.rainbow(
        "🌈 ═══════════════════════════════════════════════════════════════ 🌈"
      )
    );
    console.log();
  }

  /**
   * 📋 환경 정보 표시 (알록달록!)
   */
  showEnvironmentInfo() {
    console.log(this.messageSystem.rainbow("📋 ═══ 환경 정보 ═══"));

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
      console.log(
        this.messageSystem.gradient(`   ${key}: ${value}`, "blue", "cyan")
      );
    }

    // Railway 환경 감지
    if (process.env.RAILWAY_ENVIRONMENT_NAME) {
      console.log();
      console.log(
        this.messageSystem.gradient("🚂 Railway 환경 감지!", "purple", "pink")
      );
      console.log(
        this.messageSystem.gradient(
          `   📦 프로젝트: ${process.env.RAILWAY_ENVIRONMENT_NAME}`,
          "green",
          "blue"
        )
      );
      console.log(
        this.messageSystem.gradient(
          `   🔗 서비스: ${process.env.RAILWAY_SERVICE_NAME || "N/A"}`,
          "yellow",
          "orange"
        )
      );
    }

    console.log(this.messageSystem.rainbow("📋 ══════════════════"));
    console.log();
  }

  /**
   * 🎯 시작 시퀀스 실행
   */
  async executeStartupSequence() {
    const steps = [
      { name: "🔧 환경 변수 검증", action: () => this.validateEnvironment() },
      {
        name: "📦 모듈 레지스트리 확인",
        action: () => this.checkModuleRegistry(),
      },
      {
        name: "🤖 BotController 생성",
        action: () => this.createBotController(),
      },
      {
        name: "🎯 BotController 초기화",
        action: () => this.initializeBotController(),
      },
      {
        name: "🔗 프로세스 핸들러 설정",
        action: () => this.setupProcessHandlers(),
      },
      { name: "🚀 텔레그램 봇 시작", action: () => this.startTelegramBot() },
    ];

    console.log(this.messageSystem.rainbow("🎯 ═══ 시작 시퀀스 실행 ═══"));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const progress = Math.round(((i + 1) / steps.length) * 100);

      try {
        // 🎭 로딩 애니메이션
        const loadingEmoji = this.getRandomEmoji(
          this.startupAnimations.loading
        );
        console.log(
          this.messageSystem.gradient(
            `${loadingEmoji} ${step.name}...`,
            "blue",
            "purple"
          )
        );

        // 단계 실행
        await step.action();

        // 🎉 성공 표시
        const successEmoji = this.getRandomEmoji(
          this.startupAnimations.success
        );
        console.log(
          this.messageSystem.gradient(
            `${successEmoji} ${step.name} 완료 (${progress}%)`,
            "green",
            "blue"
          )
        );

        // 진행률 바 표시
        this.showProgressBar(i + 1, steps.length);
      } catch (error) {
        const errorEmoji = this.getRandomEmoji(this.startupAnimations.error);
        console.log(
          this.messageSystem.gradient(
            `${errorEmoji} ${step.name} 실패!`,
            "red",
            "orange"
          )
        );
        throw error;
      }
    }

    console.log();
    console.log(this.messageSystem.rainbow("✅ 모든 시작 단계 완료!"));
  }

  /**
   * 📊 진행률 바 표시
   */
  showProgressBar(current, total, width = 30) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    const filledBar = "█".repeat(filled);
    const emptyBar = "░".repeat(empty);

    const progressBar =
      this.messageSystem.gradient(filledBar, "green", "blue") +
      this.messageSystem.gradient(emptyBar, "gray", "white");

    console.log(
      this.messageSystem.gradient(
        `   [${progressBar}] ${percentage}%`,
        "cyan",
        "purple"
      )
    );
  }

  /**
   * 🔧 환경 변수 검증
   */
  async validateEnvironment() {
    const requiredEnvVars = ["BOT_TOKEN", "MONGO_URI"];

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
      this.messageSystem.gradient(
        "   ✅ 모든 환경 변수 검증 완료",
        "green",
        "blue"
      )
    );
  }

  /**
   * 📦 모듈 레지스트리 확인
   */
  async checkModuleRegistry() {
    const registryStats = getRegistryStats();

    console.log(
      this.messageSystem.gradient(
        `   📊 총 모듈: ${registryStats.totalModules}개`,
        "blue",
        "cyan"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `   ✅ 활성화: ${registryStats.enabledModules}개`,
        "green",
        "blue"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `   ⭐ Enhanced: ${registryStats.enhancedModules}개`,
        "yellow",
        "orange"
      )
    );

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
    console.log(
      this.messageSystem.gradient(
        "   🔧 BotController 인스턴스 생성 중...",
        "purple",
        "pink"
      )
    );

    this.botController = new BotController();

    console.log(
      this.messageSystem.gradient(
        "   ✅ BotController 생성 완료",
        "green",
        "blue"
      )
    );
  }

  /**
   * 🎯 BotController 초기화
   */
  async initializeBotController() {
    console.log(
      this.messageSystem.gradient(
        "   ⚙️ BotController 초기화 중...",
        "blue",
        "purple"
      )
    );

    await this.botController.initialize();

    console.log(
      this.messageSystem.gradient(
        "   ✅ BotController 초기화 완료",
        "green",
        "blue"
      )
    );
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
      console.log(
        this.messageSystem.gradient(
          `💥 처리되지 않은 예외: ${error.message}`,
          "red",
          "darkred"
        )
      );
      logger.fatal("처리되지 않은 예외", error);
      this.stats.criticalErrors++;
      this.shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      console.log(
        this.messageSystem.gradient(
          `💥 처리되지 않은 Promise 거부: ${reason}`,
          "red",
          "darkred"
        )
      );
      logger.fatal("처리되지 않은 Promise 거부", reason);
      this.stats.criticalErrors++;
      this.shutdown("unhandledRejection");
    });

    console.log(
      this.messageSystem.gradient(
        "   ✅ 프로세스 핸들러 설정 완료",
        "green",
        "blue"
      )
    );
  }

  /**
   * 🚀 텔레그램 봇 시작
   */
  async startTelegramBot() {
    console.log(
      this.messageSystem.gradient(
        "   🚀 텔레그램 서비스 시작 중...",
        "cyan",
        "magenta"
      )
    );

    await this.botController.start();
    this.isRunning = true;

    console.log(
      this.messageSystem.gradient(
        "   ✅ 텔레그램 봇 시작 완료",
        "green",
        "blue"
      )
    );
  }

  /**
   * 🎉 시작 완료 축하
   */
  celebrateStartup() {
    console.log();
    console.log(
      this.messageSystem.rainbow(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log(
      this.messageSystem.gradient(
        "                     🤖 두목봇 시작 완료! 🤖",
        "green",
        "blue"
      )
    );
    console.log(
      this.messageSystem.rainbow(
        "🎉 ═══════════════════════════════════════════════════════════════ 🎉"
      )
    );
    console.log();

    // 🎊 성공 통계 표시
    this.showStartupSuccess();

    // 🎨 운영 상태 표시
    this.showOperationalStatus();

    // 🔔 준비 완료 알림
    logger.celebration("🎊 두목봇 v3.0.1 알록달록 모드로 서비스 시작!");
  }

  /**
   * 🎊 시작 성공 통계
   */
  showStartupSuccess() {
    const startupTime = Date.now() - this.startTime;
    const memoryUsage = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );

    console.log(this.messageSystem.rainbow("📊 ═══ 시작 통계 ═══"));
    console.log(
      this.messageSystem.gradient(
        `⚡ 시작 시간: ${startupTime}ms`,
        "green",
        "blue"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `💾 메모리 사용: ${memoryUsage}MB`,
        "cyan",
        "purple"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `🔄 재시작 횟수: ${this.stats.restartCount}회`,
        "yellow",
        "orange"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `❌ 크리티컬 오류: ${this.stats.criticalErrors}건`,
        "red",
        "orange"
      )
    );
    console.log(this.messageSystem.rainbow("📊 ═════════════════"));
  }

  /**
   * 🎨 운영 상태 표시
   */
  showOperationalStatus() {
    console.log();
    console.log(this.messageSystem.rainbow("🎨 ═══ 운영 상태 ═══"));
    console.log(
      this.messageSystem.gradient("🟢 봇 서비스: 정상 운영", "green", "blue")
    );
    console.log(
      this.messageSystem.gradient("🌈 알록달록 모드: 활성화", "purple", "pink")
    );
    console.log(
      this.messageSystem.gradient("📱 사용자 요청: 대기 중", "cyan", "magenta")
    );
    console.log(
      this.messageSystem.gradient(
        "🔔 모니터링: 실시간 활성",
        "yellow",
        "orange"
      )
    );
    console.log(this.messageSystem.rainbow("🎨 ══════════════════"));
    console.log();
  }

  /**
   * ❌ 시작 오류 처리
   */
  async handleStartupError(error) {
    console.log();
    console.log(
      this.messageSystem.gradient("💥 ═══ 시작 실패 ═══", "red", "darkred")
    );
    console.log(
      this.messageSystem.gradient(`❌ 오류: ${error.message}`, "red", "orange")
    );
    console.log(
      this.messageSystem.gradient(
        `🕐 발생 시간: ${TimeHelper.format(new Date(), "full")}`,
        "gray",
        "white"
      )
    );

    if (error.stack) {
      console.log(
        this.messageSystem.gradient("📋 스택 트레이스:", "gray", "red")
      );
      console.log(error.stack);
    }

    console.log(
      this.messageSystem.gradient("💥 ══════════════════", "red", "darkred")
    );

    logger.fatal("💥 봇 시작 실패", error);
    this.stats.criticalErrors++;

    await this.cleanup();
    process.exit(1);
  }

  /**
   * 🚪 우아한 종료
   */
  async shutdown(signal) {
    if (!this.isRunning) return;

    console.log();
    console.log(this.messageSystem.rainbow("🚪 ═══ 우아한 종료 시작 ═══"));
    console.log(
      this.messageSystem.gradient(`📥 종료 신호: ${signal}`, "yellow", "orange")
    );
    console.log(
      this.messageSystem.gradient(
        `🕐 종료 시간: ${TimeHelper.format(new Date(), "full")}`,
        "gray",
        "white"
      )
    );

    this.isRunning = false;
    this.stats.gracefulShutdowns++;

    try {
      // 총 가동시간 계산
      const totalUptime = Date.now() - this.startTime;
      this.stats.totalUptime += totalUptime;

      // 🎊 가동 통계 표시
      console.log();
      console.log(this.messageSystem.rainbow("📊 ═══ 가동 통계 ═══"));
      console.log(
        this.messageSystem.gradient(
          `⏰ 이번 세션: ${this.formatUptime(totalUptime)}`,
          "blue",
          "cyan"
        )
      );
      console.log(
        this.messageSystem.gradient(
          `🔄 총 가동시간: ${this.formatUptime(this.stats.totalUptime)}`,
          "green",
          "blue"
        )
      );
      console.log(
        this.messageSystem.gradient(
          `🚪 정상 종료: ${this.stats.gracefulShutdowns}회`,
          "purple",
          "pink"
        )
      );
      console.log(this.messageSystem.rainbow("📊 ═══════════════"));

      // 정리 작업 실행
      await this.cleanup();

      // 🎉 종료 완료
      console.log();
      console.log(this.messageSystem.rainbow("✅ ═══ 종료 완료 ═══"));
      console.log(
        this.messageSystem.gradient(
          "🙏 두목봇을 이용해주셔서 감사합니다!",
          "green",
          "blue"
        )
      );
      console.log(this.messageSystem.rainbow("✅ ══════════════════"));

      logger.success("✅ 정상 종료 완료");
      process.exit(0);
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ 종료 중 오류: ${error.message}`,
          "red",
          "orange"
        )
      );
      logger.error("종료 중 오류:", error);
      process.exit(1);
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    console.log(
      this.messageSystem.gradient("🧹 정리 작업 시작...", "yellow", "orange")
    );

    try {
      if (this.botController) {
        console.log(
          this.messageSystem.gradient(
            "   🤖 BotController 정리...",
            "blue",
            "purple"
          )
        );
        await this.botController.cleanup();
        console.log(
          this.messageSystem.gradient(
            "   ✅ BotController 정리 완료",
            "green",
            "blue"
          )
        );
      }

      // 메모리 정리
      this.botController = null;

      console.log(
        this.messageSystem.gradient("✅ 모든 정리 작업 완료", "green", "blue")
      );
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ 정리 중 오류: ${error.message}`,
          "red",
          "orange"
        )
      );
      logger.error("정리 작업 중 오류:", error);
    }
  }

  /**
   * 🎭 랜덤 이모지 선택
   */
  getRandomEmoji(emojiArray) {
    return emojiArray[Math.floor(Math.random() * emojiArray.length)];
  }

  /**
   * ⏰ 가동시간 포맷
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  /**
   * 📊 봇 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      stats: this.stats,
      botController: this.botController?.getStatus() || null,
      version: "3.0.1",
      rainbow: true,
    };
  }
}

// ========================================
// 🚀 애플리케이션 시작
// ========================================

if (require.main === module) {
  // 🌈 최초 시작 메시지
  console.log(
    logger.messageSystem.rainbow("🚀 두목봇 v3.0.1 애플리케이션 시작...")
  );

  const bot = new DooMockBot();

  bot.start().catch((error) => {
    console.log(
      logger.messageSystem.gradient(
        `💥 애플리케이션 시작 실패: ${error.message}`,
        "red",
        "darkred"
      )
    );
    logger.fatal("애플리케이션 시작 실패", error);
    process.exit(1);
  });
}

// ========================================
// 🎯 모듈 내보내기
// ========================================

module.exports = DooMockBot;
