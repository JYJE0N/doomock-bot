// ========================================
// 📋 src/config/ModuleRegistry.js v3.0.1
// ========================================
// 알록달록 LoggerEnhancer 통합 + 표준 모듈 관리
// ========================================

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 ModuleRegistry v3.0.1 - 알록달록 모듈 관리
 *
 * ✨ 주요 개선사항:
 * - 🌈 LoggerEnhancer 알록달록 로그
 * - 📱 동적 모듈 활성화/비활성화
 * - 🎯 우선순위 기반 로딩
 * - 🔧 환경변수 기반 설정
 * - 📊 모듈 상태 실시간 모니터링
 */

// 🌈 LoggerEnhancer 활용을 위한 참조
const messageSystem = logger.messageSystem;

/**
 * 📦 모듈 정의 (v3.0.1 표준)
 */
const MODULES = [
  // ===== 🏛️ 시스템 모듈 (최우선) =====
  {
    key: "system",
    name: "시스템 관리",
    description: "시스템 관리 및 설정",
    path: "./src/modules/SystemModule",
    priority: 1,
    required: true,
    enabled: true,
    enhanced: true,
    config: {
      icon: "🏛️",
      showInMenu: false,
      version: "3.0.1",
      commands: [],
      features: {
        dashboard: true,
        monitoring: true,
        logs: true,
      },
    },
  },

  // ===== 📝 할일 관리 (Enhanced) =====
  {
    key: "todo",
    name: "할일 관리",
    description: "Enhanced 할일 관리 시스템",
    path: "./src/modules/TodoModule",
    priority: 10,
    required: false,
    enabled: process.env.MODULE_TODO_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "📝",
      commands: ["/todo", "/할일"],
      showInMenu: true,
      maxItemsPerUser: 100,
      version: "3.0.1",
      features: {
        priority: true,
        deadline: true,
        categories: true,
        statistics: true,
        rainbow: true, // 🌈 알록달록 모드!
      },
    },
  },

  // ===== ⏰ 타이머 (Enhanced) =====
  {
    key: "timer",
    name: "타이머",
    description: "Enhanced 타이머 & 포모도로 시스템",
    path: "./src/modules/TimerModule",
    priority: 20,
    required: false,
    enabled: process.env.MODULE_TIMER_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "⏰",
      commands: ["/timer", "/타이머", "/pomodoro"],
      showInMenu: true,
      defaultDuration: 25,
      version: "3.0.1",
      features: {
        pomodoro: true,
        customTimers: true,
        notifications: true,
        statistics: true,
        rainbow: true, // 🌈 알록달록 애니메이션!
      },
    },
  },

  // ===== 🏢 근무시간 (Enhanced) =====
  {
    key: "worktime",
    name: "근무시간",
    description: "Enhanced 출퇴근 및 근무시간 관리",
    path: "./src/modules/WorktimeModule",
    priority: 30,
    required: false,
    enabled: process.env.MODULE_WORKTIME_ENABLED !== "false",
    enhanced: true,
    config: {
      icon: "🏢",
      commands: ["/work", "/출근", "/퇴근"],
      showInMenu: true,
      workStartTime: "09:00",
      workEndTime: "18:00",
      version: "3.0.1",
      features: {
        autoCheckIn: true,
        overtime: true,
        analytics: true,
        reports: true,
        rainbow: true, // 🌈 알록달록 통계!
      },
    },
  },

  // ===== 🏖️ 휴가 관리 =====
  {
    key: "leave",
    name: "휴가 관리",
    description: "휴가 신청 및 관리",
    path: "./src/modules/LeaveModule",
    priority: 40,
    required: false,
    enabled: process.env.MODULE_LEAVE_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🏖️",
      commands: ["/leave", "/휴가"],
      showInMenu: true,
      annualLeaveDays: 15,
      version: "2.0.0",
      features: {
        approval: true,
        calendar: true,
      },
    },
  },

  // ===== 🔔 리마인더 =====
  {
    key: "reminder",
    name: "리마인더",
    description: "알림 설정 및 관리",
    path: "./src/modules/ReminderModule",
    priority: 50,
    required: false,
    enabled: process.env.MODULE_REMINDER_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔔",
      commands: ["/remind", "/알림"],
      showInMenu: true,
      maxRemindersPerUser: 20,
      version: "2.0.0",
      features: {
        recurring: true,
        snooze: true,
      },
    },
  },

  // ===== 🔮 운세 =====
  {
    key: "fortune",
    name: "운세",
    description: "오늘의 운세 확인",
    path: "./src/modules/FortuneModule",
    priority: 60,
    required: false,
    enabled: process.env.MODULE_FORTUNE_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔮",
      commands: ["/fortune", "/운세"],
      showInMenu: true,
      updateInterval: 86400000,
      version: "2.0.0",
      features: {
        daily: true,
        zodiac: true,
      },
    },
  },

  // ===== 🌤️ 날씨 =====
  {
    key: "weather",
    name: "날씨",
    description: "날씨 정보 제공",
    path: "./src/modules/WeatherModule",
    priority: 70,
    required: false,
    enabled: process.env.MODULE_WEATHER_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🌤️",
      commands: ["/weather", "/날씨"],
      showInMenu: true,
      apiRequired: true,
      defaultLocation: "Seoul",
      version: "2.0.0",
      features: {
        forecast: true,
        alerts: true,
      },
    },
  },

  // ===== 🔊 음성 변환 =====
  {
    key: "tts",
    name: "음성 변환",
    description: "텍스트를 음성으로 변환",
    path: "./src/modules/TTSModule",
    priority: 80,
    required: false,
    enabled: process.env.MODULE_TTS_ENABLED !== "false",
    enhanced: false,
    config: {
      icon: "🔊",
      commands: ["/tts", "/음성"],
      showInMenu: true,
      defaultLanguage: "ko-KR",
      maxLength: 200,
      version: "2.0.0",
      features: {
        multiLanguage: true,
        voiceSelection: true,
      },
    },
  },
];

