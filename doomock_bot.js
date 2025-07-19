// doomock_bot_enhanced.js - 강화된 409 해결이 적용된 봇 초기화

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const AppConfig = require("./src/config/AppConfig");
const Logger = require("./src/utils/Logger");
const ConflictResolver = require("./src/utils/ConflictResolver");

// ⭐ 전역 변수 (싱글톤 패턴)
let bot = null;
let controller = null;
let conflictResolver = null;
let isShuttingDown = false;
let isInitialized = false;

// ⭐ Railway 환경 감지
const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
const environment = process.env.NODE_ENV || "development";

// ⭐ 강화된 봇 초기화 (409 해결사 포함)
async function initializeBot() {
  if (isInitialized) {
    Logger.warn("⚠️ 봇이 이미 초기화됨, 무시");
    return;
  }

  try {
    Logger.info("🚀 두목봇 v3.0.1 초기화 시작...");
    logSystemInfo();

    // ⭐ 1단계: 기존 인스턴스 완전 정리
    await performCleanupWithRetry();

    // ⭐ 2단계: 봇 인스턴스 생성 (Railway 최적화)
    bot = createOptimizedBot();

    // ⭐ 3단계: ConflictResolver 초기화
    conflictResolver = new ConflictResolver(bot, {
      maxRetries: isRailway ? 5 : 3,
      baseDelay: isRailway ? 3000 : 2000,
      maxDelay: isRailway ? 45000 : 30000,
      healthCheckInterval: isRailway ? 30000 : 60000,
      forceWebhookDelete: true,
      exponentialBackoff: true,
    });

    // ⭐ 4단계: 고급 에러 핸들러 등록
    setupAdvancedErrorHandlers();

    // ⭐ 5단계: 컨트롤러 초기화
    controller = new BotController(bot, AppConfig);
    await controller.initialize();

    // ⭐ 6단계: 안전한 폴링 시작
    await startPollingWithAdvancedResolution();

    // ⭐ 7단계: Railway 전용 모니터링 설정
    if (isRailway) {
      setupRailwayOptimizations();
    }

    isInitialized = true;
    Logger.success("✅ 두목봇 초기화 완료!");

    // 초기화 성공 로그
    logInitializationSuccess();
  } catch (error) {
    Logger.error("❌ 봇 초기화 실패:", error);

    // Railway 환경에서는 프로세스 재시작으로 자동 복구
    if (isRailway && !isShuttingDown) {
      Logger.warn("🔄 Railway 자동 재시작 트리거...");
      setTimeout(() => process.exit(1), 5000); // 5초 후 재시작
    }

    throw error;
  }
}

// ⭐ Railway 최적화 봇 생성
function createOptimizedBot() {
  const botOptions = {
    polling: {
      interval: isRailway ? 4000 : 1000, // Railway는 더 긴 간격
      autoStart: false, // 수동 시작으로 제어
      params: {
        timeout: isRailway ? 45 : 30, // Railway는 더 긴 타임아웃
        limit: isRailway ? 30 : 50, // Railway는 더 적은 메시지 처리
        allowed_updates: ["message", "callback_query"],
      },
    },
    filepath: false, // 파일 업로드 비활성화 (메모리 절약)
    onlyFirstMatch: true,
    request: {
      agentOptions: {
        keepAlive: true,
        keepAliveMsecs: 10000,
      },
      timeout: isRailway ? 45000 : 30000,
    },
  };

  Logger.info("🔧 봇 인스턴스 생성 중...", {
    polling_interval: botOptions.polling.interval,
    timeout: botOptions.polling.params.timeout,
    environment: isRailway ? "Railway" : "Local",
  });

  return new TelegramBot(AppConfig.BOT_TOKEN, botOptions);
}

// ⭐ 기존 인스턴스 정리 (재시도 포함)
async function performCleanupWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.info(`🧹 정리 시도 ${attempt}/${maxRetries}...`);

      if (bot) {
        await cleanupBot();
      }

      // Railway 환경에서는 더 긴 대기
      const waitTime = isRailway ? 8000 : 3000;
      Logger.info(`⏳ ${waitTime / 1000}초 대기...`);
      await sleep(waitTime);

      Logger.info("✅ 정리 완료");
      return;
    } catch (error) {
      Logger.warn(`⚠️ 정리 시도 ${attempt} 실패:`, error.message);

      if (attempt === maxRetries) {
        Logger.error("❌ 정리 최종 실패, 계속 진행...");
      } else {
        await sleep(2000 * attempt); // 백오프 대기
      }
    }
  }
}

