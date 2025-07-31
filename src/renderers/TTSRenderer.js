// src/renderers/TTSRenderer.js - 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🔊 TTSRenderer - 텍스트 음성 변환 UI 렌더링 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "tts:action:params" 형태 표준화
 * - 음성 변환 프로세스를 파서 규칙으로 단순화
 * - 다양한 음성 선택과 설정 관리 통합 처리
 * - 실시간 변환 상태 업데이트 지원
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 스마트 음성 스튜디오
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 복잡한 음성 변환 과정을 직관적인 버튼으로 제공
 * - 실시간 변환 진행 상황과 시각적 피드백
 * - 다양한 음성과 언어 옵션 관리
 *
 * 🎤 TTS 파서 규칙:
 * - tts:menu → TTS 메인 메뉴
 * - tts:convert → 텍스트 변환 시작
 * - tts:voice:ID → 특정 음성 선택
 * - tts:setting:language → 언어 설정
 * - tts:setting:speed → 속도 설정
 * - tts:cancel → 변환 취소
 */
class TTSRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "tts";

    // 🔊 TTS 특화 설정
    this.config = {
      ...this.config,
      maxTextLength: 5000,
      showProcessingAnimation: true,
      supportedLanguages: ["ko-KR", "en-US", "ja-JP", "zh-CN"],
      defaultLanguage: "ko-KR",
    };

    // 🎭 이모지 컬렉션 (TTS 특화)
    this.emojis = {
      // 기본 TTS 관련
      tts: "🔊",
      voice: "🎤",
      convert: "🎧",
      audio: "🎵",

      // 음성 관련
      male: "👨",
      female: "👩",
      neutral: "👤",

      // 상태
      processing: "⏳",
      success: "✅",
      error: "❌",
      ready: "🟢",

      // 설정
      settings: "⚙️",
      language: "🌐",
      speed: "⚡",
      volume: "🔊",

      // 기능
      history: "🕒",
      help: "❓",
      cancel: "❌",
      retry: "🔄",

      // UI 요소
      input: "📝",
      select: "🎯",
      menu: "📋",
      back: "◀️",

      // 진행 상태
      wave: "🎵",
      note: "🎶",
      mic: "🎙️",
    };

    // 🌐 언어 정보
    this.languages = {
      "ko-KR": { name: "한국어", emoji: "🇰🇷", flag: "🇰🇷" },
      "en-US": { name: "영어 (미국)", emoji: "🇺🇸", flag: "🇺🇸" },
      "en-GB": { name: "영어 (영국)", emoji: "🇬🇧", flag: "🇬🇧" },
      "ja-JP": { name: "일본어", emoji: "🇯🇵", flag: "🇯🇵" },
      "zh-CN": { name: "중국어 (간체)", emoji: "🇨🇳", flag: "🇨🇳" },
      "zh-TW": { name: "중국어 (번체)", emoji: "🇹🇼", flag: "🇹🇼" },
      "es-ES": { name: "스페인어", emoji: "🇪🇸", flag: "🇪🇸" },
      "fr-FR": { name: "프랑스어", emoji: "🇫🇷", flag: "🇫🇷" },
      "de-DE": { name: "독일어", emoji: "🇩🇪", flag: "🇩🇪" },
    };

    // 🎤 음성 매핑 (한국어)
    this.voiceMapping = {
      "ko-KR-Wavenet-A": { name: "유리", gender: "FEMALE", quality: "premium" },
      "ko-KR-Wavenet-B": { name: "철수", gender: "MALE", quality: "premium" },
      "ko-KR-Wavenet-C": { name: "수진", gender: "FEMALE", quality: "premium" },
      "ko-KR-Wavenet-D": { name: "영호", gender: "MALE", quality: "premium" },
      "ko-KR-Standard-A": {
        name: "나래",
        gender: "FEMALE",
        quality: "standard",
      },
      "ko-KR-Standard-B": { name: "준우", gender: "MALE", quality: "standard" },
      "ko-KR-Standard-C": {
        name: "다솜",
        gender: "FEMALE",
        quality: "standard",
      },
      "ko-KR-Standard-D": { name: "민준", gender: "MALE", quality: "standard" },
    };

    logger.debug("🔊 TTSRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, {
      dataKeys: Object.keys(data || {}),
      hasData: !!data,
    });

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "convert_input":
          return await this.renderConvertInput(data, ctx);

        case "processing":
          return await this.renderProcessing(data, ctx);

        case "convert_success":
          return await this.renderConvertSuccess(data, ctx);

        case "voice_list":
          return await this.renderVoiceList(data, ctx);

        case "voice_selected":
          return await this.renderVoiceSelected(data, ctx);

        case "settings":
          return await this.renderSettings(data, ctx);

        case "setting_changed":
          return await this.renderSettingChanged(data, ctx);

        case "history":
          return await this.renderHistory(data, ctx);

        case "empty_history":
          return await this.renderEmptyHistory(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "input_error":
          return await this.renderInputError(data, ctx);

        case "convert_error":
          return await this.renderConvertError(data, ctx);

        case "info":
          return await this.renderInfo(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "알 수 없는 오류가 발생했습니다.",
            ctx
          );

        default:
          this.warn(`지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            `지원하지 않는 기능입니다: ${type}`,
            ctx
          );
      }
    } catch (error) {
      this.error(`렌더링 오류 (${type})`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다.", ctx);
    }
  }

  // ===== 🔊 메인 메뉴 렌더링 =====

  /**
   * 🔊 TTS 메인 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMenu(data, ctx) {
    this.debug("TTS 메뉴 렌더링", {
      hasStats: !!data?.stats,
      userName: data?.userName,
      isServiceActive: data?.isServiceActive,
    });

    const { userName, stats, isServiceActive = true, defaultLanguage } = data;

    let text = `${this.emojis.tts} **음성 변환 서비스 \\- ${userName}**\n\n`;

    // 두목봇 환영 인사
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsWelcome",
      userName
    );
    text += `💬 ${welcomeMessage}\n\n`;

    // 서비스 상태
    text += `🔧 **서비스 상태**: ${
      isServiceActive ? "🟢 정상 작동" : "🔴 일시 중단"
    }\n`;

    // 기본 언어 설정
    if (defaultLanguage) {
      const langInfo = this.languages[defaultLanguage];
      if (langInfo) {
        text += `🌐 **기본 언어**: ${langInfo.flag} ${langInfo.name}\n`;
      }
    }

    // 사용자 통계
    if (stats) {
      text += `\n📊 **나의 사용 기록**\n`;
      text += `• 총 변환 횟수: ${stats.totalConversions || 0}회\n`;

      if (stats.favoriteVoice) {
        const voiceInfo = this.getVoiceInfo(stats.favoriteVoice);
        text += `• 선호 음성: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
      }

      if (stats.lastConversion) {
        const lastDate = new Date(stats.lastConversion).toLocaleDateString(
          "ko-KR"
        );
        text += `• 마지막 변환: ${lastDate}\n`;
      }
    }

    text += "\n✨ **어떤 작업을 하시겠습니까\\?**";

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [];

    if (isServiceActive) {
      buttons.push([
        { text: `${this.emojis.voice} 텍스트 변환`, action: "convert" },
        { text: `${this.emojis.mic} 음성 선택`, action: "voices" },
      ]);
    }

    buttons.push([
      { text: `${this.emojis.history} 변환 기록`, action: "history" },
      { text: `${this.emojis.settings} 설정`, action: "settings" },
    ]);

    buttons.push([
      { text: `${this.emojis.help} 사용법`, action: "help" },
      this.createHomeButton(),
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎤 텍스트 변환 렌더링 =====

  /**
   * 📝 텍스트 입력 프롬프트 렌더링
   */
  async renderConvertInput(data, ctx) {
    this.debug("텍스트 입력 렌더링", { language: data?.language });

    const { language, currentVoice, maxLength } = data;
    const textLimit = maxLength || this.config.maxTextLength;

    let text = `${this.emojis.input} **텍스트 변환 입력**\n\n`;
    text += `📝 **변환할 텍스트를 입력하세요\\!**\n\n`;

    // 현재 설정 표시
    text += `⚙️ **현재 설정**\n`;
    if (language) {
      const langInfo = this.languages[language];
      text += `• 언어: ${
        langInfo ? `${langInfo.flag} ${langInfo.name}` : language
      }\n`;
    }

    if (currentVoice) {
      const voiceInfo = this.getVoiceInfo(currentVoice);
      text += `• 음성: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
    }

    // 입력 제한 안내
    text += `\n📏 **입력 제한**\n`;
    text += `• 최대 ${textLimit.toLocaleString()}자까지 가능\n`;
    text += `• 최소 1자 이상 입력\n\n`;

    text += `💡 **더 자연스러운 음성을 위한 팁**\n`;
    text += `• 구두점(\\. \\, \\! \\?)을 적절히 사용하세요\n`;
    text += `• 긴 텍스트는 문장 단위로 나누어 변환하세요\n`;
    text += `• 숫자나 특수문자는 한글로 풀어 쓰세요\n`;
    text += `• 전문용어는 쉬운 말로 바꾸어 보세요\n\n`;

    text += `💬 **메시지로 텍스트를 보내주세요\\!**`;

    const buttons = [
      [
        { text: `${this.emojis.mic} 음성 변경`, action: "voices" },
        {
          text: `${this.emojis.language} 언어 변경`,
          action: "setting",
          params: "language",
        },
      ],
      [
        { text: `${this.emojis.cancel} 취소`, action: "menu" },
        { text: `${this.emojis.help} 도움말`, action: "help" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⏳ 변환 진행 중 렌더링
   */
  async renderProcessing(data, ctx) {
    this.debug("변환 진행 중 렌더링");

    const { userName, textPreview, voice } = data;

    let text = `${this.emojis.processing} **음성 변환 진행 중\\.\\.\\.**\n\n`;

    // 두목봇 처리 멘트
    const processingMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsProcessing",
      userName
    );
    text += `💬 ${processingMessage}\n\n`;

    // 변환 정보
    text += `🎯 **변환 정보**\n`;
    if (textPreview) {
      text += `• 텍스트: "${textPreview}..."\n`;
    }

    if (voice) {
      const voiceInfo = this.getVoiceInfo(voice);
      text += `• 음성: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
    }

    text += `\n${this.emojis.wave} **고품질 음성으로 변환하고 있습니다\\.**\n`;
    text += `${this.emojis.note} **잠시만 기다려주세요\\!**\n\n`;

    // 진행 애니메이션
    if (this.config.showProcessingAnimation) {
      text += `🎵━━━━━━━━━━ 변환 중`;
    }

    // 취소 버튼만 제공
    const buttons = [
      [{ text: `${this.emojis.cancel} 변환 취소`, action: "cancel" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 변환 성공 렌더링
   */
  async renderConvertSuccess(data, ctx) {
    this.debug("변환 성공 렌더링");

    const { userName, voice, duration, textPreview } = data;

    let text = `${this.emojis.success} **음성 변환 완료\\!**\n\n`;

    // 두목봇 성공 멘트
    const successMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsSuccess",
      userName
    );
    text += `💬 ${successMessage}\n\n`;

    // 변환 결과 정보
    text += `🎵 **변환 결과**\n`;
    if (textPreview) {
      text += `• 원본 텍스트: "${textPreview}"\n`;
    }

    if (voice) {
      const voiceInfo = this.getVoiceInfo(voice);
      text += `• 사용 음성: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
    }

    if (duration) {
      text += `• 재생 시간: 약 ${duration}초\n`;
    }

    text += `\n🎧 **음성 파일이 위에 전송되었습니다\\.**\n`;
    text += `✨ **다른 텍스트도 변환해보세요\\!**`;

    const buttons = [
      [
        { text: `${this.emojis.convert} 다시 변환`, action: "convert" },
        { text: `${this.emojis.mic} 음성 변경`, action: "voices" },
      ],
      [
        { text: `${this.emojis.history} 변환 기록`, action: "history" },
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎭 음성 선택 렌더링 =====

  /**
   * 🎭 음성 목록 렌더링
   */
  async renderVoiceList(data, ctx) {
    this.debug("음성 목록 렌더링", { voiceCount: data?.voices?.length });

    const { voices, currentVoice, language } = data;

    let text = `${this.emojis.mic} **음성 선택**\n\n`;

    if (language) {
      const langInfo = this.languages[language];
      if (langInfo) {
        text += `🌐 **언어**: ${langInfo.flag} ${langInfo.name}\n\n`;
      }
    }

    if (!voices || voices.length === 0) {
      text += `${this.emojis.error} 사용 가능한 음성이 없습니다\\.\n`;
      text += "잠시 후 다시 시도해주세요\\.";

      const buttons = [
        [
          { text: `${this.emojis.retry} 다시 시도`, action: "voices" },
          { text: `${this.emojis.menu} 메뉴`, action: "menu" },
        ],
      ];

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }

    text += `🎯 **원하는 음성을 선택해주세요** (${voices.length}개 사용 가능)\n\n`;

    // 음성 목록 표시
    const voiceButtons = [];
    voices.slice(0, 8).forEach((voice, index) => {
      const voiceInfo = this.getVoiceInfo(voice.id || voice.name);
      const isSelected = currentVoice === voice.id;

      text += `${voiceInfo.emoji} **${voiceInfo.name}** (${voiceInfo.genderLabel})`;
      if (voiceInfo.quality === "premium") {
        text += ` ⭐`;
      }
      if (isSelected) {
        text += ` ${this.emojis.success}`;
      }
      text += `\n`;

      // 버튼 생성 (2열 배치)
      if (index % 2 === 0) {
        voiceButtons.push([]);
      }

      const currentRow = voiceButtons[voiceButtons.length - 1];
      currentRow.push({
        text: `${voiceInfo.emoji} ${voiceInfo.name}${isSelected ? " ✓" : ""}`,
        action: "voice",
        params: voice.id || voice.name,
      });
    });

    if (voices.length > 8) {
      text += `\n... 외 ${voices.length - 8}개 음성`;
    }

    // 하단 메뉴
    voiceButtons.push([
      { text: `${this.emojis.convert} 변환 시작`, action: "convert" },
      { text: `${this.emojis.retry} 새로고침`, action: "voices" },
    ]);

    voiceButtons.push([
      { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
      this.createHomeButton(),
    ]);

    const keyboard = this.createInlineKeyboard(voiceButtons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 음성 선택 완료 렌더링
   */
  async renderVoiceSelected(data, ctx) {
    this.debug("음성 선택 완료 렌더링");

    const { voice, userName } = data;
    const voiceInfo = this.getVoiceInfo(voice);

    let text = `${this.emojis.success} **음성 선택 완료\\!**\n\n`;
    text += `🎭 **선택된 음성**: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
    text += `👤 **성별**: ${voiceInfo.genderLabel}\n`;

    if (voiceInfo.quality === "premium") {
      text += `⭐ **품질**: 프리미엄\n`;
    }

    text += `\n💡 **${voiceInfo.name} 음성으로 텍스트를 변환할 준비가 되었습니다\\!**`;

    const buttons = [
      [
        { text: `${this.emojis.convert} 바로 변환하기`, action: "convert" },
        { text: `${this.emojis.mic} 다른 음성 선택`, action: "voices" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });

    // 2초 후 자동으로 변환 모드로 이동
    setTimeout(async () => {
      try {
        const convertResult = {
          type: "convert_input",
          data: { voice, language: "ko-KR" },
        };
        await this.render(convertResult, ctx);
      } catch (error) {
        this.warn("자동 변환 모드 전환 실패", error);
      }
    }, 2000);
  }

  // ===== ⚙️ 설정 렌더링 =====

  /**
   * ⚙️ 설정 메뉴 렌더링
   */
  async renderSettings(data, ctx) {
    this.debug("설정 메뉴 렌더링");

    const { settings, userName } = data;

    let text = `${this.emojis.settings} **TTS 설정 \\- ${userName}**\n\n`;

    if (settings) {
      text += `🔧 **현재 설정**\n`;

      // 언어 설정
      if (settings.language) {
        const langInfo = this.languages[settings.language];
        text += `• 기본 언어: ${
          langInfo ? `${langInfo.flag} ${langInfo.name}` : settings.language
        }\n`;
      }

      // 음성 설정
      if (settings.voice) {
        const voiceInfo = this.getVoiceInfo(settings.voice);
        text += `• 기본 음성: ${voiceInfo.emoji} ${voiceInfo.name}\n`;
      }

      // 기타 설정들
      if (settings.speed !== undefined) {
        text += `• 음성 속도: ${settings.speed}x\n`;
      }

      if (settings.volume !== undefined) {
        text += `• 음성 볼륨: ${settings.volume}%\n`;
      }

      if (settings.autoDelete !== undefined) {
        text += `• 자동 삭제: ${settings.autoDelete ? "켜짐" : "꺼짐"}\n`;
      }
    }

    text += `\n⚙️ **변경할 설정을 선택하세요**`;

    const buttons = [
      [
        {
          text: `${this.emojis.language} 언어 설정`,
          action: "setting",
          params: "language",
        },
        {
          text: `${this.emojis.mic} 기본 음성`,
          action: "setting",
          params: "voice",
        },
      ],
      [
        {
          text: `${this.emojis.speed} 속도 설정`,
          action: "setting",
          params: "speed",
        },
        {
          text: `${this.emojis.volume} 볼륨 설정`,
          action: "setting",
          params: "volume",
        },
      ],
      [
        { text: "🗑️ 자동 삭제", action: "setting", params: "autodelete" },
        { text: "🔄 기본값 복원", action: "setting", params: "reset" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 설정 변경 완료 렌더링
   */
  async renderSettingChanged(data, ctx) {
    this.debug("설정 변경 완료 렌더링", { setting: data.setting });

    const { setting, oldValue, newValue, message } = data;

    let text = `${this.emojis.success} **설정 변경 완료\\!**\n\n`;
    text += `⚙️ **변경된 설정**: ${setting}\n`;

    if (oldValue && newValue) {
      text += `• 이전 값: ${oldValue}\n`;
      text += `• 새 값: **${newValue}**\n`;
    }

    if (message) {
      text += `\n💡 ${message}`;
    }

    const buttons = [
      [
        { text: `${this.emojis.settings} 설정 메뉴`, action: "settings" },
        { text: `${this.emojis.convert} 변환 테스트`, action: "convert" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🕒 기록 렌더링 =====

  /**
   * 🕒 변환 기록 렌더링
   */
  async renderHistory(data, ctx) {
    this.debug("변환 기록 렌더링", { historyCount: data?.history?.length });

    const { history, stats, userName } = data;

    let text = `${this.emojis.history} **변환 기록 \\- ${userName}**\n\n`;

    if (!history || history.length === 0) {
      return await this.renderEmptyHistory(data, ctx);
    }

    // 통계 요약
    if (stats) {
      text += `📊 **요약**: 총 ${history.length}건, 최근 ${
        stats.recentCount || 10
      }건 표시\n\n`;
    }

    text += `📝 **최근 변환 기록**\n`;

    // 기록 목록 (최대 10개)
    const recentHistory = history.slice(0, 10);

    recentHistory.forEach((item, index) => {
      const date = new Date(item.createdAt).toLocaleDateString("ko-KR");
      const time = new Date(item.createdAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const voiceInfo = this.getVoiceInfo(item.voice);
      const textPreview =
        item.text?.substring(0, 30) + (item.text?.length > 30 ? "..." : "");

      text += `\n${index + 1}\\. ${voiceInfo.emoji} "${textPreview}"\n`;
      text += `   📅 ${date} ${time}`;

      if (item.duration) {
        text += ` | ⏱️ ${item.duration}초`;
      }
    });

    if (history.length > 10) {
      text += `\n\n... 외 ${history.length - 10}개 기록`;
    }

    const buttons = [
      [
        { text: `${this.emojis.convert} 새 변환`, action: "convert" },
        { text: "🗑️ 기록 정리", action: "history", params: "clean" },
      ],
      [
        { text: "📊 통계 보기", action: "history", params: "stats" },
        { text: "🔄 새로고침", action: "history" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📭 빈 기록 상태 렌더링
   */
  async renderEmptyHistory(data, ctx) {
    this.debug("빈 기록 상태 렌더링");

    const { userName } = data;

    let text = `${this.emojis.info} **아직 변환 기록이 없어요\\!**\n\n`;
    text += `👋 ${userName}님, 첫 번째 음성 변환을 시작해보세요\\!\n\n`;
    text += "💡 **시작 가이드**:\n";
    text += `• ${this.emojis.convert} 간단한 인사말부터 시작\n`;
    text += `• ${this.emojis.mic} 좋아하는 음성 선택하기\n`;
    text += `• 📝 업무용 멘트 만들기\n`;
    text += `• 🎵 창작 활동에 활용하기`;

    const buttons = [
      [{ text: `${this.emojis.convert} 첫 변환 시작`, action: "convert" }],
      [
        { text: `${this.emojis.mic} 음성 선택`, action: "voices" },
        { text: `${this.emojis.help} 사용법`, action: "help" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ❓ 도움말 및 에러 렌더링 =====

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("도움말 렌더링");

    let text = `${this.emojis.help} **TTS 음성 변환 사용법**\n\n`;
    text += `${this.emojis.tts} **두목봇의 고품질 음성 변환 서비스\\!**\n\n`;

    text += "📱 **주요 기능**\n";
    text += `• ${this.emojis.convert} **텍스트 변환** \\- 텍스트를 자연스러운 음성으로\n`;
    text += `• ${this.emojis.mic} **음성 선택** \\- 다양한 목소리 중 선택\n`;
    text += `• ${this.emojis.language} **다국어 지원** \\- 여러 언어로 변환 가능\n`;
    text += `• ${this.emojis.settings} **세부 설정** \\- 속도, 볼륨 등 조정\n\n`;

    text += "📝 **사용 방법**\n";
    text += "1\\. `🎤 텍스트 변환` 클릭\n";
    text += "2\\. 변환할 텍스트 메시지로 전송\n";
    text += "3\\. 음성 파일 받기\n";
    text += "4\\. 필요시 음성이나 설정 변경\n\n";

    text += "🎭 **지원 음성**\n";
    text += `• ${this.emojis.female} **여성 음성**: 유리, 수진, 나래, 다솜\n`;
    text += `• ${this.emojis.male} **남성 음성**: 철수, 영호, 준우, 민준\n`;
    text += `• ⭐ **프리미엄**: Wavenet 고품질 음성\n`;
    text += `• 🔧 **표준**: Standard 기본 음성\n\n`;

    text += "💡 **더 자연스러운 음성을 위한 팁**\n";
    text += "• 구두점 사용으로 자연스러운 억양 만들기\n";
    text += "• 숫자는 한글로 풀어서 입력하기\n";
    text += "• 긴 텍스트는 문장 단위로 분할하기\n";
    text += "• 전문용어는 쉬운 말로 대체하기\n\n";

    text += "📏 **제한사항**\n";
    text += `• 최대 ${this.config.maxTextLength.toLocaleString()}자까지 변환 가능\n`;
    text += "• 한 번에 하나의 텍스트만 처리\n";
    text += "• 일부 특수문자는 지원되지 않음\n\n";

    text += "✨ **두목봇과 함께 생생한 음성 콘텐츠를 만들어보세요\\!**";

    const buttons = [
      [
        { text: `${this.emojis.convert} 첫 변환 시작`, action: "convert" },
        { text: `${this.emojis.mic} 음성 들어보기`, action: "voices" },
      ],
      [
        { text: `${this.emojis.settings} 설정하기`, action: "settings" },
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 입력 에러 렌더링
   */
  async renderInputError(data, ctx) {
    this.debug("입력 에러 렌더링");

    const { message, textLength, maxLength } = data;

    let text = `${this.emojis.error} **입력 오류**\n\n`;
    text += `⚠️ ${message}\n\n`;

    if (textLength && maxLength) {
      text += `📏 **텍스트 길이**: ${textLength.toLocaleString()}자\n`;
      text += `📏 **최대 허용**: ${maxLength.toLocaleString()}자\n\n`;
    }

    text += "💡 **해결 방법**:\n";
    text += "• 텍스트를 더 짧게 줄여보세요\n";
    text += "• 문장 단위로 나누어 변환하세요\n";
    text += "• 불필요한 내용을 제거해보세요";

    const buttons = [
      [
        { text: `${this.emojis.retry} 다시 입력`, action: "convert" },
        { text: `${this.emojis.help} 사용법`, action: "help" },
      ],
      [
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 변환 에러 렌더링
   */
  async renderConvertError(data, ctx) {
    this.debug("변환 에러 렌더링");

    const { message, errorCode, userName } = data;

    let text = `${this.emojis.error} **변환 실패**\n\n`;
    text += `❌ ${message}\n\n`;

    if (errorCode) {
      text += `🔧 **오류 코드**: ${errorCode}\n\n`;
    }

    text += "🛠️ **해결 방법**:\n";
    text += "• 잠시 후 다시 시도해보세요\n";
    text += "• 텍스트를 다르게 작성해보세요\n";
    text += "• 음성을 변경해보세요\n";
    text += "• 언어 설정을 확인해보세요";

    const buttons = [
      [
        { text: `${this.emojis.retry} 다시 시도`, action: "convert" },
        { text: `${this.emojis.mic} 음성 변경`, action: "voices" },
      ],
      [
        { text: `${this.emojis.settings} 설정 확인`, action: "settings" },
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 메시지 렌더링
   */
  async renderInfo(data, ctx) {
    this.debug("정보 메시지 렌더링");

    const { message, type = "info" } = data;

    const typeEmojis = {
      info: this.emojis.info,
      warning: this.emojis.warning,
      success: this.emojis.success,
    };

    let text = `${typeEmojis[type] || this.emojis.info} **알림**\n\n`;
    text += `${message}`;

    const buttons = [
      [
        { text: `${this.emojis.convert} 변환 시작`, action: "convert" },
        { text: `${this.emojis.menu} TTS 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎨 헬퍼 메서드들 =====

  /**
   * 🎤 음성 정보 가져오기
   */
  getVoiceInfo(voiceId) {
    const voiceInfo = this.voiceMapping[voiceId];

    if (voiceInfo) {
      return {
        name: voiceInfo.name,
        gender: voiceInfo.gender,
        genderLabel: voiceInfo.gender === "FEMALE" ? "여성" : "남성",
        emoji:
          voiceInfo.gender === "FEMALE" ? this.emojis.female : this.emojis.male,
        quality: voiceInfo.quality,
      };
    }

    // 폴백 정보
    const fallbackName = voiceId?.split("-").pop() || "기본음성";
    const isFemale = voiceId?.toUpperCase().includes("FEMALE");

    return {
      name: fallbackName,
      gender: isFemale ? "FEMALE" : "MALE",
      genderLabel: isFemale ? "여성" : "남성",
      emoji: isFemale ? this.emojis.female : this.emojis.male,
      quality: "standard",
    };
  }

  /**
   * 🌐 언어 정보 가져오기
   */
  getLanguageInfo(languageCode) {
    return (
      this.languages[languageCode] || {
        name: languageCode,
        emoji: "🌐",
        flag: "🌐",
      }
    );
  }

  // ===== 🧪 레거시 호환성 메서드들 =====

  /**
   * 📤 레거시 메시지 전송 (호환성 유지)
   * @deprecated BaseRenderer.sendSafeMessage 사용 권장
   */
  async sendMessage(chatId, text, keyboard, messageId) {
    try {
      const options = {
        reply_markup: keyboard,
        parse_mode: this.config.defaultParseMode,
      };

      if (messageId) {
        return await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        return await this.bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      this.warn("레거시 메시지 전송 실패, 안전 모드로 전환", error);

      // 안전한 전송으로 폴백
      const ctx = {
        chat: { id: chatId },
        callbackQuery: messageId
          ? { message: { message_id: messageId } }
          : null,
      };

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }
  }
}

module.exports = TTSRenderer;
