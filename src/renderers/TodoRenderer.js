// src/renderers/TodoRenderer.js
const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📋 TodoRenderer - 할일 UI 렌더링 (심플 버전)
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "todo";
  }

  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "list":
        return await this.renderList(data, ctx);
      case "add_prompt":
        return await this.renderAddPrompt(data, ctx);
      case "add_success":
        return await this.renderAddSuccess(data, ctx);
      case "add_error":
        return await this.renderAddError(data, ctx); // 렌더링 함수 추가
      // 👇 누락된 case들 추가
      case "delete_confirm":
        return await this.renderDeleteConfirm(data, ctx);
      case "delete_success":
        await ctx.answerCbQuery("✅ 삭제되었습니다.");
        // 삭제 성공 후 목록을 다시 보여주기 위해 showList를 직접 호출
        return await this.showList(bot, ctx.callbackQuery, "1", moduleManager);
      // 👆 여기까지 추가
      case "delete_confirm":
        return await this.renderDeleteConfirm(data, ctx); // 렌더링 함수 추가
      case "delete_success":
        // 성공 시 간단한 메시지를 보내거나 목록을 새로고침 할 수 있습니다.
        await ctx.answerCbQuery("✅ 삭제되었습니다.");
        return await this.renderList(data.updatedList, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError({ message: "지원하지 않는 기능입니다." }, ctx);
    }
  }

  /**
   * 📋 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const text = `📋 **할일 관리**

효율적인 업무 관리를 시작해보세요!

원하는 기능을 선택해주세요.`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📋 목록 보기", action: "list", params: "1" },
          { text: "➕ 할일 추가", action: "add" }
        ],
        [{ text: "🔙 메인 메뉴", action: "menu" }]
      ],
      this.moduleName
    ); // 메인 메뉴는 system으로

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 목록 렌더링
   */
  async renderList(data, ctx) {
    const { todos, totalCount, totalPages, currentPage } = data;

    let text = `📋 **할일 목록** (${totalCount}개)\n\n`;

    if (todos.length === 0) {
      text += "할일이 없습니다. 새로운 할일을 추가해보세요! ✨";
    } else {
      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⬜";
        const number = (currentPage - 1) * 8 + index + 1;
        text += `${status} **${number}.** ${todo.text}\n`;

        if (todo.description) {
          text += `   _${todo.description}_\n`;
        }

        text += "\n";
      });
    }

    // 키보드 생성
    const buttons = [];

    // 할일 버튼들 (2개씩 배치)
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];

      const todo1 = todos[i];
      const number1 = (currentPage - 1) * 8 + i + 1;
      row.push({
        text: `${todo1.completed ? "✅" : "⬜"} ${number1}`,
        action: "toggle",
        params: todo1._id.toString()
      });
      row.push({
        text: "🗑️",
        action: "delete",
        params: todo1._id.toString()
      });

      // 두 번째 할일 (있으면)
      if (i + 1 < todos.length) {
        const todo2 = todos[i + 1];
        const number2 = (currentPage - 1) * 8 + i + 2;
        row.push({
          text: `${todo2.completed ? "✅" : "⬜"} ${number2}`,
          action: "toggle",
          params: todo2._id.toString()
        });
        row.push({
          text: "🗑️",
          action: "delete",
          params: todo2._id.toString()
        });
      }

      buttons.push(row);
    }

    // 페이지네이션
    if (totalPages > 1) {
      const pageRow = [];

      if (currentPage > 1) {
        pageRow.push({
          text: "⬅️ 이전",
          action: "page",
          params: (currentPage - 1).toString()
        });
      }

      pageRow.push({
        text: `📄 ${currentPage}/${totalPages}`,
        action: "page",
        params: currentPage.toString()
      });

      if (currentPage < totalPages) {
        pageRow.push({
          text: "다음 ➡️",
          action: "page",
          params: (currentPage + 1).toString()
        });
      }

      buttons.push(pageRow);
    }

    // 하단 메뉴
    buttons.push([
      { text: "➕ 추가", action: "add" },
      { text: "🔙 메뉴", action: "menu" }
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ➕ 추가 프롬프트 렌더링
   */
  async renderAddPrompt(data, ctx) {
    const text = `➕ **할일 추가**

새로운 할일의 제목을 입력해주세요.

**입력 규칙:**
• 최대 100자
• 간단명료하게 작성

/cancel 명령으로 취소할 수 있습니다.`;

    const keyboard = this.createInlineKeyboard([[{ text: "❌ 취소", action: "menu" }]], this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ➕ 추가 성공 렌더링
   */
  async renderAddSuccess(data, ctx) {
    const text = `✅ **할일 추가 완료**

${data.message}`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📋 목록 보기", action: "list", params: "1" },
          { text: "➕ 더 추가", action: "add" }
        ],
        [{ text: "🔙 메뉴", action: "menu" }]
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const text = `❌ **오류 발생**

${data.message}

다시 시도해주세요.`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "🔙 메인 메뉴", action: "menu" }
        ]
      ],
      this.moduleName // "system" 대신 this.moduleName 사용
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ➕ 추가 오류 렌더링 (누락된 메서드 추가)
   */
  async renderAddError(data, ctx) {
    const text = `❌ **할일 추가 실패**\n\n${data.message}`;
    const keyboard = this.createInlineKeyboard(
      [[{ text: "🔄 다시 시도", action: "add" }], [{ text: "🔙 메뉴로", action: "menu" }]],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🗑️ 삭제 확인 렌더링
   */
  async renderDeleteConfirm(data, ctx) {
    const { todo } = data;
    const text = `🗑️ **삭제 확인**\n\n정말로 아래 할일을 삭제하시겠습니까?\n\n- "${todo.text}"`;
    const keyboard = this.createInlineKeyboard(
      [
        [
          // 👇 action을 'delete:confirm' 대신 'executeDelete'로 수정
          {
            text: "✅ 예, 삭제합니다.",
            action: "executeDelete",
            params: todo._id.toString()
          },
          { text: "❌ 아니요", action: "list", params: "1" }
        ]
      ],
      this.moduleName
    );
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = TodoRenderer;
