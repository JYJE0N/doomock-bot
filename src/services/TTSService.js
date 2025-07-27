const logger = require("../utils/Logger");

const { getInstance } = require("../database/DatabaseManager");

class TTSService {
  constructor(options = {}) {
    this.dbManager = getInstance(); // 👈 이 부분!

    this.apiKey = options.apiKey;
    this.config = {
      maxTextLength: 500,
      voice: "ko-KR-Standard-A",
      ...options.config,
    };

    logger.info("🔧 TTSService", "서비스 생성");
  }

  async initialize() {
    await this.dbManager.ensureConnection(); // 👈 이 부분!

    if (!this.apiKey) {
      logger.warn("TTS API 키가 설정되지 않음");
    }
    logger.success("TTSService 초기화 완료");
  }

  async convertToSpeech(text) {
    try {
      if (text.length > this.config.maxTextLength) {
        throw new Error(
          `텍스트는 ${this.config.maxTextLength}자 이하여야 합니다.`
        );
      }

      // 실제 TTS API 호출 대신 더미 응답
      // 실제 구현시에는 Google TTS API나 AWS Polly 등을 사용
      const audioBuffer = Buffer.from("dummy audio data");

      logger.data("tts", "convert", null, { textLength: text.length });
      return audioBuffer;
    } catch (error) {
      logger.error("TTS 변환 실패", error);
      throw error;
    }
  }

  async cleanup() {
    logger.info("TTSService 정리 완료");
  }
}

module.exports = TTSService;
