// src/services/TTSService.js - Google Cloud TTS API 수정
const BaseService = require("./BaseService");
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs").promises;
const path = require("path");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🔊 TTS 서비스 - Google Cloud Text-to-Speech API 사용
 * - Railway 환경 최적화
 * - @google-cloud/text-to-speech 사용
 */
class TTSService extends BaseService {
  constructor() {
    super();

    // Google Cloud TTS 클라이언트 초기화
    this.ttsClient = new textToSpeech.TextToSpeechClient();

    // 사용자별 설정
    this.userModes = new Map();
    this.userLanguages = new Map();
    this.activeRequests = new Map();

    // 지원 언어 목록 (Google Cloud TTS 기준)
    this.supportedLanguages = {
      ko: { name: "한국어", code: "ko-KR", voice: "ko-KR-Standard-A" },
      en: { name: "English", code: "en-US", voice: "en-US-Standard-A" },
      ja: { name: "日本語", code: "ja-JP", voice: "ja-JP-Standard-A" },
      zh: { name: "中文", code: "zh-CN", voice: "zh-CN-Standard-A" },
      es: { name: "Español", code: "es-ES", voice: "es-ES-Standard-A" },
      fr: { name: "Français", code: "fr-FR", voice: "fr-FR-Standard-A" },
      de: { name: "Deutsch", code: "de-DE", voice: "de-DE-Standard-A" },
      it: { name: "Italiano", code: "it-IT", voice: "it-IT-Standard-A" },
      pt: { name: "Português", code: "pt-BR", voice: "pt-BR-Standard-A" },
      ru: { name: "Русский", code: "ru-RU", voice: "ru-RU-Standard-A" },
    };

    // Railway 환경 최적화
    this.tempDir = this.getTempDirectory();
    this.ensureTempDir();

    // 설정
    this.TTS_TIMEOUT = 30000; // 30초
    this.MAX_RETRIES = 3;
    this.MAX_TEXT_LENGTH = 5000; // Google Cloud TTS는 더 긴 텍스트 지원
  }

