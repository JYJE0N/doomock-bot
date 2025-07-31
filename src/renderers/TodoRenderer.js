// src/renderers/TodoRenderer.js - config 참조 오류 최종 수정 버전
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "todo";
    this.emojis = {
      todo: "📋",
      completed: "✅",
      pending: "⏳",
      add: "➕",
      delete: "🗑️",
      search: "🔍",
      stats: "📊",
      reminder: "🔔",
      time: "⏰",
      help: "❓",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    };
  }

  async render(result, ctx) {
    const { type, data } = result;
    try {
      switch (type) {
        case "list":
          return await this.renderTodoListResponse(data, ctx);
        case "stats":
          return await this.renderStatsResponse(data, ctx);
        case "input_prompt":
          return await this.renderInputPromptResponse(data, ctx);
        case "error":
          return await this.renderErrorResponse(data, ctx);
        default:
          logger.warn(`알 수 없는 할일 렌더링 타입: ${type}`);
          return await this.renderErrorResponse(
            { message: "지원하지 않는 기능입니다." },
            ctx
          );
      }
    } catch (error) {
      logger.error("TodoRenderer 렌더링 오류:", error);
      await this.renderErrorResponse(
        { message: "화면을 표시하는 중 오류가 발생했습니다." },
        ctx
      );
    }
  }

  // --- 렌더링 응답(Response) 메소드들 ---

  async renderTodoListResponse(data, ctx) {
    const rendered = this.createTodoListContent(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderStatsResponse(data, ctx) {
    const rendered = this.createStatsContent(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderInputPromptResponse(data, ctx) {
    const rendered = this.createInputPromptContent(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderErrorResponse(data, ctx) {
    const rendered = this.createErrorContent(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  // --- UI 콘텐츠(Content) 생성 메소드들 ---

  createTodoListContent(data) {
    // ⭐️ 수정: data 객체에서 maxTodosPerPage를 직접 구조 분해 할당으로 가져옵니다.
    const { userName, todos, stats, page = 1, maxTodosPerPage = 8 } = data;
    let text = `${this.emojis.todo} *할일 관리*\n\n`;
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n\n`;

    if (stats.total > 0) {
      text += `📊 *현재 상황*: 미완료 ${stats.pending}개 / 완료 ${stats.completed}개\n`;
      text += `📈 *진행률*: ${this.createProgressBar(
        stats.completed,
        stats.total
      )}\n\n`;
    }

    if (todos.length === 0) {
      text += `${this.emojis.pending} 아직 할일이 없습니다\\. 새로운 할일을 추가해보세요\\!`;
    } else {
      // ⭐️ 수정: this.config.maxTodosPerPage 대신 지역 변수 maxTodosPerPage를 사용합니다.
      const itemsPerPage = maxTodosPerPage;
      const totalPages = Math.ceil(todos.length / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const pageTodos = todos.slice(startIndex, startIndex + itemsPerPage);

      text += `📋 *할일 목록* \\(${page}/${totalPages} 페이지\\)\n`;
      pageTodos.forEach((todo) => {
        const status = todo.completed ? "✅" : "🔘";
        const priorityIcon = this.getPriorityIcon(todo.priority);
        const todoText = todo.completed
          ? `~${this.escapeMarkdownV2(todo.text)}~`
          : this.escapeMarkdownV2(todo.text);
        text += `${status} ${priorityIcon} ${todoText}\n`;
      });
    }

    // ⭐️ 수정: 키보드 생성 함수에도 maxTodosPerPage를 전달합니다.
    return {
      text,
      keyboard: this.createMainKeyboard(todos, page, maxTodosPerPage),
    };
  }

  createStatsContent(data) {
    const { stats } = data;
    let text = `${this.emojis.stats} *할일 통계*\n\n`;
    text += `📈 *전체 현황*\n`;
    text += `▸ 총 할일: ${stats.total}개\n`;
    text += `▸ 완료: ${stats.completed}개 \\(${stats.completionRate}%\\)\n`;
    text += `▸ 미완료: ${stats.pending}개\n`;
    return { text, keyboard: this.createBackKeyboard() };
  }

  createInputPromptContent(data) {
    let text = `${this.emojis.add} *새 할일 추가*\n\n`;
    text += `${this.escapeMarkdownV2(data.message)}`;
    return {
      text,
      keyboard: {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:menu" }]],
      },
    };
  }

  createErrorContent(data) {
    const message = data?.message || "알 수 없는 오류가 발생했습니다.";
    return {
      text: `${this.emojis.error} *오류 발생*\n\n${this.escapeMarkdownV2(
        message
      )}`,
      keyboard: this.createBackKeyboard(),
    };
  }

  // --- 키보드 및 헬퍼 메소드들 ---

  // ⭐️ 수정: maxTodosPerPage를 파라미터로 받도록 변경
  createMainKeyboard(todos, currentPage, maxTodosPerPage = 8) {
    const keyboard = [];
    const itemsPerPage = maxTodosPerPage;
    const totalPages = Math.ceil(todos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageTodos = todos.slice(startIndex, startIndex + itemsPerPage);

    pageTodos.forEach((todo) => {
      const toggleIcon = todo.completed ? "↩️" : "✅";
      const buttonText = `${toggleIcon} ${this.truncateText(todo.text, 20)}`;
      keyboard.push([
        { text: buttonText, callback_data: `todo:toggle:${todo.id}` },
        { text: "🗑️", callback_data: `todo:delete:${todo.id}` },
      ]);
    });

    if (totalPages > 1) {
      const paginationRow = [];
      if (currentPage > 1)
        paginationRow.push({
          text: "◀️ 이전",
          callback_data: `todo:page:${currentPage - 1}`,
        });
      paginationRow.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "todo:list",
      });
      if (currentPage < totalPages)
        paginationRow.push({
          text: "다음 ▶️",
          callback_data: `todo:page:${currentPage + 1}`,
        });
      keyboard.push(paginationRow);
    }

    keyboard.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "📊 통계", callback_data: "todo:stats" },
    ]);
    keyboard.push([{ text: "🔙 메인 메뉴", callback_data: "system:menu" }]);

    return { inline_keyboard: keyboard };
  }

  createBackKeyboard() {
    return {
      inline_keyboard: [[{ text: "🔙 할일 메뉴", callback_data: "todo:menu" }]],
    };
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || "";
    return text.substring(0, maxLength - 3) + "...";
  }

  getPriorityIcon(priority) {
    if (priority >= 4) return "🔴";
    if (priority === 3) return "🟡";
    return "🟢";
  }

  createProgressBar(completed, total, length = 10) {
    if (total === 0) return "▱".repeat(length) + " 0%";
    const percentage = Math.min(100, Math.max(0, (completed / total) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return (
      `▰`.repeat(filled) + `▱`.repeat(empty) + ` ${Math.round(percentage)}%`
    );
  }
}

module.exports = TodoRenderer;
