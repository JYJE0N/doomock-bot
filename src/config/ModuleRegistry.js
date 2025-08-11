// src/config/ModuleRegistry.js - 완전히 새로 작성 (근본 해결)
const logger = require("../utils/core/Logger");
const path = require("path");

/**
 * 🎯 통합 모듈 레지스트리 v4.0.0
 *
 * ✅ 근본 해결:
 * - NavigationHandler와 완벽 호환되는 데이터 구조
 * - MenuConfig와 중복 제거
 * - 단일 진실의 원천 (Single Source of Truth)
 * - 확장 가능한 메타데이터 구조
 */

/**
 * 📋 완전한 모듈 정의 구조
 * NavigationHandler가 기대하는 모든 필드 포함
 */
const UNIFIED_MODULES = [
  // 🖥️ 시스템 모듈 (필수, 숨김)
  {
    key: "system",
    name: "SystemModule",
    displayName: "시스템 관리",
    description: "시스템 핵심 기능",
    icon: "🖥️",
    path: path.join(__dirname, "../modules/SystemModuleV2.js"),
    enabled: true,
    showInMenu: false, // ✅ 중요: 메인 메뉴에 표시 안함
    priority: 0,
    category: "system",
    dependencies: [],
    keywords: ["시스템", "system", "도움말", "help", "상태", "status"],
    enhanced: true,
    rainbow: true
  },

  // 📝 할일 관리 모듈
  {
    key: "todo",
    name: "TodoModule",
    displayName: "할일 관리",
    description: "할일 등록 및 관리",
    icon: "📝",
    path: path.join(__dirname, "../modules/TodoModuleV2.js"),
    enabled: true,
    showInMenu: true, // ✅ 메인 메뉴에 표시
    priority: 1,
    category: "productivity",
    dependencies: ["MongooseManager"],
    keywords: ["할일", "todo", "작업", "task"],
    enhanced: true,
    rainbow: true
  },

  // ⏰ 타이머 모듈
  {
    key: "timer",
    name: "TimerModule",
    displayName: "포모도로 타이머",
    description: "집중 타이머 및 휴식",
    icon: "⏰",
    path: path.join(__dirname, "../modules/TimerModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 2,
    category: "productivity",
    dependencies: ["MongooseManager"],
    keywords: ["타이머", "timer", "포모도로", "pomodoro"],
    enhanced: true,
    rainbow: true
  },

  // 🏢 근무시간 모듈
  {
    key: "worktime",
    name: "WorktimeModule",
    displayName: "근무시간 관리",
    description: "출퇴근 및 근무시간 추적",
    icon: "🏢",
    path: path.join(__dirname, "../modules/WorktimeModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 3,
    category: "work",
    dependencies: ["MongooseManager"],
    keywords: ["출근", "퇴근", "근무", "worktime", "출퇴근"],
    enhanced: true,
    rainbow: true
  },

  // 🏖️ 휴가 관리 모듈
  {
    key: "leave",
    name: "LeaveModule",
    displayName: "휴가 관리",
    description: "연차 및 휴가 신청",
    icon: "🏖️",
    path: path.join(__dirname, "../modules/LeaveModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 4,
    category: "work",
    dependencies: ["MongooseManager"],
    keywords: ["휴가", "연차", "leave", "vacation"],
    enhanced: false,
    rainbow: false
  },

  // 🔮 운세 모듈
  {
    key: "fortune",
    name: "FortuneModule",
    displayName: "오늘의 운세",
    description: "운세 및 타로",
    icon: "🔮",
    path: path.join(__dirname, "../modules/FortuneModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 5,
    category: "entertainment",
    dependencies: [],
    keywords: ["운세", "fortune", "타로", "점"],
    enhanced: false,
    rainbow: false
  },

  // 🌤️ 날씨 모듈
  {
    key: "weather",
    name: "WeatherModule",
    displayName: "날씨 정보",
    description: "날씨 및 미세먼지",
    icon: "🌤️",
    path: path.join(__dirname, "../modules/WeatherModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 6,
    category: "utility",
    dependencies: [],
    keywords: ["날씨", "weather", "미세먼지", "기상"],
    enhanced: false,
    rainbow: false
  },

  // 🔊 TTS 모듈
  {
    key: "tts",
    name: "TTSModule",
    displayName: "음성 변환",
    description: "텍스트를 음성으로",
    icon: "🔊",
    path: path.join(__dirname, "../modules/TTSModuleV2.js"),
    enabled: true,
    showInMenu: true,
    priority: 7,
    category: "utility",
    dependencies: ["MongooseManager"],
    keywords: ["tts", "음성", "변환", "읽기"],
    enhanced: false,
    rainbow: false
  },

  // 🔔 리마인더 모듈 (비활성화)
  {
    key: "reminder",
    name: "ReminderModule",
    displayName: "리마인더",
    description: "알림 및 스케줄",
    icon: "🔔",
    path: path.join(__dirname, "../modules/ReminderModule.js"),
    enabled: false, // 비활성화
    showInMenu: false,
    priority: 8,
    category: "utility",
    dependencies: ["MongooseManager"],
    keywords: ["알림", "reminder", "스케줄"],
    enhanced: false,
    rainbow: false
  }
];

/**
 * 🎯 NavigationHandler 호환 함수들
 */

/**
 * ✅ 활성화되고 메뉴에 표시할 모듈들만 반환
 * NavigationHandler.showMainMenu()에서 직접 사용
 */
function getEnabledModules() {
  return UNIFIED_MODULES.filter(
    (module) => module.enabled && module.showInMenu
  ).sort((a, b) => a.priority - b.priority);
}

/**
 * ✅ 모든 활성화된 모듈 (숨김 포함)
 * ModuleManager에서 로딩용
 */
function getAllEnabledModules() {
  return UNIFIED_MODULES.filter((module) => module.enabled).sort(
    (a, b) => a.priority - b.priority
  );
}

/**
 * 🎨 카테고리별 그룹핑
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
 * 🔍 특정 모듈 정보 조회
 */
function getModuleInfo(moduleKey) {
  return UNIFIED_MODULES.find(
    (module) =>
      module.key === moduleKey ||
      module.name.toLowerCase() === moduleKey.toLowerCase()
  );
}

/**
 * 🔧 모듈 설정 조회 (ModuleLoader에서 사용)
 */
function getModuleConfig(moduleKey) {
  return UNIFIED_MODULES.find(module => module.key === moduleKey);
}

/**
 * 🔍 모듈 key로 검색
 */
function findModuleByKey(key) {
  return UNIFIED_MODULES.find((module) => module.key === key);
}

/**
 * 📊 모듈 통계
 */
function getModuleStats() {
  const total = UNIFIED_MODULES.length;
  const enabled = UNIFIED_MODULES.filter((m) => m.enabled).length;
  const visible = UNIFIED_MODULES.filter(
    (m) => m.enabled && m.showInMenu
  ).length;
  const enhanced = UNIFIED_MODULES.filter((m) => m.enhanced).length;

  return {
    total,
    enabled,
    visible,
    enhanced,
    categories: Object.keys(getModulesByCategory()).length
  };
}

/**
 * ✅ 모듈 의존성 검증
 */
function validateModuleDependencies() {
  const errors = [];
  const enabledModules = getAllEnabledModules();

  enabledModules.forEach((module) => {
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
 * 🚀 NavigationHandler용 키보드 데이터 생성
 * 직접 inline_keyboard 구조로 반환
 */
function buildNavigationKeyboard() {
  const modules = getEnabledModules();
  const keyboard = { inline_keyboard: [] };

  // 2열씩 배치
  for (let i = 0; i < modules.length; i += 2) {
    const row = [];

    // 첫 번째 모듈
    const module1 = modules[i];
    row.push({
      text: `${module1.icon} ${module1.displayName}`,
      callback_data: `${module1.key}:menu`
    });

    // 두 번째 모듈 (있으면)
    if (i + 1 < modules.length) {
      const module2 = modules[i + 1];
      row.push({
        text: `${module2.icon} ${module2.displayName}`,
        callback_data: `${module2.key}:menu`
      });
    }

    keyboard.inline_keyboard.push(row);
  }

  // 시스템 버튼들 추가
  keyboard.inline_keyboard.push([
    { text: "📊 시스템 상태", callback_data: "system:status" },
    { text: "❓ 도움말", callback_data: "system:help" }
  ]);

  return keyboard;
}

/**
 * 🎯 초기화 및 검증
 */
function initializeRegistry() {
  logger.info(`📋 ModuleRegistry v4.0.0 초기화`);

  const stats = getModuleStats();
  logger.info(
    `📊 모듈 통계: 전체 ${stats.total}개, 활성 ${stats.enabled}개, 표시 ${stats.visible}개`
  );

  // 의존성 검증
  const errors = validateModuleDependencies();
  if (errors.length > 0) {
    logger.warn(`⚠️ 의존성 문제 ${errors.length}개 발견`);
    errors.forEach((error) => logger.warn(`  - ${error}`));
  }

  logger.success("✅ ModuleRegistry 초기화 완료");
  return true;
}

// 🚀 모듈 내보내기
module.exports = {
  // ✅ 핵심 데이터
  UNIFIED_MODULES,

  // ✅ NavigationHandler 호환 함수들
  getEnabledModules, // NavigationHandler.showMainMenu()에서 사용
  buildNavigationKeyboard, // 직접 키보드 생성

  // ✅ ModuleManager 호환 함수들
  getAllEnabledModules, // 모든 활성 모듈 (숨김 포함)

  // ✅ 유틸리티 함수들
  getModulesByCategory,
  getModuleInfo,
  getModuleConfig, // ModuleLoader용 추가
  findModuleByKey,
  getModuleStats,
  validateModuleDependencies,
  initializeRegistry,

  // ✅ 레거시 호환 (기존 코드와의 호환성)
  ENABLED_MODULES: UNIFIED_MODULES // 별칭
};

// 🎯 자동 초기화
initializeRegistry();
