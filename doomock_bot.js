// doomock_bot.js - 리팩토링된 Railway 봇 v3.0.1

// 1. 환경변수 최우선 로드
require("dotenv").config();

// 2. 핵심 모듈
const TelegramBot = require("node-telegram-bot-api");
const logger = require("./src/utils/Logger");
const TimeHelper = require("./src/utils/TimeHelper");
const AppConfig = require("./src/config/AppConfig");

/**
 * 두목봇 메인 클래스
 * - 싱글톤 패턴
 * - 의존성 주입 제거 (불필요한 복잡성)
 * - 직접적이고 명확한 초기화
 */
class DoomockBot {
  constructor() {
    // 싱글톤 패턴
    if (DoomockBot._instance) {
      logger.warn("⚠️ DoomockBot 이미 생성됨");
      return DoomockBot._instance;
    }

    // 인스턴스 변수
    this.bot = null;
    this.dbManager = null;
    this.moduleManager = null;
    this.botController = null;
    this.isInitialized = false;

    // 설정
    this.config = AppConfig;

    // 상태 추적
    this.startTime = Date.now();
    this.stats = {
      messagesReceived: 0,
      callbacksReceived: 0,
      errorsCount: 0,
    };

    DoomockBot._instance = this;
    logger.info(`🤖 DoomockBot v${this.config.VERSION} 생성됨`);
  }

