// src/services/TTSService.js
const speech = require("@google-cloud/speech");
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs").promises;
const path = require("path");
const logger = require("../utils/Logger");
const { v4: uuidv4 } = require("uuid");

/**
 * 🔊 TTSService - Google Cloud Text-to-Speech 서비스
 *
 * 주요 기능:
 * - 텍스트를 음성으로 변환
 * - 다양한 언어 및 음성 지원
 * - 음성 파일 캐싱
 * - Speech-to-Text 기능 (추가 가능)
 */
class TTSService {
  constructor(options = {}) {
    this.config = {
      // Google Cloud 설정
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,

      // TTS 기본 설정
      languageCode: "ko-KR",
      voiceName: "ko-KR-Wavenet-A",
      audioEncoding: "OGG_OPUS", // Telegram이 지원하는 형식
      speakingRate: 1.0,
      pitch: 0,
      volumeGainDb: 0,

      // 캐싱 설정
      enableCache: true,
      cacheDir: process.env.TTS_CACHE_DIR || "./cache/tts",
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      cacheExpiry: 24 * 60 * 60 * 1000, // 24시간

      ...options.config,
    };

    // 클라이언트 초기화
    this.ttsClient = null;
    this.sttClient = null;

    // 캐시
    this.cache = new Map();

    // 통계
    this.stats = {
      totalConversions: 0,
      cachedResponses: 0,
      apiCalls: 0,
      errors: 0,
    };

    logger.info("🔊 TTSService 생성됨");
  }

  /**
   * 초기화
   */
  async initialize() {
    try {
      // Google Cloud 인증 확인
      if (!this.config.keyFilename) {
        throw new Error(
          "GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다"
        );
      }

      // TTS 클라이언트 생성
      this.ttsClient = new textToSpeech.TextToSpeechClient({
        projectId: this.config.projectId,
        keyFilename: this.config.keyFilename,
      });

      // STT 클라이언트 생성 (옵션)
      this.sttClient = new speech.SpeechClient({
        projectId: this.config.projectId,
        keyFilename: this.config.keyFilename,
      });

      // 캐시 디렉토리 생성
      if (this.config.enableCache) {
        await this.ensureCacheDirectory();
      }

      // 사용 가능한 음성 목록 로드
      await this.loadAvailableVoices();

      logger.success("✅ TTSService 초기화 완료");
    } catch (error) {
      logger.error("❌ TTSService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 텍스트를 음성으로 변환
   */
  async textToSpeech(text, options = {}) {
    try {
      // 입력 검증
      if (!text || text.trim().length === 0) {
        throw new Error("변환할 텍스트가 없습니다");
      }

      // 옵션 병합
      const config = {
        languageCode: options.languageCode || this.config.languageCode,
        voiceName: options.voiceName || this.config.voiceName,
        speakingRate: options.speakingRate || this.config.speakingRate,
        pitch: options.pitch || this.config.pitch,
        volumeGainDb: options.volumeGainDb || this.config.volumeGainDb,
      };

      // 캐시 확인
      const cacheKey = this.generateCacheKey(text, config);
      if (this.config.enableCache) {
        const cachedFile = await this.getCachedFile(cacheKey);
        if (cachedFile) {
          this.stats.cachedResponses++;
          logger.debug("🎯 캐시에서 음성 파일 반환");
          return cachedFile;
        }
      }

      // Google TTS API 요청 준비
      const request = {
        input: { text },
        voice: {
          languageCode: config.languageCode,
          name: config.voiceName,
          ssmlGender: "NEUTRAL",
        },
        audioConfig: {
          audioEncoding: this.config.audioEncoding,
          speakingRate: config.speakingRate,
          pitch: config.pitch,
          volumeGainDb: config.volumeGainDb,
        },
      };

      // API 호출
      logger.info(`🔊 TTS 변환 시작: "${text.substring(0, 50)}..."`);
      const [response] = await this.ttsClient.synthesizeSpeech(request);
      this.stats.apiCalls++;

      // 음성 데이터 저장
      const audioContent = response.audioContent;
      const fileName = `${cacheKey}.ogg`;
      const filePath = path.join(this.config.cacheDir, fileName);

      // 파일로 저장
      await fs.writeFile(filePath, audioContent, "binary");
      logger.success(`✅ 음성 파일 생성: ${fileName}`);

      // 캐시에 추가
      if (this.config.enableCache) {
        await this.addToCache(cacheKey, filePath);
      }

      // 통계 업데이트
      this.stats.totalConversions++;

      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        size: audioContent.length,
        duration: this.estimateDuration(text),
        config: config,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error("❌ TTS 변환 실패:", error);
      throw error;
    }
  }

  /**
   * 음성을 텍스트로 변환 (STT)
   */
  async speechToText(audioFilePath, options = {}) {
    try {
      // 오디오 파일 읽기
      const audioBytes = await fs.readFile(audioFilePath);

      // 설정
      const config = {
        encoding: options.encoding || "OGG_OPUS",
        sampleRateHertz: options.sampleRateHertz || 16000,
        languageCode: options.languageCode || this.config.languageCode,
      };

      // 요청 준비
      const request = {
        audio: {
          content: audioBytes.toString("base64"),
        },
        config: config,
      };

      // API 호출
      logger.info("🎤 STT 변환 시작...");
      const [response] = await this.sttClient.recognize(request);
      const transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join(" ");

      logger.success(`✅ STT 변환 완료: "${transcription}"`);

      return {
        success: true,
        text: transcription,
        confidence: response.results[0]?.alternatives[0]?.confidence || 0,
      };
    } catch (error) {
      logger.error("❌ STT 변환 실패:", error);
      throw error;
    }
  }

  /**
   * 사용 가능한 음성 목록 조회
   */
  async getAvailableVoices(languageCode = null) {
    try {
      const request = languageCode ? { languageCode } : {};
      const [response] = await this.ttsClient.listVoices(request);

      return response.voices.map((voice) => ({
        name: voice.name,
        languageCodes: voice.languageCodes,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
      }));
    } catch (error) {
      logger.error("음성 목록 조회 실패:", error);
      return [];
    }
  }

  /**
   * 캐시 키 생성
   */
  generateCacheKey(text, config) {
    const configStr = `${config.languageCode}_${config.voiceName}_${config.speakingRate}_${config.pitch}`;
    const textHash = require("crypto")
      .createHash("md5")
      .update(text + configStr)
      .digest("hex");
    return textHash;
  }

  /**
   * 캐시된 파일 조회
   */
  async getCachedFile(cacheKey) {
    try {
      const filePath = path.join(this.config.cacheDir, `${cacheKey}.ogg`);
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtimeMs;

        // 캐시 만료 확인
        if (age < this.config.cacheExpiry) {
          return {
            success: true,
            filePath: filePath,
            fileName: `${cacheKey}.ogg`,
            cached: true,
            age: age,
          };
        } else {
          // 만료된 캐시 삭제
          await fs.unlink(filePath);
        }
      }

      return null;
    } catch (error) {
      logger.error("캐시 조회 오류:", error);
      return null;
    }
  }

  /**
   * 캐시에 추가
   */
  async addToCache(cacheKey, filePath) {
    this.cache.set(cacheKey, {
      filePath: filePath,
      timestamp: Date.now(),
    });

    // 캐시 크기 관리
    await this.manageCacheSize();
  }

  /**
   * 캐시 디렉토리 확인 및 생성
   */
  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      logger.error("캐시 디렉토리 생성 실패:", error);
    }
  }

