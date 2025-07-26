// src/config/moduleRegistry.js - 중앙 모듈 레지스트리
const path = require("path");
/**
 * 📝 모듈 중앙 레지스트리
 * - 모든 모듈의 메타데이터 관리
 * - 우선순위 기반 로드 순서
 * - 환경변수 기반 활성/비활성
 */
const MODULE_REGISTRY = [
  // ===== 🏠 핵심 시스템 모듈 (우선순위 1-10) =====
  {
    key: "system",
    name: "시스템 모듈",
    description: "시스템 핵심 기능",
    path: path.join(__dirname, "../modules/SystemModule"),
    priority: 1,
    required: true,
    enabled: true,
    config: {
      showInMenu: true,
      icon: "🏠",
    },
  },

  // ===== 📋 주요 기능 모듈 (우선순위 10-50) =====
  {
    key: "todo",
    name: "할일 관리",
    description: "할일 추가, 완료, 삭제",
    path: path.join(__dirname, "../modules/TodoModule"),
    priority: 10,
    required: false,
    enabled: process.env.ENABLE_TODO_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "📝",
      maxTodos: 100,
    },
  },

  {
    key: "timer",
    name: "타이머/포모도로",
    description: "타이머 및 포모도로 기능",
    path: path.join(__dirname, "../modules/TimerModule"),
    priority: 20,
    required: false,
    enabled: process.env.ENABLE_TIMER_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "⏰",
      defaultDuration: 25,
    },
  },

  {
    key: "worktime",
    name: "근무시간 관리",
    description: "출퇴근 및 근무시간 추적",
    path: path.join(__dirname, "../modules/WorktimeModule"),
    priority: 25,
    required: false,
    enabled: process.env.ENABLE_WORKTIME_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "🕐",
    },
  },

  {
    key: "leave",
    name: "휴가 관리",
    description: "연차, 월차, 반차 관리",
    path: path.join(__dirname, "../modules/LeaveModule"),
    priority: 30,
    required: false,
    enabled: process.env.ENABLE_LEAVE_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "🏖️",
    },
  },

  {
    key: "reminder",
    name: "리마인더",
    description: "알림 및 리마인더 설정",
    path: path.join(__dirname, "../modules/ReminderModule"),
    priority: 35,
    required: false,
    enabled: process.env.ENABLE_REMINDER_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "⏰",
    },
  },

  // ===== 🎮 보조 기능 모듈 (우선순위 50-100) =====
  {
    key: "fortune",
    name: "운세",
    description: "오늘의 운세 확인",
    path: path.join(__dirname, "../modules/FortuneModule"),
    priority: 60,
    required: false,
    enabled: process.env.ENABLE_FORTUNE_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "🔮",
    },
  },

  {
    key: "weather",
    name: "날씨",
    description: "날씨 정보 및 미세먼지",
    path: path.join(__dirname, "../modules/WeatherModule"),
    priority: 65,
    required: false,
    enabled: process.env.ENABLE_WEATHER_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "🌤️",
    },
  },

  {
    key: "tts",
    name: "텍스트 음성 변환",
    description: "텍스트를 음성으로 변환",
    path: path.join(__dirname, "../modules/TTSModule"),
    priority: 70,
    required: false,
    enabled: process.env.ENABLE_TTS_MODULE !== "false",
    config: {
      showInMenu: true,
      icon: "🎤",
    },
  },
];

/**
 * 🔍 활성화된 모듈만 가져오기
 */
function getEnabledModules() {
  return MODULE_REGISTRY.filter((module) => module.enabled).sort(
    (a, b) => a.priority - b.priority
  );
}

/**
 * 🔍 모든 모듈 가져오기
 */
function getAllModules() {
  return MODULE_REGISTRY.sort((a, b) => a.priority - b.priority);
}

/**
 * 🔍 특정 모듈 정보 가져오기
 */
function getModuleInfo(moduleKey) {
  return MODULE_REGISTRY.find((module) => module.key === moduleKey);
}

/**
 * 🔍 메뉴에 표시할 모듈만 가져오기
 */
function getMenuModules() {
  return MODULE_REGISTRY.filter(
    (module) => module.enabled && module.config.showInMenu
  ).sort((a, b) => a.priority - b.priority);
}

/**
 * 📊 모듈 통계
 */
function getModuleStats() {
  const total = MODULE_REGISTRY.length;
  const enabled = MODULE_REGISTRY.filter((m) => m.enabled).length;
  const required = MODULE_REGISTRY.filter((m) => m.required).length;

  return {
    total,
    enabled,
    disabled: total - enabled,
    required,
    optional: total - required,
  };
}

module.exports = {
  MODULE_REGISTRY,
  getEnabledModules,
  getAllModules,
  getModuleInfo,
  getMenuModules,
  getModuleStats,
};
