/**
 * 🔊 TTSModuleV2 - EventBus 기반 텍스트 음성 변환 모듈
 * 
 * EventBus를 사용한 완전히 분리된 아키텍처로 TTS 기능을 제공합니다.
 * 
 * 🎯 주요 기능:
 * - 텍스트 → 음성 변환
 * - 다국어 지원 (한국어, 영어)
 * - 음성 선택 및 변경
 * - 오디오 파일 공유
 * - 사용자 설정 관리
 */

const { EVENTS } = require('../events/EventRegistry');
const logger = require('../utils/core/Logger');
const Utils = require('../utils');

class TTSModuleV2 {
  constructor(moduleName = "tts", options = {}) {
    this.moduleName = moduleName;
    this.eventBus = options.eventBus || require('../core/EventBus').getInstance();
    this.serviceBuilder = options.serviceBuilder || null;
    
    // TTS 서비스 (있으면 실제 기능, 없으면 테스트 모드)
    this.ttsService = null;
    
    // 사용자 상태 관리 (메모리 기반)
    this.userStates = new Map();
    
    // 모듈 설정
    this.config = {
      maxTextLength: 500,
      defaultLanguage: "ko-KR",
      supportedLanguages: ["ko-KR", "en-US"],
      defaultVoice: "ko-KR-Standard-A",
      timeout: 300000, // 5분 입력 타임아웃
      ...options.config
    };
    
    // 음성 설정 (더미 데이터)
    this.voiceConfig = {
      "ko-KR": [
        { code: "ko-KR-Standard-A", name: "한국어 여성 1", gender: "female" },
        { code: "ko-KR-Standard-B", name: "한국어 남성 1", gender: "male" },
        { code: "ko-KR-Standard-C", name: "한국어 여성 2", gender: "female" },
        { code: "ko-KR-Standard-D", name: "한국어 남성 2", gender: "male" }
      ],
      "en-US": [
        { code: "en-US-Standard-A", name: "English Female 1", gender: "female" },
        { code: "en-US-Standard-B", name: "English Male 1", gender: "male" },
        { code: "en-US-Standard-C", name: "English Female 2", gender: "female" },
        { code: "en-US-Standard-D", name: "English Male 2", gender: "male" }
      ]
    };
    
    // EventBus 구독 배열 (정리용)
    this.subscriptions = [];
    
    // 상태 정리 타이머
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 60000); // 1분마다 정리

    logger.info("🔊 TTSModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 TTSService 가져오기 (선택적)
      if (this.serviceBuilder) {
        try {
          this.ttsService = await this.serviceBuilder.getOrCreate("tts", {
            config: this.config
          });
          logger.info("🔊 TTSService 연결 완료");
        } catch (serviceError) {
          logger.warn("⚠️ TTSService 연결 실패 - 테스트 모드로 동작:", serviceError.message);
          this.ttsService = null;
        }
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      const mode = this.ttsService ? "프로덕션" : "테스트";
      logger.success(`🔊 TTSModuleV2 초기화 완료 (${mode} 모드, EventBus 기반)`);
      return true;
    } catch (error) {
      logger.error("❌ TTSModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 메뉴 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 텍스트 변환 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.CONVERT_REQUEST, async (event) => {
        await this.handleConvertRequest(event);
      })
    );

