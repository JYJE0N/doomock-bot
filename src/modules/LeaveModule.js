// ===== 🏖️ LeaveModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");

class LeaveModule extends BaseModule {
  constructor(bot, options = {}) {
    super("LeaveModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;

    this.leaveService = null;
    this.config = {
      annualLeaveDays: parseInt(process.env.ANNUAL_LEAVE_DAYS) || 15,
      ...options.config,
    };

    logger.module("LeaveModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.leaveService = new LeaveService({
        db: this.db,
        config: this.config,
      });
      await this.leaveService.initialize();
      logger.success("LeaveModule 초기화 완료");
    } catch (error) {
      logger.error("LeaveModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      status: this.showStatus,
      use: this.useLeave,
      history: this.showHistory,
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
    if (command === "leave" || command === "휴가" || command === "연차") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "leave"
      );
      return true;
    }
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const status = await this.leaveService.getLeaveStatus(userId);
      return {
        type: "menu",
        module: "leave",
        data: { status },
      };
    } catch (error) {
      return { type: "error", message: "연차 메뉴를 불러올 수 없습니다." };
    }
  }

  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const status = await this.leaveService.getDetailedStatus(userId);
      return {
        type: "status",
        module: "leave",
        data: { status },
      };
    } catch (error) {
      return { type: "error", message: "연차 현황을 불러올 수 없습니다." };
    }
  }

  async useLeave(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      waitingFor: "leave_days",
      action: "use",
    });

    return {
      type: "input",
      module: "leave",
      message: "사용할 연차 일수를 입력하세요:",
    };
  }

  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const history = await this.leaveService.getLeaveHistory(userId);
      return {
        type: "history",
        module: "leave",
        data: { history },
      };
    } catch (error) {
      return { type: "error", message: "연차 기록을 불러올 수 없습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "leave",
      data: {
        title: "연차 도움말",
        features: ["연차 현황", "연차 사용", "사용 기록"],
        commands: ["/leave - 연차 메뉴"],
      },
    };
  }
}
module.exports = LeaveModule; // ✅ 필수!
