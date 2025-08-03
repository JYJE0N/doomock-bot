// src/services/TTSService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
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
        client_email: clientEmail
      };

      // TTS 클라이언트 생성
      this.client = new TextToSpeechClient({
        credentials: credentials,
        projectId: projectId
      });

      logger.info("✅ Google TTS 클라이언트 초기화 완료");

      await this.fileHelper.initialize();

      // 주기적으로 오래된 파일 정리
      setInterval(
        () => {
          this.fileHelper.cleanupOldFiles().catch((err) => logger.error("파일 정리 실패:", err));
        },
        60 * 60 * 1000
      ); // 1시간마다

      logger.success("✅ TTSService 초기화 완료");
    } catch (error) {
      logger.error("TTSService 초기화 실패:", error);
      throw error;
    }
  }

  async convertTextToSpeech(userId, options) {
    const { text, language = "ko-KR" } = options;

    try {
      // 텍스트 유효성 검사
      if (!text || typeof text !== "string") {
        throw new Error("변환할 텍스트가 없습니다.");
      }

      // 텍스트 길이 검사
      if (text.length > 5000) {
        throw new Error("텍스트가 너무 깁니다. (최대 5000자)");
      }

      // 음성 코드 가져오기
      const voiceCode = this.getUserVoice(userId) || this.voiceConfig.getDefaultVoice(language);

      // 음성 정보 가져오기 및 검증
      const voice = this.voiceConfig.getVoiceByCode(voiceCode);
      if (!voice) {
        logger.warn(`음성 코드를 찾을 수 없음: ${voiceCode}, 기본값 사용`);
        const defaultVoiceCode = this.voiceConfig.getDefaultVoice(language);
        const defaultVoice = this.voiceConfig.getVoiceByCode(defaultVoiceCode);

        if (!defaultVoice) {
          throw new Error(`기본 음성도 찾을 수 없습니다: ${defaultVoiceCode}`);
        }

        voice = defaultVoice;
      }

      // SSML 성별 매핑 (안전한 처리)
      let ssmlGender = "NEUTRAL";
      if (voice.gender) {
        if (voice.gender.toLowerCase() === "male") {
          ssmlGender = "MALE";
        } else if (voice.gender.toLowerCase() === "female") {
          ssmlGender = "FEMALE";
        }
      }

      // Google TTS 요청
      const request = {
        input: { text },
        voice: {
          languageCode: language,
          name: voice.code || voiceCode, // voice.code가 있으면 사용, 없으면 voiceCode 사용
          ssmlGender: ssmlGender
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0.0,
          volumeGainDb: 0.0
        }
      };

      logger.debug("🎤 TTS 변환 요청:", {
        text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
        voice: voice.code || voiceCode,
        voiceName: voice.name,
        language,
        gender: ssmlGender
      });

      // TTS API 호출
      const [response] = await this.client.synthesizeSpeech(request);

      if (!response || !response.audioContent) {
        throw new Error("TTS API 응답이 비어있습니다.");
      }

      // 파일 저장
      const fileName = this.fileHelper.generateFileName(userId, text);
      const filePaths = await this.fileHelper.saveAudioFile(response.audioContent, fileName);

      // 히스토리 저장 (실패해도 계속 진행)
      try {
        if (this.models.TTSHistory) {
          await this.saveHistory(userId, {
            text,
            language,
            voice: voice.name,
            voiceCode: voice.code || voiceCode,
            fileName,
            shareUrl: filePaths.shareUrl
          });
        }
      } catch (historyError) {
        logger.error("히스토리 저장 실패 (무시하고 계속):", historyError);
      }

      logger.info(`✅ TTS 변환 성공: ${fileName}`);

      return this.createSuccessResponse({
        audioFile: filePaths.tempPath,
        shareUrl: filePaths.shareUrl,
        voice: voice.name,
        duration: Math.ceil(text.length / 5) // 대략적인 재생 시간 추정
      });
    } catch (error) {
      logger.error("TTS 변환 실패:", error);

      // 에러 메시지 개선
      let errorMessage = "TTS 변환 중 오류가 발생했습니다";

      if (error.message.includes("인증")) {
        errorMessage = "Google TTS 인증에 실패했습니다. 관리자에게 문의하세요.";
      } else if (error.message.includes("길이")) {
        errorMessage = error.message;
      } else if (error.message.includes("텍스트")) {
        errorMessage = error.message;
      } else if (error.code === "PERMISSION_DENIED") {
        errorMessage = "TTS API 권한이 없습니다. 관리자에게 문의하세요.";
      } else if (error.code === "RESOURCE_EXHAUSTED") {
        errorMessage = "TTS API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.";
      }

      return this.createErrorResponse(error, errorMessage);
    }
  }

  getUserVoice(userId) {
    if (!userId) return null;
    return this.userVoices.get(userId.toString());
  }

  async setUserVoice(userId, voiceCode) {
    if (!userId || !voiceCode) {
      throw new Error("사용자 ID와 음성 코드가 필요합니다.");
    }

    // 음성 코드 유효성 검사
    const voice = this.voiceConfig.getVoiceByCode(voiceCode);
    if (!voice) {
      return this.createErrorResponse(new Error(`유효하지 않은 음성 코드: ${voiceCode}`), "선택한 음성을 찾을 수 없습니다.");
    }

    this.userVoices.set(userId.toString(), voiceCode);
    logger.info(`🎤 사용자 ${userId} 음성 변경: ${voiceCode} (${voice.name})`);

    return this.createSuccessResponse({
      voiceCode,
      voiceName: voice.name,
      voiceDescription: voice.description
    });
  }

  async getUserStats(userId) {
    try {
      const stats = {
        totalConversions: 0,
        currentVoice: null,
        currentVoiceName: null,
        lastConversion: null
      };

      // 현재 음성 정보
      const currentVoiceCode = this.getUserVoice(userId);
      if (currentVoiceCode) {
        const voice = this.voiceConfig.getVoiceByCode(currentVoiceCode);
        stats.currentVoice = currentVoiceCode;
        stats.currentVoiceName = voice ? voice.name : "알 수 없음";
      }

      // DB에서 통계 조회
      if (this.models.TTSHistory) {
        stats.totalConversions = await this.models.TTSHistory.countDocuments({
          userId: userId.toString()
        });

        // 마지막 변환 정보
        const lastConversion = await this.models.TTSHistory.findOne({
          userId: userId.toString()
        })
          .sort({ createdAt: -1 })
          .select("createdAt");

        if (lastConversion) {
          stats.lastConversion = lastConversion.createdAt;
        }
      }

      return this.createSuccessResponse(stats);
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return this.createSuccessResponse({
        totalConversions: 0,
        currentVoice: this.getUserVoice(userId),
        currentVoiceName: null,
        lastConversion: null
      });
    }
  }

  async saveHistory(userId, data) {
    try {
      if (!this.models.TTSHistory) {
        logger.warn("TTSHistory 모델 없음 - 히스토리 저장 스킵");
        return;
      }

      // 필수 필드 검증
      const historyData = {
        userId: userId.toString(),
        text: data.text,
        language: data.language,
        voice: data.voice,
        voiceCode: data.voiceCode,
        fileName: data.fileName,
        shareUrl: data.shareUrl,
        createdAt: new Date()
      };

      await this.models.TTSHistory.create(historyData);
      logger.debug(`TTS 히스토리 저장 완료: ${userId}`);
    } catch (error) {
      logger.error("히스토리 저장 실패:", error);
      // 히스토리 저장 실패는 무시하고 계속 진행
    }
  }

  // 정리 메서드 추가
  async cleanup() {
    try {
      // 사용자 음성 설정 캐시 정리
      this.userVoices.clear();

      // 파일 정리
      await this.fileHelper.cleanupOldFiles();

      logger.info("✅ TTSService 정리 완료");
    } catch (error) {
      logger.error("TTSService 정리 실패:", error);
    }

    await super.cleanup();
  }
}

module.exports = TTSService;
