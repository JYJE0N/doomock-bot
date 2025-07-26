// ===== 4. doomock_bot.js - 간결한 메인 엔트리 =====
require("dotenv").config();

const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");
const ServiceBuilder = require("./src/core/ServiceBuilder");
const HealthChecker = require("./src/utils/HealthChecker");

// 🔧 설정 및 DB 관리
const { getConfig } = require("./src/config/ConfigManager");
const {
  getInstance: getDatabaseManager,
} = require("./src/database/DatabaseManager");

/**
 * 🤖 DooMockBot v3.0.1 - 간결한 메인 엔트리
 *
 * 🎯 책임:
 * 1. 컴포넌트들 순차 초기화
 * 2. 시작/종료 관리
 * 3. 에러 처리 및 복구
 *
 * ✨ 특징:
 * - AppConfig에서 모든 설정 통합 관리
 * - 중복 코드 제거로 간결함
 * - 컴포넌트 조합에만 집중
 */
class DooMockBot {
  constructor() {
    this.startTime = Date.now();
    this.version = "3.0.1";
    this.components = new Map();
    this.isShuttingDown = false;

    // ✅ ConfigManager 인스턴스 (설정은 ConfigManager에서 모두 처리)
    this.configManager = getConfig();

    // ✅ ConfigManager에서 처리된 환경 정보만 가져오기
    const env = this.configManager.get("environment");
    this.isRailway = env.isRailway;
    this.isDevelopment = env.isDevelopment;

    // 통계
    this.stats = {
      startTime: this.startTime,
      initializationAttempts: 0,
      componentInitTimes: new Map(),
      lastError: null,
    };

    logger.info(`🤖 DooMockBot v${this.version} 생성됨`);

    // ✅ 설정 요약 출력 (ConfigManager가 알아서 처리)
    this.configManager.printSummary();
  }

  /**
   * 🚀 애플리케이션 시작
   */
  async start() {
    this.stats.initializationAttempts++;

    try {
      logger.info(`🚀 DooMockBot v${this.version} 시작 중...`);

      // 프로세스 핸들러 등록
      this.setupProcessHandlers();

      // 설정 검증
      this.validateConfig();

      // 🗄️ DB 초기화 (AppConfig 기반)
      const dbConnected = await this.initializeDatabase();

      // 컴포넌트 초기화
      await this.initializeComponents(dbConnected);

      // 시작 완료
      await this.completeStartup();
    } catch (error) {
      await this.handleStartupFailure(error);
    }
  }

  /**
   * ✅ 설정 검증 (ConfigManager에서 이미 처리됨)
   */
  validateConfig() {
    // ✅ ConfigManager에서 이미 검증 완료된 결과만 확인
    const validation = this.configManager.getAll().validation;

    if (!validation.isValid && validation.errors.length > 0) {
      throw new Error(`필수 설정 오류: ${validation.errors.join(", ")}`);
    }

    logger.debug("✅ 설정 검증 완료 (ConfigManager에서 처리됨)");
  }

