// src/middleware/AuthMiddleware.js - Import 수정
const logger = require("../utils/Logger");
const { AppConfig } = require("../config/AppConfig");

class AuthMiddleware {
  constructor() {
    this.config = AppConfig.getConfig();
    this.allowedUsers = this.config.security.allowedUsers;
    this.adminUsers = this.config.security.adminUsers;
  }

  async checkAuth(msg) {
    const userId = msg.from.id.toString();

    // 허용된 사용자 목록이 없으면 모든 사용자 허용
    if (!this.allowedUsers || this.allowedUsers.length === 0) {
      return { allowed: true, isAdmin: this.isAdmin(userId) };
    }

    // 허용된 사용자인지 확인
    const allowed = this.allowedUsers.includes(userId);

    if (!allowed) {
      logger.warn(
        `접근 거부: 사용자 ${userId} (${
          msg.from.username || msg.from.first_name
        })`
      );
    }

    return {
      allowed,
      isAdmin: this.isAdmin(userId),
      userId,
    };
  }

  isAdmin(userId) {
    return this.adminUsers.includes(userId.toString());
  }

  async handleUnauthorized(bot, chatId, userName) {
    const message =
      `❌ ${userName}님, 이 봇을 사용할 권한이 없습니다.\n\n` +
      "봇 사용 권한이 필요하시면 관리자에게 문의해주세요.";

    await bot.sendMessage(chatId, message);
    logger.warn(`무권한 접근 시도: 사용자 ${chatId}`);
  }

  createAuthDecorator() {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args) {
        const bot = args[0];
        const msg = args[1];

        if (!msg || !msg.from) {
          return;
        }

        const authResult = await this.checkAuth(msg);

        if (!authResult.allowed) {
          await this.handleUnauthorized(bot, msg.chat.id, msg.from.first_name);
          return;
        }

        // 권한이 있으면 원본 메서드 실행
        return method.apply(this, args);
      }.bind(this);

      return descriptor;
    };
  }
}

module.exports = { AuthMiddleware };

// src/middleware/RateLimitMiddleware.js - Import 수정
const logger = require("../utils/Logger");
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
      logger.warn(
        `사용자 ${userId} 요청 제한 초과: ${userRecord.count}/${maxRequests}`
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
    for (const [userId, record] of this.userRequests) {
      if (now > record.resetTime) {
        this.userRequests.delete(userId);
      }
    }
  }

  createRateLimitDecorator() {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args) {
        const bot = args[0];
        const msg = args[1];

        if (!msg || !msg.from) {
          return;
        }

        const rateLimitResult = await this.checkRateLimit(msg);

        if (!rateLimitResult.allowed) {
          await this.handleRateLimit(bot, msg.chat.id, rateLimitResult);
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
