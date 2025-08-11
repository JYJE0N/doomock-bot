// src/utils/MessageHelper.js
const MarkdownHelper = require("./MarkdownHelper");

// 싱글톤 인스턴스
const markdownHelper = new MarkdownHelper();

/**
 * 전역 메시지 헬퍼 - 모든 모듈에서 쉽게 사용
 */
class MessageHelper {
  /**
   * ctx 객체 생성 헬퍼
   */
  static createCtx(bot, msg) {
    // callbackQuery인 경우
    if (msg.message) {
      return {
        chat: msg.message.chat,
        from: msg.from,
        callbackQuery: msg,
        editMessageText: async (text, options = {}) => {
          const opts = {
            parse_mode: "Markdown",
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
            ...options
          };
          if (bot.telegram) {
            return bot.telegram.editMessageText(text, opts);
          } else if (bot.editMessageText) {
            return bot.editMessageText(text, opts);
          }
        },
        answerCbQuery: async () => {
          if (bot.telegram) {
            return bot.telegram.answerCbQuery(msg.id);
          } else if (bot.answerCallbackQuery) {
            return bot.answerCallbackQuery(msg.id);
          }
        }
      };
    }

    // 일반 메시지인 경우
    return {
      chat: msg.chat,
      from: msg.from,
      message: msg,
      reply: async (text, options = {}) => {
        return MessageHelper.send(
          { chat: msg.chat, from: msg.from, telegram: bot.telegram || bot },
          text,
          options
        );
      }
    };
  }

  /**
   * 메시지 전송 (자동 parse_mode 추가)
   */
  static async send(ctx, text, options = {}) {
    // parse_mode 자동 추가
    const enhancedOptions = {
      parse_mode: "Markdown",
      ...options
    };

    return await markdownHelper.sendSafeMessage(ctx, text, enhancedOptions);
  }

  /**
   * bot.sendMessage 대체용
   */
  static async sendMessage(bot, chatId, text, options = {}) {
    const ctx = {
      chat: { id: chatId },
      telegram: bot.telegram || bot,
      reply: async (text, opts) => {
        if (bot.telegram) {
          return bot.telegram.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            ...opts
          });
        } else if (bot.sendMessage) {
          return bot.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            ...opts
          });
        }
      }
    };

    return await MessageHelper.send(ctx, text, options);
  }

  /**
   * 편의 메서드들
   */
  static escape(text) {
    return markdownHelper.escape(text);
  }

  static bold(text) {
    return `*${text}*`;
  }

  static italic(text) {
    return `_${text}_`;
  }

  static code(text) {
    return `\`${text}\``;
  }
}

module.exports = MessageHelper;
