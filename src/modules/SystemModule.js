// src/modules/SystemModule.js - 올바른 역할 분담 v3.0.1
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule v3.0.1 - 올바른 역할 분담 버전
 *
 * 🎯 핵심 원칙:
 * - 데이터만 제공, UI 생성은 NavigationHandler가 담당
 * - 순수한 비즈니스 로직만 포함
 * - 시스템 상태 관리에만 집중
 * - 키보드 생성 로직 완전 제거
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

    // 🎯 시스템 설정
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

    logger.info("🏠 SystemModule v3.0.1 생성됨 (데이터 전용)");
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
   * 🎯 액션 설정 (데이터 제공 액션만)
   */
  setupActions() {
    this.registerActions({
      // 📋 데이터 제공 액션들
      menu: this.getMenuData.bind(this),
      start: this.getMenuData.bind(this),
      help: this.getHelpData.bind(this),
      status: this.getStatusData.bind(this),
      settings: this.getSettingsData.bind(this),
      about: this.getAboutData.bind(this),
      version: this.getVersionData.bind(this),
      uptime: this.getUptimeData.bind(this),
    });

    logger.debug("🏠 SystemModule 액션 등록 완료 (데이터 전용)");
  }

  // ===== 📊 데이터 제공 메서드들 (UI 로직 없음) =====

  /**
   * 🏠 메인 메뉴 데이터 제공
   */
  async getMenuData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const menuData = await this.collectMainMenuData(moduleManager);

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.lastActivity = TimeHelper.getTimestamp();

      // ✅ 순수 데이터만 반환 (NavigationHandler가 UI 생성)
      return {
        success: true,
        data: {
          type: "main_menu",
          userName,
          menuData,
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
        data: {
          type: "main_menu",
          userName: "사용자",
          menuData: this.getFallbackMenuData(),
        },
      };
    }
  }

  /**
   * ❓ 도움말 데이터 제공
   */
  async getHelpData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      return {
        success: true,
        data: {
          type: "help",
          helpContent: this.buildHelpContent(),
          availableModules: this.getAvailableModules(moduleManager),
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 도움말 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
        data: {
          type: "help",
          helpContent: "도움말을 불러올 수 없습니다.",
        },
      };
    }
  }

  /**
   * 📊 상태 데이터 제공
   */
  async getStatusData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      const statusInfo = await this.collectSystemStatus(moduleManager);

      return {
        success: true,
        data: {
          type: "status",
          statusInfo,
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 상태 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
        data: {
          type: "status",
          statusInfo: this.getFallbackStatusInfo(),
        },
      };
    }
  }

  /**
   * ⚙️ 설정 데이터 제공
   */
  async getSettingsData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      return {
        success: true,
        data: {
          type: "settings",
          currentSettings: this.getCurrentSettings(),
          availableSettings: this.getAvailableSettings(),
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 설정 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ℹ️ 정보 데이터 제공
   */
  async getAboutData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      return {
        success: true,
        data: {
          type: "about",
          aboutInfo: this.getAboutInfo(),
          systemInfo: this.getSystemInfo(),
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 정보 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 📱 버전 데이터 제공
   */
  async getVersionData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      return {
        success: true,
        data: {
          type: "version",
          versionInfo: this.getVersionInfo(),
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 버전 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ⏰ 업타임 데이터 제공
   */
  async getUptimeData(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      this.systemStats.totalCallbacks++;

      return {
        success: true,
        data: {
          type: "uptime",
          uptimeInfo: this.getUptimeInfo(),
          timestamp: TimeHelper.getTimestamp(),
        },
      };
    } catch (error) {
      logger.error("❌ SystemModule 업타임 데이터 생성 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ===== 🛠️ 순수 데이터 수집 메서드들 =====

  /**
   * 📊 메인 메뉴 데이터 수집
   */
  async collectMainMenuData(moduleManager) {
    try {
      const activeModules = [];
      const inactiveModules = [];

      if (moduleManager && typeof moduleManager.getModuleList === "function") {
        const moduleList = moduleManager.getModuleList();

        for (const module of moduleList) {
          if (module.key === "system") continue; // 시스템 모듈 제외

          const moduleInfo = {
            key: module.key,
            name: module.name,
            emoji: this.getModuleEmoji(module.key),
            active: module.active && module.initialized,
            priority: module.priority,
          };

          if (moduleInfo.active) {
            activeModules.push(moduleInfo);
          } else {
            inactiveModules.push({
              ...moduleInfo,
              reason: module.initError || "초기화 실패",
            });
          }
        }
      }

      return {
        activeModules: activeModules.sort((a, b) => a.priority - b.priority),
        inactiveModules,
        systemInfo: {
          version: this.config.version,
          environment: this.config.environment,
          uptime: this.getUptime(),
        },
        stats: {
          totalModules: activeModules.length + inactiveModules.length,
          activeModules: activeModules.length,
          failedModules: inactiveModules.length,
        },
      };
    } catch (error) {
      logger.error("❌ 메인 메뉴 데이터 수집 실패:", error);
      return this.getFallbackMenuData();
    }
  }

  /**
   * 📱 모듈 이모지 반환
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      todo: "📝",
      timer: "⏰",
      worktime: "🕐",
      leave: "🏖️",
      reminder: "🔔",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🎤",
    };

    return emojiMap[moduleKey] || "📦";
  }

  /**
   * ❓ 도움말 콘텐츠 구성
   */
  buildHelpContent() {
    return {
      title: "❓ 도움말",
      basicCommands: [
        { command: "/start", description: "봇 시작" },
        { command: "/menu", description: "메인 메뉴" },
        { command: "/help", description: "도움말" },
        { command: "/status", description: "시스템 상태" },
        { command: "/cancel", description: "작업 취소" },
      ],
      mainFeatures: [
        { emoji: "📝", name: "할일 관리", description: "업무 목록 관리" },
        { emoji: "⏰", name: "타이머", description: "집중 시간 측정" },
        { emoji: "🕐", name: "근무시간", description: "출퇴근 기록" },
        { emoji: "🏖️", name: "휴가 관리", description: "연차/월차 관리" },
      ],
      tips: [
        "메뉴 버튼을 통해 편리하게 이용하세요",
        "작업 중 /cancel로 언제든 취소 가능",
        "문제 발생 시 /start로 초기화",
      ],
    };
  }

  /**
   * 📊 시스템 상태 수집
   */
  async collectSystemStatus(moduleManager) {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = this.getUptime();

      return {
        basicInfo: {
          version: this.config.version,
          environment: this.config.environment,
          uptime,
          isRailway: this.config.isRailway,
        },
        performance: {
          memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          totalCallbacks: this.systemStats.totalCallbacks,
          totalMessages: this.systemStats.totalMessages,
          totalErrors: this.systemStats.totalErrors,
        },
        moduleInfo: moduleManager ? moduleManager.getStatus() : null,
        lastActivity: this.systemStats.lastActivity,
      };
    } catch (error) {
      logger.error("❌ 시스템 상태 수집 실패:", error);
      return this.getFallbackStatusInfo();
    }
  }

  /**
   * ⚙️ 현재 설정 정보
   */
  getCurrentSettings() {
    return {
      version: this.config.version,
      environment: this.config.environment,
      isRailway: this.config.isRailway,
      botName: this.config.botName,
      enableDetailedStatus: this.config.enableDetailedStatus,
      memoryWarningThreshold: this.config.memoryWarningThreshold,
    };
  }

  /**
   * ⚙️ 사용 가능한 설정 항목
   */
  getAvailableSettings() {
    return [
      {
        key: "enableDetailedStatus",
        name: "상세 상태 표시",
        type: "boolean",
        current: this.config.enableDetailedStatus,
      },
      {
        key: "memoryWarningThreshold",
        name: "메모리 경고 임계값",
        type: "number",
        unit: "MB",
        current: this.config.memoryWarningThreshold,
      },
    ];
  }

  /**
   * ℹ️ 정보 데이터
   */
  getAboutInfo() {
    return {
      botName: this.config.botName,
      version: this.config.version,
      architecture: "모듈화 설계",
      platform: this.config.isRailway ? "Railway" : "Local",
      runtime: `Node.js ${process.version}`,
      features: [
        "모듈화된 구조로 확장 가능",
        "Railway 환경 최적화",
        "실시간 상태 모니터링",
        "표준화된 매개변수 체계",
      ],
      supportedModules: [
        "할일 관리, 타이머, 근무시간 추적",
        "휴가 관리, 리마인더, 날씨 정보",
        "음성 변환(TTS), 운세",
      ],
      developer: "두목",
    };
  }

  /**
   * 📱 버전 정보
   */
  getVersionInfo() {
    return {
      botVersion: this.config.version,
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      opensslVersion: process.versions.openssl,
      platform: process.platform,
      architecture: process.arch,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      environment: this.config.environment,
      isRailway: this.config.isRailway,
    };
  }

  /**
   * ⏰ 업타임 정보
   */
  getUptimeInfo() {
    return {
      botUptime: this.getUptime(),
      systemUptime: this.formatUptime(process.uptime()),
      startTime: new Date(this.systemStats.startTime),
      activityStats: {
        totalCallbacks: this.systemStats.totalCallbacks,
        totalMessages: this.systemStats.totalMessages,
        systemChecks: this.systemStats.systemChecks,
        lastActivity: this.systemStats.lastActivity,
      },
    };
  }

  /**
   * 📊 시스템 정보
   */
  getSystemInfo() {
    return {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  // ===== 🛡️ 폴백 데이터 메서드들 =====

  /**
   * 🛡️ 폴백 메뉴 데이터
   */
  getFallbackMenuData() {
    return {
      activeModules: [],
      inactiveModules: [
        {
          key: "todo",
          name: "할일 관리",
          emoji: "📝",
          reason: "모듈 로드 실패",
        },
        { key: "timer", name: "타이머", emoji: "⏰", reason: "모듈 로드 실패" },
      ],
      systemInfo: {
        version: this.config.version,
        environment: "오류 상태",
        uptime: "알 수 없음",
      },
      stats: {
        totalModules: 0,
        activeModules: 0,
        failedModules: 2,
      },
    };
  }

  /**
   * 🛡️ 폴백 상태 정보
   */
  getFallbackStatusInfo() {
    return {
      basicInfo: {
        version: this.config.version,
        environment: "오류 상태",
        uptime: "알 수 없음",
        isRailway: this.config.isRailway,
      },
      performance: {
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        totalCallbacks: this.systemStats.totalCallbacks,
        totalMessages: this.systemStats.totalMessages,
        totalErrors: this.systemStats.totalErrors,
      },
      moduleInfo: null,
      lastActivity: this.systemStats.lastActivity,
    };
  }

  /**
   * 📋 사용 가능한 모듈 목록
   */
  getAvailableModules(moduleManager) {
    if (!moduleManager) return [];

    try {
      return moduleManager.getModuleList().map((module) => ({
        key: module.key,
        name: module.name,
        active: module.active,
        emoji: this.getModuleEmoji(module.key),
      }));
    } catch (error) {
      return [];
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 기본 시스템 체크
   */
  async performBasicSystemCheck() {
    try {
      // 메모리 체크
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      if (memoryMB > this.config.memoryWarningThreshold) {
        logger.warn(`⚠️ 메모리 사용량 높음: ${memoryMB}MB`);
      }

      // Railway 환경 체크
      if (this.config.isRailway) {
        logger.info("🚂 Railway 환경에서 실행 중");
      }

      this.systemStats.systemChecks++;
      logger.debug("✅ 기본 시스템 체크 완료");
    } catch (error) {
      logger.warn("⚠️ 시스템 체크 중 오류:", error);
    }
  }

  /**
   * ⏰ 업타임 계산
   */
  getUptime() {
    return this.formatUptime((Date.now() - this.systemStats.startTime) / 1000);
  }

  /**
   * ⏰ 업타임 포맷팅
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
   * 📊 상태 조회 (BaseModule 오버라이드)
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

  // ===== 📬 레거시 메서드들 (호환성 유지) =====

  /**
   * 🏠 메인 메뉴 전송 (명령어용 - 호환성)
   */
  async sendMainMenu(bot, chatId, userName) {
    try {
      // 데이터만 수집하고 실제 전송은 하지 않음
      // NavigationHandler에서 처리하도록 위임
      const menuData = await this.collectMainMenuData(this.moduleManager);

      logger.info(
        "SystemModule: 메인 메뉴 데이터 준비됨 - NavigationHandler로 위임 필요"
      );

      return {
        success: true,
        data: { userName, menuData },
        message: "NavigationHandler로 위임 필요",
      };
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 데이터 준비 실패:", error);
      throw error;
    }
  }
}

module.exports = SystemModule;
