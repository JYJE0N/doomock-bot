// src/modules/TTSModule.js
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🔊 TTSModule - Text-to-Speech 모듈
 *
 * 주요 기능:
 * - 텍스트를 음성으로 변환
 * - 다양한 언어 및 음성 선택
 * - 변환 기록 관리
 */
class TTSModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TTSModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // 서비스
    this.ttsService = null;
    this.serviceBuilder = options.serviceBuilder || null;

    // 모듈 설정
    this.config = {
      maxTextLength: parseInt(process.env.TTS_MAX_TEXT_LENGTH) || 5000,
      defaultLanguage: process.env.TTS_DEFAULT_LANGUAGE || "ko-KR",
      enableHistory: true,
      ...options.config,
    };

    logger.module("TTSModule", "모듈 생성", { version: "3.0.1" });
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.module("TTSModule", "초기화 시작");

      // TTSService 초기화
      this.ttsService = await this.serviceBuilder.getOrCreate("tts", {
        config: this.config,
      });
      await this.ttsService.initialize();

      logger.success("TTSModule 초기화 완료");
    } catch (error) {
      logger.error("TTSModule 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      convert: this.startConvert,
      voices: this.showVoices,
      history: this.showHistory,
      settings: this.showSettings,
      help: this.showHelp,
    });

    logger.module("TTSModule", "액션 등록 완료", {
      count: this.actionMap.size,
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

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    // TTS 변환 대기 중
    if (userState?.waitingFor === "tts_text") {
      await this.handleTextInput(bot, msg);
      return true;
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "tts" || text === "음성변환") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "tts"
      );
      return true;
    }

    return false;
  }

  // ===== 📋 액션 메서드들 =====

  /**
   * 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("tts", "menu", userId);

    try {
      // 사용자 통계 조회
      const stats = (await this.ttsService.getUserStats?.(userId)) || {
        totalConversions: 0,
        lastConversion: null,
      };

      // 서비스 상태 확인
      const serviceStatus = this.ttsService.getStatus();

      return {
        type: "menu",
        module: "tts",
        data: {
          stats,
          isServiceActive: serviceStatus.isConnected,
          defaultLanguage: serviceStatus.config.defaultLanguage,
        },
      };
    } catch (error) {
      logger.error("tts menu 조회 실패", error);
      return { type: "error", message: "메뉴를 불러올 수 없습니다." };
    }
  }

  /**
   * 변환 시작
   */
  async startConvert(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("tts", "convert", userId);

    // 사용자 상태 설정
    this.setUserState(userId, {
      waitingFor: "tts_text",
      action: "convert",
      language: params.language || this.config.defaultLanguage,
    });

    return {
      type: "input",
      module: "tts",
      message: `📝 변환할 텍스트를 입력하세요:\\n\\n최대 ${this.config.maxTextLength}자까지 입력 가능합니다\\.`,
    };
  }

  /**
   * 텍스트 입력 처리
   */
  async handleTextInput(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      // 길이 검증
      if (text.length > this.config.maxTextLength) {
        await bot.sendMessage(
          chatId,
          `❌ 텍스트가 너무 깁니다. 최대 ${this.config.maxTextLength}자까지 입력 가능합니다.`
        );
        return;
      }

      // 처리 중 메시지
      const processingMsg = await bot.sendMessage(
        chatId,
        "🔊 음성 변환 중... 잠시만 기다려주세요."
      );

      // 사용자 상태 가져오기
      const userState = this.getUserState(userId);

      // TTS 변환 요청
      const result = await this.ttsService.textToSpeech(text, {
        languageCode: userState.language,
      });

      if (result.success) {
        // 음성 파일 전송
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🎵 변환 완료!\\n길이: 약 ${result.duration}초`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔊 다시 변환", callback_data: "tts:convert" },
                { text: "🎭 음성 변경", callback_data: "tts:voices" },
              ],
              [{ text: "📋 메뉴로", callback_data: "tts:menu" }],
            ],
          },
        });

        // 처리 중 메시지 삭제
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } else {
        await bot.sendMessage(chatId, "❌ 음성 변환에 실패했습니다.");
      }

      // 사용자 상태 초기화
      this.clearUserState(userId);
    } catch (error) {
      logger.error("TTS 변환 오류:", error);
      await bot.sendMessage(chatId, "❌ 음성 변환 중 오류가 발생했습니다.");
      this.clearUserState(userId);
    }
  }

  /**
   * 음성 목록 표시
   */
  async showVoices(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("tts", "voices", userId);

    try {
      // 사용 가능한 음성 목록 조회
      const voices = await this.ttsService.getAvailableVoices("ko-KR");

      return {
        type: "list",
        module: "tts",
        data: {
          title: "사용 가능한 음성",
          items: voices.map((voice) => ({
            id: voice.name,
            title: voice.name,
            description: `${voice.ssmlGender} - ${voice.naturalSampleRateHertz}Hz`,
          })),
        },
      };
    } catch (error) {
      logger.error("음성 목록 조회 실패", error);
      return { type: "error", message: "음성 목록을 불러올 수 없습니다." };
    }
  }

  /**
   * 변환 기록 표시
   */
  async showHistory(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("tts", "history", userId);

    try {
      // 변환 기록 조회 (서비스에 구현되어 있다면)
      const history = (await this.ttsService.getUserHistory?.(userId)) || [];

      if (history.length === 0) {
        return {
          type: "empty",
          module: "tts",
          message: "아직 변환 기록이 없습니다.",
        };
      }

      return {
        type: "list",
        module: "tts",
        data: {
          title: "🕒 변환 기록",
          items: history.map((item) => ({
            id: item._id,
            title:
              item.text.substring(0, 50) + (item.text.length > 50 ? "..." : ""),
            description: `${item.language} | ${new Date(
              item.createdAt
            ).toLocaleDateString()}`,
          })),
        },
      };
    } catch (error) {
      logger.error("변환 기록 조회 실패", error);
      return { type: "error", message: "기록을 불러올 수 없습니다." };
    }
  }

  /**
   * 설정 표시
   */
  async showSettings(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    logger.info("tts", "settings", userId);

    try {
      // 사용자 설정 조회
      const userSettings = (await this.ttsService.getUserSettings?.(
        userId
      )) || {
        defaultLanguage: this.config.defaultLanguage,
        defaultVoice: this.config.voiceName,
        autoDelete: false,
      };

      return {
        type: "settings",
        module: "tts",
        data: {
          title: "⚙️ TTS 설정",
          settings: [
            {
              key: "language",
              label: "기본 언어",
              value: userSettings.defaultLanguage,
              options: ["ko-KR", "en-US", "ja-JP", "zh-CN"],
            },
            {
              key: "voice",
              label: "기본 음성",
              value: userSettings.defaultVoice,
              options: ["Wavenet-A", "Wavenet-B", "Wavenet-C", "Wavenet-D"],
            },
            {
              key: "autoDelete",
              label: "자동 삭제",
              value: userSettings.autoDelete,
              type: "boolean",
            },
          ],
        },
      };
    } catch (error) {
      logger.error("설정 조회 실패", error);
      return { type: "error", message: "설정을 불러올 수 없습니다." };
    }
  }

  /**
   * 도움말
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "tts",
      data: {
        title: "TTS 도움말",
        features: [
          "텍스트를 자연스러운 음성으로 변환",
          "다양한 언어 및 음성 지원",
          "최대 5000자 텍스트 변환",
        ],
        commands: ["/tts - TTS 메뉴"],
        tips: [
          "긴 텍스트는 여러 문장으로 나눠서 변환하면 더 자연스럽습니다",
          "구두점을 적절히 사용하면 음성이 더 자연스러워집니다",
        ],
      },
    };
  }
}

module.exports = TTSModule;
