// ===== ⏰ ReminderModule.js =====
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");

class ReminderModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options); // ← 간단하게 options 그대로 전달

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
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // ✅ 새로운 방식: 직접 키워드 매칭
    const lowerText = text.toLowerCase().trim();
    const keywords = this.getModuleKeywords();

    // 키워드 매칭 확인
    const isFortuneMessage = keywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      return (
        lowerText === lowerKeyword ||
        lowerText.startsWith(lowerKeyword + " ") ||
        lowerText.includes(lowerKeyword)
      );
    });

    if (isReminderMessage) {
      // ✅ NavigationHandler를 통한 표준 메뉴 호출
      if (this.moduleManager?.navigationHandler?.sendModuleMenu) {
        await this.moduleManager.navigationHandler.sendModuleMenu(
          bot,
          chatId,
          "reminder"
        );
      } else {
        // 폴백 메시지
        await bot.sendMessage(chatId, "🔮 운세 메뉴를 불러오는 중...");
      }
      return true;
    }

    // 사용자 입력 상태 처리 (운세 관련 입력 대기 등)
    const userState = this.getUserState(userId);
    if (userState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, userState);
    }

    return false;
  }

  /**
   * 📝 사용자 입력 처리 (운세 선택 등)
   */
  async handleUserInput(bot, msg, text, userState) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    // 예시: 운세 타입 선택 대기 상태
    if (userState.action === "awaiting_fortune_type") {
      const fortuneType = text.trim().toLowerCase();

      // 운세 타입 매칭
      const typeMap = {
        일반: "general",
        연애: "love",
        사업: "business",
        건강: "health",
        general: "general",
        love: "love",
        business: "business",
        health: "health",
      };

      const selectedType = typeMap[fortuneType];
      if (selectedType) {
        // 운세 처리 로직
        await this.processFortuneRequest(bot, chatId, userId, selectedType);
        this.clearUserState(userId);
        return true;
      } else {
        await bot.sendMessage(
          chatId,
          "❓ 알 수 없는 운세 타입입니다.\n" +
            "다음 중에서 선택해주세요: 일반, 연애, 사업, 건강"
        );
        return true;
      }
    }

    return false;
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
      waitingFor: "reminder_t",
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
module.exports = ReminderModule; // ✅ 필수!
