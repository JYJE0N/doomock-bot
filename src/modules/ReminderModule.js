const BaseModule = require("./BaseModule");
const ReminderService = require("../services/ReminderService");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class ReminderModule extends BaseModule {
  constructor(bot, dependencies) {
    super("ReminderModule", {
      commands: ["remind"],
      callbacks: ["reminder"],
      features: ["menu", "create", "list", "remove", "help"],
    });

    this.reminderService = null;
  }

  // 🎯 서비스 초기화
  async onInitialize() {
    try {
      this.reminderService = new ReminderService(this.db);
      await this.reminderService.initialize();
      logger.info("⏰ ReminderService 초기화 성공");
    } catch (error) {
      logger.error("❌ ReminderService 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션맵 등록
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      create: this.startReminderCreation,
      list: this.showReminderList,
      remove: this.removeReminder,
      help: this.showHelp,
    });
  }

  // 🎯 액션 메서드들
  async showMenu(bot, chatId, messageId, from, menuManager) {
    const userName = getUserName(from);
    const text = menuManager.getMenuText("reminder", userName);
    const keyboard = menuManager.createKeyboard("reminder");

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async startReminderCreation(bot, chatId, messageId, from) {
    await this.sendMessage(
      bot,
      chatId,
      "✍️ 리마인더를 설정하려면 다음과 같이 입력하세요:\n\n" +
        "• `/remind 30 독서하기`\n" +
        "• `/remind 14:00 회의 시작`\n\n" +
        "자세한 설명은 /remind help 를 참고하세요.",
      { parse_mode: "Markdown" }
    );
  }

  async showReminderList(bot, chatId, messageId, from) {
    const list = await this.reminderService.getReminderList(chatId);
    const message =
      list.length > 0
        ? "🔔 현재 설정된 리마인더 목록:\n\n" +
          list.map((r, i) => `${i + 1}. ${r.text} - ${r.time}`).join("\n")
        : "📭 설정된 리마인더가 없습니다.";
    await this.sendMessage(bot, chatId, message);
  }

  async removeReminder(bot, chatId, messageId, from) {
    await this.sendMessage(
      bot,
      chatId,
      "🗑️ 삭제할 리마인더 번호를 입력해주세요.\n(예: `/remind remove 1`)",
      { parse_mode: "Markdown" }
    );
  }

  async showHelp(bot, chatId, messageId, from) {
    const helpText =
      "❓ *리마인더 사용법*\n\n" +
      "**분 단위 설정:** `/remind 30 독서하기`\n" +
      "**시간 설정:** `/remind 14:30 회의`\n\n" +
      "• 여러 개 동시 설정 가능\n" +
      "• 분/시간 형식 자동 인식\n" +
      "• 설정된 시간에 자동 알림 발송";

    await this.sendMessage(bot, chatId, helpText, { parse_mode: "Markdown" });
  }
}

module.exports = ReminderModule;
