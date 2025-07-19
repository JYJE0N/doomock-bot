// src/controllers/BotController.js - 중복 콜백 이벤트 해결

const CallbackManager = require("../managers/CallbackManager");
const ModuleManager = require("../managers/ModuleManager");
const MessageHandler = require("../handlers/MessageHandler");
const CommandHandler = require("../handlers/CommandHandler");
const { DatabaseManager } = require("../database/DatabaseManager");
const Logger = require("../utils/Logger");
const UserHelper = require("../utils/UserHelper");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    // 매니저들
    this.dbManager = null;
    this.moduleManager = null;
    this.menuManager = null;
    this.callbackManager = null;

    // 핸들러들
    this.messageHandler = null;
    this.commandHandler = null;

    // 사용자 상태 관리
    this.userStates = new Map();

    // 🔧 중복 처리 방지 플래그
    this.eventListenersRegistered = false;
  }

  async initialize() {
    try {
      Logger.info("BotController 초기화 시작...");

      // 1. 데이터베이스 연결
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화 (모듈 로드 + 초기화)
      await this.initializeModuleManager();

      // 모듈 초기화 완료 확인
      Logger.info(
        "초기화된 모듈 수:",
        this.moduleManager.getInitializedModuleCount()
      );

      // 3. 콜백 매니저 초기화
      this.initializeCallbackManager();

      // 4. 핸들러 초기화
      this.initializeHandlers();

      // 5. 이벤트 리스너 등록 (한 번만!)
      if (!this.eventListenersRegistered) {
        this.registerEventListeners();
        this.eventListenersRegistered = true;
      }

      Logger.success("BotController 초기화 완료");
    } catch (error) {
      Logger.error("BotController 초기화 실패:", error);
      throw error;
    }
  }

  // 수정된 initializeDatabase 메서드 디버깅 추가
  async initializeDatabase() {
    // ✅ 안전한 로깅으로 교체
    Logger.info("🔍 데이터베이스 초기화 디버깅:");
    Logger.info(`- MONGO_URL 존재: ${!!this.config.MONGO_URL}`);
    Logger.info(`- NODE_ENV: ${this.config.NODE_ENV}`);
    Logger.info(`- PORT: ${this.config.PORT}`);
    // 민감한 정보는 로깅하지 않음
    Logger.info(
      `  - MONGO_URL 길이: ${this.MONGO_URL ? this.MONGO_URL.length : "undefined"}`
    );
    Logger.info(`  - MONGO_URL 존재 여부: ${!!this.MONGO_URL}`);

    // ✅ 환경 변수도 직접 확인
    Logger.info("🔍 환경 변수 직접 확인:");
    Logger.info(`  - process.env.MONGO_URL: "${process.env.MONGO_URL}"`);
    Logger.info(`  - process.env.MONGODB_URI: "${process.env.MONGODB_URI}"`);

    if (this.MONGO_URL) {
      try {
        Logger.info("✅ MongoDB URL이 config에 있습니다. 연결 시도...");

        const { DatabaseManager } = require("../database/DatabaseManager");

        this.dbManager = new DatabaseManager(this.MONGO_URL);
        await this.dbManager.connect();

        Logger.success("데이터베이스 연결 성공");
      } catch (error) {
        Logger.error("데이터베이스 연결 실패:", error);
        Logger.warn("MongoDB 없이 봇을 실행합니다. 일부 기능이 제한됩니다.");
      }
    } else {
      Logger.warn(
        "❌ MongoDB URL이 config에 없습니다. 일부 기능이 제한됩니다."
      );

      // ✅ 추가 디버깅 정보
      Logger.info("추가 디버깅 정보:");
      Logger.info(
        `  - doomock_bot.js에서 전달된 config: ${JSON.stringify(this.config)}`
      );
    }
  }

  async initializeModuleManager() {
    this.moduleManager = new ModuleManager(this.bot, {
      dbManager: this.dbManager,
      userStates: this.userStates,
    });

    // initialize() 메서드가 loadModules()와 initializeModules()를 모두 처리
    await this.moduleManager.initialize();

    // 초기화 결과 확인
    const loadedModules = this.moduleManager.getAllModules();
    Logger.info(
      "로드된 모듈 정보:",
      loadedModules.map((m) => ({
        name: m.name,
        status: m.status,
      }))
    );

    Logger.success("모듈 매니저 초기화 완료");
  }

  initializeCallbackManager() {
    // 먼저 로드된 모듈 확인
    Logger.info(
      "현재 로드된 모듈:",
      this.moduleManager.getAllModules().map((m) => m.name)
    );

    // 모듈들을 직접 전달하는 방식으로 변경
    const modules = {
      todo: this.moduleManager.getModule("TodoModule"),
      leave: this.moduleManager.getModule("LeaveModule"),
      fortune: this.moduleManager.getModule("FortuneModule"),
      timer: this.moduleManager.getModule("TimerModule"),
      weather: this.moduleManager.getModule("WeatherModule"),
      insight: this.moduleManager.getModule("InsightModule"),
      utils: this.moduleManager.getModule("UtilsModule"),
      reminder: this.moduleManager.getModule("ReminderModule"),
      worktime: this.moduleManager.getModule("WorktimeModule"),
    };

    // 각 모듈 상태 확인
    Object.keys(modules).forEach((key) => {
      if (!modules[key]) {
        Logger.warn(`❌ 모듈 ${key}가 로드되지 않았습니다`);
        delete modules[key];
      } else {
        Logger.success(`✅ 모듈 ${key} 확인됨`);
      }
    });

    if (Object.keys(modules).length === 0) {
      Logger.error("⚠️ 로드된 모듈이 하나도 없습니다!");
    }

    Logger.info("CallbackManager에 전달할 모듈들:", Object.keys(modules));

    this.callbackManager = new CallbackManager(this.bot, modules);
    Logger.success("콜백 매니저 초기화 완료");
  }

  initializeHandlers() {
    // 메시지 핸들러
    this.messageHandler = new MessageHandler(this.bot, {
      moduleManager: this.moduleManager,
      menuManager: this.menuManager,
      callbackManager: this.callbackManager,
      userStates: this.userStates,
    });

    // 명령어 핸들러
    this.commandHandler = new CommandHandler(this.bot, {
      moduleManager: this.moduleManager,
      menuManager: this.menuManager,
      userStates: this.userStates,
    });

    Logger.success("핸들러 초기화 완료");
  }

  // 🔧 이벤트 리스너 등록 (중복 방지)
  registerEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 시작...");

    // 기존 리스너들 제거 (중복 방지)
    this.bot.removeAllListeners("message");
    this.bot.removeAllListeners("callback_query");
    this.bot.removeAllListeners("polling_error");

    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      try {
        console.log(`📨 메시지 이벤트 수신: ${msg.text}`);
        await this.handleMessage(msg);
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      }
    });

    // 🔧 콜백 쿼리 이벤트 (단일 처리)
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        console.log(`📞 콜백 이벤트 수신: ${callbackQuery.data}`);

        // 🚨 중요: CallbackManager만 사용! ModuleManager 사용 안함!
        const handled =
          await this.callbackManager.handleCallback(callbackQuery);

        if (!handled) {
          Logger.warn(`처리되지 않은 콜백: ${callbackQuery.data}`);
        }
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);
        await this.sendErrorMessage(callbackQuery.message.chat.id);
      }
    });

    // 폴링 에러 이벤트
    this.bot.on("polling_error", (error) => {
      Logger.error("폴링 오류:", error);
    });

    Logger.success("✅ 이벤트 리스너 등록 완료 (중복 방지됨)");
  }

  // 🔧 메시지 처리 (ModuleManager 사용)
  async handleMessage(msg) {
    const text = msg.text;
    if (!text) {
      return;
    }

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);

    Logger.info(`💬 메시지: "${text}" (사용자: ${userName}, ID: ${userId})`);

    // /start 명령어 직접 처리
    if (text === "/start") {
      const welcomeText =
        "🤖 **두목봇에 오신걸 환영합니다!**\n\n" +
        `안녕하세요 ${userName}님! 👋\n\n` +
        "두목봇은 직장인을 위한 종합 생산성 도구입니다.\n" +
        "아래 메뉴에서 원하는 기능을 선택해주세요:";

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo_menu" },
            { text: "📅 휴가 관리", callback_data: "leave_menu" },
          ],
          [
            { text: "⏰ 타이머", callback_data: "timer_menu" },
            { text: "🔮 운세", callback_data: "fortune_menu" },
          ],
          [
            { text: "🕐 근무시간", callback_data: "worktime_menu" },
            { text: "🌤️ 날씨", callback_data: "weather_menu" },
          ],
          [
            { text: "📊 인사이트", callback_data: "insight_menu" },
            { text: "🔔 리마인더", callback_data: "reminder_menu" },
          ],
          [
            { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
            { text: "❓ 도움말", callback_data: "help_menu" },
          ],
        ],
      };

      await this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return;
    }

    // 다른 메시지들은 ModuleManager로 전달
    try {
      const handled = await this.moduleManager.handleMessage(this.bot, msg);
      if (!handled) {
        Logger.debug(`처리되지 않은 메시지: ${text}`);
      }
    } catch (error) {
      Logger.error("ModuleManager 메시지 처리 실패:", error);
    }
  }

  // 🚨 handleCallbackQuery 메서드 제거 (중복 방지)
  // CallbackManager에서만 콜백 처리

  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요."
      );
    } catch (error) {
      Logger.error("오류 메시지 전송 실패:", error);
    }
  }

  async shutdown() {
    Logger.info("BotController 종료 시작...");

    try {
      // 이벤트 리스너 제거
      if (this.bot) {
        this.bot.removeAllListeners();
      }

      // 모듈 종료
      if (this.moduleManager) {
        await this.moduleManager.shutdown();
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      // 봇 폴링 중지
      if (this.bot) {
        await this.bot.stopPolling();
      }

      Logger.success("BotController 종료 완료");
    } catch (error) {
      Logger.error("BotController 종료 중 오류:", error);
    }
  }
}

module.exports = BotController;
