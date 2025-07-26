// doomock_bot.js - v3.0.1 ConfigManager 중앙 설정 시스템 완전 활용

// ✅ 최우선: dotenv 로드 (환경변수 읽기 전에 반드시 필요!)
require("dotenv").config();

const { Telegraf } = require("telegraf");
const logger = require("./src/utils/Logger");

// 🏗️ 핵심 시스템들
const BotController = require("./src/controllers/BotController");
const ModuleManager = require("./src/core/ModuleManager");
const ServiceBuilder = require("./src/core/ServiceBuilder");

// 🛡️ 중앙 시스템들
const ValidationManager = require("./src/utils/ValidationHelper");
const HealthChecker = require("./src/utils/HealthChecker");

// ✅ 핵심: ConfigManager 중앙 설정 시스템 완전 활용 (올바른 경로)
const { getConfig } = require("./src/config/ConfigManager");
const {
  getInstance: getDatabaseManager,
} = require("./src/database/DatabaseManager");

/**
 * 🚀 메인 애플리케이션 v3.0.1 - ConfigManager 중앙 설정 시스템 완전 활용
 *
 * 🔧 핵심 개선사항:
 * - ConfigManager.getConfig()를 모든 설정의 중심으로 활용
 * - 환경변수 직접 참조 금지, 모든 설정은 ConfigManager 경유
 * - ConfigManager의 검증, 기본값, 타입 변환 기능 완전 활용
 * - Railway 최적화 설정 자동 적용
 * - 표준화된 설정 구조로 유지보수성 향상
 */
