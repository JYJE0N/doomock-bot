// ========================================
// 🌈 src/handlers/NavigationHandler.js v3.0.1 - 수정된 버전
// ========================================
// MessageSystem 오류 해결!
// ========================================

const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");
const TimeHelper = require("../utils/TimeHelper");

// ✅ 수정: UnifiedMessageSystem 직접 import
const {
  UnifiedMessageSystem,
} = require("../utils/Message/UnifiedMessageSystem");

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

    // ✅ 수정: 직접 UnifiedMessageSystem 인스턴스 생성
    this.messageSystem = new UnifiedMessageSystem();

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
        this.messageSystem.rainbow("🎹 ═══ NavigationHandler 초기화 ═══")
      );
      console.log(
        this.messageSystem.gradient(
          "🎨 알록달록 UI 시스템 로딩...",
          "cyan",
          "magenta"
        )
      );
      console.log(this.messageSystem.rainbow("📱 MarkdownV2 파서 준비..."));
      console.log(
        this.messageSystem.gradient(
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
      console.log(this.messageSystem.rainbow(`🎯 네비게이션: ${action}`));
      console.log(
        this.messageSystem.gradient(`👤 사용자: ${userName}`, "blue", "purple")
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
      // 🌈 알록달록 로그
      console.log(this.messageSystem.rainbow("🏠 메인 메뉴 표시"));

      const menuText = `🤖 **두목봇 v3\\.0\\.1**
🌈 _알록달록 모드 활성화\\!_

**📱 사용 가능한 기능들:**
🔹 할일 관리 \\- 효율적인 업무 정리
🔹 타이머 \\- 포모도로 기법 지원  
🔹 근무시간 \\- 출퇴근 시간 기록
🔹 날씨 정보 \\- 실시간 날씨\\&미세먼지
🔹 운세 \\- 오늘의 운세 확인

_버튼을 눌러 원하는 기능을 선택하세요\\!_`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "🏢 근무시간", callback_data: "worktime:menu" },
            { text: "🌤️ 날씨", callback_data: "weather:menu" },
          ],
          [
            { text: "🔮 운세", callback_data: "fortune:menu" },
            { text: "🔊 TTS", callback_data: "tts:menu" },
          ],
          [
            { text: "📊 상태", callback_data: "status" },
            { text: "❓ 도움말", callback_data: "help" },
          ],
        ],
      };

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
      this.updateModuleStats("main_menu");
      logger.celebration("메인 메뉴 표시 완료!");
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await this.showFallbackMenu(ctx);
    }
  }

  /**
   * 📱 폴백 메뉴 (오류 시 - 안전한 일반 텍스트)
   */
  async showFallbackMenu(ctx) {
    const fallbackText = `🤖 두목봇 v3.0.1

기본 메뉴입니다. 일시적인 문제가 발생했을 수 있습니다.

📋 사용 가능한 기능:
• 할일 관리
• 타이머 
• 시스템 상태
• 도움말

버튼을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일", callback_data: "todo:menu" },
          { text: "⏰ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "🔊 TTS", callback_data: "tts:menu" },
          { text: "📊 상태", callback_data: "status" },
        ],
        [{ text: "❓ 도움말", callback_data: "help" }],
      ],
    };

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(fallbackText, {
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(fallbackText, {
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      // 최후의 수단: 매우 간단한 메뉴
      await ctx.reply("🤖 두목봇\n\n/start 명령어로 다시 시작해주세요.");
    }
  }

  /**
   * 📊 모듈 통계 업데이트
   */
  updateModuleStats(moduleName) {
    const currentCount = this.stats.moduleAccess.get(moduleName) || 0;
    this.stats.moduleAccess.set(moduleName, currentCount + 1);
  }

  /**
   * 🚨 네비게이션 오류 표시
   */
  async showNavigationError(ctx, errorMessage) {
    const errorText = `🚨 **네비게이션 오류**

요청을 처리하는 중에 문제가 발생했습니다\\.

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
    console.log(this.messageSystem.rainbow("🎹 NavigationHandler 정리 중..."));
    console.log(
      this.messageSystem.gradient("📊 통계 저장 중...", "blue", "purple")
    );

    logger.moduleLog("NavigationHandler", "정리 완료", this.stats);

    console.log(this.messageSystem.rainbow("✨ NavigationHandler 종료됨"));
  }
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = NavigationHandler;