  /**
   * 텍스트 길이로 음성 길이 추정 (초)
   */
  estimateDuration(text) {
    // 한국어 기준: 분당 약 150단어
    const wordsPerMinute = 150;
    const words = text.split(/\s+/).length;
    return Math.ceil((words / wordsPerMinute) * 60);
  }

  /**
   * 캐시 크기 관리
   */
  async manageCacheSize() {
    try {
      const files = await fs.readdir(this.config.cacheDir);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.config.cacheDir, file);
          const stats = await fs.stat(filePath);
          return { path: filePath, size: stats.size, mtime: stats.mtimeMs };
        })
      );

      // 전체 크기 계산
      const totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);

      // 크기 초과 시 오래된 파일부터 삭제
      if (totalSize > this.config.maxCacheSize) {
        fileStats.sort((a, b) => a.mtime - b.mtime);

        let currentSize = totalSize;
        for (const file of fileStats) {
          if (currentSize <= this.config.maxCacheSize * 0.8) break;

          await fs.unlink(file.path);
          currentSize -= file.size;
          logger.debug(`캐시 정리: ${file.path} 삭제`);
        }
      }
    } catch (error) {
      logger.error("캐시 관리 오류:", error);
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "TTSService",
      provider: "Google Cloud",
      isConnected: !!this.ttsClient,
      config: {
        defaultLanguage: this.config.languageCode,
        defaultVoice: this.config.voiceName,
        cacheEnabled: this.config.enableCache,
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
      logger.error("❌ TTSService 정리 실패:", error);
    }
  }
}

module.exports = TTSService;
