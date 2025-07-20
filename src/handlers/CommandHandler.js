// src/handlers/CommandHandler.js - 예쁘고 간결한 v3.0.1
const Logger = require("../utils/Logger");
const config = require("../config/config");

class CommandHandler {
  constructor(bot, dependencies) {
    this.bot = bot;
    this.moduleManager = dependencies.moduleManager;
    this.menuManager = dependencies.menuManager;
    this.userStates = dependencies.userStates;

    // 🎯 명령어 라우터 초기화
    this.commandRouter = new Map();
    this._setupRoutes();

    Logger.debug(
      `🎯 CommandHandler 초기화: ${this.commandRouter.size}개 명령어 등록`
    );
  }

  // =============== 🎨 라우터 설정 ===============

  _setupRoutes() {
    // 🏠 시스템 핵심 명령어 - 깔끔하게 정리
    const systemCommands = {
      "/start": this._handleStart,
      "/help": this._handleHelp,
      "/status": this._handleStatus,
      "/cancel": this._handleCancel,
      "/modules": this._handleModules,
    };

    // 🔧 관리자 명령어
    const adminCommands = {
      "/admin": this._handleAdmin,
    };

    // 📦 한 번에 등록
    this._registerCommands({ ...systemCommands, ...adminCommands });
  }

  _registerCommands(commands) {
    Object.entries(commands).forEach(([command, handler]) => {
      this.commandRouter.set(command, handler.bind(this));
    });
  }

  // =============== 🚀 메인 핸들러 ===============

  async handle(msg) {
    try {
      if (!this._isValidMessage(msg)) return;

      const { command, args, userId } = this._parseMessage(msg);
      if (!command) return;

      Logger.info(
        `🎯 명령어 처리: /${command} | userId=${userId}, userName=${msg.from.first_name}, args=${args.length}, fullCommand=${msg.text}`
      );

      // 🎯 라우팅 처리
      await this._routeCommand(msg, command, args);
    } catch (error) {
      Logger.error("CommandHandler 오류:", error);
      await this._sendErrorMessage(msg.chat?.id, error);
    }
  }

  // =============== 🔍 헬퍼 메서드들 ===============

  _isValidMessage(msg) {
    if (!msg?.text?.startsWith("/")) return false;
    if (!msg.text) {
      Logger.warn("텍스트가 없는 메시지");
      return false;
    }
    return true;
  }

  _parseMessage(msg) {
    const parts = msg.text.split(" ").filter(Boolean);
    const commandWithSlash = parts[0];
    const command = commandWithSlash.substring(1).replace(/@\w+$/, ""); // 멘션 제거
    const args = parts.slice(1);
    const userId = msg.from.id;

    return { command, args, userId };
  }

