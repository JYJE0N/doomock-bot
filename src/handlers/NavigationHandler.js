// src/handlers/NavigationHandler.js - 콜백 파싱 로직 수정 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

// ✅ 필수 렌더러 import 추가
const FortuneRenderer = require("../renderers/FortuneRenderer");
const TodoRenderer = require("../renderers/TodoRenderer");
const SystemRenderer = require("../renderers/SystemRenderer");
const TTSRenderer = require("../renderers/TTSRenderer");
const WeatherRenderer = require("../renderers/WeatherRenderer");
const TimerRenderer = require("../renderers/TimerRenderer");
const LeaveRenderer = require("../renderers/LeaveRenderer");

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map(); // 렌더러 캐시
  }

  initialize(bot) {
    this.bot = bot;

    // ✅ 렌더러 등록
    this.registerRenderer("fortune", new FortuneRenderer(bot, this));
    this.registerRenderer("todo", new TodoRenderer(bot, this));
    this.registerRenderer("system", new SystemRenderer(bot, this));
    this.registerRenderer("tts", new TTSRenderer(bot, this));
    this.registerRenderer("weather", new WeatherRenderer(bot, this));
    this.registerRenderer("timer", new TimerRenderer(bot, this));
    this.registerRenderer("leave", new LeaveRenderer(bot, this));

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

  /**
   * 🔧 콜백 데이터 파싱 개선 (핵심 수정!)
   */
  parseCallbackData(data) {
    const parts = data.split(":");

    if (parts.length < 2) {
      return {
        moduleKey: parts[0],
        subAction: "menu",
        params: "",
      };
    }

    const moduleKey = parts[0];

    // ✅ 핵심 수정: subAction을 올바르게 구성
    // leave:use:full → moduleKey="leave", subAction="use:full", params=""
    // leave:use → moduleKey="leave", subAction="use", params=""
    // leave:status → moduleKey="leave", subAction="status", params=""

    if (parts.length === 2) {
      return {
        moduleKey: moduleKey,
        subAction: parts[1],
        params: "",
      };
    }

    // 3개 이상의 파트가 있는 경우
    if (parts.length >= 3) {
      // 모듈:액션:하위액션 형태인지 확인
      // leave:use:full → subAction = "use:full"
      const possibleSubAction = `${parts[1]}:${parts[2]}`;

      return {
        moduleKey: moduleKey,
        subAction: possibleSubAction,
        params: parts.length > 3 ? parts.slice(3).join(":") : "",
      };
    }

    return {
      moduleKey: moduleKey,
      subAction: parts[1] || "menu",
      params: parts.length > 2 ? parts.slice(2).join(":") : "",
    };
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

      // ✅ 개선된 콜백 데이터 파싱 사용
      const { moduleKey, subAction, params } = this.parseCallbackData(data);

      logger.debug(`🎯 콜백 파싱 결과:`, {
        원본: data,
        moduleKey,
        subAction,
        params,
      });

      // 1. 모듈에서 데이터 가져오기 (비즈니스 로직)
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params
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

      // ✅ 수정: 에러 메시지 전송 시에도 안전한 처리
      try {
        await this.sendSafeErrorMessage(ctx, "처리 중 오류가 발생했습니다.");
      } catch (errorSendError) {
        logger.error("💥 오류 메시지 전송 실패:", errorSendError);
        // 최후의 수단: answerCbQuery로 알림
        try {
          await ctx.answerCbQuery("처리 중 오류가 발생했습니다.", {
            show_alert: true,
          });
        } catch (finalError) {
          logger.error("💥 최종 오류 알림도 실패:", finalError);
        }
      }
    }
  }

  /**
   * 🛡️ 안전한 에러 메시지 전송
   */
  async sendSafeErrorMessage(ctx, message) {
    const text = `❌ *오류 발생*\n\n${this.escapeMarkdownV2(message)}`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    try {
      // 메시지 편집 시도
      if (ctx.callbackQuery?.message?.message_id) {
        await ctx.editMessageText(text, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        // 새 메시지 전송
        await ctx.reply(text, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      // 마크다운 실패 시 일반 텍스트로 전송
      const plainText = `❌ 오류 발생\n\n${message}`;

      try {
        if (ctx.callbackQuery?.message?.message_id) {
          await ctx.editMessageText(plainText, { reply_markup: keyboard });
        } else {
          await ctx.reply(plainText, { reply_markup: keyboard });
        }
      } catch (finalError) {
        // 모든 시도 실패 시 answerCbQuery로 알림
        await ctx.answerCbQuery(message, { show_alert: true });
      }
    }
  }

  /**
   * 🏠 메인 메뉴 표시 (SystemRenderer에게 완전 위임)
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx.callbackQuery?.from || ctx.from);
      const enabledModules = getEnabledModules();

      // ✅ SystemRenderer에게 완전 위임
      const systemRenderer = this.renderers.get("system");
      if (systemRenderer) {
        const result = {
          type: "main_menu",
          module: "system",
          data: {
            userName,
            enabledModules,
          },
        };

        await systemRenderer.render(result, ctx);
        return true;
      } else {
        logger.warn("📱 SystemRenderer를 찾을 수 없음 - 기본 메시지만 전송");
        await ctx.editMessageText("❌ 시스템 렌더러를 찾을 수 없습니다.");
        return false;
      }
    } catch (error) {
      logger.error("💥 메인 메뉴 표시 오류:", error);
      await this.sendSafeErrorMessage(ctx, "메인 메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 📱 모듈 메뉴 전송 (명령어용 - 최소한만)
   */
  async sendModuleMenu(bot, chatId, moduleName) {
    try {
      // 단순한 안내 메시지만 전송
      const text = `🎯 ${moduleName} 모듈`;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 메뉴 열기", callback_data: `${moduleName}:menu` }],
        ],
      };

      await bot.sendMessage(chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error(`💥 모듈 메뉴 전송 실패 (${moduleName}):`, error);
      await bot.sendMessage(
        chatId,
        `❌ ${moduleName} 모듈 메뉴를 열 수 없습니다.`
      );
    }
  }

  /**
   * 🎭 폴백 메시지 렌더링 (최소한만)
   */
  async renderFallbackMessage(ctx, result) {
    const text = `⚠️ 렌더러 없음!\n\n모듈: ${
      result.module || "알 수 없음"
    }\n타입: ${result.type || "알 수 없음"}`;

    try {
      await ctx.editMessageText(text);
    } catch (error) {
      logger.error("💥 폴백 메시지 렌더링 실패:", error);
      await ctx.answerCbQuery("처리 완료");
    }
  }

  /**
   * 🎭 에러 메시지 렌더링 (최소한만)
   */
  async renderErrorMessage(ctx, message) {
    await this.sendSafeErrorMessage(ctx, message);
  }

  /**
   * 📊 NavigationHandler 상태 조회
   */
  getStatus() {
    return {
      serviceName: "NavigationHandler",
      hasBot: !!this.bot,
      hasModuleManager: !!this.moduleManager,
      rendererCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
      isReady: !!(this.bot && this.moduleManager),
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.renderers.clear();
      this.bot = null;
      this.moduleManager = null;

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
