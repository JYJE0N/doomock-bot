// src/modules/TTSModule.js - 🔊 TTS 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔊 TTSModule - Text-to-Speech 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: tts:action:params
 * ✅ 렌더링은 Renderer가 담당
 */
class TTSModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.ttsService = null;

    // 모듈 설정
    this.config = {
      maxTextLength: parseInt(process.env.TTS_MAX_TEXT_LENGTH) || 5000,
      defaultLanguage: process.env.TTS_DEFAULT_LANGUAGE || "ko-KR",
      defaultVoice: process.env.TTS_DEFAULT_VOICE || "ko-KR-Standard-A",
      enableHistory: process.env.TTS_ENABLE_HISTORY !== "false",
      supportedLanguages: ["ko-KR", "en-US", "ja-JP", "zh-CN"],
      ...options.config,
    };

    // 음성 매핑 (사용자 친화적 이름)
    this.voiceMap = {
      "ko-KR-Wavenet-A": { name: "유리", gender: "FEMALE", type: "Premium" },
      "ko-KR-Wavenet-B": { name: "철수", gender: "MALE", type: "Premium" },
      "ko-KR-Wavenet-C": { name: "수진", gender: "FEMALE", type: "Premium" },
      "ko-KR-Wavenet-D": { name: "영호", gender: "MALE", type: "Premium" },

      "ko-KR-Standard-A": { name: "나래", gender: "FEMALE", type: "Standard" },
      "ko-KR-Standard-B": { name: "준우", gender: "MALE", type: "Standard" },
      "ko-KR-Standard-C": { name: "다솜", gender: "FEMALE", type: "Standard" },
      "ko-KR-Standard-D": { name: "민준", gender: "MALE", type: "Standard" },

      "ko-KR-Chirp3-HD-Achird": { name: "대발", gender: "MALE", type: "HD" },
      "ko-KR-Chirp3-HD-Algenib": { name: "진수", gender: "MALE", type: "HD" },
      "ko-KR-Chirp3-HD-Algieba": { name: "덕팔", gender: "MALE", type: "HD" },
      "ko-KR-Chirp3-HD-Alnilam": { name: "성훈", gender: "MALE", type: "HD" },
      "ko-KR-Chirp3-HD-Achernar": {
        name: "명자",
        gender: "FEMALE",
        type: "HD",
      },
      "ko-KR-Chirp3-HD-Aoede": { name: "선희", gender: "FEMALE", type: "HD" },
      "ko-KR-Chirp3-HD-Autonoe": { name: "지현", gender: "FEMALE", type: "HD" },
      "ko-KR-Chirp3-HD-Callirrhoe": {
        name: "광례",
        gender: "FEMALE",
        type: "HD",
      },
    };

    // 사용자 입력 상태 관리
    this.userInputStates = new Map();

    logger.info(`🔊 TTSModule 생성 완료 (v4.1)`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      if (this.serviceBuilder) {
        this.ttsService = await this.serviceBuilder.getOrCreate("tts", {
          config: this.config,
        });
      }

      if (!this.ttsService) {
        throw new Error("TTSService 생성 실패");
      }

      // 만료된 상태 정리 스케줄러 (10분마다)
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredStates();
      }, 10 * 60 * 1000);

      logger.success("✅ TTSModule 초기화 완료");
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
      // 기본 액션
      menu: this.showMenu,

      // TTS 변환
      convert: this.startConvert,

      // 음성 관리
      voices: this.showVoices,
      voice: this.selectVoice,

      // 조회 기능
      history: this.showHistory,
      stats: this.showStats,

      // 설정
      settings: this.showSettings,
      help: this.showHelp,
    });

    logger.info(`✅ TTSModule 액션 등록 완료 (${this.actionMap.size}개)`);
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

    // 사용자 상태 확인
    const userState = this.getUserInputState(userId);

    // TTS 변환 대기 중
    if (userState?.waitingFor === "tts_text") {
      return await this.handleTextInput(bot, msg, text, userState);
    }

    // 모듈 키워드 확인
    const keywords = ["티티에스", "음성변환", "tts", "음성", "변환"];
    if (this.isModuleMessage(text, keywords)) {
      return {
        type: "render_request",
        module: "tts",
        action: "menu",
        chatId: chatId,
        data: await this.getMenuData(userId),
      };
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const menuData = await this.getMenuData(userId);

      return {
        type: "menu",
        module: "tts",
        data: {
          ...menuData,
          userName,
        },
      };
    } catch (error) {
      logger.error("TTS 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🎤 변환 시작
   */
  async startConvert(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    logger.debug(`🎤 TTS 변환 시작`, { userId, userName, params });

    try {
      // 언어 설정 (파라미터에서 추출)
      let language = this.config.defaultLanguage;
      if (
        params &&
        params[0] &&
        this.config.supportedLanguages.includes(params[0])
      ) {
        language = params[0];
      }

      // 사용자 입력 상태 설정
      this.setUserInputState(userId, {
        waitingFor: "tts_text",
        action: "convert",
        language: language,
        voice: this.getDefaultVoiceForLanguage(language),
        timestamp: Date.now(),
      });

      return {
        type: "input_request",
        module: "tts",
        data: {
          maxLength: this.config.maxTextLength,
          language: language,
          supportedLanguages: this.config.supportedLanguages,
        },
      };
    } catch (error) {
      logger.error("TTS 변환 시작 실패:", error);
      return {
        type: "error",
        message: "텍스트 변환 요청 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🎭 음성 목록 표시
   */
  async showVoices(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const language = params[0] || this.config.defaultLanguage;

      // 서비스에서 사용 가능한 음성 목록 조회
      const voicesResult = await this.ttsService.getAvailableVoices(language);

      if (voicesResult.success) {
        // 음성 정보를 사용자 친화적으로 변환
        const friendlyVoices = voicesResult.voices.map((voice) => {
          const voiceInfo = this.getLocalizedVoiceInfo(voice.name);
          return {
            id: voice.name,
            name: voiceInfo.name,
            gender: voiceInfo.gender,
            type: voiceInfo.type,
            original: voice.name,
            sampleRate: voice.naturalSampleRateHertz,
            ssmlGender: voice.ssmlGender,
          };
        });

        return {
          type: "voices",
          module: "tts",
          data: {
            language,
            voices: friendlyVoices,
            supportedLanguages: this.config.supportedLanguages,
          },
        };
      } else {
        throw new Error(voicesResult.error || "음성 목록 조회 실패");
      }
    } catch (error) {
      logger.error("음성 목록 조회 실패:", error);
      return {
        type: "error",
        message: "음성 목록을 불러올 수 없습니다.",
      };
    }
  }

  /**
   * 🎵 음성 선택
   */
  async selectVoice(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const selectedVoice = params[0];

    if (!selectedVoice) {
      return {
        type: "error",
        message: "음성 정보가 필요합니다.",
      };
    }

    try {
      // 선택한 음성 정보 가져오기
      const voiceInfo = this.getLocalizedVoiceInfo(selectedVoice);

      // 사용자 입력 상태 설정
      this.setUserInputState(userId, {
        waitingFor: "tts_text",
        action: "convert",
        voice: selectedVoice,
        language: this.extractLanguageFromVoice(selectedVoice),
        timestamp: Date.now(),
      });

      logger.info(`🎵 음성 선택`, {
        userId,
        voice: selectedVoice,
        voiceName: voiceInfo.name,
      });

      return {
        type: "voice_selected",
        module: "tts",
        data: {
          selectedVoice: voiceInfo,
          maxLength: this.config.maxTextLength,
        },
      };
    } catch (error) {
      logger.error("음성 선택 처리 실패:", error);
      return {
        type: "error",
        message: "음성 선택 처리에 실패했습니다.",
      };
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const stats = await this.getUserStats(userId);

      return {
        type: "stats",
        module: "tts",
        data: {
          userName,
          stats,
          config: this.config,
        },
      };
    } catch (error) {
      logger.error("TTS 통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다.",
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    return {
      type: "help",
      module: "tts",
      data: {
        config: this.config,
        voiceMap: this.voiceMap,
        features: {
          convert: "텍스트를 자연스러운 음성으로 변환",
          voices: "다양한 음성 선택",
          history: "변환 기록 관리",
          languages: "다국어 지원",
        },
      },
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 📝 텍스트 입력 처리 (핵심 비즈니스 로직)
   */
  async handleTextInput(bot, msg, text, userState) {
    const {
      from: { id: userId },
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 텍스트 길이 검증
      if (text.length > this.config.maxTextLength) {
        return {
          type: "input_error",
          message: `텍스트가 너무 깁니다. 최대 ${this.config.maxTextLength}자까지 입력 가능합니다. (현재: ${text.length}자)`,
        };
      }

      // TTS 변환 처리
      const result = await this.ttsService.textToSpeech(text, {
        languageCode: userState.language,
        voiceName: userState.voice,
        userId: userId,
      });

      // 사용자 상태 정리
      this.clearUserInputState(userId);

      if (result.success) {
        const voiceInfo = this.getLocalizedVoiceInfo(
          result.voice || userState.voice
        );

        logger.info(`✅ TTS 변환 성공`, {
          userId,
          userName,
          textLength: text.length,
          voice: voiceInfo.name,
          duration: result.duration,
        });

        return {
          type: "convert_success",
          module: "tts",
          data: {
            filePath: result.filePath,
            voice: voiceInfo,
            duration: result.duration,
            text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
            originalText: text,
          },
        };
      } else {
        logger.warn(`❌ TTS 변환 실패`, { userId, reason: result.reason });

        return {
          type: "convert_error",
          message: result.reason || "음성 변환에 실패했습니다.",
        };
      }
    } catch (error) {
      logger.error("TTS 텍스트 입력 처리 실패:", error);
      this.clearUserInputState(userId);

      return {
        type: "error",
        message: "음성 변환 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 🏠 메뉴 데이터 조회
   */
  async getMenuData(userId) {
    const stats = await this.getUserStats(userId);
    const serviceStatus = await this.getServiceStatus();

    return {
      stats,
      serviceStatus,
      config: this.config,
      recentInputState: this.getUserInputState(userId),
    };
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      if (
        this.ttsService &&
        typeof this.ttsService.getUserStats === "function"
      ) {
        return await this.ttsService.getUserStats(userId);
      }

      // 폴백: 기본 통계
      return {
        totalConversions: 0,
        lastConversion: null,
        favoriteVoice: this.config.defaultVoice,
        totalDuration: 0,
      };
    } catch (error) {
      logger.error("사용자 통계 조회 실패:", error);
      return {
        totalConversions: 0,
        lastConversion: null,
        favoriteVoice: this.config.defaultVoice,
        totalDuration: 0,
      };
    }
  }

  /**
   * ⚙️ 서비스 상태 조회
   */
  async getServiceStatus() {
    try {
      if (this.ttsService && typeof this.ttsService.getStatus === "function") {
        return this.ttsService.getStatus();
      }

      return {
        isConnected: !!this.ttsService,
        config: this.config,
      };
    } catch (error) {
      logger.error("서비스 상태 조회 실패:", error);
      return {
        isConnected: false,
        config: this.config,
      };
    }
  }

  /**
   * 🎤 음성 정보 변환 (사용자 친화적)
   */
  getLocalizedVoiceInfo(rawVoiceName) {
    const info = this.voiceMap[rawVoiceName];
    if (info) return info;

    // 폴백: 기본 정보 생성
    const fallbackName = rawVoiceName.split("-").pop() || "새 음성";
    const gender = rawVoiceName.toUpperCase().includes("FEMALE")
      ? "FEMALE"
      : "MALE";
    return {
      name: fallbackName,
      gender,
      type: "Standard",
    };
  }

  /**
   * 🌐 언어별 기본 음성 가져오기
   */
  getDefaultVoiceForLanguage(language) {
    const defaults = {
      "ko-KR": "ko-KR-Standard-A",
      "en-US": "en-US-Standard-C",
      "ja-JP": "ja-JP-Standard-A",
      "zh-CN": "zh-CN-Standard-A",
    };

    return defaults[language] || this.config.defaultVoice;
  }

  /**
   * 🔤 음성명에서 언어 추출
   */
  extractLanguageFromVoice(voiceName) {
    const match = voiceName.match(/^([a-z]{2}-[A-Z]{2})/);
    return match ? match[1] : this.config.defaultLanguage;
  }

  /**
   * 🏷️ 사용자 입력 상태 설정
   */
  setUserInputState(userId, state) {
    this.userInputStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now(),
    });
    logger.debug(`사용자 입력 상태 설정: ${userId}`, state);
  }

  /**
   * 🔍 사용자 입력 상태 조회
   */
  getUserInputState(userId) {
    const state = this.userInputStates.get(userId.toString());

    // 30분 이상 오래된 상태는 자동 삭제
    if (state && Date.now() - state.timestamp > 30 * 60 * 1000) {
      this.clearUserInputState(userId);
      return null;
    }

    return state;
  }

  /**
   * 🧹 사용자 입력 상태 초기화
   */
  clearUserInputState(userId) {
    const deleted = this.userInputStates.delete(userId.toString());
    if (deleted) {
      logger.debug(`사용자 입력 상태 초기화: ${userId}`);
    }
    return deleted;
  }

  /**
   * 🧹 만료된 상태 정리
   */
  cleanupExpiredStates() {
    const now = Date.now();
    const expiredUsers = [];

    for (const [userId, state] of this.userInputStates.entries()) {
      if (now - state.timestamp > 30 * 60 * 1000) {
        // 30분
        expiredUsers.push(userId);
      }
    }

    expiredUsers.forEach((userId) => {
      this.userInputStates.delete(userId);
    });

    if (expiredUsers.length > 0) {
      logger.debug(`만료된 사용자 상태 ${expiredUsers.length}개 정리됨`);
    }
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.ttsService,
      activeInputStates: this.userInputStates.size,
      config: {
        maxTextLength: this.config.maxTextLength,
        defaultLanguage: this.config.defaultLanguage,
        supportedLanguages: this.config.supportedLanguages,
        enableHistory: this.config.enableHistory,
      },
      voicesCount: Object.keys(this.voiceMap).length,
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async onCleanup() {
    try {
      // 스케줄러 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // 사용자 상태 정리
      this.userInputStates.clear();

      if (this.ttsService && this.ttsService.cleanup) {
        await this.ttsService.cleanup();
      }
      logger.info("✅ TTSModule 정리 완료");
    } catch (error) {
      logger.error("❌ TTSModule 정리 실패:", error);
    }
  }
}

module.exports = TTSModule;
