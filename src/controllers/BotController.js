// src/controllers/BotController.js - 콜백 라우팅 문제 해결

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
      Logger.info("🚀 BotController 초기화 시작...");

      // 1. 데이터베이스 연결 (선택사항)
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화
      await this.initializeModuleManager();

      // 3. 콜백 매니저 초기화 ⭐ 핵심!
      this.initializeCallbackManager();

      // 4. 핸들러 초기화
      this.initializeHandlers();

      // 5. 이벤트 리스너 등록 (한 번만!)
      if (!this.eventListenersRegistered) {
        this.registerEventListeners();
        this.eventListenersRegistered = true;
      }

      Logger.success("✅ BotController 초기화 완료!");
    } catch (error) {
      Logger.error("❌ BotController 초기화 실패:", error);
      throw error;
    }
  }

  // 🔧 콜백 매니저 초기화 - 핵심 수정!
  initializeCallbackManager() {
    Logger.info("🔧 CallbackManager 초기화 중...");

    // ⭐ 모듈들을 정확히 전달
    const modules = {};

    // 각 모듈을 하나씩 확인하고 추가
    const moduleNames = [
      "TodoModule",
      "LeaveModule",
      "FortuneModule",
      "TimerModule",
      "WeatherModule",
      "InsightModule",
      "UtilsModule",
      "ReminderModule",
      "WorktimeModule",
    ];

    moduleNames.forEach((moduleName) => {
      const module = this.moduleManager.getModule(moduleName);
      if (module) {
        const shortName = moduleName.replace("Module", "").toLowerCase();
        modules[shortName] = module;
        Logger.success(`✅ 모듈 ${shortName} 연결됨`);
      } else {
        Logger.warn(`⚠️ 모듈 ${moduleName} 찾을 수 없음`);
      }
    });

    // CallbackManager 생성
    this.callbackManager = new CallbackManager(this.bot, modules);

    Logger.info(
      `📞 CallbackManager 초기화 완료: ${
        Object.keys(modules).length
      }개 모듈 연결`
    );
  }

  // 🎧 이벤트 리스너 등록 - 중복 방지!
  registerEventListeners() {
    Logger.info("🎧 이벤트 리스너 등록 시작...");

    // ⭐ 기존 리스너들 완전 제거
    this.bot.removeAllListeners("message");
    this.bot.removeAllListeners("callback_query");
    this.bot.removeAllListeners("polling_error");

    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      try {
        Logger.debug(`📨 메시지 수신: ${msg.text}`);
        await this.handleMessage(msg);
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      }
    });

    // ⭐ 콜백 쿼리 이벤트 - 단일 처리!
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        Logger.info(`📞 콜백 수신: ${callbackQuery.data}`);

        // ⭐ CallbackManager에서만 처리!
        await this.callbackManager.handleCallback(callbackQuery);
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);
        await this.sendErrorMessage(callbackQuery.message.chat.id);
      }
    });

    // 폴링 에러 이벤트
    this.bot.on("polling_error", (error) => {
      Logger.error("폴링 오류:", error);
    });

    Logger.success("✅ 이벤트 리스너 등록 완료!");
  }

  // 데이터베이스 초기화 (다음 문제에서 해결)
  async initializeDatabase() {
    Logger.info("💾 데이터베이스 초기화 중...");

    if (this.config.MONGO_URL) {
      try {
        const { DatabaseManager } = require("../database/DatabaseManager");
        this.dbManager = new DatabaseManager(this.config.MONGO_URL);
        await this.dbManager.connect();
        Logger.success("✅ 데이터베이스 연결 성공");
      } catch (error) {
        Logger.error("❌ 데이터베이스 연결 실패:", error);
        Logger.warn("⚠️ MongoDB 없이 실행합니다");
      }
    } else {
      Logger.warn("⚠️ MONGO_URL이 설정되지 않음");
    }
  }

  async initializeModuleManager() {
    this.moduleManager = new ModuleManager(this.bot, {
      dbManager: this.dbManager,
      userStates: this.userStates,
    });

    await this.moduleManager.initialize();
    Logger.success("✅ 모듈 매니저 초기화 완료");
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

    Logger.success("✅ 핸들러 초기화 완료");
  }

  // 메시지 처리
  async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);

    Logger.info(`💬 메시지: "${text}" (${userName})`);

    // /start 명령어 직접 처리
    if (text === "/start") {
      const welcomeText =
        "🤖 **두목봇에 오신걸 환영합니다!**\n\n" +
        `안녕하세요 ${userName}님! 👋\n\n` +
        "원하는 기능을 선택해주세요:";

      await this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: this.createMainMenuKeyboard(),
      });
      return;
    }

    // 다른 메시지는 MessageHandler로
    if (this.messageHandler) {
      await this.messageHandler.handleMessage(msg);
    }
  }

  // 메인 메뉴 키보드 생성
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo_menu" },
          { text: "📅 휴가 관리", callback_data: "leave_menu" },
        ],
        [
          { text: "🔮 운세", callback_data: "fortune_menu" },
          { text: "⏰ 타이머", callback_data: "timer_menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather_menu" },
          { text: "📊 인사이트", callback_data: "insight_menu" },
        ],
        [
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
          { text: "🔔 리마인더", callback_data: "reminder_menu" },
        ],
        [{ text: "❓ 도움말", callback_data: "help_menu" }],
      ],
    };
  }

  // 에러 메시지 전송
  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      Logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // 봇 종료
  async shutdown() {
    Logger.info("🛑 BotController 종료 중...");

    if (this.dbManager) {
      await this.dbManager.disconnect();
    }

    Logger.info("✅ BotController 종료 완료");
  }
}

module.exports = BotController;
