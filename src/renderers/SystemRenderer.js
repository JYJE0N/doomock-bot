const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🖥️ SystemRenderer - 시스템 정보 렌더링 (완전 구현)
 */
class SystemRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "system";
    logger.debug("🖥️ SystemRenderer 생성됨");
  }

  /**
   * 🎯 메인 렌더링 메서드 (필수 구현)
   */
  async render(result, ctx) {
    const { type, data } = result;

    logger.debug(`🖥️ SystemRenderer.render: ${type}`, data);

    switch (type) {
      case "main_menu":
      case "menu":
        return await this.renderMainMenu(data, ctx);
      case "help":
        return await this.renderHelp(data, ctx);
      case "status":
        return await this.renderStatus(data, ctx);
      case "about":
        return await this.renderAbout(data, ctx);
      case "error":
        // data가 아닌 result 객체 전체를 전달합니다.
        return await this.renderError(result, ctx);
      default:
        logger.warn(`🖥️ 지원하지 않는 렌더링 타입: ${type}`);
        return await this.renderError(
          { message: "지원하지 않는 기능입니다." },
          ctx
        );
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMainMenu(data, ctx) {
    const { userName, activeModules = [], systemStats = {} } = data;

    let text = `🏠 **메인 메뉴**\n\n`;
    text += `안녕하세요, ${userName}님! 👋\n\n`;

    if (activeModules.length > 0) {
      text += `🎯 **사용 가능한 기능 (${activeModules.length}개)**\n`;
      activeModules.forEach((module) => {
        text += `${module.emoji} ${module.name}\n`;
      });
      text += `\n`;
    }

    text += `📊 **시스템 정보**\n`;
    text += `• ⏱️ 가동시간: ${systemStats.uptime || "정보 없음"}\n`;
    text += `• 🔄 처리된 요청: ${systemStats.totalCallbacks || 0}회\n\n`;
    text += `원하는 기능을 선택해주세요! ✨`;

    // ✅ 실제 activeModules 데이터로 키보드 생성
    const buttons = [];

    // 모듈 버튼들 (2열씩)
    for (let i = 0; i < activeModules.length; i += 2) {
      const row = [];

      const module1 = activeModules[i];
      row.push({
        text: `${module1.emoji} ${module1.name}`,
        action: "menu",
        params: ""
      });

      if (i + 1 < activeModules.length) {
        const module2 = activeModules[i + 1];
        row.push({
          text: `${module2.emoji} ${module2.name}`,
          action: "menu",
          params: ""
        });
      }

      buttons.push(row);
    }

    // 시스템 버튼들
    buttons.push([
      { text: "📊 시스템 상태", action: "status", params: "" },
      { text: "❓ 도움말", action: "help", params: "" }
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { userName, commands = [], features = [] } = data;

    let text = `❓ **도움말**\n\n`;
    text += `안녕하세요, ${userName}님!\n\n`;

    if (commands.length > 0) {
      text += `**⌨️ 사용 가능한 명령어**\n`;
      commands.forEach((cmd) => {
        text += `• ${cmd.command} - ${cmd.description}\n`;
      });
      text += `\n`;
    }

    if (features.length > 0) {
      text += `**🎯 주요 기능**\n`;
      features.forEach((feature) => {
        text += `• ${feature}\n`;
      });
      text += `\n`;
    }

    text += `더 자세한 정보가 필요하시면 각 모듈의 도움말을 확인해주세요.`;

    const buttons = [[{ text: "🏠 메인 메뉴", action: "menu", params: "" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 시스템 상태 렌더링
   */
  async renderStatus(data, ctx) {
    const {
      status = "unknown",
      uptime = "정보 없음",
      memory = {},
      moduleCount = 0,
      lastHealthCheck = null
    } = data;

    let text = `📊 **시스템 상태**\n\n`;

    // 상태 표시
    const statusIcon = status === "healthy" ? "💚" : "❌";
    text += `${statusIcon} **전체 상태**: ${status === "healthy" ? "정상" : "문제 있음"}\n\n`;

    // 시스템 정보
    text += `🖥️ **시스템 정보**\n`;
    text += `• 가동시간: ${uptime}\n`;
    text += `• 메모리 사용량: ${memory.used || 0}MB / ${memory.total || 0}MB\n`;
    text += `• 활성 모듈: ${moduleCount}개\n\n`;

    if (lastHealthCheck) {
      text += `🔍 **마지막 체크**: ${TimeHelper.format(new Date(lastHealthCheck), "datetime")}\n\n`;
    }

    text += `시스템이 정상적으로 작동 중입니다! ✨`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "status", params: "" },
        { text: "🏠 메인 메뉴", action: "menu", params: "" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ℹ️ 정보 렌더링
   */
  async renderAbout(data, ctx) {
    let text = `ℹ️ **두목봇 정보**\n\n`;
    text += `**🤖 두목봇 v4.0.0**\n`;
    text += `통합 업무 관리 시스템\n\n`;
    text += `**🎯 주요 특징**\n`;
    text += `• 📝 할일 관리\n`;
    text += `• ⏰ 타이머 기능\n`;
    text += `• 🏢 근무시간 추적\n`;
    text += `• 🏖️ 휴가 관리\n`;
    text += `• 🌤️ 날씨 정보\n`;
    text += `• 🔮 운세\n`;
    text += `• 🔊 음성 변환\n\n`;
    text += `효율적인 업무 관리를 도와드립니다! 💪`;

    const buttons = [[{ text: "🏠 메인 메뉴", action: "menu", params: "" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message = "알 수 없는 오류가 발생했습니다." } = data;

    let text = `❌ **시스템 오류**\n\n`;
    text += `${message}\n\n`;
    text += `잠시 후 다시 시도해주세요.`;

    const buttons = [
      [
        { text: "🔄 재시도", action: "menu", params: "" },
        { text: "🏠 메인 메뉴", action: "menu", params: "" }
      ]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ⏱️ 가동시간 포맷팅
   */
  formatUptime(uptimeMs) {
    if (!uptimeMs || uptimeMs <= 0) return "정보 없음";

    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 💾 메모리 포맷팅
   */
  formatMemory(memoryBytes) {
    if (!memoryBytes || memoryBytes <= 0) return "정보 없음";

    const mb = Math.round(memoryBytes / 1024 / 1024);
    return `${mb}MB`;
  }
}

module.exports = SystemRenderer;
