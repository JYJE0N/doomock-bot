// src/modules/TTSModule.js
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TTSStateHelper = require("../utils/TTSStateHelper");
const TTSVoiceConfig = require("../config/TTSVoiceConfig");

class TTSModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.ttsService = null;
    this.stateHelper = new TTSStateHelper();
    this.voiceConfig = new TTSVoiceConfig();

    this.config = {
      maxTextLength: 500,
      defaultLanguage: "ko-KR",
      supportedLanguages: ["ko-KR", "en-US"]
    };
  }

  async onInitialize() {
    this.ttsService = await this.serviceBuilder.getOrCreate("tts");
    this.setupActions();
    logger.success("🔊 TTSModule 초기화 완료");
  }

  setupActions() {
    // 표준: registerActions 사용
    this.registerActions({
      menu: this.showMenu,
      start: this.startConvert,
      select_voice: this.selectVoice,
      change_voice: this.changeVoice,
      share: this.shareAudio
    });
  }

  // 표준 매개변수 5개: bot, callbackQuery, subAction, params, moduleManager
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);
    const userVoice = await this.ttsService.getUserVoice(userId);

    return {
      type: "menu",
      module: "tts",
      data: {
        userName,
        currentVoice: this.voiceConfig.getVoiceByCode(userVoice),
        languages: this.config.supportedLanguages
      }
    };
  }

  async startConvert(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const language = params || this.config.defaultLanguage;

    // 상태 설정
    this.stateHelper.setState(userId, {
      action: "waiting_text_input",
      language,
      messageId: callbackQuery.message.message_id
    });

    return {
      type: "waiting_input",
      module: "tts",
      data: {
        language,
        maxLength: this.config.maxTextLength
      }
    };
  }

  async selectVoice(bot, callbackQuery, subAction, params, moduleManager) {
    const language = params || this.config.defaultLanguage;
    const voices = this.voiceConfig.getVoices(language);

    return {
      type: "voice_selection",
      module: "tts",
      data: {
        language,
        voices
      }
    };
  }

  async changeVoice(bot, callbackQuery, subAction, params, moduleManager) {
    const userId = getUserId(callbackQuery.from);
    const voiceCode = params;

    const result = await this.ttsService.setUserVoice(userId, voiceCode);
    const voice = this.voiceConfig.getVoiceByCode(voiceCode);

    // 결과 활용 예시
    if (!result.success) {
      logger.warn("음성 설정 실패:", result.error);
    }

    return {
      type: "voice_changed",
      module: "tts",
      data: { voice }
    };
  }

  async shareAudio(bot, callbackQuery, subAction, params, moduleManager) {
    const shareUrl = params;
    const baseUrl = process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN;

    if (!baseUrl) {
      logger.warn("BASE_URL 또는 RAILWAY_PUBLIC_DOMAIN 환경변수가 설정되지 않음");
      return {
        type: "error",
        module: "tts",
        data: {
          message: "공유 기능을 사용할 수 없습니다. 관리자에게 문의하세요."
        }
      };
    }

    // Railway 도메인인 경우 https:// 추가
    const protocol = baseUrl.startsWith("http") ? "" : "https://";
    const fullUrl = `${protocol}${baseUrl}${shareUrl}`;

    return {
      type: "share_ready",
      module: "tts",
      data: {
        shareUrl: fullUrl,
        message: "링크가 준비되었습니다! 복사해서 공유하세요."
      }
    };
  }

  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);

    if (!this.stateHelper.isWaitingForInput(userId)) {
      return false;
    }

    const state = this.stateHelper.getState(userId);
    const text = msg.text?.trim();

    if (!text || text.length > this.config.maxTextLength) {
      return {
        type: "error",
        module: "tts",
        data: {
          message: text
            ? `텍스트가 너무 깁니다 (최대 ${this.config.maxTextLength}자)`
            : "텍스트를 입력해주세요"
        }
      };
    }

    // TTS 변환
    const result = await this.ttsService.convertTextToSpeech(userId, {
      text,
      language: state.language
    });

    this.stateHelper.clearState(userId);

    if (result.success) {
      return {
        type: "conversion_complete",
        module: "tts",
        data: {
          text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          audioFile: result.data.audioFile,
          shareUrl: result.data.shareUrl,
          voice: result.data.voice
        }
      };
    } else {
      return {
        type: "error",
        module: "tts",
        data: { message: "변환 중 오류가 발생했습니다" }
      };
    }
  }

  async cleanup() {
    this.stateHelper.userStates.clear();
    await super.cleanup();
  }
}

module.exports = TTSModule;
