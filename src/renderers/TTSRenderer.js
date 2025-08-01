const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🔊 TTSRenderer - TTS UI 렌더링 (심플 버전)
 */
class TTSRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "tts";
  }

  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "convert_prompt":
        return await this.renderConvertPrompt(data, ctx);
      case "convert_success":
        return await this.renderConvertSuccess(data, ctx);
      case "convert_error":
        return await this.renderConvertError(data, ctx);
      case "voices":
        return await this.renderVoices(data, ctx);
      case "voice_selected":
        return await this.renderVoiceSelected(data, ctx);
      case "history":
        return await this.renderHistory(data, ctx);
      case "settings":
        return await this.renderSettings(data, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError(
          { message: "지원하지 않는 기능입니다." },
          ctx
        );
    }
  }

  /**
   * 🔊 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, stats, config } = data;

    let text = `🔊 **음성 변환 서비스**\n\n`;
    text += `안녕하세요, ${userName}님!\n\n`;

    if (stats) {
      text += `📊 **사용 통계**\n`;
      text += `• 총 변환 횟수: ${stats.totalConversions}회\n`;
      text += `• 총 재생 시간: ${stats.totalDuration}초\n`;
      if (stats.lastConversion) {
        const lastDate = TimeHelper.format(
          new Date(stats.lastConversion),
          "MM/DD"
        );
        text += `• 마지막 사용: ${lastDate}\n`;
      }
      text += `\n`;
    }

    text += `텍스트를 자연스러운 음성으로 변환해보세요!\n`;
    text += `**지원 언어**: 한국어, 영어, 일본어`;

    const buttons = [
      [
        { text: "🎤 한국어 변환", action: "convert", params: "ko-KR" },
        { text: "🎤 English", action: "convert", params: "en-US" },
      ],
      [
        { text: "🎤 日本語", action: "convert", params: "ja-JP" },
        { text: "🎵 음성 선택", action: "voices" },
      ],
      [
        { text: "📋 변환 이력", action: "history" },
        { text: "⚙️ 설정", action: "settings" },
      ],
      [{ text: "🔙 메인 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🎤 변환 프롬프트 렌더링
   */
  async renderConvertPrompt(data, ctx) {
    const { language, maxLength, voiceName } = data;

    const languageNames = {
      "ko-KR": "한국어",
      "en-US": "영어",
      "ja-JP": "일본어",
    };

    const text = `🎤 **텍스트 음성 변환**

**언어**: ${languageNames[language]}
**음성**: ${voiceName}
**최대 길이**: ${maxLength}자

변환할 텍스트를 입력해주세요.

/cancel 명령으로 취소할 수 있습니다.`;

    const buttons = [
      [
        { text: "🎵 음성 변경", action: "voices", params: language },
        { text: "❌ 취소", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ✅ 변환 성공 렌더링
   */
  async renderConvertSuccess(data, ctx) {
    const { text, voice, language, duration, fileSize } = data;

    const successText = `✅ **음성 변환 완료**

📝 **텍스트**: "${text}"
🎵 **음성**: ${voice}
⏱️ **재생 시간**: ${duration}초
📦 **파일 크기**: ${Math.round(fileSize / 1024)}KB

${
  data.audioFile
    ? "🎧 음성 파일이 생성되었습니다!"
    : "📱 TTS API 연결이 필요합니다."
}`;

    const buttons = [
      [
        { text: "🎤 다시 변환", action: "convert", params: language },
        { text: "🎵 음성 변경", action: "voices" },
      ],
      [
        { text: "📋 변환 이력", action: "history" },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    // 실제 음성 파일이 있으면 전송 (실제 구현 시)
    await this.sendSafeMessage(ctx, successText, { reply_markup: keyboard });
  }

  /**
   * ❌ 변환 오류 렌더링
   */
  async renderConvertError(data, ctx) {
    const text = `❌ **변환 오류**

${data.message}

다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "convert" },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🎵 음성 목록 렌더링
   */
  async renderVoices(data, ctx) {
    const { language, voices, supportedLanguages } = data;

    const languageNames = {
      "ko-KR": "한국어",
      "en-US": "영어",
      "ja-JP": "일본어",
    };

    let text = `🎵 **음성 선택 - ${languageNames[language]}**\n\n`;

    if (voices.length === 0) {
      text += `이 언어에 사용 가능한 음성이 없습니다.`;
    } else {
      text += `사용할 음성을 선택해주세요:`;
    }

    const buttons = [];

    // 음성 버튼들
    voices.forEach((voice) => {
      buttons.push([
        {
          text: voice.name,
          action: "voice",
          params: voice.code,
        },
      ]);
    });

    // 언어 변경 버튼
    const langRow = [];
    supportedLanguages.forEach((lang) => {
      if (lang !== language) {
        langRow.push({
          text: languageNames[lang],
          action: "voices",
          params: lang,
        });
      }
    });
    if (langRow.length > 0) {
      buttons.push(langRow);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🎯 음성 선택됨 렌더링
   */
  async renderVoiceSelected(data, ctx) {
    const { voiceName, message } = data;

    const text = `🎯 **음성 설정 완료**

${message}

**선택된 음성**: ${voiceName}

이제 이 음성으로 텍스트를 변환합니다.`;

    const buttons = [
      [
        { text: "🎤 변환하기", action: "convert" },
        { text: "🎵 음성 변경", action: "voices" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 이력 렌더링
   */
  async renderHistory(data, ctx) {
    const { history, totalCount } = data;

    let text = `📋 **변환 이력** (${totalCount}건)\n\n`;

    if (history.length === 0) {
      text += `아직 변환한 기록이 없습니다.\n\n`;
    } else {
      history.forEach((record, index) => {
        const date = TimeHelper.format(
          new Date(record.createdAt),
          "MM/DD HH:mm"
        );
        text += `${index + 1}. ${date}\n`;
        text += `   "${record.text}"\n`;
        text += `   🎵 ${record.voice} (${record.duration}초)\n\n`;
      });
    }

    const buttons = [
      [
        { text: "🎤 새 변환", action: "convert" },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚙️ 설정 렌더렝
   */
  async renderSettings(data, ctx) {
    const text = `⚙️ **TTS 설정**

${data.message}

현재 설정:
• 최대 텍스트 길이: ${data.config.maxTextLength}자
• 기본 언어: ${data.config.defaultLanguage}
• 지원 언어: ${data.config.supportedLanguages.length}개

고급 설정은 향후 업데이트에서 제공됩니다.`;

    const buttons = [[{ text: "🔙 메뉴", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const text = `❌ **오류 발생**

${data.message}

다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: "🔙 메인 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = TTSRenderer;
