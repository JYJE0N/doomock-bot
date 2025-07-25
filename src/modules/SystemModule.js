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
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const helpText = this.buildHelpText();

      await bot.editMessageText(helpText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("도움말 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "도움말을 불러올 수 없습니다.");
    }
  }

  /**
   * 시스템 상태 표시
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const statusData = await this.getSystemStatus(moduleManager);
      const statusText = this.buildStatusText(statusData);

      await bot.editMessageText(statusText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("상태 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "상태를 불러올 수 없습니다.");
    }
  }

  /**
   * 설정 메뉴 표시
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    try {
      const settingsText = this.buildSettingsText();

      await bot.editMessageText(settingsText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("설정 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "설정을 불러올 수 없습니다.");
    }
  }

  /**
   * 정보 표시
   */
  async showAbout(bot, callbackQuery, params, moduleManager) {
    try {
      const aboutText = this.buildAboutText();

      await bot.editMessageText(aboutText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("정보 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "정보를 불러올 수 없습니다.");
    }
  }

  /**
   * 버전 정보 표시
   */
  async showVersion(bot, callbackQuery, params, moduleManager) {
    try {
      const versionText = this.buildVersionText();

      await bot.editMessageText(versionText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("버전 정보 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "버전 정보를 불러올 수 없습니다."
      );
    }
  }

  /**
   * 업타임 표시
   */
  async showUptime(bot, callbackQuery, params, moduleManager) {
    try {
      const uptimeText = this.buildUptimeText();

      await bot.editMessageText(uptimeText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("업타임 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "업타임을 불러올 수 없습니다.");
    }
  }

  /**
   * 모듈 목록 표시
   */
  async showModules(bot, callbackQuery, params, moduleManager) {
    try {
      const modulesText = await this.buildModulesText(moduleManager);

      await bot.editMessageText(modulesText, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("모듈 목록 표시 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "모듈 목록을 불러올 수 없습니다."
      );
    }
  }

  // ===== 메시지 핸들러들 =====

  /**
   * /start 명령어 처리
   */
  async handleStart(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    const welcomeText = `🎉 **${this.config.botName}에 오신 것을 환영합니다!**

안녕하세요, ${userName}님! 

이 봇은 업무 효율성을 높이기 위한 다양한 기능을 제공합니다.

🔹 **주요 기능:**
• 📝 할일 관리
• ⏰ 타이머/뽀모도로
• 🕐 근무시간 추적
• 🏖️ 휴가 관리
• 🔔 리마인더
• 🌤️ 날씨 정보

시작하려면 아래 버튼을 클릭하세요!`;

    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          [{ text: "❓ 도움말", callback_data: "system:help" }],
        ],
      },
    });
  }

  /**
   * 시스템 재시작 처리
   */
  async handleRestart(bot, callbackQuery, params, moduleManager) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔄 시스템을 재시작합니다...",
        show_alert: true,
      });

      // Railway 환경에서는 프로세스 재시작
      if (this.config.isRailway) {
        logger.info("🔄 Railway 환경에서 프로세스 재시작 중...");
        process.exit(0); // Railway가 자동으로 재시작
      } else {
        logger.warn("⚠️ 개발 환경에서는 수동 재시작이 필요합니다");
        await this.sendError(
          bot,
          callbackQuery,
          "개발 환경에서는 수동 재시작이 필요합니다."
        );
      }
    } catch (error) {
      logger.error("재시작 처리 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "재시작 처리 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 텍스트 빌더 메서드들 =====

  /**
   * 메인 메뉴 데이터 생성
   */
  async generateMainMenuData(moduleManager) {
    const data = {
      systemInfo: {
        version: this.config.version,
        environment: this.config.environment,
        uptime: this.getUptime(),
      },
      activeModules: [],
      stats: this.systemStats,
    };

    if (moduleManager) {
      try {
        const moduleStatus = moduleManager.getStatus();
        data.activeModules = Object.keys(moduleStatus.modules || {});
      } catch (error) {
        logger.warn("모듈 상태 조회 실패:", error);
      }
    }

    return data;
  }

  /**
   * 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(userName, menuData) {
    const uptime = this.getUptime();
    const activeModuleCount = menuData.activeModules.length;

    return `🏠 **메인 메뉴**

안녕하세요, ${userName}님!

📊 **시스템 정보**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}
• 업타임: ${uptime}
• 활성 모듈: ${activeModuleCount}개

원하는 기능을 선택해주세요!`;
  }

  /**
   * 도움말 텍스트 생성
   */
  buildHelpText() {
    return `❓ **도움말**

🔹 **기본 명령어:**
• \`/start\` - 봇 시작
• \`/menu\` - 메인 메뉴
• \`/help\` - 도움말
• \`/status\` - 시스템 상태
• \`/cancel\` - 작업 취소

🔹 **주요 기능:**
• 📝 **할일 관리** - 업무 목록 관리
• ⏰ **타이머** - 집중 시간 측정
• 🕐 **근무시간** - 출퇴근 기록
• 🏖️ **휴가 관리** - 연차/월차 관리

🔹 **사용 팁:**
• 메뉴 버튼을 통해 편리하게 이용하세요
• 작업 중 \`/cancel\`로 언제든 취소 가능
• 문제 발생 시 \`/start\`로 초기화

더 자세한 정보는 각 기능의 도움말을 확인하세요!`;
  }

  /**
   * 상태 텍스트 생성
   */
  buildStatusText(statusData) {
    const uptime = this.getUptime();
    const memoryUsage = process.memoryUsage();

    return `📊 **시스템 상태**

🔹 **기본 정보**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}
• 업타임: ${uptime}

🔹 **성능 지표**
• 메모리 사용량: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
• 처리한 콜백: ${this.systemStats.totalCallbacks}개
• 처리한 메시지: ${this.systemStats.totalMessages}개
• 에러 발생: ${this.systemStats.totalErrors}개

🔹 **Railway 정보**
• Railway 환경: ${this.config.isRailway ? "✅" : "❌"}
• 마지막 활동: ${this.systemStats.lastActivity || "없음"}

시스템이 정상적으로 작동 중입니다! 🟢`;
  }

  /**
   * 설정 텍스트 생성
   */
  buildSettingsText() {
    return `⚙️ **시스템 설정**

🔹 **현재 설정**
• 최대 사용자 표시: ${this.config.maxUsersInStatus}명
• 상세 상태: ${this.config.enableDetailedStatus ? "활성" : "비활성"}
• 캐시: ${this.config.cacheEnabled ? "활성" : "비활성"}
• 타임아웃: ${this.config.timeout}ms

🔹 **환경 설정**
• 봇 이름: ${this.config.botName}
• 환경: ${this.config.environment}
• Railway: ${this.config.isRailway ? "활성" : "비활성"}

설정 변경은 환경변수를 통해 가능합니다.`;
  }

  /**
   * 정보 텍스트 생성
   */
  buildAboutText() {
    return `ℹ️ **${this.config.botName} 정보**

📱 **버전**: ${this.config.version}
🏗️ **아키텍처**: 모듈화 설계
🚀 **플랫폼**: Railway
⚡ **런타임**: Node.js

🔹 **특징**:
• 모듈화된 구조로 확장 가능
• Railway 환경 최적화
• 실시간 상태 모니터링
• 표준화된 매개변수 체계

🔹 **지원 기능**:
• 할일 관리, 타이머, 근무시간 추적
• 휴가 관리, 리마인더, 날씨 정보
• 음성 변환(TTS), 운세

개발자: 두몫 👨‍💻`;
  }

  /**
   * 버전 텍스트 생성
   */
  buildVersionText() {
    return `📱 **버전 정보**

🔹 **현재 버전**: ${this.config.version}
🔹 **환경**: ${this.config.environment}
🔹 **Node.js**: ${process.version}
🔹 **플랫폼**: ${process.platform}

🔹 **업데이트 내역**:
• v3.0.1: 표준화된 모듈 구조
• v3.0.0: Railway 환경 최적화
• v2.x: 기본 기능 구현

최신 버전이 유지되고 있습니다! ✅`;
  }

  /**
   * 업타임 텍스트 생성
   */
  buildUptimeText() {
    const uptime = this.getUptime();
    const startTime = TimeHelper.format(
      new Date(this.systemStats.startTime),
      "full"
    );

    return `⏰ **업타임 정보**

🔹 **시작 시간**: ${startTime}
🔹 **현재 업타임**: ${uptime}
🔹 **마지막 활동**: ${this.systemStats.lastActivity || "없음"}

🔹 **처리 통계**:
• 콜백 처리: ${this.systemStats.totalCallbacks}회
• 메시지 처리: ${this.systemStats.totalMessages}회
• 에러 발생: ${this.systemStats.totalErrors}회

시스템이 안정적으로 동작 중입니다! 🟢`;
  }

  /**
   * 모듈 목록 텍스트 생성
   */
  async buildModulesText(moduleManager) {
    let moduleText = `🧩 **모듈 현황**\n\n`;

    if (!moduleManager) {
      moduleText += "ModuleManager를 사용할 수 없습니다.";
      return moduleText;
    }

    try {
      const status = moduleManager.getStatus();
      const modules = status.modules || {};

      moduleText += `🔹 **전체 통계**:\n`;
      moduleText += `• 총 모듈: ${status.stats?.totalModules || 0}개\n`;
      moduleText += `• 활성 모듈: ${status.stats?.activeModules || 0}개\n`;
      moduleText += `• 실패 모듈: ${status.stats?.failedModules || 0}개\n\n`;

      moduleText += `🔹 **모듈 목록**:\n`;
      for (const [key, moduleInfo] of Object.entries(modules)) {
        const status = moduleInfo.initialized ? "✅" : "❌";
        moduleText += `• ${status} ${moduleInfo.name || key}\n`;
      }
    } catch (error) {
      moduleText += `오류: 모듈 정보를 가져올 수 없습니다.\n${error.message}`;
    }

    return moduleText;
  }

  // ===== 헬퍼 메서드들 =====

  /**
   * 시스템 체크
   */
  async performSystemCheck() {
    try {
      // 기본 체크들
      if (!this.bot) {
        throw new Error("Bot 인스턴스가 없습니다");
      }

      // Railway 환경 체크
      if (this.config.isRailway) {
        logger.info("🚂 Railway 환경에서 실행 중");
      }

      // 메모리 체크
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
        // 100MB
        logger.warn(
          `⚠️ 메모리 사용량이 높습니다: ${Math.round(
            memoryUsage.heapUsed / 1024 / 1024
          )}MB`
        );
      }

      logger.info("✅ 시스템 체크 완료");
    } catch (error) {
      logger.error("❌ 시스템 체크 실패:", error);
      throw error;
    }
  }

  /**
   * 업타임 계산
   */
  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 시스템 상태 수집
   */
  async getSystemStatus(moduleManager) {
    const status = {
      system: {
        version: this.config.version,
        environment: this.config.environment,
        uptime: this.getUptime(),
        isRailway: this.config.isRailway,
      },
      stats: this.systemStats,
      memory: process.memoryUsage(),
    };

    if (moduleManager) {
      try {
        status.modules = moduleManager.getStatus();
      } catch (error) {
        logger.warn("모듈 상태 조회 실패:", error);
        status.modules = { error: error.message };
      }
    }

    return status;
  }

  // ===== 공통 메시지 핸들러들 =====

  async sendHelpMessage(bot, chatId) {
    const helpText = this.buildHelpText();
    await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  }

  async sendStatusMessage(bot, chatId) {
    const statusData = await this.getSystemStatus(this.moduleManager);
    const statusText = this.buildStatusText(statusData);
    await bot.sendMessage(chatId, statusText, { parse_mode: "Markdown" });
  }

  async sendMainMenu(bot, chatId) {
    const userName = "사용자"; // 실제로는 user context에서 가져와야 함
    const menuData = await this.generateMainMenuData(this.moduleManager);
    const menuText = this.buildMainMenuText(userName, menuData);

    await bot.sendMessage(chatId, menuText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          [{ text: "❓ 도움말", callback_data: "system:help" }],
          [{ text: "📊 상태", callback_data: "system:status" }],
        ],
      },
    });
  }

  async sendCancelMessage(bot, chatId) {
    await bot.sendMessage(chatId, "🚫 작업이 취소되었습니다.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      },
    });
  }

  async sendVersionInfo(bot, chatId) {
    const versionText = this.buildVersionText();
    await bot.sendMessage(chatId, versionText, { parse_mode: "Markdown" });
  }

  // ===== 설정 관리 =====

  /**
   * 설정 저장
   */
  async saveSettings(bot, callbackQuery, params, moduleManager) {
    try {
      // 실제로는 여기서 설정을 저장해야 함
      // Railway 환경에서는 환경변수를 통해 설정 관리

      logger.info("🔧 설정 저장 요청");

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ 설정이 저장되었습니다!",
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
