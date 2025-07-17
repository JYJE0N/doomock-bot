const { ModuleManager } = require("../managers/ModuleManager");
const { getUserName } = require("../utils/UserHelper");
const { Logger } = require("../utils/Logger");

class MessageHandler {
  constructor(bot, menuManager) {
    this.bot = bot;
    this.menuManager = menuManager;
    this.moduleManager = new ModuleManager();
    this.userStates = new Map(); // userId -> state
  }

  async handle(msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    if (!text) return;

    Logger.info(`메시지 처리: "${text}" (사용자: ${userName})`);

    try {
      // 취소 명령어 처리
      if (text === "/cancel") {
        this.userStates.delete(userId);
        await this.bot.sendMessage(
          chatId,
          `❌ ${userName}님, 작업이 취소되었습니다.`
        );
        return;
      }

      // 사용자 상태 기반 처리
      if (this.userStates.has(userId)) {
        const handled = await this.handleUserState(msg);
        if (handled) return;
      }

      // 명령어 처리
      if (text.startsWith("/")) {
        await this.handleCommand(msg);
        return;
      }

      // 자동 기능 처리 (TTS 등)
      await this.handleAutoFeatures(msg);
    } catch (error) {
      Logger.error("메시지 처리 오류:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요."
      );
    }
  }

  async handleUserState(msg) {
    const {
      from: { id: userId },
    } = msg;
    const userState = this.userStates.get(userId);

    // 모듈별 상태 처리 위임
    for (const module of this.moduleManager.getAllModules()) {
      const handled = await module.handleMessage(this.bot, msg);
      if (handled) {
        return true;
      }
    }

    return false;
  }

  async handleCommand(msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userName = getUserName(msg.from);

    // 기본 명령어 처리
    switch (text) {
      case "/start":
        await this.showMainMenu(chatId, userName);
        break;
      case "/help":
        await this.showHelpMenu(chatId, userName);
        break;
      default:
        // 모듈별 명령어 처리 위임
        const handled = await this.delegateCommand(msg);
        if (!handled) {
          await this.bot.sendMessage(
            chatId,
            `😅 ${userName}님, 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.`
          );
        }
    }
  }

  async delegateCommand(msg) {
    for (const module of this.moduleManager.getAllModules()) {
      try {
        const handled = await module.handleMessage(this.bot, msg);
        if (handled) return true;
      } catch (error) {
        Logger.error(`모듈 ${module.name} 명령어 처리 오류:`, error);
      }
    }
    return false;
  }

  async showMainMenu(chatId, userName) {
    const menuText = this.menuManager.getMenuText("main", userName);
    const keyboard = this.menuManager.createKeyboard("main");

    await this.bot.sendMessage(chatId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showHelpMenu(chatId, userName) {
    const menuText = this.menuManager.getMenuText("help", userName);
    const keyboard = this.menuManager.createKeyboard("help");

    await this.bot.sendMessage(chatId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async handleAutoFeatures(msg) {
    // TTS 자동 처리 등
    const utilsModule = this.moduleManager.getModule("UtilsModule");
    if (utilsModule && utilsModule.handleAutoTTS) {
      await utilsModule.handleAutoTTS(this.bot, msg);
    }
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  getUserState(userId) {
    return this.userStates.get(userId);
  }
}

module.exports = { MessageHandler };
