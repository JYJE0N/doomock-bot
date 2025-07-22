// src/modules/SystemModule.js - 리팩토링된 깔끔한 버전

const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule");

    this.bot = bot;
    this.moduleManager = options.moduleManager;

    // 시스템 설정
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
    };

    logger.info("🏠 SystemModule 생성됨");
  }

  // 🎯 액션 설정
  async setupActions() {
    this.registerActions({
      main: this.showMainMenu,
      menu: this.showMainMenu, // alias
      help: this.showHelp,
      status: this.showStatus,
      settings: this.showSettings,
      cancel: this.handleCancel,
    });
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    const command = text.toLowerCase().trim();

    switch (command) {
      case "/start":
      case "시작":
        await this.handleStart(bot, msg);
        return true;

      case "/help":
      case "도움말":
        await this.sendHelpMessage(bot, chatId);
        return true;

      case "/status":
      case "상태":
        await this.sendStatusMessage(bot, chatId);
        return true;

      case "/cancel":
      case "취소":
        await this.sendCancelMessage(bot, chatId);
        return true;

      default:
        return false;
    }
  }

  // ===== 핵심 액션 메서드들 =====

  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const userName = getUserName(callbackQuery.from);

    const text = `🏠 **메인 메뉴**

안녕하세요! ${userName}님!
무엇을 도와드릴까요?

아래 메뉴에서 원하는 기능을 선택해주세요:`;

    // 🎯 할일 관리를 최우선으로 배치
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
          { text: "⏰ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "🛠️ 유틸리티", callback_data: "utils:menu" },
          { text: "📅 휴가 관리", callback_data: "leave:menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime:menu" },
          { text: "🔔 리마인더", callback_data: "reminder:menu" },
        ],
        [
          { text: "📊 시스템 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });

    logger.info(`🏠 메인 메뉴 표시: ${userName} (${callbackQuery.from.id})`);
    return true;
  }

  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const text = `❓ **도움말**

🤖 **두목봇 사용법**

**📱 기본 명령어:**
• \`/start\` - 봇 시작 및 환영 메시지
• \`/help\` - 이 도움말 표시
• \`/status\` - 봇 상태 확인
• \`/cancel\` - 현재 작업 취소

**📝 주요 기능:**
• 할 일 관리 - 작업 추가/완료/삭제
• 운세 서비스 - 오늘의 운세 확인
• 날씨 정보 - 현재 날씨 및 예보

💡 **팁:** 메뉴 버튼을 사용하면 더 쉽게 기능에 접근할 수 있습니다!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
    });
  }

  async showStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    const text = `📊 **봇 상태 정보**

🤖 **시스템 정보:**
• 버전: \`v${this.config.version}\`
• 환경: \`${this.config.environment}\`
• 플랫폼: ${this.config.isRailway ? "☁️ Railway" : "💻 로컬"}
• 가동 시간: \`${this.formatUptime(uptime)}\`

💾 **리소스 사용량:**
• 메모리 사용: \`${memUsageMB}MB\`
• Node.js 버전: \`${process.version}\`

⏰ **마지막 업데이트:** ${new Date().toLocaleString("ko-KR")}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "🔙 메인 메뉴", callback_data: "system:main" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
    });
  }

  async showSettings(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const text = `⚙️ **설정**

현재 사용 가능한 설정 옵션들입니다:

🔹 **알림 설정** - 알림 ON/OFF
🔹 **언어 설정** - 한국어/English  
🔹 **시간대 설정** - 한국 표준시
🔹 **데이터 관리** - 사용자 데이터 관리

*주의: 일부 설정은 아직 개발 중입니다.*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 알림 설정", callback_data: "settings:notifications" },
          { text: "🌐 언어 설정", callback_data: "settings:language" },
        ],
        [
          { text: "🕒 시간대 설정", callback_data: "settings:timezone" },
          { text: "🗂️ 데이터 관리", callback_data: "settings:data" },
        ],
        [{ text: "🔙 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
    });
  }

  async handleCancel(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const text = "❌ 현재 작업이 취소되었습니다.";
    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 메시지 전용 메서드들 =====

  async handleStart(bot, msg) {
    const userName = getUserName(msg.from);

    const text = `🤖 **두목봇 v${this.config.version}에 오신 것을 환영합니다!**

안녕하세요, ${userName}님! 👋

🎯 **주요 기능:**
• 📝 할 일 관리 (Todo)
• 🔮 운세 확인 (Fortune)  
• 🌤️ 날씨 조회 (Weather)
• 📊 시스템 상태 확인

📱 **시작하기:**
아래 메뉴를 선택하거나 /help 명령어를 입력하세요.

🚀 **환경:** ${this.config.environment}
${
  this.config.isRailway
    ? "☁️ **Railway 클라우드에서 실행 중**"
    : "💻 **로컬 환경에서 실행 중**"
}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📱 메인 메뉴", callback_data: "system:main" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [
          { text: "📊 봇 상태", callback_data: "system:status" },
          { text: "⚙️ 설정", callback_data: "system:settings" },
        ],
      ],
    };

    await this.sendMessage(bot, msg.chat.id, text, { reply_markup: keyboard });
    logger.info(`✅ 환영 메시지 전송: ${userName} (${msg.from.id})`);
  }

  async sendHelpMessage(bot, chatId) {
    const text = `❓ **도움말**

🤖 **두목봇 사용법**

**기본 명령어:**
• /start - 봇 시작
• /help - 도움말 보기
• /status - 상태 확인
• /cancel - 작업 취소`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 메인 메뉴", callback_data: "system:main" }],
      ],
    };

    await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
  }

  async sendStatusMessage(bot, chatId) {
    const uptime = process.uptime();
    const memUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const text = `📊 **봇 상태**

• 버전: v${this.config.version}
• 가동 시간: ${this.formatUptime(uptime)}
• 메모리: ${memUsageMB}MB`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "📱 메인 메뉴", callback_data: "system:main" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
  }

  async sendCancelMessage(bot, chatId) {
    const text = "❌ 현재 작업이 취소되었습니다.";
    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    await this.sendMessage(bot, chatId, text, { reply_markup: keyboard });
  }

  // ===== 유틸리티 메서드 =====

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }
}

module.exports = SystemModule;
