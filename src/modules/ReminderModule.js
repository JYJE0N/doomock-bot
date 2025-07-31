// ===== ⏰ ReminderModule.js (API 호출 수정 버전) =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper"); // ✅ getUserId 추가

class ReminderModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);
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
      // ✅ 수정: initialize가 서비스에 없을 수 있으므로 안전하게 호출
      if (typeof this.reminderService.initialize === "function") {
        await this.reminderService.initialize();
      }
      this.setupActions(); // ✅ 액션 등록 추가
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
      from: { id: userId },
    } = msg;
    if (!text) return false;

    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      // (사용자 입력 처리 로직)
    }

    // (키워드 처리 로직)
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    try {
      const stats = await this.reminderService.getUserStats(userId);
      return { type: "menu", module: "reminder", data: { stats } };
    } catch (error) {
      return { type: "error", message: "메뉴를 불러올 수 없습니다." };
    }
  }

  async showList(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    try {
      const reminders = await this.reminderService.getUserReminders(userId);
      return { type: "list", module: "reminder", data: { reminders } };
    } catch (error) {
      return { type: "error", message: "알림 목록을 불러올 수 없습니다." };
    }
  }

  async showAdd(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    this.setUserState(userId, { awaitingInput: true, action: "add_reminder" });
    return {
      type: "input",
      module: "reminder",
      data: { message: "알림 내용을 입력하세요:" },
    };
  }

  async deleteReminder(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    // ✅ 수정: params가 문자열일 수 있으므로 직접 사용
    const reminderId = params;
    try {
      await this.reminderService.deleteReminder(userId, reminderId);
      return await this.showList(
        bot,
        callbackQuery,
        subAction,
        {},
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

  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceStatus: this.reminderService ? "Ready" : "Not Connected",
      stats: this.stats,
    };
  }
}
module.exports = ReminderModule;
