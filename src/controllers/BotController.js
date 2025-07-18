// src/controllers/BotController.js - 개선된 버전 3
const Logger = require("../utils/Logger");
const MessageHandler = require("../handlers/MessageHandler");
const CommandHandler = require("../handlers/CommandHandler");

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
    this.menuRouter.set("main", {
      handler: this.managers.message.showMainMenu.bind(this.managers.message),
      submenus: ["start", "help", "status", "cancel"],
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

  // 콜백 쿼리 처리 메서드
  async handleCallbackQuery(query) {
    try {
      // query 검증
      if (!query || !query.message) {
        Logger.error("잘못된 콜백 쿼리 형식");
        return;
      }

      const { data, message, from } = query;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      const userId = from.id;

      Logger.info("콜백 쿼리 처리", {
        data,
        chatId,
        userId,
        messageId,
      });

      // 콜백 응답 (버튼 로딩 제거)
      await this.bot.answerCallbackQuery(query.id);

      // data가 없는 경우
      if (!data) {
        Logger.warn("콜백 데이터가 없음");
        return;
      }

      // 콜백 데이터 파싱
      const [action, ...params] = data.split(":");

      // 콜백 라우터
      switch (action) {
        case "main":
          // 메인 관련 액션
          if (params[0] === "menu") {
            await this.showMainMenu(chatId, messageId, userId);
          } else if (params[0] === "modules") {
            await this.showModuleList(chatId, messageId, userId);
          }
          break;

        case "menu":
          // 메뉴 관련 액션
          if (this.menuManager) {
            await this.menuManager.showMenu(
              chatId,
              params[0],
              messageId,
              userId
            );
          }
          break;

        case "module":
          // 모듈 관련 액션
          if (params[0] === "list") {
            await this.showModuleList(chatId, messageId, userId);
          } else if (params[0] === "select" && params[1]) {
            await this.selectModule(chatId, messageId, userId, params[1]);
          } else if (this.moduleManager) {
            await this.moduleManager.handleCallback(query, action, params);
          }
          break;

        case "settings":
          // 설정 관련 액션
          await this.handleSettingsCallback(query, params);
          break;

        case "help":
          // 도움말 관련 액션
          await this.handleHelpCallback(query, params);
          break;

        case "setlang":
          // 언어 설정
          await this.handleLanguageChange(query, params[0]);
          break;

        case "toggle_notification":
          // 알림 토글
          await this.handleNotificationToggle(query, params[0]);
          break;

        default:
          // 기본 콜백 매니저로 전달
          if (this.callbackManager) {
            const handled = await this.callbackManager.handle(query);
            if (!handled) {
              Logger.warn(`처리되지 않은 콜백: ${action}`);
            }
          }
      }
    } catch (error) {
      Logger.error("콜백 쿼리 처리 오류:", error);

      // 에러 발생 시 사용자에게 알림
      if (query && query.id) {
        try {
          await this.bot.answerCallbackQuery(query.id, {
            text: "처리 중 오류가 발생했습니다.",
            show_alert: true,
          });
        } catch (e) {
          Logger.error("콜백 응답 오류:", e);
        }
      }
    }
  }

  // 도움말 콜백 처리
  async handleHelpCallback(query, params) {
    const { message } = query;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    const helpText =
      "❓ *도움말*\n\n" +
      "• 모듈 선택: 사용하고 싶은 기능을 선택하세요\n" +
      "• 설정: 언어, 알림 등을 변경할 수 있습니다\n" +
      "• 명령어: /help 를 입력하면 전체 명령어를 볼 수 있습니다";

    const keyboard = {
      inline_keyboard: [[{ text: "⬅️ 메인 메뉴", callback_data: "main:menu" }]],
    };

    await this.bot.editMessageText(helpText, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  // 언어 변경 처리
  async handleLanguageChange(query, language) {
    const { message } = query;
    const chatId = message.chat.id;
    const userId = query.from.id;

    // 여기서 실제로 언어 설정을 저장
    // await this.saveUserLanguage(userId, language);

    const languages = {
      ko: "한국어",
      en: "English",
      ja: "日本語",
    };

    await this.bot.answerCallbackQuery(query.id, {
      text: `언어가 ${languages[language] || language}로 변경되었습니다.`,
      show_alert: true,
    });

    // 설정 메뉴로 돌아가기
    await this.showSettingsMenu(chatId, message.message_id);
  }

  // 알림 토글 처리
  async handleNotificationToggle(query, enabled) {
    const userId = query.from.id;
    const isEnabled = enabled === "true";

    // 여기서 실제로 알림 설정을 저장
    // await this.saveNotificationSetting(userId, isEnabled);

    await this.bot.answerCallbackQuery(query.id, {
      text: `알림이 ${isEnabled ? "켜졌습니다" : "꺼졌습니다"}.`,
      show_alert: true,
    });

    // 알림 설정 메뉴 새로고침
    await this.showNotificationSettings(
      query.message.chat.id,
      query.message.message_id,
      userId
    );
  }

  // 메인 메뉴 표시 메서드
  async showMainMenu(chatId, messageId, userId) {
    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: "📱 모듈", callback_data: "module:list" }],
          [{ text: "⚙️ 설정", callback_data: "settings:main" }],
          [{ text: "❓ 도움말", callback_data: "help:main" }],
        ],
      };

      const text = "🤖 두목 봇 메인 메뉴\n\n원하는 기능을 선택하세요:";

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      Logger.error("메인 메뉴 표시 오류:", error);
      throw error;
    }
  }

  // 모듈 목록 표시
  async showModuleList(chatId, messageId, userId) {
    try {
      const modules = await this.moduleManager.getAvailableModules(userId);

      const keyboard = {
        inline_keyboard: [
          ...modules.map((m) => [
            {
              text: `${m.icon} ${m.name}`,
              callback_data: `module:select:${m.id}`,
            },
          ]),
          [{ text: "⬅️ 뒤로", callback_data: "main:menu" }],
        ],
      };

      const text =
        "📱 사용 가능한 모듈:\n\n" +
        modules.map((m) => `${m.icon} ${m.name} - ${m.description}`).join("\n");

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("모듈 목록 표시 오류:", error);
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

  // 설정 콜백 처리 메서드
  // BotController.js에 추가할 메서드들

  async handleSettingsCallback(query, params) {
    try {
      const { message } = query;
      const chatId = message.chat.id;
      const messageId = message.message_id;
      const userId = query.from.id;
      const [action] = params;

      switch (action) {
        case "main":
          await this.showSettingsMenu(chatId, messageId);
          break;

        case "language":
          await this.showLanguageSettings(chatId, messageId);
          break;

        case "notifications":
          await this.showNotificationSettings(chatId, messageId, userId);
          break;

        case "profile":
          await this.showProfileSettings(chatId, messageId, userId);
          break;

        default:
          Logger.warn(`알 수 없는 설정 액션: ${action}`);
      }
    } catch (error) {
      Logger.error("설정 콜백 처리 오류:", error);
      throw error;
    }
  }

  async showSettingsMenu(chatId, messageId) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🌐 언어 설정", callback_data: "settings:language" }],
        [{ text: "🔔 알림 설정", callback_data: "settings:notifications" }],
        [{ text: "👤 프로필 설정", callback_data: "settings:profile" }],
        [{ text: "⬅️ 메인 메뉴", callback_data: "main:menu" }],
      ],
    };

    const text = "⚙️ *설정*\n\n변경하고 싶은 항목을 선택하세요:";

    await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  async showLanguageSettings(chatId, messageId) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🇰🇷 한국어", callback_data: "setlang:ko" }],
        [{ text: "🇺🇸 English", callback_data: "setlang:en" }],
        [{ text: "🇯🇵 日本語", callback_data: "setlang:ja" }],
        [{ text: "⬅️ 뒤로", callback_data: "settings:main" }],
      ],
    };

    const text = "🌐 *언어 설정*\n\n사용할 언어를 선택하세요:";

    await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  async showNotificationSettings(chatId, messageId, userId) {
    // 현재 알림 설정 상태 (나중에 DB에서 가져오기)
    const notificationsEnabled = true;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: notificationsEnabled ? "🔔 알림 켜짐" : "🔕 알림 꺼짐",
            callback_data: `toggle_notification:${!notificationsEnabled}`,
          },
        ],
        [{ text: "⬅️ 뒤로", callback_data: "settings:main" }],
      ],
    };

    const text = `🔔 *알림 설정*\n\n현재 상태: ${notificationsEnabled ? "켜짐" : "꺼짐"}`;

    await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  async showProfileSettings(chatId, messageId, userId) {
    // 사용자 정보 가져오기
    const user = await this.bot.getChat(userId);

    const text =
      `👤 *프로필 정보*\n\n` +
      `이름: ${user.first_name || "N/A"}\n` +
      `성: ${user.last_name || "N/A"}\n` +
      `사용자명: @${user.username || "N/A"}\n` +
      `ID: \`${userId}\``;

    const keyboard = {
      inline_keyboard: [[{ text: "⬅️ 뒤로", callback_data: "settings:main" }]],
    };

    await this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown",
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
