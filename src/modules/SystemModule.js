// src/modules/SystemModule.js - v3.0.1 완전 수정본
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule v3.0.1 - 완전 수정된 시스템 핵심 모듈
 *
 * 🎯 주요 수정사항:
 * - setupActions 메서드 완전 구현 (필수!)
 * - handleCallback 메서드 표준화
 * - performBasicSystemCheck 메서드 완전 구현 ⭐
 * - NavigationHandler와 완전 연동
 * - 표준 매개변수 준수
 * - 모든 메서드 완성
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
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
      memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_MB) || 400,
      ...this.config,
    };

    // 📊 시스템 통계
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
      systemChecks: 0,
    };

    logger.info("🏠 SystemModule v3.0.1 생성됨 (완전 수정판)");
  }

  /**
   * 🎯 시스템 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.info("🎯 SystemModule 초기화 시작...");

      // 기본 시스템 체크
      await this.performBasicSystemCheck();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정 (필수 메서드 완전 구현!)
   */
  setupActions() {
    // ✅ 표준 액션 등록 (BaseModule의 registerActions 사용)
    this.registerActions({
      // 📋 메인 액션들
      menu: this.handleMenuAction.bind(this),
      start: this.handleMenuAction.bind(this), // start = menu
      help: this.handleHelpAction.bind(this),
      status: this.handleStatusAction.bind(this),

      // ⚙️ 설정 관련
      settings: this.handleSettingsAction.bind(this),
      about: this.handleAboutAction.bind(this),
      version: this.handleVersionAction.bind(this),
      uptime: this.handleUptimeAction.bind(this),
    });

    logger.debug("🏠 SystemModule 액션 등록 완료 (8개)");
  }

  // ===== 🎯 액션 핸들러들 (표준 매개변수 준수) =====

  /**
   * 🏠 메인 메뉴 액션
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);

      // ✅ 순수 데이터만 수집 (NavigationHandler가 UI 처리)
      const menuData = {
        type: "main_menu",
        userName,
        activeModules: await this.getActiveModules(moduleManager),
        systemStats: this.getSystemStats(),
        timestamp: TimeHelper.getTimestamp(),
      };

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.lastActivity = new Date();

      logger.debug("🏠 SystemModule 메뉴 데이터 수집 완료");

      // ✅ NavigationHandler가 처리할 수 있도록 데이터 반환
      return {
        success: true,
        action: "show_main_menu",
        data: menuData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 메뉴 액션 실패:", error);
      this.systemStats.totalErrors++;
      return this.handleErrorResponse(error);
    }
  }

  /**
   * ❓ 도움말 액션
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const helpData = {
        type: "system_help",
        content: {
          basicCommands: [
            "/start - 메인 메뉴 열기",
            "/help - 도움말 보기",
            "/status - 시스템 상태 확인",
          ],
          moduleCommands: await this.getModuleCommands(moduleManager),
          tips: [
            "버튼을 클릭하여 쉽게 조작할 수 있습니다",
            "언제든 /start로 메인 메뉴로 돌아갈 수 있습니다",
            "문제가 있으면 /status로 시스템 상태를 확인하세요",
          ],
        },
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_help",
        data: helpData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 도움말 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  /**
   * 📊 상태 확인 액션
   */
  async handleStatusAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const statusData = {
        type: "system_status",
        overall: await this.getSystemHealth(),
        modules: await this.getModuleStatus(moduleManager),
        performance: this.getPerformanceStats(),
        environment: {
          version: this.config.version,
          environment: this.config.environment,
          isRailway: this.config.isRailway,
          uptime: this.getUptime(),
        },
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_status",
        data: statusData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 상태 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  /**
   * ⚙️ 설정 액션
   */
  async handleSettingsAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const userId = getUserId(callbackQuery);

      const settingsData = {
        type: "system_settings",
        userPreferences: await this.getUserPreferences(userId),
        systemSettings: {
          notifications: true,
          detailedStatus: this.config.enableDetailedStatus,
          environment: this.config.environment,
        },
        availableOptions: ["notifications", "theme", "language", "timezone"],
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_settings",
        data: settingsData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 설정 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  /**
   * ℹ️ 정보 액션
   */
  async handleAboutAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const aboutData = {
        type: "system_about",
        botInfo: {
          name: this.config.botName,
          version: this.config.version,
          author: "doomock",
          description: "Todo 관리 및 생산성 향상을 위한 텔레그램 봇",
        },
        features: [
          "Todo 관리",
          "타이머 기능",
          "근무시간 관리",
          "휴가 관리",
          "알림 서비스",
          "운세 보기",
          "날씨 정보",
          "TTS 기능",
        ],
        stats: this.getSystemStats(),
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_about",
        data: aboutData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 정보 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  /**
   * 📊 버전 액션
   */
  async handleVersionAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const versionData = {
        type: "system_version",
        current: this.config.version,
        buildInfo: {
          environment: this.config.environment,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        uptime: this.getUptime(),
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_version",
        data: versionData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 버전 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  /**
   * ⏱️ 업타임 액션
   */
  async handleUptimeAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const uptimeData = {
        type: "system_uptime",
        uptime: this.getUptime(),
        startTime: new Date(this.systemStats.startTime).toISOString(),
        currentTime: TimeHelper.getTimestamp(),
        statistics: this.getSystemStats(),
        timestamp: TimeHelper.getTimestamp(),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_uptime",
        data: uptimeData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 업타임 액션 실패:", error);
      return this.handleErrorResponse(error);
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🔍 기본 시스템 체크 (완전 구현!)
   */
  async performBasicSystemCheck() {
    try {
      logger.debug("🔍 SystemModule 기본 시스템 체크 시작...");

      // 1. 필수 의존성 확인
      if (!this.bot) {
        throw new Error("Bot 인스턴스가 없습니다");
      }

      if (!this.moduleManager) {
        throw new Error("ModuleManager 인스턴스가 없습니다");
      }

      // 2. 시스템 리소스 확인
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

      if (memoryMB > this.config.memoryWarningThreshold) {
        logger.warn(`⚠️ 메모리 사용량 높음: ${memoryMB.toFixed(2)}MB`);
      }

      // 3. 환경 설정 확인
      const requiredEnvVars = ["BOT_TOKEN", "MONGO_URL"];
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          logger.warn(`⚠️ 환경변수 누락: ${envVar}`);
        }
      }

      // 4. 봇 연결 상태 확인
      if (this.bot && typeof this.bot.telegram === "object") {
        logger.debug("✅ 봇 인스턴스 정상");
      } else {
        logger.warn("⚠️ 봇 인스턴스 상태 불명확");
      }

      // 5. ModuleManager 상태 확인
      if (this.moduleManager && this.moduleManager.isInitialized) {
        logger.debug("✅ ModuleManager 초기화됨");
      } else {
        logger.debug("⏳ ModuleManager 초기화 대기 중");
      }

      // 6. 시스템 체크 횟수 증가
      this.systemStats.systemChecks++;

      logger.debug("✅ SystemModule 기본 시스템 체크 완료");
    } catch (error) {
      logger.error("❌ SystemModule 기본 시스템 체크 실패:", error);
      throw error;
    }
  }

  // ===== 📊 데이터 수집 메서드들 =====

  /**
   * 활성 모듈 목록 조회
   */
  async getActiveModules(moduleManager) {
    try {
      if (!moduleManager || !moduleManager.moduleInstances) {
        return [];
      }

      const modules = [];
      for (const [moduleKey, instance] of moduleManager.moduleInstances) {
        const config = moduleManager.moduleRegistry.get(moduleKey);
        modules.push({
          key: moduleKey,
          name: config?.name || moduleKey,
          initialized: instance.isInitialized || false,
          healthy: instance.getStatus ? instance.getStatus().healthy : true,
        });
      }

      return modules;
    } catch (error) {
      logger.error("❌ 활성 모듈 조회 실패:", error);
      return [];
    }
  }

  /**
   * 모듈 명령어 목록 조회
   */
  async getModuleCommands(moduleManager) {
    try {
      // 기본 명령어들
      const commands = {
        시스템: ["/start", "/help", "/status"],
        Todo: ["/todo", "/task"],
        타이머: ["/timer", "/pomodoro"],
        근무시간: ["/worktime", "/punch"],
        기타: ["/weather", "/fortune"],
      };

      return commands;
    } catch (error) {
      logger.error("❌ 모듈 명령어 조회 실패:", error);
      return {};
    }
  }

  /**
   * 시스템 통계 조회
   */
  getSystemStats() {
    const uptime = Date.now() - this.systemStats.startTime;

    return {
      uptime: this.formatUptime(uptime),
      totalCallbacks: this.systemStats.totalCallbacks,
      totalMessages: this.systemStats.totalMessages,
      totalErrors: this.systemStats.totalErrors,
      systemChecks: this.systemStats.systemChecks,
      lastActivity: this.systemStats.lastActivity,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * 모듈 상태 조회
   */
  async getModuleStatus(moduleManager) {
    try {
      if (!moduleManager) {
        return { total: 0, active: 0, failed: 0, modules: [] };
      }

      const stats = moduleManager.stats || {};
      const modules = await this.getActiveModules(moduleManager);

      return {
        total: stats.totalModules || 0,
        active: stats.activeModules || 0,
        failed: stats.failedModules || 0,
        successRate: stats.loadSuccessRate || 0,
        modules: modules,
      };
    } catch (error) {
      logger.error("❌ 모듈 상태 조회 실패:", error);
      return { total: 0, active: 0, failed: 0, modules: [] };
    }
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats() {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * 시스템 헬스 체크
   */
  async getSystemHealth() {
    try {
      const memUsage = this.getMemoryUsage();
      const isMemoryHigh =
        memUsage.heapUsed > this.config.memoryWarningThreshold;

      return {
        overall: isMemoryHigh ? "warning" : "healthy",
        memory: isMemoryHigh ? "high" : "normal",
        bot: this.bot ? "connected" : "disconnected",
        moduleManager: this.moduleManager?.isInitialized
          ? "ready"
          : "initializing",
      };
    } catch (error) {
      logger.error("❌ 시스템 헬스 체크 실패:", error);
      return { overall: "error", error: error.message };
    }
  }

  /**
   * 사용자 설정 조회
   */
  async getUserPreferences(userId) {
    try {
      // TODO: 실제 DB에서 사용자 설정 조회
      return {
        notifications: true,
        theme: "auto",
        language: "ko",
        timezone: "Asia/Seoul",
      };
    } catch (error) {
      logger.error("❌ 사용자 설정 조회 실패:", error);
      return {};
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 업타임 조회
   */
  getUptime() {
    const uptime = Date.now() - this.systemStats.startTime;
    return this.formatUptime(uptime);
  }

  /**
   * 업타임 포맷팅
   */
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else {
      return `${minutes}분 ${seconds % 60}초`;
    }
  }

  /**
   * 메모리 사용량 조회
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
    };
  }

  /**
   * 에러 응답 처리
   */
  handleErrorResponse(error) {
    this.systemStats.totalErrors++;

    return {
      success: false,
      error: error.message,
      action: "show_error",
      timestamp: TimeHelper.getTimestamp(),
    };
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
        from: { id: userId },
      } = msg;

      if (!text) return false;

      // 시스템 명령어 처리
      const command = this.extractCommand(text);

      if (["start", "menu", "help", "status"].includes(command)) {
        // 메인 메뉴로 안내
        await this.sendMessage(
          bot,
          chatId,
          `🏠 **시스템 메뉴**\n\n/start 명령으로 메인 메뉴를 열 수 있습니다.`
        );

        this.systemStats.totalMessages++;
        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ SystemModule 메시지 처리 실패:", error);
      this.systemStats.totalErrors++;
      return false;
    }
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      healthy: this.isInitialized && !this.bot,
      initialized: this.isInitialized,
      stats: this.stats,
      systemStats: this.systemStats,
      config: {
        version: this.config.version,
        environment: this.config.environment,
      },
      lastCheck: TimeHelper.getTimestamp(),
    };
  }

  /**
   * 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 SystemModule 정리 시작...");

      // 사용자 상태 정리
      this.userStates.clear();

      // 통계 초기화
      this.systemStats = {
        startTime: Date.now(),
        totalCallbacks: 0,
        totalMessages: 0,
        totalErrors: 0,
        lastActivity: null,
        systemChecks: 0,
      };

      this.isInitialized = false;

      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
