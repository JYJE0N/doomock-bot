// src/modules/UtilsModule.js - TTS 에러 처리 및 사용자 경험 개선

const BaseModule = require("./BaseModule");
const { TTSService } = require("../services/TTSService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
const Logger = require("../utils/Logger");

class UtilsModule extends BaseModule {
  constructor() {
    super("UtilsModule");
    this.ttsService = new TTSService();
    this.userStates = new Map();
    this.activeTTSRequests = new Map();

    // ⭐ TTS 진단 정보 캐시
    this.diagnosticsCache = null;
    this.lastDiagnostics = null;
  }

  async initialize() {
    try {
      // ⭐ 초기화 시 TTS 진단 실행
      this.diagnosticsCache = await this.ttsService.runDiagnostics();
      this.lastDiagnostics = new Date();

      Logger.info("✅ UtilsModule 초기화 완료", {
        ttsReady: this.diagnosticsCache.networkAccess,
        tempDirOk: this.diagnosticsCache.tempDirWritable,
      });

      await super.initialize();
    } catch (error) {
      Logger.error("❌ UtilsModule 초기화 실패:", error);
    }
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

  // ⭐ 표준화된 콜백 구조
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
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
        case "tts_stop":
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
        case "tts_diagnostics":
          await this.showTTSDiagnostics(bot, chatId, messageId);
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
    } catch (error) {
      Logger.error(`UtilsModule 콜백 오류 (${subAction}):`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ⭐ 개선된 TTS 명령어 처리
  async handleTTSCommand(bot, chatId, userId, text) {
    try {
      const ttsText = text.replace("/tts", "").trim();

      if (!ttsText) {
        await this.showTTSUsageHelp(bot, chatId);
        return;
      }

      // ⭐ TTS 서비스 상태 체크
      if (!(await this.checkTTSServiceHealth())) {
        await this.sendTTSServiceError(bot, chatId);
        return;
      }

      // 활성 요청 등록
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

      // TTS 변환 실행
      const language = this.ttsService.getUserLanguage(userId);
      const result = await this.ttsService.convertTextToSpeech(
        ttsText,
        language,
        userId
      );

      if (result.success) {
        await this.handleTTSSuccess(
          bot,
          chatId,
          progressMessage,
          result,
          ttsText,
          language
        );
      } else {
        await this.handleTTSFailure(bot, chatId, progressMessage, result);
      }

      // 활성 요청 제거
      this.activeTTSRequests.delete(userId);
    } catch (error) {
      Logger.error("TTS 명령어 처리 오류:", error);
      this.activeTTSRequests.delete(userId);
      await this.sendTTSProcessingError(bot, chatId);
    }
  }

  // ⭐ TTS 성공 처리
  async handleTTSSuccess(
    bot,
    chatId,
    progressMessage,
    result,
    ttsText,
    language
  ) {
    try {
      // 진행 상황 메시지 업데이트
      await bot.editMessageText(
        "✅ **TTS 변환 완료!**\n\n" +
          `📝 텍스트: "${ttsText}"\n` +
          `🌍 언어: ${this.ttsService.supportedLanguages[language]}\n` +
          `🎵 음성 파일을 전송합니다...${
            result.retries > 1 ? ` (${result.retries}번째 시도에서 성공)` : ""
          }`,
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

      // 진행 상황 메시지 삭제 (2초 후)
      setTimeout(() => {
        bot.deleteMessage(chatId, progressMessage.message_id).catch(() => {});
      }, 2000);

      // 임시 파일 정리 (10초 후)
      setTimeout(() => {
        this.ttsService.cleanupFile(result.filePath);
      }, 10000);
    } catch (error) {
      Logger.error("TTS 성공 처리 오류:", error);
      throw error;
    }
  }

  // ⭐ TTS 실패 처리
  async handleTTSFailure(bot, chatId, progressMessage, result) {
    const errorMessage =
      result.retries > 1
        ? `${result.message}\n\n(${result.retries}번 시도했지만 실패했습니다)`
        : result.message;

    await bot.editMessageText(`❌ **TTS 변환 실패**\n\n${errorMessage}`, {
      chat_id: chatId,
      message_id: progressMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "utils_tts_menu" },
            { text: "🔧 TTS 진단", callback_data: "utils_tts_diagnostics" },
          ],
          [{ text: "🛠️ 유틸리티", callback_data: "utils_menu" }],
        ],
      },
    });
  }

  // ⭐ TTS 서비스 상태 체크
  async checkTTSServiceHealth() {
    try {
      // 5분마다 진단 정보 업데이트
      const now = new Date();
      if (!this.lastDiagnostics || now - this.lastDiagnostics > 5 * 60 * 1000) {
        this.diagnosticsCache = await this.ttsService.runDiagnostics();
        this.lastDiagnostics = now;
      }

      return (
        this.diagnosticsCache?.networkAccess &&
        this.diagnosticsCache?.tempDirWritable
      );
    } catch (error) {
      Logger.error("TTS 서비스 상태 체크 실패:", error);
      return false;
    }
  }

  // ⭐ TTS 서비스 에러 안내
  async sendTTSServiceError(bot, chatId) {
    await bot.sendMessage(
      chatId,
      "⚠️ **TTS 서비스 일시 장애**\n\n" +
        "현재 TTS 서비스에 문제가 있습니다.\n" +
        "잠시 후 다시 시도해주세요.\n\n" +
        "문제가 지속되면 관리자에게 문의해주세요.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔧 진단 정보", callback_data: "utils_tts_diagnostics" },
              { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
            ],
          ],
        },
      }
    );
  }

  // ⭐ TTS 사용법 도움말
  async showTTSUsageHelp(bot, chatId) {
    await bot.sendMessage(
      chatId,
      "❌ **TTS 사용법**\n\n" +
        "변환할 텍스트를 입력해주세요.\n\n" +
        "**예시**:\n" +
        "• `/tts 안녕하세요`\n" +
        "• `/tts Hello World`\n" +
        "• `/tts こんにちは`\n\n" +
        "**제한사항**:\n" +
        "• 최대 500자까지 지원\n" +
        "• 10개 언어 지원",
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

  // ⭐ TTS 진단 정보 표시
  async showTTSDiagnostics(bot, chatId, messageId) {
    try {
      // 최신 진단 정보 가져오기
      const diagnostics = await this.ttsService.runDiagnostics();
      const status = this.ttsService.getServiceStatus();

      const diagnosticsText =
        "🔧 **TTS 서비스 진단**\n\n" +
        `**환경 정보**\n` +
        `• 환경: ${diagnostics.environment || "Unknown"}\n` +
        `• Railway: ${diagnostics.railway ? "✅" : "❌"}\n` +
        `• GTTS 버전: ${diagnostics.gttsVersion}\n\n` +
        `**파일 시스템**\n` +
        `• 임시 디렉토리: ${diagnostics.tempDirExists ? "✅" : "❌"}\n` +
        `• 쓰기 권한: ${diagnostics.tempDirWritable ? "✅" : "❌"}\n` +
        `• 경로: \`${diagnostics.tempDir}\`\n\n` +
        `**네트워크**\n` +
        `• TTS 서비스: ${diagnostics.networkAccess ? "✅" : "❌"}\n\n` +
        `**활성 상태**\n` +
        `• 진행 중인 요청: ${status.activeRequests}개\n` +
        `• 등록된 사용자: ${status.totalUsers}명\n` +
        `• 타임아웃: ${status.timeout / 1000}초\n` +
        `• 최대 재시도: ${status.maxRetries}회`;

      await this.editMessage(bot, chatId, messageId, diagnosticsText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 새로고침", callback_data: "utils_tts_diagnostics" },
              { text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      Logger.error("TTS 진단 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 진단 정보를 가져올 수 없습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 TTS 메뉴", callback_data: "utils_tts_menu" }],
            ],
          },
        }
      );
    }
  }

  // TTS 정지
  async stopTTS(bot, chatId, messageId, userId) {
    try {
      const result = await this.ttsService.stopTTS(userId);
      this.activeTTSRequests.delete(userId);

      if (result.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "⏹️ **TTS 정지됨**\n\n" +
            `변환이 중단되었습니다.\n` +
            `텍스트: "${result.stoppedTask?.text || "알 수 없음"}"`,
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
          `❌ **정지 실패**\n\n${result.message}`,
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
      Logger.error("TTS 정지 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ TTS 정지 중 오류가 발생했습니다."
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
      if (!text || text.startsWith("/") || text.length > 200) {
        return false;
      }

      // ⭐ 서비스 상태 체크 (자동 모드에서는 무음 실패)
      if (!(await this.checkTTSServiceHealth())) {
        return false;
      }

      return await this.ttsService.handleAutoTTS(bot, msg);
    } catch (error) {
      Logger.error("자동 TTS 처리 오류:", error);
      return false;
    }
  }

  // 유틸리티 메뉴 표시
  async showUtilsMenu(bot, chatId, messageId, userId, userName, menuManager) {
    const ttsMode = this.ttsService.getTTSMode(userId);
    const activeTTS = this.activeTTSRequests.has(userId);
    const serviceHealthy = await this.checkTTSServiceHealth();

    const menuText =
      `🛠️ **${userName}님의 유틸리티**\n\n` +
      "**🔊 TTS (음성 변환)**\n" +
      `• 모드: ${ttsMode}\n` +
      `• 상태: ${activeTTS ? "🔴 진행 중" : "⚪ 대기 중"}\n` +
      `• 서비스: ${serviceHealthy ? "🟢 정상" : "🔴 장애"}\n\n` +
      "텍스트를 자연스러운 음성으로 변환해드려요!\n\n" +
      "**📊 기타 유틸리티**\n" +
      "다양한 편의 기능들을 제공합니다.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
          { text: "❓ TTS 도움말", callback_data: "utils_tts_help" },
        ],
      ],
    };

    // 활성 TTS가 있으면 정지 버튼 추가
    if (activeTTS) {
      keyboard.inline_keyboard.push([
        { text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" },
      ]);
    }

    // 서비스 장애 시 진단 버튼 추가
    if (!serviceHealthy) {
      keyboard.inline_keyboard.push([
        { text: "🔧 TTS 진단", callback_data: "utils_tts_diagnostics" },
      ]);
    }

    keyboard.inline_keyboard.push([
      { text: "❓ 유틸리티 도움말", callback_data: "utils_help" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" },
    ]);

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // TTS 메뉴 표시
  async showTTSMenu(bot, chatId, messageId, userId) {
    const ttsMode = this.ttsService.getTTSMode(userId);
    const currentLanguage = this.ttsService.getUserLanguage(userId);
    const languageName =
      this.ttsService.supportedLanguages[currentLanguage] || "한국어";
    const activeTTS = this.activeTTSRequests.has(userId);
    const serviceHealthy = await this.checkTTSServiceHealth();

    const helpText =
      `🔊 **TTS (음성 변환) 설정**\n\n` +
      `📍 **현재 모드**: ${ttsMode}\n` +
      `🌍 **현재 언어**: ${languageName}\n` +
      `🔧 **서비스 상태**: ${serviceHealthy ? "🟢 정상" : "🔴 장애"}\n` +
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
      ],
    };

    // 활성 TTS가 있으면 정지 버튼 추가
    if (activeTTS) {
      keyboard.inline_keyboard.splice(2, 0, [
        { text: "⏹️ TTS 정지", callback_data: "utils_tts_stop" },
      ]);
    }

    // 서비스 장애 시 진단 버튼 추가
    if (!serviceHealthy) {
      keyboard.inline_keyboard.push([
        { text: "🔧 TTS 진단", callback_data: "utils_tts_diagnostics" },
      ]);
    }

    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "utils_tts_help" },
      { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
    ]);

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
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
      Logger.error("TTS 모드 변경 오류:", error);
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
      Logger.error("TTS 언어 설정 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 언어 설정 중 오류가 발생했습니다."
      );
    }
  }

  // TTS 도움말 표시
  async showTTSHelp(bot, chatId, messageId) {
    const helpText =
      "🔊 **TTS (음성 변환) 도움말**\n\n" +
      "**🎯 세 가지 사용 방법**\n\n" +
      "**1️⃣ 자동 모드 (추천)**\n" +
      "• 🛠️ 유틸리티 → 🔊 TTS 설정\n" +
      "• TTS 모드를 **자동**으로 설정\n" +
      "• 채팅창에 텍스트 입력하면 자동 변환!\n\n" +
      "**2️⃣ 수동 모드**\n" +
      "• `/tts 변환할 텍스트` 명령어 사용\n" +
      "• 예: `/tts 안녕하세요`\n\n" +
      "**3️⃣ OFF 모드**\n" +
      "• TTS 기능 완전 비활성화\n\n" +
      "**🌍 지원 언어 (10개)**\n" +
      "한국어, English, 日本語, 中文,\n" +
      "Español, Français, Deutsch, Italiano,\n" +
      "Português, Русский\n\n" +
      "**⚡ 주요 기능**\n" +
      "• 최대 500자 지원\n" +
      "• 실시간 정지 기능\n" +
      "• 자동 파일 정리\n" +
      "• 재시도 로직 (안정성)";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
            { text: "🔧 TTS 진단", callback_data: "utils_tts_diagnostics" },
          ],
          [{ text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" }],
        ],
      },
    });
  }

  // 유틸리티 도움말 표시
  async showUtilsHelp(bot, chatId, messageId) {
    const helpText =
      "🛠️ **유틸리티 도움말**\n\n" +
      "다양한 편의 기능을 제공합니다.\n\n" +
      "**🔊 TTS (음성 변환)**\n" +
      "• 텍스트를 자연스러운 음성으로 변환\n" +
      "• 10개 언어 지원\n" +
      "• 자동/수동 모드 선택 가능\n\n" +
      "**🚀 향후 추가 예정**\n" +
      "• 파일 변환 도구\n" +
      "• 번역 기능\n" +
      "• 기타 편의 기능들\n\n" +
      "문의사항이 있으시면 관리자에게 연락주세요!";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" }],
        ],
      },
    });
  }

  // 에러 처리
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ 오류 발생\n\n처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
    await this.sendMessage(bot, chatId, errorText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 유틸리티 메뉴", callback_data: "utils_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    });
  }

  // 일반적인 TTS 처리 에러 메시지
  async sendTTSProcessingError(bot, chatId) {
    await bot.sendMessage(
      chatId,
      "❌ **TTS 처리 오류**\n\n" +
        "TTS 처리 중 예상치 못한 오류가 발생했습니다.\n" +
        "잠시 후 다시 시도해주세요.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
              { text: "🔧 TTS 진단", callback_data: "utils_tts_diagnostics" },
            ],
          ],
        },
      }
    );
  }
}

module.exports = UtilsModule;
