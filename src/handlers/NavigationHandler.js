// src/handlers/NavigationHandler.js - 간단한 버전
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

/**
 * 🎹 NavigationHandler - 간단한 버전
 * messageSystem 없이 기본 기능만 구현
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.initialized = false;

    // 📊 네비게이션 통계
    this.stats = {
      totalNavigation: 0,
      menuViews: 0,
      moduleAccess: new Map(),
    };
  }

  /**
   * 🎯 초기화
   */
  async initialize(bot, moduleManager) {
    try {
      this.bot = bot;
      this.moduleManager = moduleManager;

      // 🌈 알록달록 초기화 메시지
      console.log(logger.rainbow("🎹 ═══ NavigationHandler 초기화 ═══"));
      console.log(
        logger.gradient("🎨 알록달록 UI 시스템 로딩...", "cyan", "magenta")
      );
      console.log(logger.rainbow("📱 MarkdownV2 파서 준비..."));
      console.log(
        logger.gradient("✨ 사용자 친화적 인터페이스 활성화!", "green", "blue")
      );

      this.initialized = true;

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

      logger.info(`🎯 네비게이션: ${action} (사용자: ${userName})`);

      // 🌈 알록달록 로그
      console.log(logger.rainbow(`🎯 네비게이션: ${action}`));
      console.log(logger.gradient(`👤 사용자: ${userName}`, "blue", "purple"));

      // 📊 통계 업데이트
      this.stats.totalNavigation++;

      // 시스템 네비게이션 처리
      switch (action) {
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
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error.message);
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(ctx) {
    try {
      const modules = getEnabledModules();
      const userName = getUserName(ctx.from || ctx.callbackQuery.from);

      // 메인 메뉴 텍스트
      const menuText = `🤖 *두목봇 v3\\.0\\.1*

안녕하세요 ${userName}님\\! 👋

무엇을 도와드릴까요\\?

_모듈을 선택하세요:_`.trim();

      // 모듈 버튼 생성 (2열)
      const moduleButtons = [];
      for (let i = 0; i < modules.length; i += 2) {
        const row = [];

        // 첫 번째 버튼
        const module1 = modules[i];
        if (module1 && module1.config) {
          row.push({
            text: `${module1.config.icon || "📱"} ${module1.name}`,
            callback_data: `${module1.key}:menu`,
          });
        }

        // 두 번째 버튼 (있으면)
        if (i + 1 < modules.length) {
          const module2 = modules[i + 1];
          if (module2 && module2.config) {
            row.push({
              text: `${module2.config.icon || "📱"} ${module2.name}`,
              callback_data: `${module2.key}:menu`,
            });
          }
        }

        if (row.length > 0) {
          moduleButtons.push(row);
        }
      }

      // 시스템 버튼들
      const systemButtons = [
        [
          { text: "❓ 도움말", callback_data: "help" },
          { text: "ℹ️ 정보", callback_data: "about" },
        ],
        [{ text: "📊 상태", callback_data: "status" }],
      ];

      const keyboard = {
        inline_keyboard: [...moduleButtons, ...systemButtons],
      };

      // 메시지 전송 또는 수정
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

      logger.info(`메인 메뉴 표시됨 (사용자: ${userName})`);
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await ctx.reply("❌ 메뉴를 표시하는 중 오류가 발생했습니다.");
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(ctx) {
    const helpText = `❓ *도움말*

*기본 명령어:*
/start \\- 봇 시작
/help \\- 도움말 보기
/menu \\- 메인 메뉴

*사용 방법:*
1\\. 메인 메뉴에서 원하는 모듈 선택
2\\. 각 모듈의 기능 사용
3\\. 뒤로가기 버튼으로 이전 메뉴로 이동

*문의사항:*
문제가 있으시면 관리자에게 문의하세요\\!`.trim();

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
    };

    await ctx.editMessageText(helpText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ℹ️ 정보 표시
   */
  async showAbout(ctx) {
    const aboutText = `ℹ️ *두목봇 정보*

*버전:* v3\\.0\\.1
*개발:* DoomockBro
*설명:* 직장인을 위한 스마트 어시스턴트

*주요 기능:*
• 📝 할일 관리
• ⏰ 타이머 \\& 포모도로
• 🏢 근무시간 관리
• 🌴 휴가 관리
• 🔔 리마인더
• 🔮 운세
• 🌤️ 날씨
• 🔊 TTS

_지속적으로 업데이트 중입니다\\!_`.trim();

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
    };

    await ctx.editMessageText(aboutText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📊 시스템 상태 표시
   */
  async showSystemStatus(ctx) {
    const uptime = Math.floor(process.uptime() / 60);
    const memoryUsage = Math.round(
      process.memoryUsage().heapUsed / 1024 / 1024
    );

    const statusText = `📊 *시스템 상태*

*가동시간:* ${uptime}분
*메모리 사용:* ${memoryUsage}MB
*환경:* ${process.env.NODE_ENV || "development"}
*Node\\.js:* ${process.version}

*통계:*
• 총 네비게이션: ${this.stats.totalNavigation}회
• 메뉴 조회: ${this.stats.menuViews}회`.trim();

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
    };

    await ctx.editMessageText(statusText, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 🚨 네비게이션 오류 표시
   */
  async showNavigationError(ctx, errorMessage) {
    const errorText = `🚨 *네비게이션 오류*

요청을 처리하는 중에 문제가 발생했습니다\\.

*오류:* ${errorMessage.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1")}

다시 시도하거나 메인 메뉴로 돌아가세요\\.`.trim();

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "main" }]],
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
    };
  }

  /**
   * 🧹 정리 작업
   */
  cleanup() {
    // 🌈 알록달록 종료 메시지
    console.log(logger.rainbow("🎹 NavigationHandler 정리 중..."));
    console.log(logger.gradient("📊 통계 저장 중...", "blue", "purple"));

    logger.module("NavigationHandler", "정리 완료", this.stats);

    console.log(logger.rainbow("✨ NavigationHandler 종료됨"));
  }
}

module.exports = NavigationHandler;
