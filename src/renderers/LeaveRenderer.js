// src/renderers/LeaveRenderer.js - 개인용 연차 관리 시스템
const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/core/Logger");

/**
 * 🏖️ LeaveRenderer - 개인용 연차 관리 시스템
 *
 * 🎯 핵심 기능:
 * - 개인 연차 현황 확인 (잔여/사용)
 * - 연차 사용 기록 (1일/0.5일/0.25일)
 * - 월별 사용 현황 확인
 * - 설정에서 연차 추가/삭제
 * - 입사일 기준 연차 자동 계산
 * - 연말 연차 소멸, 신년 연차 생성
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "leave";

    this.icons = {
      leave: "🏖️",
      calendar: "📅",
      status: "📊",
      history: "📋",
      settings: "⚙️",
      add: "➕",
      remove: "➖",
      back: "🔙",
      home: "🏠",
      quarter: "🕐", // 0.25일
      half: "🕒", // 0.5일
      full: "🕘", // 1일
      chart: "📈",
      today: "📆",
      user: "👤",
      work: "💼"
    };
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    try {
      const { type, data } = result;

      switch (type) {
        case "main_menu":
        case "menu":
          return await this.renderMainMenu(data, ctx);
        case "monthly":
        case "monthly_view":
          return await this.renderMonthlyView(data, ctx);
        case "use_form":
          return await this.renderUseForm(data, ctx);
        case "custom_input_prompt":
          return await this.renderCustomInputPrompt(data, ctx);
        case "use_success":
          return await this.renderUseSuccess(data, ctx);
        case "use_error": // ✅ 추가
          return await this.renderUseError(data, ctx);
        case "joindate_prompt": // 👇 이 케이스를 추가합니다.
          return await this.renderJoinDatePrompt(data, ctx);
        case "input_cancelled": // ✅ 추가
          return await this.renderInputCancelled(data, ctx);
        case "input_error": // ✅ 추가
          return await this.renderInputError(data, ctx);
        case "settings":
          return await this.renderSettings(data, ctx);
        case "settings_success":
          return await this.renderSettingsSuccess(data, ctx);
        case "error":
          return await this.renderError(data, ctx);
        default:
          return await this.renderError(
            { message: `지원하지 않는 기능: ${type}` },
            ctx
          );
      }
    } catch (error) {
      logger.error("LeaveRenderer.render 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMainMenu(data, ctx) {
    try {
      const {
        totalLeave = 15,
        usedLeave = 0,
        remainingLeave = 15,
        currentYear = new Date().getFullYear(),
        joinDate = null,
        workYears = 0
      } = data || {};

      // 상태 아이콘
      const statusIcon =
        remainingLeave > 10 ? "😊" : remainingLeave > 5 ? "😐" : "😰";

      // 연차 추가 정보
      const bonusInfo =
        workYears >= 2
          ? `\n💼 ${workYears}년차 보너스: +${Math.floor(workYears / 2)}일`
          : "";

      const text = `🏖️ *내 연차 현황* (${currentYear}년)

📊 *연차 정보*
• 기본 연차: 15일
• 사용한 연차: ${usedLeave}일  
• 남은 연차: ${remainingLeave}일${bonusInfo}

${statusIcon} ${remainingLeave > 10 ? "충분해요!" : remainingLeave > 5 ? "적당해요" : "부족해요!"}

${joinDate ? `💼 입사일: ${joinDate} (${workYears}년차)` : ""}
⏰ 연차는 12월 31일에 소멸되며, 1월 1일에 새로 생성됩니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📈 월별 현황", callback_data: "leave:monthly" },
            { text: "➕ 연차 쓰기", callback_data: "leave:use" }
          ],
          [
            { text: "⚙️ 설정", callback_data: "leave:settings" },
            // ✅ 수정: "main:show" → "system:menu" (표준 준수!)
            { text: "🔙 메인으로", callback_data: "system:menu" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "main_menu_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderMainMenu 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ❌ 에러 렌더링 (수정된 버전)
   */
  async renderError(data, ctx) {
    try {
      const { message = "알 수 없는 오류가 발생했습니다." } = data || {}; // ✅ data 검증 추가

      const text = `❌ *오류 발생*

${message}

다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "leave:menu" },
            // ✅ 수정: "system:menu" → "system:menu" (표준 준수!)
            { text: "🔙 메인으로", callback_data: "system:menu" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "error_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderError 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📈 월별 현황 렌더링
   */
  async renderMonthlyView(data, ctx) {
    try {
      const {
        monthlyUsage = [],
        currentMonth = new Date().getMonth() + 1,
        currentYear = new Date().getFullYear(),
        totalLeave = 15,
        remainingLeave = 15
      } = data || {};

      let text = `📈 *${currentYear}년 월별 연차 사용 현황*\n\n`;

      // 월별 사용 현황
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
        "12월"
      ];

      for (let month = 1; month <= 12; month++) {
        const usage = monthlyUsage.find((m) => m.month === month) || {
          days: 0,
          count: 0
        };
        const isCurrentMonth = month === currentMonth;
        const monthIcon = isCurrentMonth
          ? "📍"
          : month <= currentMonth
            ? "✅"
            : "⏳";

        text += `${monthIcon} *${monthNames[month]}*: ${usage.days}일 사용`;
        if (usage.count > 0) {
          text += ` (${usage.count}회)`;
        }
        text += "\n";

        // 현재 월이면 상세 정보
        if (isCurrentMonth && usage.details && usage.details.length > 0) {
          usage.details.forEach((detail) => {
            const typeIcon = this.getLeaveTypeIcon(detail.type);
            text += `   ${typeIcon} ${detail.date}: ${detail.type} (${detail.amount}일)\n`;
          });
        }
      }

      text += `\n📊 *전체 현황*`;
      text += `\n• 총 사용: ${totalLeave - remainingLeave}일`;
      text += `\n• 잔여 연차: ${remainingLeave}일`;
      text += `\n• 사용률: ${(((totalLeave - remainingLeave) / totalLeave) * 100).toFixed(1)}%`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏠 메인으로", callback_data: "leave:menu" },
            { text: "➕ 연차 쓰기", callback_data: "leave:use" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "monthly_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderMonthlyView 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ➕ 연차 사용 폼 렌더링
   */
  async renderUseForm(data, ctx) {
    try {
      const { remainingLeave = 0, maxContinuousDays = 10 } = data || {};

      const text = `➕ *연차 사용하기*

💰 *남은 연차: ${remainingLeave}일*

어떤 방식으로 연차를 사용하시겠어요?

📝 *직접 입력*: 최대 ${maxContinuousDays}일까지, 0.25일 단위로 입력 가능`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🕐 반반차 (0.25일)", callback_data: "leave:add:quarter" },
            { text: "🕒 반차 (0.5일)", callback_data: "leave:add:half" }
          ],
          [
            { text: "🕘 연차 (1일)", callback_data: "leave:add:full" },
            { text: "✏️ 직접 입력", callback_data: "leave:custom" } // ✅ 추가
          ],
          [{ text: "❌ 취소", callback_data: "leave:menu" }]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "use_form_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderUseForm 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ✅ 연차 사용 완료 렌더링
   */
  async renderUseSuccess(data, ctx) {
    try {
      const {
        type = "연차",
        amount = 1,
        remainingLeave = 0,
        date = TimeHelper.format(new Date(), "YYYY-MM-DD"),
        leaveType = null // ✅ 추가: 표시용 타입
      } = data;

      const typeIcon = this.getLeaveTypeIcon(type);
      const displayType = leaveType || type;

      // ✅ 메시지 개선: 양에 따라 다른 메시지
      let congratsMessage;
      if (amount >= 3) {
        congratsMessage = "🌴 긴 휴가 즐겁게 보내세요!";
      } else if (amount >= 1.5) {
        congratsMessage = "🏖️ 여유로운 휴식 되세요!";
      } else if (amount === 1) {
        congratsMessage = "🌴 즐거운 휴가 되세요!";
      } else if (amount === 0.5) {
        congratsMessage = "☀️ 반나절 휴식 되세요!";
      } else {
        congratsMessage = "☕ 짧은 휴식 되세요!";
      }

      const text = `✅ *연차 사용 완료!*

${typeIcon} *${displayType} (${amount}일)* 사용했어요
📅 날짜: ${date}
📊 남은 연차: ${remainingLeave}일

${congratsMessage}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현황 보기", callback_data: "leave:menu" },
            { text: "📈 월별 현황", callback_data: "leave:monthly" }
          ],
          [{ text: "➕ 더 쓰기", callback_data: "leave:use" }]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "use_success_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderUseSuccess 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ✏️ 직접 입력 프롬프트 렌더링 (새로 추가)
   */
  async renderCustomInputPrompt(data, ctx) {
    try {
      const {
        remainingLeave = 0,
        maxDays = 10,
        examples = ["1.5", "2", "3", "2.5"]
      } = data || {};

      const text = `✏️ *연차 직접 입력*

💰 *남은 연차: ${remainingLeave}일*

📝 *사용할 연차량을 입력해주세요*
*입력 규칙:*
• 0.25일 단위로 입력 (0.25, 0.5, 0.75, 1, 1.25, ...)
• 최대 ${maxDays}일까지 가능
• 남은 연차를 초과할 수 없음
*입력 예시:*
${examples.map((ex) => `• \`${ex}\``).join("\n")}
*취소하려면:* \`/cancel\` 또는 \`취소\` 입력`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "leave:use" }]]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "custom_input_prompt_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderCustomInputPrompt 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ❌ 연차 사용 실패 렌더링
   */
  async renderUseError(data, ctx) {
    try {
      const { message = "연차 사용에 실패했습니다." } = data || {};

      const text = `❌ *연차 사용 실패*

${message}

다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "leave:use" },
            { text: "📊 현황 보기", callback_data: "leave:menu" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "use_error_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderUseError 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 🚫 입력 취소 렌더링
   */
  async renderInputCancelled(data, ctx) {
    try {
      const { message = "연차 입력이 취소되었습니다." } = data || {};

      const text = `🚫 *입력 취소*

${message}

다른 방법으로 연차를 사용하거나 메뉴로 돌아가세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 연차 사용", callback_data: "leave:use" },
            { text: "📊 현황 보기", callback_data: "leave:menu" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "input_cancelled_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderInputCancelled 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ⚠️ 입력 오류 렌더링
   */
  async renderInputError(data, ctx) {
    try {
      const { message = "입력에 오류가 있습니다.", remainingLeave = 0 } =
        data || {};

      const text = `⚠️ *입력 오류*

${message}

💰 *남은 연차: ${remainingLeave}일*

올바른 형식으로 다시 입력해주세요.*취소하려면:* \`/cancel\` 또는 \`취소\` 입력`;

      const keyboard = {
        inline_keyboard: [[{ text: "❌ 취소", callback_data: "leave:use" }]]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "input_error_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderInputError 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ⚙️ 설정 메뉴 렌더링
   */
  async renderSettings(data, ctx) {
    try {
      const {
        totalLeave = 15,
        joinDate = null,
        workYears = 0,
        canModify = true
      } = data || {};

      const text = `⚙️ *연차 설정*

📊 *현재 설정*
• 기본 연차: 15일
• 총 연차: ${totalLeave}일
${joinDate ? `• 입사일: ${joinDate}` : ""}
${workYears >= 2 ? `• 근속 보너스: +${Math.floor(workYears / 2)}일 (${workYears}년차)` : ""}

${canModify ? "⚡ 연차를 수동으로 추가하거나 삭제할 수 있습니다." : "🔒 연차 수정이 제한되어 있습니다."}`;

      const buttons = [];

      if (canModify) {
        buttons.push([
          { text: "➕ 연차 1일 추가", callback_data: "leave:settings:add:1" },
          {
            text: "➖ 연차 1일 삭제",
            callback_data: "leave:settings:remove:1"
          }
        ]);
        buttons.push([
          { text: "👤 입사일 설정", callback_data: "leave:settings:joindate" }
        ]);
      }

      buttons.push([{ text: "🔙 뒤로", callback_data: "leave:menu" }]);

      const keyboard = { inline_keyboard: buttons };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "settings_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderSettings 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ✅ 설정 변경 완료 렌더링
   */
  async renderSettingsSuccess(data, ctx) {
    try {
      const {
        action = "변경",
        amount = 0,
        newTotal = 15,
        message = "설정이 변경되었습니다."
      } = data;

      const text = `✅ *설정 변경 완료*

${message}

📊 *새로운 연차 총계: ${newTotal}일*

${action === "add" ? `➕ ${amount}일이 추가되었습니다.` : action === "remove" ? `➖ ${amount}일이 삭제되었습니다.` : ""}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현황 보기", callback_data: "leave:menu" },
            { text: "⚙️ 설정 더보기", callback_data: "leave:settings" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "settings_success_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderSettingsSuccess 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * 💼 입사일 입력 프롬프트 렌더링
   */
  async renderJoinDatePrompt(data, ctx) {
    try {
      const text = `💼 *입사일 설정*

${data.message}

취소하려면 /cancel 을 입력해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "❌ 취소", callback_data: "leave:settings" }]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "joindate_prompt_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderJoinDatePrompt 실패:", error);
      return await this.handleRenderError(ctx, error);
    }
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    try {
      const { message = "알 수 없는 오류가 발생했습니다." } = data;

      const text = `❌ *오류 발생*

${message}

다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "leave:menu" },
            { text: "🔙 메인으로", callback_data: "system:menu" }
          ]
        ]
      };

      await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
      return { success: true, type: "error_rendered" };
    } catch (error) {
      logger.error("LeaveRenderer.renderError 실패:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== 🔧 헬퍼 메서드들 =====

  /**
   * 연차 타입별 아이콘 반환
   */
  getLeaveTypeIcon(type) {
    const icons = {
      // 기존 타입들
      연차: this.icons.full,
      반차: this.icons.half,
      반반차: this.icons.quarter,
      full: this.icons.full,
      half: this.icons.half,
      quarter: this.icons.quarter,
      1: this.icons.full,
      0.5: this.icons.half,
      0.25: this.icons.quarter,

      // ✅ 추가: 직접 입력용 (양에 따라 다른 아이콘)
      "직접 입력": "📝"
    };

    return icons[type] || this.icons.full;
  }

  /**
   * 근속년수 계산
   */
  calculateWorkYears(joinDate) {
    if (!joinDate) return 0;

    const join = new Date(joinDate);
    const now = new Date();
    const diffTime = Math.abs(now - join);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);

    return years;
  }

  /**
   * 연차 보너스 계산 (2년마다 1일 추가)
   */
  calculateYearlyBonus(workYears) {
    return workYears >= 2 ? Math.floor(workYears / 2) : 0;
  }

  /**
   * 🚨 렌더링 오류 처리
   */
  async handleRenderError(ctx, error) {
    if (this.errorHandler) {
      return await this.errorHandler.handleRenderError(
        ctx.bot,
        ctx.callbackQuery,
        error,
        {
          module: "leave",
          renderer: "LeaveRenderer",
          fallbackMessage: "연차 정보를 표시할 수 없습니다."
        }
      );
    }

    logger.error("LeaveRenderer 오류:", error);

    try {
      if (ctx.callbackQuery && ctx.callbackQuery.id) {
        await ctx.bot.answerCallbackQuery(ctx.callbackQuery.id, {
          text: "화면 표시 중 오류가 발생했습니다.",
          show_alert: true
        });
      }
    } catch (cbError) {
      logger.error("콜백 답변 실패:", cbError);
    }

    return { success: false, error: error.message };
  }
}

module.exports = LeaveRenderer;
