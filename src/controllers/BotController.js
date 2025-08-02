// src/controllers/BotController.js - 🤖 Mongoose 전용 봇 컨트롤러

const { Telegraf } = require("telegraf");
const express = require("express");
const path = require("path");
const logger = require("../utils/Logger");
const {
  getInstance: getMongooseManager,
} = require("../database/MongooseManager");
const { createServiceBuilder } = require("../core/ServiceBuilder");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");

// 🎯 관심사 분리 - 전문 컴포넌트 import
const ErrorHandler = require("../handlers/ErrorHandler");
const MarkdownHelper = require("../utils/MarkdownHelper");

/**
 * 🤖 BotController - 텔레그램 봇 중앙 제어 시스템 (Mongoose 전용)
 *
 * ✅ 주요 변경사항:
 * - MongoDB Native Driver 완전 제거
 * - Mongoose만 사용하여 단순화
 * - 데이터베이스 연결 로직 간소화
 */
class BotController {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.navigationHandler = null;
    this.mongooseManager = null;
    this.serviceBuilder = null;
    this.isInitialized = false;
    this.cleanupInProgress = false;
    this.errorHandler = null;
    this.markdownHelper = null;

    // Express 서버 추가
    this.app = null;
    this.server = null;

    // 통계
    this.stats = {
      messagesProcessed: 0,
      callbacksProcessed: 0,
      errorsCount: 0,
      startTime: new Date(),
    };

    logger.info("🤖 BotController 인스턴스 생성됨 (Mongoose 전용)");
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    try {
      logger.info("🤖 BotController 초기화 시작...");

      // 1. 환경변수 검증
      this.validateEnvironment();

      // 2. 텔레그램 봇 생성
      this.bot = new Telegraf(process.env.BOT_TOKEN);
      logger.info("✅ 텔레그램 봇 인스턴스 생성됨");

      // 3. Mongoose 초기화 (단일 데이터베이스 연결)
      await this.initializeDatabase();

      // 4. 핸들러와 매니저 초기화
      await this.initializeHandlers();

      // 5. 미들웨어 설정
      this.setupMiddlewares();

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌐 Express 서버 초기화
   */
  async initializeExpressServer() {
    try {
      logger.info("🌐 Express 서버 초기화 중...");

      this.app = express();

      // 기본 미들웨어
      this.app.use(express.json());
      this.app.use(express.urlencoded({ extended: true }));

      // CORS 설정 (필요한 경우)
      this.app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        next();
      });

      // Static 파일 제공 설정
      const publicPath = path.join(process.cwd(), "public");

      // public 디렉토리가 없으면 생성
      const fs = require("fs");
      if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
        logger.info(`📁 public 디렉토리 생성: ${publicPath}`);
      }

      // TTS 디렉토리 생성
      const ttsPath = path.join(publicPath, "tts");
      if (!fs.existsSync(ttsPath)) {
        fs.mkdirSync(ttsPath, { recursive: true });
        logger.info(`📁 TTS 디렉토리 생성: ${ttsPath}`);
      }

      // Static 미들웨어 설정
      this.app.use(express.static(publicPath));
      this.app.use("/tts", express.static(ttsPath));

      logger.info(`📁 Static 파일 제공: ${publicPath}`);
      logger.info(`🎵 TTS 파일 제공: ${ttsPath}`);

      // 루트 엔드포인트
      this.app.get("/", (req, res) => {
        res.json({
          name: "DoomockBot API",
          version: "3.0.1",
          status: "running",
          timestamp: new Date().toISOString(),
        });
      });