  /**
   * 🗄️ 데이터베이스 초기화 (느슨한 결합)
   */
  async initializeDatabase() {
    logger.info("🗄️ 데이터베이스 초기화 중...");

    try {
      // ConfigManager에서 DB 설정 받아서 DatabaseManager에 주입
      const dbConfig = this.configManager.getForDatabase();

      if (!dbConfig.url) {
        logger.warn("⚠️ MongoDB URL이 없어 DB 없이 실행");
        return false;
      }

      // DatabaseManager 생성 (설정 주입)
      const dbManager = getDatabaseManager(dbConfig);

      // 연결 시도
      const connected = await dbManager.connect();

      if (connected) {
        this.components.set("dbManager", dbManager);

        const status = dbManager.getStatus();
        logger.success(`✅ 데이터베이스 연결됨 (${status.database})`);
        logger.debug(
          `🗄️ 스키마 검증: ${
            status.config.validationEnabled ? "활성" : "비활성"
          }`
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 실패:", error);

      // 필수가 아니면 계속 진행
      if (this.configManager.get("database.required") !== true) {
        logger.warn("⚠️ DB 없이 제한 모드로 실행");
        return false;
      }

      throw error;
    }
  }

  /**
   * 🧩 컴포넌트 초기화
   */
  async initializeComponents(withDb) {
    const sequence = [
      { name: "1️⃣ Telegraf 봇", handler: this.initializeTelegrafBot },
      {
        name: "2️⃣ 서비스 빌더",
        handler: () => this.initializeServiceBuilder(withDb),
      },
      {
        name: "3️⃣ 모듈 매니저",
        handler: () => this.initializeModuleManager(withDb),
      },
      { name: "4️⃣ 봇 컨트롤러", handler: this.initializeBotController },
      { name: "5️⃣ 헬스체커", handler: this.initializeHealthChecker },
      { name: "6️⃣ 봇 런처", handler: this.launchBot },
    ];

    for (const step of sequence) {
      await this.executeStepWithRetry(step);
    }
  }

  async initializeTelegrafBot() {
    // ✅ ConfigManager에서 처리된 봇 설정 가져오기
    const botConfig = this.configManager.getForBot();
    const bot = new Telegraf(botConfig.token);

    // ✅ Rate limiting (ConfigManager에서 처리된 설정 사용)
    if (botConfig.rateLimit.enabled) {
      const userLimits = new Map();
      const maxRequests = botConfig.rateLimit.maxRequestsPerMinute;

      bot.use((ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const now = Date.now();
        const userLimit = userLimits.get(userId) || {
          count: 0,
          resetTime: now,
        };

        if (now > userLimit.resetTime + 60000) {
          userLimit.count = 0;
          userLimit.resetTime = now;
        }

        if (userLimit.count >= maxRequests) {
          return ctx.reply(
            "⚠️ 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          );
        }

        userLimit.count++;
        userLimits.set(userId, userLimit);
        return next();
      });
    }

    // 에러 핸들러
    bot.catch((error, ctx) => {
      logger.error("🚨 Telegraf 오류:", error);
      try {
        ctx.reply("❌ 처리 중 오류가 발생했습니다.");
      } catch (replyError) {
        logger.error("에러 응답 실패:", replyError);
      }
    });

    this.components.set("bot", bot);
    logger.debug("✅ Telegraf 봇 초기화 완료");
  }

  async initializeServiceBuilder(withDb) {
    const options = withDb
      ? {
          dbManager: this.components.get("dbManager"),
          config: this.configManager.getAll(),
        }
      : {
          dbManager: null,
          config: this.configManager.getAll(),
        };

    await ServiceBuilder.initialize(options);
    this.components.set("serviceBuilder", ServiceBuilder);

    logger.debug("✅ ServiceBuilder 초기화 완료");
  }

  async initializeModuleManager(withDb) {
    // ✅ ConfigManager에서 처리된 시스템 설정 사용
    const systemConfig = this.configManager.get("system");
    const healthConfig = this.configManager.get("health");

    const options = {
      bot: this.components.get("bot"),
      serviceBuilder: this.components.get("serviceBuilder"),
      config: {
        ...systemConfig,
        enableAutoDiscovery: true,
        enableHealthCheck: withDb && healthConfig.enabled,
        dbEnabled: withDb,
      },
    };

    if (withDb) {
      options.dbManager = this.components.get("dbManager");
    }

    const moduleManager = new ModuleManager(options);
    await moduleManager.initialize();
    this.components.set("moduleManager", moduleManager);

    logger.debug("✅ ModuleManager 초기화 완료");
  }

  async initializeBotController() {
    const botController = new BotController({
      bot: this.components.get("bot"),
      moduleManager: this.components.get("moduleManager"),
      dbManager: this.components.get("dbManager"),
      config: this.configManager.getAll(),
    });

    await botController.initialize();
    this.components.set("botController", botController);

    logger.debug("✅ BotController 초기화 완료");
  }

  async initializeHealthChecker() {
    const healthConfig = this.configManager.getForHealth();

    if (!healthConfig.enabled) {
      logger.debug("⚠️ HealthChecker 비활성화됨");
      return;
    }

    const healthChecker = new HealthChecker({
      dbManager: this.components.get("dbManager"),
      moduleManager: this.components.get("moduleManager"),
      serviceBuilder: this.components.get("serviceBuilder"),
      botController: this.components.get("botController"),
      config: healthConfig,
    });

    this.components.set("healthChecker", healthChecker);

    // 지연 시작
    setTimeout(async () => {
      try {
        await healthChecker.start();
        logger.success("✅ HealthChecker 시작됨");
      } catch (error) {
        logger.error("❌ HealthChecker 시작 실패:", error);
      }
    }, 10000);

    logger.debug("✅ HealthChecker 초기화 완료");
  }

  async launchBot() {
    const bot = this.components.get("bot");
    const botConfig = this.configManager.getForBot();

    // 기존 연결 정리
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await this.sleep(3000);
    } catch (e) {
      logger.debug("기존 연결 정리 실패 (무시)");
    }

    // 봇 시작 방식 결정 (ConfigManager 기반)
    if (
      this.isRailway &&
      botConfig.webhook.enabled &&
      botConfig.webhook.domain
    ) {
      await this.startRailwayWebhook(bot, botConfig);
    } else {
      await this.startPollingMode(bot);
    }

    logger.debug("✅ 봇 런처 완료");
  }

  async startRailwayWebhook(bot, config) {
    const { port, domain } = config.webhook;
    logger.info(`🌐 Railway 웹훅 모드: https://${domain}:${port}`);

    const webhookUrl = `https://${domain}/webhook`;
    await bot.telegram.setWebhook(webhookUrl, {
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });

    await bot.launch({
      webhook: { domain: `https://${domain}`, port, hookPath: "/webhook" },
    });
  }

  async startPollingMode(bot) {
    logger.info("🔄 폴링 모드 시작");

    try {
      await bot.launch({
        polling: {
          timeout: 30,
          limit: 100,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        },
      });
    } catch (pollingError) {
      if (pollingError.response?.error_code === 409) {
        logger.warn("⚠️ 봇 중복 실행 감지! 복구 시도...");
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await this.sleep(10000);
        await this.startPollingMode(bot);
      } else {
        throw pollingError;
      }
    }
  }

  // ===== 유틸리티 메서드들 =====

  async executeStepWithRetry(step) {
    // ✅ ConfigManager에서 처리된 재시도 설정 사용
    const systemConfig = this.configManager.get("system");
    const maxRetries = systemConfig.startupMaxRetries;
    const backoffMs = systemConfig.startupRetryBackoff;
    const timeout = systemConfig.componentTimeout;

    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🔧 ${step.name} 초기화 중... (${attempt}/${maxRetries})`);

        await Promise.race([
          step.handler.call(this),
          this.createTimeoutPromise(timeout, step.name),
        ]);

        const stepTime = Date.now() - startTime;
        this.stats.componentInitTimes.set(step.name, stepTime);
        logger.success(`✅ ${step.name} 완료 (${stepTime}ms)`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(
          `⚠️ ${step.name} 실패 (${attempt}/${maxRetries}): ${error.message}`
        );

        if (attempt < maxRetries) {
          const delay = backoffMs * attempt;
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `${step.name} 최대 재시도 횟수 초과: ${lastError?.message}`
    );
  }

  createTimeoutPromise(timeout, stepName) {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${stepName} 타임아웃 (${timeout}ms)`)),
        timeout
      );
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async completeStartup() {
    const totalTime = Date.now() - this.startTime;
    const performanceConfig = this.configManager.getForPerformance();

    logger.success(`🎉 DooMockBot v${this.version} 시작 완료!`);
    logger.success(`⏱️  총 초기화 시간: ${totalTime}ms`);
    logger.success(`📊 초기화된 컴포넌트: ${this.components.size}개`);

    // DB 상태
    const dbManager = this.components.get("dbManager");
    if (dbManager) {
      const dbStatus = dbManager.getStatus();
      logger.success(
        `🗄️ 데이터베이스: ${dbStatus.database} (스키마: ${
          dbStatus.config.validationEnabled ? "ON" : "OFF"
        })`
      );
    } else {
      logger.warn("🗄️ 데이터베이스: 연결 안됨 (제한 모드)");
    }

    // Railway 메모리 모니터링
    if (this.isRailway) {
      this.startRailwayMonitoring(performanceConfig);
    }
  }

