// bot.js - 두목봇 메인 통합 파일 (v3 리팩토링 완료)

const TelegramBot = require("node-telegram-bot-api");
const Logger = require("./src/utils/Logger");
const { mongoPoolManager } = require("./src/database/MongoPoolManager");
const ModuleManager = require("./src/managers/ModuleManager");
const errorHandler = require("./src/utils/ErrorHandler");
const { getUserName } = require("./src/utils/UserHelper");
const config = require("./src/config/config");

class DoomockBot {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.isInitialized = false;
    this.startTime = new Date();

    // 📊 봇 전체 통계
    this.botStats = {
      totalMessages: 0,
      totalCallbacks: 0,
      totalUsers: new Set(),
      errors: 0,
      uptime: 0,
    };

    Logger.info(`🚀 ${config.bot.name} v${config.bot.version} 시작 중...`);
  }

  // 🚀 봇 초기화
  async initialize() {
    try {
      Logger.info("⚙️ 봇 시스템 초기화 시작...");

      // 1. 환경변수 확인
      await this.validateEnvironment();

      // 2. 데이터베이스 연결
      await this.initializeDatabase();

      // 3. 텔레그램 봇 생성
      await this.initializeTelegramBot();

      // 4. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 5. 에러 핸들러 시작
      await this.initializeErrorHandler();

      // 6. 이벤트 리스너 등록
      await this.setupEventListeners();

      // 7. 건강 상태 모니터링 시작
      await this.startHealthMonitoring();

      this.isInitialized = true;
      Logger.success(`✅ ${config.bot.name} 초기화 완료!`);

      await this.sendStartupNotification();
    } catch (error) {
      Logger.error("❌ 봇 초기화 실패:", error);
      await this.handleCriticalError(error);
      throw error;
    }
  }

  // 🔍 환경변수 검증
  async validateEnvironment() {
    Logger.info("🔍 환경변수 검증 중...");

    const requiredEnvVars = ["BOT_TOKEN", "MONGO_URL"];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수가 누락됨: ${missingVars.join(", ")}`);
    }

    // 민감한 정보 마스킹하여 로깅
    Logger.success("✅ 환경변수 검증 완료");
    Logger.info(`🌐 환경: ${process.env.NODE_ENV || "development"}`);
    Logger.info(`🔑 BOT_TOKEN: ${process.env.BOT_TOKEN ? "설정됨" : "누락"}`);
    Logger.info(`🗄️ MONGO_URL: ${process.env.MONGO_URL ? "설정됨" : "누락"}`);
  }

  // 🗄️ 데이터베이스 초기화
  async initializeDatabase() {
    Logger.info("🗄️ 데이터베이스 연결 중...");

    try {
      await mongoPoolManager.connect();

      // 기본 인덱스 설정
      await this.setupDatabaseIndexes();

      Logger.success("✅ 데이터베이스 연결 완료");
    } catch (error) {
      throw new Error(`데이터베이스 연결 실패: ${error.message}`);
    }
  }

  // 📑 데이터베이스 인덱스 설정
  async setupDatabaseIndexes() {
    try {
      // 사용자 정보 인덱스
      const userIndexes = [
        { key: { userId: 1 }, options: { unique: true } },
        { key: { username: 1 }, options: {} },
        { key: { lastActive: 1 }, options: {} },
      ];
      await mongoPoolManager.ensureIndexes("users", userIndexes);

      // 봇 통계 인덱스
      const statsIndexes = [
        { key: { date: 1 }, options: { unique: true } },
        { key: { timestamp: 1 }, options: {} },
      ];
      await mongoPoolManager.ensureIndexes("bot_stats", statsIndexes);

      Logger.debug("📑 데이터베이스 인덱스 설정 완료");
    } catch (error) {
      Logger.warn("⚠️ 인덱스 설정 실패:", error.message);
    }
  }

  // 🤖 텔레그램 봇 초기화
  async initializeTelegramBot() {
    Logger.info("🤖 텔레그램 봇 생성 중...");

    try {
      this.bot = new TelegramBot(process.env.BOT_TOKEN, {
        polling: true,
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4, // IPv4 강제 사용 (Railway 호환성)
          },
        },
      });

      // 봇 정보 확인
      const botInfo = await this.bot.getMe();
      Logger.success(
        `✅ 봇 연결 완료: @${botInfo.username} (${botInfo.first_name})`
      );

      // 웹훅 정리 (polling 사용)
      await this.bot.deleteWebHook();
    } catch (error) {
      throw new Error(`텔레그램 봇 초기화 실패: ${error.message}`);
    }
  }

  // 🔧 모듈 매니저 초기화
  async initializeModuleManager() {
    Logger.info("🔧 모듈 매니저 초기화 중...");

    try {
      this.moduleManager = new ModuleManager(this.bot, {
        userStates: new Map(),
      });

      await this.moduleManager.initialize();
      Logger.success("✅ 모듈 매니저 초기화 완료");
    } catch (error) {
      throw new Error(`모듈 매니저 초기화 실패: ${error.message}`);
    }
  }

  // 🛡️ 에러 핸들러 초기화
  async initializeErrorHandler() {
    Logger.info("🛡️ 에러 핸들러 시작 중...");

    try {
      errorHandler.startRealTimeMonitoring();
      Logger.success("✅ 에러 핸들러 초기화 완료");
    } catch (error) {
      Logger.warn("⚠️ 에러 핸들러 초기화 실패:", error.message);
    }
  }

  // 📡 이벤트 리스너 설정
  async setupEventListeners() {
    Logger.info("📡 이벤트 리스너 등록 중...");

    // 📨 메시지 이벤트
    this.bot.on("message", async (msg) => {
      await this.handleMessage(msg);
    });

    // 📞 콜백 쿼리 이벤트
    this.bot.on("callback_query", async (callbackQuery) => {
      await this.handleCallbackQuery(callbackQuery);
    });

    // ⚠️ 봇 에러 이벤트
    this.bot.on("error", async (error) => {
      await this.handleBotError(error);
    });

    // 📊 폴링 에러 이벤트
    this.bot.on("polling_error", async (error) => {
      await this.handlePollingError(error);
    });

    // 🔄 프로세스 종료 이벤트
    process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));
    process.on("uncaughtException", (error) =>
      this.handleUncaughtException(error)
    );
    process.on("unhandledRejection", (reason, promise) =>
      this.handleUnhandledRejection(reason, promise)
    );

    Logger.success("✅ 이벤트 리스너 등록 완료");
  }

  // 💓 건강 상태 모니터링 시작
  async startHealthMonitoring() {
    Logger.info("💓 건강 상태 모니터링 시작...");

    // 5분마다 건강 상태 체크
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);

    // 1시간마다 통계 저장
    this.statsInterval = setInterval(async () => {
      await this.saveHourlyStats();
    }, 60 * 60 * 1000);

    Logger.success("✅ 건강 상태 모니터링 시작됨");
  }

  // 📨 메시지 처리 (🎯 표준화된 라우팅)
  async handleMessage(msg) {
    const startTime = Date.now();

    try {
      // 통계 업데이트
      this.botStats.totalMessages++;
      this.botStats.totalUsers.add(msg.from.id);

      // 사용자 정보 업데이트
      await this.updateUserInfo(msg.from);

      // 기본 명령어 처리
      if (await this.handleBasicCommands(msg)) {
        return;
      }

      // 모듈 매니저로 라우팅
      const handled = await this.moduleManager.routeMessage(this.bot, msg);

      if (!handled) {
        await this.handleUnknownMessage(msg);
      }
    } catch (error) {
      this.botStats.errors++;

      const result = await errorHandler.handleError(error, {
        type: "message",
        userId: msg.from.id,
        chatId: msg.chat.id,
        moduleName: "bot",
      });

      if (result.userMessage) {
        try {
          await this.bot.sendMessage(msg.chat.id, result.userMessage);
        } catch (sendError) {
          Logger.error("📱 에러 메시지 전송 실패:", sendError);
        }
      }
    } finally {
      const responseTime = Date.now() - startTime;
      Logger.debug(`📨 메시지 처리 완료: ${responseTime}ms`);
    }
  }

  // 📞 콜백 쿼리 처리 (🎯 표준화된 라우팅)
  async handleCallbackQuery(callbackQuery) {
    const startTime = Date.now();

    try {
      // 통계 업데이트
      this.botStats.totalCallbacks++;
      this.botStats.totalUsers.add(callbackQuery.from.id);

      // 사용자 정보 업데이트
      await this.updateUserInfo(callbackQuery.from);

      // 모듈 매니저로 라우팅 (menuManager는 필요시 주입)
      const handled = await this.moduleManager.routeCallback(
        this.bot,
        callbackQuery,
        null
      );

      if (!handled) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 알 수 없는 명령입니다.",
        });
      }
    } catch (error) {
      this.botStats.errors++;

      const result = await errorHandler.handleError(error, {
        type: "callback",
        userId: callbackQuery.from.id,
        chatId: callbackQuery.message.chat.id,
        callbackData: callbackQuery.data,
        moduleName: "bot",
      });

      try {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: result.userMessage || "❌ 처리 중 오류가 발생했습니다.",
        });
      } catch (answerError) {
        Logger.error("📞 콜백 쿼리 응답 실패:", answerError);
      }
    } finally {
      const responseTime = Date.now() - startTime;
      Logger.debug(`📞 콜백 처리 완료: ${responseTime}ms`);
    }
  }

  // 🔧 기본 명령어 처리
  async handleBasicCommands(msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    switch (text.toLowerCase()) {
      case "/start":
        await this.sendWelcomeMessage(chatId, userName);
        return true;

      case "/help":
        await this.sendHelpMessage(chatId);
        return true;

      case "/status":
        await this.sendStatusMessage(chatId);
        return true;

      case "/health":
        if (this.isAdminUser(userId)) {
          await this.sendHealthReport(chatId);
          return true;
        }
        break;

      case "/stats":
        if (this.isAdminUser(userId)) {
          await this.sendDetailedStats(chatId);
          return true;
        }
        break;

      case "/restart":
        if (this.isAdminUser(userId)) {
          await this.handleRestartCommand(chatId, userId);
          return true;
        }
        break;
    }

    return false;
  }

  // 🏠 환영 메시지
  async sendWelcomeMessage(chatId, userName) {
    const welcomeText = `
🤖 **${config.bot.name}에 오신 것을 환영합니다!** 

안녕하세요 ${userName}님! 👋

저는 직장인을 위한 똑똑한 어시스턴트 봇입니다.

**주요 기능:**
📝 할일 관리 - 체계적인 업무 관리
🔮 운세 - 오늘의 운세 확인
🌤️ 날씨 - 실시간 날씨 정보
⏰ 타이머 - 뽀모도로 기법 지원
📅 휴가 관리 - 연차 및 휴가 관리
🕐 근무시간 - 출퇴근 시간 기록

**시작하기:**
아래 버튼을 눌러 원하는 기능을 선택하세요!
    `.trim();

    const keyboard = await this.createMainMenuKeyboard();

    try {
      await this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("환영 메시지 전송 실패:", error);

      // 마크다운 파싱 실패 시 일반 텍스트로 재시도
      const simpleText = `${config.bot.name}에 오신 것을 환영합니다!\n\n안녕하세요 ${userName}님! 👋`;
      await this.bot.sendMessage(chatId, simpleText, {
        reply_markup: keyboard,
      });
    }
  }

  // ❓ 도움말 메시지
  async sendHelpMessage(chatId) {
    const helpText = `
**📖 ${config.bot.name} 도움말**

**기본 명령어:**
• \`/start\` - 봇 시작 및 메인 메뉴
• \`/help\` - 도움말 보기
• \`/status\` - 현재 상태 확인

**주요 기능:**
📝 **할일 관리** - 업무 효율성 향상
　• 할일 추가/완료/삭제
　• 검색 및 통계 기능
　• 데이터 내보내기/가져오기

🔮 **운세** - 오늘의 운세 확인
　• 일반운, 업무운, 연애운, 재물운
　• 타로카드 뽑기
　• 행운 정보 제공

🌤️ **날씨** - 실시간 날씨 정보
　• 현재 날씨 및 예보
　• 지역별 날씨 조회

⏰ **타이머** - 시간 관리 도구
　• 뽀모도로 기법 지원
　• 커스텀 타이머 설정

**문의 및 지원:**
문제가 있으시면 @doomock_support로 연락주세요.

**버전:** ${config.bot.version}
    `.trim();

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main_menu" }]],
    };

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 📊 상태 메시지
  async sendStatusMessage(chatId) {
    const uptime = Date.now() - this.startTime.getTime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    const dbStats = mongoPoolManager.getStats();
    const moduleStats = this.moduleManager.getGlobalStats();

    const statusText = `
**📊 ${config.bot.name} 상태 정보**

**🤖 봇 상태:**
• 버전: ${config.bot.version}
• 가동 시간: ${hours}시간 ${minutes}분
• 처리된 메시지: ${this.botStats.totalMessages}개
• 처리된 콜백: ${this.botStats.totalCallbacks}개
• 사용자 수: ${this.botStats.totalUsers.size}명

**🗄️ 데이터베이스:**
• 상태: ${dbStats.isConnected ? "✅ 연결됨" : "❌ 연결 끊김"}
• 성공률: ${dbStats.successRate}
• 평균 응답: ${Math.round(dbStats.averageResponseTime)}ms

**🔧 모듈 시스템:**
• 로드된 모듈: ${moduleStats.modules.total}개
• 활성 모듈: ${moduleStats.modules.initialized}개
• 전체 요청: ${moduleStats.totalRequests}개
• 성공률: ${moduleStats.performance.errorRate}

**💾 시스템:**
• 메모리 사용량: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• 환경: ${process.env.NODE_ENV || "development"}
    `.trim();

    await this.bot.sendMessage(chatId, statusText, {
      parse_mode: "Markdown",
    });
  }

  // 💓 건강 리포트 (관리자 전용)
  async sendHealthReport(chatId) {
    const healthSummary = errorHandler.getHealthSummary();
    const moduleHealth = await this.moduleManager.healthCheck();
    const dbHealth = await mongoPoolManager.isHealthy();

    const healthText = `
**💓 ${config.bot.name} 건강 리포트**

**전체 상태: ${this.getStatusEmoji(
      healthSummary.status
    )} ${healthSummary.status.toUpperCase()}**

**🛡️ 에러 처리:**
• 총 에러: ${healthSummary.stats.totalErrors}개
• 성공률: ${healthSummary.stats.successRate}
• 크리티컬 에러: ${healthSummary.stats.criticalErrors}개

**🔧 모듈 시스템:**
• 상태: ${this.getStatusEmoji(moduleHealth.status)} ${moduleHealth.status}
• 건강한 모듈: ${
      Object.values(moduleHealth.checks.modules).filter((m) => m.healthy).length
    }개
• 문제 모듈: ${
      Object.values(moduleHealth.checks.modules).filter((m) => !m.healthy)
        .length
    }개

**🗄️ 데이터베이스:**
• 연결 상태: ${dbHealth ? "✅ 정상" : "❌ 문제"}

**⚠️ 감지된 문제:**
${
  healthSummary.issues.length > 0
    ? healthSummary.issues.map((issue) => `• ${issue}`).join("\n")
    : "• 문제 없음"
}

**📅 마지막 업데이트:** ${healthSummary.lastUpdate.toLocaleString()}
    `.trim();

    await this.bot.sendMessage(chatId, healthText, {
      parse_mode: "Markdown",
    });
  }

  // 📈 상세 통계 (관리자 전용)
  async sendDetailedStats(chatId) {
    const errorStats = errorHandler.getErrorStats();
    const moduleStats = this.moduleManager.getGlobalStats();

    const statsText = `
**📈 ${config.bot.name} 상세 통계**

**🤖 봇 활동:**
• 전체 메시지: ${this.botStats.totalMessages}개
• 전체 콜백: ${this.botStats.totalCallbacks}개
• 고유 사용자: ${this.botStats.totalUsers.size}명
• 평균 응답시간: ${moduleStats.performance.averageResponseTime}ms

**🛡️ 에러 통계:**
• 총 에러: ${errorStats.total}개
• 해결된 에러: ${errorStats.resolved}개
• 미해결 에러: ${errorStats.unresolved}개
• 성공률: ${errorStats.successRate}

**🔝 에러 유형 TOP 3:**
${
  Object.entries(errorStats.byType)
    .slice(0, 3)
    .map(([type, count], index) => `${index + 1}. ${type}: ${count}회`)
    .join("\n") || "• 에러 없음"
}

**🔧 모듈별 에러:**
${
  Object.entries(errorStats.byModule)
    .slice(0, 3)
    .map(([module, count], index) => `${index + 1}. ${module}: ${count}회`)
    .join("\n") || "• 에러 없음"
}
    `.trim();

    await this.bot.sendMessage(chatId, statsText, {
      parse_mode: "Markdown",
    });
  }

  // 🔄 재시작 명령어 처리
  async handleRestartCommand(chatId, userId) {
    Logger.warn(`🔄 관리자 ${userId}가 봇 재시작을 요청함`);

    await this.bot.sendMessage(chatId, "🔄 봇을 재시작합니다...");

    setTimeout(() => {
      process.exit(0); // Railway에서 자동으로 재시작됨
    }, 1000);
  }

  // ❓ 알 수 없는 메시지 처리
  async handleUnknownMessage(msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    if (!text || text.startsWith("/")) return; // 명령어는 무시

    const suggestions = [
      "💡 **도움이 필요하신가요?**\n\n",
      "아래 버튼을 눌러 원하는 기능을 선택하시거나,\n",
      "`/help` 명령어로 도움말을 확인해보세요!",
    ].join("");

    const keyboard = await this.createMainMenuKeyboard();

    await this.bot.sendMessage(chatId, suggestions, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 📋 메인 메뉴 키보드 생성
  async createMainMenuKeyboard() {
    const modules = this.moduleManager._getAvailableModules();

    const keyboard = {
      inline_keyboard: [],
    };

    // 모듈을 2개씩 묶어서 행 생성
    for (let i = 0; i < modules.length; i += 2) {
      const row = modules.slice(i, i + 2).map((module) => ({
        text: `${module.emoji || "🔧"} ${module.displayName}`,
        callback_data: `${module.name}_menu`,
      }));
      keyboard.inline_keyboard.push(row);
    }

    // 도움말 버튼 추가
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "help_menu" },
    ]);

    return keyboard;
  }

  // 👥 사용자 정보 업데이트
  async updateUserInfo(user) {
    try {
      const userData = {
        userId: user.id,
        username: user.username || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        languageCode: user.language_code || null,
        lastActive: new Date(),
      };

      await mongoPoolManager.updateOne("users", { userId: user.id }, userData, {
        upsert: true,
      });
    } catch (error) {
      Logger.debug("사용자 정보 업데이트 실패 (무시됨):", error.message);
    }
  }

  // 🔐 관리자 권한 확인
  isAdminUser(userId) {
    const adminUsers =
      process.env.ADMIN_USERS?.split(",").map((id) => parseInt(id)) || [];
    return adminUsers.includes(userId);
  }

  // 🎨 상태 이모지
  getStatusEmoji(status) {
    const emojiMap = {
      healthy: "✅",
      warning: "⚠️",
      degraded: "🔶",
      critical: "🔴",
      unknown: "❓",
    };
    return emojiMap[status] || "❓";
  }

  // 💓 건강 상태 체크
  async performHealthCheck() {
    try {
      Logger.debug("💓 건강 상태 체크 시작...");

      const checks = {
        database: await mongoPoolManager.isHealthy(),
        modules: await this.moduleManager.healthCheck(),
        errors: errorHandler.getHealthSummary(),
        memory: process.memoryUsage().heapUsed < 512 * 1024 * 1024, // 512MB 미만
      };

      const allHealthy = Object.values(checks).every((check) =>
        typeof check === "boolean" ? check : check.status === "healthy"
      );

      if (!allHealthy) {
        Logger.warn("⚠️ 건강 상태 문제 감지:", checks);
        await errorHandler.triggerAlert("health_check_warning", checks);
      }
    } catch (error) {
      Logger.error("💓 건강 상태 체크 실패:", error);
    }
  }

  // 📊 시간별 통계 저장
  async saveHourlyStats() {
    try {
      const hourlyStats = {
        timestamp: new Date(),
        date: new Date().toISOString().split("T")[0],
        hour: new Date().getHours(),
        bot: {
          totalMessages: this.botStats.totalMessages,
          totalCallbacks: this.botStats.totalCallbacks,
          uniqueUsers: this.botStats.totalUsers.size,
          errors: this.botStats.errors,
        },
        modules: this.moduleManager.getGlobalStats(),
        errors: errorHandler.getErrorStats(),
        system: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        },
      };

      await mongoPoolManager.insertOne("hourly_stats", hourlyStats);
      Logger.debug("📊 시간별 통계 저장됨");

      // 통계 초기화 (일부만)
      this.botStats.totalMessages = 0;
      this.botStats.totalCallbacks = 0;
      this.botStats.errors = 0;
    } catch (error) {
      Logger.debug("📊 통계 저장 실패 (무시됨):", error.message);
    }
  }

  // 🚨 봇 에러 처리
  async handleBotError(error) {
    Logger.error("🤖 봇 에러:", error);
    await errorHandler.handleError(error, { type: "bot_error" });
  }

  // 📡 폴링 에러 처리
  async handlePollingError(error) {
    Logger.error("📡 폴링 에러:", error);

    // 네트워크 오류인 경우 재연결 시도
    if (error.code === "EFATAL" || error.code === "ECONNRESET") {
      Logger.info("🔄 폴링 재연결 시도...");
      setTimeout(() => {
        if (this.bot) {
          this.bot.stopPolling();
          this.bot.startPolling();
        }
      }, 5000);
    }
  }

  // 🚨 처리되지 않은 예외 처리
  async handleUncaughtException(error) {
    Logger.error("🚨 처리되지 않은 예외:", error);
    await errorHandler.handleError(error, { type: "uncaught_exception" });

    // 크리티컬 에러이므로 정리 후 종료
    await this.gracefulShutdown("uncaught_exception");
  }

  // 🚨 처리되지 않은 Promise 거부 처리
  async handleUnhandledRejection(reason, promise) {
    Logger.error("🚨 처리되지 않은 Promise 거부:", reason);
    await errorHandler.handleError(new Error(String(reason)), {
      type: "unhandled_rejection",
      promise: promise.toString(),
    });
  }

  // 🚨 크리티컬 에러 처리
  async handleCriticalError(error) {
    Logger.error("🚨 크리티컬 에러:", error);

    try {
      await errorHandler.triggerAlert("critical_error", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    } catch (alertError) {
      Logger.error("알림 전송 실패:", alertError);
    }
  }

  // 📢 시작 알림
  async sendStartupNotification() {
    if (!process.env.ADMIN_CHAT_ID) return;

    try {
      const startupMessage = `
🚀 **${config.bot.name} v${config.bot.version} 시작됨**

• 🕐 시작 시간: ${this.startTime.toLocaleString()}
• 🌐 환경: ${process.env.NODE_ENV || "development"}
• 🔧 모듈: ${this.moduleManager.modules.size}개 로드됨
• 💾 메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

모든 시스템이 정상 작동 중입니다! ✅
      `.trim();

      await this.bot.sendMessage(process.env.ADMIN_CHAT_ID, startupMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      Logger.debug("시작 알림 전송 실패 (무시됨):", error.message);
    }
  }

  // 🔄 정리 작업 및 종료
  async gracefulShutdown(signal) {
    Logger.info(`🔄 정리 작업 시작... (신호: ${signal})`);

    try {
      // 1. 새로운 요청 차단
      if (this.bot) {
        this.bot.stopPolling();
      }

      // 2. 진행 중인 작업 완료 대기 (최대 10초)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 3. 각 시스템 정리
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }

      // 4. 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 5. 에러 핸들러 정리
      if (errorHandler) {
        errorHandler.cleanup();
      }

      // 6. 데이터베이스 연결 종료
      await mongoPoolManager.disconnect();

      Logger.success("✅ 정리 작업 완료");
    } catch (error) {
      Logger.error("❌ 정리 작업 중 오류:", error);
    } finally {
      process.exit(0);
    }
  }

  // 🚀 봇 시작
  async start() {
    try {
      await this.initialize();

      Logger.success(`
🎉 ${config.bot.name} v${config.bot.version} 가동 중!
🕐 시작 시간: ${this.startTime.toLocaleString()}
🤖 모든 시스템 정상 작동 중...
      `);
    } catch (error) {
      Logger.error("🚨 봇 시작 실패:", error);
      process.exit(1);
    }
  }
}

// 🚀 봇 실행
if (require.main === module) {
  const doomockBot = new DoomockBot();
  doomockBot.start().catch((error) => {
    Logger.error("🚨 봇 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
