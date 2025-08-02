// src/renderers/LeaveRenderer.js - 🏖️ SoC 완벽 준수 + 헬퍼 활용 완성 버전
const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveRenderer - 연차 관리 UI 렌더러
 *
 * 🎯 핵심 역할: 연차 데이터를 사용자 친화적인 UI로 변환
 * ✅ SRP 준수: UI 생성만 담당
 *
 * 비유: 레스토랑의 플레이팅 셰프
 * - 재료(데이터)를 받아서
 * - 보기 좋게 꾸며서(UI)
 * - 손님에게 제공(렌더링)
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "leave";

    // 🎯 SoC 준수: AnimationHelper는 NavigationHandler를 통해 접근
    this.animationHelper = navigationHandler?.animationHelper;

    this.icons = {
      leave: "🏖️",
      calendar: "📅",
      status: "📊",
      history: "📋",
      settings: "⚙️",
      request: "✋",
      approve: "✅",
      pending: "⏳",
      cancel: "❌",
      back: "🔙",
      home: "🏠",
      quarter: "🕐",
      half: "🕒",
      full: "🕘",
      chart: "📈",
      today: "📆",
    };
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer의 추상 메서드 구현)
   */
  async render(result, ctx) {
    try {
      if (!result || typeof result !== "object") {
        logger.error("LeaveRenderer: 잘못된 결과 데이터", result);
        return await this.renderError({ message: "잘못된 데이터입니다." }, ctx);
      }

      const { type, data } = result;

      if (!type) {
        logger.error("LeaveRenderer: 결과 타입이 없습니다", result);
        return await this.renderError(
          { message: "결과 타입이 지정되지 않았습니다." },
          ctx
        );
      }

      logger.debug(`🏖️ LeaveRenderer 렌더링: ${type}`, {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
      });

      switch (type) {
        case "main_menu":
        case "menu":
          return await this.renderMainMenu(data, ctx);
        case "status":
          return await this.renderLeaveStatus(data, ctx);
        case "request_form":
        case "request":
          return await this.renderRequestForm(data, ctx);
        case "request_success":
        case "use_success":
          return await this.renderRequestSuccess(data, ctx);
        case "history":
          return await this.renderLeaveHistory(data, ctx);
        case "monthly_stats":
        case "monthly":
          return await this.renderMonthlyStats(data, ctx);
        case "today_usage":
        case "today":
          return await this.renderTodayUsage(data, ctx);
        case "settings":
          return await this.renderSettings(data, ctx);
        case "error":
          return await this.renderError(data, ctx);
        default:
          logger.warn(`🏖️ 지원하지 않는 렌더링 타입: ${type}`);
          return await this.renderError(
            { message: `지원하지 않는 기능입니다: ${type}` },
            ctx
          );
      }
    } catch (error) {
      logger.error("LeaveRenderer.render 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 📊 연차 현황 렌더링 (MarkdownHelper 활용)
   */
  async renderLeaveStatus(status, ctx) {
    try {
      const {
        totalLeave,
        usedLeave,
        remainingLeave,
        usageRate,
        year,
        canUseHalfDay,
        canUseQuarterDay,
      } = status;

      // 🎨 MarkdownHelper를 활용한 안전한 마크다운
      const content = this.buildStatusContent(status);

      // 🎬 AnimationHelper를 활용한 로딩 애니메이션
      if (this.animationHelper && ctx.showAnimation) {
        await this.animationHelper.performLoading(
          ctx.bot,
          ctx.callbackQuery.message.chat.id,
          "연차 현황 조회 중",
          ctx.callbackQuery.message.message_id
        );
      }

      // 🎨 MarkdownHelper로 안전한 렌더링
      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createStatusKeyboard(status);

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      await ctx.bot.answerCallbackQuery(ctx.callbackQuery.id, {
        text: `잔여 연차: ${remainingLeave}일`,
      });

      return { success: true, type: "status_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderLeaveStatus 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 연차 현황 컨텐츠 구성
   */
  buildStatusContent(status) {
    const {
      totalLeave,
      usedLeave,
      remainingLeave,
      usageRate,
      year,
      canUseHalfDay,
      canUseQuarterDay,
    } = status;

    const progressBar = this.createProgressBar(usageRate, 20);
    const statusIcon =
      remainingLeave > 5 ? "🟢" : remainingLeave > 2 ? "🟡" : "🔴";

    return `${this.icons.status} **${year}년 연차 현황**

${statusIcon} **잔여 연차: ${remainingLeave}일**

📋 **상세 정보**
├ 총 연차: ${totalLeave}일
├ 사용 연차: ${usedLeave}일
├ 잔여 연차: ${remainingLeave}일
└ 사용률: ${usageRate.toFixed(1)}%

📊 **사용률 시각화**
${progressBar}

🎯 **연차 옵션**
${this.icons.full} 연차 (1일) - 사용 가능
${canUseHalfDay ? this.icons.half : "🚫"} 반차 (0.5일) - ${
      canUseHalfDay ? "사용 가능" : "사용 불가"
    }
${canUseQuarterDay ? this.icons.quarter : "🚫"} 반반차 (0.25일) - ${
      canUseQuarterDay ? "사용 가능" : "사용 불가"
    }

*💡 체계적인 연차 계획으로 워라밸을 지켜보세요!*`;
  }

  /**
   * 📋 연차 이력 렌더링 (MarkdownHelper 활용)
   */
  async renderLeaveHistory(historyData, ctx) {
    try {
      const { items, pagination } = historyData;
      const year = ctx.year || new Date().getFullYear();

      const content = this.buildHistoryContent(items, year, pagination);

      // 🎨 MarkdownHelper로 안전한 렌더링
      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createHistoryKeyboard(
        historyData,
        year,
        pagination.page
      );

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "history_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderLeaveHistory 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 연차 이력 컨텐츠 구성
   */
  buildHistoryContent(items, year, pagination) {
    let message = `${this.icons.history} **${year}년 연차 사용 이력**\n\n`;

    if (items.length === 0) {
      message += `${this.icons.calendar} 아직 사용한 연차가 없습니다.\n\n`;
      message += `*새로운 한 해의 시작! 연차를 계획적으로 사용해보세요.*`;
    } else {
      items.forEach((item, index) => {
        const typeIcon = this.getLeaveTypeIcon(item.type);
        const statusIcon = this.getStatusIcon(item.status);

        message += `${statusIcon} **${item.date}**\n`;
        message += `   ${typeIcon} ${item.type} (${item.amount}일)\n`;
        if (item.reason && item.reason !== "사유 없음") {
          message += `   💭 ${item.reason}\n`;
        }
        message += `   📝 신청일: ${item.requestedAt}\n`;

        if (index < items.length - 1) message += "\n";
      });

      // 페이지 정보 추가
      message += `\n\n📄 페이지: ${pagination.page} (${items.length}건 표시)`;
    }

    return message;
  }

  /**
   * 🏖️ 연차 신청 폼 렌더링
   */
  async renderRequestForm(status, ctx) {
    try {
      const content = this.buildRequestFormContent(status);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createRequestFormKeyboard(status);

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "request_form_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderRequestForm 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 연차 신청 폼 컨텐츠 구성
   */
  buildRequestFormContent(status) {
    const { remainingLeave, canUseHalfDay, canUseQuarterDay } = status;

    return `${this.icons.request} **연차 신청**

💰 **사용 가능한 연차: ${remainingLeave}일**

📅 **신청할 연차 타입을 선택하세요:**

${this.icons.full} **연차 (1일)**
• 하루 종일 휴가
• 사용량: 1.0일

${canUseHalfDay ? this.icons.half : "🚫"} **반차 (0.5일)**
• 오전 또는 오후 반나절 휴가
• 사용량: 0.5일
${canUseHalfDay ? "" : "• ❌ 사용 불가"}

${canUseQuarterDay ? this.icons.quarter : "🚫"} **반반차 (0.25일)**
• 2시간 정도의 짧은 휴가
• 사용량: 0.25일
${canUseQuarterDay ? "" : "• ❌ 사용 불가"}

*💡 신청 후 취소가 어려우니 신중하게 선택하세요!*`;
  }

  /**
   * ✅ 연차 신청 성공 렌더링
   */
  async renderRequestSuccess(leaveData, ctx) {
    try {
      const content = this.buildSuccessContent(leaveData);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createSuccessKeyboard();

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "success_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderRequestSuccess 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 성공 메시지 컨텐츠 구성
   */
  buildSuccessContent(leaveData) {
    const { date, type, amount, reason, status } = leaveData;
    const typeIcon = this.getLeaveTypeIcon(type);
    const statusIcon = this.getStatusIcon(status);

    return `${this.icons.approve} **연차 신청 완료!**

${statusIcon} **신청 정보**
├ 날짜: ${date}
├ 타입: ${typeIcon} ${type} (${amount}일)
├ 상태: ${this.getStatusText(status)}
${reason ? `└ 사유: ${reason}` : ""}

${
  status === "approved"
    ? "🎉 **자동 승인되었습니다!**"
    : "⏳ **승인 대기 중입니다**"
}

*💡 계획된 휴가를 즐겁게 보내세요!*`;
  }

  /**
   * 📈 월별 통계 렌더링
   */
  async renderMonthlyStats(monthlyData, ctx) {
    try {
      const year = ctx.year || new Date().getFullYear();
      const content = this.buildMonthlyStatsContent(monthlyData, year);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createStatsKeyboard(year);

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "stats_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderMonthlyStats 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 월별 통계 컨텐츠 구성
   */
  buildMonthlyStatsContent(monthlyData, year) {
    let message = `${this.icons.chart} **${year}년 월별 연차 사용 통계**\n\n`;

    // 월별 데이터 표시
    const quarters = [
      { name: "1분기", months: [1, 2, 3] },
      { name: "2분기", months: [4, 5, 6] },
      { name: "3분기", months: [7, 8, 9] },
      { name: "4분기", months: [10, 11, 12] },
    ];

    quarters.forEach((quarter) => {
      message += `📊 **${quarter.name}**\n`;

      quarter.months.forEach((month) => {
        const data = monthlyData.find((m) => m.month === month) || {
          days: 0,
          count: 0,
        };
        const monthName = this.getMonthName(month);
        const bar = this.createMiniProgressBar(data.days, 5);

        message += `├ ${monthName}: ${bar} ${data.days}일 (${data.count}회)\n`;
      });

      message += "\n";
    });

    // 총 통계
    const totalDays = monthlyData.reduce((sum, m) => sum + m.days, 0);
    const totalCount = monthlyData.reduce((sum, m) => sum + m.count, 0);
    const avgPerMonth = totalCount > 0 ? (totalDays / 12).toFixed(1) : 0;

    message += `📋 **연간 총계**\n`;
    message += `├ 총 사용일: ${totalDays}일\n`;
    message += `├ 총 신청횟수: ${totalCount}회\n`;
    message += `└ 월평균: ${avgPerMonth}일\n\n`;

    message += `*💡 월별 패턴을 분석해서 내년 계획을 세워보세요!*`;

    return message;
  }

  /**
   * 📆 오늘 연차 사용 현황 렌더링
   */
  async renderTodayUsage(todayData, ctx) {
    try {
      const content = this.buildTodayUsageContent(todayData);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createTodayKeyboard();

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "today_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderTodayUsage 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 오늘 사용 현황 컨텐츠 구성
   */
  buildTodayUsageContent(todayData) {
    const { hasUsage, totalDays, records } = todayData;
    const today = TimeHelper.format(new Date(), "full");

    let message = `${this.icons.today} **오늘 연차 현황**\n`;
    message += `📅 ${today}\n\n`;

    if (!hasUsage) {
      message += `✅ **오늘은 연차를 사용하지 않았습니다**\n\n`;
      message += `🎯 열심히 일하는 하루입니다!\n`;
      message += `*💡 필요할 때 연차를 신청하세요.*`;
    } else {
      message += `🏖️ **오늘 총 ${totalDays}일 연차 사용 중**\n\n`;

      records.forEach((record, index) => {
        const typeIcon = this.getLeaveTypeIcon(record.leaveType);
        message += `${typeIcon} ${record.leaveType} (${record.days}일)\n`;
        if (record.reason) {
          message += `💭 사유: ${record.reason}\n`;
        }
        if (index < records.length - 1) message += "\n";
      });

      message += `\n*🌟 즐거운 휴가 되세요!*`;
    }

    return message;
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMainMenu(status, ctx) {
    try {
      const content = this.buildMainMenuContent(status);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createMainMenuKeyboard();

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "main_menu_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderMainMenu 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 메인 메뉴 컨텐츠 구성
   */
  buildMainMenuContent(status) {
    let message = `${this.icons.leave} **연차 관리**\n\n`;

    if (status) {
      const statusIcon =
        status.remainingLeave > 5
          ? "🟢"
          : status.remainingLeave > 2
          ? "🟡"
          : "🔴";
      message += `${statusIcon} **현재 잔여 연차: ${status.remainingLeave}일**\n`;
      message += `📊 사용률: ${status.usageRate.toFixed(1)}%\n\n`;
    }

    message += `📋 **메뉴를 선택하세요:**\n\n`;
    message += `${this.icons.status} 연차 현황 - 잔여일수 및 사용 현황\n`;
    message += `${this.icons.request} 연차 신청 - 새로운 연차 신청\n`;
    message += `${this.icons.history} 사용 이력 - 연차 사용 내역\n`;
    message += `${this.icons.chart} 월별 통계 - 사용 패턴 분석\n`;
    message += `${this.icons.settings} 설정 - 연차 정책 관리\n\n`;

    message += `*💼 체계적인 연차 관리로 워라밸을 지켜보세요!*`;

    return message;
  }

  /**
   * ⚙️ 설정 메뉴 렌더링
   */
  async renderSettings(data, ctx) {
    try {
      const content = this.buildSettingsContent(data);

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = this.createSettingsKeyboard();

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "settings_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderSettings 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🔧 설정 컨텐츠 구성
   */
  buildSettingsContent(data) {
    return `${this.icons.settings} **연차 설정**

${data.message || "연차 관련 설정을 관리합니다."}

**현재 설정:**
• 기본 연차: ${data.config?.defaultAnnualLeave || 15}일
• 지원 타입: 연차, 반차, 반반차
• 자동 승인: ${data.config?.autoApprove ? "활성화" : "비활성화"}

*⚠️ 설정 기능은 향후 업데이트에서 제공될 예정입니다.*`;
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    try {
      const content = `❌ **오류 발생**

${data.message || "알 수 없는 오류가 발생했습니다."}

다시 시도해주세요.`;

      const safeMessage = this.markdownHelper
        ? await this.markdownHelper.processText(content)
        : { text: content, parseMode: "HTML" };

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "leave:main" },
            { text: "🔙 메인 메뉴", callback_data: "main:show" },
          ],
        ],
      };

      await ctx.bot.editMessageText(safeMessage.text, {
        chat_id: ctx.callbackQuery.message.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: safeMessage.parseMode || "HTML",
      });

      return { success: true, type: "error_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderError 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  // ===== 🔧 키보드 생성 메서드들 =====

  /**
   * 📊 연차 현황용 키보드
   */
  createStatusKeyboard(status) {
    const buttons = [
      [
        {
          text: `${this.icons.request} 연차 신청`,
          callback_data: "leave:request",
        },
        { text: `${this.icons.today} 오늘 확인`, callback_data: "leave:today" },
      ],
      [
        {
          text: `${this.icons.history} 사용 이력`,
          callback_data: "leave:history",
        },
        {
          text: `${this.icons.chart} 월별 통계`,
          callback_data: "leave:monthly",
        },
      ],
      [
        {
          text: `${this.icons.settings} 설정`,
          callback_data: "leave:settings",
        },
        { text: `${this.icons.back} 메인으로`, callback_data: "main:show" },
      ],
    ];

    return { inline_keyboard: buttons };
  }

  /**
   * 📋 이력용 키보드
   */
  createHistoryKeyboard(historyData, year, currentPage) {
    const buttons = [];

    // 년도 변경 버튼
    const yearButtons = [];
    const currentYear = new Date().getFullYear();

    if (year > currentYear - 2) {
      yearButtons.push({
        text: `◀ ${year - 1}년`,
        callback_data: `leave:history:${year - 1}:1`,
      });
    }

    yearButtons.push({
      text: `📅 ${year}년`,
      callback_data: `leave:history:${year}:1`,
    });

    if (year < currentYear) {
      yearButtons.push({
        text: `${year + 1}년 ▶`,
        callback_data: `leave:history:${year + 1}:1`,
      });
    }

    if (yearButtons.length > 0) {
      buttons.push(yearButtons);
    }

    // 페이지네이션 버튼
    if (
      historyData.pagination &&
      (historyData.pagination.hasMore || currentPage > 1)
    ) {
      const pageButtons = [];

      if (currentPage > 1) {
        pageButtons.push({
          text: "◀ 이전",
          callback_data: `leave:history:${year}:${currentPage - 1}`,
        });
      }

      if (historyData.pagination.hasMore) {
        pageButtons.push({
          text: "다음 ▶",
          callback_data: `leave:history:${year}:${currentPage + 1}`,
        });
      }

      if (pageButtons.length > 0) {
        buttons.push(pageButtons);
      }
    }

    // 하단 메뉴
    buttons.push([
      { text: `${this.icons.status} 현황`, callback_data: "leave:status" },
      { text: `${this.icons.home} 메인`, callback_data: "leave:main" },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * 🏖️ 신청 폼용 키보드
   */
  createRequestFormKeyboard(status) {
    const buttons = [];

    // 연차 타입 선택 버튼
    buttons.push([
      {
        text: `${this.icons.full} 연차 (1일)`,
        callback_data: "leave:selectDate:full",
      },
    ]);

    if (status.canUseHalfDay) {
      buttons.push([
        {
          text: `${this.icons.half} 반차 (0.5일)`,
          callback_data: "leave:selectDate:half",
        },
      ]);
    }

    if (status.canUseQuarterDay) {
      buttons.push([
        {
          text: `${this.icons.quarter} 반반차 (0.25일)`,
          callback_data: "leave:selectDate:quarter",
        },
      ]);
    }

    // 하단 메뉴
    buttons.push([
      { text: `${this.icons.back} 뒤로`, callback_data: "leave:status" },
      { text: `${this.icons.home} 메인`, callback_data: "leave:main" },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * ✅ 성공 메시지용 키보드
   */
  createSuccessKeyboard() {
    return {
      inline_keyboard: [
        [
          {
            text: `${this.icons.status} 현황 확인`,
            callback_data: "leave:status",
          },
          {
            text: `${this.icons.history} 이력 보기`,
            callback_data: "leave:history",
          },
        ],
        [{ text: `${this.icons.home} 메인으로`, callback_data: "leave:main" }],
      ],
    };
  }

  /**
   * 📈 통계용 키보드
   */
  createStatsKeyboard(year) {
    const currentYear = new Date().getFullYear();
    const buttons = [];

    // 년도 선택
    const yearButtons = [];
    for (let y = currentYear - 2; y <= currentYear; y++) {
      yearButtons.push({
        text: y === year ? `📅 ${y}` : `${y}`,
        callback_data: `leave:monthly:${y}`,
      });
    }
    buttons.push(yearButtons);

    // 하단 메뉴
    buttons.push([
      { text: `${this.icons.status} 현황`, callback_data: "leave:status" },
      { text: `${this.icons.history} 이력`, callback_data: "leave:history" },
    ]);

    buttons.push([
      { text: `${this.icons.home} 메인으로`, callback_data: "leave:main" },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * 📆 오늘 현황용 키보드
   */
  createTodayKeyboard() {
    return {
      inline_keyboard: [
        [
          {
            text: `${this.icons.status} 전체 현황`,
            callback_data: "leave:status",
          },
          {
            text: `${this.icons.request} 연차 신청`,
            callback_data: "leave:request",
          },
        ],
        [{ text: `${this.icons.home} 메인으로`, callback_data: "leave:main" }],
      ],
    };
  }

  /**
   * 🏠 메인 메뉴용 키보드
   */
  createMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          {
            text: `${this.icons.status} 연차 현황`,
            callback_data: "leave:status",
          },
          {
            text: `${this.icons.request} 연차 신청`,
            callback_data: "leave:request",
          },
        ],
        [
          {
            text: `${this.icons.history} 사용 이력`,
            callback_data: "leave:history",
          },
          {
            text: `${this.icons.chart} 월별 통계`,
            callback_data: "leave:monthly",
          },
        ],
        [
          {
            text: `${this.icons.today} 오늘 확인`,
            callback_data: "leave:today",
          },
          {
            text: `${this.icons.settings} 설정`,
            callback_data: "leave:settings",
          },
        ],
        [{ text: `${this.icons.back} 메인으로`, callback_data: "main:show" }],
      ],
    };
  }

  /**
   * ⚙️ 설정용 키보드
   */
  createSettingsKeyboard() {
    return {
      inline_keyboard: [
        [{ text: `${this.icons.back} 뒤로`, callback_data: "leave:main" }],
      ],
    };
  }

  // ===== 🔧 헬퍼 메서드들 =====

  /**
   * 연차 타입별 아이콘 반환
   */
  getLeaveTypeIcon(type) {
    const icons = {
      연차: this.icons.full,
      반차: this.icons.half,
      반반차: this.icons.quarter,
      full: this.icons.full,
      half: this.icons.half,
      quarter: this.icons.quarter,
    };
    return icons[type] || this.icons.full;
  }

  /**
   * 상태별 아이콘 반환
   */
  getStatusIcon(status) {
    const icons = {
      approved: this.icons.approve,
      pending: this.icons.pending,
      cancelled: this.icons.cancel,
    };
    return icons[status] || this.icons.pending;
  }

  /**
   * 상태별 텍스트 반환
   */
  getStatusText(status) {
    const texts = {
      approved: "승인됨",
      pending: "승인 대기",
      cancelled: "취소됨",
    };
    return texts[status] || "알 수 없음";
  }

  /**
   * 월 이름 반환
   */
  getMonthName(month) {
    const names = [
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
    return names[month] || `${month}월`;
  }

  /**
   * 진행률 바 생성
   */
  createProgressBar(percentage, length = 20) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return (
      "█".repeat(filled) + "░".repeat(empty) + ` ${percentage.toFixed(1)}%`
    );
  }

  /**
   * 미니 진행률 바 생성
   */
  createMiniProgressBar(value, maxValue) {
    const length = 5;
    const filled = Math.min(Math.round((value / maxValue) * length), length);
    const empty = length - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  /**
   * 🚨 렌더링 오류 처리 (ErrorHandler 활용)
   */
  async handleRenderError(ctx, error) {
    if (this.errorHandler) {
      // ErrorHandler에 위임 (SoC 준수)
      return await this.errorHandler.handleRenderError(
        ctx.bot,
        ctx.callbackQuery,
        error,
        {
          module: "leave",
          renderer: "LeaveRenderer",
          fallbackMessage: "연차 정보를 표시할 수 없습니다.",
        }
      );
    }

    // 폴백: ErrorHandler가 없으면 기본 처리
    logger.error("LeaveRenderer 오류:", error);

    await ctx.bot.answerCallbackQuery(ctx.callbackQuery.id, {
      text: "화면 표시 중 오류가 발생했습니다.",
      show_alert: true,
    });

    return { success: false, error: error.message };
  }
}

module.exports = LeaveRenderer;
