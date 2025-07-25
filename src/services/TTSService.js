// src/services/TTSService.js - google-tts-api 버전
const BaseService = require("./BaseService");
const googleTTS = require("google-tts-api");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🎤 TTS 서비스 - google-tts-api 버전
 * - 무료 Google TTS 사용
 * - 200자 제한 (분할 처리)
 * - Railway 환경 최적화
 */
class TTSService extends BaseService {
  constructor() {
    super();

    // 사용자별 설정
    this.userModes = new Map();
    this.userLanguages = new Map();
    this.activeRequests = new Map();

    // 지원 언어 목록
    this.supportedLanguages = {
      ko: "한국어",
      en: "English",
      ja: "日本語",
      zh: "中文",
      es: "Español",
      fr: "Français",
      de: "Deutsch",
      it: "Italiano",
      pt: "Português",
      ru: "Русский",
    };

    // Railway 환경 최적화
    this.tempDir = this.getTempDirectory();
    this.ensureTempDir();

    // 설정
    this.TTS_TIMEOUT = 30000; // 30초
    this.MAX_RETRIES = 3;
    this.MAX_TEXT_LENGTH = 200; // google-tts-api 제한
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
   * 🎯 TTS 변환 (google-tts-api 사용)
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

        // 텍스트 분할 (200자 제한)
        const chunks = this.splitText(text, this.MAX_TEXT_LENGTH);

        if (chunks.length > 3) {
          return {
            success: false,
            message: `텍스트가 너무 깁니다. (최대 ${
              this.MAX_TEXT_LENGTH * 3
            }자)`,
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

        logger.info(`🔄 TTS 변환 시작 (google-tts-api):`, {
          userId,
          language,
          textLength: text.length,
          chunks: chunks.length,
        });

        // 청크별로 처리
        const audioUrls = [];

        for (const chunk of chunks) {
          const url = await googleTTS.getAudioUrl(chunk, {
            lang: language,
            slow: false,
            host: "https://translate.google.com",
            timeout: 10000,
          });
          audioUrls.push(url);
        }

        // 오디오 다운로드 및 병합
        await this.downloadAndMergeAudio(audioUrls, filePath);

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
            chunks: chunks.length,
          });

          return {
            success: true,
            filePath,
            language,
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
   * 텍스트 분할 (200자 제한)
   */
  splitText(text, maxLength) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence + " ";
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + " ";
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 오디오 다운로드 및 병합
   */
  async downloadAndMergeAudio(urls, outputPath) {
    const tempFiles = [];

    try {
      // 각 URL에서 오디오 다운로드
      for (let i = 0; i < urls.length; i++) {
        const tempFile = path.join(this.tempDir, `temp_${Date.now()}_${i}.mp3`);

        const response = await axios.get(urls[i], {
          responseType: "stream",
          timeout: 10000,
        });

        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        tempFiles.push(tempFile);
      }

      // 단일 파일인 경우 그냥 이동
      if (tempFiles.length === 1) {
        await fs.rename(tempFiles[0], outputPath);
      } else {
        // 여러 파일인 경우 병합 (간단한 방법)
        const buffers = [];
        for (const file of tempFiles) {
          const buffer = await fs.readFile(file);
          buffers.push(buffer);
        }

        const combined = Buffer.concat(buffers);
        await fs.writeFile(outputPath, combined);

        // 임시 파일 삭제
        for (const file of tempFiles) {
          await this.cleanupFile(file);
        }
      }
    } catch (error) {
      // 에러 시 임시 파일 정리
      for (const file of tempFiles) {
        await this.cleanupFile(file);
      }
      throw error;
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
      languageName: this.supportedLanguages[language],
    };
  }

  getUserLanguage(userId) {
    return this.userLanguages.get(userId.toString()) || "ko";
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
