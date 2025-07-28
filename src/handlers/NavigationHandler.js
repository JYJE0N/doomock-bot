// src/handlers/NavigationHandler.js - 업그레이드된 최종 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
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
    return text.replace(
      new RegExp(`[${escapeChars.map((c) => `\\${c}`).join("")}]`, "g"),
      "\\$&"
    );
  }

  initialize(bot) {
    this.bot = bot;
    logger.info("🎹 NavigationHandler가 초기화되었습니다.");
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  /**
   * 🎯 콜백 쿼리 중앙 처리 허브
   */
  async handleCallback(ctx) {
    try {
      // 1. 사용자에게 즉시 응답하여 로딩 상태 표시
      await ctx.answerCbQuery();

      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;
      const userName = getUserName(callbackQuery.from);
      logger.info(`🎯 콜백: ${data} (사용자: ${userName})`);

      // 'system:menu' 요청은 항상 메인 메뉴를 보여줍니다.
      if (data === "system:menu") {
        return this.showMainMenu(ctx);
      }

      // 2. 콜백 데이터를 분해하여 모듈과 액션 결정 (예: 'todo:list' -> moduleKey='todo', subAction='list')
      const [moduleKey, subAction, ...params] = data.split(":");

      // 3. 모듈 매니저에게 해당 작업 처리 요청
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params.join(":")
      );

      // 4. 모듈로부터 받은 결과(데이터)를 바탕으로 화면 렌더링
      if (result) {
        await this.renderResponse(ctx, result);
      } else {
        logger.warn(
          `모듈 [${moduleKey}]에서 콜백 [${subAction}]에 대한 결과가 없습니다.`
        );
        // 아무것도 하지 않거나, 사용자에게 알림을 보낼 수 있습니다.
        // 예: await ctx.reply('요청을 처리했지만 표시할 내용이 없습니다.');
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

    let text = `*${this.escapeMarkdownV2(result.module)}* 모듈\n\n`;
    const keyboard = { inline_keyboard: [] };

    // [핵심] 'todo:menu' 또는 'todo:list' 요청에 대한 화면 구성
    if (
      result.module === "todo" &&
      (result.type === "menu" || result.type === "list")
    ) {
      text += "📋 *할 일 목록*\n";
      const todos = result.data?.todos || [];

      if (todos.length === 0) {
        text += "\n할 일이 없습니다\\. 새 할 일을 추가해보세요\\!";
      } else {
        todos.forEach((todo) => {
          const statusIcon = todo.completed ? "✅" : "⬜️";
          // 개별 할 일 토글/삭제 버튼 추가
          keyboard.inline_keyboard.push([
            {
              text: `${statusIcon} ${this.escapeMarkdownV2(todo.text)}`,
              callback_data: `todo:toggle:${todo._id}`,
            },
            { text: "🗑️ 삭제", callback_data: `todo:delete:${todo._id}` },
          ]);
        });
      }
      // 할 일 추가 및 메인 메뉴로 돌아가기 버튼
      keyboard.inline_keyboard.push([
        { text: "➕ 할 일 추가", callback_data: "todo:add_prompt" },
      ]);
    } else {
      // 다른 모듈들을 위한 기본 화면 (나중에 확장 가능)
      text += `작업 *${this.escapeMarkdownV2(
        result.type
      )}* 이\\(가\\) 완료되었습니다\\.`;
    }

    // 모든 메뉴 하단에 공통으로 '메인 메뉴' 버튼 추가
    keyboard.inline_keyboard.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" },
    ]);

    await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 🤖 메인 메뉴를 만들고 사용자에게 보여주는 기능
   */
  async showMainMenu(ctx) {
    try {
      const modules = getEnabledModules().filter((m) => m.key !== "system");
      const userName = getUserName(ctx.from || ctx.callbackQuery.from);
      const version = this.escapeMarkdownV2(
        process.env.npm_package_version || "3.0.1"
      );
      const menuText = `🤖 *두목봇 ${version}*\n\n안녕하세요 ${this.escapeMarkdownV2(
        userName
      )}님\\! 👋\n\n무엇을 도와드릴까요\\?\n\n_모듈을 선택하세요:_`;

      // ... (버튼 생성 로직은 동일) ...
      const moduleButtons = [];
      for (let i = 0; i < modules.length; i += 2) {
        const row = modules.slice(i, i + 2).map((module) => {
          const icon = module.icon || "▫️";
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
      // [FIX] "message is not modified" 오류는 정상적인 상황이므로 무시합니다.
      if (error.message.includes("message is not modified")) {
        logger.warn("내용이 동일하여 메시지를 수정하지 않았습니다.");
        // 여기서 아무것도 하지 않고 함수를 종료합니다.
      } else {
        logger.error("메인 메뉴 표시 실패:", error);
        await this.showNavigationError(ctx, error);
      }
    }
  }

  /**
   * 🚨 사용자에게 오류 메시지를 안전하게 보여주는 기능
   */
  async showNavigationError(ctx, error) {
    // [FIX] 2차 오류 방지를 위해 모든 특수문자를 제거한 단순 텍스트로 변경
    const errorText = `🚨 오류 발생\n\n요청 처리 중 문제가 발생했습니다.\n\n메인 메뉴로 돌아가 다시 시도해 주세요.`;
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
          errorText, // 일반 텍스트이므로 parse_mode 제거
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
