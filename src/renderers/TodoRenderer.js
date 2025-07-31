// src/renderers/TodoRenderer.js - 완성도 높은 할일 관리 UI 렌더러 (오류 수정 버전)

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
        case "filtered_list":
          return await this.renderFilteredListResponse(data, ctx);
        case "add_select":
          return await this.renderAddSelectResponse(data, ctx);
        case "add_success":
          return await this.renderAddSuccessResponse(data, ctx);
        case "input_prompt":
          return await this.renderInputPromptResponse(data, ctx);
        case "stats":
          return await this.renderStatsResponse(data, ctx);
        case "help":
          return await this.renderHelpResponse(data, ctx);
        case "search_results":
          return await this.renderSearchResultsResponse(data, ctx);
        case "error":
          return await this.renderErrorResponse(data, ctx);
        default:
          logger.warn(`알 수 없는 할일 렌더링 타입: ${type}`);
          await this.renderErrorResponse(
            { message: "지원하지 않는 기능입니다." },
            ctx
          );
      }
    } catch (error) {
      logger.error("TodoRenderer 오류:", error);
      await this.renderErrorResponse({ message: error.message }, ctx);
    }
  }

  renderTodoList(data) {
    const { userName, todos, stats, enableReminders, enableSearch } = data;
    let text = `${this.emojis.todo} *할일 관리*\n\n`;
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n\n`;

    if (stats.total > 0) {
      text += `📊 *현재 상황*\n`;
      text += `• 전체 할일: ${this.escapeMarkdownV2(String(stats.total))}개\n`;
      text += `• 완료: ${this.escapeMarkdownV2(String(stats.completed))}개\n`;
      text += `• 남은 할일: ${this.escapeMarkdownV2(
        String(stats.pending)
      )}개\n`;
      text += `• 완료율: ${this.escapeMarkdownV2(
        String(stats.completionRate)
      )}%\n\n`;
      text += `📈 *진행률*\n`;
      text += this.createProgressBar(stats.completed, stats.total);
      text += `\n\n`;
    }

    if (todos.length === 0) {
      text += `${this.emojis.pending} 아직 할일이 없습니다\\.\n새로운 할일을 추가해보세요\\!`;
    } else {
      text += `${this.emojis.todo} *할일 목록*\n`;
      const pendingTodos = todos.filter((t) => !t.completed);
      const completedTodos = todos.filter((t) => t.completed);

      if (pendingTodos.length > 0) {
        text += `\n📋 *미완료* \\(${pendingTodos.length}개\\)\n`;
        pendingTodos.slice(0, 5).forEach((todo, index) => {
          const reminderIcon = todo.hasReminder ? " 🔔" : "";
          // ✅ 수정: displayText -> text
          text += `${index + 1}\\. ${this.escapeMarkdownV2(
            todo.text
          )}${reminderIcon}\n`;
        });
        if (pendingTodos.length > 5) {
          text += `\\.\\.\\. 외 ${pendingTodos.length - 5}개\n`;
        }
      }

      if (completedTodos.length > 0) {
        text += `\n✅ *완료* \\(${completedTodos.length}개\\)\n`;
        completedTodos.slice(0, 3).forEach((todo, index) => {
          // ✅ 수정: displayText -> text
          text += `${index + 1}\\. ~${this.escapeMarkdownV2(todo.text)}~\n`;
        });
        if (completedTodos.length > 3) {
          text += `\\.\\.\\. 외 ${completedTodos.length - 3}개\n`;
        }
      }
    }
    return {
      text,
      keyboard: this.createMainKeyboard(todos, enableReminders, enableSearch),
    };
  }

  renderFilteredList(data) {
    const { filter, filterLabel, todos } = data;
    let text = `${this.emojis.search} *${this.escapeMarkdownV2(
      filterLabel
    )}*\n\n`;
    if (todos.length === 0) {
      text += `${this.emojis.warning} 해당하는 할일이 없습니다\\.`;
    } else {
      text += `📊 총 ${this.escapeMarkdownV2(String(todos.length))}개\n\n`;
      todos.slice(0, 10).forEach((todo, index) => {
        const status = todo.completed ? "✅" : "📋";
        const reminderIcon = todo.hasReminder ? " 🔔" : "";
        // ✅ 수정: displayText -> text
        const displayText = todo.completed ? `~${todo.text}~` : todo.text;
        text += `${index + 1}\\. ${status} ${this.escapeMarkdownV2(
          displayText
        )}${reminderIcon}\n`;
      });
      if (todos.length > 10) {
        text += `\n\\.\\.\\. 외 ${todos.length - 10}개`;
      }
    }
    return { text, keyboard: this.createFilteredKeyboard() };
  }

  renderAddSuccess(data) {
    const { todo, withReminder, reminderTime } = data;
    let text = `${this.emojis.success} *할일이 추가되었습니다\\!*\n\n`;
    // ✅ 수정: displayText -> text
    text += `📋 "${this.escapeMarkdownV2(todo.text)}"\n\n`;
    if (withReminder && reminderTime) {
      text += `${this.emojis.reminder} *리마인더 설정 완료*\n`;
      text += `🕐 ${this.escapeMarkdownV2(reminderTime)}\n`;
      text += `📱 설정된 시간에 텔레그램 알림을 받게 됩니다\\!\n\n`;
    }
    text += `계속 할일을 관리하시겠어요\\?`;
    return { text, keyboard: this.createSuccessKeyboard() };
  }

  createMainKeyboard(todos, enableReminders, enableSearch) {
    const keyboard = [];
    const firstRow = [{ text: "➕ 할일 추가", callback_data: "todo:add" }];
    if (enableSearch) {
      firstRow.push({ text: "🔍 검색", callback_data: "todo:search" });
    }
    keyboard.push(firstRow);

    if (todos.length > 0) {
      keyboard.push([
        { text: "✅ 완료된 할일", callback_data: "todo:filter:completed" },
        { text: "⏳ 미완료 할일", callback_data: "todo:filter:pending" },
      ]);
      keyboard.push([
        { text: "📊 통계", callback_data: "todo:stats" },
        { text: "🔄 새로고침", callback_data: "todo:list" },
      ]);
      const actionTodos = todos.slice(0, 5);
      actionTodos.forEach((todo) => {
        const toggleIcon = todo.completed ? "↩️" : "✅";
        // ✅ 수정: displayText -> text
        const buttonText = `${toggleIcon} ${todo.text.substring(0, 15)}${
          todo.text.length > 15 ? "..." : ""
        }`;
        keyboard.push([
          { text: buttonText, callback_data: `todo:toggle:${todo.id}` },
          { text: "🗑️", callback_data: `todo:delete:${todo.id}` },
        ]);
      });
    }

    keyboard.push([
      { text: "❓ 도움말", callback_data: "todo:help" },
      { text: "🏠 메인 메뉴", callback_data: "system:menu" },
    ]);
    return { inline_keyboard: keyboard };
  }

  // ... (다른 모든 메서드는 그대로 유지)

  renderAddSelect(data) {
    const { enableReminders, quickReminderOptions } = data;
    let text = `${this.emojis.add} *새 할일 추가*\n\n`;
    text += `어떤 방식으로 추가하시겠어요\\?\n\n`;
    if (enableReminders) {
      text += `🔔 *리마인더 기능 활성화\\!*\n`;
      text += `시간을 설정하면 텔레그램으로 알림을 받을 수 있습니다\\.\n\n`;
      text += `⏰ *빠른 리마인더 시간*\n`;
      quickReminderOptions.forEach((option) => {
        text += `• ${this.escapeMarkdownV2(
          option.label
        )} \\(${this.escapeMarkdownV2(option.time)}\\)\n`;
      });
    } else {
      text += `💡 간단하게 할일을 추가할 수 있습니다\\.`;
    }
    return { text, keyboard: this.createAddSelectKeyboard(enableReminders) };
  }

  renderInputPrompt(data) {
    const { message, placeholder, examples, showReminderNote } = data;
    let text = `${this.emojis.add} *입력 대기*\n\n`;
    text += `${this.escapeMarkdownV2(message)}\n\n`;
    if (placeholder) {
      text += `💡 *예시*: ${this.escapeMarkdownV2(placeholder)}\n\n`;
    }
    if (examples && examples.length > 0) {
      text += `📝 *입력 예시*\n`;
      examples.forEach((example) => {
        text += `• ${this.escapeMarkdownV2(example)}\n`;
      });
      text += `\n`;
    }
    if (showReminderNote) {
      text += `🔔 *리마인더 안내*\n`;
      text += `할일 입력 후 알림받을 시간을 설정할 수 있습니다\\.\n\n`;
    }
    text += `메시지를 입력해주세요\\:`;
    return { text, keyboard: this.createInputKeyboard() };
  }

  renderStats(data) {
    const { stats } = data;
    let text = `${this.emojis.stats} *할일 통계*\n\n`;
    text += `📋 *전체 현황*\n`;
    text += `• 총 할일: ${this.escapeMarkdownV2(String(stats.total))}개\n`;
    text += `• 완료: ${this.escapeMarkdownV2(String(stats.completed))}개\n`;
    text += `• 미완료: ${this.escapeMarkdownV2(String(stats.pending))}개\n`;
    text += `• 완료율: ${this.escapeMarkdownV2(
      String(stats.completionRate)
    )}%\n\n`;
    text += `📊 *완료 진행률*\n`;
    text += this.createProgressBar(stats.completed, stats.total);
    text += `\n\n`;
    if (stats.recent) {
      text += `📅 *최근 7일 활동*\n`;
      text += `• 추가된 할일: ${this.escapeMarkdownV2(
        String(stats.recent.added)
      )}개\n`;
      text += `• 완료한 할일: ${this.escapeMarkdownV2(
        String(stats.recent.completed)
      )}개\n`;
      text += `• 생산성: ${this.escapeMarkdownV2(
        String(stats.recent.productivity)
      )}%\n\n`;
    }
    if (stats.averagePerDay) {
      text += `📈 *평균 정보*\n`;
      text += `• 일일 평균: ${this.escapeMarkdownV2(
        String(stats.averagePerDay)
      )}개\n\n`;
    }
    if (stats.completionRate >= 80) {
      text += `🎉 *훌륭합니다\\!* 완료율이 매우 높네요\\!`;
    } else if (stats.completionRate >= 50) {
      text += `👍 *좋은 진전입니다\\!* 조금만 더 화이팅\\!`;
    } else if (stats.total > 0) {
      text += `💪 *시작이 반입니다\\!* 하나씩 완료해나가세요\\!`;
    }
    return { text, keyboard: this.createStatsKeyboard() };
  }

  renderHelp(data) {
    const { features, reminderFeatures, commands } = data;
    let text = `${this.emojis.help} *할일 관리 도움말*\n\n`;
    text += `🎯 *주요 기능*\n`;
    features.forEach((feature) => {
      text += `• ${this.escapeMarkdownV2(feature)}\n`;
    });
    text += `\n`;
    if (reminderFeatures && reminderFeatures.length > 0) {
      text += `🔔 *리마인더 기능*\n`;
      reminderFeatures.forEach((feature) => {
        text += `• ${this.escapeMarkdownV2(feature)}\n`;
      });
      text += `\n`;
    }
    text += `💡 *사용 팁*\n`;
    text += `• 간단명료하게 할일을 작성하세요\n`;
    text += `• 중요한 할일에는 리마인더를 설정하세요\n`;
    text += `• 정기적으로 완료된 할일을 정리하세요\n`;
    text += `• 통계를 확인해 생산성을 높이세요\n\n`;
    text += `🔄 *명령어*\n`;
    commands.forEach((command) => {
      text += `• ${this.escapeMarkdownV2(command)}\n`;
    });
    return { text, keyboard: this.createHelpKeyboard() };
  }

  renderSearchResults(data) {
    const { keyword, results } = data;
    let text = `${this.emojis.search} *검색 결과*\n\n`;
    text += `키워드: "${this.escapeMarkdownV2(keyword)}"\n`;
    text += `결과: ${this.escapeMarkdownV2(String(results.length))}개\n\n`;
    if (results.length === 0) {
      text += `${this.emojis.warning} 검색 결과가 없습니다\\.`;
    } else {
      results.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "📋";
        const reminderIcon = todo.hasReminder ? " 🔔" : "";
        text += `${index + 1}\\. ${status} ${this.escapeMarkdownV2(
          todo.text
        )}${reminderIcon}\n`;
      });
    }
    return { text, keyboard: this.createSearchResultsKeyboard() };
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

  createAddSelectKeyboard(enableReminders) {
    const keyboard = [];
    if (enableReminders) {
      keyboard.push(
        [
          { text: "📝 간단 추가", callback_data: "todo:add:simple" },
          { text: "🔔 리마인더 추가", callback_data: "todo:add:reminder" },
        ],
        [
          { text: "⏰ 30분 후", callback_data: "todo:reminder:quick:30m" },
          { text: "🕐 1시간 후", callback_data: "todo:reminder:quick:1h" },
        ],
        [
          { text: "🍽️ 점심시간", callback_data: "todo:reminder:quick:lunch" },
          { text: "🌆 저녁시간", callback_data: "todo:reminder:quick:evening" },
        ]
      );
    } else {
      keyboard.push([
        { text: "📝 할일 추가", callback_data: "todo:add:simple" },
      ]);
    }
    keyboard.push([{ text: "◀️ 뒤로", callback_data: "todo:list" }]);
    return { inline_keyboard: keyboard };
  }

  createFilteredKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📋 전체 목록", callback_data: "todo:list" },
          { text: "🔄 새로고침", callback_data: "todo:list" },
        ],
        [{ text: "◀️ 뒤로", callback_data: "todo:list" }],
      ],
    };
  }

  createSuccessKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "➕ 또 추가", callback_data: "todo:add" },
          { text: "📋 목록 보기", callback_data: "todo:list" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  createInputKeyboard() {
    return {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "todo:list" }]],
    };
  }

  createStatsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📋 목록 보기", callback_data: "todo:list" },
          { text: "🔄 새로고침", callback_data: "todo:stats" },
        ],
        [{ text: "◀️ 뒤로", callback_data: "todo:list" }],
      ],
    };
  }

  createHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📋 목록 보기", callback_data: "todo:list" },
          { text: "➕ 할일 추가", callback_data: "todo:add" },
        ],
        [{ text: "◀️ 뒤로", callback_data: "todo:list" }],
      ],
    };
  }

  createSearchResultsKeyboard() {
    return {
      inline_keyboard: [[{ text: "◀️ 뒤로", callback_data: "todo:list" }]],
    };
  }

  createBackKeyboard() {
    return {
      inline_keyboard: [[{ text: "◀️ 뒤로", callback_data: "todo:list" }]],
    };
  }

  async renderTodoListResponse(data, ctx) {
    const rendered = this.renderTodoList(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderFilteredListResponse(data, ctx) {
    const rendered = this.renderFilteredList(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderAddSelectResponse(data, ctx) {
    const rendered = this.renderAddSelect(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderAddSuccessResponse(data, ctx) {
    const rendered = this.renderAddSuccess(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderInputPromptResponse(data, ctx) {
    const rendered = this.renderInputPrompt(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderStatsResponse(data, ctx) {
    const rendered = this.renderStats(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderHelpResponse(data, ctx) {
    const rendered = this.renderHelp(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderSearchResultsResponse(data, ctx) {
    const rendered = this.renderSearchResults(data);
    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  async renderErrorResponse(data, ctx) {
    const rendered = this.createErrorContent(data);
    const chatId = ctx?.callbackQuery?.message?.chat?.id || ctx?.chat?.id;
    const messageId = ctx?.callbackQuery?.message?.message_id;
    if (!chatId) {
      logger.error("에러 응답을 보낼 chatId를 찾을 수 없습니다.", { ctx });
      return;
    }
    await this.sendMessage(chatId, rendered.text, rendered.keyboard, messageId);
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
