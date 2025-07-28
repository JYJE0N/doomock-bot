// src/modules/SystemModule.js - 시스템 모듈 (특별 모듈)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger"); // LoggerEnhancer 적용
const { getUserName, getUserId } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏛️ SystemModule - 시스템 관리 특별 모듈
 * - 메인 메뉴, 뒤로가기, 도움말 등 핵심 기능
 * - NavigationHandler와 긴밀히 협력
 * - 다른 모듈들과 다른 특별한 역할
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // 시스템 통계 (메모리 저장)
    this.systemStats = {
      startTime: TimeHelper.now(),
      totalRequests: 0,
      totalErrors: 0,
      lastActivity: null,
      uptime: "0분",
    };

    // 시스템 정보
    this.systemInfo = {
      version: "3.0.1",
      developer: "DoomockBro",
      features: [
        "📝 할일 관리",
        "⏰ 집중 타이머",
        "🏢 근무시간 관리",
        "🏖️ 연차 계산기",
        "🔔 리마인더",
        "🔮 운세",
        "🌤️ 날씨",
        "🔊 TTS",
      ],
    };

    logger.module("SystemModule", "특별 모듈 생성", { version: "3.0.1" });
  }

  /**
   * 🎯 모듈 초기화 (시스템 체크 포함)
   */
  async onInitialize() {
    try {
      logger.module("SystemModule", "시스템 체크 시작");

      // 시스템 헬스 체크
      await this.performSystemHealthCheck();

      // 통계 업데이트 스케줄러
      this.startStatsUpdateScheduler();

      logger.success("SystemModule 초기화 완료");
    } catch (error) {
      logger.error("SystemModule 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (시스템 전용)
   */
  setupActions() {
    this.registerActions({
      // 핵심 시스템 액션
      menu: this.showMainMenu,
      help: this.showHelp,
      status: this.showStatus,
      about: this.showAbout,

      // 관리 액션
      settings: this.showSettings,
      stats: this.showDetailedStats,
      health: this.showHealthCheck,
    });

    logger.module("SystemModule", "시스템 액션 등록 완료", {
      count: this.actionMap.size,
    });
  }

  /**
   * 🎯 메시지 처리 (시스템 명령어)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    // 시스템 명령어 처리
    const command = this.extractCommand(text);
    if (command === "start" || command === "menu" || text === "/start") {
      // NavigationHandler에게 메인 메뉴 요청
      await this.moduleManager.navigationHandler.sendMainMenu(bot, chatId);
      return true;
    }

    if (command === "help" || text === "/help") {
      await this.moduleManager.navigationHandler.sendSystemHelp(bot, chatId);
      return true;
    }

    if (command === "status" || text === "/status") {
      await this.moduleManager.navigationHandler.sendSystemStatus(bot, chatId);
      return true;
    }

    return false;
  }

  // ===== 🏛️ 시스템 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 🏠 메인 메뉴 데이터 제공
   */
  async showMainMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`SystemModule: menu 호출 (사용자: ${userId})`);

    try {
      // 활성 모듈 목록 조회
      const activeModules = await this.getActiveModules();

      // 통계 업데이트
      this.updateSystemStats();

      // NavigationHandler에게 데이터 전달
      return {
        type: "main_menu",
        module: "system",
        data: {
          userName,
          systemInfo: this.systemInfo,
          systemStats: this.systemStats,
          activeModules,
        },
      };
    } catch (error) {
      logger.error("메인 메뉴 데이터 조회 실패", error);
      return { type: "error", message: "메인 메뉴를 불러올 수 없습니다." };
    }
  }

  /**
   * ❓ 도움말 데이터 제공
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("system", "help");

    return {
      type: "help",
      module: "system",
      data: {
        title: "두목봇 도움말",
        version: this.systemInfo.version,
        developer: this.systemInfo.developer,
        features: this.systemInfo.features,
        commands: [
          "/start - 메인 메뉴",
          "/help - 도움말",
          "/status - 시스템 상태",
        ],
        tips: [
          "각 기능의 아이콘을 탭하면 상세 메뉴가 나타납니다",
          "언제든 '메인 메뉴'로 돌아올 수 있습니다",
          "문제가 있으면 /start 명령어를 사용하세요",
        ],
      },
    };
  }

  /**
   * 📊 시스템 상태 데이터 제공
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("system", "status");

    try {
      // 헬스 체크 실행
      const healthCheck = await this.performSystemHealthCheck();

      // 모듈 상태 조회
      const moduleStats = await this.getModuleStats();

      // 통계 업데이트
      this.updateSystemStats();

      return {
        type: "status",
        module: "system",
        data: {
          systemStats: this.systemStats,
          healthCheck,
          moduleStats,
          uptime: this.calculateUptime(),
        },
      };
    } catch (error) {
      logger.error("시스템 상태 조회 실패", error);
      return { type: "error", message: "시스템 상태를 불러올 수 없습니다." };
    }
  }

  /**
   * ℹ️ 정보 데이터 제공
   */
  async showAbout(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("system", "about");

    return {
      type: "about",
      module: "system",
      data: {
        ...this.systemInfo,
        techStack: [
          "Node.js 18+",
          "MongoDB 네이티브",
          "Telegram Bot API",
          "Railway 호스팅",
        ],
        updateHistory: [
          "v3.0.1 - 표준화 완료",
          "v3.0.0 - 전체 리팩토링",
          "v2.0.0 - 데이터베이스 추가",
        ],
      },
    };
  }

  /**
   * ⚙️ 설정 데이터 제공
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("system", "settings", userId);

    try {
      // 사용자별 설정 조회 (추후 구현)
      const userSettings = {
        timezone: "Asia/Seoul",
        language: "ko",
        notifications: true,
        theme: "default",
      };

      return {
        type: "settings",
        module: "system",
        data: {
          userSettings,
          availableOptions: {
            timezones: ["Asia/Seoul", "UTC"],
            languages: ["ko", "en"],
            themes: ["default", "dark"],
          },
        },
      };
    } catch (error) {
      logger.error("설정 조회 실패", error);
      return { type: "error", message: "설정을 불러올 수 없습니다." };
    }
  }

  /**
   * 📈 상세 통계 데이터 제공
   */
  async showDetailedStats(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    logger.info("system", "stats");

    try {
      const moduleUsage = await this.getModuleUsageStats();
      const performanceStats = await this.getPerformanceStats();

      return {
        type: "detailed_stats",
        module: "system",
        data: {
          systemStats: this.systemStats,
          moduleUsage,
          performanceStats,
          memoryUsage: process.memoryUsage(),
        },
      };
    } catch (error) {
      logger.error("상세 통계 조회 실패", error);
      return { type: "error", message: "통계를 불러올 수 없습니다." };
    }
  }

  /**
   * 🏥 헬스 체크 데이터 제공
   */
  async showHealthCheck(bot, callbackQuery, subAction, params, moduleManager) {
    logger.info("system", "health");

    try {
      const healthCheck = await this.performSystemHealthCheck();

      return {
        type: "health",
        module: "system",
        data: { healthCheck },
      };
    } catch (error) {
      logger.error("헬스 체크 실패", error);
      return { type: "error", message: "헬스 체크에 실패했습니다." };
    }
  }

  // ===== 🔧 시스템 유틸리티 메서드들 =====

  /**
   * 🔍 시스템 헬스 체크 (수정된 버전)
   */
  async performSystemHealthCheck() {
    try {
      const checks = {
        database: false,
        modules: false,
        memory: false,
        uptime: false,
      };

      // 1. 데이터베이스 체크
      if (this.moduleManager?.db) {
        try {
          await this.moduleManager.db.admin().ping();
          checks.database = true;
        } catch (e) {
          logger.warn("DB 헬스 체크 실패");
        }
      }

      // 2. 모듈 체크 - 초기화 중에는 건너뛰기
      if (this.moduleManager?.getModuleCount) {
        const moduleCount = this.moduleManager.getModuleCount();
        checks.modules = moduleCount > 0;
        logger.debug(`등록된 모듈: ${moduleCount}개`);
      } else {
        // 초기화 중이므로 모듈 체크 건너뛰기
        checks.modules = true;
        logger.debug("모듈 체크 건너뜀 (초기화 중)");
      }

      // 3. 메모리 체크
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      checks.memory = heapUsedMB < 500; // 500MB 미만

      // 4. 업타임 체크
      const uptimeSeconds = process.uptime();
      checks.uptime = uptimeSeconds > 0;

      // 결과 로깅
      const healthStatus = Object.values(checks).every((v) => v)
        ? "정상"
        : "경고";

      logger.module("SystemModule", `헬스 체크 완료: ${healthStatus}`, {
        database: checks.database ? "✅" : "❌",
        modules: checks.modules ? "✅" : "❌",
        memory: `${heapUsedMB}MB`,
        uptime: `${Math.round(uptimeSeconds)}초`,
      });

      return checks;
    } catch (error) {
      logger.error("헬스 체크 실패", error);
      return {
        database: false,
        modules: false,
        memory: false,
        uptime: false,
      };
    }
  }

  /**
   * 활성 모듈 목록 조회
   */
  async getActiveModules() {
    try {
      if (!this.moduleManager) {
        return [];
      }

      const modules = this.moduleManager.getActiveModules();
      return modules
        .filter((module) => module.key !== "system") // 시스템 모듈 제외
        .map((module) => ({
          key: module.key,
          name: module.name,
          emoji: module.emoji || "📌",
          description: module.description,
          status: "active",
        }));
    } catch (error) {
      logger.error("활성 모듈 조회 실패", error);
      return [];
    }
  }

  /**
   * 모듈 통계 조회
   */
  async getModuleStats() {
    try {
      if (!this.moduleManager) {
        return { totalModules: 0, activeModules: 0, failedModules: 0 };
      }

      const stats = this.moduleManager.getModuleStats();
      return stats;
    } catch (error) {
      logger.error("모듈 통계 조회 실패", error);
      return { totalModules: 0, activeModules: 0, failedModules: 0 };
    }
  }

  /**
   * 모듈 사용 통계
   */
  async getModuleUsageStats() {
    try {
      // Logger에서 모듈 사용 통계 가져오기
      const usage = logger.getModuleUsageStats
        ? logger.getModuleUsageStats()
        : {};
      return usage;
    } catch (error) {
      logger.error("모듈 사용 통계 조회 실패", error);
      return {};
    }
  }

  /**
   * 성능 통계
   */
  async getPerformanceStats() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: Math.round(process.uptime()),
      };
    } catch (error) {
      logger.error("성능 통계 조회 실패", error);
      return {};
    }
  }

  /**
   * 시스템 통계 업데이트
   */
  updateSystemStats() {
    this.systemStats.totalRequests++;
    this.systemStats.lastActivity = TimeHelper.now();
    this.systemStats.uptime = this.calculateUptime();
  }

  /**
   * 가동시간 계산
   */
  calculateUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 통계 업데이트 스케줄러
   */
  startStatsUpdateScheduler() {
    // 1분마다 통계 업데이트
    setInterval(() => {
      this.systemStats.uptime = this.calculateUptime();
    }, 60000);
  }

  /**
   * 정리 작업
   */
  async onCleanup() {
    try {
      logger.module("SystemModule", "시스템 모듈 정리 시작");

      // 통계 로그 출력
      logger.system("시스템 통계", this.systemStats);

      logger.success("SystemModule 정리 완료");
    } catch (error) {
      logger.error("SystemModule 정리 오류", error);
    }
  }
}

module.exports = SystemModule;