  /**
   * OS별 임시 디렉토리 설정
   */
  getTempDirectory() {
    if (process.env.RAILWAY_ENVIRONMENT) {
      return "/tmp/tts";
    }
    const os = require("os");
    return path.join(os.tmpdir(), "doomock-tts");
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`✅ TTS 임시 디렉토리 생성: ${this.tempDir}`);
    } catch (error) {
      logger.error("❌ TTS 임시 디렉토리 생성 실패:", error);
      this.tempDir = require("os").tmpdir();
    }
  }

  /**
   * 🎯 TTS 변환 (Google Cloud Text-to-Speech 사용)
   */
  async convertTextToSpeech(text, language = "ko", userId = null) {
    let retries = 0;

    while (retries < this.MAX_RETRIES) {
      try {
        // 텍스트 검증
        if (!text || text.trim().length === 0) {
          return { success: false, message: "변환할 텍스트를 입력해주세요." };
        }

        // 언어 검증
        if (!this.supportedLanguages[language]) {
          language = "ko";
        }

        const languageConfig = this.supportedLanguages[language];

        // 텍스트 길이 확인
        if (text.length > this.MAX_TEXT_LENGTH) {
          return {
            success: false,
            message: `텍스트가 너무 깁니다. (최대 ${this.MAX_TEXT_LENGTH}자)`,
          };
        }

        // 파일명 생성
        const timestamp = Date.now();
        const fileName = `tts_${userId || "unknown"}_${timestamp}.mp3`;
        const filePath = path.join(this.tempDir, fileName);

        // 활성 요청 등록
        if (userId) {
          await this.stopTTS(userId);
          this.activeRequests.set(userId, {
            text,
            language,
            filePath,
            startTime: new Date(),
            status: "processing",
            retryCount: retries,
          });
        }

        logger.info(`🔄 TTS 변환 시작 (Google Cloud):`, {
          userId,
          language,
          textLength: text.length,
          voice: languageConfig.voice,
        });

        // Google Cloud TTS 요청 구성
        const request = {
          input: { text: text },
          voice: {
            languageCode: languageConfig.code,
            name: languageConfig.voice,
            ssmlGender: "NEUTRAL",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
          },
        };

        // TTS 변환 실행
        const [response] = await this.ttsClient.synthesizeSpeech(request);

        // 오디오 파일 저장
        await fs.writeFile(filePath, response.audioContent, "binary");

        // 파일 생성 검증
        const fileExists = await this.verifyFileCreation(filePath);

        if (fileExists) {
          // 성공 처리
          if (userId && this.activeRequests.has(userId)) {
            const request = this.activeRequests.get(userId);
            request.status = "completed";
            request.completedAt = new Date();
          }

          logger.success("✅ TTS 변환 성공:", {
            userId,
            language,
            filePath,
            voice: languageConfig.voice,
          });

          return {
            success: true,
            filePath,
            language,
            languageCode: languageConfig.code,
            voice: languageConfig.voice,
            text,
            fileName,
            size: await this.getFileSize(filePath),
            retries: retries + 1,
          };
        } else {
          throw new Error("음성 파일이 생성되지 않았습니다.");
        }
      } catch (error) {
        retries++;

        logger.warn(`⚠️ TTS 변환 실패 (시도 ${retries}/${this.MAX_RETRIES}):`, {
          userId,
          error: error.message,
          willRetry: retries < this.MAX_RETRIES,
        });

        if (retries < this.MAX_RETRIES) {
          const delay = Math.pow(2, retries - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 모든 재시도 실패
        if (userId) {
          this.activeRequests.delete(userId);
        }

        return {
          success: false,
          message: this.getFriendlyErrorMessage(error),
          retries,
        };
      }
    }
  }

  /**
   * 파일 생성 검증
   */
  async verifyFileCreation(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 파일 크기 조회
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 안전한 파일 정리
   */
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.debug(`🗑️ TTS 임시 파일 삭제: ${path.basename(filePath)}`);
    } catch (error) {
      logger.debug(`파일 삭제 무시: ${error.message}`);
    }
  }

  /**
   * 사용자 친화적 에러 메시지
   */
  getFriendlyErrorMessage(error) {
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes("timeout")) {
      return "⏱️ 변환 시간이 초과되었습니다. 텍스트를 줄여서 다시 시도해주세요.";
    } else if (errorMsg.includes("network") || errorMsg.includes("connect")) {
      return "🌐 네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.";
    } else if (errorMsg.includes("invalid") || errorMsg.includes("language")) {
      return "🔤 지원하지 않는 언어이거나 텍스트에 문제가 있습니다.";
    } else if (errorMsg.includes("quota") || errorMsg.includes("limit")) {
      return "📊 일일 사용량이 초과되었습니다. 내일 다시 시도해주세요.";
    } else if (
      errorMsg.includes("authentication") ||
      errorMsg.includes("credentials")
    ) {
      return "🔐 인증에 문제가 있습니다. 관리자에게 문의하세요.";
    } else {
      return "❌ TTS 변환 중 오류가 발생했습니다. 다시 시도해주세요.";
    }
  }

  // ===== 기존 메서드들 (호환성 유지) =====

  setTTSMode(userId, mode) {
    if (!["AUTO", "MANUAL", "OFF"].includes(mode)) {
      throw new Error("유효하지 않은 TTS 모드입니다.");
    }
    this.userModes.set(userId.toString(), mode);
    return { success: true, mode };
  }

  getTTSMode(userId) {
    return this.userModes.get(userId.toString()) || "OFF";
  }

  setUserLanguage(userId, language) {
    if (!this.supportedLanguages[language]) {
      return { success: false, message: "지원하지 않는 언어입니다." };
    }
    this.userLanguages.set(userId.toString(), language);
    return {
      success: true,
      language,
      languageName: this.supportedLanguages[language].name,
      voice: this.supportedLanguages[language].voice,
    };
  }

  getUserLanguage(userId) {
    return this.userLanguages.get(userId.toString()) || "ko";
  }

  getSupportedLanguages() {
    const languages = {};
    for (const [code, config] of Object.entries(this.supportedLanguages)) {
      languages[code] = {
        name: config.name,
        voice: config.voice,
        languageCode: config.code,
      };
    }
    return languages;
  }

  async stopTTS(userId) {
    try {
      const activeRequest = this.activeRequests.get(userId);

      if (!activeRequest) {
        return { success: false, message: "진행 중인 TTS 작업이 없습니다." };
      }

      activeRequest.status = "stopped";
      activeRequest.stoppedAt = new Date();

      if (activeRequest.filePath) {
        await this.cleanupFile(activeRequest.filePath);
      }

      this.activeRequests.delete(userId);

      logger.info("🛑 TTS 작업 정지:", { userId });

      return {
        success: true,
        message: "TTS 작업이 정지되었습니다.",
      };
    } catch (error) {
      logger.error("TTS 정지 오류:", error);
      return { success: false, message: "TTS 정지 중 오류가 발생했습니다." };
    }
  }

  async cleanupAllFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const ttsFiles = files.filter(
        (file) => file.startsWith("tts_") && file.endsWith(".mp3")
      );

      const cleanupPromises = ttsFiles.map((file) =>
        this.cleanupFile(path.join(this.tempDir, file))
      );

      await Promise.all(cleanupPromises);
      logger.info(`🧹 TTS 임시 파일 ${ttsFiles.length}개 정리 완료`);
    } catch (error) {
      logger.error("TTS 임시 파일 정리 오류:", error);
    }
  }

  getServiceStatus() {
    return {
      activeRequests: this.activeRequests.size,
      totalUsers: this.userModes.size,
      supportedLanguages: Object.keys(this.supportedLanguages).length,
      tempDirectory: this.tempDir,
      timeout: this.TTS_TIMEOUT,
      maxRetries: this.MAX_RETRIES,
      maxTextLength: this.MAX_TEXT_LENGTH,
      environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
      apiType: "Google Cloud Text-to-Speech",
    };
  }

  async shutdown() {
    for (const userId of this.activeRequests.keys()) {
      await this.stopTTS(userId);
    }
    await this.cleanupAllFiles();
    logger.info("🛑 TTS 서비스 정리 완료");
  }
}

module.exports = TTSService;