class DooMockBot {
  constructor() {
    // 🎯 ConfigManager 중앙 설정 시스템 활용 (최우선!)
    this.configManager = getConfig();

    // 📊 ConfigManager 요약 출력
    this.configManager.printConfigSummary();

    // 🤖 텔레그래프 봇
    this.bot = null;

    // ✅ 중앙 데이터베이스 관리자 활용
    this.dbManager = getDatabaseManager();

    // 🏗️ 핵심 매니저들
    this.serviceBuilder = null;
    this.moduleManager = null;
    this.botController = null;

    // 🛡️ 중앙 시스템들
    this.validationManager = null;
    this.healthChecker = null;

    // ⚙️ 모든 설정을 ConfigManager에서 가져오기 (핵심 개선!)
    this.config = {
      // 🤖 봇 설정 (ConfigManager 경유)
      botToken: this.configManager.get("bot.token"),
      botUsername: this.configManager.get("bot.username"),
      webhookEnabled: this.configManager.get("bot.webhook.enabled"),
      webhookUrl: this.configManager.get("bot.webhook.url"),
      webhookPort: this.configManager.get("bot.webhook.port"),
      pollingInterval: this.configManager.get("bot.polling.interval"),
      pollingTimeout: this.configManager.get("bot.polling.timeout"),

      // 🗄️ 데이터베이스 설정 (ConfigManager 경유)
      mongoUri: this.configManager.get("database.url"),
      dbName: this.configManager.get("database.name"),
      dbPoolSize: this.configManager.get("database.poolSize"),
      dbTimeout: this.configManager.get("database.timeout"),
      dbRetryWrites: this.configManager.get("database.retryWrites"),

      // 🚂 Railway 환경 설정 (ConfigManager 경유)
      environment: this.configManager.get("app.environment"),
      isRailway: this.configManager.isRailwayEnvironment(),
      railwayService: this.configManager.get("railway.service"),
      railwayRegion: this.configManager.get("railway.region"),

      // 📊 모듈 설정 (ConfigManager 경유)
      maxTodosPerUser: this.configManager.get("modules.maxTodosPerUser"),
      maxRemindersPerUser: this.configManager.get(
        "modules.maxRemindersPerUser"
      ),
      enableNotifications: this.configManager.get(
        "modules.enableNotifications"
      ),
      enableVoiceReminders: this.configManager.get(
        "modules.enableVoiceReminders"
      ),
      todoAutoSave: this.configManager.get("modules.autoSave"),
      todoSyncInterval: this.configManager.get("modules.syncInterval"),

      // ⏱️ 타이머 설정 (ConfigManager 경유)
      pomodoroWorkDuration: this.configManager.get("timer.workDuration"),
      pomodoroShortBreak: this.configManager.get("timer.shortBreak"),
      pomodoroLongBreak: this.configManager.get("timer.longBreak"),
      pomodoroLongBreakInterval: this.configManager.get(
        "timer.longBreakInterval"
      ),
      timerAutoStart: this.configManager.get("timer.autoStart"),
      timerNotifications: this.configManager.get("timer.notifications"),
      timerRefreshInterval: this.configManager.get("timer.refreshInterval"),
      timerMaxRestoreHours: this.configManager.get("timer.maxRestoreHours"),

      // 🔑 API 설정 (ConfigManager 경유)
      weatherApiKey: this.configManager.get("apis.weather"),
      airKoreaApiKey: this.configManager.get("apis.airKorea"),
      ttsEnabled: this.configManager.get("apis.tts.enabled"),
      ttsApiKey: this.configManager.get("apis.tts.key"),
      ttsMaxRetries: this.configManager.get("apis.tts.maxRetries"),
      ttsTimeout: this.configManager.get("apis.tts.timeout"),
      ttsTempDir: this.configManager.get("apis.tts.tempDir"),

      // 💾 캐시 설정 (ConfigManager 경유)
      cacheEnabled: this.configManager.get("cache.enabled"),
      cacheTimeout: this.configManager.get("cache.timeout"),
      cacheMaxSize: this.configManager.get("cache.maxSize"),
      cacheCleanupInterval: this.configManager.get("cache.cleanupInterval"),

      // 📝 로깅 설정 (ConfigManager 경유)
      logLevel: this.configManager.get("logging.level"),
      logFormat: this.configManager.get("logging.format"),
      logFileEnabled: this.configManager.get("logging.enableFile"),
      logFilePath: this.configManager.get("logging.filePath"),
      logMaxFileSize: this.configManager.get("logging.maxFileSize"),
      logMaxFiles: this.configManager.get("logging.maxFiles"),

      // ⚡ 성능 설정 (ConfigManager 경유)
      messageTimeout: this.configManager.get("performance.messageTimeout"),
      callbackTimeout: this.configManager.get("performance.callbackTimeout"),
      maxRetries: this.configManager.get("performance.maxRetries"),
      healthCheckInterval: this.configManager.get(
        "performance.healthCheckInterval"
      ),
      cleanupInterval: this.configManager.get("performance.cleanupInterval"),
      memoryThreshold: this.configManager.get("performance.memoryThreshold"),

      // 🛡️ 보안 설정 (ConfigManager 경유)
      rateLimitEnabled: this.configManager.get("security.rateLimitEnabled"),
      maxRequestsPerMinute: this.configManager.get(
        "security.maxRequestsPerMinute"
      ),
      enableInputSanitization: this.configManager.get(
        "security.enableInputSanitization"
      ),
      maxInputLength: this.configManager.get("security.maxInputLength"),
      allowedOrigins: this.configManager.get("security.allowedOrigins"),

      // 🎯 시스템 기능 설정 (ConfigManager 경유)
      enableValidation: this.configManager.get("features.validation"),
      enableHealthCheck: this.configManager.get("features.healthCheck"),
      validationCacheEnabled: this.configManager.get("cache.validation"),
      validationTimeout: this.configManager.get("cache.validationTimeout"),
    };

    logger.info("🤖 DooMockBot v3.0.1 생성됨");
    logger.info(`👤 UserHelper v3.0.1 로드됨 (새로운 간단명확 구조)`);
    logger.info(`🏗️ ServiceBuilder v3.0.1 생성됨`);
    logger.info(`🔧 ConfigManager 중앙 설정 관리자 초기화됨`);
  }

  /**
   * 🚀 애플리케이션 시작
   */
  async start() {
    try {
      logger.info("🚀 DooMockBot v3.0.1 시작 중...");

      // 📊 ConfigManager 기반 설정 요약 출력
      this.printDetailedConfigSummary();

      // 환경 검증 (ConfigManager 활용)
      await this.validateEnvironment();

      // 🔧 표준 초기화 순서 (의존성 순)
      await this.step1_initializeTelegrafBot();
      await this.step2_initializeServiceBuilder();
      await this.step3_initializeModuleManager();
      await this.step4_initializeBotController();

      // 선택적 컴포넌트들
      await this.initializeValidationManager();
      await this.initializeHealthChecker();

      // 봇 시작
      await this.startBot();

      logger.success("🎊 DooMockBot v3.0.1 시작 완료 🎊");
    } catch (error) {
      logger.error("💥 DooMockBot 시작 실패:", error);
      await this.gracefulShutdown("startup_failure");
      throw error;
    }
  }

