// src/config/ModuleRegistry.js
const logger = require("../utils/Logger");
const path = require("path");

/**
 * 📋 ModuleRegistry - 모듈 설정 중앙 관리
 * - 모든 모듈의 메타데이터 정의
 * - 모듈 경로, 활성화 상태 관리
 * - v3.0.1 표준 준수
 */

// 모듈 기본 경로
const MODULE_BASE_PATH = path.join(__dirname, "..", "modules");

const MODULES = [
  {
    key: "system",
    name: "시스템 관리",
    enabled: true,
    enhanced: true,
    path: path.join(MODULE_BASE_PATH, "SystemModule.js"),
    description: "메인 메뉴, 도움말, 시스템 상태 관리",
  },
  {
    key: "todo",
    name: "할일 관리",
    enabled: true,
    enhanced: true,
    path: path.join(MODULE_BASE_PATH, "TodoModule.js"),
    description: "할일 추가, 완료, 카테고리 관리",
  },
  {
    key: "timer",
    name: "타이머",
    enabled: true,
    enhanced: true,
    path: path.join(MODULE_BASE_PATH, "TimerModule.js"),
    description: "포모도로 타이머, 집중 시간 관리",
  },
  {
    key: "worktime",
    name: "근무시간 관리",
    enabled: true,
    enhanced: true,
    path: path.join(MODULE_BASE_PATH, "WorktimeModule.js"),
    description: "출퇴근 기록, 근무 통계",
  },
  {
    key: "leave",
    name: "휴가 관리",
    enabled: true,
    enhanced: true,
    path: path.join(MODULE_BASE_PATH, "LeaveModule.js"),
    description: "연차 계산, 휴가 신청 관리",
  },
  {
    key: "reminder",
    name: "리마인더",
    enabled: true,
    enhanced: false,
    path: path.join(MODULE_BASE_PATH, "ReminderModule.js"),
    description: "알림 설정, 반복 알림",
  },
  {
    key: "fortune",
    name: "운세",
    enabled: true,
    enhanced: false,
    path: path.join(MODULE_BASE_PATH, "FortuneModule.js"),
    description: "오늘의 운세, 타로 카드",
  },
  {
    key: "weather",
    name: "날씨",
    enabled: true,
    enhanced: false,
    path: path.join(MODULE_BASE_PATH, "WeatherModule.js"),
    description: "현재 날씨, 주간 예보",
  },
  {
    key: "tts",
    name: "음성 변환",
    enabled: true,
    enhanced: false,
    path: path.join(MODULE_BASE_PATH, "TTSModule.js"),
    description: "텍스트를 음성으로 변환",
  },
];

/**
 * 활성화된 모듈 목록 반환
 */
function getEnabledModules() {
  const enabledModules = MODULES.filter((m) => m.enabled);

  // 경로 검증
  enabledModules.forEach((module) => {
    if (!module.path) {
      logger.error(`❌ ${module.key} 모듈에 path가 없습니다!`);
    }
  });

  return enabledModules;
}

/**
 * 레지스트리 통계
 */
function getRegistryStats() {
  const enabledModules = MODULES.filter((m) => m.enabled);
  const enhancedModules = MODULES.filter((m) => m.enhanced);

  return {
    totalModules: MODULES.length,
    enabledModules: enabledModules.length,
    enhancedModules: enhancedModules.length,
    disabledModules: MODULES.length - enabledModules.length,
  };
}

/**
 * 특정 모듈 조회
 */
function getModule(moduleKey) {
  return MODULES.find((m) => m.key === moduleKey);
}

/**
 * 모듈 활성화/비활성화
 */
function setModuleEnabled(moduleKey, enabled) {
  const module = MODULES.find((m) => m.key === moduleKey);
  if (module) {
    module.enabled = enabled;
    logger.info(`📋 ${moduleKey} 모듈 ${enabled ? "활성화" : "비활성화"}됨`);
    return true;
  }
  return false;
}

/**
 * 모듈 경로 검증
 */
function validateModulePaths() {
  const fs = require("fs");
  const issues = [];

  MODULES.forEach((module) => {
    if (!module.path) {
      issues.push(`${module.key}: path 누락`);
    } else if (!fs.existsSync(module.path)) {
      issues.push(`${module.key}: 파일 없음 (${module.path})`);
    }
  });

  if (issues.length > 0) {
    logger.error("📋 모듈 경로 검증 실패:", issues);
  } else {
    logger.success("📋 모든 모듈 경로 검증 완료");
  }

  return issues;
}

// 초기화 시 경로 검증
logger.info("📋 ModuleRegistry 로드됨");
const stats = getRegistryStats();
logger.info(
  `📊 모듈 통계: 총 ${stats.totalModules}개, 활성 ${stats.enabledModules}개, 향상 ${stats.enhancedModules}개`
);

module.exports = {
  getEnabledModules,
  getRegistryStats,
  getModule,
  setModuleEnabled,
  validateModulePaths,
  MODULES,
  MODULE_BASE_PATH,
};
