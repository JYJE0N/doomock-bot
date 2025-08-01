// src/services/TTSService.js - logger 오류 수정
const BaseService = require("./BaseService");
const logger = require("../utils/Logger"); // ✅ 이 줄 추가!
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔊 TTSService - 텍스트 음성 변환 서비스 (logger 수정)
 */
class TTSService extends BaseService {
  constructor(options = {}) {
    super("TTSService", options);

    this.config = {
      provider: process.env.TTS_PROVIDER || "mock", // mock, google, openai
      maxTextLength: 1000,
      defaultLanguage: "ko-KR",
      ...options.config,
    };

    logger.info("🔊 TTSService 생성됨"); // ✅ 이제 작동함
  }

  getRequiredModels() {
    return ["TTSHistory"];
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    // logger 사용 가능
    logger.success("✅ TTSService 초기화 완료");
  }

  /**
   * 🎤 텍스트를 음성으로 변환
   */
  async convertTextToSpeech(userId, options) {
    const { text, language = "ko-KR", voice = "default" } = options;

    try {
      logger.info(`🎤 TTS 변환 요청: ${userId} (${text.length}자)`);

      // Mock 구현 (실제로는 Google TTS API 등 사용)
      const mockResult = {
        audioFile: `/tmp/tts_${userId}_${Date.now()}.mp3`,
        duration: Math.ceil(text.length / 10), // 대략적인 계산
        fileSize: text.length * 50, // Mock 파일 크기
        text: text,
        voice: voice,
        language: language,
      };

      return this.createSuccessResponse(mockResult, "TTS 변환 완료");
    } catch (error) {
      logger.error("TTS 변환 실패:", error);
      return this.createErrorResponse(error, "TTS 변환 중 오류 발생");
    }
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      // Mock 통계
      const mockStats = {
        totalConversions: Math.floor(Math.random() * 100),
        totalDuration: Math.floor(Math.random() * 3600),
        favoriteLanguage: "ko-KR",
        lastUsed: TimeHelper.now(),
      };

      return this.createSuccessResponse(mockStats, "통계 조회 완료");
    } catch (error) {
      logger.error("통계 조회 실패:", error);
      return this.createErrorResponse(error, "통계 조회 중 오류 발생");
    }
  }

  /**
   * 📋 사용자 히스토리 조회
   */
  async getUserHistory(userId, limit = 10) {
    try {
      // Mock 히스토리
      const mockHistory = Array.from(
        { length: Math.min(limit, 5) },
        (_, i) => ({
          id: `tts_${userId}_${i}`,
          text: `변환된 텍스트 ${i + 1}`,
          voice: "ko-KR-Wavenet-A",
          duration: 30 + i * 10,
          createdAt: new Date(Date.now() - i * 3600000),
        })
      );

      return this.createSuccessResponse(mockHistory, "히스토리 조회 완료");
    } catch (error) {
      logger.error("히스토리 조회 실패:", error);
      return this.createErrorResponse(error, "히스토리 조회 중 오류 발생");
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      provider: this.config.provider,
      maxTextLength: this.config.maxTextLength,
      defaultLanguage: this.config.defaultLanguage,
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    await super.cleanup();
    logger.info("✅ TTSService 정리 완료");
  }
}

module.exports = TTSService;
