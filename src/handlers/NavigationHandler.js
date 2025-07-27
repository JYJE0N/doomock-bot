// ========================================
// 🌈 src/handlers/NavigationHandler.js v3.0.1
// ========================================
// LoggerEnhancer의 알록달록 기능 + MarkdownV2 활용!
// ========================================

const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - 알록달록 강화판
 *
 * ✨ 새로운 기능들:
 * - 🌈 LoggerEnhancer의 알록달록 기능 재사용
 * - 📱 MarkdownV2 지원으로 더 예쁜 메시지
 * - 🎨 동적 색상 테마 시스템
 * - 🎯 중앙집중식 UI 관리
 * - 🚀 사용자 친화적 인터페이스
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.initialized = false;

    // 🌈 LoggerEnhancer 스타일 시스템 활용
     // Logger에서 messageSystem 가져오기
     // LoggerEnhancer 가져오기

    // 🎨 UI 테마 시스템 (알록달록!)
    this.uiThemes = {
      main: {
        title: "🤖 **두목봇 v3\\.0\\.1**", // MarkdownV2 에스케이프
        subtitle: "🌈 _알록달록 모드 활성화!_",
        welcomeEmoji: ["🎉", "✨", "🌟", "💫", "🎈"],
        colors: ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"],
        buttonStyle: "rainbow",
      },
      module: {
        titlePrefix: "📱",
        backButton: "🔙 메뉴",
        colors: ["🎯", "⚡", "🔧", "🎪", "🎭", "🎨"],
        actionEmojis: {
          list: "📋",
          add: "➕",
          edit: "✏️",
          delete: "🗑️",
          settings: "⚙️",
          help: "❓",
          refresh: "🔄",
        },
      },
      status: {
        title: "📊 **시스템 상태**",
        icons: {
          cpu: "🧠",
          memory: "💾",
          network: "🌐",
          uptime: "⏰",
          users: "👥",
          modules: "📦",
        },
        statusColors: {
          excellent: "🟢",
          good: "🟡",
          warning: "🟠",
          error: "🔴",
        },
      },
      error: {
        title: "🚨 **시스템 오류**",
        color: "🔴",
        actions: ["🔄 재시도", "🏠 메인 메뉴", "📞 지원 요청"],
      },
    };

    // 🎭 애니메이션 프레임들
    this.animations = {
      loading: ["⏳", "⌛", "🔄", "⚡"],
      success: ["✅", "🎉", "🌟", "💫"],
      processing: ["🔄", "⚙️", "🛠️", "🔧"],
      thinking: ["🤔", "💭", "🧠", "💡"],
    };

    // 📊 네비게이션 통계
    this.stats = {
      totalNavigation: 0,
      menuViews: 0,
      moduleAccess: new Map(),
      userJourneys: new Map(),
      lastActivity: null,
    };
  }

  /**
   * 🎯 초기화 (알록달록 환영 메시지!)
   */
  async initialize(bot, moduleManager) {
    try {
      this.bot = bot;
      this.moduleManager = moduleManager;

      // 🌈 초기화 환영 메시지 (알록달록!)
      console.log(
        logger.rainbow("🎹 ═══ NavigationHandler 초기화 ═══")
      );
      console.log(
        logger.gradient(
          "🎨 알록달록 UI 시스템 로딩...",
          "cyan",
          "magenta"
        )
      );
      console.log(logger.rainbow("📱 MarkdownV2 파서 준비..."));
      console.log(
        logger.gradient(
          "✨ 사용자 친화적 인터페이스 활성화!",
          "green",
          "blue"
        )
      );

      this.initialized = true;

      // 🎉 완료 메시지
      logger.celebration("NavigationHandler 알록달록 초기화 완료!");
    } catch (error) {
      logger.error("NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 콜백 처리 (중앙 라우터)
   */
  async handleCallback(ctx) {
    try {
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;
      const [action, ...params] = data.split(":");
      const userName = getUserName(callbackQuery);

      // 🌈 알록달록 로그
      console.log(logger.rainbow(`🎯 네비게이션: ${action}`));
      console.log(
        logger.gradient(`👤 사용자: ${userName}`, "blue", "purple")
      );

      // 📊 통계 업데이트
      this.stats.totalNavigation++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      // 시스템 네비게이션 처리
      switch (action) {
        case "main":
        case "menu":
          this.stats.menuViews++;
          return await this.showMainMenu(ctx);

        case "back":
          return await this.handleBackNavigation(ctx, params);

        case "help":
          return await this.showHelp(ctx);

        case "about":
          return await this.showAbout(ctx);

        case "status":
          return await this.showSystemStatus(ctx);

        case "refresh":
          return await this.handleRefresh(ctx, params);

        default:
          // 모듈로 라우팅 (통계 포함)
          this.updateModuleStats(action);
          if (this.moduleManager) {
            return await this.moduleManager.handleCallback(
              this.bot,
              callbackQuery,
              action,
              params.join(":"),
              this.moduleManager
            );
          }
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error.message);
    }
  }

  /**
   * 🏠 메인 메뉴 표시 (알록달록 + MarkdownV2!)
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx);
      const modules = getEnabledModules();
      const currentTime = TimeHelper.format(new Date(), "time");
      const greeting = this.getTimeBasedGreeting();

      // 🌈 알록달록 메뉴 텍스트 (MarkdownV2)
      const menuText = this.buildRainbowMenuText({
        userName,
        greeting,
        currentTime,
        modules: modules.length,
      });

      // 🎨 동적 키보드 생성
      const keyboard = this.buildMainMenuKeyboard(modules);

      // 📱 메시지 전송 (MarkdownV2)
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

      // 🎉 알록달록 로그
      logger.celebration(`메인 메뉴 표시 완료! (사용자: ${userName})`);
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await this.showFallbackMenu(ctx);
    }
  }

  /**
   * 🌈 알록달록 메뉴 텍스트 생성 (MarkdownV2)
   */
  buildRainbowMenuText({ userName, greeting, currentTime, modules }) {
    // MarkdownV2 에스케이프 함수
    const escape = (text) => text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");

    const welcomeEmoji = this.getRandomEmoji(this.uiThemes.main.welcomeEmoji);
    const colorEmoji = this.getRandomEmoji(this.uiThemes.main.colors);

    return `
${colorEmoji} *두목봇 v3\\.0\\.1* ${colorEmoji}
🌈 _알록달록 모드 활성화\\!_

${welcomeEmoji} ${escape(greeting)} *${escape(userName)}*님\\!

⏰ **현재 시간:** ${escape(currentTime)}
📦 **활성 모듈:** ${modules}개
🎨 **테마:** Rainbow Mode

*무엇을 도와드릴까요?*
`.trim();
  }

  /**
   * 🎨 동적 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(modules) {
    const moduleButtons = modules.map((module) => ({
      text: `${this.getModuleEmoji(module.key)} ${module.name}`,
      callback_data: `${module.key}:menu`,
    }));

    // 2열로 배치
    const moduleRows = [];
    for (let i = 0; i < moduleButtons.length; i += 2) {
      moduleRows.push(moduleButtons.slice(i, i + 2));
    }

    return {
      inline_keyboard: [
        ...moduleRows,
        [
          { text: "📊 시스템 상태", callback_data: "status" },
          { text: "🔄 새로고침", callback_data: "refresh:main" },
        ],
        [
          { text: "❓ 도움말", callback_data: "help" },
          { text: "ℹ️ 정보", callback_data: "about" },
        ],
      ],
    };
  }

  /**
   * 📊 시스템 상태 표시 (알록달록!)
   */
  async showSystemStatus(ctx) {
    try {
      // 시스템 정보 수집
      const systemInfo = await this.collectSystemInfo();

      // 🌈 알록달록 상태 텍스트
      const statusText = this.buildRainbowStatusText(systemInfo);

      // 키보드
      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "refresh:status" },
            { text: "📈 상세 통계", callback_data: "stats:detailed" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main" }],
        ],
      };

      await ctx.editMessageText(statusText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("시스템 상태 표시 실패:", error);
      await this.showNavigationError(ctx, "시스템 상태를 가져올 수 없습니다.");
    }
  }

  /**
   * 🌈 알록달록 상태 텍스트 생성
   */
  buildRainbowStatusText(systemInfo) {
    const escape = (text) => text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");

    const { uptime, memory, activeUsers, moduleStats } = systemInfo;

    // 상태별 색상 이모지
    const getStatusEmoji = (value, thresholds) => {
      if (value >= thresholds.excellent) return "🟢";
      if (value >= thresholds.good) return "🟡";
      if (value >= thresholds.warning) return "🟠";
      return "🔴";
    };

    const memoryStatus = getStatusEmoji(memory.free, {
      excellent: 70,
      good: 50,
      warning: 30,
    });
    const userStatus = getStatusEmoji(activeUsers, {
      excellent: 10,
      good: 5,
      warning: 2,
    });

    return `
🌈 **시스템 상태 대시보드**

${this.uiThemes.status.icons.uptime} **가동 시간:** ${escape(uptime)}
${this.uiThemes.status.icons.memory} **메모리:** ${memoryStatus} ${
      memory.used
    }/${memory.total}MB
${
  this.uiThemes.status.icons.users
} **활성 사용자:** ${userStatus} ${activeUsers}명
${this.uiThemes.status.icons.network} **네트워크:** 🟢 정상

📦 **모듈 상태:**
${moduleStats
  .map((m) => `• ${m.emoji} ${escape(m.name)}: ${m.status}`)
  .join("\n")}

🎨 **UI 테마:** Rainbow Mode
⚡ **응답 속도:** 최적화됨
`.trim();
  }

  /**
   * ❓ 도움말 표시 (알록달록!)
   */
  async showHelp(ctx) {
    const helpText = `
❓ **두목봇 도움말**
🌈 _알록달록 가이드_

**🎯 주요 기능:**
• 📝 할일 관리 \\- 스마트한 할일 추적
• ⏰ 타이머 \\- 포모도로 & 커스텀 타이머
• 🏢 근무시간 \\- 출퇴근 자동 기록
• 🏖️ 휴가 관리 \\- 휴가 계획 & 승인
• 🔔 리마인더 \\- 똑똑한 알림 시스템

**🎨 특별 기능:**
• 🌈 알록달록 인터페이스
• 📱 MarkdownV2 지원
• 🎯 직관적인 네비게이션
• ⚡ 빠른 응답 속도

**⌨️ 기본 명령어:**
• \\\`/start\\\` \\- 봇 시작 및 메인 메뉴
• \\\`/help\\\` \\- 이 도움말 표시

**💡 사용 팁:**
• 버튼을 클릭하여 쉽게 탐색
• 🔙 버튼으로 언제든 뒤로가기
• 🏠 버튼으로 메인 메뉴로 즉시 이동

질문이 있으시면 언제든 문의해주세요\\! 🎉
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎨 테마 설정", callback_data: "settings:theme" },
          { text: "🔧 고급 설정", callback_data: "settings:advanced" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "main" }],
      ],
    };

    await ctx.editMessageText(helpText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 표시 (알록달록!)
   */
  async showAbout(ctx) {
    const aboutText = `
ℹ️ **두목봇 v3\\.0\\.1**
🌈 _알록달록 에디션_

**👨‍💻 제작자:** DoomockBro
**📅 버전:** 3\\.0\\.1 \\(${TimeHelper.format(new Date(), "date")}\\)
**🏷️ 라이선스:** MIT

**🛠️ 기술 스택:**
• Node\\.js 18\\+
• Telegraf 4\\.15
• MongoDB 6\\.3
• Express 5\\.1
• 🌈 LoggerEnhancer

**✨ v3\\.0\\.1 새로운 기능:**
• 🎨 알록달록 UI 시스템
• 📱 MarkdownV2 완전 지원
• 🎯 중앙집중식 네비게이션
• ⚡ 성능 최적화
• 🛡️ 보안 강화

**📊 현재 통계:**
• 🎯 총 네비게이션: ${this.stats.totalNavigation}회
• 🏠 메뉴 조회: ${this.stats.menuViews}회
• ⏰ 마지막 활동: ${this.stats.lastActivity || "없음"}

🎉 _감사합니다\\!_
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🌟 GitHub", url: "https://github.com/JYJE0N/doomock-bot" },
          { text: "📞 지원 요청", callback_data: "support:contact" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "main" }],
      ],
    };

    await ctx.editMessageText(aboutText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
      disable_web_page_preview: true,
    });
  }

  /**
   * 🔄 새로고침 처리
   */
  async handleRefresh(ctx, params) {
    const target = params[0] || "main";

    // 🎭 로딩 애니메이션
    const loadingEmoji = this.getRandomEmoji(this.animations.processing);
    await ctx.answerCbQuery(`${loadingEmoji} 새로고침 중...`);

    // 알록달록 로그
    console.log(logger.rainbow(`🔄 새로고침: ${target}`));

    switch (target) {
      case "main":
        return await this.showMainMenu(ctx);
      case "status":
        return await this.showSystemStatus(ctx);
      default:
        return await this.showMainMenu(ctx);
    }
  }

  /**
   * 🔙 뒤로가기 처리
   */
  async handleBackNavigation(ctx, params) {
    const target = params[0] || "main";

    if (target === "main") {
      return await this.showMainMenu(ctx);
    }

    // 모듈로 뒤로가기
    const [moduleKey, ...subParams] = target.split(":");
    return await this.moduleManager.handleCallback(
      this.bot,
      ctx.callbackQuery,
      moduleKey,
      subParams.join(":"),
      this.moduleManager
    );
  }

  /**
   * 🚨 네비게이션 오류 표시
   */
  async showNavigationError(ctx, errorMessage) {
    const errorText = `
🚨 **네비게이션 오류**

죄송합니다\\. 요청을 처리하는 중에 문제가 발생했습니다\\.

**오류 내용:** ${errorMessage.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1")}

🔄 다시 시도하거나 메인 메뉴로 돌아가세요\\.
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "refresh:main" },
          { text: "🏠 메인 메뉴", callback_data: "main" },
        ],
        [{ text: "📞 지원 요청", callback_data: "support:error" }],
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
      // 마지막 수단: 일반 텍스트
      await ctx.reply(
        "❌ 오류가 발생했습니다. /start 명령어로 다시 시작해주세요."
      );
    }
  }

  /**
   * 📱 폴백 메뉴 (오류 시)
   */
  async showFallbackMenu(ctx) {
    const fallbackText =
      "🤖 **두목봇**\n\n기본 메뉴입니다. 일시적인 문제가 발생했을 수 있습니다.";

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔄 새로고침", callback_data: "refresh:main" }],
        [{ text: "❓ 도움말", callback_data: "help" }],
      ],
    };

    await ctx.editMessageText(fallbackText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🕐 시간대별 인사말
   */
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    const greetings = {
      morning: ["좋은 아침", "상쾌한 아침", "활기찬 아침"],
      afternoon: ["좋은 오후", "즐거운 오후", "활력찬 오후"],
      evening: ["좋은 저녁", "편안한 저녁", "따뜻한 저녁"],
      night: ["안녕하세요", "늦은 시간", "수고하셨습니다"],
    };

    let timeSlot;
    if (hour >= 5 && hour < 12) timeSlot = "morning";
    else if (hour >= 12 && hour < 17) timeSlot = "afternoon";
    else if (hour >= 17 && hour < 22) timeSlot = "evening";
    else timeSlot = "night";

    const options = greetings[timeSlot];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * 🎨 랜덤 이모지 선택
   */
  getRandomEmoji(emojiArray) {
    return emojiArray[Math.floor(Math.random() * emojiArray.length)];
  }

  /**
   * 📦 모듈 이모지 가져오기
   */
  getModuleEmoji(moduleKey) {
    const moduleEmojis = {
      todo: "📝",
      timer: "⏰",
      worktime: "🏢",
      vacation: "🏖️",
      reminder: "🔔",
      fortune: "🔮",
      weather: "🌤️",
      habit: "🎯",
      finance: "💰",
    };
    return moduleEmojis[moduleKey] || "📦";
  }

  /**
   * 📊 모듈 통계 업데이트
   */
  updateModuleStats(moduleKey) {
    const current = this.stats.moduleAccess.get(moduleKey) || 0;
    this.stats.moduleAccess.set(moduleKey, current + 1);
  }

  /**
   * 🔍 시스템 정보 수집
   */
  async collectSystemInfo() {
    const startTime = this.moduleManager?.startTime || Date.now();
    const uptime = Date.now() - startTime;

    return {
      uptime: this.formatUptime(uptime),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        free: Math.round(
          (process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) /
            1024 /
            1024
        ),
      },
      activeUsers: this.stats.moduleAccess.size,
      moduleStats: Array.from(this.stats.moduleAccess.entries()).map(
        ([key, count]) => ({
          name: key,
          emoji: this.getModuleEmoji(key),
          status: count > 0 ? "🟢 활성" : "🟡 대기",
          count,
        })
      ),
    };
  }

  /**
   * ⏰ 가동시간 포맷
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
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
    };
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    // 🌈 알록달록 종료 메시지
    console.log(logger.rainbow("🎹 NavigationHandler 정리 중..."));
    console.log(
      logger.gradient("📊 통계 저장 중...", "blue", "purple")
    );

    logger.moduleLog("NavigationHandler", "정리 완료", this.stats);

    console.log(logger.rainbow("✨ NavigationHandler 종료됨"));
  }
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = NavigationHandler;
