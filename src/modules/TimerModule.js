// ===== ⏱️ TimerModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper"); // ✅ 추가

class TimerModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TimerModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;

    this.timerService = null;
    this.config = {
      defaultDuration: parseInt(process.env.DEFAULT_TIMER_DURATION) || 25, // 25분
      ...options.config,
    };

    logger.module("TimerModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.timerService = await this.serviceBuilder.getOrCreate("timer", {
        config: this.config,
      });

      await this.timerService.initialize();
      logger.success("TimerModule 초기화 완료");
    } catch (error) {
      logger.error("TimerModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      start: this.startTimer,
      stop: this.stopTimer,
      status: this.showStatus,
      help: this.showHelp,
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // ✅ 1. 키워드 매칭으로 모듈 메시지 확인
    if (this.isModuleMessage(text)) {
      return await this.handleModuleCommand(bot, msg);
    }

    // ✅ 2. 사용자 입력 상태 처리
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  /**
   * 🎯 모듈 명령어 처리 (자식 클래스에서 구현 가능)
   */
  async handleModuleCommand(bot, msg) {
    const {
      chat: { id: chatId },
    } = msg;
    const moduleKey = this.moduleName.toLowerCase().replace("module", "");

    // NavigationHandler를 통한 표준 메뉴 표시
    if (this.moduleManager?.navigationHandler?.sendModuleMenu) {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        moduleKey
      );
    } else {
      // 폴백 메시지
      await bot.sendMessage(chatId, `${this.moduleName} 메뉴를 불러오는 중...`);
    }

    return true;
  }

  /**
   * 📝 사용자 입력 처리 (자식 클래스에서 구현)
   */
  async handleUserInput(bot, msg, text, userState) {
    // 자식 클래스에서 구현
    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from); // ✅ 이제 작동함

    try {
      const status = await this.timerService.getTimerStatus(userId);
      return {
        type: "menu",
        module: "timer",
        data: { status },
      };
    } catch (error) {
      return { type: "error", message: "타이머 메뉴를 불러올 수 없습니다." };
    }
  }

  async startTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const duration = parseInt(params.duration) || this.config.defaultDuration;

    try {
      const result = await this.timerService.startTimer(userId, duration);
      return {
        type: "start",
        module: "timer",
        data: { result },
      };
    } catch (error) {
      return { type: "error", message: "타이머 시작에 실패했습니다." };
    }
  }

  async stopTimer(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const result = await this.timerService.stopTimer(userId);
      return {
        type: "stop",
        module: "timer",
        data: { result },
      };
    } catch (error) {
      return { type: "error", message: "타이머 정지에 실패했습니다." };
    }
  }

  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const status = await this.timerService.getDetailedStatus(userId);
      return {
        type: "status",
        module: "timer",
        data: { status },
      };
    } catch (error) {
      return { type: "error", message: "타이머 상태를 불러올 수 없습니다." };
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "timer",
      data: {
        title: "타이머 도움말",
        features: ["포모도로 타이머", "집중 시간 기록"],
        commands: ["/timer - 타이머 메뉴"],
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
module.exports = TimerModule; // ✅ 필수!
