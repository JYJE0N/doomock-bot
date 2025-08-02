// src/services/TTSService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const textToSpeech = require("@google-cloud/text-to-speech");
const TTSFileHelper = require("../utils/TTSFileHelper");
const TTSVoiceConfig = require("../config/TTSVoiceConfig");

class TTSService extends BaseService {
  constructor(options = {}) {
    super("TTSService", options);

    this.client = null;
    this.fileHelper = new TTSFileHelper();
    this.voiceConfig = new TTSVoiceConfig();

    this.userVoices = new Map();
  }

  getRequiredModels() {
    return ["TTSHistory"];
  }

  async onInitialize() {
    try {
      // 환경변수에서 필수 정보 가져오기
      const projectId = process.env.GOOGLE_PROJECT_ID;
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Google Cloud TTS 인증 정보가 부족합니다.");
      }

      // 최소한의 credentials 객체 생성
      const credentials = {
        type: "service_account",
        project_id: projectId,
        private_key: privateKey,
        client_email: clientEmail,
      };

      // TTS 클라이언트 생성
      this.client = new textToSpeech.TextToSpeechClient({
        credentials: credentials,
        projectId: projectId,
      });

      logger.info("✅ Google TTS 클라이언트 초기화 완료");

      await this.fileHelper.initialize();

      // 주기적으로 오래된 파일 정리
      setInterval(() => {
        this.fileHelper
          .cleanupOldFiles()
          .catch((err) => logger.error("파일 정리 실패:", err));
      }, 60 * 60 * 1000); // 1시간마다

      logger.success("✅ TTSService 초기화 완료");
    } catch (error) {
      logger.error("TTSService 초기화 실패:", error);
      throw error;
    }
  }

  async convertTextToSpeech(userId, options) {
    const { text, language = "ko-KR" } = options;

    try {
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
          volumeGainDb: 0.0,
        },
      };

      logger.debug("🎤 TTS 변환 요청:", {
        text: text.substring(0, 50) + "...",
        voice: voiceCode,
        language,
      });

      const [response] = await this.client.synthesizeSpeech(request);

      // 파일 저장
      const fileName = this.fileHelper.generateFileName(userId, text);
      const filePaths = await this.fileHelper.saveAudioFile(
        response.audioContent,
        fileName
      );

      // 히스토리 저장
      if (this.models.TTSHistory) {
        await this.saveHistory(userId, {
          text,
          language,
          voice: voice.name,
          voiceCode,
          fileName,
          shareUrl: filePaths.shareUrl,
        });
      }

      logger.info(`✅ TTS 변환 성공: ${fileName}`);

      return this.createSuccessResponse({
        audioFile: filePaths.tempPath,
        shareUrl: filePaths.shareUrl,
        voice: voice.name,
        duration: Math.ceil(text.length / 5),
      });
    } catch (error) {
      logger.error("TTS 변환 실패:", error);
      return this.createErrorResponse(error, "TTS 변환 중 오류가 발생했습니다");
    }
  }

  getUserVoice(userId) {
    return this.userVoices.get(userId);
  }

  async setUserVoice(userId, voiceCode) {
    this.userVoices.set(userId, voiceCode);
    logger.info(`🎤 사용자 ${userId} 음성 변경: ${voiceCode}`);
    return this.createSuccessResponse({ voiceCode });
  }

  async getUserStats(userId) {
    try {
      if (!this.models.TTSHistory) {
        return this.createSuccessResponse({
          totalConversions: 0,
          currentVoice: this.getUserVoice(userId),
        });
      }

      const count = await this.models.TTSHistory.countDocuments({ userId });

      return this.createSuccessResponse({
        totalConversions: count,
        currentVoice: this.getUserVoice(userId),
      });
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return this.createSuccessResponse({
        totalConversions: 0,
        currentVoice: this.getUserVoice(userId),
      });
    }
  }

  async saveHistory(userId, data) {
    try {
      if (!this.models.TTSHistory) {
        logger.warn("TTSHistory 모델 없음 - 히스토리 저장 스킵");
        return;
      }

      await this.models.TTSHistory.create({
        userId,
        ...data,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error("히스토리 저장 실패:", error);
    }
  }
}

module.exports = TTSService;
