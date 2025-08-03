// src/renderers/TodoRenderer.js - 표준화된 할일 렌더러
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎨 TodoRenderer - 할일 관리 UI 렌더러 (표준화 버전)
 *
 * ✅ BaseRenderer 표준 준수
 * ✅ 모든 버튼 action/params/module 형식 사용
 * ✅ callback_data 직접 사용 제거
 * ✅ 성공 케이스 처리 추가
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);

    // 🔥 필수! BaseRenderer에서 사용
    this.moduleName = "todo";

    // 이모지 및 UI 상수
    this.emojis = {
      // 기본 할일 이모지
      todo: "📋",
      completed: "✅",
      pending: "⏳",
      priority: "🔥",
      add: "➕",
      edit: "✏️",
      delete: "🗑️",

      // 리마인드 관련 이모지
      reminder: "⏰",
      bell: "🔔",
      clock: "🕐",
      calendar: "📅",
      notification: "📳",

      // UI 요소
      back: "⬅️",
      home: "🏠",
      refresh: "🔄",
      search: "🔍",
      filter: "🗂️",

      // 스마트 기능
      report: "📊",
      smart: "🤖",
      stats: "📈",
      cleanup: "🧹"
    };

    // UI 스타일
    this.styles = {
      title: "🔸",
      subtitle: "▫️",
      bullet: "•",
      separator: "─────────────────",
      highlight: "*"
    };

    logger.info("🎨 TodoRenderer 생성됨 (표준화 버전)");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer의 추상 메서드 구현)
   */
  async render(result, ctx) {
    try {
      // result 검증
      if (!result || typeof result !== "object") {
        throw new Error("Invalid result object");
      }

      const { type, action, data } = result;
      const renderAction = action || type;

      logger.debug(`🎨 TodoRenderer.render:`, {
        type,
        action,
        renderAction,
        hasData: !!data
      });

      // 액션별 렌더링
      switch (renderAction) {
        // 기본 액션들
        case "menu":
          await this.renderMenu(data || {}, ctx);
          break;

        case "list":
          await this.renderList(data || {}, ctx);
          break;

        case "add":
          await this.renderAddForm(data || {}, ctx);
          break;

        case "edit":
          await this.renderEditForm(data || {}, ctx);
          break;

        // 성공 케이스들
        case "success":
        case "add_success":
        case "edit_success":
        case "delete_success":
          await this.renderSuccess(data || {}, ctx);
          break;

        // 리마인드 관련
        case "remind":
          await this.renderReminderSetup(data || {}, ctx);
          break;

        case "remind_list":
          await this.renderReminderList(data || {}, ctx);
          break;

        case "remind_set":
          await this.renderReminderSuccess(data || {}, ctx);
          break;

        // 스마트 기능
        case "weekly_report":
          await this.renderWeeklyReport(data || {}, ctx);
          break;

        case "smart_suggestions":
          await this.renderSmartSuggestions(data || {}, ctx);
          break;

        // 입력 요청
        case "input_request":
          await this.renderInputRequest(data || {}, ctx);
          break;

        // 에러
        case "error":
          await this.renderError(data || {}, ctx);
          break;

        default:
          logger.warn(`Unknown render action: ${renderAction}`);
          await this.renderError(
            {
              message: "알 수 없는 요청입니다.",
              action: renderAction
            },
            ctx
          );
      }
    } catch (error) {
      logger.error("TodoRenderer.render error:", error);
      await this.renderFallback(ctx, error);
    }
  }

  /**
   * 🏠 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { stats, enableReminders } = data;

    let text = `${this.emojis.todo} *할일 관리*\n\n`;

    // 통계 정보 표시
    if (stats) {
      text += `${this.styles.title} *현재 상황*\n`;
      text += `${this.styles.bullet} 대기 중: ${stats.pending || 0}개\n`;
      text += `${this.styles.bullet} 완료: ${stats.completed || 0}개\n`;

      if (enableReminders && stats.reminders) {
        text += `${this.styles.bullet} 예정된 알림: ${stats.reminders.active || 0}개\n`;
      }

      text += `\n`;
    }

    // 메뉴 버튼들
    const buttons = [
      [
        { text: `${this.emojis.todo} 할일 목록`, action: "list", params: "1" },
        { text: `${this.emojis.add} 할일 추가`, action: "add" }
      ]
    ];

    if (enableReminders) {
      buttons.push([
        {
          text: `${this.emojis.reminder} 리마인드 목록`,
          action: "remind_list"
        },
        { text: `${this.emojis.report} 주간 리포트`, action: "weekly_report" }
      ]);
    }

    buttons.push([
      { text: `${this.emojis.search} 검색`, action: "search" },
      { text: `${this.emojis.smart} 스마트 정리`, action: "cleanup" }
    ]);

    buttons.push([
      { text: `${this.emojis.back} 메인 메뉴`, action: "menu", module: "main" }
    ]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 📋 할일 목록 렌더링
   */
  async renderList(data, ctx) {
    const { todos, totalCount, currentPage, totalPages, enableReminders } =
      data;

    let text = `${this.emojis.todo} *할일 목록*\n\n`;

    if (!todos || todos.length === 0) {
      text += `${this.styles.bullet} 등록된 할일이 없습니다.\n\n`;
      text += `${this.emojis.add} 새로운 할일을 추가해보세요!`;

      const buttons = [
        [{ text: `${this.emojis.add} 할일 추가`, action: "add" }],
        [{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]
      ];

      await this.sendSafeMessage(ctx, text, {
        reply_markup: this.createInlineKeyboard(buttons)
      });
      return;
    }

    // 페이지 정보
    text += `📄 *${currentPage}/${totalPages} 페이지* (총 ${totalCount}개)\n`;
    text += `${this.styles.separator}\n\n`;

    // 할일 목록
    todos.forEach((todo, index) => {
      const number = (currentPage - 1) * 8 + index + 1;
      const status = todo.completed
        ? this.emojis.completed
        : this.emojis.pending;

      text += `${number}. ${status} ${todo.text}`;

      // 리마인드 정보
      if (enableReminders && todo.reminders && todo.reminders.length > 0) {
        const activeReminders = todo.reminders.filter((r) => r.isActive);
        if (activeReminders.length > 0) {
          text += ` ${this.emojis.bell}`;
        }
      }

      // 우선순위 표시
      if (todo.priority && todo.priority >= 4) {
        text += ` ${this.emojis.priority}`;
      }

      text += `\n`;

      // 완료 시간 표시
      if (todo.completed && todo.completedAt) {
        const completedTime = TimeHelper.format(
          new Date(todo.completedAt),
          "relative"
        );
        text += `   ✓ *${completedTime} 완료*\n`;
      }

      text += `\n`;
    });

    // 버튼 구성
    const buttons = [];

    // 할일별 액션 버튼들
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];

      // 첫 번째 할일
      const todo1 = todos[i];
      const num1 = (currentPage - 1) * 8 + i + 1;
      if (todo1.completed) {
        row.push({
          text: `${num1}. 되돌리기`,
          action: "uncomplete",
          params: todo1._id
        });
      } else {
        row.push({
          text: `${num1}. 완료`,
          action: "complete",
          params: todo1._id
        });
      }

      // 두 번째 할일
      if (i + 1 < todos.length) {
        const todo2 = todos[i + 1];
        const num2 = (currentPage - 1) * 8 + i + 2;
        if (todo2.completed) {
          row.push({
            text: `${num2}. 되돌리기`,
            action: "uncomplete",
            params: todo2._id
          });
        } else {
          row.push({
            text: `${num2}. 완료`,
            action: "complete",
            params: todo2._id
          });
        }
      }

      buttons.push(row);
    }

    // 리마인드 버튼
    if (enableReminders) {
      const pendingTodos = todos.filter((todo) => !todo.completed);
      if (pendingTodos.length > 0) {
        buttons.push([
          {
            text: `${this.emojis.reminder} 리마인드 설정`,
            action: "list_remind_select"
          }
        ]);
      }
    }

    // 페이지네이션
    const paginationRow = [];
    if (currentPage > 1) {
      paginationRow.push({
        text: `⬅️ 이전`,
        action: "list",
        params: String(currentPage - 1)
      });
    }
    if (currentPage < totalPages) {
      paginationRow.push({
        text: `다음 ➡️`,
        action: "list",
        params: String(currentPage + 1)
      });
    }
    if (paginationRow.length > 0) {
      buttons.push(paginationRow);
    }

    // 하단 메뉴
    buttons.push([
      { text: `${this.emojis.add} 추가`, action: "add" },
      {
        text: `${this.emojis.refresh} 새로고침`,
        action: "list",
        params: String(currentPage)
      }
    ]);

    buttons.push([{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ✅ 성공 메시지 렌더링
   */
  async renderSuccess(data, ctx) {
    const { message, redirectTo, _action } = data;

    const text = message || "✅ 작업이 완료되었습니다.";

    const buttons = [];

    // redirectTo에 따른 버튼 구성
    if (redirectTo === "list") {
      buttons.push([
        { text: "📋 할일 목록", action: "list", params: "1" },
        { text: "➕ 더 추가", action: "add" }
      ]);
    }

    buttons.push([{ text: "🏠 메뉴로", action: "menu" }]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ➕ 할일 추가 폼
   */
  async renderAddForm(data, ctx) {
    const text = `${this.emojis.add} *새로운 할일 추가*\n\n할일 내용을 입력해주세요:`;

    const buttons = [[{ text: `${this.emojis.back} 취소`, action: "cancel" }]];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ✏️ 할일 수정 폼
   */
  async renderEditForm(data, ctx) {
    const { todo } = data;

    const text = `${this.emojis.edit} *할일 수정*\n\n현재: ${todo?.text || ""}\n\n새로운 내용을 입력해주세요:`;

    const buttons = [[{ text: `${this.emojis.back} 취소`, action: "cancel" }]];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ⏰ 리마인드 설정 화면
   */
  async renderReminderSetup(data, ctx) {
    const { todo } = data;

    let text = `${this.emojis.reminder} *리마인드 설정*\n\n`;
    text += `📋 할일: *${todo.text}*\n\n`;
    text += `${this.styles.title} 빠른 설정\n`;
    text += `아래 버튼을 누르거나 직접 입력하세요.\n\n`;

    const buttons = [
      [
        {
          text: "⏰ 30분 후",
          action: "remind_quick",
          params: `${todo._id}:30m`
        },
        {
          text: "⏰ 1시간 후",
          action: "remind_quick",
          params: `${todo._id}:1h`
        }
      ],
      [
        {
          text: "📅 내일 오전 9시",
          action: "remind_quick",
          params: `${todo._id}:tomorrow_9am`
        },
        {
          text: "📅 내일 오후 6시",
          action: "remind_quick",
          params: `${todo._id}:tomorrow_6pm`
        }
      ],
      [{ text: "✏️ 직접 입력", action: "remind", params: todo._id }],
      [{ text: `${this.emojis.back} 취소`, action: "cancel" }]
    ];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 🔔 리마인드 목록
   */
  async renderReminderList(data, ctx) {
    const { reminders, totalCount } = data;

    let text = `${this.emojis.bell} *내 리마인드*\n\n`;

    if (!reminders || reminders.length === 0) {
      text += `${this.styles.bullet} 등록된 리마인드가 없습니다.\n\n`;
      text += `${this.emojis.add} 할일에 리마인드를 설정해보세요!`;

      const buttons = [
        [
          { text: `${this.emojis.todo} 할일 목록`, action: "list", params: "1" }
        ],
        [{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]
      ];

      await this.sendSafeMessage(ctx, text, {
        reply_markup: this.createInlineKeyboard(buttons)
      });
      return;
    }

    text += `📊 총 ${totalCount}개의 리마인드\n`;
    text += `${this.styles.separator}\n\n`;

    const now = new Date();
    const sortedReminders = reminders.sort(
      (a, b) => new Date(a.reminderTime) - new Date(b.reminderTime)
    );

    sortedReminders.forEach((reminder, index) => {
      const reminderTime = new Date(reminder.reminderTime);
      const isPast = reminderTime <= now;
      const timeStr = TimeHelper.format(reminderTime, "relative");

      text += `${index + 1}. ${isPast ? "🔕" : this.emojis.clock} ${reminder.text}\n`;
      text += `   ⏰ *${timeStr}*`;

      if (isPast) {
        text += ` (지남)`;
      } else if (reminder.isRecurring) {
        text += ` (반복)`;
      }

      text += `\n\n`;
    });

    const buttons = [];

    const activeReminders = reminders.filter(
      (r) => new Date(r.reminderTime) > now
    );
    if (activeReminders.length > 0) {
      buttons.push([
        {
          text: `${this.emojis.edit} 리마인드 수정`,
          action: "remind_edit_select"
        },
        {
          text: `${this.emojis.delete} 리마인드 삭제`,
          action: "remind_delete_select"
        }
      ]);
    }

    buttons.push([
      { text: `${this.emojis.add} 새 리마인드`, action: "list", params: "1" },
      { text: `${this.emojis.refresh} 새로고침`, action: "remind_list" }
    ]);

    buttons.push([{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ✅ 리마인드 설정 성공
   */
  async renderReminderSuccess(data, ctx) {
    const { todo, reminder } = data;
    const reminderTime = TimeHelper.format(
      new Date(reminder.reminderTime),
      "full"
    );

    let text = `${this.emojis.completed} *리마인드 설정 완료!*\n\n`;
    text += `📋 할일: *${todo.text}*\n`;
    text += `⏰ 알림 시간: *${reminderTime}*\n\n`;
    text += `${this.styles.bullet} 설정된 시간에 알림을 받으실 수 있습니다.\n`;

    const buttons = [
      [
        { text: `${this.emojis.bell} 내 리마인드`, action: "remind_list" },
        { text: `${this.emojis.todo} 할일 목록`, action: "list", params: "1" }
      ],
      [{ text: `${this.emojis.back} 메뉴로`, action: "menu" }]
    ];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 📊 주간 리포트
   */
  async renderWeeklyReport(data, ctx) {
    const { stats, period } = data;

    let text = `${this.emojis.report} *${period} 할일 리포트*\n\n`;

    if (!stats) {
      text += `${this.styles.bullet} 리포트 데이터를 불러올 수 없습니다.`;

      const buttons = [
        [{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]
      ];

      await this.sendSafeMessage(ctx, text, {
        reply_markup: this.createInlineKeyboard(buttons)
      });
      return;
    }

    // 통계 표시
    text += `${this.styles.title} *주요 지표*\n`;
    text += `${this.styles.bullet} 생성된 할일: ${stats.created || 0}개\n`;
    text += `${this.styles.bullet} 완료한 할일: ${stats.completed || 0}개\n`;
    text += `${this.styles.bullet} 완료율: ${stats.completionRate || 0}%\n\n`;

    if (stats.reminders) {
      text += `${this.styles.title} *리마인드 활용*\n`;
      text += `${this.styles.bullet} 설정한 알림: ${stats.reminders.created || 0}개\n`;
      text += `${this.styles.bullet} 실행된 알림: ${stats.reminders.triggered || 0}개\n\n`;
    }

    // 생산성 분석
    text += `${this.styles.title} *생산성 분석*\n`;
    if (stats.completionRate >= 80) {
      text += `🏆 *매우 우수!* 계속해서 좋은 습관을 유지하세요.\n`;
    } else if (stats.completionRate >= 60) {
      text += `👍 *양호합니다!* 조금 더 집중해보세요.\n`;
    } else {
      text += `💪 *개선 여지가 있어요!* 리마인드를 더 활용해보세요.\n`;
    }

    const buttons = [
      [
        { text: `${this.emojis.smart} 개선 제안`, action: "smart_suggestions" },
        { text: `${this.emojis.cleanup} 스마트 정리`, action: "cleanup" }
      ],
      [
        { text: `${this.emojis.refresh} 새로고침`, action: "weekly_report" },
        { text: `${this.emojis.back} 뒤로가기`, action: "menu" }
      ]
    ];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 💡 스마트 제안 (미구현)
   */
  async renderSmartSuggestions(data, ctx) {
    const text = `${this.emojis.smart} *스마트 제안*\n\n이 기능은 준비 중입니다.`;

    const buttons = [
      [{ text: `${this.emojis.back} 뒤로가기`, action: "menu" }]
    ];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 📝 입력 요청
   */
  async renderInputRequest(data, ctx) {
    const { title, message, suggestions } = data;

    let text = `${title}\n\n${message}`;

    if (suggestions && suggestions.length > 0) {
      text += `\n\n${this.styles.title} *제안사항:*\n`;
      suggestions.forEach((suggestion) => {
        text += `${this.styles.bullet} ${suggestion}\n`;
      });
    }

    const buttons = [[{ text: `${this.emojis.back} 취소`, action: "cancel" }]];

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message, action, canRetry } = data;

    let text = `❌ *오류가 발생했습니다*\n\n`;
    text += message || "알 수 없는 오류";

    if (canRetry) {
      text += `\n\n${this.styles.bullet} 다시 시도해주세요.`;
    }

    const buttons = [];

    if (canRetry && action) {
      buttons.push([
        {
          text: `${this.emojis.refresh} 다시 시도`,
          action: action
        }
      ]);
    }

    buttons.push([{ text: `${this.emojis.back} 메뉴로`, action: "menu" }]);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: this.createInlineKeyboard(buttons)
    });
  }

  /**
   * 🚨 폴백 렌더링 (최후의 수단)
   */
  async renderFallback(ctx, error) {
    try {
      const text = "❌ 화면을 표시할 수 없습니다.";
      const buttons = [
        [{ text: "🏠 메인 메뉴", action: "menu", module: "main" }]
      ];

      await this.sendSafeMessage(ctx, text, {
        reply_markup: this.createInlineKeyboard(buttons)
      });
    } catch (fallbackError) {
      logger.error("Fallback rendering also failed:", fallbackError);
    }
  }
}

module.exports = TodoRenderer;
