// src/controllers/BotController.js
// 🎮 봇 중앙 제어 시스템 (v3.0.1)

const { Telegraf } = require("telegraf");
const logger = require("../utils/Logger");
const NavigationHandler = require("../handlers/NavigationHandler");
const ModuleManager = require("../core/ModuleManager");
const DatabaseManager = require("../database/DatabaseManager");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🎮 BotController - 봇의 중앙 제어 시스템
 *
 * 역할: 모든 이벤트를 받아서 적절한 핸들러로 라우팅
 * 비유: 대형 쇼핑몰의 총괄 매니저
 */
class BotController {
  constructor() {
    this.bot = null;
    this.navigationHandler = null;
    this.moduleManager = null;
    this.dbManager = null;
    this.initialized = false;

    // 통계
    this.stats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      uniqueUsers: new Set(),
    };
  }

  /**
   * 🎯 초기화
   */
  async initialize() {
    try {
      logger.system("BotController 초기화 시작...");

      // 1. 봇 인스턴스 생성
      this.createBot();

      // 2. 데이터베이스 연결
      await this.initializeDatabase();

      // 3. 핸들러 초기화
      await this.initializeHandlers();

      // 4. 이벤트 핸들러 설정
      this.setupEventHandlers();

      // 5. 헬스체크 설정 (Railway)
      if (process.env.RAILWAY_ENVIRONMENT_NAME) {
        this.setupHealthCheck();
      }

      this.initialized = true;
      logger.success("✅ BotController 초기화 완료");
    } catch (error) {
      logger.fatal("BotController 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🤖 봇 인스턴스 생성
   */
  createBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN이 설정되지 않았습니다");
    }

    this.bot = new Telegraf(token);
    logger.success("✅ 봇 인스턴스 생성됨");
  }

  /**
   * 🗄️ 데이터베이스 초기화
   */
  async initializeDatabase() {
    logger.database("데이터베이스 연결 시작...");

    this.dbManager = new DatabaseManager();
    await this.dbManager.connect();

    logger.database("✅ 데이터베이스 연결 성공");
  }

  /**
   * 🎯 핸들러 초기화
   */
  async initializeHandlers() {
    // NavigationHandler 초기화
    logger.module("NavigationHandler", "초기화 중...");
    this.navigationHandler = new NavigationHandler();
    await this.navigationHandler.initialize(this.bot);

    // ModuleManager 초기화
    logger.module("ModuleManager", "초기화 중...");
    this.moduleManager = new ModuleManager(this.bot, {
      db: this.dbManager.getDb(),
    });
    await this.moduleManager.initialize();

    logger.success("✅ 모든 핸들러 초기화 완료");
  }

  /**
   * 🎯 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    // /start 명령어
    this.bot.command("start", (ctx) => this.handleStartCommand(ctx));

    // 콜백 쿼리 (인라인 키보드)
    this.bot.on("callback_query", (ctx) => this.handleCallbackQuery(ctx));

    // 텍스트 메시지
    this.bot.on("text", (ctx) => this.handleMessage(ctx));

    // 에러 핸들러
    this.bot.catch((err, ctx) => this.handleError(err, ctx));

    logger.debug("✅ 이벤트 핸들러 설정 완료");
  }

  /**
   * 🚀 /start 명령어 처리
   */
  async handleStartCommand(ctx) {
    try {
      const userName = getUserName(ctx);
      const userId = getUserId(ctx);

      logger.user(userId, `/start 명령어 실행`);

      // NavigationHandler가 메인 메뉴 표시
      await this.navigationHandler.showMainMenu(ctx);

      // 통계 업데이트
      this.stats.uniqueUsers.add(userId);
      this.stats.totalMessages++;
    } catch (error) {
      logger.error("start 명령어 처리 실패", error);
      await ctx.reply("❌ 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  /**
   * 🎯 콜백 쿼리 처리 (인라인 키보드)
   */
  async handleCallbackQuery(ctx) {
    try {
      const callbackQuery = ctx.callbackQuery;
      const userId = getUserId(callbackQuery);
      const data = callbackQuery.data;

      logger.debug(`📥 콜백: ${data} (사용자: ${userId})`);

      // 즉시 응답
      await ctx.answerCbQuery();

      // NavigationHandler로 라우팅
      await this.navigationHandler.handleCallback(ctx);

      // 통계 업데이트
      this.stats.totalCallbacks++;
      this.stats.uniqueUsers.add(userId);
    } catch (error) {
      logger.error("콜백 처리 실패", error);
      await ctx.answerCbQuery("❌ 처리 중 오류가 발생했습니다", {
        show_alert: true,
      });
    }
  }

  /**
   * 💬 텍스트 메시지 처리
   */
  async handleMessage(ctx) {
    try {
      const msg = ctx.message;
      const userId = getUserId(msg);
      const text = msg.text;

      // 명령어는 제외 (이미 처리됨)
      if (text.startsWith("/")) return;

      logger.debug(
        `💬 메시지: ${text.substring(0, 50)}... (사용자: ${userId})`
      );

      // ModuleManager로 메시지 전달
      await this.moduleManager.handleMessage(this.bot, msg);

      // 통계 업데이트
      this.stats.totalMessages++;
      this.stats.uniqueUsers.add(userId);
    } catch (error) {
      logger.error("메시지 처리 실패", error);
      await ctx.reply("❌ 메시지 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * ❌ 에러 처리
   */
  async handleError(err, ctx) {
    logger.error("봇 에러 발생", err);
    this.stats.totalErrors++;

    try {
      if (ctx && ctx.chat) {
        await ctx.reply("❌ 오류가 발생했습니다. 개발자에게 문의해주세요.");
      }
    } catch (replyError) {
      logger.error("에러 응답 실패", replyError);
    }
  }

  /**
   * 🚀 봇 시작
   */
  async start() {
    try {
      if (!this.initialized) {
        throw new Error("BotController가 초기화되지 않았습니다");
      }

      // Railway 환경에서는 웹훅 모드
      if (process.env.RAILWAY_ENVIRONMENT_NAME) {
        await this.startWebhook();
      } else {
        await this.startPolling();
      }
    } catch (error) {
      logger.error("봇 시작 실패", error);
      throw error;
    }
  }

  /**
   * 🔄 폴링 모드 시작
   */
  async startPolling() {
    logger.network("봇 폴링 모드 시작...");

    await this.bot.launch({
      dropPendingUpdates: true,
    });

    logger.success("✅ 봇이 폴링 모드로 시작되었습니다");
  }

  /**
   * 🌐 웹훅 모드 시작
   */
  async startWebhook() {
    const port = process.env.PORT || 3000;
    const domain = process.env.WEBHOOK_DOMAIN;

    if (!domain) {
      throw new Error("웹훅 도메인이 설정되지 않았습니다");
    }

    logger.network(`봇 웹훅 모드 시작 (포트: ${port})...`);

    await this.bot.launch({
      webhook: {
        domain,
        port,
      },
    });

    logger.success("✅ 봇이 웹훅 모드로 시작되었습니다");
  }

  /**
   * 🏥 헬스체크 설정
   */
  setupHealthCheck() {
    const express = require("express");
    const app = express();
    const port = process.env.PORT || 3000;

    app.get("/health", (req, res) => {
      const health = {
        status: "healthy",
        version: "3.0.1",
        timestamp: TimeHelper.now(),
        uptime: Math.floor((Date.now() - this.stats.startTime) / 1000),
        stats: {
          callbacks: this.stats.totalCallbacks,
          messages: this.stats.totalMessages,
          errors: this.stats.totalErrors,
          users: this.stats.uniqueUsers.size,
        },
      };

      res.json(health);
    });

    app.listen(port, () => {
      logger.network(`헬스체크 서버 시작 (포트: ${port})`);
    });
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    logger.system("BotController 정리 시작...");

    try {
      // 봇 중지
      if (this.bot) {
        await this.bot.stop();
        logger.debug("봇 중지됨");
      }

      // 모듈 정리
      if (this.moduleManager) {
        await this.moduleManager.cleanup();
        logger.debug("ModuleManager 정리됨");
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
        logger.debug("데이터베이스 연결 종료됨");
      }

      logger.success("✅ BotController 정리 완료");
    } catch (error) {
      logger.error("정리 작업 실패", error);
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      initialized: this.initialized,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000),
      stats: {
        ...this.stats,
        uniqueUsers: this.stats.uniqueUsers.size,
      },
      modules: this.moduleManager?.getStatus() || {},
    };
  }
}

module.exports = BotController;
