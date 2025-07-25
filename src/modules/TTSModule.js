// src/modules/TTSModule.js - ServiceBuilder 연동 리팩토링 v3.0.1
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎤 음성 변환 모듈 (TTS) v3.0.1 - ServiceBuilder 연동
 *
 * 🎯 주요 변경사항:
 * - ServiceBuilder를 통한 TTSService 요청
 * - Google Cloud Text-to-Speech API 연동
 * - 새로운 BaseModule 상속
 * - 표준 매개변수 체계 준수
 */
class TTSModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TTSModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스 (ServiceBuilder로 요청)
    this.ttsService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableTTS: process.env.ENABLE_TTS !== "false",
      maxTextLength: parseInt(process.env.TTS_MAX_TEXT_LENGTH) || 1000,
      defaultLanguage: process.env.TTS_DEFAULT_LANGUAGE || "ko",
      enableVoiceSelection: process.env.TTS_ENABLE_VOICE_SELECTION === "true",
      ...this.config,
    };

    // 지원 언어 (Google Cloud TTS 기준)
    this.supportedLanguages = {
      ko: {
        name: "한국어",
        code: "ko-KR",
        voice: "ko-KR-Standard-A",
        flag: "🇰🇷",
      },
      en: {
        name: "English",
        code: "en-US",
        voice: "en-US-Standard-A",
        flag: "🇺🇸",
      },
      ja: {
        name: "日本語",
        code: "ja-JP",
        voice: "ja-JP-Standard-A",
        flag: "🇯🇵",
      },
      zh: {
        name: "中文",
        code: "zh-CN",
        voice: "zh-CN-Standard-A",
        flag: "🇨🇳",
      },
      es: {
        name: "Español",
        code: "es-ES",
        voice: "es-ES-Standard-A",
        flag: "🇪🇸",
      },
      fr: {
        name: "Français",
        code: "fr-FR",
        voice: "fr-FR-Standard-A",
        flag: "🇫🇷",
      },
      de: {
        name: "Deutsch",
        code: "de-DE",
        voice: "de-DE-Standard-A",
        flag: "🇩🇪",
      },
      it: {
        name: "Italiano",
        code: "it-IT",
        voice: "it-IT-Standard-A",
        flag: "🇮🇹",
      },
      pt: {
        name: "Português",
        code: "pt-BR",
        voice: "pt-BR-Standard-A",
        flag: "🇧🇷",
      },
      ru: {
        name: "Русский",
        code: "ru-RU",
        voice: "ru-RU-Standard-A",
        flag: "🇷🇺",
      },
    };

    // 사용자별 설정
    this.userSettings = new Map();

    logger.info("🎤 TTSModule v3.0.1 생성됨 (ServiceBuilder 연동)");
  }

  /**
   * 🎯 모듈 초기화 (ServiceBuilder 활용)
   */
  async onInitialize() {
    try {
      if (!this.config.enableTTS) {
        logger.warn("⚠️ TTS 기능이 비활성화되어 있습니다.");
        return;
      }

      logger.info("🎤 TTSModule 초기화 시작 (ServiceBuilder 활용)...");

      // 🔧 ServiceBuilder를 통해 TTSService 요청
      this.ttsService = await this.requireService("tts");

      logger.success("✅ TTSModule 초기화 완료 (ServiceBuilder 연동)");
    } catch (error) {
      logger.error("❌ TTSModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,
      help: this.showHelp,

      // TTS 변환
      convert: this.startTextConversion,
      "convert:execute": this.executeConversion,

      // 설정 관리
      settings: this.showSettings,
      "settings:language": this.changeLanguage,
      "settings:voice": this.changeVoice,
      "settings:mode": this.changeMode,

      // 언어 선택
      language: this.showLanguageMenu,
      "language:set": this.setLanguage,

      // 음성 관리
      stop: this.stopCurrentTTS,
      clear: this.clearTTSFiles,
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

    try {
      // 명령어 처리
      const command = this.extractCommand(text);

      if (command === "tts" || text.trim() === "음성변환") {
        await this.sendTTSMenu(bot, chatId);
        return true;
      }

      // 사용자 상태별 처리
      const userState = this.getUserState(userId);

      if (userState && userState.state === "converting_text") {
        return await this.handleTextConversionMessage(bot, msg);
      }

      // TTS 변환 요청 처리 (예: "TTS: 안녕하세요")
      if (text.startsWith("TTS:") || text.startsWith("음성:")) {
        return await this.handleQuickTTSConversion(bot, msg, text);
      }

      return false;
    } catch (error) {
      logger.error("❌ TTSModule 메시지 처리 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 메시지 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // ===== 📋 메뉴 액션들 =====

  /**
   * 📱 메인 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const userName = getUserName(from);
      const userSettings = this.getUserSettings(from.id);

      const menuText = `🎤 **음성 변환 (TTS)**

안녕하세요, ${userName}님!

📊 **현재 설정**
• 언어: ${this.supportedLanguages[userSettings.language].flag} ${
        this.supportedLanguages[userSettings.language].name
      }
• 음성: ${userSettings.voice}
• 모드: ${userSettings.mode}

원하는 기능을 선택해주세요.`;

      // ✅ 순수하게 텍스트만 반환 (NavigationHandler가 키보드 생성)
      await this.editMessage(bot, chatId, messageId, menuText);

      return true;
    } catch (error) {
      logger.error("❌ TTS 메뉴 표시 실패:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 불러올 수 없습니다.");
      return false;
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **TTS 도움말**

**🎯 주요 기능**
• 텍스트를 자연스러운 음성으로 변환
• 다양한 언어 및 음성 지원
• 고품질 Google Cloud TTS 사용

**⌨️ 사용법**
• \`/tts\` - TTS 메뉴 열기
• \`TTS: 텍스트\` - 빠른 음성 변환
• 버튼 클릭으로 쉬운 조작

**🌍 지원 언어**
${Object.entries(this.supportedLanguages)
  .map(([code, lang]) => `• ${lang.flag} ${lang.name}`)
  .join("\n")}

**💡 팁**
• 문장부호를 활용하면 더 자연스러운 음성을 얻을 수 있습니다
• 너무 긴 텍스트는 여러 번에 나누어 변환하세요
• 설정에서 선호하는 언어와 음성을 지정할 수 있습니다

**🔧 설정**
• 최대 텍스트 길이: ${this.config.maxTextLength}자
• 기본 언어: ${this.supportedLanguages[this.config.defaultLanguage].name}`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 TTS 메뉴", callback_data: "tts:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });

    return true;
  }

  /**
   * 🎵 텍스트 변환 시작
   */
  async startTextConversion(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      if (!this.config.enableTTS) {
        await this.sendError(
          bot,
          callbackQuery,
          "TTS 기능이 비활성화되어 있습니다."
        );
        return false;
      }

      // 사용자 상태 설정
      this.setUserState(from.id, "converting_text");

      const userSettings = this.getUserSettings(from.id);

      const convertText = `🎵 **텍스트 음성 변환**

변환할 텍스트를 입력해주세요.

**📋 현재 설정**
• 언어: ${this.supportedLanguages[userSettings.language].flag} ${
        this.supportedLanguages[userSettings.language].name
      }
• 음성: ${userSettings.voice}

**💡 참고사항**
• 최대 ${this.config.maxTextLength}자까지 입력 가능
• 문장부호를 사용하면 더 자연스러운 음성
• 변환에는 몇 초 정도 소요됩니다

❌ 취소하려면 /cancel 을 입력하세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌍 언어 변경", callback_data: "tts:language" },
            { text: "❌ 취소", callback_data: "tts:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, convertText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ TTS 변환 시작 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "텍스트 변환을 시작할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 🌍 언어 메뉴 표시
   */
  async showLanguageMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userSettings = this.getUserSettings(from.id);

    let languageText = `🌍 **언어 선택**

현재 언어: ${this.supportedLanguages[userSettings.language].flag} ${
      this.supportedLanguages[userSettings.language].name
    }

원하는 언어를 선택해주세요:\n\n`;

    const keyboard = { inline_keyboard: [] };

    // 언어 버튼들을 2개씩 배치
    const languageEntries = Object.entries(this.supportedLanguages);
    for (let i = 0; i < languageEntries.length; i += 2) {
      const row = [];

      for (let j = 0; j < 2 && i + j < languageEntries.length; j++) {
        const [code, lang] = languageEntries[i + j];
        const isSelected = code === userSettings.language;
        const buttonText = `${lang.flag} ${lang.name}${
          isSelected ? " ✅" : ""
        }`;

        row.push({
          text: buttonText,
          callback_data: `tts:language:set:${code}`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    keyboard.inline_keyboard.push([
      { text: "🔙 TTS 메뉴", callback_data: "tts:menu" },
    ]);

    await this.editMessage(bot, chatId, messageId, languageText, {
      reply_markup: keyboard,
    });

    return true;
  }

  /**
   * 🔧 언어 설정
   */
  async setLanguage(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const language = params[0];

      if (!this.supportedLanguages[language]) {
        await this.sendError(bot, callbackQuery, "지원하지 않는 언어입니다.");
        return false;
      }

      // 사용자 설정 업데이트
      const userSettings = this.getUserSettings(from.id);
      userSettings.language = language;
      userSettings.voice = this.supportedLanguages[language].voice;
      this.userSettings.set(from.id.toString(), userSettings);

      // TTS 서비스에도 설정 적용
      if (this.ttsService) {
        await this.ttsService.setUserLanguage(from.id, language);
      }

      const langConfig = this.supportedLanguages[language];

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ 언어가 ${langConfig.flag} ${langConfig.name}로 변경되었습니다`,
        show_alert: false,
      });

      // 언어 메뉴 새로고침
      return await this.showLanguageMenu(
        bot,
        callbackQuery,
        params,
        moduleManager
      );
    } catch (error) {
      logger.error("❌ 언어 설정 실패:", error);
      await this.sendError(bot, callbackQuery, "언어 설정에 실패했습니다.");
      return false;
    }
  }

  // ===== 📬 메시지 핸들러들 =====

  /**
   * TTS 변환 메시지 처리
   */
  async handleTextConversionMessage(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
        from,
      } = msg;

      if (text === "/cancel") {
        this.clearUserState(from.id);
        await this.sendMessage(bot, chatId, "✅ TTS 변환이 취소되었습니다.");
        return true;
      }

      // 텍스트 길이 검증
      if (text.length > this.config.maxTextLength) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 텍스트가 너무 깁니다. (최대 ${this.config.maxTextLength}자)\n` +
            `현재 길이: ${text.length}자`
        );
        return true;
      }

      const userSettings = this.getUserSettings(from.id);

      // 변환 진행 메시지
      const processingMsg = await this.sendMessage(
        bot,
        chatId,
        `🎵 **음성 변환 중...**\n\n` +
          `📝 텍스트: ${text.substring(0, 50)}${
            text.length > 50 ? "..." : ""
          }\n` +
          `🌍 언어: ${this.supportedLanguages[userSettings.language].flag} ${
            this.supportedLanguages[userSettings.language].name
          }\n` +
          `🎙️ 음성: ${userSettings.voice}`
      );

      // ServiceBuilder를 통해 요청한 서비스로 TTS 변환
      const result = await this.ttsService.convertTextToSpeech(
        text,
        userSettings.language,
        from.id
      );

      if (result.success) {
        // 성공 시 음성 파일 전송
        try {
          await bot.sendVoice(
            chatId,
            {
              source: result.filePath,
            },
            {
              caption:
                `🎵 **음성 변환 완료**\n\n` +
                `📝 "${text.substring(0, 100)}${
                  text.length > 100 ? "..." : ""
                }"\n` +
                `🌍 ${this.supportedLanguages[result.language].flag} ${
                  this.supportedLanguages[result.language].name
                }\n` +
                `📊 크기: ${(result.size / 1024).toFixed(1)}KB`,
              parse_mode: "Markdown",
            }
          );

          // 처리 메시지 삭제
          await bot.deleteMessage(chatId, processingMsg.message_id);
        } catch (sendError) {
          logger.error("❌ 음성 파일 전송 실패:", sendError);
          await this.editMessage(
            bot,
            chatId,
            processingMsg.message_id,
            "❌ 음성 파일 전송에 실패했습니다."
          );
        }
      } else {
        // 실패 시 에러 메시지
        await this.editMessage(
          bot,
          chatId,
          processingMsg.message_id,
          `❌ **음성 변환 실패**\n\n${result.message}`
        );
      }

      this.clearUserState(from.id);
      return true;
    } catch (error) {
      logger.error("❌ TTS 변환 메시지 처리 실패:", error);
      await this.sendMessage(
        bot,
        msg.chat.id,
        "❌ 음성 변환 중 오류가 발생했습니다."
      );
      this.clearUserState(msg.from.id);
      return false;
    }
  }

  /**
   * 빠른 TTS 변환 처리
   */
  async handleQuickTTSConversion(bot, msg, text) {
    try {
      const {
        chat: { id: chatId },
        from,
      } = msg;

      if (!this.config.enableTTS) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ TTS 기능이 비활성화되어 있습니다."
        );
        return true;
      }

      // 'TTS:' 또는 '음성:' 부분 제거
      const ttsText = text.replace(/^(TTS:|음성:)\s*/i, "").trim();

      if (!ttsText) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 변환할 텍스트를 입력해주세요.\n예: `TTS: 안녕하세요`"
        );
        return true;
      }

      if (ttsText.length > this.config.maxTextLength) {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 텍스트가 너무 깁니다. (최대 ${this.config.maxTextLength}자)`
        );
        return true;
      }

      const userSettings = this.getUserSettings(from.id);

      // ServiceBuilder를 통해 요청한 서비스로 TTS 변환
      const result = await this.ttsService.convertTextToSpeech(
        ttsText,
        userSettings.language,
        from.id
      );

      if (result.success) {
        await bot.sendVoice(
          chatId,
          {
            source: result.filePath,
          },
          {
            caption:
              `🎵 **빠른 음성 변환**\n\n` +
              `📝 "${ttsText}"\n` +
              `🌍 ${this.supportedLanguages[result.language].flag} ${
                this.supportedLanguages[result.language].name
              }`,
            parse_mode: "Markdown",
          }
        );
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.message}`);
      }

      return true;
    } catch (error) {
      logger.error("❌ 빠른 TTS 변환 실패:", error);
      await this.sendMessage(
        bot,
        msg.chat.id,
        "❌ 음성 변환 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 사용자 설정 조회
   */
  getUserSettings(userId) {
    const defaultSettings = {
      language: this.config.defaultLanguage,
      voice: this.supportedLanguages[this.config.defaultLanguage].voice,
      mode: "MANUAL",
    };

    return this.userSettings.get(userId.toString()) || defaultSettings;
  }

  /**
   * TTS 메뉴 전송 (명령어용)
   */
  async sendTTSMenu(bot, chatId) {
    try {
      const menuText = `🎤 **음성 변환 (TTS)**

텍스트를 자연스러운 음성으로 변환해보세요!

**💡 빠른 사용법:**
• \`TTS: 변환할 텍스트\` - 빠른 음성 변환
• \`음성: 변환할 텍스트\` - 빠른 음성 변환

버튼을 클릭해서 더 많은 기능을 사용하세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🎵 텍스트 변환", callback_data: "tts:convert" },
            { text: "🌍 언어 선택", callback_data: "tts:language" },
          ],
          [{ text: "❓ 도움말", callback_data: "tts:help" }],
        ],
      };

      await this.sendMessage(bot, chatId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ TTS 메뉴 전송 실패:", error);
      await this.sendMessage(bot, chatId, "❌ 메뉴를 불러올 수 없습니다.");
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      ttsService: {
        connected: !!this.ttsService,
        status: this.ttsService?.getServiceStatus?.() || "unknown",
      },
      userSettings: {
        totalUsers: this.userSettings.size,
      },
      supportedLanguages: Object.keys(this.supportedLanguages).length,
      config: this.config,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      // 상위 클래스 정리
      await super.cleanup();

      // 사용자 설정 정리
      this.userSettings.clear();

      // 서비스 참조 정리 (ServiceBuilder가 관리)
      this.ttsService = null;

      logger.info("✅ TTSModule 정리 완료");
    } catch (error) {
      logger.error("❌ TTSModule 정리 실패:", error);
    }
  }
}

module.exports = TTSModule;
