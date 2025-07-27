// src/modules/TodoModule.js - 업데이트된 사용법

const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger"); // ✅ Enhanced Logger 사용

class TodoModule extends BaseModule {
  async addTodo(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
    } = callbackQuery;
    const userName = this.getUserName(callbackQuery);

    // ✅ 통합 메시지 시스템 사용
    const loadingMsg = await logger.sendLoading(bot, chatId, "할일 추가 중");

    try {
      // 할일 추가 로직...
      const task = "새로운 할일";

      // ✅ Enhanced 로그 출력 (콘솔)
      logger.todo("add", task, userName);

      // ✅ 로딩 메시지 업데이트 (텔레그램)
      await logger.updateLoading(
        bot,
        chatId,
        loadingMsg.message_id,
        "할일이 추가되었습니다!",
        true
      );

      // ✅ 성공 메시지 (텔레그램 + 콘솔)
      await logger.sendSuccess(
        bot,
        chatId,
        "할일 추가 완료",
        `"${task}"이(가) 추가되었습니다.`
      );
    } catch (error) {
      // ✅ 에러 처리 (텔레그램 + 콘솔)
      logger.error("할일 추가 실패", error);
      await logger.sendError(
        bot,
        chatId,
        "할일 추가 실패",
        "다시 시도해주세요."
      );
    }
  }

  async showTodoMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
    } = callbackQuery;
    const userName = this.getUserName(callbackQuery);

    // ✅ 사용자 로그 (콘솔)
    logger.user("callback", userName, { action: "todo:menu" });

    // 할일 목록 가져오기...
    const todos = await this.todoService.getTodos(userId);

    // ✅ 통합 할일 목록 전송 (텔레그램 + 콘솔)
    await logger.sendTodoList(bot, chatId, todos, {
      currentPage: 1,
      totalPages: 1,
    });
  }
}
