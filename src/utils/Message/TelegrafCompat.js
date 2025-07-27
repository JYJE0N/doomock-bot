// src/utils/TelegrafCompat.js - 호환성 레이어
const logger = require("../Logger");

/**
 * 🔄 Telegraf 호환성 레이어
 *
 * 기존 node-telegram-bot-api 코드가 Telegraf에서도 작동하도록
 * 호환성을 제공하는 래퍼 클래스
 */
class TelegrafCompat {
  constructor(ctx) {
    this.ctx = ctx;
    this.telegram = ctx.telegram || ctx.bot?.telegram;
  }

  /**
   * 메시지 전송 (node-telegram-bot-api 스타일)
   */
  async sendMessage(chatId, text, options = {}) {
    try {
      const telegrafOptions = this.convertSendMessageOptions(options);

      if (this.ctx && this.ctx.chat && this.ctx.chat.id === chatId) {
        // 현재 컨텍스트에서 전송
        return await this.ctx.reply(text, telegrafOptions);
      } else {
        // telegram API 직접 사용
        return await this.telegram.sendMessage(chatId, text, telegrafOptions);
      }
    } catch (error) {
      logger.error("호환성 레이어 sendMessage 오류:", error);
      throw error;
    }
  }

  /**
   * 메시지 편집
   */
  async editMessageText(text, options = {}) {
    try {
      const { chat_id, message_id, ...rest } = options;
      const telegrafOptions = this.convertSendMessageOptions(rest);

      if (this.ctx && this.ctx.callbackQuery) {
        // 콜백 쿼리 컨텍스트에서 편집
        return await this.ctx.editMessageText(text, telegrafOptions);
      } else {
        // telegram API 직접 사용
        return await this.telegram.editMessageText(
          chat_id,
          message_id,
          undefined,
          text,
          telegrafOptions
        );
      }
    } catch (error) {
      logger.error("호환성 레이어 editMessageText 오류:", error);
      throw error;
    }
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(chatId, messageId) {
    try {
      if (this.ctx && this.ctx.chat && this.ctx.chat.id === chatId) {
        // 현재 컨텍스트에서 삭제
        return await this.ctx.deleteMessage(messageId);
      } else {
        // telegram API 직접 사용
        return await this.telegram.deleteMessage(chatId, messageId);
      }
    } catch (error) {
      logger.error("호환성 레이어 deleteMessage 오류:", error);
      throw error;
    }
  }

  /**
   * 음성 파일 전송
   */
  async sendVoice(chatId, voice, options = {}) {
    try {
      const telegrafOptions = this.convertMediaOptions(options);

      if (this.ctx && this.ctx.chat && this.ctx.chat.id === chatId) {
        return await this.ctx.replyWithVoice(voice, telegrafOptions);
      } else {
        return await this.telegram.sendVoice(chatId, voice, telegrafOptions);
      }
    } catch (error) {
      logger.error("호환성 레이어 sendVoice 오류:", error);
      throw error;
    }
  }

  /**
   * 사진 전송
   */
  async sendPhoto(chatId, photo, options = {}) {
    try {
      const telegrafOptions = this.convertMediaOptions(options);

      if (this.ctx && this.ctx.chat && this.ctx.chat.id === chatId) {
        return await this.ctx.replyWithPhoto(photo, telegrafOptions);
      } else {
        return await this.telegram.sendPhoto(chatId, photo, telegrafOptions);
      }
    } catch (error) {
      logger.error("호환성 레이어 sendPhoto 오류:", error);
      throw error;
    }
  }

  /**
   * 문서 전송
   */
  async sendDocument(chatId, document, options = {}) {
    try {
      const telegrafOptions = this.convertMediaOptions(options);

      if (this.ctx && this.ctx.chat && this.ctx.chat.id === chatId) {
        return await this.ctx.replyWithDocument(document, telegrafOptions);
      } else {
        return await this.telegram.sendDocument(
          chatId,
          document,
          telegrafOptions
        );
      }
    } catch (error) {
      logger.error("호환성 레이어 sendDocument 오류:", error);
      throw error;
    }
  }

  /**
   * 콜백 쿼리 응답
   */
  async answerCallbackQuery(callbackQueryId, options = {}) {
    try {
      if (
        this.ctx &&
        this.ctx.callbackQuery &&
        this.ctx.callbackQuery.id === callbackQueryId
      ) {
        // 컨텍스트에서 응답
        return await this.ctx.answerCbQuery(options.text, {
          show_alert: options.show_alert,
          url: options.url,
          cache_time: options.cache_time,
        });
      } else {
        // telegram API 직접 사용
        return await this.telegram.answerCbQuery(
          callbackQueryId,
          options.text,
          options.show_alert,
          options
        );
      }
    } catch (error) {
      logger.error("호환성 레이어 answerCallbackQuery 오류:", error);
      throw error;
    }
  }

  /**
   * 인라인 쿼리 응답
   */
  async answerInlineQuery(inlineQueryId, results, options = {}) {
    try {
      if (
        this.ctx &&
        this.ctx.inlineQuery &&
        this.ctx.inlineQuery.id === inlineQueryId
      ) {
        return await this.ctx.answerInlineQuery(results, options);
      } else {
        return await this.telegram.answerInlineQuery(
          inlineQueryId,
          results,
          options
        );
      }
    } catch (error) {
      logger.error("호환성 레이어 answerInlineQuery 오류:", error);
      throw error;
    }
  }

  /**
   * 봇 정보 가져오기
   */
  async getMe() {
    try {
      return await this.telegram.getMe();
    } catch (error) {
      logger.error("호환성 레이어 getMe 오류:", error);
      throw error;
    }
  }

  /**
   * sendMessage 옵션 변환
   */
  convertSendMessageOptions(options) {
    const converted = {};

    // parse_mode 변환
    if (options.parse_mode) {
      converted.parse_mode = options.parse_mode;
    }

    // reply_markup 변환
    if (options.reply_markup) {
      converted.reply_markup = options.reply_markup;
    }

    // reply_to_message_id 변환
    if (options.reply_to_message_id) {
      converted.reply_to_message_id = options.reply_to_message_id;
    }

    // disable_notification 변환
    if (options.disable_notification !== undefined) {
      converted.disable_notification = options.disable_notification;
    }

    // disable_web_page_preview 변환
    if (options.disable_web_page_preview !== undefined) {
      converted.disable_web_page_preview = options.disable_web_page_preview;
    }

    return converted;
  }

  /**
   * 미디어 옵션 변환
   */
  convertMediaOptions(options) {
    const converted = this.convertSendMessageOptions(options);

    // caption 변환
    if (options.caption) {
      converted.caption = options.caption;
    }

    // caption_entities 변환
    if (options.caption_entities) {
      converted.caption_entities = options.caption_entities;
    }

    return converted;
  }
}

/**
 * 🔄 봇 래퍼 생성 함수
 *
 * Telegraf 컨텍스트를 받아서 node-telegram-bot-api 스타일의
 * 봇 객체를 반환합니다.
 */
function createBotWrapper(ctx) {
  return new TelegrafCompat(ctx);
}

/**
 * 🔄 글로벌 봇 래퍼 생성
 *
 * 전역적으로 사용할 봇 래퍼를 생성합니다.
 * ModuleManager 등에서 사용
 */
function createGlobalBotWrapper(bot) {
  return {
    telegram: bot.telegram,

    sendMessage: (chatId, text, options) =>
      bot.telegram.sendMessage(chatId, text, options),

    editMessageText: (text, options) => {
      const { chat_id, message_id, ...rest } = options;
      return bot.telegram.editMessageText(
        chat_id,
        message_id,
        undefined,
        text,
        rest
      );
    },

    deleteMessage: (chatId, messageId) =>
      bot.telegram.deleteMessage(chatId, messageId),

    sendVoice: (chatId, voice, options) =>
      bot.telegram.sendVoice(chatId, voice, options),

    sendPhoto: (chatId, photo, options) =>
      bot.telegram.sendPhoto(chatId, photo, options),

    sendDocument: (chatId, document, options) =>
      bot.telegram.sendDocument(chatId, document, options),

    answerCallbackQuery: (callbackQueryId, options) =>
      bot.telegram.answerCbQuery(
        callbackQueryId,
        options.text,
        options.show_alert,
        options
      ),

    answerInlineQuery: (inlineQueryId, results, options) =>
      bot.telegram.answerInlineQuery(inlineQueryId, results, options),

    getMe: () => bot.telegram.getMe(),

    // 이벤트 핸들러 (호환성을 위해 빈 함수)
    on: () => {},
    once: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
  };
}

module.exports = {
  TelegrafCompat,
  createBotWrapper,
  createGlobalBotWrapper,
};
