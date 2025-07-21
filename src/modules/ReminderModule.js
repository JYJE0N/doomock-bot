const BaseModule = require("./BaseModule");
const ReminderService = require("../services/ReminderService");
const timeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");

// ✅ 새로운 해결책 (logger를 함수로 가져오기)
const logger = require("../utils/Logger");

class ReminderModule extends BaseModule {
  constructor() {
    super("ReminderModule");
    this.reminderService = new ReminderService();
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    if (text && text.startsWith("/remind")) {
      await this.handleReminderCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    switch (subAction) {
      case "menu":
        await this.showReminderMenu(
          bot,
          chatId,
          messageId,
          userName,
          menuManager
        );
        break;
      case "minutes":
        await this.showMinutesHelp(bot, chatId, messageId);
        break;
      case "time":
        await this.showTimeHelp(bot, chatId, messageId);
        break;
      case "help":
        await this.showReminderHelp(bot, chatId, messageId);
        break;
      default:
        await this.sendMessage(
          bot,
          chatId,
          "❌ 알 수 없는 리마인더 명령입니다."
        );
    }
  }

  async handleReminderCommand(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    try {
      const result = this.reminderService.parseReminderCommand(text);

      if (result.success) {
        await this.reminderService.setReminder(bot, chatId, result.data);
        await this.sendMessage(bot, chatId, result.message);
      } else {
        await this.sendMessage(bot, chatId, result.message);
      }
    } catch (error) {
      console.error("리마인더 처리 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 리마인더 설정 중 오류가 발생했습니다."
      );
    }
  }

  async showReminderMenu(bot, chatId, messageId, userName, menuManager) {
    const menuText = menuManager.getMenuText("reminder", userName);
    const keyboard = menuManager.createKeyboard("reminder");

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showMinutesHelp(bot, chatId, messageId) {
    const helpText =
      "⏰ **분 단위 리마인더**\n\n" +
      "**사용법:** /remind [분] [내용]\n\n" +
      "**예시:**\n" +
      "• /remind 30 독서하기\n" +
      "• /remind 60 운동하기\n" +
      "• /remind 15 휴식 시간\n" +
      "• /remind 120 중요한 회의\n\n" +
      "**특징:**\n" +
      "• 1분~1440분(24시간) 설정 가능\n" +
      "• 설정한 시간 후 자동 알림\n" +
      "• 여러 개 동시 설정 가능\n\n" +
      "⏱️ 효율적인 시간 관리를 도와드립니다!";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder_menu" }],
        ],
      },
    });
  }

  async showTimeHelp(bot, chatId, messageId) {
    const helpText =
      "🕐 **시간 설정 리마인더**\n\n" +
      "**사용법:** /remind [시간] [내용]\n\n" +
      "**예시:**\n" +
      "• /remind 14:30 점심약속\n" +
      "• /remind 18:00 퇴근 준비\n" +
      "• /remind 09:00 회의 시작\n" +
      "• /remind 22:30 약 먹기\n\n" +
      "**특징:**\n" +
      "• 24시간 형식 (HH:MM)\n" +
      "• 시간이 지났으면 다음 날로 자동 설정\n" +
      "• 한국 시간 기준\n\n" +
      "📅 정확한 시간에 알림을 받으세요!";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder_menu" }],
        ],
      },
    });
  }

  async showReminderHelp(bot, chatId, messageId) {
    const helpText =
      "❓ **리마인더 사용법**\n\n" +
      "**📱 두 가지 방법:**\n" +
      "• /remind [분] [내용]\n" +
      "• /remind [시간] [내용]\n\n" +
      "**⏰ 분 단위 예시:**\n" +
      "• /remind 30 독서하기\n" +
      "• /remind 60 운동하기\n\n" +
      "**🕐 시간 설정 예시:**\n" +
      "• /remind 14:30 점심약속\n" +
      "• /remind 18:00 퇴근 준비\n\n" +
      "**💡 팁:**\n" +
      "• 여러 개 리마인더 동시 설정 가능\n" +
      "• 한국 시간 기준으로 동작\n" +
      "• 정확한 시간에 알림 발송\n\n" +
      "설정한 시간이 되면 알림을 보내드립니다! 🔔";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder_menu" }],
        ],
      },
    });
  }
}

module.exports = ReminderModule;
