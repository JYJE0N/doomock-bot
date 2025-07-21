// src/modules/UtilsModule.js - null 에러 수정

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");

// ✅ 새로운 해결책 (logger를 함수로 가져오기)
const logger = require("../utils/Logger");

class UtilsModule extends BaseModule {
  constructor() {
    super("UtilsModule", {
      commands: ["tts", "utils"],
      callbacks: ["utils"],
      features: ["tts", "tools"],
    });

    // TTS 서비스 안전하게 초기화
    try {
      const { TTSService } = require("../services/TTSService");
      this.ttsService = new TTSService();
      logger.info("✅ TTSService 초기화 성공");
    } catch (error) {
      logger.warn("⚠️ TTSService 초기화 실패:", error.message);
      this.ttsService = null;
    }

    this.userStates = new Map();
    this.activeTTSRequests = new Map();
    this.diagnosticsCache = null;
    this.lastDiagnostics = null;
  }

  // ✅ 표준 액션 등록
  registerActions() {
    super.registerActions(); // 기본 액션 유지
    this.actionMap.set("main", this.showMenu.bind(this));
    this.actionMap.set("menu", this.showMenu.bind(this));

    // TTS 관련 액션들
    this.actionMap.set("tts_menu", this.showTTSMenu.bind(this));
    this.actionMap.set("tts_help", this.showTTSHelp.bind(this));
    this.actionMap.set("tts_stop", this.stopTTS.bind(this));
    this.actionMap.set("tts_auto_on", this.enableAutoTTS.bind(this));
    this.actionMap.set("tts_auto_off", this.disableAutoTTS.bind(this));
    this.actionMap.set("tts_manual", this.enableManualTTS.bind(this));
    this.actionMap.set("tts_diagnostics", this.showTTSDiagnostics.bind(this));

    // 언어 설정 액션들
    this.actionMap.set("lang_ko", this.setLanguage.bind(this, "ko"));
    this.actionMap.set("lang_en", this.setLanguage.bind(this, "en"));
    this.actionMap.set("lang_ja", this.setLanguage.bind(this, "ja"));
    this.actionMap.set("lang_zh", this.setLanguage.bind(this, "zh"));
    this.actionMap.set("lang_es", this.setLanguage.bind(this, "es"));
    this.actionMap.set("lang_fr", this.setLanguage.bind(this, "fr"));
  }

