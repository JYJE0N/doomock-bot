// handlers/ErrorHandler.js (새로 생성)
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  async handleError(error, context, bot, chatId) {
    this.logger.error(`💥 ${context} 오류:`, {
      error: error.message,
      stack: error.stack,
    });

    // 사용자에게 친화적인 에러 메시지 전송
    const userMessage = this.getUserFriendlyMessage(error);

    try {
      await bot.telegram.sendMessage(chatId, userMessage);
    } catch (sendError) {
      this.logger.error("에러 메시지 전송 실패:", sendError);
    }
  }

  getUserFriendlyMessage(error) {
    // 에러 타입에 따른 사용자 친화적 메시지
    if (error.message.includes("can't parse entities")) {
      return "⚠️ 메시지 형식에 문제가 있습니다. 잠시 후 다시 시도해주세요.";
    }

    if (error.message.includes("isConnected is not a function")) {
      return "⚠️ 데이터베이스 연결을 확인하는 중 문제가 발생했습니다.";
    }

    return "⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

module.exports = ErrorHandler;
