// doomock_bot.js - 메인 엔트리 포인트 (초기화 순서 수정)

const TelegramBot = require("node-telegram-bot-api");
const logger = require("./src/utils/Logger");
const { AppConfig } = require("./src/config/AppConfig");

/**
 * 🚀 Doomock Bot - 메인 클래스
 *
 * 초기화 순서:
 * 1. 설정 로드
 * 2. 데이터베이스 연결
 * 3. 모듈 로더 초기화
 * 4. 모듈 매니저 초기화
 * 5. 봇 컨트롤러 초기화
 * 6. 명령어 등록
 * 7. 봇 시작
 */
class DoomockBot {
  constructor() {
    this.config = null;
    this.bot = null;
    this.dbManager = null;
    this.moduleManager = null;
    this.botController = null;
    this.commandsRegistry = null;
    this.isInitialized = false;

    logger.info("🤖 DoomockBot 인스턴스 생성");
  }

  /**
   * 🚀 봇 시작
   */
  async start() {
    try {
      logger.info("============================================");
      logger.info("🚀 Doomock Bot v3.0.1 시작");
      logger.info("============================================");

      // ✅ 1단계: 설정 로드
      await this.loadConfig();

      // ✅ 2단계: 텔레그램 봇 초기화
      await this.initializeBot();

      // ✅ 3단계: 데이터베이스 연결
      await this.initializeDatabase();

      // ✅ 4단계: 명령어 레지스트리 초기화
      await this.initializeCommandsRegistry();

      // ✅ 5단계: 모듈 매니저 초기화
      await this.initializeModules();

      // ✅ 6단계: 봇 컨트롤러 초기화
      await this.initializeController();

      // ✅ 7단계: BotFather 명령어 등록
      await this.registerBotCommands();

      // ✅ 8단계: 봇 폴링 시작
      await this.startPolling();

      this.isInitialized = true;

      logger.success("============================================");
      logger.success("✅ Doomock Bot 시작 완료!");
      logger.success("============================================");
    } catch (error) {
      logger.error("💥 봇 시작 실패:", error);
      process.exit(1);
    }
  }

  /**
   * 📄 설정 로드
   */
  async loadConfig() {
    try {
      logger.info("⚙️ 설정 로드 중...");

      this.config = AppConfig.getConfig();

      logger.info(`   🌍 환경: ${this.config.isRailway ? "Railway" : "로컬"}`);
      logger.info(
        `   🔐 토큰: ${this.config.botToken ? "✅ 설정됨" : "❌ 없음"}`
      );
      logger.info(
        `   💾 DB: ${this.config.database.uri ? "✅ 설정됨" : "❌ 없음"}`
      );

      if (!this.config.botToken) {
        throw new Error("BOT_TOKEN이 설정되지 않았습니다");
      }

      logger.success("✅ 설정 로드 완료");
    } catch (error) {
      logger.error("❌ 설정 로드 실패:", error);
      throw error;
    }
  }

