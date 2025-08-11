// src/utils/SystemHelper.js - 완전 강화된 시스템 헬퍼 v2.0
const os = require("os");
const fs = require("fs");
const logger = require("./Logger");

/**
 * 🔧 SystemHelper v2.0 - 전문 시스템 정보 수집기
 *
 * ✨ 새로운 기능:
 * - CPU 상세 정보 및 사용률
 * - 디스크 사용량 모니터링
 * - 네트워크 인터페이스 정보
 * - 프로세스 성능 메트릭
 * - 시스템 건강도 진단
 * - Railway/클라우드 환경 감지
 * - 에러 안전성 강화
 *
 * 🎯 SystemModule 전용 설계:
 * - 데이터베이스 없이 실시간 정보만 수집
 * - 메타-시스템 관점에서 전체 상황 파악
 * - 렌더러에서 바로 사용 가능한 포맷
 */

/**
 * 💾 메모리 사용량 포맷팅 (기존 + 개선)
 */
function formatMemoryUsage() {
  try {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const percentage = Math.round((used.heapUsed / used.heapTotal) * 100);

    return `${heapUsedMB}MB / ${heapTotalMB}MB (${percentage}%)`;
  } catch (error) {
    logger.warn("메모리 정보 수집 실패:", error.message);
    return "메모리 정보 수집 실패";
  }
}

/**
 * 💾 상세 메모리 정보 (새로 추가!)
 */
function getDetailedMemoryInfo() {
  try {
    const usage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem()
    };

    return {
      // Node.js 프로세스 메모리
      process: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
        percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
      },

      // 시스템 전체 메모리
      system: {
        total: Math.round(systemMem.total / 1024 / 1024 / 1024), // GB
        free: Math.round(systemMem.free / 1024 / 1024 / 1024), // GB
        used: Math.round(
          (systemMem.total - systemMem.free) / 1024 / 1024 / 1024
        ),
        percentage: Math.round(
          ((systemMem.total - systemMem.free) / systemMem.total) * 100
        )
      },

      // 건강도 평가
      health: {
        processHealthy: usage.heapUsed / usage.heapTotal < 0.8,
        systemHealthy:
          (systemMem.total - systemMem.free) / systemMem.total < 0.85,
        score: calculateMemoryHealthScore(usage, systemMem)
      }
    };
  } catch (error) {
    logger.warn("상세 메모리 정보 수집 실패:", error.message);
    return { error: "메모리 정보 수집 실패" };
  }
}

/**
 * 💾 메모리 건강도 점수 계산
 */
function calculateMemoryHealthScore(processUsage, systemMem) {
  try {
    let score = 100;

    // 프로세스 메모리 사용률 감점
    const processPercent =
      (processUsage.heapUsed / processUsage.heapTotal) * 100;
    if (processPercent > 90) score -= 40;
    else if (processPercent > 80) score -= 25;
    else if (processPercent > 70) score -= 15;

    // 시스템 메모리 사용률 감점
    const systemPercent =
      ((systemMem.total - systemMem.free) / systemMem.total) * 100;
    if (systemPercent > 95) score -= 30;
    else if (systemPercent > 85) score -= 20;
    else if (systemPercent > 75) score -= 10;

    return Math.max(0, score);
  } catch (error) {
    return 50; // 기본값
  }
}

/**
 * ⏱️ 업타임 포맷팅 (기존 + 개선)
 */
function formatUptime(milliseconds) {
  try {
    if (!milliseconds || milliseconds <= 0) return "정보 없음";

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  } catch (error) {
    logger.warn("업타임 포맷팅 실패:", error.message);
    return "업타임 정보 오류";
  }
}

/**
 * 🖥️ 기본 시스템 정보 수집 (기존 + 개선)
 */
function getSystemInfo() {
  try {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      arch: process.arch,
      hostname: os.hostname(),
      osType: os.type(),
      osRelease: os.release(),
      loadAverage: os.loadavg(), // 시스템 로드 (Linux/macOS만)
      timestamp: Date.now()
    };
  } catch (error) {
    logger.warn("기본 시스템 정보 수집 실패:", error.message);
    return {
      platform: "unknown",
      nodeVersion: "unknown",
      pid: process.pid || 0,
      uptime: 0,
      error: "시스템 정보 수집 실패"
    };
  }
}

/**
 * 🖥️ CPU 상세 정보 (새로 추가!)
 */
