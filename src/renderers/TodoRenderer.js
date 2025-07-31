// src/renderers/TodoRenderer.js - CRUD 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 📋 TodoRenderer - 할일 관리 UI 렌더링 (CRUD 파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "todo:action:params" 형태 표준화
 * - 복잡한 CRUD 로직을 파서 규칙으로 단순화
 * - 페이지네이션, 필터링, 검색 통합 처리
 * - 실시간 상태 업데이트 지원
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 스마트 할일 관리 대시보드
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 복잡한 CRUD 기능을 직관적인 버튼으로 제공
 * - 실시간 상태 변경과 시각적 피드백
 * - 페이지네이션과 필터링을 매끄럽게 처리
 *
 * 📊 CRUD 파서 규칙:
 * - todo:list → 할일 목록
 * - todo:list:1 → 1페이지 목록
 * - todo:add → 할일 추가
 * - todo:toggle:ID → 완료/미완료 토글
 * - todo:delete:ID → 할일 삭제
 * - todo:filter:completed → 완료된 항목만
 * - todo:search → 검색 모드
 */
class TodoRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "todo";

    // 📋 할일 관리 특화 설정
    this.config = {
      ...this.config,
      maxItemsPerPage: 10,
      showCompletedInList: true,
      enableQuickActions: true,
      showProgress: true,
      animateStateChanges: true,
    };

    // 🎭 이모지 컬렉션 (할일 관리 특화)
    this.emojis = {
      // 기본 상태
      todo: "📋",
      completed: "✅",
      pending: "⏳",
      overdue: "🚨",

      // 액션
      add: "➕",
      delete: "🗑️",
      edit: "✏️",
      toggle: "🔄",

      // 필터
      filter: "🔍",
      search: "🔎",
      all: "📝",

      // UI 요소
      stats: "📊",
      calendar: "📅",
      time: "⏰",
      reminder: "🔔",
      priority: "⭐",

      // 상태 피드백
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "💡",

      // 페이지네이션
      prev: "◀️",
      next: "▶️",
      first: "⏪",
      last: "⏩",
    };

    // 🎨 우선순위별 스타일
    this.priorityStyles = {
      1: { emoji: "🔥", label: "긴급", color: "🔴" },
      2: { emoji: "⭐", label: "높음", color: "🟠" },
      3: { emoji: "📌", label: "보통", color: "🟡" },
      4: { emoji: "📝", label: "낮음", color: "🟢" },
      5: { emoji: "💭", label: "언젠가", color: "🔵" },
    };

    logger.debug("📋 TodoRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, {
      dataKeys: Object.keys(data || {}),
      hasData: !!data,
    });

    try {
      switch (type) {
        case "list":
          return await this.renderTodoList(data, ctx);

        case "filtered_list":
          return await this.renderFilteredList(data, ctx);

        case "add_success":
          return await this.renderAddSuccess(data, ctx);

        case "toggle_success":
          return await this.renderToggleSuccess(data, ctx);

        case "delete_success":
          return await this.renderDeleteSuccess(data, ctx);

        case "input_prompt":
          return await this.renderInputPrompt(data, ctx);

        case "limit_exceeded":
          return await this.renderLimitExceeded(data, ctx);

        case "stats":
          return await this.renderStats(data, ctx);

        case "search_results":
          return await this.renderSearchResults(data, ctx);

        case "empty_state":
          return await this.renderEmptyState(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "알 수 없는 오류가 발생했습니다.",
            ctx
          );

        default:
          this.warn(`지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            `지원하지 않는 기능입니다: ${type}`,
            ctx
          );
      }
    } catch (error) {
      this.error(`렌더링 오류 (${type})`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다.", ctx);
    }
  }

  // ===== 📋 할일 목록 렌더링 =====

  /**
   * 📋 할일 목록 렌더링 (파서 규칙 적용)
   */
  async renderTodoList(data, ctx) {
    this.debug("할일 목록 렌더링", {
      todoCount: data?.todos?.length,
      currentPage: data?.pagination?.currentPage,
    });

    const { todos, stats, pagination, userName } = data;

    let text = `${this.emojis.todo} **할일 관리 \\- ${userName}**\n\n`;

    // 통계 표시
    if (stats) {
      text += this.formatTodoStats(stats);
      text += "\n";
    }

    // 할일 목록 표시
    if (todos && todos.length > 0) {
      text += this.formatTodoItems(todos);

      // 페이지네이션 정보
      if (pagination && pagination.totalPages > 1) {
        text += `\n📄 **페이지 ${pagination.currentPage}/${pagination.totalPages}** (총 ${pagination.totalItems}개)`;
      }
    } else {
      text += this.formatEmptyTodoList();
    }

    // 표준 키보드 생성 (파서 규칙 적용)
    const keyboard = this.createTodoListKeyboard(todos, pagination, stats);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🔍 필터링된 목록 렌더링
   */
  async renderFilteredList(data, ctx) {
    this.debug("필터링된 목록 렌더링", { filterType: data?.filter?.type });

    const { todos, stats, filter, userName } = data;

    let text = `${this.emojis.filter} **할일 필터: ${filter.label}**\n\n`;

    // 필터 정보
    text += `📊 **필터 결과**: ${todos.length}개 항목\n\n`;

    // 할일 목록 표시
    if (todos.length > 0) {
      text += this.formatTodoItems(todos);
    } else {
      text += `${this.emojis.info} 해당 조건에 맞는 할일이 없습니다\\.\n`;
      text += "다른 필터를 시도해보세요\\!";
    }

    // 필터링 키보드
    const buttons = [
      [
        { text: `${this.emojis.all} 전체보기`, action: "list" },
        { text: `${this.emojis.add} 새 할일`, action: "add" },
      ],
      [
        { text: "📊 통계", action: "stats" },
        { text: `${this.emojis.filter} 다른 필터`, action: "filter" },
      ],
      [this.createBackButton(this.moduleName), this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ✅ CRUD 액션 렌더링 =====

  /**
   * ➕ 할일 추가 성공 렌더링
   */
  async renderAddSuccess(data, ctx) {
    this.debug("할일 추가 성공 렌더링");

    const { todo, message } = data;

    let text = `${this.emojis.success} **할일 추가 완료\\!**\n\n`;
    text += `📝 "${todo.text}"\n\n`;
    text += `${this.emojis.info} ${message}`;

    const buttons = [
      [
        { text: `${this.emojis.add} 또 추가하기`, action: "add" },
        { text: `${this.emojis.todo} 목록 보기`, action: "list" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });

    // 성공 후 자동으로 목록으로 이동 (3초 후)
    setTimeout(async () => {
      try {
        const listResult = {
          type: "list",
          data: await this.getTodoListData(ctx),
        };
        await this.render(listResult, ctx);
      } catch (error) {
        this.warn("자동 목록 업데이트 실패", error);
      }
    }, 3000);
  }

  /**
   * 🔄 토글 성공 렌더링
   */
  async renderToggleSuccess(data, ctx) {
    this.debug("토글 성공 렌더링", { completed: data.completed });

    const { todo, completed, message } = data;
    const statusEmoji = completed ? this.emojis.completed : this.emojis.pending;
    const statusText = completed ? "완료" : "미완료";

    let text = `${statusEmoji} **할일 ${statusText}\\!**\n\n`;
    text += `📝 "${todo.text}"\n\n`;
    text += `${this.emojis.success} ${message}`;

    const buttons = [
      [
        { text: `${this.emojis.todo} 목록 보기`, action: "list" },
        { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });

    // 성공 후 자동으로 목록으로 이동 (2초 후)
    setTimeout(async () => {
      try {
        const listResult = {
          type: "list",
          data: await this.getTodoListData(ctx),
        };
        await this.render(listResult, ctx);
      } catch (error) {
        this.warn("자동 목록 업데이트 실패", error);
      }
    }, 2000);
  }

  /**
   * 🗑️ 삭제 성공 렌더링
   */
  async renderDeleteSuccess(data, ctx) {
    this.debug("삭제 성공 렌더링");

    const { deletedTodo, message } = data;

    let text = `${this.emojis.success} **할일 삭제 완료\\!**\n\n`;
    text += `🗑️ "${deletedTodo.text}" 삭제됨\n\n`;
    text += `${this.emojis.success} ${message}`;

    const buttons = [
      [
        { text: `${this.emojis.todo} 목록 보기`, action: "list" },
        { text: `${this.emojis.add} 새 할일`, action: "add" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });

    // 성공 후 자동으로 목록으로 이동 (2초 후)
    setTimeout(async () => {
      try {
        const listResult = {
          type: "list",
          data: await this.getTodoListData(ctx),
        };
        await this.render(listResult, ctx);
      } catch (error) {
        this.warn("자동 목록 업데이트 실패", error);
      }
    }, 2000);
  }

  // ===== 💬 입력 및 상태 렌더링 =====

  /**
   * 💬 입력 프롬프트 렌더링
   */
  async renderInputPrompt(data, ctx) {
    this.debug("입력 프롬프트 렌더링", { action: data.action });

    const { action, prompt, maxLength, currentCount, maxCount } = data;

    let text = `${this.emojis.add} **새 할일 입력**\n\n`;
    text += `💬 ${prompt}\n\n`;

    if (maxLength) {
      text += `📝 최대 ${maxLength}자까지 입력 가능\n`;
    }

    if (currentCount !== undefined && maxCount) {
      text += `📊 현재 ${currentCount}/${maxCount}개\n`;
    }

    text += "\n💡 메시지로 할일을 입력해주세요\\!";

    const buttons = [
      [
        { text: "❌ 취소", action: "list" },
        { text: `${this.emojis.help} 도움말`, action: "help" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⚠️ 한계 초과 렌더링
   */
  async renderLimitExceeded(data, ctx) {
    this.debug("한계 초과 렌더링");

    const { currentCount, maxCount, message } = data;

    let text = `${this.emojis.warning} **할일 개수 제한**\n\n`;
    text += `📊 현재: ${currentCount}/${maxCount}개\n\n`;
    text += `${this.emojis.info} ${message}\n\n`;
    text += "💡 **해결 방법**:\n";
    text += "• 완료된 할일 삭제\n";
    text += "• 불필요한 할일 정리\n";
    text += "• 우선순위 높은 것부터 처리";

    const buttons = [
      [
        {
          text: `${this.emojis.completed} 완료된 항목`,
          action: "filter",
          params: "completed",
        },
        { text: `${this.emojis.delete} 정리하기`, action: "list" },
      ],
      [
        { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📊 통계 및 정보 렌더링 =====

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    this.debug("통계 렌더링", { hasStats: !!data?.stats });

    const { stats, userName } = data;

    let text = `${this.emojis.stats} **할일 통계 \\- ${userName}**\n\n`;

    if (stats) {
      text += `📋 **전체 현황**\n`;
      text += `• 총 할일: ${stats.total}개\n`;
      text += `• ${this.emojis.completed} 완료: ${stats.completed}개\n`;
      text += `• ${this.emojis.pending} 진행중: ${stats.pending}개\n`;

      if (stats.overdue > 0) {
        text += `• ${this.emojis.overdue} 지연: ${stats.overdue}개\n`;
      }

      text += `\n📈 **완료율**: ${stats.completionRate}%\n`;

      if (stats.productivity) {
        text += `🏆 **생산성**: ${stats.productivity}\n`;
      }

      if (stats.streak > 0) {
        text += `🔥 **연속 완료**: ${stats.streak}일\n`;
      }

      // 성취 레벨
      text += "\n" + this.getProductivityLevel(stats);
    } else {
      text += "아직 통계가 없습니다\\.\n";
      text += "할일을 추가하고 완료해보세요\\! 📈";
    }

    const buttons = [
      [
        { text: `${this.emojis.todo} 할일 목록`, action: "list" },
        { text: `${this.emojis.add} 새 할일`, action: "add" },
      ],
      [
        { text: "📜 히스토리", action: "history" },
        { text: `${this.emojis.filter} 필터`, action: "filter" },
      ],
      [this.createBackButton(this.moduleName), this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🔍 검색 결과 렌더링
   */
  async renderSearchResults(data, ctx) {
    this.debug("검색 결과 렌더링", { resultCount: data?.results?.length });

    const { results, query, userName } = data;

    let text = `${this.emojis.search} **검색 결과**\n\n`;
    text += `🔎 검색어: "${query}"\n`;
    text += `📊 결과: ${results.length}개\n\n`;

    if (results.length > 0) {
      text += this.formatTodoItems(results);
    } else {
      text += `${this.emojis.info} 검색 결과가 없습니다\\.\n`;
      text += "다른 키워드로 검색해보세요\\!";
    }

    const buttons = [
      [
        { text: `${this.emojis.search} 다시 검색`, action: "search" },
        { text: `${this.emojis.todo} 전체 목록`, action: "list" },
      ],
      [
        { text: `${this.emojis.add} 새 할일`, action: "add" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🎭 빈 상태 렌더링
   */
  async renderEmptyState(data, ctx) {
    this.debug("빈 상태 렌더링");

    const { userName } = data;

    let text = `${this.emojis.info} **할일이 없어요\\!**\n\n`;
    text += `👋 안녕하세요, ${userName}님\\!\n`;
    text += `첫 번째 할일을 추가해보세요\\.\n\n`;
    text += "💡 **시작 가이드**:\n";
    text += "• ➕ 새 할일 추가하기\n";
    text += "• 📝 간단하고 구체적으로 작성\n";
    text += "• ✅ 완료하면 체크하기\n";
    text += "• 📊 통계로 성장 확인하기";

    const buttons = [
      [{ text: `${this.emojis.add} 첫 할일 추가`, action: "add" }],
      [
        { text: `${this.emojis.help} 사용법`, action: "help" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ❓ 도움말 렌더링 =====

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("도움말 렌더링");

    let text = `${this.emojis.help} **할일 관리 사용법**\n\n`;
    text += `${this.emojis.todo} **두목봇과 함께하는 효율적인 할일 관리\\!**\n\n`;

    text += "📱 **기본 기능**\n";
    text += `• ${this.emojis.add} **할일 추가** \\- 새로운 할일 등록\n`;
    text += `• ${this.emojis.completed} **완료 체크** \\- 할일 완료 표시\n`;
    text += `• ${this.emojis.delete} **할일 삭제** \\- 불필요한 할일 제거\n`;
    text += `• ${this.emojis.filter} **필터링** \\- 상태별 할일 보기\n\n`;

    text += "🎯 **효율적인 사용 팁**\n";
    text += "• 할일은 구체적이고 실행 가능하게 작성\n";
    text += "• 너무 큰 할일은 작은 단위로 나누기\n";
    text += "• 우선순위를 정해서 중요한 것부터\n";
    text += "• 완료된 할일은 정기적으로 정리\n\n";

    text += "📊 **통계 활용**\n";
    text += "• 완료율로 생산성 확인\n";
    text += "• 연속 완료 기록으로 동기부여\n";
    text += "• 월별/주별 통계로 패턴 파악\n\n";

    text += "✨ **두목봇과 함께 목표를 달성해보세요\\!**";

    const buttons = [
      [
        { text: `${this.emojis.add} 첫 할일 추가`, action: "add" },
        { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
      ],
      [
        { text: `${this.emojis.todo} 할일 목록`, action: "list" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎨 포맷팅 헬퍼 메서드들 =====

  /**
   * 📊 할일 통계 포맷팅
   */
  formatTodoStats(stats) {
    let text = "📊 **현재 상황**\n";
    text += `• 전체: ${stats.total}개`;

    if (stats.pending > 0) {
      text += ` | ${this.emojis.pending} ${stats.pending}개`;
    }

    if (stats.completed > 0) {
      text += ` | ${this.emojis.completed} ${stats.completed}개`;
    }

    if (stats.overdue > 0) {
      text += ` | ${this.emojis.overdue} ${stats.overdue}개`;
    }

    if (stats.completionRate !== undefined) {
      text += `\n• 완료율: ${stats.completionRate}%`;
    }

    return text;
  }

  /**
   * 📝 할일 항목들 포맷팅
   */
  formatTodoItems(todos) {
    let text = "📝 **할일 목록**\n";

    todos.forEach((todo, index) => {
      const statusEmoji = todo.completed
        ? this.emojis.completed
        : this.emojis.pending;
      const priorityStyle =
        this.priorityStyles[todo.priority] || this.priorityStyles[3];

      text += `\n${statusEmoji} ${todo.text}`;

      // 우선순위 표시 (보통이 아닌 경우만)
      if (todo.priority && todo.priority !== 3) {
        text += ` ${priorityStyle.emoji}`;
      }

      // 마감일 표시
      if (todo.dueDate) {
        const dueText = TimeHelper.format(todo.dueDate, "short");
        text += ` ${this.emojis.calendar} ${dueText}`;
      }
    });

    return text;
  }

  /**
   * 📭 빈 할일 목록 포맷팅
   */
  formatEmptyTodoList() {
    return `${this.emojis.info} 할일이 없습니다\\.\n새로운 할일을 추가해보세요\\! ${this.emojis.add}`;
  }

  /**
   * 🏆 생산성 레벨 표시
   */
  getProductivityLevel(stats) {
    const completionRate = stats.completionRate || 0;

    if (completionRate >= 90) {
      return "🏆 **마스터 레벨**\\! 완벽한 실행력입니다\\!";
    } else if (completionRate >= 75) {
      return "🥇 **전문가 레벨**\\! 훌륭한 관리 능력이에요\\!";
    } else if (completionRate >= 60) {
      return "🥈 **숙련자 레벨**\\! 꾸준히 발전하고 있어요\\!";
    } else if (completionRate >= 40) {
      return "🥉 **초보자 레벨**\\! 좋은 시작이에요\\!";
    } else {
      return "🌱 **새싹 레벨**\\! 조금씩 습관을 만들어가요\\!";
    }
  }

  // ===== ⌨️ 복잡한 키보드 생성 메서드들 =====

  /**
   * 📋 할일 목록 키보드 생성 (CRUD 파서 규칙 적용)
   */
  createTodoListKeyboard(todos, pagination, stats) {
    const buttons = [];

    // 첫 번째 줄: 주요 액션들
    buttons.push([
      { text: `${this.emojis.add} 새 할일`, action: "add" },
      { text: `${this.emojis.stats} 통계`, action: "stats" },
    ]);

    // 두 번째 줄: 필터링 옵션들
    buttons.push([
      {
        text: `${this.emojis.pending} 진행중만`,
        action: "filter",
        params: "pending",
      },
      {
        text: `${this.emojis.completed} 완료만`,
        action: "filter",
        params: "completed",
      },
    ]);

    // 할일별 개별 액션들 (최대 5개까지만 표시)
    if (todos && todos.length > 0) {
      const visibleTodos = todos.slice(0, 5);

      visibleTodos.forEach((todo) => {
        const row = [];

        // 토글 버튼
        const toggleText = todo.completed ? "❌ 미완료" : "✅ 완료";
        row.push({
          text: toggleText,
          action: "toggle",
          params: todo._id || todo.id,
        });

        // 삭제 버튼
        row.push({
          text: `🗑️ 삭제`,
          action: "delete",
          params: todo._id || todo.id,
        });

        buttons.push(row);
      });
    }

    // 페이지네이션 (필요한 경우)
    if (pagination && pagination.totalPages > 1) {
      const paginationRow = this.createPaginationButtons(
        pagination.currentPage,
        pagination.totalPages,
        this.moduleName,
        "list"
      );

      if (paginationRow.length > 0) {
        buttons.push(...paginationRow);
      }
    }

    // 하단 네비게이션
    buttons.push([
      { text: `${this.emojis.search} 검색`, action: "search" },
      { text: `${this.emojis.help} 도움말`, action: "help" },
    ]);

    buttons.push([this.createHomeButton()]);

    return this.createInlineKeyboard(buttons, this.moduleName);
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 📋 할일 목록 데이터 가져오기 (자동 업데이트용)
   */
  async getTodoListData(ctx) {
    // 실제 구현에서는 ModuleManager나 Service를 통해 데이터를 가져와야 함
    // 여기서는 구조만 보여주는 예시
    return {
      todos: [],
      stats: { total: 0, completed: 0, pending: 0, completionRate: 0 },
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0 },
      userName: getUserName(ctx.from || ctx.callbackQuery?.from),
    };
  }

  /**
   * 🔄 실시간 상태 업데이트 (WebSocket 스타일)
   */
  async triggerRealTimeUpdate(ctx, updateType, data) {
    if (this.config.animateStateChanges) {
      try {
        // 상태 변경 애니메이션이나 실시간 업데이트 로직
        this.debug(`실시간 업데이트 트리거: ${updateType}`, data);
      } catch (error) {
        this.warn("실시간 업데이트 실패", error);
      }
    }
  }

  // ===== 🧪 레거시 호환성 메서드들 =====

  /**
   * 📤 레거시 메시지 전송 (호환성 유지)
   * @deprecated BaseRenderer.sendSafeMessage 사용 권장
   */
  async sendMessage(chatId, text, keyboard, messageId) {
    try {
      const options = {
        reply_markup: keyboard,
        parse_mode: this.config.defaultParseMode,
      };

      if (messageId) {
        return await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        return await this.bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      this.warn("레거시 메시지 전송 실패, 안전 모드로 전환", error);

      // 안전한 전송으로 폴백
      const ctx = {
        chat: { id: chatId },
        callbackQuery: messageId
          ? { message: { message_id: messageId } }
          : null,
      };

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }
  }
}

module.exports = TodoRenderer;
