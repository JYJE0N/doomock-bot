// src/modules/UtilsModule.js - TTS 정지 버튼 추가

const BaseModule = require("./BaseModule");
const { TTSService } = require("../services/TTSService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");

class UtilsModule extends BaseModule {
  constructor() {
    super("UtilsModule");
    this.ttsService = new TTSService();
    this.userStates = new Map();

    // ⭐ TTS 활성 상태 추적
    this.activeTTSRequests = new Map(); // userId -> { chatId, messageId, request }
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    // TTS 명령어 처리
    if (text && text.startsWith("/tts")) {
      await this.handleTTSCommand(bot, chatId, userId, text);
      return true;
    }

    // 자동 TTS 처리
    if (await this.handleAutoTTS(bot, msg)) {
      return true;
    }

    return false;
  }

  // 새로운 콜백 구조에 맞춘 handleCallback 메서드
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    switch (subAction) {
      case "menu":
        await this.showUtilsMenu(
          bot,
          chatId,
          messageId,
          userId,
          userName,
          menuManager
        );
        break;
      case "tts_menu":
        await this.showTTSMenu(bot, chatId, messageId, userId);
        break;
      case "tts_help":
        await this.showTTSHelp(bot, chatId, messageId);
        break;
      case "tts_stop": // ⭐ TTS 정지 버튼
        await this.stopTTS(bot, chatId, messageId, userId);
        break;
      case "tts_auto_on":
        await this.toggleTTSMode(bot, chatId, messageId, userId, "AUTO");
        break;
      case "tts_auto_off":
        await this.toggleTTSMode(bot, chatId, messageId, userId, "OFF");
        break;
      case "tts_manual":
        await this.toggleTTSMode(bot, chatId, messageId, userId, "MANUAL");
        break;
      case "help":
        await this.showUtilsHelp(bot, chatId, messageId);
        break;
      default:
        // TTS 언어 설정 처리
        if (subAction.startsWith("lang_")) {
          const language = subAction.replace("lang_", "");
          await this.setTTSLanguage(bot, chatId, messageId, userId, language);
        } else {
          await this.sendMessage(
            bot,
            chatId,
            "❌ 알 수 없는 유틸리티 명령입니다."
          );
        }
    }
  }

  async showUtilsMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const ttsMode = this.ttsService.getTTSMode(userId);
    const activeTTS = this.activeTTSRequests.has(userId);

    const menuText =
      `🛠️ **${userName}님의 유틸리티**\n\n` +
      "**🔊 TTS (음성 변환)**\n" +
      `현재 모드: ${ttsMode}\n` +
      `${activeTTS ? "🔴 TTS 진행 중" : "⚪ TTS 대기 중"}\n` +
      "텍스트를 자연스러운 음성으로 변환해드려요!\n\n" +
      "**📊 기타 유틸리티**\n" +
      "다양한 편의 기능들을 제공합니다.\n\n" +
      "원하는 기능을 선택하세요:";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
          { text: "❓ TTS 도움말", callback_data: "utils_tts_help" },
        ],
        activeTTS
          ? [{ text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" }]
          : [],
        [
          { text: "❓ 유틸리티 도움말", callback_data: "utils_help" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ].filter((row) => row.length > 0), // 빈 배열 제거
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async showTTSMenu(bot, chatId, messageId, userId) {
    const ttsMode = this.ttsService.getTTSMode(userId);
    const currentLanguage = this.ttsService.getUserLanguage(userId);
    const languageName =
      this.ttsService.supportedLanguages[currentLanguage] || "한국어";
    const activeTTS = this.activeTTSRequests.has(userId);

    const helpText =
      `🔊 **TTS (음성 변환) 설정**\n\n` +
      `📍 **현재 모드**: ${ttsMode}\n` +
      `🌍 **현재 언어**: ${languageName}\n` +
      `${activeTTS ? "🔴 **상태**: 진행 중" : "⚪ **상태**: 대기 중"}\n\n` +
      "**🎯 모드 설명**\n" +
      "• **자동**: 채팅 메시지 자동 변환\n" +
      "• **수동**: /tts 명령어로만 사용\n" +
      "• **OFF**: TTS 기능 비활성화\n\n" +
      "원하는 설정을 선택하세요:";

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: ttsMode === "AUTO" ? "🔊 자동 모드 (현재)" : "🔊 자동 모드",
            callback_data: "utils_tts_auto_on",
          },
          {
            text: ttsMode === "MANUAL" ? "📝 수동 모드 (현재)" : "📝 수동 모드",
            callback_data: "utils_tts_manual",
          },
        ],
        [
          {
            text: ttsMode === "OFF" ? "❌ OFF (현재)" : "❌ OFF",
            callback_data: "utils_tts_auto_off",
          },
          { text: "🌍 언어 설정", callback_data: "utils_tts_lang_menu" },
        ],
        activeTTS
          ? [{ text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" }]
          : [],
        [
          { text: "❓ 도움말", callback_data: "utils_tts_help" },
          { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
        ],
      ].filter((row) => row.length > 0), // 빈 배열 제거
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ⭐ TTS 정지 기능
  async stopTTS(bot, chatId, messageId, userId) {
    try {
      const activeRequest = this.activeTTSRequests.get(userId);

      if (!activeRequest) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "ℹ️ **TTS 정지**\n\n현재 진행 중인 TTS 작업이 없습니다.",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
              ],
            },
          }
        );
        return;
      }

      // TTS 서비스에서 정지 처리
      const stopResult = await this.ttsService.stopTTS(userId);

      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);

      if (stopResult.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "⏹️ **TTS 정지 완료**\n\n" +
            "진행 중이던 TTS 작업이 중지되었습니다.\n\n" +
            "임시 파일들이 정리되었습니다. ✨",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
                  { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
                ],
              ],
            },
          }
        );
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **TTS 정지 실패**\n\n${stopResult.message}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      console.error("TTS 정지 처리 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **오류 발생**\n\nTTS 정지 처리 중 오류가 발생했습니다.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
            ],
          },
        }
      );
    }
  }

  // TTS 모드 변경
  async toggleTTSMode(bot, chatId, messageId, userId, mode) {
    try {
      this.ttsService.setTTSMode(userId, mode);

      const modeText = {
        AUTO: "🔊 자동 모드",
        MANUAL: "📝 수동 모드",
        OFF: "❌ OFF",
      };

      await this.editMessage(
        bot,
        chatId,
        messageId,
        `✅ **TTS 모드 변경**\n\n` +
          `TTS 모드가 **${modeText[mode]}**로 변경되었습니다!\n\n` +
          (mode === "AUTO"
            ? "이제 채팅 메시지가 자동으로 음성 변환됩니다."
            : mode === "MANUAL"
            ? "/tts 명령어로 음성 변환을 사용하세요."
            : "TTS 기능이 비활성화되었습니다."),
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
                { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
              ],
            ],
          },
        }
      );
    } catch (error) {
      console.error("TTS 모드 변경 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ TTS 모드 변경 중 오류가 발생했습니다."
      );
    }
  }

  // TTS 언어 설정
  async setTTSLanguage(bot, chatId, messageId, userId, language) {
    try {
      const result = this.ttsService.setUserLanguage(userId, language);

      if (result.success) {
        const languageName = this.ttsService.supportedLanguages[language];

        await this.editMessage(
          bot,
          chatId,
          messageId,
          `✅ **TTS 언어 변경**\n\n` +
            `TTS 언어가 **${languageName}**로 변경되었습니다!\n\n` +
            "이제 해당 언어로 음성 변환이 됩니다. 🎵",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
                  { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
                ],
              ],
            },
          }
        );
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **언어 설정 실패**\n\n${result.message}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      console.error("TTS 언어 설정 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 언어 설정 중 오류가 발생했습니다."
      );
    }
  }

  // TTS 명령어 처리 (개선된 버전)
  async handleTTSCommand(bot, chatId, userId, text) {
    try {
      // /tts 제거하고 텍스트 추출
      const ttsText = text.replace("/tts", "").trim();

      if (!ttsText) {
        await bot.sendMessage(
          chatId,
          "❌ **TTS 사용법**\n\n" +
            "변환할 텍스트를 입력해주세요.\n\n" +
            "**예시**: /tts 안녕하세요\n" +
            "**언어 지정**: /tts en Hello World",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔊 TTS 설정", callback_data: "utils_tts_menu" }],
              ],
            },
          }
        );
        return;
      }

      // ⭐ 활성 요청 등록
      this.activeTTSRequests.set(userId, {
        chatId,
        text: ttsText,
        startTime: Date.now(),
      });

      // 진행 상황 메시지 전송
      const progressMessage = await bot.sendMessage(
        chatId,
        "🔄 **TTS 변환 중...**\n\n" +
          `📝 텍스트: "${ttsText}"\n` +
          "⏳ 음성 파일을 생성하고 있습니다...",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⏹️ 정지", callback_data: "utils_tts_stop" }],
            ],
          },
        }
      );

      // 언어 감지 및 TTS 변환
      const language = this.ttsService.getUserLanguage(userId);
      const result = await this.ttsService.convertTextToSpeech(
        ttsText,
        language,
        userId
      );

      if (result.success) {
        // 진행 상황 메시지 업데이트
        await bot.editMessageText(
          "✅ **TTS 변환 완료!**\n\n" +
            `📝 텍스트: "${ttsText}"\n` +
            `🌍 언어: ${this.ttsService.supportedLanguages[language]}\n` +
            "🎵 음성 파일을 전송합니다...",
          {
            chat_id: chatId,
            message_id: progressMessage.message_id,
            parse_mode: "Markdown",
          }
        );

        // 음성 파일 전송
        await bot.sendVoice(chatId, result.filePath, {
          caption: `🔊 TTS: "${ttsText}" (${this.ttsService.supportedLanguages[language]})`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔄 다시 변환", callback_data: "utils_tts_menu" },
                { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
              ],
            ],
          },
        });

        // 진행 상황 메시지 삭제
        setTimeout(() => {
          bot.deleteMessage(chatId, progressMessage.message_id).catch(() => {});
        }, 2000);

        // 임시 파일 삭제
        setTimeout(() => {
          this.ttsService.cleanupFile(result.filePath);
        }, 10000);
      } else {
        // 진행 상황 메시지 업데이트 (실패)
        await bot.editMessageText(`❌ **TTS 변환 실패**\n\n${result.message}`, {
          chat_id: chatId,
          message_id: progressMessage.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔄 다시 시도", callback_data: "utils_tts_menu" },
                { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
              ],
            ],
          },
        });
      }

      // ⭐ 활성 요청 제거
      this.activeTTSRequests.delete(userId);
    } catch (error) {
      console.error("TTS 명령어 처리 오류:", error);

      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);

      await bot.sendMessage(
        chatId,
        "❌ **TTS 처리 오류**\n\nTTS 처리 중 오류가 발생했습니다.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔊 TTS 설정", callback_data: "utils_tts_menu" }],
            ],
          },
        }
      );
    }
  }

  // 자동 TTS 처리
  async handleAutoTTS(bot, msg) {
    try {
      const userId = msg.from.id;
      const ttsMode = this.ttsService.getTTSMode(userId);

      if (ttsMode !== "AUTO") {
        return false;
      }

      const text = msg.text;
      if (!text || text.startsWith("/")) {
        return false;
      }

      // 자동 TTS 처리 로직
      // (실제 구현은 TTSService에서)
      return await this.ttsService.handleAutoTTS(bot, msg);
    } catch (error) {
      console.error("자동 TTS 처리 오류:", error);
      return false;
    }
  }

  async showTTSHelp(bot, chatId, messageId) {
    const helpText =
      "🔊 **TTS (음성 변환) 도움말**\n\n" +
      "**🎯 세 가지 사용 방법**\n\n" +
      "**1️⃣ 자동 모드 (추천)**\n" +
      "• 🛠️ 유틸리티 → 🔊 TTS 설정\n" +
      "• TTS 모드를 **자동**으로 설정\n" +
      "• 채팅창에 텍스트 입력\n" +
      "• 자동으로 음성 변환! 🎵\n\n" +
      "**2️⃣ 수동 모드**\n" +
      "• `/tts [텍스트]` 명령어 사용\n" +
      "• 예: `/tts 안녕하세요`\n" +
      "• ⏹️ **정지 버튼**으로 중간에 멈출 수 있어요!\n\n" +
      "**3️⃣ 언어 지정**\n" +
      "• `/tts en Hello World`\n" +
      "• `/tts ja こんにちは`\n\n" +
      "**🌍 지원 언어**\n" +
      "• 한국어(ko), English(en), 日本語(ja)\n" +
      "• 中文(zh), Español(es), Français(fr)\n\n" +
      "**💡 특징**\n" +
      "• 최대 500자까지 지원\n" +
      "• ⏹️ **정지 버튼**으로 언제든 중단\n" +
      "• 이전 음성 파일 자동 삭제\n" +
      "• 자연스러운 음성 합성\n" +
      "• 실시간 진행 상황 표시\n\n" +
      "지금 바로 TTS 설정을 해보세요! 🚀";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔊 TTS 설정하기", callback_data: "utils_tts_menu" },
            { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
          ],
        ],
      },
    });
  }

  async showUtilsHelp(bot, chatId, messageId) {
    const helpText =
      "🛠️ **유틸리티 도움말**\n\n" +
      "**🔊 TTS (음성 변환)**\n" +
      "• `/tts [텍스트]` - 텍스트를 음성으로 변환\n" +
      "• `/tts [언어] [텍스트]` - 특정 언어로 음성 변환\n" +
      "• 자동 모드: 유틸리티 메뉴에서 설정\n" +
      "• ⏹️ **정지 버튼**: 진행 중인 TTS 중단\n\n" +
      "**⏰ 시간 유틸리티**\n" +
      "• 정확한 한국 시간 기준 동작\n" +
      "• 날짜/시간 포맷팅 지원\n\n" +
      "**📊 데이터 유틸리티**\n" +
      "• 숫자 포맷팅\n" +
      "• 백분율 계산\n" +
      "• 텍스트 처리\n\n" +
      "**🌍 지원 언어**\n" +
      "• 한국어 (ko) • English (en)\n" +
      "• 日本語 (ja) • 中文 (zh)\n" +
      "• Español (es) • Français (fr)\n\n" +
      "**🎯 특별 기능**\n" +
      "• ⏹️ **실시간 정지**: 진행 중인 작업 중단\n" +
      "• 🔄 **진행 상황 표시**: 작업 진도 실시간 확인\n" +
      "• 🎵 **고품질 음성**: 자연스러운 음성 합성\n\n" +
      "모든 기능은 24시간 사용 가능합니다! 🚀";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
            { text: "🔙 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    });
  }
}

module.exports = UtilsModule;