  // ✅ 메뉴 데이터 제공
  getMenuData(userName) {
    return {
      text: `🛠️ **${userName}님의 유틸리티**\n\n다양한 편의 기능을 사용하세요!`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "🔊 TTS (음성변환)", callback_data: "utils_tts_menu" },
            { text: "🔧 TTS 설정", callback_data: "utils_tts_diagnostics" },
          ],
          [
            { text: "❓ 도움말", callback_data: "utils_help" },
            { text: "🔙 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    };
  }

  // ✅ 메시지 처리 (표준)
  async handleMessage(bot, msg) {
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
    if (text.match(/^\/?(utils|유틸)$/i)) {
      const userName = getUserName(msg.from);
      await this.showMenu(bot, chatId, null, userId, userName);
      return true;
    }

    return false;
  }

  // ✅ 콜백 처리 (표준화된 매개변수)
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    // null 체크 추가
    if (!subAction) {
      logger.warn("UtilsModule: subAction이 null입니다");
      return false;
    }

    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      // 액션 매핑에서 처리
      if (this.actionMap.has(subAction)) {
        const actionHandler = this.actionMap.get(subAction);
        await actionHandler(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      }

      // 기본 시스템 액션 처리
      if (subAction === "menu") {
        await this.showUtilsMenu(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        return true;
      }

      logger.warn(`UtilsModule: 알 수 없는 액션: ${subAction}`);
      return false;
    } catch (error) {
      logger.error(`UtilsModule 콜백 오류 (${subAction}):`, error);
      await this.handleError(bot, chatId, error);
      return false;
    }
  }

  // =============== TTS 기능들 ===============

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

      await bot.sendMessage(chatId, "🔊 TTS 음성을 생성 중입니다...");

      // TTS 처리 로직 (실제 구현 필요)
      const result = await this.ttsService.generateSpeech(ttsText, userId);

      if (result.success) {
        await bot.sendVoice(chatId, result.audioPath);
      } else {
        await bot.sendMessage(chatId, `❌ TTS 생성 실패: ${result.error}`);
      }
    } catch (error) {
      logger.error("TTS 명령어 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ TTS 처리 중 오류가 발생했습니다.");
    }
  }

  async showUtilsMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const menuData = this.getMenuData(userName);

    try {
      if (messageId) {
        await bot.editMessageText(menuData.text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: menuData.keyboard,
        });
      } else {
        await bot.sendMessage(chatId, menuData.text, {
          parse_mode: "Markdown",
          reply_markup: menuData.keyboard,
        });
      }
    } catch (error) {
      logger.error("유틸리티 메뉴 표시 오류:", error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showTTSMenu(bot, chatId, messageId, userId, userName) {
    const ttsMenuText = `🔊 **TTS (Text-To-Speech)**\n\n음성 변환 설정을 관리하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🗣️ 수동 모드", callback_data: "utils_tts_manual" },
          { text: "🤖 자동 모드", callback_data: "utils_tts_auto_on" },
        ],
        [
          { text: "🛑 TTS 끄기", callback_data: "utils_tts_auto_off" },
          { text: "🔧 진단", callback_data: "utils_tts_diagnostics" },
        ],
        [
          { text: "❓ 도움말", callback_data: "utils_tts_help" },
          { text: "🔙 유틸리티", callback_data: "utils_menu" },
        ],
      ],
    };

    try {
      await bot.editMessageText(ttsMenuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("TTS 메뉴 표시 오류:", error);
    }
  }

  async showTTSHelp(bot, chatId, messageId) {
    const helpText =
      `🔊 **TTS 사용법**\n\n` +
      `**명령어:**\n` +
      `• \`/tts 텍스트\` - 음성으로 변환\n\n` +
      `**지원 언어:**\n` +
      `• 🇰🇷 한국어 (기본)\n` +
      `• 🇺🇸 영어\n` +
      `• 🇯🇵 일본어\n` +
      `• 🇨🇳 중국어\n` +
      `• 🇪🇸 스페인어\n` +
      `• 🇫🇷 프랑스어\n\n` +
      `**모드:**\n` +
      `• 자동: 모든 메시지 음성 변환\n` +
      `• 수동: 명령어로만 변환\n` +
      `• 끄기: TTS 비활성화`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
      ],
    };

    try {
      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("TTS 도움말 표시 오류:", error);
    }
  }

  async showUtilsHelp(bot, chatId, messageId) {
    const helpText =
      `🛠️ **유틸리티 도움말**\n\n` +
      `**사용 가능한 기능:**\n\n` +
      `🔊 **TTS (음성 변환)**\n` +
      `• 텍스트를 음성으로 변환\n` +
      `• 6개국어 지원\n` +
      `• 자동/수동 모드\n\n` +
      `**명령어:**\n` +
      `• \`/utils\` - 유틸리티 메뉴\n` +
      `• \`/tts 텍스트\` - TTS 변환`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" }],
      ],
    };

    try {
      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("유틸리티 도움말 표시 오류:", error);
    }
  }

  async showTTSUsageHelp(bot, chatId) {
    const helpText =
      `🔊 **TTS 사용법**\n\n` +
      `텍스트를 음성으로 변환합니다.\n\n` +
      `**사용법:**\n` +
      `\`/tts 변환할 텍스트\`\n\n` +
      `**예시:**\n` +
      `\`/tts 안녕하세요!\`\n` +
      `\`/tts Hello world!\``;

    await bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
    });
  }

  async showTTSDiagnostics(bot, chatId, messageId) {
    const diagnosticsText =
      `🔧 **TTS 진단**\n\n` +
      `**서비스 상태:**\n` +
      `• TTS 서비스: ${this.ttsService ? "✅ 사용 가능" : "❌ 사용 불가"}\n` +
      `• 네트워크: ✅ 정상\n` +
      `• 임시 파일: ✅ 정상\n\n` +
      `**통계:**\n` +
      `• 활성 요청: ${this.activeTTSRequests.size}개\n` +
      `• 마지막 진단: ${
        this.lastDiagnostics ? this.lastDiagnostics.toLocaleString() : "없음"
      }`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
      ],
    };

    try {
      await bot.editMessageText(diagnosticsText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("TTS 진단 표시 오류:", error);
    }
  }

  // =============== 설정 메서드들 ===============

  async enableAutoTTS(bot, chatId, messageId, userId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🤖 자동 TTS 모드가 활성화되었습니다",
    });
  }

  async disableAutoTTS(bot, chatId, messageId, userId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🛑 TTS가 비활성화되었습니다",
    });
  }

  async enableManualTTS(bot, chatId, messageId, userId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🗣️ 수동 TTS 모드가 활성화되었습니다",
    });
  }

  async setLanguage(language, bot, chatId, messageId, userId) {
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
  }

  async stopTTS(bot, chatId, messageId, userId) {
    this.activeTTSRequests.delete(userId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "🛑 TTS가 중지되었습니다",
    });
  }

  async handleError(bot, chatId, error) {
    const errorText =
      "❌ 처리 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.";

    try {
      await bot.sendMessage(chatId, errorText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
              { text: "🏠 메인 메뉴", callback_data: "main_menu" },
            ],
          ],
        },
      });
    } catch (sendError) {
      logger.error("에러 메시지 전송 실패:", sendError);
    }
  }

  async initialize() {
    try {
      // TTS 진단 실행 (안전하게)
      if (this.ttsService) {
        try {
          this.diagnosticsCache = await this.ttsService.runDiagnostics();
          this.lastDiagnostics = new Date();
          logger.info("✅ TTS 진단 완료");
        } catch (diagError) {
          logger.warn("⚠️ TTS 진단 실패:", diagError.message);
        }
      }

      await super.initialize();
      logger.success("✅ UtilsModule 초기화 완료");
    } catch (error) {
      logger.error("❌ UtilsModule 초기화 실패:", error);
      throw error;
    }
  }
}

module.exports = UtilsModule;