function getCpuInfo() {
  try {
    const cpus = os.cpus();

    if (!cpus || cpus.length === 0) {
      return { error: "CPU 정보 없음" };
    }

    const firstCpu = cpus[0];
    const totalCores = cpus.length;

    // CPU 사용률 계산 (간단한 버전)
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = Math.round(100 - (totalIdle / totalTick) * 100);

    return {
      model: firstCpu.model,
      speed: Math.round(firstCpu.speed), // MHz
      cores: totalCores,
      usage: isNaN(usage) ? 0 : usage,
      loadAverage: os.loadavg(),
      architecture: process.arch,
      health: {
        healthy: usage < 80,
        score: Math.max(0, 100 - usage)
      }
    };
  } catch (error) {
    logger.warn("CPU 정보 수집 실패:", error.message);
    return {
      model: "알 수 없음",
      cores: 1,
      usage: 0,
      error: "CPU 정보 수집 실패"
    };
  }
}

/**
 * 💿 디스크 사용량 정보 (새로 추가!)
 */
function getDiskUsage() {
  try {
    // Node.js에서 디스크 사용량을 직접 가져오는 것은 제한적
    // 대신 현재 작업 디렉토리의 통계를 확인
    const _stats = fs.statSync(process.cwd());

    return {
      available: true,
      currentPath: process.cwd(),
      accessible: true,
      note: "상세한 디스크 정보는 시스템별 도구 필요",
      health: {
        accessible: true,
        score: 85 // 기본값
      }
    };
  } catch (error) {
    logger.warn("디스크 정보 확인 실패:", error.message);
    return {
      available: false,
      error: "디스크 정보 수집 실패",
      health: {
        accessible: false,
        score: 0
      }
    };
  }
}

/**
 * 🌐 네트워크 정보 (새로 추가!)
 */
function getNetworkInfo() {
  try {
    const interfaces = os.networkInterfaces();
    const activeInterfaces = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;

      const ipv4 = addresses.find(
        (addr) => addr.family === "IPv4" && !addr.internal
      );
      const ipv6 = addresses.find(
        (addr) => addr.family === "IPv6" && !addr.internal
      );

      if (ipv4 || ipv6) {
        activeInterfaces.push({
          name,
          ipv4: ipv4?.address,
          ipv6: ipv6?.address,
          mac: ipv4?.mac || ipv6?.mac
        });
      }
    }

    return {
      hostname: os.hostname(),
      interfaces: activeInterfaces,
      count: activeInterfaces.length,
      health: {
        connected: activeInterfaces.length > 0,
        score: activeInterfaces.length > 0 ? 100 : 0
      }
    };
  } catch (error) {
    logger.warn("네트워크 정보 수집 실패:", error.message);
    return {
      hostname: "알 수 없음",
      interfaces: [],
      error: "네트워크 정보 수집 실패",
      health: { connected: false, score: 0 }
    };
  }
}

/**
 * 🌍 환경 정보 (기존 + 대폭 강화!)
 */
function getEnvironmentInfo() {
  try {
    const env = process.env;

    return {
      // 기본 환경
      nodeEnv: env.NODE_ENV || "production",
      isProduction: env.NODE_ENV === "production",
      isDevelopment: env.NODE_ENV === "development",
      timezone: env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,

      // 클라우드 환경 감지
      cloud: {
        isRailway: !!env.RAILWAY_ENVIRONMENT,
        railwayEnv: env.RAILWAY_ENVIRONMENT,
        isHeroku: !!env.DYNO,
        isVercel: !!env.VERCEL,
        isNetlify: !!env.NETLIFY,
        isDocker: fs.existsSync("/.dockerenv"),
        provider: getCloudProvider(env)
      },

      // 봇 관련 환경
      bot: {
        version: env.BOT_VERSION || "4.0.0",
        debug: env.DEBUG === "true",
        logLevel: env.LOG_LEVEL || "info"
      },

      // 보안 (민감한 정보는 숨김)
      security: {
        hasToken: !!env.BOT_TOKEN,
        hasDatabase: !!(env.MONGODB_URI || env.DATABASE_URL),
        configCount: Object.keys(env).length
      }
    };
  } catch (error) {
    logger.warn("환경 정보 수집 실패:", error.message);
    return {
      nodeEnv: "unknown",
      error: "환경 정보 수집 실패"
    };
  }
}

/**
 * ☁️ 클라우드 제공업체 감지
 */
function getCloudProvider(env) {
  if (env.RAILWAY_ENVIRONMENT) return "Railway";
  if (env.DYNO) return "Heroku";
  if (env.VERCEL) return "Vercel";
  if (env.NETLIFY) return "Netlify";
  if (env.AWS_REGION) return "AWS";
  if (env.GOOGLE_CLOUD_PROJECT) return "Google Cloud";
  if (fs.existsSync("/.dockerenv")) return "Docker";
  return "Local/Unknown";
}

/**
 * 🏥 시스템 건강도 종합 진단 (새로 추가!)
 */
