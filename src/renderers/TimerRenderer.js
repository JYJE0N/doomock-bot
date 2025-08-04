// src/renderers/TimerRenderer.js - 🎨 완전 리팩토링 v2.0

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");

/**
 * 🎨 TimerRenderer - 타이머 UI 렌더링 (완전 표준 준수 + 실시간 시각적 UI)
 *
 * ✅ 표준 준수:
 * - BaseRenderer 상속 ✅
 * - 생성자 매개변수 3개: (bot, navigationHandler, markdownHelper) ✅
 * - render() 메서드 구현 ✅
 * - this.createInlineKeyboard() 사용 ✅
 * - SoC 완전 준수: UI 생성만 담당! ✅
 *
 * ✨ 새로운 기능:
 * - 화려한 시각적 진행률 바
 * - 단계별 동기부여 메시지
 * - 실시간 업데이트 UI
 * - 반응형 아이콘 시스템
 */
class TimerRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "timer";

    // 🎨 UI 상수 (렌더러 전용)
    this.uiConstants = {
      // 진행률 바 설정
      PROGRESS_BAR_LENGTH: 20, // 총 블록 수
      PROGRESS_BLOCK_SIZE: 5, // 블록당 퍼센트 (100% / 20블록 = 5%)

      // 시각적 요소
      FILLED_CHAR: "█",
      EMPTY_CHAR: "░",

      // 단계별 아이콘
      STAGE_ICONS: {
        early: "🚀",
        middle: "💪",
        late: "🔥"
      },

      // 타이머 타입별 아이콘
      TYPE_ICONS: {
        focus: {
          main: "🍅",
          early: "📚",
          middle: "🍅",
          late: "🎯"
        },
        short: {
          main: "☕",
          early: "😴",
          middle: "🍪",
          late: "☕"
        },
        long: {
          main: "🌴",
          early: "🛋️",
          middle: "🏖️",
          late: "🌴"
        }
      },

      // 상태 아이콘
      STATUS_ICONS: {
        running: "▶️",
        paused: "⏸️",
        stopped: "⏹️",
        completed: "✅"
      }
    };

    // 💬 동기부여 메시지 시스템 (UI 전담)
    this.motivationMessages = {
      // 집중 시간
      focus_early_active: [
        "🚀 좋은 시작이에요! 집중해봅시다!",
        "📚 차근차근 해나가고 있어요!",
        "💪 이미 좋은 흐름이네요!"
      ],
      focus_middle_active: [
        "🎯 절반 완주! 계속 집중하세요!",
        "🔥 점점 더 집중되고 있어요!",
        "⚡ 리듬이 좋아졌네요!"
      ],
      focus_late_active: [
        "🏃‍♂️ 거의 다 왔어요! 마지막 스퍼트!",
        "🌟 완주까지 얼마 안 남았어요!",
        "💎 최고의 집중력을 보여주고 있어요!"
      ],
      focus_early_paused: [
        "📚 잠시 멈춰도 괜찮아요. 다시 시작해봅시다!",
        "🍅 언제든 재개할 수 있어요!",
        "💪 잠깐의 휴식 후 다시 집중해요!"
      ],
      focus_middle_paused: [
        "🎯 중간에 멈췄네요. 언제든 재개하세요!",
        "🔥 지금까지 잘 하고 있어요!",
        "⚡ 준비되면 계속해봐요!"
      ],
      focus_late_paused: [
        "🌟 거의 다 왔는데! 조금만 더 힘내세요!",
        "🏃‍♂️ 마지막 구간이에요! 파이팅!",
        "💎 완주가 눈앞에 있어요!"
      ],

      // 짧은 휴식
      short_early_active: [
        "☕ 잠깐의 휴식을 즐겨보세요!",
        "😴 천천히 쉬어가세요!",
        "🍃 깊게 숨을 들이쉬어보세요!"
      ],
      short_middle_active: [
        "🍪 휴식도 절반 지났네요!",
        "🌸 마음이 차분해지고 있나요?",
        "✨ 에너지가 충전되고 있어요!"
      ],
      short_late_active: [
        "⚡ 곧 다시 일할 시간이에요!",
        "🌈 에너지 충전 거의 완료!",
        "🎉 휴식도 마무리단계네요!"
      ],
      short_early_paused: [
        "😴 충분히 쉬어가세요!",
        "☁️ 여유롭게 시간을 보내세요!",
        "🌙 편안하게 쉬어요!"
      ],
      short_middle_paused: [
        "🍃 마음을 편히 가져보세요!",
        "🌸 천천히 재충전하세요!",
        "✨ 조용한 시간을 즐겨요!"
      ],
      short_late_paused: [
        "🌈 곧 다시 시작할 준비 되셨나요?",
        "⚡ 에너지 충전 완료 임박!",
        "🎉 준비되면 다시 시작해요!"
      ],

      // 긴 휴식
      long_early_active: [
        "🏖️ 긴 휴식의 시작이에요!",
        "🛋️ 충분히 쉬어가세요!",
        "☁️ 여유롭게 시간을 보내세요!"
      ],
      long_middle_active: [
        "🌴 휴식의 중간지점이에요!",
        "🌙 마음이 편안해지고 있나요?",
        "🕯️ 충분히 재충전하고 있어요!"
      ],
      long_late_active: [
        "🔋 곧 상쾌한 기분으로 돌아가요!",
        "🌅 긴 휴식도 끝이 보여요!",
        "🎊 에너지가 가득 충전됐어요!"
      ],
      long_early_paused: [
        "🌙 충분히 쉬어가세요!",
        "☁️ 여유롭게 시간을 보내세요!",
        "🛋️ 편안하게 휴식하세요!"
      ],
      long_middle_paused: [
        "🌴 천천히 재충전 중이네요!",
        "🌙 마음의 평안을 찾으세요!",
        "🕯️ 고요한 시간을 즐겨요!"
      ],
      long_late_paused: [
        "🌅 휴식도 마무리 단계네요!",
        "🔋 충분히 쉬었나요?",
        "🎊 준비되면 새로 시작해요!"
      ]
    };

    logger.debug("🎨 TimerRenderer 생성됨 (표준 준수 + 실시간 UI)");
  }

  /**
   * 🎯 메인 렌더링 메서드 (표준 구현)
   */
  async render(result, ctx) {
    const { type, data } = result;

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
        case "timer_status":
          return await this.renderTimerStatus(data, ctx);
        case "live_update_toggled":
          return await this.renderLiveUpdateToggled(data, ctx);
        case "no_timer":
          return await this.renderNoTimer(data, ctx);
        case "help":
          return await this.renderHelp(data, ctx);
        case "error":
          return await this.renderError(data, ctx);
        default:
          return await this.renderError(
            { message: `지원하지 않는 기능입니다: ${type}` },
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

  // ===== 🎨 렌더링 메서드들 (UI 생성 전담!) =====

  /**
   * 📊 실시간 업데이트용 상태 텍스트 생성 (TimerModule에서 사용)
   * @param {object} timerData - 타이머 데이터
   * @param {object} motivationData - 동기부여 데이터
   * @returns {string} 포맷된 텍스트 (Telegram 메시지용)
   */
  renderStatus(timerData, motivationData = {}) {
    try {
      const { timer } = timerData;

      if (!timer) {
        return "❌ 타이머 정보를 찾을 수 없습니다.";
      }

      const progressBar = this.createProgressBar(timer);
      const statusIcon = this.getStatusIcon(timer);
      const motivationMsg = this.getMotivationMessage(motivationData);
      const detailedInfo = this.createDetailedTimeInfo(timer);

      // Telegram MarkdownV2 호환 텍스트 생성
      let text = `${statusIcon} *타이머 실시간 상태*\n\n`;
      text += `${progressBar}\n\n`;
      text += `${detailedInfo}\n\n`;
      text += `🎯 *타입*: ${this.getTimerTypeDisplay(timer.type)}\n`;
      text += `📊 *진행률*: ${timer.progress}%\n`;
      text += `⏸️ *상태*: ${timer.isPaused ? "일시정지" : "실행중"}\n\n`;
      text += `💬 ${motivationMsg}`;

      return text;
    } catch (error) {
      logger.error("TimerRenderer.renderStatus 오류:", error);
      return "❌ 상태 표시 중 오류가 발생했습니다.";
    }
  }

  /**
   * 🍅 메뉴 렌더링 (실시간 UI 포함)
   */
  async renderMenu(data, ctx) {
    const { userName, activeTimer, config, _timerTypes } = data;

    let text = `🍅 **뽀모도로 타이머**\n\n`;
    text += `안녕하세요, ${userName}님! 🌟\n\n`;

    if (activeTimer) {
      // 활성 타이머가 있을 때 - 화려한 시각적 표시
      const progressBar = this.createProgressBar(activeTimer);
      const statusIcon = this.getStatusIcon(activeTimer);
      const motivationMsg = this.getMotivationMessage(
        data.motivationData || {}
      );

      text += `${statusIcon} **실행 중인 타이머**\n\n`;
      text += `${progressBar}\n\n`;
      text += `🎯 **타입**: ${this.getTimerTypeDisplay(activeTimer.type)}\n`;
      text += `📊 **상태**: ${activeTimer.isPaused ? "일시정지" : "실행중"}\n\n`;
      text += `💬 ${motivationMsg}\n\n`;
    } else {
      text += `집중력 향상을 위한 뽀모도로 기법을 사용해보세요!\n\n`;
      text += `**시작할 타이머를 선택하세요:**\n`;
    }

    const buttons = this.buildMenuButtons(activeTimer, config);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 타이머 시작 렌더링 (화려한 시각적 피드백)
   */
  async renderTimerStarted(data, ctx) {
    const { timer, message, motivationData } = data;

    const progressBar = this.createProgressBar(timer);
    const statusIcon = this.getStatusIcon(timer);
    const motivationMsg = this.getMotivationMessage(motivationData);

    const text = `${statusIcon} ${message}

${progressBar}

🎯 **타입**: ${this.getTimerTypeDisplay(timer.type)}
📊 **진행률**: ${timer.progress}%

💬 ${motivationMsg}

${this.getTimerTips(timer.type)}`;

    const buttons = this.buildActiveTimerButtons(timer);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏸️ 일시정지 렌더링 (시각적 상태 변화)
   */
  async renderTimerPaused(data, ctx) {
    const { timer, message, motivationData } = data;

    const progressBar = this.createProgressBar(timer);
    const statusIcon = this.getStatusIcon(timer);
    const motivationMsg = this.getMotivationMessage(motivationData);

    const text = `${statusIcon} ${message}

${progressBar}

🎯 **타입**: ${this.getTimerTypeDisplay(timer.type)}
📊 **진행률**: ${timer.progress}%

💬 ${motivationMsg}

⏰ 언제든 재개할 수 있습니다.`;

    const buttons = this.buildPausedTimerButtons(timer);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 재개 렌더링 (활력 넘치는 UI)
   */
  async renderTimerResumed(data, ctx) {
    const { timer, message, motivationData } = data;

    const progressBar = this.createProgressBar(timer);
    const statusIcon = this.getStatusIcon(timer);
    const motivationMsg = this.getMotivationMessage(motivationData);

    const text = `${statusIcon} ${message}

${progressBar}

🎯 **타입**: ${this.getTimerTypeDisplay(timer.type)}
📊 **진행률**: ${timer.progress}%

💬 ${motivationMsg}

🚀 다시 집중 모드로 돌아왔어요!`;

    const buttons = this.buildActiveTimerButtons(timer);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏹️ 중지 렌더링 (성취감 있는 마무리)
   */
  async renderTimerStopped(data, ctx) {
    const { message, elapsedTime, completionRate } = data;

    let completionIcon = "👏";
    let completionMessage = "수고하셨습니다!";

    if (completionRate >= 90) {
      completionIcon = "🎉";
      completionMessage = "완벽한 집중이었어요!";
    } else if (completionRate >= 70) {
      completionIcon = "🌟";
      completionMessage = "훌륭한 집중력이었어요!";
    } else if (completionRate >= 50) {
      completionIcon = "👍";
      completionMessage = "좋은 시작이었어요!";
    }

    const text = `${completionIcon} ${message}

⏱️ **경과 시간**: ${elapsedTime}
📊 **완료율**: ${completionRate}%

${completionMessage} 🎯

**다음 단계:**
${this.getNextStepSuggestion(completionRate)}`;

    const buttons = [
      [
        { text: "🍅 새 타이머", action: "menu" },
        { text: "📊 통계 보기", action: "stats" }
      ],
      [{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 상태 렌더링 (상세한 실시간 정보)
   */
  async renderTimerStatus(data, ctx) {
    const { timer, motivationData, canEnableLiveUpdate } = data;

    const progressBar = this.createProgressBar(timer);
    const statusIcon = this.getStatusIcon(timer);
    const motivationMsg = this.getMotivationMessage(motivationData);
    const detailedInfo = this.createDetailedTimeInfo(timer);

    const text = `${statusIcon} **타이머 상세 상태**

${progressBar}

${detailedInfo}

🎯 **타입**: ${this.getTimerTypeDisplay(timer.type)}
📊 **진행률**: ${timer.progress}%
⏸️ **상태**: ${timer.isPaused ? "일시정지" : "실행중"}

💬 ${motivationMsg}

${this.getProgressAnalysis(timer)}`;

    const buttons = this.buildStatusButtons(timer, canEnableLiveUpdate);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🔄 실시간 업데이트 토글 렌더링
   */
  async renderLiveUpdateToggled(data, ctx) {
    const { timer, enabled, message } = data;

    const progressBar = this.createProgressBar(timer);
    const statusIcon = enabled ? "🔄" : "⏹️";

    const text = `${statusIcon} ${message}

${progressBar}

🎯 **타입**: ${this.getTimerTypeDisplay(timer.type)}
📊 **진행률**: ${timer.progress}%

${enabled ? "✨ 이제 5초마다 자동으로 업데이트됩니다!" : "📱 수동 새로고침 모드로 변경되었습니다."}`;

    const buttons = this.buildActiveTimerButtons(timer);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🚫 타이머 없음 렌더링 (격려하는 UI)
   */
  async renderNoTimer(data, ctx) {
    const { message, suggestion } = data;

    const text = `🍅 **뽀모도로 타이머**

${message}

${suggestion}

**추천 시작법:**
🚀 처음이신가요? **집중 (25분)**으로 시작해보세요!
☕ 잠깐 쉬고 싶다면 **짧은 휴식 (5분)**을 선택하세요!
🌴 충분한 휴식이 필요하다면 **긴 휴식 (15분)**을 권장해요!`;

    const buttons = [
      [
        { text: "🍅 집중 (25분)", action: "start", params: "focus" },
        { text: "☕ 짧은 휴식 (5분)", action: "start", params: "short" }
      ],
      [
        { text: "🌴 긴 휴식 (15분)", action: "start", params: "long" },
        { text: "❓ 도움말", action: "help" }
      ],
      [{ text: "🔙 메뉴", action: "menu", module: "system" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { title, sections, tips } = data;

    let text = `❓ **${title}**\n\n`;

    sections.forEach((section) => {
      text += `**${section.title}**\n`;
      section.items.forEach((item) => {
        text += `${item}\n`;
      });
      text += `\n`;
    });

    if (tips && tips.length > 0) {
      text += `💡 **유용한 팁**\n`;
      tips.forEach((tip) => {
        text += `• ${tip}\n`;
      });
    }

    const buttons = [
      [
        { text: "🍅 바로 시작", action: "start", params: "focus" },
        { text: "📊 내 통계", action: "stats" }
      ],
      [{ text: "🔙 메뉴로", action: "menu", module: "system" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링 (친근한 에러 UI)
   */
  async renderError(data, ctx) {
    // ✅ 수정: data 구조 안전하게 처리
    const {
      message = "알 수 없는 오류가 발생했습니다.",
      action = "menu",
      canRetry = false
    } = data || {};

    const text = `❌ **앗, 문제가 생겼어요!**

${message}

걱정마세요! 다시 시도하거나 메뉴로 돌아가면 됩니다. 🌟`;

    const buttons = [];

    if (canRetry) {
      buttons.push([{ text: "🔄 다시 시도", action: action }]);
    }

    buttons.push([
      { text: "🍅 새 타이머", action: "start", params: "focus" },
      { text: "🔙 메인 메뉴", action: "menu", module: "system" }
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ✅ 추가: renderStats 메서드 구현
  async renderStats(data, ctx) {
    const { userName, stats, period } = data;

    let text = `📊 **${userName}님의 타이머 통계** (${period})\n\n`;

    if (stats.totalSessions === 0) {
      text += `아직 완료된 세션이 없어요.\n새로운 타이머를 시작해보세요! 🚀`;
    } else {
      text += `✅ **총 완료 세션**: ${stats.totalSessions}개\n`;
      text += `⏱️ **총 시간**: ${Math.round(stats.totalMinutes)}분\n`;
      text += `📈 **완료율**: ${stats.completionRate}%\n`;
      text += `🔥 **연속 기록**: ${stats.streak.current}일 (최고: ${stats.streak.longest}일)\n\n`;

      text += `**타입별 통계**\n`;
      text += `🍅 집중: ${stats.typeCounts.focus}회\n`;
      text += `☕ 짧은 휴식: ${stats.typeCounts.shortBreak}회\n`;
      text += `🌴 긴 휴식: ${stats.typeCounts.longBreak}회\n\n`;

      text += `**평균**\n`;
      text += `📅 하루 평균: ${stats.averageSessionsPerDay}회\n`;
      text += `⏰ 하루 평균: ${Math.round(stats.averageMinutesPerDay)}분\n\n`;

      text += `💡 **가장 좋아하는 타입**: ${this.getTypeDisplay(stats.favoriteType)}`;
    }

    const buttons = [
      [
        { text: "🔄 새로고침", action: "stats" },
        { text: "📊 상세 보기", action: "status" }
      ],
      [
        { text: "🍅 새 타이머", action: "start", params: "focus" },
        { text: "🔙 메뉴", action: "menu", module: "system" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
  // ===== 🎨 UI 헬퍼 메서드들 (시각적 요소 생성 전담!) =====

  /**
   * 📊 화려한 진행률 바 생성
   */
  createProgressBar(timer) {
    const progress = Math.min(100, Math.max(0, timer.progress || 0));
    const filledBlocks = Math.floor(
      (progress / 100) * this.uiConstants.PROGRESS_BAR_LENGTH
    );
    const emptyBlocks = this.uiConstants.PROGRESS_BAR_LENGTH - filledBlocks;

    const filled = this.uiConstants.FILLED_CHAR.repeat(filledBlocks);
    const empty = this.uiConstants.EMPTY_CHAR.repeat(emptyBlocks);

    return `${filled}${empty} ${progress}%`;
  }

  /**
   * 🎯 상태 아이콘 선택
   */
  getStatusIcon(timer) {
    if (timer.isPaused) return this.uiConstants.STATUS_ICONS.paused;
    if (timer.isCompleted) return this.uiConstants.STATUS_ICONS.completed;
    return this.uiConstants.STATUS_ICONS.running;
  }

  /**
   * 💬 동기부여 메시지 선택
   */
  getMotivationMessage(motivationData) {
    const {
      type = "focus",
      stage = "middle",
      isPaused = false
    } = motivationData;

    const messageKey = `${type}_${stage}_${isPaused ? "paused" : "active"}`;
    const messages = this.motivationMessages[messageKey] || [
      "💪 계속 화이팅하세요!"
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * 🏷️ 타이머 타입 표시명 변환
   */
  getTimerTypeDisplay(type) {
    const displays = {
      focus: "🍅 집중 시간",
      short: "☕ 짧은 휴식",
      long: "🌴 긴 휴식",
      custom: "⚙️ 사용자 정의"
    };

    return displays[type] || `🔹 ${type}`;
  }

  /**
   * 📋 상세 시간 정보 생성
   */
  createDetailedTimeInfo(timer) {
    const { remainingTime, elapsedTime, totalDuration } = timer;

    let info = `⏱️ *경과시간*: ${this.formatTime(elapsedTime)}\n`;
    info += `⏰ *남은시간*: ${this.formatTime(remainingTime)}\n`;
    info += `📏 *전체시간*: ${this.formatTime(totalDuration)}`;

    return info;
  }

  /**
   * 🕐 시간 포맷팅 (분:초)
   */
  formatTime(seconds) {
    if (!seconds || seconds < 0) return "00:00";

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * 📈 진행률 분석 생성
   */
  getProgressAnalysis(timer) {
    const { progressData } = timer;
    const { stage } = progressData;

    if (stage === "early") {
      return "🚀 좋은 시작입니다! 이 페이스를 유지하세요.";
    } else if (stage === "middle") {
      return "💪 중간 지점을 통과했습니다! 계속 집중하세요.";
    } else {
      return "🔥 거의 다 왔습니다! 마지막 스퍼트를 내봅시다!";
    }
  }

  /**
   * 💡 타이머별 팁 제공
   */
  getTimerTips(timerType) {
    const tips = {
      focus: "💡 **팁**: 한 가지 작업에만 집중하고, 알림을 꺼두세요!",
      short: "💡 **팁**: 스트레칭하거나 물을 마시며 잠깐 쉬어보세요!",
      long: "💡 **팁**: 산책하거나 가벼운 간식을 드시며 충분히 쉬세요!"
    };

    return tips[timerType] || "💡 **팁**: 자신만의 리듬을 찾아보세요!";
  }

  /**
   * 🎯 다음 단계 제안
   */
  getNextStepSuggestion(completionRate) {
    if (completionRate >= 90) {
      return "• 완벽한 집중이었어요! 이제 5분 휴식을 권장합니다.\n• 4회 집중 후에는 15분 긴 휴식을 해보세요.";
    } else if (completionRate >= 70) {
      return "• 좋은 성과였어요! 잠깐 휴식 후 다시 시작해보세요.\n• 집중력을 더 높이려면 알림을 꺼보세요.";
    } else {
      return "• 괜찮아요! 처음엔 이럴 수 있어요.\n• 더 짧은 시간(15분)부터 시작해보세요.\n• 환경을 정리하고 다시 도전해봐요!";
    }
  }

  // ===== 🎹 버튼 생성 메서드들 (UI 구성 전담!) =====

  /**
   * 🍅 메뉴 버튼 구성
   */
  buildMenuButtons(activeTimer, config) {
    const buttons = [];

    if (activeTimer) {
      // 활성 타이머가 있을 때
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

      buttons.push([
        { text: "📊 상태 확인", action: "status" },
        { text: "🔄 실시간 토글", action: "live" }
      ]);
    } else {
      // 새 타이머 시작 버튼들
      buttons.push([
        {
          text: `🍅 집중 (${config.focusDuration}분)`,
          action: "start",
          params: "focus"
        },
        {
          text: `☕ 짧은 휴식 (${config.shortBreak}분)`,
          action: "start",
          params: "short"
        }
      ]);

      buttons.push([
        {
          text: `🌴 긴 휴식 (${config.longBreak}분)`,
          action: "start",
          params: "long"
        },
        { text: "⏱️ 커스텀", action: "start", params: "30" }
      ]);

      buttons.push([
        { text: "📊 내 통계", action: "stats" },
        { text: "❓ 도움말", action: "help" }
      ]);
    }

    buttons.push([{ text: "🔙 메인 메뉴", action: "menu", module: "system" }]);
    return buttons;
  }

  /**
   * ▶️ 활성 타이머 버튼 구성
   */
  buildActiveTimerButtons(timer) {
    const buttons = [];

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

    buttons.push([
      { text: "📊 상세 보기", action: "status" },
      { text: "🔄 새로고침", action: "refresh" }
    ]);

    // 실시간 업데이트 버튼
    if (timer.statusData?.hasLiveUpdate) {
      buttons.push([{ text: "⏹️ 실시간 끄기", action: "live" }]);
    } else {
      buttons.push([{ text: "🔄 실시간 켜기", action: "live" }]);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu", module: "system" }]);
    return buttons;
  }

  /**
   * ⏸️ 일시정지된 타이머 버튼 구성
   */
  buildPausedTimerButtons(timer) {
    return [
      [
        { text: "▶️ 재개", action: "resume" },
        { text: "⏹️ 중지", action: "stop" }
      ],
      [
        { text: "🔄 새로고침", action: "refresh" },
        { text: "📊 상세 보기", action: "status" }
      ],
      [{ text: "🔙 메뉴", action: "menu", module: "system" }]
    ];
  }

  /**
   * 📊 상태 보기 버튼 구성
   */
  buildStatusButtons(timer, canEnableLiveUpdate) {
    const buttons = [];

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

    buttons.push([
      { text: "🔄 새로고침", action: "refresh" },
      { text: "📈 진행률 분석", action: "stats" }
    ]);

    if (canEnableLiveUpdate) {
      if (timer.statusData?.hasLiveUpdate) {
        buttons.push([{ text: "⏹️ 실시간 업데이트 끄기", action: "live" }]);
      } else {
        buttons.push([{ text: "🔄 실시간 업데이트 켜기", action: "live" }]);
      }
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu", module: "system" }]);
    return buttons;
  }

  /**
   * 🎨 추가 UI 유틸리티들
   */

  /**
   * 🌟 성취 뱃지 생성
   */
  getAchievementBadge(completionRate) {
    if (completionRate >= 100) return "🏆 완벽한 집중!";
    if (completionRate >= 90) return "🥇 최고 수준!";
    if (completionRate >= 80) return "🥈 훌륭해요!";
    if (completionRate >= 70) return "🥉 좋은 성과!";
    if (completionRate >= 50) return "👍 괜찮은 시작!";
    return "💪 다음엔 더 잘할 수 있어요!";
  }

  /**
   * 📱 실시간 업데이트 안내 메시지
   */
  getLiveUpdateInfo(enabled) {
    if (enabled) {
      return `🔄 **실시간 업데이트 활성화됨**
• 5초마다 자동으로 진행률이 업데이트됩니다
• 일시정지하면 자동으로 비활성화됩니다
• 언제든 끌 수 있습니다`;
    } else {
      return `📱 **수동 새로고침 모드**
• 🔄 새로고침 버튼으로 상태를 확인하세요
• 배터리 절약에 도움이 됩니다
• 실시간 업데이트를 켜면 자동으로 갱신됩니다`;
    }
  }

  /**
   * 🎯 집중력 팁 랜덤 선택
   */
  getRandomFocusTip() {
    const tips = [
      "🔕 알림을 모두 끄고 집중해보세요",
      "🌱 책상을 깔끔하게 정리하면 집중력이 향상돼요",
      "💧 물을 충분히 마시며 뇌에 수분을 공급하세요",
      "🎵 백색소음이나 클래식 음악을 들어보세요",
      "🌅 자연광이 있는 곳에서 작업하면 더 좋아요",
      "📝 작업 전에 오늘의 목표를 명확히 정하세요",
      "🏃‍♂️ 집중 전 가벼운 스트레칭으로 몸을 풀어주세요",
      "🧘‍♀️ 심호흡을 3회 하고 마음을 가라앉혀보세요"
    ];

    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * 🔄 상태 변화 애니메이션 효과 (텍스트 기반)
   */
  getStatusChangeEffect(fromStatus, toStatus) {
    const effects = {
      running_to_paused: "⏸️ 타이머가 멈췄습니다... 잠시 휴식하세요 💫",
      paused_to_running: "▶️ 다시 시작합니다! 집중 모드 ON 🔥",
      running_to_stopped: "⏹️ 타이머가 종료되었습니다. 수고하셨어요! 👏",
      stopped_to_running: "🚀 새로운 타이머가 시작됩니다! 화이팅! ⚡"
    };

    const effectKey = `${fromStatus}_to_${toStatus}`;
    return effects[effectKey] || "✨ 상태가 변경되었습니다!";
  }

  /**
   * 📊 프로그레스 히스토리 표시 (간단한 시각화)
   */
  createProgressHistory(sessions = []) {
    if (!sessions.length) return "📈 아직 기록이 없습니다.";

    let history = "📊 **최근 세션 기록**\n";

    sessions.slice(-5).forEach((session, index) => {
      const completionIcon =
        session.completion >= 90
          ? "🟢"
          : session.completion >= 70
            ? "🟡"
            : "🔴";
      history += `${completionIcon} ${session.type} - ${session.completion}%\n`;
    });

    return history;
  }
}

module.exports = TimerRenderer;
