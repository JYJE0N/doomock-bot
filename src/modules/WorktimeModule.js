// ===== 🏢 WorktimeModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper"); // ✅ 추가

class WorktimeModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super("WorktimeModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;

    this.worktimeService = null;
    this.config = {
      workStartTime: process.env.WORK_START_TIME || "09:00",
      workEndTime: process.env.WORK_END_TIME || "18:00",
      ...options.config,
    };

    logger.module("WorktimeModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.worktimeService = await this.serviceBuilder.getOrCreate("worktime", {
        config: this.config,
      });

      await this.worktimeService.initialize();
      logger.success("WorktimeModule 초기화 완료");
    } catch (error) {
      logger.error("WorktimeModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      checkin: this.checkIn,
      checkout: this.checkOut,
      today: this.showToday,
      help: this.showHelp,
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const keywords = ["퇴근", "집에가고싶어", "포로"];
    if (this.isModuleMessage(text, keywords)) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "worktime"
      );
      return true;
    }
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from); // ✅ 이제 작동함

    try {
      const status = await this.worktimeService.getTodayStatus(userId);
      return {
        type: "menu",
        module: "worktime",
        data: { status },
      };
    } catch (error) {
      return {
        type: "error",
        message: error.message || "기본 에러 메시지",
        error: error.message,
      };
    }
  }

  async checkIn(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const result = await this.worktimeService.checkIn(userId);
      return {
        type: "checkin",
        module: "worktime",
        data: { result },
      };
    } catch (error) {
      return { type: "error", message: "출근 처리에 실패했습니다." };
    }
  }

  async checkOut(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const result = await this.worktimeService.checkOut(userId);
      return {
        type: "checkout",
        module: "worktime",
        data: { result },
      };
    } catch (error) {
      return { type: "error", message: "퇴근 처리에 실패했습니다." };
    }
  }

  async showToday(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const today = await this.worktimeService.getTodayWorktime(userId);
      return {
        type: "today",
        module: "worktime",
        data: { today },
      };
    } catch (error) {
      return { type: "error", message: "오늘 근무시간을 불러올 수 없습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "worktime",
      data: {
        title: "근무시간 도움말",
        features: ["출퇴근 기록", "근무시간 확인"],
        commands: ["/work - 근무시간 메뉴"],
      },
    };
  }
  // 로그 상태값을 위한 메서드
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceStatus: this.serviceInstance ? "Ready" : "Not Connected",
      stats: this.stats,
    };
  }
}
module.exports = WorktimeModule; // ✅ 필수!
