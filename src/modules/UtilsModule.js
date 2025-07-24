// src/modules/UtilsModule.js - 완전 리팩토링된 유틸리티 모듈
const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 유틸리티 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - TTSService를 통한 음성 변환
 * - 다양한 편의 기능 제공
 * - 표준 매개변수 체계 완벽 준수
 */
class UtilsModule extends BaseModule {
  constructor(bot, options = {}) {
    super("UtilsModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // TTSService 초기화 (안전하게)
    this.ttsService = null;
    this.initializeTTSService();

    // Railway 환경변수 기반 설정
    this.config = {
      enableTTS: process.env.ENABLE_TTS_FEATURE === "true",
      ttsMaxRetries: parseInt(process.env.TTS_MAX_RETRIES) || 3,
      ttsTimeout: parseInt(process.env.TTS_TIMEOUT) || 30000,
      ttsTempDir: process.env.TTS_TEMP_DIR || "/tmp/tts",
    };

    // TTS 관련 상태 관리
    this.activeTTSRequests = new Map();
    this.userSettings = new Map(); // 사용자별 TTS 설정
    this.diagnosticsCache = null;
    this.lastDiagnostics = null;

    // 지원 언어 목록
    this.supportedLanguages = {
      ko: { name: "한국어", flag: "🇰🇷", code: "ko" },
      en: { name: "English", flag: "🇺🇸", code: "en" },
      ja: { name: "日本語", flag: "🇯🇵", code: "ja" },
      zh: { name: "中文", flag: "🇨🇳", code: "zh" },
      es: { name: "Español", flag: "🇪🇸", code: "es" },
      fr: { name: "Français", flag: "🇫🇷", code: "fr" },
    };

    logger.info("🛠️ UtilsModule 생성됨");
  }

  /**
   * TTSService 안전한 초기화
   */
  initializeTTSService() {
    try {
      const TTSService = require("../services/TTSService");
      this.ttsService = new TTSService();
      logger.info("✅ TTSService 초기화 성공");
    } catch (error) {
      logger.warn("⚠️ TTSService 초기화 실패:", error.message);
      this.ttsService = null;
    }
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // TTS 서비스 진단 실행 (안전하게)
      if (this.ttsService && this.config.enableTTS) {
        try {
          this.diagnosticsCache = await this.ttsService.runDiagnostics();
          this.lastDiagnostics = new Date();
          logger.info("✅ TTS 진단 완료");
        } catch (diagError) {
          logger.warn("⚠️ TTS 진단 실패:", diagError.message);
        }
      }

      logger.info("🛠️ UtilsModule 초기화 완료");
    } catch (error) {
      logger.error("❌ UtilsModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      help: this.showHelp,

      // TTS 관련 액션들
      "tts:menu": this.showTTSMenu,
      "tts:help": this.showTTSHelp,
      "tts:diagnostics": this.showTTSDiagnostics,
      "tts:test": this.testTTS,
      "tts:stop": this.stopTTS,

      // TTS 모드 설정
      "tts:mode:auto": this.setAutoMode,
      "tts:mode:manual": this.setManualMode,
      "tts:mode:off": this.setOffMode,

      // 언어 설정
      "lang:ko": this.setLanguageKorean,
      "lang:en": this.setLanguageEnglish,
      "lang:ja": this.setLanguageJapanese,
      "lang:zh": this.setLanguageChinese,
      "lang:es": this.setLanguageSpanish,
      "lang:fr": this.setLanguageFrench,

      // 기타 유틸리티
      settings: this.showSettings,
      reset: this.resetSettings,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // TTS 명령어 처리
    if (text.startsWith("/tts")) {
      await this.handleTTSCommand(bot, chatId, userId, text);
      return true;
    }

    // 유틸리티 명령어 처리
    const command = this.extractCommand(text);
    if (
      command === "utils" ||
      text.trim() === "유틸" ||
      text.trim() === "유틸리티"
    ) {
      await this.sendUtilsMenu(bot, chatId);
      return true;
    }

    // 자동 TTS 처리 (설정된 사용자만)
    if (this.shouldProcessAutoTTS(userId, text)) {
      await this.handleAutoTTS(bot, msg);
      return false; // 다른 모듈도 처리할 수 있도록 false 반환
    }

    return false;
  }

  // ===== 🛠️ 유틸리티 메뉴 액션들 (표준 매개변수 준수) =====

  /**
   * 유틸리티 메뉴 표시
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
    const userId = from.id;

    try {
      // 사용자 TTS 설정 조회
      const userSettings = this.getUserSettings(userId);
      const ttsStatus = this.ttsService ? "활성화" : "비활성화";
      const currentMode = userSettings.mode || "OFF";
      const currentLang =
        this.supportedLanguages[userSettings.language || "ko"];

      const menuText = `🛠️ **${userName}님의 유틸리티**

📅 ${TimeHelper.formatDateTime()}

🔊 **TTS (음성 변환)**
• 상태: ${ttsStatus}
• 모드: ${this.getModeDisplayName(currentMode)}
• 언어: ${currentLang.flag} ${currentLang.name}

🎯 **사용 가능한 기능:**
• 텍스트를 음성으로 변환
• ${Object.keys(this.supportedLanguages).length}개국어 지원
• 자동/수동/끄기 모드
• 진단 및 설정 관리

어떤 기능을 사용하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔊 TTS 메뉴", callback_data: "utils:tts:menu" },
            { text: "🔧 TTS 설정", callback_data: "utils:settings" },
          ],
          [
            { text: "🧪 TTS 테스트", callback_data: "utils:tts:test" },
            { text: "📊 진단 정보", callback_data: "utils:tts:diagnostics" },
          ],
          [
            { text: "❓ 도움말", callback_data: "utils:help" },
            { text: "🔄 설정 초기화", callback_data: "utils:reset" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("유틸리티 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * TTS 메뉴 표시
   */
  async showTTSMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      if (!this.ttsService) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ **TTS 서비스 비활성화**\n\nTTS 서비스가 활성화되지 않았습니다.\n관리자에게 문의해주세요.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 유틸리티 메뉴", callback_data: "utils:menu" }],
              ],
            },
          }
        );
        return;
      }

      const userSettings = this.getUserSettings(userId);
      const currentMode = userSettings.mode || "OFF";
      const currentLang =
        this.supportedLanguages[userSettings.language || "ko"];
      const activeRequests = this.activeTTSRequests.size;

      const ttsMenuText = `🔊 **TTS (Text-To-Speech) 메뉴**

**현재 설정:**
• 모드: ${this.getModeDisplayName(currentMode)}
• 언어: ${currentLang.flag} ${currentLang.name}
• 활성 요청: ${activeRequests}개

**모드 설명:**
• 🤖 **자동**: 모든 메시지를 음성으로 변환
• 🗣️ **수동**: /tts 명령어로만 변환
• 🛑 **끄기**: TTS 기능 비활성화

어떤 설정을 변경하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🤖 자동 모드", callback_data: "utils:tts:mode:auto" },
            { text: "🗣️ 수동 모드", callback_data: "utils:tts:mode:manual" },
          ],
          [
            { text: "🛑 끄기", callback_data: "utils:tts:mode:off" },
            { text: "🌐 언어 설정", callback_data: "utils:settings" },
          ],
          [
            { text: "🧪 테스트", callback_data: "utils:tts:test" },
            { text: "❓ 도움말", callback_data: "utils:tts:help" },
          ],
          [{ text: "🔙 유틸리티", callback_data: "utils:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, ttsMenuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("TTS 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * TTS 테스트
   */
  async testTTS(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      if (!this.ttsService) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ TTS 서비스가 비활성화되어 있습니다.",
          show_alert: true,
        });
        return;
      }

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔊 TTS 테스트 음성을 생성 중입니다...",
        show_alert: false,
      });

      const userSettings = this.getUserSettings(userId);
      const language = userSettings.language || "ko";
      const testText = this.getTestText(language);

      // TTS 변환 수행
      const result = await this.ttsService.convertTextToSpeech(
        testText,
        language,
        userId
      );

      if (result.success) {
        const {
          message: {
            chat: { id: chatId },
          },
        } = callbackQuery;

        await bot.sendVoice(chatId, result.filePath, {
          caption: `🔊 **TTS 테스트 완료**\n\n• 언어: ${
            this.supportedLanguages[language].flag
          } ${
            this.supportedLanguages[language].name
          }\n• 텍스트: "${testText}"\n• 파일 크기: ${Math.round(
            result.size / 1024
          )}KB`,
        });

        // 임시 파일 정리 (5초 후)
        setTimeout(() => {
          if (this.ttsService) {
            this.ttsService.cleanupFile(result.filePath);
          }
        }, 5000);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ TTS 테스트 실패: ${result.message}`,
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("TTS 테스트 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ TTS 테스트 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * TTS 진단 정보 표시
   */
  async showTTSDiagnostics(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      if (!this.ttsService) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ **TTS 진단 불가**\n\nTTS 서비스가 비활성화되어 있습니다.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 유틸리티 메뉴", callback_data: "utils:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 실시간 진단 실행
      let diagnostics = this.diagnosticsCache;
      try {
        diagnostics = await this.ttsService.runDiagnostics();
        this.diagnosticsCache = diagnostics;
        this.lastDiagnostics = new Date();
      } catch (error) {
        logger.warn("실시간 진단 실패, 캐시된 데이터 사용:", error.message);
      }

      const diagnosticsText = `🔧 **TTS 진단 정보**

**환경 정보:**
• 환경: ${diagnostics?.environment || "unknown"}
• Railway: ${diagnostics?.railway ? "✅" : "❌"}
• Node.js: ${process.version}

**서비스 상태:**
• TTS 서비스: ${this.ttsService ? "✅ 활성화" : "❌ 비활성화"}
• 네트워크 접근: ${diagnostics?.networkAccess ? "✅" : "❌"}
• 임시 디렉토리: ${diagnostics?.tempDirExists ? "✅" : "❌"}
• 쓰기 권한: ${diagnostics?.tempDirWritable ? "✅" : "❌"}

**통계 정보:**
• 활성 요청: ${this.activeTTSRequests.size}개
• 등록된 사용자: ${this.userSettings.size}명
• 지원 언어: ${Object.keys(this.supportedLanguages).length}개

**설정 정보:**
• 최대 재시도: ${this.config.ttsMaxRetries}회
• 타임아웃: ${this.config.ttsTimeout / 1000}초
• 임시 디렉토리: ${this.config.ttsTempDir}

🕐 **마지막 진단**: ${
        this.lastDiagnostics
          ? TimeHelper.formatDateTime(this.lastDiagnostics)
          : "없음"
      }`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 진단 새로고침",
              callback_data: "utils:tts:diagnostics",
            },
            { text: "🧪 TTS 테스트", callback_data: "utils:tts:test" },
          ],
          [{ text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, diagnosticsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("TTS 진단 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `🛠️ **유틸리티 도움말**

📅 ${TimeHelper.formatDateTime()}

🔊 **TTS (음성 변환) 기능**
• 텍스트를 자연스러운 음성으로 변환
• ${Object.keys(this.supportedLanguages).length}개국어 지원
• 3가지 동작 모드 제공

**지원 언어:**
${Object.entries(this.supportedLanguages)
  .map(([code, lang]) => `• ${lang.flag} ${lang.name}`)
  .join("\n")}

**사용 모드:**
• 🤖 **자동 모드**: 모든 메시지를 자동으로 음성 변환
• 🗣️ **수동 모드**: /tts 명령어로만 변환
• 🛑 **끄기**: TTS 기능 완전 비활성화

**명령어:**
• \`/utils\` 또는 "유틸리티" - 유틸리티 메뉴
• \`/tts 텍스트\` - 해당 텍스트를 음성으로 변환

**사용 예시:**
• \`/tts 안녕하세요!\` - 한국어 음성 생성
• \`/tts Hello world!\` - 영어 음성 생성

**제한사항:**
• 최대 500자까지 변환 가능
• Railway 환경에서 최적화됨
• 임시 파일은 자동으로 정리됨

🎯 **팁:** 자동 모드 사용 시 모든 메시지가 음성으로 변환되므로 주의하세요!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 TTS 메뉴", callback_data: "utils:tts:menu" },
          { text: "🧪 TTS 테스트", callback_data: "utils:tts:test" },
        ],
        [
          { text: "🔙 유틸리티 메뉴", callback_data: "utils:menu" },
          { text: "🏠 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎮 TTS 모드 설정 액션들 =====

  /**
   * 자동 모드 설정
   */
  async setAutoMode(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      this.setUserSettings(userId, { mode: "AUTO" });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🤖 자동 TTS 모드가 활성화되었습니다!",
        show_alert: false,
      });

      // TTS 메뉴로 돌아가기
      await this.showTTSMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("자동 모드 설정 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 설정 변경 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 수동 모드 설정
   */
  async setManualMode(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      this.setUserSettings(userId, { mode: "MANUAL" });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🗣️ 수동 TTS 모드가 활성화되었습니다!",
        show_alert: false,
      });

      // TTS 메뉴로 돌아가기
      await this.showTTSMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("수동 모드 설정 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 설정 변경 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 끄기 모드 설정
   */
  async setOffMode(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      this.setUserSettings(userId, { mode: "OFF" });

      // 활성 요청 중지
      this.activeTTSRequests.delete(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🛑 TTS가 비활성화되었습니다.",
        show_alert: false,
      });

      // TTS 메뉴로 돌아가기
      await this.showTTSMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("끄기 모드 설정 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 설정 변경 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  // ===== 🌐 언어 설정 액션들 =====

  /**
   * 한국어 설정
   */
  async setLanguageKorean(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "ko", moduleManager);
  }

  /**
   * 영어 설정
   */
  async setLanguageEnglish(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "en", moduleManager);
  }

  /**
   * 일본어 설정
   */
  async setLanguageJapanese(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "ja", moduleManager);
  }

  /**
   * 중국어 설정
   */
  async setLanguageChinese(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "zh", moduleManager);
  }

  /**
   * 스페인어 설정
   */
  async setLanguageSpanish(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "es", moduleManager);
  }

  /**
   * 프랑스어 설정
   */
  async setLanguageFrench(bot, callbackQuery, params, moduleManager) {
    await this.setLanguage(bot, callbackQuery, "fr", moduleManager);
  }

  /**
   * 언어 설정 공통 로직
   */
  async setLanguage(bot, callbackQuery, languageCode, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      if (!this.supportedLanguages[languageCode]) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ 지원하지 않는 언어입니다.",
          show_alert: true,
        });
        return;
      }

      this.setUserSettings(userId, { language: languageCode });
      const language = this.supportedLanguages[languageCode];

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `🌐 언어가 ${language.flag} ${language.name}로 설정되었습니다!`,
        show_alert: false,
      });

      // 설정 메뉴로 돌아가기
      await this.showSettings(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("언어 설정 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 언어 설정 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  // ===== ⚙️ 설정 관리 액션들 =====

  /**
   * 설정 메뉴 표시
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const userSettings = this.getUserSettings(userId);
      const currentMode = userSettings.mode || "OFF";
      const currentLang =
        this.supportedLanguages[userSettings.language || "ko"];

      const settingsText = `⚙️ **TTS 설정**

**현재 설정:**
• 모드: ${this.getModeDisplayName(currentMode)}
• 언어: ${currentLang.flag} ${currentLang.name}

**모드 변경:**
자동/수동/끄기 모드를 선택할 수 있습니다.

**언어 변경:**
아래에서 원하는 언어를 선택하세요.`;

      const keyboard = {
        inline_keyboard: [
          // 모드 설정
          [
            { text: "🤖 자동", callback_data: "utils:tts:mode:auto" },
            { text: "🗣️ 수동", callback_data: "utils:tts:mode:manual" },
            { text: "🛑 끄기", callback_data: "utils:tts:mode:off" },
          ],
          // 언어 설정 1행
          [
            { text: "🇰🇷 한국어", callback_data: "utils:lang:ko" },
            { text: "🇺🇸 English", callback_data: "utils:lang:en" },
            { text: "🇯🇵 日本語", callback_data: "utils:lang:ja" },
          ],
          // 언어 설정 2행
          [
            { text: "🇨🇳 中文", callback_data: "utils:lang:zh" },
            { text: "🇪🇸 Español", callback_data: "utils:lang:es" },
            { text: "🇫🇷 Français", callback_data: "utils:lang:fr" },
          ],
          // 기타 옵션
          [
            { text: "🔄 설정 초기화", callback_data: "utils:reset" },
            { text: "🔙 유틸리티", callback_data: "utils:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, settingsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("설정 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 설정 초기화
   */
  async resetSettings(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      // 사용자 설정 초기화
      this.userSettings.delete(userId);

      // 활성 요청 정리
      this.activeTTSRequests.delete(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🔄 모든 설정이 초기화되었습니다!",
        show_alert: false,
      });

      // 유틸리티 메뉴로 돌아가기
      await this.showMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("설정 초기화 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 설정 초기화 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * TTS 정지
   */
  async stopTTS(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      if (!this.activeTTSRequests.has(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "⚠️ 진행 중인 TTS 작업이 없습니다.",
          show_alert: true,
        });
        return;
      }

      // TTS 서비스에서 정지 처리
      if (this.ttsService) {
        await this.ttsService.stopTTS(userId);
      }

      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "🛑 TTS 작업이 정지되었습니다.",
        show_alert: false,
      });

      // TTS 메뉴로 돌아가기
      await this.showTTSMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("TTS 정지 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ TTS 정지 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  // ===== 🎯 TTS 처리 메서드들 =====

  /**
   * TTS 명령어 처리
   */
  async handleTTSCommand(bot, chatId, userId, text) {
    try {
      const ttsText = text.replace("/tts", "").trim();

      if (!ttsText) {
        await this.showTTSUsageHelp(bot, chatId);
        return;
      }

      if (!this.ttsService) {
        await bot.sendMessage(
          chatId,
          "❌ TTS 서비스가 비활성화되어 있습니다.\n관리자에게 문의해주세요."
        );
        return;
      }

      // 처리 중 메시지
      const processingMsg = await bot.sendMessage(
        chatId,
        "🔊 TTS 음성을 생성 중입니다..."
      );

      // 사용자 설정 조회
      const userSettings = this.getUserSettings(userId);
      const language = userSettings.language || "ko";

      // 활성 요청 등록
      this.activeTTSRequests.set(userId, {
        text: ttsText,
        language,
        startTime: new Date(),
      });

      // TTS 변환 수행
      const result = await this.ttsService.convertTextToSpeech(
        ttsText,
        language,
        userId
      );

      if (result.success) {
        // 처리 중 메시지 삭제
        await bot.deleteMessage(chatId, processingMsg.message_id);

        // 음성 파일 전송
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🔊 **TTS 변환 완료**\n\n• 언어: ${
            this.supportedLanguages[language].flag
          } ${
            this.supportedLanguages[language].name
          }\n• 텍스트: "${ttsText.substring(0, 100)}${
            ttsText.length > 100 ? "..." : ""
          }"\n• 파일 크기: ${Math.round(result.size / 1024)}KB\n• 재시도: ${
            result.retries
          }회`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔊 TTS 메뉴", callback_data: "utils:tts:menu" },
                { text: "⚙️ 설정", callback_data: "utils:settings" },
              ],
            ],
          },
        });

        // 임시 파일 정리 (10초 후)
        setTimeout(() => {
          if (this.ttsService) {
            this.ttsService.cleanupFile(result.filePath);
          }
        }, 10000);
      } else {
        // 처리 중 메시지 수정
        await bot.editMessageText(
          `❌ **TTS 변환 실패**\n\n${result.message}\n\n다시 시도하거나 설정을 확인해주세요.`,
          {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔄 다시 시도", callback_data: "utils:tts:test" },
                  { text: "🔧 진단", callback_data: "utils:tts:diagnostics" },
                ],
                [{ text: "🔙 유틸리티", callback_data: "utils:menu" }],
              ],
            },
          }
        );
      }

      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);
    } catch (error) {
      logger.error("TTS 명령어 처리 오류:", error);
      await bot.sendMessage(
        chatId,
        "❌ TTS 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요."
      );

      // 활성 요청 정리
      this.activeTTSRequests.delete(userId);
    }
  }

  /**
   * 자동 TTS 처리
   */
  async handleAutoTTS(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    try {
      if (!this.ttsService) {
        return false;
      }

      const userSettings = this.getUserSettings(userId);
      const language = userSettings.language || "ko";

      // TTS 변환 수행
      const result = await this.ttsService.convertTextToSpeech(
        text,
        language,
        userId
      );

      if (result.success) {
        // 음성 파일 전송 (자동 모드에서는 간단한 캡션)
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🤖 자동 TTS: "${text.substring(0, 50)}${
            text.length > 50 ? "..." : ""
          }"`,
        });

        // 임시 파일 정리 (5초 후)
        setTimeout(() => {
          if (this.ttsService) {
            this.ttsService.cleanupFile(result.filePath);
          }
        }, 5000);

        return true;
      } else {
        // 자동 모드에서는 에러를 사용자에게 표시하지 않음 (로그만)
        logger.warn("자동 TTS 실패 (사용자에게 숨김):", {
          userId,
          error: result.message,
        });
        return false;
      }
    } catch (error) {
      logger.error("자동 TTS 처리 오류:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 유틸리티 메뉴 전송 (명령어용)
   */
  async sendUtilsMenu(bot, chatId) {
    try {
      const text = `🛠️ **유틸리티**

다양한 편의 기능을 사용해보세요!

🔊 **TTS (음성 변환)**
• 텍스트를 자연스러운 음성으로 변환
• ${Object.keys(this.supportedLanguages).length}개국어 지원
• 자동/수동 모드 선택 가능

어떤 기능을 사용하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔊 TTS 메뉴", callback_data: "utils:tts:menu" },
            { text: "⚙️ 설정", callback_data: "utils:settings" },
          ],
          [
            { text: "🧪 TTS 테스트", callback_data: "utils:tts:test" },
            { text: "❓ 도움말", callback_data: "utils:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("유틸리티 메뉴 전송 오류:", error);
      await this.sendError(bot, chatId, "메뉴 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * TTS 사용법 도움말
   */
  async showTTSUsageHelp(bot, chatId) {
    const helpText = `🔊 **TTS 사용법**

텍스트를 음성으로 변환합니다.

**기본 사용법:**
\`/tts 변환할 텍스트\`

**예시:**
• \`/tts 안녕하세요!\` - 한국어 음성
• \`/tts Hello world!\` - 영어 음성  
• \`/tts こんにちは\` - 일본어 음성

**제한사항:**
• 최대 500자까지 변환 가능
• 명령어(/), URL 등은 자동 변환 제외

**설정:**
/utils 메뉴에서 언어와 모드를 변경할 수 있습니다.`;

    await this.sendMessage(bot, chatId, helpText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛠️ 유틸리티 메뉴", callback_data: "utils:menu" }],
        ],
      },
    });
  }

  /**
   * 사용자 설정 조회
   */
  getUserSettings(userId) {
    return (
      this.userSettings.get(userId) || {
        mode: "OFF",
        language: "ko",
      }
    );
  }

  /**
   * 사용자 설정 저장
   */
  setUserSettings(userId, settings) {
    const currentSettings = this.getUserSettings(userId);
    const newSettings = { ...currentSettings, ...settings };
    this.userSettings.set(userId, newSettings);

    logger.debug(`사용자 설정 업데이트: ${userId}`, newSettings);
  }

  /**
   * 모드 표시명 반환
   */
  getModeDisplayName(mode) {
    const modeNames = {
      AUTO: "🤖 자동 모드",
      MANUAL: "🗣️ 수동 모드",
      OFF: "🛑 끄기",
    };

    return modeNames[mode] || "❓ 알 수 없음";
  }

  /**
   * 자동 TTS 처리 여부 판단
   */
  shouldProcessAutoTTS(userId, text) {
    if (!this.ttsService) return false;

    const userSettings = this.getUserSettings(userId);
    if (userSettings.mode !== "AUTO") return false;

    // 명령어는 제외
    if (text.startsWith("/")) return false;

    // 너무 긴 텍스트는 제외
    if (text.length > 200) return false;

    // URL 포함 텍스트는 제외
    if (text.includes("http://") || text.includes("https://")) return false;

    return true;
  }

  /**
   * 언어별 테스트 텍스트 반환
   */
  getTestText(language) {
    const testTexts = {
      ko: "안녕하세요! TTS 테스트입니다.",
      en: "Hello! This is a TTS test.",
      ja: "こんにちは！TTSテストです。",
      zh: "你好！这是TTS测试。",
      es: "¡Hola! Esta es una prueba de TTS.",
      fr: "Bonjour! Ceci est un test TTS.",
    };

    return testTexts[language] || testTexts.ko;
  }

  /**
   * 에러 처리
   */
  async handleError(bot, callbackQuery, error) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **오류 발생**\n\n유틸리티 처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "utils:menu" }],
              [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        }
      );
    } catch (editError) {
      logger.error("에러 메시지 표시 실패:", editError);
    }
  }

  /**
   * 모듈 종료 시 정리
   */
  async shutdown() {
    try {
      // 모든 활성 요청 정리
      this.activeTTSRequests.clear();

      // TTS 서비스 정리
      if (this.ttsService) {
        await this.ttsService.cleanupAllFiles();
      }

      logger.info("🛑 UtilsModule 정리 완료");
    } catch (error) {
      logger.error("UtilsModule 정리 오류:", error);
    }
  }
}

module.exports = UtilsModule;
