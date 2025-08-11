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

    const text = `🔊 *음성 변환 서비스*

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

    const text = `🎤 *텍스트 입력*

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

    const text = `🎤 *음성 선택 - ${langName}*

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

    const text = `✅ *음성 변경 완료*

선택한 음성: *${voice.name}*
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
    const text = `📤 *공유 링크*

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

    // 🎵 음성 메시지용 캡션 (간단하고 명확하게)
    let caption = `✅ *변환 완료\\!*\n\n`;
    caption += `📝 "${escapeMarkdownV2(text.substring(0, 80))}${text.length > 80 ? "\\.\\.\\." : ""}"\n`;
    caption += `🎤 ${escapeMarkdownV2(voice)}`;

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
        // 🎵 핵심 변경: replyWithAudio → replyWithVoice
        // 이것만으로 모바일 연속재생 문제 완전 해결!
        await ctx.replyWithVoice(
          { source: audioFile },
          {
            parse_mode: "MarkdownV2",
            caption: caption,
            reply_markup: keyboard,
            // 🎯 음성 메시지 최적화 옵션들
            duration: Math.ceil(text.length / 5) // 예상 재생 시간 (초)
            // disable_notification: false // 알림은 유지 (기본값)
          }
        );

        logger.info("✅ TTS 음성 메시지 전송 완료 (연속재생 방지됨)");
      } catch (error) {
        logger.error("음성 메시지 전송 실패:", error);

        // 🔄 폴백 1: Markdown V1으로 재시도
        try {
          const markdownCaption = `✅ *변환 완료!*\n\n📝 "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"\n🎤 ${voice}`;

          await ctx.replyWithVoice(
            { source: audioFile },
            {
              parse_mode: "Markdown",
              caption: markdownCaption,
              reply_markup: keyboard,
              duration: Math.ceil(text.length / 5)
            }
          );

          logger.info("✅ TTS 음성 메시지 전송 완료 (Markdown V1 폴백)");
        } catch (secondError) {
          logger.error("Markdown V1 음성 메시지도 실패:", secondError);

          // 🔄 폴백 2: 일반 텍스트 캡션
          try {
            const plainCaption = `✅ 변환 완료!\n\n📝 ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}\n🎤 ${voice}`;

            await ctx.replyWithVoice(
              { source: audioFile },
              {
                caption: plainCaption,
                reply_markup: keyboard,
                duration: Math.ceil(text.length / 5)
              }
            );

            logger.info("✅ TTS 음성 메시지 전송 완료 (일반 텍스트 폴백)");
          } catch (thirdError) {
            logger.error(
              "모든 음성 메시지 전송 실패, 오디오로 폴백:",
              thirdError
            );

            // 🔄 최종 폴백: 기존 오디오 파일 방식
            await this.renderConversionCompleteAsAudioFallback(
              data,
              ctx,
              keyboard
            );
          }
        }
      }
    } else {
      // 오디오 파일이 없는 경우 텍스트 메시지로 대체
      await this.sendSafeMessageForAudio(
        ctx,
        "⚠️ 음성 파일을 찾을 수 없습니다.",
        { reply_markup: keyboard }
      );
    }
  }

  // 🔄 최종 폴백용 메서드 (기존 오디오 파일 방식)
  async renderConversionCompleteAsAudioFallback(data, ctx, keyboard) {
    const { text, voice, audioFile } = data;

    logger.warn("🔄 음성 메시지 실패 - 오디오 파일로 폴백");

    try {
      const plainCaption = `✅ 변환 완료 (오디오 파일)\n\n📝 ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}\n🎤 ${voice}`;

      await ctx.replyWithAudio(
        { source: audioFile },
        {
          caption: plainCaption,
          reply_markup: keyboard
        }
      );

      logger.info("✅ TTS 오디오 파일 전송 완료 (폴백)");
    } catch (error) {
      logger.error("오디오 파일 폴백도 실패:", error);

      // 최종 에러 메시지
      await this.sendSafeMessageForAudio(
        ctx,
        "❌ 음성 파일 전송에 실패했습니다. 다시 시도해주세요.",
        { reply_markup: keyboard }
      );
    }
  }

  async renderError(data, ctx) {
    const { message = "알 수 없는 오류가 발생했습니다." } = data;

    const text = `❌ *오류 발생*

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

  /**
   * 📱 모바일 최적화를 위한 캡션 길이 조정
   * - 음성 메시지는 캡션이 너무 길면 UI가 복잡해짐
   * - 핵심 정보만 간결하게 표시
   */
  generateOptimizedCaption(text, voice, shareUrl = null) {
    const maxTextLength = 80; // 모바일 최적화된 길이
    const truncatedText =
      text.length > maxTextLength
        ? text.substring(0, maxTextLength) + "..."
        : text;

    let caption = `✅ *변환 완료!*\n\n`;
    caption += `📝 "${truncatedText}"\n`;
    caption += `🎤 ${voice}`;

    // 공유 링크는 선택적으로만 추가 (UI 깔끔하게)
    if (shareUrl && process.env.BASE_URL) {
      caption += `\n\n🔗 [링크 공유](${process.env.BASE_URL}${shareUrl})`;
    }

    return caption;
  }

  /**
   * 🔍 사용자 피드백 수집을 위한 로그
   */
  logVoiceMessageSuccess(userId, textLength, voice) {
    logger.info(`🎵 음성 메시지 전송 성공`, {
      userId: userId,
      textLength: textLength,
      voice: voice,
      timestamp: new Date().toISOString(),
      type: "voice_message" // 분석용 태그
    });
  }
}

module.exports = TTSRenderer;
