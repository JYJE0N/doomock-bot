// src/renderers/SystemRenderer.js - 파서 규칙 통일 리팩토링 완성 버전

const BaseRenderer = require("./BaseRenderer");
const DoomockMessageGenerator = require("../utils/DoomockMessageGenerator");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏠 SystemRenderer - 시스템 관리 UI 렌더링 (파서 규칙 통일)
 *
 * 🎯 핵심 개선사항:
 * - BaseRenderer의 파서 규칙 완전 적용
 * - "system:action:params" 형태 표준화
 * - 메인 메뉴, 시스템 정보, 설정을 파서 규칙으로 단순화
 * - 모듈 상태 모니터링 및 관리 통합 처리
 * - 실시간 시스템 상태 업데이트 지원
 * - SoC 준수: UI 렌더링만 담당
 *
 * 🔧 비유: 스마트 시스템 관리 센터
 * - 주문을 받으면 (파서 규칙) 정확히 해석
 * - 복잡한 시스템 정보를 직관적으로 표시
 * - 실시간 모니터링과 시각적 피드백
 * - 모든 모듈의 상태와 설정 통합 관리
 *
 * 🏠 시스템 파서 규칙:
 * - system:menu → 메인 메뉴 (모든 모듈 접근점)
 * - system:status → 시스템 상태 모니터링
 * - system:info → 시스템 정보 및 통계
 * - system:settings → 시스템 설정
 * - system:help → 종합 도움말
 * - system:module:fortune → 특정 모듈로 이동
 */
