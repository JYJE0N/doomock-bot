// src/modules/SystemModule.js - 완전한 시스템 모듈 구현

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const Logger = require("../utils/Logger");
const config = require("../config/config");

class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      commands: ["start", "help", "status", "cancel"],
      callbacks: ["system", "main", "help", "settings", "module"],
      features: ["menu", "help", "settings", "status"],
      priority: 0, // 최우선
      required: true, // 필수 모듈
    });

    this.bot = bot;
    this.moduleManager = options.moduleManager;

    Logger.info("🏠 SystemModule 생성됨");
  }

  // ✅ 표준 초기화
  async initialize() {
    await super.initialize();

    // 시스템 액션 등록
    this.registerActions();

    Logger.success("🏠 SystemModule 초기화 완료");
  }

  // 🎯 액션 등록
  registerActions() {
    // 메인 메뉴 관련
    this.actionMap.set("main", this.showMainMenu.bind(this));
    this.actionMap.set("menu", this.showMainMenu.bind(this));

    // 도움말 관련
    this.actionMap.set("help", this.showHelpMenu.bind(this));
    this.actionMap.set("help:main", this.showHelpMenu.bind(this));

    // 설정 관련
    this.actionMap.set("settings", this.showSettingsMenu.bind(this));
    this.actionMap.set("settings:main", this.showSettingsMenu.bind(this));

    // 모듈 관련
    this.actionMap.set("module", this.showModuleList.bind(this));
    this.actionMap.set("module:list", this.showModuleList.bind(this));

    // 상태 관련
    this.actionMap.set("status", this.showBotStatus.bind(this));

    Logger.debug("🎯 SystemModule 액션 등록 완료");
  }

  // ✅ 메시지 처리 (표준 매개변수)
  async handleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    // 시스템 명령어들
    switch (text.toLowerCase()) {
      case "/start":
        await this.showMainMenu(bot, chatId, null, userId, userName);
        return true;

      case "/help":
        await this.showHelpMenu(bot, chatId, null, userId, userName);
        return true;

      case "/status":
        await this.showBotStatus(bot, chatId, null, userId, userName);
        return true;

      case "/cancel":
        await this.handleCancel(bot, chatId, null, userId, userName);
        return true;

      default:
        return false;
    }
  }

  // ✅ 콜백 처리 (표준 매개변수)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      // 액션 매핑에서 찾기
      if (this.actionMap.has(subAction)) {
        const actionHandler = this.actionMap.get(subAction);
        await actionHandler(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      }

      // 직접 처리
      switch (subAction) {
        case "main":
        case "main_menu":
          await this.showMainMenu(bot, chatId, messageId, userId, userName);
          return true;

        case "help":
        case "help_menu":
        case "help:main":
          await this.showHelpMenu(bot, chatId, messageId, userId, userName);
          return true;

        case "settings":
        case "settings:main":
          await this.showSettingsMenu(bot, chatId, messageId, userId, userName);
          return true;

        case "module":
        case "module:list":
          await this.showModuleList(bot, chatId, messageId, userId, userName);
          return true;

        case "cancel":
          await this.handleCancel(bot, chatId, messageId, userId, userName);
          return true;

        default:
          Logger.warn(`SystemModule: 알 수 없는 액션 - ${subAction}`);
          return false;
      }
    } catch (error) {
      Logger.error(`SystemModule 콜백 오류 (${subAction}):`, error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "시스템 메뉴 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // =============== 메뉴 구현들 ===============

  async showMainMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const menuText = `🏠 **${userName}님의 메인 메뉴**

${this.getGreeting()} 👋

🏡 **동탄/화성 지역 특화 서비스**
• 화성 날씨 정보 우선 제공
• 동탄 근무시간 기반 기능

원하는 기능을 선택해주세요:`;

    // 실제 로드된 모듈들만 표시
    const availableModules = await this.getAvailableModules();

    const keyboard = {
      inline_keyboard: [
        // 첫 번째 줄 - 주요 모듈들
        ...this.createModuleButtons(availableModules.slice(0, 4)),

        // 마지막 줄 - 시스템 메뉴들
        [
          { text: "⚙️ 설정", callback_data: "system:settings" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    if (messageId) {
      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await bot.sendMessage(chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  async showHelpMenu(bot, chatId, messageId, userId, userName) {
    const helpText = `❓ **두목 봇 도움말**
버전: ${config.bot.version}

🤖 **기본 명령어:**
• /start - 봇 시작 및 메인 메뉴
• /help - 도움말 보기  
• /status - 상태 확인
• /cancel - 작업 취소

📱 **모듈 기능:**
• 📝 할일 관리 - 할일 추가/완료/삭제
• 🔮 운세 - 다양한 운세 정보
• 🌤️ 날씨 - 실시간 날씨 예보
• ⏰ 타이머 - 작업 시간 관리
• 🛠️ 유틸리티 - TTS 등 편의 기능

💡 **사용 팁:**
• 버튼으로 쉽게 탐색 가능
• 각 모듈별 상세 도움말 제공
• 언제든 /cancel로 작업 취소

🆘 **문의:** @doomock_support`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showSettingsMenu(bot, chatId, messageId, userId, userName) {
    const settingsText = `⚙️ **${userName}님의 설정**

봇 설정을 관리하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 알림 설정", callback_data: "settings:notifications" },
          { text: "🌐 언어 설정", callback_data: "settings:language" },
        ],
        [
          { text: "🎨 테마 설정", callback_data: "settings:theme" },
          { text: "⏰ 시간대 설정", callback_data: "settings:timezone" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, settingsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showModuleList(bot, chatId, messageId, userId, userName) {
    const availableModules = await this.getAvailableModules();

    const moduleText = `📱 **사용 가능한 모듈**

🔧 현재 로드된 모듈들:
${availableModules
  .map(
    (m) => `• ${m.emoji || "📦"} ${m.name} - ${m.description || "설명 없음"}`
  )
  .join("\n")}

총 ${availableModules.length}개 모듈이 활성화되어 있습니다.`;

    const keyboard = {
      inline_keyboard: [
        ...this.createModuleButtons(availableModules, true),
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, moduleText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showBotStatus(bot, chatId, messageId, userId, userName) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const statusText = `📊 **${config.bot.name} 상태 정보**

${config.emoji.version} 버전: ${config.bot.version}
⏱️ 업타임: ${hours}시간 ${minutes}분  
🌐 환경: ${process.env.NODE_ENV || "development"}
💾 메모리: ${memory}MB
🔧 서버 상태: 정상

📦 로드된 모듈: ${this.moduleManager ? this.moduleManager.modules.size : 0}개
👥 활성 사용자: ${this.stats.uniqueUsers.size}명`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, statusText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async handleCancel(bot, chatId, messageId, userId, userName) {
    // 사용자 상태 초기화
    if (this.moduleManager && this.moduleManager.userStates) {
      this.moduleManager.userStates.delete(userId);
    }

    const cancelText = `✅ **작업이 취소되었습니다**

${userName}님, 진행 중이던 작업을 취소했습니다.
메인 메뉴로 돌아가시겠어요?`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.editOrSendMessage(bot, chatId, messageId, cancelText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // =============== 헬퍼 메서드들 ===============

  async getAvailableModules() {
    if (!this.moduleManager) return [];

    const modules = [];
    for (const [name, moduleData] of this.moduleManager.modules.entries()) {
      if (moduleData.isInitialized && name !== "SystemModule") {
        modules.push({
          name: name.replace("Module", ""),
          description: moduleData.config?.description || "",
          emoji: this.getModuleEmoji(name),
          callback_data: `${name.toLowerCase().replace("module", "")}:menu`,
        });
      }
    }

    return modules;
  }

  createModuleButtons(modules, fullList = false) {
    const buttons = [];
    const itemsPerRow = fullList ? 1 : 2;

    for (let i = 0; i < modules.length; i += itemsPerRow) {
      const row = modules.slice(i, i + itemsPerRow).map((module) => ({
        text: `${module.emoji} ${module.name}`,
        callback_data: module.callback_data,
      }));
      buttons.push(row);
    }

    return buttons;
  }

  getModuleEmoji(moduleName) {
    const emojiMap = {
      TodoModule: "📝",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TimerModule: "⏰",
      LeaveModule: "📅",
      WorktimeModule: "🕐",
      UtilsModule: "🛠️",
      ReminderModule: "🔔",
      InsightModule: "📊",
    };

    return emojiMap[moduleName] || "📦";
  }

  getGreeting() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return "좋은 아침이에요";
    if (hour >= 12 && hour < 18) return "좋은 오후에요";
    if (hour >= 18 && hour < 22) return "좋은 저녁이에요";
    return "늦은 시간이네요";
  }

  async editOrSendMessage(bot, chatId, messageId, text, options = {}) {
    try {
      if (messageId) {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        await bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      Logger.error("메시지 전송 실패:", error);
      // 폴백: 새 메시지 전송
      if (messageId) {
        await bot.sendMessage(chatId, text, options);
      }
    }
  }

  async sendErrorMessage(bot, chatId, message) {
    await bot.sendMessage(chatId, `❌ ${message}`);
  }
}

module.exports = SystemModule;