  startRailwayMonitoring(config) {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (heapUsedMB > config.memoryThreshold) {
        logger.warn(
          `⚠️ Railway 메모리 사용량 높음: ${heapUsedMB}MB (임계값: ${config.memoryThreshold}MB)`
        );

        if (config.gcEnabled && global.gc) {
          global.gc();
          logger.debug("🧹 가비지 컬렉션 실행됨");
        }
      }
    }, 60000);
  }

  setupProcessHandlers() {
    process.once("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.once("SIGTERM", () => this.gracefulShutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      this.gracefulShutdown("unhandledRejection");
    });
  }

  async gracefulShutdown(reason) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`🛑 우아한 종료 시작 (이유: ${reason})`);

    try {
      const cleanupTasks = [];

      ["healthChecker", "bot", "moduleManager", "dbManager"].forEach(
        (component) => {
          if (this.components.has(component)) {
            cleanupTasks.push(this.cleanupComponent(component));
          }
        }
      );

      await Promise.allSettled(cleanupTasks);
      this.components.clear();

      logger.success("✅ 우아한 종료 완료");
    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
    } finally {
      process.exit(
        reason === "uncaughtException" || reason === "unhandledRejection"
          ? 1
          : 0
      );
    }
  }

  async cleanupComponent(name) {
    try {
      const component = this.components.get(name);

      if (name === "dbManager" && component.disconnect) {
        await component.disconnect();
      } else if (name === "bot" && component.stop) {
        component.stop("cleanup");
      } else if (component.cleanup) {
        await component.cleanup();
      }

      logger.debug(`✅ ${name} 정리됨`);
    } catch (error) {
      logger.warn(`⚠️ ${name} 정리 실패:`, error.message);
    }
  }

  async handleStartupFailure(error) {
    this.stats.lastError = {
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    logger.error(`💥 DooMockBot 시작 실패:`, error);
    await this.gracefulShutdown("startup_failure");
  }

  getStatus() {
    return {
      version: this.version,
      uptime: Date.now() - this.startTime,
      components: Array.from(this.components.keys()),
      config: this.configManager.getAll().environment,
      database: this.components.get("dbManager")?.getStatus() || null,
      stats: this.stats,
    };
  }
}

// 🚀 애플리케이션 시작
if (require.main === module) {
  const app = new DooMockBot();
  app.start().catch((error) => {
    logger.error("🚨 애플리케이션 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
