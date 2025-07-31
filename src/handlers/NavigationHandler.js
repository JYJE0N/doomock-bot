// src/handlers/NavigationHandler.js
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

// ✅ 필수 렌더러 import
const FortuneRenderer = require("../renderers/FortuneRenderer");
const TodoRenderer = require("../renderers/TodoRenderer");
const SystemRenderer = require("../renderers/SystemRenderer");
const TTSRenderer = require("../renderers/TTSRenderer");
const WeatherRenderer = require("../renderers/WeatherRenderer");
const TimerRenderer = require("../renderers/TimerRenderer");
const LeaveRenderer = require("../renderers/LeaveRenderer");

/**
 * 🎯 중앙 네비게이션 핸들러
 * - 단순화된 콜백 파싱
 * - 표준 매개변수 체계 준수
 * - SoC 원칙 준수 (UI 라우팅만 담당)
 */
class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
    this.renderers = new Map();

    // 📊 통계
    this.stats = {
      callbacksProcessed: 0,
      errorsCount: 0,
      lastActivity: null,
    };
  }

  /**
   * 🎯 초기화
   */
  initialize(bot) {
    this.bot = bot;

    // ✅ 렌더러 등록 (표준 패턴)
    this.registerRenderers();

    this.stats.lastActivity = new Date();
    logger.info("🎹 NavigationHandler 초기화 완료");
  }

  /**
   * 📱 렌더러 등록
   */
  registerRenderers() {
    const renderers = [
      ["fortune", new FortuneRenderer(this.bot, this)],
      ["todo", new TodoRenderer(this.bot, this)],
      ["system", new SystemRenderer(this.bot, this)],
      ["tts", new TTSRenderer(this.bot, this)],
      ["weather", new WeatherRenderer(this.bot, this)],
      ["timer", new TimerRenderer(this.bot, this)],
      ["leave", new LeaveRenderer(this.bot, this)],
    ];

    renderers.forEach(([name, renderer]) => {
      this.renderers.set(name, renderer);
      logger.debug(`📱 ${name} 렌더러 등록됨`);
    });
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  /**
   * 🔧 콜백 데이터 파싱 (단순화된 최종 버전)
   * "module:action:param1:param2" 형식을 일관되게 파싱합니다.
   *
   * 예시:
   * - "leave:menu" → { moduleKey: "leave", subAction: "menu", params: "" }
   * - "leave:use:full" → { moduleKey: "leave", subAction: "use", params: "full" }
   * - "timer:start:30:workout" → { moduleKey: "timer", subAction: "start", params: "30:workout" }
   */
  parseCallbackData(data) {
    if (!data || typeof data !== "string") {
      logger.warn("⚠️ 잘못된 콜백 데이터:", data);
      return { moduleKey: "system", subAction: "menu", params: "" };
    }

    const parts = data.split(":");

    return {
      moduleKey: parts[0] || "system", // 첫 번째 부분: 모듈명
      subAction: parts[1] || "menu", // 두 번째 부분: 액션명
      params: parts.length > 2 ? parts.slice(2).join(":") : "", // 나머지: 파라미터들
    };
  }

  /**
   * 🎯 메인 콜백 처리 (표준 흐름)
   */
  async handleCallback(ctx) {
    try {
      // ✅ 한 번만 answerCbQuery 호출 - 텔레그램 표준 준수
      await ctx.answerCbQuery();

      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      logger.debug(`🎯 콜백 수신: ${data}`);

      // 시스템 메뉴는 직접 처리
      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      // ✅ 단순화된 콜백 데이터 파싱
      const { moduleKey, subAction, params } = this.parseCallbackData(data);

      logger.debug(`🎯 콜백 파싱 결과:`, {
        원본: data,
        moduleKey,
        subAction,
        params,
      });

      // 1️⃣ 모듈에서 비즈니스 로직 처리
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params
      );

      if (!result) {
        logger.warn(`💫 모듈에서 결과 없음: ${moduleKey}.${subAction}`);
        return await this.renderErrorMessage(ctx, "처리할 수 없는 요청입니다.");
      }

      // 2️⃣ 해당 모듈의 렌더러로 UI 렌더링
      const renderer = this.renderers.get(result.module || moduleKey);

      if (renderer) {
        await renderer.render(result, ctx);
        logger.debug(`✅ ${moduleKey}.${subAction} 렌더링 완료`);
      } else {
        logger.warn(`📱 렌더러 없음: ${result.module || moduleKey}`);
        await this.renderFallbackMessage(ctx, result);
      }
    } catch (error) {
      logger.error("💥 NavigationHandler 콜백 처리 오류:", error);
      this.stats.errorsCount++;

      try {
        await this.sendSafeErrorMessage(ctx, "처리 중 오류가 발생했습니다.");
      } catch (recoveryError) {
        logger.error("💥 오류 복구 실패:", recoveryError);
      }
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(ctx) {
    try {
      const userName = getUserName(ctx.callbackQuery.from);
      const enabledModules = getEnabledModules();

      const text = `🏠 메인 메뉴\n안녕하세요, ${userName}님!`;

      const keyboard = {
        inline_keyboard: enabledModules
          .filter((module) => module.showInMenu)
          .map((module) => [
            {
              text: `${module.icon} ${module.displayName}`,
              callback_data: `${module.key}:menu`,
            },
          ]),
      };

      await ctx.editMessageText(text, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      return true;
    } catch (error) {
      logger.error("💥 메인 메뉴 표시 오류:", error);
      await this.sendSafeErrorMessage(ctx, "메인 메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 📱 모듈 메뉴 전송 (명령어용)
   */
  async sendModuleMenu(bot, chatId, moduleName) {
    try {
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
   * ⚠️ 폴백 메시지 렌더링
   */
  async renderFallbackMessage(ctx, result) {
    const text = `⚠️ 렌더러 없음!\n\n모듈: ${
      result.module || "알 수 없음"
    }\n타입: ${result.type || "알 수 없음"}`;

    try {
      await ctx.editMessageText(text);
    } catch (error) {
      logger.debug("폴백 메시지 렌더링 실패, answerCbQuery로 대체");
      await ctx.answerCbQuery("처리 완료");
    }
  }

  /**
   * ❌ 에러 메시지 렌더링
   */
  async renderErrorMessage(ctx, message) {
    await this.sendSafeErrorMessage(ctx, message);
  }

  /**
   * 🛡️ 안전한 에러 메시지 전송
   */
  async sendSafeErrorMessage(ctx, message) {
    try {
      // 메시지 수정 시도
      await ctx.editMessageText(`❌ ${message}`);
    } catch (editError) {
      try {
        // 수정 실패시 콜백 응답
        await ctx.answerCbQuery(message, { show_alert: true });
      } catch (answerError) {
        logger.error("💥 완전한 에러 응답 실패:", answerError);
      }
    }
  }

  /**
   * 📊 상태 정보
   */
  getStatus() {
    return {
      serviceName: "NavigationHandler",
      isReady: !!(this.bot && this.moduleManager),
      stats: this.stats,
      rendererCount: this.renderers.size,
      registeredRenderers: Array.from(this.renderers.keys()),
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

  // ===== 🛠️ 유틸리티 메서드 =====

  /**
   * MarkdownV2 이스케이프
   */
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

    let escaped = text;
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });

    return escaped;
  }
}

module.exports = NavigationHandler;
