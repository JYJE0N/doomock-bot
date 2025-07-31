const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");
const os = require("os");

/**
 * 🖥️ SystemModule - 시스템 관리 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: system:action:params
 * ✅ 렌더링은 Renderer가 담당
 *
 * 🎯 책임:
 * - 시스템 상태 모니터링
 * - 도움말 제공
 * - 메인 메뉴 관리
 * - 봇 정보 제공
 */
class SystemModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    // 시스템 모듈 특화 설정
    this.config = {
      showDetailedStatus: process.env.SYSTEM_SHOW_DETAILED !== "false",
      enablePerformanceMonitoring:
        process.env.SYSTEM_ENABLE_MONITORING !== "false",
      maxLogLines: parseInt(process.env.SYSTEM_MAX_LOG_LINES) || 50,
      botVersion: process.env.BOT_VERSION || "4.1.0",
      botName: process.env.BOT_NAME || "두목봇",
      ...options.config,
    };

    // 시스템 통계 추적
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalUsers: new Set(),
      lastActivity: null,
      errors: 0,
    };

    // 시스템 상태
    this.systemStatus = {
      isHealthy: true,
      lastHealthCheck: null,
      uptime: 0,
      memoryUsage: {},
      cpuUsage: 0,
    };

    // 성능 모니터링 인터벌
    this.performanceInterval = null;

    logger.info(`🖥️ SystemModule 생성 완료 (v${this.config.botVersion})`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      // 액션 등록
      this.setupActions();

      // 시스템 모니터링 시작
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      // 첫 번째 헬스 체크
      await this.performHealthCheck();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 메인 액션
      menu: this.showMainMenu,
      help: this.showHelp,
      about: this.showAbout,

      // 시스템 정보
      status: this.showSystemStatus,
      info: this.showSystemInfo,
      health: this.showHealthStatus,

      // 관리 기능
      modules: this.showModuleStatus,
      stats: this.showSystemStats,
      logs: this.showRecentLogs,

      // 유틸리티
      ping: this.handlePing,
      version: this.showVersion,
    });

    logger.info(`✅ SystemModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  isModuleMessage(text, keywords) {
    if (!text || typeof text !== "string") return false;
    if (!keywords || !Array.isArray(keywords)) return false;

    const lowerText = text.trim().toLowerCase();

    return keywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      return (
        lowerText === lowerKeyword ||
        lowerText.startsWith(lowerKeyword + " ") ||
        lowerText.includes(lowerKeyword)
      );
    });
  }

  /**
   * 🔑 모듈 키워드 정의
   */
  getModuleKeywords() {
    return [
      "도움말",
      "도움",
      "help",
      "시스템",
      "system",
      "상태",
      "status",
      "정보",
      "info",
      "about",
      "버전",
      "version",
      "메뉴",
      "menu",
      "시작",
      "핑",
      "ping",
      "헬스",
      "health",
      "통계",
      "stats",
      "로그",
      "logs",
    ];
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 추적
    this.systemStats.totalUsers.add(userId);
    this.systemStats.totalMessages++;
    this.systemStats.lastActivity = Date.now();

    // ✅ 시스템 키워드 확인 (수정됨)
    const keywords = this.getModuleKeywords();

    if (this.isModuleMessage(text, keywords)) {
      // 특정 키워드별 처리
      if (text.includes("도움") || text.includes("help")) {
        return {
          type: "render_request",
          module: "system",
          action: "help",
          chatId: chatId,
          data: await this.getHelpData(userId),
        };
      }

      if (text.includes("상태") || text.includes("status")) {
        return {
          type: "render_request",
          module: "system",
          action: "status",
          chatId: chatId,
          data: await this.getSystemStatusData(),
        };
      }

      // 기본: 메인 메뉴
      return {
        type: "render_request",
        module: "system",
        action: "menu",
        chatId: chatId,
        data: await this.getMainMenuData(userId),
      };
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      // 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.totalUsers.add(userId);
      this.systemStats.lastActivity = Date.now();

      const menuData = await this.getMainMenuData(userId);

      return {
        type: "main_menu",
        module: "system",
        data: {
          ...menuData,
          userName,
        },
      };
    } catch (error) {
      logger.error("메인 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 👤 사용자 이름 가져오기 (안전함)
   */
  async getUserName(userId) {
    try {
      // UserHelper를 사용하거나 기본값 반환
      return "사용자"; // 임시로 기본값 사용
    } catch (error) {
      return "사용자";
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const helpData = await this.getHelpData(userId);

      return {
        type: "help",
        module: "system",
        data: {
          ...helpData,
          userName,
        },
      };
    } catch (error) {
      logger.error("도움말 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "도움말을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ℹ️ 봇 정보 표시
   */
  async showAbout(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userName = getUserName(from);

    return {
      type: "about",
      module: "system",
      data: {
        userName,
        botInfo: this.getBotInfo(),
        systemInfo: await this.getSystemInfo(),
        features: this.getBotFeatures(),
      },
    };
  }

  /**
   * 📊 시스템 상태 표시
   */
  async showSystemStatus(bot, callbackQuery, params, moduleManager) {
    try {
      // 헬스 체크 수행
      await this.performHealthCheck();

      const statusData = await this.getSystemStatusData();

      return {
        type: "status",
        module: "system",
        data: statusData,
      };
    } catch (error) {
      logger.error("시스템 상태 조회 실패:", error);
      return {
        type: "error",
        message: "시스템 상태를 확인할 수 없습니다.",
      };
    }
  }

  /**
   * 💻 시스템 정보 표시
   */
  async showSystemInfo(bot, callbackQuery, params, moduleManager) {
    return {
      type: "system_info",
      module: "system",
      data: await this.getSystemInfo(),
    };
  }

  /**
   * 🏥 헬스 상태 표시
   */
  async showHealthStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const healthData = await this.performHealthCheck();

      return {
        type: "health",
        module: "system",
        data: healthData,
      };
    } catch (error) {
      logger.error("헬스 체크 실패:", error);
      return {
        type: "error",
        message: "헬스 체크에 실패했습니다.",
      };
    }
  }

  /**
   * 📱 모듈 상태 표시
   */
  async showModuleStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const modulesData = this.getModulesStatusData(moduleManager);

      return {
        type: "modules",
        module: "system",
        data: modulesData,
      };
    } catch (error) {
      logger.error("모듈 상태 조회 실패:", error);
      return {
        type: "error",
        message: "모듈 상태를 확인할 수 없습니다.",
      };
    }
  }

  /**
   * 📈 시스템 통계 표시
   */
  async showSystemStats(bot, callbackQuery, params, moduleManager) {
    return {
      type: "stats",
      module: "system",
      data: {
        systemStats: this.getDetailedStats(),
        uptime: this.getUptime(),
        performance: this.getPerformanceStats(),
      },
    };
  }

  /**
   * 📋 최근 로그 표시
   */
  async showRecentLogs(bot, callbackQuery, params, moduleManager) {
    return {
      type: "logs",
      module: "system",
      data: {
        logs: this.getRecentLogs(),
        logLevel: process.env.LOG_LEVEL || "info",
        maxLines: this.config.maxLogLines,
      },
    };
  }

  /**
   * 🏓 핑 처리
   */
  async handlePing(bot, callbackQuery, params, moduleManager) {
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;

    return {
      type: "ping",
      module: "system",
      data: {
        responseTime,
        timestamp: TimeHelper.format(new Date(), "full"),
        status: "pong",
        botStatus: "healthy",
      },
    };
  }

  /**
   * 📋 버전 정보 표시
   */
  async showVersion(bot, callbackQuery, params, moduleManager) {
    return {
      type: "version",
      module: "system",
      data: {
        botVersion: this.config.botVersion,
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        buildDate: this.getBuildDate(),
        environment: process.env.NODE_ENV || "development",
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 📊 시스템 통계 가져오기
   */
  getSystemStats() {
    return {
      uptime: this.getUptime(),
      totalCallbacks: this.systemStats.totalCallbacks,
      totalMessages: this.systemStats.totalMessages,
      totalUsers: this.systemStats.totalUsers.size,
      lastActivity: this.systemStats.lastActivity,
    };
  }

  /**
   * 🏠 메인 메뉴 데이터 조회
   */
  async getMainMenuData(userId) {
    try {
      return {
        userName: await this.getUserName(userId),
        activeModules: await this.getActiveModulesList(),
        systemStats: this.getSystemStats(),
        botInfo: {
          name: this.config.botName,
          version: this.config.botVersion,
          uptime: this.getUptime(),
        },
      };
    } catch (error) {
      logger.error("메인 메뉴 데이터 생성 실패:", error);
      return {
        userName: "사용자",
        activeModules: [],
        systemStats: {},
        botInfo: { name: "두목봇", version: "4.1.0", uptime: "0분" },
      };
    }
  }

  /**
   * 📋 활성 모듈 목록 가져오기
   */
  async getActiveModulesList() {
    try {
      if (!this.moduleManager) {
        return [];
      }

      const moduleList = this.moduleManager.getModuleList();
      return moduleList
        .map((moduleName) => {
          const module = this.moduleManager.getModule(moduleName);
          return {
            key: moduleName.toLowerCase(),
            name: this.getModuleDisplayName(moduleName),
            emoji: this.getModuleEmoji(moduleName),
            showInMenu: true,
          };
        })
        .filter((module) => module.showInMenu);
    } catch (error) {
      logger.error("활성 모듈 목록 조회 실패:", error);
      return [];
    }
  }

  /**
   * 📝 모듈 표시 이름 가져오기
   */
  getModuleDisplayName(moduleName) {
    const nameMap = {
      system: "시스템",
      todo: "할일 관리",
      timer: "타이머",
      worktime: "근무시간",
      leave: "휴가 관리",
      fortune: "운세",
      weather: "날씨",
      tts: "음성 변환",
    };

    const key = moduleName.toLowerCase().replace("module", "");
    return nameMap[key] || moduleName;
  }

  /**
   * 🎨 모듈 이모지 가져오기
   */
  getModuleEmoji(moduleName) {
    const emojiMap = {
      system: "🖥️",
      todo: "📋",
      timer: "⏰",
      worktime: "🏢",
      leave: "🏖️",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🔊",
    };

    const key = moduleName.toLowerCase().replace("module", "");
    return emojiMap[key] || "📱";
  }

  /**
   * ❓ 도움말 데이터 조회
   */
  async getHelpData(userId) {
    return {
      userName: await this.getUserName(userId),
      commands: [
        { command: "/start", description: "봇 시작 및 메인 메뉴" },
        { command: "/help", description: "도움말 표시" },
        { command: "/status", description: "시스템 상태 확인" },
      ],
      features: [
        "📝 할일 관리 - 작업 등록, 수정, 완료 처리",
        "⏰ 타이머 - 포모도로 타이머와 일반 타이머",
        "🏢 근무시간 - 출퇴근 시간 관리",
        "🏖️ 휴가 관리 - 연차, 병가 등 휴가 신청",
      ],
    };
  }

  /**
   * 📊 시스템 상태 데이터 조회
   */
  async getSystemStatusData() {
    const memoryUsage = process.memoryUsage();

    return {
      status: this.systemStatus.isHealthy ? "healthy" : "unhealthy",
      uptime: this.getUptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      lastHealthCheck: this.systemStatus.lastHealthCheck,
      moduleCount: this.moduleManager
        ? this.moduleManager.getModuleList().length
        : 0,
    };
  }

  /**
   * 💻 시스템 정보 조회
   */
  async getSystemInfo() {
    return {
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
      },
      runtime: {
        node: process.version,
        pid: process.pid,
        uptime: process.uptime(),
      },
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
    };
  }

  /**
   * 🤖 봇 정보 가져오기
   */
  getBotInfo() {
    return {
      name: this.config.botName,
      version: this.config.botVersion,
      description: "업무 효율성을 높여주는 다기능 텔레그램 봇",
      developer: "두목",
      environment: process.env.NODE_ENV || "development",
      startTime: this.systemStats.startTime,
    };
  }

  /**
   * 🎯 봇 기능 목록
   */
  getBotFeatures() {
    return [
      { icon: "📝", name: "할일 관리", description: "체계적인 업무 관리" },
      { icon: "⏰", name: "타이머", description: "포모도로 기법" },
      { icon: "🏢", name: "근무시간", description: "출퇴근 관리" },
      { icon: "🏖️", name: "연차 관리", description: "휴가 계획" },
      { icon: "🔮", name: "운세", description: "오늘의 운세" },
      { icon: "🌤️", name: "날씨", description: "실시간 날씨 정보" },
      { icon: "🔊", name: "음성변환", description: "TTS 서비스" },
      { icon: "🖥️", name: "시스템 관리", description: "봇 상태 관리" },
    ];
  }

  /**
   * 📱 사용 가능한 모듈 목록
   */
  getAvailableModules() {
    if (this.moduleManager) {
      const moduleStatus = this.moduleManager.getModuleStatus();
      return Object.keys(moduleStatus.modules).map((key) => ({
        key,
        name: moduleStatus.modules[key].name || key,
        status: moduleStatus.modules[key].status,
      }));
    }
    return [];
  }

  /**
   * ⚡ 빠른 액션 목록
   */
  getQuickActions() {
    return [
      { icon: "❓", text: "도움말", callback: "system:help" },
      { icon: "📊", text: "상태", callback: "system:status" },
      { icon: "ℹ️", text: "정보", callback: "system:about" },
      { icon: "🏓", text: "핑", callback: "system:ping" },
    ];
  }

  /**
   * 📋 사용 가능한 명령어 목록
   */
  getAvailableCommands() {
    return [
      { command: "/start", description: "봇 시작" },
      { command: "/help", description: "도움말 보기" },
      { command: "/status", description: "시스템 상태" },
      { command: "/menu", description: "메인 메뉴" },
    ];
  }

  /**
   * 💡 사용 팁
   */
  getUsageTips() {
    return [
      "버튼을 클릭하여 쉽게 기능을 사용할 수 있습니다",
      "명령어는 /로 시작합니다",
      "문제가 있으면 /help를 사용해보세요",
      "각 모듈마다 고유한 기능이 있습니다",
    ];
  }

  /**
   * 🆘 지원 정보
   */
  getSupportInfo() {
    return {
      developer: "두몫",
      version: this.config.botVersion,
      lastUpdate: this.getBuildDate(),
      documentation: "사용법은 도움말을 참조하세요",
    };
  }

  /**
   * 👤 사용자 통계 조회
   */
  getUserStats(userId) {
    return {
      isNewUser: !this.systemStats.totalUsers.has(userId),
      totalUsers: this.systemStats.totalUsers.size,
      lastActivity: this.systemStats.lastActivity,
    };
  }

  /**
   * 📈 상세 통계 조회
   */
  getDetailedStats() {
    return {
      ...this.systemStats,
      totalUsers: this.systemStats.totalUsers.size,
      uptimeSeconds: Math.floor(
        (Date.now() - this.systemStats.startTime) / 1000
      ),
      averageResponseTime: this.getAverageResponseTime(),
    };
  }

  /**
   * 🏥 헬스 체크 수행
   */
  async performHealthCheck() {
    const startTime = Date.now();

    try {
      // 기본 시스템 체크
      const memoryUsage = process.memoryUsage();
      const cpuLoad = os.loadavg()[0];
      const freeMemory = os.freemem();

      // 헬스 상태 판단
      const isHealthy =
        memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9 &&
        cpuLoad < 2.0 &&
        freeMemory > 100 * 1024 * 1024; // 100MB 이상

      const healthData = {
        isHealthy,
        checkTime: Date.now(),
        responseTime: Date.now() - startTime,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
          ),
        },
        cpu: {
          load: cpuLoad,
          cores: os.cpus().length,
        },
        uptime: this.getUptime(),
      };

      // 상태 업데이트
      this.systemStatus.isHealthy = isHealthy;
      this.systemStatus.lastHealthCheck = Date.now();

      return healthData;
    } catch (error) {
      logger.error("헬스 체크 실패:", error);
      this.systemStatus.isHealthy = false;
      this.systemStatus.lastHealthCheck = Date.now();

      return {
        isHealthy: false,
        checkTime: Date.now(),
        error: error.message,
      };
    }
  }

  /**
   * 📊 성능 모니터링 시작
   */
  startPerformanceMonitoring() {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }

    this.performanceInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = os.loadavg()[0];

      // 메모리 사용량이 90% 이상이면 경고
      if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
        logger.warn("⚠️ 높은 메모리 사용량 감지:", {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
          ),
        });
      }

      // CPU 사용량이 높으면 경고
      if (cpuUsage > 2.0) {
        logger.warn("⚠️ 높은 CPU 사용량 감지:", cpuUsage);
      }
    }, 60000); // 1분마다 체크

    logger.info("📊 성능 모니터링 시작됨");
  }

  /**
   * 📊 성능 통계 조회
   */
  getPerformanceStats() {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        heap: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      cpu: os.loadavg(),
      uptime: process.uptime(),
    };
  }

  /**
   * 📱 모듈 상태 데이터 조회
   */
  getModulesStatusData(moduleManager) {
    if (!moduleManager) {
      return {
        total: 0,
        active: 0,
        modules: {},
      };
    }

    const moduleStatus = moduleManager.getModuleStatus();
    return {
      total: moduleStatus.loadedModules,
      active: moduleStatus.activeModules,
      modules: moduleStatus.modules,
    };
  }

  /**
   * 📋 최근 로그 조회
   */
  getRecentLogs() {
    // 실제 구현에서는 로그 파일이나 메모리 로그를 읽어옵니다
    return [
      {
        level: "info",
        message: "SystemModule 초기화 완료",
        timestamp: new Date(),
      },
      { level: "info", message: "성능 모니터링 시작됨", timestamp: new Date() },
    ];
  }

  /**
   * ⏱️ 업타임 계산
   */
  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const minutes = Math.floor(uptimeMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 📅 빌드 날짜 조회
   */
  getBuildDate() {
    // 실제 구현에서는 빌드 시점의 날짜를 반환
    return TimeHelper.format(new Date(), "full");
  }

  /**
   * ⚡ 평균 응답 시간 계산
   */
  getAverageResponseTime() {
    // 실제 구현에서는 응답 시간 통계를 계산
    return Math.random() * 100 + 50; // 임시 값
  }

  /**
   * 📊 모듈 상태 반환
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      isHealthy: this.systemStatus.isHealthy,
      totalCallbacks: this.systemStats.totalCallbacks,
      totalMessages: this.systemStats.totalMessages,
      totalUsers: this.systemStats.totalUsers.size,
      lastActivity: this.systemStats.lastActivity,
      uptime: this.getUptime(),
      configKeys: Object.keys(this.config),
    };
  }

  /**
   * 🧹 정리 작업
   */
  async onCleanup() {
    try {
      // 성능 모니터링 중지
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
        this.performanceInterval = null;
      }

      // 통계 초기화
      this.systemStats.totalUsers.clear();
      this.userStates.clear();

      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
