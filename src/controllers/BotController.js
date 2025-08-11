// src/controllers/BotController.js - 🤖 Mongoose 전용 봇 컨트롤러

const { Telegraf } = require("telegraf");
const express = require("express");
const path = require("path");
const logger = require("../utils/core/Logger");
const {
  getInstance: getMongooseManager
} = require("../database/MongooseManager");
const { createServiceBuilder } = require("../core/ServiceBuilder");
const ModuleManager = require("../core/ModuleManager");
const NavigationHandler = require("../handlers/NavigationHandler");
const EventBus = require("../core/EventBus");

// 🎯 관심사 분리 - 전문 컴포넌트 import
const ErrorHandler = require("../handlers/ErrorHandler");
const CommandHandler = require("../handlers/CommandHandler");

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
    this.eventBus = null;
    this.isInitialized = false;
    this.cleanupInProgress = false;
    this.errorHandler = null;
    this.commandHandler = null;

    // Express 서버 추가
    this.app = null;
    this.server = null;

    // 통계
    this.stats = {
      messagesProcessed: 0,
      callbacksProcessed: 0,
      errorsCount: 0,
      startTime: new Date()
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

      // ✨ 2. EventBus 초기화 (다른 컴포넌트보다 먼저)
      this.eventBus = EventBus.getInstance();
      logger.info("✅ EventBus 인스턴스 생성됨");

      // ✨ 3. 텔레그램 봇 생성
      this.bot = new Telegraf(process.env.BOT_TOKEN);
      logger.info("✅ 텔레그램 봇 인스턴스 생성됨");

      // ✨ 4. Express 서버 초기화 (이제 this.bot 접근 가능)
      await this.initializeExpressServer();

      // 5. Mongoose 초기화 (단일 데이터베이스 연결)
      await this.initializeDatabase();

      // 6. 핸들러와 매니저 초기화
      await this.initializeHandlers();

      // 7. 미들웨어 설정
      this.setupMiddlewares();

      // ReminderScheduler 초기화 (서비스 빌더 이후에 추가)
      if (process.env.ENABLE_REMINDER_SCHEDULER !== "false") {
        const ReminderScheduler = require("../utils/schedulers/ReminderScheduler");

        // 👇 "reminder" 대신 "todo" 서비스를 가져옵니다.
        const todoServiceForScheduler =
          await this.serviceBuilder.getOrCreate("todo");

        this.reminderScheduler = new ReminderScheduler({
          bot: this.bot,
          // 👇 주입되는 서비스 이름을 reminderService로 유지하되, 실제로는 TodoService 인스턴스를 전달합니다.
          //    (ReminderScheduler 내부 코드 수정을 최소화하기 위함)
          reminderService: todoServiceForScheduler
        });

        await this.reminderScheduler.start();
        logger.success("✅ ReminderScheduler 시작됨 (TodoService와 연동)");
      }

      this.isInitialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌐 Express 서버 초기화 - Railway 502 해결 버전
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
          version: "4.0.1",
          status: "running",
          timestamp: new Date().toISOString()
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
            modules: this.moduleManager?.modules?.size || 0
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
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
            path: ttsPath
          });
        } catch (error) {
          res.status(500).json({ error: "Failed to list TTS files" });
        }
      });

      // ✨ 여기에 웹훅 핸들러 등록 코드를 추가합니다! (404 핸들러보다 앞에)
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        const secretPath = `/telegraf/${this.bot.secretPathComponent()}`;
        this.app.use(this.bot.webhookCallback(secretPath));
        logger.info(`✅ Express 웹훅 리스너 설정 완료: ${secretPath}`);
      }

      // 404 핸들러
      this.app.use((req, res) => {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
        res.status(404).json({
          error: "Not Found",
          path: req.url,
          method: req.method
        });
      });

      // 에러 핸들러
      this.app.use((err, req, res, next) => {
        logger.error("Express 에러:", err);
        res.status(500).json({
          error: "Internal Server Error",
          message:
            process.env.NODE_ENV === "development" ? err.message : undefined
        });
      });

      // 🚨 핵심 수정: Railway용 서버 시작
      const port = process.env.PORT || 3000;
      const host = "0.0.0.0"; // 🎯 Railway 필수 설정!

      this.server = this.app.listen(port, host, () => {
        logger.success(`✅ Express 서버가 ${host}:${port}에서 실행 중`);

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

      // 🛡️ 서버 에러 핸들링 추가
      this.server.on("error", (error) => {
        logger.error("🚨 Express 서버 에러:", error);

        if (error.code === "EADDRINUSE") {
          logger.error(`❌ 포트 ${port}가 이미 사용 중입니다`);
        } else if (error.code === "EACCES") {
          logger.error(`❌ 포트 ${port}에 대한 권한이 없습니다`);
        }

        throw error;
      });

      // 🔍 서버 시작 확인을 위한 Promise 래핑
      return new Promise((resolve, reject) => {
        const serverStartTimeout = setTimeout(() => {
          reject(new Error("서버 시작 타임아웃 (30초)"));
        }, 30000);

        this.server.on("listening", () => {
          clearTimeout(serverStartTimeout);
          logger.info(`🎯 서버가 성공적으로 ${host}:${port}에 바인딩됨`);
          resolve();
        });

        this.server.on("error", (error) => {
          clearTimeout(serverStartTimeout);
          reject(error);
        });
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
      // 1. 기본 핸들러 생성
      this.errorHandler = new ErrorHandler(this.bot);
      // MarkdownHelper는 Utils로 대체됨
      logger.info("🚨 ErrorHandler 초기화 완료");
      logger.info("🎯 스마트 MarkdownV2 시스템 초기화 완료");

      // 2. ServiceBuilder 초기화
      this.serviceBuilder = createServiceBuilder(this.bot);
      this.serviceBuilder.setMongooseManager(this.mongooseManager);

      await this.serviceBuilder.initialize();
      logger.success("✅ ServiceBuilder 초기화 완료");

      // 3. 필수 서비스 사전 로드 (fortune 추가!)
      const requiredServices = [
        "todo",
        "timer",
        "worktime",
        "leave",
        "weather",
        "fortune",
        "tts"
      ];
      logger.info("📦 필수 서비스 초기화 중...");
      for (const serviceName of requiredServices) {
        try {
          await this.serviceBuilder.getOrCreate(serviceName);
          logger.success(`✅ ${serviceName} 서비스 초기화 완료`);
        } catch (error) {
          logger.warn(`⚠️ ${serviceName} 서비스 초기화 실패:`, error.message);
        }
      }

      // 4. 🚀🚀🚀 핵심 수정: ModuleManager 생성자에 serviceBuilder 및 EventBus 전달
      this.moduleManager = new ModuleManager({
        bot: this.bot,
        serviceBuilder: this.serviceBuilder,
        eventBus: this.eventBus
      });

      // 5. NavigationHandler 생성
      this.navigationHandler = new NavigationHandler(
        this.bot,
        this.moduleManager,
        this.errorHandler
      );

      // 6. 🔗 두 핸들러 연결
      this.moduleManager.setNavigationHandler(this.navigationHandler);

      // 7. NavigationHandler 초기화 (렌더러 로드)
      await this.navigationHandler.initialize();
      logger.success("✅ NavigationHandler 초기화 완료");

      // 8. NavigationHandler가 준비된 후, ModuleManager 초기화 (모듈 로드)
      await this.moduleManager.initialize(this.bot);
      logger.success("✅ ModuleManager 초기화 완료");

      // 9. CommandHandler 초기화
      this.commandHandler = new CommandHandler({
        moduleManager: this.moduleManager,
        navigationHandler: this.navigationHandler
      });
      logger.success("✅ CommandHandler 초기화 완료");
    } catch (error) {
      logger.error("❌ 핸들러 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🌉 EventBus 렌더링 브릿지 설정
   */
  setupEventBusRenderingBridge() {
    logger.info("🌉 EventBus 렌더링 브릿지 설정 중...");

    // RENDER.MESSAGE_REQUEST 이벤트 처리
    this.eventBus.subscribe("RENDER.MESSAGE_REQUEST", async (payload) => {
      try {
        const { chatId, renderType, data, options = {} } = payload;
        
        // chatId로 컨텍스트 복원
        const ctx = {
          chat: { id: chatId },
          reply: (text, opts) => this.bot.telegram.sendMessage(chatId, text, opts),
          editMessageText: (text, opts) => this.bot.telegram.editMessageText(chatId, options.messageId, null, text, opts),
          answerCbQuery: (text) => options.callbackQueryId ? this.bot.telegram.answerCbQuery(options.callbackQueryId, text) : Promise.resolve()
        };

        // NavigationHandler를 통해 렌더링
        await this.navigationHandler.renderModuleResponse(ctx, {
          type: renderType,
          data: data,
          options: options
        });

        logger.debug(`✅ RENDER.MESSAGE_REQUEST 처리 완료: ${renderType}`);
      } catch (error) {
        logger.error("❌ RENDER.MESSAGE_REQUEST 처리 실패:", error);
      }
    });

    // RENDER.UPDATE_REQUEST 이벤트 처리
    this.eventBus.subscribe("RENDER.UPDATE_REQUEST", async (payload) => {
      try {
        const { chatId, messageId, renderType, data, options = {} } = payload;
        
        // 메시지 업데이트를 위한 컨텍스트
        const ctx = {
          chat: { id: chatId },
          editMessageText: (text, opts) => this.bot.telegram.editMessageText(chatId, messageId, null, text, opts),
          answerCbQuery: (text) => options.callbackQueryId ? this.bot.telegram.answerCbQuery(options.callbackQueryId, text) : Promise.resolve()
        };

        // NavigationHandler를 통해 렌더링
        await this.navigationHandler.renderModuleResponse(ctx, {
          type: renderType,
          data: data,
          options: { ...options, messageId }
        });

        logger.debug(`✅ RENDER.UPDATE_REQUEST 처리 완료: ${renderType}`);
      } catch (error) {
        logger.error("❌ RENDER.UPDATE_REQUEST 처리 실패:", error);
      }
    });

    logger.success("✅ EventBus 렌더링 브릿지 설정 완료");
  }

  /**
   * 🔌 미들웨어 설정 (수정된 버전 - 불필요한 명령어 제거)
   */
  setupMiddlewares() {
    // EventBus 렌더링 브릿지 먼저 설정
    this.setupEventBusRenderingBridge();

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

    // 🧹 정리된 명령어 핸들러들 (불필요한 것들 제거)
    this.bot.command("start", this.handleStartCommand.bind(this));
    this.bot.command("help", this.handleHelpCommand.bind(this));
    // menu, status 명령어 제거 - 자연어로만 접근

    // 콜백 쿼리 핸들러
    this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

    // 텍스트 메시지 핸들러 (수정됨)
    this.bot.on("text", this.handleTextMessage.bind(this));

    logger.info("✅ 미들웨어 설정 완료 (명령어 간소화 + 자연어 지원)");
  }

  // ===== 🎯 명령어 핸들러들 =====

  /**
   * /start 명령어 처리 (순수 라우팅)
   */
  async handleStartCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      // NavigationHandler를 통해 직접 처리 (CommandHandler는 라우팅만)
      await this.navigationHandler.showMainMenu(ctx);
    } catch (error) {
      logger.error("start 명령 처리 오류:", error);
      await ctx.reply("시작 중 오류가 발생했습니다.");
    }
  }

  /**
   * /help 명령어 처리 (순수 라우팅)
   */
  async handleHelpCommand(ctx) {
    try {
      this.stats.messagesProcessed++;

      // NavigationHandler에 showHelp가 있으면 호출, 없으면 메인메뉴
      if (typeof this.navigationHandler.showHelp === "function") {
        await this.navigationHandler.showHelp(ctx);
      } else {
        await this.navigationHandler.showMainMenu(ctx);
      }
    } catch (error) {
      logger.error("help 명령 처리 오류:", error);
      await ctx.reply("도움말 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🔘 콜백 쿼리 처리
   */
  async handleCallbackQuery(ctx) {
    let answered = false;
    const callbackId = ctx.callbackQuery.id;

    try {
      this.stats.callbacksProcessed++;

      // ✅ 즉시 로딩 응답으로 타임아웃 방지
      try {
        await ctx.answerCbQuery("⏳ 처리 중...");
        answered = true;
        logger.debug(`✅ 콜백 ${callbackId} 즉시 응답 완료`);
      } catch (quickResponseError) {
        // 이미 응답된 경우 등은 무시
        if (!quickResponseError.message?.includes("query is too old")) {
          logger.warn("즉시 응답 실패:", quickResponseError.message);
        }
      }

      // 실제 로직 처리
      await this.navigationHandler.handleCallback(ctx);
    } catch (error) {
      logger.error("콜백 쿼리 처리 오류:", error);

      // 아직 응답하지 않았고, 타임아웃 에러가 아닌 경우에만 에러 응답
      if (!answered && !error.message?.includes("query is too old")) {
        try {
          await ctx.answerCbQuery("❌ 처리 중 오류가 발생했습니다.", {
            show_alert: true
          });
        } catch (answerError) {
          logger.debug("에러 응답 실패 (무시):", answerError.message);
        }
      }
    }
  }

  /**
   * 💬 텍스트 메시지 처리 (수정된 버전 - 두목 자연어 명령어 지원)
   */
  async handleTextMessage(ctx) {
    try {
      this.stats.messagesProcessed++;

      if (!ctx.message?.text || ctx.message.text.startsWith("/")) {
        return;
      }

      const messageText = ctx.message.text;
      const msg = ctx.message;

      logger.debug(`💬 텍스트 메시지 수신: "${messageText}"`);

      // 🎯 1단계: CommandHandler의 자연어 처리 먼저 시도
      if (
        this.commandHandler &&
        typeof this.commandHandler.handleNaturalMessage === "function"
      ) {
        const handled = await this.commandHandler.handleNaturalMessage(
          this.bot,
          msg
        );

        if (handled) {
          logger.debug(
            `✅ CommandHandler가 자연어 메시지 처리 완료: "${messageText}"`
          );
          return;
        }
      }

      // 🎯 2단계: NavigationHandler의 기존 메시지 처리로 폴백
      logger.debug(
        `🔄 CommandHandler에서 처리하지 못함 - NavigationHandler로 폴백`
      );
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

      // 웹훅 또는 폴링 방식 분기 처리
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        // 레일웨이 환경에서는 웹훅 URL을 텔레그램에 등록
        const webhookUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/telegraf/${this.bot.secretPathComponent()}`;
        await this.bot.telegram.setWebhook(webhookUrl);
        logger.info(`✅ 웹훅 URL 등록 완료: ${webhookUrl}`);
        // Express 서버는 이미 initialize 단계에서 실행되었으므로 추가 작업 불필요
      } else {
        // 로컬 개발 환경일 경우 폴링 시작
        await this.bot.launch();
        logger.success("✅ 텔레그램 봇이 폴링 방식으로 시작되었습니다!");
      }

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

      // ReminderScheduler 정리
      if (this.reminderScheduler) {
        await this.reminderScheduler.stop();
        logger.info("🛑 ReminderScheduler 중지됨");
      }

      // ModuleManager 정리 (EventBus 정리 포함)
      if (this.moduleManager) {
        try {
          await this.moduleManager.shutdown();
          logger.debug("✅ ModuleManager 정리 완료");
        } catch (error) {
          logger.warn("⚠️ ModuleManager 정리 실패:", error.message);
        }
      }
      // CommandHandler 정리
      if (this.commandHandler) {
        try {
          await this.commandHandler.cleanup();
          logger.debug("✅ CommandHandler 정리 완료");
        } catch (error) {
          logger.warn("⚠️ CommandHandler 정리 실패:", error.message);
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
      this.eventBus = null;
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
      mongooseConnected: this.mongooseManager?.isConnected() || false
    };
  }
}

module.exports = BotController;
