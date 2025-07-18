// src/handlers/CommandHandler.js - 개선된 버전 3
const Logger = require("../utils/Logger");
const config = require("../config/config");

class CommandHandler {
  constructor(bot, dependencies) {
    this.bot = bot;
    this.moduleManager = dependencies.moduleManager;
    this.menuManager = dependencies.menuManager;
    this.userStates = dependencies.userStates;

    // 명령어 라우터
    this.commandRouter = new Map();
    this.setupCommandRouter();
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  setupCommandRouter() {
    // 시스템 명령어
    this.commandRouter.set("/start", this.handleStart.bind(this));
    this.commandRouter.set("/help", this.handleHelp.bind(this));
    this.commandRouter.set("/status", this.handleStatus.bind(this));
    this.commandRouter.set("/cancel", this.handleCancel.bind(this));

    // 모듈 명령어 (동적 로딩)
    this.commandRouter.set("/modules", this.handleModules.bind(this));

    // 관리자 명령어
    this.commandRouter.set("/admin", this.handleAdmin.bind(this));
  }

  //핸들 메서드 수정
  async handle(msg) {
    try {
      // 메시지 검증
      if (!msg || !msg.text) {
        Logger.warn("텍스트가 없는 메시지");
        return;
      }

      const text = msg.text;
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      // 명령어가 아닌 경우
      if (!text.startsWith("/")) {
        return;
      }

      // 명령어 파싱 (안전하게)
      const parts = text.split(" ").filter(Boolean);
      const commandWithSlash = parts[0];
      const command = commandWithSlash.substring(1); // '/' 제거
      const args = parts.slice(1);

      Logger.info(`명령어 처리: /${command}`, {
        userId,
        args,
        fullText: text,
      });

      // 봇 멘션 제거 (그룹 채팅에서)
      const cleanCommand = command.replace(/@\w+$/, "");

      try {
        // 시스템 명령어 확인
        const handler = this.commandRouter.get(`/${cleanCommand}`);
        if (handler) {
          await handler(msg, cleanCommand, args);
          return;
        }

        // 모듈 명령어 확인
        if (this.moduleManager) {
          const moduleCommand = await this.moduleManager.handleCommand(
            msg,
            cleanCommand,
            args
          );
          if (moduleCommand) {
            return;
          }
        }

        // 알 수 없는 명령어
        await this.handleUnknownCommand(msg, cleanCommand);
      } catch (error) {
        Logger.error(`명령어 처리 실패 [${cleanCommand}]:`, error);
        await this.sendErrorMessage(chatId, error);
      }
    } catch (error) {
      Logger.error("명령어 핸들러 오류:", error);
      if (msg && msg.chat && msg.chat.id) {
        await this.sendErrorMessage(msg.chat.id, error);
      }
    }
  }

  async handleStart(msg, command, args) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || "사용자";
    const config = require("../config/config");

    // 사용자 상태 초기화
    this.userStates.delete(userId);

    // 딥링크 처리
    if (args.length > 0) {
      await this.handleDeepLink(msg, args[0]);
      return;
    }

    // 환영 메시지와 메인 메뉴
    const welcomeText = `안녕하세요 ${userName}님! 👋

${config.emoji.bot} *${config.bot.name} v${config.bot.version}*에 오신 것을 환영합니다.

아래 메뉴에서 원하는 기능을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 모듈 선택", callback_data: "main:modules" }],
        [{ text: "❓ 도움말", callback_data: "main:help" }],
        [{ text: "⚙️ 설정", callback_data: "main:settings" }],
      ],
    };

    await this.bot.sendMessage(chatId, welcomeText, {
      reply_markup: keyboard,
      parse_mode: "Markdown",
    });
  }

  async handleHelp(msg, command, args) {
    const chatId = msg.chat.id;

    // 특정 모듈의 도움말
    if (args.length > 0) {
      const moduleName = args[0];
      const moduleHelp = await this.moduleManager.getModuleHelp(moduleName);

      if (moduleHelp) {
        await this.bot.sendMessage(chatId, moduleHelp, {
          parse_mode: "Markdown",
        });
        return;
      }
    }

    // 전체 도움말
    const helpText = `
*${config.bot.name} 도움말* 📖
버전: ${config.bot.version}

*기본 명령어:*
/start - 봇 시작 및 메인 메뉴
/help - 도움말 보기
/modules - 사용 가능한 모듈 목록
/status - 현재 상태 확인
/cancel - 현재 작업 취소

*모듈별 도움말:*
각 모듈을 선택한 후 도움말 버튼을 누르거나
\`/help [모듈이름]\` 명령어를 사용하세요.

*문의사항:*
문제가 있으시면 @doomock_support 로 연락주세요.

*GitHub:*
${config.bot.repository}
        `.trim();

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
    });
  }

  async handleModules(msg, command, args) {
    const chatId = msg.chat.id;
    const modules = await this.moduleManager.getAvailableModules();

    if (modules.length === 0) {
      await this.bot.sendMessage(chatId, "사용 가능한 모듈이 없습니다.");
      return;
    }

    const moduleList = modules
      .map((m) => `• *${m.name}* - ${m.description}`)
      .join("\n");

    const text = `*사용 가능한 모듈:*\n\n${moduleList}`;

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
  }

  async handleStatus(msg, command, args) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const config = require("../config/config");

    // 사용자 상태
    const userState = this.userStates.get(userId);
    const stateText = userState
      ? `현재 상태: ${userState.waitingFor || "대기 중"}`
      : "현재 상태: 대기 중";

    // 활성 모듈
    const activeModule = await this.moduleManager.getActiveModule(userId);
    const moduleText = activeModule
      ? `활성 모듈: ${activeModule.name}`
      : "활성 모듈: 없음";

    // 업타임 계산
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const statusText = `
*${config.bot.name} 상태 정보* 📊

${stateText}
${moduleText}

${config.emoji.version} 버전: ${config.bot.version}
⏱️ 업타임: ${hours}시간 ${minutes}분
🌐 환경: ${process.env.NODE_ENV || "development"}
💾 메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
🔧 서버 상태: 정상
        `.trim();

    await this.bot.sendMessage(chatId, statusText, {
      parse_mode: "Markdown",
    });
  }

  async handleCancel(msg, command, args) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // 현재 작업 취소
    const userState = this.userStates.get(userId);

    if (!userState) {
      await this.bot.sendMessage(chatId, "취소할 작업이 없습니다.");
      return;
    }

    // 상태 초기화
    this.userStates.delete(userId);

    // 모듈에 취소 알림
    if (userState.moduleId) {
      await this.moduleManager.cancelModuleAction(userId, userState.moduleId);
    }

    await this.bot.sendMessage(chatId, "작업이 취소되었습니다.", {
      reply_markup: {
        remove_keyboard: true,
      },
    });
  }

  async handleAdmin(msg, command, args) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // 관리자 권한 확인
    const isAdmin = await this.checkAdminPermission(userId);

    if (!isAdmin) {
      await this.bot.sendMessage(chatId, "관리자 권한이 필요합니다.");
      return;
    }

    // 관리자 메뉴
    const keyboard = {
      inline_keyboard: [
        [{ text: "📊 통계", callback_data: "admin:stats" }],
        [{ text: "🔧 모듈 관리", callback_data: "admin:modules" }],
        [{ text: "👥 사용자 관리", callback_data: "admin:users" }],
        [{ text: "⬅️ 뒤로", callback_data: "main:back" }],
      ],
    };

    await this.bot.sendMessage(chatId, "*관리자 메뉴*", {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async handleDeepLink(msg, param) {
    const chatId = msg.chat.id;

    // 딥링크 파라미터 파싱
    const [action, ...data] = param.split("_");

    switch (action) {
      case "module":
        await this.moduleManager.activateModule(chatId, data[0]);
        break;
      case "share":
        await this.handleShareLink(msg, data);
        break;
      default:
        Logger.warn(`알 수 없는 딥링크: ${param}`);
    }
  }

  async handleUnknownCommand(msg, command) {
    const chatId = msg.chat.id;

    await this.bot.sendMessage(
      chatId,
      `'/${command}' 는 알 수 없는 명령어입니다.\n/help 를 입력하여 사용 가능한 명령어를 확인하세요.`
    );
  }

  async checkAdminPermission(userId) {
    // 환경 변수에서 관리자 ID 확인
    const adminIds = process.env.ADMIN_IDS?.split(",") || [];
    return adminIds.includes(userId.toString());
  }

  async sendErrorMessage(chatId, error) {
    const errorText =
      error.userMessage ||
      "명령어 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.";

    await this.bot.sendMessage(chatId, errorText);
  }
}

module.exports = CommandHandler;
