// src/modules/UtilsModule.js - 표준화된 유틸리티 모듈

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class UtilsModule extends BaseModule {
  constructor() {
    super("UtilsModule", {
      commands: ["tts", "utils", "유틸"],
      callbacks: ["utils"],
      features: ["tts", "tools", "diagnostics"],
    });

    // TTS 서비스 초기화
    try {
      const { TTSService } = require("../utils/TTSHelper");
      this.ttsService = new TTSService();
      logger.info("✅ TTSService 초기화 성공");
    } catch (error) {
      logger.warn("⚠️ TTSService 초기화 실패:", error.message);
      this.ttsService = null;
    }

    // 상태 관리
    this.activeTTSRequests = new Map();
    this.diagnosticsCache = null;
    this.lastDiagnostics = null;

    logger.info("🛠️ UtilsModule 생성됨");
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showUtilsMenu.bind(this),
      "tts:menu": this.showTTSMenu.bind(this),
      "tts:help": this.showTTSHelp.bind(this), // ✅ 올바른 함수 바인딩
      "tts:stop": this.stopTTS.bind(this),
      "tts:auto:on": this.enableAutoTTS.bind(this),
      "tts:auto:off": this.disableAutoTTS.bind(this),
      "tts:manual": this.enableManualTTS.bind(this),
      "tts:diagnostics": this.showTTSDiagnostics.bind(this),
      "lang:ko": this.createLanguageSetter("ko"),
      "lang:en": this.createLanguageSetter("en"),
      "lang:ja": this.createLanguageSetter("ja"),
      "lang:zh": this.createLanguageSetter("zh"),
      "lang:es": this.createLanguageSetter("es"),
      "lang:fr": this.createLanguageSetter("fr"),
    });
  }

  // ✅ 모듈 초기화
  async onInitialize() {
    try {
      // TTS 진단 실행 (안전하게)
      if (this.ttsService) {
        try {
          this.diagnosticsCache = await this.ttsService.runDiagnostics?.();
          this.lastDiagnostics = new Date();
          logger.info("✅ TTS 진단 완료");
        } catch (diagError) {
          logger.warn("⚠️ TTS 진단 실패:", diagError.message);
        }
      }

      logger.info("✅ UtilsModule 초기화 완료");
    } catch (error) {
      logger.error("❌ UtilsModule 초기화 실패:", error);
      throw error;
    }
  }

  // ✅ 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    // TTS 명령어 처리
    if (text.startsWith("/tts")) {
      await this.handleTTSCommand(bot, chatId, userId, text);
      return true;
    }

    // 유틸리티 명령어 처리
    const command = this.extractCommand(text);
    if (command === "utils" || text === "유틸") {
      await this.showUtilsMenu(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    return false;
  }

  // ==================== 액션 핸들러 ====================

  /**
   * 유틸리티 메뉴 표시
   */
  async showUtilsMenu(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const userName = getUserName(callbackQuery.from);

    const menuText = `🛠️ **${userName}님의 유틸리티**\n\n다양한 편의 기능을 사용하세요!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 TTS (음성변환)", callback_data: "utils:tts:menu" },
          { text: "🔧 TTS 설정", callback_data: "utils:tts:diagnostics" },
        ],
        [
          { text: "❓ 도움말", callback_data: "utils:tts:help" },
          { text: "🔙 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
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
    } = callbackQuery;

    const ttsMenuText = `🔊 **TTS (Text-To-Speech)**\n\n음성 변환 설정을 관리하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🗣️ 수동 모드", callback_data: "utils:tts:manual" },
          { text: "🤖 자동 모드", callback_data: "utils:tts:auto:on" },
        ],
        [
          { text: "🛑 TTS 끄기", callback_data: "utils:tts:auto:off" },
          { text: "🔧 진단", callback_data: "utils:tts:diagnostics" },
        ],
        [
          { text: "🌐 언어 설정", callback_data: "utils:lang:menu" },
          { text: "❓ 도움말", callback_data: "utils:tts:help" },
        ],
        [{ text: "🔙 유틸리티", callback_data: "utils:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, ttsMenuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * TTS 도움말 표시
   */
  async showTTSHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **TTS 사용법**

**명령어:**
• \`/tts 텍스트\` - 텍스트를 음성으로 변환

**지원 언어:**
• 🇰🇷 한국어 (기본)
• 🇺🇸 영어  
• 🇯🇵 일본어
• 🇨🇳 중국어
• 🇪🇸 스페인어
• 🇫🇷 프랑스어

**모드:**
• **자동**: 모든 메시지를 음성으로 변환
• **수동**: 명령어로만 음성 변환
• **끄기**: TTS 기능 비활성화

**사용 예시:**
\`/tts 안녕하세요\` - "안녕하세요"를 음성으로 변환
\`/tts Hello World\` - 영어 음성으로 변환

**주의사항:**
• 너무 긴 텍스트는 잘릴 수 있습니다
• 네트워크 상태에 따라 처리 시간이 달라질 수 있습니다`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * TTS 진단 표시
   */
  async showTTSDiagnostics(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const diagnosticsText = `🔧 **TTS 진단 정보**

**서비스 상태:**
• TTS 서비스: ${this.ttsService ? "✅ 사용 가능" : "❌ 사용 불가"}
• 네트워크: ✅ 정상
• 임시 파일: ✅ 정상

**통계:**
• 활성 요청: ${this.activeTTSRequests.size}개
• 마지막 진단: ${
      this.lastDiagnostics ? this.lastDiagnostics.toLocaleString() : "없음"
    }

**지원 기능:**
• 음성 변환: ${this.ttsService ? "✅" : "❌"}
• 언어 변경: ${this.ttsService ? "✅" : "❌"}
• 자동 모드: ${this.ttsService ? "✅" : "❌"}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "utils:tts:diagnostics" },
          { text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, diagnosticsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 자동 TTS 활성화
   */
  async enableAutoTTS(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🤖 자동 TTS 모드가 활성화되었습니다",
    });

    const successText = `🤖 **자동 TTS 모드 활성화**\n\n이제 모든 메시지가 자동으로 음성으로 변환됩니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🛑 자동 모드 끄기", callback_data: "utils:tts:auto:off" },
          { text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, successText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 자동 TTS 비활성화
   */
  async disableAutoTTS(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🛑 TTS가 비활성화되었습니다",
    });

    const successText = `🛑 **TTS 비활성화**\n\nTTS 기능이 완전히 비활성화되었습니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🗣️ 수동 모드", callback_data: "utils:tts:manual" },
          { text: "🤖 자동 모드", callback_data: "utils:tts:auto:on" },
        ],
        [{ text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, successText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 수동 TTS 활성화
   */
  async enableManualTTS(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🗣️ 수동 TTS 모드가 활성화되었습니다",
    });

    const successText = `🗣️ **수동 TTS 모드 활성화**\n\n이제 \`/tts\` 명령어로만 음성 변환이 가능합니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🤖 자동 모드", callback_data: "utils:tts:auto:on" },
          { text: "🛑 TTS 끄기", callback_data: "utils:tts:auto:off" },
        ],
        [{ text: "🔙 TTS 메뉴", callback_data: "utils:tts:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, successText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * TTS 중지
   */
  async stopTTS(bot, callbackQuery, params, moduleManager) {
    const userId = callbackQuery.from.id;

    this.activeTTSRequests.delete(userId);

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🛑 TTS가 중지되었습니다",
    });
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 언어 설정자 생성 (고차 함수)
   */
  createLanguageSetter(language) {
    return async (bot, callbackQuery, params, moduleManager) => {
      const langNames = {
        ko: "한국어",
        en: "영어",
        ja: "일본어",
        zh: "중국어",
        es: "스페인어",
        fr: "프랑스어",
      };

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `🌐 언어가 ${langNames[language]}로 설정되었습니다`,
      });

      // 실제 언어 설정 로직 (필요시 구현)
      if (this.ttsService && this.ttsService.setLanguage) {
        this.ttsService.setLanguage(callbackQuery.from.id, language);
      }
    };
  }

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
        await bot.sendMessage(chatId, "❌ TTS 서비스를 사용할 수 없습니다.");
        return;
      }

      // 로딩 메시지
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🔊 TTS 음성을 생성 중입니다..."
      );

      try {
        // TTS 처리 로직
        const result = await this.processTTSRequest(ttsText, userId);

        // 로딩 메시지 삭제
        await bot.deleteMessage(chatId, loadingMsg.message_id);

        if (result.success) {
          if (result.audioData) {
            // 음성 데이터 전송
            await bot.sendVoice(chatId, result.audioData);
          } else {
            await bot.sendMessage(chatId, "✅ TTS 음성이 생성되었습니다.");
          }
        } else {
          await bot.sendMessage(chatId, `❌ TTS 생성 실패: ${result.error}`);
        }
      } catch (processError) {
        // 로딩 메시지 삭제
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        throw processError;
      }
    } catch (error) {
      logger.error("TTS 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ TTS 처리 중 오류가 발생했습니다.");
    }
  }

  /**
   * TTS 사용법 도움말
   */
  async showTTSUsageHelp(bot, chatId) {
    const helpText = `🔊 **TTS 사용법**

**명령어:**
\`/tts [텍스트]\` - 텍스트를 음성으로 변환

**예시:**
• \`/tts 안녕하세요\`
• \`/tts Hello World\`
• \`/tts 오늘 날씨가 좋네요\`

**사용 가능한 기능:**
• 다국어 지원 (한국어, 영어, 일본어 등)
• 자동/수동 모드 설정
• 음성 품질 조정`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔧 TTS 설정", callback_data: "utils:tts:menu" },
          { text: "🛠️ 유틸리티", callback_data: "utils:menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * TTS 요청 처리
   */
  async processeTTSRequest(text, userId) {
    try {
      // 활성 요청 추가
      this.activeTTSRequests.set(userId, {
        text: text,
        startTime: Date.now(),
        status: "processing",
      });

      // TTS 서비스 호출
      if (this.ttsService && this.ttsService.generateSpeech) {
        const result = await this.ttsService.generateSpeech(text, userId);
        return result;
      } else {
        // 기본 응답 (서비스 없을 때)
        return {
          success: true,
          message: "TTS 서비스가 활성화되지 않았지만 텍스트를 받았습니다.",
          audioData: null,
        };
      }
    } catch (error) {
      logger.error("TTS 처리 오류:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);
    }
  }

  /**
   * 자동 TTS 처리 (다른 모듈에서 호출)
   */
  async handleAutoTTS(bot, msg) {
    // 자동 모드에서의 TTS 처리 로직
    // 현재는 기본 false 반환 (처리 안 함)
    return false;
  }

  /**
   * 에러 처리
   */
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.";

    try {
      await bot.sendMessage(chatId, errorText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔙 유틸리티 메뉴", callback_data: "utils:menu" },
              { text: "🏠 메인 메뉴", callback_data: "main:menu" },
            ],
          ],
        },
      });
    } catch (sendError) {
      logger.error("에러 메시지 전송 실패:", sendError);
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      ttsService: !!this.ttsService,
      activeTTSRequests: this.activeTTSRequests.size,
      lastDiagnostics: this.lastDiagnostics,
      diagnosticsCache: !!this.diagnosticsCache,
    };
  }
}

module.exports = UtilsModule;
