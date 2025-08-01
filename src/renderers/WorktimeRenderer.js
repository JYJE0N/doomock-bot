// src/renderers/WorktimeRenderer.js - 🏢 표준 render 메서드 구현
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏢 WorktimeRenderer - 근무시간 관리 렌더링 (완전 표준화)
 *
 * ✅ 표준 준수사항:
 * - BaseRenderer 상속
 * - 표준 render(result, ctx) 메서드 구현
 * - 깔끔한 근무시간 카드 UI
 * - 진행률 게이지 시각화
 * - 실시간 근무시간 추적
 * - 모든 UI 생성 담당 (모듈은 데이터만)
 */
class WorktimeRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    // 렌더러 식별
    this.moduleName = "worktime";

    // 상태별 이모지
    this.statusEmojis = {
      working: "💼",
      completed: "✅",
      overtime: "🔥",
      break: "☕",
      absent: "❌",
    };

    // 시간대별 이모지
    this.timeEmojis = {
      morning: "🌅",
      noon: "☀️",
      afternoon: "🌤️",
      evening: "🌆",
      night: "🌙",
    };

    // renderTypeMap은 setupRenderTypeMap 메서드에서 초기화
    this.renderTypeMap = new Map();

    // 초기화 완료 후 renderTypeMap 설정
    this.setupRenderTypeMap();

    logger.info("🏢 WorktimeRenderer 생성됨 - 표준 render 메서드 지원");
  }

  /**
   * 렌더 타입 맵 설정 (메서드들이 모두 정의된 후에 실행)
   */
  setupRenderTypeMap() {
    this.renderTypeMap.set("menu", this.renderMenu.bind(this));
    this.renderTypeMap.set("help", this.renderHelp.bind(this));
    this.renderTypeMap.set("checkin", this.renderCheckin.bind(this));
    this.renderTypeMap.set("checkout", this.renderCheckout.bind(this));
    this.renderTypeMap.set(
      "checkin_success",
      this.renderCheckinSuccess.bind(this)
    );
    this.renderTypeMap.set(
      "checkout_success",
      this.renderCheckoutSuccess.bind(this)
    );
    this.renderTypeMap.set("today", this.renderToday.bind(this));
    this.renderTypeMap.set("status", this.renderToday.bind(this));
    this.renderTypeMap.set("week", this.renderWeek.bind(this));
    this.renderTypeMap.set("month", this.renderMonth.bind(this));
    this.renderTypeMap.set("stats", this.renderStats.bind(this));
    this.renderTypeMap.set("history", this.renderHistory.bind(this));
    this.renderTypeMap.set("settings", this.renderSettings.bind(this));
    this.renderTypeMap.set("error", this.renderError.bind(this));
    this.renderTypeMap.set("checkin_error", this.renderCheckinError.bind(this));
    this.renderTypeMap.set(
      "checkout_error",
      this.renderCheckoutError.bind(this)
    );
  }

  /**
   * 🎯 표준 render 메서드 (핵심!)
   *
   * 모든 렌더러가 구현해야 하는 표준 메서드
   *
   * @param {Object} result - 모듈에서 전달받은 결과 데이터
   * @param {Object} ctx - 텔레그램 컨텍스트
   */
  async render(result, ctx) {
    try {
      if (!result || typeof result !== "object") {
        logger.error("WorktimeRenderer: 잘못된 결과 데이터", result);
        return await this.renderError({ message: "잘못된 데이터입니다." }, ctx);
      }

      const { type, data } = result;

      if (!type) {
        logger.error("WorktimeRenderer: 결과 타입이 없습니다", result);
        return await this.renderError(
          { message: "결과 타입이 지정되지 않았습니다." },
          ctx
        );
      }

      logger.debug(`🏢 WorktimeRenderer 렌더링: ${type}`, {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
      });

      const renderFunction = this.renderTypeMap.get(type);

      if (!renderFunction) {
        logger.warn(`🏢 WorktimeRenderer: 알 수 없는 타입 - ${type}`);
        return await this.renderError(
          {
            message: `지원하지 않는 기능입니다: ${type}`,
          },
          ctx
        );
      }

      await renderFunction(data || {}, ctx);

      logger.debug(`✅ WorktimeRenderer 렌더링 완료: ${type}`);
    } catch (error) {
      logger.error("💥 WorktimeRenderer.render 오류:", error);

      try {
        await this.renderError(
          {
            message: "렌더링 중 오류가 발생했습니다.",
            error: error.message,
          },
          ctx
        );
      } catch (fallbackError) {
        logger.error("💥 WorktimeRenderer 폴백 에러:", fallbackError);

        try {
          await ctx.editMessageText("❌ 근무시간 처리 중 오류가 발생했습니다.");
        } catch (finalError) {
          logger.error("💥 WorktimeRenderer 최종 에러:", finalError);
        }
      }
    }
  }

  // ===== 🎯 렌더링 메서드들 =====

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, todayStatus = {}, config = {} } = data;

    let text = `🏢 **근무시간 관리**

안녕하세요, ${userName}님! ${this.getTimeEmoji()}

`;

    // 오늘 상태 요약
    if (todayStatus.hasRecord) {
      const { isWorking, workSummary } = todayStatus;

      if (isWorking) {
        const progress = this.calculateWorkProgress(
          workSummary.workDuration || 0,
          config.overtimeThreshold || 480
        );
        text += `${this.statusEmojis.working} **현재 근무 중**
⏰ **근무시간**: ${workSummary.displayTime || "0:00"}
${this.createProgressBar(progress.percentage, progress.label)}

`;
      } else {
        text += `✅ **오늘 근무 완료**
⏰ **총 근무시간**: ${workSummary.displayTime || "0:00"}
${
  workSummary.isOvertime
    ? "🔥 초과근무 " + this.formatDuration(workSummary.overtimeMinutes)
    : "👍 정상근무"
}

`;
      }
    } else {
      text += `📝 **오늘 근무 기록 없음**
출근 버튼을 눌러 근무를 시작하세요! 💼

`;
    }

    // 동적 버튼 생성
    const buttons = [];

    if (!todayStatus.hasRecord) {
      // 근무 시작 전
      buttons.push([
        {
          text: "💼 출근하기",
          callback_data: this.buildCallbackData("worktime", "checkin"),
        },
      ]);
    } else if (todayStatus.isWorking) {
      // 근무 중
      buttons.push([
        {
          text: "🏠 퇴근하기",
          callback_data: this.buildCallbackData("worktime", "checkout"),
        },
        {
          text: "📊 현재 상태",
          callback_data: this.buildCallbackData("worktime", "today"),
        },
      ]);
    } else {
      // 근무 완료
      buttons.push([
        {
          text: "📊 오늘 현황",
          callback_data: this.buildCallbackData("worktime", "today"),
        },
        {
          text: "📈 주간 통계",
          callback_data: this.buildCallbackData("worktime", "week"),
        },
      ]);
    }

    // 공통 버튼
    buttons.push([
      {
        text: "📋 근무 이력",
        callback_data: this.buildCallbackData("worktime", "history"),
      },
      {
        text: "⚙️ 설정",
        callback_data: this.buildCallbackData("worktime", "settings"),
      },
    ]);

    buttons.push([
      {
        text: "❓ 도움말",
        callback_data: this.buildCallbackData("worktime", "help"),
      },
      {
        text: "🔙 메인 메뉴",
        callback_data: this.buildCallbackData("system", "menu"),
      },
    ]);

    const keyboard = { inline_keyboard: buttons };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 💼 출근 처리 렌더링
   */
  async renderCheckin(data, ctx) {
    const { confirmationRequired = true, currentTime } = data;

    if (confirmationRequired) {
      const text = `💼 **출근 확인**

현재 시간: ${currentTime || TimeHelper.getLogTimeString()}

출근 처리하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ 출근 확인",
              callback_data: this.buildCallbackData(
                "worktime",
                "checkin",
                "confirm"
              ),
            },
            {
              text: "❌ 취소",
              callback_data: this.buildCallbackData("worktime", "menu"),
            },
          ],
        ],
      };

      await this.safeEditMessage(ctx, text, {
        reply_markup: keyboard,
        parse_mode: "MarkdownV2",
      });
    }
  }

  /**
   * ✅ 출근 성공 렌더링
   */
  async renderCheckinSuccess(data, ctx) {
    const { checkInTime, message } = data;

    const text = `✅ **출근 완료**

⏰ **출근 시간**: ${checkInTime || TimeHelper.getLogTimeString()}

${message || "좋은 하루 되세요!"}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📊 현재 상태",
            callback_data: this.buildCallbackData("worktime", "today"),
          },
          {
            text: "🏢 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 🏠 퇴근 처리 렌더링
   */
  async renderCheckout(data, ctx) {
    const { confirmationRequired = true, currentTime, workSummary } = data;

    if (confirmationRequired) {
      let text = `🏠 **퇴근 확인**

현재 시간: ${currentTime || TimeHelper.getLogTimeString()}`;

      if (workSummary) {
        text += `
오늘 근무시간: ${workSummary.displayTime || "계산 중..."}`;
      }

      text += `

퇴근 처리하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ 퇴근 확인",
              callback_data: this.buildCallbackData(
                "worktime",
                "checkout",
                "confirm"
              ),
            },
            {
              text: "❌ 취소",
              callback_data: this.buildCallbackData("worktime", "menu"),
            },
          ],
        ],
      };

      await this.safeEditMessage(ctx, text, {
        reply_markup: keyboard,
        parse_mode: "MarkdownV2",
      });
    }
  }

  /**
   * ✅ 퇴근 성공 렌더링
   */
  async renderCheckoutSuccess(data, ctx) {
    const { checkOutTime, workSummary, message } = data;

    let text = `✅ **퇴근 완료**

🏠 **퇴근 시간**: ${checkOutTime || TimeHelper.getLogTimeString()}`;

    if (workSummary) {
      text += `
⏰ **총 근무시간**: ${workSummary.displayTime || "계산 중..."}`;

      if (workSummary.isOvertime) {
        text += `
🔥 **초과근무**: ${this.formatDuration(workSummary.overtimeMinutes)}`;
      }
    }

    text += `

${message || "수고하셨습니다!"}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📊 오늘 현황",
            callback_data: this.buildCallbackData("worktime", "today"),
          },
          {
            text: "📈 주간 통계",
            callback_data: this.buildCallbackData("worktime", "week"),
          },
        ],
        [
          {
            text: "🏢 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 📊 오늘 현황 렌더링
   */
  async renderToday(data, ctx) {
    const {
      record = {},
      isWorking = false,
      workSummary = {},
      recommendations = [],
      timestamp,
    } = data;

    // 오늘 기록이 없는 경우
    if (!record.checkInTime) {
      const text = `📅 **오늘 근무 현황**

📝 오늘 근무 기록이 없습니다.
출근 버튼을 눌러 근무를 시작하세요 💼`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "💼 출근하기",
              callback_data: this.buildCallbackData("worktime", "checkin"),
            },
          ],
          [
            {
              text: "🔙 메뉴",
              callback_data: this.buildCallbackData("worktime", "menu"),
            },
          ],
        ],
      };

      return await this.safeEditMessage(ctx, text, {
        reply_markup: keyboard,
        parse_mode: "MarkdownV2",
      });
    }

    const statusEmoji = isWorking
      ? this.statusEmojis.working
      : this.statusEmojis.completed;
    const statusText = isWorking ? "근무 중" : "근무 완료";

    let text = `📅 **오늘 근무 현황** ${statusEmoji}

📊 **상태**: ${statusText}
⏰ **출근**: ${
      record.checkInTime
        ? TimeHelper.format(new Date(record.checkInTime), "HH:mm")
        : "미기록"
    }`;

    if (record.checkOutTime) {
      text += `
🏠 **퇴근**: ${TimeHelper.format(new Date(record.checkOutTime), "HH:mm")}`;
    }

    text += `
⏱️ **근무시간**: ${workSummary.displayTime || "계산 중..."}`;

    // 진행률 게이지 (근무 중일 때만)
    if (isWorking && workSummary.workDuration > 0) {
      const progress = this.calculateWorkProgress(
        workSummary.workDuration,
        480
      ); // 8시간 기준
      text += `
${this.createProgressBar(progress.percentage, progress.label)}`;

      // 목표 시간까지 남은 시간
      const remainingMinutes = Math.max(0, 480 - workSummary.workDuration);
      if (remainingMinutes > 0) {
        text += `
⏳ **목표까지**: ${this.formatDuration(remainingMinutes)}`;
      }
    }

    // 초과근무 정보
    if (workSummary.isOvertime) {
      text += `
🔥 **초과근무**: ${this.formatDuration(workSummary.overtimeMinutes)}`;
    }

    // 추천사항
    if (recommendations && recommendations.length > 0) {
      text += `

💡 **추천사항**:
${recommendations.map((r) => `• ${r}`).join("\n")}`;
    }

    if (timestamp) {
      text += `

📍 **업데이트**: ${timestamp}`;
    }

    // 동적 버튼
    const buttons = [];

    if (isWorking) {
      buttons.push([
        {
          text: "🏠 퇴근하기",
          callback_data: this.buildCallbackData("worktime", "checkout"),
        },
        {
          text: "🔄 새로고침",
          callback_data: this.buildCallbackData("worktime", "today"),
        },
      ]);
    } else {
      buttons.push([
        {
          text: "🔄 새로고침",
          callback_data: this.buildCallbackData("worktime", "today"),
        },
        {
          text: "📈 주간 통계",
          callback_data: this.buildCallbackData("worktime", "week"),
        },
      ]);
    }

    buttons.push([
      {
        text: "🔙 메뉴",
        callback_data: this.buildCallbackData("worktime", "menu"),
      },
    ]);

    const keyboard = { inline_keyboard: buttons };
    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 📈 주간 통계 렌더링
   */
  async renderWeek(data, ctx) {
    const {
      weekStart,
      weekEnd,
      workDays = 0,
      totalHours = 0,
      overtimeHours = 0,
      avgDailyHours = 0,
      analysis = {},
      records = [],
    } = data;

    let text = `📈 **주간 근무 통계**

📅 **기간**: ${weekStart} ~ ${weekEnd}
📊 **근무일**: ${workDays}일
⏰ **총 시간**: ${totalHours}시간`;

    if (overtimeHours > 0) {
      text += `
🔥 **초과근무**: ${overtimeHours}시간`;
    }

    text += `
📊 **일평균**: ${avgDailyHours}시간`;

    if (analysis.trend) {
      text += `

📈 **분석**: ${analysis.trend}`;
      if (analysis.recommendation) {
        text += ` (${analysis.recommendation})`;
      }
    }

    // 일별 요약 (최근 7일)
    if (records.length > 0) {
      text += `

📋 **일별 요약**:`;
      records.slice(0, 5).forEach((record) => {
        const duration = record.workDuration
          ? this.formatDuration(record.workDuration)
          : "미기록";
        const statusIcon = record.checkOutTime
          ? "✅"
          : record.checkInTime
          ? "💼"
          : "❌";
        text += `
${statusIcon} **${record.date}**: ${duration}`;
      });

      if (records.length > 5) {
        text += `
... 및 ${records.length - 5}개 더`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📊 월간 통계",
            callback_data: this.buildCallbackData("worktime", "month"),
          },
          {
            text: "📋 근무 이력",
            callback_data: this.buildCallbackData("worktime", "history"),
          },
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "week"),
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 📊 월간 통계 렌더링
   */
  async renderMonth(data, ctx) {
    const {
      month,
      year,
      workDays = 0,
      totalHours = 0,
      overtimeHours = 0,
      avgDailyHours = 0,
      performance = {},
      trends = {},
    } = data;

    let text = `📊 **월간 근무 통계**

📅 **${year}년 ${month}월**
📊 **근무일**: ${workDays}일
⏰ **총 시간**: ${totalHours}시간`;

    if (overtimeHours > 0) {
      text += `
🔥 **초과근무**: ${overtimeHours}시간`;
    }

    text += `
📊 **일평균**: ${avgDailyHours}시간`;

    if (performance.emoji && performance.title) {
      text += `

${performance.emoji} **평가**: ${performance.title}`;
    }

    if (trends.weeklyTrend) {
      text += `

📈 **트렌드**
📊 **주간**: ${trends.weeklyTrend}`;

      if (trends.monthlyTrend) {
        text += `
📈 **월간**: ${trends.monthlyTrend}`;
      }

      if (trends.recommendation) {
        text += `
💡 **추천**: ${trends.recommendation}`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📈 주간 통계",
            callback_data: this.buildCallbackData("worktime", "week"),
          },
          {
            text: "📋 근무 이력",
            callback_data: this.buildCallbackData("worktime", "history"),
          },
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "month"),
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * 📋 근무 이력 렌더링
   */
  async renderHistory(data, ctx) {
    const { days = 30, records = [], summary = {} } = data;

    let text = `📋 **근무 이력** (최근 ${days}일)`;

    if (summary.totalDays) {
      text += `

📊 **요약**
• 총 ${summary.totalDays}일 중 ${summary.workDays || 0}일 근무
• 총 ${summary.totalHours || 0}시간 (평균 ${summary.avgHours || 0}시간/일)`;
    }

    text += `

📅 **상세 기록**:`;

    if (records.length === 0) {
      text += `

📝 기록이 없습니다.`;
    } else {
      records.slice(0, 10).forEach((record) => {
        const statusIcon = record.checkOutTime
          ? "✅"
          : record.checkInTime
          ? "💼"
          : "❌";
        const duration = record.workDurationDisplay || "미기록";
        const checkIn = record.checkInDisplay || "--:--";
        const checkOut = record.checkOutDisplay || "--:--";

        text += `
${statusIcon} **${record.date}** ${checkIn}~${checkOut} (${duration})`;
      });

      if (records.length > 10) {
        text += `

... 및 ${records.length - 10}개 더`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📈 주간 통계",
            callback_data: this.buildCallbackData("worktime", "week"),
          },
          {
            text: "📊 월간 통계",
            callback_data: this.buildCallbackData("worktime", "month"),
          },
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "history"),
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { config = {}, features = {}, commands = {} } = data;

    let text = `❓ **근무시간 관리 도움말**

🏢 **주요 기능**:`;

    if (Object.keys(features).length > 0) {
      Object.entries(features).forEach(([key, desc]) => {
        text += `
• ${desc}`;
      });
    } else {
      text += `
• 출퇴근 시간 기록
• 근무시간 자동 계산
• 실시간 진행률 표시
• 주간/월간 통계 제공`;
    }

    if (commands.text && commands.text.length > 0) {
      text += `

🗣️ **음성 명령어**:`;
      commands.text.forEach((cmd) => {
        text += `
• "${cmd}"`;
      });
    }

    if (commands.buttons && commands.buttons.length > 0) {
      text += `

🔘 **버튼 메뉴**:`;
      commands.buttons.forEach((btn) => {
        text += `
• ${btn}`;
      });
    }

    text += `

⚙️ **현재 설정**:`;
    if (config.workStartTime && config.workEndTime) {
      text += `
• 근무시간: ${config.workStartTime} ~ ${config.workEndTime}`;
    }
    if (config.overtimeThreshold) {
      text += `
• 초과근무 기준: ${Math.floor(config.overtimeThreshold / 60)}시간`;
    }
    text += `
• 알림: ${config.enableReminders ? "✅ 활성화" : "❌ 비활성화"}

💡 **팁**: 
• 실시간으로 근무시간이 추적됩니다
• 진행률 게이지로 목표 시간을 확인하세요
• 주간/월간 통계로 근무 패턴을 분석해보세요`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🏢 근무 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
          {
            text: "📊 현재 상태",
            callback_data: this.buildCallbackData("worktime", "today"),
          },
        ],
        [
          {
            text: "🔙 메인메뉴",
            callback_data: this.buildCallbackData("system", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    const { config = {}, availableSettings = [] } = data;

    let text = `⚙️ **근무시간 설정**

**📊 현재 설정**:`;

    if (availableSettings.length > 0) {
      availableSettings.forEach((setting) => {
        const icon = setting.key.includes("Time") ? "⏰" : "📊";
        text += `
${icon} **${setting.name}**: ${setting.value}`;
      });
    } else {
      text += `
⏰ **근무시간**: ${config.workStartTime || "09:00"} ~ ${
        config.workEndTime || "18:00"
      }
📊 **초과근무 기준**: ${Math.floor((config.overtimeThreshold || 480) / 60)}시간
🔔 **알림**: ${config.enableReminders ? "활성화" : "비활성화"}`;
    }

    text += `

💡 설정 변경은 관리자에게 문의하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📊 현재 상태",
            callback_data: this.buildCallbackData("worktime", "today"),
          },
          {
            text: "❓ 도움말",
            callback_data: this.buildCallbackData("worktime", "help"),
          },
        ],
        [
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * ❌ 일반 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message, error } = data;

    const text = `❌ **근무시간 관리 오류**

${message || "알 수 없는 오류가 발생했습니다"}

잠시 후 다시 시도해주세요 🔄`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔄 다시 시도",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
          {
            text: "📊 현재 상태",
            callback_data: this.buildCallbackData("worktime", "today"),
          },
        ],
        [
          {
            text: "🔙 메인메뉴",
            callback_data: this.buildCallbackData("system", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * ❌ 출근 에러 렌더링
   */
  async renderCheckinError(data, ctx) {
    const { message } = data;

    const text = `❌ **출근 처리 실패**

${message || "출근 처리 중 오류가 발생했습니다"}

잠시 후 다시 시도해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔄 다시 출근",
            callback_data: this.buildCallbackData("worktime", "checkin"),
          },
          {
            text: "🏢 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  /**
   * ❌ 퇴근 에러 렌더링
   */
  async renderCheckoutError(data, ctx) {
    const { message } = data;

    const text = `❌ **퇴근 처리 실패**

${message || "퇴근 처리 중 오류가 발생했습니다"}

잠시 후 다시 시도해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔄 다시 퇴근",
            callback_data: this.buildCallbackData("worktime", "checkout"),
          },
          {
            text: "🏢 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu"),
          },
        ],
      ],
    };

    await this.safeEditMessage(ctx, text, {
      reply_markup: keyboard,
      parse_mode: "MarkdownV2",
    });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 진행률 계산
   */
  calculateWorkProgress(currentMinutes, targetMinutes) {
    const percentage = Math.min(
      100,
      Math.round((currentMinutes / targetMinutes) * 100)
    );

    let label = "";
    if (percentage >= 100) {
      label = "목표 달성! 🎯";
    } else if (percentage >= 75) {
      label = "거의 다 왔어요! 💪";
    } else if (percentage >= 50) {
      label = "절반 완주! 🏃‍♂️";
    } else if (percentage >= 25) {
      label = "좋은 시작! 🚀";
    } else {
      label = "화이팅! ⭐";
    }

    return { percentage, label };
  }

  /**
   * 📊 진행률 게이지 생성 (핵심 기능!)
   */
  createProgressBar(percentage, label = "") {
    const totalBars = 20;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    let progressBar = "📊 **진행률**: ";

    // 게이지 바 생성
    progressBar += "🟩".repeat(filledBars);
    progressBar += "⬜".repeat(emptyBars);

    progressBar += ` ${percentage}%`;

    if (label) {
      progressBar += ` ${label}`;
    }

    return progressBar;
  }

  /**
   * ⏰ 시간 포맷팅
   */
  formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  }

  /**
   * 🌅 시간대별 이모지
   */
  getTimeEmoji(time = null) {
    const hour = time ? time.getHours() : new Date().getHours();

    if (hour >= 5 && hour < 9) return this.timeEmojis.morning;
    if (hour >= 9 && hour < 12) return this.timeEmojis.noon;
    if (hour >= 12 && hour < 18) return this.timeEmojis.afternoon;
    if (hour >= 18 && hour < 22) return this.timeEmojis.evening;
    return this.timeEmojis.night;
  }

  /**
   * 🛡️ 안전한 메시지 편집
   */
  async safeEditMessage(ctx, text, options = {}) {
    try {
      // MarkdownV2 이스케이프 처리
      const escapedText = this.escapeMarkdownV2(text);

      await ctx.editMessageText(escapedText, {
        parse_mode: "MarkdownV2",
        ...options,
      });
    } catch (error) {
      logger.error("WorktimeRenderer 메시지 편집 실패:", error);

      // 폴백: HTML 모드로 재시도
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          ...options,
        });
      } catch (fallbackError) {
        logger.error("WorktimeRenderer HTML 폴백도 실패:", fallbackError);

        // 최후 수단: 일반 텍스트
        try {
          await ctx.editMessageText(text.replace(/[\*_`\[\]]/g, ""), options);
        } catch (finalError) {
          logger.error("WorktimeRenderer 최종 폴백 실패:", finalError);
        }
      }
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.renderTypeMap.clear();
      logger.info("✅ WorktimeRenderer 정리 완료");
    } catch (error) {
      logger.error("❌ WorktimeRenderer 정리 실패:", error);
    }
  }
}

module.exports = WorktimeRenderer;
