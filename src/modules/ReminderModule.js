// ===== ⏰ ReminderModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");

class ReminderModule extends BaseModule {
  constructor(bot, options = {}) {
    super("ReminderModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;

    this.reminderService = null;
    this.config = {
      maxRemindersPerUser: parseInt(process.env.MAX_REMINDERS_PER_USER) || 20,
      ...options.config,
    };

    logger.module("ReminderModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.reminderService = await this.serviceBuilder.getOrCreate("reminder", {
        config: this.config,
      });

      await this.reminderService.initialize();
      logger.success("ReminderModule 초기화 완료");
    } catch (error) {
      logger.error("ReminderModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      list: this.showList,
      add: this.showAdd,
      delete: this.deleteReminder,
      help: this.showHelp,
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const command = this.extractCommand(text);
    if (command === "remind" || command === "알림") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "reminder"
      );
      return true;
    }
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const stats = await this.reminderService.getUserStats(userId);
      return {
        type: "menu",
        module: "reminder",
        data: { stats },
      };
    } catch (error) {
      return { type: "error", message: "리마인더 메뉴를 불러올 수 없습니다." };
    }
  }

  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const reminders = await this.reminderService.getUserReminders(userId);
      return {
        type: "list",
        module: "reminder",
        data: { reminders },
      };
    } catch (error) {
      return { type: "error", message: "알림 목록을 불러올 수 없습니다." };
    }
  }

  async showAdd(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      waitingFor: "reminder_text",
      action: "add",
    });

    return {
      type: "input",
      module: "reminder",
      message: "알림 내용을 입력하세요:",
    };
  }

  async deleteReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const reminderId = params.id;

    try {
      await this.reminderService.deleteReminder(userId, reminderId);
      return await this.showList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      return { type: "error", message: "알림 삭제에 실패했습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "reminder",
      data: {
        title: "리마인더 도움말",
        features: ["알림 추가/삭제", "목록 보기"],
        commands: ["/remind - 리마인더 메뉴"],
      },
    };
  }
}
