// src/handlers/CommandHandler.js - BotCommandsRegistry 통합된 명령어 핸들러

const logger = require("../utils/Logger");
const config = require("../config/config");
const { getUserName } = require("../utils/UserHelper");

// ⭐ BotCommandsRegistry 참조 추가
const botCommandsRegistry = require("../config/BotCommandsRegistry");

class CommandHandler {
  constructor(bot, dependencies) {
    this.bot = bot;
    this.moduleManager = dependencies.moduleManager;
    this.userStates = dependencies.userStates || new Map();

    // ⭐ BotCommandsRegistry 인스턴스 참조
    this.commandsRegistry =
      dependencies.commandsRegistry || botCommandsRegistry;

    // 🎯 명령어 라우터 초기화 (Registry 기반)
    this.commandRouter = new Map();
    this._setupRoutes();

    // 통계 추적
    this.stats = {
      commandsProcessed: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      startTime: Date.now(),
    };

    logger.debug(
      `🎯 CommandHandler 초기화: ${this.commandRouter.size}개 명령어 등록`
    );
  }

  // =============== 🎨 라우터 설정 ===============

  _setupRoutes() {
    // ⭐ BotCommandsRegistry에서 명령어 매핑 가져오기
    const commandMapping = this.commandsRegistry.getCommandMapping();

    // 🏠 시스템 핵심 명령어 등록
    const systemCommands = {
      "/start": this._handleStart,
      "/help": this._handleHelp,
      "/status": this._handleStatus,
      "/cancel": this._handleCancel,
    };

    // 🔧 관리자 명령어
    const adminCommands = {
      "/admin": this._handleAdmin,
    };

    // 📦 Registry 기반 명령어 등록
    for (const [command, config] of commandMapping) {
      if (config.category === "system") {
        // 시스템 명령어는 직접 핸들러 등록
        if (systemCommands[command]) {
          this.commandRouter.set(command, systemCommands[command].bind(this));
        }
      } else if (config.category === "admin") {
        // 관리자 명령어
        if (adminCommands[command]) {
          this.commandRouter.set(command, adminCommands[command].bind(this));
        }
      } else {
        // 모듈 명령어는 ModuleManager로 위임
        this.commandRouter.set(command, this._handleModuleCommand.bind(this));
      }
    }

    logger.info(`📋 ${this.commandRouter.size}개 명령어 라우터 설정 완료`);
  }

  // =============== 🚀 메인 핸들러 ===============

  async handle(msg) {
    try {
      if (!this._isValidMessage(msg)) return;

      const { command, args, userId } = this._parseMessage(msg);
      if (!command) return;

      this.stats.commandsProcessed++;

      logger.info(
        `🎯 명령어 처리: /${command} | userId=${userId}, userName=${msg.from.first_name}, args=${args.length}`
      );

      // ⭐ 명령어 검증 (Registry 기반)
      const validationResult = this.commandsRegistry.validateCommand(
        command,
        userId,
        await this._getUserRole(userId)
      );

      if (!validationResult.valid) {
        await this._sendValidationError(msg.chat.id, validationResult.error);
        this.stats.failedCommands++;
        return;
      }

      // 🎯 라우팅 처리
      await this._routeCommand(msg, command, args);
      this.stats.successfulCommands++;
    } catch (error) {
      logger.error("CommandHandler 오류:", error);
      this.stats.failedCommands++;
      await this._sendErrorMessage(msg.chat?.id, error);
    }
  }

  // =============== 🔍 헬퍼 메서드들 ===============

