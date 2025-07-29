const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemRenderer - 시스템 관련 UI 렌더링 전담
 *
 * ✅ 담당 기능:
 * - 메인 메뉴 렌더링
 * - 시스템 정보 표시
 * - 도움말 화면
 * - 상태 모니터링 화면
 * - 에러 화면
 */
class SystemRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);
    this.moduleName = "system";
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    switch (type) {
      case "main_menu":
      case "menu":
        return await this.renderMainMenu(data, ctx);

      case "help":
        return await this.renderHelp(data, ctx);

      case "status":
      case "info":
        return await this.renderSystemInfo(data, ctx);

      case "settings":
        return await this.renderSettings(data, ctx);

      case "about":
        return await this.renderAbout(data, ctx);

      default:
        return await this.renderError("지원하지 않는 시스템 기능입니다.", ctx);
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링
   */
  async renderMainMenu(data, ctx) {
    const userName = getUserName(ctx.from || ctx.callbackQuery?.from);

    let text = "🤖 *두목봇 v4\\.0\\.0*\n\n";

    // 두목봇 환영 인사
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "systemWelcome",
      userName
    );
    text += `${this.escapeMarkdownV2(welcomeMessage)}\n\n`;

    text += "무엇을 도와드릴까요\\?\n\n";
    text += "모듈을 선택하세요\\:";

    // 활성화된 모듈들 키보드 생성
    const keyboard = this.buildMainMenuKeyboard(data?.enabledModules || []);

    await this.sendMessage(
      ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }

  /**
   * 🏠 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(enabledModules) {
    const keyboard = { inline_keyboard: [] };

    // 기본 모듈 아이콘과 이름 매핑
    const moduleInfo = {
      fortune: { icon: "🔮", name: "운세" },
      todo: { icon: "📋", name: "할일 관리" },
      timer: { icon: "⏰", name: "타이머" },
      worktime: { icon: "🏢", name: "근무시간" },
      leave: { icon: "🏖️", name: "휴가" },
      reminder: { icon: "🔔", name: "리마인더" },
      weather: { icon: "🌤️", name: "날씨" },
      tts: { icon: "🔊", name: "음성변환" },
    };

    // 활성화된 모듈들을 2열씩 배치
    for (let i = 0; i < enabledModules.length; i += 2) {
      const row = [];

      // 첫 번째 모듈
      const module1 = enabledModules[i];
      const info1 = moduleInfo[module1.key] || {
        icon: "📱",
        name: module1.key,
      };
      row.push({
        text: `${info1.icon} ${info1.name}`,
        callback_data: `${module1.key}:menu`,
      });

      // 두 번째 모듈 (있으면)
      if (i + 1 < enabledModules.length) {
        const module2 = enabledModules[i + 1];
        const info2 = moduleInfo[module2.key] || {
          icon: "📱",
          name: module2.key,
        };
        row.push({
          text: `${info2.icon} ${info2.name}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 하단 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "ℹ️ 정보", callback_data: "system:info" },
      { text: "📊 상태", callback_data: "system:status" },
    ]);

    return keyboard;
  }

  /**
   * ❓ 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "❓ *두목봇 도움말*\n\n";

    text += "🤖 *두목봇이란\\?*\n";
    text += "업무 효율성을 높여주는 다기능 텔레그램 봇입니다\\.\n\n";

    text += "📱 *주요 기능*:\n";
    text += "• 🔮 *운세* \\- 타로 카드 운세\n";
    text += "• 📋 *할일 관리* \\- 체계적인 업무 관리\n";
    text += "• 🔊 *음성변환* \\- 텍스트를 음성으로\n";
    text += "• ⏰ *타이머* \\- 포모도로 기법\n";
    text += "• 🏢 *근무시간* \\- 출퇴근 관리\n";
    text += "• 🌤️ *날씨* \\- 실시간 날씨 정보\n\n";

    text += "⌨️ *명령어*:\n";
    text += "• `/start` \\- 메인 메뉴\n";
    text += "• `/help` \\- 도움말\n";
    text += "• `/fortune` \\- 운세 메뉴\n";
    text += "• `/todo` \\- 할일 관리\n";
    text += "• `/tts` \\- 음성변환\n\n";

    text += "🔧 *사용 팁*:\n";
    text += "• 버튼을 클릭해서 쉽게 이용하세요\n";
    text += "• 각 모듈의 도움말도 확인해보세요\n";
    text += "• 문제가 있으면 개발자에게 문의하세요\n\n";

    const helpMessage = DoomockMessageGenerator.generateMessage(
      "ending",
      userName
    );
    text += `💬 ${this.escapeMarkdownV2(helpMessage)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔮 운세 시작", callback_data: "fortune:menu" },
          { text: "📋 할일 관리", callback_data: "todo:menu" },
        ],
        [
          { text: "🔊 음성변환", callback_data: "tts:menu" },
          { text: "ℹ️ 시스템 정보", callback_data: "system:info" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ℹ️ 시스템 정보 렌더링
   */
  async renderSystemInfo(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "ℹ️ *시스템 정보*\n\n";

    text += "🤖 *두목봇 v4\\.0\\.0*\n";
    text += "업무 효율성 극대화 봇\n\n";

    if (data?.systemInfo) {
      const info = data.systemInfo;

      text += "📊 *시스템 상태*:\n";
      text += `• 가동 시간: ${this.escapeMarkdownV2(
        info.uptime || "알 수 없음"
      )}\n`;
      text += `• 메모리 사용량: ${this.escapeMarkdownV2(
        info.memoryUsage || "알 수 없음"
      )}\n`;
      text += `• 활성 사용자: ${this.escapeMarkdownV2(
        String(info.activeUsers || 0)
      )}명\n`;
      text += `• 처리된 메시지: ${this.escapeMarkdownV2(
        String(info.totalMessages || 0)
      )}개\n\n`;
    }

    if (data?.modules) {
      text += "📱 *활성 모듈*:\n";
      data.modules.forEach((module) => {
        const statusIcon = module.status === "active" ? "✅" : "❌";
        text += `${statusIcon} ${this.escapeMarkdownV2(module.name)}\n`;
      });
      text += "\n";
    }

    text += "🔧 *기술 스택*:\n";
    text += "• Node\\.js \\+ Telegraf\n";
    text += "• MongoDB \\+ Mongoose\n";
    text += "• Railway 호스팅\n";
    text += "• 렌더러 패턴 아키텍처\n\n";

    text += "👨‍💻 *개발자*: Your Name\n";
    text += "📅 *최종 업데이트*: 2025\\-07\\-29\n\n";

    const infoMessage = DoomockMessageGenerator.generateMessage(
      "stats",
      userName
    );
    text += `💬 ${this.escapeMarkdownV2(infoMessage)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 상세 상태", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 📊 시스템 상태 렌더링
   */
  async renderSystemStatus(data, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "📊 *시스템 상태*\n\n";

    if (data?.health) {
      const health = data.health;

      text += "🏥 *헬스 체크*:\n";
      text += `• 전체 상태: ${
        health.overall === "healthy" ? "✅ 정상" : "❌ 이상"
      }\n`;
      text += `• 데이터베이스: ${
        health.database === "connected" ? "✅ 연결됨" : "❌ 연결 안됨"
      }\n`;
      text += `• 외부 API: ${
        health.externalServices === "up" ? "✅ 정상" : "❌ 이상"
      }\n\n`;
    }

    if (data?.performance) {
      const perf = data.performance;

      text += "⚡ *성능 지표*:\n";
      text += `• 평균 응답시간: ${this.escapeMarkdownV2(
        perf.avgResponseTime || "0"
      )}ms\n`;
      text += `• 오류율: ${this.escapeMarkdownV2(perf.errorRate || "0")}%\n`;
      text += `• 처리량: ${this.escapeMarkdownV2(
        perf.throughput || "0"
      )}/분\n\n`;
    }

    if (data?.moduleStats) {
      text += "📱 *모듈별 통계*:\n";
      data.moduleStats.forEach((module) => {
        text += `• ${this.escapeMarkdownV2(
          module.name
        )}: ${this.escapeMarkdownV2(String(module.usage))}회 사용\n`;
      });
      text += "\n";
    }

    const statusMessage = DoomockMessageGenerator.generateMessage(
      "stats",
      userName
    );
    text += `💬 ${this.escapeMarkdownV2(statusMessage)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "ℹ️ 시스템 정보", callback_data: "system:info" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ⚙️ 설정 렌더링
   */
  async renderSettings(data, ctx) {
    let text = "⚙️ *시스템 설정*\n\n";

    text += "현재 설정 기능은 개발 중입니다\\.\n";
    text += "추후 업데이트에서 제공될 예정입니다\\.\n\n";

    text += "📋 *계획된 설정*:\n";
    text += "• 알림 설정\n";
    text += "• 언어 설정\n";
    text += "• 테마 설정\n";
    text += "• 개인화 옵션\n";

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * 🏢 About 화면 렌더링
   */
  async renderAbout(data, ctx) {
    let text = "🏢 *두목봇 소개*\n\n";

    text += "🎯 *미션*:\n";
    text += "직장인들의 업무 효율성을 극대화하여\n";
    text += "더 나은 워라밸을 제공합니다\\.\n\n";

    text += "💡 *핵심 가치*:\n";
    text += "• 단순함 \\- 복잡한 기능을 간단하게\n";
    text += "• 효율성 \\- 시간 절약이 최우선\n";
    text += "• 신뢰성 \\- 언제나 안정적인 서비스\n\n";

    text += "🚀 *로드맵*:\n";
    text += "• AI 어시스턴트 통합\n";
    text += "• 팀 협업 기능\n";
    text += "• 모바일 앱 출시\n";
    text += "• 기업용 솔루션\n";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 상태 확인", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery.message.chat.id,
      text,
      keyboard,
      ctx.callbackQuery.message.message_id
    );
  }

  /**
   * ❌ 에러 화면 렌더링
   */
  async renderError(message, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from);

    let text = "❌ *시스템 오류*\n\n";
    text += `${this.escapeMarkdownV2(message)}\n\n`;

    const errorMessage = DoomockMessageGenerator.getContextualMessage(
      "systemError",
      userName
    );
    text += `💬 ${this.escapeMarkdownV2(errorMessage)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "system:menu" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    await this.sendMessage(
      ctx.callbackQuery?.message?.chat?.id || ctx.chat?.id,
      text,
      keyboard,
      ctx.callbackQuery?.message?.message_id
    );
  }
}

module.exports = SystemRenderer;
