// src/renderers/LeaveRenderer.js - 연차 관리 UI 렌더러

const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏖️ LeaveRenderer - 연차 관리 UI 렌더링 전담
 *
 * 🎯 책임:
 * - 연차 현황 화면 렌더링
 * - 연차 사용 기록 표시
 * - 연차 관련 인라인 키보드 생성
 * - 사용자 친화적 연차 정보 표시
 *
 * ✅ SoC: UI 렌더링만 담당, 비즈니스 로직은 다루지 않음
 */
class LeaveRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "leave";

    // 연차 관련 이모지
    this.emojis = {
      calendar: "📅",
      used: "🏖️",
      remaining: "💼",
      history: "📋",
      add: "➕",
      statistics: "📊",
      help: "❓",
      warning: "⚠️",
      success: "✅",
      error: "❌",
    };
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

        case "status":
          return await this.renderStatusResponse(data, ctx);

        case "history":
          return await this.renderHistoryResponse(data, ctx);

        case "help":
          return await this.renderHelpResponse(data, ctx);

        case "input":
          return await this.renderInputPrompt(data, ctx);

        case "success":
          return await this.renderSuccessResponse(data, ctx);

        case "error":
          return await this.renderErrorResponse(data, ctx);

        default:
          logger.warn(`알 수 없는 연차 렌더링 타입: ${type}`);
          await this.renderErrorResponse(
            { message: "지원하지 않는 기능입니다." },
            ctx
          );
      }
    } catch (error) {
      logger.error("LeaveRenderer 오류:", error);
      await this.renderErrorResponse({ message: error.message }, ctx);
    }
  }

  /**
   * 🏖️ 연차 메뉴 렌더링
   */
  renderMenu(data) {
    const userName = data?.userName || "사용자";

    let text = `${this.emojis.calendar} *연차 관리*\n\n`;
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n`;
    text += `연차 관리 시스템에 오신 것을 환영합니다\\.\n\n`;

    // 간단한 현황 요약 (있는 경우)
    if (data?.quickStatus) {
      const status = data.quickStatus;
      text += `📊 *현재 연차 현황*\n`;
      text += `• 잔여 연차: ${this.escapeMarkdownV2(
        String(status.remaining)
      )}일\n`;
      text += `• 사용 연차: ${this.escapeMarkdownV2(String(status.used))}일\n`;
      text += `• 사용률: ${this.escapeMarkdownV2(
        String(status.usageRate)
      )}%\n\n`;
    }

    text += `어떤 작업을 수행하시겠어요\\?`;

    return {
      text,
      keyboard: this.createMenuKeyboard(),
    };
  }

  /**
   * 📊 연차 현황 렌더링
   */
  renderStatus(data) {
    const { status } = data;

    let text = `${this.emojis.statistics} *${status.year}년 연차 현황*\n\n`;

    // 메인 현황
    text += `📋 *전체 현황*\n`;
    text += `• 연간 총 연차: ${this.escapeMarkdownV2(
      String(status.total)
    )}일\n`;
    text += `• 사용한 연차: ${this.escapeMarkdownV2(String(status.used))}일\n`;
    text += `• 남은 연차: ${this.escapeMarkdownV2(
      String(status.remaining)
    )}일\n`;
    text += `• 사용률: ${this.escapeMarkdownV2(String(status.usageRate))}%\n\n`;

    // 진행률 바
    text += `📊 *사용 진행률*\n`;
    text += this.createProgressBar(status.used, status.total);
    text += `\n\n`;

    // 이번 달 사용량 (있는 경우)
    if (status.thisMonth !== undefined) {
      text += `📅 *이번 달 사용*\n`;
      text += `• 사용한 연차: ${this.escapeMarkdownV2(
        String(status.thisMonth)
      )}일\n\n`;
    }

    // 경고 메시지
    if (status.remaining <= 2) {
      text += `${this.emojis.warning} *연차가 얼마 남지 않았습니다\\!*\n`;
      text += `계획적으로 사용하세요\\.\n\n`;
    } else if (status.usageRate < 20 && this.isYearEnd()) {
      text += `${this.emojis.warning} *연차 사용률이 낮습니다\\.*\n`;
      text += `연말 전에 계획을 세워보세요\\.\n\n`;
    }

    text += `${TimeHelper.format(TimeHelper.now(), "YYYY년 MM월 DD일")} 기준`;

    return {
      text,
      keyboard: this.createStatusKeyboard(),
    };
  }

  /**
   * 📋 연차 사용 기록 렌더링
   */
  renderHistory(data) {
    const { history } = data;

    let text = `${this.emojis.history} *연차 사용 기록*\n\n`;

    if (!history || history.length === 0) {
      text += `아직 사용한 연차가 없습니다\\.\n`;
      text += `첫 연차를 계획해보세요\\!`;

      return {
        text,
        keyboard: this.createHistoryKeyboard(false),
      };
    }

    text += `총 ${this.escapeMarkdownV2(String(history.length))}개의 기록\n\n`;

    // 최근 기록들 표시 (최대 10개)
    const recentHistory = history.slice(0, 10);

    recentHistory.forEach((record, index) => {
      const date = TimeHelper.format(record.usedDate, "MM/DD");
      const days = record.days;
      const reason = record.reason || "개인 사유";

      text += `${index + 1}\\. `;
      text += `${this.escapeMarkdownV2(date)} \\- `;
      text += `${this.escapeMarkdownV2(String(days))}일 `;
      text += `\\(${this.escapeMarkdownV2(reason)}\\)\n`;
    });

    if (history.length > 10) {
      text += `\n\\.\\.\\. 외 ${this.escapeMarkdownV2(
        String(history.length - 10)
      )}개 기록`;
    }

    return {
      text,
      keyboard: this.createHistoryKeyboard(true),
    };
  }

  /**
   * ❓ 도움말 렌더링
   */
  renderHelp(data) {
    let text = `${this.emojis.help} *연차 관리 도움말*\n\n`;

    text += `🎯 *주요 기능*\n`;
    text += `• 📊 현황 확인 \\- 연차 잔여량과 사용률 확인\n`;
    text += `• 🏖️ 연차 사용 \\- 새로운 연차 사용 기록\n`;
    text += `• 📋 사용 기록 \\- 지금까지의 연차 사용 내역\n\n`;

    text += `💡 *사용 팁*\n`;
    text += `• 연차는 0\\.5일 단위로 사용할 수 있습니다\n`;
    text += `• 사유를 입력하면 기록 관리가 편리합니다\n`;
    text += `• 정기적으로 현황을 확인하세요\n\n`;

    text += `⚠️ *주의사항*\n`;
    text += `• 입력한 연차는 수정이 어려우니 신중하게 입력하세요\n`;
    text += `• 연차는 당해년도에만 유효합니다\n\n`;

    text += `🔄 *명령어*\n`;
    text += `• /leave \\- 연차 관리 메뉴 열기`;

    return {
      text,
      keyboard: this.createHelpKeyboard(),
    };
  }

  /**
   * ✅ 성공 메시지 렌더링
   */
  renderSuccess(data) {
    const { message, details } = data;

    let text = `${this.emojis.success} *성공\\!*\n\n`;
    text += `${this.escapeMarkdownV2(message)}\n\n`;

    if (details) {
      text += `📋 *세부 정보*\n`;
      if (details.days) {
        text += `• 사용 일수: ${this.escapeMarkdownV2(
          String(details.days)
        )}일\n`;
      }
      if (details.reason) {
        text += `• 사유: ${this.escapeMarkdownV2(details.reason)}\n`;
      }
      if (details.remaining !== undefined) {
        text += `• 남은 연차: ${this.escapeMarkdownV2(
          String(details.remaining)
        )}일\n`;
      }
    }

    return {
      text,
      keyboard: this.createBackKeyboard(),
    };
  }

  /**
   * 📝 입력 프롬프트 렌더링
   */
  renderInputPrompt(data) {
    const { message, inputType } = data;

    let text = `${this.emojis.add} *연차 사용 등록*\n\n`;
    text += `${this.escapeMarkdownV2(message)}\n\n`;

    if (inputType === "leave_days") {
      text += `💡 *입력 예시*\n`;
      text += `• 1 \\(하루 종일\\)\n`;
      text += `• 0\\.5 \\(반차\\)\n`;
      text += `• 2\\.5 \\(이틀 반\\)\n\n`;

      text += `⚠️ 소수점은 0\\.5 단위로만 입력 가능합니다\\.`;
    } else if (inputType === "leave_reason") {
      text += `💡 *사유 예시*\n`;
      text += `• 개인 사유\n`;
      text += `• 병원 방문\n`;
      text += `• 가족 행사\n`;
      text += `• 여행\n\n`;

      text += `선택사항입니다\\. 입력하지 않으면 "개인 사유"로 저장됩니다\\.`;
    }

    return {
      text,
      keyboard: this.createInputKeyboard(),
    };
  }

  // ===== 🎹 키보드 생성 메서드 =====

  /**
   * 🎹 메인 메뉴 키보드
   */
  createMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 연차 현황", callback_data: "leave:status" },
          { text: "🏖️ 연차 사용", callback_data: "leave:use" },
        ],
        [
          { text: "📋 사용 기록", callback_data: "leave:history" },
          { text: "❓ 도움말", callback_data: "leave:help" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * 🎹 현황 화면 키보드
   */
  createStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🏖️ 연차 사용", callback_data: "leave:use" },
          { text: "📋 사용 기록", callback_data: "leave:history" },
        ],
        [
          { text: "🔄 새로고침", callback_data: "leave:status" },
          { text: "◀️ 뒤로", callback_data: "leave:menu" },
        ],
      ],
    };
  }

  /**
   * 🎹 기록 화면 키보드
   */
  createHistoryKeyboard(hasData) {
    const keyboard = [];

    if (hasData) {
      keyboard.push([
        { text: "🏖️ 연차 사용", callback_data: "leave:use" },
        { text: "📊 현황 보기", callback_data: "leave:status" },
      ]);
    } else {
      keyboard.push([{ text: "🏖️ 첫 연차 사용", callback_data: "leave:use" }]);
    }

    keyboard.push([{ text: "◀️ 뒤로", callback_data: "leave:menu" }]);

    return { inline_keyboard: keyboard };
  }

  /**
   * 🎹 도움말 키보드
   */
  createHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 현황 보기", callback_data: "leave:status" },
          { text: "🏖️ 연차 사용", callback_data: "leave:use" },
        ],
        [{ text: "◀️ 뒤로", callback_data: "leave:menu" }],
      ],
    };
  }

  /**
   * 🎹 입력 중 키보드
   */
  createInputKeyboard() {
    return {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "leave:menu" }]],
    };
  }

  /**
   * 🎹 뒤로가기 키보드
   */
  createBackKeyboard() {
    return {
      inline_keyboard: [[{ text: "◀️ 뒤로", callback_data: "leave:menu" }]],
    };
  }

  // ===== 🛠️ 응답 렌더링 메서드 =====

  /**
   * 📋 메뉴 응답 렌더링
   */
  async renderMenuResponse(data, ctx) {
    const rendered = this.renderMenu(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📊 현황 응답 렌더링
   */
  async renderStatusResponse(data, ctx) {
    const rendered = this.renderStatus(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📋 기록 응답 렌더링
   */
  async renderHistoryResponse(data, ctx) {
    const rendered = this.renderHistory(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ❓ 도움말 응답 렌더링
   */
  async renderHelpResponse(data, ctx) {
    const rendered = this.renderHelp(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ✅ 성공 응답 렌더링
   */
  async renderSuccessResponse(data, ctx) {
    const rendered = this.renderSuccess(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ❌ 에러 응답 렌더링
   */
  async renderErrorResponse(data, ctx) {
    const rendered = this.renderError(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📝 입력 프롬프트 응답 렌더링
   */
  async renderInputPrompt(data, ctx) {
    const rendered = this.renderInputPrompt(data);

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      rendered.text,
      rendered.keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  // ===== 🛠️ 헬퍼 메서드 =====

  /**
   * 📊 진행률 바 생성
   */
  createProgressBar(used, total, length = 10) {
    const percentage = Math.min(100, Math.max(0, (used / total) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;

    const bar = "▰".repeat(filled) + "▱".repeat(empty);
    return `${bar} ${Math.round(percentage)}%`;
  }

  /**
   * 📅 연말 체크
   */
  isYearEnd() {
    const now = TimeHelper.now();
    const month = now.getMonth() + 1; // 0-based to 1-based
    return month >= 10; // 10월 이후를 연말로 간주
  }

  /**
   * ❌ 에러 메시지 렌더링
   */
  renderError(error) {
    const message = error?.message || "알 수 없는 오류가 발생했습니다.";

    return {
      text: `${this.emojis.error} *오류 발생*\n\n${this.escapeMarkdownV2(
        message
      )}`,
      keyboard: this.createBackKeyboard(),
    };
  }
}

module.exports = LeaveRenderer;
