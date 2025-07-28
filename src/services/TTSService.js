// src/services/TTSService.js - 명확한 클래스명 버전

// Google Cloud 라이브러리 임포트
const GoogleTextToSpeech = require("@google-cloud/text-to-speech"); // TTS (텍스트→음성)
const GoogleSpeechToText = require("@google-cloud/speech"); // STT (음성→텍스트)

const fs = require("fs").promises;
const path = require("path");
const logger = require("../utils/Logger");
const { v4: uuidv4 } = require("uuid");

/**
 * 🔊 TTSService - 텍스트를 음성으로 변환하는 서비스
 *
 * 클래스 설명:
 * - GoogleTextToSpeech: 텍스트를 음성으로 변환 (TTS)
 * - GoogleSpeechToText: 음성을 텍스트로 변환 (STT)
 *
 * 주요 기능:
 * - textToSpeech(): 텍스트 → 음성 파일
 * - speechToText(): 음성 파일 → 텍스트 (선택 기능)
 */
class TTSService {
  constructor(options = {}) {
    this.config = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      languageCode: process.env.TTS_DEFAULT_LANGUAGE || "ko-KR",
      voiceName: process.env.TTS_VOICE_NAME || "ko-KR-Wavenet-A",
      audioEncoding: "OGG_OPUS",
      cacheDir: process.env.TTS_CACHE_DIR || "/tmp/tts-cache",
      ...options.config,
    };

    // 클라이언트 인스턴스 (명확한 이름)
    this.googleTTSClient = null; // 텍스트→음성 클라이언트
    this.googleSTTClient = null; // 음성→텍스트 클라이언트 (옵션)

    this.cache = new Map();

    this.stats = {
      totalConversions: 0,
      cachedResponses: 0,
      apiCalls: 0,
      errors: 0,
    };

