// src/renderers/WorktimeRenderer.js - 🏢 근무시간 렌더러 (깔끔한 UI + 진행률 게이지)
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏢 WorktimeRenderer - 근무시간 관리 렌더링
 *
 * ✅ 특징:
 * - 깔끔한 근무시간 카드 UI
 * - 퇴근까지 진행률 게이지 🎯
 * - 실시간 근무시간 추적
 * - 통계 시각화
 * - 출퇴근 추천사항 표시
 */
class WorktimeRenderer extends BaseRenderer {
  constructor() {
    super("worktime");

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

    logger.info("🏢 WorktimeRenderer 생성됨");
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, todayStatus, config } = data;

    let text = `🏢 **근무시간 관리**

안녕하세요, ${userName}님! ${this.getTimeEmoji()}

`;

    // 오늘 상태 요약
    if (todayStatus.hasRecord) {
      const { record, isWorking, workSummary } = todayStatus;

      if (isWorking) {
        const progress = this.calculateWorkProgress(
          workSummary.workDuration,
          config.overtimeThreshold
        );
        text += `${this.statusEmojis.working} **현재 근무 중**
⏰ **근무시간**: ${workSummary.displayTime}
${this.createProgressBar(progress.percentage, progress.label)}

`;
      } else {
        text += `✅ **오늘 근무 완료**
⏰ **총 근무시간**: ${workSummary.displayTime}
${
  workSummary.isOvertime
    ? "🔥 초과근무 " + this.formatDuration(workSummary.overtimeMinutes)
    : "👍 정상근무"
}

`;
      }
    } else {
      text += `📝 **오늘 근무 기록 없음**
출근 버튼을 눌러 근무를 시작하세요!

`;
    }

    text += `⚙️ **설정**: ${config.workStartTime} ~ ${config.workEndTime}`;

    // 동적 버튼 생성
    const buttons = [];

    if (!todayStatus.hasRecord || !todayStatus.record?.checkInTime) {
      // 출근 전
      buttons.push([{ text: "💼 출근하기", action: "checkin" }]);
    } else if (todayStatus.isWorking) {
      // 근무 중
      buttons.push([
        { text: "🏠 퇴근하기", action: "checkout" },
        { text: "📊 현재 상태", action: "today" },
      ]);
    } else {
      // 퇴근 완료
      buttons.push([{ text: "📊 오늘 현황", action: "today" }]);
    }

    // 공통 버튼들
    buttons.push([
      { text: "📈 주간 통계", action: "week" },
      { text: "📊 월간 통계", action: "month" },
    ]);

    buttons.push([
      { text: "📋 근무 이력", action: "history" },
      { text: "⚙️ 설정", action: "settings" },
    ]);

