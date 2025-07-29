// src/modules/TodoModule.js - 수정된 완전한 Todo 모듈
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");

class TodoModule extends BaseModule {
  constructor(bot, options) {
    super("TodoModule", { bot, ...options });

    // ✅ 수정: userStates Map 초기화 추가
    this.userStates = new Map();
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    // ServiceBuilder가 미리 만들어 둔 서비스 인스턴스를 찾습니다
    this.todoService = this.serviceBuilder.getServiceInstance("todo");

    if (!this.todoService) {
      throw new Error(
        "TodoService 인스턴스를 ServiceBuilder에서 찾을 수 없습니다."
      );
    }

    this.setupActions();
    logger.success("✅ TodoModule 초기화 완료.");
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showList,
      list: this.showList,
      add_prompt: this.promptAdd,
      toggle: this.toggleTodo,
      delete: this.deleteTodo,
    });
  }

  /**
   * 메시지 처리 (할일 입력 대기 상태 처리)
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg.from);

    // ✅ 수정: 안전한 상태 확인
    const state = this.getModuleState(userId);

    if (state?.awaitingInput) {
      logger.info(`TodoModule: 새 할일 입력 받음 (사용자: ${userId})`);
      const text = msg.text;

      try {
        await this.todoService.addTodo(userId, text);
        this.clearModuleState(userId); // 상태 초기화

        // 할일 추가 성공 메시지
        await bot.telegram.sendMessage(
          userId,
          `✅ 할일 '${text}'이(가) 추가되었습니다.`
        );

        return true;
      } catch (error) {
        logger.error("할일 추가 실패:", error);
        await bot.telegram.sendMessage(
          userId,
          "❌ 할일 추가에 실패했습니다. 다시 시도해주세요."
        );
        return true;
      }
    }

    return false;
  }

  /**
   * 할일 목록 표시
   */
  async showList(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    logger.info(`TodoModule: 목록 표시 요청 (사용자: ${userId})`);

    try {
      const todos = await this.todoService.getTodos(userId);

      return {
        module: "todo",
        type: "list",
        data: { todos },
      };
    } catch (error) {
      logger.error("할일 목록 조회 실패:", error);
      return {
        module: "todo",
        type: "error",
        data: { message: "할일 목록을 불러올 수 없습니다." },
      };
    }
  }

  /**
   * 할일 추가 안내
   */
  async promptAdd(bot, callbackQuery) {
    const userId = getUserId(callbackQuery.from);
    logger.info(`TodoModule: 추가 안내 (사용자: ${userId})`);

    this.setModuleState(userId, { awaitingInput: true });

    return {
      module: "todo",
      type: "add_prompt",
      data: {},
    };
  }

  /**
   * 할일 완료/미완료 토글
   */
  async toggleTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    logger.info(`TodoModule: 토글 요청 (사용자: ${userId}, ID: ${todoId})`);

    try {
      const result = await this.todoService.toggleTodo(userId, todoId);

      if (!result) {
        return {
          module: "todo",
          type: "error",
          data: { message: "할일을 찾을 수 없습니다." },
        };
      }

      // 토글 후 목록 다시 표시
      return await this.showList(bot, callbackQuery);
    } catch (error) {
      logger.error("할일 토글 실패:", error);
      return {
        module: "todo",
        type: "error",
        data: { message: "할일 상태 변경에 실패했습니다." },
      };
    }
  }

  /**
   * 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, params) {
    const userId = getUserId(callbackQuery.from);
    const todoId = params;

    logger.info(`TodoModule: 삭제 요청 (사용자: ${userId}, ID: ${todoId})`);

    try {
      const result = await this.todoService.deleteTodo(userId, todoId);

      if (!result) {
        return {
          module: "todo",
          type: "error",
          data: { message: "할일을 찾을 수 없습니다." },
        };
      }

      // 삭제 후 목록 다시 표시
      return await this.showList(bot, callbackQuery);
    } catch (error) {
      logger.error("할일 삭제 실패:", error);
      return {
        module: "todo",
        type: "error",
        data: { message: "할일 삭제에 실패했습니다." },
      };
    }
  }

  /**
   * ✅ 수정: 동기적 모듈 상태 관리 메서드들
   */
  getModuleState(userId) {
    return this.userStates.get(String(userId));
  }

  setModuleState(userId, state) {
    this.userStates.set(String(userId), state);
  }

  clearModuleState(userId) {
    this.userStates.delete(String(userId));
  }

  /**
   * 명령어 추출 헬퍼
   */
  extractCommand(text) {
    if (!text) return null;

    // /command 형식
    if (text.startsWith("/")) {
      return text.split(" ")[0].substring(1).toLowerCase();
    }

    // 일반 텍스트 명령어
    const lowerText = text.trim().toLowerCase();
    const commands = ["todo", "할일", "todos", "할일목록"];

    return commands.find(
      (cmd) => lowerText === cmd || lowerText.startsWith(cmd + " ")
    );
  }

  /**
   * 로그 상태값을 위한 메서드
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceStatus: this.todoService ? "Ready" : "Not Connected",
      userStatesCount: this.userStates.size,
      stats: this.stats,
    };
  }
}

module.exports = TodoModule;