    logger.info("🔊 TTSService 생성됨", {
      projectId: this.maskString(this.config.projectId),
      languageCode: this.config.languageCode,
      voiceName: this.config.voiceName,
    });
  }

  /**
   * 초기화
   */
  async initialize() {
    try {
      const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;

      logger.info("🚂 TTS 서비스 초기화", {
        environment: isRailway ? "Railway" : "Local",
        hasProjectId: !!this.config.projectId,
        hasCredentials: !!(
          process.env.GOOGLE_CLIENT_EMAIL ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS
        ),
      });

      if (isRailway) {
        // Railway 환경
        if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
          const credentials = {
            type: "service_account",
            project_id: this.config.projectId,
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          };

          // 텍스트→음성 클라이언트 생성
          this.googleTTSClient = new GoogleTextToSpeech.TextToSpeechClient({
            projectId: this.config.projectId,
            credentials: credentials,
          });

          // 음성→텍스트 클라이언트 생성 (선택사항)
          this.googleSTTClient = new GoogleSpeechToText.SpeechClient({
            projectId: this.config.projectId,
            credentials: credentials,
          });

          logger.success("✅ Google Cloud 연결 성공", {
            ttsClient: "활성화",
            sttClient: "활성화",
            projectId: this.maskString(this.config.projectId),
          });
        } else {
          throw new Error("필수 환경변수가 설정되지 않았습니다");
        }
      } else {
        // 로컬 환경
        const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (!keyFilename) {
          throw new Error(
            "GOOGLE_APPLICATION_CREDENTIALS가 설정되지 않았습니다"
          );
        }

        // 텍스트→음성 클라이언트
        this.googleTTSClient = new GoogleTextToSpeech.TextToSpeechClient({
          projectId: this.config.projectId,
          keyFilename: keyFilename,
        });

        // 음성→텍스트 클라이언트
        this.googleSTTClient = new GoogleSpeechToText.SpeechClient({
          projectId: this.config.projectId,
          keyFilename: keyFilename,
        });

        logger.success("✅ Google Cloud 연결 성공 (로컬)");
      }

      // 캐시 디렉토리 생성
      await this.ensureCacheDirectory();
    } catch (error) {
      this.logSafeError("❌ TTSService 초기화 실패", error);
      throw new Error("TTS 서비스 초기화에 실패했습니다");
    }
  }

  /**
   * 🎤 → 🔊 텍스트를 음성으로 변환 (TTS)
   */
  async textToSpeech(text, options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("변환할 텍스트가 없습니다");
      }

      // TTS 설정
      const ttsConfig = {
        languageCode: options.languageCode || this.config.languageCode,
        voiceName: options.voiceName || this.config.voiceName,
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0,
        volumeGainDb: options.volumeGainDb || 0,
      };

      // 캐시 확인
      const cacheKey = this.generateCacheKey(text, ttsConfig);
      const cachedFile = await this.getCachedFile(cacheKey);
      if (cachedFile) {
        this.stats.cachedResponses++;
        logger.debug("🎯 캐시에서 음성 파일 반환");
        return cachedFile;
      }

      // Google TTS API 요청 구성
      const ttsRequest = {
        input: { text: text },
        voice: {
          languageCode: ttsConfig.languageCode,
          name: ttsConfig.voiceName,
          ssmlGender: "NEUTRAL",
        },
        audioConfig: {
          audioEncoding: this.config.audioEncoding,
          speakingRate: ttsConfig.speakingRate,
          pitch: ttsConfig.pitch,
          volumeGainDb: ttsConfig.volumeGainDb,
        },
      };

      // 로그에는 텍스트 일부만
      const logText = text.length > 50 ? text.substring(0, 47) + "..." : text;
      logger.info(`🎤 TTS 변환 시작: "${logText}"`);

      // Google TTS API 호출
      const [ttsResponse] = await this.googleTTSClient.synthesizeSpeech(
        ttsRequest
      );
      this.stats.apiCalls++;

      // 음성 파일 저장
      const audioContent = ttsResponse.audioContent;
      const fileName = `${cacheKey}.ogg`;
      const filePath = path.join(this.config.cacheDir, fileName);

      await fs.writeFile(filePath, audioContent, "binary");
      logger.success(`✅ 음성 파일 생성: ${fileName}`);

      // 캐시에 추가
      await this.addToCache(cacheKey, filePath);
      this.stats.totalConversions++;

      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        size: audioContent.length,
        duration: this.estimateDuration(text),
        language: ttsConfig.languageCode,
        voice: ttsConfig.voiceName,
      };
    } catch (error) {
      this.stats.errors++;
      this.logSafeError("❌ TTS 변환 실패", error);
      throw new Error("음성 변환에 실패했습니다");
    }
  }

  /**
   * 🔊 → 🎤 음성을 텍스트로 변환 (STT) - 선택 기능
   */
  async speechToText(audioFilePath, options = {}) {
    try {
      if (!this.googleSTTClient) {
        throw new Error("STT 클라이언트가 초기화되지 않았습니다");
      }

      // 오디오 파일 읽기
      const audioBytes = await fs.readFile(audioFilePath);

      // STT 설정
      const sttConfig = {
        encoding: options.encoding || "OGG_OPUS",
        sampleRateHertz: options.sampleRateHertz || 16000,
        languageCode: options.languageCode || this.config.languageCode,
        enableAutomaticPunctuation: true,
        model: "latest_long", // 긴 오디오에 적합
      };

      // Google STT API 요청 구성
      const sttRequest = {
        audio: {
          content: audioBytes.toString("base64"),
        },
        config: sttConfig,
      };

      logger.info("🎤 STT 변환 시작...");

      // Google STT API 호출
      const [sttResponse] = await this.googleSTTClient.recognize(sttRequest);

      // 결과 텍스트 조합
      const transcription = sttResponse.results
        .map((result) => result.alternatives[0].transcript)
        .join(" ");

      logger.success(
        `✅ STT 변환 완료: "${transcription.substring(0, 50)}..."`
      );

      return {
        success: true,
        text: transcription,
        confidence: sttResponse.results[0]?.alternatives[0]?.confidence || 0,
        language: sttConfig.languageCode,
      };
    } catch (error) {
      this.logSafeError("❌ STT 변환 실패", error);
      throw new Error("음성을 텍스트로 변환하는데 실패했습니다");
    }
  }

  /**
   * 사용 가능한 음성 목록 조회
   */
  async getAvailableVoices(languageCode = null) {
    try {
      const request = languageCode ? { languageCode } : {};
      const [response] = await this.googleTTSClient.listVoices(request);

      return response.voices.map((voice) => ({
        name: voice.name,
        languageCodes: voice.languageCodes,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
        // 한국어 음성인지 표시
        isKorean: voice.languageCodes.some((code) => code.startsWith("ko")),
      }));
    } catch (error) {
      this.logSafeError("음성 목록 조회 실패", error);
      return [];
    }
  }

  /**
   * 문자열 마스킹
   */
  maskString(str) {
    if (!str) return "not-set";
    if (str.length <= 8) return "***";
    return str.substring(0, 4) + "***" + str.substring(str.length - 4);
  }

  /**
   * 안전한 에러 로깅
   */
  logSafeError(message, error) {
    const safeError = {
      message: error.message,
      code: error.code,
      name: error.name,
    };
    logger.error(message, safeError);
  }

  /**
   * 캐시 관련 메서드들...
   */
  generateCacheKey(text, config) {
    const crypto = require("crypto");
    const configStr = `${config.languageCode}_${config.voiceName}_${config.speakingRate}_${config.pitch}`;
    return crypto
      .createHash("sha256")
      .update(text + configStr)
      .digest("hex");
  }

  async getCachedFile(cacheKey) {
    // 캐시 구현...
  }

  async addToCache(cacheKey, filePath) {
    // 캐시 추가...
  }

  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      logger.error("캐시 디렉토리 생성 실패:", error);
    }
  }

  estimateDuration(text) {
    const wordsPerMinute = 150;
    const words = text.split(/\s+/).length;
    return Math.ceil((words / wordsPerMinute) * 60);
  }

  /**
   * 서비스 상태
   */
  getStatus() {
    return {
      serviceName: "TTSService",
      provider: "Google Cloud",
      features: {
        textToSpeech: !!this.googleTTSClient,
        speechToText: !!this.googleSTTClient,
      },
      config: {
        defaultLanguage: this.config.languageCode,
        defaultVoice: this.config.voiceName,
      },
      stats: this.stats,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      this.cache.clear();
      logger.info("✅ TTSService 정리 완료");
    } catch (error) {
      this.logSafeError("❌ TTSService 정리 실패", error);
    }
  }
}

module.exports = TTSService;
