// ========================================
// 🎹 NavigationHandler.js v3.0.2 - 개선된 버전
// ========================================
// 개선사항:
// 1. 중복 handleCallback 통합
// 2. 동적 메뉴 생성
// 3. 실제 시스템 상태 표시
// 4. 모듈 기반 동적 UI
// ========================================

const { Markup } = require("telegraf");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");
const { formatMemoryUsage, formatUptime } = require("../utils/SystemHelper");

/**
 * 🎹 NavigationHandler v3.0.2 - 중앙 네비게이션 및 UI 렌더링
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.initialized = false;

    // 🎨 중앙 집중식 UI 테마
    this.uiThemes = {
      main: {
        title: "🤖 **두목봇 v3.0.2**",
        subtitle: "버튼을 눌러 원하는 기능을 선택하세요!",
        colors: ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"],
        animations: {
          loading: ["⏳", "⌛", "⏳", "⌛"],
          success: ["✨", "🎉", "✅", "🎊"],
          error: ["❌", "🚨", "⚠️", "❗"],
        },
      },
      module: {
        titlePrefix: "📱",
        backButton: "🔙 메뉴",
        cancelButton: "❌ 취소",
        refreshButton: "🔄 새로고침",
      },
      system: {
        help: { icon: "❓", title: "도움말" },
        status: { icon: "📊", title: "시스템 상태" },
        about: { icon: "ℹ️", title: "정보" },
        settings: { icon: "⚙️", title: "설정" },
      },
    };

    // 📊 네비게이션 통계
    this.stats = {
      totalNavigation: 0,
      menuViews: 0,
      moduleAccess: new Map(),
      lastActivity: null,
      startTime: Date.now(),
    };

    // 🔧 설정
    this.config = {
      menuColumns: 2, // 메뉴 버튼 열 수
      maxButtonsPerRow: 3,
      autoRefreshInterval: 30000, // 30초
      showDevMenu: process.env.NODE_ENV === "development",
    };

    // Logger 참조
    this.messageSystem = logger.messageSystem || console;
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot, moduleManager) {
    try {
      this.bot = bot;
      this.moduleManager = moduleManager;

      // 🌈 초기화 환영 메시지
      console.log(
        this.messageSystem.rainbow("🎹 ═══ NavigationHandler v3.0.2 초기화 ═══")
      );
      console.log(
        this.messageSystem.gradient(
          "🎨 개선된 UI 시스템 로딩...",
          "cyan",
          "magenta"
        )
      );

      this.initialized = true;

      logger.celebration("NavigationHandler 초기화 완료!");
    } catch (error) {
      logger.error("NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 통합된 콜백 처리 (개선된 버전)
   */
  async handleCallback(ctx, options = {}) {
    try {
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      // 콜백 데이터 파싱: "module:command:param1:param2"
      const [module, command, ...params] = data.split(":");
      const userName = getUserName(callbackQuery);

      // 🌈 알록달록 로그
      console.log(
        this.messageSystem.rainbow(
          `🎯 네비게이션: ${module}${command ? ":" + command : ""}`
        )
      );
      console.log(
        this.messageSystem.gradient(`👤 사용자: ${userName}`, "blue", "purple")
      );

      // 📊 통계 업데이트
      this.stats.totalNavigation++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 시스템 모듈 처리
      if (module === "system" || module === "main" || module === "menu") {
        return await this.handleSystemNavigation(
          ctx,
          command || "menu",
          params
        );
      }

      // 일반 모듈 처리
      this.updateModuleStats(module);

      if (this.moduleManager) {
        // 모듈에 전달할 subAction 구성
        const subAction = command
          ? `${command}${params.length > 0 ? ":" + params.join(":") : ""}`
          : "menu";

        const result = await this.moduleManager.handleCallback(
          this.bot,
          callbackQuery,
          module,
          subAction,
          this.moduleManager
        );

        if (result) {
          return await this.renderModuleResult(ctx, result);
        }
      } else {
        await this.showNavigationError(ctx, "모듈 매니저를 찾을 수 없습니다");
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error.message);
    }
  }

  /**
   * 🎯 시스템 네비게이션 처리
   */
  async handleSystemNavigation(ctx, command, params) {
    switch (command) {
      case "main":
      case "menu":
        this.stats.menuViews++;
        return await this.showMainMenu(ctx);

      case "help":
        return await this.showHelp(ctx);

      case "about":
        return await this.showAbout(ctx);

      case "status":
        return await this.showSystemStatus(ctx);

      case "refresh":
        return await this.handleRefresh(ctx, params);

      case "back":
        return await this.handleBackNavigation(ctx, params);

      default:
        return await this.showMainMenu(ctx);
    }
  }

  /**
   * 🏠 동적 메인 메뉴 표시 (개선된 버전)
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx.callbackQuery || ctx);
      const currentTime = TimeHelper.getTime();

      // 시간대별 인사말
      const greeting = this.getTimeBasedGreeting(currentTime);

      // 🌈 메뉴 텍스트 (MarkdownV2)
      const menuText = `
${this.uiThemes.main.title}

${greeting} ${this.escapeMarkdown(userName)}님\\! 👋

${this.uiThemes.main.subtitle}

⏰ 현재 시간: ${this.escapeMarkdown(currentTime)}
`.trim();

      // 🎹 동적 키보드 생성
      const keyboard = await this.buildDynamicMainMenu();

      // 메시지 수정 또는 전송
      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(menuText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }

      // 통계 업데이트
      logger.navigation("system", "main_menu", getUserId(ctx));
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await this.showNavigationError(ctx, "메뉴를 불러올 수 없습니다");
    }
  }

  /**
   * 🎹 동적 메인 메뉴 키보드 생성
   */
  async buildDynamicMainMenu() {
    const keyboard = { inline_keyboard: [] };

    // 활성화된 모듈 가져오기
    const enabledModules = getEnabledModules();

    // 메인 메뉴에 표시할 모듈 필터링 및 정렬
    const menuModules = enabledModules
      .filter((m) => m.showInMainMenu !== false)
      .sort((a, b) => (a.menuOrder || 999) - (b.menuOrder || 999));

    // 모듈 버튼 생성
    const moduleButtons = menuModules.map((module) => ({
      text: `${module.config?.icon || "📱"} ${module.name}`,
      callback_data: `${module.key}:menu`,
    }));

    // 버튼들을 설정된 열 수로 배치
    for (let i = 0; i < moduleButtons.length; i += this.config.menuColumns) {
      keyboard.inline_keyboard.push(
        moduleButtons.slice(i, i + this.config.menuColumns)
      );
    }

    // 시스템 버튼 추가
    const systemButtons = [];

    // 상태 버튼
    systemButtons.push({
      text: `${this.uiThemes.system.status.icon} ${this.uiThemes.system.status.title}`,
      callback_data: "system:status",
    });

    // 도움말 버튼
    systemButtons.push({
      text: `${this.uiThemes.system.help.icon} ${this.uiThemes.system.help.title}`,
      callback_data: "system:help",
    });

    keyboard.inline_keyboard.push(systemButtons);

    // 개발자 메뉴 (개발 환경에서만)
    if (this.config.showDevMenu) {
      keyboard.inline_keyboard.push([
        { text: "🔧 개발자 도구", callback_data: "system:dev" },
      ]);
    }

    // 정보 버튼
    keyboard.inline_keyboard.push([
      {
        text: `${this.uiThemes.system.about.icon} ${this.uiThemes.system.about.title}`,
        callback_data: "system:about",
      },
    ]);

    return keyboard;
  }

  /**
   * 📊 동적 시스템 상태 표시 (개선된 버전)
   */
  async showSystemStatus(ctx) {
    try {
      // 실제 시스템 데이터 수집
      const systemData = await this.collectSystemData();

      const statusText = `
📊 **시스템 상태**

🤖 **봇 정보**
• 버전: v3\\.0\\.2
• 업타임: ${this.escapeMarkdown(systemData.uptime)}
• 메모리: ${this.escapeMarkdown(systemData.memory)}

🗄️ **데이터베이스**
• 상태: ${systemData.database.status}
• 연결: ${systemData.database.connections}개
• 응답시간: ${systemData.database.latency}ms

📦 **모듈 상태**
• 활성화: ${systemData.modules.active}개
• 전체: ${systemData.modules.total}개
• 건강도: ${systemData.modules.health}%

📈 **통계**
• 총 요청: ${this.stats.totalNavigation}회
• 메뉴 조회: ${this.stats.menuViews}회
• 활성 사용자: ${systemData.activeUsers}명

🌤️ **외부 API**
${systemData.apis.map((api) => `• ${api.name}: ${api.status}`).join("\\n")}

⏰ **마지막 업데이트:** ${this.escapeMarkdown(TimeHelper.getTime())}
`.trim();

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📊 상세 통계", callback_data: "system:stats:detail" },
          ],
          [
            { text: "🏥 헬스체크", callback_data: "system:health" },
            { text: "📝 로그 보기", callback_data: "system:logs" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:main" }],
        ],
      };

      await ctx.editMessageText(statusText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("시스템 상태 표시 실패:", error);
      await this.showNavigationError(ctx, "상태 정보를 불러올 수 없습니다");
    }
  }

  /**
   * 📊 시스템 데이터 수집
   */
  async collectSystemData() {
    const data = {
      uptime: formatUptime(Date.now() - this.stats.startTime),
      memory: formatMemoryUsage(),
      database: {
        status: "✅ 정상",
        connections: 5,
        latency: 12,
      },
      modules: {
        active: 0,
        total: 0,
        health: 100,
      },
      activeUsers: 0,
      apis: [],
    };

    // ModuleManager에서 모듈 정보 수집
    if (this.moduleManager) {
      const moduleStatus = await this.moduleManager.getAllModuleStatus();
      data.modules.active = moduleStatus.active;
      data.modules.total = moduleStatus.total;
      data.modules.health = moduleStatus.healthPercentage;
    }

    // DatabaseManager에서 DB 정보 수집
    if (this.moduleManager?.dbManager) {
      const dbStatus = await this.moduleManager.dbManager.getStatus();
      data.database = {
        status: dbStatus.isConnected ? "✅ 정상" : "❌ 오류",
        connections: dbStatus.activeConnections || 0,
        latency: dbStatus.latency || 0,
      };
    }

    // 외부 API 상태 확인
    const apis = [
      { name: "날씨 API", key: "weather" },
      { name: "TTS API", key: "tts" },
    ];

    for (const api of apis) {
      const service = this.moduleManager?.getService(api.key);
      if (service && service.checkHealth) {
        const health = await service.checkHealth();
        data.apis.push({
          name: api.name,
          status: health ? "✅ 정상" : "⚠️ 점검중",
        });
      }
    }

    // 활성 사용자 수 계산
    data.activeUsers = this.stats.moduleAccess.size;

    return data;
  }

  /**
   * 🎯 모듈 결과 렌더링 (핵심 메서드)
   */
  async renderModuleResult(ctx, result) {
    if (!result) return;

    const { type, data, message, module } = result;

    try {
      switch (type) {
        case "menu":
          await this.renderModuleMenu(ctx, module, data);
          break;

        case "list":
          await this.renderModuleList(ctx, module, data);
          break;

        case "input":
          await this.renderInputPrompt(ctx, module, message);
          break;

        case "error":
          await this.renderError(ctx, module, message);
          break;

        case "success":
          await this.renderSuccess(ctx, module, message, data);
          break;

        case "status":
          await this.renderStatus(ctx, module, data);
          break;

        case "help":
          await this.renderHelp(ctx, module, data);
          break;

        case "loading":
          await this.renderLoading(ctx, module, message);
          break;

        default:
          logger.warn(`알 수 없는 결과 타입: ${type}`);
          await this.renderError(ctx, module, "알 수 없는 응답 타입입니다");
      }
    } catch (error) {
      logger.error("모듈 결과 처리 오류:", error);
      await this.showNavigationError(ctx, error.message);
    }
  }

  /**
   * 🎯 모듈 메뉴 렌더링
   */
  async renderModuleMenu(ctx, moduleName, data) {
    const moduleConfig = this.getModuleConfig(moduleName);
    const { stats, user, config } = data;

    // 메뉴 텍스트 생성
    let menuText = `${moduleConfig.icon} **${this.escapeMarkdown(
      moduleConfig.name
    )}**\\n\\n`;

    // 사용자 정보 추가
    if (user) {
      menuText += `👤 ${this.escapeMarkdown(user.name)}님\\n\\n`;
    }

    // 통계 정보 추가
    if (stats) {
      menuText += `📊 **현재 상태**\\n`;
      Object.entries(stats).forEach(([key, value]) => {
        const label = this.formatStatKey(key);
        const formattedValue = this.formatStatValue(key, value);
        menuText += `• ${label}: ${this.escapeMarkdown(formattedValue)}\\n`;
      });
      menuText += `\\n`;
    }

    // 설명 추가
    if (moduleConfig.description) {
      menuText += `_${this.escapeMarkdown(moduleConfig.description)}_\\n\\n`;
    }

    menuText += `원하는 기능을 선택하세요\\.`;

    // 키보드 생성
    const keyboard = this.buildModuleKeyboard(moduleName, data);

    // 메시지 수정
    await ctx.editMessageText(menuText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 🎯 모듈별 키보드 생성 (동적)
   */
  buildModuleKeyboard(moduleName, data) {
    const keyboard = { inline_keyboard: [] };
    const moduleConfig = this.getModuleConfig(moduleName);

    // 모듈별 커스텀 액션
    if (moduleConfig.actions) {
      const actionRows = [];
      const actions = Object.entries(moduleConfig.actions);

      for (let i = 0; i < actions.length; i += 2) {
        const row = [];

        for (let j = i; j < Math.min(i + 2, actions.length); j++) {
          const [key, action] = actions[j];

          // 조건부 표시 확인
          if (action.condition && !action.condition(data)) {
            continue;
          }

          row.push({
            text: `${action.icon} ${action.label}`,
            callback_data: `${moduleName}:${key}`,
          });
        }

        if (row.length > 0) {
          actionRows.push(row);
        }
      }

      keyboard.inline_keyboard.push(...actionRows);
    }

    // 기본 액션들 (모든 모듈 공통)
    const defaultActions = [];

    if (moduleConfig.hasHelp !== false) {
      defaultActions.push({
        text: "❓ 도움말",
        callback_data: `${moduleName}:help`,
      });
    }

    if (moduleConfig.hasSettings !== false) {
      defaultActions.push({
        text: "⚙️ 설정",
        callback_data: `${moduleName}:settings`,
      });
    }

    if (defaultActions.length > 0) {
      keyboard.inline_keyboard.push(defaultActions);
    }

    // 메인 메뉴로 돌아가기
    keyboard.inline_keyboard.push([
      { text: "🔙 메인 메뉴", callback_data: "system:main" },
    ]);

    return keyboard;
  }

  /**
   * 🎯 모듈 설정 가져오기 (확장된 버전)
   */
  getModuleConfig(moduleName) {
    // 기본 설정
    const defaultConfig = {
      name: moduleName,
      icon: "📱",
      description: null,
      hasHelp: true,
      hasSettings: true,
      actions: {},
    };

    // 모듈별 설정
    const configs = {
      todo: {
        name: "할일 관리",
        icon: "📝",
        description: "할일을 추가하고 관리하세요",
        actions: {
          list: { icon: "📋", label: "목록 보기" },
          add: { icon: "➕", label: "할일 추가" },
          search: { icon: "🔍", label: "검색" },
          stats: { icon: "📊", label: "통계" },
        },
      },
      timer: {
        name: "타이머",
        icon: "⏱️",
        description: "포모도로 타이머로 집중력을 높이세요",
        actions: {
          start: {
            icon: "▶️",
            label: "시작",
            condition: (data) => !data.status?.isRunning,
          },
          pause: {
            icon: "⏸️",
            label: "일시정지",
            condition: (data) => data.status?.isRunning,
          },
          stop: { icon: "⏹️", label: "정지" },
          status: { icon: "📊", label: "상태" },
        },
      },
      worktime: {
        name: "근무시간",
        icon: "🏢",
        description: "출퇴근 시간을 기록하고 관리하세요",
        actions: {
          checkin: {
            icon: "🏃",
            label: "출근",
            condition: (data) => !data.status?.checkedIn,
          },
          checkout: {
            icon: "🏁",
            label: "퇴근",
            condition: (data) => data.status?.checkedIn,
          },
          today: { icon: "📅", label: "오늘" },
          week: { icon: "📊", label: "주간" },
          month: { icon: "📈", label: "월간" },
        },
      },
      leave: {
        name: "휴가 관리",
        icon: "🏖️",
        description: "휴가를 신청하고 관리하세요",
        actions: {
          request: { icon: "📝", label: "휴가 신청" },
          list: { icon: "📋", label: "신청 내역" },
          balance: { icon: "💰", label: "잔여 휴가" },
          calendar: { icon: "📅", label: "휴가 캘린더" },
        },
      },
      reminder: {
        name: "리마인더",
        icon: "🔔",
        description: "중요한 일정을 잊지 마세요",
        actions: {
          list: { icon: "📋", label: "리마인더 목록" },
          add: { icon: "➕", label: "새 리마인더" },
          today: { icon: "📅", label: "오늘 알림" },
          upcoming: { icon: "📆", label: "예정된 알림" },
        },
      },
      fortune: {
        name: "운세",
        icon: "🔮",
        description: "오늘의 운세를 확인하세요",
        actions: {
          today: { icon: "🎯", label: "오늘의 운세" },
          love: { icon: "💕", label: "애정운" },
          money: { icon: "💰", label: "금전운" },
          work: { icon: "💼", label: "직장운" },
        },
        hasSettings: false,
      },
      weather: {
        name: "날씨",
        icon: "☀️",
        description: "현재 날씨와 예보를 확인하세요",
        actions: {
          current: { icon: "🌤️", label: "현재 날씨" },
          today: { icon: "📅", label: "오늘 예보" },
          week: { icon: "📆", label: "주간 예보" },
          location: { icon: "📍", label: "위치 변경" },
        },
      },
      tts: {
        name: "TTS",
        icon: "🔊",
        description: "텍스트를 음성으로 변환하세요",
        actions: {
          convert: { icon: "🎵", label: "텍스트 변환" },
          history: { icon: "📜", label: "변환 기록" },
          voices: { icon: "🎭", label: "음성 선택" },
        },
      },
    };

    // ModuleRegistry에서 추가 정보 가져오기
    const registryModule = getEnabledModules().find(
      (m) => m.key === moduleName
    );
    if (registryModule && registryModule.config) {
      return {
        ...defaultConfig,
        ...configs[moduleName],
        ...registryModule.config,
      };
    }

    return { ...defaultConfig, ...configs[moduleName] };
  }

  /**
   * 🕐 시간대별 인사말
   */
  getTimeBasedGreeting(currentTime) {
    const hour = parseInt(currentTime.split(":")[0]);

    if (hour >= 5 && hour < 12) return "🌅 좋은 아침이에요";
    if (hour >= 12 && hour < 17) return "☀️ 좋은 오후에요";
    if (hour >= 17 && hour < 21) return "🌆 좋은 저녁이에요";
    return "🌙 안녕하세요";
  }

  /**
   * 📊 통계 키 포맷팅
   */
  formatStatKey(key) {
    const formats = {
      totalItems: "전체 항목",
      completedItems: "완료 항목",
      pendingItems: "대기 중",
      activeItems: "진행 중",
      lastActivity: "마지막 활동",
      todayCount: "오늘 생성",
      weekCount: "이번 주",
      monthCount: "이번 달",
      successRate: "성공률",
      // 추가 포맷...
    };

    return formats[key] || key;
  }

  /**
   * 📊 통계 값 포맷팅
   */
  formatStatValue(key, value) {
    // null/undefined 처리
    if (value == null) return "없음";

    // 특별한 포맷이 필요한 키들
    if (key === "successRate") return `${value}%`;
    if (key === "lastActivity") return TimeHelper.formatRelative(value);
    if (key.includes("Count") || key.includes("total")) return `${value}개`;
    if (key.includes("Time")) return TimeHelper.formatDuration(value);

    // 기본 포맷
    return String(value);
  }

  /**
   * 📊 모듈 통계 업데이트
   */
  updateModuleStats(moduleName) {
    const currentCount = this.stats.moduleAccess.get(moduleName) || 0;
    this.stats.moduleAccess.set(moduleName, currentCount + 1);
  }

  /**
   * 🎯 Markdown 이스케이프
   */
  escapeMarkdown(text) {
    if (!text) return "";
    return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }

  /**
   * 🚨 네비게이션 오류 표시
   */
  async showNavigationError(ctx, errorMessage) {
    const errorText = `
🚨 **오류 발생**

${this.escapeMarkdown(errorMessage)}

잠시 후 다시 시도해주세요\\.
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "system:refresh" },
          { text: "🏠 메인 메뉴", callback_data: "system:main" },
        ],
      ],
    };

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(errorText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(errorText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      // 마지막 수단
      await ctx.reply(
        "❌ 오류가 발생했습니다. /start 명령어로 다시 시작해주세요."
      );
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      stats: this.stats,
      themes: Object.keys(this.uiThemes),
      uptime: formatUptime(Date.now() - this.stats.startTime),
    };
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    console.log(this.messageSystem.rainbow("🎹 NavigationHandler 정리 중..."));
    logger.moduleLog("NavigationHandler", "정리 완료", this.stats);
  }
}

module.exports = NavigationHandler;
