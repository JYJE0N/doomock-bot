// src/utils/SystemHelper.js
/**
 * 🔧 시스템 관련 유틸리티 함수들
 */

/**
 * 메모리 사용량 포맷팅
 */
function formatMemoryUsage() {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const percentage = Math.round((used.heapUsed / used.heapTotal) * 100);

  return `${heapUsedMB}MB / ${heapTotalMB}MB (${percentage}%)`;
}

/**
 * 업타임 포맷팅
 */
function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분 ${seconds % 60}초`;
  } else {
    return `${seconds}초`;
  }
}

/**
 * 시스템 정보 수집
 */
function getSystemInfo() {
  return {
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };
}

/**
 * 환경 정보
 */
function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || "production",
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isRailway: !!process.env.RAILWAY_ENVIRONMENT,
    railwayEnv: process.env.RAILWAY_ENVIRONMENT,
  };
}

module.exports = {
  formatMemoryUsage,
  formatUptime,
  getSystemInfo,
  getEnvironmentInfo,
};
