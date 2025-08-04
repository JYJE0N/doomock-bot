// 🔧 AnimationHelper.js - Bot 객체 검증 로직 수정

const logger = require("./Logger");

/**
 * 🎬 AnimationHelper - 애니메이션 효과 전용 유틸리티 (Bot 호환성 수정)
 */
class AnimationHelper {
  /**
   * 🔧 Bot 객체 검증 및 정규화 (수정된 버전)
   */
  static validateAndNormalizeBot(bot) {
    try {
      // 1. null/undefined 체크
      if (!bot) {
        logger.error("AnimationHelper: bot 객체가 null/undefined");
        return null;
      }

      logger.debug("AnimationHelper: Bot 객체 분석 시작", {
        type: typeof bot,
        hasBot: !!bot,
        hasTelegram: !!bot.telegram,
        botKeys: Object.keys(bot),
        telegrafMethods: bot.telegram
          ? Object.keys(bot.telegram).slice(0, 5)
          : []
      });

      // 2. Telegraf bot 인스턴스 체크 (일반적인 경우)
      if (bot.telegram && typeof bot.telegram.sendMessage === "function") {
        logger.debug("AnimationHelper: ✅ 표준 Telegraf bot 감지됨");
        return bot;
      }

      // 3. bot.bot 형태로 중첩된 경우 체크
      if (
        bot.bot &&
        bot.bot.telegram &&
        typeof bot.bot.telegram.sendMessage === "function"
      ) {
        logger.debug("AnimationHelper: ✅ 중첩된 bot 객체 감지됨");
        return bot.bot;
      }

      // 4. 직접 telegram 객체인 경우
      if (
        typeof bot.sendMessage === "function" &&
        typeof bot.editMessageText === "function"
      ) {
        logger.debug("AnimationHelper: ✅ 직접 telegram API 객체 감지됨");
        return { telegram: bot };
      }

      // 5. ✅ 추가: BotController에서 전달되는 경우 체크
      if (bot.bot && bot.bot.bot && bot.bot.bot.telegram) {
        logger.debug("AnimationHelper: ✅ BotController 래핑된 bot 감지됨");
        return bot.bot.bot;
      }

      // 6. ✅ 추가: ModuleManager를 통해 전달되는 경우
      if (
        bot.moduleManager &&
        bot.moduleManager.bot &&
        bot.moduleManager.bot.telegram
      ) {
        logger.debug("AnimationHelper: ✅ ModuleManager를 통한 bot 감지됨");
        return bot.moduleManager.bot;
      }

      // 7. ✅ 추가: context 객체에서 bot 추출 시도
      if (bot.botInfo && typeof bot.reply === "function") {
        logger.debug(
          "AnimationHelper: ✅ Telegraf context 객체에서 bot 추출 시도"
        );
        // context 객체인 경우, telegram API 직접 접근
        return { telegram: bot.telegram };
      }

      // 8. ✅ 마지막 시도: 객체를 깊이 탐색해서 telegram API 찾기
      const telegramApi = this.findTelegramApi(bot);
      if (telegramApi) {
        logger.debug("AnimationHelper: ✅ 깊이 탐색으로 telegram API 발견");
        return { telegram: telegramApi };
      }

      // 모든 시도 실패
      logger.error("AnimationHelper: ❌ 지원하지 않는 bot 객체 구조:", {
        hasBot: !!bot,
        hasTelegram: !!bot.telegram,
        type: typeof bot,
        keys: bot ? Object.keys(bot).slice(0, 10) : [], // 처음 10개만
        constructor: bot ? bot.constructor.name : null
      });

      return null;
    } catch (error) {
      logger.error("AnimationHelper.validateAndNormalizeBot 오류:", error);
      return null;
    }
  }
  /**
   * 🎴 카드 뽑기 애니메이션 (타로 카드용)
   * FortuneModule에서 사용하는 카드 뽑기 애니메이션
   */
  static async performDraw(bot, chatId, messageId = null) {
    try {
      logger.debug("🎬 performDraw 시작", {
        hasBotParam: !!bot,
        chatId,
        messageId
      });

      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performDraw: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return "animation_skipped";
      }

      const drawFrames = [
        "🎴 타로 카드를 준비하고 있습니다\\.\\.\\.",
        "🔮 우주의 에너지를 모으는 중\\.\\.\\.",
        "✨ 당신을 위한 카드를 선택하는 중\\.\\.\\.",
        "🌟 카드의 메시지를 해석하는 중\\.\\.\\.",
        "🎴 카드를 뽑았습니다\\! 결과를 확인하세요\\."
      ];

      logger.debug("🎬 카드 뽑기 애니메이션 시작");

      return await this.playFrameAnimation(validBot, chatId, drawFrames, {
        messageId,
        frameDelay: 700,
        parseMode: "MarkdownV2"
      });
    } catch (error) {
      logger.error("AnimationHelper.performDraw 오류:", error);
      return "animation_error";
    }
  }

  /**
   * 🔍 객체에서 Telegram API 깊이 탐색
   */
  static findTelegramApi(obj, depth = 0, maxDepth = 3) {
    if (depth > maxDepth || !obj || typeof obj !== "object") {
      return null;
    }

    // 현재 객체가 telegram API인지 확인
    if (
      typeof obj.sendMessage === "function" &&
      typeof obj.editMessageText === "function"
    ) {
      return obj;
    }

    // 하위 프로퍼티들을 재귀적으로 탐색
    for (const [key, value] of Object.entries(obj)) {
      if (key === "telegram" && value && typeof value === "object") {
        const found = this.findTelegramApi(value, depth + 1, maxDepth);
        if (found) return found;
      }

      if (key === "bot" && value && typeof value === "object") {
        const found = this.findTelegramApi(value, depth + 1, maxDepth);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 🔀 셔플 애니메이션 (타로 카드용) - 강화된 안전 버전
   */
  static async performShuffle(bot, chatId, messageId = null) {
    try {
      logger.debug("🎬 performShuffle 시작", {
        hasBotParam: !!bot,
        chatId,
        messageId
      });

      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performShuffle: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );

        // ✅ 수정: null 대신 더미 메시지 ID 반환으로 오류 방지
        return "animation_skipped";
      }

      const shuffleFrames = [
        "🎴 카드를 준비하고 있습니다\\.\\.\\.",
        "🔀 카드를 섞는 중\\.\\.\\. \\(1/3\\)",
        "🎴🔀 더 열심히 섞는 중\\.\\.\\. \\(2/3\\)",
        "🔀🎴🔀 마지막으로 한 번 더\\.\\.\\. \\(3/3\\)",
        "✨ 카드 셔플 완료\\! 결과를 확인하세요\\."
      ];

      logger.debug("🎬 프레임 애니메이션 시작");

      return await this.playFrameAnimation(validBot, chatId, shuffleFrames, {
        messageId,
        frameDelay: 600,
        parseMode: "MarkdownV2"
      });
    } catch (error) {
      logger.error("AnimationHelper.performShuffle 오류:", error);

      // ✅ 오류 시에도 더미 값 반환
      return "animation_error";
    }
  }

  /**
   * 🎬 프레임 애니메이션 재생 (안전한 버전)
   */
  static async playFrameAnimation(bot, chatId, frames, options = {}) {
    try {
      const {
        messageId = null,
        frameDelay = 500,
        parseMode = "MarkdownV2",
        finalFrame = null
      } = options;

      let currentMessageId = messageId;

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const isLastFrame = i === frames.length - 1;

        try {
          if (currentMessageId) {
            // 기존 메시지 수정
            await bot.telegram.editMessageText(
              chatId,
              currentMessageId,
              undefined,
              frame,
              {
                parse_mode: parseMode
              }
            );
          } else {
            // 새 메시지 전송
            const sentMessage = await bot.telegram.sendMessage(chatId, frame, {
              parse_mode: parseMode
            });
            currentMessageId = sentMessage.message_id;
          }

          // 마지막 프레임이 아니면 지연
          if (!isLastFrame) {
            await this.delay(frameDelay);
          }
        } catch (frameError) {
          logger.warn(`프레임 ${i + 1} 처리 중 오류:`, frameError.message);

          // 메시지 수정 실패 시 새 메시지로 전송 시도
          if (frameError.message.includes("message is not modified")) {
            continue; // 같은 내용이면 스킵
          }

          // 그 외 오류는 새 메시지로 전송 시도
          try {
            const sentMessage = await bot.telegram.sendMessage(chatId, frame, {
              parse_mode: parseMode
            });
            currentMessageId = sentMessage.message_id;
          } catch (sendError) {
            logger.error(
              `프레임 ${i + 1} 새 메시지 전송도 실패:`,
              sendError.message
            );
          }
        }
      }

      // 최종 프레임이 있으면 표시
      if (finalFrame && currentMessageId) {
        await this.delay(frameDelay);
        try {
          await bot.telegram.editMessageText(
            chatId,
            currentMessageId,
            undefined,
            finalFrame,
            {
              parse_mode: parseMode
            }
          );
        } catch (finalError) {
          logger.warn("최종 프레임 표시 실패:", finalError.message);
        }
      }

      return currentMessageId;
    } catch (error) {
      logger.error("AnimationHelper.playFrameAnimation 오류:", error);
      return null;
    }
  }

  /**
   * ⏱️ 지연 헬퍼
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ⏳ 로딩 애니메이션 (안전한 버전)
   */
  static async performLoading(
    bot,
    chatId,
    loadingText = "처리 중",
    messageId = null
  ) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performLoading: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return "loading_skipped";
      }

      const loadingFrames = [
        `⏳ ${loadingText}\\.\\.\\.\\.`,
        `⌛ ${loadingText}\\.\\.\\.\\.`,
        `⏳ ${loadingText}\\.\\.\\.\\.`,
        `⌛ ${loadingText}\\.\\.\\.\\.`,
        `✅ ${loadingText} 완료\\!`
      ];

      return await this.playFrameAnimation(validBot, chatId, loadingFrames, {
        messageId,
        frameDelay: 500,
        parseMode: "MarkdownV2"
      });
    } catch (error) {
      logger.error("AnimationHelper.performLoading 오류:", error);
      return "loading_error";
    }
  }

  /**
   * 📊 진행률 애니메이션 (안전한 버전)
   */
  static async performProgress(
    bot,
    chatId,
    title = "진행 중",
    totalSteps = 5,
    messageId = null
  ) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performProgress: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return "progress_skipped";
      }

      const frames = [];

      for (let i = 0; i <= totalSteps; i++) {
        const percent = Math.round((i / totalSteps) * 100);
        const filledBars = "█".repeat(i);
        const emptyBars = "░".repeat(totalSteps - i);

        frames.push(
          `📊 *${title}*\n\n` +
            `${filledBars}${emptyBars} ${percent}%\n\n` +
            `단계: ${i}/${totalSteps}`
        );
      }

      return await this.playFrameAnimation(validBot, chatId, frames, {
        messageId,
        frameDelay: 800,
        parseMode: "MarkdownV2"
      });
    } catch (error) {
      logger.error("AnimationHelper.performProgress 오류:", error);
      return "progress_error";
    }
  }
}

module.exports = AnimationHelper;
