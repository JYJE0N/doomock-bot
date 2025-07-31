// src/renderers/TimerRenderer.js - 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🍅 TimerRenderer - 뽀모도로 타이머 UI 렌더링 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "timer:action:params" 형태 표준화
 * - 표준 키보드 생성 메서드 사용
 * - 실시간 업데이트를 위한 동적 렌더링
 * - 진행 상황 시각화 강화
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 뽀모도로 카페의 스마트 디스플레이 시스템
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 실시간으로 타이머 상태를 아름답게 표시
 * - 표준화된 버튼(키보드)으로 조작 가능
 * - 진행 상황을 직관적으로 시각화
 */
class TimerRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "timer";

    // 🍅 뽀모도로 특화 설정
    this.config = {
      ...this.config,
      progressBarLength: 10,
      showDetailedTime: true,
      enableProgressEmojis: true,
      updateAnimations: true,
    };

    // 🎭 이모지 컬렉션 (뽀모도로 특화)
    this.emojis = {
      // 타이머 타입
      focus: "🍅",
      shortBreak: "☕",
      longBreak: "🌴",
      custom: "⏱️",

      // 상태
      active: "▶️",
      paused: "⏸️",
      completed: "✅",
      stopped: "⏹️",

      // UI 요소
      clock: "⏰",
      stats: "📊",
      settings: "⚙️",
      help: "❓",
      progress: "📈",
      fire: "🔥",

      // 진행바 요소
      filled: "█",
      empty: "░",
      current: "▶",

      // 감정/피드백
      excellent: "🎉",
      good: "👍",
      encourage: "💪",
      thinking: "🤔",
    };

    // 📊 진행바 스타일
    this.progressStyles = {
      focus: { filled: "🟩", empty: "⬜", current: "🔥" },
      shortBreak: { filled: "🟦", empty: "⬜", current: "☕" },
      longBreak: { filled: "🟪", empty: "⬜", current: "🌴" },
      custom: { filled: "🟨", empty: "⬜", current: "⏱️" },
    };

    logger.debug("🍅 TimerRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, { dataKeys: Object.keys(data || {}) });

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "timer_started":
          return await this.renderTimerStarted(data, ctx);

        case "timer_paused":
          return await this.renderTimerPaused(data, ctx);

        case "timer_resumed":
          return await this.renderTimerResumed(data, ctx);

        case "timer_stopped":
          return await this.renderTimerStopped(data, ctx);

        case "timer_completed":
          return await this.renderTimerCompleted(data, ctx);

        case "status":
          return await this.renderStatus(data, ctx);

        case "stats":
          return await this.renderStats(data, ctx);

        case "history":
          return await this.renderHistory(data, ctx);

        case "settings":
          return await this.renderSettings(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "info":
          return await this.renderInfo(data, ctx);

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

  // ===== 🍅 메인 메뉴 렌더링 =====

  /**
   * 🍅 뽀모도로 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMenu(data, ctx) {
    this.debug("뽀모도로 메뉴 렌더링", { hasActiveTimer: !!data?.activeTimer });

    let text = `${this.emojis.focus} **뽀모도로 타이머 \\- 두목봇**\n\n`;

    // 활성 타이머가 있는 경우
    if (data?.activeTimer) {
      text += this.formatActiveTimerStatus(data.activeTimer);
      text += "\n\n";

      const keyboard = this.createActiveTimerKeyboard(data.activeTimer);
      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return;
    }

    // 오늘의 통계 표시 (활성 타이머가 없을 때)
    if (data?.stats) {
      text += this.formatTodayStats(data.stats);
    }

    // 타이머 설정 정보
    if (data?.config) {
      text += this.formatTimerSettings(data.config);
    }

    text += "\n✨ **새로운 타이머를 시작해보세요\\!**";

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [
      [
        {
          text: `${this.emojis.focus} 집중 시작`,
          action: "start",
          params: "focus",
        },
        {
          text: `${this.emojis.shortBreak} 짧은 휴식`,
          action: "start",
          params: "shortBreak",
        },
      ],
      [
        {
          text: `${this.emojis.longBreak} 긴 휴식`,
          action: "start",
          params: "longBreak",
        },
        {
          text: `${this.emojis.custom} 커스텀`,
          action: "start",
          params: "custom",
        },
      ],
      [
        { text: `${this.emojis.stats} 통계`, action: "stats" },
        { text: `${this.emojis.settings} 설정`, action: "settings" },
      ],
      [
        { text: `${this.emojis.help} 도움말`, action: "help" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 오늘 통계 포맷팅
   */
  formatTodayStats(stats) {
    let text = `📅 **오늘의 기록**\n`;
    text += `• 완료한 집중: ${stats.focusCompleted || 0}개\n`;
    text += `• 총 집중 시간: ${stats.totalMinutes || 0}분\n`;
    text += `• 생산성: ${stats.productivityRate || 0}%\n`;

    if (stats.streak > 0) {
      text += `• ${this.emojis.fire} 연속 기록: ${stats.streak}일\n`;
    }

    text += "\n";
    return text;
  }

  /**
   * ⚙️ 타이머 설정 포맷팅
   */
  formatTimerSettings(config) {
    let text = `⏱️ **타이머 설정**\n`;
    text += `• 집중 시간: ${config.focusDuration}분\n`;
    text += `• 짧은 휴식: ${config.shortBreakDuration}분\n`;
    text += `• 긴 휴식: ${config.longBreakDuration}분\n`;
    text += `• 긴 휴식 주기: ${config.sessionsBeforeLongBreak}세션마다\n\n`;
    return text;
  }

  // ===== ⏱️ 활성 타이머 렌더링 =====

  /**
   * ▶️ 타이머 시작 렌더링
   */
  async renderTimerStarted(data, ctx) {
    this.debug("타이머 시작 렌더링", { type: data.type });

    const { timer, session } = data;
    const emoji = this.emojis[timer.type] || this.emojis.custom;
    const typeName = this.getTimerTypeName(timer.type);

    let text = `${emoji} **${typeName} 시작\\!**\n\n`;
    text += this.formatActiveTimerStatus(timer);
    text += "\n\n";
    text += this.getMotivationMessage(timer.type, "start");

    const keyboard = this.createActiveTimerKeyboard(timer);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⏸️ 타이머 일시정지 렌더링
   */
  async renderTimerPaused(data, ctx) {
    this.debug("타이머 일시정지 렌더링");

    const { timer } = data;
    const emoji = this.emojis[timer.type] || this.emojis.custom;

    let text = `${this.emojis.paused} **타이머 일시정지**\n\n`;
    text += this.formatActiveTimerStatus(timer);
    text += "\n\n";
    text += "💭 잠시 쉬어가도 괜찮아요\\. 준비되면 다시 시작하세요\\!";

    const keyboard = this.createActiveTimerKeyboard(timer);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ▶️ 타이머 재개 렌더링
   */
  async renderTimerResumed(data, ctx) {
    this.debug("타이머 재개 렌더링");

    const { timer } = data;

    let text = `${this.emojis.active} **타이머 재개**\n\n`;
    text += this.formatActiveTimerStatus(timer);
    text += "\n\n";
    text += this.getMotivationMessage(timer.type, "resume");

    const keyboard = this.createActiveTimerKeyboard(timer);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⏹️ 타이머 중지 렌더링
   */
  async renderTimerStopped(data, ctx) {
    this.debug("타이머 중지 렌더링");

    const { summary } = data;

    let text = `${this.emojis.stopped} **타이머 중지**\n\n`;

    if (summary?.completedPercentage) {
      text += `📊 **진행률**: ${summary.completedPercentage}%\n\n`;
      text += this.getCompletionFeedback(summary.completedPercentage);
    } else {
      text += "타이머가 중지되었습니다\\.\n";
      text += "다음에는 끝까지 완료해보세요\\! 💪";
    }

    const buttons = [
      [
        {
          text: `${this.emojis.focus} 다시 시작`,
          action: "start",
          params: "focus",
        },
        { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
      ],
      [
        { text: `${this.emojis.focus} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 타이머 완료 렌더링
   */
  async renderTimerCompleted(data, ctx) {
    this.debug("타이머 완료 렌더링");

    const { timer, session, nextRecommendation } = data;
    const emoji = this.emojis[timer.type] || this.emojis.custom;
    const typeName = this.getTimerTypeName(timer.type);

    let text = `${this.emojis.completed} **${typeName} 완료\\!**\n\n`;
    text += `${this.emojis.excellent} 축하합니다\\! ${timer.duration}분을 완주했어요\\!\n\n`;

    // 다음 추천
    if (nextRecommendation) {
      const nextEmoji =
        this.emojis[nextRecommendation.type] || this.emojis.custom;
      text += `💡 **다음 추천**: ${nextEmoji} ${nextRecommendation.name}\n`;
      text += `⏱️ ${nextRecommendation.duration}분\n\n`;
    }

    text += this.getCompletionCelebration(timer.type);

    // 완료 후 옵션 키보드
    const buttons = [];

    if (nextRecommendation) {
      buttons.push([
        {
          text: `${this.emojis[nextRecommendation.type]} ${
            nextRecommendation.name
          } 시작`,
          action: "start",
          params: nextRecommendation.type,
        },
      ]);
    }

    buttons.push([
      { text: `${this.emojis.focus} 새 타이머`, action: "menu" },
      { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
    ]);

    buttons.push([this.createHomeButton()]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📊 상태 및 통계 렌더링 =====

  /**
   * 📊 현재 상태 렌더링
   */
  async renderStatus(data, ctx) {
    this.debug("상태 렌더링", { hasActiveTimer: !!data?.activeTimer });

    let text = `📊 **타이머 상태**\n\n`;

    if (data?.activeTimer) {
      text += this.formatActiveTimerStatus(data.activeTimer);
      text += "\n\n";
      text += "⏱️ 타이머가 진행 중입니다\\!";
    } else {
      text += "현재 활성 타이머가 없습니다\\.\n";
      text += "새 타이머를 시작해보세요\\! ✨";
    }

    const buttons = [
      [
        { text: `${this.emojis.focus} 타이머 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    this.debug("통계 렌더링", { hasStats: !!data?.stats });

    let text = `${this.emojis.stats} **타이머 통계**\n\n`;

    if (data?.stats) {
      const stats = data.stats;

      text += `📅 **${stats.period || "오늘"}**\n`;
      text += `${this.emojis.focus} 완료 세션: ${
        stats.completedSessions || 0
      }개\n`;
      text += `⏱️ 총 시간: ${stats.totalMinutes || 0}분\n`;
      text += `📈 생산성: ${stats.productivityRate || 0}%\n`;

      if (stats.streak > 0) {
        text += `${this.emojis.fire} 연속 기록: ${stats.streak}일\n`;
      }

      if (stats.averagePerDay > 0) {
        text += `📊 일평균: ${stats.averagePerDay}분\n`;
      }

      // 성취 레벨 표시
      text += "\n" + this.getAchievementLevel(stats);
    } else {
      text += "아직 통계가 없습니다\\.\n";
      text += "타이머를 사용해보시면 멋진 통계가 쌓여요\\! 📈";
    }

    const buttons = [
      [
        { text: `📜 히스토리`, action: "history" },
        {
          text: `${this.emojis.focus} 타이머 시작`,
          action: "start",
          params: "focus",
        },
      ],
      [
        { text: `${this.emojis.focus} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📜 히스토리 렌더링
   */
  async renderHistory(data, ctx) {
    this.debug("히스토리 렌더링", { hasHistory: !!data?.sessions });

    let text = `📜 **타이머 히스토리**\n\n`;

    if (data?.sessions && data.sessions.length > 0) {
      text += this.formatSessionHistory(data.sessions);
    } else {
      text += "아직 완료된 세션이 없습니다\\.\n";
      text += "첫 번째 세션을 완료해보세요\\! 🎯";
    }

    const buttons = [
      [
        { text: `${this.emojis.stats} 통계`, action: "stats" },
        {
          text: `${this.emojis.focus} 타이머 시작`,
          action: "start",
          params: "focus",
        },
      ],
      [
        { text: `${this.emojis.focus} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ⚙️ 설정 렌더링 =====

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    this.debug("설정 렌더링", { hasConfig: !!data?.config });

    let text = `${this.emojis.settings} **타이머 설정**\n\n`;

    if (data?.config) {
      const config = data.config;
      text += `${this.emojis.focus} **집중 시간**: ${config.focusDuration}분\n`;
      text += `${this.emojis.shortBreak} **짧은 휴식**: ${config.shortBreakDuration}분\n`;
      text += `${this.emojis.longBreak} **긴 휴식**: ${config.longBreakDuration}분\n`;
      text += `🔄 **긴 휴식 주기**: ${config.sessionsBeforeLongBreak}세션마다\n\n`;

      text += "🔧 **기능 설정**\n";
      text += `🔔 알림: ${config.enableNotifications ? "켜짐" : "꺼짐"}\n`;
      text += `📊 통계: ${config.enableStats ? "켜짐" : "꺼짐"}\n`;
      text += `⏭️ 자동 휴식: ${config.autoStartBreak ? "켜짐" : "꺼짐"}\n`;
    }

    const buttons = [
      [
        {
          text: `${this.emojis.focus} 집중시간 설정`,
          action: "settings",
          params: "focus",
        },
        {
          text: `${this.emojis.shortBreak} 휴식시간 설정`,
          action: "settings",
          params: "break",
        },
      ],
      [
        { text: "🔔 알림 설정", action: "settings", params: "notifications" },
        { text: "🔄 기본값 복원", action: "settings", params: "reset" },
      ],
      [
        { text: `${this.emojis.focus} 메뉴`, action: "menu" },
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

    let text = `${this.emojis.help} **뽀모도로 타이머 사용법**\n\n`;
    text += `${this.emojis.focus} **뽀모도로 기법이란\\?**\n`;
    text += "• 25분 집중 → 5분 휴식\n";
    text += "• 4회 반복 후 긴 휴식 (15분)\n";
    text += "• 집중력 향상과 피로 방지\n\n";

    text += "📱 **기본 사용법**\n";
    text += "• **시작**: 타이머를 시작합니다\n";
    text += "• **일시정지**: 잠시 멈춥니다\n";
    text += "• **재개**: 다시 시작합니다\n";
    text += "• **중지**: 완전히 종료합니다\n\n";

    text += "🎯 **효과적인 사용 팁**\n";
    text += "• 집중 시간엔 한 가지 일에만 몰두\n";
    text += "• 휴식 시간엔 완전히 쉬세요\n";
    text += "• 꾸준히 사용하면 습관이 됩니다\n";
    text += "• 통계로 성장을 확인하세요\n\n";

    text += "✨ **두목봇과 함께 생산성을 높여보세요\\!**";

    const buttons = [
      [
        {
          text: `${this.emojis.focus} 첫 타이머 시작`,
          action: "start",
          params: "focus",
        },
        { text: `${this.emojis.stats} 통계 보기`, action: "stats" },
      ],
      [
        { text: `${this.emojis.focus} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ℹ️ 정보 메시지 렌더링 =====

  /**
   * ℹ️ 정보 메시지 렌더링
   */
  async renderInfo(data, ctx) {
    this.debug("정보 메시지 렌더링");

    const message = data.message || "알림이 있습니다.";

    let text = `💡 **알림**\n\n${message}`;

    const buttons = [
      [
        { text: `${this.emojis.focus} 타이머 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎨 헬퍼 메서드들 =====

  /**
   * ⏱️ 활성 타이머 상태 포맷팅
   */
  formatActiveTimerStatus(timer) {
    const emoji = this.emojis[timer.type] || this.emojis.custom;
    const typeName = this.getTimerTypeName(timer.type);
    const timeDisplay = this.formatTime(timer.remainingTime);

    let text = `${emoji} **현재 ${typeName}**\n`;
    text += `⏱️ 남은 시간: **${timeDisplay}**\n`;

    // 진행바 표시
    const progress = this.createProgressBar(timer);
    text += `${progress.bar} ${progress.percentage}%\n`;

    // 상태 표시
    const statusEmoji = timer.isPaused
      ? this.emojis.paused
      : this.emojis.active;
    const statusText = timer.isPaused ? "일시정지" : "진행 중";
    text += `${statusEmoji} ${statusText}`;

    return text;
  }

  /**
   * 📊 진행바 생성 (타이머 타입별 스타일)
   */
  createProgressBar(timer) {
    const totalTime = timer.duration * 60; // 분을 초로 변환
    const elapsedTime = totalTime - timer.remainingTime;
    const progress = Math.max(0, Math.min(1, elapsedTime / totalTime));

    const filledLength = Math.floor(progress * this.config.progressBarLength);
    const emptyLength = this.config.progressBarLength - filledLength;

    const style = this.progressStyles[timer.type] || this.progressStyles.custom;

    const bar =
      style.filled.repeat(filledLength) + style.empty.repeat(emptyLength);
    const percentage = Math.floor(progress * 100);

    return { bar, percentage, progress };
  }

  /**
   * ⏰ 시간 포맷팅 (분:초)
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (this.config.showDetailedTime && minutes < 1) {
      return `${remainingSeconds}초`;
    }

    return minutes > 0
      ? `${minutes}분 ${remainingSeconds}초`
      : `${remainingSeconds}초`;
  }

  /**
   * 🏷️ 타이머 타입 이름 변환
   */
  getTimerTypeName(type) {
    const typeNames = {
      focus: "집중 시간",
      shortBreak: "짧은 휴식",
      longBreak: "긴 휴식",
      custom: "커스텀 타이머",
    };

    return typeNames[type] || type;
  }

  /**
   * 💪 동기부여 메시지 생성
   */
  getMotivationMessage(timerType, action) {
    const messages = {
      focus: {
        start: "💪 집중해서 목표를 달성해봅시다\\!",
        resume: "🔥 다시 집중 모드 온\\! 화이팅\\!",
      },
      shortBreak: {
        start: "☕ 잠깐 쉬면서 에너지를 충전하세요\\!",
        resume: "😌 휴식을 마저 즐기세요\\!",
      },
      longBreak: {
        start: "🌴 충분히 쉬면서 재충전하세요\\!",
        resume: "🛌 여유롭게 휴식을 즐기세요\\!",
      },
      custom: {
        start: "⏱️ 설정한 시간만큼 최선을 다해보세요\\!",
        resume: "🎯 목표 달성까지 조금 더\\!",
      },
    };

    return messages[timerType]?.[action] || "✨ 파이팅\\!";
  }

  /**
   * 🎉 완료 축하 메시지
   */
  getCompletionCelebration(timerType) {
    const celebrations = {
      focus: "🎯 완벽한 집중이었어요\\! 생산적인 시간이었습니다\\.",
      shortBreak: "😊 좋은 휴식이었나요\\? 이제 다시 집중할 준비가 됐네요\\!",
      longBreak: "🌟 충분한 휴식으로 에너지가 가득해졌을 거예요\\!",
      custom: "🏆 설정한 목표를 달성했어요\\! 대단합니다\\!",
    };

    return celebrations[timerType] || "🎉 훌륭해요\\!";
  }

  /**
   * 📊 완료율에 따른 피드백
   */
  getCompletionFeedback(percentage) {
    if (percentage >= 90) {
      return `${this.emojis.excellent} 거의 완주했네요\\! 정말 훌륭해요\\!`;
    } else if (percentage >= 70) {
      return `${this.emojis.good} 좋은 집중력이었어요\\! 조금 더 하면 완주할 수 있어요\\!`;
    } else if (percentage >= 50) {
      return `${this.emojis.encourage} 절반 이상 완료했어요\\! 다음엔 끝까지 도전해보세요\\!`;
    } else {
      return `${this.emojis.thinking} 괜찮아요\\! 시작이 반이에요\\. 다음엔 더 오래 집중해봅시다\\!`;
    }
  }

  /**
   * 🏆 성취 레벨 표시
   */
  getAchievementLevel(stats) {
    const totalMinutes = stats.totalMinutes || 0;

    if (totalMinutes >= 1000) {
      return "🏆 **마스터 레벨**\\! 진정한 뽀모도로 전문가입니다\\!";
    } else if (totalMinutes >= 500) {
      return "🥇 **전문가 레벨**\\! 꾸준한 노력이 돋보여요\\!";
    } else if (totalMinutes >= 200) {
      return "🥈 **숙련자 레벨**\\! 좋은 습관이 자리잡고 있어요\\!";
    } else if (totalMinutes >= 50) {
      return "🥉 **초보자 레벨**\\! 좋은 시작이에요\\!";
    } else {
      return "🌱 **새싹 레벨**\\! 꾸준히 하다보면 성장할 거예요\\!";
    }
  }

  /**
   * 📜 세션 히스토리 포맷팅
   */
  formatSessionHistory(sessions) {
    let text = "";

    sessions.slice(0, 10).forEach((session, index) => {
      const emoji = this.emojis[session.type] || this.emojis.custom;
      const date = TimeHelper.format(session.completedAt, "short");
      const duration = Math.floor(session.actualDuration / 60);

      text += `${emoji} ${this.getTimerTypeName(
        session.type
      )} (${duration}분)\n`;
      text += `   📅 ${date}\n`;

      if (index < sessions.length - 1 && index < 9) text += "\n";
    });

    if (sessions.length > 10) {
      text += `\n... 외 ${sessions.length - 10}개 세션`;
    }

    return text;
  }

  // ===== ⌨️ 키보드 생성 메서드들 =====

  /**
   * 📱 활성 타이머 키보드 생성
   */
  createActiveTimerKeyboard(timer) {
    const buttons = [];

    // 첫 번째 줄: 일시정지/재개, 중지
    if (timer.isPaused) {
      buttons.push([
        { text: `${this.emojis.active} 재개`, action: "resume" },
        { text: `${this.emojis.stopped} 중지`, action: "stop" },
      ]);
    } else {
      buttons.push([
        { text: `${this.emojis.paused} 일시정지`, action: "pause" },
        { text: `${this.emojis.stopped} 중지`, action: "stop" },
      ]);
    }

    // 두 번째 줄: 상태, 통계
    buttons.push([
      { text: `${this.emojis.clock} 상태`, action: "status" },
      { text: `${this.emojis.stats} 통계`, action: "stats" },
    ]);

    // 세 번째 줄: 메뉴, 홈
    buttons.push([
      { text: `${this.emojis.focus} 메뉴`, action: "menu" },
      this.createHomeButton(),
    ]);

    return this.createInlineKeyboard(buttons, this.moduleName);
  }
}

module.exports = TimerRenderer;
