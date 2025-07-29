// src/renderers/TodoRenderer.js - 🎯 단순하고 직관적인 할일 UI
const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 📋 TodoRenderer - 단순하고 재미있는 할일 관리 UI
 *
 * 🎯 핵심 기능:
 * - 할일 목록 (진행중/완료 구분)
 * - 원터치 완료/삭제
 * - 간단한 통계
 * - 도움말
 *
 * ✅ UI 원칙:
 * - 복잡한 메뉴 없이 바로바로 액션
 * - 이모지로 직관적 표현
 * - MarkdownV2 완벽 이스케이프
 * - 사용자 친화적 디자인
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

    logger.debug(`📋 TodoRenderer: ${type} 타입 렌더링`);

    try {
      switch (type) {
        case "menu":
        case "list":
          return await this.renderTodoList(data, ctx);

        case "add_prompt_with_reminder": // 🔔 리마인더 옵션 포함
          return await this.renderAddPromptWithReminder(data, ctx);

        case "add_prompt":
          return await this.renderAddPrompt(data, ctx);

        case "reminder_time_prompt": // 🔔 리마인더 시간 입력
          return await this.renderReminderTimePrompt(data, ctx);

        case "stats":
          return await this.renderSimpleStats(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "error":
          return await this.renderError(
            data.message || "알 수 없는 오류가 발생했습니다",
            ctx
          );

        default:
          logger.warn(`📋 TodoRenderer: 지원하지 않는 타입 - ${type}`);
          return await this.renderError("지원하지 않는 기능입니다", ctx);
      }
    } catch (error) {
      logger.error(`📋 TodoRenderer 렌더링 오류 (${type}):`, error);
      return await this.renderError("렌더링 중 오류가 발생했습니다", ctx);
    }
  }

  /**
   * 📋 할일 목록 렌더링 (메인 화면)
   */
  async renderTodoList(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);
    const todos = data?.todos || [];
    const stats = data?.stats || {};

    logger.debug(`📋 할일 목록 렌더링 (${todos.length}개)`);

    let text = "📋 *할일 관리*\n\n";

    // 두목봇 인사
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "todoWelcome",
      userName
    );
    if (welcomeMessage) {
      text += `${this.escapeMarkdownV2(welcomeMessage)}\n\n`;
    }

    // 📊 간단한 통계 (완료율만)
    if (stats.total > 0) {
      const completionRate = stats.completionRate || 0;
      const progressBar = this.createProgressBar(completionRate);

      text += `📊 *진행률*: ${stats.completed}/${stats.total} \\(${completionRate}%\\)\n`;
      text += `${progressBar}\n\n`;
    }

    // 📝 할일 목록
    if (todos.length === 0) {
      text += "🎯 *할일이 없습니다\\!*\n";
      text += "새로운 할일을 추가해서 생산적인 하루를 시작해보세요\\.\n\n";
      text += "💡 *팁*: 작은 목표부터 시작하세요\\!";
    } else {
      // 진행중인 할일 먼저 표시
      const pendingTodos = todos.filter((todo) => !todo.completed);
      const completedTodos = todos.filter((todo) => todo.completed);

      // ⭕ 진행중인 할일 - 세련된 스타일
      if (pendingTodos.length > 0) {
        text += "🎯 *진행중인 할일*:\n";
        pendingTodos.slice(0, 8).forEach((todo) => {
          const todoText = this.escapeMarkdownV2(
            this.truncateText(todo.text, 30)
          );
          text += `⬜ ${todoText}\n`;
        });

        if (pendingTodos.length > 8) {
          text += `⬜ \\.\\.\\. 외 ${pendingTodos.length - 8}개 더\n`;
        }
        text += "\n";
      }

      // ✅ 완료된 할일 (최대 3개만) - 세련된 스타일
      if (completedTodos.length > 0) {
        text += "🏆 *완료된 할일*:\n";
        completedTodos.slice(0, 3).forEach((todo) => {
          const todoText = this.escapeMarkdownV2(
            this.truncateText(todo.text, 30)
          );
          text += `✅ ~${todoText}~\n`;
        });

        if (completedTodos.length > 3) {
          text += `✅ \\.\\.\\. 외 ${completedTodos.length - 3}개 더\n`;
        }
      }
    }

    // 🎹 버튼 구성 - 단순하고 직관적으로!
    const keyboard = { inline_keyboard: [] };

    // 첫 번째 줄: 핵심 액션
    keyboard.inline_keyboard.push([
      { text: "➕ 새 할일", callback_data: "todo:add" },
      { text: "📊 통계", callback_data: "todo:stats" },
    ]);

    // 할일이 있을 때만 액션 버튼들 표시
    if (todos.length > 0) {
      // 진행중인 할일 완료 버튼들 (최대 4개)
      const pendingTodos = todos.filter((todo) => !todo.completed);
      if (pendingTodos.length > 0) {
        const todoButtons = [];
        pendingTodos.slice(0, 4).forEach((todo) => {
          const buttonText = `✅ ${this.truncateText(todo.text, 12)}`;
          todoButtons.push({
            text: buttonText,
            callback_data: `todo:toggle:${todo.id}`,
          });
        });

        // 2개씩 나누어서 배치
        for (let i = 0; i < todoButtons.length; i += 2) {
          const row = todoButtons.slice(i, i + 2);
          keyboard.inline_keyboard.push(row);
        }
      }

      // 삭제 버튼들 (최대 4개)
      const allTodos = todos.slice(0, 4);
      if (allTodos.length > 0) {
        const deleteButtons = [];
        allTodos.forEach((todo) => {
          const buttonText = `🗑️ ${this.truncateText(todo.text, 12)}`;
          deleteButtons.push({
            text: buttonText,
            callback_data: `todo:delete:${todo.id}`,
          });
        });

        // 2개씩 나누어서 배치
        for (let i = 0; i < deleteButtons.length; i += 2) {
          const row = deleteButtons.slice(i, i + 2);
          keyboard.inline_keyboard.push(row);
        }
      }
    }

    // 마지막 줄: 네비게이션
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
   * ➕ 할일 추가 프롬프트 (리마인더 옵션 포함)
   */
  async renderAddPromptWithReminder(data, ctx) {
    let text = "➕ *새 할일 추가*\n\n";
    text += "🎯 어떤 일을 하시겠어요\\?\n\n";
    text += "💡 *간단하게 입력하세요*:\n";
    text += "✨ `회의 자료 준비`\n";
    text += "✨ `운동하기`\n";
    text += "✨ `책 읽기`\n\n";
    text += "🔔 *추가 후 리마인더 설정도 가능해요\\!*\n\n";
    text += "📝 할일을 입력해주세요\\:";

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
   * 🔔 리마인더 시간 입력 프롬프트 (고급 파싱 지원)
   */
  async renderReminderTimePrompt(data, ctx) {
    const todoText = data?.todoText || "할일";

    let text = "⏰ *리마인더 시간 설정*\n\n";
    text += `📝 할일: ${this.escapeMarkdownV2(todoText)}\n\n`;
    text += "🔔 언제 알림을 받으시겠어요\\?\n\n";

    text += "🧠 *자연어로 편리하게 입력하세요\\!*\n\n";

    text += "⏰ *시간 표현*:\n";
    text += "✨ `30분 후`, `2시간 후`, `3일 후`\n";
    text += "✨ `오후 3시`, `내일 9시`, `모레 2시`\n";
    text += "✨ `점심시간`, `저녁시간`, `출근시간`\n\n";

    text += "📅 *요일 표현*:\n";
    text += "✨ `월요일 10시`, `금요일 오후 2시`\n";
    text += "✨ `다음주 화요일`, `주말에`\n\n";

    text += "🎯 *특별한 표현*:\n";
    text += "✨ `회의시간`, `마감일`, `새벽`, `자정`\n";
    text += "✨ `크리스마스`, `설날`, `어린이날`\n\n";

    text += "💡 *예시*:\n";
    text += "• `내일 오전 9시 회의 전에`\n";
    text += "• `금요일 오후 5시 퇴근 전`\n";
    text += "• `다음주 월요일 점심시간`\n\n";

    text += "⌨️ 원하는 시간을 자연스럽게 입력해주세요\\:";

    const keyboard = {
      inline_keyboard: [
        // 첫 번째 줄: 빠른 선택
        [
          { text: "⏰ 30분 후", callback_data: "todo:quick_reminder:30m" },
          { text: "⏰ 1시간 후", callback_data: "todo:quick_reminder:1h" },
        ],
        // 두 번째 줄: 오늘 시간
        [
          { text: "🌅 점심시간", callback_data: "todo:quick_reminder:lunch" },
          { text: "🌆 저녁시간", callback_data: "todo:quick_reminder:dinner" },
        ],
        // 세 번째 줄: 내일
        [
          {
            text: "🌅 내일 아침 9시",
            callback_data: "todo:quick_reminder:tomorrow_9",
          },
          {
            text: "🌆 내일 저녁 7시",
            callback_data: "todo:quick_reminder:tomorrow_19",
          },
        ],
        // 네 번째 줄: 요일
        [
          {
            text: "📅 월요일 오전",
            callback_data: "todo:quick_reminder:monday_am",
          },
          {
            text: "📅 금요일 오후",
            callback_data: "todo:quick_reminder:friday_pm",
          },
        ],
        // 다섯 번째 줄: 액션
        [
          { text: "➕ 바로 추가", callback_data: "todo:skip_reminder" },
          { text: "❌ 취소", callback_data: "todo:menu" },
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

  /**
   * 📊 간단한 통계 화면
   */
  async renderSimpleStats(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);
    const stats = data?.stats || {};

    let text = "📊 *할일 관리 통계*\n\n";
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n\n`;

    if (stats.total === 0) {
      text += "🎯 *아직 할일이 없습니다*\n";
      text += "새로운 할일을 추가해서 생산적인 하루를 시작해보세요\\!\n\n";

      const motivationalMessage = DoomockMessageGenerator.getContextualMessage(
        "todoMotivation",
        userName
      );
      if (motivationalMessage) {
        text += `💪 ${this.escapeMarkdownV2(motivationalMessage)}`;
      }
    } else {
      // 기본 통계 - 세련된 체크박스 스타일
      text += "📈 *전체 현황*:\n";
      text += `☑️ 총 할일: *${this.escapeMarkdownV2(String(stats.total))}*개\n`;
      text += `✅ 완료: *${this.escapeMarkdownV2(
        String(stats.completed)
      )}*개\n`;
      text += `⏳ 진행중: *${this.escapeMarkdownV2(
        String(stats.pending)
      )}*개\n`;
      text += `📊 완료율: *${this.escapeMarkdownV2(
        String(stats.completionRate)
      )}*%\n\n`;

      // 진행률 막대
      const progressBar = this.createProgressBar(stats.completionRate);
      text += `📊 ${progressBar}\n\n`;

      // 격려 메시지
      if (stats.completionRate >= 80) {
        text += "🎉 *훌륭합니다\\!* 거의 다 완료하셨네요\\!";
      } else if (stats.completionRate >= 50) {
        text += "💪 *잘하고 계십니다\\!* 조금만 더 힘내세요\\!";
      } else if (stats.completionRate >= 20) {
        text += "🔥 *시작이 반입니다\\!* 계속 진행해보세요\\!";
      } else {
        text += "🎯 *새로운 시작\\!* 작은 할일부터 차근차근\\!";
      }
    }

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
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * ❓ 도움말 화면
   */
  async renderHelp(data, ctx) {
    let text = "❓ *할일 관리 도움말*\n\n";

    text += "🎯 *기본 사용법*:\n";
    text += "☑️ `➕ 새 할일` \\- 할일 추가\n";
    text += "☑️ `✅ 할일명` \\- 완료 처리\n";
    text += "☑️ `🗑️ 할일명` \\- 삭제\n";
    text += "☑️ `📊 통계` \\- 완료율 확인\n\n";

    text += "🔔 *리마인더 기능*:\n";
    text += "⚡ 할일 추가 시 알림 시간 설정 가능\n";
    text += "⚡ 설정된 시간에 텔레그램 메시지 발송\n";
    text += "⚡ `30분 후`, `오후 3시`, `내일 9시` 등 자연어 지원\n\n";

    text += "💡 *효율적인 사용 팁*:\n";
    text += "✨ 큰 일을 작은 단위로 나누세요\n";
    text += "✨ 간단한 할일부터 시작하세요\n";
    text += "✨ 완료하면 바로 체크하세요\n";
    text += "✨ 중요한 할일엔 리마인더를 설정하세요\n\n";

    text += "🚀 *명령어*:\n";
    text += "⚡ `/todo` 또는 `할일` \\- 메뉴 열기\n";
    text += "⚡ 메뉴에서 할일 입력하고 엔터\n\n";

    text += "🤖 *두목봇과 함께*:\n";
    text += "단순하고 재미있게 할일을 관리하세요\\!\n";
    text += "리마인더로 중요한 할일을 놓치지 마세요\\! 🔔";

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
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
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

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 진행률 막대 생성
   */
  createProgressBar(percentage) {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    const filled = "🟩".repeat(filledBars);
    const empty = "⬜".repeat(emptyBars);

    return `${filled}${empty} ${percentage}%`;
  }

  /**
   * 텍스트 자르기
   */
  truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  /**
   * 우선순위 아이콘 (향후 확장용)
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
}

module.exports = TodoRenderer;
