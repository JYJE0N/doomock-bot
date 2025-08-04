const BaseRenderer = require("./BaseRenderer");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { StatusHelper } = require("../utils/StatusHelper");

class SystemRenderer extends BaseRenderer {
  constructor(bot, navigationHandler, markdownHelper) {
    super(bot, navigationHandler, markdownHelper);
    this.moduleName = "system";

    // 🎨 UI 스타일
    this.ui = {
      icons: {
        excellent: "🏆",
        good: "🌟",
        fair: "✅",
        poor: "⚠️",
        critical: "🚨",
        system: "🖥️",
        memory: "💾",
        cpu: "🔧",
        network: "🌐",
        modules: "📦"
      },
      separators: {
        main: "━━━━━━━━━━━━━━━━━━",
        sub: "────────────────",
        dot: "• "
      }
    };

    logger.debug("🖥️ SystemRenderer 생성됨 (완전 통합)");
  }

  /**
   * 🎯 메인 렌더링 메서드
   */
  async render(result, ctx) {
    const { type, data } = result;

    try {
      switch (type) {
        case "main_menu":
        case "menu":
          return await this.renderMainMenu(data, ctx);
        case "help":
          return await this.renderHelp(data, ctx);
        case "status":
          return await this.renderStatus(data, ctx);
        case "health": // 🆕 건강도 전용 렌더링
          return await this.renderHealth(data, ctx);
        case "modules":
          return await this.renderModules(data, ctx);
        case "ping":
          return await this.renderPing(data, ctx);
        case "error":
          return await this.renderError(result, ctx);
        default:
          return await this.renderError(
            { message: `지원하지 않는 기능입니다: ${type}` },
            ctx
          );
      }
    } catch (error) {
      logger.error("SystemRenderer.render 오류:", error);
      return await this.renderError(
        { message: "렌더링 중 오류가 발생했습니다." },
        ctx
      );
    }
  }