    // 음성 설정 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.VOICE_LIST_REQUEST, async (event) => {
        await this.handleVoiceListRequest(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.VOICE_CHANGE_REQUEST, async (event) => {
        await this.handleVoiceChangeRequest(event);
      })
    );

    // 텍스트 입력 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.TEXT_INPUT_START, async (event) => {
        await this.handleTextInputStart(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.TEXT_INPUT_RECEIVED, async (event) => {
        await this.handleTextInputReceived(event);
      })
    );

    // 공유 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.SHARE_REQUEST, async (event) => {
        await this.handleShareRequest(event);
      })
    );

    // 설정 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.SETTINGS_REQUEST, async (event) => {
        await this.handleSettingsRequest(event);
      })
    );

    // 도움말
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.TTS.HELP_REQUEST, async (event) => {
        await this.handleHelpRequest(event);
      })
    );

    logger.debug("🎧 TTSModuleV2 EventBus 리스너 설정 완료");
  }

  /**
   * 📝 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 사용자 음성 설정 조회 (Service가 있으면 실제 데이터, 없으면 기본값)
      let userVoice = this.config.defaultVoice;
      
      if (this.ttsService) {
        try {
          const voiceResult = await this.ttsService.getUserVoice(userId);
          if (voiceResult.success) {
            userVoice = voiceResult.data.voiceCode || this.config.defaultVoice;
          }
        } catch (error) {
          logger.warn("사용자 음성 설정 조회 실패:", error.message);
        }
      }

      const currentVoice = this.getVoiceByCode(userVoice);

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.MENU_READY, {
        userId,
        chatId,
        menuData: {
          currentVoice,
          supportedLanguages: this.config.supportedLanguages,
          maxTextLength: this.config.maxTextLength
        },
        config: this.config
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatMenu(currentVoice),
          options: {
            reply_markup: this.createMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔊 메뉴 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🎵 텍스트 변환 요청 처리
   */
  async handleConvertRequest(event) {
    const { userId, chatId, text, language = this.config.defaultLanguage } = event.payload;

    try {
      // 텍스트 길이 검증
      if (!text || text.trim().length === 0) {
        await this.eventBus.publish(EVENTS.TTS.CONVERT_ERROR, {
          userId,
          chatId,
          error: "변환할 텍스트를 입력해주세요."
        });
        return;
      }

      if (text.length > this.config.maxTextLength) {
        await this.eventBus.publish(EVENTS.TTS.CONVERT_ERROR, {
          userId,
          chatId,
          error: `텍스트가 너무 깁니다. (최대 ${this.config.maxTextLength}자)`
        });
        return;
      }

      // TTS 변환 처리 (Service가 있으면 실제 변환, 없으면 더미 응답)
      let conversionResult;
      
      if (this.ttsService) {
        conversionResult = await this.ttsService.convertTextToSpeech(userId, {
          text: text.trim(),
          language
        });
      } else {
        // 테스트 모드: 더미 변환 결과
        const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        conversionResult = {
          success: true,
          data: {
            audioFile: `${audioId}.mp3`,
            audioUrl: `/api/tts/audio/${audioId}.mp3`,
            shareUrl: `/share/tts/${audioId}`,
            duration: Math.floor(text.length / 10), // 더미 duration
            voice: this.getVoiceByCode(this.config.defaultVoice),
            text: text.substring(0, 50) + (text.length > 50 ? "..." : "")
          }
        };
      }

      if (!conversionResult.success) {
        await this.eventBus.publish(EVENTS.TTS.CONVERT_ERROR, {
          userId,
          chatId,
          error: conversionResult.message || "변환 중 오류가 발생했습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.CONVERTED, {
        userId,
        chatId,
        conversionData: conversionResult.data,
        originalText: text
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatConversionSuccess(conversionResult.data),
          options: {
            reply_markup: this.createConversionResultKeyboard(conversionResult.data),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🎵 텍스트 변환 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🎤 음성 목록 요청 처리
   */
  async handleVoiceListRequest(event) {
    const { userId, chatId, language = this.config.defaultLanguage } = event.payload;

    try {
      const voices = this.getVoices(language);

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.VOICE_LIST_READY, {
        userId,
        chatId,
        voiceData: {
          language,
          voices
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatVoiceList(language, voices),
          options: {
            reply_markup: this.createVoiceSelectionKeyboard(voices),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🎤 음성 목록 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔧 음성 변경 요청 처리
   */
  async handleVoiceChangeRequest(event) {
    const { userId, chatId, voiceCode } = event.payload;

    try {
      // 음성 코드 유효성 검증
      const voice = this.getVoiceByCode(voiceCode);
      if (!voice) {
        await this.eventBus.publish(EVENTS.TTS.ERROR, {
          userId,
          chatId,
          error: "유효하지 않은 음성 설정입니다."
        });
        return;
      }

      // 음성 변경 처리 (Service가 있으면 실제 저장, 없으면 임시 저장)
      let changeResult;
      
      if (this.ttsService) {
        changeResult = await this.ttsService.setUserVoice(userId, voiceCode);
      } else {
        // 테스트 모드: 성공 응답
        changeResult = {
          success: true,
          data: { voiceCode, voice }
        };
      }

      if (!changeResult.success) {
        await this.eventBus.publish(EVENTS.TTS.ERROR, {
          userId,
          chatId,
          error: changeResult.message || "음성 변경에 실패했습니다."
        });
        return;
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.VOICE_CHANGED, {
        userId,
        chatId,
        voiceData: {
          voiceCode,
          voice
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatVoiceChanged(voice),
          options: {
            reply_markup: this.createBackToMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔧 음성 변경 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ✏️ 텍스트 입력 시작 처리
   */
  async handleTextInputStart(event) {
    const { userId, chatId, language = this.config.defaultLanguage } = event.payload;

    try {
      // 사용자 입력 상태 설정
      this.setUserInputState(userId, {
        state: 'waiting_text_input',
        language,
        chatId,
        startTime: Date.now()
      });

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.TEXT_INPUT_RECEIVED, {
        userId,
        chatId,
        inputState: {
          isWaiting: true,
          language,
          maxLength: this.config.maxTextLength
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatTextInputPrompt(language),
          options: {
            reply_markup: this.createTextInputKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('✏️ 텍스트 입력 시작 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📨 텍스트 입력 수신 처리
   */
  async handleTextInputReceived(event) {
    const { userId, chatId, text } = event.payload;

    try {
      // 입력 상태 확인
      const inputState = this.getUserInputState(userId);
      if (!inputState || inputState.state !== 'waiting_text_input') {
        return; // 입력 대기 상태가 아니면 무시
      }

      // 입력 상태 정리
      this.clearUserInputState(userId);

      // 텍스트 변환 요청으로 전달
      await this.eventBus.publish(EVENTS.TTS.CONVERT_REQUEST, {
        userId,
        chatId,
        text,
        language: inputState.language
      });

    } catch (error) {
      logger.error('📨 텍스트 입력 수신 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔗 공유 요청 처리
   */
  async handleShareRequest(event) {
    const { userId, chatId, shareUrl } = event.payload;

    try {
      const baseUrl = process.env.BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN;

      if (!baseUrl) {
        await this.eventBus.publish(EVENTS.TTS.SHARE_ERROR, {
          userId,
          chatId,
          error: "공유 기능을 사용할 수 없습니다. 관리자에게 문의하세요."
        });
        return;
      }

      // URL 생성
      const protocol = baseUrl.startsWith("http") ? "" : "https://";
      const fullUrl = `${protocol}${baseUrl}${shareUrl}`;

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.SHARE_READY, {
        userId,
        chatId,
        shareData: {
          shareUrl: fullUrl,
          originalUrl: shareUrl
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatShareReady(fullUrl),
          options: {
            reply_markup: this.createShareKeyboard(fullUrl),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔗 공유 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ⚙️ 설정 요청 처리
   */
  async handleSettingsRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 사용자 설정 조회 (Service가 있으면 실제 데이터, 없으면 기본값)
      let userSettings = {
        voiceCode: this.config.defaultVoice,
        language: this.config.defaultLanguage
      };

      if (this.ttsService) {
        try {
          const settingsResult = await this.ttsService.getUserSettings(userId);
          if (settingsResult.success) {
            userSettings = { ...userSettings, ...settingsResult.data };
          }
        } catch (error) {
          logger.warn("사용자 설정 조회 실패:", error.message);
        }
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.SETTINGS_READY, {
        userId,
        chatId,
        settingsData: {
          ...userSettings,
          supportedLanguages: this.config.supportedLanguages,
          maxTextLength: this.config.maxTextLength
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatSettings(userSettings),
          options: {
            reply_markup: this.createSettingsKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('⚙️ 설정 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ❓ 도움말 요청 처리
   */
  async handleHelpRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      const helpData = {
        features: [
          "텍스트를 음성으로 변환",
          "다국어 지원 (한국어, 영어)",
          "다양한 음성 선택",
          "오디오 파일 공유"
        ],
        commands: [
          { command: "텍스트 입력", description: "변환할 텍스트를 입력합니다" },
          { command: "음성 변경", description: "원하는 음성을 선택합니다" },
          { command: "언어 변경", description: "변환 언어를 변경합니다" },
          { command: "공유", description: "생성된 오디오를 공유합니다" }
        ],
        limits: {
          maxTextLength: this.config.maxTextLength,
          supportedLanguages: this.config.supportedLanguages
        }
      };

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.TTS.HELP_READY, {
        userId,
        chatId,
        helpData
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatHelp(helpData),
          options: {
            reply_markup: this.createHelpKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('❓ 도움말 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔧 유틸리티 메서드들
   */

  // 음성 코드로 음성 정보 조회
  getVoiceByCode(voiceCode) {
    for (const language in this.voiceConfig) {
      const voice = this.voiceConfig[language].find(v => v.code === voiceCode);
      if (voice) {
        return { ...voice, language };
      }
    }
    return this.voiceConfig["ko-KR"][0]; // 기본값 반환
  }

  // 언어별 음성 목록 조회
  getVoices(language) {
    return this.voiceConfig[language] || this.voiceConfig["ko-KR"];
  }

  // 사용자 입력 상태 설정
  setUserInputState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now()
    });
  }

  // 사용자 입력 상태 조회
  getUserInputState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  // 사용자 입력 상태 정리
  clearUserInputState(userId) {
    this.userStates.delete(userId.toString());
  }

  // 만료된 상태 정리
  cleanupExpiredStates() {
    const now = Date.now();
    const expiredUsers = [];

    for (const [userId, state] of this.userStates) {
      if (now - state.timestamp > this.config.timeout) {
        expiredUsers.push(userId);
      }
    }

    expiredUsers.forEach(userId => {
      this.userStates.delete(userId);
      logger.debug(`🧹 만료된 TTS 상태 정리: ${userId}`);
    });
  }

  /**
   * 📝 메시지 포맷팅 메서드들
   */
  formatMenu(currentVoice) {
    return `🔊 **TTS (텍스트 음성 변환)**\n\n` +
           `현재 음성: *${currentVoice.name}*\n` +
           `언어: ${currentVoice.language}\n\n` +
           `텍스트를 입력하여 음성으로 변환하세요.`;
  }

  formatConversionSuccess(conversionData) {
    return `✅ **변환 완료!**\n\n` +
           `텍스트: *${conversionData.text}*\n` +
           `음성: ${conversionData.voice.name}\n` +
           `길이: ${conversionData.duration}초`;
  }

  formatVoiceList(language, voices) {
    return `🎤 **${language} 음성 선택**\n\n` +
           voices.map((voice, i) => `${i+1}. ${voice.name} (${voice.gender})`).join('\n');
  }

  formatVoiceChanged(voice) {
    return `✅ **음성이 변경되었습니다**\n\n` +
           `새 음성: *${voice.name}*\n` +
           `언어: ${voice.language}`;
  }

  formatTextInputPrompt(language) {
    return `✏️ **텍스트 입력**\n\n` +
           `변환할 텍스트를 입력하세요.\n` +
           `언어: ${language}\n` +
           `최대 길이: ${this.config.maxTextLength}자`;
  }

  formatShareReady(shareUrl) {
    return `🔗 **공유 링크가 준비되었습니다**\n\n` +
           `링크: ${shareUrl}\n\n` +
           `링크를 복사해서 공유하세요!`;
  }

  formatSettings(userSettings) {
    const voice = this.getVoiceByCode(userSettings.voiceCode);
    return `⚙️ **TTS 설정**\n\n` +
           `현재 음성: *${voice.name}*\n` +
           `언어: ${userSettings.language}\n` +
           `최대 텍스트: ${this.config.maxTextLength}자`;
  }

  formatHelp(helpData) {
    return `❓ **TTS 도움말**\n\n` +
           `**주요 기능:**\n` +
           helpData.features.map(f => `• ${f}`).join('\n') + '\n\n' +
           `**사용법:**\n` +
           helpData.commands.map(c => `• ${c.command}: ${c.description}`).join('\n');
  }

  /**
   * 🎹 키보드 생성 메서드들 (더미)
   */
  createMenuKeyboard() {
    return { inline_keyboard: [[{ text: "🎵 텍스트 변환", callback_data: "tts_convert" }]] };
  }

  createConversionResultKeyboard(conversionData) {
    return { inline_keyboard: [[{ text: "🔗 공유", callback_data: `tts_share_${conversionData.shareUrl}` }]] };
  }

  createVoiceSelectionKeyboard(voices) {
    return { inline_keyboard: voices.map(v => [{ text: v.name, callback_data: `tts_voice_${v.code}` }]) };
  }

  createBackToMenuKeyboard() {
    return { inline_keyboard: [[{ text: "🔙 메뉴로", callback_data: "tts_menu" }]] };
  }

  createTextInputKeyboard() {
    return { inline_keyboard: [[{ text: "❌ 취소", callback_data: "tts_cancel" }]] };
  }

  createShareKeyboard(shareUrl) {
    return { inline_keyboard: [[{ text: "📋 링크 복사", url: shareUrl }]] };
  }

  createSettingsKeyboard() {
    return { inline_keyboard: [[{ text: "🎤 음성 변경", callback_data: "tts_voices" }]] };
  }

  createHelpKeyboard() {
    return { inline_keyboard: [[{ text: "🔙 메뉴로", callback_data: "tts_menu" }]] };
  }

  /**
   * ⚠️ 오류 발행
   */
  async publishError(error, originalEvent) {
    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: this.moduleName,
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: new Date().toISOString()
    });

    await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
      chatId: originalEvent?.payload?.chatId,
      error: error.message
    });
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 TTSModuleV2 정리 시작...");

      // 타이머 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // EventBus 구독 해제
      this.subscriptions.forEach(subscription => {
        logger.debug(`📤 이벤트 구독 해제: ${subscription.eventName || 'unknown'}`);
        if (subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      });
      this.subscriptions.clear();

      // 상태 정리
      this.userStates.clear();

      // 서비스 정리
      if (this.ttsService && typeof this.ttsService.cleanup === 'function') {
        await this.ttsService.cleanup();
      }

      logger.success("✅ TTSModuleV2 정리 완료");
    } catch (error) {
      logger.error("❌ TTSModuleV2 정리 중 오류:", error);
    }
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: !!this.eventBus,
      serviceConnected: !!this.ttsService,
      activeStates: this.userStates.size,
      subscriptions: this.subscriptions.length,
      config: {
        maxTextLength: this.config.maxTextLength,
        supportedLanguages: this.config.supportedLanguages,
        defaultLanguage: this.config.defaultLanguage
      },
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }
}

module.exports = TTSModuleV2;