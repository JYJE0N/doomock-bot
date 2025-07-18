// src/controllers/BotController.js - 리팩토링된 ModuleManager와 호환
const MenuManager = require("../managers/MenuManager");
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
  }

  async initialize() {
    try {
      Logger.info("BotController 초기화 시작...");

      // 1. 데이터베이스 연결
      await this.initializeDatabase();

      // 2. 모듈 매니저 초기화 (모듈 로드 + 초기화)
      await this.initializeModuleManager();

      // 3. 메뉴 매니저 초기화 (ModuleManager 의존)
      this.initializeMenuManager();

      // 4. 콜백 매니저 초기화
      this.initializeCallbackManager();

      // 5. 핸들러 초기화
      this.initializeHandlers();

      // 6. 이벤트 리스너 등록
      this.registerEventListeners();

      Logger.success("BotController 초기화 완료");
      Logger.info(
        `초기화된 모듈 수: ${this.moduleManager.getInitializedModuleCount()}`
      );
    } catch (error) {
      Logger.error("BotController 초기화 실패:", error);
      throw error;
    }
  }

  async initializeDatabase() {
    if (this.config.mongoUrl) {
      try {
        this.dbManager = new DatabaseManager(this.config.mongoUrl);
        await this.dbManager.connect();

        // 싱글톤 인스턴스 설정 (서비스들이 사용할 수 있도록)
        if (DatabaseManager.setInstance) {
          DatabaseManager.setInstance(this.dbManager);
        }

        Logger.success("데이터베이스 연결 성공");
      } catch (error) {
        Logger.error("데이터베이스 연결 실패:", error);
        Logger.warn("MongoDB 없이 봇을 실행합니다. 일부 기능이 제한됩니다.");
      }
    } else {
      Logger.warn("MongoDB URL이 없습니다. 일부 기능이 제한됩니다.");
    }
  }

  async initializeModuleManager() {
    this.moduleManager = new ModuleManager(this.bot, {
      dbManager: this.dbManager,
      userStates: this.userStates,
    });

    // ModuleManager는 이제 내부적으로 모든 로드와 초기화를 처리
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

  initializeMenuManager() {
    this.menuManager = new MenuManager(this.moduleManager);
    Logger.success("메뉴 매니저 초기화 완료");
  }

  initializeCallbackManager() {
    // 모듈들을 올바른 형식으로 전달
    const modules = this.moduleManager.getModules();

    Logger.info("현재 로드된 모듈:", Object.keys(modules));

    // 로드된 모듈이 없는 경우 경고
    if (Object.keys(modules).length === 0) {
      Logger.warn("⚠️ 로드된 모듈이 하나도 없습니다!");
    }

    this.callbackManager = new CallbackManager(this.bot, modules);

    // MenuManager 참조 설정 (상호 의존성)
    if (this.callbackManager.setMenuManager) {
      this.callbackManager.setMenuManager(this.menuManager);
    }

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

  registerEventListeners() {
    // 메시지 이벤트
    this.bot.on("message", async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        Logger.error("메시지 처리 오류:", error);
        await this.sendErrorMessage(msg.chat.id);
      }
    });

    // 콜백 쿼리 이벤트
    this.bot.on("callback_query", async (callbackQuery) => {
      try {
        await this.handleCallbackQuery(callbackQuery);
      } catch (error) {
        Logger.error("콜백 처리 오류:", error);
        await this.sendErrorMessage(callbackQuery.message.chat.id);
      }
    });

    // 폴링 에러 이벤트
    this.bot.on("polling_error", (error) => {
      Logger.error("폴링 오류:", error);
    });

    Logger.success("이벤트 리스너 등록 완료");
  }

  async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);

    Logger.info(`💬 메시지: "${text}" (사용자: ${userName}, ID: ${userId})`);

    // ModuleManager에서 처리하도록 위임
    const handled = await this.moduleManager.handleMessage(this.bot, msg);

    // 처리되지 않은 메시지 대응
    if (!handled) {
      // 일반 텍스트 메시지에 대한 기본 응답
      if (!text.startsWith("/")) {
        const helpMessage =
          `안녕하세요 ${userName}님! 👋\n\n` +
          `무엇을 도와드릴까요?\n` +
          `/start 명령어로 메인 메뉴를 열어보세요!`;

        await this.bot.sendMessage(chatId, helpMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        });
      }
    }
  }

  async handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;

    // ModuleManager에서 콜백 처리하도록 위임
    const handled = await this.moduleManager.handleCallback(
      this.bot,
      callbackQuery
    );

    // 처리되지 않은 콜백에 대한 대응
    if (!handled) {
      // CallbackManager로 폴백
      if (this.callbackManager) {
        try {
          await this.callbackManager.handleCallback(callbackQuery);
        } catch (error) {
          Logger.error("CallbackManager 폴백 처리 실패:", error);
          await this.sendUnknownCallbackError(callbackQuery);
        }
      } else {
        await this.sendUnknownCallbackError(callbackQuery);
      }
    }
  }

  async sendUnknownCallbackError(callbackQuery) {
    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "알 수 없는 요청입니다.",
        show_alert: false,
      });

      await this.bot.editMessageText("❓ 알 수 없는 요청입니다.", {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      Logger.error("알 수 없는 콜백 오류 처리 실패:", error);
    }
  }

  async sendErrorMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } catch (error) {
      Logger.error("오류 메시지 전송 실패:", error);
    }
  }

  // 봇 상태 조회
  getStatus() {
    return {
      isInitialized: !!this.moduleManager?.isInitialized,
      moduleCount: this.moduleManager?.getInitializedModuleCount() || 0,
      dbConnected: !!this.dbManager?.isConnected(),
      uptime: process.uptime(),
    };
  }

  // 전체 시스템 재시작
  async restart() {
    Logger.info("🔄 시스템 재시작 시작...");

    try {
      // 모듈 재로드
      if (this.moduleManager) {
        await this.moduleManager.reloadModules();
      }

      // 메뉴 캐시 클리어
      if (this.menuManager && this.menuManager.clearCache) {
        this.menuManager.clearCache();
      }

      Logger.success("✅ 시스템 재시작 완료");
    } catch (error) {
      Logger.error("❌ 시스템 재시작 실패:", error);
      throw error;
    }
  }

  async shutdown() {
    Logger.info("BotController 종료 시작...");

    try {
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
