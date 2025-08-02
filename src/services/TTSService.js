// src/services/TTSService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const textToSpeech = require("@google-cloud/text-to-speech");
const TTSFileHelper = require("../utils/TTSFileHelper");
const TTSVoiceConfig = require("../config/TTSVoiceConfig");

class TTSService extends BaseService {
  constructor(options = {}) {
    super("TTSService", options);

    this.client = new textToSpeech.TextToSpeechClient();
    this.fileHelper = new TTSFileHelper();
    this.voiceConfig = new TTSVoiceConfig();

    this.userVoices = new Map(); // 사용자별 음성 설정
  }

  async onInitialize() {
    await this.fileHelper.initialize();

    // 주기적으로 오래된 파일 정리
    setInterval(() => {
      this.fileHelper
        .cleanupOldFiles()
        .catch((err) => logger.error("파일 정리 실패:", err));
    }, 60 * 60 * 1000); // 1시간마다

    logger.success("✅ TTSService 초기화 완료");
  }

  async convertTextToSpeech(userId, options) {
    const { text, language = "ko-KR" } = options;

    try {
      // 사용자 음성 설정 가져오기
      const voiceCode =
        this.getUserVoice(userId) || this.voiceConfig.getDefaultVoice(language);

      const voice = this.voiceConfig.getVoiceByCode(voiceCode);

      // Google TTS 요청
      const request = {
        input: { text },
        voice: {
          languageCode: language,
          name: voiceCode,
          ssmlGender: voice.gender === "male" ? "MALE" : "FEMALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      // 파일 저장
      const fileName = this.fileHelper.generateFileName(userId, text);
      const filePaths = await this.fileHelper.saveAudioFile(
        response.audioContent,
        fileName
      );

      // 히스토리 저장
      await this.saveHistory(userId, {
        text,
        language,
        voice: voice.name,
        voiceCode,
        fileName,
        shareUrl: filePaths.shareUrl,
      });

      return this.createSuccessResponse({
        audioFile: filePaths.tempPath,
        shareUrl: filePaths.shareUrl,
        voice: voice.name,
        duration: Math.ceil(text.length / 5), // 대략적인 계산
      });
    } catch (error) {
      logger.error("TTS 변환 실패:", error);
      return this.createErrorResponse(error);
    }
  }

  getUserVoice(userId) {
    return this.userVoices.get(userId);
  }

  async setUserVoice(userId, voiceCode) {
    this.userVoices.set(userId, voiceCode);
    return this.createSuccessResponse({ voiceCode });
  }

  async saveHistory(userId, data) {
    try {
      const TTSHistory = this.models.TTSHistory;
      await TTSHistory.create({
        userId,
        ...data,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error("히스토리 저장 실패:", error);
    }
  }

  async getUserStats(userId) {
    try {
      const TTSHistory = this.models.TTSHistory;
      const count = await TTSHistory.countDocuments({ userId });

      return this.createSuccessResponse({
        totalConversions: count,
        currentVoice: this.getUserVoice(userId),
      });
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }
}

module.exports = TTSService;