    buttons.push([
      { text: "❓ 도움말", action: "help" },
      { text: "🔙 메인메뉴", action: "menu" },
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 💼 출근 처리 렌더링
   */
  async renderCheckin(data, ctx) {
    const {
      success,
      checkInTime,
      record,
      recommendations,
      alreadyCheckedIn,
      message,
    } = data;

    if (alreadyCheckedIn) {
      const text = `⚠️ **이미 출근하셨습니다**

⏰ **출근 시간**: ${TimeHelper.format(checkInTime, "HH:mm")}

오늘도 화이팅하세요! 💪`;

      const keyboard = this.createInlineKeyboard(
        [
          [
            { text: "📊 현재 상태", action: "today" },
            { text: "🏠 퇴근하기", action: "checkout" },
          ],
          [{ text: "🔙 메뉴", action: "menu" }],
        ],
        this.moduleName
      );

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }

    if (!success) {
      return await this.renderError(data, ctx);
    }

    const timeEmoji = this.getTimeEmoji(checkInTime);
    const text = `✅ **출근 처리 완료** ${timeEmoji}

⏰ **출근 시간**: ${TimeHelper.format(checkInTime, "HH:mm")}
📅 **날짜**: ${TimeHelper.format(checkInTime, "YYYY년 MM월 DD일")}

${
  recommendations?.length > 0
    ? `💡 **추천사항**:\n${recommendations.map((r) => `• ${r}`).join("\n")}\n`
    : ""
}

오늘도 좋은 하루 되세요! 🌟`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📊 현재 상태", action: "today" },
          { text: "🏠 퇴근하기", action: "checkout" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏠 퇴근 처리 렌더링
   */
  async renderCheckout(data, ctx) {
    const {
      success,
      checkOutTime,
      workDuration,
      recommendations,
      notCheckedIn,
      alreadyCheckedOut,
      message,
    } = data;

    if (notCheckedIn) {
      const text = `⚠️ **출근 기록이 없습니다**

출근 처리를 먼저 해주세요! 💼`;

      const keyboard = this.createInlineKeyboard(
        [
          [{ text: "💼 출근하기", action: "checkin" }],
          [{ text: "🔙 메뉴", action: "menu" }],
        ],
        this.moduleName
      );

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }

    if (alreadyCheckedOut) {
      const text = `⚠️ **이미 퇴근하셨습니다**

⏰ **퇴근 시간**: ${TimeHelper.format(checkOutTime, "HH:mm")}

오늘 하루 수고하셨습니다! 🎉`;

      const keyboard = this.createInlineKeyboard(
        [
          [{ text: "📊 오늘 현황", action: "today" }],
          [{ text: "🔙 메뉴", action: "menu" }],
        ],
        this.moduleName
      );

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }

    if (!success) {
      return await this.renderError(data, ctx);
    }

    const timeEmoji = this.getTimeEmoji(checkOutTime);
    let text = `✅ **퇴근 처리 완료** ${timeEmoji}

⏰ **퇴근 시간**: ${TimeHelper.format(checkOutTime, "HH:mm")}
📊 **총 근무시간**: ${workDuration.displayTime}

`;

    // 근무 성과 표시
    if (workDuration.isOvertime) {
      text += `🔥 **초과근무**: ${this.formatDuration(
        workDuration.totalMinutes - 480
      )}
👏 오늘 정말 고생 많으셨습니다!`;
    } else if (workDuration.totalMinutes >= 420) {
      // 7시간 이상
      text += `👍 **정상근무**: 적절한 근무시간입니다!`;
    } else {
      text += `⏰ **단축근무**: 오늘도 수고하셨습니다!`;
    }

    if (recommendations?.length > 0) {
      text += `\n\n💡 **추천사항**:\n${recommendations
        .map((r) => `• ${r}`)
        .join("\n")}`;
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📊 오늘 현황", action: "today" },
          { text: "📈 주간 통계", action: "week" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📅 오늘 현황 렌더링 (핵심!)
   */
  async renderToday(data, ctx) {
    const {
      hasRecord,
      isWorking,
      record,
      workSummary,
      recommendations,
      timestamp,
    } = data;

    if (!hasRecord) {
      const text = `📝 **오늘 근무 기록 없음**

아직 출근하지 않으셨네요!
출근 버튼을 눌러 근무를 시작하세요 💼`;

      const keyboard = this.createInlineKeyboard(
        [
          [{ text: "💼 출근하기", action: "checkin" }],
          [{ text: "🔙 메뉴", action: "menu" }],
        ],
        this.moduleName
      );

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }

    const statusEmoji = isWorking
      ? this.statusEmojis.working
      : this.statusEmojis.completed;
    const statusText = isWorking ? "근무 중" : "근무 완료";

    let text = `📅 **오늘 근무 현황** ${statusEmoji}

📊 **상태**: ${statusText}
⏰ **출근**: ${
      record.checkInTime
        ? TimeHelper.format(record.checkInTime, "HH:mm")
        : "미기록"
    }`;

    if (record.checkOutTime) {
      text += `\n🏠 **퇴근**: ${TimeHelper.format(
        record.checkOutTime,
        "HH:mm"
      )}`;
    }

    text += `\n⏱️ **근무시간**: ${workSummary.displayTime}`;

    // 진행률 게이지 (근무 중일 때만)
    if (isWorking && workSummary.workDuration > 0) {
      const progress = this.calculateWorkProgress(
        workSummary.workDuration,
        480
      ); // 8시간 기준
      text += `\n${this.createProgressBar(
        progress.percentage,
        progress.label
      )}`;

      // 목표 시간까지 남은 시간
      const remainingMinutes = Math.max(0, 480 - workSummary.workDuration);
      if (remainingMinutes > 0) {
        text += `\n⏳ **목표까지**: ${this.formatDuration(remainingMinutes)}`;
      }
    }

    // 초과근무 정보
    if (workSummary.isOvertime) {
      text += `\n🔥 **초과근무**: ${this.formatDuration(
        workSummary.overtimeMinutes
      )}`;
    }

    // 추천사항
    if (recommendations?.length > 0) {
      text += `\n\n💡 **추천사항**:\n${recommendations
        .map((r) => `• ${r}`)
        .join("\n")}`;
    }

    text += `\n\n📍 **업데이트**: ${timestamp}`;

    // 동적 버튼
    const buttons = [];

    if (isWorking) {
      buttons.push([
        { text: "🏠 퇴근하기", action: "checkout" },
        { text: "🔄 새로고침", action: "today" },
      ]);
    } else {
      buttons.push([
        { text: "🔄 새로고침", action: "today" },
        { text: "📈 주간 통계", action: "week" },
      ]);
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📈 주간 통계 렌더링
   */
  async renderWeek(data, ctx) {
    const {
      weekStart,
      weekEnd,
      workDays,
      totalHours,
      overtimeHours,
      avgDailyHours,
      analysis,
      records,
    } = data;

    let text = `📈 **주간 근무 통계**

📅 **기간**: ${weekStart} ~ ${weekEnd}
📊 **근무일**: ${workDays}일
⏰ **총 시간**: ${totalHours}시간`;

    if (overtimeHours > 0) {
      text += `\n🔥 **초과근무**: ${overtimeHours}시간`;
    }

    text += `\n📊 **일평균**: ${avgDailyHours}시간

📈 **분석**: ${analysis.trend} (${analysis.recommendation})`;

    // 일별 요약 (최근 7일)
    if (records.length > 0) {
      text += `\n\n📋 **일별 요약**:`;
      records.slice(0, 5).forEach((record) => {
        const dayName = TimeHelper.format(
          new Date(`${record.date}T00:00:00`),
          "ddd"
        );
        const duration = record.workDuration
          ? this.formatDuration(record.workDuration)
          : "미기록";
        const statusIcon = record.checkOutTime
          ? "✅"
          : record.checkInTime
          ? "💼"
          : "❌";

        text += `\n${statusIcon} ${dayName} ${record.date}: ${duration}`;
      });
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📊 월간 통계", action: "month" },
          { text: "📋 상세 이력", action: "history" },
        ],
        [
          { text: "📅 오늘 현황", action: "today" },
          { text: "🔙 메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 월간 통계 렌더링
   */
  async renderMonth(data, ctx) {
    const {
      monthStart,
      monthEnd,
      workDays,
      totalHours,
      overtimeHours,
      avgDailyHours,
      analysis,
    } = data;

    let text = `📊 **월간 근무 통계**

📅 **기간**: ${monthStart} ~ ${monthEnd}
📊 **근무일**: ${workDays}일
⏰ **총 시간**: ${totalHours}시간`;

    if (overtimeHours > 0) {
      text += `\n🔥 **초과근무**: ${overtimeHours}시간`;
    }

    text += `\n📊 **일평균**: ${avgDailyHours}시간

📈 **분석**: ${analysis.trend}
💡 **추천**: ${analysis.recommendation}`;

    // 월간 성과 평가
    const monthlyGrade = this.evaluateMonthlyPerformance(
      workDays,
      avgDailyHours,
      overtimeHours
    );
    text += `\n\n🏆 **이번 달 평가**: ${monthlyGrade.emoji} ${monthlyGrade.title}`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📈 주간 통계", action: "week" },
          { text: "📋 상세 이력", action: "history" },
        ],
        [
          { text: "📅 오늘 현황", action: "today" },
          { text: "🔙 메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 종합 통계 렌더링
   */
  async renderStats(data, ctx) {
    const { today, week, month, trends } = data;

    let text = `📊 **종합 근무 통계**

**📅 오늘**
${
  today.isWorking
    ? `💼 근무 중: ${today.workSummary?.displayTime || "0:00"}`
    : `✅ 완료: ${today.workSummary?.displayTime || "미기록"}`
}

**📈 이번 주**
📊 ${week.workDays}일 근무 / ${week.totalHours}시간

**📊 이번 달**  
📊 ${month.workDays}일 근무 / ${month.totalHours}시간

**📈 트렌드**
📊 **주간**: ${trends.weeklyTrend}
📈 **월간**: ${trends.monthlyTrend}
💡 **추천**: ${trends.recommendation}`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📈 주간 상세", action: "week" },
          { text: "📊 월간 상세", action: "month" },
        ],
        [
          { text: "📋 근무 이력", action: "history" },
          { text: "🔙 메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 근무 이력 렌더링
   */
  async renderHistory(data, ctx) {
    const { days, records, summary } = data;

    let text = `📋 **근무 이력** (최근 ${days}일)

📊 **요약**
• 총 ${summary.totalDays}일 중 ${summary.workDays}일 근무
• 총 ${summary.totalHours}시간 (평균 ${summary.avgHours}시간/일)

📅 **상세 기록**:`;

    if (records.length === 0) {
      text += `\n\n📝 기록이 없습니다.`;
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

        text += `\n${statusIcon} **${record.date}** ${checkIn}~${checkOut} (${duration})`;
      });

      if (records.length > 10) {
        text += `\n\n... 및 ${records.length - 10}개 더`;
      }
    }

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📈 주간 통계", action: "week" },
          { text: "📊 월간 통계", action: "month" },
        ],
        [
          { text: "🔄 새로고침", action: "history" },
          { text: "🔙 메뉴", action: "menu" },
        ],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    const { config, availableSettings } = data;

    let text = `⚙️ **근무시간 설정**

**📊 현재 설정**:`;

    availableSettings.forEach((setting) => {
      const icon = setting.key.includes("Time") ? "⏰" : "📊";
      text += `\n${icon} **${setting.name}**: ${setting.value}`;
    });

    text += `\n\n💡 설정 변경은 관리자에게 문의하세요.`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "📊 현재 상태", action: "today" },
          { text: "❓ 도움말", action: "help" },
        ],
        [{ text: "🔙 메뉴", action: "menu" }],
      ],
      this.moduleName
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 💬 직접 메시지 응답들 (자연어 처리)
   */
  async renderCheckinDirect(data, ctx) {
    let prefix = "💬 **출근 처리 요청**\n\n";
    await this.renderCheckin({ ...data, directMessage: true }, ctx);
  }

  async renderCheckoutDirect(data, ctx) {
    let prefix = "💬 **퇴근 처리 요청**\n\n";
    await this.renderCheckout({ ...data, directMessage: true }, ctx);
  }

  async renderStatusDirect(data, ctx) {
    let prefix = "💬 **근무 상태 조회**\n\n";
    await this.renderToday({ ...data, directMessage: true }, ctx);
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { config, features, commands } = data;

    const text = `❓ **근무시간 관리 도움말**

🏢 **주요 기능**:
${Object.entries(features)
  .map(([key, desc]) => `• ${desc}`)
  .join("\n")}

🗣️ **음성 명령어**:
${commands.text.map((cmd) => `• "${cmd}"`).join("\n")}

🔘 **버튼 메뉴**:
${commands.buttons.map((btn) => `• ${btn}`).join("\n")}

⚙️ **현재 설정**:
• 근무시간: ${config.workStartTime} ~ ${config.workEndTime}
• 초과근무 기준: ${config.overtimeThreshold / 60}시간
• 알림: ${config.enableReminders ? "✅ 활성화" : "❌ 비활성화"}

💡 **팁**: 
• 실시간으로 근무시간이 추적됩니다
• 진행률 게이지로 목표 시간을 확인하세요
• 주간/월간 통계로 근무 패턴을 분석해보세요`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🏢 근무 메뉴", action: "menu" },
          { text: "📊 현재 상태", action: "today" },
        ],
        [{ text: "🔙 메인메뉴", action: "menu" }],
      ],
      "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message, error } = data;

    const text = `❌ **근무시간 관리 오류**

${message || "알 수 없는 오류가 발생했습니다"}

잠시 후 다시 시도해주세요 🔄`;

    const keyboard = this.createInlineKeyboard(
      [
        [
          { text: "🔄 다시 시도", action: "menu" },
          { text: "📊 현재 상태", action: "today" },
        ],
        [{ text: "🔙 메인메뉴", action: "menu" }],
      ],
      "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
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
   * 🏆 월간 성과 평가
   */
  evaluateMonthlyPerformance(workDays, avgHours, overtimeHours) {
    if (workDays >= 20 && avgHours >= 8) {
      return { emoji: "🏆", title: "완벽한 근무!" };
    } else if (workDays >= 15 && avgHours >= 7) {
      return { emoji: "🥇", title: "우수한 근무!" };
    } else if (workDays >= 10 && avgHours >= 6) {
      return { emoji: "🥈", title: "양호한 근무!" };
    } else {
      return { emoji: "🥉", title: "더 화이팅!" };
    }
  }

  /**
   * 🌡️ 근무 강도 표시
   */
  getWorkIntensity(avgHours) {
    if (avgHours >= 10) return "🔥 고강도";
    if (avgHours >= 8) return "💪 표준";
    if (avgHours >= 6) return "😌 여유";
    return "😴 휴식";
  }
}

module.exports = WorktimeRenderer;