// ⭐ 고급 에러 핸들러 설정
function setupAdvancedErrorHandlers() {
  // 409 충돌 전용 핸들러
  bot.on("polling_error", async (error) => {
    const errorCode = error.code;
    const statusCode = error.response?.body?.error_code;

    if (errorCode === "ETELEGRAM" && statusCode === 409) {
      Logger.error("🚨 409 충돌 감지! ConflictResolver 활성화...");

      try {
        const result = await conflictResolver.resolveConflict(error, {
          source: "polling_error",
          timestamp: Date.now(),
        });

        if (!result.success) {
          Logger.error("❌ ConflictResolver 실패:", result.reason);

          // 최후의 수단: Railway 환경에서는 프로세스 재시작
          if (isRailway && !isShuttingDown) {
            Logger.warn("🔄 프로세스 재시작으로 복구 시도...");
            setTimeout(() => process.exit(1), 10000);
          }
        }
      } catch (resolverError) {
        Logger.error("❌ ConflictResolver 예외:", resolverError);
      }
    } else if (errorCode === "EFATAL") {
      Logger.error("💀 치명적 오류:", error.message);
      await gracefulShutdown(1);
    } else if (errorCode === "ETIMEDOUT" || errorCode === "ECONNRESET") {
      Logger.warn("🌐 네트워크 오류:", error.message);
      // 네트워크 오류는 자동으로 재연결되므로 로그만 남김
    } else {
      Logger.error("⚠️ 폴링 오류:", {
        code: errorCode,
        message: error.message?.substring(0, 200),
        response: error.response?.body,
      });
    }
  });

  // 일반 봇 오류
  bot.on("error", (error) => {
    Logger.error("🔥 봇 일반 오류:", {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500),
    });
  });

  // 예상치 못한 예외 처리
  process.on("uncaughtException", (error) => {
    Logger.error("💥 처리되지 않은 예외:", error);

    if (!isShuttingDown) {
      Logger.error("🔄 5초 후 재시작...");
      setTimeout(() => process.exit(1), 5000);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    Logger.error("💥 처리되지 않은 Promise 거부:", reason);
  });

  Logger.info("🛡️ 고급 에러 핸들러 등록 완료");
}

// ⭐ 고급 해결사를 사용한 폴링 시작
async function startPollingWithAdvancedResolution() {
  const maxAttempts = isRailway ? 5 : 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      Logger.info(`🚀 폴링 시작 시도 ${attempt}/${maxAttempts}...`);

      // ConflictResolver를 통한 안전한 시작
      const preStartCheck = await conflictResolver.resolveConflict(
        new Error("Pre-start conflict resolution"),
        { preStart: true, attempt }
      );

      if (!preStartCheck.success) {
        throw new Error(`사전 충돌 해결 실패: ${preStartCheck.reason}`);
      }

      // 폴링 시작
      if (!bot.isPolling()) {
        await bot.startPolling();

        // 시작 확인 (3초 후)
        await sleep(3000);

        if (bot.isPolling()) {
          Logger.success("📡 폴링 시작 성공!");
          return true;
        } else {
          throw new Error("폴링 시작 확인 실패");
        }
      } else {
        Logger.info("📡 폴링이 이미 실행 중");
        return true;
      }
    } catch (error) {
      Logger.error(`❌ 폴링 시작 시도 ${attempt} 실패:`, error.message);

      // 409 에러인 경우 ConflictResolver 사용
      if (error.response?.body?.error_code === 409) {
        Logger.warn("🔧 409 에러로 인한 실패, ConflictResolver 실행...");

        try {
          await conflictResolver.resolveConflict(error, {
            source: "polling_start",
            attempt,
          });
        } catch (resolverError) {
          Logger.error("ConflictResolver 실행 실패:", resolverError);
        }
      }

      // 마지막 시도가 아니면 백오프 대기
      if (attempt < maxAttempts) {
        const backoffTime = Math.min(5000 * attempt, 30000);
        Logger.info(`⏳ ${backoffTime / 1000}초 후 재시도...`);
        await sleep(backoffTime);
      }
    }
  }

  throw new Error(`폴링 시작 최종 실패 (${maxAttempts}회 시도)`);
}

// ⭐ Railway 전용 최적화 설정
function setupRailwayOptimizations() {
  // 메모리 모니터링 및 정리
  setInterval(() => {
    const usage = process.memoryUsage();
    const totalMB = Math.round(usage.rss / 1024 / 1024);

    if (totalMB > 400) {
      // Railway 512MB 제한 고려
      Logger.warn(`🐏 메모리 사용량 높음: ${totalMB}MB`);

      // 가비지 컬렉션 강제 실행
      if (global.gc) {
        global.gc();
        Logger.info("🧹 가비지 컬렉션 실행");
      }
    }
  }, 60000);

  // ConflictResolver 상태 모니터링
  setInterval(() => {
    const status = conflictResolver.getStatus();

    if (!status.isHealthy) {
      Logger.warn("⚠️ ConflictResolver 상태 불량:", status);
    }

    // 통계 로깅 (5분마다)
    if (Date.now() % 300000 < 60000) {
      // 대략 5분마다
      const stats = conflictResolver.getStats();
      Logger.info("📊 ConflictResolver 통계:", {
        conflicts: stats.conflictCount,
        resolutions: stats.resolutionAttempts,
        uptime: `${Math.round(stats.uptimeMs / 60000)}분`,
      });
    }
  }, 60000);

  Logger.info("🚀 Railway 최적화 설정 완료");
}

