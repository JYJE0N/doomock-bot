// src/handlers/NavigationHandler.js - 최종 수정 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

// ✅ 필수 렌더러 import 추가
const FortuneRenderer = require("../renderers/FortuneRenderer");
const TodoRenderer = require("../renderers/TodoRenderer");
const SystemRenderer = require("../renderers/SystemRenderer");
const TTSRenderer = require("../renderers/TTSRenderer"); // 🆕 TTSRenderer 추가!

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map(); // 렌더러 캐시
  }

  initialize(bot) {
    this.bot = bot;

    // ✅ 렌더러 등록 - 이제 import된 클래스들 사용 가능
    this.registerRenderer("fortune", new FortuneRenderer(bot, this));
    this.registerRenderer("todo", new TodoRenderer(bot, this));
    this.registerRenderer("system", new SystemRenderer(bot, this));
    this.registerRenderer("tts", new TTSRenderer(bot, this));

    logger.info("🎹 NavigationHandler가 초기화되었습니다.");
  }

  registerRenderer(moduleName, renderer) {
    this.renderers.set(moduleName, renderer);
    logger.debug(`📱 ${moduleName} 렌더러 등록됨`);
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

    // MarkdownV2에서 이스케이프가 필요한 문자들
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

    // 각 문자를 백슬래시와 함께 이스케이프
    let escaped = text;
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });

    return escaped;
  }

  async handleCallback(ctx) {
    try {
      // ✅ 한 번만 answerCbQuery 호출 - 텔레그램 표준 준수
      await ctx.answerCbQuery();

      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      // 시스템 메뉴는 직접 처리
      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      const [moduleKey, subAction = "menu", ...params] = data.split(":");

      // 1. 모듈에서 데이터 가져오기 (비즈니스 로직)
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params.join(":")
      );

      if (result) {
        // 2. 해당 모듈의 렌더러로 UI 렌더링
        const renderer = this.renderers.get(result.module || moduleKey);

        if (renderer) {
          await renderer.render(result, ctx);
        } else {
          logger.warn(
            `📱 렌더러를 찾을 수 없음: ${result.module || moduleKey}`
          );
          await this.renderFallbackMessage(ctx, result);
        }
      } else {
        logger.warn(`💫 모듈에서 결과를 반환하지 않음: ${moduleKey}`);
        await this.renderErrorMessage(ctx, "처리할 수 없는 요청입니다.");
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);

      try {
        // 오류 발생 시 사용자에게 친화적인 메시지 전송
        await ctx.editMessageText(
          "죄송합니다. 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
              ],
            },
          }
        );
      } catch (editError) {
        logger.error("💥 오류 메시지 전송 실패:", editError);
      }
    }
  }

  /**
   * 🏠 메인 메뉴 표시 - ✅ 핵심 수정!
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx.callbackQuery?.from || ctx.from);

      // ✅ 활성화된 모듈 정보 가져오기
      const enabledModules = getEnabledModules();

      // ✅ SystemRenderer에 전달할 데이터 구성
      const systemRenderer = this.renderers.get("system");
      if (systemRenderer) {
        const result = {
          type: "main_menu",
          module: "system",
          data: {
            userName,
            enabledModules, // ✅ 이 부분이 핵심!
          },
        };
        await systemRenderer.render(result, ctx);
      } else {
        // 폴백 - 기본 메인 메뉴
        await this.renderFallbackMainMenu(ctx, userName, enabledModules);
      }
    } catch (error) {
      logger.error("💥 메인 메뉴 표시 오류:", error);
      await this.renderErrorMessage(ctx, "메뉴를 불러올 수 없습니다.");
    }
  }

  /**
   * 📱 명령어에서 메인 메뉴 표시 (별도 메서드)
   */
  async showMainMenuFromCommand(bot, chatId, userName) {
    try {
      const enabledModules = getEnabledModules();
      const systemRenderer = this.renderers.get("system");

      if (systemRenderer) {
        // 가상 ctx 객체 생성 (명령어용)
        const mockCtx = {
          chat: { id: chatId },
          from: { first_name: userName },
          callbackQuery: {
            from: { first_name: userName },
            message: { chat: { id: chatId } },
          },
        };

        const result = {
          type: "main_menu",
          module: "system",
          data: {
            userName,
            enabledModules,
          },
        };

        await systemRenderer.render(result, mockCtx);
      } else {
        // 폴백 - 기본 환영 메시지
        await this.renderFallbackMainMenuDirect(
          bot,
          chatId,
          userName,
          enabledModules
        );
      }
    } catch (error) {
      logger.error("💥 명령어 메인 메뉴 표시 오류:", error);
      await bot.sendMessage(chatId, "메뉴를 불러오는 중 오류가 발생했습니다.");
    }
  }

  /**
   * 🆘 폴백 메인 메뉴 (렌더러 없을 때) - ✅ 개선된 버전
   */
  async renderFallbackMainMenu(ctx, userName, enabledModules) {
    let text = `🤖 *두목봇 v4\\.0\\.0*\n\n`;
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n\n`;
    text += `무엇을 도와드릴까요\\?\n\n`;
    text += `모듈을 선택하세요\\:`;

    const keyboard = this.buildModuleKeyboard(enabledModules);

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📱 명령어용 폴백 메인 메뉴 (직접 전송)
   */
  async renderFallbackMainMenuDirect(bot, chatId, userName, enabledModules) {
    let text = `🤖 *두목봇 v4\\.0\\.0*\n\n`;
    text += `안녕하세요, ${this.escapeMarkdownV2(userName)}님\\!\n\n`;
    text += `무엇을 도와드릴까요\\?\n\n`;
    text += `모듈을 선택하세요\\:`;

    const keyboard = this.buildModuleKeyboard(enabledModules);

    await bot.sendMessage(chatId, text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ⌨️ 모듈 키보드 생성 헬퍼
   */
  buildModuleKeyboard(enabledModules) {
    const keyboard = { inline_keyboard: [] };

    // 기본 모듈 아이콘과 이름 매핑
    const moduleInfo = {
      fortune: { icon: "🔮", name: "운세" },
      todo: { icon: "📋", name: "할일 관리" },
      timer: { icon: "⏰", name: "타이머" },
      worktime: { icon: "🏢", name: "근무시간" },
      leave: { icon: "🏖️", name: "휴가" },
      reminder: { icon: "🔔", name: "리마인더" },
      weather: { icon: "🌤️", name: "날씨" },
      tts: { icon: "🔊", name: "음성변환" },
      system: { icon: "⚙️", name: "시스템" },
    };

    // 시스템 모듈 제외한 사용자 모듈들 처리
    const userModules = enabledModules.filter((m) => m.key !== "system");

    // 활성화된 모듈들을 2열씩 배치
    for (let i = 0; i < userModules.length; i += 2) {
      const row = [];

      // 첫 번째 모듈
      const module1 = userModules[i];
      const info1 = moduleInfo[module1.key] || {
        icon: "📱",
        name: module1.name || module1.key,
      };
      row.push({
        text: `${info1.icon} ${info1.name}`,
        callback_data: `${module1.key}:menu`,
      });

      // 두 번째 모듈 (있으면)
      if (i + 1 < userModules.length) {
        const module2 = userModules[i + 1];
        const info2 = moduleInfo[module2.key] || {
          icon: "📱",
          name: module2.name || module2.key,
        };
        row.push({
          text: `${info2.icon} ${info2.name}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 하단 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "ℹ️ 정보", callback_data: "system:info" },
      { text: "📊 상태", callback_data: "system:status" },
    ]);

    return keyboard;
  }

  /**
   * 🆘 폴백 메시지 렌더링
   */
  async renderFallbackMessage(ctx, result) {
    const text = `⚠️ 렌더러 없음\\!\n\n모듈: ${this.escapeMarkdownV2(
      result.module || "알 수 없음"
    )}\n타입: ${this.escapeMarkdownV2(result.type || "알 수 없음")}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * ❌ 오류 메시지 렌더링
   */
  async renderErrorMessage(ctx, message) {
    const text = `❌ *오류 발생*\n\n${this.escapeMarkdownV2(message)}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await ctx.editMessageText(text, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  }

  /**
   * 📨 모듈별 메뉴 전송 (CommandHandler용)
   */
  async sendModuleMenu(bot, chatId, moduleName) {
    try {
      const renderer = this.renderers.get(moduleName);
      if (renderer) {
        // 가상 ctx 생성
        const mockCtx = {
          chat: { id: chatId },
          callbackQuery: {
            message: { chat: { id: chatId } },
          },
        };

        const result = {
          type: "menu",
          module: moduleName,
          data: {},
        };

        await renderer.render(result, mockCtx);
      } else {
        await bot.sendMessage(
          chatId,
          `❌ ${moduleName} 모듈의 렌더러를 찾을 수 없습니다.`
        );
      }
    } catch (error) {
      logger.error(`💥 모듈 메뉴 전송 오류 (${moduleName}):`, error);
      await bot.sendMessage(chatId, "메뉴를 불러오는 중 오류가 발생했습니다.");
    }
  }

  /**
   * 📊 디버그 정보 출력
   */
  getStatus() {
    return {
      handlerName: "NavigationHandler",
      renderersCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
      moduleManagerConnected: !!this.moduleManager,
      botConnected: !!this.bot,
    };
  }
}

module.exports = NavigationHandler;
