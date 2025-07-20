// src/handlers/CommandHandler.js - 표준화된 명령어 핸들러 v3.0.1
// Railway 환경, 리팩토링 표준 준수, 매개변수 표준화

const Logger = require("../utils/Logger");
const botCommandsRegistry = require("../config/BotCommandsRegistry");
const { getUserName } = require("../utils/UserHelper");
const config = require("../config/config");

class CommandHandler {
  constructor(bot, dependencies = {}) {
    this.bot = bot;

    // ✅ 표준화된 의존성 주입 (매개변수 표준)
    this.moduleManager = dependencies.moduleManager;
    this.menuManager = dependencies.menuManager;
    this.userStates = dependencies.userStates || new Map();
    this.errorHandler = dependencies.errorHandler;

    // 📋 명령어 레지스트리 연결
    this.commandRegistry = botCommandsRegistry;
    this.commandMapping = this.commandRegistry.getCommandMapping();

    // 📊 핸들러 통계
    this.stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      moduleCommands: 0,
      systemCommands: 0,
      adminCommands: 0,
      lastReset: new Date(),
    };

    Logger.info("🎯 CommandHandler 초기화 완료");
    Logger.debug(`📋 등록된 명령어: ${this.commandMapping.size}개`);
  }

  // 🚀 BotFather 명령어 자동 등록
  async initializeBotCommands() {
    try {
      Logger.info("🚀 BotFather 명령어 등록 중...");

      const success = await this.commandRegistry.setBotFatherCommands(this.bot);

      if (success) {
        Logger.success("✅ BotFather 명령어 등록 완료");
        return true;
      } else {
        Logger.error("❌ BotFather 명령어 등록 실패");
        return false;
      }
    } catch (error) {
      Logger.error("❌ BotFather 명령어 등록 중 오류:", error);
      return false;
    }
  }

  // ⭐ 메인 명령어 처리 (표준화된 매개변수)
  async handle(msg) {
    try {
      // 🔍 메시지 유효성 검증
      if (!this.validateMessage(msg)) {
        return false;
      }

      const {
        text,
        chat: { id: chatId },
        from: { id: userId },
      } = msg;
      const userName = getUserName(msg.from);

      // 명령어가 아닌 경우 조기 반환
      if (!text.startsWith("/")) {
        Logger.debug("명령어가 아닌 메시지, 건너뛰기");
        return false;
      }

      // 📝 명령어 파싱
      const { command, args, cleanCommand } = this.parseCommand(text);

      this.stats.totalCommands++;

      Logger.info(`🎯 명령어 처리: /${cleanCommand}`, {
        userId,
        userName,
        args: args.length,
        fullCommand: text,
      });

      // 🔍 명령어 매핑 검색
      const commandConfig = this.commandMapping.get(`/${cleanCommand}`);

      if (commandConfig) {
        // ✅ 등록된 명령어 처리
        return await this.executeCommand(
          msg,
          commandConfig,
          cleanCommand,
          args
        );
      } else {
        // ❌ 알 수 없는 명령어
        return await this.handleUnknownCommand(msg, cleanCommand);
      }
    } catch (error) {
      this.stats.failedCommands++;
      Logger.error("CommandHandler 처리 오류:", error);

      if (this.errorHandler) {
        await this.errorHandler.handleError(error, {
          module: "CommandHandler",
          context: "handle",
          userId: msg?.from?.id,
        });
      }

      await this.sendErrorMessage(msg.chat.id, error);
      return false;
    }
  }

  // 🔍 메시지 유효성 검증
  validateMessage(msg) {
    if (!msg) {
      Logger.warn("메시지가 null/undefined");
      return false;
    }

    if (!msg.text || typeof msg.text !== "string") {
      Logger.debug("텍스트가 없는 메시지");
      return false;
    }

    if (!msg.chat || !msg.from) {
      Logger.warn("채팅 또는 사용자 정보가 없는 메시지");
      return false;
    }

    return true;
  }

  // 📝 명령어 파싱 (안전하고 정확하게)
  parseCommand(text) {
    // 공백으로 분리하되 빈 문자열 제거
    const parts = text.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      throw new Error("빈 명령어");
    }

    const commandWithSlash = parts[0];
    const rawCommand = commandWithSlash.substring(1); // '/' 제거
    const args = parts.slice(1);

    // 봇 멘션 제거 (그룹 채팅용: /start@mybotname → start)
    const cleanCommand = rawCommand.replace(/@\w+$/, "");

    return {
      command: rawCommand,
      cleanCommand,
      args,
      fullText: text,
    };
  }

  // ⚡ 명령어 실행 (표준화된 방식)
  async executeCommand(msg, commandConfig, command, args) {
    try {
      const { category, isAdmin, module: moduleName } = commandConfig;
      const {
        chat: { id: chatId },
        from: { id: userId },
      } = msg;
      const userName = getUserName(msg.from);

      // 🔒 관리자 권한 확인
      if (isAdmin && !(await this.checkAdminPermission(userId))) {
        await this.bot.sendMessage(chatId, "❌ 관리자 권한이 필요합니다.");
        this.stats.failedCommands++;
        return false;
      }

      // 📊 통계 업데이트
      if (category === "system") {
        this.stats.systemCommands++;
      } else if (isAdmin) {
        this.stats.adminCommands++;
      } else {
        this.stats.moduleCommands++;
      }

      // 🎯 명령어 타입별 처리
      if (category === "system") {
        return await this.handleSystemCommand(msg, command, args);
      } else if (moduleName) {
        return await this.handleModuleCommand(
          msg,
          commandConfig,
          command,
          args
        );
      } else {
        Logger.warn(`정의되지 않은 명령어 타입: ${command}`);
        return false;
      }
    } catch (error) {
      this.stats.failedCommands++;
      Logger.error(`명령어 실행 오류 [${command}]:`, error);
      throw error;
    }
  }

  // 🏛️ 시스템 명령어 처리
  async handleSystemCommand(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      switch (command) {
        case "start":
          return await this.handleStart(msg, command, args);

        case "help":
          return await this.handleHelp(msg, command, args);

        case "status":
          return await this.handleStatus(msg, command, args);

        case "cancel":
          return await this.handleCancel(msg, command, args);

        default:
          Logger.warn(`정의되지 않은 시스템 명령어: ${command}`);
          return false;
      }
    } catch (error) {
      Logger.error(`시스템 명령어 처리 오류 [${command}]:`, error);
      throw error;
    }
  }

  // 📦 모듈 명령어 처리 (표준화된 매개변수 전달)
  async handleModuleCommand(msg, commandConfig, command, args) {
    try {
      if (!this.moduleManager) {
        Logger.error("ModuleManager가 없어서 모듈 명령어를 처리할 수 없음");
        return false;
      }

      const { module: moduleName } = commandConfig;

      // ✅ 표준화된 매개변수로 모듈에 전달
      const handled = await this.moduleManager.handleCommand(
        this.bot, // bot
        msg, // message (callbackQuery 대신)
        command, // subAction
        args, // params
        this.menuManager // menuManager
      );

      if (handled) {
        this.stats.successfulCommands++;
        Logger.debug(`모듈 명령어 처리 완료: ${moduleName}.${command}`);
        return true;
      } else {
        Logger.warn(`모듈에서 처리되지 않음: ${moduleName}.${command}`);
        return false;
      }
    } catch (error) {
      Logger.error(`모듈 명령어 처리 오류 [${command}]:`, error);
      throw error;
    }
  }

  // =============== 시스템 명령어 핸들러들 ===============

  async handleStart(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 사용자 상태 초기화
      this.userStates.delete(userId);

      // 딥링크 처리
      if (args && args.length > 0) {
        return await this.handleDeepLink(msg, args[0]);
      }

      // 환영 메시지
      const welcomeText = `안녕하세요 ${userName}님! 👋\n\n🤖 **${config.bot.name} v${config.bot.version}**에 오신 것을 환영합니다.\n\n아래 메뉴에서 원하는 기능을 선택해주세요.`;

      // 메인 메뉴 키보드 생성
      const keyboard = this.createMainMenuKeyboard();

      await this.bot.sendMessage(chatId, welcomeText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.stats.successfulCommands++;
      Logger.info(`Start 명령어 처리 완료: ${userName} (${userId})`);
      return true;
    } catch (error) {
      Logger.error("Start 명령어 처리 오류:", error);

      // 폴백 응답
      await this.bot.sendMessage(
        chatId,
        "봇을 시작하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
      return false;
    }
  }

  async handleHelp(msg, command, args) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      // 특정 모듈의 도움말 요청 시
      if (args && args.length > 0) {
        const moduleName = args[0];

        if (this.moduleManager) {
          const moduleHelp = await this.moduleManager.getModuleHelp(moduleName);

          if (moduleHelp) {
            await this.bot.sendMessage(chatId, moduleHelp, {
              parse_mode: "Markdown",
            });
            this.stats.successfulCommands++;
            return true;
          }
        }
      }

      // 전체 도움말
      const helpText = this.generateHelpText();

      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      this.stats.successfulCommands++;
      return true;
    } catch (error) {
      Logger.error("Help 명령어 처리 오류:", error);

      // Markdown 파싱 오류 시 일반 텍스트로 재시도
      try {
        const simpleHelp = this.generateSimpleHelpText();
        await this.bot.sendMessage(chatId, simpleHelp);
        return true;
      } catch (fallbackError) {
        Logger.error("폴백 도움말도 실패:", fallbackError);
        return false;
      }
    }
  }

  async handleStatus(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      const statusText = await this.generateStatusText(userId);

      await this.bot.sendMessage(chatId, statusText, {
        parse_mode: "Markdown",
      });

      this.stats.successfulCommands++;
      return true;
    } catch (error) {
      Logger.error("Status 명령어 처리 오류:", error);
      return false;
    }
  }

  async handleCancel(msg, command, args) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      const userState = this.userStates.get(userId);

      if (!userState) {
        await this.bot.sendMessage(chatId, "취소할 작업이 없습니다.");
        this.stats.successfulCommands++;
        return true;
      }

      // 상태 초기화
      this.userStates.delete(userId);

      // 모듈에 취소 알림
      if (userState.moduleId && this.moduleManager) {
        await this.moduleManager.cancelModuleAction(userId, userState.moduleId);
      }

      await this.bot.sendMessage(chatId, "작업이 취소되었습니다.", {
        reply_markup: { remove_keyboard: true },
      });

      this.stats.successfulCommands++;
      return true;
    } catch (error) {
      Logger.error("Cancel 명령어 처리 오류:", error);
      return false;
    }
  }

  // =============== 헬퍼 메서드들 ===============

  async handleUnknownCommand(msg, command) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      this.stats.unknownCommands++;

      await this.bot.sendMessage(
        chatId,
        `❓ '/${command}'는 알 수 없는 명령어입니다.\n\n/help 를 입력하여 사용 가능한 명령어를 확인하세요.`
      );

      return false;
    } catch (error) {
      Logger.error("알 수 없는 명령어 처리 오류:", error);
      return false;
    }
  }

  async handleDeepLink(msg, param) {
    const {
      chat: { id: chatId },
    } = msg;

    try {
      const [action, ...data] = param.split("_");

      switch (action) {
        case "module":
          if (this.moduleManager && data[0]) {
            await this.moduleManager.activateModule(chatId, data[0]);
            return true;
          }
          break;

        case "share":
          await this.handleShareLink(msg, data);
          return true;

        default:
          Logger.warn(`알 수 없는 딥링크: ${param}`);
      }

      return false;
    } catch (error) {
      Logger.error("딥링크 처리 오류:", error);
      return false;
    }
  }

  async checkAdminPermission(userId) {
    try {
      // 환경변수에서 관리자 ID 확인
      const adminIds =
        process.env.ADMIN_IDS?.split(",") ||
        process.env.ADMIN_USER_IDS?.split(",") ||
        [];

      return adminIds.includes(userId.toString());
    } catch (error) {
      Logger.error("관리자 권한 확인 오류:", error);
      return false;
    }
  }

  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [{ text: "📱 모듈 선택", callback_data: "module:list" }],
        [
          { text: "📝 할일", callback_data: "todo:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "🌤️ 날씨", callback_data: "weather:menu" },
          { text: "⏰ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "📅 휴가", callback_data: "leave:menu" },
          { text: "📊 인사이트", callback_data: "insight:menu" },
        ],
        [
          { text: "🛠️ 유틸", callback_data: "utils:menu" },
          { text: "🕐 근무시간", callback_data: "worktime:menu" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "settings:main" },
          { text: "❓ 도움말", callback_data: "help:main" },
        ],
      ],
    };
  }

  generateHelpText() {
    const commands = this.commandRegistry.getBotFatherCommands();

    let helpText = `📖 **${config.bot.name} 도움말**\n버전: ${config.bot.version}\n\n`;

    helpText += "**기본 명령어:**\n";
    commands.forEach((cmd) => {
      helpText += `• /${cmd.command} - ${cmd.description}\n`;
    });

    helpText += "\n**사용 팁:**\n";
    helpText += "• 각 모듈의 자세한 사용법은 해당 모듈 선택 후 확인\n";
    helpText += "• 작업 중 /cancel 로 언제든 취소 가능\n";
    helpText += "• /status 로 현재 상태 확인 가능\n\n";
    helpText += "**문의:** @doomock\\_support";

    return helpText;
  }

  generateSimpleHelpText() {
    return `📖 ${config.bot.name} 도움말 (v${config.bot.version})

기본 명령어:
• /start - 봇 시작 및 메인 메뉴
• /help - 도움말 보기
• /modules - 사용 가능한 모듈 목록
• /status - 봇 상태 확인
• /cancel - 현재 작업 취소

모듈 명령어:
• /todo - 할일 관리
• /fortune - 운세 보기
• /weather - 날씨 정보
• /timer - 타이머/리마인더
• /leave - 휴가 관리
• /utils - 유틸리티 도구

각 모듈의 자세한 사용법은 해당 명령어 입력 후 확인하세요.`;
  }

  async generateStatusText(userId) {
    // 사용자 상태
    const userState = this.userStates.get(userId);
    const stateText = userState
      ? `현재 상태: ${userState.waitingFor || "대기 중"}`
      : "현재 상태: 대기 중";

    // 활성 모듈
    const activeModule = this.moduleManager
      ? await this.moduleManager.getActiveModule(userId)
      : null;
    const moduleText = activeModule
      ? `활성 모듈: ${activeModule.name}`
      : "활성 모듈: 없음";

    // 업타임 계산
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return `**${config.bot.name} 상태 정보** 📊

${stateText}
${moduleText}

${config.emoji.version} 버전: ${config.bot.version}
⏱️ 업타임: ${hours}시간 ${minutes}분
🌐 환경: ${process.env.NODE_ENV || "development"}
💾 메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
🔧 서버: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "로컬"}

📊 명령어 통계:
• 총 처리: ${this.stats.totalCommands}
• 성공: ${this.stats.successfulCommands}
• 실패: ${this.stats.failedCommands}`;
  }

  async sendErrorMessage(chatId, error) {
    try {
      const errorText =
        error?.userMessage ||
        "명령어 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.";

      await this.bot.sendMessage(chatId, `❌ ${errorText}`);
    } catch (sendError) {
      Logger.error("에러 메시지 전송 실패:", sendError);
    }
  }

  // 📊 통계 조회
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.totalCommands > 0
          ? Math.round(
              (this.stats.successfulCommands / this.stats.totalCommands) * 100
            )
          : 0,
    };
  }

  // 🔄 통계 초기화
  resetStats() {
    this.stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      unknownCommands: 0,
      moduleCommands: 0,
      systemCommands: 0,
      adminCommands: 0,
      lastReset: new Date(),
    };

    Logger.info("📊 CommandHandler 통계 초기화됨");
  }
}

module.exports = CommandHandler;
