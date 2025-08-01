const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * 🔊 TTSModule - 음성 변환 모듈 (심플 버전)
 */
class TTSModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.ttsService = null;
    this.userStates = new Map(); // 사용자 입력 상태

    // 간단한 설정
    this.config = {
      maxTextLength: 1000, // 최대 1000자
      defaultLanguage: "ko-KR", // 기본 한국어
      supportedLanguages: ["ko-KR", "en-US", "ja-JP"], // 3개 언어만
      voices: {
        "ko-KR": [
          { code: "ko-KR-Wavenet-A", name: "유리 (여성)" },
          { code: "ko-KR-Wavenet-B", name: "철수 (남성)" },
        ],
        "en-US": [
          { code: "en-US-Wavenet-C", name: "Sarah (Female)" },
          { code: "en-US-Wavenet-D", name: "John (Male)" },
        ],
        "ja-JP": [
          { code: "ja-JP-Wavenet-A", name: "さくら (女性)" },
          { code: "ja-JP-Wavenet-B", name: "たかし (男性)" },
        ],
      },
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    this.ttsService = await this.serviceBuilder.getOrCreate("tts");

    if (!this.ttsService) {
      throw new Error("TTSService를 찾을 수 없습니다");
    }

    this.setupActions();
    logger.success("🔊 TTSModule 초기화 완료");
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("convert", this.startConvert.bind(this));
    this.actionMap.set("voices", this.showVoices.bind(this));
    this.actionMap.set("voice", this.selectVoice.bind(this));
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("settings", this.showSettings.bind(this));
  }

  /**
   * 🔊 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const userName = getUserName(callbackQuery.from);

    // 사용자 통계 조회
    const stats = await this.ttsService.getUserStats(userId);

    return {
      type: "menu",
      module: "tts",
      data: {
        userId,
        userName,
        stats: stats.success ? stats.data : null,
        config: this.config,
      },
    };
  }

  /**
   * 🎤 음성 변환 시작
   */
  async startConvert(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    // 언어 선택 (파라미터가 있으면 해당 언어, 없으면 기본)
    const language = params || this.config.defaultLanguage;

    if (!this.config.supportedLanguages.includes(language)) {
      return {
        type: "error",
        module: "tts",
        data: { message: "지원하지 않는 언어입니다." },
      };
    }

    // 사용자 상태 설정 (텍스트 입력 대기)
    this.userStates.set(userId, {
      action: "waiting_text_input",
      language: language,
      messageId: callbackQuery.message.message_id,
      voice: this.getDefaultVoice(language),
    });

    return {
      type: "convert_prompt",
      module: "tts",
      data: {
        language: language,
        maxLength: this.config.maxTextLength,
        voiceName: this.getVoiceName(this.getDefaultVoice(language)),
      },
    };
  }

  /**
   * 🎵 음성 목록 표시
   */
  async showVoices(bot, callbackQuery, params) {
    const language = params || this.config.defaultLanguage;

    return {
      type: "voices",
      module: "tts",
      data: {
        language: language,
        voices: this.config.voices[language] || [],
        supportedLanguages: this.config.supportedLanguages,
      },
    };
  }

  /**
   * 🎯 음성 선택
   */
  async selectVoice(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const voiceCode = params;

    if (!voiceCode) {
      return {
        type: "error",
        module: "tts",
        data: { message: "음성 코드가 필요합니다." },
      };
    }

    // 음성 설정 저장
    const result = await this.ttsService.setUserVoice(userId, voiceCode);

    if (!result.success) {
      return {
        type: "error",
        module: "tts",
        data: { message: result.message },
      };
    }

    return {
      type: "voice_selected",
      module: "tts",
      data: {
        voiceCode: voiceCode,
        voiceName: this.getVoiceName(voiceCode),
        message: "음성이 설정되었습니다.",
      },
    };
  }

  /**
   * 📋 변환 이력
   */
  async showHistory(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    const result = await this.ttsService.getConversionHistory(userId, {
      limit: 10,
    });

    if (!result.success) {
      return {
        type: "error",
        module: "tts",
        data: { message: result.message },
      };
    }

    return {
      type: "history",
      module: "tts",
      data: {
        history: result.data.records,
        totalCount: result.data.totalCount,
      },
    };
  }

  /**
   * ⚙️ 설정 표시
   */
  async showSettings(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);

    return {
      type: "settings",
      module: "tts",
      data: {
        config: this.config,
        message: "TTS 설정 기능은 곧 추가될 예정입니다.",
      },
    };
  }

  /**
   * 💬 메시지 처리 (텍스트 입력)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const userState = this.userStates.get(userId);

    if (!userState || userState.action !== "waiting_text_input") {
      return; // 이 모듈에서 처리할 메시지가 아님
    }

    const text = msg.text?.trim();

    if (!text) {
      return {
        type: "convert_error",
        module: "tts",
        data: { message: "변환할 텍스트를 입력해주세요." },
      };
    }

    if (text.length > this.config.maxTextLength) {
      return {
        type: "convert_error",
        module: "tts",
        data: {
          message: `텍스트가 너무 깁니다. (최대 ${this.config.maxTextLength}자, 현재 ${text.length}자)`,
        },
      };
    }

    // TTS 변환 처리
    const result = await this.ttsService.convertTextToSpeech(userId, {
      text: text,
      language: userState.language,
      voice: userState.voice,
    });

    // 상태 초기화
    this.userStates.delete(userId);

    if (result.success) {
      return {
        type: "convert_success",
        module: "tts",
        data: {
          audioFile: result.data.audioFile,
          text: text.length > 50 ? text.substring(0, 50) + "..." : text,
          voice: this.getVoiceName(userState.voice),
          language: userState.language,
          duration: result.data.duration,
          fileSize: result.data.fileSize,
        },
      };
    } else {
      return {
        type: "convert_error",
        module: "tts",
        data: { message: result.message },
      };
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 언어별 기본 음성 가져오기
   */
  getDefaultVoice(language) {
    const voices = this.config.voices[language];
    return voices && voices.length > 0 ? voices[0].code : null;
  }

  /**
   * 음성 코드에서 이름 가져오기
   */
  getVoiceName(voiceCode) {
    for (const [lang, voices] of Object.entries(this.config.voices)) {
      const voice = voices.find((v) => v.code === voiceCode);
      if (voice) return voice.name;
    }
    return voiceCode;
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    this.userStates.clear();
    logger.debug("🔊 TTSModule 정리 완료");
  }
}

module.exports = TTSModule;