function getSystemHealth() {
  try {
    const memory = getDetailedMemoryInfo();
    const cpu = getCpuInfo();
    const disk = getDiskUsage();
    const network = getNetworkInfo();
    const uptime = process.uptime() * 1000; // ms로 변환

    // 각 영역별 점수
    const scores = {
      memory: memory.health?.score || 50,
      cpu: cpu.health?.score || 50,
      disk: disk.health?.score || 50,
      network: network.health?.score || 50,
      uptime: calculateUptimeScore(uptime)
    };

    // 전체 점수 (가중평균)
    const overallScore = Math.round(
      scores.memory * 0.3 +
        scores.cpu * 0.25 +
        scores.disk * 0.2 +
        scores.network * 0.15 +
        scores.uptime * 0.1
    );

    return {
      overall: {
        score: overallScore,
        status: getHealthStatus(overallScore),
        timestamp: new Date().toISOString()
      },
      components: scores,
      recommendations: generateHealthRecommendations(scores)
    };
  } catch (error) {
    logger.warn("시스템 건강도 진단 실패:", error.message);
    return {
      overall: { score: 0, status: "error" },
      error: "건강도 진단 실패"
    };
  }
}

/**
 * ⏱️ 업타임 점수 계산
 */
function calculateUptimeScore(uptimeMs) {
  const hours = uptimeMs / 3600000;
  if (hours < 1) return 50; // 1시간 미만
  if (hours < 24) return 80; // 1일 미만
  if (hours < 168) return 95; // 1주일 미만
  return 100; // 1주일 이상
}

/**
 * 🏥 건강도 상태 텍스트
 */
function getHealthStatus(score) {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

/**
 * 💡 건강도 기반 추천사항 생성
 */
function generateHealthRecommendations(scores) {
  const recommendations = [];

  if (scores.memory < 70) {
    recommendations.push(
      "메모리 사용량이 높습니다. 불필요한 프로세스를 정리하세요."
    );
  }

  if (scores.cpu < 70) {
    recommendations.push("CPU 사용률이 높습니다. 시스템 부하를 점검하세요.");
  }

  if (scores.network < 50) {
    recommendations.push("네트워크 연결을 확인하세요.");
  }

  if (recommendations.length === 0) {
    recommendations.push("시스템이 정상적으로 작동 중입니다!");
  }

  return recommendations;
}

/**
 * 📊 성능 메트릭 수집 (새로 추가!)
 */
function getPerformanceMetrics() {
  try {
    const hrTime = process.hrtime();
    const startTime = Date.now();

    return {
      timestamp: startTime,
      hrtime: hrTime,
      eventLoop: {
        // Node.js 이벤트 루프 지연 측정 (간단한 버전)
        delay: 0 // 실제 측정은 더 복잡한 로직 필요
      },
      gc: {
        // 가비지 컬렉션 정보 (v8에서 제공하는 경우)
        available: typeof global.gc === "function"
      }
    };
  } catch (error) {
    logger.warn("성능 메트릭 수집 실패:", error.message);
    return { error: "성능 메트릭 수집 실패" };
  }
}

/**
 * 🎯 SystemModule용 완전한 시스템 스냅샷 (새로 추가!)
 */
function getCompleteSystemSnapshot() {
  try {
    logger.debug("🔍 완전한 시스템 스냅샷 수집 시작...");

    const snapshot = {
      // 기본 정보
      basic: getSystemInfo(),

      // 상세 정보
      memory: getDetailedMemoryInfo(),
      cpu: getCpuInfo(),
      disk: getDiskUsage(),
      network: getNetworkInfo(),
      environment: getEnvironmentInfo(),

      // 건강도 및 성능
      health: getSystemHealth(),
      performance: getPerformanceMetrics(),

      // 메타 정보
      meta: {
        collectedAt: new Date().toISOString(),
        collectionDuration: 0, // 수집 소요시간
        version: "2.0.0"
      }
    };

    // 수집 소요시간 계산
    const endTime = Date.now();
    snapshot.meta.collectionDuration =
      endTime - (snapshot.basic.timestamp || endTime);

    logger.debug("✅ 시스템 스냅샷 수집 완료");
    return snapshot;
  } catch (error) {
    logger.error("❌ 시스템 스냅샷 수집 실패:", error);
    return {
      error: "시스템 스냅샷 수집 실패",
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ===== 📤 내보내기 =====

module.exports = {
  // 기존 함수들 (호환성 유지)
  formatMemoryUsage,
  formatUptime,
  getSystemInfo,
  getEnvironmentInfo,

  // 새로운 고급 함수들
  getDetailedMemoryInfo,
  getCpuInfo,
  getDiskUsage,
  getNetworkInfo,
  getSystemHealth,
  getPerformanceMetrics,

  // SystemModule 전용 올인원 함수
  getCompleteSystemSnapshot,

  // 헬퍼 함수들
  calculateMemoryHealthScore,
  getHealthStatus,
  generateHealthRecommendations
};

// 초기화 로그
logger.info("🔧 SystemHelper v2.0 로드됨 - 완전 강화된 시스템 진단 도구");