  /**
   * 🤖 텔레그램 봇 초기화
   */
  async initializeBot() {
    try {
      logger.info("🤖 텔레그램 봇 초기화 중...");

      this.bot = new TelegramBot(this.config.botToken, {
        polling: false, // ✅ 나중에 수동으로 시작
        request: {
          agentOptions: {
            keepAlive: true,
            family: 4,
          },
        },
      });

      // ✅ 봇 정보 가져오기
      const botInfo = await this.bot.getMe();
      logger.info(`   🎭 봇 이름: ${botInfo.first_name}`);
      logger.info(`   🏷️ 사용자명: @${botInfo.username}`);
      logger.info(`   🆔 봇 ID: ${botInfo.id}`);

      logger.success("✅ 텔레그램 봇 초기화 완료");
    } catch (error) {
      logger.error("❌ 텔레그램 봇 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 💾 데이터베이스 연결
   */
  async initializeDatabase() {
    try {
      logger.info("💾 데이터베이스 연결 중...");

      if (!this.config.database.uri) {
        logger.warn("⚠️ 데이터베이스 URI가 설정되지 않음 - DB 없이 실행");
        return;
      }

      // ✅ 구조 분해 할당으로 DatabaseManager 가져오기
      // const { DatabaseManager } = require("./src/database/DatabaseManager");
      // this.dbManager = new DatabaseManager(this.config.database.uri);

      // ✅ 싱글톤 인스턴스 사용
      const { getInstance } = require("./src/database/DatabaseManager");
      this.dbManager = getInstance();

      await this.dbManager.connect();
      logger.success("✅ 데이터베이스 연결 완료");
    } catch (error) {
      logger.error("❌ 데이터베이스 연결 실패:", error);
      logger.warn("⚠️ 데이터베이스 없이 계속 진행");
      this.dbManager = null;
    }
  }

  /**
   * 📋 명령어 레지스트리 초기화
   */
  async initializeCommandsRegistry() {
    try {
      logger.info("📋 명령어 레지스트리 초기화 중...");

      const BotCommandsRegistry = require("./src/config/BotCommandsRegistry");
      this.commandsRegistry = new BotCommandsRegistry();

      logger.success("✅ 명령어 레지스트리 초기화 완료");
    } catch (error) {
      logger.error("❌ 명령어 레지스트리 초기화 실패:", error);
      logger.warn("⚠️ 명령어 등록 없이 계속 진행");
      this.commandsRegistry = null;
    }
  }

  /**
   * 📦 모듈 매니저 초기화
   */
  async initializeModules() {
    try {
      logger.info("📦 모듈 매니저 초기화 중...");

      const ModuleManager = require("./src/core/ModuleManager");

      this.moduleManager = new ModuleManager(this.bot, {
        db: this.dbManager,
        config: this.config,
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
   * 🎮 봇 컨트롤러 초기화
   */
  async initializeController() {
    try {
      logger.info("🎮 컨트롤러 설정 중...");

      const BotController = require("./src/controllers/BotController");

      this.botController = new BotController(this.bot, {
        dbManager: this.dbManager,
        moduleManager: this.moduleManager,
        commandsRegistry: this.commandsRegistry, // ✅ 추가
        config: {
          messageTimeout: 5000,
          callbackTimeout: 1000,
          maxRetries: 3,
        },
      });

      await this.botController.initialize();

      logger.success("✅ 컨트롤러 초기화 완료");
    } catch (error) {
      logger.error("❌ 컨트롤러 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 📋 BotFather 명령어 등록
   */
  async registerBotCommands() {
    if (!this.commandsRegistry) {
      logger.info("📋 명령어 레지스트리가 없어 명령어 등록 건너뜀");
      return;
    }

    try {
      logger.info("📋 BotFather 명령어 등록 중...");

      const success = await this.commandsRegistry.setBotFatherCommands(
        this.bot
      );

      if (success) {
        const stats = this.commandsRegistry.getCommandStats();
        logger.success("✅ BotFather 명령어 등록 완료");
        logger.info(
          `   📊 총 ${stats.totalCommands}개 명령어 (공개: ${stats.publicCommands}개)`
        );
        logger.info(`   🏛️ 시스템: ${stats.systemCommands}개`);
        logger.info(`   📦 모듈: ${stats.moduleCommands}개`);
        logger.info(`   🔧 관리자: ${stats.adminCommands}개`);
      } else {
        logger.warn("⚠️ BotFather 명령어 등록 실패 - 계속 진행");
      }
    } catch (error) {
      logger.error("❌ BotFather 명령어 등록 중 오류:", error);
      logger.warn("⚠️ 명령어 등록 실패 - 계속 진행");
    }
  }

  /**
   * 🔄 봇 폴링 시작
   */
  async startPolling() {
    try {
      logger.info("🔄 봇 폴링 시작 중...");

      // ✅ 폴링 옵션 설정
      const pollingOptions = {
        interval: 300,
        autoStart: false,
        params: {
          timeout: 10,
        },
      };

      // ✅ 폴링 시작
      await this.bot.startPolling(pollingOptions);

      logger.success("✅ 봇 폴링 시작 완료");
      logger.info("   🎯 메시지 수신 대기 중...");
    } catch (error) {
      logger.error("❌ 봇 폴링 시작 실패:", error);
      throw error;
    }
  }

  /**
   * ⏹️ 봇 정리 및 종료
   */
  async stop() {
    try {
      logger.info("⏹️ 봇 종료 중...");

      // 폴링 중지
      if (this.bot) {
        await this.bot.stopPolling();
        logger.info("✅ 폴링 중지 완료");
      }

      // 컨트롤러 정리
      if (this.botController) {
        await this.botController.cleanup();
      }

      // 모듈 매니저 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      logger.success("✅ 봇 정리 완료");
    } catch (error) {
      logger.error("❌ 봇 정리 중 오류:", error);
    }
  }

  /**
   * 📊 봇 상태 조회
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      config: {
        environment: this.config?.isRailway ? "Railway" : "Local",
        hasDatabase: !!this.dbManager,
        hasModules: !!this.moduleManager,
      },
      controller: this.botController?.getStatus() || null,
      modules: this.moduleManager?.getModuleStatus() || null,
    };
  }
}

/**
 * 🚀 메인 실행 함수
 */
async function main() {
  // ✅ 종료 신호 처리
  const bot = new DoomockBot();

  // 프로세스 종료 신호 처리
  process.on("SIGINT", async () => {
    logger.info("🛑 SIGINT 신호 수신 - 정리 시작");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("🛑 SIGTERM 신호 수신 - 정리 시작");
    await bot.stop();
    process.exit(0);
  });

  // 처리되지 않은 예외 처리
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("💥 처리되지 않은 Promise 거부:", reason);
    logger.error("   위치:", promise);
  });

  process.on("uncaughtException", (error) => {
    logger.error("💥 처리되지 않은 예외:", error);
    process.exit(1);
  });

  // ✅ 봇 시작
  await bot.start();
}

// 직접 실행시만 main 함수 호출
if (require.main === module) {
  main().catch((error) => {
    logger.error("💥 메인 함수 실행 실패:", error);
    process.exit(1);
  });
}

module.exports = DoomockBot;