/**
 * 📊 레지스트리 설정
 */
const REGISTRY_SETTINGS = {
  version: "3.0.1",
  description: "두목봇 v3.0.1 알록달록 모듈 레지스트리",
  autoRegister: true,
  loadOrder: "priority",
  errorHandling: "continue",
  logLevel: "info",
  enhanced: true,
  rainbow: true, // 🌈 알록달록 모드!
  features: {
    dynamicLoading: true,
    hotReload: false,
    monitoring: true,
    statistics: true,
  },
};

/**
 * 📦 ModuleRegistry 클래스
 */
class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.loadedModules = new Set();
    this.failedModules = new Set();
    this.stats = {
      totalModules: 0,
      enabledModules: 0,
      enhancedModules: 0,
      loadedModules: 0,
      failedModules: 0,
      lastUpdate: null,
    };

    // 🌈 초기화 로그
    console.log(
      messageSystem.rainbow("📋 ═══ ModuleRegistry v3.0.1 초기화 ═══")
    );
    console.log(
      messageSystem.gradient("알록달록 모듈 시스템 시작!", "cyan", "magenta")
    );

    this.initialize();
  }

  /**
   * 🎯 초기화
   */
  initialize() {
    console.log(
      messageSystem.gradient("📦 모듈 정보 로딩...", "blue", "purple")
    );

    // 모듈 정보 로드
    MODULES.forEach((moduleConfig) => {
      this.modules.set(moduleConfig.key, moduleConfig);

      if (moduleConfig.enabled) {
        this.stats.enabledModules++;
      }

      if (moduleConfig.enhanced) {
        this.stats.enhancedModules++;
      }
    });

    this.stats.totalModules = MODULES.length;
    this.stats.lastUpdate = TimeHelper.getLogTimeString();

    // 🎉 초기화 완료 로그
    console.log(messageSystem.rainbow("✅ ModuleRegistry 초기화 완료!"));
    this.showRegistryStats();
  }

  /**
   * 📊 레지스트리 통계 표시
   */
  showRegistryStats() {
    console.log(messageSystem.rainbow("📊 ═══ 모듈 레지스트리 통계 ═══"));
    console.log(
      messageSystem.gradient(
        `📦 총 모듈: ${this.stats.totalModules}개`,
        "blue",
        "cyan"
      )
    );
    console.log(
      messageSystem.gradient(
        `✅ 활성화: ${this.stats.enabledModules}개`,
        "green",
        "blue"
      )
    );
    console.log(
      messageSystem.gradient(
        `⭐ Enhanced: ${this.stats.enhancedModules}개`,
        "yellow",
        "orange"
      )
    );
    console.log(
      messageSystem.gradient(
        `🌈 Rainbow 지원: ${this.getEnhancedModuleNames().length}개`,
        "purple",
        "pink"
      )
    );
    console.log(
      messageSystem.gradient(
        `⏰ 업데이트: ${this.stats.lastUpdate}`,
        "gray",
        "white"
      )
    );
    console.log(messageSystem.rainbow("📊 ═══════════════════════"));
  }

  /**
   * 🌈 Enhanced 모듈 이름 목록
   */
  getEnhancedModuleNames() {
    return Array.from(this.modules.values())
      .filter((m) => m.enhanced && m.config.features?.rainbow)
      .map((m) => m.name);
  }

  /**
   * 📋 활성화된 모듈 목록 반환
   */
  getEnabledModules() {
    const enabledModules = Array.from(this.modules.values())
      .filter((module) => module.enabled)
      .sort((a, b) => a.priority - b.priority);

    // 🌈 로그
    console.log(
      messageSystem.gradient(
        `📋 활성화된 모듈 ${enabledModules.length}개 반환`,
        "green",
        "blue"
      )
    );

    return enabledModules;
  }

  /**
   * 🎯 특정 모듈 정보 조회
   */
  getModule(moduleKey) {
    const module = this.modules.get(moduleKey);

    if (module) {
      console.log(
        messageSystem.gradient(`📦 모듈 조회: ${module.name}`, "cyan", "blue")
      );
    } else {
      console.log(
        messageSystem.gradient(`❌ 모듈 없음: ${moduleKey}`, "red", "orange")
      );
    }

    return module;
  }

  /**
   * ⭐ Enhanced 모듈 목록 반환
   */
  getEnhancedModules() {
    const enhanced = Array.from(this.modules.values())
      .filter((module) => module.enabled && module.enhanced)
      .sort((a, b) => a.priority - b.priority);

    console.log(
      messageSystem.rainbow(`⭐ Enhanced 모듈 ${enhanced.length}개 반환`)
    );

    return enhanced;
  }

  /**
   * 📱 메뉴에 표시할 모듈 목록
   */
  getMenuModules() {
    const menuModules = Array.from(this.modules.values())
      .filter(
        (module) =>
          module.enabled &&
          module.config.showInMenu !== false &&
          !module.config.hidden
      )
      .sort((a, b) => a.priority - b.priority);

    console.log(
      messageSystem.gradient(
        `📱 메뉴 모듈 ${menuModules.length}개 반환`,
        "purple",
        "pink"
      )
    );

    return menuModules;
  }

  /**
   * 🔍 모듈 검색 (키워드)
   */
  searchModules(keyword) {
    const searchResults = Array.from(this.modules.values()).filter(
      (module) =>
        module.name.includes(keyword) ||
        module.description.includes(keyword) ||
        module.config.commands?.some((cmd) => cmd.includes(keyword))
    );

    console.log(
      messageSystem.gradient(
        `🔍 검색 결과: "${keyword}" → ${searchResults.length}개`,
        "yellow",
        "orange"
      )
    );

    return searchResults;
  }

  /**
   * 🎛️ 모듈 활성화/비활성화
   */
  toggleModule(moduleKey, enabled) {
    const module = this.modules.get(moduleKey);

    if (!module) {
      console.log(
        messageSystem.gradient(`❌ 모듈 없음: ${moduleKey}`, "red", "orange")
      );
      return false;
    }

    if (module.required && !enabled) {
      console.log(
        messageSystem.gradient(
          `⚠️ 필수 모듈은 비활성화할 수 없음: ${moduleKey}`,
          "yellow",
          "red"
        )
      );
      return false;
    }

    const oldStatus = module.enabled;
    module.enabled = enabled;

    // 통계 업데이트
    if (enabled && !oldStatus) {
      this.stats.enabledModules++;
    } else if (!enabled && oldStatus) {
      this.stats.enabledModules--;
    }

    const status = enabled ? "활성화" : "비활성화";
    const emoji = enabled ? "✅" : "❌";

    console.log(
      messageSystem.gradient(
        `${emoji} 모듈 ${status}: ${module.name}`,
        enabled ? "green" : "red",
        enabled ? "blue" : "orange"
      )
    );

    return true;
  }

  /**
   * 📊 모듈 상태 정보
   */
  getModuleStatus(moduleKey) {
    const module = this.modules.get(moduleKey);

    if (!module) return null;

    return {
      key: module.key,
      name: module.name,
      enabled: module.enabled,
      enhanced: module.enhanced,
      required: module.required,
      priority: module.priority,
      version: module.config.version,
      features: module.config.features,
      commands: module.config.commands,
      loaded: this.loadedModules.has(moduleKey),
      failed: this.failedModules.has(moduleKey),
    };
  }

  /**
   * 📈 전체 통계 정보
   */
  getStats() {
    return {
      ...this.stats,
      loadedModules: this.loadedModules.size,
      failedModules: this.failedModules.size,
      successRate:
        this.stats.totalModules > 0
          ? Math.round(
              (this.loadedModules.size / this.stats.totalModules) * 100
            )
          : 0,
    };
  }

  /**
   * 🔄 모듈 로드 상태 업데이트
   */
  markModuleLoaded(moduleKey, success = true) {
    if (success) {
      this.loadedModules.add(moduleKey);
      this.failedModules.delete(moduleKey);
      console.log(
        messageSystem.gradient(
          `✅ 모듈 로드 성공: ${moduleKey}`,
          "green",
          "blue"
        )
      );
    } else {
      this.failedModules.add(moduleKey);
      this.loadedModules.delete(moduleKey);
      console.log(
        messageSystem.gradient(
          `❌ 모듈 로드 실패: ${moduleKey}`,
          "red",
          "orange"
        )
      );
    }

    this.stats.lastUpdate = TimeHelper.getLogTimeString();
  }

  /**
   * 🎨 알록달록 모듈 목록 표시
   */
  showRainbowModuleList() {
    console.log(messageSystem.rainbow("🌈 ═══ 알록달록 모듈 목록 ═══"));

    const enhancedModules = this.getEnhancedModules();
    enhancedModules.forEach((module, index) => {
      const colors = ["cyan", "magenta", "yellow", "green", "blue", "purple"];
      const color1 = colors[index % colors.length];
      const color2 = colors[(index + 1) % colors.length];

      console.log(
        messageSystem.gradient(
          `${module.config.icon} ${module.name} (v${module.config.version})`,
          color1,
          color2
        )
      );
    });

    console.log(messageSystem.rainbow("🌈 ══════════════════════"));
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    console.log(
      messageSystem.gradient("🧹 ModuleRegistry 정리 중...", "yellow", "orange")
    );

    // 통계 정보 저장 (필요시)
    logger.moduleLog("ModuleRegistry", "정리 완료", this.getStats());

    console.log(messageSystem.rainbow("✅ ModuleRegistry 정리 완료"));
  }
}

