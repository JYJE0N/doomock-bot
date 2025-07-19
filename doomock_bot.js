// doomock_bot.js - 보안 강화 버전 (민감정보 로깅 방지)

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const AppConfig = require("./src/config/AppConfig");
const Logger = require("./src/utils/Logger");

// 전역 변수
let bot = null;
let controller = null;
let isShuttingDown = false;

/**
 * 봇 인스턴스 생성
 */
function createBot() {
  if (!AppConfig.BOT_TOKEN) {
    throw new Error("❌ BOT_TOKEN이 설정되지 않았습니다");
  }

  // 🔒 민감정보 로깅 방지: 토큰 정보를 로깅하지 않음
  Logger.info("🤖 텔레그램 봇 인스턴스 생성 중...");

  const botOptions = {
    polling: {
      interval: AppConfig.TELEGRAM.POLLING_INTERVAL,
      autoStart: true,
      params: {
        timeout: AppConfig.TELEGRAM.POLLING_TIMEOUT,
        allowed_updates: AppConfig.TELEGRAM.ALLOWED_UPDATES,
      },
    },
  };

  // 🔒 옵션 로깅 시 민감정보 제외
  Logger.info("봇 옵션:", {
    pollingInterval: botOptions.polling.interval,
    pollingTimeout: botOptions.polling.params.timeout,
    allowedUpdates: botOptions.polling.params.allowed_updates.join(","),
  });

  return new TelegramBot(AppConfig.BOT_TOKEN, botOptions);
}

/**
 * 봇 초기화
 */
async function initializeBot() {
  try {
    Logger.info("🚀 봇 초기화 시작...");

    // 봇 인스턴스 생성
    bot = createBot();

    // BotController 생성 및 초기화
    controller = new BotController(bot, AppConfig);

    // 상호 참조 설정 (종료 시 사용)
    bot.controller = controller;

    // 컨트롤러 초기화
    await controller.initialize();

    Logger.success("✅ 봇 초기화 완료");
  } catch (error) {
    Logger.errorSafe("❌ 봇 초기화 실패", error);
    throw error;
  }
}

/**
 * 🔒 보안 강화: 에러 핸들러 설정
 */
function setupErrorHandlers() {
  // 처리되지 않은 Promise 거부
  process.on("unhandledRejection", (reason, promise) => {
    Logger.errorSafe("처리되지 않은 Promise 거부", {
      reason: reason?.message || reason,
      stack: reason?.stack,
      code: reason?.code,
    });

    // 중요한 오류의 경우에만 종료
    if (reason?.code === "EFATAL") {
      shutdown(1);
    }
  });

  // 처리되지 않은 예외
  process.on("uncaughtException", (error) => {
    Logger.errorSafe("처리되지 않은 예외", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    // 안전한 종료
    shutdown(1);
  });

  // 프로세스 종료 신호
  process.on("SIGINT", () => {
    Logger.info("SIGINT 신호 수신 (Ctrl+C)...");
    shutdown(0);
  });

  process.on("SIGTERM", () => {
    Logger.info("SIGTERM 신호 수신 (Railway/Docker 종료)...");
    shutdown(0);
  });

  // Railway 특화 종료 신호
  if (AppConfig.isRailway) {
    process.on("SIGUSR2", () => {
      Logger.info("SIGUSR2 신호 수신 (Railway 재배포)...");
      shutdown(0);
    });
  }

  Logger.info("✅ 에러 핸들러 설정 완료");
}

// 안전한 종료
async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    Logger.warn("이미 종료 중입니다...");
    return;
  }

  isShuttingDown = true;
  Logger.info(`🛑 봇 종료 시작... (exitCode: ${exitCode})`);

  try {
    // 타임아웃 설정 (30초)
    const shutdownTimeout = setTimeout(() => {
      Logger.error("종료 타임아웃, 강제 종료");
      process.exit(1);
    }, 30000);

    // 봇 폴링 중지
    if (bot && bot.isPolling()) {
      Logger.info("봇 폴링 중지 중...");
      await bot.stopPolling();
      Logger.info("✅ 봇 폴링 중지 완료");
    }

    // BotController 종료
    if (controller) {
      Logger.info("BotController 종료 중...");
      await controller.shutdown();
      Logger.info("✅ BotController 종료 완료");
    }

    // 타임아웃 클리어
    clearTimeout(shutdownTimeout);

    Logger.success("✅ 봇 종료 완료");
    process.exit(exitCode);
  } catch (error) {
    Logger.errorSafe("종료 중 오류", error);
    process.exit(1);
  }
}

