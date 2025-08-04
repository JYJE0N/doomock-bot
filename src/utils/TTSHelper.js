// src/utils/TTSHelper.js - Mongoose 버전
const logger = require("./Logger");

// TTS 관련 기능을 제공하는 클래스
class TTSService {
  constructor() {
    this.modes = new Map(); // 예시 상태 저장소
  }

  getTTSMode(userId) {
    return this.modes.get(userId) || "OFF";
  }

  getTTSHelpText(userId) {
    return `TTS 도움말 텍스트입니다. (유저 ID: ${userId})`;
  }

  createTTSMenuKeyboard(userId) {
    return {
      inline_keyboard: [
        [
          { text: "🔊 자동 모드 ON", callback_data: "tts:auto_on" },
          { text: "❌ OFF", callback_data: "tts:auto_off" }
        ]
      ]
    };
  }

  async handleTTSCommand(bot, chatId, userId, text) {
    await MessageHelper.sendMessage(
      bot,
      chatId,
      `🔊 [TTS] 수동 명령어 실행됨: ${text}`
    );
  }

  async handleTTSCallback(bot, callbackQuery, params) {
    logger.debug("TTS 콜백 처리 (응답은 BotController에서 이미 처리됨)");
  }

  async handleAutoTTS(bot, msg) {
    return false; // 기본: 처리 안 함
  }
}

module.exports = { TTSService };
