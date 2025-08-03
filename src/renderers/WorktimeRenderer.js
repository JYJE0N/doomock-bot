// src/renderers/WorktimeRenderer.js - 시간 표시 개선 버전
const logger = require("../utils/Logger");
const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏢 WorktimeRenderer - 근무시간 UI 렌더링 (시간 표시 개선)
 *
 * 🎯 핵심 개선사항:
 * - TimeHelper.safeDisplayTime() 사용으로 undefined 방지
 * - null/undefined 값에 대한 안전한 처리
 * - 일관된 시간 표시 형식
 */
class WorktimeRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);

    // 렌더러 식별
    this.moduleName = "worktime";

    // 상태별 이모지
    this.statusEmojis = {
      working: "💼",
      completed: "✅",
      absent: "❌",
      break: "⏸️"
    };

    // 시간대별 이모지
    this.timeEmojis = {
      morning: "🌅",
      noon: "☀️",
      afternoon: "🌤️",
      evening: "🌆",
      night: "🌙"
    };

    logger.info("🏢 WorktimeRenderer 생성됨 - NavigationHandler를 통한 의존성 접근");
  }

  /**
   * 🎯 ErrorHandler 접근 (NavigationHandler를 통해)
   */
  get errorHandler() {
    return this.navigationHandler?.errorHandler;
  }

  /**
   * 🎯 MarkdownHelper 접근 (NavigationHandler를 통해)
   */
  get markdownHelper() {
    return this.navigationHandler?.markdownHelper || super.markdownHelper;
  }

  /**
   * ⏰ 안전한 시간 표시 헬퍼
   * @param {any} timeData - 시간 데이터 (Date, string, null 등)
   * @param {string} format - 표시 형식 (기본: "timeOnly")
   * @returns {string} 안전한 시간 문자열
   */
  safeTimeDisplay(timeData, format = "timeOnly") {
    // TimeHelper의 안전한 시간 표시 사용
    return TimeHelper.safeDisplayTime(timeData, format);
  }

  /**
   * 🎯 표준 render 메서드 (핵심!)
   * BaseRenderer의 추상 메서드를 구현
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
        return await this.renderError({ message: "결과 타입이 지정되지 않았습니다." }, ctx);
      }

      logger.debug(`🏢 WorktimeRenderer 렌더링: ${type}`, {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });

      // 타입별 렌더링 분기
      switch (type) {
        case "menu":
          return await this.renderMenu(data || {}, ctx);
        case "today":
        case "status":
          return await this.renderToday(data || {}, ctx);
        case "checkin":
        case "checkin_success":
          return await this.renderCheckinSuccess(data || {}, ctx);
        case "checkout":
        case "checkout_success":
          return await this.renderCheckoutSuccess(data || {}, ctx);
        case "week":
          return await this.renderWeek(data || {}, ctx);
        case "month":
          return await this.renderMonth(data || {}, ctx);
        case "history":
          return await this.renderHistory(data || {}, ctx);
        case "stats":
          return await this.renderStats(data || {}, ctx);
        case "error":
          // 🔥 renderError를 만들지 말고, ErrorHandler에 위임!
          return await this.errorHandler.handleModuleProcessingError(
            ctx,
            "worktime",
            result.subAction || "unknown",
            data?.message || "처리 중 오류가 발생했습니다."
          );

        default:
          logger.warn(`🏢 WorktimeRenderer: 알 수 없는 타입 - ${type}`);
          return await this.errorHandler.handleUnexpectedError(ctx, new Error(`지원하지 않는 타입: ${type}`), "WorktimeRenderer.render");
      }
    } catch (error) {
      logger.error("💥 WorktimeRenderer.render 오류:", error);
      return await this.errorHandler.handleUnexpectedError(ctx, error, "WorktimeRenderer.render");
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, todayStatus = {}, config = {} } = data;

    let text = `🏢 **근무시간 관리**

안녕하세요, ${userName || "사용자"}님! ${this.getTimeEmoji()}

`;

    // 오늘 상태 요약
    if (todayStatus.hasRecord) {
      const { isWorking, workSummary } = todayStatus;

      if (isWorking) {
        const progress = this.calculateWorkProgress(workSummary?.workDuration || 0, config.overtimeThreshold || 480);
        text += `${this.statusEmojis.working} **현재 근무 중**
⏰ **근무시간**: ${workSummary?.displayTime || "0:00"}
${this.createProgressBar(progress.percentage, progress.label)}

`;
      } else {
        text += `✅ **오늘 근무 완료**
⏰ **총 근무시간**: ${workSummary?.displayTime || "0:00"}
${workSummary?.isOvertime ? "🔥 초과근무 " + this.formatDuration(workSummary.overtimeMinutes) : "👍 정상근무"}

`;
      }
    } else {
      text += `📝 **오늘 근무 기록 없음**
출근 버튼을 눌러 근무를 시작하세요!

`;
    }

    // 이번 주 요약
    text += `📊 **이번 주 근무**
• 근무일수: ${todayStatus.weekSummary?.workDays || 0}일
• 총 시간: ${todayStatus.weekSummary?.totalHours || 0}시간`;

    // 메뉴 버튼
    const buttons = [
      [
        {
          text: todayStatus.isWorking ? "🏃 퇴근하기" : "🏃 출근하기",
          callback_data: this.buildCallbackData("worktime", todayStatus.hasRecord && todayStatus.isWorking ? "checkout" : "checkin")
        },
        {
          text: "📅 오늘 현황",
          callback_data: this.buildCallbackData("worktime", "today")
        }
      ],
      [
        {
          text: "📈 주간 통계",
          callback_data: this.buildCallbackData("worktime", "week")
        },
        {
          text: "📊 월간 통계",
          callback_data: this.buildCallbackData("worktime", "month")
        }
      ],
      [
        {
          text: "📋 근무 이력",
          callback_data: this.buildCallbackData("worktime", "history")
        },
        {
          text: "🔙 메인 메뉴",
          callback_data: this.buildCallbackData("system", "menu")
        }
      ]
    ];

    const keyboard = { inline_keyboard: buttons };
    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * ✅ 출근 성공 렌더링
   */
  async renderCheckinSuccess(data, ctx) {
    const { record, checkInTime, message } = data;

    const text = `✅ **출근 완료!**

💼 출근시간: ${this.safeTimeDisplay(checkInTime)}
📍 위치: 회사
🎯 목표: 8시간 근무

오늘도 좋은 하루 되세요! 💪`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📅 오늘 현황",
            callback_data: this.buildCallbackData("worktime", "today")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * ✅ 퇴근 성공 렌더링
   */
  async renderCheckoutSuccess(data, ctx) {
    const { record, workSummary, message } = data;

    let workStatus = "";
    if (workSummary?.workDuration < 60) {
      workStatus = "😅 짧은 근무";
    } else if (workSummary?.workDuration < 240) {
      workStatus = "⏱️ 반일 근무";
    } else if (workSummary?.isOvertime) {
      workStatus = "🔥 초과근무";
    } else {
      workStatus = "👍 정상근무";
    }

    const text = `🏠 **퇴근 완료!**

⏰ 총 근무시간: ${workSummary?.displayTime || "0:00"}
${workStatus}

수고하셨습니다! 푹 쉬세요 😊`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📅 오늘 현황",
            callback_data: this.buildCallbackData("worktime", "today")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * 📊 월간 통계 렌더링
   */
  async renderMonth(data, ctx) {
    const { month, year, workDays = 0, totalHours = 0, overtimeHours = 0, avgDailyHours = 0, performance = {}, trends = {} } = data;

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

    if (performance.emoji && performance.txt) {
      text += `

${performance.emoji} **평가**: ${performance.txt}`;
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
            callback_data: this.buildCallbackData("worktime", "week")
          },
          {
            text: "📋 근무 이력",
            callback_data: this.buildCallbackData("worktime", "history")
          }
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "month")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * 📊 통계 렌더링
   */
  async renderStats(data, ctx) {
    const { overall = {}, thisMonth = {}, lastMonth = {}, achievements = [] } = data;

    let text = `📊 **근무 통계**

**전체 통계**
• 총 근무일: ${overall.totalDays || 0}일
• 총 근무시간: ${overall.totalHours || 0}시간
• 평균 일일 근무: ${overall.avgDailyHours || 0}시간`;

    if (thisMonth.workDays) {
      text += `

**이번 달**
• 근무일: ${thisMonth.workDays}일
• 총 시간: ${thisMonth.totalHours}시간
• 초과근무: ${thisMonth.overtimeHours || 0}시간`;
    }

    if (lastMonth.workDays) {
      text += `

**지난 달**
• 근무일: ${lastMonth.workDays}일
• 총 시간: ${lastMonth.totalHours}시간
• 초과근무: ${lastMonth.overtimeHours || 0}시간`;
    }

    if (achievements.length > 0) {
      text += `

🏆 **달성 기록**`;
      achievements.forEach((achievement) => {
        text += `
${achievement.emoji} ${achievement.txt}`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📈 주간 통계",
            callback_data: this.buildCallbackData("worktime", "week")
          },
          {
            text: "📊 월간 통계",
            callback_data: this.buildCallbackData("worktime", "month")
          }
        ],
        [
          {
            text: "📋 근무 이력",
            callback_data: this.buildCallbackData("worktime", "history")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * 📅 오늘 근무 현황 렌더링 (개선됨)
   */
  async renderToday(data, ctx) {
    // 데이터 구조 정규화
    const record = data.record || {
      checkInTime: data.checkinTime,
      checkOutTime: data.checkoutTime
    };

    const isWorking = data.isWorking ?? false;
    const workSummary = data.workSummary || {
      workDuration: data.workDuration,
      displayTime: data.displayTime
    };

    // 🔥 추가: recommendations와 timestamp 변수 정의
    const recommendations = data.recommendations || [];
    const timestamp = data.timestamp || new Date();

    // 🔍 디버깅용 (개발 중에만 사용) - 실제로는 주석 처리하거나 제거
    // console.log("🔍 오늘 근무 데이터 디버깅:", {
    //   checkInTime: TimeHelper.debugTime(record.checkInTime),
    //   checkOutTime: TimeHelper.debugTime(record.checkOutTime),
    // });

    const statusEmoji = isWorking ? this.statusEmojis.working : this.statusEmojis.completed;
    const statusText = isWorking ? "근무 중" : "근무 완료";

    let text = `📅 **오늘 근무 현황** ${statusEmoji}

📊 **상태**: ${statusText}
⏰ **출근**: ${this.safeTimeDisplay(record.checkInTime)}`;

    // 퇴근 시간 (있을 때만 표시)
    if (record.checkOutTime) {
      text += `
🏠 **퇴근**: ${this.safeTimeDisplay(record.checkOutTime)}`;
    }

    // 근무시간 표시 (안전하게)
    const workDurationText =
      workSummary.displayTime || (workSummary.workDuration ? this.formatDuration(workSummary.workDuration) : "계산 중...");

    text += `
⏱️ **근무시간**: ${workDurationText}`;

    // 진행률 게이지 (근무 중일 때만)
    if (isWorking && workSummary.workDuration > 0) {
      const progress = this.calculateWorkProgress(
        workSummary.workDuration,
        480 // 8시간 기준
      );
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

    // 업데이트 시간 (안전하게)
    if (timestamp) {
      text += `

📍 **업데이트**: ${this.safeTimeDisplay(timestamp, "time")}`;
    }

    // 동적 버튼
    const buttons = [];

    if (isWorking) {
      buttons.push([
        {
          text: "🏠 퇴근하기",
          callback_data: this.buildCallbackData("worktime", "checkout")
        },
        {
          text: "🔄 새로고침",
          callback_data: this.buildCallbackData("worktime", "today")
        }
      ]);
    } else {
      buttons.push([
        {
          text: "🔄 새로고침",
          callback_data: this.buildCallbackData("worktime", "today")
        },
        {
          text: "📈 주간 통계",
          callback_data: this.buildCallbackData("worktime", "week")
        }
      ]);
    }

    buttons.push([
      {
        text: "🔙 메뉴",
        callback_data: this.buildCallbackData("worktime", "menu")
      }
    ]);

    const keyboard = { inline_keyboard: buttons };
    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * ⏰ 시간대별 이모지 반환
   * @returns {string} 현재 시간에 맞는 이모지
   */
  getTimeEmoji() {
    const hour = new Date().getHours();
    if (hour < 6) return this.timeEmojis.night; // 🌙
    if (hour < 12) return this.timeEmojis.morning; // 🌅
    if (hour < 14) return this.timeEmojis.noon; // ☀️
    if (hour < 18) return this.timeEmojis.afternoon; // 🌤️
    return this.timeEmojis.evening; // 🌆
  }

  /**
   * 📋 근무 이력 렌더링 (개선됨)
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
        const statusIcon = record.checkOutTime ? "✅" : record.checkInTime ? "💼" : "❌";

        // 안전한 시간 표시 적용
        const duration = record.workDurationDisplay || (record.workDuration ? this.formatDuration(record.workDuration) : "미기록");
        const checkIn = this.safeTimeDisplay(record.checkInTime);
        const checkOut = this.safeTimeDisplay(record.checkOutTime);

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
            callback_data: this.buildCallbackData("worktime", "week")
          },
          {
            text: "📊 월간 통계",
            callback_data: this.buildCallbackData("worktime", "month")
          }
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "history")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * 📈 주간 통계 렌더링 (개선됨)
   */
  async renderWeek(data, ctx) {
    const { weekStart, weekEnd, workDays = 0, totalHours = 0, overtimeHours = 0, avgDailyHours = 0, analysis = {}, records = [] } = data;

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
        const duration = record.workDuration ? this.formatDuration(record.workDuration) : "미기록";
        const statusIcon = record.checkOutTime ? "✅" : record.checkInTime ? "💼" : "❌";
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
            callback_data: this.buildCallbackData("worktime", "month")
          },
          {
            text: "📋 근무 이력",
            callback_data: this.buildCallbackData("worktime", "history")
          }
        ],
        [
          {
            text: "🔄 새로고침",
            callback_data: this.buildCallbackData("worktime", "week")
          },
          {
            text: "🔙 메뉴",
            callback_data: this.buildCallbackData("worktime", "menu")
          }
        ]
      ]
    };

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard
    });
  }

  /**
   * ⏱️ 시간 지속시간 포맷팅 (분 → 시간:분)
   * @param {number} minutes - 분 단위 시간
   * @returns {string} 포맷된 시간 문자열
   */
  formatDuration(minutes) {
    if (!minutes || minutes === 0) return "0분";

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) return `${remainingMinutes}분`;
    if (remainingMinutes === 0) return `${hours}시간`;

    return `${hours}시간 ${remainingMinutes}분`;
  }

  /**
   * 📊 근무 진행률 계산
   * @param {number} currentMinutes - 현재 근무 시간(분)
   * @param {number} targetMinutes - 목표 시간(분)
   * @returns {object} 진행률 정보
   */
  calculateWorkProgress(currentMinutes, targetMinutes) {
    const percentage = Math.min(100, Math.round((currentMinutes / targetMinutes) * 100));
    const label = percentage >= 100 ? "목표 달성!" : `${percentage}% 진행`;

    return { percentage, label };
  }

  /**
   * 📊 진행률 바 생성
   * @param {number} percentage - 진행률 (0-100)
   * @param {string} label - 라벨 텍스트
   * @returns {string} 진행률 바 문자열
   */
  createProgressBar(percentage, label) {
    const filledBlocks = Math.floor(percentage / 10);
    const emptyBlocks = 10 - filledBlocks;

    const filled = "🟩".repeat(filledBlocks);
    const empty = "⬜".repeat(emptyBlocks);

    return `📊 ${filled}${empty} ${label}`;
  }
}

module.exports = WorktimeRenderer;