  /**
   * 📊 상세 설정 요약 출력 (ConfigManager 기반)
   */
  printDetailedConfigSummary() {
    logger.info("📊 AppConfig 설정 요약:");
    logger.info(` 🌍 환경: ${this.config.environment}`);
    logger.info(` 🚂 Railway: ${this.config.isRailway ? "활성" : "비활성"}`);
    logger.info(` 🗄️ 데이터베이스: ${this.config.dbName}`);
    logger.info(
      ` 🏥 헬스체크: ${this.config.enableHealthCheck ? "활성" : "비활성"}`
    );
    logger.info(` 📊 로그 레벨: ${this.config.logLevel}`);

    if (this.config.isRailway) {
      logger.info("🚂 Railway 최적화:");
      logger.info(` 메모리 임계값: ${this.config.memoryThreshold}MB`);
      logger.info(` DB 풀 크기: ${this.config.dbPoolSize}`);
      logger.info(` 연결 타임아웃: ${this.config.dbTimeout}ms`);
      logger.info(` 서비스: ${this.config.railwayService || "미설정"}`);
      logger.info(` 리전: ${this.config.railwayRegion || "미설정"}`);
    }

    logger.info("💾 캐시 설정:");
    logger.info(` 캐시 활성화: ${this.config.cacheEnabled ? "예" : "아니오"}`);
    logger.info(` 캐시 타임아웃: ${this.config.cacheTimeout / 1000}초`);
    logger.info(` 최대 캐시 크기: ${this.config.cacheMaxSize}개`);

    logger.info("🛡️ 보안 설정:");
    logger.info(
      ` 레이트 리미트: ${this.config.rateLimitEnabled ? "활성" : "비활성"}`
    );
    logger.info(` 분당 최대 요청: ${this.config.maxRequestsPerMinute}회`);
    logger.info(
      ` 입력 검증: ${this.config.enableInputSanitization ? "활성" : "비활성"}`
    );

    logger.info("🎯 모듈 설정:");
    logger.info(` 사용자당 최대 할일: ${this.config.maxTodosPerUser}개`);
    logger.info(
      ` 사용자당 최대 리마인더: ${this.config.maxRemindersPerUser}개`
    );
    logger.info(
      ` 알림 기능: ${this.config.enableNotifications ? "활성" : "비활성"}`
    );
    logger.info(
      ` 음성 리마인더: ${this.config.enableVoiceReminders ? "활성" : "비활성"}`
    );

    logger.info("⏱️ 타이머 설정:");
    logger.info(` 작업 시간: ${this.config.pomodoroWorkDuration}분`);
    logger.info(` 짧은 휴식: ${this.config.pomodoroShortBreak}분`);
    logger.info(` 긴 휴식: ${this.config.pomodoroLongBreak}분`);
    logger.info(
      ` 자동 시작: ${this.config.timerAutoStart ? "활성" : "비활성"}`
    );

    logger.info("🔑 API 설정:");
    logger.info(
      ` 날씨 API: ${this.config.weatherApiKey ? "설정됨" : "미설정"}`
    );
    logger.info(
      ` 대기질 API: ${this.config.airKoreaApiKey ? "설정됨" : "미설정"}`
    );
    logger.info(` TTS 기능: ${this.config.ttsEnabled ? "활성" : "비활성"}`);
  }

  // ===== 🔧 표준 초기화 순서 (1-4단계) =====

