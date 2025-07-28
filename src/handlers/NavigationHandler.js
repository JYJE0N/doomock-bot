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
      // ===== 📝 TodoModule UI 케이스들 =====

      // 1-Depth: Todo 메인 메뉴

      case "todo:menu":
        text += "📝 *할일 관리*\n\n";
        text += `안녕하세요 ${this.escapeMarkdownV2(
          result.data.userName
        )}님\\!\n\n`;
        text += "📊 *현재 상황*\n";
        text += `• 전체: ${result.data.stats.total}개\n`;
        text += `• 진행중: ${result.data.stats.pending}개 ${
          result.data.stats.pending > 0 ? "⏳" : ""
        }\n`;
        text += `• 완료: ${result.data.stats.completed}개 ${
          result.data.stats.completed > 0 ? "✅" : ""
        }\n`;
        text += `• 오늘 추가: ${result.data.stats.todayAdded}개 ${
          result.data.stats.todayAdded > 0 ? "🆕" : ""
        }\n\n`;
        text += "원하는 기능을 선택해주세요\\!";

        keyboard.inline_keyboard.push(
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 할일 추가", callback_data: "todo:add" },
          ],
          [
            { text: "🔍 검색하기", callback_data: "todo:search" },
            { text: "📊 통계 보기", callback_data: "todo:stats" },
          ]
        );
        break;

      // 1-Depth: Todo 도움말
      case "todo:help":
        text += "❓ *할일 관리 도움말*\n\n";
        text += "🎯 *주요 기능*\n";
        result.data.commands.forEach((cmd) => {
          text += `• ${this.escapeMarkdownV2(cmd)}\n`;
        });
        text += "\n💡 *유용한 팁*\n";
        result.data.tips.forEach((tip) => {
          text += `• ${this.escapeMarkdownV2(tip)}\n`;
        });

        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "todo:menu" },
        ]);
        break;

      // 2-Depth: 목록 선택 메뉴
      case "todo:list_menu":
        text += "📋 *할일 목록*\n\n";
        text += "어떤 목록을 보시겠어요\\?\n\n";
        text += "📊 *현재 상황*\n";
        text += `• 진행중: ${result.data.stats.pending}개\n`;
        text += `• 완료됨: ${result.data.stats.completed}개\n`;
        text += `• 전체: ${result.data.stats.total}개`;

        keyboard.inline_keyboard.push([
          {
            text: `⏳ 진행중 (${result.data.stats.pending})`,
            callback_data: "todo:list:pending:1",
          },
          {
            text: `✅ 완료됨 (${result.data.stats.completed})`,
            callback_data: "todo:list:completed:1",
          },
        ]);
        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "todo:menu" },
        ]);
        break;

      // 2-Depth: 추가 방식 선택 메뉴
      case "todo:add_menu":
        text += "➕ *할일 추가*\n\n";
        text += "어떤 방식으로 추가하시겠어요\\?\n\n";
        text += "ℹ️ *안내사항*\n";
        text += `• 최대 ${result.data.maxItems}개까지 등록 가능\n`;
        text += `• 제목은 ${result.data.maxTitleLength}자 이내`;

        keyboard.inline_keyboard.push(
          [{ text: "⚡ 빠른 추가", callback_data: "todo:add:quick" }],
          [{ text: "📝 자세한 추가", callback_data: "todo:add:detailed" }]
        );
        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "todo:menu" },
        ]);
        break;

      // 2-Depth: 검색 방식 선택 메뉴
      case "todo:search_menu":
        text += "🔍 *할일 검색*\n\n";
        text += "어떤 방식으로 검색하시겠어요\\?";

        keyboard.inline_keyboard.push(
          [{ text: "📝 제목으로 검색", callback_data: "todo:search:by_title" }],
          [{ text: "📅 날짜로 검색", callback_data: "todo:search:by_date" }]
        );
        keyboard.inline_keyboard.push([
          { text: "◀️ 뒤로 가기", callback_data: "todo:menu" },
        ]);
        break;

      // 2-Depth: 통계 화면
      case "todo:stats":
        text += "📊 *할일 통계*\n\n";

        // 주간 통계
        if (result.data.weekly && result.data.weekly.daily) {
          text += "📅 *주간 활동*\n";
          const weeklyDays = Object.keys(result.data.weekly.daily).slice(-7);
          weeklyDays.forEach((date) => {
            const day = result.data.weekly.daily[date];
            text += `• ${this.escapeMarkdownV2(date)}: ${day.total}개 `;
            text += `\\(완료 ${day.completed}개\\)\n`;
          });
          text += "\n";
        }

        // 완료율
        if (result.data.completionRate !== undefined) {
          text += `🎯 *완료율*: ${result.data.completionRate}%\n\n`;
        }

        // 카테고리별 통계
        if (result.data.categories && result.data.categories.length > 0) {
          text += "🏷️ *카테고리별*\n";
          result.data.categories.slice(0, 5).forEach((cat) => {
            const rate =
              cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
            text += `• ${this.escapeMarkdownV2(cat._id)}: ${
              cat.total
            }개 \\(${rate}%\\)\n`;
          });
        }

        keyboard.inline_keyboard.push([
          { text: "🔄 새로고침", callback_data: "todo:stats" },
          { text: "◀️ 뒤로 가기", callback_data: "todo:menu" },
        ]);
        break;

      // 3-Depth: 진행중인 할일 목록
      case "todo:list":
        if (result.subType === "pending") {
          text += "⏳ *진행중인 할일*\n\n";

          if (result.data.todos.length === 0) {
            text += "진행중인 할일이 없습니다\\.\n";
            text += "새로운 할일을 추가해보세요\\! 💪";
          } else {
            result.data.todos.forEach((todo, index) => {
              const priority =
                todo.priority === "high"
                  ? "🔴"
                  : todo.priority === "urgent"
                  ? "🚨"
                  : todo.priority === "low"
                  ? "🟢"
                  : "🟡";

              text += `${index + 1}\\. ${priority} ${this.escapeMarkdownV2(
                todo.title
              )}\n`;
              text += `   📅 ${this.escapeMarkdownV2(todo.createdAt)}\n\n`;
            });

            // 페이지네이션 정보
            const page = result.data.pagination;
            text += `📄 페이지 ${page.currentPage}/${page.totalPages} \\(전체 ${page.totalItems}개\\)`;
          }

          // 할일별 액션 버튼들
          const todoButtons = [];
          result.data.todos.forEach((todo, index) => {
            if (index < 3) {
              // 최대 3개까지만 표시
              todoButtons.push([
                {
                  text: `✅ ${
                    todo.title.length > 15
                      ? todo.title.substring(0, 15) + "..."
                      : todo.title
                  }`,
                  callback_data: `todo:toggle:${todo.id}`,
                },
                {
                  text: "🗑️",
                  callback_data: `todo:delete:${todo.id}`,
                },
              ]);
            }
          });
          keyboard.inline_keyboard.push(...todoButtons);

          // 페이지네이션 버튼
          const paginationRow = [];
          if (result.data.pagination.hasPrev) {
            const prevPage = result.data.pagination.currentPage - 1;
            paginationRow.push({
              text: "◀️ 이전",
              callback_data: `todo:list:pending:${prevPage}`,
            });
          }
          if (result.data.pagination.hasNext) {
            const nextPage = result.data.pagination.currentPage + 1;
            paginationRow.push({
              text: "다음 ▶️",
              callback_data: `todo:list:pending:${nextPage}`,
            });
          }
          if (paginationRow.length > 0) {
            keyboard.inline_keyboard.push(paginationRow);
          }
        } else if (result.subType === "completed") {
          text += "✅ *완료된 할일*\n\n";

          if (result.data.todos.length === 0) {
            text += "완료된 할일이 없습니다\\.\n";
            text += "할일을 완료하면 여기에 표시됩니다\\! 🎯";
          } else {
            result.data.todos.forEach((todo, index) => {
              text += `${index + 1}\\. ✅ ${this.escapeMarkdownV2(
                todo.title
              )}\n`;
              text += `   🎉 ${this.escapeMarkdownV2(todo.completedAt)}\n\n`;
            });

            // 페이지네이션 정보
            const page = result.data.pagination;
            text += `📄 페이지 ${page.currentPage}/${page.totalPages} \\(전체 ${page.totalItems}개\\)`;
          }

          // 페이지네이션 버튼
          const paginationRow = [];
          if (result.data.pagination.hasPrev) {
            const prevPage = result.data.pagination.currentPage - 1;
            paginationRow.push({
              text: "◀️ 이전",
              callback_data: `todo:list:completed:${prevPage}`,
            });
          }
          if (result.data.pagination.hasNext) {
            const nextPage = result.data.pagination.currentPage + 1;
            paginationRow.push({
              text: "다음 ▶️",
              callback_data: `todo:list:completed:${nextPage}`,
            });
          }
          if (paginationRow.length > 0) {
            keyboard.inline_keyboard.push(paginationRow);
          }
        }

        keyboard.inline_keyboard.push([
          { text: "➕ 할일 추가", callback_data: "todo:add:quick" },
          { text: "◀️ 목록 메뉴", callback_data: "todo:list" },
        ]);
        break;

      // 3-Depth: 입력 모드 (할일 추가)
      case "todo:input_mode":
        text += "✏️ *할일 입력*\n\n";
        text += `${this.escapeMarkdownV2(result.data.message)}\n\n`;

        if (result.data.placeholder) {
          text += `💡 *예시*: ${this.escapeMarkdownV2(
            result.data.placeholder
          )}\n`;
        }

        if (result.data.maxLength) {
          text += `📏 *최대 길이*: ${result.data.maxLength}자\n\n`;
        }

        text += "아래에 할일을 입력해주세요\\! 👇";

        keyboard.inline_keyboard.push([
          { text: "❌ 취소", callback_data: "todo:menu" },
        ]);
        break;

      // 에러 처리
      case "todo:error":
        text += "❌ *오류 발생*\n\n";
        text += `${this.escapeMarkdownV2(result.message)}\n\n`;
        text += "메뉴로 돌아가서 다시 시도해주세요\\.";

        keyboard.inline_keyboard.push([
          { text: "🔄 다시 시도", callback_data: "todo:menu" },
        ]);
        break;

      // ===== 📝 worktimeModule UI 케이스들 =====

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
