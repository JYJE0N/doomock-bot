// src/renderers/WorktimeRenderer.js - 시간 표시 개선 버전

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
  constructor() {
    super();

    // 상태별 이모지
    this.statusEmojis = {
      working: "💼",
      completed: "✅",
      absent: "❌",
      break: "⏸️",
    };
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
   * 📅 오늘 근무 현황 렌더링 (개선됨)
   */
  async renderToday(data, ctx) {
    const {
      record = {},
      workSummary = {},
      recommendations = [],
      timestamp,
      isWorking = false,
    } = data;

    // 🔍 디버깅용 (개발 중에만 사용)
    console.log("🔍 오늘 근무 데이터 디버깅:", {
      checkInTime: TimeHelper.debugTime(record.checkInTime),
      checkOutTime: TimeHelper.debugTime(record.checkOutTime),
    });

    const statusEmoji = isWorking
      ? this.statusEmojis.working
      : this.statusEmojis.completed;
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
      workSummary.displayTime ||
      (workSummary.workDuration
        ? this.formatDuration(workSummary.workDuration)
        : "계산 중...");

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
    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
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
        const statusIcon = record.checkOutTime
          ? "✅"
          : record.checkInTime
          ? "💼"
          : "❌";

        // 안전한 시간 표시 적용
        const duration =
          record.workDurationDisplay ||
          (record.workDuration
            ? this.formatDuration(record.workDuration)
            : "미기록");
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

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📈 주간 통계 렌더링 (개선됨)
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

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
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
    const percentage = Math.min(
      100,
      Math.round((currentMinutes / targetMinutes) * 100)
    );
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
