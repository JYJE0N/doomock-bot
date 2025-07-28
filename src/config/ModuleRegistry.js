// src/config/ModuleRegistry.js - 간단한 버전
const logger = require("../utils/Logger");

/**
 * 📋 간단한 ModuleRegistry
 * 실제 모듈 시스템이 준비될 때까지 사용
 */

const MODULES = [
  { key: "system", name: "시스템 관리", enabled: true, enhanced: true },
  { key: "todo", name: "할일 관리", enabled: true, enhanced: true },
  { key: "timer", name: "타이머", enabled: true, enhanced: true },
  { key: "worktime", name: "근무시간 관리", enabled: true, enhanced: true },
  { key: "leave", name: "휴가 관리", enabled: true, enhanced: true },
  { key: "reminder", name: "리마인더", enabled: true, enhanced: false },
  { key: "fortune", name: "운세", enabled: true, enhanced: false },
  { key: "weather", name: "날씨", enabled: true, enhanced: false },
  { key: "tts", name: "음성 변환", enabled: true, enhanced: false },
];

/**
 * 활성화된 모듈 목록
 */
function getEnabledModules() {
  return MODULES.filter((m) => m.enabled);
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
  };
}

/**
 * 특정 모듈 조회
 */
function getModule(moduleKey) {
  return MODULES.find((m) => m.key === moduleKey);
}

// 초기화 로그
logger.info("📋 ModuleRegistry 로드됨 (간단한 버전)");

module.exports = {
  getEnabledModules,
  getRegistryStats,
  getModule,
  MODULES,
};