// ⭐ 초기화 성공 로그
function logInitializationSuccess() {
  const status = conflictResolver.getStatus();

  Logger.info("🎉 초기화 완료 요약:");
  Logger.info(`  봇 상태: ${bot.isPolling() ? "폴링 중" : "대기 중"}`);
  Logger.info(`  충돌 해결사: ${status.isHealthy ? "정상" : "비정상"}`);
  Logger.info(`  환경: ${isRailway ? "Railway" : "로컬"}`);
  Logger.info(
    `  메모리: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
  );
}

// ⭐ 기존 함수들 (변경 없음)
function logSystemInfo() {
  const nodeVersion = process.version;
  const platform = process.platform;
  const arch = process.arch;
  const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);

  Logger.info("🔧 시스템 정보:");
  Logger.info(`  Node.js: ${nodeVersion}`);
  Logger.info(`  플랫폼: ${platform} (${arch})`);
  Logger.info(`  메모리: ${memory}MB`);
  Logger.info(`  환경: ${environment}`);

  if (isRailway) {
    Logger.info(`  Railway: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
  }
}

async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const shutdownTimeout = isRailway ? 25000 : 10000;
  Logger.info("🛑 봇 종료 프로세스 시작...");

  const shutdownTimer = setTimeout(() => {
    Logger.error("⏰ 종료 타임아웃! 강제 종료");
    process.exit(1);
  }, shutdownTimeout);

  try {
    // ConflictResolver 정리
    if (conflictResolver) {
      conflictResolver.cleanup();
    }

    // 컨트롤러 정리
    if (controller && typeof controller.cleanup === "function") {
      await controller.cleanup();
      Logger.info("🧹 컨트롤러 정리 완료");
    }

    // 봇 정리
    await cleanupBot();

    clearTimeout(shutdownTimer);
    Logger.success("✅ 우아한 종료 완료");
    process.exit(exitCode);
  } catch (error) {
    clearTimeout(shutdownTimer);
    Logger.error("❌ 종료 중 오류:", error);
    process.exit(1);
  }
}

async function cleanupBot() {
  if (bot) {
    try {
      if (bot.isPolling()) {
        await bot.stopPolling();
        Logger.info("⏹️ 폴링 중지 완료");
      }

      bot.removeAllListeners();
      Logger.info("🧹 이벤트 리스너 정리 완료");
    } catch (error) {
      Logger.error("❌ 봇 정리 실패:", error);
    } finally {
      bot = null;
      isInitialized = false;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ⭐ 신호 핸들러 설정
function setupSignalHandlers() {
  process.on("SIGINT", () => {
    Logger.info("📥 SIGINT 신호 수신");
    gracefulShutdown(0);
  });

  process.on("SIGTERM", () => {
    Logger.info("📥 SIGTERM 신호 수신");
    gracefulShutdown(0);
  });
}

// ⭐ 메인 함수
async function main() {
  try {
    Logger.info("=".repeat(50));
    Logger.info("🤖 두목봇 v3.0.1 시작 (409 해결사 포함)");
    Logger.info("=".repeat(50));

    // 신호 핸들러 설정
    setupSignalHandlers();

    // 봇 초기화 및 시작
    await initializeBot();

    Logger.success("🎉 두목봇이 성공적으로 시작되었습니다!");
    Logger.info("📱 텔레그램에서 /start 명령어로 봇을 사용하세요!");
  } catch (error) {
    Logger.error("❌ 봇 시작 실패:", error);

    if (isRailway) {
      Logger.warn("🔄 5초 후 Railway 자동 재시작...");
      setTimeout(() => process.exit(1), 5000);
    } else {
      process.exit(1);
    }
  }
}

// Railway 환경에서는 즉시 시작, 로컬에서는 잠시 대기
if (isRailway) {
  main();
} else {
  setTimeout(main, 2000); // 로컬에서는 2초 대기
}

// 프로세스 예외 처리
process.on("uncaughtException", (error) => {
  Logger.error("💥 처리되지 않은 예외:", error);

  if (!isShuttingDown) {
    gracefulShutdown(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  Logger.error("💥 처리되지 않은 Promise 거부:", reason);
});

module.exports = { bot, controller, conflictResolver };
