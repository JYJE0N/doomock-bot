// src/modules/SystemModule.js - 표준화된 최종 수정 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const { formatMemoryUsage, formatUptime } = require("../utils/SystemHelper");
const os = require("os");

/**
 * 🖥️ SystemModule - 시스템 관리 모듈
 * - 도움말, 정보, 상태 확인 등 시스템 기본 기능 제공
 * - BaseModule 표준 패턴 준수
 * - 순수 데이터 반환 (UI는 NavigationHandler가 담당)
 */
class SystemModule extends BaseModule {
  /**
   * 🏗️ 생성자 - 표준 매개변수 구조 준수
   */
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 시스템 모듈 특화 설정
    this.systemConfig = {
      showDetailedStatus: true,
      enablePerformanceMonitoring: true,
      maxLogLines: 50,
      ...options.config,
    };

    // 시스템 통계 추적
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      lastActivity: null,
    };

    logger.info("🖥️ SystemModule 생성됨", {
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      config: this.systemConfig,
    });
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // 액션 등록
      this.setupActions();

      // 시스템 모니터링 시작 (필요한 경우)
      if (this.systemConfig.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

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
      // 메인 액션들
      help: this.handleHelpAction,
      about: this.handleAboutAction,
      status: this.handleStatusAction,

      // 상세 기능들
      logs: this.handleLogsAction,
      modules: this.handleModulesAction,
      stats: this.handleStatsAction,

      // 관리 기능들 (필요한 경우)
      restart: this.handleRestartAction,
      health: this.handleHealthAction,
    });
  }

  /**
   * 🔑 모듈 키워드 정의
   */
  getModuleKeywords() {
    return [
      // 한국어 키워드
      "도움말",
      "도움",
      "help",
      "시스템",
      "정보",
      "상태",
      "about",
      "status",
      "시작",
      "메뉴",
      "명령어",
      "사용법",
      "가이드",
    ];
  }

  // ===== 📋 액션 핸들러들 (표준 매개변수 준수) =====

  /**
   * 🆘 도움말 액션
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      logger.info(`SystemModule: 도움말 요청 (사용자: ${userId})`);

      // ✅ 순수 데이터만 반환 (UI는 NavigationHandler가 처리)
      const helpData = {
        type: "system_help",
        userName,
        basicCommands: [
          { command: "/start", description: "봇 시작 및 메인 메뉴" },
          { command: "/help", description: "도움말 표시" },
          { command: "/status", description: "시스템 상태 확인" },
        ],
        features: [
          "📝 할일 관리 - 개인 작업 및 프로젝트 관리",
          "⏰ 타이머 기능 - 포모도로 및 시간 추적",
          "🕐 근무시간 관리 - 출퇴근 시간 기록",
          "🏖️ 휴가 관리 - 연차 및 휴가 계획",
          "💬 리마인더 - 중요한 일정 알림",
          "🔮 운세 - 일일 운세 및 타로",
          "🌤️ 날씨 - 실시간 날씨 정보",
          "🔊 TTS - 텍스트 음성 변환",
        ],
        tips: [
          "메인 메뉴의 버튼을 눌러 각 기능에 접근하세요",
          "각 기능별로 상세한 도움말이 제공됩니다",
          "문제가 있을 때는 /status로 시스템 상태를 확인하세요",
        ],
      };

      return {
        success: true,
        action: "show_help",
        data: helpData,
      };
    } catch (error) {
      logger.error("SystemModule 도움말 처리 실패:", error);
      return { success: false, error: error.message };
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
      const userId = getUserId(callbackQuery.from);
      logger.info(`SystemModule: 정보 요청 (사용자: ${userId})`);

      const aboutData = {
        type: "system_about",
        version: "3.0.1",
        developer: "두몫",
        description: "모듈형 아키텍처로 설계된 다기능 텔레그램 봇",
        features: {
          architecture: "모듈형 설계로 확장성과 유지보수성 확보",
          database: "MongoDB 기반 안정적인 데이터 관리",
          environment: "Railway 클라우드 플랫폼 최적화",
          logging: "통합 로깅 시스템으로 모니터링 강화",
        },
        stats: {
          totalModules: moduleManager ? moduleManager.getModuleCount() : 0,
          uptime: this.getFormattedUptime(),
          platform: os.platform(),
          nodeVersion: process.version,
        },
      };

      return {
        success: true,
        action: "show_about",
        data: aboutData,
      };
    } catch (error) {
      logger.error("SystemModule 정보 처리 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 상태 액션
   */
  async handleStatusAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const userId = getUserId(callbackQuery.from);
      logger.info(`SystemModule: 상태 요청 (사용자: ${userId})`);

      const uptime = this.getFormattedUptime();
      const memory = formatMemoryUsage();

      // 모듈 상태 수집
      const moduleStats = moduleManager
        ? await this.getModuleStats(moduleManager)
        : null;

      const statusData = {
        type: "system_status",
        status: "정상 동작 중",
        uptime: uptime,
        memory: memory,
        platform: {
          os: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          totalMemory: Math.round(os.totalmem() / 1024 / 1024) + "MB",
        },
        modules: moduleStats,
        performance: {
          cpuUsage: process.cpuUsage(),
          memoryUsage: process.memoryUsage(),
          loadAverage: os.loadavg(),
        },
      };

      return {
        success: true,
        action: "show_status",
        data: statusData,
      };
    } catch (error) {
      logger.error("SystemModule 상태 처리 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📋 모듈 정보 액션
   */
  async handleModulesAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const userId = getUserId(callbackQuery.from);
      logger.info(`SystemModule: 모듈 정보 요청 (사용자: ${userId})`);

      if (!moduleManager) {
        return { success: false, error: "모듈 매니저를 사용할 수 없습니다" };
      }

      const modulesList = await this.getDetailedModuleInfo(moduleManager);

      return {
        success: true,
        action: "show_modules",
        data: {
          type: "modules_info",
          modules: modulesList,
          totalCount: modulesList.length,
          activeCount: modulesList.filter((m) => m.isActive).length,
        },
      };
    } catch (error) {
      logger.error("SystemModule 모듈 정보 처리 실패:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 시스템 가동시간 포맷팅
   */
  getFormattedUptime() {
    return formatUptime(process.uptime() * 1000);
  }

  /**
   * 모듈 통계 수집
   */
  async getModuleStats(moduleManager) {
    try {
      const modules = moduleManager.getAllModules();
      const stats = {
        total: modules.size,
        active: 0,
        inactive: 0,
        details: [],
      };

      for (const [key, module] of modules.entries()) {
        const isActive = module.isInitialized;
        if (isActive) stats.active++;
        else stats.inactive++;

        stats.details.push({
          key,
          name: module.moduleName,
          isActive,
          stats: module.getModuleStatus ? module.getModuleStatus() : null,
        });
      }

      return stats;
    } catch (error) {
      logger.error("모듈 통계 수집 실패:", error);
      return null;
    }
  }

  /**
   * 상세 모듈 정보 수집
   */
  async getDetailedModuleInfo(moduleManager) {
    try {
      const modules = moduleManager.getAllModules();
      const modulesList = [];

      for (const [key, module] of modules.entries()) {
        const moduleInfo = {
          key,
          name: module.moduleName,
          isActive: module.isInitialized,
          stats: module.stats || {},
          hasService: !!module.serviceInstance,
          keywords: module.getModuleKeywords ? module.getModuleKeywords() : [],
        };

        modulesList.push(moduleInfo);
      }

      return modulesList.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error("상세 모듈 정보 수집 실패:", error);
      return [];
    }
  }

  /**
   * 성능 모니터링 시작
   */
  startPerformanceMonitoring() {
    if (this.performanceInterval) return;

    this.performanceInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // 메모리 사용량이 임계치를 넘으면 경고
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) {
        // 500MB 이상
        logger.warn(`⚠️ 높은 메모리 사용량: ${Math.round(heapUsedMB)}MB`);
      }
    }, 60000); // 1분마다 체크

    logger.info("📊 성능 모니터링 시작됨");
  }

  /**
   * 🧹 모듈 정리
   */
  async cleanup() {
    try {
      // 성능 모니터링 중지
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
        this.performanceInterval = null;
      }

      // 부모 클래스 정리 호출
      await super.cleanup();

      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
