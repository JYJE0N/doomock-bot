const { Logger } = require("../utils/Logger");
const { AppConfig } = require("../config/AppConfig");

class RateLimitMiddleware {
  constructor() {
    this.config = AppConfig.getConfig();
    this.userRequests = new Map(); // userId -> { count, resetTime }
    this.globalRequests = new Map(); // 전역 요청 추적

    // 주기적으로 오래된 기록 정리
    setInterval(() => this.cleanup(), 60 * 1000); // 1분마다
  }

  async checkRateLimit(msg) {
    const userId = msg.from.id.toString();
    const now = Date.now();
    const window = this.config.security.rateLimit.window;
    const maxRequests = this.config.security.rateLimit.max;

    // 사용자별 요청 제한 확인
    const userRecord = this.userRequests.get(userId) || {
      count: 0,
      resetTime: now + window,
    };

    // 윈도우가 지났으면 리셋
    if (now > userRecord.resetTime) {
      userRecord.count = 0;
      userRecord.resetTime = now + window;
    }

    // 요청 수 증가
    userRecord.count++;
    this.userRequests.set(userId, userRecord);

    // 제한 확인
    if (userRecord.count > maxRequests) {
      const remainingTime = Math.ceil((userRecord.resetTime - now) / 1000 / 60);
      Logger.warn(
        `사용자 ${userId} 요청 제한 초과: ${userRecord.count}/${maxRequests}`,
      );

      return {
        allowed: false,
        remainingTime,
        currentCount: userRecord.count,
        maxRequests,
      };
    }

    return {
      allowed: true,
      currentCount: userRecord.count,
      maxRequests,
      remainingTime: Math.ceil((userRecord.resetTime - now) / 1000 / 60),
    };
  }

  async handleRateLimit(bot, chatId, rateLimitInfo) {
    const message =
      "⏳ 너무 많은 요청을 보내셨습니다.\n\n" +
      `• 현재 요청: ${rateLimitInfo.currentCount}/${rateLimitInfo.maxRequests}\n` +
      `• 제한 해제: 약 ${rateLimitInfo.remainingTime}분 후\n\n` +
      "잠시 후 다시 시도해주세요.";

    await bot.sendMessage(chatId, message);
  }

  cleanup() {
    const now = Date.now();

    // 만료된 사용자 기록 삭제
    for (const [userId, record] of this.userRequests.entries()) {
      if (now > record.resetTime + 60000) {
        // 1분 여유
        this.userRequests.delete(userId);
      }
    }

    Logger.info(
      `요청 제한 기록 정리 완료: ${this.userRequests.size}개 사용자 활성`,
    );
  }

  getStats() {
    return {
      activeUsers: this.userRequests.size,
      totalTrackedRequests: Array.from(this.userRequests.values()).reduce(
        (sum, record) => sum + record.count,
        0,
      ),
    };
  }

  createRateLimitDecorator() {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args) {
        const bot = args[0];
        const msg = args[1];

        if (!msg || !msg.from) {
          return method.apply(this, args);
        }

        const rateLimitCheck = await this.checkRateLimit(msg);

        if (!rateLimitCheck.allowed) {
          await this.handleRateLimit(bot, msg.chat.id, rateLimitCheck);
          return;
        }

        // 제한에 걸리지 않으면 원본 메서드 실행
        return method.apply(this, args);
      }.bind(this);

      return descriptor;
    };
  }
}

module.exports = { RateLimitMiddleware };
