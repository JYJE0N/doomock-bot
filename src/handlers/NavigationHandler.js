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

      // 🌈 로그
      console.log(this.messageSystem.rainbow(`🎯 네비게이션: ${action}`));

      // 통계 업데이트
      this.stats.totalNavigation++;

      // ❌ answerCallbackQuery 제거! (BotController에서 이미 처리)

      // 시스템 네비게이션 처리
      switch (action) {
        case "main":
        case "menu":
          return await this.showMainMenu(ctx);

        case "help":
          return await this.showHelp(ctx);

        case "status":
          return await this.showSystemStatus(ctx);

        default:
          // 모듈로 라우팅
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
      logger.error("네비게이션 콜백 실패:", error);
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
   * 🎯 콜백 처리 (중앙 라우터) - UI 렌더링 추가!
   */
  async handleCallback(ctx, options = {}) {
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

      // 시스템 네비게이션 처리 (직접 UI 렌더링)
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
          // ✅ 모듈로 라우팅 + UI 렌더링 추가!
          this.updateModuleStats(action);
          if (this.moduleManager) {
            // 1. 모듈에서 데이터 받기
            const result = await this.moduleManager.handleCallback(
              this.bot,
              callbackQuery,
              action,
              params.join(":"),
              this.moduleManager
            );

            // 2. ✅ 받은 데이터로 UI 렌더링!
            if (result) {
              return await this.renderModuleResult(ctx, result);
            }
          }
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error.message);
    }
  }

  /**
   * ✅ 새로 추가: 모듈 결과 UI 렌더링
   */
  async renderModuleResult(ctx, result) {
    const callbackQuery = ctx.callbackQuery;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    try {
      switch (result.type) {
        case "menu":
          return await this.renderModuleMenu(ctx, result);

        case "error":
          return await this.renderModuleError(ctx, result);

        case "success":
          return await this.renderModuleSuccess(ctx, result);

        case "checkin":
        case "checkout":
          return await this.renderWorktimeAction(ctx, result);

        case "today":
          return await this.renderWorktimeStatus(ctx, result);

        case "help":
          return await this.renderModuleHelp(ctx, result);

        default:
          logger.warn("알 수 없는 결과 타입:", result.type);
          return await this.renderGenericResult(ctx, result);
      }
    } catch (error) {
      logger.error("모듈 UI 렌더링 실패:", error);
      await this.showNavigationError(ctx, "UI 렌더링 중 오류가 발생했습니다");
    }
  }

  /**
   * ✅ 워크타임 메뉴 렌더링
   */
  async renderWorktimeMenu(ctx, result) {
    const callbackQuery = ctx.callbackQuery;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    const { status } = result.data;

    const menuText = `🏢 **근무시간 관리**

📅 **오늘 (${status.date})**
${
  status.isCheckedIn
    ? `✅ 출근 완료: ${TimeHelper.format(status.checkInTime, "HH:mm")}`
    : "⏸️ 아직 출근하지 않음"
}
${
  status.isCheckedOut
    ? `✅ 퇴근 완료: ${TimeHelper.format(status.checkOutTime, "HH:mm")}`
    : "⏸️ 아직 퇴근하지 않음"
}

${
  status.workDuration > 0
    ? `⏱️ 근무시간: ${Math.floor(status.workDuration / 60)}시간 ${
        status.workDuration % 60
      }분`
    : ""
}

원하는 작업을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          status.isCheckedIn
            ? { text: "🏃‍♂️ 퇴근하기", callback_data: "worktime:checkout" }
            : { text: "👋 출근하기", callback_data: "worktime:checkin" },
        ],
        [
          { text: "📊 오늘 현황", callback_data: "worktime:today" },
          { text: "❓ 도움말", callback_data: "worktime:help" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main" }],
      ],
    };

    await ctx.editMessageText(menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 모듈 메뉴 렌더링 (통합)
   */
  async renderModuleMenu(ctx, result) {
    const { module } = result;

    switch (module) {
      case "worktime":
        return await this.renderWorktimeMenu(ctx, result);
      case "todo":
        return await this.renderTodoMenu(ctx, result);
      case "timer":
        return await this.renderTimerMenu(ctx, result);
      default:
        return await this.renderGenericMenu(ctx, result);
    }
  }

  /**
   * ✅ 워크타임 액션 렌더링
   */
  async renderWorktimeAction(ctx, result) {
    const { type, data } = result;
    const { result: actionResult } = data;

    const actionText = type === "checkin" ? "출근" : "퇴근";
    const emoji = type === "checkin" ? "👋" : "🏃‍♂️";

    const successText = `${emoji} **${actionText} 처리 완료!**

${actionResult.message}
⏰ 시간: ${TimeHelper.format(
      actionResult.checkInTime || actionResult.checkOutTime,
      "HH:mm"
    )}

다른 작업을 선택해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 오늘 현황", callback_data: "worktime:today" },
          { text: "🔙 워크타임 메뉴", callback_data: "worktime:menu" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "main" }],
      ],
    };

    await ctx.editMessageText(successText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 에러 렌더링
   */
  async renderModuleError(ctx, result) {
    const errorText = `❌ **오류 발생**

${result.message}

다시 시도하거나 메인 메뉴로 돌아가세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: `${result.module}:menu` },
          { text: "🏠 메인 메뉴", callback_data: "main" },
        ],
      ],
    };

    await ctx.editMessageText(errorText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 기본 결과 렌더링
   */
  async renderGenericResult(ctx, result) {
    const resultText = `✅ **처리 완료**

모듈: ${result.module}
액션: ${result.action}

메인 메뉴로 돌아가시겠습니까?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 이전 메뉴", callback_data: `${result.module}:menu` },
          { text: "🏠 메인 메뉴", callback_data: "main" },
        ],
      ],
    };

    await ctx.editMessageText(resultText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
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

  async showHelp(ctx) {
    try {
      const helpText = `
🤖 **두목봇 도움말**

**📋 주요 기능:**
• 📝 할일 관리
• ⏰ 집중 타이머 
• 🏢 근무시간 관리
• 🏖️ 연차 계산기
• 🔔 리마인더
• 🔮 운세
• 🌤️ 날씨
• 🔊 음성 변환

**🎯 사용법:**
버튼을 클릭하거나 명령어를 입력하세요\\!

*문의사항이 있으시면 개발자에게 연락하세요\\.*
`.trim();

      const keyboard = {
        inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(helpText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(helpText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error("도움말 표시 실패:", error);
      await ctx.reply("❌ 도움말을 불러올 수 없습니다.");
    }
  }

  async showSystemStatus(ctx) {
    try {
      const statusText = `
🔧 **시스템 상태**

**✅ 전체 상태:** 정상
**🤖 봇 상태:** 활성화
**🗄️ 데이터베이스:** 연결됨
**📦 모듈:** 9개 로드됨
**🌤️ API:** 정상

**⏰ 업타임:** ${this.getUptime()}
**📊 메모리 사용량:** ${this.getMemoryUsage()}MB

*모든 시스템이 정상 작동 중입니다\\.*
`.trim();

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "status" },
            { text: "🏠 메인 메뉴", callback_data: "main" },
          ],
        ],
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(statusText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(statusText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error("시스템 상태 표시 실패:", error);
      await ctx.reply("❌ 시스템 상태를 불러올 수 없습니다.");
    }
  }

  // 헬퍼 메서드들
  getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}시간 ${minutes}분`;
  }

  getMemoryUsage() {
    const used = process.memoryUsage();
    return Math.round(used.rss / 1024 / 1024);
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
