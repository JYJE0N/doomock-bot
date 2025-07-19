const gtts = require("gtts");
const fs = require("fs");
const path = require("path");

class TTSService {
  constructor() {
    this.supportedLanguages = {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      zh: "中文",
      es: "Español",
      fr: "Français",
    };

    this.defaultLanguage = "ko";
    this.tempDir = "./temp";
    this.userModes = new Map(); // userId -> mode
    this.userLanguages = new Map(); // userId -> language

    // temp 디렉토리 생성
    this.ensureTempDir();
  }

  // temp 디렉토리 확인/생성
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // TTS 모드 조회
  getTTSMode(userId) {
    return this.userModes.get(userId) || "OFF";
  }

  // TTS 모드 설정
  setTTSMode(userId, mode) {
    this.userModes.set(userId, mode);
  }

  // 사용자 언어 조회
  getUserLanguage(userId) {
    return this.userLanguages.get(userId) || this.defaultLanguage;
  }

  // 사용자 언어 설정
  setUserLanguage(userId, language) {
    this.userLanguages.set(userId, language);
  }

  // TTS 도움말 텍스트
  getTTSHelpText(userId) {
    const mode = this.getTTSMode(userId);
    const language = this.getUserLanguage(userId);

    return (
      `🔊 **TTS 설정**\n\n` +
      `현재 모드: **${mode}**\n` +
      `현재 언어: **${this.supportedLanguages[language]}**\n\n` +
      `**자동 모드**: 채팅 메시지를 자동으로 음성 변환\n` +
      `**수동 모드**: /tts 명령어로만 음성 변환\n` +
      `**OFF**: TTS 기능 비활성화\n\n` +
      `원하는 모드를 선택하세요:`
    );
  }

