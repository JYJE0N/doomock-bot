// src/config/ModuleRegistry.js
const logger = require("../utils/Logger");
const path = require("path");

/**
 * 📋 ModuleRegistry - 모듈 설정 중앙 관리
 * - 모든 모듈의 메타데이터 정의
 * - 모듈 경로, 활성화 상태 관리
 * - v3.0.1 표준 준수
 */

const ENABLED_MODULES = [
  // 🏠 시스템 모듈 (필수)
  {
    name: "SystemModule",
    path: path.join(__dirname, "../modules/SystemModule.js"),
    enabled: true,
    priority: 1,
    description: "시스템 핵심 기능",
    dependencies: [],
  },

  // 📝 할일 관리 모듈 (새로 추가!)
  {
    name: "TodoModule",
    path: path.join(__dirname, "../modules/TodoModule.js"),
    enabled: true,
    priority: 2,
    description: "할일 관리 및 추적",
    dependencies: ["MongooseManager"],
    keywords: ["할일", "todo", "📝"],
    icon: "📝",
    category: "productivity",
  },

  // ⏰ 타이머 모듈
  {
    name: "TimerModule",
    path: path.join(__dirname, "../modules/TimerModule.js"),
    enabled: true,
    priority: 3,
    description: "포모도로 타이머",
    dependencies: ["MongooseManager"],
    keywords: ["타이머", "timer", "⏰"],
    icon: "⏰",
    category: "productivity",
  },

  // 🏢 근무시간 모듈
  {
    name: "WorktimeModule",
    path: path.join(__dirname, "../modules/WorktimeModule.js"),
    enabled: true,
    priority: 4,
    description: "출퇴근 및 근무시간 관리",
    dependencies: ["MongooseManager"],
    keywords: ["출근", "퇴근", "근무", "worktime", "🏢"],
    icon: "🏢",
    category: "work",
  },

  // 🏖️ 휴가 관리 모듈
  {
    name: "LeaveModule",
    path: path.join(__dirname, "../modules/LeaveModule.js"),
    enabled: true,
    priority: 5,
    description: "연차 및 휴가 관리",
    dependencies: ["MongooseManager"],
    keywords: ["휴가", "연차", "leave", "🏖️"],
    icon: "🏖️",
    category: "work",
  },

  // ⏰ 리마인더 모듈
  {
    name: "ReminderModule",
    path: path.join(__dirname, "../modules/ReminderModule.js"),
    enabled: false,
    priority: 6,
    description: "알림 및 리마인더",
    dependencies: ["MongooseManager"],
    keywords: ["알림", "reminder", "⏰"],
    icon: "🔔",
    category: "utility",
  },

  // 🔮 운세 모듈
  {
    name: "FortuneModule",
    path: path.join(__dirname, "../modules/FortuneModule.js"),
    enabled: true,
    priority: 7,
    description: "오늘의 운세",
    dependencies: [],
    keywords: ["운세", "fortune", "🔮"],
    icon: "🔮",
    category: "entertainment",
  },

  // 🌤️ 날씨 모듈
  {
    name: "WeatherModule",
    path: path.join(__dirname, "../modules/WeatherModule.js"),
    enabled: true,
    priority: 8,
    description: "날씨 정보",
    dependencies: [],
    keywords: ["날씨", "weather", "🌤️"],
    icon: "🌤️",
    category: "utility",
  },

  // 🔊 TTS 모듈
  {
    name: "TTSModule",
    path: path.join(__dirname, "../modules/TTSModule.js"),
    enabled: true,
    priority: 9,
    description: "텍스트 음성 변환",
    dependencies: ["MongooseManager"],
    keywords: ["tts", "음성", "🔊"],
    icon: "🔊",
    category: "utility",
  },
];

/**
 * 활성화된 모듈 목록 가져오기
 */
function getEnabledModules() {
  return ENABLED_MODULES.filter((module) => module.enabled).sort(
    (a, b) => a.priority - b.priority
  );
}

/**
 * 모듈별 카테고리 그룹핑
 */
function getModulesByCategory() {
  const enabledModules = getEnabledModules();
  const categories = {};

  enabledModules.forEach((module) => {
    const category = module.category || "other";
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(module);
  });

  return categories;
}

/**
 * 모듈 정보 조회
 */
function getModuleInfo(moduleName) {
  return ENABLED_MODULES.find(
    (module) =>
      module.name === moduleName ||
      module.name.toLowerCase() === moduleName.toLowerCase()
  );
}

/**
 * 모듈 의존성 검증
 */
function validateModuleDependencies() {
  const errors = [];

  ENABLED_MODULES.forEach((module) => {
    if (module.dependencies && module.dependencies.length > 0) {
      module.dependencies.forEach((dep) => {
        // 의존성 검증 로직 (추후 구현)
        logger.debug(`📦 ${module.name} 의존성 확인: ${dep}`);
      });
    }
  });

  return errors;
}

/**
 * 네비게이션용 모듈 메뉴 생성
 */
function buildModuleMenuButtons() {
  const enabledModules = getEnabledModules();
  const buttons = [];

  // 카테고리별로 그룹핑
  const categories = getModulesByCategory();

  // 생산성 도구 (첫 번째 줄)
  if (categories.productivity) {
    const productivityRow = categories.productivity.map((module) => ({
      text: `${module.icon} ${module.description}`,
      callback_data: `${module.name.toLowerCase().replace("module", "")}:menu`,
    }));

    // 한 줄에 최대 2개씩
    for (let i = 0; i < productivityRow.length; i += 2) {
      buttons.push(productivityRow.slice(i, i + 2));
    }
  }

  // 업무 관리 (두 번째 줄)
  if (categories.work) {
    const workRow = categories.work.map((module) => ({
      text: `${module.icon} ${module.description}`,
      callback_data: `${module.name.toLowerCase().replace("module", "")}:menu`,
    }));

    for (let i = 0; i < workRow.length; i += 2) {
      buttons.push(workRow.slice(i, i + 2));
    }
  }

  // 유틸리티 (세 번째 줄)
  if (categories.utility) {
    const utilityRow = categories.utility.map((module) => ({
      text: `${module.icon} ${module.description}`,
      callback_data: `${module.name.toLowerCase().replace("module", "")}:menu`,
    }));

    for (let i = 0; i < utilityRow.length; i += 2) {
      buttons.push(utilityRow.slice(i, i + 2));
    }
  }

  // 엔터테인먼트 (마지막 줄)
  if (categories.entertainment) {
    const entertainmentRow = categories.entertainment.map((module) => ({
      text: `${module.icon} ${module.description}`,
      callback_data: `${module.name.toLowerCase().replace("module", "")}:menu`,
    }));

    for (let i = 0; i < entertainmentRow.length; i += 2) {
      buttons.push(entertainmentRow.slice(i, i + 2));
    }
  }

  return buttons;
}

module.exports = {
  ENABLED_MODULES,
  getEnabledModules,
  getModulesByCategory,
  getModuleInfo,
  validateModuleDependencies,
  buildModuleMenuButtons,
};
