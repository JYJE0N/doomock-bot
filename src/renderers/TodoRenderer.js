// src/renderers/TodoRenderer.js - UI 생성만 담당
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎨 TodoRenderer - UI 렌더링만 담당
 *
 * ✅ 역할: 인라인 키보드 생성, 메시지 포맷팅, UI 요소 렌더링
 * ❌ 하지 않는 것: 비즈니스 로직, 데이터 조회, 상태 관리
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);

    // 모듈 이름 (BaseRenderer에서 사용)
    this.moduleName = "todo";

    // 이모지 설정
    this.emojis = {
      // 기본 이모지
      todo: "📋",
      completed: "✅",
      pending: "⏳",
      priority: "🔥",
      add: "➕",
      edit: "✏️",
      delete: "🗑️",
      archive: "📦",

      // 리마인더 이모지
      reminder: "⏰",
      bell: "🔔",

      // UI 이모지
      back: "⬅️",
      home: "🏠",
      refresh: "🔄",
      stats: "📊",

      // 우선순위 이모지
      urgent: "🚨",
      high: "🔥",
      medium: "🟡",
      low: "🟢"
    };

    // UI 스타일
    this.styles = {
      title: "🔸",
      subtitle: "▫️",
      bullet: "•",
      separator: "─────────────────",
      highlight: "*"
    };

    logger.info("🎨 TodoRenderer 생성됨");
  }

  /**
   * 메인 렌더링 메서드 (BaseRenderer 추상 메서드 구현)
   */
  async render(result, ctx) {
    try {
      if (!result || typeof result !== "object") {
        throw new Error("Invalid result object");
      }

      const { type, action, data } = result;
      const renderAction = action || type;

      logger.debug(`🎨 TodoRenderer.render:`, {
        type,
        action: renderAction,
        hasData: !!data
      });

      // 렌더링 액션에 따라 처리
      switch (renderAction) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "list":
          return await this.renderTodoList(data, ctx);

        case "input_request":
          return await this.renderInputRequest(data, ctx);

        case "success":
          return await this.renderSuccess(data, ctx);

        case "error":
          return await this.renderError(data, ctx);

        case "stats":
          return await this.renderStats(data, ctx);

        case "weekly_report":
          return await this.renderWeeklyReport(data, ctx);

        case "remind_list":
          return await this.renderReminderList(data, ctx);

        default:
          throw new Error(`Unknown render action: ${renderAction}`);
      }
    } catch (error) {
      logger.error("TodoRenderer.render 오류:", error);
      return await this.renderError(
        {
          message: "렌더링 중 오류가 발생했습니다.",
          canRetry: true
        },
        ctx
      );
    }
  }

  /**
   * 📋 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { title, stats, enableReminders } = data;

    let text = `${title}\n\n`;

    // 통계 표시
    if (stats) {
      text += `📊 현재 상태:\n`;
      text += `${this.styles.bullet} 전체: ${stats.total}개\n`;
      text += `${this.styles.bullet} 완료: ${stats.completed}개\n`;
      text += `${this.styles.bullet} 대기: ${stats.pending}개\n`;
      text += `${this.styles.bullet} 완료율: ${stats.completionRate}%\n\n`;
    }

    text += `무엇을 도와드릴까요?`;

    // 인라인 키보드 생성
    const keyboard = [];

    // 첫 번째 줄: 기본 액션
    keyboard.push([
      this.createButton("📋 할일 목록", "list"),
      this.createButton("➕ 할일 추가", "add")
    ]);

    // 두 번째 줄: 통계/리포트
    keyboard.push([
      this.createButton("📊 통계 보기", "stats"),
      this.createButton("📈 주간 리포트", "weekly")
    ]);

    // 세 번째 줄: 리마인더 (활성화된 경우)
    if (enableReminders) {
      keyboard.push([this.createButton("⏰ 리마인더 관리", "remind_list")]);
    }

    // 네비게이션
    keyboard.push([
      this.createButton("🏠 홈으로", { module: "system", action: "menu" })
    ]);

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * 📋 할일 목록 렌더링 - 더블 라인 레이아웃
   */
  async renderTodoList(data, ctx) {
    const { todos, currentPage, totalPages, totalCount, enableReminders } =
      data;

    let text = `📋 *할일 목록* (${totalCount}개)\n\n`;

    if (todos.length === 0) {
      text += `_아직 등록된 할일이 없습니다._\n`;
      text += `➕ 버튼을 눌러 새로운 할일을 추가해보세요!`;
    } else {
      // 할일 텍스트만 심플하게 표시 (번호 + 상태 + 제목)
      todos.forEach((todo, index) => {
        const num = (currentPage - 1) * 10 + index + 1;
        const statusEmoji = todo.completed ? "✅" : "⏳";

        text += `${num}. ${statusEmoji} ${todo.text}\n`;
      });
    }

    // 페이지 정보
    if (totalPages > 1) {
      text += `\n${this.styles.separator}\n`;
      text += `페이지 ${currentPage}/${totalPages}`;
    }

    // 🎨 더블 라인 레이아웃 (리마인더 상태 정확 반영)
    const keyboard = [];

    if (todos.length > 0) {
      todos.forEach((todo, index) => {
        // 📝 첫 번째 줄: 상태 + 제목 (전체 너비)
        const num = (currentPage - 1) * 10 + index + 1;
        let titleText = `${num}. ${todo.text}`;

        // 25자 초과시 줄임표 처리
        if (titleText.length > 28) {
          titleText = titleText.substring(0, 25) + "...";
        }

        // 우선순위 이모지 추가
        const priority = this.getPriorityEmoji(todo.priority);
        if (priority) {
          titleText = `${priority} ${titleText}`;
        }

        // 상태에 따른 버튼 스타일
        const statusAction = todo.completed ? "uncomplete" : "complete";
        const statusEmoji = todo.completed ? "✅" : "◯";

        keyboard.push([
          this.createButton(
            `${statusEmoji} ${titleText}`,
            statusAction,
            todo._id
          )
        ]);

        // ⚡ 두 번째 줄: 액션 버튼들
        const actionRow = [];

        // 🔔 스마트한 알림 버튼 (리마인더 상태 정확 확인)
        if (enableReminders && !todo.completed) {
          // 🎯 핵심: hasActiveReminder 필드로 정확한 상태 확인
          if (todo.hasActiveReminder) {
            actionRow.push(
              this.createButton("🔕 알림해제", "remind_remove", todo._id)
            );
          } else {
            actionRow.push(
              this.createButton("🔔 알림설정", "remind_add", todo._id)
            );
          }
        }

        // 수정 버튼
        actionRow.push(this.createButton("✏️ 수정", "edit", todo._id));

        // 삭제 버튼
        actionRow.push(this.createButton("🗑️ 삭제", "delete", todo._id));

        // 완료된 할일인 경우 보관 버튼 추가
        if (todo.completed) {
          actionRow.push(this.createButton("📦 보관", "archive", todo._id));
        }

        keyboard.push(actionRow);

        // 할일 사이 구분을 위한 빈 줄 (마지막 할일 제외)
        if (index < todos.length - 1) {
          keyboard.push([]);
        }
      });

      // 전체 구분선
      keyboard.push([]);
    }

    // 📄 개선된 페이지네이션
    if (totalPages > 1) {
      const paginationRow = [];

      if (currentPage > 1) {
        paginationRow.push(
          this.createButton("◀️ 이전", "list", currentPage - 1)
        );
      }

      // 페이지 정보 표시
      paginationRow.push(
        this.createButton(`${currentPage} / ${totalPages}`, "list", currentPage)
      );

      if (currentPage < totalPages) {
        paginationRow.push(
          this.createButton("다음 ▶️", "list", currentPage + 1)
        );
      }

      keyboard.push(paginationRow);
    }

    // 🔄 메인 액션 버튼들
    keyboard.push([
      this.createButton("➕ 할일 추가", "add"),
      this.createButton("🔄 새로고침", "list", currentPage)
    ]);

    // 📊 추가 기능 버튼들
    keyboard.push([
      this.createButton("📊 통계", "stats"),
      this.createButton("📈 리포트", "weekly")
    ]);

    // 🏠 네비게이션
    keyboard.push([
      this.createButton("⬅️ 돌아가기", "menu"),
      this.createButton("🏠 홈으로", { module: "system", action: "menu" })
    ]);

    // 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * 📝 입력 요청 렌더링
   */
  async renderInputRequest(data, ctx) {
    const { title, message, suggestions } = data;

    let text = `${title}\n\n`;
    text += `${message}\n`;

    if (suggestions && suggestions.length > 0) {
      text += `\n💡 입력 예시:\n`;
      suggestions.forEach((suggestion) => {
        text += `${this.styles.bullet} ${suggestion}\n`;
      });
    }

    text += `\n_입력을 기다리고 있습니다..._`;

    // 취소 버튼만 표시
    const keyboard = [[this.createButton("❌ 취소", "menu")]];

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * ✅ 성공 메시지 렌더링
   */
  async renderSuccess(data, ctx) {
    const { message, redirectTo, todo, action } = data;

    let text = `${message}\n`;

    if (todo) {
      text += `\n📋 할일: ${todo.text}\n`;
      if (todo.priority) {
        text += `🔥 우선순위: ${todo.priority}\n`;
      }
    }

    const keyboard = [];

    // 🎯 스마트한 버튼 배치 - 중복 제거
    if (redirectTo) {
      // 리다이렉트가 지정된 경우
      const redirectText = this.getRedirectButtonText(redirectTo);
      keyboard.push([this.createButton(redirectText, redirectTo)]);

      // 리다이렉트가 'list'가 아닌 경우에만 할일 목록 버튼 추가
      if (redirectTo !== "list") {
        keyboard.push([
          this.createButton("📋 할일 목록", "list"),
          this.createButton("🏠 홈으로", { module: "system", action: "menu" })
        ]);
      } else {
        // 리다이렉트가 'list'인 경우 홈 버튼만 추가
        keyboard.push([
          this.createButton("🏠 홈으로", { module: "system", action: "menu" })
        ]);
      }
    } else {
      // 리다이렉트가 없는 경우 - 액션에 따라 적절한 버튼 제공
      switch (action) {
        case "add":
          keyboard.push([
            this.createButton("➕ 더 추가", "add"),
            this.createButton("📋 목록 보기", "list")
          ]);
          break;

        case "edit":
          keyboard.push([
            this.createButton("📋 목록 보기", "list"),
            this.createButton("📊 통계", "stats")
          ]);
          break;

        case "complete":
        case "uncomplete":
          keyboard.push([
            this.createButton("📋 목록 보기", "list"),
            this.createButton("📈 주간 리포트", "weekly")
          ]);
          break;

        case "remind_add":
          keyboard.push([
            this.createButton("⏰ 리마인더 목록", "remind_list"),
            this.createButton("📋 할일 목록", "list")
          ]);
          break;

        default:
          // 기본 네비게이션
          keyboard.push([
            this.createButton("📋 할일 목록", "list"),
            this.createButton("🏠 홈으로", { module: "system", action: "menu" })
          ]);
      }
    }

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    let text = `📊 *할일 통계*\n\n`;

    text += `${this.styles.title} 전체 현황\n`;
    text += `${this.styles.bullet} 전체 할일: ${data.total}개\n`;
    text += `${this.styles.bullet} 완료된 할일: ${data.completed}개\n`;
    text += `${this.styles.bullet} 대기중 할일: ${data.pending}개\n`;
    text += `${this.styles.bullet} 완료율: ${data.completionRate}%\n`;

    // 진행률 바 표시
    const progressBar = this.createProgressBar(data.completionRate);
    text += `\n${progressBar}`;

    const keyboard = [
      [
        this.createButton("📈 주간 리포트", "weekly"),
        this.createButton("🔄 새로고침", "stats")
      ],
      [
        this.createButton("⬅️ 돌아가기", "menu"),
        this.createButton("🏠 홈으로", { module: "system", action: "menu" })
      ]
    ];

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * 📈 주간 리포트 렌더링
   */
  async renderWeeklyReport(data, ctx) {
    const { report } = data;

    let text = `📈 *주간 리포트*\n`;
    text += `${TimeHelper.format(report.period.start, "date")} ~ ${TimeHelper.format(report.period.end, "date")}\n\n`;

    text += `${this.styles.title} 이번 주 성과\n`;
    text += `${this.styles.bullet} 추가된 할일: ${report.totalAdded}개\n`;
    text += `${this.styles.bullet} 완료된 할일: ${report.totalCompleted}개\n`;
    text += `${this.styles.bullet} 대기중 할일: ${report.pendingTodos}개\n`;
    text += `${this.styles.bullet} 달성률: ${report.completionRate}%\n\n`;

    // 일별 통계
    if (report.dailyStats && report.dailyStats.length > 0) {
      text += `${this.styles.title} 일별 완료 현황\n`;
      report.dailyStats.forEach((stat) => {
        const date = TimeHelper.format(new Date(stat._id), "short");
        const bar = this.createMiniBar(stat.count, report.totalCompleted);
        text += `${date}: ${bar} ${stat.count}개\n`;
      });
    }

    // 격려 메시지
    text += `\n💪 `;
    if (report.completionRate >= 80) {
      text += `훌륭해요! 이번 주도 멋진 성과를 냈네요!`;
    } else if (report.completionRate >= 50) {
      text += `좋아요! 꾸준히 진행하고 있네요!`;
    } else {
      text += `화이팅! 조금씩 나아가고 있어요!`;
    }

    const keyboard = [
      [
        this.createButton("📊 통계 보기", "stats"),
        this.createButton("🔄 새로고침", "weekly")
      ],
      [
        this.createButton("⬅️ 돌아가기", "menu"),
        this.createButton("🏠 홈으로", { module: "system", action: "menu" })
      ]
    ];

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  /**
   * ⏰ 리마인더 목록 렌더링
   */
  async renderReminderList(data, ctx) {
    const { reminders, totalCount } = data;

    let text = `⏰ *리마인더 목록* (${totalCount}개)\n\n`;

    if (reminders.length === 0) {
      text += `_설정된 리마인더가 없습니다._\n`;
      text += `할일 목록에서 ⏰ 버튼을 눌러 리마인더를 추가하세요!`;
    } else {
      reminders.forEach((reminder, index) => {
        const todoText = reminder.todoId?.text || reminder.text; // message → text
        const remindTime = TimeHelper.format(reminder.reminderTime, "full"); // remindAt → reminderTime

        text += `${index + 1}. ${this.emojis.bell} ${todoText}\n`;
        text += `   ${this.styles.bullet} 알림: ${remindTime}\n`;

        if (reminder.type && reminder.type !== "simple") {
          text += `   ${this.styles.bullet} 유형: ${this.getReminderTypeText(reminder.type)}\n`;
        }

        text += `\n`;
      });
    }

    const keyboard = [];

    // 리마인더 삭제 버튼들
    if (reminders.length > 0) {
      reminders.forEach((reminder, index) => {
        keyboard.push([
          this.createButton(
            `🗑️ ${index + 1}번 삭제`,
            "remind_delete",
            reminder._id
          )
        ]);
      });

      keyboard.push([]); // 구분선
    }

    // 네비게이션
    keyboard.push([
      this.createButton("📋 할일 목록", "list"),
      this.createButton("🔄 새로고침", "remind_list")
    ]);

    keyboard.push([
      this.createButton("⬅️ 돌아가기", "menu"),
      this.createButton("🏠 홈으로", { module: "system", action: "menu" })
    ]);

    // 실제로 메시지 전송
    await this.sendSafeMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // 콜백 쿼리 응답
    if (ctx.callbackQuery && ctx.answerCbQuery) {
      await ctx.answerCbQuery();
    }
  }

  // ===== 헬퍼 메서드 =====

  /**
   * 우선순위 이모지 반환
   */
  getPriorityEmoji(priority) {
    const map = {
      urgent: this.emojis.urgent,
      high: this.emojis.high,
      medium: this.emojis.medium,
      low: this.emojis.low
    };
    return map[priority] || "";
  }

  /**
   * 리마인더 타입 텍스트 반환
   */
  getReminderTypeText(type) {
    const map = {
      simple: "단순 알림",
      urgent: "긴급 알림",
      recurring: "반복 알림",
      smart: "스마트 알림"
    };
    return map[type] || type;
  }

  /**
   * 진행률 바 생성
   */
  createProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;

    let bar = "";
    for (let i = 0; i < filled; i++) bar += "▰";
    for (let i = 0; i < empty; i++) bar += "▱";

    return `[${bar}] ${percentage}%`;
  }

  /**
   * 미니 바 생성 (일별 통계용)
   */
  createMiniBar(value, maxValue) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const blocks = Math.round(percentage / 20);

    let bar = "";
    for (let i = 0; i < blocks; i++) bar += "█";
    for (let i = blocks; i < 5; i++) bar += "░";

    return bar;
  }

  /**
   * 리다이렉트 버튼 텍스트 반환
   */
  getRedirectButtonText(redirectTo) {
    const map = {
      list: "📋 할일 목록으로",
      menu: "📋 메뉴로 돌아가기",
      remind_list: "⏰ 리마인더 목록으로",
      stats: "📊 통계 보기",
      weekly: "📈 주간 리포트 보기"
    };
    return map[redirectTo] || "돌아가기";
  }

  /**
   * 버튼 생성 헬퍼 (BaseRenderer의 형식에 맞게 수정)
   */
  createButton(text, action, params = null) {
    if (typeof action === "object") {
      // 다른 모듈로의 이동
      return {
        text: text,
        callback_data: this.buildCallbackData(
          action.module,
          action.action,
          action.params || ""
        )
      };
    } else {
      // 같은 모듈 내 액션
      return {
        text: text,
        callback_data: this.buildCallbackData(
          this.moduleName,
          action,
          params || ""
        )
      };
    }
  }

  /**
   * 렌더러 정보
   */
  getRendererInfo() {
    return {
      name: "TodoRenderer",
      version: "2.0.0",
      moduleName: this.moduleName,
      description: "할일 관리 UI 렌더러"
    };
  }
}

module.exports = TodoRenderer;
