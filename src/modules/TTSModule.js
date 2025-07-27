const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper"); // ✅ 추가

class TTSModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TTSModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });
    this.serviceBuilder = options.serviceBuilder || null;

    this.ttsService = null;
    this.config = {
      apiKey: process.env.TTS_API_KEY,
      maxTextLength: parseInt(process.env.MAX_TTS_LENGTH) || 500,
      ...options.config,
    };

    logger.module("TTSModule", "모듈 생성", { version: "3.0.1" });
  }

  async onInitialize() {
    try {
      this.ttsService = await this.serviceBuilder.getOrCreate("tts", {
        config: this.config,
      });

      // this.ttsService = new TTSService({
      //   apiKey: this.config.apiKey,
      //   config: this.config,
      // });
      await this.ttsService.initialize();
      logger.success("TTSModule 초기화 완료");
    } catch (error) {
      logger.error("TTSModule 초기화 실패", error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      convert: this.convertText,
      help: this.showHelp,
    });
  }

  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;
    if (!text) return false;

    const command = this.extractCommand(text);
    if (command === "tts" || command === "음성변환") {
      await this.moduleManager.navigationHandler.sendModuleMenu(
        bot,
        chatId,
        "tts"
      );
      return true;
    }

    // TTS 입력 대기 상태 처리
    const {
      from: { id: userId },
    } = msg;
    const userState = this.getUserState(userId);
    if (userState && userState.waitingFor === "tts_text") {
      return await this.handleTextInput(bot, msg, text);
    }

    return false;
  }

  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from); // ✅ 이제 작동함

    try {
      const stats = await this.ttsService.convertToSpeech(text);
    } catch (error) {
      return {
        type: "error",
        message: error.message, // ← 서비스의 에러 메시지 그대로 활용
      };
    }
  }

  async convertText(bot, callbackQuery, subAction, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    this.setUserState(userId, {
      waitingFor: "tts_text",
      action: "convert",
    });

    return {
      type: "input",
      module: "tts",
      message: "음성으로 변환할 텍스트를 입력하세요:",
    };
  }

  async handleTextInput(bot, msg, text) {
    const {
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    try {
      if (text.length > this.config.maxTextLength) {
        throw new Error(
          `텍스트는 ${this.config.maxTextLength}자 이하여야 합니다.`
        );
      }

      const audioFile = await this.ttsService.convertToSpeech(text);

      // 음성 파일 전송
      await bot.sendVoice(chatId, audioFile);

      this.clearUserState(userId);
      logger.success("TTS 변환 완료", { userId, textLength: text.length });
      return true;
    } catch (error) {
      logger.error("TTS 변환 실패", error);
      await this.moduleManager.navigationHandler.sendError(
        bot,
        chatId,
        "음성 변환에 실패했습니다."
      );
      return false;
    }
  }

  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "tts",
      data: {
        title: "TTS 도움말",
        features: ["텍스트 음성 변환"],
        commands: ["/tts - TTS 메뉴"],
      },
    };
  }
}

module.exports = TTSModule; // ✅ 필수!
