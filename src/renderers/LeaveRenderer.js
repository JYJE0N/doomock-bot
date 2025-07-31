// src/renderers/LeaveRenderer.js - 🏖️ 연차 관리 UI 렌더러
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveRenderer - 연차 관리 UI 렌더러
 *
 * 🎯 렌더링 타입:
 * - menu: 메인 메뉴
 * - status: 연차 현황
 * - use_select: 연차 사용 선택
 * - use_success: 연차 사용 완료
 * - history: 사용 이력
 * - stats: 통계
 * - settings: 설정
 * - help: 도움말
 *
 * ✅ 특징:
 * - 직관적인 이모지 사용
 * - 한국어 친화적 UI
 * - 간단하고 명확한 메뉴 구조
 * - 모바일 최적화된 버튼 배치
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "leave";
  }

  /**
   * 🎯 메인 렌더링 분기
   */
  async render(result, ctx) {
    try {
      switch (result.type) {
        case "menu":
          return await this.renderMenu(result, ctx);
        case "status":
          return await this.renderStatus(result, ctx);
        case "use_select":
          return await this.renderUseSelect(result, ctx);
        case "use_success":
          return await this.renderUseSuccess(result, ctx);
        case "history":
          return await this.renderHistory(result, ctx);
        case "stats":
          return await this.renderStats(result, ctx);
        case "settings":
          return await this.renderSettings(result, ctx);
        case "help":
          return await this.renderHelp(result, ctx);
        case "error":
          return await this.renderError(result, ctx);
        default:
          return await this.renderUnknown(result, ctx);
      }
    } catch (error) {
      logger.error("LeaveRenderer 렌더링 오류:", error);
      await this.renderError({ message: "화면을 표시할 수 없습니다." }, ctx);
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(result, ctx) {
    const { data } = result;
    const { userName, status, todayUsage, config } = data;

    // 상태 표시 이모지
    const statusEmoji = this.getStatusEmoji(
      status.remaining,
      status.annualLeave
    );
    const usageRate = Math.round((status.used / status.annualLeave) * 100);

    let text = `🏖️ *연차 관리* ${statusEmoji}\n\n`;
    text += `👤 *${this.escapeMarkdownV2(userName)}*님의 연차 현황\n\n`;

    // 현재 상태
    text += `📊 *${status.year}년 연차 현황*\n`;
    text += `▫️ 총 연차: *${status.annualLeave}일*\n`;
    text += `▫️ 사용: *${status.used}일* \\(${usageRate}%\\)\n`;
    text += `▫️ 잔여: *${status.remaining}일*\n\n`;

    // 진행률 바
    const progressBar = this.createProgressBar(status.used, status.annualLeave);
    text += `${progressBar}\n\n`;

    // 오늘 사용 여부
    if (todayUsage.hasUsage) {
      text += `📅 *오늘 사용*: ${todayUsage.totalDays}일\n\n`;
    }

    // 빠른 정보
    const remainingPercent = Math.round(
      (status.remaining / status.annualLeave) * 100
    );
    if (remainingPercent <= 20) {
      text += `⚠️ 잔여 연차가 얼마 남지 않았습니다\\!\n\n`;
    } else if (remainingPercent >= 80) {
      text += `✨ 아직 연차를 많이 사용하지 않으셨네요\\!\n\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏖️ 연차 사용", callback_data: "leave:use" },
          { text: "📊 현황 보기", callback_data: "leave:status" },
        ],
        [
          { text: "📋 사용 이력", callback_data: "leave:history" },
          { text: "📈 통계", callback_data: "leave:stats" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "leave:settings" },
          { text: "❓ 도움말", callback_data: "leave:help" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 연차 현황 렌더링
   */
  async renderStatus(result, ctx) {
    const { data } = result;
    const { status, monthlyUsage, year } = data;

    let text = `📊 *${year}년 연차 현황*\n\n`;

    // 전체 요약
    text += `🎯 *전체 요약*\n`;
    text += `▫️ 총 연차: *${status.annualLeave}일*\n`;
    text += `▫️ 사용: *${status.used}일* \\(${status.usageRate}%\\)\n`;
    text += `▫️ 잔여: *${status.remaining}일*\n\n`;

    // 사용 내역 (타입별)
    if (status.breakdown.total.count > 0) {
      text += `📋 *사용 내역*\n`;

      if (status.breakdown.full.count > 0) {
        text += `▫️ 연차: ${status.breakdown.full.count}회 \\(${status.breakdown.full.days}일\\)\n`;
      }
      if (status.breakdown.half.count > 0) {
        text += `▫️ 반차: ${status.breakdown.half.count}회 \\(${status.breakdown.half.days}일\\)\n`;
      }
      if (status.breakdown.quarter.count > 0) {
        text += `▫️ 반반차: ${status.breakdown.quarter.count}회 \\(${status.breakdown.quarter.days}일\\)\n`;
      }
      text += `\n`;
    }

    // 월별 사용 현황 (간단하게)
    const currentMonth = new Date().getMonth() + 1;
    const thisMonthUsage = monthlyUsage.find((m) => m.month === currentMonth);

    if (thisMonthUsage && thisMonthUsage.totalDays > 0) {
      text += `📅 *이번 달 사용*: ${thisMonthUsage.totalDays}일 \\(${thisMonthUsage.count}회\\)\n\n`;
    }

    // 남은 기간 계산
    const now = new Date();
    const yearEnd = new Date(year, 11, 31);
    const remainingDays = Math.ceil((yearEnd - now) / (1000 * 60 * 60 * 24));

    if (remainingDays > 0) {
      text += `⏰ *올해 남은 기간*: ${remainingDays}일\n`;
      if (status.remaining > 0) {
        const avgPerMonth =
          Math.round((status.remaining / (remainingDays / 30)) * 10) / 10;
        text += `💡 월 평균 사용 가능: ${avgPerMonth}일\n`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 상세 이력", callback_data: "leave:history" },
          { text: "📈 월별 통계", callback_data: "leave:stats" },
        ],
        [{ text: "🏖️ 연차 사용", callback_data: "leave:use" }],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 🏖️ 연차 사용 선택 렌더링
   */
  async renderUseSelect(result, ctx) {
    const { data } = result;
    const { status, leaveUnits } = data;

    let text = `🏖️ *연차 사용하기*\n\n`;
    text += `현재 잔여 연차: *${status.remaining}일*\n\n`;
    text += `사용할 연차 종류를 선택해주세요:\n\n`;

    const keyboard = {
      inline_keyboard: [],
    };

    // 사용 가능한 연차 타입들
    if (status.remaining >= 1.0) {
      keyboard.inline_keyboard.push([
        {
          text: `📅 ${leaveUnits.full.label} (1일)`,
          callback_data: "leave:use:full",
        },
      ]);
    }

    if (status.remaining >= 0.5) {
      keyboard.inline_keyboard.push([
        {
          text: `🕐 ${leaveUnits.half.label} (0.5일)`,
          callback_data: "leave:use:half",
        },
      ]);
    }

    if (status.remaining >= 0.25) {
      keyboard.inline_keyboard.push([
        {
          text: `⏰ ${leaveUnits.quarter.label} (0.25일)`,
          callback_data: "leave:use:quarter",
        },
      ]);
    }

    // 사용 가능한 연차가 없는 경우
    if (status.remaining === 0) {
      text += `❌ 사용 가능한 연차가 없습니다\\.\n`;
    }

    keyboard.inline_keyboard.push([
      { text: "🔙 연차 메뉴", callback_data: "leave:menu" },
    ]);

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 연차 사용 완료 렌더링
   */
  async renderUseSuccess(result, ctx) {
    const { data } = result;
    const {
      usedDays,
      leaveType,
      previousRemaining,
      currentRemaining,
      usedDate,
    } = data;

    let text = `✅ *연차 사용 완료*\n\n`;
    text += `🎉 ${this.escapeMarkdownV2(
      leaveType
    )}이 성공적으로 사용되었습니다\\!\n\n`;

    text += `📋 *사용 내역*\n`;
    text += `▫️ 사용일: *${usedDate}*\n`;
    text += `▫️ 사용 연차: *${usedDays}일*\n`;
    text += `▫️ 이전 잔여: *${previousRemaining}일*\n`;
    text += `▫️ 현재 잔여: *${currentRemaining}일*\n\n`;

    // 남은 연차에 따른 메시지
    if (currentRemaining === 0) {
      text += `⚠️ 연차를 모두 사용하셨습니다\\.\n`;
    } else if (currentRemaining <= 2) {
      text += `⚠️ 잔여 연차가 얼마 남지 않았습니다\\.\n`;
    } else {
      text += `😊 남은 연차를 계획적으로 사용하세요\\!\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 현황 보기", callback_data: "leave:status" },
          { text: "📋 이력 보기", callback_data: "leave:history" },
        ],
        [{ text: "🏖️ 추가 사용", callback_data: "leave:use" }],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📋 사용 이력 렌더링
   */
  async renderHistory(result, ctx) {
    const { data } = result;
    const { history, year, total, hasMore } = data;

    let text = `📋 *${year}년 연차 사용 이력*\n\n`;

    if (history.length === 0) {
      text += `📝 아직 사용한 연차가 없습니다\\.\n\n`;
    } else {
      text += `총 ${total}건의 사용 이력\n\n`;

      // 최근 10개 이력 표시
      history.slice(0, 10).forEach((record, index) => {
        const date = record.formattedDate;
        const days = record.days;
        const remaining = record.remainingAtTime;
        const leaveType = this.getLeaveTypeEmoji(days);

        text += `${leaveType} *${date}* \\- ${days}일 사용\n`;
        text += `   잔여: ${remaining}일\n`;

        if (record.reason && record.reason.trim()) {
          text += `   사유: ${this.escapeMarkdownV2(record.reason)}\n`;
        }
        text += `\n`;
      });

      if (hasMore) {
        text += `\\.\\.\\. 더 많은 이력이 있습니다\n\n`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 현황 보기", callback_data: "leave:status" },
          { text: "📈 통계 보기", callback_data: "leave:stats" },
        ],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📈 통계 렌더링
   */
  async renderStats(result, ctx) {
    const { data } = result;
    const { stats, monthlyBreakdown, year } = data;

    let text = `📈 *${year}년 연차 통계*\n\n`;

    // 전체 통계
    text += `🎯 *전체 통계*\n`;
    text += `▫️ 총 사용: ${stats.total.days}일 \\(${stats.total.count}회\\)\n`;
    text += `▫️ 사용률: ${stats.utilizationRate}%\n`;
    text += `▫️ 월 평균: ${stats.averagePerMonth}일\n\n`;

    // 타입별 통계
    if (stats.total.count > 0) {
      text += `📊 *타입별 사용*\n`;
      if (stats.annual && stats.annual.days > 0) {
        text += `▫️ 연차: ${stats.annual.days}일 \\(${stats.annual.count}회\\)\n`;
      }
      if (stats.sick && stats.sick.days > 0) {
        text += `▫️ 반차: ${stats.sick.days}일 \\(${stats.sick.count}회\\)\n`;
      }
      if (stats.personal && stats.personal.days > 0) {
        text += `▫️ 반반차: ${stats.personal.days}일 \\(${stats.personal.count}회\\)\n`;
      }
      text += `\n`;
    }

    // 월별 사용 패턴 (상위 3개월)
    const topMonths = monthlyBreakdown
      .filter((m) => m.totalDays > 0)
      .sort((a, b) => b.totalDays - a.totalDays)
      .slice(0, 3);

    if (topMonths.length > 0) {
      text += `📅 *주요 사용 월*\n`;
      topMonths.forEach((month, index) => {
        text += `${index + 1}\\. ${month.monthName}: ${month.totalDays}일\n`;
      });
      text += `\n`;
    }

    // 연말 예측
    if (stats.projectedYearEnd) {
      text += `🔮 *연말 예상*\n`;
      text += `▫️ 예상 총 사용: ${stats.projectedYearEnd.projected}일\n`;
      text += `▫️ 진행률: ${stats.projectedYearEnd.progressRate}%\n\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 상세 이력", callback_data: "leave:history" },
          { text: "📊 현황 보기", callback_data: "leave:status" },
        ],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(result, ctx) {
    const { data } = result;
    const { settings, defaultAnnualLeave, currentYear } = data;

    let text = `⚙️ *연차 설정*\n\n`;

    const userAnnualLeave = settings?.annualLeave || defaultAnnualLeave;

    text += `📊 *현재 설정*\n`;
    text += `▫️ 연간 연차: *${userAnnualLeave}일*\n`;
    text += `▫️ 적용 연도: *${currentYear}년*\n\n`;

    text += `🔧 *설정 가능 항목*\n`;
    text += `▫️ 연간 연차 일수 변경\n`;
    text += `▫️ 새해 연차 리셋\n\n`;

    text += `💡 *참고사항*\n`;
    text += `▫️ 연차는 매년 1월 1일에 새로 시작됩니다\n`;
    text += `▫️ 이월되지 않으며 12월 31일에 소멸됩니다\n`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "📊 연차 일수 변경", callback_data: "leave:settings:annual" }],
        [{ text: "🔄 연차 리셋", callback_data: "leave:settings:reset" }],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(result, ctx) {
    const { data } = result;
    const { features, leaveUnits } = data;

    let text = `❓ *연차 관리 도움말*\n\n`;

    text += `🎯 *주요 기능*\n`;
    features.forEach((feature) => {
      text += `▫️ ${this.escapeMarkdownV2(feature)}\n`;
    });
    text += `\n`;

    text += `🏖️ *연차 사용 종류*\n`;
    Object.values(leaveUnits).forEach((unit) => {
      const emoji = this.getLeaveTypeEmoji(unit.value);
      text += `${emoji} *${this.escapeMarkdownV2(unit.label)}*: ${
        unit.value
      }일\n`;
    });
    text += `\n`;

    text += `📋 *사용 방법*\n`;
    text += `1\\. "연차 사용" 버튼 클릭\n`;
    text += `2\\. 연차 종류 선택 \\(연차/반차/반반차\\)\n`;
    text += `3\\. 자동으로 오늘 날짜로 사용 처리\n`;
    text += `4\\. 잔여 연차에서 자동 차감\n\n`;

    text += `⏰ *연차 관리 규칙*\n`;
    text += `▫️ 매년 1월 1일에 새 연차 시작\n`;
    text += `▫️ 12월 31일에 미사용 연차 소멸\n`;
    text += `▫️ 이월 불가\n`;
    text += `▫️ 0\\.25일 단위로 사용 가능\n\n`;

    text += `💡 *팁*\n`;
    text += `▫️ "현황 보기"에서 사용률 확인 가능\n`;
    text += `▫️ "통계"에서 월별 사용 패턴 분석\n`;
    text += `▫️ "설정"에서 연간 연차 일수 조정\n`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏖️ 연차 사용해보기", callback_data: "leave:use" }],
        [{ text: "📊 현황 확인", callback_data: "leave:status" }],
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 오류 렌더링
   */
  async renderError(result, ctx) {
    const message = result.message || "알 수 없는 오류가 발생했습니다.";

    let text = `❌ *오류 발생*\n\n`;
    text += this.escapeMarkdownV2(message);

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔄 다시 시도", callback_data: "leave:menu" }],
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ❓ 알 수 없는 타입 렌더링
   */
  async renderUnknown(result, ctx) {
    let text = `❓ *알 수 없는 요청*\n\n`;
    text += `처리할 수 없는 요청입니다\\.\n`;
    text += `타입: ${this.escapeMarkdownV2(result.type || "unknown")}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 연차 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 상태 이모지 반환
   */
  getStatusEmoji(remaining, total) {
    const percentage = (remaining / total) * 100;

    if (percentage >= 80) return "🟢"; // 충분함
    if (percentage >= 50) return "🟡"; // 보통
    if (percentage >= 20) return "🟠"; // 주의
    return "🔴"; // 부족
  }

  /**
   * 📈 진행률 바 생성
   */
  createProgressBar(used, total, length = 10) {
    const percentage = Math.min((used / total) * 100, 100);
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;

    const filledBar = "█".repeat(filled);
    const emptyBar = "░".repeat(empty);

    return `\`${filledBar}${emptyBar}\` ${Math.round(percentage)}%`;
  }

  /**
   * 🏷️ 연차 타입 이모지 반환
   */
  getLeaveTypeEmoji(days) {
    const dayValue = parseFloat(days);

    if (dayValue === 0.25) return "⏰"; // 반반차
    if (dayValue === 0.5) return "🕐"; // 반차
    if (dayValue === 1.0) return "📅"; // 연차
    return "🏖️"; // 기본
  }

  /**
   * 📅 월 이름 반환 (한국어)
   */
  getMonthName(month) {
    const monthNames = [
      "",
      "1월",
      "2월",
      "3월",
      "4월",
      "5월",
      "6월",
      "7월",
      "8월",
      "9월",
      "10월",
      "11월",
      "12월",
    ];
    return monthNames[month] || `${month}월`;
  }

  /**
   * 📊 렌더러 상태 조회
   */
  getStatus() {
    return {
      rendererName: "LeaveRenderer",
      version: "3.0.1",
      supportedTypes: [
        "menu",
        "status",
        "use_select",
        "use_success",
        "history",
        "stats",
        "settings",
        "help",
        "error",
      ],
      hasBot: !!this.bot,
      hasNavigationHandler: !!this.navigationHandler,
    };
  }
}

module.exports = LeaveRenderer;
