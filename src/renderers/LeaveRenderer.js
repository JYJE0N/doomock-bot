// src/renderers/LeaveRenderer.js
const BaseRenderer = require("./BaseRenderer");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveRenderer - 연차 UI 렌더링 (심플 버전)
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "leave";
  }

  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "menu":
        return await this.renderMenu(data, ctx);
      case "status":
        return await this.renderStatus(data, ctx);
      case "use_select":
        return await this.renderUseSelect(data, ctx);
      case "use_success":
        return await this.renderUseSuccess(data, ctx);
      case "history":
        return await this.renderHistory(data, ctx);
      case "settings":
        return await this.renderSettings(data, ctx);
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
   * 🏖️ 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, status } = data;

    let text = `🏖️ **연차 관리**\n\n`;
    text += `안녕하세요, ${userName}님!\n\n`;

    if (status) {
      text += `📊 **현재 연차 현황**\n`;
      text += `• 연간 총 연차: ${status.annual}일\n`;
      text += `• 사용한 연차: ${status.used}일\n`;
      text += `• 잔여 연차: ${status.remaining}일\n`;
      text += `• 사용률: ${status.usageRate}%\n\n`;

      // 진행률 바
      const progress = data.progressBar;
      text += `${progress}\n\n`;
    }

    text += `원하는 기능을 선택해주세요.`;

    const buttons = [
      [
        { text: "🏖️ 연차 사용", action: "use" },
        { text: "📊 현황 보기", action: "status" },
      ],
      [
        { text: "📋 사용 이력", action: "history" },
        { text: "⚙️ 설정", action: "settings" },
      ],
      [{ text: "🔙 메인 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(
      buttons,
      data.status ? this.moduleName : "system"
    );

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 현황 렌더링
   */
  async renderStatus(data, ctx) {
    const { userName, status, year } = data;

    let text = `📊 **${year}년 연차 현황**\n\n`;
    text += `👤 **${userName}님의 연차 정보**\n\n`;

    text += `📋 **전체 현황**\n`;
    text += `• 연간 총 연차: ${status.annual}일\n`;
    text += `• 사용한 연차: ${status.used}일\n`;
    text += `• 잔여 연차: ${status.remaining}일\n`;
    text += `• 사용률: ${status.usageRate}%\n\n`;

    // 진행률 바
    const progress = this.createProgressBar(status.used, status.annual);
    text += `📊 **사용 진행률**\n${progress}\n\n`;

    // 권장사항
    const currentMonth = new Date().getMonth() + 1;
    if (status.remaining > 0 && currentMonth >= 11) {
      text += `⚠️ **연말 알림**: 남은 연차를 모두 사용하세요!\n\n`;
    } else if (status.usageRate < 30 && currentMonth > 6) {
      text += `💡 **추천**: 적절한 휴식을 위해 연차를 더 활용해보세요.\n\n`;
    }

    text += `📅 ${TimeHelper.format(new Date(), "YYYY년 MM월 DD일")} 기준`;

    const buttons = [
      [
        { text: "🏖️ 연차 사용", action: "use" },
        { text: "📋 사용 이력", action: "history" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏖️ 연차 사용 선택 렌더링
   */
  async renderUseSelect(data, ctx) {
    const { status, leaveTypes } = data;

    let text = `🏖️ **연차 사용**\n\n`;
    text += `💡 **잔여 연차**: ${status.remaining}일\n\n`;
    text += `사용할 연차 유형을 선택해주세요:`;

    const buttons = [];

    // 연차 타입별 버튼
    Object.entries(leaveTypes).forEach(([key, config]) => {
      if (status.remaining >= config.value) {
        buttons.push([
          {
            text: `${config.label}`,
            action: "use",
            params: key,
          },
        ]);
      }
    });

    // 잔여 연차가 부족한 경우
    if (buttons.length === 0) {
      text += `\n\n❌ **사용 가능한 연차가 없습니다.**`;
    }

    buttons.push([{ text: "🔙 메뉴", action: "menu" }]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ✅ 연차 사용 성공 렌더링
   */
  async renderUseSuccess(data, ctx) {
    const { amount, label, remaining, message } = data;

    const text = `✅ **연차 사용 완료**

${message}

📊 **사용 정보**
• 사용한 연차: ${amount}일
• 잔여 연차: ${remaining}일

즐거운 휴가 되세요! 🌴`;

    const buttons = [
      [
        { text: "🏖️ 추가 사용", action: "use" },
        { text: "📊 현황 보기", action: "status" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📋 이력 렌더링
   */
  async renderHistory(data, ctx) {
    const { history, year } = data;

    let text = `📋 **${year}년 연차 사용 이력**\n\n`;

    if (history.length === 0) {
      text += `아직 사용한 연차가 없습니다.\n\n`;
    } else {
      history.forEach((record, index) => {
        const date = TimeHelper.format(new Date(record.date), "MM/DD");
        text += `${index + 1}. ${date} - ${record.reason} (${
          record.amount
        }일)\n`;
      });
      text += `\n📊 **총 ${history.length}건의 기록**\n`;
    }

    const buttons = [
      [
        { text: "📊 현황 보기", action: "status" },
        { text: "🏖️ 연차 사용", action: "use" },
      ],
      [{ text: "🔙 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    const text = `⚙️ **연차 설정**

${data.message}

현재 설정:
• 기본 연차: ${data.config.defaultAnnualLeave}일
• 지원 타입: 연차, 반차, 반반차

설정 기능은 향후 업데이트에서 제공될 예정입니다.`;

    const buttons = [[{ text: "🔙 메뉴", action: "menu" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const text = `❌ **오류 발생**

${data.message}

다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: "🔙 메인 메뉴", action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, "system");

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 진행률 바 생성
   */
  createProgressBar(used, total, length = 10) {
    if (total === 0) return "▱".repeat(length) + " 0%";

    const percentage = Math.min(100, Math.max(0, (used / total) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;

    const bar = "▰".repeat(filled) + "▱".repeat(empty);
    return `${bar} ${Math.round(percentage)}%`;
  }
}

module.exports = LeaveRenderer;
