// src/renderers/TimerRenderer.js - 🎨 SoC 완전 준수 리팩토링 v4.0

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");

/**
 * 🎨 TimerRenderer - 타이머 UI 렌더링 (SoC 완전 준수)
 *
 * ✅ SoC 원칙 준수:
 * - UI 생성만 전담 (비즈니스 로직 없음)
 * - 모듈에서 받은 데이터를 시각화
 * - 인라인 키보드 생성
 * - 마크다운 안전 처리
 *
 * ✅ 새로운 기능:
 * - 새로고침 버튼으로 현황 확인
 * - 타이머 진행률 바 (실시간 X, 새로고침 시 업데이트)
 * - 주간 뱃지 표시
 * - 최근 기록 리스트
 * - 뽀모도로 프리셋 메뉴
 */
class TimerRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "timer";

    // 🎨 UI 상수
    this.ui = {
      // 진행률 바 설정
      progressBar: {
        length: 10,
        filled: "🟩",
        empty: "⬜"
      },

      // 타이머 아이콘
      icons: {
        timer: "🍅",
        focus: "🎯",
        shortBreak: "☕",
        longBreak: "🌴",
        custom: "⏰",
        running: "▶️",
        paused: "⏸️",
        stopped: "⏹️",
        completed: "✅",
        refresh: "🔄"
      },

      // 뱃지 아이콘
      badges: {
        beginner: "🥉",
        intermediate: "🥈",
        expert: "🥇",
        master: "💎"
      }
    };

    logger.debug("🎨 TimerRenderer 생성됨 (SoC 준수 v4.0)");
  }

  /**
   * 🎯 메인 렌더링 메서드 (표준 render)
   */
  async render(result, ctx) {
    const { type, data } = result;

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);
        case "timer_started":
          return await this.renderTimerStarted(data, ctx);
        case "pomodoro_started":
          return await this.renderPomodoroStarted(data, ctx);
        case "timer_already_running":
          return await this.renderTimerAlreadyRunning(data, ctx);
        case "timer_paused":
          return await this.renderTimerPaused(data, ctx);
        case "timer_resumed":
          return await this.renderTimerResumed(data, ctx);
        case "timer_stopped":
          return await this.renderTimerStopped(data, ctx);
        case "timer_status":
          return await this.renderTimerStatus(data, ctx);
        case "no_timer":
          return await this.renderNoTimer(data, ctx);
        case "history":
          return await this.renderHistory(data, ctx);
        case "no_history":
          return await this.renderNoHistory(data, ctx);
        case "weekly_stats":
          return await this.renderWeeklyStats(data, ctx);
        case "settings":
          return await this.renderSettings(data, ctx);
        case "notification_toggled":
          return await this.renderNotificationToggled(data, ctx);
        case "help":
          return await this.renderHelp(data, ctx);
        case "error":
          return await this.renderError(data, ctx);
        default:
          return await this.renderError(
            { message: `지원하지 않는 타입: ${type}` },
            ctx
          );
      }
    } catch (error) {
      logger.error("TimerRenderer.render 오류:", error);
      return await this.renderError(
        { message: "렌더링 중 오류가 발생했습니다." },
        ctx
      );
    }
  }

  // ===== 🎨 렌더링 메서드들 =====

  /**
   * 🍅 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, activeTimer, recentSessions, _presets } = data;

    let text = `🍅 *타이머 메뉴*\n\n`;
    text += `안녕하세요, ${this.markdownHelper.escape(userName)}님!\n\n`;

    // 활성 타이머가 있는 경우
    if (activeTimer) {
      const progressBar = this.createProgressBar(activeTimer.progress);
      text += `*실행 중인 타이머*\n`;
      text += `${progressBar}\n`;
      text += `⏱️ ${activeTimer.remainingFormatted} 남음\n`;
      text += `📊 ${activeTimer.progress}% 완료\n\n`;
    }

    // 최근 세션 표시
    if (recentSessions && recentSessions.length > 0) {
      text += `*최근 활동*\n`;
      recentSessions.slice(0, 3).forEach((session) => {
        text += `• ${session.typeDisplay} ${session.durationDisplay}\n`;
      });
      text += `\n`;
    }

    text += `원하는 타이머를 선택하세요:`;

    // 버튼 생성
    const buttons = [];

    if (activeTimer) {
      // 활성 타이머가 있을 때
      buttons.push([
        { text: "📊 현재 상태", action: "status" },
        { text: "🔄 새로고침", action: "refresh" }
      ]);

      if (activeTimer.isPaused) {
        buttons.push([
          { text: "▶️ 재개", action: "resume" },
          { text: "⏹️ 중지", action: "stop" }
        ]);
      } else {
        buttons.push([
          { text: "⏸️ 일시정지", action: "pause" },
          { text: "⏹️ 중지", action: "stop" }
        ]);
      }
    } else {
      // 활성 타이머가 없을 때
      buttons.push([
        { text: "🍅 뽀모도로 1 (25-5)", action: "pomodoro1" },
        { text: "🍅 뽀모도로 2 (50-10)", action: "pomodoro2" }
      ]);
      buttons.push([
        { text: "🎯 집중 (25분)", action: "start:focus" },
        { text: "☕ 휴식 (5분)", action: "start:shortBreak" }
      ]);
      buttons.push([{ text: "⏰ 커스텀 타이머", action: "custom" }]);
    }

    // 추가 메뉴
    buttons.push([
      { text: "📜 기록", action: "history" },
      { text: "📈 주간 통계", action: "stats" }
    ]);
    buttons.push([
      { text: "⚙️ 설정", action: "settings" },
      { text: "❓ 도움말", action: "help" }
    ]);
    buttons.push([{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 타이머 시작 렌더링
   */
  async renderTimerStarted(data, ctx) {
    const { timer, message } = data;

    const progressBar = this.createProgressBar(0);

    const text =
      `${message}\n\n` +
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${timer.remainingFormatted}\n` +
      `🎯 *타입*: ${timer.typeDisplay}\n` +
      `📊 *상태*: ${timer.statusDisplay}\n\n` +
      `집중해서 작업을 시작하세요! 💪`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "refresh" },
        { text: "⏸️ 일시정지", action: "pause" }
      ],
      [
        { text: "⏹️ 중지", action: "stop" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🍅 뽀모도로 시작 렌더링
   */
  async renderPomodoroStarted(data, ctx) {
    const { timer, preset, message } = data;

    const progressBar = this.createProgressBar(0);

    // preset에 따른 설명 추가
    const presetInfo =
      preset === "pomodoro1"
        ? "(25분 집중 → 5분 휴식 x4회)"
        : "(50분 집중 → 10분 휴식 x2회)";

    const text =
      `${message}\n` +
      `${presetInfo}\n\n` +
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${timer.remainingFormatted}\n` +
      `🔄 *사이클*: ${timer.currentCycle}/${timer.totalCycles}\n` +
      `📊 *상태*: ${timer.statusDisplay}\n` +
      `📌 *프리셋*: ${preset === "pomodoro1" ? "뽀모도로 1" : "뽀모도로 2"}\n\n` +
      `뽀모도로 기법으로 효율적으로 작업하세요! 🚀`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "refresh" },
        { text: "⏸️ 일시정지", action: "pause" }
      ],
      [
        { text: "⏹️ 중지", action: "stop" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏸️ 타이머 일시정지 렌더링
   */
  async renderTimerPaused(data, ctx) {
    const { timer, message } = data;

    const progressBar = this.createProgressBar(timer.progress);

    const text =
      `${message}\n\n` +
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${timer.remainingFormatted}\n` +
      `⏳ *경과 시간*: ${timer.elapsedFormatted}\n` +
      `📊 *진행률*: ${timer.progress}%\n\n` +
      `준비되면 재개 버튼을 눌러주세요.`;

    const buttons = [
      [
        { text: "▶️ 재개", action: "resume" },
        { text: "🔄 새로고침", action: "refresh" }
      ],
      [
        { text: "⏹️ 중지", action: "stop" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 타이머 재개 렌더링
   */
  async renderTimerResumed(data, ctx) {
    const { timer, message } = data;

    const progressBar = this.createProgressBar(timer.progress);

    const text =
      `${message}\n\n` +
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${timer.remainingFormatted}\n` +
      `📊 *진행률*: ${timer.progress}%\n\n` +
      `다시 집중해봅시다! 🎯`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "refresh" },
        { text: "⏸️ 일시정지", action: "pause" }
      ],
      [
        { text: "⏹️ 중지", action: "stop" },
        { text: "🔙 메뉴", action: "menu" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏹️ 타이머 중지 렌더링
   */
  async renderTimerStopped(data, ctx) {
    const { message, elapsedTime, completionRate } = data;

    let completionEmoji = "👍";
    if (completionRate >= 90) completionEmoji = "🎉";
    else if (completionRate >= 70) completionEmoji = "🌟";
    else if (completionRate >= 50) completionEmoji = "👏";

    const text =
      `${message}\n\n` +
      `⏱️ *경과 시간*: ${elapsedTime}\n` +
      `📊 *완료율*: ${completionRate}%\n\n` +
      `${completionEmoji} ${this.getEncouragementMessage(completionRate)}`;

    const buttons = [
      [
        { text: "🍅 새 타이머", action: "menu" },
        { text: "📜 기록 보기", action: "history" }
      ],
      [
        { text: "📈 주간 통계", action: "stats" },
        { text: "🔙 메인 메뉴", action: "menu", module: "system" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 타이머 상태 렌더링
   */
  async renderTimerStatus(data, ctx) {
    const { timer, canRefresh, isRefresh, _refreshedAt } = data;

    const progressBar = this.createProgressBar(timer.progress);
    const statusIcon = timer.isPaused
      ? this.ui.icons.paused
      : this.ui.icons.running;

    let text = `${statusIcon} *타이머 현재 상태*\n\n`;

    if (isRefresh) {
      text += `🔄 _새로고침됨_\n\n`;
    }

    text +=
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${timer.remainingFormatted}\n` +
      `⏳ *경과 시간*: ${timer.elapsedFormatted}\n` +
      `📊 *진행률*: ${timer.progress}%\n` +
      `🎯 *타입*: ${timer.typeDisplay}\n` +
      `📌 *상태*: ${timer.statusDisplay}\n\n`;

    if (timer.pomodoroSet) {
      text += `🔄 *사이클*: ${timer.currentCycle}/${timer.totalCycles}\n\n`;
    }

    text += this.getProgressMessage(timer.progress);

    const buttons = [];

    if (canRefresh) {
      buttons.push([{ text: "🔄 새로고침", action: "refresh" }]);
    }

    if (timer.isPaused) {
      buttons.push([
        { text: "▶️ 재개", action: "resume" },
        { text: "⏹️ 중지", action: "stop" }
      ]);
    } else {
      buttons.push([
        { text: "⏸️ 일시정지", action: "pause" },
        { text: "⏹️ 중지", action: "stop" }
      ]);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🚫 타이머 없음 렌더링
   */
  async renderNoTimer(data, ctx) {
    const { message, suggestion } = data;

    const text = `❌ ${message}\n\n💡 ${suggestion}`;

    const buttons = [
      [
        { text: "🍅 뽀모도로 1", action: "pomodoro1" },
        { text: "🍅 뽀모도로 2", action: "pomodoro2" }
      ],
      [
        { text: "🎯 집중 타이머", action: "start:focus" },
        { text: "⏰ 커스텀", action: "custom" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📜 기록 렌더링
   */
  async renderHistory(data, ctx) {
    const { sessions, userName } = data;

    let text = `📜 *${this.markdownHelper.escape(userName)}님의 최근 기록*\n\n`;

    sessions.forEach((session, index) => {
      const emoji = this.getTypeEmoji(session.type);
      const status = session.status === "completed" ? "✅" : "⏹️";

      text += `${index + 1}. ${emoji} ${session.typeDisplay} (${session.durationDisplay})\n`;
      text += `   ${status} ${session.completedAt || session.stoppedAt}\n`;
      text += `   📊 완료율: ${session.completionRate || 0}%\n\n`;
    });

    const buttons = [
      [
        { text: "📈 주간 통계", action: "stats" },
        { text: "🍅 새 타이머", action: "menu" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📈 주간 통계 렌더링
   */
  async renderWeeklyStats(data, ctx) {
    const { stats, badge, userName } = data;

    let text = `📈 *${this.markdownHelper.escape(userName)}님의 주간 통계*\n\n`;

    // 뱃지 표시
    if (badge) {
      text += `${badge.emoji} *획득 뱃지*: ${badge.name}\n\n`;
    }

    // 통계 표시
    text += `📊 *이번 주 세션*: ${stats.totalSessions}회\n`;
    text += `⏱️ *총 집중 시간*: ${stats.totalFocusTime}분\n`;
    text += `☕ *총 휴식 시간*: ${stats.totalBreakTime}분\n`;
    text += `✅ *완료율*: ${stats.completionRate}%\n\n`;

    // 일별 그래프
    text += `*일별 활동*\n`;
    stats.dailyActivity.forEach((day) => {
      const bar = this.createMiniBar(day.sessions, 10);
      text += `${day.name}: ${bar} ${day.sessions}회\n`;
    });

    const buttons = [
      [
        { text: "📜 최근 기록", action: "history" },
        { text: "🍅 새 타이머", action: "menu" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    const { settings, enableNotifications } = data;

    const notificationStatus = enableNotifications ? "🔔 켜짐" : "🔕 꺼짐";

    const text =
      `⚙️ *타이머 설정*\n\n` +
      `🍅 *집중 시간*: ${settings.focusDuration}분\n` +
      `☕ *짧은 휴식*: ${settings.shortBreak}분\n` +
      `🌴 *긴 휴식*: ${settings.longBreak}분\n\n` +
      `🔔 *완료 알림*: ${notificationStatus}\n`;

    const buttons = [
      [
        { text: "🍅 집중 시간 설정", action: "setFocus" },
        { text: "☕ 휴식 시간 설정", action: "setBreak" }
      ],
      [
        {
          text: enableNotifications ? "🔕 알림 끄기" : "🔔 알림 켜기",
          action: "toggleNotifications"
        }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { title, sections } = data;

    let text = `${title}\n\n`;

    for (const [_key, section] of Object.entries(sections)) {
      text += `*${section.title}*\n`;
      section.items.forEach((item) => {
        text += `${item}\n`;
      });
      text += `\n`;
    }

    const buttons = [
      [
        { text: "🍅 타이머 시작", action: "menu" },
        { text: "📈 통계 보기", action: "stats" }
      ],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ===== 🛠️ 헬퍼 메서드 (UI 전용) =====

  /**
   * 📊 진행률 바 생성
   */
  createProgressBar(progress) {
    const { length, filled, empty } = this.ui.progressBar;
    const filledCount = Math.floor((progress / 100) * length);
    const emptyCount = length - filledCount;

    return (
      filled.repeat(filledCount) + empty.repeat(emptyCount) + ` ${progress}%`
    );
  }

  /**
   * 📊 미니 바 생성 (통계용)
   */
  createMiniBar(value, maxValue) {
    const barLength = 5;
    const percentage = Math.min(100, (value / maxValue) * 100);
    const filledCount = Math.floor((percentage / 100) * barLength);

    return "▰".repeat(filledCount) + "▱".repeat(barLength - filledCount);
  }

  /**
   * 🎯 타입별 이모지
   */
  getTypeEmoji(type) {
    const emojis = {
      focus: "🎯",
      shortBreak: "☕",
      longBreak: "🌴",
      custom: "⏰"
    };
    return emojis[type] || "⏱️";
  }

  /**
   * 💬 진행률별 메시지
   */
  getProgressMessage(progress) {
    if (progress < 25) {
      return "💪 좋은 시작이에요! 계속 집중하세요!";
    } else if (progress < 50) {
      return "🚀 순조롭게 진행 중입니다!";
    } else if (progress < 75) {
      return "🔥 절반 이상 완료! 조금만 더!";
    } else if (progress < 90) {
      return "⭐ 거의 다 왔어요! 마지막 스퍼트!";
    } else {
      return "🎯 완주가 눈앞에! 끝까지 화이팅!";
    }
  }

  /**
   * 💬 완료율별 격려 메시지
   */
  getEncouragementMessage(completionRate) {
    if (completionRate >= 90) {
      return "완벽한 집중이었어요! 훌륭합니다!";
    } else if (completionRate >= 70) {
      return "아주 잘하셨어요! 좋은 집중력이었습니다!";
    } else if (completionRate >= 50) {
      return "좋은 시도였어요! 다음엔 더 잘할 수 있을 거예요!";
    } else if (completionRate >= 30) {
      return "괜찮아요! 조금씩 나아지고 있어요!";
    } else {
      return "다음에 다시 도전해보세요! 화이팅!";
    }
  }

  /**
   * 🚫 기록 없음 렌더링
   */
  async renderNoHistory(data, ctx) {
    const { message } = data;

    const text =
      `📜 ${message}\n\n` + "타이머를 시작해서 첫 기록을 만들어보세요! 🍅";

    const buttons = [
      [{ text: "🍅 타이머 시작", action: "menu" }],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🔔 알림 토글 렌더링
   */
  async renderNotificationToggled(data, ctx) {
    const { enabled, message } = data;

    const text =
      `${message}\n\n` +
      `알림 설정이 ${enabled ? "활성화" : "비활성화"}되었습니다.`;

    const buttons = [
      [{ text: "⚙️ 설정으로 돌아가기", action: "settings" }],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message } = data;

    const text = `❌ *오류*\n\n${message}\n\n다시 시도해주세요.`;

    const buttons = [
      [{ text: "🔄 다시 시도", action: "menu" }],
      [{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = TimerRenderer;
