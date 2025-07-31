// src/renderers/LeaveRenderer.js - 휴가 관리 파서 규칙 통일 리팩토링 버전

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏖️ LeaveRenderer - 휴가 관리 UI 렌더링 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "leave:action:params" 형태 표준화
 * - 복잡한 휴가 관리 CRUD 로직을 파서 규칙으로 단순화
 * - 연차 신청, 승인, 기록 관리 통합 처리
 * - 실시간 잔여 연차 업데이트 지원
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 스마트 휴가 관리 시스템
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 복잡한 휴가 신청 프로세스를 직관적인 버튼으로 제공
 * - 실시간 잔여 연차 계산과 시각적 피드백
 * - 다양한 휴가 타입과 승인 상태 관리
 *
 * 🏖️ 휴가 관리 파서 규칙:
 * - leave:menu → 휴가 관리 메뉴
 * - leave:status → 현재 연차 현황
 * - leave:use:full → 연차 사용 (1일)
 * - leave:use:half → 반차 사용 (0.5일)
 * - leave:use:quarter → 반반차 사용 (0.25일)
 * - leave:use:custom → 커스텀 일수
 * - leave:history → 사용 기록
 * - leave:cancel:ID → 휴가 취소
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "leave";

    // 🏖️ 휴가 관리 특화 설정
    this.config = {
      ...this.config,
      maxHistoryItems: 15,
      showProgressBar: true,
      enableNotifications: true,
      yearlyLeaveDefault: 15,
      minLeaveUnit: 0.25,
    };

    // 🎭 이모지 컬렉션 (휴가 관리 특화)
    this.emojis = {
      // 기본 휴가 관련
      leave: "🏖️",
      calendar: "📅",
      vacation: "🌴",
      sick: "🤒",
      personal: "👤",

      // 상태
      approved: "✅",
      pending: "⏳",
      rejected: "❌",
      cancelled: "🚫",

      // 휴가 타입
      full: "📅", // 연차 (1일)
      half: "🕐", // 반차 (0.5일)
      quarter: "⏰", // 반반차 (0.25일)
      custom: "⚙️", // 커스텀

      // 통계 및 정보
      stats: "📊",
      remaining: "💼",
      used: "📋",
      total: "📈",

      // 액션
      add: "➕",
      cancel: "🚫",
      edit: "✏️",
      history: "📜",

      // UI 요소
      warning: "⚠️",
      success: "✅",
      error: "❌",
      info: "💡",
      help: "❓",

      // 시간 관련
      today: "📅",
      thisMonth: "📊",
      thisYear: "🗓️",

      // 진행 상태
      progress: "📈",
      bar: "█",
      empty: "░",
    };

    // 🎨 휴가 타입 정의
    this.leaveTypes = {
      full: {
        days: 1,
        label: "연차",
        emoji: this.emojis.full,
        description: "하루 종일 휴가",
      },
      half: {
        days: 0.5,
        label: "반차",
        emoji: this.emojis.half,
        description: "오전 또는 오후 반나절",
      },
      quarter: {
        days: 0.25,
        label: "반반차",
        emoji: this.emojis.quarter,
        description: "2시간 휴가",
      },
      custom: {
        days: null,
        label: "커스텀",
        emoji: this.emojis.custom,
        description: "직접 입력",
      },
    };

    // 🎨 휴가 상태별 스타일
    this.statusStyles = {
      approved: { emoji: this.emojis.approved, color: "🟢", label: "승인됨" },
      pending: { emoji: this.emojis.pending, color: "🟡", label: "대기중" },
      rejected: { emoji: this.emojis.rejected, color: "🔴", label: "거부됨" },
      cancelled: { emoji: this.emojis.cancelled, color: "⚫", label: "취소됨" },
    };

    logger.debug("🏖️ LeaveRenderer 초기화 완료");
  }

  /**
   * 🎯 메인 렌더링 메서드 (BaseRenderer 표준 패턴)
   */
  async render(result, ctx) {
    const { type, data } = result;

    this.debug(`렌더링 시작: ${type}`, {
      dataKeys: Object.keys(data || {}),
      hasData: !!data,
    });

    try {
      switch (type) {
        case "menu":
          return await this.renderMenu(data, ctx);

        case "status":
          return await this.renderStatus(data, ctx);

        case "use_select":
          return await this.renderUseSelect(data, ctx);

        case "use_success":
          return await this.renderUseSuccess(data, ctx);

        case "use_confirm":
          return await this.renderUseConfirm(data, ctx);

        case "history":
          return await this.renderHistory(data, ctx);

        case "stats":
          return await this.renderStats(data, ctx);

        case "input_prompt":
          return await this.renderInputPrompt(data, ctx);

        case "cancel_confirm":
          return await this.renderCancelConfirm(data, ctx);

        case "cancel_success":
          return await this.renderCancelSuccess(data, ctx);

        case "limit_exceeded":
          return await this.renderLimitExceeded(data, ctx);

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

  // ===== 🏖️ 메인 메뉴 렌더링 =====

  /**
   * 🏖️ 휴가 관리 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMenu(data, ctx) {
    this.debug("휴가 관리 메뉴 렌더링", {
      hasStatus: !!data?.status,
      userName: data?.userName,
    });

    const { userName, status } = data;

    let text = `${this.emojis.leave} **휴가 관리 \\- ${userName}**\n\n`;
    text += `${this.emojis.vacation} **휴가 관리 시스템에 오신 것을 환영합니다\\!**\n\n`;

    // 현재 연차 현황 요약
    if (status) {
      text += this.formatQuickStatus(status);
      text += "\n";
    }

    text += "✨ **어떤 작업을 수행하시겠습니까\\?**";

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [
      [
        { text: `${this.emojis.stats} 연차 현황`, action: "status" },
        { text: `${this.emojis.add} 휴가 신청`, action: "use_select" },
      ],
      [
        { text: `${this.emojis.history} 사용 기록`, action: "history" },
        { text: `${this.emojis.stats} 상세 통계`, action: "stats" },
      ],
      [
        { text: `${this.emojis.help} 사용법`, action: "help" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 간단한 현황 포맷팅
   */
  formatQuickStatus(status) {
    const remainingDays = status.remaining || 0;
    const usedDays = status.used || 0;
    const totalDays = status.annual || this.config.yearlyLeaveDefault;
    const usageRate = Math.round((usedDays / totalDays) * 100);

    let text = `📊 **현재 연차 현황** (${
      status.year || new Date().getFullYear()
    }년)\n`;
    text += `• ${this.emojis.remaining} 잔여: **${remainingDays}일**\n`;
    text += `• ${this.emojis.used} 사용: ${usedDays}일\n`;
    text += `• ${this.emojis.progress} 사용률: ${usageRate}%\n`;

    // 상태에 따른 메시지
    if (remainingDays <= 2) {
      text += `\n${this.emojis.warning} **연차가 얼마 남지 않았습니다\\!**`;
    } else if (usageRate < 20 && this.isYearEnd()) {
      text += `\n${this.emojis.info} **연차 사용률이 낮습니다\\. 계획을 세워보세요\\!**`;
    }

    return text;
  }

  // ===== 📊 상세 현황 렌더링 =====

  /**
   * 📊 상세 연차 현황 렌더링
   */
  async renderStatus(data, ctx) {
    this.debug("상세 현황 렌더링", { year: data?.status?.year });

    const { status } = data;
    const year = status.year || new Date().getFullYear();

    let text = `${this.emojis.stats} **${year}년 연차 현황**\n\n`;

    // 메인 현황
    text += `📋 **전체 현황**\n`;
    text += `• 연간 총 연차: ${
      status.annual || this.config.yearlyLeaveDefault
    }일\n`;
    text += `• ${this.emojis.used} 사용한 연차: **${status.used || 0}일**\n`;
    text += `• ${this.emojis.remaining} 남은 연차: **${
      status.remaining || 0
    }일**\n`;
    text += `• ${this.emojis.progress} 사용률: **${Math.round(
      status.usageRate || 0
    )}%**\n\n`;

    // 진행률 바
    if (this.config.showProgressBar) {
      text += `📊 **사용 진행률**\n`;
      text += this.createLeaveProgressBar(
        status.used || 0,
        status.annual || this.config.yearlyLeaveDefault
      );
      text += "\n\n";
    }

    // 월별 사용량 (있는 경우)
    if (status.thisMonth !== undefined) {
      text += `📅 **이번 달 사용**\n`;
      text += `• 사용한 연차: ${status.thisMonth.used || 0}일\n`;
      text += `• 신청한 연차: ${status.thisMonth.pending || 0}일\n\n`;
    }

    // 예측 및 권장사항
    text += this.generateLeaveRecommendation(status);

    text += `\n📅 ${TimeHelper.format(new Date(), "YYYY년 MM월 DD일")} 기준`;

    // 상세 현황 키보드
    const buttons = [
      [
        { text: `${this.emojis.add} 휴가 신청`, action: "use_select" },
        { text: `${this.emojis.history} 사용 기록`, action: "history" },
      ],
      [
        { text: `${this.emojis.stats} 상세 통계`, action: "stats" },
        { text: "🔄 새로고침", action: "status" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎯 휴가 신청 렌더링 =====

  /**
   * 🎯 휴가 타입 선택 렌더링
   */
  async renderUseSelect(data, ctx) {
    this.debug("휴가 타입 선택 렌더링");

    const { status, userName } = data;

    let text = `${this.emojis.add} **휴가 신청 \\- ${userName}**\n\n`;

    if (status) {
      text += `💼 **현재 잔여 연차**: **${status.remaining || 0}일**\n\n`;
    }

    text += "🎯 **어떤 휴가를 신청하시겠습니까\\?**\n\n";

    // 휴가 타입별 설명
    Object.entries(this.leaveTypes).forEach(([key, type]) => {
      if (key !== "custom") {
        text += `${type.emoji} **${type.label}** (${type.days}일) \\- ${type.description}\n`;
      }
    });

    text += `${this.leaveTypes.custom.emoji} **${this.leaveTypes.custom.label}** \\- ${this.leaveTypes.custom.description}\n\n`;

    text += "💡 선택하시면 상세 정보를 입력할 수 있습니다\\.";

    // 휴가 타입 선택 키보드 (파서 규칙 적용)
    const buttons = [
      [
        {
          text: `${this.emojis.full} 연차 (1일)`,
          action: "use",
          params: "full",
        },
        {
          text: `${this.emojis.half} 반차 (0.5일)`,
          action: "use",
          params: "half",
        },
      ],
      [
        {
          text: `${this.emojis.quarter} 반반차 (0.25일)`,
          action: "use",
          params: "quarter",
        },
        {
          text: `${this.emojis.custom} 커스텀`,
          action: "use",
          params: "custom",
        },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 휴가 신청 성공 렌더링
   */
  async renderUseSuccess(data, ctx) {
    this.debug("휴가 신청 성공 렌더링");

    const { leave, status, message } = data;

    let text = `${this.emojis.success} **휴가 신청 완료\\!**\n\n`;

    // 신청 내역
    text += `🎯 **신청 내역**\n`;
    text += `• 휴가 종류: ${this.getLeaveTypeLabel(leave.type)}\n`;
    text += `• 사용 일수: **${leave.days}일**\n`;
    text += `• 신청 날짜: ${TimeHelper.format(leave.date, "full")}\n`;

    if (leave.reason) {
      text += `• 신청 사유: ${leave.reason}\n`;
    }

    text += `• 신청 상태: ${this.getStatusLabel(leave.status)}\n\n`;

    // 업데이트된 현황
    if (status) {
      text += `📊 **업데이트된 현황**\n`;
      text += `• ${this.emojis.remaining} 잔여 연차: **${status.remaining}일**\n`;
      text += `• ${this.emojis.used} 사용 연차: ${status.used}일\n\n`;
    }

    text += `${this.emojis.success} ${message}`;

    const buttons = [
      [
        { text: `${this.emojis.add} 추가 신청`, action: "use_select" },
        { text: `${this.emojis.history} 신청 기록`, action: "history" },
      ],
      [
        { text: `${this.emojis.stats} 현황 보기`, action: "status" },
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
      ],
      [this.createHomeButton()],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });

    // 성공 후 자동으로 현황으로 이동 (3초 후)
    setTimeout(async () => {
      try {
        const statusResult = {
          type: "status",
          data: await this.getLeaveStatusData(ctx),
        };
        await this.render(statusResult, ctx);
      } catch (error) {
        this.warn("자동 현황 업데이트 실패", error);
      }
    }, 3000);
  }

  /**
   * 🔍 휴가 신청 확인 렌더링
   */
  async renderUseConfirm(data, ctx) {
    this.debug("휴가 신청 확인 렌더링");

    const { leaveData, currentStatus } = data;

    let text = `${this.emojis.warning} **휴가 신청 확인**\n\n`;

    text += `📋 **신청 내용을 확인해주세요**\n`;
    text += `• 휴가 종류: ${this.getLeaveTypeLabel(leaveData.type)}\n`;
    text += `• 사용 일수: **${leaveData.days}일**\n`;
    text += `• 신청 날짜: ${TimeHelper.format(leaveData.date, "full")}\n`;

    if (leaveData.reason) {
      text += `• 신청 사유: ${leaveData.reason}\n`;
    }

    text += `\n📊 **신청 후 현황**\n`;
    text += `• 현재 잔여: ${currentStatus.remaining}일\n`;
    text += `• 신청 후 잔여: **${
      currentStatus.remaining - leaveData.days
    }일**\n\n`;

    // 경고 메시지
    if (currentStatus.remaining - leaveData.days < 0) {
      text += `${this.emojis.error} **잔여 연차가 부족합니다\\!**\n`;
    } else if (currentStatus.remaining - leaveData.days < 2) {
      text += `${this.emojis.warning} **신청 후 연차가 얼마 남지 않습니다\\.**\n`;
    }

    text += "정말 신청하시겠습니까\\?";

    const buttons = [
      [
        {
          text: `${this.emojis.success} 네, 신청합니다`,
          action: "confirm",
          params: "yes",
        },
        { text: "❌ 취소", action: "use_select" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📜 기록 및 통계 렌더링 =====

  /**
   * 📜 휴가 사용 기록 렌더링
   */
  async renderHistory(data, ctx) {
    this.debug("휴가 기록 렌더링", { historyCount: data?.history?.length });

    const { history, year, stats } = data;
    const currentYear = year || new Date().getFullYear();

    let text = `${this.emojis.history} **${currentYear}년 휴가 사용 기록**\n\n`;

    if (!history || history.length === 0) {
      text += `${this.emojis.info} 아직 사용한 휴가가 없습니다\\.\n`;
      text += "첫 휴가를 계획해보세요\\! ✨";

      return await this.renderEmptyHistory(data, ctx);
    }

    // 통계 요약
    if (stats) {
      text += `📊 **요약**: 총 ${history.length}건, ${stats.totalDays}일 사용\n\n`;
    }

    // 기록 목록 (최근 15개)
    text += `📝 **최근 휴가 기록**\n`;

    const recentHistory = history.slice(0, this.config.maxHistoryItems);

    recentHistory.forEach((record, index) => {
      const date = TimeHelper.format(record.date, "short");
      const typeLabel = this.getLeaveTypeLabel(record.type);
      const statusStyle =
        this.statusStyles[record.status] || this.statusStyles.approved;

      text += `\n${index + 1}\\. ${
        statusStyle.emoji
      } ${date} \\- ${typeLabel} (${record.days}일)`;

      if (record.reason) {
        text += ` \\- ${record.reason}`;
      }

      if (record.status !== "approved") {
        text += ` [${statusStyle.label}]`;
      }
    });

    if (history.length > this.config.maxHistoryItems) {
      text += `\n\n... 외 ${
        history.length - this.config.maxHistoryItems
      }개 기록`;
    }

    // 기록 관리 키보드
    const buttons = [
      [
        { text: `${this.emojis.stats} 상세 통계`, action: "stats" },
        { text: "📅 이번달만", action: "history", params: "thisMonth" },
      ],
      [
        { text: `${this.emojis.add} 새 휴가`, action: "use_select" },
        { text: "🔄 새로고침", action: "history" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 상세 통계 렌더링
   */
  async renderStats(data, ctx) {
    this.debug("상세 통계 렌더링");

    const { stats, trends, userName } = data;

    let text = `${this.emojis.stats} **휴가 통계 \\- ${userName}**\n\n`;

    if (stats) {
      // 연간 통계
      text += `📅 **${stats.year || new Date().getFullYear()}년 통계**\n`;
      text += `• 총 휴가 사용: **${stats.totalDays}일**\n`;
      text += `• 신청 건수: ${stats.totalApplications}건\n`;
      text += `• 평균 휴가 길이: ${stats.averageDays}일\n`;
      text += `• 사용률: ${Math.round(stats.usageRate)}%\n\n`;

      // 타입별 분석
      if (stats.byType) {
        text += `📋 **휴가 타입별 사용**\n`;
        Object.entries(stats.byType).forEach(([type, data]) => {
          const typeInfo = this.leaveTypes[type];
          if (typeInfo) {
            text += `• ${typeInfo.emoji} ${typeInfo.label}: ${data.count}회 (${data.days}일)\n`;
          }
        });
        text += "\n";
      }

      // 월별 트렌드
      if (trends && trends.monthly) {
        text += `📈 **월별 사용 트렌드**\n`;
        trends.monthly.slice(0, 6).forEach((month) => {
          text += `• ${month.month}월: ${month.days}일\n`;
        });
        text += "\n";
      }

      // 성취 레벨
      text += this.getLeaveAchievementLevel(stats);
    } else {
      text += "아직 휴가 통계가 없습니다\\.\n";
      text += "휴가를 사용하시면 멋진 통계가 생성됩니다\\! 📊";
    }

    const buttons = [
      [
        { text: `${this.emojis.history} 상세 기록`, action: "history" },
        { text: `${this.emojis.stats} 현황 보기`, action: "status" },
      ],
      [
        { text: `${this.emojis.add} 휴가 신청`, action: "use_select" },
        { text: "📈 연도별 비교", action: "stats", params: "yearly" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 💬 상호작용 렌더링 =====

  /**
   * 💬 입력 프롬프트 렌더링
   */
  async renderInputPrompt(data, ctx) {
    this.debug("입력 프롬프트 렌더링", { inputType: data.inputType });

    const { inputType, message, leaveType } = data;

    let text = `${this.emojis.add} **휴가 신청 입력**\n\n`;
    text += `💬 ${message}\n\n`;

    if (inputType === "custom_days") {
      text += `💡 **입력 예시**\n`;
      text += `• 1 (하루 종일)\n`;
      text += `• 0\\.5 (반차)\n`;
      text += `• 0\\.25 (반반차)\n`;
      text += `• 2\\.5 (이틀 반)\n\n`;
      text += `⚠️ 최소 단위는 0\\.25일입니다\\.`;
    } else if (inputType === "reason") {
      text += `💡 **사유 예시**\n`;
      text += `• 개인 사유\n`;
      text += `• 병원 방문\n`;
      text += `• 가족 행사\n`;
      text += `• 여행\n`;
      text += `• 휴식\n\n`;
      text += `선택사항입니다\\. 생략하려면 '없음'을 입력하세요\\.`;
    }

    const buttons = [
      [
        { text: "❌ 취소", action: "use_select" },
        { text: `${this.emojis.help} 도움말`, action: "help" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⚠️ 연차 부족 렌더링
   */
  async renderLimitExceeded(data, ctx) {
    this.debug("연차 부족 렌더링");

    const { requestedDays, remainingDays, message } = data;

    let text = `${this.emojis.warning} **연차 부족 알림**\n\n`;
    text += `❌ **신청 불가**: ${requestedDays}일 휴가 신청\n`;
    text += `💼 **잔여 연차**: ${remainingDays}일\n\n`;
    text += `${this.emojis.info} ${message}\n\n`;

    text += "💡 **해결 방법**:\n";
    text += `• 더 적은 일수로 신청\n`;
    text += `• 반차(0\\.5일) 또는 반반차(0\\.25일) 활용\n`;
    text += `• 기존 신청을 취소 후 재신청\n`;
    text += `• 내년 연차 기다리기`;

    const buttons = [
      [
        {
          text: `${this.emojis.half} 반차 신청`,
          action: "use",
          params: "half",
        },
        {
          text: `${this.emojis.quarter} 반반차 신청`,
          action: "use",
          params: "quarter",
        },
      ],
      [
        { text: `${this.emojis.history} 기존 신청 확인`, action: "history" },
        { text: `${this.emojis.stats} 현황 보기`, action: "status" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ❓ 도움말 및 정보 렌더링 =====

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("도움말 렌더링");

    let text = `${this.emojis.help} **휴가 관리 사용법**\n\n`;
    text += `${this.emojis.vacation} **두목봇과 함께하는 스마트 휴가 관리\\!**\n\n`;

    text += "📱 **주요 기능**\n";
    text += `• ${this.emojis.stats} **연차 현황** \\- 잔여 연차와 사용률 확인\n`;
    text += `• ${this.emojis.add} **휴가 신청** \\- 다양한 타입의 휴가 신청\n`;
    text += `• ${this.emojis.history} **사용 기록** \\- 지금까지의 휴가 사용 내역\n`;
    text += `• ${this.emojis.stats} **상세 통계** \\- 월별/타입별 사용 분석\n\n`;

    text += "🎯 **휴가 타입**\n";
    Object.entries(this.leaveTypes).forEach(([key, type]) => {
      if (key !== "custom") {
        text += `• ${type.emoji} **${type.label}** (${type.days}일) \\- ${type.description}\n`;
      }
    });
    text += `• ${this.leaveTypes.custom.emoji} **${this.leaveTypes.custom.label}** \\- 원하는 일수 직접 입력\n\n`;

    text += "💡 **사용 팁**\n";
    text += `• 연차는 ${this.config.minLeaveUnit}일 단위로 사용 가능합니다\n`;
    text += `• 반반차(0\\.25일)로 효율적인 시간 관리\n`;
    text += `• 정기적으로 현황을 확인하세요\n`;
    text += `• 연말 전에 남은 연차를 모두 사용하세요\n\n`;

    text += "📊 **통계 활용**\n";
    text += `• 월별 사용 패턴 분석\n`;
    text += `• 휴가 타입별 선호도 확인\n`;
    text += `• 연간 휴가 계획 수립에 활용\n\n`;

    text += "✨ **두목봇과 함께 균형잡힌 워라밸을 만들어가세요\\!**";

    const buttons = [
      [
        { text: `${this.emojis.add} 첫 휴가 신청`, action: "use_select" },
        { text: `${this.emojis.stats} 현황 보기`, action: "status" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 메시지 렌더링
   */
  async renderInfo(data, ctx) {
    this.debug("정보 메시지 렌더링");

    const { message, status, type } = data;

    let text = `${this.emojis.info} **알림**\n\n`;
    text += `${message}\n\n`;

    if (status) {
      text += `📊 **현재 연차 현황**\n`;
      text += `• ${this.emojis.remaining} 잔여 연차: ${
        status.remaining || 0
      }일\n`;
      text += `• ${this.emojis.used} 사용 연차: ${status.used || 0}일\n`;
    }

    const buttons = [
      [
        { text: `${this.emojis.stats} 현황 보기`, action: "status" },
        { text: `${this.emojis.add} 휴가 신청`, action: "use_select" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📭 빈 기록 상태 렌더링
   */
  async renderEmptyHistory(data, ctx) {
    this.debug("빈 기록 상태 렌더링");

    const { userName } = data;

    let text = `${this.emojis.info} **아직 휴가 기록이 없어요\\!**\n\n`;
    text += `👋 ${userName}님, 첫 번째 휴가를 계획해보세요\\!\n\n`;
    text += "💡 **시작 가이드**:\n";
    text += `• ${this.emojis.add} 휴가 신청하기\n`;
    text += `• ${this.emojis.stats} 연차 현황 확인하기\n`;
    text += `• 균형잡힌 워라밸 만들기\n`;
    text += `• 스마트한 휴가 계획 세우기`;

    const buttons = [
      [{ text: `${this.emojis.add} 첫 휴가 신청`, action: "use_select" }],
      [
        { text: `${this.emojis.stats} 연차 현황`, action: "status" },
        { text: `${this.emojis.help} 사용법`, action: "help" },
      ],
      [
        { text: `${this.emojis.leave} 메뉴`, action: "menu" },
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
   * 📊 연차 진행바 생성
   */
  createLeaveProgressBar(usedDays, totalDays) {
    const progress = Math.min(1, usedDays / totalDays);
    const barLength = 10;
    const filledLength = Math.floor(progress * barLength);
    const emptyLength = barLength - filledLength;

    const bar =
      this.emojis.bar.repeat(filledLength) +
      this.emojis.empty.repeat(emptyLength);
    const percentage = Math.floor(progress * 100);

    return `${bar} ${percentage}%`;
  }

  /**
   * 💡 연차 권장사항 생성
   */
  generateLeaveRecommendation(status) {
    const remaining = status.remaining || 0;
    const usageRate = status.usageRate || 0;
    const currentMonth = new Date().getMonth() + 1;

    let text = "💡 **권장사항**\n";

    if (remaining <= 2) {
      text += `${this.emojis.warning} 연차가 얼마 남지 않았습니다\\. 신중하게 사용하세요\\!`;
    } else if (currentMonth >= 11 && usageRate < 70) {
      text += `${this.emojis.info} 연말이 다가왔습니다\\. 남은 연차 ${remaining}일을 계획해보세요\\!`;
    } else if (usageRate < 30 && currentMonth >= 6) {
      text += `${this.emojis.info} 연차 사용률이 낮습니다\\. 적절한 휴식을 위해 휴가를 계획해보세요\\!`;
    } else if (remaining > 10 && currentMonth <= 6) {
      text += `${this.emojis.success} 연차가 충분합니다\\. 여유롭게 계획을 세우세요\\!`;
    } else {
      text += `${this.emojis.success} 적절한 연차 사용률을 유지하고 있습니다\\!`;
    }

    return text;
  }

  /**
   * 🏷️ 휴가 타입 라벨 가져오기
   */
  getLeaveTypeLabel(type) {
    const leaveType = this.leaveTypes[type];
    return leaveType ? `${leaveType.emoji} ${leaveType.label}` : type;
  }

  /**
   * 🏷️ 상태 라벨 가져오기
   */
  getStatusLabel(status) {
    const statusStyle = this.statusStyles[status];
    return statusStyle ? `${statusStyle.emoji} ${statusStyle.label}` : status;
  }

  /**
   * 🏆 휴가 성취 레벨 표시
   */
  getLeaveAchievementLevel(stats) {
    const usageRate = stats.usageRate || 0;

    if (usageRate >= 90) {
      return "🏆 **휴가 마스터**\\! 완벽한 워라밸을 실현하고 있어요\\!";
    } else if (usageRate >= 70) {
      return "🥇 **휴가 전문가**\\! 균형잡힌 휴가 사용입니다\\!";
    } else if (usageRate >= 50) {
      return "🥈 **휴가 숙련자**\\! 적절한 휴식을 취하고 있어요\\!";
    } else if (usageRate >= 30) {
      return "🥉 **휴가 초보자**\\! 조금 더 쉬어도 괜찮아요\\!";
    } else {
      return "🌱 **워커홀릭**\\! 휴식도 중요합니다\\. 더 많은 휴가를 계획해보세요\\!";
    }
  }

  /**
   * 📅 연말인지 확인
   */
  isYearEnd() {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth >= 10; // 10월 이후를 연말로 간주
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 🏖️ 연차 현황 데이터 가져오기 (자동 업데이트용)
   */
  async getLeaveStatusData(ctx) {
    // 실제 구현에서는 ModuleManager나 Service를 통해 데이터를 가져와야 함
    // 여기서는 구조만 보여주는 예시
    return {
      status: {
        year: new Date().getFullYear(),
        annual: this.config.yearlyLeaveDefault,
        used: 0,
        remaining: this.config.yearlyLeaveDefault,
        usageRate: 0,
      },
      userName: getUserName(ctx.from || ctx.callbackQuery?.from),
    };
  }

  // ===== 🧪 레거시 호환성 메서드들 =====

  /**
   * 📤 레거시 메시지 전송 (호환성 유지)
   * @deprecated BaseRenderer.sendSafeMessage 사용 권장
   */
  async sendMessage(chatId, text, keyboard, messageId) {
    try {
      const options = {
        reply_markup: keyboard,
        parse_mode: this.config.defaultParseMode,
      };

      if (messageId) {
        return await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          ...options,
        });
      } else {
        return await this.bot.sendMessage(chatId, text, options);
      }
    } catch (error) {
      this.warn("레거시 메시지 전송 실패, 안전 모드로 전환", error);

      // 안전한 전송으로 폴백
      const ctx = {
        chat: { id: chatId },
        callbackQuery: messageId
          ? { message: { message_id: messageId } }
          : null,
      };

      return await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
    }
  }
}

module.exports = LeaveRenderer;
