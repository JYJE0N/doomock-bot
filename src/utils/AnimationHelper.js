// src/utils/AnimationHelper.js - Bot 객체 호환성 수정 버전

const logger = require("./Logger");

/**
 * 🎬 AnimationHelper - 애니메이션 효과 전용 유틸리티 (Bot 호환성 수정)
 *
 * ✅ 담당 기능:
 * - 셔플 애니메이션
 * - 로딩 애니메이션
 * - 진행률 표시
 * - 텍스트 애니메이션
 * - 카운트다운
 */
class AnimationHelper {
  /**
   * 🔧 Bot 객체 검증 및 정규화
   */
  static validateAndNormalizeBot(bot) {
    try {
      // 1. null/undefined 체크
      if (!bot) {
        logger.error("AnimationHelper: bot 객체가 null/undefined");
        return null;
      }

      // 2. Telegraf bot 인스턴스 체크
      if (bot.telegram && typeof bot.telegram.sendMessage === "function") {
        logger.debug("AnimationHelper: Telegraf bot 감지됨");
        return bot;
      }

      // 3. bot.bot 형태로 중첩된 경우 (ModuleManager에서 전달될 때)
      if (
        bot.bot &&
        bot.bot.telegram &&
        typeof bot.bot.telegram.sendMessage === "function"
      ) {
        logger.debug("AnimationHelper: 중첩된 bot 객체 감지됨");
        return bot.bot;
      }

      // 4. 직접 telegram 객체인 경우
      if (
        typeof bot.sendMessage === "function" &&
        typeof bot.editMessageText === "function"
      ) {
        logger.debug("AnimationHelper: 직접 telegram 객체 감지됨");
        return { telegram: bot };
      }

      logger.error("AnimationHelper: 지원하지 않는 bot 객체 구조:", {
        hasBot: !!bot,
        hasTelegram: !!bot.telegram,
        type: typeof bot,
        keys: bot ? Object.keys(bot) : [],
      });

      return null;
    } catch (error) {
      logger.error("AnimationHelper.validateAndNormalizeBot 오류:", error);
      return null;
    }
  }

  /**
   * 🔀 셔플 애니메이션 (타로 카드용) - 안전한 버전
   */
  static async performShuffle(bot, chatId, messageId = null) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performShuffle: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      const shuffleFrames = [
        "🎴 카드를 준비하고 있습니다\\.\\.\\.",
        "🔀 카드를 섞는 중\\.\\.\\. \\(1/3\\)",
        "🎴🔀 더 열심히 섞는 중\\.\\.\\. \\(2/3\\)",
        "🔀🎴🔀 마지막으로 한 번 더\\.\\.\\. \\(3/3\\)",
        "✨ 카드 셔플 완료\\! 결과를 확인하세요\\.",
      ];

      return await this.playFrameAnimation(validBot, chatId, shuffleFrames, {
        messageId,
        frameDelay: 600,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performShuffle 오류:", error);
      return null;
    }
  }

  /**
   * ⏳ 로딩 애니메이션 (일반용) - 안전한 버전
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
        return null;
      }

      const loadingFrames = [
        `⏳ ${loadingText}\\.\\.\\.\\.`,
        `⌛ ${loadingText}\\.\\.\\.\\.`,
        `⏳ ${loadingText}\\.\\.\\.\\.`,
        `⌛ ${loadingText}\\.\\.\\.\\.`,
        `✅ ${loadingText} 완료\\!`,
      ];

      return await this.playFrameAnimation(validBot, chatId, loadingFrames, {
        messageId,
        frameDelay: 500,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performLoading 오류:", error);
      return null;
    }
  }

  /**
   * 📊 진행률 애니메이션 - 안전한 버전
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
        return null;
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
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performProgress 오류:", error);
      return null;
    }
  }

  /**
   * ⏰ 카운트다운 애니메이션 - 안전한 버전
   */
  static async performCountdown(bot, chatId, seconds = 5, messageId = null) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performCountdown: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      const frames = [];

