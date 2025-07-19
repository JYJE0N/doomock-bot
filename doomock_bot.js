// doomock_bot.js - 메인 엔트리 포인트 (수정된 버전)

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const Logger = require("./src/utils/Logger");
const AppConfig = require("./src/config/AppConfig"); // ✅ AppConfig 사용

// 봇 인스턴스 생성 (폴링 전용)
function createBot() {
  const token = AppConfig.BOT_TOKEN; // ✅ AppConfig에서 토큰 가져오기

  if (!token) {
    throw new Error("봇 토큰이 설정되지 않았습니다. BOT_TOKEN을 설정하세요.");
  }

  const bot = new TelegramBot(token, {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10,
      },
    },
  });

  Logger.info("봇 인스턴스 생성 완료 (폴링 모드)");
  return bot;
}

// 에러 핸들러
function setupErrorHandlers(bot) {
  // 처리되지 않은 Promise 거부
  process.on("unhandledRejection", (reason, promise) => {
    Logger.error("처리되지 않은 Promise 거부:", reason);
  });

  // 처리되지 않은 예외
  process.on("uncaughtException", (error) => {
    Logger.error("처리되지 않은 예외:", error);
    // 안전한 종료
    shutdown(bot, 1);
  });

  // 프로세스 종료 신호
  process.on("SIGINT", () => {
    Logger.info("SIGINT 신호 수신...");
    shutdown(bot, 0);
  });

  process.on("SIGTERM", () => {
    Logger.info("SIGTERM 신호 수신...");
    shutdown(bot, 0);
  });
}

// 안전한 종료
async function shutdown(bot, exitCode = 0) {
  try {
    Logger.info("봇 종료 시작...");

    if (bot) {
      // 폴링 중지
      if (bot.isPolling()) {
        await bot.stopPolling();
      }

      // BotController 종료
      if (bot.controller) {
        await bot.controller.shutdown();
      }
    }

    Logger.info("봇 종료 완료");
    process.exit(exitCode);
  } catch (error) {
    Logger.error("종료 중 오류:", error);
    process.exit(1);
  }
}

// 메인 함수
async function main() {
  try {
    Logger.info(`두목 봇 v${AppConfig.VERSION} 시작 중...`); // ✅ AppConfig 사용

    // AppConfig 설정 요약 로그
    const configSummary = AppConfig.getSummary();
    Logger.info("설정 요약:", configSummary);

    // 봇 인스턴스 생성
    const bot = createBot();

    // BotController 생성 및 초기화 (AppConfig 전달)
    const controller = new BotController(bot, AppConfig); // ✅ AppConfig 전체 전달

    // 컨트롤러를 봇에 연결 (종료 시 사용)
    bot.controller = controller;

    // 컨트롤러 초기화
    await controller.initialize();

    // 에러 핸들러 설정
    setupErrorHandlers(bot);

    Logger.success(`두목 봇 v${AppConfig.VERSION} 시작 완료! 🚀`);
    Logger.info(
      `환경: ${AppConfig.NODE_ENV} | Railway: ${AppConfig.isRailway ? "YES" : "NO"}`
    );
    Logger.info(`MongoDB: ${AppConfig.MONGO_URL ? "CONFIGURED" : "NOT_SET"}`);
    Logger.info("폴링 모드로 실행 중...");
  } catch (error) {
    Logger.error("봇 시작 실패:", error);
    process.exit(1);
  }
}

// 봇 시작
main();
