// doomock_bot.js - 메인 엔트리 포인트 (버전 3 - 폴링 전용)

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const Logger = require("./src/utils/Logger");
const config = require("./src/config/config");

// 환경 변수 검증
function validateEnvironment() {
  // 텔레그램 봇 토큰 확인 (여러 변수명 지원)
  const token = process.env.BOT_TOKEN || process.env.BOT_TOKEN;
  // MongoDB URI 확인 (여러 변수명 지원)
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!token) {
    throw new Error(
      "봇 토큰이 설정되지 않았습니다. TELEGRAM_BOT_TOKEN 또는 BOT_TOKEN을 설정하세요."
    );
  }

  if (!mongoUri) {
    throw new Error(
      "MongoDB URI가 설정되지 않았습니다. MONGODB_URI, MONGO_URL, 또는 DATABASE_URL을 설정하세요."
    );
  }

  // 환경변수를 global로 설정 (다른 곳에서 사용하기 위해)
  process.env.BOT_TOKEN = token;
  process.env.MONGODB_URI = mongoUri;
}

// 봇 인스턴스 생성 (폴링 전용)
function createBot() {
  const token = process.env.BOT_TOKEN;

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
    Logger.info(`${config.bot.name} v${config.bot.version} 시작 중...`);

    // 환경 변수 검증
    validateEnvironment();

    // 봇 인스턴스 생성
    const bot = createBot();

    // BotController 생성 및 초기화
    const controller = new BotController(bot, {
      mongoUri: process.env.MONGODB_URI,
      adminIds: process.env.ADMIN_IDS?.split(",") || [],
      environment: "development",
    });

    // 컨트롤러를 봇에 연결 (종료 시 사용)
    bot.controller = controller;

    // 컨트롤러 초기화
    await controller.initialize();

    // 에러 핸들러 설정
    setupErrorHandlers(bot);

    Logger.success(`${config.bot.name} v${config.bot.version} 시작 완료! 🚀`);
    Logger.info("폴링 모드로 실행 중...");
  } catch (error) {
    Logger.error("봇 시작 실패:", error);
    process.exit(1);
  }
}

// 봇 시작
main();
