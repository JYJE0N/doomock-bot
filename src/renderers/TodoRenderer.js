// src/renderers/TodoRenderer.js - 할일 관리 전용 렌더러
const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");

/**
 * 📋 TodoRenderer - 할일 관리 UI 렌더링 전담
 *
 * ✅ 담당 기능:
 * - 할일 목록 렌더링
 * - 할일 추가/수정/삭제 화면
 * - 할일 완료 표시
 * - 할일 통계 화면
 * - 할일 필터링 및 정렬
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "todo";
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
      case "list":
        return await this.renderTodoList(data, ctx);

      case "add":
        return await this.renderAddTodo(data, ctx);

      case "edit":
        return await this.renderEditTodo(data, ctx);

      case "complete":
        return await this.renderCompleteTodo(data, ctx);

      case "delete":
        return await this.renderDeleteTodo(data, ctx);

      case "stats":
        return await this.renderTodoStats(data, ctx);

      case "filter":
        return await this.renderFilterOptions(data, ctx);

      case "help":
        return await this.renderHelp(data, ctx);

      case "input":
        return await this.renderInputPrompt(data, ctx);

      default:
        return await this.renderError(
          "지원하지 않는 할일 관리 기능입니다.",
          ctx
        );
    }
  }

  /**
   * 📋 할일 목록 렌더링
   */
  async renderTodoList(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "📋 *할일 관리*\n\n";

    // 두목봇 환영 인사
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "todoWelcome",
      userName
    );
    text += `${this.escapeMarkdownV2(welcomeMessage)}\n\n`;

    const todos = data?.todos || [];

    if (todos.length === 0) {
      text += "할일이 없습니다\\. 새 할일을 추가해보세요\\!\n\n";
      text += "✨ *할일 관리 팁*:\n";
      text += "• 작은 단위로 나누어 등록하세요\n";
      text += "• 우선순위를 설정해보세요\n";
      text += "• 정기적으로 정리하세요\n";
    } else {
      // 통계 정보
      const completedCount = todos.filter((todo) => todo.completed).length;
      const totalCount = todos.length;
      const progressPercent = Math.round((completedCount / totalCount) * 100);

      text += `📊 *진행 상황*: ${completedCount}/${totalCount} \\(${progressPercent}%\\)\n\n`;

      // 할일 목록 표시 (최대 10개)
      const displayTodos = todos.slice(0, 10);

      displayTodos.forEach((todo, index) => {
        const statusIcon = todo.completed ? "✅" : "⭕";
        const priority = this.getPriorityIcon(todo.priority);
        let todoText = this.escapeMarkdownV2(todo.title);

        // 완료된 할일은 취소선 적용
        if (todo.completed) {
          todoText = `~${todoText}~`;
        }

        text += `${statusIcon} ${priority} ${todoText}`;

        // 마감일이 있는 경우 표시
        if (todo.dueDate) {
          const dueDate = new Date(todo.dueDate);
          const isOverdue = dueDate < new Date() && !todo.completed;
          const dueDateStr = dueDate.toLocaleDateString("ko-KR");

          if (isOverdue) {
            text += ` ⚠️ *${this.escapeMarkdownV2(dueDateStr)}*`;
          } else {
            text += ` 📅 ${this.escapeMarkdownV2(dueDateStr)}`;
          }
        }

        text += "\n";
      });

      // 더 많은 할일이 있는 경우
      if (todos.length > 10) {
        text += `\n\\.\\.\\. 외 ${todos.length - 10}개 더 있습니다\n`;
      }
    }

    // 버튼 구성
    const keyboard = {
      inline_keyboard: [],
    };

    // 첫 번째 줄: 기본 액션
    keyboard.inline_keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "✅ 완료", callback_data: "todo:complete" },
      { text: "✏️ 수정", callback_data: "todo:edit" },
    ]);

    // 두 번째 줄: 관리 액션
    keyboard.inline_keyboard.push([
      { text: "🗑️ 삭제", callback_data: "todo:delete" },
      { text: "🔍 필터", callback_data: "todo:filter" },
      { text: "📊 통계", callback_data: "todo:stats" },
    ]);

    // 세 번째 줄: 네비게이션
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "todo:help" },
      { text: "🔙 메인 메뉴", callback_data: "system:menu" },
    ]);

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ➕ 할일 추가 화면 렌더링
   */
  async renderAddTodo(data, ctx) {
    let text = "➕ *새 할일 추가*\n\n";
    text += "새로운 할일을 추가하겠습니다\\.\n";
    text += "아래 형식으로 입력해주세요\\:\n\n";

    text += "📝 *입력 형식*:\n";
    text += "`할일 제목`\n";
    text += "또는\n";
    text += "`할일 제목 | 우선순위 | 마감일`\n\n";

    text += "📋 *예시*:\n";
    text += "• `회의 자료 준비`\n";
    text += "• `보고서 작성 | 높음 | 2025\\-07\\-30`\n";
    text += "• `코드 리뷰 | 보통 | 내일`\n\n";

    text += "🏷️ *우선순위*: 높음, 보통, 낮음\n";
    text += "📅 *마감일*: YYYY\\-MM\\-DD 또는 '오늘', '내일', '다음주' 등\n\n";

    text += "할일을 입력해주세요\\:";

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ✅ 할일 완료 화면 렌더링
   */
  async renderCompleteTodo(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    if (data?.completedTodo) {
      // 완료 성공
      const todo = data.completedTodo;

      let text = "✅ *할일 완료\\!*\n\n";
      text += `${this.escapeMarkdownV2(todo.title)}\n\n`;

      const completeMessage = DoomockMessageGenerator.getContextualMessage(
        "todoComplete",
        userName
      );
      text += `💬 ${this.escapeMarkdownV2(completeMessage)}\n\n`;

      // 완료 통계
      if (data.stats) {
        text += `📊 *오늘 완료*: ${data.stats.todayCompleted}개\n`;
        text += `🏆 *총 완료*: ${data.stats.totalCompleted}개`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록으로", callback_data: "todo:menu" },
            { text: "➕ 새 할일", callback_data: "todo:add" },
          ],
        ],
      };

      await this.sendMessage(
        ctx.callbackQuery.message.chat.id,
        text,
        keyboard,
        ctx.callbackQuery.message.message_id
      );
    } else {
      // 완료할 할일 선택
      const incompleteTodos = data?.incompleteTodos || [];

      let text = "✅ *완료할 할일 선택*\n\n";

      if (incompleteTodos.length === 0) {
        text += "완료되지 않은 할일이 없습니다\\.\n";
        text += "새로운 할일을 추가해보세요\\!";

        const keyboard = {
          inline_keyboard: [
            [
              { text: "➕ 할일 추가", callback_data: "todo:add" },
              { text: "📋 목록으로", callback_data: "todo:menu" },
            ],
          ],
        };

        await this.sendMessage(
          ctx.callbackQuery.message.chat.id,
          text,
          keyboard,
          ctx.callbackQuery.message.message_id
        );
        return;
      }

      text += "완료할 할일을 선택해주세요\\:\n\n";

      // 할일 목록 (최대 8개)
      const displayTodos = incompleteTodos.slice(0, 8);
      const keyboard = { inline_keyboard: [] };

      displayTodos.forEach((todo, index) => {
        const priority = this.getPriorityIcon(todo.priority);
        const todoText =
          todo.title.length > 25
            ? todo.title.substring(0, 25) + "..."
            : todo.title;

        if (index % 2 === 0) {
          keyboard.inline_keyboard.push([
            {
              text: `${priority} ${todoText}`,
              callback_data: `todo:complete:${todo.id}`,
            },
          ]);
        } else {
          const lastRow =
            keyboard.inline_keyboard[keyboard.inline_keyboard.length - 1];
          lastRow.push({
            text: `${priority} ${todoText}`,
            callback_data: `todo:complete:${todo.id}`,
          });
        }
      });

      // 네비게이션 버튼
      keyboard.inline_keyboard.push([
        { text: "📋 목록으로", callback_data: "todo:menu" },
      ]);

      await this.sendMessage(
        ctx.callbackQuery.message.chat.id,
        text,
        keyboard,
        ctx.callbackQuery.message.message_id
      );
    }
  }

  /**
   * 📊 할일 통계 렌더링
   */
  async renderTodoStats(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "📊 *할일 관리 통계*\n\n";

    if (data?.stats) {
      const stats = data.stats;

      text += "📈 *전체 통계*:\n";
      text += `• 총 할일: ${this.escapeMarkdownV2(
        String(stats.totalTodos || 0)
      )}개\n`;
      text += `• 완료된 할일: ${this.escapeMarkdownV2(
        String(stats.completedTodos || 0)
      )}개\n`;
      text += `• 진행 중인 할일: ${this.escapeMarkdownV2(
        String(stats.pendingTodos || 0)
      )}개\n`;
      text += `• 완료율: ${this.escapeMarkdownV2(
        String(stats.completionRate || 0)
      )}%\n\n`;

      text += "📅 *오늘*:\n";
      text += `• 추가된 할일: ${this.escapeMarkdownV2(
        String(stats.todayAdded || 0)
      )}개\n`;
      text += `• 완료된 할일: ${this.escapeMarkdownV2(
        String(stats.todayCompleted || 0)
      )}개\n\n`;

      text += "🏆 *이번 주*:\n";
      text += `• 완료된 할일: ${this.escapeMarkdownV2(
        String(stats.weekCompleted || 0)
      )}개\n`;
      text += `• 평균 완료율: ${this.escapeMarkdownV2(
        String(stats.weekAvgRate || 0)
      )}%\n\n`;

      if (stats.streakDays > 0) {
        text += `🔥 *연속 사용*: ${this.escapeMarkdownV2(
          String(stats.streakDays)
        )}일\n\n`;
      }
    }

    const statsMessage = DoomockMessageGenerator.generateMessage(
      "stats",
      userName
    );
    text += `💬 ${this.escapeMarkdownV2(statsMessage)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 할일 목록", callback_data: "todo:menu" },
          { text: "➕ 새 할일", callback_data: "todo:add" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 🔍 필터 옵션 렌더링
   */
  async renderFilterOptions(data, ctx) {
    let text = "🔍 *할일 필터*\n\n";
    text += "원하는 필터를 선택해주세요\\:\n";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 전체", callback_data: "todo:filter:all" },
          { text: "⭕ 진행중", callback_data: "todo:filter:pending" },
        ],
        [
          { text: "✅ 완료됨", callback_data: "todo:filter:completed" },
          { text: "⚠️ 연체됨", callback_data: "todo:filter:overdue" },
        ],
        [
          { text: "🔴 높은 우선순위", callback_data: "todo:filter:high" },
          { text: "📅 오늘 마감", callback_data: "todo:filter:today" },
        ],
        [{ text: "📋 목록으로", callback_data: "todo:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    let text = "❓ *할일 관리 도움말*\n\n";

    text += "📋 *기본 사용법*:\n";
    text += "• `➕ 추가` \\- 새로운 할일 등록\n";
    text += "• `✅ 완료` \\- 할일 완료 표시\n";
    text += "• `✏️ 수정` \\- 할일 내용 수정\n";
    text += "• `🗑️ 삭제` \\- 할일 삭제\n\n";

    text += "🏷️ *우선순위 설정*:\n";
    text += "• 🔴 높음 \\- 긴급하고 중요한 업무\n";
    text += "• 🟡 보통 \\- 일반적인 업무\n";
    text += "• 🟢 낮음 \\- 여유 있을 때 처리\n\n";

    text += "📅 *마감일 설정*:\n";
    text += "• `2025\\-07\\-30` \\- 구체적인 날짜\n";
    text += "• `오늘`, `내일` \\- 상대적 날짜\n";
    text += "• `다음주`, `다음달` \\- 기간 설정\n\n";

    text += "🔍 *필터 기능*:\n";
    text += "• 상태별 필터링 \\(진행중/완료/연체\\)\n";
    text += "• 우선순위별 정렬\n";
    text += "• 마감일별 정렬\n\n";

    text += "📊 *통계 확인*:\n";
    text += "• 완료율 및 진행 상황\n";
    text += "• 일별/주별 통계\n";
    text += "• 생산성 분석\n\n";

    text += "💡 *효율적인 사용 팁*:\n";
    text += "• 할일을 작은 단위로 분할하세요\n";
    text += "• 우선순위를 명확히 설정하세요\n";
    text += "• 정기적으로 정리하고 업데이트하세요\n";
    text += "• 완료된 할일은 바로 체크하세요";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 할일 목록", callback_data: "todo:menu" },
          { text: "➕ 새 할일", callback_data: "todo:add" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📝 입력 프롬프트 렌더링
   */
  async renderInputPrompt(data, ctx) {
    let text = "";

    switch (data?.inputType) {
      case "add":
        text = "➕ *새 할일 추가*\n\n할일을 입력해주세요\\:";
        break;
      case "edit":
        text = `✏️ *할일 수정*\n\n기존: ${this.escapeMarkdownV2(
          data.currentTitle
        )}\n\n새로운 내용을 입력해주세요\\:`;
        break;
      default:
        text = "📝 내용을 입력해주세요\\:";
    }

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ✏️ 할일 수정 렌더링
   */
  async renderEditTodo(data, ctx) {
    const todos = data?.todos || [];

    let text = "✏️ *수정할 할일 선택*\n\n";

    if (todos.length === 0) {
      text += "수정할 할일이 없습니다\\.\n";
      text += "새로운 할일을 추가해보세요\\!";

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 할일 추가", callback_data: "todo:add" },
            { text: "📋 목록으로", callback_data: "todo:menu" },
          ],
        ],
      };

      await this.sendMessage(
        ctx.callbackQuery.message.chat.id,
        text,
        keyboard,
        ctx.callbackQuery.message.message_id
      );
      return;
    }

    text += "수정할 할일을 선택해주세요\\:\n\n";

    const keyboard = { inline_keyboard: [] };
    const displayTodos = todos.slice(0, 8);

    displayTodos.forEach((todo, index) => {
      const statusIcon = todo.completed ? "✅" : "⭕";
      const priority = this.getPriorityIcon(todo.priority);
      const todoText =
        todo.title.length > 25
          ? todo.title.substring(0, 25) + "..."
          : todo.title;

      keyboard.inline_keyboard.push([
        {
          text: `${statusIcon} ${priority} ${todoText}`,
          callback_data: `todo:edit:${todo.id}`,
        },
      ]);
    });

    keyboard.inline_keyboard.push([
      { text: "📋 목록으로", callback_data: "todo:menu" },
    ]);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 🗑️ 할일 삭제 렌더링
   */
  async renderDeleteTodo(data, ctx) {
    if (data?.deletedTodo) {
      // 삭제 완료
      const todo = data.deletedTodo;

      let text = "🗑️ *할일 삭제 완료*\n\n";
      text += `삭제된 할일: ${this.escapeMarkdownV2(todo.title)}\n\n`;
      text += "할일이 성공적으로 삭제되었습니다\\.";

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 목록으로", callback_data: "todo:menu" },
            { text: "➕ 새 할일", callback_data: "todo:add" },
          ],
        ],
      };

      await this.sendMessage(
        ctx.callbackQuery.message.chat.id,
        text,
        keyboard,
        ctx.callbackQuery.message.message_id
      );
    } else {
      // 삭제할 할일 선택
      const todos = data?.todos || [];

      let text = "🗑️ *삭제할 할일 선택*\n\n";
      text += "⚠️ *주의*: 삭제된 할일은 복구할 수 없습니다\\.\n\n";

      if (todos.length === 0) {
        text += "삭제할 할일이 없습니다\\.";

        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 목록으로", callback_data: "todo:menu" }],
          ],
        };

        await this.sendMessage(
          ctx.callbackQuery.message.chat.id,
          text,
          keyboard,
          ctx.callbackQuery.message.message_id
        );
        return;
      }

      text += "삭제할 할일을 선택해주세요\\:\n\n";

      const keyboard = { inline_keyboard: [] };
      const displayTodos = todos.slice(0, 8);

      displayTodos.forEach((todo, index) => {
        const statusIcon = todo.completed ? "✅" : "⭕";
        const priority = this.getPriorityIcon(todo.priority);
        const todoText =
          todo.title.length > 25
            ? todo.title.substring(0, 25) + "..."
            : todo.title;

        keyboard.inline_keyboard.push([
          {
            text: `${statusIcon} ${priority} ${todoText}`,
            callback_data: `todo:delete:${todo.id}`,
          },
        ]);
      });

      keyboard.inline_keyboard.push([
        { text: "📋 목록으로", callback_data: "todo:menu" },
      ]);

      await this.sendMessage(
        ctx.callbackQuery.message.chat.id,
        text,
        keyboard,
        ctx.callbackQuery.message.message_id
      );
    }
  }

  /**
   * 🏷️ 우선순위 아이콘 반환
   */
  getPriorityIcon(priority) {
    switch (priority) {
      case "high":
      case "높음":
        return "🔴";
      case "medium":
      case "보통":
        return "🟡";
      case "low":
      case "낮음":
        return "🟢";
      default:
        return "⚪";
    }
  }

  /**
   * ❌ 에러 화면 렌더링
   */
  async renderError(message, ctx) {
    let text = "❌ *할일 관리 오류*\n\n";
    text += `${this.escapeMarkdownV2(message)}\n\n`;
    text += "잠시 후 다시 시도해주세요\\.";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "todo:menu" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }
}

module.exports = TodoRenderer;
