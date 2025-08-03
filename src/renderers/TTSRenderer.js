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
      case "share_ready":
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
    const { userName, currentVoice, _languages } = data;

    const text = `🔊 **음성 변환 서비스**

안녕하세요, ${userName}님!

현재 음성: ${currentVoice ? currentVoice.name : "기본"}
텍스트를 자연스러운 음성으로 변환해보세요!`;

    const buttons = [
      [
        { text: "🇰🇷 한국어 변환", action: "start", params: "ko-KR" },
        { text: "🇺🇸 English", action: "start", params: "en-US" }
      ],
      [
        { text: "🎤 음성 변경", action: "select_voice" },
        {
          text: "🔙 메인 메뉴",
          action: "menu",
          module: "system"
        }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  // TTS 전용 안전한 메시지 전송 메서드
  async sendSafeMessageForAudio(ctx, text, options = {}) {
    try {
      // 오디오 메시지 콜백인지 확인
      const isAudioCallback =
        ctx.callbackQuery?.message && !ctx.callbackQuery.message.text;

      if (isAudioCallback) {
        // 오디오 메시지에 대한 콜백인 경우 새 메시지로 전송
        await ctx.reply(text, {
          parse_mode: "Markdown",
          ...options
        });

        // 콜백 쿼리 응답
        if (ctx.answerCbQuery) {
          await ctx.answerCbQuery();
        }
      } else {
        // 일반적인 경우는 기존 MarkdownHelper 사용
        await this.markdownHelper.sendSafeMessage(ctx, text, options);
      }
    } catch (error) {
      logger.error("TTS 메시지 전송 실패:", error);

      // 폴백: 일반 텍스트로 전송
      try {
        const plainText = this.markdownHelper.stripAllMarkup(text);
        await ctx.reply(plainText, options);
      } catch (fallbackError) {
        logger.error("폴백 메시지 전송도 실패:", fallbackError);
      }
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

    // 오디오 메시지에서 호출된 경우 일관된 처리
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  async renderVoiceSelection(data, ctx) {
    const { language, voices } = data;
    const langName = language === "ko-KR" ? "한국어" : "English";

    const text = `🎤 **음성 선택 - ${langName}**

원하는 목소리를 선택해주세요:`;

    const buttons = [];

    // 음성 데이터 유효성 검사
    const maleVoices = voices?.male || [];
    const femaleVoices = voices?.female || [];

    // 남성 음성 (왼쪽)과 여성 음성 (오른쪽) 2열로 배치
    for (let i = 0; i < Math.max(maleVoices.length, femaleVoices.length); i++) {
      const row = [];

      if (maleVoices[i]) {
        row.push({
          text: `👨 ${maleVoices[i].name}`,
          action: "change_voice",
          params: maleVoices[i].code
        });
      }

      if (femaleVoices[i]) {
        row.push({
          text: `👩 ${femaleVoices[i].name}`,
          action: "change_voice",
          params: femaleVoices[i].code
        });
      }

      if (row.length > 0) buttons.push(row);
    }

    // 언어 전환 버튼
    const otherLang = language === "ko-KR" ? "en-US" : "ko-KR";
    const otherLangName = language === "ko-KR" ? "🇺🇸 English" : "🇰🇷 한국어";

    buttons.push([
      { text: otherLangName, action: "select_voice", params: otherLang },
      { text: "🔙 뒤로", action: "menu" }
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  async renderVoiceChanged(data, ctx) {
    const { voice } = data;

    const text = `✅ **음성 변경 완료**

선택한 음성: **${voice.name}**
${voice.description || ""}

이제 이 음성으로 텍스트를 변환합니다.`;

    const buttons = [
      [
        { text: "🎤 변환하기", action: "start" },
        { text: "🎵 다른 음성", action: "select_voice" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  // 공유하기
  async renderShareReady(data, ctx) {
    const { shareUrl, message } = data;

    // URL을 코드 블록으로 감싸서 Markdown 파싱 오류 방지
    const text = `📤 **공유 링크**

\`${shareUrl}\`

${message}`;

    const buttons = [[{ text: "🔙 메뉴", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }

  async renderConversionComplete(data, ctx) {
    const { text, shareUrl, voice, audioFile } = data;

    // MarkdownV2용 특수문자 이스케이프 함수 (개선됨)
    const escapeMarkdownV2 = (str) => {
      if (!str) return "";
      // MarkdownV2에서 이스케이프가 필요한 모든 문자
      return str.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
    };

    // 캡션 생성 (MarkdownV2 형식)
    let caption = `✅ **변환 완료\\!**\n\n`;
    caption += `📝 텍스트: "${escapeMarkdownV2(text)}"\n`;
    caption += `🎤 음성: ${escapeMarkdownV2(voice)}`;

    // 공유 링크가 있으면 추가
    if (process.env.BASE_URL && shareUrl) {
      const fullUrl = escapeMarkdownV2(`${process.env.BASE_URL}${shareUrl}`);
      caption += `\n\n🔗 [공유 링크](${fullUrl})`;
    }

    const buttons = [
      [
        { text: "🔄 다시 변환", action: "start" },
        { text: "🎤 음성 변경", action: "select_voice" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    // 공유 버튼 추가
    if (process.env.BASE_URL && shareUrl) {
      buttons[1].unshift({
        text: "📤 공유하기",
        action: "share",
        params: shareUrl
      });
    }

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    if (audioFile) {
      try {
        // 오디오 파일 전송 시도
        await ctx.replyWithAudio(
          { source: audioFile },
          {
            parse_mode: "MarkdownV2",
            caption: caption,
            reply_markup: keyboard
          }
        );
      } catch (error) {
        logger.error("오디오 파일 전송 실패:", error);

        // 첫 번째 폴백: Markdown (V1) 시도
        try {
          const markdownCaption = `✅ **변환 완료!**\n\n📝 텍스트: "${text}"\n🎤 음성: ${voice}`;
          await ctx.replyWithAudio(
            { source: audioFile },
            {
              parse_mode: "Markdown",
              caption: markdownCaption,
              reply_markup: keyboard
            }
          );
        } catch (secondError) {
          logger.error("Markdown 캡션도 실패:", secondError);

          // 두 번째 폴백: 일반 텍스트
          try {
            const plainCaption = `✅ 변환 완료!\n\n📝 ${text}\n🎤 ${voice}`;
            await ctx.replyWithAudio(
              { source: audioFile },
              {
                caption: plainCaption,
                reply_markup: keyboard
              }
            );
          } catch (thirdError) {
            logger.error("일반 텍스트 캡션도 실패:", thirdError);

            // 최종 폴백: 메시지만 전송
            await this.sendSafeMessageForAudio(
              ctx,
              "음성 파일 전송에 실패했습니다. 다시 시도해주세요.",
              {
                reply_markup: keyboard
              }
            );
          }
        }
      }
    } else {
      // 오디오 파일이 없는 경우 텍스트 메시지로 대체
      await this.sendSafeMessageForAudio(
        ctx,
        "⚠️ 음성 파일을 찾을 수 없습니다.",
        {
          reply_markup: keyboard
        }
      );
    }
  }

  async renderError(data, ctx) {
    const { message = "알 수 없는 오류가 발생했습니다." } = data;

    const text = `❌ **오류 발생**

${message}

다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: "🔙 메인 메뉴", action: "menu", module: "system" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessageForAudio(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = TTSRenderer;
