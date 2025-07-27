// ========================================
// 🎮 BotController.js v3.0.1 - 완전한 알록달록 연동
// ========================================
// LoggerEnhancer + NavigationHandler 완벽 통합!
// ========================================

const { Telegraf } = require("telegraf");
const logger = require("../utils/Logger");
const NavigationHandler = require("../handlers/NavigationHandler");
const ModuleManager = require("../core/ModuleManager");
const DatabaseManager = require("../database/DatabaseManager");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🎮 BotController v3.0.1 - 알록달록 통합 중앙 제어
 *
 * ✨ 새로운 기능들:
 * - 🌈 LoggerEnhancer 알록달록 기능 완전 활용
 * - 🎯 NavigationHandler 강화판 연동
 * - 📱 MarkdownV2 지원으로 예쁜 메시지
 * - 🎨 실시간 사용자 경험 모니터링
 * - 🚀 Railway 최적화
 */
class BotController {
  constructor() {
    this.bot = null;
    this.navigationHandler = null;
    this.moduleManager = null;
    this.dbManager = null;
    this.initialized = false;

    // 🌈 LoggerEnhancer 활용을 위한 참조
    this.messageSystem = logger.messageSystem;
    this.enhancer = logger.enhancer;

    // 📊 상세 통계 시스템
    this.stats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      uniqueUsers: new Set(),
      sessionStats: new Map(), // 사용자별 세션 통계
      performanceMetrics: {
        avgResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
      },
    };

