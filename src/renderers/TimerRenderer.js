// src/renderers/TimerRenderer.js - 뽀모도로 타이머 UI 렌더러

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🍅 TimerRenderer - 뽀모도로 타이머 UI 렌더링
 *
 * 🎯 책임:
 * - 뽀모도로 관련 모든 UI 생성
 * - 메시지 포맷팅
 * - 인라인 키보드 생성
 * - 진행 상황 시각화
 *
 * ✅ SoC: UI 렌더링만 담당, 비즈니스 로직은 다루지 않음
 */
class TimerRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "timer";

    // 이모지 설정
    this.emojis = {
      focus: "🍅",
      shortBreak: "☕",
      longBreak: "🌴",
      active: "▶️",
      paused: "⏸️",
      completed: "✅",
      stopped: "⏹️",
      clock: "⏰",
      stats: "📊",
      settings: "⚙️",
      help: "❓",
    };

    // 진행바 설정
    this.progressBarLength = 10;
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    try {
      switch (type) {
        case "menu":
          return await this.renderMenuResponse(data, ctx);

        case "timer_started":
          return await this.renderTimerStartedResponse(data, ctx);

        case "timer_paused":
          return await this.renderTimerPausedResponse(data, ctx);

        case "timer_resumed":
          return await this.renderTimerResumedResponse(data, ctx);

        case "timer_stopped":
          return await this.renderTimerStoppedResponse(data, ctx);

        case "status":
          return await this.renderStatusResponse(data, ctx);

        case "stats":
          return await this.renderStatsResponse(data, ctx);

        case "history":
          return await this.renderHistoryResponse(data, ctx);

        case "settings":
          return await this.renderSettingsResponse(data, ctx);

        case "help":
          return await this.renderHelpResponse(data, ctx);

        case "info":
          return await this.renderInfoResponse(data, ctx);

        case "error":
          return await this.renderErrorResponse(data, ctx);

        default:
          logger.warn(`알 수 없는 타이머 렌더링 타입: ${type}`);
          await this.renderErrorResponse(
            { message: "지원하지 않는 기능입니다." },
            ctx
          );
      }
    } catch (error) {
      logger.error("TimerRenderer 오류:", error);
      await this.renderErrorResponse({ message: error.message }, ctx);
    }
  }

  /**
   * 🛡️ 안전한 텍스트 포맷팅
   */
  formatText(text) {
    return this.escapeMarkdownV2(text);
  }

  /**
   * 📋 메인 메뉴 렌더링
   */
  async renderMenuResponse(data, ctx) {
    const rendered = this.renderMenu(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ▶️ 타이머 시작 응답 렌더링
   */
  async renderTimerStartedResponse(data, ctx) {
    const rendered = this.renderTimerStarted(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ⏸️ 타이머 일시정지 응답 렌더링
   */
  async renderTimerPausedResponse(data, ctx) {
    const rendered = this.renderTimerPaused(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ▶️ 타이머 재개 응답 렌더링
   */
  async renderTimerResumedResponse(data, ctx) {
    const rendered = this.renderTimerResumed(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ⏹️ 타이머 중지 응답 렌더링
   */
  async renderTimerStoppedResponse(data, ctx) {
    const rendered = this.renderTimerStopped(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * 📊 상태 응답 렌더링
   */
  async renderStatusResponse(data, ctx) {
    const rendered = this.renderStatus(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * 📈 통계 응답 렌더링
   */
  async renderStatsResponse(data, ctx) {
    const rendered = this.renderStats(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * 📜 히스토리 응답 렌더링
   */
  async renderHistoryResponse(data, ctx) {
    const rendered = this.renderHistory(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ⚙️ 설정 응답 렌더링
   */
  async renderSettingsResponse(data, ctx) {
    const rendered = this.renderSettings(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ❓ 도움말 응답 렌더링
   */
  async renderHelpResponse(data, ctx) {
    const rendered = this.renderHelp();

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ℹ️ 정보 메시지 응답 렌더링
   */
  async renderInfoResponse(data, ctx) {
    const rendered = this.renderInfo(data.message);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ❌ 에러 응답 렌더링
   */
  async renderErrorResponse(data, ctx) {
    const rendered = this.renderError(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }
  renderMenu(data) {
    const { activeTimer, stats, config } = data;
    let text = `${this.emojis.focus} *뽀모도로 타이머*\n\n`;

    // 활성 타이머가 있는 경우
    if (activeTimer) {
      text += this.renderActiveTimer(activeTimer);
      text += "\n\n";

      // 활성 타이머용 키보드
      return {
        text: this.escapeMarkdownV2(text),
        keyboard: this.createActiveTimerKeyboard(activeTimer),
      };
    }

    // 오늘의 통계
    if (stats) {
      text += `📅 *오늘의 기록*\n`;
      text += `• 완료한 집중: ${stats.focusCompleted}개\n`;
      text += `• 총 집중 시간: ${stats.totalMinutes}분\n`;
      text += `• 생산성: ${stats.productivityRate}%\n\n`;
    }

    text += `⏱️ *타이머 설정*\n`;
    text += `• 집중 시간: ${config.focusDuration}분\n`;
    text += `• 짧은 휴식: ${config.shortBreakDuration}분\n`;
    text += `• 긴 휴식: ${config.longBreakDuration}분\n`;

    return {
      text: this.escapeMarkdownV2(text),
      keyboard: this.createMenuKeyboard(),
    };
  }

  /**
   * ▶️ 타이머 시작 렌더링
   */
  renderTimerStarted(data) {
    const { session, remainingTime, type } = data;
    const emoji = this.emojis[type];
    const minutes = Math.floor(remainingTime / 60);

    let text = `${emoji} *${this.getSessionTypeName(type)} 시작\\!*\n\n`;
    text += `⏱️ 남은 시간: ${minutes}분\n`;
    text += this.renderProgressBar(session.duration * 60, remainingTime);
    text += "\n\n💪 집중해서 작업하세요\\!";

    return {
      text,
      keyboard: this.createActiveTimerKeyboard({ isPaused: false }),
    };
  }

  /**
   * ⏸️ 타이머 일시정지 렌더링
   */
  renderTimerPaused(data) {
    const { remainingTime } = data;
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    let text = `${this.emojis.paused} *타이머 일시정지*\n\n`;
    text += `⏱️ 남은 시간: ${minutes}분 ${seconds}초\n\n`;
    text += `타이머가 일시정지되었습니다.`;

    return {
      text,
      keyboard: this.createActiveTimerKeyboard({ isPaused: true }),
    };
  }

  /**
   * ▶️ 타이머 재개 렌더링
   */
  renderTimerResumed(data) {
    const { remainingTime } = data;
    const minutes = Math.floor(remainingTime / 60);

    let text = `${this.emojis.active} *타이머 재개*\n\n`;
    text += `⏱️ 남은 시간: ${minutes}분\n\n`;
    text += `다시 집중해봅시다\\! 💪`;

    return {
      text,
      keyboard: this.createActiveTimerKeyboard({ isPaused: false }),
    };
  }

  /**
   * ⏹️ 타이머 중지 렌더링
   */
  renderTimerStopped(data) {
    const { summary } = data;

    let text = `${this.emojis.stopped} *타이머 중지*\n\n`;

    if (summary && summary.completedPercentage) {
      text += `진행률: ${summary.completedPercentage}%\n\n`;

      if (summary.completedPercentage >= 80) {
        text += `거의 다 했네요\\! 다음엔 끝까지 해보세요 👍`;
      } else if (summary.completedPercentage >= 50) {
        text += `절반 이상 진행했네요\\! 수고하셨습니다 😊`;
      } else {
        text += `다음엔 더 집중해보세요\\! 화이팅 💪`;
      }
    }

    return {
      text,
      keyboard: this.createMenuKeyboard(),
    };
  }

  /**
   * 📊 현재 상태 렌더링
   */
  renderStatus(data) {
    const { activeTimer, currentSession, todayStats } = data;

    let text = `${this.emojis.clock} *현재 상태*\n\n`;

    // 활성 타이머 정보
    if (activeTimer && currentSession) {
      text += `🔴 *진행 중인 세션*\n`;
      text += `• 타입: ${this.getSessionTypeName(currentSession.type)}\n`;
      text += `• 남은 시간: ${Math.floor(activeTimer.remainingTime / 60)}분 ${
        activeTimer.remainingTime % 60
      }초\n`;
      text += `• 상태: ${activeTimer.isPaused ? "일시정지" : "진행중"}\n`;
      text += this.renderProgressBar(
        activeTimer.duration,
        activeTimer.remainingTime
      );
      text += "\n\n";
    } else {
      text += `✨ 진행 중인 타이머가 없습니다.\n\n`;
    }

    // 오늘의 통계
    text += `📊 *오늘의 통계*\n`;
    text += `• 완료한 집중: ${todayStats.focusCompleted}개\n`;
    text += `• 총 집중 시간: ${todayStats.totalMinutes}분\n`;
    text += `• 시작한 세션: ${todayStats.totalStarted}개\n`;
    text += `• 중단한 세션: ${todayStats.totalStopped}개\n`;
    text += `• 생산성: ${todayStats.productivityRate}%`;

    return {
      text,
      keyboard: activeTimer
        ? this.createActiveTimerKeyboard(activeTimer)
        : this.createMenuKeyboard(),
    };
  }

  /**
   * 📈 통계 렌더링
   */
  renderStats(data) {
    const { period, stats } = data;
    const periodName = this.getPeriodName(period);

    let text = `${this.emojis.stats} *${periodName} 통계*\n\n`;

    if (!stats || stats.totalDays === 0) {
      text += `아직 ${periodName} 기록이 없습니다.`;
      return { text, keyboard: this.createStatsKeyboard(period) };
    }

    // 요약 통계
    text += `📊 *전체 요약*\n`;
    text += `• 기간: ${stats.startDate} ~ ${stats.endDate}\n`;
    text += `• 활동일: ${stats.totalDays}일\n`;
    text += `• 총 세션: ${stats.totalSessions}개\n`;
    text += `• 총 시간: ${Math.floor(stats.totalMinutes / 60)}시간 ${
      stats.totalMinutes % 60
    }분\n`;
    text += `• 일 평균: ${stats.avgSessionsPerDay}개 (${stats.avgMinutesPerDay}분)\n\n`;

    // 최고 기록
    if (stats.bestDay) {
      text += `🏆 *최고 기록일*\n`;
      text += `• 날짜: ${stats.bestDay.date}\n`;
      text += `• 완료 세션: ${stats.bestDay.totalCompleted}개\n`;
      text += `• 집중 시간: ${stats.bestDay.totalMinutes}분\n\n`;
    }

    // 주간 차트 (최근 7일)
    if (period === "week" && stats.dailyStats.length > 0) {
      text += `📈 *일별 추이*\n`;
      stats.dailyStats
        .slice(0, 7)
        .reverse()
        .forEach((day) => {
          const bar = this.createSimpleBar(day.totalCompleted, 10);
          text += `${day.date.slice(5, 10)}: ${bar} ${day.totalCompleted}\n`;
        });
    }

    return {
      text,
      keyboard: this.createStatsKeyboard(period),
    };
  }

  /**
   * 📜 히스토리 렌더링
   */
  renderHistory(data) {
    const { sessions, total, hasMore } = data;

    let text = `📜 *세션 히스토리*\n\n`;

    if (sessions.length === 0) {
      text += `아직 완료한 세션이 없습니다.`;
      return { text, keyboard: this.createBackKeyboard() };
    }

    text += `총 ${total}개의 세션\n\n`;

    sessions.forEach((session, index) => {
      const emoji = this.emojis[session.type];
      const status = session.status === "completed" ? "✅" : "⏹️";
      const date = TimeHelper.format(session.completedAt, "MM/DD HH:mm");

      text += `${index + 1}. ${emoji} ${status} ${date}\n`;

      if (session.status === "completed") {
        text += `   ${session.duration}분 완료\n`;
      } else {
        const percentage = Math.round(
          (session.completedDuration / (session.duration * 60)) * 100
        );
        text += `   ${percentage}% 진행\n`;
      }

      if (session.note) {
        text += `   📝 ${session.note}\n`;
      }

      text += "\n";
    });

    if (hasMore) {
      text += `\n... 더 많은 기록이 있습니다`;
    }

    return {
      text,
      keyboard: this.createHistoryKeyboard(hasMore),
    };
  }

  /**
   * ⚙️ 설정 렌더링
   */
  renderSettings(data) {
    const { settings } = data;

    let text = `${this.emojis.settings} *뽀모도로 설정*\n\n`;

    text += `⏱️ *시간 설정*\n`;
    text += `• 집중 시간: ${settings.focusDuration}분\n`;
    text += `• 짧은 휴식: ${settings.shortBreakDuration}분\n`;
    text += `• 긴 휴식: ${settings.longBreakDuration}분\n`;
    text += `• 긴 휴식 주기: ${settings.sessionsBeforeLongBreak}회\n\n`;

    text += `🔔 *알림 설정*\n`;
    text += `• 완료 알림: ${settings.enableNotifications ? "켜짐" : "꺼짐"}\n`;
    text += `• 자동 휴식 시작: ${
      settings.autoStartBreak ? "켜짐" : "꺼짐"
    }\n\n`;

    text += `🎯 *목표 설정*\n`;
    text += `• 일일 목표: ${settings.dailyGoal}개 세션`;

    return {
      text,
      keyboard: this.createSettingsKeyboard(settings),
    };
  }

  /**
   * ❓ 도움말 렌더링
   */
  renderHelp() {
    let text = `${this.emojis.help} *뽀모도로 타이머 도움말*\n\n`;

    text += `🍅 *뽀모도로 기법이란?*\n`;
    text += `25분 집중 + 5분 휴식을 반복하는 시간 관리 기법입니다.\n`;
    text += `4회 반복 후에는 15-30분의 긴 휴식을 가집니다.\n\n`;

    text += `📱 *사용 방법*\n`;
    text += `1. "시작" 버튼으로 타이머 시작\n`;
    text += `2. 25분 동안 한 가지 일에 집중\n`;
    text += `3. 타이머가 울리면 5분 휴식\n`;
    text += `4. 4회 반복 후 긴 휴식\n\n`;

    text += `💡 *팁*\n`;
    text += `• 타이머 중에는 다른 일 하지 않기\n`;
    text += `• 휴식 시간에는 완전히 쉬기\n`;
    text += `• 방해 요소를 미리 제거하기\n`;
    text += `• 매일 목표 세션 수 정하기\n\n`;

    text += `🔔 *명령어*\n`;
    text += `• "뽀모도로" - 메뉴 열기\n`;
    text += `• "타이머" - 메뉴 열기\n`;
    text += `• "집중" - 메뉴 열기`;

    return {
      text,
      keyboard: this.createBackKeyboard(),
    };
  }

  // ===== 🎨 UI 컴포넌트 =====

  /**
   * 🎨 활성 타이머 표시
   */
  renderActiveTimer(timer) {
    const emoji = this.emojis[timer.type];
    const statusEmoji = timer.isPaused
      ? this.emojis.paused
      : this.emojis.active;
    const minutes = Math.floor(timer.remainingTime / 60);
    const seconds = timer.remainingTime % 60;

    let text = `${statusEmoji} *진행 중인 타이머*\n`;
    text += `${emoji} ${this.getSessionTypeName(timer.type)}\n`;
    text += `⏱️ 남은 시간: ${minutes}분 ${seconds}초\n`;
    text += this.renderProgressBar(timer.duration, timer.remainingTime);

    return text;
  }

  /**
   * 🎨 진행바 렌더링
   */
  renderProgressBar(total, remaining) {
    const progress = (total - remaining) / total;
    const filled = Math.floor(progress * this.progressBarLength);
    const empty = this.progressBarLength - filled;

    let bar = "▓".repeat(filled) + "░".repeat(empty);
    const percentage = Math.round(progress * 100);

    return `\n[${bar}] ${percentage}%`;
  }

  /**
   * 🎨 간단한 막대 차트
   */
  createSimpleBar(value, maxValue) {
    const barLength = 10;
    const filled = Math.round((value / maxValue) * barLength);
    return "█".repeat(filled) + "░".repeat(barLength - filled);
  }

  // ===== ⌨️ 키보드 생성 =====

  /**
   * ⌨️ 메인 메뉴 키보드
   */
  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "▶️ 시작", callback_data: "timer:start" },
          { text: "📊 통계", callback_data: "timer:stats" },
        ],
        [
          { text: "📜 기록", callback_data: "timer:history" },
          { text: "⚙️ 설정", callback_data: "timer:settings" },
        ],
        [
          { text: "❓ 도움말", callback_data: "timer:help" },
          { text: "◀️ 뒤로", callback_data: "main_menu" },
        ],
      ],
    };
  }

  /**
   * ⌨️ 활성 타이머 키보드
   */
  createActiveTimerKeyboard(timer) {
    const buttons = [];

    if (timer.isPaused) {
      buttons.push([
        { text: "▶️ 재개", callback_data: "timer:resume" },
        { text: "⏹️ 종료", callback_data: "timer:stop" },
      ]);
    } else {
      buttons.push([
        { text: "⏸️ 일시정지", callback_data: "timer:pause" },
        { text: "⏹️ 종료", callback_data: "timer:stop" },
      ]);
    }

    buttons.push([
      { text: "⏭️ 건너뛰기", callback_data: "timer:skip" },
      { text: "📊 상태", callback_data: "timer:status" },
    ]);

    buttons.push([{ text: "◀️ 뒤로", callback_data: "timer:menu" }]);

    return { inline_keyboard: buttons };
  }

  /**
   * ⌨️ 통계 키보드
   */
  createStatsKeyboard(currentPeriod) {
    const periods = [
      { text: "오늘", value: "today" },
      { text: "이번주", value: "week" },
      { text: "이번달", value: "month" },
    ];

    const buttons = periods.map((p) => ({
      text: p.value === currentPeriod ? `• ${p.text} •` : p.text,
      callback_data: `timer:stats:${p.value}`,
    }));

    return {
      inline_keyboard: [
        buttons,
        [{ text: "◀️ 뒤로", callback_data: "timer:menu" }],
      ],
    };
  }

  /**
   * ⌨️ 설정 키보드
   */
  createSettingsKeyboard(settings) {
    return {
      inline_keyboard: [
        [
          { text: "⏱️ 집중 시간", callback_data: "timer:settings:focus" },
          { text: "☕ 휴식 시간", callback_data: "timer:settings:break" },
        ],
        [
          {
            text: settings.enableNotifications
              ? "🔔 알림 켜짐"
              : "🔕 알림 꺼짐",
            callback_data: "timer:settings:notifications",
          },
        ],
        [
          {
            text: settings.autoStartBreak
              ? "🔄 자동 휴식 켜짐"
              : "⏸️ 자동 휴식 꺼짐",
            callback_data: "timer:settings:autobreak",
          },
        ],
        [
          { text: "🎯 일일 목표", callback_data: "timer:settings:goal" },
          { text: "◀️ 뒤로", callback_data: "timer:menu" },
        ],
      ],
    };
  }

  /**
   * ⌨️ 히스토리 키보드
   */
  createHistoryKeyboard(hasMore) {
    const keyboard = [];

    if (hasMore) {
      keyboard.push([
        { text: "⬅️ 이전", callback_data: "timer:history:prev" },
        { text: "➡️ 다음", callback_data: "timer:history:next" },
      ]);
    }

    keyboard.push([{ text: "◀️ 뒤로", callback_data: "timer:menu" }]);

    return { inline_keyboard: keyboard };
  }

  /**
   * ⌨️ 뒤로가기 키보드
   */
  createBackKeyboard() {
    return {
      inline_keyboard: [[{ text: "◀️ 뒤로", callback_data: "timer:menu" }]],
    };
  }

  // ===== 🛠️ 헬퍼 메서드 =====

  /**
   * 세션 타입 이름 변환
   */
  getSessionTypeName(type) {
    const names = {
      focus: "집중 시간",
      shortBreak: "짧은 휴식",
      longBreak: "긴 휴식",
    };
    return names[type] || type;
  }

  /**
   * 기간 이름 변환
   */
  getPeriodName(period) {
    const names = {
      today: "오늘",
      week: "이번 주",
      month: "이번 달",
      year: "올해",
    };
    return names[period] || period;
  }

  /**
   * 시간 포맷팅
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  /**
   * 완료 메시지 렌더링
   */
  renderCompletionMessage(type, todayCount) {
    let message = "";

    if (type === "focus") {
      message = `🍅 *집중 시간 완료!*\n\n`;
      message += `수고하셨습니다! 잠시 휴식하세요.\n`;
      message += `오늘 ${todayCount}개의 집중을 완료했습니다! 🎉`;

      if (todayCount % 4 === 0) {
        message += `\n\n🌴 이제 긴 휴식 시간입니다!`;
      }
    } else if (type === "shortBreak") {
      message = `☕ *휴식 시간 종료!*\n\n`;
      message += `다시 집중할 시간입니다! 💪`;
    } else if (type === "longBreak") {
      message = `🌴 *긴 휴식 종료!*\n\n`;
      message += `충분히 쉬셨나요? 새로운 사이클을 시작해보세요!`;
    }

    return message;
  }

  /**
   * 에러 메시지 렌더링
   */
  renderError(error) {
    const errorMessage =
      error?.message || error || "알 수 없는 오류가 발생했습니다.";

    return {
      text: `❌ *오류 발생*\n\n${this.escapeMarkdownV2(errorMessage)}`,
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * 정보 메시지 렌더링
   */
  renderInfo(message) {
    return {
      text: `ℹ️ *알림*\n\n${message}`,
      keyboard: this.createBackKeyboard(),
    };
  }
}

module.exports = TimerRenderer;
