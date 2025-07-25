// doomock_bot.js - 메인 엔트리 포인트 v3.0.1 (완전 표준화 리팩토링)

/**
 * 🚀 Doomock Bot v3.0.1 - 메인 엔트리 포인트
 * - 완전 표준화된 초기화 프로세스
 * - Railway 환경 완벽 최적화
 * - BaseModule 상속 구조 지원
 * - ModuleManager 중앙집중식 관리
 * - 견고한 에러 처리 및 복구
 * - 한국 표준시 적용
 */

const path = require("path");

// 핵심 클래스들
const TelegramBot = require("node-telegram-bot-api");
const logger = require("./src/utils/Logger");
const { AppConfig } = require("./src/config/AppConfig");
const TimeHelper = require("./src/utils/TimeHelper");

/**
 * 🤖 Doomock Bot 메인 클래스
 * - 표준화된 7단계 초기화 프로세스
 * - Railway 환경 완벽 지원
 * - 중앙집중식 의존성 주입
 * - 완벽한 정리 작업
 */
class DoomockBot {
  constructor() {
    // 🎯 핵심 컴포넌트들
    this.config = null;
    this.bot = null;
    this.dbManager = null;
    this.moduleManager = null;
    this.botController = null;
    this.commandsRegistry = null;

    // 🎛️ 상태 관리
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = TimeHelper.getTimestamp();

    // 📊 시스템 통계
    this.stats = {
      startTime: this.startTime,
      initializationTime: null,
      uptime: 0,
      memoryUsage: {},
      environmentInfo: {},
    };

    // 🚫 초기화 단계별 타임아웃
    this.initTimeouts = {
      config: 5000,
      bot: 10000,
      database: 30000,
      modules: 45000,
      controller: 15000,
      commands: 20000,
      polling: 10000,
    };

    logger.info("🤖 DoomockBot v3.0.1 인스턴스 생성됨");
  }

  /**
   * 🚀 봇 시작 (완전 표준화 프로세스)
   */
  async start() {
    const overallTimer = TimeHelper.createTimer();

    try {
      this.printStartupBanner();

      // ✅ 7단계 초기화 프로세스 (표준)
      await this.executeInitializationSequence();

      // ✅ 시스템 준비 완료
      await this.finalizeStartup(overallTimer);
    } catch (error) {
      await this.handleStartupFailure(error);
    }
  }

  /**
   * 🎨 시작 배너 출력
   */
  printStartupBanner() {
    const banner = `
============================================
🚀 Doomock Bot v3.0.1 시작
============================================
⏰ 시작 시간: ${TimeHelper.getLogTimeString()}
🌍 환경: ${process.env.NODE_ENV || "development"}
🚂 Railway: ${process.env.RAILWAY_ENVIRONMENT ? "활성" : "비활성"}
📦 Node.js: ${process.version}
🎯 PID: ${process.pid}
============================================`;

    logger.info(banner);
  }

