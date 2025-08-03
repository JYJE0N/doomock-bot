// src/renderers/TodoRenderer.js - 리마인드 UI가 추가된 할일 렌더러
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎨 TodoRenderer - 할일 관리 UI 렌더러 (리마인드 기능 포함)
 *
 * ✅ SoC 준수: UI 생성만 담당
 * ✅ 깔끔하고 직관적인 사용자 인터페이스
 * ✅ 리마인드 관련 UI 추가
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);

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

      // 🆕 리마인드 관련 이모지
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

      // 🆕 스마트 기능
      report: "📊",
      smart: "🤖",
      stats: "📈",
      cleanup: "🧹"
    };

    // UI 색상 및 스타일 (마크다운용)
    this.styles = {
      title: "🔸",
      subtitle: "▫️",
      bullet: "•",
      separator: "─────────────────",
      highlight: "*"
    };

    logger.info("🎨 TodoRenderer 생성됨 (리마인드 UI 포함)");
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(data) {
    try {
      switch (data.action) {
        // 기본 액션들
        case "menu":
          return this.renderMenu(data);
        case "list":
          return this.renderTodoList(data);
        case "add":
          return this.renderAddTodo(data);
        case "edit":
          return this.renderEditTodo(data);

        // 🆕 리마인드 관련 렌더링
        case "remind":
          return this.renderReminderSetup(data);
        case "remind_list":
          return this.renderReminderList(data);
        case "remind_set":
          return this.renderReminderSuccess(data);

        // 🆕 스마트 기능 렌더링
        case "weekly_report":
          return this.renderWeeklyReport(data);
        case "smart_suggestions":
          return this.renderSmartSuggestions(data);

        // 입력 요청
        case "input_request":
          return this.renderInputRequest(data);

        // 에러
        case "error":
          return this.renderError(data);

        default:
          logger.warn(`알 수 없는 액션: ${data.action}`);
          return this.renderError({
            message: "알 수 없는 요청입니다.",
            action: data.action
          });
      }
    } catch (error) {
      logger.error("TodoRenderer.render 오류:", error);
      return this.renderError({
        message: "화면 렌더링 중 오류가 발생했습니다.",
        action: data.action
      });
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링 (리마인드 기능 추가)
   */
  renderMenu(data) {
    const { stats, enableReminders } = data;

    let text = `${this.emojis.todo} *할일 관리*\n\n`;

    // 통계 정보 표시
    if (stats) {
      text += `${this.styles.title} *현재 상황*\n`;
      text += `${this.styles.bullet} 대기 중: ${stats.pending || 0}개\n`;
      text += `${this.styles.bullet} 완료: ${stats.completed || 0}개\n`;

      // 🆕 리마인드 통계 추가
      if (enableReminders && stats.reminders) {
        text += `${this.styles.bullet} 예정된 알림: ${stats.reminders.active || 0}개\n`;
      }

      text += `\n`;
    }

    // 메뉴 버튼들
    const keyboard = [
      [
        { text: `${this.emojis.todo} 할일 목록`, callback_data: "todo:list:1" },
        { text: `${this.emojis.add} 할일 추가`, callback_data: "todo:add" }
      ]
    ];

    // 🆕 리마인드 기능이 활성화된 경우
    if (enableReminders) {
      keyboard.push([
        {
          text: `${this.emojis.reminder} 리마인드 목록`,
          callback_data: "todo:remind_list"
        },
        {
          text: `${this.emojis.report} 주간 리포트`,
          callback_data: "todo:weekly_report"
        }
      ]);
    }

    // 추가 기능들
    keyboard.push([
      { text: `${this.emojis.search} 검색`, callback_data: "todo:search" },
      {
        text: `${this.emojis.smart} 스마트 정리`,
        callback_data: "todo:cleanup"
      }
    ]);

    keyboard.push([
      { text: `${this.emojis.back} 뒤로가기`, callback_data: "main:menu" }
    ]);

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * 📋 할일 목록 렌더링 (리마인드 정보 포함)
   */
  renderTodoList(data) {
    const { todos, totalCount, currentPage, totalPages, enableReminders } =
      data;

    let text = `${this.emojis.todo} *할일 목록*\n\n`;

    if (!todos || todos.length === 0) {
      text += `${this.styles.bullet} 등록된 할일이 없습니다.\n\n`;
      text += `${this.emojis.add} 새로운 할일을 추가해보세요!`;

      return {
        text,
        reply_markup: this.createInlineKeyboard([
          [{ text: `${this.emojis.add} 할일 추가`, callback_data: "todo:add" }],
          [{ text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }]
        ])
      };
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

      // 🆕 리마인드 정보 표시
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
    const keyboard = [];

    // 할일별 액션 버튼들 (2개씩 나열)
    for (let i = 0; i < todos.length; i += 2) {
      const row = [];

      // 첫 번째 할일
      const todo1 = todos[i];
      const num1 = (currentPage - 1) * 8 + i + 1;
      if (todo1.completed) {
        row.push({
          text: `${num1}. 되돌리기`,
          callback_data: `todo:uncomplete:${todo1._id}`
        });
      } else {
        row.push({
          text: `${num1}. 완료`,
          callback_data: `todo:complete:${todo1._id}`
        });
      }

      // 두 번째 할일 (있는 경우)
      if (i + 1 < todos.length) {
        const todo2 = todos[i + 1];
        const num2 = (currentPage - 1) * 8 + i + 2;
        if (todo2.completed) {
          row.push({
            text: `${num2}. 되돌리기`,
            callback_data: `todo:uncomplete:${todo2._id}`
          });
        } else {
          row.push({
            text: `${num2}. 완료`,
            callback_data: `todo:complete:${todo2._id}`
          });
        }
      }

      keyboard.push(row);
    }

    // 🆕 리마인드 버튼들 (미완료 할일만)
    if (enableReminders) {
      const pendingTodos = todos.filter((todo) => !todo.completed);
      if (pendingTodos.length > 0) {
        keyboard.push([
          {
            text: `${this.emojis.reminder} 리마인드 설정`,
            callback_data: "todo:list_remind_select"
          }
        ]);
      }
    }

    // 페이지네이션
    const paginationRow = [];
    if (currentPage > 1) {
      paginationRow.push({
        text: `⬅️ 이전`,
        callback_data: `todo:list:${currentPage - 1}`
      });
    }
    if (currentPage < totalPages) {
      paginationRow.push({
        text: `다음 ➡️`,
        callback_data: `todo:list:${currentPage + 1}`
      });
    }
    if (paginationRow.length > 0) {
      keyboard.push(paginationRow);
    }

    // 하단 메뉴
    keyboard.push([
      { text: `${this.emojis.add} 추가`, callback_data: "todo:add" },
      {
        text: `${this.emojis.refresh} 새로고침`,
        callback_data: `todo:list:${currentPage}`
      }
    ]);

    keyboard.push([
      { text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }
    ]);

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * ⏰ 리마인드 설정 화면 렌더링
   */
  renderReminderSetup(data) {
    const { todo } = data;

    let text = `${this.emojis.reminder} *리마인드 설정*\n\n`;
    text += `📋 할일: *${todo.text}*\n\n`;
    text += `${this.styles.title} 빠른 설정\n`;
    text += `아래 버튼을 누르거나 직접 입력하세요.\n\n`;

    const keyboard = [
      [
        {
          text: "⏰ 30분 후",
          callback_data: `todo:remind_quick:${todo._id}:30m`
        },
        {
          text: "⏰ 1시간 후",
          callback_data: `todo:remind_quick:${todo._id}:1h`
        }
      ],
      [
        {
          text: "📅 내일 오전 9시",
          callback_data: `todo:remind_quick:${todo._id}:tomorrow_9am`
        },
        {
          text: "📅 내일 오후 6시",
          callback_data: `todo:remind_quick:${todo._id}:tomorrow_6pm`
        }
      ],
      [{ text: "✏️ 직접 입력", callback_data: `todo:remind:${todo._id}` }],
      [{ text: `${this.emojis.back} 취소`, callback_data: "todo:cancel" }]
    ];

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * 🔔 리마인드 목록 렌더링
   */
  renderReminderList(data) {
    const { reminders, totalCount } = data;

    let text = `${this.emojis.bell} *내 리마인드*\n\n`;

    if (!reminders || reminders.length === 0) {
      text += `${this.styles.bullet} 등록된 리마인드가 없습니다.\n\n`;
      text += `${this.emojis.add} 할일에 리마인드를 설정해보세요!`;

      return {
        text,
        reply_markup: this.createInlineKeyboard([
          [
            {
              text: `${this.emojis.todo} 할일 목록`,
              callback_data: "todo:list:1"
            }
          ],
          [{ text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }]
        ])
      };
    }

    text += `📊 총 ${totalCount}개의 리마인드\n`;
    text += `${this.styles.separator}\n\n`;

    // 현재 시간
    const now = new Date();

    // 리마인드 목록 (시간순 정렬)
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

    // 버튼 구성
    const keyboard = [];

    // 활성 리마인드만 관리 버튼 제공
    const activeReminders = reminders.filter(
      (r) => new Date(r.reminderTime) > now
    );
    if (activeReminders.length > 0) {
      keyboard.push([
        {
          text: `${this.emojis.edit} 리마인드 수정`,
          callback_data: "todo:remind_edit_select"
        },
        {
          text: `${this.emojis.delete} 리마인드 삭제`,
          callback_data: "todo:remind_delete_select"
        }
      ]);
    }

    keyboard.push([
      { text: `${this.emojis.add} 새 리마인드`, callback_data: "todo:list:1" },
      {
        text: `${this.emojis.refresh} 새로고침`,
        callback_data: "todo:remind_list"
      }
    ]);

    keyboard.push([
      { text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }
    ]);

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * ✅ 리마인드 설정 성공 렌더링
   */
  renderReminderSuccess(data) {
    const { todo, reminder } = data;
    const reminderTime = TimeHelper.format(
      new Date(reminder.reminderTime),
      "full"
    );

    let text = `${this.emojis.completed} *리마인드 설정 완료!*\n\n`;
    text += `📋 할일: *${todo.text}*\n`;
    text += `⏰ 알림 시간: *${reminderTime}*\n\n`;
    text += `${this.styles.bullet} 설정된 시간에 알림을 받으실 수 있습니다.\n`;

    const keyboard = [
      [
        {
          text: `${this.emojis.bell} 내 리마인드`,
          callback_data: "todo:remind_list"
        },
        { text: `${this.emojis.todo} 할일 목록`, callback_data: "todo:list:1" }
      ],
      [{ text: `${this.emojis.back} 메뉴로`, callback_data: "todo:menu" }]
    ];

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * 📊 주간 리포트 렌더링
   */
  renderWeeklyReport(data) {
    const { stats, period } = data;

    let text = `${this.emojis.report} *${period} 할일 리포트*\n\n`;

    if (!stats) {
      text += `${this.styles.bullet} 리포트 데이터를 불러올 수 없습니다.`;

      return {
        text,
        reply_markup: this.createInlineKeyboard([
          [{ text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }]
        ])
      };
    }

    // 주요 통계
    text += `${this.styles.title} *주요 지표*\n`;
    text += `${this.styles.bullet} 생성된 할일: ${stats.created || 0}개\n`;
    text += `${this.styles.bullet} 완료한 할일: ${stats.completed || 0}개\n`;
    text += `${this.styles.bullet} 완료율: ${stats.completionRate || 0}%\n\n`;

    // 🆕 리마인드 통계
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

    const keyboard = [
      [
        {
          text: `${this.emojis.smart} 개선 제안`,
          callback_data: "todo:smart_suggestions"
        },
        {
          text: `${this.emojis.cleanup} 스마트 정리`,
          callback_data: "todo:cleanup"
        }
      ],
      [
        {
          text: `${this.emojis.refresh} 새로고침`,
          callback_data: "todo:weekly_report"
        },
        { text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }
      ]
    ];

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * 📝 입력 요청 렌더링
   */
  renderInputRequest(data) {
    const { title, message, suggestions } = data;

    let text = `${title}\n\n${message}`;

    // 🆕 제안사항 표시 (리마인드 시간 입력 등)
    if (suggestions && suggestions.length > 0) {
      text += `\n\n${this.styles.title} *제안사항:*\n`;
      suggestions.forEach((suggestion) => {
        text += `${this.styles.bullet} ${suggestion}\n`;
      });
    }

    const keyboard = [
      [{ text: `${this.emojis.back} 취소`, callback_data: "todo:cancel" }]
    ];

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }

  /**
   * ❌ 에러 렌더링
   */
  renderError(data) {
    const { message, action, canRetry } = data;

    let text = `❌ *오류가 발생했습니다*\n\n`;
    text += `${message}\n\n`;

    if (canRetry) {
      text += `${this.styles.bullet} 다시 시도해주세요.`;
    }

    const keyboard = [];

    if (canRetry && action) {
      keyboard.push([
        {
          text: `${this.emojis.refresh} 다시 시도`,
          callback_data: `todo:${action}`
        }
      ]);
    }

    keyboard.push([
      { text: `${this.emojis.back} 뒤로가기`, callback_data: "todo:menu" }
    ]);

    return {
      text,
      reply_markup: this.createInlineKeyboard(keyboard)
    };
  }
}

module.exports = TodoRenderer;
