// src/modules/TTSModule.js
const BaseModule = require("../core/BaseModule");
const TTSService = require("../services/TTSService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎤 음성 변환 모듈 (TTS)
 * - 유틸리티에서 독립 모듈로 승격
 * - 6개국어 지원 (한국어, 영어, 일본어, 중국어, 스페인어, 프랑스어)
 * - 자동/수동 모드 지원
 * - Railway 환경 최적화
 */
class TTSModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TTSModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // TTS 서비스
    this.ttsService = null;

    // 지원 언어
    this.supportedLanguages = {
      ko: { name: "한국어", voice: "ko-KR-Wavenet-A", flag: "🇰🇷" },
      en: { name: "English", voice: "en-US-Wavenet-D", flag: "🇺🇸" },
      ja: { name: "日本語", voice: "ja-JP-Wavenet-A", flag: "🇯🇵" },
      zh: { name: "中文", voice: "zh-CN-Wavenet-A", flag: "🇨🇳" },
      es: { name: "Español", voice: "es-ES-Wavenet-A", flag: "🇪🇸" },
      fr: { name: "Français", voice: "fr-FR-Wavenet-A", flag: "🇫🇷" },
    };

    // Railway 환경 설정
    this.config = {
      maxTextLength: parseInt(process.env.TTS_MAX_TEXT_LENGTH) || 1000,
      timeout: parseInt(process.env.TTS_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.TTS_MAX_RETRIES) || 3,
      tempDir: process.env.TTS_TEMP_DIR || "/tmp/tts",
      defaultLanguage: "ko",
      autoMode: true,
    };

    logger.info("🎤 TTSModule 생성됨");
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      this.ttsService = new TTSService();
      this.ttsService.db = this.db;
      await this.ttsService.initialize();

      logger.info("🎤 TTSService 연결 성공");
    } catch (error) {
      logger.error("❌ TTSService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      convert: this.showConvertMenu,
      "convert:ko": this.convertKorean,
      "convert:en": this.convertEnglish,
      "convert:ja": this.convertJapanese,
      "convert:zh": this.convertChinese,
      "convert:es": this.convertSpanish,
      "convert:fr": this.convertFrench,
      "convert:auto": this.convertAuto,
      settings: this.showSettings,
      "settings:language": this.changeLanguage,
      "settings:mode": this.toggleMode,
      history: this.showHistory,
      help: this.showHelp,
    });
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "tts" || text.trim() === "음성") {
      await this.sendTTSMenu(bot, chatId);
      return true;
    }

    // 자동 모드에서 텍스트 변환
    const userSettings = await this.getUserSettings(userId);
    if (userSettings?.ttsSettings?.autoMode && text.length > 10) {
      await this.autoConvertText(bot, chatId, userId, text);
      return true;
    }

    return false;
  }

  // ===== 🎤 TTS 메뉴 액션들 =====

  /**
   * TTS 메인 메뉴
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;
    const userName = getUserName(from);

    const menuText = `🎤 **음성 변환 (TTS)**

안녕하세요, ${userName}님!
텍스트를 음성으로 변환해드립니다.

**지원 언어:**
🇰🇷 한국어  🇺🇸 영어  🇯🇵 일본어
🇨🇳 중국어  🇪🇸 스페인어  🇫🇷 프랑스어

**사용법:**
1. 언어 선택 후 텍스트 입력
2. 자동 모드로 간편 변환
3. 설정에서 기본값 변경`;

    const keyboard = [
      [
        { text: "🎵 음성 변환", callback_data: "tts:convert" },
        { text: "⚙️ 설정", callback_data: "tts:settings" },
      ],
      [
        { text: "📜 변환 기록", callback_data: "tts:history" },
        { text: "❓ 도움말", callback_data: "tts:help" },
      ],
      [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
    ];

    await bot.editMessageText(menuText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * 언어 선택 메뉴
   */
  async showConvertMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText = `🎵 **언어 선택**

변환할 언어를 선택해주세요:`;

    const keyboard = [
      [
        { text: "🇰🇷 한국어", callback_data: "tts:convert:ko" },
        { text: "🇺🇸 English", callback_data: "tts:convert:en" },
      ],
      [
        { text: "🇯🇵 日本語", callback_data: "tts:convert:ja" },
        { text: "🇨🇳 中文", callback_data: "tts:convert:zh" },
      ],
      [
        { text: "🇪🇸 Español", callback_data: "tts:convert:es" },
        { text: "🇫🇷 Français", callback_data: "tts:convert:fr" },
      ],
      [{ text: "🤖 자동 감지", callback_data: "tts:convert:auto" }],
      [{ text: "🔙 뒤로", callback_data: "tts:menu" }],
    ];

    await bot.editMessageText(menuText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * 한국어 변환 시작
   */
  async convertKorean(bot, callbackQuery, params, moduleManager) {
    await this.startTextInput(bot, callbackQuery, "ko");
  }

  /**
   * 영어 변환 시작
   */
  async convertEnglish(bot, callbackQuery, params, moduleManager) {
    await this.startTextInput(bot, callbackQuery, "en");
  }

  /**
   * 일본어 변환 시작
   */
  async convertJapanese(bot, callbackQuery, params, moduleManager) {
    await this.startTextInput(bot, callbackQuery, "ja");
  }

  // ===== 🛠️ 내부 메서드들 =====

  /**
   * 텍스트 입력 시작
   */
  async startTextInput(bot, callbackQuery, language) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    const langInfo = this.supportedLanguages[language];

    this.setUserState(userId, {
      action: "waiting_tts_input",
      language: language,
      messageId: messageId,
    });

    const inputText = `${langInfo.flag} **${langInfo.name} 음성 변환**

변환할 텍스트를 입력해주세요:

**제한사항:**
- 최대 ${this.config.maxTextLength}자
- 특수문자 일부 제한
- 처리 시간: 약 5-10초

/cancel 명령으로 취소할 수 있습니다.`;

    await bot.editMessageText(inputText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "tts:menu" }]],
      },
    });
  }

  /**
   * 자동 텍스트 변환
   */
  async autoConvertText(bot, chatId, userId, text) {
    try {
      // 자동 언어 감지
      const detectedLanguage = this.detectLanguage(text);

      await this.processTextConversion(
        bot,
        chatId,
        userId,
        text,
        detectedLanguage
      );
    } catch (error) {
      logger.error("자동 TTS 변환 오류:", error);
    }
  }

  /**
   * 텍스트 변환 처리
   */
  async processTextConversion(bot, chatId, userId, text, language) {
    try {
      // 텍스트 검증
      if (text.length > this.config.maxTextLength) {
        await bot.sendMessage(
          chatId,
          `❌ 텍스트가 너무 깁니다. (최대 ${this.config.maxTextLength}자)`
        );
        return;
      }

      // 처리 중 메시지
      const processingMsg = await bot.sendMessage(
        chatId,
        "🎤 음성으로 변환 중..."
      );

      // TTS 변환
      const result = await this.ttsService.convertText(text, language, {
        userId: userId,
        quality: "high",
      });

      if (result.success) {
        // 음성 파일 전송
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🎤 ${
            this.supportedLanguages[language].flag
          } ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
          reply_to_message_id: processingMsg.message_id,
        });

        // 처리 메시지 삭제
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } else {
        await bot.editMessageText("❌ 음성 변환에 실패했습니다.", {
          chat_id: chatId,
          message_id: processingMsg.message_id,
        });
      }
    } catch (error) {
      logger.error("TTS 변환 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 음성 변환 중 오류가 발생했습니다.");
    }
  }

  /**
   * 언어 자동 감지
   */
  detectLanguage(text) {
    // 한글 감지
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
      return "ko";
    }

    // 일본어 감지
    if (/[ひらがなカタカナ]/.test(text)) {
      return "ja";
    }

    // 중국어 감지
    if (/[\u4e00-\u9fff]/.test(text)) {
      return "zh";
    }

    // 기본값: 영어
    return "en";
  }

  /**
   * 사용자 설정 조회
   */
  async getUserSettings(userId) {
    try {
      if (this.db) {
        const collection = this.db.collection("user_settings");
        return await collection.findOne({ userId: userId.toString() });
      }
      return null;
    } catch (error) {
      logger.error("사용자 설정 조회 오류:", error);
      return null;
    }
  }

  /**
   * TTS 메뉴 전송
   */
  async sendTTSMenu(bot, chatId) {
    const menuText = `🎤 **음성 변환 (TTS)**

6개 언어로 텍스트를 음성으로 변환합니다.

**지원 언어:**
🇰🇷 한국어  🇺🇸 영어  🇯🇵 일본어
🇨🇳 중국어  🇪🇸 스페인어  🇫🇷 프랑스어`;

    const keyboard = [
      [
        { text: "🎵 음성 변환", callback_data: "tts:convert" },
        { text: "⚙️ 설정", callback_data: "tts:settings" },
      ],
      [
        { text: "📜 변환 기록", callback_data: "tts:history" },
        { text: "❓ 도움말", callback_data: "tts:help" },
      ],
    ];

    await bot.sendMessage(chatId, menuText, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}

module.exports = TTSModule;