  _isValidMessage(msg) {
    if (!msg?.text?.startsWith("/")) return false;
    if (!msg.text) {
      logger.warn("텍스트가 없는 메시지");
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
      // 1️⃣ 등록된 명령어 핸들러 확인
      const handler = this.commandRouter.get(`/${command}`);
      if (handler) {
        await handler(msg, command, args);
        return;
      }

      // 2️⃣ 알 수 없는 명령어 처리
      await this._handleUnknownCommand(msg, command);
      this.stats.unknownCommands++;
    } catch (error) {
      logger.error(`명령어 라우팅 실패 [${command}]:`, error);
      await this._sendErrorMessage(chatId, error);
      throw error;
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

      // ⭐ Registry 기반 모듈 목록 생성
      const moduleCommands = Array.from(
        this.commandsRegistry.moduleCommands.values()
      )
        .filter((cmd) => cmd.isPublic)
        .slice(0, 8); // 최대 8개만 표시

      // 🎨 예쁜 환영 메시지
      const welcomeText = `안녕하세요 ${userName}님! 👋

🤖 **두목봇 v3.0.1**에 오신 것을 환영합니다.

아래 메뉴에서 원하는 기능을 선택해주세요.`;

      // 동적 키보드 생성
      const keyboard = {
        inline_keyboard: [],
      };

      // 주요 모듈 버튼 추가
      const mainModules = moduleCommands.filter((cmd) =>
        ["leave", "todo", "timer", "weather"].includes(cmd.command)
      );

      for (let i = 0; i < mainModules.length; i += 2) {
        const row = [];
        const module1 = mainModules[i];
        const module2 = mainModules[i + 1];

        if (module1) {
          const emoji = this._getModuleEmoji(module1.command);
          row.push({
            text: `${emoji} ${this._getModuleName(module1.command)}`,
            callback_data: `${module1.command}:menu`,
          });
        }

        if (module2) {
          const emoji = this._getModuleEmoji(module2.command);
          row.push({
            text: `${emoji} ${this._getModuleName(module2.command)}`,
            callback_data: `${module2.command}:menu`,
          });
        }

        keyboard.inline_keyboard.push(row);
      }

      // 시스템 메뉴 추가
      keyboard.inline_keyboard.push([
        { text: "❓ 도움말", callback_data: "system:help" },
        { text: "📊 상태", callback_data: "system:status" },
      ]);

      await this.bot.sendMessage(chatId, welcomeText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      logger.info(`Start 명령어 처리 완료: ${userName} (${userId})`);
    } catch (error) {
      logger.error("Start 명령어 처리 오류:", error);
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
        const moduleName = args[0];
        return await this._handleModuleHelp(chatId, moduleName);
      }

      // ⭐ Registry 기반 전체 도움말 생성
      const stats = this.commandsRegistry.getCommandStats();
      const publicCommands = this.commandsRegistry.getBotFatherCommands();

      // 🎨 예쁜 전체 도움말
      let helpText = `📖 **두목봇 도움말**
버전: v3.0.1

**📊 명령어 현황**
• 총 명령어: ${stats.totalCommands}개
• 공개 명령어: ${stats.publicCommands}개
• 시스템: ${stats.systemCommands}개
• 모듈: ${stats.moduleCommands}개

**✨ 시스템 명령어**
`;

      // 시스템 명령어 나열
      const systemCommands = publicCommands.filter((cmd) =>
        ["start", "help", "status", "cancel"].includes(cmd.command)
      );

      systemCommands.forEach((cmd) => {
        helpText += `• /${cmd.command} - ${cmd.description}\n`;
      });

      helpText += `\n**📦 모듈 명령어**\n`;

      // 모듈 명령어 나열
      const moduleCommands = publicCommands.filter(
        (cmd) => !["start", "help", "status", "cancel"].includes(cmd.command)
      );

      moduleCommands.forEach((cmd) => {
        helpText += `• /${cmd.command} - ${cmd.description}\n`;
      });

      helpText += `\n**💡 팁**
각 모듈을 선택한 후 도움말 버튼을 누르거나
\`/help [모듈이름]\` 명령어를 사용하세요.

**🆘 문의**
문제가 있으시면 관리자에게 연락주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏖️ 휴가 도움말", callback_data: "help:leave" },
            { text: "📝 할일 도움말", callback_data: "help:todo" },
          ],
          [
            { text: "⏰ 타이머 도움말", callback_data: "help:timer" },
            { text: "🌤️ 날씨 도움말", callback_data: "help:weather" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      };

      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("Help 명령어 처리 오류:", error);
      // 마크다운 실패 시 기본 텍스트
      await this.bot.sendMessage(
        chatId,
        `📖 두목봇 도움말 (v3.0.1)\n\n기본 명령어:\n• /start - 봇 시작\n• /help - 도움말\n• /status - 상태 확인\n• /cancel - 작업 취소\n\n사용 가능한 ${
          this.commandsRegistry.getCommandStats().publicCommands
        }개 명령어가 있습니다.`
      );
    }
  }

  async _handleStatus(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      const uptime = process.uptime();
      const stats = this.commandsRegistry.getCommandStats();
      const handlerStats = this.getStats();

      const statusText = `📊 **봇 상태**

**⏱️ 운영 정보**
• 가동 시간: ${this._formatUptime(uptime)}
• 환경: ${process.env.NODE_ENV || "development"}

**📈 명령어 처리 통계**
• 처리된 명령어: ${handlerStats.commandsProcessed}개
• 성공: ${handlerStats.successfulCommands}개
• 실패: ${handlerStats.failedCommands}개
• 알 수 없는 명령어: ${handlerStats.unknownCommands}개

**📋 등록된 명령어**
• 총 명령어: ${stats.totalCommands}개
• 공개 명령어: ${stats.publicCommands}개
• 시스템: ${stats.systemCommands}개
• 모듈: ${stats.moduleCommands}개
• 관리자: ${stats.adminCommands}개

**🛡️ 시스템 상태**
• ModuleManager: ${this.moduleManager ? "활성" : "비활성"}
• UserStates: ${this.userStates?.size || 0}개 활성 세션

✅ 모든 시스템이 정상 작동 중입니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📊 상세 통계", callback_data: "system:detailed_stats" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      };

      await this.bot.sendMessage(chatId, statusText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("Status 명령어 처리 오류:", error);
      await this.bot.sendMessage(chatId, "상태 확인 중 오류가 발생했습니다.");
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
        await this.bot.sendMessage(chatId, "취소할 작업이 없습니다.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
            ],
          },
        });
        return;
      }

      // 상태 초기화
      this.userStates.delete(userId);

      // 모듈에 취소 알림
      if (userState.moduleId && this.moduleManager) {
        await this.moduleManager.cancelModuleAction?.(
          userId,
          userState.moduleId
        );
      }

      await this.bot.sendMessage(chatId, "✅ 작업이 취소되었습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
          ],
        },
      });
    } catch (error) {
      logger.error("Cancel 명령어 처리 오류:", error);
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

      const stats = this.commandsRegistry.getCommandStats();
      const handlerStats = this.getStats();

      const adminText = `🔧 **관리자 메뉴**

**📊 시스템 통계**
• 명령어 처리: ${handlerStats.commandsProcessed}개
• 성공률: ${(
        (handlerStats.successfulCommands / handlerStats.commandsProcessed) *
        100
      ).toFixed(1)}%

**📋 명령어 관리**
• 등록된 명령어: ${stats.totalCommands}개
• BotFather 동기화: 활성

관리 작업을 선택하세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상세 통계", callback_data: "admin:stats" },
            { text: "🔧 모듈 관리", callback_data: "admin:modules" },
          ],
          [
            { text: "📋 명령어 관리", callback_data: "admin:commands" },
            { text: "👥 사용자 관리", callback_data: "admin:users" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      };

      await this.bot.sendMessage(chatId, adminText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("Admin 명령어 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "관리자 메뉴를 여는 중 오류가 발생했습니다."
      );
    }
  }

  // =============== 📦 모듈 명령어 처리 ===============

  async _handleModuleCommand(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      if (!this.moduleManager) {
        await this.bot.sendMessage(
          chatId,
          "❌ 모듈 매니저가 초기화되지 않았습니다."
        );
        return;
      }

      // ModuleManager에 명령어 처리 위임
      const handled = await this.moduleManager.handleCommand?.(
        this.bot,
        msg,
        command
      );

      if (!handled) {
        await this.bot.sendMessage(
          chatId,
          `❌ '/${command}' 모듈을 처리할 수 없습니다.`
        );
      }
    } catch (error) {
      logger.error(`모듈 명령어 처리 실패 [${command}]:`, error);
      await this._sendErrorMessage(chatId, error);
    }
  }

  async _handleModuleHelp(chatId, moduleName) {
    try {
      // Registry에서 모듈 정보 조회
      const moduleCommand =
        this.commandsRegistry.moduleCommands.get(moduleName);

      if (!moduleCommand) {
        await this.bot.sendMessage(
          chatId,
          `❌ '${moduleName}' 모듈을 찾을 수 없습니다.`
        );
        return;
      }

      // 특별한 도움말 생성 (휴가 모듈의 경우)
      if (moduleName === "leave") {
        const helpText = this.commandsRegistry.generateLeaveHelpText();
        await this.bot.sendMessage(chatId, helpText, {
          parse_mode: "Markdown",
        });
        return;
      }

      // 일반 모듈 도움말
      let helpText = `📖 **${moduleCommand.description}**\n\n`;
      helpText += `**명령어**: /${moduleCommand.command}\n`;
      helpText += `**카테고리**: ${moduleCommand.category}\n`;

      if (moduleCommand.quickActions) {
        helpText += `**빠른 액션**: ${moduleCommand.quickActions.join(", ")}\n`;
      }

      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error(`모듈 도움말 처리 실패 [${moduleName}]:`, error);
      await this.bot.sendMessage(
        chatId,
        "도움말을 불러오는 중 오류가 발생했습니다."
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
          logger.warn(`알 수 없는 딥링크: ${param}`);
      }
    } catch (error) {
      logger.error("딥링크 처리 오류:", error);
    }
  }

  async _handleUnknownCommand(msg, command) {
    const {
      chat: { id: chatId },
    } = msg;

    const stats = this.commandsRegistry.getCommandStats();

    await this.bot.sendMessage(
      chatId,
      `❓ '/${command}' 는 알 수 없는 명령어입니다.\n\n💡 /help 를 입력하여 사용 가능한 ${stats.publicCommands}개 명령어를 확인하세요.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❓ 도움말", callback_data: "system:help" },
              { text: "🏠 메인 메뉴", callback_data: "system:start" },
            ],
          ],
        },
      }
    );
  }

  async _sendValidationError(chatId, error) {
    await this.bot.sendMessage(chatId, `❌ ${error}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      },
    });
  }

  async _getUserRole(userId) {
    const adminIds = process.env.ADMIN_IDS?.split(",") || [];
    return adminIds.includes(userId.toString()) ? "admin" : "user";
  }

  async _checkAdminPermission(userId) {
    return (await this._getUserRole(userId)) === "admin";
  }

  async _sendErrorMessage(chatId, error) {
    if (!chatId) return;

    const errorText =
      error.userMessage ||
      "🚨 명령어 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.";

    await this.bot.sendMessage(chatId, errorText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:start" }],
        ],
      },
    });
  }

  _getModuleEmoji(command) {
    const emojiMap = {
      leave: "🏖️",
      todo: "📝",
      timer: "⏰",
      weather: "🌤️",
      fortune: "🔮",
      worktime: "💼",
      utils: "🛠️",
    };
    return emojiMap[command] || "📦";
  }

  _getModuleName(command) {
    const nameMap = {
      leave: "휴가 관리",
      todo: "할일 관리",
      timer: "타이머",
      weather: "날씨",
      fortune: "운세",
      worktime: "근무시간",
      utils: "유틸리티",
    };
    return nameMap[command] || command;
  }

  _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  // =============== 📊 Getter 메서드들 ===============

  get commandCount() {
    return this.commandRouter.size;
  }

  get registeredCommands() {
    return Array.from(this.commandRouter.keys());
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000),
      commandsPerMinute: this.stats.commandsProcessed / (uptime / 60000) || 0,
      successRate:
        this.stats.commandsProcessed > 0
          ? (this.stats.successfulCommands / this.stats.commandsProcessed) * 100
          : 0,
    };
  }
}

module.exports = CommandHandler;