  /**
   * 봇 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("⚠️ DoomockBot 이미 초기화됨");
      return;
    }

    try {
      logger.info("🚀 DoomockBot 초기화 시작...");
      logger.info(`📍 환경: ${this.config.RAILWAY.ENVIRONMENT || "Local"}`);
      logger.info(`📍 버전: v${this.config.VERSION}`);

      // 순차적 초기화
      await this.initializeTelegramBot();
      await this.initializeDatabase();
      await this.initializeModules();
      await this.initializeController();
      await this.startPolling();
      await this.sendStartupNotification();

      this.isInitialized = true;
      logger.success("🎉 DoomockBot 초기화 완료!");
    } catch (error) {
      logger.error("💥 DoomockBot 초기화 실패:", error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * 텔레그램 봇 초기화
   */
  async initializeTelegramBot() {
    try {
      logger.info("🤖 텔레그램 봇 생성 중...");

      // 토큰 확인
      if (!this.config.BOT_TOKEN) {
        throw new Error("BOT_TOKEN이 설정되지 않았습니다.");
      }

      // 봇 인스턴스 생성
      this.bot = new TelegramBot(this.config.BOT_TOKEN, {
        polling: false, // 나중에 시작
        filepath: false,
        onlyFirstMatch: true,
      });

      // 봇 정보 가져오기
      const botInfo = await this.bot.getMe();
      this.config.BOT_USERNAME = botInfo.username;

      logger.success(`✅ 텔레그램 봇 생성 완료: @${botInfo.username}`);
    } catch (error) {
      logger.error("❌ 텔레그램 봇 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 데이터베이스 초기화
   */
  async initializeDatabase() {
    try {
      // MongoDB 연결 설정이 없으면 스킵
      if (!this.config.MONGO_URL || this.config.MONGO_URL === "memory") {
        logger.warn("⚠️ MongoDB 설정 없음 - 메모리 모드로 실행");
        return;
      }

      logger.info("🗄️ 데이터베이스 연결 중...");

      const {
        DatabaseManager,
        getInstance,
      } = require("./src/database/DatabaseManager");
      this.dbManager = getInstance();

      await this.dbManager.connect();

      logger.success("✅ 데이터베이스 연결 성공");
    } catch (error) {
      logger.error("❌ 데이터베이스 연결 실패:", error);
      logger.warn("⚠️ 메모리 모드로 전환");
      // 데이터베이스 없이도 계속 실행
    }
  }

  /**
   * 모듈 매니저 초기화
   */
  async initializeModules() {
    try {
      logger.info("🧩 모듈 로딩 중...");

      const ModuleManager = require("./src/core/ModuleManager");

      this.moduleManager = new ModuleManager(this.bot, {
        db: this.dbManager?.db || null,
      });

      await this.moduleManager.initialize();

      const moduleCount = this.moduleManager.moduleInstances.size;
      logger.success(`✅ ${moduleCount}개 모듈 로드 완료`);
    } catch (error) {
      logger.error("❌ 모듈 초기화 실패:", error);
      logger.warn("⚠️ 기본 기능만으로 실행");
      // 모듈 없이도 기본 기능은 동작
    }
  }

  /**
   * 봇 컨트롤러 초기화
   */
  async initializeController() {
    try {
      logger.info("🎮 컨트롤러 설정 중...");

      const BotController = require("./src/controllers/BotController");

      this.botController = new BotController(this.bot, {
        dbManager: this.dbManager,
        moduleManager: this.moduleManager,
      });

      await this.botController.initialize();

      logger.success("✅ 컨트롤러 초기화 완료");
    } catch (error) {
      logger.error("❌ 컨트롤러 초기화 실패:", error);
      throw error; // 컨트롤러는 필수
    }
  }

  /**
   * 폴링 시작
   */
  async startPolling() {
    try {
      logger.info("📡 폴링 시작...");

      const pollingOptions = {
        interval: this.config.TELEGRAM.POLLING_INTERVAL || 300,
        params: {
          timeout: this.config.TELEGRAM.POLLING_TIMEOUT || 10,
        },
      };

      await this.bot.startPolling(pollingOptions);

      logger.success("✅ 폴링 시작됨");
    } catch (error) {
      logger.error("❌ 폴링 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 시작 알림 전송
   */
  async sendStartupNotification() {
    try {
      // 관리자 ID가 설정된 경우만
      if (!this.config.ADMIN_USER_ID) {
        return;
      }

      const uptime = process.uptime();
      const memUsage = process.memoryUsage();

      const startupMessage = `🚀 **봇 시작됨**

**환경 정보:**
• 버전: v${this.config.VERSION}
• 환경: ${this.config.RAILWAY.ENVIRONMENT || "Local"}
• Node: ${process.version}
• 시작 시간: ${TimeHelper.formatDate(new Date())}

**시스템 정보:**
• 메모리: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB
• 데이터베이스: ${this.dbManager ? "연결됨 ✅" : "미연결 ❌"}
• 모듈: ${this.moduleManager?.moduleInstances.size || 0}개

정상적으로 시작되었습니다!`;

      await this.bot.sendMessage(this.config.ADMIN_USER_ID, startupMessage, {
        parse_mode: "Markdown",
      });

      logger.info("📮 시작 알림 전송 완료");
    } catch (error) {
      logger.warn("시작 알림 전송 실패:", error.message);
      // 알림 실패는 무시
    }
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 정리 작업 시작...");

      // 종료 알림 전송 시도
      await this.sendShutdownNotification();

      // 폴링 중지
      if (this.bot) {
        logger.debug("📡 폴링 중지...");
        await this.bot.stopPolling();
      }

      // 컨트롤러 정리
      if (this.botController) {
        logger.debug("🎮 컨트롤러 정리...");
        await this.botController.cleanup();
      }

      // 모듈 정리
      if (this.moduleManager) {
        logger.debug("🧩 모듈 정리...");
        await this.moduleManager.cleanup();
      }

      // 데이터베이스 연결 해제
      if (this.dbManager) {
        logger.debug("🗄️ 데이터베이스 연결 해제...");
        await this.dbManager.disconnect();
      }

      this.isInitialized = false;
      logger.success("✅ 정리 작업 완료");
    } catch (error) {
      logger.error("❌ 정리 작업 중 오류:", error);
    }
  }

  /**
   * 종료 알림 전송
   */
  async sendShutdownNotification() {
    try {
      if (!this.config.ADMIN_USER_ID || !this.bot) {
        return;
      }

      const uptime = process.uptime();
      const runtime = this.formatUptime(uptime);

      const shutdownMessage = `🛑 **봇 종료**

• 실행 시간: ${runtime}
• 처리 메시지: ${this.stats.messagesReceived}개
• 처리 콜백: ${this.stats.callbacksReceived}개
• 오류 발생: ${this.stats.errorsCount}회

종료 시간: ${TimeHelper.formatDate(new Date())}`;

      await this.bot.sendMessage(this.config.ADMIN_USER_ID, shutdownMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      // 종료 알림 실패는 무시
    }
  }

  /**
   * 가동 시간 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 상태 정보 조회
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      uptime: process.uptime(),
      stats: this.stats,
      modules: this.moduleManager?.getStatus(),
      database: this.dbManager?.isConnected() || false,
      environment: this.config.RAILWAY.ENVIRONMENT || "Local",
    };
  }
}

// ===== 메인 실행 함수 =====

async function main() {
  try {
    logger.info("============================================");
    logger.info(`🎬 두목봇 v${AppConfig.VERSION} 시작`);
    logger.info(`📍 환경: ${AppConfig.RAILWAY.ENVIRONMENT || "Local"}`);
    logger.info(
      `📍 커밋: ${AppConfig.RAILWAY.GIT_COMMIT_SHA?.slice(0, 7) || "unknown"}`
    );
    logger.info("============================================");

    // 봇 인스턴스 생성
    const doomockBot = new DoomockBot();

    // 종료 시그널 처리
    const gracefulShutdown = async (signal) => {
      logger.info(`\n🛑 ${signal} 신호 받음...`);
      await doomockBot.cleanup();
      process.exit(0);
    };

    // 시그널 핸들러 등록
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // 에러 핸들러
    process.on("uncaughtException", (error) => {
      logger.error("💥 처리되지 않은 예외:", error);
      gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 처리되지 않은 Promise 거부:", reason);
    });

    // 봇 초기화
    await doomockBot.initialize();

    logger.success("============================================");
    logger.success("🎉 두목봇이 성공적으로 시작되었습니다!");
    logger.success("============================================");
  } catch (error) {
    logger.error("💥 봇 시작 실패:", error);
    process.exit(1);
  }
}

// 직접 실행시만 main 함수 호출
if (require.main === module) {
  main();
}

module.exports = DoomockBot;
