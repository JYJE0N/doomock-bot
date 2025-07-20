// src/services/TTSService.js - Railway 환경 최적화 및 에러 처리 강화

const gtts = require("gtts");
const fs = require("fs").promises;
const path = require("path");
const { TimeHelper } = require("../utils/TimeHelper");
const logger = require("../utils/Logger");
const { getInstance } = require("../database/DatabaseManager");
const dbManager = getInstance();

class TTSService {
  constructor() {
    // 사용자별 TTS 모드 저장
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

    // ⭐ Railway 환경 최적화: OS별 임시 디렉토리
    this.tempDir = this.getTempDirectory();
    this.ensureTempDir();

    // ⭐ 타임아웃 설정
    this.TTS_TIMEOUT = 30000; // 30초
    this.MAX_RETRIES = 3;
  }

  // ⭐ OS 및 환경별 임시 디렉토리 설정
  getTempDirectory() {
    // Railway 환경에서는 /tmp 사용
    if (process.env.RAILWAY_ENVIRONMENT) {
      return "/tmp/tts";
    }

    // 로컬 환경
    const os = require("os");
    return path.join(os.tmpdir(), "doomock-tts");
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`✅ TTS 임시 디렉토리 생성: ${this.tempDir}`);
    } catch (error) {
      logger.error("❌ TTS 임시 디렉토리 생성 실패:", error);
      // Railway 환경에서는 시스템 임시 디렉토리 사용
      this.tempDir = require("os").tmpdir();
    }
  }

  // TTS 모드 설정/조회
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

  // 언어 설정/조회
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

  // ⭐ 강화된 TTS 변환 (재시도 로직 포함)
  async convertTextToSpeech(text, language = "ko", userId = null) {
    let retries = 0;

    while (retries < this.MAX_RETRIES) {
      try {
        // 텍스트 검증
        if (!text || text.trim().length === 0) {
          return { success: false, message: "변환할 텍스트를 입력해주세요." };
        }

        if (text.length > 500) {
          return {
            success: false,
            message: "텍스트는 500자 이내로 입력해주세요.",
          };
        }

        // 언어 검증
        if (!this.supportedLanguages[language]) {
          language = "ko";
        }

        // 파일명 생성 (특수문자 제거)
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

        logger.info(
          `🔄 TTS 변환 시작 (시도 ${retries + 1}/${this.MAX_RETRIES}):`,
          {
            userId,
            language,
            textLength: text.length,
            fileName,
          }
        );

        // ⭐ GTTS 인스턴스 생성 및 타임아웃 적용
        const result = await this.performTTSConversion(
          text,
          language,
          filePath
        );

        if (result.success) {
          // ⭐ 파일 생성 검증
          const fileExists = await this.verifyFileCreation(filePath);

          if (fileExists) {
            // 성공 시 활성 요청 상태 업데이트
            if (userId && this.activeRequests.has(userId)) {
              const request = this.activeRequests.get(userId);
              request.status = "completed";
              request.completedAt = new Date();
            }

            logger.success("✅ TTS 변환 성공:", {
              userId,
              language,
              filePath,
              retries: retries + 1,
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
        } else {
          throw new Error(result.error || "TTS 변환 실패");
        }
      } catch (error) {
        retries++;

        logger.warn(`⚠️ TTS 변환 실패 (시도 ${retries}/${this.MAX_RETRIES}):`, {
          userId,
          error: error.message,
          willRetry: retries < this.MAX_RETRIES,
        });

        // 마지막 시도가 아니면 재시도
        if (retries < this.MAX_RETRIES) {
          // 지수 백오프: 1초, 2초, 4초 대기
          const delay = Math.pow(2, retries - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 모든 재시도 실패 시
        if (userId) {
          this.activeRequests.delete(userId);
        }

        logger.error("❌ TTS 변환 최종 실패:", {
          userId,
          error: error.message,
          totalRetries: retries,
        });

        return {
          success: false,
          message: this.getFriendlyErrorMessage(error),
          retries,
        };
      }
    }
  }

  // ⭐ 실제 TTS 변환 수행 (타임아웃 적용)
  async performTTSConversion(text, language, filePath) {
    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeout = setTimeout(() => {
        reject(new Error("TTS 변환 타임아웃"));
      }, this.TTS_TIMEOUT);

      try {
        const gttsInstance = new gtts(text, language);

        gttsInstance.save(filePath, (err) => {
          clearTimeout(timeout);

          if (err) {
            reject(err);
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // ⭐ 파일 생성 검증
  async verifyFileCreation(filePath) {
    try {
      const stats = await fs.stat(filePath);
      // 파일이 존재하고 크기가 0보다 큰지 확인
      return stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  // ⭐ 사용자 친화적 에러 메시지
  getFriendlyErrorMessage(error) {
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes("timeout")) {
      return "⏱️ 변환 시간이 초과되었습니다. 텍스트를 줄여서 다시 시도해주세요.";
    } else if (errorMsg.includes("network") || errorMsg.includes("connect")) {
      return "🌐 네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.";
    } else if (errorMsg.includes("invalid") || errorMsg.includes("language")) {
      return "🔤 지원하지 않는 언어이거나 텍스트에 문제가 있습니다.";
    } else if (errorMsg.includes("file") || errorMsg.includes("permission")) {
      return "💾 음성 파일 생성에 실패했습니다. 잠시 후 다시 시도해주세요.";
    } else {
      return "❌ TTS 변환 중 오류가 발생했습니다. 다시 시도해주세요.";
    }
  }

  // TTS 정지 기능
  async stopTTS(userId) {
    try {
      const activeRequest = this.activeRequests.get(userId);

      if (!activeRequest) {
        return { success: false, message: "진행 중인 TTS 작업이 없습니다." };
      }

      // 상태를 정지로 변경
      activeRequest.status = "stopped";
      activeRequest.stoppedAt = new Date();

      // 임시 파일 삭제
      if (activeRequest.filePath) {
        await this.cleanupFile(activeRequest.filePath);
      }

      // 활성 요청 제거
      this.activeRequests.delete(userId);

      logger.info("🛑 TTS 작업 정지:", { userId });

      return {
        success: true,
        message: "TTS 작업이 정지되었습니다.",
        stoppedTask: {
          text: activeRequest.text,
          language: activeRequest.language,
          duration: activeRequest.stoppedAt - activeRequest.startTime,
        },
      };
    } catch (error) {
      logger.error("TTS 정지 오류:", error);
      return { success: false, message: "TTS 정지 중 오류가 발생했습니다." };
    }
  }

  // 파일 크기 조회
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // ⭐ 안전한 파일 정리 (Railway 환경 고려)
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.debug(`🗑️ TTS 임시 파일 삭제: ${path.basename(filePath)}`);
    } catch (error) {
      // Railway 환경에서는 파일 삭제 실패가 치명적이지 않음
      logger.debug(`파일 삭제 무시: ${error.message}`);
    }
  }

  // ⭐ 자동 TTS 처리 (에러 처리 강화)
  async handleAutoTTS(bot, msg) {
    try {
      const userId = msg.from.id;
      const mode = this.getTTSMode(userId);

      if (mode !== "AUTO") {
        return false;
      }

      const text = msg.text;

      // 텍스트 검증 (자동 모드에서는 더 엄격)
      if (!text || text.startsWith("/") || text.length > 200) {
        return false;
      }

      // 언어 감지 및 TTS 변환
      const language = this.getUserLanguage(userId);
      const result = await this.convertTextToSpeech(text, language, userId);

      if (result.success) {
        // 음성 파일 전송
        await bot.sendVoice(msg.chat.id, result.filePath, {
          caption: `🔊 자동 TTS: "${text.substring(0, 50)}${
            text.length > 50 ? "..." : ""
          }"`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" },
                { text: "🔧 TTS 설정", callback_data: "utils_tts_menu" },
              ],
            ],
          },
        });

        // 파일 정리 (10초 후)
        setTimeout(() => {
          this.cleanupFile(result.filePath);
          this.activeRequests.delete(userId);
        }, 10000);

        return true;
      } else {
        // 자동 모드에서는 에러를 사용자에게 표시하지 않음
        logger.warn("자동 TTS 실패 (사용자에게 숨김):", {
          userId,
          error: result.message,
        });
        return false;
      }
    } catch (error) {
      logger.error("자동 TTS 처리 오류:", error);
      return false;
    }
  }

  // ⭐ Railway 환경 체크 및 진단
  async runDiagnostics() {
    const diagnostics = {
      environment: process.env.NODE_ENV,
      railway: !!process.env.RAILWAY_ENVIRONMENT,
      tempDir: this.tempDir,
      tempDirExists: false,
      tempDirWritable: false,
      networkAccess: false,
      gttsVersion: require("gtts/package.json").version,
    };

    try {
      // 임시 디렉토리 체크
      await fs.access(this.tempDir);
      diagnostics.tempDirExists = true;

      // 쓰기 권한 체크
      const testFile = path.join(this.tempDir, "test.txt");
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      diagnostics.tempDirWritable = true;
    } catch (error) {
      logger.warn("임시 디렉토리 진단 실패:", error.message);
    }

    try {
      // 간단한 TTS 테스트
      const testResult = await this.convertTextToSpeech("test", "en");
      diagnostics.networkAccess = testResult.success;

      if (testResult.success && testResult.filePath) {
        await this.cleanupFile(testResult.filePath);
      }
    } catch (error) {
      logger.warn("TTS 네트워크 테스트 실패:", error.message);
    }

    logger.info("🔍 TTS 서비스 진단 결과:", diagnostics);
    return diagnostics;
  }

  // 모든 임시 파일 정리
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

  // 서비스 상태 조회
  getServiceStatus() {
    return {
      activeRequests: this.activeRequests.size,
      totalUsers: this.userModes.size,
      supportedLanguages: Object.keys(this.supportedLanguages).length,
      tempDirectory: this.tempDir,
      timeout: this.TTS_TIMEOUT,
      maxRetries: this.MAX_RETRIES,
      environment: process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local",
    };
  }

  // 서비스 종료 시 정리
  async shutdown() {
    // 모든 활성 요청 정지
    for (const userId of this.activeRequests.keys()) {
      await this.stopTTS(userId);
    }

    // 모든 임시 파일 정리
    await this.cleanupAllFiles();

    logger.info("🛑 TTS 서비스 정리 완료");
  }
}

module.exports = { TTSService };