// 🔒 보안 강화: 시스템 정보 로깅 (민감정보 제외)
function logSystemInfo() {
  Logger.info(`🤖 두목 봇 v${AppConfig.VERSION} 시작`);
  Logger.info("=".repeat(50));

  // 🔒 시스템 환경 정보 (민감정보 없음)
  const envInfo = {
    NodeJS: process.version,
    Platform: process.platform,
    Architecture: process.arch,
    Environment: AppConfig.NODE_ENV,
    Railway: AppConfig.isRailway ? "YES" : "NO",
    Port: AppConfig.PORT,
    Memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    Uptime: `${Math.round(process.uptime())}초`,
  };

  Logger.info("🖥️ 시스템 정보:");
  Object.entries(envInfo).forEach(([key, value]) => {
    Logger.info(`  ${key}: ${value}`);
  });

  // 🔒 안전한 봇 설정만 로깅 (Logger.logEnvironmentSafe 사용)
  Logger.logEnvironmentSafe(AppConfig);
}

// 헬스 체크 포인트
function setupHealthCheck() {
  if (AppConfig.isRailway || AppConfig.SYSTEM.HEALTH_CHECK_ENABLED) {
    const http = require("http");
    const HealthMiddleware = require("./src/middleware/HealthMiddleware");

    const healthMiddleware = new HealthMiddleware();
    const server = http.createServer(healthMiddleware.createHandler());

    server.listen(AppConfig.PORT, () => {
      Logger.info(
        `🔍 헬스체크 서버 시작: http://localhost:${AppConfig.PORT}/health`
      );
      Logger.info("사용 가능한 엔드포인트:");
      Logger.info("  - GET /health (전체 상태)");
      Logger.info("  - GET /health?quick=true (빠른 상태)");
      Logger.info("  - GET /health/quick (빠른 상태)");
      Logger.info("  - GET /health/history (히스토리)");
      Logger.info("  - GET /ping (간단한 ping)");
    });

    // 서버 에러 핸들링
    server.on("error", (error) => {
      Logger.errorSafe("헬스체크 서버 오류", error);
    });

    // 정상 종료 시 서버도 함께 종료
    process.on("SIGTERM", () => {
      Logger.info("헬스체크 서버 종료 중...");
      server.close(() => {
        Logger.info("✅ 헬스체크 서버 종료 완료");
      });
    });

    return server;
  }

  return null;
}

// 봇 재시작 함수
async function restartBot() {
  try {
    Logger.info("🔄 봇 재시작 중...");

    // 기존 봇 종료
    if (bot && bot.isPolling()) {
      await bot.stopPolling();
    }

    if (controller) {
      await controller.shutdown();
    }

    // 새 봇 시작
    await initializeBot();

    Logger.success("✅ 봇 재시작 완료");
  } catch (error) {
    Logger.errorSafe("❌ 봇 재시작 실패", error);
    throw error;
  }
}

// 메인함수
async function main() {
  try {
    // 🔒 보안 강화된 시스템 정보 로깅
    logSystemInfo();

    // 에러 핸들러 설정
    setupErrorHandlers();

    // Railway 헬스체크 설정
    setupHealthCheck();

    // 봇 초기화
    await initializeBot();

    // 시작 완료 로깅
    Logger.success("=".repeat(50));
    Logger.success(`🚀 두목 봇 v${AppConfig.VERSION} 시작 완료!`);
    Logger.success("=".repeat(50));
    Logger.info("🔄 폴링 모드로 실행 중... (보안 로깅 적용됨)");

    // 주기적 메모리 정리 (프로덕션 환경)
    if (AppConfig.NODE_ENV === "production") {
      setInterval(() => {
        if (global.gc) {
          global.gc();
          Logger.debug("🧹 메모리 가비지 컬렉션 실행");
        }
      }, 300000); // 5분마다
    }

    // 🔒 보안: 정기적 민감정보 정리 (개발 환경에서만)
    if (AppConfig.isDevelopment) {
      setInterval(() => {
        // 메모리에서 민감정보 제거 (필요시)
        if (global.gc) {
          global.gc();
        }
      }, 600000); // 10분마다
    }
  } catch (error) {
    Logger.errorSafe("❌ 봇 시작 실패", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    // 시작 실패 시 종료
    process.exit(1);
  }
}

// 봇 시작
if (require.main === module) {
  main();
}

// 모듈로 사용할 때를 위한 exports
module.exports = {
  main,
  shutdown,
  restartBot,
  bot: () => bot,
  controller: () => controller,
};