      for (let i = seconds; i >= 0; i--) {
        if (i > 0) {
          frames.push(`⏰ *카운트다운*\n\n🔢 ${i}`);
        } else {
          frames.push(`🎉 *시작\\!*\n\n✨ 준비 완료`);
        }
      }

      return await this.playFrameAnimation(validBot, chatId, frames, {
        messageId,
        frameDelay: 1000,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performCountdown 오류:", error);
      return null;
    }
  }

  /**
   * 💬 타이핑 애니메이션 (텍스트 순차 표시) - 안전한 버전
   */
  static async performTyping(bot, chatId, text, messageId = null) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performTyping: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      const words = text.split(" ");
      const frames = [];

      let currentText = "";
      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? " " : "") + words[i];
        frames.push(currentText + (i < words.length - 1 ? "\\.\\.\\." : ""));
      }

      return await this.playFrameAnimation(validBot, chatId, frames, {
        messageId,
        frameDelay: 300,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performTyping 오류:", error);
      return null;
    }
  }

  /**
   * 🎲 주사위 굴리기 애니메이션 - 안전한 버전
   */
  static async performDiceRoll(bot, chatId, messageId = null) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performDiceRoll: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      const diceFrames = [
        "🎲 주사위를 굴리는 중\\.\\.\\.",
        "🎲 굴리는 중\\.\\.\\. ⚪",
        "🎲 굴리는 중\\.\\.\\. ⚫",
        "🎲 굴리는 중\\.\\.\\. ⚪",
        "🎲 굴리는 중\\.\\.\\. ⚫",
      ];

      // 1-6 랜덤 결과
      const result = Math.floor(Math.random() * 6) + 1;
      const diceEmoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"][result - 1];

      diceFrames.push(`🎲 *결과*: ${diceEmoji} \\(${result}\\)`);

      return await this.playFrameAnimation(validBot, chatId, diceFrames, {
        messageId,
        frameDelay: 400,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performDiceRoll 오류:", error);
      return null;
    }
  }

  /**
   * 🔄 재시도 애니메이션 - 안전한 버전
   */
  static async performRetry(bot, chatId, retryCount = 3, messageId = null) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performRetry: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      const frames = [];

      for (let i = 1; i <= retryCount; i++) {
        frames.push(`🔄 *재시도 중*\\.\\.\\.\n\n시도 횟수: ${i}/${retryCount}`);
      }

      frames.push("✅ *재시도 완료*\\!\n\n연결되었습니다\\.");

      return await this.playFrameAnimation(validBot, chatId, frames, {
        messageId,
        frameDelay: 1000,
        parseMode: "MarkdownV2",
      });
    } catch (error) {
      logger.error("AnimationHelper.performRetry 오류:", error);
      return null;
    }
  }

  /**
   * 🎨 커스텀 애니메이션 (사용자 정의 프레임) - 안전한 버전
   */
  static async performCustomAnimation(bot, chatId, frames, options = {}) {
    try {
      const validBot = this.validateAndNormalizeBot(bot);
      if (!validBot) {
        logger.warn(
          "AnimationHelper.performCustomAnimation: 유효하지 않은 bot 객체 - 애니메이션 건너뜀"
        );
        return null;
      }

      return await this.playFrameAnimation(validBot, chatId, frames, {
        messageId: options.messageId || null,
        frameDelay: options.frameDelay || 500,
        parseMode: options.parseMode || "MarkdownV2",
        ...options,
      });
    } catch (error) {
      logger.error("AnimationHelper.performCustomAnimation 오류:", error);
      return null;
    }
  }

  /**
   * 🎬 프레임 애니메이션 재생 (핵심 메서드) - 안전한 버전
   */
  static async playFrameAnimation(bot, chatId, frames, options = {}) {
    const {
      messageId = null,
      frameDelay = 500,
      parseMode = "MarkdownV2",
      finalFrameDelay = null,
    } = options;

    let currentMessageId = messageId;

    try {
      // Bot 객체 재검증
      if (!bot || !bot.telegram) {
        throw new Error("유효하지 않은 bot 객체");
      }

      logger.debug(
        `🎬 애니메이션 시작: ${frames.length}프레임, 채팅ID: ${chatId}`
      );

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const isLastFrame = i === frames.length - 1;

        if (currentMessageId) {
          // 기존 메시지 업데이트
          await bot.telegram.editMessageText(
            chatId,
            currentMessageId,
            undefined,
            frame,
            { parse_mode: parseMode }
          );
        } else {
          // 새 메시지 전송 (첫 번째 프레임만)
          if (i === 0) {
            const message = await bot.telegram.sendMessage(chatId, frame, {
              parse_mode: parseMode,
            });
            currentMessageId = message.message_id;
          }
        }

        // 마지막 프레임이 아닌 경우에만 딜레이
        if (!isLastFrame) {
          const delay =
            finalFrameDelay && isLastFrame ? finalFrameDelay : frameDelay;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      logger.debug(`✅ 애니메이션 완료: 메시지ID ${currentMessageId}`);
      return currentMessageId;
    } catch (error) {
      logger.error("애니메이션 재생 오류:", error);

      // 오류 발생 시 최종 프레임만 표시 (안전한 폴백)
      try {
        const finalFrame = frames[frames.length - 1];
        if (currentMessageId && bot && bot.telegram) {
          await bot.telegram.editMessageText(
            chatId,
            currentMessageId,
            undefined,
            finalFrame,
            { parse_mode: parseMode }
          );
        } else if (bot && bot.telegram) {
          const message = await bot.telegram.sendMessage(chatId, finalFrame, {
            parse_mode: parseMode,
          });
          currentMessageId = message.message_id;
        }
      } catch (fallbackError) {
        logger.error("애니메이션 폴백 오류:", fallbackError);
        // 완전 실패 시 null 반환
        return null;
      }

      return currentMessageId;
    }
  }

  /**
   * ⏸️ 애니메이션 일시정지
   */
  static async pause(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  /**
   * 🎯 애니메이션 프리셋
   */
  static getPresets() {
    return {
      // 빠른 애니메이션
      fast: { frameDelay: 200 },

      // 보통 속도
      normal: { frameDelay: 500 },

      // 느린 애니메이션
      slow: { frameDelay: 1000 },

      // 매우 느린 애니메이션
      verySlow: { frameDelay: 2000 },

      // 즉시 (애니메이션 없음)
      instant: { frameDelay: 0 },
    };
  }

  /**
   * 🎭 테마별 애니메이션
   */
  static getThemes() {
    return {
      // 게임 테마
      gaming: {
        loading: ["🎮", "🕹️", "🎯", "🏆"],
        success: ["🎉", "🏆", "✨", "🎊"],
        error: ["💥", "😵", "🚫", "❌"],
      },

      // 업무 테마
      business: {
        loading: ["💼", "📊", "📈", "⚡"],
        success: ["✅", "📋", "💯", "🎯"],
        error: ["⚠️", "📛", "🚨", "❌"],
      },

      // 마법 테마
      magic: {
        loading: ["🔮", "✨", "🌟", "💫"],
        success: ["🎭", "🌈", "⭐", "🎪"],
        error: ["💀", "🌙", "⚡", "❌"],
      },
    };
  }

  /**
   * 📊 애니메이션 통계
   */
  static getStats() {
    return {
      totalAnimations: this.animationCount || 0,
      averageFrameDelay: 500,
      supportedTypes: [
        "shuffle",
        "loading",
        "progress",
        "countdown",
        "typing",
        "dice",
        "retry",
        "custom",
      ],
    };
  }
}

// 애니메이션 카운터 (선택사항)
AnimationHelper.animationCount = 0;

module.exports = AnimationHelper;
