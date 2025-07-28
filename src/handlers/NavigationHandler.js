// src/handlers/NavigationHandler.js - 안정화된 최종 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
  }

  initialize(bot) {
    this.bot = bot;
    logger.info("🎹 NavigationHandler가 초기화되었습니다.");
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);
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
    return text.replace(
      new RegExp(`[${escapeChars.map((c) => `\\${c}`).join("")}]`, "g"),
      "\\$&"
    );
  }

  async handleCallback(ctx) {
    try {
      await ctx.answerCbQuery();
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      const [moduleKey, subAction = "menu", ...params] = data.split(":");
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params.join(":")
      );

      if (result) {
        await this.renderResponse(ctx, result);
      } else {
        logger.warn(
          `모듈 [${moduleKey}]에서 콜백 [${subAction}]에 대한 렌더링 결과가 없습니다.`
        );
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error);
    }
  }

  /**
   * 🎨 모듈의 결과를 받아 UI를 렌더링하는 중앙 함수
   */
  async renderResponse(ctx, result) {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;

    if (!result || result.type === "error") {
      const errorMessage = result ? result.message : "알 수 없는 오류";
      return this.showNavigationError(ctx, new Error(errorMessage));
    }

    let text = `*${this.escapeMarkdownV2(result.module)} 모듈*\n\n`;
    const keyboard = { inline_keyboard: [] };

    // --- ⬇️ 이 switch 블록이 핵심 ⬇️ ---
    switch (`${result.module}:${result.type}`) {
      // 1-Depth: 근무시간 관리 메인 메뉴
      case "worktime:menu":
        text += "🏢 *근무시간 관리*\n\n무엇을 할까요?";
        keyboard.inline_keyboard.push(
          [{ text: "🚀 출근하기", callback_data: "worktime:checkin" }],
          [{ text: "📊 리포트 보기", callback_data: "worktime:show_report" }] // 2-depth로 가는 버튼
        );
        break;

      // 2-Depth: 리포트 선택 화면
      case "worktime:show_report":
        text += "📊 *리포트 보기*\n\n어떤 리포트를 보시겠어요?";
        keyboard.inline_keyboard.push(
          [
            {
              text: "📅 월간 리포트",
              callback_data: "worktime:show_report:monthly",
            },
          ], // 3-depth로 가는 버튼
          [
            {
              text: "🗓️ 연간 리포트",
              callback_data: "worktime:show_report:yearly",
            },
          ]
        );
        // '뒤로 가기' 버튼을 추가하여 이전 메뉴(worktime:menu)로 돌아갈 수 있게 합니다.
        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "worktime:menu" },
        ]);
        break;

      // 3-Depth: 월간 리포트 표시 화면
      case "worktime:show_report:monthly":
        text += "📅 *월간 리포트*\n\n";
        // result.data에서 월간 리포트 데이터를 가져와 표시합니다.
        text += `총 근무 시간: ${this.escapeMarkdownV2(
          result.data.totalHours
        )}시간\n`;
        text += `평균 근무 시간: ${this.escapeMarkdownV2(
          result.data.avgHours
        )}시간`;

        // '뒤로 가기' 버튼으로 2-depth 메뉴(리포트 선택)로 돌아갑니다.
        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "worktime:show_report" },
        ]);
        break;

      // 다른 모든 모듈을 위한 기본 화면
      default:
        text += `작업 *${this.escapeMarkdownV2(
          result.type
        )}* 이\\(가\\) 완료되었습니다.`;
        break;
    }
    // --- ⬆️ 여기까지가 핵심 ⬆️ ---

    keyboard.inline_keyboard.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" },
    ]);

    try {
      await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });
    } catch (error) {
      if (!error.message.includes("message is not modified")) {
        logger.error("RenderResponse 수정 실패:", error);
        await this.showNavigationError(ctx, error);
      }
    }
  }

  async showMainMenu(ctx) {
    try {
      const modules = getEnabledModules().filter((m) => m.key !== "system");
      const userName = getUserName(ctx.from || ctx.callbackQuery.from);
      const version = this.escapeMarkdownV2("3.0.1");
      const menuText = `🤖 *두목봇 ${version}*\n\n안녕하세요 ${this.escapeMarkdownV2(
        userName
      )}님\\! 👋\n\n무엇을 도와드릴까요\\?\n\n_모듈을 선택하세요:_`;

      const moduleButtons = [];
      for (let i = 0; i < modules.length; i += 2) {
        const row = modules.slice(i, i + 2).map((module) => {
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
      if (error.message.includes("message is not modified")) {
        logger.warn("내용이 동일하여 메시지를 수정하지 않았습니다.");
      } else {
        logger.error("메인 메뉴 표시 실패:", error);
        await this.showNavigationError(ctx, error);
      }
    }
  }

  async showNavigationError(ctx, error) {
    const errorText = `🚨 오류 발생\n\n요청 처리 중 문제가 발생했습니다.\n메인 메뉴로 돌아가 다시 시도해 주세요.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
    try {
      if (ctx.callbackQuery) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          errorText,
          { reply_markup: keyboard }
        );
      } else {
        await ctx.reply(errorText, { reply_markup: keyboard });
      }
    } catch (sendError) {
      logger.error("최종 오류 메시지 전송 실패:", sendError);
    }
  }
}

module.exports = NavigationHandler;
