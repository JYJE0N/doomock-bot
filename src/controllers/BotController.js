// src/controllers/BotController.js - 개선된 버전 3

const Logger = require("../utils/Logger");

class BotController {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    // 매니저 초기화를 지연 로딩으로 변경
    this.managers = {};
    this.handlers = {};

    // 사용자 상태 관리를 위한 Map
    this.userStates = new Map();

    // 서브메뉴 라우터
    this.menuRouter = new Map();
  }

  async initialize() {
    try {
      Logger.info("BotController 초기화 시작...");

      // 1. 데이터베이스 연결
      await this.initializeDatabase();

      // 2. 매니저 초기화 (순차적으로)
      await this.initializeManagers();

      // 3. 핸들러 초기화
      await this.initializeHandlers();

      // 4. 메뉴 라우터 설정
      this.setupMenuRouter();

      // 5. 이벤트 리스너 등록
      this.registerEventListeners();

      Logger.info("BotController 초기화 완료");
    } catch (error) {
      Logger.error("BotController 초기화 실패:", error);
      throw error;
    }
  }

  async initializeDatabase() {
    const DatabaseManager = require("../database/DatabaseManager");
    this.dbManager = new DatabaseManager();

    // BotController 생성시 전달받은 mongoUri 사용
    const mongoUri = this.config.mongoUri;
    await this.dbManager.connect(mongoUri);
  }

  async initializeManagers() {
    // 순환 참조를 피하기 위해 순차적으로 초기화
    const MenuManager = require("../managers/MenuManager");
    const CallbackManager = require("../managers/CallbackManager");
    const ModuleManager = require("../managers/ModuleManager");
    const MessageHandler = require("../handlers/MessageHandler");

    this.managers.menu = new MenuManager(this.bot);
    this.managers.callback = new CallbackManager(this.bot);
    this.managers.module = new ModuleManager(this.bot);
    this.managers.message = new MessageHandler(this.bot, {
      moduleManager: this.managers.module,
      menuManager: this.managers.menu,
      userStates: this.userStates,
    });

    // 각 매니저에 필요한 의존성 주입
    this.managers.menu.setDependencies({
      moduleManager: this.managers.module,
      callbackManager: this.managers.callback,
    });

    this.managers.module.setDependencies({
      menuManager: this.managers.menu,
    });
  }

  async initializeHandlers() {
    const CommandHandler = require("../handlers/CommandHandler");
    this.handlers.command = new CommandHandler(this.bot, {
      moduleManager: this.managers.module,
      menuManager: this.managers.menu,
      userStates: this.userStates,
    });
  }

  setupMenuRouter() {
    // 메인 메뉴
    this.menuRouter.set("main", {
      handler: this.handleMainMenu.bind(this),
      submenus: ["start", "help", "status", "cancel"],
    });

    // 모듈 선택 메뉴
    this.messageHandler = new MessageHandler(this.bot, {
      moduleManager: this.managers.module,
      menuManager: this.managers.menu,
      callbackManager: this.managers.callback,
      userStates: this.userStates,
    });

    // 설정 메뉴
    this.menuRouter.set("settings", {
      handler: this.handleSettings.bind(this),
      submenus: ["language", "notifications", "back"],
    });
  }

  registerEventListeners() {
    // 메시지 이벤트
    this.bot.on("message", this.handleMessage.bind(this));

    // 콜백 쿼리 이벤트
    this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

    // 인라인 쿼리 이벤트
    this.bot.on("inline_query", this.handleInlineQuery.bind(this));

    // 에러 이벤트
    this.bot.on("polling_error", this.handlePollingError.bind(this));

    // 웹훅 에러 (Railway 배포시)
    this.bot.on("webhook_error", this.handleWebhookError.bind(this));
  }

  async handleMessage(msg) {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;

      // 사용자 상태 확인
      const userState = this.getUserState(userId);

      // 명령어 처리
      if (text && text.startsWith("/")) {
        await this.handlers.command.handle(msg);
        return;
      }

      // 상태에 따른 처리
      if (userState && userState.waitingFor) {
        await this.handleUserInput(msg, userState);
        return;
      }

      // 일반 메시지 처리
      await this.managers.message.handle(msg);
    } catch (error) {
      Logger.error("메시지 처리 오류:", error);
      await this.sendErrorMessage(msg.chat.id);
    }
  }

  async handleCallbackQuery(query) {
    try {
      const { data, message } = query;
      const [action, ...params] = data.split(":");

      // 콜백 응답 (버튼 로딩 제거)
      await this.bot.answerCallbackQuery(query.id);

      // 라우터를 통한 처리
      const route = this.menuRouter.get(action);
      if (route) {
        await route.handler(query, params);
        return;
      }

      // 모듈별 콜백 처리
      if (action.startsWith("module_")) {
        await this.managers.module.handleCallback(query, action, params);
        return;
      }

      // 기본 콜백 처리
      await this.managers.callback.handle(query);
    } catch (error) {
      Logger.error("콜백 쿼리 처리 오류:", error);
      await this.bot.answerCallbackQuery(query.id, {
        text: "처리 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  async handleMainMenu(query, params) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const [submenu] = params;

    switch (submenu) {
      case "modules":
        await this.showModuleSelection(chatId, messageId);
        break;
      case "help":
        await this.showHelp(chatId, messageId);
        break;
      case "settings":
        await this.showSettings(chatId, messageId);
        break;
      default:
        await this.bot.editMessageText("알 수 없는 메뉴입니다.", {
          chat_id: chatId,
          message_id: messageId,
        });
    }
  }

  async showModuleSelection(chatId, messageId) {
    const modules = await this.managers.module.getAvailableModules();
    const keyboard = {
      inline_keyboard: modules.map((module) => [
        {
          text: module.name,
          callback_data: `module_select:${module.id}`,
        },
      ]),
    };

    keyboard.inline_keyboard.push([
      {
        text: "⬅️ 뒤로",
        callback_data: "main:back",
      },
    ]);

    await this.bot.editMessageText("사용할 모듈을 선택하세요:", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
    });
  }

  getUserState(userId) {
    return this.userStates.get(userId);
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  async handleUserInput(msg, userState) {
    const { waitingFor, context } = userState;

    switch (waitingFor) {
      case "module_config":
        await this.managers.module.handleConfigInput(msg, context);
        break;
      case "search_query":
        await this.handleSearchQuery(msg, context);
        break;
      default:
        await this.bot.sendMessage(msg.chat.id, "처리할 수 없는 입력입니다.");
    }

    // 상태 초기화
    this.clearUserState(msg.from.id);
  }

  async handlePollingError(error) {
    Logger.error("Polling 오류:", error);
  }

  async handleWebhookError(error) {
    Logger.error("Webhook 오류:", error);
  }

  async handleInlineQuery(query) {
    try {
      // 인라인 쿼리 처리
      const results = await this.managers.module.getInlineResults(query.query);
      await this.bot.answerInlineQuery(query.id, results);
    } catch (error) {
      Logger.error("인라인 쿼리 처리 오류:", error);
    }
  }

  async sendErrorMessage(chatId) {
    await this.bot.sendMessage(
      chatId,
      "죄송합니다. 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    );
  }

  async shutdown() {
    try {
      Logger.info("BotController 종료 시작...");

      // 모든 매니저 종료
      for (const manager of Object.values(this.managers)) {
        if (manager.shutdown) {
          await manager.shutdown();
        }
      }

      // 데이터베이스 연결 종료
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      // 사용자 상태 초기화
      this.userStates.clear();

      Logger.info("BotController 종료 완료");
    } catch (error) {
      Logger.error("BotController 종료 오류:", error);
    }
  }
}

module.exports = BotController;
