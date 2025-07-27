// src/modules/TodoModule.js
// 📝 할일 관리 모듈 (v3.0.1)

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/LoggerEnhancer");
const TodoService = require("../services/TodoService");
const { getUserName, getUserId } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📝 TodoModule - 할일 관리 모듈
 *
 * 표준 모듈 구조를 따르는 예시
 */
class TodoModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TodoModule", { bot, ...options });
    this.todoService = null;
    this.tempData = new Map(); // 임시 데이터 저장용
  }

  /**
   * 🎯 초기화 (필수 구현)
   */
  async onInitialize() {
    // 서비스 초기화
    this.todoService = new TodoService(this.db);
    await this.todoService.initialize();

    logger.module("TodoModule", "TodoService 초기화 완료");
  }

  /**
   * 🎯 액션 설정 (필수 구현)
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,

      // 할일 관련
      list: this.showTodoList,
      add: this.startAddTodo,
      "add:confirm": this.confirmAddTodo,
      complete: this.completeTodo,
      delete: this.deleteTodo,
      "delete:confirm": this.confirmDeleteTodo,

      // 통계
      stats: this.showStats,
    });
  }

  /**
   * 💬 메시지 처리 가능 여부
   */
  async canHandleMessage(msg) {
    const userId = getUserId(msg);
    // 할일 추가 중인 사용자의 메시지만 처리
    return this.tempData.has(`add_${userId}`);
  }

  /**
   * 💬 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg);
    const tempKey = `add_${userId}`;

    if (this.tempData.has(tempKey)) {
      // 할일 내용 저장
      this.tempData.set(tempKey, {
        userId,
        content: msg.text,
        createdAt: TimeHelper.now(),
      });

      // 확인 메시지
      await bot.telegram.sendMessage(
        msg.chat.id,
        `📝 할일을 추가하시겠습니까?\n\n"${msg.text}"`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ 추가", callback_data: "todo:add:confirm" },
                { text: "❌ 취소", callback_data: "todo:menu" },
              ],
            ],
          },
        }
      );
    }
  }

  // ===== 🎯 액션 핸들러들 (표준 매개변수 준수) =====

  /**
   * 📋 메뉴 표시
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const userId = getUserId(callbackQuery);

      // 할일 개수 조회
      const stats = await this.todoService.getUserStats(userId);

      const menuText = `
📝 **할일 관리**

${userName}님의 할일 현황:
• 전체: ${stats.total}개
• 완료: ${stats.completed}개
• 대기: ${stats.pending}개

무엇을 하시겠습니까?
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 할일 목록", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [{ text: "📊 통계 보기", callback_data: "todo:stats" }],
          [{ text: "🏠 메인 메뉴", callback_data: "main" }],
        ],
      };

      await callbackQuery.editMessageText(menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 📋 할일 목록 표시
   */
  async showTodoList(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const todos = await this.todoService.getUserTodos(userId);

      if (todos.length === 0) {
        const emptyText = `
📝 **할일 목록**

아직 등록된 할일이 없습니다.
새로운 할일을 추가해보세요! 🎯
`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 할일 추가", callback_data: "todo:add" }],
            [{ text: "⬅️ 뒤로가기", callback_data: "todo:menu" }],
          ],
        };

        await callbackQuery.editMessageText(emptyText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        return;
      }

      // 할일 목록 생성
      let listText = "📝 **할일 목록**\n\n";
      const buttons = [];

      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⬜";
        const time = TimeHelper.format(todo.createdAt, "simple");

        listText += `${status} ${index + 1}. ${todo.content}\n`;
        listText += `   _${time}_\n\n`;

        // 버튼 생성
        if (!todo.completed) {
          buttons.push([
            {
              text: `✅ ${index + 1}번 완료`,
              callback_data: `todo:complete:${todo._id}`,
            },
            {
              text: `🗑️ ${index + 1}번 삭제`,
              callback_data: `todo:delete:${todo._id}`,
            },
          ]);
        }
      });

      // 네비게이션 버튼
      buttons.push([
        { text: "➕ 할일 추가", callback_data: "todo:add" },
        { text: "⬅️ 뒤로가기", callback_data: "todo:menu" },
      ]);

      await callbackQuery.editMessageText(listText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * ➕ 할일 추가 시작
   */
  async startAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);

      // 임시 데이터에 상태 저장
      this.tempData.set(`add_${userId}`, { state: "waiting" });

      const text = `
➕ **할일 추가**

추가할 할일을 입력해주세요.
(예: 보고서 작성하기, 회의 준비하기)

💡 Tip: 구체적으로 작성하면 관리하기 쉬워요!
`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      };

      await callbackQuery.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * ✅ 할일 추가 확인
   */
  async confirmAddTodo(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const tempKey = `add_${userId}`;
      const tempData = this.tempData.get(tempKey);

      if (!tempData || !tempData.content) {
        await callbackQuery.answerCbQuery("❌ 추가할 할일이 없습니다.", {
          show_alert: true,
        });
        return;
      }

      // 할일 추가
      await this.todoService.createTodo(userId, tempData.content);

      // 임시 데이터 삭제
      this.tempData.delete(tempKey);

      // 성공 메시지
      await callbackQuery.answerCbQuery("✅ 할일이 추가되었습니다!");

      // 목록으로 이동
      await this.showTodoList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * ✅ 할일 완료
   */
  async completeTodo(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const todoId = params.split(":")[0];

      if (!todoId) {
        await callbackQuery.answerCbQuery("❌ 잘못된 요청입니다.", {
          show_alert: true,
        });
        return;
      }

      // 할일 완료 처리
      await this.todoService.completeTodo(todoId);

      await callbackQuery.answerCbQuery("✅ 완료되었습니다!");

      // 목록 새로고침
      await this.showTodoList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 🗑️ 할일 삭제
   */
  async deleteTodo(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const todoId = params.split(":")[0];

      if (!todoId) {
        await callbackQuery.answerCbQuery("❌ 잘못된 요청입니다.", {
          show_alert: true,
        });
        return;
      }

      // 삭제 확인 메시지
      const todo = await this.todoService.getTodoById(todoId);

      if (!todo) {
        await callbackQuery.answerCbQuery("❌ 할일을 찾을 수 없습니다.", {
          show_alert: true,
        });
        return;
      }

      const confirmText = `
🗑️ **할일 삭제**

정말 이 할일을 삭제하시겠습니까?

"${todo.content}"

⚠️ 삭제된 할일은 복구할 수 없습니다.
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🗑️ 삭제", callback_data: `todo:delete:confirm:${todoId}` },
            { text: "❌ 취소", callback_data: "todo:list" },
          ],
        ],
      };

      await callbackQuery.editMessageText(confirmText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 🗑️ 할일 삭제 확인
   */
  async confirmDeleteTodo(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const todoId = params.split(":")[1];

      if (!todoId) {
        await callbackQuery.answerCbQuery("❌ 잘못된 요청입니다.", {
          show_alert: true,
        });
        return;
      }

      // 할일 삭제
      await this.todoService.deleteTodo(todoId);

      await callbackQuery.answerCbQuery("🗑️ 삭제되었습니다!");

      // 목록으로 이동
      await this.showTodoList(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const stats = await this.todoService.getUserDetailedStats(userId);

      const statsText = `
📊 **할일 통계**

**전체 현황**
• 총 할일: ${stats.total}개
• 완료: ${stats.completed}개 (${stats.completionRate}%)
• 대기: ${stats.pending}개

**이번 주 활동**
• 추가: ${stats.weeklyAdded}개
• 완료: ${stats.weeklyCompleted}개

**평균 완료 시간**
• ${stats.averageCompletionTime}

💪 ${stats.motivationalMessage}
`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "⬅️ 뒤로가기", callback_data: "todo:menu" }],
        ],
      };

      await callbackQuery.editMessageText(statsText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 🧹 정리 작업
   */
  async onCleanup() {
    // 임시 데이터 정리
    this.tempData.clear();

    // 서비스 정리
    if (this.todoService) {
      await this.todoService.cleanup();
    }
  }
}

module.exports = TodoModule;