// ===== 🎯 싱글톤 인스턴스 =====
let registryInstance = null;

/**
 * 📋 ModuleRegistry 싱글톤 인스턴스
 */
function getModuleRegistry() {
  if (!registryInstance) {
    registryInstance = new ModuleRegistry();
  }
  return registryInstance;
}

/**
 * 📋 활성화된 모듈 목록 (기존 호환성)
 */
function getEnabledModules() {
  return getModuleRegistry().getEnabledModules();
}

/**
 * ⭐ Enhanced 모듈 목록
 */
function getEnhancedModules() {
  return getModuleRegistry().getEnhancedModules();
}

/**
 * 📱 메뉴 모듈 목록
 */
function getMenuModules() {
  return getModuleRegistry().getMenuModules();
}

/**
 * 📦 특정 모듈 정보
 */
function getModule(moduleKey) {
  return getModuleRegistry().getModule(moduleKey);
}

/**
 * 📊 레지스트리 통계
 */
function getRegistryStats() {
  return getModuleRegistry().getStats();
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  // 클래스
  ModuleRegistry,

  // 기본 함수들 (기존 호환성)
  getEnabledModules,
  getModule,

  // 새로운 Enhanced 함수들
  getEnhancedModules,
  getMenuModules,
  getRegistryStats,
  getModuleRegistry,

  // 설정 정보
  MODULES,
  REGISTRY_SETTINGS,

  // 버전 정보
  version: "3.0.1",
  description: "두목봇 알록달록 모듈 레지스트리",
};