      // 헬스체크 엔드포인트
      this.app.get("/health", (req, res) => {
        res.json({
          status: "ok",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          bot: {
            initialized: this.isInitialized,
            mongooseConnected: this.mongooseManager?.isConnected() || false,
            modules: this.moduleManager?.modules?.size || 0,
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
        });
      });

      // TTS 파일 목록 (디버깅용)
      this.app.get("/tts", (req, res) => {
        try {
          const files = fs
            .readdirSync(ttsPath)
            .filter((f) => f.endsWith(".mp3"));
          res.json({
            count: files.length,
            files: files,
            path: ttsPath,
          });
        } catch (error) {
          res.status(500).json({ error: "Failed to list TTS files" });
        }
      });

      // 404 핸들러
      this.app.use((req, res) => {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
        res.status(404).json({
          error: "Not Found",
          path: req.url,
          method: req.method,
        });
      });

      // 에러 핸들러
      this.app.use((err, req, res, next) => {
        logger.error("Express 에러:", err);
        res.status(500).json({
          error: "Internal Server Error",
          message:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      });

      // 서버 시작
      const port = process.env.PORT || 3000;
      this.server = this.app.listen(port, () => {
        logger.success(`✅ Express 서버가 포트 ${port}에서 실행 중`);

        // Railway 환경
        if (process.env.RAILWAY_PUBLIC_DOMAIN) {
          const publicUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
          logger.info(`🌐 Public URL: ${publicUrl}`);
          logger.info(`🎵 TTS 파일 접근: ${publicUrl}/tts/`);

          // BASE_URL 환경변수 자동 설정
          if (!process.env.BASE_URL) {
            process.env.BASE_URL = publicUrl;
            logger.info(`📝 BASE_URL 자동 설정: ${publicUrl}`);
          }
        } else {
          logger.info(`🔗 로컬 서버: http://localhost:${port}`);
        }
      });
    } catch (error) {
      logger.error("❌ Express 서버 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔧 환경변수 검증
   */
  validateEnvironment() {
    const requiredEnvVars = ["BOT_TOKEN", "MONGO_URL"];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(`필수 환경변수가 누락됨: ${missingVars.join(", ")}`);
    }

    logger.debug("✅ 환경변수 검증 완료");
  }

  /**
   * 🗄️ 데이터베이스 초기화 (Mongoose만 사용)
   */
  async initializeDatabase() {
    try {
      logger.info("🗄️ Mongoose 데이터베이스 초기화 중...");

      // Mongoose Manager 가져오기
      this.mongooseManager = getMongooseManager();

      // Mongoose 연결
      await this.mongooseManager.connect();

      logger.success("✅ Mongoose 데이터베이스 연결 완료");
    } catch (error) {
      logger.error("❌ 데이터베이스 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎮 핸들러 및 매니저 초기화
   */
  async initializeHandlers() {
    try {
      logger.info("🎮 핸들러 및 매니저 초기화 중...");

      // 헬퍼 컴포넌트 중앙 생성
      this.errorHandler = new ErrorHandler();
      this.markdownHelper = new MarkdownHelper();
      await this.errorHandler.initialize(this.bot);
      await this.markdownHelper.initialize();

      // 1. ServiceBuilder 생성 (Mongoose 전용)
      this.serviceBuilder = createServiceBuilder(this.bot);
      this.serviceBuilder.setMongooseManager(this.mongooseManager);

      // 2. ServiceBuilder 초기화
      await this.serviceBuilder.initialize();

      // 3. 필수 서비스들 미리 생성
      logger.info("📦 필수 서비스 초기화 중...");
      const requiredServices = [
        "todo",
        "timer",
        "worktime",
        "leave",
        "weather",
        "tts",
        "fortune",
      ];

      for (const serviceName of requiredServices) {
        try {
          await this.serviceBuilder.getOrCreate(serviceName);
          logger.success(`✅ ${serviceName} 서비스 초기화 완료`);
        } catch (error) {
          logger.warn(`⚠️ ${serviceName} 서비스 초기화 실패:`, error.message);
        }
      }

      // 4. ModuleManager 초기화
      this.moduleManager = new ModuleManager({
        bot: this.bot,
        serviceBuilder: this.serviceBuilder,
      });

      await this.moduleManager.initialize(this.bot, {
        mongooseManager: this.mongooseManager,
      });

      logger.success("✅ ModuleManager 초기화 완료");

      // 5. NavigationHandler 초기화
      this.navigationHandler = new NavigationHandler(
        this.bot,
        this.moduleManager,
        this.errorHandler, // 주입!
        this.markdownHelper // 주입!
      );
      await this.navigationHandler.initialize();
      logger.success("✅ NavigationHandler 초기화 완료");

      // 6. 상호 참조 설정
      this.navigationHandler.setModuleManager(this.moduleManager);
      this.moduleManager.setNavigationHandler(this.navigationHandler);

      logger.success("✅ 핸들러 및 매니저 초기화 완료");
    } catch (error) {
      logger.error("❌ 핸들러 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔌 미들웨어 설정
   */
  setupMiddlewares() {
    // 에러 핸들링
    this.bot.catch((error, ctx) => {
      logger.error("봇 에러:", error);
      this.stats.errorsCount++;

      try {
        ctx.reply("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } catch (replyError) {
        logger.error("에러 응답 전송 실패:", replyError);
      }
    });

    // 명령어 핸들러
    this.bot.command("start", this.handleStartCommand.bind(this));
    this.bot.command("help", this.handleHelpCommand.bind(this));
    this.bot.command("menu", this.handleMenuCommand.bind(this));
    this.bot.command("status", this.handleStatusCommand.bind(this));

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

    // 텍스트 메시지 핸들러
    this.bot.on("text", this.handleTextMessage.bind(this));

    logger.info("✅ 미들웨어 설정 완료");
  }

  // ===== 🎯 명령어 핸들러들 =====

  /**
   * /start 명령어 처리
   */
  async handleStartCommand(ctx) {
    try {
      this.stats.messagesProcessed++;
      await this.navigationHandler.showMainMenu(ctx);
    } catch (error) {
      logger.error("start 명령 처리 오류:", error);
      await ctx.reply("시작 중 오류가 발생했습니다.");
    }
  }

  /**
   * /help 명령어 처리
   */
  async handleHelpCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      const helpText = `📌 **DooMock Bot 도움말**

🤖 **주요 명령어**:
• /start - 메인 메뉴 보기
• /menu - 메인 메뉴 보기
• /help - 도움말 보기
• /status - 봇 상태 확인

📋 **주요 기능**:
• 📋 할일 관리 - 할일 추가/완료/삭제
• 🍅 타이머 - 뽀모도로 타이머
• 🏢 근무시간 - 출퇴근 기록 관리
• 🏖️ 연차 관리 - 연차 사용 현황
• 🌤️ 날씨 - 현재 날씨 정보
• 🔊 TTS - 텍스트 음성 변환

💡 **팁**: 메뉴 버튼을 클릭하거나 텍스트 입력으로도 기능을 사용할 수 있습니다!`;

      await ctx.replyWithMarkdown(helpText);
    } catch (error) {
      logger.error("help 명령 처리 오류:", error);
      await ctx.reply("도움말 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * /menu 명령어 처리
   */
  async handleMenuCommand(ctx) {
    try {
      this.stats.messagesProcessed++;
      await this.navigationHandler.showMainMenu(ctx);
    } catch (error) {
      logger.error("menu 명령 처리 오류:", error);
      await ctx.reply("메뉴 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * /status 명령어 처리
   */
  async handleStatusCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;

      const statusText = `🤖 **봇 상태**

⏱️ **가동 시간**: ${hours}시간 ${minutes}분 ${seconds}초
📊 **처리 통계**:
• 메시지: ${this.stats.messagesProcessed}개
• 콜백: ${this.stats.callbacksProcessed}개
• 오류: ${this.stats.errorsCount}개

📦 **모듈**: ${this.moduleManager?.modules?.size || 0}개 로드됨
🗄️ **DB**: ${this.mongooseManager?.isConnected() ? "연결됨 ✅" : "연결 안됨 ❌"}

✅ 모든 시스템 정상 작동 중`;

      await ctx.replyWithMarkdown(statusText);
    } catch (error) {
      logger.error("status 명령 처리 오류:", error);
      await ctx.reply("상태 확인 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🔘 콜백 쿼리 처리
   */
  async handleCallbackQuery(ctx) {
    try {
      this.stats.callbacksProcessed++;
      await this.navigationHandler.handleCallback(ctx);
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error("콜백 쿼리 처리 오류:", error);
      await ctx.answerCbQuery("처리 중 오류가 발생했습니다.", {
        show_alert: true,
      });
    }
  }

  /**
   * 💬 텍스트 메시지 처리
   */
  async handleTextMessage(ctx) {
    try {
      this.stats.messagesProcessed++;

      if (!ctx.message?.text || ctx.message.text.startsWith("/")) {
        return;
      }

      // NavigationHandler가 메시지도 처리
      await this.navigationHandler.handleMessage(ctx);
    } catch (error) {
      logger.error("텍스트 메시지 처리 오류:", error);
      await ctx.reply("메시지 처리 중 오류가 발생했습니다.");
    }
  }

  // ===== 🚀 봇 시작/종료 =====

  /**
   * 🚀 봇 시작
   */
  async start() {
    try {
      if (!this.isInitialized) {
        throw new Error("BotController가 초기화되지 않았습니다");
      }

      logger.info("🚀 텔레그램 봇 시작 중...");

      await this.bot.launch();

      logger.success("✅ 텔레그램 봇이 성공적으로 시작되었습니다!");
      logger.info(
        `🤖 봇 사용자명: @${this.bot.botInfo?.username || "unknown"}`
      );

      // Graceful 종료 설정
      process.once("SIGINT", () => this.stop("SIGINT"));
      process.once("SIGTERM", () => this.stop("SIGTERM"));
    } catch (error) {
      logger.error("❌ 봇 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🛑 봇 종료
   */
  async stop(signal = "SIGTERM") {
    try {
      logger.info(`🛑 봇 종료 중... (${signal})`);

      if (this.bot) {
        await this.bot.stop(signal);
      }

      logger.success("✅ 봇이 안전하게 종료되었습니다");
    } catch (error) {
      logger.error("❌ 봇 종료 중 오류:", error);
      throw error;
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    if (this.cleanupInProgress) {
      logger.warn("⚠️ 정리 작업이 이미 진행 중입니다");
      return;
    }

    this.cleanupInProgress = true;

    try {
      logger.info("🧹 BotController 정리 작업 시작...");

      // Express 서버 종료
      if (this.server) {
        try {
          await new Promise((resolve, reject) => {
            this.server.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          logger.debug("✅ Express 서버 종료됨");
        } catch (error) {
          logger.warn("⚠️ Express 서버 종료 실패:", error.message);
        }
      }

      // ServiceBuilder 정리
      if (this.serviceBuilder) {
        try {
          await this.serviceBuilder.cleanup();
          logger.debug("✅ ServiceBuilder 정리 완료");
        } catch (error) {
          logger.warn("⚠️ ServiceBuilder 정리 실패:", error.message);
        }
      }

      // ModuleManager 정리
      if (this.moduleManager) {
        try {
          await this.moduleManager.cleanup();
          logger.debug("✅ ModuleManager 정리 완료");
        } catch (error) {
          logger.warn("⚠️ ModuleManager 정리 실패:", error.message);
        }
      }

      // NavigationHandler 정리
      if (
        this.navigationHandler &&
        typeof this.navigationHandler.cleanup === "function"
      ) {
        try {
          await this.navigationHandler.cleanup();
          logger.debug("✅ NavigationHandler 정리 완료");
        } catch (error) {
          logger.warn("⚠️ NavigationHandler 정리 실패:", error.message);
        }
      }

      // Mongoose 연결 종료
      if (this.mongooseManager) {
        try {
          await this.mongooseManager.disconnect();
          logger.debug("✅ Mongoose 연결 종료됨");
        } catch (error) {
          logger.warn("⚠️ Mongoose 연결 종료 실패:", error.message);
        }
      }

      // 상태 초기화
      this.isInitialized = false;
      this.bot = null;
      this.moduleManager = null;
      this.navigationHandler = null;
      this.mongooseManager = null;
      this.serviceBuilder = null;
      this.app = null;
      this.server = null;

      logger.success("✅ BotController 정리 작업 완료");
    } catch (error) {
      logger.error("❌ BotController 정리 작업 실패:", error);
      throw error;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      stats: this.stats,
      modules: this.moduleManager?.modules?.size || 0,
      mongooseConnected: this.mongooseManager?.isConnected() || false,
    };
  }
}

module.exports = BotController;
