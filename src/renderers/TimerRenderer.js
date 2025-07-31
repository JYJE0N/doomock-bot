const BaseRenderer = require("./BaseRenderer");

/**
 * 🍅 TimerRenderer - 타이머 UI 렌더링 (심플 버전)
 */
class TimerRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "timer";
  }

  async render(result, ctx) {
    const { type, data } = result;

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
      case "no_timer":
        return await this.renderNoTimer(data, ctx);
      case "error":
        return await this.renderError(data, ctx);
      default:
        return await this.renderError(
          { message: "지원하지 않는 기능입니다." },
          ctx
        );
    }
  }

  /**
   * 🍅 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    let text = `🍅 **뽀모도로 타이머**\n\n`;

    if (data.activeTimer) {
      const timer = data.activeTimer;
      text += `⏱️ **실행 중**: ${timer.displayTime}\n`;
      text += `📊 **진행률**: ${timer.progress}%\n`;
      text += `🎯 **타입**: ${timer.type}\n\n`;
    } else {
      text += `집중력 향상을 위한 뽀모도로 기법을 사용해보세요!\n\n`;
    }

    text += `**시작할 타이머를 선택하세요:**`;

    const buttons = [];

    if (data.activeTimer) {
      // 실행 중인 타이머가 있을 때
      if (data.activeTimer.isPaused) {
        buttons.push([
          { text: "▶️ 재개", action: "resume" },
          { text: "⏹️ 중지", action: "stop" },
        ]);
      } else {
        buttons.push([
          { text: "⏸️ 일시정지", action: "pause" },
          { text: "⏹️ 중지", action: "stop" },
        ]);
      }
      buttons.push([{ text: "📊 상태 확인", action: "status" }]);
    } else {
      // 타이머가 없을 때
      buttons.push([
        { text: "🍅 집중 (25분)", action: "start", params: "focus" },
        { text: "☕ 짧은 휴식 (5분)", action: "start", params: "short" },
      ]);
      buttons.push([
        { text: "🌴 긴 휴식 (15분)", action: "start", params: "long" },
        { text: "⏱️ 커스텀", action: "start", params: "30" },
      ]);
    }

    buttons.push([{ text: "🔙 메인 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(
      buttons,
      data.activeTimer ? this.moduleName : "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 타이머 시작 렌더링
   */
  async renderTimerStarted(data, ctx) {
    const { timer, message } = data;

    const text = `${message}

⏱️ **남은 시간**: ${timer.displayTime}
🎯 **타입**: ${timer.type}
📊 **진행률**: ${timer.progress}%

집중해서 작업해보세요! 💪`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "⏸️ 일시정지", action: "pause" },
          { text: "⏹️ 중지", action: "stop" },
        ],
        [{ text: "📊 상태 확인", action: "status" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏸️ 일시정지 렌더링
   */
  async renderTimerPaused(data, ctx) {
    const { timer, message } = data;

    const text = `${message}

⏱️ **남은 시간**: ${timer.displayTime}
📊 **진행률**: ${timer.progress}%

언제든 재개할 수 있습니다.`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "▶️ 재개", action: "resume" },
          { text: "⏹️ 중지", action: "stop" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ▶️ 재개 렌더링
   */
  async renderTimerResumed(data, ctx) {
    const { timer, message } = data;

    const text = `${message}

⏱️ **남은 시간**: ${timer.displayTime}
📊 **진행률**: ${timer.progress}%

다시 집중해보세요! 🎯`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "⏸️ 일시정지", action: "pause" },
          { text: "⏹️ 중지", action: "stop" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏹️ 중지 렌더링
   */
  async renderTimerStopped(data, ctx) {
    const text = `${data.message}

⏱️ **경과 시간**: ${data.elapsedTime}

수고하셨습니다! 🎉`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🍅 새 타이머", action: "menu" },
          { text: "🔙 메인 메뉴", action: "menu" },
        ],
      ],
      "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 상태 렌더링
   */
  async renderTimerStatus(data, ctx) {
    const { timer } = data;

    const text = `📊 **타이머 상태**

⏱️ **남은 시간**: ${timer.displayTime}
🎯 **타입**: ${timer.type}
📊 **진행률**: ${timer.progress}%
⏸️ **상태**: ${timer.isPaused ? "일시정지" : "실행중"}`;

    const buttons = [];

    if (timer.isPaused) {
      buttons.push([
        { text: "▶️ 재개", action: "resume" },
        { text: "⏹️ 중지", action: "stop" },
      ]);
    } else {
      buttons.push([
        { text: "⏸️ 일시정지", action: "pause" },
        { text: "⏹️ 중지", action: "stop" },
      ]);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 타이머 없음 렌더링
   */
  async renderNoTimer(data, ctx) {
    const text = `🍅 **뽀모도로 타이머**

${data.message}

새로운 타이머를 시작해보세요!`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🍅 집중 (25분)", action: "start", params: "focus" },
          { text: "☕ 짧은 휴식 (5분)", action: "start", params: "short" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const text = `❌ **오류 발생**

${data.message}

다시 시도해주세요.`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "🔙 메인 메뉴", action: "menu" },
        ],
      ],
      "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = TimerRenderer;
