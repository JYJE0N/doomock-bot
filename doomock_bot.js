// ultimate_409_fix.js - 웹훅 완전 제거 및 409 근본 해결

const TelegramBot = require("node-telegram-bot-api");
const BotController = require("./src/controllers/BotController");
const AppConfig = require("./src/config/AppConfig");
const Logger = require("./src/utils/Logger");

// ⭐ 전역 변수 (싱글톤 패턴)
let bot = null;
let controller = null;
let isShuttingDown = false;
let isInitialized = false;
let forceWebhookCleared = false;

// ⭐ Railway 환경 감지
const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
const environment = process.env.NODE_ENV || "development";

// 🚨 STEP 1: 웹훅 완전 제거 함수
async function forceRemoveWebhook() {
  if (forceWebhookCleared) {
    Logger.info("웹훅이 이미 제거됨, 건너뛰기");
    return true;
  }

  try {
    Logger.info("🧹 웹훅 강제 완전 제거 시작...");

    // 임시 봇 인스턴스로 웹훅 제거
    const tempBot = new TelegramBot(AppConfig.BOT_TOKEN, { polling: false });

    // 1. 현재 웹훅 정보 확인
    try {
      const webhookInfo = await tempBot.getWebHookInfo();
      Logger.info("현재 웹훅 정보:", webhookInfo);

      if (webhookInfo.url) {
        Logger.warn(`활성 웹훅 발견: ${webhookInfo.url}`);
      }
    } catch (error) {
      Logger.debug("웹훅 정보 조회 실패 (무시):", error.message);
    }

    // 2. 웹훅 삭제 (여러 번 시도)
    const maxRetries = 5;
    let success = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        Logger.info(`웹훅 삭제 시도 ${i + 1}/${maxRetries}...`);

        // dropPendingUpdates: true로 대기 중인 업데이트도 모두 삭제
        await tempBot.deleteWebHook({ drop_pending_updates: true });

        // 삭제 확인
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const checkInfo = await tempBot.getWebHookInfo();
        if (!checkInfo.url) {
          success = true;
          Logger.success("✅ 웹훅 완전 삭제 성공!");
          break;
        } else {
          Logger.warn(`여전히 웹훅 존재: ${checkInfo.url}`);
        }
      } catch (error) {
        Logger.warn(`웹훅 삭제 시도 ${i + 1} 실패:`, error.message);

        if (i < maxRetries - 1) {
          const waitTime = (i + 1) * 3000; // 3초, 6초, 9초...
          Logger.info(`${waitTime / 1000}초 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    if (success) {
      forceWebhookCleared = true;

      // Railway 환경에서는 더 긴 대기
      const finalWait = isRailway ? 15000 : 8000;
      Logger.info(`✅ 웹훅 제거 완료! ${finalWait / 1000}초 추가 대기...`);
      await new Promise((resolve) => setTimeout(resolve, finalWait));

      return true;
    } else {
      Logger.error("❌ 웹훅 제거 최종 실패");
      return false;
    }
  } catch (error) {
    Logger.error("❌ 웹훅 제거 과정 오류:", error);
    return false;
  }
}

// 🚨 STEP 2: 안전한 봇 초기화
async function initializeBot() {
  if (isInitialized) {
    Logger.warn("⚠️ 봇이 이미 초기화됨, 무시");
    return;
  }

  try {
    Logger.info("🚀 두목봇 궁극적 초기화 시작...");
    logSystemInfo();

    // STEP 1: 웹훅 완전 제거
    const webhookRemoved = await forceRemoveWebhook();
    if (!webhookRemoved) {
      throw new Error("웹훅 제거 실패로 초기화 중단");
    }

    // STEP 2: 기존 인스턴스 완전 정리
    if (bot) {
      Logger.warn("🔄 기존 봇 인스턴스 정리 중...");
      await cleanupBot();
    }

    // STEP 3: 새 봇 인스턴스 생성 (폴링 전용)
    bot = new TelegramBot(AppConfig.BOT_TOKEN, {
      polling: {
        interval: isRailway ? 5000 : 2000, // 더 긴 간격
        autoStart: false, // 수동 시작
        params: {
          timeout: isRailway ? 50 : 30, // 더 긴 타임아웃
          limit: isRailway ? 20 : 30, // 더 적은 메시지 처리
          allowed_updates: ["message", "callback_query"],
          offset: -1, // 이전 업데이트 무시
        },
      },
      filepath: false,
      onlyFirstMatch: true,
      request: {
        agentOptions: {
          keepAlive: false, // 연결 재사용 비활성화
        },
        timeout: isRailway ? 50000 : 30000,
      },
    });

    // STEP 4: 강화된 에러 핸들러
    setupUltimateErrorHandlers();

    // STEP 5: 컨트롤러 초기화
    controller = new BotController(bot, AppConfig);
    await controller.initialize();

    // STEP 6: 단계적 폴링 시작
    await startPollingWithUltimateCheck();

    isInitialized = true;
    Logger.success("✅ 두목봇 궁극적 초기화 완료!");
  } catch (error) {
    Logger.error("❌ 봇 초기화 실패:", error);

    // Railway 환경에서는 완전 재시작
    if (isRailway && !isShuttingDown) {
      Logger.warn("🔄 Railway 완전 재시작...");
      process.exit(1); // Railway가 새 인스턴스로 재시작
    }

    throw error;
  }
}

// 🚨 STEP 3: 궁극적 에러 핸들러
function setupUltimateErrorHandlers() {
  let conflictCount = 0;
  let lastConflictTime = 0;

  // 409 에러 특화 핸들러
  bot.on("polling_error", async (error) => {
    const errorCode = error.code;
    const statusCode = error.response?.body?.error_code;
    const now = Date.now();

    if (errorCode === "ETELEGRAM" && statusCode === 409) {
      conflictCount++;
      lastConflictTime = now;

      Logger.error(`🚨 409 충돌 #${conflictCount} 감지!`);

      // 연속 충돌 시 강력한 조치
      if (conflictCount >= 3) {
        Logger.error("🚨 연속 409 충돌! 강력한 복구 시작...");
        await handleCriticalConflict();
      } else {
        await handleSingleConflict();
      }
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

  // 충돌 카운트 리셋 (5분마다)
  setInterval(() => {
    if (now - lastConflictTime > 300000) {
      // 5분
      conflictCount = 0;
    }
  }, 60000);
}

// 🚨 STEP 4: 단일 충돌 처리
async function handleSingleConflict() {
  try {
    Logger.info("🔧 단일 409 충돌 해결 시작...");

    // 1. 폴링 중지
    if (bot && bot.isPolling()) {
      await bot.stopPolling();
      Logger.info("⏹️ 폴링 중지 완료");
    }

    // 2. 대기 (Railway는 더 길게)
    const waitTime = isRailway ? 20000 : 10000;
    Logger.info(`⏳ ${waitTime / 1000}초 대기...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 3. 웹훅 재삭제
    await forceRemoveWebhook();

    // 4. 폴링 재시작
    if (!bot.isPolling()) {
      await bot.startPolling();
      Logger.success("✅ 폴링 재시작 성공");
    }
  } catch (error) {
    Logger.error("❌ 단일 충돌 해결 실패:", error);
    throw error;
  }
}

// 🚨 STEP 5: 치명적 충돌 처리
async function handleCriticalConflict() {
  try {
    Logger.error("🚨 치명적 409 충돌 해결 시작...");

    // 1. 완전한 봇 정리
    await cleanupBot();

    // 2. 웹훅 강제 제거
    forceWebhookCleared = false; // 재설정
    await forceRemoveWebhook();

    // 3. Railway 환경에서는 프로세스 재시작
    if (isRailway) {
      Logger.error("🔄 Railway 프로세스 재시작 필요...");
      setTimeout(() => {
        process.exit(1); // Railway 재시작
      }, 5000);
      return;
    }

    // 4. 로컬에서는 봇 재초기화
    isInitialized = false;
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30초 대기
    await initializeBot();
  } catch (error) {
    Logger.error("❌ 치명적 충돌 해결 실패:", error);

    if (isRailway) {
      process.exit(1); // 최후의 수단
    }
  }
}

// 🚨 STEP 6: 단계적 폴링 시작
async function startPollingWithUltimateCheck() {
  try {
    Logger.info("🚀 단계적 폴링 시작...");

    // 1. 봇 상태 확인
    const botInfo = await bot.getMe();
    Logger.info(`🤖 봇 정보 확인: ${botInfo.username} (ID: ${botInfo.id})`);

    // 2. 웹훅 최종 확인
    const webhookInfo = await bot.getWebHookInfo();
    if (webhookInfo.url) {
      Logger.error(`🚨 웹훅이 여전히 존재: ${webhookInfo.url}`);
      throw new Error("웹훅 제거 불완전");
    }
    Logger.success("✅ 웹훅 없음 확인");

    // 3. 폴링 시작
    if (!bot.isPolling()) {
      await bot.startPolling();

      // 4. 폴링 상태 확인 (5초 후)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (bot.isPolling()) {
        Logger.success("📡 폴링 시작 및 안정성 확인 완료!");
      } else {
        throw new Error("폴링 시작 후 상태 불안정");
      }
    } else {
      Logger.info("📡 폴링이 이미 실행 중");
    }
  } catch (error) {
    Logger.error("❌ 단계적 폴링 시작 실패:", error);
    throw error;
  }
}

// 기존 함수들 (변경 없음)
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

  Logger.info("🛑 봇 종료 프로세스 시작...");

  try {
    if (controller && typeof controller.cleanup === "function") {
      await controller.cleanup();
    }
    await cleanupBot();
    Logger.success("✅ 우아한 종료 완료");
    process.exit(exitCode);
  } catch (error) {
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

// 신호 핸들러
function setupSignalHandlers() {
  process.on("SIGINT", () => gracefulShutdown(0));
  process.on("SIGTERM", () => gracefulShutdown(0));

  process.on("uncaughtException", (error) => {
    Logger.error("💥 처리되지 않은 예외:", error);
    if (!isShuttingDown) gracefulShutdown(1);
  });

  process.on("unhandledRejection", (reason) => {
    Logger.error("💥 처리되지 않은 Promise 거부:", reason);
  });
}

// 메인 함수
async function main() {
  try {
    Logger.info("=".repeat(50));
    Logger.info("🚨 두목봇 궁극적 409 해결 버전 시작");
    Logger.info("=".repeat(50));

    setupSignalHandlers();
    await initializeBot();

    Logger.success("🎉 두목봇이 성공적으로 시작되었습니다!");
    Logger.info("📱 텔레그램에서 /start 명령어로 봇을 사용하세요!");
  } catch (error) {
    Logger.error("❌ 봇 시작 실패:", error);

    if (isRailway) {
      Logger.warn("🔄 10초 후 Railway 재시작...");
      setTimeout(() => process.exit(1), 10000);
    } else {
      process.exit(1);
    }
  }
}

// 즉시 시작
main().catch((error) => {
  console.error("❌ 메인 함수 실행 실패:", error);
  process.exit(1);
});

module.exports = { bot: () => bot, controller: () => controller };
// ⭐ 표준 액션 처리
