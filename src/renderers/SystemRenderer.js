// src/renderers/SystemRenderer.js - logger 오류 수정 버전
const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger"); // ✅ 이 줄 추가!
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🖥️ SystemRenderer - 시스템 정보 렌더링 (logger 수정)
 */
class SystemRenderer extends BaseRenderer {
  constructor() {
    super("system");

    // 시스템 관련 이모지
    this.emojis = {
      system: "🖥️",
      status: "📊",
      health: "💚",
      warning: "⚠️",
      error: "❌",
      info: "ℹ️",
      menu: "📋",
      help: "❓",
      home: "🏠",
      refresh: "🔄",
    };

    logger.debug("🖥️ SystemRenderer 생성됨"); // ✅ 이제 작동함
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMenu(data, ctx) {
    const { userName, systemInfo, moduleStats, timestamp } = data;

    let text = `🤖 **두목봇 v4.0.0**\n\n`;
    text += `안녕하세요, ${userName}님! 👋\n\n`;

    // 시스템 상태 요약
    text += `📊 **시스템 상태**\n`;
    text += `• 가동시간: ${this.formatUptime(systemInfo?.uptime || 0)}\n`;
    text += `• 활성 모듈: ${moduleStats?.activeModules || 0}개\n`;
    text += `• 메모리 사용량: ${this.formatMemory(
      systemInfo?.memory || 0
    )}\n\n`;

    text += `✨ **원하는 기능을 선택해주세요!**`;

    // 메인 메뉴 버튼들
    const buttons = [
      [
        { text: "📋 할일 관리", action: "module", params: "todo" },
        { text: "🍅 타이머", action: "module", params: "timer" },
      ],
      [
        { text: "🏢 근무시간", action: "module", params: "worktime" },
        { text: "🏖️ 연차 관리", action: "module", params: "leave" },
      ],
      [
        { text: "🌤️ 날씨", action: "module", params: "weather" },
        { text: "🔮 운세", action: "module", params: "fortune" },
      ],
      [
        { text: "🔊 음성변환", action: "module", params: "tts" },
        { text: "📊 시스템 상태", action: "status" },
      ],
      [{ text: "❓ 도움말", action: "help" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 시스템 상태 렌더링
   */
  async renderStatus(data, ctx) {
    const { systemInfo, moduleStats, services, timestamp } = data;

    let text = `📊 **시스템 상태 보고서**\n\n`;

    // 기본 시스템 정보
    text += `🖥️ **시스템 정보**\n`;
    text += `• 버전: 두목봇 v4.0.0\n`;
    text += `• 환경: ${systemInfo?.environment || "development"}\n`;
    text += `• 가동시간: ${this.formatUptime(systemInfo?.uptime || 0)}\n`;
    text += `• 메모리: ${this.formatMemory(systemInfo?.memory || 0)}\n\n`;

    // 모듈 상태
    text += `📦 **모듈 상태**\n`;
    text += `• 전체: ${moduleStats?.totalModules || 0}개\n`;
    text += `• 활성화: ${moduleStats?.activeModules || 0}개\n`;
    text += `• 비활성화: ${moduleStats?.inactiveModules || 0}개\n`;
    text += `• 오류: ${moduleStats?.errorModules || 0}개\n\n`;

    // 서비스 상태
    if (services && Object.keys(services).length > 0) {
      text += `⚙️ **서비스 상태**\n`;
      Object.entries(services).forEach(([name, status]) => {
        const statusIcon = status.isReady ? "✅" : "❌";
        text += `• ${name}: ${statusIcon}\n`;
      });
      text += `\n`;
    }

    text += `⏰ **마지막 업데이트**: ${
      timestamp || TimeHelper.format(TimeHelper.now(), "full")
    }`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "status" },
        { text: "📈 상세 정보", action: "info" },
      ],
      [{ text: "🏠 메인 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const { features, commands, tips } = data;

    let text = `❓ **두목봇 도움말**\n\n`;

    text += `🎯 **주요 기능**\n`;
    if (features) {
      Object.entries(features).forEach(([key, description]) => {
        text += `• ${description}\n`;
      });
    } else {
      text += `• 📋 할일 관리\n`;
      text += `• 🍅 뽀모도로 타이머\n`;
      text += `• 🏢 근무시간 추적\n`;
      text += `• 🌤️ 날씨 정보\n`;
      text += `• 🔮 타로 운세\n`;
      text += `• 🔊 텍스트 음성변환\n`;
    }

    text += `\n💡 **사용법**\n`;
    text += `• 버튼을 눌러 기능을 선택하세요\n`;
    text += `• 자연어로 명령할 수도 있어요\n`;
    text += `• 예: "할일", "날씨", "타이머 시작"\n\n`;

    text += `🚀 **팁**\n`;
    text += `• /start - 메인 메뉴로 이동\n`;
    text += `• /help - 이 도움말 보기\n`;
    text += `• /status - 시스템 상태 확인\n`;

    const buttons = [
      [
        { text: "🏠 메인 메뉴", action: "menu" },
        { text: "📊 시스템 상태", action: "status" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 시스템 정보 렌더링
   */
  async renderInfo(data, ctx) {
    const { systemInfo, performance, database } = data;

    let text = `ℹ️ **시스템 정보**\n\n`;

    text += `🔧 **기술 스택**\n`;
    text += `• Node.js ${process.version}\n`;
    text += `• Telegraf (텔레그램 봇)\n`;
    text += `• MongoDB + Mongoose\n`;
    text += `• Railway (배포)\n\n`;

    text += `📊 **성능 지표**\n`;
    text += `• CPU 사용률: ${performance?.cpu || "N/A"}%\n`;
    text += `• 메모리 사용률: ${performance?.memory || "N/A"}%\n`;
    text += `• 응답시간: ${performance?.responseTime || "N/A"}ms\n\n`;

    text += `🗄️ **데이터베이스**\n`;
    text += `• 연결 상태: ${
      database?.connected ? "✅ 연결됨" : "❌ 연결 안됨"
    }\n`;
    text += `• 컬렉션 수: ${database?.collections || "N/A"}개\n`;
    text += `• 총 문서 수: ${database?.documents || "N/A"}개\n`;

    const buttons = [
      [
        { text: "🔄 새로고침", action: "info" },
        { text: "📊 상태", action: "status" },
      ],
      [{ text: "🏠 메인 메뉴", action: "menu" }],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 에러 렌더링
   */
  async renderError(data, ctx) {
    const { message } = data;

    let text = `❌ **시스템 오류**\n\n`;
    text += `${message || "알 수 없는 오류가 발생했습니다"}\n\n`;
    text += `🔧 **해결 방법**\n`;
    text += `• 잠시 후 다시 시도해보세요\n`;
    text += `• 문제가 지속되면 관리자에게 문의하세요\n`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: "📊 시스템 상태", action: "status" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 가동시간 포맷팅
   */
  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 메모리 포맷팅
   */
  formatMemory(bytes) {
    const mb = Math.round(bytes / 1024 / 1024);
    return `${mb}MB`;
  }
}

module.exports = SystemRenderer;
