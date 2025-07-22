const logger = require("../utils/Logger");
const { AppConfig } = require("../config/AppConfig");

class AuthMiddleware {
  constructor() {
    this.config = AppConfig.getConfig();
    this.allowedUsers = this.config.security.allowedUsers;
    this.adminUsers = process.env.ADMIN_USERS
      ? process.env.ADMIN_USERS.split(",")
      : [];
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
