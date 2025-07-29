const logger = require("../utils/Logger");

class BaseRenderer {
  constructor(bot, navigationHandler) {
    this.bot = bot;
    this.navigationHandler = navigationHandler;
  }

  /**
   * 공통 텍스트 이스케이프
   */
  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);
    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];
    let escaped = text;
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });
    return escaped;
  }

  /**
   * 공통 키보드 생성
   */
  createBackToMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔙 모듈 메뉴", callback_data: `${this.moduleName}:menu` },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };
  }

  /**
   * 공통 메시지 전송
   */
  async sendMessage(chatId, text, keyboard = null, messageId = null) {
    try {
      if (messageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          text,
          {
            parse_mode: "MarkdownV2",
            reply_markup: keyboard,
          }
        );
      } else {
        await this.bot.telegram.sendMessage(chatId, text, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error("메시지 전송 실패:", error);
      throw error;
    }
  }

  /**
   * 자식 클래스에서 구현해야 할 메서드들
   */
  async render(result, ctx) {
    throw new Error("render() 메서드를 구현해야 합니다");
  }
}
module.exports = BaseRenderer;
