// src/utils/AnimationHelper.js - 애니메이션 유틸리티

const logger = require("./Logger");

/**
 * 🎬 AnimationHelper - 애니메이션 효과 전용 유틸리티
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
   * 🔀 셔플 애니메이션 (타로 카드용)
   */
  static async performShuffle(bot, chatId, messageId = null) {
    const shuffleFrames = [
      "🎴 카드를 준비하고 있습니다\\.\\.\\.",
      "🔀 카드를 섞는 중\\.\\.\\. \\(1/3\\)",
      "🎴🔀 더 열심히 섞는 중\\.\\.\\. \\(2/3\\)",
      "🔀🎴🔀 마지막으로 한 번 더\\.\\.\\. \\(3/3\\)",
      "✨ 카드 셔플 완료\\! 결과를 확인하세요\\.",
    ];

    return await this.playFrameAnimation(bot, chatId, shuffleFrames, {
      messageId,
      frameDelay: 600,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * ⏳ 로딩 애니메이션 (일반용)
   */
  static async performLoading(
    bot,
    chatId,
    loadingText = "처리 중",
    messageId = null
  ) {
    const loadingFrames = [
      `⏳ ${loadingText}\\.\\.\\.\\.`,
      `⌛ ${loadingText}\\.\\.\\.\\.`,
      `⏳ ${loadingText}\\.\\.\\.\\.`,
      `⌛ ${loadingText}\\.\\.\\.\\.`,
      `✅ ${loadingText} 완료\\!`,
    ];

    return await this.playFrameAnimation(bot, chatId, loadingFrames, {
      messageId,
      frameDelay: 500,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * 📊 진행률 애니메이션
   */
  static async performProgress(
    bot,
    chatId,
    title = "진행 중",
    totalSteps = 5,
    messageId = null
  ) {
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

    return await this.playFrameAnimation(bot, chatId, frames, {
      messageId,
      frameDelay: 800,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * ⏰ 카운트다운 애니메이션
   */
  static async performCountdown(bot, chatId, seconds = 5, messageId = null) {
    const frames = [];

    for (let i = seconds; i >= 0; i--) {
      if (i > 0) {
        frames.push(`⏰ *카운트다운*\n\n🔢 ${i}`);
      } else {
        frames.push(`🎉 *시작\\!*\n\n✨ 준비 완료`);
      }
    }

    return await this.playFrameAnimation(bot, chatId, frames, {
      messageId,
      frameDelay: 1000,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * 💬 타이핑 애니메이션 (텍스트 순차 표시)
   */
  static async performTyping(bot, chatId, text, messageId = null) {
    const words = text.split(" ");
    const frames = [];

    let currentText = "";
    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? " " : "") + words[i];
      frames.push(currentText + (i < words.length - 1 ? "\\.\\.\\." : ""));
    }

    return await this.playFrameAnimation(bot, chatId, frames, {
      messageId,
      frameDelay: 300,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * 🎲 주사위 굴리기 애니메이션
   */
  static async performDiceRoll(bot, chatId, messageId = null) {
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

    return await this.playFrameAnimation(bot, chatId, diceFrames, {
      messageId,
      frameDelay: 400,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * 🔄 재시도 애니메이션
   */
  static async performRetry(bot, chatId, retryCount = 3, messageId = null) {
    const frames = [];

    for (let i = 1; i <= retryCount; i++) {
      frames.push(`🔄 *재시도 중*\\.\\.\\.\n\n시도 횟수: ${i}/${retryCount}`);
    }

    frames.push("✅ *재시도 완료*\\!\n\n연결되었습니다\\.");

    return await this.playFrameAnimation(bot, chatId, frames, {
      messageId,
      frameDelay: 1000,
      parseMode: "MarkdownV2",
    });
  }

  /**
   * 🎨 커스텀 애니메이션 (사용자 정의 프레임)
   */
  static async performCustomAnimation(bot, chatId, frames, options = {}) {
    return await this.playFrameAnimation(bot, chatId, frames, {
      messageId: options.messageId || null,
      frameDelay: options.frameDelay || 500,
      parseMode: options.parseMode || "MarkdownV2",
      ...options,
    });
  }

  /**
   * 🎬 프레임 애니메이션 재생 (핵심 메서드)
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

      return currentMessageId;
    } catch (error) {
      logger.error("애니메이션 재생 오류:", error);

      // 오류 발생 시 최종 프레임만 표시
      try {
        const finalFrame = frames[frames.length - 1];
        if (currentMessageId) {
          await bot.telegram.editMessageText(
            chatId,
            currentMessageId,
            undefined,
            finalFrame,
            { parse_mode: parseMode }
          );
        } else {
          const message = await bot.telegram.sendMessage(chatId, finalFrame, {
            parse_mode: parseMode,
          });
          currentMessageId = message.message_id;
        }
      } catch (fallbackError) {
        logger.error("애니메이션 폴백 오류:", fallbackError);
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
