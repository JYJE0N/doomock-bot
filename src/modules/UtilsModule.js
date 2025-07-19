// src/modules/UtilsModule.js - 표준 패턴으로 완전 새로 구현

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const { TTSService } = require("../services/TTSService");
const Logger = require("../utils/Logger");

class UtilsModule extends BaseModule {
  constructor() {
    super("UtilsModule", {
      commands: ["tts", "utils"],
      callbacks: ["utils"],
      features: ["tts_menu", "tts_help", "tts_mode", "tts_language"],
    });

    this.ttsService = new TTSService();
    Logger.info("🛠️ UtilsModule + TTSService 초기화 완료");
  }

  // ✅ 표준 액션 등록 패턴 적용
  registerActions() {
    // TTS 관련 액션들
    this.actionMap.set("tts_menu", this.showTTSMenu.bind(this));
    this.actionMap.set("tts_help", this.showTTSHelp.bind(this));
    this.actionMap.set("tts_mode_auto", this.setTTSModeAuto.bind(this));
    this.actionMap.set("tts_mode_manual", this.setTTSModeManual.bind(this));
    this.actionMap.set("tts_mode_off", this.setTTSModeOff.bind(this));
    this.actionMap.set("tts_language", this.showLanguageMenu.bind(this));
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    const ttsMode = this.ttsService.getTTSMode(null) || "OFF";
    const language = this.ttsService.getUserLanguage(null) || "ko";
    const languageName =
      this.ttsService.supportedLanguages[language] || "한국어";

    return {
      text:
        `🛠️ **${userName}님의 유틸리티**\n\n` +
        `**🔊 TTS (음성 변환)**\n` +
        `현재 모드: ${this.getTTSModeText(ttsMode)}\n` +
        `현재 언어: ${languageName}\n\n` +
        `편리한 도구들을 사용해보세요!`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
            { text: "❓ TTS 도움말", callback_data: "utils_tts_help" },
          ],
          [
            { text: "🌍 언어 설정", callback_data: "utils_tts_language" },
            { text: "❓ 유틸리티 도움말", callback_data: "utils_help" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ========== TTS 관련 메서드들 ==========

  async showTTSMenu(bot, chatId, messageId, userId, userName) {
    try {
      const ttsMode = this.ttsService.getTTSMode(userId);
      const language = this.ttsService.getUserLanguage(userId);
      const languageName = this.ttsService.supportedLanguages[language];

      const text =
        `🔊 **TTS 설정 메뉴**\n\n` +
        `현재 모드: ${this.getTTSModeText(ttsMode)}\n` +
        `현재 언어: ${languageName}\n\n` +
        `원하는 모드를 선택하세요:`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: ttsMode === "AUTO" ? "✅ 자동 모드" : "🔊 자동 모드",
              callback_data: "utils_tts_mode_auto",
            },
          ],
          [
            {
              text: ttsMode === "MANUAL" ? "✅ 수동 모드" : "📝 수동 모드",
              callback_data: "utils_tts_mode_manual",
            },
          ],
          [
            {
              text: ttsMode === "OFF" ? "✅ OFF" : "❌ OFF",
              callback_data: "utils_tts_mode_off",
            },
          ],
          [
            { text: "🌍 언어 변경", callback_data: "utils_tts_language" },
            { text: "❓ 도움말", callback_data: "utils_tts_help" },
          ],
          [
            { text: "🔙 유틸리티", callback_data: "utils_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule showTTSMenu 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showTTSHelp(bot, chatId, messageId, userId, userName) {
    try {
      const text =
        `❓ **TTS 도움말**\n\n` +
        `**🎯 사용 방법:**\n\n` +
        `**1️⃣ 자동 모드 (추천)**\n` +
        `• TTS를 자동 모드로 설정\n` +
        `• 채팅창에 텍스트 입력\n` +
        `• 자동으로 음성 변환! 🎵\n\n` +
        `**2️⃣ 수동 모드**\n` +
        `• /tts [텍스트] 명령어 사용\n` +
        `• 예: /tts 안녕하세요\n\n` +
        `**🌍 지원 언어:**\n` +
        `• 한국어, English, 日本語\n` +
        `• 中文, Español, Français\n\n` +
        `**💡 특징:**\n` +
        `• 최대 500자까지 지원\n` +
        `• 자연스러운 음성 합성\n` +
        `• 실시간 언어 변경 가능\n\n` +
        `🚀 지금 바로 TTS를 사용해보세요!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTTSBackKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule showTTSHelp 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async setTTSModeAuto(bot, chatId, messageId, userId, userName) {
    try {
      this.ttsService.setTTSMode(userId, "AUTO");

      const text =
        `✅ **TTS 자동 모드 활성화!**\n\n` +
        `🔊 이제 메시지를 입력하면 자동으로 음성으로 변환됩니다.\n\n` +
        `💬 아무 메시지나 입력해보세요!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTTSBackKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule setTTSModeAuto 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async setTTSModeManual(bot, chatId, messageId, userId, userName) {
    try {
      this.ttsService.setTTSMode(userId, "MANUAL");

      const text =
        `📝 **TTS 수동 모드 활성화!**\n\n` +
        `⌨️ /tts [텍스트] 명령어를 사용하세요.\n\n` +
        `예시: /tts 안녕하세요`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTTSBackKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule setTTSModeManual 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async setTTSModeOff(bot, chatId, messageId, userId, userName) {
    try {
      this.ttsService.setTTSMode(userId, "OFF");

      const text =
        `❌ **TTS 비활성화**\n\n` +
        `🔇 TTS가 비활성화되었습니다.\n\n` +
        `다시 사용하려면 자동 또는 수동 모드를 선택하세요.`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTTSBackKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule setTTSModeOff 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showLanguageMenu(bot, chatId, messageId, userId, userName) {
    try {
      const currentLang = this.ttsService.getUserLanguage(userId);

      const text = `🌍 **TTS 언어 설정**\n\n현재 언어: ${this.ttsService.supportedLanguages[currentLang]}\n\n사용할 언어를 선택하세요:`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: currentLang === "ko" ? "✅ 한국어" : "🇰🇷 한국어",
              callback_data: "utils_tts_lang_ko",
            },
            {
              text: currentLang === "en" ? "✅ English" : "🇺🇸 English",
              callback_data: "utils_tts_lang_en",
            },
          ],
          [
            {
              text: currentLang === "ja" ? "✅ 日本語" : "🇯🇵 日本語",
              callback_data: "utils_tts_lang_ja",
            },
            {
              text: currentLang === "zh" ? "✅ 中文" : "🇨🇳 中文",
              callback_data: "utils_tts_lang_zh",
            },
          ],
          [
            {
              text: currentLang === "es" ? "✅ Español" : "🇪🇸 Español",
              callback_data: "utils_tts_lang_es",
            },
            {
              text: currentLang === "fr" ? "✅ Français" : "🇫🇷 Français",
              callback_data: "utils_tts_lang_fr",
            },
          ],
          [
            { text: "🔙 TTS 설정", callback_data: "utils_tts_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`UtilsModule showLanguageMenu 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ========== 동적 콜백 처리 ==========

  async handleCallback(bot, callbackQuery, subAction, params) {
    // TTS 언어 설정 처리 (tts_lang_ko, tts_lang_en 등)
    const langMatch = subAction.match(/^tts_lang_(.+)$/);

    if (langMatch) {
      const language = langMatch[1];
      return await this.setTTSLanguage(bot, callbackQuery, language);
    }

    // 표준 액션은 부모 클래스에서 처리
    return await super.handleCallback(bot, callbackQuery, subAction, params);
  }

  async setTTSLanguage(bot, callbackQuery, language) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      if (!this.ttsService.supportedLanguages[language]) {
        throw new Error(`지원하지 않는 언어: ${language}`);
      }

      this.ttsService.setUserLanguage(userId, language);
      const languageName = this.ttsService.supportedLanguages[language];

      const text =
        `✅ **언어 변경 완료!**\n\n` +
        `🌍 TTS 언어가 **${languageName}**로 변경되었습니다.\n\n` +
        `이제 ${languageName}로 음성이 생성됩니다.`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTTSBackKeyboard(),
      });

      this.updateStats("callback");
      return true;
    } catch (error) {
      Logger.error(`UtilsModule setTTSLanguage(${language}) 오류:`, error);
      await this.handleError(bot, chatId, error);
      return true;
    }
  }

  // ========== 유틸리티 메서드들 ==========

  getTTSModeText(mode) {
    const modeTexts = {
      AUTO: "🔊 자동 모드",
      MANUAL: "📝 수동 모드",
      OFF: "❌ OFF",
    };
    return modeTexts[mode] || "❌ OFF";
  }

  getTTSBackKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };
  }

  // ========== 명령어 처리 ==========

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text && text.startsWith("/tts")) {
      await this.handleTTSCommand(bot, msg);
      this.updateStats("command");
      return true;
    }

    // 자동 TTS 처리
    if (text && !text.startsWith("/")) {
      const handled = await this.ttsService.handleAutoTTS(bot, msg);
      if (handled) {
        this.updateStats("callback");
      }
      return handled;
    }

    return false;
  }

  async handleTTSCommand(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    try {
      // /tts 제거하고 텍스트 추출
      const ttsText = text.replace("/tts", "").trim();

      if (!ttsText) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 변환할 텍스트를 입력해주세요.\n\n예: /tts 안녕하세요"
        );
        return;
      }

      // TTS 변환 실행
      await this.ttsService.handleTTSCommand(bot, chatId, userId, text);
    } catch (error) {
      Logger.error("UtilsModule handleTTSCommand 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ TTS 처리 중 오류가 발생했습니다."
      );
    }
  }

  // ✅ 도움말 메시지 오버라이드
  getHelpMessage() {
    return `🛠️ **유틸리티 도움말**

**🔊 TTS (음성 변환)**
• /tts [텍스트] - 텍스트를 음성으로 변환
• 자동 모드: 모든 메시지를 자동 음성 변환
• 수동 모드: 명령어로만 변환

**🌍 지원 언어:**
• 🇰🇷 한국어 • 🇺🇸 English
• 🇯🇵 日本語 • 🇨🇳 中文  
• 🇪🇸 Español • 🇫🇷 Français

**⚙️ 설정:**
• TTS 모드 변경 (자동/수동/OFF)
• 언어 설정
• 실시간 모드 전환

**💡 팁:**
• 자동 모드 권장 (가장 편리)
• 최대 500자까지 지원
• 명령어는 TTS에서 제외

편리한 음성 변환을 경험해보세요! 🎵`;
  }

  // ========== 초기화 ==========

  async initialize() {
    try {
      if (!this.ttsService) {
        Logger.warn("TTSService가 없어도 기본 기능은 제공합니다.");
      }

      await super.initialize();
      Logger.success("✅ UtilsModule 초기화 완료");
    } catch (error) {
      Logger.error("❌ UtilsModule 초기화 실패:", error);
      throw error;
    }
  }
}

module.exports = UtilsModule;