  /**
   * 🔄 초기화 시퀀스 실행 (7단계)
   */
  async executeInitializationSequence() {
    const sequence = [
      {
        name: "설정 로드",
        method: "loadConfig",
        timeout: this.initTimeouts.config,
      },
      {
        name: "텔레그램 봇 초기화",
        method: "initializeBot",
        timeout: this.initTimeouts.bot,
      },
      {
        name: "데이터베이스 연결",
        method: "initializeDatabase",
        timeout: this.initTimeouts.database,
      },
      {
        name: "명령어 레지스트리 초기화",
        method: "initializeCommandsRegistry",
        timeout: this.initTimeouts.commands,
      },
      {
        name: "모듈 매니저 초기화",
        method: "initializeModules",
        timeout: this.initTimeouts.modules,
      },
      {
        name: "봇 컨트롤러 초기화",
        method: "initializeController",
        timeout: this.initTimeouts.controller,
      },
      {
        name: "봇 폴링 시작",
        method: "startPolling",
        timeout: this.initTimeouts.polling,
      },
    ];

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const stepTimer = TimeHelper.createTimer();

      try {
        logger.info(`📋 ${i + 1}/7단계: ${step.name} 중...`);

        // 타임아웃과 함께 실행
        await this.executeWithTimeout(
          this[step.method].bind(this),
          step.timeout
        );

        const duration = stepTimer.end();
        logger.success(`✅ ${step.name} 완료 (${duration}ms)`);
      } catch (error) {
        const duration = stepTimer.end();
        logger.error(`❌ ${step.name} 실패 (${duration}ms):`, error);

        // 중요하지 않은 단계는 경고만 출력하고 계속 진행
        if (this.isOptionalStep(step.method)) {
          logger.warn(`⚠️ ${step.name} 실패했지만 계속 진행`);
          continue;
        }

        throw new Error(`${step.name} 실패: ${error.message}`);
      }
    }
  }

  /**
   * ⏱️ 타임아웃과 함께 메서드 실행
   */
  async executeWithTimeout(method, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`초기화 타임아웃 (${timeout}ms 초과)`));
      }, timeout);

      method()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 🔍 선택적 단계 여부 확인
   */
  isOptionalStep(methodName) {
    const optionalSteps = [
      "initializeCommandsRegistry", // 명령어 레지스트리는 선택적
    ];
    return optionalSteps.includes(methodName);
  }

  /**
   * 📄 1단계: 설정 로드 (표준)
   */
  async loadConfig() {
    try {
      this.config = AppConfig.getConfig();

      // 설정 유효성 검증
      const validation = this.config.validateConfig();
      if (!validation.isValid) {
        throw new Error(`설정 검증 실패: ${validation.issues.join(", ")}`);
      }

      // 환경 정보 저장
      this.stats.environmentInfo = this.config.getEnvironmentInfo();

      logger.info(
        `   🌍 환경: ${this.config.isRailwayEnvironment() ? "Railway" : "로컬"}`
      );
      logger.info(
        `   🔐 토큰: ${this.config.get("bot.token") ? "✅ 설정됨" : "❌ 없음"}`
      );
      logger.info(
        `   💾 DB: ${this.config.get("database.url") ? "✅ 연결됨" : "❌ 없음"}`
      );
    } catch (error) {
      throw new Error(`설정 로드 실패: ${error.message}`);
    }
  }

  /**
   * 🤖 2단계: 텔레그램 봇 초기화 (표준)
   */
  async initializeBot() {
    try {
      const botToken = this.config.get("bot.token");
      if (!botToken) {
        throw new Error("BOT_TOKEN이 설정되지 않음");
      }

      // Railway 환경에 최적화된 봇 옵션
      const botOptions = {
        polling: this.config.get("bot.polling.enabled", true)
          ? {
              interval: this.config.get("bot.polling.interval", 300),
              autoStart: false, // 수동으로 시작할 예정
              params: {
                timeout: this.config.get("bot.polling.timeout", 10),
              },
            }
          : false,
        webHook: this.config.get("bot.webhook.enabled", false)
          ? {
              port: this.config.get("bot.webhook.port", 3000),
              host: "0.0.0.0", // Railway 요구사항
            }
          : false,
        onlyFirstMatch: true,
        baseApiUrl: "https://api.telegram.org",
      };

      this.bot = new TelegramBot(botToken, botOptions);

      // 봇 정보 확인
      const botInfo = await this.bot.getMe();
      logger.info(`   🤖 봇: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      throw new Error(`텔레그램 봇 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 💾 3단계: 데이터베이스 연결 (표준)
   */
  async initializeDatabase() {
    try {
      const DatabaseManager = require("./src/core/DatabaseManager");

      this.dbManager = new DatabaseManager({
        url: this.config.get("database.url"),
        name: this.config.get("database.name"),
        options: {
          maxPoolSize: this.config.get("database.poolSize", 10),
          serverSelectionTimeoutMS: this.config.get("database.timeout", 30000),
          retryWrites: this.config.get("database.retryWrites", true),
        },
      });

      await this.dbManager.connect();

      const dbStatus = this.dbManager.getStatus();
      logger.info(`   💾 DB: ${dbStatus.name} (${dbStatus.status})`);
    } catch (error) {
      throw new Error(`데이터베이스 연결 실패: ${error.message}`);
    }
  }

  /**
   * 📋 4단계: 명령어 레지스트리 초기화 (선택적)
   */
  async initializeCommandsRegistry() {
    try {
      const BotCommandsRegistry = require("./src/config/BotCommandsRegistry");
      this.commandsRegistry = new BotCommandsRegistry();

      logger.info("   📋 명령어 레지스트리 준비됨");
    } catch (error) {
      logger.warn(
        "⚠️ 명령어 레지스트리 초기화 실패, 기본 기능만 사용:",
        error.message
      );
      this.commandsRegistry = null;
    }
  }

  /**
   * 📦 5단계: 모듈 매니저 초기화 (핵심)
   */
  async initializeModules() {
    try {
      const ModuleManager = require("./src/core/ModuleManager");

      this.moduleManager = new ModuleManager(this.bot, {
        db: this.dbManager,
        config: this.config,
        environment: this.stats.environmentInfo,
      });

      await this.moduleManager.initialize();

      const moduleStats = this.moduleManager.getInitializationStats();
      logger.info(
        `   📦 모듈: ${moduleStats.activeModules}/${moduleStats.totalModules}개 활성화`
      );

      if (moduleStats.failedModules > 0) {
        logger.warn(`   ⚠️ 실패한 모듈: ${moduleStats.failedModules}개`);
      }
    } catch (error) {
      throw new Error(`모듈 매니저 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🎮 6단계: 봇 컨트롤러 초기화 (핵심)
   */
  async initializeController() {
    try {
      const BotController = require("./src/controllers/BotController");

      this.botController = new BotController(this.bot, {
        dbManager: this.dbManager,
        moduleManager: this.moduleManager,
        commandsRegistry: this.commandsRegistry,
        config: {
          messageTimeout: this.config.get("performance.messageTimeout", 5000),
          callbackTimeout: this.config.get("performance.callbackTimeout", 1000),
          maxRetries: this.config.get("performance.maxRetries", 3),
          healthCheckInterval: this.config.get(
            "performance.healthCheckInterval",
            60000
          ),
          cleanupInterval: this.config.get(
            "performance.cleanupInterval",
            300000
          ),
        },
      });

      await this.botController.initialize();

      logger.info("   🎮 컨트롤러 준비됨");
    } catch (error) {
      throw new Error(`봇 컨트롤러 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 🚀 7단계: 봇 폴링 시작 (최종)
   */
  async startPolling() {
    try {
      if (this.config.get("bot.webhook.enabled", false)) {
        // 웹훅 모드
        const webhookPort = this.config.get("bot.webhook.port", 3000);
        await this.bot.setWebHook(this.config.get("bot.webhook.url"), {
          max_connections: 40,
          drop_pending_updates: false,
        });

        logger.info(`   🌐 웹훅 활성화 (포트: ${webhookPort})`);
      } else {
        // 폴링 모드 (기본값)
        await this.bot.startPolling({
          restart: true,
          polling: {
            interval: this.config.get("bot.polling.interval", 300),
            params: {
              timeout: this.config.get("bot.polling.timeout", 10),
            },
          },
        });

        logger.info("   🔄 폴링 활성화");
      }

      // BotFather 명령어 등록 (비동기로)
      this.registerBotCommandsAsync();
    } catch (error) {
      throw new Error(`봇 폴링 시작 실패: ${error.message}`);
    }
  }

  /**
   * 📋 BotFather 명령어 등록 (비동기)
   */
  async registerBotCommandsAsync() {
    if (!this.commandsRegistry) {
      return;
    }

    try {
      logger.info("📋 BotFather 명령어 등록 중...");

      const success = await this.commandsRegistry.setBotFatherCommands(
        this.bot
      );

      if (success) {
        const commandCount = this.commandsRegistry.getCommandCount();
        logger.success(`✅ ${commandCount}개 명령어 등록 완료`);
      } else {
        logger.warn("⚠️ 명령어 등록 부분 실패");
      }
    } catch (error) {
      logger.warn("⚠️ BotFather 명령어 등록 실패:", error.message);
    }
  }

  /**
   * ✅ 시작 완료 처리
   */
  async finalizeStartup(overallTimer) {
    const totalTime = overallTimer.end();
    this.stats.initializationTime = totalTime;
    this.isInitialized = true;
    this.isRunning = true;

    // 메모리 사용량 기록
    this.stats.memoryUsage = process.memoryUsage();

    const successBanner = `
============================================
✅ Doomock Bot v3.0.1 시작 완료!
============================================
⏱️ 초기화 시간: ${totalTime}ms
💾 메모리 사용량: ${Math.round(this.stats.memoryUsage.heapUsed / 1024 / 1024)}MB
🔗 모듈: ${this.moduleManager?.stats?.activeModules || 0}개 활성
🎯 상태: 정상 운영
============================================`;

    logger.success(successBanner);

    // Railway 환경에서 헬스체크 시작
    if (this.config.isRailwayEnvironment()) {
      this.startRailwayHealthCheck();
    }
  }

  /**
   * 💥 시작 실패 처리
   */
  async handleStartupFailure(error) {
    logger.error("💥 봇 시작 실패:", error);

    // 정리 작업 수행
    await this.performEmergencyCleanup();

    // Railway 환경에서는 재시도
    if (this.config?.isRailwayEnvironment()) {
      logger.info("🔄 Railway 환경에서 5초 후 재시도...");
      setTimeout(() => {
        process.exit(1); // Railway가 자동 재시작
      }, 5000);
    } else {
      process.exit(1);
    }
  }

  /**
   * 🚑 긴급 정리 작업
   */
  async performEmergencyCleanup() {
    try {
      logger.info("🚑 긴급 정리 작업 시작...");

      // 봇 정지
      if (this.bot) {
        try {
          await this.bot.stopPolling();
        } catch (e) {
          logger.debug("봇 폴링 정지 무시:", e.message);
        }
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        try {
          await this.dbManager.disconnect();
        } catch (e) {
          logger.debug("DB 연결 종료 무시:", e.message);
        }
      }

      logger.info("✅ 긴급 정리 완료");
    } catch (error) {
      logger.error("❌ 긴급 정리 실패:", error);
    }
  }

  /**
   * 🏥 Railway 헬스체크 시작
   */
  startRailwayHealthCheck() {
    const healthCheckInterval = this.config.get(
      "performance.healthCheckInterval",
      60000
    );

    setInterval(() => {
      this.performHealthCheck();
    }, healthCheckInterval);

    logger.info(`🏥 헬스체크 활성화 (${healthCheckInterval / 1000}초 간격)`);
  }

  /**
   * 🔍 헬스체크 수행
   */
  async performHealthCheck() {
    try {
      const health = {
        status: "healthy",
        uptime: Math.round(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        database: this.dbManager?.isConnected() || false,
        modules: this.moduleManager?.stats?.activeModules || 0,
        timestamp: TimeHelper.getLogTimeString(),
      };

      // 메모리 임계값 체크
      const memoryThreshold = this.config.get(
        "performance.memoryThreshold",
        400
      );
      if (health.memory.used > memoryThreshold) {
        logger.warn(
          `⚠️ 메모리 사용량 높음: ${health.memory.used}MB (임계값: ${memoryThreshold}MB)`
        );
      }

      logger.debug(
        `🏥 헬스체크: 정상 (메모리: ${health.memory.used}MB, 업타임: ${health.uptime}초)`
      );
    } catch (error) {
      logger.error("❌ 헬스체크 실패:", error);
    }
  }

  /**
   * 🛑 봇 정지 (정리 작업 포함)
   */
  async stop() {
    if (!this.isRunning) {
      logger.info("봇이 이미 정지됨");
      return;
    }

    try {
      logger.info("🛑 Doomock Bot 정지 시작...");
      this.isRunning = false;

      // 1. 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 2. 봇 컨트롤러 정리
      if (this.botController) {
        await this.botController.cleanup();
      }

      // 3. 봇 폴링 정지
      if (this.bot) {
        await this.bot.stopPolling();
        logger.info("   ✅ 봇 폴링 정지됨");
      }

      // 4. 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
        logger.info("   ✅ 데이터베이스 연결 종료됨");
      }

      const runtime = Math.round(process.uptime());
      logger.success(`✅ Doomock Bot 정지 완료 (런타임: ${runtime}초)`);
    } catch (error) {
      logger.error("❌ 봇 정지 중 오류:", error);
    }
  }

  /**
   * 📊 봇 상태 조회
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: Math.round(process.uptime()),
      stats: this.stats,
      environment: this.stats.environmentInfo,
      components: {
        config: !!this.config,
        bot: !!this.bot,
        database: this.dbManager?.isConnected() || false,
        modules: this.moduleManager?.stats?.activeModules || 0,
        controller: !!this.botController,
      },
    };
  }
}

/**
 * 🚀 메인 실행 함수 (Railway 최적화)
 */
async function main() {
  // 환경 체크
  if (!process.env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  const bot = new DoomockBot();

  // 프로세스 종료 신호 처리 (Railway 환경 고려)
  const gracefulShutdown = async (signal) => {
    logger.info(`🛑 ${signal} 신호 수신 - 정리 시작`);

    try {
      await bot.stop();
      logger.info("✅ 정리 완료");
      process.exit(0);
    } catch (error) {
      logger.error("❌ 정리 중 오류:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // 처리되지 않은 예외 처리 (Railway 환경에서 중요)
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("💥 처리되지 않은 Promise 거부:", reason);
    logger.error("   위치:", promise);

    // Railway 환경에서는 재시작 유도
    if (process.env.RAILWAY_ENVIRONMENT) {
      setTimeout(() => process.exit(1), 1000);
    }
  });

  process.on("uncaughtException", (error) => {
    logger.error("💥 처리되지 않은 예외:", error);

    // 긴급 정리 후 종료
    bot.performEmergencyCleanup().finally(() => process.exit(1));
  });

  // 봇 시작
  await bot.start();
}

// 직접 실행시만 main 함수 호출
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
