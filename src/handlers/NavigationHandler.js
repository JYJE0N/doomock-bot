// src/handlers/NavigationHandler.js
// 🎹 네비게이션 핸들러 - UI/UX 전담 (v3.0.1)

const logger = require("../utils/LoggerEnhancer");
const { getUserName, getUserId } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

/**
 * 🎹 NavigationHandler - UI/네비게이션 전담
 *
 * 역할: 모든 UI 관련 작업 (메뉴, 키보드, 네비게이션)
 * 비유: 쇼핑몰의 안내 데스크
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.initialized = false;
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot, moduleManager) {
    this.bot = bot;
    this.moduleManager = moduleManager;
    this.initialized = true;

    logger.success("✅ NavigationHandler 초기화 완료");
  }

  /**
   * 🎯 콜백 처리 (중앙 라우터)
   */
  async handleCallback(ctx) {
    try {
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;
      const [action, ...params] = data.split(":");

      logger.debug(`🎯 네비게이션 라우팅: ${action}`);

      // 시스템 네비게이션 처리
      switch (action) {
        case "main":
        case "menu":
          return await this.showMainMenu(ctx);

        case "back":
          return await this.handleBackNavigation(ctx, params);

        case "help":
          return await this.showHelp(ctx);

        case "about":
          return await this.showAbout(ctx);

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
      logger.error("네비게이션 콜백 처리 실패", error);
      throw error;
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx);
      const modules = getEnabledModules();

      const menuText = `
🏠 **메인 메뉴**

안녕하세요 ${userName}님! 👋
두목봇 v3.0.1에 오신 것을 환영합니다.

무엇을 도와드릴까요?
`;

      const keyboard = this.createMainMenuKeyboard(modules);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(menuText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }

      logger.debug("메인 메뉴 표시됨");
    } catch (error) {
      logger.error("메인 메뉴 표시 실패", error);
      throw error;
    }
  }

  /**
   * 🎹 메인 메뉴 키보드 생성
   */
  createMainMenuKeyboard(modules) {
    const buttons = [];

    // 모듈 버튼들 (2열로 배치)
    for (let i = 0; i < modules.length; i += 2) {
      const row = [];

      // 첫 번째 버튼
      const module1 = modules[i];
      if (module1 && module1.config.showInMenu !== false) {
        row.push({
          text: `${module1.config.icon || "📦"} ${module1.name}`,
          callback_data: `${module1.key}:menu`,
        });
      }

      // 두 번째 버튼 (있으면)
      const module2 = modules[i + 1];
      if (module2 && module2.config.showInMenu !== false) {
        row.push({
          text: `${module2.config.icon || "📦"} ${module2.name}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      if (row.length > 0) {
        buttons.push(row);
      }
    }

    // 하단 메뉴
    buttons.push([
      { text: "❓ 도움말", callback_data: "help" },
      { text: "ℹ️ 정보", callback_data: "about" },
    ]);

    return { inline_keyboard: buttons };
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(ctx) {
    const helpText = `
❓ **도움말**

두목봇은 직장인을 위한 업무 도우미입니다.

**주요 기능:**
• 📝 할일 관리 - 할일을 추가하고 관리하세요
• ⏰ 타이머 - 포모도로 타이머로 집중력을 높이세요
• 🏢 근무시간 - 출퇴근 시간을 기록하세요
• 🏖️ 휴가 관리 - 휴가를 계획하고 관리하세요
• 🔔 리마인더 - 중요한 일정을 잊지 마세요

**사용법:**
1. 메인 메뉴에서 원하는 기능을 선택하세요
2. 안내에 따라 진행하세요
3. 언제든 "뒤로가기"로 이전 메뉴로 돌아갈 수 있습니다

질문이 있으시면 @your_username 으로 문의해주세요!
`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
    };

    await ctx.editMessageText(helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 표시
   */
  async showAbout(ctx) {
    const aboutText = `
ℹ️ **두목봇 정보**

**버전:** 3.0.1
**제작:** DoomockBro
**라이선스:** MIT

**기술 스택:**
• Node.js 18+
• Telegraf 4.15
• MongoDB 6.3
• Express 5.1

**업데이트 내역:**
• v3.0.1 - 모듈 시스템 개선
• v3.0.0 - 전체 리팩토링
• v2.0.0 - 데이터베이스 추가

[GitHub](https://github.com/JYJE0N/doomock-bot)
`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
    };

    await ctx.editMessageText(aboutText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
      disable_web_page_preview: true,
    });
  }

  /**
   * 🔙 뒤로가기 처리
   */
  async handleBackNavigation(ctx, params) {
    // 뒤로가기 대상 파악
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
   * 🎨 표준 네비게이션 바 생성
   */
  createNavigationBar(backTarget = "main") {
    return [
      { text: "🏠 메인 메뉴", callback_data: "main" },
      { text: "⬅️ 뒤로가기", callback_data: `back:${backTarget}` },
    ];
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
    };
  }
}

module.exports = NavigationHandler;