  // TTS 메뉴 키보드 생성
  createTTSMenuKeyboard(userId) {
    const mode = this.getTTSMode(userId);

    return {
      inline_keyboard: [
        [
          {
            text: mode === "AUTO" ? "✅ 자동 모드" : "🔊 자동 모드",
            callback_data: "tts_mode_auto",
          },
          {
            text: mode === "MANUAL" ? "✅ 수동 모드" : "📝 수동 모드",
            callback_data: "tts_mode_manual",
          },
        ],
        [
          {
            text: mode === "OFF" ? "✅ OFF" : "❌ OFF",
            callback_data: "tts_mode_off",
          },
          {
            text: "🌍 언어 설정",
            callback_data: "tts_lang_menu",
          },
        ],
        [{ text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" }],
      ],
    };
  }

  // 언어 선택 키보드
  createLanguageKeyboard() {
    const languages = [
      [
        { text: "🇰🇷 한국어", callback_data: "tts_lang_ko" },
        { text: "🇺🇸 English", callback_data: "tts_lang_en" },
      ],
      [
        { text: "🇯🇵 日本語", callback_data: "tts_lang_ja" },
        { text: "🇨🇳 中文", callback_data: "tts_lang_zh" },
      ],
      [
        { text: "🇪🇸 Español", callback_data: "tts_lang_es" },
        { text: "🇫🇷 Français", callback_data: "tts_lang_fr" },
      ],
      [{ text: "🔙 TTS 설정", callback_data: "utils_tts_menu" }],
    ];

    return { inline_keyboard: languages };
  }

  // TTS 콜백 처리
  async handleTTSCallback(bot, callbackQuery, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
      data,
    } = callbackQuery;

    try {
      // tts_mode_auto, tts_mode_manual, tts_mode_off 처리
      if (data.startsWith("tts_mode_")) {
        const mode = data.replace("tts_mode_", "").toUpperCase();
        await this.setTTSModeCallback(bot, chatId, messageId, userId, mode);
        return;
      }

      // tts_lang_ko, tts_lang_en 등 언어 설정 처리
      if (data.startsWith("tts_lang_")) {
        if (data === "tts_lang_menu") {
          await this.showLanguageMenu(bot, chatId, messageId);
        } else {
          const language = data.replace("tts_lang_", "");
          await this.setTTSLanguageCallback(
            bot,
            chatId,
            messageId,
            userId,
            language,
            callbackQuery
          );
        }
        return;
      }

      // 기타 TTS 관련 콜백
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 알 수 없는 TTS 명령입니다.",
      });
    } catch (error) {
      console.error("TTS 콜백 처리 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ TTS 처리 중 오류가 발생했습니다.",
      });
    }
  }

  // TTS 모드 변경 콜백
  async setTTSModeCallback(bot, chatId, messageId, userId, mode) {
    this.setTTSMode(userId, mode);

    const modeText = {
      AUTO: "🔊 자동 모드",
      MANUAL: "📝 수동 모드",
      OFF: "❌ OFF",
    };

    const helpText = this.getTTSHelpText(userId);
    const keyboard = this.createTTSMenuKeyboard(userId);

    await bot.editMessageText(
      `✅ TTS 모드가 **${modeText[mode]}**로 변경되었습니다!\n\n${helpText}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  }

  // 언어 메뉴 표시
  async showLanguageMenu(bot, chatId, messageId) {
    await bot.editMessageText(
      "🌍 **TTS 언어 설정**\n\n사용할 언어를 선택해주세요:",
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: this.createLanguageKeyboard(),
      }
    );
  }

  async setTTSLanguageCallback(
    bot,
    chatId,
    messageId,
    userId,
    language,
    callbackQuery
  ) {
    if (!this.supportedLanguages[language]) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 지원하지 않는 언어입니다.",
      });
      return;
    }

    this.setUserLanguage(userId, language);

    const helpText = this.getTTSHelpText(userId);
    const keyboard = this.createTTSMenuKeyboard(userId);

    await bot.editMessageText(
      `✅ TTS 언어가 **${this.supportedLanguages[language]}**로 변경되었습니다!\n\n${helpText}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  }

  // TTS 명령어 처리
  async handleTTSCommand(bot, chatId, userId, text) {
    try {
      // /tts 제거하고 텍스트 추출
      const ttsText = text.replace("/tts", "").trim();

      if (!ttsText) {
        await bot.sendMessage(
          chatId,
          "❌ 변환할 텍스트를 입력해주세요.\n예: /tts 안녕하세요"
        );
        return;
      }

      // 언어 감지 및 TTS 변환
      const language = this.getUserLanguage(userId);
      const result = await this.convertTextToSpeech(ttsText, language);

      if (result.success) {
        // 음성 파일 전송
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🔊 TTS: "${ttsText}" (${this.supportedLanguages[language]})`,
        });

        // 임시 파일 삭제
        setTimeout(() => {
          this.cleanupFile(result.filePath);
        }, 5000);
      } else {
        await bot.sendMessage(chatId, `❌ TTS 변환 실패: ${result.message}`);
      }
    } catch (error) {
      console.error("TTS 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ TTS 처리 중 오류가 발생했습니다.");
    }
  }

  // 자동 TTS 처리
  async handleAutoTTS(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    // 자동 모드가 아니면 처리하지 않음
    if (this.getTTSMode(userId) !== "AUTO") {
      return false;
    }

    // 명령어나 특수 메시지는 제외
    if (!text || text.startsWith("/") || text.length > 500) {
      return false;
    }

    try {
      const language = this.getUserLanguage(userId);
      const result = await this.convertTextToSpeech(text, language);

      if (result.success) {
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🔊 자동 TTS (${this.supportedLanguages[language]})`,
        });

        // 임시 파일 삭제
        setTimeout(() => {
          this.cleanupFile(result.filePath);
        }, 5000);
      }
    } catch (error) {
      console.error("자동 TTS 처리 오류:", error);
    }

    return false; // 다른 모듈도 메시지를 처리할 수 있도록
  }

  // TTS 변환 실행
  async convertTextToSpeech(text, language = "ko") {
    return new Promise((resolve) => {
      try {
        const fileName = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
        const filePath = path.join(this.tempDir, fileName);

        const gttsInstance = new gtts(text, language);
        gttsInstance.save(filePath, (err) => {
          if (err) {
            resolve({
              success: false,
              message: err.message,
            });
          } else {
            resolve({
              success: true,
              filePath: filePath,
            });
          }
        });
      } catch (error) {
        resolve({
          success: false,
          message: error.message,
        });
      }
    });
  }

  // 파일 정리
  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("파일 삭제 오류:", error);
    }
  }

  // 언어 감지 (간단한 구현)
  detectLanguage(text) {
    // 한글이 포함되어 있으면 한국어
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
      return "ko";
    }

    // 일본어 히라가나/가타카나
    if (/[\u3040-\u30ff]/.test(text)) {
      return "ja";
    }

    // 중국어 간체/번체
    if (/[\u4e00-\u9fff]/.test(text)) {
      return "zh";
    }

    // 기본값은 영어
    return "en";
  }
}

module.exports = { TTSService };
