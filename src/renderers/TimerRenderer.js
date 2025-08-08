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
        case "timer_completed": // 추가
          return await this.renderTimerCompleted(data, ctx);
        case "timer_transition": // 추가
          return await this.renderTimerTransition(data, ctx);
        case "pomodoro_set_completed":
          return await this.renderPomodoroSetCompleted(data, ctx);
        case "timer_status":
          return await this.renderTimerStatus(data, ctx);
        case "no_timer":
          return await this.renderNoTimer(data, ctx);
        case "history":
          return await this.renderHistory(data, ctx);
        case "no_history":
          return await this.renderNoHistory(data, ctx);
        case "custom_setup":
          return await this.renderCustomSetup(data, ctx);
        case "weekly_stats":
          return await this.renderWeeklyStats(data, ctx);
        case "stats": // stats 케이스도 추가
          return await this.renderStats(data, ctx);
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

    // ✅ 사용자 이름 안전하게 처리
    const displayName =
      userName && userName !== "알 수 없는 사용자"
        ? this.markdownHelper.escape(userName)
        : "사용자";

    let text = `🍅 *타이머 메뉴*\n\n`;
    text += `안녕하세요, ${displayName}님!\n\n`;

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
   * 🎉 뽀모도로 세트 완료 렌더링 (새로운 메서드)
   */
  async renderPomodoroSetCompleted(data, ctx) {
    const { userName, totalCycles, preset } = data;

    const text = `🎉 *뽀모도로 세트 완료!*

*${this.markdownHelper.escape(userName)}*님, 정말 대단해요!
총 *${totalCycles}* 사이클의 집중과 휴식을 모두 마치셨습니다.

충분한 휴식을 취하고 다음 작업을 준비하세요. 😊`;

    const buttons = [
      [
        { text: "🍅 새 뽀모도로 시작", action: preset },
        { text: "📈 주간 통계", action: "stats" }
      ],
      [{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]
    ];

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

    // ✅ 사용자 이름 안전하게 처리
    const displayName =
      timer.userName && timer.userName !== "알 수 없는 사용자"
        ? this.markdownHelper.escape(timer.userName)
        : "사용자";

    const progressBar = this.createProgressBar(0);

    // preset에 따른 설명 추가
    const presetInfo =
      preset === "pomodoro1"
        ? "(25분 집중 → 5분 휴식 x4회)"
        : "(50분 집중 → 10분 휴식 x2회)";

    const text =
      `🍅 **${displayName}의 뽀모도로**\n\n` + // ✅ 사용자 이름 추가
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
  async renderTimerStatus(data, ctx, isRefresh = false, canRefresh = true) {
    const { timer, userName } = data;

    const progressBar = this.createProgressBar(timer.progress);

    const statusIcon = timer.isPaused
      ? this.ui.icons.paused
      : this.ui.icons.running;

    // ✅ 사용자 이름 안전하게 처리
    const displayName =
      userName && userName !== "알 수 없는 사용자"
        ? this.markdownHelper.escape(userName)
        : timer.userName && timer.userName !== "알 수 없는 사용자"
          ? this.markdownHelper.escape(timer.userName)
          : "사용자";

    // 텍스트 생성 - 사용자 이름 포함
    let text = `${statusIcon} *${displayName}의 타이머 현재 상태*\n\n`;

    if (isRefresh) {
      text += `🔄 _새로고침됨_\n\n`;
    }

    text +=
      `${progressBar}\n\n` +
      `⏱️ *남은 시간*: ${this.escapeMarkdown(timer.remainingFormatted)}\n` +
      `⏳ *경과 시간*: ${this.escapeMarkdown(timer.elapsedFormatted)}\n` +
      `📊 *진행률*: ${timer.progress}%\n` +
      `🎯 *타입*: ${this.escapeMarkdown(timer.typeDisplay)}\n` +
      `📌 *상태*: ${this.escapeMarkdown(timer.statusDisplay)}\n\n`;

    // 뽀모도로인 경우 사이클 표시
    if (timer.totalCycles) {
      text += `🔄 *사이클*: ${timer.currentCycle}/${timer.totalCycles}\n\n`;
    }

    text += this.getProgressMessage(timer.progress);

    // 버튼 생성
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
    const { sessions, stats, days } = data;

    let text = `📜 *최근 ${days}일 타이머 기록*\n\n`;

    if (!sessions || sessions.length === 0) {
      text += "_아직 기록이 없습니다. 타이머를 시작해보세요!_";
    } else {
      sessions.forEach((session, index) => {
        // 완료 상태에 따른 이모지
        const statusEmoji = session.wasCompleted ? "✅" : "⏹️";

        // 타입 표시
        const typeDisplay =
          session.typeDisplay || this.getTypeDisplay(session.type);

        // 시간 표시
        const timeDisplay = session.completedAt
          ? new Date(session.completedAt).toLocaleString("ko-KR", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          : session.stoppedAt
            ? new Date(session.stoppedAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            : "";

        text += `${index + 1}. ${statusEmoji} ${typeDisplay}\n`;
        text += `   ⏱️ ${session.durationDisplay || session.duration + "분"}\n`;
        text += `   📅 ${timeDisplay}\n`;
        text += `   📊 완료율: ${session.completionRate}%\n\n`;
      });

      // 통계 요약
      if (stats && stats.total) {
        text += `*📊 요약*\n`;
        text += `• 총 세션: ${stats.total.sessions}회\n`;
        text += `• 완료된 세션: ${stats.total.completed}회\n`;
        text += `• 총 시간: ${stats.total.minutes}분\n`;
        text += `• 평균 완료율: ${stats.total.avgCompletionRate}%\n`;
      }
    }

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
   * 🎉 타이머 완료 렌더링 (새로 추가!)
   */
  async renderCompletion(result, ctx) {
    try {
      const { timerType, duration, _completionRate } = result.data;

      // 타입별 완료 메시지
      const completionMessages = {
        focus: [
          `🎉 축하합니다! ${duration}분 집중 시간을 완료했어요!`,
          `✨ 훌륭해요! ${duration}분 동안 집중하셨네요!`,
          `🏆 목표 달성! ${duration}분 집중 완료!`
        ],
        short: [
          `☕ 휴식 시간이 끝났어요! 다시 집중할 시간!`,
          `⏰ ${duration}분 휴식 완료! 준비되셨나요?`,
          `🔔 짧은 휴식이 끝났습니다!`
        ],
        long: [
          `🌴 긴 휴식이 끝났어요! 새로운 마음으로 시작해봐요!`,
          `🔔 ${duration}분 휴식 완료! 다시 시작할 준비가 되셨나요?`,
          `✅ 충분한 휴식을 취하셨네요!`
        ]
      };

      // 랜덤 메시지 선택
      const messages = completionMessages[timerType] || [
        `⏰ ${duration}분 타이머가 완료되었습니다!`
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];

      // 다음 단계 제안 텍스트
      let suggestion = "";
      if (timerType === "focus") {
        suggestion =
          "\n\n💡 *다음 단계:*\n• ☕ 짧은 휴식 (5분)\n• 🌴 긴 휴식 (15분)\n• 🍅 또 다른 집중 시간";
      } else {
        suggestion =
          "\n\n💡 *다음 단계:*\n• 🍅 새로운 집중 시간 시작하기\n• 📊 오늘의 통계 확인하기";
      }

      const fullMessage = `${message}${suggestion}\n\n어떻게 하시겠어요?`;

      // 버튼 생성 (BaseRenderer의 메서드 활용)
      const buttons = [];
      if (timerType === "focus") {
        buttons.push([
          { text: "☕ 짧은 휴식", action: "start", params: "short" },
          { text: "🌴 긴 휴식", action: "start", params: "long" }
        ]);
        buttons.push([
          { text: "🍅 다시 집중", action: "start", params: "focus" },
          { text: "📊 통계 보기", action: "stats" }
        ]);
      } else {
        buttons.push([
          { text: "🍅 집중 시작", action: "start", params: "focus" },
          { text: "📊 통계 보기", action: "stats" }
        ]);
      }
      buttons.push([
        { text: "🏠 메인 메뉴", action: "menu", module: "system" }
      ]);

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      // 안전한 메시지 전송 (BaseRenderer의 메서드 활용)
      await this.sendSafeMessage(ctx, fullMessage, {
        reply_markup: keyboard
      });

      logger.info(`🎉 타이머 완료 렌더링 완료`);
    } catch (error) {
      logger.error("TimerRenderer.renderCompletion 오류:", error);

      // 에러 시 기본 메시지
      const fallbackMessage = "⏰ 타이머가 완료되었습니다!";
      await this.sendSafeMessage(ctx, fallbackMessage);
    }
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(result, ctx) {
    const { userName, features, tips } = result.data;

    let text = `❓ *${this.markdownHelper.escape(userName)}님을 위한 타이머 가이드*\n\n`;

    // 주요 기능 소개
    text += `*🎯 주요 기능*\n\n`;
    features.forEach((feature) => {
      text += `${feature.icon} *${this.markdownHelper.escape(feature.title)}*\n`;
      text += `   ${this.markdownHelper.escape(feature.description)}\n\n`;
    });

    // 사용 팁
    text += `*💡 사용 팁*\n`;
    tips.forEach((tip) => {
      text += `${this.markdownHelper.escape(tip)}\n`;
    });

    const buttons = [
      [
        { text: "🍅 바로 시작하기", action: "menu" },
        { text: "⚙️ 설정", action: "settings" }
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
    const barLength = 10;
    const filledLength = Math.round((value / maxValue) * barLength);
    const emptyLength = barLength - filledLength;

    const filled = "▰".repeat(Math.max(0, filledLength));
    const empty = "▱".repeat(Math.max(0, emptyLength));

    return filled + empty;
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
   * ⚙️ 커스텀 타이머 설정 화면 렌더링
   */
  async renderCustomSetup(data, ctx) {
    try {
      const { userName, maxDuration, suggestedDurations } = data;

      // 안전한 텍스트 생성 (마크다운 이스케이프)
      const safeUserName = this.escapeMarkdown(userName);

      // 메시지 텍스트 (일반 Markdown 사용)
      let text = `⚙️ *커스텀 타이머 설정*\n\n`;
      text += `${safeUserName}님, 원하는 시간을 선택하세요!\n\n`;
      text += `📝 *추천 시간 목록*\n`;
      text += `최대 ${maxDuration}분까지 설정 가능합니다.\n\n`;
      text += `💡 _Tip: 집중하기 좋은 시간을 선택하세요!_`;

      // 버튼 생성 (추천 시간들)
      const buttons = [];

      // 추천 시간 버튼들을 3개씩 그룹화
      for (let i = 0; i < suggestedDurations.length; i += 3) {
        const row = [];
        for (let j = i; j < Math.min(i + 3, suggestedDurations.length); j++) {
          const duration = suggestedDurations[j];
          row.push({
            text: `⏱️ ${duration}분`,
            action: "start",
            params: `custom:${duration}`
          });
        }
        buttons.push(row);
      }

      // 직접 입력 및 뒤로가기 버튼
      buttons.push([
        { text: "✏️ 직접 입력", action: "setCustom" },
        { text: "🔙 뒤로", action: "menu" }
      ]);

      const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

      // 안전한 메시지 전송 (BaseRenderer의 sendSafeMessage 사용)
      await this.sendSafeMessage(ctx, text, {
        parse_mode: "Markdown", // 일반 Markdown 사용
        reply_markup: keyboard
      });

      // 콜백 쿼리 응답
      if (ctx.answerCbQuery) {
        await ctx.answerCbQuery();
      }

      logger.debug("✅ 커스텀 타이머 설정 화면 렌더링 완료");
    } catch (error) {
      logger.error("renderCustomSetup 오류:", error);
      await this.renderError(
        { message: "커스텀 타이머 설정 화면을 표시할 수 없습니다." },
        ctx
      );
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
   * 🔔 알림 토글 결과 렌더링
   */
  async renderNotificationToggled(result, ctx) {
    const { enabled, message } = result.data;

    const text =
      `${message}\n\n` + `현재 알림 상태: ${enabled ? "🔔 켜짐" : "🔕 꺼짐"}`;

    const buttons = [
      [{ text: "⚙️ 설정으로 돌아가기", action: "settings" }],
      [{ text: "🔙 메뉴", action: "menu" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 타이머 전환 렌더링
   */
  async renderTimerTransition(data, ctx) {
    const { timer, message } = data;

    const progressBar = this.createProgressBar(0);

    // this.escapeMarkdown → this.markdownHelper.escape로 변경
    let text = `${message}\n\n`;
    text += `${progressBar}\n\n`;
    text += `⏱️ *남은 시간*: ${this.markdownHelper.escape(timer.remainingFormatted || "계산중")}\n`;
    text += `🎯 *타입*: ${this.markdownHelper.escape(timer.typeDisplay || timer.type)}\n`;
    text += `📊 *상태*: ${this.markdownHelper.escape(timer.statusDisplay || "실행중")}\n`;

    if (timer.totalCycles) {
      text += `🔄 *사이클*: ${timer.currentCycle}/${timer.totalCycles}\n`;
    }

    const buttons = [
      [
        { text: "⏸️ 일시정지", action: "pause" },
        { text: "⏹️ 중지", action: "stop" }
      ],
      [{ text: "🔄 새로고침", action: "refresh" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    const { userName, weekly, allTime, recentCount } = data;

    let text = `📊 *${this.markdownHelper.escape(userName)}님의 타이머 통계*\n\n`;

    // 주간 통계
    if (weekly) {
      text += `*📅 이번 주 통계*\n`;
      text += `• 총 세션: ${weekly.totalSessions}회\n`;
      text += `• 완료된 세션: ${weekly.completedSessions}회\n`;
      text += `• 집중 시간: ${weekly.totalFocusTime}분\n`;
      text += `• 휴식 시간: ${weekly.totalBreakTime}분\n`;
      text += `• 완료율: ${weekly.completionRate || 0}%\n\n`;
    }

    // 전체 통계 (최근 30개 세션 기준)
    if (allTime) {
      text += `*📈 전체 통계* (최근 ${recentCount}개 세션)\n`;
      text += `• 총 세션: ${allTime.totalSessions}회\n`;
      text += `• 완료된 세션: ${allTime.completedSessions}회\n`;
      text += `• 총 시간: ${allTime.totalMinutes}분\n`;

      if (allTime.totalSessions > 0) {
        const avgCompletionRate = Math.round(
          (allTime.completedSessions / allTime.totalSessions) * 100
        );
        text += `• 평균 완료율: ${avgCompletionRate}%\n`;
      }

      text += `\n*타입별 분석*\n`;
      for (const [type, stats] of Object.entries(allTime.byType)) {
        const typeDisplay = this.getTypeDisplay(type);
        text += `${typeDisplay}: ${stats.count}회 (${stats.minutes}분)\n`;
      }
    }

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
   * 타입 표시명 가져오기
   */
  getTypeDisplay(type) {
    const displays = {
      focus: "🎯 집중",
      shortBreak: "☕ 짧은 휴식",
      longBreak: "🌴 긴 휴식",
      custom: "⏰ 커스텀"
    };
    return displays[type] || type;
  }

  /**
   * 타이머 완료 렌더링
   */
  async renderTimerCompleted(data, ctx) {
    const { type, duration } = data;

    const text =
      `🎉 *타이머 완료!*\n\n` +
      `${this.markdownHelper.escape(this.getTypeDisplay(type))} (${duration}분) 타이머가 완료되었습니다.\n\n` +
      `수고하셨습니다! 💪`;

    const buttons = [
      [
        { text: "🍅 뽀모도로 시작", action: "pomodoro1" },
        { text: "⏱️ 새 타이머", action: "menu" }
      ],
      [{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]
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
