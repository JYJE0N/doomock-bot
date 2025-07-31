// src/renderers/TimerRenderer.js - MarkdownV2 완벽 이스케이프 수정 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🍅 TimerRenderer - 뽀모도로 타이머 UI 렌더링
 *
 * 🎯 책임:
 * - 뽀모도로 관련 모든 UI 생성
 * - 메시지 포맷팅 (MarkdownV2 완벽 이스케이프)
 * - 인라인 키보드 생성
 * - 진행 상황 시각화
 *
 * ✅ SoC: UI 렌더링만 담당, 비즈니스 로직은 다루지 않음
 * ✅ MarkdownV2 완벽 이스케이프 처리로 400 에러 방지
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
   * 🛡️ 안전한 텍스트 포맷팅 - ✅ 핵심 수정!
   * 모든 텍스트는 이 메서드를 통해 안전하게 이스케이프됩니다
   */
  formatText(text) {
    return this.escapeMarkdownV2(text);
  }

  /**
   * 📋 메인 메뉴 렌더링 - ✅ 완벽 이스케이프 적용
   */
  renderMenu(data) {
    const { activeTimer, stats, config } = data;

    // 기본 헤더 - 안전하게 이스케이프
    let text = `${this.emojis.focus} *뽀모도로 타이머*\n\n`;

    // 활성 타이머가 있는 경우
    if (activeTimer) {
      text += this.renderActiveTimer(activeTimer);
      text += "\n\n";

      // 활성 타이머용 키보드
      return {
        text: this.formatText(text), // ✅ 안전한 이스케이프
        keyboard: this.createActiveTimerKeyboard(activeTimer),
      };
    }

    // 오늘의 통계 - ✅ 모든 숫자와 텍스트 안전하게 처리
    if (stats) {
      text += `📅 *오늘의 기록*\n`;
      text += `• 완료한 집중: ${this.formatText(
        String(stats.focusCompleted)
      )}개\n`;
      text += `• 총 집중 시간: ${this.formatText(
        String(stats.totalMinutes)
      )}분\n`;
      text += `• 생산성: ${this.formatText(
        String(stats.productivityRate)
      )}%\n\n`;
    }

    // 타이머 설정 - ✅ 설정값들도 안전하게 처리
    text += `⏱️ *타이머 설정*\n`;
    text += `• 집중 시간: ${this.formatText(String(config.focusDuration))}분\n`;
    text += `• 짧은 휴식: ${this.formatText(
      String(config.shortBreakDuration)
    )}분\n`;
    text += `• 긴 휴식: ${this.formatText(
      String(config.longBreakDuration)
    )}분\n`;

    return {
      text: this.formatText(text), // ✅ 전체 텍스트 안전 처리
      keyboard: this.createMenuKeyboard(),
    };
  }

  /**
   * 📋 메인 메뉴 렌더링 응답
   */
  async renderMenuResponse(data, ctx) {
    const rendered = this.renderMenu(data);

    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * ▶️ 타이머 시작 렌더링 - ✅ 완벽 이스케이프
   */
  renderTimerStarted(data) {
    const { session, remainingTime, type } = data;
    const emoji = this.emojis[type];
    const minutes = Math.floor(remainingTime / 60);

    let text = `${emoji} *${this.formatText(
      this.getSessionTypeName(type)
    )} 시작!*\n\n`;
    text += `⏱️ 남은 시간: ${this.formatText(String(minutes))}분\n`;
    text += this.renderProgressBar(session.duration * 60, remainingTime);
    text += "\n\n💪 집중해서 작업하세요!";

    return {
      text: this.formatText(text),
      keyboard: this.createActiveTimerKeyboard({ isPaused: false }),
    };
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
   * ⏸️ 타이머 일시정지 렌더링 - ✅ 완벽 이스케이프
   */
  renderTimerPaused(data) {
    const { remainingTime } = data;
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    let text = `${this.emojis.paused} *타이머 일시정지*\n\n`;
    text += `⏱️ 남은 시간: ${this.formatText(
      String(minutes)
    )}분 ${this.formatText(String(seconds))}초\n\n`;
    text += `타이머가 일시정지되었습니다${this.formatText(".")}`; // ✅ 마침표 이스케이프

    return {
      text: this.formatText(text),
      keyboard: this.createActiveTimerKeyboard({ isPaused: true }),
    };
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
   * ▶️ 타이머 재개 렌더링 - ✅ 완벽 이스케이프
   */
  renderTimerResumed(data) {
    const { remainingTime } = data;
    const minutes = Math.floor(remainingTime / 60);

    let text = `${this.emojis.active} *타이머 재개*\n\n`;
    text += `⏱️ 남은 시간: ${this.formatText(String(minutes))}분\n\n`;
    text += `다시 집중해봅시다${this.formatText("!")} 💪`; // ✅ 느낌표 이스케이프

    return {
      text: this.formatText(text),
      keyboard: this.createActiveTimerKeyboard({ isPaused: false }),
    };
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
   * ⏹️ 타이머 중지 렌더링 - ✅ 완벽 이스케이프
   */
  renderTimerStopped(data) {
    const { summary } = data;

    let text = `${this.emojis.stopped} *타이머 중지*\n\n`;

    if (summary && summary.completedPercentage) {
      text += `진행률: ${this.formatText(
        String(summary.completedPercentage)
      )}%\n\n`;

      if (summary.completedPercentage >= 80) {
        text += `거의 다 했네요${this.formatText("!")} 🎉\n`;
      } else if (summary.completedPercentage >= 50) {
        text += `절반 이상 완료했어요${this.formatText("!")} 👍\n`;
      } else {
        text += `조금 더 집중해보세요${this.formatText("!")} 💪\n`;
      }
    }

    text += `다음에는 끝까지 완료해보세요${this.formatText("!")}`; // ✅ 모든 특수문자 이스케이프

    return {
      text: this.formatText(text),
      keyboard: this.createBackKeyboard(),
    };
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
   * 📜 히스토리 응답 렌더링 - ✅ 핵심 수정!
   */
  async renderHistoryResponse(data, ctx) {
    const rendered = this.renderHistory(data);

    // ✅ 안전한 메시지 전송 (에러 방지)
    await ctx.editMessageText(rendered.text, {
      parse_mode: "MarkdownV2",
      reply_markup: rendered.keyboard,
    });
  }

  /**
   * 📜 히스토리 렌더링 - ✅ 완벽 이스케이프 적용
   */
  renderHistory(data) {
    const { history, period } = data;

    let text = `📜 *타이머 히스토리 \\(${this.formatText(period)}\\)*\n\n`;

    if (!history || history.length === 0) {
      text += `아직 기록이 없습니다${this.formatText(".")}\n`;
      text += `타이머를 시작해보세요${this.formatText("!")}`;
    } else {
      // ✅ 히스토리 데이터 안전하게 처리
      history.forEach((record, index) => {
        const date = this.formatText(record.date || "날짜 없음");
        const sessions = this.formatText(String(record.sessions || 0));
        const minutes = this.formatText(String(record.totalMinutes || 0));
        const rate = this.formatText(String(record.productivityRate || 0));

        text += `📅 ${date}\n`;
        text += `• 세션: ${sessions}개\n`;
        text += `• 시간: ${minutes}분\n`;
        text += `• 생산성: ${rate}%\n`;

        if (index < history.length - 1) {
          text += `\n`;
        }
      });
    }

    return {
      text: this.formatText(text), // ✅ 전체 텍스트 안전 처리
      keyboard: this.createBackKeyboard(),
    };
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

  // ===== 🎨 UI 생성 헬퍼 메서드들 =====

  /**
   * 📊 활성 타이머 정보 표시 - ✅ 완벽 이스케이프
   */
  renderActiveTimer(timer) {
    const emoji = this.emojis[timer.type];
    const sessionName = this.formatText(this.getSessionTypeName(timer.type));
    const minutes = Math.floor(timer.remainingTime / 60);
    const seconds = timer.remainingTime % 60;

    let text = `${emoji} *현재 ${sessionName}*\n`;
    text += `⏱️ 남은 시간: ${this.formatText(
      String(minutes)
    )}분 ${this.formatText(String(seconds))}초\n`;

    if (timer.isPaused) {
      text += `⏸️ 일시정지 중`;
    } else {
      text += `▶️ 진행 중`;
    }

    return text;
  }

  /**
   * 📊 진행바 생성 - ✅ 완벽 이스케이프
   */
  renderProgressBar(totalTime, remainingTime) {
    const progress = (totalTime - remainingTime) / totalTime;
    const filledBars = Math.floor(progress * this.progressBarLength);
    const emptyBars = this.progressBarLength - filledBars;

    const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);
    const percentage = Math.floor(progress * 100);

    return `${this.formatText(progressBar)} ${this.formatText(
      String(percentage)
    )}%`;
  }

  /**
   * 📊 세션 타입 이름 가져오기
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
   * 📊 통계 렌더링 - ✅ 완벽 이스케이프
   */
  renderStats(data) {
    const { stats } = data;

    let text = `📊 *타이머 통계*\n\n`;

    if (stats) {
      text += `📅 기간: ${this.formatText(stats.period || "알 수 없음")}\n`;
      text += `🍅 완료 세션: ${this.formatText(
        String(stats.completedSessions || 0)
      )}개\n`;
      text += `⏱️ 총 시간: ${this.formatText(
        String(stats.totalMinutes || 0)
      )}분\n`;
      text += `📈 생산성: ${this.formatText(
        String(stats.productivityRate || 0)
      )}%\n`;
      text += `🔥 연속 기록: ${this.formatText(String(stats.streak || 0))}일\n`;
    } else {
      text += `아직 통계가 없습니다${this.formatText(".")}\n`;
      text += `타이머를 사용해보세요${this.formatText("!")}`;
    }

    return {
      text: this.formatText(text),
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * 📊 상태 렌더링 - ✅ 완벽 이스케이프
   */
  renderStatus(data) {
    let text = `📊 *타이머 상태*\n\n`;

    if (data.activeTimer) {
      text += this.renderActiveTimer(data.activeTimer);
    } else {
      text += `현재 활성 타이머가 없습니다${this.formatText(".")}\n`;
      text += `새 타이머를 시작해보세요${this.formatText("!")}`;
    }

    return {
      text: this.formatText(text),
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * ⚙️ 설정 렌더링 - ✅ 완벽 이스케이프
   */
  renderSettings(data) {
    const { config } = data;

    let text = `⚙️ *타이머 설정*\n\n`;
    text += `🍅 집중 시간: ${this.formatText(
      String(config.focusDuration)
    )}분\n`;
    text += `☕ 짧은 휴식: ${this.formatText(
      String(config.shortBreakDuration)
    )}분\n`;
    text += `🌴 긴 휴식: ${this.formatText(
      String(config.longBreakDuration)
    )}분\n`;
    text += `🔄 긴 휴식 주기: ${this.formatText(
      String(config.longBreakInterval)
    )}회마다\n`;

    return {
      text: this.formatText(text),
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * ❓ 도움말 렌더링 - ✅ 완벽 이스케이프
   */
  renderHelp() {
    let text = `❓ *타이머 도움말*\n\n`;
    text += `🍅 *뽀모도로 기법*\n`;
    text += `• 25분 집중 → 5분 휴식\n`;
    text += `• 4회 반복 후 긴 휴식\n\n`;
    text += `📱 *사용법*\n`;
    text += `• 시작: 타이머 시작\n`;
    text += `• 일시정지: 잠시 멈춤\n`;
    text += `• 중지: 완전히 종료\n\n`;
    text += `📊 *통계*\n`;
    text += `• 일일/주간/월간 기록 확인\n`;
    text += `• 생산성 분석 제공`;

    return {
      text: this.formatText(text),
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * ❌ 에러 메시지 렌더링 - ✅ 완벽 이스케이프
   */
  renderError(error) {
    const message = error.message || "알 수 없는 오류가 발생했습니다";

    return {
      text: `❌ *오류 발생*\n\n${this.formatText(message)}${this.formatText(
        "."
      )}`,
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * ℹ️ 정보 메시지 렌더링 - ✅ 완벽 이스케이프
   */
  renderInfo(message) {
    return {
      text: `ℹ️ *알림*\n\n${this.formatText(message)}`,
      keyboard: this.createBackKeyboard(),
    };
  }

  // ===== ⌨️ 키보드 생성 메서드들 =====

  /**
   * 📱 메인 메뉴 키보드
   */
  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🍅 집중 시작", callback_data: "timer:start:focus" },
          { text: "📊 통계", callback_data: "timer:stats" },
        ],
        [
          { text: "📜 히스토리", callback_data: "timer:history" },
          { text: "⚙️ 설정", callback_data: "timer:settings" },
        ],
        [
          { text: "❓ 도움말", callback_data: "timer:help" },
          { text: "🔙 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };
  }

  /**
   * 📱 활성 타이머 키보드
   */
  createActiveTimerKeyboard(timer) {
    const buttons = [];

    if (timer.isPaused) {
      buttons.push([
        { text: "▶️ 재개", callback_data: "timer:resume" },
        { text: "⏹️ 중지", callback_data: "timer:stop" },
      ]);
    } else {
      buttons.push([
        { text: "⏸️ 일시정지", callback_data: "timer:pause" },
        { text: "⏹️ 중지", callback_data: "timer:stop" },
      ]);
    }

    buttons.push([
      { text: "📊 상태", callback_data: "timer:status" },
      { text: "🔙 메뉴", callback_data: "timer:menu" },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * 📱 뒤로가기 키보드
   */
  createBackKeyboard() {
    return {
      inline_keyboard: [
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };
  }
}

module.exports = TimerRenderer;
