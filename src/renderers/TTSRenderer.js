// src/renderers/TTSRenderer.js
const logger = require("../utils/Logger");
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
      case "share_ready": // 이거 추가!
        return await this.renderShareReady(data, ctx);
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

  // TTSRenderer.js - 이 렌더러에서만 특별 처리
  async sendSafeMessageForAudio(ctx, text, options = {}) {
    // 오디오 메시지 콜백인지 확인
    if (ctx.callbackQuery?.message && !ctx.callbackQuery.message.text) {
      // 새 메시지로 전송
      await ctx.reply(text, {
        parse_mode: "Markdown",
        ...options,
      });
      await ctx.answerCbQuery();
    } else {
      // 일반적인 경우는 기존 MarkdownHelper 사용
      await this.markdownHelper.sendSafeMessage(ctx, text, options);
    }
  }

  // 변환시킬 텍스트 입력 프롬프트
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

    // 오디오 메시지에서 호출된 경우 새 메시지로 전송
    if (ctx.callbackQuery?.message && !ctx.callbackQuery.message.text) {
      await ctx.reply(text, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    } else {
      // 일반적인 경우 기존 방식 사용
      await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
    }
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

  // 공유하기
  async renderShareReady(data, ctx) {
    const { shareUrl, message } = data;

    const text = `📤 **공유 링크**\n\n${shareUrl}\n\n${message}`;

    const buttons = [[{ text: "🔙 메뉴", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  async renderVoiceChanged(data, ctx) {
    const { voice } = data;

    const text = `✅ **음성 변경 완료**

선택한 음성: **${voice.name}**
${voice.description}

이제 이 음성으로 텍스트를 변환합니다.`;

    const buttons = [
      [
        { text: "🎤 변환하기", action: "start" },
        { text: "🎵 다른 음성", action: "select_voice" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  async renderConversionComplete(data, ctx) {
    const { text, shareUrl, voice, audioFile } = data;

    // Markdown 특수문자 이스케이프
    const escapeMarkdown = (str) => {
      return str.replace(/[_*\[\]()~`>#+-=|{}.!]/g, "\\$&");
    };

    const escapedText = escapeMarkdown(text);

    let successText = `✅ 변환 완료\\!\n\n`;
    successText += `📝 텍스트: "${escapedText}"\n`;
    successText += `🎤 음성: ${voice}`;

    if (process.env.BASE_URL && shareUrl) {
      successText += `\n\n🔗 공유 링크: ${process.env.BASE_URL}${shareUrl}`;
    }

    successText += `\n\n음성 파일이 생성되었습니다\\!`;

    const buttons = [
      [
        { text: "🔄 다시 변환", action: "start" },
        { text: "🎤 음성 변경", action: "select_voice" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    if (process.env.BASE_URL && shareUrl) {
      buttons[1].unshift({
        text: "📤 공유하기",
        action: "share",
        params: shareUrl,
      });
    }

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    if (audioFile) {
      try {
        await ctx.replyWithAudio(
          { source: audioFile },
          {
            // parse_mode 제거하거나 MarkdownV2 사용
            parse_mode: "MarkdownV2",
            caption: successText,
            reply_markup: keyboard,
          }
        );
      } catch (error) {
        logger.error("오디오 파일 전송 실패:", error);
        // parse_mode 없이 다시 시도
        try {
          await ctx.replyWithAudio(
            { source: audioFile },
            {
              caption: text + "\n\n🎤 " + voice,
              reply_markup: keyboard,
            }
          );
        } catch (secondError) {
          await ctx.reply("음성 파일 전송에 실패했습니다.", {
            reply_markup: keyboard,
          });
        }
      }
    }
  }
}

module.exports = TTSRenderer;