  /**
   * 🏠 메인 메뉴 렌더링 (완전 강화!)
   */
  async renderMainMenu(data, ctx) {
    const {
      userName,
      activeModules = [],
      systemStats = {},
      moduleHealth = {}
    } = data;

    let text = `🏠 **메인 메뉴**\n${this.ui.separators.main}\n\n`;
    text += `안녕하세요, ${userName}님! 👋\n\n`;

    // 🆕 강화된 시스템 현황
    text += `📊 **시스템 현황**\n`;
    text += `${this.ui.separators.dot}⏱️ 가동시간: ${systemStats.uptime || "정보 없음"}\n`;
    text += `${this.ui.separators.dot}💾 메모리: ${systemStats.memoryUsage}MB (${systemStats.memoryPercent}%)\n`;
    text += `${this.ui.separators.dot}🖥️ CPU: ${systemStats.cpuUsage || 0}%\n`;
    text += `${this.ui.separators.dot}🏆 건강도: ${systemStats.healthScore || 0}점\n`;
    text += `${this.ui.separators.dot}☁️ 환경: ${systemStats.environment}\n\n`;

    // 🆕 모듈 건강도 요약
    if (moduleHealth.totalCount > 0) {
      const healthIcon = this.getHealthIcon(moduleHealth.overall);
      text += `📦 **모듈 상태** ${healthIcon} ${moduleHealth.overall}\n`;
      text += `${this.ui.separators.dot}정상: ${moduleHealth.healthyCount}개\n`;
      if (moduleHealth.warningCount > 0) {
        text += `${this.ui.separators.dot}⚠️ 주의: ${moduleHealth.warningCount}개\n`;
      }
      if (moduleHealth.criticalCount > 0) {
        text += `${this.ui.separators.dot}🚨 위험: ${moduleHealth.criticalCount}개\n`;
      }
      text += `\n`;
    }

    // 🎯 사용 가능한 기능들 (상태와 함께 표시)
    if (activeModules.length > 0) {
      text += `🎯 **사용 가능한 기능** (${activeModules.length}개)\n`;
      activeModules.forEach((module) => {
        const statusIcon = module.healthy
          ? "✅"
          : module.score >= 40
            ? "⚠️"
            : "🚨";
        text += `${statusIcon} ${module.emoji} ${module.name}`;
        if (module.score !== undefined) {
          text += ` (${module.score}점)`;
        }
        text += `\n`;
      });
      text += `\n`;
    }

    text += `원하는 기능을 선택해주세요! ✨`;

    // 🔗 동적 키보드 생성
    const buttons = this.buildMainMenuButtons(activeModules, systemStats);
    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📊 시스템 상태 렌더링 (완전 강화!)
   */
  async renderStatus(data, ctx) {
    const {
      system = {},
      memory = {},
      modules = [],
      _moduleHealth = {},
      _uptime,
      status,
      lastHealthCheck
    } = data;

    let text = `📊 **시스템 진단**\n${this.ui.separators.main}\n\n`;

    // 🏥 전체 건강도 표시
    const healthIcon = this.getHealthIcon(system.healthStatus || status);
    const healthScore = system.overallHealthScore || 0;
    text += `${healthIcon} **전체 상태**: ${this.getStatusText(system.healthStatus || status)} (${healthScore}점)\n\n`;

    // 🖥️ 하드웨어 정보
    text += `${this.ui.icons.system} **하드웨어 정보**\n`;
    text += `${this.ui.separators.dot}플랫폼: ${system.platform || "알 수 없음"}\n`;
    text += `${this.ui.separators.dot}CPU: ${system.cpuModel || "알 수 없음"} (${system.cpuCores || 0}코어)\n`;
    text += `${this.ui.separators.dot}CPU 사용률: ${system.cpuUsage || 0}%\n`;
    text += `${this.ui.separators.dot}Node.js: ${system.nodeVersion || "알 수 없음"}\n`;
    text += `${this.ui.separators.dot}아키텍처: ${system.arch || "알 수 없음"}\n\n`;

    // 💾 메모리 상세 정보
    text += `${this.ui.icons.memory} **메모리 상태**\n`;
    if (memory.process) {
      text += `${this.ui.separators.dot}프로세스: ${memory.process.heapUsed}MB / ${memory.process.heapTotal}MB\n`;
      text += `${this.ui.separators.dot}사용률: ${memory.process.percentage}%\n`;
    }
    if (memory.system) {
      text += `${this.ui.separators.dot}시스템: ${memory.system.used}GB / ${memory.system.total}GB\n`;
    }
    text += `\n`;

    // 🌐 환경 정보
    text += `🌍 **환경 정보**\n`;
    text += `${this.ui.separators.dot}환경: ${system.environment || "알 수 없음"}\n`;
    text += `${this.ui.separators.dot}클라우드: ${system.cloudProvider || "Local"}\n`;
    if (system.isDocker) {
      text += `${this.ui.separators.dot}🐳 Docker 환경\n`;
    }
    text += `${this.ui.separators.dot}네트워크: ${system.networkInterfaces || 0}개 인터페이스\n\n`;

    // 📦 모듈 상태 (StatusHelper 데이터 활용)
    if (modules.length > 0) {
      text += `${this.ui.icons.modules} **모듈 상태** (${modules.length}개)\n`;
      modules.forEach((module) => {
        const statusIcon = module.healthy ? "✅" : "⚠️";
        text += `${statusIcon} ${module.displayName}: ${module.status}`;
        if (module.score !== undefined) {
          text += ` (${module.score}점)`;
        }
        text += `\n`;
      });
      text += `\n`;
    }

    // 💡 추천사항
    if (system.recommendations && system.recommendations.length > 0) {
      text += `💡 **추천사항**\n`;
      system.recommendations.forEach((rec) => {
        text += `${this.ui.separators.dot}${rec}\n`;
      });
      text += `\n`;
    }

    if (lastHealthCheck) {
      text += `🔍 **마지막 체크**: ${TimeHelper.format(new Date(lastHealthCheck), "HH:mm")}\n\n`;
    }

    text += `시스템 진단이 완료되었습니다! 🎯`;

    const buttons = [
      [
        { text: "🔄 새로고침", callback_data: "system:status:" },
        { text: "🏥 건강도", callback_data: "system:health:" }
      ],
      [
        { text: "📱 모듈 관리", callback_data: "system:modules:" },
        { text: "🏓 응답속도", callback_data: "system:ping:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏥 시스템 건강도 렌더링 (새로 추가!)
   */
  async renderHealth(data, ctx) {
    const { overall, components, recommendations, analysis } = data;

    let text = `🏥 **시스템 건강도 진단**\n${this.ui.separators.main}\n\n`;

    // 전체 점수
    const scoreIcon = this.getScoreIcon(overall.score);
    text += `${scoreIcon} **종합 점수**: ${overall.score}/100점\n`;
    text += `📋 **상태**: ${this.getStatusText(overall.status)}\n\n`;

    // 구성요소별 건강도
    text += `📊 **구성요소별 진단**\n`;
    if (components.memory) {
      text += `💾 메모리: ${this.getScoreIcon(components.memory.score)} ${components.memory.score || 0}점\n`;
    }
    if (components.cpu) {
      text += `🖥️ CPU: ${this.getScoreIcon(components.cpu.score)} ${components.cpu.score || 0}점\n`;
    }
    if (components.modules) {
      text += `📦 모듈: ${StatusHelper.getStatusWithEmoji(components.modules)}\n`;
    }
    text += `\n`;

    // 강점과 우려사항
    if (analysis.strengths && analysis.strengths.length > 0) {
      text += `💪 **시스템 강점**\n`;
      analysis.strengths.forEach((strength) => {
        text += `${this.ui.separators.dot}${strength}\n`;
      });
      text += `\n`;
    }

    if (analysis.concerns && analysis.concerns.length > 0) {
      text += `⚠️ **개선 필요사항**\n`;
      analysis.concerns.forEach((concern) => {
        text += `${this.ui.separators.dot}${concern}\n`;
      });
      text += `\n`;
    }

    // 추천사항
    if (recommendations && recommendations.length > 0) {
      text += `💡 **권장사항**\n`;
      recommendations.forEach((rec) => {
        text += `${this.ui.separators.dot}${rec}\n`;
      });
      text += `\n`;
    }

    // 트렌드 정보
    if (analysis.trends) {
      text += `📈 **시스템 트렌드**\n`;
      text += `${this.ui.separators.dot}가동시간: ${analysis.trends.uptime}\n`;
      text += `${this.ui.separators.dot}시간당 요청: ${analysis.trends.callbackRate}회\n`;
      text += `${this.ui.separators.dot}활성 사용자: ${analysis.trends.activeUsers}명\n`;
    }

    const buttons = [
      [
        { text: "📊 시스템 상태", callback_data: "system:status:" },
        { text: "🔄 재진단", callback_data: "system:health:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ===== 🔧 헬퍼 메서드들 =====

  buildMainMenuButtons(activeModules, systemStats) {
    const buttons = [];

    // 모듈 버튼들 (2열씩, 상태 포함)
    for (let i = 0; i < activeModules.length; i += 2) {
      const row = [];

      const module1 = activeModules[i];
      row.push({
        text: `${module1.emoji} ${module1.name}`,
        callback_data: `${module1.key}:menu:`
      });

      if (i + 1 < activeModules.length) {
        const module2 = activeModules[i + 1];
        row.push({
          text: `${module2.emoji} ${module2.name}`,
          callback_data: `${module2.key}:menu:`
        });
      }

      buttons.push(row);
    }

    // 시스템 기능들 (건강도에 따라 동적)
    const healthScore = systemStats.healthScore || 0;
    const statusRow = [
      { text: "📊 시스템 상태", callback_data: "system:status:" }
    ];

    if (healthScore < 70) {
      statusRow.push({ text: "🏥 건강도", callback_data: "system:health:" });
    } else {
      statusRow.push({ text: "❓ 도움말", callback_data: "system:help:" });
    }

    buttons.push(statusRow);

    return buttons;
  }

  getHealthIcon(status) {
    const iconMap = {
      excellent: this.ui.icons.excellent,
      good: this.ui.icons.good,
      fair: this.ui.icons.fair,
      poor: this.ui.icons.poor,
      critical: this.ui.icons.critical,
      healthy: this.ui.icons.good,
      warning: this.ui.icons.poor,
      error: this.ui.icons.critical
    };
    return iconMap[status] || "❓";
  }

  getScoreIcon(score) {
    if (score >= 90) return "🏆";
    if (score >= 80) return "🌟";
    if (score >= 70) return "✅";
    if (score >= 50) return "⚠️";
    return "🚨";
  }

  getStatusText(status) {
    const statusMap = {
      excellent: "최고",
      good: "우수",
      fair: "양호",
      poor: "주의",
      critical: "위험",
      healthy: "정상",
      warning: "주의",
      error: "오류"
    };
    return statusMap[status] || "알 수 없음";
  }

  /**
   * ❓ 도움말 렌더링 (시스템 전체 가이드)
   */
  async renderHelp(data, ctx) {
    const { userName, commands = [], modules = [], version } = data;

    let text = `❓ **시스템 도움말**\n${this.ui.separators.main}\n\n`;
    text += `안녕하세요, ${userName}님!\n\n`;

    // 🤖 봇 정보
    if (version) {
      text += `🤖 **두목봇 v${version}**\n`;
      text += `통합 업무 관리 시스템\n\n`;
    }

    // 📚 전체 시스템 명령어
    if (commands.length > 0) {
      text += `**⌨️ 사용 가능한 명령어**\n`;
      commands.forEach((cmd) => {
        text += `${this.ui.separators.dot}${cmd.command} - ${cmd.description}\n`;
      });
      text += `\n`;
    }

    // 🎯 모든 모듈 가이드 (메타-헬프)
    if (modules.length > 0) {
      text += `**🎯 사용 가능한 모듈**\n`;
      modules.forEach((module) => {
        const statusIcon = module.initialized ? "✅" : "❌";
        text += `${statusIcon} ${module.emoji} **${module.displayName}**\n`;
        text += `   └ ${module.category || "misc"} 카테고리\n`;
      });
      text += `\n`;
    }

    text += `더 자세한 정보가 필요하시면 각 모듈의 도움말을 확인해주세요.\n`;
    text += `문제가 있으시면 **📊 시스템 상태**를 확인해보세요!`;

    const buttons = [
      [
        { text: "📊 시스템 상태", callback_data: "system:status:" },
        { text: "📱 모듈 관리", callback_data: "system:modules:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 📱 모듈 관리 렌더링 (새로 추가!)
   */
  async renderModules(data, ctx) {
    const modules = Array.isArray(data) ? data : data.modules || [];

    let text = `📱 **모듈 관리**\n${this.ui.separators.main}\n\n`;

    if (modules.length === 0) {
      text += `등록된 모듈이 없습니다.`;
    } else {
      text += `**등록된 모듈** (${modules.length}개)\n\n`;

      // 카테고리별 분류
      const categories = {};
      modules.forEach((module) => {
        const category = module.category || "misc";
        if (!categories[category]) categories[category] = [];
        categories[category].push(module);
      });

      Object.entries(categories).forEach(([category, categoryModules]) => {
        text += `**📂 ${this.getCategoryName(category)}**\n`;
        categoryModules.forEach((module) => {
          const statusIcon = module.initialized ? "✅" : "❌";
          const coreIcon = module.isCore ? "⭐" : "";
          text += `${statusIcon}${coreIcon} ${module.emoji} ${module.displayName}\n`;
          text += `   └ 액션: ${module.actionCount || 0}개 | 서비스: ${module.hasService ? "✅" : "❌"}\n`;
        });
        text += `\n`;
      });
    }

    const buttons = [
      [
        { text: "📊 시스템 상태", callback_data: "system:status:" },
        { text: "🔄 새로고침", callback_data: "system:modules:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * 🏓 핑 응답 렌더링 (새로 추가!)
   */
  async renderPing(data, ctx) {
    const { responseTime, status } = data;

    let text = `🏓 **응답속도 테스트**\n${this.ui.separators.main}\n\n`;
    text += `${status === "pong" ? "✅" : "❌"} **상태**: ${status}\n`;
    text += `⚡ **응답시간**: ${responseTime}ms\n\n`;

    const speedIcon =
      responseTime < 100 ? "🚀" : responseTime < 500 ? "⚡" : "🐌";
    const speedText =
      responseTime < 100 ? "매우 빠름" : responseTime < 500 ? "정상" : "느림";
    text += `${speedIcon} **성능**: ${speedText}`;

    const buttons = [
      [
        { text: "🔄 다시 테스트", callback_data: "system:ping:" },
        { text: "📊 시스템 상태", callback_data: "system:status:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  // ===== 🔧 헬퍼 메서드들 =====

  /**
   * 📂 카테고리 이름 변환
   */
  getCategoryName(category) {
    const categoryMap = {
      productivity: "생산성",
      work: "업무",
      entertainment: "엔터테인먼트",
      information: "정보",
      utility: "유틸리티",
      system: "시스템",
      misc: "기타"
    };
    return categoryMap[category] || category;
  }

  /**
   * ℹ️ 정보 렌더링 (기존 유지)
   */
  async renderAbout(data, ctx) {
    let text = `ℹ️ **두목봇 정보**\n${this.ui.separators.main}\n\n`;
    text += `**🤖 두목봇 v4.0.0**\n`;
    text += `통합 업무 관리 시스템\n\n`;
    text += `**🎯 주요 특징**\n`;
    text += `${this.ui.separators.dot}📝 할일 관리\n`;
    text += `${this.ui.separators.dot}⏰ 타이머 기능\n`;
    text += `${this.ui.separators.dot}🏢 근무시간 추적\n`;
    text += `${this.ui.separators.dot}🏖️ 휴가 관리\n`;
    text += `${this.ui.separators.dot}🌤️ 날씨 정보\n`;
    text += `${this.ui.separators.dot}🔮 운세\n`;
    text += `${this.ui.separators.dot}🔊 음성 변환\n\n`;
    text += `효율적인 업무 관리를 도와드립니다! 💪`;

    const buttons = [[{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }

  /**
   * ❌ 에러 렌더링 (표준 에러 처리)
   */
  async renderError(data, ctx) {
    const { message = "알 수 없는 오류가 발생했습니다." } = data;

    let text = `❌ **시스템 오류**\n${this.ui.separators.main}\n\n`;
    text += `${message}\n\n`;
    text += `잠시 후 다시 시도해주세요.\n`;
    text += `문제가 지속되면 **📊 시스템 상태**를 확인해보세요.`;

    const buttons = [
      [
        { text: "🔄 재시도", callback_data: "system:menu:" },
        { text: "📊 시스템 상태", callback_data: "system:status:" }
      ],
      [{ text: "🏠 메인 메뉴", callback_data: "system:menu:" }]
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);
    await this.sendSafeMessage(ctx, text, { reply_markup: keyboard });
  }
}

module.exports = SystemRenderer;
