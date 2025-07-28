// src/handlers/NavigationHandler.js - 간단한 버전
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");
const { MENU_CONFIG } = require("../config/MenuConfig"); // 메뉴 설정 import

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
    return text.replace(new RegExp(`[${escapeChars.join("\\")}]`, "g"), "\\$&");
  }

  async initialize(bot) {
    try {
      this.bot = bot;
      // ModuleManager는 BotController에서 나중에 주입됩니다.
      console.log(logger.rainbow("🎹 ═══ NavigationHandler 초기화 ═══"));
      this.initialized = true;
      logger.celebration("NavigationHandler 알록달록 초기화 완료!");
    } catch (error) {
      logger.error("NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  async handleCallback(ctx) {
    try {
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;
      const [moduleKey, ...params] = data.split(":");
      const subAction = params[0] || "menu";
      const actionParams = params.slice(1).join(":");

      const userName = getUserName(callbackQuery);
      logger.info(`🎯 네비게이션: ${data} (사용자: ${userName})`);
      this.stats.totalNavigation++;

      let result;

      // 시스템 모듈 직접 처리
      if (moduleKey === "system") {
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
        // 다른 모듈로 라우팅
        result = await this.moduleManager.handleCallback(
          this.bot,
          callbackQuery,
          moduleKey,
          subAction,
          actionParams
        );
      }

      // 결과 렌더링
      if (result) {
        await this.renderResponse(ctx, result);
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error);
    }
  }

  // 모듈의 결과를 받아 UI를 렌더링하는 중앙 함수
  async renderResponse(ctx, result) {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;

    if (result.type === "error") {
      return this.showNavigationError(ctx, new Error(result.message));
    }

    if (result.type === "input") {
      const text = this.escapeMarkdownV2(result.message);
      return this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        text,
        { parse_mode: "MarkdownV2" }
      );
    }

    // 각 모듈의 메뉴 텍스트와 키보드를 생성
    const moduleConfig = MENU_CONFIG.moduleMenus[result.module];
    if (!moduleConfig) return;

    let text = this.escapeMarkdownV2(moduleConfig.title);
    if (moduleConfig.subtitle)
      text += `\n${this.escapeMarkdownV2(moduleConfig.subtitle)}`;
    text += `\n\n`;

    const keyboard = { inline_keyboard: [] };

    switch (`${result.module}:${result.type}`) {
      case "todo:list":
        text += "📋 *할 일 목록*";
        if (result.data.todos.length === 0) {
          text += "\n\n할 일이 없습니다\\.";
        } else {
          result.data.todos.forEach((todo) => {
            const status = todo.completed ? "✅" : "⬜️";
            text += `\n${status} ${this.escapeMarkdownV2(todo.text)}`;
            keyboard.inline_keyboard.push([
              {
                text: `${status} ${todo.text}`,
                callback_data: `todo:toggle:${todo._id}`,
              },
              { text: `🗑️`, callback_data: `todo:delete:${todo._id}` },
            ]);
          });
        }
        break;

      // 다른 모듈들의 케이스를 여기에 추가할 수 있습니다.
      // 예: worktime:menu, timer:status 등

      default:
        text += `*${this.escapeMarkdownV2(result.module)} 메뉴*`;
        if (result.data && result.data.status) {
          text += `\n\n*상태:* ${this.escapeMarkdownV2(
            JSON.stringify(result.data.status)
          )}`;
        }
        break;
    }

    // 공통 버튼 추가
    const footerButtons = MENU_CONFIG.subMenuTemplate.commonFooter.map(
      (btn) => ({
        text: btn.name,
        callback_data: btn.callback.replace("{module}", result.module),
      })
    );
    keyboard.inline_keyboard.push(footerButtons);

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

  async sendModuleMenu(bot, chatId, moduleKey) {
    const moduleMenu = MENU_CONFIG.moduleMenus[moduleKey];
    if (!moduleMenu) {
      logger.warn(`${moduleKey} 모듈 메뉴 설정 없음`);
      return;
    }

    let text = `*${this.escapeMarkdownV2(moduleMenu.title)}*\n`;
    if (moduleMenu.subtitle)
      text += `${this.escapeMarkdownV2(moduleMenu.subtitle)}\n`;
    text += `\n원하는 기능을 선택하세요\\.`;

    const keyboard = this.buildModuleMenuKeyboard(moduleKey);

    await bot.sendMessage(chatId, text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  buildModuleMenuKeyboard(moduleName) {
    const moduleMenu = MENU_CONFIG.moduleMenus[moduleName];
    if (!moduleMenu) return { inline_keyboard: [] };

    const keyboard = { inline_keyboard: [] };
    for (let i = 0; i < moduleMenu.buttons.length; i += 2) {
      const row = moduleMenu.buttons.slice(i, i + 2).map((btn) => ({
        text: btn[0],
        callback_data: btn[1],
      }));
      keyboard.inline_keyboard.push(row);
    }
    keyboard.inline_keyboard.push(
      MENU_CONFIG.subMenuTemplate.commonFooter.map((btn) => ({
        text: btn.name,
        callback_data: btn.callback.replace("{module}", moduleName),
      }))
    );
    return keyboard;
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
        const row = modules.slice(i, i + 2).map((module) => ({
          text: `${module.config.icon || "📱"} ${module.name}`,
          callback_data: `${module.key}:menu`,
        }));
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
    const errorMessage = this.escapeMarkdownV2(
      error.message || "알 수 없는 오류"
    );
    const errorText = `🚨 *네비게이션 오류*\n\n요청을 처리하는 중에 문제가 발생했습니다\.\n\n*오류:* \`${errorMessage}\`\n\n다시 시도하거나 메인 메뉴로 돌아가세요\.`;
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
      logger.error("오류 메시지 전송 실패:", sendError);
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
