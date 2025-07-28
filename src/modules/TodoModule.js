// src/modules/TodoModule.js - 안정화된 최종 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

class TodoModule extends BaseModule {
  constructor(bot, options) {
    super("TodoModule", { bot, ...options });
  }

  async onInitialize() {
    // TodoService는 ServiceBuilder를 통해 주입됩니다.
    this.todoService = this.serviceBuilder.getService("todo");
    this.setupActions();
    logger.success("✅ TodoModule 초기화 완료.");
  }

  setupActions() {
    this.registerActions({
      menu: this.showList, // 'menu' 요청이 오면 리스트를 보여줍니다.
      list: this.showList,
      add_prompt: this.promptAdd,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,
    });
  }

  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);
    const state = await this.getModuleState(userId);

    if (state?.awaitingInput) {
      logger.info(`TodoModule: 새 할 일 입력 받음 (사용자: ${userId})`);
      const text = msg.text;
      await this.todoService.addTodo(userId, text);
      await this.clearModuleState(userId); // 상태 초기화

      // 할 일 추가 후, 자동으로 목록을 다시 보여줍니다.
      const listData = await this.showList(bot, { from: { id: userId } });
      // 중요: 메시지를 새로 보내거나 수정해야 하므로 NavigationHandler에 렌더링을 위임합니다.
      // 이 부분은 BotController나 NavigationHandler에서 후처리가 필요할 수 있습니다.
      // 지금은 일단 추가만 되도록 단순화합니다.
      await bot.telegram.sendMessage(
        userId,
        `✅ 할 일 '${text}'이(가) 추가되었습니다.`
      );
      return true;
    }
    return false;
  }

  // 할 일 목록을 보여주는 표준 함수
  async showList(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    logger.info(`TodoModule: 목록 표시 요청 (사용자: ${userId})`);
    const todos = await this.todoService.getTodos(userId);
    return {
      module: "todo",
      type: "list", // NavigationHandler가 이 타입을 보고 화면을 그립니다.
      data: { todos },
    };
  }

  // 할 일 추가를 안내하는 함수
  async promptAdd(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    logger.info(`TodoModule: 추가 안내 (사용자: ${userId})`);
    await this.setModuleState(userId, { awaitingInput: true });
    return {
      module: "todo",
      type: "add_prompt", // 'add_prompt' 타입으로 렌더링 요청
      data: {},
    };
  }

  // 할 일 완료/미완료 처리
  async toggleTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params; // 'todo:toggle:some_id' 에서 some_id 부분
    logger.info(`TodoModule: 토글 요청 (사용자: ${userId}, ID: ${todoId})`);
    await this.todoService.toggleTodo(userId, todoId);
    // 처리 후, 최신 목록 데이터를 다시 반환하여 화면을 갱신합니다.
    return await this.showList(bot, callbackQuery);
  }

  // 할 일 삭제
  async deleteTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;
    logger.info(`TodoModule: 삭제 요청 (사용자: ${userId}, ID: ${todoId})`);
    await this.todoService.deleteTodo(userId, todoId);
    return await this.showList(bot, callbackQuery);
  }
}

module.exports = TodoModule;
