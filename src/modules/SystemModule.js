// src/modules/SystemModule.js - 수정된 데이터 전용 버전
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule v3.0.1 - 데이터 전용 버전 (키보드 생성 제거)
 *
 * ✅ 수정 사항:
 * - setupActions() 메서드 추가 (필수!)
 * - 모든 키보드 생성 로직 제거
 * - 순수 데이터만 반환하도록 변경
 * - NavigationHandler가 UI 처리하도록 위임
 * - 기존 비즈니스 로직은 최대한 유지
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

    // 🎯 시스템 설정 (기존 유지)
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

    // 📊 시스템 통계 (기존 유지)
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
      systemChecks: 0,
    };

    logger.info("🏠 SystemModule v3.0.1 생성됨 (데이터 전용)");
  }

  /**
   * 🎯 시스템 모듈 초기화 (기존 유지)
   */
  async onInitialize() {
    try {
      logger.info("🎯 SystemModule 초기화 시작...");

      // 기본 시스템 체크 (기존 로직 유지)
      await this.performBasicSystemCheck();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 액션 설정 (새로 추가된 필수 메서드!)
   */
  setupActions() {
    this.registerActions({
      // 📋 메인 액션들
      menu: this.handleMenuAction.bind(this),
      start: this.handleMenuAction.bind(this), // start = menu
      help: this.handleHelpAction.bind(this),
      status: this.handleStatusAction.bind(this),

      // ⚙️ 설정 관련 (추후 구현)
      settings: this.handleSettingsAction.bind(this),
      about: this.handleAboutAction.bind(this),
      version: this.handleVersionAction.bind(this),
      uptime: this.handleUptimeAction.bind(this),
    });

    logger.debug("🏠 SystemModule 액션 등록 완료 (데이터 전용)");
  }

  // ===== ✅ 수정된 액션 핸들러들 (데이터만 반환) =====

  /**
   * 🏠 메인 메뉴 액션 - ✅ 데이터만 반환
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);

      // ✅ 순수 데이터만 수집
      const menuData = {
        type: "main_menu",
        userName,
        activeModules: await this.getActiveModules(moduleManager),
        systemStats: this.getSystemStats(),
        timestamp: new Date().toISOString(),
      };

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.lastActivity = TimeHelper.getTimestamp();

      // ✅ NavigationHandler가 UI를 처리하도록 데이터만 반환
      return {
        success: true,
        action: "show_main_menu",
        data: menuData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 메뉴 데이터 수집 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * ❓ 도움말 액션 - ✅ 데이터만 반환
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const helpData = {
        type: "system_help",
        content: {
          basicCommands: [
            { command: "/start", description: "봇 시작 및 메인 메뉴" },
            { command: "/help", description: "도움말 표시" },
            { command: "/status", description: "시스템 상태 확인" },
            { command: "/cancel", description: "현재 작업 취소" },
          ],
          features: [
            "📝 할일 관리 - 체계적인 업무 관리",
            "⏰ 타이머 기능 - 포모도로 테크닉 지원",
            "🕐 근무시간 관리 - 출퇴근 기록",
            "🏖️ 휴가 관리 - 연차/월차 신청",
            "🔔 리마인더 - 중요한 일정 알림",
          ],
          tips: [
            "인라인 키보드를 활용해 쉽게 조작하세요",
            "/cancel로 언제든 작업을 취소할 수 있습니다",
            "문제 발생 시 /start로 재시작하세요",
            "시스템 상태는 /status로 확인 가능합니다",
          ],
        },
        availableModules: await this.getActiveModules(moduleManager),
      };

      this.systemStats.totalCallbacks++;

      return {
        success: true,
        action: "show_help",
        data: helpData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 도움말 데이터 수집 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  /**
   * 📊 상태 액션 - ✅ 데이터만 반환
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
        systemInfo: {
          version: this.config.version,
          environment: this.config.environment,
          isRailway: this.config.isRailway,
          botName: this.config.botName,
          uptime: this.getUptime(),
          memory: this.getMemoryUsage(),
        },
        moduleStats: await this.getModuleStats(moduleManager),
        systemStats: this.getSystemStats(),
        lastCheck: new Date().toISOString(),
      };

      this.systemStats.totalCallbacks++;
      this.systemStats.systemChecks++;

      return {
        success: true,
        action: "show_status",
        data: statusData,
      };
    } catch (error) {
      logger.error("❌ SystemModule 상태 데이터 수집 실패:", error);
      return {
        success: false,
        error: error.message,
        action: "show_error",
      };
    }
  }

  // ===== 🔧 빠른 스텁 메서드들 (추후 구현) =====

  async handleSettingsAction() {
    return {
      success: true,
      action: "show_not_implemented",
      data: { feature: "설정", message: "설정 기능이 곧 추가될 예정입니다." },
    };
  }

  async handleAboutAction() {
    return {
      success: true,
      action: "show_about",
      data: {
        type: "about",
        botInfo: {
          name: "두목봇",
          version: this.config.version,
          description: "업무 효율성을 높이는 통합 관리 봇",
          developer: "DooMock Team",
          features: ["할일 관리", "타이머", "근무시간", "휴가관리", "리마인더"],
        },
      },
    };
  }

  async handleVersionAction() {
    return {
      success: true,
      action: "show_version",
      data: {
        type: "version_info",
        current: this.config.version,
        environment: this.config.environment,
        buildDate: this.systemStats.startTime,
        uptime: this.getUptime(),
      },
    };
  }

  async handleUptimeAction() {
    return {
      success: true,
      action: "show_uptime",
      data: {
        type: "uptime_info",
        startTime: this.systemStats.startTime,
        uptime: this.getUptime(),
        totalCallbacks: this.systemStats.totalCallbacks,
        lastActivity: this.systemStats.lastActivity,
      },
    };
  }

  // ===== 📊 순수 데이터 메서드들 (기존 로직 유지, UI 제거) =====

  /**
   * 활성 모듈 데이터 수집
   */
  async getActiveModules(moduleManager) {
    try {
      if (!moduleManager || !moduleManager.getModuleList) {
        return [];
      }

      const modules = moduleManager.getModuleList();
      const activeModules = [];

      for (const module of modules) {
        if (module.active && module.key !== "SystemModule") {
          activeModules.push({
            key: module.key,
            name: module.name,
            emoji: this.getModuleEmoji(module.key),
            priority: module.priority,
            features: module.features || [],
            initialized: module.initialized,
          });
        }
      }

      // 우선순위 순으로 정렬
      return activeModules.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error("활성 모듈 데이터 수집 오류:", error);
      return [];
    }
  }

  /**
   * 모듈 통계 수집
   */
  async getModuleStats(moduleManager) {
    try {
      if (!moduleManager) {
        return {
          totalModules: 0,
          activeModules: 0,
          failedModules: 0,
          loadSuccessRate: 0,
        };
      }

      const stats = moduleManager.stats || {};
      return {
        totalModules: stats.totalModules || 0,
        activeModules: stats.activeModules || 0,
        failedModules: stats.failedModules || 0,
        loadSuccessRate: stats.loadSuccessRate || 0,
        lastActivity: stats.lastActivity || null,
      };
    } catch (error) {
      logger.error("모듈 통계 수집 오류:", error);
      return {
        totalModules: 0,
        activeModules: 0,
        failedModules: 0,
        loadSuccessRate: 0,
      };
    }
  }

  /**
   * 시스템 통계 반환
   */
  getSystemStats() {
    return {
      startTime: this.systemStats.startTime,
      uptime: this.getUptime(),
      totalCallbacks: this.systemStats.totalCallbacks,
      totalMessages: this.systemStats.totalMessages,
      totalErrors: this.systemStats.totalErrors,
      lastActivity: this.systemStats.lastActivity,
      systemChecks: this.systemStats.systemChecks,
    };
  }

  /**
   * 모듈 이모지 매핑
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      TodoModule: "📝",
      TimerModule: "⏰",
      WorktimeModule: "🕐",
      LeaveModule: "🏖️",
      ReminderModule: "🔔",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TTSModule: "🎤",
    };
    return emojiMap[moduleKey] || "🔧";
  }

  /**
   * 업타임 계산
   */
  getUptime() {
    const uptimeSeconds = (Date.now() - this.systemStats.startTime) / 1000;
    return this.formatUptime(uptimeSeconds);
  }

  /**
   * 업타임 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 메모리 사용량 확인
   */
  getMemoryUsage() {
    try {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        isWarning: usage.rss / 1024 / 1024 > this.config.memoryWarningThreshold,
      };
    } catch (error) {
      logger.error("메모리 사용량 확인 오류:", error);
      return {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        isWarning: false,
      };
    }
  }

  /**
   * 기본 시스템 체크 (기존 로직 유지)
   */
  async performBasicSystemCheck() {
    try {
      // 환경 변수 체크
      const requiredEnvVars = ["BOT_TOKEN"];
      const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName]
      );

      if (missingVars.length > 0) {
        logger.warn(`⚠️ 누락된 환경변수: ${missingVars.join(", ")}`);
      }

      // 메모리 체크
      const memory = this.getMemoryUsage();
      if (memory.isWarning) {
        logger.warn(`⚠️ 높은 메모리 사용량: ${memory.rss}MB`);
      }

      // 시간대 체크
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      logger.debug(`🕐 시간대: ${timezone}`);

      this.systemStats.systemChecks++;
      logger.debug("✅ 기본 시스템 체크 완료");
    } catch (error) {
      logger.error("❌ 시스템 체크 오류:", error);
      throw error;
    }
  }

  /**
   * 📊 상태 조회 (BaseModule 오버라이드)
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      systemInfo: {
        version: this.config.version,
        environment: this.config.environment,
        isRailway: this.config.isRailway,
        uptime: this.getUptime(),
      },
      systemStats: this.systemStats,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * 🧹 정리 작업 (기존 로직 유지)
   */
  async cleanup() {
    try {
      // 상위 클래스 정리
      await super.cleanup();

      // 시스템 통계 저장 등 필요한 정리 작업
      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
