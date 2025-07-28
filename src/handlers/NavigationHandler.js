// src/handlers/NavigationHandler.js - 수정된 최종 버전
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");
const { MENU_CONFIG } = require("../config/MenuConfig");

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.initialized = false;
    this.stats = {
      totalNavigation: 0,
      menuViews: 0,
      moduleAccess: new Map(),
    };
  }

  // MarkdownV2 이스케이프 헬퍼 함수
  escapeMarkdownV2(text) {
    if (typeof text !== "string") return "";
    const escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];
    // 정규식에 사용될 특수 문자를 이스케이프합니다.
    const regex = new RegExp(
      `[${escapeChars.map((c) => `\\${c}`).join("")}]`,
      "g"
    );
    return text.replace(regex, "\\$&");
  }

  async initialize(bot) {
    try {
      this.bot = bot;
      console.log(logger.rainbow("🎹 ═══ NavigationHandler 초기화 ═══"));
      this.initialized = true;
      logger.celebration("NavigationHandler 알록달록 초기화 완료!");
    } catch (error) {
      logger.error("NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  async handleCallback(ctx) {
    try {
      const callbackQuery = ctx.callbackQuery;
      await ctx.answerCbQuery(); // 사용자에게 즉각적인 피드백을 줍니다.

      const data = callbackQuery.data;
      const [moduleKey, ...params] = data.split(":");
      const subAction = params[0] || "menu";
      const actionParams = params.slice(1).join(":");
      const userName = getUserName(callbackQuery.from);

      logger.info(`🎯 네비게이션: ${data} (사용자: ${userName})`);
      this.stats.totalNavigation++;

      let result;

      if (moduleKey === "system") {
        if (subAction === "menu") {
          return this.showMainMenu(ctx);
        }
        // 다른 system 액션들 처리 (help, about, status)
        const systemModule = this.moduleManager.modules.get("system")?.instance;
        if (systemModule) {
          result = await systemModule.handleCallback(
            this.bot,
            callbackQuery,
            subAction,
            actionParams,
            this.moduleManager
          );
        }
      } else {
        result = await this.moduleManager.handleCallback(
          this.bot,
          callbackQuery,
          moduleKey,
          subAction,
          actionParams
        );
      }

      if (result) {
        await this.renderResponse(ctx, result);
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error);
    }
  }

  async renderResponse(ctx, result) {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;

    if (!result || result.type === "error") {
      const errorMessage = result
        ? result.message
        : "알 수 없는 오류가 발생했습니다.";
      return this.showNavigationError(ctx, new Error(errorMessage));
    }

    // 이 부분은 이전 제안과 동일하게 유지됩니다.
    // ... TodoModule, TimerModule 등에 대한 UI 렌더링 로직 ...
    // 우선 간단한 텍스트만 표시하도록 수정
    const text = `모듈 *${this.escapeMarkdownV2(
      result.module
    )}* 의 작업 *${this.escapeMarkdownV2(
      result.type
    )}* 이\\(가\\) 완료되었습니다\\.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      text,
      {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      }
    );
  }

  async showMainMenu(ctx) {
    try {
      const modules = getEnabledModules().filter((m) => !m.hidden);
      const userName = getUserName(ctx.from || ctx.callbackQuery.from);
      const version = this.escapeMarkdownV2("v3.0.1");
      const menuText = `🤖 *두목봇 ${version}*\n\n안녕하세요 ${this.escapeMarkdownV2(
        userName
      )}님\\! 👋\n\n무엇을 도와드릴까요\\?\n\n_모듈을 선택하세요:_`;

      const moduleButtons = [];
      for (let i = 0; i < modules.length; i += 2) {
        const row = modules.slice(i, i + 2).map((module) => {
          // [FIX] 모듈 또는 config가 없을 경우를 대비한 방어 코드
          if (!module || !module.key || !module.name) {
            logger.warn("잘못된 모듈 구성 발견:", module);
            return { text: "❓ 알 수 없음", callback_data: "system:error" };
          }
          // [FIX] config 또는 icon이 없을 경우 기본값 사용
          const icon = module.config?.icon || "▫️";
          return {
            text: `${icon} ${module.name}`,
            callback_data: `${module.key}:menu`,
          };
        });
        moduleButtons.push(row);
      }

      const systemButtons = [
        [
          { text: "❓ 도움말", callback_data: "system:help" },
          { text: "ℹ️ 정보", callback_data: "system:about" },
          { text: "📊 상태", callback_data: "system:status" },
        ],
      ];
      const keyboard = {
        inline_keyboard: [...moduleButtons, ...systemButtons],
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
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await this.showNavigationError(ctx, error);
    }
  }

  async showNavigationError(ctx, error) {
    // [FIX] 사용자에게 보여지는 오류 메시지를 단순화하여 2차 오류를 방지
    const errorText = `🚨 *오류 발생*\n\n요청을 처리하는 중 문제가 발생했습니다\.\n\n다시 시도하거나 메인 메뉴로 돌아가세요\.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    try {
      const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (ctx.callbackQuery) {
        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          errorText,
          { parse_mode: "MarkdownV2", reply_markup: keyboard }
        );
      } else {
        await ctx.reply(errorText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (sendError) {
      logger.error("최종 오류 메시지 전송 실패:", sendError);
    }
  }
}

module.exports = NavigationHandler;
