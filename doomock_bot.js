// doomock_bot.js - 개선된 메인 엔트리 포인트
require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const Logger = require("./src/utils/Logger");
const AppConfig = require("./src/config/AppConfig");

// 전역 변수
let bot = null;
let controller = null;
let isShuttingDown = false;

/**
 * 봇 인스턴스 생성 (폴링 전용)
 */
function createBot() {
  const token = AppConfig.BOT_TOKEN;

  if (!token) {
    throw new Error("봇 토큰이 설정되지 않았습니다. BOT_TOKEN을 설정하세요.");
  }

  // 봇 설정 최적화
  const botOptions = {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10,
        allowed_updates: ["message", "callback_query"], // 필요한 업데이트만 수신
      },
    },
    request: {
      agentOptions: {
        keepAlive: true,
        keepAliveMsecs: 10000,
      },
    },
  };

  const botInstance = new TelegramBot(token, botOptions);

  // 봇 이벤트 핸들러 설정
  botInstance.on("polling_error", error => {
    Logger.error("폴링 오류:", error);

    // 중요한 오류의 경우 재시작 시도
    if (error.code === "EFATAL" || error.code === "ETELEGRAM") {
      Logger.warn("중요한 폴링 오류 감지, 재시작 시도...");
      setTimeout(() => {
        if (!isShuttingDown) {
          restartBot();
        }
      }, 5000);
    }
  });

  Logger.info("봇 인스턴스 생성 완료 (폴링 모드)");
  return botInstance;
}

/**
 * 봇 재시작 함수
 */
async function restartBot() {
  try {
    Logger.info("봇 재시작 시작...");

    if (bot && bot.isPolling()) {
      await bot.stopPolling();
    }

    if (controller) {
      await controller.shutdown();
    }

    // 새 인스턴스 생성
    await initializeBot();

    Logger.success("봇 재시작 완료");
  } catch (error) {
    Logger.error("봇 재시작 실패:", error);
    process.exit(1);
  }
}

/**
 * 봇 초기화
 */
async function initializeBot() {
  try {
    // 봇 인스턴스 생성
    bot = createBot();

    // BotController 생성 및 초기화
    controller = new BotController(bot, AppConfig);

    // 상호 참조 설정 (종료 시 사용)
    bot.controller = controller;

    // 컨트롤러 초기화
    await controller.initialize();

    Logger.success("봇 초기화 완료");
  } catch (error) {
    Logger.error("봇 초기화 실패:", error);
    throw error;
  }
}

/**
 * 에러 핸들러 설정
 */
function setupErrorHandlers() {
  // 처리되지 않은 Promise 거부
  process.on("unhandledRejection", (reason, promise) => {
    Logger.error("처리되지 않은 Promise 거부:", {
      reason: reason,
      promise: promise,
      stack: reason?.stack,
    });

    // 중요한 오류의 경우에만 종료
    if (reason?.code === "EFATAL") {
      shutdown(1);
    }
  });

  // 처리되지 않은 예외
  process.on("uncaughtException", error => {
    Logger.error("처리되지 않은 예외:", {
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

  Logger.info("에러 핸들러 설정 완료");
}

/**
 * 안전한 종료
 */
async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    Logger.warn("이미 종료 중입니다...");
    return;
  }

  isShuttingDown = true;
  Logger.info(`봇 종료 시작... (exitCode: ${exitCode})`);

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
      Logger.info("봇 폴링 중지 완료");
    }

    // BotController 종료
    if (controller) {
      Logger.info("BotController 종료 중...");
      await controller.shutdown();
      Logger.info("BotController 종료 완료");
    }

    // 타임아웃 클리어
    clearTimeout(shutdownTimeout);

    Logger.success("봇 종료 완료");
    process.exit(exitCode);
  } catch (error) {
    Logger.error("종료 중 오류:", error);
    process.exit(1);
  }
}

/**
 * 시스템 정보 로깅
 */
function logSystemInfo() {
  Logger.info("=".repeat(50));
  Logger.info(`🤖 두목 봇 v${AppConfig.VERSION} 시작`);
  Logger.info("=".repeat(50));

  // 환경 정보
  const envInfo = {
    NodeJS: process.version,
    Platform: process.platform,
    Architecture: process.arch,
    Environment: AppConfig.NODE_ENV,
    Railway: AppConfig.isRailway ? "YES" : "NO",
    MongoDB: AppConfig.MONGO_URL ? "CONFIGURED" : "NOT_SET",
    Memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    Uptime: `${Math.round(process.uptime())}초`,
  };

  Logger.info("시스템 환경:", envInfo);

  // AppConfig 설정 요약 (민감한 정보 제외)
  try {
    const configSummary = AppConfig.getSummary();
    Logger.info("봇 설정 요약:", configSummary);
  } catch (error) {
    Logger.warn("설정 요약 로깅 실패:", error.message);
  }
}

/**
 * 헬스체크 엔드포인트 (Railway용)
 */
function setupHealthCheck() {
  if (AppConfig.isRailway || AppConfig.SYSTEM.HEALTH_CHECK_ENABLED) {
    const http = require("http");
    const HealthMiddleware = require("./src/middleware/HealthMiddleware");

    const healthMiddleware = new HealthMiddleware();
    const server = http.createServer(healthMiddleware.createHandler());

    server.listen(AppConfig.PORT, () => {
      Logger.info(
        `헬스체크 서버 시작: http://localhost:${AppConfig.PORT}/health`,
      );
      Logger.info("사용 가능한 엔드포인트:");
      Logger.info("  - GET /health (전체 상태)");
      Logger.info("  - GET /health?quick=true (빠른 상태)");
      Logger.info("  - GET /health/quick (빠른 상태)");
      Logger.info("  - GET /health/history (히스토리)");
      Logger.info("  - GET /ping (간단한 ping)");
    });

    // 서버 에러 핸들링
    server.on("error", error => {
      Logger.error("헬스체크 서버 오류:", error);
    });

    // 정상 종료 시 서버도 함께 종료
    process.on("SIGTERM", () => {
      Logger.info("헬스체크 서버 종료 중...");
      server.close(() => {
        Logger.info("헬스체크 서버 종료 완료");
      });
    });

    return server;
  }

  return null;
}

/**
 * 메인 함수
 */
async function main() {
  try {
    // 시스템 정보 로깅
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
    Logger.info("폴링 모드로 실행 중... (Ctrl+C로 종료)");

    // 주기적 메모리 정리 (선택사항)
    if (AppConfig.NODE_ENV === "production") {
      setInterval(() => {
        if (global.gc) {
          global.gc();
          Logger.debug("메모리 가비지 컬렉션 실행");
        }
      }, 300000); // 5분마다
    }
  } catch (error) {
    Logger.error("봇 시작 실패:", {
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
