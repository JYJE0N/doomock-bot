// src/renderers/TTSRenderer.js - TTS 전용 렌더러
const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🔊 TTSRenderer - TTS 음성변환 UI 렌더링 전담
 *
 * ✅ 담당 기능:
 * - TTS 메뉴 렌더링
 * - 텍스트 입력 프롬프트
 * - 음성 변환 진행 상황
 * - 변환 결과 표시
 * - 음성 설정 화면
 * - 변환 기록 표시
 */
class TTSRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "tts";
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderTTSMenu(data, ctx);

      case "input":
        return await this.renderTextInput(data, ctx);

      case "processing":
        return await this.renderProcessing(data, ctx);

      case "success":
        return await this.renderSuccess(data, ctx);

      case "voices":
      case "list":
        return await this.renderVoiceList(data, ctx);

      case "history":
        return await this.renderHistory(data, ctx);

      case "settings":
        return await this.renderSettings(data, ctx);

      case "help":
        return await this.renderHelp(data, ctx);

      case "empty":
        return await this.renderEmpty(data, ctx);

      default:
        return await this.renderError("지원하지 않는 TTS 기능입니다.", ctx);
    }
  }

  /**
   * 🔊 TTS 메뉴 렌더링
   */
  async renderTTSMenu(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "🔊 *음성 변환 서비스*\n\n";

    // 두목봇 환영 인사
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsWelcome",
      userName
    );
    text += `${this.escapeMarkdownV2(welcomeMessage)}\n\n`;

    // 서비스 상태 표시
    if (data?.isServiceActive) {
      text += "✅ *서비스 상태*: 정상 작동 중\n";
    } else {
      text += "❌ *서비스 상태*: 일시적 오류\n";
    }

    // 기본 언어 설정
    if (data?.defaultLanguage) {
      const languageName = this.getLanguageName(data.defaultLanguage);
      text += `🌐 *기본 언어*: ${this.escapeMarkdownV2(languageName)}\n`;
    }

    // 사용자 통계
    if (data?.stats) {
      const stats = data.stats;
      text += `\n📊 *사용 통계*:\n`;
      text += `• 총 변환 횟수: ${this.escapeMarkdownV2(
        String(stats.totalConversions || 0)
      )}회\n`;

      if (stats.lastConversion) {
        const lastDate = new Date(stats.lastConversion).toLocaleDateString(
          "ko-KR"
        );
        text += `• 마지막 변환: ${this.escapeMarkdownV2(lastDate)}\n`;
      }
    }

    text += "\n원하는 기능을 선택해주세요\\:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎤 텍스트 변환", callback_data: "tts:convert" },
          { text: "🎭 음성 선택", callback_data: "tts:voices" },
        ],
        [
          { text: "🕒 변환 기록", callback_data: "tts:history" },
          { text: "⚙️ 설정", callback_data: "tts:settings" },
        ],
        [
          { text: "❓ 도움말", callback_data: "tts:help" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 📝 텍스트 입력 프롬프트 렌더링
   */
  async renderTextInput(data, ctx) {
    let text = "📝 *텍스트 입력*\n\n";
    text += "변환할 텍스트를 입력하세요\\!\n\n";

    // 입력 제한 안내
    const maxLength = data?.maxLength || 5000;
    text += `📏 *제한사항*:\n`;
    text += `• 최대 ${this.escapeMarkdownV2(String(maxLength))}자까지 가능\n`;

    // 언어 설정 표시
    if (data?.language) {
      const languageName = this.getLanguageName(data.language);
      text += `• 언어: ${this.escapeMarkdownV2(languageName)}\n`;
    }

    text += "\n💡 *팁*:\n";
    text += "• 구두점을 적절히 사용하면 더 자연스러워집니다\n";
    text += "• 긴 텍스트는 문장 단위로 나누어 변환하세요\n";
    text += "• 숫자나 특수문자는 한글로 풀어서 입력하세요\n\n";

    text += "텍스트를 보내주세요\\:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎭 음성 변경", callback_data: "tts:voices" },
          { text: "❌ 취소", callback_data: "tts:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ⏳ 처리 중 화면 렌더링
   */
  async renderProcessing(data, ctx) {
    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    let text = "⏳ *음성 변환 중\\.\\.\\.*\n\n";

    // 두목봇 처리 멘트
    const processingMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsProcessing",
      userName
    );
    text += `${this.escapeMarkdownV2(processingMessage)}\n\n`;

    text += "🔊 고품질 음성으로 변환하고 있습니다\\.\n";
    text += "잠시만 기다려주세요\\!\n\n";

    // 진행 상황 표시 (애니메이션 효과)
    text += "🎵━━━━━━━━━━ 처리중";

    // 취소 버튼만 제공
    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "tts:menu" }]],
    };

    await this.sendMessage(
      ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ✅ 변환 성공 화면 렌더링
   */
  async renderSuccess(data, ctx) {
    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    let text = "✅ *음성 변환 완료\\!*\n\n";

    // 두목봇 성공 멘트
    const successMessage = DoomockMessageGenerator.getContextualMessage(
      "ttsSuccess",
      userName
    );
    text += `${this.escapeMarkdownV2(successMessage)}\n\n`;

    // 변환 결과 정보
    if (data?.result) {
      const result = data.result;
      text += "🎵 *변환 정보*:\n";

      if (result.duration) {
        text += `• 재생 시간: 약 ${this.escapeMarkdownV2(
          String(result.duration)
        )}초\n`;
      }

      if (result.language) {
        const languageName = this.getLanguageName(result.language);
        text += `• 언어: ${this.escapeMarkdownV2(languageName)}\n`;
      }

      if (result.voice) {
        text += `• 음성: ${this.escapeMarkdownV2(result.voice)}\n`;
      }

      text += "\n";
    }

    text += "🎧 음성 파일이 위에 전송되었습니다\\.\n";
    text += "다른 텍스트도 변환해보세요\\!";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 다시 변환", callback_data: "tts:convert" },
          { text: "🎭 음성 변경", callback_data: "tts:voices" },
        ],
        [
          { text: "🕒 변환 기록", callback_data: "tts:history" },
          { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
      text,
      keyboard
    );
  }

  /**
   * 🎭 음성 목록 렌더링
   */
  async renderVoiceList(data, ctx) {
    let text = "🎭 *사용 가능한 음성*\n\n";

    const voices = data?.items || [];

    if (voices.length === 0) {
      text += "현재 사용 가능한 음성이 없습니다\\.\n";
      text += "잠시 후 다시 시도해주세요\\.";

      const keyboard = {
        inline_keyboard: [[{ text: "📋 TTS 메뉴", callback_data: "tts:menu" }]],
      };

      // ✅ 수정: 안전한 메시지 전송
      return await this.sendSafeMessage(ctx, text, keyboard);
    }

    text += "원하는 음성을 선택해주세요\\:\n\n";

    const keyboard = { inline_keyboard: [] };

    // 음성 목록 표시 (최대 8개)
    const displayVoices = voices.slice(0, 8);

    displayVoices.forEach((voice, index) => {
      const genderIcon = this.getGenderIcon(voice.description);
      const voiceName = voice.title || voice.id;
      const description = voice.description
        ? ` (${this.escapeMarkdownV2(voice.description)})`
        : "";

      text += `${genderIcon} *${this.escapeMarkdownV2(
        voiceName
      )}*${description}\n`;

      // 음성 선택 버튼 (2열 배치)
      if (index % 2 === 0) {
        keyboard.inline_keyboard.push([]);
      }

      const currentRow =
        keyboard.inline_keyboard[keyboard.inline_keyboard.length - 1];
      currentRow.push({
        text: `${genderIcon} ${voiceName}`,
        callback_data: `tts:voice:${voice.id}`,
      });
    });

    // 추가 메뉴 버튼
    keyboard.inline_keyboard.push([
      { text: "🔄 새로고침", callback_data: "tts:voices" },
      { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
    ]);

    // ✅ 수정: 안전한 메시지 전송
    return await this.sendSafeMessage(ctx, text, keyboard);
  }

  /**
   * 🛡️ 안전한 메시지 전송 메서드 (편집 실패 시 새 메시지 전송)
   */
  async sendSafeMessage(ctx, text, keyboard) {
    try {
      // 우선 메시지 편집 시도
      if (ctx.callbackQuery?.message?.message_id) {
        await this.sendMessage(
          ctx.callbackQuery.message.chat.id,
          text,
          keyboard,
          ctx.callbackQuery.message.message_id
        );
      } else {
        // 편집할 메시지가 없으면 새 메시지 전송
        await this.sendMessage(
          ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
          text,
          keyboard
        );
      }
    } catch (error) {
      logger.warn("메시지 편집 실패, 새 메시지로 전송:", error.message);

      // 편집 실패 시 새 메시지로 전송
      await this.sendMessage(
        ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
        text,
        keyboard
      );
    }
  }

  /**
   * 🕒 변환 기록 렌더링
   */
  async renderHistory(data, ctx) {
    let text = "🕒 *변환 기록*\n\n";

    const history = data?.items || [];

    if (history.length === 0) {
      return await this.renderEmpty(data, ctx);
    }

    text += "최근 변환 기록입니다\\:\n\n";

    // 기록 목록 표시 (최대 10개)
    const displayHistory = history.slice(0, 10);

    displayHistory.forEach((item, index) => {
      const date = new Date(item.createdAt || Date.now()).toLocaleDateString(
        "ko-KR"
      );
      const time = new Date(item.createdAt || Date.now()).toLocaleTimeString(
        "ko-KR",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      text += `${index + 1}\\. ${this.escapeMarkdownV2(item.title)}\n`;
      text += `   📅 ${this.escapeMarkdownV2(date)} ${this.escapeMarkdownV2(
        time
      )}\n`;

      if (item.description) {
        text += `   ${this.escapeMarkdownV2(item.description)}\n`;
      }
      text += "\n";
    });

    // 더 많은 기록이 있는 경우
    if (history.length > 10) {
      text += `\\.\\.\\. 외 ${history.length - 10}개 더 있습니다\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 새 변환", callback_data: "tts:convert" },
          { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ⚙️ 설정 화면 렌더링
   */
  async renderSettings(data, ctx) {
    let text = "⚙️ *TTS 설정*\n\n";

    if (data?.settings) {
      const settings = data.settings;

      text += "현재 설정 상태\\:\n\n";

      settings.forEach((setting) => {
        const icon =
          setting.type === "boolean" ? (setting.value ? "✅" : "❌") : "🔧";

        text += `${icon} *${this.escapeMarkdownV2(setting.label)}*:\n`;
        text += `   ${this.escapeMarkdownV2(String(setting.value))}\n\n`;
      });
    }

    text += "설정을 변경하려면 아래 버튼을 선택하세요\\:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌐 언어 설정", callback_data: "tts:setting:language" },
          { text: "🎭 기본 음성", callback_data: "tts:setting:voice" },
        ],
        [
          { text: "🔊 음량 설정", callback_data: "tts:setting:volume" },
          { text: "⚡ 속도 설정", callback_data: "tts:setting:speed" },
        ],
        [
          { text: "🗑️ 자동 삭제", callback_data: "tts:setting:autodelete" },
          { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    let text = "❓ *TTS 도움말*\n\n";

    text += "🔊 *음성 변환 서비스란\\?*\n";
    text += "텍스트를 자연스러운 음성으로 변환해주는 서비스입니다\\.\n\n";

    text += "📝 *사용 방법*:\n";
    text += "1\\. `🎤 텍스트 변환` 클릭\n";
    text += "2\\. 변환할 텍스트 입력\n";
    text += "3\\. 음성 파일 받기\n\n";

    text += "🎭 *음성 선택*:\n";
    text += "• 다양한 음성 중 선택 가능\n";
    text += "• 남성/여성 음성 지원\n";
    text += "• 언어별 최적화된 음성\n\n";

    text += "📏 *제한사항*:\n";
    text += "• 최대 5000자까지 변환 가능\n";
    text += "• 한 번에 하나의 텍스트만 처리\n";
    text += "• 일부 특수문자는 지원되지 않음\n\n";

    text += "💡 *팁*:\n";
    text += "• 구두점 사용으로 자연스러운 억양\n";
    text += "• 숫자는 한글로 풀어서 입력\n";
    text += "• 긴 텍스트는 문장 단위로 분할\n";
    text += "• 전문용어는 쉬운 말로 대체\n\n";

    text += "🌐 *지원 언어*:\n";
    text += "• 한국어 \\(Korean\\)\n";
    text += "• 영어 \\(English\\)\n";
    text += "• 일본어 \\(Japanese\\)\n";
    text += "• 중국어 \\(Chinese\\)";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 변환 시작", callback_data: "tts:convert" },
          { text: "🎭 음성 선택", callback_data: "tts:voices" },
        ],
        [
          { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📭 빈 화면 렌더링
   */
  async renderEmpty(data, ctx) {
    let text = "📭 *변환 기록 없음*\n\n";
    text += "아직 변환 기록이 없습니다\\.\n";
    text += "첫 번째 음성 변환을 시작해보세요\\!\n\n";

    text += "🎤 *변환 시작하기*:\n";
    text += "• 간단한 인사말부터 시작\n";
    text += "• 좋아하는 문구 변환해보기\n";
    text += "• 업무용 멘트 만들기";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎤 첫 변환 시작", callback_data: "tts:convert" },
          { text: "📋 TTS 메뉴", callback_data: "tts:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 🌐 언어명 반환
   */
  getLanguageName(languageCode) {
    const languages = {
      "ko-KR": "한국어",
      "en-US": "영어 (미국)",
      "en-GB": "영어 (영국)",
      "ja-JP": "일본어",
      "zh-CN": "중국어 (간체)",
      "zh-TW": "중국어 (번체)",
      "es-ES": "스페인어",
      "fr-FR": "프랑스어",
      "de-DE": "독일어",
    };

    return languages[languageCode] || languageCode;
  }

  /**
   * 👤 성별 아이콘 반환
   */
  getGenderIcon(description) {
    if (!description) return "🎭";

    const desc = description.toLowerCase();
    if (
      desc.includes("female") ||
      desc.includes("woman") ||
      desc.includes("여성")
    ) {
      return "👩";
    } else if (
      desc.includes("male") ||
      desc.includes("man") ||
      desc.includes("남성")
    ) {
      return "👨";
    }
    return "🎭";
  }

  /**
   * ❌ 에러 화면 렌더링
   */
  async renderError(message, ctx) {
    let text = "❌ *TTS 서비스 오류*\n\n";
    text += `${this.escapeMarkdownV2(message)}\n\n`;
    text += "잠시 후 다시 시도해주세요\\.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "tts:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }
}

module.exports = TTSRenderer;
