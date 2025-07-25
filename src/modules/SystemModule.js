// src/modules/SystemModule.js - 표준 준수 시스템 모듈 v3.0.1
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule - 시스템 핵심 모듈
 * - 메인 메뉴 관리 (데이터만 제공, UI는 NavigationHandler)
 * - 도움말 시스템
 * - 시스템 상태 모니터링
 * - 설정 관리
 * - Railway 환경 최적화
 *
 * ⚠️ 중요: 인라인 키보드는 NavigationHandler에서 관리!
 *
 * @extends BaseModule
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      validationManager: options.validationManager,
      config: options.config,
    });

    // 🎯 시스템 설정 (Railway 환경변수 기반)
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      botName: process.env.BOT_NAME || "doomock_todoBot",
      maxUsersInStatus: parseInt(process.env.MAX_USERS_IN_STATUS) || 10,
      enableDetailedStatus: process.env.ENABLE_DETAILED_STATUS === "true",
      ...this.config,
    };

    // 📊 시스템 통계
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
    };

    logger.info("🏠 SystemModule v3.0.1 생성됨");
  }

  /**
   * 🎯 시스템 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🎯 SystemModule 초기화 시작...");

      // 시스템 체크
      await this.performSystemCheck();

      // 시작 시간 기록 (TimeHelper 사용)
      this.systemStats.startTime = Date.now();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 메인 액션들 (NavigationHandler가 호출)
      menu: this.showMainMenu,
      help: this.showHelp,
      status: this.showStatus,
      settings: this.showSettings,

      // 상세 기능들
      about: this.showAbout,
      version: this.showVersion,
      uptime: this.showUptime,
      modules: this.showModules,

      // 시스템 관리
      restart: this.handleRestart,
      refresh: this.handleRefresh,
      cancel: this.handleCancel,

      // 설정 관련
      "settings:save": this.saveSettings,
      "settings:reset": this.resetSettings,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    const command = text.toLowerCase().trim();
    const userName = getUserName(msg.from);

    // 📊 통계 업데이트 (TimeHelper 사용)
    this.systemStats.totalMessages++;
    this.systemStats.lastActivity = TimeHelper.getCurrentTime("log");

    switch (command) {
      case "/start":
      case "시작":
        await this.handleStart(bot, msg);
        return true;

      case "/help":
      case "도움말":
        await this.sendHelpMessage(bot, chatId);
        return true;

      case "/status":
      case "상태":
        await this.sendStatusMessage(bot, chatId);
        return true;

      case "/menu":
      case "메뉴":
        await this.sendMainMenu(bot, chatId);
        return true;

      case "/cancel":
      case "취소":
        await this.sendCancelMessage(bot, chatId);
        return true;

      case "/version":
      case "버전":
        await this.sendVersionInfo(bot, chatId);
        return true;

      default:
        return false; // 다른 모듈에서 처리하도록
    }
  }

  // ===== 액션 핸들러들 (NavigationHandler에서 호출) =====

  /**
   * 메인 메뉴 데이터 제공 (NavigationHandler가 UI 처리)
   */
  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const userName = getUserName(callbackQuery.from);

      // 📊 메뉴 데이터만 생성 (키보드는 NavigationHandler에서)
      const menuData = await this.generateMainMenuData(moduleManager);
      const menuText = this.buildMainMenuText(userName, menuData);

      // 🎹 NavigationHandler를 통해 메뉴 전송
      // ⚠️ 실제로는 NavigationHandler가 이 메서드를 호출하므로
      // 여기서는 텍스트만 제공하고 키보드는 NavigationHandler에서 처리

      // 임시로 간단한 메시지만 전송 (실제로는 NavigationHandler에서 처리)
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        // reply_markup은 NavigationHandler에서 처리
      });

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
    } catch (error) {
      logger.error("메인 메뉴 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 불러올 수 없습니다.");
    }
  }

  /**
   * 도움말 표시 (텍스트만 제공)
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const helpText = this.generateHelpText();

      // 텍스트만 업데이트 (키보드는 NavigationHandler에서)
      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("도움말 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "도움말을 불러올 수 없습니다.");
    }
  }

  /**
   * 시스템 상태 표시 (텍스트만 제공)
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const statusText = await this.generateStatusText(moduleManager);

      // 텍스트만 업데이트 (키보드는 NavigationHandler에서)
      await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("상태 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "상태를 불러올 수 없습니다.");
    }
  }

  /**
   * 설정 표시 (텍스트만 제공)
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const settingsText = this.generateSettingsText();

      // 텍스트만 업데이트 (키보드는 NavigationHandler에서)
      await bot.editMessageText(settingsText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("설정 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "설정을 불러올 수 없습니다.");
    }
  }

  /**
   * 모듈 목록 표시 (텍스트만 제공)
   */
  async showModules(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const modulesText = await this.generateModulesText(moduleManager);

      // 텍스트만 업데이트 (키보드는 NavigationHandler에서)
      await bot.editMessageText(modulesText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("모듈 목록 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "모듈 목록을 불러올 수 없습니다."
      );
    }
  }

  /**
   * 새로고침 처리
   */
  async handleRefresh(bot, callbackQuery, params, moduleManager) {
    try {
      // 상태를 다시 보여주기
      await this.showStatus(bot, callbackQuery, params, moduleManager);

      // 알림으로 새로고침 완료 표시
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔄 새로고침 완료!",
        show_alert: false,
      });
    } catch (error) {
      logger.error("새로고침 오류:", error);
      await this.sendError(bot, callbackQuery, "새로고침에 실패했습니다.");
    }
  }

  /**
   * 취소 처리
   */
  async handleCancel(bot, callbackQuery, params, moduleManager) {
    try {
      // 메인 메뉴로 돌아가기
      await this.showMainMenu(bot, callbackQuery, params, moduleManager);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ 작업이 취소되었습니다.",
        show_alert: false,
      });
    } catch (error) {
      logger.error("취소 처리 오류:", error);
      await this.sendError(bot, callbackQuery, "취소 처리에 실패했습니다.");
    }
  }

  // ===== 명령어 전용 메서드들 =====

  /**
   * /start 명령어 처리
   */
  async handleStart(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    const userName = getUserName(msg.from);

    const welcomeText = `🎉 **환영합니다!**

안녕하세요 ${userName}님!
개인 생산성 봇에 오신 것을 환영합니다.

🚀 **주요 기능**
• 📋 할일 관리
• ⏱️ 타이머/뽀모도로
• ⏰ 근무시간 추적
• 📊 생산성 통계

버튼을 눌러 원하는 기능을 사용해보세요! 👇`;

    // 간단한 시작 키보드만 (NavigationHandler 방식 준수)
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, welcomeText, {
      reply_markup: keyboard,
    });

    logger.info(`👋 새 사용자 시작: ${userName} (${userId})`);
  }

  /**
   * 메인 메뉴 전송 (명령어용)
   */
  async sendMainMenu(bot, chatId) {
    const moduleStatus = await this.getModuleStatus();

    const menuText = `🏠 **메인 메뉴**

시스템 상태: ${moduleStatus.activeModules}/${moduleStatus.totalModules}개 모듈 활성
버전: v${this.config.version}

원하는 기능을 선택해주세요! 👇`;

    // 기본 키보드만 (NavigationHandler에서 상세 처리)
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 할일", callback_data: "todo:menu" },
          { text: "⏱️ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "📊 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, menuText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 도움말 메시지 전송 (명령어용)
   */
  async sendHelpMessage(bot, chatId) {
    const helpText = this.generateHelpText();

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(bot, chatId, helpText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 상태 메시지 전송 (명령어용)
   */
  async sendStatusMessage(bot, chatId) {
    const statusText = await this.generateStatusText();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 상세 보기", callback_data: "system:status" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, statusText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 취소 메시지 전송 (명령어용)
   */
  async sendCancelMessage(bot, chatId) {
    await this.sendMessage(bot, chatId, "✅ 작업이 취소되었습니다.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      },
    });
  }

  /**
   * 버전 정보 전송 (명령어용)
   */
  async sendVersionInfo(bot, chatId) {
    const versionText = `📱 **버전 정보**

🤖 봇 버전: v${this.config.version}
🏗️ 환경: ${this.config.environment}
🚂 플랫폼: ${this.config.isRailway ? "Railway" : "로컬"}
📅 시작 시간: ${TimeHelper.format(new Date(this.systemStats.startTime), "full")}
⏱️ 업타임: ${this.getUptime()}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 상태 보기", callback_data: "system:status" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, versionText, {
      reply_markup: keyboard,
    });
  }

  // ===== 텍스트 생성 메서드들 (데이터만 제공) =====

  /**
   * 📊 동적 메인 메뉴 데이터 생성
   */
  async generateMainMenuData(moduleManager) {
    const menuData = {
      activeModules: [],
      inactiveModules: [],
      systemInfo: {
        uptime: this.getUptime(),
        activeUsers: 0, // TODO: 실제 데이터 연동
        version: this.config.version,
      },
    };

    // 🎯 표준 모듈 정의 (우선순위 순)
    const standardModules = [
      {
        key: "todo",
        name: "할일 관리",
        emoji: "📝",
        description: "할일 추가, 완료, 관리",
        priority: 1,
        category: "productivity",
      },
      {
        key: "timer",
        name: "타이머/뽀모도로",
        emoji: "⏰",
        description: "시간 관리 도구",
        priority: 2,
        category: "productivity",
      },
      {
        key: "worktime",
        name: "근무시간",
        emoji: "🕐",
        description: "출퇴근 및 근무시간 관리",
        priority: 3,
        category: "work",
      },
    ];

    // 모듈 활성화 상태 확인
    for (const moduleInfo of standardModules) {
      const isActive =
        moduleManager &&
        moduleManager.hasModule &&
        moduleManager.hasModule(moduleInfo.key);

      if (isActive) {
        menuData.activeModules.push(moduleInfo);
      } else {
        menuData.inactiveModules.push(moduleInfo);
      }
    }

    // 우선순위 순으로 정렬
    menuData.activeModules.sort((a, b) => a.priority - b.priority);

    return menuData;
  }

  /**
   * 📝 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(userName, menuData) {
    let menuText = `🤖 **두목봇 v${this.config.version}**

👋 안녕하세요, **${userName}**님!
원하는 기능을 선택해주세요.

**📊 시스템 현황**
• 🟢 활성 모듈: ${menuData.activeModules.length}개
• ⏱️ 가동 시간: ${menuData.systemInfo.uptime}
• 📱 버전: v${menuData.systemInfo.version}`;

    // 비활성 모듈이 있으면 표시
    if (menuData.inactiveModules.length > 0) {
      menuText += `\n• ⚪ 비활성 모듈: ${menuData.inactiveModules.length}개`;
    }

    return menuText;
  }

  /**
   * 도움말 텍스트 생성
   */
  generateHelpText() {
    return `❓ **도움말**

🤖 **이 봇에 대해**
할일 관리, 타이머, 근무시간 추적 등 다양한 기능을 제공하는 개인 생산성 봇입니다.

📋 **주요 기능**
• **할일 관리**: 작업 추가, 완료 처리, 목록 관리
• **타이머/뽀모도로**: 집중 시간 관리
• **근무시간 추적**: 출퇴근 기록 및 통계
• **시스템 관리**: 상태 확인 및 설정

⌨️ **주요 명령어**
• \`/start\` - 봇 시작 및 메인 메뉴
• \`/help\` - 이 도움말 보기
• \`/status\` - 시스템 상태 확인
• \`/cancel\` - 현재 작업 취소

🎯 **사용 팁**
• 버튼을 클릭하여 쉽게 기능 이용
• 언제든 /cancel로 작업 취소 가능
• 문제 발생 시 /status로 상태 확인

💡 **문의 및 지원**
문제가 있거나 개선 사항이 있다면 개발자에게 문의해주세요.`;
  }

  /**
   * 상태 텍스트 생성 (TimeHelper 사용)
   */
  async generateStatusText(moduleManager) {
    const moduleStatus = await this.getModuleStatus(moduleManager);
    const dbStatus = await this.getDatabaseStatus();
    const uptime = this.getUptime();

    return `📊 **시스템 상태**

🤖 **봇 정보**
• 이름: ${this.config.botName}
• 버전: v${this.config.version}
• 환경: ${this.config.environment}
• 플랫폼: ${this.config.isRailway ? "🚂 Railway" : "💻 로컬"}

⏱️ **운영 상태**
• 업타임: ${uptime}
• 시작 시간: ${TimeHelper.format(new Date(this.systemStats.startTime), "full")}
• 마지막 활동: ${this.systemStats.lastActivity || "없음"}

📦 **모듈 상태**
• 전체 모듈: ${moduleStatus.totalModules}개
• 활성 모듈: ${moduleStatus.activeModules}개
• 실패 모듈: ${moduleStatus.totalModules - moduleStatus.activeModules}개

📊 **활동 통계**
• 총 콜백: ${this.systemStats.totalCallbacks.toLocaleString()}
• 총 메시지: ${this.systemStats.totalMessages.toLocaleString()}
• 총 오류: ${this.systemStats.totalErrors.toLocaleString()}

💾 **데이터베이스**
• 상태: ${dbStatus.connected ? "✅ 연결됨" : "❌ 연결 안됨"}
• 데이터베이스: ${dbStatus.name || "알 수 없음"}

🔄 **마지막 업데이트**: ${TimeHelper.getCurrentTime("log")}`;
  }

  /**
   * 설정 텍스트 생성
   */
  generateSettingsText() {
    return `⚙️ **설정**

🎛️ **시스템 설정**
• 버전: v${this.config.version}
• 환경: ${this.config.environment}
• 디버그 모드: ${this.config.environment === "development" ? "✅" : "❌"}
• 상세 상태: ${this.config.enableDetailedStatus ? "✅" : "❌"}

📊 **통계 설정**
• 상태의 최대 사용자: ${this.config.maxUsersInStatus}
• 캐시 활성화: ${this.config.cacheEnabled ? "✅" : "❌"}
• 타임아웃: ${this.config.timeout}ms

💡 **참고**: 일부 설정은 환경변수로 관리되며 재시작이 필요할 수 있습니다.`;
  }

  /**
   * 모듈 목록 텍스트 생성
   */
  async generateModulesText(moduleManager) {
    const modules = await this.getDetailedModuleStatus(moduleManager);

    let modulesText = `📦 **모듈 목록**\n\n`;

    modules.forEach((module) => {
      const status = module.initialized ? "✅" : "❌";
      const features = module.features
        ? module.features.join(", ")
        : "정보 없음";

      modulesText += `${status} **${module.name}**\n`;
      modulesText += `   └ ${module.description}\n`;
      modulesText += `   └ 기능: ${features}\n\n`;
    });

    return modulesText;
  }

  // ===== 유틸리티 메서드들 (TimeHelper 사용) =====

  /**
   * 시스템 체크 수행
   */
  async performSystemCheck() {
    try {
      // 기본 체크들
      const checks = {
        botInstance: !!this.bot,
        moduleManager: !!this.moduleManager,
        database: !!this.db,
        validationManager: !!this.validationManager,
        timeHelper: !!TimeHelper,
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      logger.info(`🔍 시스템 체크: ${passedChecks}/${totalChecks} 통과`);

      if (passedChecks < totalChecks) {
        logger.warn("⚠️ 일부 시스템 컴포넌트가 누락되었습니다:", checks);
      }

      return checks;
    } catch (error) {
      logger.error("시스템 체크 오류:", error);
      return {};
    }
  }

  /**
   * 모듈 상태 가져오기
   */
  async getModuleStatus(moduleManager = this.moduleManager) {
    try {
      if (!moduleManager) {
        return { totalModules: 0, activeModules: 0, modules: [] };
      }

      const status = moduleManager.getStatus();
      return {
        totalModules: status.stats.totalModules || 0,
        activeModules: status.stats.activeModules || 0,
        modules: status.modules || [],
      };
    } catch (error) {
      logger.error("모듈 상태 확인 오류:", error);
      return { totalModules: 0, activeModules: 0, modules: [] };
    }
  }

  /**
   * 상세 모듈 상태 가져오기
   */
  async getDetailedModuleStatus(moduleManager = this.moduleManager) {
    try {
      if (!moduleManager || !moduleManager.moduleRegistry) {
        return [];
      }

      const modules = [];
      for (const [key, config] of moduleManager.moduleRegistry) {
        modules.push({
          key,
          name: config.name,
          description: config.description,
          initialized: config.initialized || false,
          features: config.features || [],
          priority: config.priority || 999,
        });
      }

      return modules.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error("상세 모듈 상태 확인 오류:", error);
      return [];
    }
  }

  /**
   * 데이터베이스 상태 가져오기
   */
  async getDatabaseStatus() {
    try {
      if (!this.db) {
        return { connected: false, name: null };
      }

      // MongoDB 연결 상태 체크
      const adminDb = this.db.admin();
      const status = await adminDb.ping();

      return {
        connected: status.ok === 1,
        name: this.db.databaseName || "알 수 없음",
      };
    } catch (error) {
      logger.error("데이터베이스 상태 확인 오류:", error);
      return { connected: false, name: null };
    }
  }

  /**
   * 업타임 가져오기 (TimeHelper 사용)
   */
  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    return TimeHelper.humanize(uptimeMs);
  }

  /**
   * 설정 저장
   */
  async saveSettings(bot, callbackQuery, params, moduleManager) {
    try {
      // 실제로는 환경변수나 DB에 저장하겠지만,
      // 여기서는 메모리에만 저장하는 시뮬레이션
      logger.info("💾 설정 저장됨 (시뮬레이션)");

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "💾 설정이 저장되었습니다!",
        show_alert: true,
      });

      // 설정 화면으로 돌아가기
      await this.showSettings(bot, callbackQuery, params, moduleManager);
    } catch (error) {
      logger.error("설정 저장 오류:", error);
      await this.sendError(bot, callbackQuery, "설정 저장에 실패했습니다.");
    }
  }

  /**
   * 설정 초기화
   */
  async resetSettings(bot, callbackQuery, params, moduleManager) {
    try {
      // 기본값으로 복원
      this.config = {
        version: process.env.npm_package_version || "3.0.1",
        environment: process.env.NODE_ENV || "development",
        isRailway: !!process.env.RAILWAY_ENVIRONMENT,
        botName: process.env.BOT_NAME || "doomock_todoBot",
        maxUsersInStatus: 10,
        enableDetailedStatus: false,
        timeout: 30000,
        maxRetries: 3,
        cacheEnabled: true,
      };

      logger.info("🔄 설정이 기본값으로 복원됨");

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔄 설정이 기본값으로 복원되었습니다!",
        show_alert: true,
      });

      // 설정 화면으로 돌아가기
      await this.showSettings(bot, callbackQuery, params, moduleManager);
    } catch (error) {
      logger.error("설정 초기화 오류:", error);
      await this.sendError(bot, callbackQuery, "설정 초기화에 실패했습니다.");
    }
  }

  /**
   * 모듈 상태 조회 (BaseModule 오버라이드)
   */
  getStatus() {
    return {
      ...super.getStatus(),
      systemInfo: {
        version: this.config.version,
        environment: this.config.environment,
        isRailway: this.config.isRailway,
        uptime: this.getUptime(),
      },
      systemStats: this.systemStats,
    };
  }

  /**
   * 정리 작업 (BaseModule 오버라이드)
   */
  async onCleanup() {
    try {
      // 시스템 통계 정리
      this.systemStats = {
        startTime: Date.now(),
        totalCallbacks: 0,
        totalMessages: 0,
        totalErrors: 0,
        lastActivity: null,
      };

      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