    // 🎭 실시간 모니터링
    this.monitoring = {
      isActive: false,
      interval: null,
      lastHeartbeat: Date.now(),
    };
  }

  /**
   * 🎯 초기화 (알록달록 시작!)
   */
  async initialize() {
    try {
      // 🌈 화려한 시작 배너
      console.clear();
      console.log(
        this.messageSystem.rainbow("🎮 ═══════════════════════════════════════")
      );
      console.log(
        this.messageSystem.gradient(
          "    봇 컨트롤러 v3.0.1 초기화 시작!",
          "cyan",
          "magenta"
        )
      );
      console.log(
        this.messageSystem.rainbow("🎮 ═══════════════════════════════════════")
      );
      console.log();

      // 1. 봇 인스턴스 생성
      console.log(
        this.messageSystem.gradient(
          "🤖 봇 인스턴스 생성 중...",
          "blue",
          "purple"
        )
      );
      this.createBot();
      console.log(this.messageSystem.rainbow("✅ 봇 인스턴스 생성 완료!"));

      // 2. 데이터베이스 연결
      console.log(
        this.messageSystem.gradient(
          "🗄️ 데이터베이스 연결 중...",
          "green",
          "blue"
        )
      );
      await this.initializeDatabase();
      console.log(this.messageSystem.rainbow("✅ 데이터베이스 연결 완료!"));

      // 3. 핸들러 초기화
      console.log(
        this.messageSystem.gradient("🎯 핸들러 초기화 중...", "yellow", "red")
      );
      await this.initializeHandlers();
      console.log(this.messageSystem.rainbow("✅ 핸들러 초기화 완료!"));

      // 4. 이벤트 핸들러 설정
      console.log(
        this.messageSystem.gradient(
          "🔗 이벤트 핸들러 설정 중...",
          "purple",
          "cyan"
        )
      );
      this.setupEventHandlers();
      console.log(this.messageSystem.rainbow("✅ 이벤트 핸들러 설정 완료!"));

      // 5. 모니터링 시작
      console.log(
        this.messageSystem.gradient(
          "📊 실시간 모니터링 시작...",
          "orange",
          "pink"
        )
      );
      this.startMonitoring();
      console.log(this.messageSystem.rainbow("✅ 모니터링 시작 완료!"));

      // 6. Railway 헬스체크 설정
      if (process.env.RAILWAY_ENVIRONMENT_NAME) {
        console.log(
          this.messageSystem.gradient(
            "🚂 Railway 헬스체크 설정...",
            "green",
            "yellow"
          )
        );
        this.setupHealthCheck();
        console.log(this.messageSystem.rainbow("✅ Railway 설정 완료!"));
      }

      this.initialized = true;

      // 🎉 초기화 완료 축하 메시지
      console.log();
      console.log(
        this.messageSystem.rainbow("🎉 ═══════════════════════════════════════")
      );
      console.log(
        this.messageSystem.gradient(
          "     BotController 초기화 완료!",
          "green",
          "blue"
        )
      );
      console.log(
        this.messageSystem.rainbow("🎉 ═══════════════════════════════════════")
      );

      // 📊 시작 통계 표시
      this.showInitializationStats();

      logger.celebration("두목봇 v3.0.1 알록달록 모드로 준비 완료!");
    } catch (error) {
      console.log(
        this.messageSystem.gradient("❌ 초기화 실패!", "red", "darkred")
      );
      logger.error("BotController 초기화 실패:", error);
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

    // 🎨 봇 정보 알록달록 로그
    console.log(
      this.messageSystem.gradient(
        `   🎯 토큰: ${token.substring(0, 10)}...`,
        "gray",
        "blue"
      )
    );
  }

  /**
   * 🗄️ 데이터베이스 초기화
   */
  async initializeDatabase() {
    this.dbManager = new DatabaseManager();
    await this.dbManager.connect();

    // 🌈 연결 상태 알록달록 표시
    const dbStatus = this.dbManager.isConnected() ? "🟢 연결됨" : "🔴 실패";
    console.log(
      this.messageSystem.gradient(`   📊 상태: ${dbStatus}`, "cyan", "green")
    );
  }

  /**
   * 🎯 핸들러 초기화 (강화판 NavigationHandler!)
   */
  async initializeHandlers() {
    // NavigationHandler 초기화 (알록달록 강화판!)
    console.log(
      this.messageSystem.rainbow(
        "   🎹 NavigationHandler (알록달록 버전) 초기화..."
      )
    );
    this.navigationHandler = new NavigationHandler();
    await this.navigationHandler.initialize(this.bot);

    // ModuleManager 초기화
    console.log(
      this.messageSystem.gradient(
        "   📦 ModuleManager 초기화...",
        "purple",
        "blue"
      )
    );
    this.moduleManager = new ModuleManager(this.bot, {
      db: this.dbManager.getDb(),
    });
    await this.moduleManager.initialize();

    // NavigationHandler에 ModuleManager 연결
    this.navigationHandler.moduleManager = this.moduleManager;
  }

  /**
   * 🎯 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    // /start 명령어 (알록달록 환영!)
    this.bot.command("start", async (ctx) => {
      console.log(
        this.messageSystem.rainbow(`🚀 /start 명령어: ${getUserName(ctx)}`)
      );
      await this.handleStartCommand(ctx);
    });

    // 콜백 쿼리 (알록달록 네비게이션!)
    this.bot.on("callback_query", async (ctx) => {
      const data = ctx.callbackQuery.data;
      console.log(
        this.messageSystem.gradient(`🎯 콜백: ${data}`, "blue", "purple")
      );
      await this.handleCallbackQuery(ctx);
    });

    // 텍스트 메시지 (알록달록 처리!)
    this.bot.on("text", async (ctx) => {
      const text = ctx.message.text;
      if (!text.startsWith("/")) {
        console.log(
          this.messageSystem.gradient(
            `💬 메시지: ${text.substring(0, 20)}...`,
            "green",
            "cyan"
          )
        );
      }
      await this.handleMessage(ctx);
    });

    // 에러 핸들러 (알록달록 오류 처리!)
    this.bot.catch(async (err, ctx) => {
      console.log(
        this.messageSystem.gradient(
          `❌ 에러 발생: ${err.message}`,
          "red",
          "orange"
        )
      );
      await this.handleError(err, ctx);
    });

    console.log(this.messageSystem.rainbow("   ✅ 이벤트 핸들러 등록 완료"));
  }

  /**
   * 🚀 /start 명령어 처리 (알록달록 환영!)
   */
  async handleStartCommand(ctx) {
    const startTime = Date.now();

    try {
      const userName = getUserName(ctx);
      const userId = getUserId(ctx);

      // 🌈 사용자 환영 로그
      console.log(this.messageSystem.rainbow(`👋 새로운 사용자: ${userName}`));
      console.log(
        this.messageSystem.gradient(`   🆔 ID: ${userId}`, "blue", "purple")
      );

      // 세션 시작 기록
      this.startUserSession(userId, userName);

      // NavigationHandler의 알록달록 메인 메뉴 표시
      await this.navigationHandler.showMainMenu(ctx);

      // 통계 업데이트
      this.stats.uniqueUsers.add(userId);
      this.stats.totalMessages++;

      // 🎉 성공 로그
      const responseTime = Date.now() - startTime;
      console.log(
        this.messageSystem.gradient(
          `✅ 처리 완료 (${responseTime}ms)`,
          "green",
          "blue"
        )
      );
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ start 명령어 실패: ${error.message}`,
          "red",
          "darkred"
        )
      );
      logger.error("start 명령어 처리 실패:", error);

      // 폴백 메시지
      await ctx.reply(
        "❌ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    }
  }

  /**
   * 🎯 콜백 쿼리 처리 (알록달록 라우팅!)
   */
  async handleCallbackQuery(ctx) {
    const startTime = Date.now();

    try {
      const callbackQuery = ctx.callbackQuery;
      const userId = getUserId(callbackQuery);
      const data = callbackQuery.data;

      // 🎨 콜백 상세 로그
      console.log(this.messageSystem.rainbow(`📱 콜백 상세:`));
      console.log(
        this.messageSystem.gradient(
          `   👤 사용자: ${getUserName(callbackQuery)}`,
          "cyan",
          "blue"
        )
      );
      console.log(
        this.messageSystem.gradient(`   🎯 액션: ${data}`, "purple", "pink")
      );

      // 즉시 응답 (로딩 효과)
      const loadingEmoji = ["⏳", "⌛", "🔄", "⚡"][
        Math.floor(Math.random() * 4)
      ];
      await ctx.answerCbQuery(`${loadingEmoji} 처리 중...`);

      // 세션 활동 업데이트
      this.updateUserSession(userId, "callback", data);

      // NavigationHandler의 알록달록 콜백 처리
      await this.navigationHandler.handleCallback(ctx);

      // 통계 업데이트
      this.stats.totalCallbacks++;
      this.stats.uniqueUsers.add(userId);

      // 🎉 성공 로그
      const responseTime = Date.now() - startTime;
      console.log(
        this.messageSystem.gradient(
          `✅ 콜백 처리 완료 (${responseTime}ms)`,
          "green",
          "blue"
        )
      );

      // 성능 메트릭 업데이트
      this.updatePerformanceMetrics(responseTime);
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ 콜백 처리 실패: ${error.message}`,
          "red",
          "orange"
        )
      );
      logger.error("콜백 처리 실패:", error);

      // 사용자 친화적 오류 메시지
      await ctx.answerCbQuery("❌ 처리 중 오류가 발생했습니다", {
        show_alert: true,
      });

      this.stats.totalErrors++;
    }
  }

  /**
   * 💬 텍스트 메시지 처리 (알록달록 모듈 라우팅!)
   */
  async handleMessage(ctx) {
    const startTime = Date.now();

    try {
      const msg = ctx.message;
      const userId = getUserId(msg);
      const text = msg.text;

      // 명령어는 제외 (이미 처리됨)
      if (text.startsWith("/")) return;

      // 🌈 메시지 분석 로그
      console.log(this.messageSystem.rainbow(`📝 메시지 분석:`));
      console.log(
        this.messageSystem.gradient(
          `   📄 내용: ${text.substring(0, 50)}...`,
          "green",
          "cyan"
        )
      );
      console.log(
        this.messageSystem.gradient(
          `   📏 길이: ${text.length}자`,
          "blue",
          "purple"
        )
      );

      // 세션 활동 업데이트
      this.updateUserSession(userId, "message", text.substring(0, 50));

      // ModuleManager로 메시지 전달
      const handled = await this.moduleManager.handleMessage(this.bot, msg);

      // 처리 결과 로그
      if (handled) {
        console.log(
          this.messageSystem.gradient("✅ 모듈에서 처리됨", "green", "blue")
        );
      } else {
        console.log(
          this.messageSystem.gradient("ℹ️ 처리되지 않음", "yellow", "orange")
        );
      }

      // 통계 업데이트
      this.stats.totalMessages++;
      this.stats.uniqueUsers.add(userId);

      // 성능 메트릭 업데이트
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime);
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ 메시지 처리 실패: ${error.message}`,
          "red",
          "darkred"
        )
      );
      logger.error("메시지 처리 실패:", error);

      await ctx.reply("❌ 메시지 처리 중 오류가 발생했습니다.");
      this.stats.totalErrors++;
    }
  }

  /**
   * ❌ 에러 처리 (알록달록 오류 관리!)
   */
  async handleError(err, ctx) {
    console.log(this.messageSystem.rainbow("🚨 ═══ 에러 발생 ═══"));
    console.log(
      this.messageSystem.gradient(`❌ 오류: ${err.message}`, "red", "orange")
    );
    console.log(
      this.messageSystem.gradient(
        `🔍 스택: ${err.stack?.substring(0, 100)}...`,
        "gray",
        "red"
      )
    );

    logger.error("봇 에러 발생:", err);
    this.stats.totalErrors++;

    try {
      if (ctx && ctx.chat) {
        // 사용자 친화적 오류 메시지 (MarkdownV2)
        const errorText = `
🚨 **시스템 오류**

죄송합니다\\. 일시적인 문제가 발생했습니다\\.

**🔧 해결 방법:**
• 잠시 후 다시 시도해주세요
• 문제가 지속되면 /start 명령어로 재시작하세요

*개발팀이 신속히 해결하겠습니다\\!* 🛠️
        `.trim();

        await ctx.reply(errorText, { parse_mode: "MarkdownV2" });
      }
    } catch (replyError) {
      console.log(
        this.messageSystem.gradient(
          `❌ 오류 응답 실패: ${replyError.message}`,
          "darkred",
          "red"
        )
      );
      logger.error("오류 응답 실패:", replyError);
    }
  }

  /**
   * 📊 실시간 모니터링 시작
   */
  startMonitoring() {
    this.monitoring.isActive = true;

    // 10초마다 상태 체크
    this.monitoring.interval = setInterval(() => {
      this.showLiveStats();
      this.monitoring.lastHeartbeat = Date.now();
    }, 10000);

    console.log(this.messageSystem.rainbow("📊 실시간 모니터링 활성화됨"));
  }

  /**
   * 📊 실시간 통계 표시
   */
  showLiveStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeStr = this.formatUptime(uptime);

    console.log(this.messageSystem.rainbow("📊 ═══ 실시간 통계 ═══"));
    console.log(
      this.messageSystem.gradient(`⏰ 가동시간: ${uptimeStr}`, "blue", "cyan")
    );
    console.log(
      this.messageSystem.gradient(
        `👥 활성 사용자: ${this.stats.uniqueUsers.size}명`,
        "green",
        "blue"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `📱 총 콜백: ${this.stats.totalCallbacks}회`,
        "purple",
        "pink"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `💬 총 메시지: ${this.stats.totalMessages}개`,
        "yellow",
        "orange"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `❌ 오류: ${this.stats.totalErrors}건`,
        "red",
        "orange"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `⚡ 평균 응답시간: ${this.stats.performanceMetrics.avgResponseTime}ms`,
        "cyan",
        "blue"
      )
    );
    console.log(this.messageSystem.rainbow("📊 ═══════════════"));
  }

  /**
   * 📊 초기화 통계 표시
   */
  showInitializationStats() {
    const initTime = Date.now() - this.stats.startTime;

    console.log();
    console.log(this.messageSystem.rainbow("📊 ═══ 초기화 통계 ═══"));
    console.log(
      this.messageSystem.gradient(
        `⚡ 초기화 시간: ${initTime}ms`,
        "green",
        "blue"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `🤖 봇 상태: ${this.bot ? "🟢 준비됨" : "🔴 오류"}`,
        "blue",
        "purple"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `🗄️ DB 상태: ${
          this.dbManager?.isConnected() ? "🟢 연결됨" : "🔴 연결 실패"
        }`,
        "cyan",
        "green"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `🎹 네비게이션: ${
          this.navigationHandler?.initialized ? "🟢 활성화" : "🔴 비활성화"
        }`,
        "purple",
        "pink"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `📦 모듈 관리자: ${
          this.moduleManager?.initialized ? "🟢 준비됨" : "🔴 오류"
        }`,
        "yellow",
        "orange"
      )
    );
    console.log(this.messageSystem.rainbow("📊 ═══════════════"));
  }

  /**
   * 👤 사용자 세션 시작
   */
  startUserSession(userId, userName) {
    this.stats.sessionStats.set(userId, {
      userName,
      startTime: Date.now(),
      totalActions: 0,
      lastActivity: Date.now(),
      activities: [],
    });

    console.log(
      this.messageSystem.gradient(`📝 세션 시작: ${userName}`, "green", "blue")
    );
  }

  /**
   * 👤 사용자 세션 업데이트
   */
  updateUserSession(userId, actionType, actionData) {
    const session = this.stats.sessionStats.get(userId);
    if (session) {
      session.totalActions++;
      session.lastActivity = Date.now();
      session.activities.push({
        type: actionType,
        data: actionData,
        timestamp: Date.now(),
      });

      // 최근 10개 활동만 유지
      if (session.activities.length > 10) {
        session.activities = session.activities.slice(-10);
      }
    }
  }

  /**
   * ⚡ 성능 메트릭 업데이트
   */
  updatePerformanceMetrics(responseTime) {
    const metrics = this.stats.performanceMetrics;
    metrics.totalRequests++;

    // 평균 응답시간 계산
    metrics.avgResponseTime = Math.round(
      (metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime) /
        metrics.totalRequests
    );

    // 에러율 계산
    metrics.errorRate = (
      (this.stats.totalErrors / metrics.totalRequests) *
      100
    ).toFixed(2);
  }

  /**
   * ⏰ 가동시간 포맷
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  }

  /**
   * 🚂 Railway 헬스체크 설정
   */
  setupHealthCheck() {
    const express = require("express");
    const app = express();
    const port = process.env.PORT || 3000;

    app.get("/health", (req, res) => {
      const healthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.stats.startTime,
        bot: !!this.bot,
        database: this.dbManager?.isConnected() || false,
        navigation: this.navigationHandler?.initialized || false,
        modules: this.moduleManager?.initialized || false,
        stats: this.stats.performanceMetrics,
      };

      console.log(
        this.messageSystem.gradient(`🏥 헬스체크 요청`, "green", "blue")
      );
      res.json(healthStatus);
    });

    app.listen(port, () => {
      console.log(
        this.messageSystem.rainbow(
          `🚂 Railway 헬스체크 서버 시작: 포트 ${port}`
        )
      );
    });
  }

  /**
   * 🚀 봇 시작
   */
  async start() {
    if (!this.initialized) {
      throw new Error(
        "BotController가 초기화되지 않았습니다. initialize()를 먼저 호출하세요."
      );
    }

    console.log(this.messageSystem.rainbow("🚀 ═══ 봇 시작 ═══"));
    console.log(
      this.messageSystem.gradient(
        "텔레그램 봇 서비스 시작 중...",
        "green",
        "blue"
      )
    );

    await this.bot.launch();

    console.log(
      this.messageSystem.rainbow("✅ 봇이 성공적으로 시작되었습니다!")
    );
    console.log(
      this.messageSystem.gradient(
        "사용자의 메시지를 기다리는 중...",
        "cyan",
        "purple"
      )
    );

    // 우아한 종료 처리
    process.once("SIGINT", () => this.shutdown("SIGINT"));
    process.once("SIGTERM", () => this.shutdown("SIGTERM"));
  }

  /**
   * 🛑 우아한 종료
   */
  async shutdown(signal) {
    console.log(this.messageSystem.rainbow(`🛑 ═══ ${signal} 신호 수신 ═══`));
    console.log(
      this.messageSystem.gradient("우아한 종료 시작...", "yellow", "red")
    );

    try {
      // 모니터링 중지
      if (this.monitoring.interval) {
        clearInterval(this.monitoring.interval);
        this.monitoring.isActive = false;
      }

      // 최종 통계 표시
      console.log(this.messageSystem.rainbow("📊 ═══ 최종 통계 ═══"));
      this.showLiveStats();

      // NavigationHandler 정리
      if (this.navigationHandler) {
        this.navigationHandler.cleanup();
      }

      // 봇 정지
      if (this.bot) {
        this.bot.stop(signal);
      }

      // DB 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      console.log(this.messageSystem.rainbow("✅ 우아한 종료 완료"));
      process.exit(0);
    } catch (error) {
      console.log(
        this.messageSystem.gradient(
          `❌ 종료 중 오류: ${error.message}`,
          "red",
          "darkred"
        )
      );
      process.exit(1);
    }
  }
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = BotController;
