// doomock_bot.js - Railway 409 충돌 해결 및 안정성 강화

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const AppConfig = require("./src/config/AppConfig");
const Logger = require("./src/utils/Logger");

// ⭐ 전역 변수 (싱글톤 패턴)
let bot = null;
let controller = null;
let isShuttingDown = false;
let isInitialized = false;

// ⭐ Railway 환경 감지
const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
const environment = process.env.NODE_ENV || "development";

// ⭐ 409 충돌 방지 및 봇 안전 초기화
async function initializeBot() {
  if (isInitialized) {
    Logger.warn("⚠️ 봇이 이미 초기화됨, 무시");
    return;
  }

  try {
    Logger.info("🚀 두목봇 초기화 시작...");
    logSystemInfo();

    // ⭐ 기존 인스턴스 정리 (Railway 충돌 방지)
    if (bot) {
      Logger.warn("🔄 기존 봇 인스턴스 정리 중...");
      await cleanupBot();
    }

    // ⭐ 봇 생성 (Railway 최적화 설정)
    bot = new TelegramBot(AppConfig.BOT_TOKEN, {
      polling: {
        interval: isRailway ? 3000 : 1000, // Railway는 3초, 로컬은 1초
        autoStart: false, // 수동 시작
        params: {
          timeout: 30, // 30초 타임아웃
          limit: 50, // 한 번에 50개 업데이트
          allowed_updates: ["message", "callback_query"], // 필요한 것만
        },
      },
      filepath: false, // 파일 업로드 비활성화 (Railway 메모리 절약)
      onlyFirstMatch: true, // 첫 번째 매치만 처리
    });

    // ⭐ 에러 핸들러 등록 (409 충돌 특별 처리)
    setupBotErrorHandlers();

    // ⭐ 컨트롤러 초기화
    controller = new BotController(bot, AppConfig);
    await controller.initialize();

    // ⭐ 안전한 폴링 시작
    await startPollingWithConflictResolution();

    isInitialized = true;
    Logger.success("✅ 두목봇 초기화 완료!");
  } catch (error) {
    Logger.error("❌ 봇 초기화 실패:", error);
    throw error;
  }
}

// ⭐ 봇 에러 핸들러 (409 충돌 해결 포함)
function setupBotErrorHandlers() {
  // 폴링 오류 처리
  bot.on("polling_error", async (error) => {
    const errorCode = error.code;
    const statusCode = error.response?.body?.error_code;

    if (errorCode === "ETELEGRAM" && statusCode === 409) {
      Logger.error("🚨 409 충돌 감지! 자동 해결 시도...");
      await handleConflictError();
    } else if (errorCode === "EFATAL") {
      Logger.error("💀 치명적 오류:", error.message);
      await gracefulShutdown(1);
    } else {
      Logger.error("⚠️ 폴링 오류:", {
        code: errorCode,
        message: error.message?.substring(0, 200),
      });
    }
  });

  // 일반 봇 오류
  bot.on("error", (error) => {
    Logger.error("🔥 봇 일반 오류:", error.message);
  });
}

// ⭐ 안전한 폴링 시작 (충돌 해결 포함)
async function startPollingWithConflictResolution(maxRetries = 3) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // ⭐ 기존 웹훅 완전 삭제 (충돌 방지)
      Logger.info("🧹 기존 웹훅 삭제 중...");
      await bot.deleteWebHook();

      // Railway에서는 더 긴 대기 시간
      const waitTime = isRailway ? 8000 : 3000;
      Logger.info(`⏳ ${waitTime / 1000}초 대기 중...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // 폴링 시작
      if (!bot.isPolling()) {
        await bot.startPolling();
        Logger.success("📡 폴링 시작 성공!");
        return true;
      }
    } catch (error) {
      retries++;
      const isConflict = error.response?.body?.error_code === 409;

      if (isConflict) {
        Logger.warn(`🔄 409 충돌 재시도 (${retries}/${maxRetries})`);
        const backoffTime = 5000 * retries; // 백오프 전략
        Logger.info(`⏳ ${backoffTime / 1000}초 후 재시도...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      } else {
        Logger.error(
          `❌ 폴링 시작 실패 (${retries}/${maxRetries}):`,
          error.message
        );
        if (retries >= maxRetries) {
          throw new Error(`폴링 시작 최대 재시도 초과: ${error.message}`);
        }
      }
    }
  }

  throw new Error("폴링 시작 최종 실패");
}

