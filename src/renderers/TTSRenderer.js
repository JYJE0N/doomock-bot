// src/renderers/TTSRenderer.js
const BaseRenderer = require("./BaseRenderer");

class TTSRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "tts";
  }

  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "waiting_input":
        return await this.renderWaitingInput(data, ctx);
      case "voice_selection":
        return await this.renderVoiceSelection(data, ctx);
      case "voice_changed":
        return await this.renderVoiceChanged(data, ctx);
      case "conversion_complete":
        return await this.renderConversionComplete(data, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError(
          { message: "알 수 없는 명령입니다" },
          ctx
        );
    }
  }

  async renderMenu(data, ctx) {
    const { userName, currentVoice, languages } = data;

    const text = `🔊 **음성 변환 서비스**

안녕하세요, ${userName}님!

현재 음성: ${currentVoice ? currentVoice.name : "기본"}
텍스트를 자연스러운 음성으로 변환해보세요!`;

    const buttons = [
      [
        { text: "🇰🇷 한국어 변환", action: "start", params: "ko-KR" },
        { text: "🇺🇸 English", action: "start", params: "en-US" },
      ],
      [
        { text: "🎤 음성 변경", action: "select_voice" },
        { text: "🔙 메인 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderWaitingInput(data, ctx) {
    const { language, maxLength } = data;
    const langName = language === "ko-KR" ? "한국어" : "영어";

    const text = `🎤 **텍스트 입력**

언어: ${langName}
최대 길이: ${maxLength}자

변환할 텍스트를 입력해주세요.
/cancel 명령으로 취소할 수 있습니다.`;

    const buttons = [[{ text: "❌ 취소", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderVoiceSelection(data, ctx) {
    const { language, voices } = data;
    const langName = language === "ko-KR" ? "한국어" : "English";

    const text = `🎤 **음성 선택 - ${langName}**

원하는 목소리를 선택해주세요:`;

    const buttons = [];

    // 남성 음성 (왼쪽)과 여성 음성 (오른쪽) 2열로 배치
    const maleVoices = voices.male || [];
    const femaleVoices = voices.female || [];

    for (let i = 0; i < Math.max(maleVoices.length, femaleVoices.length); i++) {
      const row = [];

      if (maleVoices[i]) {
        row.push({
          text: `👨 ${maleVoices[i].name}`,
          action: "change_voice",
          params: maleVoices[i].code,
        });
      }

      if (femaleVoices[i]) {
        row.push({
          text: `👩 ${femaleVoices[i].name}`,
          action: "change_voice",
          params: femaleVoices[i].code,
        });
      }

      if (row.length > 0) buttons.push(row);
    }

    // 언어 전환 버튼
    const otherLang = language === "ko-KR" ? "en-US" : "ko-KR";
    const otherLangName = language === "ko-KR" ? "🇺🇸 English" : "🇰🇷 한국어";

    buttons.push([
      { text: otherLangName, action: "select_voice", params: otherLang },
      { text: "🔙 뒤로", action: "menu" },
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderConversionComplete(data, ctx) {
    const { text, shareUrl, voice } = data;

    const successText = `✅ **변환 완료!**

📝 텍스트: "${text}"
🎤 음성: ${voice}

🔗 공유 링크: ${process.env.BASE_URL}${shareUrl}
음성 파일이 생성되었습니다!`;

    const buttons = [
      [
        { text: "🔄 다시 변환", action: "start" },
        { text: "🎤 음성 변경", action: "select_voice" },
      ],
      [
        { text: "📤 공유하기", action: "share", params: shareUrl },
        { text: "🔙 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    // 음성 파일 전송
    try {
      await ctx.replyWithAudio(
        { source: data.audioFile },
        {
          caption: successText,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      await this.sendSafeMessage(ctx, successText, { reply_markup: keyboard });
    }
  }

  async renderError(data, ctx) {
    const text = `❌ **오류**

${data.message}`;

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
