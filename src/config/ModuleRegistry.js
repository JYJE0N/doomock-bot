// src/config/ModuleRegistry.js v3.0.1 - messageSystem 오류 수정
// ========================================
// 📋 ModuleRegistry.js v3.0.1 - 수정된 버전
// ========================================
// logger 메서드 직접 사용으로 안정성 향상
// ========================================

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 ModuleRegistry v3.0.1 - 안정화된 모듈 관리
 *
 * ✨ 수정사항:
 * - messageSystem 오류 해결
 * - logger 메서드 직접 사용
 * - 안정성 향상
 */

/**
 * 📦 모듈 정의 (v3.0.1 표준)
 */
const modules = [
  {
    key: "todo",
    name: "할일 관리",
    path: "../modules/TodoModule",
    enabled: true,
    showInMainMenu: true, // 메인 메뉴 표시 여부
    menuOrder: 1, // 메뉴 순서
    config: {
      icon: "📝",
      description: "할일을 추가하고 관리하세요",
      maxItemsPerUser: 100,
    },
  },
  {
    key: "timer",
    name: "타이머",
    path: "../modules/TimerModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 2,
    config: {
      icon: "⏱️",
      description: "포모도로 타이머로 집중력을 높이세요",
      defaultDuration: 25,
    },
  },
  {
    key: "worktime",
    name: "근무시간",
    path: "../modules/WorktimeModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 3,
    config: {
      icon: "🏢",
      description: "출퇴근 시간을 기록하고 관리하세요",
      workStartTime: "09:00",
      workEndTime: "18:00",
    },
  },
  {
    key: "leave",
    name: "휴가 관리",
    path: "../modules/LeaveModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 4,
    config: {
      icon: "🏖️",
      description: "휴가를 신청하고 관리하세요",
      annualLeaveDays: 15,
    },
  },
  {
    key: "reminder",
    name: "리마인더",
    path: "../modules/ReminderModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 5,
    config: {
      icon: "🔔",
      description: "중요한 일정을 잊지 마세요",
      maxRemindersPerUser: 50,
    },
  },
  {
    key: "fortune",
    name: "운세",
    path: "../modules/FortuneModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 6,
    config: {
      icon: "🔮",
      description: "오늘의 운세를 확인하세요",
      hasSettings: false, // 설정 메뉴 없음
    },
  },
  {
    key: "weather",
    name: "날씨",
    path: "../modules/WeatherModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 7,
    config: {
      icon: "☀️",
      description: "현재 날씨와 예보를 확인하세요",
      defaultLocation: "서울",
    },
  },
  {
    key: "tts",
    name: "TTS",
    path: "../modules/TTSModule",
    enabled: true,
    showInMainMenu: true,
    menuOrder: 8,
    config: {
      icon: "🔊",
      description: "텍스트를 음성으로 변환하세요",
      defaultVoice: "ko-KR",
    },
  },
  // 시스템 모듈 (메인 메뉴에 표시 안 함)
  {
    key: "system",
    name: "시스템",
    path: "../modules/SystemModule",
    enabled: true,
    showInMainMenu: false, // 메인 메뉴에 표시 안 함
    config: {
      icon: "⚙️",
    },
  },
  // 개발/테스트용 모듈
  {
    key: "debug",
    name: "디버그",
    path: "../modules/DebugModule",
    enabled: process.env.NODE_ENV === "development",
    showInMainMenu: false,
    config: {
      icon: "🐛",
    },
  },
];

/**
 * 활성화된 모듈 목록 반환
 */
function getEnabledModules() {
  return modules.filter((m) => m.enabled);
}

/**
 * 메인 메뉴에 표시할 모듈 목록 반환
 */
function getMainMenuModules() {
  return modules
    .filter((m) => m.enabled && m.showInMainMenu)
    .sort((a, b) => (a.menuOrder || 999) - (b.menuOrder || 999));
}

/**
 * 특정 모듈 정보 반환
 */
function getModule(key) {
  return modules.find((m) => m.key === key);
}

/**
 * 모듈 활성화/비활성화
 */
function setModuleEnabled(key, enabled) {
  const module = modules.find((m) => m.key === key);
  if (module) {
    module.enabled = enabled;
    return true;
  }
  return false;
}

module.exports = {
  modules,
  getEnabledModules,
  getMainMenuModules,
  getModule,
  setModuleEnabled,
};