  async _routeCommand(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      // 1️⃣ 시스템 명령어 우선 처리
      const systemHandler = this.commandRouter.get(`/${command}`);
      if (systemHandler) {
        await systemHandler(msg, command, args);
        return;
      }

      // 2️⃣ 모듈 명령어 처리
      if (this.moduleManager) {
        const moduleHandled = await this.moduleManager.handleCommand?.(
          msg,
          command,
          args
        );
        if (moduleHandled) return;
      }

      // 3️⃣ 알 수 없는 명령어
      await this._handleUnknownCommand(msg, command);
    } catch (error) {
      Logger.error(`명령어 처리 실패 [${command}]:`, error);
      await this._sendErrorMessage(chatId, error);
    }
  }

  // =============== 🏠 시스템 명령어 핸들러들 ===============

  async _handleStart(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId, first_name },
    } = msg;
    const userName = first_name || "사용자";

    try {
      // 사용자 상태 초기화
      this.userStates?.delete(userId);

      // 딥링크 처리
      if (args?.length > 0) {
        await this._handleDeepLink(msg, args[0]);
        return;
      }

      // 🎨 예쁜 환영 메시지
      const welcomeText = `안녕하세요 ${userName}님! 👋

🤖 *두목 봇 v${config.bot.version}*에 오신 것을 환영합니다.

아래 메뉴에서 원하는 기능을 선택해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "📱 모듈 선택", callback_data: "module:list" }],
          [{ text: "⚙️ 설정", callback_data: "settings:main" }],
          [{ text: "❓ 도움말", callback_data: "help:main" }],
        ],
      };

      await this.bot.sendMessage(chatId, welcomeText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      Logger.info(`Start 명령어 처리 완료: ${userName} (${userId})`);
    } catch (error) {
      Logger.error("Start 명령어 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "봇을 시작하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    }
  }

  async _handleHelp(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      // 특정 모듈 도움말
      if (args?.length > 0) {
        const moduleHelp = await this.moduleManager?.getModuleHelp?.(args[0]);
        if (moduleHelp) {
          await this.bot.sendMessage(chatId, moduleHelp, {
            parse_mode: "Markdown",
          });
          return;
        }
      }

      // 🎨 예쁜 전체 도움말
      const helpText = `📖 *두목 봇 도움말*
버전: ${config.bot.version}

*✨ 기본 명령어:*
• /start - 봇 시작 및 메인 메뉴
• /help - 도움말 보기  
• /modules - 사용 가능한 모듈 목록
• /status - 현재 상태 확인
• /cancel - 현재 작업 취소

*💡 팁:*
각 모듈을 선택한 후 도움말 버튼을 누르거나
\`/help [모듈이름]\` 명령어를 사용하세요.

*🆘 문의:*
문제가 있으시면 @doomock\\_support 로 연락주세요.`;

      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (error) {
      Logger.error("Help 명령어 처리 오류:", error);
      // 마크다운 실패 시 기본 텍스트
      await this.bot.sendMessage(
        chatId,
        "📖 두목 봇 도움말 (v3.0.1)\n\n기본 명령어:\n• /start - 봇 시작\n• /help - 도움말\n• /modules - 모듈 목록\n• /status - 상태 확인\n• /cancel - 작업 취소"
      );
    }
  }

  async _handleModules(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      const modules = (await this.moduleManager?.getAvailableModules?.()) || [];

      if (modules.length === 0) {
        await this.bot.sendMessage(chatId, "사용 가능한 모듈이 없습니다.");
        return;
      }

      const moduleList = modules
        .map((m) => `• *${m.name}* - ${m.description}`)
        .join("\n");

      const text = `*📱 사용 가능한 모듈:*

${moduleList}`;

      const keyboard = {
        inline_keyboard: modules.map((m) => [
          {
            text: m.name,
            callback_data: `module_select:${m.id}`,
          },
        ]),
      };

      await this.bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("Modules 명령어 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "모듈 목록을 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async _handleStatus(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      // 사용자 상태
      const userState = this.userStates?.get(userId);
      const stateText = userState?.waitingFor || "대기 중";

      // 활성 모듈
      const activeModule = await this.moduleManager?.getActiveModule?.(userId);
      const moduleText = activeModule?.name || "없음";

      // 업타임 계산
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      const statusText = `*📊 ${config.bot.name} 상태 정보*

🔄 현재 상태: ${stateText}
📱 활성 모듈: ${moduleText}

${config.emoji.version} 버전: ${config.bot.version}
⏱️ 업타임: ${hours}시간 ${minutes}분  
🌐 환경: ${process.env.NODE_ENV || "development"}
💾 메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
🔧 서버 상태: 정상`;

      await this.bot.sendMessage(chatId, statusText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      Logger.error("Status 명령어 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "상태 정보를 가져오는 중 오류가 발생했습니다."
      );
    }
  }

  async _handleCancel(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      const userState = this.userStates?.get(userId);

      if (!userState) {
        await this.bot.sendMessage(chatId, "취소할 작업이 없습니다.");
        return;
      }

      // 상태 초기화
      this.userStates.delete(userId);

      // 모듈에 취소 알림
      if (userState.moduleId) {
        await this.moduleManager?.cancelModuleAction?.(
          userId,
          userState.moduleId
        );
      }

      await this.bot.sendMessage(chatId, "✅ 작업이 취소되었습니다.", {
        reply_markup: { remove_keyboard: true },
      });
    } catch (error) {
      Logger.error("Cancel 명령어 처리 오류:", error);
      await this.bot.sendMessage(chatId, "작업 취소 중 오류가 발생했습니다.");
    }
  }

  async _handleAdmin(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      const isAdmin = await this._checkAdminPermission(userId);

      if (!isAdmin) {
        await this.bot.sendMessage(chatId, "❌ 관리자 권한이 필요합니다.");
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "📊 통계", callback_data: "admin:stats" }],
          [{ text: "🔧 모듈 관리", callback_data: "admin:modules" }],
          [{ text: "👥 사용자 관리", callback_data: "admin:users" }],
          [{ text: "⬅️ 뒤로", callback_data: "main:back" }],
        ],
      };

      await this.bot.sendMessage(chatId, "*🔧 관리자 메뉴*", {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      Logger.error("Admin 명령어 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "관리자 메뉴를 여는 중 오류가 발생했습니다."
      );
    }
  }

  // =============== 🛠️ 유틸리티 메서드들 ===============

  async _handleDeepLink(msg, param) {
    const {
      chat: { id: chatId },
    } = msg;
    const [action, ...data] = param.split("_");

    try {
      switch (action) {
        case "module":
          await this.moduleManager?.activateModule?.(chatId, data[0]);
          break;
        case "share":
          await this._handleShareLink(msg, data);
          break;
        default:
          Logger.warn(`알 수 없는 딥링크: ${param}`);
      }
    } catch (error) {
      Logger.error("딥링크 처리 오류:", error);
    }
  }

  async _handleUnknownCommand(msg, command) {
    const {
      chat: { id: chatId },
    } = msg;

    await this.bot.sendMessage(
      chatId,
      `❓ '/${command}' 는 알 수 없는 명령어입니다.\n💡 /help 를 입력하여 사용 가능한 명령어를 확인하세요.`
    );
  }

  async _checkAdminPermission(userId) {
    const adminIds = process.env.ADMIN_IDS?.split(",") || [];
    return adminIds.includes(userId.toString());
  }

  async _sendErrorMessage(chatId, error) {
    if (!chatId) return;

    const errorText =
      error.userMessage ||
      "🚨 명령어 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.";

    await this.bot.sendMessage(chatId, errorText);
  }

  // =============== 📊 Getter 메서드들 ===============

  get commandCount() {
    return this.commandRouter.size;
  }

  get registeredCommands() {
    return Array.from(this.commandRouter.keys());
  }
}

module.exports = CommandHandler;