// ⭐ 409 충돌 오류 자동 해결
async function handleConflictError() {
  if (isShuttingDown) return;

  try {
    Logger.warn("🔧 409 충돌 해결 프로세스 시작...");

    // 1. 현재 폴링 중지
    if (bot && bot.isPolling()) {
      await bot.stopPolling();
      Logger.info("⏹️ 폴링 중지 완료");
    }

    // 2. Railway 환경에서는 더 긴 대기 (다른 인스턴스 종료 대기)
    const conflictWaitTime = isRailway ? 15000 : 10000;
    Logger.info(`⏳ 충돌 해결을 위해 ${conflictWaitTime / 1000}초 대기...`);
    await new Promise((resolve) => setTimeout(resolve, conflictWaitTime));

    // 3. 웹훅 강제 삭제
    try {
      await bot.deleteWebHook();
      Logger.info("🧹 웹훅 강제 삭제 완료");
    } catch (webhookError) {
      Logger.debug("웹훅 삭제 실패 (무시):", webhookError.message);
    }

    // 4. 폴링 재시작
    await startPollingWithConflictResolution();
    Logger.success("✅ 409 충돌 해결 완료!");
  } catch (error) {
    Logger.error("❌ 409 충돌 해결 실패:", error);

    // Railway 환경에서는 프로세스 재시작
    if (isRailway) {
      Logger.warn("🔄 Railway 프로세스 재시작...");
      process.exit(1); // Railway가 자동으로 재시작
    } else {
      throw error;
    }
  }
}

// ⭐ 시스템 정보 로깅 (보안 강화)
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
    Logger.info(`  Region: ${process.env.RAILWAY_REGION || "unknown"}`);
  }

  Logger.info(`  봇 토큰: ${AppConfig.BOT_TOKEN ? "설정됨 ✅" : "누락 ❌"}`);
}

// ⭐ 프로세스 신호 핸들러 (Railway 친화적)
function setupSignalHandlers() {
  // Railway 종료 신호
  process.on("SIGTERM", () => {
    Logger.info("📡 SIGTERM 신호 수신 - 우아한 종료 시작");
    gracefulShutdown(0);
  });

  // Ctrl+C 종료
  process.on("SIGINT", () => {
    Logger.info("📡 SIGINT 신호 수신 - 우아한 종료 시작");
    gracefulShutdown(0);
  });

  // Railway 재시작 신호
  process.on("SIGUSR2", () => {
    Logger.info("📡 SIGUSR2 신호 수신 - 봇 재시작");
    gracefulShutdown(0);
  });

  // 예외 처리
  process.on("uncaughtException", (error) => {
    Logger.error("💥 처리되지 않은 예외:", error);
    gracefulShutdown(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    Logger.error("💥 처리되지 않은 Promise 거부:", reason);
    Logger.error("📍 위치:", promise);
    gracefulShutdown(1);
  });
}

// ⭐ 우아한 종료 (Railway 최적화)
async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) {
    Logger.warn("⚠️ 이미 종료 프로세스 진행 중...");
    return;
  }

  isShuttingDown = true;
  const shutdownTimeout = isRailway ? 25000 : 10000; // Railway는 30초 제한

  Logger.info("🛑 봇 종료 프로세스 시작...");

  const shutdownTimer = setTimeout(() => {
    Logger.error("⏰ 종료 타임아웃! 강제 종료");
    process.exit(1);
  }, shutdownTimeout);

  try {
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

// ⭐ 봇 정리 함수
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

// ⭐ Railway 헬스체크 엔드포인트
function setupHealthCheck() {
  if (!isRailway) return;

  const http = require("http");
  const port = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      const status = {
        status: "ok",
        timestamp: new Date().toISOString(),
        bot_running: bot && bot.isPolling(),
        uptime: Math.round(process.uptime()),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        environment: environment,
        railway: isRailway,
      };

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify(status, null, 2));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(port, () => {
    Logger.info(`🏥 헬스체크 서버 실행: http://localhost:${port}/health`);
  });

  server.on("error", (error) => {
    Logger.error("헬스체크 서버 오류:", error);
  });

  return server;
}

// ⭐ Railway 메모리 모니터링
function setupMemoryMonitoring() {
  if (!isRailway) return;

  setInterval(() => {
    const usage = process.memoryUsage();
    const totalMB = Math.round(usage.rss / 1024 / 1024);
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);

    // Railway 512MB 제한 고려
    if (totalMB > 400) {
      Logger.warn(`🐏 메모리 사용량 높음: ${totalMB}MB (Heap: ${heapMB}MB)`);

      // 가비지 컬렉션 강제 실행
      if (global.gc) {
        global.gc();
        Logger.info("🧹 가비지 컬렉션 실행");
      }
    }
  }, 60000); // 1분마다 체크
}

// ⭐ 메인 함수
async function main() {
  try {
    Logger.info("=".repeat(50));
    Logger.info("🤖 두목봇 v3.0 시작");
    Logger.info("=".repeat(50));

    // 신호 핸들러 설정
    setupSignalHandlers();

    // Railway 최적화 설정
    if (isRailway) {
      setupHealthCheck();
      setupMemoryMonitoring();
    }

    // 봇 초기화 및 시작
    await initializeBot();

    Logger.success("🎉 두목봇이 성공적으로 시작되었습니다!");
    Logger.info("📱 텔레그램에서 /start 명령어로 봇을 사용하세요!");
  } catch (error) {
    Logger.error("❌ 봇 시작 최종 실패:", error);
    process.exit(1);
  }
}

// 봇 시작
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

// 모듈 exports
module.exports = {
  main,
  gracefulShutdown,
  bot: () => bot,
  controller: () => controller,
};
