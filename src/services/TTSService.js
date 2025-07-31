const BaseService = require("./BaseService");

/**
 * 🔊 TTSService - 음성 변환 서비스 (심플 버전)
 */
class TTSService extends BaseService {
  constructor(options = {}) {
    super("TTSService", options);

    // 임시 메모리 저장소 (나중에 실제 TTS API 연동)
    this.conversionHistory = new Map(); // userId -> records[]
    this.userSettings = new Map(); // userId -> settings

    // 모의 TTS 설정
    this.isConnected = false; // 실제 API 연결 상태
  }

  getRequiredModels() {
    return []; // 나중에 ["TTSHistory", "TTSSettings"] 추가
  }

  async onInitialize() {
    // 실제 환경에서는 Google Cloud TTS 클라이언트 초기화
    this.isConnected = !!process.env.GOOGLE_CLOUD_PROJECT_ID;
    logger.info(`🔊 TTSService 초기화 완료 (Connected: ${this.isConnected})`);
  }

  /**
   * 텍스트를 음성으로 변환
   */
  async convertTextToSpeech(userId, conversionData) {
    try {
      const { text, language, voice } = conversionData;

      // 실제 환경에서는 Google Cloud TTS API 호출
      if (!this.isConnected) {
        // 모의 변환 (개발용)
        return this.createSuccessResponse(
          {
            audioFile: null, // 실제로는 음성 파일 경로
            duration: Math.ceil(text.length / 10), // 예상 재생 시간 (초)
            fileSize: text.length * 100, // 예상 파일 크기 (바이트)
            message: "TTS API가 연결되지 않아 모의 변환을 수행했습니다.",
          },
          "음성 변환이 완료되었습니다."
        );
      }

      // 변환 기록 저장
      const record = {
        _id: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId.toString(),
        text: text.substring(0, 100), // 처음 100자만 저장
        language: language,
        voice: voice,
        duration: Math.ceil(text.length / 10),
        createdAt: new Date(),
      };

      const userHistory = this.conversionHistory.get(userId.toString()) || [];
      userHistory.push(record);
      this.conversionHistory.set(userId.toString(), userHistory);

      return this.createSuccessResponse(
        {
          audioFile: `/tmp/tts_${record._id}.ogg`, // 모의 파일 경로
          duration: record.duration,
          fileSize: text.length * 100,
          recordId: record._id,
        },
        "음성 변환이 완료되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "음성 변환 실패");
    }
  }

  /**
   * 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      const history = this.conversionHistory.get(userId.toString()) || [];
      const settings = this.userSettings.get(userId.toString()) || {};

      const totalConversions = history.length;
      const totalDuration = history.reduce(
        (sum, record) => sum + (record.duration || 0),
        0
      );
      const lastConversion =
        history.length > 0 ? history[history.length - 1].createdAt : null;

      return this.createSuccessResponse({
        totalConversions,
        totalDuration,
        lastConversion,
        favoriteVoice: settings.favoriteVoice || "ko-KR-Wavenet-A",
        averageTextLength:
          history.length > 0
            ? Math.round(
                history.reduce((sum, r) => sum + r.text.length, 0) /
                  history.length
              )
            : 0,
      });
    } catch (error) {
      return this.createErrorResponse(error, "통계 조회 실패");
    }
  }

  /**
   * 변환 이력 조회
   */
  async getConversionHistory(userId, options = {}) {
    try {
      const { limit = 20 } = options;
      const history = this.conversionHistory.get(userId.toString()) || [];

      const recentHistory = history
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);

      return this.createSuccessResponse({
        records: recentHistory,
        totalCount: history.length,
      });
    } catch (error) {
      return this.createErrorResponse(error, "이력 조회 실패");
    }
  }

  /**
   * 사용자 음성 설정
   */
  async setUserVoice(userId, voiceCode) {
    try {
      const settings = this.userSettings.get(userId.toString()) || {};
      settings.favoriteVoice = voiceCode;
      settings.updatedAt = new Date();

      this.userSettings.set(userId.toString(), settings);

      return this.createSuccessResponse(
        { voiceCode },
        "음성이 설정되었습니다."
      );
    } catch (error) {
      return this.createErrorResponse(error, "음성 설정 실패");
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      isConnected: this.isConnected,
      totalUsers: this.conversionHistory.size,
      totalConversions: Array.from(this.conversionHistory.values()).reduce(
        (sum, history) => sum + history.length,
        0
      ),
    };
  }
}

module.exports = TTSService;
