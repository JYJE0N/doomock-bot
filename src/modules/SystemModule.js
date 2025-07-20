// src/modules/SystemModule.js - 완벽한 표준화 적용 시스템 모듈

const { StandardizedBaseModule } = require("../core/StandardizedSystem");
const { getUserName } = require("../utils/UserHelper");
let logger;
try {
  logger = require("../utils/Logger");
} catch (error) {
  logger = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
    success: (...args) => console.log("[SUCCESS]", ...args),
  };
}

class SystemModule extends StandardizedBaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      commands: ["start", "help", "status", "cancel"],
      callbacks: ["system", "main", "help", "settings"],
      priority: 0,
      required: true,
    });

    this.bot = bot;
    this.moduleManager = options.moduleManager;

    // 시스템 설정
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
    };

    logger.info("🏠 SystemModule 생성됨 (표준화 적용)");
  }

  // ✅ 표준 초기화
  async initialize() {
    await super.initialize();

    // 시스템 액션 등록
    this.registerSystemActions();

    logger.success("✅ SystemModule 초기화 완료");
  }

  // 🎯 시스템 액션 등록 (중복 없음)
  registerSystemActions() {
    // 메인 메뉴
    this.actionMap.set("main", this.showMainMenu.bind(this));
    this.actionMap.set("menu", this.showMainMenu.bind(this));
    this.actionMap.set("main_menu", this.showMainMenu.bind(this));

    // 도움말
    this.actionMap.set("help", this.showHelpMenu.bind(this));
    this.actionMap.set("help_menu", this.showHelpMenu.bind(this));

    // 설정
    this.actionMap.set("settings", this.showSettingsMenu.bind(this));
    this.actionMap.set("settings_menu", this.showSettingsMenu.bind(this));

    // 상태
    this.actionMap.set("status", this.showBotStatus.bind(this));

    // 취소
    this.actionMap.set("cancel", this.handleCancel.bind(this));

    logger.debug("🎯 SystemModule 액션 등록 완료 (중복 방지)");
  }

  // 🎯 메시지 처리 구현 (표준 매개변수: bot, msg)
  async _processMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    const command = text.toLowerCase().trim();

    // 🎯 명령어 라우팅 (중복 없는 처리)
    switch (command) {
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
        return false; // 다른 모듈이 처리하도록
    }
  }

  // 🎯 콜백 처리 구현 (표준 매개변수: bot, callbackQuery, subAction, params, menuManager)
  async _processCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    // 🎯 액션 라우팅 (중복 방지)
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

      // 콜백 응답 (중복 방지)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        // 콜백이 이미 응답되었거나 만료된 경우 무시
        logger.debug("콜백 응답 건너뜀:", error.message);
      }

      return true;
    }

    logger.warn(`SystemModule: 알 수 없는 액션 - ${subAction}`);
    return false;
  }

  // =============== 메뉴 구현들 ===============

  async showMainMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const currentTime = this.timeManager.getKoreanTimeString();
    const greeting = this.getTimeBasedGreeting();

    const menuText = `🏠 **${userName}님의 메인 메뉴**

${greeting} 👋

🕐 현재 시간: ${currentTime}
🌍 지역: 화성/동탄 특화 서비스

원하는 기능을 선택해주세요:`;

    // 🎯 사용 가능한 모듈들 조회 (중복 없음)
    const availableModules = await this.getAvailableModules();
    const moduleButtons = this.createModuleButtons(availableModules);

    const keyboard = {
      inline_keyboard: [
        ...moduleButtons,
        [
          { text: "⚙️ 설정", callback_data: "system:settings" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [{ text: "📊 상태", callback_data: "system:status" }],
      ],
    };

    await this.sendOrEditMessage(bot, chatId, messageId, menuText, keyboard);
  }

  async showHelpMenu(bot, chatId, messageId, userId, userName) {
    const helpText = `❓ **두목 봇 도움말**
버전: ${this.config.version}
환경: ${this.config.environment}

🤖 **기본 명령어:**
• /start - 봇 시작 및 메인 메뉴
• /help - 도움말 (현재 메뉴)
• /status - 봇 상태 확인
• /cancel - 현재 작업 취소

📱 **사용법:**
1. 버튼을 눌러 기능 선택
2. 명령어 직접 입력
3. /cancel로 언제든 취소

🏡 **특화 기능:**
• 화성/동탄 날씨 정보
• 근무시간 기반 알림
• 한국시간 정확 지원

📞 **문의:**
관리자에게 문의하시거나 /status로 봇 상태를 확인해보세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.sendOrEditMessage(bot, chatId, messageId, helpText, keyboard);
  }

  async showSettingsMenu(bot, chatId, messageId, userId, userName) {
    const settingsText = `⚙️ **봇 설정**

🔧 **현재 설정:**
• 언어: 한국어
• 시간대: 한국시간 (UTC+9)
• 알림: 활성화
• 지역: 화성/동탄

📱 **개인화 옵션:**
• 닉네임: ${userName}
• 마지막 활동: ${this.stats.lastActivity || "정보 없음"}

⚡ **성능 정보:**
• 메시지 처리: ${this.stats.messageCount}회
• 콜백 처리: ${this.stats.callbackCount}회
• 오류 발생: ${this.stats.errorCount}회`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 알림 설정", callback_data: "system:notifications" },
          { text: "🌍 지역 설정", callback_data: "system:region" },
        ],
        [{ text: "🗑️ 데이터 초기화", callback_data: "system:reset" }],
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.sendOrEditMessage(
      bot,
      chatId,
      messageId,
      settingsText,
      keyboard
    );
  }

  async showBotStatus(bot, chatId, messageId, userId, userName) {
    const uptime = Math.round(process.uptime());
    const memoryUsage = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );
    const currentTime = this.timeManager.getKoreanTimeString();

    // 모듈 상태 조회
    const moduleStatus = this.moduleManager
      ? `${this.moduleManager.modules.size}개 로드됨`
      : "정보 없음";

    const statusText = `📊 **봇 상태 정보**

⏰ **시간 정보:**
• 현재 시간: ${currentTime}
• 업타임: ${Math.floor(uptime / 3600)}시간 ${Math.floor((uptime % 3600) / 60)}분
• 시작 시간: ${this.timeManager.getKoreanTimeString()}

💻 **시스템 정보:**
• 메모리 사용: ${memoryUsage}MB
• 환경: ${this.config.environment}
• Railway: ${this.config.isRailway ? "YES" : "NO"}
• 버전: ${this.config.version}

📦 **모듈 상태:**
• 로드된 모듈: ${moduleStatus}
• 중복 방지: ✅ 활성화
• 표준화: ✅ 적용됨

📈 **이 세션 통계:**
• 메시지 처리: ${this.stats.messageCount}회
• 콜백 처리: ${this.stats.callbackCount}회
• 오류 발생: ${this.stats.errorCount}회`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "📋 상세 로그", callback_data: "system:logs" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.sendOrEditMessage(bot, chatId, messageId, statusText, keyboard);
  }

  async handleCancel(bot, chatId, messageId, userId, userName) {
    // 사용자 상태 초기화 (ModuleManager를 통해)
    if (this.moduleManager && this.moduleManager.clearUserState) {
      this.moduleManager.clearUserState(userId);
    }

    const cancelText = `❌ **작업 취소**

모든 진행 중인 작업이 취소되었습니다.
메인 메뉴로 돌아갑니다.

🔄 언제든 새로 시작하실 수 있습니다.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.sendOrEditMessage(bot, chatId, messageId, cancelText, keyboard);
  }

  // =============== 유틸리티 메서드들 ===============

  // 🇰🇷 시간 기반 인사말
  getTimeBasedGreeting() {
    const hour = this.timeManager.getKoreanTime().getHours();

    if (hour < 6) return "새벽에도 수고하고 계시네요! 🌙";
    if (hour < 9) return "좋은 아침입니다! ☀️";
    if (hour < 12) return "활기찬 오전 보내세요! 🌤️";
    if (hour < 14) return "점심시간 맛있게 드세요! 🍽️";
    if (hour < 18) return "오후도 화이팅입니다! 💪";
    if (hour < 21) return "저녁 시간 잘 보내세요! 🌆";
    return "늦은 시간까지 수고하세요! 🌃";
  }

  // 사용 가능한 모듈 조회
  async getAvailableModules() {
    if (!this.moduleManager) return [];

    const modules = Array.from(this.moduleManager.modules.values())
      .filter(
        (module) => module.isInitialized && module.name !== "SystemModule"
      )
      .map((module) => ({
        name: module.name,
        emoji: this.getModuleEmoji(module.name),
        callback: module.name.toLowerCase().replace("module", ""),
      }));

    return modules;
  }

  // 모듈 이모지 매핑
  getModuleEmoji(moduleName) {
    const emojiMap = {
      TodoModule: "📝",
      WeatherModule: "🌤️",
      FortuneModule: "🔮",
      WorktimeModule: "⏰",
      UtilsModule: "🛠️",
    };
    return emojiMap[moduleName] || "📦";
  }

  // 모듈 버튼 생성
  createModuleButtons(modules) {
    const buttons = [];
    for (let i = 0; i < modules.length; i += 2) {
      const row = [];
      row.push({
        text: `${modules[i].emoji} ${modules[i].name.replace("Module", "")}`,
        callback_data: `${modules[i].callback}:menu`,
      });

      if (modules[i + 1]) {
        row.push({
          text: `${modules[i + 1].emoji} ${modules[i + 1].name.replace(
            "Module",
            ""
          )}`,
          callback_data: `${modules[i + 1].callback}:menu`,
        });
      }

      buttons.push(row);
    }
    return buttons;
  }

  // 메시지 전송/편집 통합
  async sendOrEditMessage(bot, chatId, messageId, text, keyboard) {
    const options = {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    };

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
      logger.error("메시지 전송/편집 오류:", error);

      // 폴백: 새 메시지 전송
      if (messageId && error.message.includes("message is not modified")) {
        // 메시지가 동일한 경우 무시
        return;
      }

      try {
        await bot.sendMessage(chatId, text, options);
      } catch (fallbackError) {
        logger.error("폴백 메시지 전송도 실패:", fallbackError);
      }
    }
  }
}

module.exports = SystemModule;