  /**
   * 🔧 1️⃣ Telegraf 봇 초기화 (1/3)
   */
  async step1_initializeTelegrafBot() {
    logger.info("🔧 1️⃣ Telegraf 봇 초기화 중... (1/3)");
    const startTime = Date.now();

    try {
      if (!this.config.botToken) {
        throw new Error("BOT_TOKEN 환경변수가 설정되지 않았습니다");
      }

      this.bot = new Telegraf(this.config.botToken);

      // ConfigManager 기반 미들웨어 설정
      this.setupTelegrafMiddleware();

      logger.success(`✅ 1️⃣ Telegraf 봇 완료 (${Date.now() - startTime}ms)`);
    } catch (error) {
      logger.error("❌ 1️⃣ Telegraf 봇 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 Telegraf 미들웨어 설정 (ConfigManager 기반)
   */
  setupTelegrafMiddleware() {
    // ConfigManager 기반 요청 제한 미들웨어
    if (this.config.rateLimitEnabled) {
      const userLimits = new Map();

      this.bot.use((ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const now = Date.now();
        const userLimit = userLimits.get(userId) || {
          count: 0,
          resetTime: now,
        };

        // 1분마다 초기화
        if (now > userLimit.resetTime + 60000) {
          userLimit.count = 0;
          userLimit.resetTime = now;
        }

        // ConfigManager에서 가져온 제한값 확인
        if (userLimit.count >= this.config.maxRequestsPerMinute) {
          return ctx.reply(
            "⚠️ 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\n" +
              `현재 제한: 분당 ${this.config.maxRequestsPerMinute}회`
          );
        }

        userLimit.count++;
        userLimits.set(userId, userLimit);
        return next();
      });
    }

    // 에러 핸들링 미들웨어
    this.bot.catch((err, ctx) => {
      logger.error("Telegraf 오류:", err);
      try {
        ctx.reply("❌ 처리 중 오류가 발생했습니다.");
      } catch (replyError) {
        logger.error("오류 응답 실패:", replyError);
      }
    });
  }

  /**
   * 🔧 2️⃣ 서비스 빌더 초기화 (1/3)
   */
  async step2_initializeServiceBuilder() {
    logger.info("🔧 2️⃣ 서비스 빌더 초기화 중... (1/3)");
    const startTime = Date.now();

    try {
      // ✅ 데이터베이스 연결 먼저 시도
      logger.info("🗄️ 데이터베이스 초기화 중...");
      logger.info("🗄️ DatabaseManager 생성됨");

      try {
        logger.info("🔌 MongoDB 연결 중...");
        await this.dbManager.connect();
        logger.success("✅ 데이터베이스 연결 완료");
      } catch (dbError) {
        logger.error("❌ MongoDB 연결 실패:", dbError.message);
        logger.warn("⚠️ DB 없이 제한 모드로 실행");
      }

      // ServiceBuilder 생성 (ConfigManager 설정 기반)
      this.serviceBuilder = new ServiceBuilder({
        db: this.dbManager.db, // DB 연결 실패시 null
        config: this.config,
        isRailway: this.config.isRailway,
        // ConfigManager 기반 ServiceBuilder 설정
        enableCaching: this.config.cacheEnabled,
        maxRetries: this.config.maxRetries,
        timeout: this.config.messageTimeout,
        cleanupInterval: this.config.cleanupInterval,
      });

      await this.serviceBuilder.initialize();

      logger.success(`✅ 2️⃣ 서비스 빌더 완료 (${Date.now() - startTime}ms)`);
    } catch (error) {
      logger.error("❌ 2️⃣ 서비스 빌더 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 3️⃣ 모듈 매니저 초기화 (1/3)
   */
  async step3_initializeModuleManager() {
    logger.info("🔧 3️⃣ 모듈 매니저 초기화 중... (1/3)");
    const startTime = Date.now();

    try {
      this.moduleManager = new ModuleManager({
        bot: this.bot,
        serviceBuilder: this.serviceBuilder,
        db: this.dbManager.db, // ✅ 표준 DB 연결 전달
        config: this.config,
        // ConfigManager 기반 ModuleManager 설정
        enableAutoDiscovery: true,
        moduleTimeout: this.config.messageTimeout,
        maxRetries: this.config.maxRetries,
        enableHealthCheck: this.config.enableHealthCheck,
        cleanupInterval: this.config.cleanupInterval,
      });

      await this.moduleManager.initialize();

      // 🔍 검증: 제대로 초기화되었는지 확인
      if (!this.moduleManager.isInitialized) {
        throw new Error("ModuleManager 초기화가 완료되지 않았습니다");
      }

      logger.success(`✅ 3️⃣ 모듈 매니저 완료 (${Date.now() - startTime}ms)`);
    } catch (error) {
      logger.error("❌ 3️⃣ 모듈 매니저 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 4️⃣ 봇 컨트롤러 초기화 (1/3) - 핵심 수정!
   */
  async step4_initializeBotController() {
    const maxRetries = this.config.maxRetries; // ConfigManager에서 가져오기

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔧 4️⃣ 봇 컨트롤러 초기화 중... (${attempt}/${maxRetries})`);
      const startTime = Date.now();

      try {
        // 🔍 사전 검증: 모든 의존성이 준비되었는지 확인
        await this.validateBotControllerDependencies();

        // 🎮 BotController 생성 (ConfigManager 기반 설정)
        this.botController = new BotController({
          bot: this.bot,
          moduleManager: this.moduleManager,
          dbManager: this.dbManager,
          validationManager: this.validationManager,
          healthChecker: this.healthChecker,
          config: this.config, // ConfigManager에서 가져온 전체 설정
        });

        // 🔍 생성 후 검증
        if (!this.botController) {
          throw new Error("BotController 인스턴스 생성 실패");
        }

        // 초기화 실행
        await this.botController.initialize();

        // 🔍 초기화 후 검증
        if (!this.botController.initialized) {
          throw new Error("BotController 초기화 플래그가 설정되지 않음");
        }

        logger.success(`✅ 4️⃣ 봇 컨트롤러 완료 (${Date.now() - startTime}ms)`);
        return; // 성공시 즉시 종료
      } catch (error) {
        logger.error(
          `⚠️ 4️⃣ 봇 컨트롤러 실패 (${attempt}/${maxRetries}): ${error.message}`
        );

        if (attempt === maxRetries) {
          logger.error("💀 FATAL: 💀 BotController 초기화 최종 실패");
          throw new Error(
            `BotController 초기화 실패 (${maxRetries}회 시도): ${error.message}`
          );
        }

        // 다음 시도 전 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * 🔍 BotController 의존성 검증
   */
  async validateBotControllerDependencies() {
    logger.debug("🔍 BotController 의존성 검증 중...");

    // 필수 의존성들
    const dependencies = [
      { name: "bot", obj: this.bot, required: true },
      { name: "moduleManager", obj: this.moduleManager, required: true },
      { name: "dbManager", obj: this.dbManager, required: false },
      {
        name: "validationManager",
        obj: this.validationManager,
        required: false,
      },
      { name: "healthChecker", obj: this.healthChecker, required: false },
    ];

    for (const { name, obj, required } of dependencies) {
      if (required && !obj) {
        throw new Error(`필수 의존성 누락: ${name}`);
      }

      logger.debug(
        `✅ ${name}: ${obj ? "준비됨" : "없음"} ${
          required ? "(필수)" : "(선택)"
        }`
      );
    }

    // ModuleManager 상세 검증
    if (this.moduleManager) {
      if (!this.moduleManager.isInitialized) {
        throw new Error("ModuleManager가 아직 초기화되지 않았습니다");
      }

      logger.debug(
        `✅ ModuleManager.isInitialized: ${this.moduleManager.isInitialized}`
      );
      logger.debug(
        `✅ ModuleManager.moduleInstances.size: ${this.moduleManager.moduleInstances.size}`
      );
    }

    logger.debug("✅ BotController 의존성 검증 완료");
  }

  // ===== 🔧 선택적 컴포넌트들 =====

  /**
   * 🛡️ 중앙 검증 시스템 초기화 (ConfigManager 기반)
   */
  async initializeValidationManager() {
    if (!this.config.enableValidation) {
      logger.info("🛡️ 검증 시스템 비활성화됨");
      return;
    }

    try {
      logger.info("🛡️ 중앙 검증 시스템 초기화 중...");

      this.validationManager = new ValidationManager({
        enableCache: this.config.validationCacheEnabled,
        cacheTimeout: this.config.validationTimeout,
        maxCacheSize: this.config.cacheMaxSize,
        maxInputLength: this.config.maxInputLength,
        enableInputSanitization: this.config.enableInputSanitization,
      });

      logger.debug("✅ 중앙 검증 시스템 초기화 완료");
    } catch (error) {
      logger.error("❌ 검증 시스템 초기화 실패:", error);
    }
  }

  /**
   * 🏥 헬스체커 초기화 (ConfigManager 기반)
   */
  async initializeHealthChecker() {
    if (!this.config.enableHealthCheck) {
      logger.info("🏥 헬스체커 비활성화됨");
      return;
    }

    try {
      logger.info("🏥 헬스체커 초기화 중...");

      this.healthChecker = new HealthChecker({
        checkInterval: this.config.healthCheckInterval,
        memoryThreshold: this.config.memoryThreshold,
        enableMetrics: this.config.isRailway,
      });

      // 컴포넌트 등록
      await this.registerHealthCheckerComponents();
      await this.healthChecker.start();

      logger.debug("✅ 헬스체커 초기화 완료");
    } catch (error) {
      logger.error("❌ 헬스체커 초기화 실패:", error);
    }
  }

  /**
   * 🏥 헬스체커 컴포넌트 등록
   */
  async registerHealthCheckerComponents() {
    if (!this.healthChecker) return;

    // 기본 컴포넌트들 등록
    if (this.dbManager) {
      this.healthChecker.registerComponent("database", this.dbManager);
    }
    if (this.moduleManager) {
      this.healthChecker.registerComponent("moduleManager", this.moduleManager);
    }
    if (this.botController) {
      this.healthChecker.registerComponent("botController", this.botController);
    }
    if (this.validationManager) {
      this.healthChecker.registerComponent(
        "validationManager",
        this.validationManager
      );
    }

    logger.debug("🏥 헬스체커 컴포넌트 등록 완료");
  }

  /**
   * 🚀 봇 시작 (ConfigManager 기반)
   */
  async startBot() {
    try {
      logger.info("🚀 봇 시작 중...");

      // ConfigManager 기반 Railway 최적화
      if (this.config.isRailway) {
        logger.info("🛡️ 1단계: 기존 연결 정리 (핵심!)");
        try {
          await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (webhookError) {
          logger.warn(
            "⚠️ 웹훅 정리 실패 (정상 상황일 수 있음):",
            webhookError.message
          );
        }
      }

      // ConfigManager 기반 봇 시작 방식 결정
      if (this.config.webhookEnabled) {
        // 웹훅 모드
        await this.bot.launch({
          webhook: {
            domain: this.config.webhookUrl,
            port: this.config.webhookPort,
          },
          dropPendingUpdates: true,
        });
        logger.info(`🎯 웹훅 모드로 시작됨 (포트: ${this.config.webhookPort})`);
      } else {
        // 폴링 모드
        await this.bot.launch({
          polling: {
            interval: this.config.pollingInterval,
            timeout: this.config.pollingTimeout,
          },
          dropPendingUpdates: true,
        });
        logger.info(
          `🔄 폴링 모드로 시작됨 (간격: ${this.config.pollingInterval}ms)`
        );
      }

      logger.success("🎊 봇이 성공적으로 시작되었습니다!");
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 환경 검증 (ConfigManager 활용)
   */
  async validateEnvironment() {
    logger.info("🔍 환경 검증 중...");

    // ConfigManager를 통한 검증
    const validation = this.configManager.validateConfig();

    if (!validation.isValid) {
      logger.error("❌ 설정 검증 실패:");
      validation.issues.forEach((issue) => logger.error(`   - ${issue}`));
      throw new Error(`설정 오류: ${validation.issues.join(", ")}`);
    }

    // 추가 런타임 검증
    if (!this.config.botToken) {
      throw new Error("BOT_TOKEN이 설정되지 않았습니다");
    }

    if (!this.config.mongoUri && this.config.enableHealthCheck) {
      logger.warn("⚠️ MongoDB URI가 없어 일부 기능이 제한될 수 있습니다");
    }

    logger.debug("✅ 환경 검증 완료");
  }

  /**
   * 🛑 우아한 종료
   */
  async gracefulShutdown(reason = "unknown") {
    logger.info(`🛑 우아한 종료 시작 (이유: ${reason})`);

    try {
      // 봇 정리
      if (this.bot) {
        try {
          await this.bot.stop();
        } catch (error) {
          logger.warn("⚠️ bot 정리 실패:", error.message);
        }
      }

      // 모듈매니저 정리
      if (this.moduleManager) {
        logger.info("🛑 ModuleManager 정리 시작...");
        await this.moduleManager.cleanup();
        logger.debug("✅ ModuleManager 정리 완료");
      }

      // 헬스체커 정리
      if (this.healthChecker) {
        await this.healthChecker.stop();
      }

      // 데이터베이스 정리
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      logger.success("✅ 우아한 종료 완료");
    } catch (error) {
      logger.error("❌ 종료 중 오류:", error);
    }
  }

  /**
   * 🎯 프로세스 이벤트 핸들러 설정
   */
  setupProcessHandlers() {
    // 우아한 종료 처리
    process.once("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.once("SIGTERM", () => this.gracefulShutdown("SIGTERM"));

    // 처리되지 않은 예외 처리
    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      this.gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
      this.gracefulShutdown("unhandledRejection");
    });
  }
}

// 🚀 애플리케이션 시작
if (require.main === module) {
  const app = new DooMockBot();
  app.setupProcessHandlers();
  app.start().catch((error) => {
    logger.error("💥 시작 실패:", error);
    process.exit(1);
  });
}

module.exports = DooMockBot;
