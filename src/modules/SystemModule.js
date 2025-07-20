// src/modules/SystemModule.js - Logger 문제 완전 해결

// ✅ 안전한 logger 획득 함수 (최상단 선언)
const getLogger = () => {
  try {
    return require("../utils/Logger");
  } catch (error) {
    return {
      info: (...args) => console.log("[INFO]", ...args),
      error: (...args) => console.error("[ERROR]", ...args),
      warn: (...args) => console.warn("[WARN]", ...args),
      debug: (...args) => console.log("[DEBUG]", ...args),
      success: (...args) => console.log("[SUCCESS]", ...args),
      trace: (...args) => console.log("[TRACE]", ...args),
    };
  }
};

// 기타 안전한 imports
const { StandardizedBaseModule } = require("../core/StandardizedSystem");
const { getUserName } = require("../utils/UserHelper");

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

    // 안전한 logger 사용
    const logger = getLogger();

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
    const logger = getLogger();

    try {
      await super.initialize();

      // 시스템 액션 등록
      this.registerSystemActions();

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 시스템 액션 등록 (중복 없음)
  registerSystemActions() {
    const logger = getLogger(); // ✅ 함수 내부에서 logger 획득

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
    const logger = getLogger();

    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return false;

    const command = text.toLowerCase().trim();

    // 🎯 명령어 라우팅 (중복 방지)
    try {
      switch (command) {
        case "/start":
        case "시작":
          return await this.handleStart(bot, msg);

        case "/help":
        case "도움말":
        case "help":
          return await this.showHelpMenu(bot, msg);

        case "/status":
        case "상태":
        case "status":
          return await this.showBotStatus(bot, msg);

        case "/cancel":
        case "취소":
        case "cancel":
          return await this.handleCancel(bot, msg);

        default:
          // 다른 모듈이 처리하도록 false 반환
          return false;
      }
    } catch (error) {
      logger.error("SystemModule 메시지 처리 중 오류:", error);
      await this.sendErrorMessage(
        bot,
        chatId,
        "시스템 처리 중 오류가 발생했습니다."
      );
      return true; // 오류이지만 처리했음을 표시
    }
  }

  // 🎯 콜백 처리 구현 (표준 매개변수: bot, callbackQuery, subAction, params, menuManager)
  async _processCallback(bot, callbackQuery, subAction, params, menuManager) {
    const logger = getLogger();

    try {
      const action = this.actionMap.get(subAction);

      if (!action) {
        logger.warn(`알 수 없는 SystemModule 액션: ${subAction}`);
        return false;
      }

      // 액션 실행 (this 바인딩 보장)
      const result = await action(bot, callbackQuery, params);

      if (result !== false) {
        // 콜백 쿼리 응답
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "✅ 처리 완료",
          show_alert: false,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("SystemModule 콜백 처리 중 오류:", error);

      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (answerError) {
        logger.error("콜백 응답 실패:", answerError);
      }

      return true; // 오류이지만 처리했음을 표시
    }
  }

  // =============== 핵심 핸들러들 ===============

  async handleStart(bot, msg) {
    const logger = getLogger();
    const userName = getUserName(msg.from);

    const welcomeMessage = `🤖 *DoomockBot v${
      this.config.version
    }에 오신 것을 환영합니다!*

안녕하세요, ${userName}님! 👋

🎯 *주요 기능:*
• 📝 할 일 관리 (Todo)
• 🔮 운세 확인 (Fortune)  
• 🌤️ 날씨 조회 (Weather)
• 📊 시스템 상태 확인

📱 *시작하기:*
아래 메뉴를 선택하거나 /help 명령어를 입력하세요.

🚀 *환경:* ${this.config.environment}
${
  this.config.isRailway
    ? "☁️ *Railway 클라우드에서 실행 중*"
    : "💻 *로컬 환경에서 실행 중*"
}`;

    try {
      await bot.sendMessage(msg.chat.id, welcomeMessage, {
        parse_mode: "Markdown",
        reply_markup: {
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
        },
      });

      logger.info(`✅ 환영 메시지 전송 완료: ${userName} (${msg.from.id})`);
      return true;
    } catch (error) {
      logger.error("환영 메시지 전송 실패:", error);
      throw error;
    }
  }

  async showMainMenu(bot, callbackQueryOrMsg) {
    const logger = getLogger();

    const mainMenuMessage = `📱 *메인 메뉴*

원하시는 기능을 선택해주세요:

🔹 *할 일 관리* - 작업 추가, 완료, 삭제
🔹 *운세 확인* - 오늘의 운세 보기  
🔹 *날씨 조회* - 현재 날씨 및 예보
🔹 *시스템 정보* - 봇 상태 및 통계`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할 일 관리", callback_data: "todo:main" },
          { text: "🔮 운세 확인", callback_data: "fortune:today" },
        ],
        [
          { text: "🌤️ 날씨 조회", callback_data: "weather:current" },
          { text: "🔧 유틸리티", callback_data: "utils:main" },
        ],
        [
          { text: "📊 시스템 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    try {
      // 콜백 쿼리인지 메시지인지 구분
      if (callbackQueryOrMsg.data) {
        // 콜백 쿼리
        await bot.editMessageText(mainMenuMessage, {
          chat_id: callbackQueryOrMsg.message.chat.id,
          message_id: callbackQueryOrMsg.message.message_id,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        // 일반 메시지
        await bot.sendMessage(callbackQueryOrMsg.chat.id, mainMenuMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }

      logger.debug("✅ 메인 메뉴 표시 완료");
      return true;
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      throw error;
    }
  }

  async showHelpMenu(bot, callbackQueryOrMsg) {
    const logger = getLogger();

    const helpMessage = `❓ *도움말*

🤖 **DoomockBot 사용법**

**📱 기본 명령어:**
• \`/start\` - 봇 시작 및 환영 메시지
• \`/help\` - 이 도움말 표시
• \`/status\` - 봇 상태 확인
• \`/cancel\` - 현재 작업 취소

**📝 할 일 관리:**
• 새 작업 추가, 완료 처리, 삭제
• 우선순위 설정 및 카테고리 분류
• 진행 상황 추적

**🔮 운세 서비스:**
• 오늘의 운세 확인
• 행운의 숫자 및 색깔
• 주간/월간 운세 (추후 업데이트)

**🌤️ 날씨 정보:**
• 현재 날씨 및 온도
• 시간별/일별 예보
• 다양한 지역 날씨 조회

**🔧 기타 기능:**
• 시간 변환 도구
• 계산기 기능
• 봇 통계 및 상태

**💡 팁:** 
메뉴 버튼을 사용하면 더 쉽게 기능에 접근할 수 있습니다!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    try {
      if (callbackQueryOrMsg.data) {
        await bot.editMessageText(helpMessage, {
          chat_id: callbackQueryOrMsg.message.chat.id,
          message_id: callbackQueryOrMsg.message.message_id,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(callbackQueryOrMsg.chat.id, helpMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }

      logger.debug("✅ 도움말 표시 완료");
      return true;
    } catch (error) {
      logger.error("도움말 표시 실패:", error);
      throw error;
    }
  }

  async showBotStatus(bot, callbackQueryOrMsg) {
    const logger = getLogger();

    try {
      // 봇 상태 정보 수집
      const uptime = process.uptime();
      const uptimeString = this.formatUptime(uptime);

      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      const moduleStatus = this.moduleManager
        ? this.moduleManager.getModuleStatus()
        : {};
      const activeModules = Object.keys(moduleStatus).filter(
        (name) => moduleStatus[name].isInitialized
      ).length;

      const statusMessage = `📊 *봇 상태 정보*

🤖 **시스템 정보:**
• 버전: \`v${this.config.version}\`
• 환경: \`${this.config.environment}\`
• 플랫폼: ${this.config.isRailway ? "☁️ Railway" : "💻 로컬"}
• 가동 시간: \`${uptimeString}\`

💾 **리소스 사용량:**
• 메모리 사용: \`${memUsageMB}MB\`
• Node.js 버전: \`${process.version}\`

📦 **모듈 상태:**
• 활성 모듈: \`${activeModules}개\`
• 로드된 모듈: \`${Object.keys(moduleStatus).length}개\`

🔗 **연결 상태:**
• 텔레그램 API: ✅ 정상
• 데이터베이스: ${this.getDatabaseStatus()}

⏰ **마지막 업데이트:** ${new Date().toLocaleString("ko-KR")}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "🔙 메인 메뉴", callback_data: "system:main" },
          ],
        ],
      };

      if (callbackQueryOrMsg.data) {
        await bot.editMessageText(statusMessage, {
          chat_id: callbackQueryOrMsg.message.chat.id,
          message_id: callbackQueryOrMsg.message.message_id,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(callbackQueryOrMsg.chat.id, statusMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }

      logger.debug("✅ 봇 상태 표시 완료");
      return true;
    } catch (error) {
      logger.error("봇 상태 표시 실패:", error);
      throw error;
    }
  }

  async showSettingsMenu(bot, callbackQuery) {
    const logger = getLogger();

    const settingsMessage = `⚙️ *설정*

현재 사용 가능한 설정 옵션들입니다:

🔹 **알림 설정** - 알림 ON/OFF
🔹 **언어 설정** - 한국어/English  
🔹 **시간대 설정** - 한국 표준시
🔹 **데이터 관리** - 사용자 데이터 관리

*주의: 일부 설정은 아직 개발 중입니다.*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔔 알림 설정", callback_data: "system:notifications" },
          { text: "🌐 언어 설정", callback_data: "system:language" },
        ],
        [
          { text: "🕒 시간대 설정", callback_data: "system:timezone" },
          { text: "🗂️ 데이터 관리", callback_data: "system:data" },
        ],
        [{ text: "🔙 메인 메뉴로", callback_data: "system:main" }],
      ],
    };

    try {
      await bot.editMessageText(settingsMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug("✅ 설정 메뉴 표시 완료");
      return true;
    } catch (error) {
      logger.error("설정 메뉴 표시 실패:", error);
      throw error;
    }
  }

  async handleCancel(bot, msg) {
    const logger = getLogger();

    const cancelMessage = "❌ 현재 작업이 취소되었습니다.";

    try {
      await bot.sendMessage(msg.chat.id, cancelMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 메인 메뉴로", callback_data: "system:main" }],
          ],
        },
      });

      logger.debug("✅ 취소 처리 완료");
      return true;
    } catch (error) {
      logger.error("취소 처리 실패:", error);
      throw error;
    }
  }

  // =============== 유틸리티 메서드들 ===============

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

  getDatabaseStatus() {
    // DatabaseManager 상태 확인
    if (this.moduleManager && this.moduleManager.db) {
      return "✅ 연결됨";
    } else {
      return "⚠️ 메모리 모드";
    }
  }

  async sendErrorMessage(
    bot,
    chatId,
    message = "처리 중 오류가 발생했습니다."
  ) {
    const logger = getLogger();

    try {
      await bot.sendMessage(chatId, `❌ ${message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 메인 메뉴로", callback_data: "system:main" }],
          ],
        },
      });
    } catch (error) {
      logger.error("에러 메시지 전송 실패:", error);
    }
  }

  // =============== 정리 작업 ===============

  async cleanup() {
    const logger = getLogger();

    try {
      // 필요한 정리 작업 수행
      logger.info("🧹 SystemModule 정리 작업 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 중 오류:", error);
    }
  }
}

module.exports = SystemModule;
