// src/services/TTSService.js - 정지 기능 추가

const gtts = require("gtts");
const fs = require("fs").promises;
const path = require("path");
const { TimeHelper } = require("../utils/TimeHelper");

class TTSService {
  constructor() {
    // 사용자별 TTS 모드 저장
    this.userModes = new Map(); // userId -> "AUTO" | "MANUAL" | "OFF"

    // 사용자별 언어 설정
    this.userLanguages = new Map(); // userId -> "ko" | "en" | "ja" 등

    // ⭐ 활성 TTS 요청 추적
    this.activeRequests = new Map(); // userId -> { request, filePath, cleanup }

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

    // 임시 파일 디렉토리
    this.tempDir = path.join(process.cwd(), "temp", "tts");
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("TTS 임시 디렉토리 생성 실패:", error);
    }
  }

  // TTS 모드 설정
  setTTSMode(userId, mode) {
    if (!["AUTO", "MANUAL", "OFF"].includes(mode)) {
      throw new Error("유효하지 않은 TTS 모드입니다.");
    }

    this.userModes.set(userId.toString(), mode);
    return { success: true, mode };
  }

  // TTS 모드 조회
  getTTSMode(userId) {
    return this.userModes.get(userId.toString()) || "OFF";
  }

  // 사용자 언어 설정
  setUserLanguage(userId, language) {
    if (!this.supportedLanguages[language]) {
      return {
        success: false,
        message: "지원하지 않는 언어입니다.",
      };
    }

    this.userLanguages.set(userId.toString(), language);
    return {
      success: true,
      language,
      languageName: this.supportedLanguages[language],
    };
  }

  // 사용자 언어 조회
  getUserLanguage(userId) {
    return this.userLanguages.get(userId.toString()) || "ko";
  }

  // ⭐ TTS 변환 (정지 기능 포함)
  async convertTextToSpeech(text, language = "ko", userId = null) {
    try {
      // 텍스트 검증
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          message: "변환할 텍스트를 입력해주세요.",
        };
      }

      if (text.length > 500) {
        return {
          success: false,
          message: "텍스트는 500자 이내로 입력해주세요.",
        };
      }

      // 언어 검증
      if (!this.supportedLanguages[language]) {
        language = "ko"; // 기본값으로 설정
      }

      // 임시 파일 경로 생성
      const timestamp = Date.now();
      const fileName = `tts_${userId || "unknown"}_${timestamp}.mp3`;
      const filePath = path.join(this.tempDir, fileName);

      // ⭐ 활성 요청 등록
      if (userId) {
        // 기존 요청이 있으면 정지
        await this.stopTTS(userId);

        this.activeRequests.set(userId, {
          text,
          language,
          filePath,
          startTime: TimeHelper.getKoreaTime(),
          status: "processing",
        });
      }

      // GTTS 인스턴스 생성
      const gttsInstance = new gtts(text, language);

      // Promise로 래핑하여 비동기 처리
      const ttsPromise = new Promise((resolve, reject) => {
        gttsInstance.save(filePath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(filePath);
          }
        });
      });

      // TTS 변환 실행
      await ttsPromise;

      // ⭐ 정지 상태 확인
      if (userId && this.activeRequests.has(userId)) {
        const request = this.activeRequests.get(userId);
        if (request.status === "stopped") {
          // 정지된 경우 파일 삭제하고 에러 반환
          await this.cleanupFile(filePath);
          return {
            success: false,
            message: "TTS 변환이 중지되었습니다.",
          };
        }
      }

      // 파일 생성 확인
      try {
        await fs.access(filePath);
      } catch (error) {
        return {
          success: false,
          message: "음성 파일 생성에 실패했습니다.",
        };
      }

      // ⭐ 성공 시 활성 요청 상태 업데이트
      if (userId && this.activeRequests.has(userId)) {
        const request = this.activeRequests.get(userId);
        request.status = "completed";
        request.completedAt = TimeHelper.getKoreaTime();
      }

      return {
        success: true,
        filePath,
        language,
        text,
        fileName,
        size: await this.getFileSize(filePath),
      };
    } catch (error) {
      console.error("TTS 변환 오류:", error);

      // ⭐ 에러 시 활성 요청 제거
      if (userId) {
        this.activeRequests.delete(userId);
      }

      return {
        success: false,
        message: `TTS 변환 실패: ${error.message}`,
      };
    }
  }

  // ⭐ TTS 정지 기능
  async stopTTS(userId) {
    try {
      const activeRequest = this.activeRequests.get(userId);

      if (!activeRequest) {
        return {
          success: false,
          message: "진행 중인 TTS 작업이 없습니다.",
        };
      }

      // 요청 상태를 정지로 변경
      activeRequest.status = "stopped";
      activeRequest.stoppedAt = TimeHelper.getKoreaTime();

      // 임시 파일이 있으면 삭제
      if (activeRequest.filePath) {
        await this.cleanupFile(activeRequest.filePath);
      }

      // 활성 요청 제거
      this.activeRequests.delete(userId);

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
      console.error("TTS 정지 오류:", error);
      return {
        success: false,
        message: "TTS 정지 중 오류가 발생했습니다.",
      };
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

  // 파일 정리
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`TTS 임시 파일 삭제: ${filePath}`);
    } catch (error) {
      console.error(`TTS 파일 삭제 실패: ${error.message}`);
    }
  }

  // 자동 TTS 처리
  async handleAutoTTS(bot, msg) {
    try {
      const userId = msg.from.id;
      const mode = this.getTTSMode(userId);

      if (mode !== "AUTO") {
        return false;
      }

      const text = msg.text;

      // 텍스트 검증
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

        // 임시 파일 정리 (10초 후)
        setTimeout(() => {
          this.cleanupFile(result.filePath);
          this.activeRequests.delete(userId);
        }, 10000);

        return true;
      }

      return false;
    } catch (error) {
      console.error("자동 TTS 처리 오류:", error);
      return false;
    }
  }

  // TTS 도움말 텍스트 생성
  getTTSHelpText(userId) {
    const mode = this.getTTSMode(userId);
    const language = this.getUserLanguage(userId);
    const languageName = this.supportedLanguages[language];
    const activeTTS = this.activeRequests.has(userId);

    return (
      `🔊 **TTS (음성 변환) 설정**\n\n` +
      `📍 **현재 모드**: ${mode}\n` +
      `🌍 **현재 언어**: ${languageName}\n` +
      `${activeTTS ? "🔴 **상태**: 진행 중" : "⚪ **상태**: 대기 중"}\n\n` +
      "**🎯 모드 설명**\n" +
      "• **자동**: 채팅 메시지 자동 변환\n" +
      "• **수동**: /tts 명령어로만 사용\n" +
      "• **OFF**: TTS 기능 비활성화\n\n" +
      "**💡 특징**\n" +
      "• 최대 500자 지원\n" +
      "• ⏹️ 실시간 정지 기능\n" +
      "• 10개 언어 지원\n" +
      "• 자동 파일 정리\n\n" +
      "원하는 설정을 선택하세요:"
    );
  }

  // TTS 메뉴 키보드 생성
  createTTSMenuKeyboard(userId) {
    const mode = this.getTTSMode(userId);
    const activeTTS = this.activeRequests.has(userId);

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: mode === "AUTO" ? "🔊 자동 모드 (현재)" : "🔊 자동 모드",
            callback_data: "utils_tts_auto_on",
          },
          {
            text: mode === "MANUAL" ? "📝 수동 모드 (현재)" : "📝 수동 모드",
            callback_data: "utils_tts_manual",
          },
        ],
        [
          {
            text: mode === "OFF" ? "❌ OFF (현재)" : "❌ OFF",
            callback_data: "utils_tts_auto_off",
          },
          { text: "🌍 언어 설정", callback_data: "utils_tts_lang_menu" },
        ],
      ],
    };

    // 진행 중인 TTS가 있으면 정지 버튼 추가
    if (activeTTS) {
      keyboard.inline_keyboard.splice(2, 0, [
        { text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" },
      ]);
    }

    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "utils_tts_help" },
      { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
    ]);

    return keyboard;
  }

  // 언어 설정 키보드 생성
  createLanguageKeyboard() {
    const languages = [
      ["ko", "en"], // 한국어, English
      ["ja", "zh"], // 日本語, 中文
      ["es", "fr"], // Español, Français
      ["de", "it"], // Deutsch, Italiano
      ["pt", "ru"], // Português, Русский
    ];

    const keyboard = {
      inline_keyboard: languages.map((row) =>
        row.map((lang) => ({
          text: this.supportedLanguages[lang],
          callback_data: `utils_tts_lang_${lang}`,
        }))
      ),
    };

    keyboard.inline_keyboard.push([
      { text: "🔙 TTS 설정", callback_data: "utils_tts_menu" },
    ]);

    return keyboard;
  }

  // 활성 TTS 상태 조회
  getActiveTTSStatus(userId) {
    const request = this.activeRequests.get(userId);

    if (!request) {
      return null;
    }

    return {
      text: request.text,
      language: request.language,
      status: request.status,
      startTime: request.startTime,
      elapsedTime: TimeHelper.getKoreaTime() - request.startTime,
    };
  }

  // 모든 임시 파일 정리
  async cleanupAllFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const cleanupPromises = files.map((file) =>
        this.cleanupFile(path.join(this.tempDir, file))
      );

      await Promise.all(cleanupPromises);
      console.log(`TTS 임시 파일 ${files.length}개 정리 완료`);
    } catch (error) {
      console.error("TTS 임시 파일 정리 오류:", error);
    }
  }

  // 서비스 상태 확인
  getServiceStatus() {
    return {
      activeRequests: this.activeRequests.size,
      totalUsers: this.userModes.size,
      supportedLanguages: Object.keys(this.supportedLanguages).length,
      tempDirectory: this.tempDir,
      memoryUsage: process.memoryUsage(),
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

    console.log("TTS 서비스 정리 완료");
  }
}

module.exports = { TTSService };