class SystemRenderer extends BaseRenderer {
  constructor(bot, navigationHandler) {
    super(bot, navigationHandler);

    this.moduleName = "system";

    // 🏠 시스템 특화 설정
    this.config = {
      ...this.config,
      showSystemStats: true,
      enableModuleMonitoring: true,
      autoRefresh: false,
      maxModulesPerRow: 2,
      showPerformanceMetrics: true,
    };

    // 🎭 이모지 컬렉션 (시스템 특화)
    this.emojis = {
      // 메인 시스템
      system: "🏠",
      menu: "📋",
      bot: "🤖",

      // 상태 관련
      status: "📊",
      health: "🏥",
      info: "ℹ️",
      performance: "⚡",
      monitoring: "📈",

      // 모듈 관련
      modules: "📱",
      active: "✅",
      inactive: "❌",
      warning: "⚠️",
      loading: "⏳",

      // 설정 관련
      settings: "⚙️",
      config: "🔧",
      preferences: "🎛️",

      // 도움말 관련
      help: "❓",
      guide: "📖",
      tips: "💡",

      // 기술 정보
      database: "🗄️",
      server: "🖥️",
      network: "🌐",
      memory: "💾",
      cpu: "🔥",

      // 액션
      refresh: "🔄",
      restart: "♻️",
      update: "📥",
      backup: "💾",

      // 개발자
      developer: "👨‍💻",
      version: "📦",
      changelog: "📜",

      // 일반
      success: "✅",
      error: "❌",
      time: "⏰",
      rocket: "🚀",
    };

    // 📱 모듈 정보 (아이콘 매핑)
    this.moduleIcons = {
      fortune: "🔮",
      todo: "📋",
      timer: "🍅",
      leave: "🏖️",
      tts: "🔊",
      weather: "🌤️",
      worktime: "⏰",
      reminder: "🔔",
    };

    // 🎨 상태별 스타일
    this.statusStyles = {
      healthy: { emoji: "🟢", label: "정상", color: "green" },
      warning: { emoji: "🟡", label: "주의", color: "yellow" },
      error: { emoji: "🔴", label: "오류", color: "red" },
      unknown: { emoji: "⚫", label: "알수없음", color: "gray" },
    };

    logger.debug("🏠 SystemRenderer 초기화 완료");
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
        case "main_menu":
        case "menu":
          return await this.renderMainMenu(data, ctx);

        case "status":
          return await this.renderSystemStatus(data, ctx);

        case "info":
          return await this.renderSystemInfo(data, ctx);

        case "settings":
          return await this.renderSettings(data, ctx);

        case "help":
          return await this.renderHelp(data, ctx);

        case "about":
          return await this.renderAbout(data, ctx);

        case "module_status":
          return await this.renderModuleStatus(data, ctx);

        case "performance":
          return await this.renderPerformance(data, ctx);

        case "logs":
          return await this.renderLogs(data, ctx);

        case "maintenance":
          return await this.renderMaintenance(data, ctx);

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

  // ===== 🏠 메인 메뉴 렌더링 =====

  /**
   * 🏠 메인 메뉴 렌더링 (파서 규칙 적용)
   */
  async renderMainMenu(data, ctx) {
    this.debug("메인 메뉴 렌더링", {
      hasModules: !!data?.modules,
      userName: data?.userName,
      moduleCount: data?.modules?.length,
    });

    const { userName, modules, systemInfo, quickStats } = data;

    let text = `${this.emojis.system} **두목봇 메인 메뉴**\n\n`;

    // 환영 메시지 (두목봇 특색)
    const welcomeMessage = DoomockMessageGenerator.getContextualMessage(
      "welcome",
      userName
    );
    text += `💬 ${welcomeMessage}\n\n`;

    text += `${this.emojis.bot} **업무 효율성을 극대화하는 스마트 어시스턴트**\n\n`;

    // 시스템 간단 상태 (있으면 표시)
    if (systemInfo?.status) {
      const statusStyle =
        this.statusStyles[systemInfo.status] || this.statusStyles.unknown;
      text += `${statusStyle.emoji} **시스템 상태**: ${statusStyle.label}\n`;
    }

    // 빠른 통계 (있으면 표시)
    if (quickStats) {
      text += `${this.emojis.modules} **활성 모듈**: ${quickStats.activeModules}/${quickStats.totalModules}개\n`;

      if (quickStats.todayUsage) {
        text += `📊 **오늘 사용량**: ${quickStats.todayUsage}회\n`;
      }
    }

    text += `\n✨ **원하는 기능을 선택해주세요\\!**`;

    // 표준 키보드 생성 (파서 규칙 적용)
    const buttons = [];

    if (modules && modules.length > 0) {
      // 모듈들을 2열씩 배치
      const enabledModules = modules.filter((m) => m.enabled && m.showInMenu);

      for (
        let i = 0;
        i < enabledModules.length;
        i += this.config.maxModulesPerRow
      ) {
        const row = [];

        for (
          let j = 0;
          j < this.config.maxModulesPerRow && i + j < enabledModules.length;
          j++
        ) {
          const module = enabledModules[i + j];
          const icon = this.moduleIcons[module.key] || "📱";

          row.push({
            text: `${icon} ${module.displayName}`,
            action: "module",
            params: module.key,
          });
        }

        buttons.push(row);
      }
    }

    // 시스템 관리 메뉴
    buttons.push([
      { text: `${this.emojis.status} 시스템 상태`, action: "status" },
      { text: `${this.emojis.settings} 설정`, action: "settings" },
    ]);

    buttons.push([
      { text: `${this.emojis.help} 도움말`, action: "help" },
      { text: `${this.emojis.info} 정보`, action: "info" },
    ]);

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📊 시스템 상태 렌더링 =====

  /**
   * 📊 시스템 상태 모니터링 렌더링
   */
  async renderSystemStatus(data, ctx) {
    this.debug("시스템 상태 렌더링", {
      hasHealth: !!data?.health,
      hasPerformance: !!data?.performance,
      hasModules: !!data?.modules,
    });

    const { health, performance, modules, systemInfo } = data;

    let text = `${this.emojis.status} **시스템 상태 모니터링**\n\n`;

    // 전체 헬스 체크
    if (health) {
      const overallStatus =
        this.statusStyles[health.overall] || this.statusStyles.unknown;
      text += `${this.emojis.health} **전체 상태**: ${overallStatus.emoji} ${overallStatus.label}\n\n`;

      // 세부 상태
      text += `🔧 **세부 상태**\n`;
      text += `• ${this.emojis.database} 데이터베이스: ${this.getStatusEmoji(
        health.database
      )} ${health.database}\n`;
      text += `• ${this.emojis.network} 외부 API: ${this.getStatusEmoji(
        health.externalServices
      )} ${health.externalServices}\n`;
      text += `• ${this.emojis.memory} 메모리: ${this.getStatusEmoji(
        health.memory
      )} ${health.memory}\n\n`;
    }

    // 성능 지표
    if (performance) {
      text += `${this.emojis.performance} **성능 지표**\n`;
      text += `• ⚡ 평균 응답시간: ${performance.avgResponseTime || 0}ms\n`;
      text += `• 📊 오류율: ${performance.errorRate || 0}%\n`;
      text += `• 🔄 처리량: ${performance.throughput || 0}/분\n`;
      text += `• ${this.emojis.cpu} CPU: ${performance.cpuUsage || 0}%\n\n`;
    }

    // 시스템 정보
    if (systemInfo) {
      text += `${this.emojis.server} **시스템 정보**\n`;
      text += `• ⏱️ 가동시간: ${this.formatUptime(systemInfo.uptime)}\n`;
      text += `• ${this.emojis.memory} 메모리: ${this.formatMemoryUsage(
        systemInfo.memoryUsage
      )}\n`;

      if (systemInfo.activeUsers !== undefined) {
        text += `• 👥 활성 사용자: ${systemInfo.activeUsers}명\n`;
      }

      if (systemInfo.totalMessages !== undefined) {
        text += `• 💬 처리된 메시지: ${systemInfo.totalMessages.toLocaleString()}개\n`;
      }

      text += "\n";
    }

    // 모듈 상태
    if (modules && modules.length > 0) {
      text += `${this.emojis.modules} **모듈 상태** (${modules.length}개)\n`;

      modules.forEach((module) => {
        const icon = this.moduleIcons[module.key] || "📱";
        const statusEmoji = module.active
          ? this.emojis.active
          : this.emojis.inactive;
        text += `• ${icon} ${module.name}: ${statusEmoji}\n`;
      });
    }

    text += `\n${this.emojis.time} **업데이트**: ${TimeHelper.format(
      new Date(),
      "time"
    )}`;

    const buttons = [
      [
        { text: `${this.emojis.refresh} 새로고침`, action: "status" },
        { text: `${this.emojis.performance} 성능 상세`, action: "performance" },
      ],
      [
        { text: `${this.emojis.modules} 모듈 상태`, action: "module_status" },
        { text: `${this.emojis.info} 시스템 정보`, action: "info" },
      ],
      [
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
        this.createHomeButton(),
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
  async renderSystemInfo(data, ctx) {
    this.debug("시스템 정보 렌더링");

    const { systemInfo, modules, stats } = data;

    let text = `${this.emojis.info} **시스템 정보**\n\n`;

    text += `${this.emojis.bot} **두목봇 v4.0.0**\n`;
    text += `업무 효율성 극대화를 위한 스마트 어시스턴트\n\n`;

    // 기술 스택
    text += `${this.emojis.rocket} **기술 스택**\n`;
    text += `• Node.js + Telegraf 프레임워크\n`;
    text += `• MongoDB + Mongoose ODM\n`;
    text += `• Railway 클라우드 호스팅\n`;
    text += `• 모듈화 아키텍처 + 렌더러 패턴\n`;
    text += `• 파서 규칙 통일 시스템\n\n`;

    // 주요 기능
    text += `${this.emojis.modules} **주요 기능**\n`;
    if (modules) {
      modules
        .filter((m) => m.enabled)
        .forEach((module) => {
          const icon = this.moduleIcons[module.key] || "📱";
          text += `• ${icon} **${module.displayName}** - ${
            module.description || "기능 설명"
          }\n`;
        });
    }
    text += "\n";

    // 통계 정보
    if (stats) {
      text += `${this.emojis.monitoring} **사용 통계**\n`;
      text += `• 📊 총 사용량: ${(stats.totalUsage || 0).toLocaleString()}회\n`;
      text += `• 👥 등록 사용자: ${(
        stats.totalUsers || 0
      ).toLocaleString()}명\n`;
      text += `• 📱 인기 모듈: ${stats.popularModule || "정보없음"}\n`;
      text += `• ⏱️ 평균 사용시간: ${stats.avgSessionTime || "0"}분\n\n`;
    }

    // 시스템 상세
    if (systemInfo) {
      text += `${this.emojis.server} **시스템 상세**\n`;
      text += `• 🖥️ 플랫폼: ${systemInfo.platform || "Linux"}\n`;
      text += `• 📦 Node.js: ${systemInfo.nodeVersion || "v18+"}\n`;
      text += `• 🌐 환경: ${systemInfo.environment || "Production"}\n`;
      text += `• 📅 시작시간: ${this.formatStartTime(
        systemInfo.startTime
      )}\n\n`;
    }

    text += `${this.emojis.developer} **개발자**: 두목봇 팀\n`;
    text += `📅 **최종 업데이트**: ${TimeHelper.format(
      new Date(),
      "short"
    )}\n\n`;

    const infoMessage = DoomockMessageGenerator.generateMessage(
      "stats",
      "사용자"
    );
    text += `💬 ${infoMessage}`;

    const buttons = [
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.performance} 성능 정보`, action: "performance" },
      ],
      [
        { text: `${this.emojis.help} 도움말`, action: "help" },
        { text: `${this.emojis.changelog} 변경사항`, action: "about" },
      ],
      [
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== ⚙️ 설정 및 관리 렌더링 =====

  /**
   * ⚙️ 시스템 설정 렌더링
   */
  async renderSettings(data, ctx) {
    this.debug("시스템 설정 렌더링");

    const { settings, userName } = data;

    let text = `${this.emojis.settings} **시스템 설정 - ${userName}**\n\n`;

    if (settings) {
      text += `${this.emojis.config} **현재 설정**\n`;

      // 일반 설정
      text += `• 🌐 언어: ${settings.language || "한국어"}\n`;
      text += `• 🎨 테마: ${settings.theme || "기본"}\n`;
      text += `• 🔔 알림: ${settings.notifications ? "켜짐" : "꺼짐"}\n`;
      text += `• ⏰ 시간대: ${settings.timezone || "Asia/Seoul"}\n\n`;

      // 개인화 설정
      text += `${this.emojis.preferences} **개인화**\n`;
      text += `• 📋 기본 모듈: ${settings.defaultModule || "메인 메뉴"}\n`;
      text += `• 🎭 두목봇 멘트: ${
        settings.doomockMessages ? "켜짐" : "꺼짐"
      }\n`;
      text += `• 📊 통계 수집: ${settings.collectStats ? "허용" : "거부"}\n\n`;

      // 고급 설정
      text += `${this.emojis.config} **고급 설정**\n`;
      text += `• 🔄 자동 업데이트: ${settings.autoUpdate ? "켜짐" : "꺼짐"}\n`;
      text += `• 🐛 디버그 모드: ${settings.debugMode ? "켜짐" : "꺼짐"}\n`;
      text += `• 💾 데이터 백업: ${settings.autoBackup ? "자동" : "수동"}\n`;
    } else {
      text += `${this.emojis.warning} 설정 정보를 불러오는 중입니다\\.\n`;
      text += "잠시만 기다려주세요\\!";
    }

    const buttons = [
      [
        { text: "🌐 언어 설정", action: "setting", params: "language" },
        { text: "🎨 테마 설정", action: "setting", params: "theme" },
      ],
      [
        { text: "🔔 알림 설정", action: "setting", params: "notifications" },
        { text: "📋 기본 모듈", action: "setting", params: "default_module" },
      ],
      [
        { text: "🔄 기본값 복원", action: "setting", params: "reset" },
        { text: "💾 설정 백업", action: "setting", params: "backup" },
      ],
      [
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📱 모듈 관리 렌더링 =====

  /**
   * 📱 모듈 상태 상세 렌더링
   */
  async renderModuleStatus(data, ctx) {
    this.debug("모듈 상태 상세 렌더링");

    const { modules, summary } = data;

    let text = `${this.emojis.modules} **모듈 상태 관리**\n\n`;

    if (summary) {
      text += `📊 **요약**\n`;
      text += `• 전체 모듈: ${summary.total}개\n`;
      text += `• 활성 모듈: ${summary.active}개\n`;
      text += `• 비활성 모듈: ${summary.inactive}개\n`;
      text += `• 오류 모듈: ${summary.error || 0}개\n\n`;
    }

    if (modules && modules.length > 0) {
      text += `${this.emojis.config} **모듈 목록**\n`;

      modules.forEach((module) => {
        const icon = this.moduleIcons[module.key] || "📱";
        let statusEmoji = this.emojis.inactive;
        let statusText = "비활성";

        if (module.status === "active") {
          statusEmoji = this.emojis.active;
          statusText = "활성";
        } else if (module.status === "error") {
          statusEmoji = this.emojis.error;
          statusText = "오류";
        } else if (module.status === "loading") {
          statusEmoji = this.emojis.loading;
          statusText = "로딩중";
        }

        text += `• ${icon} **${module.displayName}**\n`;
        text += `  ${statusEmoji} 상태: ${statusText}\n`;

        if (module.lastActivity) {
          text += `  ⏰ 최근 활동: ${TimeHelper.format(
            new Date(module.lastActivity),
            "short"
          )}\n`;
        }

        if (module.usageCount !== undefined) {
          text += `  📊 사용횟수: ${module.usageCount}회\n`;
        }

        text += "\n";
      });
    } else {
      text += `${this.emojis.warning} 모듈 정보를 불러올 수 없습니다.\n`;
    }

    const buttons = [
      [
        { text: `${this.emojis.refresh} 새로고침`, action: "module_status" },
        {
          text: `${this.emojis.restart} 모듈 재시작`,
          action: "module_restart",
        },
      ],
      [
        { text: `${this.emojis.settings} 모듈 설정`, action: "module_config" },
        { text: `${this.emojis.logs} 모듈 로그`, action: "logs" },
      ],
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * ⚡ 성능 정보 상세 렌더링
   */
  async renderPerformance(data, ctx) {
    this.debug("성능 정보 렌더링");

    const { performance, trends, recommendations } = data;

    let text = `${this.emojis.performance} **시스템 성능 분석**\n\n`;

    if (performance) {
      // 핵심 성능 지표
      text += `🎯 **핵심 지표**\n`;
      text += `• ⚡ 평균 응답시간: ${performance.avgResponseTime || 0}ms\n`;
      text += `• 📊 처리량: ${performance.throughput || 0}개/분\n`;
      text += `• 🔄 성공률: ${performance.successRate || 0}%\n`;
      text += `• 📈 업타임: ${performance.uptime || "0%"}\n\n`;

      // 리소스 사용량
      text += `💾 **리소스 사용량**\n`;
      text += `• ${this.emojis.memory} 메모리: ${
        performance.memoryUsage || "0MB"
      }\n`;
      text += `• ${this.emojis.cpu} CPU: ${performance.cpuUsage || "0%"}\n`;
      text += `• ${this.emojis.database} DB 연결: ${
        performance.dbConnections || 0
      }개\n`;
      text += `• 🌐 네트워크: ${performance.networkLatency || "0ms"}\n\n`;
    }

    // 성능 트렌드 (있으면 표시)
    if (trends) {
      text += `📈 **성능 트렌드 (24시간)**\n`;
      text += `• 응답시간: ${trends.responseTime || "안정"}\n`;
      text += `• 메모리 사용: ${trends.memory || "안정"}\n`;
      text += `• 오류율: ${trends.errorRate || "안정"}\n\n`;
    }

    // 권장사항 (있으면 표시)
    if (recommendations && recommendations.length > 0) {
      text += `💡 **최적화 권장사항**\n`;
      recommendations.forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
      text += "\n";
    }

    text += `${this.emojis.time} **측정시간**: ${TimeHelper.format(
      new Date(),
      "time"
    )}`;

    const buttons = [
      [
        { text: `${this.emojis.refresh} 새로고침`, action: "performance" },
        {
          text: `${this.emojis.monitoring} 실시간 모니터링`,
          action: "monitoring",
        },
      ],
      [
        { text: "📊 상세 통계", action: "performance_detail" },
        { text: "🔧 최적화 도구", action: "optimization" },
      ],
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📋 도움말 및 지원 =====

  /**
   * ❓ 종합 도움말 렌더링
   */
  async renderHelp(data, ctx) {
    this.debug("종합 도움말 렌더링");

    const { modules, quickStart, faq } = data;

    let text = `${this.emojis.help} **두목봇 종합 도움말**\n\n`;

    text += `${this.emojis.bot} **안녕하세요! 두목봇입니다.**\n`;
    text += `업무 효율성을 극대화하는 스마트 어시스턴트로서 다양한 기능을 제공합니다.\n\n`;

    // 빠른 시작 가이드
    if (quickStart) {
      text += `${this.emojis.rocket} **빠른 시작 가이드**\n`;
      quickStart.forEach((step, index) => {
        text += `${index + 1}. ${step}\n`;
      });
      text += "\n";
    } else {
      text += `${this.emojis.rocket} **빠른 시작 가이드**\n`;
      text += `1. 메인 메뉴에서 원하는 모듈 선택\n`;
      text += `2. 버튼을 클릭하여 기능 사용\n`;
      text += `3. 필요시 텍스트 입력으로 상세 정보 제공\n`;
      text += `4. /cancel로 언제든 작업 취소 가능\n\n`;
    }

    // 주요 기능 소개
    text += `${this.emojis.modules} **주요 기능**\n`;
    if (modules && modules.length > 0) {
      modules.forEach((module) => {
        const icon = this.moduleIcons[module.key] || "📱";
        text += `• ${icon} **${module.displayName}**: ${
          module.description || "업무 도구"
        }\n`;
      });
    } else {
      text += `• 🔮 **타로 카드**: 일일 운세와 조언\n`;
      text += `• 📋 **할일 관리**: 업무 체크리스트\n`;
      text += `• 🍅 **뽀모도로**: 집중력 향상 타이머\n`;
      text += `• 🏖️ **연차 관리**: 휴가 계획 및 관리\n`;
      text += `• 🔊 **음성 변환**: 텍스트를 음성으로 변환\n`;
    }
    text += "\n";

    // 자주 묻는 질문
    if (faq && faq.length > 0) {
      text += `${this.emojis.tips} **자주 묻는 질문**\n`;
      faq.forEach((item, index) => {
        text += `**Q${index + 1}**: ${item.question}\n`;
        text += `**A**: ${item.answer}\n\n`;
      });
    } else {
      text += `${this.emojis.tips} **유용한 팁**\n`;
      text += `• 명령어 /start로 언제든 메인 메뉴 이동\n`;
      text += `• 버튼이 응답하지 않으면 /cancel 후 재시도\n`;
      text += `• 설정에서 개인화 옵션 조정 가능\n`;
      text += `• 문제 발생시 시스템 상태를 먼저 확인\n\n`;
    }

    text += `❤️ **더 궁금한 것이 있으시면 언제든 문의해주세요!**`;

    const buttons = [
      [
        { text: `${this.emojis.guide} 사용 가이드`, action: "guide" },
        { text: `${this.emojis.tips} 팁 & 트릭`, action: "tips" },
      ],
      [
        { text: "🔧 문제 해결", action: "troubleshoot" },
        { text: "📞 고객 지원", action: "support" },
      ],
      [
        { text: `${this.emojis.info} 시스템 정보`, action: "info" },
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🏢 About 화면 렌더링
   */
  async renderAbout(data, ctx) {
    this.debug("About 화면 렌더링");

    let text = `${this.emojis.bot} **두목봇 소개**\n\n`;

    text += `🎯 **미션**\n`;
    text += `직장인들의 업무 효율성을 극대화하여 더 나은 워라밸을 제공합니다.\n\n`;

    text += `💡 **핵심 가치**\n`;
    text += `• **단순함** - 복잡한 기능을 간단하게\n`;
    text += `• **효율성** - 시간 절약이 최우선\n`;
    text += `• **신뢰성** - 언제나 안정적인 서비스\n`;
    text += `• **개인화** - 각자의 업무 스타일에 맞춤\n\n`;

    text += `${this.emojis.rocket} **로드맵**\n`;
    text += `• AI 어시스턴트 통합\n`;
    text += `• 팀 협업 기능 강화\n`;
    text += `• 모바일 앱 출시\n`;
    text += `• 기업용 솔루션 확장\n`;
    text += `• 다국어 지원\n\n`;

    text += `${this.emojis.version} **현재 버전**: v4.0.0\n`;
    text += `📅 **출시일**: ${TimeHelper.format(
      new Date("2024-01-01"),
      "short"
    )}\n`;
    text += `👨‍💻 **개발팀**: 두목봇 개발팀\n\n`;

    const aboutMessage = DoomockMessageGenerator.generateMessage(
      "about",
      "사용자"
    );
    text += `💬 ${aboutMessage}`;

    const buttons = [
      [
        { text: `${this.emojis.changelog} 변경사항`, action: "changelog" },
        { text: `${this.emojis.developer} 개발팀`, action: "team" },
      ],
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.help} 도움말`, action: "help" },
      ],
      [
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
        this.createHomeButton(),
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 📋 로그 및 유지보수 =====

  /**
   * 📋 시스템 로그 렌더링
   */
  async renderLogs(data, ctx) {
    this.debug("시스템 로그 렌더링");

    const { logs, summary, filters } = data;

    let text = `📋 **시스템 로그**\n\n`;

    if (summary) {
      text += `📊 **로그 요약** (최근 24시간)\n`;
      text += `• 전체 로그: ${summary.total || 0}개\n`;
      text += `• 정보: ${summary.info || 0}개\n`;
      text += `• 경고: ${summary.warning || 0}개\n`;
      text += `• 오류: ${summary.error || 0}개\n\n`;
    }

    if (logs && logs.length > 0) {
      text += `📜 **최근 로그** (최대 10개)\n`;

      logs.slice(0, 10).forEach((log, index) => {
        const timeStr = TimeHelper.format(new Date(log.timestamp), "time");
        let levelEmoji = "ℹ️";

        if (log.level === "error") levelEmoji = "❌";
        else if (log.level === "warning") levelEmoji = "⚠️";
        else if (log.level === "success") levelEmoji = "✅";

        text += `${levelEmoji} \`${timeStr}\` ${log.message}\n`;

        if (log.module) {
          text += `   📱 모듈: ${log.module}\n`;
        }
      });
    } else {
      text += `${this.emojis.warning} 표시할 로그가 없습니다.\n`;
    }

    text += `\n${this.emojis.time} **업데이트**: ${TimeHelper.format(
      new Date(),
      "time"
    )}`;

    const buttons = [
      [
        { text: `${this.emojis.refresh} 새로고침`, action: "logs" },
        { text: "🔍 로그 검색", action: "log_search" },
      ],
      [
        { text: "❌ 오류만", action: "logs", params: "error" },
        { text: "⚠️ 경고만", action: "logs", params: "warning" },
      ],
      [
        { text: "📥 로그 다운로드", action: "log_download" },
        { text: "🗑️ 로그 정리", action: "log_cleanup" },
      ],
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * 🔧 유지보수 및 관리 렌더링
   */
  async renderMaintenance(data, ctx) {
    this.debug("유지보수 화면 렌더링");

    const { maintenance, scheduled, backups } = data;

    let text = `🔧 **시스템 유지보수**\n\n`;

    // 현재 유지보수 상태
    if (maintenance) {
      text += `${this.emojis.config} **현재 상태**\n`;
      text += `• 시스템 상태: ${maintenance.systemStatus || "정상"}\n`;
      text += `• 마지막 점검: ${this.formatLastCheck(maintenance.lastCheck)}\n`;
      text += `• 다음 점검: ${this.formatNextCheck(maintenance.nextCheck)}\n\n`;
    }

    // 예정된 유지보수
    if (scheduled && scheduled.length > 0) {
      text += `📅 **예정된 유지보수**\n`;
      scheduled.forEach((item, index) => {
        const date = TimeHelper.format(new Date(item.date), "short");
        text += `${index + 1}. ${item.type} - ${date}\n`;
        if (item.description) {
          text += `   ${item.description}\n`;
        }
      });
      text += "\n";
    }

    // 백업 상태
    if (backups) {
      text += `💾 **백업 상태**\n`;
      text += `• 마지막 백업: ${this.formatLastBackup(backups.lastBackup)}\n`;
      text += `• 백업 크기: ${backups.size || "알수없음"}\n`;
      text += `• 자동 백업: ${backups.autoBackup ? "활성" : "비활성"}\n\n`;
    }

    text += `⚠️ **주의**: 유지보수 작업은 시스템 성능에 영향을 줄 수 있습니다.`;

    const buttons = [
      [
        { text: `${this.emojis.refresh} 상태 새로고침`, action: "maintenance" },
        { text: "🔧 점검 실행", action: "run_check" },
      ],
      [
        { text: `${this.emojis.backup} 백업 생성`, action: "create_backup" },
        { text: "📋 백업 목록", action: "backup_list" },
      ],
      [
        { text: "📅 점검 일정", action: "schedule_maintenance" },
        { text: "⚙️ 설정 관리", action: "maintenance_settings" },
      ],
      [
        { text: `${this.emojis.status} 시스템 상태`, action: "status" },
        { text: `${this.emojis.system} 메인 메뉴`, action: "menu" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 상태 이모지 반환
   */
  getStatusEmoji(status) {
    const statusMap = {
      healthy: "🟢",
      warning: "🟡",
      error: "🔴",
      unknown: "⚫",
      active: "✅",
      inactive: "❌",
      loading: "⏳",
    };

    if (typeof status === "string") {
      return statusMap[status.toLowerCase()] || "⚫";
    }

    return "⚫";
  }

  /**
   * 업타임 포맷팅
   */
  formatUptime(uptime) {
    if (!uptime) return "알수없음";

    if (typeof uptime === "object" && uptime.formatted) {
      return uptime.formatted;
    }

    if (typeof uptime === "number") {
      const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
      const hours = Math.floor(
        (uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
      );
      const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));

      return `${days}일 ${hours}시간 ${minutes}분`;
    }

    return String(uptime);
  }

  /**
   * 메모리 사용량 포맷팅
   */
  formatMemoryUsage(memory) {
    if (!memory) return "알수없음";

    if (typeof memory === "object") {
      return `${memory.heap || 0}MB / ${memory.total || 0}MB (${
        memory.percentage || 0
      }%)`;
    }

    return String(memory);
  }

  /**
   * 시작 시간 포맷팅
   */
  formatStartTime(startTime) {
    if (!startTime) return "알수없음";

    try {
      return TimeHelper.format(new Date(startTime), "full");
    } catch (error) {
      return String(startTime);
    }
  }

  /**
   * 마지막 점검 시간 포맷팅
   */
  formatLastCheck(lastCheck) {
    if (!lastCheck) return "없음";

    try {
      return TimeHelper.format(new Date(lastCheck), "short");
    } catch (error) {
      return "알수없음";
    }
  }

  /**
   * 다음 점검 시간 포맷팅
   */
  formatNextCheck(nextCheck) {
    if (!nextCheck) return "미정";

    try {
      return TimeHelper.format(new Date(nextCheck), "short");
    } catch (error) {
      return "알수없음";
    }
  }

  /**
   * 마지막 백업 시간 포맷팅
   */
  formatLastBackup(lastBackup) {
    if (!lastBackup) return "없음";

    try {
      return TimeHelper.format(new Date(lastBackup), "short");
    } catch (error) {
      return "알수없음";
    }
  }

  /**
   * 홈 버튼 생성 헬퍼
   */
  createHomeButton() {
    return { text: "🏠 홈", action: "menu" };
  }

  /**
   * 에러 렌더링
   */
  async renderError(message, ctx) {
    const userName = getUserName(ctx.callbackQuery?.from || ctx.from);

    let text = `❌ **시스템 오류**\n\n`;
    text += `${message}\n\n`;

    const errorMessage = DoomockMessageGenerator.getContextualMessage(
      "systemError",
      userName
    );
    text += `💬 ${errorMessage}`;

    const buttons = [
      [
        { text: "🔄 다시 시도", action: "menu" },
        { text: `${this.emojis.help} 도움말`, action: "help" },
      ],
    ];

    const keyboard = this.createInlineKeyboard(buttons, this.moduleName);

    await this.sendSafeMessage(ctx, text, {
      reply_markup: keyboard,
    });
  }
}

module.exports = SystemRenderer;
